import { describe, expect, it } from 'vitest';
import { computeCountdown, formatThaiBuddhistDate } from '../countdown';

describe('countdown domain helper', () => {
  it('formats ISO date into Thai Buddhist Era date', () => {
    expect(formatThaiBuddhistDate('2027-07-04T09:00:00+07:00')).toBe('4 กรกฎาคม 2570');
  });

  it('computes exact days, hours, minutes, seconds remaining', () => {
    const target = '2027-07-04T09:00:00+07:00';
    const nowMs = Date.parse('2027-07-02T07:58:50+07:00');
    const parts = computeCountdown(target, nowMs);
    expect(parts.isPast).toBe(false);
    expect(parts.days).toBe(2);
    expect(parts.hours).toBe(1);
    expect(parts.minutes).toBe(1);
    expect(parts.seconds).toBe(10);
  });

  it('handles past exam date gracefully without negative numbers', () => {
    const target = '2026-01-01T09:00:00+07:00';
    const nowMs = Date.parse('2026-11-23T07:00:00+07:00');
    const parts = computeCountdown(target, nowMs);
    expect(parts.isPast).toBe(true);
    expect(parts.days).toBe(0);
    expect(parts.seconds).toBe(0);
  });
});
