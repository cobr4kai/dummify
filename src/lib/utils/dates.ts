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
const ARXIV_ANNOUNCEMENT_TIME_ZONE = "America/New_York";

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

export function addDays(dateString: string, offsetDays: number) {
  const nextDate = startOfDay(dateString);
  nextDate.setUTCDate(nextDate.getUTCDate() + offsetDays);
  return toAnnouncementDay(nextDate);
}

export function getWeekStart(date: Date | string) {
  const dateString = toDateOnlyString(date);
  const weekday = startOfDay(dateString).getUTCDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  return addDays(dateString, offset);
}

export function getWeekEnd(date: Date | string) {
  return addDays(getWeekStart(date), 6);
}

export function formatWeekLabel(weekStart: string) {
  return `Week of ${formatShortDate(weekStart)}`;
}

export function formatWeekRange(weekStart: string) {
  const weekEnd = getWeekEnd(weekStart);
  const startDate = startOfDay(weekStart);
  const endDate = startOfDay(weekEnd);

  const sameMonth = startDate.getUTCMonth() === endDate.getUTCMonth();
  const sameYear = startDate.getUTCFullYear() === endDate.getUTCFullYear();
  const startMonth = startDate.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const endMonth = endDate.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const startDay = startDate.getUTCDate();
  const endDay = endDate.getUTCDate();
  const endYear = endDate.getUTCFullYear();

  if (sameMonth && sameYear) {
    return `${startMonth} ${startDay}-${endDay}, ${endYear}`;
  }

  if (sameYear) {
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${endYear}`;
  }

  return `${startMonth} ${startDay}, ${startDate.getUTCFullYear()} - ${endMonth} ${endDay}, ${endYear}`;
}

export function getCurrentWeekStart(date = new Date()) {
  return getWeekStart(getPacificDateString(date));
}

export function isSameWeek(left: Date | string, right: Date | string) {
  return getWeekStart(left) === getWeekStart(right);
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
  return getZonedDateString(PACIFIC_TIME_ZONE, date);
}

export function getArxivAnnouncementDateString(date = new Date()) {
  return getZonedDateString(ARXIV_ANNOUNCEMENT_TIME_ZONE, date);
}

function getZonedDateString(timeZone: string, date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
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

export function getWeekStarts(days: string[], limit?: number) {
  const uniqueWeeks = Array.from(new Set(days.map((day) => getWeekStart(day))));
  return typeof limit === "number" ? uniqueWeeks.slice(0, limit) : uniqueWeeks;
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

function toDateOnlyString(date: Date | string) {
  if (date instanceof Date) {
    return toAnnouncementDay(date);
  }

  const dateOnlyMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    return date;
  }

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error(`Invalid date value: ${date}`);
  }

  return toAnnouncementDay(parsedDate);
}
