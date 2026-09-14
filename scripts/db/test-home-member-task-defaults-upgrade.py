#!/usr/bin/env python3
"""Actual additive member Task policy on the populated owned replay, all rolled back.

Requires exclusive DB ownership. No ledger adoption or permanent test fixtures.
Full retained row hashes and schema/function properties are checked before/after.
"""
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

container, output_text = sys.argv[1:]
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

migration_path = 'supabase/migrations/20260912050000_home_member_task_defaults.sql'
migration = (root / migration_path).read_text()
accepted_paths = ['supabase/migrations/20260911030000_home_member_view_defaults.sql',
                  'supabase/migrations/20260912020000_home_invitation_decision_recovery.sql',
                  'supabase/migrations/20260912040000_home_invitation_sender_recovery.sql']
query = """BEGIN ISOLATION LEVEL REPEATABLE READ;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='90s';
DO $$ BEGIN ASSERT to_regclass('public."HomeInvitationSenderCommand"') IS NULL;
 ASSERT NOT EXISTS(SELECT FROM auth.users WHERE id::text LIKE 'ddc25200-0000-4000-8000-%');END $$;
""" + '\n'.join((root / p).read_text() for p in accepted_paths) + """
CREATE FUNCTION pg_temp.u(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('ddc25200-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;$$;
INSERT INTO auth.users(id,email,email_confirmed_at) SELECT pg_temp.u(n),'member-task-upgrade-'||n||'@example.invalid',now() FROM generate_series(1,4)n;
INSERT INTO public."User"(id,email,username,name) SELECT id,email,'member_task_upgrade_'||right(id::text,1),'Member Task upgrade' FROM auth.users WHERE id::text LIKE 'ddc25200-0000-4000-8000-%';
INSERT INTO public."Home"(id,owner_id,created_by_user_id,address,city,state,zipcode) VALUES(pg_temp.u(100),pg_temp.u(1),pg_temp.u(1),'Owned upgrade fixture','Test','WA','98607');
INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status,is_primary_owner) VALUES(pg_temp.u(100),pg_temp.u(1),'verified',true);
INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,verification_status) VALUES(pg_temp.u(100),pg_temp.u(2),'member','member','verified');
CREATE TEMP TABLE mt_before_invites(actor_id uuid,invitation_id uuid,prepared jsonb);
DO $$ DECLARE n integer; r jsonb; BEGIN
 ASSERT NOT public.home_has_permission(pg_temp.u(100),'tasks.view',pg_temp.u(2)),'Retained candidate baseline changed; inspect before proceeding';
 FOR n IN 3..4 LOOP
  r:=public.write_home_invitation(pg_temp.u(100),pg_temp.u(1),'create',jsonb_build_object('user_id',pg_temp.u(n),'relationship','member'),repeat(n::text,64));
  ASSERT r->>'ok'='true';
  IF n=4 THEN UPDATE public."HomeInvite" SET admission_policy=NULL WHERE id=(r->'invitation'->>'id')::uuid; END IF;
  INSERT INTO mt_before_invites VALUES(pg_temp.u(n),(r->'invitation'->>'id')::uuid,public.prepare_home_invitation_decision(pg_temp.u(n),repeat(n::text,64)));
 END LOOP;
END $$;
CREATE TEMP TABLE mt_rows_before(schema_name text,table_name text,row_count bigint,digest text);
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname IN('public','auth','storage','supabase_migrations') AND c.relkind='r' AND c.relname<>'HomeRolePermission' LOOP
  EXECUTE format('INSERT INTO mt_rows_before SELECT %L,%L,count(*),md5(coalesce(string_agg(to_jsonb(r)::text,E''\\n'' ORDER BY to_jsonb(r)::text),'''')) FROM %I.%I r',t.nspname,t.relname,t.nspname,t.relname);
 END LOOP;
END $$;
CREATE TEMP TABLE mt_roles_before AS SELECT to_jsonb(r) row FROM public."HomeRolePermission"r;
""" + migration + """
DO $$ DECLARE t record; n bigint; h text; BEGIN
 FOR t IN SELECT * FROM mt_rows_before LOOP
  EXECUTE format('SELECT count(*),md5(coalesce(string_agg(to_jsonb(r)::text,E''\\n'' ORDER BY to_jsonb(r)::text),'''')) FROM %I.%I r',t.schema_name,t.table_name) INTO n,h;
  ASSERT n=t.row_count AND h=t.digest,'Migration changed populated row values outside intended role inserts';
 END LOOP;
 ASSERT NOT EXISTS(SELECT FROM mt_roles_before b WHERE NOT EXISTS(SELECT FROM public."HomeRolePermission"r WHERE to_jsonb(r)=b.row)),'Existing role row changed';
 ASSERT (SELECT count(*) FROM public."HomeRolePermission")=(SELECT count(*)+2 FROM mt_roles_before),'Unexpected role delta';
 ASSERT public.home_get_user_permissions(pg_temp.u(100),pg_temp.u(2))=ARRAY['home.view','tasks.edit','tasks.view']::text[],'Existing ordinary member did not gain live defaults';
 FOR t IN SELECT * FROM mt_before_invites LOOP
  ASSERT (public.prepare_home_invitation_decision(t.actor_id,repeat(right(t.actor_id::text,1),64)))->>'decision_token'=t.prepared->>'decision_token','Global defaults changed original prepared hash';
 END LOOP;
 ASSERT public.act_on_home_invitation((SELECT invitation_id FROM mt_before_invites WHERE actor_id=pg_temp.u(3)),NULL,pg_temp.u(3),'accept')->>'code'='INVITE_POLICY_CHANGED','Non-null old policy silently broadened';
 ASSERT public.act_on_home_invitation((SELECT invitation_id FROM mt_before_invites WHERE actor_id=pg_temp.u(4)),NULL,pg_temp.u(4),'accept')->>'ok'='true','Legacy null-policy compatibility changed';
 ASSERT (SELECT admission_policy IS NULL FROM public."HomeInvite" WHERE id=(SELECT invitation_id FROM mt_before_invites WHERE actor_id=pg_temp.u(4))),'Legacy snapshot was rewritten';
END $$;
CREATE TEMP TABLE mt_first_upgrade AS SELECT jsonb_agg(to_jsonb(r) ORDER BY role_base,permission) rows FROM public."HomeRolePermission"r;
""" + migration + """
DO $$ BEGIN ASSERT (SELECT rows FROM mt_first_upgrade)=(SELECT jsonb_agg(to_jsonb(r) ORDER BY role_base,permission) FROM public."HomeRolePermission"r),'Reapplication changed rows';END $$;
SAVEPOINT role_decisions;
UPDATE public."HomeRolePermission" SET allowed=false WHERE role_base='member' AND permission='tasks.view';
CREATE TEMP TABLE mt_explicit_decisions AS SELECT jsonb_agg(to_jsonb(r) ORDER BY role_base,permission) rows FROM public."HomeRolePermission"r;
""" + migration + """
DO $$ BEGIN ASSERT (SELECT rows FROM mt_explicit_decisions)=(SELECT jsonb_agg(to_jsonb(r) ORDER BY role_base,permission) FROM public."HomeRolePermission"r),'Explicit role view deny or grant overwritten';
 ASSERT NOT public.home_has_permission(pg_temp.u(100),'tasks.view',pg_temp.u(2));END $$;
ROLLBACK TO SAVEPOINT role_decisions;
UPDATE public."HomeRolePermission" SET allowed=false WHERE role_base='member' AND permission='tasks.edit';
CREATE TEMP TABLE mt_explicit_edit_decisions AS SELECT jsonb_agg(to_jsonb(r) ORDER BY role_base,permission) rows FROM public."HomeRolePermission"r;
""" + migration + """
DO $$ BEGIN ASSERT (SELECT rows FROM mt_explicit_edit_decisions)=(SELECT jsonb_agg(to_jsonb(r) ORDER BY role_base,permission) FROM public."HomeRolePermission"r),'Explicit role edit deny or grant overwritten';
 ASSERT public.home_has_permission(pg_temp.u(100),'tasks.view',pg_temp.u(2)) AND NOT public.home_has_permission(pg_temp.u(100),'tasks.edit',pg_temp.u(2));END $$;
ROLLBACK TO SAVEPOINT role_decisions;
SELECT jsonb_build_object('changed_role_rows',2,'existing_member_live_defaults',true,'old_nonnull_policy_rejected',true,'legacy_null_policy_preserved',true,'prepared_original_hashes_unchanged',true,'role_denies_preserved',true,'idempotent',true);
ROLLBACK;
"""
before = preservation()
save('preservation-before.json', before)
result = run(query)
save('upgrade.stdout.log', result.stdout)
save('upgrade.stderr.log', result.stderr)
after = preservation()
save('preservation-after.json', after)
assert after == before, 'Retained rows/schema changed; preserve evidence and investigate'
assert result.returncode == 0, 'Upgrade failed; private logs retained; outer transaction rolled back'
save('result.json', {'pass': True, 'preserved_tables': len(before['rows']), 'complete_populated_rows_schema_preserved': True,
                     'all_changes_rolled_back': True, 'source_sha256': {p: hashlib.sha256((root / p).read_bytes()).hexdigest() for p in [migration_path, *accepted_paths]}})
print('PASS: additive member Task migration, old policy/legacy compatibility, populated decisions and idempotence; all retained rows/schema preserved after rollback')
