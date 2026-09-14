#!/usr/bin/env python3
"""Populated additive R03 rehearsal; exclusive owned DB, entire outer rollback."""
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


accepted_paths = [str(p.relative_to(root)) for p in sorted((root/'supabase/migrations').glob('*.sql')) if '20260911030000' <= p.name[:14] <= '20260912060000']
migration_path='supabase/migrations/20260913010000_home_member_removal_recovery.sql'
query=r"""
BEGIN ISOLATION LEVEL REPEATABLE READ;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='90s';
DO $$ BEGIN
 ASSERT to_regclass('public."HomeMemberRemovalCommand"') IS NULL;
 ASSERT NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid='public."HomeOccupancy"'::regclass AND attname='membership_version' AND NOT attisdropped);
 ASSERT NOT EXISTS(SELECT FROM auth.users WHERE id::text LIKE 'ddc26300-%');
END $$;
"""+'\n'.join((root/p).read_text() for p in accepted_paths)+r"""
CREATE FUNCTION pg_temp.u(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('ddc26300-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;$$;
INSERT INTO auth.users(id,email) SELECT pg_temp.u(n),'removal-upgrade-'||n||'@example.invalid' FROM generate_series(1,5)n;
INSERT INTO public."User"(id,email,username,name) SELECT id,email,'removal_upgrade_'||right(id::text,1),'Never project this legal name' FROM auth.users WHERE id::text LIKE 'ddc26300-%';
INSERT INTO public."Home"(id,owner_id,created_by_user_id,name,address,city,state,zipcode)
 VALUES(pg_temp.u(100),pg_temp.u(1),pg_temp.u(1),'Removal upgrade Home','Removal upgrade Home','Test','WA','98607');
INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status,is_primary_owner) VALUES(pg_temp.u(100),pg_temp.u(1),'verified',true);
INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,is_active,verification_status,age_band)
 VALUES(pg_temp.u(100),pg_temp.u(1),'owner','owner',true,'verified','adult'),(pg_temp.u(100),pg_temp.u(2),'member','member',true,'verified','adult');
INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(pg_temp.u(100),pg_temp.u(2),'finance.manage',false);
CREATE TEMP TABLE predecessor AS SELECT
 public.submit_home_residency(pg_temp.u(100),pg_temp.u(4),pg_temp.u(504),'{"claimed_role":"household","address":{"line1":"Removal upgrade Home","line2":"","city":"Test","state":"WA","postal_code":"98607","country":"US"}}')-'replayed' residency;
CREATE TEMP TABLE predecessor_sender AS SELECT public.prepare_home_invitation_sender(pg_temp.u(1),jsonb_build_object('home_id',pg_temp.u(100),'action','create','payload',jsonb_build_object('user_id',pg_temp.u(3),'relationship','member'))) context;
CREATE TEMP TABLE predecessor_sender_result AS SELECT public.resolve_home_invitation_sender(pg_temp.u(1),pg_temp.u(503),repeat('a',64),
 jsonb_build_object('home_id',pg_temp.u(100),'action','create','payload',jsonb_build_object('user_id',pg_temp.u(3),'relationship','member'),
 'decision_token',(SELECT context->>'decision_token' FROM predecessor_sender)),false)-'replayed' receipt;
CREATE TEMP TABLE predecessor_recipient AS SELECT public.prepare_home_invitation_decision(pg_temp.u(3),repeat('a',64)) context;
DO $$ BEGIN
 ASSERT (SELECT residency->>'state'='completed' FROM predecessor);
 ASSERT (SELECT receipt->>'state'='completed' FROM predecessor_sender_result);
 ASSERT (SELECT context->>'ok'='true' FROM predecessor_recipient);
END $$;
-- Existing pending reviewer original is deliberately invalidated by adding
-- the nullable semantic-version field to its whole-row reviewed snapshot.
INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,is_active,verification_status,age_band)
 VALUES(pg_temp.u(100),pg_temp.u(5),'member','member',true,'pending_doc','adult');
INSERT INTO public."HomeResidencyClaim"(id,home_id,user_id,claimed_role,claimed_address,status)
 VALUES(pg_temp.u(205),pg_temp.u(100),pg_temp.u(5),'member','Removal upgrade Home','pending');
CREATE TEMP TABLE predecessor_pending_review AS SELECT public.home_residency_review_snapshot(c) token,to_jsonb(c) claim,
 (SELECT to_jsonb(o) FROM public."HomeOccupancy"o WHERE home_id=c.home_id AND user_id=c.user_id) occupancy,
 (SELECT count(*) FROM public."HomeAuditLog" WHERE home_id=c.home_id) audit_count FROM public."HomeResidencyClaim"c WHERE id=pg_temp.u(205);
CREATE TEMP TABLE occupancy_heap_before AS SELECT id,xmin::text tx,ctid::text tuple FROM public."HomeOccupancy";
CREATE TEMP TABLE removal_rows_before(schema_name text,table_name text,row_count bigint,digest text);
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','auth','storage','supabase_migrations') AND c.relkind='r' LOOP
 EXECUTE format('INSERT INTO removal_rows_before SELECT %L,%L,count(*),md5(coalesce(string_agg(to_jsonb(r)::text,E''\n'' ORDER BY to_jsonb(r)::text),'''')) FROM %I.%I r',t.nspname,t.relname,t.nspname,t.relname);
 END LOOP;
END $$;
"""+(root/migration_path).read_text()+r"""
DO $$ DECLARE t record; n bigint; h text; projection text; BEGIN
 FOR t IN SELECT * FROM removal_rows_before LOOP
  projection:=CASE WHEN t.schema_name='public' AND t.table_name='HomeOccupancy' THEN '(to_jsonb(r)-''membership_version'')' ELSE 'to_jsonb(r)' END;
  EXECUTE format('SELECT count(*),md5(coalesce(string_agg(%s::text,E''\n'' ORDER BY %s::text),'''')) FROM %I.%I r',projection,projection,t.schema_name,t.table_name) INTO n,h;
  ASSERT n=t.row_count AND h=t.digest,'Existing column values changed during nullable-column upgrade';
 END LOOP;
 ASSERT NOT EXISTS(SELECT FROM public."HomeOccupancy" WHERE membership_version IS NOT NULL),'Historical rows were backfilled';
 ASSERT NOT EXISTS(SELECT FROM public."HomeOccupancy"r JOIN occupancy_heap_before b USING(id) WHERE r.xmin::text<>b.tx OR r.ctid::text<>b.tuple),'Upgrade rewrote old heap rows';
 ASSERT (SELECT residency FROM predecessor)=public.get_home_residency_submission(pg_temp.u(100),pg_temp.u(4),pg_temp.u(504));
 ASSERT (SELECT receipt FROM predecessor_sender_result)=public.get_home_invitation_sender(pg_temp.u(1),pg_temp.u(503));
 ASSERT (SELECT context FROM predecessor_recipient)=public.prepare_home_invitation_decision(pg_temp.u(3),repeat('a',64));
END $$;
DO $$ DECLARE old_token text;new_token text;r jsonb;BEGIN
 SELECT token INTO old_token FROM predecessor_pending_review;
 SELECT public.home_residency_review_snapshot(c) INTO new_token FROM public."HomeResidencyClaim"c WHERE id=pg_temp.u(205);
 ASSERT old_token<>new_token,'Whole-row reviewer snapshot must acknowledge nullable schema addition';
 r:=public.decide_home_residency_review(pg_temp.u(100),pg_temp.u(205),pg_temp.u(1),'approve','member',NULL,pg_temp.u(507),old_token);
 ASSERT r->>'code'='RESIDENCY_REVIEW_CHANGED';
 ASSERT (SELECT claim FROM predecessor_pending_review)=(SELECT to_jsonb(c) FROM public."HomeResidencyClaim"c WHERE id=pg_temp.u(205));
 ASSERT (SELECT occupancy FROM predecessor_pending_review)=(SELECT to_jsonb(o)-'membership_version' FROM public."HomeOccupancy"o WHERE home_id=pg_temp.u(100) AND user_id=pg_temp.u(5));
 ASSERT (SELECT audit_count FROM predecessor_pending_review)=(SELECT count(*) FROM public."HomeAuditLog" WHERE home_id=pg_temp.u(100));
 ASSERT NOT EXISTS(SELECT FROM public."HomeResidencyReviewReceipt" WHERE request_id=pg_temp.u(507));
 r:=public.decide_home_residency_review(pg_temp.u(100),pg_temp.u(205),pg_temp.u(1),'approve','member',NULL,pg_temp.u(508),new_token);
 ASSERT r->>'ok'='true';ASSERT r->'receipt'->'result'->>'status'='verified';
END $$;
-- NULL predecessors get a nonce only on a semantic update. Same-transaction ABA
-- cannot restore the nonce, even though updated_at uses transaction-start now().
DO $$ DECLARE old_version uuid; a uuid; b uuid; c jsonb; o public."HomeOccupancy"; BEGIN
 SELECT * INTO o FROM public."HomeOccupancy" WHERE home_id=pg_temp.u(100) AND user_id=pg_temp.u(2);ASSERT o.membership_version IS NULL;
 UPDATE public."HomeOccupancy" SET density_milestone_seen=density_milestone_seen+1,updated_at=clock_timestamp(),membership_version=pg_temp.u(900) WHERE id=o.id;
 ASSERT (SELECT membership_version IS NULL FROM public."HomeOccupancy" WHERE id=o.id);
 c:=public.prepare_home_member_removal(pg_temp.u(1),pg_temp.u(100),pg_temp.u(2));ASSERT c->>'ok'='true';ASSERT c->'target'->'name'='null'::jsonb;
 UPDATE public."HomeOccupancy" SET role='guest',role_base='guest' WHERE id=o.id RETURNING membership_version INTO a;ASSERT a IS NOT NULL;
 UPDATE public."HomeOccupancy" SET role=o.role,role_base=o.role_base,membership_version=NULL WHERE id=o.id RETURNING membership_version INTO b;ASSERT b IS NOT NULL AND b<>a;
 UPDATE public."HomeOccupancy" SET membership_version=a WHERE id=o.id RETURNING membership_version INTO old_version;ASSERT old_version=b;
 ASSERT public.resolve_home_member_removal(pg_temp.u(1),pg_temp.u(502),c-ARRAY['ok','home','target']) ->>'code'='MEMBER_REMOVAL_CHANGED';
 ASSERT EXISTS(SELECT FROM public."HomeOccupancy" WHERE id=o.id AND is_active);
END $$;
CREATE EXTENSION IF NOT EXISTS plpgsql_check WITH SCHEMA extensions;
CREATE TEMP TABLE removal_lint AS SELECT p.oid::regprocedure::text function_name,c.* FROM pg_proc p
 CROSS JOIN LATERAL extensions.plpgsql_check_function_tb(p.oid::regprocedure,fatal_errors:=false,use_incomment_options:=false)c
 WHERE p.pronamespace='public'::regnamespace AND p.prolang=(SELECT oid FROM pg_language WHERE lanname='plpgsql')
 AND p.proname IN('home_member_removal_context','apply_home_member_removal','mutate_home_member','prepare_home_member_removal','get_home_member_removal','resolve_home_member_removal');
SELECT function_name,level,sqlstate,lineno,message FROM removal_lint;
DO $$ BEGIN ASSERT NOT EXISTS(SELECT FROM removal_lint),'Removal SQL lint issues';END $$;
SELECT jsonb_build_object('existing_columns_preserved',true,'historical_versions_null',true,'no_heap_backfill',true,
 'original_residency_sender_recipient_preserved',true,'pending_reviewer_original_requires_fresh_review',true,'old_review_refusal_is_mutation_free',true,'null_transition_and_same_transaction_ABA_protected',true,'lint_issues',(SELECT count(*) FROM removal_lint));
ROLLBACK;
"""
before=preservation();save('preservation-before.json',before)
result=run(query);save('upgrade.stdout.log',result.stdout);save('upgrade.stderr.log',result.stderr)
after=preservation();save('preservation-after.json',after)
assert after==before,'Retained database differs after rollback; preserve evidence and investigate'
save('cleanup.json',{'complete_populated_rows_schema_preserved':True,'all_changes_rolled_back':True,'preserved_tables':len(before['rows'])})
assert result.returncode==0,'R03 rehearsal failed; private diagnostics retained, outer rollback preserved state'
save('result.json',{'passed':True,'preserved_tables':len(before['rows']),'permanent_adoption':False,'sources':{p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in [migration_path,*accepted_paths]}})
print('PASS R03 populated upgrade: original columns/receipts preserved, no backfill, semantic ABA protected, zero SQL lint; exact rollback')
