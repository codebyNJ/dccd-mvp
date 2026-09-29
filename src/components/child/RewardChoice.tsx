"use client";

import { motion } from "motion/react";
import { S } from "@/config/strings";
import { SPRING, TIMING } from "@/config/timing";
import type { RewardId } from "@/lib/schema";
import { RewardIcon } from "./RewardScene";

const REWARDS: RewardId[] = ["bubbles", "stars", "fish"];

/** Choice board: before a session the child picks one of three calm rewards. */
export function RewardChoice({ onChoose }: { onChoose: (r: RewardId) => void }) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-[var(--gap)]">
      <h1 className="text-center font-semibold">{S.child.chooseReward}</h1>
      <ul className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fit,minmax(min(140px,100%),1fr))] gap-[var(--gap)]">
        {REWARDS.map((r, i) => (
          <motion.li
            key={r}
            className="min-h-0"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: i * TIMING.cardStagger }}
          >
            <motion.button
              whileTap={{ scale: 0.97 }}
              className="child-btn h-full w-full flex-col !gap-3"
              onClick={() => onChoose(r)}
            >
              <RewardIcon reward={r} className="h-auto max-h-[40%] w-[min(40%,160px)]" />
              <span>{S.child.rewards[r]}</span>
            </motion.button>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
