# DCCD Learning Studio

Short, structured lessons on **can** and **can’t** for children at the Dimensions Centre for Child Development (DCCD). A child works through **Watch → Practise → Check → Reward**, with errorless or least-to-most prompting, a token board and a calm reward. Therapists and parents get a grown-up area with per-learner teaching settings, progress reports, a position-bias flag, a lesson item editor and backups.

Everything runs in the browser. There is no server and no account, and nothing is sent anywhere: data lives in this device's `localStorage`.

## Running

Requires Node 22.18 or later (the audio script imports the app’s TypeScript directly).

```bash
npm install
npm run dev          # http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Static export into `out/` |
| `npm start` | Serve `out/` on http://localhost:3100 (run `npm run build` first) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm test` | Vitest unit tests (teaching logic, counterbalancing, CSV, migration…) |
| `npm run test:e2e` | Playwright end-to-end tests against `out/` (Chromium + WebKit; build first) |
| `npm run audio` | Pre-generate the voice lines (see below) |

Playwright needs its browsers once: `npx playwright install chromium webkit`. If a Chromium is already installed elsewhere, point the tests at it with `PW_CHROMIUM_PATH=/path/to/chrome npm run test:e2e -- --project=chromium`.

The end-to-end tests speed the lessons up through `window.__DCCD_TIME_SCALE__` (see `src/config/timing.ts`); it is never set for real users.

### Where things are

```
src/app/                 routes: / (child home), /lesson/?id=can, /grown-up/?tab=…
src/components/child/    lesson screens: LessonScreen (orchestrator), TrialStep, WatchSlide, TokenBoard, …
src/components/grown-up/ learners, progress report, lesson editor, backup
src/config/teaching.ts   every teaching threshold and delay
src/config/timing.ts     every animation duration
src/config/strings.ts    every UI string and fixed spoken line
src/lib/                 pure logic: trial state machine, counterbalancing, progress/mastery, CSV, migration
src/store/app.ts         the Zustand store (persisted, validated with Zod on load)
tests/unit, tests/e2e    Vitest and Playwright
```

## Generating audio

Every line the app speaks is pre-generated with ElevenLabs, with word timings for the read-along highlight. Lines with no audio fall back to the browser's speech engine (and to a silent clock when voice is off or muted), so the app works without this step.

```bash
ELEVENLABS_API_KEY=… ELEVENLABS_VOICE_ID=… npm run audio
npm run audio -- --dry-run      # list the 78 lines, fetch nothing
npm run audio -- --force        # regenerate everything
```

This writes `public/audio/*.mp3` and `public/audio/manifest.json`; commit both. Re-running only fetches lines that are new or whose voice changed. Optional: `ELEVENLABS_MODEL` (default `eleven_multilingual_v2`). Lines come from `src/config/strings.ts` (`VOICE`) and the sentence templates in `src/lib/templates.ts` applied to DCCD's deck; items a therapist adds later use the browser voice until the script is run again.

## Deploying

`npm run build` produces a fully static site in `out/`. Upload that folder to any static host:

- **Netlify / Cloudflare Pages / Vercel:** build command `npm run build`, output directory `out`.
- **GitHub Pages or a plain web server:** copy `out/` to the web root. URLs use trailing slashes (`/lesson/`), so the server must serve `index.html` from directories (all common hosts do). If the site lives under a sub-path, set `basePath` in `next.config.ts`.

Serve it over HTTPS so tablets can add it to the home screen. Each device keeps its own data; use **Backup → Export** to move it.

## Brand tokens

All colours, radii and sizes are CSS variables in the `:root` block at the top of `src/app/globals.css`. To re-brand, change only those values. The palette is muted from DCCD's site (`#38b6ff` blue, `#ff5757` coral); child text pairs are at least 7:1 contrast and adult text at least 4.5:1, so re-check contrast if you change them. The font is Lexend, self-hosted from `src/app/fonts/`. Logos are in `public/brand/`.

Child screens use ≥ 28 px text and ≥ 96 px tap targets (84 px on very small phones); the grown-up area uses 16 px text and 44 px targets.

## The guide character

A small star (`src/components/child/GuideStar.tsx`) sits next to every spoken line. It floats slowly when idle, leans towards the correct card at the full prompt and places a pointing hand on it. It never frowns, shakes or reacts to a wrong answer. To swap it, replace the SVG in `GuideStar` and keep its props (`lean`, `calm`, `size`).

## Teaching defaults

All numbers live in `src/config/teaching.ts`. They are **starting points for DCCD's clinicians to review**; most can be changed per learner in the grown-up area.

| Setting | Default |
| --- | --- |
| Prompting strategy | Errorless (progressive time delay) |
| Time-delay steps | 0 → 2 → 3 → 5 s; step up after 2 sessions in a row with ≤ 1 unprompted error, step down after ≥ 3 |
| Least-to-most | 3 levels (repeat instruction → glow → guide points and card grows), 5 s without a response steps up one level |
| Error correction | “Let’s try again”, the trial is shown again at the full prompt and recorded as prompted |
| Inter-trial pause | 2.5 s (2–3 s) |
| Token board | 5 tokens (3 / 5 / 10); prompted answers earn tokens |
| Mastery | 90 % independent correct in Check over 2 consecutive sessions (80/90/100 %, 1–3 sessions) |
| Review | Mastered lessons return after 7 days as 5 Check trials; below criterion → “needs practice” |
| Unlock order | Can before Can’t (a therapist can override per learner) |
| Counterbalancing | Correct side 5 left / 5 right per 10 trials, never more than 2 in a row, seeded per session (seed stored), item order rotated between sessions |
| Position bias | Flag when one side gets > 70 % of the last 20 first taps |

A wrong answer never produces a negative sound or visual: the card simply looks like the others and the guide says “Let’s try again” (Practise) or “Let’s try another” (Check).

## GSAP licence note

Animations use [GSAP](https://gsap.com) (Watch-step timelines, idle loops, the sticker's DrawSVG outline) and Motion (screen transitions, card feedback, reward scenes). GSAP, including DrawSVGPlugin, is free to use under the GSAP “Standard No-Charge” licence; read <https://gsap.com/standard-license> before a commercial release, because it is not an open-source licence (for example, it excludes building a competing no-code animation tool). Every GSAP timeline runs inside `gsap.matchMedia()` and stops or shortens in calm mode and under the OS's reduced-motion setting.

## Limits

- All data stays in this browser on this device. Clearing browser data deletes it; export backups regularly.
- The grown-up lock (press and hold for 2 seconds) keeps children out; it is **not security**.
- Nicknames and avatars only: no surnames, no photos.
- Trial-level data is kept for the latest 50 sessions per learner and lesson; older sessions keep their summary.
- The CSV import is a paste/upload of a Google Sheet export; in a full build it would sync automatically.
- Two lessons ship (Can, Can’t) built from DCCD's 10-item deck; answers were inferred from the deck (`src/data/deck.ts`) and should be confirmed by DCCD.
- English only; all strings are in `src/config/strings.ts` so Kannada and Hindi can be added.

---

Built by DeadEnd Engineers for the Dimensions Centre for Child Development.
