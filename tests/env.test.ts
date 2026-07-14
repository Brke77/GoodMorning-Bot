import { describe, expect, it } from "vitest";

import { EnvironmentError, loadEnvironment, loadTelegramSetupToken } from "../src/config/env.js";
import {
  DEFAULT_OPENAI_MODEL,
  DEFAULT_REDDIT_USER_AGENT,
  ISTANBUL_LOCATION,
} from "../src/config/sources.js";

describe("loadEnvironment", () => {
  it("allows a CLI dry-run without any secrets", () => {
    const config = loadEnvironment(["--dry-run"], {});

    expect(config).toMatchObject({
      dryRun: true,
      openaiApiKey: undefined,
      telegramBotToken: undefined,
      telegramChatId: undefined,
      openaiModel: DEFAULT_OPENAI_MODEL,
      redditUserAgent: DEFAULT_REDDIT_USER_AGENT,
      logLevel: "info",
    });
  });

  it("treats a blank model as absent and applies the default", () => {
    const config = loadEnvironment(["--dry-run"], { OPENAI_MODEL: "   " });
    expect(config.openaiModel).toBe(DEFAULT_OPENAI_MODEL);
  });

  it("parses DRY_RUN=false as false instead of JavaScript truthiness", () => {
    const config = loadEnvironment([], {
      DRY_RUN: "false",
      TELEGRAM_BOT_TOKEN: "token",
      TELEGRAM_CHAT_ID: "-1001234567890",
    });

    expect(config.dryRun).toBe(false);
    expect(config.telegramChatId).toBe("-1001234567890");
  });

  it("allows DRY_RUN=true from the environment without Telegram credentials", () => {
    const config = loadEnvironment([], { DRY_RUN: "true" });
    expect(config.dryRun).toBe(true);
  });

  it("requires Telegram token and chat ID in send mode", () => {
    expect(() => loadEnvironment([], {})).toThrow(EnvironmentError);
    expect(() => loadEnvironment([], {})).toThrow("TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID");
  });

  it("reports invalid boolean configuration without exposing raw environment values", () => {
    expect(() => loadEnvironment(["--dry-run"], { DRY_RUN: "yes" })).toThrow(
      "Geçersiz environment değişkenleri: DRY_RUN",
    );
  });

  it("uses the required Istanbul timezone configuration", () => {
    expect(ISTANBUL_LOCATION).toMatchObject({
      name: "İstanbul",
      timezone: "Europe/Istanbul",
    });
  });
});

describe("loadTelegramSetupToken", () => {
  it("trims and returns a configured token", () => {
    expect(loadTelegramSetupToken({ TELEGRAM_BOT_TOKEN: "  token-value  " })).toBe("token-value");
  });

  it("rejects a blank setup token", () => {
    expect(() => loadTelegramSetupToken({ TELEGRAM_BOT_TOKEN: "   " })).toThrow(
      "TELEGRAM_BOT_TOKEN bulunamadı",
    );
  });
});
