#!/usr/bin/env python3
"""Compare current private release manifests with their previous reports after a specified time."""
import argparse
import json
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path

try:
    from botocore.session import get_session
except ImportError:
    from awscli.botocore.session import get_session

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--since',required=True,help='Cutoff with timezone, e.g. 2026-11-23T06:29:00+00:00')
parser.add_argument('--reader-env',type=Path)
parser.add_argument('--out',required=True,type=Path)
args=parser.parse_args()
cutoff=datetime.fromisoformat(args.since.replace('Z','+00:00'))
if not cutoff.tzinfo:parser.error('The cutoff requires a timezone')
options={'region_name':'us-west-2'}
if args.reader_env:
    settings=dict(s.strip().split('=',1) for s in args.reader_env.read_text().splitlines() if s.startswith('PROPERTY_INDEX_AWS_') and '=' in s)
    for key,name in [('ACCESS_KEY_ID','aws_access_key_id'),('SECRET_ACCESS_KEY','aws_secret_access_key'),('SESSION_TOKEN','aws_session_token')]:
        if 'PROPERTY_INDEX_AWS_'+key in settings:options[name]=settings['PROPERTY_INDEX_AWS_'+key].strip('"').strip("'")
client=get_session().create_client('s3',**options)
bucket='pantopus-property-index'
def read(key):
    return json.loads(client.get_object(Bucket=bucket,Key=key)['Body'].read())

def measures(report):
    counts=Counter()
    for group in report['fill'].values():
        for field,n in group.get('facts',{}).items():counts['field/'+field]+=n
        for held,fields in group.get('held',{}).items():
            for field,n in fields.items():counts[held+'/'+field]+=n
    return counts

def with_delta(row):
    if row['previous']:
        base='index/releases/'+row['fips']+'/'
        current=read(base+row['release']+'/report.json')
        prior=read(base+row['previous']+'/report.json')
        new,old=measures(current),measures(prior)
        row['record_delta']=current['records']-prior['records']
        row['field_occurrence_deltas']={k:new[k]-old[k] for k in sorted(set(new)|set(old)) if new[k]!=old[k]}
    return row

def changed(prefix):
    keys=[record['Key'] for page in client.get_paginator('list_objects_v2').paginate(Bucket=bucket,Prefix='index/'+prefix+'states/')
          for record in page.get('Contents',[]) if record['Key'].endswith('.json')]
    rows=[]
    with ThreadPoolExecutor(8) as pool:
        for state in pool.map(read,keys):
            for entry in state['jurisdictions'].values():
                if datetime.fromisoformat(entry['imported_at'].replace('Z','+00:00'))>=cutoff:
                    rows.append({k:entry.get(k) for k in ['fips','state','name','source','records','release','previous','as_of','imported_at']})
    return sorted(rows,key=lambda r:r['imported_at'])
property_rows=changed('')
registry_rows=changed('registry/')
with ThreadPoolExecutor(8) as pool:property_rows=list(pool.map(with_delta,property_rows))
out={'since_utc':cutoff.isoformat(),'property':property_rows,'registry_releases':len(registry_rows),
     'registry_by_state':dict(sorted(Counter(r['state'] for r in registry_rows).items()))}
args.out.write_text(json.dumps(out,indent=2)+'\n')
print('Property releases',len(property_rows),'registry releases',len(registry_rows))
