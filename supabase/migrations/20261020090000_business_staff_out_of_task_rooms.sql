-- Backwards compatible: yes. Replaces the body of public.finalize_paid_gig_acceptance_as_actor() (same signature,
-- owner and grants) and removes rows from "ChatParticipant" and "MessageReaction". No table, column or index changes.
-- The deployed API keeps working with both: it reads and writes a task's chat through whichever rows exist, and it
-- adds a removed staff row again the next time that person opens the task's chat, until the new API removes it.
--
-- 20261020053000 stopped a business's owner and staff from becoming ordinary members of its conversations with
-- customers. The chat room of a task the business posted had the same problem: whoever accepted the bid for the
-- business (here, in the paid acceptance), and whoever opened the task's chat for it (GET /api/gigs/:id/chat-room),
-- became an active member of the room. The worker, and before the task was assigned everyone asking about it, then
-- saw that person's personal account in the room's member list and on their reactions, the room could be filed under
-- them in the worker's Messages, and the room sat in their own personal Messages. Their messages there already went
-- out as the business. The API now lets them act for the business through its own membership of the task's room
-- (backend/services/chatBusinessAccess.js), as in its conversations with customers. Three changes here go with it:
--
-- 1. The paid acceptance no longer adds the acting staff member to the task's room. Only that insert is gone: the
--    room still gets the business and the worker (public.materialize_paid_gig_acceptance).
--
-- 2. Task rooms already affected are repaired. In the room of a task a business posted, the row of someone on that
--    business's team (current or former) is removed unless they are the task's accepted worker. Their reactions in
--    those rooms go too: each was stored under their personal account and named them to the worker. Messages are
--    kept unchanged. Anyone removed who is not on the business's side any more (a former team member asking about an
--    open task) is added again when they next open its chat.
--
-- 3. 20261020053000's repair of direct rooms runs once more, unchanged: production applied it at 07:47:46Z on
--    2026-10-20 while the previous API served requests until 08:22:40Z, and that API still made a staff member who
--    opened a customer conversation for the business a member of it. The new API removes such a row only when that
--    person opens the conversation for the business again.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.finalize_paid_gig_acceptance_as_actor(p_gig_id uuid,p_bid_id uuid,p_payer_id uuid,p_payment_id uuid,p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
BEGIN
 IF NOT public.paid_gig_actor_allowed(p_payer_id,p_actor_id) THEN RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
 RETURN public.finalize_paid_gig_acceptance(p_gig_id,p_bid_id,p_payer_id,p_payment_id);
END $$;

REVOKE ALL ON FUNCTION public.finalize_paid_gig_acceptance_as_actor(uuid,uuid,uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_paid_gig_acceptance_as_actor(uuid,uuid,uuid,uuid,uuid) TO service_role;

WITH staff AS (
  SELECT p.id, p.room_id, p.user_id
  FROM public."ChatParticipant" p
  JOIN public."ChatRoom" r ON r.id = p.room_id AND r.type = 'gig'
  JOIN public."Gig" g ON g.id = r.gig_id
  JOIN public."User" u ON u.id = g.user_id AND u.account_type = 'business'
  WHERE p.user_id <> g.user_id
    AND p.user_id IS DISTINCT FROM g.accepted_by
    AND EXISTS (SELECT FROM public."BusinessTeam" t WHERE t.business_user_id = g.user_id AND t.user_id = p.user_id)
), staff_reactions AS (
  DELETE FROM public."MessageReaction" mr
  USING public."ChatMessage" m, staff s
  WHERE mr.message_id = m.id AND m.room_id = s.room_id AND mr.user_id = s.user_id
  RETURNING mr.id
)
DELETE FROM public."ChatParticipant" p
USING staff s
WHERE p.id = s.id;

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
