-- Backwards compatible: yes. Replaces the body of public.get_or_create_direct_chat(uuid, uuid); its signature, result
-- and callers (routes/chats.js POST /direct, routes/gigs.js, socket/chatSocketio.js) are unchanged, and it stays
-- service-only: EXECUTE is revoked from PUBLIC, anon and authenticated again below, as 20260930176000 did.
--
-- Two calls for the same two people at the same moment (a double tap, Android's silent re-send of
-- POST /api/chat/direct, or the apps calling it before a send, which their endpoint docs describe as safe) both ran
-- the function's look-up before either had created the room, so each created one. The pair then had two direct
-- rooms, messages split between them, and later look-ups returned either (LIMIT 1). Reproduced on a local stack:
-- six simultaneous POST /api/chat/direct for one pair left two direct rooms. 20260916010000 named this create-time
-- race as a separate contract.
--
-- The function now takes a transaction-scoped advisory lock on the unordered pair before its look-up (the house
-- idiom, as public.direct_message_block_lock_key: hashtextextended over least()/greatest()), so a second call waits
-- for the first to commit and then finds its room. Calls for different pairs never wait on each other. The lock
-- namespace differs from the block-admission lock, so the two never contend. Everything else is as before: a chat
-- with yourself is refused, a found room's participants are reactivated, and a new room gets the same owner and
-- member. search_path is now pinned (public, pg_temp), as a SECURITY DEFINER function should; every table it
-- names is in public.
--
-- Pairs that already have two direct rooms are left as they are; this stops new ones.
SET LOCAL lock_timeout='5s';

CREATE OR REPLACE FUNCTION public.get_or_create_direct_chat(p_user_id_1 uuid, p_user_id_2 uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_room_id UUID;
BEGIN
  -- Prevent creating a chat with yourself
  IF p_user_id_1 = p_user_id_2 THEN
    RAISE EXCEPTION 'Cannot create chat with yourself';
  END IF;

  -- One creator per pair at a time: a concurrent call for the same two people waits here, then finds the room
  -- the first call made. Released when this call's transaction ends.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'direct-chat-create:' || least(p_user_id_1::text, p_user_id_2::text) || ':' || greatest(p_user_id_1::text, p_user_id_2::text),
    0
  ));

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
$function$;

REVOKE EXECUTE ON FUNCTION public.get_or_create_direct_chat(uuid, uuid) FROM PUBLIC, anon, authenticated;
