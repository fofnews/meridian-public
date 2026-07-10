import { describe, it, expect } from 'vitest';
import * as establish    from '../camera-recipes/establish.js';
import * as pushIn       from '../camera-recipes/pushIn.js';
import * as pullback     from '../camera-recipes/pullback.js';
import * as orbit        from '../camera-recipes/orbit.js';
import * as vertigo      from '../camera-recipes/vertigo.js';
import * as sweepBetween from '../camera-recipes/sweepBetween.js';
import * as whipPan      from '../camera-recipes/whipPan.js';
import * as hover        from '../camera-recipes/hover.js';
import * as globeSpin    from '../camera-recipes/globeSpin.js';
import { chain }         from '../camera-recipes/chain.js';

const LOC  = { lng: -73.99, lat: 40.73, zoom: 9 };
const LOC2 = { lng: 37.62,  lat: 55.75, zoom: 7 };
const DUR  = 15;

// ── Shared assertions ─────────────────────────────────────────────────────────

function assertWaypointShape(wps, duration) {
  expect(wps.length).toBeGreaterThan(0);
  expect(wps[0].tOffset).toBe(0);
  expect(wps[wps.length - 1].tOffset).toBe(duration);

  for (let i = 1; i < wps.length; i++) {
    expect(wps[i].tOffset).toBeGreaterThanOrEqual(wps[i - 1].tOffset);
  }

  for (const wp of wps) {
    expect(typeof wp.lng).toBe('number');
    expect(typeof wp.lat).toBe('number');
    expect(wp.zoom).toBeGreaterThanOrEqual(0);
    expect(wp.zoom).toBeLessThanOrEqual(22);
    expect(wp.pitch).toBeGreaterThanOrEqual(0);
    expect(wp.pitch).toBeLessThanOrEqual(85);
    expect(Math.abs(wp.bearing)).toBeLessThanOrEqual(360);
  }
}

// ── establish ─────────────────────────────────────────────────────────────────

describe('establish', () => {
  it('produces valid waypoints', () => {
    assertWaypointShape(establish.build(LOC, { duration: DUR }), DUR);
  });

  it('starts at globe zoom, ends at story zoom', () => {
    const wps = establish.build(LOC, { duration: DUR });
    expect(wps[0].zoom).toBeLessThan(2);          // globe level
    expect(wps[wps.length - 1].zoom).toBeCloseTo(LOC.zoom, 1);  // story zoom
  });

  it('starts flat (pitch 0), ends pitched', () => {
    const wps = establish.build(LOC, { duration: DUR });
    expect(wps[0].pitch).toBe(0);
    expect(wps[wps.length - 1].pitch).toBeGreaterThan(0);
  });

  it('preserves highlight on landing waypoint only', () => {
    const loc = { ...LOC, highlight: { type: 'city', name: 'New York', iso: 'US', polygon: null } };
    const wps = establish.build(loc, { duration: DUR });
    expect(wps[0].highlight).toBeUndefined();
    expect(wps[wps.length - 1].highlight).toBeDefined();
  });
});

// ── pushIn ────────────────────────────────────────────────────────────────────

describe('pushIn', () => {
  it('produces valid waypoints', () => {
    assertWaypointShape(pushIn.build(LOC, { duration: DUR }), DUR);
  });

  it('zooms in over time', () => {
    const wps = pushIn.build(LOC, { duration: DUR });
    expect(wps[wps.length - 1].zoom).toBeGreaterThan(wps[0].zoom);
  });

  it('pitch increases over time', () => {
    const wps = pushIn.build(LOC, { duration: DUR });
    expect(wps[wps.length - 1].pitch).toBeGreaterThanOrEqual(wps[0].pitch);
  });
});

// ── pullback ──────────────────────────────────────────────────────────────────

describe('pullback', () => {
  it('produces valid waypoints', () => {
    assertWaypointShape(pullback.build(LOC, { duration: DUR }), DUR);
  });

  it('zooms out over time', () => {
    const wps = pullback.build(LOC, { duration: DUR });
    expect(wps[wps.length - 1].zoom).toBeLessThan(wps[0].zoom);
  });

  it('ends at globe level', () => {
    const wps = pullback.build(LOC, { duration: DUR });
    expect(wps[wps.length - 1].zoom).toBeLessThanOrEqual(2);
    expect(wps[wps.length - 1].pitch).toBe(0);
  });
});

// ── orbit ─────────────────────────────────────────────────────────────────────

describe('orbit', () => {
  it('produces valid waypoints', () => {
    assertWaypointShape(orbit.build(LOC, { duration: DUR }), DUR);
  });

  it('holds zoom and lat/lng constant', () => {
    const wps = orbit.build(LOC, { duration: DUR });
    const z0 = wps[0].zoom;
    for (const wp of wps) {
      expect(wp.zoom).toBeCloseTo(z0, 5);
      expect(wp.lng).toBeCloseTo(LOC.lng, 5);
      expect(wp.lat).toBeCloseTo(LOC.lat, 5);
    }
  });

  it('bearing changes monotonically (decreasing by default)', () => {
    const wps = orbit.build(LOC, { duration: DUR, bearingSpan: 60 });
    for (let i = 1; i < wps.length; i++) {
      expect(wps[i].bearing).toBeLessThanOrEqual(wps[i - 1].bearing);
    }
  });
});

// ── vertigo ───────────────────────────────────────────────────────────────────

describe('vertigo', () => {
  it('produces valid waypoints (direction=in)', () => {
    assertWaypointShape(vertigo.build(LOC, { duration: DUR, direction: 'in' }), DUR);
  });

  it('produces valid waypoints (direction=out)', () => {
    assertWaypointShape(vertigo.build(LOC, { duration: DUR, direction: 'out' }), DUR);
  });

  it('direction=in: zoom decreases, pitch increases', () => {
    const wps = vertigo.build(LOC, { duration: DUR, direction: 'in' });
    expect(wps[wps.length - 1].zoom).toBeLessThan(wps[0].zoom);
    expect(wps[wps.length - 1].pitch).toBeGreaterThan(wps[0].pitch);
  });

  it('direction=out: zoom increases, pitch decreases', () => {
    const wps = vertigo.build(LOC, { duration: DUR, direction: 'out' });
    expect(wps[wps.length - 1].zoom).toBeGreaterThan(wps[0].zoom);
    expect(wps[wps.length - 1].pitch).toBeLessThan(wps[0].pitch);
  });
});

// ── sweepBetween ──────────────────────────────────────────────────────────────

describe('sweepBetween', () => {
  it('single loc → 2 waypoints at tOffset 0 and duration', () => {
    const wps = sweepBetween.build([LOC], { duration: DUR });
    assertWaypointShape(wps, DUR);
    expect(wps.length).toBe(2);
  });

  it('two locs → visits both in order', () => {
    const wps = sweepBetween.build([LOC, LOC2], { duration: DUR });
    assertWaypointShape(wps, DUR);
    expect(wps[0].lng).toBeCloseTo(LOC.lng, 5);
    const atLoc2 = wps.find(wp => Math.abs(wp.lng - LOC2.lng) < 0.01);
    expect(atLoc2).toBeDefined();
  });

  it('tOffsets are monotonically non-decreasing', () => {
    const wps = sweepBetween.build([LOC, LOC2, { lng: 0, lat: 51, zoom: 7 }], { duration: 30 });
    for (let i = 1; i < wps.length; i++) {
      expect(wps[i].tOffset).toBeGreaterThanOrEqual(wps[i - 1].tOffset);
    }
  });

  it('empty locs → empty array', () => {
    const wps = sweepBetween.build([], { duration: DUR });
    expect(wps).toEqual([]);
  });
});

// ── whipPan ───────────────────────────────────────────────────────────────────

describe('whipPan', () => {
  it('single-loc bearing swing → valid waypoints', () => {
    assertWaypointShape(whipPan.build([LOC], { duration: DUR }), DUR);
  });

  it('single-loc: bearing swings and returns', () => {
    const wps = whipPan.build([LOC], { duration: DUR });
    const bearings = wps.map(wp => wp.bearing);
    const midMax = Math.max(...bearings);
    expect(midMax).toBeGreaterThan(bearings[0]);           // swings out
    expect(bearings[bearings.length - 1]).toBe(bearings[0]); // returns
  });

  it('two-loc cut → valid waypoints', () => {
    assertWaypointShape(whipPan.build([LOC, LOC2], { duration: DUR }), DUR);
  });

  it('two-loc: first half at loc0, second half at loc1', () => {
    const wps = whipPan.build([LOC, LOC2], { duration: DUR });
    expect(wps[0].lng).toBeCloseTo(LOC.lng, 5);
    expect(wps[wps.length - 1].lng).toBeCloseTo(LOC2.lng, 5);
  });
});

// ── hover ─────────────────────────────────────────────────────────────────────

describe('hover', () => {
  it('produces valid waypoints', () => {
    assertWaypointShape(hover.build(LOC, { duration: DUR }), DUR);
  });

  it('bearing drifts slightly', () => {
    const wps = hover.build(LOC, { duration: DUR });
    expect(wps[wps.length - 1].bearing).toBeLessThan(wps[0].bearing);
  });

  it('drift is capped at MAX_HOVER_DRIFT for very long shots', () => {
    const wps = hover.build(LOC, { duration: 120 });
    const drift = wps[0].bearing - wps[wps.length - 1].bearing;
    expect(drift).toBeLessThanOrEqual(30 + 0.01);
  });

  it('position and zoom are constant', () => {
    const wps = hover.build(LOC, { duration: DUR });
    expect(wps[wps.length - 1].lng).toBeCloseTo(LOC.lng, 5);
    expect(wps[wps.length - 1].lat).toBeCloseTo(LOC.lat, 5);
    expect(wps[wps.length - 1].zoom).toBeCloseTo(LOC.zoom, 5);
  });
});

// ── globeSpin ─────────────────────────────────────────────────────────────────

describe('globeSpin', () => {
  it('produces valid waypoints', () => {
    assertWaypointShape(globeSpin.build({ duration: DUR }), DUR);
  });

  it('globe-level zoom and flat pitch', () => {
    const wps = globeSpin.build({ duration: DUR });
    for (const wp of wps) {
      expect(wp.zoom).toBeLessThanOrEqual(2);
      expect(wp.pitch).toBe(0);
    }
  });

  it('bearing0 parameter shifts start bearing', () => {
    const wps = globeSpin.build({ duration: DUR, bearing0: -45 });
    expect(wps[0].bearing).toBe(-45);
  });

  it('bearing decreases over time (spin direction)', () => {
    const wps = globeSpin.build({ duration: DUR });
    expect(wps[wps.length - 1].bearing).toBeLessThan(wps[0].bearing);
  });
});

// ── chain ─────────────────────────────────────────────────────────────────────

describe('chain', () => {
  it('concatenates two waypoint arrays with offset', () => {
    const a = [{ tOffset: 0, lng: 0, lat: 0, zoom: 1, pitch: 0, bearing: 0 }, { tOffset: 5, lng: 0, lat: 0, zoom: 1, pitch: 0, bearing: 0 }];
    const b = [{ tOffset: 0, lng: 1, lat: 1, zoom: 5, pitch: 50, bearing: -10 }, { tOffset: 5, lng: 1, lat: 1, zoom: 5, pitch: 50, bearing: -20 }];
    const result = chain(a, b, 5);
    expect(result).toHaveLength(4);
    expect(result[2].tOffset).toBe(5);
    expect(result[3].tOffset).toBe(10);
    expect(result[2].lng).toBe(1);
  });

  it('offset shifts all B tOffsets', () => {
    const a = [{ tOffset: 0, lng: 0, lat: 0, zoom: 1, pitch: 0, bearing: 0 }];
    const b = [{ tOffset: 0, lng: 1, lat: 1, zoom: 5, pitch: 50, bearing: 0 }, { tOffset: 7, lng: 1, lat: 1, zoom: 5, pitch: 50, bearing: 0 }];
    const result = chain(a, b, 3);
    expect(result[1].tOffset).toBe(3);
    expect(result[2].tOffset).toBe(10);
  });
});
