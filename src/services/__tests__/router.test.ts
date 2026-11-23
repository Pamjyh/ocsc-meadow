import { describe, expect, it } from 'vitest';
import { buildHash, parseHash } from '../router';

describe('hash router', () => {
  it('parses dashboard routes', () => {
    expect(parseHash('')).toEqual({ name: 'dashboard' });
    expect(parseHash('#/')).toEqual({ name: 'dashboard' });
    expect(parseHash('#/unknown')).toEqual({ name: 'dashboard' });
  });

  it('parses study routes with and without docId', () => {
    expect(parseHash('#/study')).toEqual({ name: 'study', docId: null });
    expect(parseHash('#/study/doc_01')).toEqual({ name: 'study', docId: 'doc_01' });
  });

  it('parses exam tabs and exam runner routes', () => {
    expect(parseHash('#/exams')).toEqual({ name: 'exams', tab: 'interactive' });
    expect(parseHash('#/exams/pdf')).toEqual({ name: 'exams', tab: 'pdf' });
    expect(parseHash('#/exams/exam_math_01')).toEqual({
      name: 'exam-runner',
      examId: 'exam_math_01',
    });
  });

  it('round-trips buildHash -> parseHash', () => {
    const routes = [
      { name: 'dashboard' as const },
      { name: 'study' as const, docId: null },
      { name: 'study' as const, docId: 'doc_math_01' },
      { name: 'exams' as const, tab: 'interactive' as const },
      { name: 'exams' as const, tab: 'pdf' as const },
      { name: 'exam-runner' as const, examId: 'exam_law_01' },
    ];
    for (const r of routes) {
      expect(parseHash(buildHash(r))).toEqual(r);
    }
  });
});
