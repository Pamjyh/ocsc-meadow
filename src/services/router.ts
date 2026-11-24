import { useCallback, useEffect, useState } from 'react';

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

export function useHashRoute(): {
  route: AppRoute;
  navigate: (next: AppRoute) => void;
} {
  const [route, setRoute] = useState<AppRoute>(() =>
    parseHash(window.location.hash),
  );

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((next: AppRoute) => {
    const targetHash = buildHash(next);
    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash;
    } else {
      setRoute(next);
    }
  }, []);

  return { route, navigate };
}
