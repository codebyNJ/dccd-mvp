"use client";

import { Howl, Howler } from "howler";
import { create } from "zustand";
import { timeScale } from "@/config/timing";
import { estimateTimings, normalizeLine, type WordTiming } from "./words";

/**
 * One voice line at a time. Every line is a `Speech` with a playback clock:
 *  - recorded: pre-generated ElevenLabs MP3 + word timings (public/audio/manifest.json)
 *  - synth: the browser's SpeechSynthesis with estimated word timings (missing lines)
 *  - silent: voice off / muted — the same clock runs so read-along and the
 *    Watch timelines still move in step with the words.
 */
export interface Speech {
  text: string;
  words: WordTiming[];
  duration: number;
  source: "recorded" | "synth" | "silent";
  /** Seconds along the line's clock. */
  position: () => number;
  done: Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  paused: () => boolean;
  /** Silence the rest of the line but keep its clock (mute pressed mid-line). */
  mute?: () => void;
}

interface ManifestLine {
  text: string;
  file: string;
  duration: number;
  words: WordTiming[];
}
interface Manifest {
  lines: Record<string, ManifestLine>;
}

let manifest: Manifest = { lines: {} };
let manifestLoad: Promise<void> | null = null;
export function loadManifest(): Promise<void> {
  manifestLoad ??= fetch("/audio/manifest.json")
    .then((r) => (r.ok ? r.json() : { lines: {} }))
    .then((m: Manifest) => void (manifest = m?.lines ? m : { lines: {} }))
    .catch(() => undefined);
  return manifestLoad;
}

const howls = new Map<string, Howl>();
function howlFor(file: string): Howl {
  let h = howls.get(file);
  if (!h) {
    // html5 audio keeps pitch when the learner's voice speed is slowed.
    h = new Howl({ src: [`/audio/${file}`], html5: true, preload: true });
    howls.set(file, h);
  }
  return h;
}

/** Preload the recorded lines a lesson is about to use. */
export function preloadLines(texts: string[]) {
  void loadManifest().then(() => texts.forEach((t) => manifest.lines[normalizeLine(t)] && howlFor(manifest.lines[normalizeLine(t)].file)));
}

/** A clock that advances in real time (scaled in tests) and can pause. */
function makeClock(offset = 0) {
  let startedAt = performance.now();
  let pausedAt: number | null = null;
  let base = offset;
  return {
    now: () => base + ((pausedAt ?? performance.now()) - startedAt) / 1000 / timeScale(),
    pause: () => void (pausedAt ??= performance.now()),
    resume: () => {
      if (pausedAt === null) return;
      startedAt += performance.now() - pausedAt;
      pausedAt = null;
    },
    paused: () => pausedAt !== null,
    reset: (to: number) => {
      base = to;
      startedAt = performance.now();
    },
  };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

function silentSpeech(text: string, words: WordTiming[], duration: number, from = 0): Speech {
  const clock = makeClock(from);
  const d = deferred();
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    d.resolve();
  };
  let raf = 0;
  const tick = () => {
    if (clock.now() >= duration) return finish();
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return {
    text,
    words,
    duration,
    source: "silent",
    position: () => Math.min(duration, clock.now()),
    done: d.promise,
    pause: clock.pause,
    resume: clock.resume,
    stop: finish,
    paused: clock.paused,
  };
}

function recordedSpeech(line: ManifestLine, text: string, rate: number): Speech {
  const howl = howlFor(line.file);
  const d = deferred();
  let finished = false;
  let paused = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    howl.off("end", finish);
    d.resolve();
  };
  howl.rate(rate);
  howl.once("end", finish);
  howl.once("loaderror", finish);
  howl.once("playerror", () => howl.once("unlock", () => !finished && howl.play()));
  howl.play();
  return {
    text,
    words: line.words,
    duration: line.duration,
    source: "recorded",
    position: () => {
      const p = howl.seek();
      return typeof p === "number" ? p : 0;
    },
    done: d.promise,
    pause: () => {
      paused = true;
      howl.pause();
    },
    resume: () => {
      if (!paused || finished) return;
      paused = false;
      howl.play();
    },
    stop: () => {
      howl.stop();
      finish();
    },
    paused: () => paused,
  };
}

let chosenVoice: SpeechSynthesisVoice | null | undefined;
function pickVoice(): SpeechSynthesisVoice | null {
  if (chosenVoice !== undefined) return chosenVoice;
  const vs = window.speechSynthesis.getVoices();
  if (!vs.length) return null;
  chosenVoice = vs.find((v) => v.lang === "en-IN") ?? vs.find((v) => v.lang === "en-GB") ?? vs.find((v) => v.lang.startsWith("en")) ?? null;
  return chosenVoice;
}

function synthSpeech(text: string, rate: number): Speech {
  const est = estimateTimings(text, rate);
  const synth = window.speechSynthesis;
  const clock = makeClock();
  clock.pause(); // starts when the engine starts speaking
  const d = deferred();
  let finished = false;
  let silent = false; // muted mid-line or the engine never started: the clock carries on alone
  let current: SpeechSynthesisUtterance | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    d.resolve();
  };
  const runSilently = () => {
    if (silent || finished) return;
    silent = true;
    current = null;
    synth.cancel();
    clock.resume();
    const tick = () => {
      if (finished) return;
      if (clock.now() >= est.duration) finish();
      else timer = setTimeout(tick, 40);
    };
    tick();
  };

  const say = (fromWord: number) => {
    const u = new SpeechSynthesisUtterance(est.words.slice(fromWord).map((w) => w.word).join(" "));
    const v = pickVoice();
    if (v) u.voice = v;
    u.lang = v?.lang ?? "en-IN";
    u.rate = 0.9 * rate;
    u.pitch = 1.05;
    u.onstart = () => clock.resume();
    u.onend = () => current === u && finish();
    u.onerror = () => current === u && finish();
    current = u;
    synth.speak(u);
    // If the engine never starts (no voices, blocked), carry on silently so nothing waits forever.
    timer = setTimeout(() => current === u && clock.paused() && runSilently(), 1500);
  };

  synth.cancel();
  say(0);

  return {
    text,
    words: est.words,
    duration: est.duration,
    source: "synth",
    position: () => Math.min(est.duration, clock.now()),
    done: d.promise,
    // SpeechSynthesis pause/resume is unreliable across browsers: cancel, then
    // resume by speaking the remaining words from the word we stopped on.
    pause: () => {
      clock.pause();
      if (silent) return;
      current = null;
      synth.cancel();
    },
    resume: () => {
      if (finished) return;
      if (silent) return clock.resume();
      const t = clock.now();
      const i = Math.max(0, est.words.findIndex((w) => w.end > t));
      clock.reset(est.words[i]?.start ?? t);
      clock.pause();
      say(i);
    },
    stop: () => {
      current = null;
      synth.cancel();
      finish();
    },
    paused: () => clock.paused(),
    mute: runSilently,
  };
}

/* ---------- the single current line ---------- */

interface SpeechState {
  current: Speech | null;
}
/** The line being spoken now (read-along and the aria-live region subscribe to this). */
export const useSpeech = create<SpeechState>(() => ({ current: null }));

export interface SpeakOptions {
  /** Voice off for this learner, or the mute button is on. */
  silent: boolean;
  rate: number;
}

export function speak(text: string, opts: SpeakOptions): Speech {
  stopSpeech();
  const line = manifest.lines[normalizeLine(text)];
  let s: Speech;
  if (opts.silent) {
    const words = line ? line.words.map((w) => ({ ...w, start: w.start / opts.rate, end: w.end / opts.rate })) : null;
    const est = estimateTimings(text, opts.rate);
    s = silentSpeech(text, words ?? est.words, line ? line.duration / opts.rate : est.duration);
  } else if (line) {
    s = recordedSpeech(line, text, opts.rate);
  } else if (typeof window !== "undefined" && "speechSynthesis" in window) {
    s = synthSpeech(text, opts.rate);
  } else {
    const est = estimateTimings(text, opts.rate);
    s = silentSpeech(text, est.words, est.duration);
  }
  useSpeech.setState({ current: s });
  void s.done.then(() => useSpeech.getState().current === s && useSpeech.setState({ current: null }));
  return s;
}

export function stopSpeech() {
  useSpeech.getState().current?.stop();
  useSpeech.setState({ current: null });
}

export function pauseSpeech() {
  useSpeech.getState().current?.pause();
}
export function resumeSpeech() {
  useSpeech.getState().current?.resume();
}

let unlocked = false;
/**
 * Called from the first tap: lets iOS play audio later. Howler unlocks its own
 * context on touch; SpeechSynthesis needs one utterance inside a user gesture.
 * Nothing audible plays.
 */
export function unlockAudio() {
  if (unlocked || typeof window === "undefined") return;
  unlocked = true;
  void loadManifest();
  if (Howler.ctx?.state === "suspended") void Howler.ctx.resume();
  if ("speechSynthesis" in window) {
    const u = new SpeechSynthesisUtterance("");
    u.volume = 0;
    window.speechSynthesis.speak(u);
    window.speechSynthesis.getVoices();
  }
}

/** Mute toggled mid-line: silence it but keep its clock running. */
export function applyMute(muted: boolean) {
  Howler.mute(muted);
  if (muted) useSpeech.getState().current?.mute?.();
}
