-- Migration: Fix direct chat race condition with advisory lock
-- Problem: get_or_create_direct_chat does SELECT then INSERT with no locking.
-- Two concurrent calls for the same user pair can both find no existing room
-- and both create one, producing duplicate direct chat rooms.
-- Fix: Use pg_advisory_xact_lock with a deterministic key derived from the
-- sorted user UUID pair. The lock automatically releases at transaction end.

BEGIN;

CREATE OR REPLACE FUNCTION "public"."get_or_create_direct_chat"("p_user_id_1" "uuid", "p_user_id_2" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_room_id UUID;
  v_lock_key BIGINT;
  v_sorted_ids TEXT;
BEGIN
  -- Prevent creating a chat with yourself
  IF p_user_id_1 = p_user_id_2 THEN
    RAISE EXCEPTION 'Cannot create chat with yourself';
  END IF;

  -- Compute a deterministic lock key from the sorted user UUID pair.
  -- Sorting ensures (userA, userB) and (userB, userA) get the same lock.
  IF p_user_id_1::text < p_user_id_2::text THEN
    v_sorted_ids := p_user_id_1::text || ':' || p_user_id_2::text;
  ELSE
    v_sorted_ids := p_user_id_2::text || ':' || p_user_id_1::text;
  END IF;

  -- hashtext returns a 32-bit integer; cast to bigint for pg_advisory_xact_lock
  v_lock_key := hashtext(v_sorted_ids)::bigint;

  -- Acquire transaction-scoped advisory lock. This serializes concurrent
  -- get_or_create calls for the same user pair. The lock is released
  -- automatically when the transaction commits or rolls back.
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Now safely check for an existing direct chat
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

  -- No existing room found — safe to create since we hold the lock
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

COMMIT;
