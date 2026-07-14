import Parser from "rss-parser";

import { MAX_FEED_BYTES, TECH_SOURCES } from "../config/sources.js";
import type { FetchLike, RssSource, SourceItem, SourceKind } from "../domain/types.js";
import { fetchWithRetry } from "../utils/fetch-with-retry.js";
import { logger, safeErrorMessage } from "../utils/logger.js";
import {
  canonicalizeUrl,
  cleanFeedDescription,
  deduplicateSourceItems,
  normalizeWhitespace,
  sortItemsNewestFirst,
} from "../utils/normalize.js";

interface CustomFeedItem {
  description?: string;
}

export interface CollectFeedOptions {
  kind: SourceKind;
  userAgent: string;
  now?: Date;
  maxTotalItems?: number;
  fetchFn?: FetchLike;
}

const parser = new Parser<Record<string, never>, CustomFeedItem>({
  customFields: { item: ["description"] },
});

function parsePublishedAt(value: string | undefined): string | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function normalizeFeedItem(
  item: Parser.Item & CustomFeedItem,
  source: RssSource,
  kind: SourceKind,
): SourceItem | null {
  const title = normalizeWhitespace(item.title ?? "");
  if (!title) return null;

  // Raw description is preferred because rss-parser's contentSnippet can keep
  // script text after removing the script tags themselves.
  const rawDescription =
    item.description ?? item.contentSnippet ?? item.summary ?? item.content ?? "";
  const candidateUrl = item.link ?? item.guid ?? null;

  return {
    id: "",
    kind,
    sourceId: source.id,
    sourceName: source.name,
    title,
    description: cleanFeedDescription(rawDescription, 1_500),
    url: candidateUrl ? canonicalizeUrl(candidateUrl) : null,
    publishedAt: parsePublishedAt(item.isoDate ?? item.pubDate),
  };
}

function prioritizeRecentItems(
  items: readonly SourceItem[],
  maxItems: number,
  now: Date,
): SourceItem[] {
  const sorted = sortItemsNewestFirst(items);
  const cutoff = now.getTime() - 36 * 60 * 60 * 1_000;
  const recent: SourceItem[] = [];
  const remaining: SourceItem[] = [];
  for (const item of sorted) {
    const timestamp = item.publishedAt ? Date.parse(item.publishedAt) : Number.NaN;
    if (Number.isFinite(timestamp) && timestamp >= cutoff) recent.push(item);
    else remaining.push(item);
  }
  return [...recent, ...remaining].slice(0, maxItems);
}

async function fetchFeedXml(
  source: RssSource,
  userAgent: string,
  fetchFn: FetchLike,
): Promise<string> {
  const response = await fetchWithRetry(
    source.url,
    {
      headers: {
        Accept: "application/atom+xml, application/rss+xml, application/xml, text/xml;q=0.9",
        "User-Agent": userAgent,
      },
    },
    { fetchFn },
  );

  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Feed HTTP ${response.status}`);
  }

  const declaredBytes = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredBytes) && declaredBytes > MAX_FEED_BYTES) {
    await response.body?.cancel();
    throw new Error("Feed yanıtı güvenli boyut sınırını aşıyor.");
  }

  const xml = await response.text();
  if (Buffer.byteLength(xml, "utf8") > MAX_FEED_BYTES) {
    throw new Error("Feed içeriği güvenli boyut sınırını aşıyor.");
  }
  return xml;
}

async function fetchSingleSource(
  source: RssSource,
  options: Required<Pick<CollectFeedOptions, "kind" | "userAgent">> & {
    now: Date;
    fetchFn: FetchLike;
  },
): Promise<SourceItem[]> {
  const xml = await fetchFeedXml(source, options.userAgent, options.fetchFn);
  const feed = await parser.parseString(xml);
  const normalized = feed.items
    .map((item) => normalizeFeedItem(item, source, options.kind))
    .filter((item): item is SourceItem => item !== null);
  return prioritizeRecentItems(normalized, source.maxItems, options.now);
}

function assignSequentialIds(items: readonly SourceItem[], kind: SourceKind): SourceItem[] {
  return items.map((item, index) => ({
    ...item,
    id: `${kind}-${String(index + 1).padStart(3, "0")}`,
  }));
}

export async function collectFeedItems(
  sources: readonly RssSource[],
  options: CollectFeedOptions,
): Promise<SourceItem[]> {
  const now = options.now ?? new Date();
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const settled = await Promise.allSettled(
    sources.map((source) =>
      fetchSingleSource(source, {
        kind: options.kind,
        userAgent: options.userAgent,
        now,
        fetchFn,
      }),
    ),
  );

  const collected: SourceItem[] = [];
  settled.forEach((result, index) => {
    const source = sources[index];
    if (!source) return;
    const eventPrefix = options.kind === "tech" ? "rss" : "reddit";

    if (result.status === "fulfilled") {
      collected.push(...result.value);
      logger.info(`${eventPrefix}.source.success`, {
        source: source.name,
        itemCount: result.value.length,
      });
    } else {
      logger.warn(`${eventPrefix}.source.failed`, {
        source: source.name,
        error: safeErrorMessage(result.reason),
      });
    }
  });

  const deduplicated = sortItemsNewestFirst(deduplicateSourceItems(collected));
  const limited =
    options.maxTotalItems === undefined
      ? deduplicated
      : deduplicated.slice(0, options.maxTotalItems);
  return assignSequentialIds(limited, options.kind);
}

export async function fetchTechnologyItems(
  userAgent: string,
  fetchFn: FetchLike = globalThis.fetch,
  now: Date = new Date(),
): Promise<SourceItem[]> {
  return collectFeedItems(TECH_SOURCES, {
    kind: "tech",
    userAgent,
    now,
    fetchFn,
  });
}
