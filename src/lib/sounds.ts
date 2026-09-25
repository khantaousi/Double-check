/**
 * Sound effects synthesizer using Web Audio API
 * No external file dependencies - plays instantly in any browser.
 */

class SoundEffectsService {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Rooster Crow Sound Effect ("Cock-a-doodle-doo!" / "কুক-কুরু-কুক")
   * Triggered when switching from Dark to Light Theme (Morning dawn)
   */
  public playRoosterCrow() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const startTime = ctx.currentTime + 0.05;

      // Master gain to keep volume pleasant
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.22, startTime);
      masterGain.connect(ctx.destination);

      // Formant filter to simulate animal vocal tract / throat squawk
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1450, startTime);
      filter.Q.setValueAtTime(2.2, startTime);
      filter.connect(masterGain);

      // Sub filter for body resonance
      const subFilter = ctx.createBiquadFilter();
      subFilter.type = 'lowpass';
      subFilter.frequency.setValueAtTime(3200, startTime);
      subFilter.connect(filter);

      // Syllables: [startOffset, duration, startFreq, endFreq, peakGain, hasVibrato]
      const syllables: [number, number, number, number, number, boolean][] = [
        [0.00, 0.18, 440, 520, 0.65, false], // "Cock"
        [0.21, 0.20, 540, 680, 0.85, false], // "a"
        [0.44, 0.22, 650, 780, 0.95, false], // "doodle"
        [0.70, 0.95, 840, 640, 1.00, true]   // "DOOOOO-ooo" (long sustained vibrato)
      ];

      syllables.forEach(([offset, duration, startFreq, endFreq, peakGain, hasVibrato]) => {
        const syllableStart = startTime + offset;
        const syllableEnd = syllableStart + duration;

        // Primary oscillator (Sawtooth for brassy rooster timbre)
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(startFreq, syllableStart);
        osc.frequency.exponentialRampToValueAtTime(endFreq, syllableEnd);

        // Secondary harmonic oscillator for richness
        const osc2 = ctx.createOscillator();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(startFreq * 1.5, syllableStart);
        osc2.frequency.exponentialRampToValueAtTime(endFreq * 1.5, syllableEnd);

        if (hasVibrato) {
          // LFO for throat vibrato on the final sustained crow
          const lfo = ctx.createOscillator();
          const lfoGain = ctx.createGain();
          lfo.frequency.setValueAtTime(5.8, syllableStart); // 5.8 Hz rooster warble
          lfoGain.gain.setValueAtTime(28, syllableStart);
          lfo.connect(lfoGain);
          lfoGain.connect(osc.frequency);
          lfoGain.connect(osc2.frequency);
          lfo.start(syllableStart);
          lfo.stop(syllableEnd);
        }

        // Syllable Gain envelope
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, syllableStart);
        gain.gain.exponentialRampToValueAtTime(peakGain, syllableStart + 0.04);
        gain.gain.setValueAtTime(peakGain * 0.9, syllableEnd - 0.06);
        gain.gain.exponentialRampToValueAtTime(0.0001, syllableEnd);

        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(subFilter);

        osc.start(syllableStart);
        osc2.start(syllableStart);
        osc.stop(syllableEnd);
        osc2.stop(syllableEnd);
      });
    } catch (e) {
      console.warn('Rooster sound effect error:', e);
    }
  }

  /**
   * Dark Theme Nocturnal Sound Effect (Night Ambient + Mystical Owl Hoot)
   * Triggered when switching from Light to Dark Theme
   */
  public playDarkThemeSound() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const startTime = ctx.currentTime + 0.05;

      // Master gain
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.20, startTime);
      masterGain.connect(ctx.destination);

      // Deep atmospheric night chord (Nocturnal mystical drone)
      const chordNotes = [110, 164.8, 220]; // A2, E3, A3
      chordNotes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.exponentialRampToValueAtTime(0.3 / (idx + 1), startTime + 0.25);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.2);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(startTime);
        osc.stop(startTime + 1.25);
      });

      // Owl Hoot ("Hooo... Hoo-hooo")
      const hoots: [number, number, number, number][] = [
        [0.10, 0.28, 410, 370], // "Hooo"
        [0.45, 0.16, 440, 410], // "Hoo"
        [0.65, 0.38, 390, 340]  // "hoooo"
      ];

      hoots.forEach(([offset, duration, startFreq, endFreq]) => {
        const hootStart = startTime + offset;
        const hootEnd = hootStart + duration;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(startFreq, hootStart);
        osc.frequency.exponentialRampToValueAtTime(endFreq, hootEnd);

        // Warm low pass for hollow wooden bird sound
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, hootStart);

        gain.gain.setValueAtTime(0.0001, hootStart);
        gain.gain.exponentialRampToValueAtTime(0.65, hootStart + 0.06);
        gain.gain.exponentialRampToValueAtTime(0.0001, hootEnd);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);

        osc.start(hootStart);
        osc.stop(hootEnd);
      });
    } catch (e) {
      console.warn('Dark sound effect error:', e);
    }
  }

  /**
   * Bat Echolocation & Flutter Sound Effect ("বাদুড়ের শব্দ")
   * Triggered when clicking notification or bell icon
   */
  public playBatSound() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const startTime = ctx.currentTime + 0.03;

      // Master gain
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.18, startTime);
      masterGain.connect(ctx.destination);

      // 1. Rapid bat ultrasonic chirps / echolocation squeaks
      const chirps: [number, number, number, number][] = [
        [0.00, 0.045, 5200, 2400], // Chirp 1
        [0.06, 0.040, 6100, 2700], // Chirp 2
        [0.12, 0.050, 7200, 2900], // Chirp 3
        [0.19, 0.060, 5800, 2200]  // Chirp 4
      ];

      chirps.forEach(([offset, duration, startFreq, endFreq]) => {
        const chStart = startTime + offset;
        const chEnd = chStart + duration;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(startFreq, chStart);
        osc.frequency.exponentialRampToValueAtTime(endFreq, chEnd);

        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1800, chStart);

        gain.gain.setValueAtTime(0.0001, chStart);
        gain.gain.exponentialRampToValueAtTime(0.8, chStart + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, chEnd);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);

        osc.start(chStart);
        osc.stop(chEnd);
      });

      // 2. Soft bat wing flutter (nocturnal flurry)
      const bufferSize = ctx.sampleRate * 0.22;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(900, startTime);
      noiseFilter.Q.setValueAtTime(1.5, startTime);

      // Tremolo on wing flap
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.0001, startTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.25, startTime + 0.05);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.22);

      whiteNoise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(masterGain);

      whiteNoise.start(startTime);
      whiteNoise.stop(startTime + 0.23);

      // 3. Crisp bell-like harmonic echo ping
      const pingOsc = ctx.createOscillator();
      const pingGain = ctx.createGain();
      pingOsc.type = 'triangle';
      pingOsc.frequency.setValueAtTime(2400, startTime + 0.05);
      pingOsc.frequency.exponentialRampToValueAtTime(1800, startTime + 0.35);

      pingGain.gain.setValueAtTime(0.0001, startTime + 0.05);
      pingGain.gain.exponentialRampToValueAtTime(0.35, startTime + 0.08);
      pingGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.40);

      pingOsc.connect(pingGain);
      pingGain.connect(masterGain);

      pingOsc.start(startTime + 0.05);
      pingOsc.stop(startTime + 0.42);
    } catch (e) {
      console.warn('Bat sound effect error:', e);
    }
  }
}

export const sounds = new SoundEffectsService();
