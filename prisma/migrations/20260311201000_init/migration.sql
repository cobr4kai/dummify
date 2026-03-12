-- CreateTable
CREATE TABLE "Paper" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "arxivId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "abstract" TEXT NOT NULL,
    "authorsJson" JSONB NOT NULL,
    "authorsText" TEXT NOT NULL,
    "categoriesJson" JSONB NOT NULL,
    "categoryText" TEXT NOT NULL,
    "primaryCategory" TEXT,
    "publishedAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "announcementDay" TEXT NOT NULL,
    "announceType" TEXT,
    "abstractUrl" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "links" JSONB NOT NULL,
    "sourceMetadata" JSONB NOT NULL,
    "sourcePayload" JSONB NOT NULL,
    "searchText" TEXT NOT NULL,
    "isDemoData" BOOLEAN NOT NULL DEFAULT false,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordUpdatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PaperScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paperId" TEXT NOT NULL,
    "scoringVersion" TEXT NOT NULL,
    "totalScore" REAL NOT NULL,
    "businessRelevanceScore" REAL NOT NULL,
    "strategyFitScore" REAL NOT NULL,
    "financeFitScore" REAL NOT NULL,
    "procurementFitScore" REAL NOT NULL,
    "breakdown" JSONB NOT NULL,
    "audienceFit" JSONB NOT NULL,
    "weights" JSONB NOT NULL,
    "rationale" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaperScore_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaperSummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paperId" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "oneSentenceSummary" TEXT NOT NULL,
    "whyThisMatters" TEXT NOT NULL,
    "audienceInterpretation" TEXT,
    "whatThisIsNot" TEXT NOT NULL,
    "confidenceNotes" JSONB NOT NULL,
    "glossary" JSONB NOT NULL,
    "keyClaims" JSONB NOT NULL,
    "businessConsequences" JSONB NOT NULL,
    "maturityEstimate" TEXT NOT NULL,
    "leadershipQuestions" JSONB NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "sourceBasis" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaperSummary_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaperEnrichment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paperId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerRecordId" TEXT,
    "payload" JSONB NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaperEnrichment_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IngestionRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "triggerSource" TEXT NOT NULL,
    "categories" JSONB NOT NULL,
    "requestedFrom" DATETIME,
    "requestedTo" DATETIME,
    "recomputeScores" BOOLEAN NOT NULL DEFAULT false,
    "recomputeSummaries" BOOLEAN NOT NULL DEFAULT false,
    "fetchedCount" INTEGER NOT NULL DEFAULT 0,
    "upsertedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "scoreCount" INTEGER NOT NULL DEFAULT 0,
    "summaryCount" INTEGER NOT NULL DEFAULT 0,
    "logLines" JSONB NOT NULL,
    "errorMessage" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CategoryConfig" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Paper_arxivId_key" ON "Paper"("arxivId");

-- CreateIndex
CREATE INDEX "Paper_announcementDay_idx" ON "Paper"("announcementDay");

-- CreateIndex
CREATE INDEX "Paper_primaryCategory_idx" ON "Paper"("primaryCategory");

-- CreateIndex
CREATE INDEX "Paper_publishedAt_idx" ON "Paper"("publishedAt");

-- CreateIndex
CREATE INDEX "Paper_isDemoData_idx" ON "Paper"("isDemoData");

-- CreateIndex
CREATE INDEX "PaperScore_paperId_isCurrent_idx" ON "PaperScore"("paperId", "isCurrent");

-- CreateIndex
CREATE INDEX "PaperScore_totalScore_idx" ON "PaperScore"("totalScore");

-- CreateIndex
CREATE INDEX "PaperSummary_paperId_audience_isCurrent_idx" ON "PaperSummary"("paperId", "audience", "isCurrent");

-- CreateIndex
CREATE INDEX "PaperEnrichment_paperId_provider_isCurrent_idx" ON "PaperEnrichment"("paperId", "provider", "isCurrent");

-- CreateIndex
CREATE INDEX "IngestionRun_startedAt_idx" ON "IngestionRun"("startedAt");

-- CreateIndex
CREATE INDEX "IngestionRun_status_idx" ON "IngestionRun"("status");
