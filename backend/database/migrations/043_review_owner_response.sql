-- Migration 043: Add owner response columns to Review table
-- Allows business owners to respond to reviews

ALTER TABLE "public"."Review"
  ADD COLUMN IF NOT EXISTS "owner_response" text,
  ADD COLUMN IF NOT EXISTS "owner_responded_at" timestamp with time zone;
