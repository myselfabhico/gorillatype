/**
 * Sound engine — all sounds are synthesized live with the Web Audio API,
 * no audio assets required.
 *
 * Keyboard sounds: a lightweight synthesized keypress ("Standard").
 * Website SFX (UI clicks, word correct/incorrect, finish, victory) have their
 * own synthesizers and are controlled by the separate Website SFX toggle.
 */

export type KeyboardSoundId = 'standard' | 'mute';

export const KEYBOARD_SOUND_OPTIONS: { id: KeyboardSoundId; label: string }[] = [
  { id: 'standard', label: 'Standard' },
  { id: 'mute', label: 'Mute' },
];

class SoundManager {
  private ctx: AudioContext | null = null;
  /** Which keyboard sound playKey() should produce. */
  private keyboardSound: KeyboardSoundId = 'standard';
  /** Master volume for keyboard sounds, 0..1. */
  private keyboardVolume = 0.7;

  /** Select the keyboard sound engine. Call whenever the setting changes. */
  setKeyboardSound(id: KeyboardSoundId): void {
    this.keyboardSound = id;
  }

  /** Set keyboard sound volume (0..1). Call whenever the setting changes. */
  setKeyboardVolume(volume: number): void {
    this.keyboardVolume = Math.min(1, Math.max(0, volume));
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /** Play one keyboard press. Synchronous; silent when muted or volume is 0. */
  playKey(): void {
    if (this.keyboardSound === 'mute') return;
    this.playSynthKey();
  }

  /** Synthesized keyboard sound ("Standard"). */
  playSynthKey(): void {
    if (this.keyboardVolume <= 0) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(380 + Math.random() * 60, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.06);
      gain.gain.setValueAtTime(0.4 * this.keyboardVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.07);
      this.playNoise(ctx, now, 0.03, 0.2 * this.keyboardVolume, 1200);
    } catch {
    }
  }

  playUiClick(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(620, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.05);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    } catch {
    }
  }

  playWordSuccess(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      [660, 990].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);
        gain.gain.setValueAtTime(0.18, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.13);
      });
    } catch {
    }
  }

  playWordWrong(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.linearRampToValueAtTime(110, now + 0.12);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.14);
    } catch {
    }
  }

  playFinishSound(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.2, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.26);
      });
    } catch {
    }
  }

  playVictorySound(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      // Rising fanfare arpeggio
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.11);
        gain.gain.setValueAtTime(0.0001, now + idx * 0.11);
        gain.gain.exponentialRampToValueAtTime(0.24, now + idx * 0.11 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.11 + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.11);
        osc.stop(now + idx * 0.11 + 0.32);
      });
      // Triumphant final chord (C major spread)
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + 0.5;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.16, start + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.9);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.92);
      });
      // Sparkle sweep
      const sparkle = ctx.createOscillator();
      const sparkleGain = ctx.createGain();
      sparkle.type = 'sine';
      sparkle.frequency.setValueAtTime(1568, now + 0.5);
      sparkle.frequency.exponentialRampToValueAtTime(3136, now + 1.2);
      sparkleGain.gain.setValueAtTime(0.0001, now + 0.5);
      sparkleGain.gain.exponentialRampToValueAtTime(0.08, now + 0.6);
      sparkleGain.gain.exponentialRampToValueAtTime(0.001, now + 1.25);
      sparkle.connect(sparkleGain);
      sparkleGain.connect(ctx.destination);
      sparkle.start(now + 0.5);
      sparkle.stop(now + 1.3);
    } catch {
    }
  }

  private playNoise(ctx: AudioContext, time: number, duration: number, volume: number, filterFreq: number): void {
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(filterFreq, time);
    filter.Q.setValueAtTime(1.5, time);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(time);
    noise.stop(time + duration);
  }
}

export const soundManager = new SoundManager();
