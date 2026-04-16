export const sortPeaksPerSecond = (values: number[]) =>
  [...values]
    .sort((a, b) => b - a)
    .filter((value, index, array) => index === 0 || array[index - 1] !== value);

export const buildHighestResolutionChunk = (
  channelData: Float32Array[],
  chunkStartSample: number,
  chunkEndSample: number,
  sampleRate: number,
  peaksPerSecond: number
) => {
  const sampleCount = Math.max(0, chunkEndSample - chunkStartSample);
  const peakCount = Math.max(1, Math.ceil((sampleCount / sampleRate) * peaksPerSecond));
  const peaks = new Float32Array(peakCount * 2);
  const channelCount = channelData.length;

  for (let peakIndex = 0; peakIndex < peakCount; peakIndex += 1) {
    const bucketStart = chunkStartSample + Math.floor((peakIndex / peaksPerSecond) * sampleRate);
    const bucketEnd = Math.min(
      chunkEndSample,
      chunkStartSample + Math.floor(((peakIndex + 1) / peaksPerSecond) * sampleRate)
    );

    let min = 1;
    let max = -1;

    for (let sampleIndex = bucketStart; sampleIndex < bucketEnd; sampleIndex += 1) {
      let mixedSample = 0;
      for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
        mixedSample += channelData[channelIndex]?.[sampleIndex] ?? 0;
      }
      mixedSample /= channelCount || 1;

      if (mixedSample < min) min = mixedSample;
      if (mixedSample > max) max = mixedSample;
    }

    const writeIndex = peakIndex * 2;
    peaks[writeIndex] = bucketEnd <= bucketStart ? 0 : min;
    peaks[writeIndex + 1] = bucketEnd <= bucketStart ? 0 : max;
  }

  return peaks;
};

export const aggregateChunk = (
  sourcePeaks: Float32Array,
  sourcePeaksPerSecond: number,
  targetPeaksPerSecond: number
) => {
  if (sourcePeaksPerSecond === targetPeaksPerSecond) {
    return new Float32Array(sourcePeaks);
  }

  const sourceCount = sourcePeaks.length / 2;
  const ratio = Math.max(1, Math.round(sourcePeaksPerSecond / targetPeaksPerSecond));
  const targetCount = Math.max(1, Math.ceil(sourceCount / ratio));
  const targetPeaks = new Float32Array(targetCount * 2);

  for (let targetIndex = 0; targetIndex < targetCount; targetIndex += 1) {
    const sourceStart = targetIndex * ratio;
    const sourceEnd = Math.min(sourceCount, sourceStart + ratio);

    let min = 1;
    let max = -1;

    for (let sourceIndex = sourceStart; sourceIndex < sourceEnd; sourceIndex += 1) {
      const readIndex = sourceIndex * 2;
      min = Math.min(min, sourcePeaks[readIndex] ?? 0);
      max = Math.max(max, sourcePeaks[readIndex + 1] ?? 0);
    }

    const writeIndex = targetIndex * 2;
    targetPeaks[writeIndex] = sourceEnd <= sourceStart ? 0 : min;
    targetPeaks[writeIndex + 1] = sourceEnd <= sourceStart ? 0 : max;
  }

  return targetPeaks;
};
