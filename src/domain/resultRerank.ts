import {
  ARABIC_QUERY_FILLERS,
  ARABIC_STOP_WORDS,
  normalizeArabic,
  stripDiacritics,
} from './arabicNormalize';
import type { GradeBucket, HadithResult } from './hadith';
import {
  maxWeightedCostForLength,
  stripArabicAffixes,
  weightedArabicDistance,
} from './typoSuggest';

export interface RerankResult {
  items: HadithResult[];
  recoveredQuery?: string;
  topScore: number;
}

interface QueryTokenSpec {
  raw: string;
  norm: string;
  stemNorm: string;
  isContent: boolean;
  weight: number;
}

interface HadithToken {
  bare: string;
  norm: string;
  stemNorm: string;
}

export interface HadithMatchScore {
  rawCoverage: number;
  matchedContentCount: number;
  contentCount: number;
  bestSingleSim: number;
  totalScore: number;
  matchedTokens: Array<{
    qIdx: number;
    hBare: string;
    hNorm: string;
    sim: number;
  }>;
}

const TOKEN_EDGE_PUNCT_REGEX = /^[^\p{L}\p{M}\p{N}]+|[^\p{L}\p{M}\p{N}]+$/gu;
const BARE_EDGE_PUNCT_REGEX = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;
const HAMZA_CHARS_REGEX = /[أإآ]/g;

const GRADE_TIE_BREAK: Readonly<Record<GradeBucket, number>> = {
  sahih: 0.04,
  sahih_isnad: 0.036,
  hasan: 0.03,
  hasan_isnad: 0.026,
  daif_isnad: 0.015,
  daif: 0.012,
  very_weak: 0.008,
  munkar: 0.006,
  unknown: 0.01,
  batil: 0.005,
  mawdu: 0.005,
};

function tokenizeHadithText(text: string): HadithToken[] {
  const rawParts = text.split(/\s+/);
  const tokens: HadithToken[] = [];

  for (const part of rawParts) {
    const cleaned = part.replace(TOKEN_EDGE_PUNCT_REGEX, '');
    if (!cleaned) continue;

    const bare = stripDiacritics(cleaned).replace(BARE_EDGE_PUNCT_REGEX, '');
    const norm = normalizeArabic(bare);
    if (!norm) continue;

    const affix = stripArabicAffixes(bare);
    const stemNorm = normalizeArabic(affix.stem);
    tokens.push({ bare, norm, stemNorm });
  }

  return tokens;
}

function buildQuerySpecs(query: string): QueryTokenSpec[] {
  const parts = stripDiacritics(query).trim().split(/\s+/).filter(Boolean);
  const parsed = parts
    .map((raw) => {
      const bare = raw.replace(BARE_EDGE_PUNCT_REGEX, '');
      const norm = normalizeArabic(bare);
      if (!norm) return null;
      const affix = stripArabicAffixes(bare);
      return {
        raw: bare,
        norm,
        stemNorm: normalizeArabic(affix.stem),
        isFiller: ARABIC_QUERY_FILLERS.has(norm),
        isStop: ARABIC_STOP_WORDS.has(norm),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const nonFillers = parsed.filter((p) => !p.isFiller && p.norm.length >= 2);
  const active = nonFillers.length > 0 ? nonFillers : parsed.filter((p) => p.norm.length >= 2);

  const hasContent = active.some((p) => !p.isStop);
  return active.map((p) => {
    const isContent = hasContent ? !p.isStop : true;
    return {
      raw: p.raw,
      norm: p.norm,
      stemNorm: p.stemNorm,
      isContent,
      weight: isContent ? 1.0 : 0.25,
    };
  });
}

function tokenPairSimilarity(q: QueryTokenSpec, h: HadithToken): number {
  if (q.norm === h.norm) return 1.0;

  // Stopwords and particles must match verbatim so function words like كانت or فمن
  // never hijack unrelated hadiths via أنت or آمن.
  if (!q.isContent) return 0;

  if (q.stemNorm.length >= 3 && h.stemNorm.length >= 3 && q.stemNorm === h.stemNorm) {
    return 0.92;
  }

  // Evaluate both full-word and stem-to-stem fuzzy similarity
  let bestSim = 0;

  const fullMaxLen = Math.max(q.norm.length, h.norm.length);
  if (fullMaxLen >= 3 && Math.abs(q.norm.length - h.norm.length) <= 2) {
    const dist = weightedArabicDistance(q.norm, h.norm);
    const limit = maxWeightedCostForLength(fullMaxLen);
    if (dist <= limit) {
      const sim = 1 - dist / fullMaxLen;
      if (sim >= 0.58) bestSim = Math.max(bestSim, sim);
    }
  }

  const stemMaxLen = Math.max(q.stemNorm.length, h.stemNorm.length);
  if (
    stemMaxLen >= 3 &&
    q.stemNorm.length >= 3 &&
    h.stemNorm.length >= 3 &&
    Math.abs(q.stemNorm.length - h.stemNorm.length) <= 2
  ) {
    const stemDist = weightedArabicDistance(q.stemNorm, h.stemNorm);
    const limit = maxWeightedCostForLength(stemMaxLen);
    if (stemDist <= limit) {
      const stemSim = (1 - stemDist / stemMaxLen) * 0.96;
      if (stemSim >= 0.58) bestSim = Math.max(bestSim, stemSim);
    }
  }

  return bestSim;
}

function computeProximityOrderBonus(
  matchedPositions: number[],
  matchedContentCount: number,
  contentCount: number,
): number {
  if (matchedContentCount < 2 || contentCount < 2) return 0;

  const minPos = Math.min(...matchedPositions);
  const maxPos = Math.max(...matchedPositions);
  const span = maxPos - minPos + 1;
  const idealSpan = matchedPositions.length;

  // Compactness: 1.0 when matched content tokens sit right next to each other
  const slack = Math.max(0, span - idealSpan);
  const compactness = 1 / (1 + slack * 0.25);

  // Order preservation across matched pairs
  let orderedPairs = 0;
  let totalPairs = 0;
  for (let i = 0; i < matchedPositions.length; i++) {
    for (let j = i + 1; j < matchedPositions.length; j++) {
      totalPairs++;
      if (matchedPositions[i] < matchedPositions[j]) orderedPairs++;
    }
  }
  const orderFactor = totalPairs > 0 ? 0.5 + 0.5 * (orderedPairs / totalPairs) : 1;
  const completeness = Math.pow(matchedContentCount / contentCount, 1.8);

  return 0.25 * completeness * compactness * orderFactor;
}

/**
 * Computes fuzzy/phonetic/proximity relevance score of a single hadith text
 * against a user query.
 */
export function scoreHadithMatch(
  hadithText: string,
  query: string,
  gradeBucket: GradeBucket = 'unknown',
): HadithMatchScore {
  const qSpecs = buildQuerySpecs(query);
  if (qSpecs.length === 0) {
    return {
      rawCoverage: 0,
      matchedContentCount: 0,
      contentCount: 0,
      bestSingleSim: 0,
      totalScore: 0,
      matchedTokens: [],
    };
  }

  const hTokens = tokenizeHadithText(hadithText);
  if (hTokens.length === 0) {
    const contentCount = qSpecs.filter((q) => q.isContent).length;
    return {
      rawCoverage: 0,
      matchedContentCount: 0,
      contentCount,
      bestSingleSim: 0,
      totalScore: 0,
      matchedTokens: [],
    };
  }

  let weightedSimSum = 0;
  let totalWeight = 0;
  let matchedContentCount = 0;
  let contentCount = 0;
  let bestSingleSim = 0;

  const contentPositions: number[] = [];
  const matchedTokens: HadithMatchScore['matchedTokens'] = [];

  for (let qi = 0; qi < qSpecs.length; qi++) {
    const q = qSpecs[qi];
    totalWeight += q.weight;
    if (q.isContent) contentCount++;

    let bestSim = 0;
    let bestIdx = -1;

    for (let hi = 0; hi < hTokens.length; hi++) {
      const sim = tokenPairSimilarity(q, hTokens[hi]);
      if (sim > bestSim) {
        bestSim = sim;
        bestIdx = hi;
        if (bestSim === 1.0) break;
      }
    }

    weightedSimSum += q.weight * bestSim;

    if (q.isContent) {
      bestSingleSim = Math.max(bestSingleSim, bestSim);
      if (bestSim >= 0.58 && bestIdx !== -1) {
        matchedContentCount++;
        contentPositions.push(bestIdx);
      }
    }

    if (bestSim >= 0.58 && bestIdx !== -1) {
      matchedTokens.push({
        qIdx: qi,
        hBare: hTokens[bestIdx].bare,
        hNorm: hTokens[bestIdx].norm,
        sim: bestSim,
      });
    }
  }

  const rawCoverage = totalWeight > 0 ? weightedSimSum / totalWeight : 0;
  const contentRatio = contentCount > 0 ? matchedContentCount / contentCount : 0;
  const recallAdjusted = rawCoverage * (0.55 + 0.45 * contentRatio);
  const proxBonus = computeProximityOrderBonus(
    contentPositions,
    matchedContentCount,
    contentCount,
  );
  const totalScore = recallAdjusted + proxBonus + (GRADE_TIE_BREAK[gradeBucket] ?? 0.01);

  return {
    rawCoverage,
    matchedContentCount,
    contentCount,
    bestSingleSim,
    totalScore,
    matchedTokens,
  };
}

function passesRelevanceFloor(score: HadithMatchScore): boolean {
  if (score.contentCount === 0) return false;
  if (score.contentCount === 1) {
    return score.rawCoverage >= 0.68;
  }
  if (score.contentCount === 2) {
    return score.matchedContentCount >= 2 && score.rawCoverage >= 0.52;
  }
  const minMatched = Math.max(2, Math.ceil(score.contentCount * 0.6));
  return score.matchedContentCount >= minMatched && score.rawCoverage >= 0.52;
}

function countHamzas(word: string): number {
  return (word.match(HAMZA_CHARS_REGEX) ?? []).length;
}

function extractVerifiedRecoveredQuery(
  topMatches: HadithMatchScore[],
  query: string,
): string | undefined {
  const qSpecs = buildQuerySpecs(query);
  if (qSpecs.length === 0 || topMatches.length === 0) return undefined;

  const sample = topMatches.slice(0, 5);
  let improvedFuzzy = 0;

  // Per query token index, vote among matched bare forms in top surviving cards
  const chosenTokens = qSpecs.map((q, qi) => {
    const formStats = new Map<string, { count: number; totalSim: number; hNorm: string }>();

    for (const match of sample) {
      const hit = match.matchedTokens.find((m) => m.qIdx === qi);
      if (!hit || hit.sim < 0.72) continue;

      const existing = formStats.get(hit.hBare);
      if (existing) {
        existing.count += 1;
        existing.totalSim += hit.sim;
      } else {
        formStats.set(hit.hBare, { count: 1, totalSim: hit.sim, hNorm: hit.hNorm });
      }
    }

    let bestForm = q.raw;
    let bestWeight = 0;
    let bestNorm = q.norm;

    for (const [form, stats] of formStats.entries()) {
      const rankWeight = stats.count * (stats.totalSim / stats.count) + countHamzas(form) * 0.05;
      if (rankWeight > bestWeight) {
        bestWeight = rankWeight;
        bestForm = form;
        bestNorm = stats.hNorm;
      }
    }

    if (bestNorm !== q.norm) {
      improvedFuzzy++;
      return bestForm;
    }

    // Only upgrade hamzas on exact-norm matches (e.g. انما -> إنما, الاعمال -> الأعمال),
    // never replacing different trailing chars like ى/ي unless fuzzy-corrected.
    if (bestForm !== q.raw && countHamzas(bestForm) > countHamzas(q.raw)) {
      return bestForm;
    }

    return q.raw;
  });

  if (improvedFuzzy === 0) return undefined;

  const rebuilt = chosenTokens.join(' ');
  const cleanedRaw = stripDiacritics(query).trim();
  return rebuilt && rebuilt !== cleanedRaw ? rebuilt : undefined;
}

/**
 * Re-ranks relaxed Al-Dorar (`st=a`) results using Arabic fuzzy, phonetic, and
 * word-proximity scoring, drops unrelated outliers, and recovers verified
 * classical spellings directly from the top matched hadiths.
 */
export function rerankRelaxedResults(
  items: HadithResult[],
  rawQuery: string,
): RerankResult {
  if (items.length === 0 || !rawQuery.trim()) {
    return { items: [], topScore: 0 };
  }

  const scored = items
    .map((item, idx) => ({
      item,
      idx,
      score: scoreHadithMatch(item.text, rawQuery, item.gradeBucket),
    }))
    .filter((entry) => passesRelevanceFloor(entry.score));

  if (scored.length === 0) {
    return { items: [], topScore: 0 };
  }

  scored.sort((a, b) => {
    const diff = b.score.totalScore - a.score.totalScore;
    if (Math.abs(diff) > 1e-6) return diff;
    return a.idx - b.idx;
  });

  const topScore = scored[0].score.totalScore;
  const filtered =
    topScore >= 0.85
      ? scored.filter((entry) => entry.score.totalScore >= topScore * 0.6)
      : scored;

  const recoveredQuery = extractVerifiedRecoveredQuery(
    filtered.map((f) => f.score),
    rawQuery,
  );

  return {
    items: filtered.map((f) => f.item),
    recoveredQuery,
    topScore,
  };
}
