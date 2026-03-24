import { z } from "zod";
import { prisma } from "@/lib/db";
import { sanitizeInternalPath } from "@/lib/utils/redirect";

export type AppFeedbackRecord = {
  id: string;
  sentiment: "USEFUL" | "NOT_USEFUL";
  message: string | null;
  email: string | null;
  normalizedEmail: string | null;
  sourcePath: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const feedbackSchema = z.object({
  sentiment: z.enum(["USEFUL", "NOT_USEFUL"]),
  message: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((value) => value && value.length > 0 ? value : null),
  email: z
    .string()
    .trim()
    .email()
    .optional()
    .or(z.literal("").transform(() => undefined))
    .transform((value) => value && value.length > 0 ? value : null),
  sourcePath: z
    .string()
    .trim()
    .optional()
    .or(z.literal("").transform(() => undefined))
    .transform((value) => {
      if (!value) {
        return null;
      }

      const sanitized = sanitizeInternalPath(value, "");
      return sanitized.length > 0 ? sanitized : null;
    }),
});

const appFeedback = (prisma as typeof prisma & {
  appFeedback: {
    create: (args: {
      data: Omit<AppFeedbackRecord, "id" | "createdAt" | "updatedAt">;
    }) => Promise<unknown>;
    count: (args?: {
      where?: {
        sentiment?: "USEFUL" | "NOT_USEFUL";
        normalizedEmail?: {
          not: null;
        };
      };
    }) => Promise<number>;
    findMany: (args: {
      orderBy: Array<{
        createdAt?: "asc" | "desc";
        updatedAt?: "asc" | "desc";
      }>;
      take: number;
    }) => Promise<AppFeedbackRecord[]>;
  };
}).appFeedback;

export type CreateAppFeedbackResult =
  | {
      status: "invalid";
    }
  | {
      status: "success";
    };

export async function createAppFeedback(input: {
  sentiment: string | null | undefined;
  message?: string | null | undefined;
  email?: string | null | undefined;
  sourcePath?: string | null | undefined;
}): Promise<CreateAppFeedbackResult> {
  const parsed = feedbackSchema.safeParse({
    sentiment: input.sentiment,
    message: input.message ?? undefined,
    email: input.email ?? undefined,
    sourcePath: input.sourcePath ?? undefined,
  });

  if (!parsed.success) {
    return {
      status: "invalid",
    };
  }

  const { sentiment, message, email, sourcePath } = parsed.data;

  await appFeedback.create({
    data: {
      sentiment,
      message,
      email,
      normalizedEmail: email ? email.toLowerCase() : null,
      sourcePath,
    },
  });

  return {
    status: "success",
  };
}

export async function getAppFeedbackSnapshot(limit = 100) {
  const [totalCount, usefulCount, notUsefulCount, withEmailCount, feedback] = await Promise.all([
    appFeedback.count(),
    appFeedback.count({
      where: {
        sentiment: "USEFUL",
      },
    }),
    appFeedback.count({
      where: {
        sentiment: "NOT_USEFUL",
      },
    }),
    appFeedback.count({
      where: {
        normalizedEmail: {
          not: null,
        },
      },
    }),
    appFeedback.findMany({
      orderBy: [
        { createdAt: "desc" },
        { updatedAt: "desc" },
      ],
      take: limit,
    }),
  ]);

  return {
    totalCount,
    usefulCount,
    notUsefulCount,
    withEmailCount,
    feedback,
  };
}
