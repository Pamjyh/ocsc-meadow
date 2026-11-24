import { readJson, writeJson } from '../../services/storage';

export const STUDY_HIGHLIGHTS_STORAGE_KEY = 'ocsc_meadow_study_highlights_v1';

export type HighlightColor = 'yellow' | 'mint' | 'pink';

export interface StudyHighlight {
  id: string;
  docId: string;
  text: string;
  color: HighlightColor;
  createdAt: string;
}

export type StudyHighlightsMap = Record<string, StudyHighlight[]>;

const MAX_HIGHLIGHT_CHARS = 420;
const MAX_HIGHLIGHTS_PER_DOC = 40;

function isHighlightColor(v: unknown): v is HighlightColor {
  return v === 'yellow' || v === 'mint' || v === 'pink';
}

export function loadAllStudyHighlights(): StudyHighlightsMap {
  const raw = readJson<unknown>(STUDY_HIGHLIGHTS_STORAGE_KEY);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const cleaned: StudyHighlightsMap = {};
  for (const [docId, list] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue;
    const valid = list.filter((item): item is StudyHighlight => {
      if (!item || typeof item !== 'object') return false;
      const r = item as Record<string, unknown>;
      return (
        typeof r.id === 'string' &&
        typeof r.docId === 'string' &&
        typeof r.text === 'string' &&
        r.text.trim().length > 0 &&
        isHighlightColor(r.color) &&
        typeof r.createdAt === 'string'
      );
    });
    if (valid.length > 0) {
      cleaned[docId] = valid;
    }
  }
  return cleaned;
}

export function normalizeHighlightText(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_HIGHLIGHT_CHARS);
}

export function addStudyHighlight(
  map: StudyHighlightsMap,
  docId: string,
  rawText: string,
  color: HighlightColor,
  nowIso = new Date().toISOString(),
): { next: StudyHighlightsMap; added: StudyHighlight | null; duplicate: boolean } {
  const text = normalizeHighlightText(rawText);
  if (text.length < 3) {
    return { next: map, added: null, duplicate: false };
  }

  const existing = map[docId] ?? [];
  if (existing.some((h) => h.text === text)) {
    return { next: map, added: null, duplicate: true };
  }

  const entry: StudyHighlight = {
    id: `hl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    docId,
    text,
    color,
    createdAt: nowIso,
  };

  const nextList = [entry, ...existing].slice(0, MAX_HIGHLIGHTS_PER_DOC);
  const next: StudyHighlightsMap = {
    ...map,
    [docId]: nextList,
  };
  writeJson(STUDY_HIGHLIGHTS_STORAGE_KEY, next);
  return { next, added: entry, duplicate: false };
}

export function removeStudyHighlight(
  map: StudyHighlightsMap,
  docId: string,
  highlightId: string,
): StudyHighlightsMap {
  const existing = map[docId] ?? [];
  const filtered = existing.filter((h) => h.id !== highlightId);
  const next: StudyHighlightsMap = { ...map };
  if (filtered.length > 0) {
    next[docId] = filtered;
  } else {
    delete next[docId];
  }
  writeJson(STUDY_HIGHLIGHTS_STORAGE_KEY, next);
  return next;
}
