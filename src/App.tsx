import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Midi } from '@tonejs/midi';
import Sidebar from './components/Sidebar';
import { DEFAULT_CONFIG } from './constants';
import type { VisualConfig, MidiData, NoteData, TrackInfo } from './types'; // <--- 关键修复：添加 type 关键字
import { ScrollDirection } from './types'; // Enum 作为值导入，不要加 type
import { audioEngine } from './services/audio';

const App: React.FC = () => {
  // -- State --
  const [config, setConfig] = useState<VisualConfig>(DEFAULT_CONFIG);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [midiData, setMidiData] = useState<MidiData | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  
  // -- Refs --
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(0); // 初始化为 0
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const lastNoteCheckTimeRef = useRef<number>(0);
  
  // -- MIDI Processing --
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    
    reader.onload = async (ev) => {
      const arrayBuffer = ev.target?.result as ArrayBuffer;
      if (arrayBuffer) {
        try {
          const midi = new Midi(arrayBuffer);
          const allNotes: NoteData[] = [];
          const trackInfos: TrackInfo[] = [];
          
          midi.tracks.forEach((track, index) => {
             if (track.notes.length > 0) {
               trackInfos.push({
                 id: index,
                 name: track.name,
                 instrument: track.instrument.name,
                 noteCount: track.notes.length,
                 channel: track.channel
               });
               
               track.notes.forEach(note => {
                  allNotes.push({
                    midi: note.midi,
                    time: note.time,
                    duration: note.duration,
                    velocity: note.velocity,
                    name: note.name,
                    channel: track.channel,
                    track: index
                  });
               });
             }
          });

          allNotes.sort((a, b) => a.time - b.time);
          setMidiData({
            notes: allNotes,
            tracks: trackInfos,
            duration: midi.duration
          });
          
          // Uploading new file stops current playback
          setIsPlaying(false);
          pausedTimeRef.current = 0;
          setPlaybackTime(0);
          lastNoteCheckTimeRef.current = 0;
        } catch (err) {
          console.error("Failed to parse MIDI", err);
          alert("Invalid MIDI file");
        }
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // -- Playback Controls --
  // Define stopPlayback first since togglePlay depends on it logic-wise
  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
    pausedTimeRef.current = 0;
    setPlaybackTime(0);
    lastNoteCheckTimeRef.current = 0;
  }, []);

  const togglePlay = async () => {
    if (!midiData) return;
    await audioEngine.resume();
    if (isPlaying) {
      setIsPlaying(false);
      pausedTimeRef.current = Math.max(0, audioEngine.currentTime - startTimeRef.current);
    } else {
      setIsPlaying(true);
      startTimeRef.current = audioEngine.currentTime - pausedTimeRef.current;
      lastNoteCheckTimeRef.current = pausedTimeRef.current;
    }
  };

  const handleSeek = (time: number) => {
    pausedTimeRef.current = time;
    setPlaybackTime(time);
    lastNoteCheckTimeRef.current = time;
    if (isPlaying) {
      startTimeRef.current = audioEngine.currentTime - time;
    }
  };

  // -- Helper for Drawing --
  const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
    if (width <= 0 || height <= 0) return;
    const r = Math.max(0, Math.min(radius, width/2, height/2));
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, r);
    ctx.fill();
  };

  // -- Animation Loop --
  const animate = useCallback(() => {
    let currentTime = pausedTimeRef.current;
    
    if (isPlaying) {
      currentTime = audioEngine.currentTime - startTimeRef.current;
      if (midiData && currentTime > midiData.duration + 1) {
        stopPlayback();
      }
      setPlaybackTime(currentTime);
    }

    // Audio Sync
    if (isPlaying && midiData) {
      const checkStart = lastNoteCheckTimeRef.current;
      const checkEnd = currentTime;
      
      // Only loop through relevant part or optimize if array is huge (simple for now)
      for (const note of midiData.notes) {
        // Skip hidden tracks
        if (config.hiddenTracks.includes(note.track)) continue;

        if (note.time >= checkStart && note.time < checkEnd) {
           audioEngine.playNote(note.midi, note.duration, note.velocity);
        }
      }
      lastNoteCheckTimeRef.current = currentTime;
    }

    // Canvas Drawing
    if (!canvasRef.current || !containerRef.current) {
        requestRef.current = requestAnimationFrame(animate);
        return;
    }
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        requestRef.current = requestAnimationFrame(animate);
        return;
    }

    if (canvas.width !== containerRef.current.clientWidth || canvas.height !== containerRef.current.clientHeight) {
      canvas.width = containerRef.current.clientWidth;
      canvas.height = containerRef.current.clientHeight;
    }
    
    const w = canvas.width;
    const h = canvas.height;

    // Clear Canvas
    ctx.clearRect(0, 0, w, h);

    // Define Active Window Area
    const padTop = (h * config.boundTop) / 100;
    const padBottom = (h * config.boundBottom) / 100;
    const padLeft = (w * config.boundLeft) / 100;
    const padRight = (w * config.boundRight) / 100;

    const activeW = w - padLeft - padRight;
    const activeH = h - padTop - padBottom;
    const activeX = padLeft;
    const activeY = padTop;
    const activeCX = activeX + activeW / 2;
    const activeCY = activeY + activeH / 2;

    // Save context for clipping
    ctx.save();

    // Create Clipping Path for the Window
    ctx.beginPath();
    ctx.roundRect(activeX, activeY, activeW, activeH, config.borderRadius);
    ctx.clip();

    // Draw Playhead
    ctx.strokeStyle = config.playHeadColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (config.direction === ScrollDirection.Horizontal) {
      ctx.moveTo(activeCX, activeY);
      ctx.lineTo(activeCX, activeY + activeH);
    } else {
      ctx.moveTo(activeX, activeCY);
      ctx.lineTo(activeX + activeW, activeCY);
    }
    ctx.stroke();

    // Draw Notes
    if (midiData) {
      ctx.fillStyle = config.noteColor;

      for (const note of midiData.notes) {
        // Skip hidden tracks
        if (config.hiddenTracks.includes(note.track)) continue;

        const timeDelta = note.time - currentTime;
        const pitchOffset = (note.midi - 60) * config.stretch + config.offset;

        if (config.direction === ScrollDirection.Horizontal) {
          // Horizontal Mode
          const x = activeCX + timeDelta * config.speed;
          const length = note.duration * config.speed * config.noteScale;
          
          if (x + length < activeX || x > activeX + activeW) continue;
          
          const y = activeCY - pitchOffset; 
          
          drawRoundedRect(ctx, x, y - config.noteThickness/2, length, config.noteThickness, Math.min(4, config.noteThickness/2));
        } else {
          // Vertical Mode
          const y = activeCY - (timeDelta * config.speed);
          const length = note.duration * config.speed * config.noteScale;

          if (y - length > activeY + activeH || y < activeY) continue;

          const x = activeCX + pitchOffset;
          
          drawRoundedRect(ctx, x - config.noteThickness/2, y - length, config.noteThickness, length, Math.min(4, config.noteThickness/2));
        }
      }
    }

    ctx.restore(); // Remove clip

    requestRef.current = requestAnimationFrame(animate);
  }, [isPlaying, midiData, config, stopPlayback]);

  // -- Effects --
  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [animate]);

  // -- Visual Style Calculation for the Background Window --
  const windowStyle: React.CSSProperties = {
    top: `${config.boundTop}%`,
    bottom: `${config.boundBottom}%`,
    left: `${config.boundLeft}%`,
    right: `${config.boundRight}%`,
    backgroundColor: config.windowBgColor,
    backdropFilter: `blur(${config.windowBlur}px)`,
    borderRadius: `${config.borderRadius}px`,
    border: `${config.borderWidth}px solid ${config.borderColor}`,
    boxShadow: `${config.shadowX}px ${config.shadowY}px ${config.shadowBlur}px ${config.shadowColor}`,
  };
  
  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    backgroundColor: config.overlayColor,
    borderRadius: `${Math.max(0, config.borderRadius - config.borderWidth)}px`,
    pointerEvents: 'none',
  };

  return (
    // eslint-disable-next-line react-dom/no-unsafe-inline-styles
    <div 
      className="w-full h-screen overflow-hidden relative select-none transition-colors duration-700"
      style={{ backgroundColor: config.globalBgColor }}
    >
      
      <Sidebar
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        config={config}
        setConfig={setConfig}
        handleFileUpload={handleFileUpload}
        fileName={fileName}
        isPlaying={isPlaying}
        togglePlay={togglePlay}
        stopPlayback={stopPlayback}
        currentTime={playbackTime}
        duration={midiData?.duration || 0}
        onSeek={handleSeek}
        tracks={midiData?.tracks || []}
      />

      {/* Visual "Window" Layer */}
      <div 
        className="absolute z-0 transition-all duration-300 ease-out"
        // eslint-disable-next-line react-dom/no-unsafe-inline-styles
        style={windowStyle}
      >
        {/* Internal Overlay Tint */}
        {/* eslint-disable-next-line react-dom/no-unsafe-inline-styles */}
        <div style={overlayStyle}></div>
      </div>

      {/* Canvas Layer */}
      <div ref={containerRef} className="w-full h-full absolute inset-0 z-10 pointer-events-none">
        <canvas ref={canvasRef} className="block" />
      </div>

      {/* Empty State Hint */}
      {!midiData && !isSidebarOpen && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
           <div className="text-center space-y-4 animate-pulse opacity-50">
             <h1 className="text-4xl font-thin tracking-[0.3em] text-white">SINEWAVE</h1>
             <p className="text-zinc-400 text-sm tracking-widest uppercase">Import MIDI to Visualize</p>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;