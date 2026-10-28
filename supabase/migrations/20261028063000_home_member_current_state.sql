-- Backwards compatible: yes. Preserve member commands and self-removal while
-- denying management after a Home is disputed, archived, or merged. Read the
-- current Home state under the existing authority lock; no new tables.
SET LOCAL lock_timeout = '5s';

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
    v_home.home_status IN ('archived','merged')
    OR v_home.security_state IN ('frozen','frozen_silent','disputed') OR EXISTS (
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
    AND (v_target_owner OR public.home_role_rank(v_target_role)
      >=public.home_member_rank_ceiling(p_home_id,p_actor_id,v_actor_role,v_target.verification_source)) THEN
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
    IF (v_actor_role<>'owner' AND public.home_role_rank(v_new_role)
      >=public.home_member_rank_ceiling(p_home_id,p_actor_id,v_actor_role,v_target.verification_source))
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

REVOKE ALL ON FUNCTION public.mutate_home_member(uuid,uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mutate_home_member(uuid,uuid,uuid,text,jsonb) TO service_role;
