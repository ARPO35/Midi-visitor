import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Midi } from '@tonejs/midi';
import Sidebar from './components/Sidebar';
import { DEFAULT_CONFIG } from './constants';
import type {
  AudioLoadResult,
  ImageAssetRecord,
  LoadedAudioData,
  MidiData,
  NoteData,
  TrackInfo,
  VisualConfig,
  WaveformBuildEvent,
  WaveformBuildProgress,
  WaveformCache,
  WaveformLineData,
  WaveformLevelCache,
} from './types';
import { ScrollDirection } from './types';
import { audioEngine } from './services/audio';
import { WaveformBuilder } from './services/waveformBuilder';
import { getViewportTimeAtAxisPosition, getViewportTimeWindow } from './services/viewportWindow';
import { getRequestedWaveformLevels } from './services/waveformPeak';
import {
  buildNoteTimelineIndex,
  findPlaybackNoteCursor,
  getNoteRangeForWindow,
  type NoteTimelineIndex,
} from './services/noteIndex';
import { buildWaveformLineData } from './services/waveformLine';
import { createCanvasLinearGradient, parseLinearGradientCss } from './services/gradient';
import {
  buildProjectPackageFileName,
  createImageCssValue,
  exportProjectPackage,
  loadProjectPackage,
} from './services/projectPackage';

const WAVEFORM_CHUNK_DURATION_SEC = 5;
const UI_SYNC_INTERVAL_MS = 100;

const createImageAssetId = (field: keyof VisualConfig) => {
  const randomPart =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${String(field)}-${randomPart}`;
};

const downloadProjectBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const readFileAsArrayBuffer = (file: File) => {
  const maybeArrayBuffer = (file as Blob & { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer;
  if (typeof maybeArrayBuffer === 'function') {
    return maybeArrayBuffer.call(file);
  }

  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (result instanceof ArrayBuffer) {
        resolve(result);
        return;
      }
      reject(new Error('FileReader did not return an ArrayBuffer'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
};

const IDLE_WAVEFORM_PROGRESS: WaveformBuildProgress = {
  generationId: 0,
  peaksPerSecond: [],
  completedChunks: 0,
  totalChunks: 0,
  status: 'idle',
};

const FALLBACK_WAVEFORM_STROKE = 'rgba(255, 255, 255, 0.35)';
const FALLBACK_WAVEFORM_FILL = 'rgba(255, 255, 255, 0.08)';

interface CanvasLayout {
  width: number;
  height: number;
  dpr: number;
  activeX: number;
  activeY: number;
  activeW: number;
  activeH: number;
  activeCX: number;
  activeCY: number;
  clipPath: Path2D;
}

const App: React.FC = () => {
  const [config, setConfig] = useState<VisualConfig>(DEFAULT_CONFIG);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [midiData, setMidiData] = useState<MidiData | null>(null);
  const [loadedAudio, setLoadedAudio] = useState<LoadedAudioData | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const [canExportProject, setCanExportProject] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [waveformBuildProgress, setWaveformBuildProgress] =
    useState<WaveformBuildProgress>(IDLE_WAVEFORM_PROGRESS);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(0);
  const playbackCursorRef = useRef<number>(-config.startDelay);
  const lastFrameTimeRef = useRef<number>(0);
  const lastNoteCheckTimeRef = useRef<number>(-config.startDelay);
  const lastUiSyncTimeRef = useRef<number>(0);
  const canvasLayoutRef = useRef<CanvasLayout | null>(null);
  const noteTimelineRef = useRef<NoteTimelineIndex | null>(null);
  const playbackNoteCursorRef = useRef(0);
  const waveformCacheRef = useRef<WaveformCache | null>(null);
  const waveformLineRef = useRef<WaveformLineData | null>(null);
  const loadedAudioSourceRef = useRef<AudioLoadResult | null>(null);
  const waveformBuilderRef = useRef<WaveformBuilder | null>(null);
  const waveformGenerationRef = useRef(0);
  const externalAudioPlayRequestRef = useRef<Promise<void> | null>(null);
  const midiFileRef = useRef<File | null>(null);
  const audioFileRef = useRef<File | null>(null);
  const imageAssetsRef = useRef<Map<string, ImageAssetRecord>>(new Map());

  const hasExternalAudio = loadedAudio !== null;
  const originalBpm = midiData?.originalBpm ?? null;
  const effectiveBpm = originalBpm
    ? (hasExternalAudio ? Math.max(1, originalBpm + config.midiBpmOffset) : config.bpm)
    : config.bpm;

  const revokeImageAssets = useCallback((assets: Iterable<ImageAssetRecord>) => {
    for (const asset of assets) {
      URL.revokeObjectURL(asset.objectUrl);
    }
  }, []);

  const handleColorImageSelected = useCallback((field: keyof VisualConfig, file: File) => {
    const objectUrl = URL.createObjectURL(file);
    const cssValue = createImageCssValue(objectUrl);
    const id = createImageAssetId(field);

    imageAssetsRef.current.set(id, {
      id,
      file,
      objectUrl,
      cssValue,
    });

    return cssValue;
  }, []);

  const resetWaveformState = useCallback(() => {
    const generationId = waveformGenerationRef.current;
    if (generationId > 0) {
      waveformBuilderRef.current?.cancelBuild(generationId);
    }

    waveformGenerationRef.current += 1;
    waveformCacheRef.current = null;
    setWaveformBuildProgress(IDLE_WAVEFORM_PROGRESS);
  }, []);

  const cancelWaveformBuild = useCallback(() => {
    const generationId = waveformGenerationRef.current;
    if (generationId > 0) {
      waveformBuilderRef.current?.cancelBuild(generationId);
    }

    waveformGenerationRef.current += 1;
    waveformCacheRef.current = null;
  }, []);

  const resetPlaybackPosition = useCallback((time: number) => {
    playbackCursorRef.current = time;
    lastNoteCheckTimeRef.current = time;
    playbackNoteCursorRef.current = noteTimelineRef.current
      ? findPlaybackNoteCursor(noteTimelineRef.current, time)
      : 0;
  }, []);

  const updateCanvasLayout = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width <= 0 || height <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    const pixelWidth = Math.max(1, Math.round(width * dpr));
    const pixelHeight = Math.max(1, Math.round(height * dpr));
    const layout = canvasLayoutRef.current;

    if (
      canvas.width !== pixelWidth ||
      canvas.height !== pixelHeight ||
      layout?.width !== width ||
      layout?.height !== height ||
      layout?.dpr !== dpr
    ) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const padTop = (height * config.boundTop) / 100;
    const padBottom = (height * config.boundBottom) / 100;
    const padLeft = (width * config.boundLeft) / 100;
    const padRight = (width * config.boundRight) / 100;

    const activeW = width - padLeft - padRight;
    const activeH = height - padTop - padBottom;
    const activeX = padLeft;
    const activeY = padTop;
    const activeCX = activeX + activeW / 2;
    const activeCY = activeY + activeH / 2;

    const clipPath = new Path2D();
    clipPath.roundRect(activeX, activeY, activeW, activeH, config.borderRadius);

    canvasLayoutRef.current = {
      width,
      height,
      dpr,
      activeX,
      activeY,
      activeW,
      activeH,
      activeCX,
      activeCY,
      clipPath,
    };
  }, [
    config.boundBottom,
    config.boundLeft,
    config.boundRight,
    config.boundTop,
    config.borderRadius,
  ]);

  const applyWaveformEvent = useCallback((event: WaveformBuildEvent) => {
    if (event.generationId !== waveformGenerationRef.current) return;

    if (event.type === 'chunkComplete') {
      const cache = waveformCacheRef.current;
      if (!cache || cache.generationId !== event.generationId) return;

      cache.completedChunks = event.completedChunks;

      event.chunks.forEach((chunk) => {
        const level =
          cache.levels.get(chunk.peaksPerSecond) ??
          ({
            peaksPerSecond: chunk.peaksPerSecond,
            chunks: new Map<number, Float32Array>(),
          } satisfies WaveformLevelCache);
        level.chunks.set(chunk.chunkIndex, new Float32Array(chunk.data));
        cache.levels.set(chunk.peaksPerSecond, level);
      });

      return;
    }

    if (event.type === 'progress' || event.type === 'complete') {
      setWaveformBuildProgress({
        generationId: event.generationId,
        peaksPerSecond: event.peaksPerSecond,
        completedChunks: event.completedChunks,
        totalChunks: event.totalChunks,
        status: event.status,
      });
      return;
    }

    console.error('Waveform build failed', event.message);
    setWaveformBuildProgress(IDLE_WAVEFORM_PROGRESS);
  }, []);

  useEffect(() => {
    const builder = new WaveformBuilder(applyWaveformEvent);
    waveformBuilderRef.current = builder;

    return () => {
      builder.dispose();
      waveformBuilderRef.current = null;
    };
  }, [applyWaveformEvent]);

  useEffect(() => {
    audioEngine.setVolume(config.masterVolume);
  }, [config.masterVolume]);

  useEffect(() => {
    audioEngine.setMidiSynthEnabled(!hasExternalAudio);
  }, [hasExternalAudio]);

  useEffect(() => {
    if (!isPlaying && playbackTime <= 0) {
      resetPlaybackPosition(-config.startDelay);
    }
  }, [config.startDelay, isPlaying, playbackTime, resetPlaybackPosition]);

  useEffect(() => {
    return () => {
      audioEngine.clearAudio();
    };
  }, []);

  useEffect(() => {
    return () => {
      revokeImageAssets(imageAssetsRef.current.values());
      imageAssetsRef.current.clear();
    };
  }, [revokeImageAssets]);

  useEffect(() => {
    const activeImageValues = new Set(
      Object.values(config).filter(
        (value): value is string => typeof value === 'string' && value.startsWith('url')
      )
    );

    for (const [id, asset] of imageAssetsRef.current) {
      if (!activeImageValues.has(asset.cssValue)) {
        URL.revokeObjectURL(asset.objectUrl);
        imageAssetsRef.current.delete(id);
      }
    }
  }, [config]);

  useEffect(() => {
    updateCanvasLayout();

    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      updateCanvasLayout();
    });

    resizeObserver.observe(container);
    window.addEventListener('resize', updateCanvasLayout);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateCanvasLayout);
    };
  }, [updateCanvasLayout]);

  const startWaveformBuild = useCallback((audioData: AudioLoadResult) => {
    const builder = waveformBuilderRef.current;
    if (!builder) return;

    const requestedLevels = getRequestedWaveformLevels(config.waveformPeakSampleRate);
    const transferBuffers = audioData.channelBuffers.map((buffer) => buffer.slice(0));

    resetWaveformState();

    const generationId = waveformGenerationRef.current;
    const totalChunks = Math.max(
      1,
      Math.ceil(audioData.duration / WAVEFORM_CHUNK_DURATION_SEC)
    );

    waveformCacheRef.current = {
      generationId,
      peaksPerSecond: requestedLevels,
      chunkDurationSec: WAVEFORM_CHUNK_DURATION_SEC,
      totalChunks,
      duration: audioData.duration,
      levels: new Map<number, WaveformLevelCache>(
        requestedLevels.map((peaksPerSecond) => [
          peaksPerSecond,
          { peaksPerSecond, chunks: new Map<number, Float32Array>() },
        ])
      ),
      completedChunks: 0,
    };

    setWaveformBuildProgress({
      generationId,
      peaksPerSecond: requestedLevels,
      completedChunks: 0,
      totalChunks,
      status: 'building',
    });

    builder.startBuild({
      type: 'startBuild',
      generationId,
      sampleRate: audioData.sampleRate,
      duration: audioData.duration,
      totalSamples: audioData.totalSamples,
      channelBuffers: transferBuffers,
      peaksPerSecond: requestedLevels,
      chunkDurationSec: WAVEFORM_CHUNK_DURATION_SEC,
    });
  }, [config.waveformPeakSampleRate, resetWaveformState]);

  const stopPlaybackForConfig = useCallback((targetConfig: VisualConfig, targetHasExternalAudio: boolean) => {
    setIsPlaying(false);
    externalAudioPlayRequestRef.current = null;

    if (targetHasExternalAudio) {
      audioEngine.pauseMedia();
      audioEngine.seekMedia(Math.max(0, targetConfig.audioOffsetMs / 1000));
    }

    const startTime = -targetConfig.startDelay;
    resetPlaybackPosition(startTime);
    lastUiSyncTimeRef.current = 0;
    setPlaybackTime(startTime);
  }, [resetPlaybackPosition]);

  const stopPlayback = useCallback(() => {
    stopPlaybackForConfig(config, hasExternalAudio);
  }, [config, hasExternalAudio, stopPlaybackForConfig]);

  const processMidiFile = useCallback(async (
    file: File,
    options: { syncBpmFromMidi?: boolean } = {}
  ) => {
    const { syncBpmFromMidi = true } = options;
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const midi = new Midi(arrayBuffer);
    const allNotes: NoteData[] = [];
    const trackInfos: TrackInfo[] = [];

    const midiOriginalBpm = midi.header.tempos?.length ? midi.header.tempos[0].bpm : 120;

    midi.tracks.forEach((track, index) => {
      if (track.notes.length === 0) return;

      trackInfos.push({
        id: index,
        name: track.name,
        instrument: track.instrument.name,
        noteCount: track.notes.length,
        channel: track.channel,
      });

      track.notes.forEach((note) => {
        allNotes.push({
          midi: note.midi,
          time: note.time,
          duration: note.duration,
          velocity: note.velocity,
          name: note.name,
          channel: track.channel,
          track: index,
        });
      });
    });

    const noteTimeline = buildNoteTimelineIndex(allNotes);
    noteTimelineRef.current = noteTimeline;
    midiFileRef.current = file;
    setCanExportProject(true);
    setFileName(file.name);

    setMidiData({
      notes: noteTimeline.notes,
      tracks: trackInfos,
      duration: midi.duration,
      originalBpm: midiOriginalBpm,
    });

    if (syncBpmFromMidi) {
      setConfig((prev) => ({ ...prev, bpm: midiOriginalBpm }));
    }

    playbackNoteCursorRef.current = findPlaybackNoteCursor(noteTimeline, 0);
    stopPlayback();
  }, [stopPlayback]);

  const loadExternalAudio = useCallback(async (file: File) => {
    const audioData = await audioEngine.loadAudioFile(file);
    const retainedChannelBuffers = audioData.channelBuffers.map((buffer) => buffer.slice(0));

    audioFileRef.current = file;
    loadedAudioSourceRef.current = {
      ...audioData,
      channelBuffers: retainedChannelBuffers,
    };
    waveformLineRef.current = buildWaveformLineData(
      retainedChannelBuffers,
      audioData.totalSamples,
      audioData.sampleRate
    );

    setLoadedAudio({
      fileName: audioData.fileName,
      objectUrl: audioData.objectUrl,
      duration: audioData.duration,
      sampleRate: audioData.sampleRate,
      channelCount: audioData.channelCount,
      totalSamples: audioData.totalSamples,
    });
    setAudioFileName(audioData.fileName);
    stopPlayback();
  }, [stopPlayback]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;

    try {
      await processMidiFile(file);
    } catch (err) {
      console.error('Failed to parse MIDI', err);
      alert('Invalid MIDI file');
    }
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;

    try {
      await loadExternalAudio(file);
    } catch (err) {
      console.error('Failed to load audio file', err);
      alert('Invalid audio file');
    }
  };

  const clearAudio = useCallback(() => {
    audioEngine.clearAudio();
    setLoadedAudio(null);
    setAudioFileName(null);
    audioFileRef.current = null;
    loadedAudioSourceRef.current = null;
    waveformLineRef.current = null;
    resetWaveformState();
  }, [resetWaveformState]);

  const restorePackageImageAssets = useCallback((
    packageConfig: VisualConfig,
    images: Awaited<ReturnType<typeof loadProjectPackage>>['images']
  ) => {
    const nextConfig: VisualConfig = {
      ...packageConfig,
      hiddenTracks: [...packageConfig.hiddenTracks],
    };
    const nextImageAssets = new Map<string, ImageAssetRecord>();
    const configRecord = nextConfig as Record<keyof VisualConfig, unknown>;

    for (const image of images) {
      const objectUrl = URL.createObjectURL(image.file);
      const cssValue = createImageCssValue(objectUrl);

      nextImageAssets.set(image.id, {
        id: image.id,
        file: image.file,
        objectUrl,
        cssValue,
      });

      for (const key of image.configKeys) {
        configRecord[key] = cssValue;
      }
    }

    revokeImageAssets(imageAssetsRef.current.values());
    imageAssetsRef.current = nextImageAssets;
    return nextConfig;
  }, [revokeImageAssets]);

  const handleProjectExport = useCallback(async () => {
    if (!midiFileRef.current) return;

    try {
      const blob = await exportProjectPackage({
        config,
        midiFile: midiFileRef.current,
        audioFile: audioFileRef.current,
        imageAssets: imageAssetsRef.current.values(),
      });
      downloadProjectBlob(blob, buildProjectPackageFileName(midiFileRef.current.name));
    } catch (err) {
      console.error('Failed to export project package', err);
      alert('配置包导出失败');
    }
  }, [config]);

  const handleProjectImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;

    try {
      const loadedPackage = await loadProjectPackage(file);
      await processMidiFile(loadedPackage.midiFile, { syncBpmFromMidi: false });

      if (loadedPackage.audioFile) {
        await loadExternalAudio(loadedPackage.audioFile);
      } else {
        clearAudio();
      }

      const restoredConfig = restorePackageImageAssets(
        loadedPackage.config,
        loadedPackage.images
      );
      setConfig(restoredConfig);
      stopPlaybackForConfig(restoredConfig, Boolean(loadedPackage.audioFile));
    } catch (err) {
      console.error('Failed to import project package', err);
      alert('配置包导入失败');
    }
  }, [
    clearAudio,
    loadExternalAudio,
    processMidiFile,
    restorePackageImageAssets,
    stopPlaybackForConfig,
  ]);

  useEffect(() => {
    const audioData = loadedAudioSourceRef.current;
    if (!audioData) return;

    if (!config.showWaveform || config.waveformMode !== 'peak') {
      cancelWaveformBuild();
      return;
    }

    startWaveformBuild(audioData);
  }, [
    config.showWaveform,
    config.waveformMode,
    config.waveformPeakSampleRate,
    cancelWaveformBuild,
    loadedAudio,
    startWaveformBuild,
  ]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith('.mid') || lowerName.endsWith('.midi')) {
      try {
        await processMidiFile(file);
      } catch (err) {
        console.error('Failed to parse MIDI', err);
        alert('Invalid MIDI file');
      }
      return;
    }

    if (/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name)) {
      try {
        await loadExternalAudio(file);
      } catch (err) {
        console.error('Failed to load audio file', err);
        alert('Invalid audio file');
      }
    }
  };

  const getExternalAudioTargetTime = useCallback(
    (playheadSeconds: number) => playheadSeconds + config.audioOffsetMs / 1000,
    [config.audioOffsetMs]
  );

  const canPlayExternalAudioAtPlayhead = useCallback(
    (playheadSeconds: number) =>
      playheadSeconds >= 0 && getExternalAudioTargetTime(playheadSeconds) >= 0,
    [getExternalAudioTargetTime]
  );

  const syncExternalAudioToPlayhead = useCallback(
    (playheadSeconds: number) => {
      if (!hasExternalAudio) return false;
      audioEngine.seekMedia(Math.max(0, getExternalAudioTargetTime(playheadSeconds)));
      return canPlayExternalAudioAtPlayhead(playheadSeconds);
    },
    [canPlayExternalAudioAtPlayhead, getExternalAudioTargetTime, hasExternalAudio]
  );

  const requestExternalAudioPlayback = useCallback(
    (playheadSeconds: number) => {
      if (!hasExternalAudio) return;

      if (!canPlayExternalAudioAtPlayhead(playheadSeconds)) {
        if (!audioEngine.mediaPaused) {
          audioEngine.pauseMedia();
        }
        return;
      }

      if (!audioEngine.mediaPaused || externalAudioPlayRequestRef.current) return;

      syncExternalAudioToPlayhead(playheadSeconds);
      const playRequest = audioEngine.playMedia()
        .catch((err) => {
          console.error('Failed to play external audio', err);
          audioEngine.pauseMedia();
          setIsPlaying(false);
        })
        .finally(() => {
          if (externalAudioPlayRequestRef.current === playRequest) {
            externalAudioPlayRequestRef.current = null;
          }
        });

      externalAudioPlayRequestRef.current = playRequest;
    },
    [
      canPlayExternalAudioAtPlayhead,
      hasExternalAudio,
      syncExternalAudioToPlayhead,
    ]
  );

  useEffect(() => {
    if (!hasExternalAudio) return;

    const canPlayAudio = syncExternalAudioToPlayhead(playbackCursorRef.current);
    if (isPlaying && canPlayAudio) {
      requestExternalAudioPlayback(playbackCursorRef.current);
    } else if (!canPlayAudio && !audioEngine.mediaPaused) {
      audioEngine.pauseMedia();
    }
  }, [
    config.audioOffsetMs,
    hasExternalAudio,
    isPlaying,
    requestExternalAudioPlayback,
    syncExternalAudioToPlayhead,
  ]);

  const togglePlay = useCallback(async () => {
    if (!midiData) return;
    try {
      await audioEngine.resume();
    } catch (err) {
      console.error('Failed to resume audio context', err);
      return;
    }

    if (isPlaying) {
      setIsPlaying(false);
      externalAudioPlayRequestRef.current = null;
      if (hasExternalAudio) {
        audioEngine.pauseMedia();
      }
      return;
    }

    if (playbackCursorRef.current >= midiData.duration) {
      const startTime = -config.startDelay;
      resetPlaybackPosition(startTime);
      setPlaybackTime(startTime);
    }

    if (hasExternalAudio) {
      const canPlayAudio = syncExternalAudioToPlayhead(playbackCursorRef.current);
      if (canPlayAudio) {
        try {
          await audioEngine.playMedia();
        } catch (err) {
          console.error('Failed to play external audio', err);
          audioEngine.pauseMedia();
          return;
        }
      } else {
        audioEngine.pauseMedia();
      }
    }

    lastFrameTimeRef.current = performance.now();
    lastUiSyncTimeRef.current = 0;
    setIsPlaying(true);
  }, [
    config.startDelay,
    hasExternalAudio,
    isPlaying,
    midiData,
    resetPlaybackPosition,
    syncExternalAudioToPlayhead,
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      }
      if (e.code === 'KeyR') {
        stopPlayback();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, stopPlayback]);

  const handleSeek = (time: number) => {
    resetPlaybackPosition(time);
    lastUiSyncTimeRef.current = performance.now();
    setPlaybackTime(time);
    const canPlayAudio = syncExternalAudioToPlayhead(time);
    if (isPlaying && canPlayAudio) {
      requestExternalAudioPlayback(time);
    } else if (!canPlayAudio && hasExternalAudio) {
      audioEngine.pauseMedia();
    }
  };

  const handleSongEnd = useCallback(() => {
    setIsPlaying(false);
    externalAudioPlayRequestRef.current = null;

    if (hasExternalAudio) {
      audioEngine.pauseMedia();
      audioEngine.seekMedia(0);
    }

    audioEngine.setVolume(0);
    const startTime = -config.startDelay;
    resetPlaybackPosition(startTime);
    lastUiSyncTimeRef.current = 0;
    setPlaybackTime(startTime);

    setTimeout(() => {
      audioEngine.setVolume(config.masterVolume);
    }, 150);
  }, [config.masterVolume, config.startDelay, hasExternalAudio, resetPlaybackPosition]);

  const drawRoundedRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ) => {
    if (width <= 0 || height <= 0) return;
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, r);
    ctx.fill();
  };

  const selectWaveformResolution = useCallback((
    cache: WaveformCache,
    axisSpan: number,
    visibleDuration: number
  ) => {
    if (config.waveformPeakSampleRate !== null) {
      return cache.peaksPerSecond[0] ?? Math.max(1, Math.round(config.waveformPeakSampleRate));
    }

    const desiredPeaksPerSecond = Math.max(
      cache.peaksPerSecond[cache.peaksPerSecond.length - 1] ?? 30,
      Math.min(cache.peaksPerSecond[0] ?? 30, axisSpan / Math.max(visibleDuration, 0.001))
    );

    for (const peaksPerSecond of cache.peaksPerSecond) {
      if (peaksPerSecond <= desiredPeaksPerSecond) {
        return peaksPerSecond;
      }
    }

    return cache.peaksPerSecond[cache.peaksPerSecond.length - 1] ?? 30;
  }, [config.waveformPeakSampleRate]);

  const drawWaveformEnvelope = useCallback((
    ctx: CanvasRenderingContext2D,
    currentAudioTime: number,
    layout: CanvasLayout
  ) => {
    const waveformCache = waveformCacheRef.current;
    if (!waveformCache || config.speed <= 0) return;

    const axisSpan =
      config.direction === ScrollDirection.Horizontal ? layout.activeW : layout.activeH;
    if (axisSpan <= 1) return;

    const visibleDuration = axisSpan / config.speed;
    const axisPixels = Math.max(1, Math.floor(axisSpan));

    const peaksPerSecond = selectWaveformResolution(
      waveformCache,
      axisSpan,
      visibleDuration
    );
    const level = waveformCache.levels.get(peaksPerSecond);
    if (!level || waveformCache.completedChunks === 0) return;

    const amplitudeScale =
      (config.direction === ScrollDirection.Horizontal ? layout.activeH : layout.activeW) * 0.45;

    const readPeakAtTime = (sampleTime: number) => {
      if (sampleTime < 0 || sampleTime >= waveformCache.duration) {
        return { upper: 0, lower: 0 };
      }

      const chunkIndex = Math.floor(sampleTime / waveformCache.chunkDurationSec);
      if (chunkIndex < 0 || chunkIndex >= waveformCache.totalChunks) {
        return { upper: 0, lower: 0 };
      }

      const chunk = level.chunks.get(chunkIndex);
      if (!chunk) return { upper: 0, lower: 0 };

      const chunkStartTime = chunkIndex * waveformCache.chunkDurationSec;
      const peakCount = chunk.length / 2;
      if (peakCount <= 0) return { upper: 0, lower: 0 };

      const peakIndex = Math.min(
        peakCount - 1,
        Math.max(0, Math.floor((sampleTime - chunkStartTime) * peaksPerSecond))
      );
      const readIndex = peakIndex * 2;

      return {
        upper: Math.max(0, chunk[readIndex] ?? 0),
        lower: Math.max(0, chunk[readIndex + 1] ?? 0),
      };
    };

    ctx.beginPath();
    for (let pixelIndex = 0; pixelIndex <= axisPixels; pixelIndex += 1) {
      const ratio = pixelIndex / axisPixels;
      const axisCoord = config.direction === ScrollDirection.Horizontal
        ? layout.activeX + ratio * layout.activeW
        : layout.activeY + ratio * layout.activeH;
      const sampleTime = getViewportTimeAtAxisPosition(
        layout,
        config.direction,
        currentAudioTime,
        config.speed,
        axisCoord
      );
      const { upper } = readPeakAtTime(sampleTime);

      if (config.direction === ScrollDirection.Horizontal) {
        const y = layout.activeCY - upper * amplitudeScale;
        if (pixelIndex === 0) ctx.moveTo(axisCoord, y);
        else ctx.lineTo(axisCoord, y);
      } else {
        const x = layout.activeCX - upper * amplitudeScale;
        if (pixelIndex === 0) ctx.moveTo(x, axisCoord);
        else ctx.lineTo(x, axisCoord);
      }
    }

    for (let pixelIndex = axisPixels; pixelIndex >= 0; pixelIndex -= 1) {
      const ratio = pixelIndex / axisPixels;
      const axisCoord = config.direction === ScrollDirection.Horizontal
        ? layout.activeX + ratio * layout.activeW
        : layout.activeY + ratio * layout.activeH;
      const sampleTime = getViewportTimeAtAxisPosition(
        layout,
        config.direction,
        currentAudioTime,
        config.speed,
        axisCoord
      );
      const { lower } = readPeakAtTime(sampleTime);

      if (config.direction === ScrollDirection.Horizontal) {
        ctx.lineTo(axisCoord, layout.activeCY + lower * amplitudeScale);
      } else {
        ctx.lineTo(layout.activeCX + lower * amplitudeScale, axisCoord);
      }
    }

    ctx.closePath();

    const gradientRect = {
      x: layout.activeX,
      y: layout.activeY,
      width: layout.activeW,
      height: layout.activeH,
    };
    const parsedFillGradient = parseLinearGradientCss(config.waveformFillColor);
    if (parsedFillGradient) {
      ctx.save();
      ctx.clip();
      ctx.fillStyle = createCanvasLinearGradient(ctx, gradientRect, parsedFillGradient);
      ctx.fillRect(layout.activeX, layout.activeY, layout.activeW, layout.activeH);
      ctx.restore();
    } else {
      ctx.fillStyle = config.waveformFillColor.startsWith('url(')
        ? FALLBACK_WAVEFORM_FILL
        : config.waveformFillColor;
      ctx.fill();
    }

    const parsedStrokeGradient = parseLinearGradientCss(config.waveformStrokeColor);
    if (parsedStrokeGradient) {
      ctx.strokeStyle = createCanvasLinearGradient(ctx, gradientRect, parsedStrokeGradient);
    } else {
      ctx.strokeStyle = config.waveformStrokeColor.startsWith('url(')
        ? FALLBACK_WAVEFORM_STROKE
        : config.waveformStrokeColor;
    }
    ctx.lineWidth = config.waveformLineWidth;
    ctx.stroke();
  }, [
    config.direction,
    config.speed,
    config.waveformFillColor,
    config.waveformLineWidth,
    config.waveformStrokeColor,
    selectWaveformResolution,
  ]);

  const drawWaveformLine = useCallback((
    ctx: CanvasRenderingContext2D,
    currentAudioTime: number,
    layout: CanvasLayout
  ) => {
    const waveformLine = waveformLineRef.current;
    if (!waveformLine || waveformLine.totalSamples === 0 || config.speed <= 0) return;

    const axisSpan =
      config.direction === ScrollDirection.Horizontal ? layout.activeW : layout.activeH;
    if (axisSpan <= 1) return;

    const amplitudeScale =
      (config.direction === ScrollDirection.Horizontal ? layout.activeH : layout.activeW) * 0.45;
    const axisPixels = Math.max(1, Math.floor(axisSpan));
    const duration = waveformLine.totalSamples / waveformLine.sampleRate;

    const gradientRect = {
      x: layout.activeX,
      y: layout.activeY,
      width: layout.activeW,
      height: layout.activeH,
    };
    const parsedStrokeGradient = parseLinearGradientCss(config.waveformStrokeColor);
    ctx.strokeStyle = parsedStrokeGradient
      ? createCanvasLinearGradient(ctx, gradientRect, parsedStrokeGradient)
      : (config.waveformStrokeColor.startsWith('url(')
        ? FALLBACK_WAVEFORM_STROKE
        : config.waveformStrokeColor);
    ctx.lineWidth = config.waveformLineWidth;
    ctx.beginPath();

    for (let pixelIndex = 0; pixelIndex <= axisPixels; pixelIndex += 1) {
      const ratio = pixelIndex / axisPixels;
      const axisCoord = config.direction === ScrollDirection.Horizontal
        ? layout.activeX + ratio * layout.activeW
        : layout.activeY + ratio * layout.activeH;
      const sampleTime = getViewportTimeAtAxisPosition(
        layout,
        config.direction,
        currentAudioTime,
        config.speed,
        axisCoord
      );
      const sampleIndex = sampleTime < 0 || sampleTime >= duration
        ? -1
        : Math.min(
          waveformLine.totalSamples - 1,
          Math.max(0, Math.round(sampleTime * waveformLine.sampleRate))
        );
      const amplitude = sampleIndex < 0 ? 0 : waveformLine.samples[sampleIndex] ?? 0;

      if (config.direction === ScrollDirection.Horizontal) {
        const y = layout.activeCY - amplitude * amplitudeScale;
        if (pixelIndex === 0) ctx.moveTo(axisCoord, y);
        else ctx.lineTo(axisCoord, y);
      } else {
        const x = layout.activeCX - amplitude * amplitudeScale;
        if (pixelIndex === 0) ctx.moveTo(x, axisCoord);
        else ctx.lineTo(x, axisCoord);
      }
    }

    ctx.stroke();
  }, [
    config.direction,
    config.speed,
    config.waveformLineWidth,
    config.waveformStrokeColor,
  ]);

  const drawWaveform = useCallback((
    ctx: CanvasRenderingContext2D,
    currentAudioTime: number,
    layout: CanvasLayout
  ) => {
    if (config.speed <= 0) return;

    if (config.waveformMode === 'pcm') {
      const waveformLine = waveformLineRef.current;
      if (!waveformLine) return;
      drawWaveformLine(ctx, currentAudioTime, layout);
      return;
    }

    if (config.waveformMode === 'peak') {
      drawWaveformEnvelope(ctx, currentAudioTime, layout);
      return;
    }
  }, [
    config.speed,
    config.waveformMode,
    drawWaveformEnvelope,
    drawWaveformLine,
  ]);

  useEffect(() => {
    const animate = () => {
      const now = performance.now();

      if (isPlaying) {
        const dt = (now - lastFrameTimeRef.current) / 1000;
        const tempoMultiplier = midiData?.originalBpm ? effectiveBpm / midiData.originalBpm : 1.0;

        playbackCursorRef.current += dt * tempoMultiplier;

        if (midiData) {
          if (playbackCursorRef.current > midiData.duration + 1.0) {
            handleSongEnd();
          } else if (now - lastUiSyncTimeRef.current >= UI_SYNC_INTERVAL_MS) {
            lastUiSyncTimeRef.current = now;
            setPlaybackTime(playbackCursorRef.current);
          }
        }
      }

      lastFrameTimeRef.current = now;

      const currentTime = playbackCursorRef.current;
      const waveformAnchorTime = hasExternalAudio
        ? currentTime + config.audioOffsetMs / 1000
        : 0;

      if (isPlaying && hasExternalAudio) {
        requestExternalAudioPlayback(currentTime);
      }

      const noteTimeline = noteTimelineRef.current;

      if (isPlaying && noteTimeline && currentTime >= 0) {
        const prevTime = lastNoteCheckTimeRef.current;
        const hiddenTracks = new Set(config.hiddenTracks);

        if (currentTime > prevTime) {
          const tempoMultiplier = midiData?.originalBpm ? effectiveBpm / midiData.originalBpm : 1.0;

          let noteCursor = playbackNoteCursorRef.current;
          const notes = noteTimeline.notes;

          while (noteCursor < notes.length && notes[noteCursor].time < currentTime) {
            const note = notes[noteCursor];
            if (note.time >= prevTime && !hiddenTracks.has(note.track)) {
              audioEngine.playNote(
                note.midi,
                note.duration,
                note.velocity,
                config.transpose,
                tempoMultiplier
              );
            }

            noteCursor += 1;
          }

          playbackNoteCursorRef.current = noteCursor;
          lastNoteCheckTimeRef.current = currentTime;
        }
      } else if (isPlaying && currentTime < 0) {
        lastNoteCheckTimeRef.current = currentTime;
      }

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      let layout = canvasLayoutRef.current;
      if (!canvas || !ctx) return;

      if (!layout) {
        updateCanvasLayout();
        layout = canvasLayoutRef.current;
        if (!layout) return;
      }

      ctx.clearRect(0, 0, layout.width, layout.height);

      ctx.save();
      ctx.clip(layout.clipPath);

      if (midiData) {
        ctx.strokeStyle = config.playHeadColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (config.direction === ScrollDirection.Horizontal) {
          ctx.moveTo(layout.activeCX, layout.activeY);
          ctx.lineTo(layout.activeCX, layout.activeY + layout.activeH);
        } else {
          ctx.moveTo(layout.activeX, layout.activeCY);
          ctx.lineTo(layout.activeX + layout.activeW, layout.activeCY);
        }
        ctx.stroke();
      }

      if (hasExternalAudio && config.showWaveform) {
        drawWaveform(ctx, waveformAnchorTime, layout);
      }

      if (midiData && noteTimeline) {
        ctx.fillStyle = config.noteColor;
        const hiddenTracks = new Set(config.hiddenTracks);
        const noteTailSeconds = noteTimeline.maxDuration * config.noteScale;
        const { startTime: visibleStartTime, endTime: visibleEndTime } = getViewportTimeWindow(
          layout,
          config.direction,
          currentTime,
          config.speed
        );
        const { startIndex, endIndex } = getNoteRangeForWindow(
          noteTimeline,
          Math.max(0, visibleStartTime - noteTailSeconds),
          visibleEndTime
        );

        for (let noteIndex = startIndex; noteIndex < endIndex; noteIndex += 1) {
          const note = noteTimeline.notes[noteIndex];
          if (hiddenTracks.has(note.track)) continue;

          const timeDelta = note.time - currentTime;
          const pitchOffset = (note.midi - 60) * config.stretch + config.offset;

          if (config.direction === ScrollDirection.Horizontal) {
            const x = layout.activeCX + timeDelta * config.speed;
            const length = note.duration * config.speed * config.noteScale;

            if (x + length < layout.activeX || x > layout.activeX + layout.activeW) continue;

            const y = layout.activeCY - pitchOffset;
            drawRoundedRect(
              ctx,
              x,
              y - config.noteThickness / 2,
              length,
              config.noteThickness,
              Math.min(4, config.noteThickness / 2)
            );
          } else {
            const y = layout.activeCY - timeDelta * config.speed;
            const length = note.duration * config.speed * config.noteScale;

            if (y - length > layout.activeY + layout.activeH || y < layout.activeY) continue;

            const x = layout.activeCX + pitchOffset;
            drawRoundedRect(
              ctx,
              x - config.noteThickness / 2,
              y - length,
              config.noteThickness,
              length,
              Math.min(4, config.noteThickness / 2)
            );
          }
        }
      }

      ctx.restore();

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [
    config,
    drawWaveform,
    effectiveBpm,
    handleSongEnd,
    hasExternalAudio,
    isPlaying,
    midiData,
    requestExternalAudioPlayback,
    updateCanvasLayout,
  ]);

  const windowStyle: React.CSSProperties = {
    top: `${config.boundTop}%`,
    bottom: `${config.boundBottom}%`,
    left: `${config.boundLeft}%`,
    right: `${config.boundRight}%`,
    background: config.windowBgColor,
    backdropFilter: `blur(${config.windowBlur}px)`,
    borderRadius: `${config.borderRadius}px`,
    border: `${config.borderWidth}px solid ${config.borderColor}`,
    boxShadow: `${config.shadowX}px ${config.shadowY}px ${config.shadowBlur}px ${config.shadowColor}`,
  };

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: config.overlayColor,
    borderRadius: `${Math.max(0, config.borderRadius - config.borderWidth)}px`,
    pointerEvents: 'none',
  };
  const visiblePlaybackTime = !isPlaying && playbackTime === 0
    ? -config.startDelay
    : playbackTime;

  return (
    <div
      className="w-full h-screen overflow-hidden relative select-none transition-colors duration-700"
      style={{ background: config.globalBgColor }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Sidebar
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        config={config}
        setConfig={setConfig}
        handleFileUpload={handleFileUpload}
        handleAudioUpload={handleAudioUpload}
        clearAudio={clearAudio}
        canExportProject={canExportProject}
        handleProjectExport={handleProjectExport}
        handleProjectImport={handleProjectImport}
        handleColorImageSelected={handleColorImageSelected}
        fileName={fileName}
        audioFileName={audioFileName}
        hasExternalAudio={hasExternalAudio}
        isPlaying={isPlaying}
        togglePlay={togglePlay}
        stopPlayback={stopPlayback}
        currentTime={visiblePlaybackTime}
        duration={midiData?.duration || 0}
        onSeek={handleSeek}
        tracks={midiData?.tracks || []}
        originalBpm={originalBpm}
        effectiveBpm={effectiveBpm}
        waveformBuildProgress={waveformBuildProgress}
      />

      <div className="absolute z-0 transition-all duration-300 ease-out" style={windowStyle}>
        <div style={overlayStyle}></div>
      </div>

      <div ref={containerRef} className="w-full h-full absolute inset-0 z-10 pointer-events-none">
        <canvas ref={canvasRef} className="block" />
      </div>

      {isDragging && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center border-4 border-dashed border-white/20 m-4 rounded-3xl pointer-events-none">
          <h2 className="text-4xl font-light tracking-widest text-white">DROP MIDI FILE</h2>
        </div>
      )}

      {!midiData && !isSidebarOpen && !isDragging && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="text-center space-y-4 animate-pulse opacity-50">
            <h1 className="text-4xl font-thin tracking-[0.3em] text-white">MIDI-Visitor</h1>
            <p className="text-zinc-400 text-sm tracking-widest uppercase">Minimalist MIDI Visualizer</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
