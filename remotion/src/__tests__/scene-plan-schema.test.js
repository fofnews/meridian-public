import { describe, it, expect } from 'vitest';
import { ScenePlan, Treatment } from '../scene-plan/schema.js';

const VALID_PLAN = {
  version: '1',
  edition: '2026-06-28-evening',
  fps: 30,
  width: 1920,
  height: 1080,
  scenes: [
    {
      shotIndex: 0,
      tStart: 0,
      tEnd: 12.5,
      treatments: [
        { type: 'lower-third', tStart: 1.0, tEnd: 4.0, headline: 'Trade tensions rise', label: 'Context' },
        { type: 'stat-card',   tStart: 5.0, tEnd: 8.0, value: '47%',                   label: 'DATA' },
      ],
    },
    {
      shotIndex: 1,
      tStart: 12.5,
      tEnd: 25.0,
      treatments: [
        { type: 'camera-move', tStart: 12.5, tEnd: 14.5, lat: 48.8, lng: 2.3, zoom: 9, pitch: 50, bearing: -10 },
        { type: 'map-annotation', tStart: 15.0, tEnd: 20.0, lat: 48.8, lng: 2.3, text: 'Paris' },
        { type: 'connection-arc', tStart: 16.0, tEnd: 22.0, fromLat: 48.8, fromLng: 2.3, toLat: 51.5, toLng: -0.1 },
      ],
    },
  ],
};

describe('ScenePlan schema', () => {
  it('parses a valid plan without throwing', () => {
    expect(() => ScenePlan.parse(VALID_PLAN)).not.toThrow();
  });

  it('returns the typed object on success', () => {
    const parsed = ScenePlan.parse(VALID_PLAN);
    expect(parsed.version).toBe('1');
    expect(parsed.scenes).toHaveLength(2);
    expect(parsed.scenes[0].treatments[0].type).toBe('lower-third');
  });

  it('throws when version is wrong', () => {
    expect(() => ScenePlan.parse({ ...VALID_PLAN, version: '2' })).toThrow();
  });

  it('throws when a treatment type is unknown', () => {
    const bad = structuredClone(VALID_PLAN);
    bad.scenes[0].treatments.push({ type: 'unknown-type', tStart: 0, tEnd: 1 });
    expect(() => ScenePlan.parse(bad)).toThrow();
  });

  it('throws when tEnd is missing on a treatment', () => {
    const bad = structuredClone(VALID_PLAN);
    delete bad.scenes[0].treatments[0].tEnd;
    expect(() => ScenePlan.parse(bad)).toThrow();
  });

  it('throws when lower-third is missing headline', () => {
    const bad = structuredClone(VALID_PLAN);
    delete bad.scenes[0].treatments[0].headline;
    expect(() => ScenePlan.parse(bad)).toThrow();
  });

  it('parses safeParse as success for valid plan', () => {
    const result = ScenePlan.safeParse(VALID_PLAN);
    expect(result.success).toBe(true);
  });

  it('safeParse returns failure for invalid plan', () => {
    const result = ScenePlan.safeParse({ version: '1', edition: 'x' }); // missing fields
    expect(result.success).toBe(false);
  });
});

describe('Treatment discriminated union', () => {
  it('parses a lower-third treatment', () => {
    const t = Treatment.parse({ type: 'lower-third', tStart: 0, tEnd: 3, headline: 'Hi' });
    expect(t.type).toBe('lower-third');
  });

  it('parses a stat-card treatment', () => {
    const t = Treatment.parse({ type: 'stat-card', tStart: 0, tEnd: 3, value: '42%' });
    expect(t.type).toBe('stat-card');
    expect(t.value).toBe('42%');
  });

  it('parses a flow-arrow treatment with minimal fields', () => {
    const t = Treatment.parse({
      type: 'flow-arrow',
      tStart: 0,
      tEnd: 8,
      flows: [{ path: [{ lng: 10, lat: 50 }, { lng: 20, lat: 55 }] }],
    });
    expect(t.type).toBe('flow-arrow');
    expect(t.flows).toHaveLength(1);
  });

  it('parses a flow-arrow with all optional fields', () => {
    const t = Treatment.parse({
      type: 'flow-arrow',
      tStart: 0,
      tEnd: 10,
      style: 'arrow',
      flows: [{
        path: [{ lng: 10, lat: 50 }, { lng: 15, lat: 52 }, { lng: 20, lat: 55 }],
        label: 'Supply route',
        color: '#ff0000',
        weight: 2,
        revealDuration: 2.5,
        revealDelay: 0.5,
      }],
    });
    expect(t.style).toBe('arrow');
    expect(t.flows[0].color).toBe('#ff0000');
    expect(t.flows[0].weight).toBe(2);
  });

  it('throws when flow-arrow has a path with fewer than 2 points', () => {
    expect(() => Treatment.parse({
      type: 'flow-arrow',
      tStart: 0,
      tEnd: 5,
      flows: [{ path: [{ lng: 10, lat: 50 }] }],
    })).toThrow();
  });

  it('throws when flow-arrow has no flows', () => {
    expect(() => Treatment.parse({
      type: 'flow-arrow',
      tStart: 0,
      tEnd: 5,
      flows: [],
    })).toThrow();
  });

  it('parses a ripple-expand treatment', () => {
    const t = Treatment.parse({ type: 'ripple-expand', tStart: 0, tEnd: 3, lat: 40.73, lng: -73.99 });
    expect(t.type).toBe('ripple-expand');
    expect(t.lat).toBeCloseTo(40.73, 2);
    expect(t.lng).toBeCloseTo(-73.99, 2);
  });

  it('throws when ripple-expand is missing lat', () => {
    expect(() => Treatment.parse({ type: 'ripple-expand', tStart: 0, tEnd: 3, lng: -73.99 })).toThrow();
  });

  it('parses a label-bloom treatment', () => {
    const t = Treatment.parse({ type: 'label-bloom', tStart: 0, tEnd: 4, lat: 48.86, lng: 2.35, text: 'Paris' });
    expect(t.type).toBe('label-bloom');
    expect(t.text).toBe('Paris');
  });

  it('throws when label-bloom is missing text', () => {
    expect(() => Treatment.parse({ type: 'label-bloom', tStart: 0, tEnd: 4, lat: 48.86, lng: 2.35 })).toThrow();
  });

  it('parses a particle-trail treatment with minimal fields', () => {
    const t = Treatment.parse({
      type: 'particle-trail', tStart: 0, tEnd: 8,
      path: [{ lat: 40, lng: -74 }, { lat: 48, lng: 2 }],
    });
    expect(t.type).toBe('particle-trail');
    expect(t.path).toHaveLength(2);
  });

  it('throws when particle-trail path has fewer than 2 points', () => {
    expect(() => Treatment.parse({
      type: 'particle-trail', tStart: 0, tEnd: 5,
      path: [{ lat: 40, lng: -74 }],
    })).toThrow();
  });

  it('parses a route-reveal treatment', () => {
    const t = Treatment.parse({
      type: 'route-reveal', tStart: 0, tEnd: 6,
      from: { lat: 40, lng: -74 }, to: { lat: 48, lng: 2 },
    });
    expect(t.type).toBe('route-reveal');
    expect(t.from.lat).toBe(40);
  });

  it('throws when route-reveal is missing to', () => {
    expect(() => Treatment.parse({
      type: 'route-reveal', tStart: 0, tEnd: 6,
      from: { lat: 40, lng: -74 },
    })).toThrow();
  });

  it('parses route-reveal with explicit mode:geodesic', () => {
    const t = Treatment.parse({
      type: 'route-reveal', tStart: 0, tEnd: 6,
      from: { lat: 40, lng: -74 }, to: { lat: 48, lng: 2 }, mode: 'geodesic',
    });
    expect(t.mode).toBe('geodesic');
  });

  it('route-reveal mode defaults to geodesic when omitted', () => {
    const t = Treatment.parse({
      type: 'route-reveal', tStart: 0, tEnd: 6,
      from: { lat: 40, lng: -74 }, to: { lat: 48, lng: 2 },
    });
    expect(t.mode).toBe('geodesic');
  });

  it('throws when route-reveal mode is invalid', () => {
    expect(() => Treatment.parse({
      type: 'route-reveal', tStart: 0, tEnd: 6,
      from: { lat: 40, lng: -74 }, to: { lat: 48, lng: 2 }, mode: 'curved',
    })).toThrow();
  });

  it('parses an impact-radius treatment', () => {
    const t = Treatment.parse({ type: 'impact-radius', tStart: 0, tEnd: 5, lat: 48.86, lng: 2.35, radiusKm: 150 });
    expect(t.type).toBe('impact-radius');
    expect(t.radiusKm).toBe(150);
  });

  it('throws when impact-radius is missing radiusKm', () => {
    expect(() => Treatment.parse({ type: 'impact-radius', tStart: 0, tEnd: 5, lat: 48.86, lng: 2.35 })).toThrow();
  });

  it('parses a spotlight-mask treatment', () => {
    const t = Treatment.parse({ type: 'spotlight-mask', tStart: 0, tEnd: 5, lat: 48.86, lng: 2.35 });
    expect(t.type).toBe('spotlight-mask');
  });

  it('throws when spotlight-mask is missing lat', () => {
    expect(() => Treatment.parse({ type: 'spotlight-mask', tStart: 0, tEnd: 5, lng: 2.35 })).toThrow();
  });

  it('parses a hatched-zone treatment', () => {
    const polygon = { type: 'Polygon', coordinates: [[[2, 48], [3, 48], [3, 49], [2, 48]]] };
    const t = Treatment.parse({ type: 'hatched-zone', tStart: 0, tEnd: 6, polygon, pattern: 'contested' });
    expect(t.type).toBe('hatched-zone');
    expect(t.pattern).toBe('contested');
  });

  it('throws when hatched-zone has invalid pattern', () => {
    const polygon = { type: 'Polygon', coordinates: [[[2, 48], [3, 48], [3, 49], [2, 48]]] };
    expect(() => Treatment.parse({ type: 'hatched-zone', tStart: 0, tEnd: 6, polygon, pattern: 'unknown' })).toThrow();
  });

  it('parses a magnitude-bubble treatment', () => {
    const t = Treatment.parse({ type: 'magnitude-bubble', tStart: 0, tEnd: 5, lat: 48.86, lng: 2.35, value: 42 });
    expect(t.type).toBe('magnitude-bubble');
    expect(t.value).toBe(42);
  });

  it('throws when magnitude-bubble is missing value', () => {
    expect(() => Treatment.parse({ type: 'magnitude-bubble', tStart: 0, tEnd: 5, lat: 48.86, lng: 2.35 })).toThrow();
  });

  it('parses an arc-token treatment', () => {
    const t = Treatment.parse({
      type: 'arc-token', tStart: 0, tEnd: 8,
      arcs: [{ from: { lat: 40, lng: -74 }, to: { lat: 51, lng: -0.1 } }],
    });
    expect(t.type).toBe('arc-token');
    expect(t.arcs).toHaveLength(1);
  });

  it('throws when arc-token has empty arcs array', () => {
    expect(() => Treatment.parse({ type: 'arc-token', tStart: 0, tEnd: 8, arcs: [] })).toThrow();
  });

  it('parses a side-by-side-callout treatment', () => {
    const t = Treatment.parse({
      type: 'side-by-side-callout', tStart: 0, tEnd: 5,
      labelA: 'US', valueA: '$21T', labelB: 'China', valueB: '$18T',
    });
    expect(t.type).toBe('side-by-side-callout');
    expect(t.valueA).toBe('$21T');
  });

  it('throws when side-by-side-callout is missing labelB', () => {
    expect(() => Treatment.parse({
      type: 'side-by-side-callout', tStart: 0, tEnd: 5,
      labelA: 'US', valueA: '$21T', valueB: '$18T',
    })).toThrow();
  });

  it('parses an escalation-warning treatment', () => {
    const t = Treatment.parse({ type: 'escalation-warning', tStart: 0, tEnd: 4, text: 'Tensions escalating' });
    expect(t.type).toBe('escalation-warning');
    expect(t.text).toBe('Tensions escalating');
  });

  it('throws when escalation-warning is missing text', () => {
    expect(() => Treatment.parse({ type: 'escalation-warning', tStart: 0, tEnd: 4 })).toThrow();
  });

  it('parses a context-strip treatment', () => {
    const t = Treatment.parse({ type: 'context-strip', tStart: 0, tEnd: 6, text: 'Background context here.' });
    expect(t.type).toBe('context-strip');
    expect(t.text).toBe('Background context here.');
  });

  it('throws when context-strip is missing text', () => {
    expect(() => Treatment.parse({ type: 'context-strip', tStart: 0, tEnd: 6 })).toThrow();
  });
});
