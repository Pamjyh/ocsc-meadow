import { useCallback, useEffect, useRef, useState } from 'react';
import { getBangkokHourFloat, isDarkAtmosphere } from './domain/atmosphere';
import type { BootstrapPayload, ExamMode, UserProgress } from './domain/models';
import { DashboardView } from './features/dashboard/DashboardView';
import { ExamRunnerView } from './features/exams/ExamRunnerView';
import { ExamsHubView } from './features/exams/ExamsHubView';
import { MeadowScene } from './features/meadow/MeadowScene';
import { PomodoroWidget } from './features/pomodoro/PomodoroWidget';
import { StudyView } from './features/study/StudyView';
import {
  loadCachedBootstrap,
  loadLocalProgress,
  revalidateFromRemote,
  scheduleProgressSync,
  type SyncStatus,
} from './services/dataRepository';
import { useHashRoute } from './services/router';
import { LiquidGlassFilters } from './ui/LiquidGlassFilters';
import { TopNav } from './ui/TopNav';

export function App() {
  const { route, navigate } = useHashRoute();
  const [bootstrap, setBootstrap] = useState<BootstrapPayload>(loadCachedBootstrap);
  const [progress, setProgress] = useState<UserProgress>(loadLocalProgress);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('demo');
  const [hourFloat, setHourFloat] = useState<number>(() => getBangkokHourFloat());
  const [selectedExamMode, setSelectedExamMode] = useState<ExamMode>('timed');

  const progressRef = useRef<UserProgress>(progress);
  progressRef.current = progress;

  useEffect(() => {
    const syncClock = () => setHourFloat(getBangkokHourFloat());
    const onVisibility = () => {
      if (document.visibilityState === 'visible') syncClock();
    };
    const id = window.setInterval(syncClock, 60_000);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    let active = true;
    revalidateFromRemote().then(({ bootstrap: remote, mergedProgress, status }) => {
      if (!active) return;
      if (remote) setBootstrap(remote);
      progressRef.current = mergedProgress;
      setProgress(mergedProgress);
      setSyncStatus(status);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia('(hover: hover)').matches) {
      return;
    }
    const handleMove = (e: PointerEvent) => {
      const target = (e.target as HTMLElement | null)?.closest('.glass-card') as HTMLElement | null;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      target.style.setProperty('--mx', `${e.clientX - rect.left}px`);
      target.style.setProperty('--my', `${e.clientY - rect.top}px`);
    };
    window.addEventListener('pointermove', handleMove, { passive: true });
    return () => window.removeEventListener('pointermove', handleMove);
  }, []);

  const updateProgress = useCallback(
    (updater: (prev: UserProgress) => UserProgress) => {
      const next: UserProgress = {
        ...updater(progressRef.current),
        updatedAt: new Date().toISOString(),
      };
      progressRef.current = next;
      setProgress(next);
      scheduleProgressSync(next, setSyncStatus);
    },
    [],
  );

  const handleStartExam = useCallback(
    (examId: string, mode: ExamMode) => {
      setSelectedExamMode(mode);
      navigate({ name: 'exam-runner', examId });
    },
    [navigate],
  );

  const toggleFocusMode = useCallback(() => {
    updateProgress((prev) => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        focusMode: !prev.preferences.focusMode,
      },
    }));
  }, [updateProgress]);

  const togglePomodoroMuted = useCallback(() => {
    updateProgress((prev) => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        pomodoroMuted: !prev.preferences.pomodoroMuted,
      },
    }));
  }, [updateProgress]);

  const isReadingView = route.name !== 'dashboard';
  const isNight = isDarkAtmosphere(hourFloat);

  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) {
      meta.content = isNight ? '#0f1c2e' : '#5fa4d1';
    }
  }, [isNight]);

  return (
    <div className={`app-shell${isNight ? ' theme-night' : ''}`}>
      <LiquidGlassFilters />

      <MeadowScene
        dimmed={isReadingView}
        focusMode={progress.preferences.focusMode}
        hourFloat={hourFloat}
      />

      <TopNav
        siteTitle={bootstrap.config.siteTitle}
        route={route}
        focusMode={progress.preferences.focusMode}
        onNavigate={navigate}
        onToggleFocusMode={toggleFocusMode}
      />

      <main className="app-main">
        {route.name === 'dashboard' && (
          <DashboardView
            bootstrap={bootstrap}
            progress={progress}
            syncStatus={syncStatus}
            onNavigate={navigate}
          />
        )}

        {route.name === 'study' && (
          <StudyView
            bootstrap={bootstrap}
            progress={progress}
            activeDocId={route.docId}
            onNavigate={navigate}
            onUpdateProgress={updateProgress}
          />
        )}

        {route.name === 'exams' && (
          <ExamsHubView
            bootstrap={bootstrap}
            progress={progress}
            activeTab={route.tab}
            onNavigate={navigate}
            onStartExam={handleStartExam}
            onUpdateProgress={updateProgress}
          />
        )}

        {route.name === 'exam-runner' && (
          <ExamRunnerView
            key={route.examId}
            examId={route.examId}
            initialMode={selectedExamMode}
            progress={progress}
            onNavigate={navigate}
            onUpdateProgress={updateProgress}
          />
        )}
      </main>

      <PomodoroWidget
        muted={progress.preferences.pomodoroMuted}
        onToggleMute={togglePomodoroMuted}
      />
    </div>
  );
}
