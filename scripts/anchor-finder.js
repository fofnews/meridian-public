import { classifyIntent, splitIntoSentences } from './intent-classifier.js';

export const ANCHOR_DEFAULTS = {
  LEAD_TIME_S: 0.4,
  MIN_DWELL_S: 1.8,
  MERGE_SAME_LOCATION_S: 4,
  PULL_BACK_ZOOM_DELTA: -2,
  STAKES_ZOOM_DELTA: 0.5,
  MIN_ZOOM_FLOOR: 2.0,
};

const STATIC_ALIASES = new Map([
  ['United States', ['U.S.', 'US', 'America', 'the United States']],
  ['United Kingdom', ['U.K.', 'UK', 'Britain']],
  ['European Union', ['EU', 'Europe']],
  ['United Arab Emirates', ['UAE', 'the Emirates']],
  ['South Korea', ['Korea']],
  ['Palestinian Territories', ['Palestine', 'Palestinian']],
]);

const ADJECTIVE_MAP = new Map([
  ['Israel', 'Israeli'], ['Russia', 'Russian'], ['China', 'Chinese'],
  ['Iran', 'Iranian'], ['Ukraine', 'Ukrainian'], ['France', 'French'],
  ['Germany', 'German'], ['Syria', 'Syrian'], ['Iraq', 'Iraqi'],
  ['Turkey', 'Turkish'], ['Saudi Arabia', 'Saudi'], ['Pakistan', 'Pakistani'],
  ['Afghanistan', 'Afghan'], ['Lebanon', 'Lebanese'], ['Yemen', 'Yemeni'],
  ['Egypt', 'Egyptian'], ['Jordan', 'Jordanian'], ['India', 'Indian'],
  ['Brazil', 'Brazilian'], ['Mexico', 'Mexican'], ['Venezuela', 'Venezuelan'],
  ['Cuba', 'Cuban'], ['North Korea', 'North Korean'], ['Taiwan', 'Taiwanese'],
  ['Nigeria', 'Nigerian'], ['Somalia', 'Somali'], ['Libya', 'Libyan'],
  ['Sudan', 'Sudanese'], ['Ethiopia', 'Ethiopian'], ['Kenya', 'Kenyan'],
]);

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Build a regex that handles word-boundary for aliases that may start/end
// with non-word characters (e.g. "U.S.", "U.K.").
function aliasRegex(alias) {
  const escaped = escapeRegex(alias);
  // Use lookaround-based boundaries so dots and punctuation in aliases still work.
  return new RegExp('(?<![A-Za-z0-9])' + escaped + "(?:'s)?(?![A-Za-z0-9])", 'gi');
}

export function findAnchors({ locations, timestamps, shotIsoCode }) {
  if (timestamps?.source !== 'elevenlabs') return [];

  const text = timestamps.normalized_text ?? '';
  const charStarts = timestamps.character_start_times_seconds ?? [];
  const charEnds = timestamps.character_end_times_seconds ?? [];

  // Build: alias → Set of locationIdxs that use this alias.
  // Group same-alias entries so that same-name locations with different iso can compete.
  const aliasToIdxs = new Map();

  for (let i = 0; i < locations.length; i++) {
    const loc = locations[i];
    const aliases = new Set([loc.name]);
    const staticList = STATIC_ALIASES.get(loc.name);
    if (staticList) for (const a of staticList) aliases.add(a);
    const adj = ADJECTIVE_MAP.get(loc.name);
    if (adj) aliases.add(adj);
    for (const alias of aliases) {
      if (!aliasToIdxs.has(alias)) aliasToIdxs.set(alias, []);
      aliasToIdxs.get(alias).push(i);
    }
  }

  // Sort aliases longest-first to prevent shorter substrings from shadowing.
  const sortedAliases = [...aliasToIdxs.entries()].sort((a, b) => b[0].length - a[0].length);

  const maskedRanges = [];
  const anchors = [];

  function overlaps(start, end) {
    for (const [ms, me] of maskedRanges) {
      if (start < me && end > ms) return true;
    }
    return false;
  }

  for (const [alias, candidateIdxs] of sortedAliases) {
    const re = aliasRegex(alias);
    let match;
    while ((match = re.exec(text)) !== null) {
      const charStart = match.index;
      const charEnd = match.index + match[0].length;
      if (overlaps(charStart, charEnd)) continue;

      if (charStart >= charStarts.length) {
        console.warn(`anchor-finder: charStart ${charStart} out of range for alias "${alias}"`);
        continue;
      }

      // Among all candidateIdxs that share this alias, pick the best one.
      // Prefer the one whose iso matches shotIsoCode; otherwise pick lowest index.
      let chosenIdx = candidateIdxs[0];
      for (const idx of candidateIdxs) {
        if (locations[idx].iso === shotIsoCode) { chosenIdx = idx; break; }
      }

      const secondsStart = charStarts[charStart];
      const secondsEnd = charEnd - 1 < charEnds.length ? charEnds[charEnd - 1] : secondsStart;

      anchors.push({
        locationIdx: chosenIdx,
        locationName: locations[chosenIdx].name,
        charStart,
        charEnd,
        secondsStart,
        secondsEnd,
        matchedText: match[0],
      });
      maskedRanges.push([charStart, charEnd]);
    }
  }

  anchors.sort((a, b) => a.secondsStart - b.secondsStart);

  // Disambiguate same-name locations that appear at different text positions.
  // If multiple anchors for the same locationName use different locationIdxs,
  // keep only the locationIdx that best matches shotIsoCode (or lowest idx).
  const nameToWinner = new Map();
  for (const anchor of anchors) {
    const name = anchor.locationName;
    const existing = nameToWinner.get(name);
    if (!existing) {
      nameToWinner.set(name, anchor.locationIdx);
    } else if (existing !== anchor.locationIdx) {
      const existingIsoMatch = locations[existing].iso === shotIsoCode;
      const newIsoMatch = locations[anchor.locationIdx].iso === shotIsoCode;
      if (!existingIsoMatch && newIsoMatch) nameToWinner.set(name, anchor.locationIdx);
    }
  }

  // Rewrite all anchors for a given name to use the winner locationIdx.
  for (const anchor of anchors) {
    const winner = nameToWinner.get(anchor.locationName);
    if (winner != null) anchor.locationIdx = winner;
  }

  return anchors;
}

export function filterAnchors(anchors, opts) {
  opts = opts ?? ANCHOR_DEFAULTS;
  const leadGuard = opts.LEAD_TIME_S * 2;

  let result = anchors.filter(a => a.secondsStart >= leadGuard);
  result.sort((a, b) => a.secondsStart - b.secondsStart);

  // Collapse same-location repeats.
  const lastSeenAt = new Map();
  result = result.filter(anchor => {
    const prev = lastSeenAt.get(anchor.locationIdx);
    if (prev != null && anchor.secondsStart - prev < opts.MERGE_SAME_LOCATION_S) return false;
    lastSeenAt.set(anchor.locationIdx, anchor.secondsStart);
    return true;
  });

  // Collapse near-duplicate anchors (different locations within MIN_DWELL_S).
  // After same-location collapse each locationIdx appears at most once, so all remaining
  // anchors are "first occurrences" — tiebreaker is lower secondsStart (earlier = higher salience).
  const EPSILON = 1e-9;
  const keep = [];
  for (const anchor of result) {
    const prevKept = keep[keep.length - 1];
    if (prevKept && anchor.secondsStart - prevKept.secondsStart < opts.MIN_DWELL_S - EPSILON) {
      // prevKept has lower secondsStart → higher salience. Keep prevKept, drop anchor.
    } else {
      keep.push(anchor);
    }
  }

  return keep;
}

// ── Inline camera helpers (mirrors build-shotlist.js, no import to avoid CLI side-effects) ──
// Inline copies of LARGE_COUNTRY_NAMES and COUNTRY_OR_STATE_NAMES from build-shotlist.js — keep in sync.

const PITCH = 50;
const BEARING = -10;

const LARGE_ZOOM_SET = new Set([
  'United States', 'Russia', 'China', 'Canada', 'Brazil', 'Australia', 'India',
  'Argentina', 'Kazakhstan', 'Algeria', 'Democratic Republic of the Congo',
  'Saudi Arabia', 'Mexico', 'Indonesia', 'Sudan', 'Libya', 'Iran', 'Mongolia',
  'Peru', 'Chad', 'Niger', 'Angola', 'Mali', 'South Africa', 'Colombia',
  'Ethiopia', 'Bolivia', 'Mauritania', 'Egypt', 'Tanzania', 'Nigeria',
  'Venezuela', 'Pakistan', 'Namibia', 'Mozambique', 'Turkey', 'Chile',
  'Zambia', 'Myanmar', 'Afghanistan',
]);
const MID_ZOOM_SET = new Set([
  // Countries
  'France', 'Germany', 'United Kingdom', 'Italy', 'Spain', 'Japan', 'South Korea',
  'Ukraine', 'Poland', 'Sweden', 'Norway', 'Finland', 'Denmark', 'Netherlands',
  'Belgium', 'Austria', 'Switzerland', 'Portugal', 'Greece', 'Romania', 'Hungary',
  'Czech Republic', 'Slovakia', 'Bulgaria', 'Serbia', 'Croatia', 'Albania',
  'Slovenia', 'Kosovo', 'Belarus', 'Moldova', 'Estonia', 'Latvia', 'Lithuania',
  'Israel', 'Iraq', 'Syria', 'Jordan', 'Lebanon', 'Yemen', 'Oman',
  'United Arab Emirates', 'UAE', 'Kuwait', 'Qatar', 'Bahrain',
  'Georgia', 'Armenia', 'Azerbaijan', 'Uzbekistan', 'Kyrgyzstan', 'Tajikistan',
  'Turkmenistan', 'Cuba', 'Haiti', 'Dominican Republic', 'Guatemala', 'Honduras',
  'El Salvador', 'Nicaragua', 'Costa Rica', 'Panama', 'Ecuador', 'Paraguay',
  'Uruguay', 'New Zealand', 'Philippines', 'Vietnam', 'Thailand', 'Malaysia',
  'Cambodia', 'Laos', 'Taiwan', 'North Korea', 'Bangladesh', 'Sri Lanka',
  'Nepal', 'Kenya', 'Ghana', 'Ivory Coast', 'Senegal', 'Tunisia', 'Morocco',
  'Zimbabwe', 'Rwanda', 'Uganda', 'Cameroon', 'Somalia', 'South Sudan',
  'Sierra Leone', 'Liberia', 'Guinea', 'Benin', 'Togo', 'Burkina Faso',
  'Malawi', 'Gaza', 'Palestinian Territories', 'Palestine',
  // US states
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
  'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
  'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine',
  'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri',
  'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico',
  'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon',
  'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee',
  'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming', 'Washington D.C.', 'Puerto Rico',
]);

function locationZoom(loc) {
  const name = loc.name ?? '';
  if (LARGE_ZOOM_SET.has(name)) return 5;
  if (MID_ZOOM_SET.has(name)) return 7;
  return 9;
}

function waypointCamera(loc) {
  const isSpecial = loc.iso === 'XX' || (Math.abs(loc.lat ?? 0) < 0.5 && Math.abs(loc.lng ?? 0) < 0.5);
  return { lng: loc.lng, lat: loc.lat, zoom: isSpecial ? 1.5 : locationZoom(loc), pitch: isSpecial ? 0 : PITCH, bearing: BEARING };
}

function waypointHighlight(loc, polygonMap) {
  if (!loc || loc.iso === 'XX' || (Math.abs(loc.lat ?? 0) < 0.5 && Math.abs(loc.lng ?? 0) < 0.5)) return null;
  const zoom = locationZoom(loc);
  const type = zoom <= 4 ? 'country' : zoom <= 6 ? 'state' : 'city';
  const polygon = polygonMap?.get(`${loc.name}|${loc.iso ?? ''}`) ?? null;
  return { type, name: loc.name, iso: loc.iso ?? null, polygon };
}

// ── buildAnchoredCameraPath ───────────────────────────────────────────────────

export function buildAnchoredCameraPath(existingCameraPath, anchors, locations, polygonMap, opts, narration, shotHold) {
  opts = opts ?? ANCHOR_DEFAULTS;

  if (anchors.length === 0) return { cameraPath: existingCameraPath, overlays: [] };

  narration = narration ?? '';
  const sentences = splitIntoSentences(narration);

  // Build cumulative char offsets for each sentence so we can find which sentence
  // contains a given character position in the original narration.
  // ElevenLabs charStart is indexed into normalized_text, not narration; we use
  // matchedText to find the sentence by scanning for the matched substring.
  function sentenceForAnchor(anchor) {
    const target = anchor.matchedText.toLowerCase();
    for (let si = 0; si < sentences.length; si++) {
      if (sentences[si].toLowerCase().includes(target)) return { sentence: sentences[si], idx: si };
    }
    // Fallback: map charStart roughly by cumulative length.
    let cumulative = 0;
    for (let si = 0; si < sentences.length; si++) {
      cumulative += sentences[si].length + 1;
      if (anchor.charStart < cumulative) return { sentence: sentences[si], idx: si };
    }
    return { sentence: sentences[sentences.length - 1] ?? '', idx: sentences.length - 1 };
  }

  // Track first occurrences per locationIdx.
  const firstOccurrence = new Set();

  const waypoints = [];
  const overlays = [];

  let prevWaypoint = existingCameraPath?.length > 0
    ? { ...existingCameraPath[existingCameraPath.length - 1] }
    : null;

  // Determine shotHold from existingCameraPath if not provided.
  const computedShotHold = shotHold ?? (existingCameraPath?.length > 0
    ? Math.max(...existingCameraPath.map(wp => wp.tOffset ?? 0))
    : null);

  const anchorsSorted = [...anchors].sort((a, b) => a.secondsStart - b.secondsStart);

  for (const anchor of anchorsSorted) {
    const tOffset = Math.max(0, anchor.secondsStart - opts.LEAD_TIME_S);
    const loc = locations[anchor.locationIdx];
    if (!loc) continue;

    const isFirst = !firstOccurrence.has(anchor.locationIdx);
    firstOccurrence.add(anchor.locationIdx);

    const { sentence, idx: sentIdx } = sentenceForAnchor(anchor);
    const previousSentence = sentIdx > 0 ? sentences[sentIdx - 1] : null;

    const intent = classifyIntent({
      _anchor: anchor,
      sentenceContainingAnchor: sentence,
      _previousSentence: previousSentence,
      isFirstOccurrenceInShot: isFirst,
    });

    if (intent === 'data') {
      const overlay = { type: 'data-callout', text: anchor.matchedText, tOffset: anchor.secondsStart, durationMs: 2200 };
      if (computedShotHold != null) {
        const maxEnd = computedShotHold - 0.05;
        if (overlay.tOffset + overlay.durationMs / 1000 > maxEnd) {
          overlay.durationMs = Math.max(0, (maxEnd - overlay.tOffset) * 1000);
        }
      }
      overlays.push(overlay);
      continue;
    }

    if (intent === 'hold') continue;

    let newWaypoint = null;

    if (intent === 'reveal' || !prevWaypoint) {
      const cam = waypointCamera(loc);
      const highlight = waypointHighlight(loc, polygonMap);
      newWaypoint = { tOffset, ...cam, ...(highlight ? { highlight } : {}) };
    } else if (intent === 'contrast') {
      const prevLng = prevWaypoint.lng ?? 0;
      const prevLat = prevWaypoint.lat ?? 0;
      const prevZoom = prevWaypoint.zoom ?? locationZoom(loc);

      if (Math.abs(prevLng - loc.lng) > 120) {
        // Too far apart for a pull-back — just fly to the new location.
        const cam = waypointCamera(loc);
        const highlight = waypointHighlight(loc, polygonMap);
        newWaypoint = { tOffset, ...cam, ...(highlight ? { highlight } : {}) };
      } else {
        const midLng = (prevLng + loc.lng) / 2;
        const midLat = (prevLat + loc.lat) / 2;
        const zoom = Math.max(opts.MIN_ZOOM_FLOOR, prevZoom + opts.PULL_BACK_ZOOM_DELTA);
        const inheritedHighlight = prevWaypoint.highlight ?? null;
        newWaypoint = { tOffset, lng: midLng, lat: midLat, zoom, pitch: PITCH, bearing: BEARING, ...(inheritedHighlight ? { highlight: inheritedHighlight } : {}) };
      }
    } else if (intent === 'stakes') {
      const prevZoom = prevWaypoint.zoom ?? locationZoom(loc);
      const zoom = prevZoom + opts.STAKES_ZOOM_DELTA;
      const inheritedHighlight = prevWaypoint.highlight ?? null;
      newWaypoint = {
        tOffset,
        lng: prevWaypoint.lng ?? loc.lng,
        lat: prevWaypoint.lat ?? loc.lat,
        zoom,
        pitch: PITCH,
        bearing: BEARING,
        ...(inheritedHighlight ? { highlight: inheritedHighlight } : {}),
      };
    }

    if (newWaypoint) {
      waypoints.push(newWaypoint);
      prevWaypoint = newWaypoint;
    }
  }

  // Prepend a starting waypoint at tOffset=0 if the first anchor is at tOffset > 0.
  if (waypoints.length > 0 && waypoints[0].tOffset > 0) {
    waypoints.unshift({ ...waypoints[0], tOffset: 0 });
  }

  return { cameraPath: waypoints, overlays };
}

// ── findQuoteOverlays ─────────────────────────────────────────────────────────
// Scans the narration for "quoted phrases", finds their position in the
// ElevenLabs normalized_text, and returns quote-callout overlay entries.

export function findQuoteOverlays({ narration, timestamps, shotHold }) {
  if (timestamps?.source !== 'elevenlabs') return [];

  const text       = timestamps.normalized_text ?? '';
  const charStarts = timestamps.character_start_times_seconds ?? [];
  const charEnds   = timestamps.character_end_times_seconds   ?? [];

  const overlays = [];
  const quoteRe  = /"([^"]+)"/g;
  let m;
  let searchOffset = 0;

  while ((m = quoteRe.exec(narration)) !== null) {
    const quotedText = m[1].trim();
    if (!quotedText || quotedText.length < 3) continue;

    // Find the quoted content in normalized_text (case-insensitive).
    const idx = text.toLowerCase().indexOf(quotedText.toLowerCase(), searchOffset);
    if (idx < 0) continue;

    const tStart = charStarts[idx] ?? null;
    const endIdx = Math.min(idx + quotedText.length - 1, charEnds.length - 1);
    const tEnd   = charEnds[endIdx] ?? null;
    if (tStart == null || tEnd == null) continue;

    searchOffset = idx + quotedText.length;

    const rawDurationMs = Math.max(1500, (tEnd - tStart + 0.3) * 1000);
    const overlay = { type: 'quote-callout', text: quotedText, tOffset: tStart, durationMs: rawDurationMs };

    if (shotHold != null) {
      const maxEnd = shotHold - 0.05;
      if (overlay.tOffset + overlay.durationMs / 1000 > maxEnd) {
        overlay.durationMs = Math.max(0, (maxEnd - overlay.tOffset) * 1000);
      }
    }
    if (overlay.durationMs > 0) overlays.push(overlay);
  }

  return overlays;
}
