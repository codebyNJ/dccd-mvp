"use client";

import { useEffect, useState } from "react";
import { splitWords, activeWordIndex } from "@/lib/words";
import { useSpeech } from "@/lib/voice";
import { CANT } from "@/lib/templates";

/**
 * A spoken line as word spans. The active word is found by comparing the
 * voice's playback position with the word timings, every animation frame.
 * The highlight is a soft colour change only.
 */
export function ReadAlong({ text, className = "", id }: { text: string; className?: string; id?: string }) {
  const speech = useSpeech((s) => (s.current?.text === text ? s.current : null));
  const [active, setActive] = useState(-1);

  useEffect(() => {
    if (!speech) {
      setActive(-1);
      return;
    }
    let raf = 0;
    const tick = () => {
      setActive(activeWordIndex(speech.words, speech.position()));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speech]);

  return (
    <p id={id} className={`font-medium text-ink ${className}`}>
      {splitWords(text).map((w, i) => (
        <span key={i}>
          <span
            className="rounded-[10px] px-[0.08em] transition-colors duration-200"
            style={{
              background: i === active ? "var(--blue-100)" : "transparent",
              color: w.toLowerCase().startsWith(CANT) ? "var(--coral-ink)" : undefined,
            }}
          >
            {w}
          </span>{" "}
        </span>
      ))}
    </p>
  );
}
