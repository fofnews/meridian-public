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

/**
 * Groups consecutive words into sentences delimited by terminal punctuation
 * (.!?). A trailing fragment with no terminal punctuation is emitted as its
 * own sentence so the end of a shot always renders.
 *
 * @param {{ text: string, start: number, end: number }[]} words
 * @returns {{ words: object[], startWordIdx: number, endWordIdx: number, start: number, end: number }[]}
 */
export function tokenizeSentences(words) {
  if (!words || words.length === 0) return [];
  const sentences = [];
  let sentenceWords = [];
  let startWordIdx = 0;

  for (let i = 0; i < words.length; i++) {
    sentenceWords.push(words[i]);
    if (/[.!?]$/.test(words[i].text)) {
      sentences.push({
        words: sentenceWords,
        startWordIdx,
        endWordIdx: i,
        start: sentenceWords[0].start,
        end: sentenceWords[sentenceWords.length - 1].end,
      });
      sentenceWords = [];
      startWordIdx = i + 1;
    }
  }

  if (sentenceWords.length > 0) {
    sentences.push({
      words: sentenceWords,
      startWordIdx,
      endWordIdx: words.length - 1,
      start: sentenceWords[0].start,
      end: sentenceWords[sentenceWords.length - 1].end,
    });
  }

  return sentences;
}

/**
 * Returns the index of the sentence whose word range contains activeWordIdx.
 * Returns -1 if activeWordIdx is -1, sentences is empty, or no match.
 *
 * @param {{ startWordIdx: number, endWordIdx: number }[]} sentences
 * @param {number} activeWordIdx
 * @returns {number}
 */
export function getActiveSentence(sentences, activeWordIdx) {
  if (!sentences || sentences.length === 0 || activeWordIdx < 0) return -1;
  for (let i = 0; i < sentences.length; i++) {
    if (activeWordIdx >= sentences[i].startWordIdx && activeWordIdx <= sentences[i].endWordIdx) {
      return i;
    }
  }
  return -1;
}
