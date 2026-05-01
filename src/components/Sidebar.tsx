import React, { useEffect, useId, useRef, useState } from 'react';
import type { VisualConfig, TrackInfo, WaveformBuildProgress } from '../types';
import { ScrollDirection } from '../types';
import { THEME } from '../constants';
import ColorPicker from './ColorPicker';
import {
  SPEED_MAX,
  SPEED_MIN,
  SPEED_SLIDER_MAX,
  speedToSliderValue,
  sliderValueToSpeed,
} from '../services/speedControl';
import {
  AudioLines,
  AudioWaveform,
  ChevronDown,
  Download,
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
  canExportProject: boolean;
  handleProjectExport: () => void;
  handleProjectImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleColorImageSelected: (field: keyof VisualConfig, file: File) => string;
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
  canExportProject,
  handleProjectExport,
  handleProjectImport,
  handleColorImageSelected,
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

  const imageHandlerFor = (field: keyof VisualConfig) => (file: File) =>
    handleColorImageSelected(field, file);

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
    !config.showWaveform
      ? '关闭'
      : config.waveformMode === 'pcm'
        ? 'PCM 直绘'
        : waveformBuildProgress.status === 'building'
      ? `构建中 ${waveformBuildProgress.completedChunks}/${waveformBuildProgress.totalChunks}`
      : waveformBuildProgress.status === 'complete'
        ? '就绪'
        : '空闲';
  const sourceSummary = fileName ? (hasExternalAudio ? '已导入 MIDI 和音频' : '已导入 MIDI') : '等待导入 MIDI';
  const playbackSummary = `${formatTime(currentTime)} / ${formatTime(duration)}`;
  const playbackSettingSummary = hasTracks ? `延迟 ${config.startDelay}s / 音量 ${config.masterVolume}%` : `延迟 ${config.startDelay}s`;
  const syncSummary = hasExternalAudio
    ? `音频 ${largeAudioOffsetSeconds.toFixed(2)}s / BPM ${effectiveBpm.toFixed(2)}`
    : `BPM ${config.bpm} / ${config.transpose > 0 ? '+' : ''}${config.transpose} st`;
  const trackSummary = `${tracks.length} 条轨道`;
  const directionLabel = config.direction === ScrollDirection.Horizontal ? '水平' : '垂直';
  const noteSummary = `${directionLabel} / ${config.speed}px 每秒`;
  const canvasSummary = `${config.boundTop}% ${config.boundRight}% ${config.boundBottom}% ${config.boundLeft}%`;
  const windowSummary = `圆角 ${config.borderRadius}px / 模糊 ${config.windowBlur}px`;

  return (
    <>
      <div
        className={`fixed top-0 left-0 p-8 z-50 group transition-all duration-300 ${isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}`}
      >
        <button
          onClick={() => setIsOpen(true)}
          aria-label="打开配置"
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
          <h2 className={`text-lg font-semibold tracking-tight ${THEME.textMain}`}>配置</h2>
          <button
            onClick={() => setIsOpen(false)}
            aria-label="关闭配置栏"
            className={`p-2 rounded-full hover:bg-white/10 transition-colors ${THEME.textDim} hover:text-white`}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar pb-20">
          <StaticPanel title="导入 / 清除" icon={<Upload size={16} />} summary={sourceSummary}>
            <div className="space-y-4">
                <FileDropButton
                  accept=".mid,.midi"
                  label={fileName || '拖入 MIDI 或点击选择'}
                  ariaLabel="导入 MIDI 文件"
                  onChange={handleFileUpload}
                />

                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <FileDropButton
                    accept=".mp3,.wav,.ogg,.m4a,.aac,.flac"
                    label={audioFileName || '导入外部音频'}
                    ariaLabel="导入音频文件"
                    onChange={handleAudioUpload}
                  />
                  <button
                    onClick={clearAudio}
                    disabled={!hasExternalAudio}
                    aria-label="清除外部音频"
                    className="px-3 rounded-xl border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleProjectExport}
                    disabled={!canExportProject}
                    className="flex items-center justify-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-xs uppercase tracking-wide text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Download size={14} />
                    <span>导出配置包</span>
                  </button>
                  <label className="relative flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-xs uppercase tracking-wide text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white">
                    <Upload size={14} />
                    <span>导入配置包</span>
                    <input
                      type="file"
                      accept=".zip,application/zip"
                      aria-label="导入配置包文件"
                      onChange={handleProjectImport}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  </label>
                </div>
            </div>
          </StaticPanel>

          {hasTracks && (
            <StaticPanel title="播放控制" icon={<Play size={16} />} summary={playbackSummary}>
              <div className={`rounded-xl p-4 ${THEME.controlBg} space-y-4`}>
                <div className="flex items-center justify-between gap-4">
                  <button
                    onClick={stopPlayback}
                    aria-label="回到开头"
                    title="回到开头 (R)"
                    className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <RefreshCcw size={20} />
                  </button>
                  <button
                    onClick={togglePlay}
                    aria-label={isPlaying ? '暂停' : '播放'}
                    title="播放/暂停 (Space)"
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
                    aria-label="播放进度"
                    min={0}
                    max={duration || 100}
                    value={Math.min(currentTime, duration || 100)}
                    onChange={(e) => onSeek(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-white"
                  />
                </div>
              </div>
            </StaticPanel>
          )}

          <Section title="播放参数" icon={<Timer size={16} />} summary={playbackSettingSummary} itemCount={hasTracks ? 2 : 1}>
            <div className="space-y-5">
              <ControlGroup title="启动延迟" icon={<Timer size={14} />}>
                <div className={`rounded-lg p-3 ${THEME.controlBg}`}>
                  <RangeControl
                    label="启动延迟秒数"
                    value={config.startDelay}
                    min={0}
                    max={10}
                    step={0.5}
                    onChange={(v) => updateConfig('startDelay', v)}
                  />
                </div>
              </ControlGroup>

              {hasTracks && (
                <ControlGroup title="输出音量" icon={<Volume2 size={14} />}>
                <div className={`rounded-lg p-3 ${THEME.controlBg}`}>
                  <div className="flex items-center gap-2">
                    <RangeControl
                      label="音量"
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
              </ControlGroup>
              )}
            </div>
          </Section>

          <Section title="同步与音乐" icon={<Gauge size={16} />} summary={syncSummary} itemCount={2}>
            {hasExternalAudio ? (
              <ControlGroup title="外部音频同步" icon={<AudioLines size={14} />}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2 text-zinc-400">
                      <AudioLines size={14} />
                      <span className="text-[10px] uppercase tracking-wider">音频偏移</span>
                    </div>
                    <div className="space-y-3">
                      <RangeControl
                        label="音频偏移秒数"
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
                      <span className="text-[10px] uppercase tracking-wider">MIDI BPM 偏移</span>
                    </div>
                    <div className="space-y-2">
                      <RangeControl
                        label="MIDI BPM 偏移"
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
                <div className="rounded-lg border border-zinc-700/50 bg-black/20 p-3 text-[11px] text-zinc-500 leading-5">
                  外部音频按原始速度和音高播放。使用音频偏移和 MIDI BPM 偏移来对齐波形与音符。
                </div>
              </ControlGroup>
            ) : (
              <ControlGroup title="MIDI 播放" icon={<Music size={14} />}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2 text-zinc-400">
                      <Gauge size={14} />
                      <span className="text-[10px] uppercase tracking-wider">BPM</span>
                    </div>
                    <BpmInput value={config.bpm} onChange={(v) => updateConfig('bpm', v)} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2 text-zinc-400">
                      <Music size={14} />
                      <span className="text-[10px] uppercase tracking-wider">音高</span>
                    </div>
                    <RangeControl
                      label="音高移调"
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
              </ControlGroup>
            )}
          </Section>

          {hasTracks && (
            <Section title="轨道过滤" icon={<ListMusic size={16} />} summary={trackSummary} itemCount={tracks.length}>
              <ControlGroup title="可见性">
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
                          <span className="font-medium truncate max-w-[180px]">{track.name || `轨道 ${track.id + 1}`}</span>
                          <span className="text-[10px] text-zinc-500 truncate">{track.instrument} - {track.noteCount} 个音符</span>
                        </div>
                        <div className={`p-1.5 rounded-md transition-colors ${!isHidden ? 'text-white bg-white/10' : 'text-zinc-600'}`}>
                          {!isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ControlGroup>
            </Section>
          )}

          <Section title="音符与滚动" icon={<Monitor size={16} />} summary={noteSummary} itemCount={8}>
            <div className="space-y-5">
              <ControlGroup title="滚动方向">
                <div className={`flex rounded-lg p-1 ${THEME.controlBg}`}>
                  <button
                    onClick={() => updateConfig('direction', ScrollDirection.Horizontal)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                      config.direction === ScrollDirection.Horizontal ? 'bg-zinc-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    水平
                  </button>
                  <button
                    onClick={() => updateConfig('direction', ScrollDirection.Vertical)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                      config.direction === ScrollDirection.Vertical ? 'bg-zinc-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    垂直
                  </button>
                </div>
              </ControlGroup>

              <ControlGroup title="元素颜色">
                <div className="space-y-1">
                  <ColorPicker label="音符颜色" value={config.noteColor} onChange={(v) => updateConfig('noteColor', v)} onImageSelected={imageHandlerFor('noteColor')} />
                  <ColorPicker label="播放头" value={config.playHeadColor} onChange={(v) => updateConfig('playHeadColor', v)} onImageSelected={imageHandlerFor('playHeadColor')} />
                </div>
              </ControlGroup>

              <ControlGroup title="运动与音高轴">
                <div className="space-y-4">
                  <SpeedControl value={config.speed} onChange={(v) => updateConfig('speed', v)} />
                  <RangeControl label="音符粗细" value={config.noteThickness} min={1} max={100} onChange={(v) => updateConfig('noteThickness', v)} />
                  <RangeControl label="音高间距" value={config.stretch} min={1} max={100} onChange={handleStretchChange} />
                  <RangeControl label="音符长度缩放" value={config.noteScale} min={0.1} max={10} step={0.1} onChange={(v) => updateConfig('noteScale', v)} />
                  <RangeControl label="音高轴偏移" value={config.offset} min={-5000} max={5000} onChange={(v) => updateConfig('offset', v)} />
                </div>
              </ControlGroup>
            </div>
          </Section>

          <Section title="画布与取景" icon={<Layout size={16} />} summary={canvasSummary} itemCount={5}>
            <div className="space-y-5">
              <ControlGroup title="背景">
                <ColorPicker label="应用背景" value={config.globalBgColor} onChange={(v) => updateConfig('globalBgColor', v)} onImageSelected={imageHandlerFor('globalBgColor')} />
              </ControlGroup>

              <ControlGroup title="安全边距">
                <div className="grid grid-cols-2 gap-4">
                  <RangeControl label="上边距" value={config.boundTop} min={0} max={45} onChange={(v) => updateConfig('boundTop', v)} />
                  <RangeControl label="下边距" value={config.boundBottom} min={0} max={45} onChange={(v) => updateConfig('boundBottom', v)} />
                  <RangeControl label="左边距" value={config.boundLeft} min={0} max={45} onChange={(v) => updateConfig('boundLeft', v)} />
                  <RangeControl label="右边距" value={config.boundRight} min={0} max={45} onChange={(v) => updateConfig('boundRight', v)} />
                </div>
              </ControlGroup>
            </div>
          </Section>

          <Section title="窗口外观" icon={<Monitor size={16} />} summary={windowSummary} itemCount={10}>
            <div className="space-y-5">
              <ControlGroup title="窗口表面">
                <div className="space-y-1">
                  <ColorPicker label="窗口底色" value={config.windowBgColor} onChange={(v) => updateConfig('windowBgColor', v)} onImageSelected={imageHandlerFor('windowBgColor')} />
                  <ColorPicker label="叠加光感" value={config.overlayColor} onChange={(v) => updateConfig('overlayColor', v)} onImageSelected={imageHandlerFor('overlayColor')} />
                </div>
                <RangeControl label="背景模糊" value={config.windowBlur} min={0} max={50} onChange={(v) => updateConfig('windowBlur', v)} />
              </ControlGroup>

              <ControlGroup title="边框">
                <div className="space-y-1">
                  <ColorPicker label="边框颜色" value={config.borderColor} onChange={(v) => updateConfig('borderColor', v)} onImageSelected={imageHandlerFor('borderColor')} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <RangeControl label="圆角" value={config.borderRadius} min={0} max={100} onChange={(v) => updateConfig('borderRadius', v)} />
                  <RangeControl label="边框宽度" value={config.borderWidth} min={0} max={10} onChange={(v) => updateConfig('borderWidth', v)} />
                </div>
              </ControlGroup>

              <ControlGroup title="阴影">
                <div className="space-y-1">
                  <ColorPicker label="阴影颜色" value={config.shadowColor} onChange={(v) => updateConfig('shadowColor', v)} onImageSelected={imageHandlerFor('shadowColor')} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <RangeControl label="阴影模糊" value={config.shadowBlur} min={0} max={100} onChange={(v) => updateConfig('shadowBlur', v)} />
                  <RangeControl label="阴影 X" value={config.shadowX} min={-50} max={50} onChange={(v) => updateConfig('shadowX', v)} />
                  <RangeControl label="阴影 Y" value={config.shadowY} min={-50} max={50} onChange={(v) => updateConfig('shadowY', v)} />
                </div>
              </ControlGroup>
            </div>
          </Section>

          {hasExternalAudio && (
            <Section title="波形叠加" icon={<AudioWaveform size={16} />} summary={waveformStatusLabel} itemCount={7}>
              <div className="space-y-5">
                <ControlGroup title="显示与缓存" icon={<AudioWaveform size={14} />}>
                  <button
                    onClick={() => updateConfig('showWaveform', !config.showWaveform)}
                    className={`w-full py-2 rounded-lg border transition-colors flex items-center justify-center gap-2 ${
                      config.showWaveform
                        ? 'border-white/20 bg-white/10 text-white'
                        : 'border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500'
                    }`}
                  >
                    <AudioWaveform size={16} />
                    <span className="text-xs uppercase tracking-wider">{config.showWaveform ? '波形开启' : '波形关闭'}</span>
                  </button>

                  <div className="flex items-center justify-between rounded-lg border border-zinc-700/50 bg-black/20 px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-500">
                    <span>波形缓存</span>
                    <span className="font-mono text-zinc-300">{waveformStatusLabel}</span>
                  </div>
                </ControlGroup>

                <ControlGroup title="模式与线条">
                  <div className="flex rounded-lg p-1 bg-zinc-900/70">
                    <button
                      onClick={() => updateConfig('waveformMode', 'peak')}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                        config.waveformMode === 'peak'
                          ? 'bg-zinc-600 text-white shadow-sm'
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      峰值
                    </button>
                    <button
                      onClick={() => updateConfig('waveformMode', 'pcm')}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                        config.waveformMode === 'pcm'
                          ? 'bg-zinc-600 text-white shadow-sm'
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      PCM
                    </button>
                  </div>

                  <div className="space-y-1">
                    <ColorPicker label="波形线条" value={config.waveformStrokeColor} onChange={(v) => updateConfig('waveformStrokeColor', v)} onImageSelected={imageHandlerFor('waveformStrokeColor')} />
                  </div>

                  <RangeControl
                    label="波形线宽"
                    value={config.waveformLineWidth}
                    min={0.5}
                    max={8}
                    step={0.1}
                    onChange={(v) => updateConfig('waveformLineWidth', v)}
                  />
                </ControlGroup>

                {config.waveformMode === 'peak' ? (
                  <ControlGroup title="峰值精度">
                    <div className="space-y-1">
                      <ColorPicker label="波形填充" value={config.waveformFillColor} onChange={(v) => updateConfig('waveformFillColor', v)} onImageSelected={imageHandlerFor('waveformFillColor')} />
                    </div>
                    <WaveformPeakSampleRateControl
                      value={config.waveformPeakSampleRate}
                      onChange={(v) => updateConfig('waveformPeakSampleRate', v)}
                    />
                  </ControlGroup>
                ) : (
                  <div className="rounded-lg border border-zinc-700/50 bg-zinc-950/50 px-3 py-2 text-[11px] leading-5 text-zinc-500">
                    PCM 模式直接绘制混合波形线，不使用峰值缓存。
                  </div>
                )}
              </div>
            </Section>
          )}
        </div>
      </div>
    </>
  );
};

const Section: React.FC<{
  title: string;
  icon: React.ReactNode;
  summary: string;
  itemCount: number;
  children: React.ReactNode;
}> = ({ title, icon, summary, itemCount, children }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const panelId = useId();

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/40">
      <button
        type="button"
        aria-expanded={isExpanded}
        aria-controls={panelId}
        onClick={() => setIsExpanded((next) => !next)}
        className="w-full px-3 py-3 text-left flex items-center gap-3 rounded-xl hover:bg-white/[0.03] transition-colors"
      >
        <span className="shrink-0 text-zinc-500">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium uppercase tracking-widest text-zinc-200">{title}</span>
          <span className="block mt-1 text-[10px] text-zinc-500 truncate">{summary}</span>
        </span>
        <span className="shrink-0 text-[10px] uppercase tracking-wider text-zinc-500">
          {itemCount} 项
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-zinc-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>
      {isExpanded && (
        <div id={panelId} className="px-3 pb-4 pt-1">
          {children}
        </div>
      )}
    </div>
  );
};

const StaticPanel: React.FC<{
  title: string;
  icon: React.ReactNode;
  summary: string;
  children: React.ReactNode;
}> = ({ title, icon, summary, children }) => (
  <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-3 space-y-3">
    <div className="flex items-center gap-3">
      <span className="shrink-0 text-zinc-500">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium uppercase tracking-widest text-zinc-200">{title}</span>
        <span className="block mt-1 text-[10px] text-zinc-500 truncate">{summary}</span>
      </span>
    </div>
    {children}
  </div>
);

const ControlGroup: React.FC<{
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, icon, children }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 border-b border-zinc-800/50 pb-2 text-zinc-500">
      {icon}
      <span className="text-[10px] font-medium uppercase tracking-widest">{title}</span>
    </div>
    <div className="space-y-3">{children}</div>
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
      <label className="text-[10px] text-zinc-500 uppercase tracking-wider">音频微调</label>
      <span className="text-[10px] text-zinc-400 font-mono">{value > 0 ? '+' : ''}{Math.round(value)} ms</span>
    </div>
    <input
      type="range"
      aria-label="音频毫秒微调"
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

const BpmInput: React.FC<{
  value: number;
  onChange: (value: number) => void;
}> = ({ value, onChange }) => {
  const [draft, setDraft] = useState(value.toString());
  const ignoreNextBlurRef = useRef(false);

  const commitDraft = () => {
    const trimmed = draft.trim();
    const parsed = Number(trimmed);

    if (trimmed === '' || !Number.isFinite(parsed)) {
      setDraft(value.toString());
      return;
    }

    const nextValue = Math.max(1, parsed);
    setDraft(nextValue.toString());
    onChange(nextValue);
  };

  const handleBlur = () => {
    if (ignoreNextBlurRef.current) {
      ignoreNextBlurRef.current = false;
      setDraft(value.toString());
      return;
    }

    commitDraft();
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label="BPM"
      value={draft}
      onFocus={(e) => {
        setDraft(value.toString());
        e.currentTarget.select();
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur();
        }
        if (e.key === 'Escape') {
          ignoreNextBlurRef.current = true;
          setDraft(value.toString());
          e.currentTarget.blur();
        }
      }}
      className="w-full bg-zinc-800 border border-zinc-600 rounded text-xs px-2 py-1.5 text-right text-white focus:outline-none focus:border-white transition-colors font-mono"
    />
  );
};

const WaveformPeakSampleRateControl: React.FC<{
  value: number | null;
  onChange: (value: number | null) => void;
}> = ({ value, onChange }) => {
  const [draft, setDraft] = useState(value === null ? '960' : value.toString());
  const lastManualValueRef = useRef(value ?? 960);

  const commitDraft = () => {
    const trimmed = draft.trim();
    const parsed = Number(trimmed);

    if (trimmed === '' || !Number.isFinite(parsed)) {
      setDraft(lastManualValueRef.current.toString());
      return;
    }

    const nextValue = Math.min(100000, Math.max(1, Math.round(parsed)));
    lastManualValueRef.current = nextValue;
    setDraft(nextValue.toString());
    onChange(nextValue);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-[10px] text-zinc-500 uppercase tracking-wider">FFT 采样率</label>
        <span className="text-[10px] font-mono text-zinc-400">{value === null ? '自动' : value}</span>
      </div>

      <div className="flex rounded-lg p-1 bg-zinc-900/70">
        <button
          onClick={() => onChange(null)}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
            value === null ? 'bg-zinc-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          自动
        </button>
        <button
          onClick={() => {
            const manualValue = value ?? lastManualValueRef.current;
            lastManualValueRef.current = manualValue;
            setDraft(manualValue.toString());
            onChange(manualValue);
          }}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
            value !== null ? 'bg-zinc-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          手动
        </button>
      </div>

      {value !== null && (
        <input
          type="text"
          inputMode="numeric"
          aria-label="波形峰值采样率"
          value={draft}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
            if (e.key === 'Escape') {
              setDraft(lastManualValueRef.current.toString());
              e.currentTarget.blur();
            }
          }}
          className="w-full bg-zinc-800 border border-zinc-600 rounded text-xs px-2 py-1.5 text-right text-white focus:outline-none focus:border-white transition-colors font-mono"
        />
      )}
    </div>
  );
};

const SpeedControl: React.FC<{
  value: number;
  onChange: (value: number) => void;
}> = ({ value, onChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const commitValue = () => {
    setIsEditing(false);
    const parsed = parseFloat(editValue);
    if (!Number.isNaN(parsed)) {
      onChange(Math.min(Math.max(Math.round(parsed), SPEED_MIN), SPEED_MAX));
    }
  };

  return (
    <div className="group">
      <div className="flex justify-between mb-1.5 items-center">
        <label className="text-[10px] text-zinc-500 uppercase tracking-wider">速度</label>
        {isEditing ? (
          <input
            ref={inputRef}
            type="number"
            aria-label="编辑速度"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitValue}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitValue();
              if (e.key === 'Escape') setIsEditing(false);
            }}
            className="w-24 text-right bg-zinc-800 text-[10px] text-white font-mono rounded border border-zinc-600 focus:outline-none focus:border-white px-1"
          />
        ) : (
          <span
            className="text-[10px] text-zinc-400 font-mono cursor-text hover:text-white"
            onDoubleClick={() => {
              setEditValue(value.toString());
              setIsEditing(true);
            }}
            title="双击编辑"
          >
            {value}
          </span>
        )}
      </div>
      <input
        type="range"
        aria-label="速度"
        min={0}
        max={SPEED_SLIDER_MAX}
        step={1}
        value={speedToSliderValue(value)}
        onChange={(e) => onChange(sliderValueToSpeed(parseFloat(e.target.value)))}
        className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-400 hover:accent-white transition-all"
      />
    </div>
  );
};

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
              aria-label={`编辑 ${label}`}
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
              title="双击编辑"
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
