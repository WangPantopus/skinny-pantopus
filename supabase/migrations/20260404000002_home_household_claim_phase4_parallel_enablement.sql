-- Home household claim Phase 4: parallel claim enablement.
-- This migration must be applied only after the backend Phase 4 code is deployed.

DROP INDEX IF EXISTS "public"."idx_home_claim_active_unique";
