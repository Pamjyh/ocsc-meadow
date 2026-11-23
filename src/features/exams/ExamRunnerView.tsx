import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ChoiceKey,
  ExamAttempt,
  ExamDetail,
  ExamMode,
  InProgressExam,
  UserProgress,
} from '../../domain/models';
import {
  normalizeDriveImageUrl,
  renderQuestionMarkdown,
} from '../../domain/sanitize';
import { gradeExam } from '../../domain/scoring';
import { loadExamDetail } from '../../services/dataRepository';
import type { AppRoute } from '../../services/router';
import './ExamsView.css';

interface ExamRunnerViewProps {
  examId: string;
  initialMode: ExamMode;
  progress: UserProgress;
  onNavigate: (route: AppRoute) => void;
  onUpdateProgress: (updater: (prev: UserProgress) => UserProgress) => void;
}

const CHOICE_KEYS: ChoiceKey[] = ['A', 'B', 'C', 'D'];

function formatTimer(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function ExamRunnerView({
  examId,
  initialMode,
  progress,
  onNavigate,
  onUpdateProgress,
}: ExamRunnerViewProps) {
  const [detail, setDetail] = useState<ExamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submittedAttempt, setSubmittedAttempt] = useState<ExamAttempt | null>(null);
  const [onlyWrongFilter, setOnlyWrongFilter] = useState(false);

  const savedSession = progress.inProgressExams[examId];
  const mode: ExamMode = savedSession?.mode ?? initialMode;

  const [answers, setAnswers] = useState<Record<string, ChoiceKey>>(
    () => savedSession?.answers ?? {},
  );
  const [flaggedIds, setFlaggedIds] = useState<string[]>(
    () => savedSession?.flaggedIds ?? [],
  );
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(
    () => savedSession?.remainingSeconds ?? null,
  );

  const startedAtRef = useRef<string>(
    savedSession?.startedAt ?? new Date().toISOString(),
  );
  const endAtMsRef = useRef<number | null>(null);
  const submittedRef = useRef(false);

  // Load exam questions (cache/seed immediate, remote fallback)
  useEffect(() => {
    let active = true;
    setLoading(true);
    loadExamDetail(examId)
      .then((loaded) => {
        if (!active) return;
        setDetail(loaded);
        if (loaded && mode === 'timed') {
          const initialSec =
            savedSession?.remainingSeconds ?? loaded.exam.durationMinutes * 60;
          setRemainingSeconds(initialSec);
          endAtMsRef.current = Date.now() + initialSec * 1000;
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // Initialize session once per examId load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  const persistSession = useCallback(
    (
      nextAnswers: Record<string, ChoiceKey>,
      nextFlagged: string[],
      nextRemaining: number | null,
    ) => {
      const now = new Date().toISOString();
      const session: InProgressExam = {
        examId,
        mode,
        answers: nextAnswers,
        flaggedIds: nextFlagged,
        remainingSeconds: nextRemaining,
        startedAt: startedAtRef.current,
        updatedAt: now,
      };
      onUpdateProgress((prev) => ({
        ...prev,
        inProgressExams: {
          ...prev.inProgressExams,
          [examId]: session,
        },
      }));
    },
    [examId, mode, onUpdateProgress],
  );

  const handleSubmit = useCallback(
    (finalAnswers: Record<string, ChoiceKey>) => {
      if (!detail || submittedRef.current) return;
      submittedRef.current = true;

      const grade = gradeExam(detail.exam, detail.questions, finalAnswers);
      const finishedAt = new Date().toISOString();
      const elapsedSec = Math.max(
        1,
        Math.round((Date.parse(finishedAt) - Date.parse(startedAtRef.current)) / 1000),
      );

      const attempt: ExamAttempt = {
        attemptId: `att_${examId}_${Date.now()}`,
        examId,
        subjectCode: detail.exam.subjectCode,
        mode,
        score: grade.score,
        total: grade.total,
        percent: grade.percent,
        passed: grade.passed,
        durationSeconds: elapsedSec,
        finishedAt,
        answers: finalAnswers,
      };

      setSubmittedAttempt(attempt);
      onUpdateProgress((prev) => {
        const { [examId]: _cleared, ...remainingInProgress } = prev.inProgressExams;
        return {
          ...prev,
          inProgressExams: remainingInProgress,
          examAttempts: [attempt, ...prev.examAttempts],
        };
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [detail, examId, mode, onUpdateProgress],
  );

  // Wall-clock countdown timer for 'timed' mode with auto-submit at 00:00
  const answersRef = useRef(answers);
  answersRef.current = answers;

  useEffect(() => {
    if (mode !== 'timed' || submittedAttempt || !detail || endAtMsRef.current === null) {
      return;
    }
    const id = window.setInterval(() => {
      if (endAtMsRef.current === null) return;
      const left = Math.max(0, Math.ceil((endAtMsRef.current - Date.now()) / 1000));
      setRemainingSeconds(left);
      if (left === 0) {
        window.clearInterval(id);
        handleSubmit(answersRef.current);
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [mode, submittedAttempt, detail, handleSubmit]);

  const selectChoice = (questionId: string, choice: ChoiceKey) => {
    const nextAnswers = { ...answers, [questionId]: choice };
    setAnswers(nextAnswers);
    persistSession(nextAnswers, flaggedIds, remainingSeconds);
  };

  const toggleFlag = (questionId: string) => {
    const nextFlagged = flaggedIds.includes(questionId)
      ? flaggedIds.filter((id) => id !== questionId)
      : [...flaggedIds, questionId];
    setFlaggedIds(nextFlagged);
    persistSession(answers, nextFlagged, remainingSeconds);
  };

  const questions = detail?.questions ?? [];
  const currentQ = questions[currentIndex] ?? null;

  const currentPromptHtml = useMemo(
    () => (currentQ ? renderQuestionMarkdown(currentQ.promptMd) : ''),
    [currentQ],
  );

  if (loading) {
    return (
      <section className="paper-card" style={{ padding: 32 }}>
        <p style={{ color: 'var(--text-muted)' }}>กำลังเตรียมชุดข้อสอบ...</p>
      </section>
    );
  }

  if (!detail || questions.length === 0) {
    return (
      <section className="paper-card" style={{ padding: 32 }}>
        <h2>ไม่พบชุดข้อสอบนี้</h2>
        <button
          type="button"
          className="study-nav-btn"
          style={{ marginTop: 14 }}
          onClick={() => onNavigate({ name: 'exams', tab: 'interactive' })}
        >
          ← กลับคลังข้อสอบ
        </button>
      </section>
    );
  }

  // Review Mode (after submission)
  if (submittedAttempt) {
    const reviewRows = questions.map((q) => {
      const selected = submittedAttempt.answers?.[q.id] ?? null;
      return { q, selected, isCorrect: selected === q.correctChoice };
    });
    const visibleRows = onlyWrongFilter
      ? reviewRows.filter((r) => !r.isCorrect)
      : reviewRows;

    return (
      <div className="exams-wrap">
        <section className="review-summary">
          <div>
            <span
              className={`exam-chip ${
                submittedAttempt.passed ? 'exam-chip--pass' : 'exam-chip--fail'
              }`}
            >
              {submittedAttempt.passed
                ? `ผ่านเกณฑ์ ก.พ. ป.ตรี (≥ ${detail.exam.passPercent}%)`
                : `ยังไม่ถึงเกณฑ์ (ต้องได้ ≥ ${detail.exam.passPercent}%)`}
            </span>
            <h1 style={{ fontSize: '1.5rem', marginTop: 10 }}>
              ได้คะแนน {submittedAttempt.score} / {submittedAttempt.total} (
              {submittedAttempt.percent}%)
            </h1>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: 4 }}>
              {detail.exam.title} · ใช้เวลา {Math.ceil(submittedAttempt.durationSeconds / 60)} นาที
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`study-action-btn${onlyWrongFilter ? ' study-action-btn--bm' : ''}`}
              onClick={() => setOnlyWrongFilter((v) => !v)}
            >
              {onlyWrongFilter ? 'แสดงทุกข้อ' : 'ดูเฉพาะข้อที่ตอบผิด'}
            </button>
            <button
              type="button"
              className="study-nav-btn study-nav-btn--primary"
              onClick={() => onNavigate({ name: 'exams', tab: 'interactive' })}
            >
              กลับคลังข้อสอบ
            </button>
          </div>
        </section>

        {visibleRows.length === 0 ? (
          <section className="review-item">
            <p style={{ fontWeight: 600, color: 'var(--status-pass)' }}>
              สุดยอดมากครับ! ชุดนี้ตอบถูกครบทุกข้อ ไม่มีข้อผิดเลย
            </p>
          </section>
        ) : (
          visibleRows.map(({ q, selected, isCorrect }) => (
            <article key={q.id} className="review-item">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                <strong>ข้อที่ {q.order}</strong>
                <span className={`exam-chip ${isCorrect ? 'exam-chip--pass' : 'exam-chip--fail'}`}>
                  {isCorrect
                    ? '✓ ตอบถูก'
                    : `✗ ตอบ ${selected ?? 'ไม่ได้ตอบ'} (เฉลย ${q.correctChoice})`}
                </span>
              </div>

              <div
                className="runner-prompt"
                dangerouslySetInnerHTML={{ __html: renderQuestionMarkdown(q.promptMd) }}
              />
              {q.imageUrl && (
                <img
                  src={normalizeDriveImageUrl(q.imageUrl)}
                  alt={`ภาพประกอบข้อ ${q.order}`}
                  className="runner-img"
                />
              )}

              <div className="runner-choices" style={{ marginTop: 12 }}>
                {CHOICE_KEYS.map((key) => {
                  const isRight = key === q.correctChoice;
                  const isPicked = key === selected;
                  const borderColor = isRight
                    ? 'var(--status-pass)'
                    : isPicked
                      ? 'var(--status-fail)'
                      : 'rgba(31, 41, 51, 0.10)';
                  const bg = isRight
                    ? 'var(--status-pass-bg)'
                    : isPicked
                      ? 'var(--status-fail-bg)'
                      : '#ffffff';
                  return (
                    <div
                      key={key}
                      className="runner-choice-btn"
                      style={{ borderColor, background: bg, cursor: 'default' }}
                    >
                      <span className="runner-choice-key">{key}</span>
                      <span>{q.choices[key]}</span>
                    </div>
                  );
                })}
              </div>

              <div className="review-explanation">
                <strong style={{ display: 'block', marginBottom: 4, color: 'var(--accent-meadow)' }}>
                  เฉลยละเอียด:
                </strong>
                <div
                  dangerouslySetInnerHTML={{
                    __html: renderQuestionMarkdown(q.explanationMd),
                  }}
                />
                {q.explanationImageUrl && (
                  <img
                    src={normalizeDriveImageUrl(q.explanationImageUrl)}
                    alt={`ภาพเฉลยข้อ ${q.order}`}
                    className="runner-img"
                  />
                )}
              </div>
            </article>
          ))
        )}
      </div>
    );
  }

  // Active Exam Runner
  const answeredCount = Object.keys(answers).length;
  const isUrgent = remainingSeconds !== null && remainingSeconds <= 120;

  return (
    <div className="exams-wrap">
      <header className="runner-top">
        <div>
          <strong style={{ fontSize: '1.02rem' }}>{detail.exam.title}</strong>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
            {mode === 'timed' ? 'โหมดสอบจริง (จับเวลาถอยหลัง)' : 'โหมดฝึกทำ (ไม่จำกัดเวลา)'} · ตอบแล้ว{' '}
            {answeredCount}/{questions.length} ข้อ
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {remainingSeconds !== null && (
            <div className={`runner-timer${isUrgent ? ' runner-timer--urgent' : ''}`}>
              {formatTimer(remainingSeconds)}
            </div>
          )}
          <button
            type="button"
            className="study-nav-btn"
            onClick={() => {
              persistSession(answers, flaggedIds, remainingSeconds);
              onNavigate({ name: 'exams', tab: 'interactive' });
            }}
          >
            พักไว้ก่อน
          </button>
        </div>
      </header>

      <div className="runner-body">
        {currentQ && (
          <section className="runner-question-card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 14,
              }}
            >
              <span className="exam-chip">
                ข้อที่ {currentIndex + 1} จาก {questions.length}
              </span>
              <button
                type="button"
                className={`study-action-btn${
                  flaggedIds.includes(currentQ.id) ? ' study-action-btn--bm' : ''
                }`}
                onClick={() => toggleFlag(currentQ.id)}
              >
                {flaggedIds.includes(currentQ.id) ? '★ ปักธงทบทวนแล้ว' : '☆ ปักธงทบทวน'}
              </button>
            </div>

            <div
              className="runner-prompt"
              dangerouslySetInnerHTML={{ __html: currentPromptHtml }}
            />

            {currentQ.imageUrl && (
              <img
                src={normalizeDriveImageUrl(currentQ.imageUrl)}
                alt={`ภาพประกอบข้อ ${currentQ.order}`}
                className="runner-img"
              />
            )}

            <div className="runner-choices">
              {CHOICE_KEYS.map((key) => {
                const selected = answers[currentQ.id] === key;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`runner-choice-btn${selected ? ' runner-choice-btn--selected' : ''}`}
                    onClick={() => selectChoice(currentQ.id, key)}
                  >
                    <span className="runner-choice-key">{key}</span>
                    <span>{currentQ.choices[key]}</span>
                  </button>
                );
              })}
            </div>

            <div className="study-footer-nav">
              <button
                type="button"
                className="study-nav-btn"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              >
                ← ข้อก่อนหน้า
              </button>

              {currentIndex < questions.length - 1 ? (
                <button
                  type="button"
                  className="study-nav-btn study-nav-btn--primary"
                  onClick={() =>
                    setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))
                  }
                >
                  ข้อถัดไป →
                </button>
              ) : (
                <button
                  type="button"
                  className="study-nav-btn study-nav-btn--primary"
                  onClick={() => handleSubmit(answers)}
                >
                  ส่งข้อสอบและดูเฉลยละเอียด
                </button>
              )}
            </div>
          </section>
        )}

        <aside className="runner-nav-panel">
          <strong style={{ fontSize: '0.92rem' }}>กระดานเลขข้อ</strong>
          <div className="runner-num-grid">
            {questions.map((q, idx) => {
              const isAnswered = Boolean(answers[q.id]);
              const isFlagged = flaggedIds.includes(q.id);
              const isCurr = idx === currentIndex;
              return (
                <button
                  key={q.id}
                  type="button"
                  className={`runner-num-btn${
                    isFlagged
                      ? ' runner-num-btn--flagged'
                      : isAnswered
                        ? ' runner-num-btn--answered'
                        : ''
                  }${isCurr ? ' runner-num-btn--current' : ''}`}
                  onClick={() => setCurrentIndex(idx)}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="exam-btn-timed"
            onClick={() => handleSubmit(answers)}
          >
            ส่งข้อสอบ ({answeredCount}/{questions.length})
          </button>
        </aside>
      </div>
    </div>
  );
}
