#!/usr/bin/env node
// Narration synthesis pipeline (item 17).
//
// For each shot in the shot list, calls the TTS provider and saves a WAV,
// then uses ffmpeg to build a timed mix aligned to the video timeline
// (PRE_ROLL + shot.t seconds offset per shot).
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
//   out/audio/<edition>/shot-<n>.wav     per-shot WAV
//   out/audio/<edition>/full.wav         timed mix aligned to video timeline

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Use system ffmpeg (Playwright's bundled build is audio-stripped).
// Install: sudo apt-get install -y ffmpeg
const FFMPEG = 'ffmpeg';

// Must match BroadcastStage PRE_ROLL_MS so audio aligns with the black
// fade-in that precedes the first shot.
const PRE_ROLL_MS = 1000;

// ── Voice config (see docs/voice.md) ─────────────────────────────────────────
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? 'JBFqnCBsd6RMkjVDRZzb'; // George
const OPENAI_VOICE        = process.env.OPENAI_VOICE        ?? 'onyx';

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, ...rest] = a.slice(2).split('='); return [k, rest.join('=') || 'true']; })
);

const edition = args['edition'];
const dryRun  = args['dry-run'] === 'true';

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

async function synthesizeElevenLabs(text, voiceId, apiKey) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
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
  return Buffer.from(await res.arrayBuffer());
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
  wavPaths.push(wavPath);

  const narration = (shot.narration ?? '').trim();
  const label     = `Shot ${i} (t=${shot.t}s, hold=${shot.hold}s)`;

  if (!narration || dryRun) {
    // Empty narration or dry-run → silent gap of the shot's hold duration.
    console.log(`${label}: ${dryRun ? 'dry-run silence' : 'empty narration — silent gap'}`);
    silenceWav(shot.hold, wavPath);
    continue;
  }

  console.log(`${label}: synthesizing ${narration.length} chars…`);
  try {
    let mp3Buf;
    if (provider === 'elevenlabs') {
      mp3Buf = await synthesizeElevenLabs(narration, ELEVENLABS_VOICE_ID, elevenKey);
    } else {
      mp3Buf = await synthesizeOpenAI(narration, OPENAI_VOICE, openaiKey);
    }
    mp3ToWav(mp3Buf, wavPath);
    console.log(`  → ${wavPath}`);
  } catch (err) {
    console.error(`  ✗ TTS failed (${err.message}) — inserting silence`);
    silenceWav(shot.hold, wavPath);
  }
}

// ── Timed mix → full.wav ──────────────────────────────────────────────────────
// Each shot's audio is delayed to PRE_ROLL_MS + shot.t * 1000 so it aligns
// with the video frame where that shot's camera move begins.

console.log('\nBuilding timed mix…');

const fullWavPath = join(outDir, 'full.wav');
const n = shotlist.shots.length;

const filterParts = shotlist.shots.map((shot, i) => {
  const delayMs = PRE_ROLL_MS + Math.round(shot.t * 1000);
  return `[${i}:a]adelay=${delayMs}|${delayMs}[a${i}]`;
});
const mixIn        = shotlist.shots.map((_, i) => `[a${i}]`).join('');
const filterComplex = [...filterParts, `${mixIn}amix=inputs=${n}:duration=longest:normalize=0[out]`].join('; ');

execFileSync(FFMPEG, [
  '-y',
  ...wavPaths.flatMap(p => ['-i', p]),
  '-filter_complex', filterComplex,
  '-map', '[out]',
  '-ar', '44100', '-ac', '2', '-c:a', 'pcm_s16le',
  fullWavPath,
], { stdio: 'inherit' });

console.log(`\nSaved: ${fullWavPath}`);
console.log(`Total shots: ${n}  |  Video duration: ${PRE_ROLL_MS / 1000 + shotlist.duration}s (incl. pre-roll)`);
