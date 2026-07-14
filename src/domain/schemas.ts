import { z } from "zod";

export const HighlightSchema = z.object({
  itemId: z.string().min(1).max(64),
  summary: z.string().min(1).max(500),
  importance: z.enum(["high", "medium"]),
});

export const RedditHighlightSchema = z.object({
  itemId: z.string().min(1).max(64),
  summary: z.string().min(1).max(500),
});

export const MorningDigestSchema = z.object({
  technologySummary: z.string().max(1_200),
  techHighlights: z.array(HighlightSchema).max(4),
  redditSummary: z.string().max(1_200),
  redditHighlights: z.array(RedditHighlightSchema).max(3),
  dailyTakeaway: z.string().max(600),
});

export type MorningDigest = z.infer<typeof MorningDigestSchema>;

export const OpenMeteoResponseSchema = z.object({
  current: z.object({
    time: z.string(),
    temperature_2m: z.number(),
    apparent_temperature: z.number(),
    weather_code: z.number().int(),
    wind_speed_10m: z.number().nonnegative(),
  }),
  daily: z.object({
    time: z.array(z.string()).min(1),
    temperature_2m_max: z.array(z.number()).min(1),
    temperature_2m_min: z.array(z.number()).min(1),
    precipitation_probability_max: z.array(z.number().min(0).max(100)).min(1),
  }),
});

export const FrankfurterRateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  base: z.string().length(3),
  quote: z.string().length(3),
  rate: z.number().positive(),
});

export const FrankfurterRatesSchema = z.array(FrankfurterRateSchema);

export const TelegramApiResponseSchema = z.object({
  ok: z.boolean(),
  description: z.string().optional(),
  error_code: z.number().int().optional(),
  parameters: z
    .object({
      retry_after: z.number().int().positive().optional(),
    })
    .optional(),
});

export const TelegramUpdatesSchema = z.object({
  ok: z.boolean(),
  description: z.string().optional(),
  result: z
    .array(
      z.object({
        update_id: z.number().int(),
        message: z
          .object({
            chat: z.object({
              id: z.union([z.number(), z.string()]),
              type: z.string(),
              username: z.string().optional(),
              first_name: z.string().optional(),
              last_name: z.string().optional(),
              title: z.string().optional(),
            }),
          })
          .optional(),
        channel_post: z
          .object({
            chat: z.object({
              id: z.union([z.number(), z.string()]),
              type: z.string(),
              username: z.string().optional(),
              first_name: z.string().optional(),
              last_name: z.string().optional(),
              title: z.string().optional(),
            }),
          })
          .optional(),
      }),
    )
    .default([]),
});
