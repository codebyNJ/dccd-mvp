"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { S } from "@/config/strings";
import { SPRING, TIMING } from "@/config/timing";
import { characterSrc } from "@/data/characters";
import { teachableItems } from "@/lib/lessons";
import { lessonStatus } from "@/lib/progress";
import type { Learner, Lesson } from "@/lib/schema";
import { correctCharacter } from "@/lib/templates";
import { useActiveLearner, useApp } from "@/store/app";
import { GuideStar } from "./GuideStar";
import { Sticker } from "./Sticker";

/** The child's start screen: who is reading, then their bookshelf and sticker page. */
export function Home() {
  const learner = useActiveLearner();
  return (
    <div className={`child ${learner?.settings.textSize === "large" ? "text-large" : ""}`}>
      <main className="mx-auto flex min-h-dvh max-w-[1200px] flex-col gap-8 px-[var(--gutter)] py-6">
        {learner ? <Library learner={learner} /> : <WhoIsReading />}
        <footer className="adult mt-auto flex items-center justify-between gap-4 pt-4 text-ink-muted">
          <span className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- static export */}
            <img src="/brand/dccd-mark.svg" alt="" width={28} height={28} />
            {S.appName}
          </span>
          <Link href="/grown-up/" className="adult-btn">
            <Icon name="users" />
            {S.child.grownUps}
          </Link>
        </footer>
      </main>
    </div>
  );
}

function WhoIsReading() {
  const learners = useApp((s) => s.learners);
  const setActive = useApp((s) => s.setActiveLearner);
  return (
    <section aria-labelledby="who" className="flex flex-col gap-8">
      <div className="flex items-center justify-center gap-3 pt-6">
        <GuideStar calm size={72} />
        <h1 id="who" className="book-title">
          {S.child.whoIsReading}
        </h1>
      </div>
      {learners.length === 0 ? (
        <p className="text-center text-ink-soft">{S.child.noLearners}</p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(220px,100%),1fr))] gap-[var(--gap)]">
          {learners.map((l, i) => (
            <motion.li key={l.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: i * TIMING.cardStagger }}>
              <button className="child-btn reader-tile w-full flex-col !gap-2 py-5" onClick={() => setActive(l.id)}>
                <Avatar id={l.avatar} size={112} className="!h-28 !w-28" />
                <span className="max-w-full truncate">{l.nickname}</span>
              </button>
            </motion.li>
          ))}
        </ul>
      )}
    </section>
  );
}

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
          <h1 className="book-title truncate">{learner.nickname}</h1>
        </div>
        <button className="child-btn !text-[0.6em]" onClick={() => setActive(null)}>
          <Icon name="users" />
          {S.child.switchLearner}
        </button>
      </header>

      <section aria-labelledby="books" className="flex flex-col gap-4">
        <h2 id="books" className="book-title">
          {S.child.books}
        </h2>
        <ul className="shelf">
          {assigned.map((lesson, i) => (
            <motion.li key={lesson.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: i * TIMING.cardStagger }}>
              <BookCover lesson={lesson} learner={learner} now={now} />
            </motion.li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="stickers" className="flex flex-col gap-4">
        <h2 id="stickers" className="book-title">
          {S.child.stickerBook}
        </h2>
        {stickers.length === 0 ? (
          <p className="text-[0.8em] text-ink-soft">{S.child.noStickers}</p>
        ) : (
          <ul className="flex flex-wrap gap-4">
            {stickers.map((l) => (
              <li key={l.id} className="rounded-[24px] bg-paper p-2 shadow-[var(--shadow-card)]">
                <Sticker label={l.title} size={140} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function BookCover({ lesson, learner, now }: { lesson: Lesson; learner: Learner; now: number }) {
  const status = lessonStatus(lesson, learner, now);
  // The cover shows the answers to the first two pages.
  const pictures = teachableItems(lesson)
    .slice(0, 2)
    .map((i) => correctCharacter(i, lesson.polarity));
  return (
    <Link
      href={`/lesson/?id=${encodeURIComponent(lesson.id)}`}
      className="book-cover"
      data-polarity={lesson.polarity}
      aria-label={`${S.child.open(lesson.title)}: ${S.child.status[status]}`}
    >
      <span className="ribbon">
        {status === "mastered" && <Icon name="star" />}
        {S.child.status[status]}
      </span>
      <span className="book-title text-center text-[1.25em]">{S.child.bookTitle(lesson.polarity)}</span>
      <span className="flex min-h-0 w-full flex-1 items-end justify-center gap-2">
        {pictures.map((c) => (
          // eslint-disable-next-line @next/next/no-img-element -- static export
          <img key={c} src={characterSrc(c)} alt="" className="illustration aspect-square w-[46%] p-2" />
        ))}
      </span>
    </Link>
  );
}
