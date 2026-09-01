-- Migration: Enable RLS and add policies + indexes for MessageReaction
-- Problem: MessageReaction has no RLS enabled and no policies at all.
-- Reactions for any message are fully exposed if any client-side Supabase
-- path exists or is introduced in the future.

BEGIN;

-- ============================================================
-- 1. Enable RLS
-- ============================================================

ALTER TABLE "public"."MessageReaction" ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Policies
-- ============================================================

-- SELECT: user can view reactions on messages in rooms they actively participate in
CREATE POLICY "Active participants can view reactions"
  ON "public"."MessageReaction"
  FOR SELECT
  USING (
    "message_id" IN (
      SELECT "ChatMessage"."id"
      FROM "public"."ChatMessage"
      WHERE "ChatMessage"."room_id" IN (
        SELECT "ChatParticipant"."room_id"
        FROM "public"."ChatParticipant"
        WHERE "ChatParticipant"."user_id" = "auth"."uid"()
          AND "ChatParticipant"."is_active" = true
      )
    )
  );

-- INSERT: user can react only as themselves on messages in rooms they actively participate in
CREATE POLICY "Active participants can add reactions"
  ON "public"."MessageReaction"
  FOR INSERT
  WITH CHECK (
    "auth"."uid"() = "user_id"
    AND "message_id" IN (
      SELECT "ChatMessage"."id"
      FROM "public"."ChatMessage"
      WHERE "ChatMessage"."room_id" IN (
        SELECT "ChatParticipant"."room_id"
        FROM "public"."ChatParticipant"
        WHERE "ChatParticipant"."user_id" = "auth"."uid"()
          AND "ChatParticipant"."is_active" = true
      )
    )
  );

-- DELETE: user can only remove their own reactions
CREATE POLICY "Users can delete their own reactions"
  ON "public"."MessageReaction"
  FOR DELETE
  USING (
    "auth"."uid"() = "user_id"
  );

-- ============================================================
-- 3. Indexes for hot-path lookups
-- ============================================================

-- Used by buildReactionSummary() which does .in('message_id', messageIds)
CREATE INDEX IF NOT EXISTS idx_message_reaction_message
  ON "public"."MessageReaction" ("message_id");

-- For user-scoped cleanup operations
CREATE INDEX IF NOT EXISTS idx_message_reaction_user
  ON "public"."MessageReaction" ("user_id");

COMMIT;
