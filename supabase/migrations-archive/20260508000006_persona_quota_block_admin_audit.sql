-- Phase 1 / P1.2: PersonaQuotaUsage + PersonaBlock + AdminAccessLog.
--
-- Audience Profile + Paid Tier Ladder Design v2 (§5.3 — table specs;
-- §6.5 — admin/moderator audit boundaries).
--
-- These three tables are the foundation for:
--   * Quota enforcement       — PersonaQuotaUsage is the append-only ledger
--                                that the quota-remaining computation reads
--                                (P1.5 / P1.11 / P1.12 build on it).
--   * Block propagation       — PersonaBlock is the persona-scoped block list
--                                that personal-side blocks propagate into via
--                                source = 'personal_block_propagation' (P1.14).
--   * Moderator discipline    — AdminAccessLog records every cross-context
--                                lookup so the platform-trust commitment in
--                                §6.5 is structurally enforced, not policy
--                                enforced.
--
-- Phase 1 service code never updates a PersonaQuotaUsage row except to set
-- reverted_at; the append-only property is a convention. Phase 2 may add an
-- RLS policy. AdminAccessLog is hard-enforced as append-only by a trigger
-- (step 4) — once a moderator has accessed cross-context data, the record of
-- that access cannot be edited away.
--
-- Idempotent: safe to re-run after a partial failure.

-- ---------------------------------------------------------------------------
-- 1. PersonaQuotaUsage — immutable per-event ledger.
--
-- One row per usage event (msg_thread, video_call). Quota remaining for a
-- (membership, capability) in a billing period is computed as
--     tier.quota_per_period - count(rows in [period_start, period_end))
--                              where reverted_at IS NULL
-- so the partial index covers the live-counting query.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."PersonaQuotaUsage" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "membership_id" uuid NOT NULL,
  "period_start" timestamptz NOT NULL,
  "period_end" timestamptz NOT NULL,
  "capability" text NOT NULL,
  "related_entity_type" text,
  "related_entity_id" uuid,
  "used_at" timestamptz NOT NULL DEFAULT now(),
  "reverted_at" timestamptz,
  CONSTRAINT "PersonaQuotaUsage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PersonaQuotaUsage_capability_check"
    CHECK ("capability" IN ('msg_thread','video_call')),
  CONSTRAINT "PersonaQuotaUsage_period_order_check"
    CHECK ("period_end" > "period_start"),
  CONSTRAINT "PersonaQuotaUsage_membership_id_fkey"
    FOREIGN KEY ("membership_id")
    REFERENCES "public"."PersonaMembership"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_quota_usage_membership_period"
  ON "public"."PersonaQuotaUsage" ("membership_id", "period_start", "capability")
  WHERE "reverted_at" IS NULL;

-- ---------------------------------------------------------------------------
-- 2. PersonaBlock — persona-scoped block list.
--
-- Independent of personal-side blocks. The asymmetry matters:
--   * personal-side block of B propagates here as
--     source = 'personal_block_propagation' (P1.14)
--   * audience-side block of @lurker_42 does NOT propagate the other way
--     (would leak the personal-side relationship; design v2 §9)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."PersonaBlock" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "persona_id" uuid NOT NULL,
  "blocked_user_id" uuid NOT NULL,
  "reason" text,
  "source" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "PersonaBlock_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PersonaBlock_persona_user_key"
    UNIQUE ("persona_id", "blocked_user_id"),
  CONSTRAINT "PersonaBlock_source_check" CHECK ("source" IN (
    'persona_owner_action',
    'personal_block_propagation',
    'platform_safety',
    'chargeback'
  )),
  CONSTRAINT "PersonaBlock_persona_id_fkey"
    FOREIGN KEY ("persona_id")
    REFERENCES "public"."PublicPersona"("id") ON DELETE CASCADE,
  CONSTRAINT "PersonaBlock_blocked_user_id_fkey"
    FOREIGN KEY ("blocked_user_id")
    REFERENCES "public"."User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_persona_block_persona"
  ON "public"."PersonaBlock" ("persona_id");
CREATE INDEX IF NOT EXISTS "idx_persona_block_user"
  ON "public"."PersonaBlock" ("blocked_user_id");

-- ---------------------------------------------------------------------------
-- 3. AdminAccessLog — cross-context lookup audit trail.
--
-- target_user_id deliberately has NO foreign key. If a User is hard-deleted
-- (GDPR, account closure, etc.) the audit row must survive: the platform's
-- public commitment to publish annual aggregate cross-context-lookup stats
-- is broken if rows can disappear. Phase 2 may add a soft target_user_id_text
-- mirror column for compliance reporting once the deletion semantics are
-- finalized. target_persona_id and target_membership_id use ON DELETE SET
-- NULL — the row stays, but the dangling reference is cleared.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."AdminAccessLog" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "admin_user_id" uuid NOT NULL,
  "action" text NOT NULL,
  "scope" text NOT NULL,
  "reason_category" text NOT NULL,
  "reason_text" text,
  "target_user_id" uuid,
  "target_persona_id" uuid,
  "target_membership_id" uuid,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "AdminAccessLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdminAccessLog_scope_check" CHECK ("scope" IN (
    'moderator_audience',
    'moderator_personal',
    'moderator_full'
  )),
  CONSTRAINT "AdminAccessLog_reason_category_check" CHECK ("reason_category" IN (
    'csam_report',
    'fraud_investigation',
    'user_data_request',
    'safety_review',
    'account_recovery',
    'tax_reporting',
    'other'
  )),
  CONSTRAINT "AdminAccessLog_admin_user_id_fkey"
    FOREIGN KEY ("admin_user_id") REFERENCES "public"."User"("id"),
  CONSTRAINT "AdminAccessLog_target_persona_id_fkey"
    FOREIGN KEY ("target_persona_id")
    REFERENCES "public"."PublicPersona"("id") ON DELETE SET NULL,
  CONSTRAINT "AdminAccessLog_target_membership_id_fkey"
    FOREIGN KEY ("target_membership_id")
    REFERENCES "public"."PersonaMembership"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "idx_admin_access_log_admin"
  ON "public"."AdminAccessLog" ("admin_user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_admin_access_log_target_user"
  ON "public"."AdminAccessLog" ("target_user_id", "created_at" DESC)
  WHERE "target_user_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_admin_access_log_action"
  ON "public"."AdminAccessLog" ("action", "created_at" DESC);

-- ---------------------------------------------------------------------------
-- 4. Append-only enforcement on AdminAccessLog.
--
-- Database-level guard: once a moderator's access is recorded, the record
-- cannot be edited or deleted by any caller — including the moderator
-- themselves. The trigger fires before UPDATE or DELETE and raises an
-- exception. Service-role inserts are unaffected.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."admin_access_log_block_modify"()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AdminAccessLog rows are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "admin_access_log_no_update" ON "public"."AdminAccessLog";
CREATE TRIGGER "admin_access_log_no_update"
  BEFORE UPDATE OR DELETE ON "public"."AdminAccessLog"
  FOR EACH ROW EXECUTE FUNCTION "public"."admin_access_log_block_modify"();

-- ---------------------------------------------------------------------------
-- 5. Grants. All three tables are service-role only at the DB layer; the
-- public API surfaces are introduced by later P1 prompts. RLS is enabled so
-- that a missing service-role context fails closed rather than open.
-- ---------------------------------------------------------------------------
ALTER TABLE "public"."PersonaQuotaUsage" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."PersonaQuotaUsage" FROM "anon", "authenticated";
GRANT ALL ON TABLE "public"."PersonaQuotaUsage" TO "service_role";

ALTER TABLE "public"."PersonaBlock" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."PersonaBlock" FROM "anon", "authenticated";
GRANT ALL ON TABLE "public"."PersonaBlock" TO "service_role";

ALTER TABLE "public"."AdminAccessLog" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."AdminAccessLog" FROM "anon", "authenticated";
GRANT ALL ON TABLE "public"."AdminAccessLog" TO "service_role";
