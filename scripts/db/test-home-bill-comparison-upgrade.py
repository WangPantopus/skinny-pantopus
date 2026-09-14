#!/usr/bin/env python3
"""Rehearse bill-comparison upgrade on a new, retained copy; no hosted connection/reset."""
from pathlib import Path
import subprocess, json, re, sys
assert len(sys.argv) == 2 and re.fullmatch(r'supabase_db_pantopus-home-gig-[a-z0-9_-]+', sys.argv[1])
container = sys.argv[1]
database = 'home_bill_comparison_upgrade_contract'
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
 DROP FUNCTION public.get_home_bill_comparison(uuid,uuid,text);
 DROP FUNCTION public.read_bill_peer_months(text,text);
 DROP INDEX public.idx_home_bill_comparison_cell;
 DROP INDEX public.idx_home_bill_paid_month;
 DROP FUNCTION public.home_bill_geohash(public.geography,double precision,double precision);
 DELETE FROM supabase_migrations.schema_migrations WHERE version='20260911020000'; COMMIT;''')
assert sql("SELECT to_regprocedure('public.get_home_bill_comparison(uuid,uuid,text)') IS NULL;") == 't'
# Keep representative ambiguous legacy cache rows unchanged, including a low
# cohort. They must never be converted or used by the new current readers.
sql('''INSERT INTO public."BillBenchmark"(id,geohash,bill_type,month,year,avg_amount_cents,household_count) VALUES
 ('ddc24900-0000-4000-8000-000000000001','zzzzzz','fixture_upgrade',1,1901,10470,12),
 ('ddc24900-0000-4000-8000-000000000002','zzzzzz','fixture_upgrade',2,1901,104,4);''')
names = json.loads(sql("SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname)) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','auth','storage') AND c.relkind='r';"))
def snapshot():
    result = {}
    for schema, table in names:
        quoted = '"'+schema+'"."'+table.replace('"','""')+'"'
        row = 'to_jsonb(t)'
        result[schema+'.'+table] = json.loads(sql(f"SELECT jsonb_build_array(count(*),md5(coalesce(string_agg({row}::text,E'\\n' ORDER BY {row}::text),''))) FROM {quoted} t;"))
    return result
before = snapshot()
sql('BEGIN;' + Path('supabase/migrations/20260911020000_current_home_bill_comparisons.sql').read_text() + 'COMMIT;')
after = snapshot()
assert before == after, [k for k in before if before[k] != after[k]]
assert sql("SELECT has_function_privilege('authenticated','public.get_home_bill_comparison(uuid,uuid,text)','EXECUTE');") == 'f'
assert sql("SELECT has_function_privilege('service_role','public.get_home_bill_comparison(uuid,uuid,text)','EXECUTE');") == 't'
assert sql("SELECT public.read_bill_peer_months('zzzzzz','USD');") == '[]'
print('PASS: populated predecessor replay preserves', sum(v[0] for v in before.values()), 'original rows across', len(names), 'public/auth/storage tables, including exact source bills, current preferences and ambiguous legacy cache rows; new readers ignore the legacy cache')
sql('''DELETE FROM public."BillBenchmark" WHERE id IN
 ('ddc24900-0000-4000-8000-000000000001','ddc24900-0000-4000-8000-000000000002');''')
print('PASS: exact populated bill fixture removed; dedicated upgraded database retained')
