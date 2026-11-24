import { useEffect, useState } from 'react';
import { SCENE_CATALOG, type SceneId } from '../features/meadow/sceneCatalog';
import { getAmbientTrack } from '../features/widgets/musicStore';
import type { AmbientPlayerState } from '../features/widgets/widgetTypes';
import './ZenFocusOverlay.css';

interface ZenFocusOverlayProps {
  sceneId: SceneId;
  audio: AmbientPlayerState;
  onSelectScene: (sceneId: SceneId) => void;
  onTogglePlay: () => void;
  onPrevTrack: () => void;
  onNextTrack: () => void;
  onExit: () => void;
}

function getBangkokTimeParts(now: Date): { timeText: string; dateText: string } {
  const timeText = new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);

  const dateText = new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now);

  return { timeText, dateText };
}

export function ZenFocusOverlay({
  sceneId,
  audio,
  onSelectScene,
  onTogglePlay,
  onPrevTrack,
  onNextTrack,
  onExit,
}: ZenFocusOverlayProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onExit();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onExit]);

  const { timeText, dateText } = getBangkokTimeParts(now);
  const track = getAmbientTrack(audio.trackId);

  return (
    <div className="zen-overlay" role="region" aria-label="โหมด Zen เต็มจอ">
      <div className="zen-top-bar">
        <div className="zen-scene-bar" role="group" aria-label="เปลี่ยนภาพพื้นหลัง">
          {SCENE_CATALOG.map((scene) => {
            const active = scene.id === sceneId;
            return (
              <button
                key={scene.id}
                type="button"
                className={`zen-scene-thumb-btn${active ? ' zen-scene-thumb-btn--active' : ''}`}
                aria-label={scene.ariaLabel}
                aria-pressed={active}
                onClick={() => onSelectScene(scene.id)}
              >
                <img src={scene.previewUrl} alt="" className="zen-scene-thumb-img" />
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="zen-exit-btn"
          onClick={onExit}
          aria-label="ออกจากโหมด Zen"
        >
          ออกจาก Zen (Esc)
        </button>
      </div>

      <div className="zen-center">
        <div className="zen-clock" aria-live="off">
          {timeText}
        </div>
        <div className="zen-date">{dateText}</div>
        <p className="zen-subtitle">หายใจลึกๆ แล้วโฟกัสกับตรงหน้าทีละก้าว</p>
      </div>

      <div className="zen-bottom-bar">
        <div className="zen-music-pill" role="group" aria-label="ควบคุมเสียงอ่านหนังสือ">
          <button
            type="button"
            className="zen-music-btn"
            onClick={onPrevTrack}
            aria-label="เพลงก่อนหน้า"
            title="เพลงก่อนหน้า"
          >
            ⏮
          </button>
          <button
            type="button"
            className="zen-music-btn zen-music-btn--play"
            onClick={onTogglePlay}
            aria-label={audio.isPlaying ? 'หยุดเพลงชั่วคราว' : 'เล่นเพลงอ่านหนังสือ'}
            title={audio.isPlaying ? 'หยุดเพลง' : 'เล่นเพลง'}
          >
            {audio.isPlaying ? '⏸' : '▶'}
          </button>
          <button
            type="button"
            className="zen-music-btn"
            onClick={onNextTrack}
            aria-label="เพลงถัดไป"
            title="เพลงถัดไป"
          >
            ⏭
          </button>
          <span className="zen-music-track">
            <span aria-hidden="true">{track.emoji}</span>
            <span>{track.title}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
