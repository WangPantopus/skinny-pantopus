-- Add reminder_count to BusinessProfile for draft follow-up cap
ALTER TABLE "public"."BusinessProfile"
  ADD COLUMN IF NOT EXISTS "reminder_count" integer DEFAULT 0;
