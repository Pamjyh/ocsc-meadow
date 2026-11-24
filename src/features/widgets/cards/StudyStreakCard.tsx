import { useEffect, useMemo, useState } from 'react';
import {
  STREAK_STORAGE_KEY,
  buildHeatmapCells,
  computeStreakSummary,
  loadStudyActivity,
  recordStudyActivity,
  type StudyActivityMap,
} from '../streakStore';
import { showToast } from '../../../services/toast';
import { playUiSound } from '../../../services/uiSound';
import { launchConfetti } from '../../../ui/confetti';
import { getLocalDateKey } from '../widgetUtils';
import './StudyStreakCard.css';

const STREAK_MILESTONES = new Set([3, 7, 14, 21, 30, 50, 100]);

export function StudyStreakCard() {
  const [activity, setActivity] = useState<StudyActivityMap>(loadStudyActivity);
  const [todayKey, setTodayKey] = useState<string>(() => getLocalDateKey());

  // Keep heatmap & today check-in fresh across midnight and other browser tabs (F75)
  useEffect(() => {
    const refresh = () => {
      setActivity(loadStudyActivity());
      setTodayKey(getLocalDateKey());
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === STREAK_STORAGE_KEY) refresh();
    };
    window.addEventListener('ocsc-streak-updated', refresh);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('ocsc-streak-updated', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const summary = useMemo(() => computeStreakSummary(activity), [activity, todayKey]);
  const cells = useMemo(() => buildHeatmapCells(activity, 84), [activity, todayKey]);

  const handleCheckIn = () => {
    const wasFirstToday = summary.todayCount === 0;
    const nextMap = recordStudyActivity(1);
    const nextSummary = computeStreakSummary(nextMap);
    if (wasFirstToday && STREAK_MILESTONES.has(nextSummary.currentStreak)) {
      playUiSound('celebrate');
      launchConfetti({ intensity: 'soft' });
      showToast({
        message: `อ่านต่อเนื่องครบ ${nextSummary.currentStreak} วันแล้ว!`,
        detail: 'รักษาความสม่ำเสมอแบบนี้ไว้ เยี่ยมมากครับ',
        tone: 'celebrate',
      });
    } else {
      playUiSound('checkin');
      showToast({
        message: 'เช็กอินอ่านหนังสือวันนี้แล้ว',
        detail: `สะสมวันนี้ ${nextSummary.todayCount} กิจกรรม`,
        tone: 'success',
      });
    }
  };

  return (
    <div className="glass-card widget-card streak-card">
      <div className="widget-card-head">
        <div>
          <h2 className="widget-card-title">🔥 สถิติอ่านต่อเนื่อง (Study Streak)</h2>
          <p className="widget-card-sub">
            สะสมอัตโนมัติเมื่อทำข้อสอบ ทบทวนแฟลชการ์ด หรือเช็กอินอ่านเอง
          </p>
        </div>
        <button
          type="button"
          className={`widget-mini-pill${
            summary.todayCount > 0 ? ' widget-mini-pill--active' : ' widget-mini-pill--primary'
          }`}
          onClick={handleCheckIn}
        >
          {summary.todayCount > 0 ? `+ เช็กอินเพิ่ม (${summary.todayCount})` : '+ เช็กอินวันนี้'}
        </button>
      </div>

      <div className="streak-kpi-row">
        <div className="streak-kpi-box">
          <span className="streak-kpi-num">{summary.currentStreak}</span>
          <span className="streak-kpi-label">วันต่อเนื่อง</span>
        </div>
        <div className="streak-kpi-box">
          <span className="streak-kpi-num">{summary.bestStreak}</span>
          <span className="streak-kpi-label">สถิติสูงสุด</span>
        </div>
        <div className="streak-kpi-box">
          <span className="streak-kpi-num">{summary.totalActiveDays}</span>
          <span className="streak-kpi-label">วันที่อ่านทั้งหมด</span>
        </div>
      </div>

      <div
        className="streak-heatmap"
        role="img"
        aria-label={`ตารางความสม่ำเสมอ 12 สัปดาห์ล่าสุด อ่านต่อเนื่อง ${summary.currentStreak} วัน`}
      >
        {cells.map((cell) => (
          <span
            key={cell.dateKey}
            className={`streak-cell streak-cell--l${cell.level}`}
            title={`${cell.dateKey}: ${cell.count} กิจกรรม`}
          />
        ))}
      </div>

      <div className="streak-legend">
        <span>12 สัปดาห์ล่าสุด</span>
        <div className="streak-legend-scale" aria-hidden="true">
          <span>น้อย</span>
          <span className="streak-cell streak-cell--l0" />
          <span className="streak-cell streak-cell--l1" />
          <span className="streak-cell streak-cell--l2" />
          <span className="streak-cell streak-cell--l3" />
          <span className="streak-cell streak-cell--l4" />
          <span>มาก</span>
        </div>
      </div>
    </div>
  );
}
