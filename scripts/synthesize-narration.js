#!/usr/bin/env node
// Narration synthesis pipeline (item 17).
//
// For each shot in the shot list, calls the TTS provider and saves a WAV.
// Per-shot WAVs are consumed directly by Remotion <Audio> components.
//
// Usage:
//   node scripts/synthesize-narration.js --edition=2026-04-30-evening
//   node scripts/synthesize-narration.js --edition=2026-04-30-evening --dry-run
//
// Environment:
//   ELEVENLABS_API_KEY   Primary provider (preferred quality)
//   ELEVENLABS_VOICE_ID  Override voice (default: George — see docs/voice.md)
//   OPENAI_API_KEY       Fallback provider
//   OPENAI_VOICE         Override voice (default: onyx — see docs/voice.md)
//
// Output:
//   out/audio/<edition>/shot-<n>.wav               per-shot WAV
//   out/audio/<edition>/shot-<n>.timestamps.json   ElevenLabs character timestamps sidecar

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

import { findAnchors, filterAnchors, buildAnchoredCameraPath, ANCHOR_DEFAULTS } from './anchor-finder.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Use system ffmpeg/ffprobe for WAV encoding and duration probing.
const FFMPEG  = 'ffmpeg';
const FFPROBE = 'ffprobe';

// ── Voice config (see docs/voice.md) ─────────────────────────────────────────
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? 'JBFqnCBsd6RMkjVDRZzb'; // George
const OPENAI_VOICE        = process.env.OPENAI_VOICE        ?? 'onyx';

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, ...rest] = a.slice(2).split('='); return [k, rest.join('=') || 'true']; })
);

const edition       = args['edition'];
const dryRun        = args['dry-run']       === 'true';
const noAnchored    = args['no-anchored']   === 'true';
const debugAnchors  = args['debug-anchors'] === 'true';

// ANCHOR_OPTS: start with defaults and apply CLI overrides.
const ANCHOR_OPTS = { ...ANCHOR_DEFAULTS };
if (args['lead-time']  != null) ANCHOR_OPTS.LEAD_TIME_S  = parseFloat(args['lead-time']);
if (args['min-dwell']  != null) ANCHOR_OPTS.MIN_DWELL_S  = parseFloat(args['min-dwell']);

if (!edition) {
  console.error('Usage: node scripts/synthesize-narration.js --edition=YYYY-MM-DD-{morning|evening}');
  process.exit(1);
}

// ── Detect provider ───────────────────────────────────────────────────────────

const elevenKey = process.env.ELEVENLABS_API_KEY;
const openaiKey = process.env.OPENAI_API_KEY;

let provider = null;
if (dryRun) {
  provider = 'dry-run';
} else if (elevenKey) {
  provider = 'elevenlabs';
} else if (openaiKey) {
  provider = 'openai';
} else {
  console.error(
    'No TTS API key found.\n' +
    'Set ELEVENLABS_API_KEY (preferred) or OPENAI_API_KEY, then re-run.\n' +
    'To generate silence for all shots (testing): add --dry-run'
  );
  process.exit(1);
}

console.log(`Provider: ${provider}`);

// ── Load shotlist ─────────────────────────────────────────────────────────────

const shotlistPath = join(ROOT, 'out', 'shotlists', `${edition}.json`);
if (!existsSync(shotlistPath)) {
  console.error(`Shotlist not found: ${shotlistPath}`);
  console.error(`Run first: node scripts/build-shotlist.js --edition=${edition}`);
  process.exit(1);
}

const shotlist = JSON.parse(readFileSync(shotlistPath, 'utf8'));
const outDir   = join(ROOT, 'out', 'audio', edition);
mkdirSync(outDir, { recursive: true });

// ── TTS helpers ───────────────────────────────────────────────────────────────

// Returns { mp3Buf: Buffer, alignment: object } where alignment has:
//   { characters, character_start_times_seconds, character_end_times_seconds }
async function synthesizeElevenLabs(text, voiceId, apiKey) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`,
    {
      method:  'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.45, similarity_boost: 0.75 },
      }),
    }
  );
  if (!res.ok) {
    const msg = await res.text().catch(() => res.status);
    throw new Error(`ElevenLabs ${res.status}: ${msg}`);
  }
  const json = await res.json();
  const mp3Buf = Buffer.from(json.audio_base64, 'base64');
  const al = json.normalized_alignment ?? json.alignment;
  if (!al?.characters) throw new Error('ElevenLabs response missing alignment data');
  return { mp3Buf, alignment: al };
}

async function synthesizeOpenAI(text, voice, apiKey) {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'tts-1-hd', input: text, voice, response_format: 'mp3' }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.status);
    throw new Error(`OpenAI TTS ${res.status}: ${msg}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

// Probe the duration (in seconds) of a WAV file. Returns null on failure.
function probeWavDuration(wavPath) {
  try {
    const out = execFileSync(FFPROBE, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'csv=p=0',
      wavPath,
    ], { stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
    const d = parseFloat(out);
    return isFinite(d) ? d : null;
  } catch {
    return null;
  }
}

// Convert an MP3 buffer to a 44.1kHz stereo PCM WAV file via ffmpeg.
function mp3ToWav(mp3Buf, wavPath) {
  const tmpMp3 = wavPath.replace(/\.wav$/, '.tmp.mp3');
  writeFileSync(tmpMp3, mp3Buf);
  execFileSync(FFMPEG, [
    '-y', '-i', tmpMp3,
    '-ar', '44100', '-ac', '2', '-c:a', 'pcm_s16le',
    wavPath,
  ], { stdio: 'pipe' });
  import('fs').then(({ unlinkSync }) => { try { unlinkSync(tmpMp3); } catch {} });
}

// Generate a silent WAV of exactly `seconds` duration.
function silenceWav(seconds, wavPath) {
  execFileSync(FFMPEG, [
    '-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
    '-t', String(seconds), '-c:a', 'pcm_s16le',
    wavPath,
  ], { stdio: 'pipe' });
}

// ── Per-shot synthesis ────────────────────────────────────────────────────────

const wavPaths = [];

for (let i = 0; i < shotlist.shots.length; i++) {
  const shot    = shotlist.shots[i];
  const wavPath = join(outDir, `shot-${i}.wav`);
  const tsPath  = join(outDir, `shot-${i}.timestamps.json`);
  wavPaths.push(wavPath);

  const narration = (shot.narration ?? '').trim();
  const label     = `Shot ${i} (t=${shot.t}s, hold=${shot.hold}s)`;

  if (!narration || dryRun) {
    // Empty narration or dry-run → silent gap of the shot's hold duration.
    console.log(`${label}: ${dryRun ? 'dry-run silence' : 'empty narration — silent gap'}`);
    silenceWav(shot.hold, wavPath);
    writeFileSync(tsPath, JSON.stringify({ source: null }));
    continue;
  }

  console.log(`${label}: synthesizing ${narration.length} chars…`);
  try {
    if (provider === 'elevenlabs') {
      const { mp3Buf, alignment } = await synthesizeElevenLabs(narration, ELEVENLABS_VOICE_ID, elevenKey);
      mp3ToWav(mp3Buf, wavPath);
      // Write character-level timestamps sidecar.
      writeFileSync(tsPath, JSON.stringify({
        source: 'elevenlabs',
        characters: alignment.characters,
        character_start_times_seconds: alignment.character_start_times_seconds,
        character_end_times_seconds: alignment.character_end_times_seconds,
        normalized_text: alignment.characters.join(''),
      }));
    } else {
      const mp3Buf = await synthesizeOpenAI(narration, OPENAI_VOICE, openaiKey);
      mp3ToWav(mp3Buf, wavPath);
      // OpenAI does not provide timestamps.
      writeFileSync(tsPath, JSON.stringify({ source: null }));
    }
    console.log(`  → ${wavPath}`);
  } catch (err) {
    console.error(`  ✗ TTS failed (${err.message}) — inserting silence`);
    silenceWav(shot.hold, wavPath);
    writeFileSync(tsPath, JSON.stringify({ source: null }));
  }
}

// ── Rewrite shotlist with measured audio durations ────────────────────────────
// Probe each WAV and replace estimated holds with real durations.
// Then recompute shot.t (cumulative) and shotlist.duration so Remotion's
// durationInFrames reflects the actual audio length.

let anyUpdated = false;
for (let i = 0; i < shotlist.shots.length; i++) {
  const shot    = shotlist.shots[i];
  const wavPath = wavPaths[i];
  if (!wavPath) continue;

  const measured = probeWavDuration(wavPath);
  if (measured == null || measured <= 0) continue;

  const newHold = Math.ceil(measured * 1000) / 1000;
  if (newHold === shot.hold) continue;

  // Proportionally rescale cameraPath tOffsets to the new hold duration.
  if (Array.isArray(shot.cameraPath) && shot.hold > 0) {
    const scale = newHold / shot.hold;
    for (const wp of shot.cameraPath) {
      wp.tOffset = Math.round(wp.tOffset * scale * 1000) / 1000;
    }
  }

  shot.hold = newHold;
  anyUpdated = true;
}

if (anyUpdated) {
  const oldDuration = shotlist.duration;

  // Recompute all shot.t values as a cumulative sum.
  let elapsed = 0;
  for (const shot of shotlist.shots) {
    shot.t = Math.round(elapsed * 1000) / 1000;
    elapsed += shot.hold;
  }
  shotlist.duration = elapsed;

  writeFileSync(shotlistPath, JSON.stringify(shotlist, null, 2));
  console.log(`\nShotlist updated with measured durations → ${shotlistPath}`);
  console.log(`Clip duration: ${oldDuration}s (estimated) → ${shotlist.duration}s (measured)`);
}

// ── Re-anchor camera paths using character timestamps ─────────────────────────
// For each shot that has an ElevenLabs timestamps sidecar, find named-location
// mentions in the narration text and rewrite cameraPath waypoints so the map
// flies to each location as it is spoken.

if (!noAnchored) {
  // Determine which shots have real timestamps before loading the report.
  const shotTimestamps = [];
  let hasAnyElevenLabs = false;

  for (let i = 0; i < shotlist.shots.length; i++) {
    const tsPath = join(outDir, `shot-${i}.timestamps.json`);
    let ts = null;
    if (existsSync(tsPath)) {
      try { ts = JSON.parse(readFileSync(tsPath, 'utf8')); } catch { /* ignore */ }
    }
    shotTimestamps.push(ts);
    if (ts?.source === 'elevenlabs') hasAnyElevenLabs = true;
  }

  if (hasAnyElevenLabs) {
    // Lazy-load report — only needed if at least one shot has ElevenLabs timestamps.
    const reportPath = join(ROOT, 'reports', `${edition}.json`);
    let report = null;
    if (existsSync(reportPath)) {
      try { report = JSON.parse(readFileSync(reportPath, 'utf8')); } catch { /* ignore */ }
    }

    let anyReAnchored = false;

    for (let i = 0; i < shotlist.shots.length; i++) {
      const ts = shotTimestamps[i];
      if (!ts || ts.source !== 'elevenlabs') continue;

      const shot = shotlist.shots[i];

      // Guard: storyIndex must be set (added by Task 4 of build-shotlist.js).
      if (shot.storyIndex == null) continue;

      const locations = report?.stories?.[shot.storyIndex]?.analysis?.locations ?? [];
      if (locations.length === 0) continue;

      const rawAnchors = findAnchors({
        locations,
        timestamps: ts,
        shotIsoCode: shot.isoCode ?? null,
      });

      const anchors = filterAnchors(rawAnchors, ANCHOR_OPTS);
      if (anchors.length === 0) continue;

      const result = buildAnchoredCameraPath(
        shot.cameraPath,
        anchors,
        locations,
        null,       // polygonMap — not needed here; highlights already in cameraPath
        ANCHOR_OPTS,
        shot.narration,
        shot.hold,
      );

      shot.cameraPath   = result.cameraPath;
      shot.overlays     = result.overlays;
      shot.cameraSource = 'anchored';
      shot.anchors      = anchors; // diagnostic only

      anyReAnchored = true;

      if (debugAnchors) {
        const matched = anchors.map(a => `${a.locationName}@${a.secondsStart.toFixed(2)}s`).join(', ');
        const matchedNames = new Set(anchors.map(a => a.locationName));
        const missed = locations
          .map(l => l.name)
          .filter(n => !matchedNames.has(n));
        console.log(`[shot ${i}] matched ${anchors.length}/${locations.length} locations: ${matched}`);
        if (missed.length > 0) console.log(`  (missed: ${missed.join(', ')})`);
      }
    }

    if (anyReAnchored) {
      writeFileSync(shotlistPath, JSON.stringify(shotlist, null, 2));
      console.log(`\nShotlist re-anchored with character timestamps → ${shotlistPath}`);
    }
  }
}

console.log(`\nSaved ${wavPaths.length} per-shot WAVs to ${outDir}`);
console.log(`Total shots: ${shotlist.shots.length}  |  Clip duration: ${shotlist.duration}s`);
