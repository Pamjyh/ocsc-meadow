export type AmbientTrackId =
  | 'lofi-chill'
  | 'midnight-piano'
  | 'cafe-rhodes'
  | 'deep-focus';

export type AmbientLayerKey = 'rain' | 'wind' | 'vinyl' | 'brown';

export interface AmbientLayers {
  rain: number;
  wind: number;
  vinyl: number;
  brown: number;
}

export interface AmbientTrackMeta {
  id: AmbientTrackId;
  emoji: string;
  title: string;
  subtitle: string;
  bpm: number;
}

export const AMBIENT_TRACKS: readonly AmbientTrackMeta[] = [
  {
    id: 'lofi-chill',
    emoji: '🎹',
    title: 'Lo-fi อ่านหนังสือ',
    subtitle: 'Rhodes อบอุ่น · กลอง Swing 76 BPM · เมโลดี้เบาๆ',
    bpm: 76,
  },
  {
    id: 'midnight-piano',
    emoji: '🌙',
    title: 'เปียโนยามดึก',
    subtitle: 'เปียโนนุ่มกังวานไร้กลอง สำหรับอ่านหนักและท่องจำ',
    bpm: 62,
  },
  {
    id: 'cafe-rhodes',
    emoji: '☕',
    title: 'คาเฟ่แจ๊ส',
    subtitle: 'คอร์ดแจ๊สอบอุ่น · เบสนุ่ม · จังหวะแปรงเบาๆ 84 BPM',
    bpm: 84,
  },
  {
    id: 'deep-focus',
    emoji: '🧘',
    title: 'โฟกัสลึก',
    subtitle: 'ฮาร์โมนิกแพดนุ่มลึกไร้จังหวะ เหมาะกับจับเวลาสอบ',
    bpm: 0,
  },
] as const;

export const AMBIENT_LAYERS_META: readonly {
  key: AmbientLayerKey;
  emoji: string;
  label: string;
}[] = [
  { key: 'rain', emoji: '🌧️', label: 'ฝนตก' },
  { key: 'wind', emoji: '🍃', label: 'ลมทุ่งหญ้า' },
  { key: 'vinyl', emoji: '📻', label: 'ไวนิล' },
  { key: 'brown', emoji: '🤎', label: 'โฟกัสเงียบ' },
] as const;

type StopFn = () => void;

function createNoiseBuffer(
  ctx: AudioContext,
  type: 'pink' | 'brown' | 'white' | 'crackle',
  durationSec = 5,
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
    } else if (type === 'crackle') {
      // Soft vinyl hiss + sparse warm analog dust pops
      let last = 0;
      for (let i = 0; i < length; i += 1) {
        const w = Math.random() * 2 - 1;
        last = last * 0.65 + w * 0.35;
        let sample = last * 0.08;
        if (Math.random() < 0.00018) {
          sample += (Math.random() * 2 - 1) * 0.72;
        }
        out[i] = sample;
      }
    } else if (type === 'brown') {
      let last = 0;
      for (let i = 0; i < length; i += 1) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        out[i] = last * 3.2;
      }
    } else {
      // Voss-McCartney smooth pink noise
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

/** Procedural stereo studio room reverb impulse response (cached once per AudioContext). */
function createReverbImpulse(ctx: AudioContext, durationSec = 2.2, decay = 2.6): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * durationSec);
  const impulse = ctx.createBuffer(2, length, sampleRate);
  for (let ch = 0; ch < 2; ch += 1) {
    const out = impulse.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < length; i += 1) {
      const env = Math.pow(1 - i / length, decay);
      const raw = (Math.random() * 2 - 1) * env;
      // Warm damping on reverb tail so highs roll off smoothly
      lp = lp * 0.62 + raw * 0.38;
      out[i] = lp;
    }
  }
  return impulse;
}

function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
}

/**
 * Studio-grade offline Web Audio API Lo-fi & Multi-Layer Ambient Engine:
 * - Master DynamicsCompressor + stereo procedural room ConvolverNode reverb
 * - Cached stereo noise & reverb buffers (F55)
 * - 4 musical tracks with warm Rhodes/Felt Piano timbre, swung Lo-fi drums, sub-bass & melody
 * - 4 independent live-mixable ambient layers (rain, wind, vinyl, brown noise)
 * - Soft fade-in/out & full node/timer teardown + ctx.suspend() on pause (F49, F52, F57)
 */
class AmbientAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private reverbSend: GainNode | null = null;
  private stopCurrentTrack: StopFn | null = null;
  private stopLayers: StopFn | null = null;
  private layerGains: Record<AmbientLayerKey, GainNode | null> = {
    rain: null,
    wind: null,
    vinyl: null,
    brown: null,
  };
  private pauseTimeout: ReturnType<typeof setTimeout> | null = null;
  private activeTrack: AmbientTrackId | null = null;
  private volume = 0.6;
  private layers: AmbientLayers = { rain: 0.25, wind: 0, vinyl: 0.18, brown: 0 };

  // Cached buffers per AudioContext (F55)
  private pinkBuffer: AudioBuffer | null = null;
  private brownBuffer: AudioBuffer | null = null;
  private crackleBuffer: AudioBuffer | null = null;
  private whiteBuffer: AudioBuffer | null = null;
  private reverbBuffer: AudioBuffer | null = null;

  private getBuffer(
    ctx: AudioContext,
    kind: 'pink' | 'brown' | 'crackle' | 'white',
  ): AudioBuffer {
    if (kind === 'pink') {
      this.pinkBuffer ??= createNoiseBuffer(ctx, 'pink', 5);
      return this.pinkBuffer;
    }
    if (kind === 'brown') {
      this.brownBuffer ??= createNoiseBuffer(ctx, 'brown', 6);
      return this.brownBuffer;
    }
    if (kind === 'crackle') {
      this.crackleBuffer ??= createNoiseBuffer(ctx, 'crackle', 6);
      return this.crackleBuffer;
    }
    this.whiteBuffer ??= createNoiseBuffer(ctx, 'white', 1.5);
    return this.whiteBuffer;
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      const ctx = new AudioCtx();
      this.ctx = ctx;

      // Master bus: compressor -> warm master gain -> destination
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 18;
      comp.ratio.value = 3.2;
      comp.attack.value = 0.01;
      comp.release.value = 0.22;

      const master = ctx.createGain();
      master.gain.value = 0;
      comp.connect(master).connect(ctx.destination);
      this.masterGain = master;

      // Music dry bus
      const musicBus = ctx.createGain();
      musicBus.gain.value = 0.88;
      musicBus.connect(comp);
      this.musicBus = musicBus;

      // Lush stereo room reverb send
      const convolver = ctx.createConvolver();
      this.reverbBuffer ??= createReverbImpulse(ctx, 2.2, 2.6);
      convolver.buffer = this.reverbBuffer;

      const reverbSend = ctx.createGain();
      reverbSend.gain.value = 0.26;
      const reverbFilter = ctx.createBiquadFilter();
      reverbFilter.type = 'lowpass';
      reverbFilter.frequency.value = 2400;
      reverbSend.connect(convolver).connect(reverbFilter).connect(comp);
      this.reverbSend = reverbSend;
    }
    return this.ctx;
  }

  public play(
    trackId: AmbientTrackId,
    volume = this.volume,
    layers = this.layers,
  ): boolean {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.musicBus || !this.reverbSend) return false;

    if (this.pauseTimeout) {
      clearTimeout(this.pauseTimeout);
      this.pauseTimeout = null;
    }

    this.volume = clamp01(volume);
    this.layers = {
      rain: clamp01(layers.rain),
      wind: clamp01(layers.wind),
      vinyl: clamp01(layers.vinyl),
      brown: clamp01(layers.brown),
    };

    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    if (!this.stopLayers) {
      this.stopLayers = this.startAmbientLayers(ctx, this.musicBus);
    } else {
      this.applyLayerGains(ctx);
    }

    if (this.activeTrack !== trackId || !this.stopCurrentTrack) {
      this.teardownActiveTrack();
      this.stopCurrentTrack = this.buildTrack(
        ctx,
        this.musicBus,
        this.reverbSend,
        trackId,
      );
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
      this.teardownLayers();
      if (this.ctx && this.ctx.state === 'running') {
        void this.ctx.suspend();
      }
    }, 220);
  }

  public setVolume(nextVolume: number): void {
    this.volume = clamp01(nextVolume);
    if (!this.ctx || !this.masterGain || !this.stopCurrentTrack) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(this.volume, now, 0.04);
  }

  public setLayerLevel(layer: AmbientLayerKey, level: number): void {
    this.layers = { ...this.layers, [layer]: clamp01(level) };
    if (!this.ctx || !this.stopLayers) return;
    this.applyLayerGains(this.ctx);
  }

  private applyLayerGains(ctx: AudioContext): void {
    const now = ctx.currentTime;
    const scales: Record<AmbientLayerKey, number> = {
      rain: 0.58,
      wind: 0.48,
      vinyl: 0.34,
      brown: 0.52,
    };
    (Object.keys(scales) as AmbientLayerKey[]).forEach((key) => {
      const node = this.layerGains[key];
      if (node) {
        node.gain.setTargetAtTime(this.layers[key] * scales[key], now, 0.06);
      }
    });
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

  private teardownLayers(): void {
    if (this.stopLayers) {
      try {
        this.stopLayers();
      } catch {
        // Ignore already-stopped nodes
      }
      this.stopLayers = null;
    }
    this.layerGains = { rain: null, wind: null, vinyl: null, brown: null };
  }

  private startAmbientLayers(ctx: AudioContext, dest: GainNode): StopFn {
    const cleanups: StopFn[] = [];

    // 1. Rain bed (filtered pink noise + gentle LFO breathing + warm low rumble)
    const rainGain = ctx.createGain();
    rainGain.gain.value = 0;
    rainGain.connect(dest);
    this.layerGains.rain = rainGain;

    const rainSrc = ctx.createBufferSource();
    rainSrc.buffer = this.getBuffer(ctx, 'pink');
    rainSrc.loop = true;
    const rainLp = ctx.createBiquadFilter();
    rainLp.type = 'lowpass';
    rainLp.frequency.value = 1280;
    rainLp.Q.value = 0.55;
    const rainLfo = ctx.createOscillator();
    rainLfo.frequency.value = 0.13;
    const rainLfoGain = ctx.createGain();
    rainLfoGain.gain.value = 240;
    rainLfo.connect(rainLfoGain).connect(rainLp.frequency);
    rainSrc.connect(rainLp).connect(rainGain);
    rainSrc.start();
    rainLfo.start();

    const rainDeep = ctx.createBufferSource();
    rainDeep.buffer = this.getBuffer(ctx, 'brown');
    rainDeep.loop = true;
    const rainDeepLp = ctx.createBiquadFilter();
    rainDeepLp.type = 'lowpass';
    rainDeepLp.frequency.value = 300;
    const rainDeepGain = ctx.createGain();
    rainDeepGain.gain.value = 0.42;
    rainDeep.connect(rainDeepLp).connect(rainDeepGain).connect(rainGain);
    rainDeep.start();

    cleanups.push(() => {
      rainSrc.stop();
      rainSrc.disconnect();
      rainLfo.stop();
      rainLfo.disconnect();
      rainDeep.stop();
      rainDeep.disconnect();
      rainGain.disconnect();
    });

    // 2. Meadow wind layer (bandpass pink noise + slow LFO sweep)
    const windGain = ctx.createGain();
    windGain.gain.value = 0;
    windGain.connect(dest);
    this.layerGains.wind = windGain;

    const windSrc = ctx.createBufferSource();
    windSrc.buffer = this.getBuffer(ctx, 'pink');
    windSrc.loop = true;
    const windBp = ctx.createBiquadFilter();
    windBp.type = 'bandpass';
    windBp.frequency.value = 520;
    windBp.Q.value = 1.45;
    const windLfo = ctx.createOscillator();
    windLfo.frequency.value = 0.11;
    const windLfoGain = ctx.createGain();
    windLfoGain.gain.value = 220;
    windLfo.connect(windLfoGain).connect(windBp.frequency);
    windSrc.connect(windBp).connect(windGain);
    windSrc.start();
    windLfo.start();

    cleanups.push(() => {
      windSrc.stop();
      windSrc.disconnect();
      windLfo.stop();
      windLfo.disconnect();
      windGain.disconnect();
    });

    // 3. Cozy Vinyl crackle & warmth layer
    const vinylGain = ctx.createGain();
    vinylGain.gain.value = 0;
    vinylGain.connect(dest);
    this.layerGains.vinyl = vinylGain;

    const vinylSrc = ctx.createBufferSource();
    vinylSrc.buffer = this.getBuffer(ctx, 'crackle');
    vinylSrc.loop = true;
    const vinylBp = ctx.createBiquadFilter();
    vinylBp.type = 'bandpass';
    vinylBp.frequency.value = 2400;
    vinylBp.Q.value = 0.85;
    vinylSrc.connect(vinylBp).connect(vinylGain);
    vinylSrc.start();

    cleanups.push(() => {
      vinylSrc.stop();
      vinylSrc.disconnect();
      vinylGain.disconnect();
    });

    // 4. Deep velvety Brown Noise focus layer
    const brownGain = ctx.createGain();
    brownGain.gain.value = 0;
    brownGain.connect(dest);
    this.layerGains.brown = brownGain;

    const brownSrc = ctx.createBufferSource();
    brownSrc.buffer = this.getBuffer(ctx, 'brown');
    brownSrc.loop = true;
    const brownLp = ctx.createBiquadFilter();
    brownLp.type = 'lowpass';
    brownLp.frequency.value = 440;
    brownLp.Q.value = 0.5;
    brownSrc.connect(brownLp).connect(brownGain);
    brownSrc.start();

    cleanups.push(() => {
      brownSrc.stop();
      brownSrc.disconnect();
      brownGain.disconnect();
    });

    this.applyLayerGains(ctx);
    return () => cleanups.forEach((fn) => fn());
  }

  private buildTrack(
    ctx: AudioContext,
    dest: GainNode,
    reverb: GainNode,
    trackId: AmbientTrackId,
  ): StopFn {
    switch (trackId) {
      case 'lofi-chill':
        return this.startLofiBeat(ctx, dest, reverb, 76, 'chill');
      case 'midnight-piano':
        return this.startMidnightPiano(ctx, dest, reverb);
      case 'cafe-rhodes':
        return this.startLofiBeat(ctx, dest, reverb, 84, 'cafe');
      case 'deep-focus':
        return this.startDeepFocusPad(ctx, dest, reverb);
    }
  }

  /** Warm Rhodes electric piano note (sine body + soft FM bell tine transient). */
  private playRhodesNote(
    ctx: AudioContext,
    bus: AudioNode,
    reverb: AudioNode,
    freq: number,
    time: number,
    duration: number,
    gainAmt: number,
    tineBrightness = 0.22,
  ): void {
    const body = ctx.createOscillator();
    const tine = ctx.createOscillator();
    const tineGain = ctx.createGain();
    const noteGain = ctx.createGain();

    body.type = 'sine';
    body.frequency.setValueAtTime(freq, time);

    tine.type = 'triangle';
    tine.frequency.setValueAtTime(freq * 2.002, time);
    tineGain.gain.setValueAtTime(gainAmt * tineBrightness, time);
    tineGain.gain.exponentialRampToValueAtTime(0.0001, time + Math.min(0.45, duration * 0.4));

    noteGain.gain.setValueAtTime(0.0001, time);
    noteGain.gain.linearRampToValueAtTime(gainAmt, time + 0.028);
    noteGain.gain.exponentialRampToValueAtTime(gainAmt * 0.42, time + duration * 0.45);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    body.connect(noteGain);
    tine.connect(tineGain).connect(noteGain);
    noteGain.connect(bus);
    noteGain.connect(reverb);

    body.start(time);
    tine.start(time);
    const stopAt = time + duration + 0.06;
    body.stop(stopAt);
    tine.stop(stopAt);
    body.onended = () => {
      body.disconnect();
      tine.disconnect();
      tineGain.disconnect();
      noteGain.disconnect();
    };
  }

  private playSubBass(
    ctx: AudioContext,
    bus: AudioNode,
    freq: number,
    time: number,
    duration: number,
    gainAmt: number,
  ): void {
    const osc = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    lp.type = 'lowpass';
    lp.frequency.value = 260;

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(gainAmt, time + 0.05);
    gain.gain.exponentialRampToValueAtTime(gainAmt * 0.65, time + duration * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(lp).connect(gain).connect(bus);
    osc.start(time);
    osc.stop(time + duration + 0.05);
    osc.onended = () => {
      osc.disconnect();
      lp.disconnect();
      gain.disconnect();
    };
  }

  private playSoftKick(ctx: AudioContext, bus: AudioNode, time: number, level: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(118, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.11);

    gain.gain.setValueAtTime(level, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.24);

    osc.connect(gain).connect(bus);
    osc.start(time);
    osc.stop(time + 0.26);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  private playBrushedSnare(
    ctx: AudioContext,
    bus: AudioNode,
    reverb: AudioNode,
    time: number,
    level: number,
  ): void {
    const src = ctx.createBufferSource();
    src.buffer = this.getBuffer(ctx, 'white');
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1450;
    bp.Q.value = 0.85;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(level, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.14);

    src.connect(bp).connect(gain);
    gain.connect(bus);
    gain.connect(reverb);
    src.start(time);
    src.stop(time + 0.16);
    src.onended = () => {
      src.disconnect();
      bp.disconnect();
      gain.disconnect();
    };
  }

  private playSoftHat(ctx: AudioContext, bus: AudioNode, time: number, level: number): void {
    const src = ctx.createBufferSource();
    src.buffer = this.getBuffer(ctx, 'white');
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 5400;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 9200;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(level, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);

    src.connect(hp).connect(lp).connect(gain).connect(bus);
    src.start(time);
    src.stop(time + 0.06);
    src.onended = () => {
      src.disconnect();
      hp.disconnect();
      lp.disconnect();
      gain.disconnect();
    };
  }

  /** Swung 8-bar Lo-fi & Cafe Jazz groove with Rhodes chords, bass, drums, and gentle melody. */
  private startLofiBeat(
    ctx: AudioContext,
    dest: GainNode,
    reverb: GainNode,
    bpm: number,
    style: 'chill' | 'cafe',
  ): StopFn {
    const warmBus = ctx.createBiquadFilter();
    warmBus.type = 'lowpass';
    warmBus.frequency.value = style === 'chill' ? 1650 : 2150;
    warmBus.Q.value = 0.55;
    warmBus.connect(dest);

    const drumBus = ctx.createGain();
    drumBus.gain.value = style === 'chill' ? 0.52 : 0.44;
    drumBus.connect(warmBus);

    // 8-bar Jazz chord voicings + root bass + gentle pentatonic melody pool
    const chords: { bass: number; notes: number[] }[] =
      style === 'chill'
        ? [
            { bass: 130.81, notes: [261.63, 329.63, 392.0, 493.88, 587.33] }, // Cmaj9
            { bass: 110.0, notes: [220.0, 261.63, 329.63, 392.0, 493.88] }, // Am9
            { bass: 146.83, notes: [261.63, 329.63, 349.23, 440.0, 523.25] }, // Dm9
            { bass: 98.0, notes: [246.94, 293.66, 329.63, 392.0, 440.0] }, // G13
            { bass: 87.31, notes: [220.0, 261.63, 329.63, 392.0, 440.0] }, // Fmaj9
            { bass: 82.41, notes: [246.94, 293.66, 329.63, 392.0, 493.88] }, // Em7
            { bass: 146.83, notes: [261.63, 329.63, 349.23, 440.0] }, // Dm9
            { bass: 98.0, notes: [246.94, 293.66, 349.23, 440.0] }, // G9
          ]
        : [
            { bass: 146.83, notes: [293.66, 369.99, 440.0, 554.37, 659.25] }, // Dmaj9
            { bass: 123.47, notes: [246.94, 293.66, 369.99, 440.0, 554.37] }, // Bm9
            { bass: 164.81, notes: [293.66, 369.99, 392.0, 493.88, 587.33] }, // Em9
            { bass: 110.0, notes: [277.18, 329.63, 369.99, 440.0, 493.88] }, // A13
            { bass: 98.0, notes: [246.94, 293.66, 369.99, 440.0, 493.88] }, // Gmaj9
            { bass: 92.5, notes: [220.0, 277.18, 329.63, 440.0] }, // F#m7
            { bass: 164.81, notes: [293.66, 369.99, 392.0, 493.88] }, // Em9
            { bass: 110.0, notes: [277.18, 329.63, 392.0, 493.88] }, // A9
          ];

    const melodyPool =
      style === 'chill'
        ? [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5] // C major pentatonic
        : [587.33, 659.25, 739.99, 880.0, 987.77, 1174.66]; // D major pentatonic

    const eighthSec = 60 / bpm / 2;
    const swingRatio = 0.14; // classic lazy 57% Lo-fi swing
    let stepIndex = 0;
    let nextStepTime = ctx.currentTime + 0.03;
    let stopped = false;

    const scheduleStep = (step: number, when: number) => {
      const bar = Math.floor(step / 8);
      const beat8 = step % 8; // 0..7 eighth-notes per 4/4 bar
      const chord = chords[bar % chords.length]!;

      // Downbeat: warm Rhodes chord strum + sub-bass
      if (beat8 === 0) {
        chord.notes.forEach((freq, idx) => {
          this.playRhodesNote(
            ctx,
            warmBus,
            reverb,
            freq,
            when + idx * 0.032,
            eighthSec * 7.6,
            0.072,
            style === 'cafe' ? 0.28 : 0.18,
          );
        });
        this.playSubBass(ctx, warmBus, chord.bass, when, eighthSec * 7.2, 0.16);
      }

      // Gentle chord re-voicing / pickup on beat 4-and every other bar
      if (beat8 === 6 && bar % 2 === 1) {
        this.playRhodesNote(
          ctx,
          warmBus,
          reverb,
          chord.notes[chord.notes.length - 1]!,
          when,
          eighthSec * 1.9,
          0.048,
          0.22,
        );
      }

      // Soft improvised pentatonic top melody (sparse & musical)
      if ((beat8 === 2 || beat8 === 5 || beat8 === 7) && (step * 7 + bar * 3) % 5 < 2) {
        const note = melodyPool[(step * 3 + bar * 5) % melodyPool.length]!;
        this.playRhodesNote(
          ctx,
          warmBus,
          reverb,
          note,
          when + 0.012,
          eighthSec * 2.4,
          0.044,
          0.32,
        );
      }

      // Swung Lo-fi drum pattern
      if (beat8 === 0 || (beat8 === 5 && bar % 2 === 0) || (beat8 === 4 && style === 'cafe')) {
        this.playSoftKick(ctx, drumBus, when, style === 'chill' ? 0.28 : 0.22);
      }
      if (beat8 === 2 || beat8 === 6) {
        // Slightly lazy human micro-timing (+14ms) on snare
        this.playBrushedSnare(
          ctx,
          drumBus,
          reverb,
          when + 0.014,
          style === 'chill' ? 0.13 : 0.095,
        );
      }
      // Subtle swung closed hi-hats / brush ticks
      const hatVol = beat8 % 2 === 0 ? 0.055 : 0.032;
      this.playSoftHat(ctx, drumBus, when, hatVol);
    };

    const tickScheduler = (isInitial = false) => {
      if (stopped) return;
      if (!isInitial && ctx.state !== 'running') return;
      const horizon = ctx.currentTime + 0.14;
      while (nextStepTime < horizon) {
        const swingOffset = stepIndex % 2 === 1 ? eighthSec * swingRatio : 0;
        scheduleStep(stepIndex, nextStepTime + swingOffset);
        nextStepTime += eighthSec;
        stepIndex += 1;
      }
    };

    // Schedule first bar immediately (F57: zero silence gap on resume)
    tickScheduler(true);
    const timerId = window.setInterval(() => tickScheduler(false), 35);

    return () => {
      stopped = true;
      window.clearInterval(timerId);
      drumBus.disconnect();
      warmBus.disconnect();
    };
  }

  /** Solo Felt Piano: warm nostalgic arpeggios drenched in stereo reverb (no drums). */
  private startMidnightPiano(
    ctx: AudioContext,
    dest: GainNode,
    reverb: GainNode,
  ): StopFn {
    const feltBus = ctx.createBiquadFilter();
    feltBus.type = 'lowpass';
    feltBus.frequency.value = 1350;
    feltBus.Q.value = 0.5;
    feltBus.connect(dest);

    const arpeggios: number[][] = [
      [174.61, 261.63, 329.63, 392.0, 440.0, 523.25], // Fmaj9
      [196.0, 293.66, 329.63, 392.0, 493.88, 587.33], // G6
      [164.81, 246.94, 293.66, 392.0, 493.88, 659.25], // Em7
      [220.0, 261.63, 329.63, 392.0, 493.88, 523.25], // Am9
      [146.83, 220.0, 261.63, 329.63, 349.23, 440.0], // Dm9
      [196.0, 246.94, 293.66, 329.63, 392.0, 440.0], // G13
      [130.81, 196.0, 261.63, 329.63, 392.0, 493.88], // Cmaj7
      [130.81, 220.0, 261.63, 329.63, 392.0, 587.33], // C6/9
    ];

    const stepSec = 60 / 62 / 2; // gentle slow eighth-note arpeggios
    let step = 0;
    let nextTime = ctx.currentTime + 0.03;
    let stopped = false;

    const tick = (isInitial = false) => {
      if (stopped) return;
      if (!isInitial && ctx.state !== 'running') return;
      const horizon = ctx.currentTime + 0.16;
      while (nextTime < horizon) {
        const bar = Math.floor(step / 8);
        const pos = step % 8;
        const notes = arpeggios[bar % arpeggios.length]!;

        // Flowing felt-piano pattern: 0, 1, 2, 3, 4, 5, 3, 2
        const pattern = [0, 1, 2, 3, 4, 5, 3, 2];
        const idx = pattern[pos]!;
        const freq = notes[idx]!;
        const isRoot = pos === 0;
        this.playRhodesNote(
          ctx,
          feltBus,
          reverb,
          freq,
          nextTime,
          isRoot ? stepSec * 7.5 : stepSec * 4.2,
          isRoot ? 0.095 : 0.068,
          0.12, // soft felt hammer timbre
        );

        nextTime += stepSec;
        step += 1;
      }
    };

    tick(true);
    const timerId = window.setInterval(() => tick(false), 45);

    return () => {
      stopped = true;
      window.clearInterval(timerId);
      feltBus.disconnect();
    };
  }

  /** Deep Focus Pad: warm evolving harmonic drone with slow breathing filter (zero beat). */
  private startDeepFocusPad(
    ctx: AudioContext,
    dest: GainNode,
    reverb: GainNode,
  ): StopFn {
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 620;
    padFilter.Q.value = 0.7;

    const padGain = ctx.createGain();
    padGain.gain.value = 0.14;
    padFilter.connect(padGain);
    padGain.connect(dest);
    padGain.connect(reverb);

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(padFilter.frequency);
    lfo.start();

    const freqs = [130.81, 196.0, 293.66, 329.63, 392.0]; // Cmaj9 warm drone
    const oscs: OscillatorNode[] = freqs.map((f, idx) => {
      const osc = ctx.createOscillator();
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = f * (1 + (idx - 2) * 0.0012);
      const g = ctx.createGain();
      g.gain.value = idx === 0 ? 0.32 : 0.16;
      osc.connect(g).connect(padFilter);
      osc.start();
      return osc;
    });

    return () => {
      lfo.stop();
      lfo.disconnect();
      oscs.forEach((osc) => {
        try {
          osc.stop();
          osc.disconnect();
        } catch {
          // Ignore already-stopped oscillators
        }
      });
      padFilter.disconnect();
      padGain.disconnect();
    };
  }
}

export const ambientEngine = new AmbientAudioEngine();
