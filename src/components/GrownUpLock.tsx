"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { S } from "@/config/strings";
import { TIMING, timeScale } from "@/config/timing";

/**
 * Press and hold for 2 seconds (or hold Space) to open the grown-up area.
 * It keeps children out; it is not security.
 */
export function GrownUpLock() {
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const raf = useRef(0);
  const start = useRef<number | null>(null);

  const cancel = () => {
    cancelAnimationFrame(raf.current);
    start.current = null;
    setProgress(0);
  };

  const begin = () => {
    if (start.current !== null) return;
    start.current = performance.now();
    const hold = TIMING.lockHoldMs * timeScale();
    const tick = () => {
      if (start.current === null) return;
      const p = Math.min(1, (performance.now() - start.current) / hold);
      setProgress(p);
      if (p >= 1) {
        start.current = null;
        router.push("/grown-up/");
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <button
      type="button"
      className="adult-btn relative !rounded-full !p-2 select-none"
      aria-label={S.grownUp.lockLabel}
      title={S.grownUp.lockHint}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        begin();
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          begin();
        }
      }}
      onKeyUp={(e) => (e.key === " " || e.key === "Enter") && cancel()}
      onBlur={cancel}
      data-testid="grown-up-lock"
    >
      <svg viewBox="0 0 48 48" width={44} height={44} aria-hidden>
        <circle cx="24" cy="24" r={r} fill="none" stroke="var(--line)" strokeWidth="3" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="var(--blue-700)"
          strokeWidth="3"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress)}
          transform="rotate(-90 24 24)"
          strokeLinecap="round"
        />
        <foreignObject x="12" y="12" width="24" height="24">
          <Icon name="lock" className="!h-6 !w-6 text-ink-soft" />
        </foreignObject>
      </svg>
    </button>
  );
}
