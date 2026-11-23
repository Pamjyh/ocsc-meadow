import {
  createEmptyProgress,
  type ExamAttempt,
  type InProgressExam,
  type PdfNoteRecord,
  type ToggleRecord,
  type UserProgress,
} from './models';

const MAX_DETAILED_ATTEMPTS = 30;
const DEFAULT_MAX_SYNC_CHARS = 44_000;

export function mergeToggleMap(
  local: Record<string, ToggleRecord>,
  remote: Record<string, ToggleRecord>,
): Record<string, ToggleRecord> {
  const merged: Record<string, ToggleRecord> = { ...remote };
  for (const [id, record] of Object.entries(local)) {
    const existing = merged[id];
    if (!existing || record.updatedAt >= existing.updatedAt) {
      merged[id] = record;
    }
  }
  return merged;
}

export function mergePdfNotes(
  local: Record<string, PdfNoteRecord>,
  remote: Record<string, PdfNoteRecord>,
): Record<string, PdfNoteRecord> {
  const merged: Record<string, PdfNoteRecord> = { ...remote };
  for (const [id, note] of Object.entries(local)) {
    const existing = merged[id];
    if (!existing || note.updatedAt >= existing.updatedAt) {
      merged[id] = note;
    }
  }
  return merged;
}

export function mergeExamAttempts(
  local: readonly ExamAttempt[],
  remote: readonly ExamAttempt[],
): ExamAttempt[] {
  const byId = new Map<string, ExamAttempt>();
  for (const attempt of remote) {
    byId.set(attempt.attemptId, attempt);
  }
  for (const attempt of local) {
    const existing = byId.get(attempt.attemptId);
    // Prefer entry that still holds detailed per-question answers if same attemptId
    if (!existing || (attempt.answers && !existing.answers)) {
      byId.set(attempt.attemptId, attempt);
    }
  }
  return Array.from(byId.values()).sort((a, b) =>
    b.finishedAt.localeCompare(a.finishedAt),
  );
}

export function mergeInProgressExams(
  local: Record<string, InProgressExam>,
  remote: Record<string, InProgressExam>,
): Record<string, InProgressExam> {
  const merged: Record<string, InProgressExam> = { ...remote };
  for (const [examId, item] of Object.entries(local)) {
    const existing = merged[examId];
    if (!existing || item.updatedAt >= existing.updatedAt) {
      merged[examId] = item;
    }
  }
  return merged;
}

export function mergeUserProgress(
  local: UserProgress,
  remote: UserProgress | null,
): UserProgress {
  if (!remote) return local;
  const localIsNewer = local.updatedAt >= remote.updatedAt;

  return {
    version: 1,
    updatedAt: localIsNewer ? local.updatedAt : remote.updatedAt,
    completedStudies: mergeToggleMap(local.completedStudies, remote.completedStudies),
    bookmarkedStudies: mergeToggleMap(local.bookmarkedStudies, remote.bookmarkedStudies),
    lastVisitedStudyId: localIsNewer
      ? (local.lastVisitedStudyId ?? remote.lastVisitedStudyId)
      : (remote.lastVisitedStudyId ?? local.lastVisitedStudyId),
    completedPdfs: mergeToggleMap(local.completedPdfs, remote.completedPdfs),
    pdfNotes: mergePdfNotes(local.pdfNotes, remote.pdfNotes),
    examAttempts: mergeExamAttempts(local.examAttempts, remote.examAttempts),
    inProgressExams: mergeInProgressExams(local.inProgressExams, remote.inProgressExams),
    preferences: localIsNewer ? local.preferences : remote.preferences,
  };
}

/**
 * Ensures synced progress stays strictly below Google Sheets' 50,000-character
 * cell limit (F2): retains full per-question answers for latest 30 attempts,
 * compacts older attempts to summary metrics, and trims oldest if still oversized.
 */
export function compactProgressForSync(
  progress: UserProgress,
  maxChars = DEFAULT_MAX_SYNC_CHARS,
): UserProgress {
  const sortedAttempts = [...progress.examAttempts].sort((a, b) =>
    b.finishedAt.localeCompare(a.finishedAt),
  );

  const compactedAttempts: ExamAttempt[] = sortedAttempts.map((attempt, index) => {
    if (index < MAX_DETAILED_ATTEMPTS) return attempt;
    const { answers: _omitted, ...summaryOnly } = attempt;
    return summaryOnly;
  });

  const next: UserProgress = {
    ...progress,
    examAttempts: compactedAttempts,
  };

  // Secondary safety valve: strip answers from older detailed attempts if still > maxChars
  let serialized = JSON.stringify(next);
  if (serialized.length <= maxChars) return next;

  const trimmedAttempts = next.examAttempts.map((attempt) => {
    const { answers: _omitted, ...summaryOnly } = attempt;
    return summaryOnly;
  });
  let candidate: UserProgress = { ...next, examAttempts: trimmedAttempts };
  serialized = JSON.stringify(candidate);

  while (serialized.length > maxChars && candidate.examAttempts.length > 0) {
    candidate = {
      ...candidate,
      examAttempts: candidate.examAttempts.slice(0, -1),
    };
    serialized = JSON.stringify(candidate);
  }

  // Final safety cap: truncate long PDF notes if payload still exceeds maxChars (F4)
  if (serialized.length > maxChars) {
    const cappedNotes: Record<string, PdfNoteRecord> = {};
    for (const [id, note] of Object.entries(candidate.pdfNotes)) {
      cappedNotes[id] = { ...note, text: note.text.slice(0, 1000) };
    }
    candidate = { ...candidate, pdfNotes: cappedNotes };
  }

  return candidate;
}

export function parseUserProgress(raw: unknown): UserProgress | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (obj.version !== 1 || typeof obj.updatedAt !== 'string') return null;

  const base = createEmptyProgress(obj.updatedAt);
  return {
    version: 1,
    updatedAt: obj.updatedAt,
    completedStudies:
      obj.completedStudies && typeof obj.completedStudies === 'object'
        ? (obj.completedStudies as Record<string, ToggleRecord>)
        : base.completedStudies,
    bookmarkedStudies:
      obj.bookmarkedStudies && typeof obj.bookmarkedStudies === 'object'
        ? (obj.bookmarkedStudies as Record<string, ToggleRecord>)
        : base.bookmarkedStudies,
    lastVisitedStudyId:
      typeof obj.lastVisitedStudyId === 'string' ? obj.lastVisitedStudyId : null,
    completedPdfs:
      obj.completedPdfs && typeof obj.completedPdfs === 'object'
        ? (obj.completedPdfs as Record<string, ToggleRecord>)
        : base.completedPdfs,
    pdfNotes:
      obj.pdfNotes && typeof obj.pdfNotes === 'object'
        ? (obj.pdfNotes as Record<string, PdfNoteRecord>)
        : base.pdfNotes,
    examAttempts: Array.isArray(obj.examAttempts)
      ? (obj.examAttempts as ExamAttempt[])
      : base.examAttempts,
    inProgressExams:
      obj.inProgressExams && typeof obj.inProgressExams === 'object'
        ? (obj.inProgressExams as Record<string, InProgressExam>)
        : base.inProgressExams,
    preferences:
      obj.preferences && typeof obj.preferences === 'object'
        ? {
            ...base.preferences,
            ...(obj.preferences as Partial<UserProgress['preferences']>),
          }
        : base.preferences,
  };
}
