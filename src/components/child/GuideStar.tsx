"use client";

/**
 * The guide character: a soft rounded star with a simple face. Kept in this
 * one file so DCCD can swap in its own mascot (keep the props).
 *  - lean: gestures toward a card when giving a prompt (Motion, state-driven)
 *  - idle: a slow float (GSAP), off in calm mode / reduced motion
 */
import { motion } from "motion/react";
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { SPRING } from "@/config/timing";
import type { Side } from "@/lib/schema";

export function GuideStar({ lean, calm, size = 72 }: { lean: Side | null; calm: boolean; size?: number }) {
  const floatRef = useRef<SVGGElement>(null);

  useGSAP(
    () => {
      if (calm) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.to(floatRef.current, { y: -3, duration: 3.6, ease: "sine.inOut", yoyo: true, repeat: -1 });
      });
      return () => mm.revert();
    },
    { dependencies: [calm], revertOnUpdate: true },
  );

  return (
    <motion.div
      aria-hidden
      className="shrink-0"
      style={{ width: size, height: size }}
      animate={{ rotate: lean === "left" ? -10 : lean === "right" ? 10 : 0, x: lean === "left" ? -4 : lean === "right" ? 4 : 0 }}
      transition={SPRING}
    >
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <g ref={floatRef}>
          <path
            d="M50 8c4 0 6.5 3 8.6 8.2l5.2 12.6 13.6 1.2c5.6.5 9 2.4 10.2 6 1.2 3.7-.8 7-5 10.8L72.2 55.6l3.1 13.3c1.3 5.5.7 9.3-2.4 11.5-3.1 2.3-6.9 1.5-11.8-1.6L50 71.7l-11.1 7.1c-4.9 3.1-8.7 3.9-11.8 1.6-3.1-2.2-3.7-6-2.4-11.5l3.1-13.3-10.4-8.8c-4.2-3.8-6.2-7.1-5-10.8 1.2-3.6 4.6-5.5 10.2-6l13.6-1.2 5.2-12.6C43.5 11 46 8 50 8z"
            fill="var(--amber-400)"
            stroke="var(--amber-600)"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <circle cx="41" cy="44" r="3.6" fill="var(--ink)" />
          <circle cx="59" cy="44" r="3.6" fill="var(--ink)" />
          <circle cx="35" cy="53" r="4" fill="var(--coral-300)" opacity="0.7" />
          <circle cx="65" cy="53" r="4" fill="var(--coral-300)" opacity="0.7" />
          <path d="M43 54c4 4 10 4 14 0" fill="none" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
        </g>
      </svg>
    </motion.div>
  );
}

/** The pointing hand the guide "places" on the prompted card (opacity only, so it also shows in calm mode). */
export function PointerHand() {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <svg viewBox="0 0 48 48" width="52" height="52">
        <circle cx="24" cy="24" r="22" fill="var(--amber-100)" stroke="var(--amber-600)" strokeWidth="2.5" />
        <path
          d="M20 31V15.5a2.5 2.5 0 0 1 5 0V24m0-2.5a2.5 2.5 0 0 1 5 0V26m0-2a2.5 2.5 0 0 1 5 0v5c0 5-3 8-8 8h-2c-3 0-5-1.5-6.5-4L15 28.5a2.3 2.3 0 0 1 3.6-2.8L20 27"
          fill="none"
          stroke="var(--ink)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          transform="rotate(180 24 24)"
        />
      </svg>
    </motion.div>
  );
}
