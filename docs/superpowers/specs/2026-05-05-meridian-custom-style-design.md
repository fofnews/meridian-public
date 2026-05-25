# Design: Meridian Custom Mapbox Style (Checklist Item #2)

**Date:** 2026-05-05  
**Status:** Approved

## Goal

Replace the runtime `applyMapStyle` patching of `dark-v11` / `light-v11` with two committed JSON style files that bake in all static visual properties. Data-driven layers (highlights, state, arcs, graticule, night overlay) remain as runtime additions.

## Approach

Two style JSON files committed to `public/` and served as static assets by Vercel. Mapbox GL JS accepts a URL string as the `style` option — a relative path like `/meridian-dark.style.json` works identically to a `mapbox://styles/...` URL. No Mapbox Studio account required for hosting; sprites and glyphs still resolve via Mapbox CDN using the existing access token.

Chosen over Studio hosting (same result, fully version-controlled) and over a minimal hand-authored style (avoids authoring the full Mapbox style spec from scratch).

## Section 1 — Style Generation

A one-shot script `scripts/build-meridian-styles.js` fetches `dark-v11` and `light-v11` from the Mapbox Styles API using `VITE_MAPBOX_TOKEN`, applies all customizations in memory, and writes:
- `public/meridian-dark.style.json`
- `public/meridian-light.style.json`

Run once: `node scripts/build-meridian-styles.js`. The script reads `VITE_MAPBOX_TOKEN` from the environment or a `.env` file in the project root (via `dotenv`). Output files are committed. Re-run only when pulling upstream base style updates from Mapbox.

### Modifications applied to both styles

- Remove all layers prefixed `road`, `bridge`, `tunnel`, `ferry`, `poi`, `natural`, `transit`, and the specific IDs `waterway-label` / `water-line-label`. This stops tile fetches for data that is never rendered.
- Add vector source `country-boundaries` (`mapbox://mapbox.country-boundaries-v1`)
- Add `country-borders` line layer on top of `country-boundaries` (`source-layer: country_boundaries`), inserted before the first label layer in the style's `layers` array so borders render beneath all text

### Dark style (`meridian-dark.style.json`)

Starting from `dark-v11`:

| Target | Property | Value |
|--------|----------|-------|
| `land` | `background-color` | `#222534` |
| `country-label` | `text-color` | `#ffffff` |
| `country-label` | `text-halo-color` | `rgba(0,0,0,0.6)` |
| `country-label` | `text-halo-width` | `1.5` |
| `country-label` | `text-size` | `20` |
| `admin-1-*` layers | `visibility` | `visible` |
| `admin-1-*` layers | `line-color` | `rgba(180,190,220,0.2)` |
| `admin-1-*` layers | `line-width` | `0.5` |
| `admin-1-*` layers | zoom range | `3–24` |
| `country-borders` (new) | `line-color` | `rgba(180,190,220,0.6)` |
| `country-borders` (new) | `line-width` | `0.8` |
| `country-borders` (new) | `line-opacity` | `0.6` |

### Light style (`meridian-light.style.json`)

Starting from `light-v11`:

| Target | Property | Value |
|--------|----------|-------|
| `land` | `background-color` | `#F5F2ED` |
| `water` | `fill-color` | `#DCE5EC` |
| `country-label` | `text-color` | `#0A1828` |
| `country-label` | `text-halo-color` | `rgba(245,242,237,0.85)` |
| `country-label` | `text-halo-width` | `1.5` |
| `admin-1-*` layers | `visibility` | `visible` |
| `admin-1-*` layers | `line-color` | `rgba(10,24,40,0.15)` |
| `admin-1-*` layers | `line-width` | `0.5` |
| `admin-1-*` layers | zoom range | `3–24` |
| `country-borders` (new) | `line-color` | `#0A1828` |
| `country-borders` (new) | `line-width` | `0.5` |
| `country-borders` (new) | `line-opacity` | `0.65` |

## Section 2 — Code Changes

### `src/map/kernel.js`

Change the `style` option in the `Map` constructor:
```js
style: isDark ? '/meridian-dark.style.json' : '/meridian-light.style.json',
```

### `src/map/useMeridianMap.js`

Change the style URL in the theme-switch effect:
```js
const newStyle = isDark ? '/meridian-dark.style.json' : '/meridian-light.style.json';
```

### `src/map/layers.js` — `applyMapStyle`

**Remove** these blocks entirely:
- `setPaintProperty('land', 'background-color', ...)` 
- All `setPaintProperty` / `setLayoutProperty` calls on `country-label`
- The `style.layers.forEach` loop patching `admin-1-*` layers (dark variant)
- `setPaintProperty('water', 'fill-color', ...)` (light variant)
- The `style.layers.forEach` loop hiding road/POI/transit layers (light variant)
- `addSource('country-boundaries', ...)` block
- `addLayer('country-borders', ...)` block and its `setPaintProperty` update branch

**Keep** unchanged:
- `setFog` call (stays in code — easy to tweak values without regenerating JSON)
- Night overlay source/layer
- Graticule source/layer
- All six country highlight layers (`country-highlight-glow`, `country-highlight-edge`, `country-highlight-secondary-glow`, `country-highlight-secondary-edge`, `country-highlight-trail-glow`)
- State boundary layers (`state-highlight-glow`, `state-highlight-edge`)
- Arc layers (`arcs-glow`, `arcs-edge`)

The highlight layers share the same try-block as the former `addSource`/`addLayer` calls in `layers.js`. Only the `addSource('country-boundaries')` call and the `country-borders` `addLayer` + its `setPaintProperty` update branch are removed — the rest of the block (highlight layers) is untouched. The `if (!map.getSource('country-boundaries'))` guard before the highlight `addLayer` calls becomes a guaranteed no-op and can be removed.

## Files Changed

| File | Change |
|------|--------|
| `scripts/build-meridian-styles.js` | New — style generation script |
| `package.json` | Add `"build-styles"` script entry |
| `public/meridian-dark.style.json` | New — generated, committed |
| `public/meridian-light.style.json` | New — generated, committed |
| `src/map/kernel.js` | 1 line — style URL |
| `src/map/useMeridianMap.js` | 1 line — theme-switch style URL |
| `src/map/layers.js` | Remove static patches from `applyMapStyle` |
| `docs/map-broadcast-checklist.md` | Mark item #2 complete |

## Success Criteria

- Map visually identical to before on both dark and light themes
- No road, POI, transit, or bridge layers visible on either theme
- Country borders render correctly without being added at runtime
- Theme switching (`setStyle` → `style.load` → `applyMapStyle`) works correctly
- `applyMapStyle` contains no static `setPaintProperty` patches — only fog + data-driven layer additions
- Build passes, no console errors
