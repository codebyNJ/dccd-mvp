"use client";

import { useId, useState } from "react";
import { Icon } from "@/components/Icon";
import { S } from "@/config/strings";
import { CHARACTER_IDS, characterName, characterSrc, type CharacterId } from "@/data/characters";
import { isTeachable, parseItemsCsv, type CsvResult } from "@/lib/csv";
import type { Item, Lesson, Polarity } from "@/lib/schema";
import { correctCharacter, instructionLine } from "@/lib/templates";
import { useApp } from "@/store/app";
import { RoughCircle } from "../child/RoughCircle";

const T = S.grownUp.lessons;

/** Books and their pages. A page is made by tapping pictures, not by filling in a table. */
export function LessonsTab() {
  const lessons = useApp((s) => s.lessons);
  const resetLesson = useApp((s) => s.resetLesson);
  const [lessonId, setLessonId] = useState(lessons[0]?.id ?? "");
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const lesson = lessons.find((l) => l.id === lessonId) ?? lessons[0];
  if (!lesson) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={T.book}>
        {lessons.map((l) => (
          <button
            key={l.id}
            className={`adult-btn ${l.id === lesson.id ? "primary" : ""}`}
            aria-pressed={l.id === lesson.id}
            onClick={() => (setLessonId(l.id), setEditing(null))}
          >
            <Icon name="book" />
            {S.child.bookTitle(l.polarity)}
          </button>
        ))}
        <p className="flex-1 text-sm text-ink-muted">{T.help}</p>
      </div>

      {editing ? (
        <PageMaker key={editing === "new" ? "new" : editing.id} lesson={lesson} item={editing === "new" ? undefined : editing} onDone={() => setEditing(null)} />
      ) : (
        <Pages lesson={lesson} onNew={() => setEditing("new")} onEdit={setEditing} />
      )}

      <details className="panel group">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold">
          <Icon name="next" className="h-5 w-5 transition-transform group-open:rotate-90" />
          {T.moreTools}
        </summary>
        <div className="mt-4 flex flex-col gap-4">
          <CsvImport lesson={lesson} />
          <button className="adult-btn danger self-start" onClick={() => confirm(T.resetConfirm(lesson.title)) && resetLesson(lesson.id)}>
            <Icon name="replay" />
            {T.reset}
          </button>
        </div>
      </details>
    </>
  );
}

function Pages({ lesson, onNew, onEdit }: { lesson: Lesson; onNew: () => void; onEdit: (i: Item) => void }) {
  const del = useApp((s) => s.deleteItem);
  return (
    <section className="panel flex flex-col gap-4" aria-labelledby="pages-h">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="pages-h" className="flex-1 text-lg font-semibold">
          {lesson.title}
        </h2>
        <button className="adult-btn primary" onClick={onNew}>
          <Icon name="plus" />
          {T.newPage}
        </button>
      </div>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3">
        {lesson.items.map((item) => (
          <li key={item.id} className="flex flex-col gap-2 rounded-[var(--radius-small)] border border-line bg-paper p-3" data-testid="item-row">
            <button className="flex flex-col gap-2 text-left" onClick={() => onEdit(item)} aria-label={T.editPage(item.verb)}>
              <span className="grid grid-cols-2 gap-2">
                {[item.optionA, item.optionB].map((c, i) => (
                  <Thumb key={i} character={c} polarity={lesson.polarity} marked={c === correctCharacter(item, lesson.polarity)} />
                ))}
              </span>
              <span className="font-medium">{instructionLine(item, lesson.polarity)}</span>
            </button>
            <div className="mt-auto flex items-center gap-2">
              {item.status === "draft" && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-sm text-blue-800">{T.hidden}</span>}
              {item.status === "approved" && !isTeachable(item) && <span className="rounded-full bg-coral-50 px-2 py-0.5 text-sm text-coral-ink">{T.needsFix}</span>}
              <button
                className="adult-btn danger ml-auto !min-h-9 !px-2"
                aria-label={T.deletePage(item.verb)}
                onClick={() => confirm(T.deletePageConfirm(item.verb)) && del(lesson.id, item.id)}
              >
                <Icon name="trash" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A small picture, circled as it will be on the child's page once they answer. */
function Thumb({ character, polarity, marked }: { character: CharacterId; polarity: Polarity; marked: boolean }) {
  return (
    <span className="relative flex aspect-square items-center justify-center rounded-[10px] border border-line bg-white p-1.5">
      {/* eslint-disable-next-line @next/next/no-img-element -- static export */}
      <img src={characterSrc(character)} alt={characterName(character)} className="h-full w-full object-contain" />
      {marked && <RoughCircle show calm color={polarity === "cant" ? "var(--coral-500)" : "var(--blue-500)"} />}
    </span>
  );
}

/** New page in three taps: the action, two pictures, who can't. The preview is the child's page. */
function PageMaker({ lesson, item, onDone }: { lesson: Lesson; item?: Item; onDone: () => void }) {
  const addItem = useApp((s) => s.addItem);
  const updateItem = useApp((s) => s.updateItem);
  const [verb, setVerb] = useState(item?.verb ?? "");
  const [pair, setPair] = useState<CharacterId[]>(item ? [item.optionA, item.optionB] : []);
  const [picked, setPicked] = useState<CharacterId | null>(item?.answer ?? null);
  const [show, setShow] = useState(item ? item.status === "approved" : true);
  const id = useId();

  const answer = picked && pair.includes(picked) ? picked : null;
  const action = verb.trim();
  const ready = action.length > 0 && pair.length === 2 && answer !== null;
  const toggle = (c: CharacterId) => setPair((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c].slice(-2)));

  const save = () => {
    if (!ready) return;
    const page = { verb: action, optionA: pair[0], optionB: pair[1], answer, status: show ? "approved" : "draft" } as const;
    if (item) updateItem(lesson.id, item.id, page);
    else addItem(lesson.id, page);
    onDone();
  };

  const preview: Item | null = pair.length === 2 ? { id: "preview", verb: action, optionA: pair[0], optionB: pair[1], answer: answer ?? pair[1], status: "approved" } : null;

  return (
    <form
      className="panel flex flex-col gap-6"
      aria-labelledby={`${id}-h`}
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <h2 id={`${id}-h`} className="text-lg font-semibold">
        {item ? T.editPage(item.verb) : T.newPage}
      </h2>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-verb`} className="font-semibold">
              {T.stepVerb}
            </label>
            <input
              id={`${id}-verb`}
              className="field max-w-sm text-lg"
              value={verb}
              placeholder={T.verbPlaceholder}
              autoComplete="off"
              autoFocus
              onChange={(e) => setVerb(e.target.value)}
              aria-describedby={`${id}-verb-help`}
            />
            <p id={`${id}-verb-help`} className="text-sm text-ink-muted">
              {T.verbHelp}
            </p>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 font-semibold">{T.stepPictures}</legend>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
              {CHARACTER_IDS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={pair.includes(c)}
                  onClick={() => toggle(c)}
                  className={`flex flex-col items-center gap-1 rounded-[var(--radius-small)] border-2 bg-white p-2 text-sm ${pair.includes(c) ? "border-blue-700 bg-blue-50" : "border-line"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- static export */}
                  <img src={characterSrc(c)} alt="" className="h-16 w-16 object-contain" />
                  {characterName(c)}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 font-semibold">{T.stepAnswer(action)}</legend>
            {pair.length < 2 ? (
              <p className="text-ink-muted">{T.pickTwoFirst}</p>
            ) : (
              <div className="flex flex-wrap gap-3" role="group" aria-label={T.stepAnswer(action)}>
                {pair.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={answer === c}
                    aria-label={`${characterName(c)} can’t`}
                    onClick={() => setPicked(c)}
                    className={`relative flex w-32 flex-col items-center gap-1 rounded-[var(--radius-small)] border-2 bg-white p-2 ${answer === c ? "border-coral-500" : "border-line"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- static export */}
                    <img src={characterSrc(c)} alt="" className="h-20 w-20 object-contain" />
                    {characterName(c)}
                  </button>
                ))}
              </div>
            )}
          </fieldset>

          <label className="flex min-h-[var(--tap-adult)] cursor-pointer items-center gap-3">
            <input type="checkbox" className="h-5 w-5 accent-[var(--blue-700)]" checked={show} onChange={(e) => setShow(e.target.checked)} />
            <span className="font-medium">{T.showToChildren}</span>
          </label>
        </div>

        <aside className="flex flex-col gap-2" aria-label={T.preview}>
          <h3 className="font-semibold">{T.preview}</h3>
          <div className="book-page !h-auto flex flex-col gap-3" data-testid="page-preview">
            <p className="text-xl font-medium">{instructionLine({ verb: action || "…" }, lesson.polarity)}</p>
            <div className="grid grid-cols-2 gap-3">
              {preview ? (
                [preview.optionA, preview.optionB].map((c, i) => <Thumb key={i} character={c} polarity={lesson.polarity} marked={answer !== null && c === correctCharacter(preview, lesson.polarity)} />)
              ) : (
                <>
                  <span className="aspect-square rounded-[10px] border-2 border-dashed border-line" />
                  <span className="aspect-square rounded-[10px] border-2 border-dashed border-line" />
                </>
              )}
            </div>
          </div>
        </aside>
      </div>

      <div className="flex gap-2">
        <button type="submit" className="adult-btn primary" disabled={!ready}>
          <Icon name="check" />
          {T.savePage}
        </button>
        <button type="button" className="adult-btn" onClick={onDone}>
          {T.cancel}
        </button>
      </div>
    </form>
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
