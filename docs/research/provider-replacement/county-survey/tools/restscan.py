import json, sys, os, re, urllib.request, concurrent.futures as cf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fieldscore import score, level
# Walk one ArcGIS Server (https://host/arcgis/rest/services) a folder deep and score every service's layer columns.
# Prints services whose best layer has year built or size (CORE) or also bedrooms/baths (FULL).
UA = {"User-Agent": "Pantopus research"}
RK = {"NONE": 0, "PARCEL": 1, "CORE": 2, "FULL": 3}
def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
        return json.loads(r.read().decode("utf-8", "replace"))
root = sys.argv[1].rstrip("/")
pat = re.compile(sys.argv[2], re.I) if len(sys.argv) > 2 else None
d = get(root + "?f=json")
svcs = [s for s in d.get("services", [])]
for f in d.get("folders", []):
    try:
        svcs += get(root + "/" + f + "?f=json").get("services", [])
    except Exception as e:
        print("folder err", f, e)
svcs = [s for s in svcs if s.get("type") in ("MapServer", "FeatureServer") and (not pat or pat.search(s["name"]))]
print("services:", len(svcs))
def one(s):
    u = "%s/%s/%s" % (root, s["name"], s["type"])
    try:
        ls = get(u + "/layers?f=json")
    except Exception as e:
        return u, "ERR", {}, str(e)[:40]
    best = ("NONE", {}, "")
    for l in (ls.get("layers") or []) + (ls.get("tables") or []):
        names = [x.get("name") for x in (l.get("fields") or [])] + [x.get("alias") for x in (l.get("fields") or [])]
        h = score(names); lv = level(h)
        if (RK[lv], len(h)) > (RK[best[0]], len(best[1])):
            best = (lv, h, "%s:%s" % (l.get("id"), l.get("name")))
    return u, best[0], best[1], best[2]
with cf.ThreadPoolExecutor(8) as ex:
    for u, lv, h, lname in ex.map(one, svcs):
        if lv in ("FULL", "CORE"):
            print("%-4s | %s | %s | %s" % (lv, u, lname[:30], ",".join("%s:%s" % (k, v[0][:14]) for k, v in h.items() if k in ("year_built", "size", "beds", "baths", "sale_price"))))
