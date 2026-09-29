# Build checklist

Ticked only when built and verified (tests, build or screenshots).

## Acceptance

- [x] Both lessons work through Watch, Practise, Check and Reward — e2e: brief.spec (Can, twice, from a learner created in the UI) and lesson.spec (Can’t)
- [x] Counterbalanced positions (5 left / 5 right per 10-trial block, max 2 in a row, seeded per session, seed stored, item order rotated) — unit + e2e
- [x] Errorless prompting (progressive time delay 0 → 2 → 3 → 5 s) — unit (step up/down) + e2e: prompt and “This one.” straight after the instruction at 0 s
- [x] Least-to-most prompting (levels 1–3, 5 s no-response step-up) — e2e: glow before full prompt
- [x] Error correction ("Let’s try again", full prompt, recorded as prompted) — e2e: the line is spoken, the retry is recorded with `correction: true` at level 3
- [x] Token board (3 / 5 / 10) and choice of reward before the session — e2e
- [x] Reward plays when the board fills, then the board resets — e2e: 20 answers on a board of 5 play the reward 4 times
- [x] Mastery (80/90/100 % across 1–3 sessions) and sticker — unit + e2e: default 90 % × 2 reached after the second session, not the first
- [x] "Practise the ones you missed" after Check — e2e
- [x] Review after 7 days (5 trials); failed review → needs practice — e2e
- [x] Unlock rule: Can’t after Can is mastered, therapist override — e2e
- [x] A wrong answer never produces a negative sound or visual — there are no sound effects; the picked-wrong card looks like idle (CharacterCard); e2e checks the guide never says “no / wrong / incorrect / oops”
- [x] Calm mode, mute and reduced motion work everywhere, including GSAP timelines — e2e: idle loops with calm on/off and OS reduced motion
- [x] Draft items never reach a child — e2e
- [x] Position-bias indicator works with the demo data — e2e
- [x] CSV import (with bad-row validation), Reset to DCCD deck — e2e
- [x] Export followed by import — e2e
- [x] Print report works — e2e: print media shows only the report
- [x] No layout breaks at 320, 390, 768, 1024, 1440, 1920 wide in portrait and landscape — e2e at real device sizes (320×568 … 1080×1920 / 1920×1080) with overlap, overflow and on-screen checks; screenshots reviewed (`node scripts/contact-sheet.mjs`)
- [x] Keyboard-only run — e2e: Tab + Enter from learner picker through Watch, Practise and Break, with visible focus
- [x] All Vitest tests pass — 55 tests
- [ ] All Playwright tests pass (Chromium + WebKit) — 30/30 pass in Chromium; WebKit not run yet (only Chromium is available in the build sandbox)
- [x] ESLint clean
- [x] No console errors — every e2e test fails on a console error (Chromium)
- [x] `next build` succeeds as a static export; `netlify.toml` for Netlify, Vercel needs no config
- [x] README: running, generating audio, deploying, brand tokens, guide character, teaching defaults, GSAP licence note, limits, iPad audio check
- [x] DEMO_SCRIPT.md with a 3-minute click path including the position-bias story

## Needs a real device or keys

- [ ] Audio on a real iPad (first-tap unlock, Break pauses, Mute stops)
- [ ] ElevenLabs lines generated (`npm run audio` with `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID`)
