import json, sys, time, urllib.request, urllib.parse, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fieldscore import score, level
out = sys.argv[1]
queries = ["assessor", "property characteristics", "residential characteristics", "cama", "parcels", "parcel", "real property",
           "tax roll", "assessment roll", "property assessment", "bedrooms", "year built", "appraisal", "property tax", "dwelling",
           "building characteristics", "real estate", "secured roll", "parcel data", "appraisal roll", "property data", "sales", "residential", "condominium"]
seen = {}
def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Pantopus research (county data inventory)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)
for q in queries:
    offset = 0
    while offset < 2000:
        url = "https://api.us.socrata.com/api/catalog/v1?" + urllib.parse.urlencode({"q": q, "only": "dataset", "limit": 100, "offset": offset})
        try:
            d = get(url)
        except Exception as e:
            print("ERR", q, offset, e, file=sys.stderr); break
        res = d.get("results", [])
        for x in res:
            r = x.get("resource", {}); m = x.get("metadata", {})
            key = (m.get("domain"), r.get("id"))
            if key in seen:
                continue
            cols = (r.get("columns_name") or []) + (r.get("columns_field_name") or [])
            h = score(cols)
            seen[key] = {"domain": m.get("domain"), "id": r.get("id"), "name": r.get("name"), "updated": r.get("data_updated_at") or r.get("updatedAt"),
                         "level": level(h), "hits": h, "ncols": len(r.get("columns_name") or []), "link": x.get("permalink") or x.get("link"), "cols": (r.get("columns_name") or [])[:400], "attribution": r.get("attribution")}
        if len(res) < 100:
            break
        offset += 100
        time.sleep(0.2)
    print(q, "->", len(seen), file=sys.stderr)
json.dump(list(seen.values()), open(out, "w"), indent=1)
from collections import Counter
c = Counter(v["level"] for v in seen.values())
print("datasets:", len(seen), dict(c))
