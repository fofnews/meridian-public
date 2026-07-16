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

import { existsSync, mkdirSync, mkdtempSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { execFileSync, spawn } from 'child_process';
import os from 'os';
import { bundle } from '@remotion/bundler';
import { selectComposition, renderMedia } from '@remotion/renderer';
import { startRenderServer } from './render-server.js';

const _require = createRequire(import.meta.url);

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
const aspect       = args['aspect']       ?? '16:9'; // forwarded to build-shotlist only; render aspect is derived from --platforms
const platforms    = args['platforms']    ?? 'youtube,tiktok';
const platformList        = platforms.split(',').map(s => s.trim());
const hasTiktok           = platformList.includes('tiktok');
const nonTiktokPlatforms  = platformList.filter(p => p !== 'tiktok');
const bed          = args['bed']          ?? null;
const audio        = args['audio']        ?? null;  // pipeline pre-generated narration audio
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

// Derive broadcast narration file from the pipeline audio path so timings mode
// can substitute full narration text for the 48-char beat titles.
// audio = .../pipeline/audio/<edition>/full.wav → .../pipeline/broadcasts/<edition>.json
const broadcastFile = (audio && existsSync(audio))
  ? join(dirname(audio), '..', '..', 'broadcasts', `${edition}.json`)
  : null;

run('build-shotlist', 'node', [
  join(SCRIPTS, 'build-shotlist.js'),
  `--edition=${edition}`,
  `--max-duration=${maxDuration}`,
  `--aspect=${aspect}`,
  ...(timings ? [`--timings=${timings}`] : []),
  ...(broadcastFile && existsSync(broadcastFile) ? [`--broadcast-file=${broadcastFile}`] : []),
  ...anchorFlags,
]);

const shotlistPath = join(ROOT, 'out', 'shotlists', `${edition}.json`);
if (!existsSync(shotlistPath)) {
  console.error(`✗ build-shotlist did not produce ${shotlistPath}`);
  process.exit(1);
}

// ── Pre-stage 2: populate per-shot WAVs from pipeline pre-generated audio ────
// When the pipeline passes --audio and --timings, beat-N.mp3 files in the
// audio directory already contain the proper narration. Convert them to
// shot-N.wav so synthesize-narration.js can skip TTS and use the real audio.

let prebuiltAudio = false;
if (audio && timings && existsSync(audio)) {
  const beatAudioDir = dirname(audio);
  const audioOutDir  = join(ROOT, 'out', 'audio', edition);
  mkdirSync(audioOutDir, { recursive: true });

  let timingsData;
  try { timingsData = JSON.parse(readFileSync(timings, 'utf8')); } catch { timingsData = []; }

  let converted = 0;
  for (let i = 0; i < timingsData.length; i++) {
    const beatMp3 = join(beatAudioDir, `beat-${i}.mp3`);
    const shotWav  = join(audioOutDir, `shot-${i}.wav`);
    if (existsSync(beatMp3)) {
      try {
        execFileSync('ffmpeg', ['-y', '-i', beatMp3, shotWav], { stdio: 'pipe' });
        converted++;
      } catch (e) {
        console.warn(`  ⚠  ffmpeg convert failed for beat-${i}.mp3: ${e.message}`);
      }
    }
  }
  if (converted > 0) {
    console.log(`  ✓ Pre-populated ${converted} shot WAV(s) from pipeline audio.`);
    prebuiltAudio = true;
  }
}

// ── Stage 2: synthesize-narration ────────────────────────────────────────────
// Must run BEFORE remotion render — Remotion fetches the per-shot WAVs during rendering.

banner('2 / 4', `synthesize-narration  edition=${edition}`);

const hasTTS = !!(process.env.ELEVENLABS_API_KEY || process.env.OPENAI_API_KEY);
if (!hasTTS && !prebuiltAudio) {
  console.warn('  ⚠  No TTS API key found (ELEVENLABS_API_KEY / OPENAI_API_KEY).');
  console.warn('     Falling back to --dry-run (silence for all shots).');
}

run('synthesize-narration', 'node', [
  join(SCRIPTS, 'synthesize-narration.js'),
  `--edition=${edition}`,
  ...(prebuiltAudio ? ['--prebuilt-audio'] : hasTTS ? [] : ['--dry-run']),
  ...anchorFlags,
]);

// ── Stage 3: remotion render(s) — programmatic API ───────────────────────────
//
// Switched from the CLI (`npx remotion render`) to the programmatic API so we
// can pass --disable-direct-composition to Chrome. The CLI only accepts an
// allowlisted subset of Chromium flags via ChromiumOptions; arbitrary flags
// require launching HeadlessBrowser directly and supplying the instance as
// puppeteerInstance. --disable-direct-composition prevents the D3D11
// DirectComposition GPU-process crash on the AMD Radeon 6950 (driver 2015),
// which was forcing headless Chrome to fall back to SwiftShader software WebGL
// and causing ~30-minute renders.

banner('3 / 4', `remotion render  edition=${edition}`);

const { port: renderPort, close: closeRenderServer } = await startRenderServer({ rootDir: ROOT });
console.log(`  ✓ Render server listening on :${renderPort}`);

mkdirSync(join(ROOT, 'out', 'raw'), { recursive: true });

const rawPath     = join(ROOT, 'out', 'raw', `${edition}.mp4`);
const raw9x16Path = join(ROOT, 'out', 'raw', `${edition}-9x16.mp4`);

// Replicate the webpack override from remotion.config.js so bundle() injects
// VITE_MAPBOX_TOKEN into the webpack bundle the same way the CLI does.
const webpackOverride = (config) => {
  const webpack = _require('webpack');
  const mapboxToken = process.env.MAPBOX_TOKEN_RENDER ?? process.env.VITE_MAPBOX_TOKEN ?? '';
  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      new webpack.DefinePlugin({
        'process.env.VITE_MAPBOX_TOKEN': JSON.stringify(mapboxToken),
      }),
    ],
  };
};

console.log('\n  Bundling Remotion composition...');
let lastBundleProgress = -1;
const serveUrl = await bundle({
  entryPoint:      join(ROOT, 'remotion', 'src', 'Root.jsx'),
  publicDir:       join(ROOT, 'public'),
  webpackOverride,
  onProgress: (p) => {
    const pct = Math.floor(p);
    if (pct > lastBundleProgress) {
      lastBundleProgress = pct;
      process.stdout.write(`\r  [bundle] ${pct}%   `);
    }
  },
});
console.log(`\n  Bundle ready.`);

// Internal Remotion modules loaded via _require (absolute path) to bypass the
// package exports map, which does not expose dist/browser/Browser.js as a
// public subpath. createRequire-based CJS require ignores exports restrictions.
const { HeadlessBrowser }         = _require(join(ROOT, 'node_modules/@remotion/renderer/dist/browser/Browser.js'));
const { getLocalBrowserExecutable } = _require(join(ROOT, 'node_modules/@remotion/renderer/dist/get-local-browser-executable.js'));

// Build Chrome launch args — mirrors open-browser.js + --disable-direct-composition.
const executablePath = getLocalBrowserExecutable({
  preferredBrowserExecutable: null,
  logLevel: 'verbose',
  indent: false,
  chromeMode: 'headless-shell',
});
const userDataDir = mkdtempSync(join(os.tmpdir(), 'remotion-chrome-'));
const chromeArgs = [
  'about:blank',
  '--allow-pre-commit-input',
  '--disable-background-networking',
  '--enable-features=NetworkService,NetworkServiceInProcess,CanvasDrawElement',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-breakpad',
  '--disable-client-side-phishing-detection',
  '--disable-component-extensions-with-background-pages',
  '--disable-default-apps',
  '--disable-dev-shm-usage',
  '--no-proxy-server',
  "--proxy-server='direct://'",
  '--proxy-bypass-list=*',
  '--force-gpu-mem-available-mb=4096',
  '--disable-hang-monitor',
  '--disable-extensions',
  '--allow-chrome-scheme-url',
  '--disable-ipc-flooding-protection',
  '--disable-popup-blocking',
  '--disable-prompt-on-repost',
  '--disable-renderer-backgrounding',
  '--disable-sync',
  '--force-color-profile=srgb',
  '--metrics-recording-only',
  '--mute-audio',
  '--no-first-run',
  '--video-threads=4',
  '--enable-automation',
  '--password-store=basic',
  '--use-mock-keychain',
  '--enable-blink-features=IdleDetection',
  '--export-tagged-pdf',
  '--intensive-wake-up-throttling-policy=0',
  '--headless=old',
  '--disable-direct-composition', // prevents D3D11 DirectComposition GPU-process crash
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--use-gl=angle',               // matches Config.setChromiumOpenGlRenderer('angle')
  '--disable-background-media-suspend',
  '--allow-running-insecure-content',
  '--disable-component-update',
  '--disable-domain-reliability',
  '--disable-features=AudioServiceOutOfProcess,IsolateOrigins,site-per-process,Translate,BackForwardCache,AvoidUnnecessaryBeforeUnloadCheckSync,IntensiveWakeUpThrottling,LocalNetworkAccessChecks,BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults',
  '--disable-print-preview',
  '--disable-site-isolation-trials',
  '--disk-cache-size=268435456',
  '--hide-scrollbars',
  '--no-default-browser-check',
  '--no-pings',
  '--font-render-hinting=none',
  '--no-zygote',
  '--ignore-gpu-blocklist',
  '--enable-unsafe-webgpu',
  '--remote-debugging-port=0',
  `--user-data-dir=${userDataDir}`,
];

console.log(`  Chrome: ${executablePath}`);
const browser = await HeadlessBrowser.create({
  executablePath,
  args: chromeArgs,
  userDataDir,
  defaultViewport: { width: 1280, height: 720, deviceScaleFactor: 1 },
  timeout: 25000,
  logLevel: 'verbose',
  indent: false,
});

const mapboxToken = process.env.MAPBOX_TOKEN_RENDER ?? process.env.VITE_MAPBOX_TOKEN ?? '';

let renderError = null;
try {
  // 3a: 16:9 render — skipped only when tiktok is the sole platform.
  if (nonTiktokPlatforms.length > 0) {
    console.log('\n  Selecting composition Broadcast (16:9)...');
    const inputProps169 = { edition, aspect: '16:9', port: renderPort, mapboxToken };
    const composition169 = await selectComposition({
      serveUrl, id: 'Broadcast', inputProps: inputProps169,
      puppeteerInstance: browser, logLevel: 'verbose',
    });
    console.log(`  Rendering ${composition169.durationInFrames} frames → ${rawPath}`);
    await renderMedia({
      composition: composition169,
      serveUrl,
      inputProps: inputProps169,
      codec: 'h264',
      imageFormat: 'jpeg',
      jpegQuality: 95,
      outputLocation: rawPath,
      puppeteerInstance: browser,
      concurrency: 1,
      logLevel: 'verbose',
      muted: !!audio,  // narration audio will be mixed by finalize-clip; mute Remotion render
      onProgress: ({ renderedFrames, encodedFrames, progress }) => {
        process.stdout.write(
          `\r  [16:9] rendered=${String(renderedFrames).padStart(4)} encoded=${String(encodedFrames).padStart(4)} ${String(Math.round(progress * 100)).padStart(3)}%`
        );
      },
    });
    console.log('');
  }

  // 3b: 9:16 render — only when tiktok is in platforms.
  if (hasTiktok) {
    console.log('\n  Selecting composition Broadcast916 (9:16)...');
    const inputProps916 = { edition, aspect: '9:16', port: renderPort, mapboxToken };
    const composition916 = await selectComposition({
      serveUrl, id: 'Broadcast916', inputProps: inputProps916,
      puppeteerInstance: browser, logLevel: 'verbose',
    });
    console.log(`  Rendering ${composition916.durationInFrames} frames → ${raw9x16Path}`);
    await renderMedia({
      composition: composition916,
      serveUrl,
      inputProps: inputProps916,
      codec: 'h264',
      imageFormat: 'jpeg',
      jpegQuality: 95,
      outputLocation: raw9x16Path,
      puppeteerInstance: browser,
      concurrency: 1,
      logLevel: 'verbose',
      muted: !!audio,  // narration audio will be mixed by finalize-clip; mute Remotion render
      onProgress: ({ renderedFrames, encodedFrames, progress }) => {
        process.stdout.write(
          `\r  [9:16] rendered=${String(renderedFrames).padStart(4)} encoded=${String(encodedFrames).padStart(4)} ${String(Math.round(progress * 100)).padStart(3)}%`
        );
      },
    });
    console.log('');
  }
} catch (err) {
  renderError = err;
} finally {
  // BrowserRunner.close() also deletes userDataDir.
  await browser.close({ silent: false }).catch(() => {});
}

await closeRenderServer();
console.log('  Render server closed.');

if (renderError) {
  console.error(`\n✗ ${renderError.message}`);
  process.exit(renderError.status ?? 1);
}

if (nonTiktokPlatforms.length > 0 && !existsSync(rawPath)) {
  console.error(`✗ remotion render did not produce ${rawPath}`);
  process.exit(1);
}
if (hasTiktok && !existsSync(raw9x16Path)) {
  console.error(`✗ remotion render did not produce ${raw9x16Path}`);
  process.exit(1);
}

// ── Stage 4: finalize-clip ────────────────────────────────────────────────────

banner('4 / 4', `finalize-clip  edition=${edition}  platforms=${platforms}`);

// 4a: finalize non-tiktok platforms with the 16:9 master.
if (nonTiktokPlatforms.length > 0) {
  run('finalize-16x9', 'node', [
    join(SCRIPTS, 'finalize-clip.js'),
    `--edition=${edition}`,
    `--platforms=${nonTiktokPlatforms.join(',')}`,
    ...(audio ? [`--narration=${audio}`] : []),
    ...(bed ? [`--bed=${bed}`] : []),
  ]);
}

// 4b: finalize tiktok with the native 9:16 master.
if (hasTiktok) {
  run('finalize-tiktok', 'node', [
    join(SCRIPTS, 'finalize-clip.js'),
    `--edition=${edition}`,
    `--platforms=tiktok`,
    `--video=${raw9x16Path}`,
    ...(audio ? [`--narration=${audio}`] : []),
    ...(bed ? [`--bed=${bed}`] : []),
  ]);
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(60)}`);
console.log('  DONE');
console.log('═'.repeat(60));
console.log(`  Shotlist : ${shotlistPath}`);
if (nonTiktokPlatforms.length > 0) console.log(`  Raw clip : ${rawPath}`);

for (const p of platformList) {
  const mp4   = join(ROOT, 'out', 'final', `${edition}-${p}.mp4`);
  const thumb = join(ROOT, 'out', 'final', `${edition}-${p}-thumb.png`);
  const okMp4   = existsSync(mp4)   ? '✓' : '✗';
  const okThumb = existsSync(thumb) ? '✓' : '✗';
  console.log(`  ${p.padEnd(8)}: ${okMp4} ${mp4}`);
  console.log(`  ${''.padEnd(8)}  ${okThumb} ${thumb}`);
}
console.log('');
