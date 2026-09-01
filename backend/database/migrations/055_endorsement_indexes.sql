-- M10: Endorsement indexes
-- Fast lookup by provider and by endorsing home
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_endorsement_business"
  ON "NeighborEndorsement"("business_user_id", "category");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_endorsement_home"
  ON "NeighborEndorsement"("endorser_home_id");
