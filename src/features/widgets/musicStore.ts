import { readJson, writeJson } from '../../services/storage';
import {
  AMBIENT_TRACKS,
  type AmbientLayers,
  type AmbientTrackId,
  type AmbientTrackMeta,
} from './ambientAudio';
import type { AmbientPlayerState } from './widgetTypes';

export const AMBIENT_STORAGE_KEY = 'ocsc_meadow_ambient_v1';

const LEGACY_TRACK_MAP: Record<
  string,
  { trackId: AmbientTrackId; layers?: Partial<AmbientLayers> }
> = {
  lofi: { trackId: 'lofi-chill' },
  rain: { trackId: 'lofi-chill', layers: { rain: 0.45 } },
  meadow: { trackId: 'midnight-piano', layers: { wind: 0.35 } },
  focus: { trackId: 'deep-focus', layers: { brown: 0.35 } },
};

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
  const prev =
    AMBIENT_TRACKS[(idx - 1 + AMBIENT_TRACKS.length) % AMBIENT_TRACKS.length];
  return prev ? prev.id : AMBIENT_TRACKS[0]!.id;
}

export function createDefaultAmbientLayers(): AmbientLayers {
  return {
    rain: 0.25,
    wind: 0,
    vinyl: 0.18,
    brown: 0,
  };
}

export function createDefaultAmbientState(): AmbientPlayerState {
  return {
    trackId: 'lofi-chill',
    isPlaying: false,
    volume: 0.6,
    layers: createDefaultAmbientLayers(),
  };
}

function clampUnit(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : fallback;
}

export function loadAmbientState(): AmbientPlayerState {
  const fallback = createDefaultAmbientState();
  const saved = readJson<Partial<AmbientPlayerState> & { trackId?: string }>(
    AMBIENT_STORAGE_KEY,
  );
  if (!saved || typeof saved !== 'object') return fallback;

  let trackId: AmbientTrackId = fallback.trackId;
  let legacyLayers: Partial<AmbientLayers> | undefined;

  if (isAmbientTrackId(saved.trackId)) {
    trackId = saved.trackId;
  } else if (typeof saved.trackId === 'string' && saved.trackId in LEGACY_TRACK_MAP) {
    const mapped = LEGACY_TRACK_MAP[saved.trackId]!;
    trackId = mapped.trackId;
    legacyLayers = mapped.layers;
  }

  const rawLayers =
    saved.layers && typeof saved.layers === 'object' ? saved.layers : legacyLayers;

  return {
    trackId,
    isPlaying: false, // Always user-initiated on fresh load (F49)
    volume: clampUnit(saved.volume, fallback.volume),
    layers: {
      rain: clampUnit(rawLayers?.rain, fallback.layers.rain),
      wind: clampUnit(rawLayers?.wind, fallback.layers.wind),
      vinyl: clampUnit(rawLayers?.vinyl, fallback.layers.vinyl),
      brown: clampUnit(rawLayers?.brown, fallback.layers.brown),
    },
  };
}

export function saveAmbientState(state: AmbientPlayerState): boolean {
  return writeJson(AMBIENT_STORAGE_KEY, {
    trackId: state.trackId,
    volume: state.volume,
    layers: state.layers,
  });
}
