import { describe, it, expect } from 'vitest';
import { buildCameraPath, buildGlobeSpinPath, pickOverlayRecipes } from '../shot-recipes.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

const LOC_CITY    = { name: 'New York', lng: -73.99, lat: 40.73, iso: 'US' };
const LOC_COUNTRY = { name: 'France',   lng: 2.35,   lat: 48.86, iso: 'FR' };
const LOC_LARGE   = { name: 'Russia',   lng: 37.62,  lat: 55.75, iso: 'RU' };
const LOC_SPECIAL = { name: 'Global',   lng: 0,      lat: 0,     iso: 'XX' };

function locationZoom(loc) {
  const LARGE = new Set(['Russia', 'United States', 'China', 'Canada', 'Brazil']);
  const COUNTRY = new Set(['France', 'Germany', 'Japan']);
  if (LARGE.has(loc.name))   return 5;
  if (COUNTRY.has(loc.name)) return 7;
  return 9;
}

function waypointHighlight(loc) {
  return { type: 'country', name: loc.name, iso: loc.iso ?? null, polygon: null };
}

// ── buildCameraPath ────────────────────────────────────────────────────────────

describe('buildCameraPath — no valid locations', () => {
  it('null locations → globeSpin', () => {
    const wps = buildCameraPath(null, 10, null, { locationZoom, waypointHighlight });
    expect(wps[0].zoom).toBeLessThanOrEqual(2);
    expect(wps[0].pitch).toBe(0);
  });

  it('empty array → globeSpin', () => {
    const wps = buildCameraPath([], 10, null, { locationZoom, waypointHighlight });
    expect(wps[0].zoom).toBeLessThanOrEqual(2);
  });

  it('special-iso only → globeSpin', () => {
    const wps = buildCameraPath([LOC_SPECIAL], 10, null, { locationZoom, waypointHighlight });
    expect(wps[0].zoom).toBeLessThanOrEqual(2);
  });

  it('isGlobeSpin override → globeSpin even with locations', () => {
    const wps = buildCameraPath([LOC_CITY], 10, null, { locationZoom, waypointHighlight, isGlobeSpin: true });
    expect(wps[0].zoom).toBeLessThanOrEqual(2);
  });
});

describe('buildCameraPath — single location', () => {
  it('produces establish-style path (globe start → story zoom end)', () => {
    const wps = buildCameraPath([LOC_CITY], 15, null, { locationZoom, waypointHighlight });
    expect(wps[0].zoom).toBeLessThan(2);      // starts globe-level
    expect(wps[wps.length - 1].zoom).toBeCloseTo(9, 1);  // lands at city zoom
  });

  it('first tOffset is 0, last is duration', () => {
    const wps = buildCameraPath([LOC_CITY], 15, null, { locationZoom, waypointHighlight });
    expect(wps[0].tOffset).toBe(0);
    expect(wps[wps.length - 1].tOffset).toBe(15);
  });

  it('highlight is injected on the landing waypoint', () => {
    const wps = buildCameraPath([LOC_CITY], 15, null, { locationZoom, waypointHighlight });
    const landing = wps[wps.length - 1];
    expect(landing.highlight).toBeDefined();
    expect(landing.highlight.name).toBe('New York');
  });
});

describe('buildCameraPath — multiple locations', () => {
  it('visits both locations', () => {
    const wps = buildCameraPath([LOC_CITY, LOC_COUNTRY], 20, null, { locationZoom, waypointHighlight });
    const atNY    = wps.find(wp => Math.abs(wp.lng - LOC_CITY.lng) < 0.01);
    const atParis = wps.find(wp => Math.abs(wp.lng - LOC_COUNTRY.lng) < 0.01);
    expect(atNY).toBeDefined();
    expect(atParis).toBeDefined();
  });

  it('tOffsets are monotonically non-decreasing', () => {
    const wps = buildCameraPath([LOC_CITY, LOC_COUNTRY, LOC_LARGE], 30, null, { locationZoom, waypointHighlight });
    for (let i = 1; i < wps.length; i++) {
      expect(wps[i].tOffset).toBeGreaterThanOrEqual(wps[i - 1].tOffset);
    }
  });

  it('first tOffset is 0, last is duration', () => {
    const wps = buildCameraPath([LOC_CITY, LOC_COUNTRY], 20, null, { locationZoom, waypointHighlight });
    expect(wps[0].tOffset).toBe(0);
    expect(wps[wps.length - 1].tOffset).toBe(20);
  });

  it('filters out special-iso locations from sweep', () => {
    const wps = buildCameraPath([LOC_CITY, LOC_SPECIAL], 20, null, { locationZoom, waypointHighlight });
    // LOC_SPECIAL filtered → should produce establish (1 real loc), not sweep
    expect(wps[0].zoom).toBeLessThan(2);
  });
});

// ── buildGlobeSpinPath ────────────────────────────────────────────────────────

describe('buildGlobeSpinPath', () => {
  it('returns 2 waypoints at tOffset 0 and duration', () => {
    const wps = buildGlobeSpinPath(15);
    expect(wps).toHaveLength(2);
    expect(wps[0].tOffset).toBe(0);
    expect(wps[1].tOffset).toBe(15);
  });

  it('globe-level zoom and flat pitch', () => {
    const wps = buildGlobeSpinPath(15);
    for (const wp of wps) {
      expect(wp.zoom).toBeLessThanOrEqual(2);
      expect(wp.pitch).toBe(0);
    }
  });

  it('bearing0 offsets starting bearing', () => {
    const wps = buildGlobeSpinPath(15, -30);
    expect(wps[0].bearing).toBe(-30);
  });

  it('bearing decreases over duration', () => {
    const wps = buildGlobeSpinPath(15);
    expect(wps[1].bearing).toBeLessThan(wps[0].bearing);
  });
});

// ── pickOverlayRecipes ────────────────────────────────────────────────────────

describe('pickOverlayRecipes — no named waypoints', () => {
  it('returns empty array when no highlight.name on waypoints', () => {
    const shot = { t: 0, hold: 10, cameraPath: [{ tOffset: 0, lng: 0, lat: 20, zoom: 1.5, pitch: 0, bearing: 0 }], overlays: [] };
    expect(pickOverlayRecipes(shot, 0)).toEqual([]);
  });
});

describe('pickOverlayRecipes — single-location shot', () => {
  const NAMED_WP = { tOffset: 15, lng: -73.99, lat: 40.73, zoom: 9, pitch: 50, bearing: -10, highlight: { type: 'city', name: 'New York', iso: 'US', polygon: null } };
  const shot = {
    t: 5, hold: 15,
    cameraPath: [
      { tOffset: 0, lng: -73.99, lat: 40.73, zoom: 1.5, pitch: 0, bearing: 0 },
      NAMED_WP,
    ],
    overlays: [],
  };

  it('emits label-bloom', () => {
    const extra = pickOverlayRecipes(shot, 5);
    const bloom = extra.find(t => t.type === 'label-bloom');
    expect(bloom).toBeDefined();
    expect(bloom.text).toBe('New York');
    expect(bloom.lat).toBeCloseTo(40.73, 2);
    expect(bloom.lng).toBeCloseTo(-73.99, 2);
  });

  it('label-bloom tStart matches shot.t', () => {
    const bloom = pickOverlayRecipes(shot, 5).find(t => t.type === 'label-bloom');
    expect(bloom.tStart).toBe(5);
  });

  it('label-bloom tEnd is at most tStart + 4', () => {
    const bloom = pickOverlayRecipes(shot, 5).find(t => t.type === 'label-bloom');
    expect(bloom.tEnd).toBeLessThanOrEqual(9);
  });

  // hold=5 → TARGET_DENSITY = max(1, floor(5/6)) = 1.
  // Guaranteed label-bloom fills the single slot → ambient fill won't run → no ripple-expand.
  it('no ripple-expand when no intent and no context-label overlay', () => {
    const shortShot = {
      ...shot,
      hold: 5,
      cameraPath: [
        { tOffset: 0, lng: -73.99, lat: 40.73, zoom: 1.5, pitch: 0, bearing: 0 },
        { tOffset: 5, lng: -73.99, lat: 40.73, zoom: 9, pitch: 50, bearing: -10,
          highlight: { type: 'city', name: 'New York', iso: 'US', polygon: null } },
      ],
    };
    const extra = pickOverlayRecipes(shortShot, 5);
    expect(extra.find(t => t.type === 'ripple-expand')).toBeUndefined();
  });

  it('emits ripple-expand when context-label overlay is present (no-intent fallback)', () => {
    // ripple-expand now fires from ambient fill when target density > slots already filled.
    // Use hold=12 → TARGET_DENSITY=2; label-bloom fills slot 1; ambient fill adds ripple-expand.
    const shotWithContext = {
      ...shot,
      hold: 12,
      cameraPath: [
        { tOffset: 0, lng: -73.99, lat: 40.73, zoom: 1.5, pitch: 0, bearing: 0 },
        { tOffset: 12, lng: -73.99, lat: 40.73, zoom: 9, pitch: 50, bearing: -10,
          highlight: { type: 'city', name: 'New York', iso: 'US', polygon: null } },
      ],
      overlays: [{ type: 'context-label', text: 'Tensions escalate', tOffset: 2, durationMs: 2000 }],
    };
    const ripple = pickOverlayRecipes(shotWithContext, 5).find(t => t.type === 'ripple-expand');
    expect(ripple).toBeDefined();
    expect(ripple.lat).toBeCloseTo(40.73, 2);
  });
});

describe('pickOverlayRecipes — intent-driven rules', () => {
  function makeShot(intent, narration = '', extras = {}) {
    return {
      t: 0, hold: 12, storyIndex: 1, impact: 0.3,
      cameraPath: [
        { tOffset: 0, lng: -73.99, lat: 40.73, zoom: 1.5, pitch: 0, bearing: 0 },
        { tOffset: 12, lng: -73.99, lat: 40.73, zoom: 9, pitch: 50, bearing: -10,
          highlight: { type: 'city', name: 'New York', iso: 'US', polygon: null } },
      ],
      overlays: [],
      narration,
      dominantIntent: intent,
      chyron: { headline: 'Test headline', label: 'TEST' },
      ...extras,
    };
  }

  it('stakes + escalation narration → emits escalation-warning', () => {
    // ESCALATION_VERB_RE matches "escalat" prefix in "escalating"
    const extra = pickOverlayRecipes(makeShot('stakes', 'Conflict is escalating across the border'), 0);
    const ew = extra.find(t => t.type === 'escalation-warning');
    expect(ew).toBeDefined();
  });

  // T2: spatial casualties → impact-radius; "percent" no longer triggers it; number must be adjacent to casualty word
  it('stakes + magnitude narration → emits impact-radius', () => {
    const extra = pickOverlayRecipes(makeShot('stakes', 'Over 50 killed in the attack on New York'), 0);
    const ir = extra.find(t => t.type === 'impact-radius');
    expect(ir).toBeDefined();
    expect(ir.radiusKm).toBeGreaterThan(0);
  });

  it('data + magnitude narration → emits magnitude-bubble', () => {
    const extra = pickOverlayRecipes(makeShot('data', 'GDP fell 42 percent this quarter in New York'), 0);
    const mb = extra.find(t => t.type === 'magnitude-bubble');
    expect(mb).toBeDefined();
    expect(mb.value).toBeCloseTo(42, 0);
  });

  it('data without magnitude narration → no magnitude-bubble', () => {
    const extra = pickOverlayRecipes(makeShot('data', 'Economic trends remain uncertain'), 0);
    expect(extra.find(t => t.type === 'magnitude-bubble')).toBeUndefined();
  });

  // T5: exclusion zone keyword + polygon → hatched-zone exclusion
  it('contrast + polygon + exclusion narration → hatched-zone pattern:exclusion', () => {
    const polygon = { type: 'Polygon', coordinates: [[[2, 48], [3, 48], [3, 49], [2, 48]]] };
    const shot = makeShot('contrast', 'A no-fly zone has been declared over the region');
    shot.cameraPath[1].highlight.polygon = polygon;
    const hz = pickOverlayRecipes(shot, 0).find(t => t.type === 'hatched-zone');
    expect(hz).toBeDefined();
    expect(hz.pattern).toBe('exclusion');
  });

  // T6: contested/disputed/occupied + polygon → hatched-zone contested
  it('contrast + polygon → emits hatched-zone', () => {
    const polygon = { type: 'Polygon', coordinates: [[[2, 48], [3, 48], [3, 49], [2, 48]]] };
    const shot = makeShot('contrast', 'Forces have clashed in the disputed territory near New York');
    shot.cameraPath[1].highlight.polygon = polygon;
    const extra = pickOverlayRecipes(shot, 0);
    const hz = extra.find(t => t.type === 'hatched-zone');
    expect(hz).toBeDefined();
    expect(hz.pattern).toBe('contested');
  });

  it('contrast + polygon without exclusion narration → hatched-zone pattern:contested', () => {
    const polygon = { type: 'Polygon', coordinates: [[[2, 48], [3, 48], [3, 49], [2, 48]]] };
    const shot = makeShot('contrast', 'The border region is occupied by both sides near New York');
    shot.cameraPath[1].highlight.polygon = polygon;
    const hz = pickOverlayRecipes(shot, 0).find(t => t.type === 'hatched-zone');
    expect(hz).toBeDefined();
    expect(hz.pattern).toBe('contested');
  });

  it('contrast without polygon → no hatched-zone', () => {
    const extra = pickOverlayRecipes(makeShot('contrast'), 0);
    expect(extra.find(t => t.type === 'hatched-zone')).toBeUndefined();
  });

  it('first story establish shot + high impact → emits spotlight-mask', () => {
    const shot = makeShot('reveal', '', { storyIndex: 0, impact: 0.7, isEstablish: true });
    const extra = pickOverlayRecipes(shot, 0);
    const sm = extra.find(t => t.type === 'spotlight-mask');
    expect(sm).toBeDefined();
  });

  it('first story without isEstablish flag → no spotlight-mask', () => {
    const shot = makeShot('reveal', '', { storyIndex: 0, impact: 0.7 });
    const extra = pickOverlayRecipes(shot, 0);
    expect(extra.find(t => t.type === 'spotlight-mask')).toBeUndefined();
  });

  it('non-first story + high impact → no spotlight-mask', () => {
    const shot = makeShot('reveal', '', { storyIndex: 2, impact: 0.8 });
    const extra = pickOverlayRecipes(shot, 0);
    expect(extra.find(t => t.type === 'spotlight-mask')).toBeUndefined();
  });

  // T2 fires on spatial casualties only; "percent" alone no longer maps to impact-radius; number must be adjacent to casualty word
  it('stakes + spatial magnitude narration → emits impact-radius', () => {
    const extra = pickOverlayRecipes(makeShot('stakes', 'Over 50 killed in the attack on New York'), 0);
    expect(extra.find(t => t.type === 'impact-radius')).toBeDefined();
  });

  it('stakes + monetary magnitude narration → no impact-radius', () => {
    const extra = pickOverlayRecipes(makeShot('stakes', 'The country lost 78 billion in trade'), 0);
    expect(extra.find(t => t.type === 'impact-radius')).toBeUndefined();
  });

  it('reveal without headline or label → no context-strip', () => {
    const shot = makeShot('reveal', '');
    shot.chyron = {};
    const extra = pickOverlayRecipes(shot, 0);
    expect(extra.find(t => t.type === 'context-strip')).toBeUndefined();
  });
});

describe('pickOverlayRecipes — multi-location rules', () => {
  function makeMultiShot(intent, narration = '') {
    return {
      t: 0, hold: 15, storyIndex: 1, impact: 0.4,
      cameraPath: [
        { tOffset: 0,  lng: -73.99, lat: 40.73, zoom: 9, pitch: 50, bearing: -10,
          highlight: { type: 'city', name: 'New York', iso: 'US', polygon: null } },
        { tOffset: 5,  lng: -73.99, lat: 40.73, zoom: 9, pitch: 50, bearing: -10,
          highlight: { type: 'city', name: 'New York', iso: 'US', polygon: null } },
        { tOffset: 8,  lng: 2.35, lat: 48.86, zoom: 7, pitch: 50, bearing: -10,
          highlight: { type: 'country', name: 'France', iso: 'FR', polygon: null } },
        { tOffset: 15, lng: 2.35, lat: 48.86, zoom: 7, pitch: 50, bearing: -10,
          highlight: { type: 'country', name: 'France', iso: 'FR', polygon: null } },
      ],
      overlays: [],
      narration,
      dominantIntent: intent,
      chyron: { headline: 'Multi-location', label: 'TEST' },
    };
  }

  // T7: "from X to Y" matching named waypoints → route-reveal
  it('multi-loc + reveal → emits route-reveal with mode:geodesic', () => {
    const extra = pickOverlayRecipes(makeMultiShot('reveal', 'Diplomats traveled from New York to France for the meeting'), 0);
    const rr = extra.find(t => t.type === 'route-reveal');
    expect(rr).toBeDefined();
    expect(rr.from).toBeDefined();
    expect(rr.to).toBeDefined();
    expect(rr.mode).toBe('geodesic');
  });

  it('2-loc reveal → route-reveal, no flow-arrow', () => {
    const extra = pickOverlayRecipes(makeMultiShot('reveal', 'Diplomats traveled from New York to France for the meeting'), 0);
    expect(extra.find(t => t.type === 'route-reveal')).toBeDefined();
    expect(extra.find(t => t.type === 'flow-arrow')).toBeUndefined();
  });

  // T10: movement verb + 2 waypoints → particle-trail (avoid "from X to Y" which fires T7 route-reveal instead)
  it('multi-loc + stakes + causal narration → emits particle-trail', () => {
    const extra = pickOverlayRecipes(makeMultiShot('stakes', 'Troops were deployed through New York and France following the collapse'), 0);
    const pt = extra.find(t => t.type === 'particle-trail');
    expect(pt).toBeDefined();
    expect(pt.path.length).toBeGreaterThanOrEqual(2);
  });

  it('multi-loc + stakes without causal narration → no particle-trail', () => {
    const extra = pickOverlayRecipes(makeMultiShot('stakes', 'Tensions remain high'), 0);
    expect(extra.find(t => t.type === 'particle-trail')).toBeUndefined();
  });

  // T12: comparison keyword + 2 waypoints → side-by-side-callout
  it('multi-loc + contrast → emits side-by-side-callout', () => {
    const extra = pickOverlayRecipes(makeMultiShot('contrast', 'Unlike New York, France refused to comply with the demands'), 0);
    const ss = extra.find(t => t.type === 'side-by-side-callout');
    expect(ss).toBeDefined();
    expect(ss.labelA).toBe('LOCATION A');
    expect(ss.valueA).toBe('New York');
    expect(ss.valueB).toBe('France');
  });

  it('all emitted treatments have valid tStart < tEnd', () => {
    const extra = pickOverlayRecipes(makeMultiShot('reveal', 'Diplomats traveled from New York to France for the meeting'), 0);
    for (const t of extra) {
      expect(t.tStart).toBeLessThan(t.tEnd);
    }
  });

  // T11: trade vocab + 2 waypoints → arc-token (avoid "from X to Y" which fires T7 route-reveal instead)
  it('multi-loc + data + trade narration → emits arc-token', () => {
    const extra = pickOverlayRecipes(makeMultiShot('data', 'Oil trade surged between New York and France this quarter'), 0);
    const at = extra.find(t => t.type === 'arc-token');
    expect(at).toBeDefined();
    expect(at.arcs.length).toBeGreaterThanOrEqual(1);
  });

  it('multi-loc + data without trade narration → no arc-token', () => {
    const extra = pickOverlayRecipes(makeMultiShot('data', 'Economic output fell sharply'), 0);
    expect(extra.find(t => t.type === 'arc-token')).toBeUndefined();
  });

  // T8: "between X and Y" + diplomatic vocab → connection-arc
  it('multi-loc + contrast + diplomatic narration → emits connection-arc', () => {
    const extra = pickOverlayRecipes(makeMultiShot('contrast', 'Diplomatic talks between New York and France began in Brussels'), 0);
    expect(extra.find(t => t.type === 'connection-arc')).toBeDefined();
  });

  it('multi-loc + contrast without diplomatic narration → no connection-arc', () => {
    const extra = pickOverlayRecipes(makeMultiShot('contrast', 'Both sides hardened their positions'), 0);
    expect(extra.find(t => t.type === 'connection-arc')).toBeUndefined();
  });

  // T15: first mention of secondary waypoint → map-annotation
  // France must appear in a different sentence from New York to avoid MIN_GAP=2 blocking both triggers.
  it('any shot with 2+ named locations → map-annotation on secondary location', () => {
    const extra = pickOverlayRecipes(makeMultiShot('reveal', 'New York leaders met for talks. France was also represented.'), 0);
    const ma = extra.find(t => t.type === 'map-annotation');
    expect(ma).toBeDefined();
    expect(ma.text).toBe('France'); // secondary unique location
  });

  // T10: particle-trail — particleCount scales with path length
  it('particle-trail particleCount scales with path length', () => {
    // New York to France ≈ 5800 km → particleCount = clamp(round(5800/500), 3, 10) = 10
    const extra = pickOverlayRecipes(makeMultiShot('stakes', 'Troops were deployed through New York and France following the collapse'), 0);
    const pt = extra.find(t => t.type === 'particle-trail');
    expect(pt).toBeDefined();
    expect(pt.particleCount).toBeGreaterThanOrEqual(3);
    expect(pt.particleCount).toBeLessThanOrEqual(10);
    expect(pt.speed).toBeGreaterThanOrEqual(0.15);
    expect(pt.speed).toBeLessThanOrEqual(0.45);
  });
});

describe('pickOverlayRecipes — 3-location flow-arrow', () => {
  function makeThreeLocShot(intent) {
    return {
      t: 0, hold: 18, storyIndex: 1, impact: 0.4,
      cameraPath: [
        { tOffset: 0,  lng: -73.99, lat: 40.73, zoom: 9, pitch: 50, bearing: -10,
          highlight: { type: 'city', name: 'New York', iso: 'US', polygon: null } },
        { tOffset: 6,  lng: 2.35,   lat: 48.86, zoom: 7, pitch: 50, bearing: -10,
          highlight: { type: 'country', name: 'France', iso: 'FR', polygon: null } },
        { tOffset: 12, lng: 30.52,  lat: 50.45, zoom: 9, pitch: 50, bearing: -10,
          highlight: { type: 'city', name: 'Kyiv', iso: 'UA', polygon: null } },
        { tOffset: 18, lng: 30.52,  lat: 50.45, zoom: 9, pitch: 50, bearing: -10,
          highlight: { type: 'city', name: 'Kyiv', iso: 'UA', polygon: null } },
      ],
      overlays: [],
      // T9: 3+ named waypoints in same sentence fires flow-arrow
      narration: 'Weapons moved from New York through France to reach Kyiv at the front.',
      dominantIntent: intent,
      chyron: { headline: 'Supply route revealed', label: 'REVEAL' },
    };
  }

  it('3-loc reveal → emits flow-arrow, no route-reveal', () => {
    const extra = pickOverlayRecipes(makeThreeLocShot('reveal'), 0);
    expect(extra.find(t => t.type === 'flow-arrow')).toBeDefined();
    expect(extra.find(t => t.type === 'route-reveal')).toBeUndefined();
  });

  it('flow-arrow has path with 3 unique points', () => {
    const extra = pickOverlayRecipes(makeThreeLocShot('reveal'), 0);
    const fa = extra.find(t => t.type === 'flow-arrow');
    expect(fa.flows[0].path.length).toBe(3);
  });

  it('flow-arrow label is the last location name', () => {
    const extra = pickOverlayRecipes(makeThreeLocShot('reveal'), 0);
    const fa = extra.find(t => t.type === 'flow-arrow');
    expect(fa.flows[0].label).toBe('Kyiv');
  });
});

// ── Sentence trigger dictionary tests ─────────────────────────────────────────

describe('pickOverlayRecipes — sentence trigger dictionary', () => {
  // Shared single-location shot factory for trigger tests.
  function makeShot(intent, narration = '') {
    return {
      t: 0, hold: 12, storyIndex: 1, impact: 0.3,
      cameraPath: [
        { tOffset: 0, lng: -73.99, lat: 40.73, zoom: 1.5, pitch: 0, bearing: 0 },
        { tOffset: 12, lng: -73.99, lat: 40.73, zoom: 9, pitch: 50, bearing: -10,
          highlight: { type: 'city', name: 'New York', iso: 'US', polygon: null } },
      ],
      overlays: [],
      narration,
      dominantIntent: intent,
      chyron: { headline: 'Test headline', label: 'TEST' },
    };
  }

  // T2: spatial casualties → impact-radius; number must be directly adjacent to casualty word (no intervening words)
  it('T2: number + killed → impact-radius', () => {
    const shot = makeShot(null, '50 killed in the attack on New York');
    const extra = pickOverlayRecipes(shot, 0);
    const ir = extra.find(t => t.type === 'impact-radius');
    expect(ir).toBeDefined();
    expect(ir.radiusKm).toBeCloseTo(250, 0); // clamp(50*5, 50, 800)
  });

  // T3: magnitude number → magnitude-bubble
  it('T3: percent number → magnitude-bubble', () => {
    const shot = makeShot(null, 'GDP fell 42 percent in New York this quarter');
    const extra = pickOverlayRecipes(shot, 0);
    expect(extra.find(t => t.type === 'magnitude-bubble')).toBeDefined();
  });

  // T4: escalation verb → escalation-warning
  it('T4: escalation verb → escalation-warning', () => {
    const shot = makeShot(null, 'Fighting is escalating along the border near New York');
    const extra = pickOverlayRecipes(shot, 0);
    expect(extra.find(t => t.type === 'escalation-warning')).toBeDefined();
  });

  // T5: exclusion zone keyword + polygon → hatched-zone exclusion
  it('T5: exclusion zone + polygon → hatched-zone exclusion', () => {
    const polygon = { type: 'Polygon', coordinates: [[[2, 48], [3, 48], [3, 49], [2, 48]]] };
    const shot = makeShot(null, 'A no-fly zone was declared near New York');
    shot.cameraPath[1].highlight.polygon = polygon;
    const hz = pickOverlayRecipes(shot, 0).find(t => t.type === 'hatched-zone');
    expect(hz?.pattern).toBe('exclusion');
  });

  // T6: contested keyword + polygon → hatched-zone contested
  it('T6: disputed keyword + polygon → hatched-zone contested', () => {
    const polygon = { type: 'Polygon', coordinates: [[[2, 48], [3, 48], [3, 49], [2, 48]]] };
    const shot = makeShot(null, 'The New York territory remains disputed');
    shot.cameraPath[1].highlight.polygon = polygon;
    const hz = pickOverlayRecipes(shot, 0).find(t => t.type === 'hatched-zone');
    expect(hz?.pattern).toBe('contested');
  });

  // T14: primary location first mention → label-bloom
  it('T14: first mention of primary loc → label-bloom', () => {
    const shot = makeShot(null, 'Officials met today in New York to discuss the crisis');
    const bloom = pickOverlayRecipes(shot, 0).find(t => t.type === 'label-bloom');
    expect(bloom).toBeDefined();
    expect(bloom.text).toBe('New York');
  });

  // T16: role prefix → context-strip
  // Role and location must be in separate sentences to avoid MIN_GAP=2 blocking context-strip after label-bloom.
  it('T16: President/Minister prefix → context-strip', () => {
    const shot = makeShot(null, 'President Johnson made the announcement. New York hosted the event.');
    const cs = pickOverlayRecipes(shot, 0).find(t => t.type === 'context-strip');
    expect(cs).toBeDefined();
    expect(cs.text).toMatch(/President/);
  });

  // T13: connective sentence-initial → context-strip
  it('T13: however/but sentence-initial → context-strip', () => {
    const shot = makeShot(null, 'New York held talks. However the situation remains tense.');
    const cs = pickOverlayRecipes(shot, 0).find(t => t.type === 'context-strip');
    expect(cs).toBeDefined();
  });

  // T17: waypoint mention, no other trigger → ripple-expand (or ambient fill adds it)
  it('T17: waypoint mention without other trigger → ripple-expand or label-bloom', () => {
    const shot = makeShot(null, 'New York remained the center of attention throughout the week');
    shot.hold = 30; // enough for multiple density slots; ambient fill will add ripple-expand
    const extra = pickOverlayRecipes(shot, 0);
    const hasRipple = extra.some(t => t.type === 'ripple-expand');
    const hasBloom  = extra.some(t => t.type === 'label-bloom');
    expect(hasRipple || hasBloom).toBe(true);
  });
});
