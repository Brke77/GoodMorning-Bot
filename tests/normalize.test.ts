import { describe, expect, it } from "vitest";

import {
  canonicalizeUrl,
  cleanFeedDescription,
  decodeHtmlEntities,
  deduplicateSourceItems,
  normalizeTitleForDeduplication,
  normalizeWhitespace,
  sortItemsNewestFirst,
  stripHtml,
} from "../src/utils/normalize.js";

describe("normalizeWhitespace", () => {
  it("boşlukları ve kontrol karakterlerini teke indirir", () => {
    expect(normalizeWhitespace("  Sabah\t\n  özet\u0000 botu  ")).toBe("Sabah özet botu");
  });
});

describe("normalizeTitleForDeduplication", () => {
  it("case, boşluk ve basit punctuation farklarını kaldırır", () => {
    const variants = [
      "OpenAI launches new model",
      "OpenAI launches new model!",
      "  OPENAI   launches new model  ",
      "OpenAI—launches new model…",
    ];

    expect(new Set(variants.map(normalizeTitleForDeduplication))).toEqual(
      new Set(["openai launches new model"]),
    );
  });

  it("Unicode compatibility karakterlerini normalize eder", () => {
    expect(normalizeTitleForDeduplication("ＡＩ  NEWS")).toBe("ai news");
  });
});

describe("canonicalizeUrl", () => {
  it("tracking parametrelerini ve fragment'i temizleyip query'yi sıralar", () => {
    expect(
      canonicalizeUrl("https://EXAMPLE.com/news/?utm_source=rss&b=2&fbclid=secret&a=1#section"),
    ).toBe("https://example.com/news?a=1&b=2");
  });

  it("güvensiz veya credential içeren URL'leri reddeder", () => {
    expect(canonicalizeUrl("javascript:alert(1)")).toBeNull();
    expect(canonicalizeUrl("https://name:password@example.com")).toBeNull();
    expect(canonicalizeUrl(null)).toBeNull();
  });
});

describe("feed text cleanup", () => {
  it("script/style ve HTML tag'lerini kaldırıp block sınırlarını korur", () => {
    const input =
      "<p>İlk <b>haber</b></p><script>alert(1)</script><style>.x{}</style><div>İkinci</div>";
    expect(stripHtml(input)).toBe("İlk haber İkinci");
  });

  it("named, decimal ve hexadecimal HTML entity'lerini çözer", () => {
    expect(decodeHtmlEntities("A&amp;B &mdash; &#304;stanbul &#x1F642; &unknown;")).toBe(
      "A&B — İstanbul 🙂 &unknown;",
    );
  });

  it("açıklamayı temizler, boşlukları düzenler ve 1500 karaktere sınırlar", () => {
    const result = cleanFeedDescription(`<p>Merhaba&nbsp;dünya &amp; ${"x".repeat(1_600)}</p>`);
    expect(result.startsWith("Merhaba dünya & ")).toBe(true);
    expect([...result]).toHaveLength(1_500);
    expect(cleanFeedDescription(null)).toBe("");
  });

  it("Unicode karakterini ortadan bölmeden özel limite keser", () => {
    expect(cleanFeedDescription("🙂🙂🙂", 2)).toBe("🙂🙂");
  });
});

describe("deduplicateSourceItems", () => {
  it("canonical URL'yi ve URL yoksa normalize title'ı kullanır", () => {
    const items = [
      { id: "1", title: "Bir Haber", url: "https://example.com/news?utm_source=rss" },
      { id: "2", title: "Farklı başlık", url: "https://example.com/news#comments" },
      { id: "3", title: "URL'siz Haber!", url: null },
      { id: "4", title: "  url'siz haber ", url: undefined },
      { id: "5", title: "Bir Haber", url: "https://other.example.com/news" },
    ];

    expect(deduplicateSourceItems(items).map(({ id }) => id)).toEqual(["1", "3", "5"]);
  });

  it("URL'siz kayıt önce gelse de sonradan gelen aynı başlıklı linki eler", () => {
    const items = [
      { id: "1", title: "Aynı başlık", url: null },
      { id: "2", title: "Aynı başlık!", url: "https://example.com/story" },
    ];

    expect(deduplicateSourceItems(items).map(({ id }) => id)).toEqual(["1"]);
  });
});

describe("sortItemsNewestFirst", () => {
  it("geçersiz ve eksik tarihleri sona atıp input'u mutate etmez", () => {
    const items = [
      { id: "old", publishedAt: "2026-07-12T08:00:00Z" },
      { id: "missing", publishedAt: null },
      { id: "new", publishedAt: "2026-07-14T08:00:00Z" },
      { id: "invalid", publishedAt: "not-a-date" },
    ];

    expect(sortItemsNewestFirst(items).map(({ id }) => id)).toEqual([
      "new",
      "old",
      "missing",
      "invalid",
    ]);
    expect(items.map(({ id }) => id)).toEqual(["old", "missing", "new", "invalid"]);
  });
});
