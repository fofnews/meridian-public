import { describe, it, expect } from 'vitest';
import { tokenizeWords, getActiveWord } from '../subtitles.js';

function makeTsFixture(str) {
  const chars = str.split('');
  return {
    source: 'elevenlabs',
    characters: chars,
    character_start_times_seconds: chars.map((_, i) => i * 0.1),
    character_end_times_seconds:   chars.map((_, i) => (i + 1) * 0.1),
    normalized_text: str,
  };
}

describe('tokenizeWords', () => {
  it('splits characters into words with start/end times', () => {
    const ts = makeTsFixture('Hello world');
    const words = tokenizeWords(ts);
    // 'Hello world' — indices 0-4 = Hello, 5 = space, 6-10 = world
    expect(words).toHaveLength(2);
    expect(words[0].text).toBe('Hello');
    expect(words[0].start).toBeCloseTo(0.0, 5);
    expect(words[0].end).toBeCloseTo(0.5, 5);
    expect(words[1].text).toBe('world');
    expect(words[1].start).toBeCloseTo(0.6, 5);
    expect(words[1].end).toBeCloseTo(1.1, 5);
  });

  it('returns [] when source is not elevenlabs', () => {
    expect(tokenizeWords({ source: null })).toEqual([]);
    expect(tokenizeWords({ source: 'openai' })).toEqual([]);
    expect(tokenizeWords(null)).toEqual([]);
  });

  it('strips punctuation-only tokens', () => {
    // A word like "war," should be kept; a lone "," should be skipped
    const ts = makeTsFixture('war, peace');
    const words = tokenizeWords(ts);
    expect(words.length).toBeGreaterThanOrEqual(2);
    expect(words[0].text).toMatch(/^war/);
  });

  it('handles leading/trailing spaces', () => {
    const ts = makeTsFixture(' Hi there ');
    const words = tokenizeWords(ts);
    expect(words).toHaveLength(2);
    expect(words[0].text).toBe('Hi');
    expect(words[1].text).toBe('there');
  });
});

describe('getActiveWord', () => {
  const words = [
    { text: 'one',   start: 0.0, end: 0.3 },
    { text: 'two',   start: 0.4, end: 0.7 },
    { text: 'three', start: 0.8, end: 1.2 },
  ];

  it('returns index of word whose start <= tInShot', () => {
    expect(getActiveWord(words, 0.0)).toBe(0);
    expect(getActiveWord(words, 0.5)).toBe(1);
    expect(getActiveWord(words, 0.9)).toBe(2);
  });

  it('returns -1 before the first word starts', () => {
    const late = [{ text: 'late', start: 2.0, end: 2.5 }];
    expect(getActiveWord(late, 0.5)).toBe(-1);
  });

  it('holds last word index after it ends', () => {
    expect(getActiveWord(words, 99)).toBe(2);
  });

  it('returns -1 for empty array', () => {
    expect(getActiveWord([], 1)).toBe(-1);
    expect(getActiveWord(null, 1)).toBe(-1);
  });
});
