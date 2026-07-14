import type { AiSummaryResult, FxSnapshot, ReportModel, WeatherData } from "../domain/types.js";

export interface BuildReportOptions {
  generatedAt: Date;
  weather: WeatherData | null;
  fx: FxSnapshot | null;
  techItemCount: number;
  redditItemCount: number;
  summary: AiSummaryResult;
}

export function buildReport(options: BuildReportOptions): ReportModel {
  return {
    generatedAt: options.generatedAt,
    weather: options.weather,
    fx: options.fx,
    techItemCount: options.techItemCount,
    redditItemCount: options.redditItemCount,
    summary: options.summary,
  };
}
