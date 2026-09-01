-- Add claimed_role to HomeResidencyClaim to track what role the claimant requested.
-- Used during approval to assign the correct role_base in HomeOccupancy.
ALTER TABLE "public"."HomeResidencyClaim"
  ADD COLUMN IF NOT EXISTS "claimed_role" text DEFAULT 'member';
