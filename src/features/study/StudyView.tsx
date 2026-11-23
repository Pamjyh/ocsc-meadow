import { useEffect, useMemo, useState } from 'react';
import type {
  BootstrapPayload,
  StudyDocContent,
  SubjectCode,
  UserProgress,
} from '../../domain/models';
import { sanitizeStudyHtml } from '../../domain/sanitize';
import { loadStudyDoc } from '../../services/dataRepository';
import type { AppRoute } from '../../services/router';
import {
  LiquidGlassIcon,
  type GlassIconName,
  type GlassIconTone,
} from '../../ui/LiquidGlassIcon';
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
    const now = new Date().toISOString();
    onUpdateProgress((prev) => ({
      ...prev,
      completedStudies: {
        ...prev.completedStudies,
        [selectedItem.id]: { active: !isCompleted, updatedAt: now },
      },
    }));
  };

  const toggleBookmarked = () => {
    if (!selectedItem) return;
    const now = new Date().toISOString();
    onUpdateProgress((prev) => ({
      ...prev,
      bookmarkedStudies: {
        ...prev.bookmarkedStudies,
        [selectedItem.id]: { active: !isBookmarked, updatedAt: now },
      },
    }));
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

  const selectedSubject = selectedItem
    ? subjects.find((s) => s.code === selectedItem.subjectCode)
    : null;

  return (
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
                  className={`study-action-btn${isCompleted ? ' study-action-btn--done' : ''}`}
                  onClick={toggleCompleted}
                  aria-pressed={isCompleted}
                >
                  <span>{isCompleted ? '✓ อ่านจบแล้ว' : 'ทำเครื่องหมายว่าอ่านจบ'}</span>
                </button>
              </div>
            </header>

            {loadingDoc && !docContent ? (
              <p style={{ marginTop: 28, color: 'var(--text-muted)' }}>กำลังโหลดเนื้อหา...</p>
            ) : (
              <div
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
  );
}
