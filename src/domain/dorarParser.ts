import { classifyVerdict } from './gradeClassifier';
import type { HadithResult, OsoulEntry } from './hadith';

export interface ParsedDorarPage {
  items: HadithResult[];
  hasMore: boolean;
}

export interface ParsedDorarWebPage extends ParsedDorarPage {
  recognized: boolean;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  laquo: '«',
  raquo: '»',
  ndash: '–',
  mdash: '—',
  hellip: '…',
};

function safeCodePoint(codePoint: number, fallback: string): string {
  if (
    !Number.isInteger(codePoint) ||
    codePoint < 0 ||
    codePoint > 0x10ffff ||
    (codePoint >= 0xd800 && codePoint <= 0xdfff)
  ) {
    return fallback;
  }
  return String.fromCodePoint(codePoint);
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-fA-F]{1,8});/g, (full, hex: string) =>
      safeCodePoint(parseInt(hex, 16), full),
    )
    .replace(/&#(\d{1,10});/g, (full, dec: string) =>
      safeCodePoint(parseInt(dec, 10), full),
    )
    .replace(/&([a-zA-Z]+);/g, (full, name: string) => NAMED_ENTITIES[name] ?? full);
}

function stripTagsToPlainText(html: string): string {
  const withoutScripts = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, '');

  const blockSeparated = withoutScripts.replace(
    /<\/?(?:div|p|br|li|tr|td|th|h[1-6]|hr)\b[^>]*>/gi,
    ' ',
  );
  const withoutTags = blockSeparated.replace(/<[^>]+>/g, '');
  return decodeHtmlEntities(withoutTags)
    .replace(/_x000[dDaA]_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanHadithBody(rawBody: string): string {
  return rawBody
    .replace(/^\s*(?:\d+\s*)?[-–—.]\s*/, '')
    .replace(/\s+\.\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanNarrator(raw: string): string {
  const unwrapped = raw.replace(/^\[+\s*|\s*\]+$/g, '').trim();
  if (!unwrapped || /^[-–—]+$/.test(unwrapped)) return '';
  return unwrapped;
}

function extractField(block: string, label: string, nextLabels: string[]): string {
  const startIdx = block.indexOf(label);
  if (startIdx === -1) return '';
  const afterLabel = block.slice(startIdx + label.length);

  let endIdx = afterLabel.length;
  for (const next of nextLabels) {
    const idx = afterLabel.indexOf(next);
    if (idx !== -1 && idx < endIdx) {
      endIdx = idx;
    }
  }

  const cleaned = afterLabel.slice(0, endIdx).replace(/\s+/g, ' ').trim();
  if (/^[-–—]+$/.test(cleaned)) return '';
  return cleaned;
}

function makeStableId(
  text: string,
  narrator: string,
  muhaddith: string,
  source: string,
  pageOrNumber: string,
  rawGrade: string,
): string {
  const key = `${text}|${narrator}|${muhaddith}|${source}|${pageOrNumber}|${rawGrade}`;
  let h1 = 2166136261;
  let h2 = 33554467;
  for (let i = 0; i < key.length; i++) {
    const code = key.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 16777619);
    h2 ^= code;
    h2 = Math.imul(h2, 16777619);
  }
  return `dorar-${(h1 >>> 0).toString(36)}-${(h2 >>> 0).toString(36)}`;
}

export function parseDorarApiResponse(rawPayload: string): ParsedDorarPage {
  let htmlResult = '';
  try {
    const parsed = JSON.parse(rawPayload) as { ahadith?: { result?: string } };
    htmlResult = parsed?.ahadith?.result ?? '';
  } catch {
    return { items: [], hasMore: false };
  }

  if (!htmlResult.trim()) {
    return { items: [], hasMore: false };
  }

  const rawBlocks = htmlResult.split('--------------');
  const items: HadithResult[] = [];
  let hasMoreLink = false;

  for (let i = 0; i < rawBlocks.length; i++) {
    const rawBlock = rawBlocks[i];
    if (!rawBlock.trim()) continue;

    if (rawBlock.includes('المزيد') && !rawBlock.includes('الراوي:')) {
      hasMoreLink = true;
      continue;
    }

    const plain = stripTagsToPlainText(rawBlock);
    const rawiIndex = plain.indexOf('الراوي:');
    if (rawiIndex === -1) continue;

    const bodyRaw = plain.slice(0, rawiIndex);
    const metaRaw = plain.slice(rawiIndex);

    const text = cleanHadithBody(bodyRaw);
    if (!text) continue;

    const narrator = cleanNarrator(
      extractField(metaRaw, 'الراوي:', [
        'المحدث:',
        'المصدر:',
        'الصفحة أو الرقم:',
        'خلاصة حكم المحدث:',
      ]),
    );
    const muhaddith = extractField(metaRaw, 'المحدث:', [
      'المصدر:',
      'الصفحة أو الرقم:',
      'خلاصة حكم المحدث:',
    ]);
    const source = extractField(metaRaw, 'المصدر:', [
      'الصفحة أو الرقم:',
      'خلاصة حكم المحدث:',
    ]);
    const pageOrNumber = extractField(metaRaw, 'الصفحة أو الرقم:', [
      'خلاصة حكم المحدث:',
    ]);
    const rawGrade = extractField(metaRaw, 'خلاصة حكم المحدث:', [
      'التخريج:',
      'المزيد',
    ]);

    const { bucket } = classifyVerdict(rawGrade);

    items.push({
      id: makeStableId(text, narrator, muhaddith, source, pageOrNumber, rawGrade),
      text,
      narrator,
      muhaddith,
      source,
      pageOrNumber,
      rawGrade,
      gradeBucket: bucket,
    });
  }

  // Dorar returns up to 15 items per page; treat hasMore as true when items exist and "المزيد" is present
  const hasMore = items.length > 0 && hasMoreLink;
  return { items, hasMore };
}

function cleanOptionalField(raw: string): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (!cleaned || /^[-–—]+$/.test(cleaned)) return '';
  return cleaned;
}

function extractTabSection(html: string, tabId: string): string {
  const marker = `id="${tabId}"`;
  const start = html.indexOf(marker);
  if (start === -1) return '';
  const searchFrom = start + marker.length;
  const nextTabPane = html.indexOf('class="tab-pane', searchFrom);
  const nextSpecialist = tabId === 'home' ? html.indexOf('id="specialist"', searchFrom) : -1;
  const footerIdx = html.indexOf('<footer', searchFrom);

  const candidates = [nextTabPane, nextSpecialist, footerIdx].filter((n) => n !== -1);
  const end = candidates.length > 0 ? Math.min(...candidates) : html.length;
  return html.slice(start, end);
}

function parseWebCardsFromSection(sectionHtml: string): HadithResult[] {
  const parts = sectionHtml.split(/<div\b[^>]*class="[^"]*border-bottom[^"]*"[^>]*>/i);
  const items: HadithResult[] = [];

  for (let i = 1; i < parts.length; i++) {
    const chunk = parts[i];
    const h5Match = chunk.match(/<h5\b[^>]*>([\s\S]*?)<\/h5>/i);
    if (!h5Match) continue;

    const text = cleanHadithBody(stripTagsToPlainText(h5Match[1]));
    if (!text) continue;

    let rawGrade = '';
    let narrator = '';
    let muhaddith = '';
    let source = '';
    let pageOrNumber = '';
    let takhrij = '';

    const strongRegex = /<strong\b[^>]*>([\s\S]*?)<\/strong>/gi;
    let strongMatch: RegExpExecArray | null;
    while ((strongMatch = strongRegex.exec(chunk)) !== null) {
      const strongHtml = strongMatch[1];
      const plainStrong = stripTagsToPlainText(strongHtml);
      const colonIdx = plainStrong.indexOf(':');
      if (colonIdx === -1) continue;

      const label = plainStrong.slice(0, colonIdx);
      const spanMatch = strongHtml.match(
        /<span\b[^>]*class="[^"]*primary-text-color[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
      );
      const rawVal = spanMatch
        ? stripTagsToPlainText(spanMatch[1])
        : plainStrong.slice(colonIdx + 1);
      const value = cleanOptionalField(rawVal);

      if (label.includes('خلاصة حكم المحدث')) {
        rawGrade = value;
      } else if (label.includes('الراوي')) {
        narrator = cleanNarrator(value);
      } else if (label.includes('المحدث')) {
        muhaddith = value;
      } else if (label.includes('المصدر')) {
        source = value;
      } else if (label.includes('الصفحة أو الرقم')) {
        pageOrNumber = value;
      } else if (label.includes('التخريج')) {
        takhrij = value;
      }
    }

    let dorarId: string | undefined;
    let hasOsoul = false;
    let hasAltSahih = false;
    let hasSimilar = false;

    const hrefRegex = /href="([^"]+)"/gi;
    let hrefMatch: RegExpExecArray | null;
    while ((hrefMatch = hrefRegex.exec(chunk)) !== null) {
      const href = decodeHtmlEntities(hrefMatch[1]);
      const osoulMatch = href.match(/\/h\/([A-Za-z0-9_-]+)\/osoul\b/);
      if (osoulMatch) {
        dorarId = osoulMatch[1];
        hasOsoul = true;
        continue;
      }
      const altMatch = href.match(/\/h\/([A-Za-z0-9_-]+)\?[^"]*alts=1/);
      if (altMatch) {
        dorarId = altMatch[1];
        hasAltSahih = true;
        continue;
      }
      const simMatch = href.match(/\/h\/([A-Za-z0-9_-]+)\?[^"]*sims=1/);
      if (simMatch) {
        dorarId = simMatch[1];
        hasSimilar = true;
        continue;
      }
      const plainIdMatch = href.match(/\/h\/([A-Za-z0-9_-]+)(?:[?#]|$)/);
      if (plainIdMatch && !dorarId) {
        dorarId = plainIdMatch[1];
      }
    }

    const { bucket } = classifyVerdict(rawGrade);
    const result: HadithResult = {
      id: makeStableId(text, narrator, muhaddith, source, pageOrNumber, rawGrade),
      text,
      narrator,
      muhaddith,
      source,
      pageOrNumber,
      rawGrade,
      gradeBucket: bucket,
    };

    if (takhrij) result.takhrij = takhrij;
    if (dorarId) {
      result.dorarId = dorarId;
      result.hasOsoul = hasOsoul;
      result.hasAltSahih = hasAltSahih;
      result.hasSimilar = hasSimilar;
    }

    items.push(result);
  }

  return items;
}

export function parseDorarWebSearchHtml(
  html: string,
  currentPage = 1,
): ParsedDorarWebPage {
  if (!html || (!html.includes('id="specialist"') && !html.includes('id="home"'))) {
    return { items: [], hasMore: false, recognized: false };
  }

  const specialistSection = extractTabSection(html, 'specialist');
  let activeSection = specialistSection;
  let items = specialistSection ? parseWebCardsFromSection(specialistSection) : [];

  if (items.length === 0) {
    const homeSection = extractTabSection(html, 'home');
    if (homeSection) {
      activeSection = homeSection;
      items = parseWebCardsFromSection(homeSection);
    }
  }

  let hasMore = false;
  if (items.length > 0 && activeSection) {
    const pageRegex = /href="([^"]+)"/gi;
    let pageMatch: RegExpExecArray | null;
    while ((pageMatch = pageRegex.exec(activeSection)) !== null) {
      const decodedHref = decodeHtmlEntities(pageMatch[1]);
      const p = decodedHref.match(/[?&]page=(\d+)/);
      if (p && Number(p[1]) > currentPage) {
        hasMore = true;
        break;
      }
    }
  }

  return { items, hasMore, recognized: true };
}

export function parseDorarOsoulHtml(html: string): OsoulEntry[] {
  const start = html.indexOf('أصول الحديث:');
  if (start === -1) return [];

  const footerIdx = html.indexOf('<footer', start);
  const slice = footerIdx === -1 ? html.slice(start) : html.slice(start, footerIdx);

  const entries: OsoulEntry[] = [];
  const h5Regex = /<h5\b[^>]*class="[^"]*h5-responsive[^"]*"[^>]*>([\s\S]*?)<\/h5>/gi;
  let match: RegExpExecArray | null;

  while ((match = h5Regex.exec(slice)) !== null) {
    const inner = match[1];
    const sourceMatch = inner.match(
      /<span\b[^>]*color\s*:\s*maroon[^>]*>([\s\S]*?)<\/span>/i,
    );
    const sanadMatch = inner.match(
      /<span\b[^>]*color\s*:\s*blue[^>]*>([\s\S]*?)<\/span>/i,
    );

    const sourceRef = sourceMatch
      ? stripTagsToPlainText(sourceMatch[1]).replace(/^\[([^\]]+)\]/, '$1').trim()
      : '';
    const sanad = sanadMatch
      ? stripTagsToPlainText(sanadMatch[1]).replace(/^[:،,؛\s]+/, '').trim()
      : '';

    let matnHtml = inner;
    if (sourceMatch) matnHtml = matnHtml.replace(sourceMatch[0], '');
    if (sanadMatch) matnHtml = matnHtml.replace(sanadMatch[0], '');

    const matn = stripTagsToPlainText(matnHtml)
      .replace(/^[،,.:؛\s]+/, '')
      .trim();

    if (sourceRef || sanad || matn) {
      entries.push({ sourceRef, sanad, matn });
    }
  }

  return entries;
}

export function parseDorarRelatedHadithsHtml(html: string): HadithResult[] {
  const section = extractTabSection(html, 'home') || html;
  const allCards = parseWebCardsFromSection(section);
  // Index 0 on ?alts=1 and ?sims=1 is always the source hadith itself
  return allCards.length > 1 ? allCards.slice(1) : [];
}
