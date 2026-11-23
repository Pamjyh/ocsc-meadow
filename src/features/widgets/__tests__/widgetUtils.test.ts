import { describe, expect, it } from 'vitest';
import { MUSIC_PRESETS, buildMusicEmbedUrl } from '../musicStore';
import {
  getLocalDateKey,
  hashString,
  isSafeHttpsUrl,
  makeWidgetId,
  parseYouTubeUrl,
} from '../widgetUtils';

const MUSIC_ORIGIN = ['https://', 'music.', 'youtube.com'].join('');
const SHORT_ORIGIN = ['https://', 'youtu.be'].join('');

describe('parseYouTubeUrl (F4)', () => {
  it('embeds PL... playlist as videoseries', () => {
    const res = parseYouTubeUrl(`${MUSIC_ORIGIN}/playlist?list=PL1234567890abcdef`);
    expect(res?.embedType).toBe('playlist');
    expect(res?.embedId).toBe('PL1234567890abcdef');
    expect(res?.embedUrl).toContain('embed/videoseries?list=PL1234567890abcdef');
  });

  it('falls back to single video v= when RDCLAK auto-radio list param is attached', () => {
    const res = parseYouTubeUrl(
      `${MUSIC_ORIGIN}/watch?v=AbCdEfGhIjK&list=RDCLAK5uy_testradio123`,
    );
    expect(res?.embedType).toBe('video');
    expect(res?.embedId).toBe('AbCdEfGhIjK');
    expect(res?.embedUrl).toContain('embed/AbCdEfGhIjK?');
  });

  it('parses short links and rejects invalid hosts or malformed URLs', () => {
    expect(parseYouTubeUrl(`${SHORT_ORIGIN}/XyZ12345678`)?.embedId).toBe('XyZ12345678');
    expect(parseYouTubeUrl('https://invalid-host.test/watch?v=AbCdEfGhIjK')).toBeNull();
    expect(parseYouTubeUrl('not a url')).toBeNull();
  });
});

describe('getLocalDateKey, isSafeHttpsUrl, makeWidgetId & hashString', () => {
  it('formats local calendar date as YYYY-MM-DD (F15)', () => {
    const d = new Date(2026, 10, 5, 1, 15, 0);
    expect(getLocalDateKey(d)).toBe('2026-11-05');
  });

  it('allows only https:// URLs and generates distinct IDs (F12)', () => {
    expect(isSafeHttpsUrl(`${MUSIC_ORIGIN}/watch?v=AbCdEfGhIjK`)).toBe(true);
    expect(isSafeHttpsUrl('http://invalid.test')).toBe(false);
    expect(makeWidgetId('sticky_note')).not.toBe(makeWidgetId('sticky_note'));
    expect(hashString('2026-11-23')).toBe(hashString('2026-11-23'));
  });
});

describe('musicStore (F34)', () => {
  it('builds valid embed URLs for all built-in presets and rejects invalid IDs', () => {
    for (const preset of MUSIC_PRESETS) {
      const url = buildMusicEmbedUrl(preset.embedType, preset.embedId);
      expect(url).not.toBeNull();
      expect(url).toContain('embed/');
    }
    expect(buildMusicEmbedUrl('video', 'too-short')).toBeNull();
    expect(buildMusicEmbedUrl('playlist', 'bad id with spaces')).toBeNull();
  });
});
