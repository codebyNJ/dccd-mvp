import { describe, expect, it } from "vitest";
import { isTeachable, parseItemsCsv } from "@/lib/csv";
import { emptyState, makeBackup, migrateState } from "@/lib/migrate";
import { closeDangling, summarize, trimHistory } from "@/lib/session";
import { activeWordIndex, estimateTimings, groupAlignment, normalizeLine } from "@/lib/words";
import { SCHEMA_VERSION, type Session } from "@/lib/schema";
import { defaultLessons } from "@/lib/lessons";

describe("CSV validation", () => {
  it("accepts good rows and defaults a missing status to draft", () => {
    const r = parseItemsCsv("verb,optionA,optionB,answer,status\nswim,baby,swimmer,baby,approved\nhop,bird,snake,snake,");
    expect(r.headerError).toBeNull();
    expect(r.rows.map((x) => x.item?.status)).toEqual(["approved", "draft"]);
  });

  it("works when the status column is absent and headers vary in case", () => {
    const r = parseItemsCsv("Verb,OptionA,OptionB,Answer\nfly,snake,bird,snake");
    expect(r.rows[0].item).toMatchObject({ verb: "fly", status: "draft" });
  });

  it("reports unknown image ids, bad answers, missing fields and bad status per row", () => {
    const r = parseItemsCsv(
      [
        "verb,optionA,optionB,answer,status",
        "swim,baby,tiger,baby,approved",
        "bark,dog,cat,lion,approved",
        ",dog,cat,cat,draft",
        "fly,snake,,snake,approved",
        "run,dog,dog,dog,approved",
        "sing,bird,lion,lion,maybe",
      ].join("\n"),
    );
    const errs = r.rows.map((x) => x.errors.join(" "));
    expect(errs[0]).toMatch(/Unknown image "tiger" in optionB/);
    expect(errs[1]).toMatch(/neither optionA nor optionB/);
    expect(errs[2]).toMatch(/Missing verb/);
    expect(errs[3]).toMatch(/Missing optionB/);
    expect(errs[4]).toMatch(/same character/);
    expect(errs[5]).toMatch(/Status must be/);
    expect(r.rows.every((x) => x.item === null)).toBe(true);
    expect(r.rows.map((x) => x.line)).toEqual([2, 3, 4, 5, 6, 7]);
  });

  it("rejects a missing header", () => {
    expect(parseItemsCsv("swim,baby,swimmer,baby").headerError).toMatch(/header/);
    expect(parseItemsCsv("").headerError).toBeTruthy();
  });

  it("draft or incomplete items are never teachable", () => {
    const item = { id: "x", verb: "swim", optionA: "baby", optionB: "swimmer", answer: "baby", status: "approved" } as const;
    expect(isTeachable(item)).toBe(true);
    expect(isTeachable({ ...item, status: "draft" })).toBe(false);
    expect(isTeachable({ ...item, verb: " " })).toBe(false);
  });
});

describe("schema migration and import", () => {
  it("round-trips a backup", () => {
    const state = emptyState();
    const r = migrateState(JSON.parse(JSON.stringify(makeBackup(state, 0))));
    expect(r).toEqual({ ok: true, state });
  });

  it("migrates version-0 data (no schemaVersion) and fills setting defaults", () => {
    const v0 = {
      learners: [{ id: "a", nickname: "Asha", avatar: "sun", createdAt: 1, settings: { calmMode: false } }],
      sessions: [],
    };
    const r = migrateState(v0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.schemaVersion).toBe(SCHEMA_VERSION);
    expect(r.state.lessons).toEqual(defaultLessons());
    expect(r.state.learners[0].settings).toMatchObject({ calmMode: false, strategy: "errorless", tokenBoardSize: 5, masteryPercent: 90 });
    expect(r.state.learners[0].assigned).toEqual(["can", "cant"]);
  });

  it("rejects invalid or newer data with a readable error", () => {
    expect(migrateState("nope").ok).toBe(false);
    expect(migrateState({ ...emptyState(), schemaVersion: 99 })).toMatchObject({ ok: false, error: expect.stringMatching(/newer/) });
    const bad = migrateState({ ...emptyState(), learners: [{ id: "a" }] });
    expect(bad.ok).toBe(false);
  });
});

describe("session history", () => {
  const mk = (i: number, trials = 3): Session => ({
    id: `s${i}`,
    learnerId: "l",
    lessonId: "can",
    kind: "lesson",
    seed: i,
    startedAt: i * 1000,
    endedAt: null,
    completed: false,
    strategy: "errorless",
    delaySeconds: 0,
    reward: "bubbles",
    breaks: [{ start: i * 1000 + 5, end: null }],
    trials: Array.from({ length: trials }, (_, k) => ({
      itemId: "x",
      step: "check" as const,
      correctSide: "left" as const,
      tappedSide: k === 0 ? ("right" as const) : ("left" as const),
      correct: k !== 0,
      promptLevel: 0 as const,
      correction: false,
      latencyMs: 1000,
      at: i * 1000 + 10 + k,
    })),
    summary: null,
  });

  it("keeps trials for the last 50 sessions per learner + lesson and summaries for older ones", () => {
    const all = Array.from({ length: 55 }, (_, i) => mk(i));
    const trimmed = trimHistory(all);
    expect(trimmed.filter((s) => s.trials.length > 0)).toHaveLength(50);
    const old = trimmed.find((s) => s.id === "s0")!;
    expect(old.trials).toHaveLength(0);
    expect(old.summary).toMatchObject({ checkTotal: 3, checkIndependentCorrect: 2 });
  });

  it("summarises and closes sessions left open by a closed tab", () => {
    const [s] = closeDangling([mk(1)]);
    expect(s.endedAt).toBe(1012);
    expect(s.breaks[0].end).toBe(1012);
    expect(s.summary).toEqual(summarize({ trials: s.trials, breaks: s.breaks }, 1012));
    expect(s.summary?.taps).toEqual({ left: 2, right: 1 });
  });
});

describe("word timings", () => {
  const text = "Who can’t swim?";
  const chars = [..."Who can't swim?"];
  const align = {
    characters: chars,
    character_start_times_seconds: chars.map((_, i) => i * 0.1),
    character_end_times_seconds: chars.map((_, i) => i * 0.1 + 0.1),
  };

  it("groups character alignment into display words", () => {
    const w = groupAlignment(text, align)!;
    expect(w.map((x) => x.word)).toEqual(["Who", "can’t", "swim?"]);
    expect(w[0].start).toBe(0);
    expect(w[0].end).toBeCloseTo(0.3);
    expect(w[1].start).toBeCloseTo(0.4);
    expect(w[2].end).toBeCloseTo(1.5);
  });

  it("returns null when words don't line up", () => {
    expect(groupAlignment("Who can’t swim today?", align)).toBeNull();
  });

  it("estimates increasing timings and finds the active word", () => {
    const { words, duration } = estimateTimings("The baby can’t swim. The swimmer can swim.");
    expect(words).toHaveLength(8);
    for (let i = 1; i < words.length; i++) expect(words[i].start).toBeGreaterThan(words[i - 1].start);
    expect(duration).toBeGreaterThan(words[7].end);
    expect(activeWordIndex(words, words[2].start + 0.01)).toBe(2);
    expect(activeWordIndex(words, -1)).toBe(-1);
    expect(estimateTimings("Look.", 0.85).duration).toBeGreaterThan(estimateTimings("Look.", 1).duration);
  });

  it("normalises lines for the audio manifest", () => {
    expect(normalizeLine("Let’s  try again.")).toBe("let's try again.");
  });
});
