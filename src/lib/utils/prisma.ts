import type { Prisma } from "@prisma/client";

export function toJsonInput(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
