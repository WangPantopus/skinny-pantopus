-- ============================================================
-- Migration 047: Mailbox Phase 2 — Booklets, Bundles, Certified,
-- Mail Party, Vault, Coupon Pipeline, Advanced Anti-Gaming
-- ============================================================

-- 1. Extend Mail table with Phase 2 columns
-- ============================================================

ALTER TABLE "public"."Mail"
  ADD COLUMN IF NOT EXISTS "certified" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "requires_acknowledgment" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "acknowledged_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "acknowledged_by" uuid,
  ADD COLUMN IF NOT EXISTS "audit_trail" jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "legal_timestamp" text,
  ADD COLUMN IF NOT EXISTS "sender_confirmation_url" text,
  -- Booklet fields
  ADD COLUMN IF NOT EXISTS "page_count" integer,
  ADD COLUMN IF NOT EXISTS "cover_image_url" text,
  ADD COLUMN IF NOT EXISTS "download_url" text,
  ADD COLUMN IF NOT EXISTS "download_size_bytes" bigint,
  ADD COLUMN IF NOT EXISTS "streaming_available" boolean DEFAULT false,
  -- Bundle fields
  ADD COLUMN IF NOT EXISTS "bundle_id" uuid,
  ADD COLUMN IF NOT EXISTS "bundle_label" text,
  ADD COLUMN IF NOT EXISTS "bundle_type" text,
  ADD COLUMN IF NOT EXISTS "collapsed_by_default" boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS "bundle_item_count" integer DEFAULT 0,
  -- Vault folder reference
  ADD COLUMN IF NOT EXISTS "vault_folder_id" uuid;

-- Update mail_object_type constraint to include booklet and bundle
DO $$ BEGIN
  ALTER TABLE "public"."Mail" DROP CONSTRAINT IF EXISTS "Mail_mail_object_type_check";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."Mail" ADD CONSTRAINT "Mail_mail_object_type_check"
    CHECK (mail_object_type IS NULL OR mail_object_type = ANY(ARRAY[
      'envelope','postcard','package','booklet','bundle'
    ]));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Bundle type constraint
DO $$ BEGIN
  ALTER TABLE "public"."Mail" ADD CONSTRAINT "Mail_bundle_type_check"
    CHECK (bundle_type IS NULL OR bundle_type = ANY(ARRAY[
      'auto','manual','sender_grouped','date_grouped'
    ]));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Index for bundle lookups
CREATE INDEX IF NOT EXISTS "idx_mail_bundle_id" ON "public"."Mail" USING btree ("bundle_id") WHERE bundle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_mail_certified" ON "public"."Mail" USING btree ("certified") WHERE certified = true;
CREATE INDEX IF NOT EXISTS "idx_mail_vault_folder" ON "public"."Mail" USING btree ("vault_folder_id") WHERE vault_folder_id IS NOT NULL;

-- Full-text search index on extracted content for vault search
CREATE INDEX IF NOT EXISTS "idx_mail_content_fts"
  ON "public"."Mail" USING gin (to_tsvector('english',
    COALESCE(subject, '') || ' ' ||
    COALESCE(content, '') || ' ' ||
    COALESCE(sender_display, '')
  ));

-- 2. BookletPage — pages within a booklet mail item
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."BookletPage" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "mail_id" uuid NOT NULL REFERENCES "public"."Mail"("id") ON DELETE CASCADE,
  "page_number" integer NOT NULL,
  "image_url" text,
  "text_content" text,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "BookletPage_unique_page" UNIQUE ("mail_id", "page_number")
);

CREATE INDEX IF NOT EXISTS "idx_booklet_page_mail" ON "public"."BookletPage" USING btree ("mail_id");
CREATE INDEX IF NOT EXISTS "idx_booklet_page_text_fts"
  ON "public"."BookletPage" USING gin (to_tsvector('english', COALESCE(text_content, '')));

-- 3. VaultFolder — smart folders for organizing mail
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."VaultFolder" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES "public"."User"("id") ON DELETE CASCADE,
  "home_id" uuid REFERENCES "public"."Home"("id") ON DELETE SET NULL,
  "drawer" text NOT NULL,
  "label" text NOT NULL,
  "icon" text,
  "color" text,
  "system" boolean DEFAULT false,
  "item_count" integer DEFAULT 0,
  "auto_file_rules" jsonb DEFAULT '[]'::jsonb,
  "last_item_preview" text,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "VaultFolder_drawer_check"
    CHECK (drawer = ANY(ARRAY['personal','home','business']))
);

CREATE INDEX IF NOT EXISTS "idx_vault_folder_user" ON "public"."VaultFolder" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "idx_vault_folder_drawer" ON "public"."VaultFolder" USING btree ("drawer");
CREATE INDEX IF NOT EXISTS "idx_vault_folder_home" ON "public"."VaultFolder" USING btree ("home_id") WHERE home_id IS NOT NULL;

-- 4. MailPartySession — synchronized household mail opening
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."MailPartySession" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "mail_id" uuid NOT NULL REFERENCES "public"."Mail"("id") ON DELETE CASCADE,
  "home_id" uuid NOT NULL REFERENCES "public"."Home"("id") ON DELETE CASCADE,
  "initiated_by" uuid NOT NULL REFERENCES "public"."User"("id") ON DELETE CASCADE,
  "status" text DEFAULT 'pending',
  "created_at" timestamp with time zone DEFAULT now(),
  "opened_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  CONSTRAINT "MailPartySession_status_check"
    CHECK (status = ANY(ARRAY['pending','active','completed','expired']))
);

CREATE INDEX IF NOT EXISTS "idx_mail_party_mail" ON "public"."MailPartySession" USING btree ("mail_id");
CREATE INDEX IF NOT EXISTS "idx_mail_party_home" ON "public"."MailPartySession" USING btree ("home_id");
CREATE INDEX IF NOT EXISTS "idx_mail_party_status" ON "public"."MailPartySession" USING btree ("status") WHERE status IN ('pending','active');

-- 5. MailPartyParticipant — members in a party session
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."MailPartyParticipant" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "session_id" uuid NOT NULL REFERENCES "public"."MailPartySession"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "public"."User"("id") ON DELETE CASCADE,
  "name" text,
  "joined_at" timestamp with time zone,
  "present" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "MailPartyParticipant_unique" UNIQUE ("session_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "idx_mail_party_participant_session" ON "public"."MailPartyParticipant" USING btree ("session_id");

-- 6. OfferRedemption — coupon → order pipeline tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."OfferRedemption" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "offer_id" uuid NOT NULL REFERENCES "public"."EarnOffer"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "public"."User"("id") ON DELETE CASCADE,
  "merchant_id" uuid REFERENCES "public"."User"("id") ON DELETE SET NULL,
  "redemption_type" text NOT NULL DEFAULT 'code_reveal',
  "order_id" uuid,
  "order_total" numeric(10,2),
  "discount_applied" numeric(10,2),
  "code" text,
  "code_revealed_at" timestamp with time zone,
  "status" text DEFAULT 'pending',
  "created_at" timestamp with time zone DEFAULT now(),
  "redeemed_at" timestamp with time zone,
  CONSTRAINT "OfferRedemption_type_check"
    CHECK (redemption_type = ANY(ARRAY['in_app_order','code_reveal','save','in_store_qr'])),
  CONSTRAINT "OfferRedemption_status_check"
    CHECK (status = ANY(ARRAY['pending','redeemed','expired','cancelled']))
);

CREATE INDEX IF NOT EXISTS "idx_offer_redemption_offer" ON "public"."OfferRedemption" USING btree ("offer_id");
CREATE INDEX IF NOT EXISTS "idx_offer_redemption_user" ON "public"."OfferRedemption" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "idx_offer_redemption_order" ON "public"."OfferRedemption" USING btree ("order_id") WHERE order_id IS NOT NULL;

-- 7. Extend EarnOffer with Phase 2 merchant linking
-- ============================================================

ALTER TABLE "public"."EarnOffer"
  ADD COLUMN IF NOT EXISTS "merchant_id" uuid,
  ADD COLUMN IF NOT EXISTS "merchant_on_pantopus" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "discount_type" text DEFAULT 'percentage',
  ADD COLUMN IF NOT EXISTS "discount_value" numeric(10,2),
  ADD COLUMN IF NOT EXISTS "qr_code_url" text;

-- 8. Extend EarnTransaction with Phase 2 risk scoring
-- ============================================================

ALTER TABLE "public"."EarnTransaction"
  ADD COLUMN IF NOT EXISTS "risk_score" integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "risk_flags" jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "review_reason" text,
  ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "reviewed_by" uuid;

-- Update EarnTransaction status constraint to include Phase 2 states
DO $$ BEGIN
  ALTER TABLE "public"."EarnTransaction" DROP CONSTRAINT IF EXISTS "EarnTransaction_status_check";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."EarnTransaction" ADD CONSTRAINT "EarnTransaction_status_check"
    CHECK (status = ANY(ARRAY[
      'pending','verified','available','paid',
      'flagged','rejected','under_review','suspended'
    ]));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 9. EarnRiskSession — per-session risk tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."EarnRiskSession" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES "public"."User"("id") ON DELETE CASCADE,
  "session_start" timestamp with time zone DEFAULT now(),
  "opens_count" integer DEFAULT 0,
  "total_dwell_ms" bigint DEFAULT 0,
  "distinct_advertisers" integer DEFAULT 0,
  "saves_count" integer DEFAULT 0,
  "reveals_count" integer DEFAULT 0,
  "risk_score" integer DEFAULT 0,
  "ip_hash" text,
  "device_fingerprint" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_earn_risk_user" ON "public"."EarnRiskSession" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "idx_earn_risk_score" ON "public"."EarnRiskSession" USING btree ("risk_score") WHERE risk_score >= 30;

-- 10. EarnSuspension — user earn suspensions
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."EarnSuspension" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES "public"."User"("id") ON DELETE CASCADE,
  "reason" text NOT NULL,
  "risk_score" integer,
  "duration_days" integer DEFAULT 7,
  "started_at" timestamp with time zone DEFAULT now(),
  "expires_at" timestamp with time zone,
  "appealed" boolean DEFAULT false,
  "appeal_text" text,
  "appeal_at" timestamp with time zone,
  "resolved" boolean DEFAULT false,
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_earn_suspension_user" ON "public"."EarnSuspension" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "idx_earn_suspension_active" ON "public"."EarnSuspension" USING btree ("resolved") WHERE resolved = false;

-- 11. Extend MailPackage for Phase 2 (unboxing, gig link)
-- ============================================================

ALTER TABLE "public"."MailPackage"
  ADD COLUMN IF NOT EXISTS "condition_photo_url" text,
  ADD COLUMN IF NOT EXISTS "unboxing_video_url" text,
  ADD COLUMN IF NOT EXISTS "unboxing_completed" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "warranty_saved" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "manual_saved" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "gig_id" uuid,
  ADD COLUMN IF NOT EXISTS "gig_type" text,
  ADD COLUMN IF NOT EXISTS "gig_accepted_by" uuid,
  ADD COLUMN IF NOT EXISTS "gig_accepted_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "neighbor_helper_name" text,
  ADD COLUMN IF NOT EXISTS "inferred_item_name" text;

-- 12. User preferences for Phase 2 features
-- ============================================================

ALTER TABLE "public"."User"
  ADD COLUMN IF NOT EXISTS "mail_party_enabled" boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS "earn_suspended_until" timestamp with time zone;

-- 13. Home preferences for Phase 2
-- ============================================================

ALTER TABLE "public"."Home"
  ADD COLUMN IF NOT EXISTS "mail_party_enabled" boolean DEFAULT true;
