BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
INSERT INTO auth.users(id,email) VALUES
 ('ddf21000-0000-4000-8000-000000000001','recurrence-view-owner@example.invalid'),
 ('ddf21000-0000-4000-8000-000000000002','recurrence-view-other@example.invalid');
INSERT INTO public."User"(id,email,username,name) SELECT id,email,'recurrence_view_'||right(id::text,1),'View fixture'
 FROM auth.users WHERE id::text LIKE 'ddf21000-%';
INSERT INTO public."Home"(id,owner_id,address,city,state,zipcode) VALUES
 ('ddf21000-0000-4000-8000-000000000100','ddf21000-0000-4000-8000-000000000001','View fixture','Test','WA','98607');
INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status) VALUES
 ('ddf21000-0000-4000-8000-000000000100','ddf21000-0000-4000-8000-000000000001','owner','owner','adult','verified');
SET LOCAL ROLE service_role;
DO $$ DECLARE h uuid:='ddf21000-0000-4000-8000-000000000100'; a uuid:='ddf21000-0000-4000-8000-000000000001';
 t uuid; r jsonb; view jsonb;
BEGIN
 r:=public.mutate_home_record(h,a,'task','create',NULL,jsonb_build_object('title','One-time original','due_at',clock_timestamp()));
 IF r->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Fixture task failed'; END IF;
 t:=(r->'record'->>'id')::uuid;
 r:=public.get_home_records(h,a,'task',t);
 IF r->'records'->0->'automatic_recurrence' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'Inert task appears automatic'; END IF;
 r:=public.set_home_task_recurrence(h,a,t,gen_random_uuid(),jsonb_build_object('action','start','expected_revision',0,
  'expected_task_updated_at',r->'records'->0->>'updated_at','frequency','WEEKLY','interval',2,'timezone','UTC'));
 IF r->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Fixture activation failed'; END IF;
 r:=public.get_home_records(h,a,'task',t);view:=r->'records'->0->'automatic_recurrence';
 IF view->>'state' IS DISTINCT FROM 'active' OR view->>'frequency' IS DISTINCT FROM 'WEEKLY' OR view->>'interval' IS DISTINCT FROM '2'
  OR view->>'timezone' IS DISTINCT FROM 'UTC' OR view->>'next_due_at' IS NULL
  OR (SELECT count(*) FROM jsonb_object_keys(view))<>5 THEN RAISE EXCEPTION 'Incorrect or excessive schedule projection'; END IF;
 IF r->'records'->0->>'recurrence_rule' IS NOT NULL THEN RAISE EXCEPTION 'Projection rewrote a legacy preference'; END IF;
 IF public.get_home_records(h,'ddf21000-0000-4000-8000-000000000002','task',t)->>'ok' IS DISTINCT FROM 'false' THEN
  RAISE EXCEPTION 'Stranger learned recurrence'; END IF;
 r:=public.mutate_home_record(h,a,'task','update',t,'{"title":"Changed original"}');
 r:=public.get_home_records(h,a,'task',t);view:=r->'records'->0->'automatic_recurrence';
 IF view->>'state' IS DISTINCT FROM 'needs_review' OR view->>'next_due_at' IS NOT NULL THEN RAISE EXCEPTION 'Changed source still appears enabled'; END IF;
 r:=public.set_home_task_recurrence(h,a,t,gen_random_uuid(),'{"action":"pause","expected_revision":1}');
 r:=public.get_home_records(h,a,'task',t);view:=r->'records'->0->'automatic_recurrence';
 IF view->>'state' IS DISTINCT FROM 'paused' OR view->>'next_due_at' IS NOT NULL THEN RAISE EXCEPTION 'Pause is absent from ordinary task reads'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
