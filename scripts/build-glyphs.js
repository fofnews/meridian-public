#!/usr/bin/env node
// One-shot: downloads Playfair Display + Noto Sans TTF from Google Fonts,
// generates Mapbox-compatible SDF PBF glyph tiles for all Unicode ranges,
// and writes them to public/fonts/{fontstack}/{start}-{end}.pbf.
// Run once and commit the output, similar to build-meridian-styles.js.
// Usage: node scripts/build-glyphs.js

import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const fontnik = require('fontnik');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Fonts to generate: [stackName, googleFamily, cssWeight]
const FONTS = [
  ['Playfair Display Bold',    'Playfair+Display', 700],
  ['Playfair Display Regular', 'Playfair+Display', 400],
  ['Noto Sans Bold',           'Noto+Sans',        700],
  ['Noto Sans Regular',        'Noto+Sans',        400],
];

// All 256 Unicode PBF ranges (0-255, 256-511, ..., 65280-65535)
const RANGES = Array.from({ length: 256 }, (_, i) => [i * 256, i * 256 + 255]);

async function fetchTtfBuffer(family, weight) {
  const url = `https://fonts.googleapis.com/css?family=${family}:${weight}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Fonts CSS fetch failed: ${res.status}`);
  const css = await res.text();
  const match = css.match(/url\(([^)]+\.ttf)\)/);
  if (!match) throw new Error(`No TTF URL found in CSS for ${family}:${weight}`);
  const ttfRes = await fetch(match[1]);
  if (!ttfRes.ok) throw new Error(`TTF download failed: ${ttfRes.status}`);
  return Buffer.from(await ttfRes.arrayBuffer());
}

function generateRange(fontBuffer, start, end) {
  return new Promise((resolve, reject) =>
    fontnik.range({ font: fontBuffer, start, end }, (err, data) =>
      err ? reject(err) : resolve(data)
    )
  );
}

async function buildFont(stackName, family, weight) {
  console.log(`\n[${stackName}] Downloading TTF (${family}:${weight})...`);
  const fontBuf = await fetchTtfBuffer(family, weight);
  console.log(`  ${Math.round(fontBuf.length / 1024)} KB`);

  const outDir = path.join(ROOT, 'public', 'fonts', stackName);
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`  Generating ${RANGES.length} PBF ranges...`);
  let written = 0;
  // Process in batches of 16 to avoid overwhelming the native binding
  for (let i = 0; i < RANGES.length; i += 16) {
    const batch = RANGES.slice(i, i + 16);
    const results = await Promise.all(
      batch.map(([start, end]) => generateRange(fontBuf, start, end))
    );
    for (let j = 0; j < batch.length; j++) {
      const [start, end] = batch[j];
      fs.writeFileSync(path.join(outDir, `${start}-${end}.pbf`), results[j]);
      written++;
    }
  }
  console.log(`  Wrote ${written} files → public/fonts/${stackName}/`);
}

async function main() {
  console.log('Building self-hosted glyph PBF tiles...');
  for (const [stackName, family, weight] of FONTS) {
    await buildFont(stackName, family, weight);
  }
  console.log('\nDone. Run npm run build-styles to apply the new glyphs URL.');
}

main().catch(err => { console.error(err); process.exit(1); });
