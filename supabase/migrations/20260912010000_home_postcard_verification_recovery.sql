-- Backwards compatible: yes. Exact-card verification and current postal review.
-- Legacy confirmation remains available until client compatibility acceptance.
-- No historical membership, dates, proof or migration ledger are rewritten.
SET LOCAL lock_timeout='5s';

CREATE TABLE public."HomePostcardVerificationCommand" (
  actor_user_id uuid NOT NULL,
  request_id uuid NOT NULL,
  home_id uuid NOT NULL,
  postcard_id uuid NOT NULL,
  intent_hash text CHECK(intent_hash ~ '^[a-f0-9]{64}$'),
  state text NOT NULL CHECK(state IN ('pending','completed','rejected','cancelled')),
  verification_status text CHECK(verification_status IN ('verified','provisional')),
  recorded_at timestamptz,
  challenge_window_ends_at timestamptz,
  error_code text CHECK(error_code ~ '^[A-Z][A-Z0-9_]{1,79}$'),
  error_status integer CHECK(error_status IN (400,403,404,409,410,422,429)),
  attempts_remaining integer CHECK(attempts_remaining BETWEEN 0 AND 5),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(actor_user_id,request_id),
  CHECK(intent_hash IS NOT NULL OR state='cancelled'),
  CHECK((state='completed')=(verification_status IS NOT NULL AND recorded_at IS NOT NULL)),
  CHECK((verification_status IS NULL)=(recorded_at IS NULL)),
  CHECK(challenge_window_ends_at IS NULL OR verification_status='provisional'),
  CHECK((state='rejected')=(error_code IS NOT NULL AND error_status IS NOT NULL)),
  CHECK((error_code IS NULL)=(error_status IS NULL)),
  CHECK(attempts_remaining IS NULL OR error_code='POSTCARD_WRONG_CODE')
);
-- No foreign keys: these private command identities can explain an unknown
-- result after the referenced Home/card is deleted. They confer no access.
ALTER TABLE public."HomePostcardVerificationCommand" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."HomePostcardVerificationCommand" FROM PUBLIC,anon,authenticated;
GRANT ALL ON public."HomePostcardVerificationCommand" TO service_role;

CREATE FUNCTION public.home_postcard_verification_projection(c public."HomePostcardVerificationCommand")
RETURNS jsonb LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('ok',true,'state',c.state,'home_id',c.home_id,'postcard_id',c.postcard_id,
   'command',jsonb_build_object('actor_id',c.actor_user_id,'request_id',c.request_id,
     'created_at',c.created_at,'updated_at',c.updated_at),
   'verification_status',c.verification_status,'recorded_at',c.recorded_at,
   'challenge_window_ends_at',c.challenge_window_ends_at,'code',c.error_code,'status',c.error_status,
   'attempts_remaining',c.attempts_remaining);
$$;

CREATE FUNCTION public.get_home_postcard_verification(p_home_id uuid,p_actor_id uuid,p_postcard_id uuid,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE c public."HomePostcardVerificationCommand"%ROWTYPE;
BEGIN
 IF p_home_id IS NULL OR p_actor_id IS NULL OR p_postcard_id IS NULL OR p_request_id IS NULL THEN
   RETURN jsonb_build_object('ok',false,'code','POSTCARD_VERIFICATION_INVALID','status',400); END IF;
 SELECT * INTO c FROM public."HomePostcardVerificationCommand" WHERE actor_user_id=p_actor_id AND request_id=p_request_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','POSTCARD_VERIFICATION_NOT_FOUND','status',404); END IF;
 IF c.home_id<>p_home_id OR c.postcard_id<>p_postcard_id THEN
   RETURN jsonb_build_object('ok',false,'code','POSTCARD_VERIFICATION_CONFLICT','status',409); END IF;
 RETURN public.home_postcard_verification_projection(c);
END;
$$;

CREATE FUNCTION public.cancel_home_postcard_verification(p_home_id uuid,p_actor_id uuid,p_postcard_id uuid,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE c public."HomePostcardVerificationCommand"%ROWTYPE;
BEGIN
 IF p_home_id IS NULL OR p_actor_id IS NULL OR p_postcard_id IS NULL OR p_request_id IS NULL THEN
   RETURN jsonb_build_object('ok',false,'code','POSTCARD_VERIFICATION_INVALID','status',400); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('home-postcard:user:'||p_actor_id::text,0));
 PERFORM id FROM public."User" WHERE id=p_actor_id FOR SHARE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','POSTCARD_ACCOUNT_UNAVAILABLE','status',403); END IF;
 SELECT * INTO c FROM public."HomePostcardVerificationCommand" WHERE actor_user_id=p_actor_id AND request_id=p_request_id FOR UPDATE;
 IF FOUND THEN
   IF c.home_id<>p_home_id OR c.postcard_id<>p_postcard_id THEN
     RETURN jsonb_build_object('ok',false,'code','POSTCARD_VERIFICATION_CONFLICT','status',409); END IF;
   RETURN public.home_postcard_verification_projection(c);
 END IF;
 INSERT INTO public."HomePostcardVerificationCommand"(actor_user_id,request_id,home_id,postcard_id,state)
   VALUES(p_actor_id,p_request_id,p_home_id,p_postcard_id,'cancelled') RETURNING * INTO c;
 RETURN public.home_postcard_verification_projection(c);
END;
$$;

-- Internal ordinary postal grant ceiling. Existing explicit denies survive.
-- A positive override beyond the proposed ordinary role requires household
-- review instead of becoming active as a side effect of self-verification.
CREATE FUNCTION public.home_postcard_verified_policy(p_home_id uuid,p_actor_id uuid,p_age public.home_age_band)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o public."HomeOccupancy"%ROWTYPE; r public."HomeResidencyClaim"%ROWTYPE;
 role public.home_role_base; permissions text[]; ceiling text[];
BEGIN
 SELECT * INTO o FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_actor_id;
 SELECT * INTO r FROM public."HomeResidencyClaim" WHERE home_id=p_home_id AND user_id=p_actor_id;
 role:=(CASE WHEN p_age='child' OR o.role IN ('caregiver','restricted_member')
   OR r.claimed_role IN ('caregiver','restricted_member') THEN 'restricted_member' ELSE 'member' END)::public.home_role_base;
 permissions:=public.home_member_policy_permissions(p_home_id,p_actor_id,role,p_age);
 SELECT coalesce(array_agg(permission::text),'{}'::text[]) INTO ceiling FROM public."HomeRolePermission"
   WHERE role_base=role AND allowed AND public.home_authority_age_allows(p_age,permission);
 IF EXISTS(SELECT FROM unnest(permissions) permission WHERE NOT permission=ANY(ceiling)) THEN
   RETURN jsonb_build_object('ok',false,'code','POSTCARD_ACCESS_REVIEW_REQUIRED','status',409); END IF;
 RETURN jsonb_build_object('ok',true,'role_base',role,'permissions',to_jsonb(permissions));
END;
$$;

CREATE FUNCTION public.verify_home_postcard_current(
 p_home_id uuid,p_actor_id uuid,p_postcard_id uuid,p_request_id uuid,p_submitted_hash text,p_validity_days integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE c public."HomePostcardVerificationCommand"%ROWTYPE; p public."HomePostcardCode"%ROWTYPE;
 h public."Home"%ROWTYPE; o public."HomeOccupancy"%ROWTYPE; r public."HomeResidencyClaim"%ROWTYPE;
 context jsonb; policy jsonb; intent text; t timestamptz; age public.home_age_band;
 code text; status integer; remaining integer; v_status text; v_recorded timestamptz;
 v_challenge timestamptz; v_existing boolean:=false;
BEGIN
 IF p_home_id IS NULL OR p_actor_id IS NULL OR p_postcard_id IS NULL OR p_request_id IS NULL
   OR p_submitted_hash IS NULL OR p_submitted_hash !~ '^[a-f0-9]{64}$'
   OR p_validity_days IS NULL OR p_validity_days NOT BETWEEN 1 AND 3650 THEN
   RETURN jsonb_build_object('ok',false,'code','POSTCARD_VERIFICATION_INVALID','status',400); END IF;
 intent:=encode(sha256(convert_to(jsonb_build_object('home_id',p_home_id,'postcard_id',p_postcard_id,
   'submitted_hash',p_submitted_hash)::text,'UTF8')),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended('home-postcard:user:'||p_actor_id::text,0));
 PERFORM id FROM public."User" WHERE id=p_actor_id FOR SHARE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','POSTCARD_ACCOUNT_UNAVAILABLE','status',403); END IF;
 SELECT * INTO c FROM public."HomePostcardVerificationCommand" WHERE actor_user_id=p_actor_id AND request_id=p_request_id FOR UPDATE;
 IF FOUND THEN
   IF c.home_id<>p_home_id OR c.postcard_id<>p_postcard_id OR (c.intent_hash IS NOT NULL AND c.intent_hash<>intent) THEN
     RETURN jsonb_build_object('ok',false,'code','POSTCARD_VERIFICATION_CONFLICT','status',409); END IF;
   -- Historical result only. No replay renews dates, spends another guess,
   -- restores membership, resets a challenge window or rechecks private Home data.
   RETURN public.home_postcard_verification_projection(c)||jsonb_build_object('replayed',true);
 END IF;
 INSERT INTO public."HomePostcardVerificationCommand"(actor_user_id,request_id,home_id,postcard_id,intent_hash,state)
   VALUES(p_actor_id,p_request_id,p_home_id,p_postcard_id,intent,'pending') RETURNING * INTO c;
 <<validate_code>>
 BEGIN
   IF NOT public.lock_home_postcard_current_scope(p_home_id,p_actor_id) THEN
     code:='HOME_NOT_FOUND';status:=404;EXIT validate_code; END IF;
   t:=clock_timestamp();
   SELECT * INTO p FROM public."HomePostcardCode" WHERE id=p_postcard_id AND home_id=p_home_id AND user_id=p_actor_id;
   IF NOT FOUND THEN code:='POSTCARD_NO_LONGER_AVAILABLE';status:=404;EXIT validate_code; END IF;
   context:=public.home_postcard_current_context(p_home_id,p_actor_id,true);
   IF context->>'ok' IS DISTINCT FROM 'true' THEN code:=context->>'code';status:=(context->>'status')::integer;EXIT validate_code; END IF;
   SELECT * INTO h FROM public."Home" WHERE id=p_home_id;
   IF p.destination IS DISTINCT FROM jsonb_build_object('address',h.address,'address2',h.address2,'city',h.city,'state',h.state,'zipcode',h.zipcode)
     OR coalesce(h.country,'US')<>'US' THEN
     code:='POSTCARD_ADDRESS_CHANGED';status:=409;EXIT validate_code; END IF;
   SELECT * INTO o FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_actor_id;
   SELECT * INTO r FROM public."HomeResidencyClaim" WHERE home_id=p_home_id AND user_id=p_actor_id;
   age:=(context->>'age_band')::public.home_age_band;
   IF p.status='verified' THEN
     IF p.code_hash IS DISTINCT FROM p_submitted_hash OR o.verification_status NOT IN ('verified','provisional') OR p.verified_at IS NULL THEN
       code:='POSTCARD_NO_LONGER_AVAILABLE';status:=409;EXIT validate_code; END IF;
     v_existing:=true;v_status:=o.verification_status;v_recorded:=p.verified_at;
     v_challenge:=CASE WHEN v_status='provisional' THEN o.challenge_window_ends_at END;
     EXIT validate_code;
   END IF;
   IF p.attempts>=5 THEN code:='POSTCARD_LOCKED';status:=429;EXIT validate_code; END IF;
   IF p.status='expired' OR p.expires_at<=t THEN code:='POSTCARD_EXPIRED';status:=410;EXIT validate_code; END IF;
   IF p.status<>'pending' OR p.dispatch_status='rejected' THEN code:='POSTCARD_NO_LONGER_AVAILABLE';status:=409;EXIT validate_code; END IF;
   IF p.dispatch_status='pending' AND EXISTS(SELECT FROM public."HomePostcardRequestCommand"
     WHERE home_id=p_home_id AND actor_user_id=p_actor_id AND postcard_id=p.id AND code_key_id IS NOT NULL) THEN
     code:='POSTCARD_NOT_DISPATCHED';status:=409;EXIT validate_code; END IF;
   IF p.code_hash IS DISTINCT FROM p_submitted_hash THEN
     remaining:=4-p.attempts;
     UPDATE public."HomePostcardCode" SET attempts=attempts+1,
       status=CASE WHEN attempts+1>=5 THEN 'expired' ELSE public."HomePostcardCode".status END,updated_at=t WHERE id=p.id;
     code:='POSTCARD_WRONG_CODE';status:=400;EXIT validate_code;
   END IF;
   IF o.verification_status IN ('verified','provisional') THEN
     -- Independent membership/review already exists. Consume only the code;
     -- preserve its age, role, dates, challenge and every permission projection.
     v_status:=o.verification_status;
     v_challenge:=CASE WHEN v_status='provisional' THEN o.challenge_window_ends_at END;
   ELSE
     -- A partial/old challenge cannot be silently restarted by another card.
     IF o.challenge_window_started_at IS NOT NULL OR o.challenge_window_ends_at IS NOT NULL THEN
       code:='POSTCARD_ACCESS_REVIEW_REQUIRED';status:=409;EXIT validate_code; END IF;
     IF context->>'has_authorities'='true' THEN
       v_status:='provisional';v_challenge:=t+interval '7 days';
       UPDATE public."HomeOccupancy" SET role_base='restricted_member',age_band=age,
         verification_status='provisional',can_manage_home=false,can_manage_access=false,can_manage_finance=false,
         can_manage_tasks=false,can_view_sensitive=false,challenge_window_started_at=t,challenge_window_ends_at=v_challenge,
         updated_at=t WHERE id=o.id;
     ELSE
       policy:=public.home_postcard_verified_policy(p_home_id,p_actor_id,age);
       IF policy->>'ok' IS DISTINCT FROM 'true' THEN code:=policy->>'code';status:=(policy->>'status')::integer;EXIT validate_code; END IF;
       v_status:='verified';
       UPDATE public."HomeOccupancy" SET role=policy->>'role_base',role_base=(policy->>'role_base')::public.home_role_base,
         age_band=age,verification_status='verified',verified_at=t,verification_expires_at=t+make_interval(days=>p_validity_days),
         can_manage_home=policy->'permissions' ? 'home.edit',
         can_manage_access=policy->'permissions' ?| ARRAY['access.manage','members.manage'],
         can_manage_finance=policy->'permissions' ? 'finance.manage',
         can_manage_tasks=policy->'permissions' ?| ARRAY['tasks.edit','tasks.manage'],
         can_view_sensitive=policy->'permissions' ? 'sensitive.view',updated_at=t WHERE id=o.id;
       UPDATE public."Home" SET vacancy_at=NULL,updated_at=t WHERE id=p_home_id AND vacancy_at IS NOT NULL;
     END IF;
   END IF;
   v_recorded:=t;
   UPDATE public."HomePostcardCode" SET status='verified',verified_at=t,attempts=attempts+1,updated_at=t WHERE id=p.id;
   -- Address proof during a challenge is not a household decision. Keep the
   -- pending claim reviewable by a current authority until review/promotion.
   IF r.id IS NOT NULL AND r.status='pending' AND v_status='verified' THEN
     UPDATE public."HomeResidencyClaim" SET status='verified',review_note='Verified via postcard code',reviewed_at=t,updated_at=t WHERE id=r.id;
   END IF;
 END validate_code;
 IF code IS NOT NULL THEN
   UPDATE public."HomePostcardVerificationCommand" SET state='rejected',error_code=code,error_status=status,
     attempts_remaining=remaining,updated_at=clock_timestamp() WHERE actor_user_id=p_actor_id AND request_id=p_request_id RETURNING * INTO c;
   RETURN public.home_postcard_verification_projection(c)||jsonb_build_object('replayed',false);
 END IF;
 IF NOT v_existing THEN
   INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
     VALUES(p_home_id,p_actor_id,'POSTCARD_CODE_VERIFIED','HomePostcardCode',p.id,
       jsonb_build_object('request_id',p_request_id,'verification_status',v_status,'challenge_window_ends_at',v_challenge));
 END IF;
 UPDATE public."HomePostcardVerificationCommand" SET state='completed',verification_status=v_status,
   recorded_at=v_recorded,challenge_window_ends_at=v_challenge,updated_at=clock_timestamp()
   WHERE actor_user_id=p_actor_id AND request_id=p_request_id RETURNING * INTO c;
 RETURN public.home_postcard_verification_projection(c)||jsonb_build_object('replayed',false);
END;
$$;

REVOKE ALL ON FUNCTION public.home_postcard_verification_projection(public."HomePostcardVerificationCommand"),
 public.get_home_postcard_verification(uuid,uuid,uuid,uuid),public.cancel_home_postcard_verification(uuid,uuid,uuid,uuid),
 public.home_postcard_verified_policy(uuid,uuid,public.home_age_band),
 public.verify_home_postcard_current(uuid,uuid,uuid,uuid,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.home_postcard_verification_projection(public."HomePostcardVerificationCommand"),
 public.get_home_postcard_verification(uuid,uuid,uuid,uuid),public.cancel_home_postcard_verification(uuid,uuid,uuid,uuid),
 public.home_postcard_verified_policy(uuid,uuid,public.home_age_band),
 public.verify_home_postcard_current(uuid,uuid,uuid,uuid,text,integer) TO service_role;

-- The worker's earlier candidate read grants no authority. Recheck the exact
-- occupancy, current policy, original review window and its verified mail proof
-- under the same Home locks before promotion. Retries never renew verification.
CREATE FUNCTION public.promote_home_postcard_review(p_home_id uuid,p_actor_id uuid,p_occupancy_id uuid,p_validity_days integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE o public."HomeOccupancy"%ROWTYPE; h public."Home"%ROWTYPE; p public."HomePostcardCode"%ROWTYPE;
 context jsonb; policy jsonb; age public.home_age_band; t timestamptz;
BEGIN
 IF p_home_id IS NULL OR p_actor_id IS NULL OR p_occupancy_id IS NULL OR p_validity_days IS NULL OR p_validity_days NOT BETWEEN 1 AND 3650 THEN
   RETURN jsonb_build_object('ok',false,'code','POSTCARD_VERIFICATION_INVALID','status',400); END IF;
 IF NOT public.lock_home_postcard_current_scope(p_home_id,p_actor_id) THEN
   RETURN jsonb_build_object('ok',false,'code','HOME_NOT_FOUND','status',404); END IF;
 t:=clock_timestamp();
 SELECT * INTO o FROM public."HomeOccupancy" WHERE id=p_occupancy_id AND home_id=p_home_id AND user_id=p_actor_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','POSTCARD_ACCESS_REVIEW_REQUIRED','status',409); END IF;
 IF o.verification_status<>'provisional' THEN RETURN jsonb_build_object('ok',true,'promoted',false); END IF;
 context:=public.home_postcard_current_context(p_home_id,p_actor_id,true);
 IF context->>'ok' IS DISTINCT FROM 'true' THEN RETURN context; END IF;
 IF o.verified_at IS NOT NULL OR o.verification_expires_at IS NOT NULL
   OR o.challenge_window_started_at IS NULL OR o.challenge_window_ends_at IS NULL
   OR o.challenge_window_ends_at<o.challenge_window_started_at+interval '7 days' THEN
   RETURN jsonb_build_object('ok',false,'code','POSTCARD_ACCESS_REVIEW_REQUIRED','status',409); END IF;
 IF o.challenge_window_ends_at>t THEN RETURN jsonb_build_object('ok',true,'promoted',false); END IF;
 SELECT * INTO h FROM public."Home" WHERE id=p_home_id;
 SELECT * INTO p FROM public."HomePostcardCode" WHERE home_id=p_home_id AND user_id=p_actor_id AND status='verified'
   AND verified_at>=o.challenge_window_started_at AND verified_at<=o.challenge_window_ends_at
   ORDER BY verified_at DESC,id DESC LIMIT 1;
 IF NOT FOUND OR p.destination IS DISTINCT FROM jsonb_build_object('address',h.address,'address2',h.address2,
   'city',h.city,'state',h.state,'zipcode',h.zipcode) OR coalesce(h.country,'US')<>'US' THEN
   RETURN jsonb_build_object('ok',false,'code','POSTCARD_ACCESS_REVIEW_REQUIRED','status',409); END IF;
 age:=(context->>'age_band')::public.home_age_band;
 policy:=public.home_postcard_verified_policy(p_home_id,p_actor_id,age);
 IF policy->>'ok' IS DISTINCT FROM 'true' THEN RETURN policy; END IF;
 UPDATE public."HomeOccupancy" SET role=policy->>'role_base',role_base=(policy->>'role_base')::public.home_role_base,
   age_band=age,verification_status='verified',verified_at=t,verification_expires_at=t+make_interval(days=>p_validity_days),
   can_manage_home=policy->'permissions' ? 'home.edit',can_manage_access=policy->'permissions' ?| ARRAY['access.manage','members.manage'],
   can_manage_finance=policy->'permissions' ? 'finance.manage',can_manage_tasks=policy->'permissions' ?| ARRAY['tasks.edit','tasks.manage'],
   can_view_sensitive=policy->'permissions' ? 'sensitive.view',updated_at=t WHERE id=o.id;
 UPDATE public."HomeResidencyClaim" SET status='verified',review_note='Postcard review window completed',reviewed_at=t,updated_at=t
   WHERE home_id=p_home_id AND user_id=p_actor_id AND status='pending';
 UPDATE public."Home" SET vacancy_at=NULL,updated_at=t WHERE id=p_home_id AND vacancy_at IS NOT NULL;
 INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
   VALUES(p_home_id,p_actor_id,'CHALLENGE_WINDOW_EXPIRED_PROMOTED','HomeOccupancy',o.id,
     jsonb_build_object('postcard_id',p.id,'verification_status','verified','role_base',policy->>'role_base'));
 RETURN jsonb_build_object('ok',true,'promoted',true,'home_id',p_home_id,'user_id',p_actor_id,'occupancy_id',p_occupancy_id);
END;
$$;
REVOKE ALL ON FUNCTION public.promote_home_postcard_review(uuid,uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.promote_home_postcard_review(uuid,uuid,uuid,integer) TO service_role;

-- The existing household challenge endpoint must share the promotion lock.
-- A delayed challenge cannot suspend membership already admitted after its
-- review window, and a delayed worker cannot undo a completed challenge.
CREATE FUNCTION public.challenge_home_postcard_review(p_home_id uuid,p_actor_id uuid,p_occupancy_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE o public."HomeOccupancy"%ROWTYPE; t timestamptz;
BEGIN
 IF p_home_id IS NULL OR p_actor_id IS NULL OR p_occupancy_id IS NULL THEN
   RETURN jsonb_build_object('ok',false,'code','POSTCARD_REVIEW_INVALID','status',400); END IF;
 IF NOT public.lock_home_residency_review_scope(p_home_id) THEN
   RETURN jsonb_build_object('ok',false,'code','HOME_NOT_FOUND','status',404); END IF;
 t:=clock_timestamp();
 IF NOT public.home_residency_review_authority(p_home_id,p_actor_id) THEN
   RETURN jsonb_build_object('ok',false,'code','POSTCARD_REVIEW_AUTHORITY_REQUIRED','status',403); END IF;
 SELECT * INTO o FROM public."HomeOccupancy" WHERE id=p_occupancy_id AND home_id=p_home_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','POSTCARD_REVIEW_NOT_FOUND','status',404); END IF;
 IF o.user_id=p_actor_id THEN RETURN jsonb_build_object('ok',false,'code','POSTCARD_REVIEW_SELF_FORBIDDEN','status',403); END IF;
 IF o.verification_status='suspended_challenged' AND NOT o.is_active AND EXISTS(
   SELECT FROM public."HomeAuditLog" WHERE home_id=p_home_id AND actor_user_id=p_actor_id
     AND action='MEMBER_CHALLENGED' AND target_id=o.id AND metadata->>'suspended_at'=to_jsonb(o.updated_at)#>>'{}') THEN
   RETURN jsonb_build_object('ok',true,'challenged',false,'home_id',p_home_id,'occupancy_id',p_occupancy_id,'target_id',o.user_id); END IF;
 IF o.verification_status<>'provisional' OR o.is_active IS DISTINCT FROM true
   OR o.start_at>t OR o.end_at IS NOT NULL OR o.access_start_at>t OR o.access_end_at<=t
   OR o.challenge_window_started_at IS NULL OR o.challenge_window_started_at>t
   OR o.challenge_window_ends_at IS NULL OR o.challenge_window_ends_at<=t THEN
   RETURN jsonb_build_object('ok',false,'code','POSTCARD_REVIEW_CHANGED','status',409); END IF;
 UPDATE public."HomeOccupancy" SET is_active=false,verification_status='suspended_challenged',updated_at=t WHERE id=o.id RETURNING * INTO o;
 INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
   VALUES(p_home_id,p_actor_id,'MEMBER_CHALLENGED','HomeOccupancy',o.id,
     jsonb_build_object('challenged_user_id',o.user_id,'role_base',o.role_base,'suspended_at',o.updated_at));
 RETURN jsonb_build_object('ok',true,'challenged',true,'home_id',p_home_id,'occupancy_id',p_occupancy_id,'target_id',o.user_id,
   'notify_user_ids',(SELECT coalesce(jsonb_agg(candidate ORDER BY candidate),'[]'::jsonb) FROM (
     SELECT user_id AS candidate FROM public."HomeOccupancy" WHERE home_id=p_home_id
     UNION SELECT subject_id FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user'
     UNION SELECT owner_id FROM public."Home" WHERE id=p_home_id
   ) candidates WHERE candidate IS NOT NULL AND candidate<>p_actor_id AND candidate<>o.user_id
     AND public.home_residency_review_authority(p_home_id,candidate)));
END;
$$;
REVOKE ALL ON FUNCTION public.challenge_home_postcard_review(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.challenge_home_postcard_review(uuid,uuid,uuid) TO service_role;

-- Preserve the existing prepared-review protocol and delegation ceilings.
-- CREATE OR REPLACE retains this established function’s service-only grants.
CREATE OR REPLACE FUNCTION public.review_home_residency(
  p_home_id uuid, p_actor_id uuid, p_action text, p_payload jsonb DEFAULT '{}',
  p_validity_days integer DEFAULT 365)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
SET lock_timeout = '5s' AS $$
DECLARE
  v_home public."Home"%ROWTYPE; v_claim public."HomeResidencyClaim"%ROWTYPE;
  v_target public."HomeOccupancy"%ROWTYPE; v_user public."User"%ROWTYPE;
  v_actor jsonb; v_access jsonb; v_actor_role public.home_role_base;
  v_role public.home_role_base; v_old_role public.home_role_base;
  v_actor_permissions text[]; v_permissions text[];
  v_target_id uuid; v_claim_id uuid; v_has_target boolean;
  v_now timestamptz; v_replay boolean := false; v_existing_verified boolean := false;
BEGIN
  IF p_home_id IS NULL OR p_actor_id IS NULL OR p_action IS NULL
    OR p_action NOT IN ('attach','approve','reject')
    OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
    OR p_validity_days IS NULL OR p_validity_days NOT BETWEEN 1 AND 3650
    OR EXISTS (SELECT FROM jsonb_object_keys(p_payload) k
      WHERE k NOT IN ('target_id','claim_id','role','reason'))
    OR (p_action='attach' AND (NOT p_payload ? 'target_id'
      OR p_payload ?| ARRAY['claim_id','role','reason']))
    OR (p_action<>'attach' AND (NOT p_payload ? 'claim_id' OR p_payload ? 'target_id'))
    OR (p_action='approve' AND p_payload ? 'reason')
    OR (p_action='reject' AND p_payload ? 'role') THEN
    RETURN jsonb_build_object('ok',false,'code','INVALID_ADMISSION_REQUEST','status',400);
  END IF;
  SELECT * INTO v_home FROM public."Home" WHERE id=p_home_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','HOME_NOT_FOUND','status',404); END IF;
  -- Match member-authority lock order. Admission cannot race a removal, a role
  -- change, an explicit deny, a preset change or an ownership transition.
  LOCK TABLE public."HomeRolePermission", public."HomeRolePreset" IN SHARE MODE;
  PERFORM id FROM public."HomeOccupancy" WHERE home_id=p_home_id ORDER BY id FOR UPDATE;
  PERFORM id FROM public."HomeOwner" WHERE home_id=p_home_id ORDER BY id FOR UPDATE;
  PERFORM user_id FROM public."HomePermissionOverride" WHERE home_id=p_home_id ORDER BY user_id,permission FOR UPDATE;
  IF p_action='attach' THEN
    v_target_id := (p_payload->>'target_id')::uuid;
  ELSE
    v_claim_id := (p_payload->>'claim_id')::uuid;
    SELECT * INTO v_claim FROM public."HomeResidencyClaim"
      WHERE id=v_claim_id AND home_id=p_home_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','CLAIM_NOT_FOUND','status',404); END IF;
    v_target_id := v_claim.user_id;
  END IF;
  -- Recalculate after every potentially blocking lock, rather than admitting
  -- an actor whose access expired while this transaction waited.
  v_now := clock_timestamp();
  v_actor := public.home_effective_access(p_home_id,p_actor_id);
  IF v_home.security_state IN ('frozen','frozen_silent') OR v_home.home_status IN ('merged','archived')
    OR NOT (v_actor->'permissions') ? 'members.manage'
    OR EXISTS (SELECT FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_actor_id
      AND (start_at>v_now OR end_at<=v_now OR access_start_at>v_now OR access_end_at<=v_now))
    OR (v_actor->>'is_owner'='true'
      AND EXISTS (SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user'
        AND subject_id=p_actor_id AND owner_status IN ('revoked','disputed'))
      AND NOT EXISTS (SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user'
        AND subject_id=p_actor_id AND owner_status='verified')) THEN
    RETURN jsonb_build_object('ok',false,'code','MEMBERS_MANAGE_REQUIRED','status',403);
  END IF;
  IF v_target_id IS NULL OR v_target_id=p_actor_id THEN
    RETURN jsonb_build_object('ok',false,'code','SELF_ADMISSION_FORBIDDEN','status',403);
  END IF;
  SELECT * INTO v_user FROM public."User" WHERE id=v_target_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','USER_NOT_FOUND','status',404); END IF;
  IF p_action='reject' THEN
    IF v_claim.status='rejected' AND v_claim.reviewed_by=p_actor_id THEN
      RETURN jsonb_build_object('ok',true,'code','CLAIM_REJECTED','replayed',true,'target_id',v_target_id);
    END IF;
    IF v_claim.status IS DISTINCT FROM 'pending' THEN
      RETURN jsonb_build_object('ok',false,'code','CLAIM_NOT_PENDING','status',409);
    END IF;
    IF length(p_payload->>'reason')>2000 THEN
      RETURN jsonb_build_object('ok',false,'code','INVALID_ADMISSION_REQUEST','status',400);
    END IF;
    UPDATE public."HomeResidencyClaim" SET status='rejected',reviewed_by=p_actor_id,
      reviewed_at=v_now,review_note=nullif(p_payload->>'reason',''),updated_at=v_now WHERE id=v_claim_id;
    INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
      VALUES(p_home_id,p_actor_id,'residency_claim_rejected','HomeResidencyClaim',v_claim_id,
        jsonb_build_object('user_id',v_target_id));
    RETURN jsonb_build_object('ok',true,'code','CLAIM_REJECTED','replayed',false,'target_id',v_target_id);
  END IF;
  SELECT * INTO v_target FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=v_target_id;
  v_has_target := FOUND;
  v_old_role := v_target.role_base;
  IF v_old_role IS NULL THEN
    v_old_role := CASE v_target.role
      WHEN 'owner' THEN 'owner' WHEN 'admin' THEN 'admin' WHEN 'manager' THEN 'manager'
      WHEN 'property_manager' THEN 'manager' WHEN 'tenant' THEN 'lease_resident'
      WHEN 'renter' THEN 'lease_resident' WHEN 'lease_resident' THEN 'lease_resident'
      WHEN 'member' THEN 'member' WHEN 'family' THEN 'member' WHEN 'roommate' THEN 'member'
      WHEN 'restricted_member' THEN 'restricted_member' WHEN 'caregiver' THEN 'restricted_member'
      WHEN 'guest' THEN 'guest' WHEN 'service_provider' THEN 'service_provider' ELSE NULL END::public.home_role_base;
  END IF;
  IF v_home.owner_id=v_target_id OR v_old_role='owner'
    OR EXISTS (SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user'
      AND subject_id=v_target_id) THEN
    RETURN jsonb_build_object('ok',false,'code','OWNERSHIP_FLOW_REQUIRED','status',409);
  END IF;
  IF v_has_target AND (v_target.is_active IS DISTINCT FROM true OR v_old_role IS NULL
    OR v_target.end_at<=v_now OR v_target.access_end_at<=v_now
    OR (v_target.start_at IS NOT NULL AND v_target.end_at<=v_target.start_at)
    OR (v_target.access_start_at IS NOT NULL AND v_target.access_end_at<=v_target.access_start_at)
    OR greatest(v_target.start_at,v_target.access_start_at)>=least(v_target.end_at,v_target.access_end_at)
    OR v_target.verification_status IS NULL
    OR v_target.verification_status NOT IN ('verified','unverified','pending','pending_approval',
      'pending_doc','pending_postcard','provisional_bootstrap','provisional')
    OR (v_target.verification_status<>'verified' AND v_target.verified_at IS NOT NULL)) THEN
    RETURN jsonb_build_object('ok',false,'code','MEMBERSHIP_RENEWAL_REQUIRED','status',409);
  END IF;
  -- A recorded postal code leaves the claim pending during household review.
  -- Admit only that coherent provisional window, never a stale/partial grant.
  IF v_has_target AND v_target.verification_status='provisional' AND (
    v_target.verification_expires_at IS NOT NULL
    OR v_target.challenge_window_started_at IS NULL OR v_target.challenge_window_started_at>v_now
    OR v_target.challenge_window_ends_at IS NULL
    OR v_target.challenge_window_ends_at<v_target.challenge_window_started_at+interval '7 days'
    OR coalesce(v_home.country,'US')<>'US'
    OR NOT EXISTS(SELECT FROM public."HomePostcardCode" p WHERE p.home_id=p_home_id AND p.user_id=v_target_id
      AND p.status='verified' AND p.verified_at>=v_target.challenge_window_started_at AND p.verified_at<=v_target.challenge_window_ends_at
      AND p.destination=jsonb_build_object('address',v_home.address,'address2',v_home.address2,
        'city',v_home.city,'state',v_home.state,'zipcode',v_home.zipcode))) THEN
    RETURN jsonb_build_object('ok',false,'code','MEMBERSHIP_RENEWAL_REQUIRED','status',409);
  END IF;
  v_existing_verified := v_has_target AND v_target.verification_status='verified';
  IF p_action='approve' AND v_claim.status IS DISTINCT FROM 'pending' THEN
    -- Exact retry returns current membership only. It cannot reapply an old
    -- role, renew dates or reactivate someone removed after the first approval.
    IF v_claim.status='verified' AND v_claim.reviewed_by=p_actor_id AND v_existing_verified THEN
      v_replay := true;
    ELSE
      RETURN jsonb_build_object('ok',false,'code','CLAIM_NOT_PENDING','status',409);
    END IF;
  END IF;
  IF v_existing_verified THEN
    -- Existing verified members keep their role, age, dates, denies, metadata
    -- and legacy projections. Use the separate authority endpoint to edit them.
    v_role := v_old_role;
    v_replay := v_replay OR p_action='attach';
  ELSE
    IF p_action='attach' THEN
      v_role := coalesce(v_old_role,'member');
    ELSE
      v_role := CASE coalesce(p_payload->>'role',v_claim.claimed_role,'member')
        WHEN 'tenant' THEN 'lease_resident' WHEN 'renter' THEN 'lease_resident'
        WHEN 'lease_resident' THEN 'lease_resident' WHEN 'member' THEN 'member'
        WHEN 'family' THEN 'member' WHEN 'roommate' THEN 'member'
        WHEN 'caregiver' THEN 'restricted_member' WHEN 'restricted_member' THEN 'restricted_member'
        WHEN 'guest' THEN 'guest' WHEN 'service_provider' THEN 'service_provider' ELSE NULL END::public.home_role_base;
    END IF;
    IF v_role IS NULL OR v_role IN ('owner','admin','manager') THEN
      RETURN jsonb_build_object('ok',false,'code','RESIDENCY_ROLE_FORBIDDEN','status',403);
    END IF;
    v_actor_role := (v_actor->>'effective_role_base')::public.home_role_base;
    IF (v_actor_role<>'owner' AND (public.home_role_rank(v_role)>=public.home_role_rank(v_actor_role)
      OR (v_has_target AND public.home_role_rank(v_old_role)>=public.home_role_rank(v_actor_role))))
      OR (v_target.age_band='child' AND public.home_role_rank(v_role)>20)
      OR (v_target.age_band='teen' AND public.home_role_rank(v_role)>30) THEN
      RETURN jsonb_build_object('ok',false,'code','PROPOSED_ROLE_FORBIDDEN','status',403);
    END IF;
    SELECT ARRAY(SELECT jsonb_array_elements_text(v_actor->'permissions')) INTO v_actor_permissions;
    -- Activation makes all existing grants effective, so compare the complete
    -- future permission set, not only a role-change delta. Denies are retained.
    v_permissions := public.home_member_policy_permissions(p_home_id,v_target_id,v_role,v_target.age_band);
    IF EXISTS (SELECT FROM unnest(v_permissions) permission WHERE NOT permission=ANY(v_actor_permissions)) THEN
      RETURN jsonb_build_object('ok',false,'code','PERMISSION_DELEGATION_FORBIDDEN','status',403);
    END IF;
    IF v_has_target THEN
      UPDATE public."HomeOccupancy" SET role=v_role::text,role_base=v_role,
        verification_status='verified',verified_at=v_now,
        verification_expires_at=v_now+make_interval(days=>p_validity_days),updated_at=v_now
        WHERE id=v_target.id RETURNING * INTO v_target;
    ELSE
      INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,is_active,
        start_at,added_by_user_id,verification_status,verified_at,verification_expires_at,
        can_manage_home,can_manage_access,can_manage_finance,can_manage_tasks,can_view_sensitive)
      VALUES(p_home_id,v_target_id,v_role::text,v_role,NULL,true,now(),p_actor_id,'verified',v_now,
        v_now+make_interval(days=>p_validity_days),false,false,false,false,false)
      RETURNING * INTO v_target;
    END IF;
    -- The permission resolver uses transaction time for reads. Project flags
    -- with the decision clock so a schedule reached during a lock wait does
    -- not leave stale flags; future access still projects no capability.
    v_access := jsonb_build_object('permissions',CASE
      WHEN (v_target.start_at IS NULL OR v_target.start_at<=v_now)
        AND (v_target.access_start_at IS NULL OR v_target.access_start_at<=v_now)
      THEN to_jsonb(v_permissions) ELSE '[]'::jsonb END);
    UPDATE public."HomeOccupancy" SET
      can_manage_home=(v_access->'permissions') ? 'home.edit',
      can_manage_access=(v_access->'permissions') ?| ARRAY['access.manage','members.manage'],
      can_manage_finance=(v_access->'permissions') ? 'finance.manage',
      can_manage_tasks=(v_access->'permissions') ?| ARRAY['tasks.edit','tasks.manage'],
      can_view_sensitive=(v_access->'permissions') ? 'sensitive.view'
      WHERE id=v_target.id RETURNING * INTO v_target;
    UPDATE public."Home" SET vacancy_at=NULL,updated_at=v_now WHERE id=p_home_id AND vacancy_at IS NOT NULL;
  END IF;
  IF p_action='approve' AND NOT v_replay THEN
    UPDATE public."HomeResidencyClaim" SET status='verified',reviewed_by=p_actor_id,
      reviewed_at=v_now,updated_at=v_now WHERE id=v_claim_id;
  END IF;
  IF NOT v_replay THEN
    INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
      VALUES(p_home_id,p_actor_id,CASE WHEN p_action='approve' THEN 'residency_claim_approved' ELSE 'member_attached' END,
        'HomeOccupancy',v_target.id,jsonb_build_object('user_id',v_target_id,'claim_id',v_claim_id,
          'role_base',v_role,'existing_verified',v_existing_verified));
  END IF;
  RETURN jsonb_build_object('ok',true,'code','MEMBERSHIP_CONFIRMED','replayed',v_replay,
    'occupancy',to_jsonb(v_target),'target_id',v_target_id,
    'user',jsonb_build_object('id',v_target_id,'username',v_user.username,'name',v_user.name),
    'home_label',coalesce(v_home.name,v_home.address,'your home'));
END;
$$;
