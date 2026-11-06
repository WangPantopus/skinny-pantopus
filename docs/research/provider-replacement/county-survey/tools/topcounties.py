import csv, sys
recs = []
with open(sys.argv[1], encoding="latin-1") as f:
    for d in csv.DictReader(f):
        if d["SUMLEV"] != "050":
            continue
        recs.append({"fips": d["STATE"] + d["COUNTY"], "name": d["CTYNAME"], "state": d["STNAME"], "pop": int(d["POPESTIMATE2024"])})
recs.sort(key=lambda x: -x["pop"])
tp = sum(r["pop"] for r in recs)
cp = 0
out = []
for i, r in enumerate(recs, 1):
    cp += r["pop"]
    r.update(rank=i, cum_share=round(cp / tp, 4))
    out.append(r)
with open(sys.argv[2], "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["rank", "fips", "name", "state", "pop", "cum_share"])
    w.writeheader(); w.writerows(out[:200])
print("counties:", len(recs), "US pop 2024:", tp)
for k in (25, 50, 100, 140, 150, 160, 200):
    r = out[k - 1]
    print("top %3d -> %.1f%% of people (last: %s, %s, %d)" % (k, 100 * r["cum_share"], r["name"], r["state"], r["pop"]))
half = next(r for r in out if r["cum_share"] >= 0.5)
print("half of the US population is reached at rank", half["rank"], half["name"], half["state"])
