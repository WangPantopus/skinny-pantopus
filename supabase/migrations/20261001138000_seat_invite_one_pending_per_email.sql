-- Crew seat invites: one pending invite per crew and email.
--
-- Stream 5's native-POST audit (2026-10-01, audit 20261001-stream5-native-post-idempotency-r1) sent the same
-- POST /api/businesses/:id/seats/invite several times at once and got several pending seats for one email. Each
-- had its own link, and afterwards the route's one-row pre-check failed on the duplicates and let still more through.
-- The route now reads the newest pending invite and renews it for the same inviter. This index closes the
-- simultaneous case: a second pending insert for the same crew and email fails, and the route renews or refuses.
--
-- Existing duplicates: for each crew and email (case-insensitive), the newest pending invite stays pending and the
-- older ones become expired, so their links stop working as an expired invite's do. Accepted, declined and expired
-- rows are untouched, as are seats without an invite email.
--
-- Backwards compatible: yes. The index is partial (pending invites with an email only). The deployed backend's invite
-- route keeps working; only simultaneous duplicate inserts, which it would otherwise have kept, now fail with a
-- unique violation that it answers as a failed invite.

SET LOCAL lock_timeout = '5s';

UPDATE public."BusinessSeat" AS s
   SET invite_status = 'expired',
       updated_at = now()
 WHERE s.invite_status = 'pending'
   AND s.invite_email IS NOT NULL
   AND EXISTS (
     SELECT 1
       FROM public."BusinessSeat" AS newer
      WHERE newer.business_user_id = s.business_user_id
        AND lower(newer.invite_email) = lower(s.invite_email)
        AND newer.invite_status = 'pending'
        AND (newer.created_at, newer.id) > (s.created_at, s.id)
   );

CREATE UNIQUE INDEX "BusinessSeat_one_pending_invite_per_email"
  ON public."BusinessSeat" (business_user_id, lower(invite_email))
  WHERE invite_status = 'pending' AND invite_email IS NOT NULL;
