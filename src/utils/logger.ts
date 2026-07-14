import type { LogLevel } from "../domain/types.js";

export type LogScalar = string | number | boolean | null;

export type LogContextKey =
  | "action"
  | "attempt"
  | "base"
  | "category"
  | "chatType"
  | "chunkCount"
  | "chunkIndex"
  | "code"
  | "count"
  | "date"
  | "dates"
  | "droppedCount"
  | "dryRun"
  | "durationMs"
  | "error"
  | "fallback"
  | "itemCount"
  | "itemId"
  | "kind"
  | "location"
  | "maxAttempts"
  | "method"
  | "mode"
  | "model"
  | "outcome"
  | "pair"
  | "quote"
  | "rateCount"
  | "reason"
  | "redditHighlightCount"
  | "retryAfterMs"
  | "service"
  | "source"
  | "sourceId"
  | "sourceKind"
  | "status"
  | "statusCode"
  | "successCount"
  | "techHighlightCount"
  | "totalCount";

export type LogContext = Readonly<Partial<Record<LogContextKey, LogScalar>>>;

export interface Logger {
  debug(event: string, context?: LogContext): void;
  info(event: string, context?: LogContext): void;
  warn(event: string, context?: LogContext): void;
  error(event: string, context?: LogContext): void;
}

export interface LoggerConfiguration {
  level?: LogLevel;
  secrets?: readonly (string | undefined | null)[];
  write?: (line: string, level: LogLevel) => void;
  now?: () => Date;
}

export interface SafeErrorMessageOptions {
  secrets?: readonly (string | undefined | null)[];
  maxLength?: number;
}

const LEVEL_PRIORITY: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const LOG_CONTEXT_KEYS: readonly LogContextKey[] = [
  "action",
  "attempt",
  "base",
  "category",
  "chatType",
  "chunkCount",
  "chunkIndex",
  "code",
  "count",
  "date",
  "dates",
  "droppedCount",
  "dryRun",
  "durationMs",
  "error",
  "fallback",
  "itemCount",
  "itemId",
  "kind",
  "location",
  "maxAttempts",
  "method",
  "mode",
  "model",
  "outcome",
  "pair",
  "quote",
  "rateCount",
  "reason",
  "redditHighlightCount",
  "retryAfterMs",
  "service",
  "source",
  "sourceId",
  "sourceKind",
  "status",
  "statusCode",
  "successCount",
  "techHighlightCount",
  "totalCount",
];

const MAX_CONTEXT_LENGTH = 320;
const EVENT_PATTERN = /^[a-z][a-z0-9_.-]{0,79}$/u;

const defaultWrite = (line: string, level: LogLevel): void => {
  if (level === "warn" || level === "error") console.error(line);
  else console.log(line);
};

interface ActiveConfiguration {
  level: LogLevel;
  secrets: readonly string[];
  write: (line: string, level: LogLevel) => void;
  now: () => Date;
}

let active: ActiveConfiguration = {
  level: "info",
  secrets: [],
  write: defaultWrite,
  now: () => new Date(),
};

function normalizeSecrets(values: readonly (string | undefined | null)[]): string[] {
  return values
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .sort((left, right) => right.length - left.length);
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${[...value].slice(0, Math.max(0, maxLength - 1)).join("")}…`;
}

function redact(value: string, secrets: readonly string[]): string {
  let result = value;
  for (const secret of secrets) result = result.split(secret).join("[REDACTED]");

  return result
    .replace(/\bBearer\s+[^\s,;]+/giu, "Bearer [REDACTED]")
    .replace(/\bsk-[a-z0-9_-]{10,}\b/giu, "[REDACTED]")
    .replace(/\b\d{6,}:[a-z0-9_-]{20,}\b/giu, "[REDACTED]")
    .replace(/\b(?:https?|ftp):\/\/[^\s<>"']+/giu, "[REDACTED_URL]");
}

function safeText(value: string, secrets: readonly string[], maxLength: number): string {
  const clean = redact(value, secrets)
    .replace(/[\u0000-\u001f\u007f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  return truncate(clean || "Unknown error", maxLength);
}

export function safeErrorMessage(error: unknown, options: SafeErrorMessageOptions = {}): string {
  const message =
    typeof error === "string" ? error : error instanceof Error ? error.message : "Unknown error";
  const requested = options.maxLength ?? MAX_CONTEXT_LENGTH;
  const maxLength = Number.isInteger(requested) ? Math.min(2_000, Math.max(32, requested)) : 320;
  return safeText(message, normalizeSecrets(options.secrets ?? []), maxLength);
}

function sanitizeContext(context: LogContext | undefined): Record<string, LogScalar> {
  if (!context) return {};

  const result: Record<string, LogScalar> = {};
  for (const key of LOG_CONTEXT_KEYS) {
    const value = context[key];
    if (typeof value === "string")
      result[key] = safeText(value, active.secrets, MAX_CONTEXT_LENGTH);
    else if (typeof value === "number" && Number.isFinite(value)) result[key] = value;
    else if (typeof value === "boolean" || value === null) result[key] = value;
  }
  return result;
}

function emit(level: LogLevel, event: string, context?: LogContext): void {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[active.level]) return;

  const entry = {
    timestamp: active.now().toISOString(),
    level,
    event: EVENT_PATTERN.test(event) ? event : "log.invalid_event",
    ...sanitizeContext(context),
  };
  try {
    active.write(JSON.stringify(entry), level);
  } catch {
    // Logging must never stop the briefing pipeline.
  }
}

export const logger: Logger = {
  debug: (event, context) => emit("debug", event, context),
  info: (event, context) => emit("info", event, context),
  warn: (event, context) => emit("warn", event, context),
  error: (event, context) => emit("error", event, context),
};

export function configureLogger(configuration: LoggerConfiguration = {}): Logger {
  active = {
    level: configuration.level ?? "info",
    secrets: normalizeSecrets(configuration.secrets ?? []),
    write: configuration.write ?? defaultWrite,
    now: configuration.now ?? (() => new Date()),
  };
  return logger;
}
