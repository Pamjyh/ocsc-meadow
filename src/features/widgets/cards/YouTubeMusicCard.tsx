import { useState, type FormEvent } from 'react';
import { MUSIC_PRESETS } from '../musicStore';
import type { MusicSavedLink, MusicState } from '../widgetTypes';
import { isSafeHttpsUrl, makeWidgetId, parseYouTubeUrl } from '../widgetUtils';

interface YouTubeMusicCardProps {
  music: MusicState;
  onSelectTrack: (track: {
    title: string;
    originalUrl: string;
    embedType: 'video' | 'playlist';
    embedId: string;
  }) => void;
  onSaveLink: (link: MusicSavedLink) => void;
  onDeleteSavedLink: (id: string) => void;
  onOpenDock: () => void;
  onCloseDock: () => void;
}

export function YouTubeMusicCard({
  music,
  onSelectTrack,
  onSaveLink,
  onDeleteSavedLink,
  onOpenDock,
  onCloseDock,
}: YouTubeMusicCardProps) {
  const [urlInput, setUrlInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseYouTubeUrl(urlInput);
    if (!parsed) {
      setErrorMsg('วางลิงก์จาก YouTube Music หรือ YouTube ที่ถูกต้องนะครับ');
      return;
    }

    const label =
      titleInput.trim() ||
      (parsed.embedType === 'playlist' ? 'เพลย์ลิสต์ YouTube Music' : 'เพลงจาก YouTube Music');

    setErrorMsg(null);
    onSelectTrack({
      title: label,
      originalUrl: parsed.normalizedUrl,
      embedType: parsed.embedType,
      embedId: parsed.embedId,
    });

    if (!music.savedLinks.some((s) => s.embedId === parsed.embedId)) {
      onSaveLink({
        id: makeWidgetId('ytm'),
        title: label,
        originalUrl: parsed.normalizedUrl,
        embedType: parsed.embedType,
        embedId: parsed.embedId,
      });
    }

    setUrlInput('');
    setTitleInput('');
  };

  const safeExternalUrl = isSafeHttpsUrl(music.originalUrl) ? music.originalUrl : null;

  return (
    <div className="glass-card widget-card ytm-card">
      <div className="widget-card-head">
        <div>
          <h2 className="widget-card-title">🎵 YouTube Music</h2>
          <p className="widget-card-sub">เปิดฟังคลอได้ต่อเนื่องแม้สลับไปอ่านบทเรียน</p>
        </div>
        {music.isOpen ? (
          <button
            type="button"
            className="widget-mini-pill widget-mini-pill--active"
            onClick={onCloseDock}
          >
            กำลังเปิด · ปิด
          </button>
        ) : (
          <button
            type="button"
            className="widget-mini-pill widget-mini-pill--primary"
            onClick={onOpenDock}
          >
            ▶ เปิดฟัง
          </button>
        )}
      </div>

      <div className="ytm-now-row">
        <span className="ytm-now-label">เพลงปัจจุบัน:</span>
        <span className="ytm-now-title">{music.title}</span>
        {safeExternalUrl && (
          <a
            className="ytm-ext-link"
            href={safeExternalUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            เปิดในแอป ↗
          </a>
        )}
      </div>

      <div className="ytm-presets" aria-label="เพลงอ่านหนังสือแนะนำ">
        {MUSIC_PRESETS.map((preset) => {
          const isCurrent = music.isOpen && music.embedId === preset.embedId;
          return (
            <button
              key={preset.id}
              type="button"
              className={`ytm-preset-chip${isCurrent ? ' ytm-preset-chip--active' : ''}`}
              onClick={() =>
                onSelectTrack({
                  title: preset.title,
                  originalUrl: preset.originalUrl,
                  embedType: preset.embedType,
                  embedId: preset.embedId,
                })
              }
            >
              <span className="ytm-preset-name">{preset.title}</span>
              <span className="ytm-preset-sub">{preset.subtitle}</span>
            </button>
          );
        })}
      </div>

      <form className="ytm-form" onSubmit={handleSubmit}>
        <input
          type="url"
          className="widget-input"
          value={urlInput}
          onChange={(e) => {
            setUrlInput(e.target.value);
            if (errorMsg) setErrorMsg(null);
          }}
          placeholder="วางลิงก์ YouTube Music / YouTube..."
          aria-label="วางลิงก์เพลง YouTube Music"
        />
        <div className="ytm-form-row">
          <input
            type="text"
            className="widget-input"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            placeholder="ตั้งชื่อสั้นๆ (ไม่บังคับ)"
            maxLength={50}
            aria-label="ชื่อเพลงหรือเพลย์ลิสต์"
          />
          <button type="submit" className="widget-pill-btn widget-pill-btn--primary">
            เล่นเลย
          </button>
        </div>
        {errorMsg && <p className="widget-error-text">{errorMsg}</p>}
      </form>

      {music.savedLinks.length > 0 && (
        <div className="ytm-saved-list">
          <div className="ytm-saved-label">ลิงก์ที่บันทึกไว้</div>
          <div className="ytm-saved-chips">
            {music.savedLinks.map((saved) => (
              <div key={saved.id} className="ytm-saved-chip">
                <button
                  type="button"
                  className="ytm-saved-play"
                  onClick={() =>
                    onSelectTrack({
                      title: saved.title,
                      originalUrl: saved.originalUrl,
                      embedType: saved.embedType,
                      embedId: saved.embedId,
                    })
                  }
                >
                  ▶ {saved.title}
                </button>
                <button
                  type="button"
                  className="ytm-saved-del"
                  onClick={() => onDeleteSavedLink(saved.id)}
                  aria-label={`ลบ ${saved.title}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
