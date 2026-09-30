"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { S } from "@/config/strings";
import { positionBias, type BiasResult } from "@/lib/bias";
import { lessonStatus } from "@/lib/progress";
import { type Learner, type Lesson, type Session } from "@/lib/schema";
import { plainSummary } from "@/lib/summary";
import { useApp } from "@/store/app";

const P = S.grownUp.progress;

const fmtDate = (t: number) => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const fmtDateTime = (t: number) => new Date(t).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Independent correct % in Check (or review) for one session, or null without Check data. */
const sessionPercent = (s: Session): number | null =>
  s.summary && s.summary.checkTotal > 0 ? Math.round((s.summary.checkIndependentCorrect / s.summary.checkTotal) * 100) : null;

export function ProgressTab() {
  const learners = useApp((s) => s.learners);
  const lessons = useApp((s) => s.lessons);
  const allSessions = useApp((s) => s.sessions);
  const params = useSearchParams();
  const router = useRouter();
  const learnerId = params.get("learner");
  const learner = learners.find((l) => l.id === learnerId) ?? learners[0];
  const [lessonId, setLessonId] = useState(lessons[0]?.id ?? "");
  const lesson = lessons.find((l) => l.id === lessonId) ?? lessons[0];
  const ids = useId();

  const sessions = useMemo(
    () =>
      learner && lesson
        ? allSessions.filter((s) => s.learnerId === learner.id && s.lessonId === lesson.id && s.summary).sort((a, b) => a.startedAt - b.startedAt)
        : [],
    [allSessions, learner, lesson],
  );

  if (!learner || !lesson) return <p className="panel text-ink-soft">{S.grownUp.learners.none}</p>;

  return (
    <>
      <div className="no-print flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${ids}-l`} className="font-medium">
            {P.learner}
          </label>
          <select
            id={`${ids}-l`}
            className="field"
            value={learner.id}
            onChange={(e) => router.replace(`/grown-up/?tab=progress&learner=${encodeURIComponent(e.target.value)}`, { scroll: false })}
          >
            {learners.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nickname}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${ids}-s`} className="font-medium">
            {P.lesson}
          </label>
          <select id={`${ids}-s`} className="field" value={lesson.id} onChange={(e) => setLessonId(e.target.value)}>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        </div>
        <button className="adult-btn ml-auto" onClick={() => window.print()}>
          <Icon name="print" />
          {P.print}
        </button>
      </div>

      <Report learner={learner} lesson={lesson} sessions={sessions} />
    </>
  );
}

function Report({ learner, lesson, sessions }: { learner: Learner; lesson: Lesson; sessions: Session[] }) {
  const [now] = useState(() => Date.now());
  const status = lessonStatus(lesson, learner, now);
  const bias = positionBias(sessions.flatMap((s) => s.trials));

  return (
    <article className="flex flex-col gap-4" aria-label={P.reportFor(learner.nickname)} data-testid="progress-report">
      <header className="print-only">
        <h1 className="text-xl font-semibold">{P.reportFor(learner.nickname)}</h1>
        <p>
          {S.centre} · {P.generated(fmtDate(now))}
        </p>
      </header>

      <section className="panel flex flex-col gap-3" aria-labelledby="sum-h">
        <div className="flex flex-wrap items-center gap-3">
          <Avatar id={learner.avatar} size={40} className="no-print" />
          <h2 id="sum-h" className="text-lg font-semibold">
            {learner.nickname} · {lesson.title}
          </h2>
        </div>
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
          <Stat label={P.status} value={S.child.status[status]} />
          <Stat label={P.sessions} value={String(sessions.length)} />
          <Stat label={S.grownUp.learners.mastery} value={`${learner.settings.masteryPercent}% × ${learner.settings.masterySessions}`} />
        </dl>
        <div>
          <h3 className="font-medium">{P.summary}</h3>
          <p data-testid="plain-summary">{plainSummary(lesson, sessions)}</p>
        </div>
      </section>

      {sessions.length === 0 ? (
        <p className="panel text-ink-soft">{P.noSessions}</p>
      ) : (
        <>
          <section className="panel flex flex-col gap-2" aria-labelledby="trend-h">
            <h3 id="trend-h" className="font-semibold">
              {P.trend}
            </h3>
            <TrendChart sessions={sessions} threshold={learner.settings.masteryPercent} />
          </section>
          <BiasPanel bias={bias} />
          <SessionsTable sessions={sessions} />
        </>
      )}
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-small)] bg-page px-3 py-2">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

/** One series: independent correct % per session, with the mastery line. Hover (or focus) a point for details. */
function TrendChart({ sessions, threshold }: { sessions: Session[]; threshold: number }) {
  const pts = sessions.map((s) => ({ s, pct: sessionPercent(s) })).filter((p): p is { s: Session; pct: number } => p.pct !== null);
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 220;
  const pad = { l: 44, r: 36, t: 22, b: 28 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const x = (i: number) => pad.l + (pts.length <= 1 ? iw / 2 : (i / (pts.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / 100) * ih;
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i)} ${y(p.pct)}`).join("");
  const h = hover !== null ? pts[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${P.trend}: ${pts.map((p) => `${p.pct}%`).join(", ")}`}>
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={1} />
            <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize="12" fill="var(--ink-muted)">
              {v}%
            </text>
          </g>
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={y(threshold)} y2={y(threshold)} stroke="var(--amber-600)" strokeWidth={1.5} strokeDasharray="6 4" />
        <text x={pad.l + 6} y={y(threshold) - 6} textAnchor="start" fontSize="12" fill="var(--ink-soft)">
          {S.grownUp.learners.mastery} {threshold}%
        </text>
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke="var(--ink-muted)" strokeWidth={1} />}
        <path d={line} fill="none" stroke="var(--blue-700)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => (
          <g key={p.s.id} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <circle cx={x(i)} cy={y(p.pct)} r={14} fill="transparent" />
            <circle cx={x(i)} cy={y(p.pct)} r={5} fill={p.s.kind === "review" ? "var(--surface)" : "var(--blue-700)"} stroke="var(--surface)" strokeWidth={2} />
            {p.s.kind === "review" && <circle cx={x(i)} cy={y(p.pct)} r={5} fill="none" stroke="var(--blue-700)" strokeWidth={2} />}
            <title>{`${fmtDate(p.s.startedAt)}: ${p.pct}%`}</title>
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--ink-muted)">
              {new Date(p.s.startedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
            </text>
          </g>
        ))}
        {pts.length > 0 && (
          <text x={x(pts.length - 1)} y={y(pts[pts.length - 1].pct) - 12} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--ink)">
            {pts[pts.length - 1].pct}%
          </text>
        )}
      </svg>
      {h && (
        <div
          className="no-print pointer-events-none absolute top-0 rounded-[var(--radius-small)] border border-line bg-surface px-3 py-2 text-sm shadow-[var(--shadow-card)]"
          style={{ left: `${(x(hover!) / W) * 100}%`, transform: "translateX(-50%)" }}
        >
          <div className="font-semibold">{h.pct}%</div>
          <div className="text-ink-muted">
            {fmtDate(h.s.startedAt)} · {h.s.kind}
          </div>
        </div>
      )}
    </div>
  );
}

function BiasPanel({ bias }: { bias: BiasResult }) {
  const left = Math.round(bias.left * 100);
  const right = 100 - left;
  return (
    <section className="panel flex flex-col gap-2" aria-labelledby="bias-h" data-testid="bias-panel">
      <h3 id="bias-h" className="font-semibold">
        {P.bias}
      </h3>
      {bias.n > 0 && (
        <div className="flex h-8 overflow-hidden rounded-[var(--radius-small)] text-sm font-medium" aria-hidden>
          <div className="flex items-center bg-blue-100 px-2 text-blue-800" style={{ width: `${left}%` }}>
            {left >= 15 && `${P.left} ${left}%`}
          </div>
          <div className="w-0.5 bg-surface" />
          <div className="flex flex-1 items-center justify-end bg-blue-300 px-2 text-ink" style={{ width: `${right}%` }}>
            {right >= 15 && `${P.right} ${right}%`}
          </div>
        </div>
      )}
      <p className={bias.flagged ? "flex items-start gap-2 rounded-[var(--radius-small)] bg-coral-50 p-2 font-medium text-coral-ink" : "text-ink-soft"} role={bias.flagged ? "alert" : undefined}>
        {bias.flagged && <span aria-hidden>⚑</span>}
        {bias.flagged && bias.side
          ? P.biasFlag(bias.side === "left" ? P.left.toLowerCase() : P.right.toLowerCase(), Math.round(Math.max(bias.left, bias.right) * 100))
          : bias.n < 20
            ? P.biasNotEnough(bias.n)
            : P.biasOk}
      </p>
    </section>
  );
}

function SessionsTable({ sessions }: { sessions: Session[] }) {
  const rows = [...sessions].reverse();
  return (
    <section className="panel flex flex-col gap-2" aria-labelledby="sess-h">
      <h3 id="sess-h" className="font-semibold">
        {P.sessions}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="text-ink-muted">
            <tr>
              <th className="py-2 pr-3 font-medium">{P.date}</th>
              <th className="py-2 pr-3 font-medium">{P.kind}</th>
              <th className="py-2 pr-3 font-medium">{P.independent}</th>
              <th className="py-2 pr-3 font-medium">
                {P.prompts}
                <span className="block text-xs font-normal">{P.promptLegend}</span>
              </th>
              <th className="py-2 pr-3 font-medium">{P.latency}</th>
              <th className="py-2 pr-3 font-medium">{P.breaks}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const sum = s.summary!;
              const pct = sessionPercent(s);
              return (
                <tr key={s.id} className="border-t border-line">
                  <td className="py-2 pr-3">{fmtDateTime(s.startedAt)}</td>
                  <td className="py-2 pr-3">{s.kind === "review" ? "Review" : s.completed ? "Lesson" : "Lesson (stopped)"}</td>
                  <td className="py-2 pr-3">{pct === null ? "–" : `${sum.checkIndependentCorrect}/${sum.checkTotal} (${pct}%)`}</td>
                  <td className="py-2 pr-3 tabular-nums">{sum.promptCounts.join(" / ")}</td>
                  <td className="py-2 pr-3">{sum.meanLatencyMs === null ? "–" : `${(sum.meanLatencyMs / 1000).toFixed(1)} s`}</td>
                  <td className="py-2 pr-3">{sum.breakCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
