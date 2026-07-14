const UNKNOWN_WEATHER = "Bilinmeyen hava durumu";

const WEATHER_DESCRIPTIONS: ReadonlyMap<number, string> = new Map([
  [0, "Açık"],
  [1, "Çoğunlukla açık"],
  [2, "Parçalı bulutlu"],
  [3, "Kapalı"],
  [45, "Sisli"],
  [48, "Kırağılı sis"],
  [51, "Hafif çisenti"],
  [53, "Orta şiddetli çisenti"],
  [55, "Yoğun çisenti"],
  [56, "Hafif donan çisenti"],
  [57, "Yoğun donan çisenti"],
  [61, "Hafif yağmurlu"],
  [63, "Yağmurlu"],
  [65, "Şiddetli yağmurlu"],
  [66, "Hafif donan yağmur"],
  [67, "Şiddetli donan yağmur"],
  [71, "Hafif kar yağışlı"],
  [73, "Kar yağışlı"],
  [75, "Yoğun kar yağışlı"],
  [77, "Kar taneleri"],
  [80, "Hafif sağanak yağmurlu"],
  [81, "Sağanak yağmurlu"],
  [82, "Şiddetli sağanak yağmurlu"],
  [85, "Hafif kar sağanağı"],
  [86, "Şiddetli kar sağanağı"],
  [95, "Gök gürültülü fırtına"],
  [96, "Hafif dolulu gök gürültülü fırtına"],
  [99, "Şiddetli dolulu gök gürültülü fırtına"],
]);

export type WeatherAdviceInput = {
  precipitationProbability: number;
  maxTemperature: number;
  windSpeed: number;
  minTemperature: number;
};

export function weatherCodeToTurkish(code: number): string {
  return WEATHER_DESCRIPTIONS.get(code) ?? UNKNOWN_WEATHER;
}

/** Return at most one deterministic recommendation, in the documented priority order. */
export function getWeatherAdvice(weather: WeatherAdviceInput): string | null {
  if (Number.isFinite(weather.precipitationProbability) && weather.precipitationProbability >= 50) {
    return "Şemsiye almak mantıklı.";
  }

  if (Number.isFinite(weather.maxTemperature) && weather.maxTemperature >= 32) {
    return "Öğle saatlerinde sıcaklığa dikkat.";
  }

  if (Number.isFinite(weather.windSpeed) && weather.windSpeed >= 35) {
    return "Kuvvetli rüzgâra dikkat.";
  }

  if (Number.isFinite(weather.minTemperature) && weather.minTemperature <= 5) {
    return "Sabah için kalın giyinmek iyi olabilir.";
  }

  return null;
}
