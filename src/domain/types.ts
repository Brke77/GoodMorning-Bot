export type SourceKind = "tech" | "reddit";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type FxPair = "USD/TRY" | "EUR/TRY";

export type FetchLike = typeof globalThis.fetch;

export interface RssSource {
  id: string;
  name: string;
  url: string;
  maxItems: number;
}

export interface LocationConfig {
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface SourceItem {
  id: string;
  kind: SourceKind;
  sourceId: string;
  sourceName: string;
  title: string;
  description: string;
  url: string | null;
  publishedAt: string | null;
}

export interface WeatherData {
  locationName: string;
  temperature: number;
  apparentTemperature: number;
  weatherCode: number;
  windSpeed: number;
  maxTemperature: number;
  minTemperature: number;
  precipitationProbability: number;
  advice: string | null;
}

export interface FxRate {
  pair: FxPair;
  base: "USD" | "EUR";
  quote: "TRY";
  rate: number;
  date: string;
}

export interface FxSnapshot {
  rates: FxRate[];
  missingPairs: FxPair[];
}

export interface ResolvedTechHighlight {
  item: SourceItem;
  summary: string;
  importance: "high" | "medium";
}

export interface ResolvedRedditHighlight {
  item: SourceItem;
  summary: string;
}

export interface AiSummaryResult {
  mode: "ai";
  technologySummary: string;
  techHighlights: ResolvedTechHighlight[];
  redditSummary: string;
  redditHighlights: ResolvedRedditHighlight[];
  dailyTakeaway: string;
}

export interface FallbackSummaryResult {
  mode: "fallback";
  note: string;
  techItems: SourceItem[];
  redditItems: SourceItem[];
}

export type SummaryResult = AiSummaryResult | FallbackSummaryResult;

export interface ReportModel {
  generatedAt: Date;
  weather: WeatherData | null;
  fx: FxSnapshot | null;
  techItemCount: number;
  redditItemCount: number;
  summary: SummaryResult;
}

export interface TelegramSection {
  id: string;
  blocks: string[];
}
