import { describe, expect, it } from 'vitest';

import { AUTO_WAVEFORM_PEAK_LEVELS, getRequestedWaveformLevels } from './waveformPeak';

describe('getRequestedWaveformLevels', () => {
  it('returns the auto cache levels when waveform peak sample rate is auto', () => {
    expect(getRequestedWaveformLevels(null)).toEqual(AUTO_WAVEFORM_PEAK_LEVELS);
  });

  it('returns a single rounded manual level when waveform peak sample rate is manual', () => {
    expect(getRequestedWaveformLevels(959.6)).toEqual([960]);
  });
});
