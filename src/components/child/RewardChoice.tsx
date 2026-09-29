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
      {/* The guide already says the line above; on short screens the heading gives way to the buttons. */}
      <h1 className="text-center font-semibold [@media(max-height:560px)]:sr-only">{S.child.chooseReward}</h1>
      {/* Always one row of three, so nothing wraps under the next choice. */}
      <ul className="grid min-h-0 flex-1 grid-cols-3 grid-rows-1 gap-[var(--gap)]">
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
              className="child-btn h-full w-full !min-w-0 flex-col !gap-3 !px-1 text-center leading-tight"
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
