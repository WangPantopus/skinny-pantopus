-- Migration: Enforce is_active = true on all chat RLS policies
-- Problem: Every chat RLS policy checks only for ChatParticipant row existence,
-- not whether is_active = true. Removed participants retain full read/write access
-- at the Postgres level.

BEGIN;

-- ============================================================
-- 1. ChatMessage policies
-- ============================================================

-- SELECT: only active participants can read messages
DROP POLICY IF EXISTS "Participants can view room messages" ON "public"."ChatMessage";
CREATE POLICY "Participants can view room messages"
  ON "public"."ChatMessage"
  FOR SELECT
  USING (
    "room_id" IN (
      SELECT "ChatParticipant"."room_id"
      FROM "public"."ChatParticipant"
      WHERE "ChatParticipant"."user_id" = "auth"."uid"()
        AND "ChatParticipant"."is_active" = true
    )
  );

-- INSERT: only active participants can send messages
DROP POLICY IF EXISTS "Participants can send messages" ON "public"."ChatMessage";
CREATE POLICY "Participants can send messages"
  ON "public"."ChatMessage"
  FOR INSERT
  WITH CHECK (
    "auth"."uid"() = "user_id"
    AND "room_id" IN (
      SELECT "ChatParticipant"."room_id"
      FROM "public"."ChatParticipant"
      WHERE "ChatParticipant"."user_id" = "auth"."uid"()
        AND "ChatParticipant"."is_active" = true
    )
  );

-- UPDATE: only active participants can edit their own messages
DROP POLICY IF EXISTS "Senders can update their own messages" ON "public"."ChatMessage";
CREATE POLICY "Senders can update their own messages"
  ON "public"."ChatMessage"
  FOR UPDATE
  USING (
    "auth"."uid"() = "user_id"
    AND "room_id" IN (
      SELECT "ChatParticipant"."room_id"
      FROM "public"."ChatParticipant"
      WHERE "ChatParticipant"."user_id" = "auth"."uid"()
        AND "ChatParticipant"."is_active" = true
    )
  );

-- ============================================================
-- 2. ChatParticipant policies
-- ============================================================

-- SELECT: only active participants can view other participants in the room
DROP POLICY IF EXISTS "Participants can view room participants" ON "public"."ChatParticipant";
CREATE POLICY "Participants can view room participants"
  ON "public"."ChatParticipant"
  FOR SELECT
  USING (
    "room_id" IN (
      SELECT "ChatParticipant_1"."room_id"
      FROM "public"."ChatParticipant" "ChatParticipant_1"
      WHERE "ChatParticipant_1"."user_id" = "auth"."uid"()
        AND "ChatParticipant_1"."is_active" = true
    )
  );

-- INSERT (self-add): restrict to service_role only.
-- All participant creation goes through the backend (supabaseAdmin),
-- so there is no legitimate reason for a client to insert directly.
DROP POLICY IF EXISTS "Participants can add themselves to rooms" ON "public"."ChatParticipant";
CREATE POLICY "Participants can add themselves to rooms"
  ON "public"."ChatParticipant"
  FOR INSERT
  WITH CHECK (false);

-- INSERT (owner/admin adding others): require the actor to be active
DROP POLICY IF EXISTS "Room owners/admins can add others" ON "public"."ChatParticipant";
CREATE POLICY "Room owners/admins can add others"
  ON "public"."ChatParticipant"
  FOR INSERT
  WITH CHECK (
    "room_id" IN (
      SELECT "ChatParticipant_1"."room_id"
      FROM "public"."ChatParticipant" "ChatParticipant_1"
      WHERE "ChatParticipant_1"."user_id" = "auth"."uid"()
        AND "ChatParticipant_1"."is_active" = true
        AND "ChatParticipant_1"."role" IN ('owner', 'admin')
    )
  );

-- ============================================================
-- 3. ChatRoom policies
-- ============================================================

-- SELECT: only active participants can view rooms
DROP POLICY IF EXISTS "Participants can view their chat rooms" ON "public"."ChatRoom";
CREATE POLICY "Participants can view their chat rooms"
  ON "public"."ChatRoom"
  FOR SELECT
  USING (
    "id" IN (
      SELECT "ChatParticipant"."room_id"
      FROM "public"."ChatParticipant"
      WHERE "ChatParticipant"."user_id" = "auth"."uid"()
        AND "ChatParticipant"."is_active" = true
    )
  );

-- ============================================================
-- 4. ChatTyping policies
-- ============================================================

-- SELECT: only active participants can see typing indicators
DROP POLICY IF EXISTS "Participants can view typing indicators" ON "public"."ChatTyping";
CREATE POLICY "Participants can view typing indicators"
  ON "public"."ChatTyping"
  FOR SELECT
  USING (
    "room_id" IN (
      SELECT "ChatParticipant"."room_id"
      FROM "public"."ChatParticipant"
      WHERE "ChatParticipant"."user_id" = "auth"."uid"()
        AND "ChatParticipant"."is_active" = true
    )
  );

-- INSERT: only active participants can create typing indicators
DROP POLICY IF EXISTS "Participants can create typing indicators" ON "public"."ChatTyping";
CREATE POLICY "Participants can create typing indicators"
  ON "public"."ChatTyping"
  FOR INSERT
  WITH CHECK (
    "auth"."uid"() = "user_id"
    AND "room_id" IN (
      SELECT "ChatParticipant"."room_id"
      FROM "public"."ChatParticipant"
      WHERE "ChatParticipant"."user_id" = "auth"."uid"()
        AND "ChatParticipant"."is_active" = true
    )
  );

COMMIT;
