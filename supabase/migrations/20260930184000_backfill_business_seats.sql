-- Backwards compatible: yes. Adds a seat binding method and gives seats only to people who hold no seat
-- binding at all, for whom every seat-gated route already answers 403 under the deployed API; nothing they
-- can use today changes, whichever of this migration and its API ships first.
--
-- Crew seats for team members who never got one. The seat-based crew features read BusinessSeat +
-- SeatBinding: the dashboard Team tab, seat invites, Profiles & Privacy's Business Profiles and business
-- messaging. Since the 2026-03-01 identity backfill, three writers failed to keep them:
--   * creating a business never gave the owner a seat;
--   * the Team page's add-member never managed to write a seat (it wrote a column that does not exist, a
--     null display name and a binding method outside the enum);
--   * removing someone from one business deleted their seat bindings at every business.
-- The API is repaired in the same change.
--
-- What this file writes, evaluated once against the data as it stands before it runs:
--   * It considers only ACTIVE team members whose person holds NO seat binding anywhere.
--   * For each of their active memberships: if the 2026-03-01 backfill seat (seat id = BusinessTeam id) is
--     still active and bound to nobody, it is bound back to the member; otherwise a seat is created (named
--     like the API names seats: the team title, else the first name) and bound to the member.
--   * Bindings it writes use the existing method 'migration'. It deletes and updates nothing, and a second
--     run changes nothing.
-- People who already hold a seat binding and lack a seat at another business are left for a follow-up
-- migration once this API is deployed: the deployed API's seat lookup fails for anyone with two bindings,
-- so giving them a second one now would break the seat they use today.
--
-- Read-only preview (run before applying; the first two are 0 afterwards):
--   WITH unbound_users AS (
--     SELECT DISTINCT bt.user_id FROM public."BusinessTeam" bt
--     WHERE bt.is_active AND NOT EXISTS (SELECT 1 FROM public."SeatBinding" sb WHERE sb.user_id = bt.user_id)
--   ), orphan AS (
--     SELECT bt.id FROM public."BusinessTeam" bt
--     JOIN public."BusinessSeat" s ON s.id = bt.id AND s.business_user_id = bt.business_user_id AND s.is_active
--     WHERE bt.is_active AND NOT EXISTS (SELECT 1 FROM public."SeatBinding" sb WHERE sb.seat_id = s.id)
--   ), seatless AS (
--     SELECT bt.id, bt.user_id FROM public."BusinessTeam" bt
--     WHERE bt.is_active AND NOT EXISTS (
--       SELECT 1 FROM public."SeatBinding" sb JOIN public."BusinessSeat" s ON s.id = sb.seat_id
--       WHERE sb.user_id = bt.user_id AND s.business_user_id = bt.business_user_id AND s.is_active)
--   )
--   SELECT
--     count(*) FILTER (WHERE x.user_id IN (SELECT user_id FROM unbound_users) AND x.id IN (SELECT id FROM orphan)) AS seats_to_rebind,
--     count(*) FILTER (WHERE x.user_id IN (SELECT user_id FROM unbound_users) AND x.id NOT IN (SELECT id FROM orphan)) AS seats_to_create,
--     count(*) FILTER (WHERE x.user_id NOT IN (SELECT user_id FROM unbound_users)) AS left_for_after_api_deploy
--   FROM seatless x;

SET LOCAL lock_timeout='5s';

-- The API binds a member added from the Team page with this method. A value added here cannot be used in
-- the same transaction, so the backfill below writes only 'migration'.
ALTER TYPE public.seat_binding_method ADD VALUE IF NOT EXISTS 'iam_add';

-- One statement, so every condition reads the data as it stood before it.
WITH unbound_users AS MATERIALIZED (
  SELECT DISTINCT bt.user_id
  FROM public."BusinessTeam" bt
  WHERE bt.is_active
    AND NOT EXISTS (SELECT 1 FROM public."SeatBinding" sb WHERE sb.user_id = bt.user_id)
), orphan AS MATERIALIZED (
  -- 2026-03-01 backfill seats that are still active but bound to nobody
  SELECT s.id AS seat_id, bt.user_id
  FROM public."BusinessTeam" bt
  JOIN unbound_users uu ON uu.user_id = bt.user_id
  JOIN public."BusinessSeat" s
    ON s.id = bt.id AND s.business_user_id = bt.business_user_id AND s.is_active
  WHERE bt.is_active
    AND NOT EXISTS (SELECT 1 FROM public."SeatBinding" sb WHERE sb.seat_id = s.id)
), missing AS MATERIALIZED (
  SELECT
    gen_random_uuid() AS seat_id,
    bt.business_user_id,
    bt.user_id,
    bt.role_base,
    bt.notes,
    COALESCE(NULLIF(btrim(bt.title), ''), NULLIF(btrim(u.first_name), ''),
             NULLIF(split_part(btrim(u.name), ' ', 1), ''), 'Team Member') AS display_name,
    COALESCE(bt.joined_at, bt.created_at) AS accepted_at
  FROM public."BusinessTeam" bt
  JOIN unbound_users uu ON uu.user_id = bt.user_id
  JOIN public."User" u ON u.id = bt.user_id
  WHERE bt.is_active
    AND bt.id NOT IN (SELECT seat_id FROM orphan)
), seats AS (
  INSERT INTO public."BusinessSeat" (id, business_user_id, display_name, role_base, is_active, invite_status, accepted_at, notes)
  SELECT seat_id, business_user_id, display_name, role_base, true, 'accepted', accepted_at, notes
  FROM missing
  RETURNING id
)
INSERT INTO public."SeatBinding" (seat_id, user_id, binding_method)
SELECT seat_id, user_id, 'migration'::public.seat_binding_method FROM orphan
UNION ALL
SELECT m.seat_id, m.user_id, 'migration'::public.seat_binding_method FROM missing m JOIN seats s ON s.id = m.seat_id;
