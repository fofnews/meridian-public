const UNITS = '(?:percent|%|billion|million|thousand|trillion|dollars?|deaths?|killed|injured)';
const SMALL_WRITTEN = '(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)';
const LARGE_WRITTEN = '(?:thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|trillion)';

const DATA_RE = new RegExp(
  `\\b(?:` +
    `\\d[\\d,.]*(?:\\s+${UNITS})?` +
    `|${SMALL_WRITTEN}\\s+${UNITS}` +
    `|${LARGE_WRITTEN}(?:\\s+${UNITS})?` +
    `|${UNITS}\\s+(?:${SMALL_WRITTEN}|${LARGE_WRITTEN})` +
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
        result.push(current.trim());
        current = '';
        if (followedBySpace) i = j;
      }
    }
  }

  if (current.trim()) result.push(current.trimEnd());
  return result;
}

const UNIT_RE = /\b(percent|%|billion|million|thousand|trillion|dollars?|deaths?|dead|fatalities|casualties|killed|injured|wounded)\b/i;

export function classifyShotIntent(narration) {
  const sentences = splitIntoSentences(narration);
  const counts = { data: 0, stakes: 0, contrast: 0 };

  for (const s of sentences) {
    const raw = classifyIntent({ sentenceContainingAnchor: s, isFirstOccurrenceInShot: false });
    if (raw === 'data') {
      // Only count as data if the sentence also contains a unit word.
      // Prevents standalone written numbers (ages, years) from triggering
      // data intent — e.g. "at the age of seventy-one" or "in nineteen eighty".
      if (UNIT_RE.test(s)) counts.data++;
    } else if (raw === 'stakes' || raw === 'contrast') {
      counts[raw]++;
    }
  }

  // Most frequent by count; tiebreak order: data > stakes > contrast.
  let best = null;
  let bestCount = 0;
  for (const intent of ['data', 'stakes', 'contrast']) {
    if (counts[intent] > bestCount) {
      best = intent;
      bestCount = counts[intent];
    }
  }
  return best; // null = no signal detected; caller decides the fallback
}

export function classifyIntent({ _anchor, sentenceContainingAnchor, _previousSentence, isFirstOccurrenceInShot }) {
  const sentence = sentenceContainingAnchor ?? '';

  if (DATA_RE.test(sentence)) return 'data';

  const stripped = sentence.replace(/^[\s"']+/, '');
  if (CONTRAST_STARTERS_RE.test(stripped) && quoteRatio(sentence) <= 0.5) return 'contrast';

  if (STAKES_RE.test(sentence)) return 'stakes';

  if (isFirstOccurrenceInShot === true) return 'reveal';

  return 'hold';
}
