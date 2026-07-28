// Shot-level camera and overlay recipe dispatcher.
// Called by build-shotlist.js (camera paths) and synthesize-narration.js (overlay treatments).
//
// Camera paths are deterministic from location count + shot position.
// Overlay treatments supplement the existing anchor-driven overlays in buildScenePlan.

import * as establish    from '../remotion/src/camera-recipes/establish.js';
import * as sweepBetween from '../remotion/src/camera-recipes/sweepBetween.js';
import * as globeSpin    from '../remotion/src/camera-recipes/globeSpin.js';

const PITCH          = 50;   // FOCUSED_PITCH_BROADCAST
const BEARING        = -10;
const FLY_BETWEEN_S  = 2.5;

const isSpecialLoc = loc =>
  loc.iso === 'XX' || (Math.abs(loc.lat) < 0.5 && Math.abs(loc.lng) < 0.5);

// Build a camera waypoint array for a story shot.
// Replaces buildCameraPath() + globeSpinPath() in build-shotlist.js.
//
// locations:       raw analysis.locations (may contain nulls or special-iso entries)
// duration:        shot hold time in seconds
// polygonMap:      pre-fetched polygon cache Map (passed through to waypointHighlight)
// opts.locationZoom:     (loc) => number — zoom tier for a location
// opts.waypointHighlight: (loc, polygonMap) => highlight | null
// opts.isGlobeSpin:       true → always emit a globeSpin regardless of locations
export function buildCameraPath(locations, duration, polygonMap, opts = {}) {
  const { locationZoom, waypointHighlight, isGlobeSpin = false } = opts;

  const zoomFor = loc => (locationZoom ? locationZoom(loc) : 5);
  const hlFor   = loc => (waypointHighlight ? waypointHighlight(loc, polygonMap) : null);

  if (isGlobeSpin) return globeSpin.build({ duration });

  const validLocs = (locations ?? []).filter(l => l?.lat != null && l?.lng != null && !isSpecialLoc(l));

  if (validLocs.length === 0) return globeSpin.build({ duration });

  if (validLocs.length === 1) {
    const loc       = validLocs[0];
    const zoom      = zoomFor(loc);
    const highlight = hlFor(loc);
    const camLoc    = { lng: loc.lng, lat: loc.lat, zoom, ...(highlight ? { highlight } : {}) };
    return establish.build(camLoc, { duration });
  }

  const camLocs = validLocs.map(loc => {
    const zoom      = zoomFor(loc);
    const highlight = hlFor(loc);
    return { lng: loc.lng, lat: loc.lat, zoom, pitch: PITCH, bearing: BEARING, ...(highlight ? { highlight } : {}) };
  });

  return sweepBetween.build(camLocs, { duration, flyBetweenS: FLY_BETWEEN_S });
}

// Build a globe-spin camera path for intro/outro shots.
// bearing0 allows the outro to continue from where the previous shot left off.
export function buildGlobeSpinPath(duration, bearing0 = 0) {
  return globeSpin.build({ duration, bearing0 });
}

// ── Overlay recipe helpers ─────────────────────────────────────────────────────

const ESCALATION_RE   = /escalat|crisis|attack|struck|bomb|strike|threat|conflict|war|offensive|invasion/i;
const CAUSAL_RE       = /because|result|led to|causing|trigger|due to|response|following|after/i;
const MAGNITUDE_RE    = /(\d[\d,.]*)\s*(percent|%|billion|million|thousand|hundred|casualties|dead|wounded|injured|killed)/i;
const TRADE_RE        = /trade|export|import|shipment|supply|flow|transfer|remittance/i;
const DIPLOMATIC_RE   = /talks|negotiat|diplomat|meet|summit|agreement|deal|backchannel|ally|alliance|treaty/i;
const EXCLUSION_RE    = /no.fly|exclusion zone|naval blockade|maritime exclusion|blockade|no.sail|airspace ban|flight ban/i;

// New trigger-specific regexes for the sentence-level dispatch pipeline.
const SPATIAL_RE          = /(\d[\d,.]*)\s*(killed|wounded|dead|injured|casualties)/i;
const MAGNITUDE_NUMERIC_RE = /(\d[\d,.]*)\s*(percent|%|billion|million|thousand|hundred)/i;
const ESCALATION_VERB_RE  = /\b(escalat|invad|struck|attack|bomb|missile|airstrike|offensive)\w*/i;
const CONTESTED_RE        = /\b(contested|disputed|occupied)\b/i;
const FROM_TO_RE          = /\bfrom\s+([\w][\w\s]*?)\s+to\s+([\w][\w\s]*?)(?=[,.\s!?]|$)/i;
const BETWEEN_AND_RE      = /\bbetween\s+([\w][\w\s]*?)\s+and\s+([\w][\w\s]*?)(?=[,.\s!?]|$)/i;
const MOVEMENT_RE         = /\b(shipped|flowed|sent|transferred|deployed|moved|traveled|transported)\b/i;
const COMPARISON_RE       = /\b(unlike|compared to|versus|whereas|while)\b/i;
const CONNECTIVE_RE       = /^(But|However|Yet|Despite|On the other hand)/i;
const ROLE_RE             = /\b(President|Minister|Secretary|Chairman|General|Ambassador|Director)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/;
const PROPER_NOUN_RE      = /\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]+)*\b/g;

function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

function haversineKm(a, b) {
  const R = 6371, toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function pathLenKm(path) { let d = 0; for (let i = 1; i < path.length; i++) d += haversineKm(path[i - 1], path[i]); return d; }

// ── Sentence-level trigger pipeline ────────────────────────────────────────────

// Standard duration table for the durations returned by the trigger dictionary.
const DURATION_TABLE = {
  'label-bloom':          3.5,
  'map-annotation':       3.0,
  'ripple-expand':        3.0,
  'spotlight-mask':       3.5,
  'context-strip':        4.0,
  'magnitude-bubble':     3.5,
  'impact-radius':        4.5,
  'escalation-warning':   3.0,
  'route-reveal':         5.5,
  'flow-arrow':           3.5,   // dynamic: max(3.5, hops * 1.0)
  'particle-trail':       5.0,
  'arc-token':            4.5,
  'connection-arc':       3.0,
  'side-by-side-callout': 4.5,
  'hatched-zone':         5.0,
};

// Split narration into sentences with char-offset info.
// Splits on `. `, `! `, `? ` (keeps punctuation attached).
// Returns [{ text, charStart, charEnd }].
function splitIntoSentences(text) {
  const out = [];
  if (!text) return out;
  const re = /[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    const leading = raw.match(/^\s*/)[0].length;
    const charStart = m.index + leading;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const charEnd = charStart + trimmed.length;
    out.push({ text: trimmed, charStart, charEnd });
  }
  return out;
}

// Map a character offset in narration to an absolute time (seconds).
// Prefer shot.anchors (from TTS) for precision; else use proportional estimate.
function charToSec(charOffset, shot, tStart, shotDuration, totalChars) {
  const anchors = shot.anchors;
  if (Array.isArray(anchors) && anchors.length > 0) {
    // Find the anchor whose char span contains charOffset.
    for (const a of anchors) {
      if (typeof a.charStart === 'number' && typeof a.charEnd === 'number'
          && typeof a.secondsStart === 'number' && typeof a.secondsEnd === 'number'
          && charOffset >= a.charStart && charOffset <= a.charEnd) {
        const span = Math.max(1, a.charEnd - a.charStart);
        const frac = (charOffset - a.charStart) / span;
        return tStart + a.secondsStart + frac * (a.secondsEnd - a.secondsStart);
      }
    }
    // Fallback: use nearest anchor's start time.
    const last = anchors[anchors.length - 1];
    if (typeof last?.secondsEnd === 'number') {
      // Beyond last anchor → clamp to end.
      if (charOffset > (last.charEnd ?? 0)) return tStart + last.secondsEnd;
    }
  }
  const frac = totalChars > 0 ? clamp(charOffset / totalChars, 0, 1) : 0;
  return tStart + frac * shotDuration;
}

// Find first-match char offset for a case-insensitive substring; -1 if not found.
function findMention(haystack, needle) {
  if (!haystack || !needle) return -1;
  return haystack.toLowerCase().indexOf(needle.toLowerCase());
}

// Which unique named waypoints are mentioned in this sentence (case-insensitive)?
function waypointsInSentence(sentence, uniqueNamedWps) {
  const s = sentence.toLowerCase();
  return uniqueNamedWps.filter(wp => wp.highlight?.name && s.includes(wp.highlight.name.toLowerCase()));
}

// Extract proper nouns from a sentence (returns raw matches as strings).
function extractProperNouns(sentence) {
  const out = [];
  let m;
  const re = new RegExp(PROPER_NOUN_RE.source, 'g');
  while ((m = re.exec(sentence)) !== null) out.push(m[0]);
  return out;
}

// Build a candidate overlay treatment with tStart/tEnd clamped to shot bounds.
function makeCandidate(type, tStartRaw, durationSec, priority, extraProps, shotTStart, shotTEnd) {
  const minStart = shotTStart;
  const maxStart = shotTEnd - 0.5;
  const tStart = clamp(tStartRaw, minStart, Math.max(minStart, maxStart));
  const tEndRaw = tStart + durationSec;
  const tEnd = clamp(tEndRaw, tStart + 0.5, shotTEnd - 0.5);
  if (!(tEnd > tStart)) return null;
  return { type, tStart, tEnd, priority, ...extraProps };
}

// Run all 17 triggers against one sentence and return candidates.
function detectSentenceTriggers({
  sentence, sentenceStartSec, sentenceEndSec, shot, tStart, tEnd,
  uniqueNamedWps, primaryLoc, mentionedWpNames, mentionedPrimary,
}) {
  const candidates = [];
  const sentText = sentence.text;
  const wpsInSent = waypointsInSentence(sentText, uniqueNamedWps);
  const firedTypesThisSentence = new Set();

  // T2 (priority 95): casualty count → impact-radius at primaryLoc
  const spatialMatch = SPATIAL_RE.exec(sentText);
  if (spatialMatch && primaryLoc) {
    const rawVal = parseFloat(spatialMatch[1].replace(/,/g, ''));
    if (!isNaN(rawVal) && rawVal > 0) {
      const radiusKm = clamp(rawVal * 5, 50, 800);
      const c = makeCandidate(
        'impact-radius',
        sentenceStartSec,
        DURATION_TABLE['impact-radius'],
        95,
        { lat: primaryLoc.lat, lng: primaryLoc.lng, radiusKm },
        tStart, tEnd,
      );
      if (c) { candidates.push(c); firedTypesThisSentence.add('impact-radius'); }
    }
  }

  // T3 (priority 90): non-casualty magnitude → magnitude-bubble at primaryLoc
  const magMatch = MAGNITUDE_NUMERIC_RE.exec(sentText);
  if (magMatch && primaryLoc) {
    const rawVal = parseFloat(magMatch[1].replace(/,/g, ''));
    if (!isNaN(rawVal) && rawVal > 0) {
      const c = makeCandidate(
        'magnitude-bubble',
        sentenceStartSec,
        DURATION_TABLE['magnitude-bubble'],
        90,
        { lat: primaryLoc.lat, lng: primaryLoc.lng, value: rawVal },
        tStart, tEnd,
      );
      if (c) { candidates.push(c); firedTypesThisSentence.add('magnitude-bubble'); }
    }
  }

  // T4 (priority 85): escalation verb → escalation-warning
  const escMatch = ESCALATION_VERB_RE.exec(sentText);
  if (escMatch) {
    const rawPhrase = escMatch[0].trim();
    const c = makeCandidate(
      'escalation-warning',
      sentenceStartSec,
      DURATION_TABLE['escalation-warning'],
      85,
      { text: rawPhrase.charAt(0).toUpperCase() + rawPhrase.slice(1) },
      tStart, tEnd,
    );
    if (c) { candidates.push(c); firedTypesThisSentence.add('escalation-warning'); }
  }

  // T5 (priority 80): exclusion + primaryLoc polygon → hatched-zone (exclusion)
  if (EXCLUSION_RE.test(sentText) && primaryLoc?.highlight?.polygon) {
    const c = makeCandidate(
      'hatched-zone',
      sentenceStartSec,
      DURATION_TABLE['hatched-zone'],
      80,
      { polygon: primaryLoc.highlight.polygon, pattern: 'exclusion' },
      tStart, tEnd,
    );
    if (c) { candidates.push(c); firedTypesThisSentence.add('hatched-zone'); }
  }

  // T6 (priority 78): contested/disputed/occupied + primaryLoc polygon → hatched-zone (contested)
  if (CONTESTED_RE.test(sentText) && primaryLoc?.highlight?.polygon
      && !firedTypesThisSentence.has('hatched-zone')) {
    const c = makeCandidate(
      'hatched-zone',
      sentenceStartSec,
      DURATION_TABLE['hatched-zone'],
      78,
      { polygon: primaryLoc.highlight.polygon, pattern: 'contested' },
      tStart, tEnd,
    );
    if (c) { candidates.push(c); firedTypesThisSentence.add('hatched-zone'); }
  }

  // T7 (priority 75): "from X to Y" matching ≥2 named waypoints → route-reveal
  const ftMatch = FROM_TO_RE.exec(sentText);
  if (ftMatch) {
    const nameA = ftMatch[1];
    const nameB = ftMatch[2];
    const wpA = uniqueNamedWps.find(wp => wp.highlight?.name?.toLowerCase() === nameA.toLowerCase());
    const wpB = uniqueNamedWps.find(wp => wp.highlight?.name?.toLowerCase() === nameB.toLowerCase());
    if (wpA && wpB && wpA !== wpB) {
      const dur = DURATION_TABLE['route-reveal'];
      const c = makeCandidate(
        'route-reveal',
        sentenceStartSec,
        dur,
        75,
        {
          from: { lat: wpA.lat, lng: wpA.lng },
          to:   { lat: wpB.lat, lng: wpB.lng },
          revealDuration: 3.5,
          style: 'dashed',
          mode: 'geodesic',
        },
        tStart, tEnd,
      );
      if (c) { candidates.push(c); firedTypesThisSentence.add('route-reveal'); }
    }
  }

  // T8 (priority 74): "between X and Y" + diplomatic → connection-arc
  const baMatch = BETWEEN_AND_RE.exec(sentText);
  if (baMatch && DIPLOMATIC_RE.test(sentText)) {
    const nameA = baMatch[1];
    const nameB = baMatch[2];
    const wpA = uniqueNamedWps.find(wp => wp.highlight?.name?.toLowerCase() === nameA.toLowerCase());
    const wpB = uniqueNamedWps.find(wp => wp.highlight?.name?.toLowerCase() === nameB.toLowerCase());
    if (wpA && wpB && wpA !== wpB) {
      const c = makeCandidate(
        'connection-arc',
        sentenceStartSec,
        DURATION_TABLE['connection-arc'],
        74,
        { fromLat: wpA.lat, fromLng: wpA.lng, toLat: wpB.lat, toLng: wpB.lng },
        tStart, tEnd,
      );
      if (c) { candidates.push(c); firedTypesThisSentence.add('connection-arc'); }
    }
  }

  // T9 (priority 72): sentence mentions 3+ named waypoints in the order they appear in uniqueNamedWps
  if (wpsInSent.length >= 3) {
    // Check they appear in uniqueNamedWps order (indices should be strictly increasing).
    const indices = wpsInSent.map(wp => uniqueNamedWps.indexOf(wp));
    let ordered = true;
    for (let i = 1; i < indices.length; i++) {
      if (indices[i] <= indices[i - 1]) { ordered = false; break; }
    }
    if (ordered) {
      const path = wpsInSent.map(wp => ({ lng: wp.lng, lat: wp.lat }));
      const hops = Math.max(1, path.length - 1);
      const dur = Math.max(3.5, hops * 1.0);
      const c = makeCandidate(
        'flow-arrow',
        sentenceStartSec,
        dur,
        72,
        {
          style: 'arrow',
          flows: [{
            path,
            label: wpsInSent[wpsInSent.length - 1].highlight.name,
            revealDuration: Math.min(3.5, dur * 0.6),
            revealDelay: 0,
          }],
        },
        tStart, tEnd,
      );
      if (c) { candidates.push(c); firedTypesThisSentence.add('flow-arrow'); }
    }
  }

  // T10 (priority 70): movement verb + ≥2 named waypoints mentioned → particle-trail
  if (MOVEMENT_RE.test(sentText) && wpsInSent.length >= 2) {
    const path = wpsInSent.map(wp => ({ lat: wp.lat, lng: wp.lng }));
    const lenKm = pathLenKm(path);
    const c = makeCandidate(
      'particle-trail',
      sentenceStartSec,
      DURATION_TABLE['particle-trail'],
      70,
      {
        path,
        particleCount: clamp(Math.round(lenKm / 500), 3, 10),
        speed:         clamp(0.15 + lenKm / 20000, 0.15, 0.45),
      },
      tStart, tEnd,
    );
    if (c) { candidates.push(c); firedTypesThisSentence.add('particle-trail'); }
  }

  // T11 (priority 68): trade vocab + ≥2 named waypoints → arc-token
  if (TRADE_RE.test(sentText) && wpsInSent.length >= 2) {
    const arcs = [];
    for (let i = 0; i < wpsInSent.length - 1; i++) {
      arcs.push({
        from: { lat: wpsInSent[i].lat,     lng: wpsInSent[i].lng },
        to:   { lat: wpsInSent[i + 1].lat, lng: wpsInSent[i + 1].lng },
      });
    }
    if (arcs.length > 0) {
      const c = makeCandidate(
        'arc-token',
        sentenceStartSec,
        DURATION_TABLE['arc-token'],
        68,
        { arcs },
        tStart, tEnd,
      );
      if (c) { candidates.push(c); firedTypesThisSentence.add('arc-token'); }
    }
  }

  // T12 (priority 65): comparison + 2+ named waypoints OR 2+ proper nouns
  const cmpMatch = COMPARISON_RE.exec(sentText);
  if (cmpMatch) {
    let labelA, valueA, labelB, valueB;
    if (wpsInSent.length >= 2) {
      labelA = 'LOCATION A'; valueA = wpsInSent[0].highlight.name;
      labelB = 'LOCATION B'; valueB = wpsInSent[1].highlight.name;
    } else {
      const afterIdx = cmpMatch.index + cmpMatch[0].length;
      const rest = sentText.slice(afterIdx);
      const nouns = extractProperNouns(rest);
      if (nouns.length >= 2) {
        labelA = 'ENTITY A'; valueA = nouns[0];
        labelB = 'ENTITY B'; valueB = nouns[1];
      }
    }
    if (valueA && valueB) {
      const c = makeCandidate(
        'side-by-side-callout',
        sentenceStartSec,
        DURATION_TABLE['side-by-side-callout'],
        65,
        { labelA, valueA, labelB, valueB },
        tStart, tEnd,
      );
      if (c) {
        candidates.push(c);
        firedTypesThisSentence.add('side-by-side-callout');
      }
    }
  }

  // T13 (priority 55): sentence starts with connective → context-strip.
  // Coexists with T12 if both triggers match; slot system resolves priority conflicts.
  if (CONNECTIVE_RE.test(sentText)) {
    const c = makeCandidate(
      'context-strip',
      sentenceStartSec,
      DURATION_TABLE['context-strip'],
      55,
      { text: sentText.slice(0, 60) },
      tStart, tEnd,
    );
    if (c) { candidates.push(c); firedTypesThisSentence.add('context-strip'); }
  }

  // T14 (priority 60): first mention of primaryLoc.name in narration → label-bloom.
  // Only fire once per shot. mentionedPrimary is a { fired } holder shared across sentences.
  if (primaryLoc?.name && !mentionedPrimary.fired
      && findMention(sentText, primaryLoc.name) >= 0) {
    mentionedPrimary.fired = true;
    const c = makeCandidate(
      'label-bloom',
      sentenceStartSec,
      DURATION_TABLE['label-bloom'],
      60,
      { lat: primaryLoc.lat, lng: primaryLoc.lng, text: primaryLoc.name },
      tStart, tEnd,
    );
    if (c) { candidates.push(c); firedTypesThisSentence.add('label-bloom'); }
  }

  // T15 (priority 50): first mention of uniqueNamedWps[n].name (n ≥ 1) → map-annotation.
  for (let i = 1; i < uniqueNamedWps.length; i++) {
    const wp = uniqueNamedWps[i];
    const name = wp.highlight?.name;
    if (!name) continue;
    if (mentionedWpNames.has(name)) continue;
    if (findMention(sentText, name) >= 0) {
      mentionedWpNames.add(name);
      const c = makeCandidate(
        'map-annotation',
        sentenceStartSec,
        DURATION_TABLE['map-annotation'],
        50,
        { lat: wp.lat, lng: wp.lng, text: name },
        tStart, tEnd,
      );
      if (c) { candidates.push(c); firedTypesThisSentence.add('map-annotation'); }
    }
  }

  // T16 (priority 45): role + name → context-strip
  const roleMatch = ROLE_RE.exec(sentText);
  if (roleMatch) {
    const roleAndName = `${roleMatch[1]} ${roleMatch[2]}`;
    const c = makeCandidate(
      'context-strip',
      sentenceStartSec,
      DURATION_TABLE['context-strip'],
      45,
      { text: roleAndName },
      tStart, tEnd,
    );
    if (c) { candidates.push(c); firedTypesThisSentence.add('context-strip'); }
  }

  // T17 (priority 40): sentence mentions any named waypoint but no other trigger fired.
  if (wpsInSent.length > 0 && firedTypesThisSentence.size === 0) {
    const wp = wpsInSent[0];
    const c = makeCandidate(
      'ripple-expand',
      sentenceStartSec,
      DURATION_TABLE['ripple-expand'],
      40,
      { lat: wp.lat, lng: wp.lng },
      tStart, tEnd,
    );
    if (c) { candidates.push(c); firedTypesThisSentence.add('ripple-expand'); }
  }

  return candidates;
}

// Greedy priority slotting with gap / concurrency / density constraints.
function placeCandidates(candidates, target, minGap, maxConcurrent) {
  // Sort priority desc; ties broken by earlier tStart.
  const sorted = [...candidates].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.tStart - b.tStart;
  });
  const placed = [];
  const labelBloomNamesPlaced = new Set();  // deduplicates by cand.text (the location name)
  let mapAnnotationCount = 0;
  const contextStripTextsPlaced = new Set();  // deduplicates context-strip by text; max 2 allowed

  for (const cand of sorted) {
    if (placed.length >= target) break;

    // Gap constraint: no already-placed overlay starts within MIN_GAP seconds.
    let violatesGap = false;
    for (const p of placed) {
      if (Math.abs(p.tStart - cand.tStart) < minGap) { violatesGap = true; break; }
    }
    if (violatesGap) continue;

    // Same-type constraint with exceptions.
    if (cand.type === 'label-bloom') {
      // Deduplicates by cand.text (the location name).
      if (labelBloomNamesPlaced.has(cand.text)) continue;
    } else if (cand.type === 'map-annotation') {
      if (mapAnnotationCount >= 4) continue;
    } else if (cand.type === 'context-strip') {
      // Allow up to 2 context-strips per shot; deduplicate by text (T13 and T16 differ).
      if (contextStripTextsPlaced.has(cand.text) || contextStripTextsPlaced.size >= 2) continue;
    } else {
      // General rule: reject same-type duplicate.
      if (placed.some(p => p.type === cand.type)) continue;
    }

    // Concurrency: count how many placed overlays' [tStart, tEnd] overlaps this candidate.
    let overlaps = 0;
    for (const p of placed) {
      if (p.tStart < cand.tEnd && p.tEnd > cand.tStart) overlaps++;
    }
    if (overlaps >= maxConcurrent) continue;

    placed.push(cand);
    if (cand.type === 'label-bloom') labelBloomNamesPlaced.add(cand.text);
    if (cand.type === 'map-annotation') mapAnnotationCount++;
    if (cand.type === 'context-strip') contextStripTextsPlaced.add(cand.text);
  }

  return placed;
}

// Ambient fill: walk shot in 6-second windows and fill empty ones.
function fillAmbient({
  placed, target, uniqueNamedWps, primaryLoc, tStart, tEnd, shot, sentences,
}) {
  if (placed.length >= target) return;

  const usedWpNames = new Set(
    placed.filter(p => p.type === 'label-bloom' || p.type === 'map-annotation').map(p => p.text)
  );
  // Also seed with waypoints already used elsewhere (e.g. via ripple).
  for (const p of placed) {
    if (p.text) usedWpNames.add(p.text);
  }

  const shotDuration = tEnd - tStart;
  for (let windowStart = tStart; windowStart < tEnd - 0.5 && placed.length < target; windowStart += 6) {
    const windowEnd = Math.min(windowStart + 6, tEnd);
    // Skip if any overlay already starts in this window.
    const anyStarts = placed.some(p => p.tStart >= windowStart && p.tStart < windowEnd);
    if (anyStarts) continue;

    let fired = false;

    // Stage 3 is a sequential first-match cascade: try step 1; if it fires,
    // skip 2–4. If not, try step 2; etc. Only one overlay per 6s window.

    // 1. Unused named waypoint → label-bloom.
    if (!fired) {
      const unusedWp = uniqueNamedWps.find(wp => wp.highlight?.name && !usedWpNames.has(wp.highlight.name));
      if (unusedWp) {
        const c = makeCandidate(
          'label-bloom',
          windowStart + 0.5,
          DURATION_TABLE['label-bloom'],
          1,
          { lat: unusedWp.lat, lng: unusedWp.lng, text: unusedWp.highlight.name },
          tStart, tEnd,
        );
        if (c) {
          placed.push(c);
          usedWpNames.add(unusedWp.highlight.name);
          fired = true;
        }
      }
    }

    // 2. Else primaryLoc → ripple-expand.
    if (!fired && primaryLoc) {
      const c = makeCandidate(
        'ripple-expand',
        windowStart + 0.5,
        DURATION_TABLE['ripple-expand'],
        1,
        { lat: primaryLoc.lat, lng: primaryLoc.lng },
        tStart, tEnd,
      );
      if (c) { placed.push(c); fired = true; }
    }

    // 3. Chyron headline + sentence-in-window has proper noun → context-strip.
    if (!fired && shot.chyron?.headline) {
      const totalChars = (shot.narration ?? '').length;
      const inWindowSentence = sentences.find(s => {
        const sMid = charToSec((s.charStart + s.charEnd) / 2, shot, tStart, shotDuration, totalChars);
        return sMid >= windowStart && sMid < windowEnd;
      });
      if (inWindowSentence) {
        const nouns = extractProperNouns(inWindowSentence.text);
        if (nouns.length > 0) {
          const hasContextStrip = placed.some(p => p.type === 'context-strip');
          if (!hasContextStrip) {
            const c = makeCandidate(
              'context-strip',
              windowStart + 0.5,
              DURATION_TABLE['context-strip'],
              1,
              { text: inWindowSentence.text.slice(0, 60) },
              tStart, tEnd,
            );
            if (c) { placed.push(c); fired = true; }
          }
        }
      }
    }
  }
}

// Pick additional ScenePlan overlay treatments for a shot.
// Called from synthesize-narration.js:buildScenePlan after anchor processing.
// Returns an array of Treatment objects to merge into the scene's treatments[].
//
// Pipeline:
//   0. Always-on rules (spotlight-mask for high-impact establish shots).
//   1. Split narration into sentences and run 17 triggers.
//   2. Priority-based slotting with gap / concurrency / density limits.
//   3. Ambient fill to reach TARGET_DENSITY.
//
// shot:   the finalized shot object (has cameraPath, overlays, hold, t,
//          dominantIntent/shotIntent, impact, storyIndex, narration, chyron, anchors, viz)
// tStart: absolute start time of the shot in the shotlist (= shot.t)
export function pickOverlayRecipes(shot, tStart) {
  const result       = [];
  const cameraPath   = shot.cameraPath ?? [];
  const namedWps     = cameraPath.filter(wp => wp.highlight?.name);
  const shotDuration = shot.hold ?? 5;
  const tEnd         = tStart + shotDuration;
  const narration    = shot.narration ?? '';
  const impact       = shot.impact ?? 0;

  // Deduplicate named waypoints by name (sweep paths repeat waypoints per location).
  const seenNames = new Set();
  const uniqueNamedWps = namedWps.filter(wp => {
    if (seenNames.has(wp.highlight.name)) return false;
    seenNames.add(wp.highlight.name);
    return true;
  });

  const primaryLoc = uniqueNamedWps[0]
    ? {
        lat:  uniqueNamedWps[0].lat,
        lng:  uniqueNamedWps[0].lng,
        name: uniqueNamedWps[0].highlight?.name,
        highlight: uniqueNamedWps[0].highlight,
      }
    : null;

  // ── Stage 0: Always-on rules ────────────────────────────────────────────────
  // spotlight-mask for high-impact establish shots. Doesn't count against density.
  if (shot.isEstablish && impact >= 0.5 && primaryLoc) {
    const smStart = tStart + 1.5;
    const smEnd = clamp(tStart + 8, smStart + 1, tEnd - 0.5);
    if (smEnd > smStart) {
      result.push({
        type: 'spotlight-mask',
        tStart: smStart,
        tEnd: smEnd,
        lat: primaryLoc.lat,
        lng: primaryLoc.lng,
      });
    }
  }

  // If there's no narration and no waypoints, we still return spotlight-mask (if any).
  if (!narration && uniqueNamedWps.length === 0) return result;

  // ── Stage 1: Detect candidates from every sentence ─────────────────────────
  const sentences = splitIntoSentences(narration);
  const totalChars = narration.length;

  // Cross-sentence state.
  const mentionedWpNames = new Set();   // for T15 (secondary waypoints)
  const mentionedPrimary = { fired: false };   // for T14 (primary loc)

  const candidates = [];
  for (const sent of sentences) {
    const sentenceStartSec = charToSec(sent.charStart, shot, tStart, shotDuration, totalChars);
    const sentenceEndSec   = charToSec(sent.charEnd,   shot, tStart, shotDuration, totalChars);
    const sentCandidates = detectSentenceTriggers({
      sentence: sent,
      sentenceStartSec,
      sentenceEndSec,
      shot,
      tStart,
      tEnd,
      uniqueNamedWps,
      primaryLoc,
      mentionedWpNames,
      mentionedPrimary,
    });
    candidates.push(...sentCandidates);
  }

  // Guarantee T14 fires: if primaryLoc exists but wasn't mentioned in narration,
  // still emit a label-bloom at tStart (the "always-on for named waypoint" rule).
  if (primaryLoc && !mentionedPrimary.fired) {
    const c = makeCandidate(
      'label-bloom',
      tStart,
      DURATION_TABLE['label-bloom'],
      60,
      { lat: primaryLoc.lat, lng: primaryLoc.lng, text: primaryLoc.name },
      tStart, tEnd,
    );
    if (c) candidates.push(c);
  }

  // ── Stage 2: Priority slotting ─────────────────────────────────────────────
  const MIN_GAP = 2;
  const MAX_CONCURRENT = 2;
  const TARGET_DENSITY = Math.min(10, Math.max(1, Math.floor(shotDuration / 6)));

  const placed = placeCandidates(candidates, TARGET_DENSITY, MIN_GAP, MAX_CONCURRENT);

  // ── Stage 3: Ambient fill ──────────────────────────────────────────────────
  fillAmbient({
    placed,
    target: TARGET_DENSITY,
    uniqueNamedWps,
    primaryLoc,
    tStart,
    tEnd,
    shot,
    sentences,
  });

  // Strip internal `priority` field before returning.
  for (const p of placed) {
    const { priority, ...rest } = p;
    result.push(rest);
  }

  return result;
}
