import { readJson, writeJson } from '../../services/storage';
import { getLocalDateKey } from './widgetUtils';

export const FOCUS_GARDEN_STORAGE_KEY = 'ocsc_meadow_garden_v1';

const MAX_GARDEN_PLANTS = 120;

export type GardenPlantSpecies =
  | 'sprout'
  | 'clover'
  | 'tulip'
  | 'sunflower'
  | 'lavender'
  | 'lotus'
  | 'sakura'
  | 'pine';

export interface GardenSpeciesMeta {
  emoji: string;
  label: string;
}

export const GARDEN_SPECIES_META: Record<GardenPlantSpecies, GardenSpeciesMeta> = {
  sprout: { emoji: '🌱', label: 'ต้นอ่อน' },
  clover: { emoji: '🍀', label: 'โคลเวอร์ 4 แฉก' },
  tulip: { emoji: '🌷', label: 'ดอกทิวลิป' },
  sunflower: { emoji: '🌻', label: 'ดอกทานตะวัน' },
  lavender: { emoji: '🪻', label: 'ดอกลาเวนเดอร์' },
  lotus: { emoji: '🪷', label: 'ดอกบัว' },
  sakura: { emoji: '🌸', label: 'ต้นซากุระ' },
  pine: { emoji: '🌲', label: 'ต้นสนใหญ่' },
};

const SHORT_SPECIES: readonly GardenPlantSpecies[] = ['sprout', 'clover'];
const STANDARD_SPECIES: readonly GardenPlantSpecies[] = [
  'tulip',
  'sunflower',
  'lavender',
  'lotus',
];
const DEEP_SPECIES: readonly GardenPlantSpecies[] = ['sakura', 'pine'];

export interface GardenPlant {
  id: string;
  species: GardenPlantSpecies;
  minutes: number;
  plantedAt: string;
  dateKey: string;
}

export interface GardenSummary {
  totalPlants: number;
  totalMinutes: number;
  todayPlants: number;
  todayMinutes: number;
}

function isGardenSpecies(value: unknown): value is GardenPlantSpecies {
  return typeof value === 'string' && value in GARDEN_SPECIES_META;
}

export function pickSpeciesForMinutes(
  minutes: number,
  seedIndex = 0,
): GardenPlantSpecies {
  const safeIdx = Math.abs(Math.floor(seedIndex));
  if (minutes >= 35) {
    return DEEP_SPECIES[safeIdx % DEEP_SPECIES.length] ?? 'sakura';
  }
  if (minutes >= 15) {
    return STANDARD_SPECIES[safeIdx % STANDARD_SPECIES.length] ?? 'tulip';
  }
  return SHORT_SPECIES[safeIdx % SHORT_SPECIES.length] ?? 'sprout';
}

export function loadGardenPlants(): GardenPlant[] {
  const raw = readJson<unknown>(FOCUS_GARDEN_STORAGE_KEY);
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is GardenPlant => {
    if (!item || typeof item !== 'object') return false;
    const r = item as Record<string, unknown>;
    return (
      typeof r.id === 'string' &&
      isGardenSpecies(r.species) &&
      typeof r.minutes === 'number' &&
      Number.isFinite(r.minutes) &&
      r.minutes > 0 &&
      typeof r.plantedAt === 'string' &&
      typeof r.dateKey === 'string'
    );
  });
}

export function plantFocusSession(
  minutes: number,
  nowMs = Date.now(),
): { plants: GardenPlant[]; planted: GardenPlant } {
  const safeMinutes = Math.max(1, Math.min(180, Math.round(minutes)));
  const existing = loadGardenPlants();
  const species = pickSpeciesForMinutes(safeMinutes, existing.length);
  const nowDate = new Date(nowMs);

  const planted: GardenPlant = {
    id: `plant_${nowMs}_${Math.random().toString(36).slice(2, 6)}`,
    species,
    minutes: safeMinutes,
    plantedAt: nowDate.toISOString(),
    dateKey: getLocalDateKey(nowDate),
  };

  const next = [planted, ...existing].slice(0, MAX_GARDEN_PLANTS);
  writeJson(FOCUS_GARDEN_STORAGE_KEY, next);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ocsc-garden-updated'));
  }
  return { plants: next, planted };
}

export function summarizeGarden(
  plants: readonly GardenPlant[],
  todayKey = getLocalDateKey(),
): GardenSummary {
  let totalMinutes = 0;
  let todayPlants = 0;
  let todayMinutes = 0;

  for (const p of plants) {
    totalMinutes += p.minutes;
    if (p.dateKey === todayKey) {
      todayPlants += 1;
      todayMinutes += p.minutes;
    }
  }

  return {
    totalPlants: plants.length,
    totalMinutes,
    todayPlants,
    todayMinutes,
  };
}
