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

  /**
   * A focus() call can arrive before ResizeObserver has measured us (the map
   * deep-link fires on mount). Park it and replay once we know our geometry,
   * otherwise the pin fly-to silently resolves against a zero-sized box.
   */
  const pendingFocus = useRef<{ x: number; y: number; scale?: number } | null>(null);

  const focusAt = useCallback(
    (nx: number, ny: number, scale: number | undefined, animate: boolean) => {
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
        setAnimating(true);
        setT(clamp({ scale: 1, x: 0, y: 0 }));
      },
      zoomBy(factor) {
        zoomAbout(factor, box.w / 2, box.h / 2, true);
      },
      getScale: () => t.scale,
    }),
    [clamp, box.w, base.w, zoomAbout, focusAt, t.scale]
  );

  /* ---------------- pointer handling ---------------- */

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; cx: number; cy: number } | null>(null);
  const moved = useRef(false);
  const lastTap = useRef(0);

  const localPoint = (e: { clientX: number; clientY: number }) => {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    // Let taps on pins/booths through to their own handlers.
    if ((e.target as HTMLElement).closest('[data-nodrag]')) return;
    containerRef.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
    setAnimating(false);

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = {
        dist: Math.hypot(a!.x - b!.x, a!.y - b!.y),
        cx: (a!.x + b!.x) / 2,
        cy: (a!.y + b!.y) / 2,
      };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 1) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved.current = true;
      setT((p) => clamp({ ...p, x: p.x + dx, y: p.y + dy }));
      return;
    }

    if (pointers.current.size === 2 && gesture.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      const cx = (a!.x + b!.x) / 2;
      const cy = (a!.y + b!.y) / 2;
      const factor = dist / gesture.current.dist;
      const rect = containerRef.current!.getBoundingClientRect();
      moved.current = true;

      setT((p) => {
        const scale = Math.min(Math.max(p.scale * factor, minScale), maxScale);
        const k = scale / p.scale;
        const px = cx - rect.left;
        const py = cy - rect.top;
        // Combine the pinch with the two-finger drag of the midpoint.
        return clamp({
          scale,
          x: px - (px - p.x) * k + (cx - gesture.current!.cx),
          y: py - (py - p.y) * k + (cy - gesture.current!.cy),
        });
      });
      gesture.current = { dist, cx, cy };
    }
  };

  const endPointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current = null;

    if (pointers.current.size === 0 && !moved.current) {
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
