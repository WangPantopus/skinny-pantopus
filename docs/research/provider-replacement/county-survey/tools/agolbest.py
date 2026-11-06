import json, sys, os, re, urllib.request, urllib.parse, concurrent.futures as cf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fieldscore import score, level
UA = {"User-Agent": "Pantopus research"}
RK = {"NONE": 0, "PARCEL": 1, "CORE": 2, "FULL": 3, "ERR": -1}
def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        return json.loads(r.read().decode("utf-8", "replace"))
def svc(u):
    try:
        d = get(u + "/layers?f=json")
        best = ("NONE", {}, "")
        for l in (d.get("layers") or []) + (d.get("tables") or []):
            names = [f.get("name") for f in (l.get("fields") or [])] + [f.get("alias") for f in (l.get("fields") or [])]
            h = score(names); lv = level(h)
            if (RK[lv], len(h)) > (RK[best[0]], len(best[1])):
                best = (lv, h, l.get("name") or "")
        return best
    except Exception as e:
        return ("ERR", {}, str(e)[:30])
def one(q):
    label, query = q.split("=", 1)
    try:
        res = get("https://www.arcgis.com/sharing/rest/search?" + urllib.parse.urlencode({"q": query + ' AND (type:"Feature Service" OR type:"Map Service")', "num": 10, "f": "json"})).get("results", [])
    except Exception as e:
        return label, []
    out = []
    seen = set()
    for it in res:
        m = re.match(r"(https?://.+?/(?:FeatureServer|MapServer))", it.get("url") or "", re.I)
        if not m or m.group(1) in seen: continue
        seen.add(m.group(1))
        lv, h, lname = svc(m.group(1))
        out.append((RK.get(lv, -1), len(h), lv, it.get("title") or "", it.get("owner") or "", re.sub(r"https?://", "", m.group(1)).split("/")[0], h))
    out.sort(reverse=True)
    return label, out[:2]
qs = sys.argv[1:]
with cf.ThreadPoolExecutor(6) as ex:
    for label, out in ex.map(one, qs):
        print("#" + label)
        for _, _, lv, title, owner, host, h in out:
            if lv in ("FULL", "CORE"):
                print("   %-4s | %-38s | %-24s | %-26s | %s" % (lv, title[:38], owner[:24], host[:26], ",".join("%s:%s" % (k, v[0][:12]) for k, v in h.items() if k in ("year_built", "size", "beds", "baths", "sale_price"))))
