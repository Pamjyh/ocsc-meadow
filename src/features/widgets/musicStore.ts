import { readJson, writeJson } from '../../services/storage';
import {
  AMBIENT_TRACKS,
  type AmbientTrackId,
  type AmbientTrackMeta,
} from './ambientAudio';
import type { AmbientPlayerState } from './widgetTypes';

export const AMBIENT_STORAGE_KEY = 'ocsc_meadow_ambient_v1';

export function isAmbientTrackId(value: unknown): value is AmbientTrackId {
  return AMBIENT_TRACKS.some((t) => t.id === value);
}

export function getAmbientTrack(id: AmbientTrackId): AmbientTrackMeta {
  return AMBIENT_TRACKS.find((t) => t.id === id) ?? AMBIENT_TRACKS[0]!;
}

export function getNextTrackId(current: AmbientTrackId): AmbientTrackId {
  const idx = AMBIENT_TRACKS.findIndex((t) => t.id === current);
  const next = AMBIENT_TRACKS[(idx + 1) % AMBIENT_TRACKS.length];
  return next ? next.id : AMBIENT_TRACKS[0]!.id;
}

export function getPrevTrackId(current: AmbientTrackId): AmbientTrackId {
  const idx = AMBIENT_TRACKS.findIndex((t) => t.id === current);
  const prev = AMBIENT_TRACKS[(idx - 1 + AMBIENT_TRACKS.length) % AMBIENT_TRACKS.length];
  return prev ? prev.id : AMBIENT_TRACKS[0]!.id;
}

export function createDefaultAmbientState(): AmbientPlayerState {
  return {
    trackId: 'rain',
    isPlaying: false,
    volume: 0.55,
  };
}

export function loadAmbientState(): AmbientPlayerState {
  const fallback = createDefaultAmbientState();
  const saved = readJson<Partial<AmbientPlayerState>>(AMBIENT_STORAGE_KEY);
  if (!saved || typeof saved !== 'object') return fallback;

  return {
    trackId: isAmbientTrackId(saved.trackId) ? saved.trackId : fallback.trackId,
    isPlaying: false, // Always user-initiated on fresh load (F49)
    volume:
      typeof saved.volume === 'number' && Number.isFinite(saved.volume)
        ? Math.max(0, Math.min(1, saved.volume))
        : fallback.volume,
  };
}

export function saveAmbientState(state: AmbientPlayerState): boolean {
  return writeJson(AMBIENT_STORAGE_KEY, {
    trackId: state.trackId,
    volume: state.volume,
  });
}
