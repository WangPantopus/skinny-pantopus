# Replacing ATTOM, Lob and Smarty: findings and plan

November 5, 2026. Research only: nothing is built, nothing is decided beyond what is marked as the founder's.

**Founder direction (Nov 5):** replace the ATTOM, Lob and Smarty subscriptions with Pantopus's own systems, and do it
**nationwide from day one** (not Clark County or Portland first). Great experience, low latency, high reliability.

**Inputs reviewed:** two design documents the founder supplied (kept outside the repo):
"Replacing Lob, Smarty and ATTOM" (Word memo: own the graph, keep renting USPS truth, mail and deeds) and
"Own the address and property foundation" (34-page PDF blueprint: registry, licensed postal engine, county
connectors, pilot metrics). Code read on master `1c5ddb658c`.

Companion files: [county-property-data-2026-11-05.md](county-property-data-2026-11-05.md) (what free property data
exists, nationally), its CSVs, and [county-data-survey/](county-data-survey/) (the scripts and inputs used).

## 1. What the app really uses each vendor for

**Smarty** (US Street API only)
- USPS deliverability (DPV), residential/business (RDI), mail-drop stores (CMRA), vacancy, footnotes:
  `backend/services/addressValidation/smartyProvider.js`. Stored on `HomeAddress`; read by the Mailbox Reality Check.
- Mandatory: without Smarty every address check returns SERVICE_ERROR
  (`addressDecisionEngine.js:478`, rule 1 at `:206`). The pipeline calls Google then Smarty in sequence
  (`pipelineService.js:397`, `:434`), each with a 2.5 s timeout.
- Redundant: Google Address Validation is already called with `enableUspsCass: true` (`googleProvider.js:110`) and the
  app already parses DPV, vacant, CMRA and carrier route from it (`googleProvider.js:231`). Google also returns
  `metadata.residential/business` (unset means unknown).
- The Smarty unit lookup (`secondaryAddressProvider.js`) is off by default.

**Lob** (print and mail only; no Lob address checks are used)
- Verification postcards with a 6-digit code, two flows: `/api/v1/address/verify/mail/*` and
  `/api/homes/:id/postcard-requests` / `request-postcard` (`lobMailProvider.js:134`).
- Block Founders "invite a neighbor" marketing postcards (`blockFoundersService.js:594`, `sendCustomPostcard`).
- Delivery webhooks (`routes/lobWebhook.js`). The home-postcard handler (`homePostcardService.js:79`) ignores
  returned and re-routed events; the older flow expires the attempt on return.
- Lob's Developer plan has no monthly fee (about $0.87-0.91 per 4x6 postcard, postage included).

**ATTOM** (`backend/services/ai/propertyIntelligenceService.js`: `/property/detail`, `/attomavm/detail`,
`/salestrend/snapshot`)
- Add Home prefill (`propertySuggestionsService.js:160`); Home create stores the server's copy (`routes/home.js:1122`).
- Place "Your home" card: facts, value, sky house (`placeIntelligenceService.js:993`).
- Owner-only Property details: full county record (`homeDetailService.js`, `countyRecordSerializer.js`).
- Dashboard value card (`routes/home.js:5509`); exemption check and over-assessment signal
  (`exemptionCheckService.js:174`); Today sky house shape (`place/houseShape.js:213`); AI context (Pulse composer,
  neighborhood facts, seasonal checklist).
- Off by default: owner-name ownership match (`propertyDataService.js`, `PROPERTY_DATA_PROVIDER`), parcel shadow in
  address validation.

**Other facts that matter**
- Production has had no Lob, Smarty or Google Address Validation keys since Oct 9 (`NEXT_STEPS.md:195`): new
  addresses can't be validated and postcards can't be sent there.
- License conflicts today: ATTOM detail responses are kept forever (`propertyIntelligenceService.js:65`), while the
  published ATTOM trial terms forbid database building and retention past 24 hours
  (`docs/provider-data-persistence-2026-11-01.md:131`). Google's terms (EEA version seen) cap caching at 30 days, yet
  `HomeAddress` keeps Google coordinates permanently.
- iOS/Android Add Home and Place, and the web Property details footer, say "ATTOM" in copy; old store builds keep it.
- For one sample home (APN 986039129, Camas WA) the county's free full assessor file matched ATTOM on every building
  field and was more accurate in two (2 full baths vs ATTOM's 1; municipality Camas vs "Clark"; roof code CMP vs
  "Concrete").

## 2. The two documents

- **The PDF is the better base for a nationwide build**: national search with stated coverage limits, connector-based
  expansion, coverage endpoint, honest partial answers, field-level rights, quality targets and sample sizes.
- **The Word memo supplies the guardrails**: contract traps (Smarty's no-competing-dataset clause and tail, Lob's
  internal-only results), clean-room provenance enforced in CI, stable IDs with lineage, evidence fusion that doesn't
  double count one county record, the proof ladder, the protected-person path, cost discipline.
- **Neither read the code.** The memo's cost model assumes "Lob checks" and Smarty autocomplete/rooftop (the app uses
  Mapbox for autocomplete and Lob only for mail). The PDF leaves Lob's printing out, which is all Lob does here.
  Neither saw that Google CASS is already in the request, that production has no address keys, or that Supabase Free
  (500 MB) can't hold national data.

## 3. Combined nationwide design

| Piece | Replacement | Owned? |
|---|---|---|
| USPS "can mail arrive" check | Google's USPS (CASS) answer already requested; a USPS AMS license ($7,570/yr, runs on our server) once checks pass ~40k/month | Rented from USPS; can't be owned |
| Address exists, units, home/business | National address record: NAD, Overture, OpenAddresses (license-checked), state and county address points; USACE NSI and county land use for home/business; proven units from redeemed postcards | Owned |
| Property facts | Statewide and county assessor files (see the county survey), NSI estimates labeled as estimates, household entries for bedrooms/baths | Owned |
| Value and trend | FHFA ZIP5/tract price index (free) plus our own estimate where sale prices are public and assessed values are near market; non-disclosure states (TX, UT, ID, NM, KS, MO) show assessed value and trend only | Owned or public |
| Postcards | Lob per piece plus a backup vendor behind the existing mail-provider switch; fewer postcards via the proof ladder; returned/re-routed cards fail | Rented per piece |
| Verified households and proven units | Already ours (HomeOccupancy, postcard outcomes) | Owned |

How it runs: GitHub Actions jobs per state (like `.github/workflows/places-index.yml`, free on a public repo) build
versioned shard files into **private** object storage; release gates (row counts, ID retention >= 99.5%, golden-set
metrics) and rollback to the previous release; the backend range-reads shards like `backend/services/plans/placesIndex.js`
and copies facts onto the Home at create time (existing columns + `niche_data`), refreshing in the background.
National data never goes into Supabase. Never seed the record from Smarty, ATTOM or Google output; every fact carries
source, date and license scope.

Experience: Add Home drops Smarty (up to 2.5 s) and the ATTOM prefill (up to 10 s) from the critical path; the "Your
home" card renders from the stored copy; gaps are said plainly; household corrections are kept beside the source.

Guardrails: owner names stay out of the record; OSM data stays out (ODbL); takedown path for protected people (NJ
Daniel's Law) and a no-mail path for address-confidentiality participants; respect state commercial-use rules
(Washington owner-name lists, Arizona declarations) and per-source licenses (King County no redistribution, SanGIS).

| Phase | Work | Done when |
|---|---|---|
| 1 | Make Smarty unnecessary (Google CASS answers) and keep Google content within its terms | Add Home works with only a Google key |
| 2 | National address and building baseline | Coverage map by county; top-5 match >= 98% on a stratified golden set |
| 3 | Assessor connectors: statewide files first, then counties by user demand; agents draft field maps, CI checks, founder approves | Per-field fill rates published; cancel ATTOM when satisfied |
| 4 | Value estimate and trend | Error measured on held-out sales |
| 5 | Mail: backup vendor, failed returns/re-routes, fewer postcards | Postcards per verification measured |

## 4. Is it impossible?

No. All three subscriptions can end. What stays external: USPS's delivery database (license only, 39 U.S.C. § 412),
printing and postage, and national deed/mortgage/lien history (not used today; Record Watch's deed half was never
built). Free public data covers building facts for about 56% of Americans (22% including bedrooms or baths); see the
county survey.

## 5. Open decisions and next steps

Founder decisions:
1. **How to fill counties with no free bulk data** (about 36% of Americans, plus about 6% where the county sells it): households enter facts plus labeled
   national estimates (my recommendation now), public-records requests county by county (price them for the largest
   uncovered counties: `uncovered-counties-2026-11-05.csv`), or buying reseller files / a national parcel license
   (a subscription again).
2. **Phase 1 go-ahead** (backend only, web/iOS/Android unchanged). Two parts change a verification rule and need an
   explicit yes: what happens when Google is down, and what happens when Google leaves the home-or-business flag blank
   (section 6).
3. Founder-only facts: any Smarty account or signed agreement; ATTOM plan and license (trial or paid, retention and
   exit purge); which Google billing SKU CASS requests use; a private storage account for the national record; Lob
   live key and real return address.

Research done in the second pass (Nov 5, evening): all 150 largest counties classified, the unopened sample files
checked, and every re-published or known-dataset row confirmed at the county or state source (see the survey's
"Second pass" section).

Research left (no founder action needed unless marked):
- License terms for each free source before use (Will County and KGIS forbid redistribution; Stanislaus is own-use only).
- Spokane WA's free parcel files sit behind Washington's commercial-use attestation: opening them needs the founder's OK.
- Cobb GA's free tabular file (county FTP) and Medina OH's CAMA file (site certificate expired) are still unopened.
- Northampton PA and Madison VA rest on re-published copies; no county file was found.
- North Carolina's statewide building layer mixes county parcel data with model estimates; only the parcel-derived
  share should count as county facts.
- Per-state inventory of statewide files beyond those found.

## 6. Plans written down for the founder's decisions (Nov 5, evening)

Asked in chat on Nov 5 (~22:00 UTC); nothing below is approved or started.

### Phase 1: Smarty no longer needed (backend only)

What changes, in plain words:
- The server stops calling Smarty. It reads the USPS answers Google already returns with every address check
  (deliverable or not, vacant, mail-drop store, PO box, unit needed, carrier route) and Google's home-or-business flag.
- Add Home loses one wait of up to 2.5 seconds (`pipelineService.js:397`, `:434`).
- Every refusal stays: undeliverable, business, mail-drop store, PO box, missing unit, conflicts.
- Web, iOS and Android screens do not change. Production still needs the founder's Google key to work at all.
- Google's data is kept only as its terms allow (details in the build plan).

Two rule changes that need the founder's explicit yes (recommended yes to both):
- **Google down.** Today the check returns SERVICE_ERROR (`addressDecisionEngine.js:206`, `:478`) and Home create
  answers 503 (`routes/home.js:1060`). Proposed: let the person finish Add Home; the home stays unverified, no postcard
  is mailed and nothing unlocks until a background re-check passes; if the re-check fails, ask them to fix the address.
- **Home-or-business flag blank.** Smarty usually filled it (`addressDecisionEngine.js:331`). When Google leaves it
  blank, the business check uses map place types and parcel type, the rule already used for Smarty's "unknown". A
  business with no other business signal could then be added as a home; mail proof is still required.

Done when: Add Home works with only a Google key, checked on web, iOS and Android against a local backend.

### Decision 1: counties with no free bulk data (recommended plan)

- Nationwide floor: building size, stories and age from the national structure inventory (USACE NSI) and Census
  neighborhood figures (ACS), always labeled "estimate", never shown as the county's record.
- Households enter or correct bedrooms, baths and other facts; each entry is kept beside the county value with who and
  when, and verified households' entries count for more.
- Research only, no money: price public-records requests for the 20 largest uncovered counties
  (`uncovered-counties-2026-11-05.csv` already lists the prices found).
- Not recommended: reseller files or a national license (a subscription again; their licenses usually forbid showing
  the data to users).
- Before any build: a plain-words plan of what people see on Add Home, Place and Property details on web, iOS and
  Android, for the founder's OK.

### Founder-only facts

Smarty account or agreement; ATTOM plan and license terms; the Google billing SKU for USPS (CASS) checks and the
production key; a private storage account for the national data files; Lob live key and return address; whether to
accept Washington's commercial-use attestation to open Spokane's free files.

### Sources

Every link checked in the second pass, with what it holds and its terms caveat:
[property-data-sources-2026-11-05.csv](property-data-sources-2026-11-05.csv). First-pass rows name their publisher in
the survey table.
