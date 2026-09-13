-- Real admission, current authority and durable original/current projections.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
SET LOCAL search_path=public,extensions,pg_catalog;
CREATE FUNCTION pg_temp.rr_id(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
 SELECT ('ddc23500-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
$$;
CREATE FUNCTION pg_temp.rr_expect(r jsonb,c text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 IF (c IS NULL AND r->>'ok' IS DISTINCT FROM 'true') OR (c IS NOT NULL AND r->>'code' IS DISTINCT FROM c) THEN
  RAISE EXCEPTION 'Expected %, got %',coalesce(c,'success'),r; END IF;
END $$;
CREATE FUNCTION pg_temp.rr_token(n integer) RETURNS text LANGUAGE sql AS $$
 SELECT public.home_residency_review_snapshot(c) FROM public."HomeResidencyClaim" c WHERE id=pg_temp.rr_id(n);
$$;
CREATE TEMP TABLE rr_roles AS SELECT jsonb_agg(to_jsonb(r) ORDER BY role_base,permission) rows FROM public."HomeRolePermission" r;
INSERT INTO auth.users(id,email,email_confirmed_at)
 SELECT pg_temp.rr_id(n),'residency-review-'||n||'@example.invalid',now() FROM generate_series(1,12)n;
INSERT INTO public."User"(id,email,username,role)
 SELECT id,email,'residency_review_'||right(id::text,2),'user' FROM auth.users WHERE id::text LIKE 'ddc23500-%';
INSERT INTO public."Home"(id,owner_id,created_by_user_id,address,city,state,zipcode,name)
 VALUES(pg_temp.rr_id(100),pg_temp.rr_id(1),pg_temp.rr_id(1),'235 Residency Review Street','Test','WA','98607','Residency fixture');
INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status,is_primary_owner,verification_tier)
 VALUES(pg_temp.rr_id(100),pg_temp.rr_id(1),'verified',true,'strong');
INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status,
  start_at,end_at,access_start_at,access_end_at)
 SELECT pg_temp.rr_id(100),pg_temp.rr_id(n),CASE WHEN n=1 THEN 'owner' ELSE 'member' END,
  (CASE WHEN n=1 THEN 'owner' ELSE 'member' END)::public.home_role_base,'adult',
  CASE WHEN n=1 THEN 'verified' ELSE 'pending_doc' END,
  now()-interval '2 days',now()+interval '3 days',now()-interval '1 day',now()+interval '1 day'
 FROM generate_series(1,10)n;
INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed)
 VALUES(pg_temp.rr_id(100),pg_temp.rr_id(2),'finance.manage',false);
INSERT INTO public."HomeResidencyClaim"(id,home_id,user_id,claimed_address,claimed_role)
 SELECT pg_temp.rr_id(200+n),pg_temp.rr_id(100),pg_temp.rr_id(n),'235 Residency Review Street','member'
 FROM generate_series(1,12)n;
SET LOCAL ROLE service_role;
DO $$ DECLARE h uuid:=pg_temp.rr_id(100); actor uuid:=pg_temp.rr_id(1); r jsonb; again jsonb; tok text;
 original jsonb; after_row jsonb; n integer; receipt_count integer; BEGIN
 IF has_table_privilege('anon','public."HomeResidencyReviewReceipt"','SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
   OR has_table_privilege('authenticated','public."HomeResidencyReviewReceipt"','SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
   OR has_function_privilege('authenticated','public.decide_home_residency_review(uuid,uuid,uuid,text,text,text,uuid,text,integer)','EXECUTE')
   OR has_function_privilege('anon','public.get_home_residency_review(uuid,uuid,uuid)','EXECUTE')
   OR NOT has_function_privilege('service_role','public.get_home_residency_review(uuid,uuid,uuid)','EXECUTE') THEN
   RAISE EXCEPTION 'Unsafe residency receipt privileges'; END IF;
 PERFORM pg_temp.rr_expect(public.get_home_residency_review(h,pg_temp.rr_id(202),pg_temp.rr_id(3)),'MEMBERS_MANAGE_REQUIRED');
 PERFORM pg_temp.rr_expect(public.get_home_residency_review(h,pg_temp.rr_id(201),actor),'SELF_ADMISSION_FORBIDDEN');
 PERFORM pg_temp.rr_expect(public.get_home_residency_review(h,pg_temp.rr_id(999),actor),'CLAIM_NOT_FOUND');
 PERFORM pg_temp.rr_expect(public.decide_home_residency_review(h,pg_temp.rr_id(202),actor,'reject','member'),
   'INVALID_ADMISSION_REQUEST');
 PERFORM pg_temp.rr_expect(public.decide_home_residency_review(h,pg_temp.rr_id(202),actor,'approve',NULL,NULL,pg_temp.rr_id(501)),
   'INVALID_ADMISSION_REQUEST');

 -- Original approval, exact retry and later move-out: never restore membership.
 tok:=pg_temp.rr_token(202);
 SELECT to_jsonb(o) INTO original FROM public."HomeOccupancy" o WHERE home_id=h AND user_id=pg_temp.rr_id(2);
 r:=public.decide_home_residency_review(h,pg_temp.rr_id(202),actor,'approve','member',NULL,pg_temp.rr_id(502),tok);
 PERFORM pg_temp.rr_expect(r);
 SELECT to_jsonb(o) INTO after_row FROM public."HomeOccupancy" o WHERE home_id=h AND user_id=pg_temp.rr_id(2);
 IF (after_row-ARRAY['verification_status','verified_at','verification_expires_at','updated_at','can_manage_tasks','membership_version'])
   IS DISTINCT FROM (original-ARRAY['verification_status','verified_at','verification_expires_at','updated_at','can_manage_tasks','membership_version'])
   OR after_row->>'membership_version' IS NULL OR after_row->'membership_version'=original->'membership_version'
   OR r->'receipt'->'result'->>'status'<>'verified' THEN RAISE EXCEPTION 'Approval changed a preserved membership field'; END IF;
 SELECT count(*) INTO n FROM public."HomeAuditLog" WHERE home_id=h;
 UPDATE public."HomeOccupancy" SET is_active=false,verification_status='moved_out' WHERE home_id=h AND user_id=pg_temp.rr_id(2);
 SELECT to_jsonb(o) INTO original FROM public."HomeOccupancy" o WHERE home_id=h AND user_id=pg_temp.rr_id(2);
 again:=public.decide_home_residency_review(h,pg_temp.rr_id(202),actor,'approve','member',NULL,pg_temp.rr_id(502),tok);
 PERFORM pg_temp.rr_expect(again);
 IF again->'receipt'<>r->'receipt' OR again->>'replayed'<>'true' OR again->'occupancy'->>'is_active'<>'false'
   OR again->'occupancy'->>'verification_status'<>'moved_out'
   OR (SELECT to_jsonb(o) FROM public."HomeOccupancy" o WHERE home_id=h AND user_id=pg_temp.rr_id(2))<>original
   OR (SELECT count(*) FROM public."HomeAuditLog" WHERE home_id=h)<>n THEN
   RAISE EXCEPTION 'Receipt recovery reactivated/retemplated membership or repeated audit'; END IF;
 PERFORM pg_temp.rr_expect(public.decide_home_residency_review(h,pg_temp.rr_id(202),actor,'approve','guest',NULL,pg_temp.rr_id(502),tok),
   'RESIDENCY_REVIEW_REQUEST_CHANGED');

 -- A rejection retry cannot reject a later resubmission of the same claim row.
 tok:=pg_temp.rr_token(203);
 r:=public.decide_home_residency_review(h,pg_temp.rr_id(203),actor,'reject',NULL,'Original reason',pg_temp.rr_id(503),tok);
 PERFORM pg_temp.rr_expect(r);
 UPDATE public."HomeResidencyClaim" SET status='pending',reviewed_by=NULL,reviewed_at=NULL,review_note=NULL,
   updated_at=clock_timestamp() WHERE id=pg_temp.rr_id(203);
 again:=public.decide_home_residency_review(h,pg_temp.rr_id(203),actor,'reject',NULL,'Original reason',pg_temp.rr_id(503),tok);
 IF again->'receipt'<>r->'receipt' OR again->'claim'->>'status'<>'pending' OR again->>'replayed'<>'true' THEN
   RAISE EXCEPTION 'Old rejection acted on a new submission'; END IF;
 PERFORM pg_temp.rr_expect(public.decide_home_residency_review(h,pg_temp.rr_id(203),actor,'reject',NULL,'Changed',pg_temp.rr_id(503),tok),
   'RESIDENCY_REVIEW_REQUEST_CHANGED');
 PERFORM pg_temp.rr_expect(public.decide_home_residency_review(h,pg_temp.rr_id(203),actor,'reject',NULL,'Original reason',pg_temp.rr_id(513),tok),
   'RESIDENCY_REVIEW_CHANGED');
 PERFORM pg_temp.rr_expect(public.decide_home_residency_review(h,pg_temp.rr_id(203),actor,'reject',NULL,'Fresh review',pg_temp.rr_id(513),pg_temp.rr_token(203)));

 -- Legacy identical commands also recover a historical result after resubmission.
 r:=public.decide_home_residency_review(h,pg_temp.rr_id(204),actor,'reject',NULL,' Legacy reason ');
 PERFORM pg_temp.rr_expect(r);
 UPDATE public."HomeResidencyClaim" SET status='pending',reviewed_by=NULL,reviewed_at=NULL,review_note=NULL,
   updated_at=clock_timestamp() WHERE id=pg_temp.rr_id(204);
 again:=public.decide_home_residency_review(h,pg_temp.rr_id(204),actor,'reject',NULL,'Legacy reason');
 IF again->'receipt'<>r->'receipt' OR again->'claim'->>'status'<>'pending' OR again->>'replayed'<>'true' THEN
   RAISE EXCEPTION 'Legacy retry acted on a new submission'; END IF;

 -- Current authority is required even to recover an already committed receipt.
 INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(h,actor,'members.manage',false);
 PERFORM pg_temp.rr_expect(public.decide_home_residency_review(h,pg_temp.rr_id(204),actor,'reject',NULL,'Legacy reason'),
   'MEMBERS_MANAGE_REQUIRED');
 PERFORM pg_temp.rr_expect(public.get_home_residency_review(h,pg_temp.rr_id(204),actor),'MEMBERS_MANAGE_REQUIRED');
 DELETE FROM public."HomePermissionOverride" WHERE home_id=h AND user_id=actor AND permission='members.manage';
 UPDATE public."Home" SET security_state='frozen' WHERE id=h;
 PERFORM pg_temp.rr_expect(public.decide_home_residency_review(h,pg_temp.rr_id(204),actor,'reject',NULL,'Legacy reason'),
   'MEMBERS_MANAGE_REQUIRED');
 UPDATE public."Home" SET security_state='normal' WHERE id=h;

 -- A membership restriction change invalidates prepared review before approval.
 tok:=pg_temp.rr_token(205);
 UPDATE public."HomeOccupancy" SET access_end_at=now()+interval '12 hours' WHERE home_id=h AND user_id=pg_temp.rr_id(5);
 SELECT count(*) INTO receipt_count FROM public."HomeResidencyReviewReceipt" WHERE home_id=h;
 PERFORM pg_temp.rr_expect(public.decide_home_residency_review(h,pg_temp.rr_id(205),actor,'approve','member',NULL,pg_temp.rr_id(505),tok),
   'RESIDENCY_REVIEW_CHANGED');
 IF (SELECT count(*) FROM public."HomeResidencyReviewReceipt" WHERE home_id=h)<>receipt_count
   OR (SELECT verification_status FROM public."HomeOccupancy" WHERE home_id=h AND user_id=pg_temp.rr_id(5))<>'pending_doc' THEN
   RAISE EXCEPTION 'Stale review changed membership or wrote a receipt'; END IF;
 -- Existing admission ownership/role ceilings still apply inside the wrapper.
 PERFORM pg_temp.rr_expect(public.decide_home_residency_review(h,pg_temp.rr_id(206),actor,'approve','owner',NULL,pg_temp.rr_id(506),pg_temp.rr_token(206)),
   'RESIDENCY_ROLE_FORBIDDEN');
END $$;
RESET ROLE;
CREATE FUNCTION pg_temp.rr_refuse_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.request_id=pg_temp.rr_id(507) THEN RAISE EXCEPTION 'Injected receipt persistence failure'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER rr_refuse_receipt BEFORE INSERT ON public."HomeResidencyReviewReceipt"
 FOR EACH ROW EXECUTE FUNCTION pg_temp.rr_refuse_receipt();
SET LOCAL ROLE service_role;
DO $$ DECLARE h uuid:=pg_temp.rr_id(100); before_claim jsonb; before_member jsonb; audits integer; receipts integer; BEGIN
 SELECT to_jsonb(c) INTO before_claim FROM public."HomeResidencyClaim" c WHERE id=pg_temp.rr_id(207);
 SELECT to_jsonb(o) INTO before_member FROM public."HomeOccupancy" o WHERE home_id=h AND user_id=pg_temp.rr_id(7);
 SELECT count(*) INTO audits FROM public."HomeAuditLog" WHERE home_id=h;
 SELECT count(*) INTO receipts FROM public."HomeResidencyReviewReceipt" WHERE home_id=h;
 BEGIN
  PERFORM public.decide_home_residency_review(h,pg_temp.rr_id(207),pg_temp.rr_id(1),'approve','member',NULL,
    pg_temp.rr_id(507),pg_temp.rr_token(207));
  RAISE EXCEPTION 'The injected receipt failure did not occur';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'Injected receipt persistence failure' THEN RAISE; END IF;
 END;
 IF (SELECT to_jsonb(c) FROM public."HomeResidencyClaim" c WHERE id=pg_temp.rr_id(207))<>before_claim
   OR (SELECT to_jsonb(o) FROM public."HomeOccupancy" o WHERE home_id=h AND user_id=pg_temp.rr_id(7))<>before_member
   OR (SELECT count(*) FROM public."HomeAuditLog" WHERE home_id=h)<>audits
   OR (SELECT count(*) FROM public."HomeResidencyReviewReceipt" WHERE home_id=h)<>receipts THEN
   RAISE EXCEPTION 'Failed receipt persistence left partial admission, claim or audit changes'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT jsonb_agg(to_jsonb(r) ORDER BY role_base,permission) FROM public."HomeRolePermission" r)
   IS DISTINCT FROM (SELECT rows FROM rr_roles) THEN RAISE EXCEPTION 'Review changed shipped role defaults'; END IF;
END $$;
ROLLBACK;
