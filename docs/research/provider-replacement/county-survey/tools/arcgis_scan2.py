import csv, json, sys, os, re, time, threading, urllib.request, urllib.parse, concurrent.futures as cf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fieldscore import score, level
base = sys.argv[1]
rows = list(csv.DictReader(open(os.path.join(base, sys.argv[2]))))
extents = json.load(open(os.path.join(base, sys.argv[3])))
cache_path = os.path.join(base, "scan/arcgis_services.json")
cache = json.load(open(cache_path)) if os.path.exists(cache_path) else {}
lock = threading.Lock()
UA = {"User-Agent": "Pantopus research (county data inventory)"}
def get(url, timeout=40):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8", "replace"))
Q = '(parcel OR parcels OR taxlot OR taxlots OR "tax parcels" OR cama OR assessor OR "property data" OR "real property") AND (type:"Feature Service" OR type:"Map Service")'
def search(fips):
    x0, y0, x1, y1 = extents[fips]
    items = []
    for start in (1, 101):
        url = "https://www.arcgis.com/sharing/rest/search?" + urllib.parse.urlencode({"q": Q, "bbox": "%s,%s,%s,%s" % (x0, y0, x1, y1), "num": 100, "start": start, "f": "json"})
        try:
            d = get(url)
        except Exception as e:
            print("search err", fips, e, file=sys.stderr); break
        for it in d.get("results", []):
            ext = it.get("extent") or []
            try:
                w = abs(ext[1][0] - ext[0][0]); h = abs(ext[1][1] - ext[0][1])
            except Exception:
                w = h = 0
            if w > 25 or h > 25 or not it.get("url"):
                continue
            items.append({"id": it["id"], "title": it.get("title"), "owner": it.get("owner"), "orgId": it.get("orgId"), "url": it.get("url"), "w": round(w, 2)})
        if d.get("nextStart", -1) == -1:
            break
    return fips, items
def root(u):
    m = re.match(r"(https?://.+?/(?:FeatureServer|MapServer))", u, re.I)
    return m.group(1) if m else None
def inspect(svc):
    with lock:
        if svc in cache:
            return
    best = {"level": "ERR", "hits": {}, "layer": None, "nfields": 0}
    try:
        d = get(svc + "/layers?f=json")
        lays = (d.get("layers") or []) + (d.get("tables") or [])
        best = {"level": "NONE", "hits": {}, "layer": None, "nfields": 0}
        allf = {}
        for l in lays:
            allf["%s:%s" % (l.get("id"), l.get("name"))] = [f.get("name") for f in (l.get("fields") or [])][:400]
        rank = {"FULL": 3, "CORE": 2, "PARCEL": 1, "NONE": 0}
        for l in lays:
            names = [f.get("name") for f in (l.get("fields") or [])] + [f.get("alias") for f in (l.get("fields") or [])]
            h = score(names); lv = level(h)
            cand = {"level": lv, "hits": {k: v[:3] for k, v in h.items()}, "layer": "%s:%s" % (l.get("id"), l.get("name")), "nfields": len(l.get("fields") or []),
                    "fields": [f.get("name") for f in (l.get("fields") or [])][:400]}
            if (rank[lv], len(h)) > (rank[best["level"]], len(best["hits"])):
                best = cand
        best["all_layers"] = allf
        if "error" in d:
            best = {"level": "ERR", "hits": {}, "layer": str(d["error"].get("message"))[:80], "nfields": 0}
    except Exception as e:
        best = {"level": "ERR", "hits": {}, "layer": str(e)[:80], "nfields": 0}
    with lock:
        cache[svc] = best
t0 = time.time()
with cf.ThreadPoolExecutor(6) as ex:
    found = dict(ex.map(search, [r["fips"] for r in rows]))
json.dump(found, open(os.path.join(base, sys.argv[4]), "w"))
svcs = sorted({root(it["url"]) for its in found.values() for it in its if root(it["url"])})
print("items per county avg %.1f, unique services %d, search took %.0fs" % (sum(len(v) for v in found.values()) / len(found), len(svcs), time.time() - t0), flush=True)
todo = [s for s in svcs if s not in cache]
done = 0
with cf.ThreadPoolExecutor(14) as ex:
    for _ in ex.map(inspect, todo):
        done += 1
        if done % 200 == 0:
            with lock:
                json.dump(cache, open(cache_path, "w"))
            print("inspected", done, "/", len(todo), "%.0fs" % (time.time() - t0), flush=True)
json.dump(cache, open(cache_path, "w"))
from collections import Counter
print("done", Counter(v["level"] for v in cache.values()), "%.0fs" % (time.time() - t0))
