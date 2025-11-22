// Simple sine wave synthesizer pool
export class AudioEngine {
  private ctx: AudioContext;
  private masterGain: GainNode;

  constructor() {
    // Initialize standard AudioContext
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();
    
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.3; // Master volume to prevent clipping
    this.masterGain.connect(this.ctx.destination);
  }

  public get currentTime() {
    return this.ctx.currentTime;
  }

  public get state() {
    return this.ctx.state;
  }

  public async resume() {
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  /**
   * Plays a note
   * @param midi Note MIDI number
   * @param duration duration in seconds
   * @param velocity velocity (0-1)
   */
  public playNote(midi: number, duration: number, velocity: number) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Frequency formula: f = 440 * 2^((d - 69)/12)
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    
    osc.type = 'sine';
    osc.frequency.value = freq;

    // Envelope
    const attack = 0.01;
    const release = 0.05;
    const now = this.ctx.currentTime;

    osc.connect(gain);
    gain.connect(this.masterGain);

    // Start at 0
    gain.gain.setValueAtTime(0, now);
    // Attack to velocity
    gain.gain.linearRampToValueAtTime(velocity, now + attack);
    // Sustain (simplified) - handled by release schedule
    // Release
    gain.gain.setValueAtTime(velocity, now + duration - release);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.start(now);
    osc.stop(now + duration + 0.1); // Stop shortly after release
    
    // Cleanup (Garbage collection handles disconnected nodes, but good practice to be explicit if complex)
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }
}

export const audioEngine = new AudioEngine();