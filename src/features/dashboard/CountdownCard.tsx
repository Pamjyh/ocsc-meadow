import { useEffect, useState } from 'react';
import { computeCountdown } from '../../domain/countdown';
import { LiquidGlassIcon } from '../../ui/LiquidGlassIcon';

interface CountdownCardProps {
  examDateIso: string;
  studyCompleted: number;
  studyTotal: number;
  pdfCompleted: number;
  pdfTotal: number;
}

/**
 * Isolated 1-second timer component so DashboardView does not re-render
 * its 3-subject rollup and 4 subject cards every second (F4).
 */
export function CountdownCard({
  examDateIso,
  studyCompleted,
  studyTotal,
  pdfCompleted,
  pdfTotal,
}: CountdownCardProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const countdown = computeCountdown(examDateIso, nowMs);

  return (
    <div className="glass-card dash-countdown">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <LiquidGlassIcon name="clock" tone="amber" size="md" />
        <div>
          <div className="dash-countdown-label">นับถอยหลังสู่วันสอบจริง</div>
          <div className="dash-countdown-date">{countdown.targetThaiDate}</div>
        </div>
      </div>

      {countdown.isPast ? (
        <p style={{ color: 'var(--accent-meadow)', fontWeight: 600 }}>
          ถึงวันสอบแล้ว ขอให้ทำข้อสอบได้เต็มที่และผ่านฉลุยนะครับ!
        </p>
      ) : (
        <div className="dash-countdown-grid" aria-label="เวลานับถอยหลังวันสอบ">
          <div className="dash-time-box">
            <div className="dash-time-num">{countdown.days}</div>
            <div className="dash-time-unit">วัน</div>
          </div>
          <div className="dash-time-box">
            <div className="dash-time-num">
              {String(countdown.hours).padStart(2, '0')}
            </div>
            <div className="dash-time-unit">ชั่วโมง</div>
          </div>
          <div className="dash-time-box">
            <div className="dash-time-num">
              {String(countdown.minutes).padStart(2, '0')}
            </div>
            <div className="dash-time-unit">นาที</div>
          </div>
          <div className="dash-time-box">
            <div className="dash-time-num">
              {String(countdown.seconds).padStart(2, '0')}
            </div>
            <div className="dash-time-unit">วินาที</div>
          </div>
        </div>
      )}

      <div className="dash-official-meta">
        <span>
          อ่านเนื้อหาแล้ว {studyCompleted}/{studyTotal} บท
        </span>
        <span>
          ชุด PDF ทำแล้ว {pdfCompleted}/{pdfTotal} ชุด
        </span>
      </div>
    </div>
  );
}
