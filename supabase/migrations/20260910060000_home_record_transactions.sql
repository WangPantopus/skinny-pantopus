-- Backwards compatible: yes. Existing task/event response envelopes remain.
-- Home record operations require current exact authority. Personal task/mail
-- tables and ordinary role defaults are unchanged; legacy public task media
-- require reupload before they can use authenticated private delivery.
SET LOCAL lock_timeout='5s';

REVOKE ALL ON public."HomeTask",public."HomeCalendarEvent",public."HomeCalendarEventAttendee",
  public."HomeTaskMedia" FROM PUBLIC,anon,authenticated;
ALTER TABLE public."HomeTaskMedia" ENABLE ROW LEVEL SECURITY;

-- mail_id intentionally becomes NULL when the original mail is deleted. Keep
-- provenance separately so deletion cannot turn a private copied task public.
ALTER TABLE public."HomeTask" ADD COLUMN source_mail_id uuid;
UPDATE public."HomeTask" SET source_mail_id=mail_id WHERE mail_id IS NOT NULL;
-- The legacy backlink had no FK. Retain unresolved historical rows while
-- fencing new references and clearing links on direct or Home-cascade deletion.
ALTER TABLE public."Mail" ADD CONSTRAINT mail_linked_task_reference_fk
  FOREIGN KEY(linked_task_id) REFERENCES public."HomeTask"(id) ON DELETE SET NULL NOT VALID;
CREATE FUNCTION public.protect_home_task_identity() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.source_mail_id IS NOT NULL AND NEW.source_mail_id IS DISTINCT FROM NEW.mail_id THEN
      RAISE EXCEPTION 'Task source does not match its mail' USING ERRCODE='23514'; END IF;
    NEW.source_mail_id:=NEW.mail_id;
  ELSE
    IF NEW.home_id IS DISTINCT FROM OLD.home_id OR NEW.created_by IS DISTINCT FROM OLD.created_by
      OR NEW.source_mail_id IS DISTINCT FROM OLD.source_mail_id
      OR (NEW.mail_id IS NOT NULL AND NEW.mail_id IS DISTINCT FROM OLD.mail_id) THEN
      RAISE EXCEPTION 'Task Home, author and source are immutable' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_home_task_identity BEFORE INSERT OR UPDATE ON public."HomeTask"
FOR EACH ROW EXECUTE FUNCTION public.protect_home_task_identity();
REVOKE ALL ON FUNCTION public.protect_home_task_identity() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.lock_home_record_scope(p_home_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
BEGIN
  -- Reuse the established Home/authority/proof lock order. Private first-use
  -- must also serialize changes to claim evidence and owned setup history.
  RETURN public.lock_home_secret_scope(p_home_id);
END $$;

CREATE FUNCTION public.home_record_own_setup_audit(a public."HomeAuditLog",u uuid) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
  SELECT a.actor_user_id=u AND a.target_id IS NOT NULL AND a.metadata->>'private_setup'='true'
    AND a.metadata->>'created_by'=u::text AND a.metadata->>'visibility'='members'
    AND ((a.target_type='HomeTask' AND a.action IN ('home_task_created','home_task_updated','home_task_deleted'))
      OR (a.target_type='HomeCalendarEvent' AND a.action IN ('home_calendar_created','home_calendar_updated','home_calendar_deleted')))
$$;

CREATE FUNCTION public.home_record_context(p_home_id uuid,p_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_occ public."HomeOccupancy"%ROWTYPE; v_access jsonb; v_private jsonb; v_role public.home_role_base;
  v_now timestamptz:=clock_timestamp(); v_permissions text[]; v_denied constant jsonb:='{"allowed":false,"private":false,"permissions":[]}'::jsonb;
BEGIN
  IF p_user_id IS NULL OR NOT EXISTS(SELECT FROM public."Home" WHERE id=p_home_id
    AND home_status NOT IN ('merged','archived') AND security_state NOT IN ('frozen','frozen_silent')) THEN RETURN v_denied; END IF;
  SELECT * INTO v_occ FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_user_id;
  v_role:=coalesce(v_occ.role_base,public.home_invite_role(v_occ.role));
  IF v_occ.id IS NOT NULL AND (v_occ.is_active IS DISTINCT FROM true OR v_role IS NULL
    OR v_occ.start_at>v_now OR v_occ.end_at<=v_now OR v_occ.access_start_at>v_now OR v_occ.access_end_at<=v_now) THEN RETURN v_denied; END IF;
  v_access:=public.home_effective_access(p_home_id,p_user_id);
  IF v_access->>'is_owner'='true' AND EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=p_home_id
    AND subject_type='user' AND subject_id=p_user_id AND owner_status IN ('revoked','disputed'))
    AND NOT EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user'
      AND subject_id=p_user_id AND owner_status='verified') THEN RETURN v_denied; END IF;
  IF v_access->>'has_access'='true' THEN
    RETURN jsonb_build_object('allowed',true,'private',false,'permissions',v_access->'permissions',
      'role',v_access->>'effective_role_base','user_id',p_user_id);
  END IF;
  -- This existing explicit setup predicate checks creator identity, pending
  -- state, evidence ownership and every established/foreign history boundary.
  v_private:=public.home_secret_context(p_home_id,p_user_id);
  IF v_private->>'allowed' IS DISTINCT FROM 'true' OR v_private->>'private' IS DISTINCT FROM 'true' THEN RETURN v_denied; END IF;
  SELECT coalesce(array_agg(p::text),'{}'::text[]) INTO v_permissions
    FROM unnest(ARRAY['tasks.view','tasks.edit','tasks.manage','calendar.view','calendar.edit','calendar.manage']::public.home_permission[]) p
    WHERE NOT EXISTS(SELECT FROM public."HomePermissionOverride" WHERE home_id=p_home_id
      AND user_id=p_user_id AND permission=p AND NOT allowed)
      AND NOT EXISTS(SELECT FROM public."HomeRolePermission" WHERE role_base=v_role AND permission=p AND NOT allowed
        AND NOT EXISTS(SELECT FROM public."HomePermissionOverride" WHERE home_id=p_home_id
          AND user_id=p_user_id AND permission=p AND allowed));
  RETURN jsonb_build_object('allowed',true,'private',true,'permissions',v_permissions,'role',v_role,'user_id',p_user_id);
END $$;

CREATE FUNCTION public.home_record_visible(p_context jsonb,p_kind text,p_created_by uuid,p_visibility public.home_record_visibility)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
  SELECT coalesce(p_context->>'allowed'='true'
    AND p_context->'permissions' ? (CASE p_kind WHEN 'task' THEN 'tasks.view' WHEN 'event' THEN 'calendar.view' ELSE '' END)
    AND CASE WHEN p_context->>'private'='true' THEN p_created_by::text=p_context->>'user_id' AND p_visibility='members'
      ELSE CASE p_visibility WHEN 'public' THEN true WHEN 'members' THEN true
        WHEN 'managers' THEN public.home_role_rank((p_context->>'role')::public.home_role_base)>=40
        WHEN 'sensitive' THEN p_context->'permissions' ? 'sensitive.view' ELSE false END END,false)
$$;

CREATE FUNCTION public.home_record_recipient(p_home_id uuid,p_user_id uuid,p_kind text,p_visibility public.home_record_visibility)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_context jsonb; v_occ public."HomeOccupancy"%ROWTYPE;
BEGIN
  SELECT * INTO v_occ FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_user_id;
  IF NOT FOUND OR v_occ.verification_status IS DISTINCT FROM 'verified' THEN RETURN false; END IF;
  v_context:=public.home_record_context(p_home_id,p_user_id);
  RETURN v_context->>'private'='false' AND public.home_record_visible(v_context,p_kind,p_user_id,p_visibility);
END $$;

CREATE FUNCTION public.home_task_source_access(p_home_id uuid,p_user_id uuid,p_source_mail_id uuid,
  p_external boolean DEFAULT false) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE m public."Mail"%ROWTYPE; v_now timestamptz;
BEGIN
  IF p_source_mail_id IS NULL THEN RETURN true; END IF;
  SELECT * INTO m FROM public."Mail" WHERE id=p_source_mail_id FOR SHARE;
  IF NOT FOUND THEN RETURN false; END IF;
  v_now:=clock_timestamp();
  IF m.expires_at<=v_now OR m.time_limited_expires_at<=v_now OR m.lifecycle='shredded'
    OR m.access_count_max IS NOT NULL OR m.privacy IS NULL OR m.privacy NOT IN ('private_to_person','shared_household')
    OR m.recipient_home_id IS NOT NULL AND m.recipient_home_id<>p_home_id
    OR m.address_home_id IS NOT NULL AND m.address_home_id<>p_home_id
    OR m.address_id IS NOT NULL AND m.address_id<>p_home_id
    OR m.delivery_target_type='home' AND m.delivery_target_id IS DISTINCT FROM p_home_id
    OR m.recipient_type='home' AND m.recipient_id IS DISTINCT FROM p_home_id THEN RETURN false; END IF;
  IF p_external THEN
    RETURN m.recipient_home_id=p_home_id AND m.recipient_user_id IS NULL AND m.attn_user_id IS NULL
      AND (m.recipient_type IS NULL OR m.recipient_type='home')
      AND (m.delivery_target_type IS NULL OR m.delivery_target_type='home')
      AND (m.recipient_id IS NULL OR m.recipient_id=p_home_id)
      AND (m.delivery_target_id IS NULL OR m.delivery_target_id=p_home_id)
      AND m.privacy='shared_household' AND coalesce(m.delivery_visibility,'home_members')='home_members';
  END IF;
  IF p_user_id IS NULL THEN RETURN false; END IF;
  IF (m.recipient_user_id IS NOT NULL AND m.recipient_user_id<>p_user_id)
    OR (m.attn_user_id IS NOT NULL AND m.attn_user_id<>p_user_id)
    OR (m.recipient_type='user' AND m.recipient_id IS DISTINCT FROM p_user_id)
    OR (m.delivery_target_type='user' AND m.delivery_target_id IS DISTINCT FROM p_user_id)
    OR (m.delivery_visibility IN ('attn_only','attn_plus_admins') AND m.attn_user_id IS DISTINCT FROM p_user_id) THEN RETURN false; END IF;
  IF m.recipient_user_id IS NOT NULL THEN RETURN true; END IF;
  IF m.attn_user_id IS NOT NULL OR m.delivery_visibility IN ('attn_only','attn_plus_admins') THEN
    -- Administrative Home authority never substitutes for the actual addressee.
    RETURN m.attn_user_id=p_user_id;
  END IF;
  RETURN m.recipient_home_id=p_home_id AND m.privacy='shared_household'
    AND coalesce(m.delivery_visibility,'home_members')='home_members';
END $$;

CREATE FUNCTION public.home_task_readable(p_task public."HomeTask",p_user_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF p_task.source_mail_id IS NULL AND p_task.details ?| ARRAY['sourceMailId','source_mail_id'] THEN RETURN false; END IF;
  IF NOT coalesce(public.home_task_source_access(p_task.home_id,p_user_id,p_task.source_mail_id),false) THEN RETURN false; END IF;
  -- Recheck wall-clock authority after a possible source-row lock wait.
  RETURN public.home_record_visible(public.home_record_context(p_task.home_id,p_user_id),
    'task',p_task.created_by,p_task.visibility);
END $$;

CREATE FUNCTION public.mutate_home_record(p_home_id uuid,p_actor_id uuid,p_kind text,p_action text,
  p_record_id uuid DEFAULT NULL,p_payload jsonb DEFAULT '{}',p_source_mail_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE t public."HomeTask"%ROWTYPE; e public."HomeCalendarEvent"%ROWTYPE; m public."Mail"%ROWTYPE;
  c jsonb; v_now timestamptz; v_created_by uuid; v_visibility public.home_record_visibility;
  v_targets uuid[]; v_target uuid; v_edit boolean; v_manage boolean; v_status_only boolean;
  v_row jsonb; v_event_id uuid; v_action text;
BEGIN
  IF p_kind IS NULL OR p_kind NOT IN ('task','event') OR p_action IS NULL
    OR p_action NOT IN ('create','update','delete','rsvp','authorize_attachment','authorize_publication') OR (p_action='rsvp' AND p_kind<>'event')
    OR (p_action IN ('authorize_attachment','authorize_publication') AND p_kind<>'task')
    OR (p_action='create') IS DISTINCT FROM (p_record_id IS NULL)
    OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
    OR (p_source_mail_id IS NOT NULL AND (p_kind<>'task' OR p_action<>'create')) THEN
    RETURN '{"ok":false,"code":"HOME_RECORD_INVALID","status":400}'::jsonb; END IF;
  IF NOT public.lock_home_record_scope(p_home_id) THEN RETURN '{"ok":false,"code":"HOME_NOT_FOUND","status":404}'::jsonb; END IF;
  -- Source mail locks precede task locks, matching Mail deletion's SET NULL FK.
  -- The retained provenance remains immutable when mail_id is cleared by it.
  IF p_source_mail_id IS NOT NULL THEN
    SELECT * INTO m FROM public."Mail" WHERE id=p_source_mail_id FOR UPDATE;
    IF NOT FOUND THEN RETURN '{"ok":false,"code":"HOME_TASK_SOURCE_DENIED","status":403}'::jsonb; END IF;
  ELSIF p_kind='task' AND p_record_id IS NOT NULL THEN
    SELECT source_mail_id INTO v_event_id FROM public."HomeTask" WHERE home_id=p_home_id AND id=p_record_id;
    PERFORM id FROM public."Mail" WHERE id=v_event_id FOR SHARE;
  END IF;
  IF p_action<>'create' THEN
    IF p_kind='task' THEN
      SELECT * INTO t FROM public."HomeTask" WHERE home_id=p_home_id AND id=p_record_id FOR UPDATE;
      IF NOT FOUND THEN RETURN '{"ok":false,"code":"HOME_RECORD_NOT_FOUND","status":404}'::jsonb; END IF;
      IF NOT public.home_task_readable(t,p_actor_id) THEN RETURN '{"ok":false,"code":"HOME_RECORD_DENIED","status":403}'::jsonb; END IF;
      v_created_by:=t.created_by;
    ELSE
      SELECT * INTO e FROM public."HomeCalendarEvent" WHERE home_id=p_home_id AND id=p_record_id FOR UPDATE;
      IF NOT FOUND THEN RETURN '{"ok":false,"code":"HOME_RECORD_NOT_FOUND","status":404}'::jsonb; END IF;
      v_created_by:=e.created_by;
    END IF;
  END IF;
  c:=public.home_record_context(p_home_id,p_actor_id);
  IF c->>'allowed' IS DISTINCT FROM 'true' OR NOT c->'permissions' ? (CASE p_kind WHEN 'task' THEN 'tasks.view' ELSE 'calendar.view' END)
    OR (p_action<>'create' AND p_kind='event' AND NOT public.home_record_visible(c,'event',e.created_by,e.visibility)) THEN
    RETURN '{"ok":false,"code":"HOME_RECORD_DENIED","status":403}'::jsonb; END IF;
  -- The enum uses calendar.*, while task permissions use the plural tasks.*.
  v_edit:=c->'permissions' ? (CASE p_kind WHEN 'task' THEN 'tasks.edit' ELSE 'calendar.edit' END);
  v_manage:=c->'permissions' ? (CASE p_kind WHEN 'task' THEN 'tasks.manage' ELSE 'calendar.manage' END);
  IF p_action='rsvp' THEN
    IF e.request_rsvp IS DISTINCT FROM true OR p_payload->>'status' NOT IN ('going','maybe','declined','pending')
      OR p_payload->>'status' IS NULL OR EXISTS(SELECT FROM jsonb_object_keys(p_payload) k WHERE k<>'status') THEN
      RETURN '{"ok":false,"code":"HOME_RECORD_INVALID","status":400}'::jsonb; END IF;
    IF c->>'private'='true' AND e.created_by<>p_actor_id THEN RETURN '{"ok":false,"code":"HOME_RECORD_DENIED","status":403}'::jsonb; END IF;
    INSERT INTO public."HomeCalendarEventAttendee"(event_id,user_id,rsvp_status)
      VALUES(e.id,p_actor_id,(p_payload->>'status')::public.booking_rsvp_status)
      ON CONFLICT(event_id,user_id) DO UPDATE SET rsvp_status=excluded.rsvp_status,updated_at=clock_timestamp()
      RETURNING jsonb_build_object('user_id',user_id,'rsvp_status',rsvp_status) INTO v_row;
    RETURN jsonb_build_object('ok',true,'attendee',v_row);
  END IF;
  v_status_only:=p_kind='task' AND p_action='update' AND t.assigned_to=p_actor_id AND v_edit
    AND p_payload ? 'status' AND p_payload->>'status' IN ('open','in_progress','done')
    AND NOT EXISTS(SELECT FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('status','completed_at'));
  IF NOT (v_manage OR (v_edit AND (p_action='create' OR v_created_by=p_actor_id)) OR coalesce(v_status_only,false)) THEN
    RETURN '{"ok":false,"code":"HOME_RECORD_WRITE_DENIED","status":403}'::jsonb; END IF;
  IF c->>'private'='true' AND p_action<>'create' AND v_created_by<>p_actor_id THEN
    RETURN '{"ok":false,"code":"HOME_RECORD_WRITE_DENIED","status":403}'::jsonb; END IF;
  IF p_action IN ('authorize_attachment','authorize_publication') THEN
    IF p_payload<>'{}'::jsonb THEN RETURN '{"ok":false,"code":"HOME_RECORD_INVALID","status":400}'::jsonb; END IF;
    RETURN jsonb_build_object('ok',false,'status',409,'code',CASE p_action WHEN 'authorize_attachment'
      THEN 'HOME_TASK_PRIVATE_STORAGE_REQUIRED' ELSE 'HOME_TASK_GIG_FLOW_REQUIRED' END);
  END IF;
  IF p_action='delete' THEN
    IF p_payload<>'{}'::jsonb THEN RETURN '{"ok":false,"code":"HOME_RECORD_INVALID","status":400}'::jsonb; END IF;
    IF p_kind='task' AND EXISTS(SELECT FROM public."HomeTaskMedia" WHERE task_id=t.id) THEN
      RETURN '{"ok":false,"code":"HOME_TASK_MEDIA_CLEANUP_REQUIRED","status":409}'::jsonb; END IF;
    v_row:=CASE p_kind WHEN 'task' THEN to_jsonb(t) ELSE to_jsonb(e) END;
    IF p_kind='task' THEN
      -- Keep the established source-before-task order for the normal API path.
      -- The FK also clears backlinks during an authorized whole-Home cascade.
      UPDATE public."Mail" SET linked_task_id=NULL WHERE id=t.source_mail_id AND linked_task_id=t.id;
      DELETE FROM public."HomeTask" WHERE id=t.id;
    ELSE DELETE FROM public."HomeCalendarEvent" WHERE id=e.id; END IF;
  ELSE
    IF p_kind='task' THEN
      IF EXISTS(SELECT FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('task_type','title','description','assigned_to',
        'due_at','recurrence_rule','priority','budget','details','visibility','viewer_user_ids','status','completed_at','is_recurring'))
        OR (p_payload ? 'details' AND (jsonb_typeof(p_payload->'details') IS DISTINCT FROM 'object'
          OR p_payload->'details' ?| ARRAY['source','sourceMailId','source_mail_id','sourceMailType','sourceObjectId'])) THEN
        RETURN '{"ok":false,"code":"HOME_RECORD_INVALID","status":400}'::jsonb; END IF;
      IF p_action='create' THEN
        t.home_id:=p_home_id;t.created_by:=p_actor_id;t.task_type:='chore';t.status:='open';t.priority:='medium';
        t.visibility:='members';t.details:='{}'::jsonb;t.viewer_user_ids:='{}'::uuid[];t.is_recurring:=false;
      END IF;
      t:=jsonb_populate_record(t,p_payload);
      IF t.title IS NULL OR length(btrim(t.title)) NOT BETWEEN 1 AND 255 OR length(t.description)>10000
        OR t.task_type IS NULL OR t.task_type NOT IN ('chore','shopping','project','reminder','repair')
        OR t.status IS NULL OR t.status NOT IN ('open','in_progress','done','canceled')
        OR t.priority IS NULL OR t.priority NOT IN ('low','medium','high','urgent') OR t.visibility IS NULL
        OR t.budget<0 OR t.budget>9999999999.99 OR length(t.recurrence_rule)>1000
        OR NOT isfinite(t.due_at)
        OR jsonb_typeof(t.details) IS DISTINCT FROM 'object' OR pg_column_size(t.details)>32768
        OR cardinality(t.viewer_user_ids)>100 THEN RETURN '{"ok":false,"code":"HOME_RECORD_INVALID","status":400}'::jsonb; END IF;
      t.title:=btrim(t.title);
      IF p_action='create' THEN t.source_mail_id:=p_source_mail_id;t.mail_id:=p_source_mail_id; END IF;
      IF NOT coalesce(public.home_task_source_access(p_home_id,p_actor_id,t.source_mail_id),false) THEN
        RETURN '{"ok":false,"code":"HOME_TASK_SOURCE_DENIED","status":403}'::jsonb; END IF;
      v_created_by:=t.created_by;v_visibility:=t.visibility;
      v_targets:=array_remove(coalesce(t.viewer_user_ids,'{}'::uuid[])||t.assigned_to,NULL);
      IF p_action='create' OR p_payload ? 'status' THEN
        t.completed_at:=CASE WHEN t.status='done' THEN coalesce(CASE WHEN p_action='update' THEN
          (SELECT completed_at FROM public."HomeTask" WHERE id=t.id AND status='done') END,clock_timestamp()) ELSE NULL END;
      ELSIF p_payload ? 'completed_at' THEN RETURN '{"ok":false,"code":"HOME_RECORD_INVALID","status":400}'::jsonb; END IF;
    ELSE
      IF EXISTS(SELECT FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('event_type','title','description','start_at','end_at',
        'location_notes','recurrence_rule','assigned_to','alerts_enabled','request_rsvp','reminders','timezone','visibility')) THEN
        RETURN '{"ok":false,"code":"HOME_RECORD_INVALID","status":400}'::jsonb; END IF;
      IF p_action='create' THEN
        e.home_id:=p_home_id;e.created_by:=p_actor_id;e.event_type:='other';e.visibility:='members';
        e.alerts_enabled:=true;e.request_rsvp:=false;e.reminders:='[]'::jsonb;
      END IF;
      e:=jsonb_populate_record(e,p_payload);
      IF e.title IS NULL OR length(btrim(e.title)) NOT BETWEEN 1 AND 255 OR length(e.description)>10000
        OR e.event_type IS NULL OR e.event_type NOT IN ('guest','vendor','maintenance','trash_recycling','chore','appointment','resource_booking','house','other')
        OR e.start_at IS NULL OR NOT isfinite(e.start_at) OR NOT isfinite(e.end_at) OR e.end_at<=e.start_at
        OR e.visibility IS NULL OR length(e.location_notes)>2000 OR length(e.recurrence_rule)>1000
        OR e.request_rsvp IS NULL OR cardinality(e.assigned_to)>100 OR jsonb_typeof(e.reminders) IS DISTINCT FROM 'array'
        OR jsonb_array_length(e.reminders)>20 OR pg_column_size(e.reminders)>8192
        OR (e.timezone IS NOT NULL AND NOT EXISTS(SELECT FROM pg_timezone_names WHERE name=e.timezone)) THEN
        RETURN '{"ok":false,"code":"HOME_RECORD_INVALID","status":400}'::jsonb; END IF;
      e.title:=btrim(e.title);
      IF e.recurrence_rule IS NOT NULL AND e.timezone IS NULL THEN
        SELECT timezone INTO e.timezone FROM public."AvailabilitySchedule" WHERE user_id=p_actor_id AND is_default LIMIT 1;
        e.timezone:=coalesce(e.timezone,'UTC');
      END IF;
      v_created_by:=e.created_by;v_visibility:=e.visibility;v_targets:=coalesce(e.assigned_to,'{}'::uuid[]);
    END IF;
    FOREACH v_target IN ARRAY v_targets LOOP
      IF v_target IS NULL OR (c->>'private'='true' AND v_target<>p_actor_id)
        OR (c->>'private'<>'true' AND NOT public.home_record_recipient(p_home_id,v_target,p_kind,v_visibility))
        OR (p_kind='task' AND NOT coalesce(public.home_task_source_access(p_home_id,v_target,t.source_mail_id),false)) THEN
        RETURN '{"ok":false,"code":"HOME_RECORD_RECIPIENT_DENIED","status":403}'::jsonb; END IF;
    END LOOP;
    c:=public.home_record_context(p_home_id,p_actor_id);
    IF NOT public.home_record_visible(c,p_kind,v_created_by,v_visibility)
      OR (c->>'private'='true' AND p_source_mail_id IS NOT NULL) THEN
      RETURN '{"ok":false,"code":"HOME_RECORD_DENIED","status":403}'::jsonb; END IF;
    v_now:=clock_timestamp();
    IF p_kind='task' THEN
      IF p_action='create' THEN
        IF m.linked_task_id IS NOT NULL THEN
          SELECT * INTO t FROM public."HomeTask" WHERE id=m.linked_task_id AND home_id=p_home_id
            AND created_by=p_actor_id AND source_mail_id=p_source_mail_id FOR UPDATE;
          IF NOT FOUND OR NOT public.home_task_readable(t,p_actor_id) THEN
            RETURN '{"ok":false,"code":"HOME_TASK_SOURCE_ALREADY_LINKED","status":409}'::jsonb; END IF;
          RETURN jsonb_build_object('ok',true,'record',to_jsonb(t),'replayed',true);
        END IF;
        INSERT INTO public."HomeTask"(home_id,created_by,task_type,title,description,assigned_to,due_at,recurrence_rule,
          status,priority,budget,details,visibility,viewer_user_ids,completed_at,is_recurring,mail_id)
          VALUES(p_home_id,p_actor_id,t.task_type,t.title,t.description,t.assigned_to,t.due_at,t.recurrence_rule,
            t.status,t.priority,t.budget,t.details,t.visibility,t.viewer_user_ids,t.completed_at,t.is_recurring,p_source_mail_id)
          RETURNING * INTO t;
        IF p_source_mail_id IS NOT NULL THEN UPDATE public."Mail" SET linked_task_id=t.id WHERE id=p_source_mail_id; END IF;
      ELSE
        UPDATE public."HomeTask" SET task_type=t.task_type,title=t.title,description=t.description,assigned_to=t.assigned_to,
          due_at=t.due_at,recurrence_rule=t.recurrence_rule,status=t.status,priority=t.priority,budget=t.budget,
          details=t.details,visibility=t.visibility,viewer_user_ids=t.viewer_user_ids,completed_at=t.completed_at,
          is_recurring=t.is_recurring,updated_at=v_now WHERE id=t.id RETURNING * INTO t;
      END IF;
      v_row:=to_jsonb(t);
    ELSE
      IF p_action='create' THEN
        INSERT INTO public."HomeCalendarEvent"(home_id,created_by,event_type,title,description,start_at,end_at,
          location_notes,recurrence_rule,assigned_to,alerts_enabled,request_rsvp,reminders,timezone,visibility)
          VALUES(p_home_id,p_actor_id,e.event_type,e.title,e.description,e.start_at,e.end_at,e.location_notes,
            e.recurrence_rule,e.assigned_to,e.alerts_enabled,e.request_rsvp,e.reminders,e.timezone,e.visibility) RETURNING * INTO e;
      ELSE
        UPDATE public."HomeCalendarEvent" SET event_type=e.event_type,title=e.title,description=e.description,start_at=e.start_at,
          end_at=e.end_at,location_notes=e.location_notes,recurrence_rule=e.recurrence_rule,assigned_to=e.assigned_to,
          alerts_enabled=e.alerts_enabled,request_rsvp=e.request_rsvp,reminders=e.reminders,timezone=e.timezone,
          visibility=e.visibility,updated_at=v_now WHERE id=e.id RETURNING * INTO e;
      END IF;
      v_row:=to_jsonb(e);
    END IF;
  END IF;
  v_action:='home_'||CASE p_kind WHEN 'task' THEN 'task' ELSE 'calendar' END||'_'||p_action||'d';
  INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
    VALUES(p_home_id,p_actor_id,v_action,CASE p_kind WHEN 'task' THEN 'HomeTask' ELSE 'HomeCalendarEvent' END,
      (v_row->>'id')::uuid,jsonb_build_object('private_setup',c->>'private'='true','created_by',v_row->'created_by','visibility',v_row->'visibility'));
  RETURN jsonb_build_object('ok',true,'record',v_row,'replayed',false,
    'notify_user_id',CASE WHEN p_kind='task' AND p_action='create' AND t.assigned_to IS DISTINCT FROM p_actor_id THEN t.assigned_to END);
END $$;

REVOKE ALL ON FUNCTION public.mutate_home_record(uuid,uuid,text,text,uuid,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mutate_home_record(uuid,uuid,text,text,uuid,jsonb,uuid) TO service_role;

REVOKE ALL ON FUNCTION public.lock_home_record_scope(uuid),
  public.home_record_own_setup_audit(public."HomeAuditLog",uuid),public.home_record_context(uuid,uuid),
  public.home_record_visible(jsonb,text,uuid,public.home_record_visibility),
  public.home_record_recipient(uuid,uuid,text,public.home_record_visibility),
  public.home_task_source_access(uuid,uuid,uuid,boolean),public.home_task_readable(public."HomeTask",uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lock_home_record_scope(uuid),
  public.home_record_own_setup_audit(public."HomeAuditLog",uuid),public.home_record_context(uuid,uuid),
  public.home_record_visible(jsonb,text,uuid,public.home_record_visibility),
  public.home_record_recipient(uuid,uuid,text,public.home_record_visibility),
  public.home_task_source_access(uuid,uuid,uuid,boolean),public.home_task_readable(public."HomeTask",uuid)
  TO service_role;

-- Existing mismatched media remain quarantined. The additive NOT VALID FK
-- fences every new attachment/change without deleting historical storage.
ALTER TABLE public."HomeTask" ADD CONSTRAINT home_task_id_home_unique UNIQUE(id,home_id);
ALTER TABLE public."HomeTaskMedia" ADD CONSTRAINT home_task_media_exact_home_fk
  FOREIGN KEY(task_id,home_id) REFERENCES public."HomeTask"(id,home_id) ON DELETE CASCADE NOT VALID;
CREATE FUNCTION public.protect_home_event_identity() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.home_id IS DISTINCT FROM OLD.home_id OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Event Home and author are immutable' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_home_event_identity BEFORE UPDATE ON public."HomeCalendarEvent"
FOR EACH ROW EXECUTE FUNCTION public.protect_home_event_identity();
REVOKE ALL ON FUNCTION public.protect_home_event_identity() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.home_task_private_setup(t public."HomeTask",u uuid) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
  SELECT coalesce(t.created_by=u AND t.visibility='members' AND t.mail_id IS NULL AND t.source_mail_id IS NULL
    AND t.linked_gig_id IS NULL AND t.converted_to_gig_id IS NULL
    AND (t.assigned_to IS NULL OR t.assigned_to=u)
    AND coalesce(t.viewer_user_ids,'{}'::uuid[]) <@ ARRAY[u]
    AND NOT coalesce(t.details ?| ARRAY['sourceMailId','source_mail_id'],false),false)
$$;
CREATE FUNCTION public.home_event_private_setup(e public."HomeCalendarEvent",u uuid) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
  SELECT coalesce(e.created_by=u AND e.visibility='members' AND coalesce(e.assigned_to,'{}'::uuid[]) <@ ARRAY[u],false)
$$;

CREATE FUNCTION public.get_home_records(p_home_id uuid,p_actor_id uuid,p_kind text,
  p_record_id uuid DEFAULT NULL,p_start_after timestamptz DEFAULT NULL,p_start_before timestamptz DEFAULT NULL,
  p_mail_only boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE c jsonb; t public."HomeTask"%ROWTYPE; e public."HomeCalendarEvent"%ROWTYPE;
  b public."Booking"%ROWTYPE; v_records jsonb:='[]'::jsonb; v_row jsonb; v_media jsonb; v_attendees jsonb:='[]'::jsonb;
  v_source uuid; v_title text; v_edit boolean; v_manage boolean;
BEGIN
  IF p_kind IS NULL OR p_kind NOT IN ('task','event') OR p_actor_id IS NULL
    OR NOT isfinite(p_start_after) OR NOT isfinite(p_start_before)
    OR p_start_after>p_start_before THEN RETURN '{"ok":false,"code":"HOME_RECORD_INVALID","status":400}'::jsonb; END IF;
  IF NOT public.lock_home_record_scope(p_home_id) THEN RETURN '{"ok":false,"code":"HOME_NOT_FOUND","status":404}'::jsonb; END IF;
  -- Lock original sources before tasks, matching Mail's SET NULL FK order.
  IF p_kind='task' THEN
    FOR v_source IN SELECT DISTINCT source_mail_id FROM public."HomeTask" WHERE home_id=p_home_id
      AND (p_record_id IS NULL OR id=p_record_id) AND source_mail_id IS NOT NULL ORDER BY source_mail_id LOOP
      PERFORM id FROM public."Mail" WHERE id=v_source FOR SHARE;
    END LOOP;
    PERFORM id FROM public."HomeTask" WHERE home_id=p_home_id AND (p_record_id IS NULL OR id=p_record_id) ORDER BY id FOR SHARE;
    PERFORM m.id FROM public."HomeTaskMedia" m JOIN public."HomeTask" r ON r.id=m.task_id AND r.home_id=m.home_id
      WHERE r.home_id=p_home_id AND (p_record_id IS NULL OR r.id=p_record_id) ORDER BY m.id FOR SHARE OF m;
  ELSE
    PERFORM id FROM public."HomeCalendarEvent" WHERE home_id=p_home_id AND (p_record_id IS NULL OR id=p_record_id) ORDER BY id FOR SHARE;
    PERFORM a.id FROM public."HomeCalendarEventAttendee" a JOIN public."HomeCalendarEvent" r ON r.id=a.event_id
      WHERE r.home_id=p_home_id AND (p_record_id IS NULL OR r.id=p_record_id) ORDER BY a.id FOR SHARE OF a;
    IF p_record_id IS NULL THEN
      PERFORM id FROM public."Booking" WHERE home_id=p_home_id AND owner_type='home' AND owner_id=p_home_id ORDER BY id FOR SHARE;
      PERFORM id FROM public."EventType" WHERE home_id=p_home_id AND owner_type='home' AND owner_id=p_home_id ORDER BY id FOR SHARE;
    END IF;
  END IF;
  c:=public.home_record_context(p_home_id,p_actor_id);
  IF c->>'allowed' IS DISTINCT FROM 'true' OR NOT c->'permissions' ? (CASE p_kind WHEN 'task' THEN 'tasks.view' ELSE 'calendar.view' END) THEN
    RETURN '{"ok":false,"code":"HOME_RECORD_DENIED","status":403}'::jsonb; END IF;
  v_edit:=c->'permissions' ? (CASE p_kind WHEN 'task' THEN 'tasks.edit' ELSE 'calendar.edit' END);
  v_manage:=c->'permissions' ? (CASE p_kind WHEN 'task' THEN 'tasks.manage' ELSE 'calendar.manage' END);
  IF p_kind='task' THEN
    FOR t IN SELECT * FROM public."HomeTask" WHERE home_id=p_home_id AND (p_record_id IS NULL OR id=p_record_id)
      AND (NOT p_mail_only OR source_mail_id IS NOT NULL) ORDER BY created_at DESC,id LOOP
      IF NOT public.home_task_readable(t,p_actor_id) THEN CONTINUE; END IF;
      SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'home_id',home_id,'task_id',task_id,'uploaded_by',uploaded_by,
        'file_name',file_name,'file_type',file_type,'mime_type',mime_type,'file_size',file_size,'created_at',created_at,
        'available',false,'availability_code','HOME_TASK_MEDIA_REUPLOAD_REQUIRED') ORDER BY created_at,id),'[]')
        INTO v_media FROM public."HomeTaskMedia" WHERE home_id=p_home_id AND task_id=t.id;
      v_row:=to_jsonb(t)||jsonb_build_object('media',v_media,'capabilities',jsonb_build_object(
        'can_edit',v_manage OR (v_edit AND t.created_by=p_actor_id),
        'can_complete',v_manage OR (v_edit AND (t.created_by=p_actor_id OR t.assigned_to IS NOT DISTINCT FROM p_actor_id)),
        'can_delete',(v_manage OR (v_edit AND t.created_by=p_actor_id))
          AND NOT EXISTS(SELECT FROM public."HomeTaskMedia" WHERE task_id=t.id),
        'can_upload',false));
      IF p_mail_only THEN
        SELECT v_row||jsonb_build_object('mail_preview',subject,'mail_sender',coalesce(sender_display,sender_business_name)) INTO v_row
          FROM public."Mail" WHERE id=t.source_mail_id;
      END IF;
      v_records:=v_records||jsonb_build_array(v_row);
    END LOOP;
  ELSE
    FOR e IN SELECT * FROM public."HomeCalendarEvent" WHERE home_id=p_home_id AND (p_record_id IS NULL OR id=p_record_id)
      AND (p_start_after IS NULL OR start_at>=p_start_after) AND (p_start_before IS NULL OR start_at<=p_start_before)
      ORDER BY start_at,id LOOP
      IF NOT public.home_record_visible(c,'event',e.created_by,e.visibility) THEN CONTINUE; END IF;
      v_records:=v_records||jsonb_build_array(to_jsonb(e)||jsonb_build_object('capabilities',jsonb_build_object(
        'can_edit',v_manage OR (v_edit AND e.created_by=p_actor_id),'can_delete',v_manage OR (v_edit AND e.created_by=p_actor_id),
        'can_rsvp',e.request_rsvp)));
      IF p_record_id IS NOT NULL THEN
        SELECT coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'rsvp_status',rsvp_status,'updated_at',updated_at) ORDER BY user_id),'[]')
          INTO v_attendees FROM public."HomeCalendarEventAttendee" WHERE event_id=e.id;
      END IF;
    END LOOP;
    -- Booking rows must agree on both owner and exact Home identity. EventType
    -- names also require the same Home; a foreign reference never leaks names.
    IF p_record_id IS NULL AND c->>'private'='false' THEN
      FOR b IN SELECT * FROM public."Booking" WHERE home_id=p_home_id AND owner_type='home' AND owner_id=p_home_id
        AND cohost_of_booking_id IS NULL AND status IN ('pending','confirmed')
        AND (p_start_after IS NULL OR start_at>=p_start_after) AND (p_start_before IS NULL OR start_at<=p_start_before)
        ORDER BY start_at,id LOOP
        SELECT name INTO v_title FROM public."EventType" WHERE id=b.event_type_id AND home_id=p_home_id AND owner_type='home' AND owner_id=p_home_id;
        v_title:=coalesce(v_title,CASE WHEN b.event_type_id IS NULL THEN 'Resource booking' ELSE 'Appointment' END);
        v_records:=v_records||jsonb_build_array(jsonb_build_object('id',b.id,'home_id',p_home_id,
          'event_type',CASE WHEN b.resource_id IS NULL THEN 'appointment' ELSE 'resource_booking' END,
          'title',v_title||CASE WHEN b.invitee_name IS NOT NULL AND b.invitee_name<>'' THEN ' — '||b.invitee_name ELSE '' END,
          'description',NULL,'start_at',b.start_at,'end_at',b.end_at,'location_notes',b.location_detail,
          'recurrence_rule',NULL,'assigned_to',CASE WHEN b.host_user_id IS NULL THEN NULL ELSE ARRAY[b.host_user_id] END,
          'alerts_enabled',true,'created_by',b.created_by,'visibility','members','source','booking',
          'booking_id',b.id,'booking_status',b.status,'capabilities',jsonb_build_object('can_edit',false,'can_delete',false,'can_rsvp',false)));
      END LOOP;
    END IF;
  END IF;
  -- No partial result if access expires while building the projection.
  c:=public.home_record_context(p_home_id,p_actor_id);
  IF c->>'allowed' IS DISTINCT FROM 'true' OR NOT c->'permissions' ? (CASE p_kind WHEN 'task' THEN 'tasks.view' ELSE 'calendar.view' END) THEN
    RETURN '{"ok":false,"code":"HOME_RECORD_DENIED","status":403}'::jsonb; END IF;
  IF p_record_id IS NOT NULL AND jsonb_array_length(v_records)=0 THEN
    RETURN '{"ok":false,"code":"HOME_RECORD_NOT_FOUND","status":404}'::jsonb; END IF;
  RETURN jsonb_build_object('ok',true,'records',v_records,'attendees',v_attendees);
END $$;
REVOKE ALL ON FUNCTION public.home_task_private_setup(public."HomeTask",uuid),
  public.home_event_private_setup(public."HomeCalendarEvent",uuid),
  public.get_home_records(uuid,uuid,text,uuid,timestamptz,timestamptz,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.home_task_private_setup(public."HomeTask",uuid),
  public.home_event_private_setup(public."HomeCalendarEvent",uuid),
  public.get_home_records(uuid,uuid,text,uuid,timestamptz,timestamptz,boolean) TO service_role;

-- Legacy mail routes identify a task without a Home path. Resolve only its
-- immutable Home identifier, then use the same exact current transaction.
CREATE FUNCTION public.mutate_home_task_by_id(p_actor_id uuid,p_task_id uuid,p_action text,p_payload jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE v_home_id uuid;
BEGIN
  SELECT home_id INTO v_home_id FROM public."HomeTask" WHERE id=p_task_id;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"HOME_RECORD_NOT_FOUND","status":404}'::jsonb; END IF;
  IF p_action NOT IN ('update','authorize_publication') OR p_action IS NULL THEN
    RETURN '{"ok":false,"code":"HOME_RECORD_INVALID","status":400}'::jsonb; END IF;
  RETURN public.mutate_home_record(v_home_id,p_actor_id,'task',p_action,p_task_id,p_payload);
END $$;
REVOKE ALL ON FUNCTION public.mutate_home_task_by_id(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mutate_home_task_by_id(uuid,uuid,text,jsonb) TO service_role;

-- Forward-only extension: exact authored private setup records and their own
-- audit history; attached storage and all established/foreign history still deny.
CREATE OR REPLACE FUNCTION public.home_secret_context(p_home_id uuid,p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_home public."Home"%ROWTYPE; v_occ public."HomeOccupancy"%ROWTYPE;
  v_access jsonb; v_role public.home_role_base; v_now timestamptz:=clock_timestamp();
  v_permissions text[]; v_denied constant jsonb:='{"allowed":false,"private":false,"permissions":[]}'::jsonb;
BEGIN
  IF p_actor_id IS NULL THEN RETURN v_denied; END IF;
  SELECT * INTO v_home FROM public."Home" WHERE id=p_home_id;
  IF NOT FOUND OR v_home.security_state IN ('frozen','frozen_silent') THEN RETURN v_denied; END IF;
  SELECT * INTO v_occ FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_actor_id;
  IF v_occ.id IS NOT NULL AND (v_occ.is_active IS DISTINCT FROM true OR v_occ.age_band IN ('child','teen')
    OR v_occ.start_at>v_now OR v_occ.end_at<=v_now OR v_occ.access_start_at>v_now OR v_occ.access_end_at<=v_now) THEN
    RETURN v_denied;
  END IF;
  v_access:=public.home_effective_access(p_home_id,p_actor_id);
  IF v_access->>'is_owner'='true' AND EXISTS (SELECT FROM public."HomeOwner" o WHERE o.home_id=p_home_id
    AND o.subject_type='user' AND o.subject_id=p_actor_id AND o.owner_status IN ('revoked','disputed'))
    AND NOT EXISTS (SELECT FROM public."HomeOwner" o WHERE o.home_id=p_home_id AND o.subject_type='user'
      AND o.subject_id=p_actor_id AND o.owner_status='verified') THEN RETURN v_denied; END IF;
  IF v_access->>'has_access'='true' THEN
    RETURN jsonb_build_object('allowed',true,'private',false,'permissions',v_access->'permissions',
      'role',v_access->>'effective_role_base');
  END IF;
  v_role:=coalesce(v_occ.role_base,CASE v_occ.role
    WHEN 'owner' THEN 'owner' WHEN 'admin' THEN 'admin' WHEN 'manager' THEN 'manager'
    WHEN 'property_manager' THEN 'manager' WHEN 'tenant' THEN 'lease_resident'
    WHEN 'renter' THEN 'lease_resident' WHEN 'lease_resident' THEN 'lease_resident'
    WHEN 'member' THEN 'member' WHEN 'roommate' THEN 'member' WHEN 'family' THEN 'member'
    WHEN 'restricted_member' THEN 'restricted_member' WHEN 'caregiver' THEN 'restricted_member'
    WHEN 'guest' THEN 'guest' WHEN 'service_provider' THEN 'service_provider' ELSE NULL END::public.home_role_base);
  IF v_home.created_by_user_id IS DISTINCT FROM p_actor_id
    OR (v_home.owner_id IS NOT NULL AND v_home.owner_id<>p_actor_id)
    OR v_occ.id IS NULL OR v_role IS NULL OR v_occ.verified_at IS NOT NULL
    OR v_occ.verification_status IS NULL OR v_occ.verification_status NOT IN ('pending_doc','provisional_bootstrap')
    OR EXISTS (SELECT FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id<>p_actor_id)
    OR EXISTS (SELECT FROM public."HomeOwner" WHERE home_id=p_home_id
      AND (subject_type<>'user' OR subject_id<>p_actor_id OR owner_status<>'pending')) THEN RETURN v_denied; END IF;
  -- Explicit private setup allowlist, separate from destructive deletion.
    IF EXISTS (SELECT FROM public."HomeOwnershipClaim" WHERE home_id = p_home_id
        AND (claimant_user_id <> p_actor_id OR state NOT IN ('draft','submitted') OR reviewed_by IS NOT NULL
          OR reviewed_at IS NOT NULL OR merged_into_claim_id IS NOT NULL))
      OR EXISTS (SELECT FROM public."HomeOwnershipClaim" foreign_claim JOIN public."HomeOwnershipClaim" own_claim
        ON foreign_claim.merged_into_claim_id = own_claim.id WHERE own_claim.home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeAuditLog" a WHERE a.home_id = p_home_id AND (
        a.actor_user_id IS DISTINCT FROM p_actor_id OR NOT coalesce(
          (a.action = 'OCCUPANCY_TEMPLATE_APPLIED' AND a.target_type = 'HomeOccupancy'
            AND a.target_id = v_occ.id
            AND a.metadata->>'verification_status' IN ('provisional_bootstrap','pending_doc'))
          OR public.home_secret_own_setup_audit(a,p_actor_id)
          OR public.home_record_own_setup_audit(a,p_actor_id)
          OR (a.action = 'OWNERSHIP_CLAIM_SUBMITTED' AND a.target_type = 'HomeOwnershipClaim'
            AND EXISTS (SELECT FROM public."HomeOwnershipClaim" c WHERE c.id = a.target_id
              AND c.home_id = p_home_id AND c.claimant_user_id = p_actor_id)),false)))
      OR EXISTS (SELECT FROM public."HomeAccessSecret" WHERE home_id = p_home_id AND created_by IS DISTINCT FROM p_actor_id)
      OR EXISTS (SELECT FROM public."HomePermissionOverride" WHERE home_id = p_home_id
        AND (user_id <> p_actor_id OR created_by IS DISTINCT FROM p_actor_id))
      OR EXISTS (SELECT FROM public."UnlistedRemoval" WHERE home_id = p_home_id AND user_id <> p_actor_id)
      OR EXISTS (SELECT FROM public."AddressCalendarRule" WHERE scope_type = 'home'
        AND public.home_calendar_scope_id(scope_key) = p_home_id AND created_by IS DISTINCT FROM p_actor_id)
      OR EXISTS (SELECT FROM public."HomeDocument" WHERE home_id=p_home_id)
      OR EXISTS (SELECT FROM public."CommunityMailItem" WHERE home_id=p_home_id)
      OR EXISTS (SELECT FROM public."HomeMapPin" WHERE home_id=p_home_id)
      OR EXISTS (SELECT FROM public."VacationHold" WHERE home_id=p_home_id)
      OR EXISTS (SELECT FROM public."MailDeliveryIntent" WHERE intended_home_id=p_home_id)
      OR EXISTS (SELECT FROM public."NeighborEndorsement" WHERE endorser_home_id=p_home_id)
      -- Own pending verification evidence does not confer shared-document access
      -- and does not make the creator lose access to their own Wi-Fi setup.
      OR EXISTS (SELECT FROM public."File" f WHERE f.home_id=p_home_id AND (
        f.user_id<>p_actor_id OR NOT EXISTS (SELECT FROM public."HomeVerificationEvidence" e
          JOIN public."HomeOwnershipClaim" c ON c.id=e.claim_id WHERE c.home_id=p_home_id
            AND c.claimant_user_id=p_actor_id AND c.state IN ('draft','submitted')
            AND c.reviewed_by IS NULL AND c.reviewed_at IS NULL AND e.storage_ref=f.file_path)))
      OR EXISTS (SELECT FROM public."HomeVerificationEvidence" e JOIN public."HomeOwnershipClaim" c ON c.id=e.claim_id
        JOIN public."File" f ON f.file_path=e.storage_ref WHERE c.home_id=p_home_id
          AND (f.user_id<>p_actor_id OR (f.home_id IS NOT NULL AND f.home_id<>p_home_id)))
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
      OR EXISTS (SELECT FROM public."HomeCalendarEvent" e WHERE home_id = p_home_id
        AND (NOT public.home_event_private_setup(e,p_actor_id)
          OR EXISTS (SELECT FROM public."HomeCalendarEventAttendee" a WHERE a.event_id=e.id AND a.user_id<>p_actor_id)))
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
      OR EXISTS (SELECT FROM public."HomeSeasonalChecklistItem" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeSubscription" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeSystem" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeTaskMedia" m WHERE home_id = p_home_id
        OR EXISTS(SELECT FROM public."HomeTask" t WHERE t.id=m.task_id AND t.home_id=p_home_id))
      OR EXISTS (SELECT FROM public."HomeTask" t WHERE home_id = p_home_id
        AND NOT public.home_task_private_setup(t,p_actor_id))
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
      RETURN v_denied;
    END IF;
  SELECT coalesce(array_agg(p::text),'{}'::text[]) INTO v_permissions
    FROM unnest(ARRAY['access.view_wifi','access.view_codes','access.manage']::public.home_permission[]) p
    WHERE NOT EXISTS (SELECT FROM public."HomePermissionOverride" o WHERE o.home_id=p_home_id
      AND o.user_id=p_actor_id AND o.permission=p AND NOT o.allowed)
    AND NOT EXISTS (SELECT FROM public."HomeRolePermission" r WHERE r.role_base=v_role AND r.permission=p AND NOT r.allowed
      AND NOT EXISTS (SELECT FROM public."HomePermissionOverride" o WHERE o.home_id=p_home_id
        AND o.user_id=p_actor_id AND o.permission=p AND o.allowed));
  RETURN jsonb_build_object('allowed',true,'private',true,'permissions',v_permissions,'role',v_role);
END;
$$;

-- Forward-only extension: exact authored private setup records and their own
-- audit history; attached storage and all established/foreign history still deny.
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
    OR EXISTS (SELECT FROM public."HomeTaskMedia" m WHERE home_id=p_home_id
      OR EXISTS(SELECT FROM public."HomeTask" t WHERE t.id=m.task_id AND t.home_id=p_home_id))
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
          OR public.home_record_own_setup_audit(a,p_user_id)
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
      OR EXISTS (SELECT FROM public."HomeCalendarEvent" e WHERE home_id = p_home_id
        AND (NOT public.home_event_private_setup(e,p_user_id)
          OR EXISTS (SELECT FROM public."HomeCalendarEventAttendee" a WHERE a.event_id=e.id AND a.user_id<>p_user_id)))
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
      OR EXISTS (SELECT FROM public."HomeTaskMedia" m WHERE home_id = p_home_id
        OR EXISTS(SELECT FROM public."HomeTask" t WHERE t.id=m.task_id AND t.home_id=p_home_id))
      OR EXISTS (SELECT FROM public."HomeTask" t WHERE home_id = p_home_id
        AND NOT public.home_task_private_setup(t,p_user_id))
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

-- Exact external task sharing must retain source-mail privacy after creation.
CREATE OR REPLACE FUNCTION public.home_external_share_resource(p_home_id uuid,p_actor_id uuid,p_recipient_id uuid,
  p_type text,p_id uuid,p_lock boolean DEFAULT true) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE v_source uuid; v_row jsonb; v_need public.home_permission; v_result jsonb; v_file public."File"%ROWTYPE;
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
      SELECT source_mail_id INTO v_source FROM public."HomeTask" WHERE home_id=p_home_id AND id=p_id;
      IF NOT coalesce(public.home_task_source_access(p_home_id,p_actor_id,v_source,true),false) THEN RETURN NULL; END IF;
      IF p_lock THEN PERFORM id FROM public."HomeTask" WHERE home_id=p_home_id AND id=p_id FOR UPDATE; END IF;
      SELECT to_jsonb(s) INTO v_row FROM public."HomeTask" s WHERE home_id=p_home_id AND id=p_id;
      IF v_row->>'source_mail_id' IS NULL AND (v_row->'details') ?| ARRAY['sourceMailId','source_mail_id'] THEN RETURN NULL; END IF;
      IF NOT coalesce(public.home_task_source_access(p_home_id,p_actor_id,(v_row->>'source_mail_id')::uuid,true),false) THEN RETURN NULL; END IF;
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
