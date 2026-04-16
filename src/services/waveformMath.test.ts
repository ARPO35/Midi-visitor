import { describe, expect, it } from 'vitest';
import {
  aggregateChunk,
  buildHighestResolutionChunk,
  sortPeaksPerSecond,
} from './waveformMath';

describe('sortPeaksPerSecond', () => {
  it('sorts descending and removes duplicates', () => {
    expect(sortPeaksPerSecond([30, 480, 120, 120, 60, 480])).toEqual([480, 120, 60, 30]);
  });
});

describe('buildHighestResolutionChunk', () => {
  it('mixes channels and captures min/max values per bucket', () => {
    const channels = [
      Float32Array.from([1, -1, 0, 0]),
      Float32Array.from([-1, 1, 0.5, -0.5]),
    ];

    expect(Array.from(buildHighestResolutionChunk(channels, 0, 4, 4, 2))).toEqual([
      0, 0, -0.25, 0.25,
    ]);
  });
});

describe('aggregateChunk', () => {
  it('preserves extrema when reducing resolution', () => {
    const source = new Float32Array([-1, 0, -0.5, 0.5, 0.2, 0.8, -0.3, 0.4]);
    const result = Array.from(aggregateChunk(source, 4, 2));

    expect(result[0]).toBe(-1);
    expect(result[1]).toBe(0.5);
    expect(result[2]).toBeCloseTo(-0.3, 6);
    expect(result[3]).toBeCloseTo(0.8, 6);
  });

  it('returns a copy when the resolution stays the same', () => {
    const source = new Float32Array([-1, 0, 0.5, 1]);
    const result = aggregateChunk(source, 120, 120);

    expect(result).not.toBe(source);
    expect(Array.from(result)).toEqual(Array.from(source));
  });
});
