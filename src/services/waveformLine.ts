import type { WaveformLineData } from '../types';

const HIGH_DETAIL_SAMPLES_PER_PIXEL_THRESHOLD = 8;

export const buildWaveformLineData = (
  channelBuffers: ArrayBuffer[],
  totalSamples: number,
  sampleRate: number
): WaveformLineData => {
  const channelData = channelBuffers.map((buffer) => new Float32Array(buffer));
  const mixedSamples = new Float32Array(totalSamples);

  if (channelData.length === 0) {
    return {
      samples: mixedSamples,
      sampleRate,
      totalSamples,
    };
  }

  for (let sampleIndex = 0; sampleIndex < totalSamples; sampleIndex += 1) {
    let mixedSample = 0;

    for (let channelIndex = 0; channelIndex < channelData.length; channelIndex += 1) {
      mixedSample += channelData[channelIndex]?.[sampleIndex] ?? 0;
    }

    mixedSamples[sampleIndex] = mixedSample / channelData.length;
  }

  return {
    samples: mixedSamples,
    sampleRate,
    totalSamples,
  };
};

export const shouldRenderWaveformLine = (
  sampleRate: number,
  visibleDuration: number,
  axisSpan: number
) => {
  if (sampleRate <= 0 || visibleDuration <= 0 || axisSpan <= 0) {
    return false;
  }

  const samplesPerPixel = (visibleDuration * sampleRate) / axisSpan;
  return samplesPerPixel <= HIGH_DETAIL_SAMPLES_PER_PIXEL_THRESHOLD;
};
