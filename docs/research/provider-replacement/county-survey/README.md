# County survey kit (November 5, 2026)

Scripts and inputs behind [../county-survey.md](../county-survey.md); its CSVs are in [../evidence/](../evidence/).
Public data only; no keys. Run every script with `python3 -I`.

- `data/counties/top200.csv`: counties ranked by Census 2024 estimates (`tools/topcounties.py` on
  www2.census.gov `co-est2024-alldata.csv`; the Census API now needs a key).
- `data/counties/classes.txt`: the 150 largest counties, `rank|category|evidence|what is there|source`.
  Categories: A free with bedrooms/baths, B free basics, C one city only, P paid or permission, N not found,
  U not checked. Evidence: V checked in the data, D official page, R re-published copy, K known dataset.
- `data/sample/sample.csv` + `classes.txt`: 100 population-weighted draws from the other 2,994 counties
  (`tools/draw_sample.py <co-est2024 csv> <out> 100 20261105`); extra category Q = free download, fields unconfirmed.
- `data/*/extents.json`: county bounding boxes from Census TIGERweb (`tools/extents2.py`).
- `tools/socrata_scan.py`, `tools/arcgis_scan2.py`: catalog scans that read dataset column names and score them with
  `tools/fieldscore.py` (year built, size, beds, baths, sale price, value). They cache services in `scan/` (not kept).
- `tools/agolbest.py`, `tools/agolfind.py`: look up named ArcGIS layers and score their columns.
- `tools/stats.py`: grouped counts on an ArcGIS layer (fill rates by county).
- `tools/zipmember.py`, `tools/zipfind.py`: read one member of a remote ZIP with HTTP range requests (used on Clark
  County's PACS file) without downloading it.
- `tools/zipls.py <url>`: list a remote ZIP's members (offset, compressed and full size) from its central directory, to
  feed `zipmember.py`.
- `tools/restscan.py <https://host/.../rest/services> [name regex]`: walk one ArcGIS Server a folder deep and score every
  service's columns (second pass: county servers that ArcGIS Online search does not list).
- `tools/estimate.py <data dir>`: national estimate with 95% Wilson ranges.
- `tools/tables.py <data dir> <out dir>`: rebuild both survey CSVs (`county-survey-top150.csv`, `county-survey-sample.csv`)
  and the two markdown tables from the classes files (copy the CSVs to `../evidence/`, paste the tables into
  `../county-survey.md`).
- `tools/agolurls.py "<query>" [n]`: ArcGIS Online search printing each item's owner, type and service URL.
- `tools/fields.py <layer url> [where ...]`: a layer's columns and record counts per filter (fill rates).
- `tools/socdomain.py <socrata domain> [query]`: one Socrata portal's datasets that carry building-fact columns.
- `tools/fetch.sh <name> <url> [dir]` + `tools/pagetext.py <file> [link regex] [max chars]`: save a page outside the repo
  and print its visible text and matching links.
- `tools/pdftext.swift`: build with `swiftc -O -o pdftext pdftext.swift`; prints a PDF's text (data layouts, price
  lists) instead of reading page images.
- `tools/apply.py <classes.txt> <update files...>`: replace rank-keyed rows of a classes file (how the second pass was
  applied).

Second pass (November 5, evening): the 23 unchecked counties, the unopened sample files and every re-published or
known-dataset row were checked at the county or state source; `classes.txt` rows carry the result and evidence. No
category U rows remain; category Q (free download, fields unconfirmed) now also appears in the top 150.

Dallas correction (November 5, late): row 8 of `data/counties/classes.txt` moved to category A on PR #3433's
measured counts; `tools/estimate.py data` now gives 23.2% (21.1-26.7%) with bedrooms or baths and 55.7% (51.5-60.5%)
with free building facts.
