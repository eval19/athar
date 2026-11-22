import { normalizeArabic } from './arabicNormalize';
import type { GradeBucket, GroupedHadith, HadithResult } from './hadith';

const BUCKET_PRIORITY: Record<GradeBucket, number> = {
  sahih: 85,
  sahih_isnad: 80,
  hasan: 75,
  hasan_isnad: 70,
  daif_isnad: 55,
  daif: 50,
  very_weak: 45,
  munkar: 40,
  batil: 30,
  mawdu: 25,
  unknown: 10,
};

function authorityScore(item: HadithResult): number {
  let score = BUCKET_PRIORITY[item.gradeBucket];
  const src = normalizeArabic(item.source);
  if (src.includes('صحيح البخاري') || src.includes('صحيح مسلم')) {
    score += 20;
  }
  return score;
}

function citationKey(item: HadithResult): string {
  return [
    normalizeArabic(item.narrator),
    normalizeArabic(item.source),
    item.pageOrNumber.trim(),
    normalizeArabic(item.muhaddith),
    normalizeArabic(item.rawGrade),
  ].join('|');
}

function isNearIdenticalMatn(
  normA: string,
  wordsA: Set<string>,
  normB: string,
  wordsB: Set<string>,
): boolean {
  if (normA === normB) return true;
  if (wordsA.size < 5 || wordsB.size < 5) return false;

  const minLen = Math.min(normA.length, normB.length);
  const maxLen = Math.max(normA.length, normB.length);
  if (minLen / maxLen < 0.8) return false;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  const union = wordsA.size + wordsB.size - intersection;
  return union > 0 && intersection / union >= 0.82;
}

/**
 * Groups hadiths sharing an identical or near-identical normalized Matn
 * (e.g. minor book spelling/diacritic variants like تتميّل vs يتميّل) into one card,
 * promoting Sahihayn or higher-authority rulings as primary while keeping all
 * other scholars/sources expandable underneath.
 */
export function groupDuplicateHadiths(items: HadithResult[]): GroupedHadith[] {
  const groups: Array<{
    norm: string;
    words: Set<string>;
    members: HadithResult[];
    seenCitations: Set<string>;
  }> = [];
  const exactMap = new Map<string, (typeof groups)[number]>();

  for (const item of items) {
    const norm = normalizeArabic(item.text);
    const words = new Set(norm.split(' ').filter(Boolean));
    const citeKey = citationKey(item);

    let target = exactMap.get(norm);
    if (!target && words.size >= 5) {
      target = groups.find((g) => isNearIdenticalMatn(g.norm, g.words, norm, words));
    }

    if (!target) {
      const group = {
        norm,
        words,
        members: [item],
        seenCitations: new Set([citeKey]),
      };
      groups.push(group);
      exactMap.set(norm, group);
      continue;
    }

    if (!target.seenCitations.has(citeKey)) {
      target.seenCitations.add(citeKey);
      target.members.push(item);
    }
  }

  return groups.map((group) => {
    let bestIdx = 0;
    let bestScore = authorityScore(group.members[0]);

    for (let i = 1; i < group.members.length; i++) {
      const score = authorityScore(group.members[i]);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    const primary = group.members[bestIdx];
    const others = group.members.filter((_, idx) => idx !== bestIdx);
    return { primary, others };
  });
}
