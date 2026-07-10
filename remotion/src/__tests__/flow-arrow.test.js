import { describe, it, expect } from 'vitest';
import { trimPolyline } from '../scene-plan/treatments/FlowArrow.jsx';

describe('trimPolyline', () => {
  const A = [0, 0];
  const B = [10, 0];
  const C = [10, 10];

  it('returns start point twice when progress is 0', () => {
    const result = trimPolyline([A, B], 0);
    expect(result).toEqual([A, A]);
  });

  it('returns full path when progress is 1', () => {
    const result = trimPolyline([A, B, C], 1);
    expect(result).toEqual([A, B, C]);
  });

  it('trims a two-point line to halfway', () => {
    const result = trimPolyline([A, B], 0.5);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(A);
    expect(result[1]).toEqual([5, 0]); // halfway between [0,0] and [10,0]
  });

  it('trims a two-point line to 25%', () => {
    const result = trimPolyline([A, B], 0.25);
    expect(result[1]).toEqual([2.5, 0]);
  });

  it('trims a multi-segment path across the first segment', () => {
    // A–B is 10 units, B–C is 10 units, total 20. 25% = 5 units into A–B.
    const result = trimPolyline([A, B, C], 0.25);
    expect(result).toHaveLength(2);
    expect(result[1]).toEqual([5, 0]);
  });

  it('trims a multi-segment path spanning into the second segment', () => {
    // A–B is 10 units, B–C is 10 units, total 20. 75% = 15 units = B + halfway to C.
    const result = trimPolyline([A, B, C], 0.75);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(A);
    expect(result[1]).toEqual(B);
    expect(result[2]).toEqual([10, 5]); // halfway along B–C
  });

  it('clamps values below 0 to the start point', () => {
    const result = trimPolyline([A, B], -0.5);
    expect(result).toEqual([A, A]);
  });

  it('clamps values above 1 to the full path', () => {
    const result = trimPolyline([A, B], 1.5);
    expect(result).toEqual([A, B]);
  });
});
