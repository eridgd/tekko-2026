import { describe, expect, it } from 'vitest';
import { buildIcs } from './ics';
import type { Session } from '../types';

function session(extra: Partial<Session> = {}): Session {
  // 2026-07-24 14:00 EDT == 18:00 UTC
  const start = Math.floor(Date.UTC(2026, 6, 24, 18, 0, 0) / 1000);
  return {
    id: '12345',
    title: 'Cosplay Repair 101',
    desc: 'Fix your cosplay before the masquerade.',
    day: '2026-07-24',
    start,
    end: start + 3600,
    startMin: 14 * 60,
    durMin: 60,
    startLabel: '2:00 PM',
    endLabel: '3:00 PM',
    hideEnd: false,
    trackId: 1,
    track: 'Panel 7 Workshops (319)',
    loc: 'Panel 7 Workshops (319)',
    cat: 'workshop',
    flags: [],
    guests: [],
    calStart: '20260724T140000',
    calEnd: '20260724T150000',
    ...extra,
  };
}

const lines = (ics: string) => ics.split('\r\n');

describe('buildIcs', () => {
  it('emits a well-formed calendar envelope', () => {
    const out = lines(buildIcs([session()]));
    expect(out[0]).toBe('BEGIN:VCALENDAR');
    expect(out).toContain('VERSION:2.0');
    expect(out).toContain('BEGIN:VEVENT');
    expect(out).toContain('END:VEVENT');
    expect(out.filter(Boolean).at(-1)).toBe('END:VCALENDAR');
  });

  it('writes times as UTC instants, not floating local times', () => {
    // This is the whole point: a phone set to Pacific must still show 2pm ET.
    const out = lines(buildIcs([session()]));
    expect(out).toContain('DTSTART:20260724T180000Z');
    expect(out).toContain('DTEND:20260724T190000Z');
  });

  it('uses CRLF line endings as the spec requires', () => {
    const ics = buildIcs([session()]);
    expect(ics).toContain('\r\n');
    expect(ics.split('\n').every((l) => l === '' || l.endsWith('\r'))).toBe(true);
  });

  it('escapes commas, semicolons and backslashes in text', () => {
    const ics = buildIcs([session({ title: 'Panels; Q&A, Part 1 \\ 2' })]);
    expect(ics).toContain('SUMMARY:Panels\\; Q&A\\, Part 1 \\\\ 2');
  });

  it('escapes newlines in descriptions rather than breaking the line', () => {
    const ics = buildIcs([session({ desc: 'Line one\nLine two' })]);
    expect(ics).toContain('\\nLine two');
  });

  it('gives zero-length events a nominal duration', () => {
    // Calendars reject DTEND <= DTSTART; the "Room Closes" markers are 0-length.
    const s = session({ durMin: 0 });
    const out = lines(buildIcs([{ ...s, end: s.start }]));
    expect(out).toContain('DTSTART:20260724T180000Z');
    expect(out).toContain('DTEND:20260724T181500Z');
  });

  it('folds long lines at 75 octets with a leading space', () => {
    const ics = buildIcs([session({ title: 'A'.repeat(200) })]);
    for (const line of lines(ics)) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(ics).toContain('\r\n ');
  });

  it('does not split a multi-byte character across a fold', () => {
    const ics = buildIcs([session({ title: '🎌'.repeat(40) })]);
    // If a surrogate pair were split, the output would contain a lone
    // surrogate and fail to round-trip through encode/decode.
    const decoded = new TextDecoder('utf-8', { fatal: true });
    expect(() => decoded.decode(new TextEncoder().encode(ics))).not.toThrow();
  });

  it('includes one VEVENT per session', () => {
    const ics = buildIcs([session({ id: '1' }), session({ id: '2' }), session({ id: '3' })]);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3);
  });

  it('gives each event a unique stable UID', () => {
    const ics = buildIcs([session({ id: '111' }), session({ id: '222' })]);
    expect(ics).toContain('UID:tekko2026-111@');
    expect(ics).toContain('UID:tekko2026-222@');
  });

  it('notes the upstream time problem on broken events', () => {
    const ics = buildIcs([session({ issue: 'end-before-start' })]);
    expect(ics).toContain('end time before the start time');
  });

  it('handles an empty selection without producing garbage', () => {
    const out = lines(buildIcs([]));
    expect(out).toContain('BEGIN:VCALENDAR');
    expect(out).not.toContain('BEGIN:VEVENT');
  });
});
