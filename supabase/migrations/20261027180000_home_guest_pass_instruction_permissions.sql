-- Backwards compatible: yes. Keep guest-pass DTOs, request-id rotation and revocation.
-- Entry and parking instructions use access.view_codes on Home detail reads;
-- members.manage must not let an issuer recover them through a bearer pass.
-- Recheck the same permission on existing pass reads so revocation takes effect.
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.mutate_home_external_share(p_home_id uuid,p_actor_id uuid,p_kind text,
  p_action text,p_share_id uuid DEFAULT NULL,p_payload jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE v_now timestamptz; v_start timestamptz; v_end timestamptz; v_hours numeric;
  v_need text; v_kind text; v_sections jsonb; v_bindings jsonb:='{}'::jsonb; v_ids jsonb; v_id uuid;
  v_section text; v_resource jsonb; v_row jsonb; v_share uuid; v_issuer uuid; v_grantee uuid;
  v_revoked timestamptz; v_max integer; v_permission jsonb; v_request uuid; v_existing_end timestamptz;
BEGIN
  IF p_actor_id IS NULL OR p_kind NOT IN ('guest','scoped') OR p_kind IS NULL
    OR p_action NOT IN ('create','revoke','list') OR p_action IS NULL
    OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
    OR (p_action='create' AND p_share_id IS NOT NULL) OR (p_action='revoke' AND p_share_id IS NULL) THEN
    RETURN '{"ok":false,"code":"SHARE_INVALID","status":400}'::jsonb; END IF;
  IF NOT public.lock_home_external_share(p_home_id) THEN RETURN '{"ok":false,"code":"HOME_NOT_FOUND","status":404}'::jsonb; END IF;
  v_need:=CASE p_kind WHEN 'guest' THEN 'members.manage' ELSE 'home.edit' END;
  v_permission:=public.home_external_share_context(p_home_id,p_actor_id)->'permissions';
  IF p_action='revoke' THEN
    IF p_kind='guest' THEN
      SELECT id,created_by,revoked_at INTO v_share,v_issuer,v_revoked FROM public."HomeGuestPass"
        WHERE id=p_share_id AND home_id=p_home_id FOR UPDATE;
    ELSE
      SELECT id,created_by,revoked_at INTO v_share,v_issuer,v_revoked FROM public."HomeScopedGrant"
        WHERE id=p_share_id AND home_id=p_home_id FOR UPDATE;
    END IF;
    IF v_share IS NULL THEN RETURN '{"ok":false,"code":"SHARE_NOT_FOUND","status":404}'::jsonb; END IF;
    -- An exact issuer can always reduce their old grant, including after exit.
    IF v_issuer IS DISTINCT FROM p_actor_id
      AND NOT coalesce((public.home_external_share_context(p_home_id,p_actor_id)->'permissions') ? v_need,false) THEN
      RETURN '{"ok":false,"code":"SHARE_DENIED","status":403}'::jsonb; END IF;
    v_now:=clock_timestamp();
    IF v_revoked IS NULL THEN
      IF p_kind='guest' THEN UPDATE public."HomeGuestPass" SET revoked_at=v_now,updated_at=v_now WHERE id=v_share;
      ELSE UPDATE public."HomeScopedGrant" SET revoked_at=v_now,end_at=least(coalesce(end_at,v_now),v_now),updated_at=v_now WHERE id=v_share; END IF;
      INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id)
        VALUES(p_home_id,p_actor_id,CASE p_kind WHEN 'guest' THEN 'guest_pass_revoked' ELSE 'scoped_grant_revoked' END,
          CASE p_kind WHEN 'guest' THEN 'HomeGuestPass' ELSE 'HomeScopedGrant' END,v_share);
    END IF;
    v_row:=jsonb_build_object('id',v_share,'home_id',p_home_id,'revoked_at',coalesce(v_revoked,v_now));
    IF p_kind='guest' THEN
      -- Retain required native DTO strings even when an exited issuer can only
      -- revoke. Such a response must not disclose current pass metadata.
      v_row:=v_row||jsonb_build_object('label','','kind','guest');
      IF (public.home_external_share_context(p_home_id,p_actor_id)->'permissions') ? v_need THEN
        SELECT to_jsonb(s)-ARRAY['token_hash','passcode_hash','resource_bindings'] INTO v_row
          FROM public."HomeGuestPass" s WHERE id=v_share;
      END IF;
    END IF;
    RETURN jsonb_build_object('ok',true,'record',v_row,'replayed',v_revoked IS NOT NULL);
  END IF;
  IF NOT coalesce(v_permission ? v_need,false) OR (p_kind='guest' AND NOT v_permission ? 'home.view') THEN
    RETURN '{"ok":false,"code":"SHARE_DENIED","status":403}'::jsonb; END IF;
  IF p_action='list' THEN
    IF p_kind<>'guest' THEN RETURN '{"ok":false,"code":"SHARE_INVALID","status":400}'::jsonb; END IF;
    SELECT coalesce(jsonb_agg((to_jsonb(s)-ARRAY['token_hash','passcode_hash','resource_bindings'])
      ||jsonb_build_object('status',CASE WHEN s.revoked_at IS NOT NULL THEN 'revoked'
        WHEN s.sharing_version IS DISTINCT FROM 1 THEN 'reissue_required'
        WHEN s.end_at<=clock_timestamp() OR s.view_count>=s.max_views THEN 'expired'
        WHEN s.start_at>clock_timestamp() THEN 'scheduled' ELSE 'active' END,
        'last_viewed_at',(SELECT max(viewed_at) FROM public."HomeGuestPassView" WHERE guest_pass_id=s.id))
      ORDER BY s.created_at DESC),'[]') INTO v_row FROM public."HomeGuestPass" s WHERE home_id=p_home_id
      AND (coalesce(p_payload->>'include_revoked','false')='true' OR s.revoked_at IS NULL);
    RETURN jsonb_build_object('ok',true,'records',v_row);
  END IF;
  IF EXISTS(SELECT FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('label','kind','included_sections','custom_title',
      'duration_hours','start_at','end_at','max_views','token_hash','passcode_hash','permissions','resource_type','resource_id',
      'can_edit','can_upload','permission_scope','grantee_user_id','request_id'))
    OR coalesce(p_payload->>'token_hash','') !~ '^[a-f0-9]{64}$'
    OR (p_payload->>'passcode_hash' IS NOT NULL AND p_payload->>'passcode_hash' !~ '^[a-f0-9]{64}$')
    OR (p_payload ? 'can_edit' AND p_payload->'can_edit'<>'false'::jsonb)
    OR (p_payload ? 'can_upload' AND p_payload->'can_upload'<>'false'::jsonb)
    OR (p_payload ? 'permissions' AND p_payload->'permissions'<>'{}'::jsonb)
    OR (p_payload ? 'permission_scope' AND p_payload->>'permission_scope'<>'view')
    OR (p_payload ? 'request_id' AND (p_kind<>'guest'
      OR coalesce(p_payload->>'request_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) THEN
    RETURN '{"ok":false,"code":"SHARE_INVALID","status":400}'::jsonb; END IF;
  -- A guest create that repeats an intent (same request_id from the same actor on this Home) updates that intent's
  -- pass instead of minting a second live link; the Home lock above serializes repeats, the unique index backs it.
  IF p_kind='guest' AND p_payload ? 'request_id' THEN
    v_request:=(p_payload->>'request_id')::uuid;
    SELECT id,revoked_at,end_at INTO v_share,v_revoked,v_existing_end FROM public."HomeGuestPass"
      WHERE home_id=p_home_id AND created_by=p_actor_id AND request_id=v_request FOR UPDATE;
    IF v_share IS NOT NULL AND v_revoked IS NOT NULL THEN RETURN '{"ok":false,"code":"SHARE_REVOKED","status":409}'::jsonb; END IF;
    IF v_share IS NOT NULL AND v_existing_end<=clock_timestamp() THEN RETURN '{"ok":false,"code":"SHARE_EXPIRED","status":409}'::jsonb; END IF;
  END IF;
  v_now:=clock_timestamp(); v_kind:=coalesce(p_payload->>'kind','guest');
  v_start:=coalesce((p_payload->>'start_at')::timestamptz,v_now);
  v_hours:=coalesce((p_payload->>'duration_hours')::numeric,CASE WHEN p_kind='scoped' THEN 24
    WHEN v_kind='wifi_only' THEN 2 WHEN v_kind='vendor' THEN 8 WHEN v_kind='guest' THEN 48
    ELSE (SELECT default_guest_pass_hours FROM public."Home" WHERE id=p_home_id) END,48);
  v_end:=coalesce((p_payload->>'end_at')::timestamptz,v_start+make_interval(secs=>(v_hours*3600)::double precision));
  v_max:=(p_payload->>'max_views')::integer; v_grantee:=(p_payload->>'grantee_user_id')::uuid;
  IF NOT isfinite(v_start) OR NOT isfinite(v_end) OR v_end<=v_start OR v_end<=v_now
    OR v_end-v_start>interval '365 days' OR v_start>v_now+interval '365 days'
    OR v_hours<=0 OR v_hours>8760 OR (v_max IS NOT NULL AND v_max NOT BETWEEN 1 AND 100000)
    OR (v_grantee IS NOT NULL AND NOT EXISTS(SELECT FROM public."User" WHERE id=v_grantee)) THEN
    RETURN '{"ok":false,"code":"SHARE_INVALID","status":400}'::jsonb; END IF;
  IF p_kind='guest' THEN
    IF v_grantee IS NOT NULL OR v_kind NOT IN ('wifi_only','guest','airbnb','vendor')
      OR coalesce(btrim(p_payload->>'label'),'')='' OR length(p_payload->>'label')>200
      OR length(p_payload->>'custom_title')>200 THEN RETURN '{"ok":false,"code":"SHARE_INVALID","status":400}'::jsonb; END IF;
    v_sections:=coalesce(p_payload->'included_sections',CASE v_kind
      WHEN 'wifi_only' THEN '["wifi","parking"]'::jsonb
      WHEN 'vendor' THEN '["entry_instructions","parking"]'::jsonb
      WHEN 'airbnb' THEN '["wifi","parking","house_rules","entry_instructions","trash_day","local_tips","emergency"]'::jsonb
      ELSE '["wifi","parking","house_rules","entry_instructions","emergency"]'::jsonb END);
    IF jsonb_typeof(v_sections)<>'array' OR jsonb_array_length(v_sections)>40
      OR jsonb_array_length(v_sections)=0 OR EXISTS(SELECT FROM jsonb_array_elements(v_sections) e WHERE jsonb_typeof(e)<>'string') THEN
      RETURN '{"ok":false,"code":"SHARE_INVALID","status":400}'::jsonb; END IF;
    FOR v_section IN SELECT DISTINCT jsonb_array_elements_text(v_sections) ORDER BY 1 LOOP
      v_ids:='[]';
      IF v_section='wifi' THEN
        IF NOT v_permission ? 'access.view_wifi' THEN RETURN '{"ok":false,"code":"SHARE_RESOURCE_DENIED","status":403}'::jsonb; END IF;
        FOR v_id IN SELECT id FROM public."HomeAccessSecret" WHERE home_id=p_home_id AND access_type='wifi'
          AND visibility IN ('public','members') ORDER BY id LOOP
          v_resource:=public.home_external_share_resource(p_home_id,p_actor_id,NULL,'HomeAccessSecret',v_id);
          IF v_resource IS NULL THEN RETURN '{"ok":false,"code":"SHARE_RESOURCE_DENIED","status":403}'::jsonb; END IF;
          v_ids:=v_ids||jsonb_build_array(v_id);
        END LOOP;
        v_bindings:=v_bindings||jsonb_build_object('wifi',v_ids);
      ELSIF v_section='emergency' THEN
        IF NOT v_permission ? 'home.view' THEN RETURN '{"ok":false,"code":"SHARE_RESOURCE_DENIED","status":403}'::jsonb; END IF;
        FOR v_id IN SELECT id FROM public."HomeEmergency" WHERE home_id=p_home_id ORDER BY id LOOP
          v_resource:=public.home_external_share_resource(p_home_id,p_actor_id,NULL,'HomeEmergency',v_id);
          IF v_resource IS NULL THEN RETURN '{"ok":false,"code":"SHARE_RESOURCE_DENIED","status":403}'::jsonb; END IF;
          v_ids:=v_ids||jsonb_build_array(v_id);
        END LOOP;
        v_bindings:=v_bindings||jsonb_build_object('emergency',v_ids);
      ELSIF v_section ~ '^doc:[a-fA-F0-9-]{36}$' THEN
        v_id:=substring(v_section FROM 5)::uuid;
        v_resource:=public.home_external_share_resource(p_home_id,p_actor_id,NULL,'HomeDocument',v_id);
        IF v_resource IS NULL THEN RETURN '{"ok":false,"code":"SHARE_RESOURCE_DENIED","status":403}'::jsonb; END IF;
        v_bindings:=jsonb_set(v_bindings,'{docs}',coalesce(v_bindings->'docs','[]')||jsonb_build_array(v_id));
      ELSIF v_section NOT IN ('parking','house_rules','entry_instructions','trash_day','local_tips') THEN
        RETURN '{"ok":false,"code":"SHARE_INVALID","status":400}'::jsonb;
      ELSIF NOT v_permission ? 'home.view' THEN RETURN '{"ok":false,"code":"SHARE_RESOURCE_DENIED","status":403}'::jsonb;
      ELSIF v_section IN ('entry_instructions','parking') AND NOT v_permission ? 'access.view_codes' THEN
        RETURN '{"ok":false,"code":"SHARE_RESOURCE_DENIED","status":403}'::jsonb;
      END IF;
    END LOOP;
    IF v_end<=clock_timestamp() OR NOT (public.home_external_share_context(p_home_id,p_actor_id)->'permissions') ? v_need THEN
      RETURN '{"ok":false,"code":"SHARE_DENIED","status":403}'::jsonb; END IF;
    IF v_share IS NOT NULL THEN
      -- The repeat carries this call's fresh token and the latest validated details. Only token_hash is stored, so the
      -- first reply's raw token can't be returned again: rotating it keeps exactly one live link, and the caller's.
      UPDATE public."HomeGuestPass" SET label=p_payload->>'label',kind=v_kind,token_hash=p_payload->>'token_hash',
        start_at=v_start,end_at=v_end,included_sections=v_sections,custom_title=p_payload->>'custom_title',
        passcode_hash=p_payload->>'passcode_hash',max_views=v_max,resource_bindings=v_bindings,updated_at=clock_timestamp()
        WHERE id=v_share RETURNING to_jsonb("HomeGuestPass")-ARRAY['token_hash','passcode_hash','resource_bindings'] INTO v_row;
      RETURN jsonb_build_object('ok',true,'record',v_row,'replayed',true);
    END IF;
    INSERT INTO public."HomeGuestPass"(home_id,label,kind,token_hash,permissions,start_at,end_at,created_by,
      included_sections,custom_title,passcode_hash,max_views,view_count,sharing_version,resource_bindings,request_id)
      VALUES(p_home_id,p_payload->>'label',v_kind,p_payload->>'token_hash','{}',v_start,v_end,p_actor_id,
        v_sections,p_payload->>'custom_title',p_payload->>'passcode_hash',v_max,0,1,v_bindings,v_request)
      RETURNING id,to_jsonb("HomeGuestPass")-ARRAY['token_hash','passcode_hash','resource_bindings'] INTO v_share,v_row;
  ELSE
    v_resource:=public.home_external_share_resource(p_home_id,p_actor_id,v_grantee,p_payload->>'resource_type',(p_payload->>'resource_id')::uuid);
    IF p_payload->>'resource_type' NOT IN ('HomeTask','HomeCalendarEvent','HomeDocument','HomeIssue','HomeAsset','HomePackage')
      OR v_resource IS NULL THEN RETURN '{"ok":false,"code":"SHARE_RESOURCE_DENIED","status":403}'::jsonb; END IF;
    IF v_end<=clock_timestamp() OR NOT (public.home_external_share_context(p_home_id,p_actor_id)->'permissions') ? v_need THEN
      RETURN '{"ok":false,"code":"SHARE_DENIED","status":403}'::jsonb; END IF;
    INSERT INTO public."HomeScopedGrant"(home_id,grantee_user_id,resource_type,resource_id,can_view,can_edit,can_upload,
      start_at,end_at,created_by,token_hash,passcode_hash,max_views,view_count,sharing_version)
      VALUES(p_home_id,v_grantee,p_payload->>'resource_type',(p_payload->>'resource_id')::uuid,true,false,false,
        v_start,v_end,p_actor_id,p_payload->>'token_hash',p_payload->>'passcode_hash',v_max,0,1)
      RETURNING id,to_jsonb("HomeScopedGrant")-ARRAY['token_hash','passcode_hash'] INTO v_share,v_row;
  END IF;
  INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id)
    VALUES(p_home_id,p_actor_id,CASE p_kind WHEN 'guest' THEN 'guest_pass_created' ELSE 'scoped_grant_created' END,
      CASE p_kind WHEN 'guest' THEN 'HomeGuestPass' ELSE 'HomeScopedGrant' END,v_share);
  RETURN jsonb_build_object('ok',true,'record',v_row);
END $$;

CREATE OR REPLACE FUNCTION public.inspect_home_external_share(p_kind text,p_share_id uuid,p_recipient_id uuid,
  p_passcode_hash text,p_consume boolean DEFAULT true,p_receipt boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE v_home_id uuid; v_pass jsonb; v_home public."Home"%ROWTYPE; v_now timestamptz;
  v_issuer uuid; v_permissions jsonb; v_need text; v_sections jsonb:='{}'::jsonb; v_array jsonb; v_resource jsonb;
  v_field text; v_id uuid; v_type text; v_documents uuid[]:='{}'::uuid[]; v_bindings jsonb; v_result jsonb;
BEGIN
  IF p_kind='guest' THEN SELECT home_id INTO v_home_id FROM public."HomeGuestPass" WHERE id=p_share_id;
  ELSIF p_kind='scoped' THEN SELECT home_id INTO v_home_id FROM public."HomeScopedGrant" WHERE id=p_share_id;
  ELSE RETURN '{"ok":false,"code":"SHARE_INVALID","status":400}'::jsonb; END IF;
  IF v_home_id IS NULL OR NOT public.lock_home_external_share(v_home_id) THEN
    RETURN '{"ok":false,"code":"SHARE_NOT_FOUND","status":404}'::jsonb; END IF;
  IF p_kind='guest' THEN
    SELECT to_jsonb(s) INTO v_pass FROM public."HomeGuestPass" s WHERE id=p_share_id AND home_id=v_home_id FOR UPDATE;
  ELSE
    SELECT to_jsonb(s) INTO v_pass FROM public."HomeScopedGrant" s WHERE id=p_share_id AND home_id=v_home_id FOR UPDATE;
  END IF;
  IF v_pass IS NULL THEN RETURN '{"ok":false,"code":"SHARE_NOT_FOUND","status":404}'::jsonb; END IF;
  IF v_pass->>'revoked_at' IS NOT NULL THEN RETURN '{"ok":false,"code":"SHARE_REVOKED","status":410}'::jsonb; END IF;
  IF v_pass->>'sharing_version' IS DISTINCT FROM '1' THEN RETURN '{"ok":false,"code":"SHARE_REISSUE_REQUIRED","status":410}'::jsonb; END IF;
  v_now:=clock_timestamp();
  IF v_pass->>'end_at' IS NULL OR (v_pass->>'end_at')::timestamptz<=v_now THEN
    RETURN '{"ok":false,"code":"SHARE_EXPIRED","status":410}'::jsonb; END IF;
  IF (v_pass->>'start_at')::timestamptz>v_now THEN RETURN '{"ok":false,"code":"SHARE_NOT_STARTED","status":403}'::jsonb; END IF;
  IF p_consume AND v_pass->>'max_views' IS NOT NULL
    AND coalesce((v_pass->>'view_count')::integer,0)>=(v_pass->>'max_views')::integer THEN
    RETURN '{"ok":false,"code":"SHARE_VIEW_LIMIT","status":410}'::jsonb; END IF;
  IF NOT p_receipt AND v_pass->>'passcode_hash' IS NOT NULL
    AND v_pass->>'passcode_hash' IS DISTINCT FROM p_passcode_hash THEN
    RETURN '{"ok":false,"code":"SHARE_PASSCODE_REQUIRED","status":403}'::jsonb; END IF;
  IF p_kind='scoped' AND (v_pass->>'can_view' IS DISTINCT FROM 'true'
    OR v_pass->>'can_edit' IS DISTINCT FROM 'false' OR v_pass->>'can_upload' IS DISTINCT FROM 'false'
    OR (v_pass->>'grantee_user_id' IS NOT NULL AND (v_pass->>'grantee_user_id')::uuid IS DISTINCT FROM p_recipient_id)) THEN
    RETURN '{"ok":false,"code":"SHARE_DENIED","status":403}'::jsonb; END IF;
  v_issuer:=(v_pass->>'created_by')::uuid;
  v_need:=CASE p_kind WHEN 'guest' THEN 'members.manage' ELSE 'home.edit' END;
  v_permissions:=public.home_external_share_context(v_home_id,v_issuer)->'permissions';
  IF NOT coalesce(v_permissions ? v_need,false) THEN RETURN '{"ok":false,"code":"SHARE_DENIED","status":403}'::jsonb; END IF;
  SELECT * INTO v_home FROM public."Home" WHERE id=v_home_id;
  IF p_kind='guest' THEN
    IF NOT v_permissions ? 'home.view' OR NOT public.home_external_share_recipient(v_home_id,p_recipient_id,'home.view')
      OR jsonb_typeof(v_pass->'resource_bindings') IS DISTINCT FROM 'object' THEN
      RETURN '{"ok":false,"code":"SHARE_DENIED","status":403}'::jsonb; END IF;
    v_bindings:=v_pass->'resource_bindings';
    FOR v_field IN SELECT jsonb_array_elements_text(v_pass->'included_sections') LOOP
      IF v_field IN ('wifi','emergency') THEN
        v_type:=CASE v_field WHEN 'wifi' THEN 'HomeAccessSecret' ELSE 'HomeEmergency' END;
        IF NOT v_permissions ? (CASE v_field WHEN 'wifi' THEN 'access.view_wifi' ELSE 'home.view' END)
          OR jsonb_typeof(v_bindings->v_field) IS DISTINCT FROM 'array' THEN
          RETURN '{"ok":false,"code":"SHARE_RESOURCE_DENIED","status":403}'::jsonb; END IF;
        v_array:='[]';
        FOR v_id IN SELECT value::uuid FROM jsonb_array_elements_text(v_bindings->v_field) ORDER BY value LOOP
          v_resource:=public.home_external_share_resource(v_home_id,v_issuer,p_recipient_id,v_type,v_id);
          IF v_resource IS NULL THEN RETURN '{"ok":false,"code":"SHARE_RESOURCE_DENIED","status":403}'::jsonb; END IF;
          v_array:=v_array||jsonb_build_array(v_resource);
        END LOOP;
        v_sections:=v_sections||jsonb_build_object(v_field,CASE WHEN v_field='wifi' AND jsonb_array_length(v_array)=1 THEN v_array->0 ELSE v_array END);
      ELSIF v_field LIKE 'doc:%' THEN
        v_id:=substring(v_field FROM 5)::uuid;
        IF NOT (v_bindings->'docs') @> jsonb_build_array(v_id) THEN RETURN '{"ok":false,"code":"SHARE_RESOURCE_DENIED","status":403}'::jsonb; END IF;
        v_resource:=public.home_external_share_resource(v_home_id,v_issuer,p_recipient_id,'HomeDocument',v_id);
        IF v_resource IS NULL THEN RETURN '{"ok":false,"code":"SHARE_RESOURCE_DENIED","status":403}'::jsonb; END IF;
        IF v_resource ? '_document' THEN v_documents:=array_append(v_documents,v_id); END IF;
        v_sections:=jsonb_set(v_sections,'{docs}',coalesce(v_sections->'docs','[]')||jsonb_build_array(v_resource));
      ELSE
        -- A pass delegates only instructions its issuer can still read. Signed-in
        -- recipients also retain explicit denials and ended-membership restrictions.
        IF v_field IN ('entry_instructions','parking') AND (NOT v_permissions ? 'access.view_codes'
          OR NOT public.home_external_share_recipient(v_home_id,p_recipient_id,'access.view_codes')) THEN
          RETURN '{"ok":false,"code":"SHARE_RESOURCE_DENIED","status":403}'::jsonb; END IF;
        v_sections:=v_sections||CASE v_field
          WHEN 'parking' THEN jsonb_build_object(v_field,v_home.parking_instructions)
          WHEN 'house_rules' THEN jsonb_build_object(v_field,v_home.house_rules)
          WHEN 'entry_instructions' THEN jsonb_build_object(v_field,v_home.entry_instructions)
          WHEN 'trash_day' THEN jsonb_build_object(v_field,v_home.trash_day)
          WHEN 'local_tips' THEN jsonb_build_object(v_field,v_home.local_tips) ELSE '{}'::jsonb END;
      END IF;
    END LOOP;
    v_result:=jsonb_build_object('pass',jsonb_build_object('label',v_pass->>'label','kind',v_pass->>'kind',
      'custom_title',v_pass->>'custom_title','expires_at',v_pass->'end_at','home_name',v_home.name,
      'welcome_message',v_home.guest_welcome_message),'sections',v_sections);
  ELSE
    v_id:=(v_pass->>'resource_id')::uuid;
    v_resource:=public.home_external_share_resource(v_home_id,v_issuer,p_recipient_id,v_pass->>'resource_type',v_id);
    IF v_resource IS NULL THEN RETURN '{"ok":false,"code":"SHARE_RESOURCE_DENIED","status":403}'::jsonb; END IF;
    IF v_resource ? '_document' THEN v_documents:=array_append(v_documents,v_id); END IF;
    v_result:=jsonb_build_object('grant',jsonb_build_object('resource_type',v_pass->>'resource_type',
      'can_view',true,'can_edit',false,'expires_at',v_pass->'end_at'),'resource',v_resource);
  END IF;
  -- All resource locks are held before the final wall-clock decision.
  IF (v_pass->>'end_at')::timestamptz<=clock_timestamp() THEN RETURN '{"ok":false,"code":"SHARE_EXPIRED","status":410}'::jsonb; END IF;
  IF NOT (public.home_external_share_context(v_home_id,v_issuer)->'permissions') ? v_need
    OR NOT public.home_external_share_recipient(v_home_id,p_recipient_id,'home.view') THEN
    RETURN '{"ok":false,"code":"SHARE_DENIED","status":403}'::jsonb; END IF;
  IF p_consume THEN
    IF p_kind='guest' THEN
      UPDATE public."HomeGuestPass" SET view_count=coalesce(view_count,0)+1,updated_at=clock_timestamp() WHERE id=p_share_id;
      INSERT INTO public."HomeGuestPassView"(guest_pass_id) VALUES(p_share_id);
    ELSE UPDATE public."HomeScopedGrant" SET view_count=coalesce(view_count,0)+1,updated_at=clock_timestamp() WHERE id=p_share_id;
    END IF;
  END IF;
  RETURN jsonb_build_object('ok',true,'view',v_result,'home_id',v_home_id,'document_ids',v_documents,'expires_at',v_pass->'end_at');
END $$;

REVOKE EXECUTE ON FUNCTION public.mutate_home_external_share(uuid,uuid,text,text,uuid,jsonb),
  public.inspect_home_external_share(text,uuid,uuid,text,boolean,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mutate_home_external_share(uuid,uuid,text,text,uuid,jsonb),
  public.inspect_home_external_share(text,uuid,uuid,text,boolean,boolean) TO service_role;
