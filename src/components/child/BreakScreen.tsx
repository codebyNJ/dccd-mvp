"use client";

import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import { Icon } from "@/components/Icon";
import { S } from "@/config/strings";
import { TIMING } from "@/config/timing";

/** The Break card: always visible to the child. */
export function BreakButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="child-btn h-full w-full flex-col !gap-0.5 !px-2" onClick={onClick}>
      <Icon name="pause" />
      <span>{S.child.break}</span>
    </button>
  );
}

/** A calm break: no countdown, no timer. Ends only when someone taps Ready. */
export function BreakScreen({ onReady, onStop }: { onReady: () => void; onStop: () => void }) {
  const readyRef = useRef<HTMLButtonElement>(null);
  useEffect(() => readyRef.current?.focus(), []);
  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="break-title"
      className="child fixed inset-0 z-40 flex flex-col items-center justify-center gap-6 bg-blue-50 p-6 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: TIMING.screenFade }}
    >
      <svg viewBox="0 0 120 80" className="w-[min(60vw,320px)]" aria-hidden>
        <path d="M10 62c14-10 28-10 42 0s28 10 42 0 18-8 18-8" fill="none" stroke="var(--blue-300)" strokeWidth="5" strokeLinecap="round" />
        <circle cx="86" cy="24" r="12" fill="var(--amber-100)" stroke="var(--amber-400)" strokeWidth="4" />
      </svg>
      <h1 id="break-title" className="font-semibold">
        {S.child.breakTitle}
      </h1>
      <p className="text-ink-soft">{S.child.breakBody}</p>
      <div className="flex flex-wrap justify-center gap-4">
        <button ref={readyRef} className="child-btn primary min-w-[200px]" onClick={onReady}>
          <Icon name="check" />
          {S.child.ready}
        </button>
        <button className="child-btn" onClick={onStop}>
          <Icon name="home" />
          {S.child.home}
        </button>
      </div>
    </motion.div>
  );
}

export function MuteButton({ muted, onToggle }: { muted: boolean; onToggle: () => void }) {
  return (
    <button className="child-btn h-full !px-2" aria-pressed={muted} aria-label={S.child.mute} onClick={onToggle}>
      <Icon name={muted ? "soundOff" : "soundOn"} className="!h-[1.3em] !w-[1.3em]" />
    </button>
  );
}
