export const ISTANBUL_TIME_ZONE = "Europe/Istanbul";

const ISTANBUL_DATE_FORMATTER = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  timeZone: ISTANBUL_TIME_ZONE,
  weekday: "long",
  year: "numeric",
});

export function formatIstanbulDate(value: Date | number | string = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Geçersiz tarih değeri.");
  }

  return ISTANBUL_DATE_FORMATTER.format(date);
}
