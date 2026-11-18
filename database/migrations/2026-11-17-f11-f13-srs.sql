-- TrueLabel: Extend the F11/F13 baseline schema for SRS Sprint 2.
-- Run AFTER 2026-11-14-f11-f13.sql, on a TEST database first.
-- Do not run in the live Supabase project without team review and backup.
BEGIN;

ALTER TABLE public.food_reviews ADD COLUMN IF NOT EXISTS "tasteRating" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE public.food_reviews ADD COLUMN IF NOT EXISTS "labelAccuracyRating" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE public.food_reviews ADD COLUMN IF NOT EXISTS "packagingRating" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE public.food_reviews ADD COLUMN IF NOT EXISTS "purchaseExperienceRating" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE public.food_reviews ADD COLUMN IF NOT EXISTS "credibilityWeight" DOUBLE PRECISION NOT NULL DEFAULT 1;
ALTER TABLE public.food_reviews ADD COLUMN IF NOT EXISTS "visibility" VARCHAR(20) NOT NULL DEFAULT 'visible';

ALTER TABLE public.food_reports ADD COLUMN IF NOT EXISTS "batchCode" VARCHAR(80);
ALTER TABLE public.food_reports ADD COLUMN IF NOT EXISTS "purchasePlace" VARCHAR(200) NOT NULL DEFAULT '';
ALTER TABLE public.food_reports ADD COLUMN IF NOT EXISTS "referenceNumber" VARCHAR(40);
UPDATE public.food_reports
SET "referenceNumber" = 'TL-LEGACY-' || id::text
WHERE "referenceNumber" IS NULL;
ALTER TABLE public.food_reports ALTER COLUMN "referenceNumber" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "IDX_food_reports_reference" ON public.food_reports ("referenceNumber");
CREATE INDEX IF NOT EXISTS "IDX_food_reports_product_batch" ON public.food_reports ("productId", "batchCode");

CREATE TABLE IF NOT EXISTS public.report_evidence (
  id SERIAL PRIMARY KEY,
  "reportId" INTEGER NOT NULL REFERENCES public.food_reports(id) ON DELETE CASCADE,
  "filePath" TEXT NOT NULL,
  "mimeType" VARCHAR(32) NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "createdAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "IDX_report_evidence_report" ON public.report_evidence ("reportId");

COMMIT;
