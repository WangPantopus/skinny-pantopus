-- Actual shipped 31 role rows, trusted provider evidence, no local role grants.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
SET LOCAL search_path=public,extensions,pg_catalog;
CREATE FUNCTION pg_temp.cr_id(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
 SELECT ('ddc80000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
$$;
CREATE FUNCTION pg_temp.cr_expect(r jsonb,c text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 IF (c IS NULL AND r->>'ok' IS DISTINCT FROM 'true') OR (c IS NOT NULL AND r->>'code' IS DISTINCT FROM c) THEN
  RAISE EXCEPTION 'Expected %, got %',coalesce(c,'success'),r; END IF;
END $$;
CREATE TEMP TABLE cr_roles AS SELECT jsonb_agg(to_jsonb(r) ORDER BY role_base,permission) rows FROM public."HomeRolePermission" r;
DO $$ DECLARE f text; t text; BEGIN
 FOREACH t IN ARRAY ARRAY['HomeOwnershipClaim','HomeVerificationEvidence'] LOOP
  IF has_table_privilege('authenticated','public.'||quote_ident(t),'SELECT') OR has_table_privilege('anon','public.'||quote_ident(t),'SELECT') THEN
   RAISE EXCEPTION 'Unsafe direct claim/evidence read: %',t; END IF;
 END LOOP;
 IF has_table_privilege('authenticated','public."HomeClaimReviewReceipt"','SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
  OR has_table_privilege('anon','public."HomeClaimReviewReceipt"','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') THEN
  RAISE EXCEPTION 'Review provenance table is client accessible'; END IF;
 IF (SELECT count(*) FROM public."HomeRolePermission")<>31 THEN RAISE EXCEPTION 'Expected shipped role rows'; END IF;
 FOREACH f IN ARRAY ARRAY['public.get_home_claim_review(uuid,uuid,uuid,boolean)',
 'public.mutate_home_claim_review(uuid,uuid,uuid,text,text,text,boolean,integer)',
 'public.record_home_claim_provider_evidence(uuid,uuid,uuid,text,boolean,numeric,jsonb,text)'] LOOP
  IF has_function_privilege('anon',f,'EXECUTE') OR has_function_privilege('authenticated',f,'EXECUTE')
   OR NOT has_function_privilege('service_role',f,'EXECUTE') THEN RAISE EXCEPTION 'Unsafe review RPC ACL: %',f; END IF;
 END LOOP;
END $$;
INSERT INTO auth.users(id,email,email_confirmed_at) SELECT pg_temp.cr_id(n),'home-claim-review-'||n||'@example.invalid',now() FROM generate_series(1,30)n;
INSERT INTO public."User"(id,email,username,role) SELECT id,email,'home_claim_review_'||right(id::text,2),
 CASE WHEN id=pg_temp.cr_id(2) THEN 'admin' ELSE 'user' END FROM auth.users WHERE id::text LIKE 'ddc80000-0000-4000-8000-%';
INSERT INTO public."Home"(id,owner_id,created_by_user_id,address,city,state,zipcode,name) VALUES
 (pg_temp.cr_id(100),pg_temp.cr_id(1),pg_temp.cr_id(1),'800 Review Street','Test','WA','98607','Review fixture'),
 (pg_temp.cr_id(101),pg_temp.cr_id(25),pg_temp.cr_id(25),'801 Private Street','Test','WA','98607','Private fixture'),
 (pg_temp.cr_id(102),NULL,pg_temp.cr_id(26),'802 First Street','Test','WA','98607','First fixture');
INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status,is_primary_owner,verification_tier) VALUES
 (pg_temp.cr_id(100),pg_temp.cr_id(1),'verified',true,'strong'),(pg_temp.cr_id(101),pg_temp.cr_id(25),'pending',true,'weak');
INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,is_active,verification_status,start_at,end_at,access_start_at,access_end_at)
 SELECT pg_temp.cr_id(100),pg_temp.cr_id(n),role,base::public.home_role_base,age::public.home_age_band,true,status,
 now()-interval '3 days',now()+interval '3 days',now()-interval '2 days',now()+interval '2 days'
 FROM (VALUES(1,'owner','owner','adult','verified'),(3,'member','member',NULL,'pending_doc'),
 (4,'member','member','adult','pending_doc'),(5,'member','member','adult','pending_doc'),
 (6,'member','member','child','pending_doc'),(7,'member','member','teen','verified'),
 (8,'member','member','adult','revoked'),(9,NULL,NULL,'adult','pending_doc'),(10,'member','member','adult','pending_doc')) f(n,role,base,age,status);
INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status,is_active)
 VALUES(pg_temp.cr_id(101),pg_temp.cr_id(25),'owner','owner',NULL,'pending_doc',true),
 (pg_temp.cr_id(102),pg_temp.cr_id(26),'owner','owner',NULL,'pending_doc',true);
INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(pg_temp.cr_id(100),pg_temp.cr_id(3),'finance.manage',false);
INSERT INTO public."HomeOwnershipClaim"(id,home_id,claimant_user_id,claim_type,state,method,claim_phase_v2,identity_status,expires_at)
 SELECT pg_temp.cr_id(200+n),pg_temp.cr_id(100),pg_temp.cr_id(n),CASE n WHEN 4 THEN 'admin' WHEN 5 THEN 'resident' ELSE 'owner' END,
 'submitted','property_data_match','under_review','verified',now()+interval '3 days' FROM generate_series(3,24)n;
INSERT INTO public."HomeOwnershipClaim"(id,home_id,claimant_user_id,claim_type,state,method,claim_phase_v2,identity_status,expires_at) VALUES
 (pg_temp.cr_id(225),pg_temp.cr_id(101),pg_temp.cr_id(25),'owner','submitted','doc_upload','evidence_submitted','not_started',now()+interval '3 days'),
 (pg_temp.cr_id(226),pg_temp.cr_id(102),pg_temp.cr_id(26),'owner','submitted','property_data_match','under_review','verified',now()+interval '3 days');
INSERT INTO public."HomeVerificationEvidence"(id,claim_id,evidence_type,provider,status,metadata)
 SELECT pg_temp.cr_id(300+n),pg_temp.cr_id(200+n),'title_match','attom','verified','{"matched":true,"confidence":90}' FROM generate_series(3,24)n;
INSERT INTO public."HomeVerificationEvidence"(id,claim_id,evidence_type,provider,status,metadata)
 VALUES(pg_temp.cr_id(326),pg_temp.cr_id(226),'title_match','attom','verified','{"matched":true,"confidence":90}');
CREATE TEMP TABLE cr_evidence_before AS SELECT jsonb_agg(to_jsonb(e) ORDER BY id) rows FROM public."HomeVerificationEvidence" e;
SET LOCAL ROLE service_role;
DO $$ DECLARE h uuid:=pg_temp.cr_id(100); actor uuid:=pg_temp.cr_id(1); admin_id uuid:=pg_temp.cr_id(2);
 r jsonb; tok text; before_occ jsonb; n integer; v_role text; BEGIN
 INSERT INTO public."HomeOwnershipClaim"(id,home_id,claimant_user_id,claim_type,state,method,claim_phase_v2)
  VALUES(pg_temp.cr_id(227),h,admin_id,'owner','submitted','doc_upload','under_review');
 PERFORM pg_temp.cr_expect(public.mutate_home_claim_review(h,pg_temp.cr_id(227),admin_id,'approve',NULL,NULL,true),'CLAIM_SELF_REVIEW_FORBIDDEN');
 -- Exact read supplies a snapshot, with no signing refs or caller metadata.
 UPDATE public."HomeVerificationEvidence" SET storage_ref='foreign/account/secret.pdf',metadata='{"file_url":"https://example.invalid/secret"}' WHERE id=pg_temp.cr_id(311);
 r:=public.get_home_claim_review(h,pg_temp.cr_id(211),actor);PERFORM pg_temp.cr_expect(r);
 IF r::text LIKE '%foreign/account%' OR (r->'evidence')::text LIKE '%example.invalid%' OR r->'evidence'->0->>'storage_ref' IS NOT NULL
  OR r->'evidence'->0->>'file_url' IS NOT NULL OR r->'evidence'->0->>'eligible_for_review'<>'false' THEN RAISE EXCEPTION 'Unsafe evidence projection'; END IF;
 PERFORM pg_temp.cr_expect(public.get_home_claim_review(h,pg_temp.cr_id(211),pg_temp.cr_id(11)),'CLAIM_REVIEW_DENIED');
 PERFORM pg_temp.cr_expect(public.get_home_claim_review(pg_temp.cr_id(101),pg_temp.cr_id(211),admin_id,true),'CLAIM_NOT_FOUND');
 -- Existing primary, restrictive override, NULL age and original access windows survive co-owner review.
 SELECT to_jsonb(o) INTO before_occ FROM public."HomeOccupancy"o WHERE home_id=h AND user_id=pg_temp.cr_id(3);
 r:=public.get_home_claim_review(h,pg_temp.cr_id(203),actor);tok:=r->'claim'->>'review_token';
 PERFORM pg_temp.cr_expect(public.mutate_home_claim_review(h,pg_temp.cr_id(203),actor,'approve',NULL),'CLAIM_REVIEW_CHANGED');
 r:=public.mutate_home_claim_review(h,pg_temp.cr_id(203),actor,'approve',tok);PERFORM pg_temp.cr_expect(r);
 IF r->'occupancy'->>'role_base'<>'owner' OR r->'occupancy'->>'age_band' IS NOT NULL
  OR (r->'occupancy'->>'start_at')::timestamptz<>(before_occ->>'start_at')::timestamptz
  OR (r->'occupancy'->>'end_at')::timestamptz<>(before_occ->>'end_at')::timestamptz
  OR (r->'occupancy'->>'access_start_at')::timestamptz<>(before_occ->>'access_start_at')::timestamptz
  OR (r->'occupancy'->>'access_end_at')::timestamptz<>(before_occ->>'access_end_at')::timestamptz
  OR public.home_has_permission(h,'finance.manage',pg_temp.cr_id(3))
  OR (SELECT owner_id FROM public."Home" WHERE id=h)<>actor
  OR NOT EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=h AND subject_id=actor AND owner_status='verified' AND is_primary_owner)
  OR NOT EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=h AND subject_id=pg_temp.cr_id(3) AND owner_status='verified' AND NOT is_primary_owner) THEN
  RAISE EXCEPTION 'Approval reset restrictions or primary ownership'; END IF;
 SELECT count(*) INTO n FROM public."HomeAuditLog" WHERE home_id=h; before_occ:=r;
 r:=public.mutate_home_claim_review(h,pg_temp.cr_id(203),actor,'approve',tok);PERFORM pg_temp.cr_expect(r);
 IF r->>'replayed'<>'true' OR r-'replayed' IS DISTINCT FROM before_occ-'replayed'
  OR (SELECT count(*) FROM public."HomeAuditLog" WHERE home_id=h)<>n THEN RAISE EXCEPTION 'Approval retry duplicated or changed result'; END IF;
 PERFORM pg_temp.cr_expect(public.mutate_home_claim_review(h,pg_temp.cr_id(203),actor,'approve',tok,'Different note'),'CLAIM_REVIEW_CHANGED');
 INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(h,pg_temp.cr_id(3),'access.manage',false);
 PERFORM pg_temp.cr_expect(public.mutate_home_claim_review(h,pg_temp.cr_id(203),actor,'approve',tok),'CLAIM_REVIEW_CHANGED');
 DELETE FROM public."HomePermissionOverride" WHERE home_id=h AND user_id=pg_temp.cr_id(3) AND permission='access.manage';
 PERFORM pg_temp.cr_expect(public.mutate_home_claim_review(h,pg_temp.cr_id(203),pg_temp.cr_id(3),'withdraw'),'CLAIM_NOT_ELIGIBLE');
 PERFORM pg_temp.cr_expect(public.record_home_claim_provider_evidence(h,pg_temp.cr_id(203),pg_temp.cr_id(3),'attom',true,99),'CLAIM_NOT_ELIGIBLE');
 -- Admin and resident proofs never create HomeOwner or replace primary.
 FOREACH n IN ARRAY ARRAY[4,5] LOOP
  r:=public.get_home_claim_review(h,pg_temp.cr_id(200+n),admin_id,true);
  r:=public.mutate_home_claim_review(h,pg_temp.cr_id(200+n),admin_id,'approve',r->'claim'->>'review_token',NULL,true);PERFORM pg_temp.cr_expect(r);
  v_role:=CASE n WHEN 4 THEN 'admin' ELSE 'lease_resident' END;
  IF r->'occupancy'->>'role_base'<>v_role OR EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=h AND subject_id=pg_temp.cr_id(n))
   OR (SELECT owner_id FROM public."Home" WHERE id=h)<>actor THEN RAISE EXCEPTION 'Non-owner claim became ownership'; END IF;
 END LOOP;
 -- Actual no-evidence/pending/legacy manual rows cannot mark a claim approved.
 FOREACH n IN ARRAY ARRAY[11,12,13] LOOP
  IF n=12 THEN UPDATE public."HomeVerificationEvidence" SET status='pending' WHERE id=pg_temp.cr_id(300+n); END IF;
  IF n=13 THEN UPDATE public."HomeVerificationEvidence" SET provider='manual',evidence_type='deed' WHERE id=pg_temp.cr_id(300+n); END IF;
  r:=public.get_home_claim_review(h,pg_temp.cr_id(200+n),admin_id,true);
  PERFORM pg_temp.cr_expect(public.mutate_home_claim_review(h,pg_temp.cr_id(200+n),admin_id,'approve',r->'claim'->>'review_token',NULL,true),'CLAIM_VERIFIED_EVIDENCE_REQUIRED');
  IF (SELECT state FROM public."HomeOwnershipClaim" WHERE id=pg_temp.cr_id(200+n))<>'submitted'
   OR EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=h AND subject_id=pg_temp.cr_id(n)) THEN RAISE EXCEPTION 'Evidence denial partially approved claim'; END IF;
 END LOOP;
 DELETE FROM public."HomeVerificationEvidence" WHERE id=pg_temp.cr_id(314);
 r:=public.get_home_claim_review(h,pg_temp.cr_id(214),actor);
 PERFORM pg_temp.cr_expect(public.mutate_home_claim_review(h,pg_temp.cr_id(214),actor,'approve',r->'claim'->>'review_token'),'CLAIM_VERIFIED_EVIDENCE_REQUIRED');
 -- Snapshot includes every evidence/source field, not only the status label.
 r:=public.get_home_claim_review(h,pg_temp.cr_id(215),actor);tok:=r->'claim'->>'review_token';
 UPDATE public."HomeVerificationEvidence" SET metadata='{"matched":false}' WHERE id=pg_temp.cr_id(315);
 PERFORM pg_temp.cr_expect(public.mutate_home_claim_review(h,pg_temp.cr_id(215),actor,'approve',tok),'CLAIM_REVIEW_CHANGED');
 r:=public.get_home_claim_review(h,pg_temp.cr_id(215),actor);tok:=r->'claim'->>'review_token';
 UPDATE public."HomeOwnershipClaim" SET method='vouch' WHERE id=pg_temp.cr_id(215);
 PERFORM pg_temp.cr_expect(public.mutate_home_claim_review(h,pg_temp.cr_id(215),actor,'approve',tok),'CLAIM_REVIEW_CHANGED');
 -- Target age/status/history and access starts are current even for platform review.
 FOREACH n IN ARRAY ARRAY[6,7,8,9] LOOP
  r:=public.get_home_claim_review(h,pg_temp.cr_id(200+n),admin_id,true);
  PERFORM pg_temp.cr_expect(public.mutate_home_claim_review(h,pg_temp.cr_id(200+n),admin_id,'approve',r->'claim'->>'review_token',NULL,true),
   CASE WHEN n IN (6,7) THEN 'PROPOSED_ROLE_FORBIDDEN' ELSE 'MEMBERSHIP_RENEWAL_REQUIRED' END);
 END LOOP;
 UPDATE public."HomeOccupancy" SET access_start_at=now()+interval '1 day' WHERE home_id=h AND user_id=pg_temp.cr_id(10);
 r:=public.get_home_claim_review(h,pg_temp.cr_id(210),admin_id,true);
 PERFORM pg_temp.cr_expect(public.mutate_home_claim_review(h,pg_temp.cr_id(210),admin_id,'approve',r->'claim'->>'review_token',NULL,true),'CLAIM_ACCESS_NOT_STARTED');
 INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status) VALUES(h,pg_temp.cr_id(16),'revoked');
 r:=public.get_home_claim_review(h,pg_temp.cr_id(216),admin_id,true);
 PERFORM pg_temp.cr_expect(public.mutate_home_claim_review(h,pg_temp.cr_id(216),admin_id,'approve',r->'claim'->>'review_token',NULL,true),'OWNERSHIP_REVIEW_REQUIRED');
 -- Explicit current identity failure dominates any old successful IDV.
 UPDATE public."HomeOwnershipClaim" SET identity_status='failed' WHERE id=pg_temp.cr_id(217);
 INSERT INTO public."HomeVerificationEvidence"(claim_id,evidence_type,provider,status) VALUES(pg_temp.cr_id(217),'idv','stripe_identity','verified');
 r:=public.get_home_claim_review(h,pg_temp.cr_id(217),admin_id,true);
 PERFORM pg_temp.cr_expect(public.mutate_home_claim_review(h,pg_temp.cr_id(217),admin_id,'approve',r->'claim'->>'review_token',NULL,true),'IDENTITY_CONFIRMATION_REQUIRED');
 -- Current actor deny/proof/window/minor and current User.role cannot bypass.
 r:=public.get_home_claim_review(h,pg_temp.cr_id(218),actor);tok:=r->'claim'->>'review_token';
 INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(h,actor,'ownership.manage',false);
 PERFORM pg_temp.cr_expect(public.mutate_home_claim_review(h,pg_temp.cr_id(218),actor,'reject',tok),'CLAIM_REVIEW_DENIED');
 DELETE FROM public."HomePermissionOverride" WHERE home_id=h AND user_id=actor AND permission='ownership.manage';
 INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(h,actor,'finance.manage',false);
 PERFORM pg_temp.cr_expect(public.mutate_home_claim_review(h,pg_temp.cr_id(218),actor,'approve',tok),'PERMISSION_DELEGATION_FORBIDDEN');
 DELETE FROM public."HomePermissionOverride" WHERE home_id=h AND user_id=actor AND permission='finance.manage';
 UPDATE public."HomeOwner" SET owner_status='revoked' WHERE home_id=h AND subject_id=actor;
 PERFORM pg_temp.cr_expect(public.mutate_home_claim_review(h,pg_temp.cr_id(218),actor,'reject',tok),'CLAIM_REVIEW_DENIED');
 UPDATE public."HomeOwner" SET owner_status='verified' WHERE home_id=h AND subject_id=actor;
 UPDATE public."HomeOccupancy" SET age_band='teen' WHERE home_id=h AND user_id=actor;
 PERFORM pg_temp.cr_expect(public.mutate_home_claim_review(h,pg_temp.cr_id(218),actor,'reject',tok),'CLAIM_REVIEW_DENIED');
 UPDATE public."HomeOccupancy" SET age_band='adult' WHERE home_id=h AND user_id=actor;
 UPDATE public."User" SET role='user' WHERE id=admin_id;
 PERFORM pg_temp.cr_expect(public.mutate_home_claim_review(h,pg_temp.cr_id(218),admin_id,'approve',tok,NULL,true),'CLAIM_REVIEW_DENIED');
 UPDATE public."User" SET role=NULL WHERE id=admin_id;
 PERFORM pg_temp.cr_expect(public.get_home_claim_review(h,pg_temp.cr_id(218),admin_id,true),'CLAIM_REVIEW_DENIED');
 PERFORM pg_temp.cr_expect(public.mutate_home_claim_review(h,pg_temp.cr_id(218),admin_id,'approve',tok,NULL,true),'CLAIM_REVIEW_DENIED');
 UPDATE public."User" SET role='unknown' WHERE id=admin_id;
 PERFORM pg_temp.cr_expect(public.mutate_home_claim_review(h,pg_temp.cr_id(218),admin_id,'approve',tok,NULL,true),'CLAIM_REVIEW_DENIED');
 UPDATE public."User" SET role='admin' WHERE id=admin_id;
 -- A platform admin with an existing malformed/restricted Home context cannot
 -- use global role to bypass that explicit local authority ceiling.
 INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,verification_status,is_active)
  VALUES(h,admin_id,NULL,NULL,'verified',true);
 PERFORM pg_temp.cr_expect(public.mutate_home_claim_review(h,pg_temp.cr_id(218),admin_id,'approve',tok,NULL,true),'CLAIM_REVIEW_DENIED');
 UPDATE public."HomeOccupancy" SET role='member',role_base='member',age_band='teen' WHERE home_id=h AND user_id=admin_id;
 PERFORM pg_temp.cr_expect(public.mutate_home_claim_review(h,pg_temp.cr_id(218),admin_id,'approve',tok,NULL,true),'CLAIM_REVIEW_DENIED');
 UPDATE public."HomeOccupancy" SET age_band='adult' WHERE home_id=h AND user_id=admin_id;
 INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(h,admin_id,'ownership.manage',false);
 PERFORM pg_temp.cr_expect(public.mutate_home_claim_review(h,pg_temp.cr_id(218),admin_id,'approve',tok,NULL,true),'CLAIM_REVIEW_DENIED');
 DELETE FROM public."HomePermissionOverride" WHERE home_id=h AND user_id=admin_id;
 DELETE FROM public."HomeOccupancy" WHERE home_id=h AND user_id=admin_id;
 -- Rejecting another claim never hides established owners or clears security.
 r:=public.mutate_home_claim_review(h,pg_temp.cr_id(218),actor,'reject',tok);PERFORM pg_temp.cr_expect(r);
 IF (SELECT ownership_state FROM public."Home" WHERE id=h)<>'owner_verified'
  OR (SELECT household_resolution_state FROM public."Home" WHERE id=h)<>'verified_household' THEN RAISE EXCEPTION 'Rejection demoted household'; END IF;
 SELECT count(*) INTO n FROM public."HomeAuditLog" WHERE home_id=h;
 r:=public.mutate_home_claim_review(h,pg_temp.cr_id(218),actor,'reject',tok);PERFORM pg_temp.cr_expect(r);
 IF r->>'replayed'<>'true' OR (SELECT count(*) FROM public."HomeAuditLog" WHERE home_id=h)<>n THEN RAISE EXCEPTION 'Reject replay changed audit'; END IF;
 PERFORM pg_temp.cr_expect(public.mutate_home_claim_review(h,pg_temp.cr_id(218),admin_id,'reject',tok,NULL,true),'CLAIM_NOT_ELIGIBLE');
 -- Active decisions may accept new evidence, but the displayed review token
 -- cannot silently review that new source or repeat an obsolete decision.
 r:=public.get_home_claim_review(h,pg_temp.cr_id(223),actor);tok:=r->'claim'->>'review_token';
 r:=public.mutate_home_claim_review(h,pg_temp.cr_id(223),actor,'flag',tok);PERFORM pg_temp.cr_expect(r);
 r:=public.mutate_home_claim_review(h,pg_temp.cr_id(223),actor,'flag',tok);PERFORM pg_temp.cr_expect(r);
 IF r->>'replayed'<>'true' THEN RAISE EXCEPTION 'Flag lost-response replay failed'; END IF;
 PERFORM pg_temp.cr_expect(public.record_home_claim_provider_evidence(h,pg_temp.cr_id(223),pg_temp.cr_id(23),'attom',true,92));
 PERFORM pg_temp.cr_expect(public.mutate_home_claim_review(h,pg_temp.cr_id(223),actor,'flag',tok),'CLAIM_REVIEW_CHANGED');
 r:=public.get_home_claim_review(h,pg_temp.cr_id(223),actor);tok:=r->'claim'->>'review_token';
 r:=public.mutate_home_claim_review(h,pg_temp.cr_id(223),actor,'request_more_info',tok);PERFORM pg_temp.cr_expect(r);
 r:=public.mutate_home_claim_review(h,pg_temp.cr_id(223),actor,'request_more_info',tok);PERFORM pg_temp.cr_expect(r);
 IF r->>'replayed'<>'true' THEN RAISE EXCEPTION 'More-info lost-response replay failed'; END IF;
 -- Unsupported challenge review is an unchanged 409.
 UPDATE public."HomeOwnershipClaim" SET claim_phase_v2='challenged',challenge_state='challenged',routing_classification='challenge_claim' WHERE id=pg_temp.cr_id(219);
 r:=public.get_home_claim_review(h,pg_temp.cr_id(219),admin_id,true);
 PERFORM pg_temp.cr_expect(public.mutate_home_claim_review(h,pg_temp.cr_id(219),admin_id,'reject',r->'claim'->>'review_token',NULL,true),'CLAIM_CHALLENGE_REVIEW_REQUIRED');
 -- Claimant withdrawal is terminal, exact, idempotent and never deletes evidence/proof.
 PERFORM pg_temp.cr_expect(public.mutate_home_claim_review(h,pg_temp.cr_id(220),pg_temp.cr_id(21),'withdraw'),'CLAIM_RECIPIENT_MISMATCH');
 r:=public.mutate_home_claim_review(h,pg_temp.cr_id(220),pg_temp.cr_id(20),'withdraw');PERFORM pg_temp.cr_expect(r);
 IF r->>'deleted'<>'false' OR r->>'withdrawn'<>'true' OR NOT EXISTS(SELECT FROM public."HomeVerificationEvidence" WHERE claim_id=pg_temp.cr_id(220)) THEN RAISE EXCEPTION 'Withdrawal destroyed evidence'; END IF;
 SELECT count(*) INTO n FROM public."HomeAuditLog" WHERE home_id=h;
 r:=public.mutate_home_claim_review(h,pg_temp.cr_id(220),pg_temp.cr_id(20),'withdraw');PERFORM pg_temp.cr_expect(r);
 IF r->>'replayed'<>'true' OR (SELECT count(*) FROM public."HomeAuditLog" WHERE home_id=h)<>n THEN RAISE EXCEPTION 'Withdrawal retry duplicated audit'; END IF;
 PERFORM pg_temp.cr_expect(public.record_home_claim_provider_evidence(h,pg_temp.cr_id(220),pg_temp.cr_id(20),'attom',true,99),'CLAIM_NOT_ELIGIBLE');
 PERFORM pg_temp.cr_expect(public.mutate_home_claim_review(h,pg_temp.cr_id(220),pg_temp.cr_id(20),'authorize_evidence'),'CLAIM_NOT_ELIGIBLE');
 PERFORM pg_temp.cr_expect(public.mutate_home_claim_review(h,pg_temp.cr_id(221),pg_temp.cr_id(21),'authorize_evidence'),'CLAIM_EVIDENCE_PRIVATE_REUPLOAD_REQUIRED');
 -- A valid first-owner platform review may set an empty primary; never self-review.
 r:=public.get_home_claim_review(pg_temp.cr_id(102),pg_temp.cr_id(226),admin_id,true);
 r:=public.mutate_home_claim_review(pg_temp.cr_id(102),pg_temp.cr_id(226),admin_id,'approve',r->'claim'->>'review_token',NULL,true);PERFORM pg_temp.cr_expect(r);
 IF (SELECT owner_id FROM public."Home" WHERE id=pg_temp.cr_id(102))<>pg_temp.cr_id(26) THEN RAISE EXCEPTION 'First owner missing primary'; END IF;
END $$;
RESET ROLE;
-- Private first use survives an exact own withdrawal; no generic household access.
DO $$ DECLARE h uuid:=pg_temp.cr_id(101); u uuid:=pg_temp.cr_id(25); r jsonb; BEGIN
 IF public.home_secret_context(h,u)->>'private'<>'true' THEN RAISE EXCEPTION 'Fixture not private'; END IF;
 r:=public.mutate_home_claim_review(h,pg_temp.cr_id(225),u,'withdraw');PERFORM pg_temp.cr_expect(r);
 IF public.home_secret_context(h,u)->>'private'<>'true' OR public.home_effective_access(h,u)->>'has_access'='true'
  OR public.home_delete_eligibility(h,u)->>'allowed'<>'true' THEN RAISE EXCEPTION 'Withdrawal changed own private setup'; END IF;
 -- An own withdrawal receipt cannot hide another review or foreign receipt.
 INSERT INTO public."HomeClaimReviewReceipt"(id,home_id,claim_id,actor_user_id,action,platform_admin,
   private_setup,review_token,result_snapshot,result)
  VALUES(pg_temp.cr_id(425),h,pg_temp.cr_id(225),u,'flag',false,true,repeat('a',64),repeat('b',64),'{}');
 IF public.home_secret_context(h,u)->>'allowed'='true'
  OR public.home_delete_eligibility(h,u)->>'code' IS DISTINCT FROM 'HOME_DELETE_ESTABLISHED_HOUSEHOLD' THEN
  RAISE EXCEPTION 'Review history hidden by legitimate private withdrawal'; END IF;
 UPDATE public."HomeClaimReviewReceipt" SET action='withdraw',actor_user_id=pg_temp.cr_id(1) WHERE id=pg_temp.cr_id(425);
 IF public.home_secret_context(h,u)->>'allowed'='true'
  OR public.home_delete_eligibility(h,u)->>'code' IS DISTINCT FROM 'HOME_DELETE_ESTABLISHED_HOUSEHOLD' THEN
  RAISE EXCEPTION 'Foreign receipt hidden by legitimate private withdrawal'; END IF;
 DELETE FROM public."HomeClaimReviewReceipt" WHERE id=pg_temp.cr_id(425);
 IF public.home_secret_context(h,u)->>'private'<>'true' OR public.home_delete_eligibility(h,u)->>'allowed'<>'true' THEN
  RAISE EXCEPTION 'Exact own private withdrawal eligibility was not restored'; END IF;
 -- Publicly forgeable audit text is not private-setup provenance.
 DELETE FROM public."HomeClaimReviewReceipt" WHERE claim_id=pg_temp.cr_id(225);
 INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
  VALUES(h,u,'OWNERSHIP_CLAIM_WITHDRAWN','HomeOwnershipClaim',pg_temp.cr_id(225),'{"private_setup":true}');
 IF public.home_secret_context(h,u)->>'allowed'='true' OR public.home_delete_eligibility(h,u)->>'allowed'='true' THEN
  RAISE EXCEPTION 'Forged audit conferred private setup access or deletion'; END IF;
END $$;
-- A late audit failure rolls every authority/claim mutation back.
CREATE FUNCTION pg_temp.cr_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.home_id=pg_temp.cr_id(100) AND NEW.target_id=pg_temp.cr_id(222) THEN RAISE EXCEPTION 'synthetic review audit failure'; END IF; RETURN NEW; END $$;
CREATE TRIGGER cr_failure BEFORE INSERT ON public."HomeAuditLog" FOR EACH ROW EXECUTE FUNCTION pg_temp.cr_fail_audit();
DO $$ DECLARE r jsonb; tok text; BEGIN
 r:=public.get_home_claim_review(pg_temp.cr_id(100),pg_temp.cr_id(222),pg_temp.cr_id(2),true);tok:=r->'claim'->>'review_token';
 BEGIN PERFORM public.mutate_home_claim_review(pg_temp.cr_id(100),pg_temp.cr_id(222),pg_temp.cr_id(2),'approve',tok,NULL,true);
  RAISE EXCEPTION 'Expected injected audit failure';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'synthetic review audit failure' THEN RAISE; END IF; END;
 IF (SELECT state FROM public."HomeOwnershipClaim" WHERE id=pg_temp.cr_id(222))<>'submitted'
  OR EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=pg_temp.cr_id(100) AND subject_id=pg_temp.cr_id(22))
  OR EXISTS(SELECT FROM public."HomeOccupancy" WHERE home_id=pg_temp.cr_id(100) AND user_id=pg_temp.cr_id(22))
  OR EXISTS(SELECT FROM public."HomeClaimReviewReceipt" WHERE claim_id=pg_temp.cr_id(222)) THEN
  RAISE EXCEPTION 'Audit failure left partial approval'; END IF;
 IF (SELECT rows FROM cr_roles) IS DISTINCT FROM (SELECT jsonb_agg(to_jsonb(role_row) ORDER BY role_base,permission) FROM public."HomeRolePermission" role_row) THEN RAISE EXCEPTION 'Role defaults changed'; END IF;
END $$;
ROLLBACK;
SELECT 'PASS: atomic claim review, exact evidence snapshots, retained withdrawal, authority/age/current source checks';
