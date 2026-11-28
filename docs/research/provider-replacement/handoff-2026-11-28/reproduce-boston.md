# Reproduce the Boston counts

Run from the extracted packet. Use a newly created private scratch directory on a volume with several gigabytes available. Raw inputs and unit identifiers stay outside the packet and repository.

```sh
umask 077
export VX_BOSTON="$VX_PRIVATE/boston-audit"
mkdir -p "$VX_BOSTON"
python3 "$VX_PACKET/fetch-boston-inputs.py" --out "$VX_BOSTON" --include-permits --reader-env "$HOME/.config/pantopus/property-index.env" --registry-release 20261125-11250053 --property-release 20261118-11230541
python3 "$VX_PACKET/download-boston-sam.py" "$VX_BOSTON/sam-live.csv"
python3 "$VX_PACKET/select-boston-units.py" --assess "$VX_BOSTON/fy26.csv" --sam "$VX_BOSTON/sam-live.csv" --private-out "$VX_BOSTON/city-units.ndjson"
node "$VX_PACKET/count-boston-matches.cjs" "$VX_REPO" "$VX_BOSTON/city-units.ndjson" "$VX_BOSTON/reg-manifest.json.gz" "$VX_BOSTON/reg-data.bin"
python3 "$VX_PACKET/download-boston-assessing.py" "$VX_BOSTON" 2026 3
python3 "$VX_PACKET/download-boston-assessing.py" "$VX_BOSTON" 2027 1
python3 "$VX_PACKET/trace-boston-conversions.py" --quarter-dir "$VX_BOSTON" --roster "$VX_BOSTON/city-units.ndjson" --fy 2027 --quarter 1 --private-out "$VX_BOSTON/candidate-2027.ndjson"
node "$VX_PACKET/count-boston-matches.cjs" "$VX_REPO" "$VX_BOSTON/city-units.ndjson" "$VX_BOSTON/reg-manifest.json.gz" "$VX_BOSTON/reg-data.bin" "$VX_BOSTON/candidate-2027.ndjson" "$VX_BOSTON/site-verified.ndjson"
python3 "$VX_PACKET/screen-boston-permits.py" --permits "$VX_BOSTON/permits.csv" --roster "$VX_BOSTON/city-units.ndjson" --private-candidates "$VX_BOSTON/permit-leads.ndjson"
```

For the FY2026 control, run trace-boston-conversions.py again with year 2026, quarter 3 and a different private output file. For a current audit, omit both release overrides on fetch-boston-inputs.py. The government feeds and new district/property roll are independently versioned. Recompute the numbers and explain changes in source date or scope.

The City FY2026 CSV downloaded November 28 had SHA-256 d0b656f516162c56a92782a255c731b967bd551b3e26cf412e080fdf041791fa, identical to the independently cached November 23 file. The private-fetch utility retains only the necessary columns, so the projected file deliberately has a different hash. The City quarter tables use a vintage predicate, known object IDs and validated complete pages; SAM uses a checked ID set. If the publisher changes a table halfway through a read, the scripts stop for a clean snapshot.

The count program uses the checkout’s production address parser, all blocks of the actual registry release and guarded parent/child matches. A private output is not release-ready by itself. Compare each child against the independent stored ID file and run the actual property resolver with the new and prior subjects, municipality guard, sibling, wrong city/ZIP, suppressed/expired cases, saved copy and real app checks. Preserve per-field City/date attribution. No real street, parcel ID or floor plan belongs in the GitHub PR or transfer ZIP.

The permit screen is a broad discovery filter over text plus an independent parcel/site match. It cannot prove every possible wording occurs in its candidate set. It never promotes a permit to proof of a completed apartment or imports a permit’s structured area as unit living area.


## Independent production-reader and source controls

The independent-checks directory holds the stopped Boston builder’s additional audit code, adapted to the new machine’s local paths. The programs use the same private working directory for inputs and row-level outputs. Keep this directory outside the Git checkout. To reproduce the source-controls comparison, fetch-boston-inputs.py selects the City’s numeric annual interior fields in addition to identity columns. For readback at the current serving baseline, add --reader-snapshot to that fetch; if the serving release has moved, omit the two historical overrides and label the resulting comparison with its actual release.

After the commands above have written city-units.ndjson and candidate-2027.ndjson, from a checkout with its backend dependencies installed run the following.

```sh
python3 "$VX_PACKET/independent-checks/quarter-rows.py" "$VX_BOSTON"
node "$VX_PACKET/independent-checks/check-sites.cjs" "$VX_BOSTON" "$VX_REPO"
python3 "$VX_PACKET/independent-checks/check-protection.py" "$VX_BOSTON"
python3 "$VX_PACKET/independent-checks/sales-bulk.py" "$VX_BOSTON"
python3 "$VX_PACKET/independent-checks/deed-controls.py" "$VX_BOSTON"
python3 "$VX_PACKET/independent-checks/permit-controls.py" "$VX_BOSTON"
```

The sales control counts dated child-parcel sale references; it does not prove that a specific deed or an as-built floor plan contains the three interior facts. The suppression screens are internal checks only. The checkout used for an audit must match the production reader being tested. The new Mac must preserve the founder’s hold regardless of these aggregate checks.
