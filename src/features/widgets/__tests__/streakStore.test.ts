import { describe, expect, it } from 'vitest';
import {
  buildHeatmapCells,
  computeStreakSummary,
  type StudyActivityMap,
} from '../streakStore';

describe('streakStore', () => {
  it('computes current streak from today when checked in today', () => {
    const today = new Date(2026, 4, 10); // 2026-05-10
    const map: StudyActivityMap = {
      '2026-05-08': 1,
      '2026-05-09': 3,
      '2026-05-10': 2,
    };

    const summary = computeStreakSummary(map, today);
    expect(summary.currentStreak).toBe(3);
    expect(summary.bestStreak).toBe(3);
    expect(summary.totalActiveDays).toBe(3);
    expect(summary.todayCount).toBe(2);
  });

  it('preserves current streak from yesterday if not yet checked in today', () => {
    const today = new Date(2026, 4, 10);
    const map: StudyActivityMap = {
      '2026-05-07': 1,
      '2026-05-08': 2,
      '2026-05-09': 1,
    };

    const summary = computeStreakSummary(map, today);
    expect(summary.currentStreak).toBe(3);
    expect(summary.todayCount).toBe(0);
    expect(summary.bestStreak).toBe(3);
  });

  it('tracks best streak separately across historical gaps', () => {
    const today = new Date(2026, 4, 10);
    const map: StudyActivityMap = {
      '2026-04-01': 1,
      '2026-04-02': 2,
      '2026-04-03': 1,
      '2026-04-04': 4,
      '2026-05-10': 1,
    };

    const summary = computeStreakSummary(map, today);
    expect(summary.currentStreak).toBe(1);
    expect(summary.bestStreak).toBe(4);
    expect(summary.totalActiveDays).toBe(5);
  });

  it('builds 84 heatmap cells with intensity levels 0 through 4', () => {
    const today = new Date(2026, 4, 10);
    const map: StudyActivityMap = {
      '2026-05-07': 1, // level 1
      '2026-05-08': 3, // level 2
      '2026-05-09': 5, // level 3
      '2026-05-10': 8, // level 4
    };

    const cells = buildHeatmapCells(map, 84, today);
    expect(cells).toHaveLength(84);
    expect(cells[cells.length - 1]).toEqual({
      dateKey: '2026-05-10',
      count: 8,
      level: 4,
    });
    expect(cells[cells.length - 2]?.level).toBe(3);
    expect(cells[cells.length - 3]?.level).toBe(2);
    expect(cells[cells.length - 4]?.level).toBe(1);
    expect(cells[cells.length - 5]?.level).toBe(0);
  });
});
