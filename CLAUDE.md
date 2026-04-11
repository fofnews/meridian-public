# meridian-public

## Project Overview

The public-facing Meridian news site. Displays analysis reports, raw articles, timelines, and broadcast content produced by the Meridian-Website pipeline.

**Stack:** React 19, Vite (Rolldown), Tailwind CSS v4, Express (local dev only)
**Deployment:** Vercel — static build (`dist/`) + serverless functions in `api/`
**Local dev:** `npm run dev` (Vite client on :5173 + Express server on :3002)

## Dual Server Architecture

This repo has two parallel API implementations:

| Path | Used by | Purpose |
|------|---------|---------|
| `server.js` | Local dev (`npm run dev:server`) | Express server, serves all `/api/*` routes |
| `api/*.js`, `api/*/[param].js` | Vercel (production) | Serverless functions, one file per route |

**When adding or changing an API route, update BOTH.** The serverless functions must not use Node-specific APIs unavailable in Vercel's edge/serverless runtime (no `fs` with absolute paths — use `path.join(process.cwd(), ...)` or environment variables).

## Directory Structure

```
api/                  — Vercel serverless functions (production API)
  dates.js            — GET /api/dates
  timelines.js        — GET /api/timelines
  suggestions.js      — GET/POST /api/suggestions
  articles/[date].js  — GET /api/articles/:date
  report/[date].js    — GET /api/report/:date
  suggestions/[id]/   — vote, downvote, done, delete endpoints
src/                  — React frontend
  App.jsx             — Main layout, date/edition state, view routing
  components/
    ArticlesView.jsx  — Articles tab: category/subcategory filters, topic chips, search
    BroadcastHero.jsx — Full-width featured story hero
    DateNav.jsx       — Date and edition navigation
    StoryCard.jsx     — Story display with analysis sections
    TimelineView.jsx  — Ongoing topics timeline
    SuggestionBox.jsx — User suggestion submission and voting
reports/              — Analysis JSON files (synced from Meridian-Website)
articles/             — Raw article JSON files (synced from Meridian-Website)
topics/               — Topic chip JSON files (synced from Meridian-Website)
timelines/            — Timeline JSON (synced from Meridian-Website)
suggestions.json      — Persisted user suggestions (local only, not on Vercel)
server.js             — Local Express dev server
vercel.json           — SPA rewrite rules (non-/api/* → index.html)
```

## Key Conventions

- All code is ES modules (`import`/`export`)
- Styling uses CSS custom properties (`var(--bg-primary)`, `var(--accent)`, etc.) — never hardcode colors
- Do not use Node-specific APIs (`fs`, `path.resolve(__dirname)`) in the `api/` serverless functions
- `vercel.json` rewrites all non-API paths to `index.html` for SPA routing — do not remove this

## Data Files

All data files are read-only on the public site — they are written by Meridian-Website and synced via git:

- `reports/YYYY-MM-DD-{morning|evening}.json` — full analysis report
- `articles/YYYY-MM-DD.json` — flat array of raw articles
- `topics/YYYY-MM-DD.json` — pre-computed topic chips (label, count, sources, keywords)
- `timelines/timeline.json` — ongoing topic timeline entries

## Environment Variables (Vercel)

- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — used by suggestions serverless functions for persistent storage on Vercel (local dev falls back to `suggestions.json`)

## Deployment

Vercel auto-deploys on push to `main`. Build command: `npm run build`. Output: `dist/`.

After making changes locally: build with `npm run build`, verify `dist/` looks correct, then push.
