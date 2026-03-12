const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const LONG_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const PACIFIC_TIME_ZONE = "America/Los_Angeles";

export function toAnnouncementDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function formatShortDate(date: Date | string) {
  return SHORT_DATE_FORMATTER.format(toDisplayDate(date));
}

export function formatLongDateTime(date: Date | string) {
  return LONG_DATE_TIME_FORMATTER.format(new Date(date));
}

export function startOfDay(dateString: string) {
  return new Date(`${dateString}T00:00:00.000Z`);
}

export function endOfDay(dateString: string) {
  return new Date(`${dateString}T23:59:59.999Z`);
}

export function toArxivDateStamp(date: Date) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  const hours = `${date.getUTCHours()}`.padStart(2, "0");
  const minutes = `${date.getUTCMinutes()}`.padStart(2, "0");
  return `${year}${month}${day}${hours}${minutes}`;
}

export function getPacificDateString(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);

  const partMap = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${partMap.year}-${partMap.month}-${partMap.day}`;
}

export function isExpectedQuietAnnouncementDay(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 5 || weekday === 6;
}

function toDisplayDate(date: Date | string) {
  if (date instanceof Date) {
    return date;
  }

  const dateOnlyMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  return new Date(date);
}
