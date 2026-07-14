import { describe, expect, it } from "vitest";

import type { FetchLike } from "../src/domain/types.js";
import { buildWeatherUrl, fetchWeather } from "../src/services/weather.service.js";

describe("buildWeatherUrl", () => {
  it("İstanbul timezone ve gerekli current/daily alanlarını ekler", () => {
    const url = new URL(buildWeatherUrl());
    expect(url.origin + url.pathname).toBe("https://api.open-meteo.com/v1/forecast");
    expect(url.searchParams.get("timezone")).toBe("Europe/Istanbul");
    expect(url.searchParams.get("forecast_days")).toBe("1");
    expect(url.searchParams.get("current")).toContain("weather_code");
    expect(url.searchParams.get("daily")).toContain("precipitation_probability_max");
  });
});

describe("fetchWeather", () => {
  it("Open-Meteo payload'ını domain verisine map eder", async () => {
    const fetchFn: FetchLike = async () =>
      new Response(
        JSON.stringify({
          current: {
            time: "2026-07-14T11:00",
            temperature_2m: 31.2,
            apparent_temperature: 33.1,
            weather_code: 2,
            wind_speed_10m: 12.5,
          },
          daily: {
            time: ["2026-07-14"],
            temperature_2m_max: [34],
            temperature_2m_min: [24],
            precipitation_probability_max: [20],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );

    await expect(fetchWeather(fetchFn)).resolves.toMatchObject({
      locationName: "İstanbul",
      weatherCode: 2,
      maxTemperature: 34,
      advice: "Öğle saatlerinde sıcaklığa dikkat.",
    });
  });

  it("boş günlük dizileri güvenli biçimde reddeder", async () => {
    const fetchFn: FetchLike = async () =>
      new Response(
        JSON.stringify({
          current: {
            time: "2026-07-14T11:00",
            temperature_2m: 20,
            apparent_temperature: 20,
            weather_code: 0,
            wind_speed_10m: 3,
          },
          daily: {
            time: [],
            temperature_2m_max: [],
            temperature_2m_min: [],
            precipitation_probability_max: [],
          },
        }),
        { status: 200 },
      );

    await expect(fetchWeather(fetchFn)).rejects.toThrow();
  });
});
