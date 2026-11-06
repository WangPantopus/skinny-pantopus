import csv, json, sys, os, re
from urllib.parse import urlparse
base = sys.argv[1]
rows = list(csv.DictReader(open(os.path.join(base, "sample/sample.csv"))))
items = json.load(open(os.path.join(base, "sample/arcgis_items.json")))
svc = json.load(open(os.path.join(base, "scan/arcgis_services.json")))
ST = {"Alabama": ["alabama"], "Alaska": ["alaska"], "Arkansas": ["arkansas", "arcgis.arkansas"], "California": ["california"], "Colorado": ["colorado"], "Delaware": ["delaware", "firstmap"],
 "Florida": ["florida", "fdot", "fgdl"], "Georgia": ["georgia"], "Idaho": ["idaho"], "Illinois": ["illinois"], "Indiana": ["indiana", "in.gov"], "Iowa": ["iowa"], "Kansas": ["kansas"],
 "Kentucky": ["kentucky", "kygeo"], "Louisiana": ["louisiana"], "Maine": ["maine"], "Maryland": ["maryland", "mdgeodata", "md.gov"], "Massachusetts": ["massgis", "massachusetts"], "Michigan": ["michigan"],
 "Minnesota": ["minnesota", "mngeo", "state.mn"], "Mississippi": ["mississippi", "maris"], "Missouri": ["missouri"], "Montana": ["montana", "mt.gov", "msl"], "Nevada": ["nevada"], "New Hampshire": ["newhampshire", "nhgranit"],
 "New Jersey": ["newjersey", "njogis", "maps.nj.gov", "mod-iv"], "New Mexico": ["newmexico", "rgis"], "New York": ["nys", "newyork", "its.ny.gov"], "North Carolina": ["northcarolina", "nconemap", "ncdot"],
 "North Dakota": ["northdakota", "ndgishub", "nd.gov"], "Ohio": ["ohio"], "Oklahoma": ["oklahoma"], "Oregon": ["oregon", "ormap"], "Pennsylvania": ["pennsylvania", "pasda"], "Rhode Island": ["rhodeisland", "rigis"],
 "South Carolina": ["southcarolina", "scdot"], "Tennessee": ["tennessee", "tn.gov"], "Texas": ["texas", "txgio", "stratmap"], "Utah": ["utah", "ugrc", "agrc"], "Virginia": ["virginia", "vgin"], "Washington": ["washington", "wageoservices"],
 "West Virginia": ["westvirginia", "wvgis", "mapwv"], "Wisconsin": ["wisconsin", "sco.wisc", "v11", "statewide parcel"]}
def root(u):
    m = re.match(r"(https?://.+?/(?:FeatureServer|MapServer))", u, re.I); return m.group(1) if m else None
rank = {"FULL": 3, "CORE": 2, "PARCEL": 1, "NONE": 0, "ERR": -1}
for r in rows:
    cname = re.sub(r"\b(county|parish|borough|city|census area|municipality)\b", "", r["name"], flags=re.I).strip()
    tok = re.sub(r"[^a-z]", "", cname.lower())
    stoks = ST.get(r["state"], [])
    seen = {}
    for it in items.get(r["fips"], []):
        s = root(it["url"])
        if not s or s in seen: continue
        info = svc.get(s, {})
        blob = " ".join([it.get("owner") or "", urlparse(it["url"]).netloc, it.get("title") or ""]).lower()
        flat = re.sub(r"[^a-z]", "", blob)
        tag = "CNTY" if tok and tok in flat else ("STATE" if any(t.replace(" ", "") in flat or t in blob for t in stoks) else "")
        seen[s] = (info.get("level", "?"), tag, it, info)
    good = sorted([v for v in seen.values() if v[1] and v[0] in ("FULL", "CORE")], key=lambda v: (-rank[v[0]], v[1] != "CNTY"))
    print("#%s %s, %s (%s)" % (r["rank"], r["name"], r["state"], r["pop"]))
    for lv, tag, it, info in good[:2]:
        print("   %s %-5s| %-40s| %-22s| %-26s| %s" % (lv, tag, (it["title"] or "")[:40], (it["owner"] or "")[:22], urlparse(it["url"]).netloc[:26],
              ",".join("%s:%s" % (k, v[0][:13]) for k, v in info.get("hits", {}).items() if k in ("year_built", "size", "beds", "baths", "sale_price"))))
