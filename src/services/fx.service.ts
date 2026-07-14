import { FrankfurterRatesSchema } from "../domain/schemas.js";
import type { FetchLike, FxPair, FxRate, FxSnapshot } from "../domain/types.js";
import { fetchWithRetry } from "../utils/fetch-with-retry.js";
import { logger, safeErrorMessage } from "../utils/logger.js";

export interface PairConfig {
  pair: FxPair;
  base: "USD" | "EUR";
  quote: "TRY";
}

const PAIRS: readonly PairConfig[] = [
  { pair: "USD/TRY", base: "USD", quote: "TRY" },
  { pair: "EUR/TRY", base: "EUR", quote: "TRY" },
];

export function mapFrankfurterRate(payload: unknown, config: PairConfig): FxRate {
  const rates = FrankfurterRatesSchema.parse(payload);
  const match = rates.find(
    (rate) => rate.base.toUpperCase() === config.base && rate.quote.toUpperCase() === config.quote,
  );
  if (!match) throw new Error(`${config.pair} için beklenen Frankfurter v2 kaydı bulunamadı.`);

  return {
    pair: config.pair,
    base: config.base,
    quote: config.quote,
    rate: match.rate,
    date: match.date,
  };
}

export function formatFxRate(rate: number): string {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(rate);
}

async function fetchPair(config: PairConfig, fetchFn: FetchLike): Promise<FxRate> {
  const parameters = new URLSearchParams({ base: config.base, quotes: config.quote });
  const response = await fetchWithRetry(
    `https://api.frankfurter.dev/v2/rates?${parameters.toString()}`,
    undefined,
    { fetchFn },
  );
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Frankfurter HTTP ${response.status}`);
  }
  const payload: unknown = await response.json();
  return mapFrankfurterRate(payload, config);
}

export async function fetchFxSnapshot(
  fetchFn: FetchLike = globalThis.fetch,
): Promise<FxSnapshot | null> {
  logger.info("fx.fetch.start");
  const settled = await Promise.allSettled(PAIRS.map((config) => fetchPair(config, fetchFn)));
  const rates: FxRate[] = [];
  const missingPairs: FxPair[] = [];

  settled.forEach((result, index) => {
    const pair = PAIRS[index];
    if (!pair) return;
    if (result.status === "fulfilled") {
      rates.push(result.value);
      logger.info("fx.pair.success", { pair: pair.pair, date: result.value.date });
    } else {
      missingPairs.push(pair.pair);
      logger.warn("fx.pair.failed", {
        pair: pair.pair,
        error: safeErrorMessage(result.reason),
      });
    }
  });

  if (rates.length === 0) return null;
  if (new Set(rates.map((rate) => rate.date)).size > 1) {
    logger.warn("fx.source_dates.differ", { dates: rates.map((rate) => rate.date).join(",") });
  }
  logger.info("fx.fetch.success", { rateCount: rates.length });
  return { rates, missingPairs };
}
