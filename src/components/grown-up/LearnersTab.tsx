"use client";

import { useId, useState, type ReactNode } from "react";
import { Avatar, AVATARS } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { S, SPEEDS } from "@/config/strings";
import { TEACHING } from "@/config/teaching";
import type { AvatarId, Learner, LearnerSettings } from "@/lib/schema";
import { useApp } from "@/store/app";

const L = S.grownUp.learners;

export function LearnersTab({ onShowProgress }: { onShowProgress: (id: string) => void }) {
  const learners = useApp((s) => s.learners);
  const [adding, setAdding] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{L.title}</h2>
        {!adding && (
          <button className="adult-btn primary" onClick={() => setAdding(true)}>
            <Icon name="plus" />
            {L.add}
          </button>
        )}
      </div>
      {adding && <LearnerForm onDone={() => setAdding(false)} />}
      {learners.length === 0 && !adding && <p className="panel text-ink-soft">{L.none}</p>}
      {learners.map((l) => (
        <LearnerPanel key={l.id} learner={l} onShowProgress={() => onShowProgress(l.id)} />
      ))}
    </>
  );
}

/** Adding a child is two things: a nickname and a picture. Everything else has a sensible default. */
function LearnerForm({ learner, onDone }: { learner?: Learner; onDone: () => void }) {
  const addLearner = useApp((s) => s.addLearner);
  const updateLearner = useApp((s) => s.updateLearner);
  const [nickname, setNickname] = useState(learner?.nickname ?? "");
  const [avatar, setAvatar] = useState<AvatarId>(learner?.avatar ?? "sun");
  const id = useId();
  const valid = nickname.trim().length > 0;

  return (
    <form
      className="panel flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        if (learner) updateLearner(learner.id, { nickname: nickname.trim().slice(0, 24), avatar });
        else addLearner(nickname, avatar);
        onDone();
      }}
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-nick`} className="font-medium">
          {L.nickname}
        </label>
        <input
          id={`${id}-nick`}
          className="field max-w-sm text-lg"
          value={nickname}
          maxLength={24}
          autoComplete="off"
          autoFocus
          required
          onChange={(e) => setNickname(e.target.value)}
          aria-describedby={`${id}-help`}
        />
        <p id={`${id}-help`} className="text-sm text-ink-muted">
          {L.nicknameHelp}
        </p>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-medium">{L.avatar}</legend>
        <div className="flex flex-wrap gap-3">
          {AVATARS.map((a) => (
            <label key={a} className={`cursor-pointer rounded-full border-[3px] p-1 ${avatar === a ? "border-blue-700" : "border-transparent"}`}>
              <input type="radio" name={`${id}-avatar`} value={a} checked={avatar === a} onChange={() => setAvatar(a)} className="sr-only" aria-label={a} />
              <Avatar id={a} size={72} />
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex gap-2">
        <button type="submit" className="adult-btn primary" disabled={!valid}>
          {L.save}
        </button>
        <button type="button" className="adult-btn" onClick={onDone}>
          {L.cancel}
        </button>
      </div>
    </form>
  );
}

function LearnerPanel({ learner, onShowProgress }: { learner: Learner; onShowProgress: () => void }) {
  const lessons = useApp((s) => s.lessons);
  const update = useApp((s) => s.updateSettings);
  const updateLearner = useApp((s) => s.updateLearner);
  const deleteLearner = useApp((s) => s.deleteLearner);
  const [editing, setEditing] = useState(false);
  const set = (patch: Partial<LearnerSettings>) => update(learner.id, patch);
  const st = learner.settings;

  if (editing) return <LearnerForm learner={learner} onDone={() => setEditing(false)} />;

  return (
    <article className="panel flex flex-col gap-4" aria-labelledby={`learner-${learner.id}`} data-testid={`learner-${learner.nickname}`}>
      <header className="flex flex-wrap items-center gap-3">
        <Avatar id={learner.avatar} size={48} />
        <h3 id={`learner-${learner.id}`} className="flex-1 text-lg font-semibold">
          {learner.nickname}
          {learner.demo && <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-sm font-medium text-blue-800">demo</span>}
        </h3>
        <button className="adult-btn" onClick={onShowProgress}>
          <Icon name="chart" />
          {S.grownUp.tabs.progress}
        </button>
        <button className="adult-btn" onClick={() => setEditing(true)}>
          {L.rename}
        </button>
        <button className="adult-btn danger" onClick={() => confirm(L.deleteConfirm(learner.nickname)) && deleteLearner(learner.id)}>
          <Icon name="trash" />
          {L.delete}
        </button>
      </header>

      <details className="group">
        <summary className="adult-btn w-fit cursor-pointer list-none">
          <Icon name="next" className="transition-transform group-open:rotate-90" />
          {L.moreSettings}
        </summary>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 font-semibold">{L.childSettings}</legend>
            <Select label={L.voiceRate} value={String(st.voiceRate)} options={SPEEDS.map(([r, t]) => [String(r), t] as const)} onChange={(v) => set({ voiceRate: Number(v) })} />
            <Check label={L.voiceOn} checked={st.voiceOn} onChange={(v) => set({ voiceOn: v })} />
            <Check label={L.calmMode} help={L.calmHelp} checked={st.calmMode} onChange={(v) => set({ calmMode: v })} />
            <Select label={L.textSize} value={st.textSize} options={Object.entries(L.textSizes)} onChange={(v) => set({ textSize: v as LearnerSettings["textSize"] })} />
            <fieldset>
              <legend className="font-medium">{L.assign}</legend>
              <p className="text-sm text-ink-muted">{L.assignHelp}</p>
              <div className="mt-1 flex flex-wrap gap-4">
                {lessons.map((les) => (
                  <Check
                    key={les.id}
                    label={les.title}
                    checked={learner.assigned.includes(les.id)}
                    onChange={(v) =>
                      updateLearner(learner.id, { assigned: v ? [...learner.assigned, les.id] : learner.assigned.filter((x) => x !== les.id) })
                    }
                  />
                ))}
              </div>
            </fieldset>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 font-semibold">{L.settings}</legend>
            <Row label={L.mastery}>
              <Select
                label={L.masteryPercent}
                value={String(st.masteryPercent)}
                options={TEACHING.masteryPercentOptions.map((n) => [String(n), `${n}%`])}
                onChange={(v) => set({ masteryPercent: Number(v) as LearnerSettings["masteryPercent"] })}
              />
              <Select
                label={L.masterySessions}
                value={String(st.masterySessions)}
                options={TEACHING.masterySessionOptions.map((n) => [String(n), String(n)])}
                onChange={(v) => set({ masterySessions: Number(v) })}
              />
            </Row>
            <Select
              label={L.review}
              value={String(st.reviewIntervalDays)}
              options={[3, 7, 14, 30].map((n) => [String(n), L.days(n)])}
              onChange={(v) => set({ reviewIntervalDays: Number(v) })}
            />
          </fieldset>
        </div>
      </details>
    </article>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="font-medium">{label}</legend>
      <div className="flex flex-wrap gap-4">{children}</div>
    </fieldset>
  );
}

function Check({ label, help, checked, onChange }: { label: string; help?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-[var(--tap-adult)] cursor-pointer items-start gap-3 py-1">
      <input type="checkbox" className="mt-1 h-5 w-5 accent-[var(--blue-700)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="font-medium">{label}</span>
        {help && <span className="block text-sm text-ink-muted">{help}</span>}
      </span>
    </label>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: (readonly [string, string])[]; onChange: (v: string) => void }) {
  const id = useId();
  const known = options.some(([v]) => v === value);
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <select id={id} className="field max-w-xs" value={value} onChange={(e) => onChange(e.target.value)}>
        {!known && <option value={value}>{value}</option>}
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}
