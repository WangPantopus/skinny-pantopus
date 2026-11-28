#!/usr/bin/env python3
"""Download only official SAM unit-site fields into a private work directory; no resident data requested."""
import argparse
import csv
import json
import os
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('destination', type=Path)
args = p.parse_args()
os.umask(0o077)
api = 'https://gisportal.boston.gov/arcgis/rest/services/SAM/Live_SAM_Address/MapServer/1/query'
fields = ['objectid','building_id','parcel_id','map_par_id','unit','street_number','full_street_name','zip_code','mailing_neighborhood','city']
def query(params):
    for attempt in range(4):
        try:
            with urlopen(api+'?'+urlencode(dict(params, f='json')),timeout=60) as r:
                data = json.load(r)
            if 'error' in data:
                raise ValueError('City service reported an error')
            return data
        except (OSError, ValueError):
            if attempt == 3:
                raise
            time.sleep(1 + attempt)

ids = sorted(query({'where':'unit IS NOT NULL', 'returnIdsOnly':'true'})['objectIds'])
def batch(subset):
    lower, upper = subset[0], subset[-1]
    result = query({'where':f'unit IS NOT NULL AND objectid >= {lower} AND objectid <= {upper}',
                    'outFields':','.join(fields),'returnGeometry':'false','orderByFields':'objectid ASC'})
    rows = [v['attributes'] for v in result['features']]
    if sorted(r['objectid'] for r in rows) != subset:
        raise ValueError('SAM changed mid-download or truncated a page; start a new snapshot')
    return rows

args.destination.parent.mkdir(parents=True, exist_ok=True)
partial = args.destination.with_suffix('.partial.csv')
with partial.open('w',newline='') as f, ThreadPoolExecutor(max_workers=5) as pool:
    writer = csv.DictWriter(f,fieldnames=fields)
    writer.writeheader()
    for page in pool.map(batch, (ids[i:i+1800] for i in range(0,len(ids),1800))):
        writer.writerows(page)
partial.replace(args.destination)
print('City SAM named unit rows:',len(ids))
