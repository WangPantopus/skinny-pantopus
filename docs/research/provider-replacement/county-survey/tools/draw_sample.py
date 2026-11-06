import csv, random, sys, json
recs = []
with open(sys.argv[1], encoding="latin-1") as f:
    for d in csv.DictReader(f):
        if d["SUMLEV"] != "050":
            continue
        recs.append({"fips": d["STATE"] + d["COUNTY"], "name": d["CTYNAME"], "state": d["STNAME"], "pop": int(d["POPESTIMATE2024"])})
recs.sort(key=lambda x: -x["pop"])
for i, r in enumerate(recs, 1):
    r["rank"] = i
rest = [r for r in recs if r["rank"] > 150]
US = sum(r["pop"] for r in recs); R = sum(r["pop"] for r in rest)
# Implicit stratification: order by state, then size, then systematic PPS.
rest.sort(key=lambda r: (r["fips"][:2], -r["pop"]))
n = int(sys.argv[3]); seed = int(sys.argv[4])
rng = random.Random(seed)
step = R / n; start = rng.uniform(0, step)
targets = [start + i * step for i in range(n)]
picked, cum, t = [], 0, 0
for r in rest:
    lo, cum = cum, cum + r["pop"]
    while t < n and targets[t] < cum:
        if not picked or picked[-1]["fips"] != r["fips"]:
            picked.append(dict(r, hits=1))
        else:
            picked[-1]["hits"] += 1
        t += 1
with open(sys.argv[2], "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["rank", "fips", "name", "state", "pop", "hits"])
    w.writeheader(); w.writerows(picked)
print("rest of US: %d counties, %.1fM people (%.1f%% of US); step %.0f people; seed %d" % (len(rest), R / 1e6, 100 * R / US, step, seed))
print("sampled counties:", len(picked), "draws:", sum(p["hits"] for p in picked))
from collections import Counter
sizes = Counter("151-400" if p["rank"] <= 400 else "401-1000" if p["rank"] <= 1000 else "1001+" for p in picked)
print("by size rank:", dict(sizes))
print("states:", len(set(p["state"] for p in picked)))
for p in picked:
    print("%4d %-34s %-15s %7d%s" % (p["rank"], p["name"][:34], p["state"][:15], p["pop"], " x%d" % p["hits"] if p["hits"] > 1 else ""))
