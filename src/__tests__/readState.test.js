import { describe, it, expect, beforeEach } from 'vitest';
import { getReadIds, markRead, markAllRead, clearRead } from '../readState.js';

function installStorage(initial = {}) {
  const store = { ...initial };
  globalThis.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  };
  return store;
}

describe('readState', () => {
  beforeEach(() => installStorage());

  it('records and reads ids per edition', () => {
    markRead('2026-10-28-morning', 'group-0');
    markRead('2026-10-28-morning', 'story-3');
    markRead('2026-10-28-evening', 'story-3');
    expect([...getReadIds('2026-10-28-morning')]).toEqual(['group-0', 'story-3']);
    expect([...getReadIds('2026-10-28-evening')]).toEqual(['story-3']);
    expect(getReadIds('nope').size).toBe(0);
  });

  it('keeps only the last 14 editions used', () => {
    for (let i = 1; i <= 16; i++) markRead(`2026-10-${String(i).padStart(2, '0')}-morning`, 'story-1');
    expect(getReadIds('2026-10-01-morning').size).toBe(0);
    expect(getReadIds('2026-10-02-morning').size).toBe(0);
    expect(getReadIds('2026-10-03-morning').size).toBe(1);
    expect(getReadIds('2026-10-16-morning').size).toBe(1);
  });

  it('marks a whole edition read without duplicates, and clears everything', () => {
    markRead('e', 'story-1');
    markAllRead('e', ['story-1', 'group-0', 'story-2']);
    expect([...getReadIds('e')]).toEqual(['story-1', 'group-0', 'story-2']);
    clearRead();
    expect(getReadIds('e').size).toBe(0);
  });

  it('survives corrupt or unavailable storage', () => {
    installStorage({ 'meridian-read': '{not json' });
    expect(getReadIds('x').size).toBe(0);
    expect(() => markRead('x', 'story-1')).not.toThrow();
    globalThis.localStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
    expect(getReadIds('x').size).toBe(0);
    expect(() => markRead('x', 'story-1')).not.toThrow();
    expect(() => clearRead()).not.toThrow();
  });
});
