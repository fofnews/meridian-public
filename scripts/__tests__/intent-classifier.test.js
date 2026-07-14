import { describe, it, expect } from 'vitest';
import { classifyIntent, splitIntoSentences, classifyShotIntent } from '../intent-classifier.js';

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

  it('small written number without unit does NOT trigger data — "Two sides exchanged fire."', () => {
    expect(classify('Two sides exchanged fire.')).not.toBe('data');
  });

  it('small written number followed by unit DOES trigger data — "Two million displaced."', () => {
    expect(classify('Two million displaced.')).toBe('data');
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

  it('strips leading space when sentences separated by two spaces', () => {
    expect(splitIntoSentences('Hello world.  Foo bar.')).toEqual([
      'Hello world.',
      'Foo bar.',
    ]);
  });
});

describe('classifyShotIntent', () => {
  it('returns null for narration with no signals', () => {
    expect(classifyShotIntent('Senator Graham died at the age of seventy-one.')).toBeNull();
  });

  it('returns null for a year reference (written number, no unit)', () => {
    expect(classifyShotIntent('Graham became her guardian in nineteen seventy-seven.')).toBeNull();
  });

  it('returns data for written number + unit (percent)', () => {
    expect(classifyShotIntent('A twenty percent charge has been imposed on all cargo.')).toBe('data');
  });

  it('returns data for digit + billion dollars', () => {
    expect(classifyShotIntent('The settlement is worth 1.776 billion dollars.')).toBe('data');
  });

  it('returns data for written hundred + billion dollars', () => {
    expect(classifyShotIntent('The deal is valued at one hundred ten billion dollars.')).toBe('data');
  });

  it('returns stakes for escalation keyword', () => {
    expect(classifyShotIntent('Officials warn the conflict may escalate across the region.')).toBe('stakes');
  });

  it('returns contrast for contrast-starter sentence', () => {
    expect(classifyShotIntent('However, the opposing party disputes that claim.')).toBe('contrast');
  });

  it('data beats stakes on count', () => {
    const narration =
      'Tensions are rising in the region. ' +
      'A twenty percent tariff was imposed. ' +
      'Three million dollars in aid was pledged.';
    expect(classifyShotIntent(narration)).toBe('data');
  });

  it('data tiebreak beats stakes when counts equal', () => {
    const narration =
      'The situation could escalate. ' +
      'Forty billion dollars were committed.';
    expect(classifyShotIntent(narration)).toBe('data');
  });

  it('returns null for empty string', () => {
    expect(classifyShotIntent('')).toBeNull();
  });
});
