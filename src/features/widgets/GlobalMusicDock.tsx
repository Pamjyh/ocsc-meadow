import { getAmbientTrack } from './musicStore';
import type { AmbientPlayerState } from './widgetTypes';
import './widgets-cards.css';

interface GlobalMusicDockProps {
  audio: AmbientPlayerState;
  onTogglePlay: () => void;
  onPrevTrack: () => void;
  onNextTrack: () => void;
}

/**
 * Compact persistent Liquid Glass mini-bar mounted once in App.tsx (F21, F49).
 * Appears cleanly at bottom-left whenever background sound is playing so users
 * can pause or skip tracks on Study, Exams, and Exam Runner pages without clutter.
 */
export function GlobalMusicDock({
  audio,
  onTogglePlay,
  onPrevTrack,
  onNextTrack,
}: GlobalMusicDockProps) {
  if (!audio.isPlaying) return null;

  const track = getAmbientTrack(audio.trackId);

  return (
    <aside
      className="music-dock-root"
      aria-label="แถบควบคุมเสียงอ่านหนังสือ"
    >
      <div className="music-dock-pill ambient-dock-pill">
        <span className="music-dock-dot" aria-hidden="true" />
        <span className="music-dock-pill-main">
          <span aria-hidden="true">{track.emoji}</span>
          <span className="music-dock-pill-title">{track.title}</span>
        </span>
        <div className="ambient-dock-btns">
          <button
            type="button"
            className="ambient-dock-btn"
            onClick={onPrevTrack}
            title="เสียงก่อนหน้า"
            aria-label="เสียงก่อนหน้า"
          >
            ◀
          </button>
          <button
            type="button"
            className="ambient-dock-btn ambient-dock-btn--main"
            onClick={onTogglePlay}
            title="หยุดชั่วคราว"
            aria-label="หยุดเสียงชั่วคราว"
          >
            ⏸
          </button>
          <button
            type="button"
            className="ambient-dock-btn"
            onClick={onNextTrack}
            title="เสียงถัดไป"
            aria-label="เสียงถัดไป"
          >
            ▶
          </button>
        </div>
      </div>
    </aside>
  );
}
