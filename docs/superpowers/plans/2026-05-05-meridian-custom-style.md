# Meridian Custom Mapbox Style Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace runtime `applyMapStyle` patching of Mapbox base styles with two committed JSON style files that bake in all static visual properties, leaving only data-driven layers as runtime additions.

**Architecture:** A one-shot Node script fetches `dark-v11` and `light-v11` from the Mapbox Styles API, applies Meridian customizations (land/water color, label styling, admin borders, road/POI removal, country-borders layer), and writes `public/meridian-dark.style.json` and `public/meridian-light.style.json`. `kernel.js` and `useMeridianMap.js` reference these files by relative URL. `applyMapStyle` is slimmed down to fog + data-driven layer additions only.

**Tech Stack:** Node.js (ESM), Mapbox Styles API, Mapbox GL JS, React 19, Vite

---

## File Map

| File | Status | Change |
|------|--------|--------|
| `scripts/build-meridian-styles.js` | Create | Fetches + customizes + writes style JSON |
| `public/meridian-dark.style.json` | Create (generated) | Dark Meridian style |
| `public/meridian-light.style.json` | Create (generated) | Light Meridian style |
| `package.json` | Modify | Add `build-styles` script entry |
| `src/map/kernel.js` | Modify | Style URL → `/meridian-dark.style.json` |
| `src/map/useMeridianMap.js` | Modify | Theme-switch style URL → `/meridian-*.style.json` |
| `src/map/layers.js` | Modify | Remove static patches from `applyMapStyle` |
| `docs/map-broadcast-checklist.md` | Modify | Mark item #2 complete |

---

## Task 1: Style generation script

**Files:**
- Create: `scripts/build-meridian-styles.js`
- Modify: `package.json`

- [ ] **Step 1: Write `scripts/build-meridian-styles.js`**

```js
#!/usr/bin/env node
// One-shot: fetches dark-v11 + light-v11 from Mapbox Styles API,
// applies Meridian customizations, writes to public/.
// Usage: node scripts/build-meridian-styles.js
// Requires VITE_MAPBOX_TOKEN in environment or .env

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Parse .env manually (no dotenv dependency needed)
try {
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([^#=][^=]*)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
} catch {}

const TOKEN = process.env.VITE_MAPBOX_TOKEN;
if (!TOKEN) { console.error('Error: VITE_MAPBOX_TOKEN not set'); process.exit(1); }

const REMOVE_PREFIXES = ['road', 'bridge', 'tunnel', 'ferry', 'poi', 'natural', 'transit'];
const REMOVE_IDS = new Set(['waterway-label', 'water-line-label']);

async function fetchStyle(name) {
  const res = await fetch(`https://api.mapbox.com/styles/v1/mapbox/${name}?access_token=${TOKEN}`);
  if (!res.ok) throw new Error(`Failed to fetch ${name}: ${res.status} ${await res.text()}`);
  return res.json();
}

function stripUnwantedLayers(style) {
  style.layers = style.layers.filter(l =>
    !REMOVE_IDS.has(l.id) && !REMOVE_PREFIXES.some(p => l.id.startsWith(p))
  );
}

function setLayerPaint(style, id, props) {
  const layer = style.layers.find(l => l.id === id);
  if (!layer) { console.warn(`  layer not found: ${id}`); return; }
  layer.paint = { ...(layer.paint || {}), ...props };
}

function setLayerLayout(style, id, props) {
  const layer = style.layers.find(l => l.id === id);
  if (!layer) { console.warn(`  layer not found: ${id}`); return; }
  layer.layout = { ...(layer.layout || {}), ...props };
}

function patchAdmin1(style, paintProps) {
  let count = 0;
  for (const layer of style.layers) {
    if (!layer.id.startsWith('admin-1')) continue;
    layer.layout = { ...(layer.layout || {}), visibility: 'visible' };
    layer.paint = { ...(layer.paint || {}), ...paintProps };
    layer.minzoom = 3;
    layer.maxzoom = 24;
    count++;
  }
  if (count === 0) console.warn('  no admin-1 layers found');
}

function addCountryBordersLayer(style, paintProps) {
  style.sources['country-boundaries'] = {
    type: 'vector',
    url: 'mapbox://mapbox.country-boundaries-v1',
  };
  const bordersLayer = {
    id: 'country-borders',
    type: 'line',
    source: 'country-boundaries',
    'source-layer': 'country_boundaries',
    paint: paintProps,
  };
  // Insert before the first label/symbol layer so borders render beneath all text
  const labelIdx = style.layers.findIndex(l => l.type === 'symbol');
  if (labelIdx >= 0) {
    style.layers.splice(labelIdx, 0, bordersLayer);
  } else {
    style.layers.push(bordersLayer);
  }
}

function buildDark(style) {
  console.log('  Applying dark customizations...');
  stripUnwantedLayers(style);
  setLayerPaint(style, 'land', { 'background-color': '#222534' });
  setLayerPaint(style, 'country-label', {
    'text-color': '#ffffff',
    'text-halo-color': 'rgba(0,0,0,0.6)',
    'text-halo-width': 1.5,
  });
  setLayerLayout(style, 'country-label', { 'text-size': 20 });
  patchAdmin1(style, { 'line-color': 'rgba(180,190,220,0.2)', 'line-width': 0.5 });
  addCountryBordersLayer(style, {
    'line-color': 'rgba(180,190,220,0.6)',
    'line-width': 0.8,
    'line-opacity': 0.6,
  });
}

function buildLight(style) {
  console.log('  Applying light customizations...');
  stripUnwantedLayers(style);
  setLayerPaint(style, 'land', { 'background-color': '#F5F2ED' });
  setLayerPaint(style, 'water', { 'fill-color': '#DCE5EC' });
  setLayerPaint(style, 'country-label', {
    'text-color': '#0A1828',
    'text-halo-color': 'rgba(245,242,237,0.85)',
    'text-halo-width': 1.5,
  });
  patchAdmin1(style, { 'line-color': 'rgba(10,24,40,0.15)', 'line-width': 0.5 });
  addCountryBordersLayer(style, {
    'line-color': '#0A1828',
    'line-width': 0.5,
    'line-opacity': 0.65,
  });
}

async function main() {
  console.log('Fetching base styles from Mapbox...');
  const [dark, light] = await Promise.all([fetchStyle('dark-v11'), fetchStyle('light-v11')]);

  console.log('Building meridian-dark...');
  buildDark(dark);

  console.log('Building meridian-light...');
  buildLight(light);

  const outDir = path.join(ROOT, 'public');
  fs.writeFileSync(path.join(outDir, 'meridian-dark.style.json'), JSON.stringify(dark));
  fs.writeFileSync(path.join(outDir, 'meridian-light.style.json'), JSON.stringify(light));

  console.log('Done:');
  console.log('  public/meridian-dark.style.json');
  console.log('  public/meridian-light.style.json');
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Add `build-styles` to `package.json` scripts**

In `package.json`, add after the last existing script entry:
```json
"build-styles": "node scripts/build-meridian-styles.js"
```

The scripts section should look like:
```json
"scripts": {
  "dev": "concurrently \"node server.js\" \"vite\"",
  "dev:client": "vite",
  "dev:server": "node server.js",
  "build": "vite build",
  "start": "node server.js",
  "build-shotlist": "node scripts/build-shotlist.js",
  "synthesize-narration": "node scripts/synthesize-narration.js",
  "record-clip": "node scripts/record-clip.js",
  "finalize-clip": "node scripts/finalize-clip.js",
  "produce-clip": "node scripts/produce-clip.js",
  "build-styles": "node scripts/build-meridian-styles.js"
},
```

- [ ] **Step 3: Run the script**

```bash
node scripts/build-meridian-styles.js
```

Expected output:
```
Fetching base styles from Mapbox...
Building meridian-dark...
  Applying dark customizations...
Building meridian-light...
  Applying light customizations...
Done:
  public/meridian-dark.style.json
  public/meridian-light.style.json
```

If you see `VITE_MAPBOX_TOKEN not set`, make sure `.env` exists in the project root with `VITE_MAPBOX_TOKEN=pk.eyJ1...`.

- [ ] **Step 4: Verify the generated files**

Create `scripts/verify-styles.js`:

```js
// Run after build-meridian-styles.js to assert key properties in both outputs.
// Usage: node scripts/verify-styles.js
import fs from 'fs';
import assert from 'assert';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dark = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/meridian-dark.style.json'), 'utf8'));
const light = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/meridian-light.style.json'), 'utf8'));

const darkLand = dark.layers.find(l => l.id === 'land');
assert(darkLand?.paint?.['background-color'] === '#222534', 'dark land color');

const darkLabel = dark.layers.find(l => l.id === 'country-label');
assert(darkLabel?.paint?.['text-color'] === '#ffffff', 'dark label color');

assert(dark.layers.find(l => l.id === 'country-borders'), 'dark country-borders layer missing');
assert(dark.sources['country-boundaries'], 'dark country-boundaries source missing');
assert(!dark.layers.find(l => l.id.startsWith('road')), 'dark has road layers (unexpected)');

const lightWater = light.layers.find(l => l.id === 'water');
assert(lightWater?.paint?.['fill-color'] === '#DCE5EC', 'light water color');

const lightLabel = light.layers.find(l => l.id === 'country-label');
assert(lightLabel?.paint?.['text-color'] === '#0A1828', 'light label color');
assert(!light.layers.find(l => l.id.startsWith('road')), 'light has road layers (unexpected)');

function checkBordersPosition(style, name) {
  const bordersIdx = style.layers.findIndex(l => l.id === 'country-borders');
  const firstSymbolIdx = style.layers.findIndex(l => l.type === 'symbol');
  assert(bordersIdx >= 0, `${name}: country-borders missing`);
  assert(firstSymbolIdx < 0 || bordersIdx < firstSymbolIdx, `${name}: country-borders must be before first symbol layer`);
}
checkBordersPosition(dark, 'dark');
checkBordersPosition(light, 'light');

console.log('All assertions passed.');
```

Then run it:

```bash
node scripts/verify-styles.js
```

Expected: `All assertions passed.`

- [ ] **Step 5: Commit**

```bash
git add scripts/build-meridian-styles.js scripts/verify-styles.js package.json public/meridian-dark.style.json public/meridian-light.style.json
git commit -m "feat: add Meridian custom style generation script and output files"
```

---

## Task 2: Point kernel and theme-switch hook at the new style files

**Files:**
- Modify: `src/map/kernel.js:49`
- Modify: `src/map/useMeridianMap.js:158`

- [ ] **Step 1: Update `kernel.js` style URL**

In `src/map/kernel.js`, find:
```js
style: isDark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11',
```
Replace with:
```js
style: isDark ? '/meridian-dark.style.json' : '/meridian-light.style.json',
```

- [ ] **Step 2: Update `useMeridianMap.js` theme-switch URL**

In `src/map/useMeridianMap.js`, find:
```js
const newStyle = isDark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11';
```
Replace with:
```js
const newStyle = isDark ? '/meridian-dark.style.json' : '/meridian-light.style.json';
```

- [ ] **Step 3: Start the dev server and verify the map loads**

```bash
npm run dev
```

Open `http://localhost:5173`. The map should:
- Load and display a globe in dark mode with navy land (`#222534`), no roads or POI visible
- Country borders visible (thin blue-gray lines)
- Country labels white
- Admin-1 (state/province) borders faintly visible

Switch to light mode using the theme toggle. The map should:
- Show warm paper land (`#F5F2ED`), pale blue water (`#DCE5EC`)
- No roads, POI, or transit layers
- Country labels dark navy

If the map shows a blank canvas or a console error like `Failed to load resource: /meridian-dark.style.json`, the file is not being served — confirm `public/meridian-dark.style.json` exists and Vite's dev server is serving the `public/` directory (it does by default).

- [ ] **Step 4: Commit**

```bash
git add src/map/kernel.js src/map/useMeridianMap.js
git commit -m "feat: switch map to Meridian custom style files"
```

---

## Task 3: Simplify `applyMapStyle` — remove static patches

Now that the custom style files bake in the static visual properties, the runtime patches in `applyMapStyle` are redundant. This task removes them.

**Files:**
- Modify: `src/map/layers.js`

The full updated `applyMapStyle` function after all removals is shown in Step 1. Read it carefully — it keeps fog, night overlay, graticule, all highlight layers, state layers, and arc layers, but removes all static property patches and the `country-borders`/`addSource` block.

- [ ] **Step 1: Replace `applyMapStyle` in `src/map/layers.js`**

Replace the entire `applyMapStyle` function (from `export function applyMapStyle` through its closing `}`) with:

```js
export function applyMapStyle(map, isDark) {
  // Fog — kept in code (not in the style file) for easy value tuning.
  try { map.setFog(isDark ? FOG.dark : FOG.light); } catch {}

  // Night-side terminator overlay (item 8) — low-opacity dark fill over
  // the hemisphere where the sun is below the horizon. Seeded with the
  // current time here; useMeridianMap refreshes it every 60 s.
  try {
    const nightBefore = map.getLayer('country-label') ? 'country-label' : undefined;
    const nightData = computeNightPolygon();
    if (!map.getSource('night-overlay')) {
      map.addSource('night-overlay', { type: 'geojson', data: nightData });
    } else {
      map.getSource('night-overlay').setData(nightData);
    }
    if (!map.getLayer('night-overlay')) {
      map.addLayer({
        id: 'night-overlay',
        type: 'fill',
        source: 'night-overlay',
        paint: {
          'fill-color': '#04081a',
          'fill-opacity': isDark ? 0.38 : 0.30,
        },
      }, nightBefore);
    } else {
      map.setPaintProperty('night-overlay', 'fill-opacity', isDark ? 0.38 : 0.30);
    }
  } catch {}

  // Graticule (item 6) — lat/lon gridlines at 15° intervals.
  try {
    const graticuleBefore = map.getLayer('country-label') ? 'country-label' : undefined;
    if (!map.getSource('graticule')) {
      map.addSource('graticule', { type: 'geojson', data: GRATICULE_GEOJSON });
    }
    if (!map.getLayer('graticule')) {
      map.addLayer({
        id: 'graticule',
        type: 'line',
        source: 'graticule',
        paint: {
          'line-color': isDark ? 'rgba(200,215,240,0.13)' : 'rgba(10,24,40,0.08)',
          'line-width': 0.5,
        },
      }, graticuleBefore);
    } else {
      map.setPaintProperty('graticule', 'line-color', isDark ? 'rgba(200,215,240,0.13)' : 'rgba(10,24,40,0.08)');
    }
  } catch {}

  // Country highlight layers (item 3 + item 10) — data-driven, filtered by iso_3166_1.
  // country-boundaries source is provided by the Meridian style; no addSource needed.
  try {
    const pal = PALETTE[isDark ? 'dark' : 'light'];

    if (!map.getLayer('country-highlight-glow')) {
      map.addLayer({
        id: 'country-highlight-glow',
        type: 'line',
        source: 'country-boundaries',
        'source-layer': 'country_boundaries',
        filter: ['==', 'iso_3166_1', ''],
        paint: {
          'line-color': isDark ? '#e8c547' : '#9A7200',
          'line-width': 10,
          'line-blur': 4,
          'line-opacity': isDark ? 0.35 : 0.28,
        },
      });
    } else {
      map.setPaintProperty('country-highlight-glow', 'line-color', isDark ? '#e8c547' : '#9A7200');
      map.setPaintProperty('country-highlight-glow', 'line-opacity', isDark ? 0.35 : 0.28);
    }

    if (!map.getLayer('country-highlight-edge')) {
      map.addLayer({
        id: 'country-highlight-edge',
        type: 'line',
        source: 'country-boundaries',
        'source-layer': 'country_boundaries',
        filter: ['==', 'iso_3166_1', ''],
        paint: {
          'line-color': isDark ? '#e8c547' : '#9A7200',
          'line-width': 1.5,
          'line-opacity': isDark ? 0.90 : 0.80,
        },
      });
    } else {
      map.setPaintProperty('country-highlight-edge', 'line-color', isDark ? '#e8c547' : '#9A7200');
      map.setPaintProperty('country-highlight-edge', 'line-opacity', isDark ? 0.90 : 0.80);
    }

    if (!map.getLayer('country-highlight-secondary-glow')) {
      map.addLayer({
        id: 'country-highlight-secondary-glow',
        type: 'line',
        source: 'country-boundaries',
        'source-layer': 'country_boundaries',
        filter: ['in', 'iso_3166_1', ''],
        paint: {
          'line-color': pal.secondary,
          'line-width': 8,
          'line-blur': 4,
          'line-opacity': isDark ? 0.28 : 0.22,
        },
      });
    } else {
      map.setPaintProperty('country-highlight-secondary-glow', 'line-color', pal.secondary);
      map.setPaintProperty('country-highlight-secondary-glow', 'line-opacity', isDark ? 0.28 : 0.22);
    }

    if (!map.getLayer('country-highlight-secondary-edge')) {
      map.addLayer({
        id: 'country-highlight-secondary-edge',
        type: 'line',
        source: 'country-boundaries',
        'source-layer': 'country_boundaries',
        filter: ['in', 'iso_3166_1', ''],
        paint: {
          'line-color': pal.secondary,
          'line-width': 1.2,
          'line-opacity': isDark ? 0.65 : 0.55,
        },
      });
    } else {
      map.setPaintProperty('country-highlight-secondary-edge', 'line-color', pal.secondary);
      map.setPaintProperty('country-highlight-secondary-edge', 'line-opacity', isDark ? 0.65 : 0.55);
    }

    if (!map.getLayer('country-highlight-trail-glow')) {
      map.addLayer({
        id: 'country-highlight-trail-glow',
        type: 'line',
        source: 'country-boundaries',
        'source-layer': 'country_boundaries',
        filter: ['==', 'iso_3166_1', ''],
        paint: {
          'line-color': pal.trail,
          'line-width': 8,
          'line-blur': 5,
          'line-opacity': isDark ? 0.18 : 0.14,
        },
      });
    } else {
      map.setPaintProperty('country-highlight-trail-glow', 'line-color', pal.trail);
      map.setPaintProperty('country-highlight-trail-glow', 'line-opacity', isDark ? 0.18 : 0.14);
    }
  } catch {}

  // State/region boundary layers — GeoJSON, same glow+edge treatment as country highlight.
  try {
    if (!map.getSource('state-boundary')) {
      map.addSource('state-boundary', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }
    if (!map.getLayer('state-highlight-glow')) {
      map.addLayer({
        id: 'state-highlight-glow',
        type: 'line',
        source: 'state-boundary',
        paint: {
          'line-color': isDark ? '#e8c547' : '#9A7200',
          'line-width': 10,
          'line-blur': 4,
          'line-opacity': isDark ? 0.35 : 0.28,
        },
      });
    } else {
      map.setPaintProperty('state-highlight-glow', 'line-color', isDark ? '#e8c547' : '#9A7200');
      map.setPaintProperty('state-highlight-glow', 'line-opacity', isDark ? 0.35 : 0.28);
    }
    if (!map.getLayer('state-highlight-edge')) {
      map.addLayer({
        id: 'state-highlight-edge',
        type: 'line',
        source: 'state-boundary',
        paint: {
          'line-color': isDark ? '#e8c547' : '#9A7200',
          'line-width': 1.5,
          'line-opacity': isDark ? 0.90 : 0.80,
        },
      });
    } else {
      map.setPaintProperty('state-highlight-edge', 'line-color', isDark ? '#e8c547' : '#9A7200');
      map.setPaintProperty('state-highlight-edge', 'line-opacity', isDark ? 0.90 : 0.80);
    }
  } catch {}

  // Source-to-story arc layers (item 9) — empty on init; updateArcs() fills them.
  try {
    const arcsBefore = map.getLayer('country-label') ? 'country-label' : undefined;
    if (!map.getSource('arcs')) {
      map.addSource('arcs', {
        type: 'geojson',
        lineMetrics: true,
        data: { type: 'FeatureCollection', features: [] },
      });
    }
    if (!map.getLayer('arcs-glow')) {
      map.addLayer({
        id: 'arcs-glow',
        type: 'line',
        source: 'arcs',
        layout: { 'line-cap': 'round' },
        paint: {
          'line-color': isDark ? '#e8c547' : '#9A7200',
          'line-width': 5,
          'line-blur': 3,
          'line-opacity': isDark ? 0.28 : 0.22,
        },
      }, arcsBefore);
    } else {
      map.setPaintProperty('arcs-glow', 'line-color', isDark ? '#e8c547' : '#9A7200');
      map.setPaintProperty('arcs-glow', 'line-opacity', isDark ? 0.28 : 0.22);
    }
    if (!map.getLayer('arcs-edge')) {
      map.addLayer({
        id: 'arcs-edge',
        type: 'line',
        source: 'arcs',
        layout: { 'line-cap': 'round' },
        paint: {
          'line-color': isDark ? '#e8c547' : '#9A7200',
          'line-width': 1.2,
          'line-opacity': isDark ? 0.70 : 0.55,
        },
      }, arcsBefore);
    } else {
      map.setPaintProperty('arcs-edge', 'line-color', isDark ? '#e8c547' : '#9A7200');
      map.setPaintProperty('arcs-edge', 'line-opacity', isDark ? 0.70 : 0.55);
    }
  } catch {}
}
```

- [ ] **Step 2: Verify the dev server still works**

The dev server from Task 2 Step 3 should still be running. Hard-refresh (`Ctrl+Shift+R`) the page and confirm:

- Dark mode: globe loads, navy land, country borders visible, no roads/POI, graticule grid lines faintly visible, ambient rotation active
- Light mode (toggle theme): warm paper land, pale blue water, no roads/POI, dark navy labels
- Click a story card: map flies to the story location, pulse marker appears, country highlight glow renders
- Theme switch while a story is focused: map reloads with correct theme, highlight re-renders on the focused country

Check the browser console for errors. Common issue: `The layer 'country-highlight-glow' references source 'country-boundaries' which does not exist in the map's style` — this means the style file didn't include the `country-boundaries` source. Re-run `node scripts/build-meridian-styles.js` and verify the source is in the JSON.

- [ ] **Step 3: Commit**

```bash
git add src/map/layers.js
git commit -m "refactor: remove static applyMapStyle patches — now baked into Meridian style files"
```

---

## Task 4: Mark checklist item #2 complete and final commit

**Files:**
- Modify: `docs/map-broadcast-checklist.md`

- [ ] **Step 1: Update the checklist**

In `docs/map-broadcast-checklist.md`, find:
```markdown
- [ ] **2. Author a custom Mapbox style and stop patching `dark-v11` at runtime**
```
Replace with:
```markdown
- [x] **2. Author a custom Mapbox style and stop patching `dark-v11` at runtime**
  - Two JSON style files committed to `public/` (`meridian-dark.style.json`, `meridian-light.style.json`), generated by `scripts/build-meridian-styles.js` from the Mapbox Styles API. Road/POI/transit layers stripped; `country-boundaries` source and `country-borders` layer baked in. `applyMapStyle` now contains only fog + data-driven layer additions. Style URLs referenced in `kernel.js` and `useMeridianMap.js`.
```

Also update the status line near the top of the file from `21 / 23 complete` to `22 / 23 complete` and update the date.

- [ ] **Step 2: Commit**

```bash
git add docs/map-broadcast-checklist.md
git commit -m "docs: mark checklist item #2 complete"
```
