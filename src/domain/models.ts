export type StandardSubjectCode =
  | 'analytical_math'
  | 'analytical_thai'
  | 'english'
  | 'law';

export type SubjectCode = StandardSubjectCode | (string & {});

export type OfficialSubjectKey = 'analytical' | 'english' | 'law';

export type ChoiceKey = 'A' | 'B' | 'C' | 'D';

export type ExamMode = 'timed' | 'practice';

export interface PassThresholds {
  analytical: number; // ก.พ. ป.ตรี: 60% (รวมคณิต + ไทย)
  english: number; // ก.พ. ป.ตรี: 50%
  law: number; // ก.พ. ป.ตรี: 60%
}

export interface SiteConfig {
  siteTitle: string;
  learnerName: string;
  examLabel: string;
  examDateIso: string;
  encouragementMessage: string;
  passThresholds: PassThresholds;
}

export interface SubjectMeta {
  code: SubjectCode;
  title: string;
  shortTitle: string;
  officialGroup: OfficialSubjectKey;
  folderName: string;
  order: number;
  passPercent: number;
}

export interface StudyItem {
  id: string;
  subjectCode: SubjectCode;
  title: string;
  summary: string;
  order: number;
  updatedAt: string;
}

export interface StudyDocContent {
  id: string;
  title: string;
  updatedAt: string;
  html: string;
}

export interface ExamMeta {
  id: string;
  subjectCode: SubjectCode;
  title: string;
  description: string;
  durationMinutes: number;
  passPercent: number;
  questionCount: number;
  order: number;
}

export interface ExamQuestion {
  id: string;
  examId: string;
  order: number;
  promptMd: string;
  imageUrl?: string;
  choices: Record<ChoiceKey, string>;
  correctChoice: ChoiceKey;
  explanationMd: string;
  explanationImageUrl?: string;
}

export interface ExamDetail {
  exam: ExamMeta;
  questions: ExamQuestion[];
}

export interface PdfExamItem {
  id: string;
  subjectCode: SubjectCode;
  title: string;
  description: string;
  pageCount?: number;
  order: number;
  previewUrl: string;
  downloadUrl: string;
  updatedAt: string;
}

export interface BootstrapPayload {
  generatedAt: string;
  config: SiteConfig;
  subjects: SubjectMeta[];
  studyItems: StudyItem[];
  exams: ExamMeta[];
  pdfExams: PdfExamItem[];
}

/** Per-item LWW tombstone record to prevent zombie unchecks after sync (F3). */
export interface ToggleRecord {
  active: boolean;
  updatedAt: string;
}

export interface PdfNoteRecord {
  text: string;
  updatedAt: string;
}

export interface ExamAttempt {
  attemptId: string;
  examId: string;
  subjectCode: SubjectCode;
  mode: ExamMode;
  score: number;
  total: number;
  percent: number;
  passed: boolean;
  durationSeconds: number;
  finishedAt: string;
  /** Retained for latest 30 attempts; compacted out for older attempts to stay < 45 KB (F2). */
  answers?: Record<string, ChoiceKey>;
}

export interface InProgressExam {
  examId: string;
  mode: ExamMode;
  answers: Record<string, ChoiceKey>;
  flaggedIds: string[];
  remainingSeconds: number | null;
  startedAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  fontSize: 'sm' | 'md' | 'lg';
  focusMode: boolean;
  pomodoroMuted: boolean;
}

export interface UserProgress {
  version: 1;
  updatedAt: string;
  completedStudies: Record<string, ToggleRecord>;
  bookmarkedStudies: Record<string, ToggleRecord>;
  lastVisitedStudyId: string | null;
  completedPdfs: Record<string, ToggleRecord>;
  pdfNotes: Record<string, PdfNoteRecord>;
  examAttempts: ExamAttempt[];
  inProgressExams: Record<string, InProgressExam>;
  preferences: UserPreferences;
}

export function createEmptyProgress(nowIso = new Date().toISOString()): UserProgress {
  return {
    version: 1,
    updatedAt: nowIso,
    completedStudies: {},
    bookmarkedStudies: {},
    lastVisitedStudyId: null,
    completedPdfs: {},
    pdfNotes: {},
    examAttempts: [],
    inProgressExams: {},
    preferences: {
      fontSize: 'md',
      focusMode: false,
      pomodoroMuted: false,
    },
  };
}
