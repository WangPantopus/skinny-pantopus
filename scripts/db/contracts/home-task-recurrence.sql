-- Real calendar, explicit consent, receipt recovery, generation and access gates.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE FUNCTION pg_temp.require(b boolean,m text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF b IS DISTINCT FROM true THEN RAISE EXCEPTION '%',m; END IF; END $$;
CREATE FUNCTION pg_temp.ok(r jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN PERFORM pg_temp.require(r->>'ok'='true',r::text); RETURN r; END $$;
CREATE FUNCTION pg_temp.code(r jsonb,c text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN PERFORM pg_temp.require(r->>'ok'='false' AND r->>'code'=c,r::text); END $$;
SELECT pg_temp.require(next_due='2026-03-31 09:00Z' AND previous_due IS NULL,'monthly skips absent February day')
 FROM public.home_task_recurrence_window('2026-01-31 09:00Z','UTC','MONTHLY',1,'2026-02-28 12:00Z');
SELECT pg_temp.require(previous_due='2024-02-29 09:00Z' AND next_due='2028-02-29 09:00Z','leap day survives a missed multi-year interval')
 FROM public.home_task_recurrence_window('2020-02-29 09:00Z','UTC','MONTHLY',12,'2027-10-01 12:00Z');
SELECT pg_temp.require(next_due='2026-03-08 10:30Z','spring gap moves forward once')
 FROM public.home_task_recurrence_window('2026-03-07 10:30Z','America/Los_Angeles','DAILY',1,'2026-03-08 09:00Z');
SELECT pg_temp.require(next_due='2026-03-09 09:30Z','spring wall time returns on next ordinary day')
 FROM public.home_task_recurrence_window('2026-03-07 10:30Z','America/Los_Angeles','DAILY',1,'2026-03-08 11:00Z');
SELECT pg_temp.require(next_due='2026-11-01 09:30Z','autumn overlap uses standard time once')
 FROM public.home_task_recurrence_window('2026-10-31 08:30Z','America/Los_Angeles','DAILY',1,'2026-11-01 08:45Z');
SELECT pg_temp.require(previous_due='2026-09-15 17:00Z' AND next_due='2026-09-29 17:00Z','biweekly anchor and strict next boundary')
 FROM public.home_task_recurrence_window('2026-09-01 17:00Z','UTC','WEEKLY',2,'2026-09-15 17:00Z');

INSERT INTO auth.users(id,email) SELECT ('ddf20000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 'recurrence-'||n||'@example.invalid' FROM generate_series(1,4)n;
INSERT INTO public."User"(id,email,username,name) SELECT id,email,'recurrence_fixture_'||right(id::text,1),'Recurrence fixture'
 FROM auth.users WHERE id::text LIKE 'ddf20000-0000-4000-8000-%';
INSERT INTO public."Home"(id,owner_id,created_by_user_id,address,city,state,zipcode) VALUES
 ('ddf20000-0000-4000-8000-000000000100','ddf20000-0000-4000-8000-000000000001','ddf20000-0000-4000-8000-000000000001','Recurrence100','Test','WA','98607'),
 ('ddf20000-0000-4000-8000-000000000200',NULL,'ddf20000-0000-4000-8000-000000000004','Recurrence200','Test','WA','98607');
INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status)
 SELECT 'ddf20000-0000-4000-8000-000000000100',('ddf20000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 role,role::public.home_role_base,'adult','verified' FROM (VALUES(1,'owner'),(2,'member'),(3,'member'))f(n,role);
INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,verification_status) VALUES
 ('ddf20000-0000-4000-8000-000000000200','ddf20000-0000-4000-8000-000000000004','admin','admin','pending_doc');
INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed)
 SELECT 'ddf20000-0000-4000-8000-000000000100',('ddf20000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 p::public.home_permission,true FROM generate_series(2,3)n CROSS JOIN unnest(ARRAY['tasks.view','tasks.edit'])p;
SET LOCAL ROLE service_role;
DO $$ DECLARE h uuid:='ddf20000-0000-4000-8000-000000000100'; o uuid:='ddf20000-0000-4000-8000-000000000001';
 a uuid:='ddf20000-0000-4000-8000-000000000002'; t uuid; s uuid; first jsonb; r jsonb; command jsonb; n bigint; generated uuid;
 hash text; anchor timestamptz:=date_trunc('day',clock_timestamp())-interval '3 days';
BEGIN
 r:=pg_temp.ok(public.mutate_home_record(h,o,'task','create',NULL,jsonb_build_object('title','Repeat safely','assigned_to',a,
  'recurrence_rule','FREQ=DAILY','is_recurring',true,'due_at',anchor)));
 t:=(r->'record'->>'id')::uuid;
 PERFORM pg_temp.require(public.due_home_task_recurrences()='[]'::jsonb,'saved legacy rule silently activated');
 r:=pg_temp.ok(public.get_home_task_recurrence(h,o,t));
 command:=jsonb_build_object('action','start','expected_revision',0,'expected_task_updated_at',r->>'task_updated_at',
  'frequency','DAILY','interval',1,'timezone','UTC');
 PERFORM pg_temp.code(public.set_home_task_recurrence(h,a,t,gen_random_uuid(),command),'HOME_RECORD_WRITE_DENIED');
 first:=pg_temp.ok(public.set_home_task_recurrence(h,o,t,'ddf20000-0000-4000-8000-000000000501',command));
 s:=(first->'configuration'->>'id')::uuid;
 PERFORM pg_temp.require((first->'configuration'->>'next_due_at')::timestamptz>clock_timestamp(),'activation backfilled a historical date');
 r:=pg_temp.ok(public.set_home_task_recurrence(h,o,t,'ddf20000-0000-4000-8000-000000000501',command));
 PERFORM pg_temp.require(r->>'replayed'='true' AND r->'receipt'=first->'receipt','lost command changed original receipt');
 PERFORM pg_temp.code(public.set_home_task_recurrence(h,o,t,'ddf20000-0000-4000-8000-000000000501',command||'{"interval":2}'),'HOME_TASK_RECURRENCE_CONFLICT');
 PERFORM pg_temp.code(public.set_home_task_recurrence(h,o,t,gen_random_uuid(),command),'HOME_TASK_RECURRENCE_STALE');
 -- Simulate scheduler downtime after explicit activation, without a test clock in production RPCs.
  UPDATE public."HomeTaskRecurrence" SET next_due_at=anchor+interval '1 day' WHERE id=s;
  PERFORM pg_temp.require(public.generate_home_task_recurrence(s,NULL)->>'outcome'='unchanged','missing revision generated a task');
 r:=public.generate_home_task_recurrence(s,1); generated:=(r->>'task_id')::uuid;
 PERFORM pg_temp.require(r->>'outcome'='generated','due task was not generated');
 PERFORM pg_temp.require((SELECT count(*)=2 FROM public."HomeTask" WHERE home_id=h),'outage created a backlog');
 PERFORM pg_temp.require((SELECT status='open' AND recurrence_rule IS NULL AND NOT is_recurring AND mail_id IS NULL
  AND source_mail_id IS NULL AND linked_gig_id IS NULL AND converted_to_gig_id IS NULL AND details='{}'::jsonb
  FROM public."HomeTask" WHERE id=generated),'generation copied an unsafe association');
 PERFORM pg_temp.require((SELECT count(*)=1 FROM public."HomeTaskCreateReceipt" WHERE task_id=generated),'occurrence missing durable creation receipt');
 PERFORM pg_temp.require((SELECT count(*)=1 FROM public."HomeTaskAssignmentDelivery" WHERE task_id=generated),'occurrence missing single outbox event');
 PERFORM pg_temp.require(public.generate_home_task_recurrence(s,1)->>'outcome'='unchanged','repeated worker created a duplicate');
 r:=pg_temp.ok(public.set_home_task_recurrence(h,o,t,gen_random_uuid(),'{"action":"pause","expected_revision":1}'));
 PERFORM pg_temp.require(r->'configuration'->>'state'='paused','pause failed');
 r:=pg_temp.ok(public.set_home_task_recurrence(h,o,t,'ddf20000-0000-4000-8000-000000000501',command));
 PERFORM pg_temp.require(r->>'replayed'='true' AND r->'configuration'->>'state'='paused' AND r->'receipt'->>'revision'='1','old start replay undid newer pause');
 PERFORM pg_temp.require(public.generate_home_task_recurrence(s,1)->>'outcome'='unchanged','old worker revived paused schedule');
 -- Restart requires explicit current revision and does not recapture old missed occurrences.
 command:=command||'{"expected_revision":2}';
 r:=pg_temp.ok(public.set_home_task_recurrence(h,o,t,gen_random_uuid(),command));
 UPDATE public."HomeTaskRecurrence" SET next_due_at=anchor+interval '1 day' WHERE id=s;
 r:=pg_temp.ok(public.mutate_home_record(h,o,'task','update',t,'{"title":"Changed source"}'));
 PERFORM pg_temp.require(public.get_home_task_recurrence(h,o,t)->'configuration'->>'state'='needs_review','read falsely promises changed schedule');
 PERFORM pg_temp.require(public.generate_home_task_recurrence(s,3)->>'outcome'='paused','changed source was cloned');
 PERFORM pg_temp.require((SELECT count(*)=2 FROM public."HomeTask" WHERE home_id=h),'paused work added a task');
 -- Hash is independent of the worker connection timezone.
 SELECT public.home_task_recurrence_source_hash(x) INTO hash FROM public."HomeTask" x WHERE id=t;
 PERFORM set_config('TimeZone','Pacific/Auckland',true);
 PERFORM pg_temp.require((SELECT public.home_task_recurrence_source_hash(x)=hash FROM public."HomeTask" x WHERE id=t),'worker timezone changed source hash');
 PERFORM set_config('TimeZone','UTC',true);
END $$;
RESET ROLE;

-- An error after occurrence creation rolls back the task, receipt, outbox and
-- schedule advancement. The unchanged schedule remains available for retry.
CREATE FUNCTION pg_temp.fail_recurrence_progress() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF NEW.generated_count>OLD.generated_count THEN RAISE EXCEPTION 'fixture progress unavailable'; END IF; RETURN NEW; END $$;
CREATE TRIGGER recurrence_progress_test BEFORE UPDATE ON public."HomeTaskRecurrence"
 FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_recurrence_progress();
SET LOCAL ROLE service_role;
DO $$ DECLARE h uuid:='ddf20000-0000-4000-8000-000000000100'; o uuid:='ddf20000-0000-4000-8000-000000000001';
 r jsonb; t uuid; s uuid; n bigint; receipts bigint; notices bigint;
BEGIN
 r:=pg_temp.ok(public.mutate_home_record(h,o,'task','create',NULL,jsonb_build_object('title','Rollback source',
  'assigned_to','ddf20000-0000-4000-8000-000000000002','due_at',clock_timestamp()-interval '2 days')));
 t:=(r->'record'->>'id')::uuid;
 r:=pg_temp.ok(public.get_home_task_recurrence(h,o,t));
 r:=pg_temp.ok(public.set_home_task_recurrence(h,o,t,gen_random_uuid(),jsonb_build_object('action','start','expected_revision',0,
  'expected_task_updated_at',r->>'task_updated_at','frequency','DAILY','interval',1,'timezone','UTC')));
 s:=(r->'configuration'->>'id')::uuid;
 UPDATE public."HomeTaskRecurrence" SET next_due_at=anchor_at+interval '1 day' WHERE id=s;
 SELECT count(*) INTO n FROM public."HomeTask" WHERE home_id=h;
 SELECT count(*) INTO receipts FROM public."HomeTaskCreateReceipt" WHERE home_id=h;
 SELECT count(*) INTO notices FROM public."HomeTaskAssignmentDelivery" WHERE home_id=h;
 BEGIN PERFORM public.generate_home_task_recurrence(s,1); RAISE EXCEPTION 'progress failure was ignored';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'fixture progress unavailable' THEN RAISE; END IF; END;
 PERFORM pg_temp.require((SELECT count(*)=n FROM public."HomeTask" WHERE home_id=h)
  AND (SELECT count(*)=receipts FROM public."HomeTaskCreateReceipt" WHERE home_id=h)
  AND (SELECT count(*)=notices FROM public."HomeTaskAssignmentDelivery" WHERE home_id=h)
  AND (SELECT generated_count=0 AND next_due_at<=clock_timestamp() FROM public."HomeTaskRecurrence" WHERE id=s),'partial generation survived rollback');
END $$;
RESET ROLE;
-- Only the fixture administrator changes managed Auth; the service role has no
-- grant to ban accounts. The real worker must nevertheless honor current bans.
UPDATE auth.users SET banned_until=clock_timestamp()+interval '1 day' WHERE id='ddf20000-0000-4000-8000-000000000001';
SET LOCAL ROLE service_role;
SELECT pg_temp.require(public.generate_home_task_recurrence(s.id,1)->>'outcome'='paused','banned account continued generation')
 FROM public."HomeTaskRecurrence" s JOIN public."HomeTask" t ON t.id=s.source_task_id
 WHERE s.home_id='ddf20000-0000-4000-8000-000000000100' AND t.title='Rollback source';
RESET ROLE;
UPDATE auth.users SET banned_until=NULL WHERE id='ddf20000-0000-4000-8000-000000000001';
DROP TRIGGER recurrence_progress_test ON public."HomeTaskRecurrence";

-- Private creation and authorized deletion survive own recurrence history;
-- foreign or established history never becomes private bootstrap.
SET LOCAL ROLE service_role;
DO $$ DECLARE h uuid:='ddf20000-0000-4000-8000-000000000200'; a uuid:='ddf20000-0000-4000-8000-000000000004';
 t uuid; r jsonb; command jsonb;
BEGIN
 r:=pg_temp.ok(public.mutate_home_record(h,a,'task','create',NULL,jsonb_build_object('title','Private recurrence','due_at',clock_timestamp())));
 t:=(r->'record'->>'id')::uuid;
 r:=pg_temp.ok(public.get_home_task_recurrence(h,a,t));
 command:=jsonb_build_object('action','start','expected_revision',0,'expected_task_updated_at',r->>'task_updated_at','frequency','WEEKLY','interval',1,'timezone','UTC');
 r:=pg_temp.ok(public.set_home_task_recurrence(h,a,t,gen_random_uuid(),command));
 PERFORM pg_temp.require(public.home_record_context(h,a)->>'private'='true','own recurrence removed private access');
 PERFORM pg_temp.require(public.home_delete_eligibility(h,a)->>'allowed'='true','own recurrence blocked private cleanup');
 UPDATE public."HomeTaskRecurrenceCommand" SET private_setup=false WHERE home_id=h;
 PERFORM pg_temp.require(public.home_secret_context(h,a)->>'allowed'='false','established command bypassed private history');
 UPDATE public."HomeTaskRecurrenceCommand" SET private_setup=true WHERE home_id=h;
 UPDATE public."HomeTaskRecurrence" SET actor_user_id='ddf20000-0000-4000-8000-000000000001' WHERE home_id=h;
 PERFORM pg_temp.require(public.home_secret_context(h,a)->>'allowed'='false','foreign schedule bypassed private history');
 UPDATE public."HomeTaskRecurrence" SET actor_user_id=a WHERE home_id=h;
 r:=public.delete_home_authorized(h,a);
 PERFORM pg_temp.require(r->>'deleted'='true' AND NOT EXISTS(SELECT FROM public."HomeTaskRecurrence" WHERE home_id=h)
  AND NOT EXISTS(SELECT FROM public."HomeTaskRecurrenceCommand" WHERE home_id=h),'private cleanup left active schedule/commands');
END $$;
RESET ROLE;
DO $$ DECLARE role_name text; fn regprocedure; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
  PERFORM pg_temp.require(NOT has_table_privilege(role_name,'public."HomeTaskRecurrence"','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),'raw schedule access');
  PERFORM pg_temp.require(NOT has_table_privilege(role_name,'public."HomeTaskRecurrenceCommand"','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),'raw receipt access');
  FOR fn IN SELECT oid::regprocedure FROM pg_proc WHERE pronamespace='public'::regnamespace
   AND proname IN ('get_home_task_recurrence','set_home_task_recurrence','due_home_task_recurrences','generate_home_task_recurrence') LOOP
    PERFORM pg_temp.require(NOT has_function_privilege(role_name,fn,'EXECUTE'),'raw schedule RPC access');
  END LOOP;
 END LOOP;
END $$;
ROLLBACK;
