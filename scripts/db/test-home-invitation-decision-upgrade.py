#!/usr/bin/env python3
"""Rehearse the additive invitation decision migration with complete row-value preservation.
Owned local database only; all DDL, fixtures and lint installation roll back.
"""
import re
import subprocess
import sys
from pathlib import Path

assert len(sys.argv) == 2 and re.fullmatch(r'supabase_db_pantopus-home-gig-[a-z0-9_-]+', sys.argv[1])
root = Path(__file__).resolve().parents[2]
migration = (root / 'supabase/migrations/20260912020000_home_invitation_decision_recovery.sql').read_text()
query = r"""
BEGIN ISOLATION LEVEL REPEATABLE READ;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
CREATE TEMP TABLE invitation_before(schema_name text, table_name text, row_count bigint, digest text) ON COMMIT DROP;
DO $$ DECLARE t record; BEGIN
  ASSERT to_regclass('public."HomeInvitationDecisionCommand"') IS NULL;
  FOR t IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN('public','auth','storage','supabase_migrations') AND c.relkind='r' LOOP
    EXECUTE format('INSERT INTO invitation_before SELECT %L,%L,count(*),md5(coalesce(string_agg(to_jsonb(r)::text,E''\n'' ORDER BY to_jsonb(r)::text),'''')) FROM %I.%I r',t.nspname,t.relname,t.nspname,t.relname);
  END LOOP;
END $$;
"""+migration+r"""
DO $$ DECLARE t record; actual_count bigint; actual_hash text; BEGIN
  FOR t IN SELECT * FROM invitation_before LOOP
    EXECUTE format('SELECT count(*),md5(coalesce(string_agg(to_jsonb(r)::text,E''\n'' ORDER BY to_jsonb(r)::text),'''')) FROM %I.%I r',t.schema_name,t.table_name)
      INTO actual_count,actual_hash;
    ASSERT actual_count=t.row_count AND actual_hash=t.digest,'Existing row values changed';
  END LOOP;
  ASSERT (SELECT count(*)=0 FROM public."HomeInvitationDecisionCommand");
END $$;
CREATE EXTENSION IF NOT EXISTS plpgsql_check WITH SCHEMA extensions;
CREATE TEMP TABLE invitation_function_issues ON COMMIT DROP AS
SELECT p.oid::regprocedure::text AS function_name,c.* FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
CROSS JOIN LATERAL extensions.plpgsql_check_function_tb(p.oid::regprocedure,fatal_errors:=false,use_incomment_options:=false)c
WHERE n.nspname='public' AND p.proname IN('prepare_home_invitation_decision','get_home_invitation_decision','resolve_home_invitation_decision');
SELECT json_build_object('preserved_tables',(SELECT count(*) FROM invitation_before),'lint_issues',(SELECT count(*) FROM invitation_function_issues));
SELECT function_name,level,sqlstate,lineno,message FROM invitation_function_issues;
DO $$ BEGIN ASSERT NOT EXISTS(SELECT FROM invitation_function_issues),'Invitation function lint issues remain';END $$;
ROLLBACK;
"""
result = subprocess.run(['docker', 'exec', '-i', sys.argv[1], 'psql', '-X', '-qAt', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], input=query, text=True, capture_output=True)
print(result.stdout, end='')
if result.returncode:
    print(result.stderr, file=sys.stderr)
    raise SystemExit(result.returncode)
print('PASS: all original public/auth/storage/migration row values preserved; migration and lint rehearsal rolled back')
