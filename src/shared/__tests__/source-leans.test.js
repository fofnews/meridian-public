import { describe, it, expect } from 'vitest';
import { LEGACY_LEANS, CURRENT_LEANS, leansFor, outletsByLean, outletCount } from '../source-leans.js';

describe('outletsByLean', () => {
  it('groups a legacy (unstamped) report by its own leans', () => {
    const g = outletsByLean(leansFor({}));
    expect(g.left).toContain('Newsweek');
    expect(g.center).toEqual(expect.arrayContaining(['AP News', 'Al Jazeera']));
    expect(g.right).not.toContain('Newsweek');
  });

  it('groups a stamped report by the stamped leans', () => {
    const g = outletsByLean(leansFor({ sourceLeans: CURRENT_LEANS }));
    expect(g.center).toContain('Newsweek');
    expect(g.left).toContain('AP News');
    expect(g.left).not.toContain('Newsweek');
  });

  it('keeps map key order within each group', () => {
    const g = outletsByLean({ B: 'left', A: 'left', C: 'right' });
    expect(g.left).toEqual(['B', 'A']);
    expect(g.right).toEqual(['C']);
  });

  it('ignores unknown lean values and tolerates a missing map', () => {
    expect(outletsByLean({ X: 'purple' })).toEqual({ left: [], center: [], right: [] });
    expect(outletsByLean(null)).toEqual({ left: [], center: [], right: [] });
  });
});

describe('outletCount', () => {
  it('counts outlets in the map', () => {
    expect(outletCount(LEGACY_LEANS)).toBe(Object.keys(LEGACY_LEANS).length);
    expect(outletCount(CURRENT_LEANS)).toBe(Object.keys(CURRENT_LEANS).length);
    expect(outletCount(undefined)).toBe(0);
  });
});
