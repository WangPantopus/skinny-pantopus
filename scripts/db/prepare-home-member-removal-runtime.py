#!/usr/bin/env python3
"""Create/retain an owned schema-only R03 database and existing-image local REST runtime."""
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


import urllib.parse
migration=root/'supabase/migrations/20260913010000_home_member_removal_recovery.sql'
digest=hashlib.sha256(migration.read_bytes()).hexdigest()
database='home_member_removal_r03_'+digest[:12]
rest_name='pantopus-r03-rest-'+digest[:12]
port=18085
assert re.fullmatch(r'home_member_removal_r03_[a-f0-9]{12}',database)
def checked(argv, data=None, binary=False):
    r=subprocess.run(argv,input=data,capture_output=True,text=not binary,timeout=180)
    if r.returncode:
        save('runtime-failure.log',r.stderr.decode(errors='replace') if binary else r.stderr)
        raise RuntimeError('Owned runtime preparation failed; private diagnostics retained')
    return r.stdout

def sql(query,db=database):
    return checked(['docker','exec','-i',container,'psql','-X','-qAt','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1'],query).strip()
def catalogs():
    return json.loads(sql("""BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
    SELECT jsonb_build_object(
      'attributes',(SELECT jsonb_agg(to_jsonb(a) ORDER BY attrelid,attnum) FROM pg_attribute a WHERE attrelid IN(SELECT oid FROM pg_class WHERE relnamespace IN(SELECT oid FROM pg_namespace WHERE nspname IN('public','auth','storage','supabase_migrations')))),
      'defaults',(SELECT jsonb_agg(to_jsonb(d) ORDER BY oid) FROM pg_attrdef d),
      'constraints',(SELECT jsonb_agg(to_jsonb(c) ORDER BY oid) FROM pg_constraint c),
      'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY oid) FROM pg_trigger t));ROLLBACK;""",'postgres'))
before=preservation();catalog_before=catalogs();save('preservation-before.json',before);save('catalog-before.json',catalog_before)
comment='Pantopus owned R03 schema-only acceptance; migration SHA256 '+digest
exists=sql("SELECT count(*) FROM pg_database WHERE datname='"+database+"';",'postgres')=='1'
try:
    if not exists:
        sql('CREATE DATABASE '+database+' TEMPLATE template0;','postgres')
        sql("COMMENT ON DATABASE "+database+" IS '"+comment+"';",'postgres')
        schema=checked(['docker','exec',container,'pg_dump','-U','postgres','-Fc','--schema-only','-d','postgres'],binary=True)
        save('schema-copy.json',{'scope':'schema only; no account, Home or other owner rows copied','sha256':hashlib.sha256(schema).hexdigest(),'bytes':len(schema)})
        checked(['docker','exec','-i',container,'pg_restore','-U','supabase_admin','-d',database,'--exit-on-error'],schema,binary=True)
        for schema_name,table in [('public','HomeRolePermission'),('public','HomeRolePreset'),('supabase_migrations','schema_migrations')]:
            rows=sql('SELECT coalesce(jsonb_agg(to_jsonb(r)),\'[]\') FROM '+schema_name+'."'+table+'"r;','postgres')
            sql('INSERT INTO '+schema_name+'."'+table+'" SELECT * FROM jsonb_populate_recordset(NULL::'+schema_name+'."'+table+'",\''+rows.replace("'","''")+'\'::jsonb);')
        accepted=[p for p in sorted((root/'supabase/migrations').glob('*.sql')) if '20260911030000'<=p.name[:14]<='20260912060000']
        sql('BEGIN;'+''.join(p.read_text() for p in accepted)+migration.read_text()+'COMMIT;')
        assert sql('SELECT count(*) FROM auth.users;')=='0'
        assert sql('SELECT count(*) FROM public."Home";')=='0'
        save('candidate-created.json',{'database':database,'migration_sha256':digest,'candidate_schema_only':True,'copied_reference_tables':['public.HomeRolePermission','public.HomeRolePreset','supabase_migrations.schema_migrations'],'auth_and_home_rows':0,'accepted_migrations':[str(p.relative_to(root)) for p in accepted]})
    else:
        assert sql("SELECT shobj_description(oid,'pg_database') FROM pg_database WHERE datname='"+database+"';",'postgres')==comment,'Existing database is not this owned candidate'
        assert sql('SELECT count(*) FROM public."HomeMemberRemovalCommand";')=='0','Previous owned fixture is not clean'
    # Restore only checked-in non-user static defaults missing from a schema-only
    # copy. Do not copy configured feature audiences or owner rows from replay.
    reference=root/'supabase/migrations/20260908234527_reference_baseline.sql'
    allowed={'AddressCalendarRule':74,'CountyRadonZone':3128,'HudFmr':3223,'PostCategoryTTL':18,'FeatureFlag':1}
    reference_text=reference.read_text();installed_refs=[]
    for table,count in allowed.items():
        current=int(sql('SELECT count(*) FROM public."'+table+'";'))
        assert current in (0,count),'Unexpected candidate reference inventory'
        if current==0:
            lines=re.findall(r'^INSERT INTO public\."'+re.escape(table)+r'" [\s\S]*?;(?=\s*(?:\n|$))',reference_text,re.M)
            assert len(lines)==count
            sql('BEGIN;'+'\n'.join(lines)+'COMMIT;');installed_refs.append(table)
    save('static-reference-binding.json',{'source':str(reference.relative_to(root)),'sha256':hashlib.sha256(reference.read_bytes()).hexdigest(),'installed_from_source':installed_refs,'counts':allowed,'retained_rows_copied':False})
    config=json.loads(checked(['/opt/homebrew/bin/supabase','status','--workdir','/private/tmp/pantopus-home-gig-replay','-o','json']))
    assert config['API_URL']=='http://127.0.0.1:64521'
    original=json.loads(checked(['docker','inspect','supabase_rest_pantopus-home-gig-replay']))[0]
    env={k:v for k,v in (s.split('=',1) for s in original['Config']['Env']) if k.startswith('PGRST_')}
    uri=urllib.parse.urlsplit(env['PGRST_DB_URI']);assert uri.path=='/postgres';assert uri.hostname==container
    env['PGRST_DB_URI']=urllib.parse.urlunsplit(uri._replace(path='/'+database))
    env['PGRST_SERVER_HOST']='0.0.0.0';env['PGRST_SERVER_PORT']='3000'
    envfile=output/'postgrest.env';envfile.write_text('\n'.join(k+'='+v for k,v in env.items())+'\n');envfile.chmod(0o600)
    names=checked(['docker','ps','-a','--format','{{.Names}}']).splitlines()
    if rest_name not in names:
        networks=list(original['NetworkSettings']['Networks']);assert networks==['supabase_network_pantopus-home-gig-replay']
        checked(['docker','create','--name',rest_name,'--label','pantopus.acceptance=r03','--network',networks[0],'-p','127.0.0.1:'+str(port)+':3000','--env-file',str(envfile),original['Image']])
    else:
        owned=json.loads(checked(['docker','inspect',rest_name]))[0]
        assert owned['Config']['Labels'].get('pantopus.acceptance')=='r03'
    checked(['docker','start',rest_name])
    save('runtime.json',{'database':database,'database_container':container,'postgrest_container':rest_name,'api_url':'http://127.0.0.1:'+str(port),
      'service_role_key':config['SERVICE_ROLE_KEY'],'migration_sha256':digest,'source_root':str(root),'scope':'Dedicated schema-only synthetic candidate; original populated DB is unchanged'})
finally:
    after=preservation();catalog_after=catalogs();save('preservation-after.json',after);save('catalog-after.json',catalog_after)
    assert before==after and catalog_before==catalog_after,'Retained database changed; preserve all evidence'
    save('retained-cleanup.json',{'complete_populated_rows_functions_relations_preserved':True,'complete_attributes_defaults_constraints_triggers_preserved':True,'preserved_tables':len(before['rows']),'candidate_database_retained':database,'postgrest_runtime_retained':rest_name})
print('PASS owned R03 candidate schema/reference runtime prepared; retained database and full column/constraint/trigger catalogs unchanged')
