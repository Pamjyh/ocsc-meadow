import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChoiceKey } from '../../domain/models';
import { renderQuestionMarkdown } from '../../domain/sanitize';
import { playUiSound } from '../../services/uiSound';
import { recordStudyActivity } from '../widgets/streakStore';
import { OCSC_FLASHCARDS } from './flashcardData';
import {
  ERROR_CAUSE_OPTIONS,
  loadFlashcardSrsMap,
  loadMistakes,
  rateFlashcard,
  rateMistakeRecord,
  removeMistakeRecord,
  summarizeErrorCauses,
  tagMistakeRecord,
  type ErrorCauseTag,
  type FlashcardSrsMap,
  type MistakeRecord,
} from './reviewStore';
import {
  formatSrsInterval,
  isSrsDue,
  scheduleSrsReview,
  type SrsRating,
} from './srsEngine';
import './ReviewFlashcards.css';

interface ReviewFlashcardsPanelProps {
  subjectFilter: string;
}

const CHOICE_KEYS: ChoiceKey[] = ['A', 'B', 'C', 'D'];

const RATING_LABELS: readonly { rating: SrsRating; label: string; keyHint: string }[] = [
  { rating: 1, label: 'ลืม', keyHint: '1' },
  { rating: 2, label: 'ยาก', keyHint: '2' },
  { rating: 3, label: 'พอได้', keyHint: '3' },
  { rating: 4, label: 'ง่าย', keyHint: '4' },
];

export function ReviewFlashcardsPanel({ subjectFilter }: ReviewFlashcardsPanelProps) {
  const [subMode, setSubMode] = useState<'flashcards' | 'mistakes'>('flashcards');
  const [srsMap, setSrsMap] = useState<FlashcardSrsMap>(loadFlashcardSrsMap);
  const [mistakes, setMistakes] = useState<MistakeRecord[]>(loadMistakes);
  const [flipped, setFlipped] = useState(false);
  const [practiceAll, setPracticeAll] = useState(false);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [revealedMistakeIds, setRevealedMistakeIds] = useState<Record<string, boolean>>({});
  const [nowTick, setNowTick] = useState(() => Date.now());

  const filteredCards = useMemo(
    () =>
      subjectFilter === 'all'
        ? OCSC_FLASHCARDS
        : OCSC_FLASHCARDS.filter((c) => c.subjectCode === subjectFilter),
    [subjectFilter],
  );

  const dueCards = useMemo(
    () => filteredCards.filter((c) => isSrsDue(srsMap[c.id], nowTick)),
    [filteredCards, srsMap, nowTick],
  );

  const filteredMistakes = useMemo(
    () =>
      subjectFilter === 'all'
        ? mistakes
        : mistakes.filter((m) => m.subjectCode === subjectFilter),
    [mistakes, subjectFilter],
  );

  const dueMistakesCount = useMemo(
    () => filteredMistakes.filter((m) => isSrsDue(m.srs, nowTick)).length,
    [filteredMistakes, nowTick],
  );

  const activeCard = practiceAll
    ? filteredCards[practiceIndex % Math.max(1, filteredCards.length)] ?? null
    : dueCards[0] ?? null;

  const handleRateCard = useCallback(
    (rating: SrsRating) => {
      if (!activeCard) return;
      const ts = Date.now();
      setSrsMap(rateFlashcard(activeCard.id, rating, ts));
      recordStudyActivity(1);
      playUiSound(rating >= 3 ? 'checkin' : 'tap');
      setNowTick(ts);
      setFlipped(false);
      if (practiceAll) {
        setPracticeIndex((i) => i + 1);
      }
    },
    [activeCard, practiceAll],
  );

  // Keyboard shortcuts for Flashcard mode: Space to flip, 1-4 to rate when flipped
  useEffect(() => {
    if (subMode !== 'flashcards' || !activeCard) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.code === 'Space') {
        // Do not hijack Space when user is focused on another interactive control (F70)
        if (target?.closest('button, a, select') && !target.closest('.fc-card')) {
          return;
        }
        e.preventDefault();
        playUiSound('flip');
        setFlipped((prev) => !prev);
      } else if (flipped && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        handleRateCard(Number(e.key) as SrsRating);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [subMode, activeCard, flipped, handleRateCard]);

  // Reset flip and practiceAll mode when subject filter changes (F69)
  useEffect(() => {
    setFlipped(false);
    setPracticeIndex(0);
    setPracticeAll(false);
  }, [subjectFilter]);

  const handleRateMistake = (id: string, rating: SrsRating) => {
    const ts = Date.now();
    setMistakes(rateMistakeRecord(id, rating, ts));
    recordStudyActivity(1);
    playUiSound(rating >= 3 ? 'checkin' : 'tap');
    setNowTick(ts);
    setRevealedMistakeIds((prev) => ({ ...prev, [id]: false }));
  };

  const handleRemoveMistake = (id: string) => {
    setMistakes(removeMistakeRecord(id));
  };

  const handleTagMistake = (id: string, current: ErrorCauseTag | undefined, nextTag: ErrorCauseTag) => {
    playUiSound('tap');
    setMistakes(tagMistakeRecord(id, current === nextTag ? undefined : nextTag));
  };

  const errorCauseCounts = useMemo(
    () => summarizeErrorCauses(filteredMistakes),
    [filteredMistakes],
  );

  const masteredCount = filteredCards.filter((c) => (srsMap[c.id]?.reps ?? 0) >= 2).length;

  return (
    <section className="review-panel-wrap">
      <div className="review-subbar">
        <div className="review-mode-pills" role="tablist" aria-label="โหมดทบทวน">
          <button
            type="button"
            role="tab"
            aria-selected={subMode === 'flashcards'}
            className={`review-mode-btn${
              subMode === 'flashcards' ? ' review-mode-btn--active' : ''
            }`}
            onClick={() => setSubMode('flashcards')}
          >
            🃏 แฟลชการ์ด FSRS ({dueCards.length}/{filteredCards.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subMode === 'mistakes'}
            className={`review-mode-btn${
              subMode === 'mistakes' ? ' review-mode-btn--active' : ''
            }`}
            onClick={() => setSubMode('mistakes')}
          >
            📌 สมุดข้อที่ทำผิด ({filteredMistakes.length})
          </button>
        </div>

        <div className="review-stats-row">
          {subMode === 'flashcards' ? (
            <>
              <span className="exam-chip">ต้องทบทวนวันนี้ {dueCards.length} ใบ</span>
              <span className="exam-chip exam-chip--pass">
                จำแม่นแล้ว {masteredCount}/{filteredCards.length}
              </span>
            </>
          ) : (
            <span className="exam-chip">
              ถึงรอบทบทวน {dueMistakesCount}/{filteredMistakes.length} ข้อ
            </span>
          )}
        </div>
      </div>

      {subMode === 'flashcards' ? (
        activeCard ? (
          <div className="fc-stage">
            <div className="fc-scene">
              <button
                type="button"
                className={`fc-card${flipped ? ' fc-card--flipped' : ''}`}
                onClick={() => {
                  playUiSound('flip');
                  setFlipped((prev) => !prev);
                }}
                aria-label={flipped ? 'พลิกกลับด้านคำถาม' : 'พลิกดูคำตอบ'}
              >
                <div className="fc-face fc-face--front">
                  <div className="fc-face-top">
                    <span className="exam-chip">{activeCard.tag}</span>
                    <span className="fc-hint">แตะการ์ดหรือกด Spacebar เพื่อดูเฉลย</span>
                  </div>
                  <div
                    className="fc-face-body fc-face-body--front"
                    dangerouslySetInnerHTML={{
                      __html: renderQuestionMarkdown(activeCard.front),
                    }}
                  />
                  <div className="fc-hint">
                    {practiceAll
                      ? `โหมดฝึกทวนทั้งหมด (${(practiceIndex % filteredCards.length) + 1}/${filteredCards.length})`
                      : `เหลือที่ต้องทบทวน ${dueCards.length} ใบ`}
                  </div>
                </div>

                <div className="fc-face fc-face--back">
                  <div className="fc-face-top">
                    <span className="exam-chip exam-chip--pass">เฉลย · {activeCard.tag}</span>
                    <span className="fc-hint">กดปุ่ม 1–4 ด้านล่างเพื่อตั้งรอบทบทวน</span>
                  </div>
                  <div className="fc-face-body">
                    <div
                      dangerouslySetInnerHTML={{
                        __html: renderQuestionMarkdown(activeCard.back),
                      }}
                    />
                    {activeCard.tip && (
                      <div className="fc-tip">💡 {activeCard.tip}</div>
                    )}
                  </div>
                  <div className="fc-hint">แตะอีกครั้งเพื่อพลิกกลับด้านคำถาม</div>
                </div>
              </button>
            </div>

            {flipped ? (
              <div className="fc-rating-row" role="group" aria-label="ประเมินความจำ">
                {RATING_LABELS.map(({ rating, label, keyHint }) => {
                  const preview = scheduleSrsReview(srsMap[activeCard.id], rating, nowTick);
                  return (
                    <button
                      key={rating}
                      type="button"
                      className={`fc-rate-btn fc-rate-btn--${rating}`}
                      onClick={() => handleRateCard(rating)}
                    >
                      <span>
                        {label} ({keyHint})
                      </span>
                      <span className="fc-rate-int">
                        ทวนอีก {formatSrsInterval(preview.intervalMs)}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <button
                type="button"
                className="exam-btn-timed"
                style={{ minWidth: 200 }}
                onClick={() => setFlipped(true)}
              >
                พลิกดูเฉลย (Space)
              </button>
            )}
          </div>
        ) : (
          <div className="mistake-empty">
            <strong style={{ fontSize: '1.08rem', color: 'var(--status-pass)' }}>
              🎉 ทบทวนแฟลชการ์ดหมวดนี้ครบทุกใบแล้ว!
            </strong>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              ระบบคำนวณวันทบทวนรอบถัดไปให้แล้ว หรือกดฝึกทวนซ้ำทั้งหมดต่อได้ทันที
            </p>
            <button
              type="button"
              className="exam-btn-practice"
              style={{ marginTop: 6 }}
              onClick={() => {
                setPracticeAll(true);
                setPracticeIndex(0);
                setFlipped(false);
              }}
            >
              ฝึกทวนทั้ง {filteredCards.length} ใบอีกรอบ
            </button>
          </div>
        )
      ) : filteredMistakes.length === 0 ? (
        <div className="mistake-empty">
          <strong style={{ fontSize: '1.06rem' }}>ยังไม่มีข้อที่ทำผิดในหมวดนี้ครับ</strong>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: 460 }}>
            ทุกครั้งที่ส่งข้อสอบในแท็บ &ldquo;ทำในเว็บ&rdquo; ข้อที่ตอบผิดจะถูกดึงมาเก็บไว้ในสมุดนี้โดยอัตโนมัติพร้อมเฉลยละเอียดและตารางทบทวนเว้นระยะ
          </p>
        </div>
      ) : (
        <div className="mistake-list">
          {ERROR_CAUSE_OPTIONS.some((opt) => errorCauseCounts[opt.tag] > 0) && (
            <div className="mistake-cause-summary" aria-label="สรุปสาเหตุที่ตอบผิด">
              {ERROR_CAUSE_OPTIONS.filter((opt) => errorCauseCounts[opt.tag] > 0).map((opt) => (
                <span key={opt.tag} className="exam-chip">
                  {opt.emoji} {opt.label}: {errorCauseCounts[opt.tag]}
                </span>
              ))}
            </div>
          )}
          {filteredMistakes.map((item) => {
            const revealed = Boolean(revealedMistakeIds[item.id]);
            const isDue = isSrsDue(item.srs, nowTick);
            return (
              <article key={item.id} className="mistake-card">
                <div className="mistake-card-head">
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <strong>
                      {item.examTitle} · ข้อ {item.order}
                    </strong>
                    <span className="exam-chip exam-chip--fail">
                      ผิด {item.wrongCount} ครั้ง
                    </span>
                    <span
                      className={`exam-chip ${
                        isDue ? 'exam-chip--resume' : 'exam-chip--pass'
                      }`}
                    >
                      {isDue ? 'ถึงรอบทบทวน' : 'ทวนแล้ว'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="study-action-btn"
                    onClick={() => handleRemoveMistake(item.id)}
                    title="ลบออกจากสมุดข้อผิด"
                  >
                    ✓ จำได้แล้ว (เอาออก)
                  </button>
                </div>

                <div className="mistake-tag-row" role="group" aria-label="ระบุสาเหตุที่ตอบผิด">
                  {ERROR_CAUSE_OPTIONS.map((opt) => {
                    const active = item.errorTag === opt.tag;
                    return (
                      <button
                        key={opt.tag}
                        type="button"
                        className={`mistake-tag-btn${active ? ' mistake-tag-btn--active' : ''}`}
                        aria-pressed={active}
                        onClick={() => handleTagMistake(item.id, item.errorTag, opt.tag)}
                      >
                        {opt.emoji} {opt.label}
                      </button>
                    );
                  })}
                </div>

                <div
                  className="runner-prompt"
                  dangerouslySetInnerHTML={{
                    __html: renderQuestionMarkdown(item.promptMd),
                  }}
                />

                <div className="runner-choices">
                  {CHOICE_KEYS.map((key) => {
                    const isRight = revealed && key === item.correctChoice;
                    const isPicked = revealed && key === item.lastPicked && !isRight;
                    return (
                      <div
                        key={key}
                        className="runner-choice-btn"
                        style={{
                          cursor: 'default',
                          borderColor: isRight
                            ? 'var(--status-pass)'
                            : isPicked
                              ? 'var(--status-fail)'
                              : undefined,
                          background: isRight
                            ? 'rgba(46, 125, 82, 0.16)'
                            : isPicked
                              ? 'rgba(185, 28, 28, 0.16)'
                              : undefined,
                        }}
                      >
                        <span className="runner-choice-key">{key}</span>
                        <span>{item.choices[key]}</span>
                      </div>
                    );
                  })}
                </div>

                {revealed ? (
                  <>
                    <div className="review-explanation">
                      <strong
                        style={{
                          display: 'block',
                          marginBottom: 4,
                          color: 'var(--accent-meadow)',
                        }}
                      >
                        เฉลย {item.correctChoice} (รอบก่อนตอบ {item.lastPicked ?? 'ไม่ได้ตอบ'}):
                      </strong>
                      <div
                        dangerouslySetInnerHTML={{
                          __html: renderQuestionMarkdown(item.explanationMd),
                        }}
                      />
                    </div>
                    <div className="fc-rating-row">
                      {RATING_LABELS.map(({ rating, label }) => {
                        const preview = scheduleSrsReview(item.srs, rating, nowTick);
                        return (
                          <button
                            key={rating}
                            type="button"
                            className={`fc-rate-btn fc-rate-btn--${rating}`}
                            onClick={() => handleRateMistake(item.id, rating)}
                          >
                            <span>{label}</span>
                            <span className="fc-rate-int">
                              อีก {formatSrsInterval(preview.intervalMs)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="mistake-card-actions">
                    <button
                      type="button"
                      className="exam-btn-practice"
                      onClick={() =>
                        setRevealedMistakeIds((prev) => ({ ...prev, [item.id]: true }))
                      }
                    >
                      ดูเฉลยละเอียด &amp; ประเมินความจำ
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
