"use client";

import { useMemo, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { roughStarPaths } from "./RoughCircle";

/**
 * A sticker for the sticker book. Its hand-drawn outline draws itself with
 * DrawSVGPlugin; in calm mode / reduced motion it appears already drawn.
 */
export function Sticker({ label, animate = false, calm = true, size = 160 }: { label: string; animate?: boolean; calm?: boolean; size?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const paths = useMemo(() => roughStarPaths(200), []);

  useGSAP(
    () => {
      if (!animate) return;
      const mm = gsap.matchMedia();
      mm.add({ reduce: "(prefers-reduced-motion: reduce)", ok: "(prefers-reduced-motion: no-preference)" }, (ctx) => {
        const still = calm || ctx.conditions?.reduce;
        if (still) {
          gsap.fromTo(ref.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 });
          return;
        }
        const tl = gsap.timeline();
        tl.fromTo(".sticker-line", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.9, stagger: 0.25, ease: "power2.inOut" });
        tl.fromTo(".sticker-fill", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.45 }, "-=0.2");
      });
      return () => mm.revert();
    },
    { scope: ref, dependencies: [animate, calm] },
  );

  return (
    <svg ref={ref} viewBox="0 0 200 200" width={size} height={size} role="img" aria-label={label}>
      <circle className="sticker-fill" cx="100" cy="104" r="62" fill="var(--amber-100)" />
      {paths.map((d, i) => (
        <path key={i} className="sticker-line" d={d} fill="none" stroke="var(--amber-600)" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      <text className="sticker-fill" x="100" y="112" textAnchor="middle" fontSize="30" fontWeight="600" fill="var(--ink)" fontFamily="inherit">
        {label}
      </text>
    </svg>
  );
}
