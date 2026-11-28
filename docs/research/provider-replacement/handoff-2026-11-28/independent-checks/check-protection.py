import os
os.umask(0o077)
import json,sys,urllib.parse,urllib.request
from pathlib import Path
p=Path(sys.argv[1]);rows=[json.loads(s) for s in (p/'private-candidate-evidence.ndjson').open()]
ids={c['child'] for c in rows};parents={c['parent'] for c in rows}
base='https://gisportal.boston.gov/arcgis/rest/services/Assessing/properties_boston_gov/FeatureServer/'
out={}
for table,field in [(13,'owner'),(15,'owner_name')]:
 markers=['SUPPRESS','WITHHELD','REDACT','CONFIDENTIAL','PROTECTED','UNDISCLOSED','IMPOUND','NOT FOR PUBLIC','NOT AVAILABLE FOR PUBLIC']
 for test,where in [('marker',' OR '.join(f"UPPER({field}) LIKE '%{m}%'" for m in markers)),('blank',f"{field} IS NULL OR {field} = ''")]:
  where=f'fiscal_year=2027 AND quarter=1 AND ({where})'
  def get(**kw):
   data=json.load(urllib.request.urlopen(base+str(table)+'/query?'+urllib.parse.urlencode(dict(f='json',**kw)),timeout=65))
   if 'error' in data:raise RuntimeError('public bulk metadata error')
   return data
  n=get(where=where,returnCountOnly='true')['count'];seen=set()
  for offset in range(0,n,2000):
   j=get(where=where,outFields='parcel_id',returnGeometry='false',orderByFields='objectid ASC',resultOffset=offset,resultRecordCount=2000)
   seen.update(str(f['attributes']['parcel_id']).strip().zfill(10) for f in j['features'])
  out[str(table)+'_'+test]={'source_rows':n,'candidate_child_matches':len(seen & ids),'candidate_parent_matches':len(seen&parents)}
(p/'suppression-screen.json').write_text(json.dumps(out,indent=2))
print(out)
