#!/usr/bin/env python3
"""Rehearse summary upgrade on a new, retained copy; no hosted connection/reset."""
from pathlib import Path
import subprocess, json, re, sys
assert len(sys.argv) == 2 and re.fullmatch(r'supabase_db_pantopus-home-gig-[a-z0-9_-]+', sys.argv[1])
container = sys.argv[1]
database = 'home_summary_upgrade_contract'
def sql(query, db=database):
    r = subprocess.run(['docker', 'exec', '-i', container, 'psql', '-X', '-qAt', '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1'], input=query, text=True, capture_output=True)
    if r.returncode: raise RuntimeError(r.stderr)
    return r.stdout.strip()
assert sql(f"SELECT count(*) FROM pg_database WHERE datname='{database}';", 'postgres') == '0'
sql(f'CREATE DATABASE {database} TEMPLATE template0;', 'postgres')
clone = subprocess.run(['docker', 'exec', container, 'bash', '-o', 'pipefail', '-c', f'pg_dump -U postgres -Fc -d postgres | pg_restore -U supabase_admin -d {database} --exit-on-error'], capture_output=True, text=True)
if clone.returncode: raise RuntimeError(clone.stderr)
# Reconstruct the immediate predecessor only inside this newly created copy.
sql('''BEGIN;
 DROP FUNCTION public.update_home_seasonal_item(uuid,uuid,uuid,text);
 GRANT ALL ON public."HomeSeasonalChecklistItem" TO anon,authenticated;
 DELETE FROM supabase_migrations.schema_migrations WHERE version='20260911003000'; COMMIT;''')
assert sql("SELECT to_regprocedure('public.update_home_seasonal_item(uuid,uuid,uuid,text)') IS NULL;") == 't'
assert sql('''SELECT has_table_privilege('authenticated','public."HomeSeasonalChecklistItem"','TRUNCATE');''') == 't'
sql('''BEGIN; INSERT INTO auth.users(id,email) VALUES
 ('ddc24200-0000-4000-8000-000000000001','summary-upgrade-owner@example.invalid');
 INSERT INTO public."User"(id,email,username,name) SELECT id,email,'summary_upgrade_owner','Upgrade fixture'
 FROM auth.users WHERE id='ddc24200-0000-4000-8000-000000000001';
 INSERT INTO public."Home"(id,owner_id,address,city,state,zipcode) VALUES
 ('ddc24200-0000-4000-8000-000000000100','ddc24200-0000-4000-8000-000000000001','Historical summary fixture','Test','WA','98607');
 INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,is_active,verification_status,access_end_at)
 VALUES('ddc24200-0000-4000-8000-000000000100','ddc24200-0000-4000-8000-000000000001','owner','owner','adult',false,'moved_out',now()-interval '1 day');
 INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed)
 VALUES('ddc24200-0000-4000-8000-000000000100','ddc24200-0000-4000-8000-000000000001','home.edit',false);
 INSERT INTO public."HomeSeasonalChecklistItem"(id,home_id,season_key,year,item_key,title,status,completed_at,completed_by,gig_id)
 SELECT ('ddc24200-0000-4000-8000-'||lpad((200+n)::text,12,'0'))::uuid,'ddc24200-0000-4000-8000-000000000100','fall_prep',2025,'historical_'||n,'Historical item',
 CASE n WHEN 1 THEN 'pending' WHEN 2 THEN 'completed' WHEN 3 THEN 'skipped' WHEN 4 THEN 'hired' ELSE 'pending' END,
 CASE WHEN n IN(2,3) THEN now()-interval '365 days' END,
 CASE WHEN n IN(2,3) THEN 'ddc24200-0000-4000-8000-000000000001'::uuid END,
 CASE WHEN n IN(4,5) THEN 'ddc24200-0000-4000-8000-000000000999'::uuid END FROM generate_series(1,5)n;
 INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
 VALUES('ddc24200-0000-4000-8000-000000000100','ddc24200-0000-4000-8000-000000000001','historical_checklist_update',
 'HomeSeasonalChecklistItem','ddc24200-0000-4000-8000-000000000202','{"legacy":true}'); COMMIT;''')
names = json.loads(sql("SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname)) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','auth','storage') AND c.relkind='r';"))
def snapshot():
    result = {}
    for schema, table in names:
        quoted = '"'+schema+'"."'+table.replace('"','""')+'"'
        result[schema+'.'+table] = json.loads(sql(f"SELECT jsonb_build_array(count(*),md5(coalesce(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY to_jsonb(t)::text),''))) FROM {quoted} t;"))
    return result
before = snapshot()
sql('BEGIN;' + Path('supabase/migrations/20260911003000_home_summary_boundaries.sql').read_text() + 'COMMIT;')
after = snapshot()
assert before == after, [k for k in before if before[k] != after[k]]
assert sql('''SELECT has_table_privilege('authenticated','public."HomeSeasonalChecklistItem"','SELECT,INSERT,UPDATE,DELETE,TRUNCATE');''') == 'f'
assert sql("SELECT has_function_privilege('service_role','public.update_home_seasonal_item(uuid,uuid,uuid,text)','EXECUTE');") == 't'
print('PASS: populated predecessor replay preserves', sum(v[0] for v in before.values()), 'original rows across', len(names), 'public/auth/storage tables, including historical completion, skipped/hired/gig links, revoked membership, deny and audit')
sql('''BEGIN; DELETE FROM public."HomeAuditLog" WHERE home_id='ddc24200-0000-4000-8000-000000000100';
 DELETE FROM public."HomePermissionOverride" WHERE home_id='ddc24200-0000-4000-8000-000000000100';
 DELETE FROM public."HomeOccupancy" WHERE home_id='ddc24200-0000-4000-8000-000000000100';
 DELETE FROM public."HomeSeasonalChecklistItem" WHERE home_id='ddc24200-0000-4000-8000-000000000100';
 DELETE FROM public."Home" WHERE id='ddc24200-0000-4000-8000-000000000100';
 DELETE FROM public."User" WHERE id='ddc24200-0000-4000-8000-000000000001';
 DELETE FROM auth.users WHERE id='ddc24200-0000-4000-8000-000000000001'; COMMIT;''')
print('PASS: exact populated summary fixture removed; dedicated upgraded database retained')
