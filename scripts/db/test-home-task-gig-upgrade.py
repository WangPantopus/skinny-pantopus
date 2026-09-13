#!/usr/bin/env python3
"""Rehearse the additive task-format/publication upgrade in an isolated copy.
No hosted connection is accepted; never removes an existing database.
"""
from pathlib import Path
import subprocess,json,re,sys
assert len(sys.argv)==2 and re.fullmatch(r'supabase_db_pantopus-home-gig-[a-z0-9_-]+',sys.argv[1])
container=sys.argv[1];database='home_gig_upgrade_contract'
def sql(query,db=database):
 r=subprocess.run(['docker','exec','-i',container,'psql','-X','-qAt','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1'],input=query,text=True,capture_output=True)
 if r.returncode:raise RuntimeError(r.stderr)
 return r.stdout.strip()
assert sql("SELECT count(*) FROM pg_database WHERE datname='home_gig_upgrade_contract';",'postgres')=='0'
sql('CREATE DATABASE home_gig_upgrade_contract TEMPLATE template0;','postgres')
clone=subprocess.run(['docker','exec',container,'bash','-o','pipefail','-c','pg_dump -U postgres -Fc -d postgres | pg_restore -U supabase_admin -d home_gig_upgrade_contract --exit-on-error'],capture_output=True,text=True)
if clone.returncode:raise RuntimeError(clone.stderr)
base=Path('supabase/migrations/20260910200000_home_task_recurrence.sql').read_text();fn=base[base.index('CREATE OR REPLACE FUNCTION public.home_delete_eligibility'):];fn=fn[:fn.index('\n$$;')+4]
sql('BEGIN; DROP FUNCTION public.get_home_task_gig_publication(uuid,uuid,uuid); DROP FUNCTION public.publish_home_task_gig(uuid,uuid,uuid,uuid,timestamptz,jsonb,jsonb); DROP TABLE public."HomeTaskGigReceipt"; ALTER TABLE public."Gig" DROP COLUMN task_format; DROP TYPE public.task_format; '+fn+" DELETE FROM supabase_migrations.schema_migrations WHERE version IN('20260910215000','20260910220000'); COMMIT;")
sql('''BEGIN; INSERT INTO auth.users(id,email) VALUES('ddf22300-0000-4000-8000-000000000001','upgrade-gig@example.invalid');
 INSERT INTO public."User"(id,email,username,name) VALUES('ddf22300-0000-4000-8000-000000000001','upgrade-gig@example.invalid','home_gig_upgrade','Upgrade fixture');
 INSERT INTO public."Gig"(id,user_id,title,description,price,status) VALUES('ddf22300-0000-4000-8000-000000000101','ddf22300-0000-4000-8000-000000000001','Historical canceled Gig','Preserve all historical terms and state',12.34,'cancelled'); COMMIT;''')
names=json.loads(sql("SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname)) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','auth','storage') AND c.relkind='r';"))
def snapshot():
 result={}
 for schema,table in names:
  quoted='"'+schema+'"."'+table.replace('"','""')+'"'
  row="to_jsonb(t)-'task_format'" if table=='Gig' and schema=='public' else 'to_jsonb(t)'
  result[schema+'.'+table]=json.loads(sql(f"SELECT jsonb_build_array(count(*),md5(coalesce(string_agg(({row})::text,E'\\n' ORDER BY ({row})::text),''))) FROM {quoted} t;"))
 return result
before=snapshot()
for f in ['20260910215000_gig_task_format_compatibility.sql','20260910220000_home_task_gig_publication.sql']:
 sql('BEGIN;'+Path('supabase/migrations',f).read_text()+'COMMIT;')
after=snapshot();assert before==after,[k for k in before if before[k]!=after[k]]
assert sql('SELECT task_format FROM public."Gig" WHERE id=\'ddf22300-0000-4000-8000-000000000101\';')=='in_person'
print('PASS: populated predecessor replay preserves',sum(v[0] for v in before.values()),'original rows across',len(names),'public/auth/storage tables; adds only documented task format default')
sql('''BEGIN; DELETE FROM public."Gig" WHERE id='ddf22300-0000-4000-8000-000000000101'; DELETE FROM public."User" WHERE id='ddf22300-0000-4000-8000-000000000001'; DELETE FROM auth.users WHERE id='ddf22300-0000-4000-8000-000000000001'; COMMIT;''')
print('PASS: populated upgrade fixture removed; dedicated upgrade database remains until local project cleanup')
