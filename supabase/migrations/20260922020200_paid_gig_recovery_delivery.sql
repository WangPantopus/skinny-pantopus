-- Backwards compatible: yes. Adds service-only actor checks and durable paid-gig
-- delivery. Historical records remain; no historical notification replay, role
-- grants, provider calls or financial balance changes occur during migration.
SET LOCAL lock_timeout='5s';
ALTER TABLE public."GigPaymentAcceptance"
 ADD COLUMN room_id uuid REFERENCES public."ChatRoom"(id) ON DELETE SET NULL,
 ADD COLUMN effects_preexisting boolean NOT NULL DEFAULT false,
 ADD COLUMN recovery_after timestamptz NOT NULL DEFAULT now(),
 ADD COLUMN recovery_error text;
UPDATE public."GigPaymentAcceptance" SET effects_preexisting=true WHERE state='accepted';

CREATE TABLE public."GigAcceptanceDelivery" (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 acceptance_id uuid NOT NULL REFERENCES public."GigPaymentAcceptance"(id) ON DELETE RESTRICT,
 user_id uuid NOT NULL REFERENCES public."User"(id) ON DELETE RESTRICT,
 kind text NOT NULL CHECK(kind IN ('bid_accepted','bid_on_standby','payout_onboarding_nudge')),
 notification_id uuid REFERENCES public."Notification"(id) ON DELETE SET NULL,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','processing','done','suppressed')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
 retry_at timestamptz NOT NULL DEFAULT now(),
 lease_id uuid, lease_until timestamptz,
 last_error text, completed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(acceptance_id,user_id,kind)
);
CREATE INDEX gig_acceptance_delivery_pending ON public."GigAcceptanceDelivery"(retry_at,created_at)
 WHERE state IN ('pending','processing');
ALTER TABLE public."GigAcceptanceDelivery" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."GigAcceptanceDelivery" FROM PUBLIC,anon,authenticated;
GRANT ALL ON public."GigAcceptanceDelivery" TO service_role;

-- The existing route policy permits gigs.manage OR gigs.post. Lock its complete
-- authority inputs briefly, including absent override rows, so a concurrent
-- revocation either precedes this decision or waits for this transaction.
CREATE FUNCTION public.paid_gig_actor_allowed(p_payer_id uuid,p_actor_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE account_kind text;
BEGIN
 IF p_actor_id IS NULL OR p_payer_id IS NULL THEN RETURN false; END IF;
 IF p_actor_id=p_payer_id THEN RETURN true; END IF;
 SELECT account_type INTO account_kind FROM public."User" WHERE id=p_payer_id FOR SHARE;
 IF account_kind IS DISTINCT FROM 'business' THEN RETURN false; END IF;
 LOCK TABLE public."BusinessTeam",public."BusinessPermissionOverride",public."BusinessRolePermission" IN SHARE MODE;
 RETURN coalesce(public.business_has_permission(p_payer_id,'gigs.manage',p_actor_id),false)
     OR coalesce(public.business_has_permission(p_payer_id,'gigs.post',p_actor_id),false);
END $$;

CREATE FUNCTION public.verify_paid_gig_actor(p_payer_id uuid,p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
BEGIN
 IF NOT public.paid_gig_actor_allowed(p_payer_id,p_actor_id) THEN RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
 RETURN jsonb_build_object('allowed',true);
END $$;

CREATE FUNCTION public.begin_paid_gig_acceptance_as_actor(p_gig_id uuid,p_bid_id uuid,p_payer_id uuid,p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
BEGIN
 IF NOT public.paid_gig_actor_allowed(p_payer_id,p_actor_id) THEN RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
 RETURN public.begin_paid_gig_acceptance(p_gig_id,p_bid_id,p_payer_id);
END $$;

CREATE FUNCTION public.bind_paid_gig_acceptance_as_actor(p_attempt_id uuid,p_payment_id uuid,p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE payer uuid;
BEGIN
 SELECT payer_id INTO payer FROM public."GigPaymentAcceptance" WHERE id=p_attempt_id;
 IF NOT public.paid_gig_actor_allowed(payer,p_actor_id) THEN RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
 RETURN public.bind_paid_gig_acceptance(p_attempt_id,p_payment_id);
END $$;

CREATE FUNCTION public.cancel_paid_gig_acceptance_as_actor(p_gig_id uuid,p_bid_id uuid,p_payer_id uuid,p_actor_id uuid,p_complete boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
BEGIN
 IF NOT public.paid_gig_actor_allowed(p_payer_id,p_actor_id) THEN RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
 RETURN public.cancel_paid_gig_acceptance(p_gig_id,p_bid_id,p_payer_id,p_complete);
END $$;

-- Materialization is inside the assignment transaction. A process dying after
-- commit cannot lose the chat or stored notification. Existing receipts never
-- recreate notifications removed by the recipient or reactivate departed chat.
CREATE FUNCTION public.materialize_paid_gig_acceptance(p_attempt_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE a public."GigPaymentAcceptance"%ROWTYPE; g public."Gig"%ROWTYPE;
 room uuid; recipient record; event_id uuid; note_id uuid; note_title text; note_body text; note_icon text; note_link text;
BEGIN
 SELECT * INTO a FROM public."GigPaymentAcceptance" WHERE id=p_attempt_id;
 SELECT * INTO g FROM public."Gig" WHERE id=a.gig_id FOR UPDATE;
 SELECT * INTO a FROM public."GigPaymentAcceptance" WHERE id=p_attempt_id FOR UPDATE;
 IF a.state IS DISTINCT FROM 'accepted' OR g.payment_id IS DISTINCT FROM a.payment_id
 OR g.accepted_by IS DISTINCT FROM a.payee_id OR g.user_id IS DISTINCT FROM a.payer_id THEN
 RAISE EXCEPTION 'Acceptance effects do not match the assignment' USING ERRCODE='40001'; END IF;
 IF a.room_id IS NOT NULL THEN RETURN a.room_id; END IF;
 SELECT id INTO room FROM public."ChatRoom" WHERE gig_id=g.id AND type='gig' ORDER BY created_at,id LIMIT 1;
 IF room IS NULL THEN
  INSERT INTO public."ChatRoom"(type,gig_id,name) VALUES('gig',g.id,left('Gig: '||g.title,255)) RETURNING id INTO room;
 END IF;
 INSERT INTO public."ChatParticipant"(room_id,user_id,role,is_active) VALUES
 (room,a.payer_id,'owner',true),(room,a.payee_id,'member',true)
 ON CONFLICT(room_id,user_id) DO UPDATE SET is_active=true,left_at=NULL;
 IF NOT EXISTS(SELECT FROM public."ChatMessage" WHERE room_id=room AND metadata->>'acceptance_attempt_id'=a.id::text) THEN
  INSERT INTO public."ChatMessage"(room_id,user_id,type,message,metadata)
  VALUES(room,a.payer_id,'gig_offer','Offer accepted for "'||g.title||'" • Budget: $'||(a.amount/100.0)::numeric(12,2)||' • Open gig: /gigs/'||g.id,
   jsonb_build_object('gigId',g.id,'gig_id',g.id,'title',g.title,'category',g.category,'status','assigned',
    'price',a.amount/100.0,'auto_generated',true,'acceptance_attempt_id',a.id));
 END IF;
 UPDATE public."GigPaymentAcceptance" SET room_id=room WHERE id=a.id;
 IF a.effects_preexisting THEN RETURN room; END IF;
 FOR recipient IN
  SELECT a.payee_id AS user_id,'bid_accepted'::text AS kind
  UNION SELECT b.user_id,'bid_on_standby' FROM public."GigBid" b
   WHERE b.gig_id=g.id AND b.status IN ('pending','countered') AND b.user_id<>a.payee_id
  UNION SELECT a.payee_id,'payout_onboarding_nudge' WHERE NOT EXISTS
   (SELECT FROM public."StripeAccount" WHERE user_id=a.payee_id AND stripe_account_id IS NOT NULL)
 LOOP
  event_id:=NULL;
  INSERT INTO public."GigAcceptanceDelivery"(acceptance_id,user_id,kind)
   VALUES(a.id,recipient.user_id,recipient.kind) ON CONFLICT DO NOTHING RETURNING id INTO event_id;
  IF event_id IS NULL THEN CONTINUE; END IF;
  note_link:='/gigs/'||g.id;
  IF recipient.kind='bid_accepted' THEN
   note_title:='Your bid was accepted!'; note_body:='Your bid on "'||g.title||'" was accepted. Open the gig to see the details.'; note_icon:='🎉';
  ELSIF recipient.kind='bid_on_standby' THEN
   note_title:='Another bid was selected first for "'||g.title||'"';
   note_body:='Your bid is still active. You may still be selected if the assignment changes, or you can withdraw your bid.'; note_icon:='⏳';
  ELSE
   note_title:='Set up your payout account'; note_body:='Set up your payout account to withdraw your earnings from paid gigs.';
   note_icon:='💳'; note_link:='/app/settings/payments';
  END IF;
  INSERT INTO public."Notification"(user_id,type,title,body,icon,link,metadata,idempotency_key)
   VALUES(recipient.user_id,recipient.kind,note_title,note_body,note_icon,note_link,
    jsonb_build_object('gig_id',g.id,'acceptance_attempt_id',a.id,'address_unlocked',recipient.kind='bid_accepted'),
    'gig-acceptance:'||event_id) RETURNING id INTO note_id;
  UPDATE public."GigAcceptanceDelivery" SET notification_id=note_id WHERE id=event_id;
 END LOOP;
 RETURN room;
END $$;

CREATE FUNCTION public.claim_gig_acceptance_delivery()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE event public."GigAcceptanceDelivery"%ROWTYPE;
BEGIN
 SELECT * INTO event FROM public."GigAcceptanceDelivery"
 WHERE (state='pending' AND retry_at<=clock_timestamp()) OR (state='processing' AND lease_until<=clock_timestamp())
 ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED;
 IF NOT FOUND THEN RETURN NULL; END IF;
 UPDATE public."GigAcceptanceDelivery" SET state='processing',lease_id=gen_random_uuid(),
  lease_until=clock_timestamp()+interval '5 minutes',attempts=attempts+1 WHERE id=event.id RETURNING * INTO event;
 RETURN to_jsonb(event);
END $$;

CREATE FUNCTION public.read_gig_acceptance_delivery(p_id uuid,p_lease_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE event public."GigAcceptanceDelivery"%ROWTYPE; a public."GigPaymentAcceptance"%ROWTYPE;
 g public."Gig"%ROWTYPE; note public."Notification"%ROWTYPE; eligible boolean;
BEGIN
 SELECT * INTO event FROM public."GigAcceptanceDelivery" WHERE id=p_id AND lease_id=p_lease_id AND state='processing'
  AND lease_until>clock_timestamp() FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','LEASE_LOST'); END IF;
 SELECT * INTO a FROM public."GigPaymentAcceptance" WHERE id=event.acceptance_id;
 SELECT * INTO g FROM public."Gig" WHERE id=a.gig_id;
 SELECT * INTO note FROM public."Notification" WHERE id=event.notification_id AND user_id=event.user_id;
 eligible:=note.id IS NOT NULL AND a.state='accepted' AND g.payment_id=a.payment_id AND g.accepted_by=a.payee_id
  AND g.user_id=a.payer_id AND g.status IN ('assigned','in_progress','completed');
 IF event.kind='bid_on_standby' THEN
  eligible:=eligible AND EXISTS(SELECT FROM public."GigBid" WHERE gig_id=g.id AND user_id=event.user_id AND status IN ('pending','countered'));
 ELSE
  eligible:=eligible AND event.user_id=a.payee_id AND EXISTS(SELECT FROM public."ChatParticipant"
   WHERE room_id=a.room_id AND user_id=event.user_id AND is_active);
 END IF;
 IF event.kind='payout_onboarding_nudge' THEN
  eligible:=eligible AND NOT EXISTS(SELECT FROM public."StripeAccount" WHERE user_id=event.user_id AND stripe_account_id IS NOT NULL);
 END IF;
 RETURN jsonb_build_object('eligible',coalesce(eligible,false),'notification',CASE WHEN eligible THEN to_jsonb(note) ELSE NULL END);
END $$;

CREATE FUNCTION public.finish_gig_acceptance_delivery(p_id uuid,p_lease_id uuid,p_outcome text,p_error text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
BEGIN
 IF p_outcome IS NULL OR p_outcome NOT IN ('done','suppressed','retry') THEN RETURN false; END IF;
 UPDATE public."GigAcceptanceDelivery" SET state=CASE WHEN p_outcome='retry' THEN 'pending' ELSE p_outcome END,
 retry_at=clock_timestamp()+make_interval(secs=>least(3600,30*greatest(attempts,1))),
 lease_id=NULL,lease_until=NULL,last_error=left(p_error,100),
 completed_at=CASE WHEN p_outcome='retry' THEN NULL ELSE clock_timestamp() END
 WHERE id=p_id AND lease_id=p_lease_id AND state='processing' AND lease_until>clock_timestamp();
 RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.finalize_paid_gig_acceptance(p_gig_id uuid,p_bid_id uuid,p_payer_id uuid,p_payment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE g public."Gig"%ROWTYPE; b public."GigBid"%ROWTYPE; a public."GigPaymentAcceptance"%ROWTYPE; p public."Payment"%ROWTYPE;
BEGIN
 SELECT * INTO g FROM public."Gig" WHERE id=p_gig_id FOR UPDATE;
 IF NOT FOUND OR g.user_id IS DISTINCT FROM p_payer_id THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 SELECT * INTO b FROM public."GigBid" WHERE id=p_bid_id AND gig_id=g.id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 SELECT * INTO a FROM public."GigPaymentAcceptance" WHERE gig_id=g.id AND bid_id=b.id AND payment_id=p_payment_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 IF a.state='accepted' AND g.payment_id=a.payment_id AND g.accepted_by=a.payee_id AND b.status='accepted' THEN
  RETURN jsonb_build_object('gig',to_jsonb(g),'bid',to_jsonb(b),'reused',true,'room_id',public.materialize_paid_gig_acceptance(a.id)); END IF;
 SELECT * INTO p FROM public."Payment" WHERE id=p_payment_id FOR UPDATE;
 IF NOT FOUND OR g.status IS DISTINCT FROM 'open' OR b.status<>'pending_payment' OR a.state<>'pending'
  OR b.pending_payment_intent_id IS DISTINCT FROM p.id::text OR a.payer_id<>g.user_id OR a.payee_id<>b.user_id
  OR a.amount<>round(b.bid_amount*100)::integer OR p.gig_id IS DISTINCT FROM g.id OR p.payer_id<>g.user_id
  OR p.payee_id<>b.user_id OR p.amount_total<>a.amount OR lower(p.currency) IS DISTINCT FROM 'usd'
  OR p.payment_type IS DISTINCT FROM 'gig_payment' OR p.payment_status IS DISTINCT FROM 'authorized' OR coalesce(p.refunded_amount,0)<>0
  OR p.metadata->>'acceptance_attempt_id' IS DISTINCT FROM a.id::text
  OR p.authorization_expires_at IS NULL OR p.authorization_expires_at<=clock_timestamp() THEN RETURN jsonb_build_object('error','PAYMENT_NOT_AUTHORIZED'); END IF;
 UPDATE public."GigPaymentAcceptance" SET state='accepted',updated_at=now() WHERE id=a.id;
 UPDATE public."GigBid" SET status='accepted',pending_payment_expires_at=NULL,pending_payment_intent_id=NULL,
  updated_at=now() WHERE id=b.id RETURNING * INTO b;
 UPDATE public."Gig" SET status='assigned',accepted_by=a.payee_id,accepted_at=now(),price=a.amount/100.0,
  payment_id=p.id,payment_status=p.payment_status,updated_at=now() WHERE id=g.id RETURNING * INTO g;
 RETURN jsonb_build_object('gig',to_jsonb(g),'bid',to_jsonb(b),'reused',false,'room_id',public.materialize_paid_gig_acceptance(a.id));
END $$;


CREATE FUNCTION public.finalize_paid_gig_acceptance_as_actor(p_gig_id uuid,p_bid_id uuid,p_payer_id uuid,p_payment_id uuid,p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE result jsonb;
BEGIN
 IF NOT public.paid_gig_actor_allowed(p_payer_id,p_actor_id) THEN RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
 result:=public.finalize_paid_gig_acceptance(p_gig_id,p_bid_id,p_payer_id,p_payment_id);
 IF result->>'error' IS NULL AND p_actor_id<>p_payer_id AND NOT coalesce((result->>'reused')::boolean,false) THEN
  INSERT INTO public."ChatParticipant"(room_id,user_id,role,is_active)
   VALUES((result->>'room_id')::uuid,p_actor_id,'member',true)
   ON CONFLICT(room_id,user_id) DO UPDATE SET is_active=true,left_at=NULL;
 END IF;
 RETURN result;
END $$;

-- Serialize existing service chat creation with assignment materialization.
-- Preserve existing rooms (including legacy duplicates), choosing one stably.
CREATE OR REPLACE FUNCTION public.get_or_create_gig_chat(p_gig_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE room uuid; gig_title text;
BEGIN
 SELECT title INTO gig_title FROM public."Gig" WHERE id=p_gig_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Gig not found' USING ERRCODE='P0002'; END IF;
 SELECT id INTO room FROM public."ChatRoom" WHERE gig_id=p_gig_id AND type='gig' ORDER BY created_at,id LIMIT 1;
 IF room IS NULL THEN
  INSERT INTO public."ChatRoom"(type,gig_id,name) VALUES('gig',p_gig_id,left(coalesce('Gig: '||gig_title,'Gig Chat'),255)) RETURNING id INTO room;
 END IF;
 RETURN room;
END $$;

DO $$ DECLARE f regprocedure; BEGIN
 FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('paid_gig_actor_allowed','verify_paid_gig_actor',
 'begin_paid_gig_acceptance_as_actor','bind_paid_gig_acceptance_as_actor','cancel_paid_gig_acceptance_as_actor',
 'finalize_paid_gig_acceptance_as_actor','materialize_paid_gig_acceptance','claim_gig_acceptance_delivery',
 'read_gig_acceptance_delivery','finish_gig_acceptance_delivery') LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f);
 END LOOP;
END $$;
