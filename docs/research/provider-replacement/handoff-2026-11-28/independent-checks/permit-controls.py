import os
os.umask(0o077)
import json, csv, re, sys, collections
from pathlib import Path
p=Path(sys.argv[1])
d=Path(sys.argv[1]);rows=[json.loads(l) for l in (p/'private-candidate-evidence.ndjson').open() if json.loads(l)['joined']];parents={c['parent'] for c in rows};children={c['child'] for c in rows}
types={'STREET':'ST','ROAD':'RD','AVENUE':'AVE','AV':'AVE','PLACE':'PL','TERRACE':'TER','BOULEVARD':'BLVD','TURNPIKE':'TPKE','HIGHWAY':'HWY','PARKWAY':'PKWY','COURT':'CT','DRIVE':'DR','LANE':'LN','SQUARE':'SQ','CIRCLE':'CIR','WAY':'WAY'}
def norm(a):return ' '.join(types.get(w,w) for w in re.findall(r'[A-Z0-9]+',a.upper()))
sites={norm(c['number']+c['numberSuffix']+' '+c['street']) for c in rows}; matches=collections.Counter()
bed=re.compile(r'\b(?:bed(?:room)?s?|brs?)\b',re.I);bath=re.compile(r'\b(?:bath(?:room)?s?|lavatories|lavatory|toilets?)\b',re.I)
area=re.compile(r'\b(?:square\s*(?:feet|footage|foot)|sq\.?\s*(?:ft|foot|feet)|living\s+(?:area|space)|floor\s+area|sqft|s\.?f\.?)\b',re.I)
for row in csv.DictReader((d/'permits.csv').open(encoding='utf-8-sig')):
 pid=row['parcel_id'].strip().zfill(10);s=norm(re.split(r'\b(?:UNIT|APT|APARTMENT|SUITE)\b|#',row['address'],flags=re.I)[0])
 if pid not in parents and pid not in children and s not in sites:continue
 matches['permits_for_child_parent_or_exact_site']+=1
 if pid in children: matches['permits_with_child_pid']+=1
 t=row['description']+' '+row['comments']
 if bed.search(t) and bath.search(t):
  matches['mentions_bed_and_bath']+=1
  if area.search(t): matches['mentions_all_three']+=1
  try:
   if float(row['sq_feet'].replace(',','') or '0')>0: matches['mentions_bed_bath_positive_job_sqft']+=1
  except ValueError:pass
print(json.dumps(matches,indent=2))
