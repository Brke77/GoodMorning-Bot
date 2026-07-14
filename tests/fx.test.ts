import { describe, expect, it } from "vitest";

import type { FetchLike } from "../src/domain/types.js";
import { fetchFxSnapshot, formatFxRate, mapFrankfurterRate } from "../src/services/fx.service.js";

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Frankfurter v2 parsing", () => {
  it("parses the v2 array shape and finds the requested pair rather than assuming index zero", () => {
    const rate = mapFrankfurterRate(
      [
        { date: "2026-07-13", base: "USD", quote: "EUR", rate: 0.86 },
        { date: "2026-07-14", base: "USD", quote: "TRY", rate: 40.12345 },
      ],
      { pair: "USD/TRY", base: "USD", quote: "TRY" },
    );

    expect(rate).toEqual({
      pair: "USD/TRY",
      base: "USD",
      quote: "TRY",
      rate: 40.12345,
      date: "2026-07-14",
    });
  });

  it("rejects the obsolete v1 object shape", () => {
    expect(() =>
      mapFrankfurterRate(
        { base: "USD", date: "2026-07-14", rates: { TRY: 40.12 } },
        { pair: "USD/TRY", base: "USD", quote: "TRY" },
      ),
    ).toThrow();
  });

  it("formats rates with Turkish decimals and at most four fraction digits", () => {
    expect(formatFxRate(41.23456)).toBe("41,2346");
    expect(formatFxRate(41)).toBe("41,00");
  });
});

describe("fetchFxSnapshot", () => {
  it("maps USD/TRY and EUR/TRY independently and preserves their source dates", async () => {
    const fetchFn: FetchLike = async (input) => {
      const url = new URL(String(input));
      const base = url.searchParams.get("base");

      return base === "USD"
        ? jsonResponse([{ date: "2026-07-14", base: "USD", quote: "TRY", rate: 40.1 }])
        : jsonResponse([{ date: "2026-07-13", base: "EUR", quote: "TRY", rate: 47.2 }]);
    };

    const snapshot = await fetchFxSnapshot(fetchFn);

    expect(snapshot).not.toBeNull();
    expect(snapshot?.missingPairs).toEqual([]);
    expect(snapshot?.rates).toEqual([
      { pair: "USD/TRY", base: "USD", quote: "TRY", rate: 40.1, date: "2026-07-14" },
      { pair: "EUR/TRY", base: "EUR", quote: "TRY", rate: 47.2, date: "2026-07-13" },
    ]);
  });

  it("returns a partial snapshot when one pair has an invalid payload", async () => {
    const fetchFn: FetchLike = async (input) => {
      const base = new URL(String(input)).searchParams.get("base");
      return base === "USD"
        ? jsonResponse([{ date: "2026-07-14", base: "USD", quote: "TRY", rate: 40.1 }])
        : jsonResponse({ invalid: true });
    };

    const snapshot = await fetchFxSnapshot(fetchFn);

    expect(snapshot?.rates).toEqual([
      { pair: "USD/TRY", base: "USD", quote: "TRY", rate: 40.1, date: "2026-07-14" },
    ]);
    expect(snapshot?.missingPairs).toEqual(["EUR/TRY"]);
  });

  it("returns null when neither requested pair can be parsed", async () => {
    const fetchFn: FetchLike = async () => jsonResponse({ invalid: true });

    await expect(fetchFxSnapshot(fetchFn)).resolves.toBeNull();
  });
});
