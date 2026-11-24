export type SrsRating = 1 | 2 | 3 | 4; // 1 = ลืม, 2 = ยาก, 3 = พอได้, 4 = ง่าย

export interface SrsCardState {
  reps: number;
  lapses: number;
  /** Estimated memory stability in days */
  stabilityDays: number;
  /** Difficulty in [1, 10] */
  difficulty: number;
  /** Epoch ms when the card is next due for review */
  dueAt: number;
  lastReviewedAt: number;
}

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function createInitialSrsState(nowMs = Date.now()): SrsCardState {
  return {
    reps: 0,
    lapses: 0,
    stabilityDays: 0,
    difficulty: 5,
    dueAt: nowMs,
    lastReviewedAt: 0,
  };
}

/**
 * Lightweight FSRS-inspired Spaced Repetition scheduler:
 * - Rating 1 (Again/ลืม): 10-minute relearning step, shrinks stability
 * - Rating 2 (Hard/ยาก): gentle interval growth, nudges difficulty up
 * - Rating 3 (Good/พอได้): standard stability growth
 * - Rating 4 (Easy/ง่าย): accelerated stability growth, lowers difficulty
 */
export function scheduleSrsReview(
  prev: SrsCardState | undefined,
  rating: SrsRating,
  nowMs = Date.now(),
): { next: SrsCardState; intervalMs: number } {
  const cur = prev ?? createInitialSrsState(nowMs);

  if (rating === 1) {
    const intervalMs = 10 * MINUTE_MS;
    const nextStability = cur.stabilityDays > 0 ? Math.max(0.5, cur.stabilityDays * 0.4) : 0.5;
    return {
      intervalMs,
      next: {
        reps: 0,
        lapses: cur.lapses + 1,
        stabilityDays: Number(nextStability.toFixed(2)),
        difficulty: Math.min(10, Number((cur.difficulty + 0.8).toFixed(2))),
        dueAt: nowMs + intervalMs,
        lastReviewedAt: nowMs,
      },
    };
  }

  let nextDays: number;
  let nextDifficulty = cur.difficulty;

  if (cur.reps === 0) {
    nextDays = rating === 2 ? 0.5 : rating === 3 ? 1 : 4;
  } else if (cur.reps === 1) {
    nextDays = rating === 2 ? 2 : rating === 3 ? 3 : 7;
  } else {
    const diffFactor = Math.max(1.2, 2.6 - (cur.difficulty - 1) * 0.14);
    const multiplier =
      rating === 2 ? 1.2 : rating === 3 ? diffFactor : diffFactor * 1.35;
    nextDays = Math.min(180, Math.max(1, cur.stabilityDays * multiplier));
  }

  if (rating === 2) nextDifficulty = Math.min(10, cur.difficulty + 0.35);
  if (rating === 4) nextDifficulty = Math.max(1, cur.difficulty - 0.45);

  const roundedDays = Number(nextDays.toFixed(2));
  const intervalMs = Math.round(roundedDays * DAY_MS);

  return {
    intervalMs,
    next: {
      reps: cur.reps + 1,
      lapses: cur.lapses,
      stabilityDays: roundedDays,
      difficulty: Number(nextDifficulty.toFixed(2)),
      dueAt: nowMs + intervalMs,
      lastReviewedAt: nowMs,
    },
  };
}

export function isSrsDue(state: SrsCardState | undefined, nowMs = Date.now()): boolean {
  if (!state) return true;
  return state.dueAt <= nowMs;
}

export function formatSrsInterval(intervalMs: number): string {
  const mins = Math.round(intervalMs / MINUTE_MS);
  if (mins < 60) return `${Math.max(1, mins)} นาที`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} ชม.`;
  const days = Math.round(intervalMs / DAY_MS);
  if (days < 30) return `${days} วัน`;
  const months = Math.round(days / 30);
  return `${months} เดือน`;
}
