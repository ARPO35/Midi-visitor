import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Midi } from '@tonejs/midi';
import Sidebar from './components/Sidebar';
import { DEFAULT_CONFIG } from './constants';
import type {
  AudioLoadResult,
  LoadedAudioData,
  MidiData,
  NoteData,
  TrackInfo,
  VisualConfig,
  WaveformBuildEvent,
  WaveformBuildProgress,
  WaveformCache,
  WaveformLevelCache,
} from './types';
import { ScrollDirection } from './types';
import { audioEngine } from './services/audio';
import { WaveformBuilder } from './services/waveformBuilder';

const WAVEFORM_CHUNK_DURATION_SEC = 5;
const WAVEFORM_LEVELS = [480, 240, 120, 60, 30];
const UI_SYNC_INTERVAL_MS = 100;

const IDLE_WAVEFORM_PROGRESS: WaveformBuildProgress = {
  generationId: 0,
  peaksPerSecond: [],
  completedChunks: 0,
  totalChunks: 0,
  status: 'idle',
};

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
  const waveformCacheRef = useRef<WaveformCache | null>(null);
  const waveformBuilderRef = useRef<WaveformBuilder | null>(null);
  const waveformGenerationRef = useRef(0);

  const hasExternalAudio = loadedAudio !== null;
  const originalBpm = midiData?.originalBpm ?? null;
  const effectiveBpm = originalBpm
    ? (hasExternalAudio ? Math.max(1, originalBpm + config.midiBpmOffset) : config.bpm)
    : config.bpm;

  const resetWaveformState = useCallback(() => {
    const generationId = waveformGenerationRef.current;
    if (generationId > 0) {
      waveformBuilderRef.current?.cancelBuild(generationId);
    }

    waveformGenerationRef.current += 1;
    waveformCacheRef.current = null;
    setWaveformBuildProgress(IDLE_WAVEFORM_PROGRESS);
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
    if (!isPlaying && playbackTime === 0) {
      playbackCursorRef.current = -config.startDelay;
      lastNoteCheckTimeRef.current = -config.startDelay;
    }
  }, [config.startDelay, isPlaying, playbackTime]);

  useEffect(() => {
    return () => {
      audioEngine.clearAudio();
    };
  }, []);

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

    resetWaveformState();

    const generationId = waveformGenerationRef.current;
    const totalChunks = Math.max(
      1,
      Math.ceil(audioData.duration / WAVEFORM_CHUNK_DURATION_SEC)
    );

    waveformCacheRef.current = {
      generationId,
      peaksPerSecond: [...WAVEFORM_LEVELS],
      chunkDurationSec: WAVEFORM_CHUNK_DURATION_SEC,
      totalChunks,
      duration: audioData.duration,
      levels: new Map<number, WaveformLevelCache>(
        WAVEFORM_LEVELS.map((peaksPerSecond) => [
          peaksPerSecond,
          { peaksPerSecond, chunks: new Map<number, Float32Array>() },
        ])
      ),
      completedChunks: 0,
    };

    setWaveformBuildProgress({
      generationId,
      peaksPerSecond: [...WAVEFORM_LEVELS],
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
      channelBuffers: audioData.channelBuffers,
      peaksPerSecond: WAVEFORM_LEVELS,
      chunkDurationSec: WAVEFORM_CHUNK_DURATION_SEC,
    });
  }, [resetWaveformState]);

  const stopPlayback = useCallback(() => {
    setIsPlaying(false);

    if (hasExternalAudio) {
      audioEngine.pauseMedia();
      audioEngine.seekMedia(Math.max(0, config.audioOffsetMs / 1000));
    }

    playbackCursorRef.current = -config.startDelay;
    lastNoteCheckTimeRef.current = -config.startDelay;
    lastUiSyncTimeRef.current = 0;
    setPlaybackTime(0);
  }, [config.audioOffsetMs, config.startDelay, hasExternalAudio]);

  const processMidiFile = async (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = async (ev) => {
      const arrayBuffer = ev.target?.result as ArrayBuffer;
      if (!arrayBuffer) return;

      try {
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

        allNotes.sort((a, b) => a.time - b.time);

        setMidiData({
          notes: allNotes,
          tracks: trackInfos,
          duration: midi.duration,
          originalBpm: midiOriginalBpm,
        });

        setConfig((prev) => ({ ...prev, bpm: midiOriginalBpm }));
        stopPlayback();
      } catch (err) {
        console.error('Failed to parse MIDI', err);
        alert('Invalid MIDI file');
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const loadExternalAudio = useCallback(async (file: File) => {
    const audioData = await audioEngine.loadAudioFile(file);

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
    startWaveformBuild(audioData);
  }, [startWaveformBuild, stopPlayback]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processMidiFile(file);
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
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
    resetWaveformState();
  }, [resetWaveformState]);

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

    if (file.name.endsWith('.mid') || file.name.endsWith('.midi')) {
      await processMidiFile(file);
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

  const syncExternalAudioToPlayhead = useCallback(
    (playheadSeconds: number) => {
      if (!hasExternalAudio) return;
      const targetAudioTime = Math.max(0, playheadSeconds + config.audioOffsetMs / 1000);
      audioEngine.seekMedia(targetAudioTime);
    },
    [config.audioOffsetMs, hasExternalAudio]
  );

  const togglePlay = useCallback(async () => {
    if (!midiData) return;
    await audioEngine.resume();

    if (isPlaying) {
      setIsPlaying(false);
      if (hasExternalAudio) {
        audioEngine.pauseMedia();
      }
      return;
    }

    setIsPlaying(true);
    lastFrameTimeRef.current = performance.now();
    lastUiSyncTimeRef.current = 0;

    if (playbackCursorRef.current >= midiData.duration) {
      playbackCursorRef.current = -config.startDelay;
      lastNoteCheckTimeRef.current = -config.startDelay;
    }

    if (hasExternalAudio) {
      syncExternalAudioToPlayhead(Math.max(0, playbackCursorRef.current));
      await audioEngine.playMedia();
    }
  }, [config.startDelay, hasExternalAudio, isPlaying, midiData, syncExternalAudioToPlayhead]);

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
    playbackCursorRef.current = time;
    lastNoteCheckTimeRef.current = time;
    lastUiSyncTimeRef.current = performance.now();
    setPlaybackTime(time);
    syncExternalAudioToPlayhead(time);
  };

  const handleSongEnd = useCallback(() => {
    setIsPlaying(false);

    if (hasExternalAudio) {
      audioEngine.pauseMedia();
      audioEngine.seekMedia(0);
    }

    audioEngine.setVolume(0);
    playbackCursorRef.current = -config.startDelay;
    lastNoteCheckTimeRef.current = -config.startDelay;
    lastUiSyncTimeRef.current = 0;
    setPlaybackTime(0);

    setTimeout(() => {
      audioEngine.setVolume(config.masterVolume);
    }, 150);
  }, [config.masterVolume, config.startDelay, hasExternalAudio]);

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
    const desiredPeaksPerSecond = Math.max(
      cache.peaksPerSecond[cache.peaksPerSecond.length - 1] ?? 30,
      Math.min(config.waveformSampleRate, axisSpan / Math.max(visibleDuration, 0.001))
    );

    for (const peaksPerSecond of cache.peaksPerSecond) {
      if (peaksPerSecond <= desiredPeaksPerSecond) {
        return peaksPerSecond;
      }
    }

    return cache.peaksPerSecond[cache.peaksPerSecond.length - 1] ?? WAVEFORM_LEVELS.at(-1)!;
  }, [config.waveformSampleRate]);

  const drawWaveform = useCallback((
    ctx: CanvasRenderingContext2D,
    currentAudioTime: number,
    layout: CanvasLayout
  ) => {
    const waveformCache = waveformCacheRef.current;
    if (!waveformCache || waveformCache.completedChunks === 0 || config.speed <= 0) return;

    const axisSpan =
      config.direction === ScrollDirection.Horizontal ? layout.activeW : layout.activeH;
    const visibleDuration = axisSpan / config.speed;
    const halfSpanSeconds = visibleDuration / 2;
    const startTime = Math.max(0, currentAudioTime - halfSpanSeconds);
    const endTime = Math.min(waveformCache.duration, currentAudioTime + halfSpanSeconds);
    if (endTime <= startTime) return;

    const peaksPerSecond = selectWaveformResolution(
      waveformCache,
      axisSpan,
      visibleDuration
    );
    const level = waveformCache.levels.get(peaksPerSecond);
    if (!level) return;

    const amplitudeScale =
      (config.direction === ScrollDirection.Horizontal ? layout.activeH : layout.activeW) * 0.45;
    const startChunk = Math.max(
      0,
      Math.floor(startTime / waveformCache.chunkDurationSec)
    );
    const endChunk = Math.min(
      waveformCache.totalChunks - 1,
      Math.ceil(endTime / waveformCache.chunkDurationSec)
    );

    let hasUpperPath = false;

    ctx.fillStyle = config.waveformFillColor;
    ctx.strokeStyle = config.waveformStrokeColor;
    ctx.lineWidth = 1;

    ctx.beginPath();
    for (let chunkIndex = startChunk; chunkIndex <= endChunk; chunkIndex += 1) {
      const chunk = level.chunks.get(chunkIndex);
      if (!chunk) continue;

      const chunkStartTime = chunkIndex * waveformCache.chunkDurationSec;
      const chunkPeakCount = chunk.length / 2;
      const localStartIndex = Math.max(
        0,
        Math.floor((startTime - chunkStartTime) * peaksPerSecond)
      );
      const localEndIndex = Math.min(
        chunkPeakCount - 1,
        Math.ceil((endTime - chunkStartTime) * peaksPerSecond)
      );

      for (let peakIndex = localStartIndex; peakIndex <= localEndIndex; peakIndex += 1) {
        const peakTime = chunkStartTime + peakIndex / peaksPerSecond;
        const axisPos = (peakTime - currentAudioTime) * config.speed;
        const max = chunk[peakIndex * 2 + 1] ?? 0;

        if (config.direction === ScrollDirection.Horizontal) {
          const x = layout.activeCX + axisPos;
          const y = layout.activeCY - max * amplitudeScale;
          if (!hasUpperPath) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        } else {
          const x = layout.activeCX - max * amplitudeScale;
          const y = layout.activeCY + axisPos;
          if (!hasUpperPath) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        hasUpperPath = true;
      }
    }

    if (!hasUpperPath) return;

    for (let chunkIndex = endChunk; chunkIndex >= startChunk; chunkIndex -= 1) {
      const chunk = level.chunks.get(chunkIndex);
      if (!chunk) continue;

      const chunkStartTime = chunkIndex * waveformCache.chunkDurationSec;
      const chunkPeakCount = chunk.length / 2;
      const localStartIndex = Math.max(
        0,
        Math.floor((startTime - chunkStartTime) * peaksPerSecond)
      );
      const localEndIndex = Math.min(
        chunkPeakCount - 1,
        Math.ceil((endTime - chunkStartTime) * peaksPerSecond)
      );

      for (let peakIndex = localEndIndex; peakIndex >= localStartIndex; peakIndex -= 1) {
        const peakTime = chunkStartTime + peakIndex / peaksPerSecond;
        const axisPos = (peakTime - currentAudioTime) * config.speed;
        const min = chunk[peakIndex * 2] ?? 0;

        if (config.direction === ScrollDirection.Horizontal) {
          ctx.lineTo(
            layout.activeCX + axisPos,
            layout.activeCY - min * amplitudeScale
          );
        } else {
          ctx.lineTo(
            layout.activeCX - min * amplitudeScale,
            layout.activeCY + axisPos
          );
        }
      }
    }

    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    if (config.direction === ScrollDirection.Horizontal) {
      ctx.moveTo(layout.activeX, layout.activeCY);
      ctx.lineTo(layout.activeX + layout.activeW, layout.activeCY);
    } else {
      ctx.moveTo(layout.activeCX, layout.activeY);
      ctx.lineTo(layout.activeCX, layout.activeY + layout.activeH);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }, [
    config.direction,
    config.speed,
    config.waveformFillColor,
    config.waveformStrokeColor,
    selectWaveformResolution,
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
            setPlaybackTime(Math.max(0, playbackCursorRef.current));
          }
        }
      }

      lastFrameTimeRef.current = now;

      const currentTime = playbackCursorRef.current;
      const currentAudioTime = hasExternalAudio
        ? isPlaying
          ? audioEngine.mediaCurrentTime
          : Math.max(0, currentTime + config.audioOffsetMs / 1000)
        : 0;

      if (isPlaying && midiData && currentTime >= 0) {
        const prevTime = lastNoteCheckTimeRef.current;
        const hiddenTracks = new Set(config.hiddenTracks);

        if (currentTime > prevTime) {
          const tempoMultiplier = midiData.originalBpm ? effectiveBpm / midiData.originalBpm : 1.0;

          for (const note of midiData.notes) {
            if (hiddenTracks.has(note.track)) continue;

            if (note.time >= prevTime && note.time < currentTime) {
              audioEngine.playNote(
                note.midi,
                note.duration,
                note.velocity,
                config.transpose,
                tempoMultiplier
              );
            }
          }

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
        drawWaveform(ctx, currentAudioTime, layout);
      }

      if (midiData) {
        ctx.fillStyle = config.noteColor;
        const hiddenTracks = new Set(config.hiddenTracks);

        for (const note of midiData.notes) {
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
  }, [config, drawWaveform, effectiveBpm, handleSongEnd, hasExternalAudio, isPlaying, midiData, updateCanvasLayout]);

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
        fileName={fileName}
        audioFileName={audioFileName}
        hasExternalAudio={hasExternalAudio}
        isPlaying={isPlaying}
        togglePlay={togglePlay}
        stopPlayback={stopPlayback}
        currentTime={playbackTime}
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
