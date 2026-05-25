# Map Hero — State & Province Boundaries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show sub-national (state/province) boundary lines on the BroadcastHero map and highlight the story's location state/province in gold, matching the existing country highlight treatment.

**Architecture:** Extend `applyMapStyle` to show admin-1 lines from the base Mapbox style (visible at zoom ≥ 3) and add a `state-boundary` GeoJSON source updated per story. Nominatim's `polygon_geojson=1` parameter fetches boundary polygons alongside existing geocoding, cached in `geocodeCache`. `flyToLocation` gains a `polygon` field and writes it to the GeoJSON source.

**Tech Stack:** Mapbox GL JS, Nominatim geocoding API (already in use), React refs, GeoJSON

---

## File Map

| File | Change |
|---|---|
| `meridian-public/src/components/BroadcastHero.jsx` | All changes — only file modified |

---

### Task 1: Add `fetchBoundaryPolygon` and update `geocodeStory`

**Files:**
- Modify: `meridian-public/src/components/BroadcastHero.jsx`

- [ ] **Step 1: Add `fetchBoundaryPolygon` directly before `geocodeStory` (~line 55)**

  Insert this function between `SKIP_WORDS`/`extractLocationQuery` and `geocodeStory`:

  ```js
  async function fetchBoundaryPolygon(name, iso) {
    if (!name) return null;
    const cacheKey = `poly:${name}:${iso ?? ''}`;
    if (geocodeCache[cacheKey] !== undefined) return geocodeCache[cacheKey];

    try {
      const q = iso ? `${name}, ${iso}` : name;
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&polygon_geojson=1&polygon_threshold=0.005`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en', 'User-Agent': 'TheMeridian/1.0' } });
      const data = await res.json();
      if (data.length) {
        const geojson = data[0].geojson;
        if (geojson && (geojson.type === 'Polygon' || geojson.type === 'MultiPolygon')) {
          const polygon = { type: 'Feature', geometry: geojson, properties: {} };
          geocodeCache[cacheKey] = polygon;
          return polygon;
        }
      }
    } catch (e) {
      console.warn('Boundary fetch failed:', e);
    }
    geocodeCache[cacheKey] = null;
    return null;
  }
  ```

- [ ] **Step 2: Update `geocodeStory` to fetch polygon in the same Nominatim call**

  Replace the entire `geocodeStory` function (currently ~lines 55–80) with:

  ```js
  async function geocodeStory(story) {
    if (geocodeCache[story.id]) return geocodeCache[story.id];

    const fallback = { lng: 0, lat: 20, zoom: 1.0, polygon: null };
    const locationQuery = extractLocationQuery(story.headline);
    if (!locationQuery) {
      geocodeCache[story.id] = fallback;
      return fallback;
    }

    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationQuery)}&format=json&limit=1&polygon_geojson=1&polygon_threshold=0.005`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en', 'User-Agent': 'TheMeridian/1.0' } });
      const data = await res.json();
      if (data.length) {
        const geojson = data[0].geojson;
        const polygon = (geojson && (geojson.type === 'Polygon' || geojson.type === 'MultiPolygon'))
          ? { type: 'Feature', geometry: geojson, properties: {} }
          : null;
        const result = { lng: parseFloat(data[0].lon), lat: parseFloat(data[0].lat), zoom: getStoryZoom(), polygon };
        geocodeCache[story.id] = result;
        return result;
      }
    } catch (e) {
      console.warn('Geocoding failed:', e);
    }

    geocodeCache[story.id] = fallback;
    return fallback;
  }
  ```

- [ ] **Step 3: Verify the dev server still compiles**

  ```bash
  cd C:/Users/Daniel/meridian-public && npm run dev
  ```

  Expected: Vite compiles with no errors. Browser shows the map as before (no visual change yet).

- [ ] **Step 4: Commit**

  ```bash
  git -C C:/Users/Daniel/meridian-public add src/components/BroadcastHero.jsx
  git -C C:/Users/Daniel/meridian-public commit -m "feat: add fetchBoundaryPolygon, include polygon in geocodeStory result"
  ```

---

### Task 2: Add `currentPolygonRef` and update `flyToLocation` + pending-fly handler

**Files:**
- Modify: `meridian-public/src/components/BroadcastHero.jsx`

- [ ] **Step 1: Add `currentPolygonRef` alongside the other refs (~line 244)**

  In the `BroadcastHero` component, after `const pendingFlyRef = useRef(null);`, add:

  ```js
  const currentPolygonRef = useRef(null);
  ```

- [ ] **Step 2: Update `flyToLocation` to write the polygon to the GeoJSON source**

  Replace the entire `flyToLocation` function (~lines 400–417) with:

  ```js
  const flyToLocation = (loc) => {
    if (!mapRef.current) {
      pendingFlyRef.current = loc;
      return;
    }
    const map = mapRef.current;
    const go = () => {
      map.flyTo({ center: [loc.lng, loc.lat], zoom: loc.zoom ?? getStoryZoom(), duration: 2000, essential: true });
      markerRef.current?.setLngLat([loc.lng, loc.lat]);
      if (map.getLayer('country-highlight')) {
        map.setFilter('country-highlight', ['==', 'iso_3166_1', loc.iso ?? '']);
      }
      currentPolygonRef.current = loc.polygon ?? null;
      if (map.getSource('state-boundary')) {
        map.getSource('state-boundary').setData(
          loc.polygon ?? { type: 'FeatureCollection', features: [] }
        );
      }
    };
    if (map.loaded()) go(); else map.once('load', go);
  };
  ```

- [ ] **Step 3: Update the pending-fly handler inside the map init `useEffect`**

  Inside the `loadMapbox().then(...)` block, find the `if (pendingFlyRef.current)` section (~lines 302–314) and replace it with:

  ```js
  if (pendingFlyRef.current) {
    const loc = pendingFlyRef.current;
    pendingFlyRef.current = null;
    const go = () => {
      map.flyTo({ center: [loc.lng, loc.lat], zoom: loc.zoom ?? getStoryZoom(), duration: 2000, essential: true });
      marker.setLngLat([loc.lng, loc.lat]);
      if (map.getLayer('country-highlight')) {
        map.setFilter('country-highlight', ['==', 'iso_3166_1', loc.iso ?? '']);
      }
      currentPolygonRef.current = loc.polygon ?? null;
      if (map.getSource('state-boundary')) {
        map.getSource('state-boundary').setData(
          loc.polygon ?? { type: 'FeatureCollection', features: [] }
        );
      }
    };
    if (map.loaded()) go(); else map.once('load', go);
  }
  ```

- [ ] **Step 4: Verify the dev server still compiles with no errors**

  ```bash
  cd C:/Users/Daniel/meridian-public && npm run dev
  ```

  Expected: compiles cleanly, map behaviour unchanged (state-boundary source doesn't exist yet so getSource returns undefined — the `if` guard prevents errors).

- [ ] **Step 5: Commit**

  ```bash
  git -C C:/Users/Daniel/meridian-public add src/components/BroadcastHero.jsx
  git -C C:/Users/Daniel/meridian-public commit -m "feat: currentPolygonRef, flyToLocation writes state polygon to GeoJSON source"
  ```

---

### Task 3: Update `applyMapStyle` — admin-1 lines + state-boundary layers

**Files:**
- Modify: `meridian-public/src/components/BroadcastHero.jsx`

- [ ] **Step 1: In light mode — restyle admin-1 layers instead of hiding them**

  In `applyMapStyle`, inside the light mode `else` block, find the `style.layers.forEach` loop. The loop currently hides layers via `setLayoutProperty(id, 'visibility', 'none')`. Change the `if` condition and add an `admin-1` branch before the hide block:

  ```js
  style.layers.forEach((layer) => {
    const id = layer.id;
    if (id.startsWith('admin-1')) {
      try {
        map.setLayoutProperty(id, 'visibility', 'visible');
        map.setPaintProperty(id, 'line-color', 'rgba(10,24,40,0.15)');
        map.setPaintProperty(id, 'line-width', 0.5);
        map.setLayerZoomRange(id, 3, 24);
      } catch {}
      return;
    }
    if (
      id.startsWith('road') ||
      id.startsWith('bridge') ||
      id.startsWith('tunnel') ||
      id.startsWith('ferry') ||
      id.startsWith('poi') ||
      id.startsWith('natural') ||
      id.startsWith('transit') ||
      id === 'waterway-label' ||
      id === 'water-line-label'
    ) {
      try { map.setLayoutProperty(id, 'visibility', 'none'); } catch {}
    }
  });
  ```

- [ ] **Step 2: In dark mode — restyle admin-1 layers consistently**

  In `applyMapStyle`, inside the `if (isDark)` block, after the existing `country-label` styling, add:

  ```js
  try {
    const style = map.getStyle();
    if (style && style.layers) {
      style.layers.forEach(layer => {
        if (layer.id.startsWith('admin-1')) {
          try {
            map.setPaintProperty(layer.id, 'line-color', 'rgba(180,190,220,0.2)');
            map.setPaintProperty(layer.id, 'line-width', 0.5);
            map.setLayerZoomRange(layer.id, 3, 24);
          } catch {}
        }
      });
    }
  } catch {}
  ```

- [ ] **Step 3: Add `state-boundary` source and `state-highlight`/`state-border` layers**

  In `applyMapStyle`, inside the existing large `try` block that adds `country-boundaries` source and `country-highlight`/`country-borders` layers (~lines 186–226), append after the `country-borders` block:

  ```js
  if (!map.getSource('state-boundary')) {
    map.addSource('state-boundary', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  }
  if (!map.getLayer('state-highlight')) {
    map.addLayer({
      id: 'state-highlight',
      type: 'fill',
      source: 'state-boundary',
      paint: {
        'fill-color': isDark ? '#e8c547' : '#9A7200',
        'fill-opacity': isDark ? 0.18 : 0.13,
      },
    });
  } else {
    map.setPaintProperty('state-highlight', 'fill-color', isDark ? '#e8c547' : '#9A7200');
    map.setPaintProperty('state-highlight', 'fill-opacity', isDark ? 0.18 : 0.13);
  }
  if (!map.getLayer('state-border')) {
    map.addLayer({
      id: 'state-border',
      type: 'line',
      source: 'state-boundary',
      paint: {
        'line-color': isDark ? 'rgba(232,197,71,0.7)' : '#9A7200',
        'line-width': 1,
        'line-opacity': isDark ? 0.7 : 0.65,
      },
    });
  } else {
    map.setPaintProperty('state-border', 'line-color', isDark ? 'rgba(232,197,71,0.7)' : '#9A7200');
    map.setPaintProperty('state-border', 'line-opacity', isDark ? 0.7 : 0.65);
  }
  ```

- [ ] **Step 4: Verify in browser — admin-1 lines appear on zoom-in**

  Open `http://localhost:5174`. Zoom in on any country to zoom level 3+. You should see thin, subtle state/province border lines. In light mode they should be near-invisible dark lines; in dark mode faint blue-grey. No gold highlight yet (polygon data not wired up yet).

- [ ] **Step 5: Commit**

  ```bash
  git -C C:/Users/Daniel/meridian-public add src/components/BroadcastHero.jsx
  git -C C:/Users/Daniel/meridian-public commit -m "feat: admin-1 lines visible at zoom 3+, state-boundary GeoJSON source and layers"
  ```

---

### Task 4: Reapply polygon after theme switch

**Files:**
- Modify: `meridian-public/src/components/BroadcastHero.jsx`

- [ ] **Step 1: Update the `onStyleLoad` callback in the `isDark` `useEffect`**

  Find the `isDark` useEffect (~line 360). It creates an `onStyleLoad` callback that calls `applyMapStyle`. Replace that callback with:

  ```js
  const onStyleLoad = () => {
    styleLoadCallbackRef.current = null;
    applyMapStyle(map, pendingIsDarkRef.current);
    if (currentPolygonRef.current && map.getSource('state-boundary')) {
      map.getSource('state-boundary').setData(currentPolygonRef.current);
    }
  };
  ```

- [ ] **Step 2: Verify theme switch preserves the state highlight**

  In the browser, load a story with a visible state highlight (Task 5 must be done first — skip this verification step until after Task 5, then come back to it). Toggle dark/light mode. The gold state polygon should reappear after the style reloads.

- [ ] **Step 3: Commit**

  ```bash
  git -C C:/Users/Daniel/meridian-public add src/components/BroadcastHero.jsx
  git -C C:/Users/Daniel/meridian-public commit -m "feat: reapply state polygon after theme switch style reload"
  ```

---

### Task 5: Wire up polygon to story changes and location buttons

**Files:**
- Modify: `meridian-public/src/components/BroadcastHero.jsx`

- [ ] **Step 1: Update the story-change `useEffect` to fetch and pass the polygon**

  Find the `useEffect` that depends on `[selectedIdx]` (~lines 421–429):

  ```js
  useEffect(() => {
    if (!featured) return;
    setActiveLocIdx(0);
    if (featuredLocations.length > 0) {
      flyToLocation(featuredLocations[0]);
    } else {
      geocodeStory(featured).then((coords) => flyToLocation(coords));
    }
  }, [selectedIdx]);
  ```

  Replace with:

  ```js
  useEffect(() => {
    if (!featured) return;
    setActiveLocIdx(0);
    if (featuredLocations.length > 0) {
      const loc = featuredLocations[0];
      fetchBoundaryPolygon(loc.name, loc.iso).then(polygon => {
        flyToLocation({ ...loc, polygon });
      });
    } else {
      geocodeStory(featured).then((coords) => flyToLocation(coords));
    }
  }, [selectedIdx]);
  ```

- [ ] **Step 2: Update location buttons to pass polygon on click**

  Find the location buttons JSX (~lines 625–644). The `onClick` currently calls `flyToLocation(loc)` directly. Replace it with:

  ```jsx
  onClick={() => {
    setActiveLocIdx(i);
    fetchBoundaryPolygon(loc.name, loc.iso).then(polygon => {
      flyToLocation({ ...loc, polygon });
    });
  }}
  ```

- [ ] **Step 3: Verify state highlight in browser — structured locations path**

  Open `http://localhost:5174`. Select a story whose `analysis.locations` includes a named state or region (e.g. a US domestic story with "Texas" or "California"). The map should fly to that location and show:
  - Thin admin-1 border lines across the country (zoom ≥ 3)
  - A gold-filled polygon over the story's state/province
  - A gold border on that polygon

  Click a second location button if present — the highlight should update to the new location.

- [ ] **Step 4: Verify fallback geocode path**

  Select a story with no `analysis.locations` entries (or clear ones). The map should fly to a geocoded position from the headline. If Nominatim returns a polygon for that location it will highlight; if it returns a point result, no polygon appears and no error is thrown.

- [ ] **Step 5: Return to Task 4 Step 2 — verify theme switch preserves highlight**

  With a state polygon visible, toggle dark/light mode. The polygon should reappear after the ~500ms style reload. Admin-1 lines should also re-render at the correct opacity for the new theme.

- [ ] **Step 6: Commit**

  ```bash
  git -C C:/Users/Daniel/meridian-public add src/components/BroadcastHero.jsx
  git -C C:/Users/Daniel/meridian-public commit -m "feat: state/province highlight wired to story changes and location buttons"
  ```

- [ ] **Step 7: Push to meridian-public**

  ```bash
  git -C C:/Users/Daniel/meridian-public push
  ```

  Expected: Vercel deploys automatically. Check Vercel dashboard for build success.
