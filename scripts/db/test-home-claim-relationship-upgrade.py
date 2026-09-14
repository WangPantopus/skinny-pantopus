#!/usr/bin/env python3
"""Rehearse the additive claim relationship receipt upgrade in an isolated copy.
No hosted connection is accepted; never removes an existing database.
"""
from pathlib import Path
import subprocess,json,re,sys
assert len(sys.argv) in (2,3) and re.fullmatch(r'supabase_db_pantopus-home-gig-[a-z0-9_-]+',sys.argv[1])
container=sys.argv[1];database=sys.argv[2] if len(sys.argv)==3 else 'home_relationship_upgrade_contract'
assert re.fullmatch(r'home_relationship_upgrade(?:_[a-z]+)?_contract',database)
def sql(query,db=database):
 r=subprocess.run(['docker','exec','-i',container,'psql','-X','-qAt','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1'],input=query,text=True,capture_output=True)
 if r.returncode:raise RuntimeError(r.stderr)
 return r.stdout.strip()
assert sql(f"SELECT count(*) FROM pg_database WHERE datname='{database}';",'postgres')=='0'
sql(f'CREATE DATABASE {database} TEMPLATE template0;','postgres')
clone=subprocess.run(['docker','exec',container,'bash','-o','pipefail','-c',f'pg_dump -U postgres -Fc -d postgres | pg_restore -U supabase_admin -d {database} --exit-on-error'],capture_output=True,text=True)
if clone.returncode:raise RuntimeError(clone.stderr)
# Remove only the new, empty objects inside this newly created isolated copy.
assert sql('SELECT count(*) FROM public."HomeClaimRelationshipReceipt";')=='0'
sql("""BEGIN; DROP FUNCTION public.decide_home_claim_relationship(uuid,uuid,uuid,text,text,uuid,text);
 DROP FUNCTION public.home_claim_relationship_result(public."HomeClaimRelationshipReceipt",public."HomeOwnershipClaim",boolean);
 DROP TABLE public."HomeClaimRelationshipReceipt";
 DELETE FROM supabase_migrations.schema_migrations WHERE version='20260910230000'; COMMIT;""")
predecessor=Path('supabase/migrations/20260910220000_home_task_gig_publication.sql').read_text()
sql(predecessor[predecessor.index('CREATE OR REPLACE FUNCTION public.home_delete_eligibility'):])
sql("""BEGIN; INSERT INTO auth.users(id,email) VALUES('ddc23300-0000-4000-8000-000000000001','relationship-upgrade@example.invalid');
 INSERT INTO public."User"(id,email,username,name) VALUES('ddc23300-0000-4000-8000-000000000001','relationship-upgrade@example.invalid','relationship_upgrade','Upgrade fixture');
 INSERT INTO public."Home"(id,owner_id,address,city,state,zipcode) VALUES('ddc23300-0000-4000-8000-000000000100','ddc23300-0000-4000-8000-000000000001','Historical relationship fixture','Test','WA','98607');
 INSERT INTO public."HomeOwnershipClaim"(id,home_id,claimant_user_id,claim_type,state,method,claim_phase_v2)
 VALUES('ddc23300-0000-4000-8000-000000000200','ddc23300-0000-4000-8000-000000000100','ddc23300-0000-4000-8000-000000000001','owner','submitted','doc_upload','under_review');
 INSERT INTO public."HomeVerificationEvidence"(id,claim_id,evidence_type,provider,status,storage_ref)
 VALUES('ddc23300-0000-4000-8000-000000000300','ddc23300-0000-4000-8000-000000000200','deed','manual','pending','legacy/keep-original.pdf');
 INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
 VALUES('ddc23300-0000-4000-8000-000000000100','ddc23300-0000-4000-8000-000000000001','OWNERSHIP_CLAIM_RELATIONSHIP_DECLINED','HomeOwnershipClaim','ddc23300-0000-4000-8000-000000000200','{"legacy":true}'); COMMIT;""")
names=json.loads(sql("SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname)) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','auth','storage') AND c.relkind='r';"))
def snapshot():
 result={}
 for schema,table in names:
  quoted='"'+schema+'"."'+table.replace('"','""')+'"'
  row='to_jsonb(t)'
  result[schema+'.'+table]=json.loads(sql(f"SELECT jsonb_build_array(count(*),md5(coalesce(string_agg(({row})::text,E'\\n' ORDER BY ({row})::text),''))) FROM {quoted} t;"))
 return result
before=snapshot()
sql('BEGIN;'+Path('supabase/migrations/20260910230000_home_claim_relationship_decisions.sql').read_text()+'COMMIT;')
after=snapshot();assert before==after,[k for k in before if before[k]!=after[k]]
assert sql('SELECT count(*) FROM public."HomeClaimRelationshipReceipt";')=='0'
print('PASS: populated predecessor replay preserves',sum(v[0] for v in before.values()),'original rows across',len(names),'public/auth/storage tables; no legacy receipts, evidence or decisions rewritten')
sql("""BEGIN; DELETE FROM public."HomeAuditLog" WHERE home_id='ddc23300-0000-4000-8000-000000000100';
 DELETE FROM public."HomeVerificationEvidence" WHERE id='ddc23300-0000-4000-8000-000000000300';
 DELETE FROM public."HomeOwnershipClaim" WHERE id='ddc23300-0000-4000-8000-000000000200';
 DELETE FROM public."Home" WHERE id='ddc23300-0000-4000-8000-000000000100';
 DELETE FROM public."User" WHERE id='ddc23300-0000-4000-8000-000000000001';
 DELETE FROM auth.users WHERE id='ddc23300-0000-4000-8000-000000000001'; COMMIT;""")
print('PASS: populated upgrade fixture removed; dedicated upgrade database remains until local project cleanup')
