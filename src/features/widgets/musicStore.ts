import { readJson, writeJson } from '../../services/storage';
import type { MusicSavedLink, MusicState } from './widgetTypes';
import { SAFE_YT_PLAYLIST_ID, SAFE_YT_VIDEO_ID, isSafeHttpsUrl } from './widgetUtils';

export const MUSIC_STORAGE_KEY = 'ocsc_meadow_music_v1';

export interface MusicPreset {
  id: string;
  title: string;
  subtitle: string;
  embedType: 'video' | 'playlist';
  embedId: string;
  originalUrl: string;
}

const YT_MUSIC_BASE = ['https://', 'music.', 'youtube.com'].join('');

export const MUSIC_PRESETS: readonly MusicPreset[] = [
  {
    id: 'preset_lofi',
    title: 'Lo-fi Beats อ่านหนังสือ',
    subtitle: 'จังหวะเบาๆ ช่วยโฟกัสต่อเนื่อง',
    embedType: 'video',
    embedId: 'jfKfPfyJRdk',
    originalUrl: `${YT_MUSIC_BASE}/watch?v=jfKfPfyJRdk`,
  },
  {
    id: 'preset_piano',
    title: 'เปียโนบรรเลงสบายๆ',
    subtitle: 'นุ่มนวล ลดความล้าสายตา',
    embedType: 'video',
    embedId: '4oStw0r33so',
    originalUrl: `${YT_MUSIC_BASE}/watch?v=4oStw0r33so`,
  },
  {
    id: 'preset_rain',
    title: 'เสียงฝน & คาเฟ่เงียบๆ',
    subtitle: 'บรรยากาศผ่อนคลายเหมือนนั่งร้านกาแฟ',
    embedType: 'video',
    embedId: 'mPZkdNFkNps',
    originalUrl: `${YT_MUSIC_BASE}/watch?v=mPZkdNFkNps`,
  },
] as const;

export function buildMusicEmbedUrl(
  embedType: 'video' | 'playlist',
  embedId: string,
): string | null {
  if (embedType === 'playlist' && SAFE_YT_PLAYLIST_ID.test(embedId)) {
    return `https://www.youtube-nocookie.com/embed/videoseries?list=${embedId}&rel=0&modestbranding=1`;
  }
  if (embedType === 'video' && SAFE_YT_VIDEO_ID.test(embedId)) {
    return `https://www.youtube-nocookie.com/embed/${embedId}?rel=0&modestbranding=1`;
  }
  return null;
}

export function createDefaultMusicState(): MusicState {
  const first = MUSIC_PRESETS[0]!;
  return {
    title: first.title,
    originalUrl: first.originalUrl,
    embedType: first.embedType,
    embedId: first.embedId,
    isOpen: false,
    isCollapsed: false,
    savedLinks: [],
  };
}

export function loadMusicState(): MusicState {
  const fallback = createDefaultMusicState();
  const saved = readJson<Partial<MusicState>>(MUSIC_STORAGE_KEY);
  if (!saved || typeof saved !== 'object') return fallback;

  const embedType = saved.embedType === 'playlist' ? 'playlist' : 'video';
  const embedId = typeof saved.embedId === 'string' ? saved.embedId : '';
  const validEmbed = buildMusicEmbedUrl(embedType, embedId) !== null;

  const savedLinks: MusicSavedLink[] = Array.isArray(saved.savedLinks)
    ? saved.savedLinks.filter(
        (item): item is MusicSavedLink =>
          Boolean(item) &&
          typeof item.id === 'string' &&
          typeof item.title === 'string' &&
          typeof item.originalUrl === 'string' &&
          isSafeHttpsUrl(item.originalUrl) &&
          (item.embedType === 'video' || item.embedType === 'playlist') &&
          typeof item.embedId === 'string' &&
          buildMusicEmbedUrl(item.embedType, item.embedId) !== null,
      )
    : [];

  return {
    title: typeof saved.title === 'string' && saved.title.trim() ? saved.title : fallback.title,
    originalUrl:
      typeof saved.originalUrl === 'string' && isSafeHttpsUrl(saved.originalUrl)
        ? saved.originalUrl
        : fallback.originalUrl,
    embedType: validEmbed ? embedType : fallback.embedType,
    embedId: validEmbed ? embedId : fallback.embedId,
    isOpen: false, // Always start closed on fresh page load so audio is user-initiated
    isCollapsed: typeof saved.isCollapsed === 'boolean' ? saved.isCollapsed : false,
    savedLinks,
  };
}

export function saveMusicState(state: MusicState): boolean {
  return writeJson(MUSIC_STORAGE_KEY, state);
}
