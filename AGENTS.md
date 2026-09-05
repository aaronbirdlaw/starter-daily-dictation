# Codex Project Instructions

Read `README.md` and `PROJECT_CONTEXT.md` before changing code.

## Product invariants

- Preserve existing user progress across upgrades.
- Keep the localStorage key `starter-dictation-v2` unless a task explicitly requires a migration to a new key.
- When changing stored data, add a backward-compatible migration and tests.
- Use the learner's local calendar date, not UTC, for daily plans.
- A completed word must remain visibly crossed out.
- Completed items must not be discarded when daily quantity settings change.
- Daily reviews prioritize yesterday’s first reviews, then oldest nextReview. Cap today by suggested workload; preserve the remaining backlog in memory.
- Reset clears learning data and restores a 5-new-word ceiling with a derived 15-word suggested total. Preserve legacy reviewCount=5 for backward compatibility; it no longer caps reviews.

## Engineering rules

- Keep the app usable as a static site with no backend requirement.
- Avoid adding runtime dependencies unless the task clearly needs them.
- Maintain responsive behavior for narrow iPhone-sized screens.
- Preserve accessible labels for audio and interactive controls.
- Treat the embedded word list as product data; do not remove or rename entries casually.
- Keep British English speech (`en-GB`) as the default.

## Verification

- Run `npm test` after logic changes.
- Run a JavaScript syntax check for inline scripts after editing `index.html`.
- Manually verify the Today, Word Bank, Progress/Settings, speech, and Reset flows when UI behavior changes.
- Report what was tested and any browser-dependent behavior.

## Git and deployment

- Use a focused branch for each feature or fix.
- Do not combine unrelated changes.
- Do not deploy to production unless the user explicitly asks.
- The production URL is `https://starter-daily-dictation.pages.dev` on Cloudflare Pages.
- Never clear `starter-dictation-v2` after cloud import; keep the D1 migration backup and verification flow intact.


## Daily review batches (supersedes prior unlimited daily-list rule)

Today is limited to the suggested total. Yesterday’s new words receive first-review priority; other reviews are oldest-due first. Preserve completed items even after lowering the target. Excess reviews remain in memory at their original dates and appear as a separate backlog count. Completing today succeeds even with backlog. Continue review explicitly adds up to five words; the per-day extraReview allowance defaults to zero and synchronizes by maximum, never sum. No automatic refill on completion or sync. Memory and existing dates are never reset.
