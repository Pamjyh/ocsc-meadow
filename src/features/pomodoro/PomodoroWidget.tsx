import { useEffect, useRef, useState } from 'react';
import { showToast } from '../../services/toast';
import { launchConfetti } from '../../ui/confetti';
import { LiquidGlassIcon } from '../../ui/LiquidGlassIcon';
import {
  GARDEN_SPECIES_META,
  loadGardenPlants,
  plantFocusSession,
  summarizeGarden,
} from '../widgets/focusGardenStore';
import { recordStudyActivity } from '../widgets/streakStore';
import { playGentleChime } from './chime';
import './PomodoroWidget.css';

type PomodoroPreset = 'focus' | 'short' | 'long';

const PRESET_MINUTES: Record<PomodoroPreset, { label: string; minutes: number }> = {
  focus: { label: 'โฟกัส 25', minutes: 25 },
  short: { label: 'พัก 5 น.', minutes: 5 },
  long: { label: 'พัก 15 น.', minutes: 15 },
};

interface PomodoroWidgetProps {
  muted: boolean;
  onToggleMute: () => void;
}

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function PomodoroWidget({ muted, onToggleMute }: PomodoroWidgetProps) {
  const [expanded, setExpanded] = useState(false);
  const [preset, setPreset] = useState<PomodoroPreset>('focus');
  const [customMinutes, setCustomMinutes] = useState<number>(25);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(25 * 60);
  const [endAtMs, setEndAtMs] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [completedSessions, setCompletedSessions] = useState(
    () => summarizeGarden(loadGardenPlants()).todayPlants,
  );
  const completedEndAtRef = useRef<number | null>(null);

  // Wall-clock driven timer (prevents background tab drift and StrictMode double side-effects - F1)
  useEffect(() => {
    if (!running || endAtMs === null) return;

    const syncClock = () => {
      const left = Math.max(0, Math.ceil((endAtMs - Date.now()) / 1000));
      setRemainingSeconds(left);
      if (left === 0 && completedEndAtRef.current !== endAtMs) {
        completedEndAtRef.current = endAtMs;
        setRunning(false);
        setEndAtMs(null);
        if (preset === 'focus') {
          const { plants, planted } = plantFocusSession(customMinutes);
          setCompletedSessions(summarizeGarden(plants).todayPlants);
          const meta = GARDEN_SPECIES_META[planted.species];
          recordStudyActivity(1);
          launchConfetti({ intensity: 'soft' });
          showToast({
            message: `ปลูก${meta.label}ลงสวนโฟกัสแล้ว! ${meta.emoji}`,
            detail: `โฟกัสครบ ${customMinutes} นาที (+1 Streak)`,
            tone: 'celebrate',
          });
        }
        if (!muted) playGentleChime();
      }
    };

    syncClock();
    const id = window.setInterval(syncClock, 500);
    return () => window.clearInterval(id);
  }, [running, endAtMs, muted, preset, customMinutes]);

  const selectPreset = (next: PomodoroPreset) => {
    const mins = PRESET_MINUTES[next].minutes;
    setPreset(next);
    setCustomMinutes(mins);
    setRemainingSeconds(mins * 60);
    setEndAtMs(null);
    setRunning(false);
  };

  const adjustMinutes = (delta: number) => {
    if (running) return;
    const nextMins = Math.min(90, Math.max(1, customMinutes + delta));
    setCustomMinutes(nextMins);
    setRemainingSeconds(nextMins * 60);
  };

  const handleToggleRun = () => {
    if (running) {
      setRunning(false);
      setEndAtMs(null);
      return;
    }
    const baseSeconds = remainingSeconds === 0 ? customMinutes * 60 : remainingSeconds;
    setRemainingSeconds(baseSeconds);
    setEndAtMs(Date.now() + baseSeconds * 1000);
    setRunning(true);
  };

  const handleReset = () => {
    setRunning(false);
    setEndAtMs(null);
    setRemainingSeconds(customMinutes * 60);
  };

  return (
    <aside className="pomo-root" aria-label="ตัวจับเวลาอ่านหนังสือ Pomodoro">
      {!expanded ? (
        <button
          type="button"
          className={`pomo-fab${running ? ' pomo-fab--running' : ''}`}
          onClick={() => setExpanded(true)}
        >
          <LiquidGlassIcon name="timer" tone={running ? 'meadow' : 'sky'} size="sm" shape="circle" />
          <span>{running ? formatClock(remainingSeconds) : 'จับเวลาอ่าน'}</span>
        </button>
      ) : (
        <div className="pomo-panel">
          <div className="pomo-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <LiquidGlassIcon name="timer" tone="meadow" size="sm" />
              <span className="pomo-title">Pomodoro อ่านหนังสือ</span>
            </div>
            <button
              type="button"
              className="pomo-icon-btn"
              onClick={() => setExpanded(false)}
              aria-label="พับเก็บตัวจับเวลา"
            >
              พับเก็บ
            </button>
          </div>

          <div className="pomo-presets">
            {(Object.keys(PRESET_MINUTES) as PomodoroPreset[]).map((key) => (
              <button
                key={key}
                type="button"
                className={`pomo-preset-btn${preset === key ? ' pomo-preset-btn--active' : ''}`}
                onClick={() => selectPreset(key)}
              >
                {PRESET_MINUTES[key].label}
              </button>
            ))}
          </div>

          <div className="pomo-clock-row">
            <button
              type="button"
              className="pomo-step-btn"
              onClick={() => adjustMinutes(-5)}
              disabled={running}
              aria-label="ลด 5 นาที"
            >
              −
            </button>
            <div className="pomo-clock">{formatClock(remainingSeconds)}</div>
            <button
              type="button"
              className="pomo-step-btn"
              onClick={() => adjustMinutes(5)}
              disabled={running}
              aria-label="เพิ่ม 5 นาที"
            >
              +
            </button>
          </div>

          <div className="pomo-actions">
            <button
              type="button"
              className="pomo-primary-btn"
              onClick={handleToggleRun}
            >
              {running ? 'พักชั่วคราว' : remainingSeconds === 0 ? 'เริ่มรอบใหม่' : 'เริ่มจับเวลา'}
            </button>
            <button type="button" className="pomo-secondary-btn" onClick={handleReset}>
              รีเซ็ต
            </button>
          </div>

          <div className="pomo-footer">
            <span>โฟกัสครบวันนี้: {completedSessions} รอบ</span>
            <button
              type="button"
              className="pomo-icon-btn"
              onClick={onToggleMute}
              aria-pressed={muted}
            >
              {muted ? 'เสียง: ปิด' : 'เสียง: เปิด'}
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
