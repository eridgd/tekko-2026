import { useEffect, useLayoutEffect, useRef } from 'react';

/**
 * Restore window scroll position for a plain (window-scrolling) list view when
 * you return to it — e.g. open an event from the Now tab, then hit Back.
 *
 * Same technique the Schedule tab uses: remember WHICH card sits at the top of
 * the viewport (by its `data-sid`) plus its offset, not just a pixel value —
 * because `content-visibility` gives offscreen cards placeholder heights on a
 * fresh mount, so a bare pixel offset would land on the wrong content. Falls
 * back to the pixel offset when the anchored card is gone (its event may have
 * dropped out of a time-based list by the time you return).
 *
 * Returns a ref to attach to a root element of the view; it's used to tell
 * whether our DOM is still on screen when the save fires (React runs the unmount
 * cleanup AFTER the DOM has swapped to the detail page, and capturing the
 * clamped scroll position then is exactly what truncated it).
 */
interface ScrollMemory {
  scrollY: number;
  anchorId?: string;
  anchorTop?: number;
}

const keyFor = (name: string) => `tekko.session.scroll.${name}`;

function read(name: string): ScrollMemory | null {
  try {
    const raw = sessionStorage.getItem(keyFor(name));
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p?.scrollY !== 'number') return null;
    const mem: ScrollMemory = { scrollY: p.scrollY };
    if (typeof p.anchorId === 'string' && typeof p.anchorTop === 'number') {
      mem.anchorId = p.anchorId;
      mem.anchorTop = p.anchorTop;
    }
    return mem;
  } catch {
    return null;
  }
}

function write(name: string, mem: ScrollMemory): void {
  try {
    sessionStorage.setItem(keyFor(name), JSON.stringify(mem));
  } catch {
    /* private mode / quota — restoration just won't happen */
  }
}

function restore(mem: ScrollMemory): void {
  const { scrollY, anchorId, anchorTop } = mem;
  const deadline = performance.now() + 600;
  let settled = 0;
  const tick = () => {
    const anchor =
      anchorId !== undefined ? document.querySelector(`[data-sid="${CSS.escape(anchorId)}"]`) : null;
    if (anchor && anchorTop !== undefined) {
      const delta = anchor.getBoundingClientRect().top - anchorTop;
      if (Math.abs(delta) > 1) {
        settled = 0;
        window.scrollTo(0, window.scrollY + delta);
      } else {
        settled += 1;
      }
    } else {
      window.scrollTo(0, scrollY);
      settled = Math.abs(window.scrollY - scrollY) <= 2 ? settled + 1 : 0;
    }
    if (settled < 2 && performance.now() < deadline) requestAnimationFrame(tick);
  };
  tick(); // first application is synchronous, before the mount paints
}

export function useScrollRestore<T extends HTMLElement = HTMLDivElement>(name: string) {
  const rootRef = useRef<T>(null);

  useLayoutEffect(() => {
    const mem = read(name);
    if (mem && mem.scrollY > 0) restore(mem);
    // Mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let idle = 0;
    const flush = () => {
      // Only capture while our view is still the one on screen.
      if (!rootRef.current?.isConnected) return;
      const mem: ScrollMemory = { scrollY: window.scrollY };
      for (const el of document.querySelectorAll<HTMLElement>('[data-sid]')) {
        const rect = el.getBoundingClientRect();
        if (rect.bottom > 0) {
          mem.anchorId = el.dataset.sid;
          mem.anchorTop = rect.top;
          break;
        }
      }
      write(name, mem);
    };
    const onScroll = () => {
      window.clearTimeout(idle);
      idle = window.setTimeout(flush, 160);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.clearTimeout(idle);
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  return rootRef;
}
