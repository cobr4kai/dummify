CREATE TABLE "AppFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sentiment" TEXT NOT NULL,
    "message" TEXT,
    "email" TEXT,
    "normalizedEmail" TEXT,
    "sourcePath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "AppFeedback_createdAt_idx" ON "AppFeedback"("createdAt");
CREATE INDEX "AppFeedback_sentiment_idx" ON "AppFeedback"("sentiment");
CREATE INDEX "AppFeedback_normalizedEmail_idx" ON "AppFeedback"("normalizedEmail");
