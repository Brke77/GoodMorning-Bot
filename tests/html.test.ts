import { describe, expect, it } from "vitest";

import { escapeHtml, escapeHtmlAttribute, safeHttpUrl } from "../src/utils/html.js";

describe("escapeHtml", () => {
  it("Telegram HTML metnindeki özel karakterleri kaçırır", () => {
    expect(escapeHtml('OpenAI <test> & "news"')).toBe('OpenAI &lt;test&gt; &amp; "news"');
  });

  it("önceden kaçırılmış içeriği güvenli biçimde tekrar kaçırır", () => {
    expect(escapeHtml("&lt;b&gt;")).toBe("&amp;lt;b&amp;gt;");
  });
});

describe("escapeHtmlAttribute", () => {
  it("tırnaklar dahil attribute karakterlerini kaçırır", () => {
    expect(escapeHtmlAttribute(`https://example.com/?a=1&b="x"'`)).toBe(
      "https://example.com/?a=1&amp;b=&quot;x&quot;&#39;",
    );
  });
});

describe("safeHttpUrl", () => {
  it("HTTP ve HTTPS URL'lerini normalize eder", () => {
    expect(safeHttpUrl("  https://EXAMPLE.com/path?q=hello world  ")).toBe(
      "https://example.com/path?q=hello%20world",
    );
    expect(safeHttpUrl("http://example.com")).toBe("http://example.com/");
  });

  it.each(["javascript:alert(1)", "data:text/html,test", "ftp://example.com/file"])(
    "güvensiz protokolü reddeder: %s",
    (url) => {
      expect(safeHttpUrl(url)).toBeNull();
    },
  );

  it("credential, kontrol karakteri ve aşırı uzun URL'leri reddeder", () => {
    expect(safeHttpUrl("https://user:secret@example.com/path")).toBeNull();
    expect(safeHttpUrl("https://example.com/path\nnext")).toBeNull();
    expect(safeHttpUrl(`https://example.com/${"a".repeat(2_100)}`)).toBeNull();
  });

  it("geçersiz uzunluk ayarını reddeder", () => {
    expect(safeHttpUrl("https://example.com", 0)).toBeNull();
    expect(safeHttpUrl("https://example.com", 1.5)).toBeNull();
  });
});
