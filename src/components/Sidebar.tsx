import React, { useEffect, useRef, useState } from 'react';
import type { VisualConfig, TrackInfo, WaveformBuildProgress } from '../types';
import { ScrollDirection } from '../types';
import { THEME } from '../constants';
import ColorPicker from './ColorPicker';
import {
  AudioLines,
  AudioWaveform,
  Eye,
  EyeOff,
  Gauge,
  Layout,
  ListMusic,
  Monitor,
  Music,
  Pause,
  Play,
  RefreshCcw,
  Settings2,
  Timer,
  Trash2,
  Upload,
  Volume2,
  X,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  config: VisualConfig;
  setConfig: React.Dispatch<React.SetStateAction<VisualConfig>>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleAudioUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  clearAudio: () => void;
  fileName: string | null;
  audioFileName: string | null;
  hasExternalAudio: boolean;
  isPlaying: boolean;
  togglePlay: () => void;
  stopPlayback: () => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  tracks: TrackInfo[];
  originalBpm: number | null;
  effectiveBpm: number;
  waveformBuildProgress: WaveformBuildProgress;
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  setIsOpen,
  config,
  setConfig,
  handleFileUpload,
  handleAudioUpload,
  clearAudio,
  fileName,
  audioFileName,
  hasExternalAudio,
  isPlaying,
  togglePlay,
  stopPlayback,
  currentTime,
  duration,
  onSeek,
  tracks,
  originalBpm,
  effectiveBpm,
  waveformBuildProgress,
}) => {
  const [fineAudioOffsetMs, setFineAudioOffsetMs] = useState(0);

  const updateConfig = <K extends keyof VisualConfig>(key: K, value: VisualConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleStretchChange = (newStretch: number) => {
    const oldStretch = config.stretch;
    if (oldStretch === 0) {
      updateConfig('stretch', newStretch);
      return;
    }

    const ratio = newStretch / oldStretch;
    setConfig((prev) => ({
      ...prev,
      stretch: newStretch,
      offset: prev.offset * ratio,
    }));
  };

  const toggleTrack = (trackId: number) => {
    const currentHidden = config.hiddenTracks || [];
    const newHidden = currentHidden.includes(trackId)
      ? currentHidden.filter((id) => id !== trackId)
      : [...currentHidden, trackId];

    updateConfig('hiddenTracks', newHidden);
  };

  const formatTime = (value: number) => {
    const sign = value < 0 ? '-' : '';
    const abs = Math.abs(value);
    const m = Math.floor(abs / 60);
    const s = Math.floor(abs % 60);
    return `${sign}${m}:${s.toString().padStart(2, '0')}`;
  };

  const hasTracks = tracks.length > 0;
  const largeAudioOffsetSeconds = config.audioOffsetMs / 1000;

  const commitFineAudioOffset = () => {
    if (fineAudioOffsetMs === 0) return;

    updateConfig('audioOffsetMs', config.audioOffsetMs + fineAudioOffsetMs);
    setFineAudioOffsetMs(0);
  };

  const waveformStatusLabel =
    waveformBuildProgress.status === 'building'
      ? `Building ${waveformBuildProgress.completedChunks}/${waveformBuildProgress.totalChunks}`
      : waveformBuildProgress.status === 'complete'
        ? 'Ready'
        : 'Idle';

  return (
    <>
      <div
        className={`fixed top-0 left-0 p-8 z-50 group transition-all duration-300 ${isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}`}
      >
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Open Configuration"
          className={`p-3 rounded-full ${THEME.panel} text-white shadow-xl transform scale-90 opacity-0 translate-x-[-10px] group-hover:translate-x-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-300 border border-zinc-800`}
        >
          <Settings2 size={20} className="group-hover:rotate-90 transition-transform duration-500" />
        </button>
      </div>

      <div
        className={`absolute top-0 left-0 h-full w-96 z-50 transform transition-transform duration-500 cubic-bezier(0.16, 1, 0.3, 1) ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } ${THEME.panel} shadow-2xl overflow-hidden flex flex-col`}
      >
        <div className="p-6 border-b border-zinc-800/50 flex justify-between items-center shrink-0">
          <h2 className={`text-lg font-semibold tracking-tight ${THEME.textMain}`}>Configuration</h2>
          <button
            onClick={() => setIsOpen(false)}
            aria-label="Close Sidebar"
            className={`p-2 rounded-full hover:bg-white/10 transition-colors ${THEME.textDim} hover:text-white`}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar pb-20">
          <Section title="Source" icon={<Upload size={16} />}>
            <div className="space-y-4">
              <FileDropButton
                accept=".mid,.midi"
                label={fileName || 'Drag & Drop MIDI or Click'}
                ariaLabel="Upload MIDI File"
                onChange={handleFileUpload}
              />

              <div className="grid grid-cols-[1fr_auto] gap-2">
                <FileDropButton
                  accept=".mp3,.wav,.ogg,.m4a,.aac,.flac"
                  label={audioFileName || 'Import External Audio'}
                  ariaLabel="Upload Audio File"
                  onChange={handleAudioUpload}
                />
                <button
                  onClick={clearAudio}
                  disabled={!hasExternalAudio}
                  aria-label="Clear External Audio"
                  className="px-3 rounded-xl border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className={`rounded-lg p-3 ${THEME.controlBg}`}>
                <div className="flex items-center gap-2 mb-2 text-zinc-400">
                  <Timer size={14} />
                  <span className="text-[10px] uppercase tracking-wider">Start Delay (s)</span>
                </div>
                <RangeControl
                  label="Start Delay Seconds"
                  value={config.startDelay}
                  min={0}
                  max={10}
                  step={0.5}
                  onChange={(v) => updateConfig('startDelay', v)}
                />
              </div>
            </div>
          </Section>

          {hasTracks && (
            <Section title="Playback" icon={<Play size={16} />}>
              <div className={`rounded-xl p-4 ${THEME.controlBg} space-y-4`}>
                <div className="flex items-center justify-between gap-4">
                  <button
                    onClick={stopPlayback}
                    aria-label="Rewind"
                    title="Rewind (R)"
                    className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <RefreshCcw size={20} />
                  </button>
                  <button
                    onClick={togglePlay}
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                    title="Play/Pause (Space)"
                    className={`flex-1 py-2 rounded-lg flex items-center justify-center font-medium transition-all ${
                      isPlaying ? 'bg-white/10 text-white' : 'bg-white text-black hover:bg-zinc-200'
                    }`}
                  >
                    {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                  </button>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-zinc-500 font-mono">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                  <input
                    type="range"
                    aria-label="Seek Time"
                    min={0}
                    max={duration || 100}
                    value={Math.min(currentTime, duration || 100)}
                    onChange={(e) => onSeek(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-white"
                  />
                </div>

                <div className="pt-2 border-t border-zinc-700/50">
                  <div className="flex items-center gap-3 mb-2">
                    <Volume2 size={14} className="text-zinc-500" />
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Volume</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <RangeControl
                      label="Volume"
                      value={config.masterVolume}
                      min={0}
                      max={100}
                      step={1}
                      onChange={(v) => updateConfig('masterVolume', v)}
                      hideLabel
                    />
                    <span className="text-[10px] text-zinc-400 font-mono w-8 text-right">{config.masterVolume.toFixed(0)}%</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-700/50 space-y-4">
                  {hasExternalAudio && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2 text-zinc-400">
                            <AudioLines size={14} />
                            <span className="text-[10px] uppercase tracking-wider">Audio Offset</span>
                          </div>
                          <div className="space-y-3">
                            <RangeControl
                              label="Audio Offset Seconds"
                              value={largeAudioOffsetSeconds}
                              sliderValue={Math.min(Math.max(largeAudioOffsetSeconds, -10), 10)}
                              min={-10}
                              max={10}
                              step={0.01}
                              onChange={(v) => updateConfig('audioOffsetMs', Math.round(v * 1000))}
                              formatValue={(v) => `${(Math.round(v * 100) / 100).toFixed(2)}s`}
                              allowManualOverflow
                            />
                            <FineAudioOffsetControl
                              value={fineAudioOffsetMs}
                              onChange={setFineAudioOffsetMs}
                              onCommit={commitFineAudioOffset}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-2 text-zinc-400">
                            <Gauge size={14} />
                            <span className="text-[10px] uppercase tracking-wider">MIDI BPM Offset</span>
                          </div>
                          <div className="space-y-2">
                            <RangeControl
                              label="MIDI BPM Offset"
                              value={config.midiBpmOffset}
                              min={-120}
                              max={120}
                              step={0.1}
                              onChange={(v) => updateConfig('midiBpmOffset', v)}
                            />
                            <div className="text-[10px] text-zinc-500 font-mono">
                              {`Orig ${Math.round(originalBpm ?? 0)} / Eff ${effectiveBpm.toFixed(2)}`}
                            </div>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => updateConfig('showWaveform', !config.showWaveform)}
                        className={`w-full py-2 rounded-lg border transition-colors flex items-center justify-center gap-2 ${
                          config.showWaveform
                            ? 'border-white/20 bg-white/10 text-white'
                            : 'border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500'
                        }`}
                      >
                        <AudioWaveform size={16} />
                        <span className="text-xs uppercase tracking-wider">{config.showWaveform ? 'Waveform On' : 'Waveform Off'}</span>
                      </button>

                      <div className="flex items-center justify-between rounded-lg border border-zinc-700/50 bg-black/20 px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-500">
                        <span>Waveform Cache</span>
                        <span className="font-mono text-zinc-300">{waveformStatusLabel}</span>
                      </div>
                    </>
                  )}

                  {!hasExternalAudio && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2 text-zinc-400">
                          <Gauge size={14} />
                          <span className="text-[10px] uppercase tracking-wider">BPM</span>
                        </div>
                        <input
                          type="number"
                          aria-label="BPM"
                          value={Math.round(config.bpm)}
                          onChange={(e) => updateConfig('bpm', parseFloat(e.target.value))}
                          className="w-full bg-zinc-800 border border-zinc-600 rounded text-xs px-2 py-1.5 text-right text-white focus:outline-none focus:border-white transition-colors font-mono"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-2 text-zinc-400">
                          <Music size={14} />
                          <span className="text-[10px] uppercase tracking-wider">Pitch</span>
                        </div>
                        <RangeControl
                          label="Pitch Transpose"
                          hideLabel
                          value={config.transpose}
                          min={-12}
                          max={12}
                          step={1}
                          onChange={(v) => updateConfig('transpose', v)}
                        />
                        <div className="text-right text-[10px] text-zinc-500 mt-1">
                          {config.transpose > 0 ? '+' : ''}
                          {config.transpose} st
                        </div>
                      </div>
                    </div>
                  )}

                  {hasExternalAudio && (
                    <div className="rounded-lg border border-zinc-700/50 bg-black/20 p-3 text-[11px] text-zinc-500 leading-5">
                      External audio plays at original speed and pitch. Use audio offset and MIDI BPM offset to align waveform and notes.
                    </div>
                  )}
                </div>
              </div>
            </Section>
          )}

          {hasTracks && (
            <Section title="Tracks" icon={<ListMusic size={16} />}>
              <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                {tracks.map((track) => {
                  const isHidden = config.hiddenTracks.includes(track.id);
                  return (
                    <div
                      key={track.id}
                      onClick={() => toggleTrack(track.id)}
                      className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-all border ${
                        !isHidden
                          ? 'bg-zinc-800/30 border-zinc-700/50 text-zinc-200 hover:bg-zinc-700/50'
                          : 'bg-transparent border-transparent text-zinc-600 hover:bg-zinc-800/30'
                      }`}
                    >
                      <div className="flex flex-col overflow-hidden">
                        <span className="font-medium truncate max-w-[180px]">{track.name || `Track ${track.id + 1}`}</span>
                        <span className="text-[10px] text-zinc-500 truncate">{track.instrument} - {track.noteCount} notes</span>
                      </div>
                      <div className={`p-1.5 rounded-md transition-colors ${!isHidden ? 'text-white bg-white/10' : 'text-zinc-600'}`}>
                        {!isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          <Section title="Window Colors" icon={<Monitor size={16} />}>
            <div className="space-y-1">
              <ColorPicker label="App Background" value={config.globalBgColor} onChange={(v) => updateConfig('globalBgColor', v)} />
              <ColorPicker label="Window Tint" value={config.windowBgColor} onChange={(v) => updateConfig('windowBgColor', v)} />
              <ColorPicker label="Overlay Glow" value={config.overlayColor} onChange={(v) => updateConfig('overlayColor', v)} />
              <ColorPicker label="Border Color" value={config.borderColor} onChange={(v) => updateConfig('borderColor', v)} />
              <ColorPicker label="Shadow Color" value={config.shadowColor} onChange={(v) => updateConfig('shadowColor', v)} />
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-800/50">
              <RangeControl label="Blur" value={config.windowBlur} min={0} max={50} onChange={(v) => updateConfig('windowBlur', v)} />
              <RangeControl label="Radius" value={config.borderRadius} min={0} max={100} onChange={(v) => updateConfig('borderRadius', v)} />
              <RangeControl label="Border" value={config.borderWidth} min={0} max={10} onChange={(v) => updateConfig('borderWidth', v)} />
              <RangeControl label="Shadow Blur" value={config.shadowBlur} min={0} max={100} onChange={(v) => updateConfig('shadowBlur', v)} />
              <RangeControl label="Shadow X" value={config.shadowX} min={-50} max={50} onChange={(v) => updateConfig('shadowX', v)} />
              <RangeControl label="Shadow Y" value={config.shadowY} min={-50} max={50} onChange={(v) => updateConfig('shadowY', v)} />
            </div>
          </Section>

          <Section title="Notes & Layout" icon={<Monitor size={16} />}>
            <div className="space-y-4">
              <div className={`flex rounded-lg p-1 ${THEME.controlBg} mb-4`}>
                <button
                  onClick={() => updateConfig('direction', ScrollDirection.Horizontal)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                    config.direction === ScrollDirection.Horizontal ? 'bg-zinc-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Horizontal
                </button>
                <button
                  onClick={() => updateConfig('direction', ScrollDirection.Vertical)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                    config.direction === ScrollDirection.Vertical ? 'bg-zinc-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Vertical
                </button>
              </div>

              <ColorPicker label="Note Color" value={config.noteColor} onChange={(v) => updateConfig('noteColor', v)} />
              <ColorPicker label="Playhead" value={config.playHeadColor} onChange={(v) => updateConfig('playHeadColor', v)} />

              <div className="pt-2 space-y-4 border-t border-zinc-800/50">
                <RangeControl label="Speed" value={config.speed} min={10} max={18000} step={10} onChange={(v) => updateConfig('speed', v)} />
                <RangeControl label="Thickness" value={config.noteThickness} min={1} max={100} onChange={(v) => updateConfig('noteThickness', v)} />
                <RangeControl label="Stretch (Pitch)" value={config.stretch} min={1} max={100} onChange={handleStretchChange} />
                <RangeControl label="Scale (Length)" value={config.noteScale} min={0.1} max={10} step={0.1} onChange={(v) => updateConfig('noteScale', v)} />
                <RangeControl label="Offset" value={config.offset} min={-5000} max={5000} onChange={(v) => updateConfig('offset', v)} />
              </div>
            </div>
          </Section>

          <Section title="Margins (%)" icon={<Layout size={16} />}>
            <div className="grid grid-cols-2 gap-4">
              <RangeControl label="Top" value={config.boundTop} min={0} max={45} onChange={(v) => updateConfig('boundTop', v)} />
              <RangeControl label="Bottom" value={config.boundBottom} min={0} max={45} onChange={(v) => updateConfig('boundBottom', v)} />
              <RangeControl label="Left" value={config.boundLeft} min={0} max={45} onChange={(v) => updateConfig('boundLeft', v)} />
              <RangeControl label="Right" value={config.boundRight} min={0} max={45} onChange={(v) => updateConfig('boundRight', v)} />
            </div>
          </Section>
        </div>
      </div>
    </>
  );
};

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 text-zinc-500 pb-2 border-b border-zinc-800/50">
      {icon}
      <span className="text-xs font-medium uppercase tracking-widest">{title}</span>
    </div>
    <div>{children}</div>
  </div>
);

const FileDropButton: React.FC<{
  accept: string;
  label: string;
  ariaLabel: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ accept, label, ariaLabel, onChange }) => (
  <div className="relative group">
    <input
      type="file"
      accept={accept}
      aria-label={ariaLabel}
      onChange={onChange}
      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
    />
    <div className={`w-full py-3 px-4 rounded-xl text-center border border-dashed border-zinc-700 group-hover:border-zinc-500 group-hover:bg-white/5 transition-all ${THEME.textDim} text-xs uppercase tracking-wide truncate`}>
      {label}
    </div>
  </div>
);

const FineAudioOffsetControl: React.FC<{
  value: number;
  onChange: (value: number) => void;
  onCommit: () => void;
}> = ({ value, onChange, onCommit }) => (
  <div className="group">
    <div className="flex justify-between mb-1.5 items-center">
      <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Audio Nudge</label>
      <span className="text-[10px] text-zinc-400 font-mono">{value > 0 ? '+' : ''}{Math.round(value)} ms</span>
    </div>
    <input
      type="range"
      aria-label="Audio Fine Offset ms"
      min={-100}
      max={100}
      step={1}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      onMouseUp={onCommit}
      onTouchEnd={onCommit}
      onKeyUp={(e) => {
        if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End' || e.key === 'PageUp' || e.key === 'PageDown') {
          onCommit();
        }
      }}
      onBlur={onCommit}
      className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-400 hover:accent-white transition-all"
    />
  </div>
);

const RangeControl: React.FC<{
  label: string;
  value: number;
  sliderValue?: number;
  min: number;
  max: number;
  step?: number;
  onChange: (val: number) => void;
  hideLabel?: boolean;
  formatValue?: (value: number) => string;
  allowManualOverflow?: boolean;
}> = ({
  label,
  value,
  sliderValue,
  min,
  max,
  step = 1,
  onChange,
  hideLabel = false,
  formatValue,
  allowManualOverflow = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    setEditValue(value.toString());
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    const num = parseFloat(editValue);
    if (!Number.isNaN(num)) {
      onChange(allowManualOverflow ? num : Math.min(Math.max(num, min), max));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleBlur();
    if (e.key === 'Escape') setIsEditing(false);
  };

  return (
    <div className="group">
      {!hideLabel && (
        <div className="flex justify-between mb-1.5 items-center">
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</label>
          {isEditing ? (
            <input
              ref={inputRef}
              type="number"
              aria-label={`Edit ${label}`}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="w-20 text-right bg-zinc-800 text-[10px] text-white font-mono rounded border border-zinc-600 focus:outline-none focus:border-white px-1"
            />
          ) : (
            <span
              className="text-[10px] text-zinc-400 font-mono cursor-text hover:text-white"
              onDoubleClick={handleDoubleClick}
              title="Double click to edit"
            >
              {formatValue ? formatValue(value) : Math.round(value * 100) / 100}
            </span>
          )}
        </div>
      )}
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={sliderValue ?? value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-400 hover:accent-white transition-all"
      />
    </div>
  );
};

export default Sidebar;
