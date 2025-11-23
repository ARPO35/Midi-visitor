import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Midi } from '@tonejs/midi';
import Sidebar from './components/Sidebar';
import { DEFAULT_CONFIG } from './constants';
import type { VisualConfig, MidiData, NoteData, TrackInfo } from './types'; 
import { ScrollDirection } from './types'; 
import { audioEngine } from './services/audio';

const App: React.FC = () => {
  // -- State --
  const [config, setConfig] = useState<VisualConfig>(DEFAULT_CONFIG);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [midiData, setMidiData] = useState<MidiData | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // -- Refs --
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(0);
  // Playback Cursor: Tracks the current song time including Delay
  const playbackCursorRef = useRef<number>(-config.startDelay);
  const lastFrameTimeRef = useRef<number>(0);
  
  // Tracks which notes we have already played to avoid duplicates in the loop
  const lastNoteCheckTimeRef = useRef<number>(-config.startDelay);

  // -- Effects --
  useEffect(() => {
    audioEngine.setVolume(config.masterVolume);
  }, [config.masterVolume]);

  // Sync Start Delay changes to the cursor if we are near the beginning/reset
  useEffect(() => {
    if (!isPlaying && playbackTime === 0) {
      playbackCursorRef.current = -config.startDelay;
      lastNoteCheckTimeRef.current = -config.startDelay;
    }
  }, [config.startDelay, isPlaying, playbackTime]);

  // -- MIDI Processing Logic --
  const processMidiFile = async (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    
    reader.onload = async (ev) => {
      const arrayBuffer = ev.target?.result as ArrayBuffer;
      if (arrayBuffer) {
        try {
          const midi = new Midi(arrayBuffer);
          const allNotes: NoteData[] = [];
          const trackInfos: TrackInfo[] = [];

          // --- 修复开始: 获取原始 BPM ---
          // 如果 MIDI 文件包含 tempo 信息，取第一个作为初始 BPM，否则默认 120
          let originalBpm = 120;
          if (midi.header.tempos && midi.header.tempos.length > 0) {
            originalBpm = midi.header.tempos[0].bpm;
          }
          // --- 修复结束 ---
          
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
          
          // --- 修复开始: 将 originalBpm 加入状态对象 ---
          setMidiData({
            notes: allNotes,
            tracks: trackInfos,
            duration: midi.duration,
            originalBpm: originalBpm // 这里补上了缺失的属性
          });

          // 更新当前配置的 BPM
          setConfig(prev => ({ ...prev, bpm: originalBpm }));
          // --- 修复结束 ---

          stopPlayback();
        } catch (err) {
          console.error("Failed to parse MIDI", err);
          alert("Invalid MIDI file");
        }
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processMidiFile(file);
  };

  // -- Drag & Drop Handlers --
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
    if (file && (file.name.endsWith('.mid') || file.name.endsWith('.midi'))) {
      await processMidiFile(file);
    }
  };

  // -- Playback Controls --
  const togglePlay = useCallback(async () => {
    if (!midiData) return;
    await audioEngine.resume();
    
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      lastFrameTimeRef.current = performance.now();
      
      // If we finished the song, reset to start
      if (playbackCursorRef.current >= midiData.duration) {
         playbackCursorRef.current = -config.startDelay;
         lastNoteCheckTimeRef.current = -config.startDelay;
      }
    }
  }, [isPlaying, midiData, config.startDelay]);

  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
    playbackCursorRef.current = -config.startDelay;
    lastNoteCheckTimeRef.current = -config.startDelay;
    setPlaybackTime(0);
  }, [config.startDelay]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
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
    // time is target MIDI time
    playbackCursorRef.current = time;
    lastNoteCheckTimeRef.current = time;
    setPlaybackTime(time);
  };

  const handleSongEnd = useCallback(() => {
     setIsPlaying(false);
     audioEngine.setVolume(0); // Soft mute
     playbackCursorRef.current = -config.startDelay;
     lastNoteCheckTimeRef.current = -config.startDelay;
     setPlaybackTime(0);

     setTimeout(() => {
       audioEngine.setVolume(config.masterVolume);
     }, 150);
  }, [config.masterVolume, config.startDelay]);

  // -- Animation Loop --
  const animate = useCallback(() => {
    const now = performance.now();
    
    if (isPlaying) {
      // Calculate delta time in seconds
      const dt = (now - lastFrameTimeRef.current) / 1000;
      
      // Calculate BPM Multiplier
      // If no MIDI loaded, defaults to 1.0. If loaded, uses Ratio (Current / Original)
      const tempoMultiplier = (midiData && midiData.originalBpm) 
        ? config.bpm / midiData.originalBpm 
        : 1.0;
      
      // Advance cursor by delta * multiplier
      playbackCursorRef.current += dt * tempoMultiplier;

      // Update UI Time (clamped to 0 for start delay)
      if (midiData) {
        if (playbackCursorRef.current > midiData.duration + 1.0) {
          handleSongEnd();
        } else {
          setPlaybackTime(Math.max(0, playbackCursorRef.current));
        }
      }
    }
    
    lastFrameTimeRef.current = now;

    // -- Audio Triggering --
    const currentTime = playbackCursorRef.current;
    
    if (isPlaying && midiData && currentTime >= 0) {
       const prevTime = lastNoteCheckTimeRef.current;
       
       // Only process if we moved forward
       if (currentTime > prevTime) {
          
          const tempoMultiplier = (midiData.originalBpm) 
              ? config.bpm / midiData.originalBpm 
              : 1.0;

          for (const note of midiData.notes) {
            if (config.hiddenTracks.includes(note.track)) continue;

            // Trigger if note start time falls within this frame's window
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
       // Reset check time if in pre-roll
       lastNoteCheckTimeRef.current = currentTime;
    }

    // Canvas Drawing
    if (!canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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

    // Draw Playhead / Center Line
    if (midiData) {
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
  }

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
  }, [isPlaying, config, midiData, handleSongEnd]);

  // -- Effects --
  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [animate]);

  const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
    if (width <= 0 || height <= 0) return;
    const r = Math.max(0, Math.min(radius, width/2, height/2));
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, r);
    ctx.fill();
  };

  // -- Visual Style Calculation for the Background Window --
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
        style={windowStyle}
      >
        {/* Internal Overlay Tint */}
        <div style={overlayStyle}></div>
      </div>

      {/* Canvas Layer */}
      <div ref={containerRef} className="w-full h-full absolute inset-0 z-10 pointer-events-none">
        <canvas ref={canvasRef} className="block" />
      </div>

      {isDragging && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center border-4 border-dashed border-white/20 m-4 rounded-3xl pointer-events-none">
            <h2 className="text-4xl font-light tracking-widest text-white">DROP MIDI FILE</h2>
        </div>
      )}
      {!midiData && !isSidebarOpen && !isDragging &&(
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