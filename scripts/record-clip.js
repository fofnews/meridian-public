#!/usr/bin/env node
// Headless render harness (item 16).
//
// Launches Chromium via Playwright, navigates to the broadcast page with
// the requested shotlist, and captures a .webm clip. The context is closed
// once window.__meridianClipDone is set by BroadcastStage — closing flushes
// the video file.
//
// Prerequisites:
//   1. npm run dev:server  (Express on :3002) must be running
//   2. node scripts/build-shotlist.js --edition=<edition>  must have run first
//
// Usage:
//   node scripts/record-clip.js --edition=2026-04-30-evening
//   node scripts/record-clip.js --edition=2026-04-30-evening --aspect=9:16
//   node scripts/record-clip.js --edition=2026-04-30-evening --out=out/raw/custom.webm
//   node scripts/record-clip.js --edition=2026-04-30-evening --port=5173

import { chromium } from 'playwright';
import { mkdirSync, renameSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, ...rest] = a.slice(2).split('='); return [k, rest.join('=') || 'true']; })
);

const edition   = args['edition'];
const aspect    = args['aspect'] ?? '16:9';
const port      = args['port']   ?? '3002';
// Generous default: shotlist duration (≤90s) + pre/post roll + map load time
const timeoutMs = Number(args['timeout'] ?? 180_000);

if (!edition) {
  console.error('Usage: node scripts/record-clip.js --edition=YYYY-MM-DD-{morning|evening}');
  process.exit(1);
}

const [vw, vh] = aspect === '9:16' ? [1080, 1920] : [1920, 1080];

const outPath = args['out'] ?? join(ROOT, 'out', 'raw', `${edition}.webm`);
const outDir  = dirname(outPath);
const tmpDir  = join(ROOT, 'out', '.rec-tmp');

// ── Pre-flight checks ─────────────────────────────────────────────────────────

const shotlistPath = join(ROOT, 'out', 'shotlists', `${edition}.json`);
if (!existsSync(shotlistPath)) {
  console.error(`Shotlist not found: ${shotlistPath}`);
  console.error(`Run first: node scripts/build-shotlist.js --edition=${edition} --aspect=${aspect}`);
  process.exit(1);
}

mkdirSync(outDir,  { recursive: true });
mkdirSync(tmpDir,  { recursive: true });

const shotlistUrl = `/out/shotlists/${edition}.json`;
const pageUrl     = `http://localhost:${port}/?mode=broadcast&shotlist=${encodeURIComponent(shotlistUrl)}`;

console.log(`\nRecording  ${aspect}  ${vw}×${vh}`);
console.log(`Edition    ${edition}`);
console.log(`URL        ${pageUrl}`);
console.log(`Output     ${outPath}\n`);

// ── Launch + record ───────────────────────────────────────────────────────────

const browser = await chromium.launch({ headless: true });

const context = await browser.newContext({
  viewport:          { width: vw, height: vh },
  deviceScaleFactor: 1,
  // recordVideo finalises when the page is closed; size must match viewport.
  recordVideo: {
    dir:  tmpDir,
    size: { width: vw, height: vh },
  },
});

const page = await context.newPage();

// Surface page errors for debugging without flooding stdout with Mapbox noise.
page.on('pageerror',  err  => console.error('[page error]', err.message));
page.on('console',    msg  => { if (msg.type() === 'error') console.error('[page]', msg.text()); });

console.log('Navigating…');
await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 60_000 });

console.log('Page loaded — waiting for window.__meridianClipDone…');
await page.waitForFunction(() => window.__meridianClipDone === true, {
  timeout:  timeoutMs,
  polling:  500,
});

// Close the page to finalise the video file, then retrieve its tmp path.
console.log('Clip done — flushing video…');
await page.close();
const tmpPath = await page.video().path();

await context.close();
await browser.close();

// Move from the auto-named tmp file to the requested output path.
renameSync(tmpPath, outPath);
console.log(`\nSaved: ${outPath}`);
