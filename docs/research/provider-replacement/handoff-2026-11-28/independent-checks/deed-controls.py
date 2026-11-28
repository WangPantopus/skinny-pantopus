import os
os.umask(0o077)
import json,csv,re,sys
from pathlib import Path
from collections import Counter,defaultdict
p=Path(sys.argv[1])
e=[json.loads(l) for l in (p/'private-candidate-evidence.ndjson').open() if json.loads(l)['joined']]
sales=defaultdict(list); refparcels=defaultdict(set)
for r in csv.DictReader((p/'sales-bulk.csv').open()):
 pid=r['parcel_id'].strip().zfill(10);ref=r['latest_bkgpcert'].strip().upper();date=r['latest_sales_date'].strip()
 sales[pid].append((date,ref))
 if ref:refparcels[ref].add(pid)
out=Counter()
for x in e:
 rows=sales[x['child']];out['candidates']+=1
 if not rows:out['missing_child_sale_row']+=1;continue
 out['matches_child_sale_row']+=1
 if len(rows)!=1:out['duplicate_child_sale_rows']+=1;continue
 date,ref=rows[0]
 out['date_'+(date[:4] if re.match(r'^\d{4}-',date) else 'other' if date else 'absent')]+=1
 if date and ref:out['date_and_reference']+=1
 if ref and len(refparcels[ref])==1:out['unique_reference_countywide']+=1
 if ref and (date,ref) in sales[x['parent']]:out['same_parent_reference_and_date']+=1
 if date and ref and len(refparcels[ref])==1 and (date,ref) not in sales[x['parent']]:
  out['distinct_referenced_child_sale']+=1
  if '2025-01-01'<=date<='2025-12-31':out['individual_sale_during_2025']+=1
print(json.dumps(out,indent=2))
