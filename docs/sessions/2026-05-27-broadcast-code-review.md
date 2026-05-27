# Session — 2026-05-27 — Broadcast code review + bug fixes

## What was worked on
- Committed the broadcast pipeline WIP from the prior session (Broadcast.jsx, overlays.jsx, server.js, kernel.js, synthesize-narration.js, vite.config.js)
- Ran a full 3-angle `/code-review` on that commit
- Fixed all 4 confirmed/plausible findings and pushed

## Key decisions made
- Added an explicit localhost-only guard to `/api/broadcast/produce` rather than reverting the auth-logic change — the intent (allow unauthenticated locally) was correct, the guard just needed to be enforced by network origin, not ADMIN_SECRET presence
- Changed `Root.jsx` defaultProps from `edition: ''` to `edition: null` to make the "no edition" sentinel explicit without changing runtime behaviour (`!edition` catches both)
- `MapAttribution bottom: 168` → `bottom: 8` — the old value was calibrated for when Ticker/Chyron lived as absolute siblings inside the map div; they are now flex children outside it
- Removed the silent `catch {}` on the style fetch in `kernel.js` so fetch failures surface as loud errors rather than silent broken renders

## Findings and fixes

| Severity | File | Finding | Fix |
|----------|------|---------|-----|
| CONFIRMED | `server.js:430` | Inverted auth allowed unauthenticated callers when `ADMIN_SECRET` unset | Added `req.socket.remoteAddress` localhost-only guard |
| CONFIRMED | `remotion/src/Root.jsx:11` | `edition: ''` is falsy → Remotion Studio always opened as 1-frame black | Changed default to `edition: null` |
| CONFIRMED | `remotion/src/overlays.jsx:239` | `MapAttribution bottom: 168` orphaned after flex layout change | Changed to `bottom: 8` |
| PLAUSIBLE | `src/map/kernel.js:57` | Silent `catch {}` fell back to unpatched URL on fetch failure, reproducing the glyph 404 bug | Removed try/catch; errors now propagate; sprite guard tightened |

## Discoveries / surprises
- The auth inversion was introduced intentionally in the prior session ("allow unauthenticated when ADMIN_SECRET unset") but the intent was local-dev convenience — the correct enforcement point is network origin, not secret presence
- `MapAttribution`'s `bottom: 168` was inherited from the pre-flex era (Ticker at `bottom: 78` inside the map div) and was never updated when the layout changed — a classic orphaned magic number
- Sprite field in both Mapbox style files is always `mapbox://` so the sprite bug (optional-chaining returning undefined → `"${base}undefined"`) was REFUTED; sprite is always present and always starts with `mapbox://`

## Files modified
- `server.js:430` — localhost guard before secret check on `/api/broadcast/produce`
- `remotion/src/Root.jsx:11` — `edition: ''` → `edition: null`
- `remotion/src/overlays.jsx:239` — `MapAttribution` bottom 168 → 8
- `src/map/kernel.js:57` — removed `try/catch {}`, explicit error throw, sprite null-guard

## Context for next session
- All fixes are committed and pushed; Vercel is live on `main`
- The broadcast pipeline fixes (audio Sequence, glyph URL patch) have not yet been tested end-to-end — run a full render via the Broadcast admin tab to verify narration audio and map labels are both visible
- `MapAttribution` is now at `bottom: 8` inside the map div — confirm in a real render it doesn't clip into map controls

## Open items / next steps
- Run a full end-to-end render (`2026-05-27-morning` or similar) and verify: (1) narration audible at each shot, (2) country borders/city labels visible, (3) ticker below the map, (4) attribution visible at bottom-left of map
- Use `ffprobe` on the output MP4 to confirm a non-silent audio stream
- Consider a smoke-test script that renders 5 frames of a composition and checks for a non-black image (catch regressions before full renders)
