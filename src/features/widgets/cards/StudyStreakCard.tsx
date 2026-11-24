import { useEffect, useMemo, useState } from 'react';
import {
  buildHeatmapCells,
  computeStreakSummary,
  loadStudyActivity,
  recordStudyActivity,
  type StudyActivityMap,
} from '../streakStore';
import './StudyStreakCard.css';

export function StudyStreakCard() {
  const [activity, setActivity] = useState<StudyActivityMap>(loadStudyActivity);

  useEffect(() => {
    const refresh = () => setActivity(loadStudyActivity());
    window.addEventListener('ocsc-streak-updated', refresh);
    return () => window.removeEventListener('ocsc-streak-updated', refresh);
  }, []);

  const summary = useMemo(() => computeStreakSummary(activity), [activity]);
  const cells = useMemo(() => buildHeatmapCells(activity, 84), [activity]);

  const handleCheckIn = () => {
    setActivity(recordStudyActivity(1));
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
