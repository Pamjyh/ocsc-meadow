import type { ChoiceKey, ExamQuestion, SubjectCode } from '../../domain/models';
import { readJson, writeJson } from '../../services/storage';
import {
  createInitialSrsState,
  scheduleSrsReview,
  type SrsCardState,
  type SrsRating,
} from './srsEngine';

export const MISTAKES_STORAGE_KEY = 'ocsc_meadow_mistakes_v1';
export const FLASHCARD_SRS_STORAGE_KEY = 'ocsc_meadow_srs_v1';

export type ErrorCauseTag = 'concept' | 'careless' | 'misread' | 'time';

export const ERROR_CAUSE_OPTIONS: readonly {
  tag: ErrorCauseTag;
  emoji: string;
  label: string;
}[] = [
  { tag: 'concept', emoji: '📚', label: 'จำหลัก/สูตรไม่ได้' },
  { tag: 'careless', emoji: '🧮', label: 'คิดเลข/สะเพร่า' },
  { tag: 'misread', emoji: '👀', label: 'อ่านโจทย์ไม่ครบ' },
  { tag: 'time', emoji: '⏱️', label: 'ทำไม่ทัน/รีบเดา' },
] as const;

export interface MistakeRecord {
  id: string;
  examId: string;
  examTitle: string;
  subjectCode: SubjectCode;
  order: number;
  promptMd: string;
  choices: Record<ChoiceKey, string>;
  correctChoice: ChoiceKey;
  lastPicked: ChoiceKey | null;
  explanationMd: string;
  wrongCount: number;
  lastWrongAt: string;
  srs: SrsCardState;
  errorTag?: ErrorCauseTag;
}

export type FlashcardSrsMap = Record<string, SrsCardState>;

export function loadMistakes(): MistakeRecord[] {
  const raw = readJson<unknown>(MISTAKES_STORAGE_KEY);
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is MistakeRecord =>
      Boolean(item) &&
      typeof item === 'object' &&
      typeof (item as MistakeRecord).id === 'string' &&
      typeof (item as MistakeRecord).promptMd === 'string',
  );
}

export function saveMistakes(records: MistakeRecord[]): boolean {
  return writeJson(MISTAKES_STORAGE_KEY, records);
}

/**
 * Snapshots wrong questions into the Mistake Bank on exam submission.
 * Previously wrong questions answered correctly get nudged forward via SRS (rating 3).
 */
export function recordExamMistakes(
  examId: string,
  examTitle: string,
  subjectCode: SubjectCode,
  questions: ExamQuestion[],
  answers: Record<string, ChoiceKey>,
  nowMs = Date.now(),
): MistakeRecord[] {
  const existing = loadMistakes();
  const byId = new Map<string, MistakeRecord>(existing.map((m) => [m.id, m]));
  const nowIso = new Date(nowMs).toISOString();

  for (const q of questions) {
    const picked = answers[q.id] ?? null;
    const isCorrect = picked === q.correctChoice;
    const prev = byId.get(q.id);

    if (!isCorrect) {
      byId.set(q.id, {
        id: q.id,
        examId,
        examTitle,
        subjectCode,
        order: q.order,
        promptMd: q.promptMd,
        choices: q.choices,
        correctChoice: q.correctChoice,
        lastPicked: picked,
        explanationMd: q.explanationMd,
        wrongCount: (prev?.wrongCount ?? 0) + 1,
        lastWrongAt: nowIso,
        srs: createInitialSrsState(nowMs),
        ...(prev?.errorTag ? { errorTag: prev.errorTag } : {}),
      });
    } else if (prev) {
      const { next } = scheduleSrsReview(prev.srs, 3, nowMs);
      byId.set(q.id, {
        ...prev,
        srs: next,
      });
    }
  }

  const nextList = Array.from(byId.values()).sort((a, b) =>
    b.lastWrongAt.localeCompare(a.lastWrongAt),
  );
  saveMistakes(nextList);
  return nextList;
}

export function rateMistakeRecord(
  id: string,
  rating: SrsRating,
  nowMs = Date.now(),
): MistakeRecord[] {
  const list = loadMistakes().map((m) => {
    if (m.id !== id) return m;
    const { next } = scheduleSrsReview(m.srs, rating, nowMs);
    return { ...m, srs: next };
  });
  saveMistakes(list);
  return list;
}

export function tagMistakeRecord(
  id: string,
  tag: ErrorCauseTag | undefined,
): MistakeRecord[] {
  const list = loadMistakes().map((m) => {
    if (m.id !== id) return m;
    if (!tag) {
      const { errorTag: _removed, ...rest } = m;
      return rest;
    }
    return { ...m, errorTag: tag };
  });
  saveMistakes(list);
  return list;
}

export function summarizeErrorCauses(
  records: readonly Pick<MistakeRecord, 'errorTag'>[],
): Record<ErrorCauseTag, number> {
  const counts: Record<ErrorCauseTag, number> = {
    concept: 0,
    careless: 0,
    misread: 0,
    time: 0,
  };
  for (const r of records) {
    if (r.errorTag && r.errorTag in counts) {
      counts[r.errorTag] += 1;
    }
  }
  return counts;
}

export function removeMistakeRecord(id: string): MistakeRecord[] {
  const list = loadMistakes().filter((m) => m.id !== id);
  saveMistakes(list);
  return list;
}

export function loadFlashcardSrsMap(): FlashcardSrsMap {
  const raw = readJson<unknown>(FLASHCARD_SRS_STORAGE_KEY);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as FlashcardSrsMap;
}

export function rateFlashcard(
  cardId: string,
  rating: SrsRating,
  nowMs = Date.now(),
): FlashcardSrsMap {
  const map = loadFlashcardSrsMap();
  const { next } = scheduleSrsReview(map[cardId], rating, nowMs);
  const updated = { ...map, [cardId]: next };
  writeJson(FLASHCARD_SRS_STORAGE_KEY, updated);
  return updated;
}

export function removeFlashcardSrs(cardId: string): FlashcardSrsMap {
  const map = loadFlashcardSrsMap();
  if (!(cardId in map)) return map;
  const { [cardId]: _removed, ...rest } = map;
  writeJson(FLASHCARD_SRS_STORAGE_KEY, rest);
  return rest;
}
