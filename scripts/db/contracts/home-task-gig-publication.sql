BEGIN;
CREATE FUNCTION pg_temp.require(v boolean,message text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 IF v IS DISTINCT FROM true THEN RAISE EXCEPTION '%',message; END IF; END $$;
CREATE FUNCTION pg_temp.ok(v jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$ BEGIN
 IF v->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Unexpected result %',v; END IF; RETURN v; END $$;
CREATE FUNCTION pg_temp.code(v jsonb,expected text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 IF v->>'code' IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Expected %, got %',expected,v; END IF; END $$;
INSERT INTO auth.users(id,email) VALUES('ddf22200-0000-4000-8000-000000000001','gig-contract@example.invalid');
INSERT INTO public."User"(id,email,username,name) VALUES('ddf22200-0000-4000-8000-000000000001','gig-contract@example.invalid','home_gig_contract','Gig contract');
INSERT INTO public."Home"(id,owner_id,address,city,state,zipcode) VALUES('ddf22200-0000-4000-8000-000000000100','ddf22200-0000-4000-8000-000000000001','Private fixture','Test','WA','98607');
INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status) VALUES
 ('ddf22200-0000-4000-8000-000000000100','ddf22200-0000-4000-8000-000000000001','owner','owner','adult','verified');
CREATE FUNCTION pg_temp.ban(u uuid,until_at timestamptz) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 UPDATE auth.users SET banned_until=until_at WHERE id=u;
$$;
SET LOCAL ROLE service_role;
DO $$ DECLARE h uuid:='ddf22200-0000-4000-8000-000000000100'; a uuid:='ddf22200-0000-4000-8000-000000000001';
 t uuid; k uuid:=gen_random_uuid(); r jsonb; first jsonb; stamp timestamptz; command jsonb; g jsonb; gid uuid;
BEGIN
 PERFORM pg_temp.require(NOT has_table_privilege('authenticated','public."HomeTaskGigReceipt"','SELECT'),'direct receipt read granted');
 PERFORM pg_temp.require(NOT has_table_privilege('authenticated','public."HomeTaskGigReceipt"','INSERT'),'direct receipt insert granted');
 PERFORM pg_temp.require(NOT has_function_privilege('authenticated','public.publish_home_task_gig(uuid,uuid,uuid,uuid,timestamptz,jsonb,jsonb)','EXECUTE'),'client RPC grant');
 r:=pg_temp.ok(public.mutate_home_record(h,a,'task','create',NULL,'{"title":"Private source","description":"Private description","details":{"private":"not for Gig"}}'));
 t:=(r->'record'->>'id')::uuid;stamp:=(r->'record'->>'updated_at')::timestamptz;
 command:=jsonb_build_object('home_task_source',jsonb_build_object('home_id',h,'task_id',t,'request_id',k,'expected_updated_at',stamp,'reviewed',true));
 g:=jsonb_build_object('title','Public reviewed title','description','Public description reviewed explicitly.','price',25,'user_id',a,'created_by',a,
   'status','open','origin_mode','address','exact_location','POINT(-122.55 45.65)','approx_location','POINT(-122.5 45.7)',
   'task_format','in_person','reveal_policy','after_assignment','attachments','[]'::jsonb,'items','[]'::jsonb);
 UPDATE public."HomeTask" SET assigned_to=a WHERE id=t;
 PERFORM pg_temp.code(public.publish_home_task_gig(h,a,t,k,stamp,command,g),'HOME_TASK_GIG_NOT_READY');
 UPDATE public."HomeTask" SET assigned_to=NULL,status='done' WHERE id=t;
 PERFORM pg_temp.code(public.publish_home_task_gig(h,a,t,k,stamp,command,g),'HOME_TASK_GIG_NOT_READY');
 UPDATE public."HomeTask" SET status='open' WHERE id=t;
 UPDATE public."Home" SET security_state='frozen' WHERE id=h;
 PERFORM pg_temp.code(public.publish_home_task_gig(h,a,t,k,stamp,command,g),'HOME_RECORD_DENIED');
 UPDATE public."Home" SET security_state='normal' WHERE id=h;
 INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(h,a,'tasks.view',false);
 PERFORM pg_temp.code(public.publish_home_task_gig(h,a,t,k,stamp,command,g),'HOME_RECORD_DENIED');
 DELETE FROM public."HomePermissionOverride" WHERE home_id=h;
 PERFORM pg_temp.ban(a,clock_timestamp()+interval '1 day');
 PERFORM pg_temp.code(public.publish_home_task_gig(h,a,t,k,stamp,command,g),'HOME_RECORD_WRITE_DENIED');
 PERFORM pg_temp.ban(a,NULL);
 UPDATE public."HomeOccupancy" SET age_band='teen' WHERE home_id=h AND user_id=a;
 r:=public.publish_home_task_gig(h,a,t,k,stamp,command,g);PERFORM pg_temp.require(r->>'ok'='false','teen publication admitted');
 UPDATE public."HomeOccupancy" SET age_band='adult' WHERE home_id=h AND user_id=a;
 -- A true active recurrence cannot produce paid copies incidentally.
 UPDATE public."HomeTask" SET due_at=clock_timestamp()+interval '1 day' WHERE id=t;
 SELECT updated_at INTO stamp FROM public."HomeTask" WHERE id=t;
 r:=pg_temp.ok(public.set_home_task_recurrence(h,a,t,gen_random_uuid(),jsonb_build_object('action','start','expected_revision',0,
  'expected_task_updated_at',stamp,'frequency','DAILY','interval',1,'timezone','UTC')));
 command:=jsonb_set(command,'{home_task_source,expected_updated_at}',to_jsonb(stamp));
 PERFORM pg_temp.code(public.publish_home_task_gig(h,a,t,k,stamp,command,g),'HOME_TASK_GIG_NOT_READY');
 r:=pg_temp.ok(public.set_home_task_recurrence(h,a,t,gen_random_uuid(),'{"action":"pause","expected_revision":1}'));
 SELECT updated_at INTO stamp FROM public."HomeTask" WHERE id=t;
 command:=jsonb_set(command,'{home_task_source,expected_updated_at}',to_jsonb(stamp));
 PERFORM pg_temp.code(public.publish_home_task_gig(h,a,t,k,stamp,command,g||jsonb_build_object('deadline',clock_timestamp()-interval '1 day')),'HOME_RECORD_INVALID');
 first:=pg_temp.ok(public.publish_home_task_gig(h,a,t,k,stamp,command,g));gid:=(first->'gig'->>'id')::uuid;
 PERFORM pg_temp.require(first->>'replayed'='false','first publication replayed');
 PERFORM pg_temp.require((SELECT converted_to_gig_id=gid AND status='open' AND assigned_to IS NULL FROM public."HomeTask" WHERE id=t),'source improperly changed');
 PERFORM pg_temp.require((SELECT origin_home_id IS NULL AND source_id IS NULL AND payment_id IS NULL AND accepted_by IS NULL
  AND description='Public description reviewed explicitly.' AND attachments='{}' FROM public."Gig" WHERE id=gid),'private data or financial state copied');
 PERFORM pg_temp.require((SELECT count(*)=1 FROM public."HomeTaskGigReceipt" WHERE task_id=t),'receipt count differs');
 PERFORM pg_temp.require((SELECT count(*)=1 FROM public."HomeAuditLog" WHERE home_id=h AND action='home_task_gig_published'),'audit count differs');
 PERFORM pg_temp.require(public.home_delete_eligibility(h,a)->>'allowed'='false','publication history permits whole-Home deletion');
 UPDATE public."Gig" SET status='cancelled' WHERE id=gid;
 r:=pg_temp.ok(public.publish_home_task_gig(h,a,t,k,stamp,command,g));
 PERFORM pg_temp.require(r->>'replayed'='true' AND r->'receipt'=first->'receipt' AND r->'gig'->>'status'='cancelled','replay changed receipt/current Gig');
 DELETE FROM public."Gig" WHERE id=gid;
 PERFORM pg_temp.code(public.publish_home_task_gig(h,a,t,k,stamp,command,g),'HOME_TASK_GIG_RETIRED');
 PERFORM pg_temp.require((SELECT count(*)=1 FROM public."HomeTaskGigReceipt" WHERE task_id=t),'Gig deletion erased receipt');
 PERFORM pg_temp.require(public.get_home_task_gig_publication(h,a,t)->>'can_publish'='false','retired source can republish');
END $$;
RESET ROLE;
ROLLBACK;
