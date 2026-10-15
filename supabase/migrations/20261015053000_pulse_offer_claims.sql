-- Backwards compatible: yes. Adds the approved private OfferClaim table (contract §4.2, table 4)
-- and two service-only functions; no existing table, column or endpoint changes, and older
-- clients never read claims. Deploy before backend.
--
-- Offer requests (S9, contract §2.8): one request per person and offer, at most five open
-- requests while the giver chooses, or the first request wins. Both functions lock the post
-- before its claims, so two simultaneous requests or choices share one outcome.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE public."OfferClaim" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public."Post"(id) ON DELETE CASCADE,
  claimer_id uuid NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'chosen', 'declined', 'gone')),
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, claimer_id)
);
ALTER TABLE public."OfferClaim" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."OfferClaim" FROM anon, authenticated;
GRANT ALL ON public."OfferClaim" TO service_role;
CREATE INDEX ON public."OfferClaim" (post_id, created_at, id);
CREATE INDEX ON public."OfferClaim" (claimer_id);
-- An offer goes to one person.
CREATE UNIQUE INDEX "OfferClaim_one_chosen" ON public."OfferClaim" (post_id) WHERE status = 'chosen';

-- The giver and the requester across a block in either direction.
CREATE FUNCTION public.pulse_users_blocked(p_a uuid, p_b uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public."UserBlock" b
    WHERE (b.blocker_user_id = p_a AND b.blocked_user_id = p_b)
       OR (b.blocker_user_id = p_b AND b.blocked_user_id = p_a));
$$;
REVOKE ALL ON FUNCTION public.pulse_users_blocked(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_users_blocked(uuid, uuid) TO service_role;

-- The server checked the shared audience wall first; a concurrent scope or moderation change
-- invalidates that snapshot. A repeated request returns the person's existing claim.
CREATE FUNCTION public.pulse_offer_request(
  p_post_id uuid, p_user_id uuid, p_note text, p_read_scope text, p_area_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  post public."Post";
  claim public."OfferClaim";
  open_requests integer;
BEGIN
  SELECT * INTO post FROM public."Post" WHERE id = p_post_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('code', 'POST_NOT_FOUND'); END IF;
  IF post.read_scope IS DISTINCT FROM p_read_scope OR post.area_id IS DISTINCT FROM p_area_id
      OR post.moderation_state <> 'live' THEN
    RETURN jsonb_build_object('code', 'POST_CHANGED');
  END IF;
  IF post.post_type <> 'offer' THEN RETURN jsonb_build_object('code', 'NOT_AN_OFFER'); END IF;
  IF post.user_id = p_user_id THEN RETURN jsonb_build_object('code', 'OWN_OFFER'); END IF;
  IF public.pulse_users_blocked(post.user_id, p_user_id) THEN
    RETURN jsonb_build_object('code', 'POST_NOT_FOUND');
  END IF;

  SELECT * INTO claim FROM public."OfferClaim" WHERE post_id = p_post_id AND claimer_id = p_user_id;
  IF FOUND THEN
    RETURN jsonb_build_object('claim_id', claim.id, 'status', claim.status, 'created', false,
      'giver_id', post.user_id);
  END IF;

  IF post.state <> 'open' OR post.resolution IS NOT NULL OR post.archived_at IS NOT NULL
      OR post.expires_at <= now() THEN
    RETURN jsonb_build_object('code', 'OFFER_GONE');
  END IF;

  IF COALESCE(post.claim_mode, 'choose') = 'first' THEN
    INSERT INTO public."OfferClaim" (post_id, claimer_id, status, note)
      VALUES (p_post_id, p_user_id, 'chosen', p_note) RETURNING * INTO claim;
    UPDATE public."Post" SET resolution = 'claimed', state = 'archived', is_archived = true,
      archived_at = now(), archive_reason = 'resolved' WHERE id = p_post_id;
  ELSE
    SELECT count(*) INTO open_requests FROM public."OfferClaim"
      WHERE post_id = p_post_id AND status = 'requested';
    IF open_requests >= 5 THEN RETURN jsonb_build_object('code', 'ENOUGH_REQUESTS'); END IF;
    INSERT INTO public."OfferClaim" (post_id, claimer_id, status, note)
      VALUES (p_post_id, p_user_id, 'requested', p_note) RETURNING * INTO claim;
  END IF;
  RETURN jsonb_build_object('claim_id', claim.id, 'status', claim.status, 'created', true,
    'giver_id', post.user_id);
END;
$$;
REVOKE ALL ON FUNCTION public.pulse_offer_request(uuid, uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_offer_request(uuid, uuid, text, text, uuid) TO service_role;

-- The giver picks one open request. Choosing the same winner again answers the same success;
-- every other open request becomes gone in the same transaction.
CREATE FUNCTION public.pulse_offer_choose(
  p_post_id uuid, p_claim_id uuid, p_user_id uuid, p_read_scope text, p_area_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  post public."Post";
  claim public."OfferClaim";
  gone jsonb;
BEGIN
  SELECT * INTO post FROM public."Post" WHERE id = p_post_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('code', 'POST_NOT_FOUND'); END IF;
  IF post.read_scope IS DISTINCT FROM p_read_scope OR post.area_id IS DISTINCT FROM p_area_id
      OR post.moderation_state <> 'live' THEN
    RETURN jsonb_build_object('code', 'POST_CHANGED');
  END IF;
  IF post.post_type <> 'offer' THEN RETURN jsonb_build_object('code', 'NOT_AN_OFFER'); END IF;
  IF post.user_id <> p_user_id THEN RETURN jsonb_build_object('code', 'NOT_POST_AUTHOR'); END IF;

  SELECT * INTO claim FROM public."OfferClaim" WHERE id = p_claim_id AND post_id = p_post_id FOR UPDATE;
  IF NOT FOUND OR public.pulse_users_blocked(post.user_id, claim.claimer_id) THEN
    RETURN jsonb_build_object('code', 'CLAIM_NOT_FOUND');
  END IF;
  IF claim.status = 'chosen' THEN
    RETURN jsonb_build_object('claim_id', claim.id, 'status', 'chosen', 'created', false,
      'claimer_id', claim.claimer_id, 'gone', '[]'::jsonb);
  END IF;
  IF claim.status <> 'requested' OR post.state <> 'open' OR post.resolution IS NOT NULL
      OR post.archived_at IS NOT NULL OR post.expires_at <= now() THEN
    RETURN jsonb_build_object('code', 'OFFER_GONE');
  END IF;

  UPDATE public."OfferClaim" SET status = 'chosen', updated_at = now() WHERE id = claim.id;
  WITH others AS (
    UPDATE public."OfferClaim" SET status = 'gone', updated_at = now()
      WHERE post_id = p_post_id AND status = 'requested' AND id <> claim.id
      RETURNING id, claimer_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('claim_id', id, 'claimer_id', claimer_id)), '[]'::jsonb)
    INTO gone FROM others;
  UPDATE public."Post" SET resolution = 'claimed', state = 'archived', is_archived = true,
    archived_at = now(), archive_reason = 'resolved' WHERE id = p_post_id;
  RETURN jsonb_build_object('claim_id', claim.id, 'status', 'chosen', 'created', true,
    'claimer_id', claim.claimer_id, 'gone', gone);
END;
$$;
REVOKE ALL ON FUNCTION public.pulse_offer_choose(uuid, uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_offer_choose(uuid, uuid, uuid, text, uuid) TO service_role;

-- Reply reports join the existing report queue (contract §2.7); post reports leave it null.
ALTER TABLE public."PostReport"
  ADD COLUMN comment_id uuid REFERENCES public."PostComment"(id) ON DELETE CASCADE;
CREATE INDEX "PostReport_comment_id_idx" ON public."PostReport" (comment_id) WHERE comment_id IS NOT NULL;
COMMIT;
