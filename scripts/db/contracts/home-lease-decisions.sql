-- Exercise the real lease/membership transaction, including failures that the
-- old in-memory occupancy mock could not represent. Fixtures always roll back.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
INSERT INTO auth.users(id,email) SELECT ('f3190000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  'lease-contract-'||n||'@example.invalid' FROM generate_series(1,6) n;
INSERT INTO public."User"(id,email,username,name) SELECT id,email,'lease_contract_'||right(id::text,2),'Lease contract'
  FROM auth.users WHERE id::text LIKE 'f3190000-0000-4000-8000-%';
INSERT INTO public."Home"(id,address,city,state,zipcode) VALUES
  ('f3190000-0000-4000-8000-000000000010','Lease contract','Test','CA','00000'),
  ('f3190000-0000-4000-8000-000000000011','Other lease contract','Test','CA','00000');
INSERT INTO public."HomeAuthority"(id,home_id,subject_type,subject_id,role,status,added_via) VALUES
  ('f3190000-0000-4000-8000-000000000020','f3190000-0000-4000-8000-000000000010','user','f3190000-0000-4000-8000-000000000001','owner','verified','landlord_portal'),
  ('f3190000-0000-4000-8000-000000000021','f3190000-0000-4000-8000-000000000011','user','f3190000-0000-4000-8000-000000000001','owner','verified','landlord_portal'),
  ('f3190000-0000-4000-8000-000000000022','f3190000-0000-4000-8000-000000000010','business','f3190000-0000-4000-8000-000000000004','manager','verified','landlord_portal'),
  ('f3190000-0000-4000-8000-000000000023','f3190000-0000-4000-8000-000000000010','trust','f3190000-0000-4000-8000-000000000004','manager','verified','landlord_portal');
CREATE FUNCTION pg_temp.check_lease(p_ok boolean,p_label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF p_ok IS DISTINCT FROM true THEN RAISE EXCEPTION '%',p_label; END IF; END $$;
CREATE FUNCTION pg_temp.pending_lease() RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
 INSERT INTO public."HomeLease"(home_id,primary_resident_user_id,start_at,end_at,state,source,metadata)
 VALUES('f3190000-0000-4000-8000-000000000010','f3190000-0000-4000-8000-000000000002',
   now()-interval '1 day',now()+interval '1 year','pending','tenant_request','{"preserved":"yes"}') RETURNING id INTO v_id;
 RETURN v_id;
END $$;
DO $$ BEGIN
 PERFORM pg_temp.check_lease(NOT has_function_privilege('authenticated',
  'public.decide_home_lease(text,uuid,uuid,uuid,text,text,jsonb,text,integer)','execute')
  AND NOT has_function_privilege('anon','public.decide_home_lease(text,uuid,uuid,uuid,text,text,jsonb,text,integer)','execute')
  AND has_function_privilege('service_role','public.decide_home_lease(text,uuid,uuid,uuid,text,text,jsonb,text,integer)','execute'),
  'Only the service may decide a lease');
END $$;
SET LOCAL ROLE service_role;
DO $$
DECLARE
 a uuid:='f3190000-0000-4000-8000-000000000001'; t uuid:='f3190000-0000-4000-8000-000000000002';
 intruder uuid:='f3190000-0000-4000-8000-000000000003'; business uuid:='f3190000-0000-4000-8000-000000000004';
 h uuid:='f3190000-0000-4000-8000-000000000010'; au uuid:='f3190000-0000-4000-8000-000000000020';
 l uuid; r jsonb; replay jsonb; before_occ jsonb; saved_start timestamptz; dates jsonb; i integer;
BEGIN
 -- Fresh landlord approval is the proof; no circular AddressClaim prerequisite.
 l:=pg_temp.pending_lease();
 SELECT start_at INTO saved_start FROM public."HomeLease" WHERE id=l;
 r:=public.decide_home_lease('approve',a,l,au);
 PERFORM pg_temp.check_lease(r->>'success'='true' AND r->'lease'->>'state'='active'
   AND r->'occupancy'->>'role_base'='lease_resident' AND r->'occupancy'->>'verification_status'='verified'
   AND (r->'lease'->>'start_at')::timestamptz=saved_start
   AND r->'lease'->'metadata'->>'preserved'='yes','Approval must commit lease and verified occupancy without a claim');
 PERFORM pg_temp.check_lease(EXISTS(SELECT FROM public."HomeLeaseResident" WHERE lease_id=l AND user_id=t)
   AND public.home_effective_access(h,t)->>'has_access'='true','Approval must persist resident and usable access');
 before_occ:=r->'occupancy';
 replay:=public.decide_home_lease('approve',a,l,au);
 PERFORM pg_temp.check_lease(replay->>'replayed'='true' AND replay->'occupancy'=before_occ
   AND (SELECT count(*)=1 FROM public."HomeAuditLog" WHERE target_id=l AND action='LEASE_APPROVED'),
   'Lost-reply retry must return the same result without another audit/write');
 PERFORM pg_temp.check_lease(public.decide_home_lease('deny',a,l,au)->>'success'='false',
   'Denial must not overwrite a committed approval');
 PERFORM pg_temp.check_lease(public.decide_home_lease('approve',a,l,au,p_dates:='{"end_at":null}')->>'success'='false',
   'Different retry intent must not silently change completed dates');
 UPDATE public."HomeOccupancy" SET is_active=false WHERE home_id=h AND user_id=t;
 PERFORM pg_temp.check_lease(public.decide_home_lease('approve',a,l,au)->>'success'='false'
   AND NOT (SELECT is_active FROM public."HomeOccupancy" WHERE home_id=h AND user_id=t),
   'Old completed approval must not resurrect removed access');

 -- A fresh lease replaces expired access bounds, retaining the same row and age.
 UPDATE public."HomeOccupancy" SET is_active=true,access_end_at=now()-interval '1 day',age_band='teen'
   WHERE home_id=h AND user_id=t;
 l:=pg_temp.pending_lease(); dates:=jsonb_build_object('start_at',now()+interval '7 days','end_at',NULL);
 r:=public.decide_home_lease('approve',a,l,au,p_dates:=dates);
 PERFORM pg_temp.check_lease(r->>'success'='true' AND r->'occupancy'->>'id'=before_occ->>'id'
   AND r->'occupancy'->>'role_base'='member' AND r->'occupancy'->>'age_band'='teen'
   AND r->'occupancy'->>'can_manage_home'='false' AND r->'occupancy'->>'can_view_sensitive'='false'
   AND r->'occupancy'->>'access_end_at' IS NULL AND r->'lease'->>'end_at' IS NULL
   AND r->'occupancy'->>'access_start_at'=r->'lease'->>'start_at'
   AND public.home_effective_access(h,t)->>'has_access'='false','Future renewal must replace expired bounds without granting early access');
 PERFORM pg_temp.check_lease(public.decide_home_lease('approve',a,l,au,p_dates:=dates)->>'replayed'='true',
   'Future-start completed approval must be replayable');
 DELETE FROM public."HomeOccupancy" WHERE home_id=h AND user_id=t;

 -- Authorization, date errors and denial must leave membership untouched.
 l:=pg_temp.pending_lease();
 PERFORM pg_temp.check_lease(public.decide_home_lease('approve',intruder,l,au)->>'success'='false','Actor binding');
 PERFORM pg_temp.check_lease(public.decide_home_lease('approve',a,l,'f3190000-0000-4000-8000-000000000021')->>'success'='false','Other home authority');
 UPDATE public."HomeAuthority" SET status='revoked' WHERE id=au;
 PERFORM pg_temp.check_lease(public.decide_home_lease('approve',a,l,au)->>'success'='false','Revoked authority');
 UPDATE public."HomeAuthority" SET status='pending' WHERE id=au;
 PERFORM pg_temp.check_lease(public.decide_home_lease('deny',a,l,au)->>'success'='false','Pending authority');
 UPDATE public."HomeAuthority" SET status='verified' WHERE id=au;
 FOR dates IN SELECT value FROM jsonb_array_elements('[{"start_at":null},{"start_at":"bad"},
   {"start_at":"infinity"},{"start_at":"2027-01-01","end_at":"2027-01-01"},
   {"start_at":"2027-02-01","end_at":"2027-01-01"},{"end_at":"bad"}]') LOOP
   PERFORM pg_temp.check_lease(public.decide_home_lease('approve',a,l,au,p_dates:=dates)->>'success'='false','Invalid dates must fail');
 END LOOP;
 PERFORM pg_temp.check_lease((SELECT state='pending' FROM public."HomeLease" WHERE id=l)
   AND NOT EXISTS(SELECT FROM public."HomeOccupancy" WHERE home_id=h AND user_id=t),'Rejected decisions must make no partial writes');
 UPDATE public."Home" SET security_state='frozen' WHERE id=h;
 PERFORM pg_temp.check_lease(public.decide_home_lease('approve',a,l,au)->>'success'='false','Frozen home must deny admission');
 UPDATE public."Home" SET security_state='normal' WHERE id=h;
 r:=public.decide_home_lease('deny',a,l,au,p_reason:='Contract denial');
 PERFORM pg_temp.check_lease(r->>'success'='true' AND r->'lease'->>'state'='canceled'
   AND r->'lease'->'metadata'->>'denial_reason'='Contract denial'
   AND public.decide_home_lease('deny',a,l,au,p_reason:='Contract denial')->>'replayed'='true'
   AND public.decide_home_lease('approve',a,l,au)->>'success'='false','Denial reason, retry and competing approval');

 -- Existing current membership is independent: never downgrade or shorten it.
 INSERT INTO public."HomeOccupancy"(home_id,user_id,is_active,role,role_base,verification_status,start_at,can_manage_home)
 VALUES(h,t,true,'admin','admin','verified',now()-interval '1 day',true) RETURNING to_jsonb("HomeOccupancy".*) INTO before_occ;
 l:=pg_temp.pending_lease();
 r:=public.decide_home_lease('approve',a,l,au,p_dates:=jsonb_build_object('start_at',now()+interval '7 days'));
 PERFORM pg_temp.check_lease(r->>'success'='true' AND r->'occupancy'=before_occ
   AND public.home_effective_access(h,t)->>'has_access'='true','Preserve independent current role, flags and access window');
 DELETE FROM public."HomeOccupancy" WHERE home_id=h AND user_id=t;

 -- Both pre-existing business authority paths remain valid; inactive proofs fail.
 INSERT INTO public."BusinessTeam"(business_user_id,user_id,is_active) VALUES(business,a,true);
 l:=pg_temp.pending_lease();
 PERFORM pg_temp.check_lease(public.decide_home_lease('approve',a,l,'f3190000-0000-4000-8000-000000000022')->>'success'='true','Business team authority');
 UPDATE public."BusinessTeam" SET is_active=false WHERE business_user_id=business AND user_id=a;
 l:=pg_temp.pending_lease();
 PERFORM pg_temp.check_lease(public.decide_home_lease('approve',a,l,'f3190000-0000-4000-8000-000000000022')->>'success'='false','Inactive team cannot approve');
 INSERT INTO public."BusinessSeat"(id,business_user_id,display_name,is_active)
 VALUES('f3190000-0000-4000-8000-000000000050',business,'Contract seat',true);
 INSERT INTO public."SeatBinding"(seat_id,user_id,binding_method)
 VALUES('f3190000-0000-4000-8000-000000000050',a,'invite_accept');
 PERFORM pg_temp.check_lease(public.decide_home_lease('approve',a,l,'f3190000-0000-4000-8000-000000000022')->>'success'='true','Business seat authority');
 DELETE FROM public."HomeOccupancy" WHERE home_id=h AND user_id=t;

 -- Actual invite -> acceptance -> membership, identity and issuer checks.
 INSERT INTO public."HomeLeaseInvite"(id,home_id,landlord_subject_type,landlord_subject_id,invitee_email,token_hash,expires_at,proposed_start)
 VALUES('f3190000-0000-4000-8000-000000000040',h,'user',a,'lease-contract-2@example.invalid',repeat('a',64),now()+interval '1 day',now()-interval '1 hour');
 PERFORM pg_temp.check_lease(public.decide_home_lease('accept',intruder,p_token_hash:=repeat('a',64),p_user_email:='wrong@example.invalid')->>'success'='false','Invite email binding');
 UPDATE public."HomeAuthority" SET status='revoked' WHERE id=au;
 PERFORM pg_temp.check_lease(public.decide_home_lease('accept',t,p_token_hash:=repeat('a',64),p_user_email:='lease-contract-2@example.invalid')->>'success'='false'
   AND (SELECT status='pending' FROM public."HomeLeaseInvite" WHERE token_hash=repeat('a',64)),'Revoked issuer cannot consume invitation');
 UPDATE public."HomeAuthority" SET status='verified' WHERE id=au;
 r:=public.decide_home_lease('accept',t,p_token_hash:=repeat('a',64),p_user_email:=' LEASE-CONTRACT-2@EXAMPLE.INVALID ');
 replay:=public.decide_home_lease('accept',t,p_token_hash:=repeat('a',64),p_user_email:='lease-contract-2@example.invalid');
 PERFORM pg_temp.check_lease(r->>'success'='true' AND replay->>'replayed'='true' AND r->'lease'=replay->'lease'
   AND (SELECT count(*)=1 FROM public."HomeLease" WHERE metadata->>'invite_id'='f3190000-0000-4000-8000-000000000040')
   AND (SELECT status='accepted' AND invitee_user_id=t FROM public."HomeLeaseInvite" WHERE token_hash=repeat('a',64)),
   'Invite acceptance and retry must create exactly one lease');
 UPDATE public."HomeLeaseInvite" SET status='revoked' WHERE token_hash=repeat('a',64);
 PERFORM pg_temp.check_lease(public.decide_home_lease('accept',t,p_token_hash:=repeat('a',64),p_user_email:='lease-contract-2@example.invalid')->>'success'='false',
   'Revoked completed invitation must not replay success');
 UPDATE public."HomeLeaseInvite" SET status='accepted' WHERE token_hash=repeat('a',64);
 UPDATE public."HomeOccupancy" SET is_active=false WHERE home_id=h AND user_id=t;
 PERFORM pg_temp.check_lease(public.decide_home_lease('accept',t,p_token_hash:=repeat('a',64),p_user_email:='lease-contract-2@example.invalid')->>'success'='false','Old invite must not reactivate removed membership');

 -- Fresh invitations from existing business/trust issuers are still accepted.
 FOR i IN 1..2 LOOP
   INSERT INTO public."HomeLeaseInvite"(home_id,landlord_subject_type,landlord_subject_id,invitee_user_id,token_hash,expires_at)
   VALUES(h,CASE WHEN i=1 THEN 'business' ELSE 'trust' END::public.subject_type,business,t,repeat(i::text,64),now()+interval '1 day');
   PERFORM pg_temp.check_lease(public.decide_home_lease('accept',t,p_token_hash:=repeat(i::text,64))->>'success'='true','Verified business/trust invite issuer');
 END LOOP;
 INSERT INTO public."HomeLeaseInvite"(home_id,landlord_subject_type,landlord_subject_id,token_hash,expires_at)
 VALUES(h,'user',a,repeat('e',64),now()-interval '1 second');
 PERFORM pg_temp.check_lease(public.decide_home_lease('accept',t,p_token_hash:=repeat('e',64))->>'error'='Invite has expired','Expired invite');
 RAISE NOTICE 'Lease decision lifecycle, dates, authority, membership and replay assertions passed';
END $$;
RESET ROLE;

-- Fail the final audit write. Every preceding lease/resident/occupancy/invite
-- mutation must roll back, and the same request must work after recovery.
CREATE FUNCTION pg_temp.fail_lease_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF NEW.action IN ('LEASE_APPROVED','LEASE_INVITE_ACCEPTED') THEN RAISE EXCEPTION 'contract audit failure'; END IF; RETURN NEW; END $$;
CREATE TRIGGER contract_lease_audit_failure BEFORE INSERT ON public."HomeAuditLog"
 FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_lease_audit();
SET LOCAL ROLE service_role;
DO $$ DECLARE l uuid; before_occ jsonb; after_occ jsonb; r jsonb;
BEGIN
 l:=pg_temp.pending_lease();
 UPDATE public."HomeOccupancy" SET is_active=false WHERE home_id='f3190000-0000-4000-8000-000000000010';
 SELECT to_jsonb(o) INTO before_occ FROM public."HomeOccupancy" o WHERE home_id='f3190000-0000-4000-8000-000000000010';
 BEGIN
   PERFORM public.decide_home_lease('approve','f3190000-0000-4000-8000-000000000001',l,'f3190000-0000-4000-8000-000000000020');
   RAISE EXCEPTION 'Expected audit fault was not reached';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM<>'contract audit failure' THEN RAISE; END IF;
 END;
 SELECT to_jsonb(o) INTO after_occ FROM public."HomeOccupancy" o WHERE home_id='f3190000-0000-4000-8000-000000000010';
 PERFORM pg_temp.check_lease(before_occ=after_occ AND (SELECT state='pending' FROM public."HomeLease" WHERE id=l)
   AND NOT EXISTS(SELECT FROM public."HomeLeaseResident" WHERE lease_id=l),'Final-write failure must roll back all mutations');
 INSERT INTO public."HomeLeaseInvite"(home_id,landlord_subject_type,landlord_subject_id,token_hash,expires_at)
 VALUES('f3190000-0000-4000-8000-000000000010','user','f3190000-0000-4000-8000-000000000001',repeat('f',64),now()+interval '1 day');
 BEGIN
   PERFORM public.decide_home_lease('accept','f3190000-0000-4000-8000-000000000002',p_token_hash:=repeat('f',64));
   RAISE EXCEPTION 'Expected invite audit fault was not reached';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM<>'contract audit failure' THEN RAISE; END IF;
 END;
 PERFORM pg_temp.check_lease((SELECT status='pending' AND invitee_user_id IS NULL FROM public."HomeLeaseInvite" WHERE token_hash=repeat('f',64))
   AND NOT EXISTS(SELECT FROM public."HomeLease" WHERE metadata->>'invite_id'=(SELECT id::text FROM public."HomeLeaseInvite" WHERE token_hash=repeat('f',64)))
   AND before_occ=(SELECT to_jsonb(o) FROM public."HomeOccupancy" o WHERE home_id='f3190000-0000-4000-8000-000000000010'),
   'Invite failure must roll back consumption, inserted lease and membership');

END $$;
RESET ROLE;
DROP TRIGGER contract_lease_audit_failure ON public."HomeAuditLog";
SET LOCAL ROLE service_role;
DO $$ DECLARE l uuid; r jsonb;
BEGIN
 SELECT id INTO l FROM public."HomeLease" WHERE home_id='f3190000-0000-4000-8000-000000000010' AND state='pending' ORDER BY created_at DESC LIMIT 1;
 r:=public.decide_home_lease('approve','f3190000-0000-4000-8000-000000000001',l,'f3190000-0000-4000-8000-000000000020');
 PERFORM pg_temp.check_lease(r->>'success'='true','Rolled-back approval must remain retryable');
 RAISE NOTICE 'Lease decision rollback and retry assertions passed';
END $$;
RESET ROLE;
ROLLBACK;
