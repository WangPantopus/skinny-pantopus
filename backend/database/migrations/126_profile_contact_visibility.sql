-- Add profile contact visibility controls used by Settings.
ALTER TABLE "public"."User"
  ADD COLUMN IF NOT EXISTS "show_email" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "show_phone" boolean DEFAULT false;

