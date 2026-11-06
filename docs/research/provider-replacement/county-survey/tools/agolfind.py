import json, sys, os, re, urllib.request, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fieldscore import score, level
UA = {"User-Agent": "Pantopus research"}
def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
        return json.loads(r.read().decode("utf-8", "replace"))
for q in sys.argv[1:]:
    url = "https://www.arcgis.com/sharing/rest/search?" + urllib.parse.urlencode({"q": q + ' AND (type:"Feature Service" OR type:"Map Service")', "num": 8, "f": "json"})
    try:
        res = get(url).get("results", [])
    except Exception as e:
        print("##", q, "ERR", e); continue
    print("##", q, "->", len(res))
    seen = set()
    for it in res:
        u = it.get("url") or ""
        m = re.match(r"(https?://.+?/(?:FeatureServer|MapServer))", u, re.I)
        if not m or m.group(1) in seen: continue
        seen.add(m.group(1))
        try:
            d = get(m.group(1) + "/layers?f=json")
            best = ("NONE", {}, "")
            for l in (d.get("layers") or []) + (d.get("tables") or []):
                names = [f.get("name") for f in (l.get("fields") or [])] + [f.get("alias") for f in (l.get("fields") or [])]
                h = score(names); lv = level(h)
                if ["NONE", "PARCEL", "CORE", "FULL"].index(lv) > ["NONE", "PARCEL", "CORE", "FULL"].index(best[0]):
                    best = (lv, h, l.get("name"))
        except Exception as e:
            best = ("ERR", {}, str(e)[:40])
        print("   %-5s | %-40s | %-22s | %s | %s" % (best[0], (it.get("title") or "")[:40], (it.get("owner") or "")[:22], (best[2] or "")[:24],
              ",".join("%s:%s" % (k, v[0][:14]) for k, v in best[1].items() if k in ("year_built", "size", "beds", "baths", "sale_price"))))
