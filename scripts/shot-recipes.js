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

function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

function haversineKm(a, b) {
  const R = 6371, toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function pathLenKm(path) { let d = 0; for (let i = 1; i < path.length; i++) d += haversineKm(path[i - 1], path[i]); return d; }

// Pick additional ScenePlan overlay treatments for a shot.
// Called from synthesize-narration.js:buildScenePlan after anchor processing.
// Returns an array of Treatment objects to merge into the scene's treatments[].
//
// shot:   the finalized shot object (has cameraPath, overlays, hold, t,
//          dominantIntent, impact, storyIndex, narration, viz)
// tStart: absolute start time of the shot in the shotlist (= shot.t)
export function pickOverlayRecipes(shot, tStart) {
  const extra        = [];
  const cameraPath   = shot.cameraPath ?? [];
  const namedWps     = cameraPath.filter(wp => wp.highlight?.name);
  const shotDuration = shot.hold ?? 5;
  const tEnd         = tStart + shotDuration;
  const narration    = shot.narration ?? '';
  const intent       = shot.shotIntent ?? shot.dominantIntent ?? null;
  const impact       = shot.impact ?? 0;

  // Count unique geo-locations in this shot (deduplicate by rounded lng/lat).
  const seen = new Set();
  for (const wp of cameraPath) {
    if (wp.lng != null && wp.lat != null && (wp.zoom ?? 10) > 2) {
      seen.add(`${wp.lng.toFixed(2)},${wp.lat.toFixed(2)}`);
    }
  }
  const numLocs = seen.size;

  // Deduplicate named waypoints by location name (sweep paths repeat waypoints per location).
  const seenNamesSet = new Set();
  const uniqueNamedWps = namedWps.filter(wp => {
    if (seenNamesSet.has(wp.highlight.name)) return false;
    seenNamesSet.add(wp.highlight.name);
    return true;
  });

  // ── Any shot with a named waypoint → label-bloom ──────────────────────────
  if (namedWps.length > 0) {
    const { lat, lng } = namedWps[0];
    const name = namedWps[0].highlight.name;
    const hasLowerThird = (shot.overlays ?? []).some(ov => ov.type === 'quote-callout');
    const bloomCap = hasLowerThird ? tStart + 2 : tStart + 4;
    const bloomEnd = clamp(bloomCap, tStart + 0.5, tEnd - 0.5);
    if (bloomEnd > tStart) {
      extra.push({ type: 'label-bloom', tStart, tEnd: bloomEnd, lat, lng, text: name });
    }
  }

  // ── No intent: legacy ripple-expand fallback for context-label overlays ───
  if (!intent) {
    const hasContext = (shot.overlays ?? []).some(ov => ov.type === 'context-label');
    if (hasContext && namedWps.length > 0) {
      const { lat, lng } = namedWps[0];
      const rippleEnd = clamp(tStart + 3, tStart + 0.5, tEnd - 0.5);
      if (rippleEnd > tStart) {
        extra.push({ type: 'ripple-expand', tStart, tEnd: rippleEnd, lat, lng });
      }
    }
    return extra;
  }

  // ── Secondary named locations → map-annotation ────────────────────────────
  if (uniqueNamedWps.length >= 2) {
    for (let i = 1; i < Math.min(uniqueNamedWps.length, 4); i++) {
      const wp = uniqueNamedWps[i];
      const maStart = tStart + 1.5 + i * 0.6;
      const maEnd   = clamp(tStart + 6 + i * 0.6, maStart + 1, tEnd - 0.5);
      if (maEnd > maStart) {
        extra.push({ type: 'map-annotation', tStart: maStart, tEnd: maEnd,
                     lat: wp.lat, lng: wp.lng, text: wp.highlight.name });
      }
    }
  }

  // ── First-story establish shot with high impact → spotlight-mask ──────────
  if (shot.isEstablish && impact >= 0.5 && namedWps.length > 0) {
    const { lat, lng } = namedWps[0];
    const smStart = tStart + 1.5;
    const smEnd   = clamp(tStart + 8, smStart + 1, tEnd - 0.5);
    if (smEnd > smStart) {
      extra.push({ type: 'spotlight-mask', tStart: smStart, tEnd: smEnd, lat, lng });
    }
  }

  // ── Single-location intents ────────────────────────────────────────────────
  if (numLocs <= 1 && namedWps.length > 0) {
    const { lat, lng } = namedWps[0];

    if (intent === 'reveal') {
      const csText = (shot.chyron?.headline?.trim()) || (shot.chyron?.label?.trim()) || null;
      if (csText) {
        const csStart = tStart + 1.5;
        const csEnd   = clamp(tStart + 7, csStart + 1, tEnd - 0.5);
        if (csEnd > csStart) {
          extra.push({ type: 'context-strip', tStart: csStart, tEnd: csEnd, text: csText });
        }
      }
    }

    if (intent === 'stakes') {
      const rippleEnd = clamp(tStart + 3, tStart + 0.5, tEnd - 0.5);
      if (rippleEnd > tStart) {
        extra.push({ type: 'ripple-expand', tStart, tEnd: rippleEnd, lat, lng });
      }
      if (ESCALATION_RE.test(narration)) {
        const ewStart = tStart + 1;
        const ewEnd   = clamp(tStart + 5, ewStart + 1, tEnd - 0.5);
        if (ewEnd > ewStart) {
          extra.push({ type: 'escalation-warning', tStart: ewStart, tEnd: ewEnd, text: 'Escalating situation' });
        }
      }
      const magMatch = MAGNITUDE_RE.exec(narration);
      if (magMatch) {
        const rawVal   = parseFloat(magMatch[1].replace(/,/g, ''));
        const unit     = (magMatch[2] ?? '').toLowerCase();
        const isSpatial = /percent|%|casualties|dead|wounded|injured|killed/.test(unit);
        if (!isNaN(rawVal) && rawVal > 0 && isSpatial) {
          const irStart = tStart + 0.5;
          const irEnd   = clamp(tStart + 6, irStart + 1, tEnd - 0.5);
          if (irEnd > irStart) {
            const radiusKm = clamp(rawVal * 5, 50, 800);
            extra.push({ type: 'impact-radius', tStart: irStart, tEnd: irEnd, lat, lng, radiusKm });
          }
        }
      }
    }

    if (intent === 'data') {
      const magMatch = MAGNITUDE_RE.exec(narration);
      if (magMatch) {
        const rawVal = parseFloat(magMatch[1].replace(/,/g, ''));
        if (!isNaN(rawVal) && rawVal > 0) {
          const mbStart = tStart + 1;
          const mbEnd   = clamp(tStart + 6, mbStart + 1, tEnd - 1);
          if (mbEnd > mbStart) {
            extra.push({ type: 'magnitude-bubble', tStart: mbStart, tEnd: mbEnd, lat, lng, value: rawVal });
          }
        }
      }
    }

    if (intent === 'contrast') {
      const poly = namedWps[0]?.highlight?.polygon;
      if (poly) {
        const hzStart = tStart + 0.5;
        const hzEnd   = clamp(tStart + 8, hzStart + 1, tEnd - 0.5);
        if (hzEnd > hzStart) {
          const hzPattern = EXCLUSION_RE.test(narration) ? 'exclusion' : 'contested';
          extra.push({ type: 'hatched-zone', tStart: hzStart, tEnd: hzEnd, polygon: poly, pattern: hzPattern });
        }
      }
    }
  }

  // ── Multi-location intents ─────────────────────────────────────────────────
  if (numLocs >= 2 && uniqueNamedWps.length >= 2) {
    const firstWp = uniqueNamedWps[0];
    const lastWp  = uniqueNamedWps[uniqueNamedWps.length - 1];

    // 2-location reveal → route-reveal (geodesic progressive line)
    if (intent === 'reveal' && numLocs === 2) {
      const rrStart = tStart + 0.5;
      const rrEnd   = clamp(tStart + 8, rrStart + 1, tEnd - 0.5);
      if (rrEnd > rrStart) {
        extra.push({
          type: 'route-reveal',
          tStart: rrStart,
          tEnd:   rrEnd,
          from:   { lat: firstWp.lat, lng: firstWp.lng },
          to:     { lat: lastWp.lat,  lng: lastWp.lng },
          revealDuration: Math.min(3, (rrEnd - rrStart) * 0.65),
          style: 'dashed',
          mode: 'geodesic',
        });
      }
    }

    // 3+ location reveal → flow-arrow (multi-hop directional arrow chain)
    if (intent === 'reveal' && numLocs >= 3) {
      const path    = uniqueNamedWps.map(wp => ({ lng: wp.lng, lat: wp.lat }));
      const faStart = tStart + 1;
      const faEnd   = clamp(tStart + 9, faStart + 1, tEnd - 0.5);
      if (faEnd > faStart) {
        extra.push({
          type: 'flow-arrow', tStart: faStart, tEnd: faEnd, style: 'arrow',
          flows: [{ path, label: lastWp.highlight.name,
                    revealDuration: Math.min(3.5, (faEnd - faStart) * 0.6), revealDelay: 0 }],
        });
      }
    }

    // stakes + causal narration → particle-trail (streaming dots along path)
    if (intent === 'stakes' && CAUSAL_RE.test(narration)) {
      const path  = uniqueNamedWps.map(wp => ({ lat: wp.lat, lng: wp.lng }));
      const lenKm = pathLenKm(path);
      const ptStart = tStart;
      const ptEnd   = clamp(tStart + 8, ptStart + 1, tEnd - 0.5);
      if (ptEnd > ptStart) {
        extra.push({
          type:          'particle-trail',
          tStart:        ptStart,
          tEnd:          ptEnd,
          path,
          particleCount: clamp(Math.round(lenKm / 500), 3, 10),
          speed:         clamp(0.15 + lenKm / 20000, 0.15, 0.45),
        });
      }
    }

    // data + trade vocabulary → arc-token (sliding dots on arcs between location pairs)
    if (intent === 'data' && TRADE_RE.test(narration)) {
      const arcs = [];
      for (let i = 0; i < uniqueNamedWps.length - 1; i++) {
        arcs.push({ from: { lat: uniqueNamedWps[i].lat,     lng: uniqueNamedWps[i].lng },
                    to:   { lat: uniqueNamedWps[i + 1].lat, lng: uniqueNamedWps[i + 1].lng } });
      }
      const atStart = tStart + 0.5;
      const atEnd   = clamp(tStart + 7, atStart + 1, tEnd - 0.5);
      if (atEnd > atStart && arcs.length > 0) {
        extra.push({ type: 'arc-token', tStart: atStart, tEnd: atEnd, arcs });
      }
    }

    // contrast → side-by-side-callout; diplomatic vocabulary → also connection-arc
    if (intent === 'contrast') {
      const locA   = firstWp.highlight.name;
      const locB   = lastWp.highlight.name;
      const sStart = tStart + 1;
      const sEnd   = clamp(tStart + 6, sStart + 1, tEnd - 1);
      if (sEnd > sStart) {
        extra.push({
          type:   'side-by-side-callout',
          tStart: sStart,
          tEnd:   sEnd,
          labelA: 'LOCATION A',
          valueA: locA,
          labelB: 'LOCATION B',
          valueB: locB,
        });
      }
      if (numLocs === 2 && DIPLOMATIC_RE.test(narration)) {
        const caStart = tStart + 1;
        const caEnd   = clamp(tStart + 7, caStart + 1, tEnd - 0.5);
        if (caEnd > caStart) {
          extra.push({
            type: 'connection-arc', tStart: caStart, tEnd: caEnd,
            fromLat: firstWp.lat, fromLng: firstWp.lng, toLat: lastWp.lat, toLng: lastWp.lng,
          });
        }
      }
    }
  }

  return extra;
}
