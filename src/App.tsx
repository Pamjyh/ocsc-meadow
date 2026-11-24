import { useCallback, useEffect, useRef, useState } from 'react';
import { getBangkokHourFloat } from './domain/atmosphere';
import type { BootstrapPayload, ExamMode, UserProgress } from './domain/models';
import { DashboardView } from './features/dashboard/DashboardView';
import { ExamRunnerView } from './features/exams/ExamRunnerView';
import { ExamsHubView } from './features/exams/ExamsHubView';
import { MeadowScene } from './features/meadow/MeadowScene';
import {
  isSceneDark,
  loadSelectedScene,
  saveSelectedScene,
  type SceneId,
} from './features/meadow/sceneCatalog';
import { PomodoroWidget } from './features/pomodoro/PomodoroWidget';
import { StudyView } from './features/study/StudyView';
import {
  ambientEngine,
  type AmbientLayerKey,
  type AmbientTrackId,
} from './features/widgets/ambientAudio';
import { GlobalMusicDock } from './features/widgets/GlobalMusicDock';
import {
  getAmbientTrack,
  getNextTrackId,
  getPrevTrackId,
  loadAmbientState,
  saveAmbientState,
} from './features/widgets/musicStore';
import type { AmbientPlayerState } from './features/widgets/widgetTypes';
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
import { ZenFocusOverlay } from './ui/ZenFocusOverlay';

export function App() {
  const { route, navigate } = useHashRoute();
  const [bootstrap, setBootstrap] = useState<BootstrapPayload>(loadCachedBootstrap);
  const [progress, setProgress] = useState<UserProgress>(loadLocalProgress);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('demo');
  const [hourFloat, setHourFloat] = useState<number>(() => getBangkokHourFloat());
  const [selectedExamMode, setSelectedExamMode] = useState<ExamMode>('timed');
  const [audio, setAudio] = useState<AmbientPlayerState>(loadAmbientState);
  const [sceneId, setSceneId] = useState<SceneId>(loadSelectedScene);
  const [zenMode, setZenMode] = useState(false);

  const audioRef = useRef<AmbientPlayerState>(audio);
  audioRef.current = audio;

  useEffect(() => {
    saveAmbientState(audio);
  }, [audio.trackId, audio.volume, audio.layers]);

  useEffect(() => {
    saveSelectedScene(sceneId);
  }, [sceneId]);

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

  // F49: Synchronous Web Audio resume/play inside user click handlers for Safari/iOS
  const handleSelectTrack = useCallback((trackId: AmbientTrackId) => {
    const cur = audioRef.current;
    const ok = ambientEngine.play(trackId, cur.volume, cur.layers);
    setAudio((prev) => ({ ...prev, trackId, isPlaying: ok }));
  }, []);

  const handleTogglePlay = useCallback(() => {
    const cur = audioRef.current;
    if (cur.isPlaying) {
      ambientEngine.pause();
      setAudio((prev) => ({ ...prev, isPlaying: false }));
    } else {
      const ok = ambientEngine.play(cur.trackId, cur.volume, cur.layers);
      setAudio((prev) => ({ ...prev, isPlaying: ok }));
    }
  }, []);

  const handlePrevTrack = useCallback(() => {
    const cur = audioRef.current;
    const prevId = getPrevTrackId(cur.trackId);
    if (cur.isPlaying) {
      ambientEngine.play(prevId, cur.volume, cur.layers);
    }
    setAudio((prev) => ({ ...prev, trackId: prevId }));
  }, []);

  const handleNextTrack = useCallback(() => {
    const cur = audioRef.current;
    const nextId = getNextTrackId(cur.trackId);
    if (cur.isPlaying) {
      ambientEngine.play(nextId, cur.volume, cur.layers);
    }
    setAudio((prev) => ({ ...prev, trackId: nextId }));
  }, []);

  const handleChangeVolume = useCallback((volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume));
    ambientEngine.setVolume(clamped);
    setAudio((prev) => ({ ...prev, volume: clamped }));
  }, []);

  const handleChangeLayer = useCallback((layer: AmbientLayerKey, level: number) => {
    const clamped = Math.max(0, Math.min(1, level));
    ambientEngine.setLayerLevel(layer, clamped);
    setAudio((prev) => ({
      ...prev,
      layers: { ...prev.layers, [layer]: clamped },
    }));
  }, []);

  // Media Session API: hardware media keys, AirPods & lock screen controls
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const track = getAmbientTrack(audio.trackId);
    try {
      if (typeof MediaMetadata !== 'undefined') {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: `${track.emoji} ${track.title}`,
          artist: 'OCSC Meadow',
          album: 'เสียงอ่านหนังสือ & Lo-fi',
          artwork: [{ src: './app-icon.jpg', sizes: '512x512', type: 'image/jpeg' }],
        });
      }
      navigator.mediaSession.playbackState = audio.isPlaying ? 'playing' : 'paused';
      navigator.mediaSession.setActionHandler('play', () => {
        const cur = audioRef.current;
        if (!cur.isPlaying) {
          const ok = ambientEngine.play(cur.trackId, cur.volume, cur.layers);
          setAudio((prev) => ({ ...prev, isPlaying: ok }));
        }
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        if (audioRef.current.isPlaying) {
          ambientEngine.pause();
          setAudio((prev) => ({ ...prev, isPlaying: false }));
        }
      });
      navigator.mediaSession.setActionHandler('previoustrack', handlePrevTrack);
      navigator.mediaSession.setActionHandler('nexttrack', handleNextTrack);
    } catch {
      // Ignore browsers with partial Media Session support
    }
  }, [audio.trackId, audio.isPlaying, handlePrevTrack, handleNextTrack]);

  const handleEnterZen = useCallback(() => {
    setZenMode(true);
    try {
      const el = document.documentElement;
      if (el.requestFullscreen && !document.fullscreenElement) {
        void el.requestFullscreen().catch(() => {
          // Graceful CSS fullscreen fallback (e.g. iOS Safari)
        });
      }
    } catch {
      // Ignore fullscreen API errors
    }
  }, []);

  const handleExitZen = useCallback(() => {
    setZenMode(false);
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        void document.exitFullscreen().catch(() => {
          // Ignore fullscreen exit errors
        });
      }
    } catch {
      // Ignore fullscreen API errors
    }
  }, []);

  useEffect(() => {
    if (!zenMode) return;
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setZenMode(false);
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [zenMode]);

  const isReadingView = route.name !== 'dashboard';
  const isNight = isSceneDark(sceneId, hourFloat);

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
        sceneId={sceneId}
        dimmed={isReadingView && !zenMode}
        focusMode={progress.preferences.focusMode}
        hourFloat={hourFloat}
      />

      {zenMode ? (
        <ZenFocusOverlay
          sceneId={sceneId}
          audio={audio}
          onSelectScene={setSceneId}
          onTogglePlay={handleTogglePlay}
          onPrevTrack={handlePrevTrack}
          onNextTrack={handleNextTrack}
          onExit={handleExitZen}
        />
      ) : (
        <>
          <TopNav
            siteTitle={bootstrap.config.siteTitle}
            route={route}
            focusMode={progress.preferences.focusMode}
            sceneId={sceneId}
            onNavigate={navigate}
            onToggleFocusMode={toggleFocusMode}
            onSelectScene={setSceneId}
            onEnterZen={handleEnterZen}
          />

          <main className="app-main">
            {route.name === 'dashboard' && (
              <DashboardView
                bootstrap={bootstrap}
                progress={progress}
                syncStatus={syncStatus}
                onNavigate={navigate}
                audio={audio}
                onSelectTrack={handleSelectTrack}
                onTogglePlay={handleTogglePlay}
                onPrevTrack={handlePrevTrack}
                onNextTrack={handleNextTrack}
                onChangeVolume={handleChangeVolume}
                onChangeLayer={handleChangeLayer}
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

          <GlobalMusicDock
            audio={audio}
            onTogglePlay={handleTogglePlay}
            onPrevTrack={handlePrevTrack}
            onNextTrack={handleNextTrack}
          />
        </>
      )}

      <PomodoroWidget
        muted={progress.preferences.pomodoroMuted}
        onToggleMute={togglePomodoroMuted}
      />
    </div>
  );
}
