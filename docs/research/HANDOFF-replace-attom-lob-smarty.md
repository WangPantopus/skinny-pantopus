# Handoff: replacing ATTOM, Lob and Smarty (November 5, 2026)

## State

- Branch `claude/replace-attom-lob-smarty-73fcb9`, based on master `1c5ddb658c`. Docs and research scripts only; no
  app code changed, nothing built, no migration, no hosted service touched.
- Records in `docs/research/`:
  - `replace-attom-lob-smarty-2026-11-05.md`: what the code uses each vendor for (file:line), the verdict on the two
    founder design documents, the combined nationwide design, phases, and open decisions.
  - `county-property-data-2026-11-05.md` + `.csv`: the 150 largest counties classified one by one, plus the national
    estimate from a 100-county population-weighted sample (`county-property-data-sample-2026-11-05.csv`).
  - `uncovered-counties-2026-11-05.csv`: the 44 top-150 counties (44.7M people) that are paid, not found, city-only or
    unchecked, with the next step for each.
  - `county-data-survey/`: scripts and inputs to re-run or extend the survey (see its README).
- Headline numbers: about 53% of Americans (range 49-58%) live where free bulk building facts exist; about 21%
  (19-24%) where they include bedrooms/baths; about 33% only lookup sites (resellers sell the files, ~$200-300 per
  county); about 5% paid or permission; 4.7% unchecked.

## Verified vs not

- Verified by reading code on master: every vendor call site and feature listed in the design record.
- Verified in live public data: Clark County WA files (taxlot layer, full PACS ZIP via range reads), NY State, Maryland,
  Minnesota and Idaho statewide fill counts, column lists for the services marked "Checked in the data".
- Not verified: most small-county classifications rest on official pages and search results; "re-published copy"
  counties need confirming at the county source; license terms for each free source; Google's billing SKU for CASS
  requests; prices for paid counties.

## Waiting on the founder

1. How to fill counties with no free data: households + labeled estimates (recommended now), price public-records
   requests for the largest uncovered counties, or buy reseller files / a national license.
2. Phase 1 go-ahead (Smarty unnecessary, backend only). The outage fallback (continue and prove by mail when Google
   is down) loosens a rule and needs an explicit yes.
3. Founder-only facts: Smarty account or agreement; ATTOM plan and license terms; Google SKU for CASS requests; private
   storage account for the national record; Lob live key and return address.

## Exact next steps for the successor

1. Read the three records above; confirm the branch and its draft PR; do not change app code without the founder's OK.
2. Ask the founder decisions 1 and 2 in one short message with a recommendation (founder rule: confirm before
   starting any work; designs count as work).
3. If "price records requests": for each row in `uncovered-counties-2026-11-05.csv`, find the assessor's records or
   data-sales page, the price, format, update frequency and commercial-use or redistribution terms; record them in a
   new column set; total the one-time and yearly cost.
4. If "households + estimates": write the plain-words plan (what users see on Add Home, Place and Property details on
   web, iOS and Android; what stays) for the founder's OK before any build.
5. Either way, finish the 23 unchecked top-150 counties and the 5 "fields unconfirmed" sample counties, then re-run
   `county-data-survey/tools/estimate.py` and update the survey file.
