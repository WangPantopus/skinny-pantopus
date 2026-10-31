-- Backwards compatible: yes. Replaces three function bodies in place (same names, signatures, owners, grants and
-- triggers); no table, column, constraint or data change. The deployed backend reads the same delivery fields.
--
-- Someone who never changed the account-level Push Notifications switch has no MailPreferences row: the column default
-- (on) applies, Settings shows it on, and notificationService.pushSwitchOn has treated a missing row as on since
-- 2026-10-06 (chat delivery too, 20261023210000). Three delivery captures still required a row with
-- push_notifications = true, so those people got the bell notice without a phone push for:
--   - a Home task assigned to them (mutate_home_record_before_default_visibility);
--   - a tip on their gig (capture_gig_tip_notification);
--   - gig completion, confirmation and closed-bid notices (capture_gig_completion_delivery).
-- Now only an explicit off (push_notifications = false) holds the push back, as everywhere else. The per-type switches
-- (home_reminders_enabled, gig_updates_enabled) are unchanged. Already-recorded deliveries keep their decision.
-- Latest permitted sources: supabase/migrations/20260910180000_home_task_assignment_delivery.sql:65 (as
-- public.mutate_home_record; 20260930080000 renamed it), 20260922021300_gig_tip_notification_delivery.sql:13 and
-- 20260922021800_gig_completion_delivery.sql:21.
SET LOCAL lock_timeout='5s';

CREATE OR REPLACE FUNCTION public.mutate_home_record_before_default_visibility(p_home_id uuid,p_actor_id uuid,p_kind text,p_action text,
  p_record_id uuid DEFAULT NULL,p_payload jsonb DEFAULT '{}',p_source_mail_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE r jsonb; before_assignee uuid; t public."HomeTask"; n public."Notification";
  push_allowed boolean; event_id uuid;
BEGIN
  IF p_kind='task' AND p_action IN ('create','update') THEN
    IF NOT public.lock_home_record_scope(p_home_id) THEN
      RETURN '{"ok":false,"code":"HOME_NOT_FOUND","status":404}'::jsonb; END IF;
    -- Home lock serializes all supported task writers. The preserved mutator
    -- then obtains source-Mail and task locks in their original order.
    SELECT assigned_to INTO before_assignee FROM public."HomeTask"
      WHERE home_id=p_home_id AND id=p_record_id;
  END IF;
  r:=public.mutate_home_record_before_assignment_delivery(p_home_id,p_actor_id,p_kind,p_action,p_record_id,p_payload,p_source_mail_id);
  IF r->>'ok' IS DISTINCT FROM 'true' OR r->>'replayed'='true' OR p_kind<>'task'
    OR p_action NOT IN ('create','update') THEN RETURN r; END IF;
  SELECT * INTO t FROM public."HomeTask" WHERE home_id=p_home_id AND id=(r->'record'->>'id')::uuid;
  IF t.id IS NULL OR t.assigned_to IS NULL OR t.assigned_to=p_actor_id
    OR t.status NOT IN ('open','in_progress')
    OR (p_action='update' AND t.assigned_to IS NOT DISTINCT FROM before_assignee) THEN RETURN r; END IF;
  -- Current recipient access and assignment have already been locked/validated
  -- by the original mutator. A private first-use Home permits only self assignment.
  IF NOT public.home_task_readable(t,t.assigned_to) THEN
    RAISE EXCEPTION 'Task notification recipient changed' USING ERRCODE='40001'; END IF;
  SELECT coalesce((SELECT push_notifications FROM public."MailPreferences" WHERE user_id=t.assigned_to),true)
    AND coalesce((SELECT home_reminders_enabled FROM public."UserNotificationPreferences" WHERE user_id=t.assigned_to),true)
    INTO push_allowed;
  event_id:=gen_random_uuid();
  -- Notification text deliberately contains no task title, Home address, mail
  -- content or actor name. Only the authorized task read exposes private details.
  INSERT INTO public."Notification"(user_id,type,title,body,icon,link,metadata,context,context_type)
    VALUES(t.assigned_to,'task_assigned','A Home task was assigned to you',
      'Open Pantopus to view the current task details.','📋',
      '/app/homes/'||p_home_id||'/dashboard?tab=tasks',
      jsonb_build_object('home_id',p_home_id,'task_id',t.id,'assignment_event_id',event_id),
      'personal','personal') RETURNING * INTO n;
  INSERT INTO public."HomeTaskAssignmentDelivery"(id,home_id,task_id,actor_id,user_id,notification_id,
    notification_snapshot,push_allowed_at_assignment)
    VALUES(event_id,p_home_id,t.id,p_actor_id,t.assigned_to,n.id,public.home_task_assignment_note_snapshot(n),push_allowed);
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.mutate_home_record_before_default_visibility(uuid,uuid,text,text,uuid,jsonb,uuid)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.capture_gig_tip_notification() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE prior jsonb; delivery jsonb; n public."Notification"; title_text text; allowed boolean; reused boolean;
BEGIN
 IF TG_OP='UPDATE' THEN prior:=OLD.metadata->'gig_tip_delivery_v1'; END IF;
 delivery:=NEW.metadata->'gig_tip_delivery_v1';
 IF delivery IS DISTINCT FROM prior AND NOT (current_user IN ('postgres','service_role','supabase_admin')
  AND coalesce(current_setting('app.gig_tip_delivery',true),'')='on') THEN
  RAISE EXCEPTION 'Use the tip delivery transaction' USING ERRCODE='42501'; END IF;
 -- Capture is already bound to fresh provider proof by the existing service/
 -- original transaction. Historical adoption/replay must not replay old alerts.
 IF NEW.payment_type IS DISTINCT FROM 'tip' OR NEW.payment_status IS DISTINCT FROM 'captured_hold'
  OR NEW.captured_at IS NULL OR NEW.payment_succeeded_at IS NULL OR NEW.gig_id IS NULL
  OR NEW.payee_id IS NULL OR NEW.amount_total IS NULL OR NEW.amount_total<50
  OR lower(NEW.currency) IS DISTINCT FROM 'usd' OR NEW.stripe_charge_id IS NULL
  OR NEW.stripe_payment_intent_id IS NULL OR delivery IS NOT NULL
  OR NEW.metadata->>'tip_notification_sent_at' IS NOT NULL THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND (OLD.captured_at IS NOT NULL OR OLD.payment_succeeded_at IS NOT NULL) THEN RETURN NEW; END IF;
 IF current_user NOT IN ('postgres','service_role','supabase_admin') THEN
  RAISE EXCEPTION 'Tip capture notification requires service authority' USING ERRCODE='42501'; END IF;
 SELECT * INTO n FROM public."Notification" WHERE user_id=NEW.payee_id AND type='tip_received'
  AND (idempotency_key='gig-tip-received:'||NEW.id OR metadata->>'payment_id'=NEW.id::text)
  ORDER BY created_at,id LIMIT 1;
 reused:=FOUND;
 IF NOT reused THEN
  SELECT title INTO title_text FROM public."Gig" WHERE id=NEW.gig_id;
  INSERT INTO public."Notification"(user_id,type,title,body,icon,link,metadata,idempotency_key)
   VALUES(NEW.payee_id,'tip_received','You received a tip!',
    'The poster of "'||coalesce(nullif(title_text,''),'a gig')||'" sent you a $'||to_char(NEW.amount_total/100.0,'FM9999999990.00')||' tip. 🎉',
    '💰','/gigs/'||NEW.gig_id,jsonb_build_object('gig_id',NEW.gig_id,'amount',NEW.amount_total,'payment_id',NEW.id),
    'gig-tip-received:'||NEW.id) RETURNING * INTO n;
 END IF;
 allowed:=NOT EXISTS(SELECT FROM public."MailPreferences" WHERE user_id=NEW.payee_id AND push_notifications IS FALSE)
  AND NOT EXISTS(SELECT FROM public."UserNotificationPreferences" WHERE user_id=NEW.payee_id AND gig_updates_enabled=false);
 NEW.metadata:=coalesce(NEW.metadata,'{}'::jsonb)||jsonb_build_object('gig_tip_delivery_v1',jsonb_build_object(
  'version',1,'notification_id',n.id,'payment',public.gig_tip_delivery_payment(NEW),
  'notification',public.gig_expiry_note_snapshot(n),'push_allowed_at_capture',allowed,
  'state',CASE WHEN reused THEN 'suppressed' ELSE 'pending' END,'attempts',0,'retry_at',clock_timestamp(),
  'completed_at',CASE WHEN reused THEN to_jsonb(clock_timestamp()) ELSE 'null'::jsonb END));
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.capture_gig_completion_delivery() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE prior jsonb; d jsonb; phase text; g public."Gig"; allowed boolean;
BEGIN
 IF TG_OP='UPDATE' THEN prior:=OLD.metadata->'gig_completion_delivery_v1'; END IF;
 d:=NEW.metadata->'gig_completion_delivery_v1';
 IF d IS DISTINCT FROM prior AND NOT (current_user IN ('postgres','service_role','supabase_admin')
  AND coalesce(current_setting('app.gig_completion_delivery',true),'')='on') THEN
  RAISE EXCEPTION 'Use the completion delivery transaction' USING ERRCODE='42501'; END IF;
 -- Ordinary/historical notices and user read-state changes are unaffected.
 IF TG_OP<>'INSERT' OR d IS NOT NULL THEN RETURN NEW; END IF;
 phase:=CASE WHEN NEW.type='gig_completed' AND NEW.idempotency_key LIKE 'gig-worker-completion:%' THEN 'worker'
  WHEN NEW.type='gig_confirmed' AND NEW.idempotency_key LIKE 'gig-confirmation:%' THEN 'owner'
  WHEN NEW.type='bid_rejected' AND NEW.idempotency_key LIKE 'gig-completion-bid:%' THEN 'bid' END;
 IF phase IS NULL THEN RETURN NEW; END IF;
 IF current_user NOT IN ('postgres','service_role','supabase_admin') THEN
  RAISE EXCEPTION 'Completion delivery requires service authority' USING ERRCODE='42501'; END IF;
 SELECT * INTO g FROM public."Gig" WHERE id=(NEW.metadata->>'gig_id')::uuid;
 IF NOT FOUND OR g.status IS DISTINCT FROM 'completed' OR g.worker_completed_at IS NULL
  OR NOT isfinite(g.worker_completed_at) OR NEW.context IS DISTINCT FROM 'personal'
  OR NEW.context_type IS DISTINCT FROM 'personal' OR NEW.context_id IS NOT NULL
  OR NEW.link IS DISTINCT FROM '/gigs/'||g.id
  OR (phase='worker' AND (g.owner_confirmed_at IS NOT NULL OR NEW.user_id=g.accepted_by
   OR NOT coalesce(NEW.user_id=g.user_id OR public.business_has_permission(g.user_id,'gigs.manage',NEW.user_id)
    OR public.business_has_permission(g.user_id,'gigs.post',NEW.user_id),false)))
  OR (phase<>'worker' AND (g.owner_confirmed_at IS NULL OR NOT isfinite(g.owner_confirmed_at)))
  OR (phase='owner' AND NEW.user_id IS DISTINCT FROM g.accepted_by)
  OR (phase='bid' AND NOT EXISTS(SELECT FROM public."GigBid" WHERE gig_id=g.id AND user_id=NEW.user_id AND status='rejected')) THEN
  RAISE EXCEPTION 'Completion notification does not match its receipt' USING ERRCODE='23514'; END IF;
 allowed:=NOT EXISTS(SELECT FROM public."MailPreferences" WHERE user_id=NEW.user_id AND push_notifications IS FALSE)
  AND NOT EXISTS(SELECT FROM public."UserNotificationPreferences" WHERE user_id=NEW.user_id AND gig_updates_enabled=false);
 NEW.metadata:=coalesce(NEW.metadata,'{}')||jsonb_build_object('gig_completion_delivery_v1',jsonb_build_object(
  'version',1,'phase',phase,'terms_hash',public.gig_completion_delivery_terms(g,phase),
  'note_hash',public.gig_completion_delivery_note(NEW),'push_allowed_at_completion',allowed,
  'state','pending','attempts',0,'retry_at',clock_timestamp(),'completed_at',NULL));
 RETURN NEW;
END $$;
