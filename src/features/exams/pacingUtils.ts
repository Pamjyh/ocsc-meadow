export interface QuestionPacingRow {
  questionId: string;
  order: number;
  seconds: number;
  isOverPace: boolean;
}

export interface ExamPacingSummary {
  targetSecondsPerQ: number;
  avgSecondsPerQ: number;
  overPaceCount: number;
  slowest: { order: number; seconds: number } | null;
  rows: QuestionPacingRow[];
}

export function formatShortDuration(sec: number): string {
  const safe = Math.max(0, Math.round(sec));
  if (safe < 60) return `${safe} วิ`;
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return s === 0 ? `${m} น.` : `${m} น. ${s} วิ`;
}

export function computePacingSummary(
  questions: readonly { id: string; order: number }[],
  secondsByQuestionId: Record<string, number>,
  durationMinutes: number,
): ExamPacingSummary {
  const count = Math.max(1, questions.length);
  const targetSecondsPerQ = Math.max(15, Math.round((durationMinutes * 60) / count));
  const overThreshold = Math.round(targetSecondsPerQ * 1.35);

  let totalSec = 0;
  let overPaceCount = 0;
  let slowest: { order: number; seconds: number } | null = null;

  const rows: QuestionPacingRow[] = questions.map((q) => {
    const seconds = Math.max(0, Math.round(secondsByQuestionId[q.id] ?? 0));
    totalSec += seconds;
    const isOverPace = seconds > overThreshold;
    if (isOverPace) overPaceCount += 1;
    if (seconds > 0 && (!slowest || seconds > slowest.seconds)) {
      slowest = { order: q.order, seconds };
    }
    return { questionId: q.id, order: q.order, seconds, isOverPace };
  });

  return {
    targetSecondsPerQ,
    avgSecondsPerQ: Math.round(totalSec / count),
    overPaceCount,
    slowest,
    rows,
  };
}
