import os
os.umask(0o077)
import csv,json,os,sys,urllib.request,urllib.parse
from pathlib import Path
p=Path(sys.argv[1])
u='https://gisportal.boston.gov/arcgis/rest/services/Assessing/properties_boston_gov/FeatureServer/11/query'
wanted='objectid,parcel_id,latest_sales_date,latest_bkgpcert'
def get(**kv):
 req=urllib.request.Request(u+'?'+urllib.parse.urlencode(dict(f='json',**kv)))
 with urllib.request.urlopen(req,timeout=45) as resp:o=json.load(resp)
 if 'error'in o:raise ValueError('agency bulk query unavailable')
 return o
def main():
 ids=sorted(get(where='1=1',returnIdsOnly='true')['objectIds'])
 print('sales rows',len(ids),flush=True)
 tmp=p/'sales-bulk.partial'
 with tmp.open('w') as f:
  out=csv.DictWriter(f,fieldnames=wanted.split(','));out.writeheader()
  for i in range(0,len(ids),2000):
   block=ids[i:i+2000]
   o=get(where=f'objectid BETWEEN {block[0]} AND {block[-1]}',outFields=wanted,returnGeometry='false',orderByFields='objectid ASC')
   rows=[r['attributes'] for r in o['features']]
   if [r['objectid'] for r in rows]!=block:raise ValueError('bulk export changed')
   out.writerows(rows)
 tmp.replace(p/'sales-bulk.csv')
if __name__=='__main__':main()
