"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon, type IconName } from "@/components/Icon";
import { S } from "@/config/strings";
import { stopSpeech } from "@/lib/voice";
import { useEffect } from "react";
import { BackupTab } from "./BackupTab";
import { LearnersTab } from "./LearnersTab";
import { LessonsTab } from "./LessonsTab";
import { ProgressTab } from "./ProgressTab";

const TABS: { id: keyof typeof S.grownUp.tabs; icon: IconName }[] = [
  { id: "learners", icon: "users" },
  { id: "progress", icon: "chart" },
  { id: "lessons", icon: "list" },
  { id: "backup", icon: "archive" },
];
type TabId = (typeof TABS)[number]["id"];

/** Therapist and parent area: learners, progress, lesson items and backup. Tab lives in ?tab=. */
export function GrownUp() {
  const params = useSearchParams();
  const router = useRouter();
  const raw = params.get("tab");
  const tab: TabId = TABS.some((t) => t.id === raw) ? (raw as TabId) : "learners";
  const go = (t: TabId, extra = "") => router.replace(`/grown-up/?tab=${t}${extra}`, { scroll: false });

  useEffect(() => stopSpeech(), []);

  return (
    <div className="adult mx-auto flex min-h-dvh max-w-[1200px] flex-col gap-4 px-[var(--gutter)] py-4">
      <header className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- static export */}
          <img src="/brand/dccd-logo.png" alt={S.centre} className="h-10 w-auto" />
          <h1 className="text-xl font-semibold">{S.grownUp.area}</h1>
        </div>
        <Link href="/" className="adult-btn">
          <Icon name="home" />
          {S.grownUp.backToChild}
        </Link>
      </header>

      <nav aria-label={S.grownUp.area} className="no-print">
        <ul role="tablist" className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <li key={t.id} role="presentation">
              <button
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls="tab-panel"
                className={`adult-btn ${tab === t.id ? "primary" : ""}`}
                onClick={() => go(t.id)}
              >
                <Icon name={t.icon} />
                {S.grownUp.tabs[t.id]}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <section id="tab-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="flex flex-col gap-4">
        {tab === "learners" && <LearnersTab onShowProgress={(id) => go("progress", `&learner=${encodeURIComponent(id)}`)} />}
        {tab === "progress" && <ProgressTab />}
        {tab === "lessons" && <LessonsTab />}
        {tab === "backup" && <BackupTab />}
      </section>

      <footer className="no-print mt-auto flex flex-col gap-1 pt-6 text-sm text-ink-muted">
        <p>{S.grownUp.notSecurity}</p>
        <p>{S.grownUp.defaultsNote}</p>
        <p>
          {S.centre} · {S.credit}
        </p>
      </footer>
    </div>
  );
}
