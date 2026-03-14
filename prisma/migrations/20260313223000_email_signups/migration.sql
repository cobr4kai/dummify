-- CreateTable
CREATE TABLE "EmailSignup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "normalizedEmail" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "submissionCount" INTEGER NOT NULL DEFAULT 1,
    "lastSubmittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailSignup_normalizedEmail_key" ON "EmailSignup"("normalizedEmail");

-- CreateIndex
CREATE INDEX "EmailSignup_createdAt_idx" ON "EmailSignup"("createdAt");

-- CreateIndex
CREATE INDEX "EmailSignup_lastSubmittedAt_idx" ON "EmailSignup"("lastSubmittedAt");
