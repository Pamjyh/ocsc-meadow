import {
  createEmptyProgress,
  type BootstrapPayload,
  type ExamDetail,
  type StudyDocContent,
  type UserProgress,
} from '../domain/models';
import {
  compactProgressForSync,
  mergeUserProgress,
  parseUserProgress,
} from '../domain/progressMerge';
import {
  SEED_BOOTSTRAP,
  SEED_EXAMS,
  SEED_STUDY_DOCS,
} from '../data/seedSnapshot';
import {
  fetchBootstrap,
  fetchExamDetail,
  fetchRemoteProgress,
  fetchStudyDoc,
  isRemoteConfigured,
  pushRemoteProgress,
} from './apiClient';
import { readJson, writeJson } from './storage';

const CACHE_BOOTSTRAP_KEY = 'ocsc_meadow_cache_v1';
const CACHE_DOC_PREFIX = 'ocsc_meadow_doc_v1_';
const CACHE_EXAM_PREFIX = 'ocsc_meadow_exam_v1_';
const PROGRESS_KEY = 'ocsc_meadow_progress_v1';
const SYNC_DEBOUNCE_MS = 2500;

export type SyncStatus = 'demo' | 'synced' | 'syncing' | 'offline';

let syncTimer: ReturnType<typeof setTimeout> | null = null;

/** Immediate <200ms synchronous load from localStorage cache or static seed snapshot. */
export function loadCachedBootstrap(): BootstrapPayload {
  const cached = readJson<BootstrapPayload>(CACHE_BOOTSTRAP_KEY);
  if (cached && Array.isArray(cached.subjects) && Array.isArray(cached.studyItems)) {
    return cached;
  }
  return SEED_BOOTSTRAP;
}

export function loadLocalProgress(): UserProgress {
  const raw = readJson<unknown>(PROGRESS_KEY);
  return parseUserProgress(raw) ?? createEmptyProgress();
}

export function saveLocalProgress(progress: UserProgress): void {
  writeJson(PROGRESS_KEY, progress);
}

/**
 * Stale-While-Revalidate bootstrap + progress merge in the background.
 * Re-reads fresh localStorage AFTER await so edits made during initial fetch are never overwritten (F1).
 */
export async function revalidateFromRemote(): Promise<{
  bootstrap: BootstrapPayload | null;
  mergedProgress: UserProgress;
  status: SyncStatus;
}> {
  if (!isRemoteConfigured()) {
    return {
      bootstrap: null,
      mergedProgress: loadLocalProgress(),
      status: 'demo',
    };
  }

  try {
    const [remoteBootstrap, remoteProgress] = await Promise.all([
      fetchBootstrap(),
      fetchRemoteProgress(),
    ]);

    if (remoteBootstrap) {
      writeJson(CACHE_BOOTSTRAP_KEY, remoteBootstrap);
    }

    // Re-read fresh local state post-await to prevent overwriting edits made while fetching
    const freshLocal = loadLocalProgress();
    const mergedProgress = mergeUserProgress(freshLocal, remoteProgress);
    if (remoteProgress) {
      saveLocalProgress(mergedProgress);
    }

    return {
      bootstrap: remoteBootstrap,
      mergedProgress,
      status: remoteBootstrap ? 'synced' : 'offline',
    };
  } catch {
    return {
      bootstrap: null,
      mergedProgress: loadLocalProgress(),
      status: 'offline',
    };
  }
}

export async function loadStudyDoc(
  docId: string,
  expectedUpdatedAt?: string,
): Promise<StudyDocContent | null> {
  const cacheKey = `${CACHE_DOC_PREFIX}${docId}`;
  const cached = readJson<StudyDocContent>(cacheKey);
  if (cached && (!expectedUpdatedAt || cached.updatedAt === expectedUpdatedAt)) {
    return cached;
  }

  if (isRemoteConfigured()) {
    try {
      const remote = await fetchStudyDoc(docId);
      if (remote) {
        writeJson(cacheKey, remote);
        return remote;
      }
    } catch {
      if (cached) return cached;
    }
  }

  return cached ?? SEED_STUDY_DOCS[docId] ?? null;
}

export async function loadExamDetail(examId: string): Promise<ExamDetail | null> {
  const cacheKey = `${CACHE_EXAM_PREFIX}${examId}`;
  const cached = readJson<ExamDetail>(cacheKey);

  if (isRemoteConfigured()) {
    try {
      const remote = await fetchExamDetail(examId);
      if (remote) {
        writeJson(cacheKey, remote);
        return remote;
      }
    } catch {
      if (cached) return cached;
    }
  }

  return cached ?? SEED_EXAMS[examId] ?? null;
}

/** Debounced background sync to Google Sheets with <45KB payload compaction. */
export function scheduleProgressSync(
  progress: UserProgress,
  onStatusChange?: (status: SyncStatus) => void,
): void {
  saveLocalProgress(progress);

  if (!isRemoteConfigured()) {
    onStatusChange?.('demo');
    return;
  }

  if (syncTimer) clearTimeout(syncTimer);
  onStatusChange?.('syncing');

  syncTimer = setTimeout(async () => {
    try {
      const compacted = compactProgressForSync(progress);
      const ok = await pushRemoteProgress(compacted);
      onStatusChange?.(ok ? 'synced' : 'offline');
    } catch {
      onStatusChange?.('offline');
    }
  }, SYNC_DEBOUNCE_MS);
}
