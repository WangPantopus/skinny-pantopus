-- Migration 045: Create BusinessFollow table
-- Tracks users following business accounts, separate from personal follows

CREATE TABLE IF NOT EXISTS "public"."BusinessFollow" (
  "user_id" uuid NOT NULL,
  "business_user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "BusinessFollow_pkey" PRIMARY KEY ("user_id", "business_user_id"),
  CONSTRAINT "BusinessFollow_no_self" CHECK (user_id <> business_user_id)
);

ALTER TABLE "public"."BusinessFollow" OWNER TO "postgres";

CREATE INDEX IF NOT EXISTS "idx_bf_business"
  ON "public"."BusinessFollow" ("business_user_id");

ALTER TABLE "public"."BusinessFollow"
  ADD CONSTRAINT "BusinessFollow_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;

ALTER TABLE "public"."BusinessFollow"
  ADD CONSTRAINT "BusinessFollow_business_user_id_fkey"
  FOREIGN KEY ("business_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;
