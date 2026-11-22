import {
  collapseRepeatedChars,
  normalizeArabic,
  stripDiacritics,
  stripStandaloneConjunctions,
} from './arabicNormalize';
import { ARABIC_COMMON_PARTICLES, ARABIC_HADITH_VOCAB } from './arabicVocab';

export interface TypoSuggestionResult {
  correctedQuery: string;
  changed: boolean;
  alternatives: string[];
}

interface VocabEntry {
  display: string;
  norm: string;
}

const PREFIXES = ['وال', 'بال', 'فال', 'كال', 'لل', 'ال', 'و', 'ف', 'ب', 'ل', 'ك'] as const;

const VOCAB_ENTRIES: VocabEntry[] = ARABIC_HADITH_VOCAB.map((word) => ({
  display: word,
  norm: normalizeArabic(word),
}));

const EXACT_VOCAB_MAP = new Map<string, string>();
for (const entry of VOCAB_ENTRIES) {
  if (!EXACT_VOCAB_MAP.has(entry.norm)) {
    EXACT_VOCAB_MAP.set(entry.norm, entry.display);
  }
}
for (const particle of ARABIC_COMMON_PARTICLES) {
  const norm = normalizeArabic(particle);
  if (!EXACT_VOCAB_MAP.has(norm)) {
    EXACT_VOCAB_MAP.set(norm, particle);
  }
}

/**
 * Optimal String Alignment (Damerau-Levenshtein) distance supporting
 * insertion, deletion, substitution, and adjacent transposition.
 */
function damerauLevenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let val = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        val = Math.min(val, dp[i - 2][j - 2] + 1);
      }
      dp[i][j] = val;
    }
  }

  return dp[m][n];
}

function splitArabicPrefix(rawWord: string): { prefix: string; stem: string } {
  for (const prefix of PREFIXES) {
    if (rawWord.startsWith(prefix) && rawWord.length - prefix.length >= 2) {
      return { prefix, stem: rawWord.slice(prefix.length) };
    }
  }
  return { prefix: '', stem: rawWord };
}

function reattachPrefix(prefix: string, word: string): string {
  if (!prefix) return word;
  // Avoid double ال when vocabulary word already starts with ال (e.g. الله)
  if (prefix.endsWith('ال') && word.startsWith('ال')) {
    return prefix.slice(0, -2) + word;
  }
  return prefix + word;
}

function suggestSingleWord(rawWord: string): {
  best: string;
  changed: boolean;
  candidates: string[];
} {
  const cleaned = stripDiacritics(rawWord).trim();
  if (cleaned.length < 3) {
    return { best: cleaned, changed: false, candidates: [] };
  }

  const normFull = normalizeArabic(cleaned);

  // 1. Exact vocabulary hit (whole word or prefix-stripped stem)
  if (EXACT_VOCAB_MAP.has(normFull)) {
    return { best: cleaned, changed: false, candidates: [] };
  }

  const { prefix, stem } = splitArabicPrefix(cleaned);
  const normStem = normalizeArabic(stem);
  if (prefix && EXACT_VOCAB_MAP.has(normStem)) {
    return { best: cleaned, changed: false, candidates: [] };
  }

  // 2. Structural cleanup (accidental repeated characters like النارر -> النار)
  const collapsed = collapseRepeatedChars(cleaned);
  if (collapsed !== cleaned) {
    const collapsedNorm = normalizeArabic(collapsed);
    const { prefix: cPrefix, stem: cStem } = splitArabicPrefix(collapsed);
    const cStemNorm = normalizeArabic(cStem);
    if (EXACT_VOCAB_MAP.has(collapsedNorm)) {
      const display = EXACT_VOCAB_MAP.get(collapsedNorm)!;
      return { best: display, changed: true, candidates: [display] };
    }
    if (cPrefix && EXACT_VOCAB_MAP.has(cStemNorm)) {
      const display = reattachPrefix(cPrefix, EXACT_VOCAB_MAP.get(cStemNorm)!);
      return { best: display, changed: true, candidates: [display] };
    }
    // Even if the word isn't in our compact vocab, collapsing obvious typos like النارر helps
    return { best: collapsed, changed: true, candidates: [collapsed] };
  }

  // 3. Fuzzy Damerau-Levenshtein matching against vocabulary (preferring stem match with preserved prefix)
  const searchNorm = prefix && normStem.length >= 3 ? normStem : normFull;
  const activePrefix = prefix && normStem.length >= 3 ? prefix : '';
  const maxDist = searchNorm.length >= 6 ? 2 : 1;

  const scored: Array<{ display: string; dist: number; rank: number }> = [];
  const seen = new Set<string>();

  for (let idx = 0; idx < VOCAB_ENTRIES.length; idx++) {
    const entry = VOCAB_ENTRIES[idx];
    const lengthDiff = Math.abs(entry.norm.length - searchNorm.length);
    if (lengthDiff > maxDist) continue;

    const dist = damerauLevenshtein(searchNorm, entry.norm);
    if (dist > 0 && dist <= maxDist) {
      const display = reattachPrefix(activePrefix, entry.display);
      if (!seen.has(display)) {
        seen.add(display);
        scored.push({ display, dist, rank: idx });
      }
    }
  }

  // Also check full-word match in case the typo was inside the prefix itself (e.g., انلار)
  if (activePrefix) {
    for (let idx = 0; idx < VOCAB_ENTRIES.length; idx++) {
      const entry = VOCAB_ENTRIES[idx];
      const withAl = reattachPrefix('ال', entry.display);
      const normWithAl = normalizeArabic(withAl);
      const lengthDiff = Math.abs(normWithAl.length - normFull.length);
      if (lengthDiff > maxDist) continue;

      const dist = damerauLevenshtein(normFull, normWithAl);
      if (dist > 0 && dist <= maxDist && !seen.has(withAl)) {
        seen.add(withAl);
        scored.push({ display: withAl, dist, rank: idx + VOCAB_ENTRIES.length });
      }
    }
  }

  scored.sort((a, b) => {
    if (a.dist !== b.dist) return a.dist - b.dist;
    return a.rank - b.rank;
  });

  if (scored.length === 0) {
    return { best: cleaned, changed: false, candidates: [] };
  }

  const top = scored.slice(0, 3).map((s) => s.display);
  return { best: top[0], changed: true, candidates: top };
}

export function suggestArabicQuery(query: string): TypoSuggestionResult {
  const trimmed = query.trim();
  if (!trimmed) {
    return { correctedQuery: '', changed: false, alternatives: [] };
  }

  const cleanedQuery = stripStandaloneConjunctions(trimmed);
  const strippedConjunction = cleanedQuery !== trimmed;

  const words = cleanedQuery.split(/\s+/);
  const correctedWords: string[] = [];
  let anyChanged = strippedConjunction;
  const alternatives: string[] = [];

  for (let i = 0; i < words.length; i++) {
    const res = suggestSingleWord(words[i]);
    correctedWords.push(res.best);
    if (res.changed) {
      anyChanged = true;
      for (const candidate of res.candidates) {
        const assembled = [
          ...words.slice(0, i),
          candidate,
          ...words.slice(i + 1),
        ].join(' ');
        if (!alternatives.includes(assembled)) {
          alternatives.push(assembled);
        }
      }
    }
  }

  const correctedQuery = correctedWords.join(' ');
  return {
    correctedQuery,
    changed: anyChanged && correctedQuery !== trimmed,
    alternatives: alternatives.slice(0, 3),
  };
}
