import { describe, expect, it } from 'vitest';
import {
  pickSpeciesForMinutes,
  summarizeGarden,
  type GardenPlant,
} from '../focusGardenStore';

describe('focusGardenStore', () => {
  it('selects plant species tiers based on focus duration', () => {
    expect(['sprout', 'clover']).toContain(pickSpeciesForMinutes(10, 0));
    expect(['tulip', 'sunflower', 'lavender', 'lotus']).toContain(
      pickSpeciesForMinutes(25, 1),
    );
    expect(['sakura', 'pine']).toContain(pickSpeciesForMinutes(45, 0));
  });

  it('summarizes total and today plant counts and focus minutes accurately', () => {
    const sample: GardenPlant[] = [
      {
        id: 'p1',
        species: 'tulip',
        minutes: 25,
        plantedAt: '2026-11-24T08:00:00.000Z',
        dateKey: '2026-11-24',
      },
      {
        id: 'p2',
        species: 'sakura',
        minutes: 50,
        plantedAt: '2026-11-24T10:00:00.000Z',
        dateKey: '2026-11-24',
      },
      {
        id: 'p3',
        species: 'sprout',
        minutes: 10,
        plantedAt: '2026-11-23T09:00:00.000Z',
        dateKey: '2026-11-23',
      },
    ];

    expect(summarizeGarden(sample, '2026-11-24')).toEqual({
      totalPlants: 3,
      totalMinutes: 85,
      todayPlants: 2,
      todayMinutes: 75,
    });
  });
});
