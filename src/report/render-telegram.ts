import { TELEGRAM_SOFT_LIMIT } from "../config/sources.js";
import type {
  AiSummaryResult,
  FallbackSummaryResult,
  FxSnapshot,
  ReportModel,
  SourceItem,
  TelegramSection,
  WeatherData,
} from "../domain/types.js";
import { formatFxRate } from "../services/fx.service.js";
import { formatIstanbulDate } from "../utils/date.js";
import { escapeHtml, escapeHtmlAttribute, safeHttpUrl } from "../utils/html.js";
import { weatherCodeToTurkish } from "../utils/weather-code.js";

const CONTINUATION_RESERVE = 64;

function formatRounded(value: number): string {
  return new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 0,
  }).format(value);
}

function renderLink(url: string | null, label: string): string {
  const safeUrl = url ? safeHttpUrl(url) : null;
  const safeLabel = escapeHtml(label);
  if (!safeUrl) return safeLabel;

  return `<a href="${escapeHtmlAttribute(safeUrl)}">${safeLabel}</a>`;
}

function renderHeaderSection(report: ReportModel): TelegramSection {
  return {
    id: "header",
    blocks: [
      "<b>☀️ Günaydın, broski</b>",
      `📅 ${escapeHtml(formatIstanbulDate(report.generatedAt))}`,
    ],
  };
}

function renderWeatherSection(weather: WeatherData | null): TelegramSection {
  if (!weather) {
    return {
      id: "weather",
      blocks: ["<b>🌤 İstanbul</b>", "Hava verisi şu anda alınamadı."],
    };
  }

  const lines = [
    `${escapeHtml(weatherCodeToTurkish(weather.weatherCode))}. Şu an ${formatRounded(weather.temperature)}°C, hissedilen ${formatRounded(weather.apparentTemperature)}°C.`,
    `Bugün ${formatRounded(weather.minTemperature)}–${formatRounded(weather.maxTemperature)}°C. Yağış ihtimali %${formatRounded(weather.precipitationProbability)}.`,
    `Rüzgâr ${formatRounded(weather.windSpeed)} km/sa.`,
  ];
  if (weather.advice) lines.push(escapeHtml(weather.advice));

  return {
    id: "weather",
    blocks: [`<b>🌤 ${escapeHtml(weather.locationName)}</b>`, lines.join("\n")],
  };
}

function renderFxBody(snapshot: FxSnapshot): string {
  const dates = new Set(snapshot.rates.map((rate) => rate.date));
  const useSharedDate = dates.size === 1;
  const lines = snapshot.rates.map((rate) => {
    const dateSuffix = useSharedDate ? "" : ` (${escapeHtml(rate.date)})`;
    return `${escapeHtml(rate.pair)}: ${escapeHtml(formatFxRate(rate.rate))}${dateSuffix}`;
  });

  for (const pair of snapshot.missingPairs) {
    lines.push(`${escapeHtml(pair)}: Veri şu anda alınamadı.`);
  }

  if (useSharedDate) {
    const firstDate = snapshot.rates[0]?.date;
    if (firstDate) lines.push(`Kaynak tarihi: ${escapeHtml(firstDate)}`);
  }

  return lines.join("\n");
}

function renderFxSection(snapshot: FxSnapshot | null): TelegramSection {
  return {
    id: "fx",
    blocks: [
      "<b>💱 Günlük referans kurlar</b>",
      snapshot ? renderFxBody(snapshot) : "Kur verisi şu anda alınamadı.",
    ],
  };
}

function renderTechHighlight(item: SourceItem, summary: string | null): string {
  const summaryText = summary ? ` — ${escapeHtml(summary)}` : "";
  return `• <b>${escapeHtml(item.title)}</b>${summaryText}\n  ${escapeHtml(item.sourceName)} · ${renderLink(item.url, "Kaynağı aç")}`;
}

function renderRedditHighlight(item: SourceItem, summary: string | null): string {
  const summaryText = summary ? ` — ${escapeHtml(summary)}` : "";
  return `• <b>${escapeHtml(item.sourceName)}</b>${summaryText || ` — ${escapeHtml(item.title)}`}\n  ${renderLink(item.url, "Konuyu aç")}`;
}

function renderAiTechSection(
  summary: AiSummaryResult,
  availableItemCount: number,
): TelegramSection {
  if (availableItemCount === 0) {
    return {
      id: "tech",
      blocks: [
        "<b>📰 Teknoloji özeti</b>",
        "Bugün teknoloji kaynaklarından yeterli veri alınamadı.",
      ],
    };
  }

  const blocks = [
    "<b>📰 Teknoloji özeti</b>",
    escapeHtml(summary.technologySummary || "Teknoloji özeti bugün oluşturulamadı."),
  ];
  if (summary.techHighlights.length > 0) {
    blocks.push("<b>Öne çıkanlar:</b>");
    blocks.push(
      ...summary.techHighlights.map((highlight) =>
        renderTechHighlight(highlight.item, highlight.summary),
      ),
    );
  }

  return { id: "tech", blocks };
}

function renderAiRedditSection(
  summary: AiSummaryResult,
  availableItemCount: number,
): TelegramSection {
  if (availableItemCount === 0) {
    return {
      id: "reddit",
      blocks: ["<b>🔥 Reddit radarı</b>", "Bugün Reddit kaynaklarından yeterli veri alınamadı."],
    };
  }

  const blocks = [
    "<b>🔥 Reddit radarı</b>",
    escapeHtml(summary.redditSummary || "Reddit özeti bugün oluşturulamadı."),
  ];
  blocks.push(
    ...summary.redditHighlights.map((highlight) =>
      renderRedditHighlight(highlight.item, highlight.summary),
    ),
  );
  return { id: "reddit", blocks };
}

function renderFallbackTechSection(summary: FallbackSummaryResult): TelegramSection {
  if (summary.techItems.length === 0) {
    return {
      id: "tech",
      blocks: [
        "<b>📰 Teknoloji özeti</b>",
        "Bugün teknoloji kaynaklarından yeterli veri alınamadı.",
      ],
    };
  }

  return {
    id: "tech",
    blocks: [
      "<b>📰 Teknoloji özeti</b>",
      "En yeni kaynak başlıkları:",
      ...summary.techItems.map((item) => renderTechHighlight(item, null)),
    ],
  };
}

function renderFallbackRedditSection(summary: FallbackSummaryResult): TelegramSection {
  if (summary.redditItems.length === 0) {
    return {
      id: "reddit",
      blocks: ["<b>🔥 Reddit radarı</b>", "Bugün Reddit kaynaklarından yeterli veri alınamadı."],
    };
  }

  return {
    id: "reddit",
    blocks: [
      "<b>🔥 Reddit radarı</b>",
      ...summary.redditItems.map((item) => renderRedditHighlight(item, null)),
    ],
  };
}

export function renderTelegramSections(report: ReportModel): TelegramSection[] {
  const sections = [
    renderHeaderSection(report),
    renderWeatherSection(report.weather),
    renderFxSection(report.fx),
  ];

  if (report.summary.mode === "fallback") {
    sections.push({
      id: "fallback-note",
      blocks: [escapeHtml(report.summary.note)],
    });
    sections.push(renderFallbackTechSection(report.summary));
    sections.push(renderFallbackRedditSection(report.summary));
    return sections;
  }

  sections.push(renderAiTechSection(report.summary, report.techItemCount));
  sections.push(renderAiRedditSection(report.summary, report.redditItemCount));
  if (report.summary.dailyTakeaway) {
    sections.push({
      id: "takeaway",
      blocks: ["<b>🧠 Bugünün ana fikri</b>", escapeHtml(report.summary.dailyTakeaway)],
    });
  }

  return sections;
}

interface OpenTag {
  name: string;
  opening: string;
}

function closingMarkup(stack: readonly OpenTag[]): string {
  return [...stack]
    .reverse()
    .map((tag) => `</${tag.name}>`)
    .join("");
}

function openingMarkup(stack: readonly OpenTag[]): string {
  return stack.map((tag) => tag.opening).join("");
}

function tokenizeHtml(html: string): string[] {
  return html.match(/<[^>]+>|&(?:#\d+|#x[\da-f]+|[a-z][a-z\d]+);|[\s\S]/giu) ?? [];
}

function openingTag(token: string): OpenTag | null {
  const match = /^<(b|i|a)(?:\s[^>]*)?>$/iu.exec(token);
  return match?.[1] ? { name: match[1].toLowerCase(), opening: token } : null;
}

function closingTagName(token: string): string | null {
  const match = /^<\/(b|i|a)>$/iu.exec(token);
  return match?.[1]?.toLowerCase() ?? null;
}

export function isBalancedTelegramHtml(html: string): boolean {
  const stack: string[] = [];
  for (const token of tokenizeHtml(html)) {
    const opening = openingTag(token);
    if (opening) {
      stack.push(opening.name);
      continue;
    }

    const closing = closingTagName(token);
    if (closing && stack.pop() !== closing) return false;
  }

  return stack.length === 0;
}

function splitBalancedHtml(html: string, budget: number): string[] {
  if (html.length <= budget) return [html];

  const fragments: string[] = [];
  const stack: OpenTag[] = [];
  let current = "";

  const flush = (): void => {
    const completed = `${current}${closingMarkup(stack)}`;
    if (completed.length > 0) fragments.push(completed);
    current = openingMarkup(stack);
  };

  for (const token of tokenizeHtml(html)) {
    const closingName = closingTagName(token);
    const prospectiveStack = [...stack];
    if (closingName) {
      const last = prospectiveStack.at(-1);
      if (last?.name === closingName) prospectiveStack.pop();
    } else {
      const opening = openingTag(token);
      if (opening) prospectiveStack.push(opening);
    }

    const neededLength = current.length + token.length + closingMarkup(prospectiveStack).length;
    if (neededLength > budget && current.length > openingMarkup(stack).length) {
      flush();
    }

    if (current.length + token.length + closingMarkup(prospectiveStack).length > budget) {
      throw new Error("Telegram HTML bloğu güvenli biçimde parçalanamayacak kadar uzun.");
    }

    current += token;
    stack.splice(0, stack.length, ...prospectiveStack);
  }

  if (current.length > 0) {
    const completed = `${current}${closingMarkup(stack)}`;
    if (completed.length > 0) fragments.push(completed);
  }

  return fragments;
}

function sectionHtml(section: TelegramSection): string {
  return section.blocks.join("\n\n");
}

function sectionFragments(section: TelegramSection, budget: number): string[] {
  const whole = sectionHtml(section);
  if (whole.length <= budget) return [whole];

  const logicalBlocks =
    section.blocks.length >= 2
      ? [`${section.blocks[0]}\n${section.blocks[1]}`, ...section.blocks.slice(2)]
      : [...section.blocks];
  const fragments: string[] = [];
  let current = "";

  for (const block of logicalBlocks.flatMap((value) => splitBalancedHtml(value, budget))) {
    const candidate = current ? `${current}\n\n${block}` : block;
    if (candidate.length <= budget) {
      current = candidate;
      continue;
    }

    if (current) fragments.push(current);
    current = block;
  }

  if (current) fragments.push(current);
  return fragments;
}

function packFragments(fragments: readonly string[], budget: number): string[] {
  const chunks: string[] = [];
  let current = "";

  for (const fragment of fragments) {
    const candidate = current ? `${current}\n\n${fragment}` : fragment;
    if (candidate.length <= budget) {
      current = candidate;
      continue;
    }

    if (current) chunks.push(current);
    current = fragment;
  }

  if (current) chunks.push(current);
  return chunks;
}

export function chunkTelegramSections(
  sections: readonly TelegramSection[],
  limit = TELEGRAM_SOFT_LIMIT,
): string[] {
  if (!Number.isInteger(limit) || limit < 256 || limit > 4_096) {
    throw new RangeError("Telegram parça limiti 256–4096 arasında olmalıdır.");
  }

  const combined = sections.map(sectionHtml).join("\n\n");
  if (!combined) return [];
  if (combined.length <= limit) {
    if (!isBalancedTelegramHtml(combined)) throw new Error("Dengesiz Telegram HTML üretildi.");
    return [combined];
  }

  const bodyBudget = limit - CONTINUATION_RESERVE;
  const fragments = sections.flatMap((section) => sectionFragments(section, bodyBudget));
  const bodies = packFragments(fragments, bodyBudget);
  const total = bodies.length;
  const chunks = bodies.map((body, index) =>
    index === 0 ? body : `<i>(${index + 1}/${total})</i>\n\n${body}`,
  );

  for (const chunk of chunks) {
    if (chunk.length > limit) throw new Error("Telegram parçası güvenli sınırı aştı.");
    if (!isBalancedTelegramHtml(chunk)) throw new Error("Dengesiz Telegram HTML parçası üretildi.");
  }

  return chunks;
}

export function renderTelegramReport(report: ReportModel, limit = TELEGRAM_SOFT_LIMIT): string[] {
  return chunkTelegramSections(renderTelegramSections(report), limit);
}
