# fields.py LAYER_URL [where...]: print a layer's fields and record counts for each where clause
import json, sys, urllib.request, urllib.parse
L = sys.argv[1]
def get(u):
    return json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Pantopus research"}), timeout=120))
d = get(L + "?f=json")
print("name:", d.get("name"), "| maxRecord:", d.get("maxRecordCount"), "| copyright:", (d.get("copyrightText") or "")[:120])
print("fields:", ", ".join(f["name"] for f in d.get("fields") or []))
for w in sys.argv[2:]:
    try:
        r = get(L + "/query?" + urllib.parse.urlencode({"where": w, "returnCountOnly": "true", "f": "json"}))
        print("count[%s] = %s" % (w, r.get("count", r)))
    except Exception as e:
        print("count[%s] ERR %s" % (w, e))
