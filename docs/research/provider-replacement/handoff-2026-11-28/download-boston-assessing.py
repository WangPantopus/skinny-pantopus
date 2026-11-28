#!/usr/bin/env python3
"""Download a dated allowlist of Boston Assessing bulk attributes. Selects no owner or contact fields."""
import argparse
import csv
import json
import os
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('private_directory',type=Path)
p.add_argument('year',type=int)
p.add_argument('quarter',type=int)
args=p.parse_args()
os.umask(0o077)
args.private_directory.mkdir(parents=True,exist_ok=True)
fields={6:'parcel_id,line_number,composite_land_use,bedrooms,full_bath,half_bath',
        9:'parcel_id,composite_land_use,bedrooms,full_bath,half_bath',
        13:'parcel_id,condo_main,street_number,street_number_suffix,street_name,apt_unit,city,location_zip_code,land_use,property_type,property_code_description,living_area',
        15:'master_parcel_id,parcel_id,street_number,street_number_suffix,street_name,apt_unit'}
base='https://gisportal.boston.gov/arcgis/rest/services/Assessing/properties_boston_gov/FeatureServer/'
def query(layer,params):
    url=base+str(layer)+'/query?'+urlencode(dict(params,f='json'))
    for i in range(5):
        try:
            with urlopen(url,timeout=60) as response:
                data=json.load(response)
            if 'error' in data:raise ValueError('City service returned an error')
            return data
        except (OSError,ValueError):
            if i==4: raise
            time.sleep(i+1)

for layer,colnames in fields.items():
    dst=args.private_directory/f'tyler-{args.year}-{args.quarter}-{layer}.csv'
    filt=f'fiscal_year = {args.year} AND quarter = {args.quarter}'
    ids=sorted(query(layer,{'where':filt,'returnIdsOnly':'true'})['objectIds'])
    def batch(batch_ids):
        pred=f'{filt} AND objectid >= {batch_ids[0]} AND objectid <= {batch_ids[-1]}'
        j=query(layer,{'where':pred,'outFields':'objectid,'+colnames,'returnGeometry':'false','orderByFields':'objectid ASC'})
        rows=[f['attributes'] for f in j['features']]
        if sorted(r['objectid'] for r in rows)!=batch_ids:
            raise ValueError('Changed or incomplete city vintage')
        return rows
    partial=dst.with_suffix('.partial')
    with partial.open('w',newline='') as out, ThreadPoolExecutor(5) as pool:
        writer=csv.DictWriter(out,fieldnames=['objectid',*colnames.split(',')]); writer.writeheader()
        for rows in pool.map(batch,(ids[i:i+1950] for i in range(0,len(ids),1950))):
            writer.writerows(rows)
    partial.replace(dst)
    print(layer,len(ids),flush=True)
