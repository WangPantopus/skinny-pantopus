-- Exact postcard and attempt identity preserve guesses, history and current admission.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
INSERT INTO auth.users(id,email) VALUES
 ('ddc24900-0000-4000-8000-000000000001','postal-verify-owner@example.invalid'),
 ('ddc24900-0000-4000-8000-000000000002','postal-verify-applicant@example.invalid'),
 ('ddc24900-0000-4000-8000-000000000003','postal-verify-outsider@example.invalid');
INSERT INTO public."User"(id,email,username,name) SELECT id,email,'postal_verify_'||right(id::text,2),'Postal verification fixture'
 FROM auth.users WHERE id IN ('ddc24900-0000-4000-8000-000000000001','ddc24900-0000-4000-8000-000000000002','ddc24900-0000-4000-8000-000000000003');
INSERT INTO public."Home"(id,created_by_user_id,address,address2,city,state,zipcode) VALUES
 ('ddc24900-0000-4000-8000-000000000100','ddc24900-0000-4000-8000-000000000001','Postal verification fixture','602','Test','WA','98607');
INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status,is_primary_owner) VALUES
 ('ddc24900-0000-4000-8000-000000000100','ddc24900-0000-4000-8000-000000000001','verified',true);
INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,verification_status,age_band,access_end_at) VALUES
 ('ddc24900-0000-4000-8000-000000000100','ddc24900-0000-4000-8000-000000000002','tenant','restricted_member','pending_postcard','teen',clock_timestamp()+interval '20 days');
INSERT INTO public."HomeResidencyClaim"(home_id,user_id,claimed_address,claimed_role,cold_start_mode) VALUES
 ('ddc24900-0000-4000-8000-000000000100','ddc24900-0000-4000-8000-000000000002','Postal verification fixture, 602','renter','external_postcard');
INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES
 ('ddc24900-0000-4000-8000-000000000100','ddc24900-0000-4000-8000-000000000002','docs.view',false);
SET LOCAL ROLE service_role;
DO $$
DECLARE
 h uuid:='ddc24900-0000-4000-8000-000000000100'; a uuid:='ddc24900-0000-4000-8000-000000000002';
 card uuid:='ddc24900-0000-4000-8000-000000002001'; next_card uuid:='ddc24900-0000-4000-8000-000000002002';
 address jsonb:=jsonb_build_object('line1','Postal verification fixture','line2','602','city','Test','state','WA','postal_code','98607','country','US');
 r jsonb; saved jsonb; before_o jsonb; after_o jsonb; end_date timestamptz;
BEGIN
 PERFORM public.begin_home_postcard_request(h,a,'ddc24900-0000-4000-8000-000000001001',address,card,repeat('a',64),'fixture');
 SELECT to_jsonb(o),o.access_end_at INTO before_o,end_date FROM public."HomeOccupancy" o WHERE home_id=h AND user_id=a;
 r:=public.verify_home_postcard_current(h,a,card,'ddc24900-0000-4000-8000-000000003001',repeat('a',64),365);
 IF r->>'code' IS DISTINCT FROM 'POSTCARD_NOT_DISPATCHED' OR (SELECT attempts FROM public."HomePostcardCode" WHERE id=card)<>0 THEN
 RAISE EXCEPTION 'Undispatched code could mutate admission'; END IF;
 PERFORM public.claim_home_postcard_current_dispatch(h,a,'ddc24900-0000-4000-8000-000000001001',card,repeat('a',64));
 PERFORM public.record_home_postcard_current_dispatch(h,a,card,'delivery_unknown',NULL);
 r:=public.cancel_home_postcard_verification(h,a,card,'ddc24900-0000-4000-8000-000000003002');
 r:=public.verify_home_postcard_current(h,a,card,'ddc24900-0000-4000-8000-000000003002',repeat('a',64),365);
 IF r->>'state' IS DISTINCT FROM 'cancelled' OR (SELECT attempts FROM public."HomePostcardCode" WHERE id=card)<>0 THEN
 RAISE EXCEPTION 'Cancelled attempt consumed a code'; END IF;
 r:=public.verify_home_postcard_current(h,a,card,'ddc24900-0000-4000-8000-000000003003',repeat('b',64),365);
 IF r->>'code' IS DISTINCT FROM 'POSTCARD_WRONG_CODE' OR (r->>'attempts_remaining')::integer<>4 THEN
 RAISE EXCEPTION 'Wrong code did not retain its exact attempt'; END IF;
 saved:=r;
 r:=public.verify_home_postcard_current(h,a,card,'ddc24900-0000-4000-8000-000000003003',repeat('b',64),365);
 IF r IS DISTINCT FROM saved||'{"replayed":true}'::jsonb OR (SELECT attempts FROM public."HomePostcardCode" WHERE id=card)<>1 THEN
 RAISE EXCEPTION 'Lost wrong-code reply spent another guess'; END IF;
 r:=public.verify_home_postcard_current(h,a,card,'ddc24900-0000-4000-8000-000000003003',repeat('a',64),365);
 IF r->>'code' IS DISTINCT FROM 'POSTCARD_VERIFICATION_CONFLICT' THEN RAISE EXCEPTION 'Changed retry replaced an original code attempt'; END IF;
 r:=public.get_home_postcard_verification(h,'ddc24900-0000-4000-8000-000000000003',card,'ddc24900-0000-4000-8000-000000003003');
 IF r->>'code' IS DISTINCT FROM 'POSTCARD_VERIFICATION_NOT_FOUND' THEN RAISE EXCEPTION 'Attempt receipt crossed actors'; END IF;
 r:=public.verify_home_postcard_current(h,a,next_card,'ddc24900-0000-4000-8000-000000003004',repeat('a',64),365);
 IF r->>'code' IS DISTINCT FROM 'POSTCARD_NO_LONGER_AVAILABLE' OR (SELECT attempts FROM public."HomePostcardCode" WHERE id=card)<>1 THEN
 RAISE EXCEPTION 'A different card identity consumed the current code attempt'; END IF;
 UPDATE public."Home" SET home_status='archived' WHERE id=h;
 r:=public.verify_home_postcard_current(h,a,card,'ddc24900-0000-4000-8000-000000003005',repeat('a',64),365);
 IF r->>'code' IS DISTINCT FROM 'POSTCARD_HOME_UNAVAILABLE' THEN RAISE EXCEPTION 'Archived Home reached admission'; END IF;
 UPDATE public."Home" SET home_status='active' WHERE id=h;
 UPDATE public."HomeOccupancy" SET start_at=clock_timestamp()+interval '1 day' WHERE home_id=h AND user_id=a;
 r:=public.verify_home_postcard_current(h,a,card,'ddc24900-0000-4000-8000-000000003006',repeat('a',64),365);
 IF r->>'code' IS DISTINCT FROM 'POSTCARD_ACCESS_REVIEW_REQUIRED' THEN RAISE EXCEPTION 'Future occupancy was admitted'; END IF;
 UPDATE public."HomeOccupancy" SET start_at=NULL WHERE home_id=h AND user_id=a;
 r:=public.verify_home_postcard_current(h,a,card,'ddc24900-0000-4000-8000-000000003007',repeat('a',64),365);
 IF r->>'state' IS DISTINCT FROM 'completed' OR r->>'verification_status' IS DISTINCT FROM 'provisional'
 OR r->>'challenge_window_ends_at' IS NULL THEN RAISE EXCEPTION 'Current owner without occupancy did not receive a review window'; END IF;
 saved:=r;
 SELECT to_jsonb(o) INTO after_o FROM public."HomeOccupancy" o WHERE home_id=h AND user_id=a;
 IF after_o->>'age_band' IS DISTINCT FROM 'teen' OR after_o->>'role' IS DISTINCT FROM 'tenant'
 OR (after_o->>'access_end_at')::timestamptz IS DISTINCT FROM end_date
 OR after_o->>'can_manage_home'<>'false' OR after_o->>'can_manage_tasks'<>'false'
 OR (SELECT status FROM public."HomeResidencyClaim" WHERE home_id=h AND user_id=a)<>'pending'
 OR NOT EXISTS(SELECT FROM public."HomePermissionOverride" WHERE home_id=h AND user_id=a AND permission='docs.view' AND NOT allowed) THEN
 RAISE EXCEPTION 'Postal provisional review lost identity, dates, age, explicit deny or reviewability'; END IF;
 r:=public.verify_home_postcard_current(h,a,card,'ddc24900-0000-4000-8000-000000003007',repeat('a',64),3650);
 IF r IS DISTINCT FROM saved||'{"replayed":true}'::jsonb
 OR (SELECT to_jsonb(o) FROM public."HomeOccupancy" o WHERE home_id=h AND user_id=a) IS DISTINCT FROM after_o THEN
 RAISE EXCEPTION 'Original successful retry renewed membership or challenge dates'; END IF;
 r:=public.verify_home_postcard_current(h,a,card,'ddc24900-0000-4000-8000-000000003008',repeat('a',64),3650);
 IF r->>'state' IS DISTINCT FROM 'completed'
 OR (SELECT to_jsonb(o) FROM public."HomeOccupancy" o WHERE home_id=h AND user_id=a) IS DISTINCT FROM after_o
 OR (SELECT attempts FROM public."HomePostcardCode" WHERE id=card)<>2 THEN
 RAISE EXCEPTION 'Fresh attempt of verified code renewed membership or spent another guess'; END IF;
 UPDATE public."HomeOccupancy" SET is_active=false WHERE home_id=h AND user_id=a;
 r:=public.verify_home_postcard_current(h,a,card,'ddc24900-0000-4000-8000-000000003009',repeat('a',64),365);
 IF r->>'code' IS DISTINCT FROM 'POSTCARD_ACCESS_REVIEW_REQUIRED' THEN RAISE EXCEPTION 'New attempt restored removed access'; END IF;
 r:=public.get_home_postcard_verification(h,a,card,'ddc24900-0000-4000-8000-000000003007');
 IF r->>'state' IS DISTINCT FROM 'completed' OR r::text ~ '(code_hash|submitted_hash|intent_hash|occupancy|destination|permissions)' THEN
 RAISE EXCEPTION 'Historical receipt became current access or exposed private verification material'; END IF;
END;
$$;
DO $$
DECLARE
 h uuid:='ddc24900-0000-4000-8000-000000000100'; a uuid:='ddc24900-0000-4000-8000-000000000002';
 card uuid:='ddc24900-0000-4000-8000-000000002001'; o public."HomeOccupancy"%ROWTYPE;
 r jsonb; before_o jsonb; before_claim jsonb; start_date timestamptz; end_date timestamptz;
BEGIN
 UPDATE public."HomeOccupancy" SET is_active=true WHERE home_id=h AND user_id=a RETURNING * INTO o;
 r:=public.promote_home_postcard_review(h,a,o.id,365);
 IF r->>'promoted' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Review promoted before its original window ended'; END IF;
 -- Age only the synthetic review window and its proof; keep current scheduled
 -- membership dates intact. The test clock remains the actual database clock.
 UPDATE public."HomeOccupancy" SET challenge_window_started_at=clock_timestamp()-interval '8 days',
   challenge_window_ends_at=clock_timestamp()-interval '1 day' WHERE id=o.id;
 UPDATE public."HomePostcardCode" SET verified_at=clock_timestamp()-interval '7 days' WHERE id=card;
 SELECT * INTO o FROM public."HomeOccupancy" WHERE id=o.id;
 before_o:=to_jsonb(o);start_date:=o.challenge_window_started_at;end_date:=o.challenge_window_ends_at;
 UPDATE public."Home" SET address2='999' WHERE id=h;
 r:=public.promote_home_postcard_review(h,a,o.id,365);
 IF r->>'code' IS DISTINCT FROM 'POSTCARD_ACCESS_REVIEW_REQUIRED' THEN RAISE EXCEPTION 'Changed mailing address reached promotion'; END IF;
 UPDATE public."Home" SET address2='602',home_status='archived' WHERE id=h;
 r:=public.promote_home_postcard_review(h,a,o.id,365);
 IF r->>'code' IS DISTINCT FROM 'POSTCARD_HOME_UNAVAILABLE' THEN RAISE EXCEPTION 'Archived Home reached promotion'; END IF;
 UPDATE public."Home" SET home_status='active' WHERE id=h;
 UPDATE public."HomeResidencyClaim" SET status='rejected' WHERE home_id=h AND user_id=a;
 r:=public.promote_home_postcard_review(h,a,o.id,365);
 IF r->>'code' IS DISTINCT FROM 'POSTCARD_ACCESS_REVIEW_REQUIRED' THEN RAISE EXCEPTION 'Rejected claim reached promotion'; END IF;
 UPDATE public."HomeResidencyClaim" SET status='pending' WHERE home_id=h AND user_id=a;
 IF (SELECT to_jsonb(x) FROM public."HomeOccupancy" x WHERE id=o.id) IS DISTINCT FROM before_o THEN
 RAISE EXCEPTION 'Failed promotion changed the occupancy'; END IF;
 UPDATE public."User" SET date_of_birth='2020-01-01' WHERE id=a;
 r:=public.promote_home_postcard_review(h,a,o.id,365);
 IF r->>'promoted' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Eligible original review did not promote'; END IF;
 SELECT * INTO o FROM public."HomeOccupancy" WHERE id=o.id;
 IF o.age_band<>'child' OR o.role_base<>'restricted_member' OR o.can_manage_tasks OR o.can_view_sensitive
 OR o.challenge_window_started_at IS DISTINCT FROM start_date OR o.challenge_window_ends_at IS DISTINCT FROM end_date
 OR (to_jsonb(o)->>'access_end_at') IS DISTINCT FROM before_o->>'access_end_at'
 OR (SELECT status FROM public."HomeResidencyClaim" WHERE home_id=h AND user_id=a)<>'verified'
 OR NOT EXISTS(SELECT FROM public."HomePermissionOverride" WHERE home_id=h AND user_id=a AND permission='docs.view' AND NOT allowed) THEN
 RAISE EXCEPTION 'Promotion lost age ceiling, dates, challenge history, deny or claim outcome'; END IF;
 before_o:=to_jsonb(o);
 r:=public.promote_home_postcard_review(h,a,o.id,3650);
 IF r->>'promoted' IS DISTINCT FROM 'false' OR (SELECT to_jsonb(x) FROM public."HomeOccupancy" x WHERE id=o.id) IS DISTINCT FROM before_o THEN
 RAISE EXCEPTION 'Promotion retry renewed verified membership'; END IF;
END;
$$;
DO $$
DECLARE
 h uuid:='ddc24900-0000-4000-8000-000000000101'; a uuid:='ddc24900-0000-4000-8000-000000000003';
 card uuid:='ddc24900-0000-4000-8000-000000002011'; r jsonb; before_o jsonb; i integer;
 address jsonb:=jsonb_build_object('line1','Postal self fixture','line2','803','city','Test','state','WA','postal_code','98607','country','US');
BEGIN
 INSERT INTO public."Home"(id,created_by_user_id,address,address2,city,state,zipcode)
 VALUES(h,'ddc24900-0000-4000-8000-000000000001','Postal self fixture','803','Test','WA','98607');
 INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,verification_status,age_band)
 VALUES(h,a,'member','restricted_member','pending_postcard','adult');
 INSERT INTO public."HomeResidencyClaim"(home_id,user_id,claimed_address,claimed_role)
 VALUES(h,a,'Postal self fixture, 803','household');
 PERFORM public.begin_home_postcard_request(h,a,'ddc24900-0000-4000-8000-000000001011',address,card,repeat('c',64),'fixture');
 PERFORM public.claim_home_postcard_current_dispatch(h,a,'ddc24900-0000-4000-8000-000000001011',card,repeat('c',64));
 INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(h,a,'ownership.manage',true);
 r:=public.verify_home_postcard_current(h,a,card,'ddc24900-0000-4000-8000-000000003011',repeat('c',64),365);
 IF r->>'code' IS DISTINCT FROM 'POSTCARD_ACCESS_REVIEW_REQUIRED' OR (SELECT attempts FROM public."HomePostcardCode" WHERE id=card)<>0 THEN
 RAISE EXCEPTION 'Self-verification activated an above-member override'; END IF;
 UPDATE public."HomePermissionOverride" SET allowed=false WHERE home_id=h AND user_id=a;
 UPDATE public."Home" SET owner_id=a WHERE id=h;
 r:=public.verify_home_postcard_current(h,a,card,'ddc24900-0000-4000-8000-000000003012',repeat('c',64),365);
 IF r->>'code' IS DISTINCT FROM 'OWNERSHIP_FLOW_REQUIRED' THEN RAISE EXCEPTION 'Self-verification activated ownership'; END IF;
 UPDATE public."Home" SET owner_id=NULL WHERE id=h;
 UPDATE public."User" SET date_of_birth='2020-01-01' WHERE id=a;
 r:=public.verify_home_postcard_current(h,a,card,'ddc24900-0000-4000-8000-000000003013',repeat('c',64),365);
 IF r->>'state' IS DISTINCT FROM 'completed' OR r->>'verification_status' IS DISTINCT FROM 'verified'
 OR NOT EXISTS(SELECT FROM public."HomeOccupancy" WHERE home_id=h AND user_id=a AND role_base='restricted_member' AND age_band='child'
   AND NOT can_manage_home AND NOT can_manage_access AND NOT can_manage_finance AND NOT can_manage_tasks AND NOT can_view_sensitive)
 OR (SELECT status FROM public."HomeResidencyClaim" WHERE home_id=h AND user_id=a)<>'verified' THEN
 RAISE EXCEPTION 'Current self-verification lost the child ceiling or claim outcome'; END IF;
 SELECT to_jsonb(o) INTO before_o FROM public."HomeOccupancy" o WHERE home_id=h AND user_id=a;
 r:=public.verify_home_postcard_current(h,a,card,'ddc24900-0000-4000-8000-000000003014',repeat('c',64),3650);
 IF r->>'state' IS DISTINCT FROM 'completed' OR (SELECT to_jsonb(o) FROM public."HomeOccupancy" o WHERE home_id=h AND user_id=a) IS DISTINCT FROM before_o THEN
 RAISE EXCEPTION 'Fresh retry renewed an independent verified membership'; END IF;
 -- Isolated second pending fixture for per-code lockout. Each distinct attempt
 -- spends one guess; replaying the final rejection never spends a sixth.
 UPDATE public."HomeOccupancy" SET verification_status='pending_postcard',verified_at=NULL,verification_expires_at=NULL WHERE home_id=h AND user_id=a;
 UPDATE public."HomeResidencyClaim" SET status='pending' WHERE home_id=h AND user_id=a;
 card:='ddc24900-0000-4000-8000-000000002012';
 PERFORM public.begin_home_postcard_request(h,a,'ddc24900-0000-4000-8000-000000001012',address,card,repeat('d',64),'fixture');
 PERFORM public.claim_home_postcard_current_dispatch(h,a,'ddc24900-0000-4000-8000-000000001012',card,repeat('d',64));
 FOR i IN 1..5 LOOP
   r:=public.verify_home_postcard_current(h,a,card,('ddc24900-0000-4000-8000-'||lpad((3020+i)::text,12,'0'))::uuid,repeat('e',64),365);
   IF r->>'code' IS DISTINCT FROM 'POSTCARD_WRONG_CODE' OR (r->>'attempts_remaining')::integer<>5-i THEN
   RAISE EXCEPTION 'Distinct incorrect code attempt was not counted once'; END IF;
 END LOOP;
 r:=public.verify_home_postcard_current(h,a,card,'ddc24900-0000-4000-8000-000000003025',repeat('e',64),365);
 IF r->>'code' IS DISTINCT FROM 'POSTCARD_WRONG_CODE' OR (SELECT attempts FROM public."HomePostcardCode" WHERE id=card)<>5 THEN
 RAISE EXCEPTION 'Lost final wrong-code reply spent another guess'; END IF;
 r:=public.verify_home_postcard_current(h,a,card,'ddc24900-0000-4000-8000-000000003026',repeat('d',64),365);
 IF r->>'code' IS DISTINCT FROM 'POSTCARD_LOCKED' THEN RAISE EXCEPTION 'Locked card could verify'; END IF;
 r:=public.get_home_postcard_current_status(h,a);
 IF r->>'can_request' IS DISTINCT FROM 'true' OR r->>'can_verify' IS DISTINCT FROM 'false' THEN
 RAISE EXCEPTION 'Locked-card recovery was unavailable or still allowed verification'; END IF;
END;
$$;
DO $$
DECLARE h uuid:='ddc24900-0000-4000-8000-000000000100'; a uuid:='ddc24900-0000-4000-8000-000000000002';
 reviewer uuid:='ddc24900-0000-4000-8000-000000000001'; o public."HomeOccupancy"%ROWTYPE; r jsonb; saved jsonb;
BEGIN
 SELECT * INTO o FROM public."HomeOccupancy" WHERE home_id=h AND user_id=a;
 r:=public.challenge_home_postcard_review(h,reviewer,o.id);
 IF r->>'code' IS DISTINCT FROM 'POSTCARD_REVIEW_CHANGED' THEN RAISE EXCEPTION 'Delayed challenge suspended verified membership'; END IF;
 UPDATE public."HomeOccupancy" SET verification_status='provisional',verified_at=NULL,verification_expires_at=NULL,
   challenge_window_started_at=clock_timestamp(),challenge_window_ends_at=clock_timestamp()+interval '7 days' WHERE id=o.id;
 r:=public.challenge_home_postcard_review(h,'ddc24900-0000-4000-8000-000000000003',o.id);
 IF r->>'code' IS DISTINCT FROM 'POSTCARD_REVIEW_AUTHORITY_REQUIRED' THEN RAISE EXCEPTION 'Outsider challenged household access'; END IF;
 r:=public.challenge_home_postcard_review(h,reviewer,o.id);
 IF r->>'challenged' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Current authority could not challenge provisional residency'; END IF;
 SELECT to_jsonb(x) INTO saved FROM public."HomeOccupancy" x WHERE id=o.id;
 r:=public.challenge_home_postcard_review(h,reviewer,o.id);
 IF r->>'challenged' IS DISTINCT FROM 'false' OR (SELECT to_jsonb(x) FROM public."HomeOccupancy" x WHERE id=o.id) IS DISTINCT FROM saved THEN
 RAISE EXCEPTION 'Challenge retry lost actual stored timestamp binding or rewrote membership'; END IF;
 r:=public.promote_home_postcard_review(h,a,o.id,365);
 IF r->>'promoted' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Promotion undid a completed household challenge'; END IF;
END;
$$;
RESET ROLE;
DO $$ DECLARE f record; BEGIN
 IF has_table_privilege('authenticated','public."HomePostcardVerificationCommand"','SELECT')
 OR has_table_privilege('anon','public."HomePostcardVerificationCommand"','INSERT') THEN RAISE EXCEPTION 'Verification history is public'; END IF;
 FOR f IN SELECT oid FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN
 ('get_home_postcard_verification','cancel_home_postcard_verification','home_postcard_verified_policy','verify_home_postcard_current','promote_home_postcard_review','challenge_home_postcard_review') LOOP
 IF has_function_privilege('authenticated',f.oid,'EXECUTE') OR has_function_privilege('anon',f.oid,'EXECUTE')
 OR NOT has_function_privilege('service_role',f.oid,'EXECUTE') THEN RAISE EXCEPTION 'Verification worker function is exposed'; END IF;
 END LOOP;
END $$;
ROLLBACK;
