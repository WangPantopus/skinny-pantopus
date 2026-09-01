-- Migration: Business Address Decision Engine
-- Adds canonical BusinessAddress table, BusinessMailingAddress, BusinessAddressDecision
-- audit log, and enhances BusinessLocation + BusinessProfile with address decision columns.

-- ============================================================================
-- 1. Create ENUM types
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE "public"."business_location_type" AS ENUM (
    'storefront',
    'office',
    'warehouse',
    'home_based_private',
    'service_area_only',
    'mailing_only',
    'unknown'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."business_address_decision_status" AS ENUM (
    'ok',
    'need_suite',
    'multiple_matches',
    'cmra_detected',
    'po_box',
    'place_mismatch',
    'undeliverable',
    'low_confidence',
    'conflict',
    'mixed_use',
    'high_risk',
    'service_error'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."business_location_verification_tier" AS ENUM (
    'bl0_none',
    'bl1_deliverable',
    'bl2_presence_light',
    'bl3_presence_strong',
    'bl4_managed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."business_identity_verification_tier" AS ENUM (
    'bi0_unverified',
    'bi1_basic',
    'bi2_domain_social',
    'bi3_documented',
    'bi4_authority'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. Create BusinessAddress table (canonical, deduplicated — mirrors HomeAddress)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "public"."BusinessAddress" (
  "id"                       uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "address_line1_norm"       text NOT NULL,
  "address_line2_norm"       text DEFAULT '',
  "city_norm"                text NOT NULL,
  "state"                    varchar(2) NOT NULL,
  "postal_code"              varchar(10) NOT NULL,
  "plus4"                    varchar(4) DEFAULT '',
  "country"                  varchar(2) DEFAULT 'US',
  "address_hash"             varchar(64) NOT NULL,
  "geocode_lat"              double precision,
  "geocode_lng"              double precision,
  "location"                 geography(Point, 4326),
  "is_multi_tenant"          boolean DEFAULT false,
  "is_cmra"                  boolean DEFAULT false,
  "is_po_box"                boolean DEFAULT false,
  "rdi"                      varchar(1) DEFAULT NULL,
  "place_type"               text DEFAULT NULL,
  "validation_provider"      text DEFAULT NULL,
  "validation_granularity"   text DEFAULT NULL,
  "raw_validation_response"  jsonb DEFAULT NULL,
  "created_at"               timestamptz DEFAULT now(),
  "updated_at"               timestamptz DEFAULT now()
);

ALTER TABLE "public"."BusinessAddress" OWNER TO "postgres";

-- Unique index on address_hash for deduplication
CREATE UNIQUE INDEX IF NOT EXISTS "businessaddress_hash_unique"
  ON "public"."BusinessAddress" USING btree ("address_hash");

-- Spatial index for geoqueries
CREATE INDEX IF NOT EXISTS "idx_businessaddress_geo"
  ON "public"."BusinessAddress" USING gist ("location");

-- ============================================================================
-- 3. Create BusinessMailingAddress table
-- ============================================================================

CREATE TABLE IF NOT EXISTS "public"."BusinessMailingAddress" (
  "id"               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "business_user_id" uuid NOT NULL REFERENCES "public"."User"(id) ON DELETE CASCADE,
  "address_id"       uuid REFERENCES "public"."BusinessAddress"(id) ON DELETE SET NULL,
  "address_line1"    text NOT NULL,
  "address_line2"    text DEFAULT '',
  "city"             text NOT NULL,
  "state"            varchar(2) NOT NULL,
  "postal_code"      varchar(10) NOT NULL,
  "country"          varchar(2) DEFAULT 'US',
  "is_cmra"          boolean DEFAULT false,
  "is_po_box"        boolean DEFAULT false,
  "is_primary"       boolean DEFAULT true,
  "created_at"       timestamptz DEFAULT now(),
  "updated_at"       timestamptz DEFAULT now()
);

ALTER TABLE "public"."BusinessMailingAddress" OWNER TO "postgres";

CREATE INDEX IF NOT EXISTS "idx_businessmailingaddress_business"
  ON "public"."BusinessMailingAddress" USING btree ("business_user_id");

-- ============================================================================
-- 4. ALTER BusinessLocation — add decision engine columns
-- ============================================================================

ALTER TABLE "public"."BusinessLocation"
  ADD COLUMN IF NOT EXISTS "address_id"                  uuid REFERENCES "public"."BusinessAddress"(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "address_hash"                varchar(64),
  ADD COLUMN IF NOT EXISTS "location_type"               "public"."business_location_type" DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS "location_verification_tier"  "public"."business_location_verification_tier" DEFAULT 'bl0_none',
  ADD COLUMN IF NOT EXISTS "is_customer_facing"          boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "decision_status"             "public"."business_address_decision_status" DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "decision_reasons"            text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "capabilities"                jsonb DEFAULT '{"map_pin": false, "show_in_nearby": false, "receive_mail": true, "enable_payouts": false}',
  ADD COLUMN IF NOT EXISTS "required_verification"       text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "service_area"                jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "verified_at"                 timestamptz DEFAULT NULL;

-- Indexes for new BusinessLocation columns
CREATE INDEX IF NOT EXISTS "idx_bloc_address_id"
  ON "public"."BusinessLocation" USING btree ("address_id");

CREATE INDEX IF NOT EXISTS "idx_bloc_address_hash"
  ON "public"."BusinessLocation" USING btree ("address_hash");

CREATE INDEX IF NOT EXISTS "idx_bloc_conflict_detect"
  ON "public"."BusinessLocation" USING btree ("address_hash", "address2")
  WHERE ("is_active" = true);

-- ============================================================================
-- 5. ALTER BusinessProfile — add identity verification + mailing address
-- ============================================================================

ALTER TABLE "public"."BusinessProfile"
  ADD COLUMN IF NOT EXISTS "identity_verification_tier"  "public"."business_identity_verification_tier" DEFAULT 'bi0_unverified',
  ADD COLUMN IF NOT EXISTS "mailing_address_id"          uuid REFERENCES "public"."BusinessMailingAddress"(id) ON DELETE SET NULL;

-- ============================================================================
-- 6. Create BusinessAddressDecision table (audit log)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "public"."BusinessAddressDecision" (
  "id"                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "business_user_id"        uuid REFERENCES "public"."User"(id) ON DELETE CASCADE,
  "location_id"             uuid REFERENCES "public"."BusinessLocation"(id) ON DELETE SET NULL,
  "input_address"           text NOT NULL,
  "input_address2"          text DEFAULT '',
  "input_city"              text,
  "input_state"             text,
  "input_zipcode"           text,
  "input_place_id"          text,
  "input_location_intent"   text,
  "decision_status"         "public"."business_address_decision_status" NOT NULL,
  "decision_reasons"        text[] DEFAULT '{}',
  "business_location_type"  "public"."business_location_type",
  "capabilities"            jsonb,
  "required_verification"   text[],
  "canonical_address_id"    uuid REFERENCES "public"."BusinessAddress"(id) ON DELETE SET NULL,
  "candidates"              jsonb DEFAULT '[]',
  "raw_validation_response" jsonb DEFAULT NULL,
  "created_at"              timestamptz DEFAULT now()
);

ALTER TABLE "public"."BusinessAddressDecision" OWNER TO "postgres";

CREATE INDEX IF NOT EXISTS "idx_businessaddressdecision_business"
  ON "public"."BusinessAddressDecision" USING btree ("business_user_id");

CREATE INDEX IF NOT EXISTS "idx_businessaddressdecision_canonical"
  ON "public"."BusinessAddressDecision" USING btree ("canonical_address_id");

-- ============================================================================
-- 7. Enable RLS on new tables
-- ============================================================================

ALTER TABLE "public"."BusinessAddress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."BusinessMailingAddress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."BusinessAddressDecision" ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 8. RLS policies — BusinessAddress
--    Public read (any authenticated user can look up canonical addresses),
--    service_role for insert/update (only backend writes canonical records).
-- ============================================================================

CREATE POLICY "businessaddress_select_authenticated"
  ON "public"."BusinessAddress"
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "businessaddress_service"
  ON "public"."BusinessAddress"
  USING ("auth"."role"() = 'service_role'::text);

-- ============================================================================
-- 9. RLS policies — BusinessMailingAddress
--    Owner read/write via business_user_id = auth.uid()
-- ============================================================================

CREATE POLICY "businessmailingaddress_select_owner"
  ON "public"."BusinessMailingAddress"
  FOR SELECT
  USING ("business_user_id" = "auth"."uid"());

CREATE POLICY "businessmailingaddress_insert_owner"
  ON "public"."BusinessMailingAddress"
  FOR INSERT
  WITH CHECK ("business_user_id" = "auth"."uid"());

CREATE POLICY "businessmailingaddress_update_owner"
  ON "public"."BusinessMailingAddress"
  FOR UPDATE
  USING ("business_user_id" = "auth"."uid"())
  WITH CHECK ("business_user_id" = "auth"."uid"());

CREATE POLICY "businessmailingaddress_delete_owner"
  ON "public"."BusinessMailingAddress"
  FOR DELETE
  USING ("business_user_id" = "auth"."uid"());

-- ============================================================================
-- 10. RLS policies — BusinessAddressDecision
--     Owner read via business_user_id = auth.uid(),
--     service_role for insert (only backend writes decision records).
-- ============================================================================

CREATE POLICY "businessaddressdecision_select_owner"
  ON "public"."BusinessAddressDecision"
  FOR SELECT
  USING ("business_user_id" = "auth"."uid"());

CREATE POLICY "businessaddressdecision_service"
  ON "public"."BusinessAddressDecision"
  USING ("auth"."role"() = 'service_role'::text);
