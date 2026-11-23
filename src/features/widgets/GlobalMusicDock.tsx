import { buildMusicEmbedUrl } from './musicStore';
import type { MusicState } from './widgetTypes';
import { isSafeHttpsUrl } from './widgetUtils';
import './widgets-cards.css';

interface GlobalMusicDockProps {
  music: MusicState;
  onToggleCollapse: () => void;
  onClose: () => void;
}

/**
 * Single persistent YouTube Music player mounted once in App.tsx (F9, F19, F21).
 * Never unmounts the iframe when switching pages or collapsing to a mini pill,
 * so study music plays continuously across Dashboard, Study, Exams, and Exam Runner.
 */
export function GlobalMusicDock({
  music,
  onToggleCollapse,
  onClose,
}: GlobalMusicDockProps) {
  if (!music.isOpen) return null;

  const embedUrl = buildMusicEmbedUrl(music.embedType, music.embedId);
  if (!embedUrl) return null;

  const safeExternalUrl = isSafeHttpsUrl(music.originalUrl) ? music.originalUrl : null;

  return (
    <aside
      className={`music-dock-root${music.isCollapsed ? ' music-dock-root--collapsed' : ''}`}
      aria-label="เครื่องเล่นเพลง YouTube Music"
    >
      {music.isCollapsed && (
        <div className="music-dock-pill">
          <button
            type="button"
            className="music-dock-pill-main"
            onClick={onToggleCollapse}
            title="ขยายเครื่องเล่นเพลง"
          >
            <span className="music-dock-dot" aria-hidden="true" />
            <span className="music-dock-pill-title">{music.title}</span>
          </button>
          <button
            type="button"
            className="music-dock-pill-close"
            onClick={onClose}
            aria-label="ปิดเครื่องเล่นเพลง"
            title="ปิดเครื่องเล่น"
          >
            ✕
          </button>
        </div>
      )}

      <div
        className={`music-dock-panel${
          music.isCollapsed ? ' music-dock-panel--hidden' : ''
        }`}
        aria-hidden={music.isCollapsed}
      >
        <div className="music-dock-header">
          <div className="music-dock-title-wrap">
            <span className="music-dock-dot" aria-hidden="true" />
            <span className="music-dock-title">{music.title}</span>
          </div>
          <div className="music-dock-controls">
            <button
              type="button"
              className="music-dock-btn"
              onClick={onToggleCollapse}
              title="พับเก็บเป็นแถบเล็ก (เพลงยังเล่นต่อ)"
            >
              ย่อ
            </button>
            <button
              type="button"
              className="music-dock-btn music-dock-btn--close"
              onClick={onClose}
              aria-label="ปิดเครื่องเล่นเพลง"
              title="ปิดเพลง"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="music-dock-frame-wrap">
          <iframe
            className="music-dock-iframe"
            src={embedUrl}
            title={music.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>

        <div className="music-dock-footer">
          <span className="music-dock-hint">เล่นต่อเนื่องได้แม้สลับไปอ่านบทเรียน</span>
          {safeExternalUrl && (
            <a
              className="music-dock-ext-link"
              href={safeExternalUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              เปิดใน YouTube Music ↗
            </a>
          )}
        </div>
      </div>
    </aside>
  );
}
