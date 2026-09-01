-- ============================================================
-- Migration 046: Mailbox Phase 1 — Routing, Drawers, Packages, Earn
-- ============================================================

-- 1. Extend Mail table with Phase 1 columns
-- ============================================================

ALTER TABLE "public"."Mail"
  ADD COLUMN IF NOT EXISTS "drawer" text DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS "recipient_name" text,
  ADD COLUMN IF NOT EXISTS "recipient_address_id" uuid,
  ADD COLUMN IF NOT EXISTS "sender_display" text,
  ADD COLUMN IF NOT EXISTS "sender_logo_url" text,
  ADD COLUMN IF NOT EXISTS "sender_trust" text DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS "urgency" text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS "privacy" text DEFAULT 'private_to_person',
  ADD COLUMN IF NOT EXISTS "lifecycle" text DEFAULT 'delivered',
  ADD COLUMN IF NOT EXISTS "due_date" date,
  ADD COLUMN IF NOT EXISTS "opened_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "key_facts" jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "mail_object_type" text DEFAULT 'envelope',
  ADD COLUMN IF NOT EXISTS "routing_confidence" real,
  ADD COLUMN IF NOT EXISTS "routing_method" text;

-- Constraints
DO $$ BEGIN
  ALTER TABLE "public"."Mail" ADD CONSTRAINT "Mail_drawer_check"
    CHECK (drawer IS NULL OR drawer = ANY(ARRAY['personal','home','business','earn']));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."Mail" ADD CONSTRAINT "Mail_sender_trust_check"
    CHECK (sender_trust IS NULL OR sender_trust = ANY(ARRAY['verified_gov','verified_utility','verified_business','pantopus_user','unknown']));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."Mail" ADD CONSTRAINT "Mail_urgency_check"
    CHECK (urgency IS NULL OR urgency = ANY(ARRAY['none','due_soon','overdue','time_sensitive']));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."Mail" ADD CONSTRAINT "Mail_privacy_check"
    CHECK (privacy IS NULL OR privacy = ANY(ARRAY['private_to_person','shared_household','business_team']));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."Mail" ADD CONSTRAINT "Mail_lifecycle_check"
    CHECK (lifecycle IS NULL OR lifecycle = ANY(ARRAY['delivered','opened','filed','shredded','forwarded','claimed','archived']));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."Mail" ADD CONSTRAINT "Mail_mail_object_type_check"
    CHECK (mail_object_type IS NULL OR mail_object_type = ANY(ARRAY['envelope','postcard','package']));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Indexes for drawer-based queries
CREATE INDEX IF NOT EXISTS "idx_mail_drawer" ON "public"."Mail" USING btree ("drawer");
CREATE INDEX IF NOT EXISTS "idx_mail_urgency" ON "public"."Mail" USING btree ("urgency") WHERE urgency != 'none';
CREATE INDEX IF NOT EXISTS "idx_mail_lifecycle" ON "public"."Mail" USING btree ("lifecycle");
CREATE INDEX IF NOT EXISTS "idx_mail_due_date" ON "public"."Mail" USING btree ("due_date") WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_mail_object_type" ON "public"."Mail" USING btree ("mail_object_type");
CREATE INDEX IF NOT EXISTS "idx_mail_recipient_address" ON "public"."Mail" USING btree ("recipient_address_id") WHERE recipient_address_id IS NOT NULL;

-- 2. MailPackage — package-specific extended data
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."MailPackage" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "mail_id" uuid NOT NULL REFERENCES "public"."Mail"("id") ON DELETE CASCADE,
  "carrier" text,
  "tracking_id_masked" text,
  "tracking_id_hash" text,
  "weight_lbs" real,
  "dimensions_l" real,
  "dimensions_w" real,
  "dimensions_h" real,
  "fragile" boolean DEFAULT false,
  "estimated_value" numeric(10,2),
  "eta_earliest" timestamp with time zone,
  "eta_latest" timestamp with time zone,
  "eta_confidence" text DEFAULT 'medium',
  "delivery_photo_url" text,
  "delivery_location_note" text,
  "status" text DEFAULT 'pre_receipt',
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "MailPackage_eta_confidence_check"
    CHECK (eta_confidence = ANY(ARRAY['high','medium','low'])),
  CONSTRAINT "MailPackage_status_check"
    CHECK (status = ANY(ARRAY['pre_receipt','in_transit','out_for_delivery','delivered','exception'])),
  CONSTRAINT "MailPackage_mail_id_unique" UNIQUE ("mail_id")
);

CREATE INDEX IF NOT EXISTS "idx_mail_package_mail_id" ON "public"."MailPackage" USING btree ("mail_id");
CREATE INDEX IF NOT EXISTS "idx_mail_package_status" ON "public"."MailPackage" USING btree ("status");

-- 3. PackageEvent — timeline events for packages
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."PackageEvent" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "package_id" uuid NOT NULL REFERENCES "public"."MailPackage"("id") ON DELETE CASCADE,
  "status" text NOT NULL,
  "location" text,
  "occurred_at" timestamp with time zone NOT NULL,
  "photo_url" text,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_package_event_package_id" ON "public"."PackageEvent" USING btree ("package_id");

-- 4. MailAlias — user name aliases for routing
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."MailAlias" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES "public"."User"("id") ON DELETE CASCADE,
  "home_id" uuid NOT NULL REFERENCES "public"."Home"("id") ON DELETE CASCADE,
  "alias" text NOT NULL,
  "alias_normalized" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "MailAlias_unique_alias_per_home" UNIQUE ("home_id", "alias_normalized")
);

CREATE INDEX IF NOT EXISTS "idx_mail_alias_user" ON "public"."MailAlias" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "idx_mail_alias_home" ON "public"."MailAlias" USING btree ("home_id");
CREATE INDEX IF NOT EXISTS "idx_mail_alias_normalized" ON "public"."MailAlias" USING btree ("alias_normalized");

-- 5. MailEvent — event logging for analytics
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."MailEvent" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "event_type" text NOT NULL,
  "mail_id" uuid REFERENCES "public"."Mail"("id") ON DELETE SET NULL,
  "user_id" uuid REFERENCES "public"."User"("id") ON DELETE SET NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_mail_event_type" ON "public"."MailEvent" USING btree ("event_type");
CREATE INDEX IF NOT EXISTS "idx_mail_event_mail_id" ON "public"."MailEvent" USING btree ("mail_id") WHERE mail_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_mail_event_user_id" ON "public"."MailEvent" USING btree ("user_id") WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_mail_event_created" ON "public"."MailEvent" USING btree ("created_at" DESC);

-- 6. EarnOffer — offers that pay users to engage
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."EarnOffer" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "advertiser_id" uuid NOT NULL REFERENCES "public"."User"("id") ON DELETE CASCADE,
  "business_name" text NOT NULL,
  "business_init" text,
  "business_color" text,
  "offer_title" text NOT NULL,
  "offer_subtitle" text,
  "offer_code" text,
  "payout_amount" numeric(10,2) NOT NULL DEFAULT 0.10,
  "expires_at" timestamp with time zone,
  "status" text DEFAULT 'active',
  "max_redemptions" integer,
  "current_redemptions" integer DEFAULT 0,
  "target_cities" text[],
  "target_states" text[],
  "target_zipcodes" text[],
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "EarnOffer_status_check"
    CHECK (status = ANY(ARRAY['draft','active','paused','expired','completed']))
);

CREATE INDEX IF NOT EXISTS "idx_earn_offer_status" ON "public"."EarnOffer" USING btree ("status");
CREATE INDEX IF NOT EXISTS "idx_earn_offer_expires" ON "public"."EarnOffer" USING btree ("expires_at") WHERE expires_at IS NOT NULL;

-- 7. EarnTransaction — user earn payouts
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."EarnTransaction" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES "public"."User"("id") ON DELETE CASCADE,
  "offer_id" uuid NOT NULL REFERENCES "public"."EarnOffer"("id") ON DELETE CASCADE,
  "mail_id" uuid REFERENCES "public"."Mail"("id") ON DELETE SET NULL,
  "amount" numeric(10,2) NOT NULL,
  "status" text DEFAULT 'pending',
  "dwell_ms" integer,
  "opened_at" timestamp with time zone DEFAULT now(),
  "verified_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "EarnTransaction_status_check"
    CHECK (status = ANY(ARRAY['pending','verified','available','paid','flagged','rejected'])),
  CONSTRAINT "EarnTransaction_unique_user_offer" UNIQUE ("user_id", "offer_id")
);

CREATE INDEX IF NOT EXISTS "idx_earn_tx_user" ON "public"."EarnTransaction" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "idx_earn_tx_offer" ON "public"."EarnTransaction" USING btree ("offer_id");
CREATE INDEX IF NOT EXISTS "idx_earn_tx_status" ON "public"."EarnTransaction" USING btree ("status");

-- 8. MailRoutingQueue — pending items awaiting disambiguation
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."MailRoutingQueue" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "mail_id" uuid NOT NULL REFERENCES "public"."Mail"("id") ON DELETE CASCADE,
  "home_id" uuid NOT NULL REFERENCES "public"."Home"("id") ON DELETE CASCADE,
  "recipient_name_raw" text NOT NULL,
  "best_match_user_id" uuid,
  "best_match_confidence" real,
  "resolved" boolean DEFAULT false,
  "resolved_drawer" text,
  "resolved_by" uuid,
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "MailRoutingQueue_mail_id_unique" UNIQUE ("mail_id")
);

CREATE INDEX IF NOT EXISTS "idx_mail_routing_queue_home" ON "public"."MailRoutingQueue" USING btree ("home_id");
CREATE INDEX IF NOT EXISTS "idx_mail_routing_queue_unresolved" ON "public"."MailRoutingQueue" USING btree ("resolved") WHERE resolved = false;

-- 9. Add mailbox_notification_time to User for Mail Day
-- ============================================================

ALTER TABLE "public"."User"
  ADD COLUMN IF NOT EXISTS "mailbox_notification_time" time DEFAULT '08:00:00';
