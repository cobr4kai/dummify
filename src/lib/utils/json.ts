import { z } from "zod";
import type { Prisma } from "@prisma/client";

export function parseJsonValue<T>(
  value: Prisma.JsonValue,
  schema: z.ZodType<T>,
  fallback: T,
) {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : fallback;
}
