# Build checklist

Ticked only when built and verified (tests, build or screenshots).

## Acceptance

- [x] Both books read as a storybook: cover → 10 learn pages → 10 quiz pages → the end — e2e: lesson.spec
- [x] Nothing is marked before the tap; the circle draws only after a right tap (or after two wrong taps on a learn page) — e2e
- [x] Everything moves on a tap: the page turns only from the corner arrow — e2e
- [x] Counterbalanced positions (5 left / 5 right per 10 pages, max 2 in a row, seeded per session, seed stored, item order rotated) — unit + e2e
- [x] Error correction ("Let's look again", then the answer is shown; recorded as a correction) — unit + e2e
- [x] Voice: ElevenLabs (Lily), slow and calm; Slower / Normal / Faster from the child's page and the grown-up area, saved per child — e2e
- [x] Mastery (80/90/100 % across 1–3 sessions) and sticker — unit + e2e
- [x] Review after 7 days (5 quiz pages); failed review → needs practice — e2e
- [x] No locks: every assigned book opens; the grown-up area is a plain link — e2e
- [x] A wrong answer never produces a negative sound or visual — no sound effects exist; a wrong pick looks like idle (CharacterCard); checked by reading the code, not by a visual test
- [x] Calm mode, mute and reduced motion work everywhere, including GSAP timelines — e2e: idle loops with calm on/off and OS reduced motion
- [x] Hidden pages never reach a child — e2e
- [x] Page maker: action → two pictures → who can't, with a live preview — e2e
- [x] Position-bias indicator works with the demo data — e2e
- [x] CSV import (with bad-row validation), Reset to DCCD deck — e2e
- [x] Export followed by import — e2e
- [x] Print report works — e2e: print media shows only the report
- [x] No layout breaks at 320, 390, 768, 1024, 1440, 1920 wide in portrait and landscape — e2e, Chromium
- [x] All Vitest tests pass
- [x] All Playwright tests pass (Chromium + WebKit)
- [x] ESLint clean
- [x] No console errors — every e2e test fails on a console error
- [x] `next build` succeeds as a static export
- [x] README: running, generating audio, deploying, brand tokens, guide character, teaching defaults, GSAP licence note, limits
- [x] DEMO_SCRIPT.md with a 3-minute click path including the position-bias story
