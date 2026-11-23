import { useEffect, useRef, useState } from 'react';
import { mountMeadowShader, type MeadowRendererHandle } from './meadowShader';
import './MeadowScene.css';

interface MeadowSceneProps {
  /** True on reading/exam views to soften the scene into a warm paper canvas */
  dimmed: boolean;
  /** True when Focus Mode is active to pause all decorative motion */
  focusMode: boolean;
  /** Effective decimal hour [0, 24) driving 24-hour sky & meadow lighting */
  hourFloat: number;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function MeadowScene({ dimmed, focusMode, hourFloat }: MeadowSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handleRef = useRef<MeadowRendererHandle | null>(null);
  const [fallbackStatic, setFallbackStatic] = useState(false);

  const shouldPause = focusMode || prefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    mountMeadowShader(
      canvas,
      './meadow-base.webp',
      './meadow-clouds.webp',
      './meadow-mask.webp',
      shouldPause,
      hourFloat,
    )
      .then((handle) => {
        if (cancelled) {
          handle?.destroy();
          return;
        }
        if (!handle) {
          setFallbackStatic(true);
          return;
        }
        handleRef.current = handle;
      })
      .catch(() => {
        if (!cancelled) setFallbackStatic(true);
      });

    return () => {
      cancelled = true;
      handleRef.current?.destroy();
      handleRef.current = null;
    };
    // Mount WebGL context once; pause & hour update via handle methods
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    handleRef.current?.setPaused(shouldPause);
  }, [shouldPause]);

  useEffect(() => {
    handleRef.current?.setHour(hourFloat);
  }, [hourFloat]);

  return (
    <>
      <div className="meadow-scene" aria-hidden="true">
        {fallbackStatic ? (
          <img
            src="./meadow-bg.webp"
            alt=""
            className="meadow-backdrop-img"
            decoding="async"
          />
        ) : (
          <canvas ref={canvasRef} className="meadow-canvas" />
        )}
      </div>

      <div
        className={`meadow-paper-veil${dimmed ? ' meadow-paper-veil--active' : ''}`}
        aria-hidden="true"
      />
    </>
  );
}
