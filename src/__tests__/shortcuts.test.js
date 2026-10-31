import { describe, it, expect } from 'vitest';
import { shouldIgnoreKey, nextRowIndex } from '../shortcuts.js';

const ev = (over = {}) => ({ ctrlKey: false, metaKey: false, altKey: false, target: { tagName: 'BODY' }, ...over });

describe('shouldIgnoreKey', () => {
  it('lets plain keys through', () => {
    expect(shouldIgnoreKey(ev(), false)).toBe(false);
  });
  it('ignores while settings is open', () => {
    expect(shouldIgnoreKey(ev(), true)).toBe(true);
  });
  it('ignores modifier combos but not shift', () => {
    expect(shouldIgnoreKey(ev({ ctrlKey: true }), false)).toBe(true);
    expect(shouldIgnoreKey(ev({ metaKey: true }), false)).toBe(true);
    expect(shouldIgnoreKey(ev({ altKey: true }), false)).toBe(true);
    expect(shouldIgnoreKey(ev({ shiftKey: true }), false)).toBe(false);
  });
  it('ignores typing targets', () => {
    expect(shouldIgnoreKey(ev({ target: { tagName: 'INPUT' } }), false)).toBe(true);
    expect(shouldIgnoreKey(ev({ target: { tagName: 'TEXTAREA' } }), false)).toBe(true);
    expect(shouldIgnoreKey(ev({ target: { tagName: 'DIV', isContentEditable: true } }), false)).toBe(true);
  });
});

describe('nextRowIndex', () => {
  it('starts at the first row going down and the last going up', () => {
    expect(nextRowIndex(-1, 5, 1)).toBe(0);
    expect(nextRowIndex(-1, 5, -1)).toBe(4);
  });
  it('clamps at both ends', () => {
    expect(nextRowIndex(4, 5, 1)).toBe(4);
    expect(nextRowIndex(0, 5, -1)).toBe(0);
    expect(nextRowIndex(2, 5, 1)).toBe(3);
  });
  it('returns -1 with no rows', () => {
    expect(nextRowIndex(-1, 0, 1)).toBe(-1);
  });
});
