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

import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── CLI args ─────────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, v = 'true'] = a.slice(2).split('='); return [k, v]; })
);

const edition     = args['edition'];
const maxDuration = Number(args['max-duration'] ?? 90);
const aspect      = args['aspect'] ?? '16:9';

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

// ── Helpers ───────────────────────────────────────────────────────────────────

const CHYRON_LABELS = ['Breaking', 'Developing', 'Analysis', 'Report', 'Update', 'Exclusive'];
const PITCH         = 50;   // FOCUSED_PITCH_BROADCAST
const BEARING       = -10;  // slight tilt for visual interest
const DEFAULT_ZOOM  = 5;
const TTS_CHARS_PER_SEC = 15;
const MIN_HOLD      = 5;
const MAX_HOLD      = 22;

function sourceCount(story) {
  return new Set((story.articles ?? []).map(a => a.source).filter(Boolean)).size;
}

// Build narration from summary + up to 2 agreements or disagreements.
function buildNarration(analysis) {
  if (!analysis) return '';
  const parts = [];
  if (analysis.summary) parts.push(analysis.summary.trim());

  const agreements    = analysis.agreements    ?? [];
  const disagreements = analysis.disagreements ?? [];

  if (agreements.length > 0) {
    const picks = agreements.slice(0, 2).map(a => (typeof a === 'string' ? a : a.text ?? '').trim()).filter(Boolean);
    if (picks.length) parts.push(picks.join(' '));
  } else if (disagreements.length > 0) {
    const picks = disagreements.slice(0, 1).map(d => (typeof d === 'string' ? d : d.text ?? '').trim()).filter(Boolean);
    if (picks.length) parts.push(picks.join(' '));
  }

  return parts.join('  ');
}

function estimateHold(narration) {
  const raw = Math.ceil(narration.length / TTS_CHARS_PER_SEC);
  return Math.min(MAX_HOLD, Math.max(MIN_HOLD, raw));
}

// ── Build shots ───────────────────────────────────────────────────────────────

// Only multi-source stories make it to the broadcast; single-source stories
// are "In Brief" on the website and don't have enough corroboration to air.
const topStories = (report.stories ?? []).filter(s => sourceCount(s) >= 2);

const shots = [];
let elapsed = 0;

for (let i = 0; i < topStories.length; i++) {
  const story    = topStories[i];
  const analysis = story.analysis ?? {};
  const loc      = (analysis.locations ?? []).find(l => l?.lat != null && l?.lng != null);

  const narration = buildNarration(analysis);
  const hold      = estimateHold(narration);

  if (elapsed + hold > maxDuration) break;

  shots.push({
    t: elapsed,
    camera: loc
      ? { lng: loc.lng, lat: loc.lat, zoom: DEFAULT_ZOOM, pitch: PITCH, bearing: BEARING }
      : { lng: 0, lat: 20, zoom: 1.5, pitch: 0, bearing: 0 },
    chyron: {
      label:    CHYRON_LABELS[i % CHYRON_LABELS.length].toUpperCase(),
      headline: story.headline,
    },
    narration,
    hold,
  });

  elapsed += hold;
}

if (shots.length === 0) {
  console.error('No eligible stories found in report (need ≥2 sources).');
  process.exit(1);
}

const shotlist = {
  edition,
  aspect,
  duration: elapsed,
  shots,
};

// ── Write output ──────────────────────────────────────────────────────────────

const outDir  = join(ROOT, 'out', 'shotlists');
const outPath = join(outDir, `${edition}.json`);
mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, JSON.stringify(shotlist, null, 2));

console.log(`Wrote ${shots.length} shots, ${elapsed}s total → ${outPath}`);
