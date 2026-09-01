-- ============================================================
-- Migration 031: Home Ownership, Identity, Residency & Dispute System
-- Pantopus — Hardened ownership/claims/quorum/security model
-- ============================================================

BEGIN;

-- ============================================================
-- 1. NEW ENUM TYPES
-- ============================================================

CREATE TYPE "public"."home_security_state" AS ENUM (
    'normal',
    'claim_window',
    'review_required',
    'disputed',
    'frozen',
    'frozen_silent'
);
ALTER TYPE "public"."home_security_state" OWNER TO "postgres";

CREATE TYPE "public"."home_tenure_mode" AS ENUM (
    'unknown',
    'owner_occupied',
    'rental',
    'managed_property'
);
ALTER TYPE "public"."home_tenure_mode" OWNER TO "postgres";

CREATE TYPE "public"."home_privacy_mask_level" AS ENUM (
    'normal',
    'high',
    'invite_only_discovery'
);
ALTER TYPE "public"."home_privacy_mask_level" OWNER TO "postgres";

CREATE TYPE "public"."home_member_attach_policy" AS ENUM (
    'open_invite',
    'admin_approval',
    'verified_only'
);
ALTER TYPE "public"."home_member_attach_policy" OWNER TO "postgres";

CREATE TYPE "public"."home_owner_claim_policy" AS ENUM (
    'open',
    'review_required'
);
ALTER TYPE "public"."home_owner_claim_policy" OWNER TO "postgres";

CREATE TYPE "public"."ownership_claim_state" AS ENUM (
    'draft',
    'submitted',
    'needs_more_info',
    'pending_review',
    'pending_challenge_window',
    'approved',
    'rejected',
    'disputed',
    'revoked'
);
ALTER TYPE "public"."ownership_claim_state" OWNER TO "postgres";

CREATE TYPE "public"."ownership_claim_method" AS ENUM (
    'invite',
    'vouch',
    'doc_upload',
    'escrow_agent',
    'landlord_portal',
    'property_data_match'
);
ALTER TYPE "public"."ownership_claim_method" OWNER TO "postgres";

CREATE TYPE "public"."owner_verification_tier" AS ENUM (
    'weak',
    'standard',
    'strong',
    'legal'
);
ALTER TYPE "public"."owner_verification_tier" OWNER TO "postgres";

CREATE TYPE "public"."owner_status_type" AS ENUM (
    'pending',
    'verified',
    'disputed',
    'revoked'
);
ALTER TYPE "public"."owner_status_type" OWNER TO "postgres";

CREATE TYPE "public"."owner_added_via" AS ENUM (
    'claim',
    'transfer',
    'escrow',
    'landlord_portal'
);
ALTER TYPE "public"."owner_added_via" OWNER TO "postgres";

CREATE TYPE "public"."quorum_action_state" AS ENUM (
    'proposed',
    'collecting_votes',
    'approved',
    'rejected',
    'expired'
);
ALTER TYPE "public"."quorum_action_state" OWNER TO "postgres";

CREATE TYPE "public"."subject_type" AS ENUM (
    'user',
    'business',
    'trust'
);
ALTER TYPE "public"."subject_type" OWNER TO "postgres";


-- ============================================================
-- 2. ADD NEW VALUES TO EXISTING ENUMS
-- ============================================================

ALTER TYPE "public"."home_role_base" ADD VALUE IF NOT EXISTS 'lease_resident';
ALTER TYPE "public"."home_role_base" ADD VALUE IF NOT EXISTS 'service_provider';

ALTER TYPE "public"."home_permission" ADD VALUE IF NOT EXISTS 'ownership.view';
ALTER TYPE "public"."home_permission" ADD VALUE IF NOT EXISTS 'ownership.manage';
ALTER TYPE "public"."home_permission" ADD VALUE IF NOT EXISTS 'ownership.transfer';
ALTER TYPE "public"."home_permission" ADD VALUE IF NOT EXISTS 'security.manage';
ALTER TYPE "public"."home_permission" ADD VALUE IF NOT EXISTS 'dispute.view';
ALTER TYPE "public"."home_permission" ADD VALUE IF NOT EXISTS 'dispute.manage';
ALTER TYPE "public"."home_permission" ADD VALUE IF NOT EXISTS 'quorum.vote';
ALTER TYPE "public"."home_permission" ADD VALUE IF NOT EXISTS 'quorum.propose';


-- ============================================================
-- 3. HomeAddress TABLE (normalized address identity)
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."HomeAddress" (
    "id"                uuid DEFAULT gen_random_uuid() NOT NULL,
    "address_line1_norm" text NOT NULL,
    "address_line2_norm" text,
    "city_norm"         text NOT NULL,
    "state"             text NOT NULL,
    "postal_code"       text NOT NULL,
    "country"           text NOT NULL DEFAULT 'US',
    "address_hash"      text NOT NULL,
    "geocode_lat"       double precision,
    "geocode_lng"       double precision,
    "place_type"        text NOT NULL DEFAULT 'unknown',
    "created_at"        timestamptz NOT NULL DEFAULT now(),
    "updated_at"        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "HomeAddress_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "HomeAddress_place_type_chk" CHECK (
        "place_type" = ANY (ARRAY[
            'single_family','unit','building','multi_parcel','rv_spot','unknown'
        ]::text[])
    )
);
ALTER TABLE "public"."HomeAddress" OWNER TO "postgres";

CREATE UNIQUE INDEX IF NOT EXISTS "homeaddress_hash_unique"
    ON "public"."HomeAddress" ("address_hash");


-- ============================================================
-- 4. Helper function: normalize_address_hash
-- Deterministic hash of normalized street + unit + locality.
-- ============================================================

CREATE OR REPLACE FUNCTION "public"."normalize_address_hash"(
    p_line1 text,
    p_line2 text,
    p_city  text,
    p_state text,
    p_postal text,
    p_country text DEFAULT 'US'
) RETURNS text
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
    v_norm text;
BEGIN
    v_norm := lower(trim(coalesce(p_line1, '')))
        || '|' || lower(trim(coalesce(p_line2, '')))
        || '|' || lower(trim(coalesce(p_city, '')))
        || '|' || lower(trim(coalesce(p_state, '')))
        || '|' || trim(coalesce(p_postal, ''))
        || '|' || lower(trim(coalesce(p_country, 'us')));
    RETURN encode(digest(v_norm, 'sha256'), 'hex');
END;
$$;


-- ============================================================
-- 5. ALTER "Home" TABLE — add new columns
-- ============================================================

ALTER TABLE "public"."Home"
    ADD COLUMN IF NOT EXISTS "address_id"             uuid,
    ADD COLUMN IF NOT EXISTS "parent_home_id"         uuid,
    ADD COLUMN IF NOT EXISTS "home_status"             text NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS "canonical_home_id"       uuid,
    ADD COLUMN IF NOT EXISTS "security_state"          "public"."home_security_state" NOT NULL DEFAULT 'normal',
    ADD COLUMN IF NOT EXISTS "claim_window_ends_at"    timestamptz,
    ADD COLUMN IF NOT EXISTS "member_attach_policy"    "public"."home_member_attach_policy" NOT NULL DEFAULT 'open_invite',
    ADD COLUMN IF NOT EXISTS "owner_claim_policy"      "public"."home_owner_claim_policy" NOT NULL DEFAULT 'open',
    ADD COLUMN IF NOT EXISTS "privacy_mask_level"      "public"."home_privacy_mask_level" NOT NULL DEFAULT 'normal',
    ADD COLUMN IF NOT EXISTS "tenure_mode"             "public"."home_tenure_mode" NOT NULL DEFAULT 'unknown',
    ADD COLUMN IF NOT EXISTS "address_hash"            text,
    ADD COLUMN IF NOT EXISTS "place_type"              text DEFAULT 'unknown',
    ADD COLUMN IF NOT EXISTS "created_by_user_id"      uuid;

ALTER TABLE "public"."Home"
    ADD CONSTRAINT "Home_home_status_chk" CHECK (
        "home_status" = ANY (ARRAY['active','merged','archived']::text[])
    ),
    ADD CONSTRAINT "Home_place_type_chk2" CHECK (
        "place_type" IS NULL OR "place_type" = ANY (ARRAY[
            'single_family','unit','building','multi_parcel','rv_spot','unknown'
        ]::text[])
    );

ALTER TABLE "public"."Home"
    ADD CONSTRAINT "Home_address_id_fkey"
        FOREIGN KEY ("address_id") REFERENCES "public"."HomeAddress"("id") ON DELETE SET NULL,
    ADD CONSTRAINT "Home_parent_home_id_fkey"
        FOREIGN KEY ("parent_home_id") REFERENCES "public"."Home"("id") ON DELETE SET NULL,
    ADD CONSTRAINT "Home_canonical_home_id_fkey"
        FOREIGN KEY ("canonical_home_id") REFERENCES "public"."Home"("id") ON DELETE SET NULL,
    ADD CONSTRAINT "Home_created_by_user_id_fkey"
        FOREIGN KEY ("created_by_user_id") REFERENCES "public"."User"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "idx_home_address_hash_active"
    ON "public"."Home" ("address_hash") WHERE "home_status" = 'active';

CREATE INDEX IF NOT EXISTS "idx_home_security_state"
    ON "public"."Home" ("security_state") WHERE "security_state" <> 'normal';

CREATE INDEX IF NOT EXISTS "idx_home_parent"
    ON "public"."Home" ("parent_home_id") WHERE "parent_home_id" IS NOT NULL;

-- Backfill address_hash for existing rows
UPDATE "public"."Home"
SET "address_hash" = "public"."normalize_address_hash"(
    "address", "address2", "city", "state", "zipcode", "country"
)
WHERE "address_hash" IS NULL;

-- Backfill created_by_user_id from owner_id where missing
UPDATE "public"."Home"
SET "created_by_user_id" = "owner_id"
WHERE "created_by_user_id" IS NULL AND "owner_id" IS NOT NULL;


-- ============================================================
-- 6. HomeOwner TABLE (legal ownership, separate from occupancy)
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."HomeOwner" (
    "id"                  uuid DEFAULT gen_random_uuid() NOT NULL,
    "home_id"             uuid NOT NULL,
    "subject_type"        "public"."subject_type" NOT NULL DEFAULT 'user',
    "subject_id"          uuid NOT NULL,
    "owner_status"        "public"."owner_status_type" NOT NULL DEFAULT 'pending',
    "is_primary_owner"    boolean NOT NULL DEFAULT false,
    "added_via"           "public"."owner_added_via" NOT NULL DEFAULT 'claim',
    "verification_tier"   "public"."owner_verification_tier" NOT NULL DEFAULT 'weak',
    "created_at"          timestamptz NOT NULL DEFAULT now(),
    "updated_at"          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "HomeOwner_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "HomeOwner_home_id_fkey"
        FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE
);
ALTER TABLE "public"."HomeOwner" OWNER TO "postgres";

-- At most one primary owner per home
CREATE UNIQUE INDEX IF NOT EXISTS "homeowner_primary_unique"
    ON "public"."HomeOwner" ("home_id") WHERE "is_primary_owner" = true;

-- Prevent duplicate user ownership rows per home
CREATE UNIQUE INDEX IF NOT EXISTS "homeowner_subject_unique"
    ON "public"."HomeOwner" ("home_id", "subject_type", "subject_id")
    WHERE "owner_status" <> 'revoked';

CREATE INDEX IF NOT EXISTS "idx_homeowner_home"
    ON "public"."HomeOwner" ("home_id");

CREATE INDEX IF NOT EXISTS "idx_homeowner_subject"
    ON "public"."HomeOwner" ("subject_id");

-- Backfill: create HomeOwner rows from existing Home.owner_id
INSERT INTO "public"."HomeOwner" ("home_id", "subject_type", "subject_id", "owner_status", "is_primary_owner", "added_via", "verification_tier")
SELECT
    h."id",
    'user'::"public"."subject_type",
    h."owner_id",
    'verified'::"public"."owner_status_type",
    true,
    'claim'::"public"."owner_added_via",
    'standard'::"public"."owner_verification_tier"
FROM "public"."Home" h
WHERE h."owner_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "public"."HomeOwner" ho
    WHERE ho."home_id" = h."id" AND ho."subject_id" = h."owner_id"
  );


-- ============================================================
-- 7. HomeOwnershipClaim TABLE (full claim state machine)
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."HomeOwnershipClaim" (
    "id"                         uuid DEFAULT gen_random_uuid() NOT NULL,
    "home_id"                    uuid NOT NULL,
    "claimant_user_id"           uuid NOT NULL,
    "claim_type"                 text NOT NULL DEFAULT 'owner',
    "state"                      "public"."ownership_claim_state" NOT NULL DEFAULT 'draft',
    "method"                     "public"."ownership_claim_method",
    "risk_score"                 numeric(5,2) DEFAULT 0,
    "challenge_window_ends_at"   timestamptz,
    "reviewed_by"                uuid,
    "reviewed_at"                timestamptz,
    "review_note"                text,
    "created_at"                 timestamptz NOT NULL DEFAULT now(),
    "updated_at"                 timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "HomeOwnershipClaim_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "HomeOwnershipClaim_home_id_fkey"
        FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE,
    CONSTRAINT "HomeOwnershipClaim_claimant_fkey"
        FOREIGN KEY ("claimant_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE,
    CONSTRAINT "HomeOwnershipClaim_reviewer_fkey"
        FOREIGN KEY ("reviewed_by") REFERENCES "public"."User"("id") ON DELETE SET NULL,
    CONSTRAINT "HomeOwnershipClaim_type_chk" CHECK (
        "claim_type" = ANY (ARRAY['owner','admin','resident']::text[])
    )
);
ALTER TABLE "public"."HomeOwnershipClaim" OWNER TO "postgres";

CREATE INDEX IF NOT EXISTS "idx_ownership_claim_home_state"
    ON "public"."HomeOwnershipClaim" ("home_id", "state");

CREATE INDEX IF NOT EXISTS "idx_ownership_claim_claimant"
    ON "public"."HomeOwnershipClaim" ("claimant_user_id", "state");


-- ============================================================
-- 8. HomeVerificationEvidence TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."HomeVerificationEvidence" (
    "id"                uuid DEFAULT gen_random_uuid() NOT NULL,
    "claim_id"          uuid NOT NULL,
    "evidence_type"     text NOT NULL,
    "provider"          text NOT NULL DEFAULT 'manual',
    "status"            text NOT NULL DEFAULT 'pending',
    "redaction_status"  text NOT NULL DEFAULT 'required',
    "storage_ref"       text,
    "metadata"          jsonb DEFAULT '{}'::jsonb,
    "created_at"        timestamptz NOT NULL DEFAULT now(),
    "updated_at"        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "HomeVerificationEvidence_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "HomeVerificationEvidence_claim_fkey"
        FOREIGN KEY ("claim_id") REFERENCES "public"."HomeOwnershipClaim"("id") ON DELETE CASCADE,
    CONSTRAINT "HomeVerificationEvidence_type_chk" CHECK (
        "evidence_type" = ANY (ARRAY[
            'deed','closing_disclosure','tax_bill','utility_bill',
            'lease','idv','escrow_attestation','title_match'
        ]::text[])
    ),
    CONSTRAINT "HomeVerificationEvidence_provider_chk" CHECK (
        "provider" = ANY (ARRAY['manual','stripe_identity','attom','corelogic','other']::text[])
    ),
    CONSTRAINT "HomeVerificationEvidence_status_chk" CHECK (
        "status" = ANY (ARRAY['pending','verified','failed']::text[])
    ),
    CONSTRAINT "HomeVerificationEvidence_redact_chk" CHECK (
        "redaction_status" = ANY (ARRAY['required','ok']::text[])
    )
);
ALTER TABLE "public"."HomeVerificationEvidence" OWNER TO "postgres";

CREATE INDEX IF NOT EXISTS "idx_evidence_claim"
    ON "public"."HomeVerificationEvidence" ("claim_id");


-- ============================================================
-- 9. HomeQuorumAction TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."HomeQuorumAction" (
    "id"                    uuid DEFAULT gen_random_uuid() NOT NULL,
    "home_id"               uuid NOT NULL,
    "proposed_by"           uuid NOT NULL,
    "action_type"           text NOT NULL,
    "state"                 "public"."quorum_action_state" NOT NULL DEFAULT 'proposed',
    "risk_tier"             smallint NOT NULL DEFAULT 0,
    "required_rule"         text NOT NULL DEFAULT 'majority',
    "required_approvals"    smallint NOT NULL DEFAULT 1,
    "min_rejects_to_block"  smallint NOT NULL DEFAULT 1,
    "expires_at"            timestamptz,
    "passive_approval_at"   timestamptz,
    "metadata"              jsonb DEFAULT '{}'::jsonb,
    "created_at"            timestamptz NOT NULL DEFAULT now(),
    "updated_at"            timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "HomeQuorumAction_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "HomeQuorumAction_home_fkey"
        FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE,
    CONSTRAINT "HomeQuorumAction_proposer_fkey"
        FOREIGN KEY ("proposed_by") REFERENCES "public"."User"("id") ON DELETE CASCADE,
    CONSTRAINT "HomeQuorumAction_action_type_chk" CHECK (
        "action_type" = ANY (ARRAY[
            'CHANGE_OWNER_CLAIM_POLICY','REMOVE_OWNER','TRANSFER_OWNERSHIP',
            'CHANGE_PRIMARY_OWNER','MAIL_ROUTING_CHANGE','FREEZE_HOME',
            'CHANGE_MEMBER_ATTACH_POLICY','ADD_SERVICE_PROVIDER',
            'CHANGE_PRIVACY_MASK','CHANGE_TENURE_MODE'
        ]::text[])
    ),
    CONSTRAINT "HomeQuorumAction_rule_chk" CHECK (
        "required_rule" = ANY (ARRAY['2_of_n','majority','primary_plus_one']::text[])
    ),
    CONSTRAINT "HomeQuorumAction_risk_chk" CHECK ("risk_tier" BETWEEN 0 AND 3)
);
ALTER TABLE "public"."HomeQuorumAction" OWNER TO "postgres";

CREATE INDEX IF NOT EXISTS "idx_quorum_home_state"
    ON "public"."HomeQuorumAction" ("home_id", "state");


-- ============================================================
-- 10. HomeQuorumVote TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."HomeQuorumVote" (
    "id"                uuid DEFAULT gen_random_uuid() NOT NULL,
    "quorum_action_id"  uuid NOT NULL,
    "voter_user_id"     uuid NOT NULL,
    "vote"              text NOT NULL,
    "reason"            text,
    "voted_at"          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "HomeQuorumVote_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "HomeQuorumVote_action_fkey"
        FOREIGN KEY ("quorum_action_id") REFERENCES "public"."HomeQuorumAction"("id") ON DELETE CASCADE,
    CONSTRAINT "HomeQuorumVote_voter_fkey"
        FOREIGN KEY ("voter_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE,
    CONSTRAINT "HomeQuorumVote_vote_chk" CHECK (
        "vote" = ANY (ARRAY['approve','reject']::text[])
    )
);
ALTER TABLE "public"."HomeQuorumVote" OWNER TO "postgres";

CREATE UNIQUE INDEX IF NOT EXISTS "quorumvote_unique_voter"
    ON "public"."HomeQuorumVote" ("quorum_action_id", "voter_user_id");


-- ============================================================
-- 11. ALTER HomeOccupancy — new roles + access window
-- ============================================================

-- Drop old constraint, add expanded one with lease_resident and service_provider
ALTER TABLE "public"."HomeOccupancy" DROP CONSTRAINT IF EXISTS "HomeOccupancy_role_check";
ALTER TABLE "public"."HomeOccupancy" ADD CONSTRAINT "HomeOccupancy_role_check" CHECK (
    "role" = ANY (ARRAY[
        'owner','tenant','member','guest','renter','roommate','family',
        'property_manager','caregiver','admin','manager','restricted_member',
        'lease_resident','service_provider'
    ]::text[])
);

ALTER TABLE "public"."HomeOccupancy"
    ADD COLUMN IF NOT EXISTS "access_start_at"  timestamptz,
    ADD COLUMN IF NOT EXISTS "access_end_at"    timestamptz,
    ADD COLUMN IF NOT EXISTS "added_by_user_id" uuid;

ALTER TABLE "public"."HomeOccupancy"
    ADD CONSTRAINT "HomeOccupancy_added_by_fkey"
        FOREIGN KEY ("added_by_user_id") REFERENCES "public"."User"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "idx_home_occ_access_window"
    ON "public"."HomeOccupancy" ("home_id", "access_start_at", "access_end_at")
    WHERE "access_end_at" IS NOT NULL;


-- ============================================================
-- 12. ALTER HomeAuditLog — before/after snapshots
-- ============================================================

ALTER TABLE "public"."HomeAuditLog"
    ADD COLUMN IF NOT EXISTS "before_data" jsonb,
    ADD COLUMN IF NOT EXISTS "after_data"  jsonb;


-- ============================================================
-- 13. Seed HomeRolePermission for new roles + permissions
-- ============================================================

-- Owner gets all new permissions
INSERT INTO "public"."HomeRolePermission" ("role_base", "permission", "allowed")
VALUES
    ('owner', 'ownership.view',     true),
    ('owner', 'ownership.manage',   true),
    ('owner', 'ownership.transfer', true),
    ('owner', 'security.manage',    true),
    ('owner', 'dispute.view',       true),
    ('owner', 'dispute.manage',     true),
    ('owner', 'quorum.vote',        true),
    ('owner', 'quorum.propose',     true)
ON CONFLICT DO NOTHING;

-- Admin gets view + vote
INSERT INTO "public"."HomeRolePermission" ("role_base", "permission", "allowed")
VALUES
    ('admin', 'ownership.view',   true),
    ('admin', 'dispute.view',     true),
    ('admin', 'quorum.vote',      true),
    ('admin', 'quorum.propose',   true)
ON CONFLICT DO NOTHING;

-- lease_resident: basic view permissions
INSERT INTO "public"."HomeRolePermission" ("role_base", "permission", "allowed")
VALUES
    ('lease_resident', 'home.view',       true),
    ('lease_resident', 'members.view',    true),
    ('lease_resident', 'tasks.view',      true),
    ('lease_resident', 'tasks.edit',      true),
    ('lease_resident', 'packages.view',   true),
    ('lease_resident', 'calendar.view',   true),
    ('lease_resident', 'calendar.edit',   true),
    ('lease_resident', 'access.view_wifi', true)
ON CONFLICT DO NOTHING;

-- service_provider: minimal access
INSERT INTO "public"."HomeRolePermission" ("role_base", "permission", "allowed")
VALUES
    ('service_provider', 'home.view',         true),
    ('service_provider', 'maintenance.view',  true),
    ('service_provider', 'maintenance.edit',  true),
    ('service_provider', 'tasks.view',        true)
ON CONFLICT DO NOTHING;


-- ============================================================
-- 14. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE "public"."HomeAddress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."HomeOwner" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."HomeOwnershipClaim" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."HomeVerificationEvidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."HomeQuorumAction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."HomeQuorumVote" ENABLE ROW LEVEL SECURITY;

-- HomeAddress: visible to members of homes referencing it
CREATE POLICY "homeaddress_select_members" ON "public"."HomeAddress"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM "public"."Home" h
            JOIN "public"."HomeOccupancy" ho ON ho."home_id" = h."id"
            WHERE h."address_id" = "HomeAddress"."id"
              AND ho."user_id" = auth.uid()
              AND ho."is_active" = true
        )
    );

-- HomeOwner: visible to co-owners and active home members
CREATE POLICY "homeowner_select" ON "public"."HomeOwner"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM "public"."HomeOccupancy" ho
            WHERE ho."home_id" = "HomeOwner"."home_id"
              AND ho."user_id" = auth.uid()
              AND ho."is_active" = true
        )
        OR "HomeOwner"."subject_id" = auth.uid()
    );

-- HomeOwnershipClaim: claimant sees own; owners see all claims on their home
CREATE POLICY "ownershipclaim_select" ON "public"."HomeOwnershipClaim"
    FOR SELECT USING (
        "claimant_user_id" = auth.uid()
        OR EXISTS (
            SELECT 1 FROM "public"."HomeOwner" ho
            WHERE ho."home_id" = "HomeOwnershipClaim"."home_id"
              AND ho."subject_id" = auth.uid()
              AND ho."owner_status" IN ('verified','pending')
        )
    );

-- HomeVerificationEvidence: visible to claim owner or home owners
CREATE POLICY "evidence_select" ON "public"."HomeVerificationEvidence"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM "public"."HomeOwnershipClaim" c
            WHERE c."id" = "HomeVerificationEvidence"."claim_id"
              AND (
                  c."claimant_user_id" = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM "public"."HomeOwner" ho
                      WHERE ho."home_id" = c."home_id"
                        AND ho."subject_id" = auth.uid()
                        AND ho."owner_status" IN ('verified','pending')
                  )
              )
        )
    );

-- HomeQuorumAction: visible to home owners
CREATE POLICY "quorum_action_select" ON "public"."HomeQuorumAction"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM "public"."HomeOwner" ho
            WHERE ho."home_id" = "HomeQuorumAction"."home_id"
              AND ho."subject_id" = auth.uid()
              AND ho."owner_status" = 'verified'
        )
    );

-- HomeQuorumVote: visible to home owners
CREATE POLICY "quorum_vote_select" ON "public"."HomeQuorumVote"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM "public"."HomeQuorumAction" qa
            JOIN "public"."HomeOwner" ho ON ho."home_id" = qa."home_id"
            WHERE qa."id" = "HomeQuorumVote"."quorum_action_id"
              AND ho."subject_id" = auth.uid()
              AND ho."owner_status" = 'verified'
        )
    );

-- Service-role bypass policies (for backend supabaseAdmin)
CREATE POLICY "homeaddress_service" ON "public"."HomeAddress"
    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "homeowner_service" ON "public"."HomeOwner"
    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "ownershipclaim_service" ON "public"."HomeOwnershipClaim"
    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "evidence_service" ON "public"."HomeVerificationEvidence"
    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "quorum_action_service" ON "public"."HomeQuorumAction"
    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "quorum_vote_service" ON "public"."HomeQuorumVote"
    FOR ALL USING (auth.role() = 'service_role');


COMMIT;
