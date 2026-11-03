# Desktop redesign

Build the new desktop layout of the Analysis view. Read this whole file and the two reference files, then propose a plan before changing code.

## Ground rules

- Work on a branch, `redesign-desktop`. `main` auto-deploys to Vercel, so nothing lands on `main` until Dan approves it on a preview deploy.
- One commit per phase below, in order. Ask before each commit. Don't push without asking.
- Follow CLAUDE.md: CSS custom properties only, no hardcoded colors in components; every color needs a dark and a light value.
- Every phase must keep the behavior rules in `TODO.md` ("Redesign behavior requirements") and the map fixes from `5ab958473` (memoized lists, map keyed on the featured story id, `--map-sticky-height`, lazy map init). Re-test them at the end.
- Verify each phase in the browser (`npm run dev`, :5174) in dark and light themes, at 1440px and 1024px wide, with at least two reports: one with story groups (2026-10-28 morning) and one without.
- Phone layout is out of scope; it gets its own redesign. Don't break it, but don't design for it.
- Don't touch `reports/`, `articles/`, `topics/`, `timelines/`, the map kernel (`src/map/`) or broadcast mode.

## Reference

- `docs/superpowers/specs/redesign-reference/edition-with-groups.dc.html`: the full Oct 28 morning edition with story groups (the main reference).
- `docs/superpowers/specs/redesign-reference/story-list-and-settings.dc.html`: the settings panel (Stories, Display, Map, About tabs).

Both are design-canvas files: plain HTML with inline styles, `{{holes}}` filled by the script at the bottom, and real report data embedded. Use them for structure, spacing, type sizes and copy. Their colors are dark-theme hex values; map them to tokens (Phase 1). They show the map as a static block only because the canvas can't pin it; the live map stays pinned.

## Phase 0: outlet leans, per edition

Leans changed on Oct 30, 2026 (AllSides check): Newsweek left -> center, Al Jazeera center -> left, AP News center -> left, The Free Press center -> right, Wall Street Journal right -> center. **Past editions must keep the leans they were published with.** The pipeline (its own handoff, `docs/superpowers/plans/2026-10-30-outlet-leans-update.md`) stamps every new report with `sourceLeans` (outlet -> left/center/right) and `leansVersion`. Older reports have neither.

- Add a shared module (e.g. `src/shared/source-leans.js`) that the site, Remotion and `scripts/build-shotlist.js` all import:
  - `LEGACY_LEANS`: the map exactly as it is today in `remotion/src/source-leans.js` (pre-Oct 30). Frozen; never edit it. Used for any report without `sourceLeans`.
  - `CURRENT_LEANS`: today's map with the five changes above (CBS News and NY Times stay left). Used by Remotion and the shotlist script for new editions, and as the fallback if a new report somehow lacks `sourceLeans`.
  - `leansFor(report)`: returns `report.sourceLeans` if present, otherwise `LEGACY_LEANS`.
  - `leanOf(leans, source)` and the left / center / right lists in feed order.
- Move `remotion/src/source-leans.js` to import from the shared module (keep its export name so Remotion code doesn't change), and make `build-shotlist.js` use `leansFor(report)`.
- Every lean lookup in the Analysis view goes through `leansFor(report)` for the report being shown. `SourceBadge` takes the lean (or the map) as a prop instead of keeping its own lists; delete its lists.
- The outlet total ("of 22 outlets") and the left / center / right marks in the coverage strip come from the map for that report, never a hardcoded 22.
- Verify: an Oct 28 report shows Newsweek as left and AP as center (legacy); a report with `sourceLeans` shows them as center and left. Until the pipeline change lands, test with a copy of a report that has `sourceLeans` added by hand, and don't commit that copy.

## Phase 1: tokens and type

Fonts (Google Fonts link in `index.html`): add Newsreader (display: 400, 600, 700, italic 400) and Libre Franklin (labels: 400, 500, 600, 700). Keep Source Serif 4 for body. Keep Playfair Display loaded only if broadcast mode or the map still uses it; headings in the Analysis view move to Newsreader.

New tokens (names are suggestions). Dark values come from the reference; light values are proposals, and each must reach 4.5:1 contrast against `--bg-primary` and `--bg-secondary` in its theme (check, and darken if not):

| Token | Dark | Light (proposed) |
|---|---|---|
| `--lean-left` | #5b9fd4 | #1f5d99 |
| `--lean-center` | #b8b0a0 | #5f584c |
| `--lean-right` | #e06a6a | #a8322f |
| `--accent-text` (gold used as text) | #e8c547 | #7a5a00 (the current #9A7200 is under 4.5:1 on light backgrounds) |
| `--tier-spectrum` | #86efac | #186638 |
| `--disagree-text` | #f0a35b | #8a4508 |
| `--label` (small sans labels) | #8590a8 | #3A5070 |

## Phase 2: frame around the list

- Map status strip: replace the clock with "Analysis run at 7:19 AM ET · Next edition around 5:20 PM". The time is the report's `fetchedAt` (set when analysis finishes) in Eastern time. "Next edition" is around 7:20 AM after an evening edition and around 5:20 PM after a morning one; hide it for past editions. Add a settings gear (44px target, `aria-label="Settings"`).
- Remove "Hide Map" from the strip (it moves to settings). The hidden-map bar keeps "Show map" and also gets the gear.
- Remove the floating theme button (theme moves to settings). Keep back-to-top.
- View tabs: Analysis · Articles · Timeline · Suggestions. `SuggestionBox` moves out of the Analysis view into the Suggestions tab, unchanged.
- The "N articles from N outlets" stats line moves to the footer: "Morning edition, Oct 28: 579 articles from 21 outlets, collected between 5:00 PM and 7:00 AM." Footer links: How it works, How we rate outlets, Corrections (keep existing targets; leave out any that don't exist yet).

## Phase 3: closed story rows

- Section heading: "Covered by more than one outlet · 26 stories, most outlets first".
- Every story and every story group is one row: headline (Newsreader 24px), then a line with "N sources", up to 6 outlet names colored by lean ("+N more" after that), "N facts", and "N disagreements" in `--disagree-text` when there are any. No summary on closed rows.
- Groups: an eyebrow line "Developing story · 13 reports" in `--accent-text`; the group label as the headline; the lead (multi-source) story's headline underneath in body text; sources are the union across the group's stories; facts and disagreements are the lead story's.
- Sort everything by distinct outlet count, groups by their union count.
- Read checkmarks: opening a story or group marks it read (check icon plus dimmed headline). Store in `localStorage` under one key, keyed by date, edition and item id; keep only the last 14 editions. Wrap every `localStorage` access in try/catch.

## Phase 4: open story

Follow the reference's open Israel story. Opening an item closes the previous one (existing `expandedStory` + `scrollAnchor`).

- Header: locations line (from `analysis.locations`) in `--accent-text`, headline in Newsreader 28px.
- Summary paragraph, with a coverage panel beside it: "Compared: N of 22 outlets", a strip of 22 marks grouped left / center / right (filled in the lean color when the outlet covered it), a gap note ("No left-leaning outlet covered this", "Only right-leaning outlets covered this", etc.), and Left / Center / Right rows listing the outlets.
- Tabs, using proper `role="tablist"`/`role="tab"`/`aria-selected`: Facts (count) · Headlines (count) · Disagreements (count) · Context. Opens on Facts (Phase 7 makes this a setting).
  - Facts in three tiers: "Reported across the spectrum" (at least one left, one center and one right outlet), "Reported by more than one outlet", "Reported by one outlet, not confirmed elsewhere". Each claim shows lean-colored pips and the outlet names. A claim with `contested` shows "Worded differently by <source>: <alternative>".
  - Headlines in three columns (Left / Center / Right); an empty column says "No outlet on this side covered it." Each links to the article and opens in a new tab.
  - Disagreements: topic as a heading, one card per position with the outlet in its lean color. With none: "No disagreements found among the N outlets."
  - Context: the label "Editorial analysis written by Meridian's analysis model. Not sourced fact.", the significance paragraph, then "Open questions" as a numbered list.
- Footer of the open story: "AI-generated analysis of N articles from N outlets · Analysis run at 7:19 AM ET · may contain errors", and a "Collapse story" button. (Copy link and Report an error wait for per-story URLs and the error-report work.)
- A story with `analysis: null` shows "Analysis isn't available for this story yet." instead of tabs.
- Remove the `Sparkles` icon and the old section styling from `AnalysisView` once nothing uses it.

## Phase 5: story groups

A group opens as one item (see `TODO.md`). Below its header ("13 outlets in all · 11 outlets compared · 12 single-outlet reports"), two thread buttons:

1. Compared coverage: the lead story's full Phase 4 view.
2. Single-outlet reports: each of the group's single-outlet stories with outlet (lean color), headline (linked) and summary, under the line "Each of these was reported by one outlet. Summarized, not compared."

Thread state resets to 1 on every open. The map stays on the lead story for both threads.

## Phase 6: In brief

Groups with no multi-source story stay in In brief, as they do now: label, "N reports from N outlets", then their stories. Then single-outlet stories: the first 10, and "Show all N single-outlet reports" expands the rest. Rows are headline plus outlet name in its lean color.

## Phase 7: settings panel

A slide-over from the right, 440px wide, over a dimmed page; layering, scroll lock, Escape and the two gear placements as in `TODO.md`. Tabs: Display, Stories, Map, About. All values persist in `localStorage` (try/catch); list the keys in a comment.

- Display: Theme (System default, Dark, Light; System follows `prefers-color-scheme`); Text size (Small, Normal, Large, Larger, scaling the Analysis view's text, not the map); Reading font (Source Serif default, Atkinson Hyperlegible). OpenDyslexic needs self-hosted font files; leave it out for now.
- Stories: "An opened story starts on" Facts / Disagreements (default Facts); "Mark stories I've opened" on/off; "Mark all as read"; "Clear read history"; the keyboard shortcut list (Phase 8).
- Map: "Show the map" toggles `mapVisible`. Copy: "When off, the map is hidden now and isn't loaded on your next visit. Each opened story still names its locations."
- About: "Stored in this browser: your settings and the stories you've opened. Nothing is sent to The Meridian, and nothing needs an account." plus "Clear settings and read history". Links as in the footer. Leave out Privacy, RSS and Report a problem until those pages exist.

## Phase 8: keyboard shortcuts

j / k: next / previous row (focus and scroll it into view; `scroll-margin-top` already clears the map). Enter: open or close the focused row. 1–4: switch tabs in the open story. ?: open settings on the Stories tab. Ignore keys while typing in an input or textarea, while settings is open (except Escape), or with modifier keys held.

## Not in this handoff

Per-story URLs and Copy link, "Developing. Previously..." links, Report an error and the Corrections workflow, link-preview images, RSS, OpenDyslexic, phone layout, the MapLibre comparison.

## Finish

Re-run every item in `TODO.md` "Redesign behavior requirements" plus: the map stays pinned while scrolling; opening a story moves the map; opening another closes the first and keeps the clicked row in place; switching tabs, threads, theme, text size or read state never moves the map. Run `npm run build`. Then ask Dan before pushing the branch for a Vercel preview.
