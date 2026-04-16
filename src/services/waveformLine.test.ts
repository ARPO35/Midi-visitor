import { describe, expect, it } from 'vitest';

import { buildWaveformLineData } from './waveformLine';

describe('buildWaveformLineData', () => {
  it('keeps mono samples unchanged', () => {
    const mono = new Float32Array([0.25, -0.5, 0.75]);
    const result = buildWaveformLineData([mono.buffer], mono.length, 48_000);

    expect(Array.from(result.samples)).toEqual([0.25, -0.5, 0.75]);
    expect(result.sampleRate).toBe(48_000);
    expect(result.totalSamples).toBe(3);
  });

  it('averages multiple channels into a mixed waveform', () => {
    const left = new Float32Array([1, -1, 0.5]);
    const right = new Float32Array([-1, 1, -0.5]);
    const result = buildWaveformLineData([left.buffer, right.buffer], left.length, 44_100);

    expect(Array.from(result.samples)).toEqual([0, 0, 0]);
  });
});
