#!/usr/bin/env python3
"""Fetch private audit inputs. Only needed government columns are retained on disk."""
import argparse
import csv
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen
from time import sleep

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--out',type=Path,required=True)
p.add_argument('--reader-env',type=Path)
p.add_argument('--include-permits',action='store_true')
p.add_argument('--reader-snapshot', action='store_true', help='Also fetch the current local-only routing, suppression and Suffolk property-control objects')
p.add_argument('--registry-release',help='Use a pinned Suffolk registry release; default is the current state manifest')
p.add_argument('--property-release',help='Use a pinned Suffolk property ID index; default is the current state manifest')
args=p.parse_args()
os.umask(0o077)
args.out.mkdir(parents=True,exist_ok=True)
def official(rid,fields,dst):
    api='https://data.boston.gov/api/3/action/resource_show?id='+rid
    with urlopen(api,timeout=50) as page:resource=json.load(page)['result']
    endpoint='https://data.boston.gov/api/3/action/datastore_search'
    target=args.out/dst
    partial=target.with_suffix('.partial')
    offset=0
    last=0
    expected=None
    with partial.open('w',newline='') as fp:
        writer=csv.DictWriter(fp,fieldnames=fields);writer.writeheader()
        while expected is None or offset < expected:
            params={'resource_id':rid,'fields':','.join(['_id',*fields]),'limit':5000,'offset':offset,'sort':'_id asc'}
            for retry in range(4):
                try:
                    with urlopen(endpoint+'?'+urlencode(params),timeout=90) as page:reply=json.load(page)
                    if not reply.get('success'):raise ValueError('City DataStore query failed')
                    result=reply['result']
                    break
                except (OSError, ValueError):
                    if retry==3:raise
                    sleep(retry+1)
            total=int(result['total'])
            if expected is None:expected=total
            if expected!=total:raise ValueError('City data changed during the read; restart with one edition')
            records=result['records']
            if not records and offset<total:raise ValueError('City DataStore returned an incomplete page')
            for row in records:
                current=int(row['_id'])
                if current<=last or not set(fields)<=set(row):raise ValueError('Changed schema or duplicate City row')
                writer.writerow({k:row[k] for k in fields})
                last=current
            offset+=len(records)
    if expected!=offset:raise ValueError('Incomplete City download')
    partial.replace(target)
    return {'resource_id':rid,'last_modified':resource.get('last_modified'),'url':resource['url']}

meta={'fy26':official('ee73430d-96c0-423e-ad21-c4cfb54c8961',['PID','LU','LU_DESC','UNIT_NUM','BED_RMS','FULL_BTH','HLF_BTH','LIVING_AREA'],'fy26.csv')}
if args.include_permits:
    meta['permits']=official('6ddcd912-32a0-43df-9908-63574f8c7e77',
        ['permitnumber','description','comments','status','worktype','issued_date','parcel_id','sq_feet','address','zip'],'permits.csv')
env=dict(os.environ,AWS_PAGER='',AWS_DEFAULT_REGION='us-west-2')
if args.reader_env:
    cfg=dict(line.strip().split('=',1) for line in args.reader_env.read_text().splitlines() if line.startswith('PROPERTY_INDEX_AWS_') and '=' in line)
    env.pop('AWS_PROFILE',None);env.pop('AWS_SESSION_TOKEN',None)
    for key in ('ACCESS_KEY_ID','SECRET_ACCESS_KEY','SESSION_TOKEN'):
        if 'PROPERTY_INDEX_AWS_'+key in cfg:env['AWS_'+key]=cfg['PROPERTY_INDEX_AWS_'+key].strip('"').strip("'")
def get(key,path):
    subprocess.run(['aws','s3api','get-object','--bucket','pantopus-property-index','--key','index/'+key,str(path)],
                   env=env,stdout=subprocess.DEVNULL,check=True)
for prefix,override,files in [('registry/',args.registry_release,{'manifest.json.gz':'reg-manifest.json.gz','data.bin':'reg-data.bin'}),
                              ('',args.property_release,{'ids.json.gz':'before-ids.json.gz'})]:
    with tempfile.TemporaryDirectory() as tmp:
        t=Path(tmp)/'state.json';get(prefix+'states/MA.json',t)
        state=json.loads(t.read_text())['jurisdictions']['25025'];rel=override or state['release']
    if not re.fullmatch(r'\d{8}-\d{8}',rel):raise ValueError('Unexpected release format')
    for key,name in files.items():
        path=args.out/name;partial=path.with_suffix('.partial');get(prefix+'releases/25025/'+rel+'/'+key,partial);partial.replace(path)
    meta['registry_release' if prefix else 'property_release']=rel
if args.reader_snapshot:
    snapshot=args.out/'snapshots'
    def capture(key):
        target=snapshot/key
        target.parent.mkdir(parents=True,exist_ok=True)
        temp=target.with_suffix('.partial')
        get(key,temp)
        temp.replace(target)
        return target
    for prefix,meta_key in [('', 'property_release'),('registry/', 'registry_release')]:
        state=json.loads(capture(prefix+'states/MA.json').read_text())
        release=state['jurisdictions']['25025']['release']
        if release!=meta[meta_key]:raise ValueError('The requested pinned release is not current. Use current releases for a runtime snapshot.')
        for name in ['manifest.json.gz','data.bin']:
            capture(prefix+'releases/25025/'+release+'/'+name)
    capture('switches/production.json')
    capture('suppressions.json')
(args.out/'audit-inputs.json').write_text(json.dumps(meta,indent=2)+'\n')
print('Wrote private inputs. Registry',meta['registry_release'],'property',meta['property_release'])
