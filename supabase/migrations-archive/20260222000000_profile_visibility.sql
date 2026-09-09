-- Add profile_visibility column to User table
ALTER TABLE "public"."User"
ADD COLUMN IF NOT EXISTS "profile_visibility" VARCHAR(20) DEFAULT 'public';
