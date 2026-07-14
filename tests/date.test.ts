import { describe, expect, it } from "vitest";

import { formatIstanbulDate, ISTANBUL_TIME_ZONE } from "../src/utils/date.js";

describe("formatIstanbulDate", () => {
  it("tarihi Türkçe ve Europe/Istanbul saat diliminde formatlar", () => {
    expect(ISTANBUL_TIME_ZONE).toBe("Europe/Istanbul");
    expect(formatIstanbulDate(new Date("2026-07-13T05:00:00.000Z"))).toBe(
      "13 Temmuz 2026 Pazartesi",
    );
  });

  it("UTC gün sınırında İstanbul'un yerel gününü kullanır", () => {
    expect(formatIstanbulDate("2026-07-12T22:30:00.000Z")).toBe("13 Temmuz 2026 Pazartesi");
  });

  it("geçersiz tarih için anlaşılır hata verir", () => {
    expect(() => formatIstanbulDate("geçersiz")).toThrowError(
      new RangeError("Geçersiz tarih değeri."),
    );
  });
});
