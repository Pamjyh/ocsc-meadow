import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BootstrapPayload, SubjectCode, UserProgress } from '../../domain/models';
import {
  computeOfficialSubjectRollup,
  countActiveCompletedPdfs,
  countActiveCompletedStudies,
} from '../../domain/scoring';
import type { SyncStatus } from '../../services/dataRepository';
import type { AppRoute } from '../../services/router';
import {
  LiquidGlassIcon,
  type GlassIconName,
  type GlassIconTone,
} from '../../ui/LiquidGlassIcon';
import type { AmbientLayerKey, AmbientTrackId } from '../widgets/ambientAudio';
import { AestheticClockCard } from '../widgets/cards/AestheticClockCard';
import { AmbientPlayerCard } from '../widgets/cards/AmbientPlayerCard';
import { DailyGoalsCard } from '../widgets/cards/DailyGoalsCard';
import { PhotoCollectionCard } from '../widgets/cards/PhotoCollectionCard';
import { QuickStudyCard } from '../widgets/cards/QuickStudyCard';
import { StickyNoteCard } from '../widgets/cards/StickyNoteCard';
import { StudyStreakCard } from '../widgets/cards/StudyStreakCard';
import { FreeformWidgetGrid } from '../widgets/FreeformWidgetGrid';
import { WidgetGalleryModal } from '../widgets/WidgetGalleryModal';
import {
  addWidget,
  createDefaultWidgetLayout,
  loadWidgetLayout,
  moveWidget,
  removeWidget,
  saveWidgetLayout,
  toggleWidgetSize,
  updateWidgetConfig,
  updateWidgetGrid,
} from '../widgets/widgetStore';
import {
  type AmbientPlayerState,
  type WidgetGridRect,
  type WidgetItem,
  type WidgetLayoutState,
  type WidgetType,
} from '../widgets/widgetTypes';
import '../widgets/widgets.css';
import { CountdownCard } from './CountdownCard';
import './DashboardView.css';

interface DashboardViewProps {
  bootstrap: BootstrapPayload;
  progress: UserProgress;
  syncStatus: SyncStatus;
  onNavigate: (route: AppRoute) => void;
  audio: AmbientPlayerState;
  onSelectTrack: (trackId: AmbientTrackId) => void;
  onTogglePlay: () => void;
  onPrevTrack: () => void;
  onNextTrack: () => void;
  onChangeVolume: (volume: number) => void;
  onChangeLayer: (layer: AmbientLayerKey, level: number) => void;
}

const SYNC_LABELS: Record<SyncStatus, string> = {
  demo: 'โหมดข้อมูลตัวอย่าง',
  synced: 'เชื่อมต่อ Google Drive แล้ว',
  syncing: 'กำลังบันทึกความก้าวหน้า...',
  offline: 'ออฟไลน์ (ใช้ข้อมูลแคช)',
};

const STATUS_LABELS = {
  passed: 'ผ่านเกณฑ์',
  needs_work: 'เร่งอีกนิด',
  not_started: 'ยังไม่เริ่มสอบ',
} as const;

function getSubjectIconSpec(code: SubjectCode): {
  name: GlassIconName;
  tone: GlassIconTone;
} {
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

export function DashboardView({
  bootstrap,
  progress,
  syncStatus,
  onNavigate,
  audio,
  onSelectTrack,
  onTogglePlay,
  onPrevTrack,
  onNextTrack,
  onChangeVolume,
  onChangeLayer,
}: DashboardViewProps) {
  const { config, subjects, studyItems, pdfExams } = bootstrap;

  const [layout, setLayout] = useState<WidgetLayoutState>(loadWidgetLayout);
  const [editMode, setEditMode] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);

  useEffect(() => {
    saveWidgetLayout(layout);
  }, [layout]);

  const visibleItems = useMemo(
    () => layout.items.filter((item) => item.visible),
    [layout.items],
  );

  const handleMove = useCallback((id: string, dir: -1 | 1) => {
    setLayout((prev) => ({
      ...prev,
      items: moveWidget(prev.items, id, dir),
    }));
  }, []);

  const handleCommitGrid = useCallback((id: string, nextGrid: WidgetGridRect) => {
    setLayout((prev) => ({
      ...prev,
      items: updateWidgetGrid(prev.items, id, nextGrid),
    }));
  }, []);

  const handleToggleSize = useCallback((id: string) => {
    setLayout((prev) => ({
      ...prev,
      items: toggleWidgetSize(prev.items, id),
    }));
  }, []);

  const handleRemove = useCallback((id: string) => {
    setLayout((prev) => ({
      ...prev,
      items: removeWidget(prev.items, id),
    }));
  }, []);

  const handleAddByType = useCallback((type: WidgetType) => {
    setLayout((prev) => ({
      ...prev,
      items: addWidget(prev.items, type),
    }));
  }, []);

  const handleRemoveByType = useCallback((type: WidgetType) => {
    setLayout((prev) => {
      const target = prev.items.find((i) => i.type === type && i.visible);
      if (!target) return prev;
      return {
        ...prev,
        items: removeWidget(prev.items, target.id),
      };
    });
  }, []);

  const handleUpdateConfig = useCallback(
    (id: string, patch: Record<string, unknown>) => {
      setLayout((prev) => ({
        ...prev,
        items: updateWidgetConfig(prev.items, id, patch),
      }));
    },
    [],
  );

  const handleResetDefaults = useCallback(() => {
    setLayout(createDefaultWidgetLayout());
  }, []);

  const officialRollup = computeOfficialSubjectRollup(
    progress.examAttempts,
    config.passThresholds,
  );
  const studySummary = countActiveCompletedStudies(studyItems, progress);
  const pdfSummary = countActiveCompletedPdfs(pdfExams, progress);

  const lastStudy = progress.lastVisitedStudyId
    ? studyItems.find((s) => s.id === progress.lastVisitedStudyId) ?? null
    : null;
  const firstInProgressExamId = Object.keys(progress.inProgressExams)[0] ?? null;

  const renderWidget = (item: WidgetItem) => {
    switch (item.type) {
      case 'core_welcome':
        return (
          <div className="glass-card dash-welcome">
            <div>
              <div className="dash-status-row">
                <span className="dash-pill">{config.examLabel}</span>
                <span
                  className={`dash-pill${
                    syncStatus === 'synced'
                      ? ' dash-pill--sync'
                      : syncStatus === 'offline'
                        ? ' dash-pill--offline'
                        : ''
                  }`}
                >
                  {SYNC_LABELS[syncStatus]}
                </span>
              </div>
              <h1 className="dash-greeting" style={{ marginTop: 14 }}>
                สวัสดีครับ, {config.learnerName}
              </h1>
              <p className="dash-encourage">{config.encouragementMessage}</p>
            </div>

            <div className="dash-cta-row">
              {lastStudy ? (
                <button
                  type="button"
                  className="dash-btn-primary"
                  onClick={() => onNavigate({ name: 'study', docId: lastStudy.id })}
                >
                  อ่านต่อ: {lastStudy.title}
                </button>
              ) : (
                <button
                  type="button"
                  className="dash-btn-primary"
                  onClick={() =>
                    onNavigate({ name: 'study', docId: studyItems[0]?.id ?? null })
                  }
                >
                  เริ่มอ่านคลังเนื้อหา
                </button>
              )}

              {firstInProgressExamId ? (
                <button
                  type="button"
                  className="dash-btn-secondary"
                  onClick={() =>
                    onNavigate({ name: 'exam-runner', examId: firstInProgressExamId })
                  }
                >
                  ทำข้อสอบที่ค้างไว้ต่อ
                </button>
              ) : (
                <button
                  type="button"
                  className="dash-btn-secondary"
                  onClick={() => onNavigate({ name: 'exams', tab: 'interactive' })}
                >
                  ฝึกทำข้อสอบจับเวลา
                </button>
              )}
            </div>
          </div>
        );

      case 'core_countdown':
        return (
          <CountdownCard
            examDateIso={config.examDateIso}
            studyCompleted={studySummary.completed}
            studyTotal={studySummary.total}
            pdfCompleted={pdfSummary.completed}
            pdfTotal={pdfSummary.total}
          />
        );

      case 'core_pass_rollup':
        return (
          <section className="glass-card dash-rollup-card">
            <div className="dash-section-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <LiquidGlassIcon name="award" tone="meadow" size="sm" />
                <h2 className="dash-section-title">
                  ประเมินเกณฑ์ผ่าน 3 วิชา (ตามใบผลสอบ ก.พ. ป.ตรี จริง)
                </h2>
              </div>
              <span className="dash-section-sub">
                คิดวิเคราะห์รวมคะแนนคณิต + ไทย ≥ {config.passThresholds.analytical}% · อังกฤษ ≥{' '}
                {config.passThresholds.english}% · กฎหมาย ≥ {config.passThresholds.law}%
              </span>
            </div>

            <div className="dash-rollup-grid">
              {officialRollup.map((rollup) => {
                const pct = rollup.averagePercent ?? 0;
                return (
                  <div key={rollup.group} className="dash-official-item">
                    <div className="dash-official-top">
                      <span className="dash-official-name">{rollup.label}</span>
                      <span
                        className={`dash-status-tag dash-status-tag--${rollup.status}`}
                      >
                        {STATUS_LABELS[rollup.status]}
                      </span>
                    </div>
                    <div className="dash-bar-track">
                      <div
                        className={`dash-bar-fill dash-bar-fill--${rollup.status}`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <div className="dash-official-meta">
                      <span>
                        {rollup.averagePercent !== null
                          ? `คะแนนรวม ${rollup.averagePercent}% (${rollup.totalCorrect}/${rollup.totalQuestions})`
                          : 'ยังไม่มีผลสอบ Interactive'}
                      </span>
                      <span>เกณฑ์ ≥ {rollup.passThreshold}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );

      case 'core_subjects':
        return (
          <section
            className="dash-subjects-grid"
            aria-label="ความก้าวหน้าแยกตาม 4 หมวดวิชา"
          >
            {subjects.map((subject) => {
              const subjectStudies = studyItems.filter(
                (s) => s.subjectCode === subject.code,
              );
              const doneStudies = subjectStudies.filter(
                (s) => progress.completedStudies[s.id]?.active === true,
              ).length;
              const subjectPdfs = pdfExams.filter(
                (p) => p.subjectCode === subject.code,
              );
              const donePdfs = subjectPdfs.filter(
                (p) => progress.completedPdfs[p.id]?.active === true,
              ).length;
              const firstDocId = subjectStudies[0]?.id ?? null;
              const icon = getSubjectIconSpec(subject.code);

              return (
                <article key={subject.code} className="glass-card dash-subject-card">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <LiquidGlassIcon name={icon.name} tone={icon.tone} size="md" />
                      <h3 className="dash-subject-title">{subject.shortTitle}</h3>
                    </div>
                    <div className="dash-subject-stats" style={{ marginTop: 10 }}>
                      <span>
                        เนื้อหา: {doneStudies}/{subjectStudies.length} บท
                      </span>
                      <span>
                        ข้อสอบ PDF: {donePdfs}/{subjectPdfs.length} ชุด
                      </span>
                    </div>
                  </div>
                  <div className="dash-subject-actions">
                    <button
                      type="button"
                      className="dash-mini-btn"
                      onClick={() => onNavigate({ name: 'study', docId: firstDocId })}
                    >
                      อ่านสรุป
                    </button>
                    <button
                      type="button"
                      className="dash-mini-btn"
                      onClick={() => onNavigate({ name: 'exams', tab: 'interactive' })}
                    >
                      ทำข้อสอบ
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        );

      case 'ytm_player':
        return (
          <AmbientPlayerCard
            audio={audio}
            onSelectTrack={onSelectTrack}
            onTogglePlay={onTogglePlay}
            onPrevTrack={onPrevTrack}
            onNextTrack={onNextTrack}
            onChangeVolume={onChangeVolume}
            onChangeLayer={onChangeLayer}
          />
        );

      case 'photo_collection':
        return (
          <PhotoCollectionCard
            config={item.config}
            onUpdateConfig={(patch) => handleUpdateConfig(item.id, patch)}
          />
        );

      case 'sticky_note':
        return (
          <StickyNoteCard
            config={item.config}
            onUpdateConfig={(patch) => handleUpdateConfig(item.id, patch)}
          />
        );

      case 'study_streak':
        return <StudyStreakCard />;

      case 'aesthetic_clock':
        return (
          <AestheticClockCard
            config={item.config}
            onUpdateConfig={(patch) => handleUpdateConfig(item.id, patch)}
          />
        );

      case 'daily_goals':
        return (
          <DailyGoalsCard
            config={item.config}
            onUpdateConfig={(patch) => handleUpdateConfig(item.id, patch)}
          />
        );

      case 'quick_study':
        return (
          <QuickStudyCard
            exams={bootstrap.exams}
            lastStudy={lastStudy}
            onNavigate={onNavigate}
          />
        );
    }
  };

  return (
    <div className="dash-wrap">
      <div className="dash-toolbar">
        {editMode ? (
          <>
            <span className="dash-edit-hint">
              ⠿ ลากแถบหัวการ์ดเพื่อย้ายอิสระ · ดึงมุมขวาล่าง ↘ เพื่อปรับขนาด
            </span>
            <button
              type="button"
              className="widget-pill-btn widget-pill-btn--primary"
              onClick={() => setGalleryOpen(true)}
            >
              + เพิ่ม / ซ่อน Widget
            </button>
            <button
              type="button"
              className="widget-pill-btn"
              onClick={handleResetDefaults}
            >
              รีเซ็ตค่าเริ่มต้น
            </button>
            <button
              type="button"
              className="widget-pill-btn"
              onClick={() => setEditMode(false)}
            >
              เสร็จสิ้น
            </button>
          </>
        ) : (
          <button
            type="button"
            className="widget-pill-btn"
            onClick={() => setEditMode(true)}
          >
            ปรับแต่งหน้าแรก
          </button>
        )}
      </div>

      {visibleItems.length === 0 ? (
        <div className="bento-grid">
          <div className="glass-card widget-empty-card">
            <div className="widget-empty-title">หน้าแรกโล่งสบายตา</div>
            <p className="widget-empty-sub">
              คุณซ่อนหน้าต่างทั้งหมดไว้ สามารถเลือกเพิ่มกลับมาเมื่อไหร่ก็ได้
            </p>
            <div className="widget-empty-actions">
              <button
                type="button"
                className="widget-pill-btn widget-pill-btn--primary"
                onClick={() => setGalleryOpen(true)}
              >
                + เพิ่ม Widget
              </button>
              <button
                type="button"
                className="widget-pill-btn"
                onClick={handleResetDefaults}
              >
                รีเซ็ตค่าเริ่มต้น
              </button>
            </div>
          </div>
        </div>
      ) : (
        <FreeformWidgetGrid
          items={visibleItems}
          editMode={editMode}
          onCommitGrid={handleCommitGrid}
          onMove={handleMove}
          onToggleSize={handleToggleSize}
          onRemove={handleRemove}
          renderWidget={renderWidget}
        />
      )}

      <WidgetGalleryModal
        open={galleryOpen}
        items={layout.items}
        onAdd={handleAddByType}
        onRemoveByType={handleRemoveByType}
        onClose={() => setGalleryOpen(false)}
      />
    </div>
  );
}
