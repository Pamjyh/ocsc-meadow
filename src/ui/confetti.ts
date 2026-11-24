interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  vr: number;
  life: number;
  maxLife: number;
}

const PALETTE = ['#4ade80', '#60a5fa', '#fbbf24', '#f472b6', '#a78bfa', '#34d399'];

function shouldSkipMotion(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return true;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return true;
  if (document.querySelector('.focus-mode')) return true;
  return false;
}

/**
 * Lightweight zero-dependency Canvas 2D celebration confetti burst.
 * Automatically cleans up its temporary canvas after ~2.2 seconds.
 */
export function launchConfetti(options?: { intensity?: 'soft' | 'celebrate' }): void {
  if (shouldSkipMotion()) return;

  const intensity = options?.intensity ?? 'celebrate';
  const count = intensity === 'celebrate' ? 68 : 30;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = window.innerWidth;
  const height = window.innerHeight;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.position = 'fixed';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '90';
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  document.body.appendChild(canvas);

  const originX = width * 0.5;
  const originY = intensity === 'celebrate' ? height * 0.34 : height * 0.42;

  const particles: ConfettiParticle[] = Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
    const speed = (intensity === 'celebrate' ? 6.5 : 4.8) + Math.random() * 6.5;
    return {
      x: originX + (Math.random() - 0.5) * 80,
      y: originY + (Math.random() - 0.5) * 20,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.5,
      size: 6 + Math.random() * 5,
      color: PALETTE[i % PALETTE.length]!,
      rotation: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.24,
      life: 0,
      maxLife: 85 + Math.random() * 45,
    };
  });

  let rafId = 0;

  const tick = () => {
    ctx.clearRect(0, 0, width, height);
    let alive = 0;

    for (const p of particles) {
      p.life += 1;
      if (p.life >= p.maxLife) continue;
      alive += 1;

      p.vx *= 0.985;
      p.vy = p.vy * 0.985 + 0.24;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.vr;

      const alpha = Math.max(0, 1 - Math.pow(p.life / p.maxLife, 2));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size * 0.32, p.size, p.size * 0.64);
      ctx.restore();
    }

    if (alive > 0) {
      rafId = window.requestAnimationFrame(tick);
    } else {
      window.cancelAnimationFrame(rafId);
      canvas.remove();
    }
  };

  rafId = window.requestAnimationFrame(tick);
}
