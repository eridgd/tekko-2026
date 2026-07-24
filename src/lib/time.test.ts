import { describe, expect, it } from 'vitest';
import { conClock, formatMinutes, formatDuration, relativeLabel, slotKey, weekdayOf } from './time';

describe('conClock', () => {
  it('reports normal daytime hours on the same con day', () => {
    const c = conClock(new Date('2026-07-24T14:30:00-04:00'));
    expect(c.day).toBe('2026-07-24');
    expect(c.minutes).toBe(14 * 60 + 30);
  });

  it('uses the real calendar day after midnight (no rollover on the live clock)', () => {
    // 1:15am Friday reads as Friday 1:15 AM — the con-day rollover is a
    // build-time grouping concern, not a clock concern.
    const c = conClock(new Date('2026-07-24T01:15:00-04:00'));
    expect(c.day).toBe('2026-07-24');
    expect(c.minutes).toBe(75);
  });

  it('reports the real day through the early-morning hours', () => {
    expect(conClock(new Date('2026-07-25T03:59:00-04:00')).day).toBe('2026-07-25');
    expect(conClock(new Date('2026-07-25T04:00:00-04:00')).day).toBe('2026-07-25');
  });

  it('is independent of the device timezone', () => {
    // The same instant, expressed three ways. A phone in Tokyo must agree with
    // a phone in Pittsburgh about what time it is at the con.
    const instant = '2026-07-25T18:00:00Z'; // 2pm EDT
    const a = conClock(new Date(instant));
    const b = conClock(new Date('2026-07-25T14:00:00-04:00'));
    const c = conClock(new Date('2026-07-26T03:00:00+09:00'));
    expect(a).toEqual(b);
    expect(b).toEqual(c);
    expect(a.day).toBe('2026-07-25');
    expect(a.minutes).toBe(14 * 60);
  });

  it('reports midnight as the new calendar day at 0 minutes', () => {
    const c = conClock(new Date('2026-07-25T00:00:00-04:00'));
    expect(c.day).toBe('2026-07-25');
    expect(c.minutes).toBe(0);
  });
});

describe('formatMinutes', () => {
  it('formats 12-hour times with meridiem', () => {
    expect(formatMinutes(0)).toBe('12:00 AM');
    expect(formatMinutes(9 * 60 + 5)).toBe('9:05 AM');
    expect(formatMinutes(12 * 60)).toBe('12:00 PM');
    expect(formatMinutes(13 * 60 + 30)).toBe('1:30 PM');
    expect(formatMinutes(23 * 60 + 59)).toBe('11:59 PM');
  });

  it('wraps after-midnight minutes back into a readable clock time', () => {
    expect(formatMinutes(24 * 60)).toBe('12:00 AM');
    expect(formatMinutes(25 * 60 + 30)).toBe('1:30 AM');
  });
});

describe('slotKey', () => {
  it('floors to the hour', () => {
    expect(slotKey(0)).toBe(0);
    expect(slotKey(59)).toBe(0);
    expect(slotKey(60)).toBe(60);
    expect(slotKey(11 * 60 + 45)).toBe(11 * 60);
    expect(slotKey(25 * 60 + 10)).toBe(25 * 60);
  });
});

describe('formatDuration', () => {
  it('renders hours and minutes', () => {
    expect(formatDuration(30)).toBe('30m');
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(90)).toBe('1h 30m');
    expect(formatDuration(0)).toBe('');
  });
});

describe('relativeLabel', () => {
  it('describes upcoming and past offsets', () => {
    expect(relativeLabel(0)).toBe('now');
    expect(relativeLabel(25)).toBe('in 25 min');
    expect(relativeLabel(-15)).toBe('15 min ago');
    expect(relativeLabel(90)).toBe('in 1h 30m');
  });
});

describe('weekdayOf', () => {
  it('names the con days correctly', () => {
    expect(weekdayOf('2026-07-23')).toBe('Thursday');
    expect(weekdayOf('2026-07-24')).toBe('Friday');
    expect(weekdayOf('2026-07-25')).toBe('Saturday');
    expect(weekdayOf('2026-07-26')).toBe('Sunday');
  });
});
