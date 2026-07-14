import { REDDIT_SOURCES } from "../config/sources.js";
import type { FetchLike, SourceItem } from "../domain/types.js";
import { normalizeTitleForDeduplication } from "../utils/normalize.js";
import { collectFeedItems } from "./rss.service.js";

function deduplicateRedditTitles(items: readonly SourceItem[]): SourceItem[] {
  const seen = new Set<string>();
  const unique: SourceItem[] = [];
  for (const item of items) {
    const title = normalizeTitleForDeduplication(item.title);
    if (title && seen.has(title)) continue;
    if (title) seen.add(title);
    unique.push(item);
  }

  return unique.map((item, index) => ({
    ...item,
    id: `reddit-${String(index + 1).padStart(3, "0")}`,
  }));
}

export async function fetchRedditItems(
  userAgent: string,
  fetchFn: FetchLike = globalThis.fetch,
  now: Date = new Date(),
): Promise<SourceItem[]> {
  const items = await collectFeedItems(REDDIT_SOURCES, {
    kind: "reddit",
    userAgent,
    now,
    maxTotalItems: 9,
    fetchFn,
  });

  return deduplicateRedditTitles(items).slice(0, 9);
}
