
// Simple sine wave synthesizer pool
export class AudioEngine {
  private ctx: AudioContext;
  private masterGain: GainNode;

  constructor() {
    // Initialize standard AudioContext
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();
    
    this.masterGain = this.ctx.createGain();
    // Default start low to prevent blast, but setVolume will override immediately in App
    this.masterGain.gain.value = 0.2; 
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
   * Set volume based on UI range of 0-100
   * Real max output gain is capped at 0.2 (20%)
   * @param volume UI Value (0-100)
   */
  public setVolume(volume: number) {
    // Map 0-100 to 0.0-0.2
    const MAX_GAIN = 0.2;
    const gainValue = (Math.max(0, Math.min(100, volume)) / 100) * MAX_GAIN;
    
    this.masterGain.gain.setTargetAtTime(gainValue, this.ctx.currentTime, 0.02);
  }

  /**
   * Plays a note
   * @param midi Note MIDI number
   * @param duration duration in seconds (raw midi duration)
   * @param velocity velocity (0-1)
   * @param transpose semitones to shift
   * @param tempoMultiplier playback speed multiplier (to shorten duration)
   */
  public playNote(midi: number, duration: number, velocity: number, transpose: number = 0, tempoMultiplier: number = 1.0) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Frequency formula: f = 440 * 2^((d - 69)/12)
    // Add transpose to the midi number
    const freq = 440 * Math.pow(2, (midi + transpose - 69) / 12);
    
    // Scale duration by tempo (faster tempo = shorter note)
    const actualDuration = duration / tempoMultiplier;

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
    gain.gain.setValueAtTime(velocity, now + actualDuration - release);
    gain.gain.exponentialRampToValueAtTime(0.001, now + actualDuration);

    osc.start(now);
    osc.stop(now + actualDuration + 0.1); // Stop shortly after release
    
    // Cleanup 
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }
}

export const audioEngine = new AudioEngine();