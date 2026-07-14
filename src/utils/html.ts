const MAX_SAFE_URL_LENGTH = 2_048;

function containsControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (
      codePoint !== undefined &&
      (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f))
    ) {
      return true;
    }
  }

  return false;
}

/** Escape untrusted text for Telegram's HTML parse mode. */
export function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/** Escape an already validated value for use inside a double-quoted HTML attribute. */
export function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value).replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

/**
 * Return a normalized HTTP(S) URL that is safe to place in a Telegram link.
 *
 * Credentials are rejected so source links can never expose embedded secrets.
 * Control characters and unexpectedly large values are rejected before parsing.
 */
export function safeHttpUrl(value: string, maxLength = MAX_SAFE_URL_LENGTH): string | null {
  if (!Number.isSafeInteger(maxLength) || maxLength <= 0) {
    return null;
  }

  const candidate = value.trim();
  if (
    candidate.length === 0 ||
    candidate.length > maxLength ||
    containsControlCharacter(candidate)
  ) {
    return null;
  }

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    if (url.username !== "" || url.password !== "" || url.hostname === "") {
      return null;
    }

    const normalized = url.toString();
    return normalized.length <= maxLength ? normalized : null;
  } catch {
    return null;
  }
}
