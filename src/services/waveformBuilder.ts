import type { WaveformBuildEvent, WaveformBuildStartRequest } from '../types';

type WaveformListener = (event: WaveformBuildEvent) => void;

export class WaveformBuilder {
  private worker: Worker;
  private listener: WaveformListener;

  constructor(listener: WaveformListener) {
    this.worker = new Worker(new URL('../workers/waveform.worker.ts', import.meta.url), {
      type: 'module',
    });
    this.listener = listener;
    this.worker.onmessage = (message: MessageEvent<WaveformBuildEvent>) => {
      this.listener(message.data);
    };
  }

  public startBuild(request: WaveformBuildStartRequest) {
    this.worker.postMessage(request, request.channelBuffers);
  }

  public cancelBuild(generationId: number) {
    this.worker.postMessage({
      type: 'cancelBuild',
      generationId,
    });
  }

  public dispose() {
    this.worker.terminate();
  }
}
