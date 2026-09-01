-- Add dismissed_seeded_facts column to User table for cold-start fact dismissal.
-- Stores an array of deterministic fact IDs the user has dismissed.
-- Capped at 50 items (rolling, oldest removed first) by application logic.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "dismissed_seeded_facts" jsonb DEFAULT '[]'::jsonb;
