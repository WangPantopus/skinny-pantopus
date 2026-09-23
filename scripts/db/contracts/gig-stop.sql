BEGIN;
CREATE FUNCTION pg_temp.stop_id(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('aac80000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid $$;
INSERT INTO auth.users(id,email) SELECT pg_temp.stop_id(i),'stop-'||i||'@example.invalid' FROM generate_series(1,3) i;
INSERT INTO public."User"(id,email,username,name) SELECT pg_temp.stop_id(i),'stop-'||i||'@example.invalid','stop_contract_'||i,'Stop contract' FROM generate_series(1,3) i;
INSERT INTO public."Gig"(id,user_id,created_by,title,description,price,status,accepted_by,accepted_at,cancellation_policy)
 SELECT pg_temp.stop_id(100+i),pg_temp.stop_id(1),pg_temp.stop_id(1),'Stop contract','Synthetic',10,'assigned',pg_temp.stop_id(2),now(),'flexible' FROM generate_series(1,8) i;
INSERT INTO public."GigBid"(id,gig_id,user_id,bid_amount,status) SELECT pg_temp.stop_id(500+i),pg_temp.stop_id(100+i),pg_temp.stop_id(2),10,'accepted' FROM generate_series(1,8) i;
INSERT INTO public."GigBid"(id,gig_id,user_id,bid_amount,status) VALUES(pg_temp.stop_id(602),pg_temp.stop_id(102),pg_temp.stop_id(3),11,'rejected');
UPDATE public."Gig" SET last_worker_reminder_at=now(),auto_reminder_count=3 WHERE id=pg_temp.stop_id(102);
INSERT INTO public."Payment"(id,gig_id,payer_id,payee_id,amount_total,amount_subtotal,amount_platform_fee,amount_to_payee,stripe_customer_id,stripe_payment_intent_id,payment_status)
 SELECT pg_temp.stop_id(300+i),pg_temp.stop_id(100+i),pg_temp.stop_id(1),pg_temp.stop_id(2),1000,1000,150,850,'cus_stop','pi_stop'||i,'authorized' FROM generate_series(1,8) i;
UPDATE public."Gig" g SET payment_id=p.id,payment_status='authorized' FROM public."Payment" p WHERE p.gig_id=g.id AND g.id::text LIKE 'aac80000-%';
INSERT INTO public."Gig"(id,user_id,created_by,title,description,price,status,accepted_by) VALUES
 (pg_temp.stop_id(109),pg_temp.stop_id(1),pg_temp.stop_id(1),'Open stop','Synthetic',5,'open',NULL),
 (pg_temp.stop_id(110),pg_temp.stop_id(1),pg_temp.stop_id(1),'Free stop','Synthetic',0,'assigned',pg_temp.stop_id(2));
CREATE FUNCTION pg_temp.stop_begin(i integer,action text DEFAULT 'cancel',actor integer DEFAULT 1,request_number integer DEFAULT NULL,reason text DEFAULT NULL,rollback_mode text DEFAULT NULL)
 RETURNS jsonb LANGUAGE sql AS $$ SELECT public.begin_gig_stop(pg_temp.stop_id(100+i),pg_temp.stop_id(actor),repeat('a',64),pg_temp.stop_id(coalesce(request_number,800+i)),action,
 public.gig_stop_terms(g,action),reason,rollback_mode) FROM public."Gig" g WHERE id=pg_temp.stop_id(100+i) $$;
CREATE FUNCTION pg_temp.stop_proof(i integer) RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('id','pi_stop'||i,'customer','cus_stop',
 'amount',1000,'currency','usd','capture_method','manual','status','canceled','amount_received',0,'amount_capturable',0,'amount_captured',0,
 'charge_id','ch_stop'||i,'charge_captured',false,'charge_refunded',false,'charge_amount_refunded',0,
 'payer_id',pg_temp.stop_id(1),'payee_id',pg_temp.stop_id(2),'gig_id',pg_temp.stop_id(100+i)) $$;
SET LOCAL ROLE service_role;
DO $$ DECLARE d jsonb; r jsonb; old_terms jsonb; frozen jsonb; proof jsonb; lease uuid; marker text; BEGIN
 d:=public.read_gig_stop_preview(pg_temp.stop_id(101),pg_temp.stop_id(1),'close');
 IF d->>'eligible'<>'false' OR d->>'unavailableReason'<>'ASSIGNMENT_CHANGED' THEN RAISE EXCEPTION 'Close bypassed assignment %',d; END IF;
 IF pg_temp.stop_begin(1,'reopen_bidding',3)->>'error' IS DISTINCT FROM 'FORBIDDEN' THEN RAISE EXCEPTION 'Foreign actor admitted'; END IF;
 FOREACH marker IN ARRAY ARRAY['wallet_credited','paid','in_transit','failed','reversed','partially_reversed'] LOOP
  UPDATE public."Payment" SET transfer_status=marker WHERE id=pg_temp.stop_id(301);
  IF pg_temp.stop_begin(1)->>'error' IS DISTINCT FROM 'PAYMENT_REVIEW' THEN RAISE EXCEPTION 'Legacy release marker admitted %',marker; END IF;
 END LOOP;
 UPDATE public."Payment" SET transfer_status=NULL WHERE id=pg_temp.stop_id(301);
 IF public.read_gig_stop_preview(pg_temp.stop_id(101),pg_temp.stop_id(1),'cancel')->>'eligible' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Valid missing legacy transfer marker was denied'; END IF;
 UPDATE public."Payment" SET transfer_status='pending',transfer_completed_at=now() WHERE id=pg_temp.stop_id(301);
 IF pg_temp.stop_begin(1)->>'error' IS DISTINCT FROM 'PAYMENT_REVIEW' THEN RAISE EXCEPTION 'Missing transfer ID erased completion evidence'; END IF;
 UPDATE public."Payment" SET transfer_completed_at=NULL,escrow_released_at=now() WHERE id=pg_temp.stop_id(301);
 IF pg_temp.stop_begin(1)->>'error' IS DISTINCT FROM 'PAYMENT_REVIEW' THEN RAISE EXCEPTION 'Escrow release admitted'; END IF;
 UPDATE public."Payment" SET escrow_released_at=NULL WHERE id=pg_temp.stop_id(301);
 old_terms:=(public.read_gig_stop_preview(pg_temp.stop_id(101),pg_temp.stop_id(1),'cancel'))->'terms';
 r:=public.begin_gig_stop(pg_temp.stop_id(101),pg_temp.stop_id(1),repeat('a',64),pg_temp.stop_id(801),'cancel',old_terms||'{"amountCents":2000}');
 IF r->>'error' IS DISTINCT FROM 'TERMS_CHANGED' THEN RAISE EXCEPTION 'Changed amount accepted %',r; END IF;
 UPDATE public."Gig" SET cancellation_policy='standard',accepted_at=now()-interval '2 hours' WHERE id=pg_temp.stop_id(101);
 -- P04/P05: a late owner cancel charges the policy fee from the live hold; a worker cancel stays fee-free in review.
 d:=public.read_gig_stop_preview(pg_temp.stop_id(101),pg_temp.stop_id(1),'cancel');
 IF d->>'eligible'<>'true' OR d->>'financialAction'<>'fee' OR (d->'terms'->>'policyFeeCents')::integer<>50 THEN RAISE EXCEPTION 'Fee silently waived %',d; END IF;
 IF public.read_gig_stop_preview(pg_temp.stop_id(101),pg_temp.stop_id(2),'cancel')->>'unavailableReason' IS DISTINCT FROM 'FEE_POLICY_REVIEW' THEN RAISE EXCEPTION 'Worker cancel charged a fee'; END IF;
 UPDATE public."Gig" SET cancellation_policy='flexible',accepted_at=now() WHERE id=pg_temp.stop_id(101);
 frozen:=(SELECT public.gig_stop_payment_snapshot(p) FROM public."Payment" p WHERE id=pg_temp.stop_id(301));
 d:=pg_temp.stop_begin(1); IF d ? 'error' OR d->'request'->>'state'<>'pending' THEN RAISE EXCEPTION 'Exact reservation failed %',d; END IF;
 old_terms:=d->'request'->'terms';
 r:=public.begin_gig_stop(pg_temp.stop_id(101),pg_temp.stop_id(1),repeat('b',64),pg_temp.stop_id(801),'cancel',old_terms);
 IF r->'request'->>'original_session_scope'<>repeat('a',64) THEN RAISE EXCEPTION 'Original session audit was rebound'; END IF;
 IF public.begin_gig_stop(pg_temp.stop_id(101),pg_temp.stop_id(1),repeat('b',64),pg_temp.stop_id(801),'cancel',old_terms,'other')->>'error' IS DISTINCT FROM 'REQUEST_CONFLICT' THEN RAISE EXCEPTION 'Changed retry reason accepted'; END IF;
 IF pg_temp.stop_begin(1,'cancel',1,899)->>'error' IS DISTINCT FROM 'STOP_ACTIVE' THEN RAISE EXCEPTION 'Second active stop admitted'; END IF;
 IF EXISTS(SELECT FROM public."GigStopDelivery") THEN RAISE EXCEPTION 'Pending stop notified completion'; END IF;
 BEGIN UPDATE public."Gig" SET status='in_progress',started_at=now() WHERE id=pg_temp.stop_id(101); RAISE EXCEPTION 'Worker started during stop'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN UPDATE public."Gig" SET payment_id=NULL,accepted_by=NULL,status='open' WHERE id=pg_temp.stop_id(101); RAISE EXCEPTION 'Pending assignment replaced'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN UPDATE public."GigBid" SET bid_amount=11 WHERE id=pg_temp.stop_id(501); RAISE EXCEPTION 'Accepted bid changed'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN UPDATE public."Payment" SET payment_status='capture_pending',capture_attempts=1 WHERE id=pg_temp.stop_id(301); RAISE EXCEPTION 'Capture admitted'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN UPDATE public."Payment" SET transfer_status='wallet_credited' WHERE id=pg_temp.stop_id(301); RAISE EXCEPTION 'Late release marker escaped frozen terms'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN PERFORM public.begin_legacy_gig_authorization(pg_temp.stop_id(101),pg_temp.stop_id(1)); RAISE EXCEPTION 'New authorization admitted'; EXCEPTION WHEN check_violation THEN NULL; END;
 r:=public.reserve_payment_refund(pg_temp.stop_id(301),pg_temp.stop_id(898)::text,pg_temp.stop_id(1),'payer',NULL,'requested_by_customer',NULL,
  (SELECT public.refund_payment_snapshot(p) FROM public."Payment" p WHERE id=pg_temp.stop_id(301)),'release');
 IF NOT (r ? 'error') THEN RAISE EXCEPTION 'Unrelated refund admitted'; END IF;
 BEGIN INSERT INTO public."GigBid"(gig_id,user_id,bid_amount,status) VALUES(pg_temp.stop_id(101),pg_temp.stop_id(3),11,'pending');
  RAISE EXCEPTION 'New bid admitted during stop'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN INSERT INTO public."GigPaymentAcceptance"(gig_id,bid_id,payer_id,payee_id,amount,state)
  VALUES(pg_temp.stop_id(101),pg_temp.stop_id(501),pg_temp.stop_id(1),pg_temp.stop_id(2),1000,'initializing');
  RAISE EXCEPTION 'Modern checkout admitted during stop'; EXCEPTION WHEN check_violation THEN NULL; END;
 d:=public.claim_gig_stop(pg_temp.stop_id(801),pg_temp.stop_id(1));lease:=(d->'request'->>'lease_id')::uuid;
 IF lease IS NULL THEN RAISE EXCEPTION 'Lease missing %',d; END IF;
 IF public.claim_gig_stop(pg_temp.stop_id(801),pg_temp.stop_id(1))->>'error' IS DISTINCT FROM 'BUSY' THEN RAISE EXCEPTION 'Lease duplicated'; END IF;
 IF public.finish_gig_stop(pg_temp.stop_id(801),pg_temp.stop_id(1),pg_temp.stop_proof(1)||'{"amount_received":1}')->>'error' IS DISTINCT FROM 'INVALID_PROOF' THEN RAISE EXCEPTION 'Capture accepted as release'; END IF;
 proof:=pg_temp.stop_proof(1);
 IF NOT public.record_gig_stop_evidence(pg_temp.stop_id(801),proof) THEN RAISE EXCEPTION 'Exact evidence not recorded'; END IF;
 d:=public.finish_gig_stop(pg_temp.stop_id(801),pg_temp.stop_id(1),proof);
 IF d->'request'->>'state' IS DISTINCT FROM 'completed' OR d->'request'->'receipt'->>'gigStatus' IS DISTINCT FROM 'cancelled' THEN RAISE EXCEPTION 'Exact release not completed %',d; END IF;
 IF (SELECT public.gig_stop_payment_snapshot(p) FROM public."Payment" p WHERE id=pg_temp.stop_id(301)) IS DISTINCT FROM frozen THEN RAISE EXCEPTION 'Original financial identity changed'; END IF;
 IF (SELECT count(*) FROM public."GigStopDelivery" WHERE request_id=pg_temp.stop_id(801))<>1 THEN RAISE EXCEPTION 'Terminal notice missing'; END IF;
 PERFORM public.finish_gig_stop(pg_temp.stop_id(801),pg_temp.stop_id(1),proof);
 IF (SELECT count(*) FROM public."GigStopDelivery" WHERE request_id=pg_temp.stop_id(801))<>1 THEN RAISE EXCEPTION 'Replay duplicated notices'; END IF;
END $$;
DO $$ DECLARE d jsonb; BEGIN
 d:=pg_temp.stop_begin(2,'worker_release',2);
 IF d ? 'error' THEN RAISE EXCEPTION 'Worker release failed %',d; END IF;
 d:=public.finish_gig_stop(pg_temp.stop_id(802),pg_temp.stop_id(2),pg_temp.stop_proof(2));
 IF d->'gig'->>'status'<>'open' OR d->'gig'->>'payment_id' IS NOT NULL OR d->'gig'->>'accepted_by' IS NOT NULL THEN RAISE EXCEPTION 'Worker release did not unassign atomically %',d; END IF;
 IF (SELECT status FROM public."GigBid" WHERE id=pg_temp.stop_id(502))<>'rejected' THEN RAISE EXCEPTION 'Worker bid was not rejected'; END IF;
 IF (SELECT status FROM public."GigBid" WHERE id=pg_temp.stop_id(602))<>'rejected' THEN RAISE EXCEPTION 'Manually rejected bid was reopened'; END IF;
 IF d->'gig'->>'last_worker_reminder_at' IS NOT NULL OR d->'gig'->>'auto_reminder_count'<>'0' THEN RAISE EXCEPTION 'Worker reminders were not cleared'; END IF;
 d:=public.read_gig_stop_request(pg_temp.stop_id(102),pg_temp.stop_id(2),pg_temp.stop_id(802));
 IF d ? 'error' THEN RAISE EXCEPTION 'Former worker lost exact historical receipt'; END IF;
 d:=pg_temp.stop_begin(3,'reopen_bidding',1,NULL,NULL,'payment_setup_aborted');
 d:=public.finish_gig_stop(pg_temp.stop_id(803),pg_temp.stop_id(1),pg_temp.stop_proof(3));
 IF (SELECT status FROM public."GigBid" WHERE id=pg_temp.stop_id(503))<>'pending' THEN RAISE EXCEPTION 'Payment-abort bid not restored'; END IF;
 -- A safely reopened task may close without losing its historical settled payment.
 d:=pg_temp.stop_begin(2,'close',1,892);
 IF d ? 'error' THEN RAISE EXCEPTION 'Verified reopened task cannot close %',d; END IF;
 d:=public.finish_gig_stop(pg_temp.stop_id(892),pg_temp.stop_id(1));
 IF d->'request'->>'state'<>'completed' THEN RAISE EXCEPTION 'Unpaid close did not finish'; END IF;
END $$;
DO $$ DECLARE d jsonb; p public."Payment"; tx public."WalletTransaction"; BEGIN
 UPDATE public."Payment" SET payment_status='captured_hold',captured_at=now(),stripe_charge_id='ch_stop4' WHERE id=pg_temp.stop_id(304);
 IF pg_temp.stop_begin(4,'worker_release',2)->>'error' IS DISTINCT FROM 'CAPTURED_POLICY_REVIEW' THEN RAISE EXCEPTION 'Worker released captured money without policy'; END IF;
 d:=pg_temp.stop_begin(4);
 IF d ? 'error' OR d->'request'->>'financial_action'<>'refund' THEN RAISE EXCEPTION 'Captured zero-fee refund not reserved %',d; END IF;
 IF EXISTS(SELECT FROM public."PaymentRefundRequest" WHERE id=pg_temp.stop_id(804)) THEN RAISE EXCEPTION 'Refund froze amount before provider discovery'; END IF;
 BEGIN PERFORM public.wallet_credit(pg_temp.stop_id(2),850,'gig_income',NULL,pg_temp.stop_id(304),pg_temp.stop_id(104),pg_temp.stop_id(1),NULL,'stop-income');
  RAISE EXCEPTION 'Legacy wallet credit escaped pending stop'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN PERFORM public.wallet_credit_before_refund_fence(pg_temp.stop_id(2),850,'gig_income',NULL,pg_temp.stop_id(304),pg_temp.stop_id(104),pg_temp.stop_id(1),NULL,'stop-inner-income');
  RAISE EXCEPTION 'Inner wallet credit escaped pending stop'; EXCEPTION WHEN check_violation THEN NULL; END;
 IF EXISTS(SELECT FROM public."WalletTransaction" WHERE payment_id=pg_temp.stop_id(304)) OR EXISTS(SELECT FROM public."Wallet" WHERE user_id=pg_temp.stop_id(2)) THEN
  RAISE EXCEPTION 'Rejected income created a wallet or ledger entry'; END IF;
 BEGIN PERFORM public.wallet_credit_before_gig_stop(pg_temp.stop_id(2),850,'gig_income');
  RAISE EXCEPTION 'Service bypassed pending-stop wallet wrapper'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.settle_paid_gig_wallet_income_before_stop_fence(pg_temp.stop_id(304),'{}');
  RAISE EXCEPTION 'Service bypassed settlement lock ordering'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 -- A separately charged tip retains its own payment identity and remains
 -- eligible; neither this positive control nor its replay funds the stop.
 INSERT INTO public."Payment"(id,gig_id,payer_id,payee_id,amount_total,amount_subtotal,amount_platform_fee,amount_to_payee,payment_status,payment_type)
 VALUES(pg_temp.stop_id(399),pg_temp.stop_id(104),pg_temp.stop_id(1),pg_temp.stop_id(2),100,100,0,100,'captured_hold','tip');
 tx:=public.wallet_credit(pg_temp.stop_id(2),100,'tip_income',NULL,pg_temp.stop_id(399),pg_temp.stop_id(104),pg_temp.stop_id(1),NULL,'stop-separate-tip');
 IF tx.amount<>100 OR (public.wallet_credit(pg_temp.stop_id(2),100,'tip_income',NULL,pg_temp.stop_id(399),pg_temp.stop_id(104),pg_temp.stop_id(1),NULL,'stop-separate-tip')).id<>tx.id
  OR (SELECT balance FROM public."Wallet" WHERE user_id=pg_temp.stop_id(2))<>100 THEN RAISE EXCEPTION 'Separate tip or exact replay changed'; END IF;
 d:=public.finish_gig_stop(pg_temp.stop_id(804),pg_temp.stop_id(1));
 IF d->'request'->>'state'<>'pending' THEN RAISE EXCEPTION 'Pending refund closed task'; END IF;
 SELECT * INTO p FROM public."Payment" WHERE id=pg_temp.stop_id(304);
 -- An external refund must be accounted for before freezing the remaining amount.
 PERFORM public.record_payment_refund_receipts(p.id,public.refund_payment_snapshot(p),jsonb_build_array(jsonb_build_object(
  'id','re_stopexternal','intentId',p.stripe_payment_intent_id,'chargeId',p.stripe_charge_id,'amountCents',200,'currency','usd','status','succeeded','requestId',NULL,'createdAt',now())));
 d:=public.reserve_payment_refund(p.id,pg_temp.stop_id(804)::text,pg_temp.stop_id(1),'policy',NULL,'requested_by_customer',NULL,public.refund_payment_snapshot(p),'refund');
 IF d ? 'error' OR d->'request'->>'amount_cents'<>'800' THEN RAISE EXCEPTION 'Provider-reconciled remaining amount not frozen %',d; END IF;
 IF public.claim_payment_refund(pg_temp.stop_id(804),pg_temp.stop_id(1),'policy',gen_random_uuid())->>'claimed' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Exact policy refund lease missing'; END IF;
 PERFORM public.record_payment_refund_receipts(p.id,public.refund_payment_snapshot(p),jsonb_build_array(jsonb_build_object(
  'id','re_stop4','intentId',p.stripe_payment_intent_id,'chargeId',p.stripe_charge_id,'amountCents',800,'currency','usd','status','pending','requestId',pg_temp.stop_id(804),'createdAt',now())));
 IF public.finish_gig_stop(pg_temp.stop_id(804),pg_temp.stop_id(1))->'request'->>'state'<>'pending' THEN RAISE EXCEPTION 'Provider pending became completion'; END IF;
 PERFORM public.record_payment_refund_receipts(p.id,public.refund_payment_snapshot(p),jsonb_build_array(jsonb_build_object(
  'id','re_stop4','intentId',p.stripe_payment_intent_id,'chargeId',p.stripe_charge_id,'amountCents',800,'currency','usd','status','succeeded','requestId',pg_temp.stop_id(804),'createdAt',now())));
 d:=public.finish_gig_stop(pg_temp.stop_id(804),pg_temp.stop_id(1));
 IF d->'request'->'receipt'->>'financialStatus' IS DISTINCT FROM 'refunded' THEN RAISE EXCEPTION 'Exact refund did not finish stop %',d; END IF;
END $$;
DO $$ DECLARE d jsonb; BEGIN
 UPDATE public."User" SET account_type='business' WHERE id=pg_temp.stop_id(1);
 INSERT INTO public."BusinessTeam"(business_user_id,user_id,role_base) VALUES(pg_temp.stop_id(1),pg_temp.stop_id(3),'staff');
 INSERT INTO public."BusinessPermissionOverride"(business_user_id,user_id,permission,allowed) VALUES
 (pg_temp.stop_id(1),pg_temp.stop_id(3),'gigs.manage',true),(pg_temp.stop_id(1),pg_temp.stop_id(3),'gigs.post',false);
 d:=pg_temp.stop_begin(5,'reopen_bidding',3); IF d ? 'error' THEN RAISE EXCEPTION 'Delegate denied %',d; END IF;
 UPDATE public."BusinessTeam" SET is_active=false WHERE business_user_id=pg_temp.stop_id(1) AND user_id=pg_temp.stop_id(3);
 IF public.claim_gig_stop(pg_temp.stop_id(805),pg_temp.stop_id(3))->>'error' IS DISTINCT FROM 'FORBIDDEN' THEN RAISE EXCEPTION 'Revoked delegate obtained provider lease'; END IF;
 IF NOT public.record_gig_stop_evidence(pg_temp.stop_id(805),pg_temp.stop_proof(5)) THEN RAISE EXCEPTION 'Truth after actor revocation lost'; END IF;
 IF public.finish_gig_stop(pg_temp.stop_id(805),pg_temp.stop_id(3),pg_temp.stop_proof(5))->>'error' IS DISTINCT FROM 'FORBIDDEN' THEN RAISE EXCEPTION 'Revoked delegate completed task mutation'; END IF;
 d:=pg_temp.stop_begin(6);
 UPDATE public."Payment" SET payment_status='disputed',dispute_id='dp_stop' WHERE id=pg_temp.stop_id(306);
 IF public.claim_gig_stop(pg_temp.stop_id(806),pg_temp.stop_id(1))->>'error' IS DISTINCT FROM 'DISPUTED' THEN RAISE EXCEPTION 'Dispute allowed provider mutation'; END IF;
 IF NOT public.record_gig_stop_evidence(pg_temp.stop_id(806),pg_temp.stop_proof(6)) THEN RAISE EXCEPTION 'Dispute obscured actual financial truth'; END IF;
 IF public.finish_gig_stop(pg_temp.stop_id(806),pg_temp.stop_id(1),pg_temp.stop_proof(6))->>'error' IS DISTINCT FROM 'DISPUTED' THEN RAISE EXCEPTION 'Disputed task falsely closed'; END IF;
 d:=public.claim_gig_stop_reconciliation(100);
 IF NOT (d @> jsonb_build_array(jsonb_build_object('id',pg_temp.stop_id(806)))) THEN RAISE EXCEPTION 'Pending request was not scheduled'; END IF;
 IF jsonb_array_length(public.claim_gig_stop_reconciliation(100))<>0 THEN RAISE EXCEPTION 'Pending requests did not rotate fairly'; END IF;
 UPDATE public."Payment" SET stripe_payment_intent_id=NULL,payment_status='ready_to_authorize' WHERE id=pg_temp.stop_id(307);
 d:=pg_temp.stop_begin(7);d:=public.finish_gig_stop(pg_temp.stop_id(807),pg_temp.stop_id(1));
 IF d->'request'->'receipt'->>'financialStatus'<>'none' THEN RAISE EXCEPTION 'Never attempted scheduled payment not stopped %',d; END IF;
 UPDATE public."Payment" SET stripe_payment_intent_id=NULL,payment_status='authorization_failed' WHERE id=pg_temp.stop_id(308);
 IF pg_temp.stop_begin(8)->>'error' IS DISTINCT FROM 'PROVIDER_OUTCOME_UNKNOWN' THEN RAISE EXCEPTION 'Unknown missing intent called zero-charge'; END IF;
 d:=pg_temp.stop_begin(9,'close');d:=public.finish_gig_stop(pg_temp.stop_id(809),pg_temp.stop_id(1));
 IF d->'request'->>'state'<>'completed' THEN RAISE EXCEPTION 'Unpaid open close failed'; END IF;
 d:=pg_temp.stop_begin(10,'worker_release',2);d:=public.finish_gig_stop(pg_temp.stop_id(810),pg_temp.stop_id(2));
 IF d->'gig'->>'status'<>'open' THEN RAISE EXCEPTION 'Free assignment could not release'; END IF;
END $$;
DO $$ DECLARE e jsonb; d jsonb; note uuid; BEGIN
 -- Earlier worker-release notices correctly become stale when that task is
 -- subsequently closed. Select the unchanged cancellation for this proof.
 UPDATE public."GigStopDelivery" SET retry_at=clock_timestamp()+interval '1 day' WHERE request_id<>pg_temp.stop_id(801);
 e:=public.claim_gig_stop_delivery();
 d:=public.read_gig_stop_delivery((e->>'id')::uuid,(e->>'lease_id')::uuid);
 IF d->>'eligible' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Verified notice missing %',d; END IF;
 note:=(d->'notification'->>'id')::uuid;
 DELETE FROM public."Notification" WHERE id=note;
 d:=public.read_gig_stop_delivery((e->>'id')::uuid,(e->>'lease_id')::uuid);
 IF d->>'eligible' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Deleted notice still eligible'; END IF;
 PERFORM public.materialize_gig_stop_notices((e->>'request_id')::uuid);
 IF EXISTS(SELECT FROM public."Notification" WHERE id=note) THEN RAISE EXCEPTION 'Deleted notice recreated'; END IF;
 IF NOT public.finish_gig_stop_delivery((e->>'id')::uuid,(e->>'lease_id')::uuid,'suppressed') THEN RAISE EXCEPTION 'Delivery lease could not finish'; END IF;
END $$;
DO $$ DECLARE d jsonb; terms jsonb; explanation text:='other: Private scheduling detail'; BEGIN
 INSERT INTO public."Gig"(id,user_id,created_by,title,description,price,status)
 VALUES(pg_temp.stop_id(111),pg_temp.stop_id(1),pg_temp.stop_id(1),'Private explanation','Synthetic',0,'open');
 d:=pg_temp.stop_begin(11,'close',1,NULL,explanation);
 IF d ? 'error' THEN RAISE EXCEPTION 'Private explanation not reserved %',d; END IF;
 terms:=d->'request'->'terms';
 d:=public.begin_gig_stop(pg_temp.stop_id(111),pg_temp.stop_id(1),repeat('b',64),pg_temp.stop_id(811),'close',terms,explanation);
 IF d ? 'error' OR d->'request'->>'reason' IS DISTINCT FROM explanation THEN RAISE EXCEPTION 'Exact explanation not recovered'; END IF;
 IF public.begin_gig_stop(pg_temp.stop_id(111),pg_temp.stop_id(1),repeat('b',64),pg_temp.stop_id(811),'close',terms,'other: Changed detail')->>'error'
  IS DISTINCT FROM 'REQUEST_CONFLICT' THEN RAISE EXCEPTION 'Retry replaced the original explanation'; END IF;
 d:=public.finish_gig_stop(pg_temp.stop_id(811),pg_temp.stop_id(1));
 IF d->'request'->>'state' IS DISTINCT FROM 'completed' THEN RAISE EXCEPTION 'Private explanation stop not completed %',d; END IF;
 IF (SELECT cancellation_reason FROM public."Gig" WHERE id=pg_temp.stop_id(111)) IS DISTINCT FROM 'other'
  THEN RAISE EXCEPTION 'Private explanation exposed in public task timeline'; END IF;
 IF (SELECT reason FROM public."GigStopRequest" WHERE id=pg_temp.stop_id(811)) IS DISTINCT FROM explanation
  THEN RAISE EXCEPTION 'Private explanation lost from original request'; END IF;
 d:=public.finish_gig_stop(pg_temp.stop_id(811),pg_temp.stop_id(1));
 IF d->'request'->>'reason' IS DISTINCT FROM explanation THEN RAISE EXCEPTION 'Completed replay lost original explanation'; END IF;
END $$;
DO $$ DECLARE d jsonb; pay public."Payment"; capture jsonb; release jsonb; incident jsonb; strikes integer; BEGIN
 -- P04/P05 poster no-show fee: scheduled-start admission, one incident, the task
 -- fence, hold-canceled recovery, captured-fee refunds and settlement, and fees
 -- below the provider's 50-cent capture minimum.
 INSERT INTO public."Gig"(id,user_id,created_by,title,description,price,status,accepted_by,accepted_at,cancellation_policy,scheduled_start) VALUES
  (pg_temp.stop_id(112),pg_temp.stop_id(1),pg_temp.stop_id(1),'Fee contract','Synthetic',10,'assigned',pg_temp.stop_id(2),now()-interval '25 hours','standard',now()+interval '1 hour'),
  (pg_temp.stop_id(113),pg_temp.stop_id(1),pg_temp.stop_id(1),'Fee contract','Synthetic',10,'assigned',pg_temp.stop_id(2),now()-interval '25 hours','standard',NULL),
  (pg_temp.stop_id(114),pg_temp.stop_id(1),pg_temp.stop_id(1),'Fee contract','Synthetic',4,'assigned',pg_temp.stop_id(2),now()-interval '1 hour','strict',NULL),
  (pg_temp.stop_id(115),pg_temp.stop_id(1),pg_temp.stop_id(1),'Fee contract','Synthetic',1.5,'assigned',pg_temp.stop_id(2),now()-interval '25 hours','standard',NULL);
 INSERT INTO public."GigBid"(id,gig_id,user_id,bid_amount,status) VALUES(pg_temp.stop_id(612),pg_temp.stop_id(112),pg_temp.stop_id(2),10,'accepted'),
  (pg_temp.stop_id(613),pg_temp.stop_id(113),pg_temp.stop_id(2),10,'accepted'),(pg_temp.stop_id(614),pg_temp.stop_id(114),pg_temp.stop_id(2),4,'accepted'),
  (pg_temp.stop_id(615),pg_temp.stop_id(115),pg_temp.stop_id(2),1.5,'accepted');
 INSERT INTO public."Payment"(id,gig_id,payer_id,payee_id,amount_total,amount_subtotal,amount_platform_fee,amount_to_payee,stripe_customer_id,stripe_payment_intent_id,payment_status) VALUES
  (pg_temp.stop_id(312),pg_temp.stop_id(112),pg_temp.stop_id(1),pg_temp.stop_id(2),1000,1000,150,850,'cus_stop','pi_stop12','authorized'),
  (pg_temp.stop_id(313),pg_temp.stop_id(113),pg_temp.stop_id(1),pg_temp.stop_id(2),1000,1000,150,850,'cus_stop','pi_stop13','authorized'),
  (pg_temp.stop_id(314),pg_temp.stop_id(114),pg_temp.stop_id(1),pg_temp.stop_id(2),400,400,60,340,'cus_stop','pi_stop14','authorized'),
  (pg_temp.stop_id(315),pg_temp.stop_id(115),pg_temp.stop_id(1),pg_temp.stop_id(2),150,150,22,128,'cus_stop','pi_stop15','authorized');
 UPDATE public."Gig" g SET payment_id=p.id,payment_status='authorized' FROM public."Payment" p WHERE p.gig_id=g.id AND g.id IN (pg_temp.stop_id(112),pg_temp.stop_id(113),pg_temp.stop_id(114),pg_temp.stop_id(115));
 -- A scheduled task admits the worker's report only after its start plus the poster's 30-minute buffer.
 IF public.prepare_gig_fee_capture(pg_temp.stop_id(112),pg_temp.stop_id(2),250,'Synthetic report')->>'error' IS DISTINCT FROM 'NOT_ELIGIBLE' THEN RAISE EXCEPTION 'No-show fee admitted before the scheduled start'; END IF;
 UPDATE public."Gig" SET scheduled_start=now()-interval '29 minutes' WHERE id=pg_temp.stop_id(112);
 IF public.prepare_gig_fee_capture(pg_temp.stop_id(112),pg_temp.stop_id(2),250)->>'error' IS DISTINCT FROM 'NOT_ELIGIBLE' THEN RAISE EXCEPTION 'No-show fee admitted inside the start buffer'; END IF;
 IF EXISTS(SELECT FROM public."GigIncident" WHERE gig_id=pg_temp.stop_id(112)) THEN RAISE EXCEPTION 'Refused report wrote an incident'; END IF;
 UPDATE public."Gig" SET scheduled_start=now()-interval '31 minutes' WHERE id=pg_temp.stop_id(112);
 d:=public.prepare_gig_fee_capture(pg_temp.stop_id(112),pg_temp.stop_id(2),250,'Synthetic report');
 IF d ? 'error' OR d->'payment'->>'payment_status'<>'capture_pending' OR d->'payment'->'metadata'->'gig_fee'->>'state'<>'pending' THEN RAISE EXCEPTION 'Reservation failed %',d; END IF;
 incident:=d->'incident';
 d:=public.prepare_gig_fee_capture(pg_temp.stop_id(112),pg_temp.stop_id(2),250,'Synthetic retry');
 IF d->>'reused'<>'true' OR d->'incident'->>'id' IS DISTINCT FROM incident->>'id' OR incident->>'id' IS NULL
  OR (SELECT count(*) FROM public."GigIncident" WHERE gig_id=pg_temp.stop_id(112))<>1 THEN RAISE EXCEPTION 'Retried report duplicated its incident %',d; END IF;
 -- The reservation holds the task: no other report, Start Work or removal until its outcome is recorded.
 BEGIN UPDATE public."Gig" SET status='cancelled',cancellation_reason='no_show_worker' WHERE id=pg_temp.stop_id(112); RAISE EXCEPTION 'Poster report cancelled a reserved task'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN UPDATE public."Gig" SET status='in_progress',started_at=now() WHERE id=pg_temp.stop_id(112); RAISE EXCEPTION 'Work started on a reserved task'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN DELETE FROM public."Gig" WHERE id=pg_temp.stop_id(112); RAISE EXCEPTION 'Reserved task deleted'; EXCEPTION WHEN check_violation THEN NULL; END;
 -- The hold-canceled webhook marked the payment canceled first; the same record still finishes the report once.
 UPDATE public."Payment" SET payment_status='canceled',updated_at=now() WHERE id=pg_temp.stop_id(312);
 strikes:=(SELECT coalesce(no_show_count,0) FROM public."User" WHERE id=pg_temp.stop_id(1));
 release:=pg_temp.stop_proof(12);
 d:=public.record_gig_fee_capture(pg_temp.stop_id(312),pg_temp.stop_id(2),release);
 IF d ? 'error' OR d->'gig'->>'status'<>'cancelled' OR d->'gig'->>'cancellation_reason'<>'no_show_poster' OR d->'payment'->>'payment_status'<>'canceled'
  OR d->'payment'->'metadata'->'gig_fee'->>'state'<>'not_charged' OR (d->'gig'->>'cancellation_fee')::numeric<>0 THEN RAISE EXCEPTION 'Canceled hold did not finish the report %',d; END IF;
 IF public.record_gig_fee_capture(pg_temp.stop_id(312),pg_temp.stop_id(2),release)->>'reused'<>'true'
  OR (SELECT no_show_count FROM public."User" WHERE id=pg_temp.stop_id(1))<>strikes+1 THEN RAISE EXCEPTION 'Recorded report was repeated'; END IF;
 -- A captured fee is refunded and settled by the captured fee, never by the authorized amount.
 d:=public.prepare_gig_fee_capture(pg_temp.stop_id(113),pg_temp.stop_id(2),250);
 capture:=pg_temp.stop_proof(13)||jsonb_build_object('status','succeeded','amount_received',250,'amount_capturable',0,'charge_amount',1000,
  'amount_captured',250,'charge_captured',true,'charge_refunded',false,'charge_amount_refunded',0,'charge_disputed',false);
 d:=public.record_gig_fee_capture(pg_temp.stop_id(313),pg_temp.stop_id(2),capture);
 IF d ? 'error' OR d->'payment'->>'payment_status'<>'captured_hold' OR (d->'gig'->>'cancellation_fee')::numeric<>2.5 THEN RAISE EXCEPTION 'Fee capture not recorded %',d; END IF;
 SELECT * INTO pay FROM public."Payment" WHERE id=pg_temp.stop_id(313);
 IF public.payment_captured_amount(pay)<>250 THEN RAISE EXCEPTION 'Captured fee amount unknown'; END IF;
 IF public.reserve_payment_refund(pay.id,pg_temp.stop_id(896)::text,pg_temp.stop_id(1),'payer',NULL,'requested_by_customer',NULL,public.refund_payment_snapshot(pay),'refund')->>'error'
  IS DISTINCT FROM 'SUPPORT_REQUIRED' THEN RAISE EXCEPTION 'Payer refunded a charged fee'; END IF;
 UPDATE public."User" SET role='admin' WHERE id=pg_temp.stop_id(3);
 IF public.reserve_payment_refund(pay.id,pg_temp.stop_id(895)::text,pg_temp.stop_id(3),'admin',260,'requested_by_customer',NULL,public.refund_payment_snapshot(pay),'refund')->>'error'
  IS DISTINCT FROM 'AMOUNT_EXCEEDED' THEN RAISE EXCEPTION 'Refund exceeded the captured fee'; END IF;
 d:=public.reserve_payment_refund(pay.id,pg_temp.stop_id(897)::text,pg_temp.stop_id(3),'admin',NULL,'requested_by_customer',NULL,public.refund_payment_snapshot(pay),'refund');
 IF d ? 'error' OR (d->'request'->>'amount_cents')::integer<>250 THEN RAISE EXCEPTION 'Fee refund not bounded by the captured fee %',d; END IF;
 SELECT * INTO pay FROM public."Payment" WHERE id=pg_temp.stop_id(313);
 d:=public.record_payment_refund_receipts(pay.id,public.refund_payment_snapshot(pay),jsonb_build_array(jsonb_build_object(
  'id','re_fee13','intentId','pi_stop13','chargeId','ch_stop13','amountCents',250,'currency','usd','status','succeeded','requestId',pg_temp.stop_id(897),'createdAt',now())));
 IF d->'payment'->>'payment_status'<>'refunded_full' OR (d->'payment'->>'refunded_amount')::integer<>250 THEN RAISE EXCEPTION 'Full fee refund not recorded as full %',d; END IF;
 UPDATE public."Payment" SET cooling_off_ends_at=now()-interval '1 minute' WHERE id=pg_temp.stop_id(313);
 SELECT * INTO pay FROM public."Payment" WHERE id=pg_temp.stop_id(313);
 d:=public.settle_gig_fee_wallet_income(pay.id,public.refund_payment_snapshot(pay));
 IF d ? 'error' OR d->'settlement'->>'status'<>'no_earnings' OR d->'payment'->>'payment_status'<>'refunded_full'
  OR EXISTS(SELECT FROM public."WalletTransaction" WHERE payment_id=pay.id) THEN RAISE EXCEPTION 'Refunded fee still paid the worker %',d; END IF;
 -- A policy fee below 50 cents is not charged: the owner's late cancel is a plain release and says why.
 d:=public.read_gig_stop_preview(pg_temp.stop_id(114),pg_temp.stop_id(1),'cancel');
 IF d->>'eligible'<>'true' OR d->>'financialAction'<>'release' OR (d->'terms'->>'policyFeeCents')::integer<>0
  OR d->>'feeStatus'<>'not_charged' OR d->>'feeReason'<>'FEE_BELOW_MINIMUM' THEN RAISE EXCEPTION 'Sub-minimum fee charged or unexplained %',d; END IF;
 IF public.read_gig_stop_preview(pg_temp.stop_id(114),pg_temp.stop_id(2),'cancel')->>'unavailableReason' IS DISTINCT FROM 'FEE_POLICY_REVIEW' THEN RAISE EXCEPTION 'Worker cancel left review'; END IF;
 d:=public.begin_gig_stop(pg_temp.stop_id(114),pg_temp.stop_id(1),repeat('a',64),pg_temp.stop_id(814),'cancel',d->'terms');
 IF d ? 'error' OR d->'request'->>'financial_action'<>'release' OR public.check_gig_stop_current(pg_temp.stop_id(814),pg_temp.stop_id(1)) ? 'error' THEN RAISE EXCEPTION 'Waived fee cancel not reserved as a release %',d; END IF;
 d:=public.finish_gig_stop(pg_temp.stop_id(814),pg_temp.stop_id(1),pg_temp.stop_proof(14)||'{"amount":400}');
 IF d->'request'->'receipt'->>'financialStatus'<>'released' OR (SELECT cancellation_fee FROM public."Gig" WHERE id=pg_temp.stop_id(114))<>0
  THEN RAISE EXCEPTION 'Waived fee cancel not released %',d; END IF;
 -- A worker's no-show report with a fee below 50 cents is admitted once, without any reservation.
 d:=public.prepare_gig_fee_capture(pg_temp.stop_id(115),pg_temp.stop_id(2),38,'Synthetic report');
 IF d->>'error' IS DISTINCT FROM 'FEE_BELOW_MINIMUM' OR d->'incident'->>'id' IS NULL
  OR (SELECT metadata ? 'gig_fee' OR payment_status<>'authorized' FROM public."Payment" WHERE id=pg_temp.stop_id(315)) THEN RAISE EXCEPTION 'Sub-minimum no-show fee reserved %',d; END IF;
END $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.begin_gig_stop(NULL,NULL,repeat('a',64),NULL,'close','{}'); RAISE EXCEPTION 'Client could reserve task stop'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE public."GigStopRequest" SET state='completed'; RAISE EXCEPTION 'Client could manufacture receipt'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM reason FROM public."GigStopRequest"; RAISE EXCEPTION 'Client could read private explanation'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.claim_gig_stop_delivery(); RAISE EXCEPTION 'Client controlled notice delivery'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
