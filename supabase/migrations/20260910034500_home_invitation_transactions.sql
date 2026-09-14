-- Backwards compatible: yes. Existing invite API shapes remain; stale policy,
-- ambiguous recipient and revoked membership require a new explicit review.
-- No role defaults or existing membership rows are changed by this migration.
SET LOCAL lock_timeout='5s';

ALTER TABLE public."HomeInvite"
  ADD COLUMN admission_policy jsonb,
  ADD COLUMN access_start_at timestamptz,
  ADD COLUMN access_end_at timestamptz,
  ADD COLUMN accepted_by_user_id uuid REFERENCES public."User"(id) ON DELETE SET NULL,
  ADD COLUMN accepted_at timestamptz,
  ADD COLUMN source_request_id uuid REFERENCES public."HomeHouseholdAccessRequest"(id) ON DELETE SET NULL;
REVOKE ALL ON public."HomeInvite",public."HomeHouseholdAccessRequest" FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.lock_home_invitation_scope(p_home_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
BEGIN
  PERFORM id FROM public."Home" WHERE id=p_home_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  LOCK TABLE public."HomeRolePermission",public."HomeRolePreset" IN SHARE MODE;
  PERFORM id FROM public."HomeOccupancy" WHERE home_id=p_home_id ORDER BY id FOR UPDATE;
  PERFORM id FROM public."HomeOwner" WHERE home_id=p_home_id ORDER BY id FOR UPDATE;
  PERFORM user_id FROM public."HomePermissionOverride" WHERE home_id=p_home_id ORDER BY user_id,permission FOR UPDATE;
  PERFORM id FROM public."HomeHouseholdAccessRequest" WHERE home_id=p_home_id ORDER BY id FOR UPDATE;
  PERFORM id FROM public."HomeInvite" WHERE home_id=p_home_id ORDER BY id FOR UPDATE;
  RETURN true;
END $$;

CREATE FUNCTION public.home_invite_role(p_role text) RETURNS public.home_role_base
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
  SELECT CASE p_role WHEN 'owner' THEN 'owner' WHEN 'admin' THEN 'admin'
    WHEN 'manager' THEN 'manager' WHEN 'property_manager' THEN 'manager'
    WHEN 'tenant' THEN 'lease_resident' WHEN 'renter' THEN 'lease_resident'
    WHEN 'lease_resident' THEN 'lease_resident' WHEN 'member' THEN 'member'
    WHEN 'family' THEN 'member' WHEN 'roommate' THEN 'member'
    WHEN 'restricted_member' THEN 'restricted_member' WHEN 'caregiver' THEN 'restricted_member'
    WHEN 'guest' THEN 'guest' WHEN 'service_provider' THEN 'service_provider' ELSE NULL END::public.home_role_base;
$$;

CREATE FUNCTION public.home_invite_authority(p_home_id uuid,p_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_access jsonb; v_now timestamptz:=clock_timestamp();
BEGIN
  v_access:=public.home_effective_access(p_home_id,p_user_id);
  IF p_user_id IS NULL OR NOT (v_access->'permissions') ? 'members.manage'
    OR EXISTS (SELECT FROM public."Home" WHERE id=p_home_id
      AND (security_state IN ('frozen','frozen_silent') OR home_status IN ('merged','archived')))
    OR EXISTS (SELECT FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_user_id
      AND (start_at>v_now OR end_at<=v_now OR access_start_at>v_now OR access_end_at<=v_now))
    OR (v_access->>'is_owner'='true' AND EXISTS (SELECT FROM public."HomeOwner" WHERE home_id=p_home_id
      AND subject_type='user' AND subject_id=p_user_id AND owner_status IN ('revoked','disputed'))
      AND NOT EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user'
        AND subject_id=p_user_id AND owner_status='verified')) THEN RETURN NULL; END IF;
  RETURN v_access;
END $$;

-- Snapshot the exact role/preset intent. Changes require reissuing an invite;
-- later default grants cannot silently enlarge an already-sent invitation.
CREATE FUNCTION public.home_invite_policy(p_role text,p_preset text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_role public.home_role_base; v_preset public."HomeRolePreset"%ROWTYPE; v_defaults jsonb;
BEGIN
  v_role:=public.home_invite_role(p_role);
  IF p_preset IS NOT NULL THEN
    IF p_preset LIKE 'claim_merge:%' OR p_preset LIKE 'access_request:%' THEN RETURN NULL; END IF;
    SELECT * INTO v_preset FROM public."HomeRolePreset" WHERE key=p_preset;
    IF FOUND THEN
      IF v_role IS NOT NULL AND v_role<>v_preset.role_base THEN RETURN NULL; END IF;
      v_role:=v_preset.role_base;
    ELSE
      v_role:=CASE p_preset WHEN 'spouse' THEN 'admin' WHEN 'tenant' THEN 'member'
        WHEN 'extended_family' THEN 'member' WHEN 'child' THEN 'restricted_member'
        WHEN 'airbnb_guest' THEN 'guest' WHEN 'cleaner_vendor' THEN 'guest' ELSE NULL END::public.home_role_base;
      IF public.home_invite_role(p_role) IS NOT NULL AND public.home_invite_role(p_role)<>v_role THEN RETURN NULL; END IF;
    END IF;
  END IF;
  IF v_role IS NULL OR v_role='owner' OR (p_preset='child' AND public.home_role_rank(v_role)>20) THEN RETURN NULL; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('permission',permission,'allowed',allowed) ORDER BY permission),'[]')
    INTO v_defaults FROM public."HomeRolePermission" WHERE role_base=v_role;
  RETURN jsonb_build_object('version',1,'role_base',v_role,'preset_key',p_preset,
    'age_ceiling',CASE WHEN p_preset='child' THEN 'child' ELSE NULL END,
    'grant_perms',coalesce(v_preset.grant_perms,'{}'::public.home_permission[]),
    'deny_perms',coalesce(v_preset.deny_perms,'{}'::public.home_permission[]),
    'role_defaults',v_defaults);
END $$;

-- Evaluate the entire permission set that verification would make effective.
-- This helper is read-only; its mutating callers lock before evaluating it.
CREATE FUNCTION public.home_invite_target_policy(p_home_id uuid,p_inviter_id uuid,p_target_id uuid,
  p_policy jsonb,p_start_at timestamptz,p_end_at timestamptz) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor jsonb; v_target public."HomeOccupancy"%ROWTYPE; v_has_target boolean;
  v_role public.home_role_base; v_old_role public.home_role_base; v_age public.home_age_band;
  v_permissions text[]; v_actor_permissions text[]; v_now timestamptz:=clock_timestamp();
  v_start timestamptz; v_end timestamptz;
BEGIN
  v_actor:=public.home_invite_authority(p_home_id,p_inviter_id);
  IF v_actor IS NULL THEN RETURN jsonb_build_object('ok',false,'code','MEMBERS_MANAGE_REQUIRED','status',403); END IF;
  IF p_target_id=p_inviter_id THEN RETURN jsonb_build_object('ok',false,'code','SELF_ADMISSION_FORBIDDEN','status',403); END IF;
  IF p_policy IS NULL THEN RETURN jsonb_build_object('ok',false,'code','INVITE_POLICY_INVALID','status',400); END IF;
  v_role:=(p_policy->>'role_base')::public.home_role_base;
  SELECT * INTO v_target FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_target_id;
  v_has_target:=FOUND;
  v_old_role:=coalesce(v_target.role_base,public.home_invite_role(v_target.role));
  IF EXISTS(SELECT FROM public."Home" WHERE id=p_home_id AND owner_id=p_target_id)
    OR v_old_role='owner' OR EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=p_home_id
      AND subject_type='user' AND subject_id=p_target_id) THEN
    RETURN jsonb_build_object('ok',false,'code','OWNERSHIP_FLOW_REQUIRED','status',409); END IF;
  v_age:=CASE WHEN v_target.age_band='child' OR p_policy->>'age_ceiling'='child'
    THEN 'child'::public.home_age_band ELSE v_target.age_band END;
  v_start:=greatest(v_target.start_at,v_target.access_start_at,p_start_at);
  v_end:=least(v_target.end_at,v_target.access_end_at,p_end_at);
  IF v_end<=v_now OR v_start>=v_end OR (v_has_target AND (
    v_target.is_active IS DISTINCT FROM true OR v_old_role IS NULL
    OR v_target.verification_status IS NULL OR v_target.verification_status NOT IN
      ('verified','unverified','pending','pending_doc','pending_postcard','pending_approval','provisional_bootstrap')
    OR (v_target.verification_status<>'verified' AND v_target.verified_at IS NOT NULL))) THEN
    RETURN jsonb_build_object('ok',false,'code','MEMBERSHIP_RENEWAL_REQUIRED','status',409); END IF;
  IF v_has_target AND v_target.verification_status='verified' THEN
    RETURN jsonb_build_object('ok',true,'existing_verified',true,'occupancy',to_jsonb(v_target)); END IF;
  IF v_role='owner' OR (v_actor->>'is_owner'<>'true' AND (
    public.home_role_rank(v_role)>=public.home_role_rank((v_actor->>'effective_role_base')::public.home_role_base)
    OR (v_has_target AND public.home_role_rank(v_old_role)>=public.home_role_rank((v_actor->>'effective_role_base')::public.home_role_base))))
    OR (v_age='child' AND public.home_role_rank(v_role)>20)
    OR (v_age='teen' AND public.home_role_rank(v_role)>30) THEN
    RETURN jsonb_build_object('ok',false,'code','PROPOSED_ROLE_FORBIDDEN','status',403); END IF;
  v_permissions:=public.home_member_policy_permissions(p_home_id,p_target_id,v_role,v_age,p_policy->>'preset_key');
  SELECT ARRAY(SELECT jsonb_array_elements_text(v_actor->'permissions')) INTO v_actor_permissions;
  IF EXISTS(SELECT FROM unnest(v_permissions) p WHERE NOT p=ANY(v_actor_permissions))
    OR EXISTS(SELECT FROM jsonb_array_elements_text(p_policy->'grant_perms') p
      WHERE NOT p=ANY(v_actor_permissions) OR NOT public.home_authority_age_allows(v_age,p::public.home_permission)) THEN
    RETURN jsonb_build_object('ok',false,'code','PERMISSION_DELEGATION_FORBIDDEN','status',403); END IF;
  RETURN jsonb_build_object('ok',true,'existing_verified',false,'role_base',v_role,'age_band',v_age,
    'access_start_at',greatest(v_target.access_start_at,p_start_at),
    'access_end_at',least(v_target.access_end_at,p_end_at),'permissions',v_permissions);
END $$;

CREATE FUNCTION public.home_invite_is_recipient(p_invite public."HomeInvite",p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT p_user_id IS NOT NULL AND CASE WHEN p_invite.invitee_user_id IS NOT NULL
    THEN p_invite.invitee_user_id=p_user_id ELSE p_invite.invitee_email IS NOT NULL AND EXISTS(
      SELECT FROM auth.users WHERE id=p_user_id AND email_confirmed_at IS NOT NULL
        AND lower(btrim(email))=lower(btrim(p_invite.invitee_email))) END;
$$;

CREATE FUNCTION public.write_home_invitation(p_home_id uuid,p_actor_id uuid,p_action text,
  p_payload jsonb DEFAULT '{}',p_token text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE v_home public."Home"%ROWTYPE; v_request public."HomeHouseholdAccessRequest"%ROWTYPE;
  v_invite public."HomeInvite"%ROWTYPE; v_actor public."User"%ROWTYPE; v_policy jsonb; v_target_policy jsonb;
  v_role text; v_preset text; v_email text; v_target_id uuid; v_delivery_email text; v_hash text;
  v_start timestamptz; v_end timestamptz; v_now timestamptz; v_recipients uuid[];
BEGIN
  IF p_actor_id IS NULL OR p_action IS NULL OR p_action NOT IN ('create','request','approve_request','reject_request')
    OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
    RETURN jsonb_build_object('ok',false,'code','INVITE_INVALID','status',400); END IF;
  IF NOT public.lock_home_invitation_scope(p_home_id) THEN
    RETURN jsonb_build_object('ok',false,'code','HOME_NOT_FOUND','status',404); END IF;
  SELECT * INTO v_home FROM public."Home" WHERE id=p_home_id;
  SELECT * INTO v_actor FROM public."User" WHERE id=p_actor_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','USER_NOT_FOUND','status',404); END IF;
  v_now:=clock_timestamp();
  IF p_action='request' THEN
    IF (SELECT count(*) FROM jsonb_object_keys(p_payload))<>1 OR p_payload->>'requested_identity' IS NULL
      OR p_payload->>'requested_identity' NOT IN ('owner','resident','household_member','guest') THEN
      RETURN jsonb_build_object('ok',false,'code','INVITE_INVALID','status',400); END IF;
    IF v_home.security_state IN ('frozen','frozen_silent') OR v_home.home_status IN ('merged','archived') THEN
      RETURN jsonb_build_object('ok',false,'code','HOME_ADMISSION_CLOSED','status',403); END IF;
    IF public.home_is_active_member(p_home_id,p_actor_id) THEN
      RETURN jsonb_build_object('ok',false,'code','MEMBER_ALREADY_EXISTS','status',409); END IF;
    SELECT coalesce(array_agg(subject_id),'{}'::uuid[]) INTO v_recipients FROM public."HomeOwner"
      WHERE home_id=p_home_id AND subject_type='user' AND owner_status='verified' AND subject_id<>p_actor_id
        AND public.home_invite_authority(p_home_id,subject_id) IS NOT NULL;
    IF cardinality(v_recipients)=0 THEN
      RETURN jsonb_build_object('ok',false,'code','VERIFIED_OWNER_REQUIRED','status',409); END IF;
    SELECT * INTO v_request FROM public."HomeHouseholdAccessRequest"
      WHERE home_id=p_home_id AND requester_user_id=p_actor_id AND status='pending';
    IF FOUND THEN
      UPDATE public."HomeHouseholdAccessRequest" SET requested_identity=p_payload->>'requested_identity',updated_at=v_now
        WHERE id=v_request.id RETURNING * INTO v_request;
    ELSE
      INSERT INTO public."HomeHouseholdAccessRequest"(home_id,requester_user_id,requested_identity)
        VALUES(p_home_id,p_actor_id,p_payload->>'requested_identity') RETURNING * INTO v_request;
    END IF;
    INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
      VALUES(p_home_id,p_actor_id,'HOUSEHOLD_ACCESS_REQUESTED','HomeHouseholdAccessRequest',v_request.id,
        jsonb_build_object('requested_identity',v_request.requested_identity,'notified_owner_count',cardinality(v_recipients)));
    RETURN jsonb_build_object('ok',true,'replayed',false,'request_id',v_request.id,'notify_user_ids',v_recipients,
      'actor_name',coalesce(v_actor.name,v_actor.first_name,v_actor.username,'Someone'),
      'home_label',coalesce(v_home.name,'the home'));
  END IF;
  IF public.home_invite_authority(p_home_id,p_actor_id) IS NULL THEN
    RETURN jsonb_build_object('ok',false,'code','MEMBERS_MANAGE_REQUIRED','status',403); END IF;
  IF p_action IN ('approve_request','reject_request') THEN
    IF (SELECT count(*) FROM jsonb_object_keys(p_payload))<>1 OR p_payload->>'request_id' IS NULL THEN
      RETURN jsonb_build_object('ok',false,'code','INVITE_INVALID','status',400); END IF;
    SELECT * INTO v_request FROM public."HomeHouseholdAccessRequest"
      WHERE id=(p_payload->>'request_id')::uuid AND home_id=p_home_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','REQUEST_NOT_FOUND','status',404); END IF;
    IF v_request.status<>'pending' THEN
      IF v_request.resolved_by=p_actor_id AND ((p_action='reject_request' AND v_request.status='rejected')
        OR (p_action='approve_request' AND v_request.status='approved')) THEN
        RETURN jsonb_build_object('ok',true,'replayed',true); END IF;
      RETURN jsonb_build_object('ok',false,'code','REQUEST_NOT_PENDING','status',409); END IF;
    v_target_id:=v_request.requester_user_id;
    IF v_target_id=p_actor_id THEN RETURN jsonb_build_object('ok',false,'code','SELF_ADMISSION_FORBIDDEN','status',403); END IF;
    IF p_action='reject_request' THEN
      UPDATE public."HomeHouseholdAccessRequest" SET status='rejected',resolved_by=p_actor_id,
        resolved_at=v_now,updated_at=v_now WHERE id=v_request.id;
      INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
        VALUES(p_home_id,p_actor_id,'HOUSEHOLD_ACCESS_REJECTED','HomeHouseholdAccessRequest',v_request.id,
          jsonb_build_object('requester_user_id',v_target_id));
      RETURN jsonb_build_object('ok',true,'replayed',false,'target_id',v_target_id,
        'actor_name',coalesce(v_actor.name,v_actor.first_name,v_actor.username,'A home manager'),
        'home_label',coalesce(v_home.name,'the home'));
    END IF;
    IF v_request.requested_identity='owner' THEN
      RETURN jsonb_build_object('ok',false,'code','OWNERSHIP_FLOW_REQUIRED','status',409); END IF;
    v_role:=CASE v_request.requested_identity WHEN 'resident' THEN 'lease_resident' WHEN 'guest' THEN 'guest' ELSE 'member' END;
  ELSE
    IF EXISTS(SELECT FROM jsonb_object_keys(p_payload) k WHERE k NOT IN
      ('email','user_id','relationship','preset_key','start_at','end_at','message','username'))
      OR EXISTS(SELECT FROM jsonb_each(p_payload) e WHERE jsonb_typeof(e.value) NOT IN ('string','null')) THEN
      RETURN jsonb_build_object('ok',false,'code','INVITE_INVALID','status',400); END IF;
    v_role:=coalesce(nullif(p_payload->>'relationship',''),'member');
    v_preset:=nullif(p_payload->>'preset_key','');
    IF v_preset LIKE 'claim_merge:%' THEN
      RETURN jsonb_build_object('ok',false,'code','CLAIM_MERGE_PRESET_FORBIDDEN','status',400); END IF;
    IF public.home_invite_role(v_role)='owner' THEN
      RETURN jsonb_build_object('ok',false,'code','OWNER_INVITE_FORBIDDEN','status',400); END IF;
    v_target_id:=nullif(p_payload->>'user_id','')::uuid;
    v_email:=nullif(lower(btrim(p_payload->>'email')),'');
    IF length(v_email)>254 OR (v_email IS NOT NULL AND v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
      OR length(p_payload->>'message')>2000 THEN
      RETURN jsonb_build_object('ok',false,'code','INVITE_INVALID','status',400); END IF;
    -- Dates must be unambiguous instants. Web converts local date inputs to
    -- explicit UTC instants; the backend never silently interprets a local day.
    IF EXISTS(SELECT FROM jsonb_each_text(p_payload) e WHERE e.key IN ('start_at','end_at')
      AND e.value IS NOT NULL AND e.value !~ 'T[0-9]{2}:[0-9]{2}.*(Z|[+-][0-9]{2}:[0-9]{2})$') THEN
      RETURN jsonb_build_object('ok',false,'code','INVITE_DATES_INVALID','status',400); END IF;
    v_start:=(p_payload->>'start_at')::timestamptz; v_end:=(p_payload->>'end_at')::timestamptz;
    IF v_end<=v_now OR v_start>=v_end THEN
      RETURN jsonb_build_object('ok',false,'code','INVITE_DATES_INVALID','status',400); END IF;
  END IF;
  IF v_target_id IS NOT NULL THEN
    SELECT u.email INTO v_delivery_email FROM auth.users u JOIN public."User" p ON p.id=u.id WHERE u.id=v_target_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','USER_NOT_FOUND','status',404); END IF;
    IF v_email IS NOT NULL AND v_email IS DISTINCT FROM lower(btrim(v_delivery_email)) THEN
      RETURN jsonb_build_object('ok',false,'code','INVITE_RECIPIENT_MISMATCH','status',400); END IF;
  ELSIF v_email IS NOT NULL THEN
    -- Email-only invitations bind to the verified auth identity, never a
    -- mutable public-profile email. Unregistered recipients remain email-bound.
    SELECT u.id INTO v_target_id FROM auth.users u JOIN public."User" p ON p.id=u.id
      WHERE lower(btrim(u.email))=v_email AND u.email_confirmed_at IS NOT NULL;
    v_delivery_email:=v_email;
  END IF;
  v_policy:=public.home_invite_policy(v_role,v_preset);
  v_target_policy:=public.home_invite_target_policy(p_home_id,p_actor_id,v_target_id,v_policy,v_start,v_end);
  IF v_target_policy->>'ok'<>'true' THEN RETURN v_target_policy; END IF;
  IF v_target_policy->>'existing_verified'='true' THEN
    RETURN jsonb_build_object('ok',false,'code','MEMBER_ALREADY_EXISTS','status',409); END IF;
  IF v_target_id IS NULL AND v_email IS NULL AND v_policy->>'role_base' IN ('manager','service_provider') THEN
    RETURN jsonb_build_object('ok',false,'code','TARGETED_INVITE_REQUIRED','status',400); END IF;
  IF EXISTS(SELECT FROM public."HomeInvite" WHERE home_id=p_home_id AND status='pending'
    AND (expires_at IS NULL OR expires_at>v_now) AND
      ((v_target_id IS NOT NULL AND invitee_user_id=v_target_id) OR
       (v_email IS NOT NULL AND invitee_user_id IS NULL AND lower(btrim(invitee_email))=v_email))) THEN
    RETURN jsonb_build_object('ok',false,'code','INVITE_ALREADY_PENDING','status',409); END IF;
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('ok',false,'code','INVITE_INVALID','status',400); END IF;
  v_hash:=encode(sha256(convert_to(p_token,'UTF8')),'hex');
  INSERT INTO public."HomeInvite"(home_id,invited_by,invitee_email,invitee_user_id,proposed_role,
    proposed_role_base,proposed_preset_key,token,token_hash,is_open_invite,expires_at,admission_policy,
    access_start_at,access_end_at,source_request_id)
    VALUES(p_home_id,p_actor_id,v_email,v_target_id,v_policy->>'role_base',(v_policy->>'role_base')::public.home_role_base,
      v_preset,v_hash,v_hash,v_email IS NULL AND v_target_id IS NULL,v_now+interval '7 days',v_policy,v_start,v_end,v_request.id)
    RETURNING * INTO v_invite;
  IF p_action='approve_request' THEN
    UPDATE public."HomeHouseholdAccessRequest" SET status='approved',resolved_by=p_actor_id,
      resolved_at=v_now,updated_at=v_now WHERE id=v_request.id;
  END IF;
  INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
    VALUES(p_home_id,p_actor_id,'HOME_INVITE_CREATED','HomeInvite',v_invite.id,
      jsonb_build_object('target_id',v_target_id,'role_base',v_policy->>'role_base','source_request_id',v_request.id));
  RETURN jsonb_build_object('ok',true,'replayed',false,
    'invitation',(to_jsonb(v_invite)-ARRAY['token','token_hash','admission_policy'])||jsonb_build_object('token',p_token),
    'delivery_email',v_delivery_email,'actor_name',coalesce(v_actor.name,v_actor.first_name,v_actor.username,'Someone'),
    'home_label',coalesce(v_home.name,v_home.address,'A home'),'home_city',concat_ws(', ',v_home.city,v_home.state));
END $$;

CREATE FUNCTION public.act_on_home_invitation(p_invite_id uuid,p_token text,p_actor_id uuid,
  p_action text,p_validity_days integer DEFAULT 365) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE v_invite public."HomeInvite"%ROWTYPE; v_home public."Home"%ROWTYPE;
  v_occupancy public."HomeOccupancy"%ROWTYPE; v_inviter public."User"%ROWTYPE;
  v_policy jsonb; v_target_policy jsonb; v_permissions jsonb; v_hash text; v_count integer;
  v_now timestamptz; v_recipient boolean; v_open boolean; v_permission public.home_permission;
BEGIN
  IF p_action IS NULL OR p_action NOT IN ('preview','accept','decline')
    OR (p_invite_id IS NULL)=(p_token IS NULL) OR (p_action<>'preview' AND p_actor_id IS NULL)
    OR p_validity_days IS NULL OR p_validity_days NOT BETWEEN 1 AND 3650 OR length(p_token)>512 THEN
    RETURN jsonb_build_object('ok',false,'code','INVITE_INVALID','status',400); END IF;
  IF p_token IS NOT NULL THEN v_hash:=encode(sha256(convert_to(p_token,'UTF8')),'hex'); END IF;
  SELECT count(*) INTO v_count FROM public."HomeInvite" WHERE
    (p_invite_id IS NOT NULL AND id=p_invite_id) OR (p_token IS NOT NULL AND
      (token_hash=v_hash OR (token_hash IS NULL AND token=p_token)));
  IF v_count=0 THEN RETURN jsonb_build_object('ok',false,'code','INVITE_NOT_FOUND','status',404); END IF;
  IF v_count<>1 THEN RETURN jsonb_build_object('ok',false,'code','INVITE_UNAVAILABLE','status',503); END IF;
  SELECT * INTO v_invite FROM public."HomeInvite" WHERE
    (p_invite_id IS NOT NULL AND id=p_invite_id) OR (p_token IS NOT NULL AND
      (token_hash=v_hash OR (token_hash IS NULL AND token=p_token)));
  IF NOT public.lock_home_invitation_scope(v_invite.home_id) THEN
    RETURN jsonb_build_object('ok',false,'code','INVITE_NOT_FOUND','status',404); END IF;
  -- Recheck the exact token after locking, including legacy hash-null fallback.
  SELECT * INTO v_invite FROM public."HomeInvite" WHERE id=v_invite.id AND
    (p_token IS NULL OR token_hash=v_hash OR (token_hash IS NULL AND token=p_token));
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','INVITE_NOT_FOUND','status',404); END IF;
  SELECT * INTO v_home FROM public."Home" WHERE id=v_invite.home_id;
  -- Serialize confirmation/email changes with email-bound redemption. The
  -- application never substitutes a mutable public-profile email here.
  IF v_invite.invitee_user_id IS NULL AND v_invite.invitee_email IS NOT NULL AND p_actor_id IS NOT NULL THEN
    PERFORM id FROM auth.users WHERE id=p_actor_id FOR SHARE;
  END IF;
  v_now:=clock_timestamp();
  v_recipient:=public.home_invite_is_recipient(v_invite,p_actor_id);
  v_open:=v_invite.is_open_invite IS TRUE AND v_invite.invitee_user_id IS NULL AND v_invite.invitee_email IS NULL;
  IF p_action='decline' THEN
    IF NOT coalesce(v_recipient,false) AND v_invite.invited_by IS DISTINCT FROM p_actor_id
      AND public.home_invite_authority(v_invite.home_id,p_actor_id) IS NULL THEN
      -- Declining an open link is this viewer's decision, not authority to
      -- revoke the invitation for every other potential recipient.
      IF v_open AND p_token IS NOT NULL THEN RETURN jsonb_build_object('ok',true,'replayed',true); END IF;
      RETURN jsonb_build_object('ok',false,'code','INVITE_EMAIL_MISMATCH','status',403); END IF;
    IF v_invite.status='revoked' THEN RETURN jsonb_build_object('ok',true,'replayed',true); END IF;
    IF v_invite.status<>'pending' THEN RETURN jsonb_build_object('ok',false,'code','INVITE_ALREADY_USED','status',409); END IF;
    UPDATE public."HomeInvite" SET status='revoked' WHERE id=v_invite.id;
    INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
      VALUES(v_invite.home_id,p_actor_id,'HOME_INVITE_REVOKED','HomeInvite',v_invite.id,'{}');
    RETURN jsonb_build_object('ok',true,'replayed',false);
  END IF;
  IF p_action='accept' AND NOT coalesce(v_recipient,false) AND NOT (v_open AND p_token IS NOT NULL) THEN
    RETURN jsonb_build_object('ok',false,'code','INVITE_EMAIL_MISMATCH','status',403); END IF;
  IF p_action='preview' AND (v_invite.status<>'pending' OR v_invite.expires_at<=v_now) THEN
    RETURN jsonb_build_object('ok',true,'invitation',jsonb_build_object('id',v_invite.id,
      'status',CASE WHEN v_invite.status='pending' THEN 'expired' ELSE v_invite.status END),
      'expired',v_invite.status='expired' OR (v_invite.status='pending' AND v_invite.expires_at<=v_now),
      'alreadyUsed',v_invite.status='accepted'); END IF;
  IF p_action='accept' AND v_invite.status='accepted' THEN
    -- A committed admission is independent of its former inviter. An exact
    -- winner retry may return only their current occupancy, never reapply it.
    SELECT * INTO v_occupancy FROM public."HomeOccupancy" WHERE home_id=v_invite.home_id AND user_id=p_actor_id;
    IF v_invite.accepted_by_user_id=p_actor_id AND v_occupancy.is_active IS TRUE
      AND v_occupancy.verification_status='verified'
      AND coalesce(v_occupancy.role_base,public.home_invite_role(v_occupancy.role)) IS NOT NULL
      AND (v_occupancy.end_at IS NULL OR v_occupancy.end_at>v_now)
      AND (v_occupancy.access_end_at IS NULL OR v_occupancy.access_end_at>v_now) THEN
      RETURN jsonb_build_object('ok',true,'replayed',true,'homeId',v_invite.home_id,'occupancy',to_jsonb(v_occupancy)); END IF;
    RETURN jsonb_build_object('ok',false,'code','INVITE_ALREADY_USED','status',409);
  END IF;
  IF v_invite.status<>'pending' THEN RETURN jsonb_build_object('ok',false,'code','INVITE_ALREADY_USED','status',409); END IF;
  IF v_invite.expires_at<=v_now THEN RETURN jsonb_build_object('ok',false,'code','INVITE_EXPIRED','status',410); END IF;
  IF public.home_invite_authority(v_invite.home_id,v_invite.invited_by) IS NULL THEN
    RETURN jsonb_build_object('ok',false,'code','INVITER_ACCESS_CHANGED','status',403); END IF;
  IF p_action='preview' THEN
    SELECT * INTO v_inviter FROM public."User" WHERE id=v_invite.invited_by;
    RETURN jsonb_build_object('ok',true,'invitation',jsonb_build_object('id',v_invite.id,'status',v_invite.status,
      'proposed_role',v_invite.proposed_role,'invitee_email',v_invite.invitee_email,'invitee_user_id',v_invite.invitee_user_id,
      'created_at',v_invite.created_at,'expires_at',v_invite.expires_at,
      'access_start_at',v_invite.access_start_at,'access_end_at',v_invite.access_end_at),
      'home',jsonb_build_object('id',v_home.id,'name',coalesce(v_home.name,'A Home'),
        'city',concat_ws(', ',v_home.city,v_home.state),'home_type',v_home.home_type),
      'inviter',jsonb_build_object('name',coalesce(v_inviter.name,v_inviter.first_name,v_inviter.username,'Someone'),
        'username',v_inviter.username,'profilePicture',v_inviter.profile_picture_url));
  END IF;
  IF p_actor_id=v_invite.invited_by THEN
    RETURN jsonb_build_object('ok',false,'code','SELF_ADMISSION_FORBIDDEN','status',403); END IF;
  IF v_invite.proposed_preset_key LIKE 'claim_merge:%' THEN
    -- Dedicated ownership enrollment remains a distinct service. Never let a
    -- disabled feature flag fall through to ordinary owner-template creation.
    RETURN jsonb_build_object('ok',true,'kind','claim_merge','invitation',to_jsonb(v_invite)); END IF;
  IF v_invite.source_request_id IS NOT NULL AND NOT EXISTS(
    SELECT FROM public."HomeHouseholdAccessRequest" WHERE id=v_invite.source_request_id
      AND home_id=v_invite.home_id AND requester_user_id=p_actor_id AND status='approved'
      AND resolved_by=v_invite.invited_by
      AND CASE requested_identity WHEN 'resident' THEN 'lease_resident' WHEN 'guest' THEN 'guest'
        WHEN 'household_member' THEN 'member' ELSE 'owner' END=v_invite.proposed_role_base::text) THEN
    RETURN jsonb_build_object('ok',false,'code','INVITE_SOURCE_CHANGED','status',409); END IF;
  v_policy:=public.home_invite_policy(coalesce(v_invite.proposed_role_base::text,v_invite.proposed_role),
    CASE WHEN v_invite.proposed_preset_key LIKE 'access_request:%' THEN NULL ELSE v_invite.proposed_preset_key END);
  IF v_policy IS NULL OR (v_invite.admission_policy IS NOT NULL AND v_invite.admission_policy IS DISTINCT FROM v_policy) THEN
    RETURN jsonb_build_object('ok',false,'code','INVITE_POLICY_CHANGED','status',409); END IF;
  v_target_policy:=public.home_invite_target_policy(v_invite.home_id,v_invite.invited_by,p_actor_id,
    v_policy,v_invite.access_start_at,v_invite.access_end_at);
  IF v_target_policy->>'ok'<>'true' THEN RETURN v_target_policy; END IF;
  IF v_target_policy->>'existing_verified'='true' THEN
    SELECT * INTO v_occupancy FROM public."HomeOccupancy" WHERE home_id=v_invite.home_id AND user_id=p_actor_id;
  ELSE
    SELECT * INTO v_occupancy FROM public."HomeOccupancy" WHERE home_id=v_invite.home_id AND user_id=p_actor_id;
    IF FOUND THEN
      UPDATE public."HomeOccupancy" SET role=v_policy->>'role_base',role_base=(v_policy->>'role_base')::public.home_role_base,
        age_band=(v_target_policy->>'age_band')::public.home_age_band,
        access_start_at=(v_target_policy->>'access_start_at')::timestamptz,
        access_end_at=(v_target_policy->>'access_end_at')::timestamptz,
        verification_status='verified',verified_at=v_now,verification_expires_at=v_now+make_interval(days=>p_validity_days),
        updated_at=v_now WHERE id=v_occupancy.id RETURNING * INTO v_occupancy;
    ELSE
      INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,is_active,start_at,
        access_start_at,access_end_at,added_by_user_id,verification_status,verified_at,verification_expires_at,
        can_manage_home,can_manage_access,can_manage_finance,can_manage_tasks,can_view_sensitive)
        VALUES(v_invite.home_id,p_actor_id,v_policy->>'role_base',(v_policy->>'role_base')::public.home_role_base,
          (v_target_policy->>'age_band')::public.home_age_band,true,now(),
          (v_target_policy->>'access_start_at')::timestamptz,(v_target_policy->>'access_end_at')::timestamptz,
          v_invite.invited_by,'verified',v_now,v_now+make_interval(days=>p_validity_days),false,false,false,false,false)
        RETURNING * INTO v_occupancy;
    END IF;
    FOR v_permission IN SELECT jsonb_array_elements_text(v_policy->'grant_perms')::public.home_permission LOOP
      INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed,created_by)
        VALUES(v_invite.home_id,p_actor_id,v_permission,true,v_invite.invited_by)
        ON CONFLICT(home_id,user_id,permission) DO NOTHING;
    END LOOP;
    FOR v_permission IN SELECT jsonb_array_elements_text(v_policy->'deny_perms')::public.home_permission LOOP
      INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed,created_by)
        VALUES(v_invite.home_id,p_actor_id,v_permission,false,v_invite.invited_by)
        ON CONFLICT(home_id,user_id,permission) DO UPDATE SET allowed=false,created_by=v_invite.invited_by,updated_at=v_now;
    END LOOP;
    v_permissions:=CASE WHEN (v_occupancy.start_at IS NULL OR v_occupancy.start_at<=v_now)
      AND (v_occupancy.access_start_at IS NULL OR v_occupancy.access_start_at<=v_now)
      THEN v_target_policy->'permissions' ELSE '[]'::jsonb END;
    UPDATE public."HomeOccupancy" SET can_manage_home=v_permissions ? 'home.edit',
      can_manage_access=v_permissions ?| ARRAY['access.manage','members.manage'],
      can_manage_finance=v_permissions ? 'finance.manage',can_manage_tasks=v_permissions ?| ARRAY['tasks.edit','tasks.manage'],
      can_view_sensitive=v_permissions ? 'sensitive.view' WHERE id=v_occupancy.id RETURNING * INTO v_occupancy;
    UPDATE public."Home" SET vacancy_at=NULL,updated_at=v_now WHERE id=v_invite.home_id AND vacancy_at IS NOT NULL;
  END IF;
  UPDATE public."HomeInvite" SET status='accepted',accepted_by_user_id=p_actor_id,accepted_at=v_now WHERE id=v_invite.id;
  INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
    VALUES(v_invite.home_id,p_actor_id,'HOME_INVITE_ACCEPTED','HomeInvite',v_invite.id,
      jsonb_build_object('inviter_id',v_invite.invited_by,'occupancy_id',v_occupancy.id));
  RETURN jsonb_build_object('ok',true,'replayed',false,'homeId',v_invite.home_id,'occupancy',to_jsonb(v_occupancy),
    'inviter_id',v_invite.invited_by,'home_label',coalesce(v_home.name,'A home'));
END $$;

CREATE FUNCTION public.list_home_invitations(p_actor_id uuid,p_home_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE v_rows jsonb;
BEGIN
  IF p_actor_id IS NULL THEN RETURN jsonb_build_object('ok',false,'code','INVITE_INVALID','status',400); END IF;
  IF p_home_id IS NOT NULL THEN
    IF NOT public.lock_home_invitation_scope(p_home_id) THEN RETURN jsonb_build_object('ok',false,'code','HOME_NOT_FOUND','status',404); END IF;
    IF public.home_invite_authority(p_home_id,p_actor_id) IS NULL THEN
      RETURN jsonb_build_object('ok',false,'code','MEMBERS_MANAGE_REQUIRED','status',403); END IF;
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',i.id,'home_id',i.home_id,'invited_by',i.invited_by,
    'invitee_user_id',i.invitee_user_id,'invitee_email',i.invitee_email,'proposed_role',i.proposed_role,
    'proposed_role_base',i.proposed_role_base,'proposed_preset_key',i.proposed_preset_key,'status',i.status,
    'created_at',i.created_at,'expires_at',i.expires_at,'is_open_invite',i.is_open_invite,
    'access_start_at',i.access_start_at,'access_end_at',i.access_end_at,
    'home',jsonb_build_object('id',h.id,'name',h.name,'city',h.city,'state',h.state),
    'inviter',jsonb_build_object('id',u.id,'username',u.username,'name',u.name)) ORDER BY i.created_at DESC),'[]')
    INTO v_rows FROM public."HomeInvite" i JOIN public."Home" h ON h.id=i.home_id JOIN public."User" u ON u.id=i.invited_by
    WHERE i.status='pending' AND (i.expires_at IS NULL OR i.expires_at>clock_timestamp())
      AND ((p_home_id IS NOT NULL AND i.home_id=p_home_id) OR
        (p_home_id IS NULL AND public.home_invite_is_recipient(i,p_actor_id)))
      AND public.home_invite_authority(i.home_id,i.invited_by) IS NOT NULL;
  RETURN jsonb_build_object('ok',true,'invitations',v_rows);
END $$;

CREATE FUNCTION public.list_home_household_requests(p_home_id uuid,p_actor_id uuid,p_status text DEFAULT 'pending') RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE v_rows jsonb;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('pending','approved','rejected','all') THEN
    RETURN jsonb_build_object('ok',false,'code','INVITE_INVALID','status',400); END IF;
  IF NOT public.lock_home_invitation_scope(p_home_id) THEN RETURN jsonb_build_object('ok',false,'code','HOME_NOT_FOUND','status',404); END IF;
  IF public.home_invite_authority(p_home_id,p_actor_id) IS NULL THEN
    RETURN jsonb_build_object('ok',false,'code','MEMBERS_MANAGE_REQUIRED','status',403); END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(r)-'requester_profile' || jsonb_build_object('requester',r.requester_profile)
    ORDER BY r.created_at DESC),'[]') INTO v_rows FROM (
    SELECT q.id,q.home_id,q.requester_user_id,q.requested_identity,q.status,q.created_at,q.updated_at,q.resolved_by,q.resolved_at,
      jsonb_build_object('id',u.id,'username',u.username,'name',u.name,'first_name',u.first_name,
        'last_name',u.last_name,'profile_picture_url',u.profile_picture_url) requester_profile
      FROM public."HomeHouseholdAccessRequest"q JOIN public."User"u ON u.id=q.requester_user_id
      WHERE q.home_id=p_home_id AND (p_status='all' OR q.status=p_status) ORDER BY q.created_at DESC LIMIT 100
  )r;
  RETURN jsonb_build_object('ok',true,'requests',v_rows);
END $$;

REVOKE ALL ON FUNCTION public.lock_home_invitation_scope(uuid),public.home_invite_role(text),
  public.home_invite_authority(uuid,uuid),public.home_invite_policy(text,text),
  public.home_invite_target_policy(uuid,uuid,uuid,jsonb,timestamptz,timestamptz),
  public.home_invite_is_recipient(public."HomeInvite",uuid),
  public.write_home_invitation(uuid,uuid,text,jsonb,text),
  public.act_on_home_invitation(uuid,text,uuid,text,integer),public.list_home_invitations(uuid,uuid),
  public.list_home_household_requests(uuid,uuid,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lock_home_invitation_scope(uuid),public.home_invite_role(text),
  public.home_invite_authority(uuid,uuid),public.home_invite_policy(text,text),
  public.home_invite_target_policy(uuid,uuid,uuid,jsonb,timestamptz,timestamptz),
  public.home_invite_is_recipient(public."HomeInvite",uuid),
  public.write_home_invitation(uuid,uuid,text,jsonb,text),
  public.act_on_home_invitation(uuid,text,uuid,text,integer),public.list_home_invitations(uuid,uuid),
  public.list_home_household_requests(uuid,uuid,text)
  TO service_role;
