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

const SPLIT_PREFIXES = new Set(['ال', 'وال', 'بال', 'فال', 'كال', 'لل']);
const ARABIC_WORD_2PLUS_REGEX = /^[\u0621-\u064A\u0671]{2,}$/u;

/**
 * Repairs accidental whitespace inserted immediately after an attached Arabic
 * prefix (e.g. "ال صلاة" -> "الصلاة", "بال نيات" -> "بالنيات"), while never
 * merging "آل" (family of) or prefixing onto words already starting with "ال".
 */
export function repairSplitArabicWords(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  const tokens = trimmed.split(/\s+/);
  const repaired: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const curr = tokens[i];
    const currBare = stripDiacritics(curr);
    const next = i + 1 < tokens.length ? tokens[i + 1] : '';
    const nextBare = next ? stripDiacritics(next) : '';
    const nextNormStart = nextBare ? normalizeArabicChar(nextBare[0]) + nextBare.slice(1) : '';

    if (
      SPLIT_PREFIXES.has(currBare) &&
      ARABIC_WORD_2PLUS_REGEX.test(nextBare) &&
      !nextNormStart.startsWith('ال')
    ) {
      repaired.push(`${curr}${next}`);
      i += 1;
    } else {
      repaired.push(curr);
    }
  }

  return repaired.join(' ');
}

const PHRASE_ORTHOGRAPHY_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/(?<![\p{L}\p{N}])[إا]نشاء\s+الله(?![\p{L}\p{N}])/gu, 'إن شاء الله'],
  [/(?<![\p{L}\p{N}])ماشاء\s+الله(?![\p{L}\p{N}])/gu, 'ما شاء الله'],
  [
    /(?<![\p{L}\p{N}])(?:لااله\s*[إا]لا\s*الله|لا\s*[إا]له\s*[إا]لاالله|لااله\s*[إا]لاالله)(?![\p{L}\p{N}])/gu,
    'لا إله إلا الله',
  ],
  [/(?<![\p{L}\p{N}])صل[ىي]الله(?![\p{L}\p{N}])/gu, 'صلى الله'],
  [/(?<![\p{L}\p{N}])رسولالله(?![\p{L}\p{N}])/gu, 'رسول الله'],
  [/(?<![\p{L}\p{N}])عبدالله(?![\p{L}\p{N}])/gu, 'عبد الله'],
  [/(?<![\p{L}\p{N}])سبحانالله(?![\p{L}\p{N}])/gu, 'سبحان الله'],
  [/(?<![\p{L}\p{N}])الحمدلله(?![\p{L}\p{N}])/gu, 'الحمد لله'],
  [/(?<![\p{L}\p{N}])[أا]ستغفرالله(?![\p{L}\p{N}])/gu, 'أستغفر الله'],
  [/(?<![\p{L}\p{N}])باركالله(?![\p{L}\p{N}])/gu, 'بارك الله'],
  [/(?<![\p{L}\p{N}])جزاكالله(?![\p{L}\p{N}])/gu, 'جزاك الله'],
  [/(?<![\p{L}\p{N}])[إا]نماالأعمال(?![\p{L}\p{N}])/gu, 'إنما الأعمال'],
  [/(?<![\p{L}\p{N}])انماالاعمال(?![\p{L}\p{N}])/gu, 'إنما الأعمال'],
  [/(?<![\p{L}\p{N}])فليسمنا(?![\p{L}\p{N}])/gu, 'فليس منا'],
  [/(?<![\p{L}\p{N}])منغشنا(?![\p{L}\p{N}])/gu, 'من غشنا'],
  [/(?<![\p{L}\p{N}])لاي[ؤو]من(?![\p{L}\p{N}])/gu, 'لا يؤمن'],
  [/(?<![\p{L}\p{N}])لايدخل(?![\p{L}\p{N}])/gu, 'لا يدخل'],
];

const SINGLE_ORTHOGRAPHY_MAP: Readonly<Record<string, string>> = {
  لاكن: 'لكن',
  ولاكن: 'ولكن',
  هاذا: 'هذا',
  هاذه: 'هذه',
  هاؤلاء: 'هؤلاء',
  هاولاء: 'هؤلاء',
  ذالك: 'ذلك',
  كذالك: 'كذلك',
  الرحمان: 'الرحمن',
  داوود: 'داود',
  اللة: 'الله',
  واللة: 'والله',
  باللة: 'بالله',
  شئ: 'شيء',
  مسؤل: 'مسؤول',
};

/**
 * Applies deterministic, zero-ambiguity Arabic orthographic fixes for common
 * fused devotional phrases and classic spelling slips (e.g. لاكن -> لكن).
 */
export function normalizeCommonOrthography(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  let out = trimmed;
  for (const [pattern, replacement] of PHRASE_ORTHOGRAPHY_RULES) {
    out = out.replace(pattern, replacement);
  }

  return out
    .split(/\s+/)
    .map((tok) => {
      const bare = stripDiacritics(tok);
      return SINGLE_ORTHOGRAPHY_MAP[bare] ?? tok;
    })
    .join(' ');
}

const EN_TO_AR_QWERTY: Readonly<Record<string, string>> = {
  q: 'ض',
  w: 'ص',
  e: 'ث',
  r: 'ق',
  t: 'ف',
  y: 'غ',
  u: 'ع',
  i: 'ه',
  o: 'خ',
  p: 'ح',
  '[': 'ج',
  ']': 'د',
  a: 'ش',
  s: 'س',
  d: 'ي',
  f: 'ب',
  g: 'ل',
  h: 'ا',
  j: 'ت',
  k: 'ن',
  l: 'م',
  ';': 'ك',
  "'": 'ط',
  z: 'ئ',
  x: 'ء',
  c: 'ؤ',
  v: 'ر',
  b: 'لا',
  n: 'ى',
  m: 'ة',
  ',': 'و',
  '.': 'ز',
  '/': 'ظ',
  '`': 'ذ',
};

const ENGLISH_GUARD_WORDS = new Set([
  'hadith', 'prayer', 'fasting', 'islam', 'allah', 'prophet', 'mercy', 'charity',
  'quran', 'sunnah', 'sahih', 'hasan', 'weak', 'hell', 'paradise', 'heaven',
  'faith', 'patience', 'mother', 'father', 'god', 'peace', 'love', 'truth',
  'death', 'life', 'good', 'evil', 'help', 'search', 'the', 'and', 'for',
  'about', 'what', 'how', 'who', 'why', 'niyyah', 'sabr', 'dua', 'dhikr',
  'zakat', 'hajj', 'ramadan', 'wudu', 'jannah', 'jahannam',
]);

/**
 * Converts a query accidentally typed on an English QWERTY keyboard into its
 * corresponding Arabic-101 layout string (e.g. "Hgwghm" -> "الصلاة"), returning
 * null for URLs, mixed Arabic text, or recognized English words.
 */
export function convertEnKeyboardToArabic(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/[a-zA-Z]/.test(trimmed)) return null;
  if (/[\u0600-\u06FF]/.test(trimmed)) return null;
  if (/https?:\/\//i.test(trimmed)) return null;

  const lower = trimmed.toLowerCase();
  const latinWords = lower.match(/[a-z]+/g) ?? [];
  for (const w of latinWords) {
    if (ENGLISH_GUARD_WORDS.has(w)) return null;
  }

  let mapped = '';
  for (const ch of lower) {
    if (ch in EN_TO_AR_QWERTY) {
      mapped += EN_TO_AR_QWERTY[ch];
    } else if (/\s/.test(ch)) {
      mapped += ' ';
    } else if (/[0-9]/.test(ch)) {
      mapped += ch;
    } else {
      return null;
    }
  }

  const collapsed = mapped.replace(/\s+/g, ' ').trim();
  return collapsed || null;
}

export const ARABIC_STOP_WORDS: ReadonlySet<string> = new Set([
  'في', 'من', 'علي', 'الي', 'عن', 'ما', 'لا', 'ان', 'هذا', 'هذه', 'التي', 'الذي',
  'الذين', 'هو', 'هي', 'هم', 'كان', 'كانت', 'يكون', 'او', 'ثم', 'بل', 'قد', 'لم',
  'لن', 'هل', 'كيف', 'اين', 'متي', 'كم', 'مع', 'عند', 'بين', 'حتي', 'الا', 'غير',
  'كل', 'بعض', 'اي', 'لو', 'اذا', 'اذ', 'انه', 'انها', 'فيها', 'فيه', 'منه', 'منها',
  'عليه', 'عليها', 'له', 'لها', 'بها', 'به', 'ذلك', 'تلك', 'هولاء', 'كذلك', 'ايضا',
  'فمن', 'ومن', 'لمن', 'بمن', 'عمن', 'ممن', 'فهو', 'وهو', 'فهي', 'وهي', 'فهم', 'وهم',
  'فقد', 'وقد', 'فلم', 'ولم', 'فلن', 'ولن', 'فلو', 'ولو', 'فاذا', 'واذا', 'فعلي', 'وعلي',
  'فالي', 'والي', 'ففي', 'وفي', 'فعن', 'وعن', 'فكان', 'وكان', 'فكانت', 'وكانت',
  'لان', 'بان',
]);

export const ARABIC_QUERY_FILLERS: ReadonlySet<string> = new Set([
  'حديث', 'احاديث', 'الحديث', 'الاحاديث', 'صحيح', 'ضعيف', 'حكم', 'فضل', 'فوايد',
  'قصه', 'ذكر', 'ورد', 'جاء', 'روي', 'قال', 'يقول', 'النبي', 'الرسول', 'رسول',
  'صلي', 'وسلم', 'عنه', 'رضي', 'اريد', 'ابحث', 'حول', 'بشان', 'بخصوص', 'معني',
  'تفسير', 'شرح', 'ماهو', 'ماهي', 'هل', 'عن',
]);

/**
 * Removes conversational search wrappers and stopwords from natural-language
 * Arabic queries when at least one meaningful content word survives.
 */
export function stripQueryFillers(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) return '';

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const kept = tokens.filter((tok) => {
    const norm = normalizeArabic(tok);
    return (
      norm.length >= 2 &&
      !ARABIC_STOP_WORDS.has(norm) &&
      !ARABIC_QUERY_FILLERS.has(norm)
    );
  });

  return kept.length > 0 ? kept.join(' ') : trimmed;
}

/**
 * Extracts normalized content tokens (length >= 2) while filtering stopwords and
 * conversational wrappers, falling back to all normalized tokens if none survive.
 */
export function extractContentTokens(query: string): string[] {
  const allTokens = normalizeArabic(query)
    .split(/\s+/)
    .filter((tok) => tok.length >= 2);
  if (allTokens.length === 0) return [];

  const content = allTokens.filter(
    (tok) => !ARABIC_STOP_WORDS.has(tok) && !ARABIC_QUERY_FILLERS.has(tok),
  );
  return content.length > 0 ? content : allTokens;
}

const PHONETIC_SKELETON_CHAR_MAP: Readonly<Record<string, string>> = {
  ظ: 'ض',
  ذ: 'ز',
  ص: 'س',
  ث: 'س',
  ط: 'ت',
  ه: 'ت',
  ق: 'ك',
  خ: 'ح',
  غ: 'ع',
};

const MEDIAL_VOWELS = new Set(['ا', 'و', 'ي']);

/**
 * Produces a phonetic skeleton for an already-normalized Arabic word by collapsing
 * sound-alike consonants, consecutive duplicates, and medial long vowels.
 */
export function arabicPhoneticSkeleton(normWord: string): string {
  if (!normWord) return '';

  let mapped = '';
  for (const ch of normWord) {
    mapped += PHONETIC_SKELETON_CHAR_MAP[ch] ?? ch;
  }

  const collapsed = mapped.replace(/(.)\1+/gu, '$1');
  if (collapsed.length <= 2) return collapsed;

  let out = collapsed[0];
  for (let i = 1; i < collapsed.length - 1; i++) {
    const ch = collapsed[i];
    if (!MEDIAL_VOWELS.has(ch)) {
      out += ch;
    }
  }
  out += collapsed[collapsed.length - 1];

  return out.replace(/(.)\1+/gu, '$1');
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
