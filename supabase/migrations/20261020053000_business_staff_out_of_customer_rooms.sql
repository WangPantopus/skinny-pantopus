-- Backwards compatible: yes. Replaces the body of public.direct_message_block_admission() (same trigger, signature,
-- owner and grants) and removes rows from "ChatParticipant" and "MessageReaction". No table, column or index changes.
-- The deployed API keeps working with both: it still adds the actor as a member before writing for a business, which
-- the old and the new check both admit, and it re-adds a removed row the next time that person opens the room.
--
-- A business's owner and staff answer its customers from the shared inbox (asBusinessUserId). Until now the API made
-- whoever opened a conversation there an ordinary active member of it (and POST /api/chat/direct added every team
-- member to a new business conversation). The customer's Messages list and thread then named the owner's or staff
-- member's personal account and photo instead of the business, the room details listed them, the conversation sat in
-- their personal Messages with a composer that wrote as them, and their personal direct chat with that customer
-- resolved to the business's room (get_or_create_direct_chat matches any direct room both are in). A business seat
-- must never expose the person behind it.
--
-- The API now lets them act for the business through the business's own membership, without joining the room
-- (backend/services/chatBusinessAccess.js). Two changes here go with it:
--
-- 1. The send gate's defence against a spoofed human actor accepted only an active member of the room. It now also
--    accepts the owner or staff of the sending business, when that business is an active member of the room and
--    they may write for it (gigs.manage or gigs.post, the API's canActAsBusiness, via business_has_permission).
--    Nothing else changes: the block check still decides on the human actor and every active counterparty.
--
-- 2. Rooms already affected are repaired. In a direct room with a business member, a row of someone on that
--    business's team (current or former) is removed when someone else in the room is neither the business nor on its
--    team: the customer. A team member's own conversation with their business, where nobody else is, is left as it is.
--    Their reactions in those rooms go too: each was stored under their personal account and named them to the
--    customer, and only membership let them add it. Messages they sent are kept unchanged.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.direct_message_block_admission() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE v_room_type text; v_actor uuid; v_key bigint;
BEGIN
  SELECT r.type INTO v_room_type FROM public."ChatRoom" r WHERE r.id = NEW.room_id;
  IF v_room_type IS DISTINCT FROM 'direct' THEN RETURN NEW; END IF;

  -- ChatMessage.user_id is the SENDER and may be a business identity;
  -- actor_user_id is the HUMAN actor and is NULL when the human is the user_id.
  -- user_id is NOT NULL, so v_actor is never NULL and the STRICT key function can
  -- never silently skip a lock.
  v_actor := coalesce(NEW.actor_user_id, NEW.user_id);

  -- Defence in depth against a spoofed actor. Unreachable through
  -- backend/routes/chats.js, which never takes actor_user_id from the client and
  -- sets it only when the sender identity differs from the authenticated user.
  -- The human is an active member of the room, or acts for the sending business:
  -- its owner and staff write for it without joining its rooms.
  IF NEW.actor_user_id IS NOT NULL AND (
       NEW.actor_user_id = NEW.user_id
    OR NOT (
         EXISTS (SELECT FROM public."ChatParticipant" p
                 WHERE p.room_id = NEW.room_id AND p.user_id = NEW.actor_user_id AND p.is_active IS NOT FALSE)
      OR (EXISTS (SELECT FROM public."ChatParticipant" p JOIN public."User" u ON u.id = p.user_id
                  WHERE p.room_id = NEW.room_id AND p.user_id = NEW.user_id AND p.is_active IS NOT FALSE
                    AND u.account_type = 'business')
          AND (public.business_has_permission(NEW.user_id, 'gigs.manage'::public.business_permission, NEW.actor_user_id)
            OR public.business_has_permission(NEW.user_id, 'gigs.post'::public.business_permission, NEW.actor_user_id)))))
  THEN
    RAISE EXCEPTION 'DIRECT_MESSAGE_ACTOR_INVALID' USING ERRCODE='PT403',
      DETAIL='Direct message names a human who is not an active member of this room or of its sending business';
  END IF;

  -- Ascending key order over a total, sender-independent ordering of the shared
  -- key space is the deadlock-freedom argument for multi-counterparty rooms.
  FOR v_key IN
    SELECT DISTINCT public.direct_message_block_lock_key(v_actor, p.user_id) AS k
    FROM public."ChatParticipant" p
    WHERE p.room_id = NEW.room_id AND p.is_active IS NOT FALSE AND p.user_id <> v_actor
    ORDER BY k
  LOOP
    PERFORM pg_advisory_xact_lock(v_key);
  END LOOP;

  IF EXISTS (SELECT FROM public."ChatParticipant" p
             JOIN public."UserBlock" b
               ON (b.blocker_user_id = v_actor AND b.blocked_user_id = p.user_id)
               OR (b.blocker_user_id = p.user_id AND b.blocked_user_id = v_actor)
             WHERE p.room_id = NEW.room_id AND p.is_active IS NOT FALSE AND p.user_id <> v_actor)
  THEN
    RAISE EXCEPTION 'DIRECT_MESSAGE_BLOCKED' USING ERRCODE='PT403',
      DETAIL='Direct message refused; this conversation has an active block';
  END IF;

  -- An empty counterparty set denies nothing, preserving the existing
  -- no-counterparty behaviour of a single-participant direct room.
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.direct_message_block_admission() FROM PUBLIC, anon, authenticated;

WITH business_rooms AS (
  SELECT p.room_id, p.user_id AS business_user_id
  FROM public."ChatParticipant" p
  JOIN public."ChatRoom" r ON r.id = p.room_id AND r.type = 'direct'
  JOIN public."User" u ON u.id = p.user_id AND u.account_type = 'business'
), staff AS (
  SELECT DISTINCT s.id, s.room_id, s.user_id
  FROM business_rooms b
  JOIN public."ChatParticipant" s ON s.room_id = b.room_id AND s.user_id <> b.business_user_id
  WHERE EXISTS (SELECT FROM public."BusinessTeam" t
                WHERE t.business_user_id = b.business_user_id AND t.user_id = s.user_id)
    AND EXISTS (SELECT FROM public."ChatParticipant" c
                WHERE c.room_id = b.room_id AND c.user_id <> b.business_user_id
                  AND NOT EXISTS (SELECT FROM public."BusinessTeam" t
                                  WHERE t.business_user_id = b.business_user_id AND t.user_id = c.user_id))
), staff_reactions AS (
  DELETE FROM public."MessageReaction" mr
  USING public."ChatMessage" m, staff s
  WHERE mr.message_id = m.id AND m.room_id = s.room_id AND mr.user_id = s.user_id
  RETURNING mr.id
)
DELETE FROM public."ChatParticipant" p
USING staff s
WHERE p.id = s.id;

COMMIT;
