-- Backwards compatible: yes. Existing clients find helper assignments through GigBid.
-- Instant acceptance agrees to the listed price and needs the same accepted record.
SET LOCAL lock_timeout = '5s';

CREATE FUNCTION public.record_instant_gig_bid(p_gig_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE g public."Gig"; bid_id uuid;
BEGIN
 SELECT * INTO g FROM public."Gig" WHERE id=p_gig_id FOR UPDATE;
 IF NOT FOUND OR g.engagement_mode IS DISTINCT FROM 'instant_accept'
    OR g.status NOT IN ('assigned','in_progress','completed') OR g.accepted_by IS NULL THEN RETURN; END IF;
 -- A saved stop request has already frozen its bid identity; leave it untouched.
 IF EXISTS (SELECT FROM public."GigStopRequest" WHERE gig_id=g.id AND state<>'completed') THEN RETURN; END IF;
 IF EXISTS (SELECT FROM public."GigBid" WHERE gig_id=g.id AND user_id=g.accepted_by AND status='accepted') THEN RETURN; END IF;
 SELECT id INTO bid_id FROM public."GigBid"
 WHERE gig_id=g.id AND user_id=g.accepted_by AND status IN ('pending','countered')
 ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE;
 IF FOUND THEN
  UPDATE public."GigBid" SET status='accepted',bid_amount=g.price,expires_at=NULL,
    counter_amount=NULL,counter_message=NULL,counter_status=NULL,updated_at=now() WHERE id=bid_id;
 ELSE
  INSERT INTO public."GigBid" (gig_id,user_id,bid_amount,status,created_at,updated_at)
  VALUES (g.id,g.accepted_by,g.price,'accepted',coalesce(g.accepted_at,g.updated_at,now()),now());
 END IF;
END $$;

CREATE FUNCTION public.record_instant_gig_bid_trigger() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM public.record_instant_gig_bid(NEW.id);
 RETURN NEW;
END $$;

CREATE TRIGGER record_instant_gig_bid AFTER INSERT OR UPDATE OF status,accepted_by ON public."Gig"
 FOR EACH ROW WHEN (NEW.engagement_mode='instant_accept' AND NEW.accepted_by IS NOT NULL
   AND NEW.status IN ('assigned','in_progress','completed'))
 EXECUTE FUNCTION public.record_instant_gig_bid_trigger();

REVOKE ALL ON FUNCTION public.record_instant_gig_bid(uuid),public.record_instant_gig_bid_trigger() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_instant_gig_bid(uuid),public.record_instant_gig_bid_trigger() TO service_role;

-- Recover prior instant assignments without changing their payment or task timestamps.
DO $$ DECLARE gig_id uuid; BEGIN
 FOR gig_id IN SELECT g.id FROM public."Gig" g
  WHERE g.engagement_mode='instant_accept' AND g.accepted_by IS NOT NULL
    AND g.status IN ('assigned','in_progress','completed')
    AND NOT EXISTS (SELECT FROM public."GigBid" b WHERE b.gig_id=g.id AND b.user_id=g.accepted_by AND b.status='accepted')
 LOOP PERFORM public.record_instant_gig_bid(gig_id); END LOOP;
END $$;
