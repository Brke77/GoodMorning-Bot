import { loadTelegramSetupToken } from "./config/env.js";
import { TelegramUpdatesSchema } from "./domain/schemas.js";
import { fetchWithRetry } from "./utils/fetch-with-retry.js";
import { safeErrorMessage } from "./utils/logger.js";

interface ChatCandidate {
  id: string;
  type: string;
  username: string;
  displayName: string;
}

function extractCandidates(payload: unknown): ChatCandidate[] {
  const parsed = TelegramUpdatesSchema.parse(payload);
  if (!parsed.ok) throw new Error(parsed.description ?? "Telegram getUpdates çağrısını reddetti.");

  const candidates = new Map<string, ChatCandidate>();
  for (const update of parsed.result) {
    const chat = update.message?.chat ?? update.channel_post?.chat;
    if (!chat) continue;

    const id = String(chat.id);
    const personName = [chat.first_name, chat.last_name].filter(Boolean).join(" ");
    candidates.set(id, {
      id,
      type: chat.type,
      username: chat.username ?? "-",
      displayName: chat.title ?? (personName || "-"),
    });
  }
  return [...candidates.values()];
}

async function main(): Promise<void> {
  const token = loadTelegramSetupToken();
  console.log("Telegram'da botunuza /start gönderin; ardından bulunan sohbetler aranıyor…");

  const response = await fetchWithRetry(
    `https://api.telegram.org/bot${token}/getUpdates`,
    { headers: { Accept: "application/json" } },
    { maxAttempts: 1, timeoutMs: 12_000 },
  );

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Telegram geçerli bir JSON yanıtı döndürmedi.");
  }

  if (!response.ok) {
    const parsed = TelegramUpdatesSchema.safeParse(payload);
    throw new Error(parsed.success ? parsed.data.description : `Telegram HTTP ${response.status}`);
  }

  const candidates = extractCandidates(payload);
  if (candidates.length === 0) {
    console.log("\nHenüz Telegram update'i bulunamadı.");
    console.log("1. Telegram'da bot sohbetini açın.");
    console.log("2. /start mesajını gönderin.");
    console.log("3. Bu komutu yeniden çalıştırın: npm run setup:telegram");
    console.log("Not: Botta aktif webhook varsa getUpdates kullanılamaz; webhook'u kaldırın.");
    return;
  }

  console.log("\nBulunan sohbet adayları:");
  for (const candidate of candidates) {
    console.log(`\nChat ID     : ${candidate.id}`);
    console.log(`Tür         : ${candidate.type}`);
    console.log(`Kullanıcı   : ${candidate.username}`);
    console.log(`Görünen ad  : ${candidate.displayName}`);
  }
  console.log("\nKullanacağınız ID'yi .env içindeki TELEGRAM_CHAT_ID alanına yazın.");
}

main().catch((error: unknown) => {
  console.error(`Telegram kurulumu tamamlanamadı: ${safeErrorMessage(error)}`);
  process.exitCode = 1;
});
