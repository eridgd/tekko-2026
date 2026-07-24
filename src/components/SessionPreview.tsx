import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store';
import { formatDuration, formatMinutes } from '../lib/time';
import { IconPin } from './Icons';
import type { Session } from '../types';

/**
 * Desktop hover preview: mousing over a card shows its description, guests and
 * full time without a click. The whole popup is a link to the detail page, so
 * you can click the row or the popup. Touch devices have no hover, so this is
 * gated to fine-pointer/hover displays and never activates there.
 */

// Cached once — the media query result is effectively constant per session and
// re-evaluating it in every one of a few hundred cards is wasteful.
let hoverCapable: boolean | undefined;
function canHover(): boolean {
  if (hoverCapable === undefined) {
    hoverCapable =
      typeof window !== 'undefined' &&
      !!window.matchMedia &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }
  return hoverCapable;
}

const OPEN_DELAY = 200;
const CLOSE_DELAY = 130;
// Ignore scroll for a moment after opening: a trackpad's incidental scroll
// deltas would otherwise close the popup the instant it appears.
const SCROLL_GRACE = 350;

export function useSessionPreview(session: Session, href: string) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const openTimer = useRef<number>();
  const closeTimer = useRef<number>();
  const openedAt = useRef(0);

  const cancelOpen = () => window.clearTimeout(openTimer.current);
  const cancelClose = () => window.clearTimeout(closeTimer.current);
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setAnchor(null), CLOSE_DELAY);
  };

  const onPointerEnter = (e: PointerEvent<HTMLElement>) => {
    // Skip touch only; mouse / pen / unknown all get the preview.
    if (e.pointerType === 'touch' || !canHover()) return;
    const el = e.currentTarget;
    cancelClose();
    cancelOpen();
    openTimer.current = window.setTimeout(() => {
      openedAt.current = performance.now();
      setAnchor(el.getBoundingClientRect());
    }, OPEN_DELAY);
  };

  const onPointerLeave = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType === 'touch') return;
    cancelOpen();
    scheduleClose();
  };

  // A big scroll invalidates the anchor position, so close — but not within the
  // grace window, and only for real scrolling (bubbling, non-capture).
  useEffect(() => {
    if (!anchor) return;
    const onScroll = () => {
      if (performance.now() - openedAt.current > SCROLL_GRACE) setAnchor(null);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [anchor]);

  useEffect(
    () => () => {
      cancelOpen();
      cancelClose();
    },
    []
  );

  const preview =
    anchor &&
    createPortal(
      <PreviewCard
        session={session}
        href={href}
        anchor={anchor}
        onPointerEnter={cancelClose}
        onPointerLeave={scheduleClose}
      />,
      document.body
    );

  return { hoverProps: { onPointerEnter, onPointerLeave }, preview };
}

const WIDTH = 340;
const GAP = 12;
const MARGIN = 8;

function PreviewCard({
  session,
  href,
  anchor,
  onPointerEnter,
  onPointerLeave,
}: {
  session: Session;
  href: string;
  anchor: DOMRect;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}) {
  const { data } = useStore();
  const ref = useRef<HTMLAnchorElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const category = data.categoryById.get(session.cat);
  const guests = session.guests
    .map((id) => data.guestById.get(id))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Prefer the right of the card, fall back to the left, then clamp on-screen.
    let left: number;
    if (anchor.right + GAP + WIDTH <= vw - MARGIN) left = anchor.right + GAP;
    else if (anchor.left - GAP - WIDTH >= MARGIN) left = anchor.left - GAP - WIDTH;
    else left = Math.min(Math.max(MARGIN, anchor.left), vw - WIDTH - MARGIN);

    const top = Math.min(Math.max(MARGIN, anchor.top), Math.max(MARGIN, vh - h - MARGIN));
    setPos({ left, top });
  }, [anchor]);

  return (
    <a
      ref={ref}
      className="preview"
      href={href}
      style={{
        left: pos?.left ?? -9999,
        top: pos?.top ?? 0,
        width: WIDTH,
        visibility: pos ? 'visible' : 'hidden',
      }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <div className="preview__chips">
        {category && (
          <span className="chip chip--cat chip--sm">
            <span className="chip__dot" style={{ background: category.color }} />
            {category.label}
          </span>
        )}
        {session.flags.includes('adult') && <span className="chip chip--flag chip--adult chip--sm">18+</span>}
        {session.flags.includes('teen') && <span className="chip chip--flag chip--sm">16+</span>}
      </div>

      <p className="preview__title">{session.title}</p>

      <p className="preview__meta">
        {formatMinutes(session.startMin)}
        {!session.hideEnd && session.durMin > 0 && ` – ${formatMinutes(session.startMin + session.durMin)}`}
        {session.durMin > 0 && ` · ${formatDuration(session.durMin)}`}
      </p>
      <p className="preview__meta preview__loc">
        <IconPin size={13} />
        {session.loc}
      </p>

      {session.desc && <p className="preview__desc">{session.desc}</p>}

      {guests.length > 0 && (
        <p className="preview__guests">
          <span className="preview__key">Guests:</span> {guests.map((g) => g.name).join(', ')}
        </p>
      )}
      {!session.desc && session.presenters && session.presenters.length > 0 && (
        <p className="preview__guests">
          <span className="preview__key">Presented by:</span> {session.presenters.join(', ')}
        </p>
      )}
    </a>
  );
}
