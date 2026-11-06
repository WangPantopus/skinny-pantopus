# socdomain.py DOMAIN [query]: list a Socrata domain's datasets with building-fact columns
import json, sys, os, urllib.request, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fieldscore import score, level
dom = sys.argv[1]; q = sys.argv[2] if len(sys.argv) > 2 else ""
p = {"domains": dom, "only": "dataset", "limit": 200}
if q: p["q"] = q
d = json.load(urllib.request.urlopen(urllib.request.Request("https://api.us.socrata.com/api/catalog/v1?" + urllib.parse.urlencode(p), headers={"User-Agent": "Pantopus research"}), timeout=60))
for x in d.get("results", []):
    r = x["resource"]; cols = (r.get("columns_name") or []) + (r.get("columns_field_name") or [])
    h = score(cols); lv = level(h)
    if lv in ("FULL", "CORE"):
        print("%-4s | %-50s | %s | %s | %s" % (lv, r.get("name", "")[:50], (r.get("data_updated_at") or "")[:10], x.get("permalink"), ",".join("%s:%s" % (k, v[0][:14]) for k, v in h.items() if k in ("year_built", "size", "beds", "baths", "sale_price"))))
print("datasets:", len(d.get("results", [])))
