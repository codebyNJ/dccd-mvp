"use client";

import { motion } from "motion/react";
import { useMemo } from "react";
import { mulberry32 } from "@/lib/counterbalance";

const Star = () => (
  <svg viewBox="0 0 24 24" className="h-full w-full">
    <path d="m12 3.5 2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9l-5.3 2.7 1-5.8L3.5 9.7l5.9-.9z" fill="var(--amber-400)" stroke="var(--amber-600)" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

/**
 * "The end": stars come out one by one over a soft hill. Slow, no flashing,
 * no confetti; in calm mode Motion drops the movement and keeps the fades.
 */
export function RewardScene() {
  const pieces = useMemo(() => {
    const rng = mulberry32(485);
    return Array.from({ length: 12 }, (_, i) => ({ i, x: 6 + rng() * 88, y: 10 + rng() * 60, s: 0.6 + rng() * 0.8 }));
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[28px] bg-blue-50" aria-hidden>
      <div className="absolute inset-x-0 bottom-0 h-[18%] rounded-t-[40%] bg-blue-100" />
      {pieces.map((p) => (
        <motion.span
          key={p.i}
          className="absolute"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${5 + p.s * 5}vmin`, height: `${5 + p.s * 5}vmin` }}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, delay: p.i * 0.45, ease: "easeOut" }}
        >
          <Star />
        </motion.span>
      ))}
    </div>
  );
}
