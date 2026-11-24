export type UiSoundKind = 'tap' | 'flip' | 'checkin' | 'celebrate';

export const UI_SFX_STORAGE_KEY = 'ocsc_meadow_sfx_v1';

let sfxCtx: AudioContext | null = null;
let cachedNoiseBuffer: AudioBuffer | null = null;

export function isUiSfxEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(UI_SFX_STORAGE_KEY);
    if (raw === null) return true;
    return raw !== '0' && raw !== 'false';
  } catch {
    return true;
  }
}

export function setUiSfxEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(UI_SFX_STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // Ignore storage quota / private mode errors
  }
  window.dispatchEvent(new CustomEvent('ocsc-sfx-changed', { detail: enabled }));
}

function getSfxContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sfxCtx) {
    sfxCtx = new AudioCtx();
  }
  if (sfxCtx.state === 'suspended') {
    void sfxCtx.resume().catch(() => {});
  }
  return sfxCtx;
}

function getShortNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (cachedNoiseBuffer && cachedNoiseBuffer.sampleRate === ctx.sampleRate) {
    return cachedNoiseBuffer;
  }
  const len = Math.floor(ctx.sampleRate * 0.08);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  cachedNoiseBuffer = buf;
  return buf;
}

function playTone(
  ctx: AudioContext,
  type: OscillatorType,
  startFreq: number,
  endFreq: number,
  startTime: number,
  duration: number,
  peakGain: number,
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(startFreq, startTime);
  if (endFreq !== startFreq) {
    osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration);
  }
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.connect(gain).connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.015);
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };
}

/**
 * Plays subtle synthesized UI micro-sound effects using a standalone AudioContext
 * so pausing the Lo-fi ambient engine never mutes tactile UI clicks.
 */
export function playUiSound(kind: UiSoundKind): void {
  if (!isUiSfxEnabled()) return;
  try {
    const ctx = getSfxContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (kind === 'tap') {
      playTone(ctx, 'sine', 540, 260, now, 0.036, 0.065);
      return;
    }

    if (kind === 'flip') {
      // Soft card swish (bandpass noise burst + subtle low pop)
      const src = ctx.createBufferSource();
      src.buffer = getShortNoiseBuffer(ctx);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1600, now);
      bp.frequency.exponentialRampToValueAtTime(750, now + 0.065);
      bp.Q.value = 1.1;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.055, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

      src.connect(bp).connect(gain).connect(ctx.destination);
      src.start(now);
      src.stop(now + 0.08);
      src.onended = () => {
        src.disconnect();
        bp.disconnect();
        gain.disconnect();
      };
      return;
    }

    if (kind === 'checkin') {
      // Bright two-note positive chime (C6 -> E6)
      playTone(ctx, 'sine', 1046.5, 1046.5, now, 0.14, 0.06);
      playTone(ctx, 'triangle', 1318.5, 1318.5, now + 0.075, 0.19, 0.055);
      return;
    }

    // 'celebrate': warm ascending Cmaj9 arpeggio
    const notes = [523.25, 659.25, 783.99, 987.77, 1174.66];
    notes.forEach((freq, idx) => {
      playTone(ctx, 'triangle', freq, freq, now + idx * 0.065, 0.32, 0.065);
    });
  } catch {
    // Never block UI interaction if audio fails
  }
}
