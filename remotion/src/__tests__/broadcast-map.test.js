import { describe, it, expect } from 'vitest';
import { arcTokenPosition } from '../broadcast-map.js';

// Minimal GeoJSON LineString fixture.
function makeArc(coords) {
  return { type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} };
}

describe('arcTokenPosition', () => {
  const arc = makeArc([[0, 0], [1, 1], [2, 0]]);

  it('returns start point at t=0', () => {
    const [lng, lat] = arcTokenPosition(arc, 0);
    expect(lng).toBeCloseTo(0, 5);
    expect(lat).toBeCloseTo(0, 5);
  });

  it('returns end point at t=1', () => {
    const [lng, lat] = arcTokenPosition(arc, 1);
    expect(lng).toBeCloseTo(2, 5);
    expect(lat).toBeCloseTo(0, 5);
  });

  it('returns midpoint at t=0.5', () => {
    const [lng, lat] = arcTokenPosition(arc, 0.5);
    expect(lng).toBeCloseTo(1, 5);
    expect(lat).toBeCloseTo(1, 5);
  });

  it('clamps t below 0 to start', () => {
    const [lng, lat] = arcTokenPosition(arc, -1);
    expect(lng).toBeCloseTo(0, 5);
    expect(lat).toBeCloseTo(0, 5);
  });

  it('clamps t above 1 to end', () => {
    const [lng, lat] = arcTokenPosition(arc, 2);
    expect(lng).toBeCloseTo(2, 5);
    expect(lat).toBeCloseTo(0, 5);
  });

  it('interpolates between points', () => {
    // t=0.25 → between [0,0] and [1,1] at f=0.5
    const [lng, lat] = arcTokenPosition(arc, 0.25);
    expect(lng).toBeCloseTo(0.5, 5);
    expect(lat).toBeCloseTo(0.5, 5);
  });

  it('handles single-segment arc (2 coords)', () => {
    const short = makeArc([[10, 20], [30, 40]]);
    const [lng, lat] = arcTokenPosition(short, 0.5);
    expect(lng).toBeCloseTo(20, 5);
    expect(lat).toBeCloseTo(30, 5);
  });

  it('returns [0,0] for null arc', () => {
    expect(arcTokenPosition(null, 0.5)).toEqual([0, 0]);
    expect(arcTokenPosition({ geometry: null }, 0.5)).toEqual([0, 0]);
  });

  it('returns [0,0] for arc with fewer than 2 coords', () => {
    expect(arcTokenPosition(makeArc([[1, 2]]), 0.5)).toEqual([0, 0]);
    expect(arcTokenPosition(makeArc([]), 0.5)).toEqual([0, 0]);
  });
});
