export type AmbientTrackId = 'rain' | 'lofi' | 'meadow' | 'focus';

export interface AmbientTrackMeta {
  id: AmbientTrackId;
  emoji: string;
  title: string;
  subtitle: string;
}

export const AMBIENT_TRACKS: readonly AmbientTrackMeta[] = [
  {
    id: 'rain',
    emoji: '🌧️',
    title: 'ฝนตกเบาๆ',
    subtitle: 'เสียงฝนอุ่นๆ นุ่มหู ช่วยตัดเสียงรบกวน',
  },
  {
    id: 'lofi',
    emoji: '🎹',
    title: 'Lo-fi อ่านหนังสือ',
    subtitle: 'คอร์ดเปียโนไฟฟ้าอุ่นๆ จังหวะช้าๆ สบายตา',
  },
  {
    id: 'meadow',
    emoji: '🍃',
    title: 'ลมทุ่งหญ้า',
    subtitle: 'เสียงลมพัดแผ่วๆ กับโทนเสียงนุ่มลึก',
  },
  {
    id: 'focus',
    emoji: '☕',
    title: 'โฟกัสเงียบๆ',
    subtitle: 'เสียง Brown Noise โทนต่ำนุ่มๆ สำหรับทำข้อสอบ',
  },
] as const;

type StopFn = () => void;

function createNoiseBuffer(
  ctx: AudioContext,
  type: 'pink' | 'brown' | 'white',
  durationSec = 4,
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * durationSec);
  const buffer = ctx.createBuffer(2, length, sampleRate);

  for (let ch = 0; ch < 2; ch += 1) {
    const out = buffer.getChannelData(ch);
    if (type === 'white') {
      for (let i = 0; i < length; i += 1) {
        out[i] = Math.random() * 2 - 1;
      }
    } else if (type === 'brown') {
      let last = 0;
      for (let i = 0; i < length; i += 1) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        out[i] = last * 3.2;
      }
    } else {
      // Voss-McCartney style smooth pink noise
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      let b3 = 0;
      let b4 = 0;
      let b5 = 0;
      let b6 = 0;
      for (let i = 0; i < length; i += 1) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520;
        b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.0168980;
        out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.055;
        b6 = w * 0.115926;
      }
    }
  }
  return buffer;
}

/**
 * Singleton Web Audio API ambient & Lo-fi synthesizer (F49, F50, F52):
 * - Single shared AudioContext resumed synchronously inside user click handlers
 * - Soft 80ms fade-in/out to prevent speaker clicks
 * - Full node + timer teardown & ctx.suspend() on pause (0% background CPU)
 */
class AmbientAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private stopCurrentTrack: StopFn | null = null;
  private pauseTimeout: ReturnType<typeof setTimeout> | null = null;
  private activeTrack: AmbientTrackId | null = null;
  private volume = 0.55;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0;
      this.masterGain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  public play(trackId: AmbientTrackId, volume = this.volume): boolean {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return false;

    if (this.pauseTimeout) {
      clearTimeout(this.pauseTimeout);
      this.pauseTimeout = null;
    }

    this.volume = Math.max(0, Math.min(1, volume));

    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    if (this.activeTrack !== trackId || !this.stopCurrentTrack) {
      this.teardownActiveTrack();
      this.stopCurrentTrack = this.buildTrack(ctx, this.masterGain, trackId);
      this.activeTrack = trackId;
    }

    const now = ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(this.volume, now, 0.08);
    return true;
  }

  public pause(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(0, now, 0.06);

    if (this.pauseTimeout) clearTimeout(this.pauseTimeout);
    this.pauseTimeout = setTimeout(() => {
      this.pauseTimeout = null;
      this.teardownActiveTrack();
      if (this.ctx && this.ctx.state === 'running') {
        void this.ctx.suspend();
      }
    }, 220);
  }

  public setVolume(nextVolume: number): void {
    this.volume = Math.max(0, Math.min(1, nextVolume));
    if (!this.ctx || !this.masterGain || !this.stopCurrentTrack) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(this.volume, now, 0.04);
  }

  private teardownActiveTrack(): void {
    if (this.stopCurrentTrack) {
      try {
        this.stopCurrentTrack();
      } catch {
        // Ignore already-stopped nodes
      }
      this.stopCurrentTrack = null;
    }
    this.activeTrack = null;
  }

  private buildTrack(
    ctx: AudioContext,
    dest: GainNode,
    trackId: AmbientTrackId,
  ): StopFn {
    switch (trackId) {
      case 'rain':
        return this.startRain(ctx, dest);
      case 'lofi':
        return this.startLofi(ctx, dest);
      case 'meadow':
        return this.startMeadow(ctx, dest);
      case 'focus':
        return this.startFocus(ctx, dest);
    }
  }

  private startRain(ctx: AudioContext, dest: GainNode): StopFn {
    const cleanups: StopFn[] = [];

    // Warm pink-noise rain bed
    const src = ctx.createBufferSource();
    src.buffer = createNoiseBuffer(ctx, 'pink', 5);
    src.loop = true;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 1150;
    lowpass.Q.value = 0.6;

    const bedGain = ctx.createGain();
    bedGain.gain.value = 0.65;

    // Gentle LFO breathing on rain intensity
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.14;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 260;
    lfo.connect(lfoGain).connect(lowpass.frequency);

    src.connect(lowpass).connect(bedGain).connect(dest);
    src.start();
    lfo.start();

    // Soft subtle brown rumble underneath
    const deepSrc = ctx.createBufferSource();
    deepSrc.buffer = createNoiseBuffer(ctx, 'brown', 5);
    deepSrc.loop = true;
    const deepFilter = ctx.createBiquadFilter();
    deepFilter.type = 'lowpass';
    deepFilter.frequency.value = 320;
    const deepGain = ctx.createGain();
    deepGain.gain.value = 0.35;
    deepSrc.connect(deepFilter).connect(deepGain).connect(dest);
    deepSrc.start();

    cleanups.push(() => {
      src.stop();
      src.disconnect();
      lfo.stop();
      lfo.disconnect();
      deepSrc.stop();
      deepSrc.disconnect();
      bedGain.disconnect();
      deepGain.disconnect();
    });

    return () => cleanups.forEach((fn) => fn());
  }

  private startLofi(ctx: AudioContext, dest: GainNode): StopFn {
    // Master warm low-pass bus (F50: prevents harsh digital tones)
    const warmBus = ctx.createBiquadFilter();
    warmBus.type = 'lowpass';
    warmBus.frequency.value = 920;
    warmBus.Q.value = 0.7;
    warmBus.connect(dest);

    // Subtle warm vinyl hiss bed
    const vinylSrc = ctx.createBufferSource();
    vinylSrc.buffer = createNoiseBuffer(ctx, 'pink', 4);
    vinylSrc.loop = true;
    const vinylFilter = ctx.createBiquadFilter();
    vinylFilter.type = 'bandpass';
    vinylFilter.frequency.value = 2200;
    vinylFilter.Q.value = 1.2;
    const vinylGain = ctx.createGain();
    vinylGain.gain.value = 0.035;
    vinylSrc.connect(vinylFilter).connect(vinylGain).connect(dest);
    vinylSrc.start();

    // Cozy jazz 7th/9th chord progression: Cmaj7 -> Am7 -> Dm9 -> G13
    const chords: number[][] = [
      [261.63, 329.63, 392.0, 493.88], // Cmaj7
      [220.0, 261.63, 329.63, 392.0], // Am7
      [293.66, 349.23, 440.0, 523.25], // Dm7
      [196.0, 293.66, 329.63, 392.0], // G6
    ];

    let step = 0;
    const activeOscs = new Set<OscillatorNode>();

    const triggerChord = () => {
      const notes = chords[step % chords.length]!;
      step += 1;
      const now = ctx.currentTime;

      notes.forEach((freq, idx) => {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        osc1.type = 'triangle';
        osc2.type = 'sine';
        osc1.frequency.value = freq;
        osc2.frequency.value = freq * 1.0025; // gentle warm detune

        const noteGain = ctx.createGain();
        const startOffset = idx * 0.045; // soft strum feel
        const t0 = now + startOffset;
        noteGain.gain.setValueAtTime(0.0001, t0);
        noteGain.gain.linearRampToValueAtTime(0.09, t0 + 0.18);
        noteGain.gain.exponentialRampToValueAtTime(0.04, t0 + 1.4);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.4);

        osc1.connect(noteGain);
        osc2.connect(noteGain);
        noteGain.connect(warmBus);

        activeOscs.add(osc1);
        activeOscs.add(osc2);

        osc1.start(t0);
        osc2.start(t0);
        osc1.stop(t0 + 3.5);
        osc2.stop(t0 + 3.5);

        osc1.onended = () => {
          activeOscs.delete(osc1);
          osc1.disconnect();
        };
        osc2.onended = () => {
          activeOscs.delete(osc2);
          osc2.disconnect();
          noteGain.disconnect();
        };
      });
    };

    triggerChord();
    const intervalId = window.setInterval(triggerChord, 3400);

    return () => {
      window.clearInterval(intervalId);
      activeOscs.forEach((osc) => {
        try {
          osc.stop();
          osc.disconnect();
        } catch {
          // Ignore already-stopped oscillators
        }
      });
      activeOscs.clear();
      vinylSrc.stop();
      vinylSrc.disconnect();
      vinylGain.disconnect();
      warmBus.disconnect();
    };
  }

  private startMeadow(ctx: AudioContext, dest: GainNode): StopFn {
    const src = ctx.createBufferSource();
    src.buffer = createNoiseBuffer(ctx, 'pink', 6);
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 540;
    filter.Q.value = 1.4;

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.11;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 220;
    lfo.connect(lfoGain).connect(filter.frequency);

    const windGain = ctx.createGain();
    windGain.gain.value = 0.55;

    // Gentle warm harmonic drone (C3 + G3)
    const pad1 = ctx.createOscillator();
    const pad2 = ctx.createOscillator();
    pad1.type = 'sine';
    pad2.type = 'sine';
    pad1.frequency.value = 130.81;
    pad2.frequency.value = 196.0;
    const padGain = ctx.createGain();
    padGain.gain.value = 0.045;

    src.connect(filter).connect(windGain).connect(dest);
    pad1.connect(padGain);
    pad2.connect(padGain);
    padGain.connect(dest);

    src.start();
    lfo.start();
    pad1.start();
    pad2.start();

    return () => {
      src.stop();
      src.disconnect();
      lfo.stop();
      lfo.disconnect();
      pad1.stop();
      pad1.disconnect();
      pad2.stop();
      pad2.disconnect();
      windGain.disconnect();
      padGain.disconnect();
    };
  }

  private startFocus(ctx: AudioContext, dest: GainNode): StopFn {
    const src = ctx.createBufferSource();
    src.buffer = createNoiseBuffer(ctx, 'brown', 6);
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 460;
    filter.Q.value = 0.5;

    const gain = ctx.createGain();
    gain.gain.value = 0.75;

    src.connect(filter).connect(gain).connect(dest);
    src.start();

    return () => {
      src.stop();
      src.disconnect();
      gain.disconnect();
    };
  }
}

export const ambientEngine = new AmbientAudioEngine();
