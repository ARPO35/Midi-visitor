import JSZip from 'jszip';
import { DEFAULT_CONFIG } from '../constants';
import { ScrollDirection } from '../types';
import type {
  ImageAssetRecord,
  LoadedProjectPackage,
  ProjectPackageAsset,
  ProjectPackageImageAsset,
  ProjectPackageManifest,
  VisualConfig,
  WaveformMode,
} from '../types';

const APP_NAME = 'midi-visitor';
const SCHEMA_VERSION = 1;
const IMAGE_ASSET_PROTOCOL = 'midi-visitor-asset:';
const CONFIG_KEYS = Object.keys(DEFAULT_CONFIG) as Array<keyof VisualConfig>;
const CONFIG_KEY_SET = new Set<string>(CONFIG_KEYS);
const WAVEFORM_MODES = new Set<WaveformMode>(['peak', 'pcm']);
const RESERVED_FILE_NAME_CHARS = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*']);

export interface ExportProjectPackageInput {
  config: VisualConfig;
  midiFile: File;
  audioFile: File | null;
  imageAssets: Iterable<ImageAssetRecord>;
}

export const createImageCssValue = (uri: string) => {
  const escapedUri = uri.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `url('${escapedUri}') center / cover no-repeat`;
};

export const buildProjectPackageFileName = (midiFileName: string) => {
  const safeName = sanitizePackageFileName(midiFileName, 'project');
  const stem = safeName.replace(/\.[^.]*$/, '') || 'project';
  return `midi-visitor-${stem}.zip`;
};

export async function exportProjectPackage(input: ExportProjectPackageInput): Promise<Blob> {
  const zip = new JSZip();
  const usedPaths = new Set<string>();
  const configForPackage: VisualConfig = {
    ...input.config,
    hiddenTracks: [...input.config.hiddenTracks],
  };

  const midiAsset = addFileToZip(zip, usedPaths, 'assets/midi', input.midiFile);
  const audioAsset = input.audioFile
    ? addFileToZip(zip, usedPaths, 'assets/audio', input.audioFile)
    : null;
  const images = addImageAssets(zip, usedPaths, configForPackage, input.config, input.imageAssets);

  const manifest: ProjectPackageManifest = {
    schemaVersion: SCHEMA_VERSION,
    appName: APP_NAME,
    exportedAt: new Date().toISOString(),
    midi: midiAsset,
    audio: audioAsset,
    images,
  };

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('config.json', JSON.stringify(configForPackage, null, 2));

  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

export async function loadProjectPackage(file: File): Promise<LoadedProjectPackage> {
  const zip = await JSZip.loadAsync(file);
  const manifest = validateManifest(await readJson(zip, 'manifest.json'));
  const config = mergeVisualConfig(await readJson(zip, 'config.json'));

  const midiFile = await readAssetFile(zip, manifest.midi);
  const audioFile = manifest.audio ? await readAssetFile(zip, manifest.audio) : null;
  const images = await Promise.all(
    manifest.images.map(async (image) => ({
      id: image.id,
      file: await readAssetFile(zip, image),
      configKeys: image.configKeys,
    }))
  );

  return {
    config,
    midiFile,
    audioFile,
    images,
  };
}

function addImageAssets(
  zip: JSZip,
  usedPaths: Set<string>,
  configForPackage: VisualConfig,
  sourceConfig: VisualConfig,
  imageAssets: Iterable<ImageAssetRecord>
) {
  const images: ProjectPackageImageAsset[] = [];
  const packageConfig = configForPackage as Record<keyof VisualConfig, unknown>;

  for (const asset of imageAssets) {
    const configKeys = CONFIG_KEYS.filter((key) => sourceConfig[key] === asset.cssValue);
    if (configKeys.length === 0) continue;

    const imageAsset = addFileToZip(
      zip,
      usedPaths,
      'assets/images',
      asset.file,
      `${sanitizeAssetId(asset.id)}-${asset.file.name}`
    );

    for (const key of configKeys) {
      packageConfig[key] = createImageCssValue(`${IMAGE_ASSET_PROTOCOL}${asset.id}`);
    }

    images.push({
      ...imageAsset,
      id: asset.id,
      configKeys,
    });
  }

  return images;
}

function addFileToZip(
  zip: JSZip,
  usedPaths: Set<string>,
  folder: string,
  file: File,
  pathName = file.name
): ProjectPackageAsset {
  const fileName = sanitizePackageFileName(pathName, 'asset');
  const path = reserveUniquePath(usedPaths, `${folder}/${fileName}`);
  zip.file(path, file);

  return {
    path,
    fileName: sanitizePackageFileName(file.name, 'asset'),
    mimeType: file.type || 'application/octet-stream',
  };
}

function reserveUniquePath(usedPaths: Set<string>, path: string) {
  if (!usedPaths.has(path)) {
    usedPaths.add(path);
    return path;
  }

  const dotIndex = path.lastIndexOf('.');
  const prefix = dotIndex > -1 ? path.slice(0, dotIndex) : path;
  const suffix = dotIndex > -1 ? path.slice(dotIndex) : '';
  let counter = 2;

  while (true) {
    const nextPath = `${prefix}-${counter}${suffix}`;
    if (!usedPaths.has(nextPath)) {
      usedPaths.add(nextPath);
      return nextPath;
    }
    counter += 1;
  }
}

function sanitizePackageFileName(name: string, fallback: string) {
  const baseName = name.split(/[\\/]/).pop()?.trim() || fallback;
  const sanitized = Array.from(baseName)
    .map((char) =>
      char.charCodeAt(0) < 32 || RESERVED_FILE_NAME_CHARS.has(char) ? '_' : char
    )
    .join('')
    .replace(/\s+/g, ' ')
    .slice(0, 160)
    .trim();
  return sanitized || fallback;
}

function sanitizeAssetId(id: string) {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_') || 'image';
}

async function readJson(zip: JSZip, path: string): Promise<unknown> {
  const entry = zip.file(path);
  if (!entry) {
    throw new Error(`配置包缺少 ${path}`);
  }

  try {
    return JSON.parse(await entry.async('string')) as unknown;
  } catch {
    throw new Error(`配置包中的 ${path} 不是有效 JSON`);
  }
}

async function readAssetFile(zip: JSZip, asset: ProjectPackageAsset) {
  const entry = zip.file(asset.path);
  if (!entry) {
    throw new Error(`配置包缺少资源 ${asset.path}`);
  }

  const blob = await entry.async('blob');
  return new File([blob], asset.fileName, {
    type: asset.mimeType || 'application/octet-stream',
    lastModified: Date.now(),
  });
}

function validateManifest(rawManifest: unknown): ProjectPackageManifest {
  const manifest = requireRecord(rawManifest, 'manifest.json');

  if (manifest.schemaVersion !== SCHEMA_VERSION) {
    throw new Error('配置包 schemaVersion 不受支持');
  }
  if (manifest.appName !== APP_NAME) {
    throw new Error('配置包 appName 不匹配');
  }

  const imagesValue = manifest.images;
  if (!Array.isArray(imagesValue)) {
    throw new Error('配置包 manifest.images 无效');
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    appName: APP_NAME,
    exportedAt: expectString(manifest.exportedAt, 'manifest.exportedAt'),
    midi: validateAsset(manifest.midi, 'manifest.midi'),
    audio: manifest.audio === null || manifest.audio === undefined
      ? null
      : validateAsset(manifest.audio, 'manifest.audio'),
    images: imagesValue.map((image, index) => validateImageAsset(image, `manifest.images[${index}]`)),
  };
}

function validateAsset(value: unknown, label: string): ProjectPackageAsset {
  const asset = requireRecord(value, label);
  return {
    path: expectString(asset.path, `${label}.path`),
    fileName: sanitizePackageFileName(expectString(asset.fileName, `${label}.fileName`), 'asset'),
    mimeType: expectString(asset.mimeType, `${label}.mimeType`),
  };
}

function validateImageAsset(value: unknown, label: string): ProjectPackageImageAsset {
  const asset = requireRecord(value, label);
  const baseAsset = validateAsset(value, label);
  const configKeys = asset.configKeys;

  if (!Array.isArray(configKeys)) {
    throw new Error(`${label}.configKeys 无效`);
  }

  return {
    ...baseAsset,
    id: expectString(asset.id, `${label}.id`),
    configKeys: configKeys.map((key, index) =>
      validateConfigKey(key, `${label}.configKeys[${index}]`)
    ),
  };
}

function mergeVisualConfig(rawConfig: unknown): VisualConfig {
  const raw = requireRecord(rawConfig, 'config.json');
  const merged: VisualConfig = {
    ...DEFAULT_CONFIG,
    hiddenTracks: [...DEFAULT_CONFIG.hiddenTracks],
  };
  const target = merged as Record<keyof VisualConfig, unknown>;

  for (const key of CONFIG_KEYS) {
    const value = raw[key];
    if (value === undefined) continue;

    if (key === 'direction') {
      if (value === ScrollDirection.Horizontal || value === ScrollDirection.Vertical) {
        target[key] = value;
      }
      continue;
    }

    if (key === 'waveformMode') {
      if (typeof value === 'string' && WAVEFORM_MODES.has(value as WaveformMode)) {
        target[key] = value;
      }
      continue;
    }

    if (key === 'waveformPeakSampleRate') {
      if (value === null || isFiniteNumber(value)) {
        target[key] = value === null ? null : Math.max(1, Math.round(value));
      }
      continue;
    }

    if (key === 'hiddenTracks') {
      if (Array.isArray(value)) {
        target[key] = value.filter(isFiniteNumber).map((trackId) => Math.round(trackId));
      }
      continue;
    }

    const defaultValue = DEFAULT_CONFIG[key];
    if (typeof defaultValue === 'number' && isFiniteNumber(value)) {
      target[key] = value;
      continue;
    }
    if (typeof defaultValue === 'boolean' && typeof value === 'boolean') {
      target[key] = value;
      continue;
    }
    if (typeof defaultValue === 'string' && typeof value === 'string') {
      target[key] = value;
    }
  }

  return merged;
}

function validateConfigKey(value: unknown, label: string): keyof VisualConfig {
  if (typeof value !== 'string' || !CONFIG_KEY_SET.has(value)) {
    throw new Error(`${label} 不是有效配置字段`);
  }

  return value as keyof VisualConfig;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} 格式无效`);
  }

  return value as Record<string, unknown>;
}

function expectString(value: unknown, label: string) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} 必须是字符串`);
  }

  return value;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
