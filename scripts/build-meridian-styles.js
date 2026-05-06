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
  for (const line of env.split(/\r?\n/)) {
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
  delete style.fog;  // fog is set at runtime by applyMapStyle; not baked into the style file
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
  delete style.fog;  // fog is set at runtime by applyMapStyle; not baked into the style file
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
