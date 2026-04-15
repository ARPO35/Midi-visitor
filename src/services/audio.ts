import type { AudioLoadResult } from '../types';

const MAX_SYNTH_GAIN = 0.2;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

class AudioEngine {
  private ctx: AudioContext;
  private masterGain: GainNode;
  private mediaElement: HTMLAudioElement;
  private mediaSource: MediaElementAudioSourceNode;
  private currentAudioUrl: string | null = null;

  constructor() {
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioContextClass();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = MAX_SYNTH_GAIN;
    this.masterGain.connect(this.ctx.destination);

    this.mediaElement = new Audio();
    this.mediaElement.preload = 'auto';
    this.mediaSource = this.ctx.createMediaElementSource(this.mediaElement);
    this.mediaSource.connect(this.masterGain);
  }

  public get mediaCurrentTime() {
    return this.mediaElement.currentTime || 0;
  }

  public get mediaPaused() {
    return this.mediaElement.paused;
  }

  public get mediaDuration() {
    return Number.isFinite(this.mediaElement.duration) ? this.mediaElement.duration : 0;
  }

  public async resume() {
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  public setVolume(volume: number) {
    const gainValue = (clamp(volume, 0, 100) / 100) * MAX_SYNTH_GAIN;
    this.masterGain.gain.setTargetAtTime(gainValue, this.ctx.currentTime, 0.02);
  }

  public async loadAudioFile(file: File): Promise<AudioLoadResult> {
    const arrayBuffer = await file.arrayBuffer();
    const decodedBuffer = await this.ctx.decodeAudioData(arrayBuffer.slice(0));
    const channelBuffers = Array.from({ length: decodedBuffer.numberOfChannels }, (_, channelIndex) =>
      new Float32Array(decodedBuffer.getChannelData(channelIndex)).buffer
    );

    this.clearAudio();

    const objectUrl = URL.createObjectURL(file);
    this.mediaElement.src = objectUrl;
    this.mediaElement.load();

    await new Promise<void>((resolve, reject) => {
      const handleCanPlay = () => {
        cleanup();
        resolve();
      };

      const handleError = () => {
        cleanup();
        reject(new Error('Failed to load audio file'));
      };

      const cleanup = () => {
        this.mediaElement.removeEventListener('canplaythrough', handleCanPlay);
        this.mediaElement.removeEventListener('error', handleError);
      };

      this.mediaElement.addEventListener('canplaythrough', handleCanPlay, { once: true });
      this.mediaElement.addEventListener('error', handleError, { once: true });
    });

    this.currentAudioUrl = objectUrl;

    return {
      fileName: file.name,
      objectUrl,
      duration: decodedBuffer.duration,
      sampleRate: decodedBuffer.sampleRate,
      channelCount: decodedBuffer.numberOfChannels,
      totalSamples: decodedBuffer.length,
      channelBuffers,
    };
  }

  public clearAudio() {
    this.pauseMedia();
    this.seekMedia(0);

    if (this.currentAudioUrl) {
      URL.revokeObjectURL(this.currentAudioUrl);
      this.currentAudioUrl = null;
    }

    this.mediaElement.removeAttribute('src');
    this.mediaElement.load();
  }

  public async playMedia() {
    await this.resume();
    await this.mediaElement.play();
  }

  public pauseMedia() {
    this.mediaElement.pause();
  }

  public seekMedia(time: number) {
    const safeTime = clamp(time, 0, this.mediaDuration || Number.MAX_SAFE_INTEGER);
    this.mediaElement.currentTime = safeTime;
  }

  public playNote(
    midi: number,
    duration: number,
    velocity: number,
    transpose: number = 0,
    tempoMultiplier: number = 1.0
  ) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const freq = 440 * Math.pow(2, (midi + transpose - 69) / 12);
    const actualDuration = duration / tempoMultiplier;

    osc.type = 'sine';
    osc.frequency.value = freq;

    const attack = 0.01;
    const release = 0.05;
    const now = this.ctx.currentTime;

    osc.connect(gain);
    gain.connect(this.masterGain);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(velocity, now + attack);
    gain.gain.setValueAtTime(velocity, Math.max(now + attack, now + actualDuration - release));
    gain.gain.exponentialRampToValueAtTime(0.001, now + actualDuration);

    osc.start(now);
    osc.stop(now + actualDuration + 0.1);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }
}

export const audioEngine = new AudioEngine();
