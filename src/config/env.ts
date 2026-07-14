import dotenv from "dotenv";
import { z } from "zod";

import type { LogLevel } from "../domain/types.js";
import { DEFAULT_OPENAI_MODEL, DEFAULT_REDDIT_USER_AGENT } from "./sources.js";

dotenv.config({ quiet: true });

const emptyToUndefined = (value: unknown): unknown => {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
};

const optionalSecret = z.preprocess(emptyToUndefined, z.string().trim().min(1).optional());

const EnvironmentSchema = z.object({
  OPENAI_API_KEY: optionalSecret,
  OPENAI_MODEL: z.preprocess(
    emptyToUndefined,
    z.string().trim().min(1).default(DEFAULT_OPENAI_MODEL),
  ),
  TELEGRAM_BOT_TOKEN: optionalSecret,
  TELEGRAM_CHAT_ID: optionalSecret,
  LOG_LEVEL: z.preprocess(
    emptyToUndefined,
    z.enum(["debug", "info", "warn", "error"]).default("info"),
  ),
  DRY_RUN: z.preprocess(
    emptyToUndefined,
    z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
  ),
  REDDIT_USER_AGENT: z.preprocess(
    emptyToUndefined,
    z.string().trim().min(3).max(300).default(DEFAULT_REDDIT_USER_AGENT),
  ),
});

export interface EnvironmentConfig {
  dryRun: boolean;
  logLevel: LogLevel;
  openaiApiKey: string | undefined;
  openaiModel: string;
  telegramBotToken: string | undefined;
  telegramChatId: string | undefined;
  redditUserAgent: string;
}

export class EnvironmentError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "EnvironmentError";
  }
}

export function loadEnvironment(
  argv: readonly string[] = process.argv.slice(2),
  rawEnvironment: NodeJS.ProcessEnv = process.env,
): EnvironmentConfig {
  const parsed = EnvironmentSchema.safeParse(rawEnvironment);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))];
    throw new EnvironmentError(`Geçersiz environment değişkenleri: ${fields.join(", ")}`);
  }

  const dryRun = argv.includes("--dry-run") || parsed.data.DRY_RUN;
  if (!dryRun) {
    const missing: string[] = [];
    if (!parsed.data.TELEGRAM_BOT_TOKEN) missing.push("TELEGRAM_BOT_TOKEN");
    if (!parsed.data.TELEGRAM_CHAT_ID) missing.push("TELEGRAM_CHAT_ID");

    if (missing.length > 0) {
      throw new EnvironmentError(`Gerçek gönderim için eksik değişkenler: ${missing.join(", ")}`);
    }
  }

  return {
    dryRun,
    logLevel: parsed.data.LOG_LEVEL,
    openaiApiKey: parsed.data.OPENAI_API_KEY,
    openaiModel: parsed.data.OPENAI_MODEL,
    telegramBotToken: parsed.data.TELEGRAM_BOT_TOKEN,
    telegramChatId: parsed.data.TELEGRAM_CHAT_ID,
    redditUserAgent: parsed.data.REDDIT_USER_AGENT,
  };
}

export function loadTelegramSetupToken(rawEnvironment: NodeJS.ProcessEnv = process.env): string {
  const token = optionalSecret.safeParse(rawEnvironment.TELEGRAM_BOT_TOKEN);
  if (!token.success || !token.data) {
    throw new EnvironmentError(
      "TELEGRAM_BOT_TOKEN bulunamadı. Önce .env dosyasına bot token'ını ekleyin.",
    );
  }

  return token.data;
}
