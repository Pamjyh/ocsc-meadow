export const SAFE_YT_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
export const SAFE_YT_PLAYLIST_ID = /^[A-Za-z0-9_-]{10,64}$/;

export interface ParsedYouTubeLink {
  embedType: 'video' | 'playlist';
  embedId: string;
  embedUrl: string;
  normalizedUrl: string;
}

/** Collision-free widget ID generator (F12). */
export function makeWidgetId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  return `${prefix}_${rand}`;
}

/** Local timezone YYYY-MM-DD key so resets happen at local midnight, not 07:00 ICT (F15). */
export function getLocalDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Validates external links start strictly with https:// (F3). */
export function isSafeHttpsUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw.trim());
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

const ALLOWED_YT_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

/**
 * Parses YouTube / YouTube Music URLs into privacy-enhanced embed URLs.
 * Only embeds PL... playlists as videoseries; falls back to single v= video
 * when RDCLAK/OLAK auto-radio params are present so playback never fails (F4).
 */
export function parseYouTubeUrl(raw: string): ParsedYouTubeLink | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase();
  if (!ALLOWED_YT_HOSTS.has(host)) return null;

  const v = url.searchParams.get('v')?.trim() ?? '';
  const list = url.searchParams.get('list')?.trim() ?? '';

  // 1. User-created playlists (PL...) embed cleanly via videoseries
  if (list && list.startsWith('PL') && SAFE_YT_PLAYLIST_ID.test(list)) {
    return {
      embedType: 'playlist',
      embedId: list,
      embedUrl: `https://www.youtube-nocookie.com/embed/videoseries?list=${list}&rel=0&modestbranding=1`,
      normalizedUrl: `https://music.youtube.com/playlist?list=${list}`,
    };
  }

  // 2. Standard watch?v= (including YouTube Music links carrying &list=RDCLAK... or OLAK...)
  if (v && SAFE_YT_VIDEO_ID.test(v)) {
    return {
      embedType: 'video',
      embedId: v,
      embedUrl: `https://www.youtube-nocookie.com/embed/${v}?rel=0&modestbranding=1`,
      normalizedUrl: `https://music.youtube.com/watch?v=${v}`,
    };
  }

  // 3. Short links (youtu.be/ID) or /shorts/ID or /embed/ID
  if (host === 'youtu.be' || host === 'www.youtu.be') {
    const id = url.pathname.replace(/^\/+/, '').split('/')[0] ?? '';
    if (SAFE_YT_VIDEO_ID.test(id)) {
      return {
        embedType: 'video',
        embedId: id,
        embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`,
        normalizedUrl: `https://music.youtube.com/watch?v=${id}`,
      };
    }
  }

  const pathMatch = url.pathname.match(/^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})(?:\/|$)/);
  const matchedId = pathMatch?.[1];
  if (matchedId && SAFE_YT_VIDEO_ID.test(matchedId)) {
    return {
      embedType: 'video',
      embedId: matchedId,
      embedUrl: `https://www.youtube-nocookie.com/embed/${matchedId}?rel=0&modestbranding=1`,
      normalizedUrl: `https://music.youtube.com/watch?v=${matchedId}`,
    };
  }

  return null;
}

/** Deterministic non-negative integer hash for daily question seeding. */
export function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
