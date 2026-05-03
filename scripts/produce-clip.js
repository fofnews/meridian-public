#!/usr/bin/env node
// End-to-end clip producer (item 19).
//
// One command: edition ID → publishable MP4s + thumbnails.
// Stages (in order):
//   1. build-shotlist   — generate out/shotlists/<edition>.json
//   2. record-clip      — headless Playwright render → out/raw/<edition>.webm
//   3. synthesize-narr  — TTS per shot → out/audio/<edition>/full.wav
//   4. finalize-clip    — ffmpeg mux + per-platform encode → out/final/
//
// The Express dev server on :3002 is started automatically if not already
// reachable, and stopped after recording.
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

import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync, spawn } from 'child_process';
import { createConnection } from 'net';

const ROOT    = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS = join(ROOT, 'scripts');

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, ...rest] = a.slice(2).split('='); return [k, rest.join('=') || 'true']; })
);

const edition     = args['edition'];
const maxDuration = args['max-duration'] ?? '90';
const aspect      = args['aspect']       ?? '16:9';
const platforms   = args['platforms']    ?? 'youtube,tiktok';
const bed         = args['bed']          ?? null;
const port        = args['port']         ?? '3002';

if (!edition) {
  console.error('Usage: node scripts/produce-clip.js --edition=YYYY-MM-DD-{morning|evening}');
  console.error('       Optional: --max-duration=30  --aspect=16:9  --platforms=youtube,tiktok  --bed=<path>  --port=3002');
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

// Probe TCP port — resolves true if connectable within timeoutMs.
function tcpReachable(host, portNum, timeoutMs = 500) {
  return new Promise(resolve => {
    const sock = createConnection({ host, port: portNum });
    const done = (val) => { sock.destroy(); resolve(val); };
    sock.on('connect', () => done(true));
    sock.on('error',   () => done(false));
    setTimeout(() => done(false), timeoutMs);
  });
}

// Poll until port is open, up to maxWaitMs.
async function waitForPort(host, portNum, maxWaitMs = 15_000, interval = 300) {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    if (await tcpReachable(host, portNum)) return true;
    await new Promise(r => setTimeout(r, interval));
  }
  return false;
}

// ── Server management ─────────────────────────────────────────────────────────

let serverProc = null;

async function ensureServer() {
  const portNum = Number(port);
  if (await tcpReachable('localhost', portNum)) {
    console.log(`  ✓ Express server already running on :${portNum}`);
    return false; // caller should NOT shut it down
  }

  console.log(`  Starting Express server on :${portNum}…`);
  serverProc = spawn('node', [join(ROOT, 'server.js')], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: port },
    detached: false,
  });

  serverProc.stdout.on('data', d => process.stdout.write(`  [server] ${d}`));
  serverProc.stderr.on('data', d => process.stderr.write(`  [server] ${d}`));
  serverProc.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.error(`  [server] exited with code ${code}`);
    }
  });

  const ready = await waitForPort('localhost', portNum, 15_000);
  if (!ready) {
    console.error(`  ✗ Express server did not start within 15s on :${portNum}`);
    serverProc.kill();
    process.exit(1);
  }
  console.log(`  ✓ Express server ready on :${portNum}`);
  return true; // caller owns it and should shut it down
}

function stopServer() {
  if (serverProc && !serverProc.killed) {
    serverProc.kill('SIGTERM');
    serverProc = null;
    console.log('  Express server stopped.');
  }
}

// ── Stage 1: build-shotlist ───────────────────────────────────────────────────

banner('1 / 4', `build-shotlist  edition=${edition}`);

run('build-shotlist', 'node', [
  join(SCRIPTS, 'build-shotlist.js'),
  `--edition=${edition}`,
  `--max-duration=${maxDuration}`,
  `--aspect=${aspect}`,
]);

const shotlistPath = join(ROOT, 'out', 'shotlists', `${edition}.json`);
if (!existsSync(shotlistPath)) {
  console.error(`✗ build-shotlist did not produce ${shotlistPath}`);
  process.exit(1);
}

// ── Stage 2: record-clip ──────────────────────────────────────────────────────

banner('2 / 4', `record-clip  edition=${edition}  port=${port}`);

const ownedServer = await ensureServer();

try {
  run('record-clip', 'node', [
    join(SCRIPTS, 'record-clip.js'),
    `--edition=${edition}`,
    `--aspect=${aspect}`,
    `--port=${port}`,
  ]);
} finally {
  if (ownedServer) stopServer();
}

const rawPath = join(ROOT, 'out', 'raw', `${edition}.webm`);
if (!existsSync(rawPath)) {
  console.error(`✗ record-clip did not produce ${rawPath}`);
  process.exit(1);
}

// ── Stage 3: synthesize-narration ─────────────────────────────────────────────

banner('3 / 4', `synthesize-narration  edition=${edition}`);

const hasTTS = !!(process.env.ELEVENLABS_API_KEY || process.env.OPENAI_API_KEY);
if (!hasTTS) {
  console.warn('  ⚠  No TTS API key found (ELEVENLABS_API_KEY / OPENAI_API_KEY).');
  console.warn('     Falling back to --dry-run (silence for all shots).');
}

const narrArgs = [
  join(SCRIPTS, 'synthesize-narration.js'),
  `--edition=${edition}`,
  ...(hasTTS ? [] : ['--dry-run']),
];

run('synthesize-narration', 'node', narrArgs);

const audioPath = join(ROOT, 'out', 'audio', edition, 'full.wav');
if (!existsSync(audioPath)) {
  console.error(`✗ synthesize-narration did not produce ${audioPath}`);
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
console.log(`  Audio    : ${audioPath}`);

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
