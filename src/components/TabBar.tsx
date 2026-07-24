import { useStore } from '../store';
import { IconCalendar, IconMap, IconNow, IconStar, IconUsers } from './Icons';

const TABS = [
  { path: 'now', label: 'Now', Icon: IconNow },
  { path: 'schedule', label: 'Schedule', Icon: IconCalendar },
  { path: 'saved', label: 'My Schedule', short: 'Saved', Icon: IconStar },
  { path: 'map', label: 'Maps', Icon: IconMap },
  { path: 'guests', label: 'Guests', Icon: IconUsers },
] as const;

export function TabBar({ active }: { active: string }) {
  const { savedSessions } = useStore();

  return (
    <nav className="tabbar" aria-label="Main">
      <span className="tabbar__brand">Tekko 2026</span>
      {TABS.map(({ path, label, Icon, ...rest }) => {
        const current = active === path;
        const short = 'short' in rest ? rest.short : label;
        return (
          <a
            key={path}
            className="tabbar__item"
            href={`#/${path}`}
            aria-current={current ? 'page' : undefined}
          >
            <Icon />
            <span className="tabbar__label">{short}</span>
            {path === 'saved' && savedSessions.length > 0 && (
              <span className="tabbar__badge" aria-hidden="true">
                {savedSessions.length}
              </span>
            )}
            {path === 'saved' && savedSessions.length > 0 && (
              <span className="sr-only">{savedSessions.length} saved events</span>
            )}
          </a>
        );
      })}
    </nav>
  );
}
