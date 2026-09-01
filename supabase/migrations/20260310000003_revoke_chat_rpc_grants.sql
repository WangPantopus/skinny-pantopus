-- Migration: Revoke dangerous anon/authenticated grants on chat RPCs
-- Problem: Multiple SECURITY DEFINER RPCs are granted to anon and authenticated
-- roles with no internal auth.uid() binding. Any authenticated user (or even
-- anonymous) can call these RPCs with arbitrary user IDs, completely bypassing
-- RLS since SECURITY DEFINER runs as postgres.
-- Fix: Restrict all chat RPCs to service_role only, since the backend already
-- uses supabaseAdmin (service_role) for all these calls.

BEGIN;

-- ============================================================
-- 1. get_or_create_direct_chat — revoke + add self-chat guard
-- ============================================================

REVOKE ALL ON FUNCTION "public"."get_or_create_direct_chat"("p_user_id_1" "uuid", "p_user_id_2" "uuid") FROM "anon";
REVOKE ALL ON FUNCTION "public"."get_or_create_direct_chat"("p_user_id_1" "uuid", "p_user_id_2" "uuid") FROM "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_or_create_direct_chat"("p_user_id_1" "uuid", "p_user_id_2" "uuid") TO "service_role";

-- Add self-chat guard inside the function
CREATE OR REPLACE FUNCTION "public"."get_or_create_direct_chat"("p_user_id_1" "uuid", "p_user_id_2" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_room_id UUID;
BEGIN
  -- Prevent creating a chat with yourself
  IF p_user_id_1 = p_user_id_2 THEN
    RAISE EXCEPTION 'Cannot create chat with yourself';
  END IF;

  -- Look for an existing direct chat between these two users
  SELECT cp1.room_id INTO v_room_id
  FROM "ChatParticipant" cp1
  JOIN "ChatParticipant" cp2 ON cp1.room_id = cp2.room_id
  JOIN "ChatRoom" r ON r.id = cp1.room_id
  WHERE cp1.user_id = p_user_id_1
    AND cp2.user_id = p_user_id_2
    AND r.type = 'direct'
  LIMIT 1;

  IF v_room_id IS NOT NULL THEN
    -- Reactivate participants if they left
    UPDATE "ChatParticipant"
    SET is_active = true, left_at = NULL
    WHERE room_id = v_room_id
      AND user_id IN (p_user_id_1, p_user_id_2)
      AND is_active = false;

    RETURN v_room_id;
  END IF;

  -- Create a new direct chat room
  INSERT INTO "ChatRoom" (type)
  VALUES ('direct')
  RETURNING id INTO v_room_id;

  -- Add both participants
  INSERT INTO "ChatParticipant" (room_id, user_id, role, is_active)
  VALUES
    (v_room_id, p_user_id_1, 'owner', true),
    (v_room_id, p_user_id_2, 'member', true);

  RETURN v_room_id;
END;
$$;

-- ============================================================
-- 2. get_user_chat_rooms
-- ============================================================

REVOKE ALL ON FUNCTION "public"."get_user_chat_rooms"("p_user_id" "uuid", "p_limit" integer) FROM "anon";
REVOKE ALL ON FUNCTION "public"."get_user_chat_rooms"("p_user_id" "uuid", "p_limit" integer) FROM "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_user_chat_rooms"("p_user_id" "uuid", "p_limit" integer) TO "service_role";

-- ============================================================
-- 3. add_chat_participant
-- ============================================================

REVOKE ALL ON FUNCTION "public"."add_chat_participant"("p_room_id" "uuid", "p_user_id" "uuid", "p_role" character varying) FROM "anon";
REVOKE ALL ON FUNCTION "public"."add_chat_participant"("p_room_id" "uuid", "p_user_id" "uuid", "p_role" character varying) FROM "authenticated";
GRANT EXECUTE ON FUNCTION "public"."add_chat_participant"("p_room_id" "uuid", "p_user_id" "uuid", "p_role" character varying) TO "service_role";

-- ============================================================
-- 4. increment_unread_count (both overloads)
-- ============================================================

-- Trigger version (no params) — triggers execute as function owner,
-- so revoking from anon/authenticated does not break the trigger.
REVOKE ALL ON FUNCTION "public"."increment_unread_count"() FROM "anon";
REVOKE ALL ON FUNCTION "public"."increment_unread_count"() FROM "authenticated";
GRANT EXECUTE ON FUNCTION "public"."increment_unread_count"() TO "service_role";

-- Explicit version (with params)
REVOKE ALL ON FUNCTION "public"."increment_unread_count"("p_room_id" "uuid", "p_exclude_user_id" "uuid") FROM "anon";
REVOKE ALL ON FUNCTION "public"."increment_unread_count"("p_room_id" "uuid", "p_exclude_user_id" "uuid") FROM "authenticated";
GRANT EXECUTE ON FUNCTION "public"."increment_unread_count"("p_room_id" "uuid", "p_exclude_user_id" "uuid") TO "service_role";

-- ============================================================
-- 5. get_or_create_gig_chat
-- ============================================================

REVOKE ALL ON FUNCTION "public"."get_or_create_gig_chat"("p_gig_id" "uuid") FROM "anon";
REVOKE ALL ON FUNCTION "public"."get_or_create_gig_chat"("p_gig_id" "uuid") FROM "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_or_create_gig_chat"("p_gig_id" "uuid") TO "service_role";

-- ============================================================
-- 6. get_or_create_home_chat
-- ============================================================

REVOKE ALL ON FUNCTION "public"."get_or_create_home_chat"("p_home_id" "uuid") FROM "anon";
REVOKE ALL ON FUNCTION "public"."get_or_create_home_chat"("p_home_id" "uuid") FROM "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_or_create_home_chat"("p_home_id" "uuid") TO "service_role";

-- ============================================================
-- 7. cleanup_expired_typing
-- ============================================================

REVOKE ALL ON FUNCTION "public"."cleanup_expired_typing"() FROM "anon";
REVOKE ALL ON FUNCTION "public"."cleanup_expired_typing"() FROM "authenticated";
GRANT EXECUTE ON FUNCTION "public"."cleanup_expired_typing"() TO "service_role";

-- ============================================================
-- 8. mark_messages_read — not SECURITY DEFINER but should still
--    be restricted to service_role since the backend handles all
--    mark-read logic via supabaseAdmin.
-- ============================================================

REVOKE ALL ON FUNCTION "public"."mark_messages_read"("p_room_id" "uuid", "p_user_id" "uuid") FROM "anon";
REVOKE ALL ON FUNCTION "public"."mark_messages_read"("p_room_id" "uuid", "p_user_id" "uuid") FROM "authenticated";
GRANT EXECUTE ON FUNCTION "public"."mark_messages_read"("p_room_id" "uuid", "p_user_id" "uuid") TO "service_role";

COMMIT;
