/**
 * Synthesizes a soft two-note harmonic bell chime using the Web Audio API
 * (zero external MP3/audio files needed).
 */
export function playGentleChime(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const notes = [523.25, 659.25]; // C5 -> E5 soft interval
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.18);

      gain.gain.setValueAtTime(0.001, now + idx * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.14, now + idx * 0.18 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + idx * 0.18 + 1.1);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.18);
      osc.stop(now + idx * 0.18 + 1.15);
    });

    setTimeout(() => {
      void ctx.close().catch(() => undefined);
    }, 1600);
  } catch {
    // Ignore autoplay or restricted Web Audio errors
  }
}
