-- ============================================================
-- MIGRATION 048: Mailbox Phase 3 — "The Thing That Compounds"
-- Mail→Records, Mail→Map, Mail→Community, Mail→Task,
-- Mail Day, Stamps, Memory, Wallet, Vacation, Translation
-- ============================================================

-- ============ MAIL TABLE EXTENSIONS ============

ALTER TABLE "Mail" ADD COLUMN IF NOT EXISTS "community_published" boolean DEFAULT false;
ALTER TABLE "Mail" ADD COLUMN IF NOT EXISTS "translation_text" text;
ALTER TABLE "Mail" ADD COLUMN IF NOT EXISTS "translation_lang" text;
ALTER TABLE "Mail" ADD COLUMN IF NOT EXISTS "translation_cached_at" timestamptz;
ALTER TABLE "Mail" ADD COLUMN IF NOT EXISTS "stamp_id" uuid;
ALTER TABLE "Mail" ADD COLUMN IF NOT EXISTS "time_limited_expires_at" timestamptz;
ALTER TABLE "Mail" ADD COLUMN IF NOT EXISTS "access_count_max" integer;
ALTER TABLE "Mail" ADD COLUMN IF NOT EXISTS "access_count_used" integer DEFAULT 0;
ALTER TABLE "Mail" ADD COLUMN IF NOT EXISTS "linked_task_id" uuid;

-- ============ USER TABLE EXTENSIONS ============

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mail_day_enabled" boolean DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mail_day_time" time DEFAULT '08:00:00';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferred_language" text DEFAULT 'en';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "streak_days" integer DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "streak_last_date" date;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "vacation_mode" boolean DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "vacation_start" date;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "vacation_end" date;

-- ============ HOME TABLE EXTENSIONS ============

ALTER TABLE "Home" ADD COLUMN IF NOT EXISTS "map_center_lat" double precision;
ALTER TABLE "Home" ADD COLUMN IF NOT EXISTS "map_center_lng" double precision;

-- ============ MAIL-ASSET LINK (Mail → Records) ============

CREATE TABLE IF NOT EXISTS "MailAssetLink" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "mail_id" uuid NOT NULL REFERENCES "Mail"("id") ON DELETE CASCADE,
  "asset_id" uuid NOT NULL,
  "linked_by" uuid NOT NULL REFERENCES "User"("id"),
  "link_type" text NOT NULL DEFAULT 'manual'
    CHECK ("link_type" IN ('manual', 'auto_detected', 'warranty', 'receipt', 'repair')),
  "confidence" double precision DEFAULT 1.0,
  "created_at" timestamptz DEFAULT now(),
  UNIQUE("mail_id", "asset_id")
);

CREATE INDEX idx_mail_asset_link_asset ON "MailAssetLink"("asset_id");
CREATE INDEX idx_mail_asset_link_mail ON "MailAssetLink"("mail_id");

-- Asset photos (for auto-detection reference)
CREATE TABLE IF NOT EXISTS "AssetPhoto" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "asset_id" uuid NOT NULL,
  "url" text NOT NULL,
  "caption" text,
  "taken_at" timestamptz DEFAULT now(),
  "uploaded_by" uuid REFERENCES "User"("id"),
  "created_at" timestamptz DEFAULT now()
);

CREATE INDEX idx_asset_photo_asset ON "AssetPhoto"("asset_id");

-- ============ HOME MAP PIN (Mail → Map) ============

CREATE TABLE IF NOT EXISTS "HomeMapPin" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "home_id" uuid NOT NULL,
  "mail_id" uuid REFERENCES "Mail"("id") ON DELETE SET NULL,
  "created_by" uuid NOT NULL REFERENCES "User"("id"),

  "pin_type" text NOT NULL
    CHECK ("pin_type" IN ('permit', 'delivery', 'notice', 'civic', 'utility_work', 'community')),
  "title" text NOT NULL,
  "body" text,

  "lat" double precision NOT NULL,
  "lng" double precision NOT NULL,
  "radius_meters" integer,

  "visible_to" text NOT NULL DEFAULT 'household'
    CHECK ("visible_to" IN ('personal', 'household', 'neighborhood', 'public')),
  "expires_at" timestamptz,

  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);

CREATE INDEX idx_home_map_pin_home ON "HomeMapPin"("home_id");
CREATE INDEX idx_home_map_pin_type ON "HomeMapPin"("pin_type");
CREATE INDEX idx_home_map_pin_geo ON "HomeMapPin"("lat", "lng");
CREATE INDEX idx_home_map_pin_expires ON "HomeMapPin"("expires_at") WHERE "expires_at" IS NOT NULL;

-- ============ COMMUNITY MAIL (Mail → Community) ============

CREATE TABLE IF NOT EXISTS "CommunityMailItem" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "mail_id" uuid REFERENCES "Mail"("id") ON DELETE SET NULL,
  "published_by" uuid NOT NULL REFERENCES "User"("id"),
  "home_id" uuid NOT NULL,

  "community_type" text NOT NULL
    CHECK ("community_type" IN ('civic_notice', 'neighborhood_event', 'local_business', 'building_announcement')),
  "published_to" text NOT NULL DEFAULT 'neighborhood'
    CHECK ("published_to" IN ('building', 'neighborhood', 'city')),

  "title" text NOT NULL,
  "body" text,
  "sender_display" text,
  "sender_trust" text,
  "category" text,

  "verified_sender" boolean DEFAULT false,
  "event_date" date,
  "rsvp_deadline" date,

  "map_pin_id" uuid REFERENCES "HomeMapPin"("id") ON DELETE SET NULL,

  "views" integer DEFAULT 0,
  "neighbors_received" integer DEFAULT 0,
  "rsvp_count" integer DEFAULT 0,

  "flagged" boolean DEFAULT false,
  "flag_count" integer DEFAULT 0,
  "hidden" boolean DEFAULT false,

  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);

CREATE INDEX idx_community_mail_home ON "CommunityMailItem"("home_id");
CREATE INDEX idx_community_mail_type ON "CommunityMailItem"("community_type");
CREATE INDEX idx_community_mail_published_to ON "CommunityMailItem"("published_to");
CREATE INDEX idx_community_mail_created ON "CommunityMailItem"("created_at" DESC);

-- Community reactions (aggregate, privacy-preserving)
CREATE TABLE IF NOT EXISTS "CommunityReaction" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "community_item_id" uuid NOT NULL REFERENCES "CommunityMailItem"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "User"("id"),
  "reaction_type" text NOT NULL
    CHECK ("reaction_type" IN ('acknowledged', 'will_attend', 'concerned', 'thumbs_up')),
  "created_at" timestamptz DEFAULT now(),
  UNIQUE("community_item_id", "user_id", "reaction_type")
);

CREATE INDEX idx_community_reaction_item ON "CommunityReaction"("community_item_id");

-- ============ MAIL DAY SETTINGS ============

CREATE TABLE IF NOT EXISTS "MailDaySettings" (
  "user_id" uuid PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,

  "delivery_time" time DEFAULT '08:00:00',
  "timezone" text DEFAULT 'America/Los_Angeles',

  "enabled" boolean DEFAULT true,
  "sound_enabled" boolean DEFAULT true,
  "sound_type" text DEFAULT 'soft'
    CHECK ("sound_type" IN ('off', 'soft', 'classic')),
  "haptics_enabled" boolean DEFAULT true,

  "include_personal" boolean DEFAULT true,
  "include_home" boolean DEFAULT true,
  "include_business" boolean DEFAULT true,
  "include_earn_count" boolean DEFAULT true,
  "include_community" boolean DEFAULT false,

  "interrupt_time_sensitive" boolean DEFAULT true,
  "interrupt_packages_otd" boolean DEFAULT true,
  "interrupt_certified" boolean DEFAULT true,

  "current_theme" text DEFAULT 'auto',

  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);

-- ============ SEASONAL THEMES ============

CREATE TABLE IF NOT EXISTS "SeasonalTheme" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "season" text
    CHECK ("season" IN ('spring', 'summer', 'autumn', 'winter', 'custom')),

  "background_palette" jsonb DEFAULT '[]'::jsonb,
  "mailbox_illustration_url" text,
  "card_texture" text,
  "accent_color" text,

  "auto_apply" boolean DEFAULT false,
  "active_from" date,
  "active_until" date,

  "unlock_condition" text DEFAULT 'default'
    CHECK ("unlock_condition" IN ('default', 'stamp_milestone', 'earned', 'seasonal_auto', 'premium')),

  "created_at" timestamptz DEFAULT now()
);

-- Seed default seasonal themes
INSERT INTO "SeasonalTheme" ("id", "name", "season", "accent_color", "auto_apply", "active_from", "active_until", "unlock_condition")
VALUES
  ('winter_2026', 'Winter 2026', 'winter', '#1E3A5F', true, '2025-12-21', '2026-03-19', 'seasonal_auto'),
  ('spring_2026', 'Spring 2026', 'spring', '#059669', true, '2026-03-20', '2026-06-19', 'seasonal_auto'),
  ('summer_2026', 'Summer 2026', 'summer', '#D97706', true, '2026-06-20', '2026-09-21', 'seasonal_auto'),
  ('autumn_2026', 'Autumn 2026', 'autumn', '#92400E', true, '2026-09-22', '2026-12-20', 'seasonal_auto'),
  ('desert_night', 'Desert Night', 'custom', '#7C3AED', false, null, null, 'stamp_milestone'),
  ('coastal', 'Coastal', 'custom', '#0284C7', false, null, null, 'earned')
ON CONFLICT ("id") DO NOTHING;

-- ============ STAMPS ============

CREATE TABLE IF NOT EXISTS "Stamp" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,

  "stamp_type" text NOT NULL,
  "rarity" text NOT NULL DEFAULT 'common'
    CHECK ("rarity" IN ('common', 'uncommon', 'rare', 'legendary')),

  "earned_at" timestamptz DEFAULT now(),
  "earned_by" text,

  "name" text NOT NULL,
  "description" text,
  "visual_url" text,
  "color_palette" jsonb DEFAULT '[]'::jsonb,

  "displayed_in_gallery" boolean DEFAULT true,

  UNIQUE("user_id", "stamp_type")
);

CREATE INDEX idx_stamp_user ON "Stamp"("user_id");
CREATE INDEX idx_stamp_type ON "Stamp"("stamp_type");

-- ============ MAIL MEMORY ============

CREATE TABLE IF NOT EXISTS "MailMemory" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,

  "memory_type" text NOT NULL
    CHECK ("memory_type" IN ('on_this_day', 'year_in_mail', 'first_mail_from_sender')),

  "reference_date" date NOT NULL,
  "mail_item_ids" jsonb DEFAULT '[]'::jsonb,

  "headline" text NOT NULL,
  "body" text,

  "shown_at" timestamptz,
  "dismissed" boolean DEFAULT false,

  "created_at" timestamptz DEFAULT now()
);

CREATE INDEX idx_mail_memory_user ON "MailMemory"("user_id");
CREATE INDEX idx_mail_memory_date ON "MailMemory"("reference_date");

-- ============ YEAR IN MAIL ============

CREATE TABLE IF NOT EXISTS "YearInMail" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "year" integer NOT NULL,

  "total_items" integer DEFAULT 0,
  "by_drawer" jsonb DEFAULT '{}'::jsonb,
  "by_type" jsonb DEFAULT '{}'::jsonb,

  "top_senders" jsonb DEFAULT '[]'::jsonb,
  "total_packages" integer DEFAULT 0,
  "total_earned" numeric(10,2) DEFAULT 0,
  "total_saved" numeric(10,2) DEFAULT 0,

  "first_mail_date" date,
  "most_active_month" text,

  "share_card_url" text,
  "generated_at" timestamptz DEFAULT now(),

  UNIQUE("user_id", "year")
);

-- ============ EARN WALLET ============

CREATE TABLE IF NOT EXISTS "EarnWallet" (
  "user_id" uuid PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,

  "available_balance" numeric(10,2) DEFAULT 0,
  "pending_balance" numeric(10,2) DEFAULT 0,
  "lifetime_earned" numeric(10,2) DEFAULT 0,
  "lifetime_saved" numeric(10,2) DEFAULT 0,

  "withdrawal_method" text
    CHECK ("withdrawal_method" IN ('pantopus_credit', 'bank_transfer', 'gift_card')),
  "withdrawal_threshold" numeric(10,2) DEFAULT 10.00,

  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "WalletTransaction" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,

  "type" text NOT NULL
    CHECK ("type" IN ('earn', 'bonus', 'withdrawal', 'expired', 'rejected', 'coupon_saving')),
  "amount" numeric(10,2) NOT NULL,
  "source" text
    CHECK ("source" IN ('offer_engagement', 'offer_conversion', 'milestone_bonus', 'referral', 'withdrawal', 'coupon')),
  "source_item_id" uuid,

  "status" text NOT NULL DEFAULT 'completed'
    CHECK ("status" IN ('completed', 'pending', 'failed')),
  "description" text,

  "created_at" timestamptz DEFAULT now()
);

CREATE INDEX idx_wallet_tx_user ON "WalletTransaction"("user_id");
CREATE INDEX idx_wallet_tx_created ON "WalletTransaction"("created_at" DESC);
CREATE INDEX idx_wallet_tx_status ON "WalletTransaction"("status");

-- ============ VACATION HOLD ============

CREATE TABLE IF NOT EXISTS "VacationHold" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "home_id" uuid NOT NULL,

  "start_date" date NOT NULL,
  "end_date" date NOT NULL,

  "hold_action" text NOT NULL DEFAULT 'hold_in_vault'
    CHECK ("hold_action" IN ('hold_in_vault', 'forward_to_household', 'notify_urgent_only')),
  "forward_user_id" uuid REFERENCES "User"("id"),

  "package_action" text NOT NULL DEFAULT 'ask_neighbor'
    CHECK ("package_action" IN ('hold_at_carrier', 'ask_neighbor', 'locker')),
  "auto_neighbor_request" boolean DEFAULT false,

  "status" text NOT NULL DEFAULT 'scheduled'
    CHECK ("status" IN ('scheduled', 'active', 'completed', 'cancelled')),

  "items_held_count" integer DEFAULT 0,

  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);

CREATE INDEX idx_vacation_hold_user ON "VacationHold"("user_id");
CREATE INDEX idx_vacation_hold_status ON "VacationHold"("status");
CREATE INDEX idx_vacation_hold_dates ON "VacationHold"("start_date", "end_date");

-- ============ HOME TASK EXTENSION ============
-- Add mail_id reference to existing HomeTask if it exists

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'HomeTask') THEN
    ALTER TABLE "HomeTask" ADD COLUMN IF NOT EXISTS "mail_id" uuid REFERENCES "Mail"("id") ON DELETE SET NULL;
    ALTER TABLE "HomeTask" ADD COLUMN IF NOT EXISTS "converted_to_gig_id" uuid;
  END IF;
END $$;

-- ============ FULL-TEXT SEARCH ON COMMUNITY ============

CREATE INDEX IF NOT EXISTS idx_community_mail_fts
  ON "CommunityMailItem"
  USING gin(to_tsvector('english', coalesce("title", '') || ' ' || coalesce("body", '')));

-- ============ CLEANUP INDEX FOR TIME-LIMITED PACKAGES ============

CREATE INDEX IF NOT EXISTS idx_mail_time_limited
  ON "Mail"("time_limited_expires_at")
  WHERE "time_limited_expires_at" IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mail_stamp
  ON "Mail"("stamp_id")
  WHERE "stamp_id" IS NOT NULL;
