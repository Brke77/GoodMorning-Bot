import { safeHttpUrl } from "./html.js";

const DEFAULT_DESCRIPTION_LIMIT = 1_500;
const HTML_TAG_PATTERN = /<\/?[a-z][^>]*>/giu;
const BLOCK_TAG_PATTERN =
  /<\/?(?:address|article|aside|blockquote|br|dd|div|dl|dt|figcaption|figure|footer|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|table|tbody|td|tfoot|th|thead|tr|ul)\b[^>]*>/giu;

const HTML_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  apos: "'",
  bdquo: "„",
  bull: "•",
  cent: "¢",
  copy: "©",
  deg: "°",
  divide: "÷",
  emsp: "\u2003",
  ensp: "\u2002",
  euro: "€",
  gt: ">",
  hellip: "…",
  laquo: "«",
  ldquo: "“",
  lsquo: "‘",
  lt: "<",
  mdash: "—",
  middot: "·",
  nbsp: "\u00a0",
  ndash: "–",
  pound: "£",
  quot: '"',
  raquo: "»",
  rdquo: "”",
  reg: "®",
  rsquo: "’",
  sbquo: "‚",
  thinsp: "\u2009",
  times: "×",
  trade: "™",
  yen: "¥",
};

const TRACKING_PARAMETER_NAMES = new Set([
  "_hsenc",
  "_hsmi",
  "dclid",
  "fbclid",
  "gclid",
  "gbraid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "msclkid",
  "ref_src",
  "ref_url",
  "vero_conv",
  "vero_id",
  "wbraid",
]);

export type DeduplicableSourceItem = {
  title: string;
  url?: string | null | undefined;
};

export type DateSortableSourceItem = {
  publishedAt: string | null;
};

function replaceControlCharacters(value: string): string {
  return [...value]
    .map((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint !== undefined &&
        (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f))
        ? " "
        : character;
    })
    .join("");
}

export function normalizeWhitespace(value: string): string {
  return replaceControlCharacters(value).replace(/\s+/gu, " ").trim();
}

export function normalizeTitleForDeduplication(value: string): string {
  return normalizeWhitespace(
    value
      .normalize("NFKC")
      .toLocaleLowerCase("en-US")
      .replace(/\p{P}+/gu, " "),
  );
}

export function canonicalizeUrl(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const safeValue = safeHttpUrl(value);
  if (safeValue === null) {
    return null;
  }

  const url = new URL(safeValue);
  url.hash = "";

  for (const parameterName of [...url.searchParams.keys()]) {
    const normalizedName = parameterName.toLocaleLowerCase("en-US");
    if (normalizedName.startsWith("utm_") || TRACKING_PARAMETER_NAMES.has(normalizedName)) {
      url.searchParams.delete(parameterName);
    }
  }

  url.searchParams.sort();
  if (url.pathname !== "/") {
    url.pathname = url.pathname.replace(/\/+$/u, "");
  }

  return url.toString();
}

export function stripHtml(value: string): string {
  return normalizeWhitespace(
    value
      .replace(/<!--[^]*?-->/gu, " ")
      .replace(/<(script|style)\b[^>]*>[^]*?<\/\1\s*>/giu, " ")
      .replace(/<!\[CDATA\[|\]\]>/gu, " ")
      .replace(BLOCK_TAG_PATTERN, " ")
      .replace(HTML_TAG_PATTERN, " "),
  );
}

export function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#(?:x[\da-f]+|\d+)|[a-z][\da-z]+);/giu, (entity, body: string) => {
    if (!body.startsWith("#")) {
      return HTML_ENTITIES[body.toLocaleLowerCase("en-US")] ?? entity;
    }

    const hexadecimal = body[1]?.toLocaleLowerCase("en-US") === "x";
    const numberText = body.slice(hexadecimal ? 2 : 1);
    const codePoint = Number.parseInt(numberText, hexadecimal ? 16 : 10);
    if (
      !Number.isInteger(codePoint) ||
      codePoint <= 0 ||
      codePoint > 0x10ffff ||
      (codePoint >= 0xd800 && codePoint <= 0xdfff)
    ) {
      return "�";
    }

    return String.fromCodePoint(codePoint);
  });
}

export function truncateText(value: string, maxLength: number): string {
  if (!Number.isSafeInteger(maxLength) || maxLength <= 0) {
    return "";
  }

  return [...value].slice(0, maxLength).join("").trimEnd();
}

export function cleanFeedDescription(
  value: string | null | undefined,
  maxLength = DEFAULT_DESCRIPTION_LIMIT,
): string {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  return truncateText(normalizeWhitespace(decodeHtmlEntities(stripHtml(value))), maxLength);
}

export function deduplicateSourceItems<T extends DeduplicableSourceItem>(items: readonly T[]): T[] {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const fallbackTitles = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const canonicalUrl = canonicalizeUrl(item.url);
    const normalizedTitle = normalizeTitleForDeduplication(item.title);

    if (canonicalUrl !== null) {
      if (
        seenUrls.has(canonicalUrl) ||
        (normalizedTitle !== "" && fallbackTitles.has(normalizedTitle))
      ) {
        continue;
      }
      seenUrls.add(canonicalUrl);
    } else if (normalizedTitle !== "") {
      if (seenTitles.has(normalizedTitle)) {
        continue;
      }
      fallbackTitles.add(normalizedTitle);
    }

    if (normalizedTitle !== "") {
      seenTitles.add(normalizedTitle);
    }
    result.push(item);
  }

  return result;
}

function timestampOrNegativeInfinity(value: string | null): number {
  if (value === null) {
    return Number.NEGATIVE_INFINITY;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

export function sortItemsNewestFirst<T extends DateSortableSourceItem>(items: readonly T[]): T[] {
  return [...items].sort(
    (left, right) =>
      timestampOrNegativeInfinity(right.publishedAt) -
      timestampOrNegativeInfinity(left.publishedAt),
  );
}
