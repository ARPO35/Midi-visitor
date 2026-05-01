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
  it('captures independent absolute peaks for left and right channels per bucket', () => {
    const channels = [
      Float32Array.from([1, -1, 0, 0]),
      Float32Array.from([-1, 1, 0.5, -0.5]),
    ];

    expect(Array.from(buildHighestResolutionChunk(channels, 0, 4, 4, 2))).toEqual([
      1, 1, 0, 0.5,
    ]);
  });

  it('mirrors mono sources into both envelope edges', () => {
    const channels = [Float32Array.from([0.25, -0.75, 0.1, 0.2])];
    const result = Array.from(buildHighestResolutionChunk(channels, 0, 4, 4, 2));

    expect(result[0]).toBeCloseTo(0.75, 6);
    expect(result[1]).toBeCloseTo(0.75, 6);
    expect(result[2]).toBeCloseTo(0.2, 6);
    expect(result[3]).toBeCloseTo(0.2, 6);
  });
});

describe('aggregateChunk', () => {
  it('preserves per-channel peaks when reducing resolution', () => {
    const source = new Float32Array([0.2, 0.4, 0.6, 0.1, 0.5, 0.9, 0.8, 0.3]);
    const result = Array.from(aggregateChunk(source, 4, 2));

    expect(result[0]).toBeCloseTo(0.6, 6);
    expect(result[1]).toBeCloseTo(0.4, 6);
    expect(result[2]).toBeCloseTo(0.8, 6);
    expect(result[3]).toBeCloseTo(0.9, 6);
  });

  it('returns a copy when the resolution stays the same', () => {
    const source = new Float32Array([-1, 0, 0.5, 1]);
    const result = aggregateChunk(source, 120, 120);

    expect(result).not.toBe(source);
    expect(Array.from(result)).toEqual(Array.from(source));
  });
});
