import { useEffect, useMemo, useState } from 'react';
import {
  FOCUS_GARDEN_STORAGE_KEY,
  GARDEN_SPECIES_META,
  loadGardenPlants,
  summarizeGarden,
  type GardenPlant,
} from '../focusGardenStore';
import { getLocalDateKey } from '../widgetUtils';
import './FocusGardenCard.css';

const MAX_VISIBLE_PLANTS = 24;

export function FocusGardenCard() {
  const [plants, setPlants] = useState<GardenPlant[]>(loadGardenPlants);
  const [todayKey, setTodayKey] = useState<string>(() => getLocalDateKey());

  useEffect(() => {
    const refresh = () => {
      setPlants(loadGardenPlants());
      setTodayKey(getLocalDateKey());
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === FOCUS_GARDEN_STORAGE_KEY) refresh();
    };
    window.addEventListener('ocsc-garden-updated', refresh);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('ocsc-garden-updated', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const summary = useMemo(() => summarizeGarden(plants, todayKey), [plants, todayKey]);
  const visiblePlants = useMemo(() => plants.slice(0, MAX_VISIBLE_PLANTS), [plants]);

  return (
    <div className="glass-card widget-card garden-card">
      <div className="widget-card-head">
        <div>
          <h2 className="widget-card-title">🌿 สวนโฟกัส (Focus Garden)</h2>
          <p className="widget-card-sub">
            ปลูกต้นไม้ 1 ต้นอัตโนมัติทุกครั้งที่จับเวลา Pomodoro โฟกัสครบ 1 รอบ
          </p>
        </div>
        <span className="garden-today-pill">
          วันนี้ +{summary.todayPlants} ต้น
        </span>
      </div>

      <div className="garden-kpi-row">
        <div className="garden-kpi-box">
          <span className="garden-kpi-num">{summary.totalPlants}</span>
          <span className="garden-kpi-label">ต้นไม้ในสวน</span>
        </div>
        <div className="garden-kpi-box">
          <span className="garden-kpi-num">{summary.totalMinutes}</span>
          <span className="garden-kpi-label">นาทีโฟกัสสะสม</span>
        </div>
        <div className="garden-kpi-box">
          <span className="garden-kpi-num">{summary.todayMinutes}</span>
          <span className="garden-kpi-label">นาทีวันนี้</span>
        </div>
      </div>

      <div
        className="garden-patch"
        role="img"
        aria-label={`สวนโฟกัสของคุณมีต้นไม้ทั้งหมด ${summary.totalPlants} ต้น`}
      >
        {visiblePlants.length === 0 ? (
          <div className="garden-empty">
            <span className="garden-empty-icon" aria-hidden="true">
              🌱
            </span>
            <p className="garden-empty-text">
              กดจับเวลา Pomodoro ที่มุมขวาล่างให้ครบ 1 รอบ เพื่อปลูกต้นไม้ต้นแรกในทุ่งหญ้าของคุณ
            </p>
          </div>
        ) : (
          <div className="garden-grid">
            {visiblePlants.map((plant, idx) => {
              const meta = GARDEN_SPECIES_META[plant.species];
              return (
                <span
                  key={plant.id}
                  className={`garden-plant${idx === 0 ? ' garden-plant--newest' : ''}`}
                  style={{ animationDelay: `${(idx % 6) * 0.35}s` }}
                  title={`${meta.label} · โฟกัส ${plant.minutes} นาที (${plant.dateKey})`}
                >
                  {meta.emoji}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {plants.length > MAX_VISIBLE_PLANTS && (
        <div className="garden-more-hint">
          แสดง {MAX_VISIBLE_PLANTS} ต้นล่าสุด จากทั้งหมด {plants.length} ต้น
        </div>
      )}
    </div>
  );
}
