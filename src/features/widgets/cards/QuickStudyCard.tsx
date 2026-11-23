import { useMemo, useState } from 'react';
import { SEED_EXAMS } from '../../../data/seedSnapshot';
import type {
  ChoiceKey,
  ExamDetail,
  ExamMeta,
  ExamQuestion,
  StudyItem,
} from '../../../domain/models';
import { renderQuestionMarkdown } from '../../../domain/sanitize';
import type { AppRoute } from '../../../services/router';
import { readJson } from '../../../services/storage';
import { getLocalDateKey, hashString } from '../widgetUtils';

interface QuickStudyCardProps {
  exams: ExamMeta[];
  lastStudy: StudyItem | null;
  onNavigate: (route: AppRoute) => void;
}

const CHOICE_KEYS: readonly ChoiceKey[] = ['A', 'B', 'C', 'D'] as const;
const THAI_CHOICE_LABELS: Record<ChoiceKey, string> = {
  A: 'ก',
  B: 'ข',
  C: 'ค',
  D: 'ง',
};

interface QuickQuestionEntry {
  examTitle: string;
  question: ExamQuestion;
}

/**
 * Synchronous 0ms question pool loader (F23):
 * Reads cached exam details from localStorage first, then falls back to SEED_EXAMS
 * without triggering extra Apps Script network fetches on Home load.
 */
function loadLocalQuestionPool(exams: ExamMeta[]): QuickQuestionEntry[] {
  const pool: QuickQuestionEntry[] = [];
  const seenIds = new Set<string>();

  for (const meta of exams) {
    const cached = readJson<ExamDetail>(`ocsc_meadow_exam_v1_${meta.id}`);
    const detail = cached ?? SEED_EXAMS[meta.id];
    if (!detail?.questions) continue;
    for (const q of detail.questions) {
      if (seenIds.has(q.id)) continue;
      seenIds.add(q.id);
      pool.push({ examTitle: detail.exam.title, question: q });
    }
  }

  if (pool.length === 0) {
    for (const detail of Object.values(SEED_EXAMS)) {
      for (const q of detail.questions) {
        if (seenIds.has(q.id)) continue;
        seenIds.add(q.id);
        pool.push({ examTitle: detail.exam.title, question: q });
      }
    }
  }

  return pool;
}

export function QuickStudyCard({
  exams,
  lastStudy,
  onNavigate,
}: QuickStudyCardProps) {
  const pool = useMemo(() => loadLocalQuestionPool(exams), [exams]);
  const todaySeed = useMemo(() => hashString(getLocalDateKey()), []);

  const [offset, setOffset] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<ChoiceKey | null>(null);

  const activeEntry =
    pool.length > 0 ? pool[(todaySeed + offset) % pool.length] ?? null : null;

  // F35: Reuse sanitized renderQuestionMarkdown so bold text & math tables render cleanly
  const promptHtml = useMemo(
    () => (activeEntry ? renderQuestionMarkdown(activeEntry.question.promptMd) : ''),
    [activeEntry],
  );

  const explanationHtml = useMemo(
    () =>
      activeEntry?.question.explanationMd
        ? renderQuestionMarkdown(activeEntry.question.explanationMd)
        : '',
    [activeEntry],
  );

  const handleNextRandom = () => {
    if (pool.length <= 1) return;
    setSelectedChoice(null);
    setOffset(
      (prev) =>
        (prev + 1 + Math.floor(Math.random() * Math.max(1, pool.length - 1))) %
        pool.length,
    );
  };

  if (!activeEntry) {
    return (
      <div className="glass-card widget-card quick-study-card">
        <div className="widget-card-head">
          <h2 className="widget-card-title">💡 โจทย์วันละข้อ</h2>
          <button
            type="button"
            className="widget-mini-pill widget-mini-pill--primary"
            onClick={() => onNavigate({ name: 'exams', tab: 'interactive' })}
          >
            เปิดคลังข้อสอบ
          </button>
        </div>
        <p className="widget-card-sub">
          ยังไม่มีโจทย์ในแคช ลองเปิดหน้าคลังข้อสอบเพื่อเริ่มฝึกได้เลยครับ
        </p>
      </div>
    );
  }

  const { examTitle, question } = activeEntry;
  const isAnswered = selectedChoice !== null;
  const isCorrect = selectedChoice === question.correctChoice;

  return (
    <div className="glass-card widget-card quick-study-card">
      <div className="widget-card-head">
        <div>
          <h2 className="widget-card-title">💡 โจทย์วันละข้อ</h2>
          <p className="widget-card-sub">{examTitle}</p>
        </div>
        <div className="quick-study-head-actions">
          {lastStudy && (
            <button
              type="button"
              className="widget-mini-pill"
              onClick={() => onNavigate({ name: 'study', docId: lastStudy.id })}
              title={`อ่านต่อ: ${lastStudy.title}`}
            >
              📖 อ่านต่อ: {lastStudy.title.slice(0, 18)}
              {lastStudy.title.length > 18 ? '…' : ''}
            </button>
          )}
          <button
            type="button"
            className="widget-mini-pill widget-mini-pill--primary"
            onClick={handleNextRandom}
          >
            สุ่มข้อใหม่
          </button>
        </div>
      </div>

      <div
        className="quick-study-prompt"
        dangerouslySetInnerHTML={{ __html: promptHtml }}
      />

      <div className="quick-study-choices">
        {CHOICE_KEYS.map((key) => {
          const text = question.choices[key];
          if (!text) return null;

          let stateClass = '';
          if (isAnswered) {
            if (key === question.correctChoice) {
              stateClass = ' quick-choice--correct';
            } else if (key === selectedChoice) {
              stateClass = ' quick-choice--wrong';
            }
          }

          return (
            <button
              key={key}
              type="button"
              className={`quick-choice-btn${stateClass}`}
              disabled={isAnswered}
              onClick={() => setSelectedChoice(key)}
            >
              <span className="quick-choice-key">{THAI_CHOICE_LABELS[key]}.</span>
              <span className="quick-choice-text">{text}</span>
            </button>
          );
        })}
      </div>

      {isAnswered && (
        <div
          className={`quick-study-explain${
            isCorrect ? ' quick-study-explain--pass' : ' quick-study-explain--fail'
          }`}
        >
          <div className="quick-study-verdict">
            {isCorrect
              ? '✓ ตอบถูกครับ!'
              : `✕ เฉลยที่ถูกคือข้อ ${THAI_CHOICE_LABELS[question.correctChoice]}.`}
          </div>
          {explanationHtml && (
            <div
              className="quick-study-explain-text"
              dangerouslySetInnerHTML={{ __html: explanationHtml }}
            />
          )}
        </div>
      )}
    </div>
  );
}
