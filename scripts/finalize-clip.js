#!/usr/bin/env node
// ffmpeg mux + per-platform encode (item 18).
//
// Takes a muxed MP4 from Remotion (video + narration audio), optionally
// mixes in bed music, then produces publication-ready MP4s + thumbnails
// for each platform with loudness normalization.
//
// Usage:
//   node scripts/finalize-clip.js --edition=2026-04-30-evening
//   node scripts/finalize-clip.js --edition=2026-04-30-evening --bed=assets/bed.wav
//   node scripts/finalize-clip.js --edition=2026-04-30-evening --platforms=youtube,tiktok,square
//   node scripts/finalize-clip.js --edition=2026-04-30-evening --post=resolve   # uses graded master from DaVinci Resolve
//
// DaVinci Resolve finishing pass (optional):
//   1. python tools/post-process/resolve-import.py --edition=2026-04-30-evening
//   2. node scripts/finalize-clip.js --edition=2026-04-30-evening --post=resolve
//
// Output:
//   out/final/<edition>-youtube.mp4        16:9, −14 LUFS
//   out/final/<edition>-tiktok.mp4         9:16 native render, −16 LUFS
//   out/final/<edition>-<platform>-thumb.png

import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync, execFileSync } from 'child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PRE_ROLL_S = 1; // pre-roll duration (seconds) before first shot

// ── Platform definitions ──────────────────────────────────────────────────────

const PLATFORM_DEFS = {
  // 16:9 master — no crop, just re-encode.
  youtube: {
    lufs:       -14,
    videoFilter: null,           // pass-through
    thumbTime:  PRE_ROLL_S + 5,  // 5s into first shot
  },
  // 9:16 vertical — native 1080 × 1920 render from Broadcast916 composition.
  tiktok: {
    lufs:        -16,
    videoFilter: null,
    thumbTime:   PRE_ROLL_S + 5,
  },
  // 1:1 square — center-crop 1080 × 1080 from the 1920 × 1080 master.
  square: {
    lufs:        -14,
    videoFilter: 'crop=1080:1080:420:0,scale=1080:1080',
    thumbTime:   PRE_ROLL_S + 5,
  },
};

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, ...rest] = a.slice(2).split('='); return [k, rest.join('=') || 'true']; })
);

const edition   = args['edition'];
const bedMusic  = args['bed']      ?? null;
const narration = args['narration'] ?? null;  // pre-generated narration WAV (full.wav from pipeline)
const postMode  = args['post']     ?? null;   // 'resolve' → use graded master from DaVinci Resolve
const platforms = (args['platforms'] ?? 'youtube,tiktok').split(',').map(s => s.trim());

if (!edition) {
  console.error('Usage: node scripts/finalize-clip.js --edition=YYYY-MM-DD-{morning|evening}');
  process.exit(1);
}

// When --post=resolve is set, expect the graded master to exist; finalize from it.
const gradedPath = join(ROOT, 'out', 'raw', `${edition}-graded.mp4`);
const rawPath    = args['video'] ?? join(ROOT, 'out', 'raw', `${edition}.mp4`);
const videoIn    = (postMode === 'resolve') ? gradedPath : rawPath;
const outDir     = join(ROOT, 'out', 'final');

// ── Pre-flight ────────────────────────────────────────────────────────────────

if (postMode === 'resolve' && !existsSync(gradedPath)) {
  console.error(`--post=resolve specified but graded master not found: ${gradedPath}`);
  console.error(`Run: python tools/post-process/resolve-import.py --edition=${edition}`);
  process.exit(1);
}
if (!existsSync(videoIn)) {
  console.error(`Video not found: ${videoIn}`);
  process.exit(1);
}
if (bedMusic && !existsSync(bedMusic)) {
  console.error(`Bed music not found: ${bedMusic}`);
  process.exit(1);
}
for (const p of platforms) {
  if (!PLATFORM_DEFS[p]) {
    console.error(`Unknown platform "${p}". Available: ${Object.keys(PLATFORM_DEFS).join(', ')}`);
    process.exit(1);
  }
}

mkdirSync(outDir, { recursive: true });

// ── Helpers ───────────────────────────────────────────────────────────────────

// Build the audio filter chain (mixing + placeholder for loudnorm pass 2).
// Returns an array of [-i, path, ...] input args plus a filter_complex string.
//
// When --narration is provided the raw Remotion video is muted and narration
// audio is mixed in directly (with PRE_ROLL_S offset) instead of [0:a].
function buildAudioFilter(lufs, measuredStats) {
  // Silence (dry-run) produces -inf measured_I, which loudnorm linear mode rejects.
  // Fall back to single-pass loudnorm (no measured_ params) in that case.
  const isSilent = !isFinite(parseFloat(measuredStats.input_i));
  const loudnormLinear = isSilent
    ? `loudnorm=I=${lufs}:TP=-1:LRA=11`
    : `loudnorm=I=${lufs}:TP=-1:LRA=11:linear=true` +
      `:measured_I=${measuredStats.input_i}` +
      `:measured_LRA=${measuredStats.input_lra}` +
      `:measured_TP=${measuredStats.input_tp}` +
      `:measured_thresh=${measuredStats.input_thresh}` +
      `:offset=${measuredStats.target_offset}`;

  const delayMs = Math.round(PRE_ROLL_S * 1000);

  if (narration && !bedMusic) {
    return {
      extraInputs: ['-i', narration],
      audioFilter: `[1:a]adelay=${delayMs}:all=1[narr];[narr]${loudnormLinear}[aout]`,
      audioMap:    '[aout]',
    };
  }

  if (narration && bedMusic) {
    return {
      extraInputs: ['-i', narration, '-i', bedMusic],
      audioFilter:
        `[1:a]adelay=${delayMs}:all=1,aformat=sample_fmts=fltp[narr];` +
        `[2:a]volume=0.12,aformat=sample_fmts=fltp[bed];` +
        `[narr][bed]amix=inputs=2:duration=first:normalize=0[mix];` +
        `[mix]${loudnormLinear}[aout]`,
      audioMap: '[aout]',
    };
  }

  if (!bedMusic) {
    return {
      extraInputs: [],
      audioFilter: `[0:a]${loudnormLinear}[aout]`,
      audioMap:    '[aout]',
    };
  }

  // Narration at full volume; bed music at 0.12 (−18 dB underneath voice).
  return {
    extraInputs: ['-i', bedMusic],
    audioFilter:
      `[0:a]aformat=sample_fmts=fltp[narr];` +
      `[1:a]volume=0.12,aformat=sample_fmts=fltp[bed];` +
      `[narr][bed]amix=inputs=2:duration=longest:normalize=0[mix];` +
      `[mix]${loudnormLinear}[aout]`,
    audioMap: '[aout]',
  };
}

// Loudnorm analysis pass — runs ffmpeg with the audio signal and captures
// the JSON stats that loudnorm prints to stderr.
function analyzeLoudness(lufs) {
  console.log(`  Analysing loudness (target ${lufs} LUFS)…`);

  const delayMs = Math.round(PRE_ROLL_S * 1000);
  let analyseFilter, analysisInputs;

  if (narration && !bedMusic) {
    analysisInputs = ['-i', videoIn, '-i', narration];
    analyseFilter  = `[1:a]adelay=${delayMs}:all=1[narr];[narr]loudnorm=I=${lufs}:TP=-1:LRA=11:print_format=json[out]`;
  } else if (narration && bedMusic) {
    analysisInputs = ['-i', videoIn, '-i', narration, '-i', bedMusic];
    analyseFilter  =
      `[1:a]adelay=${delayMs}:all=1,aformat=sample_fmts=fltp[narr];` +
      `[2:a]volume=0.12,aformat=sample_fmts=fltp[bed];` +
      `[narr][bed]amix=inputs=2:duration=first:normalize=0[mix];` +
      `[mix]loudnorm=I=${lufs}:TP=-1:LRA=11:print_format=json[out]`;
  } else {
    analyseFilter  = bedMusic
      ? `[0:a]aformat=sample_fmts=fltp[n];[1:a]volume=0.12,aformat=sample_fmts=fltp[b];` +
        `[n][b]amix=inputs=2:duration=longest:normalize=0[mix];` +
        `[mix]loudnorm=I=${lufs}:TP=-1:LRA=11:print_format=json[out]`
      : `[0:a]loudnorm=I=${lufs}:TP=-1:LRA=11:print_format=json[out]`;
    analysisInputs = bedMusic ? ['-i', videoIn, '-i', bedMusic] : ['-i', videoIn];
  }

  const { stderr } = spawnSync('ffmpeg', [
    '-y',
    ...analysisInputs,
    '-filter_complex', analyseFilter,
    '-map', '[out]',
    '-f', 'null', '/dev/null',
  ], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });

  // Loudnorm prints its JSON as the last { ... } block in stderr.
  const match = stderr.match(/\{[\s\S]*?\}/g);
  if (!match) {
    console.error('Failed to parse loudnorm stats. ffmpeg stderr:\n', stderr.slice(-2000));
    process.exit(1);
  }
  return JSON.parse(match[match.length - 1]);
}

// Encode one platform variant.
function encode(platform) {
  const def    = PLATFORM_DEFS[platform];
  const outMp4 = join(outDir, `${edition}-${platform}.mp4`);
  const outThumb = join(outDir, `${edition}-${platform}-thumb.png`);

  console.log(`\n── ${platform.toUpperCase()} ──`);

  // Pass 1: loudness analysis.
  const stats = analyzeLoudness(def.lufs);

  // Pass 2: full encode.
  console.log(`  Encoding → ${outMp4}`);
  const { extraInputs, audioFilter, audioMap } = buildAudioFilter(def.lufs, stats);

  const videoFilter = def.videoFilter
    ? `[0:v]${def.videoFilter}[vout]`
    : '[0:v]copy[vout]';

  const filterComplex = [videoFilter, audioFilter].join('; ');

  execFileSync('ffmpeg', [
    '-y',
    '-i', videoIn,
    ...extraInputs,
    '-filter_complex', filterComplex,
    '-map', '[vout]',
    '-map', audioMap,
    '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k',
    '-movflags', '+faststart',
    outMp4,
  ], { stdio: 'inherit' });

  // Thumbnail: single PNG frame at thumbTime seconds.
  console.log(`  Thumbnail → ${outThumb}`);
  execFileSync('ffmpeg', [
    '-y',
    '-ss', String(def.thumbTime),
    '-i', outMp4,
    '-frames:v', '1',
    '-q:v', '2',
    outThumb,
  ], { stdio: 'pipe' });

  console.log(`  ✓ ${platform}`);
  return { mp4: outMp4, thumb: outThumb };
}

// ── Run ───────────────────────────────────────────────────────────────────────

console.log(`Edition:   ${edition}`);
console.log(`Video:     ${videoIn}`);
console.log(`Bed:       ${bedMusic ?? '(none)'}`);
console.log(`Platforms: ${platforms.join(', ')}`);

const results = {};
for (const platform of platforms) {
  results[platform] = encode(platform);
}

console.log('\n── Done ──');
for (const [p, r] of Object.entries(results)) {
  console.log(`  ${p}: ${r.mp4}`);
  console.log(`         ${r.thumb}`);
}
