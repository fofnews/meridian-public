import { describe, it, expect } from 'vitest';
import { normalizeClaims, claimTier, groupClaimsByTier, coverageByLean, gapNote, headlinesByLean } from '../openStory.js';

const leans = { CNN: 'left', NPR: 'left', BBC: 'center', Fox: 'right', Newsmax: 'right' };

describe('claimTier', () => {
  it('spectrum needs left, center and right', () => {
    expect(claimTier({ sources: ['CNN', 'BBC', 'Fox'] }, leans)).toBe('spectrum');
  });
  it('two outlets on one side is multi', () => {
    expect(claimTier({ sources: ['CNN', 'NPR'] }, leans)).toBe('multi');
  });
  it('one outlet is single', () => {
    expect(claimTier({ sources: ['Fox'] }, leans)).toBe('single');
  });
  it('outlets missing from the lean map never count toward the spectrum', () => {
    expect(claimTier({ sources: ['CNN', 'BBC', 'Unknown'] }, leans)).toBe('multi');
  });
});

describe('normalizeClaims', () => {
  it('handles legacy agreements, unique angles and facts', () => {
    const a = { agreements: ['x'], uniqueAngles: [{ source: 'CNN', angle: 'y' }], facts: ['z'] };
    const out = normalizeClaims(a, [{ source: 'Fox' }]);
    expect(groupClaimsByTier(out, leans)).toMatchObject({ multi: [{ statement: 'x' }], single: [{ statement: 'y' }, { statement: 'z' }] });
  });
  it('returns [] without analysis', () => {
    expect(normalizeClaims(null, [])).toEqual([]);
  });
});

describe('coverage', () => {
  const articles = [{ source: 'Fox' }, { source: 'Newsmax' }];
  const cov = coverageByLean(leans, articles);
  it('marks covered outlets', () => {
    expect(cov.right.every(o => o.covered)).toBe(true);
    expect(cov.left.some(o => o.covered)).toBe(false);
  });
  it('names the gap', () => {
    expect(gapNote(cov)).toBe('Only right-leaning outlets covered this');
    expect(gapNote(coverageByLean(leans, [{ source: 'CNN' }, { source: 'BBC' }]))).toBe('No right-leaning outlet covered this');
    expect(gapNote(coverageByLean(leans, [{ source: 'CNN' }, { source: 'BBC' }, { source: 'Fox' }]))).toBe('');
  });
});

describe('headlinesByLean', () => {
  it('puts outlets with no lean in other', () => {
    const cols = headlinesByLean([{ source: 'CNN' }, { source: 'Nobody' }], leans);
    expect(cols.left).toHaveLength(1);
    expect(cols.other).toHaveLength(1);
  });
});
