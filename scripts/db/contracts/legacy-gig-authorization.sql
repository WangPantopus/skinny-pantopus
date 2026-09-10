BEGIN;
INSERT INTO auth.users(id,email) VALUES
 ('aafb0000-0000-4000-8000-000000000001','legacy-auth-payer@example.invalid'),
 ('aafb0000-0000-4000-8000-000000000002','legacy-auth-worker@example.invalid'),
 ('aafb0000-0000-4000-8000-000000000003','legacy-auth-foreign@example.invalid');
INSERT INTO public."User"(id,email,username,name) SELECT id,email,'legacy_auth_'||right(id::text,1),'Legacy authorization'
 FROM auth.users WHERE id::text LIKE 'aafb0000-%';
INSERT INTO public."Gig"(id,user_id,created_by,title,description,price,status,accepted_by,scheduled_start)
SELECT ('aafb0000-0000-4000-8000-0000000001'||lpad(i::text,2,'0'))::uuid,'aafb0000-0000-4000-8000-000000000001',
 'aafb0000-0000-4000-8000-000000000001','Legacy authorization','Synthetic',10,'assigned','aafb0000-0000-4000-8000-000000000002',now()+interval '1 hour'
FROM generate_series(1,14) i;
INSERT INTO public."Payment"(id,gig_id,payer_id,payee_id,amount_total,amount_subtotal,amount_platform_fee,amount_to_payee,
 stripe_customer_id,stripe_payment_intent_id,stripe_payment_method_id,payment_status)
SELECT ('aafb0000-0000-4000-8000-0000000003'||lpad(i::text,2,'0'))::uuid,('aafb0000-0000-4000-8000-0000000001'||lpad(i::text,2,'0'))::uuid,
 'aafb0000-0000-4000-8000-000000000001','aafb0000-0000-4000-8000-000000000002',1000,1000,150,850,
 'cus_legacy',CASE WHEN i=1 THEN 'pi_legacy' ELSE NULL END,'pm_legacy','ready_to_authorize' FROM generate_series(1,14) i;
UPDATE public."Gig" g SET payment_id=p.id,payment_status=p.payment_status FROM public."Payment" p WHERE p.gig_id=g.id AND g.id::text LIKE 'aafb0000-%';
CREATE FUNCTION pg_temp.legacy_begin(i integer,replace_intent boolean DEFAULT false) RETURNS jsonb LANGUAGE sql AS $$
 SELECT public.begin_legacy_gig_authorization(('aafb0000-0000-4000-8000-0000000001'||lpad(i::text,2,'0'))::uuid,
 'aafb0000-0000-4000-8000-000000000001',false,replace_intent)
$$;
CREATE FUNCTION pg_temp.legacy_record(i integer,d jsonb,status text,intent text) RETURNS jsonb LANGUAGE sql AS $$
 SELECT public.record_legacy_gig_authorization(('aafb0000-0000-4000-8000-0000000001'||lpad(i::text,2,'0'))::uuid,
 'aafb0000-0000-4000-8000-000000000001',(d->'attempt'->>'id')::uuid,(d->'attempt'->>'verified_at')::timestamptz,
 jsonb_build_object('id',intent,'attempt_id',d->'attempt'->>'id','customer','cus_legacy','amount',1000,'currency','usd',
 'capture_method','manual','amount_capturable',CASE WHEN status='requires_capture' THEN 1000 ELSE 0 END,
 'payer_id','aafb0000-0000-4000-8000-000000000001','payee_id','aafb0000-0000-4000-8000-000000000002',
 'gig_id','aafb0000-0000-4000-8000-0000000001'||lpad(i::text,2,'0'),'status',status))
$$;
SET LOCAL ROLE service_role;
DO $$ DECLARE d jsonb; ready jsonb; replacement jsonb; gig_revision timestamptz; p public."Payment"%ROWTYPE; BEGIN
 d:=pg_temp.legacy_begin(1);
 IF d->'attempt'->>'intent_id'<>'pi_legacy' OR d->'attempt'->>'adopted'<>'true' THEN RAISE EXCEPTION 'Existing intent not adopted'; END IF;
 IF pg_temp.legacy_begin(1)->'attempt'->>'id' IS DISTINCT FROM d->'attempt'->>'id' THEN RAISE EXCEPTION 'Retry replaced operation'; END IF;
 IF pg_temp.legacy_begin(1,true)->>'error' IS DISTINCT FROM 'TERMINAL_PROOF_REQUIRED' THEN RAISE EXCEPTION 'Replaced live intent'; END IF;
 ready:=pg_temp.legacy_record(1,d,'requires_capture','pi_legacy');
 IF ready->'payment'->>'payment_status' IS DISTINCT FROM 'authorized' THEN RAISE EXCEPTION 'Exact hold was not recorded'; END IF;
 SELECT updated_at INTO gig_revision FROM public."Gig" WHERE id='aafb0000-0000-4000-8000-000000000101';
 ready:=pg_temp.legacy_record(1,ready,'requires_capture','pi_legacy');
 IF ready ? 'error' OR (SELECT updated_at FROM public."Gig" WHERE id='aafb0000-0000-4000-8000-000000000101') IS DISTINCT FROM gig_revision THEN RAISE EXCEPTION 'Unchanged proof manufactured a Gig revision'; END IF;
 IF pg_temp.legacy_record(1,d,'requires_action','pi_legacy')->>'error' IS DISTINCT FROM 'INVALID_PROOF' THEN RAISE EXCEPTION 'Late receipt downgraded hold'; END IF;
 d:=pg_temp.legacy_record(1,ready,'canceled','pi_legacy');
 replacement:=pg_temp.legacy_begin(1,true);
 IF replacement ? 'error' OR replacement->'attempt'->>'id'=d->'attempt'->>'id' THEN RAISE EXCEPTION 'Canceled proof cannot replace'; END IF;
 IF (SELECT count(*) FROM public."GigLegacyAuthorization" WHERE payment_id='aafb0000-0000-4000-8000-000000000301')<>2
  OR (SELECT count(*) FROM public."GigLegacyAuthorization" WHERE payment_id='aafb0000-0000-4000-8000-000000000301' AND superseded)<>1 THEN RAISE EXCEPTION 'History lost'; END IF;
 d:=pg_temp.legacy_record(1,replacement,'requires_confirmation','pi_replacement');
 IF d->'payment'->>'stripe_payment_intent_id' IS DISTINCT FROM 'pi_replacement' THEN RAISE EXCEPTION 'Replacement not bound'; END IF;
 SELECT * INTO p FROM public."Payment" WHERE id='aafb0000-0000-4000-8000-000000000301';
 IF p.amount_total<>1000 OR p.amount_to_payee<>850 OR p.amount_platform_fee<>150 THEN RAISE EXCEPTION 'Original money changed'; END IF;
 BEGIN UPDATE public."Payment" SET amount_total=2000 WHERE id=p.id; RAISE EXCEPTION 'Direct money change permitted'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN UPDATE public."Payment" SET stripe_payment_intent_id='pi_bypass' WHERE id=p.id; RAISE EXCEPTION 'Direct identity change permitted'; EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
DO $$ DECLARE d jsonb; a uuid; lease jsonb; BEGIN
 d:=pg_temp.legacy_begin(2); a:=(d->'attempt'->>'id')::uuid;
 lease:=public.claim_legacy_gig_authorization('aafb0000-0000-4000-8000-000000000102','aafb0000-0000-4000-8000-000000000001',a);
 IF lease->'attempt'->>'lease_id' IS NULL THEN RAISE EXCEPTION 'Lease missing'; END IF;
 IF public.claim_legacy_gig_authorization('aafb0000-0000-4000-8000-000000000102','aafb0000-0000-4000-8000-000000000001',a)->>'error' IS DISTINCT FROM 'BUSY' THEN RAISE EXCEPTION 'Lease duplicated'; END IF;
 UPDATE public."GigLegacyAuthorization" SET lease_until=clock_timestamp()-interval '1 second',created_at=clock_timestamp()-interval '1 day',requested_at=clock_timestamp()-interval '1 day' WHERE id=a;
 IF public.claim_legacy_gig_authorization('aafb0000-0000-4000-8000-000000000102','aafb0000-0000-4000-8000-000000000001',a)->>'error' IS DISTINCT FROM 'NEEDS_REVIEW' THEN RAISE EXCEPTION 'Old unknown operation recreated'; END IF;
 -- Discovery may still bind exact success after the mutation window expires.
 d:=pg_temp.legacy_record(2,d,'requires_capture','pi_recovered');
 IF d->'payment'->>'payment_status' IS DISTINCT FROM 'authorized' THEN RAISE EXCEPTION 'Old exact provider proof not recovered'; END IF;
END $$;
DO $$ DECLARE d jsonb; BEGIN
 IF public.begin_legacy_gig_authorization('aafb0000-0000-4000-8000-000000000103','aafb0000-0000-4000-8000-000000000003')->>'error' IS DISTINCT FROM 'FORBIDDEN' THEN RAISE EXCEPTION 'Foreign actor authorized'; END IF;
 d:=pg_temp.legacy_begin(3);
 UPDATE public."Gig" SET accepted_by='aafb0000-0000-4000-8000-000000000003' WHERE id='aafb0000-0000-4000-8000-000000000103';
 IF public.claim_legacy_gig_authorization('aafb0000-0000-4000-8000-000000000103','aafb0000-0000-4000-8000-000000000001',(d->'attempt'->>'id')::uuid)->>'error' IS DISTINCT FROM 'PAYMENT_CHANGED' THEN RAISE EXCEPTION 'Changed worker allowed provider request'; END IF;
 IF pg_temp.legacy_record(3,d,'requires_capture','pi_changed')->>'error' IS DISTINCT FROM 'PAYMENT_CHANGED' THEN RAISE EXCEPTION 'Changed worker accepted old proof'; END IF;
END $$;
DO $$ DECLARE d jsonb; a uuid; BEGIN
 UPDATE public."User" SET account_type='business' WHERE id='aafb0000-0000-4000-8000-000000000001';
 INSERT INTO public."BusinessTeam"(business_user_id,user_id,role_base) VALUES
  ('aafb0000-0000-4000-8000-000000000001','aafb0000-0000-4000-8000-000000000003','staff');
 INSERT INTO public."BusinessPermissionOverride"(business_user_id,user_id,permission,allowed) VALUES
  ('aafb0000-0000-4000-8000-000000000001','aafb0000-0000-4000-8000-000000000003','gigs.manage',true),
  ('aafb0000-0000-4000-8000-000000000001','aafb0000-0000-4000-8000-000000000003','gigs.post',false);
 d:=public.begin_legacy_gig_authorization('aafb0000-0000-4000-8000-000000000110','aafb0000-0000-4000-8000-000000000003');
 IF d ? 'error' THEN RAISE EXCEPTION 'Current business manager cannot recover payer authorization'; END IF;
 a:=(d->'attempt'->>'id')::uuid;
 UPDATE public."BusinessTeam" SET is_active=false WHERE business_user_id='aafb0000-0000-4000-8000-000000000001';
 IF public.claim_legacy_gig_authorization('aafb0000-0000-4000-8000-000000000110','aafb0000-0000-4000-8000-000000000003',a)->>'error' IS DISTINCT FROM 'FORBIDDEN' THEN RAISE EXCEPTION 'Revoked manager leased provider mutation'; END IF;
 UPDATE public."BusinessTeam" SET is_active=true WHERE business_user_id='aafb0000-0000-4000-8000-000000000001';
 UPDATE public."BusinessPermissionOverride" SET allowed=false WHERE business_user_id='aafb0000-0000-4000-8000-000000000001';
 IF public.claim_legacy_gig_authorization('aafb0000-0000-4000-8000-000000000110','aafb0000-0000-4000-8000-000000000003',a)->>'error' IS DISTINCT FROM 'FORBIDDEN' THEN RAISE EXCEPTION 'Denied manager leased provider mutation'; END IF;
END $$;
DO $$ DECLARE d jsonb; BEGIN
 UPDATE public."Payment" SET metadata='{"acceptance_attempt_id":"operation"}' WHERE id='aafb0000-0000-4000-8000-000000000304';
 IF pg_temp.legacy_begin(4)->>'error' IS DISTINCT FROM 'BID_RECOVERY' THEN RAISE EXCEPTION 'New acceptance bypassed'; END IF;
 UPDATE public."Payment" SET captured_at=now(),payment_status='captured_hold' WHERE id='aafb0000-0000-4000-8000-000000000305';
 IF pg_temp.legacy_begin(5)->>'error' IS DISTINCT FROM 'PAYMENT_CHANGED' THEN RAISE EXCEPTION 'Captured identity replaced'; END IF;
 UPDATE public."Gig" SET price=11 WHERE id='aafb0000-0000-4000-8000-000000000106';
 IF pg_temp.legacy_begin(6)->>'error' IS DISTINCT FROM 'PAYMENT_CHANGED' THEN RAISE EXCEPTION 'Wrong amount admitted'; END IF;
 d:=pg_temp.legacy_begin(7);
 UPDATE public."Payment" SET payment_status='disputed' WHERE id='aafb0000-0000-4000-8000-000000000307';
 IF public.claim_legacy_gig_authorization('aafb0000-0000-4000-8000-000000000107','aafb0000-0000-4000-8000-000000000001',(d->'attempt'->>'id')::uuid)->>'error' IS DISTINCT FROM 'PAYMENT_CHANGED' THEN RAISE EXCEPTION 'Dispute did not stop mutation'; END IF;
END $$;
DO $$ DECLARE d jsonb; lease jsonb; BEGIN
 d:=pg_temp.legacy_begin(8); d:=pg_temp.legacy_record(8,d,'requires_action','pi_cancel');
 lease:=public.claim_legacy_gig_authorization('aafb0000-0000-4000-8000-000000000108',NULL,(d->'attempt'->>'id')::uuid,true,true);
 IF lease ? 'error' THEN RAISE EXCEPTION 'Due cancellation lease rejected %',lease; END IF;
 IF public.finish_legacy_gig_auto_cancel('aafb0000-0000-4000-8000-000000000108',(d->'attempt'->>'id')::uuid,(d->'attempt'->>'verified_at')::timestamptz)->>'error' IS DISTINCT FROM 'CHECK_REQUIRED' THEN RAISE EXCEPTION 'Gig canceled without provider proof'; END IF;
 d:=pg_temp.legacy_record(8,d,'canceled','pi_cancel');
 IF public.finish_legacy_gig_auto_cancel('aafb0000-0000-4000-8000-000000000108',(d->'attempt'->>'id')::uuid,(d->'attempt'->>'verified_at')::timestamptz)->>'cancelled' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Exact canceled proof not applied'; END IF;
END $$;
DO $$ DECLARE d jsonb; i integer; state text; BEGIN
 FOR i IN 11..13 LOOP
  state:=(ARRAY['authorized','authorize_pending','canceled'])[i-10];
  UPDATE public."Payment" SET payment_status=state WHERE id=('aafb0000-0000-4000-8000-0000000003'||i)::uuid;
  d:=pg_temp.legacy_begin(i);
  IF public.claim_legacy_gig_authorization(('aafb0000-0000-4000-8000-0000000001'||i)::uuid,'aafb0000-0000-4000-8000-000000000001',(d->'attempt'->>'id')::uuid)->>'error' IS DISTINCT FROM 'NEEDS_REVIEW' THEN RAISE EXCEPTION 'Unknown historical % created another intent',state; END IF;
 END LOOP;
 UPDATE public."Gig" SET scheduled_start=clock_timestamp()+interval '3 days' WHERE id='aafb0000-0000-4000-8000-000000000114';
 d:=pg_temp.legacy_begin(14);
 IF public.claim_legacy_gig_authorization('aafb0000-0000-4000-8000-000000000114','aafb0000-0000-4000-8000-000000000001',(d->'attempt'->>'id')::uuid)->>'error' IS DISTINCT FROM 'NOT_DUE' THEN RAISE EXCEPTION 'Future saved-card gig authorized too soon'; END IF;
END $$;
-- A failed receipt write rolls back Payment/Gig and retains original identity.
RESET ROLE;
CREATE FUNCTION pg_temp.reject_legacy_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.payment_id='aafb0000-0000-4000-8000-000000000309' AND NEW.verified_at IS NOT NULL THEN
  RAISE EXCEPTION 'Injected receipt failure' USING ERRCODE='40001'; END IF; RETURN NEW; END $$;
CREATE TRIGGER reject_legacy_receipt BEFORE UPDATE ON public."GigLegacyAuthorization" FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_legacy_receipt();
SET LOCAL ROLE service_role;
DO $$ DECLARE d jsonb; BEGIN
 d:=pg_temp.legacy_begin(9);
 BEGIN PERFORM pg_temp.legacy_record(9,d,'requires_capture','pi_rollback'); RAISE EXCEPTION 'Injected failure did not run'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 IF (SELECT stripe_payment_intent_id FROM public."Payment" WHERE id='aafb0000-0000-4000-8000-000000000309') IS NOT NULL
  OR (SELECT payment_status FROM public."Gig" WHERE id='aafb0000-0000-4000-8000-000000000109')<>'ready_to_authorize' THEN RAISE EXCEPTION 'Partial receipt survived'; END IF;
END $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.begin_legacy_gig_authorization('aafb0000-0000-4000-8000-000000000110','aafb0000-0000-4000-8000-000000000001',true); RAISE EXCEPTION 'Client invoked scheduler'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM * FROM public."GigLegacyAuthorization"; RAISE EXCEPTION 'Client read private history'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
