# Handoff: replacing ATTOM, Lob and Smarty (November 5, 2026)

## State

- Branch `claude/replace-attom-lob-smarty-73fcb9`, draft PR WangPantopus/skinny-pantopus#3418, based on master
  `1c5ddb658c`. Docs and research scripts only; no app code changed, nothing built, no migration, no hosted service
  touched.
- Records in `docs/research/`:
  - `replace-attom-lob-smarty-2026-11-05.md`: what the code uses each vendor for (file:line), the verdict on the two
    founder design documents, the combined nationwide design, phases, and open decisions.
  - `county-property-data-2026-11-05.md` + `.csv`: the 150 largest counties classified one by one (all 150 now), plus
    the national estimate from a 100-county population-weighted sample (`county-property-data-sample-2026-11-05.csv`),
    and a "Second pass" section listing what changed.
  - `uncovered-counties-2026-11-05.csv`: the 41 top-150 counties (41.9M people) without free building facts (19 not
    found, 15 paid or permission, 5 one city only, 2 free files not confirmed), with prices where found and the next step.
  - `county-data-survey/`: scripts and inputs to re-run or extend the survey (see its README; run Python with `-I`).
- Headline numbers after the second pass: about 56% of Americans (range 52-61%) live where free bulk building facts
  exist; about 22% (20-26%) where they include bedrooms or baths; about 36% only lookup sites (resellers sell the files,
  ~$200-300 per county); about 6.5% paid or permission; none unchecked.

## Verified vs not

- Verified by reading code on master: every vendor call site and feature listed in the design record. Master moved to
  `17a62f82ec` on Nov 5 with no address or property changes.
- Verified in live public data (column names and, for most, fill counts): 101 of the 150 counties, including every row
  that earlier rested on a re-published copy or a known dataset, plus statewide layers for New York, Maryland, Idaho,
  North Carolina and West Virginia.
- Verified from the publisher's own page or file layout only: 49 of the 150 (for example Montgomery OH's CAMA layout,
  Arapahoe's weekly export, Fresno's price list).
- Not verified: license terms for each free source; Spokane WA's files (behind Washington's commercial-use attestation,
  not opened); Cobb GA's FTP tabular file and Medina OH's CAMA file (certificate expired) unopened; Northampton PA and
  Madison VA rest on re-published copies; Google's billing SKU for CASS requests; prices for most paid counties.

## Waiting on the founder

Asked in chat on Nov 5 (~22:00 UTC), no answer yet:
1. How to fill counties with no free data: recommended households + labeled estimates as the nationwide floor, and
   (research only, no money) price public-records requests for the 20 largest uncovered counties; not reseller files
   or a national license.
2. Phase 1 go-ahead (Smarty unnecessary, backend only, no screen changes). Two rule changes need an explicit yes:
   (a) when Google is down, let the person finish Add Home with the home unverified, no postcard mailed and nothing
   unlocked until a background re-check passes; (b) when Google leaves the home-or-business flag blank, the business
   check uses place types and parcel type (as it does for Smarty's "unknown" today). Recommended yes to both.
3. Founder-only facts: Smarty account or agreement; ATTOM plan and license terms; Google billing SKU for CASS requests
   (and the production key when Add Home should go live); a private storage account for the national data files; Lob
   live key and return address.
4. New: whether to accept Washington's commercial-use attestation to open Spokane's free parcel files (we would never
   use owner names).

## Exact next steps for the successor

1. Confirm the branch and draft PR #3418 state; `git fetch`; do not change app code without the founder's OK.
2. Read the founder's answers. Rule: confirm a plain-words plan before any build, design or PR work.
3. If Phase 1 is approved: write the plain-words plan (server reads Google's USPS answers instead of Smarty's; what
   happens when Google is down or the home/business flag is blank, as approved; Google data kept within its terms),
   then build it on a new branch from master, verify Add Home on web, iOS and Android against a local backend, and keep
   CI green.
4. If "price records requests": for each row of `uncovered-counties-2026-11-05.csv` without a price, find the
   assessor's records or data-sales page, price, format, update frequency and commercial-use or redistribution terms;
   add columns; total one-time and yearly cost.
5. If "households + estimates": write the plain-words plan (what users see on Add Home, Place and Property details on
   web, iOS and Android; what stays) for the founder's OK before any build.
6. Research still open (no founder action): license terms per free source; Cobb's FTP file; a per-state inventory of
   statewide files beyond those found.
