import { describe, expect, it } from 'vitest';
import { computePacingSummary, formatShortDuration } from '../pacingUtils';
import { summarizeErrorCauses } from '../reviewStore';

describe('pacingUtils & error cause summary', () => {
  it('computes target pace, average, slowest question, and over-pace count', () => {
    const questions = [
      { id: 'q1', order: 1 },
      { id: 'q2', order: 2 },
      { id: 'q3', order: 3 },
      { id: 'q4', order: 4 },
    ];
    // 4 minutes for 4 questions => target 60s/question, overPace > 81s
    const summary = computePacingSummary(
      questions,
      { q1: 40, q2: 120, q3: 55, q4: 25 },
      4,
    );

    expect(summary.targetSecondsPerQ).toBe(60);
    expect(summary.avgSecondsPerQ).toBe(60);
    expect(summary.overPaceCount).toBe(1);
    expect(summary.slowest).toEqual({ order: 2, seconds: 120 });
    expect(summary.rows[1]?.isOverPace).toBe(true);
    expect(summary.rows[0]?.isOverPace).toBe(false);
  });

  it('formats short Thai durations cleanly', () => {
    expect(formatShortDuration(45)).toBe('45 วิ');
    expect(formatShortDuration(60)).toBe('1 น.');
    expect(formatShortDuration(95)).toBe('1 น. 35 วิ');
  });

  it('summarizes error cause tags across mistake records', () => {
    const counts = summarizeErrorCauses([
      { errorTag: 'concept' },
      { errorTag: 'careless' },
      { errorTag: 'concept' },
      {},
      { errorTag: 'time' },
    ]);
    expect(counts).toEqual({
      concept: 2,
      careless: 1,
      misread: 0,
      time: 1,
    });
  });
});
