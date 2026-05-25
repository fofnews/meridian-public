# Design: Map Hero — State & Province Boundaries

**Date:** 2026-04-28
**File:** `meridian-public/src/components/BroadcastHero.jsx`

## Goal

Add sub-national (state/province) boundary lines and a gold highlight for the story's location to the BroadcastHero map, matching the existing country highlight treatment.

## Approach

Approach 1 — Nominatim GeoJSON overlay + admin-1 lines from base Mapbox style.

- Nominatim already used for geocoding; extend calls to also fetch boundary polygons
- Boundary polygon rendered as a custom GeoJSON source on the Mapbox map
- Admin-1 lines from the base Mapbox style made visible (currently suppressed in light mode)
- No new APIs, no extra cost, works worldwide

## Section 1 — Boundary Polygon Fetching

New function `fetchBoundaryPolygon(name, iso)`:
- Calls Nominatim with `polygon_geojson=1&polygon_threshold=0.005`
- Searches by location name + country ISO (e.g. "Texas" + "US")
- Returns the GeoJSON geometry of the first result, or `null` if none
- `polygon_threshold=0.005` simplifies large state polygons to keep payload small
- Result cached in `geocodeCache` alongside the existing lat/lng entry — no duplicate Nominatim calls

Fallback: if Nominatim returns no polygon (point result, country-level fallback), returns `null` and state highlight is silently skipped. Country highlight remains active.

## Section 2 — Map Layer Architecture

### Admin-1 border lines

In `applyMapStyle(map, isDark)`:
- Remove `id.startsWith('admin-1')` from the hidden-layers list in light mode
- Instead, restyle admin-1 layers explicitly in both modes:
  - Dark: `rgba(180,190,220,0.2)`, 0.5px width
  - Light: `rgba(10,24,40,0.15)`, 0.5px width
- Set `minzoom: 3` on each admin-1 layer — lines invisible at world view, appear on zoom-in

### State highlight layers

Added on map load, above existing `country-highlight`/`country-borders` layers:

| Layer ID | Type | Source | Style |
|---|---|---|---|
| `state-highlight` | fill | `state-boundary` (GeoJSON) | Gold fill, dark: opacity 0.18, light: 0.13 |
| `state-border` | line | `state-boundary` (GeoJSON) | Gold stroke, 1px |

The `state-boundary` GeoJSON source is initialized as an empty `FeatureCollection` on map load and updated via `setData()` on each story change.

On theme switch, `setStyle` wipes all custom layers. `applyMapStyle` re-adds them on `style.load` — same pattern used for existing `country-highlight`/`country-borders`. Current polygon is preserved in a `currentPolygonRef` and reapplied after reload.

## Section 3 — Story Change Flow

`flyToLocation(loc)` gains an optional `polygon` field:
- If `loc.polygon` present: `map.getSource('state-boundary').setData(loc.polygon)`
- If absent: clear source with empty FeatureCollection

**Structured locations path** (`featured.analysis.locations`):
- `fetchBoundaryPolygon` called per location on story load
- Result cached on the location object
- Active location's polygon passed into `flyToLocation` on story change or location button click

**Fallback geocode path** (`geocodeStory`):
- Extended to also call `fetchBoundaryPolygon` and store result on cached entry
- Polygon passed into `flyToLocation` alongside lat/lng

## Zoom Behavior

- Admin-1 lines: `minzoom: 3` — not visible at world view (zoom ~1), appear when zoomed to a story (zoom 4–5)
- State highlight fill: no minzoom — polygon is naturally small/invisible at world zoom, becomes meaningful at story zoom

## Files Changed

- `meridian-public/src/components/BroadcastHero.jsx` — only file modified

## Future Upgrade Path (Approach 3)

If Mapbox Enterprise becomes available, Approach 3 replaces the Nominatim GeoJSON overlay with `mapbox://mapbox.boundaries-adm1-v4` vector tiles filtered by `name_en`. Visual output is identical. Advantage: no external API call, exact name matching, Mapbox-managed boundary accuracy.
