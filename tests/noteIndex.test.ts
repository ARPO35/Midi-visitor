import { describe, expect, it } from 'vitest';
import {
  buildNoteTimelineIndex,
  findPlaybackNoteCursor,
  getNoteRangeForWindow,
} from '../src/services/noteIndex';

describe('noteIndex helpers', () => {
  it('sorts notes and builds cursor lookup data', () => {
    const index = buildNoteTimelineIndex([
      { midi: 62, time: 1.2, duration: 0.4, velocity: 1, name: 'D4', channel: 0, track: 1 },
      { midi: 60, time: 0.5, duration: 1.1, velocity: 1, name: 'C4', channel: 0, track: 0 },
      { midi: 64, time: 1.2, duration: 0.2, velocity: 1, name: 'E4', channel: 1, track: 2 },
    ]);

    expect(index.notes.map((note) => note.name)).toEqual(['C4', 'D4', 'E4']);
    expect(index.startTimes).toEqual([0.5, 1.2, 1.2]);
    expect(index.maxDuration).toBeCloseTo(1.1);
  });

  it('finds playback cursors and visible windows with binary search', () => {
    const index = buildNoteTimelineIndex([
      { midi: 60, time: 0, duration: 0.25, velocity: 1, name: 'C4', channel: 0, track: 0 },
      { midi: 62, time: 1, duration: 0.75, velocity: 1, name: 'D4', channel: 0, track: 0 },
      { midi: 64, time: 2.5, duration: 0.5, velocity: 1, name: 'E4', channel: 0, track: 0 },
      { midi: 65, time: 4, duration: 0.25, velocity: 1, name: 'F4', channel: 0, track: 0 },
    ]);

    expect(findPlaybackNoteCursor(index, 1.4)).toBe(2);

    const range = getNoteRangeForWindow(index, 0.8, 2.6);
    expect(range).toEqual({ startIndex: 1, endIndex: 3 });
  });

  it('keeps long notes in range when the visible window starts after the note onset', () => {
    const index = buildNoteTimelineIndex([
      { midi: 60, time: 0.5, duration: 4, velocity: 1, name: 'C4', channel: 0, track: 0 },
      { midi: 64, time: 5.5, duration: 0.5, velocity: 1, name: 'E4', channel: 0, track: 0 },
    ]);

    const visibleStart = 3;
    const visibleEnd = 6;
    const compensatedRange = getNoteRangeForWindow(
      index,
      Math.max(0, visibleStart - index.maxDuration),
      visibleEnd
    );

    expect(compensatedRange).toEqual({ startIndex: 0, endIndex: 2 });
  });
});
