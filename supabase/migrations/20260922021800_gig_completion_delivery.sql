-- Backwards compatible: yes. Queue only new completion notifications using their
-- existing metadata and the existing delivery worker. No table/column/backfill.
-- Paid acceptance and Home assignment queues require different parent contracts;
-- completion includes free gigs. Keep private assignment/payment terms as hashes.
SET LOCAL lock_timeout='5s';

CREATE FUNCTION public.gig_completion_delivery_terms(g public."Gig",phase text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT encode(sha256(convert_to(jsonb_build_object('id',g.id,'owner',g.user_id,'worker',g.accepted_by,
  'payment',g.payment_id,'price',g.price,'accepted',extract(epoch FROM g.accepted_at),
  'started',extract(epoch FROM g.started_at),'completed',extract(epoch FROM g.worker_completed_at),
  'confirmed',CASE WHEN phase='worker' THEN NULL ELSE extract(epoch FROM g.owner_confirmed_at) END)::text,'UTF8')),'hex')
$$;
CREATE FUNCTION public.gig_completion_delivery_note(n public."Notification") RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT encode(sha256(convert_to(jsonb_build_object('id',n.id,'user',n.user_id,'type',n.type,'title',n.title,
  'body',n.body,'icon',n.icon,'link',n.link,'metadata',coalesce(n.metadata,'{}')-'gig_completion_delivery_v1',
  'context',n.context,'context_type',n.context_type,'context_id',n.context_id,'key',n.idempotency_key)::text,'UTF8')),'hex')
$$;

CREATE FUNCTION public.capture_gig_completion_delivery() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE prior jsonb; d jsonb; phase text; g public."Gig"; allowed boolean;
BEGIN
 IF TG_OP='UPDATE' THEN prior:=OLD.metadata->'gig_completion_delivery_v1'; END IF;
 d:=NEW.metadata->'gig_completion_delivery_v1';
 IF d IS DISTINCT FROM prior AND NOT (current_user IN ('postgres','service_role','supabase_admin')
  AND coalesce(current_setting('app.gig_completion_delivery',true),'')='on') THEN
  RAISE EXCEPTION 'Use the completion delivery transaction' USING ERRCODE='42501'; END IF;
 -- Ordinary/historical notices and user read-state changes are unaffected.
 IF TG_OP<>'INSERT' OR d IS NOT NULL THEN RETURN NEW; END IF;
 phase:=CASE WHEN NEW.type='gig_completed' AND NEW.idempotency_key LIKE 'gig-worker-completion:%' THEN 'worker'
  WHEN NEW.type='gig_confirmed' AND NEW.idempotency_key LIKE 'gig-confirmation:%' THEN 'owner'
  WHEN NEW.type='bid_rejected' AND NEW.idempotency_key LIKE 'gig-completion-bid:%' THEN 'bid' END;
 IF phase IS NULL THEN RETURN NEW; END IF;
 IF current_user NOT IN ('postgres','service_role','supabase_admin') THEN
  RAISE EXCEPTION 'Completion delivery requires service authority' USING ERRCODE='42501'; END IF;
 SELECT * INTO g FROM public."Gig" WHERE id=(NEW.metadata->>'gig_id')::uuid;
 IF NOT FOUND OR g.status IS DISTINCT FROM 'completed' OR g.worker_completed_at IS NULL
  OR NOT isfinite(g.worker_completed_at) OR NEW.context IS DISTINCT FROM 'personal'
  OR NEW.context_type IS DISTINCT FROM 'personal' OR NEW.context_id IS NOT NULL
  OR NEW.link IS DISTINCT FROM '/gigs/'||g.id
  OR (phase='worker' AND (g.owner_confirmed_at IS NOT NULL OR NEW.user_id=g.accepted_by
   OR NOT coalesce(NEW.user_id=g.user_id OR public.business_has_permission(g.user_id,'gigs.manage',NEW.user_id)
    OR public.business_has_permission(g.user_id,'gigs.post',NEW.user_id),false)))
  OR (phase<>'worker' AND (g.owner_confirmed_at IS NULL OR NOT isfinite(g.owner_confirmed_at)))
  OR (phase='owner' AND NEW.user_id IS DISTINCT FROM g.accepted_by)
  OR (phase='bid' AND NOT EXISTS(SELECT FROM public."GigBid" WHERE gig_id=g.id AND user_id=NEW.user_id AND status='rejected')) THEN
  RAISE EXCEPTION 'Completion notification does not match its receipt' USING ERRCODE='23514'; END IF;
 allowed:=EXISTS(SELECT FROM public."MailPreferences" WHERE user_id=NEW.user_id AND push_notifications=true)
  AND NOT EXISTS(SELECT FROM public."UserNotificationPreferences" WHERE user_id=NEW.user_id AND gig_updates_enabled=false);
 NEW.metadata:=coalesce(NEW.metadata,'{}')||jsonb_build_object('gig_completion_delivery_v1',jsonb_build_object(
  'version',1,'phase',phase,'terms_hash',public.gig_completion_delivery_terms(g,phase),
  'note_hash',public.gig_completion_delivery_note(NEW),'push_allowed_at_completion',allowed,
  'state','pending','attempts',0,'retry_at',clock_timestamp(),'completed_at',NULL));
 RETURN NEW;
END $$;
CREATE TRIGGER capture_gig_completion_delivery BEFORE INSERT OR UPDATE ON public."Notification"
 FOR EACH ROW EXECUTE FUNCTION public.capture_gig_completion_delivery();
CREATE INDEX notification_gig_completion_delivery_pending ON public."Notification"(created_at,id)
 WHERE metadata->'gig_completion_delivery_v1'->>'state' IN ('pending','processing');

CREATE FUNCTION public.claim_gig_completion_delivery() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE n public."Notification"; d jsonb;
BEGIN
 SELECT * INTO n FROM public."Notification" WHERE
  (metadata->'gig_completion_delivery_v1'->>'state'='pending' AND (metadata->'gig_completion_delivery_v1'->>'retry_at')::timestamptz<=clock_timestamp())
  OR (metadata->'gig_completion_delivery_v1'->>'state'='processing' AND (metadata->'gig_completion_delivery_v1'->>'lease_until')::timestamptz<=clock_timestamp())
 ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED;
 IF NOT FOUND THEN RETURN NULL; END IF;
 d:=(n.metadata->'gig_completion_delivery_v1')||jsonb_build_object('state','processing','lease_id',gen_random_uuid(),
  'lease_until',clock_timestamp()+interval '5 minutes','attempts',(n.metadata->'gig_completion_delivery_v1'->>'attempts')::integer+1);
 PERFORM set_config('app.gig_completion_delivery','on',true);
 UPDATE public."Notification" SET metadata=jsonb_set(metadata,'{gig_completion_delivery_v1}',d) WHERE id=n.id;
 PERFORM set_config('app.gig_completion_delivery','off',true);
 RETURN jsonb_build_object('id',n.id,'lease_id',d->>'lease_id');
END $$;

CREATE FUNCTION public.read_gig_completion_delivery(p_id uuid,p_lease_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE n public."Notification"; g public."Gig"; d jsonb; eligible boolean; observed_gig_id uuid;
BEGIN
 -- Completion holds Gig before inserting Notification. Match that order, then
 -- recheck the lease and immutable hashes. Recipient deletion remains effective.
 SELECT CASE WHEN metadata->>'gig_id' ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  THEN (metadata->>'gig_id')::uuid END INTO observed_gig_id FROM public."Notification" WHERE id=p_id;
 SELECT * INTO g FROM public."Gig" WHERE id=observed_gig_id FOR SHARE;
 SELECT * INTO n FROM public."Notification" WHERE id=p_id FOR UPDATE;
 d:=n.metadata->'gig_completion_delivery_v1';
 IF n.id IS NULL OR d IS NULL OR p_lease_id IS NULL OR d->>'lease_id' IS DISTINCT FROM p_lease_id::text
  OR d->>'state' IS DISTINCT FROM 'processing' OR coalesce((d->>'lease_until')::timestamptz,'-infinity')<=clock_timestamp() THEN
  RETURN '{"error":"LEASE_LOST"}'::jsonb; END IF;
 eligible:=g.id IS NOT NULL AND g.id::text=n.metadata->>'gig_id' AND g.status='completed'
  AND public.gig_completion_delivery_terms(g,d->>'phase')=d->>'terms_hash'
  AND public.gig_completion_delivery_note(n)=d->>'note_hash';
 IF d->>'phase'='worker' THEN
  eligible:=eligible AND g.owner_confirmed_at IS NULL AND n.user_id<>g.accepted_by
   AND (n.user_id=g.user_id OR public.business_has_permission(g.user_id,'gigs.manage',n.user_id)
    OR public.business_has_permission(g.user_id,'gigs.post',n.user_id));
 ELSE
  eligible:=eligible AND g.owner_confirmed_at IS NOT NULL
   AND ((d->>'phase'='owner' AND n.user_id=g.accepted_by)
    OR (d->>'phase'='bid' AND EXISTS(SELECT FROM public."GigBid" WHERE gig_id=g.id AND user_id=n.user_id AND status='rejected')));
  IF g.payment_id IS NOT NULL THEN
   eligible:=eligible AND EXISTS(SELECT FROM public."Payment" p WHERE p.id=g.payment_id AND p.gig_id=g.id
    AND p.payer_id=g.user_id AND p.payee_id=g.accepted_by AND p.amount_total=round(g.price*100)::integer
    AND p.payment_status IN ('captured_hold','transfer_scheduled','transfer_pending','transferred')
    AND coalesce(p.refunded_amount,0)=0 AND p.dispute_id IS NULL);
  END IF;
 END IF;
 RETURN jsonb_build_object('eligible',coalesce(eligible,false),'pushAllowedAtCompletion',d->'push_allowed_at_completion',
  'notification',CASE WHEN eligible THEN to_jsonb(n)||jsonb_build_object('metadata',n.metadata-'gig_completion_delivery_v1') END);
END $$;

CREATE FUNCTION public.finish_gig_completion_delivery(p_id uuid,p_lease_id uuid,p_outcome text,p_error text DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE n public."Notification"; d jsonb;
BEGIN
 IF p_outcome IS NULL OR p_outcome NOT IN ('done','suppressed','retry') THEN RETURN false; END IF;
 SELECT * INTO n FROM public."Notification" WHERE id=p_id FOR UPDATE;
 d:=n.metadata->'gig_completion_delivery_v1';
 -- Deleting a notice cancels delivery; the worker must never recreate it.
 IF n.id IS NULL THEN RETURN true; END IF;
 IF d IS NULL OR p_lease_id IS NULL OR d->>'lease_id' IS DISTINCT FROM p_lease_id::text
  OR d->>'state' IS DISTINCT FROM 'processing' OR coalesce((d->>'lease_until')::timestamptz,'-infinity')<=clock_timestamp() THEN RETURN false; END IF;
 d:=(d-'lease_id'-'lease_until')||jsonb_build_object('state',CASE WHEN p_outcome='retry' THEN 'pending' ELSE p_outcome END,
  'retry_at',clock_timestamp()+make_interval(secs=>least(3600,30*least(greatest((d->>'attempts')::integer,1),120))),
  'last_error',left(p_error,100),'completed_at',CASE WHEN p_outcome='retry' THEN 'null'::jsonb ELSE to_jsonb(clock_timestamp()) END);
 PERFORM set_config('app.gig_completion_delivery','on',true);
 UPDATE public."Notification" SET metadata=jsonb_set(metadata,'{gig_completion_delivery_v1}',d) WHERE id=n.id;
 PERFORM set_config('app.gig_completion_delivery','off',true);
 RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.gig_completion_delivery_terms(public."Gig",text),public.gig_completion_delivery_note(public."Notification"),
 public.capture_gig_completion_delivery(),public.claim_gig_completion_delivery(),public.read_gig_completion_delivery(uuid,uuid),
 public.finish_gig_completion_delivery(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gig_completion_delivery_terms(public."Gig",text),public.gig_completion_delivery_note(public."Notification"),
 public.capture_gig_completion_delivery(),public.claim_gig_completion_delivery(),public.read_gig_completion_delivery(uuid,uuid),
 public.finish_gig_completion_delivery(uuid,uuid,text,text) TO service_role;
