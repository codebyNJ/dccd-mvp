#!/usr/bin/env node
/**
 * Pre-generate every spoken line with ElevenLabs, plus word timings for read-along.
 *
 *   ELEVENLABS_API_KEY=… ELEVENLABS_VOICE_ID=… npm run audio
 *
 * Writes public/audio/<hash>.mp3 and public/audio/manifest.json. Lines already in the
 * manifest with the same text and voice are skipped, so re-running only fetches new lines.
 * Lines without audio fall back to the browser's speech engine in the app.
 *
 * Options: --dry-run (list lines, fetch nothing), --force (regenerate everything).
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { allVoiceLines } from "../src/lib/voice-lines.ts";
import { estimateTimings, groupAlignment, normalizeLine } from "../src/lib/words.ts";

const OUT = join(process.cwd(), "public", "audio");
const MANIFEST = join(OUT, "manifest.json");
const args = new Set(process.argv.slice(2));
const dry = args.has("--dry-run");
const force = args.has("--force");

const key = process.env.ELEVENLABS_API_KEY;
const voice = process.env.ELEVENLABS_VOICE_ID;
const model = process.env.ELEVENLABS_MODEL ?? "eleven_multilingual_v2";

const lines = allVoiceLines();
if (dry) {
  console.log(lines.join("\n"));
  console.log(`\n${lines.length} lines.`);
  process.exit(0);
}
if (!key || !voice) {
  console.error("Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID (see README → Generating audio).");
  process.exit(1);
}

await mkdir(OUT, { recursive: true });
let manifest = { voice, lines: {} };
try {
  manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
  manifest.lines ??= {};
} catch {
  /* first run */
}

const fileFor = (text) => `${createHash("sha1").update(`${voice}:${model}:${text}`).digest("hex").slice(0, 12)}.mp3`;

let made = 0;
let kept = 0;
for (const text of lines) {
  const k = normalizeLine(text);
  const file = fileFor(text);
  if (!force && manifest.lines[k]?.file === file) {
    kept++;
    continue;
  }
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: model,
      // Calm, even delivery for young learners.
      voice_settings: { stability: 0.7, similarity_boost: 0.75, style: 0, speed: 0.9 },
    }),
  });
  if (!res.ok) {
    console.error(`✗ ${text}: ${res.status} ${await res.text()}`);
    process.exitCode = 1;
    continue;
  }
  const body = await res.json();
  await writeFile(join(OUT, file), Buffer.from(body.audio_base64, "base64"));
  const a = body.normalized_alignment ?? body.alignment;
  const words = (a && groupAlignment(text, a)) ?? estimateTimings(text).words;
  const duration = a ? a.character_end_times_seconds.at(-1) : estimateTimings(text).duration;
  manifest.lines[k] = { text, file, duration, words };
  made++;
  console.log(`✓ ${text}`);
  // Save as we go, so an interrupted run keeps what it fetched.
  await writeFile(MANIFEST, JSON.stringify({ voice, lines: manifest.lines }, null, 2));
}

// Drop entries for lines the app no longer says.
const wanted = new Set(lines.map(normalizeLine));
for (const k of Object.keys(manifest.lines)) if (!wanted.has(k)) delete manifest.lines[k];
await writeFile(MANIFEST, JSON.stringify({ voice, lines: manifest.lines }, null, 2));
console.log(`\n${made} generated, ${kept} unchanged, ${Object.keys(manifest.lines).length} in manifest.`);
