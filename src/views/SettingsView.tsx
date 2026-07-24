import { useStore } from '../store';
import { StickyHeader } from '../components/StickyHeader';
import { navigate } from '../hooks/useRoute';
import { downloadIcs } from '../lib/ics';
import { IconChevronLeft, IconDownload } from '../components/Icons';
import type { ThemePref } from '../lib/storage';

const THEMES: { id: ThemePref; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
];

export function SettingsView() {
  const { data, prefs, setPrefs, savedSessions } = useStore();
  const { schedule } = data;

  const fetched = new Date(schedule.fetchedAt);

  return (
    <>
      <StickyHeader>
        <div className="hdr__bar">
          <button className="iconbtn" aria-label="Back" onClick={() => navigate('/now')}>
            <IconChevronLeft />
          </button>
          <span className="hdr__title hdr__title--sm">Settings & about</span>
        </div>
      </StickyHeader>

      <div className="page">
        <section>
          <h2 className="sectiontitle">Appearance</h2>
          <div className="segmented" role="group" aria-label="Theme">
            {THEMES.map((t) => (
              <button
                key={t.id}
                className="segmented__btn"
                aria-pressed={prefs.theme === t.id}
                onClick={() => setPrefs({ theme: t.id })}
              >
                {t.label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="sectiontitle">My Schedule</h2>
          <p className="muted">
            {savedSessions.length} saved event{savedSessions.length === 1 ? '' : 's'}, stored only
            on this device. Clearing your browser data will remove them.
          </p>
          {savedSessions.length > 0 && (
            <div className="linkrow">
              <button
                className="btn btn--sm"
                onClick={() =>
                  downloadIcs(savedSessions, 'tekko-2026-my-schedule.ics', 'Tekko 2026')
                }
              >
                <IconDownload size={16} />
                Export to calendar
              </button>
            </div>
          )}
        </section>

        <section>
          <h2 className="sectiontitle">Schedule data</h2>
          <dl className="factlist">
            <div>
              <dt>Last refreshed</dt>
              <dd>
                {fetched.toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </dd>
            </div>
            <div>
              <dt>Events</dt>
              <dd>{schedule.sessions.length}</dd>
            </div>
            <div>
              <dt>Rooms</dt>
              <dd>{schedule.tracks.length}</dd>
            </div>
            <div>
              <dt>Times shown in</dt>
              <dd>Eastern (venue local)</dd>
            </div>
          </dl>
          <p className="muted">
            This is a snapshot taken from Tekko's official Eventeny listing. If the con changes
            something after that, it won't appear here until the data is refreshed — always trust
            signage at the room over this app.
          </p>
        </section>

        <section>
          <h2 className="sectiontitle">Offline</h2>
          <p className="muted">
            The whole app — schedule, maps and guest photos — is stored on your device after the
            first visit, so it works with no signal. Add it to your home screen for the best
            experience.
          </p>
        </section>

        <section>
          <h2 className="sectiontitle">About</h2>
          <p className="muted">
            An unofficial companion for Tekko 2026 at the David L. Lawrence Convention Center.
            Not affiliated with Tekko or PittJCS. Schedule data belongs to them.
          </p>
          <div className="linkrow">
            <a
              className="btn btn--sm"
              href="https://www.eventeny.com/events/tekko2026-21858/"
              target="_blank"
              rel="noreferrer noopener"
            >
              Official schedule
            </a>
          </div>
        </section>
      </div>
    </>
  );
}
