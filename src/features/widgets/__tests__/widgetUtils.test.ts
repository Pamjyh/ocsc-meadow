import { describe, expect, it } from 'vitest';
import { AMBIENT_TRACKS } from '../ambientAudio';
import { getAmbientTrack, getNextTrackId, getPrevTrackId } from '../musicStore';
import { getLocalDateKey, hashString, makeWidgetId } from '../widgetUtils';

describe('getLocalDateKey, makeWidgetId & hashString', () => {
  it('formats local calendar date as YYYY-MM-DD (F15)', () => {
    const d = new Date(2026, 10, 5, 1, 15, 0);
    expect(getLocalDateKey(d)).toBe('2026-11-05');
  });

  it('generates distinct IDs and deterministic hashes (F12)', () => {
    expect(makeWidgetId('sticky_note')).not.toBe(makeWidgetId('sticky_note'));
    expect(hashString('2026-11-23')).toBe(hashString('2026-11-23'));
  });
});

describe('Ambient & Lo-fi track navigation', () => {
  it('cycles forward and backward cleanly across all 4 built-in tracks', () => {
    expect(AMBIENT_TRACKS.length).toBe(4);
    expect(getNextTrackId('rain')).toBe('lofi');
    expect(getNextTrackId('focus')).toBe('rain');
    expect(getPrevTrackId('rain')).toBe('focus');
    expect(getAmbientTrack('lofi').title).toContain('Lo-fi');
  });
});
