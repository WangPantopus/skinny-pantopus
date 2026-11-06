import csv, os, sys
# tables.py <data dir> <out dir>: write the top-150 and sample CSVs (county-survey-top150.csv, county-survey-sample.csv) and their markdown
# tables (tables-top150.md, tables-sample.md) from data/counties and data/sample. Paste the markdown into the survey file.
base, out = sys.argv[1], sys.argv[2]
TOP_CAT = {"A": "Free, with bedrooms/baths", "B": "Free, basics only", "C": "One city only", "P": "Paid or permission",
           "N": "Not found", "Q": "Free download, building fields not confirmed", "U": "Not checked"}
SAMPLE_CAT = {"A": "Free, with bedrooms/baths", "B": "Free, basics only", "Q": "Free download, building fields not confirmed",
              "C": "Partial (one city or sold homes only)", "P": "Paid or permission", "N": "Not found (lookup sites, resellers)"}
TOP_EV = {"V": "Checked in the data", "D": "Official page", "R": "Seen in a re-published copy",
          "K": "Known dataset, not checked today", "-": "-"}
SAMPLE_EV = {"V": "Checked in the data", "D": "Official page or search", "R": "Seen in a re-published copy"}
def classes(path):
    rows = {}
    for line in open(path).read().splitlines():
        if line.strip():
            rank, cat, ev, what, src = line.split("|")
            rows[rank] = (cat, ev, what, src)
    return rows
def write(rows, csv_name, md_name, rank_col, cat, ev, people):
    with open(os.path.join(out, csv_name), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow([rank_col, "county", "state", "fips", "population_2024", "category", "evidence", "what_is_there", "source"])
        for r, c in rows:
            w.writerow([r["rank"], r["name"], r["state"], r["fips"], r["pop"], cat[c[0]], ev[c[1]], c[2], c[3]])
    with open(os.path.join(out, md_name), "w") as f:
        f.write("| %s | County | State | People | Category | Evidence | What is there | Source |\n" % ("#" if rank_col == "rank" else "Size rank"))
        f.write("|---:|---|---|---:|---|---|---|---|\n")
        for r, c in rows:
            f.write("| %s | %s | %s | %s | %s | %s | %s | %s |\n" % (r["rank"], r["name"], r["state"], people(int(r["pop"])), cat[c[0]], ev[c[1]], c[2], c[3]))
top = list(csv.DictReader(open(os.path.join(base, "counties/top200.csv"))))[:150]
tc = classes(os.path.join(base, "counties/classes.txt"))
write([(r, tc[r["rank"]]) for r in top], "county-survey-top150.csv", "tables-top150.md", "rank", TOP_CAT, TOP_EV,
      lambda p: "%.2fM" % (p / 1e6))
sample = list(csv.DictReader(open(os.path.join(base, "sample/sample.csv"))))
sc = classes(os.path.join(base, "sample/classes.txt"))
write([(r, sc[r["rank"]]) for r in sample], "county-survey-sample.csv", "tables-sample.md", "size_rank",
      SAMPLE_CAT, SAMPLE_EV, lambda p: "{:,}".format(p))
print("wrote 2 CSVs and 2 markdown tables to", out)
