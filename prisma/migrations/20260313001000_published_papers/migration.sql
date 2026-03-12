CREATE TABLE "PublishedPaper" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "announcementDay" TEXT NOT NULL,
  "paperId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublishedPaper_paperId_fkey"
    FOREIGN KEY ("paperId") REFERENCES "Paper" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PublishedPaper_announcementDay_paperId_key"
ON "PublishedPaper"("announcementDay", "paperId");

CREATE INDEX "PublishedPaper_announcementDay_idx"
ON "PublishedPaper"("announcementDay");

CREATE INDEX "PublishedPaper_paperId_idx"
ON "PublishedPaper"("paperId");
