-- Add structured affiliations captured during PDF/OpenAI technical brief generation.
ALTER TABLE "PaperTechnicalBrief" ADD COLUMN "affiliationsJson" JSON;
