const UNITS = '(?:percent|%|billion|million|thousand|trillion|dollars?|deaths?|killed|injured)';
const WRITTEN = '(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|trillion)';

const DATA_RE = new RegExp(
  `\\b(?:` +
    `\\d[\\d,.]*(?:\\s+${UNITS})?` +
    `|${WRITTEN}(?:\\s+${UNITS})?` +
    `|${UNITS}\\s+${WRITTEN}` +
  `)\\b`,
  'i'
);

const CONTRAST_STARTERS_RE = /^(but|however|unlike|while|whereas|in contrast|on the other hand|despite|yet)\b/i;
const STAKES_RE = /\b(could|may|might|will likely|threatens?|risks?|fear|warns?|consequences?|destabilize|escalate)\b/i;

function quoteRatio(sentence) {
  let inside = false;
  let quotedChars = 0;
  for (const ch of sentence) {
    if (ch === '"') { inside = !inside; continue; }
    if (inside) quotedChars++;
  }
  return sentence.length > 0 ? quotedChars / sentence.length : 0;
}

export function splitIntoSentences(text) {
  const result = [];
  let current = '';
  let quoteDepth = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') quoteDepth = quoteDepth === 0 ? 1 : 0;
    current += ch;

    if (/[.!?]/.test(ch)) {
      let j = i + 1;
      let closingQuotes = '';
      while (j < text.length && text[j] === '"') {
        closingQuotes += text[j];
        j++;
      }
      const atEnd = j === text.length;
      const followedBySpace = j < text.length && text[j] === ' ';
      const wouldClose = quoteDepth > 0 && closingQuotes.length > 0;
      const openAfterClose = (quoteDepth - closingQuotes.length) === 0;

      if ((followedBySpace || atEnd) && (quoteDepth === 0 || (wouldClose && openAfterClose))) {
        current += closingQuotes;
        i = j - 1;
        quoteDepth = Math.max(0, quoteDepth - closingQuotes.length);
        result.push(current.trimEnd());
        current = '';
        if (followedBySpace) i = j;
      }
    }
  }

  if (current.trim()) result.push(current.trimEnd());
  return result;
}

export function classifyIntent({ anchor, sentenceContainingAnchor, previousSentence, isFirstOccurrenceInShot }) {
  const sentence = sentenceContainingAnchor ?? '';

  if (DATA_RE.test(sentence)) return 'data';

  const stripped = sentence.replace(/^[\s"']+/, '');
  if (CONTRAST_STARTERS_RE.test(stripped) && quoteRatio(sentence) <= 0.5) return 'contrast';

  if (STAKES_RE.test(sentence)) return 'stakes';

  if (isFirstOccurrenceInShot === true) return 'reveal';

  return 'hold';
}
