import type { WaveformLineData } from '../types';

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
