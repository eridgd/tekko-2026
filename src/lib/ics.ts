import type { Session } from '../types';

/**
 * .ics export.
 *
 * Times are emitted as UTC instants derived from the session's epoch, not as
 * floating local times. A floating DTSTART would land at the wrong hour on a
 * phone whose calendar isn't set to Eastern — which is exactly the phone of
 * someone travelling to Pittsburgh for the weekend.
 */

function utcStamp(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** RFC 5545 TEXT escaping. Order matters — backslash first. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Content lines must be folded at 75 octets, continuations start with a space. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;

  const out: string[] = [];
  let start = 0;
  let count = 0;
  let limit = 75;

  for (let i = 0; i < line.length; i++) {
    // Surrogate pairs must not be split across a fold boundary.
    const size = new TextEncoder().encode(line[i]!).length;
    if (count + size > limit) {
      out.push(line.slice(start, i));
      start = i;
      count = 0;
      limit = 74; // continuation lines lose one octet to the leading space
    }
    count += size;
  }
  out.push(line.slice(start));
  return out.join('\r\n ');
}

function event(session: Session, domain: string): string[] {
  const lines = [
    'BEGIN:VEVENT',
    `UID:tekko2026-${session.id}@${domain}`,
    `DTSTAMP:${utcStamp(Math.floor(Date.now() / 1000))}`,
    `DTSTART:${utcStamp(session.start)}`,
    // Zero-length entries (room-closing markers) get a nominal 15 minutes so
    // calendars that reject DTEND <= DTSTART still import them.
    `DTEND:${utcStamp(session.end > session.start ? session.end : session.start + 900)}`,
    `SUMMARY:${escapeText(session.title)}`,
    `LOCATION:${escapeText(session.loc)}`,
  ];

  const description: string[] = [];
  if (session.desc) description.push(session.desc);
  if (session.presenters?.length) description.push(`Presented by: ${session.presenters.join(', ')}`);
  if (session.issue === 'end-before-start') {
    description.push('Note: Tekko lists an end time before the start time for this event.');
  }
  if (description.length) lines.push(`DESCRIPTION:${escapeText(description.join('\n\n'))}`);

  lines.push('END:VEVENT');
  return lines;
}

export function buildIcs(sessions: Session[], calendarName = 'Tekko 2026'): string {
  const domain = typeof location !== 'undefined' ? location.hostname || 'tekko.local' : 'tekko.local';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tekko 2026 Companion//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    ...sessions.flatMap((s) => event(s, domain)),
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** Triggers a download. On iOS this hands off to the Calendar app. */
export function downloadIcs(sessions: Session[], filename: string, calendarName?: string): void {
  const blob = new Blob([buildIcs(sessions, calendarName)], {
    type: 'text/calendar;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next frame; revoking synchronously can cancel the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
