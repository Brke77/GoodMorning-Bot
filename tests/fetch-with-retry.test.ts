import { describe, expect, it, vi } from "vitest";

import {
  FetchRetryError,
  fetchWithRetry,
  type FetchFn,
  type SleepFn,
} from "../src/utils/fetch-with-retry.js";

const noJitter = (): number => 0.5;

function makeSleepRecorder(): { readonly delays: number[]; readonly sleep: SleepFn } {
  const delays: number[] = [];
  return {
    delays,
    sleep: async (delayMs) => {
      delays.push(delayMs);
    },
  };
}

describe("fetchWithRetry", () => {
  it("returns a successful response without retrying", async () => {
    const fetchFn = vi.fn<FetchFn>().mockResolvedValue(new Response("ok", { status: 200 }));
    const { delays, sleep } = makeSleepRecorder();

    const response = await fetchWithRetry(
      "https://example.test/feed",
      {},
      { fetchFn, sleep, random: noJitter },
    );

    expect(response.status).toBe(200);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(delays).toEqual([]);
  });

  it.each([429, 500, 502, 503, 504])("retries HTTP %i", async (status) => {
    const fetchFn = vi
      .fn<FetchFn>()
      .mockResolvedValueOnce(new Response(null, { status }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const { delays, sleep } = makeSleepRecorder();

    const response = await fetchWithRetry(
      "https://example.test/feed",
      {},
      { fetchFn, sleep, random: noJitter },
    );

    expect(response.status).toBe(200);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(delays).toEqual([500]);
  });

  it.each([400, 401, 403, 404])("does not retry HTTP %i", async (status) => {
    const fetchFn = vi.fn<FetchFn>().mockResolvedValue(new Response(null, { status }));
    const { delays, sleep } = makeSleepRecorder();

    const response = await fetchWithRetry(
      "https://example.test/feed",
      {},
      { fetchFn, sleep, random: noJitter },
    );

    expect(response.status).toBe(status);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(delays).toEqual([]);
  });

  it("uses exactly three total attempts for persistent network failures", async () => {
    const fetchFn = vi.fn<FetchFn>().mockRejectedValue(new TypeError("socket unavailable"));
    const { delays, sleep } = makeSleepRecorder();

    await expect(
      fetchWithRetry("https://example.test/feed", {}, { fetchFn, sleep, random: noJitter }),
    ).rejects.toMatchObject({
      name: "FetchRetryError",
      kind: "network",
      attempts: 3,
    });

    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(delays).toEqual([500, 1_000]);
  });

  it("returns the final retryable HTTP response after three attempts", async () => {
    const fetchFn = vi
      .fn<FetchFn>()
      .mockImplementation(async () => new Response(null, { status: 503 }));
    const { delays, sleep } = makeSleepRecorder();

    const response = await fetchWithRetry(
      "https://example.test/feed",
      {},
      { fetchFn, sleep, random: noJitter },
    );

    expect(response.status).toBe(503);
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(delays).toEqual([500, 1_000]);
  });

  it("honors Retry-After seconds and caps the delay", async () => {
    const fetchFn = vi
      .fn<FetchFn>()
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { "Retry-After": "120" } }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const { delays, sleep } = makeSleepRecorder();

    await fetchWithRetry(
      "https://example.test/feed",
      {},
      { fetchFn, sleep, random: noJitter, maxRetryAfterMs: 3_000 },
    );

    expect(delays).toEqual([3_000]);
  });

  it("honors an HTTP-date Retry-After value and caps the delay", async () => {
    const retryAt = new Date(Date.now() + 60_000).toUTCString();
    const fetchFn = vi
      .fn<FetchFn>()
      .mockResolvedValueOnce(
        new Response(null, { status: 503, headers: { "Retry-After": retryAt } }),
      )
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const { delays, sleep } = makeSleepRecorder();

    await fetchWithRetry(
      "https://example.test/feed",
      {},
      { fetchFn, sleep, random: noJitter, maxRetryAfterMs: 2_000 },
    );

    expect(delays).toEqual([2_000]);
  });

  it("cancels a retryable response body before the next attempt", async () => {
    let bodyCancelled = false;
    const body = new ReadableStream({
      cancel: () => {
        bodyCancelled = true;
      },
    });
    const fetchFn = vi
      .fn<FetchFn>()
      .mockResolvedValueOnce(new Response(body, { status: 503 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    await fetchWithRetry(
      "https://example.test/feed",
      {},
      { fetchFn, sleep: async () => undefined, random: noJitter },
    );

    expect(bodyCancelled).toBe(true);
  });

  it("retries per-attempt timeouts and reports timeout exhaustion", async () => {
    const fetchFn = vi.fn<FetchFn>().mockImplementation(
      async (_input, init) =>
        await new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) {
            reject(new Error("missing abort signal"));
            return;
          }

          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        }),
    );
    const { delays, sleep } = makeSleepRecorder();

    const result = fetchWithRetry(
      "https://example.test/feed",
      {},
      { fetchFn, sleep, random: noJitter, timeoutMs: 5, maxAttempts: 2 },
    );

    await expect(result).rejects.toBeInstanceOf(FetchRetryError);
    await expect(result).rejects.toMatchObject({ kind: "timeout", attempts: 2 });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(delays).toEqual([500]);
  });

  it("does not call fetch or retry when the caller signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort(new DOMException("cancelled", "AbortError"));
    const fetchFn = vi.fn<FetchFn>();
    const { delays, sleep } = makeSleepRecorder();

    await expect(
      fetchWithRetry(
        "https://example.test/feed",
        { signal: controller.signal },
        { fetchFn, sleep, random: noJitter },
      ),
    ).rejects.toMatchObject({ name: "AbortError" });

    expect(fetchFn).not.toHaveBeenCalled();
    expect(delays).toEqual([]);
  });
});
