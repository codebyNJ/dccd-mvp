"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { GrownUpLock } from "@/components/GrownUpLock";
import { Icon } from "@/components/Icon";
import { S } from "@/config/strings";
import { SPRING, TIMING } from "@/config/timing";
import { lessonStars, lessonStatus, type LessonStatus } from "@/lib/progress";
import { defaultProgress, type Learner, type Lesson } from "@/lib/schema";
import { useActiveLearner, useApp } from "@/store/app";
import { Sticker } from "./Sticker";

/** The child's start screen: who is learning, then their lessons and sticker book. */
export function Home() {
  const learner = useActiveLearner();
  return (
    <main className={`child mx-auto flex max-w-[1200px] flex-col gap-6 px-[var(--gutter)] py-4 ${learner?.settings.textSize === "large" ? "text-large" : ""}`}>
      {learner ? <Library learner={learner} /> : <WhoIsLearning />}
      <footer className="adult mt-auto flex items-center justify-between gap-4 pt-4 text-ink-muted">
        <span className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- static export */}
          <img src="/brand/dccd-mark.svg" alt="" width={28} height={28} />
          {S.appName}
        </span>
        <GrownUpLock />
      </footer>
    </main>
  );
}

function WhoIsLearning() {
  const learners = useApp((s) => s.learners);
  const setActive = useApp((s) => s.setActiveLearner);
  return (
    <section aria-labelledby="who" className="flex flex-col gap-6">
      <h1 id="who" className="pt-4 text-center font-semibold">
        {S.child.whoIsLearning}
      </h1>
      {learners.length === 0 ? (
        <p className="text-center text-ink-soft">{S.child.noLearners}</p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(220px,100%),1fr))] gap-[var(--gap)]">
          {learners.map((l, i) => (
            <motion.li key={l.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: i * TIMING.cardStagger }}>
              <button className="child-btn w-full flex-col !gap-2 py-4" onClick={() => setActive(l.id)}>
                <Avatar id={l.avatar} size={96} />
                <span className="max-w-full truncate">{l.nickname}</span>
              </button>
            </motion.li>
          ))}
        </ul>
      )}
    </section>
  );
}

const STATUS_STYLE: Record<LessonStatus, string> = {
  new: "bg-blue-50 text-blue-800",
  "in-progress": "bg-blue-100 text-blue-800",
  mastered: "bg-amber-100 text-ink",
  "review-due": "bg-coral-50 text-coral-ink",
  locked: "bg-page text-ink-soft",
};

function Library({ learner }: { learner: Learner }) {
  const lessons = useApp((s) => s.lessons);
  const setActive = useApp((s) => s.setActiveLearner);
  const [now] = useState(() => Date.now());
  const assigned = lessons.filter((l) => learner.assigned.includes(l.id));
  const stickers = lessons.filter((l) => learner.stickers.includes(l.id));

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar id={learner.avatar} size={72} />
          <h1 className="truncate font-semibold">{learner.nickname}</h1>
        </div>
        <button className="child-btn !text-[0.7em]" onClick={() => setActive(null)}>
          <Icon name="users" />
          {S.child.switchLearner}
        </button>
      </header>

      <section aria-labelledby="lessons" className="flex flex-col gap-4">
        <h2 id="lessons" className="font-semibold">
          {S.child.lessons}
        </h2>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(260px,100%),1fr))] gap-[var(--gap)]">
          {assigned.map((lesson, i) => (
            <motion.li key={lesson.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: i * TIMING.cardStagger }}>
              <LessonCard lesson={lesson} learner={learner} lessons={lessons} now={now} />
            </motion.li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="stickers" className="flex flex-col gap-4">
        <h2 id="stickers" className="font-semibold">
          {S.child.stickerBook}
        </h2>
        {stickers.length === 0 ? (
          <p className="text-ink-soft">{S.child.noStickers}</p>
        ) : (
          <ul className="flex flex-wrap gap-4">
            {stickers.map((l) => (
              <li key={l.id} className="rounded-[24px] bg-surface p-2 shadow-[var(--shadow-card)]">
                <Sticker label={l.title} size={140} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function LessonCard({ lesson, learner, lessons, now }: { lesson: Lesson; learner: Learner; lessons: Lesson[]; now: number }) {
  const status = lessonStatus(lesson, learner, lessons, now);
  const locked = status === "locked";
  const stars = lessonStars(learner.progress[lesson.id] ?? defaultProgress());
  const body = (
    <>
      <span className="text-[1.4em] font-semibold">{lesson.title}</span>
      <span className={`flex items-center gap-2 rounded-full px-4 py-1 text-[0.65em] font-medium ${STATUS_STYLE[status]}`}>
        {locked && <Icon name="lock" />}
        {status === "mastered" && <Icon name="star" />}
        {S.child.status[status]}
      </span>
      {locked ? (
        <span className="text-[0.6em] text-ink-soft">{S.child.lockedHint}</span>
      ) : (
        <span className="flex gap-1 text-[0.8em]" aria-label={S.child.stars(stars)} role="img">
          {[0, 1, 2].map((i) => (
            <Icon key={i} name="star" className={i < stars ? "fill-amber-400 text-amber-600" : "text-line"} />
          ))}
        </span>
      )}
    </>
  );
  if (locked) {
    return (
      <div className="child-btn h-full min-h-[180px] w-full flex-col !gap-3 opacity-70" aria-disabled="true" role="group" aria-label={`${lesson.title}: ${S.child.lockedHint}`}>
        {body}
      </div>
    );
  }
  return (
    <Link href={`/lesson/?id=${encodeURIComponent(lesson.id)}`} className="child-btn h-full min-h-[180px] w-full flex-col !gap-3" aria-label={`${S.child.open(lesson.title)}: ${S.child.status[status]}, ${S.child.stars(stars)}`}>
      {body}
    </Link>
  );
}
