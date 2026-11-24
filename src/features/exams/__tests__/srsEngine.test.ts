import { describe, expect, it } from 'vitest';
import { buildHash, parseHash } from '../../../services/router';
import { OCSC_FLASHCARDS } from '../flashcardData';
import {
  formatSrsInterval,
  isSrsDue,
  scheduleSrsReview,
} from '../srsEngine';

describe('srsEngine & OCSC Flashcards', () => {
  it('provides 24 curated OCSC flashcards across law, english, and analytical subjects', () => {
    expect(OCSC_FLASHCARDS).toHaveLength(24);
    const ids = new Set(OCSC_FLASHCARDS.map((c) => c.id));
    expect(ids.size).toBe(24);
  });

  it('schedules spaced repetition intervals cleanly for ratings 1..4', () => {
    const t0 = 1_700_000_000_000;

    const rAgain = scheduleSrsReview(undefined, 1, t0);
    expect(rAgain.next.lapses).toBe(1);
    expect(rAgain.next.reps).toBe(0);
    expect(formatSrsInterval(rAgain.intervalMs)).toBe('10 นาที');

    const rGood1 = scheduleSrsReview(undefined, 3, t0);
    expect(rGood1.next.reps).toBe(1);
    expect(rGood1.next.stabilityDays).toBe(1);
    expect(isSrsDue(rGood1.next, t0)).toBe(false);
    expect(isSrsDue(rGood1.next, t0 + 25 * 60 * 60 * 1000)).toBe(true);

    const rGood2 = scheduleSrsReview(rGood1.next, 3, t0 + 25 * 60 * 60 * 1000);
    expect(rGood2.next.reps).toBe(2);
    expect(rGood2.next.stabilityDays).toBe(3);

    const rEasy = scheduleSrsReview(undefined, 4, t0);
    expect(rEasy.next.stabilityDays).toBe(4);
    expect(rEasy.next.difficulty).toBeLessThan(5);
  });

  it('routes #/exams/review cleanly', () => {
    expect(parseHash('#/exams/review')).toEqual({ name: 'exams', tab: 'review' });
    expect(buildHash({ name: 'exams', tab: 'review' })).toBe('#/exams/review');
  });
});
