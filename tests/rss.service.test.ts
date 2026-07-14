import { describe, expect, it } from "vitest";

import type { FetchLike, RssSource } from "../src/domain/types.js";
import { fetchRedditItems } from "../src/services/reddit.service.js";
import { collectFeedItems } from "../src/services/rss.service.js";

function rssFeed(
  items: readonly { title: string; link: string; date?: string; description?: string }[],
): string {
  const body = items
    .map(
      (item) => `<item>
        <title><![CDATA[${item.title}]]></title>
        <link>${item.link.replaceAll("&", "&amp;")}</link>
        ${item.date ? `<pubDate>${item.date}</pubDate>` : ""}
        <description><![CDATA[${item.description ?? ""}]]></description>
      </item>`,
    )
    .join("\n");
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>Test</title>${body}</channel></rss>`;
}

describe("collectFeedItems", () => {
  it("feed'leri kısmi başarıyla çeker, temizler ve User-Agent gönderir", async () => {
    const sources: RssSource[] = [
      { id: "ok", name: "Başarılı", url: "https://example.com/ok.xml", maxItems: 2 },
      { id: "down", name: "Bozuk", url: "https://example.com/down.xml", maxItems: 2 },
    ];
    const seenUserAgents: string[] = [];
    const fetchFn: FetchLike = async (input, init) => {
      seenUserAgents.push(new Headers(init?.headers).get("user-agent") ?? "");
      const url = input instanceof Request ? input.url : input.toString();
      if (url.includes("down")) return new Response("forbidden", { status: 403 });

      return new Response(
        rssFeed([
          {
            title: "  İlk   haber! ",
            link: "https://example.com/story?utm_source=rss",
            date: "Tue, 14 Jul 2026 07:00:00 GMT",
            description: "<p>Özet &amp; ayrıntı</p><script>kötü()</script>",
          },
          {
            title: "Eski haber",
            link: "https://example.com/old",
            date: "Sun, 12 Jul 2026 07:00:00 GMT",
          },
        ]),
        { status: 200, headers: { "content-type": "application/rss+xml" } },
      );
    };

    const result = await collectFeedItems(sources, {
      kind: "tech",
      userAgent: "MorningBriefBot/Test",
      now: new Date("2026-07-14T08:00:00Z"),
      fetchFn,
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: "tech-001",
      title: "İlk haber!",
      description: "Özet & ayrıntı",
      url: "https://example.com/story",
    });
    expect(seenUserAgents).toEqual(["MorningBriefBot/Test", "MorningBriefBot/Test"]);
  });
});

describe("fetchRedditItems", () => {
  it("aynı normalize başlığı farklı linklerde olsa da bir kez tutar", async () => {
    const fetchFn: FetchLike = async (input, init) => {
      expect(new Headers(init?.headers).get("user-agent")).toBe("MorningBriefBot/Test");
      const url = input instanceof Request ? input.url : input.toString();
      const source = new URL(url).pathname.split("/").filter(Boolean)[1] ?? "unknown";
      return new Response(
        rssFeed([
          {
            title: "Aynı Reddit konusu!",
            link: `https://www.reddit.com/r/${source}/comments/123`,
            date: "Tue, 14 Jul 2026 07:00:00 GMT",
          },
        ]),
        { status: 200 },
      );
    };

    const items = await fetchRedditItems(
      "MorningBriefBot/Test",
      fetchFn,
      new Date("2026-07-14T08:00:00Z"),
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe("reddit-001");
  });
});
