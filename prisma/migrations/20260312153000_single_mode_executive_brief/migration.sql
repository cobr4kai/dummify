ALTER TABLE "PaperTechnicalBrief" ADD COLUMN "oneLineVerdict" TEXT NOT NULL DEFAULT '';

ALTER TABLE "PaperTechnicalBrief" ADD COLUMN "keyStatsJson" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "PaperTechnicalBrief" ADD COLUMN "focusTagsJson" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "PaperTechnicalBrief" ADD COLUMN "whyItMatters" TEXT NOT NULL DEFAULT '';

ALTER TABLE "PaperTechnicalBrief" ADD COLUMN "whatToIgnore" TEXT NOT NULL DEFAULT '';
