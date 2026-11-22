const DIACRITICS_REGEX = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
const DIACRITIC_SINGLE_REGEX = /^[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]$/;

const LEGITIMATE_DOUBLE_ENDINGS = new Set([
  'الله',
  'سبب',
  'عدد',
  'مدد',
  'سدد',
  'جدد',
  'شدد',
  'ضرر',
  'سرر',
  'غرر',
  'مرر',
  'حرر',
  'قرر',
  'شرد',
  'سنن',
  'أمم',
  'امم',
  'قصص',
  'حصص',
  'غصص',
  'ملل',
  'حلل',
  'خلل',
  'زلل',
  'علل',
  'ذلل',
  'ألل',
  'الليل',
  'حقق',
  'اسس',
  'أسس',
  'تتم',
  'مما',
  'عما',
]);

export interface HighlightSegment {
  text: string;
  match: boolean;
}

export function stripDiacritics(input: string): string {
  return input.replace(DIACRITICS_REGEX, '');
}

const STANDALONE_CONJUNCTIONS = new Set(['و', 'ف']);

/**
 * Strips stray standalone single-letter Arabic conjunctions ("و", "ف") from
 * multi-word queries (e.g. "و امامز" -> "امامز", "الصلاة و الزكاة" -> "الصلاة الزكاة").
 * Al-Dorar's texts frequently separate "و" with spaces, so a lone "و" matches
 * thousands of unrelated hadiths and blocks typo recovery.
 */
export function stripStandaloneConjunctions(input: string): string {
  const trimmed = input.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 2) return trimmed;
  const kept = words.filter((word) => !STANDALONE_CONJUNCTIONS.has(stripDiacritics(word)));
  return kept.length > 0 ? kept.join(' ') : trimmed;
}

export function normalizeArabicChar(ch: string): string {
  switch (ch) {
    case 'أ':
    case 'إ':
    case 'آ':
    case 'ٱ':
      return 'ا';
    case 'ى':
      return 'ي';
    case 'ة':
      return 'ه';
    case 'ؤ':
      return 'و';
    case 'ئ':
      return 'ي';
    default:
      return ch;
  }
}

export function normalizeArabic(input: string): string {
  const stripped = stripDiacritics(input);
  let out = '';
  for (const ch of stripped) {
    out += normalizeArabicChar(ch);
  }
  return out
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function collapseRepeatedChars(input: string): string {
  return input
    .split(/(\s+)/)
    .map((part) => {
      if (!part.trim()) return part;
      const stripped = stripDiacritics(part);
      // Always collapse 3+ identical consecutive letters (never valid in Arabic)
      let collapsed = stripped.replace(/(.)\1{2,}/gu, '$1');

      // Collapse accidental trailing doubled letter (e.g. النارر -> النار)
      // unless it's a legitimate Arabic doubled-ending word (like سبب، عدد، سنن، الله)
      if (
        collapsed.length >= 4 &&
        collapsed[collapsed.length - 1] === collapsed[collapsed.length - 2] &&
        !LEGITIMATE_DOUBLE_ENDINGS.has(collapsed) &&
        !LEGITIMATE_DOUBLE_ENDINGS.has(collapsed.replace(/^ال/, ''))
      ) {
        collapsed = collapsed.slice(0, -1);
      }

      // Collapse doubled medial vowel slips (e.g., الصلااة -> الصلاة)
      collapsed = collapsed.replace(/([ا])\1+/gu, '$1');

      return collapsed;
    })
    .join('');
}

const VALID_HIGHLIGHT_PREFIXES = new Set([
  '',
  'ال',
  'وال',
  'بال',
  'فال',
  'كال',
  'لل',
  'ولل',
  'فلل',
  'و',
  'ف',
  'ب',
  'ل',
  'ك',
]);

const WORD_CHAR_REGEX = /[\p{L}\p{N}]/u;

function buildInflectionVariants(token: string): string[] {
  const variants = new Set<string>();
  const addSuffixSwaps = (word: string) => {
    if (word.length < 3) return;
    if (word.endsWith('ه')) {
      const stem = word.slice(0, -1);
      if (stem.length >= 2) {
        variants.add(`${stem}ات`);
        variants.add(`${stem}تين`);
        variants.add(`${stem}تان`);
        variants.add(`${stem}ته`);
        variants.add(`${stem}تها`);
        variants.add(`${stem}تهم`);
        variants.add(`${stem}تي`);
        variants.add(`${stem}تك`);
        variants.add(`${stem}تنا`);
      }
    } else if (word.endsWith('ات') && word.length >= 4) {
      variants.add(`${word.slice(0, -2)}ه`);
    } else if (word.endsWith('ون') && word.length >= 4) {
      variants.add(`${word.slice(0, -2)}ين`);
    } else if (word.endsWith('ين') && word.length >= 4) {
      variants.add(`${word.slice(0, -2)}ون`);
    } else if (word.endsWith('ان') && word.length >= 4) {
      variants.add(`${word.slice(0, -2)}ين`);
    }
  };

  addSuffixSwaps(token);
  if (token.startsWith('ال') && token.length >= 5) {
    const bare = token.slice(2);
    variants.add(bare);
    addSuffixSwaps(bare);
  }
  variants.delete(token);
  return Array.from(variants);
}

/**
 * Splits `text` into plain/highlighted runs matching any whitespace-separated
 * token in `query`, ignoring Arabic tashkeel/diacritics and hamza/ya/ta-marbuta
 * differences while preserving the exact original text & diacritics intact.
 * Falls back to light Arabic inflection variants (e.g. النية -> النيات,
 * المؤمنون -> المؤمنين) when an exact token match is absent.
 */
export function findArabicHighlightSegments(
  text: string,
  query: string,
): HighlightSegment[] {
  const tokens = normalizeArabic(query)
    .split(/\s+/)
    .filter((t) => t.length >= 2);

  if (!text || tokens.length === 0) {
    return [{ text, match: false }];
  }

  // Build normalized base-char string with map to original indices [start, end)
  const chars = Array.from(text);
  const normChars: string[] = [];
  const baseStartIdx: number[] = [];
  const baseEndIdx: number[] = [];

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (DIACRITIC_SINGLE_REGEX.test(ch)) {
      // Attach trailing diacritic to the previous base letter's span
      if (baseEndIdx.length > 0) {
        baseEndIdx[baseEndIdx.length - 1] = i + 1;
      }
      continue;
    }
    normChars.push(normalizeArabicChar(ch));
    baseStartIdx.push(i);
    baseEndIdx.push(i + 1);
  }

  const normText = normChars.join('');
  const highlightMask = new Array<boolean>(chars.length).fill(false);

  const markOccurrences = (needle: string): boolean => {
    let matched = false;
    let from = 0;
    while (from < normText.length) {
      const found = normText.indexOf(needle, from);
      if (found === -1) break;
      const endPos = found + needle.length;

      // Require end-of-word boundary so we never split an Arabic word mid-word (e.g. مرت|ين)
      const endsCleanly = endPos === normText.length || !WORD_CHAR_REGEX.test(normText[endPos]);

      // Require start-of-word boundary or a valid attached Arabic prefix (ال، بال، وال، و، ف، ب، ل، ك)
      let wordStart = found;
      while (wordStart > 0 && WORD_CHAR_REGEX.test(normText[wordStart - 1])) {
        wordStart--;
      }
      const prefix = normText.slice(wordStart, found);
      // 2-letter prepositions (e.g. لي، في، من) must match as standalone words only
      // so "لي" never highlights inside "وليٌّ"; 3+ letter stems allow attached prefixes.
      const startsCleanly =
        needle.length < 3 ? prefix === '' : VALID_HIGHLIGHT_PREFIXES.has(prefix);

      if (startsCleanly && endsCleanly) {
        matched = true;
        const origStart = baseStartIdx[found];
        const origEnd = baseEndIdx[endPos - 1];
        for (let k = origStart; k < origEnd; k++) {
          highlightMask[k] = true;
        }
      }

      from = found + 1;
    }
    return matched;
  };

  for (const token of tokens) {
    const exactHit = markOccurrences(token);
    if (!exactHit) {
      for (const variant of buildInflectionVariants(token)) {
        if (markOccurrences(variant)) break;
      }
    }
  }

  const segments: HighlightSegment[] = [];
  let runStart = 0;
  let currentMatch = highlightMask[0] ?? false;

  for (let i = 1; i < chars.length; i++) {
    if (highlightMask[i] !== currentMatch) {
      segments.push({
        text: chars.slice(runStart, i).join(''),
        match: currentMatch,
      });
      runStart = i;
      currentMatch = highlightMask[i];
    }
  }
  segments.push({
    text: chars.slice(runStart).join(''),
    match: currentMatch,
  });

  return segments;
}
