# Decisions log

What the founder has decided, what those decisions replaced, and what is still open. Dates are Pacific. Nothing in this
package is approved beyond the rows marked as the founder's.

## Founder decisions

| Date | Decision | Where it shows |
|---|---|---|
| Nov 5 | Replace the ATTOM, Smarty and Lob subscriptions with Pantopus's own systems, **nationwide from day one** (not one county first), with a great experience, low latency and high reliability | The whole package; local pilots are test fixtures, not a launch boundary |
| Nov 5 | The intended ATTOM flow: database first, then ATTOM, save, and answer **without making people wait** | Being built in draft PR #3439 (session `make-attom-lookups-non-b`, started by the founder); WP1 |
| Nov 5 | People should have facts **looked up and confirm them**, not type them; a refresh **keeps what we have** if the new answer is empty ("better to show something than nothing") | [experience.md](experience.md), [architecture.md](architecture.md#9-background-results-never-overwrite-a-persons-edit) |
| Nov 5, late | Pantopus's ATTOM access is the **free trial** ($0) | [cost-and-rights.md](cost-and-rights.md#5-attom-free-trial) |
| Nov 5, late | **Build our own** so Pantopus never pays ATTOM; **no paid ATTOM plan** | The ATTOM fallback below is withdrawn |
| Nov 5, late | **Replace nothing yet:** today's ATTOM (trial), Smarty and Lob integrations stay as they are until the replacement is fully built behind flags and proven with the parity plan; then switch | [build-plan.md](build-plan.md): every work package ships off or in shadow |
| Nov 5, late | Merge #3433 into #3418 as one package with the build plan; take everything good from #3433 | This package |
| Nov 5, late | Accept seven corrections from the #3433 review (below) | Applied everywhere |

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
| "Lob plus a backup printer behind the existing mail-provider switch" | There is no multi-printer switch today (Lob or a mock); WP13 builds one |
| "22% of Americans have free bedrooms or baths" | 23.2% (21-27%) after the Dallas correction |

## Open decisions

Recommendations are this package's; the founder decides. Each is asked in plain words with the work package's plan.

| # | Decision | Recommendation | Blocks |
|---|---|---|---|
| D1 | Go ahead with the postal adapter (Smarty no longer needed; backend only, no new screens beyond accurate messages) | Yes | WP3 |
| D1a | When Google is down, let the person finish Add Home with the home unverified, no postcard and nothing unlocked until a background re-check passes (today: refused unless a recent check exists) | Yes | WP3's outage path |
| D1b | When Google leaves home-or-business unset, decide by map place types and parcel type, as the engine already does for Smarty's "unknown" (a business with no other business signal could be added as a home; mail proof still required) | Yes | WP3 |
| D1c | When USPS doesn't confirm a unit the person typed (`S`), let them continue with a warning and confirm the unit by mail, or require a correction | Continue with a warning; no auto-verify | WP3 |
| D2 | How to fill counties with no free building files | Households plus labeled estimates as the national floor; price public-records requests for the 20 largest uncovered counties (research only); no reseller files or national license | WP7, WP9 |
| D3 | Bring today's ATTOM copies within the trial terms: ask ATTOM in writing, shorten copies to 24 hours in code, or turn ATTOM off; plan the purge and affidavit at the trial's end | Stop the prefill now; ask ATTOM in writing; if no, shorten to 24 hours | WP0 |
| D4 | The bar for switching ATTOM off nationally | Every county with Pantopus homes qualified, or accepted with partial results; under 1% of Home opens on ATTOM for two 30-day windows | WP15 |
| D5 | Mail: keep Lob per piece as the main printer and qualify a second one, or retire Lob after a second route passes the real-mail pilot | Keep Lob per piece; qualify a second printer for outages | WP13, WP16 |
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
| P1 | A private object-storage account and bucket for national index releases and truth sets, with credentials added to GitHub Actions and the backend by the founder | Supabase Free can't hold national data; releases must be private | None found that keeps the data private and range-readable |
| P2 | A household-correction history table | Only if review needs per-field history beyond `niche_data.household_facts` | Start without it |
| P3 | A `mail_provider` column on the existing mail rows | A piece always finishes with the provider that accepted it | Additive migration through normal review; listed for visibility |
| P4 | Private storage for uploaded floor-plan sheets | Keep originals only with permission | Can share P1's account |
| P5 | A mail event ledger table, if the existing webhook dedupe can't hold normalized events | Duplicate and late events made harmless | Reuse the existing dedupe store first |

## Founder-only facts and actions

Smarty: whether an account or agreement exists, and its terms. ATTOM: the trial's effective date and any other
agreement. Google: the billing SKU for CASS requests; the production key when Add Home should go live. Lob: the live key
and the real return address. Storage: the P1 account. Every production flag change, every hosted delete (the ATTOM
purge), every real-mail send and every contact with a vendor.
