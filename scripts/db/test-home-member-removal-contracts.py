#!/usr/bin/env python3
"""All final raw/generated contracts against owned committed synthetic candidate.
Every contract rolls back; original retained DB is read-only throughout.
"""
import hashlib,json,re,subprocess,sys
from pathlib import Path
runtime_path,output_text,lease=sys.argv[1:]
assert lease=='--exclusive-lease'
root=Path(__file__).resolve().parents[2];runtime=json.loads(Path(runtime_path).read_text());output=Path(output_text)
assert output.is_absolute() and not output.is_relative_to(root);output.mkdir(parents=True,exist_ok=True,mode=0o700)
container=runtime['database_container'];database=runtime['database']
assert re.fullmatch(r'supabase_db_pantopus-home-gig-[a-z0-9_-]+',container);assert re.fullmatch(r'home_member_removal_r03_[a-f0-9]{12}',database)
def save(name,value):
 p=output/name;p.write_text(value if isinstance(value,str) else json.dumps(value,indent=2)+'\n');p.chmod(0o600)
def run(db,query):
 return subprocess.run(['docker','exec','-i',container,'psql','-X','-qAt','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1'],input=query,text=True,capture_output=True,timeout=180)
def snapshot(db):
 inventory=run(db,"BEGIN READ ONLY; SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname) ORDER BY n.nspname,c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','auth','storage','supabase_migrations') AND c.relkind='r';ROLLBACK;");assert inventory.returncode==0
 quote=lambda v:"'"+v.replace("'","''")+"'";ident=lambda v:'"'+v.replace('"','""')+'"'
 rows=' UNION ALL '.join("SELECT "+quote(s)+"::text schema_name,"+quote(t)+"::text table_name,count(*) row_count,md5(coalesce(string_agg(to_jsonb(r)::text,E'\\n' ORDER BY to_jsonb(r)::text),'')) digest FROM "+ident(s)+'.'+ident(t)+'r' for s,t in json.loads(inventory.stdout))
 result=run(db,"""BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;SELECT jsonb_build_object('rows',(SELECT jsonb_agg(to_jsonb(t) ORDER BY schema_name,table_name) FROM ("""+rows+""")t),
 'functions',(SELECT jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_functiondef(oid),'owner',proowner,'acl',proacl,'config',proconfig) ORDER BY oid) FROM pg_proc WHERE pronamespace='public'::regnamespace AND prokind IN('f','p')),
 'relations',(SELECT jsonb_agg(jsonb_build_object('oid',c.oid,'name',relname,'kind',relkind,'owner',relowner,'acl',relacl,'rls',relrowsecurity,'force_rls',relforcerowsecurity) ORDER BY c.oid) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','auth','storage','supabase_migrations')),
 'attributes',(SELECT jsonb_agg(to_jsonb(a) ORDER BY attrelid,attnum) FROM pg_attribute a WHERE attrelid IN(SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace)),
 'constraints',(SELECT jsonb_agg(to_jsonb(c) ORDER BY oid) FROM pg_constraint c WHERE connamespace='public'::regnamespace),
 'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY oid) FROM pg_trigger t WHERE tgrelid IN(SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace)),
 'defaults',(SELECT jsonb_agg(to_jsonb(d) ORDER BY oid) FROM pg_attrdef d WHERE adrelid IN(SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace)));ROLLBACK;""");assert result.returncode==0;return json.loads(result.stdout)
paths=sorted((root/'scripts/db/contracts').glob('*.sql'))+sorted((root/'supabase/tests').glob('*.test.sql'))
sources={str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}
assert runtime['migration_sha256']==hashlib.sha256((root/'supabase/migrations/20260913010000_home_member_removal_recovery.sql').read_bytes()).hexdigest()
before={'candidate':snapshot(database),'retained':snapshot('postgres')};save('preservation-before.json',before);save('sources-before.json',sources)
results=[]
try:
 for p in paths:
  r=run(database,p.read_text());passed=r.returncode==0 and not re.search(r'^\s*not ok\b',r.stdout,re.M)
  results.append({'source':str(p.relative_to(root)),'passed':passed});save(p.name+'.stdout.log',r.stdout);save(p.name+'.stderr.log',r.stderr)
finally:
 after={'candidate':snapshot(database),'retained':snapshot('postgres')};save('preservation-after.json',after);assert after==before,'Contract rollback preservation failed'
 save('cleanup.json',{'all_contracts_rolled_back':True,'candidate_tables':len(before['candidate']['rows']),'retained_tables':len(before['retained']['rows']),'complete_rows_schema_functions_roles_ledger_preserved':True})
 save('result.json',{'passed':all(r['passed'] for r in results),'raw':len([p for p in paths if p.parent.name=='contracts']),'generated':len([p for p in paths if p.parent.name=='tests']),'results':results,'sources':sources,'scope':'Committed schema-only synthetic candidate contracts; retained DB read-only; populated upgrade separately bound'})
 assert sources=={str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths},'Contract source changed during run'
failed=[r['source'] for r in results if not r['passed']]
print(json.dumps({'passed':not failed,'contracts':len(results),'failed':failed}))
if failed:sys.exit(1)
