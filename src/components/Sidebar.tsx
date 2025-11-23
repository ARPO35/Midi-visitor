import React from 'react';
// 修复 1: 拆分类型导入和值导入
import type { VisualConfig, TrackInfo } from '../types';
import { ScrollDirection } from '../types';
import { THEME } from '../constants';
import ColorPicker from './ColorPicker';
import { X, Settings2, Play, Pause, RefreshCcw, Upload, Layout, Palette, Monitor, ListMusic, Eye, EyeOff } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  config: VisualConfig;
  setConfig: React.Dispatch<React.SetStateAction<VisualConfig>>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileName: string | null;
  
  // Playback Props
  isPlaying: boolean;
  togglePlay: () => void;
  stopPlayback: () => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  tracks: TrackInfo[];
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  setIsOpen,
  config,
  setConfig,
  handleFileUpload,
  fileName,
  isPlaying,
  togglePlay,
  stopPlayback,
  currentTime,
  duration,
  onSeek,
  tracks
}) => {

  const updateConfig = <K extends keyof VisualConfig>(key: K, value: VisualConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleStretchChange = (newStretch: number) => {
    const oldStretch = config.stretch;
    if (oldStretch === 0) {
      updateConfig('stretch', newStretch);
      return;
    }
    const ratio = newStretch / oldStretch;
    setConfig(prev => ({
      ...prev,
      stretch: newStretch,
      offset: prev.offset * ratio
    }));
  };

  const toggleTrack = (trackId: number) => {
    const currentHidden = config.hiddenTracks || [];
    let newHidden;
    if (currentHidden.includes(trackId)) {
      newHidden = currentHidden.filter(id => id !== trackId);
    } else {
      newHidden = [...currentHidden, trackId];
    }
    updateConfig('hiddenTracks', newHidden);
  };

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const hasTracks = tracks && tracks.length > 0;

  return (
    <>
      {/* Trigger Area */}
      <div 
        className={`absolute top-4 left-4 z-50 transition-opacity duration-300 ${isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      >
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Open Configuration" // 修复 A11y
          className={`p-3 rounded-full ${THEME.panel} text-white shadow-xl hover:scale-110 transition-all group border border-zinc-800`}
        >
          <Settings2 size={20} className="group-hover:rotate-90 transition-transform duration-500" />
        </button>
      </div>

      {/* Sidebar Panel */}
      <div
        className={`absolute top-0 left-0 h-full w-96 z-50 transform transition-transform duration-500 cubic-bezier(0.16, 1, 0.3, 1) ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } ${THEME.panel} shadow-2xl overflow-hidden flex flex-col`}
      >
        
        {/* Header */}
        <div className="p-6 border-b border-zinc-800/50 flex justify-between items-center shrink-0">
          <h2 className={`text-lg font-semibold tracking-tight ${THEME.textMain}`}>Configuration</h2>
          <button 
            onClick={() => setIsOpen(false)}
            aria-label="Close Sidebar" // 修复 A11y
            className={`p-2 rounded-full hover:bg-white/10 transition-colors ${THEME.textDim} hover:text-white`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar pb-20">
          
          {/* MIDI File */}
          <Section title="Source" icon={<Upload size={16} />}>
            <div className="relative group">
              <input
                type="file"
                accept=".mid,.midi"
                aria-label="Upload MIDI file" // 修复 A11y
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className={`w-full py-3 px-4 rounded-xl text-center border border-dashed border-zinc-700 group-hover:border-zinc-500 group-hover:bg-white/5 transition-all ${THEME.textDim} text-xs uppercase tracking-wide`}>
                {fileName || "Upload MIDI File"}
              </div>
            </div>
          </Section>

          {/* Player Controls */}
          {hasTracks && (
            <Section title="Playback" icon={<Play size={16} />}>
              <div className={`rounded-xl p-4 ${THEME.controlBg} space-y-4`}>
                  <div className="flex items-center justify-between gap-4">
                    <button
                        onClick={stopPlayback}
                        aria-label="Stop Playback" // 修复 A11y
                        className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <RefreshCcw size={20} />
                    </button>
                    <button
                      onClick={togglePlay}
                      aria-label={isPlaying ? "Pause" : "Play"} // 修复 A11y
                      className={`flex-1 py-2 rounded-lg flex items-center justify-center font-medium transition-all ${
                        isPlaying ? 'bg-white/10 text-white' : 'bg-white text-black hover:bg-zinc-200'
                      }`}
                    >
                      {isPlaying ? <Pause size={20} fill="currentColor"/> : <Play size={20} fill="currentColor" />}
                    </button>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-zinc-500 font-mono">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                    <input 
                      type="range" 
                      aria-label="Seek time" // 修复 A11y
                      min={0} 
                      max={duration || 100} 
                      value={currentTime} 
                      onChange={(e) => onSeek(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-white"
                    />
                  </div>
              </div>
            </Section>
          )}

           {/* Tracks */}
           {hasTracks && (
             <Section title="Tracks" icon={<ListMusic size={16} />}>
               <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                 {tracks.map((track) => {
                   const isHidden = config.hiddenTracks?.includes(track.id);
                   return (
                     <button 
                      key={track.id}
                      onClick={() => toggleTrack(track.id)}
                      aria-label={`Toggle track ${track.name || track.id}`} // 修复 A11y: 改为 button 并加 label
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-all border text-left ${
                        !isHidden 
                          ? 'bg-zinc-800/30 border-zinc-700/50 text-zinc-200 hover:bg-zinc-700/50' 
                          : 'bg-transparent border-transparent text-zinc-600 hover:bg-zinc-800/30'
                      }`}
                     >
                       <div className="flex flex-col overflow-hidden">
                         <span className="font-medium truncate max-w-[180px]">{track.name || `Track ${track.id + 1}`}</span>
                         <span className="text-[10px] text-zinc-500 truncate">{track.instrument} • {track.noteCount} notes</span>
                       </div>
                       <div className={`p-1.5 rounded-md transition-colors ${!isHidden ? 'text-white bg-white/10' : 'text-zinc-600'}`}>
                          {!isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                       </div>
                     </button>
                   )
                 })}
               </div>
             </Section>
           )}

          {/* Appearance Controls */}
          <Section title="Window Colors" icon={<Monitor size={16} />}>
             <div className="space-y-1">
               <ColorPicker label="App Background" value={config.globalBgColor} onChange={v => updateConfig('globalBgColor', v)} />
               <ColorPicker label="Window Tint" value={config.windowBgColor} onChange={v => updateConfig('windowBgColor', v)} />
               <ColorPicker label="Overlay Glow" value={config.overlayColor} onChange={v => updateConfig('overlayColor', v)} />
               <ColorPicker label="Border Color" value={config.borderColor} onChange={v => updateConfig('borderColor', v)} />
               <ColorPicker label="Shadow Color" value={config.shadowColor} onChange={v => updateConfig('shadowColor', v)} />
             </div>
             <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-800/50">
                 <RangeControl label="Blur" value={config.windowBlur} min={0} max={50} onChange={v => updateConfig('windowBlur', v)} />
                 <RangeControl label="Radius" value={config.borderRadius} min={0} max={100} onChange={v => updateConfig('borderRadius', v)} />
                 <RangeControl label="Border" value={config.borderWidth} min={0} max={10} onChange={v => updateConfig('borderWidth', v)} />
                 <RangeControl label="Shadow Blur" value={config.shadowBlur} min={0} max={100} onChange={v => updateConfig('shadowBlur', v)} />
                 <RangeControl label="Shadow X" value={config.shadowX} min={-50} max={50} onChange={v => updateConfig('shadowX', v)} />
                 <RangeControl label="Shadow Y" value={config.shadowY} min={-50} max={50} onChange={v => updateConfig('shadowY', v)} />
             </div>
          </Section>

          <Section title="Notes & Layout" icon={<Palette size={16} />}>
            <div className="space-y-4">
               <div className={`flex rounded-lg p-1 ${THEME.controlBg} mb-4`}>
                  <button
                    onClick={() => updateConfig('direction', ScrollDirection.Horizontal)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                      config.direction === ScrollDirection.Horizontal
                        ? 'bg-zinc-600 text-white shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Horizontal
                  </button>
                  <button
                    onClick={() => updateConfig('direction', ScrollDirection.Vertical)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                      config.direction === ScrollDirection.Vertical
                        ? 'bg-zinc-600 text-white shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Vertical
                  </button>
                </div>
            
               <ColorPicker label="Note Color" value={config.noteColor} onChange={v => updateConfig('noteColor', v)} />
               <ColorPicker label="Playhead" value={config.playHeadColor} onChange={v => updateConfig('playHeadColor', v)} />
               
               <div className="pt-2 space-y-4 border-t border-zinc-800/50">
                 <RangeControl label="Speed" value={config.speed} min={10} max={18000} step={10} onChange={v => updateConfig('speed', v)} />
                 <RangeControl label="Thickness" value={config.noteThickness} min={1} max={100} onChange={v => updateConfig('noteThickness', v)} />
                 <RangeControl label="Stretch (Pitch)" value={config.stretch} min={1} max={100} onChange={handleStretchChange} />
                 <RangeControl label="Scale (Length)" value={config.noteScale} min={0.1} max={10} step={0.1} onChange={v => updateConfig('noteScale', v)} />
                 <RangeControl label="Offset" value={config.offset} min={-5000} max={5000} onChange={v => updateConfig('offset', v)} />
               </div>
            </div>
          </Section>

          <Section title="Margins (%)" icon={<Layout size={16} />}>
            <div className="grid grid-cols-2 gap-4">
              <RangeControl label="Top" value={config.boundTop} min={0} max={45} onChange={v => updateConfig('boundTop', v)} />
              <RangeControl label="Bottom" value={config.boundBottom} min={0} max={45} onChange={v => updateConfig('boundBottom', v)} />
              <RangeControl label="Left" value={config.boundLeft} min={0} max={45} onChange={v => updateConfig('boundLeft', v)} />
              <RangeControl label="Right" value={config.boundRight} min={0} max={45} onChange={v => updateConfig('boundRight', v)} />
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

const RangeControl: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (val: number) => void;
}> = ({ label, value, min, max, step = 1, onChange }) => (
  <div>
    <div className="flex justify-between mb-1.5">
      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</span>
      <span className="text-[10px] text-zinc-400 font-mono">{Math.round(value * 100) / 100}</span>
    </div>
    <input
      type="range"
      aria-label={label} // 修复 A11y
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-400 hover:accent-white transition-all"
    />
  </div>
);

export default Sidebar;