import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  BootstrapPayload,
  StudyDocContent,
  SubjectCode,
  UserProgress,
} from '../../domain/models';
import { sanitizeStudyHtml } from '../../domain/sanitize';
import { loadStudyDoc } from '../../services/dataRepository';
import type { AppRoute } from '../../services/router';
import { showToast } from '../../services/toast';
import { playUiSound } from '../../services/uiSound';
import {
  LiquidGlassIcon,
  type GlassIconName,
  type GlassIconTone,
} from '../../ui/LiquidGlassIcon';
import { recordStudyActivity } from '../widgets/streakStore';
import {
  addStudyHighlight,
  loadAllStudyHighlights,
  normalizeHighlightText,
  removeStudyHighlight,
  type HighlightColor,
  type StudyHighlightsMap,
} from './studyHighlightsStore';
import './StudyView.css';

type StudyFilter = 'all' | 'unread' | 'bookmarked';

interface StudyViewProps {
  bootstrap: BootstrapPayload;
  progress: UserProgress;
  activeDocId: string | null;
  onNavigate: (route: AppRoute) => void;
  onUpdateProgress: (updater: (prev: UserProgress) => UserProgress) => void;
}

function getSubjectIcon(code: SubjectCode): { name: GlassIconName; tone: GlassIconTone } {
  switch (code) {
    case 'analytical_math':
      return { name: 'math', tone: 'sky' };
    case 'analytical_thai':
      return { name: 'thai', tone: 'meadow' };
    case 'english':
      return { name: 'english', tone: 'lavender' };
    case 'law':
      return { name: 'law', tone: 'coral' };
    default:
      return { name: 'book', tone: 'amber' };
  }
}

export function StudyView({
  bootstrap,
  progress,
  activeDocId,
  onNavigate,
  onUpdateProgress,
}: StudyViewProps) {
  const { subjects, studyItems } = bootstrap;
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StudyFilter>('all');
  const [collapsedSubjects, setCollapsedSubjects] = useState<Record<string, boolean>>({});
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const [readProgress, setReadProgress] = useState(0);
  const [highlightsMap, setHighlightsMap] = useState<StudyHighlightsMap>(loadAllStudyHighlights);
  const [highlightsOpen, setHighlightsOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState('');
  const readerRef = useRef<HTMLElement | null>(null);
  const proseRef = useRef<HTMLDivElement | null>(null);

  const selectedItem = useMemo(() => {
    if (activeDocId) {
      const found = studyItems.find((s) => s.id === activeDocId);
      if (found) return found;
    }
    if (progress.lastVisitedStudyId) {
      const last = studyItems.find((s) => s.id === progress.lastVisitedStudyId);
      if (last) return last;
    }
    return studyItems[0] ?? null;
  }, [activeDocId, progress.lastVisitedStudyId, studyItems]);

  const [docContent, setDocContent] = useState<StudyDocContent | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(false);

  // Record lastVisitedStudyId whenever user opens a chapter
  useEffect(() => {
    if (!selectedItem) return;
    if (progress.lastVisitedStudyId !== selectedItem.id) {
      onUpdateProgress((prev) => ({
        ...prev,
        lastVisitedStudyId: selectedItem.id,
      }));
    }
  }, [selectedItem, progress.lastVisitedStudyId, onUpdateProgress]);

  // Load sanitized Google Doc HTML (cache/seed immediate, remote fallback)
  useEffect(() => {
    if (!selectedItem) {
      setDocContent(null);
      return;
    }
    let active = true;
    setLoadingDoc(true);
    loadStudyDoc(selectedItem.id, selectedItem.updatedAt)
      .then((doc) => {
        if (!active) return;
        setDocContent(doc);
      })
      .finally(() => {
        if (active) setLoadingDoc(false);
      });

    return () => {
      active = false;
    };
  }, [selectedItem]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return studyItems.filter((item) => {
      if (filter === 'unread' && progress.completedStudies[item.id]?.active === true) {
        return false;
      }
      if (filter === 'bookmarked' && progress.bookmarkedStudies[item.id]?.active !== true) {
        return false;
      }
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q)
      );
    });
  }, [studyItems, search, filter, progress.completedStudies, progress.bookmarkedStudies]);

  const selectedIndex = selectedItem
    ? studyItems.findIndex((s) => s.id === selectedItem.id)
    : -1;
  const prevItem = selectedIndex > 0 ? (studyItems[selectedIndex - 1] ?? null) : null;
  const nextItem =
    selectedIndex >= 0 && selectedIndex < studyItems.length - 1
      ? (studyItems[selectedIndex + 1] ?? null)
      : null;

  const isCompleted = selectedItem
    ? progress.completedStudies[selectedItem.id]?.active === true
    : false;
  const isBookmarked = selectedItem
    ? progress.bookmarkedStudies[selectedItem.id]?.active === true
    : false;

  const toggleCompleted = () => {
    if (!selectedItem) return;
    const nextActive = !isCompleted;
    const now = new Date().toISOString();
    onUpdateProgress((prev) => ({
      ...prev,
      completedStudies: {
        ...prev.completedStudies,
        [selectedItem.id]: { active: nextActive, updatedAt: now },
      },
    }));
    if (nextActive) {
      playUiSound('checkin');
      recordStudyActivity(1);
      showToast({
        message: 'อ่านจบบทนี้แล้ว!',
        detail: selectedItem.title,
        tone: 'success',
      });
    } else {
      playUiSound('tap');
    }
  };

  const toggleBookmarked = () => {
    if (!selectedItem) return;
    const nextBm = !isBookmarked;
    const now = new Date().toISOString();
    onUpdateProgress((prev) => ({
      ...prev,
      bookmarkedStudies: {
        ...prev.bookmarkedStudies,
        [selectedItem.id]: { active: nextBm, updatedAt: now },
      },
    }));
    playUiSound('tap');
    if (nextBm) {
      showToast({ message: 'บุ๊กมาร์กบทเรียนไว้แล้ว', detail: selectedItem.title, tone: 'info' });
    }
  };

  const setFontSize = (size: 'sm' | 'md' | 'lg') => {
    onUpdateProgress((prev) => ({
      ...prev,
      preferences: { ...prev.preferences, fontSize: size },
    }));
  };

  const handleCompleteAndNext = () => {
    if (selectedItem && !isCompleted) {
      const now = new Date().toISOString();
      onUpdateProgress((prev) => ({
        ...prev,
        completedStudies: {
          ...prev.completedStudies,
          [selectedItem.id]: { active: true, updatedAt: now },
        },
      }));
      playUiSound('checkin');
      recordStudyActivity(1);
      showToast({
        message: 'อ่านจบบทนี้แล้ว!',
        detail: selectedItem.title,
        tone: 'success',
      });
    }
    if (nextItem) {
      onNavigate({ name: 'study', docId: nextItem.id });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const sanitizedHtml = useMemo(
    () => (docContent ? sanitizeStudyHtml(docContent.html) : ''),
    [docContent],
  );

  // Track reading scroll progress across the active chapter article
  useEffect(() => {
    setReadProgress(0);
    setSelectedQuote('');
    let rafId = 0;
    const measure = () => {
      rafId = 0;
      const el = readerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const scrollable = Math.max(1, el.offsetHeight - window.innerHeight * 0.72);
      const scrolled = Math.max(0, -rect.top);
      setReadProgress(Math.min(1, scrolled / scrollable));
    };
    const onScrollOrResize = () => {
      if (rafId === 0) {
        rafId = window.requestAnimationFrame(measure);
      }
    };
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
      if (rafId !== 0) window.cancelAnimationFrame(rafId);
    };
  }, [selectedItem?.id, sanitizedHtml]);

  // Detect text selection inside .study-prose for safe Quote Clipping (no DOM mutation)
  useEffect(() => {
    let timer: number | null = null;
    const checkSelection = () => {
      const sel = window.getSelection();
      const prose = proseRef.current;
      if (!sel || sel.isCollapsed || !prose) {
        setSelectedQuote('');
        return;
      }
      if (!prose.contains(sel.anchorNode) || !prose.contains(sel.focusNode)) {
        setSelectedQuote('');
        return;
      }
      const text = normalizeHighlightText(sel.toString());
      setSelectedQuote(text.length >= 4 ? text : '');
    };
    const onSelectionChange = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(checkSelection, 120);
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [selectedItem?.id]);

  const docHighlights = selectedItem ? (highlightsMap[selectedItem.id] ?? []) : [];

  const handleSaveHighlight = (color: HighlightColor) => {
    if (!selectedItem || !selectedQuote) return;
    const res = addStudyHighlight(highlightsMap, selectedItem.id, selectedQuote, color);
    if (res.duplicate) {
      showToast({ message: 'เก็บไฮไลต์ข้อความนี้ไว้แล้ว', tone: 'info' });
    } else if (res.added) {
      setHighlightsMap(res.next);
      setHighlightsOpen(true);
      playUiSound('checkin');
      showToast({
        message: 'เก็บข้อความสำคัญลงบทนี้แล้ว',
        detail: res.added.text,
        tone: 'success',
      });
    }
    setSelectedQuote('');
    try {
      window.getSelection()?.removeAllRanges();
    } catch {
      // Ignore selection clear errors
    }
  };

  const handleDeleteHighlight = (highlightId: string) => {
    if (!selectedItem) return;
    setHighlightsMap((prev) => removeStudyHighlight(prev, selectedItem.id, highlightId));
    playUiSound('tap');
  };

  const handleCopyHighlight = (text: string) => {
    playUiSound('tap');
    void navigator.clipboard
      ?.writeText(text)
      .then(() => {
        showToast({ message: 'คัดลอกข้อความแล้ว', tone: 'info' });
      })
      .catch(() => {});
  };

  const selectedSubject = selectedItem
    ? subjects.find((s) => s.code === selectedItem.subjectCode)
    : null;

  return (
    <>
      <div className="study-progress-track" aria-hidden="true">
        <div
          className="study-progress-fill"
          style={{ transform: `scaleX(${readProgress})` }}
        />
      </div>

      <div className="study-layout">
        <button
          type="button"
          className="study-mobile-toggle"
          onClick={() => setMobileListOpen((o) => !o)}
          aria-expanded={mobileListOpen}
        >
          <span>สารบัญเนื้อหา ({studyItems.length} บท)</span>
          <span>{mobileListOpen ? 'ซ่อนรายการ' : 'เลือกหัวข้อ'}</span>
        </button>

        <aside
          className={`study-sidebar${mobileListOpen ? '' : ' study-sidebar--collapsed'}`}
          aria-label="รายการหมวดวิชาและหัวข้อเนื้อหา"
        >
          <input
            type="search"
            className="study-search"
            placeholder="ค้นหาหัวข้อเนื้อหา ก.พ...."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="study-filters" role="group" aria-label="ตัวกรองบทเรียน">
            {(
              [
                ['all', 'ทั้งหมด'],
                ['unread', 'ยังไม่อ่าน'],
                ['bookmarked', 'บุ๊กมาร์ก'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`study-filter-btn${filter === key ? ' study-filter-btn--active' : ''}`}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="study-tree">
            {subjects.map((subject) => {
              const items = filteredItems.filter((i) => i.subjectCode === subject.code);
              if (items.length === 0) return null;

              const totalInSubj = studyItems.filter((i) => i.subjectCode === subject.code);
              const doneCount = totalInSubj.filter(
                (i) => progress.completedStudies[i.id]?.active === true,
              ).length;
              const isCollapsed = collapsedSubjects[subject.code] === true;
              const icon = getSubjectIcon(subject.code);

              return (
                <div key={subject.code}>
                  <button
                    type="button"
                    className="study-group-head"
                    onClick={() =>
                      setCollapsedSubjects((prev) => ({
                        ...prev,
                        [subject.code]: !prev[subject.code],
                      }))
                    }
                    aria-expanded={!isCollapsed}
                  >
                    <span className="study-group-title">
                      <LiquidGlassIcon name={icon.name} tone={icon.tone} size="sm" />
                      <span>{subject.shortTitle}</span>
                    </span>
                    <span className="study-group-count">
                      {doneCount}/{totalInSubj.length}
                    </span>
                  </button>

                  {!isCollapsed && (
                    <div className="study-items">
                      {items.map((item) => {
                        const active = selectedItem?.id === item.id;
                        const done = progress.completedStudies[item.id]?.active === true;
                        const bm = progress.bookmarkedStudies[item.id]?.active === true;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            className={`study-item-btn${active ? ' study-item-btn--active' : ''}`}
                            onClick={() => {
                              onNavigate({ name: 'study', docId: item.id });
                              setMobileListOpen(false);
                            }}
                          >
                            <span>{item.title}</span>
                            <span className="study-badges">
                              {bm && (
                                <span className="study-dot-bm" title="บุ๊กมาร์กไว้">
                                  ★
                                </span>
                              )}
                              {done && (
                                <span className="study-dot-done" title="อ่านจบแล้ว">
                                  ✓
                                </span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredItems.length === 0 && (
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', padding: '12px 6px' }}>
                ไม่พบหัวข้อที่ตรงกับเงื่อนไข
              </p>
            )}
          </div>
        </aside>

        <article className="study-reader" ref={readerRef}>
          {selectedItem ? (
            <>
              <header className="study-reader-top">
                <div>
                  {selectedSubject && (
                    <span className="study-subject-tag">{selectedSubject.title}</span>
                  )}
                  <h1 className="study-doc-title">{selectedItem.title}</h1>
                </div>

                <div className="study-toolbar">
                  <div className="study-font-group" role="group" aria-label="ปรับขนาดตัวอักษร">
                    {(
                      [
                        ['sm', 'ก-'],
                        ['md', 'ก'],
                        ['lg', 'ก+'],
                      ] as const
                    ).map(([sz, label]) => (
                      <button
                        key={sz}
                        type="button"
                        className={`study-font-btn${
                          progress.preferences.fontSize === sz ? ' study-font-btn--active' : ''
                        }`}
                        onClick={() => setFontSize(sz)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    className={`study-action-btn${isBookmarked ? ' study-action-btn--bm' : ''}`}
                    onClick={toggleBookmarked}
                    aria-pressed={isBookmarked}
                  >
                    <span>{isBookmarked ? '★ บุ๊กมาร์กแล้ว' : '☆ บุ๊กมาร์ก'}</span>
                  </button>

                  <button
                    type="button"
                    className={`study-action-btn${isCompleted ? ' study-action-btn--done' : ''}`}
                    onClick={toggleCompleted}
                    aria-pressed={isCompleted}
                  >
                    <span>{isCompleted ? '✓ อ่านจบแล้ว' : 'ทำเครื่องหมายว่าอ่านจบ'}</span>
                  </button>
                </div>
              </header>

              {docHighlights.length > 0 && (
                <section className="study-hl-bar" aria-label="ข้อความที่ไฮไลต์ไว้ในบทนี้">
                  <button
                    type="button"
                    className="study-hl-toggle"
                    onClick={() => setHighlightsOpen((v) => !v)}
                    aria-expanded={highlightsOpen}
                  >
                    <span>📌 ข้อความสำคัญที่เก็บไว้ ({docHighlights.length})</span>
                    <span>{highlightsOpen ? 'ซ่อน ▲' : 'เปิดดู ▼'}</span>
                  </button>
                  {highlightsOpen && (
                    <div className="study-hl-list">
                      {docHighlights.map((hl) => (
                        <div key={hl.id} className={`study-hl-card study-hl-card--${hl.color}`}>
                          <span className="study-hl-text">{hl.text}</span>
                          <span className="study-hl-actions">
                            <button
                              type="button"
                              className="study-hl-icon-btn"
                              onClick={() => handleCopyHighlight(hl.text)}
                              aria-label="คัดลอกข้อความ"
                              title="คัดลอก"
                            >
                              📋
                            </button>
                            <button
                              type="button"
                              className="study-hl-icon-btn"
                              onClick={() => handleDeleteHighlight(hl.id)}
                              aria-label="ลบไฮไลต์"
                              title="ลบ"
                            >
                              ✕
                            </button>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {loadingDoc && !docContent ? (
                <p style={{ marginTop: 28, color: 'var(--text-muted)' }}>กำลังโหลดเนื้อหา...</p>
              ) : (
                <div
                  ref={proseRef}
                  className={`study-prose study-prose--${progress.preferences.fontSize}`}
                  dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                />
              )}

              <footer className="study-footer-nav">
                {prevItem ? (
                  <button
                    type="button"
                    className="study-nav-btn"
                    onClick={() => {
                      onNavigate({ name: 'study', docId: prevItem.id });
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    ← บทก่อนหน้า: {prevItem.title}
                  </button>
                ) : (
                  <span />
                )}

                {nextItem ? (
                  <button
                    type="button"
                    className="study-nav-btn study-nav-btn--primary"
                    onClick={handleCompleteAndNext}
                  >
                    {isCompleted ? 'บทถัดไป' : 'อ่านจบแล้ว & ไปบทถัดไป'} →
                  </button>
                ) : (
                  <button
                    type="button"
                    className="study-nav-btn study-nav-btn--primary"
                    onClick={() => onNavigate({ name: 'exams', tab: 'interactive' })}
                  >
                    ลองทำข้อสอบฝึกซ้อม →
                  </button>
                )}
              </footer>
            </>
          ) : (
            <p style={{ color: 'var(--text-muted)' }}>ยังไม่มีเนื้อหาในคลัง</p>
          )}
        </article>
      </div>

      {selectedQuote && selectedItem && (
        <div className="study-clip-pill" role="region" aria-label="เก็บข้อความที่เลือก">
          <span className="study-clip-label">📌 เก็บไฮไลต์:</span>
          <button
            type="button"
            className="study-clip-btn study-clip-btn--yellow"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleSaveHighlight('yellow')}
          >
            เน้นจำ
          </button>
          <button
            type="button"
            className="study-clip-btn study-clip-btn--mint"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleSaveHighlight('mint')}
          >
            สูตร/หลัก
          </button>
          <button
            type="button"
            className="study-clip-btn study-clip-btn--pink"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleSaveHighlight('pink')}
          >
            ระวังออกสอบ
          </button>
          <button
            type="button"
            className="study-clip-close"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setSelectedQuote('')}
            aria-label="ยกเลิก"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
