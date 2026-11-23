import {
  ARABIC_QUERY_FILLERS,
  ARABIC_STOP_WORDS,
  arabicPhoneticSkeleton,
  collapseRepeatedChars,
  convertEnKeyboardToArabic,
  normalizeArabic,
  normalizeCommonOrthography,
  repairSplitArabicWords,
  stripDiacritics,
  stripStandaloneConjunctions,
} from './arabicNormalize';
import {
  ARABIC_COMMON_PARTICLES,
  ARABIC_HADITH_CONCEPTS,
  ARABIC_HADITH_VOCAB,
} from './arabicVocab';

export interface TypoSuggestionResult {
  correctedQuery: string;
  changed: boolean;
  alternatives: string[];
}

export interface ProactiveQueryResult {
  query: string;
  changed: boolean;
}

export interface ArabicAffixParts {
  prefix: string;
  stem: string;
  suffix: string;
  morphAltNorm?: string;
}

interface VocabEntry {
  display: string;
  norm: string;
  rank: number;
}

interface VocabIndex {
  entries: VocabEntry[];
  exactMap: Map<string, string>;
  byLength: Map<number, VocabEntry[]>;
  bySkeleton: Map<string, VocabEntry[]>;
}

const LONG_PREFIXES = ['وال', 'بال', 'فال', 'كال', 'ولل', 'فلل', 'لل', 'ال'] as const;
const SHORT_PREFIXES = ['و', 'ف', 'ب', 'ل', 'ك'] as const;

const SUFFIXES = [
  'كما', 'هما', 'تين', 'تان',
  'ون', 'ين', 'ات', 'ان', 'هم', 'كم', 'هن', 'كن', 'نا', 'ها', 'تم', 'وا',
  'ه', 'ك', 'ي',
] as const;

const POSSESSIVE_OR_DUAL_SUFFIXES = new Set([
  'كما', 'هما', 'تين', 'تان', 'هم', 'كم', 'هن', 'كن', 'نا', 'ها', 'ه', 'ك', 'ي',
]);

const LONG_VOWELS = new Set(['ا', 'و', 'ي']);

const PHONETIC_CONFUSION_PAIRS = new Set([
  'ض|ظ', 'ذ|ز', 'ذ|ظ', 'ز|ظ',
  'س|ص', 'س|ث', 'ص|ث',
  'ت|ط', 'ت|ه',
  'د|ض', 'د|ذ', 'د|ط',
  'ق|ك',
  'ح|ه', 'ح|خ',
  'ع|غ',
]);

// Normalized Arabic-101 3-row mobile/desktop keyboard coordinates
const AR_KEY_COORDS: Readonly<Record<string, readonly [number, number]>> = {
  // Row 0
  ض: [0, 0], ص: [0, 1], ث: [0, 2], ق: [0, 3], ف: [0, 4], غ: [0, 5],
  ع: [0, 6], ه: [0, 7], خ: [0, 8], ح: [0, 9], ج: [0, 10], د: [0, 11],
  // Row 1
  ش: [1, 0], س: [1, 1], ي: [1, 2], ب: [1, 3], ل: [1, 4], ا: [1, 5],
  ت: [1, 6], ن: [1, 7], م: [1, 8], ك: [1, 9], ط: [1, 10],
  // Row 2 (normalized forms share bottom keys; ة/و/ز/ظ follow standard layout)
  ء: [2, 1], و: [2, 7], ر: [2, 3], ز: [2, 8], ظ: [2, 9], ذ: [0, 0],
};

let cachedIndex: VocabIndex | null = null;

function getIndex(): VocabIndex {
  if (cachedIndex) return cachedIndex;

  const entries: VocabEntry[] = [];
  const exactMap = new Map<string, string>();
  const byLength = new Map<number, VocabEntry[]>();
  const bySkeleton = new Map<string, VocabEntry[]>();

  for (let i = 0; i < ARABIC_HADITH_VOCAB.length; i++) {
    const word = ARABIC_HADITH_VOCAB[i];
    const norm = normalizeArabic(word);
    if (!norm) continue;

    if (!exactMap.has(norm)) {
      exactMap.set(norm, word);
    }

    // Keep fuzzy lookup strictly to 3+ char words so 1-2 letter roots never hijack words
    if (norm.length < 3) continue;

    const entry: VocabEntry = { display: word, norm, rank: i };
    entries.push(entry);

    let lenList = byLength.get(norm.length);
    if (!lenList) {
      lenList = [];
      byLength.set(norm.length, lenList);
    }
    lenList.push(entry);

    const skel = arabicPhoneticSkeleton(norm);
    if (skel) {
      let skelList = bySkeleton.get(skel);
      if (!skelList) {
        skelList = [];
        bySkeleton.set(skel, skelList);
      }
      skelList.push(entry);
    }
  }

  for (const particle of ARABIC_COMMON_PARTICLES) {
    const norm = normalizeArabic(particle);
    if (norm && !exactMap.has(norm)) {
      exactMap.set(norm, particle);
    }
  }

  for (const word of ARABIC_QUERY_FILLERS) {
    if (word && !exactMap.has(word)) {
      exactMap.set(word, word);
    }
  }

  for (const word of ARABIC_STOP_WORDS) {
    if (word && !exactMap.has(word)) {
      exactMap.set(word, word);
    }
  }

  // Register single-word concept triggers as exact-only terms so modern concepts
  // (e.g. الاكتئاب) flow cleanly to Stage 4 instead of being fuzzy-mangled in Stage 1
  for (const entry of ARABIC_HADITH_CONCEPTS) {
    for (const trig of entry.triggers) {
      if (trig.includes(' ')) continue;
      const norm = normalizeArabic(trig);
      if (!norm) continue;
      if (!exactMap.has(norm)) exactMap.set(norm, trig);
      if (norm.startsWith('ال') && norm.length >= 4) {
        const bare = norm.slice(2);
        if (!exactMap.has(bare)) exactMap.set(bare, trig.slice(2));
      }
    }
  }

  cachedIndex = { entries, exactMap, byLength, bySkeleton };
  return cachedIndex;
}

function substitutionCost(a: string, b: string): number {
  if (a === b) return 0;

  const pair = a < b ? `${a}|${b}` : `${b}|${a}`;
  if (PHONETIC_CONFUSION_PAIRS.has(pair)) {
    return 0.35;
  }

  const posA = AR_KEY_COORDS[a];
  const posB = AR_KEY_COORDS[b];
  if (
    posA &&
    posB &&
    Math.abs(posA[0] - posB[0]) <= 1 &&
    Math.abs(posA[1] - posB[1]) <= 1
  ) {
    return 0.55;
  }

  return 1.0;
}

function indelCost(str: string, oneBasedIdx: number): number {
  const ch = str[oneBasedIdx - 1];
  if (oneBasedIdx > 1 && str[oneBasedIdx - 2] === ch) {
    return 0.4;
  }
  // Long vowels and omitted 'ل' in the common 'لا' ligature (e.g. الصاة -> الصلاة)
  if (LONG_VOWELS.has(ch) || (ch === 'ل' && oneBasedIdx < str.length && str[oneBasedIdx] === 'ا')) {
    return 0.45;
  }
  return 0.95;
}

/**
 * Arabic-aware Optimal String Alignment distance over normalized strings,
 * weighting phonetic confusions, adjacent mobile keys, vowel slips,
 * doubled letters, and adjacent transpositions below random edits.
 */
export function weightedArabicDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) {
    let cost = 0;
    for (let j = 1; j <= n; j++) cost += indelCost(b, j);
    return cost;
  }
  if (n === 0) {
    let cost = 0;
    for (let i = 1; i <= m; i++) cost += indelCost(a, i);
    return cost;
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  );

  for (let i = 1; i <= m; i++) dp[i][0] = dp[i - 1][0] + indelCost(a, i);
  for (let j = 1; j <= n; j++) dp[0][j] = dp[0][j - 1] + indelCost(b, j);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      let best = Math.min(
        dp[i - 1][j] + indelCost(a, i),
        dp[i][j - 1] + indelCost(b, j),
        dp[i - 1][j - 1] + substitutionCost(a[i - 1], b[j - 1]),
      );

      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, dp[i - 2][j - 2] + 0.55);
      }

      dp[i][j] = best;
    }
  }

  return Math.round(dp[m][n] * 1000) / 1000;
}

/**
 * Maximum allowed weighted edit distance for a candidate correction based on word length.
 */
export function maxWeightedCostForLength(len: number): number {
  if (len <= 2) return 0;
  if (len === 3) return 0.65;
  if (len === 4) return 1.05;
  if (len === 5) return 1.25;
  return 1.7;
}

export function splitArabicPrefix(
  rawWord: string,
  minLongStem = 2,
): { prefix: string; stem: string } {
  for (const prefix of LONG_PREFIXES) {
    if (rawWord.startsWith(prefix) && rawWord.length - prefix.length >= minLongStem) {
      return { prefix, stem: rawWord.slice(prefix.length) };
    }
  }
  const minShortStem = Math.max(3, minLongStem);
  for (const prefix of SHORT_PREFIXES) {
    if (rawWord.startsWith(prefix) && rawWord.length - prefix.length >= minShortStem) {
      return { prefix, stem: rawWord.slice(prefix.length) };
    }
  }
  return { prefix: '', stem: rawWord };
}

function splitArabicSuffix(rawStem: string): {
  stem: string;
  suffix: string;
  morphAltNorm?: string;
} {
  for (const suffix of SUFFIXES) {
    if (!rawStem.endsWith(suffix)) continue;
    const baseLen = rawStem.length - suffix.length;
    if (baseLen < 3) continue;

    // Never strip trailing 'ه' from words written with ta-marbuta 'ة',
    // nor trailing 'ي' from words written with alif-maqsura 'ى'.
    if (suffix === 'ه' && rawStem.endsWith('ة')) continue;
    if (suffix === 'ي' && rawStem.endsWith('ى')) continue;

    const base = rawStem.slice(0, baseLen);
    let morphAltNorm: string | undefined;
    if (base.endsWith('ت') && POSSESSIVE_OR_DUAL_SUFFIXES.has(suffix)) {
      morphAltNorm = `${normalizeArabic(base.slice(0, -1))}ه`;
    }

    return { stem: base, suffix, morphAltNorm };
  }

  return { stem: rawStem, suffix: '' };
}

/**
 * Strips attached Arabic prefixes and inflectional/possessive suffixes while
 * enforcing length and orthographic guards (ة vs ه, ى vs ي, ة->ت before suffix).
 */
export function stripArabicAffixes(rawWord: string): ArabicAffixParts {
  const cleaned = stripDiacritics(rawWord).trim();
  const { prefix, stem: afterPrefix } = splitArabicPrefix(cleaned, 3);
  const { stem, suffix, morphAltNorm } = splitArabicSuffix(afterPrefix);
  return { prefix, stem, suffix, morphAltNorm };
}

function reattachPrefix(prefix: string, word: string): string {
  if (!prefix) return word;
  // Avoid double ال when vocabulary word already starts with ال (e.g. الله)
  if (prefix.endsWith('ال') && word.startsWith('ال')) {
    return prefix.slice(0, -2) + word;
  }
  return prefix + word;
}

function reattachAffixes(prefix: string, word: string, suffix: string): string {
  const withPrefix = reattachPrefix(prefix, word);
  if (!suffix) return withPrefix;

  if (withPrefix.endsWith('ة')) {
    if (suffix === 'ات') {
      return `${withPrefix.slice(0, -1)}ات`;
    }
    if (POSSESSIVE_OR_DUAL_SUFFIXES.has(suffix)) {
      return `${withPrefix.slice(0, -1)}ت${suffix}`;
    }
  }

  return `${withPrefix}${suffix}`;
}

function lookupExactDisplay(rawWord: string, index: VocabIndex): string | null {
  const cleaned = stripDiacritics(rawWord).trim();
  if (!cleaned) return null;

  const normFull = normalizeArabic(cleaned);
  const direct = index.exactMap.get(normFull);
  if (direct) return direct;

  // Prefix-only (allows 2-letter stems like بالحق, والبر)
  const { prefix, stem: afterPrefix } = splitArabicPrefix(cleaned, 2);
  if (prefix) {
    const stemHit = index.exactMap.get(normalizeArabic(afterPrefix));
    if (stemHit) return reattachPrefix(prefix, stemHit);
  }

  // Suffix-only
  const rawSuffixSplit = splitArabicSuffix(cleaned);
  if (rawSuffixSplit.suffix) {
    const normBase = normalizeArabic(rawSuffixSplit.stem);
    const hit =
      index.exactMap.get(normBase) ??
      (rawSuffixSplit.morphAltNorm ? index.exactMap.get(rawSuffixSplit.morphAltNorm) : undefined);
    if (hit) return reattachAffixes('', hit, rawSuffixSplit.suffix);
  }

  // Prefix + Suffix
  if (prefix && afterPrefix.length >= 4) {
    const pSuffixSplit = splitArabicSuffix(afterPrefix);
    if (pSuffixSplit.suffix) {
      const normBase = normalizeArabic(pSuffixSplit.stem);
      const hit =
        index.exactMap.get(normBase) ??
        (pSuffixSplit.morphAltNorm ? index.exactMap.get(pSuffixSplit.morphAltNorm) : undefined);
      if (hit) return reattachAffixes(prefix, hit, pSuffixSplit.suffix);
    }
  }

  return null;
}

function isExactVocabHit(rawWord: string, index: VocabIndex): boolean {
  return lookupExactDisplay(rawWord, index) !== null;
}

function isVerifiedArabicKeyboardConversion(converted: string, index: VocabIndex): boolean {
  const tokens = converted.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;

  let verifiedCount = 0;
  for (const tok of tokens) {
    const norm = normalizeArabic(tok);
    if (norm.length < 2) return false;
    if (isExactVocabHit(tok, index)) {
      verifiedCount++;
      continue;
    }
    if (ARABIC_STOP_WORDS.has(norm) && tokens.length > 1) {
      continue;
    }
    return false;
  }

  return verifiedCount > 0;
}

function resolveSplitHalf(
  rawHalf: string,
  index: VocabIndex,
  allowStopword: boolean,
): string | null {
  const exact = lookupExactDisplay(rawHalf, index);
  if (exact) return exact;

  if (allowStopword) {
    const norm = normalizeArabic(rawHalf);
    if (ARABIC_STOP_WORDS.has(norm)) return rawHalf;
  }

  return null;
}

function trySplitMergedWord(cleaned: string, index: VocabIndex): string | null {
  if (cleaned.length < 6) return null;

  for (let i = 2; i <= cleaned.length - 2; i++) {
    const leftRaw = cleaned.slice(0, i);
    const rightRaw = cleaned.slice(i);

    const rightStartsAl = normalizeArabic(rightRaw).startsWith('ال');
    const allowStopLeft = leftRaw.length >= 2 && rightStartsAl && rightRaw.length >= 4;

    const leftResolved = resolveSplitHalf(leftRaw, index, allowStopLeft);
    if (!leftResolved) continue;

    const rightResolved = resolveSplitHalf(rightRaw, index, false);
    if (!rightResolved) continue;

    return `${leftResolved} ${rightResolved}`;
  }

  return null;
}

interface ScoredCandidate {
  display: string;
  dist: number;
  score: number;
}

function pushScoredCandidate(
  scored: ScoredCandidate[],
  seenBest: Map<string, number>,
  display: string,
  dist: number,
  score: number,
): void {
  const prev = seenBest.get(display);
  if (prev !== undefined && prev <= score) return;
  seenBest.set(display, score);
  scored.push({ display, dist, score });
}

function collectStemCandidates(
  searchNorm: string,
  activePrefix: string,
  activeSuffix: string,
  penalty: number,
  index: VocabIndex,
  scored: ScoredCandidate[],
  seenBest: Map<string, number>,
): void {
  const maxCost = maxWeightedCostForLength(searchNorm.length);
  if (maxCost <= 0) return;

  const totalEntries = Math.max(1, index.entries.length);
  const visited = new Set<number>();

  const evalEntry = (entry: VocabEntry) => {
    if (visited.has(entry.rank)) return;
    visited.add(entry.rank);

    if (Math.abs(entry.norm.length - searchNorm.length) > 2) return;

    const dist = weightedArabicDistance(searchNorm, entry.norm);
    if (dist > 0 && dist <= maxCost) {
      const display = reattachAffixes(activePrefix, entry.display, activeSuffix);
      const score = dist + penalty + (entry.rank / totalEntries) * 0.12;
      pushScoredCandidate(scored, seenBest, display, dist, score);
    }
  };

  const skel = arabicPhoneticSkeleton(searchNorm);
  const skelMatches = skel ? index.bySkeleton.get(skel) : undefined;
  if (skelMatches) {
    for (const entry of skelMatches) evalEntry(entry);
  }

  const minLen = Math.max(3, searchNorm.length - 2);
  const maxLen = searchNorm.length + 2;
  for (let len = minLen; len <= maxLen; len++) {
    const bucket = index.byLength.get(len);
    if (!bucket) continue;
    for (const entry of bucket) evalEntry(entry);
  }
}

function collectPrefixedAlCandidates(
  normFull: string,
  index: VocabIndex,
  scored: ScoredCandidate[],
  seenBest: Map<string, number>,
): void {
  const maxCost = maxWeightedCostForLength(normFull.length);
  if (maxCost <= 0) return;

  const totalEntries = Math.max(1, index.entries.length);
  const minStemLen = Math.max(3, normFull.length - 4);
  const maxStemLen = Math.max(3, normFull.length);

  for (let len = minStemLen; len <= maxStemLen; len++) {
    const bucket = index.byLength.get(len);
    if (!bucket) continue;

    for (const entry of bucket) {
      if (entry.norm.startsWith('ال')) continue;
      const withAl = reattachPrefix('ال', entry.display);
      const normWithAl = `ال${entry.norm}`;
      if (Math.abs(normWithAl.length - normFull.length) > 2) continue;

      const dist = weightedArabicDistance(normFull, normWithAl);
      if (dist > 0 && dist <= maxCost) {
        const score = dist + 0.08 + (entry.rank / totalEntries) * 0.12;
        pushScoredCandidate(scored, seenBest, withAl, dist, score);
      }
    }
  }
}

/**
 * Deterministic, zero-ambiguity query preparation executed before calling Dorar:
 * rescues verified wrong-keyboard Latin input, strips stray conjunctions,
 * repairs split "ال" prefixes, collapses repeated typo chars, and fixes classic
 * spelling slips without invoking fuzzy guessing.
 */
export function prepareProactiveQuery(rawQuery: string): ProactiveQueryResult {
  const trimmed = rawQuery.trim();
  if (!trimmed) return { query: '', changed: false };

  const index = getIndex();
  const stripped = stripDiacritics(trimmed).trim();

  // Guarded wrong-keyboard rescue (e.g. Hgwghm -> الصلاة), strictly gated
  const converted = convertEnKeyboardToArabic(stripped);
  if (converted && isVerifiedArabicKeyboardConversion(converted, index)) {
    return { query: converted, changed: true };
  }

  let current = stripStandaloneConjunctions(stripped);
  current = repairSplitArabicWords(current);
  // Apply fused-phrase orthography BEFORE collapsing repeated vowels so word-boundary
  // doubled alefs (e.g. انماالاعمال) split cleanly before medial-alef collapse runs
  current = normalizeCommonOrthography(current);
  current = collapseRepeatedChars(current);
  current = normalizeCommonOrthography(current);

  const changed = Boolean(current) && current !== stripped;
  return {
    query: changed ? current : trimmed,
    changed,
  };
}

function suggestSingleWord(
  rawWord: string,
  index: VocabIndex,
): { best: string; changed: boolean; candidates: string[] } {
  const cleaned = stripDiacritics(rawWord).trim();
  if (cleaned.length < 3) {
    return { best: cleaned, changed: false, candidates: [] };
  }

  // 1. Exact vocabulary / morphology hit (never rewrite valid Arabic words)
  if (isExactVocabHit(cleaned, index)) {
    return { best: cleaned, changed: false, candidates: [] };
  }

  // 2. Deterministic repeated-char collapse (check exact match after collapsing)
  const collapsed = collapseRepeatedChars(cleaned);
  const working = collapsed || cleaned;
  const wasCollapsed = working !== cleaned;

  if (wasCollapsed && isExactVocabHit(working, index)) {
    return { best: working, changed: true, candidates: [working] };
  }

  const normFull = normalizeArabic(working);
  const { prefix, stem: afterPrefix } = splitArabicPrefix(working, 3);
  const normAfterPrefix = normalizeArabic(afterPrefix);
  const activePrefix = prefix && normAfterPrefix.length >= 3 ? prefix : '';
  const searchNorm = activePrefix ? normAfterPrefix : normFull;

  // 3. Weighted phonetic/keyboard fuzzy search over index
  const scored: ScoredCandidate[] = [];
  const seenBest = new Map<string, number>();

  collectStemCandidates(searchNorm, activePrefix, '', 0, index, scored, seenBest);

  if (activePrefix === 'ال' || normFull.startsWith('ا')) {
    collectPrefixedAlCandidates(normFull, index, scored, seenBest);
  }

  // Check suffixed stem fuzzy recovery (e.g. صالتكم -> صلاتكم)
  const suffixParts = splitArabicSuffix(activePrefix ? afterPrefix : working);
  if (suffixParts.suffix && suffixParts.stem.length >= 3) {
    collectStemCandidates(
      normalizeArabic(suffixParts.stem),
      activePrefix,
      suffixParts.suffix,
      0.16,
      index,
      scored,
      seenBest,
    );
  }

  scored.sort((a, b) => (a.score !== b.score ? a.score - b.score : a.dist - b.dist));

  const bestDist = scored.length > 0 ? scored[0].dist : Infinity;

  // 4. Merged-word split when unknown 6+ char word has no tight single-word fix
  if (bestDist > 0.65) {
    const splitPair = trySplitMergedWord(working, index);
    if (splitPair) {
      const top = [splitPair];
      for (const item of scored) {
        if (item.display !== splitPair && top.length < 3) {
          top.push(item.display);
        }
      }
      return { best: splitPair, changed: true, candidates: top };
    }
  }

  if (scored.length === 0) {
    if (wasCollapsed) {
      return { best: working, changed: true, candidates: [working] };
    }
    return { best: cleaned, changed: false, candidates: [] };
  }

  // Deduplicate keeping best score order
  const uniqueTop: string[] = [];
  const seenDisplay = new Set<string>();
  for (const s of scored) {
    if (seenDisplay.has(s.display)) continue;
    seenDisplay.add(s.display);
    uniqueTop.push(s.display);
    if (uniqueTop.length >= 3) break;
  }

  return { best: uniqueTop[0], changed: true, candidates: uniqueTop };
}

/**
 * Generates deterministic proactive fixes plus weighted Arabic spell corrections
 * and ranked alternative queries.
 */
export function suggestArabicQuery(query: string): TypoSuggestionResult {
  const trimmed = query.trim();
  if (!trimmed) {
    return { correctedQuery: '', changed: false, alternatives: [] };
  }

  const index = getIndex();
  const proactive = prepareProactiveQuery(trimmed);
  const workingQuery = proactive.changed ? proactive.query : stripDiacritics(trimmed).trim();

  const words = workingQuery.split(/\s+/).filter(Boolean);
  const correctedWords: string[] = [];
  const perWordAlternatives: string[][] = [];
  let anyChanged = proactive.changed;

  for (const w of words) {
    const res = suggestSingleWord(w, index);
    correctedWords.push(res.best);
    perWordAlternatives.push(res.candidates);
    if (res.changed) {
      anyChanged = true;
    }
  }

  const correctedQuery = correctedWords.join(' ');
  const changed = anyChanged && correctedQuery !== trimmed;
  const alternatives: string[] = [];

  if (changed) {
    alternatives.push(correctedQuery);
    for (let i = 0; i < words.length; i++) {
      for (const candidate of perWordAlternatives[i]) {
        const assembled = [
          ...correctedWords.slice(0, i),
          candidate,
          ...correctedWords.slice(i + 1),
        ].join(' ');
        if (!alternatives.includes(assembled)) {
          alternatives.push(assembled);
        }
      }
    }
  }

  return {
    correctedQuery,
    changed,
    alternatives: alternatives.slice(0, 4),
  };
}
