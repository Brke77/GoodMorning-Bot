import { describe, expect, it, vi } from "vitest";

import type { FetchLike } from "../src/domain/types.js";
import { TelegramSendError, sendTelegramChunks } from "../src/services/telegram.service.js";

type FakeFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

function telegramResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("sendTelegramChunks", () => {
  it("sends the exact safe Bot API payload", async () => {
    const fetchMock = vi.fn<FakeFetch>().mockResolvedValue(telegramResponse({ ok: true }));

    await sendTelegramChunks({
      botToken: "123456:test-token-value-abcdefghijklmnopqrstuvwxyz",
      chatId: "-1001234567890",
      chunks: ["<b>Günaydın</b>"],
      fetchFn: fetchMock as FetchLike,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain("/sendMessage");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(String(init?.body))).toEqual({
      chat_id: "-1001234567890",
      text: "<b>Günaydın</b>",
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    });
  });

  it("waits for each chunk before starting the next one", async () => {
    const firstChunk = Promise.withResolvers<void>();
    let callCount = 0;
    const fetchMock = vi.fn<FakeFetch>(async () => {
      callCount += 1;
      if (callCount === 1) await firstChunk.promise;
      return telegramResponse({ ok: true });
    });

    const sending = sendTelegramChunks({
      botToken: "test-token",
      chatId: "123",
      chunks: ["one", "two"],
      fetchFn: fetchMock as FetchLike,
    });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    firstChunk.resolve();
    await sending;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("treats HTTP 200 with ok=false as failure and stops later chunks", async () => {
    const fetchMock = vi
      .fn<FakeFetch>()
      .mockResolvedValueOnce(telegramResponse({ ok: true }))
      .mockResolvedValueOnce(
        telegramResponse({ ok: false, error_code: 400, description: "Bad Request" }),
      )
      .mockResolvedValueOnce(telegramResponse({ ok: true }));

    await expect(
      sendTelegramChunks({
        botToken: "test-token",
        chatId: "123",
        chunks: ["one", "two", "three"],
        fetchFn: fetchMock as FetchLike,
      }),
    ).rejects.toBeInstanceOf(TelegramSendError);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("treats a non-2xx Telegram response as failure without retrying the POST", async () => {
    const fetchMock = vi
      .fn<FakeFetch>()
      .mockResolvedValue(telegramResponse({ ok: false, description: "Unauthorized" }, 401));

    await expect(
      sendTelegramChunks({
        botToken: "test-token",
        chatId: "123",
        chunks: ["one"],
        fetchFn: fetchMock as FetchLike,
      }),
    ).rejects.toMatchObject({ name: "TelegramSendError", statusCode: 401 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("redacts token-like values and URLs from Telegram error descriptions", async () => {
    const token = "123456:abcdefghijklmnopqrstuvwxyzABCDE";
    const fetchMock = vi.fn<FakeFetch>().mockResolvedValue(
      telegramResponse({
        ok: false,
        description: `Rejected ${token} at https://api.telegram.org/private`,
      }),
    );

    let caught: unknown;
    try {
      await sendTelegramChunks({
        botToken: token,
        chatId: "123",
        chunks: ["one"],
        fetchFn: fetchMock as FetchLike,
      });
    } catch (error: unknown) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(TelegramSendError);
    if (caught instanceof Error) {
      expect(caught.message).not.toContain(token);
      expect(caught.message).not.toContain("https://");
      expect(caught.message).toContain("[REDACTED]");
      expect(caught.message).toContain("[REDACTED_URL]");
    }
  });
});
