#!/usr/bin/env python3
"""Populated additive R02 rehearsal; exclusive owned DB, entire outer rollback."""
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

container, output_text, lease = sys.argv[1:]
assert lease == '--exclusive-lease'
assert re.fullmatch(r'supabase_db_pantopus-home-gig-[a-z0-9_-]+', container)
root = Path(__file__).resolve().parents[2]
output = Path(output_text)
assert output.is_absolute() and not output.is_relative_to(root)
output.mkdir(parents=True, exist_ok=True, mode=0o700)


def run(query):
    return subprocess.run(['docker', 'exec', '-i', container, 'psql', '-X', '-qAt', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
                          input=query, text=True, capture_output=True, timeout=120)


def save(name, value):
    target = output / name
    with target.open('x') as file:
        file.write(value if isinstance(value, str) else json.dumps(value, indent=2) + '\n')
    target.chmod(0o600)


def preservation():
    inventory = run("BEGIN READ ONLY; SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname) ORDER BY n.nspname,c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','auth','storage','supabase_migrations') AND c.relkind='r'; ROLLBACK;")
    assert inventory.returncode == 0, 'Read-only table inventory failed'
    quote = lambda value: "'" + value.replace("'", "''") + "'"
    identifier = lambda value: '"' + value.replace('"', '""') + '"'
    rows = ' UNION ALL '.join("SELECT " + quote(schema) + "::text schema_name," + quote(table) + "::text table_name,count(*) row_count,md5(coalesce(string_agg(to_jsonb(r)::text,E'\\n' ORDER BY to_jsonb(r)::text),'')) digest FROM " + identifier(schema) + '.' + identifier(table) + ' r' for schema, table in json.loads(inventory.stdout))
    result = run("""BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
    SELECT jsonb_build_object('rows',(SELECT jsonb_agg(to_jsonb(t) ORDER BY schema_name,table_name) FROM (""" + rows + """)t),
      'functions',(SELECT jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_functiondef(oid),'owner',proowner,'acl',proacl,'config',proconfig) ORDER BY oid)
        FROM pg_proc WHERE pronamespace='public'::regnamespace AND prokind IN('f','p')),
      'relations',(SELECT jsonb_agg(jsonb_build_object('oid',c.oid,'name',c.relname,'kind',c.relkind,'owner',c.relowner,'acl',c.relacl,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity) ORDER BY c.oid)
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','auth','storage','supabase_migrations')),
      'extensions',(SELECT jsonb_agg(to_jsonb(e) ORDER BY oid) FROM pg_extension e));ROLLBACK;""")
    assert result.returncode == 0, 'Read-only preservation snapshot failed'
    return json.loads(result.stdout)


accepted_paths = ['supabase/migrations/20260911030000_home_member_view_defaults.sql',
                  'supabase/migrations/20260911043000_home_residency_submission.sql',
                  'supabase/migrations/20260911050000_home_postcard_current_recovery.sql',
                  'supabase/migrations/20260912010000_home_postcard_verification_recovery.sql']
migration_path = 'supabase/migrations/20260912060000_home_residency_legacy_compatibility.sql'
query = r"""
BEGIN ISOLATION LEVEL REPEATABLE READ;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='90s';
DO $$ BEGIN
 ASSERT to_regclass('public."HomeResidencySubmissionCommand"') IS NULL,'Retained protocol changed; inspect before applying temporary prerequisites';
 ASSERT to_regclass('public."HomePostcardRequestCommand"') IS NULL;
 ASSERT to_regclass('public."HomePostcardVerificationCommand"') IS NULL;
 ASSERT NOT EXISTS(SELECT FROM auth.users WHERE id::text LIKE 'ddc25800-%');
END $$;
""" + '\n'.join((root / p).read_text() for p in accepted_paths) + r"""
CREATE FUNCTION pg_temp.u(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('ddc25800-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;$$;
INSERT INTO auth.users(id,email,last_sign_in_at) SELECT pg_temp.u(n),'legacy-upgrade-'||n||'@example.invalid',now() FROM generate_series(1,3)n;
INSERT INTO public."User"(id,email,username,name) SELECT id,email,'legacy_upgrade_'||right(id::text,1),'Legacy upgrade fixture'
 FROM auth.users WHERE id::text LIKE 'ddc25800-%';
INSERT INTO public."Home"(id,created_by_user_id,address,city,state,zipcode) VALUES(pg_temp.u(100),pg_temp.u(1),'Legacy upgrade Home','Test','WA','98607');
INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status,is_primary_owner) VALUES(pg_temp.u(100),pg_temp.u(1),'verified',true);
INSERT INTO public."HomeResidencyClaim"(home_id,user_id,claimed_role,claimed_address,status) VALUES(pg_temp.u(100),pg_temp.u(2),'tenant','Preserved assertion','pending');
INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(pg_temp.u(100),pg_temp.u(2),'tasks.edit',false);
CREATE TEMP TABLE legacy_original AS SELECT public.submit_home_residency(pg_temp.u(100),pg_temp.u(3),pg_temp.u(500),
 '{"claimed_role":"household","address":{"line1":"Legacy upgrade Home","line2":"","city":"Test","state":"WA","postal_code":"98607","country":"US"}}')-'replayed' receipt;
DO $$ BEGIN ASSERT (SELECT receipt->>'state'='completed' FROM legacy_original);END $$;
CREATE TEMP TABLE legacy_rows_before(schema_name text,table_name text,row_count bigint,digest text);
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname IN('public','auth','storage','supabase_migrations') AND c.relkind='r' LOOP
  EXECUTE format('INSERT INTO legacy_rows_before SELECT %L,%L,count(*),md5(coalesce(string_agg(to_jsonb(r)::text,E''\n'' ORDER BY to_jsonb(r)::text),'''')) FROM %I.%I r',t.nspname,t.relname,t.nspname,t.relname);
 END LOOP;
END $$;
""" + (root / migration_path).read_text() + r"""
DO $$ DECLARE t record; actual_count bigint; actual_hash text; BEGIN
 FOR t IN SELECT * FROM legacy_rows_before LOOP
  EXECUTE format('SELECT count(*),md5(coalesce(string_agg(to_jsonb(r)::text,E''\n'' ORDER BY to_jsonb(r)::text),'''')) FROM %I.%I r',t.schema_name,t.table_name) INTO actual_count,actual_hash;
  ASSERT actual_count=t.row_count AND actual_hash=t.digest,'Migration changed existing row values';
 END LOOP;
 ASSERT (SELECT receipt FROM legacy_original)=public.get_home_residency_submission(pg_temp.u(100),pg_temp.u(3),pg_temp.u(500));
 ASSERT EXISTS(SELECT FROM pg_constraint WHERE conrelid='public."HomeResidencyClaim"'::regclass AND conname='one_pending_claim_per_user_home' AND contype='u');
 ASSERT NOT has_function_privilege('authenticated','public.submit_legacy_home_residency(uuid,uuid,jsonb)','EXECUTE');
 ASSERT NOT has_function_privilege('anon','public.save_home_residency_admission(uuid,uuid,text,text,jsonb,uuid)','EXECUTE');
END $$;
CREATE EXTENSION IF NOT EXISTS plpgsql_check WITH SCHEMA extensions;
CREATE TEMP TABLE legacy_lint_issues AS SELECT p.oid::regprocedure::text function_name,c.*
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 CROSS JOIN LATERAL extensions.plpgsql_check_function_tb(p.oid::regprocedure,fatal_errors:=false,use_incomment_options:=false)c
 WHERE n.nspname='public' AND p.proname IN('save_home_residency_admission','submit_home_residency','submit_legacy_home_residency','get_legacy_home_residency_reviewers','review_home_residency');
SELECT function_name,level,sqlstate,lineno,message FROM legacy_lint_issues;
DO $$ BEGIN ASSERT NOT EXISTS(SELECT FROM legacy_lint_issues),'Function lint failed';END $$;
SELECT jsonb_build_object('existing_rows_unchanged',true,'protected_original_unchanged',true,'full_claim_uniqueness_preserved',true,
 'lint_issues',(SELECT count(*) FROM legacy_lint_issues),'candidate_tables',(SELECT count(*) FROM legacy_rows_before));
ROLLBACK;
"""
before = preservation()
save('preservation-before.json', before)
result = run(query)
save('upgrade.stdout.log', result.stdout)
save('upgrade.stderr.log', result.stderr)
after = preservation()
save('preservation-after.json', after)
assert after == before, 'Retained database differs after rollback; preserve evidence and investigate'
assert result.returncode == 0, 'Rehearsal failed; private logs retained and transaction rolled back'
save('result.json', {'pass': True, 'preserved_tables': len(before['rows']), 'complete_populated_rows_schema_preserved': True,
                     'all_changes_rolled_back': True, 'permanent_adoption': False, 'accepted_prerequisites': accepted_paths,
                     'sources': {p: hashlib.sha256((root / p).read_bytes()).hexdigest() for p in [migration_path, *accepted_paths]}})
print('PASS: additive R02 upgrade preserves all existing rows and original receipts; lint passes; entire rehearsal rolled back')
