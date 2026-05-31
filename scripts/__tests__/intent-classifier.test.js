import { describe, it, expect } from 'vitest';
import { classifyIntent, splitIntoSentences } from '../intent-classifier.js';

const classify = (sentence, opts = {}) =>
  classifyIntent({
    anchor: opts.anchor ?? 'Damascus',
    sentenceContainingAnchor: sentence,
    previousSentence: opts.previousSentence ?? null,
    isFirstOccurrenceInShot: opts.isFirstOccurrenceInShot ?? false,
  });

describe('classifyIntent', () => {
  it('contrast — sentence starting with "But"', () => {
    expect(classify('But in Damascus, the calculus is different.')).toBe('contrast');
  });

  it('data beats stakes — "Casualties could reach 200."', () => {
    expect(classify('Casualties could reach 200.')).toBe('data');
  });

  it('data — written number + unit: "The strike killed eleven."', () => {
    expect(classify('The strike killed eleven.')).toBe('data');
  });

  it('stakes — "He warns the conflict may escalate."', () => {
    expect(classify('He warns the conflict may escalate.')).toBe('stakes');
  });

  it('quote guard — contrast word inside quotes does not trigger contrast', () => {
    expect(classify('She said "but we\'ll persist."')).not.toBe('contrast');
  });

  it('reveal — first occurrence, no matching keywords', () => {
    expect(classifyIntent({
      anchor: 'Beirut',
      sentenceContainingAnchor: 'Reporting continues from Beirut.',
      previousSentence: null,
      isFirstOccurrenceInShot: true,
    })).toBe('reveal');
  });

  it('hold — non-first occurrence, no matching keywords', () => {
    expect(classifyIntent({
      anchor: 'Beirut',
      sentenceContainingAnchor: 'Reporting continues from Beirut.',
      previousSentence: null,
      isFirstOccurrenceInShot: false,
    })).toBe('hold');
  });
});

describe('splitIntoSentences', () => {
  it('splits basic two-sentence text', () => {
    expect(splitIntoSentences('Hello world. Foo bar.')).toEqual([
      'Hello world.',
      'Foo bar.',
    ]);
  });

  it('does not split inside double quotes', () => {
    const result = splitIntoSentences('He said "wait. Stop." Then left.');
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('He said "wait. Stop."');
    expect(result[1]).toBe('Then left.');
  });
});
