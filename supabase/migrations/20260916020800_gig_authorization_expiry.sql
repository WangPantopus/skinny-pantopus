-- Backwards compatible: yes. No historical money, authorization or notice backfill.
-- Deploy with the exact provider-proof expiry service; all gates are service-only.
SET LOCAL lock_timeout='5s';
CREATE TABLE public."GigAuthorizationExpiry" (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 payment_id uuid NOT NULL REFERENCES public."Payment"(id) ON DELETE RESTRICT,
 gig_id uuid NOT NULL REFERENCES public."Gig"(id) ON DELETE RESTRICT,
 snapshot jsonb NOT NULL,intent_id text NOT NULL,charge_id text NOT NULL,capture_before bigint NOT NULL,
 kind text NOT NULL CHECK(kind IN ('cancel','attention')),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','complete')),
 lease_id uuid,lease_until timestamptz,requested_at timestamptz,provider_receipt jsonb,
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),last_error text,completed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(payment_id,intent_id,charge_id,capture_before,kind)
);
CREATE UNIQUE INDEX gig_authorization_expiry_active ON public."GigAuthorizationExpiry"(payment_id) WHERE kind='cancel' AND state='pending';
CREATE TABLE public."GigAuthorizationExpiryScan" (
 payment_id uuid PRIMARY KEY REFERENCES public."Payment"(id) ON DELETE CASCADE,
 checked_at timestamptz NOT NULL DEFAULT 'epoch'
);
CREATE TABLE public."GigAuthorizationExpiryDelivery" (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 expiry_id uuid NOT NULL REFERENCES public."GigAuthorizationExpiry"(id) ON DELETE RESTRICT,
 user_id uuid NOT NULL REFERENCES public."User"(id) ON DELETE RESTRICT,
 notification_id uuid REFERENCES public."Notification"(id) ON DELETE SET NULL,
 notification_snapshot jsonb,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','processing','done','suppressed')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),retry_at timestamptz NOT NULL DEFAULT now(),
 lease_id uuid,lease_until timestamptz,last_error text,completed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(expiry_id,user_id)
);
CREATE INDEX gig_authorization_expiry_delivery_pending ON public."GigAuthorizationExpiryDelivery"(retry_at) WHERE state IN ('pending','processing');
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['GigAuthorizationExpiry','GigAuthorizationExpiryScan','GigAuthorizationExpiryDelivery'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
 EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
END $$;

CREATE FUNCTION public.gig_expiry_payment_snapshot(p public."Payment") RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT public.legacy_gig_authorization_snapshot(p)||jsonb_build_object('intent_id',p.stripe_payment_intent_id)
$$;
CREATE FUNCTION public.gig_expiry_payment_safe(p public."Payment") RETURNS boolean
LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT p.payment_type='gig_payment' AND lower(p.currency)='usd' AND p.amount_total>=50
 AND p.stripe_payment_intent_id IS NOT NULL AND p.stripe_customer_id IS NOT NULL
 AND p.payment_status IN ('authorized','canceled') AND p.captured_at IS NULL AND coalesce(p.capture_attempts,0)=0
 AND p.dispute_id IS NULL AND coalesce(p.refunded_amount,0)=0 AND p.stripe_transfer_id IS NULL
 AND NOT EXISTS(SELECT FROM public."PaymentRefundRequest" WHERE payment_id=p.id AND status IN ('pending','requires_action'))
$$;
CREATE FUNCTION public.gig_expiry_proof_valid(p public."Payment",v jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT coalesce(v->>'id'=p.stripe_payment_intent_id AND v->>'customer'=p.stripe_customer_id
 AND v->>'amount'=p.amount_total::text AND v->>'currency'='usd' AND v->>'capture_method'='manual'
 AND v->>'payer_id'=p.payer_id::text AND v->>'payee_id'=p.payee_id::text AND v->>'gig_id'=p.gig_id::text
 AND (p.metadata->>'acceptance_attempt_id' IS NULL OR v->>'acceptance_attempt_id'=p.metadata->>'acceptance_attempt_id')
 AND v->>'status' IN ('requires_capture','canceled') AND v->>'amount_received'='0' AND v->>'amount_captured'='0'
 AND ((v->'charge_refunded'='false'::jsonb AND v->>'charge_amount_refunded'='0')
  OR (v->>'status'='canceled' AND v->'charge_refunded'='true'::jsonb AND v->>'charge_amount_refunded'=p.amount_total::text))
 AND v->>'charge_id' ~ '^ch_[a-zA-Z0-9]+$' AND jsonb_typeof(v->'capture_before')='number'
 AND v->>'capture_before' ~ '^[0-9]{1,12}$'
 AND CASE WHEN v->>'capture_before' ~ '^[0-9]{1,12}$' THEN (v->>'capture_before')::numeric BETWEEN 1 AND 253402300799 ELSE false END
 AND v->>'amount_capturable'=CASE WHEN v->>'status'='requires_capture' THEN p.amount_total::text ELSE '0' END,false)
$$;

-- Fair discovery uses current authorized payments, never an estimated local
-- deadline as proof that a provider hold is not yet due. Failed reads rotate too.
CREATE FUNCTION public.claim_gig_expiry_scan(p_limit integer DEFAULT 100) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE ids uuid[];
BEGIN
 INSERT INTO public."GigAuthorizationExpiryScan"(payment_id)
 SELECT p.id FROM public."Payment" p WHERE p.payment_type='gig_payment' AND p.gig_id IS NOT NULL
 AND ((p.payment_status IN ('authorized','canceled') AND p.stripe_payment_intent_id IS NOT NULL
  AND EXISTS(SELECT FROM public."Gig" g WHERE g.id=p.gig_id AND g.payment_id=p.id AND g.status IN ('assigned','in_progress')))
  OR EXISTS(SELECT FROM public."GigAuthorizationExpiry" e WHERE e.payment_id=p.id AND e.state='pending'))
 ON CONFLICT DO NOTHING;
 WITH selected AS (
 SELECT s.payment_id FROM public."GigAuthorizationExpiryScan" s JOIN public."Payment" p ON p.id=s.payment_id
 WHERE s.checked_at<clock_timestamp()-interval '15 minutes' AND ((p.payment_status IN ('authorized','canceled') AND p.stripe_payment_intent_id IS NOT NULL
  AND EXISTS(SELECT FROM public."Gig" g WHERE g.id=p.gig_id AND g.payment_id=p.id AND g.status IN ('assigned','in_progress')))
  OR EXISTS(SELECT FROM public."GigAuthorizationExpiry" e WHERE e.payment_id=p.id AND e.state='pending'))
 ORDER BY s.checked_at,s.payment_id LIMIT least(greatest(coalesce(p_limit,100),1),100) FOR UPDATE OF s SKIP LOCKED
 ), changed AS (
 UPDATE public."GigAuthorizationExpiryScan" s SET checked_at=clock_timestamp() FROM selected c WHERE s.payment_id=c.payment_id RETURNING s.payment_id
 ) SELECT array_agg(payment_id) INTO ids FROM changed;
 RETURN to_jsonb(coalesce(ids,ARRAY[]::uuid[]));
END $$;

CREATE FUNCTION public.read_gig_authorization_expiry(p_payment_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE p public."Payment";g public."Gig";e public."GigAuthorizationExpiry";
BEGIN
 SELECT * INTO p FROM public."Payment" WHERE id=p_payment_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 SELECT * INTO g FROM public."Gig" WHERE id=p.gig_id FOR UPDATE;
 SELECT * INTO p FROM public."Payment" WHERE id=p_payment_id FOR UPDATE;
 IF g.id IS NULL OR g.payment_id IS DISTINCT FROM p.id OR g.user_id IS DISTINCT FROM p.payer_id
 OR g.accepted_by IS DISTINCT FROM p.payee_id OR p.payee_id IS NULL OR round(g.price*100)::bigint IS DISTINCT FROM p.amount_total THEN
 RETURN jsonb_build_object('error','TERMS_CHANGED'); END IF;
 SELECT * INTO e FROM public."GigAuthorizationExpiry" WHERE payment_id=p.id AND kind='cancel' ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF e.id IS NOT NULL AND e.snapshot IS DISTINCT FROM public.gig_expiry_payment_snapshot(p) THEN RETURN jsonb_build_object('error','TERMS_CHANGED'); END IF;
 IF e.state='pending' AND NOT coalesce(public.gig_expiry_payment_safe(p),false) THEN
 RETURN jsonb_build_object('payment',to_jsonb(p),'gig',to_jsonb(g),'operation',to_jsonb(e),'reviewOnly',true); END IF;
 IF e.state='complete' AND g.status='cancelled' AND g.cancellation_reason='authorization_expired' AND p.payment_status='canceled' AND g.started_at IS NULL AND coalesce(public.gig_expiry_payment_safe(p),false) THEN
 RETURN jsonb_build_object('payment',to_jsonb(p),'gig',to_jsonb(g),'operation',to_jsonb(e),'complete',true); END IF;
 IF g.status NOT IN ('assigned','in_progress') OR NOT coalesce(public.gig_expiry_payment_safe(p),false)
 OR (g.status='assigned' AND (g.started_at IS NOT NULL OR g.worker_completed_at IS NOT NULL OR g.owner_confirmed_at IS NOT NULL)) THEN
 RETURN jsonb_build_object('error','PAYMENT_CHANGED'); END IF;
 RETURN jsonb_build_object('payment',to_jsonb(p),'gig',to_jsonb(g),'operation',CASE WHEN e.id IS NULL THEN NULL ELSE to_jsonb(e) END,'expected',public.gig_expiry_payment_snapshot(p));
END $$;

CREATE FUNCTION public.gig_expiry_note_snapshot(n public."Notification") RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('user_id',n.user_id,'type',n.type,'title',n.title,'body',n.body,'icon',n.icon,'link',n.link,'metadata',n.metadata,'idempotency_key',n.idempotency_key)
$$;
CREATE FUNCTION public.materialize_gig_expiry_notices(p_expiry_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public."GigAuthorizationExpiry";p public."Payment";g public."Gig";n public."Notification";recipient uuid;event_id uuid;kind text;
BEGIN
 SELECT * INTO e FROM public."GigAuthorizationExpiry" WHERE id=p_expiry_id FOR UPDATE;
 IF e.id IS NULL OR e.state<>'complete' OR e.provider_receipt IS NULL THEN RAISE EXCEPTION 'Verified expiry receipt required' USING ERRCODE='23514'; END IF;
 SELECT * INTO p FROM public."Payment" WHERE id=e.payment_id;
 SELECT * INTO g FROM public."Gig" WHERE id=e.gig_id;
 kind:=CASE WHEN e.kind='cancel' THEN 'gig_auto_cancelled' ELSE 'payment_auth_expiring' END;
 FOR recipient IN SELECT DISTINCT v FROM unnest(ARRAY[p.payer_id,p.payee_id]) AS v LOOP
  INSERT INTO public."GigAuthorizationExpiryDelivery"(expiry_id,user_id) VALUES(e.id,recipient) ON CONFLICT DO NOTHING RETURNING id INTO event_id;
  IF event_id IS NULL THEN CONTINUE; END IF;
  INSERT INTO public."Notification"(user_id,type,title,body,icon,link,metadata,idempotency_key)
  VALUES(recipient,kind,CASE WHEN e.kind='cancel' THEN 'Task cancelled: payment hold released' ELSE 'Task payment needs attention' END,
   CASE WHEN e.kind='cancel' THEN 'The payment hold for this task was released. This task was cancelled before work started. No task payment was charged.'
   ELSE 'The payment hold for this task is expiring or has expired while work is in progress. Contact support to resolve payment before continuing work. Only confirm completion when the work is complete.' END,
   '⏰','/gigs/'||g.id,jsonb_build_object('gig_id',g.id,'payment_id',p.id,'authorization_expiry_id',e.id,'capture_before',e.capture_before),
   'gig-expiry:'||e.id||':'||recipient) RETURNING * INTO n;
  UPDATE public."GigAuthorizationExpiryDelivery" SET notification_id=n.id,notification_snapshot=public.gig_expiry_note_snapshot(n) WHERE id=event_id;
 END LOOP;
END $$;

CREATE FUNCTION public.begin_gig_authorization_expiry(p_payment_id uuid,p_expected jsonb,p_proof jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE d jsonb;p public."Payment";g public."Gig";e public."GigAuthorizationExpiry";v_kind text;
BEGIN
 d:=public.read_gig_authorization_expiry(p_payment_id);
 IF d ? 'error' OR coalesce((d->>'complete')::boolean,false) THEN RETURN d; END IF;
 IF coalesce((d->>'reviewOnly')::boolean,false) THEN RETURN jsonb_build_object('error','PAYMENT_CHANGED'); END IF;
 SELECT * INTO p FROM jsonb_populate_record(NULL::public."Payment",d->'payment');
 SELECT * INTO g FROM jsonb_populate_record(NULL::public."Gig",d->'gig');
 IF public.gig_expiry_payment_snapshot(p) IS DISTINCT FROM p_expected OR NOT public.gig_expiry_proof_valid(p,p_proof) THEN RETURN jsonb_build_object('error','INVALID_PROOF'); END IF;
 SELECT * INTO e FROM public."GigAuthorizationExpiry" WHERE payment_id=p.id AND kind='cancel' AND state='pending' FOR UPDATE;
 IF FOUND THEN
  IF e.intent_id IS DISTINCT FROM p_proof->>'id' OR e.charge_id IS DISTINCT FROM p_proof->>'charge_id' OR e.capture_before::text IS DISTINCT FROM p_proof->>'capture_before' THEN
   RETURN jsonb_build_object('error','OPERATION_CHANGED'); END IF;
  RETURN jsonb_set(d,'{operation}',to_jsonb(e));
 END IF;
 IF EXISTS(SELECT FROM public."GigLegacyAuthorization" WHERE payment_id=p.id AND NOT superseded AND (cancel_requested OR lease_until>clock_timestamp())) THEN
  RETURN jsonb_build_object('error','AUTHORIZATION_BUSY'); END IF;
 UPDATE public."Payment" SET authorization_expires_at=to_timestamp((p_proof->>'capture_before')::double precision),stripe_charge_id=p_proof->>'charge_id',updated_at=clock_timestamp() WHERE id=p.id;
 IF to_timestamp((p_proof->>'capture_before')::double precision)>clock_timestamp()+interval '24 hours' THEN RETURN jsonb_build_object('notDue',true); END IF;
 v_kind:=CASE WHEN g.status='assigned' THEN 'cancel' ELSE 'attention' END;
 INSERT INTO public."GigAuthorizationExpiry"(payment_id,gig_id,snapshot,intent_id,charge_id,capture_before,kind)
 VALUES(p.id,g.id,p_expected,p_proof->>'id',p_proof->>'charge_id',(p_proof->>'capture_before')::bigint,v_kind)
 ON CONFLICT(payment_id,intent_id,charge_id,capture_before,kind) DO UPDATE SET last_error="GigAuthorizationExpiry".last_error RETURNING * INTO e;
 IF v_kind='attention' AND e.state<>'complete' THEN
  UPDATE public."GigAuthorizationExpiry" SET state='complete',provider_receipt=p_proof,completed_at=clock_timestamp() WHERE id=e.id RETURNING * INTO e;
  PERFORM public.materialize_gig_expiry_notices(e.id);
 END IF;
 RETURN jsonb_set(d,'{operation}',to_jsonb(e));
END $$;

CREATE FUNCTION public.claim_gig_authorization_expiry(p_payment_id uuid,p_expiry_id uuid,p_proof jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE d jsonb;p public."Payment";e public."GigAuthorizationExpiry";
BEGIN
 d:=public.read_gig_authorization_expiry(p_payment_id);IF d ? 'error' OR coalesce((d->>'complete')::boolean,false) THEN RETURN d; END IF;
 IF coalesce((d->>'reviewOnly')::boolean,false) THEN RETURN jsonb_build_object('error','PAYMENT_CHANGED'); END IF;
 SELECT * INTO p FROM jsonb_populate_record(NULL::public."Payment",d->'payment');
 SELECT * INTO e FROM public."GigAuthorizationExpiry" WHERE id=p_expiry_id AND payment_id=p.id FOR UPDATE;
 IF e.id IS NULL OR e.kind<>'cancel' OR e.state<>'pending' OR d->'gig'->>'status' IS DISTINCT FROM 'assigned'
 OR e.snapshot IS DISTINCT FROM public.gig_expiry_payment_snapshot(p) OR NOT public.gig_expiry_proof_valid(p,p_proof)
 OR e.intent_id IS DISTINCT FROM p_proof->>'id' OR e.charge_id IS DISTINCT FROM p_proof->>'charge_id'
 OR e.capture_before::text IS DISTINCT FROM p_proof->>'capture_before' THEN RETURN jsonb_build_object('error','INVALID_PROOF'); END IF;
 IF e.lease_until>clock_timestamp() THEN RETURN jsonb_build_object('error','BUSY'); END IF;
 UPDATE public."GigAuthorizationExpiry" SET lease_id=gen_random_uuid(),lease_until=clock_timestamp()+interval '60 seconds',
 requested_at=coalesce(requested_at,clock_timestamp()),attempts=attempts+1,last_error=NULL WHERE id=e.id RETURNING * INTO e;
 RETURN jsonb_set(d,'{operation}',to_jsonb(e));
END $$;

CREATE FUNCTION public.record_gig_authorization_expiry(p_payment_id uuid,p_expiry_id uuid,p_proof jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE p public."Payment";g public."Gig";e public."GigAuthorizationExpiry";
BEGIN
 SELECT * INTO p FROM public."Payment" WHERE id=p_payment_id;
 SELECT * INTO g FROM public."Gig" WHERE id=p.gig_id FOR UPDATE;
 SELECT * INTO p FROM public."Payment" WHERE id=p_payment_id FOR UPDATE;
 SELECT * INTO e FROM public."GigAuthorizationExpiry" WHERE id=p_expiry_id AND payment_id=p.id FOR UPDATE;
 IF e.id IS NULL OR e.kind<>'cancel' OR e.state NOT IN ('pending','complete')
 OR e.snapshot IS DISTINCT FROM public.gig_expiry_payment_snapshot(p) OR NOT public.gig_expiry_proof_valid(p,p_proof)
 OR p_proof->>'status' IS DISTINCT FROM 'canceled' OR e.intent_id IS DISTINCT FROM p_proof->>'id'
 OR e.charge_id IS DISTINCT FROM p_proof->>'charge_id' OR e.capture_before::text IS DISTINCT FROM p_proof->>'capture_before' THEN
 RETURN jsonb_build_object('error','INVALID_PROOF'); END IF;
 IF e.state='complete' THEN RETURN jsonb_build_object('operation',to_jsonb(e),'complete',true); END IF;
 IF g.id IS NULL OR g.payment_id IS DISTINCT FROM p.id OR g.user_id IS DISTINCT FROM p.payer_id OR g.accepted_by IS DISTINCT FROM p.payee_id
  OR round(g.price*100)::bigint IS DISTINCT FROM p.amount_total OR g.status IS DISTINCT FROM 'assigned' OR g.started_at IS NOT NULL
  OR g.worker_completed_at IS NOT NULL OR g.owner_confirmed_at IS NOT NULL OR NOT coalesce(public.gig_expiry_payment_safe(p),false) THEN
  UPDATE public."GigAuthorizationExpiry" SET provider_receipt=p_proof,last_error='PAYMENT_CHANGED',lease_id=NULL,lease_until=NULL WHERE id=e.id RETURNING * INTO e;
  RETURN jsonb_build_object('operation',to_jsonb(e),'pending',true,'needsReview',true); END IF;
 PERFORM set_config('app.gig_expiry_receipt','on',true);
 UPDATE public."Payment" SET payment_status='canceled',authorization_expires_at=to_timestamp(e.capture_before),stripe_charge_id=e.charge_id,updated_at=clock_timestamp() WHERE id=p.id RETURNING * INTO p;
 UPDATE public."Gig" SET status='cancelled',cancelled_at=clock_timestamp(),cancellation_reason='authorization_expired',cancellation_zone=1,cancellation_fee=0,payment_status='canceled',updated_at=clock_timestamp() WHERE id=g.id RETURNING * INTO g;
 UPDATE public."GigAuthorizationExpiry" SET state='complete',provider_receipt=p_proof,completed_at=clock_timestamp(),lease_id=NULL,lease_until=NULL,last_error=NULL WHERE id=e.id RETURNING * INTO e;
 PERFORM set_config('app.gig_expiry_receipt','off',true);
 PERFORM public.materialize_gig_expiry_notices(e.id);
 RETURN jsonb_build_object('payment',to_jsonb(p),'gig',to_jsonb(g),'operation',to_jsonb(e),'complete',true);
END $$;
CREATE FUNCTION public.release_gig_expiry_lease(p_id uuid,p_lease_id uuid,p_error text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 UPDATE public."GigAuthorizationExpiry" SET lease_id=NULL,lease_until=NULL,last_error=left(p_error,100)
 WHERE id=p_id AND state='pending' AND lease_id=p_lease_id;
 RETURN FOUND;
END $$;

-- Payment locking serializes every admission. A pending cancellation remains a
-- barrier even after a lease times out or the provider response is unknown.
CREATE FUNCTION public.guard_gig_expiry_payment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF EXISTS(SELECT FROM public."GigAuthorizationExpiry" WHERE payment_id=OLD.id AND kind='cancel' AND state='pending')
 AND current_setting('app.gig_expiry_receipt',true) IS DISTINCT FROM 'on'
 AND (public.gig_expiry_payment_snapshot(NEW) IS DISTINCT FROM public.gig_expiry_payment_snapshot(OLD)
  OR (NEW.payment_status IS DISTINCT FROM OLD.payment_status AND NEW.payment_status IS DISTINCT FROM 'disputed')
  OR NEW.captured_at IS DISTINCT FROM OLD.captured_at OR NEW.capture_attempts IS DISTINCT FROM OLD.capture_attempts
  OR NEW.stripe_charge_id IS DISTINCT FROM OLD.stripe_charge_id OR NEW.authorization_expires_at IS DISTINCT FROM OLD.authorization_expires_at
  OR NEW.stripe_transfer_id IS DISTINCT FROM OLD.stripe_transfer_id OR NEW.refunded_amount IS DISTINCT FROM OLD.refunded_amount) THEN
 RAISE EXCEPTION 'Authorization expiry cancellation must be reconciled first' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_gig_expiry_payment BEFORE UPDATE ON public."Payment" FOR EACH ROW EXECUTE FUNCTION public.guard_gig_expiry_payment();
CREATE FUNCTION public.guard_gig_expiry_gig() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
BEGIN
 IF NEW.payment_id IS DISTINCT FROM OLD.payment_id OR NEW.status IS DISTINCT FROM OLD.status
 OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.accepted_by IS DISTINCT FROM OLD.accepted_by OR NEW.price IS DISTINCT FROM OLD.price
 OR NEW.started_at IS DISTINCT FROM OLD.started_at OR NEW.worker_completed_at IS DISTINCT FROM OLD.worker_completed_at OR NEW.owner_confirmed_at IS DISTINCT FROM OLD.owner_confirmed_at THEN
  PERFORM 1 FROM public."Payment" WHERE id=OLD.payment_id FOR SHARE;
  IF current_setting('app.gig_expiry_receipt',true) IS DISTINCT FROM 'on' AND EXISTS(SELECT FROM public."GigAuthorizationExpiry" WHERE payment_id=OLD.payment_id AND kind='cancel' AND state='pending') THEN
   RAISE EXCEPTION 'Authorization expiry cancellation must be reconciled first' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_gig_expiry_gig BEFORE UPDATE ON public."Gig" FOR EACH ROW EXECUTE FUNCTION public.guard_gig_expiry_gig();
CREATE FUNCTION public.guard_gig_expiry_legacy() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
BEGIN
 PERFORM 1 FROM public."Payment" WHERE id=NEW.payment_id FOR SHARE;
 IF EXISTS(SELECT FROM public."GigAuthorizationExpiry" WHERE payment_id=NEW.payment_id AND kind='cancel' AND state='pending') THEN
 RAISE EXCEPTION 'Authorization expiry cancellation must be reconciled first' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_gig_expiry_legacy BEFORE INSERT OR UPDATE ON public."GigLegacyAuthorization" FOR EACH ROW EXECUTE FUNCTION public.guard_gig_expiry_legacy();

CREATE FUNCTION public.claim_gig_expiry_delivery() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE e public."GigAuthorizationExpiryDelivery";
BEGIN
 SELECT * INTO e FROM public."GigAuthorizationExpiryDelivery" WHERE (state='pending' AND retry_at<=clock_timestamp())
 OR (state='processing' AND lease_until<=clock_timestamp()) ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED;
 IF NOT FOUND THEN RETURN NULL; END IF;
 UPDATE public."GigAuthorizationExpiryDelivery" SET state='processing',lease_id=gen_random_uuid(),lease_until=clock_timestamp()+interval '5 minutes',attempts=attempts+1 WHERE id=e.id RETURNING * INTO e;
 RETURN to_jsonb(e);
END $$;
CREATE FUNCTION public.read_gig_expiry_delivery(p_id uuid,p_lease_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE d public."GigAuthorizationExpiryDelivery";e public."GigAuthorizationExpiry";p public."Payment";g public."Gig";n public."Notification";
BEGIN
 SELECT * INTO d FROM public."GigAuthorizationExpiryDelivery" WHERE id=p_id AND lease_id=p_lease_id AND state='processing' AND lease_until>clock_timestamp() FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','LEASE_CHANGED'); END IF;
 SELECT * INTO e FROM public."GigAuthorizationExpiry" WHERE id=d.expiry_id;
 SELECT * INTO p FROM public."Payment" WHERE id=e.payment_id;
 SELECT * INTO g FROM public."Gig" WHERE id=e.gig_id;
 SELECT * INTO n FROM public."Notification" WHERE id=d.notification_id;
 IF e.state IS DISTINCT FROM 'complete' OR p.id IS NULL OR g.id IS NULL OR n.id IS NULL
 OR e.snapshot IS DISTINCT FROM public.gig_expiry_payment_snapshot(p) OR NOT public.gig_expiry_proof_valid(p,e.provider_receipt)
 OR g.payment_id IS DISTINCT FROM p.id OR g.user_id IS DISTINCT FROM p.payer_id OR g.accepted_by IS DISTINCT FROM p.payee_id
 OR round(g.price*100)::bigint IS DISTINCT FROM p.amount_total OR NOT coalesce(public.gig_expiry_payment_safe(p),false)
 OR p.stripe_charge_id IS DISTINCT FROM e.charge_id OR p.authorization_expires_at IS DISTINCT FROM to_timestamp(e.capture_before)
 OR d.user_id NOT IN (p.payer_id,p.payee_id) OR n.user_id IS DISTINCT FROM d.user_id
 OR public.gig_expiry_note_snapshot(n) IS DISTINCT FROM d.notification_snapshot
 OR (e.kind='cancel' AND (g.status IS DISTINCT FROM 'cancelled' OR g.started_at IS NOT NULL OR g.cancellation_reason IS DISTINCT FROM 'authorization_expired'
   OR p.payment_status IS DISTINCT FROM 'canceled' OR e.provider_receipt->>'status' IS DISTINCT FROM 'canceled'))
 OR (e.kind='attention' AND g.status IS DISTINCT FROM 'in_progress') THEN
 RETURN jsonb_build_object('eligible',false); END IF;
 RETURN jsonb_build_object('eligible',true,'notification',to_jsonb(n));
END $$;
CREATE FUNCTION public.finish_gig_expiry_delivery(p_id uuid,p_lease_id uuid,p_outcome text,p_error text DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF p_outcome IS NULL OR p_outcome NOT IN ('done','suppressed','retry') THEN RETURN false; END IF;
 UPDATE public."GigAuthorizationExpiryDelivery" SET state=CASE WHEN p_outcome='retry' THEN 'pending' ELSE p_outcome END,
 retry_at=clock_timestamp()+make_interval(secs=>least(3600,30*least(greatest(attempts,1),120))),lease_id=NULL,lease_until=NULL,last_error=left(p_error,100),
 completed_at=CASE WHEN p_outcome='retry' THEN NULL ELSE clock_timestamp() END
 WHERE id=p_id AND lease_id=p_lease_id AND state='processing' AND lease_until>clock_timestamp();
 RETURN FOUND;
END $$;
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('gig_expiry_payment_snapshot','gig_expiry_payment_safe','gig_expiry_proof_valid','claim_gig_expiry_scan','read_gig_authorization_expiry',
 'gig_expiry_note_snapshot','materialize_gig_expiry_notices','begin_gig_authorization_expiry','claim_gig_authorization_expiry','record_gig_authorization_expiry','release_gig_expiry_lease',
 'guard_gig_expiry_payment','guard_gig_expiry_gig','guard_gig_expiry_legacy','claim_gig_expiry_delivery','read_gig_expiry_delivery','finish_gig_expiry_delivery') LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
END $$;
