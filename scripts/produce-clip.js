#!/usr/bin/env node
// End-to-end clip producer (item 19).
//
// One command: edition ID → publishable MP4s + thumbnails.
// Stages (in order):
//   1. build-shotlist   — generate out/shotlists/<edition>.json
//   2. synthesize-narr  — TTS per shot → out/audio/<edition>/shot-N.wav
//   3. remotion render  — frame-accurate render → out/raw/<edition>.mp4
//   4. finalize-clip    — ffmpeg mux + per-platform encode → out/final/
//
// Stage 3 starts an isolated render server on a free ephemeral port
// (scripts/render-server.js) that serves the static assets Remotion needs.
// This decouples the render from server.js on :3002, so cron restarts of
// the dev/prod server cannot break an in-flight render.
//
// Usage:
//   node scripts/produce-clip.js --edition=2026-04-30-evening
//   node scripts/produce-clip.js --edition=2026-04-30-evening --max-duration=30
//   node scripts/produce-clip.js --edition=2026-04-30-evening --platforms=youtube
//   node scripts/produce-clip.js --edition=2026-04-30-evening --bed=assets/bed.wav
//
// Env (optional — narration falls back to --dry-run silence if both absent):
//   ELEVENLABS_API_KEY
//   OPENAI_API_KEY

import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync, spawn } from 'child_process';
import { startRenderServer } from './render-server.js';

const ROOT    = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS = join(ROOT, 'scripts');

// Load .env from repo root so ELEVENLABS_API_KEY, MAPBOX_TOKEN_RENDER, etc.
// are available to this process and all child processes spawned below.
const { config } = await import('dotenv');
config({ path: join(ROOT, '.env') });

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, ...rest] = a.slice(2).split('='); return [k, rest.join('=') || 'true']; })
);

const edition      = args['edition'];
const maxDuration  = args['max-duration'] ?? '360';
const aspect       = args['aspect']       ?? '16:9';
const platforms    = args['platforms']    ?? 'youtube,tiktok';
const bed          = args['bed']          ?? null;
const timings      = args['timings']      ?? null;
const noAnchored   = args['no-anchored']   ?? null;
const debugAnchors = args['debug-anchors'] ?? null;
const leadTime     = args['lead-time']     ?? null;
const minDwell     = args['min-dwell']     ?? null;

if (!edition) {
  console.error('Usage: node scripts/produce-clip.js --edition=YYYY-MM-DD-{morning|evening}');
  console.error('       Optional: --max-duration=30  --aspect=16:9  --platforms=youtube,tiktok  --bed=<path>');
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function banner(stage, msg) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  STAGE: ${stage}`);
  if (msg) console.log(`  ${msg}`);
  console.log('─'.repeat(60));
}

function run(stage, cmd, cmdArgs, opts = {}) {
  console.log(`\n+ ${cmd} ${cmdArgs.join(' ')}`);
  try {
    execFileSync(cmd, cmdArgs, { stdio: 'inherit', ...opts });
  } catch (err) {
    console.error(`\n✗ Stage "${stage}" failed (exit ${err.status ?? 1})`);
    process.exit(err.status ?? 1);
  }
}

// Async variant using spawn — keeps the event loop free so in-process
// servers (render-server.js) can continue accepting connections.
function runAsync(stage, cmd, cmdArgs, opts = {}) {
  console.log(`\n+ ${cmd} ${cmdArgs.join(' ')}`);
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, { stdio: 'inherit', ...opts });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(Object.assign(new Error(`Stage "${stage}" failed (exit ${code ?? signal ?? 1})`), { status: code ?? 1 }));
    });
  });
}

// ── Anchor-related flags to forward to sub-scripts ────────────────────────────

const anchorFlags = [
  ...(noAnchored   != null ? [`--no-anchored=${noAnchored}`]     : []),
  ...(debugAnchors != null ? [`--debug-anchors=${debugAnchors}`] : []),
  ...(leadTime     != null ? [`--lead-time=${leadTime}`]         : []),
  ...(minDwell     != null ? [`--min-dwell=${minDwell}`]         : []),
];

// ── Stage 1: build-shotlist ───────────────────────────────────────────────────

banner('1 / 4', `build-shotlist  edition=${edition}`);

run('build-shotlist', 'node', [
  join(SCRIPTS, 'build-shotlist.js'),
  `--edition=${edition}`,
  `--max-duration=${maxDuration}`,
  `--aspect=${aspect}`,
  ...(timings ? [`--timings=${timings}`] : []),
  ...anchorFlags,
]);

const shotlistPath = join(ROOT, 'out', 'shotlists', `${edition}.json`);
if (!existsSync(shotlistPath)) {
  console.error(`✗ build-shotlist did not produce ${shotlistPath}`);
  process.exit(1);
}

// ── Stage 2: synthesize-narration ────────────────────────────────────────────
// Must run BEFORE remotion render — Remotion fetches the per-shot WAVs during rendering.

banner('2 / 4', `synthesize-narration  edition=${edition}`);

const hasTTS = !!(process.env.ELEVENLABS_API_KEY || process.env.OPENAI_API_KEY);
if (!hasTTS) {
  console.warn('  ⚠  No TTS API key found (ELEVENLABS_API_KEY / OPENAI_API_KEY).');
  console.warn('     Falling back to --dry-run (silence for all shots).');
}

run('synthesize-narration', 'node', [
  join(SCRIPTS, 'synthesize-narration.js'),
  `--edition=${edition}`,
  ...(hasTTS ? [] : ['--dry-run']),
  ...anchorFlags,
]);

// ── Stage 3: remotion render ──────────────────────────────────────────────────

banner('3 / 4', `remotion render  edition=${edition}`);

// Start an isolated static server on a free ephemeral port. This serves the
// three asset trees Remotion fetches (public/, out/shotlists/, out/audio/)
// independently of server.js on :3002, so cron restarts of the dev server
// cannot interrupt an in-flight render.
const { port: renderPort, close: closeRenderServer } = await startRenderServer({ rootDir: ROOT });
console.log(`  ✓ Render server listening on :${renderPort}`);

const rawPath = join(ROOT, 'out', 'raw', `${edition}.mp4`);
mkdirSync(join(ROOT, 'out', 'raw'), { recursive: true });

// On Windows, .bin/remotion is a bash script — use the .cmd wrapper instead.
const remotionBin = process.platform === 'win32'
  ? join(ROOT, 'node_modules', '.bin', 'remotion.cmd')
  : join(ROOT, 'node_modules', '.bin', 'remotion');

// Pass props via a JSON file — inline --props JSON breaks on Windows CMD
// because CMD strips the double quotes from the value.
const propsPath = join(ROOT, 'out', `remotion-props-${edition}.json`);
writeFileSync(propsPath, JSON.stringify({ edition, aspect, port: renderPort, mapboxToken: process.env.MAPBOX_TOKEN_RENDER ?? process.env.VITE_MAPBOX_TOKEN ?? '' }));

// Use runAsync so the event loop stays live and the render server above
// can accept Chromium's fetch requests during the render.
let renderError = null;
try {
  await runAsync('record', remotionBin, [
    'render',
    'Broadcast',
    `--props=${propsPath}`,
    '--output', rawPath,
    '--concurrency', '1',
    '--log', 'verbose',
  ], { shell: process.platform === 'win32' });
} catch (err) {
  renderError = err;
}

await closeRenderServer();
console.log('  Render server closed.');
try { unlinkSync(propsPath); } catch {}

if (renderError) {
  console.error(`\n✗ ${renderError.message}`);
  process.exit(renderError.status ?? 1);
}

if (!existsSync(rawPath)) {
  console.error(`✗ remotion render did not produce ${rawPath}`);
  process.exit(1);
}

// ── Stage 4: finalize-clip ────────────────────────────────────────────────────

banner('4 / 4', `finalize-clip  edition=${edition}  platforms=${platforms}`);

const finalArgs = [
  join(SCRIPTS, 'finalize-clip.js'),
  `--edition=${edition}`,
  `--platforms=${platforms}`,
  ...(bed ? [`--bed=${bed}`] : []),
];

run('finalize-clip', 'node', finalArgs);

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(60)}`);
console.log('  DONE');
console.log('═'.repeat(60));
console.log(`  Shotlist : ${shotlistPath}`);
console.log(`  Raw clip : ${rawPath}`);

const platformList = platforms.split(',').map(s => s.trim());
for (const p of platformList) {
  const mp4   = join(ROOT, 'out', 'final', `${edition}-${p}.mp4`);
  const thumb = join(ROOT, 'out', 'final', `${edition}-${p}-thumb.png`);
  const okMp4   = existsSync(mp4)   ? '✓' : '✗';
  const okThumb = existsSync(thumb) ? '✓' : '✗';
  console.log(`  ${p.padEnd(8)}: ${okMp4} ${mp4}`);
  console.log(`  ${''.padEnd(8)}  ${okThumb} ${thumb}`);
}
console.log('');
