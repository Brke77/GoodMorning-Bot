import { TelegramApiResponseSchema } from "../domain/schemas.js";
import type { FetchLike } from "../domain/types.js";
import { fetchWithRetry } from "../utils/fetch-with-retry.js";
import { logger, safeErrorMessage } from "../utils/logger.js";

export class TelegramSendError extends Error {
  public readonly statusCode: number | undefined;

  public constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "TelegramSendError";
    this.statusCode = statusCode;
  }
}

export interface SendTelegramOptions {
  botToken: string;
  chatId: string;
  chunks: readonly string[];
  fetchFn?: FetchLike;
}

async function parseTelegramBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new TelegramSendError("Telegram geçerli bir JSON yanıtı döndürmedi.", response.status);
  }
}

async function sendChunk(
  botToken: string,
  chatId: string,
  text: string,
  fetchFn: FetchLike,
): Promise<void> {
  const response = await fetchWithRetry(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        link_preview_options: {
          is_disabled: true,
        },
      }),
    },
    {
      fetchFn,
      maxAttempts: 1,
      timeoutMs: 12_000,
    },
  );

  const payload = await parseTelegramBody(response);
  const parsed = TelegramApiResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new TelegramSendError("Telegram yanıt biçimi beklenen yapıda değil.", response.status);
  }

  if (!response.ok || parsed.data.ok !== true) {
    const publicDescription = parsed.data.description
      ? safeErrorMessage(parsed.data.description, { maxLength: 180 })
      : "Telegram gönderimi reddetti.";
    throw new TelegramSendError(publicDescription, response.status);
  }
}

export async function sendTelegramChunks(options: SendTelegramOptions): Promise<void> {
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  for (const [index, chunk] of options.chunks.entries()) {
    try {
      await sendChunk(options.botToken, options.chatId, chunk, fetchFn);
      logger.info("telegram.send.success", {
        chunkIndex: index + 1,
        chunkCount: options.chunks.length,
      });
    } catch (error: unknown) {
      logger.error("telegram.send.failed", {
        chunkIndex: index + 1,
        chunkCount: options.chunks.length,
        reason: safeErrorMessage(error, { secrets: [options.botToken] }),
      });
      throw error;
    }
  }
}
