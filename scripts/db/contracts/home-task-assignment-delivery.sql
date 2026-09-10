-- Atomic task assignment notices, preference snapshot and current recipient access.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE TEMP TABLE create_roles_before AS SELECT jsonb_agg(to_jsonb(r) ORDER BY role_base,permission) rows FROM public."HomeRolePermission" r;
INSERT INTO auth.users(id,email) SELECT ('ddf18000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 'assignment-delivery-'||n||'@example.invalid' FROM generate_series(1,4)n;
INSERT INTO public."User"(id,email,username,name) SELECT id,email,'assignment_delivery_fixture_'||right(id::text,1),'Create recovery fixture'
 FROM auth.users WHERE id::text LIKE 'ddf18000-0000-4000-8000-%';
INSERT INTO public."Home"(id,owner_id,created_by_user_id,address,city,state,zipcode) VALUES
 ('ddf18000-0000-4000-8000-000000000100','ddf18000-0000-4000-8000-000000000001','ddf18000-0000-4000-8000-000000000001','Recovery100','Test','WA','98607'),
 ('ddf18000-0000-4000-8000-000000000200',NULL,'ddf18000-0000-4000-8000-000000000004','Recovery200','Test','WA','98607');
INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status)
 SELECT 'ddf18000-0000-4000-8000-000000000100',('ddf18000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 role,role::public.home_role_base,age::public.home_age_band,'verified' FROM
 (VALUES(1,'owner','adult'),(2,'member',NULL),(3,'restricted_member','child'))f(n,role,age);
INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,verification_status) VALUES
 ('ddf18000-0000-4000-8000-000000000200','ddf18000-0000-4000-8000-000000000004','admin','admin','pending_doc');
INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed)
 SELECT 'ddf18000-0000-4000-8000-000000000100',('ddf18000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,p::public.home_permission,true
 FROM generate_series(2,3)n CROSS JOIN unnest(ARRAY['tasks.view','tasks.edit'])p;
CREATE FUNCTION pg_temp.assignment_assert(v boolean,message text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
  IF v IS DISTINCT FROM true THEN RAISE EXCEPTION '%',message; END IF;
END $$;
CREATE FUNCTION pg_temp.assignment_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF current_setting('pantopus.assignment_test_fail',true)='on' THEN RAISE EXCEPTION 'assignment fixture interruption'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER assignment_fixture_failure BEFORE INSERT ON public."HomeTaskAssignmentDelivery"
  FOR EACH ROW EXECUTE FUNCTION pg_temp.assignment_fail();
SET LOCAL ROLE service_role;
DO $$ DECLARE h uuid:='ddf18000-0000-4000-8000-000000000100'; ph uuid:='ddf18000-0000-4000-8000-000000000200';
  o uuid:='ddf18000-0000-4000-8000-000000000001'; a uuid:='ddf18000-0000-4000-8000-000000000002';
  priv uuid:='ddf18000-0000-4000-8000-000000000004'; k uuid:='ddf18000-0000-4000-8000-000000000501';
  r jsonb; p jsonb; claimed jsonb; again jsonb; current_note jsonb; n public."Notification";
  t uuid; event_id uuid; old_lease uuid; before_rows jsonb; after_rows jsonb;
BEGIN
  INSERT INTO public."MailPreferences"(user_id,push_notifications) VALUES(a,true)
    ON CONFLICT(user_id) DO UPDATE SET push_notifications=true;
  INSERT INTO public."UserNotificationPreferences"(user_id,home_reminders_enabled) VALUES(a,true)
    ON CONFLICT(user_id) DO UPDATE SET home_reminders_enabled=true;
  PERFORM public.mutate_home_record(h,o,'task','create',NULL,'{"title":"Self","assigned_to":"ddf18000-0000-4000-8000-000000000001"}');
  PERFORM public.mutate_home_record(h,o,'task','create',NULL,'{"title":"Unassigned"}');
  PERFORM pg_temp.assignment_assert(NOT EXISTS(SELECT FROM public."HomeTaskAssignmentDelivery" WHERE home_id=h),'Self/unassigned task notified');
  p:=jsonb_build_object('title','Private title must not leave the task','assigned_to',a);
  r:=public.create_home_task_with_receipt(h,o,k,p);
  PERFORM pg_temp.assignment_assert(r->>'ok'='true','Create failed'); t:=(r->'record'->>'id')::uuid;
  SELECT id,notification_id INTO event_id,n.id FROM public."HomeTaskAssignmentDelivery" WHERE task_id=t;
  SELECT * INTO n FROM public."Notification" WHERE id=n.id;
  PERFORM pg_temp.assignment_assert(n.metadata->>'task_id'=t::text AND n.metadata->>'assignment_event_id'=event_id::text
    AND n.context='personal' AND n.title='A Home task was assigned to you'
    AND n.body NOT LIKE '%Private title%','Wrong or private notification payload');
  r:=public.create_home_task_with_receipt(h,o,k,p);
  PERFORM pg_temp.assignment_assert(r->>'replayed'='true' AND (SELECT count(*) FROM public."HomeTaskAssignmentDelivery" WHERE task_id=t)=1,'Retry duplicated notice');
  r:=public.mutate_home_record(h,o,'task','update',t,'{"title":"Changed","description":null}');
  PERFORM pg_temp.assignment_assert(r->>'ok'='true' AND (SELECT count(*) FROM public."HomeTaskAssignmentDelivery" WHERE task_id=t)=1,'Unrelated edit created notice');
  claimed:=public.claim_home_task_assignment_delivery(); old_lease:=(claimed->>'lease_id')::uuid;
  PERFORM pg_temp.assignment_assert(claimed->>'id'=event_id::text,'Wrong first delivery');
  current_note:=public.read_home_task_assignment_delivery(event_id,old_lease);
  PERFORM pg_temp.assignment_assert(current_note->>'eligible'='true' AND current_note->>'push_allowed_at_assignment'='true'
    AND current_note->'notification'->>'id'=n.id::text,'Current delivery is not exact');
  PERFORM pg_temp.assignment_assert(public.finish_home_task_assignment_delivery(event_id,old_lease,'retry'),'Retry ack rejected');
  PERFORM pg_temp.assignment_assert(public.claim_home_task_assignment_delivery() IS NULL,'Retry ignored backoff');
  UPDATE public."HomeTaskAssignmentDelivery" SET retry_at=clock_timestamp()-interval '1 second' WHERE id=event_id;
  again:=public.claim_home_task_assignment_delivery();
  PERFORM pg_temp.assignment_assert(again->>'id'=event_id::text AND again->>'lease_id'<>old_lease::text,'Retry changed identity or reused lease');
  PERFORM pg_temp.assignment_assert(NOT public.finish_home_task_assignment_delivery(event_id,old_lease,'done'),'Old lease acknowledged');
  PERFORM pg_temp.assignment_assert(public.finish_home_task_assignment_delivery(event_id,(again->>'lease_id')::uuid,'done'),'Exact completion failed');
  PERFORM pg_temp.assignment_assert(public.claim_home_task_assignment_delivery() IS NULL,'Delivered notice replayed');

  -- Reassignment produces a new notice; going away and back cannot revive old work.
  PERFORM public.mutate_home_record(h,o,'task','update',t,jsonb_build_object('assigned_to',o));
  PERFORM public.mutate_home_record(h,o,'task','update',t,jsonb_build_object('assigned_to',a));
  claimed:=public.claim_home_task_assignment_delivery(); event_id:=(claimed->>'id')::uuid; old_lease:=(claimed->>'lease_id')::uuid;
  PERFORM public.mutate_home_record(h,o,'task','update',t,jsonb_build_object('assigned_to',o));
  PERFORM public.mutate_home_record(h,o,'task','update',t,jsonb_build_object('assigned_to',a));
  PERFORM pg_temp.assignment_assert(public.read_home_task_assignment_delivery(event_id,old_lease)->>'lease_lost'='true'
    AND NOT public.finish_home_task_assignment_delivery(event_id,old_lease,'done'),'Reassignment retained old lease');
  claimed:=public.claim_home_task_assignment_delivery();
  PERFORM pg_temp.assignment_assert(claimed->>'id'<>event_id::text,'A-B-A replayed old event');
  event_id:=(claimed->>'id')::uuid; old_lease:=(claimed->>'lease_id')::uuid;
  UPDATE public."HomeOccupancy" SET access_end_at=clock_timestamp()-interval '1 second' WHERE home_id=h AND user_id=a;
  PERFORM pg_temp.assignment_assert(public.read_home_task_assignment_delivery(event_id,old_lease)->>'eligible'='false','Expired recipient received task');
  PERFORM public.finish_home_task_assignment_delivery(event_id,old_lease,'suppressed');
  UPDATE public."HomeOccupancy" SET access_end_at=NULL WHERE home_id=h AND user_id=a;
  PERFORM pg_temp.assignment_assert(public.claim_home_task_assignment_delivery() IS NULL,'Restored access replayed suppressed notice');

  -- Off at assignment remains off after preferences are restored.
  UPDATE public."MailPreferences" SET push_notifications=false WHERE user_id=a;
  r:=public.create_home_task_with_receipt(h,o,gen_random_uuid(),p);
  PERFORM pg_temp.assignment_assert(r->>'ok'='true','Preference fixture failed');
  claimed:=public.claim_home_task_assignment_delivery(); event_id:=(claimed->>'id')::uuid; old_lease:=(claimed->>'lease_id')::uuid;
  UPDATE public."MailPreferences" SET push_notifications=true WHERE user_id=a;
  current_note:=public.read_home_task_assignment_delivery(event_id,old_lease);
  PERFORM pg_temp.assignment_assert(current_note->>'eligible'='true' AND current_note->>'push_allowed_at_assignment'='false'
    AND current_note->'notification'->>'id' IS NOT NULL,'Off-at-creation preference was replayed or in-app notice lost');
  -- Notification tampering/deletion can never recreate a different notice.
  UPDATE public."Notification" SET link='/app/other' WHERE id=(current_note->'notification'->>'id')::uuid;
  PERFORM pg_temp.assignment_assert(public.read_home_task_assignment_delivery(event_id,old_lease)->>'eligible'='false','Changed notification allowed delivery');
  PERFORM public.finish_home_task_assignment_delivery(event_id,old_lease,'suppressed');
  r:=public.create_home_task_with_receipt(h,o,gen_random_uuid(),p);
  claimed:=public.claim_home_task_assignment_delivery(); event_id:=(claimed->>'id')::uuid; old_lease:=(claimed->>'lease_id')::uuid;
  current_note:=public.read_home_task_assignment_delivery(event_id,old_lease);
  DELETE FROM public."Notification" WHERE id=(current_note->'notification'->>'id')::uuid;
  PERFORM pg_temp.assignment_assert(public.read_home_task_assignment_delivery(event_id,old_lease)->>'eligible'='false','Deleted notice recreated');
  PERFORM public.finish_home_task_assignment_delivery(event_id,old_lease,'suppressed');

  -- No partial task, audit, receipt or Notification survives enqueue failure.
  SELECT jsonb_build_array((SELECT count(*) FROM public."HomeTask" WHERE home_id=h),
    (SELECT count(*) FROM public."HomeAuditLog" WHERE home_id=h),(SELECT count(*) FROM public."HomeTaskCreateReceipt" WHERE home_id=h),
    (SELECT count(*) FROM public."Notification" WHERE metadata->>'home_id'=h::text)) INTO before_rows;
  PERFORM set_config('pantopus.assignment_test_fail','on',true);
  BEGIN
    PERFORM public.create_home_task_with_receipt(h,o,gen_random_uuid(),p);
    RAISE EXCEPTION 'Expected enqueue failure';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'assignment fixture interruption' THEN RAISE; END IF;
  END;
  PERFORM set_config('pantopus.assignment_test_fail','off',true);
  SELECT jsonb_build_array((SELECT count(*) FROM public."HomeTask" WHERE home_id=h),
    (SELECT count(*) FROM public."HomeAuditLog" WHERE home_id=h),(SELECT count(*) FROM public."HomeTaskCreateReceipt" WHERE home_id=h),
    (SELECT count(*) FROM public."Notification" WHERE metadata->>'home_id'=h::text)) INTO after_rows;
  PERFORM pg_temp.assignment_assert(before_rows=after_rows,'Enqueue failure partially committed');
  r:=public.create_home_task_with_receipt(h,o,gen_random_uuid(),p); t:=(r->'record'->>'id')::uuid;
  claimed:=public.claim_home_task_assignment_delivery(); event_id:=(claimed->>'id')::uuid; old_lease:=(claimed->>'lease_id')::uuid;
  PERFORM public.mutate_home_record(h,o,'task','update',t,'{"status":"done"}');
  PERFORM pg_temp.assignment_assert(public.read_home_task_assignment_delivery(event_id,old_lease)->>'lease_lost'='true','Completed task retained assignment');
  r:=public.create_home_task_with_receipt(h,o,gen_random_uuid(),p); t:=(r->'record'->>'id')::uuid;
  claimed:=public.claim_home_task_assignment_delivery(); event_id:=(claimed->>'id')::uuid; old_lease:=(claimed->>'lease_id')::uuid;
  DELETE FROM public."HomeTask" WHERE id=t;
  PERFORM pg_temp.assignment_assert(public.read_home_task_assignment_delivery(event_id,old_lease)->>'lease_lost'='true','Deleted task retained assignment');
  PERFORM pg_temp.assignment_assert(public.claim_home_task_assignment_delivery() IS NULL,'Unexpected remaining delivery');

  -- Historical assignment is household data, even if other rows later look private.
  PERFORM pg_temp.assignment_assert(public.home_secret_context(ph,priv)->>'allowed'='true','Private setup fixture denied');
  INSERT INTO public."HomeTaskAssignmentDelivery"(home_id,task_id,actor_id,user_id,notification_snapshot,push_allowed_at_assignment,state)
    VALUES(ph,gen_random_uuid(),o,a,'{}',false,'suppressed');
  PERFORM pg_temp.assignment_assert(public.home_secret_context(ph,priv)->>'allowed'='false'
    AND public.home_delete_eligibility(ph,priv)->>'allowed'='false','Foreign assignment history became private setup');
  -- The existing Home cascade may delete tasks before it deletes their outbox.
  r:=public.create_home_task_with_receipt(h,o,gen_random_uuid(),p);
  PERFORM pg_temp.assignment_assert(r->>'ok'='true','Pending Home deletion fixture failed');
  DELETE FROM public."Home" WHERE id=h;
  PERFORM pg_temp.assignment_assert(NOT EXISTS(SELECT FROM public."HomeTaskAssignmentDelivery" WHERE home_id=h)
    AND NOT EXISTS(SELECT FROM public."HomeTask" WHERE home_id=h),'Home cascade left assignment work');
END $$;
RESET ROLE;
SELECT pg_temp.assignment_assert(NOT has_function_privilege('service_role',
  'public.mutate_home_record_before_assignment_delivery(uuid,uuid,text,text,uuid,jsonb,uuid)','EXECUTE'),'Service bypasses outbox');
SELECT pg_temp.assignment_assert(NOT has_function_privilege('authenticated','public.claim_home_task_assignment_delivery()','EXECUTE')
  AND NOT has_function_privilege('anon','public.read_home_task_assignment_delivery(uuid,uuid)','EXECUTE')
  AND NOT has_table_privilege('authenticated','public."HomeTaskAssignmentDelivery"','SELECT'),'Public outbox privilege');
SELECT pg_temp.assignment_assert((SELECT rows FROM create_roles_before)=
  (SELECT jsonb_agg(to_jsonb(r) ORDER BY role_base,permission) FROM public."HomeRolePermission" r),'Role defaults changed');
ROLLBACK;
