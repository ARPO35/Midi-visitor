import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WaveformBuildEvent, WaveformBuildStartRequest } from '../types';
import { WaveformBuilder } from './waveformBuilder';

class MockWorker {
  static instances: MockWorker[] = [];

  public onmessage: ((event: MessageEvent<WaveformBuildEvent>) => void) | null = null;

  public readonly postMessage = vi.fn();

  public readonly terminate = vi.fn();

  public readonly url: URL;

  public readonly options?: WorkerOptions;

  constructor(url: URL, options?: WorkerOptions) {
    this.url = url;
    this.options = options;
    MockWorker.instances.push(this);
  }

  emit(data: WaveformBuildEvent) {
    this.onmessage?.(new MessageEvent('message', { data }));
  }
}

describe('WaveformBuilder', () => {
  beforeEach(() => {
    MockWorker.instances = [];
    vi.stubGlobal('Worker', MockWorker as unknown as typeof Worker);
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'Worker');
  });

  it('forwards worker messages to the listener', () => {
    const listener = vi.fn();
    const builder = new WaveformBuilder(listener);
    const worker = MockWorker.instances[0] as MockWorker;

    worker.emit({
      type: 'complete',
      generationId: 7,
      completedChunks: 1,
      totalChunks: 1,
      peaksPerSecond: [480, 240],
      status: 'complete',
    });

    expect(listener).toHaveBeenCalledWith({
      type: 'complete',
      generationId: 7,
      completedChunks: 1,
      totalChunks: 1,
      peaksPerSecond: [480, 240],
      status: 'complete',
    });

    builder.dispose();
  });

  it('creates a module worker and posts transferable buffers for start builds', () => {
    const listener = vi.fn();
    const builder = new WaveformBuilder(listener);
    const worker = MockWorker.instances[0] as MockWorker;
    const channelBuffers = [new ArrayBuffer(8), new ArrayBuffer(16)];
    const request: WaveformBuildStartRequest = {
      type: 'startBuild',
      generationId: 11,
      sampleRate: 48000,
      duration: 12,
      totalSamples: 96000,
      channelBuffers,
      peaksPerSecond: [480, 240, 120],
      chunkDurationSec: 5,
    };

    expect(worker.url.href).toContain('waveform.worker.ts');
    expect(worker.options).toEqual({ type: 'module' });

    builder.startBuild(request);

    expect(worker.postMessage).toHaveBeenCalledWith(request, channelBuffers);

    builder.dispose();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it('posts cancel messages with the generation id', () => {
    const builder = new WaveformBuilder(vi.fn());
    const worker = MockWorker.instances[0] as MockWorker;

    builder.cancelBuild(42);

    expect(worker.postMessage).toHaveBeenCalledWith({
      type: 'cancelBuild',
      generationId: 42,
    });

    builder.dispose();
  });
});
