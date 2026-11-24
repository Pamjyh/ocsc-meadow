import { describe, expect, it } from 'vitest';
import { AMBIENT_LAYERS_META, AMBIENT_TRACKS } from '../ambientAudio';
import {
  createDefaultAmbientState,
  getAmbientTrack,
  getNextTrackId,
  getPrevTrackId,
} from '../musicStore';
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

describe('Studio Lo-fi & Multi-Layer Ambient Player', () => {
  it('cycles forward and backward cleanly across all 4 studio tracks and 4 ambient layers', () => {
    expect(AMBIENT_TRACKS).toHaveLength(4);
    expect(AMBIENT_LAYERS_META).toHaveLength(4);
    expect(getNextTrackId('lofi-chill')).toBe('midnight-piano');
    expect(getNextTrackId('deep-focus')).toBe('lofi-chill');
    expect(getPrevTrackId('lofi-chill')).toBe('deep-focus');
    expect(getAmbientTrack('lofi-chill').title).toContain('Lo-fi');

    const defaults = createDefaultAmbientState();
    expect(defaults.isPlaying).toBe(false);
    expect(defaults.layers.rain).toBeGreaterThan(0);
  });
});
