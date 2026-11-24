import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

export type AppRoute =
  | { name: 'dashboard' }
  | { name: 'study'; docId: string | null }
  | { name: 'exams'; tab: 'interactive' | 'pdf' | 'review' }
  | { name: 'exam-runner'; examId: string };

export function parseHash(rawHash: string): AppRoute {
  const cleaned = rawHash.replace(/^#\/?/, '').trim();
  if (!cleaned) {
    return { name: 'dashboard' };
  }

  const segments = cleaned.split('/').filter(Boolean);
  const first = segments[0];
  const second = segments[1] ? decodeURIComponent(segments[1]) : null;

  if (first === 'study') {
    return { name: 'study', docId: second };
  }

  if (first === 'exams') {
    if (!second) return { name: 'exams', tab: 'interactive' };
    if (second === 'pdf') return { name: 'exams', tab: 'pdf' };
    if (second === 'review') return { name: 'exams', tab: 'review' };
    return { name: 'exam-runner', examId: second };
  }

  return { name: 'dashboard' };
}

export function buildHash(route: AppRoute): string {
  switch (route.name) {
    case 'dashboard':
      return '#/';
    case 'study':
      return route.docId ? `#/study/${encodeURIComponent(route.docId)}` : '#/study';
    case 'exams':
      return route.tab === 'pdf'
        ? '#/exams/pdf'
        : route.tab === 'review'
          ? '#/exams/review'
          : '#/exams';
    case 'exam-runner':
      return `#/exams/${encodeURIComponent(route.examId)}`;
  }
}

export function isSameRoute(a: AppRoute, b: AppRoute): boolean {
  if (a.name !== b.name) return false;
  if (a.name === 'study' && b.name === 'study') return a.docId === b.docId;
  if (a.name === 'exams' && b.name === 'exams') return a.tab === b.tab;
  if (a.name === 'exam-runner' && b.name === 'exam-runner') return a.examId === b.examId;
  return true;
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (updateCallback: () => void) => { finished: Promise<void> };
};

function canRunViewTransition(enabled: boolean): boolean {
  if (!enabled || typeof document === 'undefined' || typeof window === 'undefined') {
    return false;
  }
  const doc = document as ViewTransitionDocument;
  if (typeof doc.startViewTransition !== 'function') return false;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  return true;
}

export function useHashRoute(options?: { enableViewTransition?: boolean }): {
  route: AppRoute;
  navigate: (next: AppRoute) => void;
} {
  const [route, setRoute] = useState<AppRoute>(() =>
    parseHash(window.location.hash),
  );
  const enableVtRef = useRef(options?.enableViewTransition ?? true);
  enableVtRef.current = options?.enableViewTransition ?? true;

  useEffect(() => {
    const onHashChange = () => {
      const parsed = parseHash(window.location.hash);
      setRoute((prev) => (isSameRoute(prev, parsed) ? prev : parsed));
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((next: AppRoute) => {
    const targetHash = buildHash(next);
    const apply = () => {
      if (window.location.hash !== targetHash) {
        window.location.hash = targetHash;
      }
      setRoute((prev) => (isSameRoute(prev, next) ? prev : next));
    };

    if (canRunViewTransition(enableVtRef.current)) {
      const doc = document as ViewTransitionDocument;
      try {
        doc.startViewTransition?.(() => {
          flushSync(apply);
        });
        return;
      } catch {
        // Fallback to immediate navigation if view transition is unavailable
      }
    }
    apply();
  }, []);

  return { route, navigate };
}
