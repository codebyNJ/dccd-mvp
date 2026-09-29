"use client";

import { Icon, type IconName } from "@/components/Icon";
import { S } from "@/config/strings";

export type ScheduleStep = "watch" | "practise" | "check" | "reward";
const STEPS: { id: ScheduleStep; icon: IconName }[] = [
  { id: "watch", icon: "eye" },
  { id: "practise", icon: "hand" },
  { id: "check", icon: "check" },
  { id: "reward", icon: "gift" },
];

/** Visual schedule: Watch → Practise → Check → Reward, current step highlighted. */
export function Schedule({ current, skipped = [] }: { current: ScheduleStep; skipped?: ScheduleStep[] }) {
  const at = STEPS.findIndex((s) => s.id === current);
  return (
    <nav aria-label={S.child.scheduleLabel} className="h-full">
      <ol className="flex h-full items-stretch gap-1.5 sm:gap-2">
        {STEPS.map((s, i) => {
          const isNow = i === at;
          const done = i < at && !skipped.includes(s.id);
          return (
            <li
              key={s.id}
              aria-current={isNow ? "step" : undefined}
              className={`flex min-w-0 items-center justify-center gap-2 rounded-[20px] border-2 px-2.5 transition-colors duration-300 ${
                isNow ? "flex-[2_1_auto] border-blue-700 bg-blue-700 text-white" : "flex-[1_1_0] border-line bg-surface text-ink-soft"
              } ${skipped.includes(s.id) ? "opacity-50" : ""}`}
            >
              <Icon name={done ? "check" : s.icon} className="h-[1em] w-[1em] shrink-0" />
              <span className={isNow ? "truncate" : "sr-only xl:not-sr-only xl:truncate"}>{S.child.schedule[s.id]}</span>
              {done && <span className="sr-only">(done)</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
