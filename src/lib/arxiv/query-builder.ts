import { endOfDay, startOfDay, toArxivDateStamp } from "@/lib/utils/dates";

export function buildHistoricalQuery(categories: string[], from: string, to: string) {
  const categoryQuery =
    categories.length > 1
      ? `(${categories.map((category) => `cat:${category}`).join(" OR ")})`
      : `cat:${categories[0]}`;
  const fromStamp = toArxivDateStamp(startOfDay(from));
  const toStamp = toArxivDateStamp(endOfDay(to));

  return `${categoryQuery} AND submittedDate:[${fromStamp} TO ${toStamp}]`;
}
