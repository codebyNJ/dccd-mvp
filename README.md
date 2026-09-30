# DCCD Learning Studio

Short, structured lessons on **can** and **can’t** for children at the Dimensions Centre for Child Development (DCCD). Each lesson is a **storybook**: a cover, ten “learn” pages, ten “quiz” pages and “The end”. A calm voice reads each question (“Who can’t fly?”); the child taps a picture, and only then does a hand-drawn circle mark the answer. Every step moves on a tap. Therapists and parents get a grown-up area with per-child settings, progress reports, a position-bias flag, a tap-the-pictures page maker and backups.

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
src/app/                 routes: / (reader + bookshelf), /lesson/?id=can (the storybook), /grown-up/?tab=…
src/components/child/    Home (bookshelf), LessonScreen (cover, pages, the end), CharacterCard, RoughCircle, …
src/components/grown-up/ children, progress report, books + page maker, backup
src/config/teaching.ts   every teaching threshold and delay
src/config/timing.ts     every animation duration
src/config/strings.ts    every UI string and fixed spoken line
src/lib/                 pure logic: tap rules, counterbalancing, progress/mastery, CSV, migration
src/store/app.ts         the Zustand store (persisted, validated with Zod on load)
tests/unit, tests/e2e    Vitest and Playwright
```

## Generating audio

Every line the app speaks is pre-generated with ElevenLabs, with word timings for the read-along highlight. The voice is **Lily** (soft, British), recorded slow and calm: speed 0.8, stability 0.85, style 0. The child's snail/rabbit button (and **Voice speed** in the grown-up area) plays it back at 0.8× / 1× / 1.2× without changing pitch. Lines with no audio fall back to the browser's speech engine (and to a silent clock when voice is off or muted), so the app works without this step.

Put the key in `.env.local` (git-ignored, never commit it):

```bash
echo 'ELEVENLABS_API_KEY=sk_…' > .env.local
npm run audio                   # fetch new or changed lines
npm run audio -- --dry-run      # list the 66 lines, fetch nothing
npm run audio -- --force        # regenerate everything
```

This writes `public/audio/*.mp3` and `public/audio/manifest.json`; commit both. Re-running only fetches lines that are new or whose voice or settings changed. Optional: `ELEVENLABS_VOICE_ID` (default Lily, `pFZP5JQG7iQjIQuC4Bku`), `ELEVENLABS_MODEL` (default `eleven_multilingual_v2`). Lines come from `src/config/strings.ts` (`VOICE`) and the sentence templates in `src/lib/templates.ts` applied to DCCD's deck; items a therapist adds later use the browser voice until the script is run again.

## Deploying

`npm run build` produces a fully static site in `out/`. Upload that folder to any static host:

- **Netlify / Cloudflare Pages / Vercel:** build command `npm run build`, output directory `out`.
- **GitHub Pages or a plain web server:** copy `out/` to the web root. URLs use trailing slashes (`/lesson/`), so the server must serve `index.html` from directories (all common hosts do). If the site lives under a sub-path, set `basePath` in `next.config.ts`.

Serve it over HTTPS so tablets can add it to the home screen. Each device keeps its own data; use **Backup → Export** to move it.

## Brand tokens

All colours, radii and sizes are CSS variables in the `:root` block at the top of `src/app/globals.css`. To re-brand, change only those values. The palette is muted from DCCD's site (`#38b6ff` blue, `#ff5757` coral); child text pairs are at least 7:1 contrast and adult text at least 4.5:1, so re-check contrast if you change them. The font is Lexend, self-hosted from `src/app/fonts/`. Logos are in `public/brand/`.

Child screens use ≥ 28 px text and ≥ 96 px tap targets (84 px on very small phones); the grown-up area uses 16 px text and 44 px targets.

## The guide character

A small star (`src/components/child/GuideStar.tsx`) sits next to every spoken line; tapping it says the line again. It floats slowly when idle and never frowns, shakes or reacts to a wrong answer. It never points at an answer: nothing is marked before the child taps. To swap it, replace the SVG in `GuideStar` and keep its props (`calm`, `size`).

## Teaching defaults

All numbers live in `src/config/teaching.ts`. They are **starting points for DCCD's clinicians to review**; most can be changed per learner in the grown-up area.

| Setting | Default |
| --- | --- |
| Pages per book | 10 learn pages, then 10 quiz pages (one per approved item each) |
| Before the tap | Nothing: no circle, glow or pointing hand |
| Learn pages | Right tap → circle + praise. Wrong tap → “Let’s look again”; a second wrong tap shows the answer (circle + “The snake can’t fly. The bird can fly.”) |
| Quiz pages | One tap each; wrong → “Let’s try another”. These measure independence |
| Page turn | Only when the child taps the corner arrow, which appears once the voice has finished |
| Mastery | 90 % independent correct in Check over 2 consecutive sessions (80/90/100 %, 1–3 sessions) |
| Review | Mastered books return after 7 days as 5 quiz pages (“Read again”); below criterion → “needs practice” |
| Counterbalancing | Correct side 5 left / 5 right per 10 pages, never more than 2 in a row, seeded per session (seed stored), item order rotated between sessions |
| Position bias | Flag when one side gets > 70 % of the last 20 first taps |

A wrong answer never produces a negative sound or visual: the picture simply looks like the other one and the guide says “Let’s look again” (learn pages) or “Let’s try another” (quiz pages).

## GSAP licence note

Animations use [GSAP](https://gsap.com) (the hand-drawn circle, idle loops, the sticker's DrawSVG outline) and Motion (page turns, card feedback, the end scene). GSAP, including DrawSVGPlugin, is free to use under the GSAP “Standard No-Charge” licence; read <https://gsap.com/standard-license> before a commercial release, because it is not an open-source licence (for example, it excludes building a competing no-code animation tool). Every GSAP timeline runs inside `gsap.matchMedia()` and stops or shortens in calm mode and under the OS's reduced-motion setting.

## Limits

- All data stays in this browser on this device. Clearing browser data deletes it; export backups regularly.
- Nicknames and avatars only: no surnames, no photos.
- Trial-level data is kept for the latest 50 sessions per learner and lesson; older sessions keep their summary.
- The CSV import is a paste/upload of a Google Sheet export; in a full build it would sync automatically.
- Two books ship (Can, Can’t) built from DCCD's 10-item deck; answers were inferred from the deck (`src/data/deck.ts`) and should be confirmed by DCCD.
- English only; all strings are in `src/config/strings.ts` so Kannada and Hindi can be added.

---

Built by DeadEnd Engineers for the Dimensions Centre for Child Development.
