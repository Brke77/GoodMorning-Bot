export type FetchInput = string | URL | Request;

export type FetchFn = (input: FetchInput, init?: RequestInit) => Promise<Response>;

export type SleepFn = (delayMs: number, signal?: AbortSignal) => Promise<void>;

export interface FetchRetryOptions {
  fetchFn?: FetchFn;
  sleep?: SleepFn;
  random?: () => number;
  timeoutMs?: number;
  maxAttempts?: number;
  maxRetryAfterMs?: number;
  baseDelayMs?: number;
  jitterRatio?: number;
}

export type FetchFailureKind = "network" | "timeout";

export const DEFAULT_FETCH_TIMEOUT_MS = 12_000;
export const DEFAULT_FETCH_MAX_ATTEMPTS = 3;
export const DEFAULT_MAX_RETRY_AFTER_MS = 30_000;
export const DEFAULT_RETRY_BASE_DELAY_MS = 500;
export const DEFAULT_RETRY_JITTER_RATIO = 0.2;

const MAX_TIMER_DELAY_MS = 2_147_483_647;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

export class FetchRetryError extends Error {
  readonly attempts: number;
  readonly kind: FetchFailureKind;

  constructor(kind: FetchFailureKind, attempts: number, cause: unknown) {
    const message =
      kind === "timeout"
        ? `Request timed out after ${attempts} attempts`
        : `Network request failed after ${attempts} attempts`;

    super(message, { cause });
    this.name = "FetchRetryError";
    this.attempts = attempts;
    this.kind = kind;
  }
}

class AttemptTimeoutError extends Error {
  constructor() {
    super("Request attempt timed out");
    this.name = "AttemptTimeoutError";
  }
}

interface AttemptSignal {
  readonly signal: AbortSignal;
  readonly didTimeout: () => boolean;
  readonly cleanup: () => void;
}

interface ResolvedRetryOptions {
  readonly fetchFn: FetchFn;
  readonly sleep: SleepFn;
  readonly random: () => number;
  readonly timeoutMs: number;
  readonly maxAttempts: number;
  readonly maxRetryAfterMs: number;
  readonly baseDelayMs: number;
  readonly jitterRatio: number;
}

function defaultFetch(input: FetchInput, init?: RequestInit): Promise<Response> {
  return globalThis.fetch(input, init);
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException("The operation was aborted", "AbortError");
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw abortReason(signal);
  }
}

function defaultSleep(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (delayMs <= 0) {
    throwIfAborted(signal);
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortReason(signal));
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(
        signal ? abortReason(signal) : new DOMException("The operation was aborted", "AbortError"),
      );
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function createAttemptSignal(
  callerSignal: AbortSignal | undefined,
  timeoutMs: number,
): AttemptSignal {
  const controller = new AbortController();
  let timedOut = false;

  const onCallerAbort = (): void => {
    controller.abort(callerSignal ? abortReason(callerSignal) : undefined);
  };

  callerSignal?.addEventListener("abort", onCallerAbort, { once: true });

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new DOMException("The operation timed out", "TimeoutError"));
  }, timeoutMs);
  timer.unref();

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      clearTimeout(timer);
      callerSignal?.removeEventListener("abort", onCallerAbort);
    },
  };
}

function requireIntegerInRange(
  name: string,
  value: number,
  minimum: number,
  maximum: number,
): void {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
}

function requireFiniteInRange(name: string, value: number, minimum: number, maximum: number): void {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError(`${name} must be between ${minimum} and ${maximum}`);
  }
}

function resolveOptions(options: FetchRetryOptions): ResolvedRetryOptions {
  const resolved: ResolvedRetryOptions = {
    fetchFn: options.fetchFn ?? defaultFetch,
    sleep: options.sleep ?? defaultSleep,
    random: options.random ?? Math.random,
    timeoutMs: options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS,
    maxAttempts: options.maxAttempts ?? DEFAULT_FETCH_MAX_ATTEMPTS,
    maxRetryAfterMs: options.maxRetryAfterMs ?? DEFAULT_MAX_RETRY_AFTER_MS,
    baseDelayMs: options.baseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS,
    jitterRatio: options.jitterRatio ?? DEFAULT_RETRY_JITTER_RATIO,
  };

  requireIntegerInRange("timeoutMs", resolved.timeoutMs, 1, MAX_TIMER_DELAY_MS);
  requireIntegerInRange("maxAttempts", resolved.maxAttempts, 1, 100);
  requireIntegerInRange("maxRetryAfterMs", resolved.maxRetryAfterMs, 0, MAX_TIMER_DELAY_MS);
  requireIntegerInRange("baseDelayMs", resolved.baseDelayMs, 0, MAX_TIMER_DELAY_MS);
  requireFiniteInRange("jitterRatio", resolved.jitterRatio, 0, 1);

  return resolved;
}

function normalizedRandom(random: () => number): number {
  const value = random();
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.5;
}

function exponentialDelayMs(attempt: number, options: ResolvedRetryOptions): number {
  const exponential = options.baseDelayMs * 2 ** (attempt - 1);
  const jitterFactor =
    1 - options.jitterRatio + 2 * options.jitterRatio * normalizedRandom(options.random);

  return Math.min(options.maxRetryAfterMs, Math.max(0, Math.round(exponential * jitterFactor)));
}

export function parseRetryAfterMs(
  value: string | null,
  maxRetryAfterMs = DEFAULT_MAX_RETRY_AFTER_MS,
  nowMs = Date.now(),
): number | null {
  if (value === null) {
    return null;
  }

  requireIntegerInRange("maxRetryAfterMs", maxRetryAfterMs, 0, MAX_TIMER_DELAY_MS);

  const trimmed = value.trim();
  if (/^\d+(?:\.\d+)?$/u.test(trimmed)) {
    const seconds = Number(trimmed);
    if (!Number.isFinite(seconds)) {
      return null;
    }

    return Math.min(maxRetryAfterMs, Math.max(0, Math.round(seconds * 1_000)));
  }

  const retryAtMs = Date.parse(trimmed);
  if (!Number.isFinite(retryAtMs)) {
    return null;
  }

  return Math.min(maxRetryAfterMs, Math.max(0, retryAtMs - nowMs));
}

async function cancelResponseBody(response: Response): Promise<void> {
  if (!response.body || response.body.locked) {
    return;
  }

  try {
    await response.body.cancel();
  } catch {
    // Cancellation is best-effort and must not hide the original retry reason.
  }
}

function callerSignalFor(input: FetchInput, init: RequestInit): AbortSignal | undefined {
  if (init.signal) {
    return init.signal;
  }

  return input instanceof Request ? input.signal : undefined;
}

function retryDelayMs(
  response: Response | undefined,
  attempt: number,
  options: ResolvedRetryOptions,
): number {
  const backoffMs = exponentialDelayMs(attempt, options);
  const retryAfterMs = response
    ? parseRetryAfterMs(response.headers.get("retry-after"), options.maxRetryAfterMs)
    : null;

  return Math.min(options.maxRetryAfterMs, Math.max(backoffMs, retryAfterMs ?? 0));
}

/**
 * Fetches an HTTP resource with bounded, per-attempt timeouts and retries.
 *
 * HTTP responses are returned to the caller, including the final retryable
 * response and non-retryable 4xx responses. Rejected fetches are wrapped only
 * after all attempts are exhausted. This helper never logs the request input,
 * because it can contain credentials in a URL or headers.
 */
export async function fetchWithRetry(
  input: FetchInput,
  init: RequestInit = {},
  retryOptions: FetchRetryOptions = {},
): Promise<Response> {
  const options = resolveOptions(retryOptions);
  const callerSignal = callerSignalFor(input, init);

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    throwIfAborted(callerSignal);

    const attemptSignal = createAttemptSignal(callerSignal, options.timeoutMs);
    let delayMs: number | undefined;

    try {
      const response = await options.fetchFn(input, { ...init, signal: attemptSignal.signal });

      if (callerSignal?.aborted) {
        await cancelResponseBody(response);
        throw abortReason(callerSignal);
      }

      if (attemptSignal.didTimeout()) {
        await cancelResponseBody(response);
        throw new AttemptTimeoutError();
      }

      if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt === options.maxAttempts) {
        return response;
      }

      delayMs = retryDelayMs(response, attempt, options);
      await cancelResponseBody(response);
    } catch (error: unknown) {
      if (callerSignal?.aborted) {
        throw abortReason(callerSignal);
      }

      const failureKind: FetchFailureKind =
        attemptSignal.didTimeout() || error instanceof AttemptTimeoutError ? "timeout" : "network";

      if (attempt === options.maxAttempts) {
        throw new FetchRetryError(failureKind, attempt, error);
      }

      delayMs = retryDelayMs(undefined, attempt, options);
    } finally {
      attemptSignal.cleanup();
    }

    await options.sleep(delayMs, callerSignal);
    throwIfAborted(callerSignal);
  }

  throw new FetchRetryError(
    "network",
    options.maxAttempts,
    new Error("Retry loop ended unexpectedly"),
  );
}
