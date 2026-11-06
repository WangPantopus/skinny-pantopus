# Architecture: Pantopus's own address, property and mail systems

November 5, 2026. Proposed design; not approved, not built. It merges #3433's architecture (provider-neutral
interfaces, an isolated import worker, versioned indexes, the identity contract) with #3418's (the request path, the
source router, floor-plan sheets) and settles what neither did: which source wins for each field, and how background
results stay off a person's edits. What exists today: [current-system.md](current-system.md). The order of work:
[build-plan.md](build-plan.md).

## 1. Goals and fixed limits

**Goals (founder, November 5).** No ATTOM, Smarty or Lob subscriptions; nationwide from day one; a better experience,
availability and reliability than today. Replace nothing until the replacement is fully built behind flags and proven;
then switch, one vendor at a time.

**Limits nobody can design away.**
- USPS's delivery database can only be licensed (39 U.S.C. § 412). Pantopus rents that answer through Google's CASS
  response, or later a USPS license; it can't own it.
- Printing and postage are bought per piece.
- Supabase Free (500 MB) can't hold national address or property data; it stays in files outside the database.
- ATTOM's free trial allows internal evaluation only: no database, nothing kept past 24 hours, no showing it to others
  ([cost-and-rights.md](cost-and-rights.md#attom-free-trial)). Nothing in this design depends on ATTOM copies.
- Google's terms: its address, USPS and confirmation results may be kept 30 days (then deleted or replaced by what the
  person confirmed), its coordinates 30 days (then deleted); place IDs indefinitely; never send made-up US or Puerto
  Rico addresses ([cost-and-rights.md](cost-and-rights.md#google-address-validation)).

**Repository rules that shape it.** Never seed Pantopus's record from ATTOM, Smarty or Google output. Owner names never
enter the record. Every fact carries its source, date and license scope. Migrations are additive; new tables, hosted
storage and hosted configuration need the founder's yes ([decisions.md](decisions.md#proposals-that-need-a-yes)).
Launch-cut features stay behind their flags.

## 2. The pieces

| # | Piece | What it does | Where it lives | Replaces | Work package |
|---|---|---|---|---|---|
| 1 | Postal adapter | Maps Google's whole USPS answer into the decision engine's postal input; room for a USPS-licensed engine later | `backend/services/addressValidation/` | Smarty | WP3 |
| 2 | Property lookup module | Resolves an address to a unit, building, parcel or candidates; reads the active index release; returns allowed facts with scope, source, date and a reason for each gap | A new module in the backend (`backend/services/propertyRecords/`, proposed name) behind the existing property services | ATTOM `/property/detail` | WP5, WP8 |
| 3 | Import worker | Scheduled connectors per source: fetch, drop owner names, normalize, check, publish or quarantine | GitHub Actions jobs for national builds (the `places-index.yml` pattern); `worker.js` jobs for small refreshes | — | WP5, WP7, WP10 |
| 4 | Index releases | Immutable, versioned files per state and county with a manifest; the previous release kept for rollback | Private object storage (proposal P1) | — | WP5 |
| 5 | Address registry | Every US address and unit with Pantopus IDs, lineage and Pantopus's own coordinates | Inside the index releases | Smarty's unit lookup; Google coordinates kept past 30 days | WP6 |
| 6 | Source router | Per jurisdiction and field: which source serves, shadow or live | Backend config read in one place | — | WP8 |
| 7 | Household facts | Verified residents' entries and corrections, kept beside the record | Existing `Home` columns and `niche_data` | — | WP9 |
| 8 | Unit facts | Floor-plan sheets mapped to units; residents confirm | Index sources ([unit-facts.md](unit-facts.md)) | A gap in ATTOM too | WP11 |
| 9 | Value facts | Official values, recorded sales, an area price index, and an estimate only where measured | Index plus the existing profile | ATTOM `/attomavm/detail`, `/salestrend/snapshot` | WP12 |
| 10 | Mail fulfillment | One interface for both verification flows and Block Founders: durable intents, idempotency, an event ledger, more than one printer | `backend/services/addressValidation/mail*` | Lob as a single point of failure | WP13 |
| 11 | Monitoring | Coverage, fill, freshness, latency, error budgets, postal and mail outcomes, vendor calls (must reach zero) | Release reports plus existing metrics | — | Every package |

**Where it runs.** The Pantopus backend stays the only server the apps talk to (#3433's decision): the lookup is a
module, not a second service, so a property read adds no network hop or second outage. Heavy imports run apart from
interactive traffic: national builds on scheduled GitHub Actions jobs, like the monthly Places index, and small
refreshes as `worker.js` jobs with their own limits. A separate service is justified only if another product needs the
API or measured load needs independent scaling. Production today runs one API container and one worker
([current-system.md](current-system.md)).

## 3. How data flows

```
Public sources: county and state assessor files, address points, recorder sales, NSI, ACS, FHFA, floor-plan sheets
   │  connector per source: fetch or range-read; owner names dropped at read; raw file kept only where allowed
   ▼
Normalize: one schema; each county's codes mapped to plain words; scope, source, date and license on every fact
   │  checks: row counts, ID retention ≥ 99.5%, schema drift, ambiguity rate, fill versus last release, suppressions
   ▼
Release: immutable files per state and county + manifest (checksums, mapping versions, coverage report); last release kept
   │  backend reads ranges by manifest (the backend/services/plans/placesIndex.js pattern), recent blocks in memory
   ▼
Request path: the Home keeps the copy served to it (niche_data.property_record); household entries stay in Home columns
   ├─ exact unit or property   → record facts with scope and date
   ├─ building or parcel only  → building facts labeled as the building's; ask for the unit
   ├─ ambiguous                → ask which one; never pick the first
   └─ nothing                  → labeled estimates in their own slot + "Is this right?" for the household
```

The Places index already proves the read side: a manifest of byte ranges, HTTP range reads, recently read areas kept in
memory, and the last good manifest used when a read fails. Two differences: property releases live in **private**
storage (several sources forbid redistribution, and protected addresses must never sit in a public file), and builds
must never print addresses into the public repository's job logs.

## 4. Request path and latency

Two paths never block each other (#3433):

1. **Interactive read:** app → Pantopus permissions → property lookup → active release → filtered answer. Nobody waits
   for a county download.
2. **Refresh:** source register → connector → private staging → checks → new release → manifest switch. A failed
   refresh leaves the previous release serving and raises an operational alert.

Per screen:
- **Add Home:** one Google check (Smarty's sequential 2.5 s is gone after WP3); the prefill reads the index in the same
  request. Where a lookup can't answer at once (a cold block, a source still importing), the #3439 pattern applies: the
  form opens, "Looking up public records for this address…" shows in the empty fields, and they fill in by themselves;
  typed values are kept.
- **Place "Your home", Property details, the value card:** answer from the Home's stored copy at once; a refresh runs in
  the background and the existing `sync:changed` signal (`home:<id>`, `place:<id>`) makes web, iOS and Android re-read.
- **Targets** (proposed; measured in [parity-and-acceptance.md](parity-and-acceptance.md#service-objectives)): index
  read under 50 ms server-side; address resolve p95 ≤ 300 ms; stored property read p95 ≤ 400 ms; no screen waits on a
  third party after its first paint.

## 5. Identity contract

Every lookup returns exactly one of these, and the screens behave accordingly:

| Result | When | What the server returns | What the person sees |
|---|---|---|---|
| `exact` | One supported unit, or one single-unit property, with enough identity evidence | That subject's facts, each with its own quality and date | The facts and dates; an exact match can still have unknown bedrooms |
| `building_only` | A building or complex matches but no unit record does | Building facts labeled as the building's | "We found the building. Which unit is yours?" Building statistics (unit count, average size) stay the building's |
| `parcel_only` | Land matches but no building or unit record | Parcel facts (lot, use, assessment) at their scope | Parcel facts, then the household's own entries |
| `ambiguous` | Several plausible units, a condo and its parking, conflicting sources | Up to a few allowed, non-personal choices | "Which one is yours?" Never the first candidate just to fill a screen |
| `unsupported`, `restricted`, `stale` | No record, a suppressed record, or rights or freshness lapsed | A reason and the source's date where allowed | Immediate partial screen or the household's entry; no paid fallback starts |

**IDs.** Pantopus issues namespaced, stable IDs for an address, a parcel, a building, a unit, a condo interest, a
postal delivery point and an assessment account. `HomeAddress` stays the canonical address people use and `Home` the
private household; a property exists before anyone creates a Home, and the registry never creates a household. Links
carry their type, effective dates, evidence and confidence. Splits, merges, renumbering and demolition are lineage
events: a new legal interest gets a new ID linked to its predecessor, and a split needs re-resolution before any private
privilege follows it.

**Matching rules.** Normalize directions, suffixes, unit designators, aliases and ZIP while keeping the publisher's
spelling. Keep leading zeros and the full unit designator. Never derive a unit number from an assessor ID. Never
auto-link on a key that matches more than one parcel (Cook: 69,070 of 1,700,036 keys did). A unit's private facts show
only on an `exact` match.

**Internal answer shape** (synthetic values; the apps keep receiving the shapes they understand, section 15):

```json
{
  "match": "building_only",
  "subject": {"kind": "building", "id": "pp:bldg:example"},
  "requested_subject": "unit",
  "release": "example-county-2026-11-r2",
  "facts": [
    {"field": "year_built", "value": 1983, "scope": "building", "source": "Example County Assessor",
     "as_of": "2026-01-01", "method": "county", "status": "reported"}
  ],
  "unavailable": [{"field": "unit_living_area", "reason": "unit_record_missing"}]
}
```

## 6. The fact model

Each fact has: a subject (kind and ID); a field from the [field dictionary](evidence/field-dictionary.csv); a value and
unit of measure; a scope (unit, building, parcel, area); a source (publisher, dataset, edition); `as_of` (the source's
date) and `imported_at`; a license scope (may Pantopus store it, show it, derive from it); a method (`county`, `state`,
`recorder`, `manager`, `household`, `estimate`); and a status (`reported`, `unknown`, `inapplicable`, `restricted`,
`stale`, `withdrawn`). Official observations, household corrections, managers' sheets and model estimates stay
separately attributable. Several copies of one upstream roll (a county's points republished by NAD and by Overture)
count as one source family, never as corroboration.

## 7. Fact precedence, field by field

"Record" means an official source in the index (county, state, recorder) for the matched subject. "Household" means a
verified member's entry for their own Home; an unverified member's entry is saved privately until they verify. A
household entry never changes the record; it is shown beside it.

| Fields | First | Then | A household entry | Never |
|---|---|---|---|---|
| Identity and legal: parcel number, county, FIPS, municipality, subdivision, lot number, legal description, tax code area, class, land use, county use code | Record | — | "Report a problem" sends it to review; the display doesn't change | An ATTOM ID (Pantopus's ID instead) |
| Assessment and tax: assessed, market, land and improvement values, exemptions, tax, tax year | Record, with its tax year | — | Report a problem only | An estimate presented as an assessment; an empty exemption read as "none" |
| Recorded sales: last sale date, price, type | Recorder or assessor record | "Not public in <state>" (TX, UT, ID, NM, KS, MO) | Not accepted | A tax value standing in for a missing sale |
| Year built, effective year, stories, lot size | Record | Household | Kept beside; the record stays the displayed value; a conflict goes to review | NSI or ACS figures in these fields |
| Living area | Record, under its exact definition (living, effective, gross) | Floor-plan sheet (exact unit), then household | Shown to the household as theirs, with the record underneath | A different-meaning area (effective, main, average) filling "living area" |
| Bedrooms, bathrooms (full, partial) | Record for the matched subject | Floor-plan sheet (exact unit), then household | Shown to the household first, labeled "From your household", with "County record: 3" underneath; the Home's own features use it | Building averages or totals in a unit's fields |
| Construction and systems: roof, walls, heating, cooling, fireplaces | Record | Household | Shown to the household first, labeled, record underneath (records lag replacements) | — |
| Parking: garage, type, spaces, area | Record for the subject | Household | Shown labeled; a condo's parking account isn't the unit's space without proof | Common or basement parking counted as the unit's |
| Unit interior (condo, apartment) | Exact-unit record (Dallas, Boston) | Floor-plan sheet with that unit mapped, then the verified resident | The resident's entry shows for their Home | Building statistics, the complex's average, a plan without a unit mapping |
| Building facts on a unit's page (building year, stories, unit count) | Record for the building | — | — | Shown in a "Building" group, labeled as the building's |
| Home or business | Postal metadata, then the parcel's land use | Place types (decision D1b) | — | NSI's modeled occupancy deciding a verdict |
| Value | Official values and recorded sales, then an area price index, then a Pantopus estimate only where measured (section 8) | — | Owners may add a private note | ATTOM's AVM copied; a trend defaulting to flat |
| National estimates (NSI size, stories, year; ACS medians) | Only in a separate "Estimate" slot, labeled | — | The household's entry replaces the estimate in the household's view | Filling any record field or outranking anything |
| Today house outline | County footprint and stories | FEMA USA Structures, then NSI stories (as an estimate) | Household's stories and type | — |

## 8. The value card is never empty, and an estimate shows only where measured

The card always shows what is known, in this order, each with its label and date:
1. **The county's values:** market value and assessed value with the tax year (in Washington, assessed at 100% of
   market).
2. **The last recorded sale:** date and price where sales are public; "Sale prices aren't public in <state>" otherwise.
3. **The area's price trend:** from the FHFA House Price Index for the ZIP or tract ("Prices in this ZIP rose 4.1% in
   2025 (FHFA index)"). It is a price-change index: never a home's value and never a ZIP median sale price.
4. **A Pantopus estimate:** only in markets where its error on held-out sales meets the bar
   ([parity-and-acceptance.md](parity-and-acceptance.md#values)), with a range and its method. Elsewhere there is no
   estimate, and nothing pretends to be one.

Today's mapping bugs (assessed total shown as an estimate and as a ZIP median; a missing trend shown as flat; two
confidence paths) are fixed on the way (WP12). For the apps in the stores, the value card's fields keep their names
and allowed values (section 15).

## 9. Background results never overwrite a person's edit

1. Prefill fills only fields the person hasn't touched. The apps already work this way ("Prefill only — never overwrite
   something the user already typed", iOS Add Home); web and Android follow the same rule.
2. Record facts and household facts are stored apart (the Home's record snapshot versus its own columns), so a refresh
   physically can't write a household value.
3. A refresh replaces a fact only with newer data for the same subject. Empty answers, timeouts and outages keep the
   last copy, shown with its date, and are retried later (founder, November 5: "better to show something than
   nothing").
4. A household correction stays until the household changes it. A newer record that agrees marks it "matches the
   county record"; nothing deletes it.
5. The one exception is privacy and rights: a withdrawn source, an expired license or a protected-person request
   removes facts everywhere, including old releases and restored backups.
6. The server merges by field with timestamps; the apps re-read on `sync:changed` and keep unsaved local edits.

## 10. No dependency on stored ATTOM copies

- The property lookup never reads `Home.niche_data.attom_property_detail`, `AttomPropertyCache`, the per-address copy,
  ATTOM rows in `ExternalFeedCache` or `PropertyIntelligenceCache`.
- No field mapping, code table, ID or evaluation answer comes from ATTOM, Smarty or Google output.
- "Same or better than ATTOM" is measured with live trial calls used only for internal evaluation, kept at most 24
  hours and reported as counts, and only while the trial is in force; otherwise against adjudicated truth
  ([parity-and-acceptance.md](parity-and-acceptance.md)).
- As each county switches, the router stops reading ATTOM copies there; the copies are then purged as the terms require
  (a hosted delete only the founder runs).

## 11. Storage

| What | Where | Status |
|---|---|---|
| National address and property releases | Private object storage with range reads; per-state and per-county files with a manifest; the previous release kept | Proposal P1 (founder creates the account and adds the credentials) |
| The record snapshot served to a Home | `Home.niche_data.property_record` (a new key in the existing JSON column; no migration), with release ID and date | Planned |
| Household entries | Existing `Home` columns (`year_built`, `sq_ft`, `bedrooms`, `bathrooms`, `lot_sq_ft`, `home_type`); who and when per field in `niche_data.household_facts` | Planned; a history table only if review needs more (proposal P2) |
| The postal decision | `HomeAddress`, with `postal_checked_at`; Google content deleted or re-checked within 30 days; Pantopus coordinates from the registry replace Google's | Planned (WP3, WP6) |
| Mail provider per piece | A `mail_provider` column on the existing mail rows | Additive migration, normal review |
| Uploaded floor-plan sheets | Private storage, kept only with the building's permission | Proposal P4 |

The file format is settled in WP5 by measurement. The starting proposal: per-county blocks of gzip'd records keyed by
normalized street, addressed by a manifest of byte ranges (the Places index format), so a lookup reads one small block.

## 12. The postal adapter

How Google's answer maps into the decision engine (WP3). Field names are Google's published `UspsData` and
`AddressMetadata`.

| Google | Postal input | Engine meaning |
|---|---|---|
| `dpvConfirmation` `Y` / `N` / `D` / `S` / absent | `dpv_match_code`; absent → `unknown` | `Y` deliverable; `N` undeliverable; `D` **unit required and missing** → MISSING_UNIT; `S` **unit given but not confirmed** → "check your unit number"; unknown → pending, never OK |
| `dpvFootnote` | `footnotes[]` (two-character codes) | `N1` or `C1` → unit required; `CC` → unit not confirmed and not required; `M1`/`M3` → street number problems; `P1`/`P3` → box number problems; `F1` → military |
| `dpvVacant`, `dpvCmra` | `true` / `false` / `null` when absent | Absent is unknown, never false |
| `dpvNoStat` (+ reason code) | `no_stat` | New signal: recorded in shadow only until the founder approves a rule |
| `addressRecordType` | `record_type` | `P` PO box; `G` general delivery; `H` building or apartment (a unit is expected); `F` firm |
| `carrierRoute` | `carrier_route`; first letter as `carrier_route_type` | `B` PO box section; `R` rural; `H` highway contract |
| `postOfficeCity`, `postOfficeState` | Post-office city and state | — |
| `cassProcessed` | `cass_processed` | Not processed → postal answer unknown |
| `metadata.residential`, `business`, `poBox` | `rdi_type` (`residential` / `commercial` / `unknown`); PO-box flag | Unset is unknown; unknown follows decision D1b |

Confidence never rises for `D`, `S` or a blank DPV, so neither can reach OK or auto-verify a claim. Postal answers carry
`postal_checked_at`; Mailbox Check says when the check ran and re-checks anything older than 30 days.

## 13. Mail fulfillment

- **One interface** per provider: create a piece from an intent, read it, cancel it, verify a webhook, normalize an
  event. Providers: `lob`, `mock`, and a second one once qualified. Selection by configuration, per flow; a piece always
  finishes with the provider that accepted it.
- **Durable intent first, for every flow.** Verification cards already reserve and send an idempotency key; Block
  Founders cards get the same (the invite ID as the key), and an uncertain outcome (a timeout) keeps the reservation as
  "pending confirmation" instead of deleting it.
- **Reconcile before retrying or switching printers:** ask the provider about the pending piece by its key; only a
  confirmed failure allows a resend or failover.
- **An event ledger:** provider, piece ID, event ID, type, time; duplicates ignored; only forward or terminal changes
  applied.
- **Returned, re-routed and failed cards end the attempt** in the Home postcard flow too (today they are ignored): the
  person is told and offered the next step (fix the address and resend after the cooldown, or another proof). A
  delivery scan never redeems a code or grants anything.
- **Suppression before every send,** retries included: the opt-out registry, the 90-day per-recipient rule and
  protected-person no-mail flags; Block Founders traffic can be stopped without stopping verification cards.
- **Measured:** cards per verified household, time to delivery, returns, redemption rate, cost per verified household.

## 14. Reliability and availability

- **Dependencies on the critical path:** Google for postal answers only (Add Home's address step); its outage path is
  decision D1a. The property read depends on nothing outside Pantopus.
- **Index:** immutable releases; the last good manifest and recent blocks in memory; a bad release rolls back per
  jurisdiction within 30 minutes; a failed import leaves the old release serving. If storage is unreachable, stored Home
  copies keep every screen working and new lookups say "Looking up…" until it returns.
- **External calls:** deadlines, circuit breakers, bounded retries with jitter; an outage or a miss never starts a paid
  call.
- **Proof writes fail closed:** postcard codes, verification and access changes are written durably or refused.
- **Drills:** lost worker, bad import, expired postal data, storage outage, database restore (suppressions and erasures
  reapplied before restored data serves).

## 15. Compatibility with the apps in the stores

Old builds accept only today's vocabulary ([current-system.md](current-system.md#what-the-apps-assume)): the value card
needs `source` in `cache`, `cache_stale`, `attom`, `fallback`, `unavailable`; the Add Home records card keys on
`tiers_used` containing `attom`; copy names ATTOM.

1. **Readers first (WP2).** New app versions accept a `provenance` object (publisher, dataset, as-of date, scope,
   method) and new tier names, show server-sent labels instead of hard-coded "ATTOM" copy, and send a client header
   (platform and version) so the server can measure how many old builds remain.
2. **New words only on request.** The server answers in the new vocabulary when the app asks (a query flag, as #3439's
   `?lookup=` does); old servers ignore the flag.
3. **Honest legacy answers.** For old builds the server keeps the old field names and allowed values: a record-based
   profile is `source: cache` (a stored copy, which it is). It never labels county data `attom`. Old Add Home builds
   will then show their generic "Public records" wording; the switch for old builds waits until the measured share of
   old-build Add Home sessions is low enough for the founder.

## 16. Privacy and legal guardrails

- Owner names are dropped when a file is read; they never reach releases, logs or chat. Claim evidence, mail codes and
  private corrections stay out of the shared index.
- Each source's license is checked before use ([cost-and-rights.md](cost-and-rights.md#rights-register)); sources that
  forbid redistribution are used only as their terms allow, or not at all. Share-alike (ODbL) data stays out of the
  property index.
- Protected people: a takedown path (New Jersey's Daniel's Law and similar), suppression applied to search, detail,
  dispatch, every release and restored backups; a no-mail path for address-confidentiality participants that never asks
  for their physical address.
- State rules: Washington's ban on commercial use of lists of individuals, Arizona's commercial-purpose declarations; an
  attestation is accepted only with the founder's yes.
- No public raw files, no address-bearing logs, no unit directory, no counts of who has claimed a unit; search limited
  against enumeration.

## 17. Left out on purpose

A public API; national deed, mortgage and lien history; MLS data; owner names; scraping listing sites; and any ATTOM,
Smarty or Google output in Pantopus's record.
