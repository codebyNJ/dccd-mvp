"use client";

import { useId, useState } from "react";
import { Icon } from "@/components/Icon";
import { S } from "@/config/strings";
import { CHARACTER_IDS, characterName, type CharacterId } from "@/data/characters";
import { isTeachable, parseItemsCsv, type CsvResult } from "@/lib/csv";
import type { Item, Lesson } from "@/lib/schema";
import { useApp } from "@/store/app";

const T = S.grownUp.lessons;

export function LessonsTab() {
  const lessons = useApp((s) => s.lessons);
  const [lessonId, setLessonId] = useState(lessons[0]?.id ?? "");
  const lesson = lessons.find((l) => l.id === lessonId) ?? lessons[0];
  const id = useId();
  if (!lesson) return null;

  return (
    <>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor={id} className="font-medium">
            {T.lesson}
          </label>
          <select id={id} className="field" value={lesson.id} onChange={(e) => setLessonId(e.target.value)}>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        </div>
        <p className="flex-1 text-sm text-ink-muted">{T.help}</p>
      </div>
      <ItemsEditor lesson={lesson} />
      <CsvImport lesson={lesson} />
    </>
  );
}

function ItemsEditor({ lesson }: { lesson: Lesson }) {
  const addItem = useApp((s) => s.addItem);
  const resetLesson = useApp((s) => s.resetLesson);
  return (
    <section className="panel flex flex-col gap-3" aria-labelledby="items-h">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="items-h" className="flex-1 text-lg font-semibold">
          {lesson.title}
        </h2>
        <button className="adult-btn" onClick={() => addItem(lesson.id)}>
          <Icon name="plus" />
          {T.addRow}
        </button>
        <button className="adult-btn danger" onClick={() => confirm(T.resetConfirm(lesson.title)) && resetLesson(lesson.id)}>
          <Icon name="replay" />
          {T.reset}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-ink-muted">
            <tr>
              <th className="py-2 pr-2 font-medium">{T.verb}</th>
              <th className="py-2 pr-2 font-medium">{T.optionA}</th>
              <th className="py-2 pr-2 font-medium">{T.optionB}</th>
              <th className="py-2 pr-2 font-medium">{T.answer}</th>
              <th className="py-2 pr-2 font-medium">{T.status}</th>
              <th className="py-2 font-medium">
                <span className="sr-only">{T.deleteRow}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {lesson.items.map((item) => (
              <ItemRow key={item.id} lessonId={lesson.id} item={item} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CharSelect({ label, value, choices, onChange }: { label: string; value: CharacterId; choices: readonly CharacterId[]; onChange: (v: CharacterId) => void }) {
  return (
    <select className="field w-full" aria-label={label} value={value} onChange={(e) => onChange(e.target.value as CharacterId)}>
      {choices.map((c) => (
        <option key={c} value={c}>
          {characterName(c)}
        </option>
      ))}
    </select>
  );
}

function ItemRow({ lessonId, item }: { lessonId: string; item: Item }) {
  const update = useApp((s) => s.updateItem);
  const del = useApp((s) => s.deleteItem);
  const set = (patch: Partial<Omit<Item, "id">>) => update(lessonId, item.id, patch);
  const label = (col: string) => `${col}: ${item.verb || "(no verb)"}`;
  const broken = item.status === "approved" && !isTeachable(item);
  return (
    <>
      <tr className="border-t border-line align-top" data-testid="item-row">
        <td className="py-2 pr-2">
          <input className="field w-full" aria-label={label(T.verb)} value={item.verb} onChange={(e) => set({ verb: e.target.value })} />
        </td>
        <td className="py-2 pr-2">
          <CharSelect label={label(T.optionA)} value={item.optionA} choices={CHARACTER_IDS} onChange={(v) => set({ optionA: v })} />
        </td>
        <td className="py-2 pr-2">
          <CharSelect label={label(T.optionB)} value={item.optionB} choices={CHARACTER_IDS} onChange={(v) => set({ optionB: v })} />
        </td>
        <td className="py-2 pr-2">
          <CharSelect label={label(T.answer)} value={item.answer} choices={[...new Set([item.optionA, item.optionB])]} onChange={(v) => set({ answer: v })} />
        </td>
        <td className="py-2 pr-2">
          <select className="field w-full" aria-label={label(T.status)} value={item.status} onChange={(e) => set({ status: e.target.value as Item["status"] })}>
            <option value="approved">{T.approved}</option>
            <option value="draft">{T.draft}</option>
          </select>
        </td>
        <td className="py-2">
          <button className="adult-btn danger !px-3" aria-label={label(T.deleteRow)} onClick={() => confirm(T.deleteRowConfirm(item.verb)) && del(lessonId, item.id)}>
            <Icon name="trash" />
          </button>
        </td>
      </tr>
      {broken && (
        <tr>
          <td colSpan={6} className="pb-2 text-coral-ink">
            {T.rowInvalid}
          </td>
        </tr>
      )}
    </>
  );
}

function CsvImport({ lesson }: { lesson: Lesson }) {
  const addItems = useApp((s) => s.addItems);
  const [text, setText] = useState("");
  const [result, setResult] = useState<CsvResult | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const id = useId();
  const good = result?.rows.filter((r) => r.item) ?? [];
  const bad = result?.rows.filter((r) => !r.item) ?? [];

  return (
    <section className="panel flex flex-col gap-3" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="text-lg font-semibold">
        {T.importTitle}
      </h2>
      <p className="text-sm text-ink-muted">{T.importHelp}</p>
      <p className="text-sm">
        <code className="rounded bg-page px-1.5 py-0.5">{T.importHeader.replace("Header: ", "")}</code>
      </p>
      <label htmlFor={`${id}-csv`} className="font-medium">
        {T.importPaste}
      </label>
      <textarea
        id={`${id}-csv`}
        className="field min-h-32 font-mono text-sm"
        value={text}
        spellCheck={false}
        onChange={(e) => {
          setText(e.target.value);
          setResult(null);
          setDone(null);
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <label className="adult-btn cursor-pointer">
          <Icon name="upload" />
          {T.importFile}
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const t = await f.text();
              setText(t);
              setResult(parseItemsCsv(t));
              setDone(null);
              e.target.value = "";
            }}
          />
        </label>
        <button className="adult-btn primary" onClick={() => (setResult(parseItemsCsv(text)), setDone(null))}>
          {T.importCheck}
        </button>
      </div>

      {result?.headerError && (
        <p role="alert" className="rounded-[var(--radius-small)] bg-coral-50 p-2 text-coral-ink">
          {result.headerError}
        </p>
      )}
      {result && !result.headerError && (
        <div className="flex flex-col gap-2" aria-live="polite">
          <p>
            <strong>{T.importRowsOk(good.length)}</strong>
            {bad.length > 0 && <span className="text-coral-ink"> · {T.importRowsBad(bad.length)}</span>}
          </p>
          {bad.length > 0 && (
            <table className="text-left text-sm" data-testid="csv-errors">
              <thead className="text-ink-muted">
                <tr>
                  <th className="pr-3 font-medium">{T.line}</th>
                  <th className="font-medium">{T.problems}</th>
                </tr>
              </thead>
              <tbody>
                {bad.map((r) => (
                  <tr key={r.line} className="border-t border-line align-top">
                    <td className="py-1 pr-3">{r.line}</td>
                    <td className="py-1">{r.errors.join(" ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {good.length > 0 && (
            <button
              className="adult-btn primary self-start"
              onClick={() => {
                addItems(lesson.id, good.map((r) => r.item!));
                setDone(T.imported(good.length));
                setResult(null);
                setText("");
              }}
            >
              {T.importConfirm(good.length, lesson.title)}
            </button>
          )}
        </div>
      )}
      {done && (
        <p role="status" className="font-medium text-blue-800">
          {done}
        </p>
      )}
    </section>
  );
}
