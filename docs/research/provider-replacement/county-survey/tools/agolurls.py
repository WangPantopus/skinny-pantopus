# agolurls.py "query" [num]: ArcGIS Online search printing title, owner, type and service URL
import json, sys, urllib.request, urllib.parse
q = sys.argv[1]; n = int(sys.argv[2]) if len(sys.argv) > 2 else 10
u = "https://www.arcgis.com/sharing/rest/search?" + urllib.parse.urlencode({"q": q, "num": n, "f": "json"})
d = json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Pantopus research"}), timeout=40))
for it in d.get("results", []):
    print("%-45s | %-24s | %-16s | %s" % ((it.get("title") or "")[:45], (it.get("owner") or "")[:24], (it.get("type") or "")[:16], it.get("url") or ""))
