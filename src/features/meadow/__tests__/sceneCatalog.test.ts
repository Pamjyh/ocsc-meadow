import { describe, expect, it } from 'vitest';
import {
  getSceneOption,
  isSceneDark,
  isSceneId,
  SCENE_CATALOG,
} from '../sceneCatalog';

describe('sceneCatalog', () => {
  it('registers meadow plus 4 custom living anime scenes', () => {
    expect(SCENE_CATALOG).toHaveLength(5);
    expect(isSceneId('meadow')).toBe(true);
    expect(isSceneId('frieren')).toBe(true);
    expect(isSceneId('haku-night')).toBe(true);
    expect(isSceneId('chihiro-flowers')).toBe(true);
    expect(isSceneId('your-name')).toBe(true);
    expect(isSceneId('unknown')).toBe(false);
  });

  it('pairs Light and Dark Liquid Glass cleanly per scene', () => {
    // Meadow follows Bangkok 24h cycle
    expect(isSceneDark('meadow', 12)).toBe(false);
    expect(isSceneDark('meadow', 22)).toBe(true);

    // Bright/sunset scenes stay Light Glass
    expect(isSceneDark('frieren', 23)).toBe(false);
    expect(isSceneDark('chihiro-flowers', 23)).toBe(false);

    // Night scenes always use Dark Glass
    expect(isSceneDark('haku-night', 12)).toBe(true);
    expect(isSceneDark('your-name', 12)).toBe(true);

    expect(getSceneOption('frieren').shaderMode).toBe(1);
    expect(getSceneOption('your-name').shaderMode).toBe(4);
  });
});
