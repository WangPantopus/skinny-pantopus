# County property data survey (November 5, 2026)

Scripts and inputs behind [../county-property-data-2026-11-05.md](../county-property-data-2026-11-05.md).
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
- `tools/tables.py <data dir> <out dir>`: rebuild both survey CSVs and the two markdown tables from the classes files
  (copy the CSVs to `docs/research/`, paste the tables into the survey file).

Second pass (November 5, evening): the 23 unchecked counties, the unopened sample files and every re-published or
known-dataset row were checked at the county or state source; `classes.txt` rows carry the result and evidence. No
category U rows remain; category Q (free download, fields unconfirmed) now also appears in the top 150.
