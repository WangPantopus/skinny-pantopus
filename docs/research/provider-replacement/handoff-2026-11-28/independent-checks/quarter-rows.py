import os
os.umask(0o077)
import json,csv,sys,collections
from pathlib import Path
d=Path(sys.argv[1]); p=d; cands=[json.loads(l) for l in (p/'candidate-2027.ndjson').open()]
rows=lambda name:csv.DictReader((d/name).open(encoding='utf-8-sig'))
ids={x['child'] for x in cands}; mains={x['parent'] for x in cands}; all_ids=ids|mains
pid=lambda s:s.strip().zfill(10) if s.strip().isdigit() else ''
def numeric(s):
 try:return float(s.replace(',',''))
 except (ValueError,TypeError):return None
counts=collections.Counter();groups=collections.defaultdict(list)
for r in rows('tyler-2027-1-15.csv'):
 if pid(r['parcel_id']) in ids:groups[pid(r['parcel_id'])].append(r)
all_annual=list(rows('fy26.csv')); annual_children={pid(r['PID']) for r in all_annual}
counts['prior_annual_any_candidate_id']=len(ids&annual_children)
counts['q1_candidate_parent_crosswalk_unique']=sum(len(groups[i])==1 for i in ids)
a={pid(r['PID']):r for r in all_annual if r['LU']=='CD' and r['LU_DESC']=='RESIDENTIAL CONDO'}
for n,pairs in [(9,[('bedrooms','BED_RMS'),('full_bath','FULL_BTH'),('half_bath','HLF_BTH')]),(13,[('living_area','LIVING_AREA')])]:
 for r in rows('tyler-2026-3-'+str(n)+'.csv'):
  annual=a.get(pid(r['parcel_id']))
  if not annual:continue
  for new,old in pairs:
   x,y=numeric(r[new]),numeric(annual[old]); counts['annual_'+new+'_pairs']+=1
   counts['annual_'+new+('_same_numeric' if x==y and x is not None else '_both_blank' if x==y else '_missing_one' if x is None or y is None else '_disagree')]+=1
for n in (6,9,13):
 full=list(rows('tyler-2027-1-'+str(n)+'.csv')); target=[r for r in full if pid(r['parcel_id']) in ids]
 counts['q1_candidate_rows_'+str(n)]=len(target)
 if n==9:counts['q1_condo_attr_residential_class']=sum(r['composite_land_use'].strip()=='102 - RESIDENTIAL CONDO' for r in target)
 if n==13:
  with (p/'export-sites.ndjson').open('w') as out:
   for r in full:
    if not r['apt_unit'].strip():continue
    print(json.dumps({k:r[k] for k in ['parcel_id','condo_main','street_number','street_number_suffix','street_name','apt_unit','city','location_zip_code','land_use']}),file=out)
with (p/'child-map.json').open('w') as out:json.dump(groups,out)
print(json.dumps(counts,indent=1))
