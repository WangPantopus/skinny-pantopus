#!/usr/bin/env python3
"""Rehearse the additive residency review receipt upgrade in an isolated copy.
No hosted connection is accepted; never removes an existing database.
"""
from pathlib import Path
import subprocess,json,re,sys
assert len(sys.argv) in (2,3) and re.fullmatch(r'supabase_db_pantopus-home-gig-[a-z0-9_-]+',sys.argv[1])
container=sys.argv[1];database=sys.argv[2] if len(sys.argv)==3 else 'home_residency_upgrade_contract'
assert re.fullmatch(r'home_residency_upgrade(?:_[a-z]+)?_contract',database)
def sql(query,db=database):
 r=subprocess.run(['docker','exec','-i',container,'psql','-X','-qAt','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1'],input=query,text=True,capture_output=True)
 if r.returncode:raise RuntimeError(r.stderr)
 return r.stdout.strip()
assert sql(f"SELECT count(*) FROM pg_database WHERE datname='{database}';",'postgres')=='0'
sql(f'CREATE DATABASE {database} TEMPLATE template0;','postgres')
clone=subprocess.run(['docker','exec',container,'bash','-o','pipefail','-c',f'pg_dump -U postgres -Fc -d postgres | pg_restore -U supabase_admin -d {database} --exit-on-error'],capture_output=True,text=True)
if clone.returncode:raise RuntimeError(clone.stderr)
# Reconstruct the immediate predecessor only in this newly created copy.
assert sql('SELECT count(*) FROM public."HomeResidencyReviewReceipt";')=='0'
sql("""BEGIN;
 DROP FUNCTION public.decide_home_residency_review(uuid,uuid,uuid,text,text,text,uuid,text,integer);
 DROP FUNCTION public.get_home_residency_review(uuid,uuid,uuid);
 DROP FUNCTION public.home_residency_review_result(public."HomeResidencyReviewReceipt",public."HomeResidencyClaim",boolean);
 DROP FUNCTION public.home_residency_review_current(public."HomeResidencyClaim");
 DROP FUNCTION public.home_residency_review_snapshot(public."HomeResidencyClaim");
 DROP FUNCTION public.home_residency_review_authority(uuid,uuid);
 DROP FUNCTION public.lock_home_residency_review_scope(uuid);
 DROP TABLE public."HomeResidencyReviewReceipt";
 DELETE FROM supabase_migrations.schema_migrations WHERE version='20260910233000'; COMMIT;""")
predecessor=Path('supabase/migrations/20260910230000_home_claim_relationship_decisions.sql').read_text()
sql(predecessor[predecessor.index('CREATE OR REPLACE FUNCTION public.home_delete_eligibility'):])
sql("""BEGIN; INSERT INTO auth.users(id,email) VALUES
 ('ddc23800-0000-4000-8000-000000000001','residency-upgrade-owner@example.invalid'),
 ('ddc23800-0000-4000-8000-000000000002','residency-upgrade-member@example.invalid');
 INSERT INTO public."User"(id,email,username,name) SELECT id,email,'residency_upgrade_'||right(id::text,1),'Upgrade fixture'
 FROM auth.users WHERE id IN('ddc23800-0000-4000-8000-000000000001','ddc23800-0000-4000-8000-000000000002');
 INSERT INTO public."Home"(id,owner_id,address,city,state,zipcode) VALUES
 ('ddc23800-0000-4000-8000-000000000100','ddc23800-0000-4000-8000-000000000001','Historical residency fixture','Test','WA','98607');
 INSERT INTO public."HomeResidencyClaim"(id,home_id,user_id,claimed_address,claimed_role,status,reviewed_by,reviewed_at,review_note)
 VALUES('ddc23800-0000-4000-8000-000000000200','ddc23800-0000-4000-8000-000000000100',
 'ddc23800-0000-4000-8000-000000000002','Historical residency fixture','guest','rejected',
 'ddc23800-0000-4000-8000-000000000001',now()-interval '3 days','Preserve historical review');
 INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,is_active,verification_status,access_end_at)
 VALUES('ddc23800-0000-4000-8000-000000000100','ddc23800-0000-4000-8000-000000000002','guest','guest','teen',false,'moved_out',now()-interval '1 day');
 INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed)
 VALUES('ddc23800-0000-4000-8000-000000000100','ddc23800-0000-4000-8000-000000000002','finance.manage',false);
 INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
 VALUES('ddc23800-0000-4000-8000-000000000100','ddc23800-0000-4000-8000-000000000001','residency_claim_rejected',
 'HomeResidencyClaim','ddc23800-0000-4000-8000-000000000200','{"legacy":true}'); COMMIT;""")
names=json.loads(sql("SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname)) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','auth','storage') AND c.relkind='r';"))
def snapshot():
 result={}
 for schema,table in names:
  quoted='"'+schema+'"."'+table.replace('"','""')+'"'
  row='to_jsonb(t)'
  result[schema+'.'+table]=json.loads(sql(f"SELECT jsonb_build_array(count(*),md5(coalesce(string_agg(({row})::text,E'\\n' ORDER BY ({row})::text),''))) FROM {quoted} t;"))
 return result
before=snapshot()
sql('BEGIN;'+Path('supabase/migrations/20260910233000_home_residency_review_receipts.sql').read_text()+'COMMIT;')
after=snapshot();assert before==after,[k for k in before if before[k]!=after[k]]
assert sql('SELECT count(*) FROM public."HomeResidencyReviewReceipt";')=='0'
print('PASS: populated predecessor replay preserves',sum(v[0] for v in before.values()),'original rows across',len(names),'public/auth/storage tables; no legacy receipts, memberships or decisions rewritten')
sql("""BEGIN; DELETE FROM public."HomeAuditLog" WHERE home_id='ddc23800-0000-4000-8000-000000000100';
 DELETE FROM public."HomePermissionOverride" WHERE home_id='ddc23800-0000-4000-8000-000000000100';
 DELETE FROM public."HomeOccupancy" WHERE home_id='ddc23800-0000-4000-8000-000000000100';
 DELETE FROM public."HomeResidencyClaim" WHERE id='ddc23800-0000-4000-8000-000000000200';
 DELETE FROM public."Home" WHERE id='ddc23800-0000-4000-8000-000000000100';
 DELETE FROM public."User" WHERE id IN('ddc23800-0000-4000-8000-000000000001','ddc23800-0000-4000-8000-000000000002');
 DELETE FROM auth.users WHERE id IN('ddc23800-0000-4000-8000-000000000001','ddc23800-0000-4000-8000-000000000002'); COMMIT;""")
print('PASS: populated residency upgrade fixture removed; dedicated upgrade database remains until local project cleanup')
