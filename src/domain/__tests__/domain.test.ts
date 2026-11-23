import { describe, expect, it } from 'vitest';
import { createEmptyProgress, type ExamAttempt } from '../models';
import {
  compactProgressForSync,
  mergeToggleMap,
  mergeUserProgress,
  parseUserProgress,
} from '../progressMerge';
import {
  normalizeDriveImageUrl,
  renderQuestionMarkdown,
  sanitizeStudyHtml,
} from '../sanitize';
import { computeOfficialSubjectRollup, gradeExam } from '../scoring';
import { SEED_BOOTSTRAP, SEED_EXAMS } from '../../data/seedSnapshot';

describe('OCSC scoring & 3-subject official rollup', () => {
  it('grades an exam and checks passPercent accurately', () => {
    const mathExam = SEED_EXAMS.exam_math_01!;
    const result = gradeExam(mathExam.exam, mathExam.questions, {
      q_math_1: 'C',
      q_math_2: 'B',
      q_math_3: 'C',
      q_math_4: 'B', // wrong
      q_math_5: 'A', // wrong
    });
    expect(result.score).toBe(3);
    expect(result.total).toBe(7);
    expect(result.percent).toBe(42.9);
    expect(result.passed).toBe(false);
  });

  it('combines analytical_math and analytical_thai into official Analytical >= 60% rollup', () => {
    const attempts: ExamAttempt[] = [
      {
        attemptId: 'a1',
        examId: 'exam_math_01',
        subjectCode: 'analytical_math',
        mode: 'timed',
        score: 2,
        total: 5, // 40% alone (would fail if separated)
        percent: 40,
        passed: false,
        durationSeconds: 300,
        finishedAt: '2026-11-22T10:00:00.000Z',
      },
      {
        attemptId: 'a2',
        examId: 'exam_thai_01',
        subjectCode: 'analytical_thai',
        mode: 'timed',
        score: 4,
        total: 4, // 100% -> combined 6/9 = 66.7% >= 60% PASS!
        percent: 100,
        passed: true,
        durationSeconds: 200,
        finishedAt: '2026-11-22T10:10:00.000Z',
      },
      {
        attemptId: 'a3',
        examId: 'exam_eng_01',
        subjectCode: 'english',
        mode: 'timed',
        score: 2,
        total: 4, // 50% >= 50% PASS!
        percent: 50,
        passed: true,
        durationSeconds: 180,
        finishedAt: '2026-11-22T10:20:00.000Z',
      },
    ];

    const rollup = computeOfficialSubjectRollup(
      attempts,
      SEED_BOOTSTRAP.config.passThresholds,
    );
    const analytical = rollup.find((r) => r.group === 'analytical')!;
    const english = rollup.find((r) => r.group === 'english')!;
    const law = rollup.find((r) => r.group === 'law')!;

    expect(analytical.averagePercent).toBe(66.7);
    expect(analytical.status).toBe('passed');
    expect(english.averagePercent).toBe(50);
    expect(english.status).toBe('passed');
    expect(law.status).toBe('not_started');
  });
});

describe('progressMerge LWW tombstones & payload compaction (F2, F3)', () => {
  it('prevents zombie uncheck when local unchecked after remote checked', () => {
    const remote = {
      study_math_01: { active: true, updatedAt: '2026-11-22T10:00:00.000Z' },
    };
    const local = {
      study_math_01: { active: false, updatedAt: '2026-11-22T10:05:00.000Z' },
    };
    const merged = mergeToggleMap(local, remote);
    expect(merged.study_math_01?.active).toBe(false);
  });

  it('compacts attempts beyond 30 detailed entries and stays below 44,000 chars', () => {
    const progress = createEmptyProgress('2026-11-22T12:00:00.000Z');
    for (let i = 0; i < 45; i++) {
      progress.examAttempts.push({
        attemptId: `att_${i}`,
        examId: 'exam_math_01',
        subjectCode: 'analytical_math',
        mode: 'timed',
        score: 4,
        total: 5,
        percent: 80,
        passed: true,
        durationSeconds: 420,
        finishedAt: new Date(Date.UTC(2026, 10, 1, 0, i)).toISOString(),
        answers: { q1: 'A', q2: 'B', q3: 'C', q4: 'D', q5: 'A' },
      });
    }

    const compacted = compactProgressForSync(progress);
    expect(compacted.examAttempts.length).toBe(45);
    expect(compacted.examAttempts[0]?.answers).toBeDefined();
    expect(compacted.examAttempts[35]?.answers).toBeUndefined();
    expect(JSON.stringify(compacted).length).toBeLessThan(44_000);
  });

  it('merges local and remote progress safely and rejects invalid schema', () => {
    const local = createEmptyProgress('2026-11-22T11:00:00.000Z');
    const remote = createEmptyProgress('2026-11-22T10:00:00.000Z');
    remote.bookmarkedStudies.study_law_01 = {
      active: true,
      updatedAt: '2026-11-22T09:50:00.000Z',
    };
    const merged = mergeUserProgress(local, remote);
    expect(merged.bookmarkedStudies.study_law_01?.active).toBe(true);
    expect(parseUserProgress({ version: 99 })).toBeNull();
  });
});

describe('sanitize & Markdown table renderer (F4)', () => {
  it('normalizes Google Drive image links to reliable thumbnail URLs', () => {
    expect(
      normalizeDriveImageUrl('https://drive.google.com/file/d/1AbCdEfGhIj/view?usp=sharing'),
    ).toBe('https://drive.google.com/thumbnail?id=1AbCdEfGhIj&sz=w1600');
    expect(
      normalizeDriveImageUrl('https://drive.google.com/uc?export=view&id=9ZyXwVu'),
    ).toBe('https://drive.google.com/thumbnail?id=9ZyXwVu&sz=w1600');
    expect(normalizeDriveImageUrl('javascript:alert(1)')).toBe('');
  });

  it('strips script tags, event handlers, and inline styles from Google Docs HTML', () => {
    const dirty =
      '<h2 style="font-family:Comic Sans">หัวข้อ</h2><script>alert(1)</script><p onclick="evil()">เนื้อหา</p><img src="https://drive.google.com/file/d/abc123/view" onerror="x()" />';
    const clean = sanitizeStudyHtml(dirty);
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('onclick');
    expect(clean).not.toContain('style=');
    expect(clean).toContain('<h2>หัวข้อ</h2>');
    expect(clean).toContain('https://drive.google.com/thumbnail?id=abc123&amp;sz=w1600');
  });

  it('renders Markdown tables safely while escaping raw HTML', () => {
    const md = 'โจทย์ <script>x</script>\n\n| ปี | ยอด |\n| --- | --- |\n| 2566 | **800** |';
    const html = renderQuestionMarkdown(md);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('<table><thead><tr><th>ปี</th><th>ยอด</th></tr></thead>');
    expect(html).toContain('<td><strong>800</strong></td>');
  });

  it('preserves math operator * inside **bold** without mangling into italic (F2)', () => {
    const html = renderQuestionMarkdown('กำหนด **a * b = 2a + b²** จงหา **5 * 4**');
    expect(html).toContain('<strong>a * b = 2a + b²</strong>');
    expect(html).toContain('<strong>5 * 4</strong>');
    expect(html).not.toContain('<em>');
  });
});
