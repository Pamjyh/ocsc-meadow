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
import { CountdownCard } from './CountdownCard';
import './DashboardView.css';

interface DashboardViewProps {
  bootstrap: BootstrapPayload;
  progress: UserProgress;
  syncStatus: SyncStatus;
  onNavigate: (route: AppRoute) => void;
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
}: DashboardViewProps) {
  const { config, subjects, studyItems, pdfExams } = bootstrap;
  const officialRollup = computeOfficialSubjectRollup(
    progress.examAttempts,
    config.passThresholds,
  );
  const studySummary = countActiveCompletedStudies(studyItems, progress);
  const pdfSummary = countActiveCompletedPdfs(pdfExams, progress);

  const lastStudy = progress.lastVisitedStudyId
    ? studyItems.find((s) => s.id === progress.lastVisitedStudyId)
    : null;
  const firstInProgressExamId = Object.keys(progress.inProgressExams)[0] ?? null;

  return (
    <div className="dash-wrap">
      <section className="dash-hero">
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
                onClick={() => onNavigate({ name: 'study', docId: studyItems[0]?.id ?? null })}
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

        <CountdownCard
          examDateIso={config.examDateIso}
          studyCompleted={studySummary.completed}
          studyTotal={studySummary.total}
          pdfCompleted={pdfSummary.completed}
          pdfTotal={pdfSummary.total}
        />
      </section>

      {/* Official 3-subject OCSC Bachelor's passing bar (combining Math + Thai into Analytical >= 60%) */}
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
          {officialRollup.map((item) => {
            const pct = item.averagePercent ?? 0;
            return (
              <div key={item.group} className="dash-official-item">
                <div className="dash-official-top">
                  <span className="dash-official-name">{item.label}</span>
                  <span className={`dash-status-tag dash-status-tag--${item.status}`}>
                    {STATUS_LABELS[item.status]}
                  </span>
                </div>
                <div className="dash-bar-track">
                  <div
                    className={`dash-bar-fill dash-bar-fill--${item.status}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                <div className="dash-official-meta">
                  <span>
                    {item.averagePercent !== null
                      ? `คะแนนรวม ${item.averagePercent}% (${item.totalCorrect}/${item.totalQuestions})`
                      : 'ยังไม่มีผลสอบ Interactive'}
                  </span>
                  <span>เกณฑ์ ≥ {item.passThreshold}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4-Subject Study & Exam Breakdown with Liquid Glass Icons */}
      <section className="dash-subjects-grid" aria-label="ความก้าวหน้าแยกตาม 4 หมวดวิชา">
        {subjects.map((subject) => {
          const subjectStudies = studyItems.filter((s) => s.subjectCode === subject.code);
          const doneStudies = subjectStudies.filter(
            (s) => progress.completedStudies[s.id]?.active === true,
          ).length;
          const subjectPdfs = pdfExams.filter((p) => p.subjectCode === subject.code);
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
    </div>
  );
}
