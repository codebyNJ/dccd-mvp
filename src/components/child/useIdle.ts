"use client";

import { type RefObject } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { IdleStyle } from "@/data/characters";
import { TIMING } from "@/config/timing";

/** Personality per character: slow sine yoyo, small amplitude. */
const IDLE: Record<IdleStyle, gsap.TweenVars> = {
  sway: { rotation: 3, transformOrigin: "50% 90%", duration: 4.2 }, // snake sways
  hop: { y: -7, duration: 3 }, // bird hops slightly
  bob: { y: -6, duration: 3.6 }, // monkey bobs
  breathe: { scale: 1.025, transformOrigin: "50% 85%", duration: 4.6 }, // lion breathes
  flap: { scaleX: 1.045, transformOrigin: "50% 50%", duration: 3.2 }, // bat's wings scale gently
  tilt: { rotation: -3, transformOrigin: "50% 75%", duration: 4 }, // cat tilts its head
  bounce: { y: -5, duration: 3.2 }, // dog bounces slightly
  people: { rotation: 1.4, transformOrigin: "50% 100%", duration: 5 }, // people sway slowly
};

/**
 * GSAP idle loop on the image wrapper (never the card itself, which Motion owns).
 * Stops in calm mode and when the OS asks for reduced motion.
 */
export function useIdle(ref: RefObject<HTMLElement | null>, style: IdleStyle, calm: boolean, offset = 0) {
  useGSAP(
    () => {
      if (calm || !ref.current) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const { duration, ...vars } = IDLE[style];
        const d = Math.min(TIMING.idle.maxSeconds, Math.max(TIMING.idle.minSeconds, Number(duration)));
        gsap.to(ref.current, { ...vars, duration: d, ease: TIMING.idle.ease, yoyo: true, repeat: -1, delay: offset });
      });
      return () => mm.revert();
    },
    { dependencies: [style, calm, offset], revertOnUpdate: true },
  );
}
