import {
  AMBIENT_LAYERS_META,
  AMBIENT_TRACKS,
  type AmbientLayerKey,
  type AmbientTrackId,
} from '../ambientAudio';
import { getAmbientTrack } from '../musicStore';
import type { AmbientPlayerState } from '../widgetTypes';

interface AmbientPlayerCardProps {
  audio: AmbientPlayerState;
  onSelectTrack: (trackId: AmbientTrackId) => void;
  onTogglePlay: () => void;
  onPrevTrack: () => void;
  onNextTrack: () => void;
  onChangeVolume: (volume: number) => void;
  onChangeLayer: (layer: AmbientLayerKey, level: number) => void;
}

export function AmbientPlayerCard({
  audio,
  onSelectTrack,
  onTogglePlay,
  onPrevTrack,
  onNextTrack,
  onChangeVolume,
  onChangeLayer,
}: AmbientPlayerCardProps) {
  const current = getAmbientTrack(audio.trackId);

  return (
    <div className="glass-card widget-card ambient-card">
      <div className="widget-card-head">
        <div>
          <h2 className="widget-card-title">🎧 เสียงอ่านหนังสือ &amp; Lo-fi</h2>
          <p className="widget-card-sub">
            มิกซ์เพลง Lo-fi คู่กับเสียงฝน/ลมได้อิสระ ฟังได้แม้ไม่มีเน็ตและเล่นข้ามทุกหน้า
          </p>
        </div>
        <span
          className={`widget-mini-pill${
            audio.isPlaying ? ' widget-mini-pill--active' : ''
          }`}
        >
          {audio.isPlaying ? '● กำลังเล่น' : 'พักอยู่'}
        </span>
      </div>

      <div className="ambient-now-box">
        <div className="ambient-now-info">
          <span className="ambient-now-emoji" aria-hidden="true">
            {current.emoji}
          </span>
          <div className="ambient-now-text">
            <div className="ambient-now-title">{current.title}</div>
            <div className="ambient-now-sub">{current.subtitle}</div>
          </div>
        </div>

        <div className="ambient-transport">
          <button
            type="button"
            className="ambient-ctrl-btn"
            onClick={onPrevTrack}
            title="เพลงก่อนหน้า"
            aria-label="เพลงก่อนหน้า"
          >
            ◀
          </button>
          <button
            type="button"
            className="ambient-ctrl-btn ambient-ctrl-btn--play"
            onClick={onTogglePlay}
            title={audio.isPlaying ? 'หยุดชั่วคราว' : 'เริ่มเล่น'}
            aria-label={audio.isPlaying ? 'หยุดชั่วคราว' : 'เริ่มเล่น'}
          >
            {audio.isPlaying ? '⏸ หยุด' : '▶ เล่น'}
          </button>
          <button
            type="button"
            className="ambient-ctrl-btn"
            onClick={onNextTrack}
            title="เพลงถัดไป"
            aria-label="เพลงถัดไป"
          >
            ▶
          </button>
        </div>
      </div>

      <div className="ambient-volume-row">
        <span className="ambient-vol-label" aria-hidden="true">
          {audio.volume === 0 ? '🔇' : audio.volume < 0.45 ? '🔉' : '🔊'}
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(audio.volume * 100)}
          onChange={(e) => onChangeVolume(Number(e.target.value) / 100)}
          className="ambient-vol-slider"
          aria-label="ปรับระดับเสียงรวม"
        />
        <span className="ambient-vol-pct">{Math.round(audio.volume * 100)}%</span>
      </div>

      <div className="ambient-track-grid" role="list" aria-label="เลือกแนวเพลง">
        {AMBIENT_TRACKS.map((track) => {
          const isSelected = audio.trackId === track.id;
          return (
            <button
              key={track.id}
              type="button"
              role="listitem"
              className={`ambient-track-chip${
                isSelected ? ' ambient-track-chip--active' : ''
              }`}
              onClick={() => onSelectTrack(track.id)}
            >
              <span className="ambient-chip-emoji" aria-hidden="true">
                {track.emoji}
              </span>
              <span className="ambient-chip-text">
                <span className="ambient-chip-title">{track.title}</span>
                <span className="ambient-chip-sub">{track.subtitle}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="ambient-mixer-box" aria-label="มิกเซอร์เสียงธรรมชาติ">
        <div className="ambient-mixer-head">
          <span className="ambient-mixer-title">ซ้อนเสียงบรรยากาศ</span>
          <span className="ambient-mixer-hint">เปิดคลอพร้อมเพลงได้</span>
        </div>
        <div className="ambient-mixer-grid">
          {AMBIENT_LAYERS_META.map((layer) => {
            const val = audio.layers[layer.key];
            const isOn = val > 0.01;
            return (
              <div
                key={layer.key}
                className={`ambient-layer-row${
                  isOn ? ' ambient-layer-row--on' : ''
                }`}
              >
                <button
                  type="button"
                  className="ambient-layer-toggle"
                  aria-pressed={isOn}
                  onClick={() => onChangeLayer(layer.key, isOn ? 0 : 0.35)}
                >
                  <span aria-hidden="true">{layer.emoji}</span>
                  <span>{layer.label}</span>
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(val * 100)}
                  onChange={(e) =>
                    onChangeLayer(layer.key, Number(e.target.value) / 100)
                  }
                  className="ambient-layer-slider"
                  aria-label={`ระดับเสียง${layer.label}`}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
