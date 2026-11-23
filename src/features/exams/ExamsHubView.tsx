import { useMemo, useState } from 'react';
import type {
  BootstrapPayload,
  ExamMode,
  SubjectCode,
  UserProgress,
} from '../../domain/models';
import type { AppRoute } from '../../services/router';
import {
  LiquidGlassIcon,
  type GlassIconName,
  type GlassIconTone,
} from '../../ui/LiquidGlassIcon';
import './ExamsView.css';

interface ExamsHubViewProps {
  bootstrap: BootstrapPayload;
  progress: UserProgress;
  activeTab: 'interactive' | 'pdf';
  onNavigate: (route: AppRoute) => void;
  onStartExam: (examId: string, mode: ExamMode) => void;
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
      return { name: 'exam', tone: 'amber' };
  }
}

export function ExamsHubView({
  bootstrap,
  progress,
  activeTab,
  onNavigate,
  onStartExam,
  onUpdateProgress,
}: ExamsHubViewProps) {
  const { subjects, exams, pdfExams } = bootstrap;
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [selectedPdfId, setSelectedPdfId] = useState<string>(pdfExams[0]?.id ?? '');

  const filteredExams = useMemo(
    () =>
      subjectFilter === 'all'
        ? exams
        : exams.filter((e) => e.subjectCode === subjectFilter),
    [exams, subjectFilter],
  );

  const filteredPdfs = useMemo(
    () =>
      subjectFilter === 'all'
        ? pdfExams
        : pdfExams.filter((p) => p.subjectCode === subjectFilter),
    [pdfExams, subjectFilter],
  );

  const activePdf =
    filteredPdfs.find((p) => p.id === selectedPdfId) ?? filteredPdfs[0] ?? null;

  const togglePdfCompleted = (pdfId: string) => {
    const prevActive = progress.completedPdfs[pdfId]?.active === true;
    const now = new Date().toISOString();
    onUpdateProgress((prev) => ({
      ...prev,
      completedPdfs: {
        ...prev.completedPdfs,
        [pdfId]: { active: !prevActive, updatedAt: now },
      },
    }));
  };

  const updatePdfNote = (pdfId: string, text: string) => {
    const now = new Date().toISOString();
    onUpdateProgress((prev) => ({
      ...prev,
      pdfNotes: {
        ...prev.pdfNotes,
        [pdfId]: { text, updatedAt: now },
      },
    }));
  };

  return (
    <div className="exams-wrap">
      <header className="exams-header-card">
        <div>
          <h1 style={{ fontSize: '1.38rem' }}>คลังข้อสอบ ก.พ. ภาค ก (ป.ตรี)</h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            แยก 2 รูปแบบเนื้อหาไม่ซ้ำกัน: ทำจับเวลาพร้อมเฉลยละเอียดในเว็บ และชุดข้อสอบ PDF เฉลยท้ายบท
          </p>
        </div>

        <div className="exams-tabs" role="tablist" aria-label="รูปแบบคลังข้อสอบ">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'interactive'}
            className={`exams-tab-btn${activeTab === 'interactive' ? ' exams-tab-btn--active' : ''}`}
            onClick={() => onNavigate({ name: 'exams', tab: 'interactive' })}
          >
            <LiquidGlassIcon name="exam" tone="amber" size="sm" shape="circle" />
            <span>ทำในเว็บ ({exams.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'pdf'}
            className={`exams-tab-btn${activeTab === 'pdf' ? ' exams-tab-btn--active' : ''}`}
            onClick={() => onNavigate({ name: 'exams', tab: 'pdf' })}
          >
            <LiquidGlassIcon name="pdf" tone="coral" size="sm" shape="circle" />
            <span>ชุด PDF เฉลยท้ายบท ({pdfExams.length})</span>
          </button>
        </div>
      </header>

      <div className="exams-subject-pills" role="group" aria-label="กรองตามหมวดวิชา">
        <button
          type="button"
          className={`exams-filter-pill${subjectFilter === 'all' ? ' exams-filter-pill--active' : ''}`}
          onClick={() => setSubjectFilter('all')}
        >
          ทุกหมวดวิชา
        </button>
        {subjects.map((s) => (
          <button
            key={s.code}
            type="button"
            className={`exams-filter-pill${subjectFilter === s.code ? ' exams-filter-pill--active' : ''}`}
            onClick={() => setSubjectFilter(s.code)}
          >
            {s.shortTitle}
          </button>
        ))}
      </div>

      {activeTab === 'interactive' ? (
        <section className="exams-grid">
          {filteredExams.map((exam) => {
            const icon = getSubjectIcon(exam.subjectCode);
            const inProgress = progress.inProgressExams[exam.id];
            const latestAttempt = progress.examAttempts.find((a) => a.examId === exam.id);

            return (
              <article key={exam.id} className="exam-card">
                <div>
                  <div className="exam-card-top">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <LiquidGlassIcon name={icon.name} tone={icon.tone} size="md" />
                      <div>
                        <h2 className="exam-card-title">{exam.title}</h2>
                      </div>
                    </div>
                  </div>
                  <p className="exam-card-desc">{exam.description}</p>
                </div>

                <div className="exam-meta-row">
                  <span className="exam-chip">{exam.questionCount} ข้อ</span>
                  <span className="exam-chip">เวลา {exam.durationMinutes} นาที</span>
                  <span className="exam-chip">เกณฑ์ผ่าน ≥ {exam.passPercent}%</span>
                  {inProgress && (
                    <span className="exam-chip exam-chip--resume">
                      ทำค้างไว้ ({Object.keys(inProgress.answers).length}/{exam.questionCount})
                    </span>
                  )}
                  {latestAttempt && (
                    <span
                      className={`exam-chip ${
                        latestAttempt.passed ? 'exam-chip--pass' : 'exam-chip--fail'
                      }`}
                    >
                      ล่าสุด {latestAttempt.score}/{latestAttempt.total} ({latestAttempt.percent}%)
                    </span>
                  )}
                </div>

                <div className="exam-card-actions">
                  {inProgress ? (
                    <button
                      type="button"
                      className="exam-btn-timed"
                      onClick={() =>
                        onNavigate({ name: 'exam-runner', examId: exam.id })
                      }
                    >
                      ทำชุดที่ค้างไว้ต่อ
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="exam-btn-timed"
                        onClick={() => onStartExam(exam.id, 'timed')}
                      >
                        สอบจริง (จับเวลา {exam.durationMinutes} น.)
                      </button>
                      <button
                        type="button"
                        className="exam-btn-practice"
                        onClick={() => onStartExam(exam.id, 'practice')}
                      >
                        ฝึกทำ (ไม่จับเวลา)
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="pdf-layout">
          <div className="pdf-list">
            {filteredPdfs.map((pdf) => {
              const done = progress.completedPdfs[pdf.id]?.active === true;
              const isSelected = activePdf?.id === pdf.id;
              return (
                <button
                  key={pdf.id}
                  type="button"
                  className={`pdf-item-card${isSelected ? ' pdf-item-card--active' : ''}`}
                  onClick={() => setSelectedPdfId(pdf.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong style={{ fontSize: '0.94rem', color: '#162432' }}>
                      {pdf.title}
                    </strong>
                    {done && <span className="exam-chip exam-chip--pass">✓ ทำแล้ว</span>}
                  </div>
                  <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                    {pdf.description}
                  </span>
                </button>
              );
            })}
          </div>

          {activePdf ? (
            <div className="pdf-viewer-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ fontSize: '1.15rem' }}>{activePdf.title}</h2>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                    {activePdf.description}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    type="button"
                    className={`study-action-btn${
                      progress.completedPdfs[activePdf.id]?.active ? ' study-action-btn--done' : ''
                    }`}
                    onClick={() => togglePdfCompleted(activePdf.id)}
                  >
                    {progress.completedPdfs[activePdf.id]?.active
                      ? '✓ ทำชุดนี้แล้ว'
                      : 'ทำเครื่องหมายว่าทำแล้ว'}
                  </button>
                  {activePdf.previewUrl && (
                    <a
                      href={activePdf.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="study-action-btn"
                    >
                      เปิดในแท็บใหม่
                    </a>
                  )}
                  {activePdf.downloadUrl && (
                    <a
                      href={activePdf.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="study-action-btn"
                    >
                      ดาวน์โหลด PDF
                    </a>
                  )}
                </div>
              </div>

              {activePdf.previewUrl ? (
                <iframe
                  title={activePdf.title}
                  src={activePdf.previewUrl}
                  className="pdf-iframe"
                  allow="autoplay"
                />
              ) : (
                <div className="pdf-demo-box">
                  <p style={{ fontWeight: 600, color: '#162432' }}>
                    โหมดข้อมูลตัวอย่าง — พร้อมแสดงไฟล์ PDF จริงทันทีเมื่อเชื่อม Google Drive
                  </p>
                  <p style={{ marginTop: 8, fontSize: '0.88rem' }}>
                    แค่นำไฟล์ข้อสอบ PDF (ที่มีเฉลยท้ายบท) ไปวางในโฟลเดอร์{' '}
                    <code>02_PDF_Exams/</code> ใน Google Drive ระบบจะดึงมาแสดงในหน้านี้พร้อมปุ่มดาวน์โหลดให้อัตโนมัติ
                  </p>
                </div>
              )}

              <div>
                <label
                  htmlFor="pdfNote"
                  style={{ display: 'block', fontSize: '0.86rem', fontWeight: 600, marginBottom: 6 }}
                >
                  โน้ตส่วนตัวของชุดนี้ (บันทึกอัตโนมัติ)
                </label>
                <textarea
                  id="pdfNote"
                  className="pdf-note-input"
                  placeholder="จดคะแนนที่ตรวจเอง หรือข้อที่ต้องกลับมาทบทวน..."
                  value={progress.pdfNotes[activePdf.id]?.text ?? ''}
                  onChange={(e) => updatePdfNote(activePdf.id, e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="pdf-viewer-card">
              <p style={{ color: 'var(--text-muted)' }}>ยังไม่มีชุดข้อสอบ PDF ในหมวดนี้</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
