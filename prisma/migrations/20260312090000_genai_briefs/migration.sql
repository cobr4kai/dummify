ALTER TABLE "PaperScore" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'BUSINESS';

ALTER TABLE "PaperScore" ADD COLUMN "focusAreas" JSONB;

DROP INDEX IF EXISTS "PaperScore_paperId_isCurrent_idx";

CREATE INDEX "PaperScore_paperId_mode_isCurrent_idx" ON "PaperScore"("paperId", "mode", "isCurrent");

CREATE TABLE "PaperTechnicalBrief" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paperId" TEXT NOT NULL,
    "executiveTakeaway" TEXT NOT NULL,
    "bulletsJson" JSONB NOT NULL,
    "performanceImpact" TEXT NOT NULL,
    "trainingImpact" TEXT NOT NULL,
    "inferenceImpact" TEXT NOT NULL,
    "limitationsJson" JSONB NOT NULL,
    "confidenceNotesJson" JSONB NOT NULL,
    "evidenceJson" JSONB NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "sourceBasis" TEXT NOT NULL,
    "usedFallbackAbstract" BOOLEAN NOT NULL DEFAULT false,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaperTechnicalBrief_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "PaperTechnicalBrief_paperId_isCurrent_idx" ON "PaperTechnicalBrief"("paperId", "isCurrent");

CREATE TABLE "PaperPdfCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paperId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "filePath" TEXT,
    "extractedJsonPath" TEXT,
    "fileSizeBytes" INTEGER,
    "pageCount" INTEGER,
    "extractionStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "extractionError" TEXT,
    "usedFallbackAbstract" BOOLEAN NOT NULL DEFAULT false,
    "fetchedAt" DATETIME,
    "extractedAt" DATETIME,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaperPdfCache_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "PaperPdfCache_paperId_isCurrent_idx" ON "PaperPdfCache"("paperId", "isCurrent");
