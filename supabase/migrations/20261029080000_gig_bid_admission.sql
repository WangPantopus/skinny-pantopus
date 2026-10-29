-- Backwards compatible: yes. Preserve existing bids; serialize new pending bids.
-- This trigger sorts before guard_gig_stop_bid so it takes the stronger task lock first.
SET LOCAL lock_timeout = '5s';
CREATE FUNCTION public.guard_gig_bid_admission() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE g public."Gig";
BEGIN
 IF NEW.status IS DISTINCT FROM 'pending' THEN RETURN NEW; END IF;
 SELECT * INTO g FROM public."Gig" WHERE id=NEW.gig_id FOR UPDATE;
 IF NOT FOUND OR g.status<>'open' OR g.deadline<=clock_timestamp() THEN
  RAISE EXCEPTION 'GIG_BID_CLOSED' USING ERRCODE='23514';
 END IF;
 IF EXISTS(SELECT FROM public."UserBlock" WHERE
  (blocker_user_id=g.user_id AND blocked_user_id=NEW.user_id)
  OR (blocker_user_id=NEW.user_id AND blocked_user_id=g.user_id)) THEN
  RAISE EXCEPTION 'GIG_BID_BLOCKED' USING ERRCODE='23514';
 END IF;
 IF EXISTS(SELECT FROM public."GigBid" WHERE gig_id=NEW.gig_id AND user_id=NEW.user_id
  AND status IN ('pending','countered','pending_payment','accepted')) THEN
  RAISE EXCEPTION 'GIG_BID_EXISTS' USING ERRCODE='23505';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_gig_bid_admission BEFORE INSERT ON public."GigBid"
 FOR EACH ROW EXECUTE FUNCTION public.guard_gig_bid_admission();
REVOKE ALL ON FUNCTION public.guard_gig_bid_admission() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guard_gig_bid_admission() TO service_role;
