BEGIN;
-- Original tips reuse Payment; every fixture is rolled back, including identities.
CREATE FUNCTION pg_temp.tip_id(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
 SELECT ('aad10000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid $$;
CREATE FUNCTION pg_temp.tip_assert(ok boolean,message text) RETURNS void LANGUAGE plpgsql AS $$
 BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION '%',message; END IF; END $$;
INSERT INTO auth.users(id,email) SELECT pg_temp.tip_id(i),'tip-original-'||i||'@example.invalid' FROM generate_series(1,3) i;
INSERT INTO public."User"(id,email,username,name) SELECT pg_temp.tip_id(i),'tip-original-'||i||'@example.invalid','tip_original_'||i,'Tip original' FROM generate_series(1,3) i;
INSERT INTO public."StripeAccount"(user_id,stripe_account_id) VALUES(pg_temp.tip_id(2),'acct_tiporiginal');
INSERT INTO public."Gig"(id,user_id,created_by,title,description,price,status,accepted_by,owner_confirmed_at)
 SELECT pg_temp.tip_id(100+i),pg_temp.tip_id(1),pg_temp.tip_id(1),'Tip original','Synthetic',0,'completed',pg_temp.tip_id(2),now() FROM generate_series(1,12) i;
CREATE FUNCTION pg_temp.tip_reserve(i integer,request_number integer DEFAULT NULL,amount integer DEFAULT 500,actor integer DEFAULT 1,
 method text DEFAULT NULL,scope text DEFAULT repeat('a',64),live boolean DEFAULT false,terms jsonb DEFAULT NULL)
 RETURNS jsonb LANGUAGE sql AS $$ SELECT public.reserve_gig_tip_original(pg_temp.tip_id(100+i),pg_temp.tip_id(actor),scope,
 pg_temp.tip_id(coalesce(request_number,300+i)),coalesce(terms,public.gig_tip_terms(g)),amount,method,live)
 FROM public."Gig" g WHERE id=pg_temp.tip_id(100+i) $$;
SET LOCAL ROLE service_role;
DO $$ DECLARE d jsonb; original jsonb; terms jsonb; n integer; BEGIN
 PERFORM pg_temp.tip_assert(public.preview_gig_tip(pg_temp.tip_id(101),pg_temp.tip_id(3))->>'error'='FORBIDDEN','Foreign preview admitted');
 PERFORM pg_temp.tip_assert(pg_temp.tip_reserve(1,NULL,500,3)->>'error'='FORBIDDEN','Foreign reservation admitted');
 PERFORM pg_temp.tip_assert(pg_temp.tip_reserve(1,NULL,49)->>'error'='INVALID_REQUEST','Subminimum amount admitted');
 PERFORM pg_temp.tip_assert(pg_temp.tip_reserve(1,NULL,100000000)->>'error'='INVALID_REQUEST','Oversized amount admitted');
 PERFORM pg_temp.tip_assert(pg_temp.tip_reserve(1,NULL,NULL)->>'error'='INVALID_REQUEST','Null amount admitted');
 PERFORM pg_temp.tip_assert(pg_temp.tip_reserve(1,NULL,500,1,'bad')->>'error'='INVALID_REQUEST','Invalid method admitted');
 PERFORM pg_temp.tip_assert(pg_temp.tip_reserve(1,NULL,500,1,NULL,'bad')->>'error'='INVALID_REQUEST','Invalid opening scope admitted');
 PERFORM pg_temp.tip_assert(pg_temp.tip_reserve(1,NULL,500,1,NULL,repeat('a',64),NULL)->>'error'='INVALID_REQUEST','Missing provider mode admitted');
 terms:=(public.preview_gig_tip(pg_temp.tip_id(101),pg_temp.tip_id(1)))->'terms';
 PERFORM pg_temp.tip_assert(pg_temp.tip_reserve(1,NULL,500,1,NULL,repeat('a',64),false,terms||'{"ownerConfirmedAt":null}')->>'error'='TERMS_CHANGED','Stale confirmation admitted');
 d:=pg_temp.tip_reserve(1); original:=d;
 PERFORM pg_temp.tip_assert(NOT(d ? 'error') AND d->'payment'->>'id'=pg_temp.tip_id(301)::text AND d->'original'->>'state'='reserved','Original Payment not reserved');
 PERFORM pg_temp.tip_assert(d->'payment'->>'stripe_payment_intent_id' IS NULL AND d->'payment'->>'stripe_customer_id' IS NULL,'Reservation invented provider identity');
 PERFORM pg_temp.tip_assert(d->'payment'->>'payment_succeeded_at' IS NULL AND d->'payment'->>'amount_total'='500' AND d->'payment'->>'amount_to_payee'='500','Reservation changed amount or reported paid');
 PERFORM pg_temp.tip_assert(pg_temp.tip_reserve(1,NULL,500,1,NULL,repeat('b',64))=original,'Same actor recovery rebound session or original');
 PERFORM pg_temp.tip_assert(pg_temp.tip_reserve(1,NULL,501)->>'error'='REQUEST_CONFLICT','Original amount changed');
 PERFORM pg_temp.tip_assert(pg_temp.tip_reserve(1,NULL,500,1,'pm_changed')->>'error'='REQUEST_CONFLICT','Original method changed');
 PERFORM pg_temp.tip_assert(pg_temp.tip_reserve(1,NULL,500,1,NULL,repeat('a',64),true)->>'error'='REQUEST_CONFLICT','Original provider mode changed');
 PERFORM pg_temp.tip_assert(pg_temp.tip_reserve(1,399)->>'error'='TIP_ACTIVE','Second active reservation admitted');
 PERFORM pg_temp.tip_assert(public.preview_gig_tip(pg_temp.tip_id(101),pg_temp.tip_id(1))->>'activeRequestId'=pg_temp.tip_id(301)::text,'Active recovery identity missing');
 PERFORM pg_temp.tip_assert(public.read_gig_tip_original(pg_temp.tip_id(301),pg_temp.tip_id(2))->>'error'='FORBIDDEN','Payee read payer-only original');
 PERFORM pg_temp.tip_assert(public.read_gig_tip_original(pg_temp.tip_id(399),pg_temp.tip_id(1))->>'error'='NOT_FOUND','Absent receipt manufactured');
 UPDATE public."Gig" SET accepted_by=pg_temp.tip_id(3),owner_confirmed_at=now()+interval '1 second' WHERE id=pg_temp.tip_id(101);
 PERFORM pg_temp.tip_assert(pg_temp.tip_reserve(1,NULL,500,1,NULL,repeat('b',64),false,terms)=original,'Historical exact identity lost after current task changed');
 PERFORM pg_temp.tip_assert(pg_temp.tip_reserve(1)->>'error'='REQUEST_CONFLICT','Current worker replaced original');
 BEGIN UPDATE public."Payment" SET amount_total=600,amount_subtotal=600,amount_to_payee=600,tip_amount=600 WHERE id=pg_temp.tip_id(301);
  RAISE EXCEPTION 'Original amounts changed directly'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN UPDATE public."Payment" SET metadata='{}' WHERE id=pg_temp.tip_id(301);
  RAISE EXCEPTION 'Original marker erased'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN UPDATE public."Payment" SET payment_status='captured_hold',payment_succeeded_at=now() WHERE id=pg_temp.tip_id(301);
  RAISE EXCEPTION 'Provider success manufactured'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE public."Payment" SET stripe_payment_intent_id='pi_forged' WHERE id=pg_temp.tip_id(301);
  RAISE EXCEPTION 'Provider intent bound outside transaction'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN DELETE FROM public."Payment" WHERE id=pg_temp.tip_id(301);
  RAISE EXCEPTION 'Unresolved original deleted'; EXCEPTION WHEN check_violation THEN NULL; END;
 UPDATE public."Payment" SET metadata=metadata||'{"tip_notification_sent":true}' WHERE id=pg_temp.tip_id(301);
 PERFORM pg_temp.tip_assert((SELECT metadata->>'tip_notification_sent' FROM public."Payment" WHERE id=pg_temp.tip_id(301))='true','Unrelated delivery metadata blocked');
 UPDATE public."Gig" SET owner_confirmed_at=NULL WHERE id=pg_temp.tip_id(102);
 PERFORM pg_temp.tip_assert(pg_temp.tip_reserve(2)->>'error'='NOT_CONFIRMED','Missing owner confirmation admitted');
 UPDATE public."Gig" SET status='assigned' WHERE id=pg_temp.tip_id(103);
 PERFORM pg_temp.tip_assert(pg_temp.tip_reserve(3)->>'error'='NOT_CONFIRMED','Incomplete task admitted');
 UPDATE public."Gig" SET accepted_by=NULL WHERE id=pg_temp.tip_id(104);
 PERFORM pg_temp.tip_assert(pg_temp.tip_reserve(4)->>'error'='WORKER_UNAVAILABLE','Missing worker admitted');
 UPDATE public."Gig" SET accepted_by=pg_temp.tip_id(1) WHERE id=pg_temp.tip_id(105);
 PERFORM pg_temp.tip_assert(pg_temp.tip_reserve(5)->>'error'='WORKER_UNAVAILABLE','Self tip admitted');
 UPDATE public."Gig" SET accepted_by=pg_temp.tip_id(3) WHERE id=pg_temp.tip_id(106);
 PERFORM pg_temp.tip_assert(pg_temp.tip_reserve(6)->>'error'='CONNECT_REQUIRED','Missing Connect record admitted');
 -- Existing policy permits an account record whose onboarding flags are false.
 PERFORM pg_temp.tip_assert(pg_temp.tip_reserve(7)->'original'->>'stripe_account_id'='acct_tiporiginal','Existing Connect-record policy changed');
END $$;
-- Older successful and unresolved payments must retain their identities.
INSERT INTO public."Payment"(id,gig_id,payer_id,payee_id,payment_type,amount_total,amount_subtotal,amount_platform_fee,amount_to_payee,
 tip_amount,payment_status,payment_succeeded_at,metadata)
 SELECT pg_temp.tip_id(500+i),pg_temp.tip_id(108),pg_temp.tip_id(1),pg_temp.tip_id(2),'tip',100,100,0,100,100,'transferred',now(),'{}' FROM generate_series(1,3) i;
INSERT INTO public."Payment"(id,gig_id,payer_id,payee_id,payment_type,amount_total,amount_subtotal,amount_platform_fee,amount_to_payee,
 tip_amount,payment_status,metadata)
 VALUES(pg_temp.tip_id(509),pg_temp.tip_id(109),pg_temp.tip_id(1),pg_temp.tip_id(2),'tip',100,100,0,100,100,'canceled',NULL);
DO $$ BEGIN
 PERFORM pg_temp.tip_assert(pg_temp.tip_reserve(8)->>'error'='TIP_LIMIT','Legacy successful tips not counted');
 PERFORM pg_temp.tip_assert(public.preview_gig_tip(pg_temp.tip_id(108),pg_temp.tip_id(1))->>'remainingTipSlots'='0','Legacy limit incorrect');
 PERFORM pg_temp.tip_assert(pg_temp.tip_reserve(9)->>'error'='LEGACY_REVIEW','Legacy unproven cancellation freed a slot');
 PERFORM pg_temp.tip_assert(public.preview_gig_tip(pg_temp.tip_id(109),pg_temp.tip_id(1))->>'legacyPaymentId'=pg_temp.tip_id(509)::text,'Nullable legacy metadata concealed recovery identity');
 PERFORM pg_temp.tip_assert(public.read_gig_tip_original(pg_temp.tip_id(509),pg_temp.tip_id(1))->>'error'='LEGACY_REVIEW','Nullable legacy row became an original');
 PERFORM pg_temp.tip_assert(pg_temp.tip_reserve(9,509)->>'error'='REQUEST_CONFLICT','Legacy payment promoted to new request');
 UPDATE public."Payment" SET failure_message='Legacy update remains supported' WHERE id=pg_temp.tip_id(509);
END $$;
DO $$ DECLARE d jsonb; lease uuid; old_lease uuid; started text; frozen jsonb; BEGIN
 d:=public.claim_gig_tip_original(pg_temp.tip_id(301),pg_temp.tip_id(1)); lease:=(d->'original'->>'lease_id')::uuid;
 PERFORM pg_temp.tip_assert(lease IS NOT NULL AND d->'original'->>'provider_started_at' IS NULL,'Lease performed provider work');
 PERFORM pg_temp.tip_assert(public.claim_gig_tip_original(pg_temp.tip_id(301),pg_temp.tip_id(1))->>'error'='BUSY','Concurrent provider lease admitted');
 PERFORM pg_temp.tip_assert(public.claim_gig_tip_original(pg_temp.tip_id(301),pg_temp.tip_id(3))->>'error'='FORBIDDEN','Foreign actor claimed lease');
 PERFORM pg_temp.tip_assert(public.prepare_gig_tip_provider(pg_temp.tip_id(301),pg_temp.tip_id(1),gen_random_uuid(),'cus_original')->>'error'='LEASE_LOST','Unknown lease prepared provider');
 PERFORM pg_temp.tip_assert(public.prepare_gig_tip_provider(pg_temp.tip_id(301),pg_temp.tip_id(1),lease,'cus_original')->>'error'='CUSTOMER_CHANGED','Uncommitted customer used');
 UPDATE public."User" SET stripe_customer_id='cus_original' WHERE id=pg_temp.tip_id(1);
 PERFORM pg_temp.tip_assert(public.prepare_gig_tip_provider(pg_temp.tip_id(301),pg_temp.tip_id(1),lease,'cus_original')->>'error'='TERMS_CHANGED','Changed worker charged before original provider start');
 d:=public.cancel_unstarted_gig_tip(pg_temp.tip_id(301),pg_temp.tip_id(1),lease);
 PERFORM pg_temp.tip_assert(d->'original'->'receipt'->>'amountChargedCents'='0' AND d->'original'->>'state'='canceled','Unstarted original not canceled atomically');
 frozen:=d;
 PERFORM pg_temp.tip_assert(public.cancel_unstarted_gig_tip(pg_temp.tip_id(301),pg_temp.tip_id(1),lease)=frozen,'Repeated cancellation changed receipt');
 PERFORM pg_temp.tip_assert(public.preview_gig_tip(pg_temp.tip_id(101),pg_temp.tip_id(1))->>'remainingTipSlots'='3','Unstarted cancellation consumed successful slot');
 UPDATE public."Gig" SET accepted_by=pg_temp.tip_id(2) WHERE id=pg_temp.tip_id(101);
 d:=pg_temp.tip_reserve(1,398,50,1,'pm_original');
 PERFORM pg_temp.tip_assert(NOT(d ? 'error') AND d->'payment'->>'stripe_customer_id'='cus_original','Replacement after proven cancellation failed');
 PERFORM pg_temp.tip_assert(pg_temp.tip_reserve(1,301)->>'error'='REQUEST_CONFLICT','Canceled ID rebound to current task');
 d:=public.claim_gig_tip_original(pg_temp.tip_id(398),pg_temp.tip_id(1)); lease:=(d->'original'->>'lease_id')::uuid;
 d:=public.prepare_gig_tip_provider(pg_temp.tip_id(398),pg_temp.tip_id(1),lease,'cus_original');started:=d->'original'->>'provider_started_at';
 PERFORM pg_temp.tip_assert(started IS NOT NULL AND d->'original'->>'state'='creating' AND d->'payment'->>'stripe_payment_intent_id' IS NULL,'Unknown create not anchored before provider');
 PERFORM pg_temp.tip_assert(public.cancel_unstarted_gig_tip(pg_temp.tip_id(398),pg_temp.tip_id(1),lease)->>'error'='PROVIDER_OUTCOME_UNKNOWN','Unknown provider create treated as no charge');
 PERFORM pg_temp.tip_assert(public.release_gig_tip_original(pg_temp.tip_id(398),pg_temp.tip_id(1),gen_random_uuid())->>'error'='LEASE_LOST','Foreign lease released current work');
 d:=public.release_gig_tip_original(pg_temp.tip_id(398),pg_temp.tip_id(1),lease);old_lease:=lease;
 PERFORM pg_temp.tip_assert(d->'original'->>'lease_id' IS NULL AND d->'original'->>'provider_started_at'=started,'Lease release erased original provider start');
 d:=public.claim_gig_tip_original(pg_temp.tip_id(398),pg_temp.tip_id(1));lease:=(d->'original'->>'lease_id')::uuid;
 PERFORM pg_temp.tip_assert(lease<>old_lease,'Provider retry reused expired lease');
 PERFORM pg_temp.tip_assert(public.prepare_gig_tip_provider(pg_temp.tip_id(398),pg_temp.tip_id(1),old_lease,'cus_original')->>'error'='LEASE_LOST','Delayed old owner prepared create');
 UPDATE public."User" SET stripe_customer_id='cus_changed' WHERE id=pg_temp.tip_id(1);
 d:=public.prepare_gig_tip_provider(pg_temp.tip_id(398),pg_temp.tip_id(1),lease,'cus_original');
 PERFORM pg_temp.tip_assert(d->'original'->>'provider_started_at'=started AND d->'payment'->>'stripe_customer_id'='cus_original','Retry changed provider parameters or restarted pruning window');
 PERFORM pg_temp.tip_assert(public.prepare_gig_tip_provider(pg_temp.tip_id(398),pg_temp.tip_id(1),lease,'cus_changed')->>'error'='CUSTOMER_CHANGED','Retry replaced original customer');
 PERFORM pg_temp.tip_assert(pg_temp.tip_reserve(1,397)->>'error'='TIP_ACTIVE','Unknown provider create freed successful-tip slot');
 -- Simulate the clock advancing before the first provider response. The
 -- original time, once established, cannot be reset even by later RPC work.
 d:=public.claim_gig_tip_original(pg_temp.tip_id(307),pg_temp.tip_id(1));lease:=(d->'original'->>'lease_id')::uuid;
 PERFORM set_config('app.gig_tip_original','on',true);
 UPDATE public."Payment" SET metadata=jsonb_set(metadata,'{gig_tip_original_v1,provider_started_at}',to_jsonb(clock_timestamp()-interval '24 hours')) WHERE id=pg_temp.tip_id(307);
 PERFORM set_config('app.gig_tip_original','off',true);
 PERFORM pg_temp.tip_assert(public.prepare_gig_tip_provider(pg_temp.tip_id(307),pg_temp.tip_id(1),lease,'cus_changed')->>'error'='PROVIDER_OUTCOME_UNKNOWN','Old idempotency key allowed another create');
 BEGIN
  PERFORM set_config('app.gig_tip_original','on',true);
  UPDATE public."Payment" SET metadata=jsonb_set(metadata,'{gig_tip_original_v1,provider_started_at}',to_jsonb(clock_timestamp())) WHERE id=pg_temp.tip_id(307);
  RAISE EXCEPTION 'Original provider window reset'; EXCEPTION WHEN check_violation THEN NULL; END;
 PERFORM set_config('app.gig_tip_original','off',true);
 PERFORM pg_temp.tip_assert(public.cancel_unstarted_gig_tip(pg_temp.tip_id(307),pg_temp.tip_id(1),lease)->>'error'='PROVIDER_OUTCOME_UNKNOWN','Old unknown outcome erased');
END $$;
CREATE FUNCTION pg_temp.tip_proof(request_number integer,gig_number integer) RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_build_object('id','pi_tiporiginal'||request_number,'customer','cus_changed','livemode',false,
  'amount',500,'currency','usd','capture_method','automatic','confirmation_method','automatic','status','succeeded',
  'amount_received',500,'amount_capturable',0,'payer_id',pg_temp.tip_id(1),'payee_id',pg_temp.tip_id(2),'gig_id',pg_temp.tip_id(gig_number),
  'payment_type','tip','platform_fee','0','request_id',pg_temp.tip_id(request_number),'payment_id',pg_temp.tip_id(request_number),
  'stripe_account_id','acct_tiporiginal','transfer_data',NULL,'on_behalf_of',NULL,'application_fee_amount',NULL)
  ||jsonb_build_object('charge_id','ch_tiporiginal'||request_number,'charge_paid',true,'charge_captured',true,
  'charge_amount_captured',500,'charge_amount_refunded',0,'charge_refunded',false,'charge_disputed',false,'charge_dispute_id',NULL,
  'charge_transfer',NULL,'charge_destination',NULL,'charge_application_fee',NULL,'charge_application_fee_amount',NULL,
  'payment_method_id','pm_tiporiginal','captured_at','2026-09-14T12:00:00Z') $$;
DO $$ DECLARE d jsonb; lease uuid; proof jsonb; patch jsonb; receipt jsonb; BEGIN
 d:=pg_temp.tip_reserve(10);d:=public.claim_gig_tip_original(pg_temp.tip_id(310),pg_temp.tip_id(1));lease:=(d->'original'->>'lease_id')::uuid;
 proof:=pg_temp.tip_proof(310,110);
 PERFORM pg_temp.tip_assert(public.record_gig_tip_original(pg_temp.tip_id(310),pg_temp.tip_id(1),lease,proof)->>'error'='INVALID_PROOF','Unprepared original accepted a charge');
 d:=public.prepare_gig_tip_provider(pg_temp.tip_id(310),pg_temp.tip_id(1),lease,'cus_changed');
 FOREACH patch IN ARRAY ARRAY['{"amount":501}'::jsonb,'{"customer":"cus_other"}','{"livemode":true}','{"currency":"eur"}',
  '{"request_id":null}','{"payment_id":null}','{"gig_id":null}','{"stripe_account_id":"acct_other"}',
  '{"amount_received":0}','{"charge_paid":false}','{"charge_captured":false}','{"charge_amount_captured":499}',
  '{"captured_at":"not-a-date"}','{"captured_at":"infinity"}','{"charge_id":null}','{"application_fee_amount":5}',
  '{"transfer_data":{"destination":"acct_other"}}','{"charge_destination":"acct_other"}','{"charge_amount_refunded":501}'] LOOP
  PERFORM pg_temp.tip_assert(public.record_gig_tip_original(pg_temp.tip_id(310),pg_temp.tip_id(1),lease,proof||patch)->>'error'='INVALID_PROOF','Mismatched proof admitted: '||patch::text);
 END LOOP;
 d:=public.record_gig_tip_original(pg_temp.tip_id(310),pg_temp.tip_id(1),lease,proof||
  '{"status":"requires_action","amount_received":0,"charge_id":null,"charge_paid":false,"charge_captured":false,"charge_amount_captured":0,"captured_at":null}');
 PERFORM pg_temp.tip_assert(d->'original'->>'state'='pending' AND d->'original'->>'provider_status'='requires_action'
  AND d->'payment'->>'stripe_payment_intent_id'='pi_tiporiginal310' AND NOT(d->'original' ? 'receipt'),'Pending provider state created a success receipt');
 PERFORM pg_temp.tip_assert(public.prepare_gig_tip_provider(pg_temp.tip_id(310),pg_temp.tip_id(1),lease,'cus_changed')->>'error'='PROVIDER_ALREADY_BOUND','Bound request prepared another create');
 PERFORM pg_temp.tip_assert(public.record_gig_tip_original(pg_temp.tip_id(310),pg_temp.tip_id(1),lease,proof||'{"id":"pi_other"}')->>'error'='INVALID_PROOF','Provider identity replaced');
 PERFORM pg_temp.tip_assert(public.record_gig_tip_original(pg_temp.tip_id(310),pg_temp.tip_id(1),gen_random_uuid(),proof)->>'error'='LEASE_LOST','Late lease established success');
 d:=public.record_gig_tip_original(pg_temp.tip_id(310),pg_temp.tip_id(1),lease,proof);receipt:=d->'original'->'receipt';
 PERFORM pg_temp.tip_assert(receipt->>'status'='succeeded' AND receipt->>'paymentId'=pg_temp.tip_id(310)::text
  AND receipt->>'amountChargedCents'='500' AND d->'payment'->>'payment_status'='captured_hold','Exact charge did not commit same-ID receipt');
 PERFORM pg_temp.tip_assert((d->'payment'->>'cooling_off_ends_at')::timestamptz='2026-09-16T12:00:00Z'::timestamptz,'Existing cooling period changed');
 PERFORM pg_temp.tip_assert(public.record_gig_tip_original(pg_temp.tip_id(310),pg_temp.tip_id(1),lease,proof)->'original'->'receipt'=receipt,'Receipt replay changed terminal truth');
 PERFORM pg_temp.tip_assert(public.preview_gig_tip(pg_temp.tip_id(110),pg_temp.tip_id(1))->>'remainingTipSlots'='2','Successful original not counted');
 UPDATE public."Payment" SET payment_status='transferred',transfer_status='paid' WHERE id=pg_temp.tip_id(310);
 PERFORM pg_temp.tip_assert(public.read_gig_tip_original(pg_temp.tip_id(310),pg_temp.tip_id(1))->'original'->'receipt'=receipt,'Existing downstream transfer erased receipt');
 BEGIN UPDATE public."Payment" SET payment_status='authorize_pending' WHERE id=pg_temp.tip_id(310);
  RAISE EXCEPTION 'Captured original reopened'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN UPDATE public."Payment" SET stripe_charge_id='ch_other' WHERE id=pg_temp.tip_id(310);
  RAISE EXCEPTION 'Captured Charge identity changed'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN UPDATE public."Payment" SET payment_succeeded_at=NULL WHERE id=pg_temp.tip_id(310);
  RAISE EXCEPTION 'Captured original evidence erased'; EXCEPTION WHEN check_violation THEN NULL; END;
 d:=pg_temp.tip_reserve(11);d:=public.claim_gig_tip_original(pg_temp.tip_id(311),pg_temp.tip_id(1));lease:=(d->'original'->>'lease_id')::uuid;
 d:=public.prepare_gig_tip_provider(pg_temp.tip_id(311),pg_temp.tip_id(1),lease,'cus_changed');
 proof:=pg_temp.tip_proof(311,111)||'{"status":"canceled","amount_received":0,"charge_id":null,"charge_paid":false,"charge_captured":false,"charge_amount_captured":0,"captured_at":null}';
 PERFORM pg_temp.tip_assert(public.record_gig_tip_original(pg_temp.tip_id(311),pg_temp.tip_id(1),lease,proof||'{"charge_amount_captured":1}')->>'error'='INVALID_PROOF','Canceled provider with captured funds called zero charge');
 d:=public.record_gig_tip_original(pg_temp.tip_id(311),pg_temp.tip_id(1),lease,proof);
 PERFORM pg_temp.tip_assert(d->'original'->'receipt'->>'status'='canceled' AND d->'original'->'receipt'->>'amountChargedCents'='0','Exact canceled proof not retained');
 PERFORM pg_temp.tip_assert(NOT(pg_temp.tip_reserve(11,391) ? 'error'),'Proven canceled provider did not release slot');
 d:=pg_temp.tip_reserve(12);d:=public.claim_gig_tip_original(pg_temp.tip_id(312),pg_temp.tip_id(1));lease:=(d->'original'->>'lease_id')::uuid;
 d:=public.prepare_gig_tip_provider(pg_temp.tip_id(312),pg_temp.tip_id(1),lease,'cus_changed');
 d:=public.record_gig_tip_original(pg_temp.tip_id(312),pg_temp.tip_id(1),lease,pg_temp.tip_proof(312,112)||'{"charge_amount_refunded":200}');
 PERFORM pg_temp.tip_assert(d->'payment'->>'payment_status'='refunded_partial' AND d->'payment'->>'refunded_amount'='200'
  AND d->'original'->'receipt'->>'amountChargedCents'='500','Existing capture and later refund conflated');
END $$;
-- Legacy recovery uses the same Payment identity and receipt transaction.
INSERT INTO public."Gig"(id,user_id,created_by,title,description,price,status,accepted_by,owner_confirmed_at)
 SELECT pg_temp.tip_id(200+i),pg_temp.tip_id(1),pg_temp.tip_id(1),'Legacy tip','Synthetic',0,'completed',pg_temp.tip_id(3),NULL FROM generate_series(1,3) i;
INSERT INTO public."Payment"(id,gig_id,payer_id,payee_id,payment_type,amount_total,amount_subtotal,amount_platform_fee,amount_to_payee,
 amount_processing_fee,tip_amount,currency,payment_status,stripe_customer_id,stripe_payment_intent_id,metadata)
 SELECT pg_temp.tip_id(700+i),pg_temp.tip_id(CASE WHEN i<=2 THEN 201 ELSE 202 END),pg_temp.tip_id(1),pg_temp.tip_id(2),
 'tip',500,500,0,500,44,500,'USD','authorize_pending','cus_changed','pi_tiporiginal'||(700+i),NULL FROM generate_series(1,4) i;
CREATE FUNCTION pg_temp.legacy_proof(n integer,gig integer,status text DEFAULT 'requires_action') RETURNS jsonb LANGUAGE sql AS $$
 SELECT pg_temp.tip_proof(n,gig)||jsonb_build_object('request_id',NULL,'payment_id',NULL,'stripe_account_id',NULL,'status',status)
  ||CASE WHEN status='succeeded' THEN '{}'::jsonb ELSE
  '{"amount_received":0,"charge_id":null,"charge_paid":false,"charge_captured":false,"charge_amount_captured":0,"captured_at":null}'::jsonb END $$;
CREATE FUNCTION pg_temp.register_tip(n integer,proof jsonb,actor integer DEFAULT 1) RETURNS jsonb LANGUAGE sql AS $$
 SELECT public.register_legacy_gig_tip(pg_temp.tip_id(n),pg_temp.tip_id(actor),repeat('b',64),false,to_jsonb(p),proof)
 FROM public."Payment" p WHERE id=pg_temp.tip_id(n) $$;
DO $$ DECLARE d jsonb; snap jsonb; proof jsonb; patch jsonb; lease uuid; BEGIN
 d:=public.read_gig_tip_original(pg_temp.tip_id(701),pg_temp.tip_id(1));snap:=d->'payment';
 PERFORM pg_temp.tip_assert(d->>'error'='LEGACY_REVIEW' AND snap->>'currency'='USD','Legacy read invented an outcome or changed historical data');
 PERFORM pg_temp.tip_assert(NOT(public.read_gig_tip_original(pg_temp.tip_id(701),pg_temp.tip_id(2)) ? 'payment'),'Legacy snapshot exposed to nonpayer');
 PERFORM pg_temp.tip_assert(pg_temp.register_tip(701,pg_temp.legacy_proof(701,201),2)->>'error'='FORBIDDEN','Nonpayer registered legacy tip');
 PERFORM pg_temp.tip_assert(public.claim_gig_tip_original(pg_temp.tip_id(701),pg_temp.tip_id(1))->>'error'='LEGACY_REVIEW','Lease implicitly adopted unverified history');
 proof:=pg_temp.legacy_proof(701,201);
 FOREACH patch IN ARRAY ARRAY['{"amount":501}'::jsonb,'{"customer":"cus_other"}','{"livemode":true}','{"currency":"eur"}',
  '{"request_id":"modern"}','{"payment_id":"modern"}','{"gig_id":null}','{"charge_amount_captured":1}',
  '{"id":"pi_other"}','{"application_fee_amount":5}'] LOOP
  d:=pg_temp.register_tip(701,proof||patch);
  PERFORM pg_temp.tip_assert(d->>'error'='INVALID_PROOF','Legacy mismatched proof admitted: '||patch::text);
  PERFORM pg_temp.tip_assert((SELECT metadata IS NULL FROM public."Payment" WHERE id=pg_temp.tip_id(701)),'Rejected adoption left a marker');
 END LOOP;
 UPDATE public."Payment" SET failure_message='Concurrent historical update' WHERE id=pg_temp.tip_id(701);
 PERFORM pg_temp.tip_assert(public.register_legacy_gig_tip(pg_temp.tip_id(701),pg_temp.tip_id(1),repeat('b',64),false,snap,proof)->>'error'='PAYMENT_CHANGED','Stale historical snapshot adopted');
 d:=pg_temp.register_tip(701,proof);
 PERFORM pg_temp.tip_assert(d->'original'->>'source'='legacy' AND d->'original'->>'state'='pending'
  AND d->'original'->'terms'->'ownerConfirmedAt'='null'::jsonb AND d->'original'->'terms'->>'payeeId'=pg_temp.tip_id(2)::text,'Historical identity replaced by current Gig terms');
 PERFORM pg_temp.tip_assert(d->'payment'->>'currency'='USD' AND NOT(d->'original' ? 'provider_started_at')
  AND NOT(d->'original' ? 'receipt') AND NOT(d->'original' ? 'lease_id'),'Pending legacy registration invented provider start, receipt or retained lease');
 d:=pg_temp.register_tip(702,pg_temp.legacy_proof(702,201));
 PERFORM pg_temp.tip_assert(d->'original'->>'source'='legacy','Second existing pending payment lost to modern unique index');
 PERFORM pg_temp.tip_assert(public.preview_gig_tip(pg_temp.tip_id(201),pg_temp.tip_id(1))->>'eligible'='false','Unresolved legacy payments freed a new tip');
 d:=public.claim_gig_tip_original(pg_temp.tip_id(701),pg_temp.tip_id(1));lease:=(d->'original'->>'lease_id')::uuid;
 PERFORM pg_temp.tip_assert(public.prepare_gig_tip_provider(pg_temp.tip_id(701),pg_temp.tip_id(1),lease,'cus_changed')->>'error'='LEGACY_CHECK_ONLY','Legacy payment prepared a new charge');
 PERFORM pg_temp.tip_assert(public.cancel_unstarted_gig_tip(pg_temp.tip_id(701),pg_temp.tip_id(1),lease)->>'error'='PROVIDER_OUTCOME_UNKNOWN','Legacy payment used unstarted cancellation');
 d:=public.record_gig_tip_original(pg_temp.tip_id(701),pg_temp.tip_id(1),lease,pg_temp.legacy_proof(701,201,'canceled'));
 PERFORM pg_temp.tip_assert(d->'original'->'receipt'->>'amountChargedCents'='0' AND d->'original'->'receipt'->>'currency'='usd','Verified historical cancellation lacked normalized receipt');
 PERFORM pg_temp.tip_assert(public.preview_gig_tip(pg_temp.tip_id(201),pg_temp.tip_id(1))->>'activeRequestId'=pg_temp.tip_id(702)::text,'Canceling one history row hid another pending tip');
 BEGIN UPDATE public."Payment" SET metadata=metadata-'gig_tip_original_v1' WHERE id=pg_temp.tip_id(701);
  RAISE EXCEPTION 'Legacy original erased'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN UPDATE public."Payment" SET stripe_payment_intent_id='pi_new' WHERE id=pg_temp.tip_id(702);
  RAISE EXCEPTION 'Legacy provider replaced'; EXCEPTION WHEN check_violation THEN NULL; END;
 -- Missing provider identity stays unregistered, even with a forged proof.
 UPDATE public."Payment" SET stripe_payment_intent_id=NULL WHERE id=pg_temp.tip_id(703);
 PERFORM pg_temp.tip_assert(pg_temp.register_tip(703,pg_temp.legacy_proof(703,202))->>'error'='PROVIDER_OUTCOME_UNKNOWN','Missing legacy identity treated as no charge');
 UPDATE public."Payment" SET payment_status='refunded_partial',refunded_amount=100,payment_succeeded_at='2025-01-01Z',
  captured_at='2025-01-01Z',cooling_off_ends_at='2025-01-03Z',stripe_charge_id='ch_tiporiginal704',transfer_status='paid',
  transfer_completed_at='2025-01-04Z',dispute_id='dp_historical' WHERE id=pg_temp.tip_id(704);
 SELECT to_jsonb(p) INTO snap FROM public."Payment" p WHERE id=pg_temp.tip_id(704);
 d:=pg_temp.register_tip(704,pg_temp.legacy_proof(704,202,'succeeded')||'{"charge_amount_refunded":100}');
 PERFORM pg_temp.tip_assert(d->'original'->>'state'='succeeded' AND d->'original'->'receipt'->>'amountChargedCents'='500','Historical capture not proven');
 PERFORM pg_temp.tip_assert(((d->'payment')-'metadata'-'updated_at'-'stripe_payment_method_id')=(snap-'metadata'-'updated_at'-'stripe_payment_method_id'),
  'Historical financial status, capture/cooldown, refund or transfer data overwritten');
END $$;
-- Existing Payment capture commits one notice and a retryable delivery marker.
DO $$ DECLARE p public."Payment"; d jsonb; e jsonb; r jsonb; original jsonb; note_id uuid; BEGIN
 SELECT * INTO p FROM public."Payment" WHERE id=pg_temp.tip_id(310); d:=p.metadata->'gig_tip_delivery_v1';
 original:=p.metadata->'gig_tip_original_v1'; note_id:=(d->>'notification_id')::uuid;
 PERFORM pg_temp.tip_assert(d->>'state'='pending' AND d->>'push_allowed_at_capture'='false','Capture did not atomically retain its notice and consent');
 PERFORM pg_temp.tip_assert((SELECT count(*)=1 FROM public."Notification" WHERE metadata->>'payment_id'=p.id::text),'Capture/replay created duplicate notices');
 PERFORM pg_temp.tip_assert(NOT EXISTS(SELECT FROM public."Payment" WHERE id IN(pg_temp.tip_id(311),pg_temp.tip_id(704)) AND metadata ? 'gig_tip_delivery_v1'),'Canceled/historical capture was backfilled');
 BEGIN UPDATE public."Payment" SET metadata=metadata-'gig_tip_delivery_v1' WHERE id=p.id;
  RAISE EXCEPTION 'Stale metadata erased delivery'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 e:=public.claim_gig_tip_delivery();
 PERFORM pg_temp.tip_assert(e->>'id'=p.id::text AND public.claim_gig_tip_delivery() IS NULL,'Live notice lease claimed twice');
 r:=public.read_gig_tip_delivery(p.id,(e->>'lease_id')::uuid);
 PERFORM pg_temp.tip_assert(r->>'eligible'='true' AND r->'notification'->>'id'=note_id::text,'Exact captured notice not eligible');
 UPDATE public."Notification" SET is_read=true WHERE id=note_id;
 PERFORM pg_temp.tip_assert(public.read_gig_tip_delivery(p.id,(e->>'lease_id')::uuid)->>'eligible'='true','Reading notice invalidated delivery');
 UPDATE public."Payment" SET metadata=metadata||'{"unrelated_new_metadata":"retained"}' WHERE id=p.id;
 PERFORM pg_temp.tip_assert(NOT public.finish_gig_tip_delivery(p.id,gen_random_uuid(),'done'),'Wrong lease completed delivery');
 PERFORM pg_temp.tip_assert(public.finish_gig_tip_delivery(p.id,(e->>'lease_id')::uuid,'retry','provider_outcome_unknown'),'Unknown outcome not retained');
 SELECT pay.* INTO p FROM public."Payment" pay WHERE pay.id=pg_temp.tip_id(310);
 PERFORM pg_temp.tip_assert(p.metadata->>'unrelated_new_metadata'='retained' AND p.metadata->'gig_tip_original_v1'=original,'Delivery receipt overwrote current metadata/original');
 PERFORM pg_temp.tip_assert(public.claim_gig_tip_delivery() IS NULL,'Retry backoff bypassed');
 PERFORM set_config('app.gig_tip_delivery','on',true);
 UPDATE public."Payment" SET metadata=jsonb_set(metadata,'{gig_tip_delivery_v1,retry_at}',to_jsonb(clock_timestamp()-interval '1 second')) WHERE id=p.id;
 PERFORM set_config('app.gig_tip_delivery','off',true);
 r:=public.claim_gig_tip_delivery();
 PERFORM pg_temp.tip_assert(r->>'id'=p.id::text AND r->>'lease_id'<>e->>'lease_id','Retry changed payment or reused old lease');
 PERFORM pg_temp.tip_assert(NOT public.finish_gig_tip_delivery(p.id,(e->>'lease_id')::uuid,'done'),'Old lease acknowledged newer attempt');
 PERFORM pg_temp.tip_assert(public.finish_gig_tip_delivery(p.id,(r->>'lease_id')::uuid,'done'),'Matching delivery receipt not saved');
 UPDATE public."Payment" SET updated_at=now() WHERE id=p.id;
 PERFORM pg_temp.tip_assert(public.claim_gig_tip_delivery() IS NULL AND (SELECT is_read FROM public."Notification" WHERE id=note_id),'Terminal replay redelivered/reset a read notification');
 DELETE FROM public."Notification" WHERE id=note_id;
 UPDATE public."Payment" SET updated_at=now() WHERE id=p.id;
 PERFORM pg_temp.tip_assert(NOT EXISTS(SELECT FROM public."Notification" WHERE id=note_id),'Deleted terminal notice recreated');
END $$;
-- Fresh capture rows exercise queue suppression and transaction rollback, without
-- pretending historical adoption is a newly captured charge.
INSERT INTO public."MailPreferences"(user_id,push_notifications) VALUES(pg_temp.tip_id(2),true)
 ON CONFLICT(user_id) DO UPDATE SET push_notifications=true;
CREATE FUNCTION pg_temp.capture_tip(i integer) RETURNS void LANGUAGE sql AS $$
 INSERT INTO public."Payment"(id,gig_id,payer_id,payee_id,payment_type,amount_total,amount_subtotal,amount_platform_fee,amount_to_payee,
  tip_amount,currency,payment_status,payment_succeeded_at,captured_at,stripe_charge_id,stripe_payment_intent_id,metadata)
 VALUES(pg_temp.tip_id(i),pg_temp.tip_id(110),pg_temp.tip_id(1),pg_temp.tip_id(2),'tip',500,500,0,500,500,'usd','captured_hold',
  now(),now(),'ch_delivery'||i,'pi_delivery'||i,'{}') $$;
DO $$ DECLARE i integer; e jsonb; r jsonb; note_id uuid; BEGIN
 FOR i IN 810..814 LOOP
  PERFORM pg_temp.capture_tip(i); e:=public.claim_gig_tip_delivery();
  PERFORM pg_temp.tip_assert(e->>'id'=pg_temp.tip_id(i)::text,'Wrong capture claimed');
  r:=public.read_gig_tip_delivery(pg_temp.tip_id(i),(e->>'lease_id')::uuid); note_id:=(r->'notification'->>'id')::uuid;
  PERFORM pg_temp.tip_assert(r->>'pushAllowedAtCapture'='true' AND r->>'eligible'='true','Enabled capture consent missing');
  CASE i
   WHEN 810 THEN DELETE FROM public."Notification" WHERE id=note_id;
   WHEN 811 THEN UPDATE public."Notification" SET link='/gigs/other' WHERE id=note_id;
   WHEN 812 THEN UPDATE public."Notification" SET metadata=metadata||'{"amount":1}' WHERE id=note_id;
   WHEN 813 THEN UPDATE public."Payment" SET payment_status='refunded_partial',refunded_amount=100 WHERE id=pg_temp.tip_id(i);
   WHEN 814 THEN UPDATE public."Payment" SET payee_id=pg_temp.tip_id(3) WHERE id=pg_temp.tip_id(i);
  END CASE;
  PERFORM pg_temp.tip_assert(public.read_gig_tip_delivery(pg_temp.tip_id(i),(e->>'lease_id')::uuid)->>'eligible'='false','Changed/deleted financial notice remained deliverable');
  PERFORM pg_temp.tip_assert(public.finish_gig_tip_delivery(pg_temp.tip_id(i),(e->>'lease_id')::uuid,'suppressed'),'Suppression not durable');
 END LOOP;
 -- Conflicting note storage fails the entire capture, leaving no partial payment.
 INSERT INTO public."Notification"(user_id,type,title,idempotency_key) VALUES(pg_temp.tip_id(3),'tip_received','Synthetic conflict','gig-tip-received:'||pg_temp.tip_id(815));
 BEGIN PERFORM pg_temp.capture_tip(815); RAISE EXCEPTION 'Capture committed without its exact notice'; EXCEPTION WHEN unique_violation THEN NULL; END;
 PERFORM pg_temp.tip_assert(NOT EXISTS(SELECT FROM public."Payment" WHERE id=pg_temp.tip_id(815)),'Failed notice storage left partial capture');
 DELETE FROM public."Notification" WHERE idempotency_key='gig-tip-received:'||pg_temp.tip_id(815);
 PERFORM pg_temp.capture_tip(815); e:=public.claim_gig_tip_delivery();
 PERFORM pg_temp.tip_assert(e->>'id'=pg_temp.tip_id(815)::text,'Exact capture retry did not recover notice');
 PERFORM public.finish_gig_tip_delivery(pg_temp.tip_id(815),(e->>'lease_id')::uuid,'done');
END $$;
-- An older in-app notice keeps its identity/read state and is never re-alerted.
DO $$ DECLARE note_id uuid; d jsonb; BEGIN
 INSERT INTO public."Notification"(user_id,type,title,metadata,is_read) VALUES(pg_temp.tip_id(2),'tip_received','Existing historical notice',
  jsonb_build_object('payment_id',pg_temp.tip_id(816)),true) RETURNING id INTO note_id;
 PERFORM pg_temp.capture_tip(816);
 SELECT metadata->'gig_tip_delivery_v1' INTO d FROM public."Payment" WHERE id=pg_temp.tip_id(816);
 PERFORM pg_temp.tip_assert(d->>'notification_id'=note_id::text AND d->>'state'='suppressed','Existing notice was replaced/requeued');
 PERFORM pg_temp.tip_assert((SELECT is_read AND title='Existing historical notice' FROM public."Notification" WHERE id=note_id),'Existing notice content/read state changed');
 PERFORM pg_temp.tip_assert(public.claim_gig_tip_delivery() IS NULL,'Historical notice replayed');
 PERFORM pg_temp.tip_assert(NOT has_function_privilege('anon','public.claim_gig_tip_delivery()','EXECUTE')
  AND NOT has_function_privilege('anon','public.read_gig_tip_delivery(uuid,uuid)','EXECUTE')
  AND NOT has_function_privilege('anon','public.finish_gig_tip_delivery(uuid,uuid,text,text)','EXECUTE'),'Anonymous tip delivery privilege');
END $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.claim_gig_tip_delivery(); RAISE EXCEPTION 'Client claimed tip delivery'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.read_gig_tip_delivery(NULL,NULL); RAISE EXCEPTION 'Client read tip delivery'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.finish_gig_tip_delivery(NULL,NULL,'done'); RAISE EXCEPTION 'Client finished tip delivery'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.register_legacy_gig_tip(NULL,NULL,NULL,NULL,NULL,NULL); RAISE EXCEPTION 'Client registered legacy payment'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.preview_gig_tip(NULL,NULL); RAISE EXCEPTION 'Client preview RPC bypassed API scope'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.read_gig_tip_original(NULL,NULL); RAISE EXCEPTION 'Client read original RPC'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.reserve_gig_tip_original(NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL); RAISE EXCEPTION 'Client reserved original RPC'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.record_gig_tip_original(NULL,NULL,NULL,NULL); RAISE EXCEPTION 'Client recorded provider receipt'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.claim_gig_tip_original(NULL,NULL); RAISE EXCEPTION 'Client leased provider'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.prepare_gig_tip_provider(NULL,NULL,NULL,NULL); RAISE EXCEPTION 'Client prepared provider'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.cancel_unstarted_gig_tip(NULL,NULL,NULL); RAISE EXCEPTION 'Client canceled original'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.release_gig_tip_original(NULL,NULL,NULL); RAISE EXCEPTION 'Client released lease'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO public."Payment"(id) VALUES(pg_temp.tip_id(999)); RAISE EXCEPTION 'Client inserted Payment'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
