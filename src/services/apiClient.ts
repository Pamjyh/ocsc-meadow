import type {
  BootstrapPayload,
  ExamDetail,
  StudyDocContent,
  UserProgress,
} from '../domain/models';
import { parseUserProgress } from '../domain/progressMerge';

const GAS_BASE_URL = (import.meta.env?.VITE_GAS_URL as string | undefined)?.trim() ?? '';
const REQUEST_TIMEOUT_MS = 12_000;

export function isRemoteConfigured(): boolean {
  return GAS_BASE_URL.length > 0;
}

/**
 * Fetches JSON safely with a 12s AbortController timeout and guards against
 * Google Apps Script returning HTTP 200 HTML error pages (F3).
 */
async function fetchJsonSafe(
  url: string,
  init: RequestInit,
): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...init,
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const text = await response.text();
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  } finally {
    clearTimeout(timer);
  }
}

async function getJson<T>(params: Record<string, string>): Promise<T | null> {
  if (!isRemoteConfigured()) return null;
  const query = new URLSearchParams(params).toString();
  const url = `${GAS_BASE_URL}${GAS_BASE_URL.includes('?') ? '&' : '?'}${query}`;

  const data = await fetchJsonSafe(url, { method: 'GET' });
  if (!data || data.ok === false) return null;
  return data as unknown as T;
}

export async function fetchBootstrap(): Promise<BootstrapPayload | null> {
  return getJson<BootstrapPayload>({ action: 'bootstrap' });
}

export async function fetchStudyDoc(docId: string): Promise<StudyDocContent | null> {
  return getJson<StudyDocContent>({ action: 'doc', id: docId });
}

export async function fetchExamDetail(examId: string): Promise<ExamDetail | null> {
  return getJson<ExamDetail>({ action: 'exam', id: examId });
}

export async function fetchRemoteProgress(
  profileKey = 'default',
): Promise<UserProgress | null> {
  const res = await getJson<{ progress?: unknown }>({
    action: 'progress',
    key: profileKey,
  });
  if (!res?.progress) return null;
  return parseUserProgress(res.progress);
}

/**
 * Sends POST as text/plain;charset=utf-8 with redirect: 'follow' to avoid
 * CORS preflight OPTIONS which Google Apps Script Web Apps do not support (BD2).
 */
export async function pushRemoteProgress(
  progress: UserProgress,
  profileKey = 'default',
): Promise<boolean> {
  if (!isRemoteConfigured()) return false;
  const url = `${GAS_BASE_URL}${GAS_BASE_URL.includes('?') ? '&' : '?'}action=progress`;

  const data = await fetchJsonSafe(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      key: profileKey,
      updatedAt: progress.updatedAt,
      progress,
    }),
  });
  return data?.ok === true;
}
