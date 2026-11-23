import { isDarkAtmosphere } from '../../domain/atmosphere';
import { readJson, writeJson } from '../../services/storage';

export type SceneId =
  | 'meadow'
  | 'frieren'
  | 'haku-night'
  | 'chihiro-flowers'
  | 'your-name';

export type SceneGlassMode = 'auto' | 'light' | 'dark';

export interface SceneOption {
  id: SceneId;
  title: string;
  subtitle: string;
  badge: string;
  previewUrl: string;
  /** 0 = original 24h MeadowShader, 1..4 = living anime SceneShader modes */
  shaderMode: 0 | 1 | 2 | 3 | 4;
  glassMode: SceneGlassMode;
  objectPosition: string;
}

export const SCENE_STORAGE_KEY = 'ocsc_meadow_scene_v1';

export const SCENE_CATALOG: readonly SceneOption[] = [
  {
    id: 'meadow',
    title: 'ทุ่งหญ้า Meadow',
    subtitle: 'ท้องฟ้าเปลี่ยนแสงตามเวลาจริง 24 ชม.',
    badge: '24 ชม.',
    previewUrl: './meadow-bg.webp',
    shaderMode: 0,
    glassMode: 'auto',
    objectPosition: 'center bottom',
  },
  {
    id: 'frieren',
    title: 'ทุ่งดอกไม้ Frieren',
    subtitle: 'ดอกไม้สีฟ้าขาวไหวลมกับแสงอาทิตย์ยามเย็น',
    badge: 'อบอุ่น',
    previewUrl: './bg-frieren.jpg',
    shaderMode: 1,
    glassMode: 'light',
    objectPosition: 'center center',
  },
  {
    id: 'haku-night',
    title: 'ฮาคุเหนือทะเลเมฆ',
    subtitle: 'ท้องฟ้ากลางคืน แสงจันทร์ และทะเลเมฆลอยช้าๆ',
    badge: 'กลางคืน',
    previewUrl: './bg-haku-night.jpg',
    shaderMode: 2,
    glassMode: 'dark',
    objectPosition: 'center center',
  },
  {
    id: 'chihiro-flowers',
    title: 'สวนดอกไม้ Chihiro',
    subtitle: 'พุ่มดอกไม้สีชมพูไหวลมพร้อมละอองแสงแดด',
    badge: 'สดใส',
    previewUrl: './bg-chihiro-flowers.jpg',
    shaderMode: 3,
    glassMode: 'light',
    objectPosition: 'center center',
  },
  {
    id: 'your-name',
    title: 'คืนดาวหาง Your Name',
    subtitle: 'ดาวระยิบระยับ ดาวหางเรืองแสง และลมหญ้ายามค่ำ',
    badge: 'กลางคืน',
    previewUrl: './bg-your-name.jpg',
    shaderMode: 4,
    glassMode: 'dark',
    objectPosition: 'center center',
  },
] as const;

export function isSceneId(value: unknown): value is SceneId {
  return SCENE_CATALOG.some((scene) => scene.id === value);
}

export function getSceneOption(id: SceneId): SceneOption {
  return SCENE_CATALOG.find((scene) => scene.id === id) ?? SCENE_CATALOG[0]!;
}

export function isSceneDark(id: SceneId, hourFloat: number): boolean {
  const scene = getSceneOption(id);
  if (scene.glassMode === 'dark') return true;
  if (scene.glassMode === 'light') return false;
  return isDarkAtmosphere(hourFloat);
}

export function loadSelectedScene(): SceneId {
  const saved = readJson<{ sceneId?: unknown }>(SCENE_STORAGE_KEY);
  if (saved && typeof saved === 'object' && isSceneId(saved.sceneId)) {
    return saved.sceneId;
  }
  return 'meadow';
}

export function saveSelectedScene(sceneId: SceneId): boolean {
  return writeJson(SCENE_STORAGE_KEY, { sceneId });
}
