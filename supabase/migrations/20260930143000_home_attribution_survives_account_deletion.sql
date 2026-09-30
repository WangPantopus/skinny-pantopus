-- Backwards compatible: yes. Makes 15 attribution columns nullable and re-creates
-- their User foreign keys with ON DELETE SET NULL; lets three guard triggers
-- accept an author cleared to NULL (never changed to another user); keeps task and
-- event capabilities boolean and the Home record write check closed when the
-- author is NULL; keeps such a document downloadable from an external share; lets
-- a Home document file be owned by the household; adds one User BEFORE DELETE
-- trigger that leaves a member's Home document files with the household. No rows
-- change when applied. The deployed backend and apps never write NULL to these
-- columns; they only meet it once a member has deleted their account. Deploy order
-- does not matter.
--
-- DELETE /api/users/account nulls these attribution columns and then deletes the
-- User row, but each column was NOT NULL (and three guard triggers refused an
-- author change), so anyone who had ever created a Home record, a map pin, a
-- community mail item or a mail asset link got 409 ACCOUNT_RECORDS_RETAINED
-- ("contact support") and could not delete their account in the app. These
-- records belong to the household or the community: they stay without an author
-- (the document detail shows "Former member"; no other screen shows the author).
-- Without a cleared author only managers may change a task or event; members who
-- can edit their own records can still complete tasks assigned to them.
--
-- Guard triggers:
-- * protect_home_task_identity / protect_home_event_identity: the author stays
--   immutable except that it may be cleared to NULL.
-- * protect_home_document_record: a document whose author was cleared no longer
--   has to match its File owner.
-- * retire_home_document_owner (new, BEFORE DELETE on User): the member's
--   home_document_v1 File rows lose their owner instead of being removed by
--   File.user_id ON DELETE CASCADE, so the household keeps its documents and the
--   document guard never sees file_id cleared. Lease evidence and every other
--   personal file are retired or deleted with the account exactly as before.
SET LOCAL lock_timeout='5s';

ALTER TABLE public."HomeTask" ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public."HomeTask" DROP CONSTRAINT "HomeTask_created_by_fkey";
ALTER TABLE public."HomeTask" ADD CONSTRAINT "HomeTask_created_by_fkey"
  FOREIGN KEY (created_by) REFERENCES public."User"(id) ON DELETE SET NULL;

ALTER TABLE public."HomeBill" ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public."HomeBill" DROP CONSTRAINT "HomeBill_created_by_fkey";
ALTER TABLE public."HomeBill" ADD CONSTRAINT "HomeBill_created_by_fkey"
  FOREIGN KEY (created_by) REFERENCES public."User"(id) ON DELETE SET NULL;

ALTER TABLE public."HomeDocument" ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public."HomeDocument" DROP CONSTRAINT "HomeDocument_created_by_fkey";
ALTER TABLE public."HomeDocument" ADD CONSTRAINT "HomeDocument_created_by_fkey"
  FOREIGN KEY (created_by) REFERENCES public."User"(id) ON DELETE SET NULL;

ALTER TABLE public."HomeAsset" ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public."HomeAsset" DROP CONSTRAINT "HomeAsset_created_by_fkey";
ALTER TABLE public."HomeAsset" ADD CONSTRAINT "HomeAsset_created_by_fkey"
  FOREIGN KEY (created_by) REFERENCES public."User"(id) ON DELETE SET NULL;

ALTER TABLE public."HomeDevice" ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public."HomeDevice" DROP CONSTRAINT "HomeDevice_created_by_fkey";
ALTER TABLE public."HomeDevice" ADD CONSTRAINT "HomeDevice_created_by_fkey"
  FOREIGN KEY (created_by) REFERENCES public."User"(id) ON DELETE SET NULL;

ALTER TABLE public."HomeVendor" ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public."HomeVendor" DROP CONSTRAINT "HomeVendor_created_by_fkey";
ALTER TABLE public."HomeVendor" ADD CONSTRAINT "HomeVendor_created_by_fkey"
  FOREIGN KEY (created_by) REFERENCES public."User"(id) ON DELETE SET NULL;

ALTER TABLE public."HomeSubscription" ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public."HomeSubscription" DROP CONSTRAINT "HomeSubscription_created_by_fkey";
ALTER TABLE public."HomeSubscription" ADD CONSTRAINT "HomeSubscription_created_by_fkey"
  FOREIGN KEY (created_by) REFERENCES public."User"(id) ON DELETE SET NULL;

ALTER TABLE public."HomeCalendarEvent" ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public."HomeCalendarEvent" DROP CONSTRAINT "HomeCalendarEvent_created_by_fkey";
ALTER TABLE public."HomeCalendarEvent" ADD CONSTRAINT "HomeCalendarEvent_created_by_fkey"
  FOREIGN KEY (created_by) REFERENCES public."User"(id) ON DELETE SET NULL;

ALTER TABLE public."HomeMaintenanceTemplate" ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public."HomeMaintenanceTemplate" DROP CONSTRAINT "HomeMaintenanceTemplate_created_by_fkey";
ALTER TABLE public."HomeMaintenanceTemplate" ADD CONSTRAINT "HomeMaintenanceTemplate_created_by_fkey"
  FOREIGN KEY (created_by) REFERENCES public."User"(id) ON DELETE SET NULL;

ALTER TABLE public."HomePackage" ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public."HomePackage" DROP CONSTRAINT "HomePackage_created_by_fkey";
ALTER TABLE public."HomePackage" ADD CONSTRAINT "HomePackage_created_by_fkey"
  FOREIGN KEY (created_by) REFERENCES public."User"(id) ON DELETE SET NULL;

ALTER TABLE public."HomeEmergency" ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public."HomeEmergency" DROP CONSTRAINT "HomeEmergency_created_by_fkey";
ALTER TABLE public."HomeEmergency" ADD CONSTRAINT "HomeEmergency_created_by_fkey"
  FOREIGN KEY (created_by) REFERENCES public."User"(id) ON DELETE SET NULL;

ALTER TABLE public."HomeIssue" ALTER COLUMN reported_by DROP NOT NULL;
ALTER TABLE public."HomeIssue" DROP CONSTRAINT "HomeIssue_reported_by_fkey";
ALTER TABLE public."HomeIssue" ADD CONSTRAINT "HomeIssue_reported_by_fkey"
  FOREIGN KEY (reported_by) REFERENCES public."User"(id) ON DELETE SET NULL;

ALTER TABLE public."HomeMapPin" ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public."HomeMapPin" DROP CONSTRAINT "HomeMapPin_created_by_fkey";
ALTER TABLE public."HomeMapPin" ADD CONSTRAINT "HomeMapPin_created_by_fkey"
  FOREIGN KEY (created_by) REFERENCES public."User"(id) ON DELETE SET NULL;

ALTER TABLE public."CommunityMailItem" ALTER COLUMN published_by DROP NOT NULL;
ALTER TABLE public."CommunityMailItem" DROP CONSTRAINT "CommunityMailItem_published_by_fkey";
ALTER TABLE public."CommunityMailItem" ADD CONSTRAINT "CommunityMailItem_published_by_fkey"
  FOREIGN KEY (published_by) REFERENCES public."User"(id) ON DELETE SET NULL;

ALTER TABLE public."MailAssetLink" ALTER COLUMN linked_by DROP NOT NULL;
ALTER TABLE public."MailAssetLink" DROP CONSTRAINT "MailAssetLink_linked_by_fkey";
ALTER TABLE public."MailAssetLink" ADD CONSTRAINT "MailAssetLink_linked_by_fkey"
  FOREIGN KEY (linked_by) REFERENCES public."User"(id) ON DELETE SET NULL;

-- The task author may be cleared (account deletion), never changed to someone else.
CREATE OR REPLACE FUNCTION public.protect_home_task_identity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.source_mail_id IS NOT NULL AND NEW.source_mail_id IS DISTINCT FROM NEW.mail_id THEN
      RAISE EXCEPTION 'Task source does not match its mail' USING ERRCODE='23514'; END IF;
    NEW.source_mail_id:=NEW.mail_id;
  ELSE
    IF NEW.home_id IS DISTINCT FROM OLD.home_id
      OR (NEW.created_by IS NOT NULL AND NEW.created_by IS DISTINCT FROM OLD.created_by)
      OR NEW.source_mail_id IS DISTINCT FROM OLD.source_mail_id
      OR (NEW.mail_id IS NOT NULL AND NEW.mail_id IS DISTINCT FROM OLD.mail_id) THEN
      RAISE EXCEPTION 'Task Home, author and source are immutable' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $function$;

-- The event author may be cleared (account deletion), never changed to someone else.
CREATE OR REPLACE FUNCTION public.protect_home_event_identity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.home_id IS DISTINCT FROM OLD.home_id
    OR (NEW.created_by IS NOT NULL AND NEW.created_by IS DISTINCT FROM OLD.created_by) THEN
    RAISE EXCEPTION 'Event Home and author are immutable' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $function$;

-- A document whose author was cleared no longer has to match its File owner.
CREATE OR REPLACE FUNCTION public.protect_home_document_record()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_protected boolean; v_file public."File"%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_protected := NEW.details->>'storage_contract' = 'home_document_v1';
  ELSIF TG_OP = 'DELETE' THEN
    v_protected := OLD.details->>'storage_contract' = 'home_document_v1';
  ELSE
    v_protected := OLD.details->>'storage_contract' = 'home_document_v1'
      OR NEW.details->>'storage_contract' = 'home_document_v1';
  END IF;
  IF coalesce(v_protected, false) THEN
    IF current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
      RAISE EXCEPTION 'Use the authenticated Home document API' USING ERRCODE = '42501';
    END IF;
    IF TG_OP <> 'DELETE' THEN
      SELECT * INTO v_file FROM public."File" WHERE id = NEW.file_id FOR UPDATE;
      IF NOT FOUND OR v_file.is_deleted IS DISTINCT FROM false
        OR v_file.id IS DISTINCT FROM NEW.id OR v_file.home_id IS DISTINCT FROM NEW.home_id
        OR (NEW.created_by IS NOT NULL AND v_file.user_id IS DISTINCT FROM NEW.created_by)
        OR v_file.metadata->>'storage_contract' IS DISTINCT FROM 'home_document_v1'
        OR v_file.metadata->>'upload_fingerprint' IS DISTINCT FROM NEW.details->>'upload_fingerprint' THEN
        RAISE EXCEPTION 'Home document upload is unavailable or changed' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

-- Task and event capabilities stay booleans (false) when the author was cleared: a
-- JSON null here made the Android task list fail to decode for members who can
-- edit but not manage. Only the author comparisons change.
CREATE OR REPLACE FUNCTION public.get_home_records(p_home_id uuid, p_actor_id uuid, p_kind text, p_record_id uuid DEFAULT NULL::uuid, p_start_after timestamp with time zone DEFAULT NULL::timestamp with time zone, p_start_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_mail_only boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
 SET lock_timeout TO '5s'
AS $function$
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
        'can_edit',v_manage OR (v_edit AND coalesce(t.created_by=p_actor_id,false)),
        'can_complete',v_manage OR (v_edit AND (coalesce(t.created_by=p_actor_id,false) OR t.assigned_to IS NOT DISTINCT FROM p_actor_id)),
        'can_delete',(v_manage OR (v_edit AND coalesce(t.created_by=p_actor_id,false)))
          AND NOT EXISTS(SELECT FROM public."HomeTaskMedia" WHERE task_id=t.id AND private_upload_id IS NULL),
        'can_upload',v_manage OR (v_edit AND coalesce(t.created_by=p_actor_id,false))));
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
        'can_edit',v_manage OR (v_edit AND coalesce(e.created_by=p_actor_id,false)),'can_delete',v_manage OR (v_edit AND coalesce(e.created_by=p_actor_id,false)),
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
END $function$;

-- The write check denies a member who can edit but not manage once the author was
-- cleared (a bare comparison with a NULL author is NULL, which would let the write
-- through); managers keep full access. The private-setup checks use IS DISTINCT
-- FROM for the same reason. Only these three comparisons change.
CREATE OR REPLACE FUNCTION public.mutate_home_record_before_assignment_delivery(p_home_id uuid, p_actor_id uuid, p_kind text, p_action text, p_record_id uuid DEFAULT NULL::uuid, p_payload jsonb DEFAULT '{}'::jsonb, p_source_mail_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
 SET lock_timeout TO '5s'
AS $function$
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
    IF c->>'private'='true' AND e.created_by IS DISTINCT FROM p_actor_id THEN RETURN '{"ok":false,"code":"HOME_RECORD_DENIED","status":403}'::jsonb; END IF;
    INSERT INTO public."HomeCalendarEventAttendee"(event_id,user_id,rsvp_status)
      VALUES(e.id,p_actor_id,(p_payload->>'status')::public.booking_rsvp_status)
      ON CONFLICT(event_id,user_id) DO UPDATE SET rsvp_status=excluded.rsvp_status,updated_at=clock_timestamp()
      RETURNING jsonb_build_object('user_id',user_id,'rsvp_status',rsvp_status) INTO v_row;
    RETURN jsonb_build_object('ok',true,'attendee',v_row);
  END IF;
  v_status_only:=p_kind='task' AND p_action='update' AND t.assigned_to=p_actor_id AND v_edit
    AND p_payload ? 'status' AND p_payload->>'status' IN ('open','in_progress','done')
    AND NOT EXISTS(SELECT FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('status','completed_at'));
  IF NOT (v_manage OR (v_edit AND (p_action='create' OR coalesce(v_created_by=p_actor_id,false))) OR coalesce(v_status_only,false)) THEN
    RETURN '{"ok":false,"code":"HOME_RECORD_WRITE_DENIED","status":403}'::jsonb; END IF;
  IF c->>'private'='true' AND p_action<>'create' AND v_created_by IS DISTINCT FROM p_actor_id THEN
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
END $function$;

-- A shared document whose uploader deleted their account stays downloadable from
-- guest passes and scoped grants: its author and its file owner are both NULL, which
-- a bare comparison treated as a mismatch. Only this comparison changes.
CREATE OR REPLACE FUNCTION public.home_external_share_resource(p_home_id uuid, p_actor_id uuid, p_recipient_id uuid, p_type text, p_id uuid, p_lock boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
 SET lock_timeout TO '5s'
AS $function$
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
        AND v_file.user_id IS NOT DISTINCT FROM (v_row->>'created_by')::uuid
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
END $function$;

-- A Home document's file may be owned by the household (no user) once its uploader
-- deleted their account; lease evidence and gig-completion files keep their rule.
ALTER TABLE public."File" DROP CONSTRAINT file_owner_or_retired_private_evidence;
ALTER TABLE public."File" ADD CONSTRAINT file_owner_or_retired_private_evidence CHECK (
  user_id IS NOT NULL
  OR coalesce(is_deleted AND metadata->>'storage_contract' = ANY (ARRAY['home_lease_evidence_v1', 'gig_completion_v1']), false)
  OR coalesce(metadata->>'storage_contract' = 'home_document_v1', false));

-- A member's Home documents belong to the household: when the member's account is
-- deleted, their document files lose the owner link instead of being deleted by
-- File.user_id ON DELETE CASCADE.
CREATE FUNCTION public.retire_home_document_owner()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public."HomeDocument" SET created_by = NULL WHERE created_by = OLD.id;
  UPDATE public."File" SET user_id = NULL, updated_at = now()
   WHERE user_id = OLD.id AND metadata->>'storage_contract' = 'home_document_v1';
  RETURN OLD;
END $function$;

REVOKE ALL ON FUNCTION public.retire_home_document_owner() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER retire_home_document_owner BEFORE DELETE ON public."User"
  FOR EACH ROW EXECUTE FUNCTION public.retire_home_document_owner();
