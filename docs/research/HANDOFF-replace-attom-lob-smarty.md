# Handoff: replacing ATTOM, Lob and Smarty (November 5, 2026)

## State

- Branch `claude/replace-attom-lob-smarty-73fcb9`, draft PR WangPantopus/skinny-pantopus#3418, based on master
  `1c5ddb658c`. Docs and research scripts only; no app code changed, nothing built, no migration, no hosted service
  touched.
- Records in `docs/research/` (index: `README.md`):
  - `replacement-architecture-2026-11-05.md`, `data-source-catalog-2026-11-05.md`, `parity-plan-2026-11-05.md`: the
    proposed architecture, every planned data source, and how each vendor service is proven matched or beaten.
  - `replace-attom-lob-smarty-2026-11-05.md`: what the code uses each vendor for (file:line), the verdict on the two
    founder design documents, the combined nationwide design, phases, and open decisions.
  - `county-property-data-2026-11-05.md` + `.csv`: the 150 largest counties classified one by one (all 150 now), plus
    the national estimate from a 100-county population-weighted sample (`county-property-data-sample-2026-11-05.csv`),
    and a "Second pass" section listing what changed.
  - `uncovered-counties-2026-11-05.csv`: the 41 top-150 counties (41.9M people) without free building facts (19 not
    found, 15 paid or permission, 5 one city only, 2 free files not confirmed), with prices where found and the next step.
  - `county-data-survey/`: scripts and inputs to re-run or extend the survey (see its README; run Python with `-I`).
  - `property-data-sources-2026-11-05.csv`: every county and state source checked in the second pass, with link, what
    it holds and its terms caveat.
  - `how-listing-sites-get-unit-data-2026-11-05.md`: how Zillow and Redfin get unit facts and floor plans (MLS, rental
    feeds, owners, vendor-bought county records), the two Chicago examples checked, and what Pantopus can use.
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

## Decided by the founder

- Nov 5, evening: keep ATTOM as a fallback during the switch. County data wherever Pantopus has it, ATTOM only for
  counties not yet covered; stop calling ATTOM county by county and cancel the (national) subscription once few
  homes rely on it. The founder confirmed the ATTOM plan allows keeping its records (details in the design record,
  section 7). The cancel bar goes into the Phase 3 plan for the founder's OK.
- Nov 5, evening: the founder's intended ATTOM flow is database first, then ATTOM, save, and answer without making
  people wait. Checked on master: database first and saving are done; people still wait on a first lookup, and
  "no record" answers are not remembered (design record, section 8, with the proposed fix awaiting OK).

**Correction (Nov 5, late evening): Pantopus's ATTOM access is the free trial ($0).** The published trial terms (read for `docs/provider-data-persistence-2026-11-01.md` and PR #3433, not re-read today) restrict keeping ATTOM data past 24 hours and building a database from it. So the fallback above can't serve live users from stored copies without a paid plan, the copies the code keeps forever today conflict with those terms, and the default becomes PR #3433's $0 path: uncovered counties show labeled partial results and household entries. Open founder decisions: drop the ATTOM fallback (stay at $0) or price a paid plan for the transition; and how to bring today's stored ATTOM copies within the trial terms.

**Founder direction (Nov 5, late evening): build our own so Pantopus never pays ATTOM, but replace nothing yet.** Today's ATTOM (free trial), Smarty and Lob integrations stay as they are until the replacement is fully built; build every piece behind flags, prove it with the parity plan, then switch. No paid ATTOM plan. Next: merge #3433 and #3418 into one plan and write the build plan (with #3433's address-check fix) for the founder's OK.

**Corrections accepted from the #3433 author's review (Nov 5, late), for the merged plan:**
1. Success means what users keep: asking at Add Home for a fact ATTOM used to prefill counts as a regression, not parity.
2. Unit scope everywhere: no building, parking or average figures in a unit's fields; floor-plan mappings need per-unit
   evidence. "County records rarely hold condo interiors" is wrong as stated: Dallas 92.1%, Boston 95.6%, Cook 14.2% of
   condos have bedrooms, baths and area. Upgrade Dallas from basics to bedrooms/baths in the survey.
3. Replace "top-5 address match" with exact-unit precision, ambiguity and wrong-unit controls.
4. Phase 1 acceptance uses adjudicated truth (missing and unconfirmed units, unknown delivery, PO box, CMRA, mixed use,
   outages), not agreement with today's decisions. The Google adapter drops home/business metadata and footnotes and
   turns absent vacancy and CMRA into false (`googleProvider.js`); fix with the `D`/`N1` and blank-DPV cases.
5. FHFA gives price change, not a home's value or a ZIP median sale price; NSI is modeled. Keep both out of
   authoritative fields until measured. Household corrections follow field-specific rules (they don't outrank parcel
   identity or tax records).
6. Remove "ATTOM plan allows keeping records" from the architecture, catalog and parity plan (free trial: internal
   evaluation, 24 hours, no database).
7. Retiring Lob fully needs a chosen fulfillment route with real-mail trials; keeping Lob per piece is a founder choice.

## Running elsewhere

- Session `make-attom-lookups-non-b` (started by the founder Nov 5, its own worktree): makes ATTOM lookups
  non-blocking and remembers "no record" answers; it confirms its plan with the founder first. Not part of #3418.

## PR #3433 (Codex, `docs/research/provider-replacement/`) compared, Nov 5 evening

The two packages complement each other. #3433 is the stronger engineering base: a consumer-by-consumer code audit,
a 46-field fill matrix by property type from 14.66M assessment records in eight states, an identity contract (exact
unit, building only, ambiguous, unsupported), a rights register, a cost model, service objectives and mail
reliability rules. #3418 is the national coverage map (all 150 largest counties, a 100-county sample, 56%/22% of
Americans), the source register with links and prices, the live ATTOM flow findings, and the unit floor-plan approach.
Adopt from #3433 before any build: the Phase 1 regression it found (DPV `D` with footnote `N1` and a blank DPV
reach `OK`; the missing-unit flag comes from `CC`), the value-mapping bugs (assessed total shown as an estimate and
as an area median; an unobserved trend defaulting to flat; two different AVM confidence paths), and keeping vendor
copies out of evaluation sets. Conflict to settle with the founder: #3433 records $0 current ATTOM spend, while this
handoff records that the plan allows keeping records; if it is the free evaluation, its published terms forbid
keeping data past 24 hours and production display.

## Waiting on the founder

Asked in chat on Nov 5 (~22:00 UTC), no answer yet:
1. How to fill counties with no free data: recommended households + labeled estimates as the nationwide floor, and
   (research only, no money) price public-records requests for the 20 largest uncovered counties; not reseller files
   or a national license.
2. Phase 1 go-ahead (Smarty unnecessary, backend only, no screen changes). Two rule changes need an explicit yes:
   (a) when Google is down, let the person finish Add Home with the home unverified, no postcard mailed and nothing
   unlocked until a background re-check passes; (b) when Google leaves the home-or-business flag blank, the business
   check uses place types and parcel type (as it does for Smarty's "unknown" today). Recommended yes to both.
3. Founder-only facts: Smarty account or agreement; ATTOM plan terms beyond storage (storage confirmed allowed Nov 5); Google billing SKU for CASS requests
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
