-- Migration: 20260612000001_business_avg_response_calc_at.sql
-- Purpose: Support bounded, fair rotation for the computeAvgResponseTime job.
-- Adds a per-profile timestamp recording when avg_response_minutes was last
-- recomputed. Each run processes the least-recently-computed published
-- businesses first (avg_response_calc_at ASC, NULLs first) and stamps this
-- column, so work per run is capped (preventing unbounded runtime / Lambda
-- timeouts) while every business is still rotated through over time.

ALTER TABLE "public"."BusinessProfile"
  ADD COLUMN IF NOT EXISTS "avg_response_calc_at" TIMESTAMPTZ;

-- Partial index matching the job's query: published profiles ordered by
-- least-recently-computed first (NULLs first = never computed yet).
CREATE INDEX IF NOT EXISTS idx_businessprofile_avg_response_calc_at
  ON "public"."BusinessProfile" ("avg_response_calc_at" ASC NULLS FIRST)
  WHERE "is_published" = true;
