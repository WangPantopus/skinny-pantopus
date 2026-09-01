-- Migration 093: Supporting index for count_category_completions RPC.
-- Covers the (accepted_by, category) filter with a partial index on completed gigs.

CREATE INDEX IF NOT EXISTS idx_gig_category_completion
  ON "Gig" (category, accepted_by)
  WHERE status = 'completed';
