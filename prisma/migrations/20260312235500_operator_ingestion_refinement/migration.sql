ALTER TABLE "Paper" ADD COLUMN "versionedId" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Paper" ADD COLUMN "sourceFeedCategoriesJson" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "Paper" ADD COLUMN "comment" TEXT;

ALTER TABLE "Paper" ADD COLUMN "journalRef" TEXT;

ALTER TABLE "Paper" ADD COLUMN "doi" TEXT;

UPDATE "Paper"
SET "versionedId" = "arxivId" || 'v' || CAST("version" AS TEXT)
WHERE "versionedId" = '';

UPDATE "Paper"
SET "sourceFeedCategoriesJson" = "categoriesJson"
WHERE "sourceFeedCategoriesJson" = '[]';
