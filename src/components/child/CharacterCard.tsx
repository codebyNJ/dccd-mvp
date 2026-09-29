"use client";

import { AnimatePresence, motion, type Variants } from "motion/react";
import { forwardRef, useRef, type ReactNode } from "react";
import { CHARACTERS, characterSrc, type CharacterId } from "@/data/characters";
import { S } from "@/config/strings";
import { SPRING, TIMING } from "@/config/timing";
import { PointerHand } from "./GuideStar";
import { Token } from "./TokenBoard";
import { useIdle } from "./useIdle";

export type CardState = "hidden" | "idle" | "glow" | "prompted" | "picked-correct" | "picked-wrong" | "dimmed";

// Two shadow layers in every state so Motion can interpolate them. No red, no shake: a wrong pick looks like idle.
const SHADOW = {
  base: "0 0 0 0px rgba(141,191,224,0), 0 6px 18px rgba(27,42,56,0.08)",
  glow: "0 0 0 6px rgba(141,191,224,1), 0 8px 30px rgba(58,143,196,0.45)",
  correct: "0 0 0 6px rgba(29,90,128,1), 0 6px 18px rgba(27,42,56,0.08)",
};
const glowT = { boxShadow: { duration: TIMING.promptGlow, ease: "easeOut" } } as const;

const variants: Variants = {
  hidden: { opacity: 0, y: 24, scale: 1, boxShadow: SHADOW.base },
  idle: (i: number) => ({ opacity: 1, y: 0, scale: 1, boxShadow: SHADOW.base, transition: { ...SPRING, delay: i * TIMING.cardStagger } }),
  glow: { opacity: 1, y: 0, scale: 1, boxShadow: SHADOW.glow, transition: { ...SPRING, ...glowT } },
  prompted: { opacity: 1, y: 0, scale: TIMING.promptGrowScale, boxShadow: SHADOW.glow, transition: { ...SPRING, ...glowT } },
  "picked-correct": { opacity: 1, y: 0, scale: 1.03, boxShadow: SHADOW.correct, transition: { ...SPRING, duration: TIMING.feedback } },
  "picked-wrong": { opacity: 1, y: 0, scale: 1, boxShadow: SHADOW.base, transition: SPRING },
  dimmed: { opacity: 0.35, y: 0, scale: 0.97, boxShadow: SHADOW.base, transition: { duration: TIMING.feedback } },
};

interface Props {
  character: CharacterId;
  index: number;
  state: CardState;
  calm: boolean;
  tappable: boolean;
  onTap?: () => void;
  showHand?: boolean;
  tokenSlot?: number | null;
  children?: ReactNode;
  describedBy?: string;
  /** false when something else (the Watch GSAP timeline) owns the entrance. */
  enter?: boolean;
}

export const CharacterCard = forwardRef<HTMLDivElement, Props>(function CharacterCard(
  { character, index, state, calm, tappable, onTap, showHand = false, tokenSlot = null, children, describedBy, enter = true },
  ref,
) {
  const art = useRef<HTMLDivElement>(null);
  useIdle(art, CHARACTERS[character].idle, calm, index * 0.7);

  const inner = (
    <>
      <div ref={art} className="flex h-full w-full items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- static export, images are pre-sized WebP */}
        <img src={characterSrc(character)} alt="" draggable={false} />
      </div>
      <AnimatePresence>{showHand && <PointerHand key="hand" />}</AnimatePresence>
      {tokenSlot !== null && (
        <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[56px]">
          <Token slot={tokenSlot} />
        </span>
      )}
      {children}
    </>
  );

  if (!onTap) {
    return (
      <motion.div ref={ref} className="char-card" custom={index} variants={variants} initial={enter ? "hidden" : false} animate={state} role="img" aria-label={S.child.card(CHARACTERS[character].name)} aria-describedby={describedBy}>
        {inner}
      </motion.div>
    );
  }

  return (
    <motion.button
      type="button"
      className="char-card"
      custom={index}
      variants={variants}
      initial={enter ? "hidden" : false}
      animate={state}
      data-state={state}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
      whileTap={tappable ? { scale: 0.98 } : undefined}
      aria-label={S.child.card(CHARACTERS[character].name)}
      aria-disabled={!tappable}
      data-character={character}
      onClick={() => tappable && onTap()}
    >
      {inner}
    </motion.button>
  );
});
