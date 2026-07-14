import { ISTANBUL_LOCATION } from "../config/sources.js";
import { OpenMeteoResponseSchema } from "../domain/schemas.js";
import type { FetchLike, LocationConfig, WeatherData } from "../domain/types.js";
import { fetchWithRetry } from "../utils/fetch-with-retry.js";
import { logger } from "../utils/logger.js";
import { getWeatherAdvice } from "../utils/weather-code.js";

export function buildWeatherUrl(location: LocationConfig = ISTANBUL_LOCATION): string {
  const parameters = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    forecast_days: "1",
    timezone: location.timezone,
  });
  return `https://api.open-meteo.com/v1/forecast?${parameters.toString()}`;
}

export async function fetchWeather(
  fetchFn: FetchLike = globalThis.fetch,
  location: LocationConfig = ISTANBUL_LOCATION,
): Promise<WeatherData> {
  logger.info("weather.fetch.start", { location: location.name });
  const response = await fetchWithRetry(buildWeatherUrl(location), undefined, { fetchFn });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Open-Meteo HTTP ${response.status}`);
  }

  const payload: unknown = await response.json();
  const parsed = OpenMeteoResponseSchema.parse(payload);
  const maxTemperature = parsed.daily.temperature_2m_max[0];
  const minTemperature = parsed.daily.temperature_2m_min[0];
  const precipitationProbability = parsed.daily.precipitation_probability_max[0];
  if (
    maxTemperature === undefined ||
    minTemperature === undefined ||
    precipitationProbability === undefined
  ) {
    throw new Error("Open-Meteo günlük veri dizileri boş döndü.");
  }

  const weather: WeatherData = {
    locationName: location.name,
    temperature: parsed.current.temperature_2m,
    apparentTemperature: parsed.current.apparent_temperature,
    weatherCode: parsed.current.weather_code,
    windSpeed: parsed.current.wind_speed_10m,
    maxTemperature,
    minTemperature,
    precipitationProbability,
    advice: getWeatherAdvice({
      precipitationProbability,
      maxTemperature,
      windSpeed: parsed.current.wind_speed_10m,
      minTemperature,
    }),
  };

  logger.info("weather.fetch.success", { location: location.name });
  return weather;
}
