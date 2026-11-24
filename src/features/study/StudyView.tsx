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
import {
  addCustomClozeFlashcard,
  buildClozeFront,
} from '../exams/customFlashcardsStore';
import { recordStudyActivity } from '../widgets/streakStore';
import {
  loadAllBlurts,
  saveBlurtNote,
  type StudyBlurtMap,
} from './studyBlurtStore';
import {
  addStudyHighlight,
  loadAllStudyHighlights,
  normalizeHighlightText,
  removeStudyHighlight,
  type HighlightColor,
  type StudyHighlight,
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
  const [blurtMode, setBlurtMode] = useState<'read' | 'blurt' | 'compare'>('read');
  const [blurtMap, setBlurtMap] = useState<StudyBlurtMap>(loadAllBlurts);
  const [blurtDraft, setBlurtDraft] = useState('');
  const [allHighlightsOpen, setAllHighlightsOpen] = useState(false);
  const [allHlColorFilter, setAllHlColorFilter] = useState<'all' | HighlightColor>('all');
  const [clozeTarget, setClozeTarget] = useState<{ hl: StudyHighlight; docTitle: string; subjectCode: SubjectCode } | null>(null);
  const [clozePhrase, setClozePhrase] = useState('');
  const blurtMapRef = useRef(blurtMap);
  blurtMapRef.current = blurtMap;
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

  // Reset blurt mode & load saved draft when switching chapters (F91)
  useEffect(() => {
    setBlurtMode('read');
    setBlurtDraft(selectedItem ? (blurtMapRef.current[selectedItem.id]?.text ?? '') : '');
  }, [selectedItem?.id]);

  // Debounce localStorage persistence so typing/spaces/newlines never lag or get stripped (F91)
  useEffect(() => {
    const docId = selectedItem?.id;
    if (!docId) return;
    const savedText = blurtMapRef.current[docId]?.text ?? '';
    if (blurtDraft === savedText) return;
    const id = window.setTimeout(() => {
      setBlurtMap((prev) => saveBlurtNote(prev, docId, blurtDraft));
    }, 250);
    return () => window.clearTimeout(id);
  }, [blurtDraft, selectedItem?.id]);

  // Track exact document scroll progress (0%..100%) across any chapter length & blurtMode (F83, F92)
  useEffect(() => {
    setSelectedQuote('');
    let rafId = 0;
    const measure = () => {
      rafId = 0;
      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight;
      if (maxScroll <= 10) {
        setReadProgress(0);
        return;
      }
      setReadProgress(Math.max(0, Math.min(1, window.scrollY / maxScroll)));
    };
    const onScrollOrResize = () => {
      if (rafId === 0) {
        rafId = window.requestAnimationFrame(measure);
      }
    };
    measure();
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
      if (rafId !== 0) window.cancelAnimationFrame(rafId);
    };
  }, [selectedItem?.id, sanitizedHtml, blurtMode]);

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
  const studyItemById = useMemo(() => new Map(studyItems.map((s) => [s.id, s])), [studyItems]);
  const allHighlightsFlat = useMemo(() => {
    const rows: { hl: StudyHighlight; docTitle: string; subjectCode: SubjectCode }[] = [];
    for (const [docId, list] of Object.entries(highlightsMap)) {
      const meta = studyItemById.get(docId);
      if (!meta) continue;
      for (const hl of list) {
        rows.push({ hl, docTitle: meta.title, subjectCode: meta.subjectCode });
      }
    }
    return rows.sort((a, b) => b.hl.createdAt.localeCompare(a.hl.createdAt));
  }, [highlightsMap, studyItemById]);

  const openClozeBuilder = (hl: StudyHighlight, docTitle: string, subjectCode: SubjectCode) => {
    setClozeTarget({ hl, docTitle, subjectCode });
    setClozePhrase('');
  };

  const clozePreview = clozeTarget ? buildClozeFront(clozeTarget.hl.text, clozePhrase) : null;

  // Close StudyView modals cleanly layer-by-layer on Escape (F96)
  useEffect(() => {
    if (!clozeTarget && !allHighlightsOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (clozeTarget) setClozeTarget(null);
      else if (allHighlightsOpen) setAllHighlightsOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clozeTarget, allHighlightsOpen]);

  const filteredAllHighlights = useMemo(
    () =>
      allHighlightsFlat.filter(
        (row) => allHlColorFilter === 'all' || row.hl.color === allHlColorFilter,
      ),
    [allHighlightsFlat, allHlColorFilter],
  );

  const handleCreateClozeCard = () => {
    if (!clozeTarget || !clozePreview) return;
    const res = addCustomClozeFlashcard({
      subjectCode: clozeTarget.subjectCode,
      tag: clozeTarget.docTitle,
      fullText: clozeTarget.hl.text,
      hiddenPhrase: clozePhrase,
    });
    if (res.duplicate) {
      showToast({ message: 'มีแฟลชการ์ดเติมคำใบนี้อยู่แล้ว', tone: 'info' });
      setClozeTarget(null);
      setClozePhrase('');
    } else if (res.added) {
      playUiSound('checkin');
      showToast({
        message: 'สร้างแฟลชการ์ดเติมคำ (Cloze) แล้ว!',
        detail: 'เข้าไปทบทวนได้ที่ คลังข้อสอบ → แฟลชการ์ด FSRS',
        tone: 'success',
      });
      setClozeTarget(null);
      setClozePhrase('');
    }
  };

  const handleClearBlurt = () => {
    if (!selectedItem) return;
    setBlurtDraft('');
    setBlurtMap((prev) => saveBlurtNote(prev, selectedItem.id, ''));
  };

  const handleToggleBlurtMode = () => {
    playUiSound('tap');
    setSelectedQuote('');
    setBlurtMode((prev) => (prev === 'read' ? 'blurt' : 'read'));
  };

  const handleFinishBlurtReview = () => {
    if (!selectedItem) return;
    setBlurtMap((prev) => saveBlurtNote(prev, selectedItem.id, blurtDraft));
    recordStudyActivity(1);
    playUiSound('checkin');
    showToast({
      message: 'ทบทวนแบบ Blurting สำเร็จ (+1 Streak)',
      detail: selectedItem.title,
      tone: 'success',
    });
    setBlurtMode('read');
  };

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

          {allHighlightsFlat.length > 0 && (
            <button
              type="button"
              className="study-all-hl-btn"
              onClick={() => {
                playUiSound('tap');
                setAllHighlightsOpen(true);
              }}
            >
              📌 รวมไฮไลต์ทั้งหมดทุกบท ({allHighlightsFlat.length})
            </button>
          )}

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

        <article className="study-reader">
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
                    className={`study-action-btn${blurtMode !== 'read' ? ' study-action-btn--blurt' : ''}`}
                    onClick={handleToggleBlurtMode}
                    aria-pressed={blurtMode !== 'read'}
                    title="ปิดตำราเพื่อลองเขียนสรุปจากความจำ แล้วเทียบกับเนื้อหาจริง"
                  >
                    <span>{blurtMode === 'read' ? '🧠 ปิดตำราเขียนทวน' : '📖 กลับโหมดอ่าน'}</span>
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

              {blurtMode !== 'blurt' && docHighlights.length > 0 && (
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
                              onClick={() =>
                                openClozeBuilder(hl, selectedItem.title, selectedItem.subjectCode)
                              }
                              aria-label="แปลงเป็นการ์ดเติมคำ Cloze"
                              title="แปลงเป็นแฟลชการ์ดเติมคำ (Cloze)"
                            >
                              🃏
                            </button>
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

              {blurtMode === 'blurt' ? (
                <section className="study-blurt-panel" aria-label="กระดานเขียนทวนแบบปิดตำรา">
                  <div className="study-blurt-head">
                    <div>
                      <strong className="study-blurt-title">
                        🧠 ปิดตำราเขียนทวน (Blurting Recall)
                      </strong>
                      <p className="study-blurt-sub">
                        ซ่อนเนื้อหาและไฮไลต์ไว้ชั่วคราว ลองพิมพ์หลักการ สูตร หรือมาตราที่จำได้ด้วยภาษาตัวเอง
                      </p>
                    </div>
                    <span className="study-blurt-count">{blurtDraft.length} / 4,000 ตัวอักษร</span>
                  </div>

                  <textarea
                    className="study-blurt-textarea"
                    rows={10}
                    maxLength={4000}
                    placeholder="ลองเขียนทุกอย่างที่จำได้จากบทนี้ เช่น หลักการสำคัญ สูตร ข้อยกเว้น หรือคำศัพท์..."
                    value={blurtDraft}
                    onChange={(e) => setBlurtDraft(e.target.value)}
                  />

                  <div className="study-blurt-actions">
                    <button
                      type="button"
                      className="study-nav-btn study-nav-btn--primary"
                      onClick={() => {
                        playUiSound('tap');
                        setBlurtMode('compare');
                      }}
                    >
                      เปิดเทียบกับเนื้อหาจริง →
                    </button>
                    <button
                      type="button"
                      className="study-nav-btn"
                      disabled={blurtDraft.length === 0}
                      onClick={handleClearBlurt}
                    >
                      ล้างข้อความ
                    </button>
                  </div>
                </section>
              ) : blurtMode === 'compare' ? (
                <div className="study-compare-grid">
                  <section className="study-blurt-panel study-blurt-panel--compact">
                    <div className="study-blurt-head">
                      <strong className="study-blurt-title">✍️ สิ่งที่คุณเขียนทวนไว้</strong>
                      <button
                        type="button"
                        className="study-action-btn"
                        onClick={() => setBlurtMode('blurt')}
                      >
                        ซ่อนตำราอีกรอบ
                      </button>
                    </div>
                    <textarea
                      className="study-blurt-textarea study-blurt-textarea--compare"
                      rows={12}
                      maxLength={4000}
                      placeholder="เติมจุดที่เพิ่งนึกออกหรือตกหล่นลงที่นี่ได้เลย..."
                      value={blurtDraft}
                      onChange={(e) => setBlurtDraft(e.target.value)}
                    />
                    <div className="study-blurt-actions">
                      <button
                        type="button"
                        className="study-nav-btn study-nav-btn--primary"
                        disabled={blurtDraft.trim().length === 0}
                        onClick={handleFinishBlurtReview}
                      >
                        ✓ จบการทวน (+1 Streak)
                      </button>
                    </div>
                  </section>

                  <div className="study-compare-source">
                    {loadingDoc && !docContent ? (
                      <p style={{ color: 'var(--text-muted)' }}>กำลังโหลดเนื้อหา...</p>
                    ) : (
                      <div
                        ref={proseRef}
                        className={`study-prose study-prose--${progress.preferences.fontSize}`}
                        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                      />
                    )}
                  </div>
                </div>
              ) : loadingDoc && !docContent ? (
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

      {allHighlightsOpen && (
        <div
          className="study-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="รวมไฮไลต์ทั้งหมดทุกบท"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAllHighlightsOpen(false);
          }}
        >
          <div className="study-modal-card">
            <div className="study-modal-head">
              <strong className="study-modal-title">
                📌 รวมไฮไลต์ทั้งหมดทุกบท ({allHighlightsFlat.length})
              </strong>
              <button
                type="button"
                className="study-action-btn"
                onClick={() => setAllHighlightsOpen(false)}
              >
                ปิด
              </button>
            </div>

            <div className="study-modal-pills">
              {(
                [
                  ['all', 'ทั้งหมด'],
                  ['yellow', '🟡 เน้นจำ'],
                  ['mint', '🟢 สูตร/หลัก'],
                  ['pink', '🩷 ระวังออกสอบ'],
                ] as const
              ).map(([cKey, label]) => (
                <button
                  key={cKey}
                  type="button"
                  className={`study-filter-btn${
                    allHlColorFilter === cKey ? ' study-filter-btn--active' : ''
                  }`}
                  onClick={() => setAllHlColorFilter(cKey)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="study-modal-body">
              {filteredAllHighlights.length === 0 ? (
                <p className="study-modal-empty">ยังไม่มีไฮไลต์ในหมวดสีนี้</p>
              ) : (
                filteredAllHighlights.map(({ hl, docTitle, subjectCode }) => (
                  <div key={hl.id} className={`study-hl-card study-hl-card--${hl.color}`}>
                    <div className="study-hl-text">
                      <div style={{ fontSize: '0.74rem', opacity: 0.78, marginBottom: 2 }}>
                        {docTitle}
                      </div>
                      <div>{hl.text}</div>
                    </div>
                    <span className="study-hl-actions">
                      <button
                        type="button"
                        className="study-hl-icon-btn"
                        onClick={() => openClozeBuilder(hl, docTitle, subjectCode)}
                        title="แปลงเป็นแฟลชการ์ดเติมคำ"
                        aria-label="แปลงเป็นแฟลชการ์ดเติมคำ"
                      >
                        🃏
                      </button>
                      <button
                        type="button"
                        className="study-hl-icon-btn"
                        onClick={() => {
                          setAllHighlightsOpen(false);
                          onNavigate({ name: 'study', docId: hl.docId });
                        }}
                        title="เปิดอ่านบทนี้"
                        aria-label="เปิดอ่านบทนี้"
                      >
                        ↗
                      </button>
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {clozeTarget && (
        <div
          className="study-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="สร้างแฟลชการ์ดเติมคำ Cloze"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setClozeTarget(null);
          }}
        >
          <div className="study-modal-card">
            <div className="study-modal-head">
              <strong className="study-modal-title">🃏 แปลงไฮไลต์เป็นการ์ดเติมคำ (Cloze)</strong>
              <button
                type="button"
                className="study-action-btn"
                onClick={() => setClozeTarget(null)}
              >
                ปิด
              </button>
            </div>

            <div
              className="cloze-source-box"
              onMouseUp={() => {
                const picked = window.getSelection()?.toString().trim() ?? '';
                if (picked.length >= 2 && clozeTarget.hl.text.toLowerCase().includes(picked.toLowerCase())) {
                  setClozePhrase(picked);
                }
              }}
            >
              {clozeTarget.hl.text}
            </div>

            <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>
              พิมพ์หรือลากคลุมคำด้านบนที่ต้องการซ่อนเป็น [ ..... ]:
              <input
                type="text"
                className="cloze-input"
                style={{ marginTop: 6 }}
                placeholder="เช่น มาตรา 30 หรือคำศัพท์สำคัญ..."
                value={clozePhrase}
                onChange={(e) => setClozePhrase(e.target.value)}
              />
            </label>

            {clozePreview && (
              <div className="cloze-preview-box">
                <div style={{ fontSize: '0.76rem', fontWeight: 700, marginBottom: 4 }}>
                  ตัวอย่างหน้าการ์ด:
                </div>
                <div>{clozePreview}</div>
              </div>
            )}

            <div className="study-blurt-actions">
              <button
                type="button"
                className="study-nav-btn study-nav-btn--primary"
                disabled={!clozePreview}
                onClick={handleCreateClozeCard}
              >
                บันทึกเข้าแฟลชการ์ด FSRS
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
