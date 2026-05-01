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
  const leftChannel = channelData[0];
  const rightChannel = channelData[1] ?? leftChannel;

  for (let peakIndex = 0; peakIndex < peakCount; peakIndex += 1) {
    const bucketStart = chunkStartSample + Math.floor((peakIndex / peaksPerSecond) * sampleRate);
    const bucketEnd = Math.min(
      chunkEndSample,
      chunkStartSample + Math.floor(((peakIndex + 1) / peaksPerSecond) * sampleRate)
    );

    let leftPeak = 0;
    let rightPeak = 0;

    for (let sampleIndex = bucketStart; sampleIndex < bucketEnd; sampleIndex += 1) {
      const leftSample = Math.abs(leftChannel?.[sampleIndex] ?? 0);
      const rightSample = Math.abs(rightChannel?.[sampleIndex] ?? 0);

      if (leftSample > leftPeak) leftPeak = leftSample;
      if (rightSample > rightPeak) rightPeak = rightSample;
    }

    const writeIndex = peakIndex * 2;
    peaks[writeIndex] = bucketEnd <= bucketStart ? 0 : leftPeak;
    peaks[writeIndex + 1] = bucketEnd <= bucketStart ? 0 : rightPeak;
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

    let leftPeak = 0;
    let rightPeak = 0;

    for (let sourceIndex = sourceStart; sourceIndex < sourceEnd; sourceIndex += 1) {
      const readIndex = sourceIndex * 2;
      leftPeak = Math.max(leftPeak, sourcePeaks[readIndex] ?? 0);
      rightPeak = Math.max(rightPeak, sourcePeaks[readIndex + 1] ?? 0);
    }

    const writeIndex = targetIndex * 2;
    targetPeaks[writeIndex] = sourceEnd <= sourceStart ? 0 : leftPeak;
    targetPeaks[writeIndex + 1] = sourceEnd <= sourceStart ? 0 : rightPeak;
  }

  return targetPeaks;
};
