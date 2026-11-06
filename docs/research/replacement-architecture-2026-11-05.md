# Architecture: Pantopus's own address and property data (replacing ATTOM, Lob and Smarty)

November 5, 2026. Proposed design, not approved and not built. It combines the nationwide design in
[replace-attom-lob-smarty-2026-11-05.md](replace-attom-lob-smarty-2026-11-05.md) (section 3), the county survey, and the
founder's decisions so far. Data sources are listed in [data-source-catalog-2026-11-05.md](data-source-catalog-2026-11-05.md);
how each vendor service is matched or beaten is in [parity-plan-2026-11-05.md](parity-plan-2026-11-05.md).

## Goals and constraints

- **Founder direction:** no ATTOM, Lob or Smarty subscriptions; nationwide from day one; great experience, low latency,
  high reliability.
- **Founder decisions:** keep ATTOM as a fallback for counties not yet covered and stop using it county by county
  (Nov 5); ATTOM's plan allows keeping its records (Nov 5).
- **Fixed limits:** USPS's delivery database can only be licensed (39 U.S.C. § 412); printing and postage are always
  bought per piece; Supabase Free (500 MB) cannot hold national data.
- **Rules that shape the design:** never seed Pantopus data from Smarty, ATTOM or Google output; owner names never
  enter the record; every fact carries its source, date and license scope; migrations are additive and new tables
  need the founder's approval; launch-cut features stay behind their flags.

## The pieces

| # | Piece | What it does | Replaces | Phase |
|---|---|---|---|---|
| 1 | Address check | Google Address Validation with USPS (CASS) answers feeds the existing decision engine; Smarty removed | Smarty | 1 |
| 2 | National address record | Every US address and unit, built offline from public address sources, with stable IDs and proven units | Smarty's unit lookup, part of ATTOM's matching | 2 |
| 3 | Property record | Building facts per parcel and building from county and state assessor files, with estimates where none exist | ATTOM `/property/detail` | 2-3 |
| 4 | Value service | Pantopus's own estimate from county values, public sales and the FHFA price index, measured before shown | ATTOM `/attomavm/detail`, `/salestrend/snapshot` | 4 |
| 5 | Source router | Per county: our record where we have it, ATTOM where we don't yet, estimates and household facts everywhere | — | 2-3 |
| 6 | Household facts | Verified residents confirm or correct facts; kept beside the source value | — | 2 |
| 7 | Unit facts | Building floor plan sheets map every unit number to its plan; residents confirm their unit | gap in ATTOM too | 3 |
| 8 | Mail | Lob per piece plus a backup printer behind the existing mail-provider switch; returned and re-routed cards handled | Lob subscription risk | 5 |
| 9 | Monitoring | Coverage by county, fill rates, freshness, error budgets, cost per verification | — | all |

## How data flows

```
Public sources (county/state assessor files, address points, NSI, ACS, FHFA)
   │  per-source connector: download or range-read, owner names dropped at read
   ▼
Normalize: one schema, each county's codes mapped to plain words, provenance on every fact
   │  release gates: row counts, ID retention >= 99.5%, golden-set accuracy, fill rates
   ▼
Versioned shard files per state (private object storage; previous release kept for rollback)
   │  backend range-reads shards (the `backend/services/plans/placesIndex.js` pattern)
   ▼
Request path: Home and HomeAddress rows hold the copy for that home (existing columns + `niche_data`)
   │
   ├─ county covered      → our record (no vendor call)
   ├─ county not covered  → stored ATTOM copy, or a background ATTOM lookup (fallback)
   └─ nothing known       → labeled estimates + "Is this right?" for the household
```

Builds run as scheduled jobs per state, like `.github/workflows/places-index.yml`. The national files stay private:
the storage account and its credentials are the founder's to create and add (founder-only fact).

## Request path and latency

- **Add Home:** one Google address check (Smarty's sequential call, up to 2.5 s, is gone after Phase 1). Property
  prefill reads the stored record or shard copy; an ATTOM fallback lookup runs in the background and fills the form
  when it lands (the non-blocking work in session `make-attom-lookups-non-b`).
- **Place "Your home" and Property details:** read the Home's stored copy; never wait on a vendor. A refresh runs in
  the background; the page shows each fact's source and date.
- **Targets (proposed):** shard read under 50 ms server-side; Property details under 300 ms p95 from stored data; no
  screen waits on a third party after the first paint.

## Data model (proposed, reuses existing tables first)

- **Fact:** `{ value, source_id, source_date, license_scope, method }` where `method` is one of `county`, `state`,
  `estimate`, `household`, `attom_fallback`. Precedence for display: verified household > county or state > ATTOM
  fallback > estimate, each labeled.
- **Property ID:** a stable Pantopus ID per parcel and per building, with lineage when parcels split or merge; the
  ATTOM ID stays only on fallback copies.
- **Units:** address record lists units per building; a unit is "proven" when a postcard code for it is redeemed.
- **Where it lives:** national data in shards; per-home copies on `Home` / `HomeAddress` (existing columns and
  `niche_data`); household corrections beside the source fact. Any new table goes to the founder first.

## Reliability

- **No single vendor on the critical path:** Google is the only live dependency of Add Home after Phase 1; its outage
  path (finish Add Home unverified, no postcard until a background re-check passes) waits on the founder's yes.
- **Shards:** immutable versioned files; a bad release rolls back to the previous one; the backend keeps the last good
  index in memory.
- **ATTOM fallback:** stored copies keep working when ATTOM is down; "no record" answers are remembered so unknown
  addresses aren't re-asked.
- **Mail:** a backup printer behind the mail-provider switch; returned and re-routed cards fail the attempt and offer
  another way to verify.

## Privacy and legal guardrails

- Owner names are dropped when a file is read; they never reach shards, logs or chat.
- Each source's license is checked before use; sources that forbid redistribution (King County, Will County, KGIS,
  Stanislaus) are used only as their terms allow, or not at all.
- Share-alike data (OpenStreetMap and other ODbL sets) stays out.
- A takedown path for protected people (for example New Jersey's Daniel's Law) and a no-mail path for
  address-confidentiality participants.
- State commercial-use rules (Washington's ban on commercial use of lists of individuals, Arizona's declarations) are
  respected; an attestation is accepted only with the founder's yes.

## What people see (proposed text design; no visual design before the founder's OK)

- **Add Home:** the form appears at once; facts we have are prefilled with a small "from county records, <date>"
  note; missing bedrooms or baths are asked as one-tap questions.
- **Place "Your home":** the same facts and value with their source and date; estimates say "estimate".
- **Property details (owners):** every county field we hold, grouped as today, with "Is this right?" on each group; a
  correction shows as the household's value with the county value kept underneath.
- **Apartments and condos:** unit facts from the building's floor plan sheet when the building has shared it, else
  the household's entry.

## Phases (from the design record, with the fallback decision)

| Phase | Work | Done when |
|---|---|---|
| 1 | Smarty no longer needed; Google's USPS answers in the decision engine | Add Home works with only a Google key |
| 2 | National address and building baseline; source router; household facts | Coverage map by county; top-5 address match >= 98% on a stratified golden set |
| 3 | Assessor connectors (statewide files first, then counties by demand); unit floor plan sheets; ATTOM calls stop county by county | Per-field fill rates published; ATTOM cancelled once few homes rely on it |
| 4 | Value estimate and trend | Error measured on held-out sales |
| 5 | Mail backup printer, returned and re-routed cards, fewer postcards | Postcards per verification measured |
