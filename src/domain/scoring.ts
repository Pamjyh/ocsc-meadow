import type {
  ChoiceKey,
  ExamAttempt,
  ExamMeta,
  ExamQuestion,
  OfficialSubjectKey,
  PassThresholds,
  PdfExamItem,
  StudyItem,
  SubjectCode,
  UserProgress,
} from './models';

export interface QuestionGradeDetail {
  questionId: string;
  selected: ChoiceKey | null;
  correct: ChoiceKey;
  isCorrect: boolean;
}

export interface ExamGradeResult {
  score: number;
  total: number;
  percent: number;
  passed: boolean;
  details: QuestionGradeDetail[];
}

export function mapSubjectToOfficialGroup(code: SubjectCode): OfficialSubjectKey {
  if (code === 'english') return 'english';
  if (code === 'law') return 'law';
  return 'analytical';
}

export function getPassThresholdForSubject(
  code: SubjectCode,
  thresholds: PassThresholds,
): number {
  const group = mapSubjectToOfficialGroup(code);
  return thresholds[group];
}

export function gradeExam(
  exam: Pick<ExamMeta, 'passPercent'>,
  questions: readonly ExamQuestion[],
  answers: Record<string, ChoiceKey>,
): ExamGradeResult {
  const details: QuestionGradeDetail[] = questions.map((q) => {
    const selected = answers[q.id] ?? null;
    return {
      questionId: q.id,
      selected,
      correct: q.correctChoice,
      isCorrect: selected === q.correctChoice,
    };
  });

  const total = questions.length;
  const score = details.reduce((acc, item) => acc + (item.isCorrect ? 1 : 0), 0);
  const percent = total > 0 ? Math.round((score / total) * 1000) / 10 : 0;

  return {
    score,
    total,
    percent,
    passed: total > 0 && percent >= exam.passPercent,
    details,
  };
}

export interface OfficialSubjectStatus {
  group: OfficialSubjectKey;
  label: string;
  passThreshold: number;
  attemptCount: number;
  totalCorrect: number;
  totalQuestions: number;
  averagePercent: number | null;
  status: 'not_started' | 'passed' | 'needs_work';
}

/**
 * Computes official OCSC Bachelor's 3-subject readiness:
 * - Analytical (combines analytical_math + analytical_thai) >= 60%
 * - English >= 50%
 * - Law >= 60%
 * Uses the latest attempt per exam so retakes reflect current readiness.
 */
export function computeOfficialSubjectRollup(
  attempts: readonly ExamAttempt[],
  thresholds: PassThresholds,
): OfficialSubjectStatus[] {
  const latestByExam = new Map<string, ExamAttempt>();
  for (const attempt of attempts) {
    const prev = latestByExam.get(attempt.examId);
    if (!prev || attempt.finishedAt > prev.finishedAt) {
      latestByExam.set(attempt.examId, attempt);
    }
  }

  const groups: Array<{ group: OfficialSubjectKey; label: string; passThreshold: number }> = [
    {
      group: 'analytical',
      label: 'ความสามารถในการคิดวิเคราะห์ (คณิต + ไทย)',
      passThreshold: thresholds.analytical,
    },
    {
      group: 'english',
      label: 'ภาษาอังกฤษ',
      passThreshold: thresholds.english,
    },
    {
      group: 'law',
      label: 'ความรู้และลักษณะการเป็นข้าราชการที่ดี (กฎหมาย)',
      passThreshold: thresholds.law,
    },
  ];

  return groups.map(({ group, label, passThreshold }) => {
    let attemptCount = 0;
    let totalCorrect = 0;
    let totalQuestions = 0;

    for (const attempt of latestByExam.values()) {
      if (mapSubjectToOfficialGroup(attempt.subjectCode) === group) {
        attemptCount += 1;
        totalCorrect += attempt.score;
        totalQuestions += attempt.total;
      }
    }

    if (totalQuestions === 0) {
      return {
        group,
        label,
        passThreshold,
        attemptCount: 0,
        totalCorrect: 0,
        totalQuestions: 0,
        averagePercent: null,
        status: 'not_started',
      };
    }

    const averagePercent = Math.round((totalCorrect / totalQuestions) * 1000) / 10;
    return {
      group,
      label,
      passThreshold,
      attemptCount,
      totalCorrect,
      totalQuestions,
      averagePercent,
      status: averagePercent >= passThreshold ? 'passed' : 'needs_work',
    };
  });
}

export function countActiveCompletedStudies(
  studyItems: readonly StudyItem[],
  progress: UserProgress,
): { completed: number; total: number } {
  const completed = studyItems.filter(
    (item) => progress.completedStudies[item.id]?.active === true,
  ).length;
  return { completed, total: studyItems.length };
}

export function countActiveCompletedPdfs(
  pdfExams: readonly PdfExamItem[],
  progress: UserProgress,
): { completed: number; total: number } {
  const completed = pdfExams.filter(
    (item) => progress.completedPdfs[item.id]?.active === true,
  ).length;
  return { completed, total: pdfExams.length };
}
