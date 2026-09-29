export interface WordTiming {
  word: string;
  start: number;
  end: number;
}

export interface Alignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

/** Manifest key for a spoken line: straight quotes, single spaces, lower case. */
export const normalizeLine = (text: string) =>
  text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim().toLowerCase();

export const splitWords = (text: string) => text.trim().split(/\s+/).filter(Boolean);

/**
 * Group ElevenLabs character alignment into words (split on whitespace).
 * Returns null when the grouping doesn't match the display words, so the
 * caller can fall back to estimated timings.
 */
export function groupAlignment(text: string, a: Alignment): WordTiming[] | null {
  const words: WordTiming[] = [];
  let cur = "";
  let start = 0;
  let end = 0;
  a.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      if (cur) words.push({ word: cur, start, end });
      cur = "";
      return;
    }
    if (!cur) start = a.character_start_times_seconds[i];
    cur += ch;
    end = a.character_end_times_seconds[i];
  });
  if (cur) words.push({ word: cur, start, end });

  const display = splitWords(text);
  if (words.length !== display.length) return null;
  return words.map((w, i) => ({ ...w, word: display[i] }));
}

/**
 * Estimated timings when there is no recorded audio (SpeechSynthesis or
 * silent read-along): time proportional to word length, pauses after punctuation.
 */
export function estimateTimings(text: string, rate = 1): { words: WordTiming[]; duration: number } {
  const perChar = 0.068 / rate;
  const base = 0.14 / rate;
  let t = 0.1;
  const words = splitWords(text).map((word) => {
    const start = t;
    const end = start + base + word.replace(/[^\p{L}\p{N}]/gu, "").length * perChar;
    t = end + (/[.!?]$/.test(word) ? 0.38 : /[,;:]$/.test(word) ? 0.2 : 0.06) / rate;
    return { word, start, end };
  });
  return { words, duration: t };
}

/** Index of the word being spoken at time t (seconds), or -1 before the first / after the last. */
export function activeWordIndex(words: WordTiming[], t: number): number {
  for (let i = 0; i < words.length; i++) {
    const nextStart = words[i + 1]?.start ?? words[i].end;
    if (t >= words[i].start && t < Math.max(words[i].end, nextStart)) return i;
  }
  return -1;
}
