# Codex Project Instructions

Read `README.md` and `PROJECT_CONTEXT.md` before changing code.

## Product invariants

- Preserve existing user progress across upgrades.
- Keep the localStorage key `starter-dictation-v2` unless a task explicitly requires a migration to a new key.
- When changing stored data, add a backward-compatible migration and tests.
- Use the learner's local calendar date, not UTC, for daily plans.
- A completed word must remain visibly crossed out.
- Completed items must not be discarded when daily quantity settings change.
- Due reviews are ordered by oldest `nextReview` first and capped by the configured review limit.
- Reset must clear all learning data and restore 5 new words and 5 review words per day.

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
- The production URL is `https://starter-daily-dictation.vercel.app`.
