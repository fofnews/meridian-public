# Session — 2026-05-27 — Pipeline sync / Vercel deployment fix

## What was worked on
- Diagnosed why Vercel wasn't receiving article and analysis updates automatically
- Fixed a silent bug in the pipeline's git push logic (`my-news-analyzer-pipeline/server/index.js`)
- Manually backfilled `reports/2026-05-27-morning.json` and all 10 topics files (`2026-05-18` thru `2026-05-27`) that had never reached origin

## Key decisions made
- Fix lives in the pipeline repo, not meridian-public — Vercel config and deployment were working correctly throughout
- Used the same git plumbing approach the pipeline uses (temp `GIT_INDEX_FILE`, `hash-object` + `update-index --add --cacheinfo` + `write-tree` + `commit-tree` + `push <sha>:refs/heads/main`) to backfill files without touching the local working tree or uncommitted WIP
- Did not attempt to recover 2026-05-26 reports — server was down that day, no data to recover

## Discoveries / surprises
- **Topics had never been pushed to origin.** Every topics push had silently failed since the feature was introduced. `topics/` was not in origin's tree, so `git update-index --cacheinfo` (without `--add`) rejected every new path.
- **Timelines kept working throughout** because `timelines/timeline.json` was already present in origin's tree — updates succeeded; only new paths fail without `--add`.
- **The failure was completely silent.** The outer catch in `gitCommitAndPush()` logs only `console.warn` to `meridian-error.log`. No alerting, no PM2 restart, no visible signal — the pipeline appeared healthy from the outside.
- User's uncommitted WIP in meridian-public (Broadcast.jsx, server.js, kernel.js, etc.) was **not involved** — the pipeline bypasses the local working tree entirely via git plumbing.

## Files modified
- `my-news-analyzer-pipeline/server/index.js:354` — added `--add` to `git update-index --cacheinfo`

## Context for next session
- Pipeline sync is healthy. All new daily files (articles, topics, reports) will push automatically on each 15-min cron cycle.
- `gitCommitAndPush()` in `server/index.js:386-387` swallows errors silently — worth adding a more visible failure signal (dedicated log file, desktop notification, or non-zero exit so PM2 restarts).
- Local meridian-public is behind origin (needs `git pull`) and has uncommitted WIP — pull before working on the codebase.

## Open items / next steps
- Consider adding observability to `gitCommitAndPush` failures so they don't go unnoticed again
- Topics are now on origin — verify the `/api/topics/:date` endpoint returns data correctly on the live site
