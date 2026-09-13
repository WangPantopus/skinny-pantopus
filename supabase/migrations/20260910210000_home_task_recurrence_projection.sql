-- Backwards compatible: yes. Additive current schedule summaries on already
-- permitted tasks. Original RRULEs and role/record boundaries stay unchanged.
SET LOCAL lock_timeout='5s';

CREATE OR REPLACE FUNCTION public.get_home_records(p_home_id uuid,p_actor_id uuid,p_kind text,
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
      SELECT coalesce(jsonb_agg(CASE WHEN i.id IS NOT NULL AND i.state='ready' THEN public.home_task_media_projection(i)
        ELSE jsonb_build_object('id',m.id,'home_id',m.home_id,'task_id',m.task_id,'uploaded_by',m.uploaded_by,
          'file_name',coalesce(m.file_name,'Attachment'),'file_type',m.file_type,'mime_type',m.mime_type,
          'file_size',coalesce(m.file_size,0),'created_at',m.created_at,'state','legacy',
          'available',false,'availability_code','HOME_TASK_MEDIA_REUPLOAD_REQUIRED') END ORDER BY m.created_at,m.id),'[]')
        INTO v_media FROM public."HomeTaskMedia" m LEFT JOIN public."HomeTaskMediaIntent" i ON i.id=m.private_upload_id
          AND i.home_id=m.home_id AND i.task_id=m.task_id WHERE m.home_id=p_home_id AND m.task_id=t.id;
      v_row:=to_jsonb(t)||jsonb_build_object('media',v_media,'capabilities',jsonb_build_object(
        'can_edit',v_manage OR (v_edit AND t.created_by=p_actor_id),
        'can_complete',v_manage OR (v_edit AND (t.created_by=p_actor_id OR t.assigned_to IS NOT DISTINCT FROM p_actor_id)),
        'can_delete',(v_manage OR (v_edit AND t.created_by=p_actor_id))
          AND NOT EXISTS(SELECT FROM public."HomeTaskMedia" WHERE task_id=t.id AND private_upload_id IS NULL),
        'can_upload',v_manage OR (v_edit AND t.created_by=p_actor_id)));
      -- The task is already authorized above. Expose schedule status without
      -- command receipts, activating identities or another task's identifier.
      v_row:=v_row||jsonb_build_object('automatic_recurrence',(SELECT jsonb_build_object(
        'state',CASE WHEN s.state='active' AND (t.status='canceled'
          OR public.home_task_recurrence_source_hash(t)<>s.source_hash) THEN 'needs_review' ELSE s.state END,
        'frequency',s.frequency,'interval',s.step,'timezone',s.timezone,
        'next_due_at',CASE WHEN s.state='active' AND t.status<>'canceled'
          AND public.home_task_recurrence_source_hash(t)=s.source_hash THEN s.next_due_at END)
        FROM public."HomeTaskRecurrence" s WHERE s.home_id=p_home_id AND s.source_task_id=t.id));
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
  -- Derive collection creation from the same final current context as the
  -- records. This preserves the explicit private-creator exception without
  -- introducing a role default or relying on generic Home membership.
  RETURN jsonb_build_object('ok',true,'records',v_records,'attendees',v_attendees,
    'can_create',coalesce(c->'permissions' ?| CASE p_kind
      WHEN 'task' THEN ARRAY['tasks.edit','tasks.manage']
      ELSE ARRAY['calendar.edit','calendar.manage'] END,false));
END $$;
REVOKE ALL ON FUNCTION public.get_home_records(uuid,uuid,text,uuid,timestamptz,timestamptz,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_home_records(uuid,uuid,text,uuid,timestamptz,timestamptz,boolean) TO service_role;
