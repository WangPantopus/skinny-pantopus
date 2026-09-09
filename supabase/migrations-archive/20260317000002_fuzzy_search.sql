-- ============================================================
-- FUZZY SEARCH — pg_trgm trigram indexes
--
-- Enables fuzzy / typo-tolerant search on Listing title and
-- description using PostgreSQL's pg_trgm extension and the %
-- similarity operator.
-- ============================================================

-- Enable trigram extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram indexes for fuzzy matching
CREATE INDEX IF NOT EXISTS idx_listing_title_trgm
  ON "public"."Listing" USING gin ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_listing_desc_trgm
  ON "public"."Listing" USING gin ("description" gin_trgm_ops);

-- Set similarity threshold explicitly (0.3 is the default)
SELECT set_limit(0.3);
