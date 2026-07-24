import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  forwardRef,
  type ReactNode,
} from 'react';

/**
 * Pan/zoom surface for the venue maps.
 *
 * Hand-rolled rather than pulled from a library: we need programmatic
 * "fly to this normalized point" for the event -> map deep link, and the whole
 * app has to work offline from a precached bundle, so every KB of dependency is
 * a KB downloaded over con wifi.
 *
 * Children are laid out in a box of the image's natural aspect ratio; all
 * overlays position themselves with normalized 0..1 percentages, so they stay
 * glued to the map at any zoom.
 */

export interface PanZoomHandle {
  /** Centre a normalized point, optionally zooming to `scale`. */
  focus: (x: number, y: number, scale?: number, animate?: boolean) => void;
  reset: () => void;
  zoomBy: (factor: number) => void;
  getScale: () => number;
}

interface Props {
  aspect: number;
  children: ReactNode;
  minScale?: number;
  maxScale?: number;
  className?: string;
  onScaleChange?: (scale: number) => void;
}

interface Transform {
  scale: number;
  x: number;
  y: number;
}

export const PanZoom = forwardRef<PanZoomHandle, Props>(function PanZoom(
  { aspect, children, minScale = 1, maxScale = 9, className, onScaleChange },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [t, setT] = useState<Transform>({ scale: 1, x: 0, y: 0 });
  const [animating, setAnimating] = useState(false);

  // Base (scale-1) size of the content: the image "contain"-fitted to the box.
  const base = (() => {
    if (!box.w || !box.h) return { w: 0, h: 0 };
    const byWidth = { w: box.w, h: box.w / aspect };
    return byWidth.h <= box.h ? byWidth : { w: box.h * aspect, h: box.h };
  })();

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** Keep the content overlapping the viewport instead of drifting into space. */
  const clamp = useCallback(
    (next: Transform): Transform => {
      const scale = Math.min(Math.max(next.scale, minScale), maxScale);
      const w = base.w * scale;
      const h = base.h * scale;
      // Axis smaller than the viewport: pin it centred. Larger: don't let an
      // edge pull inside the viewport.
      const x = w <= box.w ? (box.w - w) / 2 : Math.min(0, Math.max(box.w - w, next.x));
      const y = h <= box.h ? (box.h - h) / 2 : Math.min(0, Math.max(box.h - h, next.y));
      return { scale, x, y };
    },
    [base.w, base.h, box.w, box.h, minScale, maxScale]
  );

  // ---- Fling / momentum ----
  // Track recent pointer velocity (px per ms) and coast after release with
  // friction until it slows to a stop or hits an edge. Defined here (before the
  // zoom helpers) so those can cancel an in-flight coast.
  const velocity = useRef({ vx: 0, vy: 0 });
  const lastMove = useRef({ t: 0, x: 0, y: 0 });
  const momentumRAF = useRef(0);
  const tRef = useRef(t);
  tRef.current = t;

  const cancelMomentum = useCallback(() => {
    if (momentumRAF.current) {
      cancelAnimationFrame(momentumRAF.current);
      momentumRAF.current = 0;
    }
  }, []);

  const startMomentum = useCallback(() => {
    const FRICTION = 0.93; // per 60fps frame
    const MIN_SPEED = 0.02; // px/ms — below this, stop
    let { vx, vy } = velocity.current;
    if (Math.hypot(vx, vy) < 0.05) return; // not a real fling
    let last = 0;
    const step = (now: number) => {
      if (!last) last = now;
      const dt = Math.min(now - last, 40);
      last = now;
      const decay = Math.pow(FRICTION, dt / 16.667);
      vx *= decay;
      vy *= decay;
      const p = tRef.current;
      const next = clamp({ scale: p.scale, x: p.x + vx * dt, y: p.y + vy * dt });
      if (next.x === p.x) vx = 0; // hit a horizontal edge
      if (next.y === p.y) vy = 0; // hit a vertical edge
      tRef.current = next;
      setAnimating(false);
      setT(next);
      if (Math.hypot(vx, vy) >= MIN_SPEED) {
        momentumRAF.current = requestAnimationFrame(step);
      } else {
        momentumRAF.current = 0;
      }
    };
    momentumRAF.current = requestAnimationFrame(step);
  }, [clamp]);

  /**
   * A focus() call can arrive before ResizeObserver has measured us (the map
   * deep-link fires on mount). Park it and replay once we know our geometry,
   * otherwise the pin fly-to silently resolves against a zero-sized box.
   */
  const pendingFocus = useRef<{ x: number; y: number; scale?: number } | null>(null);

  const focusAt = useCallback(
    (nx: number, ny: number, scale: number | undefined, animate: boolean) => {
      cancelMomentum();
      setAnimating(animate);
      setT((prev) => {
        const s = Math.min(Math.max(scale ?? prev.scale, minScale), maxScale);
        return clamp({
          scale: s,
          x: box.w / 2 - nx * base.w * s,
          y: box.h / 2 - ny * base.h * s,
        });
      });
    },
    [clamp, box.w, box.h, base.w, base.h, minScale, maxScale]
  );

  // Re-centre whenever the container or image geometry changes.
  useEffect(() => {
    if (!base.w) return;
    if (pendingFocus.current) {
      const { x, y, scale } = pendingFocus.current;
      pendingFocus.current = null;
      focusAt(x, y, scale, true);
      return;
    }
    setT((prev) => clamp(prev));
  }, [clamp, focusAt, base.w, base.h]);

  useEffect(() => {
    onScaleChange?.(t.scale);
  }, [t.scale, onScaleChange]);

  /** Zoom about a fixed viewport point so content under the fingers stays put. */
  const zoomAbout = useCallback(
    (factor: number, px: number, py: number, animate = false) => {
      cancelMomentum();
      setAnimating(animate);
      setT((prev) => {
        const scale = Math.min(Math.max(prev.scale * factor, minScale), maxScale);
        const k = scale / prev.scale;
        return clamp({ scale, x: px - (px - prev.x) * k, y: py - (py - prev.y) * k });
      });
    },
    [clamp, minScale, maxScale]
  );

  useImperativeHandle(
    ref,
    () => ({
      focus(nx, ny, scale, animate = true) {
        if (!base.w || !box.w) {
          pendingFocus.current = { x: nx, y: ny, scale };
          return;
        }
        focusAt(nx, ny, scale, animate);
      },
      reset() {
        cancelMomentum();
        setAnimating(true);
        setT(clamp({ scale: 1, x: 0, y: 0 }));
      },
      zoomBy(factor) {
        zoomAbout(factor, box.w / 2, box.h / 2, true);
      },
      getScale: () => t.scale,
    }),
    [clamp, box.w, base.w, zoomAbout, focusAt, t.scale, cancelMomentum]
  );

  /* ---------------- pointer handling ---------------- */

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; cx: number; cy: number } | null>(null);
  const moved = useRef(false);
  const lastTap = useRef(0);
  // Where a single-pointer press started, and whether it has become a drag.
  // We defer capturing the pointer until movement passes DRAG_THRESHOLD, so a
  // tap that lands on a pin/booth still fires that element's own click, while a
  // drag that starts on one pans the map.
  const downPoint = useRef<{ x: number; y: number } | null>(null);
  const DRAG_THRESHOLD = 8;

  const localPoint = (e: { clientX: number; clientY: number }) => {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    cancelMomentum(); // grabbing the map stops any coasting
    velocity.current = { vx: 0, vy: 0 };
    lastMove.current = { t: performance.now(), x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
    setAnimating(false);

    if (pointers.current.size === 2) {
      // Second finger down → pinch. Capture both now.
      downPoint.current = null;
      for (const id of pointers.current.keys()) {
        try {
          containerRef.current?.setPointerCapture(id);
        } catch {
          /* pointer already gone */
        }
      }
      const [a, b] = [...pointers.current.values()];
      gesture.current = {
        dist: Math.hypot(a!.x - b!.x, a!.y - b!.y),
        cx: (a!.x + b!.x) / 2,
        cy: (a!.y + b!.y) / 2,
      };
    } else {
      // Single press: don't capture yet — decide tap vs drag on move.
      downPoint.current = { x: e.clientX, y: e.clientY };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 1) {
      // Below the threshold it's still a potential tap: don't pan, don't
      // capture (so a pin/booth click can fire on release).
      if (!moved.current) {
        const start = downPoint.current;
        if (!start) return;
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < DRAG_THRESHOLD) return;
        moved.current = true;
        try {
          containerRef.current?.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;

      // Track velocity for the fling. Smooth lightly to reject single-frame jitter.
      const now = performance.now();
      const mdt = now - lastMove.current.t;
      if (mdt > 0) {
        const ivx = (e.clientX - lastMove.current.x) / mdt;
        const ivy = (e.clientY - lastMove.current.y) / mdt;
        velocity.current = {
          vx: ivx * 0.7 + velocity.current.vx * 0.3,
          vy: ivy * 0.7 + velocity.current.vy * 0.3,
        };
        lastMove.current = { t: now, x: e.clientX, y: e.clientY };
      }

      setT((p) => clamp({ ...p, x: p.x + dx, y: p.y + dy }));
      return;
    }

    if (pointers.current.size === 2 && gesture.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      const cx = (a!.x + b!.x) / 2;
      const cy = (a!.y + b!.y) / 2;

      // Capture the previous gesture and advance it NOW, synchronously. The
      // setT updater below runs later (batched) — if it read gesture.current
      // then, a finger lifting first (endPointer sets it null) would throw and
      // blank the map, and mid-pinch it would read the already-updated value.
      const prev = gesture.current;
      gesture.current = { dist, cx, cy };
      // Fingers on the same spot → degenerate distance; skip this frame.
      if (prev.dist < 1 || dist < 1) return;

      const factor = dist / prev.dist;
      const dMidX = cx - prev.cx;
      const dMidY = cy - prev.cy;
      const rect = containerRef.current!.getBoundingClientRect();
      const px = cx - rect.left;
      const py = cy - rect.top;
      moved.current = true;

      setT((p) => {
        const scale = Math.min(Math.max(p.scale * factor, minScale), maxScale);
        const k = scale / p.scale;
        // Zoom about the pinch midpoint, plus the two-finger drag of it.
        const nx = px - (px - p.x) * k + dMidX;
        const ny = py - (py - p.y) * k + dMidY;
        if (!Number.isFinite(nx) || !Number.isFinite(ny)) return p;
        return clamp({ scale, x: nx, y: ny });
      });
    }
  };

  const endPointer = (e: React.PointerEvent) => {
    const wasDrag = pointers.current.size === 1 && moved.current;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current = null;
    if (pointers.current.size === 0) downPoint.current = null;

    // Lifting the last finger after a real drag → coast, unless the finger had
    // paused before release (stale velocity means the user meant to stop).
    if (wasDrag && pointers.current.size === 0) {
      if (performance.now() - lastMove.current.t < 60) startMomentum();
    }

    if (pointers.current.size === 0 && !moved.current) {
      // A tap. If it landed on a pin/booth, its own click handler runs (we
      // never captured, so that still fires) — don't also double-tap-zoom.
      const onTarget = (e.target as HTMLElement).closest('[data-nodrag]');
      if (onTarget) return;

      const now = Date.now();
      if (now - lastTap.current < 300) {
        const { x, y } = localPoint(e);
        // Double-tap toggles between fit and a useful reading zoom.
        zoomAbout(t.scale > minScale * 1.4 ? minScale / t.scale : 2.5, x, y, true);
        lastTap.current = 0;
      } else {
        lastTap.current = now;
      }
    }
  };

  // Non-passive wheel listener: React's onWheel is passive, so preventDefault
  // there would be ignored and the page would scroll behind the map.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomAbout(
        Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022)),
        e.clientX - rect.left,
        e.clientY - rect.top
      );
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAbout]);

  // Stop any coasting animation if the component goes away.
  useEffect(() => cancelMomentum, [cancelMomentum]);

  return (
    <div
      className={`panzoom${className ? ` ${className}` : ''}`}
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
    >
      <div
        className="panzoom__content"
        style={{
          width: base.w || '100%',
          height: base.h || '100%',
          transform: `translate3d(${t.x}px, ${t.y}px, 0) scale(${t.scale})`,
          transformOrigin: '0 0',
          transition: animating ? 'transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
});
