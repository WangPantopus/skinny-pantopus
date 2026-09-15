BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
INSERT INTO auth.users(id,email) SELECT ('aae10000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 'paid-gig-contract-'||n||'@example.invalid' FROM generate_series(1,4) n;
INSERT INTO public."User"(id,email,username,name,stripe_customer_id) SELECT id,email,'paid_gig_contract_'||right(id::text,1),
 'Paid gig contract','cus_contract'||right(id::text,1) FROM auth.users WHERE id::text LIKE 'aae10000-%';
INSERT INTO public."Gig"(id,user_id,created_by,title,description,price) VALUES
 ('aae10000-0000-4000-8000-000000000101','aae10000-0000-4000-8000-000000000001','aae10000-0000-4000-8000-000000000001','Contract one','Synthetic contract',20),
 ('aae10000-0000-4000-8000-000000000102','aae10000-0000-4000-8000-000000000004','aae10000-0000-4000-8000-000000000004','Foreign contract','Synthetic contract',20);
INSERT INTO public."GigBid"(id,gig_id,user_id,bid_amount) VALUES
 ('aae10000-0000-4000-8000-000000000201','aae10000-0000-4000-8000-000000000101','aae10000-0000-4000-8000-000000000002',12.50),
 ('aae10000-0000-4000-8000-000000000202','aae10000-0000-4000-8000-000000000101','aae10000-0000-4000-8000-000000000003',13.50);
INSERT INTO public."GigBid"(id,gig_id,user_id,bid_amount,expires_at) VALUES
 ('aae10000-0000-4000-8000-000000000203','aae10000-0000-4000-8000-000000000102','aae10000-0000-4000-8000-000000000002',0,clock_timestamp()-interval '1 minute');
DO $$ BEGIN
 IF public.accept_free_gig_bid('aae10000-0000-4000-8000-000000000102','aae10000-0000-4000-8000-000000000203',
 'aae10000-0000-4000-8000-000000000004')->>'error' IS DISTINCT FROM 'CONFLICT' THEN RAISE EXCEPTION 'Expired free bid accepted'; END IF;
END $$;
CREATE TEMP TABLE paid_gig_contract_state(attempt_id uuid,payment_id uuid);
GRANT ALL ON paid_gig_contract_state TO service_role;
SET LOCAL ROLE service_role;
DO $$
DECLARE a jsonb; r jsonb; u uuid:='aae10000-0000-4000-8000-000000000001'; g uuid:='aae10000-0000-4000-8000-000000000101';
 b uuid:='aae10000-0000-4000-8000-000000000201'; p uuid:='aae10000-0000-4000-8000-000000000301';
BEGIN
 IF public.begin_paid_gig_acceptance(g,b,'aae10000-0000-4000-8000-000000000004')->>'error' IS DISTINCT FROM 'NOT_FOUND' THEN
 RAISE EXCEPTION 'Foreign payer admitted'; END IF;
 IF public.begin_paid_gig_acceptance('aae10000-0000-4000-8000-000000000102',b,'aae10000-0000-4000-8000-000000000004')->>'error' IS DISTINCT FROM 'NOT_FOUND' THEN
 RAISE EXCEPTION 'Cross-gig bid admitted'; END IF;
 a:=public.begin_paid_gig_acceptance(g,b,u)->'attempt';
 IF a->>'amount' IS DISTINCT FROM '1250' OR a->>'state' IS DISTINCT FROM 'initializing' THEN RAISE EXCEPTION 'Agreed bid terms not reserved'; END IF;
 r:=public.begin_paid_gig_acceptance(g,b,u);
 IF r->'attempt'->>'id' IS DISTINCT FROM a->>'id' OR r->>'reused' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Retry changed operation identity'; END IF;
 IF public.begin_paid_gig_acceptance(g,'aae10000-0000-4000-8000-000000000202',u)->>'error' IS DISTINCT FROM 'CONFLICT' THEN
 RAISE EXCEPTION 'Different bid bypassed reservation'; END IF;
 INSERT INTO public."Payment"(id,gig_id,payer_id,payee_id,amount_total,amount_subtotal,amount_platform_fee,amount_to_payee,
 stripe_customer_id,stripe_payment_intent_id,payment_status,metadata)
 VALUES(p,g,u,'aae10000-0000-4000-8000-000000000002',1250,1250,188,1062,'cus_contract1','pi_contract1','authorize_pending',
 jsonb_build_object('acceptance_attempt_id',a->>'id'));
 INSERT INTO paid_gig_contract_state VALUES((a->>'id')::uuid,p);
 -- Wrong amount cannot bind a real payment; neither the bid nor attempt changes.
 UPDATE public."Payment" SET amount_total=1200 WHERE id=p;
 IF public.bind_paid_gig_acceptance((a->>'id')::uuid,p)->>'error' IS DISTINCT FROM 'TERMS_CHANGED' THEN RAISE EXCEPTION 'Wrong amount bound'; END IF;
 IF (SELECT payment_id FROM public."GigPaymentAcceptance" WHERE id=(a->>'id')::uuid) IS NOT NULL THEN RAISE EXCEPTION 'Failed bind mutated attempt'; END IF;
 UPDATE public."Payment" SET amount_total=1250 WHERE id=p;
 r:=public.bind_paid_gig_acceptance((a->>'id')::uuid,p);
 IF r->'attempt'->>'payment_id' IS DISTINCT FROM p::text THEN RAISE EXCEPTION 'Valid binding failed'; END IF;
 IF public.finalize_paid_gig_acceptance(g,b,u,p)->>'error' IS DISTINCT FROM 'PAYMENT_NOT_AUTHORIZED' THEN RAISE EXCEPTION 'Unproven payment assigned'; END IF;
 IF (SELECT status FROM public."Gig" WHERE id=g)<>'open' OR (SELECT status FROM public."GigBid" WHERE id=b)<>'pending_payment' THEN
 RAISE EXCEPTION 'Denied assignment changed rows'; END IF;
 UPDATE public."Payment" SET payment_status=NULL,authorization_expires_at=now()+interval '1 day' WHERE id=p;
 IF public.finalize_paid_gig_acceptance(g,b,u,p)->>'error' IS DISTINCT FROM 'PAYMENT_NOT_AUTHORIZED' THEN RAISE EXCEPTION 'Null payment state assigned'; END IF;
 UPDATE public."Payment" SET payment_status='authorized' WHERE id=p;
 BEGIN UPDATE public."Gig" SET status=NULL WHERE id=g;
 RAISE EXCEPTION 'Active checkout gig changed'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 BEGIN UPDATE public."GigBid" SET bid_amount=1 WHERE id=b;
 RAISE EXCEPTION 'Active checkout bid changed'; EXCEPTION WHEN serialization_failure THEN NULL; END;
END $$;
RESET ROLE;
-- Force the second half of finalization to fail: the first Bid write must roll back.
CREATE FUNCTION pg_temp.fail_paid_gig_assignment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF NEW.id='aae10000-0000-4000-8000-000000000101' AND NEW.status='assigned' THEN
 RAISE EXCEPTION 'contract forced assignment failure'; END IF; RETURN NEW; END $$;
CREATE TRIGGER paid_gig_contract_failure BEFORE UPDATE ON public."Gig" FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_paid_gig_assignment();
SET LOCAL ROLE service_role;
DO $$ BEGIN
 BEGIN
 PERFORM public.finalize_paid_gig_acceptance('aae10000-0000-4000-8000-000000000101','aae10000-0000-4000-8000-000000000201',
 'aae10000-0000-4000-8000-000000000001','aae10000-0000-4000-8000-000000000301');
 RAISE EXCEPTION 'Forced assignment did not fail';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'contract forced assignment failure' THEN RAISE; END IF; END;
 IF (SELECT status FROM public."GigBid" WHERE id='aae10000-0000-4000-8000-000000000201')<>'pending_payment'
 OR (SELECT state FROM public."GigPaymentAcceptance" WHERE id=(SELECT attempt_id FROM paid_gig_contract_state))<>'pending' THEN
 RAISE EXCEPTION 'Partial assignment survived transaction failure'; END IF;
END $$;
RESET ROLE;
DROP TRIGGER paid_gig_contract_failure ON public."Gig";
SET LOCAL ROLE service_role;
DO $$
DECLARE a uuid; p uuid; r jsonb; receipt jsonb;
 g uuid:='aae10000-0000-4000-8000-000000000101'; b uuid:='aae10000-0000-4000-8000-000000000201'; u uuid:='aae10000-0000-4000-8000-000000000001';
BEGIN
 SELECT attempt_id,payment_id INTO a,p FROM paid_gig_contract_state;
 IF public.cancel_paid_gig_acceptance('aae10000-0000-4000-8000-000000000102',b,'aae10000-0000-4000-8000-000000000004')->>'error' IS DISTINCT FROM 'NOT_FOUND' THEN
 RAISE EXCEPTION 'Owner of another gig canceled pending bid'; END IF;
 -- Cancellation fence wins over finalization, but an unknown cancellation keeps references.
 PERFORM public.cancel_paid_gig_acceptance(g,b,u);
 IF public.finalize_paid_gig_acceptance(g,b,u,p)->>'error' IS DISTINCT FROM 'PAYMENT_NOT_AUTHORIZED' THEN RAISE EXCEPTION 'Finalized during cancellation'; END IF;
 IF public.cancel_paid_gig_acceptance(g,b,u,true)->>'error' IS DISTINCT FROM 'CANCELLATION_NOT_CONFIRMED' THEN RAISE EXCEPTION 'Cleared unknown cancellation'; END IF;
 IF (SELECT pending_payment_intent_id FROM public."GigBid" WHERE id=b) IS DISTINCT FROM p::text THEN RAISE EXCEPTION 'Lost cancel identity'; END IF;
 UPDATE public."Payment" SET payment_status='canceled' WHERE id=p;
 PERFORM public.cancel_paid_gig_acceptance(g,b,u,true);
 IF public.cancel_paid_gig_acceptance(g,b,u,true)->>'reused' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Cancellation retry failed'; END IF;
 -- Retry after proved cancellation gets a fresh operation; old records stay intact.
 r:=public.begin_paid_gig_acceptance(g,b,u); a:=(r->'attempt'->>'id')::uuid;
 IF a=(SELECT attempt_id FROM paid_gig_contract_state) THEN RAISE EXCEPTION 'Reused canceled provider operation'; END IF;
 p:='aae10000-0000-4000-8000-000000000302';
 INSERT INTO public."Payment"(id,gig_id,payer_id,payee_id,amount_total,amount_subtotal,amount_platform_fee,amount_to_payee,
 stripe_customer_id,stripe_payment_intent_id,payment_status,authorization_expires_at,metadata)
 VALUES(p,g,u,'aae10000-0000-4000-8000-000000000002',1250,1250,188,1062,'cus_contract1','pi_contract2','authorized',now()+interval '1 day',jsonb_build_object('acceptance_attempt_id',a));
 PERFORM public.bind_paid_gig_acceptance(a,p);
 r:=public.finalize_paid_gig_acceptance(g,b,u,p);
 IF r->'gig'->>'status' IS DISTINCT FROM 'assigned' OR r->'gig'->>'price' IS DISTINCT FROM '12.50' THEN RAISE EXCEPTION 'Valid paid assignment failed: %',r; END IF;
 IF public.finalize_paid_gig_acceptance(g,b,u,p)->>'reused' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Lost-response assignment retry failed'; END IF;
 IF public.prepare_paid_gig_capture(p)->>'error' IS DISTINCT FROM 'TERMS_CHANGED' THEN RAISE EXCEPTION 'Capture before worker completion admitted'; END IF;
 UPDATE public."Gig" SET status='completed',worker_completed_at=now() WHERE id=g;
 r:=public.prepare_paid_gig_capture(p);
 IF r->'payment'->>'payment_status' IS DISTINCT FROM 'capture_pending' THEN RAISE EXCEPTION 'Capture not durably prepared'; END IF;
 IF public.record_paid_gig_capture(p,'pi_foreign','ch_contract',1250,'cus_contract1','usd')->>'error' IS DISTINCT FROM 'TERMS_CHANGED'
 OR public.record_paid_gig_capture(p,'pi_contract2','ch_contract',1200,'cus_contract1','usd')->>'error' IS DISTINCT FROM 'TERMS_CHANGED'
 OR public.record_paid_gig_capture(p,'pi_contract2','ch_contract',1250,'cus_foreign','usd')->>'error' IS DISTINCT FROM 'TERMS_CHANGED' THEN
 RAISE EXCEPTION 'Mismatched provider capture proof accepted'; END IF;
 r:=public.record_paid_gig_capture(p,'pi_contract2','ch_contract',1250,'cus_contract1','usd');
 receipt:=r->'payment';
 IF receipt->>'payment_status' IS DISTINCT FROM 'captured_hold' OR receipt->>'captured_at' IS NULL THEN RAISE EXCEPTION 'Missing captured receipt'; END IF;
 r:=public.record_paid_gig_capture(p,'pi_contract2','ch_contract',1250,'cus_contract1','usd');
 IF r->>'reused' IS DISTINCT FROM 'true' OR r->'payment' IS DISTINCT FROM receipt THEN RAISE EXCEPTION 'Retry changed capture receipt/cooling-off deadline'; END IF;
 IF (SELECT count(*) FROM public."Payment" WHERE gig_id=g)<>2 OR (SELECT count(*) FROM public."GigPaymentAcceptance" WHERE gig_id=g)<>2 THEN
 RAISE EXCEPTION 'Prior canceled financial records were lost'; END IF;
END $$;
RESET ROLE;
-- Real unprivileged roles retain involved reads but cannot manufacture proof.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','aae10000-0000-4000-8000-000000000001',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM public."Payment" WHERE gig_id='aae10000-0000-4000-8000-000000000101')<>2 THEN RAISE EXCEPTION 'Payer lost financial reads'; END IF;
 BEGIN UPDATE public."Payment" SET payment_status='authorized' WHERE id='aae10000-0000-4000-8000-000000000302';
 RAISE EXCEPTION 'Payer forged status'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN DELETE FROM public."Payment" WHERE id='aae10000-0000-4000-8000-000000000302';
 RAISE EXCEPTION 'Payer deleted receipt'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN TRUNCATE public."Payment" CASCADE; RAISE EXCEPTION 'Payer truncated finances'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE public."Gig" SET description='Owner retains ordinary content edits' WHERE id='aae10000-0000-4000-8000-000000000101';
 BEGIN UPDATE public."Gig" SET payment_id=NULL WHERE id='aae10000-0000-4000-8000-000000000101';
 RAISE EXCEPTION 'Client unlinked payment'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.begin_paid_gig_acceptance('aae10000-0000-4000-8000-000000000101','aae10000-0000-4000-8000-000000000201','aae10000-0000-4000-8000-000000000001');
 RAISE EXCEPTION 'Client invoked service admission'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','aae10000-0000-4000-8000-000000000002',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM public."Payment" WHERE gig_id='aae10000-0000-4000-8000-000000000101')<>2 THEN RAISE EXCEPTION 'Payee lost financial reads'; END IF;
 BEGIN UPDATE public."Payment" SET amount_total=1 WHERE id='aae10000-0000-4000-8000-000000000302';
 RAISE EXCEPTION 'Payee forged amount'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','aae10000-0000-4000-8000-000000000004',true);
DO $$ BEGIN
 IF EXISTS(SELECT FROM public."Payment" WHERE gig_id='aae10000-0000-4000-8000-000000000101') THEN RAISE EXCEPTION 'Foreign actor read payment'; END IF;
END $$;
RESET ROLE;
DO $$ DECLARE r text; fn regprocedure; BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF has_table_privilege(r,'public."Payment"','INSERT,UPDATE,DELETE,TRUNCATE') THEN RAISE EXCEPTION 'Client retained financial mutation privileges'; END IF;
  FOR fn IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
   AND p.proname IN ('begin_paid_gig_acceptance','accept_free_gig_bid','bind_paid_gig_acceptance','finalize_paid_gig_acceptance',
    'cancel_paid_gig_acceptance','prepare_paid_gig_capture','record_paid_gig_capture','confirm_gig_completion') LOOP
   IF has_function_privilege(r,fn,'EXECUTE') THEN RAISE EXCEPTION 'Client acquired service RPC'; END IF;
  END LOOP;
 END LOOP;
END $$;
-- Confirmation and its existing reliability/bid/in-app records must commit together.
CREATE FUNCTION pg_temp.fail_completion_effect() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME=current_setting('pantopus.confirmation_failure',true) THEN
  RAISE EXCEPTION 'contract forced completion effect failure'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER completion_contract_user BEFORE UPDATE ON public."User" FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_completion_effect();
CREATE TRIGGER completion_contract_bid BEFORE UPDATE ON public."GigBid" FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_completion_effect();
CREATE TRIGGER completion_contract_notice BEFORE INSERT ON public."Notification" FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_completion_effect();
SET LOCAL ROLE service_role;
DO $$
DECLARE g uuid:='aae10000-0000-4000-8000-000000000101'; u uuid:='aae10000-0000-4000-8000-000000000001';
 worker uuid:='aae10000-0000-4000-8000-000000000002'; expected jsonb; r jsonb; receipt jsonb;
 before_payment jsonb; stage text; changed jsonb; note_count integer;
BEGIN
 SELECT to_jsonb(x) INTO expected FROM public."Gig" x WHERE id=g;
 SELECT to_jsonb(x) INTO before_payment FROM public."Payment" x WHERE id=(expected->>'payment_id')::uuid;
 SELECT count(*) INTO note_count FROM public."Notification" WHERE metadata->>'gig_id'=g::text;
 IF public.confirm_gig_completion(g,worker,expected,5,'review')->>'error' IS DISTINCT FROM 'FORBIDDEN' THEN
  RAISE EXCEPTION 'Worker confirmed owner work'; END IF;
 FOREACH stage IN ARRAY ARRAY['worker_completed_at','accepted_at','started_at','payment_id','user_id','accepted_by','price'] LOOP
  changed:=jsonb_set(expected,ARRAY[stage],CASE WHEN stage='price' THEN '99'::jsonb
   WHEN stage IN ('payment_id','user_id','accepted_by') THEN to_jsonb('aae10000-0000-4000-8000-000000000099'::text)
   ELSE to_jsonb('2020-01-01T00:00:00Z'::text) END);
  IF public.confirm_gig_completion(g,u,changed,5,'review')->>'error' IS DISTINCT FROM 'COMPLETION_CHANGED' THEN
   RAISE EXCEPTION 'Changed completion % accepted',stage; END IF;
 END LOOP;
 FOREACH stage IN ARRAY ARRAY['User','GigBid','Notification'] LOOP
  PERFORM set_config('pantopus.confirmation_failure',stage,true);
  BEGIN
   PERFORM public.confirm_gig_completion(g,u,expected,5,'review');
   RAISE EXCEPTION 'Completion effect did not fail';
  EXCEPTION WHEN raise_exception THEN
   IF SQLERRM<>'contract forced completion effect failure' THEN RAISE; END IF;
  END;
  IF (SELECT to_jsonb(x) FROM public."Gig" x WHERE id=g) IS DISTINCT FROM expected
   OR (SELECT coalesce(gigs_completed,0) FROM public."User" WHERE id=worker)<>0
   OR (SELECT status FROM public."GigBid" WHERE id='aae10000-0000-4000-8000-000000000202')<>'pending'
   OR (SELECT count(*) FROM public."Notification" WHERE metadata->>'gig_id'=g::text)<>note_count
   OR (SELECT to_jsonb(x) FROM public."Payment" x WHERE id=(expected->>'payment_id')::uuid) IS DISTINCT FROM before_payment THEN
   RAISE EXCEPTION 'Partial completion survived failed % write',stage; END IF;
 END LOOP;
 PERFORM set_config('pantopus.confirmation_failure','',true);
 -- Capture proof must still be current when confirmation takes the payment lock.
 UPDATE public."Payment" SET refunded_amount=1 WHERE id=(expected->>'payment_id')::uuid;
 IF public.confirm_gig_completion(g,u,expected,5,'review')->>'error' IS DISTINCT FROM 'PAYMENT_NOT_CAPTURED' THEN
  RAISE EXCEPTION 'Refunded capture confirmed'; END IF;
 UPDATE public."Payment" SET refunded_amount=0 WHERE id=(expected->>'payment_id')::uuid;
 r:=public.confirm_gig_completion(g,u,expected,5,'review'); receipt:=r->'gig';
 IF r->>'reused' IS DISTINCT FROM 'false' OR jsonb_array_length(r->'notifications')<>2
  OR receipt->>'owner_confirmed_at' IS NULL OR receipt->>'owner_confirmation_note' IS DISTINCT FROM 'review'
  OR (SELECT coalesce(gigs_completed,0) FROM public."User" WHERE id=worker)<>1
  OR (SELECT status FROM public."GigBid" WHERE id='aae10000-0000-4000-8000-000000000202')<>'rejected'
  OR (SELECT status FROM public."GigBid" WHERE id='aae10000-0000-4000-8000-000000000201')<>'accepted' THEN
  RAISE EXCEPTION 'Confirmation records not committed together: %',r; END IF;
 -- A read notice and a deleted notice are user state, not missing writes to repair.
 UPDATE public."Notification" SET is_read=true WHERE id=(r->'notifications'->0->>'id')::uuid;
 DELETE FROM public."Notification" WHERE id=(r->'notifications'->1->>'id')::uuid;
 r:=public.confirm_gig_completion(g,u,expected,1,'replacement');
 IF r->>'reused' IS DISTINCT FROM 'true' OR r->'gig' IS DISTINCT FROM receipt
  OR r->'notifications' IS DISTINCT FROM '[]'::jsonb
  OR (SELECT coalesce(gigs_completed,0) FROM public."User" WHERE id=worker)<>1
  OR (SELECT count(*) FROM public."Notification" WHERE metadata->>'gig_id'=g::text)<>note_count+1
  OR NOT (SELECT is_read FROM public."Notification" WHERE type='gig_confirmed' AND metadata->>'gig_id'=g::text) THEN
  RAISE EXCEPTION 'Retry changed receipt, count or read/deleted notices'; END IF;
 -- Preserve existing free completion without manufacturing a financial row.
 g:='aae10000-0000-4000-8000-000000000102';u:='aae10000-0000-4000-8000-000000000004';
 UPDATE public."Gig" SET status='completed',accepted_by=worker,worker_completed_at=now() WHERE id=g;
 SELECT to_jsonb(x) INTO expected FROM public."Gig" x WHERE id=g;
 IF public.confirm_gig_completion(g,u,expected,NULL,NULL)->>'error' IS DISTINCT FROM 'PAYMENT_NOT_CAPTURED' THEN
  RAISE EXCEPTION 'Missing paid record confirmed'; END IF;
 UPDATE public."Gig" SET price=0 WHERE id=g;
 SELECT to_jsonb(x) INTO expected FROM public."Gig" x WHERE id=g;
 r:=public.confirm_gig_completion(g,u,expected,NULL,NULL);
 IF r->'gig'->>'owner_confirmed_at' IS NULL OR (SELECT coalesce(gigs_completed,0) FROM public."User" WHERE id=worker)<>2 THEN
  RAISE EXCEPTION 'Free completion failed: %',r; END IF;
END $$;
RESET ROLE;
-- A creator's old business/proxy identity must not outlive current authority.
UPDATE public."User" SET account_type='business' WHERE id='aae10000-0000-4000-8000-000000000004';
INSERT INTO public."BusinessTeam"(business_user_id,user_id,role_base,is_active)
 VALUES('aae10000-0000-4000-8000-000000000004','aae10000-0000-4000-8000-000000000003','staff',true);
INSERT INTO public."BusinessPermissionOverride"(business_user_id,user_id,permission,allowed) VALUES
 ('aae10000-0000-4000-8000-000000000004','aae10000-0000-4000-8000-000000000003','gigs.post',true),
 ('aae10000-0000-4000-8000-000000000004','aae10000-0000-4000-8000-000000000003','gigs.manage',false);
UPDATE public."Gig" SET created_by='aae10000-0000-4000-8000-000000000003',
 beneficiary_user_id='aae10000-0000-4000-8000-000000000004',completion_note='Private business completion'
 WHERE id='aae10000-0000-4000-8000-000000000102';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','aae10000-0000-4000-8000-000000000003',true);
DO $$ DECLARE changed integer; BEGIN
 IF (SELECT count(*) FROM public."Gig" WHERE id='aae10000-0000-4000-8000-000000000102')<>1 THEN
  RAISE EXCEPTION 'Active posting creator lost existing read'; END IF;
 UPDATE public."Gig" SET completion_note='Authorized creator edit' WHERE id='aae10000-0000-4000-8000-000000000102';
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>1 THEN RAISE EXCEPTION 'Active creator lost existing edit'; END IF;
END $$;
RESET ROLE;
UPDATE public."BusinessTeam" SET is_active=false WHERE business_user_id='aae10000-0000-4000-8000-000000000004';
SET LOCAL ROLE authenticated;
DO $$ DECLARE changed integer; BEGIN
 IF EXISTS(SELECT FROM public."Gig" WHERE id='aae10000-0000-4000-8000-000000000102') THEN
  RAISE EXCEPTION 'Revoked creator retained private proof reads'; END IF;
 UPDATE public."Gig" SET completion_note='Revoked creator edit' WHERE id='aae10000-0000-4000-8000-000000000102';
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>0 THEN RAISE EXCEPTION 'Revoked creator retained writes'; END IF;
END $$;
RESET ROLE;
UPDATE public."BusinessTeam" SET is_active=true WHERE business_user_id='aae10000-0000-4000-8000-000000000004';
UPDATE public."BusinessPermissionOverride" SET allowed=false WHERE business_user_id='aae10000-0000-4000-8000-000000000004';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT FROM public."Gig" WHERE id='aae10000-0000-4000-8000-000000000102') THEN
  RAISE EXCEPTION 'Explicitly denied creator retained private proof'; END IF;
 IF public.gig_creator_has_current_authority('aae10000-0000-4000-8000-000000000001') THEN
  RAISE EXCEPTION 'Caller borrowed another owner identity'; END IF;
END $$;
RESET ROLE;
UPDATE public."BusinessPermissionOverride" SET allowed=true
 WHERE business_user_id='aae10000-0000-4000-8000-000000000004' AND permission='gigs.manage';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF (SELECT count(*) FROM public."Gig" WHERE id='aae10000-0000-4000-8000-000000000102')<>1 THEN
  RAISE EXCEPTION 'Current managing creator lost existing read'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','aae10000-0000-4000-8000-000000000004',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM public."Gig" WHERE id='aae10000-0000-4000-8000-000000000102')<>1 THEN
  RAISE EXCEPTION 'Business owner lost proof'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','aae10000-0000-4000-8000-000000000002',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM public."Gig" WHERE id='aae10000-0000-4000-8000-000000000102')<>1 THEN
  RAISE EXCEPTION 'Current worker lost proof'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','aae10000-0000-4000-8000-000000000001',true);
DO $$ BEGIN
 IF EXISTS(SELECT FROM public."Gig" WHERE id='aae10000-0000-4000-8000-000000000102') THEN
  RAISE EXCEPTION 'Unrelated owner acquired business proof'; END IF;
 IF (SELECT count(*) FROM public."Gig" WHERE id='aae10000-0000-4000-8000-000000000101')<>1 THEN
  RAISE EXCEPTION 'Personal owner lost existing read'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE anon;
DO $$ BEGIN
 IF EXISTS(SELECT FROM public."Gig" WHERE id IN('aae10000-0000-4000-8000-000000000101','aae10000-0000-4000-8000-000000000102'))
  OR public.gig_creator_has_current_authority('aae10000-0000-4000-8000-000000000004') THEN
  RAISE EXCEPTION 'Anonymous caller acquired private proof/authority'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT completion_note FROM public."Gig" WHERE id='aae10000-0000-4000-8000-000000000102') IS DISTINCT FROM 'Authorized creator edit' THEN
  RAISE EXCEPTION 'Denied writes changed stored proof'; END IF;
END $$;

-- Worker proof and its existing owner notices commit as one decision.
DO $$ DECLARE role_name text; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF has_function_privilege(role_name,'public.mark_gig_completed(uuid,uuid,jsonb,jsonb)','EXECUTE') THEN
   RAISE EXCEPTION 'Client acquired worker completion transaction'; END IF;
 END LOOP;
END $$;
INSERT INTO public."Gig"(id,user_id,created_by,title,description,price,status,accepted_by,accepted_at,started_at)
VALUES('aae10000-0000-4000-8000-000000000103','aae10000-0000-4000-8000-000000000001',
 'aae10000-0000-4000-8000-000000000001',repeat('x',255),'Worker notice contract',0,'in_progress',
 'aae10000-0000-4000-8000-000000000002','2026-09-14T10:00:00Z','2026-09-14T10:01:00Z');
SET LOCAL ROLE service_role;
DO $$ DECLARE g uuid:='aae10000-0000-4000-8000-000000000103'; w uuid:='aae10000-0000-4000-8000-000000000002';
 expected jsonb; original jsonb; r jsonb; n jsonb; proof jsonb:=
 '{"completion_note":"Private worker proof","completion_photos":["owned-proof-reference"],"completion_checklist":[{"item":"Private checklist","done":true}]}';
BEGIN
 SELECT to_jsonb(x) INTO expected FROM public."Gig" x WHERE id=g;
 IF public.mark_gig_completed(g,'aae10000-0000-4000-8000-000000000001',expected,proof)->>'error' IS DISTINCT FROM 'FORBIDDEN'
  OR public.mark_gig_completed(g,w,expected||'{"price":99}'::jsonb,proof)->>'error' IS DISTINCT FROM 'COMPLETION_CHANGED'
  OR public.mark_gig_completed(g,w,expected,proof||'{"completion_photos":{}}'::jsonb)->>'error' IS DISTINCT FROM 'INVALID_COMPLETION_PROOF' THEN
  RAISE EXCEPTION 'Worker completion accepted invalid authority, terms or proof'; END IF;
 PERFORM set_config('pantopus.confirmation_failure','Notification',true);
 BEGIN
  PERFORM public.mark_gig_completed(g,w,expected,proof);
  RAISE EXCEPTION 'Worker completion notice failure ignored';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'contract forced completion effect failure' THEN RAISE; END IF; END;
 PERFORM set_config('pantopus.confirmation_failure','',true);
 IF (SELECT to_jsonb(x) FROM public."Gig" x WHERE id=g) IS DISTINCT FROM expected
  OR EXISTS(SELECT FROM public."Notification" WHERE metadata->>'gig_id'=g::text) THEN
  RAISE EXCEPTION 'Partial worker completion survived notice failure'; END IF;
 r:=public.mark_gig_completed(g,w,expected,proof);original:=r->'gig';n:=r->'notifications'->0;
 IF r->>'reused' IS DISTINCT FROM 'false' OR original->>'worker_completed_at' IS NULL
  OR jsonb_array_length(r->'notifications')<>1 OR n->>'user_id'<>'aae10000-0000-4000-8000-000000000001'
  OR n->>'type'<>'gig_completed' OR length(n->>'title')<>255
  OR ((n->'metadata')-'gig_completion_delivery_v1') IS DISTINCT FROM jsonb_build_object('gig_id',g,'has_photos',true,'has_note',true)
  OR n->>'context'<>'personal' OR n->>'context_type'<>'personal' THEN
  RAISE EXCEPTION 'Worker completion receipt/notice invalid: %',r; END IF;
 UPDATE public."Notification" SET is_read=true WHERE id=(n->>'id')::uuid;
 r:=public.mark_gig_completed(g,w,expected,proof);
 IF r->>'reused' IS DISTINCT FROM 'true' OR r->'gig' IS DISTINCT FROM original OR r->'notifications'<>'[]'::jsonb
  OR NOT (SELECT is_read FROM public."Notification" WHERE id=(n->>'id')::uuid) THEN
  RAISE EXCEPTION 'Retry changed worker receipt/read notice'; END IF;
 DELETE FROM public."Notification" WHERE id=(n->>'id')::uuid;
 r:=public.mark_gig_completed(g,w,expected,proof);
 IF r->>'reused' IS DISTINCT FROM 'true' OR EXISTS(SELECT FROM public."Notification" WHERE metadata->>'gig_id'=g::text) THEN
  RAISE EXCEPTION 'Retry recreated deleted worker notice'; END IF;
 IF public.mark_gig_completed(g,w,expected,proof||'{"completion_note":"Replacement"}'::jsonb)->>'error'
  IS DISTINCT FROM 'COMPLETION_CHANGED' OR (SELECT to_jsonb(x) FROM public."Gig" x WHERE id=g) IS DISTINCT FROM original THEN
  RAISE EXCEPTION 'Retry replaced the saved proof'; END IF;
END $$;
RESET ROLE;
INSERT INTO public."BusinessTeam"(business_user_id,user_id,role_base,is_active) VALUES
 ('aae10000-0000-4000-8000-000000000004','aae10000-0000-4000-8000-000000000001','owner',false),
 ('aae10000-0000-4000-8000-000000000004','aae10000-0000-4000-8000-000000000002','owner',true);
INSERT INTO public."Gig"(id,user_id,created_by,title,description,price,status,accepted_by)
SELECT ('aae10000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'aae10000-0000-4000-8000-000000000004',
 'aae10000-0000-4000-8000-000000000004','Business worker notice','Synthetic contract',0,'in_progress',
 'aae10000-0000-4000-8000-000000000002' FROM generate_series(104,106) n;
SET LOCAL ROLE service_role;
DO $$ DECLARE g uuid; expected jsonb; r jsonb; step integer; count_expected integer;
 proof jsonb:='{"completion_note":null,"completion_photos":[],"completion_checklist":[]}';
BEGIN
 FOR step IN 104..106 LOOP
  g:=('aae10000-0000-4000-8000-'||lpad(step::text,12,'0'))::uuid;
  IF step=105 THEN UPDATE public."BusinessTeam" SET is_active=false
   WHERE business_user_id='aae10000-0000-4000-8000-000000000004' AND user_id='aae10000-0000-4000-8000-000000000003'; END IF;
  IF step=106 THEN
   UPDATE public."BusinessTeam" SET is_active=true
    WHERE business_user_id='aae10000-0000-4000-8000-000000000004' AND user_id='aae10000-0000-4000-8000-000000000003';
   UPDATE public."BusinessPermissionOverride" SET allowed=false WHERE business_user_id='aae10000-0000-4000-8000-000000000004';
  END IF;
  SELECT to_jsonb(x) INTO expected FROM public."Gig" x WHERE id=g;
  r:=public.mark_gig_completed(g,'aae10000-0000-4000-8000-000000000002',expected,proof);
  count_expected:=CASE WHEN step=104 THEN 2 ELSE 1 END;
  IF jsonb_array_length(r->'notifications') IS DISTINCT FROM count_expected
   OR EXISTS(SELECT FROM public."Notification" WHERE metadata->>'gig_id'=g::text
    AND user_id IN('aae10000-0000-4000-8000-000000000001','aae10000-0000-4000-8000-000000000002')) THEN
   RAISE EXCEPTION 'Completion notice admitted revoked/denied/self recipient or lost current manager: %',r; END IF;
 END LOOP;
END $$;
RESET ROLE;
-- Existing File reservation, authority, quota, publication and cleanup contract.
INSERT INTO auth.users(id,email) SELECT ('aaef0000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 'completion-file-contract-'||n||'@example.invalid' FROM generate_series(1,3) n;
INSERT INTO public."User"(id,email,username,name) SELECT id,email,'completion_file_contract_'||right(id::text,1),'Completion File Contract'
 FROM auth.users WHERE id::text LIKE 'aaef0000-%';
INSERT INTO public."Gig"(id,user_id,created_by,title,description,price,status,accepted_by,accepted_at,started_at)
 VALUES('aaef0000-0000-4000-8000-000000000100','aaef0000-0000-4000-8000-000000000001','aaef0000-0000-4000-8000-000000000001',
 'Private proof contract','Synthetic only',0,'in_progress','aaef0000-0000-4000-8000-000000000002','2026-09-15T00:00:00Z','2026-09-15T00:01:00Z');
SET LOCAL ROLE service_role;
DO $$
DECLARE g uuid:='aaef0000-0000-4000-8000-000000000100'; worker uuid:='aaef0000-0000-4000-8000-000000000002';
 owner_id uuid:='aaef0000-0000-4000-8000-000000000001'; foreign_id uuid:='aaef0000-0000-4000-8000-000000000003';
 fid uuid:='aaef0000-0000-4000-8000-000000000200'; other_fid uuid:='aaef0000-0000-4000-8000-000000000201';
 body jsonb:=jsonb_build_object('sha256',repeat('a',64),'bucket','test-private-completion','mime_type','text/plain','file_size',32,'file_name','proof.txt');
 r jsonb; f public."File"%ROWTYPE; quota bigint; terms jsonb; proof jsonb; claim uuid; raw record;
BEGIN
 IF public.mutate_gig_completion_file(g,owner_id,fid,'reserve',body)->>'error' IS DISTINCT FROM 'FORBIDDEN'
  OR public.mutate_gig_completion_file(g,foreign_id,fid,'reserve',body)->>'error' IS DISTINCT FROM 'FORBIDDEN' THEN RAISE EXCEPTION 'Nonworker reserved proof'; END IF;
 r:=public.mutate_gig_completion_file(g,worker,fid,'reserve',body);
 IF r->'file'->>'processing_status' IS DISTINCT FROM 'uploading' THEN RAISE EXCEPTION 'Proof was not reserved: %',r; END IF;
 SELECT * INTO f FROM public."File" WHERE id=fid;
 SELECT storage_used INTO quota FROM public."FileQuota" WHERE user_id=worker;
 IF quota<>32 THEN RAISE EXCEPTION 'Reservation did not account bytes'; END IF;
 r:=public.mutate_gig_completion_file(g,worker,fid,'reserve',body||'{"file_name":"renamed-retry.txt"}');
 IF r->'file'->>'id' IS DISTINCT FROM fid::text OR (SELECT storage_used FROM public."FileQuota" WHERE user_id=worker)<>quota THEN RAISE EXCEPTION 'Retry repeated quota'; END IF;
 IF public.mutate_gig_completion_file(g,worker,fid,'reserve',body||'{"file_size":33}')->>'error' IS DISTINCT FROM 'COMPLETION_FILE_CHANGED' THEN RAISE EXCEPTION 'Replacement bytes admitted'; END IF;
 IF public.get_gig_completion_file(g,worker,fid)->>'error' IS DISTINCT FROM 'NOT_FOUND' THEN RAISE EXCEPTION 'Unready proof readable'; END IF;
 IF public.soft_delete_file(fid,worker)->>'success' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Generic delete retired private proof'; END IF;
 BEGIN UPDATE public."File" SET visibility='public' WHERE id=fid; RAISE EXCEPTION 'Public proof allowed'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN UPDATE public."File" SET file_path='other' WHERE id=fid; RAISE EXCEPTION 'Private path replacement allowed'; EXCEPTION WHEN check_violation THEN NULL; END;
 UPDATE public."FileQuota" SET max_files=1 WHERE user_id=worker;
 BEGIN PERFORM public.mutate_gig_completion_file(g,worker,other_fid,'reserve',body); RAISE EXCEPTION 'Quota bypassed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'FILE_QUOTA_EXCEEDED' THEN RAISE; END IF; END;
 IF EXISTS(SELECT FROM public."File" WHERE id=other_fid) THEN RAISE EXCEPTION 'Denied quota left reservation'; END IF;
 UPDATE public."FileQuota" SET max_files=1000 WHERE user_id=worker;
 UPDATE public."Gig" SET started_at=started_at+interval '1 second' WHERE id=g;
 IF public.mutate_gig_completion_file(g,worker,fid,'finalize')->>'error' IS DISTINCT FROM 'COMPLETION_FILE_CHANGED' THEN RAISE EXCEPTION 'Changed assignment finalized proof'; END IF;
 UPDATE public."Gig" SET started_at=started_at-interval '1 second' WHERE id=g;
 r:=public.mutate_gig_completion_file(g,worker,fid,'finalize');
 IF r->'file'->>'processing_status' IS DISTINCT FROM 'completed' THEN RAISE EXCEPTION 'Proof finalize failed: %',r; END IF;
 IF public.get_gig_completion_file(g,worker,fid)->'file'->>'id' IS DISTINCT FROM fid::text
  OR public.get_gig_completion_file(g,owner_id,fid)->>'error' IS DISTINCT FROM 'FORBIDDEN'
  OR public.get_gig_completion_file(g,foreign_id,fid)->>'error' IS DISTINCT FROM 'FORBIDDEN' THEN RAISE EXCEPTION 'Unsubmitted proof access incorrect'; END IF;
 SELECT jsonb_build_object('user_id',user_id,'accepted_by',accepted_by,'price',price,'payment_id',payment_id,'accepted_at',accepted_at,'started_at',started_at) INTO terms FROM public."Gig" WHERE id=g;
 proof:=jsonb_build_object('completion_note','Synthetic proof','completion_photos',jsonb_build_array(f.file_url),'completion_checklist','[]'::jsonb);
 r:=public.mark_gig_completed(g,worker,terms,proof);
 IF r->'gig'->>'status' IS DISTINCT FROM 'completed' THEN RAISE EXCEPTION 'Private proof not bound to completion: %',r; END IF;
 IF public.get_gig_completion_file(g,owner_id,fid)->'file'->>'id' IS DISTINCT FROM fid::text THEN RAISE EXCEPTION 'Owner cannot review saved proof'; END IF;
 -- Reopening with identical photo strings must still bind the original assignment.
 UPDATE public."Gig" SET status='in_progress',worker_completed_at=NULL,started_at=started_at+interval '1 second' WHERE id=g;
 SELECT jsonb_build_object('user_id',user_id,'accepted_by',accepted_by,'price',price,'payment_id',payment_id,'accepted_at',accepted_at,'started_at',started_at) INTO terms FROM public."Gig" WHERE id=g;
 BEGIN PERFORM public.mark_gig_completed(g,worker,terms,proof); RAISE EXCEPTION 'Unchanged proof strings bypassed assignment binding'; EXCEPTION WHEN check_violation THEN NULL; END;
 UPDATE public."Gig" SET status='completed',worker_completed_at=(r->'gig'->>'worker_completed_at')::timestamptz,started_at=started_at-interval '1 second' WHERE id=g;
 UPDATE public."File" SET updated_at=clock_timestamp()-interval '2 days' WHERE id=fid;
 IF public.claim_gig_completion_file_cleanup(fid,'test-private-completion') IS NOT NULL THEN RAISE EXCEPTION 'Saved proof cleanup admitted'; END IF;
 IF public.mutate_gig_completion_file(g,worker,fid,'reserve',body)->>'reused' IS DISTINCT FROM 'true'
  OR public.mutate_gig_completion_file(g,worker,other_fid,'reserve',body)->>'error' IS DISTINCT FROM 'COMPLETION_FILE_CHANGED' THEN RAISE EXCEPTION 'Completed upload recovery/replacement incorrect'; END IF;
 UPDATE public."Gig" SET accepted_by=foreign_id WHERE id=g;
 IF public.get_gig_completion_file(g,worker,fid)->>'error' IS DISTINCT FROM 'FORBIDDEN' THEN RAISE EXCEPTION 'Former worker still reads proof'; END IF;
 UPDATE public."Gig" SET accepted_by=worker WHERE id=g;
 -- Preserve a separate private File through both parent cascades and delayed cleanup.
 INSERT INTO public."File"(id,user_id,gig_id,filename,original_filename,file_path,file_url,file_size,mime_type,file_extension,file_type,file_context,visibility,processing_status,is_deleted,created_at,updated_at,metadata)
 SELECT other_fid,user_id,gig_id,filename,original_filename,replace(file_path,fid::text,other_fid::text),replace(file_url,fid::text,other_fid::text),file_size,mime_type,file_extension,file_type,file_context,visibility,'uploading',false,
  clock_timestamp()-interval '2 days',clock_timestamp()-interval '2 days',metadata FROM public."File" WHERE id=fid;
 r:=public.claim_gig_completion_file_cleanup(other_fid,'test-private-completion'); claim:=(r->'metadata'->>'storage_cleanup_claim')::uuid;
 IF r->>'is_deleted' IS DISTINCT FROM 'true' OR claim IS NULL THEN RAISE EXCEPTION 'Expired unused proof not retired'; END IF;
 IF public.finish_gig_completion_file_cleanup(other_fid,gen_random_uuid(),true) THEN RAISE EXCEPTION 'Foreign cleanup claim accepted'; END IF;
 IF NOT public.finish_gig_completion_file_cleanup(other_fid,claim,false) THEN RAISE EXCEPTION 'Failed cleanup not retained'; END IF;
 IF (SELECT storage_used FROM public."FileQuota" WHERE user_id=worker)<>quota THEN RAISE EXCEPTION 'Retirement quota incorrect'; END IF;
 BEGIN DELETE FROM public."File" WHERE id=other_fid; RAISE EXCEPTION 'Cleanup tombstone deleted'; EXCEPTION WHEN check_violation THEN NULL; END;
 DELETE FROM public."Gig" WHERE id=g;
 SELECT * INTO f FROM public."File" WHERE id=fid;
 IF NOT f.is_deleted OR f.gig_id IS NOT NULL OR f.metadata->>'storage_cleanup_pending' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Gig cascade lost cleanup identity'; END IF;
 DELETE FROM public."User" WHERE id=worker;
 IF (SELECT user_id FROM public."File" WHERE id=fid) IS NOT NULL OR (SELECT count(*) FROM public."File" WHERE id IN(fid,other_fid))<>2 THEN RAISE EXCEPTION 'User cascade lost tombstones'; END IF;
 FOR raw IN SELECT oid::regprocedure signature FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('mutate_gig_completion_file','get_gig_completion_file',
  'gig_completion_file_cleanup_candidates','claim_gig_completion_file_cleanup','finish_gig_completion_file_cleanup') LOOP
  IF has_function_privilege('authenticated',raw.signature,'EXECUTE') OR has_function_privilege('anon',raw.signature,'EXECUTE') THEN RAISE EXCEPTION 'Completion storage routine exposed'; END IF;
 END LOOP;
END $$;
RESET ROLE;
INSERT INTO public."Gig"(id,user_id,created_by,title,description,price,status,accepted_by) VALUES
 ('aaef0000-0000-4000-8000-000000000101','aaef0000-0000-4000-8000-000000000001','aaef0000-0000-4000-8000-000000000001',
 'Raw private File denial','Synthetic only',0,'in_progress','aaef0000-0000-4000-8000-000000000003');
SELECT public.mutate_gig_completion_file('aaef0000-0000-4000-8000-000000000101','aaef0000-0000-4000-8000-000000000003',
 'aaef0000-0000-4000-8000-000000000202','reserve',jsonb_build_object('sha256',repeat('b',64),'bucket','test-private-completion','mime_type','text/plain','file_size',32,'file_name','proof.txt'));
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','aaef0000-0000-4000-8000-000000000003',true);
DO $$ BEGIN IF EXISTS(SELECT FROM public."File" WHERE metadata->>'storage_contract'='gig_completion_v1') THEN RAISE EXCEPTION 'Raw private File exposed'; END IF; END $$;
RESET ROLE;

-- Completion delivery reuses the exact existing Notification and queue worker.
INSERT INTO auth.users(id,email) SELECT ('aaf40000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 'completion-delivery-'||n||'@example.invalid' FROM generate_series(1,3) n;
INSERT INTO public."User"(id,email,username,name) SELECT id,email,'completion_delivery_'||right(id::text,1),'Delivery fixture'
 FROM auth.users WHERE id::text LIKE 'aaf40000-%';
INSERT INTO public."MailPreferences"(user_id,push_notifications)
 VALUES('aaf40000-0000-4000-8000-000000000001',false),('aaf40000-0000-4000-8000-000000000002',true);
INSERT INTO public."Gig"(id,user_id,created_by,title,description,price,status,accepted_by,accepted_at,started_at)
 VALUES('aaf40000-0000-4000-8000-000000000100','aaf40000-0000-4000-8000-000000000001','aaf40000-0000-4000-8000-000000000001',
 'Delivery fixture','Synthetic',0,'in_progress','aaf40000-0000-4000-8000-000000000002',clock_timestamp(),clock_timestamp());
INSERT INTO public."GigBid"(id,gig_id,user_id,bid_amount,status)
 VALUES('aaf40000-0000-4000-8000-000000000200','aaf40000-0000-4000-8000-000000000100','aaf40000-0000-4000-8000-000000000003',0,'pending');
DO $$
DECLARE g public."Gig"; owner_id uuid:='aaf40000-0000-4000-8000-000000000001'; worker uuid:='aaf40000-0000-4000-8000-000000000002';
 r jsonb; terms jsonb; proof jsonb:='{"completion_note":"private completion note","completion_photos":[],"completion_checklist":[]}';
 n public."Notification"; event jsonb; lease uuid; old_lease uuid; original_hash text; rec record;
BEGIN
 -- Retire only earlier synthetic notices created by this contract so its queue
 -- assertions do not consume unrelated database work. The whole contract rolls back.
 PERFORM set_config('app.gig_completion_delivery','on',true);
 UPDATE public."Notification" SET metadata=jsonb_set(metadata,'{gig_completion_delivery_v1,state}','"done"')
 WHERE metadata ? 'gig_completion_delivery_v1' AND (metadata->>'gig_id' LIKE 'aae10000-%' OR metadata->>'gig_id' LIKE 'aaef0000-%');
 PERFORM set_config('app.gig_completion_delivery','off',true);
 SELECT * INTO g FROM public."Gig" WHERE id='aaf40000-0000-4000-8000-000000000100';
 terms:=jsonb_build_object('user_id',g.user_id,'accepted_by',g.accepted_by,'price',g.price,'payment_id',g.payment_id,'accepted_at',g.accepted_at,'started_at',g.started_at);
 r:=public.mark_gig_completed(g.id,worker,terms,proof); SELECT * INTO n FROM public."Notification" WHERE id=(r->'notifications'->0->>'id')::uuid;
 IF n.metadata->'gig_completion_delivery_v1'->>'state' IS DISTINCT FROM 'pending'
  OR n.metadata->'gig_completion_delivery_v1'->>'push_allowed_at_completion' IS DISTINCT FROM 'false'
  OR n.metadata::text LIKE '%private completion note%' OR n.metadata::text LIKE '%payment_id%' THEN RAISE EXCEPTION 'Completion delivery receipt missing or private values disclosed'; END IF;
 UPDATE public."MailPreferences" SET push_notifications=true WHERE user_id=owner_id;
 event:=public.claim_gig_completion_delivery(); lease:=(event->>'lease_id')::uuid;
 IF event->>'id' IS DISTINCT FROM n.id::text THEN RAISE EXCEPTION 'Wrong completion delivery selected'; END IF;
 r:=public.read_gig_completion_delivery(n.id,lease);
 IF r->>'eligible' IS DISTINCT FROM 'true' OR r->>'pushAllowedAtCompletion' IS DISTINCT FROM 'false'
  OR r->'notification'->'metadata' ? 'gig_completion_delivery_v1' THEN RAISE EXCEPTION 'Consent or safe transport projection changed'; END IF;
 UPDATE public."Notification" SET is_read=true WHERE id=n.id;
 IF public.read_gig_completion_delivery(n.id,lease)->>'eligible' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Read state invalidated original notice'; END IF;
 SELECT public.gig_completion_delivery_terms(x,'worker') INTO original_hash FROM public."Gig" x WHERE id=g.id;
 PERFORM set_config('TimeZone','America/Los_Angeles',true);
 IF (SELECT public.gig_completion_delivery_terms(x,'worker') FROM public."Gig" x WHERE id=g.id)<>original_hash THEN RAISE EXCEPTION 'Timezone changed completion binding'; END IF;
 PERFORM set_config('TimeZone','UTC',true);
 IF public.finish_gig_completion_delivery(n.id,gen_random_uuid(),'done') THEN RAISE EXCEPTION 'Foreign delivery lease accepted'; END IF;
 IF NOT public.finish_gig_completion_delivery(n.id,lease,'retry','synthetic unknown') THEN RAISE EXCEPTION 'Unknown delivery lost'; END IF;
 IF public.claim_gig_completion_delivery() IS NOT NULL THEN RAISE EXCEPTION 'Backoff ignored'; END IF;
 PERFORM set_config('app.gig_completion_delivery','on',true);
 UPDATE public."Notification" SET metadata=jsonb_set(metadata,'{gig_completion_delivery_v1,retry_at}',to_jsonb(clock_timestamp()-interval '1 second')) WHERE id=n.id;
 PERFORM set_config('app.gig_completion_delivery','off',true);
 event:=public.claim_gig_completion_delivery(); old_lease:=lease;lease:=(event->>'lease_id')::uuid;
 IF event->>'id'<>n.id::text OR old_lease=lease OR public.read_gig_completion_delivery(n.id,old_lease)->>'error' IS DISTINCT FROM 'LEASE_LOST' THEN RAISE EXCEPTION 'Retry lease identity invalid'; END IF;
 IF NOT public.finish_gig_completion_delivery(n.id,lease,'done') THEN RAISE EXCEPTION 'Matching delivery did not finish'; END IF;
 r:=public.mark_gig_completed(g.id,worker,terms,proof);
 IF r->>'reused' IS DISTINCT FROM 'true' OR jsonb_array_length(r->'notifications')<>0
  OR (SELECT is_read FROM public."Notification" WHERE id=n.id) IS DISTINCT FROM true
  OR public.claim_gig_completion_delivery() IS NOT NULL THEN RAISE EXCEPTION 'Completion retry recreated delivery'; END IF;
 -- Raw recipients may mark read/delete but cannot forge or erase queue state.
 PERFORM set_config('request.jwt.claim.sub',owner_id::text,true); SET LOCAL ROLE authenticated;
 UPDATE public."Notification" SET is_read=false WHERE id=n.id;
 BEGIN UPDATE public."Notification" SET metadata=metadata-'gig_completion_delivery_v1' WHERE id=n.id;
  RAISE EXCEPTION 'Recipient erased delivery contract'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RESET ROLE;
 -- Owner confirmation makes the earlier review request obsolete and queues
 -- both the worker confirmation and the already-closed standby bid notice.
 SELECT * INTO g FROM public."Gig" WHERE id=g.id;
 terms:=terms||jsonb_build_object('worker_completed_at',g.worker_completed_at);
 r:=public.confirm_gig_completion(g.id,owner_id,terms,NULL,NULL);
 IF jsonb_array_length(r->'notifications')<>2 THEN RAISE EXCEPTION 'Owner completion did not retain both notices'; END IF;
 FOR rec IN SELECT * FROM public."Notification" WHERE metadata->>'gig_id'=g.id::text AND type IN ('gig_confirmed','bid_rejected') ORDER BY created_at,id LOOP
  event:=public.claim_gig_completion_delivery();lease:=(event->>'lease_id')::uuid;
  IF event->>'id'<>rec.id::text OR public.read_gig_completion_delivery(rec.id,lease)->>'eligible' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Confirmed notification unavailable'; END IF;
  IF rec.type='bid_rejected' THEN
   UPDATE public."GigBid" SET status='pending' WHERE id='aaf40000-0000-4000-8000-000000000200';
   IF public.read_gig_completion_delivery(rec.id,lease)->>'eligible' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Reopened bid received stale rejection'; END IF;
  ELSE
   UPDATE public."Notification" SET metadata=metadata||'{"gig_id":"malformed"}' WHERE id=rec.id;
   IF public.read_gig_completion_delivery(rec.id,lease)->>'eligible' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Changed notice admitted'; END IF;
  END IF;
  DELETE FROM public."Notification" WHERE id=rec.id;
  IF public.read_gig_completion_delivery(rec.id,lease)->>'error' IS DISTINCT FROM 'LEASE_LOST'
   OR NOT public.finish_gig_completion_delivery(rec.id,lease,'retry') THEN RAISE EXCEPTION 'Deleted notice was not canceled'; END IF;
 END LOOP;
 INSERT INTO public."Notification"(user_id,type,title,metadata) VALUES(owner_id,'gig_completed','Historical notice',jsonb_build_object('gig_id',g.id)) RETURNING * INTO n;
 IF n.metadata ? 'gig_completion_delivery_v1' THEN RAISE EXCEPTION 'Historical notification was queued'; END IF;
 FOR rec IN SELECT oid::regprocedure signature FROM pg_proc WHERE pronamespace='public'::regnamespace
  AND proname IN ('claim_gig_completion_delivery','read_gig_completion_delivery','finish_gig_completion_delivery') LOOP
  IF has_function_privilege('authenticated',rec.signature,'EXECUTE') OR has_function_privilege('anon',rec.signature,'EXECUTE') THEN RAISE EXCEPTION 'Completion delivery routine exposed'; END IF;
 END LOOP;
END $$;

-- Existing Home maintenance contract and atomic completion history.
RESET ROLE;
INSERT INTO auth.users(id,email) SELECT ('aafa0000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 'completion-history-'||n||'@example.invalid' FROM generate_series(1,3)n;
INSERT INTO public."User"(id,email,username,name) SELECT id,email,'completion_history_'||right(id::text,1),'History fixture'
 FROM auth.users WHERE id::text LIKE 'aafa0000-%';
INSERT INTO public."Home"(id,owner_id,created_by_user_id,address,city,state,zipcode) VALUES
 ('aafa0000-0000-4000-8000-000000000300','aafa0000-0000-4000-8000-000000000001','aafa0000-0000-4000-8000-000000000001','History fixture','Test','WA','98607');
INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status) VALUES
 ('aafa0000-0000-4000-8000-000000000300','aafa0000-0000-4000-8000-000000000001','owner','owner','adult','verified');
INSERT INTO public."Gig"(id,user_id,created_by,title,description,price,status,accepted_by,worker_completed_at,origin_home_id)
 SELECT ('aafa0000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'aafa0000-0000-4000-8000-000000000001',
 'aafa0000-0000-4000-8000-000000000001','Original maintenance work','Synthetic',0,'completed',
 'aafa0000-0000-4000-8000-000000000002',clock_timestamp(),'aafa0000-0000-4000-8000-000000000300' FROM generate_series(100,107)n;
SET LOCAL ROLE service_role;
DO $$ DECLARE g public."Gig"; h public."HomeMaintenanceLog"; r jsonb; terms jsonb; n integer; mode text;
 owner_id uuid:='aafa0000-0000-4000-8000-000000000001'; fixture_home uuid:='aafa0000-0000-4000-8000-000000000300';
BEGIN
 SELECT * INTO g FROM public."Gig" WHERE id='aafa0000-0000-4000-8000-000000000100';
 terms:=jsonb_build_object('user_id',g.user_id,'accepted_by',g.accepted_by,'price',g.price,'payment_id',g.payment_id,
  'accepted_at',g.accepted_at,'started_at',g.started_at,'worker_completed_at',g.worker_completed_at);
 r:=public.confirm_gig_completion(g.id,owner_id,terms,5,'Reviewed');
 IF r->'gig'->>'owner_confirmed_at' IS NULL THEN RAISE EXCEPTION 'Home completion failed: %',r; END IF;
 SELECT * INTO h FROM public."HomeMaintenanceLog" WHERE gig_id=g.id;
 IF h.id IS NULL OR h.home_id<>fixture_home OR h.task<>g.title OR h.cost<>g.price OR h.performed_by<>g.accepted_by
  OR h.created_by<>owner_id OR h.performed_at<>(r->'gig'->>'owner_confirmed_at')::timestamptz
  OR h.status<>'completed' OR h.recurrence<>'one_time' THEN RAISE EXCEPTION 'Incomplete Home receipt'; END IF;
 IF EXISTS(SELECT FROM public."HomeSystem" WHERE home_id=fixture_home) THEN RAISE EXCEPTION 'Completion guessed system installation'; END IF;
 PERFORM public.confirm_gig_completion(g.id,owner_id,terms,NULL,NULL);
 IF (SELECT count(*) FROM public."HomeMaintenanceLog" WHERE gig_id=g.id)<>1 THEN RAISE EXCEPTION 'Duplicated history'; END IF;
 BEGIN UPDATE public."HomeMaintenanceLog" SET created_by='aafa0000-0000-4000-8000-000000000003' WHERE id=h.id; RAISE EXCEPTION 'History recorder rewritten'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE public."HomeMaintenanceLog" SET created_at='2000-01-01' WHERE id=h.id; RAISE EXCEPTION 'History recording backdated'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE public."HomeMaintenanceLog" SET cost=100 WHERE id=h.id; RAISE EXCEPTION 'History amount was rewritten'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE public."HomeMaintenanceLog" SET home_id='aafa0000-0000-4000-8000-000000000999' WHERE id=h.id; RAISE EXCEPTION 'History Home was rewritten'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE public."HomeMaintenanceLog" SET notes='Resident annotation' WHERE id=h.id;
 DELETE FROM public."HomeMaintenanceLog" WHERE id=h.id;
 PERFORM public.confirm_gig_completion(g.id,owner_id,terms,NULL,NULL);
 IF EXISTS(SELECT FROM public."HomeMaintenanceLog" WHERE gig_id=g.id) THEN RAISE EXCEPTION 'Deleted history recreated'; END IF;
 n:=101;
 FOREACH mode IN ARRAY ARRAY['foreign','denied','revoked','minor','frozen','historical','private_source'] LOOP
  SELECT * INTO g FROM public."Gig" WHERE id=('aafa0000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
  IF mode='foreign' THEN UPDATE public."Home" SET owner_id='aafa0000-0000-4000-8000-000000000003' WHERE id=fixture_home;
   UPDATE public."HomeOccupancy" SET user_id='aafa0000-0000-4000-8000-000000000003' WHERE home_id=fixture_home;
  ELSIF mode='denied' THEN INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(fixture_home,owner_id,'maintenance.edit',false);
  ELSIF mode='revoked' THEN UPDATE public."HomeOccupancy" SET verification_status='revoked' WHERE home_id=fixture_home;
  ELSIF mode='minor' THEN UPDATE public."HomeOccupancy" SET age_band='teen' WHERE home_id=fixture_home;
  ELSIF mode='frozen' THEN UPDATE public."Home" SET security_state='frozen' WHERE id=fixture_home;
  ELSIF mode='historical' THEN UPDATE public."Gig" SET owner_confirmed_at=clock_timestamp() WHERE id=g.id;
  ELSIF mode='private_source' THEN UPDATE public."Gig" SET origin_home_id=NULL WHERE id=g.id;
  END IF;
  terms:=jsonb_build_object('user_id',g.user_id,'accepted_by',g.accepted_by,'price',g.price,'payment_id',g.payment_id,
   'accepted_at',g.accepted_at,'started_at',g.started_at,'worker_completed_at',g.worker_completed_at);
  r:=public.confirm_gig_completion(g.id,owner_id,terms,NULL,NULL);
  IF r->'gig'->>'owner_confirmed_at' IS NULL THEN RAISE EXCEPTION 'Home history suppression blocked gig: %',r; END IF;
  IF EXISTS(SELECT FROM public."HomeMaintenanceLog" WHERE gig_id=g.id) THEN RAISE EXCEPTION 'Unauthorized or historical Home provenance: %',mode; END IF;
  UPDATE public."Home" SET owner_id='aafa0000-0000-4000-8000-000000000001',security_state='normal' WHERE id=fixture_home;
  UPDATE public."HomeOccupancy" SET user_id=owner_id,verification_status='verified',age_band='adult' WHERE home_id=fixture_home;
  DELETE FROM public."HomePermissionOverride" WHERE home_id=fixture_home;
  n:=n+1;
 END LOOP;
 -- FK erasure preserves the historical row while removing deleted identity.
 INSERT INTO public."Gig"(id,user_id,created_by,title,description,price,status,accepted_by,worker_completed_at,origin_home_id)
 VALUES('aafa0000-0000-4000-8000-000000000108',owner_id,owner_id,'Retained history','Synthetic',0,'completed',
 'aafa0000-0000-4000-8000-000000000002',clock_timestamp(),fixture_home) RETURNING * INTO g;
 terms:=jsonb_build_object('user_id',g.user_id,'accepted_by',g.accepted_by,'price',g.price,'payment_id',g.payment_id,
  'accepted_at',g.accepted_at,'started_at',g.started_at,'worker_completed_at',g.worker_completed_at);
 PERFORM public.confirm_gig_completion(g.id,owner_id,terms,NULL,NULL);
 DELETE FROM public."User" WHERE id=g.accepted_by;
 IF NOT EXISTS(SELECT FROM public."HomeMaintenanceLog" WHERE gig_id=g.id AND performed_by IS NULL) THEN RAISE EXCEPTION 'Worker deletion did not erase historical identity'; END IF;
 SELECT * INTO h FROM public."HomeMaintenanceLog" WHERE gig_id=g.id;
 DELETE FROM public."Gig" WHERE id=g.id;
 IF NOT EXISTS(SELECT FROM public."HomeMaintenanceLog" WHERE id=h.id AND gig_id IS NULL AND task='Retained history') THEN RAISE EXCEPTION 'Gig erasure lost historical maintenance'; END IF;
END $$;
-- A direct recipient cannot fabricate provenance, even for a Home they own.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','aafa0000-0000-4000-8000-000000000001',true);
DO $$ BEGIN
 BEGIN
  INSERT INTO public."HomeMaintenanceLog"(home_id,task,gig_id) VALUES('aafa0000-0000-4000-8000-000000000300','Fabricated','aafa0000-0000-4000-8000-000000000100');
  RAISE EXCEPTION 'Raw actor fabricated Gig history';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
