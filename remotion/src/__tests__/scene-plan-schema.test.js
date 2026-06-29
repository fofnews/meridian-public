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
});
