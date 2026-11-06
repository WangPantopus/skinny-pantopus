import json, sys, urllib.request, urllib.parse
layer, group, where_list = sys.argv[1], sys.argv[2], sys.argv[3:]
def q(where):
    url = layer + "/query?" + urllib.parse.urlencode({"where": where, "groupByFieldsForStatistics": group,
        "outStatistics": json.dumps([{"statisticType": "count", "onStatisticField": "OBJECTID", "outStatisticFieldName": "n"}]), "f": "json"})
    req = urllib.request.Request(url, headers={"User-Agent": "Pantopus research"})
    with urllib.request.urlopen(req, timeout=180) as r:
        d = json.load(r)
    if "error" in d:
        return {"__error__": str(d["error"])[:200]}
    return {str(f["attributes"].get(group) or f["attributes"].get(group.upper()) or f["attributes"].get(group.lower())): (f["attributes"].get("n") if f["attributes"].get("n") is not None else f["attributes"].get("N")) for f in d.get("features", [])}
res = [q(w) for w in where_list]
keys = sorted(set().union(*[r.keys() for r in res]), key=lambda k: -(res[0].get(k) or 0))
print("%-24s " % group + " ".join("%14s" % w[:14] for w in where_list))
for k in keys:
    print("%-24s " % k[:24] + " ".join("%14s" % r.get(k, 0) for r in res))
