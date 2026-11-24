import type { SubjectCode } from '../../domain/models';
import { readJson, writeJson } from '../../services/storage';
import type { StudyFlashcard } from './flashcardData';

export const CUSTOM_FLASHCARDS_STORAGE_KEY = 'ocsc_meadow_custom_cards_v1';

const MAX_CUSTOM_CARDS = 200;

export function isCustomFlashcardId(id: string): boolean {
  return id.startsWith('custom_');
}

/**
 * Replaces a user-selected Thai/English substring with `[ ..... ]` for Cloze Deletion.
 * Works natively on space-free Thai sentences without relying on word splitting.
 */
export function buildClozeFront(fullText: string, hiddenPhrase: string): string | null {
  const text = fullText.trim();
  const target = hiddenPhrase.trim();
  if (!text || target.length < 2) return null;
  const idx = text.toLowerCase().indexOf(target.toLowerCase());
  if (idx === -1) return null;
  const before = text.slice(0, idx);
  const after = text.slice(idx + target.length);
  return `${before}[ ..... ]${after}`;
}

export function loadCustomFlashcards(): StudyFlashcard[] {
  const raw = readJson<unknown>(CUSTOM_FLASHCARDS_STORAGE_KEY);
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is StudyFlashcard => {
    if (!item || typeof item !== 'object') return false;
    const r = item as Record<string, unknown>;
    return (
      typeof r.id === 'string' &&
      isCustomFlashcardId(r.id) &&
      typeof r.subjectCode === 'string' &&
      typeof r.tag === 'string' &&
      typeof r.front === 'string' &&
      typeof r.back === 'string'
    );
  });
}

export function addCustomClozeFlashcard(params: {
  subjectCode: SubjectCode;
  tag: string;
  fullText: string;
  hiddenPhrase: string;
  tip?: string;
}): { cards: StudyFlashcard[]; added: StudyFlashcard | null } {
  const front = buildClozeFront(params.fullText, params.hiddenPhrase);
  if (!front) {
    return { cards: loadCustomFlashcards(), added: null };
  }

  const existing = loadCustomFlashcards();
  const entry: StudyFlashcard = {
    id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    subjectCode: params.subjectCode,
    tag: params.tag.trim() || 'ไฮไลต์ส่วนตัว',
    front: `เติมคำในช่องว่าง:\n${front}`,
    back: `**${params.hiddenPhrase.trim()}**\n\n${params.fullText.trim()}`,
    ...(params.tip?.trim() ? { tip: params.tip.trim() } : {}),
  };

  const next = [entry, ...existing].slice(0, MAX_CUSTOM_CARDS);
  writeJson(CUSTOM_FLASHCARDS_STORAGE_KEY, next);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ocsc-custom-cards-updated'));
  }
  return { cards: next, added: entry };
}

export function removeCustomFlashcard(cardId: string): StudyFlashcard[] {
  const next = loadCustomFlashcards().filter((c) => c.id !== cardId);
  writeJson(CUSTOM_FLASHCARDS_STORAGE_KEY, next);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ocsc-custom-cards-updated'));
  }
  return next;
}
