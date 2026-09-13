-- Backwards compatible: yes. Additive actor-bound removal commands and a nullable
-- semantic version. No existing occupancy is updated/backfilled, no role defaults
-- or invitation/admission policy change. Legacy DELETE keeps its response shape.
SET LOCAL lock_timeout='5s';

ALTER TABLE public."HomeOccupancy" ADD COLUMN membership_version uuid;
COMMENT ON COLUMN public."HomeOccupancy".membership_version IS
  'Changes on semantic membership updates; null on untouched pre-migration rows. Not a residency or ownership proof.';
CREATE FUNCTION public.version_home_membership() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF TG_OP='INSERT' THEN NEW.membership_version:=gen_random_uuid();
  ELSIF (to_jsonb(NEW)-ARRAY['membership_version','updated_at','density_milestone_seen'])
    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['membership_version','updated_at','density_milestone_seen']) THEN
    NEW.membership_version:=gen_random_uuid();
  ELSE NEW.membership_version:=OLD.membership_version;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER home_membership_version BEFORE INSERT OR UPDATE ON public."HomeOccupancy"
  FOR EACH ROW EXECUTE FUNCTION public.version_home_membership();
REVOKE ALL ON FUNCTION public.version_home_membership() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.home_member_removal_terminal(o public."HomeOccupancy",t timestamptz)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
  SELECT o.is_active IS FALSE AND o.end_at IS NOT NULL AND isfinite(o.end_at) AND o.end_at<=t
    AND coalesce(o.verification_status IN ('inactive','moved_out'),false)
    AND NOT o.can_manage_home AND NOT o.can_manage_access AND NOT o.can_manage_finance
    AND NOT o.can_manage_tasks AND NOT o.can_view_sensitive;
$$;

-- The same locked, current authority/target review serves protected commands and
-- legacy removal. No profile, receipt or current permission projection is cached.
CREATE FUNCTION public.home_member_removal_context(p_home_id uuid,p_actor_id uuid,p_target_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE v_home public."Home"%ROWTYPE; v_target public."HomeOccupancy"%ROWTYPE;
  v_actor jsonb; v_actor_role public.home_role_base; v_target_role public.home_role_base;
  v_self boolean; v_target_owner boolean; v_actor_perms text[]; v_now timestamptz;
  v_stale_pointer boolean; v_terminal boolean; v_ownership_cleanup boolean; v_profile jsonb;
  v_home_view jsonb; v_target_view jsonb; v_hash text;
BEGIN
  IF p_home_id IS NULL OR p_actor_id IS NULL OR p_target_id IS NULL THEN
    RETURN '{"ok":false,"code":"MEMBER_REMOVAL_INVALID","status":400}'::jsonb; END IF;
  SELECT * INTO v_home FROM public."Home" WHERE id=p_home_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','HOME_NOT_FOUND','status',404); END IF;
  LOCK TABLE public."HomeRolePermission", public."HomeRolePreset" IN SHARE MODE;
  PERFORM id FROM public."HomeOccupancy" WHERE home_id=p_home_id ORDER BY id FOR UPDATE;
  PERFORM id FROM public."HomeOwner" WHERE home_id=p_home_id ORDER BY id FOR UPDATE;
  PERFORM user_id FROM public."HomePermissionOverride" WHERE home_id=p_home_id ORDER BY user_id,permission FOR UPDATE;
  -- Profile review can block too; finish it before measuring current authority.
  PERFORM 1 FROM public."User" WHERE id=p_target_id FOR SHARE;
  -- now() remains the transaction start across lock waits. Authority must still
  -- be current when this mutation is admitted, including an expiring actor.
  v_now := clock_timestamp();
  v_self := p_actor_id=p_target_id;
  IF NOT v_self AND (
    v_home.security_state IN ('frozen','frozen_silent') OR EXISTS (
      SELECT FROM public."HomeOccupancy" o WHERE o.home_id=p_home_id AND o.user_id=p_actor_id
        AND (o.start_at>v_now OR o.end_at<=v_now OR o.access_start_at>v_now OR o.access_end_at<=v_now))) THEN
    RETURN jsonb_build_object('ok',false,'code','MEMBERS_MANAGE_REQUIRED','status',403);
  END IF;
  v_actor := public.home_effective_access(p_home_id,p_actor_id);
  -- A revoked ownership proof cannot leave implicit owner powers behind via a
  -- stale pointer/role. Historical revoked rows may coexist with a current
  -- verified owner; a former owner with independently granted admin rights also
  -- keeps those bounded rights rather than inheriting implicit ownership.
  IF NOT v_self AND v_actor->>'is_owner'='true'
    AND EXISTS (SELECT FROM public."HomeOwner" o WHERE o.home_id=p_home_id AND o.subject_type='user'
      AND o.subject_id=p_actor_id AND o.owner_status IN ('revoked','disputed'))
    AND NOT EXISTS (SELECT FROM public."HomeOwner" o WHERE o.home_id=p_home_id AND o.subject_type='user'
      AND o.subject_id=p_actor_id AND o.owner_status='verified') THEN
    RETURN jsonb_build_object('ok',false,'code','MEMBERS_MANAGE_REQUIRED','status',403);
  END IF;
  v_actor_role := (v_actor->>'effective_role_base')::public.home_role_base;
  SELECT ARRAY(SELECT jsonb_array_elements_text(v_actor->'permissions')) INTO v_actor_perms;
  IF NOT v_self AND NOT ('members.manage'=ANY(v_actor_perms)) THEN
    RETURN jsonb_build_object('ok',false,'code','MEMBERS_MANAGE_REQUIRED','status',403);
  END IF;
  SELECT * INTO v_target FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_target_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','MEMBER_NOT_FOUND','status',404); END IF;
  v_target_role := v_target.role_base;
  IF v_target_role IS NULL THEN
    v_target_role := CASE v_target.role
      WHEN 'owner' THEN 'owner' WHEN 'admin' THEN 'admin' WHEN 'manager' THEN 'manager'
      WHEN 'property_manager' THEN 'manager' WHEN 'tenant' THEN 'lease_resident'
      WHEN 'renter' THEN 'lease_resident' WHEN 'lease_resident' THEN 'lease_resident'
      WHEN 'member' THEN 'member' WHEN 'family' THEN 'member' WHEN 'roommate' THEN 'member'
      WHEN 'restricted_member' THEN 'restricted_member' WHEN 'caregiver' THEN 'restricted_member'
      WHEN 'guest' THEN 'guest' WHEN 'service_provider' THEN 'service_provider' ELSE NULL END::public.home_role_base;
  END IF;
  IF v_target_role IS NULL AND NOT v_self THEN
    RETURN jsonb_build_object('ok',false,'code','MEMBER_ROLE_UNKNOWN','status',409);
  END IF;
  v_target_owner := coalesce(v_home.owner_id=p_target_id,false) OR v_target_role='owner'
    OR EXISTS (SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user'
      AND subject_id=p_target_id AND owner_status='verified');
  IF NOT v_self AND (v_actor_role IS DISTINCT FROM 'owner')
    AND (v_target_owner OR public.home_role_rank(v_target_role)>=public.home_role_rank(v_actor_role)) THEN
    RETURN jsonb_build_object('ok',false,'code','TARGET_RANK_FORBIDDEN','status',403);
  END IF;

  IF NOT v_self AND v_target_owner THEN
    RETURN '{"ok":false,"code":"OWNERSHIP_FLOW_REQUIRED","status":409}'::jsonb; END IF;
  v_stale_pointer:=v_self AND coalesce(v_home.owner_id=p_target_id,false)
    AND EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user'
      AND subject_id=p_target_id AND owner_status IN ('revoked','disputed'))
    AND NOT EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user'
      AND subject_id=p_target_id AND owner_status='verified');
  IF v_self AND ((v_home.owner_id=p_target_id AND NOT v_stale_pointer) OR EXISTS(SELECT FROM public."HomeOwner"
    WHERE home_id=p_home_id AND subject_type='user' AND subject_id=p_target_id
      AND owner_status='verified' AND is_primary_owner)) THEN
    RETURN '{"ok":false,"code":"TRANSFER_REQUIRED","status":409}'::jsonb; END IF;
  v_terminal:=public.home_member_removal_terminal(v_target,v_now);
  v_ownership_cleanup:=v_self AND (v_stale_pointer OR EXISTS(SELECT FROM public."HomeOwner"
    WHERE home_id=p_home_id AND subject_type='user' AND subject_id=p_target_id
      AND NOT is_primary_owner AND owner_status IS DISTINCT FROM 'revoked') OR
    (v_home.vacancy_at IS NULL AND NOT EXISTS(SELECT FROM (
      SELECT user_id FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id<>p_target_id
      UNION SELECT subject_id FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user' AND owner_status='verified' AND subject_id<>p_target_id
      UNION SELECT owner_id FROM public."Home" WHERE id=p_home_id AND owner_id IS NOT NULL AND owner_id<>p_target_id
    ) remaining WHERE public.home_has_role_at_least(p_home_id,'manager',remaining.user_id)
      AND NOT EXISTS(SELECT FROM public."HomeOccupancy" o WHERE o.home_id=p_home_id AND o.user_id=remaining.user_id
        AND (o.start_at>v_now OR o.end_at<=v_now OR o.access_start_at>v_now OR o.access_end_at<=v_now)))));
  SELECT jsonb_build_object('id',id,'name',NULL,'username',username) INTO v_profile FROM public."User" WHERE id=p_target_id;
  IF v_profile IS NULL OR v_target.is_active IS NULL THEN
    RETURN '{"ok":false,"code":"MEMBER_NOT_FOUND","status":404}'::jsonb; END IF;
  v_home_view:=jsonb_build_object('id',v_home.id,'name',v_home.name);
  v_target_view:=v_profile||jsonb_build_object('role_base',v_target_role,'is_self',v_self,
    'is_active',v_target.is_active,'verification_status',v_target.verification_status,
    'start_at',v_target.start_at,'end_at',v_target.end_at,'access_start_at',v_target.access_start_at,'access_end_at',v_target.access_end_at);
  v_hash:=encode(sha256(convert_to(jsonb_build_object('version',1,'actor_id',p_actor_id,
    'occupancy',to_jsonb(v_target)-ARRAY['updated_at','density_milestone_seen'],
    'target',v_target_view,'home',v_home_view,'owner_id',v_home.owner_id,'security_state',v_home.security_state,
    'vacancy_at',v_home.vacancy_at,'target_owners',(SELECT coalesce(jsonb_agg(to_jsonb(o) ORDER BY id),'[]')
      FROM public."HomeOwner"o WHERE home_id=p_home_id AND subject_type='user' AND subject_id=p_target_id))::text,'UTF8')),'hex');
  RETURN jsonb_build_object('ok',true,'home_id',p_home_id,'target_user_id',p_target_id,'occupancy_id',v_target.id,
    'action','remove','decision_token',v_hash,'home',v_home_view,'target',v_target_view,
    'terminal',v_terminal,'ownership_cleanup',v_ownership_cleanup,'stale_pointer',v_stale_pointer);
END $$;

CREATE FUNCTION public.apply_home_member_removal(p_home_id uuid,p_actor_id uuid,p_target_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE r jsonb; o public."HomeOccupancy"%ROWTYPE; t timestamptz; terminal boolean;
  changed boolean:=false; n integer; notify_ids uuid[]:='{}'::uuid[];
BEGIN
  r:=public.home_member_removal_context(p_home_id,p_actor_id,p_target_id);
  IF r->>'ok' IS DISTINCT FROM 'true' THEN RETURN r; END IF;
  SELECT * INTO STRICT o FROM public."HomeOccupancy" WHERE id=(r->>'occupancy_id')::uuid;
  terminal:=(r->>'terminal')::boolean;t:=clock_timestamp();
  -- This marker concerns the completed membership removal, not the absence of
  -- later separately issued access. A retry must never sweep those later rows.
  IF NOT terminal THEN
    UPDATE public."HomeOccupancy" SET is_active=false,end_at=CASE WHEN end_at IS NULL OR NOT isfinite(end_at) THEN t ELSE least(end_at,t) END,
      verification_status=CASE WHEN p_actor_id=p_target_id THEN 'moved_out' ELSE 'inactive' END,
      can_manage_home=false,can_manage_access=false,can_manage_finance=false,
      can_manage_tasks=false,can_view_sensitive=false,updated_at=t WHERE id=o.id;
    changed:=true;
    DELETE FROM public."HomePermissionOverride" WHERE home_id=p_home_id AND user_id=p_target_id;
    UPDATE public."HomeScopedGrant" SET end_at=t,updated_at=t
      WHERE home_id=p_home_id AND grantee_user_id=p_target_id AND (end_at IS NULL OR end_at>t);
    UPDATE public."ResidencyLetter" SET status='revoked',revoked_at=t,revoke_reason='residency_ended'
      WHERE home_id=p_home_id AND user_id=p_target_id AND status='issued';
  END IF;
  IF p_actor_id=p_target_id AND (r->>'ownership_cleanup')::boolean THEN
    IF (r->>'stale_pointer')::boolean THEN
      UPDATE public."Home" SET owner_id=NULL,updated_at=t WHERE id=p_home_id AND owner_id=p_target_id;
      GET DIAGNOSTICS n=ROW_COUNT;changed:=changed OR n>0;
    END IF;
    UPDATE public."HomeOwner" SET owner_status='revoked',updated_at=t
      WHERE home_id=p_home_id AND subject_type='user' AND subject_id=p_target_id
        AND NOT is_primary_owner AND owner_status IS DISTINCT FROM 'revoked';
    GET DIAGNOSTICS n=ROW_COUNT;changed:=changed OR n>0;
    IF NOT EXISTS(SELECT FROM (
      SELECT user_id FROM public."HomeOccupancy" WHERE home_id=p_home_id
      UNION SELECT subject_id FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user' AND owner_status='verified'
      UNION SELECT owner_id FROM public."Home" WHERE id=p_home_id AND owner_id IS NOT NULL
    ) remaining WHERE public.home_has_role_at_least(p_home_id,'manager',remaining.user_id)
      AND NOT EXISTS(SELECT FROM public."HomeOccupancy" x WHERE x.home_id=p_home_id AND x.user_id=remaining.user_id
        AND (x.start_at>t OR x.end_at<=t OR x.access_start_at>t OR x.access_end_at<=t))) THEN
      UPDATE public."Home" SET vacancy_at=t,updated_at=t WHERE id=p_home_id AND vacancy_at IS NULL;
      GET DIAGNOSTICS n=ROW_COUNT;changed:=changed OR n>0;
    END IF;
  END IF;
  IF changed THEN
    INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
      VALUES(p_home_id,p_actor_id,'member_remove','HomeOccupancy',o.id,
        jsonb_build_object('user_id',p_target_id,'role_base',NULL,'preset_key',NULL,'permission',NULL,'allowed',NULL));
    IF NOT terminal AND p_actor_id=p_target_id AND o.is_active THEN
      SELECT coalesce(array_agg(user_id),'{}'::uuid[]) INTO notify_ids FROM public."HomeOccupancy"
        WHERE home_id=p_home_id AND user_id<>p_target_id AND public.home_is_active_member(p_home_id,user_id)
          AND (start_at IS NULL OR start_at<=t) AND (end_at IS NULL OR end_at>t)
          AND (access_start_at IS NULL OR access_start_at<=t) AND (access_end_at IS NULL OR access_end_at>t);
    END IF;
  END IF;
  RETURN jsonb_build_object('ok',true,'code','MEMBER_UPDATED','role_base',NULL,'preset_key',NULL,'permission',NULL,'allowed',NULL,
    'changed',changed,'completed_at',CASE WHEN changed THEN t ELSE NULL END,'occupancy_id',o.id,
    'notify_user_ids',notify_ids,'reconciled_stale_occupancy',p_actor_id=p_target_id AND NOT o.is_active);
END $$;

-- Role and permission mutations retain their accepted policy and effects.
CREATE OR REPLACE FUNCTION public.mutate_home_member(
  p_home_id uuid, p_actor_id uuid, p_target_id uuid, p_action text, p_payload jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
SET lock_timeout = '5s' AS $$
DECLARE
  v_home public."Home"%ROWTYPE; v_target public."HomeOccupancy"%ROWTYPE;
  v_actor jsonb; v_actor_role public.home_role_base; v_target_role public.home_role_base;
  v_new_role public.home_role_base; v_preset public."HomeRolePreset"%ROWTYPE;
  v_permission public.home_permission; v_allowed boolean; v_self boolean;
  v_target_owner boolean; v_before text[]; v_after text[]; v_actor_perms text[];
  v_access jsonb; v_now timestamptz := clock_timestamp(); v_grant public.home_permission;
  v_notify uuid[] := '{}'::uuid[];
BEGIN
  IF p_home_id IS NULL OR p_actor_id IS NULL OR p_target_id IS NULL
    OR p_action NOT IN ('role','override','remove') OR p_action IS NULL
    OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
    RETURN jsonb_build_object('ok',false,'code','INVALID_AUTHORITY_REQUEST','status',400);
  END IF;
  SELECT * INTO v_home FROM public."Home" WHERE id=p_home_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','HOME_NOT_FOUND','status',404); END IF;
  LOCK TABLE public."HomeRolePermission", public."HomeRolePreset" IN SHARE MODE;
  PERFORM id FROM public."HomeOccupancy" WHERE home_id=p_home_id ORDER BY id FOR UPDATE;
  PERFORM id FROM public."HomeOwner" WHERE home_id=p_home_id ORDER BY id FOR UPDATE;
  PERFORM user_id FROM public."HomePermissionOverride" WHERE home_id=p_home_id ORDER BY user_id,permission FOR UPDATE;
  -- now() remains the transaction start across lock waits. Authority must still
  -- be current when this mutation is admitted, including an expiring actor.
  v_now := clock_timestamp();
  v_self := p_actor_id=p_target_id;
  IF NOT (p_action='remove' AND v_self) AND (
    v_home.security_state IN ('frozen','frozen_silent') OR EXISTS (
      SELECT FROM public."HomeOccupancy" o WHERE o.home_id=p_home_id AND o.user_id=p_actor_id
        AND (o.start_at>v_now OR o.end_at<=v_now OR o.access_start_at>v_now OR o.access_end_at<=v_now))) THEN
    RETURN jsonb_build_object('ok',false,'code','MEMBERS_MANAGE_REQUIRED','status',403);
  END IF;
  v_actor := public.home_effective_access(p_home_id,p_actor_id);
  -- A revoked ownership proof cannot leave implicit owner powers behind via a
  -- stale pointer/role. Historical revoked rows may coexist with a current
  -- verified owner; a former owner with independently granted admin rights also
  -- keeps those bounded rights rather than inheriting implicit ownership.
  IF NOT (p_action='remove' AND v_self) AND v_actor->>'is_owner'='true'
    AND EXISTS (SELECT FROM public."HomeOwner" o WHERE o.home_id=p_home_id AND o.subject_type='user'
      AND o.subject_id=p_actor_id AND o.owner_status IN ('revoked','disputed'))
    AND NOT EXISTS (SELECT FROM public."HomeOwner" o WHERE o.home_id=p_home_id AND o.subject_type='user'
      AND o.subject_id=p_actor_id AND o.owner_status='verified') THEN
    RETURN jsonb_build_object('ok',false,'code','MEMBERS_MANAGE_REQUIRED','status',403);
  END IF;
  v_actor_role := (v_actor->>'effective_role_base')::public.home_role_base;
  SELECT ARRAY(SELECT jsonb_array_elements_text(v_actor->'permissions')) INTO v_actor_perms;
  IF NOT (p_action='remove' AND v_self) AND NOT ('members.manage'=ANY(v_actor_perms)) THEN
    RETURN jsonb_build_object('ok',false,'code','MEMBERS_MANAGE_REQUIRED','status',403);
  END IF;
  SELECT * INTO v_target FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_target_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','MEMBER_NOT_FOUND','status',404); END IF;
  v_target_role := v_target.role_base;
  IF v_target_role IS NULL THEN
    v_target_role := CASE v_target.role
      WHEN 'owner' THEN 'owner' WHEN 'admin' THEN 'admin' WHEN 'manager' THEN 'manager'
      WHEN 'property_manager' THEN 'manager' WHEN 'tenant' THEN 'lease_resident'
      WHEN 'renter' THEN 'lease_resident' WHEN 'lease_resident' THEN 'lease_resident'
      WHEN 'member' THEN 'member' WHEN 'family' THEN 'member' WHEN 'roommate' THEN 'member'
      WHEN 'restricted_member' THEN 'restricted_member' WHEN 'caregiver' THEN 'restricted_member'
      WHEN 'guest' THEN 'guest' WHEN 'service_provider' THEN 'service_provider' ELSE NULL END::public.home_role_base;
  END IF;
  IF v_target_role IS NULL AND NOT (p_action='remove' AND v_self) THEN
    RETURN jsonb_build_object('ok',false,'code','MEMBER_ROLE_UNKNOWN','status',409);
  END IF;
  v_target_owner := coalesce(v_home.owner_id=p_target_id,false) OR v_target_role='owner'
    OR EXISTS (SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user'
      AND subject_id=p_target_id AND owner_status='verified');
  IF NOT v_self AND (v_actor_role IS DISTINCT FROM 'owner')
    AND (v_target_owner OR public.home_role_rank(v_target_role)>=public.home_role_rank(v_actor_role)) THEN
    RETURN jsonb_build_object('ok',false,'code','TARGET_RANK_FORBIDDEN','status',403);
  END IF;

  IF p_action='remove' THEN
    RETURN public.apply_home_member_removal(p_home_id,p_actor_id,p_target_id);
  ELSIF p_action='override' THEN
    IF (SELECT count(*) FROM jsonb_object_keys(p_payload))<>2
      OR NOT (p_payload ? 'permission' AND p_payload ? 'allowed')
      OR jsonb_typeof(p_payload->'allowed')<>'boolean' THEN
      RETURN jsonb_build_object('ok',false,'code','INVALID_AUTHORITY_REQUEST','status',400);
    END IF;
    BEGIN v_permission:=(p_payload->>'permission')::public.home_permission;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN jsonb_build_object('ok',false,'code','INVALID_PERMISSION','status',400);
    END;
    v_allowed := (p_payload->>'allowed')::boolean;
    IF v_permission IS NULL THEN RETURN jsonb_build_object('ok',false,'code','INVALID_PERMISSION','status',400); END IF;
    IF v_allowed AND (v_self OR NOT (v_permission::text=ANY(v_actor_perms))
      OR NOT public.home_authority_age_allows(v_target.age_band,v_permission)) THEN
      RETURN jsonb_build_object('ok',false,'code','PERMISSION_DELEGATION_FORBIDDEN','status',403);
    END IF;
    INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed,created_by)
      VALUES(p_home_id,p_target_id,v_permission,v_allowed,p_actor_id)
      ON CONFLICT(home_id,user_id,permission) DO UPDATE SET allowed=EXCLUDED.allowed,created_by=p_actor_id,updated_at=v_now;
  ELSE
    IF EXISTS (SELECT FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('role_base','preset_key','start_at','end_at'))
      OR ((p_payload->>'role_base') IS NULL)=((p_payload->>'preset_key') IS NULL) THEN
      RETURN jsonb_build_object('ok',false,'code','INVALID_AUTHORITY_REQUEST','status',400);
    END IF;
    -- A role change cannot renew expired access or erase the existing schedule.
    IF (p_payload ? 'start_at' AND (p_payload->>'start_at')::timestamptz IS DISTINCT FROM v_target.start_at)
      OR (p_payload ? 'end_at' AND (p_payload->>'end_at')::timestamptz IS DISTINCT FROM v_target.end_at) THEN
      RETURN jsonb_build_object('ok',false,'code','ACCESS_WINDOW_CHANGE_FORBIDDEN','status',403);
    END IF;
    IF p_payload->>'preset_key' IS NOT NULL THEN
      SELECT * INTO v_preset FROM public."HomeRolePreset" WHERE key=p_payload->>'preset_key';
      IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','UNKNOWN_PRESET','status',400); END IF;
      v_new_role:=v_preset.role_base;
    ELSE
      BEGIN v_new_role:=(p_payload->>'role_base')::public.home_role_base;
      EXCEPTION WHEN invalid_text_representation THEN
        RETURN jsonb_build_object('ok',false,'code','INVALID_ROLE','status',400);
      END;
    END IF;
    IF v_self OR v_target_owner OR v_new_role='owner' THEN
      RETURN jsonb_build_object('ok',false,'code','OWNERSHIP_OR_SELF_ROLE_CHANGE_FORBIDDEN','status',403);
    END IF;
    IF (v_actor_role<>'owner' AND public.home_role_rank(v_new_role)>=public.home_role_rank(v_actor_role))
      OR (v_target.age_band='child' AND public.home_role_rank(v_new_role)>20)
      OR (v_target.age_band='teen' AND public.home_role_rank(v_new_role)>30) THEN
      RETURN jsonb_build_object('ok',false,'code','PROPOSED_ROLE_FORBIDDEN','status',403);
    END IF;
    v_before:=public.home_member_policy_permissions(p_home_id,p_target_id,v_target_role,v_target.age_band);
    v_after:=public.home_member_policy_permissions(p_home_id,p_target_id,v_new_role,v_target.age_band,v_preset.key);
    IF EXISTS (SELECT FROM unnest(v_after) permission
      WHERE NOT (permission=ANY(v_before)) AND NOT (permission=ANY(v_actor_perms)))
      OR EXISTS (SELECT FROM unnest(v_preset.grant_perms) permission
        WHERE NOT (permission::text=ANY(v_actor_perms)) OR NOT public.home_authority_age_allows(v_target.age_band,permission)) THEN
      RETURN jsonb_build_object('ok',false,'code','PERMISSION_DELEGATION_FORBIDDEN','status',403);
    END IF;
    UPDATE public."HomeOccupancy" SET role_base=v_new_role,role=v_new_role::text,updated_at=v_now WHERE id=v_target.id;
    -- Presets add their exact changes. Existing explicit denies are never erased.
    FOREACH v_grant IN ARRAY coalesce(v_preset.grant_perms,'{}'::public.home_permission[]) LOOP
      INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed,created_by)
        VALUES(p_home_id,p_target_id,v_grant,true,p_actor_id)
        ON CONFLICT(home_id,user_id,permission) DO NOTHING;
    END LOOP;
    FOREACH v_grant IN ARRAY coalesce(v_preset.deny_perms,'{}'::public.home_permission[]) LOOP
      INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed,created_by)
        VALUES(p_home_id,p_target_id,v_grant,false,p_actor_id)
        ON CONFLICT(home_id,user_id,permission) DO UPDATE SET allowed=false,created_by=p_actor_id,updated_at=v_now;
    END LOOP;
  END IF;
  IF p_action<>'remove' THEN
    v_access:=public.home_effective_access(p_home_id,p_target_id);
    UPDATE public."HomeOccupancy" SET
      can_manage_home=(v_access->'permissions') ? 'home.edit',
      can_manage_access=(v_access->'permissions') ?| ARRAY['access.manage','members.manage'],
      can_manage_finance=(v_access->'permissions') ? 'finance.manage',
      can_manage_tasks=(v_access->'permissions') ?| ARRAY['tasks.edit','tasks.manage'],
      can_view_sensitive=(v_access->'permissions') ? 'sensitive.view' WHERE id=v_target.id;
  END IF;
  INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
    VALUES(p_home_id,p_actor_id,'member_'||p_action,'HomeOccupancy',v_target.id,
      jsonb_build_object('user_id',p_target_id,'role_base',v_new_role,'preset_key',v_preset.key,'permission',v_permission,'allowed',v_allowed));
  RETURN jsonb_build_object('ok',true,'code','MEMBER_UPDATED','role_base',v_new_role,
    'preset_key',v_preset.key,'permission',v_permission,'allowed',v_allowed,
    'notify_user_ids',v_notify,'reconciled_stale_occupancy',p_action='remove' AND v_self AND NOT v_target.is_active);
END;
$$;

CREATE TABLE public."HomeMemberRemovalCommand" (
  actor_user_id uuid NOT NULL, request_id uuid NOT NULL, home_id uuid NOT NULL,
  target_user_id uuid NOT NULL, occupancy_id uuid NOT NULL,
  action text NOT NULL CHECK(action='remove'),
  decision_token text NOT NULL CHECK(decision_token ~ '^[a-f0-9]{64}$'),
  intent_hash text NOT NULL CHECK(intent_hash ~ '^[a-f0-9]{64}$'),
  state text NOT NULL CHECK(state IN ('pending','completed','rejected','cancelled')),
  completed_at timestamptz, error_code text, error_status integer,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(actor_user_id,request_id),
  CHECK((state='completed')=(completed_at IS NOT NULL)),
  CHECK((state='rejected')=(error_code IS NOT NULL AND error_status IS NOT NULL)),
  CHECK((error_code IS NULL)=(error_status IS NULL)),
  CHECK(error_status IS NULL OR error_status IN (403,404,409)),
  CHECK(error_code IS NULL OR error_code ~ '^[A-Z][A-Z0-9_]{1,79}$')
);
-- History intentionally survives Home/occupancy deletion. It stores no target
-- name, address, permission snapshot, credentials or bearer session identity.
ALTER TABLE public."HomeMemberRemovalCommand" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."HomeMemberRemovalCommand" FROM PUBLIC,anon,authenticated;
GRANT ALL ON public."HomeMemberRemovalCommand" TO service_role;

CREATE FUNCTION public.home_member_removal_projection(c public."HomeMemberRemovalCommand")
RETURNS jsonb LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
  SELECT jsonb_build_object('ok',true,'state',c.state,'home_id',c.home_id,'target_user_id',c.target_user_id,
    'occupancy_id',c.occupancy_id,'action',c.action,'decision_token',c.decision_token,'completed_at',c.completed_at,
    'code',c.error_code,'status',c.error_status,'command',jsonb_build_object('actor_id',c.actor_user_id,
      'request_id',c.request_id,'created_at',c.created_at,'updated_at',c.updated_at));
$$;
CREATE FUNCTION public.prepare_home_member_removal(p_actor_id uuid,p_home_id uuid,p_target_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE r jsonb;
BEGIN
  IF p_actor_id IS NULL THEN RETURN '{"ok":false,"code":"MEMBER_REMOVAL_INVALID","status":400}'::jsonb; END IF;
  PERFORM 1 FROM public."User" WHERE id=p_actor_id FOR SHARE;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"MEMBER_REMOVAL_ACCOUNT_UNAVAILABLE","status":403}'::jsonb; END IF;
  r:=public.home_member_removal_context(p_home_id,p_actor_id,p_target_id);
  IF r->>'ok' IS DISTINCT FROM 'true' THEN RETURN r; END IF;
  IF (r->>'terminal')::boolean AND NOT (r->>'ownership_cleanup')::boolean THEN
    RETURN '{"ok":false,"code":"MEMBER_ALREADY_REMOVED","status":409}'::jsonb; END IF;
  RETURN r-ARRAY['terminal','ownership_cleanup','stale_pointer'];
END $$;
CREATE FUNCTION public.get_home_member_removal(p_actor_id uuid,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE c public."HomeMemberRemovalCommand"%ROWTYPE;
BEGIN
  IF p_actor_id IS NULL OR p_request_id IS NULL THEN
    RETURN '{"ok":false,"code":"MEMBER_REMOVAL_INVALID","status":400}'::jsonb; END IF;
  PERFORM 1 FROM public."User" WHERE id=p_actor_id FOR SHARE;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"MEMBER_REMOVAL_ACCOUNT_UNAVAILABLE","status":403}'::jsonb; END IF;
  SELECT * INTO c FROM public."HomeMemberRemovalCommand" WHERE actor_user_id=p_actor_id AND request_id=p_request_id;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"MEMBER_REMOVAL_NOT_FOUND","status":404}'::jsonb; END IF;
  RETURN public.home_member_removal_projection(c);
END $$;
CREATE FUNCTION public.resolve_home_member_removal(p_actor_id uuid,p_request_id uuid,p_intent jsonb,p_cancel boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE c public."HomeMemberRemovalCommand"%ROWTYPE; h text; r jsonb; applied jsonb;
  home_id uuid; target_id uuid; occupancy_id uuid; code text; status integer;
BEGIN
  IF p_actor_id IS NULL OR p_request_id IS NULL OR p_cancel IS NULL OR jsonb_typeof(p_intent) IS DISTINCT FROM 'object'
    OR (SELECT count(*) FROM jsonb_object_keys(p_intent))<>5
    OR EXISTS(SELECT FROM jsonb_object_keys(p_intent) k WHERE k NOT IN ('home_id','target_user_id','occupancy_id','action','decision_token'))
    OR EXISTS(SELECT FROM unnest(ARRAY['home_id','target_user_id','occupancy_id','action','decision_token']) k WHERE jsonb_typeof(p_intent->k) IS DISTINCT FROM 'string')
    OR EXISTS(SELECT FROM unnest(ARRAY['home_id','target_user_id','occupancy_id']) k
      WHERE (p_intent->>k) !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$')
    OR p_intent->>'action'<>'remove' OR (p_intent->>'decision_token') !~ '^[a-f0-9]{64}$' THEN
    RETURN '{"ok":false,"code":"MEMBER_REMOVAL_INVALID","status":400}'::jsonb; END IF;
  home_id:=(p_intent->>'home_id')::uuid;target_id:=(p_intent->>'target_user_id')::uuid;occupancy_id:=(p_intent->>'occupancy_id')::uuid;
  h:=encode(sha256(convert_to(p_intent::text,'UTF8')),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended('home-member-removal:'||p_actor_id::text,0));
  PERFORM 1 FROM public."User" WHERE id=p_actor_id FOR SHARE;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"MEMBER_REMOVAL_ACCOUNT_UNAVAILABLE","status":403}'::jsonb; END IF;
  SELECT * INTO c FROM public."HomeMemberRemovalCommand" WHERE actor_user_id=p_actor_id AND request_id=p_request_id FOR UPDATE;
  IF FOUND THEN
    IF c.intent_hash<>h THEN RETURN '{"ok":false,"code":"MEMBER_REMOVAL_CONFLICT","status":409}'::jsonb; END IF;
    -- Immutable proof precedes every current Home/member/ownership/grant read.
    RETURN public.home_member_removal_projection(c)||'{"replayed":true}'::jsonb;
  END IF;
  INSERT INTO public."HomeMemberRemovalCommand"(actor_user_id,request_id,home_id,target_user_id,occupancy_id,action,decision_token,intent_hash,state)
    VALUES(p_actor_id,p_request_id,home_id,target_id,occupancy_id,'remove',p_intent->>'decision_token',h,
      CASE WHEN p_cancel THEN 'cancelled' ELSE 'pending' END) RETURNING * INTO c;
  IF p_cancel THEN RETURN public.home_member_removal_projection(c)||'{"replayed":false}'::jsonb; END IF;
  r:=public.home_member_removal_context(home_id,p_actor_id,target_id);
  IF r->>'ok'='true' THEN
    IF r->>'occupancy_id'<>occupancy_id::text OR r->>'decision_token'<>p_intent->>'decision_token' THEN
      r:='{"ok":false,"code":"MEMBER_REMOVAL_CHANGED","status":409}'::jsonb;
    ELSIF (r->>'terminal')::boolean AND NOT (r->>'ownership_cleanup')::boolean THEN
      r:='{"ok":false,"code":"MEMBER_ALREADY_REMOVED","status":409}'::jsonb;
    ELSE
      applied:=public.apply_home_member_removal(home_id,p_actor_id,target_id);
      IF applied->>'ok' IS DISTINCT FROM 'true' THEN r:=applied;
      ELSIF applied->>'occupancy_id'<>occupancy_id::text OR applied->'changed'<>'true'::jsonb OR applied->>'completed_at' IS NULL THEN
        RAISE EXCEPTION 'Removal command effect mismatch';
      END IF;
    END IF;
  END IF;
  IF r->>'ok' IS DISTINCT FROM 'true' THEN
    code:=r->>'code';status:=(r->>'status')::integer;
    IF (code,status) NOT IN (('MEMBER_REMOVAL_CHANGED',409),('MEMBER_ALREADY_REMOVED',409),
      ('MEMBERS_MANAGE_REQUIRED',403),('TARGET_RANK_FORBIDDEN',403),('OWNERSHIP_FLOW_REQUIRED',409),
      ('TRANSFER_REQUIRED',409),('MEMBER_ROLE_UNKNOWN',409),('MEMBER_NOT_FOUND',404),('HOME_NOT_FOUND',404))
      OR code IS NULL OR status IS NULL THEN RAISE EXCEPTION 'Removal policy unavailable'; END IF;
    UPDATE public."HomeMemberRemovalCommand" SET state='rejected',error_code=code,error_status=status,updated_at=clock_timestamp()
      WHERE actor_user_id=p_actor_id AND request_id=p_request_id RETURNING * INTO c;
  ELSE
    UPDATE public."HomeMemberRemovalCommand" SET state='completed',completed_at=(applied->>'completed_at')::timestamptz,updated_at=clock_timestamp()
      WHERE actor_user_id=p_actor_id AND request_id=p_request_id RETURNING * INTO c;
  END IF;
  -- Transient first-success admission candidates only. Never store these in
  -- history or return them on retry/read/cancel; the service rechecks current
  -- membership immediately before best-effort generic notice admission.
  RETURN public.home_member_removal_projection(c)||'{"replayed":false}'::jsonb
    ||CASE WHEN c.state='completed' AND p_actor_id=target_id
      THEN jsonb_build_object('_notify_user_ids',coalesce(applied->'notify_user_ids','[]'::jsonb))
      ELSE '{}'::jsonb END;
END $$;

REVOKE ALL ON FUNCTION public.home_member_removal_terminal(public."HomeOccupancy",timestamptz),
  public.home_member_removal_context(uuid,uuid,uuid),public.apply_home_member_removal(uuid,uuid,uuid),
  public.home_member_removal_projection(public."HomeMemberRemovalCommand"),
  public.prepare_home_member_removal(uuid,uuid,uuid),public.get_home_member_removal(uuid,uuid),
  public.resolve_home_member_removal(uuid,uuid,jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.home_member_removal_terminal(public."HomeOccupancy",timestamptz),
  public.home_member_removal_context(uuid,uuid,uuid),public.apply_home_member_removal(uuid,uuid,uuid),
  public.home_member_removal_projection(public."HomeMemberRemovalCommand"),
  public.prepare_home_member_removal(uuid,uuid,uuid),public.get_home_member_removal(uuid,uuid),
  public.resolve_home_member_removal(uuid,uuid,jsonb,boolean) TO service_role;
