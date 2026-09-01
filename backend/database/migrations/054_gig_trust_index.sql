-- M9: Gig trust index
-- Speeds up the neighbor trust count query (Feature 1)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_gig_trust"
  ON "Gig"("accepted_by", "status", "origin_home_id", "payment_status");
