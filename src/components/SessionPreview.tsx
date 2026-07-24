import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store';
import { formatDuration, formatMinutes } from '../lib/time';
import { IconPin } from './Icons';
import type { Session } from '../types';

/**
 * Desktop hover preview: mousing over a card shows its description, guests and
 * full time without a click. Touch devices have no hover, so this is gated to
 * fine pointers with real hover — there, the tap-through to the detail page is
 * the interaction and this never activates.
 */

function canHover(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(hover: hover) and (pointer: fine)').matches
  );
}

const OPEN_DELAY = 320;
const CLOSE_DELAY = 130;

export function useSessionPreview(session: Session) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const openTimer = useRef<number>();
  const closeTimer = useRef<number>();
  const enabled = useMemo(canHover, []);

  const cancelOpen = () => window.clearTimeout(openTimer.current);
  const cancelClose = () => window.clearTimeout(closeTimer.current);

  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setAnchor(null), CLOSE_DELAY);
  };

  const onPointerEnter = (e: PointerEvent<HTMLElement>) => {
    if (!enabled || e.pointerType !== 'mouse') return;
    const el = e.currentTarget;
    cancelClose();
    cancelOpen();
    openTimer.current = window.setTimeout(() => setAnchor(el.getBoundingClientRect()), OPEN_DELAY);
  };

  const onPointerLeave = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    cancelOpen();
    scheduleClose();
  };

  // Any scroll or resize invalidates the anchor rect — just close.
  useEffect(() => {
    if (!anchor) return;
    const close = () => setAnchor(null);
    window.addEventListener('scroll', close, { passive: true, capture: true });
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, { capture: true } as EventListenerOptions);
      window.removeEventListener('resize', close);
    };
  }, [anchor]);

  useEffect(() => () => {
    cancelOpen();
    cancelClose();
  }, []);

  const preview =
    anchor &&
    createPortal(
      <PreviewCard
        session={session}
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
  anchor,
  onPointerEnter,
  onPointerLeave,
}: {
  session: Session;
  anchor: DOMRect;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}) {
  const { data } = useStore();
  const ref = useRef<HTMLDivElement>(null);
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
    <div
      ref={ref}
      className="preview"
      role="tooltip"
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

      <p className="preview__hint">Click for full details</p>
    </div>
  );
}
