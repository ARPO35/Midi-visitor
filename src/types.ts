
export enum ScrollDirection {
  Horizontal = 'horizontal', // Right to Left
  Vertical = 'vertical'      // Top to Bottom
}

export interface VisualConfig {
  // Core
  speed: number;             // Pixels per second
  noteThickness: number;     // Height (H) or Width (V) of the note
  noteScale: number;         // Length multiplier
  offset: number;            // Perpendicular offset to center notes
  direction: ScrollDirection;
  stretch: number;           // Gap between notes in pitch axis
  
  // Viewport Boundaries (0-100 percentage of screen)
  boundTop: number;
  boundBottom: number;
  boundLeft: number;
  boundRight: number;

  // Visual Styling
  globalBgColor: string;

  // Window Style
  windowBgColor: string;
  windowBlur: number;
  borderRadius: number;
  borderWidth: number;
  borderColor: string;
  shadowColor: string;
  shadowBlur: number;
  shadowX: number;
  shadowY: number;
  overlayColor: string; // "Floating" effect

  // Element Style
  noteColor: string;
  playHeadColor: string;

  // Filter
  hiddenTracks: number[]; // Track IDs to hide
}

export interface NoteData {
  midi: number;      // Pitch (0-127)
  time: number;      // Start time in seconds
  duration: number;  // Duration in seconds
  velocity: number;  // 0-1
  name: string;      // e.g. "C4"
  channel: number;   // 0-15
  track: number;     // Track Index
}

export interface TrackInfo {
  id: number;
  name: string;
  instrument: string;
  noteCount: number;
  channel: number;
}

export interface MidiData {
  notes: NoteData[];
  tracks: TrackInfo[];
  duration: number;
}
