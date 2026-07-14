import type {
  FallbackSummaryResult,
  FxSnapshot,
  ReportModel,
  SourceItem,
  WeatherData,
} from "../domain/types.js";
import { sortItemsNewestFirst } from "../utils/normalize.js";

export const FALLBACK_NOTE = "ℹ️ AI özeti bugün oluşturulamadı; kaynak başlıkları gösteriliyor.";

export function createFallbackSummary(
  techItems: readonly SourceItem[],
  redditItems: readonly SourceItem[],
): FallbackSummaryResult {
  return {
    mode: "fallback",
    note: FALLBACK_NOTE,
    techItems: sortItemsNewestFirst(techItems).slice(0, 5),
    redditItems: sortItemsNewestFirst(redditItems).slice(0, 3),
  };
}

export interface CreateFallbackReportOptions {
  generatedAt: Date;
  weather: WeatherData | null;
  fx: FxSnapshot | null;
  techItems: readonly SourceItem[];
  redditItems: readonly SourceItem[];
}

export function createFallbackReport(options: CreateFallbackReportOptions): ReportModel {
  return {
    generatedAt: options.generatedAt,
    weather: options.weather,
    fx: options.fx,
    techItemCount: options.techItems.length,
    redditItemCount: options.redditItems.length,
    summary: createFallbackSummary(options.techItems, options.redditItems),
  };
}
