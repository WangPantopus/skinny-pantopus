-- Migration 044: Create BusinessProfileView table for analytics
-- Tracks profile page views with optional viewer and source

CREATE TABLE IF NOT EXISTS "public"."BusinessProfileView" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "business_user_id" uuid NOT NULL,
  "viewer_user_id" uuid,
  "source" text DEFAULT 'direct_link',
  "viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "BusinessProfileView_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."BusinessProfileView" OWNER TO "postgres";

CREATE INDEX IF NOT EXISTS "idx_bpv_business_viewed"
  ON "public"."BusinessProfileView" ("business_user_id", "viewed_at");

ALTER TABLE "public"."BusinessProfileView"
  ADD CONSTRAINT "BusinessProfileView_business_user_id_fkey"
  FOREIGN KEY ("business_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;

ALTER TABLE "public"."BusinessProfileView"
  ADD CONSTRAINT "BusinessProfileView_viewer_user_id_fkey"
  FOREIGN KEY ("viewer_user_id") REFERENCES "public"."User"("id") ON DELETE SET NULL;
