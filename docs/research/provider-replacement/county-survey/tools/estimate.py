import csv, os, sys, math
from collections import Counter
base = sys.argv[1]
US = 340110988
top = list(csv.DictReader(open(os.path.join(base, "counties/top200.csv"))))[:150]
tcls = {l.split("|")[0]: l.split("|")[1] for l in open(os.path.join(base, "counties/classes.txt"))}
sc = {l.split("|")[0]: l.split("|")[1] for l in open(os.path.join(base, "sample/classes.txt"))}
sample = list(csv.DictReader(open(os.path.join(base, "sample/sample.csv"))))
assert len(sc) == 100 and all(r["rank"] in sc for r in sample)
TOP = sum(int(r["pop"]) for r in top); REST = US - TOP
tp = Counter()
for r in top: tp[tcls[r["rank"]]] += int(r["pop"])
sp = Counter(sc[r["rank"]] for r in sample)
n = 100
def wilson(k, n, z=1.96):
    p = k / n; d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d; h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return c - h, c + h
print("REST of US: %.1fM people; sample draws by category: %s" % (REST / 1e6, dict(sp)))
groups = [("A", "Free with bedrooms/baths"), ("B", "Free basics"), ("Q", "Free download, building fields unconfirmed"), ("C", "Partial (one city / sold homes only)"), ("P", "Paid or permission"), ("N", "Not found (lookup sites, vendors)"), ("U", "Not checked")]
for g, label in groups:
    k = sp[g]; lo, hi = wilson(k, n)
    print("  %-44s %3d draws  %5.1f%%  (95%% CI %4.1f-%4.1f%%)" % (label, k, k, 100 * lo, 100 * hi))
k = sp["A"] + sp["B"]; lo, hi = wilson(k, n)
print("  A+B free building facts: %d%% (95%% CI %.0f-%.0f%%)" % (k, 100 * lo, 100 * hi))
print()
print("NATIONAL (top 150 measured + rest estimated):")
for g, label in groups:
    people = tp[g] + REST * sp[g] / n
    print("  %-44s %6.1fM  %5.1f%% of US" % (label, people / 1e6, 100 * people / US))
ab = tp["A"] + tp["B"] + REST * (sp["A"] + sp["B"]) / n
a = tp["A"] + REST * sp["A"] / n
print("  -> free with bedrooms/baths: %.1f%% of US; free building facts of any kind (A+B): %.1f%%" % (100 * a / US, 100 * ab / US))
# Rough national CI for A+B: top-150 part fixed (measured), rest part from Wilson interval.
lo, hi = wilson(sp["A"] + sp["B"], n)
print("     A+B national range from sampling: %.1f%% - %.1f%%" % (100 * (tp["A"] + tp["B"] + REST * lo) / US, 100 * (tp["A"] + tp["B"] + REST * hi) / US))
lo, hi = wilson(sp["A"], n)
print("     A national range from sampling: %.1f%% - %.1f%%" % (100 * (tp["A"] + REST * lo) / US, 100 * (tp["A"] + REST * hi) / US))
# Size bands in the sample
band = lambda r: "151-400" if int(r["rank"]) <= 400 else ("401-1000" if int(r["rank"]) <= 1000 else "1001+")
for b in ("151-400", "401-1000", "1001+"):
    rs = [r for r in sample if band(r) == b]
    c = Counter(sc[r["rank"]] for r in rs)
    print("  band %-8s %2d draws: %s" % (b, len(rs), dict(c)))
