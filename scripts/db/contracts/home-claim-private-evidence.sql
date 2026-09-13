-- Actual shipped role defaults; all fixtures are rolled back.
BEGIN;
SET LOCAL search_path=public,extensions,pg_catalog;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE FUNCTION pg_temp.ce_id(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT ('ddc90000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
$$;
CREATE FUNCTION pg_temp.ce_expect(r jsonb,code text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql AS $$ BEGIN
  IF (code IS NULL AND r->>'ok' IS DISTINCT FROM 'true') OR (code IS NOT NULL AND r->>'code' IS DISTINCT FROM code) THEN
    RAISE EXCEPTION 'Expected %, received %',coalesce(code,'success'),r; END IF;
  RETURN r;
END $$;
CREATE TEMP TABLE ce_roles AS SELECT jsonb_agg(to_jsonb(r) ORDER BY role_base,permission) rows FROM public."HomeRolePermission" r;
INSERT INTO auth.users(id,email,email_confirmed_at)
  SELECT pg_temp.ce_id(n),'claim-private-evidence-'||n||'@example.invalid',now() FROM generate_series(1,8)n;
INSERT INTO public."User"(id,email,username,role)
  SELECT id,email,'claim_private_evidence_'||right(id::text,2),CASE WHEN id=pg_temp.ce_id(2) THEN 'admin' ELSE 'user' END
  FROM auth.users WHERE id::text LIKE 'ddc90000-0000-4000-8000-%';
INSERT INTO public."Home"(id,owner_id,created_by_user_id,address,city,state,zipcode,name) VALUES
  (pg_temp.ce_id(100),pg_temp.ce_id(1),pg_temp.ce_id(1),'900 Evidence Street','Test','WA','98607','Evidence fixture'),
  (pg_temp.ce_id(101),pg_temp.ce_id(6),pg_temp.ce_id(6),'901 Private Street','Test','WA','98607','Private fixture');
INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status,is_primary_owner,verification_tier) VALUES
  (pg_temp.ce_id(100),pg_temp.ce_id(1),'verified',true,'strong'),
  (pg_temp.ce_id(101),pg_temp.ce_id(6),'pending',true,'weak');
INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,verification_status,is_active,age_band) VALUES
  (pg_temp.ce_id(100),pg_temp.ce_id(1),'owner','owner','verified',true,'adult'),
  (pg_temp.ce_id(100),pg_temp.ce_id(3),'member','member','pending_doc',true,'adult'),
  (pg_temp.ce_id(100),pg_temp.ce_id(4),NULL,NULL,'pending_doc',true,'adult'),
  (pg_temp.ce_id(100),pg_temp.ce_id(5),'member','member','pending_doc',true,'teen'),
  (pg_temp.ce_id(101),pg_temp.ce_id(6),'owner','owner','pending_doc',true,NULL);
INSERT INTO public."HomeOwnershipClaim"(id,home_id,claimant_user_id,claim_type,state,method,claim_phase_v2,identity_status,expires_at)
  SELECT pg_temp.ce_id(200+n),CASE WHEN n=6 THEN pg_temp.ce_id(101) ELSE pg_temp.ce_id(100) END,pg_temp.ce_id(n),
    CASE WHEN n=3 THEN 'resident' ELSE 'owner' END,'submitted','doc_upload','evidence_submitted','verified',now()+interval '1 day'
  FROM generate_series(3,8)n;
SET LOCAL ROLE service_role;
DO $$ DECLARE h uuid:=pg_temp.ce_id(100); c uuid:=pg_temp.ce_id(203); owner_id uuid:=pg_temp.ce_id(1);
  admin_id uuid:=pg_temp.ce_id(2); actor uuid:=pg_temp.ce_id(3); u uuid:=pg_temp.ce_id(300); r jsonb; tok text; next_tok text;
  quota jsonb; attempt uuid; cleanup uuid; before_evidence jsonb;
  payload jsonb:='{"bucket":"private-evidence-fixture","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","file_name":"lease.txt","mime_type":"text/plain","file_size":4,"evidence_type":"lease"}';
BEGIN
  PERFORM pg_temp.ce_expect(public.authorize_home_claim_evidence(h,c,pg_temp.ce_id(7),'upload'),'CLAIM_EVIDENCE_DENIED');
  PERFORM pg_temp.ce_expect(public.authorize_home_claim_evidence(h,pg_temp.ce_id(204),pg_temp.ce_id(4),'upload'),'CLAIM_EVIDENCE_DENIED');
  PERFORM pg_temp.ce_expect(public.authorize_home_claim_evidence(h,c,actor,'verify'),'CLAIM_EVIDENCE_DENIED');
  -- Personal evidence never gives a teen authority to inspect somebody else's claim.
  PERFORM pg_temp.ce_expect(public.authorize_home_claim_evidence(h,pg_temp.ce_id(205),pg_temp.ce_id(5),'upload'));
  PERFORM pg_temp.ce_expect(public.authorize_home_claim_evidence(h,c,pg_temp.ce_id(5),'verify'),'CLAIM_EVIDENCE_DENIED');
  UPDATE public."HomeOccupancy" SET age_band='teen' WHERE home_id=h AND user_id=owner_id;
  PERFORM pg_temp.ce_expect(public.authorize_home_claim_evidence(h,c,owner_id,'verify'),'CLAIM_EVIDENCE_DENIED');
  UPDATE public."HomeOccupancy" SET age_band='adult' WHERE home_id=h AND user_id=owner_id;
  UPDATE public."HomeOccupancy" SET access_start_at=clock_timestamp()+interval '1 day' WHERE home_id=h AND user_id=actor;
  PERFORM pg_temp.ce_expect(public.mutate_home_claim_evidence(h,c,actor,'reserve',u,payload),'CLAIM_EVIDENCE_DENIED');
  UPDATE public."HomeOccupancy" SET access_start_at=NULL,access_end_at=clock_timestamp()-interval '1 second' WHERE home_id=h AND user_id=actor;
  PERFORM pg_temp.ce_expect(public.authorize_home_claim_evidence(h,c,actor,'upload'),'CLAIM_EVIDENCE_DENIED');
  UPDATE public."HomeOccupancy" SET access_end_at=NULL WHERE home_id=h AND user_id=actor;
  UPDATE public."HomeOwner" SET owner_status='revoked' WHERE home_id=h AND subject_id=owner_id;
  PERFORM pg_temp.ce_expect(public.authorize_home_claim_evidence(h,c,owner_id,'verify'),'CLAIM_EVIDENCE_DENIED');
  UPDATE public."HomeOwner" SET owner_status='verified' WHERE home_id=h AND subject_id=owner_id;
  PERFORM pg_temp.ce_expect(public.mutate_home_claim_evidence(h,c,actor,'reserve',u,payload||'{"evidence_type":"idv"}'),'CLAIM_EVIDENCE_INVALID');
  INSERT INTO public."FileQuota"(user_id,storage_limit,storage_used,file_count) VALUES(actor,3,0,0);
  BEGIN
    PERFORM public.mutate_home_claim_evidence(h,c,actor,'reserve',u,payload);
    RAISE EXCEPTION 'Quota-exhausted upload reserved file';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'FILE_QUOTA_EXCEEDED' THEN RAISE; END IF;
  END;
  IF EXISTS(SELECT FROM public."HomeClaimEvidenceIntent" WHERE id=u) OR EXISTS(SELECT FROM public."File" WHERE id=u)
    OR (SELECT storage_used FROM public."FileQuota" WHERE user_id=actor)<>0 THEN RAISE EXCEPTION 'Quota denial partially reserved'; END IF;
  UPDATE public."FileQuota" SET storage_limit=1073741824 WHERE user_id=actor;

  r:=pg_temp.ce_expect(public.mutate_home_claim_evidence(h,c,actor,'reserve',u,payload));
  IF r->'record'->>'state'<>'reserved' OR EXISTS(SELECT FROM public."HomeVerificationEvidence" WHERE id=u)
    OR (SELECT storage_used FROM public."FileQuota" WHERE user_id=actor)<>4 THEN RAISE EXCEPTION 'Reservation published or missed quota'; END IF;
  SELECT to_jsonb(q) INTO quota FROM public."FileQuota" q WHERE user_id=actor;
  PERFORM pg_temp.ce_expect(public.mutate_home_claim_evidence(h,c,actor,'reserve',u,payload));
  IF quota IS DISTINCT FROM (SELECT to_jsonb(q) FROM public."FileQuota" q WHERE user_id=actor) THEN RAISE EXCEPTION 'Duplicate quota'; END IF;
  PERFORM pg_temp.ce_expect(public.mutate_home_claim_evidence(h,c,actor,'reserve',u,payload||'{"evidence_type":"deed"}'),'CLAIM_UPLOAD_CONFLICT');
  PERFORM pg_temp.ce_expect(public.mutate_home_claim_evidence(h,pg_temp.ce_id(207),pg_temp.ce_id(7),'reserve',u,payload),'CLAIM_UPLOAD_CONFLICT');
  PERFORM pg_temp.ce_expect(public.get_home_claim_evidence(h,pg_temp.ce_id(207),pg_temp.ce_id(7),u),'CLAIM_EVIDENCE_NOT_FOUND');

  PERFORM pg_temp.ce_expect(public.mutate_home_claim_evidence(h,c,actor,'finalize',u),'CLAIM_UPLOAD_CONFLICT');
  PERFORM pg_temp.ce_expect(public.get_home_claim_evidence(h,c,owner_id,u),'CLAIM_EVIDENCE_NOT_FOUND');
  IF public.soft_delete_file(u,actor)->>'success' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Generic delete bypassed contract'; END IF;
  PERFORM pg_temp.ce_expect(public.mutate_home_claim_evidence(h,c,actor,'begin_upload',u));
  r:=pg_temp.ce_expect(public.mutate_home_claim_evidence(h,c,actor,'finalize',u));
  IF r->'record'->>'status'<>'pending' OR r->'record'->>'eligible_for_review'<>'false'
    OR public.home_claim_review_verified_evidence((SELECT e FROM public."HomeVerificationEvidence" e WHERE id=u)) THEN
    RAISE EXCEPTION 'Upload silently verified evidence'; END IF;
  r:=pg_temp.ce_expect(public.get_home_claim_review(h,c,owner_id));tok:=r->'claim'->>'review_token';
  IF r->'evidence'->0->>'file_name'<>'lease.txt' OR r->'evidence'->0->>'available'<>'true'
    OR r::text LIKE '%claim-evidence/%' OR r::text LIKE '%private-evidence-fixture%' THEN RAISE EXCEPTION 'Unsafe private evidence projection'; END IF;
  PERFORM pg_temp.ce_expect(public.mutate_home_claim_review(h,c,admin_id,'approve',tok,NULL,true),'CLAIM_VERIFIED_EVIDENCE_REQUIRED');
  PERFORM pg_temp.ce_expect(public.verify_home_claim_evidence(h,c,owner_id,u,false,tok,repeat('b',64)),'CLAIM_EVIDENCE_INSPECTION_REQUIRED');
  PERFORM pg_temp.ce_expect(public.record_home_claim_evidence_inspection(h,c,actor,u,false,tok,repeat('b',64)),'CLAIM_EVIDENCE_DENIED');
  PERFORM pg_temp.ce_expect(public.record_home_claim_evidence_inspection(h,c,owner_id,u,false,repeat('f',64),repeat('b',64)),'CLAIM_REVIEW_CHANGED');
  PERFORM pg_temp.ce_expect(public.record_home_claim_evidence_inspection(h,c,owner_id,u,false,tok,repeat('a',64)));
  UPDATE public."HomeOwnershipClaim" SET risk_score=9 WHERE id=c;
  PERFORM pg_temp.ce_expect(public.verify_home_claim_evidence(h,c,owner_id,u,false,tok,repeat('a',64)),'CLAIM_REVIEW_CHANGED');
  r:=pg_temp.ce_expect(public.get_home_claim_review(h,c,owner_id));tok:=r->'claim'->>'review_token';
  PERFORM pg_temp.ce_expect(public.record_home_claim_evidence_inspection(h,c,owner_id,u,false,tok,repeat('b',64)));
  PERFORM pg_temp.ce_expect(public.verify_home_claim_evidence(h,c,admin_id,u,true,tok,repeat('b',64)),'CLAIM_EVIDENCE_INSPECTION_REQUIRED');
  INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(h,owner_id,'ownership.manage',false);
  PERFORM pg_temp.ce_expect(public.verify_home_claim_evidence(h,c,owner_id,u,false,tok,repeat('b',64)),'CLAIM_EVIDENCE_DENIED');
  DELETE FROM public."HomePermissionOverride" WHERE home_id=h AND user_id=owner_id AND permission='ownership.manage';
  UPDATE public."HomeClaimEvidenceInspection" SET expires_at=clock_timestamp()-interval '1 second' WHERE receipt_hash=repeat('b',64);
  PERFORM pg_temp.ce_expect(public.verify_home_claim_evidence(h,c,owner_id,u,false,tok,repeat('b',64)),'CLAIM_EVIDENCE_INSPECTION_REQUIRED');
  PERFORM pg_temp.ce_expect(public.record_home_claim_evidence_inspection(h,c,owner_id,u,false,tok,repeat('c',64)));
  r:=pg_temp.ce_expect(public.verify_home_claim_evidence(h,c,owner_id,u,false,tok,repeat('c',64)));next_tok:=r->>'review_token';
  IF next_tok=tok OR r->'record'->>'status'<>'verified' OR (SELECT state FROM public."HomeOwnershipClaim" WHERE id=c)<>'submitted'
    OR EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=h AND subject_id=actor) THEN RAISE EXCEPTION 'Evidence review changed claim authority'; END IF;
  SELECT to_jsonb(e) INTO before_evidence FROM public."HomeVerificationEvidence" e WHERE id=u;
  r:=pg_temp.ce_expect(public.verify_home_claim_evidence(h,c,owner_id,u,false,tok,repeat('c',64)));
  IF r->>'replayed'<>'true' OR before_evidence IS DISTINCT FROM (SELECT to_jsonb(e) FROM public."HomeVerificationEvidence"e WHERE id=u) THEN
    RAISE EXCEPTION 'Inspection retry rewrote evidence'; END IF;
  PERFORM pg_temp.ce_expect(public.mutate_home_claim_evidence(h,c,actor,'retire',u),'CLAIM_EVIDENCE_RETENTION_REQUIRED');
  PERFORM pg_temp.ce_expect(public.mutate_home_claim_review(h,c,admin_id,'approve',tok,NULL,true),'CLAIM_REVIEW_CHANGED');
  r:=pg_temp.ce_expect(public.mutate_home_claim_review(h,c,admin_id,'approve',next_tok,NULL,true));
  IF r->'occupancy'->>'role_base'<>'lease_resident' OR EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=h AND subject_id=actor) THEN
    RAISE EXCEPTION 'Resident evidence approval became ownership'; END IF;
  PERFORM pg_temp.ce_expect(public.mutate_home_claim_evidence(h,c,actor,'reserve',pg_temp.ce_id(301),payload),'CLAIM_NOT_ELIGIBLE');

  -- A non-private claimant can retire only their exact unverified bytes after
  -- a protected withdrawal. A forged terminal row alone supplies no receipt.
  h:=pg_temp.ce_id(100);c:=pg_temp.ce_id(207);actor:=pg_temp.ce_id(7);u:=pg_temp.ce_id(307);
  PERFORM pg_temp.ce_expect(public.mutate_home_claim_evidence(h,c,actor,'reserve',u,payload));
  PERFORM pg_temp.ce_expect(public.mutate_home_claim_evidence(h,c,actor,'begin_upload',u));
  PERFORM pg_temp.ce_expect(public.mutate_home_claim_evidence(h,c,actor,'finalize',u));
  UPDATE public."HomeOwnershipClaim" SET state='revoked',claim_phase_v2='withdrawn',terminal_reason='withdrawn_by_user' WHERE id=c;
  PERFORM pg_temp.ce_expect(public.mutate_home_claim_evidence(h,c,actor,'retire',u),'CLAIM_NOT_ELIGIBLE');
  UPDATE public."HomeOwnershipClaim" SET state='submitted',claim_phase_v2='evidence_submitted',terminal_reason='none' WHERE id=c;
  PERFORM pg_temp.ce_expect(public.mutate_home_claim_review(h,c,actor,'withdraw'));
  IF EXISTS(SELECT FROM public."HomeClaimReviewReceipt" WHERE claim_id=c AND private_setup) THEN RAISE EXCEPTION 'Fixture unexpectedly private'; END IF;
  PERFORM pg_temp.ce_expect(public.mutate_home_claim_evidence(h,c,pg_temp.ce_id(8),'retire',u),'CLAIM_NOT_ELIGIBLE');
  r:=pg_temp.ce_expect(public.mutate_home_claim_evidence(h,c,actor,'retire',u));
  IF r->'record'->>'state'<>'retired' OR (SELECT storage_used FROM public."FileQuota" WHERE user_id=actor)<>0
    OR public.home_secret_context(h,actor)->>'private'='true' THEN RAISE EXCEPTION 'Withdrawal retirement retained quota or granted private Home'; END IF;

  -- A genuine private creator retains their setup throughout upload/retirement/withdrawal.
  h:=pg_temp.ce_id(101);c:=pg_temp.ce_id(206);actor:=pg_temp.ce_id(6);u:=pg_temp.ce_id(306);
  IF public.home_secret_context(h,actor)->>'private'<>'true' THEN RAISE EXCEPTION 'Missing initial private setup'; END IF;
  PERFORM pg_temp.ce_expect(public.mutate_home_claim_evidence(h,c,actor,'reserve',u,payload));
  IF public.home_secret_context(h,actor)->>'private'<>'true' THEN RAISE EXCEPTION 'Reservation broke private first use'; END IF;
  r:=pg_temp.ce_expect(public.mutate_home_claim_evidence(h,c,actor,'begin_upload',u));attempt:=(r->'storage'->>'upload_attempt')::uuid;
  PERFORM pg_temp.ce_expect(public.mutate_home_claim_evidence(h,c,actor,'finalize',u));
  IF public.home_secret_context(h,actor)->>'private'<>'true' THEN RAISE EXCEPTION 'Pending evidence broke private first use'; END IF;
  PERFORM pg_temp.ce_expect(public.mutate_home_claim_review(h,c,actor,'withdraw'));
  r:=pg_temp.ce_expect(public.mutate_home_claim_evidence(h,c,actor,'retire',u));cleanup:=(r->'storage'->>'cleanup_claim')::uuid;
  IF public.home_secret_context(h,actor)->>'private'<>'true' OR (SELECT file_count FROM public."FileQuota"WHERE user_id=actor)<>0 THEN
    RAISE EXCEPTION 'Retirement broke private first use or quota'; END IF;
  PERFORM public.note_home_claim_evidence_upload_finished(u,attempt);
  IF public.finish_home_claim_evidence_cleanup(u,cleanup,true) THEN RAISE EXCEPTION 'Late upload accepted stale cleanup'; END IF;
  r:=pg_temp.ce_expect(public.mutate_home_claim_evidence(h,c,actor,'retire',u));
  IF NOT public.finish_home_claim_evidence_cleanup(u,(r->'storage'->>'cleanup_claim')::uuid,true) THEN RAISE EXCEPTION 'Exact cleanup failed'; END IF;
  BEGIN DELETE FROM public."File" WHERE id=u; RAISE EXCEPTION 'Deleted private File history'; EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN DELETE FROM public."HomeVerificationEvidence" WHERE id=u; RAISE EXCEPTION 'Deleted verification history'; EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN UPDATE public."HomeClaimEvidenceIntent" SET uploaded_by=owner_id WHERE id=u; RAISE EXCEPTION 'Changed uploader'; EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.ce_id(3)::text,true);
DO $$ BEGIN
  IF EXISTS(SELECT FROM public."File" WHERE id=pg_temp.ce_id(300)) THEN RAISE EXCEPTION 'Direct File exposed private object'; END IF;
  IF has_table_privilege('authenticated','public."HomeClaimEvidenceIntent"','SELECT,INSERT,UPDATE,DELETE')
    OR has_table_privilege('authenticated','public."HomeClaimEvidenceInspection"','SELECT,INSERT,UPDATE,DELETE')
    OR has_function_privilege('authenticated','public.verify_home_claim_evidence(uuid,uuid,uuid,uuid,boolean,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Client can forge evidence or inspection provenance'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT rows FROM ce_roles) IS DISTINCT FROM (SELECT jsonb_agg(to_jsonb(r) ORDER BY role_base,permission) FROM public."HomeRolePermission"r)
    OR (SELECT count(*) FROM public."HomeRolePermission")<>31 THEN RAISE EXCEPTION 'Changed shipped role defaults'; END IF;
END $$;
ROLLBACK;
