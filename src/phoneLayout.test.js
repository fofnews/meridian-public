import { describe, it, expect } from 'vitest';
import { phoneMapHeight } from './phoneLayout.js';

// Helper mirrors the finalH computation inside scrollRowBelowMap.
function computeFinalH(stickyH, openBefore, openAfter, vh) {
  const nonMapH = stickyH - phoneMapHeight(openBefore, vh);
  return nonMapH + phoneMapHeight(openAfter, vh);
}

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

describe('scrollRowBelowMap finalH computation', () => {
  // Assumes stickyH = mapH + stripH where stripH = 44.
  const STRIP_H = 44;
  const VH = 812; // mid-range: phoneMapHeight(false, 812) = 0.28*812 ≈ 227.36

  it('A→B (openBefore=true, openAfter=true): total sticky height unchanged', () => {
    const mapH = 120;
    const stickyH = mapH + STRIP_H;
    expect(computeFinalH(stickyH, true, true, VH)).toBe(stickyH);
  });

  it('B→A same-direction switch also leaves height unchanged', () => {
    const stickyH = 120 + STRIP_H;
    expect(computeFinalH(stickyH, true, true, 390)).toBe(stickyH);
  });

  it('closed→open: finalH = 120 + stripH', () => {
    const closedMap = phoneMapHeight(false, VH);
    const stickyH = closedMap + STRIP_H;
    expect(computeFinalH(stickyH, false, true, VH)).toBeCloseTo(120 + STRIP_H);
  });

  it('open→closed: finalH = closedMap + stripH', () => {
    const closedMap = phoneMapHeight(false, VH);
    const stickyH = 120 + STRIP_H;
    expect(computeFinalH(stickyH, true, false, VH)).toBeCloseTo(closedMap + STRIP_H);
  });

  it('no-change (both false): total sticky height unchanged', () => {
    const closedMap = phoneMapHeight(false, VH);
    const stickyH = closedMap + STRIP_H;
    expect(computeFinalH(stickyH, false, false, VH)).toBeCloseTo(stickyH);
  });
});
