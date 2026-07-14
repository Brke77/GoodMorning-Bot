import type { EnvironmentConfig } from "./config/env.js";
import type { FetchLike, FxSnapshot, SourceItem, WeatherData } from "./domain/types.js";
import { buildReport } from "./report/build-report.js";
import { createFallbackReport } from "./report/fallback-report.js";
import { renderTelegramReport } from "./report/render-telegram.js";
import { fetchFxSnapshot } from "./services/fx.service.js";
import { summarizeWithOpenAI } from "./services/openai.service.js";
import { fetchRedditItems } from "./services/reddit.service.js";
import { fetchTechnologyItems } from "./services/rss.service.js";
import { sendTelegramChunks } from "./services/telegram.service.js";
import { fetchWeather } from "./services/weather.service.js";
import { logger, safeErrorMessage } from "./utils/logger.js";

export interface RunDependencies {
  fetchFn?: FetchLike;
  now?: () => Date;
}

async function optionalWeather(fetchFn: FetchLike): Promise<WeatherData | null> {
  try {
    return await fetchWeather(fetchFn);
  } catch (error: unknown) {
    logger.warn("weather.fetch.failed", {
      service: "open-meteo",
      reason: safeErrorMessage(error),
    });
    return null;
  }
}

async function optionalFx(fetchFn: FetchLike): Promise<FxSnapshot | null> {
  try {
    return await fetchFxSnapshot(fetchFn);
  } catch (error: unknown) {
    logger.warn("fx.fetch.failed", {
      service: "frankfurter",
      reason: safeErrorMessage(error),
    });
    return null;
  }
}

async function optionalTechItems(
  userAgent: string,
  fetchFn: FetchLike,
  now: Date,
): Promise<SourceItem[]> {
  try {
    return await fetchTechnologyItems(userAgent, fetchFn, now);
  } catch (error: unknown) {
    logger.warn("rss.collection.failed", { reason: safeErrorMessage(error) });
    return [];
  }
}

async function optionalRedditItems(
  userAgent: string,
  fetchFn: FetchLike,
  now: Date,
): Promise<SourceItem[]> {
  try {
    return await fetchRedditItems(userAgent, fetchFn, now);
  } catch (error: unknown) {
    logger.warn("reddit.collection.failed", { reason: safeErrorMessage(error) });
    return [];
  }
}

function printDryRun(chunks: readonly string[]): void {
  chunks.forEach((chunk, index) => {
    console.log(
      `\n--- Telegram parçası ${index + 1}/${chunks.length} (${chunk.length} karakter) ---`,
    );
    console.log(chunk);
  });
}

export async function runMorningBrief(
  environment: EnvironmentConfig,
  dependencies: RunDependencies = {},
): Promise<readonly string[]> {
  const fetchFn = dependencies.fetchFn ?? globalThis.fetch;
  const generatedAt = dependencies.now?.() ?? new Date();

  const [weather, fx, techItems, redditItems] = await Promise.all([
    optionalWeather(fetchFn),
    optionalFx(fetchFn),
    optionalTechItems(environment.redditUserAgent, fetchFn, generatedAt),
    optionalRedditItems(environment.redditUserAgent, fetchFn, generatedAt),
  ]);

  let report;
  if (environment.openaiApiKey && techItems.length + redditItems.length > 0) {
    try {
      const summary = await summarizeWithOpenAI({
        apiKey: environment.openaiApiKey,
        model: environment.openaiModel,
        techItems,
        redditItems,
      });
      report = buildReport({
        generatedAt,
        weather,
        fx,
        techItemCount: techItems.length,
        redditItemCount: redditItems.length,
        summary,
      });
    } catch (error: unknown) {
      logger.warn("openai.summary.fallback", {
        reason: safeErrorMessage(error, { secrets: [environment.openaiApiKey] }),
      });
      report = createFallbackReport({ generatedAt, weather, fx, techItems, redditItems });
    }
  } else {
    logger.warn("openai.summary.fallback", {
      reason: environment.openaiApiKey ? "no_source_items" : "missing_api_key",
    });
    report = createFallbackReport({ generatedAt, weather, fx, techItems, redditItems });
  }

  const chunks = renderTelegramReport(report);
  if (chunks.length === 0) throw new Error("Telegram raporu boş üretildi.");

  if (environment.dryRun) {
    printDryRun(chunks);
    logger.info("morning_brief.dry_run.completed", { chunkCount: chunks.length });
    return chunks;
  }

  if (!environment.telegramBotToken || !environment.telegramChatId) {
    throw new Error("Telegram gönderim bilgileri doğrulama sonrasında kayboldu.");
  }

  await sendTelegramChunks({
    botToken: environment.telegramBotToken,
    chatId: environment.telegramChatId,
    chunks,
    fetchFn,
  });
  logger.info("morning_brief.completed", { chunkCount: chunks.length });
  return chunks;
}
