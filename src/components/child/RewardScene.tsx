"use client";

import { motion } from "motion/react";
import { useMemo } from "react";
import { TIMING } from "@/config/timing";
import { mulberry32 } from "@/lib/counterbalance";
import type { RewardId } from "@/lib/schema";

/** Small line icon for each reward (choice board and first–then strip). */
export function RewardIcon({ reward, className }: { reward: RewardId; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      {reward === "bubbles" && (
        <g fill="var(--blue-50)" stroke="var(--blue-500)" strokeWidth="3">
          <circle cx="18" cy="28" r="11" />
          <circle cx="34" cy="15" r="7" />
          <circle cx="36" cy="35" r="5" />
        </g>
      )}
      {reward === "stars" && (
        <g stroke="var(--amber-600)" strokeWidth="2.5" strokeLinejoin="round" fill="var(--amber-400)">
          <path d="m17 8 3 6 6.5 1-4.7 4.6 1.1 6.5L17 23l-5.9 3.1 1.1-6.5L7.5 15l6.5-1z" />
          <path d="m34 22 2.2 4.4 4.8.7-3.5 3.4.8 4.8-4.3-2.3-4.3 2.3.8-4.8-3.5-3.4 4.8-.7z" />
          <path d="M6 42h36" fill="none" stroke="var(--blue-500)" strokeLinecap="round" />
        </g>
      )}
      {reward === "fish" && (
        <g strokeWidth="2.5" strokeLinejoin="round">
          <path d="M6 24c6-8 16-10 24-6l10-6v24l-10-6c-8 4-18 2-24-6z" fill="var(--coral-300)" stroke="var(--coral-600)" />
          <circle cx="15" cy="22" r="2" fill="var(--ink)" />
        </g>
      )}
    </svg>
  );
}

const Fish = ({ color }: { color: string }) => (
  <svg viewBox="0 0 64 40" className="h-full w-full">
    <path d="M4 20C12 8 28 5 40 12l16-9v34l-16-9C28 35 12 32 4 20z" fill={color} stroke="var(--ink-soft)" strokeWidth="2" strokeLinejoin="round" />
    <circle cx="16" cy="18" r="2.6" fill="var(--ink)" />
  </svg>
);

const Star = () => (
  <svg viewBox="0 0 24 24" className="h-full w-full">
    <path d="m12 3.5 2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9l-5.3 2.7 1-5.8L3.5 9.7l5.9-.9z" fill="var(--amber-400)" stroke="var(--amber-600)" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

/**
 * Calm reward animations (Motion): slow, soft, no flashing, no confetti.
 * In calm mode Motion drops the movement and only the gentle fades remain.
 */
export function RewardScene({ reward }: { reward: RewardId }) {
  const rng = useMemo(() => mulberry32(reward.length * 97), [reward]);
  const pieces = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({ i, x: 6 + rng() * 88, y: 10 + rng() * 75, s: 0.6 + rng() * 0.8, d: rng() * 3.5 })),
    [rng],
  );
  const L = TIMING.reward;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[28px] bg-blue-50" aria-hidden>
      {reward === "bubbles" &&
        pieces.map((p) => (
          <motion.span
            key={p.i}
            className="absolute rounded-full border-[3px] border-blue-300 bg-white/60"
            style={{ left: `${p.x}%`, bottom: "-12%", width: `${3 + p.s * 5}vmin`, height: `${3 + p.s * 5}vmin` }}
            initial={{ y: 0, opacity: 0 }}
            animate={{ y: "-95vh", opacity: [0, 1, 1, 0] }}
            transition={{ duration: L.itemRise + p.s, delay: p.d, ease: "linear", repeat: Infinity, repeatDelay: 0.4 }}
          />
        ))}

      {reward === "stars" && (
        <>
          <div className="absolute inset-x-0 bottom-0 h-[18%] rounded-t-[40%] bg-blue-100" />
          {pieces.map((p) => (
            <motion.span
              key={p.i}
              className="absolute"
              style={{ left: `${p.x}%`, top: `${Math.min(p.y, 70)}%`, width: `${5 + p.s * 5}vmin`, height: `${5 + p.s * 5}vmin` }}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.9, delay: p.i * 0.45, ease: "easeOut" }}
            >
              <Star />
            </motion.span>
          ))}
        </>
      )}

      {reward === "fish" &&
        pieces.slice(0, 7).map((p) => (
          <motion.span
            key={p.i}
            className="absolute"
            style={{ top: `${8 + p.i * 12}%`, left: "-20%", width: `${9 + p.s * 6}vmin`, height: `${6 + p.s * 4}vmin` }}
            initial={{ x: 0, opacity: 0 }}
            animate={{ x: "130vw", opacity: [0, 1, 1, 0] }}
            transition={{ duration: 9 + p.s * 3, delay: p.d, ease: "linear", repeat: Infinity }}
          >
            <span className="block h-full w-full -scale-x-100">
              <Fish color={["var(--coral-300)", "var(--amber-400)", "var(--blue-300)"][p.i % 3]} />
            </span>
          </motion.span>
        ))}
    </div>
  );
}
