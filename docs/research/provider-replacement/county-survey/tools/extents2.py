import csv, json, sys, urllib.request, urllib.parse, concurrent.futures as cf
rows = list(csv.DictReader(open(sys.argv[1])))
def ext(r):
    url = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query?" + urllib.parse.urlencode(
        {"where": "GEOID='%s'" % r["fips"], "returnExtentOnly": "true", "outSR": "4326", "f": "json"})
    with urllib.request.urlopen(url, timeout=60) as f:
        e = json.load(f).get("extent") or {}
    return r["fips"], [round(e.get(k), 5) if e.get(k) is not None else None for k in ("xmin", "ymin", "xmax", "ymax")]
with cf.ThreadPoolExecutor(8) as ex:
    out = dict(ex.map(ext, rows))
bad = [k for k, v in out.items() if None in v]
json.dump(out, open(sys.argv[2], "w"))
print("extents:", len(out), "missing:", bad)
