import { isDarkAtmosphere } from '../../domain/atmosphere';
import { readJson, writeJson } from '../../services/storage';

export type SceneId =
  | 'meadow'
  | 'scene-1'
  | 'scene-2'
  | 'scene-3'
  | 'scene-4';

export interface SceneOption {
  id: SceneId;
  ariaLabel: string;
  previewUrl: string;
  /** 0 = original 24h MeadowShader, 1..4 = 24h living SceneShader modes */
  shaderMode: 0 | 1 | 2 | 3 | 4;
  objectPosition: string;
}

export const SCENE_STORAGE_KEY = 'ocsc_meadow_scene_v1';

export const SCENE_CATALOG: readonly SceneOption[] = [
  {
    id: 'meadow',
    ariaLabel: 'พื้นหลังที่ 1',
    previewUrl: './meadow-bg.webp',
    shaderMode: 0,
    objectPosition: 'center bottom',
  },
  {
    id: 'scene-1',
    ariaLabel: 'พื้นหลังที่ 2',
    previewUrl: './bg-scene-1.jpg',
    shaderMode: 1,
    objectPosition: 'center center',
  },
  {
    id: 'scene-2',
    ariaLabel: 'พื้นหลังที่ 3',
    previewUrl: './bg-scene-2.jpg',
    shaderMode: 2,
    objectPosition: 'center center',
  },
  {
    id: 'scene-3',
    ariaLabel: 'พื้นหลังที่ 4',
    previewUrl: './bg-scene-3.jpg',
    shaderMode: 3,
    objectPosition: 'center center',
  },
  {
    id: 'scene-4',
    ariaLabel: 'พื้นหลังที่ 5',
    previewUrl: './bg-scene-4.jpg',
    shaderMode: 4,
    objectPosition: 'center center',
  },
] as const;

const LEGACY_SCENE_MAP: Record<string, SceneId> = {
  frieren: 'scene-1',
  'haku-night': 'scene-2',
  'chihiro-flowers': 'scene-3',
  'your-name': 'scene-4',
};

export function isSceneId(value: unknown): value is SceneId {
  return SCENE_CATALOG.some((scene) => scene.id === value);
}

export function getSceneOption(id: SceneId): SceneOption {
  return SCENE_CATALOG.find((scene) => scene.id === id) ?? SCENE_CATALOG[0]!;
}

/** All 5 scenes follow the live 24-hour Bangkok day/night Liquid Glass cycle. */
export function isSceneDark(_id: SceneId, hourFloat: number): boolean {
  return isDarkAtmosphere(hourFloat);
}

export function loadSelectedScene(): SceneId {
  const saved = readJson<{ sceneId?: unknown }>(SCENE_STORAGE_KEY);
  if (saved && typeof saved === 'object' && typeof saved.sceneId === 'string') {
    if (isSceneId(saved.sceneId)) return saved.sceneId;
    const migrated = LEGACY_SCENE_MAP[saved.sceneId];
    if (migrated) return migrated;
  }
  return 'meadow';
}

export function saveSelectedScene(sceneId: SceneId): boolean {
  return writeJson(SCENE_STORAGE_KEY, { sceneId });
}
