"use client";

import { motion } from "motion/react";
import { S } from "@/config/strings";
import { SPRING } from "@/config/timing";
import type { RewardId } from "@/lib/schema";
import { RewardIcon } from "./RewardScene";

export const tokenLayoutId = (slot: number) => `token-${slot}`;

/** A token: its layoutId lets it fly from the card into its slot. */
export function Token({ slot, size = "1em" }: { slot: number; size?: string }) {
  return (
    <motion.span
      layoutId={tokenLayoutId(slot)}
      transition={SPRING}
      className="block rounded-full border-[3px] border-amber-600 bg-amber-400"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 24 24" className="h-full w-full p-[18%]" aria-hidden>
        <path d="m12 3.5 2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9l-5.3 2.7 1-5.8L3.5 9.7l5.9-.9z" fill="var(--surface)" />
      </svg>
    </motion.span>
  );
}

/** First–then strip merged with the token board: "First: answer 5 [○○○○○]  Then: [reward]". */
export function TokenBoard({ size, filled, reward, flying }: { size: number; filled: number; reward: RewardId | null; flying: number | null }) {
  const slotSize = size === 10 ? "0.7em" : "0.95em";
  return (
    <div
      className="flex h-full min-h-[var(--tap-child)] flex-wrap items-center gap-x-3 gap-y-1 rounded-[24px] border-2 border-line bg-surface px-3 py-1.5"
      role="group"
      aria-label={`${S.child.first}: ${S.child.answerN(size)}. ${S.child.then}: ${reward ? S.child.rewards[reward] : ""}. ${S.child.tokens(filled, size)}.`}
    >
      <div className="flex min-w-0 items-center gap-2" aria-hidden>
        <span className="font-semibold text-ink">{S.child.first}</span>
        <span className="hidden text-ink-soft lg:inline">{S.child.answerN(size)}</span>
        <ol className={`grid gap-1 ${size === 10 ? "grid-cols-5" : "grid-flow-col"}`}>
          {Array.from({ length: size }, (_, i) => (
            <li key={i} className="relative grid place-items-center rounded-full border-2 border-dashed border-blue-300" style={{ width: slotSize, height: slotSize }}>
              {i < filled && flying !== i && <Token slot={i} size={slotSize} />}
            </li>
          ))}
        </ol>
      </div>
      <div className="flex min-w-0 items-center gap-2" aria-hidden>
        <span className="font-semibold text-ink">{S.child.then}</span>
        {reward && <RewardIcon reward={reward} className="h-[1.2em] w-[1.2em]" />}
        {reward && <span className="hidden truncate text-ink-soft md:inline">{S.child.rewards[reward]}</span>}
      </div>
    </div>
  );
}
