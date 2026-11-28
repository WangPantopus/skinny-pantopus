#!/usr/bin/env python3
"""Privately select unambiguous Boston two- and three-family unit rosters for the registry audit."""
import argparse
import csv
import json
import os
from collections import Counter, defaultdict
from pathlib import Path

args = argparse.ArgumentParser(description=__doc__)
args.add_argument('--assess', required=True, type=Path)
args.add_argument('--sam', required=True, type=Path)
args.add_argument('--private-out', required=True, type=Path)
cfg = args.parse_args()
os.umask(0o077)
roles = {'TWO-FAM DWELLING':2,'THREE-FAM DWELLING':3}
types = {}
counts = Counter()
with cfg.assess.open(encoding='utf-8-sig', newline='') as fp:
    for row in csv.DictReader(fp):
        if row['LU'] not in ('R2','R3'):
            continue
        counts['R2/R3 assessment rows'] += 1
        counts['R2/R3 rows with a unit number'] += bool(row['UNIT_NUM'].strip())
        if row['LU_DESC'] in roles:
            types[row['PID'].strip().zfill(10)] = roles[row['LU_DESC']]
rosters = defaultdict(list)
with cfg.sam.open(encoding='utf-8-sig', newline='') as fp:
    for raw in csv.DictReader(fp):
        row = {k.lower(): (v or '').strip().upper() for k,v in raw.items()}
        pid = row['parcel_id'].zfill(10)
        if pid not in types or row['map_par_id'].zfill(10) != pid or not row['unit']:
            continue
        rosters[pid].append(row)
cfg.private_out.parent.mkdir(parents=True,exist_ok=True)
with cfg.private_out.open('w') as out:
    for pid, group in sorted(rosters.items()):
        n = types[pid]
        units = {row['unit'] for row in group}
        if units not in ({str(i+1) for i in range(n)}, set('ABC'[:n])):
            continue
        buildings = {row['building_id'] for row in group}
        if '' in buildings or len(buildings)!=1:
            continue
        counts[f'{n}-family buildings'] += 1
        counts['official unit identities'] += n
        for row in group:
            if not (row['street_number'] and row['full_street_name'] and row['zip_code']):
                counts['incomplete city site rows'] += 1
                continue
            print(json.dumps({'pid':pid,'building':row['building_id'],'unit':row['unit'],
                  'street_number':row['street_number'],'street':row['full_street_name'],
                  'zip':row['zip_code'].zfill(5),'city':row.get('city') or 'BOSTON',
                  'neighborhood':row['mailing_neighborhood']}),file=out)
print(json.dumps(dict(counts),indent=2))
