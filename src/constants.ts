
import { ScrollDirection } from './types';
import type { VisualConfig } from './types'; 

export const DEFAULT_CONFIG: VisualConfig = {
  speed: 300,
  noteThickness: 12,
  noteScale: 1.0,
  offset: 0,
  direction: ScrollDirection.Horizontal,
  stretch: 20, 
  boundTop: 15,
  boundBottom: 15,
  boundLeft: 15,
  boundRight: 15,

  globalBgColor: '#000000',
  
  windowBgColor: 'rgba(20, 20, 20, 0.6)',
  windowBlur: 20,
  borderRadius: 30,
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.15)',
  
  shadowColor: 'rgba(0, 0, 0, 0.6)',
  shadowBlur: 40,
  shadowX: 0,
  shadowY: 20,
  
  overlayColor: 'rgba(255, 255, 255, 0.02)',

  noteColor: 'rgba(255, 255, 255, 0.9)',
  playHeadColor: 'rgba(255, 255, 255, 0.5)',

  hiddenTracks: [],
};

export const THEME = {
  bg: 'bg-black',
  panel: 'bg-zinc-950/95 backdrop-blur-2xl border-r border-zinc-800/50',
  textMain: 'text-zinc-100',
  textDim: 'text-zinc-400',
  accent: 'bg-white text-black',
  accentHover: 'hover:bg-zinc-200',
  controlBg: 'bg-zinc-800/50',
  sectionBorder: 'border-zinc-800/50',
};
