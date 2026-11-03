import { describe, it, expect, beforeEach } from 'vitest';
import { DEFAULTS, loadSettings, saveSettings, loadMapVisible, saveMapVisible, clearAllStored } from '../settings.js';

function installStorage(initial = {}) {
  const store = { ...initial };
  globalThis.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  };
  return store;
}

describe('settings', () => {
  beforeEach(() => installStorage());

  it('defaults when nothing is stored', () => {
    expect(loadSettings()).toEqual(DEFAULTS);
    expect(loadMapVisible()).toBe(true);
  });

  it('round-trips saved values', () => {
    const s = { textSize: 'large', readingFont: 'atkinson', startTab: 'disagreements', markOpened: false };
    saveSettings(s);
    expect(loadSettings()).toEqual(s);
  });

  it('ignores corrupt or invalid values field by field', () => {
    installStorage({ 'meridian-settings': '{not json' });
    expect(loadSettings()).toEqual(DEFAULTS);
    installStorage({ 'meridian-settings': JSON.stringify({ textSize: 'huge', readingFont: 'comic', startTab: 'x', markOpened: 'no', extra: 1 }) });
    expect(loadSettings()).toEqual(DEFAULTS);
    installStorage({ 'meridian-settings': JSON.stringify({ textSize: 'toString', startTab: 'disagreements' }) });
    expect(loadSettings()).toEqual({ ...DEFAULTS, startTab: 'disagreements' });
  });

  it('persists map visibility', () => {
    saveMapVisible(false);
    expect(loadMapVisible()).toBe(false);
    saveMapVisible(true);
    expect(loadMapVisible()).toBe(true);
  });

  it('clears everything it owns and nothing else', () => {
    const store = installStorage({ 'meridian-settings': '{}', 'meridian-theme': 'dark', 'meridian-read': '{}', 'meridian-map-visible': 'false', 'meridian-map': 'true', meridian_votes: '{}' });
    clearAllStored();
    expect(Object.keys(store)).toEqual(['meridian_votes']);
  });

  it('survives unavailable storage', () => {
    globalThis.localStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
    expect(loadSettings()).toEqual(DEFAULTS);
    expect(loadMapVisible()).toBe(true);
    expect(() => { saveSettings(DEFAULTS); saveMapVisible(false); clearAllStored(); }).not.toThrow();
  });
});
