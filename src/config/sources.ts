import type { LocationConfig, RssSource } from "../domain/types.js";

export const APP_NAME = "MorningBriefBot";
export const APP_VERSION = "1.0";
export const DEFAULT_REDDIT_USER_AGENT = `${APP_NAME}/${APP_VERSION}`;
export const DEFAULT_OPENAI_MODEL = "gpt-5.6-luna";
export const TELEGRAM_SOFT_LIMIT = 3_900;
export const MAX_FEED_BYTES = 2 * 1024 * 1024;

export const ISTANBUL_LOCATION: LocationConfig = {
  name: "İstanbul",
  latitude: 41.0082,
  longitude: 28.9784,
  timezone: "Europe/Istanbul",
};

export const TECH_SOURCES: readonly RssSource[] = [
  {
    id: "techcrunch",
    name: "TechCrunch",
    url: "https://techcrunch.com/feed/",
    maxItems: 4,
  },
  {
    id: "ars-technica",
    name: "Ars Technica",
    url: "https://arstechnica.com/feed/",
    maxItems: 4,
  },
  {
    id: "github-changelog",
    name: "GitHub Changelog",
    url: "https://github.blog/changelog/feed/",
    maxItems: 4,
  },
];

export const REDDIT_SOURCES: readonly RssSource[] = [
  {
    id: "programming",
    name: "r/programming",
    url: "https://www.reddit.com/r/programming/hot.rss?limit=5",
    maxItems: 5,
  },
  {
    id: "technology",
    name: "r/technology",
    url: "https://www.reddit.com/r/technology/hot.rss?limit=5",
    maxItems: 5,
  },
  {
    id: "selfhosted",
    name: "r/selfhosted",
    url: "https://www.reddit.com/r/selfhosted/hot.rss?limit=5",
    maxItems: 5,
  },
];
