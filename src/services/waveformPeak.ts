export const AUTO_WAVEFORM_PEAK_LEVELS = [3840, 1920, 960, 480, 240, 120, 60, 30];

export const getRequestedWaveformLevels = (waveformPeakSampleRate: number | null) => {
  if (waveformPeakSampleRate === null) {
    return [...AUTO_WAVEFORM_PEAK_LEVELS];
  }

  return [Math.max(1, Math.round(waveformPeakSampleRate))];
};
