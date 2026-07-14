import { describe, expect, it } from "vitest";

import type { ReportModel, SourceItem, TelegramSection } from "../src/domain/types.js";
import {
  chunkTelegramSections,
  isBalancedTelegramHtml,
  renderTelegramReport,
} from "../src/report/render-telegram.js";

function item(id: string, url: string | null, title: string, sourceName: string): SourceItem {
  return {
    id,
    kind: "tech",
    sourceId: "source",
    sourceName,
    title,
    description: "Description",
    url,
    publishedAt: "2026-07-14T05:00:00.000Z",
  };
}

function fallbackReport(items: SourceItem[]): ReportModel {
  return {
    generatedAt: new Date("2026-07-14T05:00:00.000Z"),
    weather: null,
    fx: null,
    techItemCount: items.length,
    redditItemCount: 0,
    summary: {
      mode: "fallback",
      note: "ℹ️ AI özeti bugün oluşturulamadı; kaynak başlıkları gösteriliyor.",
      techItems: items,
      redditItems: [],
    },
  };
}

describe("Telegram report HTML safety", () => {
  it("escapes untrusted text, escapes href attributes and drops invalid links", () => {
    const report = fallbackReport([
      item("safe", "https://example.test/story?a=1&b=2", "OpenAI <test> & news", "Source <&>"),
      item("unsafe", "javascript:alert(1)", "<script>bad</script>", "Unsafe & Source"),
    ]);

    const html = renderTelegramReport(report).join("\n");

    expect(html).toContain("OpenAI &lt;test&gt; &amp; news");
    expect(html).toContain("Source &lt;&amp;&gt;");
    expect(html).toContain('href="https://example.test/story?a=1&amp;b=2"');
    expect(html).toContain("&lt;script&gt;bad&lt;/script&gt;");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<script>");
  });
});

describe("chunkTelegramSections", () => {
  it("keeps content at the 3900 soft limit in one message", () => {
    const chunks = chunkTelegramSections([{ id: "exact", blocks: ["x".repeat(3_900)] }]);

    expect(chunks).toEqual(["x".repeat(3_900)]);
  });

  it("packs whole sections at section boundaries and adds continuation metadata", () => {
    const sections: TelegramSection[] = [
      { id: "a", blocks: ["<b>A</b>", "a".repeat(1_200)] },
      { id: "b", blocks: ["<b>B</b>", "b".repeat(1_200)] },
      { id: "c", blocks: ["<b>C</b>", "c".repeat(1_800)] },
    ];

    const chunks = chunkTelegramSections(sections);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toContain("<b>A</b>");
    expect(chunks[0]).toContain("<b>B</b>");
    expect(chunks[0]).not.toContain("<b>C</b>");
    expect(chunks[1]).toMatch(/^<i>\(2\/2\)<\/i>/u);
    expect(chunks[1]).toContain("<b>C</b>");
    expect(chunks.every((chunk) => chunk.length <= 3_900)).toBe(true);
  });

  it("splits an oversized tagged block without breaking tags or HTML entities", () => {
    const sections: TelegramSection[] = [
      {
        id: "long",
        blocks: ["<b>☀️ Günaydın, broski</b>", `<b>${"x&amp;".repeat(1_000)}</b>`],
      },
    ];

    const chunks = chunkTelegramSections(sections);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 3_900)).toBe(true);
    expect(chunks.every(isBalancedTelegramHtml)).toBe(true);
    for (const chunk of chunks) {
      expect(chunk).not.toMatch(/&(?:a|am|amp)<\/b>/u);
    }
    expect(chunks[0]).toContain("Günaydın, broski");
    expect(chunks[1]).toMatch(/^<i>\(2\//u);
  });
});
