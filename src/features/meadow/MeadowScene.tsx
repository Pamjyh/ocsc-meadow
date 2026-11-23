import { useEffect, useRef, useState } from 'react';
import { mountMeadowShader, type MeadowRendererHandle } from './meadowShader';
import { getSceneOption, type SceneId } from './sceneCatalog';
import { mountLivingSceneShader, type LivingSceneHandle } from './sceneShader';
import './MeadowScene.css';

interface MeadowSceneProps {
  /** Active background scene ID (meadow + 4 custom living anime scenes) */
  sceneId: SceneId;
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

export function MeadowScene({
  sceneId,
  dimmed,
  focusMode,
  hourFloat,
}: MeadowSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const meadowHandleRef = useRef<MeadowRendererHandle | null>(null);
  const livingHandleRef = useRef<LivingSceneHandle | null>(null);
  const [fallbackStatic, setFallbackStatic] = useState(false);

  const scene = getSceneOption(sceneId);
  const shouldPause = focusMode || prefersReducedMotion();

  useEffect(() => {
    setFallbackStatic(false);
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;

    if (scene.shaderMode === 0) {
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
          meadowHandleRef.current = handle;
        })
        .catch(() => {
          if (!cancelled) setFallbackStatic(true);
        });
    } else {
      mountLivingSceneShader(
        canvas,
        scene.previewUrl,
        scene.shaderMode,
        shouldPause,
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
          livingHandleRef.current = handle;
        })
        .catch(() => {
          if (!cancelled) setFallbackStatic(true);
        });
    }

    return () => {
      cancelled = true;
      meadowHandleRef.current?.destroy();
      meadowHandleRef.current = null;
      livingHandleRef.current?.destroy();
      livingHandleRef.current = null;
    };
    // Remount WebGL renderer when active scene changes; pause & hour update via handles
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId]);

  useEffect(() => {
    meadowHandleRef.current?.setPaused(shouldPause);
    livingHandleRef.current?.setPaused(shouldPause);
  }, [shouldPause]);

  useEffect(() => {
    meadowHandleRef.current?.setHour(hourFloat);
  }, [hourFloat]);

  return (
    <>
      <div className="meadow-scene" aria-hidden="true">
        {/* Static backdrop stays mounted underneath so scene switches never flash blank */}
        <img
          src={scene.previewUrl}
          alt=""
          className="meadow-backdrop-img"
          style={{ objectPosition: scene.objectPosition }}
          decoding="async"
        />
        {!fallbackStatic && (
          <canvas key={sceneId} ref={canvasRef} className="meadow-canvas" />
        )}
      </div>

      <div
        className={`meadow-paper-veil${dimmed ? ' meadow-paper-veil--active' : ''}`}
        aria-hidden="true"
      />
    </>
  );
}
