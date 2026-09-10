-- Backwards compatible: yes. Public DTOs retain their existing envelopes.
-- Legacy links need explicit reissue because their resource scope was never
-- validated. No existing grant, role default, membership or file is broadened.
SET LOCAL lock_timeout = '5s';

ALTER TABLE public."HomeGuestPass" ADD COLUMN sharing_version integer,
  ADD COLUMN resource_bindings jsonb;
ALTER TABLE public."HomeScopedGrant" ADD COLUMN sharing_version integer,
  ADD COLUMN revoked_at timestamptz;
CREATE TABLE public."HomeShareReadReceipt" (
  receipt_hash text PRIMARY KEY CHECK (receipt_hash ~ '^[a-f0-9]{64}$'),
  home_id uuid NOT NULL REFERENCES public."Home"(id) ON DELETE CASCADE,
  share_kind text NOT NULL CHECK (share_kind IN ('guest','scoped')),
  share_id uuid NOT NULL,
  recipient_user_id uuid REFERENCES public."User"(id) ON DELETE CASCADE,
  document_ids uuid[] NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public."HomeShareReadReceipt" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."HomeGuestPass",public."HomeGuestPassView",public."HomeScopedGrant",
  public."HomeShareReadReceipt" FROM PUBLIC,anon,authenticated;
GRANT ALL ON public."HomeShareReadReceipt" TO service_role;

CREATE FUNCTION public.lock_home_external_share(p_home_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
BEGIN
  PERFORM id FROM public."Home" WHERE id=p_home_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  LOCK TABLE public."HomeRolePermission",public."HomeRolePreset" IN SHARE MODE;
  PERFORM id FROM public."HomeOccupancy" WHERE home_id=p_home_id ORDER BY id FOR UPDATE;
  PERFORM id FROM public."HomeOwner" WHERE home_id=p_home_id ORDER BY id FOR UPDATE;
  PERFORM id FROM public."HomePermissionOverride" WHERE home_id=p_home_id ORDER BY user_id,permission FOR UPDATE;
  RETURN true;
END $$;

CREATE FUNCTION public.home_external_share_context(p_home_id uuid,p_actor_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_access jsonb; v_now timestamptz:=clock_timestamp();
BEGIN
  IF p_actor_id IS NULL OR NOT EXISTS(SELECT FROM public."Home" WHERE id=p_home_id
    AND home_status NOT IN ('merged','archived') AND security_state NOT IN ('frozen','frozen_silent')
    AND NOT coalesce(lockdown_enabled,false)) THEN RETURN '{"permissions":[]}'::jsonb; END IF;
  IF EXISTS(SELECT FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_actor_id
    AND (age_band IN ('child','teen') OR start_at>v_now OR end_at<=v_now
      OR access_start_at>v_now OR access_end_at<=v_now)) THEN RETURN '{"permissions":[]}'::jsonb; END IF;
  v_access:=public.home_effective_access(p_home_id,p_actor_id);
  IF v_access->>'is_owner'='true'
    AND EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user'
      AND subject_id=p_actor_id AND owner_status IN ('revoked','disputed'))
    AND NOT EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user'
      AND subject_id=p_actor_id AND owner_status='verified') THEN RETURN '{"permissions":[]}'::jsonb; END IF;
  RETURN v_access;
END $$;

CREATE FUNCTION public.home_external_share_recipient(p_home_id uuid,p_user_id uuid,p_need public.home_permission)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_occ public."HomeOccupancy"%ROWTYPE; v_now timestamptz:=clock_timestamp();
BEGIN
  IF p_user_id IS NULL THEN RETURN true; END IF;
  IF NOT EXISTS(SELECT FROM public."User" WHERE id=p_user_id) THEN RETURN false; END IF;
  IF EXISTS(SELECT FROM public."HomePermissionOverride" WHERE home_id=p_home_id AND user_id=p_user_id
    AND permission=p_need AND NOT allowed) THEN RETURN false; END IF;
  SELECT * INTO v_occ FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_user_id;
  IF NOT FOUND THEN RETURN true; END IF;
  -- Unknown verification must return false, never SQL NULL (which an outer
  -- IF NOT check would otherwise fail to reject).
  RETURN v_occ.is_active IS TRUE AND v_occ.verification_status IS NOT DISTINCT FROM 'verified'
    AND coalesce(v_occ.role_base,public.home_invite_role(v_occ.role)) IS NOT NULL
    AND (v_occ.start_at IS NULL OR v_occ.start_at<=v_now) AND (v_occ.end_at IS NULL OR v_occ.end_at>v_now)
    AND (v_occ.access_start_at IS NULL OR v_occ.access_start_at<=v_now)
    AND (v_occ.access_end_at IS NULL OR v_occ.access_end_at>v_now)
    AND public.home_authority_age_allows(v_occ.age_band,p_need);
END $$;

-- Return a deliberate external DTO, never SELECT * or arbitrary details/URLs.
-- The only storage descriptor remains inside service RPCs and is removed by
-- the API before rendering a token/receipt URL.
CREATE FUNCTION public.home_external_share_resource(p_home_id uuid,p_actor_id uuid,p_recipient_id uuid,
  p_type text,p_id uuid,p_lock boolean DEFAULT true) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE v_row jsonb; v_need public.home_permission; v_result jsonb; v_file public."File"%ROWTYPE;
BEGIN
  CASE p_type
    WHEN 'HomeAccessSecret' THEN
      IF p_lock THEN
        PERFORM id FROM public."HomeAccessSecret" WHERE home_id=p_home_id AND id=p_id FOR UPDATE;
        PERFORM access_secret_id FROM public."HomeAccessSecretValue" WHERE access_secret_id=p_id FOR UPDATE;
      END IF;
      SELECT to_jsonb(s)||jsonb_build_object('value',v.secret_value) INTO v_row
        FROM public."HomeAccessSecret" s LEFT JOIN public."HomeAccessSecretValue" v ON v.access_secret_id=s.id
        WHERE s.home_id=p_home_id AND s.id=p_id AND s.access_type='wifi';
      v_need:='access.view_wifi';
      v_result:=jsonb_build_object('network_name',v_row->>'label','password',coalesce(v_row->>'value',''));
    WHEN 'HomeEmergency' THEN
      IF p_lock THEN PERFORM id FROM public."HomeEmergency" WHERE home_id=p_home_id AND id=p_id FOR UPDATE; END IF;
      SELECT to_jsonb(s) INTO v_row FROM public."HomeEmergency" s WHERE home_id=p_home_id AND id=p_id;
      v_need:='home.view';
      v_result:=jsonb_build_object('type',v_row->>'type','info_type',v_row->>'type','label',v_row->>'label',
        'location',v_row->>'location','location_in_home',v_row->>'location');
    WHEN 'HomeDocument' THEN
      -- Match document replacement/deletion's File-before-HomeDocument order.
      IF p_lock THEN
        PERFORM f.id FROM public."File" f JOIN public."HomeDocument" d ON d.file_id=f.id
          WHERE d.home_id=p_home_id AND d.id=p_id FOR UPDATE OF f;
        PERFORM id FROM public."HomeDocument" WHERE home_id=p_home_id AND id=p_id FOR UPDATE;
      END IF;
      SELECT to_jsonb(s) INTO v_row FROM public."HomeDocument" s WHERE home_id=p_home_id AND id=p_id;
      v_need:='docs.view';
      v_result:=jsonb_build_object('id',p_id,'title',v_row->>'title','doc_type',v_row->>'doc_type',
        'mime_type',v_row->>'mime_type','size_bytes',v_row->'size_bytes');
      SELECT * INTO v_file FROM public."File" WHERE id=(v_row->>'file_id')::uuid AND home_id=p_home_id;
      IF FOUND AND NOT v_file.is_deleted AND v_file.id=p_id AND v_row->'details'->>'storage_contract'='home_document_v1'
        AND v_file.metadata->>'storage_contract'='home_document_v1'
        AND v_file.user_id=(v_row->>'created_by')::uuid
        AND v_file.metadata->>'upload_fingerprint'=v_row->'details'->>'upload_fingerprint'
        AND v_file.metadata->>'storage_bucket'=v_row->>'storage_bucket'
        AND v_file.metadata->>'upload_sha256'=v_row->'details'->>'upload_sha256'
        AND v_file.metadata->>'upload_sha256' ~ '^[a-f0-9]{64}$'
        AND coalesce(v_file.metadata->>'storage_key_id',p_id::text) ~ '^[a-fA-F0-9-]{36}$'
        AND v_file.file_path=p_home_id::text||'/'||coalesce(v_file.metadata->>'storage_key_id',p_id::text)||'/'||
          (v_file.metadata->>'upload_sha256') THEN
        v_result:=v_result||jsonb_build_object('_document',jsonb_build_object('home_id',p_home_id,'document_id',p_id,
          'key_id',coalesce(v_file.metadata->>'storage_key_id',p_id::text),
          'sha256',v_file.metadata->>'upload_sha256','bucket_name',v_row->>'storage_bucket',
          'version',v_row->'details'->>'upload_version'));
      ELSIF v_file.is_deleted THEN RETURN NULL; END IF;
    WHEN 'HomeTask' THEN
      IF p_lock THEN PERFORM id FROM public."HomeTask" WHERE home_id=p_home_id AND id=p_id FOR UPDATE; END IF;
      SELECT to_jsonb(s) INTO v_row FROM public."HomeTask" s WHERE home_id=p_home_id AND id=p_id;
      v_need:='tasks.view';
      v_result:=jsonb_build_object('id',p_id,'title',v_row->>'title','description',v_row->>'description',
        'task_type',v_row->>'task_type','status',v_row->>'status','due_at',v_row->'due_at','priority',v_row->>'priority');
    WHEN 'HomeCalendarEvent' THEN
      IF p_lock THEN PERFORM id FROM public."HomeCalendarEvent" WHERE home_id=p_home_id AND id=p_id FOR UPDATE; END IF;
      SELECT to_jsonb(s) INTO v_row FROM public."HomeCalendarEvent" s WHERE home_id=p_home_id AND id=p_id;
      v_need:='calendar.view';
      v_result:=jsonb_build_object('id',p_id,'title',v_row->>'title','description',v_row->>'description',
        'event_type',v_row->>'event_type','start_at',v_row->'start_at','end_at',v_row->'end_at',
        'timezone',v_row->>'timezone','location_notes',v_row->>'location_notes');
    WHEN 'HomeIssue' THEN
      IF p_lock THEN PERFORM id FROM public."HomeIssue" WHERE home_id=p_home_id AND id=p_id FOR UPDATE; END IF;
      SELECT to_jsonb(s) INTO v_row FROM public."HomeIssue" s WHERE home_id=p_home_id AND id=p_id;
      v_need:='maintenance.view';
      v_result:=jsonb_build_object('id',p_id,'title',v_row->>'title','description',v_row->>'description',
        'severity',v_row->>'severity','status',v_row->>'status');
    WHEN 'HomeAsset' THEN
      IF p_lock THEN PERFORM id FROM public."HomeAsset" WHERE home_id=p_home_id AND id=p_id FOR UPDATE; END IF;
      SELECT to_jsonb(s) INTO v_row FROM public."HomeAsset" s WHERE home_id=p_home_id AND id=p_id;
      v_need:='assets.view';
      v_result:=jsonb_build_object('id',p_id,'name',v_row->>'name','category',v_row->>'category',
        'brand',v_row->>'brand','model',v_row->>'model','room',v_row->>'room');
    WHEN 'HomePackage' THEN
      IF p_lock THEN PERFORM id FROM public."HomePackage" WHERE home_id=p_home_id AND id=p_id FOR UPDATE; END IF;
      SELECT to_jsonb(s) INTO v_row FROM public."HomePackage" s WHERE home_id=p_home_id AND id=p_id;
      v_need:='packages.view';
      v_result:=jsonb_build_object('id',p_id,'carrier',v_row->>'carrier','description',v_row->>'description',
        'status',v_row->>'status','expected_at',v_row->'expected_at','delivered_at',v_row->'delivered_at');
    ELSE RETURN NULL;
  END CASE;
  IF v_row IS NULL OR coalesce(v_row->>'visibility','members') NOT IN ('public','members')
    OR NOT (public.home_external_share_context(p_home_id,p_actor_id)->'permissions') ? v_need::text
    OR NOT public.home_external_share_recipient(p_home_id,p_recipient_id,v_need) THEN RETURN NULL; END IF;
  RETURN v_result;
END $$;

CREATE FUNCTION public.mutate_home_external_share(p_home_id uuid,p_actor_id uuid,p_kind text,
  p_action text,p_share_id uuid DEFAULT NULL,p_payload jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE v_now timestamptz; v_start timestamptz; v_end timestamptz; v_hours numeric;
  v_need text; v_kind text; v_sections jsonb; v_bindings jsonb:='{}'::jsonb; v_ids jsonb; v_id uuid;
  v_section text; v_resource jsonb; v_row jsonb; v_share uuid; v_issuer uuid; v_grantee uuid;
  v_revoked timestamptz; v_max integer; v_permission jsonb;
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
      'can_edit','can_upload','permission_scope','grantee_user_id'))
    OR coalesce(p_payload->>'token_hash','') !~ '^[a-f0-9]{64}$'
    OR (p_payload->>'passcode_hash' IS NOT NULL AND p_payload->>'passcode_hash' !~ '^[a-f0-9]{64}$')
    OR (p_payload ? 'can_edit' AND p_payload->'can_edit'<>'false'::jsonb)
    OR (p_payload ? 'can_upload' AND p_payload->'can_upload'<>'false'::jsonb)
    OR (p_payload ? 'permissions' AND p_payload->'permissions'<>'{}'::jsonb)
    OR (p_payload ? 'permission_scope' AND p_payload->>'permission_scope'<>'view') THEN
    RETURN '{"ok":false,"code":"SHARE_INVALID","status":400}'::jsonb; END IF;
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
      END IF;
    END LOOP;
    IF v_end<=clock_timestamp() OR NOT (public.home_external_share_context(p_home_id,p_actor_id)->'permissions') ? v_need THEN
      RETURN '{"ok":false,"code":"SHARE_DENIED","status":403}'::jsonb; END IF;
    INSERT INTO public."HomeGuestPass"(home_id,label,kind,token_hash,permissions,start_at,end_at,created_by,
      included_sections,custom_title,passcode_hash,max_views,view_count,sharing_version,resource_bindings)
      VALUES(p_home_id,p_payload->>'label',v_kind,p_payload->>'token_hash','{}',v_start,v_end,p_actor_id,
        v_sections,p_payload->>'custom_title',p_payload->>'passcode_hash',v_max,0,1,v_bindings)
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

-- Internal inspection can be reused by a previously admitted document receipt.
-- Only a new public view spends quota; receipts remain bounded by that view's
-- exact document set, recipient and short expiry, and never revive a grant.
CREATE FUNCTION public.inspect_home_external_share(p_kind text,p_share_id uuid,p_recipient_id uuid,
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

CREATE FUNCTION public.read_home_external_share(p_kind text,p_token_hash text,p_recipient_id uuid DEFAULT NULL,
  p_passcode_hash text DEFAULT NULL,p_receipt_hash text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE v_ids uuid[]; v_result jsonb; v_home uuid;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$'
    OR p_receipt_hash IS NULL OR p_receipt_hash !~ '^[a-f0-9]{64}$' THEN
    RETURN '{"ok":false,"code":"SHARE_INVALID","status":400}'::jsonb; END IF;
  IF p_kind='guest' THEN SELECT array_agg(id) INTO v_ids FROM public."HomeGuestPass" WHERE token_hash=p_token_hash;
  ELSIF p_kind='scoped' THEN SELECT array_agg(id) INTO v_ids FROM public."HomeScopedGrant" WHERE token_hash=p_token_hash;
  ELSE RETURN '{"ok":false,"code":"SHARE_INVALID","status":400}'::jsonb; END IF;
  IF coalesce(cardinality(v_ids),0)<>1 THEN RETURN '{"ok":false,"code":"SHARE_NOT_FOUND","status":404}'::jsonb; END IF;
  v_result:=public.inspect_home_external_share(p_kind,v_ids[1],p_recipient_id,p_passcode_hash);
  IF v_result->>'ok'<>'true' THEN RETURN v_result; END IF;
  IF jsonb_array_length(v_result->'document_ids')>0 THEN
    v_home:=(v_result->>'home_id')::uuid;
    DELETE FROM public."HomeShareReadReceipt" WHERE home_id=v_home AND expires_at<=clock_timestamp();
    INSERT INTO public."HomeShareReadReceipt"(receipt_hash,home_id,share_kind,share_id,recipient_user_id,document_ids,expires_at)
      VALUES(p_receipt_hash,v_home,p_kind,v_ids[1],p_recipient_id,
        ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(v_result->'document_ids')),
        least((v_result->>'expires_at')::timestamptz,clock_timestamp()+interval '5 minutes'));
  END IF;
  RETURN jsonb_build_object('ok',true,'view',v_result->'view');
END $$;

CREATE FUNCTION public.authorize_home_share_document(p_receipt_hash text,p_document_id uuid,p_recipient_id uuid DEFAULT NULL,
  p_consume boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE v_receipt public."HomeShareReadReceipt"%ROWTYPE; v_result jsonb; v_document jsonb; v_home uuid;
BEGIN
  SELECT home_id INTO v_home FROM public."HomeShareReadReceipt" WHERE receipt_hash=p_receipt_hash;
  IF v_home IS NULL OR NOT public.lock_home_external_share(v_home) THEN RETURN '{"ok":false,"code":"SHARE_NOT_FOUND","status":404}'::jsonb; END IF;
  SELECT * INTO v_receipt FROM public."HomeShareReadReceipt" WHERE receipt_hash=p_receipt_hash FOR UPDATE;
  IF NOT FOUND OR v_receipt.expires_at<=clock_timestamp() OR NOT p_document_id=ANY(v_receipt.document_ids)
    OR v_receipt.recipient_user_id IS DISTINCT FROM p_recipient_id THEN
    RETURN '{"ok":false,"code":"SHARE_DENIED","status":403}'::jsonb; END IF;
  v_result:=public.inspect_home_external_share(v_receipt.share_kind,v_receipt.share_id,p_recipient_id,NULL,false,true);
  IF v_result->>'ok'<>'true' THEN RETURN v_result; END IF;
  IF v_receipt.share_kind='scoped' THEN v_document:=v_result->'view'->'resource';
  ELSE SELECT value INTO v_document FROM jsonb_array_elements(v_result->'view'->'sections'->'docs')
    WHERE value->>'id'=p_document_id::text; END IF;
  IF v_document->>'id' IS DISTINCT FROM p_document_id::text OR NOT coalesce(v_document ? '_document',false)
    OR v_receipt.expires_at<=clock_timestamp() THEN RETURN '{"ok":false,"code":"SHARE_RESOURCE_DENIED","status":403}'::jsonb; END IF;
  -- The API consumes only after storage returns and current authority has been
  -- rechecked. Competing final authorizations cannot deliver this document twice.
  IF p_consume THEN
    UPDATE public."HomeShareReadReceipt" SET document_ids=array_remove(document_ids,p_document_id)
      WHERE receipt_hash=p_receipt_hash;
  END IF;
  RETURN jsonb_build_object('ok',true,'document',v_document);
END $$;

-- The legacy RLS shortcut exposes full rows and arbitrary columns. External
-- recipients now use the exact DTO/receipt API, including named recipients.
-- Ordinary membership permission branches of existing policies are unchanged.
CREATE OR REPLACE FUNCTION public.home_has_scoped_grant(p_home_id uuid,p_resource_type text,p_resource_id uuid,
  p_need text,p_user_id uuid DEFAULT auth.uid()) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$ SELECT false $$;

REVOKE ALL ON FUNCTION public.lock_home_external_share(uuid),public.home_external_share_context(uuid,uuid),
  public.home_external_share_recipient(uuid,uuid,public.home_permission),
  public.home_external_share_resource(uuid,uuid,uuid,text,uuid,boolean),
  public.mutate_home_external_share(uuid,uuid,text,text,uuid,jsonb),
  public.inspect_home_external_share(text,uuid,uuid,text,boolean,boolean),
  public.read_home_external_share(text,text,uuid,text,text),public.authorize_home_share_document(text,uuid,uuid,boolean)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lock_home_external_share(uuid),public.home_external_share_context(uuid,uuid),
  public.home_external_share_recipient(uuid,uuid,public.home_permission),
  public.home_external_share_resource(uuid,uuid,uuid,text,uuid,boolean),
  public.mutate_home_external_share(uuid,uuid,text,text,uuid,jsonb),
  public.inspect_home_external_share(text,uuid,uuid,text,boolean,boolean),
  public.read_home_external_share(text,text,uuid,text,text),public.authorize_home_share_document(text,uuid,uuid,boolean)
  TO service_role;

-- A retained external read receipt is established household history even
-- after its old share was removed. Extend the explicit private-deletion guard.
CREATE OR REPLACE FUNCTION public.home_delete_eligibility(p_home_id uuid, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_home public."Home"%ROWTYPE; v_occ public."HomeOccupancy"%ROWTYPE;
  v_access jsonb; v_role public.home_role_base; v_primary boolean; v_private boolean := false;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_home_id IS NULL OR p_user_id IS NULL THEN
    RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_ACCESS_DENIED','deleted',false);
  END IF;
  SELECT * INTO v_home FROM public."Home" WHERE id = p_home_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed',false,'code','HOME_NOT_FOUND','deleted',false);
  END IF;
  -- Destructive authority must not revive through an older Home.owner_id when
  -- the caller's ownership is disputed or revoked without a current verified
  -- record. Historical revoked rows may coexist with a legitimate reverified
  -- owner because the canonical uniqueness constraint excludes revoked rows.
  IF EXISTS (SELECT FROM public."HomeOwner" o WHERE o.home_id = p_home_id
    AND o.subject_type = 'user' AND o.subject_id = p_user_id
    AND (o.owner_status = 'disputed' OR (o.owner_status = 'revoked' AND NOT EXISTS (
      SELECT FROM public."HomeOwner" current_owner WHERE current_owner.home_id = p_home_id
        AND current_owner.subject_type = 'user' AND current_owner.subject_id = p_user_id
        AND current_owner.owner_status = 'verified')))) THEN
    RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_ACCESS_DENIED','deleted',false);
  END IF;
  SELECT * INTO v_occ FROM public."HomeOccupancy" WHERE home_id = p_home_id AND user_id = p_user_id;
  -- This read-only RPC is VOLATILE deliberately: current time after lock waits
  -- fences an access window that ended while the transaction was waiting.
  -- Eligibility is advisory; the deletion RPC locks/rechecks before mutation.
  -- NULL age retains the existing adult compatibility.
  IF v_home.security_state IN ('frozen','frozen_silent') OR
    (v_occ.id IS NOT NULL AND (v_occ.is_active IS DISTINCT FROM true
      OR v_occ.age_band IN ('child','teen')
      OR v_occ.start_at > v_now OR v_occ.end_at <= v_now
      OR v_occ.access_start_at > v_now OR v_occ.access_end_at <= v_now)) THEN
    RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_ACCESS_DENIED','deleted',false);
  END IF;
  v_primary := coalesce(v_home.owner_id = p_user_id, false) OR EXISTS (
    SELECT FROM public."HomeOwner" WHERE home_id = p_home_id AND subject_type = 'user'
      AND subject_id = p_user_id AND owner_status = 'verified' AND is_primary_owner);
  v_access := public.home_effective_access(p_home_id,p_user_id);
  IF v_primary AND coalesce((v_access->>'has_access')::boolean,false)
    AND coalesce((v_access->>'is_owner')::boolean,false) THEN
    IF NOT (v_access->'permissions' ?& ARRAY['home.edit','security.manage']) THEN
      RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_ACCESS_DENIED','deleted',false);
    END IF;
  ELSE
    -- This is removal of an exact creator's unfinished private setup. It is
    -- never generic provisional membership or authority over a household.
    v_role := coalesce(v_occ.role_base, CASE v_occ.role
      WHEN 'owner' THEN 'owner' WHEN 'admin' THEN 'admin'
      WHEN 'manager' THEN 'manager' WHEN 'property_manager' THEN 'manager'
      WHEN 'tenant' THEN 'lease_resident' WHEN 'renter' THEN 'lease_resident'
      WHEN 'lease_resident' THEN 'lease_resident' WHEN 'member' THEN 'member'
      WHEN 'roommate' THEN 'member' WHEN 'family' THEN 'member'
      WHEN 'restricted_member' THEN 'restricted_member' WHEN 'caregiver' THEN 'restricted_member'
      WHEN 'guest' THEN 'guest' WHEN 'service_provider' THEN 'service_provider'
      ELSE NULL END::public.home_role_base);
    IF v_home.created_by_user_id IS DISTINCT FROM p_user_id
      OR (v_home.owner_id IS NOT NULL AND v_home.owner_id <> p_user_id)
      OR v_occ.id IS NULL OR v_role IS NULL
      OR v_occ.verified_at IS NOT NULL
      OR v_occ.verification_status IS NULL
      OR v_occ.verification_status NOT IN ('provisional_bootstrap','pending_doc')
      OR EXISTS (SELECT FROM public."HomeOccupancy" WHERE home_id = p_home_id AND user_id <> p_user_id)
      OR EXISTS (SELECT FROM public."HomeOwner" WHERE home_id = p_home_id
        AND (subject_type <> 'user' OR subject_id <> p_user_id OR owner_status <> 'pending')) THEN
      RETURN jsonb_build_object('allowed',false,'code','DELETE_HOME_NOT_PRIMARY','deleted',false);
    END IF;
    IF EXISTS (SELECT FROM public."HomePermissionOverride" WHERE home_id = p_home_id
      AND user_id = p_user_id AND permission IN ('home.edit','security.manage') AND NOT allowed)
      OR EXISTS (SELECT FROM public."HomeRolePermission" r WHERE r.role_base = v_role
        AND r.permission IN ('home.edit','security.manage') AND NOT r.allowed
        AND NOT EXISTS (SELECT FROM public."HomePermissionOverride" o WHERE o.home_id = p_home_id
          AND o.user_id = p_user_id AND o.permission = r.permission AND o.allowed)) THEN
      RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_ACCESS_DENIED','deleted',false);
    END IF;
    v_private := true;
  END IF;

  -- File.home_id cascades on Home deletion. That would destroy quota/upload
  -- tombstones and the metadata needed to remove external bytes. Do not bypass
  -- protect_home_document_record/file, unlink them, or pretend cleanup happened.
  IF EXISTS (SELECT FROM public."File" WHERE home_id = p_home_id)
    OR EXISTS (SELECT FROM public."HomeDocument" WHERE home_id = p_home_id)
    OR EXISTS (SELECT FROM public."HomeVerificationEvidence" e JOIN public."HomeOwnershipClaim" c
      ON c.id = e.claim_id WHERE c.home_id = p_home_id) THEN
    RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_STORAGE_CLEANUP_REQUIRED','deleted',false);
  END IF;
  IF EXISTS (SELECT FROM public."CommunityMailItem" WHERE home_id = p_home_id)
    OR EXISTS (SELECT FROM public."HomeMapPin" WHERE home_id = p_home_id)
    OR EXISTS (SELECT FROM public."VacationHold" WHERE home_id = p_home_id)
    OR EXISTS (SELECT FROM public."MailDeliveryIntent" WHERE intended_home_id = p_home_id)
    OR EXISTS (SELECT FROM public."NeighborEndorsement" WHERE endorser_home_id = p_home_id) THEN
    RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_LINKED_DATA','deleted',false);
  END IF;

  IF v_private THEN
    -- Explicit setup allowlist matches POST /homes: the caller's occupancy,
    -- pending owner + unreviewed claim, its audit, preferences and own WiFi.
    -- Own Unlisted progress and pickup rules are also private first-use data.
    -- Any other relation is conservatively a household/established-data fence,
    -- even if its creator happens to be this caller. No dynamic table scan.
    IF EXISTS (SELECT FROM public."HomeOwnershipClaim" WHERE home_id = p_home_id
        AND (claimant_user_id <> p_user_id OR state NOT IN ('draft','submitted') OR reviewed_by IS NOT NULL
          OR reviewed_at IS NOT NULL OR merged_into_claim_id IS NOT NULL))
      OR EXISTS (SELECT FROM public."HomeOwnershipClaim" foreign_claim JOIN public."HomeOwnershipClaim" own_claim
        ON foreign_claim.merged_into_claim_id = own_claim.id WHERE own_claim.home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeAuditLog" a WHERE a.home_id = p_home_id AND (
        a.actor_user_id IS DISTINCT FROM p_user_id OR NOT coalesce(
          (a.action = 'OCCUPANCY_TEMPLATE_APPLIED' AND a.target_type = 'HomeOccupancy'
            AND a.target_id = v_occ.id
            AND a.metadata->>'verification_status' IN ('provisional_bootstrap','pending_doc'))
          OR public.home_secret_own_setup_audit(a,p_user_id)
          OR (a.action = 'OWNERSHIP_CLAIM_SUBMITTED' AND a.target_type = 'HomeOwnershipClaim'
            AND EXISTS (SELECT FROM public."HomeOwnershipClaim" c WHERE c.id = a.target_id
              AND c.home_id = p_home_id AND c.claimant_user_id = p_user_id)),false)))
      OR EXISTS (SELECT FROM public."HomeAccessSecret" WHERE home_id = p_home_id AND created_by IS DISTINCT FROM p_user_id)
      OR EXISTS (SELECT FROM public."HomePermissionOverride" WHERE home_id = p_home_id
        AND (user_id <> p_user_id OR created_by IS DISTINCT FROM p_user_id))
      OR EXISTS (SELECT FROM public."UnlistedRemoval" WHERE home_id = p_home_id AND user_id <> p_user_id)
      OR EXISTS (SELECT FROM public."AddressCalendarRule" WHERE scope_type = 'home'
        AND public.home_calendar_scope_id(scope_key) = p_home_id AND created_by IS DISTINCT FROM p_user_id)
      OR EXISTS (SELECT FROM public."Activity" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."AddressReviewCase" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."AttomPropertyCache" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."BlockFounder" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."BlockInvite" WHERE sender_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."BookingPackage" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."BookingPage" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Booking" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."BusinessProfileView" WHERE viewer_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."ChatRoom" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."EventType" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."FridgeCard" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeAsset" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeAuthority" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeBill" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeBusinessLink" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeCalendarEvent" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeDevice" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeDispute" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeEmergency" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeEstateFields" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeGuestPass" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeHouseholdAccessRequest" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeInvite" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeIssue" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeLeaseInvite" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeLease" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeMaintenanceLog" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeMaintenanceTemplate" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeMedia" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePackage" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePet" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePoll" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePostcardCode" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePrivacy" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePrivateData" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePublicData" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeQuorumAction" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeRecordWatch" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeRentReport" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeReputation" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeResidencyClaim" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeResource" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeRvStatus" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeScopedGrant" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeShareReadReceipt" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeSeasonalChecklistItem" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeSubscription" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeSystem" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeTaskMedia" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeTask" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeVendor" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeVerification" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Home" WHERE parent_home_id = p_home_id OR canonical_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."ListingInventorySlot" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Listing" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."MailAlias" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."MailDayItem" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."MailPartySession" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."MailRoutingQueue" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Mail" WHERE address_home_id = p_home_id OR address_id = p_home_id OR recipient_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."MessageTemplate" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."NeighborMessage" WHERE sender_home_id = p_home_id OR recipient_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Post" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."PropertyIntelligenceCache" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."ResidencyClaim" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."ResidencyLetter" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."SavedTaskTemplate" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."SchedulingPoll" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."SchedulingWorkflow" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."SupportTrain" WHERE recipient_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."VaultFolder" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Gig" WHERE origin_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Payment" WHERE home_id = p_home_id) THEN
      RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_ESTABLISHED_HOUSEHOLD','deleted',false);
    END IF;
  END IF;
  RETURN jsonb_build_object('allowed',true,'code','HOME_DELETE_ALLOWED','deleted',false);
END;
$$;
