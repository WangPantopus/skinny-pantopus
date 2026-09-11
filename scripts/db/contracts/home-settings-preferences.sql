-- Actual schema, locked authority, atomic fields/preferences/audit and preservation.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
CREATE FUNCTION pg_temp.hp_id(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
 SELECT ('ddc24400-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
$$;
CREATE FUNCTION pg_temp.hp_expect(r jsonb,c text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 IF (c IS NULL AND r->>'ok' IS DISTINCT FROM 'true') OR (c IS NOT NULL AND r->>'code' IS DISTINCT FROM c) THEN
  RAISE EXCEPTION 'Expected %, got %',coalesce(c,'success'),r; END IF;
END $$;
INSERT INTO auth.users(id,email,email_confirmed_at) SELECT pg_temp.hp_id(n),'settings-contract-'||n||'@example.invalid',now() FROM generate_series(1,2)n;
INSERT INTO public."User"(id,email,username) SELECT id,email,'settings_contract_'||right(id::text,1) FROM auth.users WHERE id IN(pg_temp.hp_id(1),pg_temp.hp_id(2));
INSERT INTO public."Home"(id,owner_id,address,city,state,zipcode) VALUES(pg_temp.hp_id(100),pg_temp.hp_id(1),'Private settings fixture','Test','WA','98607');
INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status,start_at,end_at)
 VALUES(pg_temp.hp_id(100),pg_temp.hp_id(1),'owner','owner','adult','verified',now()-interval '1 day',now()+interval '1 day');
INSERT INTO public."HomePreference"(home_id,visibility_level,open_to_social,quiet_hours_start,notification_radius_meters)
 VALUES(pg_temp.hp_id(100),'unit_only',true,'22:00',900);
SET LOCAL ROLE service_role;
DO $$ DECLARE h uuid:=pg_temp.hp_id(100); a uuid:=pg_temp.hp_id(1); original jsonb; BEGIN
 IF has_table_privilege('anon','public."HomePreference"','SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
  OR has_table_privilege('authenticated','public."HomePreference"','SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
  OR has_function_privilege('authenticated','public.update_home_settings(uuid,uuid,jsonb,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Unsafe preference privileges'; END IF;
 SELECT to_jsonb(p)-'settings'-'updated_at' INTO original FROM public."HomePreference" p WHERE home_id=h;
 PERFORM pg_temp.hp_expect(public.update_home_settings(h,pg_temp.hp_id(2),'{}','{"bill_benchmark_opt_in":true}'),'HOME_SETTINGS_DENIED');
 PERFORM pg_temp.hp_expect(public.update_home_settings(h,a,'{}','{"bill_benchmark_opt_in":"yes"}'),'HOME_SETTINGS_INVALID');
 PERFORM pg_temp.hp_expect(public.update_home_settings(h,a,'{}','{"notifications":{"bills":"false"}}'),'HOME_SETTINGS_INVALID');
 PERFORM pg_temp.hp_expect(public.update_home_settings(h,a,'{"owner_id":"invalid"}','{}'),'HOME_SETTINGS_INVALID');
 PERFORM pg_temp.hp_expect(public.update_home_settings(h,a,'{"default_guest_pass_hours":0}','{}'),'HOME_SETTINGS_INVALID');
 UPDATE public."HomeOccupancy" SET is_active=false WHERE home_id=h;
 PERFORM pg_temp.hp_expect(public.update_home_settings(h,a,'{}','{"bill_benchmark_opt_in":true}'),'HOME_SETTINGS_DENIED');
 UPDATE public."HomeOccupancy" SET is_active=true,age_band='child' WHERE home_id=h;
 PERFORM pg_temp.hp_expect(public.update_home_settings(h,a,'{}','{"bill_benchmark_opt_in":true}'),'HOME_SETTINGS_DENIED');
 UPDATE public."HomeOccupancy" SET age_band='adult' WHERE home_id=h;
 INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(h,a,'home.edit',false);
 PERFORM pg_temp.hp_expect(public.update_home_settings(h,a,'{}','{"bill_benchmark_opt_in":true}'),'HOME_SETTINGS_DENIED');
 DELETE FROM public."HomePermissionOverride" WHERE home_id=h;
 UPDATE public."Home" SET security_state='frozen' WHERE id=h;
 PERFORM pg_temp.hp_expect(public.update_home_settings(h,a,'{}','{"bill_benchmark_opt_in":true}'),'HOME_SETTINGS_DENIED');
 UPDATE public."Home" SET security_state='normal' WHERE id=h;
 IF EXISTS(SELECT FROM public."HomeAuditLog" WHERE home_id=h) THEN RAISE EXCEPTION 'Denied settings produced audit'; END IF;
 PERFORM pg_temp.hp_expect(public.update_home_settings(h,a,'{"trash_day":"Monday","default_visibility":"members","default_guest_pass_hours":72}',
  '{"bill_benchmark_opt_in":"true","notifications":{"bills":false,"mail":true}}'));
 IF (SELECT settings FROM public."HomePreference" WHERE home_id=h)<>'{"bill_benchmark_opt_in":true,"notifications":{"bills":false,"mail":true}}'::jsonb
  OR (SELECT trash_day FROM public."Home" WHERE id=h)<>'Monday'
  OR (SELECT default_guest_pass_hours FROM public."Home" WHERE id=h)<>72 THEN RAISE EXCEPTION 'Settings types or fields lost'; END IF;
 PERFORM pg_temp.hp_expect(public.update_home_settings(h,a,'{}','{"bill_benchmark_opt_in":false}'));
 IF (SELECT settings->'notifications' FROM public."HomePreference" WHERE home_id=h)<>'{"bills":false,"mail":true}'::jsonb THEN RAISE EXCEPTION 'Other settings overwritten'; END IF;
 IF (SELECT to_jsonb(p)-'settings'-'updated_at' FROM public."HomePreference" p WHERE home_id=h)<>original THEN RAISE EXCEPTION 'Fixed preferences changed'; END IF;
 IF (SELECT count(*) FROM public."HomeAuditLog" WHERE home_id=h)<>2 THEN RAISE EXCEPTION 'Missing settings audit'; END IF;
END $$;
RESET ROLE;
CREATE FUNCTION pg_temp.hp_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.action='home_settings_updated' THEN RAISE EXCEPTION 'Synthetic settings audit failure'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER settings_contract_audit_failure BEFORE INSERT ON public."HomeAuditLog" FOR EACH ROW EXECUTE FUNCTION pg_temp.hp_fail_audit();
SET LOCAL ROLE service_role;
DO $$ DECLARE h uuid:=pg_temp.hp_id(100); before_home jsonb; before_pref jsonb; BEGIN
 SELECT to_jsonb(t) INTO before_home FROM public."Home" t WHERE id=h;
 SELECT to_jsonb(t) INTO before_pref FROM public."HomePreference" t WHERE home_id=h;
 BEGIN
  PERFORM public.update_home_settings(h,pg_temp.hp_id(1),'{"trash_day":"Friday"}','{"bill_benchmark_opt_in":true}');
  RAISE EXCEPTION 'Expected audit failure';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Synthetic settings audit failure' THEN RAISE; END IF; END;
 IF (SELECT to_jsonb(t) FROM public."Home" t WHERE id=h)<>before_home OR (SELECT to_jsonb(t) FROM public."HomePreference" t WHERE home_id=h)<>before_pref THEN RAISE EXCEPTION 'Partial settings update'; END IF;
END $$;
ROLLBACK;
