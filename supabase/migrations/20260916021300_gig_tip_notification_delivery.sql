-- Backwards compatible: yes. Extend existing Payment/Notification metadata and
-- the existing scheduled payment relay. No table, column or historical backfill.
SET LOCAL lock_timeout='5s';

CREATE FUNCTION public.gig_tip_delivery_payment(p public."Payment") RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('id',p.id,'payer_id',p.payer_id,'payee_id',p.payee_id,'gig_id',p.gig_id,
  'payment_type',p.payment_type,'amount',p.amount_total,'currency',p.currency,
  'intent',p.stripe_payment_intent_id,'charge',p.stripe_charge_id,
  'captured_at',extract(epoch FROM p.captured_at),'payment_succeeded_at',extract(epoch FROM p.payment_succeeded_at))
$$;

CREATE FUNCTION public.capture_gig_tip_notification() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE prior jsonb; delivery jsonb; n public."Notification"; title_text text; allowed boolean; reused boolean;
BEGIN
 IF TG_OP='UPDATE' THEN prior:=OLD.metadata->'gig_tip_delivery_v1'; END IF;
 delivery:=NEW.metadata->'gig_tip_delivery_v1';
 IF delivery IS DISTINCT FROM prior AND NOT (current_user IN ('postgres','service_role','supabase_admin')
  AND coalesce(current_setting('app.gig_tip_delivery',true),'')='on') THEN
  RAISE EXCEPTION 'Use the tip delivery transaction' USING ERRCODE='42501'; END IF;
 -- Capture is already bound to fresh provider proof by the existing service/
 -- original transaction. Historical adoption/replay must not replay old alerts.
 IF NEW.payment_type IS DISTINCT FROM 'tip' OR NEW.payment_status IS DISTINCT FROM 'captured_hold'
  OR NEW.captured_at IS NULL OR NEW.payment_succeeded_at IS NULL OR NEW.gig_id IS NULL
  OR NEW.payee_id IS NULL OR NEW.amount_total IS NULL OR NEW.amount_total<50
  OR lower(NEW.currency) IS DISTINCT FROM 'usd' OR NEW.stripe_charge_id IS NULL
  OR NEW.stripe_payment_intent_id IS NULL OR delivery IS NOT NULL
  OR NEW.metadata->>'tip_notification_sent_at' IS NOT NULL THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND (OLD.captured_at IS NOT NULL OR OLD.payment_succeeded_at IS NOT NULL) THEN RETURN NEW; END IF;
 IF current_user NOT IN ('postgres','service_role','supabase_admin') THEN
  RAISE EXCEPTION 'Tip capture notification requires service authority' USING ERRCODE='42501'; END IF;
 SELECT * INTO n FROM public."Notification" WHERE user_id=NEW.payee_id AND type='tip_received'
  AND (idempotency_key='gig-tip-received:'||NEW.id OR metadata->>'payment_id'=NEW.id::text)
  ORDER BY created_at,id LIMIT 1;
 reused:=FOUND;
 IF NOT reused THEN
  SELECT title INTO title_text FROM public."Gig" WHERE id=NEW.gig_id;
  INSERT INTO public."Notification"(user_id,type,title,body,icon,link,metadata,idempotency_key)
   VALUES(NEW.payee_id,'tip_received','You received a tip!',
    'The poster of "'||coalesce(nullif(title_text,''),'a gig')||'" sent you a $'||to_char(NEW.amount_total/100.0,'FM9999999990.00')||' tip. 🎉',
    '💰','/gigs/'||NEW.gig_id,jsonb_build_object('gig_id',NEW.gig_id,'amount',NEW.amount_total,'payment_id',NEW.id),
    'gig-tip-received:'||NEW.id) RETURNING * INTO n;
 END IF;
 allowed:=EXISTS(SELECT FROM public."MailPreferences" WHERE user_id=NEW.payee_id AND push_notifications=true)
  AND NOT EXISTS(SELECT FROM public."UserNotificationPreferences" WHERE user_id=NEW.payee_id AND gig_updates_enabled=false);
 NEW.metadata:=coalesce(NEW.metadata,'{}'::jsonb)||jsonb_build_object('gig_tip_delivery_v1',jsonb_build_object(
  'version',1,'notification_id',n.id,'payment',public.gig_tip_delivery_payment(NEW),
  'notification',public.gig_expiry_note_snapshot(n),'push_allowed_at_capture',allowed,
  'state',CASE WHEN reused THEN 'suppressed' ELSE 'pending' END,'attempts',0,'retry_at',clock_timestamp(),
  'completed_at',CASE WHEN reused THEN to_jsonb(clock_timestamp()) ELSE 'null'::jsonb END));
 RETURN NEW;
END $$;
CREATE TRIGGER zz_capture_gig_tip_notification BEFORE INSERT OR UPDATE ON public."Payment"
 FOR EACH ROW EXECUTE FUNCTION public.capture_gig_tip_notification();
CREATE INDEX payment_gig_tip_delivery_pending ON public."Payment"(created_at,id)
 WHERE metadata->'gig_tip_delivery_v1'->>'state' IN ('pending','processing');

CREATE FUNCTION public.claim_gig_tip_delivery() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE p public."Payment"; d jsonb;
BEGIN
 SELECT * INTO p FROM public."Payment" WHERE
  (metadata->'gig_tip_delivery_v1'->>'state'='pending' AND (metadata->'gig_tip_delivery_v1'->>'retry_at')::timestamptz<=clock_timestamp())
  OR (metadata->'gig_tip_delivery_v1'->>'state'='processing' AND (metadata->'gig_tip_delivery_v1'->>'lease_until')::timestamptz<=clock_timestamp())
 ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED;
 IF NOT FOUND THEN RETURN NULL; END IF;
 d:=(p.metadata->'gig_tip_delivery_v1')||jsonb_build_object('state','processing','lease_id',gen_random_uuid(),
  'lease_until',clock_timestamp()+interval '5 minutes','attempts',(p.metadata->'gig_tip_delivery_v1'->>'attempts')::integer+1);
 PERFORM set_config('app.gig_tip_delivery','on',true);
 UPDATE public."Payment" SET metadata=jsonb_set(metadata,'{gig_tip_delivery_v1}',d) WHERE id=p.id;
 PERFORM set_config('app.gig_tip_delivery','off',true);
 RETURN jsonb_build_object('id',p.id,'lease_id',d->>'lease_id');
END $$;

CREATE FUNCTION public.read_gig_tip_delivery(p_id uuid,p_lease_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE p public."Payment"; d jsonb; n public."Notification"; eligible boolean;
BEGIN
 SELECT * INTO p FROM public."Payment" WHERE id=p_id FOR UPDATE;
 d:=p.metadata->'gig_tip_delivery_v1';
 IF d IS NULL OR p_lease_id IS NULL OR d->>'lease_id' IS DISTINCT FROM p_lease_id::text
  OR d->>'state' IS DISTINCT FROM 'processing' OR coalesce((d->>'lease_until')::timestamptz,'-infinity')<=clock_timestamp()
  THEN RETURN jsonb_build_object('error','LEASE_LOST'); END IF;
 SELECT * INTO n FROM public."Notification" WHERE id=(d->>'notification_id')::uuid AND user_id=p.payee_id;
 eligible:=public.gig_tip_delivery_payment(p)=d->'payment' AND p.payment_type='tip'
  AND p.payment_status IN ('captured_hold','transfer_scheduled','transfer_pending','transferred')
  AND coalesce(p.refunded_amount,0)=0 AND p.dispute_id IS NULL AND n.id IS NOT NULL
  AND n.type='tip_received' AND n.link='/gigs/'||p.gig_id
  AND n.context='personal' AND n.context_type='personal' AND n.context_id IS NULL
  AND public.gig_expiry_note_snapshot(n)=d->'notification';
 RETURN jsonb_build_object('eligible',coalesce(eligible,false),
  'notification',CASE WHEN eligible THEN to_jsonb(n) ELSE NULL END,'pushAllowedAtCapture',d->'push_allowed_at_capture');
END $$;

CREATE FUNCTION public.finish_gig_tip_delivery(p_id uuid,p_lease_id uuid,p_outcome text,p_error text DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE p public."Payment"; d jsonb;
BEGIN
 IF p_outcome IS NULL OR p_outcome NOT IN ('done','suppressed','retry') THEN RETURN false; END IF;
 SELECT * INTO p FROM public."Payment" WHERE id=p_id FOR UPDATE;
 d:=p.metadata->'gig_tip_delivery_v1';
 IF d IS NULL OR p_lease_id IS NULL OR d->>'lease_id' IS DISTINCT FROM p_lease_id::text
  OR d->>'state' IS DISTINCT FROM 'processing' OR coalesce((d->>'lease_until')::timestamptz,'-infinity')<=clock_timestamp() THEN RETURN false; END IF;
 d:=(d-'lease_id'-'lease_until')||jsonb_build_object('state',CASE WHEN p_outcome='retry' THEN 'pending' ELSE p_outcome END,
  'retry_at',clock_timestamp()+make_interval(secs=>least(3600,30*least(greatest((d->>'attempts')::integer,1),120))),
  'last_error',left(p_error,100),'completed_at',CASE WHEN p_outcome='retry' THEN 'null'::jsonb ELSE to_jsonb(clock_timestamp()) END);
 PERFORM set_config('app.gig_tip_delivery','on',true);
 UPDATE public."Payment" SET metadata=jsonb_set(metadata,'{gig_tip_delivery_v1}',d) WHERE id=p.id;
 PERFORM set_config('app.gig_tip_delivery','off',true);
 RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.gig_tip_delivery_payment(public."Payment"),public.capture_gig_tip_notification(),
 public.claim_gig_tip_delivery(),public.read_gig_tip_delivery(uuid,uuid),public.finish_gig_tip_delivery(uuid,uuid,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gig_tip_delivery_payment(public."Payment"),public.capture_gig_tip_notification(),
 public.claim_gig_tip_delivery(),public.read_gig_tip_delivery(uuid,uuid),public.finish_gig_tip_delivery(uuid,uuid,text,text) TO service_role;
