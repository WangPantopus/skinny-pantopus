-- Migration 115: Extend ChatRoom to support 'support_train' type
--
-- Adds support_train_id column and updates both CHECK constraints
-- to allow type='support_train' with a required support_train_id FK.
--
-- ⚠️  HIGH-RISK: drops and re-creates both CHECK constraints on ChatRoom.
-- Wrapped in a single transaction so any failure rolls back cleanly.

BEGIN;

-- 1. Add the new FK column
ALTER TABLE "public"."ChatRoom"
  ADD COLUMN IF NOT EXISTS "support_train_id" "uuid";

ALTER TABLE "public"."ChatRoom"
  ADD CONSTRAINT "ChatRoom_support_train_id_fkey"
  FOREIGN KEY ("support_train_id")
  REFERENCES "public"."SupportTrain"("id") ON DELETE CASCADE;

-- 2. Drop and re-create the multi-clause CHECK constraint
ALTER TABLE "public"."ChatRoom"
  DROP CONSTRAINT IF EXISTS "ChatRoom_check";

ALTER TABLE "public"."ChatRoom"
  ADD CONSTRAINT "ChatRoom_check" CHECK (
    (
      (("type")::"text" = 'gig'::"text") AND ("gig_id" IS NOT NULL)
    ) OR (
      (("type")::"text" = 'home'::"text") AND ("home_id" IS NOT NULL)
    ) OR (
      (("type")::"text" = 'support_train'::"text") AND ("support_train_id" IS NOT NULL)
    ) OR (
      ("type")::"text" = ANY ((ARRAY['direct'::character varying, 'group'::character varying])::"text"[])
    )
  );

-- 3. Drop and re-create the type enum CHECK constraint
ALTER TABLE "public"."ChatRoom"
  DROP CONSTRAINT IF EXISTS "ChatRoom_type_check";

ALTER TABLE "public"."ChatRoom"
  ADD CONSTRAINT "ChatRoom_type_check" CHECK (
    ("type")::"text" = ANY ((ARRAY[
      'gig'::character varying,
      'home'::character varying,
      'direct'::character varying,
      'group'::character varying,
      'support_train'::character varying
    ])::"text"[])
  );

-- 4. Index for support_train_id lookups
CREATE INDEX IF NOT EXISTS "chat_room_support_train_id_idx"
  ON "public"."ChatRoom" ("support_train_id")
  WHERE "support_train_id" IS NOT NULL;

COMMIT;
