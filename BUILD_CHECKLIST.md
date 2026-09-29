# Build checklist

Ticked only when built and verified (tests, build or screenshots).

## Acceptance

- [ ] Both lessons work through Watch, Practise, Check and Reward
- [ ] Counterbalanced positions (5 left / 5 right per 10-trial block, max 2 in a row, seeded per session, seed stored, item order rotated)
- [ ] Errorless prompting (progressive time delay 0 → 2 → 3 → 5 s)
- [ ] Least-to-most prompting (levels 1–3, 5 s no-response step-up)
- [ ] Error correction ("Let's try again", full prompt, recorded as prompted)
- [ ] Token board (3 / 5 / 10) and choice of reward before the session
- [ ] Reward plays when the board fills, then the board resets
- [ ] Mastery (80/90/100 % across 1–3 sessions) and sticker
- [ ] "Practise the ones you missed" after Check
- [ ] Review after 7 days (5 trials); failed review → needs practice
- [ ] Unlock rule: Can't after Can is mastered, therapist override
- [ ] A wrong answer never produces a negative sound or visual
- [ ] Calm mode, mute and reduced motion work everywhere, including GSAP timelines
- [ ] Draft items never reach a child
- [ ] Position-bias indicator works with the demo data
- [ ] CSV import (with bad-row validation), Reset to DCCD deck
- [ ] Export followed by import
- [ ] Print report works
- [ ] No layout breaks at 320, 390, 768, 1024, 1440, 1920 wide in portrait and landscape
- [ ] All Vitest tests pass
- [ ] All Playwright tests pass (Chromium + WebKit)
- [ ] ESLint clean
- [ ] No console errors
- [ ] `next build` succeeds as a static export
- [ ] README: running, generating audio, deploying, brand tokens, guide character, teaching defaults, GSAP licence note, limits
- [ ] DEMO_SCRIPT.md with a 3-minute click path including the position-bias story
