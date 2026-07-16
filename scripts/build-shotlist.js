#!/usr/bin/env node
// Shot-list generator (item 14).
//
// Reads a Meridian edition report and emits a timed shot-list JSON that
// the browser player (item 15) and headless recorder (item 16) consume.
//
// Usage:
//   node scripts/build-shotlist.js --edition=2026-04-30-evening
//   node scripts/build-shotlist.js --edition=2026-04-30-evening --max-duration=120
//   node scripts/build-shotlist.js --edition=2026-04-30-evening --aspect=9:16
//
// Output: out/shotlists/<edition>.json

import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildArcsGeoJSON } from '../src/map/arcs.js';
import { SOURCE_COORDS } from '../src/map/sources.js';
import { SOURCE_LEANS } from '../remotion/src/source-leans.js';
import { buildCameraPath as buildRecipeCameraPath, buildGlobeSpinPath } from './shot-recipes.js';
import { classifyShotIntent } from './intent-classifier.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── Polygon cache ─────────────────────────────────────────────────────────────
// Persisted across editions at out/polygons-cache.json.
// Key: `${name}|${iso}` → GeoJSON Feature or null (null = Nominatim had nothing usable).

const POLYGON_CACHE_PATH = join(ROOT, 'out', 'polygons-cache.json');
let polygonCache = {};
try {
  polygonCache = JSON.parse(readFileSync(POLYGON_CACHE_PATH, 'utf8'));
} catch {}

const NOMINATIM_DELAY_MS = 1100; // honor 1 req/s Nominatim policy
let lastNominatimCall = 0;

async function fetchBoundaryPolygon(name, iso) {
  const key = `${name}|${iso ?? ''}`;
  if (Object.prototype.hasOwnProperty.call(polygonCache, key)) return polygonCache[key];

  // Rate-limit: wait if last call was < NOMINATIM_DELAY_MS ago.
  const now = Date.now();
  const wait = NOMINATIM_DELAY_MS - (now - lastNominatimCall);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastNominatimCall = Date.now();

  const q = iso ? `${name}, ${iso}` : name;
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&polygon_geojson=1&polygon_threshold=0.005`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MeridianBroadcast/1.0 (news broadcast renderer; contact: meridian@fofnews.com)' },
    });
    if (!res.ok) { console.warn(`Nominatim ${res.status} for "${name}"`); polygonCache[key] = null; return null; }
    const data = await res.json();
    if (!data[0]?.geojson) { polygonCache[key] = null; return null; }
    const feature = { type: 'Feature', geometry: data[0].geojson, properties: {} };
    polygonCache[key] = feature;
    console.log(`  Polygon fetched: ${name} (${data[0].geojson.type})`);
    return feature;
  } catch (e) {
    console.warn(`Nominatim fetch failed for "${name}": ${e.message}`);
    polygonCache[key] = null;
    return null;
  }
}

function savePolygonCache() {
  mkdirSync(join(ROOT, 'out'), { recursive: true });
  writeFileSync(POLYGON_CACHE_PATH, JSON.stringify(polygonCache, null, 2));
}

// ── CLI args ─────────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, v = 'true'] = a.slice(2).split('='); return [k, v]; })
);

const edition      = args['edition'];
const maxDuration  = Number(args['max-duration'] ?? 360);
const aspect       = args['aspect'] ?? '16:9';
const timingsPath    = args['timings']         ?? null;
const broadcastFilePath = args['broadcast-file'] ?? null;
const noAnchored   = args['no-anchored'] === 'true';
const debugAnchors = args['debug-anchors'] === 'true';
const leadTime     = args['lead-time'] != null ? parseFloat(args['lead-time']) : null;
const minDwell     = args['min-dwell'] != null ? parseFloat(args['min-dwell']) : null;

if (!edition) {
  console.error('Usage: node scripts/build-shotlist.js --edition=YYYY-MM-DD-{morning|evening}');
  process.exit(1);
}

// ── Load report ───────────────────────────────────────────────────────────────

const reportPath = join(ROOT, 'reports', `${edition}.json`);
let report;
try {
  report = JSON.parse(readFileSync(reportPath, 'utf8'));
} catch {
  console.error(`Report not found: ${reportPath}`);
  process.exit(1);
}

// ── Load broadcast script (pipeline-generated narrations) ────────────────────
// Priority: --timings > broadcast file > buildNarration() fallback.
// The broadcast file is produced by the Meridian-Website pipeline prompt.
// To change the narration template, edit the prompt there.
//
// Location resolved as: BROADCASTS_DIR env var, or the sibling pipeline dir.

const broadcastsDir = process.env.BROADCASTS_DIR
  ?? join(ROOT, '..', 'my-news-analyzer-pipeline', 'broadcasts');
const broadcastPath = join(broadcastsDir, `${edition}.json`);
let broadcast = null;
if (!timingsPath) {
  try {
    broadcast = JSON.parse(readFileSync(broadcastPath, 'utf8'));
    console.log(`Using broadcast script: ${broadcastPath}`);
  } catch {
    console.log('No broadcast file found — falling back to buildNarration()');
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CHYRON_LABELS = ['Breaking', 'Developing', 'Analysis', 'Report', 'Update', 'Exclusive'];
const KNOWN_SOURCES_COUNT = Object.keys(SOURCE_COORDS).length; // total outlets with known HQ

// ── Viz data helpers ──────────────────────────────────────────────────────────

// Returns per-source article count for a story, e.g. { 'AP News': 3, 'Reuters': 2 }.
function sourceCounts(story) {
  const counts = {};
  for (const a of (story.articles ?? [])) {
    if (a.source) counts[a.source] = (counts[a.source] ?? 0) + 1;
  }
  return counts;
}

// Builds the viz block for a story shot. Includes:
//   kind     — 'choropleth' when ≥4 sources cover the story, null otherwise.
//   counts   — per-source article counts (used by SourceCompareBar in Broadcast.jsx).
//              Stored here rather than in shot.overlays because synthesize-narration.js
//              overwrites shot.overlays after TTS. viz.data is never touched post-build.
function buildStoryViz(story, isoCode) {
  if (!story) return null;
  const counts = sourceCounts(story);
  const numSources = Object.keys(counts).length;
  if (!isoCode || numSources === 0) return null;
  const ratio = numSources / KNOWN_SOURCES_COUNT;
  return {
    kind: numSources >= 4 ? 'choropleth' : null,
    data: { isoCode, ratio, counts },
  };
}

// Builds the heatmap viz for intro/outro globe shots from all story locations.
function buildHeatmapViz(stories) {
  const points = [];
  for (const story of (stories ?? [])) {
    const locs = (story.analysis?.locations ?? []).filter(l => l?.lat != null && l?.lng != null);
    for (const loc of locs) {
      if (loc.iso !== 'XX' && !(Math.abs(loc.lat) < 0.5 && Math.abs(loc.lng) < 0.5)) {
        points.push([loc.lng, loc.lat]);
      }
    }
    // Also add source HQ points weighted by article count.
    for (const src of Object.keys(sourceCounts(story))) {
      const hq = SOURCE_COORDS[src];
      if (hq) points.push([hq.lng, hq.lat]);
    }
  }
  if (points.length === 0) return null;
  return { kind: 'heatmap', data: { points } };
}
const PITCH              = 50;    // FOCUSED_PITCH_BROADCAST
const BEARING            = -10;   // fixed bearing for all story waypoints (no drift)
const TTS_CHARS_PER_SEC  = 15;
const MIN_HOLD           = 4;
const MAX_HOLD           = 120;   // safety ceiling; synthesis rewrites with measured audio duration
const MAX_NARRATION_CHARS = 900;  // ~60 s at TTS pace

// Zoom tiers. 'Large country' covers nations wide enough that zoom 4 is needed
// to fit them in frame; 'small country' and US states fit at zoom 6; cities
// and specific locations default to zoom 9.
const LARGE_COUNTRY_NAMES = new Set([
  'United States', 'Russia', 'China', 'Canada', 'Brazil', 'Australia', 'India',
  'Argentina', 'Kazakhstan', 'Algeria', 'Democratic Republic of the Congo',
  'Saudi Arabia', 'Mexico', 'Indonesia', 'Sudan', 'Libya', 'Iran', 'Mongolia',
  'Peru', 'Chad', 'Niger', 'Angola', 'Mali', 'South Africa', 'Colombia',
  'Ethiopia', 'Bolivia', 'Mauritania', 'Egypt', 'Tanzania', 'Nigeria',
  'Venezuela', 'Pakistan', 'Namibia', 'Mozambique', 'Turkey', 'Chile',
  'Zambia', 'Myanmar', 'Afghanistan',
]);
const COUNTRY_OR_STATE_NAMES = new Set([
  // Countries
  'France', 'Germany', 'United Kingdom', 'Italy', 'Spain', 'Japan', 'South Korea',
  'Ukraine', 'Poland', 'Sweden', 'Norway', 'Finland', 'Denmark', 'Netherlands',
  'Belgium', 'Austria', 'Switzerland', 'Portugal', 'Greece', 'Romania', 'Hungary',
  'Czech Republic', 'Slovakia', 'Bulgaria', 'Serbia', 'Croatia', 'Albania',
  'Slovenia', 'Kosovo', 'Belarus', 'Moldova', 'Estonia', 'Latvia', 'Lithuania',
  'Israel', 'Iraq', 'Syria', 'Jordan', 'Lebanon', 'Yemen', 'Oman',
  'United Arab Emirates', 'UAE', 'Kuwait', 'Qatar', 'Bahrain',
  'Georgia', 'Armenia', 'Azerbaijan', 'Uzbekistan', 'Kyrgyzstan', 'Tajikistan',
  'Turkmenistan', 'Cuba', 'Haiti', 'Dominican Republic', 'Guatemala', 'Honduras',
  'El Salvador', 'Nicaragua', 'Costa Rica', 'Panama', 'Ecuador', 'Paraguay',
  'Uruguay', 'New Zealand', 'Philippines', 'Vietnam', 'Thailand', 'Malaysia',
  'Cambodia', 'Laos', 'Taiwan', 'North Korea', 'Bangladesh', 'Sri Lanka',
  'Nepal', 'Kenya', 'Ghana', 'Ivory Coast', 'Senegal', 'Tunisia', 'Morocco',
  'Zimbabwe', 'Rwanda', 'Uganda', 'Cameroon', 'Somalia', 'South Sudan',
  'Sierra Leone', 'Liberia', 'Guinea', 'Benin', 'Togo', 'Burkina Faso',
  'Malawi', 'Gaza', 'Palestinian Territories', 'Palestine',
  // US states
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
  'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
  'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine',
  'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri',
  'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico',
  'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon',
  'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee',
  'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming', 'Washington D.C.', 'Puerto Rico',
]);

function locationZoom(loc) {
  const name = loc.name ?? '';
  if (LARGE_COUNTRY_NAMES.has(name)) return 5;
  if (COUNTRY_OR_STATE_NAMES.has(name)) return 7;
  return 9; // city / specific location default
}

// Format edition slug as a human-readable label for globe-shot chyrons.
function editionLabel(ed) {
  const m = ed.match(/^(\d{4})-(\d{2})-(\d{2})-(morning|evening)$/);
  if (!m) return ed;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const dateStr = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const time = m[4] === 'morning' ? 'Morning' : 'Evening';
  return `${dateStr} — ${time} Edition`;
}

function sourceCount(story) {
  return new Set((story.articles ?? []).map(a => a.source).filter(Boolean)).size;
}

// Build narration: summary → significance → claims (up to 3) → outlook → disagreement fallback.
function buildNarration(analysis) {
  if (!analysis) return '';
  const parts = [];

  if (analysis.summary) parts.push(analysis.summary.trim());

  // One sentence of significance (why this matters).
  if (analysis.context?.significance) {
    const sig = analysis.context.significance.trim();
    const firstSentence = sig.match(/^[^.!?]+[.!?]/)?.[0]?.trim() ?? sig;
    if (firstSentence) parts.push(firstSentence);
  }

  // Up to 3 multi-source claims. Legacy fallback: agreements.
  let picks = [];
  if (Array.isArray(analysis.claims)) {
    picks = analysis.claims
      .filter(c => Array.isArray(c.sources) && c.sources.length >= 2)
      .slice(0, 3)
      .map(c => (c.statement ?? '').trim())
      .filter(Boolean);
  } else if (Array.isArray(analysis.agreements)) {
    picks = analysis.agreements
      .slice(0, 3)
      .map(a => (typeof a === 'string' ? a : a.text ?? '').trim())
      .filter(Boolean);
  }

  if (picks.length) {
    parts.push(picks.join(' '));
  } else if (Array.isArray(analysis.disagreements) && analysis.disagreements.length > 0) {
    const dPick = (typeof analysis.disagreements[0] === 'string'
      ? analysis.disagreements[0]
      : analysis.disagreements[0].text ?? '').trim();
    if (dPick) parts.push(dPick);
  }

  // One forward-looking outlook bullet.
  if (Array.isArray(analysis.context?.outlook) && analysis.context.outlook.length > 0) {
    const outlook = (analysis.context.outlook[0] ?? '').trim();
    if (outlook) parts.push(outlook);
  }

  const joined = parts.join('  ');
  // Hard ceiling to prevent any single story from overwhelming the budget.
  if (joined.length > MAX_NARRATION_CHARS) {
    return joined.slice(0, MAX_NARRATION_CHARS).replace(/\s+\S*$/, '');
  }
  return joined;
}

function estimateHold(narration) {
  const raw = Math.ceil(narration.length / TTS_CHARS_PER_SEC);
  return Math.min(MAX_HOLD, Math.max(MIN_HOLD, raw));
}

// Normalized impact score 0–1 from story-level signal count.
function storyImpact(story) {
  if (!story) return 0;
  const analysis = story.analysis ?? {};
  const claims       = Array.isArray(analysis.claims)       ? analysis.claims.length       : 0;
  const disagreements = Array.isArray(analysis.disagreements) ? analysis.disagreements.length : 0;
  return Math.min(1, (claims + disagreements) / 10);
}

// Quick camera cut duration between locations within a multi-location shot.
const FLY_BETWEEN_S = 2.5;

// Build highlight metadata for a location waypoint.
function waypointHighlight(loc, polygonMap) {
  if (!loc || loc.iso === 'XX' || (Math.abs(loc.lat) < 0.5 && Math.abs(loc.lng) < 0.5)) return null;
  const zoom = locationZoom(loc);
  const type = zoom <= 4 ? 'country' : zoom <= 6 ? 'state' : 'city';
  const polygon = polygonMap?.get(`${loc.name}|${loc.iso ?? ''}`) ?? null;
  return { type, name: loc.name, iso: loc.iso ?? null, polygon };
}

// Delegate camera path building to the recipe module.
// buildCameraPath: establish (1-loc) or sweepBetween (multi-loc) or globeSpin (no-loc).
// buildGlobeSpinPath: intro/outro globe spin.
function buildCameraPath(locations, estimatedHold, polygonMap) {
  return buildRecipeCameraPath(locations, estimatedHold, polygonMap, { locationZoom, waypointHighlight });
}

// ── Collect unique locations and pre-fetch polygons ───────────────────────────

async function fetchAllPolygons(locations) {
  const unique = new Map();
  for (const loc of (locations ?? [])) {
    if (!loc?.lat || !loc?.lng) continue;
    if (loc.iso === 'XX' || (Math.abs(loc.lat) < 0.5 && Math.abs(loc.lng) < 0.5)) continue;
    const key = `${loc.name}|${loc.iso ?? ''}`;
    if (!unique.has(key)) unique.set(key, loc);
  }
  const fresh = [...unique.keys()].filter(k => !Object.prototype.hasOwnProperty.call(polygonCache, k));
  if (fresh.length > 0) console.log(`Fetching ${fresh.length} boundary polygon(s) from Nominatim…`);
  else if (unique.size > 0) console.log(`All ${unique.size} polygon(s) served from cache.`);
  for (const key of unique.keys()) {
    const loc = unique.get(key);
    await fetchBoundaryPolygon(loc.name, loc.iso ?? '');
  }
  if (fresh.length > 0) savePolygonCache();
  return new Map([...unique.keys()].map(k => [k, polygonCache[k] ?? null]));
}

// ── Build shots ───────────────────────────────────────────────────────────────

async function main() {

// Pre-fetch boundary polygons for all unique locations in this report.
const allLocs = (report.stories ?? []).flatMap(s => s.analysis?.locations ?? []);
const polygonMap = await fetchAllPolygons(allLocs);

const shots = [];
let elapsed = 0;

if (timingsPath) {
  // Timings-driven mode: use provided story indices and durations for exact sync
  let timings;
  try {
    timings = JSON.parse(readFileSync(timingsPath, 'utf8'));
  } catch {
    console.error(`Failed to read timings file: ${timingsPath}`);
    process.exit(1);
  }

  // Load full narration text from the pipeline broadcast file when available.
  // Falls back to the 48-char beat title when the broadcast file is absent.
  let bcBeats = [], bcIndices = [];
  if (broadcastFilePath) {
    try {
      const bc = JSON.parse(readFileSync(broadcastFilePath, 'utf8'));
      bcBeats   = bc.beats         ?? [];
      bcIndices = bc.storyIndices  ?? [];
      console.log(`  Using broadcast narrations: ${broadcastFilePath}`);
    } catch (e) {
      console.warn(`  Could not read broadcast file (${e.message}), falling back to beat titles`);
    }
  }

  for (let i = 0; i < timings.length; i++) {
    const { storyIndex, beat, narration: timingNarration, durationSecs } = timings[i];
    if (elapsed + durationSecs > maxDuration) break;

    const story = (report.stories ?? [])[storyIndex];
    if (!story) {
      console.warn(`timings[${i}]: storyIndex ${storyIndex} not found in report, skipping`);
      continue;
    }

    const analysis = story.analysis ?? {};
    const validLocs = (analysis.locations ?? []).filter(l => l?.lat != null && l?.lng != null);
    const isoCode = validLocs.find(l => l.iso && l.iso !== 'XX')?.iso ?? null;
    const cameraPath = buildCameraPath(analysis.locations, durationSecs, polygonMap);
    const namedWps = cameraPath.filter(wp => wp.highlight?.name);

    // Narration priority: timings.json field → broadcast file → 48-char beat title
    const bcIdx = bcIndices.indexOf(storyIndex);
    const resolvedNarration = timingNarration
      || (bcIdx >= 0 && bcBeats[bcIdx]?.narration)
      || beat;
    const si = classifyShotIntent(resolvedNarration);

    shots.push({
      t: elapsed,
      storyIndex,
      isoCode,
      cameraPath,
      chyron: {
        label: CHYRON_LABELS[i % CHYRON_LABELS.length].toUpperCase(),
        headline: story.headline,
      },
      narration: resolvedNarration,
      hold: durationSecs,
      viz: buildStoryViz(story, isoCode),
      impact: storyImpact(story),
      shotIntent: si ?? (namedWps.length > 0 ? 'reveal' : null),
    });

    elapsed += durationSecs;
  }
} else if (broadcast) {
  // Broadcast-file mode: use pipeline-generated narrations, keyed by storyIndices.
  // Intro/outro are parsed from the full script text (first and last paragraphs).
  const { beats = [], storyIndices = [], script = '' } = broadcast;
  const scriptParas = script.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  const introNarration = scriptParas[0] ?? '';
  const outroNarration = scriptParas.length > 1 ? scriptParas[scriptParas.length - 1] : '';
  const edLabel = editionLabel(edition);

  // Intro globe shot
  if (introNarration) {
    const hold = estimateHold(introNarration);
    shots.push({
      t: elapsed,
      storyIndex: null,
      isoCode: null,
      cameraPath: buildGlobeSpinPath(hold),
      chyron: { label: 'LIVE', headline: edLabel },
      narration: introNarration,
      hold,
      viz: buildHeatmapViz(report.stories),
      overlays: [],
    });
    elapsed += hold;
  }

  // Story beats
  for (let i = 0; i < beats.length; i++) {
    const narration = (beats[i].narration ?? '').trim();
    if (!narration) continue;

    const hold = estimateHold(narration);
    if (elapsed + hold > maxDuration) break;

    const storyIdx = storyIndices[i] ?? null;
    const story    = storyIdx != null ? (report.stories ?? [])[storyIdx] : null;
    const analysis = story?.analysis ?? {};
    const validLocs = (analysis.locations ?? []).filter(l => l?.lat != null && l?.lng != null);
    const isoCode = validLocs.find(l => l.iso && l.iso !== 'XX')?.iso ?? null;
    const cameraPath = buildCameraPath(analysis.locations, hold, polygonMap);
    const namedWps = cameraPath.filter(wp => wp.highlight?.name);
    const si = classifyShotIntent(narration);

    shots.push({
      t: elapsed,
      storyIndex: storyIdx,
      isoCode,
      cameraPath,
      chyron: {
        label:    CHYRON_LABELS[i % CHYRON_LABELS.length].toUpperCase(),
        headline: story?.headline ?? beats[i].beat ?? '',
      },
      narration,
      hold,
      viz: buildStoryViz(story, isoCode),
      impact: storyImpact(story),
      shotIntent: si ?? (namedWps.length > 0 ? 'reveal' : null),
    });

    elapsed += hold;
  }

  // Outro globe shot
  if (outroNarration) {
    const hold = estimateHold(outroNarration);
    shots.push({
      t: elapsed,
      storyIndex: null,
      isoCode: null,
      cameraPath: buildGlobeSpinPath(hold),
      chyron: { label: 'LIVE', headline: edLabel },
      narration: outroNarration,
      hold,
      viz: buildHeatmapViz(report.stories),
      overlays: [],
    });
    elapsed += hold;
  }
} else {
  // Fallback: derive narration from report fields when no broadcast file is available.
  const topStories = (report.stories ?? []).filter(s => sourceCount(s) >= 2);

  for (let i = 0; i < topStories.length; i++) {
    const story    = topStories[i];
    const analysis = story.analysis ?? {};

    const narration = buildNarration(analysis);
    const hold      = estimateHold(narration);

    if (elapsed + hold > maxDuration) break;

    const validLocs = (analysis.locations ?? []).filter(l => l?.lat != null && l?.lng != null);
    const isoCode = validLocs.find(l => l.iso && l.iso !== 'XX')?.iso ?? null;
    const actualIdx = (report.stories ?? []).indexOf(story);
    const cameraPath = buildCameraPath(analysis.locations, hold, polygonMap);
    const namedWps = cameraPath.filter(wp => wp.highlight?.name);
    const si = classifyShotIntent(narration);

    shots.push({
      t: elapsed,
      storyIndex: actualIdx,
      isoCode,
      cameraPath,
      chyron: {
        label:    CHYRON_LABELS[i % CHYRON_LABELS.length].toUpperCase(),
        headline: story.headline,
      },
      narration,
      hold,
      viz: buildStoryViz(story, isoCode),
      impact: storyImpact(story),
      shotIntent: si ?? (namedWps.length > 0 ? 'reveal' : null),
    });

    elapsed += hold;
  }
}

if (shots.length === 0) {
  console.error('No eligible stories found in report (need ≥2 sources).');
  process.exit(1);
}

// Mark the first story shot (broadcast order) for the spotlight-mask cinematic gate.
const firstStoryShot = shots.find(s => s.storyIndex != null);
if (firstStoryShot) firstStoryShot.isEstablish = true;

const shotlist = {
  edition,
  aspect,
  duration: elapsed,
  shots,
  sourceLeans: SOURCE_LEANS,
  anchorOpts: {
    noAnchored,
    leadTime,
    minDwell,
  },
};

// ── Write output ──────────────────────────────────────────────────────────────

const outDir  = join(ROOT, 'out', 'shotlists');
const outPath = join(outDir, `${edition}.json`);
mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, JSON.stringify(shotlist, null, 2));

console.log(`Wrote ${shots.length} shots, ${elapsed}s total → ${outPath}`);

} // end main()
main().catch(err => { console.error(err); process.exit(1); });
