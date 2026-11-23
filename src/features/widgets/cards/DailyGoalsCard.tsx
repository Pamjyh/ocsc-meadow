import { useEffect, useMemo } from 'react';
import { getLocalDateKey } from '../widgetUtils';

interface GoalTask {
  id: string;
  text: string;
  done: boolean;
}

interface DailyGoalsCardProps {
  config: Record<string, unknown>;
  onUpdateConfig: (patch: Record<string, unknown>) => void;
}

const DEFAULT_TASKS: GoalTask[] = [
  { id: 't1', text: 'อ่านสรุปเนื้อหา 1 บท', done: false },
  { id: 't2', text: 'ฝึกทำโจทย์สั้นๆ 5 ข้อ', done: false },
  { id: 't3', text: 'พักสายตาและดื่มน้ำให้เพียงพอ', done: false },
];

function parseTasks(raw: unknown): GoalTask[] {
  if (!Array.isArray(raw)) return DEFAULT_TASKS;
  const parsed: GoalTask[] = [];
  for (let i = 0; i < 3; i += 1) {
    const item = raw[i] as Partial<GoalTask> | undefined;
    const fallback = DEFAULT_TASKS[i]!;
    parsed.push({
      id: typeof item?.id === 'string' ? item.id : fallback.id,
      text: typeof item?.text === 'string' ? item.text : fallback.text,
      done: typeof item?.done === 'boolean' ? item.done : false,
    });
  }
  return parsed;
}

export function DailyGoalsCard({ config, onUpdateConfig }: DailyGoalsCardProps) {
  const todayKey = getLocalDateKey();
  const savedDate = typeof config.lastDate === 'string' ? config.lastDate : '';
  const rawTasks = useMemo(() => parseTasks(config.tasks), [config.tasks]);

  // F15: Auto-uncheck tasks when local calendar day advances past midnight
  useEffect(() => {
    if (savedDate !== todayKey) {
      const resetTasks = rawTasks.map((t) => ({ ...t, done: false }));
      onUpdateConfig({ lastDate: todayKey, tasks: resetTasks });
    }
  }, [savedDate, todayKey, rawTasks, onUpdateConfig]);

  const tasks =
    savedDate === todayKey ? rawTasks : rawTasks.map((t) => ({ ...t, done: false }));
  const doneCount = tasks.filter((t) => t.done).length;

  const toggleTask = (idx: number) => {
    const next = tasks.map((t, i) => (i === idx ? { ...t, done: !t.done } : t));
    onUpdateConfig({ lastDate: todayKey, tasks: next });
  };

  const updateTaskText = (idx: number, text: string) => {
    const next = tasks.map((t, i) => (i === idx ? { ...t, text } : t));
    onUpdateConfig({ lastDate: todayKey, tasks: next });
  };

  return (
    <div className="glass-card widget-card goals-card">
      <div className="widget-card-head">
        <div>
          <h2 className="widget-card-title">✅ เป้าหมายวันนี้ (3 ข้อ)</h2>
          <p className="widget-card-sub">
            เก็บวันละ 3 อย่างเบาๆ รีเซ็ตติ๊กให้อัตโนมัติทุกวันใหม่
          </p>
        </div>
        <span
          className={`widget-mini-pill${
            doneCount === 3 ? ' widget-mini-pill--active' : ''
          }`}
        >
          {doneCount === 3 ? '🎉 ครบ 3/3 แล้ว!' : `${doneCount}/3 ข้อ`}
        </span>
      </div>

      <ul className="goals-list">
        {tasks.map((task, idx) => (
          <li
            key={task.id}
            className={`goals-item${task.done ? ' goals-item--done' : ''}`}
          >
            <button
              type="button"
              role="checkbox"
              aria-checked={task.done}
              aria-label={`ติ๊กเป้าหมายข้อที่ ${idx + 1}`}
              className={`goals-check${task.done ? ' goals-check--checked' : ''}`}
              onClick={() => toggleTask(idx)}
            >
              {task.done ? '✓' : ''}
            </button>
            <input
              type="text"
              className="goals-text-input"
              value={task.text}
              onChange={(e) => updateTaskText(idx, e.target.value)}
              placeholder={`เป้าหมายข้อที่ ${idx + 1}...`}
              maxLength={80}
              aria-label={`ข้อความเป้าหมายข้อที่ ${idx + 1}`}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
