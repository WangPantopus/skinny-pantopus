BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
INSERT INTO auth.users(id,email) SELECT ('aae30000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 'paid-gig-delivery-'||n||'@example.invalid' FROM generate_series(1,5) n;
INSERT INTO public."User"(id,email,username,name,account_type) SELECT id,email,'paid_gig_delivery_'||right(id::text,1),
 'Synthetic paid gig',CASE WHEN right(id::text,1)='1' THEN 'business' ELSE 'individual' END
 FROM auth.users WHERE id::text LIKE 'aae30000-%';
INSERT INTO public."BusinessTeam"(business_user_id,user_id,role_base)
 VALUES('aae30000-0000-4000-8000-000000000001','aae30000-0000-4000-8000-000000000004','staff');
INSERT INTO public."BusinessPermissionOverride"(business_user_id,user_id,permission,allowed) VALUES
 ('aae30000-0000-4000-8000-000000000001','aae30000-0000-4000-8000-000000000004','gigs.manage',true),
 ('aae30000-0000-4000-8000-000000000001','aae30000-0000-4000-8000-000000000004','gigs.post',false);
INSERT INTO public."Gig"(id,user_id,created_by,title,description,price) VALUES
 ('aae30000-0000-4000-8000-000000000101','aae30000-0000-4000-8000-000000000001','aae30000-0000-4000-8000-000000000001','Delivery contract','Synthetic contract',20);
INSERT INTO public."GigBid"(id,gig_id,user_id,bid_amount) VALUES
 ('aae30000-0000-4000-8000-000000000201','aae30000-0000-4000-8000-000000000101','aae30000-0000-4000-8000-000000000002',12.50),
 ('aae30000-0000-4000-8000-000000000202','aae30000-0000-4000-8000-000000000101','aae30000-0000-4000-8000-000000000003',13.50);
CREATE TEMP TABLE paid_delivery_state(attempt uuid,payment uuid,room uuid,receipt jsonb,event_id uuid,lease uuid);
GRANT ALL ON paid_delivery_state TO service_role;
SET LOCAL ROLE service_role;
DO $$
DECLARE u uuid:='aae30000-0000-4000-8000-000000000001'; w uuid:='aae30000-0000-4000-8000-000000000002';
 actor uuid:='aae30000-0000-4000-8000-000000000004'; outsider uuid:='aae30000-0000-4000-8000-000000000005';
 g uuid:='aae30000-0000-4000-8000-000000000101'; b uuid:='aae30000-0000-4000-8000-000000000201';
 p uuid:='aae30000-0000-4000-8000-000000000301'; a jsonb;
BEGIN
 IF public.begin_paid_gig_acceptance_as_actor(g,b,u,outsider)->>'error' IS DISTINCT FROM 'FORBIDDEN' THEN RAISE EXCEPTION 'Foreign delegate admitted'; END IF;
 IF public.begin_paid_gig_acceptance_as_actor(g,b,u,NULL)->>'error' IS DISTINCT FROM 'FORBIDDEN' THEN RAISE EXCEPTION 'Null actor admitted'; END IF;
 a:=public.begin_paid_gig_acceptance_as_actor(g,b,u,actor)->'attempt';
 IF a->>'amount' IS DISTINCT FROM '1250' THEN RAISE EXCEPTION 'Allowed delegate failed'; END IF;
 INSERT INTO public."Payment"(id,gig_id,payer_id,payee_id,amount_total,amount_subtotal,amount_platform_fee,amount_to_payee,
 stripe_customer_id,stripe_payment_intent_id,payment_status,authorization_expires_at,metadata)
 VALUES(p,g,u,w,1250,1250,187,1063,'cus_delivery','pi_delivery','authorized',now()+interval '1 day',jsonb_build_object('acceptance_attempt_id',a->>'id'));
 UPDATE public."BusinessTeam" SET is_active=false WHERE business_user_id=u AND user_id=actor;
 IF public.bind_paid_gig_acceptance_as_actor((a->>'id')::uuid,p,actor)->>'error' IS DISTINCT FROM 'FORBIDDEN' THEN RAISE EXCEPTION 'Revoked delegate bound payment'; END IF;
 UPDATE public."BusinessTeam" SET is_active=true WHERE business_user_id=u AND user_id=actor;
 PERFORM public.bind_paid_gig_acceptance_as_actor((a->>'id')::uuid,p,actor);
 UPDATE public."BusinessPermissionOverride" SET allowed=false WHERE business_user_id=u AND user_id=actor AND permission='gigs.manage';
 IF public.finalize_paid_gig_acceptance_as_actor(g,b,u,p,actor)->>'error' IS DISTINCT FROM 'FORBIDDEN' THEN RAISE EXCEPTION 'Denied delegate assigned gig'; END IF;
 IF public.cancel_paid_gig_acceptance_as_actor(g,b,u,actor)->>'error' IS DISTINCT FROM 'FORBIDDEN' THEN RAISE EXCEPTION 'Denied delegate canceled payer authorization'; END IF;
 IF (SELECT state FROM public."GigPaymentAcceptance" WHERE id=(a->>'id')::uuid) IS DISTINCT FROM 'pending' THEN RAISE EXCEPTION 'Denied actor changed acceptance'; END IF;
 UPDATE public."BusinessPermissionOverride" SET allowed=true WHERE business_user_id=u AND user_id=actor AND permission='gigs.manage';
 INSERT INTO paid_delivery_state(attempt,payment) VALUES((a->>'id')::uuid,p);
END $$;
RESET ROLE;
CREATE FUNCTION pg_temp.fail_delivery_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF NEW.type='bid_accepted' THEN RAISE EXCEPTION 'forced notification failure'; END IF; RETURN NEW; END $$;
CREATE TRIGGER paid_delivery_failure BEFORE INSERT ON public."Notification" FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_delivery_insert();
DO $$ BEGIN
 BEGIN
 PERFORM public.finalize_paid_gig_acceptance_as_actor('aae30000-0000-4000-8000-000000000101','aae30000-0000-4000-8000-000000000201',
  'aae30000-0000-4000-8000-000000000001','aae30000-0000-4000-8000-000000000301','aae30000-0000-4000-8000-000000000004');
 RAISE EXCEPTION 'Notification failure did not roll back';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'forced notification failure' THEN RAISE; END IF; END;
 IF (SELECT status FROM public."Gig" WHERE id='aae30000-0000-4000-8000-000000000101')<>'open'
 OR (SELECT status FROM public."GigBid" WHERE id='aae30000-0000-4000-8000-000000000201')<>'pending_payment'
 OR EXISTS(SELECT FROM public."ChatRoom" WHERE gig_id='aae30000-0000-4000-8000-000000000101')
 OR EXISTS(SELECT FROM public."GigAcceptanceDelivery" WHERE acceptance_id=(SELECT attempt FROM paid_delivery_state)) THEN
 RAISE EXCEPTION 'Partial assignment/chat/delivery survived rollback'; END IF;
END $$;
DROP TRIGGER paid_delivery_failure ON public."Notification";
SET LOCAL ROLE service_role;
DO $$
DECLARE result jsonb; again jsonb; event jsonb; result_read jsonb; v_room uuid;
BEGIN
 result:=public.finalize_paid_gig_acceptance_as_actor('aae30000-0000-4000-8000-000000000101','aae30000-0000-4000-8000-000000000201',
  'aae30000-0000-4000-8000-000000000001','aae30000-0000-4000-8000-000000000301','aae30000-0000-4000-8000-000000000004');
 v_room:=(result->>'room_id')::uuid;
 IF v_room IS NULL OR (SELECT count(*) FROM public."ChatParticipant" WHERE room_id=v_room AND is_active)<>3
 OR (SELECT count(*) FROM public."ChatMessage" WHERE room_id=v_room)<>1
 OR (SELECT count(*) FROM public."GigAcceptanceDelivery" WHERE acceptance_id=(SELECT attempt FROM paid_delivery_state))<>3 THEN
 RAISE EXCEPTION 'Atomic participant/message/notification receipt missing'; END IF;
 again:=public.finalize_paid_gig_acceptance_as_actor('aae30000-0000-4000-8000-000000000101','aae30000-0000-4000-8000-000000000201',
  'aae30000-0000-4000-8000-000000000001','aae30000-0000-4000-8000-000000000301','aae30000-0000-4000-8000-000000000004');
 IF again->>'reused' IS DISTINCT FROM 'true' OR (result-'reused') IS DISTINCT FROM (again-'reused')
 OR (SELECT count(*) FROM public."ChatMessage" WHERE room_id=v_room)<>1 THEN RAISE EXCEPTION 'Lost response replay duplicated effects'; END IF;
 IF EXISTS(SELECT FROM public."GigAcceptanceDelivery" d LEFT JOIN public."Notification" n ON n.id=d.notification_id
 WHERE d.acceptance_id=(SELECT attempt FROM paid_delivery_state) AND (n.id IS NULL OR n.user_id<>d.user_id OR n.metadata->>'gig_id'<>'aae30000-0000-4000-8000-000000000101')) THEN
 RAISE EXCEPTION 'Notification destination not exact'; END IF;
 -- Claim every event once. No second claimant can steal a live lease.
 event:=public.claim_gig_acceptance_delivery();
 UPDATE paid_delivery_state SET event_id=(event->>'id')::uuid,lease=(event->>'lease_id')::uuid,room=v_room;
 result_read:=public.read_gig_acceptance_delivery((event->>'id')::uuid,(event->>'lease_id')::uuid);
 IF result_read->>'eligible' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Current event not deliverable'; END IF;
 IF public.finish_gig_acceptance_delivery((event->>'id')::uuid,gen_random_uuid(),'done') THEN RAISE EXCEPTION 'Foreign lease committed receipt'; END IF;
 IF NOT public.finish_gig_acceptance_delivery((event->>'id')::uuid,(event->>'lease_id')::uuid,'retry','provider_outcome_unknown') THEN RAISE EXCEPTION 'Retry receipt failed'; END IF;
 IF public.finish_gig_acceptance_delivery((event->>'id')::uuid,(event->>'lease_id')::uuid,'done') THEN RAISE EXCEPTION 'Old lease committed after retry'; END IF;
 -- A changed assignment suppresses the exact old event, without deleting rows.
 UPDATE public."GigAcceptanceDelivery" SET retry_at=now()-interval '1 minute' WHERE id=(event->>'id')::uuid;
 UPDATE public."Gig" SET status='cancelled' WHERE id='aae30000-0000-4000-8000-000000000101';
 event:=public.claim_gig_acceptance_delivery();
 IF public.read_gig_acceptance_delivery((event->>'id')::uuid,(event->>'lease_id')::uuid)->>'eligible' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Canceled assignment still delivers'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','aae30000-0000-4000-8000-000000000001',true);
DO $$ BEGIN
 BEGIN PERFORM * FROM public."GigAcceptanceDelivery"; RAISE EXCEPTION 'Client read relay state'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.claim_gig_acceptance_delivery(); RAISE EXCEPTION 'Client claimed event'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.verify_paid_gig_actor('aae30000-0000-4000-8000-000000000001','aae30000-0000-4000-8000-000000000001');
 RAISE EXCEPTION 'Client forged actor check'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
