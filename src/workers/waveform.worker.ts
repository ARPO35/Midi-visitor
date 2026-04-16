/// <reference lib="webworker" />

import type {
  WaveformBuildRequest,
  WaveformBuildStartRequest,
  WaveformBuildEvent,
  WaveformChunkPayload,
} from '../types';
import {
  aggregateChunk,
  buildHighestResolutionChunk,
  sortPeaksPerSecond,
} from '../services/waveformMath';

const ctx = self as DedicatedWorkerGlobalScope;

let activeGenerationId = -1;

const postEvent = (event: WaveformBuildEvent, transfer: Transferable[] = []) => {
  ctx.postMessage(event, transfer);
};

const buildWaveform = async ({
  generationId,
  sampleRate,
  totalSamples,
  channelBuffers,
  peaksPerSecond,
  chunkDurationSec,
}: WaveformBuildStartRequest) => {
  activeGenerationId = generationId;

  const sortedPeaksPerSecond = sortPeaksPerSecond(peaksPerSecond);
  const highestResolution = sortedPeaksPerSecond[0];
  const chunkSampleCount = Math.max(1, Math.ceil(chunkDurationSec * sampleRate));
  const totalChunks = Math.max(1, Math.ceil(totalSamples / chunkSampleCount));
  const channelData = channelBuffers.map((buffer) => new Float32Array(buffer));

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    if (activeGenerationId !== generationId) {
      return;
    }

    const chunkStartSample = chunkIndex * chunkSampleCount;
    const chunkEndSample = Math.min(totalSamples, chunkStartSample + chunkSampleCount);

    let previousPeaksPerSecond = highestResolution;
    let previousChunk = buildHighestResolutionChunk(
      channelData,
      chunkStartSample,
      chunkEndSample,
      sampleRate,
      highestResolution
    );

    const chunks: WaveformChunkPayload[] = [
      {
        peaksPerSecond: highestResolution,
        chunkIndex,
        data: previousChunk.buffer,
      },
    ];

    for (let levelIndex = 1; levelIndex < sortedPeaksPerSecond.length; levelIndex += 1) {
      const currentPeaksPerSecond = sortedPeaksPerSecond[levelIndex];
      const nextChunk = aggregateChunk(
        previousChunk,
        previousPeaksPerSecond,
        currentPeaksPerSecond
      );
      chunks.push({
        peaksPerSecond: currentPeaksPerSecond,
        chunkIndex,
        data: nextChunk.buffer,
      });
      previousChunk = nextChunk;
      previousPeaksPerSecond = currentPeaksPerSecond;
    }

    const completedChunks = chunkIndex + 1;
    const transferList = chunks.map((chunk) => chunk.data);

    postEvent(
      {
        type: 'chunkComplete',
        generationId,
        chunkIndex,
        totalChunks,
        completedChunks,
        chunks,
      },
      transferList
    );

    postEvent({
      type: 'progress',
      generationId,
      completedChunks,
      totalChunks,
      peaksPerSecond: sortedPeaksPerSecond,
      status: 'building',
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  if (activeGenerationId !== generationId) {
    return;
  }

  postEvent({
    type: 'complete',
    generationId,
    completedChunks: totalChunks,
    totalChunks,
    peaksPerSecond: sortedPeaksPerSecond,
    status: 'complete',
  });
};

ctx.onmessage = (message: MessageEvent<WaveformBuildRequest>) => {
  const request = message.data;

  if (request.type === 'cancelBuild') {
    if (request.generationId === activeGenerationId) {
      activeGenerationId = -1;
    }
    return;
  }

  buildWaveform(request).catch((error: unknown) => {
    postEvent({
      type: 'error',
      generationId: request.generationId,
      message: error instanceof Error ? error.message : 'Waveform build failed',
    });
  });
};
