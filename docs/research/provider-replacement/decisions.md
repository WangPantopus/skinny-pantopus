# Decisions log

What the founder has decided, what those decisions replaced, and what is still open. Dates are Pacific. Nothing in this
package is approved beyond the rows marked as the founder's.

## Founder decisions

| Date | Decision | Where it shows |
|---|---|---|
| Nov 5 | Replace the ATTOM, Smarty and Lob subscriptions with Pantopus's own systems, **nationwide from day one** (not one county first), with a great experience, low latency and high reliability | The whole package; local pilots are test fixtures, not a launch boundary |
| Nov 5 | The intended ATTOM flow: database first, then ATTOM, save, and answer **without making people wait** | Server #3439 merged and released Nov 5; web #3445 and iOS #3446 merged; Android #3447 open (session `make-attom-lookups-non-b`, started by the founder); WP1 |
| Nov 5 | People should have facts **looked up and confirm them**, not type them; a refresh **keeps what we have** if the new answer is empty ("better to show something than nothing") | [experience.md](experience.md), [architecture.md](architecture.md#9-background-results-never-overwrite-a-persons-edit) |
| Nov 5, late | Pantopus's ATTOM access is the **free trial** ($0) | [cost-and-rights.md](cost-and-rights.md#5-attom-free-trial) |
| Nov 5, late | **Build our own** so Pantopus never pays ATTOM; **no paid ATTOM plan** | The ATTOM fallback below is withdrawn |
| Nov 5, late | **Replace nothing yet:** today's ATTOM (trial), Smarty and Lob integrations stay as they are until the replacement is fully built behind flags and proven with the parity plan; then switch | [build-plan.md](build-plan.md): every work package ships off or in shadow |
| Nov 5, late | Merge #3433 into #3418 as one package with the build plan; take everything good from #3433 | This package |
| Nov 5, late | Accept seven corrections from the #3433 review (below) | Applied everywhere |

### Decisions of November 6 (dates in UTC; the founder answered "all recommended")

| Item | Decision |
|---|---|
| The bar | "Really exceed what those 3 services can do for us": cost, experience, availability and reliability, above all authentic and much more available property data. G1-G7 are the minimum, not the goal |
| ATTOM trial | It **ended November 4**. ATTOM's key comes out of production and staging, nobody runs the prefill again, every copy is purged, and the founder signs the affidavit by about November 18 ([cost-and-rights.md](cost-and-rights.md#5-attom-free-trial)). This replaces the open D3 and makes D4 moot |
| Smarty | No paid agreement. Its published terms are respected anyway: no scoring of Google against Smarty, even in shadow |
| D1, D1a, D1b, D1c | As recommended below: the postal adapter ships off; Add Home finishes unverified when Google is down; an unset home-or-business is decided by place types and the parcel's use; an unconfirmed unit continues with a warning and is confirmed by mail, never auto-verified |
| P1 | Done. Private S3 bucket in us-west-2; GitHub Actions can write through a `master`-only environment; the reader key can only read releases under `index/` |
| D2 | Stronger than this package recommended: one-tap questions and labeled estimates are the floor, not the goal. Real public-records requests start with the 41 large counties without a free file. Buy a county's file when it is a one-time fee of $500 or less; anything higher is a separate ask. Research only, no build without a yes: reading one property's page on a county's own lookup site when someone adds a home there (35.5% of Americans live where only those sites exist). Still no national license, reseller files or listing sites |
| D5 | Pantopus's own mail layer (nothing mailed twice, returned cards handled, printers swappable); Lob stays per piece; a second printer is qualified for outages and can become the main one if it beats Lob on price in the real-mail pilot |

### The seven accepted corrections

1. Success means what people keep: asking at Add Home for a fact ATTOM used to prefill is a regression
   ([experience.md](experience.md), gate G2).
2. Unit scope everywhere: no building, parking or average figures in a unit's fields; floor-plan mappings need
   per-unit evidence. "County records rarely hold condo interiors" was wrong (Dallas 92.1%, Boston 95.6%, Cook 14.2%);
   Dallas moves to bedrooms/baths in the survey ([sourcing.md](sourcing.md), [unit-facts.md](unit-facts.md)).
3. "Top-5 address match" is replaced by exact-unit precision with ambiguity and wrong-unit controls
   ([parity-and-acceptance.md](parity-and-acceptance.md#t2-identity-truth-for-the-address-registry-and-property-lookup-gate-g3)).
4. Phase 1 is accepted on adjudicated truth (missing and unconfirmed units, unknown delivery, PO box, CMRA, mixed use,
   outages), not agreement with today; the Google adapter's dropped metadata and footnotes and its absent-means-false
   flags are fixed ([architecture.md](architecture.md#12-the-postal-adapter)).
5. FHFA gives price change, not a home's value or a ZIP median sale price; NSI is modeled; both stay out of record
   fields until measured. Household corrections follow field-specific rules and don't outrank parcel identity or tax
   records ([architecture.md](architecture.md#7-fact-precedence-field-by-field)).
6. "The ATTOM plan allows keeping records" is removed everywhere: the trial allows internal evaluation only, nothing
   past 24 hours, no database.
7. Retiring Lob fully needs a chosen fulfillment route proven with real mail; keeping Lob per piece is the founder's
   choice (D5).

## Superseded statements

These appeared in earlier versions of #3418 or #3433 and no longer hold:

| Earlier statement | Replaced by |
|---|---|
| "Keep ATTOM as a fallback during the switch; county data where we have it, ATTOM elsewhere" (Nov 5, evening) | No paid plan; the trial can't serve users from stored copies; uncovered counties get labeled partial results and household entries ([cost-and-rights.md](cost-and-rights.md#7-the-attom-transition-county-by-county)) |
| "The founder confirmed the ATTOM plan allows keeping its records" | It is the free trial: 24 hours, no database, internal evaluation |
| "Cancel the national ATTOM subscription once few homes rely on it" | There is no subscription; ATTOM stops county by county as the record qualifies, and stored copies are purged under the trial terms |
| "Top-5 address match ≥ 98% on a golden set" | Exact-unit precision ≥ 99.5% and wrong-unit < 0.1% (G3) |
| "Same verdict as today on ≥ 99% of a replayed set" (Phase 1) | Adjudicated postal truth (T1) |
| "County records rarely hold condo interiors" | Varies by county: Dallas 92.1%, Boston 95.6%, Cook 14.2% |
| "FHFA ZIP index as the value" | An area price-change index, labeled |
| "Replace nothing until built", for ATTOM | The trial ended first. Every county that hasn't qualified shows labeled partial results and household entries; a county going live improves it at once. Still true for Smarty and Lob |
| "Shadow runs the Google mapping beside Smarty" (WP3) | Shadow logs Google's categories only |
| "Ask ATTOM in writing; if no, shorten copies to 24 hours" (D3) | The trial is over, and 24-hour copies never allowed showing ATTOM facts to users |
| "Lob plus a backup printer behind the existing mail-provider switch" | There is no multi-printer switch today (Lob or a mock); WP13 builds one |
| "22% of Americans have free bedrooms or baths" | 23.2% (21-27%) after the Dallas correction |

## Open decisions

Recommendations are this package's; the founder decides. Each is asked in plain words with the work package's plan.

| # | Decision | Recommendation | Blocks |
|---|---|---|---|
| D6 | License USPS's Address Management System (about $7,570 a year) once checks pass about 40,000 a month | Not now; revisit on measured volume | Later |
| D7 | MLS or rental listing feeds for unit facts | Not now | — |
| D8 | Accept Washington's commercial-use attestation to open Spokane's free parcel files (owner names never used) | Founder's call | Spokane connector |
| D9 | Ship a Pantopus value estimate at all, and its accuracy bar | Not until measured; proposed bar: median error ≤ 8% on held-out sales with 75-85% interval coverage | WP12 |
| D10 | A rule for USPS "no-stat" addresses (USPS doesn't deliver there) | Record in shadow first; decide with the counts | WP3 |
| D11 | When old store builds get the new vocabulary (their Add Home card loses "(ATTOM)") | When the measured share of old-build Add Home sessions is small | WP2, WP15 |
| D12 | Bring stored Google content within its 30-day limits (coordinates, USPS data) | Clear USPS data after 30 days in WP3; replace coordinates with registry points in WP6 | WP3, WP6 |

## Proposals that need a yes

New tables, hosted storage and hosted configuration are the founder's to approve (`AGENTS.md`):

| # | Proposal | Why | Alternative |
|---|---|---|---|
| P2 | A household-correction history table | Only if review needs per-field history beyond `niche_data.household_facts` | Start without it |
| P3 | A `mail_provider` column on the existing mail rows | A piece always finishes with the provider that accepted it | Additive migration through normal review; listed for visibility |
| P4 | Private storage for uploaded floor-plan sheets | Keep originals only with permission | Can share P1's account |
| P5 | A mail event ledger table, if the existing webhook dedupe can't hold normalized events | Duplicate and late events made harmless | Reuse the existing dedupe store first |

## Founder-only facts and actions

ATTOM: the exact end date from its notice, and the signed affidavit. Google: the billing SKU for CASS requests; the
production key when Add Home should go live. Lob: the live key and the real return address. Every production flag
change, every hosted delete (the ATTOM purge), every real-mail send and every contact with a vendor.
