#!/usr/bin/env python3
"""Join quarterly Boston parcel and condo tables to the old two-/three-family roster using city IDs."""
import argparse
import csv
import json
import os
from collections import Counter, defaultdict
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--quarter-dir',type=Path,required=True)
p.add_argument('--roster',type=Path,required=True)
p.add_argument('--fy',type=int,required=True)
p.add_argument('--quarter',type=int,required=True)
p.add_argument('--private-out',type=Path,required=True)
args=p.parse_args()
os.umask(0o077)
parents=defaultdict(set)
for line in args.roster.open():
    r=json.loads(line);parents[r['pid']].add(r['unit'])
def rows(n):
    with (args.quarter_dir/f'tyler-{args.fy}-{args.quarter}-{n}.csv').open(newline='') as f:
        yield from csv.DictReader(f)
def pid(s):
    return s.strip().zfill(10) if s.strip().isdigit() else ''
def number(s):
    try:return float(s.strip().replace(',',''))
    except (TypeError,ValueError):return None
attr=defaultdict(list)
for r in rows(9):
    attr[pid(r['parcel_id'])].append(r)
maps=defaultdict(set)
for r in rows(15):
    m=pid(r['master_parcel_id']); c=pid(r['parcel_id'])
    if m in parents and c!=m:
        maps[c].add((m,r['apt_unit'].strip().upper()))
all_export=list(rows(13))
parent_types={pid(r['parcel_id']):r['land_use'].strip() for r in all_export if pid(r['parcel_id']) in parents}
n=Counter()
n['roster_parents']=len(parents)
n['parent_now_condo_main']=sum(t=='CM' for t in parent_types.values())
n['residential_parent_rows_with_named_unit']=sum(bool(r['apt_unit'].strip()) for r in all_export if pid(r['parcel_id']) in parents)
n['child_parcels_linked_from_master_table']=len(maps)
with args.private_out.open('w') as f:
    for r in all_export:
        c=pid(r['parcel_id']);m=pid(r['condo_main']);unit=r['apt_unit'].strip().upper()
        if m not in parents or c==m or not unit:continue
        if ((m,unit) not in maps[c]) or len(maps[c])!=1:continue
        n['two_tables_agree_on_child_and_unit']+=1
        if parent_types[m]!='CM': continue
        n['named_child_of_condo_main']+=1
        if unit not in parents[m] or r['land_use'].strip()!='CD' or r['property_code_description'].strip().upper()!='RESIDENTIAL CONDO':continue
        n['in_original_roster_with_residential_condo_class']+=1
        if len(attr[c])!=1:continue
        b=attr[c][0]
        bed,full,half,area=map(number,[b['bedrooms'],b['full_bath'],b['half_bath'],r['living_area']])
        if None in (bed,full,half,area) or bed<0 or full<0 or half<0 or full+half/2<=0 or area<=0:continue
        n['complete_three_before_site_checks']+=1
        print(json.dumps({'parent':m,'child':c,'unit':unit,'number':r['street_number'],'numberSuffix':r['street_number_suffix'],
                         'street':r['street_name'],'city':r['city'],'zip':r['location_zip_code'],
                         'beds':bed,'full':full,'half':half,'living':area}),file=f)
print(json.dumps(dict(n),indent=2))
