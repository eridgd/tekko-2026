import { useMemo, useState } from 'react';
import { Sheet } from './Sheet';
import type { Category, Flag, Track } from '../types';
import type { Filters } from '../lib/filters';

export function FilterSheet({
  filters,
  setFilters,
  categories,
  flags,
  tracks,
  resultCount,
  onClose,
}: {
  filters: Filters;
  setFilters: (patch: Partial<Filters>) => void;
  categories: Category[];
  flags: Flag[];
  tracks: Track[];
  resultCount: number;
  onClose: () => void;
}) {
  const [roomQuery, setRoomQuery] = useState('');

  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const byFloor = useMemo(() => {
    const q = roomQuery.trim().toLowerCase();
    const matched = q ? tracks.filter((t) => t.title.toLowerCase().includes(q)) : tracks;
    const groups = new Map<number | null, Track[]>();
    for (const t of matched) {
      const list = groups.get(t.floor);
      if (list) list.push(t);
      else groups.set(t.floor, [t]);
    }
    return [...groups.entries()].sort((a, b) => (a[0] ?? 99) - (b[0] ?? 99));
  }, [tracks, roomQuery]);

  const anyActive =
    filters.cats.length || filters.tracks.length || filters.flags.length || filters.savedOnly;

  return (
    <Sheet
      title="Filters"
      onClose={onClose}
      footer={
        <div className="sheet__actions">
          <button
            className="btn btn--ghost"
            disabled={!anyActive && !filters.hidePast}
            onClick={() =>
              setFilters({
                cats: [],
                tracks: [],
                flags: [],
                savedOnly: false,
                hidePast: false,
              })
            }
          >
            Reset
          </button>
          <button className="btn btn--primary" onClick={onClose}>
            Show {resultCount} event{resultCount === 1 ? '' : 's'}
          </button>
        </div>
      }
    >
      <fieldset className="fieldset">
        <legend className="sectiontitle">Quick filters</legend>
        <div className="togglerow">
          <ToggleRow
            label="Upcoming only"
            hint="Hide events that have already finished"
            checked={filters.hidePast}
            onChange={(v) => setFilters({ hidePast: v })}
          />
          <ToggleRow
            label="Saved only"
            hint="Just the events in My Schedule"
            checked={filters.savedOnly}
            onChange={(v) => setFilters({ savedOnly: v })}
          />
        </div>
      </fieldset>

      <fieldset className="fieldset">
        <legend className="sectiontitle">Category</legend>
        <div className="chipgrid">
          {categories.map((c) => {
            const on = filters.cats.includes(c.id);
            return (
              <button
                key={c.id}
                className={`chip chip--cat ${on ? 'chip--on' : ''}`}
                aria-pressed={on}
                onClick={() => setFilters({ cats: toggle(filters.cats, c.id) })}
              >
                <span className="chip__dot" style={{ background: c.color }} />
                {c.label}
                <span className="chip__count">{c.count}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="fieldset">
        <legend className="sectiontitle">Audience</legend>
        <div className="chipgrid">
          {flags.map((f) => {
            const on = filters.flags.includes(f.id);
            return (
              <button
                key={f.id}
                className={`chip ${on ? 'chip--on' : ''}`}
                aria-pressed={on}
                onClick={() => setFilters({ flags: toggle(filters.flags, f.id) })}
              >
                {f.label}
                <span className="chip__count">{f.count}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="fieldset">
        <legend className="sectiontitle">Room</legend>
        <input
          className="input"
          type="search"
          value={roomQuery}
          onChange={(e) => setRoomQuery(e.target.value)}
          placeholder="Find a room…"
          aria-label="Filter room list"
        />
        {byFloor.map(([floor, list]) => (
          <div key={floor ?? 'none'} className="roomgroup">
            <p className="roomgroup__label">
              {floor == null ? 'Elsewhere' : `Floor ${floor}`}
            </p>
            <div className="chipgrid">
              {list.map((t) => {
                const on = filters.tracks.includes(t.id);
                return (
                  <button
                    key={t.id}
                    className={`chip ${on ? 'chip--on' : ''}`}
                    aria-pressed={on}
                    onClick={() => setFilters({ tracks: toggle(filters.tracks, t.id) })}
                  >
                    {t.title}
                    <span className="chip__count">{t.count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {byFloor.length === 0 && <p className="muted">No rooms match "{roomQuery}".</p>}
      </fieldset>
    </Sheet>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="toggle">
      <span>
        <span className="toggle__label">{label}</span>
        <span className="toggle__hint">{hint}</span>
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle__track" aria-hidden="true">
        <span className="toggle__thumb" />
      </span>
    </label>
  );
}
