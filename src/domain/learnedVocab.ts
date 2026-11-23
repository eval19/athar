import { normalizeArabic } from './arabicNormalize';
import { loadLearnedWords, saveLearnedWords } from '../services/preferences';

const MAX_LEARNED_WORDS = 2000;
const PURE_ARABIC_WORD_3PLUS = /^[\u0621-\u064A]{3,}$/u;

let hydrated = false;
const learnedSet = new Set<string>();

function ensureHydrated(): void {
  if (hydrated) return;
  hydrated = true;
  for (const word of loadLearnedWords()) {
    if (PURE_ARABIC_WORD_3PLUS.test(word)) {
      learnedSet.add(word);
      if (learnedSet.size >= MAX_LEARNED_WORDS) break;
    }
  }
}

function addNormalizedWords(words: Iterable<string>): boolean {
  ensureHydrated();
  let added = false;

  for (const raw of words) {
    const norm = normalizeArabic(raw);
    if (!PURE_ARABIC_WORD_3PLUS.test(norm)) continue;

    if (learnedSet.has(norm)) {
      // Refresh recency in LRU order without triggering disk write
      learnedSet.delete(norm);
      learnedSet.add(norm);
      continue;
    }

    if (learnedSet.size >= MAX_LEARNED_WORDS) {
      const oldest = learnedSet.values().next().value;
      if (oldest !== undefined) learnedSet.delete(oldest);
    }

    learnedSet.add(norm);
    added = true;
  }

  return added;
}

/**
 * Checks whether a normalized Arabic word was previously observed in verified
 * Al-Dorar hadith texts or confirmed by the user's exact search. Used strictly
 * as an exact-word shield (never as a fuzzy rewrite target).
 */
export function hasLearnedExactWord(normWord: string): boolean {
  if (normWord.length < 3) return false;
  ensureHydrated();
  return learnedSet.has(normWord);
}

const LEARNED_DEF_PREFIXES = ['وال', 'بال', 'فال', 'كال', 'ولل', 'فلل', 'لل', 'ال'] as const;

function expandTokenWithStem(tok: string, out: string[]): void {
  if (tok.length < 3) return;
  out.push(tok);

  for (const prefix of LEARNED_DEF_PREFIXES) {
    if (tok.startsWith(prefix) && tok.length - prefix.length >= 3) {
      const stem = tok.slice(prefix.length);
      out.push(stem);
      if (prefix !== 'ال') {
        out.push(`ال${stem}`);
      }
      break;
    }
  }
}

/**
 * Quietly extracts real normalized Arabic words from returned Al-Dorar hadith
 * texts so seen classical terms are protected from future false spell rewrites.
 */
export function learnWordsFromTexts(texts: readonly string[]): void {
  if (texts.length === 0) return;

  const tokens: string[] = [];
  for (const text of texts) {
    for (const tok of normalizeArabic(text).split(/\s+/)) {
      expandTokenWithStem(tok, tokens);
    }
  }

  if (addNormalizedWords(tokens)) {
    saveLearnedWords(Array.from(learnedSet));
  }
}

/**
 * Remembers query words only after an explicit "Search as typed" request
 * actually returned results from Al-Dorar.
 */
export function learnConfirmedQueryWords(query: string): void {
  const tokens = normalizeArabic(query)
    .split(/\s+/)
    .filter((tok) => tok.length >= 3);
  if (tokens.length === 0) return;

  const expanded: string[] = [];
  for (const tok of tokens) {
    expandTokenWithStem(tok, expanded);
  }

  if (addNormalizedWords(expanded)) {
    saveLearnedWords(Array.from(learnedSet));
  }
}

/**
 * Clears the in-memory learned shield for isolated unit tests.
 */
export function clearLearnedWordsForTests(): void {
  learnedSet.clear();
  hydrated = true;
}
