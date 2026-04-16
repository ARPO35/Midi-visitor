
export enum ScrollDirection {
  Horizontal = 'horizontal', // Right to Left
  Vertical = 'vertical'      // Top to Bottom
}

export type WaveformMode = 'peak' | 'pcm';

export interface VisualConfig {
  // Core
  speed: number;             // Pixels per second
  noteThickness: number;     // Height (H) or Width (V) of the note
  noteScale: number;         // Length multiplier
  offset: number;            // Perpendicular offset to center notes
  direction: ScrollDirection;
  stretch: number;           // Gap between notes in pitch axis
  startDelay: number;        // Delay in seconds before playback starts (pre-roll)
  masterVolume: number;      // 0-100 (Display), maps to 0.0-0.2 (Gain)
  
  // Audio Modifiers
  transpose: number;         // Semitones (+/-)
  bpm: number;               // Beats Per Minute (Absolute)
  audioOffsetMs: number;     // External audio offset relative to MIDI
  midiBpmOffset: number;     // Delta applied to original MIDI BPM
  showWaveform: boolean;     // Show waveform overlay for sync calibration
  waveformMode: WaveformMode;
  waveformStrokeColor: string;
  waveformLineWidth: number;
  waveformFillColor: string;
  waveformPeakSampleRate: number | null;

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
  originalBpm: number;
}

export interface LoadedAudioData {
  fileName: string;
  objectUrl: string;
  duration: number;
  sampleRate: number;
  channelCount: number;
  totalSamples: number;
}

export interface AudioLoadResult extends LoadedAudioData {
  channelBuffers: ArrayBuffer[];
}

export interface WaveformLineData {
  samples: Float32Array;
  sampleRate: number;
  totalSamples: number;
}

export interface WaveformChunkPayload {
  peaksPerSecond: number;
  chunkIndex: number;
  data: ArrayBuffer;
}

export interface WaveformLevelCache {
  peaksPerSecond: number;
  chunks: Map<number, Float32Array>;
}

export interface WaveformCache {
  generationId: number;
  peaksPerSecond: number[];
  chunkDurationSec: number;
  totalChunks: number;
  duration: number;
  levels: Map<number, WaveformLevelCache>;
  completedChunks: number;
}

export interface WaveformBuildProgress {
  generationId: number;
  peaksPerSecond: number[];
  completedChunks: number;
  totalChunks: number;
  status: 'idle' | 'building' | 'complete';
}

export interface WaveformBuildStartRequest {
  type: 'startBuild';
  generationId: number;
  sampleRate: number;
  duration: number;
  totalSamples: number;
  channelBuffers: ArrayBuffer[];
  peaksPerSecond: number[];
  chunkDurationSec: number;
}

export interface WaveformBuildCancelRequest {
  type: 'cancelBuild';
  generationId: number;
}

export type WaveformBuildRequest =
  | WaveformBuildStartRequest
  | WaveformBuildCancelRequest;

export interface WaveformChunkCompleteEvent {
  type: 'chunkComplete';
  generationId: number;
  chunkIndex: number;
  totalChunks: number;
  completedChunks: number;
  chunks: WaveformChunkPayload[];
}

export interface WaveformProgressEvent {
  type: 'progress';
  generationId: number;
  completedChunks: number;
  totalChunks: number;
  peaksPerSecond: number[];
  status: 'building';
}

export interface WaveformCompleteEvent {
  type: 'complete';
  generationId: number;
  completedChunks: number;
  totalChunks: number;
  peaksPerSecond: number[];
  status: 'complete';
}

export interface WaveformErrorEvent {
  type: 'error';
  generationId: number;
  message: string;
}

export type WaveformBuildEvent =
  | WaveformChunkCompleteEvent
  | WaveformProgressEvent
  | WaveformCompleteEvent
  | WaveformErrorEvent;
