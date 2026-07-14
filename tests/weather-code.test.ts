import { describe, expect, it } from "vitest";

import { getWeatherAdvice, weatherCodeToTurkish } from "../src/utils/weather-code.js";

describe("weatherCodeToTurkish", () => {
  it.each([
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
  ])("WMO %i kodunu çevirir", (code, expected) => {
    expect(weatherCodeToTurkish(code)).toBe(expected);
  });

  it.each([4, 999, -1, Number.NaN])("bilinmeyen %s kodunda güvenli fallback verir", (code) => {
    expect(weatherCodeToTurkish(code)).toBe("Bilinmeyen hava durumu");
  });
});

describe("getWeatherAdvice", () => {
  it("eşiklerde yağış → sıcaklık → rüzgâr → soğuk önceliğini uygular", () => {
    expect(
      getWeatherAdvice({
        precipitationProbability: 50,
        maxTemperature: 40,
        windSpeed: 60,
        minTemperature: 0,
      }),
    ).toBe("Şemsiye almak mantıklı.");

    expect(
      getWeatherAdvice({
        precipitationProbability: 49,
        maxTemperature: 32,
        windSpeed: 60,
        minTemperature: 0,
      }),
    ).toBe("Öğle saatlerinde sıcaklığa dikkat.");

    expect(
      getWeatherAdvice({
        precipitationProbability: 49,
        maxTemperature: 31.9,
        windSpeed: 35,
        minTemperature: 0,
      }),
    ).toBe("Kuvvetli rüzgâra dikkat.");

    expect(
      getWeatherAdvice({
        precipitationProbability: 49,
        maxTemperature: 31.9,
        windSpeed: 34.9,
        minTemperature: 5,
      }),
    ).toBe("Sabah için kalın giyinmek iyi olabilir.");
  });

  it("hiçbir koşul sağlanmıyorsa tavsiye üretmez", () => {
    expect(
      getWeatherAdvice({
        precipitationProbability: 20,
        maxTemperature: 25,
        windSpeed: 10,
        minTemperature: 12,
      }),
    ).toBeNull();
  });

  it("finite olmayan değerleri tetikleyici saymaz", () => {
    expect(
      getWeatherAdvice({
        precipitationProbability: Number.NaN,
        maxTemperature: Number.POSITIVE_INFINITY,
        windSpeed: Number.NaN,
        minTemperature: Number.NEGATIVE_INFINITY,
      }),
    ).toBeNull();
  });
});
