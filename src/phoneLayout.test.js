import { describe, it, expect } from 'vitest';
import { phoneMapHeight } from './phoneLayout.js';

describe('phoneMapHeight', () => {
  it('returns 120 when story is open regardless of viewport height', () => {
    expect(phoneMapHeight(true, 400)).toBe(120);
    expect(phoneMapHeight(true, 800)).toBe(120);
    expect(phoneMapHeight(true, 1200)).toBe(120);
  });

  it('clamps to 180 at small viewports', () => {
    // 0.28 * 600 = 168, below minimum of 180
    expect(phoneMapHeight(false, 600)).toBe(180);
    expect(phoneMapHeight(false, 0)).toBe(180);
  });

  it('clamps to 240 at large viewports', () => {
    // 0.28 * 900 = 252, above maximum of 240
    expect(phoneMapHeight(false, 900)).toBe(240);
    expect(phoneMapHeight(false, 1200)).toBe(240);
  });

  it('returns 0.28 * vh for mid-range viewports', () => {
    // 0.28 * 750 = 210, within [180, 240]
    expect(phoneMapHeight(false, 750)).toBe(0.28 * 750);
    expect(phoneMapHeight(false, 700)).toBe(0.28 * 700);
  });
});
