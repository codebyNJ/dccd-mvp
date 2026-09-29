"use client";

import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import rough from "roughjs";

const generator = rough.generator();

/** Hand-drawn outlines with a fixed seed, so they look the same every time. */
export function roughEllipsePaths(w: number, h: number, seed = 7): string[] {
  const d = generator.ellipse(w / 2, h / 2, w * 0.9, h * 0.9, { seed, roughness: 1.4, bowing: 1.2, strokeWidth: 5 });
  return generator.toPaths(d).map((p) => p.d);
}

export function roughStarPaths(size: number, seed = 11): string[] {
  const c = size / 2;
  const pts: [number, number][] = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? c * 0.92 : c * 0.42;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    return [c + r * Math.cos(a), c + r * Math.sin(a)];
  });
  const d = generator.polygon(pts, { seed, roughness: 1.1, strokeWidth: 4 });
  return generator.toPaths(d).map((p) => p.d);
}

/**
 * The circle drawn around the character who can't. Paths are generated in
 * the card's pixel size (re-generated on resize with the same seed), and
 * GSAP DrawSVGPlugin draws them via the `.rough-stroke` class.
 */
export const RoughCircle = forwardRef<SVGSVGElement, { className?: string }>(function RoughCircle({ className }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      setSize((s) => (s && Math.abs(s.w - width) < 2 && Math.abs(s.h - height) < 2 ? s : { w: Math.round(width), h: Math.round(height) }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const paths = useMemo(() => (size ? roughEllipsePaths(size.w, size.h) : []), [size]);

  return (
    <div ref={box} className={`pointer-events-none absolute -inset-[6%] ${className ?? ""}`} aria-hidden>
      {size && (
        <svg ref={ref} width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`} className="rough-circle overflow-visible" style={{ visibility: "hidden" }}>
          {paths.map((d, i) => (
            <path key={i} d={d} className="rough-stroke" fill="none" stroke="var(--coral-500)" strokeWidth={5} strokeLinecap="round" />
          ))}
        </svg>
      )}
    </div>
  );
});
