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

  it('no ripple-expand when no intent and no context-label overlay', () => {
    const extra = pickOverlayRecipes(shot, 5);
    expect(extra.find(t => t.type === 'ripple-expand')).toBeUndefined();
  });

  it('emits ripple-expand when context-label overlay is present (no-intent fallback)', () => {
    const shotWithContext = {
      ...shot,
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

  it('reveal intent → emits context-strip', () => {
    const extra = pickOverlayRecipes(makeShot('reveal'), 0);
    const cs = extra.find(t => t.type === 'context-strip');
    expect(cs).toBeDefined();
    expect(cs.tEnd).toBeGreaterThan(cs.tStart);
  });

  it('stakes intent → emits ripple-expand', () => {
    const extra = pickOverlayRecipes(makeShot('stakes'), 0);
    const ripple = extra.find(t => t.type === 'ripple-expand');
    expect(ripple).toBeDefined();
  });

  it('stakes + escalation narration → emits escalation-warning', () => {
    const extra = pickOverlayRecipes(makeShot('stakes', 'Conflict is escalating across the border'), 0);
    const ew = extra.find(t => t.type === 'escalation-warning');
    expect(ew).toBeDefined();
  });

  it('stakes + magnitude narration → emits impact-radius', () => {
    const extra = pickOverlayRecipes(makeShot('stakes', 'Over 50 percent of the region affected'), 0);
    const ir = extra.find(t => t.type === 'impact-radius');
    expect(ir).toBeDefined();
    expect(ir.radiusKm).toBeGreaterThan(0);
  });

  it('data + magnitude narration → emits magnitude-bubble', () => {
    const extra = pickOverlayRecipes(makeShot('data', 'GDP fell 42 percent this quarter'), 0);
    const mb = extra.find(t => t.type === 'magnitude-bubble');
    expect(mb).toBeDefined();
    expect(mb.value).toBeCloseTo(42, 0);
  });

  it('data without magnitude narration → no magnitude-bubble', () => {
    const extra = pickOverlayRecipes(makeShot('data', 'Economic trends remain uncertain'), 0);
    expect(extra.find(t => t.type === 'magnitude-bubble')).toBeUndefined();
  });

  it('contrast + polygon → emits hatched-zone', () => {
    const polygon = { type: 'Polygon', coordinates: [[[2, 48], [3, 48], [3, 49], [2, 48]]] };
    const shot = makeShot('contrast');
    shot.cameraPath[1].highlight.polygon = polygon;
    const extra = pickOverlayRecipes(shot, 0);
    const hz = extra.find(t => t.type === 'hatched-zone');
    expect(hz).toBeDefined();
    expect(hz.pattern).toBe('contested');
  });

  it('contrast without polygon → no hatched-zone', () => {
    const extra = pickOverlayRecipes(makeShot('contrast'), 0);
    expect(extra.find(t => t.type === 'hatched-zone')).toBeUndefined();
  });

  it('first story + high impact → emits spotlight-mask', () => {
    const shot = makeShot('reveal', '', { storyIndex: 0, impact: 0.7 });
    const extra = pickOverlayRecipes(shot, 0);
    const sm = extra.find(t => t.type === 'spotlight-mask');
    expect(sm).toBeDefined();
  });

  it('non-first story + high impact → no spotlight-mask', () => {
    const shot = makeShot('reveal', '', { storyIndex: 2, impact: 0.8 });
    const extra = pickOverlayRecipes(shot, 0);
    expect(extra.find(t => t.type === 'spotlight-mask')).toBeUndefined();
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

  it('multi-loc + reveal → emits route-reveal', () => {
    const extra = pickOverlayRecipes(makeMultiShot('reveal'), 0);
    const rr = extra.find(t => t.type === 'route-reveal');
    expect(rr).toBeDefined();
    expect(rr.from).toBeDefined();
    expect(rr.to).toBeDefined();
  });

  it('multi-loc + stakes + causal narration → emits particle-trail', () => {
    const extra = pickOverlayRecipes(makeMultiShot('stakes', 'Sanctions led to economic collapse'), 0);
    const pt = extra.find(t => t.type === 'particle-trail');
    expect(pt).toBeDefined();
    expect(pt.path.length).toBeGreaterThanOrEqual(2);
  });

  it('multi-loc + stakes without causal narration → no particle-trail', () => {
    const extra = pickOverlayRecipes(makeMultiShot('stakes', 'Tensions remain high'), 0);
    expect(extra.find(t => t.type === 'particle-trail')).toBeUndefined();
  });

  it('multi-loc + contrast → emits side-by-side-callout', () => {
    const extra = pickOverlayRecipes(makeMultiShot('contrast'), 0);
    const ss = extra.find(t => t.type === 'side-by-side-callout');
    expect(ss).toBeDefined();
    expect(ss.labelA).toBe('LOCATION A');
    expect(ss.valueA).toBe('New York');
    expect(ss.valueB).toBe('France');
  });

  it('all emitted treatments have valid tStart < tEnd', () => {
    const extra = pickOverlayRecipes(makeMultiShot('reveal'), 0);
    for (const t of extra) {
      expect(t.tStart).toBeLessThan(t.tEnd);
    }
  });
});
