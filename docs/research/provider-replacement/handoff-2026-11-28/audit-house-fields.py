#!/usr/bin/env python3
"""Summarize same-release house field marginals and conservative joint bounds. No household rows are exported."""
import argparse
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
try:
    from botocore.session import get_session
except ImportError:
    from awscli.botocore.session import get_session

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--nationwide',type=Path,required=True)
p.add_argument('--reader-env',type=Path)
p.add_argument('--out',type=Path,required=True)
a=p.parse_args()
options={'region_name':'us-west-2'}
if a.reader_env:
    config=dict(line.strip().split('=',1) for line in a.reader_env.read_text().splitlines() if line.startswith('PROPERTY_INDEX_AWS_') and '=' in line)
    for key,param in [('ACCESS_KEY_ID','aws_access_key_id'),('SECRET_ACCESS_KEY','aws_secret_access_key'),('SESSION_TOKEN','aws_session_token')]:
        if 'PROPERTY_INDEX_AWS_'+key in config:options[param]=config['PROPERTY_INDEX_AWS_'+key].strip('"').strip("'")
s=get_session().create_client('s3',**options)
rows=[r for r in json.loads(a.nationwide.read_text())['counties'] if r['property_release']]
def process(r):
    key='index/releases/'+r['fips']+'/'+r['property_release']+'/report.json'
    j=json.loads(s.get_object(Bucket='pantopus-property-index',Key=key)['Body'].read())
    if int(j['records'])!=r['property_records']:raise ValueError('release disagrees with manifest '+r['fips'])
    fill=j['fill']; h=fill.get('property:house',{}); facts=h.get('facts',{})
    n=h.get('records',0)
    count=lambda keys:max((facts.get(k,0) for k in keys),default=0)
    f={'year':count(['year_built']),'living_sqft':count(['living_sqft']),'bedrooms':count(['bedrooms']),'bath_total':count(['bathrooms']),
       'lot_at_least':count(['lot_sqft','lot_acres']),'value_at_least':count(['market_value','assessed_value'])}
    maxlot=min(n,facts.get('lot_sqft',0)+facts.get('lot_acres',0))
    maxvalue=min(n,facts.get('market_value',0)+facts.get('assessed_value',0))
    upper=min(f['year'],f['living_sqft'],f['bedrooms'],f['bath_total'],maxlot,maxvalue)
    return {'fips':r['fips'],'state':r['state'],'name':r['name'],'scope':r['property_scope'],'release':r['property_release'],
            'house_rows':n,'counts':f,'direct_field_joint_lower_count':max(0,sum(f.values())-5*n),
            'direct_field_joint_upper_count':upper,'has_untyped_property_rows':bool(fill.get('property:-',{}).get('records')),
            'house_held_groups':sorted((h.get('held') or {}).keys())}
with ThreadPoolExecutor(10) as pool:out=list(pool.map(process,rows))
summ={}
for scope in ['countywide','municipal','stored-off']:
    group=[r for r in out if r['scope']==scope]
    summ[scope]={'typed_house_rows':sum(r['house_rows'] for r in group),
                 'counties_with_typed_house_rows':sum(bool(r['house_rows']) for r in group),
                 'field_totals':{k:sum(r['counts'][k] for r in group) for k in out[0]['counts']},
                 'unresolved_or_above_90_direct':sum(r['house_rows']>0 and 10*r['direct_field_joint_upper_count']>=9*r['house_rows'] for r in group)}
a.out.write_text(json.dumps({'method':'Stored report occurrence counts on explicit property:house rows. Joint bounds refer to these reported direct fields only. Marginals can include nonpositive values. Lot/value lower bounds use max of alternative columns. Held labels, mapped lots, confidential exclusions, untyped houses, source semantics and eligible houses missing from storage require independent checks before switching. Suffolk totals cover its entire stored county, while the municipal gate serves Boston only.','summary':summ,'counties':out},indent=2)+'\n')
print(json.dumps(summ))
