import type { NoteData } from '../types';

export interface NoteTimelineIndex {
  notes: NoteData[];
  startTimes: number[];
  maxDuration: number;
}

export interface NoteRange {
  startIndex: number;
  endIndex: number;
}

export const lowerBound = (values: readonly number[], target: number) => {
  let low = 0;
  let high = values.length;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (values[mid] < target) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
};

export const upperBound = (values: readonly number[], target: number) => {
  let low = 0;
  let high = values.length;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (values[mid] <= target) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
};

export const buildNoteTimelineIndex = (notes: readonly NoteData[]): NoteTimelineIndex => {
  const sortedNotes = [...notes].sort(
    (a, b) =>
      a.time - b.time ||
      a.track - b.track ||
      a.channel - b.channel ||
      a.midi - b.midi ||
      a.duration - b.duration
  );

  return {
    notes: sortedNotes,
    startTimes: sortedNotes.map((note) => note.time),
    maxDuration: sortedNotes.reduce((maxDuration, note) => Math.max(maxDuration, note.duration), 0),
  };
};

export const findPlaybackNoteCursor = (index: NoteTimelineIndex, time: number) =>
  lowerBound(index.startTimes, Math.max(0, time));

export const getNoteRangeForWindow = (
  index: NoteTimelineIndex,
  startTime: number,
  endTime: number
): NoteRange => {
  if (endTime <= startTime) {
    return { startIndex: 0, endIndex: 0 };
  }

  return {
    startIndex: lowerBound(index.startTimes, startTime),
    endIndex: upperBound(index.startTimes, endTime),
  };
};
