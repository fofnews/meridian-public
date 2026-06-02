/**
 * Converts an ElevenLabs timestamps sidecar into an array of word tokens,
 * each with start/end time in seconds.
 *
 * @param {object|null} ts - timestamps sidecar ({ source, characters, character_start_times_seconds, ... })
 * @returns {{ text: string, start: number, end: number }[]}
 */
export function tokenizeWords(ts) {
  if (ts?.source !== 'elevenlabs') return [];
  const chars  = ts.characters ?? [];
  const starts = ts.character_start_times_seconds ?? [];
  const ends   = ts.character_end_times_seconds   ?? [];

  const words = [];
  let text = '';
  let wordStart = 0;
  let wordEnd   = 0;

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (/\s/.test(ch)) {
      if (text.trim()) {
        words.push({ text: text.trim(), start: wordStart, end: wordEnd });
        text = '';
      }
    } else {
      if (!text) wordStart = starts[i] ?? 0;
      text += ch;
      wordEnd = ends[i] ?? 0;
    }
  }
  if (text.trim()) words.push({ text: text.trim(), start: wordStart, end: wordEnd });
  return words;
}

/**
 * Returns the index of the most recently started word at tInShot seconds.
 * Returns -1 if tInShot is before the first word's start time.
 *
 * @param {{ start: number }[]|null} words
 * @param {number} tInShot
 * @returns {number}
 */
export function getActiveWord(words, tInShot) {
  if (!words || words.length === 0) return -1;
  let idx = -1;
  for (let i = 0; i < words.length; i++) {
    if (words[i].start <= tInShot) idx = i;
  }
  return idx;
}
