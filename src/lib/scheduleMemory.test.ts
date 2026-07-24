import { describe, expect, it } from 'vitest';
import { parseScheduleMemory, type ScheduleMemory } from './scheduleMemory';

const base = { hash: '/schedule?day=2026-07-25', scrollY: 1200 };

describe('parseScheduleMemory', () => {
  it('returns null for missing or empty storage', () => {
    expect(parseScheduleMemory(null)).toBeNull();
    expect(parseScheduleMemory('')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(parseScheduleMemory('{not json')).toBeNull();
  });

  it('returns null when required fields are missing or mistyped', () => {
    expect(parseScheduleMemory(JSON.stringify({ scrollY: 10 }))).toBeNull();
    expect(parseScheduleMemory(JSON.stringify({ hash: '/schedule' }))).toBeNull();
    expect(parseScheduleMemory(JSON.stringify({ hash: 5, scrollY: 10 }))).toBeNull();
    expect(parseScheduleMemory(JSON.stringify({ hash: '/schedule', scrollY: '10' }))).toBeNull();
    expect(parseScheduleMemory(JSON.stringify(null))).toBeNull();
    expect(parseScheduleMemory(JSON.stringify('nope'))).toBeNull();
  });

  it('round-trips a pixel-only memory (pre-anchor format)', () => {
    expect(parseScheduleMemory(JSON.stringify(base))).toEqual(base);
  });

  it('round-trips an agenda anchor', () => {
    const mem: ScheduleMemory = { ...base, anchorId: 'sess-42', anchorTop: -18.5 };
    expect(parseScheduleMemory(JSON.stringify(mem))).toEqual(mem);
  });

  it('round-trips grid offsets', () => {
    const mem: ScheduleMemory = { ...base, scrollY: 0, gridLeft: 934, gridTop: 256 };
    expect(parseScheduleMemory(JSON.stringify(mem))).toEqual(mem);
  });

  it('drops a half-present or mistyped anchor but keeps the pixel fallback', () => {
    expect(parseScheduleMemory(JSON.stringify({ ...base, anchorId: 'sess-42' }))).toEqual(base);
    expect(parseScheduleMemory(JSON.stringify({ ...base, anchorTop: 90 }))).toEqual(base);
    expect(
      parseScheduleMemory(JSON.stringify({ ...base, anchorId: 42, anchorTop: 90 }))
    ).toEqual(base);
    expect(
      parseScheduleMemory(JSON.stringify({ ...base, anchorId: 'sess-42', anchorTop: '90' }))
    ).toEqual(base);
  });

  it('drops half-present grid offsets', () => {
    expect(parseScheduleMemory(JSON.stringify({ ...base, gridLeft: 100 }))).toEqual(base);
    expect(parseScheduleMemory(JSON.stringify({ ...base, gridTop: 100 }))).toEqual(base);
  });

  it('ignores unknown extra fields', () => {
    expect(parseScheduleMemory(JSON.stringify({ ...base, legacy: true }))).toEqual(base);
  });
});
