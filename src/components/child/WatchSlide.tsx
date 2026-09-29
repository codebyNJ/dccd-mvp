"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { S } from "@/config/strings";
import { TIMING, timeScale } from "@/config/timing";
import type { CharacterId } from "@/data/characters";
import type { Item, Polarity, Side } from "@/lib/schema";
import { otherCharacter, teachLine } from "@/lib/templates";
import { speak, type SpeakOptions, type Speech } from "@/lib/voice";
import { CharacterCard } from "./CharacterCard";
import { RoughCircle } from "./RoughCircle";

interface Props {
  item: Item;
  polarity: Polarity;
  /** Side of the character who can't. */
  cantSide: Side;
  calm: boolean;
  voice: SpeakOptions;
  paused: boolean;
  onFinished: () => void;
}

const wordStart = (s: Speech, match: (w: string) => boolean, from = 0) => {
  const i = s.words.findIndex((w, k) => k >= from && match(w.word.toLowerCase().replace("’", "'")));
  return i < 0 ? { i: -1, t: s.duration * 0.4 } : { i, t: s.words[i].start };
};

/**
 * Modelling slide. The characters glide in, the teach line is spoken with
 * read-along, a hand-drawn circle draws itself around the character who
 * can't, then the "can't" (coral) and "can" labels appear. The GSAP timeline
 * is paused and its time is set from the narration clock every frame, so
 * pausing the voice pauses the animation and replay restarts both.
 */
export function WatchSlide({ item, polarity, cantSide, calm, voice, paused, onFinished }: Props) {
  const scope = useRef<HTMLDivElement>(null);
  const speechRef = useRef<Speech | null>(null);
  const pausedRef = useRef(paused);
  const done = useRef(onFinished);
  useEffect(() => {
    done.current = onFinished;
  }, [onFinished]);

  const cant: CharacterId = item.answer;
  const can: CharacterId = otherCharacter(item);
  const left = cantSide === "left" ? cant : can;
  const right = cantSide === "left" ? can : cant;
  const line = teachLine(item, polarity);

  useEffect(() => {
    pausedRef.current = paused;
    if (paused) speechRef.current?.pause();
    else speechRef.current?.resume();
  }, [paused]);

  useGSAP(
    () => {
      const W = TIMING.watch;
      const mm = gsap.matchMedia();
      mm.add({ reduce: "(prefers-reduced-motion: reduce)", ok: "(prefers-reduced-motion: no-preference)" }, (ctx) => {
        const still = calm || Boolean(ctx.conditions?.reduce);
        const tl = gsap.timeline({ paused: true });
        const cards = gsap.utils.toArray<HTMLElement>(".watch-card");
        gsap.set([".label-cant", ".label-can"], { autoAlpha: 0 });

        // Characters glide in (fade only when still).
        cards.forEach((el, i) => {
          const from = still ? { autoAlpha: 0 } : { autoAlpha: 0, x: (i === 0 ? -1 : 1) * W.glideDistance };
          tl.fromTo(el, from, { autoAlpha: 1, x: 0, duration: still ? 0.3 : W.glideIn, ease: W.ease }, i * 0.12);
        });

        let added = false;
        let lastDone = false;
        const start = performance.now();
        const addNarrationBeats = (s: Speech) => {
          // Beats are placed on the narration clock using the line's word timings.
          const cantWord = wordStart(s, (w) => w.startsWith("can't"));
          const canWord = wordStart(s, (w) => w === "can", 0);
          const tCant = W.leadIn + cantWord.t;
          const tCan = W.leadIn + canWord.t;
          if (still) tl.set(".rough-circle", { autoAlpha: 1 }, tCant).set(".rough-stroke", { drawSVG: "100%" }, tCant);
          else
            tl.set(".rough-circle", { autoAlpha: 1 }, tCant).fromTo(
              ".rough-stroke",
              { drawSVG: "0% live" },
              { drawSVG: "100% live", duration: W.circleDraw, stagger: W.circleDraw * 0.35, ease: "power1.inOut" },
              tCant,
            );
          const labelIn = still ? { autoAlpha: 1, duration: 0.2 } : { autoAlpha: 1, y: 0, duration: W.labelFade, ease: W.ease };
          const labelFrom = still ? { autoAlpha: 0 } : { autoAlpha: 0, y: 8 };
          tl.fromTo(".label-cant", labelFrom, labelIn, tCant + (still ? 0 : W.circleDraw * 0.6));
          tl.fromTo(".label-can", labelFrom, labelIn, tCan);
          tl.to({}, { duration: 0.01 }, W.leadIn + s.duration);
        };

        // Drive the timeline from the narration clock.
        const tick = () => {
          if (pausedRef.current) return;
          const s = speechRef.current;
          if (!s) {
            const e = (performance.now() - start) / 1000 / timeScale();
            if (e >= W.leadIn && !added) {
              added = true;
              const sp = speak(line, voice);
              speechRef.current = sp;
              addNarrationBeats(sp);
              void sp.done.then(() => {
                if (speechRef.current !== sp) return;
                tl.progress(1);
                lastDone = true;
                done.current();
              });
            }
            tl.time(Math.min(e, W.leadIn));
            return;
          }
          if (!lastDone) tl.time(W.leadIn + s.position());
        };
        gsap.ticker.add(tick);
        return () => {
          gsap.ticker.remove(tick);
          speechRef.current?.stop();
          speechRef.current = null;
        };
      });
      return () => mm.revert();
    },
    { scope, dependencies: [item.id, polarity, cantSide, calm], revertOnUpdate: true },
  );

  const label = (who: CharacterId) =>
    who === cant ? (
      <span className="label-cant absolute -bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-[14px] border-2 border-coral-500 bg-coral-50 px-3 py-0.5 font-semibold text-coral-ink">
        {S.child.cantLabel}
      </span>
    ) : (
      <span className="label-can absolute -bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-[14px] border-2 border-blue-300 bg-blue-50 px-3 py-0.5 font-semibold text-blue-800">
        {S.child.canLabel}
      </span>
    );

  return (
    <div ref={scope} className="cards pb-4">
      {[left, right].map((who, i) => (
        <div key={who} className="watch-card relative flex h-full min-h-0 items-center" style={{ visibility: "hidden" }}>
          <CharacterCard character={who} index={i} state="idle" calm={calm} tappable={false} enter={false}>
            {who === cant && <RoughCircle />}
            {label(who)}
          </CharacterCard>
        </div>
      ))}
    </div>
  );
}
