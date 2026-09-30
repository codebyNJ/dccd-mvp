"use client";

import { motion, type Variants } from "motion/react";
import { useRef, type ReactNode } from "react";
import { CHARACTERS, characterSrc, type CharacterId } from "@/data/characters";
import { S } from "@/config/strings";
import { SPRING, TIMING } from "@/config/timing";
import { useIdle } from "./useIdle";

/** Nothing marks a card before the tap. No red, no shake: a wrong pick looks like idle. */
export type CardState = "idle" | "answer" | "dimmed";

const variants: Variants = {
  hidden: { opacity: 0, y: 24, scale: 1 },
  idle: (i: number) => ({ opacity: 1, y: 0, scale: 1, transition: { ...SPRING, delay: i * TIMING.cardStagger } }),
  answer: { opacity: 1, y: 0, scale: 1.03, transition: { ...SPRING, duration: TIMING.feedback } },
  dimmed: { opacity: 0.4, y: 0, scale: 0.97, transition: { duration: TIMING.feedback } },
};

interface Props {
  character: CharacterId;
  index: number;
  state: CardState;
  calm: boolean;
  tappable: boolean;
  onTap: () => void;
  /** The circle and its label, drawn over the picture after a tap. */
  children?: ReactNode;
}

export function CharacterCard({ character, index, state, calm, tappable, onTap, children }: Props) {
  const art = useRef<HTMLDivElement>(null);
  useIdle(art, CHARACTERS[character].idle, calm, index * 0.7);

  return (
    <motion.button
      type="button"
      className="char-card"
      custom={index}
      variants={variants}
      initial="hidden"
      animate={state}
      data-state={state}
      whileTap={tappable ? { scale: 0.98 } : undefined}
      aria-label={S.child.card(CHARACTERS[character].name)}
      aria-disabled={!tappable}
      data-character={character}
      onClick={() => tappable && onTap()}
    >
      <div ref={art} className="flex h-full w-full items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- static export, images are pre-sized WebP */}
        <img src={characterSrc(character)} alt="" draggable={false} />
      </div>
      {children}
    </motion.button>
  );
}
