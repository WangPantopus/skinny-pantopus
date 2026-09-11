-- Actual current-authority decisions, trusted evidence and retained receipts.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
SET LOCAL search_path=public,extensions,pg_catalog;
CREATE FUNCTION pg_temp.rd_id(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
 SELECT ('ddc23000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
$$;
CREATE FUNCTION pg_temp.rd_expect(r jsonb,c text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 IF (c IS NULL AND r->>'ok' IS DISTINCT FROM 'true') OR (c IS NOT NULL AND r->>'code' IS DISTINCT FROM c) THEN
  RAISE EXCEPTION 'Expected %, got %',coalesce(c,'success'),r; END IF;
END $$;
CREATE FUNCTION pg_temp.rd_snapshot(n integer) RETURNS text LANGUAGE sql AS $$
 SELECT public.home_claim_review_snapshot(c) FROM public."HomeOwnershipClaim" c WHERE id=pg_temp.rd_id(n);
$$;
CREATE TEMP TABLE rd_roles AS SELECT jsonb_agg(to_jsonb(r) ORDER BY role_base,permission) rows FROM public."HomeRolePermission" r;
INSERT INTO auth.users(id,email,email_confirmed_at)
 SELECT pg_temp.rd_id(n),'relationship-'||n||'@example.invalid',now() FROM generate_series(1,20)n;
INSERT INTO public."User"(id,email,username,role)
 SELECT id,email,'relationship_'||right(id::text,2),'user' FROM auth.users WHERE id::text LIKE 'ddc23000-%';
INSERT INTO public."Home"(id,owner_id,created_by_user_id,address,city,state,zipcode,name)
 VALUES(pg_temp.rd_id(100),pg_temp.rd_id(1),pg_temp.rd_id(1),'230 Relationship Street','Test','WA','98607','Relationship fixture');
INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status,is_primary_owner,verification_tier)
 VALUES(pg_temp.rd_id(100),pg_temp.rd_id(1),'verified',true,'strong');
INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status)
 VALUES(pg_temp.rd_id(100),pg_temp.rd_id(1),'owner','owner','adult','verified');
INSERT INTO public."HomeOwnershipClaim"(id,home_id,claimant_user_id,claim_type,state,method,claim_phase_v2,identity_status,expires_at)
 SELECT pg_temp.rd_id(200+n),pg_temp.rd_id(100),pg_temp.rd_id(n+1),'owner','submitted','doc_upload',
 'under_review','not_started',now()+interval '3 days' FROM generate_series(1,15)n;
INSERT INTO public."HomeVerificationEvidence"(id,claim_id,evidence_type,provider,status,storage_ref,metadata) VALUES
 (pg_temp.rd_id(601),pg_temp.rd_id(201),'deed','manual','pending',NULL,'{}'),
 (pg_temp.rd_id(602),pg_temp.rd_id(202),'deed','manual','verified','legacy/untrusted-deed.pdf','{}'),
 (pg_temp.rd_id(603),pg_temp.rd_id(203),'title_match','attom','verified',NULL,'{"matched":true,"confidence":90}');
CREATE TEMP TABLE rd_members AS SELECT to_jsonb(o) row FROM public."HomeOccupancy" o WHERE home_id=pg_temp.rd_id(100);
CREATE TEMP TABLE rd_owners AS SELECT to_jsonb(o) row FROM public."HomeOwner" o WHERE home_id=pg_temp.rd_id(100);
CREATE TEMP TABLE rd_evidence AS SELECT to_jsonb(e) row FROM public."HomeVerificationEvidence" e WHERE id::text LIKE 'ddc23000-%';
GRANT SELECT ON rd_members TO service_role;
SET LOCAL ROLE service_role;
DO $$ DECLARE h uuid:=pg_temp.rd_id(100); actor uuid:=pg_temp.rd_id(1); r jsonb; replay jsonb; tok text;
 before_claim jsonb; before_home jsonb; receipt_id uuid; n integer; field text; BEGIN
 IF has_table_privilege('authenticated','public."HomeClaimRelationshipReceipt"','SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
   OR has_table_privilege('anon','public."HomeClaimRelationshipReceipt"','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') THEN
   RAISE EXCEPTION 'Receipt provenance is client accessible'; END IF;
 IF has_function_privilege('authenticated','public.decide_home_claim_relationship(uuid,uuid,uuid,text,text,uuid,text)','EXECUTE')
   OR has_function_privilege('anon','public.decide_home_claim_relationship(uuid,uuid,uuid,text,text,uuid,text)','EXECUTE')
   OR NOT has_function_privilege('service_role','public.decide_home_claim_relationship(uuid,uuid,uuid,text,text,uuid,text)','EXECUTE') THEN
   RAISE EXCEPTION 'Unsafe relationship RPC access'; END IF;
 PERFORM pg_temp.rd_expect(public.decide_home_claim_relationship(h,pg_temp.rd_id(201),actor,'unknown'),'CLAIM_RELATIONSHIP_INVALID');
 PERFORM pg_temp.rd_expect(public.decide_home_claim_relationship(h,pg_temp.rd_id(201),actor,'decline_relationship',NULL,pg_temp.rd_id(501)),
   'CLAIM_RELATIONSHIP_INVALID');
 PERFORM pg_temp.rd_expect(public.decide_home_claim_relationship(h,pg_temp.rd_id(999),actor,'decline_relationship'),'CLAIM_NOT_FOUND');
 PERFORM pg_temp.rd_expect(public.decide_home_claim_relationship(h,pg_temp.rd_id(201),pg_temp.rd_id(2),'decline_relationship'),'CLAIM_REVIEW_DENIED');

 SELECT to_jsonb(c) INTO before_claim FROM public."HomeOwnershipClaim" c WHERE id=pg_temp.rd_id(201);
 SELECT to_jsonb(home_row) INTO before_home FROM public."Home" home_row WHERE id=h;
 r:=public.decide_home_claim_relationship(h,pg_temp.rd_id(201),actor,'decline_relationship',' Keep reviewing ');
 PERFORM pg_temp.rd_expect(r); receipt_id:=(r->'receipt'->>'id')::uuid;
 replay:=public.decide_home_claim_relationship(h,pg_temp.rd_id(201),actor,'decline_relationship','Keep reviewing');
 PERFORM pg_temp.rd_expect(replay);
 IF replay->>'replayed'<>'true' OR replay->'receipt'<>r->'receipt' OR NOT (r->'receipt'->>'legacy_request')::boolean
   OR (SELECT to_jsonb(c) FROM public."HomeOwnershipClaim" c WHERE id=pg_temp.rd_id(201))<>before_claim
   OR (SELECT to_jsonb(home_row) FROM public."Home" home_row WHERE id=h)<>before_home
   OR (SELECT count(*) FROM public."HomeAuditLog" WHERE metadata->>'receipt_id'=receipt_id::text)<>1 THEN
   RAISE EXCEPTION 'Decline/retry changed claim/Home or repeated its audit'; END IF;

 tok:=pg_temp.rd_snapshot(204);
 PERFORM pg_temp.rd_expect(public.decide_home_claim_relationship(h,pg_temp.rd_id(204),actor,'decline_relationship',NULL,
   pg_temp.rd_id(504),repeat('0',64)),'CLAIM_REVIEW_CHANGED');
 r:=public.decide_home_claim_relationship(h,pg_temp.rd_id(204),actor,'decline_relationship',NULL,pg_temp.rd_id(504),tok);
 PERFORM pg_temp.rd_expect(r);
 PERFORM pg_temp.rd_expect(public.decide_home_claim_relationship(h,pg_temp.rd_id(204),actor,'flag_unknown_person',NULL,
   pg_temp.rd_id(504),tok),'CLAIM_RELATIONSHIP_REQUEST_CHANGED');
 PERFORM pg_temp.rd_expect(public.decide_home_claim_relationship(h,pg_temp.rd_id(204),actor,'decline_relationship','changed',
   pg_temp.rd_id(504),tok),'CLAIM_RELATIONSHIP_REQUEST_CHANGED');

 -- Neither a pending deed nor a legacy verified label is trusted evidence.
 FOREACH n IN ARRAY ARRAY[201,202] LOOP
   r:=public.decide_home_claim_relationship(h,pg_temp.rd_id(n),actor,'flag_unknown_person'); PERFORM pg_temp.rd_expect(r);
   IF r->'receipt'->'result'->>'qualifies_for_dispute'<>'false' OR r->'claim'->>'challenge_state'<>'none'
     OR r->'claim'->>'claim_phase_v2'<>'under_review' OR r->'claim'->>'claim_strength' IS NOT NULL
     OR r->>'home_resolution_state'<>'verified_household' THEN RAISE EXCEPTION 'Untrusted evidence created dispute'; END IF;
 END LOOP;

 -- Original receipt is historical; retry returns today's changed claim without
 -- restoring its former routing, state, evidence or household resolution.
 r:=public.decide_home_claim_relationship(h,pg_temp.rd_id(201),actor,'flag_unknown_person');
 UPDATE public."HomeOwnershipClaim" SET state='rejected',claim_phase_v2='rejected',terminal_reason='rejected_review',
   updated_at=clock_timestamp() WHERE id=pg_temp.rd_id(201);
 SELECT to_jsonb(c) INTO before_claim FROM public."HomeOwnershipClaim" c WHERE id=pg_temp.rd_id(201);
 replay:=public.decide_home_claim_relationship(h,pg_temp.rd_id(201),actor,'flag_unknown_person'); PERFORM pg_temp.rd_expect(replay);
 IF replay->'receipt'<>r->'receipt' OR replay->'claim'->>'state'<>'rejected' OR replay->>'replayed'<>'true'
   OR (SELECT to_jsonb(c) FROM public."HomeOwnershipClaim" c WHERE id=pg_temp.rd_id(201))<>before_claim THEN
   RAISE EXCEPTION 'Recovery rewound a later claim decision'; END IF;
 PERFORM pg_temp.rd_expect(public.decide_home_claim_relationship(h,pg_temp.rd_id(201),actor,'flag_unknown_person',NULL,
   pg_temp.rd_id(505),pg_temp.rd_snapshot(201)),'CLAIM_NOT_ELIGIBLE');

 -- Trusted provider evidence qualifies, but does not freeze Home security,
 -- decide ownership, verify identity or remove another person's access.
 tok:=pg_temp.rd_snapshot(203);
 r:=public.decide_home_claim_relationship(h,pg_temp.rd_id(203),actor,'flag_unknown_person',NULL,pg_temp.rd_id(503),tok);
 PERFORM pg_temp.rd_expect(r);
 IF r->'receipt'->'result'->>'qualifies_for_dispute'<>'true' OR r->'claim'->>'challenge_state'<>'challenged'
   OR r->'claim'->>'claim_strength'<>'owner_legal' OR r->>'home_resolution_state'<>'disputed'
   OR (SELECT security_state FROM public."Home" WHERE id=h)<>'normal'
   OR (SELECT identity_status FROM public."HomeOwnershipClaim" WHERE id=pg_temp.rd_id(203))<>'not_started' THEN
   RAISE EXCEPTION 'Incorrect trusted dispute transition'; END IF;
 replay:=public.decide_home_claim_relationship(h,pg_temp.rd_id(203),actor,'flag_unknown_person',NULL,pg_temp.rd_id(503),tok);
 PERFORM pg_temp.rd_expect(replay);
 IF replay->'receipt'<>r->'receipt' THEN RAISE EXCEPTION 'Dispute retry changed original receipt'; END IF;
 PERFORM pg_temp.rd_expect(public.decide_home_claim_relationship(h,pg_temp.rd_id(203),actor,'decline_relationship'),
   'CLAIM_CHALLENGE_REVIEW_REQUIRED');

 -- Every recovery rechecks current reviewer authority, including age/windows.
 UPDATE public."HomeOccupancy" SET is_active=false WHERE home_id=h AND user_id=actor;
 PERFORM pg_temp.rd_expect(public.decide_home_claim_relationship(h,pg_temp.rd_id(203),actor,'flag_unknown_person',NULL,pg_temp.rd_id(503),tok),
   'CLAIM_REVIEW_DENIED');
 UPDATE public."HomeOccupancy" SET is_active=true WHERE home_id=h AND user_id=actor;
 FOREACH field IN ARRAY ARRAY['start_at','access_start_at','end_at','access_end_at'] LOOP
   EXECUTE format('UPDATE public."HomeOccupancy" SET %I=clock_timestamp()+%L::interval WHERE home_id=$1 AND user_id=$2',field,
     CASE WHEN field IN ('start_at','access_start_at') THEN '1 day' ELSE '-1 day' END) USING h,actor;
   PERFORM pg_temp.rd_expect(public.decide_home_claim_relationship(h,pg_temp.rd_id(204),actor,'decline_relationship'), 'CLAIM_REVIEW_DENIED');
   EXECUTE format('UPDATE public."HomeOccupancy" SET %I=(SELECT (row->>%L)::timestamptz FROM rd_members) WHERE home_id=$1 AND user_id=$2',field,field) USING h,actor;
 END LOOP;
 UPDATE public."HomeOccupancy" SET age_band='teen' WHERE home_id=h AND user_id=actor;
 PERFORM pg_temp.rd_expect(public.decide_home_claim_relationship(h,pg_temp.rd_id(204),actor,'decline_relationship'), 'CLAIM_REVIEW_DENIED');
 UPDATE public."HomeOccupancy" SET age_band='adult' WHERE home_id=h AND user_id=actor;
 INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(h,actor,'ownership.manage',false);
 PERFORM pg_temp.rd_expect(public.decide_home_claim_relationship(h,pg_temp.rd_id(204),actor,'decline_relationship'), 'CLAIM_REVIEW_DENIED');
 DELETE FROM public."HomePermissionOverride" WHERE home_id=h AND user_id=actor AND permission='ownership.manage';
 UPDATE public."Home" SET security_state='frozen' WHERE id=h;
 PERFORM pg_temp.rd_expect(public.decide_home_claim_relationship(h,pg_temp.rd_id(204),actor,'decline_relationship'), 'CLAIM_REVIEW_DENIED');
 UPDATE public."Home" SET security_state='normal' WHERE id=h;
 UPDATE public."HomeOwnershipClaim" SET expires_at=clock_timestamp()-interval '1 day' WHERE id=pg_temp.rd_id(205);
 PERFORM pg_temp.rd_expect(public.decide_home_claim_relationship(h,pg_temp.rd_id(205),actor,'decline_relationship'), 'CLAIM_NOT_ELIGIBLE');
END $$;
RESET ROLE;
-- An audit storage failure rolls back the claim, Home summary and receipt too.
CREATE FUNCTION pg_temp.rd_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.home_id=pg_temp.rd_id(100) AND NEW.target_id=pg_temp.rd_id(208) THEN RAISE EXCEPTION 'owned relationship audit failure'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER rd_audit_failure BEFORE INSERT ON public."HomeAuditLog" FOR EACH ROW EXECUTE FUNCTION pg_temp.rd_fail_audit();
DO $$ DECLARE before_claim jsonb; before_home jsonb; BEGIN
 SELECT to_jsonb(c) INTO before_claim FROM public."HomeOwnershipClaim" c WHERE id=pg_temp.rd_id(208);
 SELECT to_jsonb(h) INTO before_home FROM public."Home" h WHERE id=pg_temp.rd_id(100);
 BEGIN
   PERFORM public.decide_home_claim_relationship(pg_temp.rd_id(100),pg_temp.rd_id(208),pg_temp.rd_id(1),'flag_unknown_person');
   RAISE EXCEPTION 'expected audit rollback did not occur';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'owned relationship audit failure' THEN RAISE; END IF; END;
 IF EXISTS(SELECT FROM public."HomeClaimRelationshipReceipt" WHERE claim_id=pg_temp.rd_id(208))
   OR (SELECT to_jsonb(c) FROM public."HomeOwnershipClaim" c WHERE id=pg_temp.rd_id(208))<>before_claim
   OR (SELECT to_jsonb(h) FROM public."Home" h WHERE id=pg_temp.rd_id(100))<>before_home THEN
   RAISE EXCEPTION 'Audit failure left a partial decision'; END IF;
 IF EXISTS((SELECT row-'updated_at' FROM rd_members) EXCEPT (SELECT to_jsonb(o)-'updated_at' FROM public."HomeOccupancy" o WHERE home_id=pg_temp.rd_id(100)))
   OR EXISTS((SELECT row FROM rd_owners) EXCEPT (SELECT to_jsonb(o) FROM public."HomeOwner" o WHERE home_id=pg_temp.rd_id(100)))
   OR EXISTS((SELECT row FROM rd_evidence) EXCEPT (SELECT to_jsonb(e) FROM public."HomeVerificationEvidence" e WHERE id::text LIKE 'ddc23000-%'))
   OR (SELECT rows FROM rd_roles)<>(SELECT jsonb_agg(to_jsonb(r) ORDER BY role_base,permission) FROM public."HomeRolePermission" r) THEN
   RAISE EXCEPTION 'Decision changed preserved membership/proof/evidence/defaults'; END IF;
END $$;
ROLLBACK;
