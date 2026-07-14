import { describe, expect, it } from "vitest";

import type { AiSummaryResult, SourceItem, WeatherData } from "../src/domain/types.js";
import { buildReport } from "../src/report/build-report.js";
import {
  FALLBACK_NOTE,
  createFallbackReport,
  createFallbackSummary,
} from "../src/report/fallback-report.js";

function item(id: string, kind: "tech" | "reddit", publishedAt: string | null): SourceItem {
  return {
    id,
    kind,
    sourceId: `${kind}-source`,
    sourceName: kind === "tech" ? "Tech Source" : "r/testing",
    title: `Title ${id}`,
    description: "Description",
    url: `https://example.test/${id}`,
    publishedAt,
  };
}

const weather: WeatherData = {
  locationName: "İstanbul",
  temperature: 24,
  apparentTemperature: 25,
  weatherCode: 1,
  windSpeed: 10,
  maxTemperature: 29,
  minTemperature: 20,
  precipitationProbability: 20,
  advice: null,
};

describe("createFallbackSummary", () => {
  it("selects the newest five tech and newest three Reddit items deterministically", () => {
    const techItems = [
      item("tech-null", "tech", null),
      ...Array.from({ length: 6 }, (_, index) =>
        item(
          `tech-${index + 1}`,
          "tech",
          `2026-07-${String(index + 1).padStart(2, "0")}T08:00:00.000Z`,
        ),
      ),
    ];
    const redditItems = [
      item("reddit-null", "reddit", null),
      item("reddit-1", "reddit", "2026-07-01T08:00:00.000Z"),
      item("reddit-3", "reddit", "2026-07-03T08:00:00.000Z"),
      item("reddit-2", "reddit", "2026-07-02T08:00:00.000Z"),
    ];

    const summary = createFallbackSummary(techItems, redditItems);

    expect(summary.note).toBe(FALLBACK_NOTE);
    expect(summary.techItems.map(({ id }) => id)).toEqual([
      "tech-6",
      "tech-5",
      "tech-4",
      "tech-3",
      "tech-2",
    ]);
    expect(summary.redditItems.map(({ id }) => id)).toEqual(["reddit-3", "reddit-2", "reddit-1"]);
  });
});

describe("report builders", () => {
  it("keeps original source counts while fallback highlights remain capped", () => {
    const techItems = Array.from({ length: 7 }, (_, index) =>
      item(`tech-${index}`, "tech", `2026-07-${String(index + 1).padStart(2, "0")}T00:00:00Z`),
    );
    const redditItems = Array.from({ length: 4 }, (_, index) =>
      item(`reddit-${index}`, "reddit", `2026-07-${String(index + 1).padStart(2, "0")}T00:00:00Z`),
    );

    const report = createFallbackReport({
      generatedAt: new Date("2026-07-14T05:00:00.000Z"),
      weather,
      fx: null,
      techItems,
      redditItems,
    });

    expect(report.techItemCount).toBe(7);
    expect(report.redditItemCount).toBe(4);
    expect(report.summary.mode).toBe("fallback");
    if (report.summary.mode === "fallback") {
      expect(report.summary.techItems).toHaveLength(5);
      expect(report.summary.redditItems).toHaveLength(3);
    }
  });

  it("builds an AI report without inventing unavailable weather or FX data", () => {
    const summary: AiSummaryResult = {
      mode: "ai",
      technologySummary: "Özet",
      techHighlights: [],
      redditSummary: "Reddit",
      redditHighlights: [],
      dailyTakeaway: "Ana fikir",
    };

    const report = buildReport({
      generatedAt: new Date("2026-07-14T05:00:00.000Z"),
      weather: null,
      fx: null,
      techItemCount: 0,
      redditItemCount: 0,
      summary,
    });

    expect(report).toMatchObject({
      weather: null,
      fx: null,
      techItemCount: 0,
      redditItemCount: 0,
      summary,
    });
  });
});
