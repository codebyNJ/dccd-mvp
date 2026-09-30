"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import rough from "roughjs";
import { TIMING } from "@/config/timing";

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
 * The hand-drawn circle around a picture. It stays hidden until `show`
 * (after the child taps), then draws itself with DrawSVGPlugin; in calm mode
 * or under reduced motion it simply appears. Paths are generated in the
 * card's pixel size (re-generated on resize with the same seed).
 */
export function RoughCircle({ show, calm, color }: { show: boolean; calm: boolean; color: string }) {
  const box = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
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
  const drawn = useRef(false);

  useGSAP(
    () => {
      const el = svg.current;
      if (!el) return;
      if (!show) {
        drawn.current = false;
        gsap.set(el, { autoAlpha: 0 });
        return;
      }
      gsap.set(el, { autoAlpha: 1 });
      // A resize after drawing just re-shows the finished circle.
      if (drawn.current) return;
      drawn.current = true;
      const mm = gsap.matchMedia();
      mm.add({ reduce: "(prefers-reduced-motion: reduce)", ok: "(prefers-reduced-motion: no-preference)" }, (ctx) => {
        if (calm || ctx.conditions?.reduce) gsap.set(".rough-stroke", { drawSVG: "100%" });
        else
          gsap.fromTo(
            ".rough-stroke",
            { drawSVG: "0% live" },
            { drawSVG: "100% live", duration: TIMING.circleDraw, stagger: TIMING.circleDraw * 0.35, ease: "power1.inOut" },
          );
      });
      return () => mm.revert();
    },
    { scope: box, dependencies: [show, calm, paths] },
  );

  return (
    <div ref={box} className="pointer-events-none absolute -inset-[6%] z-10" aria-hidden>
      {size && (
        <svg ref={svg} width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`} className="rough-circle overflow-visible" style={{ visibility: "hidden" }}>
          {paths.map((d, i) => (
            <path key={i} d={d} className="rough-stroke" fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" />
          ))}
        </svg>
      )}
    </div>
  );
}
