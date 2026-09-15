-- Backwards compatible: yes for existing data and coordinated API readers.
-- Extend existing Payment/capture/confirmation records; no replacement table.
-- Approval details cannot use metadata: its existing public read contract must stay.
-- Activate original-aware backend serializers together before admitting originals.
SET LOCAL lock_timeout='5s';

ALTER TABLE public."Payment" ADD COLUMN gig_completion_original jsonb;
ALTER TABLE public."Payment" ADD CONSTRAINT payment_gig_completion_original_shape
 CHECK(gig_completion_original IS NULL OR
  coalesce((payment_type='gig_payment' AND jsonb_typeof(gig_completion_original)='object'
   AND gig_completion_original ?& ARRAY['version','state','actor_id','review','snapshot','created_at','note','satisfaction']
   AND gig_completion_original->>'version'='1'
   AND gig_completion_original->>'state' IN ('pending','confirmed','canceled')),false));

-- Preserve reads of every existing field, without making private approval data
-- available through authenticated PostgREST. Existing API readers use service_role.
REVOKE SELECT ON public."Payment" FROM authenticated;
DO $$ DECLARE columns text; BEGIN
 SELECT string_agg(quote_ident(attname),',' ORDER BY attnum) INTO columns
 FROM pg_attribute WHERE attrelid='public."Payment"'::regclass AND attnum>0
  AND NOT attisdropped AND attname<>'gig_completion_original';
 EXECUTE 'GRANT SELECT ('||columns||') ON public."Payment" TO authenticated';
END $$;
CREATE INDEX idx_payment_completion_original_pending ON public."Payment"(created_at,id)
 WHERE gig_completion_original->>'state'='pending';

-- One normalized snapshot for the existing reviewed fields. Dates retain full
-- PostgreSQL precision; its hash is internal and is not an authorization token.
CREATE FUNCTION public.gig_completion_snapshot(p_gig jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp SET timezone='UTC' AS $$
 SELECT jsonb_build_array(p_gig->>'id',p_gig->>'user_id',p_gig->>'accepted_by',
  p_gig->>'payment_id',(p_gig->>'price')::numeric,p_gig->>'origin_home_id',
  p_gig->>'title',p_gig->>'description',p_gig->>'status',
  (p_gig->>'accepted_at')::timestamptz,(p_gig->>'started_at')::timestamptz,
  (p_gig->>'worker_completed_at')::timestamptz,p_gig->>'completion_note',
  coalesce(nullif(p_gig->'completion_photos','null'::jsonb),'[]'::jsonb),
  coalesce(nullif(p_gig->'completion_checklist','null'::jsonb),'[]'::jsonb));
$$;
CREATE FUNCTION public.gig_completion_snapshot_hash(p_gig jsonb) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=public,extensions,pg_temp AS $$
 SELECT encode(digest(public.gig_completion_snapshot(p_gig)::text,'sha256'),'hex');
$$;

CREATE FUNCTION public.prepare_gig_completion_original(
 p_gig_id uuid,p_actor_id uuid,p_expected jsonb,p_review text,p_satisfaction integer,p_note text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE g public."Gig"%ROWTYPE; p public."Payment"%ROWTYPE; original jsonb;
 observed_home_id uuid;
BEGIN
 SELECT origin_home_id INTO observed_home_id FROM public."Gig" WHERE id=p_gig_id;
 IF observed_home_id IS NOT NULL THEN PERFORM public.lock_home_record_scope(observed_home_id); END IF;
 SELECT * INTO g FROM public."Gig" WHERE id=p_gig_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 IF NOT coalesce(public.paid_gig_actor_allowed(g.user_id,p_actor_id),false) THEN
  RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
 IF g.origin_home_id IS DISTINCT FROM observed_home_id OR g.status IS DISTINCT FROM 'completed'
  OR g.worker_completed_at IS NULL OR p_expected IS NULL OR NOT (p_expected ?& ARRAY[
   'id','user_id','accepted_by','payment_id','price','origin_home_id','title','description',
   'status','accepted_at','started_at','worker_completed_at','completion_note','completion_photos','completion_checklist'])
  OR public.gig_completion_snapshot(to_jsonb(g)) IS DISTINCT FROM public.gig_completion_snapshot(p_expected)
  OR p_review IS NULL OR p_review !~ '^[a-f0-9]{64}$' THEN
  RETURN jsonb_build_object('error','COMPLETION_CHANGED'); END IF;
 SELECT * INTO p FROM public."Payment" WHERE id=g.payment_id FOR UPDATE;
 IF NOT FOUND OR p.gig_id IS DISTINCT FROM g.id OR p.payer_id IS DISTINCT FROM g.user_id
  OR p.payee_id IS DISTINCT FROM g.accepted_by OR p.payment_type IS DISTINCT FROM 'gig_payment'
  OR p.amount_total IS DISTINCT FROM round(g.price*100)::bigint OR lower(p.currency) IS DISTINCT FROM 'usd'
  OR p.amount_total<50 OR p.stripe_customer_id IS NULL OR p.stripe_payment_intent_id IS NULL
  OR p.payment_status IS NULL OR p.payment_status NOT IN ('authorized','capture_pending','captured_hold')
  OR coalesce(p.refunded_amount,0)<>0 OR p.dispute_id IS NOT NULL THEN
  RETURN jsonb_build_object('error','PAYMENT_CHANGED'); END IF;
 original:=p.gig_completion_original;
 IF original IS NOT NULL THEN
  IF original->>'snapshot' IS DISTINCT FROM public.gig_completion_snapshot_hash(to_jsonb(g))
   OR original->>'review' IS DISTINCT FROM p_review OR original->>'state'='canceled' THEN
   RETURN jsonb_build_object('error','COMPLETION_CHANGED'); END IF;
  RETURN jsonb_build_object('payment',to_jsonb(p),'reused',true);
 END IF;
 IF g.owner_confirmed_at IS NOT NULL THEN RETURN jsonb_build_object('error','ALREADY_CONFIRMED'); END IF;
 original:=jsonb_build_object('version',1,'state','pending','actor_id',p_actor_id,
  'review',p_review,'snapshot',public.gig_completion_snapshot_hash(to_jsonb(g)),
  'satisfaction',CASE WHEN p_satisfaction IS NULL THEN NULL ELSE least(5,greatest(1,p_satisfaction)) END,
  'note',left(p_note,1000),'created_at',clock_timestamp());
 PERFORM set_config('app.gig_completion_original','on',true);
 UPDATE public."Payment" SET gig_completion_original=original,updated_at=clock_timestamp()
 WHERE id=p.id RETURNING * INTO p;
 PERFORM set_config('app.gig_completion_original','off',true);
 RETURN jsonb_build_object('payment',to_jsonb(p),'reused',false);
END $$;

CREATE FUNCTION public.guard_gig_completion_original() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE original jsonb;
BEGIN
 IF OLD.payment_id IS NULL THEN IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END IF;
 SELECT gig_completion_original INTO original FROM public."Payment" WHERE id=OLD.payment_id FOR SHARE;
 IF original IS NULL OR original->>'state'<>'pending' THEN
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END IF;
 IF TG_OP='DELETE' THEN
  IF original->>'state'='pending' THEN RAISE EXCEPTION 'Finish the existing completion approval first' USING ERRCODE='23514'; END IF;
  RETURN OLD;
 END IF;
 IF NEW.owner_confirmed_at IS DISTINCT FROM OLD.owner_confirmed_at
  AND coalesce(current_setting('app.gig_completion_original',true),'')<>'on' THEN
  RAISE EXCEPTION 'Use the original completion transaction' USING ERRCODE='23514'; END IF;
 IF public.gig_completion_snapshot_hash(to_jsonb(NEW)) IS DISTINCT FROM original->>'snapshot' THEN
  RAISE EXCEPTION 'Approved completion terms cannot change' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_gig_completion_original BEFORE UPDATE OR DELETE ON public."Gig"
 FOR EACH ROW EXECUTE FUNCTION public.guard_gig_completion_original();

CREATE FUNCTION public.guard_payment_completion_original() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE previous jsonb:=OLD.gig_completion_original; current_original jsonb;
BEGIN
 IF previous IS NULL THEN
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF NEW.gig_completion_original IS NOT NULL AND coalesce(current_setting('app.gig_completion_original',true),'')<>'on' THEN
   RAISE EXCEPTION 'Use the original completion transaction' USING ERRCODE='23514'; END IF;
  RETURN NEW; END IF;
 IF TG_OP='DELETE' THEN
  IF previous->>'state'='pending' THEN RAISE EXCEPTION 'Finish the existing completion approval first' USING ERRCODE='23514'; END IF;
  RETURN OLD;
 END IF;
 current_original:=NEW.gig_completion_original;
 IF current_original IS DISTINCT FROM previous
  AND coalesce(current_setting('app.gig_completion_original',true),'')<>'on' THEN
  RAISE EXCEPTION 'Use the original completion transaction' USING ERRCODE='23514'; END IF;
 IF current_original IS NULL OR (current_original-ARRAY['state','lease_until','finished_at'])
  IS DISTINCT FROM (previous-ARRAY['state','lease_until','finished_at']) THEN
  RAISE EXCEPTION 'The original completion approval is immutable' USING ERRCODE='23514'; END IF;
 IF previous->>'state'<>'pending' AND current_original IS DISTINCT FROM previous THEN
  RAISE EXCEPTION 'The completed approval is immutable' USING ERRCODE='23514'; END IF;
 IF previous->>'state'='pending' AND ROW(NEW.gig_id,NEW.payer_id,NEW.payee_id,NEW.payment_type,
  NEW.amount_total,NEW.currency,NEW.stripe_customer_id,NEW.stripe_payment_intent_id)
  IS DISTINCT FROM ROW(OLD.gig_id,OLD.payer_id,OLD.payee_id,OLD.payment_type,OLD.amount_total,
   OLD.currency,OLD.stripe_customer_id,OLD.stripe_payment_intent_id) THEN
  RAISE EXCEPTION 'The approved payment terms cannot change' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_payment_completion_original BEFORE UPDATE OR DELETE ON public."Payment"
 FOR EACH ROW EXECUTE FUNCTION public.guard_payment_completion_original();



CREATE OR REPLACE FUNCTION public.confirm_gig_completion(
 p_gig_id uuid,p_actor_id uuid,p_expected jsonb,p_satisfaction integer,p_note text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE g public."Gig"%ROWTYPE; p public."Payment"%ROWTYPE;
 n public."Notification"%ROWTYPE; recipient uuid; notices jsonb:='[]'::jsonb;
 event_id uuid:=gen_random_uuid(); confirmed_at timestamptz;
 observed_home_id uuid; home_context jsonb;
BEGIN
 -- Match existing Home -> authority -> Gig lock order. A replaced origin is
 -- retried instead of attaching history under an unlocked Home scope.
 SELECT origin_home_id INTO observed_home_id FROM public."Gig" WHERE id=p_gig_id;
 IF observed_home_id IS NOT NULL THEN PERFORM public.lock_home_record_scope(observed_home_id); END IF;
 SELECT * INTO g FROM public."Gig" WHERE id=p_gig_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 IF g.payment_id IS NOT NULL THEN
  SELECT * INTO p FROM public."Payment" WHERE id=g.payment_id FOR UPDATE;
 END IF;
 -- Current authority admits new consent. Recovery only executes the already
 -- admitted actor's immutable original; revocation cannot un-capture a charge.
 IF p.gig_completion_original IS NULL THEN
  IF NOT coalesce(public.paid_gig_actor_allowed(g.user_id,p_actor_id),false) THEN
   RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
 ELSIF p.gig_completion_original->>'actor_id' IS DISTINCT FROM p_actor_id::text
  OR p.gig_completion_original->>'state'='canceled' THEN
  RETURN jsonb_build_object('error','FORBIDDEN');
 END IF;
 IF g.origin_home_id IS DISTINCT FROM observed_home_id OR p_expected IS NULL OR NOT (p_expected ?& ARRAY[
   'id','user_id','accepted_by','payment_id','price','origin_home_id','title','description',
   'status','accepted_at','started_at','worker_completed_at','completion_note','completion_photos','completion_checklist'])
  OR g.status IS DISTINCT FROM 'completed' OR g.worker_completed_at IS NULL
  OR public.gig_completion_snapshot(to_jsonb(g)) IS DISTINCT FROM public.gig_completion_snapshot(p_expected)
  OR (p.gig_completion_original->>'state'='pending' AND
   p.gig_completion_original->>'snapshot' IS DISTINCT FROM public.gig_completion_snapshot_hash(to_jsonb(g))) THEN
  RETURN jsonb_build_object('error','COMPLETION_CHANGED'); END IF;
 -- A concurrent/retried receipt never increments again or recreates read/deleted notices.
 IF g.owner_confirmed_at IS NOT NULL THEN
  RETURN jsonb_build_object('gig',to_jsonb(g),'notifications','[]'::jsonb,'reused',true); END IF;
 IF g.price IS NULL OR g.price<0 OR (g.price>0 AND g.payment_id IS NULL) THEN
  RETURN jsonb_build_object('error','PAYMENT_NOT_CAPTURED'); END IF;
 IF g.payment_id IS NOT NULL THEN
  IF p.id IS NULL OR p.gig_id IS DISTINCT FROM g.id OR p.payer_id IS DISTINCT FROM g.user_id
   OR p.payee_id IS DISTINCT FROM g.accepted_by OR p.payment_type IS DISTINCT FROM 'gig_payment'
   OR p.amount_total IS DISTINCT FROM round(g.price*100)::bigint OR lower(p.currency) IS DISTINCT FROM 'usd'
   OR p.payment_status IS DISTINCT FROM 'captured_hold' OR p.captured_at IS NULL
   OR p.stripe_payment_intent_id IS NULL OR p.stripe_charge_id IS NULL
   OR coalesce(p.refunded_amount,0)<>0 OR p.dispute_id IS NOT NULL THEN
   RETURN jsonb_build_object('error','PAYMENT_NOT_CAPTURED'); END IF;
  IF p.gig_completion_original IS NULL THEN RETURN jsonb_build_object('error','COMPLETION_NOT_PREPARED'); END IF;
  p_note:=p.gig_completion_original->>'note';
  p_satisfaction:=(p.gig_completion_original->>'satisfaction')::integer;
 END IF;
 confirmed_at:=clock_timestamp();
 PERFORM set_config('app.gig_completion_original','on',true);

 UPDATE public."Gig" SET owner_confirmed_at=confirmed_at,updated_at=confirmed_at,
  owner_confirmation_note=left(p_note,1000),
  owner_satisfaction=CASE WHEN p_satisfaction IS NULL THEN NULL ELSE least(5,greatest(1,p_satisfaction)) END
  WHERE id=g.id RETURNING * INTO g;
 IF p.gig_completion_original IS NOT NULL THEN
  UPDATE public."Payment" SET gig_completion_original=(gig_completion_original-'lease_until')||
   jsonb_build_object('state','confirmed','finished_at',confirmed_at),updated_at=confirmed_at WHERE id=p.id;
 END IF;
 PERFORM set_config('app.gig_completion_original','off',true);
 IF g.accepted_by IS NOT NULL THEN
  UPDATE public."User" SET gigs_completed=coalesce(gigs_completed,0)+1 WHERE id=g.accepted_by;
  IF NOT FOUND THEN RAISE EXCEPTION 'Completion worker unavailable'; END IF;
  INSERT INTO public."Notification"(user_id,type,title,body,icon,link,metadata,context_type,context,idempotency_key)
  VALUES(g.accepted_by,'gig_confirmed','Gig "'||coalesce(nullif(g.title,''),'completed gig')||'" confirmed!',
   'The gig owner confirmed your work is complete. Great job!','🎉','/gigs/'||g.id,
   jsonb_build_object('gig_id',g.id),'personal','personal','gig-confirmation:'||event_id||':'||g.accepted_by)
  RETURNING * INTO n;
  notices:=notices||jsonb_build_array(to_jsonb(n));
 END IF;
 -- A client-supplied Home UUID is not Home authority. Only current adult
 -- maintenance editors can attach new confirmed work to the shared ledger.
 -- HomeTaskGigReceipt publications intentionally keep origin_home_id NULL.
 IF observed_home_id IS NOT NULL THEN
  home_context:=public.home_record_context(observed_home_id,p_actor_id);
  IF home_context->>'allowed'='true' AND home_context->>'private'='false'
   AND home_context->'permissions' ? 'maintenance.edit'
   AND NOT EXISTS(SELECT FROM public."HomeOccupancy" WHERE home_id=observed_home_id
    AND user_id=p_actor_id AND age_band IN ('child','teen')) THEN
   PERFORM set_config('app.completed_gig_history','on',true);
   INSERT INTO public."HomeMaintenanceLog"(home_id,task,performed_at,performed_by,cost,gig_id,
    status,recurrence,created_by,created_at,updated_at)
   VALUES(observed_home_id,left(coalesce(nullif(g.title,''),nullif(g.category,''),'Completed job'),200),
    confirmed_at,g.accepted_by,g.price,g.id,'completed','one_time',p_actor_id,confirmed_at,confirmed_at)
   ON CONFLICT(gig_id) WHERE gig_id IS NOT NULL DO NOTHING;
   PERFORM set_config('app.completed_gig_history','off',true);
  END IF;
 END IF;
 -- UPDATE RETURNING chooses only the bids this transaction actually closes.
 FOR recipient IN WITH closed AS (
  UPDATE public."GigBid" SET status='rejected',updated_at=confirmed_at
  WHERE gig_id=g.id AND status IN ('pending','countered') RETURNING user_id
 ) SELECT DISTINCT user_id FROM closed ORDER BY user_id LOOP
  INSERT INTO public."Notification"(user_id,type,title,body,icon,link,metadata,context_type,context,idempotency_key)
  VALUES(recipient,'bid_rejected','"'||coalesce(nullif(g.title,''),'a gig')||'" has been completed',
   'The gig "'||coalesce(nullif(g.title,''),'a gig')||'" has been completed by another worker. Your bid is now closed.',
   '✅','/gigs/'||g.id,jsonb_build_object('gig_id',g.id,'reason','gig_completed'),
   'personal','personal','gig-completion-bid:'||event_id||':'||recipient) RETURNING * INTO n;
  notices:=notices||jsonb_build_array(to_jsonb(n));
 END LOOP;
 RETURN jsonb_build_object('gig',to_jsonb(g),'notifications',notices,'reused',false);
END $$;
REVOKE ALL ON FUNCTION public.confirm_gig_completion(uuid,uuid,jsonb,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_gig_completion(uuid,uuid,jsonb,integer,text) TO service_role;

CREATE OR REPLACE FUNCTION public.prepare_paid_gig_capture(p_payment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE p public."Payment"%ROWTYPE; g public."Gig"%ROWTYPE; original jsonb; observed_home_id uuid;
BEGIN
 SELECT * INTO p FROM public."Payment" WHERE id=p_payment_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 SELECT origin_home_id INTO observed_home_id FROM public."Gig" WHERE id=p.gig_id;
 IF observed_home_id IS NOT NULL THEN PERFORM public.lock_home_record_scope(observed_home_id); END IF;
 SELECT * INTO g FROM public."Gig" WHERE id=p.gig_id FOR UPDATE;
 SELECT * INTO p FROM public."Payment" WHERE id=p_payment_id FOR UPDATE;
 IF g.origin_home_id IS DISTINCT FROM observed_home_id OR g.id IS NULL OR g.payment_id IS DISTINCT FROM p.id OR g.user_id IS DISTINCT FROM p.payer_id OR g.accepted_by IS DISTINCT FROM p.payee_id
  OR round(g.price*100)::integer IS DISTINCT FROM p.amount_total OR p.payment_type IS DISTINCT FROM 'gig_payment'
  OR g.status IS DISTINCT FROM 'completed' OR g.worker_completed_at IS NULL OR coalesce(p.refunded_amount,0)<>0
  OR p.dispute_id IS NOT NULL THEN
  RETURN jsonb_build_object('error','TERMS_CHANGED'); END IF;
 original:=p.gig_completion_original;
 IF g.owner_confirmed_at IS NULL AND (original IS NULL OR original->>'state'<>'pending'
  OR original->>'snapshot' IS DISTINCT FROM public.gig_completion_snapshot_hash(to_jsonb(g))) THEN
  RETURN jsonb_build_object('error','COMPLETION_NOT_PREPARED'); END IF;
 IF p.payment_status='captured_hold' THEN RETURN jsonb_build_object('payment',to_jsonb(p),'reused',true); END IF;
 IF original->>'state'='pending' AND (original->>'lease_until')::timestamptz>clock_timestamp() THEN
  RETURN jsonb_build_object('error','CAPTURE_IN_PROGRESS'); END IF;
 IF p.payment_status IS NULL OR p.payment_status NOT IN ('authorized','capture_pending') OR p.capture_attempts>=5 THEN
  RETURN jsonb_build_object('error','CAPTURE_NOT_READY'); END IF;
 PERFORM set_config('app.gig_completion_original','on',true);
 UPDATE public."Payment" SET payment_status='capture_pending',capture_attempts=coalesce(capture_attempts,0)+1,
  gig_completion_original=CASE WHEN original->>'state'='pending' THEN original||
   jsonb_build_object('lease_until',clock_timestamp()+interval '2 minutes') ELSE original END,updated_at=now()
 WHERE id=p.id RETURNING * INTO p;
 PERFORM set_config('app.gig_completion_original','off',true);
 UPDATE public."Gig" SET payment_status='capture_pending',updated_at=now() WHERE id=g.id;
 RETURN jsonb_build_object('payment',to_jsonb(p),'reused',false);
END $$;

CREATE OR REPLACE FUNCTION public.record_paid_gig_capture(p_payment_id uuid,p_intent_id text,p_charge_id text,p_amount integer,p_customer_id text,p_currency text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE p public."Payment"%ROWTYPE; g public."Gig"%ROWTYPE; original jsonb; confirmation jsonb; observed_home_id uuid; reused boolean;
BEGIN
 SELECT * INTO p FROM public."Payment" WHERE id=p_payment_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 SELECT origin_home_id INTO observed_home_id FROM public."Gig" WHERE id=p.gig_id;
 IF observed_home_id IS NOT NULL THEN PERFORM public.lock_home_record_scope(observed_home_id); END IF;
 SELECT * INTO g FROM public."Gig" WHERE id=p.gig_id FOR UPDATE;
 SELECT * INTO p FROM public."Payment" WHERE id=p_payment_id FOR UPDATE;
 IF g.origin_home_id IS DISTINCT FROM observed_home_id OR g.id IS NULL OR g.payment_id IS DISTINCT FROM p.id OR g.user_id IS DISTINCT FROM p.payer_id OR g.accepted_by IS DISTINCT FROM p.payee_id
  OR round(g.price*100)::integer IS DISTINCT FROM p.amount_total OR p.payment_type IS DISTINCT FROM 'gig_payment' OR g.status IS DISTINCT FROM 'completed'
  OR g.worker_completed_at IS NULL OR coalesce(p.refunded_amount,0)<>0 OR p.dispute_id IS NOT NULL
  OR p_intent_id IS NULL OR p_customer_id IS NULL OR p_currency IS DISTINCT FROM 'usd'
  OR p.stripe_payment_intent_id IS DISTINCT FROM p_intent_id OR p.stripe_customer_id IS DISTINCT FROM p_customer_id
  OR p.amount_total IS DISTINCT FROM p_amount OR lower(p.currency) IS DISTINCT FROM p_currency
  OR p_charge_id IS NULL OR p_charge_id !~ '^ch_[A-Za-z0-9]+$'
  OR p.payment_status IS NULL OR p.payment_status NOT IN ('authorized','capture_pending','captured_hold') THEN RETURN jsonb_build_object('error','TERMS_CHANGED'); END IF;
 original:=p.gig_completion_original;
 IF g.owner_confirmed_at IS NULL AND (original IS NULL OR original->>'state'<>'pending'
  OR original->>'snapshot' IS DISTINCT FROM public.gig_completion_snapshot_hash(to_jsonb(g))) THEN
  RETURN jsonb_build_object('error','COMPLETION_NOT_PREPARED'); END IF;
 reused:=p.payment_status='captured_hold' AND p.captured_at IS NOT NULL AND p.stripe_charge_id=p_charge_id;
 IF NOT reused THEN
  UPDATE public."Payment" SET payment_status='captured_hold',stripe_charge_id=p_charge_id,captured_at=coalesce(captured_at,now()),
   cooling_off_ends_at=coalesce(cooling_off_ends_at,now()+interval '48 hours'),payment_succeeded_at=coalesce(payment_succeeded_at,now()),
   updated_at=now() WHERE id=p.id RETURNING * INTO p;
  UPDATE public."Gig" SET payment_status=p.payment_status,updated_at=now() WHERE id=g.id;
 END IF;
 IF original IS NOT NULL THEN
  confirmation:=public.confirm_gig_completion(g.id,(original->>'actor_id')::uuid,to_jsonb(g),
   (original->>'satisfaction')::integer,original->>'note');
  IF confirmation->'gig'->>'owner_confirmed_at' IS NULL OR confirmation ? 'error' THEN
   RAISE EXCEPTION 'Capture awaits original completion confirmation' USING ERRCODE='40001'; END IF;
  SELECT * INTO p FROM public."Payment" WHERE id=p.id;
 END IF;
 RETURN jsonb_build_object('payment',to_jsonb(p),'reused',reused,'confirmation',confirmation);
END $$;


-- Only fresh matching provider evidence with no captured charge can release an
-- uncompleted original. This never issues a new provider cancellation command.
CREATE FUNCTION public.record_gig_completion_canceled(p_payment_id uuid,p_intent_id text,
 p_customer_id text,p_amount integer,p_currency text,p_charge_id text,p_received integer,p_capturable integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE p public."Payment"%ROWTYPE; g public."Gig"%ROWTYPE;
BEGIN
 SELECT * INTO p FROM public."Payment" WHERE id=p_payment_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 SELECT * INTO g FROM public."Gig" WHERE id=p.gig_id FOR UPDATE;
 SELECT * INTO p FROM public."Payment" WHERE id=p_payment_id FOR UPDATE;
 IF p.gig_completion_original->>'state' IS DISTINCT FROM 'pending' OR g.id IS NULL
  OR g.payment_id IS DISTINCT FROM p.id OR g.owner_confirmed_at IS NOT NULL
  OR p.stripe_payment_intent_id IS DISTINCT FROM p_intent_id OR p_intent_id IS NULL
  OR p.stripe_customer_id IS DISTINCT FROM p_customer_id OR p_customer_id IS NULL
  OR p.amount_total IS DISTINCT FROM p_amount OR lower(p.currency) IS DISTINCT FROM p_currency
  OR p_currency IS DISTINCT FROM 'usd' OR p_received IS DISTINCT FROM 0 OR p_capturable IS DISTINCT FROM 0
  OR p.captured_at IS NOT NULL OR p.payment_succeeded_at IS NOT NULL
  OR (p.stripe_charge_id IS NOT NULL AND p.stripe_charge_id IS DISTINCT FROM p_charge_id)
  OR coalesce(p.refunded_amount,0)<>0 OR p.dispute_id IS NOT NULL
  OR (p_charge_id IS NOT NULL AND p_charge_id !~ '^ch_[A-Za-z0-9]+$') THEN
  RETURN jsonb_build_object('error','PAYMENT_CHANGED'); END IF;
 PERFORM set_config('app.gig_completion_original','on',true);
 UPDATE public."Payment" SET gig_completion_original=(gig_completion_original-'lease_until')||
  jsonb_build_object('state','canceled','finished_at',clock_timestamp()),payment_status='canceled',updated_at=clock_timestamp()
 WHERE id=p.id RETURNING * INTO p;
 PERFORM set_config('app.gig_completion_original','off',true);
 UPDATE public."Gig" SET payment_status='canceled',updated_at=clock_timestamp() WHERE id=g.id;
 RETURN jsonb_build_object('payment',to_jsonb(p));
END $$;

DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN ('gig_completion_snapshot','gig_completion_snapshot_hash',
   'prepare_gig_completion_original','guard_gig_completion_original','guard_payment_completion_original',
   'prepare_paid_gig_capture','record_paid_gig_capture','record_gig_completion_canceled') LOOP
  EXECUTE 'REVOKE ALL ON FUNCTION '||f.signature||' FROM PUBLIC,anon,authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION '||f.signature||' TO service_role';
 END LOOP;
END $$;
