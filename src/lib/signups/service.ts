import { z } from "zod";
import { prisma } from "@/lib/db";

const emailSchema = z.string().trim().email();

export type CreateEmailSignupResult =
  | {
      status: "invalid";
    }
  | {
      status: "success";
      wasExisting: boolean;
    };

export async function createEmailSignup(input: string | null | undefined): Promise<CreateEmailSignupResult> {
  const parsed = emailSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "invalid",
    };
  }

  const email = parsed.data;
  const normalizedEmail = email.toLowerCase();
  const existing = await prisma.emailSignup.findUnique({
    where: {
      normalizedEmail,
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    await prisma.emailSignup.update({
      where: {
        normalizedEmail,
      },
      data: {
        email,
        submissionCount: {
          increment: 1,
        },
        lastSubmittedAt: new Date(),
      },
    });

    return {
      status: "success",
      wasExisting: true,
    };
  }

  await prisma.emailSignup.create({
    data: {
      normalizedEmail,
      email,
    },
  });

  return {
    status: "success",
    wasExisting: false,
  };
}

export async function getEmailSignupSnapshot(limit = 100) {
  const [totalCount, signups] = await Promise.all([
    prisma.emailSignup.count(),
    prisma.emailSignup.findMany({
      orderBy: [
        { lastSubmittedAt: "desc" },
        { createdAt: "desc" },
      ],
      take: limit,
    }),
  ]);

  const repeatSignupCount = signups.filter((signup) => signup.submissionCount > 1).length;

  return {
    totalCount,
    repeatSignupCount,
    signups,
  };
}
