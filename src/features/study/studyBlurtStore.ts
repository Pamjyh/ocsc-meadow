import { readJson, writeJson } from '../../services/storage';

export const STUDY_BLURT_STORAGE_KEY = 'ocsc_meadow_blurt_v1';

export interface BlurtRecord {
  text: string;
  updatedAt: string;
}

export type StudyBlurtMap = Record<string, BlurtRecord>;

const MAX_BLURT_CHARS = 4000;

export function loadAllBlurts(): StudyBlurtMap {
  const raw = readJson<unknown>(STUDY_BLURT_STORAGE_KEY);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const cleaned: StudyBlurtMap = {};
  for (const [docId, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (!entry || typeof entry !== 'object') continue;
    const r = entry as Record<string, unknown>;
    if (typeof r.text === 'string' && r.text.trim().length > 0 && typeof r.updatedAt === 'string') {
      cleaned[docId] = {
        text: r.text.slice(0, MAX_BLURT_CHARS),
        updatedAt: r.updatedAt,
      };
    }
  }
  return cleaned;
}

export function saveBlurtNote(
  map: StudyBlurtMap,
  docId: string,
  rawText: string,
  nowIso = new Date().toISOString(),
): StudyBlurtMap {
  const clipped = rawText.slice(0, MAX_BLURT_CHARS);
  const next: StudyBlurtMap = { ...map };
  if (clipped.trim().length === 0) {
    delete next[docId];
  } else {
    next[docId] = { text: clipped, updatedAt: nowIso };
  }
  writeJson(STUDY_BLURT_STORAGE_KEY, next);
  return next;
}
