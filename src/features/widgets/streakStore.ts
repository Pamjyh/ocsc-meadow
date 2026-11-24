import { readJson, writeJson } from '../../services/storage';
import { getLocalDateKey } from './widgetUtils';

export const STREAK_STORAGE_KEY = 'ocsc_meadow_streak_v1';

/** Map of local YYYY-MM-DD -> activity points earned that day */
export type StudyActivityMap = Record<string, number>;

export interface StreakSummary {
  currentStreak: number;
  bestStreak: number;
  totalActiveDays: number;
  todayCount: number;
}

export interface HeatmapCell {
  dateKey: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export function loadStudyActivity(): StudyActivityMap {
  const raw = readJson<unknown>(STREAK_STORAGE_KEY);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const cleaned: StudyActivityMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(k) && typeof v === 'number' && Number.isFinite(v) && v > 0) {
      cleaned[k] = Math.floor(v);
    }
  }
  return cleaned;
}

export function recordStudyActivity(points = 1, date = new Date()): StudyActivityMap {
  const map = loadStudyActivity();
  const key = getLocalDateKey(date);
  const next = {
    ...map,
    [key]: (map[key] ?? 0) + Math.max(1, Math.floor(points)),
  };
  writeJson(STREAK_STORAGE_KEY, next);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ocsc-streak-updated'));
  }
  return next;
}

function addDaysLocal(base: Date, deltaDays: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + deltaDays);
  return d;
}

export function computeStreakSummary(
  map: StudyActivityMap,
  today = new Date(),
): StreakSummary {
  const todayKey = getLocalDateKey(today);
  const todayCount = map[todayKey] ?? 0;

  // Current streak: count backwards from today (or yesterday if not yet checked in today)
  let currentStreak = 0;
  let offset = todayCount > 0 ? 0 : -1;
  while (true) {
    const key = getLocalDateKey(addDaysLocal(today, offset));
    if ((map[key] ?? 0) > 0) {
      currentStreak += 1;
      offset -= 1;
    } else {
      break;
    }
  }

  // Best streak across all recorded dates
  const activeDates = Object.keys(map)
    .filter((k) => (map[k] ?? 0) > 0)
    .sort();

  let bestStreak = 0;
  let run = 0;
  let prevMs: number | null = null;
  const DAY_MS = 24 * 60 * 60 * 1000;

  for (const key of activeDates) {
    const parts = key.split('-').map(Number);
    const ms = Date.UTC(parts[0]!, parts[1]! - 1, parts[2]!);
    if (prevMs !== null && Math.round((ms - prevMs) / DAY_MS) === 1) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > bestStreak) bestStreak = run;
    prevMs = ms;
  }

  return {
    currentStreak,
    bestStreak,
    totalActiveDays: activeDates.length,
    todayCount,
  };
}

export function buildHeatmapCells(
  map: StudyActivityMap,
  days = 84,
  today = new Date(),
): HeatmapCell[] {
  const cells: HeatmapCell[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = addDaysLocal(today, -i);
    const dateKey = getLocalDateKey(d);
    const count = map[dateKey] ?? 0;
    const level: 0 | 1 | 2 | 3 | 4 =
      count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 6 ? 3 : 4;
    cells.push({ dateKey, count, level });
  }
  return cells;
}
