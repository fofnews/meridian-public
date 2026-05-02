# Session — 2026-05-01

Branch: `claude/map-broadcast-checklist` — item #1 complete, 5 / 23 checklist items done.

## What was worked on
- Verified Phase 0 status: all four 0a–0d items are implemented on `claude/map-broadcast-checklist` but were never merged to `main`. Dev site was showing the old `BroadcastHero.jsx` with chyron/LIVE/ticker — no Phase 0 changes visible there.
- Decided to keep `main` (and Vercel) frozen at the pre-Phase-0 look until the full 23-item checklist is done. Single end-of-project merge rather than incremental partial-state deploys.
- Switched dev to `claude/map-broadcast-checklist` (had to stash uncommitted pipeline article/report files to unblock the checkout).
- Implemented item #1 — atmospheric fog via `map.setFog(...)` in `applyMapStyle` (`src/map/layers.js`), theme-aware for both dark and light.
- Iterated light-theme fog: first attempt used `space-color: '#f5f2ed'` (warm paper), which blended into the land color and made the globe edge invisible. Fixed to `space-color: '#7aafc8'` (clear sky blue), giving the globe proper contrast against a daytime sky.

## Key decisions made
- **Keep `main` frozen through the checklist.** Phase 0–2 all land in a single merge at the end. Daily pipeline syncs continue to push to `main`; the feature branch gets periodic `git rebase origin/main` to pick up fresh data.
- **`setFog` lives in `applyMapStyle`.** It re-runs on every style change (load + theme switch), so both `MapHero` and `BroadcastStage` inherit theme-correct fog automatically. No separate fog function needed.
- **Light theme fog = daytime sky, not outer space.** `star-intensity: 0`, `space-color` is a clear mid-sky blue, not the warm paper of the page background. Dark theme = deep space + subtle stars (0.6 intensity).

## Discoveries / surprises
- Phase 0 was fully implemented but none of it was on `main` — the working branch had diverged substantially. User was seeing the old costume-heavy `BroadcastHero.jsx` on the dev site the whole time.
- Light-theme `space-color` matching land color is a subtle failure mode: the globe "disappears" into the background rather than sitting in the sky. The fix (sky blue) is obvious in retrospect but only visible once it rendered.
- Map load time is noticeably slow — tile fetch + lazy Mapbox chunk (~500KB). Pre-existing from Phase 0's deliberate lazy-load decision (bundle size trade-off). Not introduced by fog. Worth a dedicated performance item.

## Files modified

- `src/map/layers.js` — added `map.setFog(...)` block inside `applyMapStyle`, theme-aware (dark: deep space; light: daytime sky)
- `docs/map-broadcast-checklist.md` — status bumped to 5 / 23, item #1 marked done with implementation notes

## Context for next session
- Branch: `claude/map-broadcast-checklist`. Switch to it before working (`git switch claude/map-broadcast-checklist`). If pipeline files are blocking checkout, stash them (`git stash push --include-untracked`).
- Dev server: `npm run dev` → http://localhost:5173 (or next available port if 5173 is taken).
- The checklist file is the durable plan: `docs/map-broadcast-checklist.md`. Resume by reading it.
- Architecture reminder: visual identity lives in `src/map/` (kernel + layers + marker + camera); behavior diverges in `MapHero.jsx` (website) and `BroadcastStage.jsx` (video) via `useMeridianMap` hook.

## Open items / next steps
- **Item #2 — Custom Mapbox style.** Replace the ~150-line runtime patching block in `layers.js` with a committed `meridian.style.json`. Bigger lift — requires Mapbox Studio or hand-authoring JSON. The data-driven highlight layers (`country-highlight`, `state-boundary`) stay as runtime additions.
- **Item #16 — Headless render harness (Playwright).** Checklist recommends building this early (~item 5) so visual changes can be reviewed as encoded video rather than live browser. Live preview lies; encoded output reveals judder.
- **Map load time.** Slow first paint from lazy Mapbox chunk + tile fetch. Not caused by fog — pre-existing from Phase 0. Consider a dedicated performance item.
- **Rebase frequency.** Feature branch should be rebased against `origin/main` periodically to pick up fresh pipeline data. Do before pushing if the push gets a non-fast-forward error.
