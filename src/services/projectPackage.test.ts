import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../constants';
import type { ImageAssetRecord } from '../types';
import {
  createImageCssValue,
  exportProjectPackage,
  loadProjectPackage,
} from './projectPackage';

const makeMidiFile = () => new File(['midi'], 'song.mid', { type: 'audio/midi' });
const makeAudioFile = () => new File(['audio'], 'backing.wav', { type: 'audio/wav' });
const makeImageFile = () => new File(['image'], 'wallpaper.png', { type: 'image/png' });

describe('projectPackage', () => {
  it('exports manifest, config, MIDI, audio, and image assets', async () => {
    const midiFile = makeMidiFile();
    const audioFile = makeAudioFile();
    const imageCss = createImageCssValue('blob:image');
    const imageAsset: ImageAssetRecord = {
      id: 'globalBgColor-asset',
      file: makeImageFile(),
      objectUrl: 'blob:image',
      cssValue: imageCss,
    };

    const blob = await exportProjectPackage({
      config: {
        ...DEFAULT_CONFIG,
        globalBgColor: imageCss,
        audioOffsetMs: 1250,
      },
      midiFile,
      audioFile,
      imageAssets: [imageAsset],
    });

    const zip = await JSZip.loadAsync(blob);
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'));
    const config = JSON.parse(await zip.file('config.json')!.async('string'));

    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.midi.path).toBe('assets/midi/song.mid');
    expect(manifest.audio.path).toBe('assets/audio/backing.wav');
    expect(manifest.images).toEqual([
      expect.objectContaining({
        id: 'globalBgColor-asset',
        path: 'assets/images/globalBgColor-asset-wallpaper.png',
        configKeys: ['globalBgColor'],
      }),
    ]);
    expect(config.audioOffsetMs).toBe(1250);
    expect(config.globalBgColor).toContain('midi-visitor-asset:globalBgColor-asset');
    expect(zip.file('assets/midi/song.mid')).not.toBeNull();
    expect(zip.file('assets/audio/backing.wav')).not.toBeNull();
    expect(zip.file('assets/images/globalBgColor-asset-wallpaper.png')).not.toBeNull();
  });

  it('omits audio and images when they are not present', async () => {
    const blob = await exportProjectPackage({
      config: DEFAULT_CONFIG,
      midiFile: makeMidiFile(),
      audioFile: null,
      imageAssets: [],
    });

    const zip = await JSZip.loadAsync(blob);
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'));

    expect(manifest.audio).toBeNull();
    expect(manifest.images).toEqual([]);
    expect(zip.file(/^assets\/audio\//)).toEqual([]);
    expect(zip.file(/^assets\/images\//)).toEqual([]);
  });

  it('loads a package and restores config plus resource mappings', async () => {
    const imageCss = createImageCssValue('blob:image');
    const blob = await exportProjectPackage({
      config: {
        ...DEFAULT_CONFIG,
        globalBgColor: imageCss,
        midiBpmOffset: 4,
      },
      midiFile: makeMidiFile(),
      audioFile: makeAudioFile(),
      imageAssets: [
        {
          id: 'bg',
          file: makeImageFile(),
          objectUrl: 'blob:image',
          cssValue: imageCss,
        },
      ],
    });

    const loaded = await loadProjectPackage(
      new File([blob], 'project.zip', { type: 'application/zip' })
    );

    expect(loaded.config.midiBpmOffset).toBe(4);
    expect(loaded.config.globalBgColor).toContain('midi-visitor-asset:bg');
    expect(loaded.midiFile.name).toBe('song.mid');
    expect(loaded.audioFile?.name).toBe('backing.wav');
    expect(loaded.images).toHaveLength(1);
    expect(loaded.images[0].id).toBe('bg');
    expect(loaded.images[0].configKeys).toEqual(['globalBgColor']);
  });

  it('throws clear errors when required package files are missing', async () => {
    const missingManifestZip = new JSZip();
    missingManifestZip.file('config.json', '{}');
    const missingManifestBlob = await missingManifestZip.generateAsync({ type: 'blob' });

    await expect(
      loadProjectPackage(new File([missingManifestBlob], 'missing-manifest.zip'))
    ).rejects.toThrow('manifest.json');

    const missingConfigZip = new JSZip();
    missingConfigZip.file('manifest.json', JSON.stringify({
      schemaVersion: 1,
      appName: 'midi-visitor',
      exportedAt: new Date().toISOString(),
      midi: {
        path: 'assets/midi/song.mid',
        fileName: 'song.mid',
        mimeType: 'audio/midi',
      },
      audio: null,
      images: [],
    }));
    missingConfigZip.file('assets/midi/song.mid', 'midi');
    const missingConfigBlob = await missingConfigZip.generateAsync({ type: 'blob' });

    await expect(
      loadProjectPackage(new File([missingConfigBlob], 'missing-config.zip'))
    ).rejects.toThrow('config.json');
  });
});
