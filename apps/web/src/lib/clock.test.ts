import { describe, expect, it } from 'vitest';

import { todayIso } from './clock';

describe('todayIso', () => {
  it('formats the local calendar date, zero padded', () => {
    expect(todayIso(new Date(2026, 10, 14, 12, 0, 0))).toBe('2026-11-14');
    expect(todayIso(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(todayIso(new Date(2026, 11, 31, 23, 59, 59))).toBe('2026-12-31');
  });

  it('uses local time, not UTC, at the edges of the day', () => {
    expect(todayIso(new Date(2026, 10, 14, 0, 0, 0))).toBe('2026-11-14');
    expect(todayIso(new Date(2026, 10, 14, 23, 59, 59, 999))).toBe('2026-11-14');
  });

  it('handles leap days and four-digit years', () => {
    expect(todayIso(new Date(2028, 1, 29))).toBe('2028-02-29');
    expect(todayIso(new Date(2100, 2, 1))).toBe('2100-03-01');
  });

  it('defaults to the current date', () => {
    const before = todayIso(new Date());
    const value = todayIso();
    const after = todayIso(new Date());
    expect([before, after]).toContain(value);
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
