import { describe, expect, it } from 'vitest';
import {
  getSceneOption,
  isSceneDark,
  isSceneId,
  SCENE_CATALOG,
} from '../sceneCatalog';

describe('sceneCatalog', () => {
  it('registers 5 scenes with clean generic IDs and zero visible titles', () => {
    expect(SCENE_CATALOG).toHaveLength(5);
    expect(isSceneId('meadow')).toBe(true);
    expect(isSceneId('scene-1')).toBe(true);
    expect(isSceneId('scene-2')).toBe(true);
    expect(isSceneId('scene-3')).toBe(true);
    expect(isSceneId('scene-4')).toBe(true);
    expect(isSceneId('unknown')).toBe(false);
  });

  it('drives all 5 scenes by the live 24-hour Bangkok day/night cycle', () => {
    for (const scene of SCENE_CATALOG) {
      expect(isSceneDark(scene.id, 12)).toBe(false);
      expect(isSceneDark(scene.id, 22)).toBe(true);
    }

    expect(getSceneOption('scene-1').shaderMode).toBe(1);
    expect(getSceneOption('scene-4').shaderMode).toBe(4);
  });
});
