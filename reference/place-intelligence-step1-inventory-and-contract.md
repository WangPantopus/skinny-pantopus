# Place Intelligence — Step 1: Data-Truth Inventory & Aggregate Contract

> **What this is:** the grounded foundation for surfacing the 13-feature list. Part 1 is a field-by-field map of what data is actually live in the repo today vs. needs a key / new integration / a legal-partner gate. Part 2 is the unified read model the redesigned screens will consume. **What this is *not* (yet):** screen designs, the shared archetype spec, or Claude Code prompts — those are Step 2 and Step 3, and they read off this contract.
>
> **Order of operations:** finalize this contract → screen + archetype spec (parity-first) → sequenced build prompts. Doing it in this order is what keeps the surfacing from becoming a pile of bespoke fetches.

---

## Part 1 — Data-truth inventory

**Status legend**

- 🟢 **LIVE** — wired and working now (keyless, or free key already expected)
- 🟡 **KEY** — wired in code, dark until an env key / paid plan is set
- 🟠 **BUILD** — no source in the repo; a real integration is needed
- 🔴 **GATED** — blocked on legal / partner / abuse review; UI is moot until cleared

Grouped by the section it will land in on the dashboard. "Powers" = which of the 13 features it serves.

### Property facts

| Field | Powers | Status | Source | Lives in / consumer today | Notes |
|---|---|---|---|---|---|
| year_built, sqft, beds, baths, lot_sqft, property_type | #1 | 🟡 KEY | ATTOM `/property/detail` | `propertyIntelligenceService.js` → add-home autofill + `GET /homes/:id/property-details` | `ATTOM_API_KEY`. Paid per-call. Raw + normalized cache, 30-day TTL. Facts change ~annually — **do not** daily-refresh. |
| median_year_built, total_population, total_housing_units (tract) | #1 context | 🟢 LIVE | Census ACS 5-yr | `neighborhoodProfileService.js` → Pulse | `CENSUS_API_KEY` optional (raises rate limit only). 90-day cache. Tract-level, not the specific home. |

### Valuation

| Field | Powers | Status | Source | Lives in / consumer today | Notes |
|---|---|---|---|---|---|
| estimated_value, value_range_low/high, value_confidence | #1, #7 | 🟡 KEY | ATTOM `/attomavm/detail` | `propertyIntelligenceService.js` → Pulse | AVM is a **paid ATTOM add-on tier**. Falls back to assessor market/assessed totals when AVM absent. ATTOM **display ToS** applies. |
| assessed_value, market_value, (assessment history) | #2 (input), #7 | 🟡 KEY | ATTOM `/property/detail` assessment | same | History depth varies by county. This is the *input* to a tax-appeal view, not the appeal logic. |
| zip_median_value, sales_trend (median vs prev) | #1, #7 | 🟡 KEY | ATTOM `/salestrend/snapshot` | same | Keyed by ZIP geoid. |
| median_home_value, median_household_income (tract) | #7 context | 🟢 LIVE | Census ACS | `neighborhoodProfileService.js` | Free. Neighborhood context for the value graph. |
| equity | #7 | 🟠 BUILD | derived | — | Needs a user-entered mortgage balance. Home pillar has bills/maintenance but no mortgage field yet. |

### Risk

| Field | Powers | Status | Source | Lives in / consumer today | Notes |
|---|---|---|---|---|---|
| flood_zone + description | #1, #3 | 🟢 LIVE | FEMA NFHL MapServer | `neighborhoodProfileService.js` → Pulse | **Keyless.** Live point query, zone→description map already present. Quick win. |
| earthquake / seismic hazard | #3 | 🟠 BUILD | — | only static seasonal text in `seasonalEngine.js` / `neighborhoodFactService.js` | Real source: USGS NSHM / seismic design category. Current "Cascadia" copy is editorial, not per-address data. |
| wildfire / WUI risk | #1, #3 | 🟠 BUILD | — | static seasonal tips only | USFS/Cal Fire WUI layer, or a paid risk API (First Street). Not computed today. |
| emergency_plan (routes / shelters / go-bag) | #3 | 🟠 BUILD | — | `Homes/Emergency` is a **manual info-entry form**, not an auto plan | Liability-sensitive (a wrong evacuation route). Keep informational + source-cited if built. |

### Environment (the daily layer)

| Field | Powers | Status | Source | Lives in / consumer today | Notes |
|---|---|---|---|---|---|
| weather alerts | #4 | 🟢 LIVE | NOAA NWS | `services/external/noaa.js` → Pulse | Keyless. 10-min cache. |
| current weather / forecast | #4 | 🟢 LIVE | Open-Meteo | `context/providers/openMeteo.js` | Keyless. |
| air quality (AQI) | #4 | 🟢 LIVE (free key) | AirNow (EPA) | `services/external/airNow.js` → Pulse | `AIRNOW_API_KEY` is free. 30-min cache. |
| sunrise / sunset | #4 | 🟢 LIVE | derived from lat/lng (or Open-Meteo daily) | — | Trivial. |
| daily briefing (NL summary) | #4 | 🟢 LIVE | template-first + AI polish | `context/briefingComposer.js`, `eveningBriefingService.js` | Well-architected: facts from sources, AI only finishes. |
| allergen / pollen | #4 | 🟠 BUILD | — | — | Ambee / Breezometer (Google) / pollen.com — all **paid**. |
| trash / recycling pickup | #4 | 🟠 BUILD | — | — | Recollect or per-municipal — **fragmented**, no national API. |
| power outage status | #4 | 🟠 BUILD | — | — | No clean national feed; utility-by-utility. |

### Neighborhood / community

| Field | Powers | Status | Source | Lives in / consumer today | Notes |
|---|---|---|---|---|---|
| walk_score, transit_score, bike_score | #1 | 🟡 KEY | Walk Score | `neighborhoodProfileService.js` | `WALKSCORE_API_KEY`. Free tier small; **paid agreement at scale**; attribution/caching limits. |
| block density (verified members within radius) + milestones | #12 | 🟢 LIVE | internal | `jobs/neighborhoodPreviewRefresh.js` → `NeighborhoodPreview` | geohash-6, milestones 10/25/50/100/200/500, anti-spam. **Needs a k-anonymity floor** so low counts can't de-anonymize a single household. |
| neighborhood bill benchmark (vs neighbors) | #8, #9 (UX only) | 🟢 LIVE | internal | `jobs/billBenchmarkRefresh.js` → `BillBenchmark` | geohash-6 + bill_type + month, from paid HomeBill records. **Peer-relative, not market-rate** — a proxy, not an insurance/energy answer. |
| seeded local services / directory | #1 context | 🟢 LIVE | internal | `seededBusinessService.js` → Pulse | Cold-start business counts by category. |
| commute time to saved destinations | #1 | 🟠 BUILD | derived | `savedPlaces` exists; routing does not | Needs a routing/distance-matrix call (Google/Mapbox/OSRM). |

### Civic

| Field | Powers | Status | Source | Lives in / consumer today | Notes |
|---|---|---|---|---|---|
| representatives, polling place, ballot, registration status, local meetings | #5 | 🟠 BUILD | — | only a `'civic'` **category enum** in `ai/schemas.js` + a keyword regex | Sources: Google Civic Info API (**parts deprecated — verify current state before relying on reps**), Cicero, Ballotpedia, Democracy Works / TurboVote, Vote.org. High moat, twice-a-year value. |

### Development

| Field | Powers | Status | Source | Lives in / consumer today | Notes |
|---|---|---|---|---|---|
| permits within radius, zoning changes | #6 | 🟠 BUILD | — | a slot in the place-brief prompt; **no data source** | Per-municipality Accela / Socrata / Tyler portals — fragmented, no national API. Pilot the metros with good open data (Portland-area is one). Never promise national coverage. |

### Identity / letters / messaging / regulated scans

| Field | Powers | Status | Source | Lives in / consumer today | Notes |
|---|---|---|---|---|---|
| verified residency letter (PDF + optional mailed) | #11 | 🟠 BUILD-easy | Lob | `lobWebhook.js` (Lob already wired for address-verification postcards) | Low effort — reuse Lob + verified-address data. Ship as "verified residency letter." |
| notarized variant | #11 | 🔴 GATED | notary partner | — | Remote online notarization is regulated; needs Proof/Notarize. Add after the plain letter. |
| portable verified-address ID (external acceptance) | #10 | 🔴 GATED | partnerships | — | Banks/DMV/schools must accept the attestation. Multi-year platform play, not a feature. North star, not a starting point. |
| verified message to an address | #13 | 🔴 GATED | abuse / T&S review | chat + mailbox + Lob make *delivery* feasible | Highest-risk item on the list (harassment/stalking/doxxing vector). Template-only v1, hard rate limits, recipient block, server-side identity retained, explicit T&S gate. |
| tax-appeal flag + savings estimate | #2 | 🔴 GATED | legal framing | ATTOM gives the assessment input | "$X over comps → save $Y" is a financial representation. Ship as informational ("your assessment vs nearby comps + how appeals work in your county"), never as advice. |
| insurance overpayment vs market | #8 | 🔴 GATED | carrier partners + compliance | `BillBenchmark` gives a peer proxy only | No policy pull, no carrier partners; insurance is regulated. Defer. |
| utility rate / TOU / solar ROI / rebates | #9 | 🟠 BUILD | — | `recomputeUtilityScores` is **feed ranking, not energy** — don't let the name mislead the roadmap | Genability/Arcadia (rates) + OpenEI URDB + DSIRE (incentives). Real but meaningful integration; lower emotional weight. |

### One-line takeaway from Part 1

The **environment layer (#4), flood risk (#3 partial, #1), block density (#12), and the bill benchmark** are effectively live today (mostly keyless). **Property facts + valuation + sales trend (#1, #7)** are wired but dark behind ATTOM keys (and ATTOM is the one real recurring cost). **Civic (#5), permits (#6), the seismic/wildfire/emergency-plan half of #3, allergen/trash/outage, energy (#9)** are genuine new integrations. **Tax appeal (#2), insurance (#8), portable ID (#10), notarized letters, and neighbor messaging (#13)** are gated by legal/partners/abuse — UI is moot until that's cleared. Residency letter (#11) is the lone easy build in the gated cluster.

---

## Part 2 — The aggregate contract: `PlaceIntelligence`

### 2.1 The core decision: one structured read model, separate from the Pulse

There are two complementary shapes off the *same* provider layer, and they should stay separate:

1. **`PlaceIntelligence`** — a **structured, deterministic, sectioned** read model. Every section is a known slot (property, valuation, risk, environment…). This is what the **dashboard** consumes. **(New — this document defines it.)**
2. **`Pulse`** — a **priority-ranked signal stream** ("what's new / what matters today"). Already built in `neighborhoodPulseComposer.compose()` and exposed via `ai.js`. This is what a **feed / "today" surface** consumes.

Don't merge them. The dashboard needs predictable slots that render in a fixed layout; the feed needs ranked, ephemeral signals. They read the same underlying providers (ATTOM, FEMA, NOAA, AirNow, Census, NeighborhoodPreview, BillBenchmark), so the work is a shared **provider layer** with two composers on top.

### 2.2 The endpoint

```
GET /homes/:id/intelligence            # full payload
GET /homes/:id/intelligence?sections=property,valuation,risk   # subset (lazy section load)
```

Sits alongside the existing `GET /homes/:id/property-details`, reuses `checkHomePermission(id, userId)` for access, and resolves lat/lng + Census tract internally from the `Home` row (which already carries address + PostGIS `location` + `niche_data`). One payload per home; multi-home users call it per home.

### 2.3 The section envelope (the heart of the contract)

This generalizes two patterns already in the codebase — the `unavailable_reason` + `source` fields on `/property-details`, and the per-source-null + `source: 'census+walkscore+fema'` shape in `neighborhoodProfileService`. **Every section carries the same envelope:**

```jsonc
{
  "status": "loaded | empty | unavailable | stale | error",
  "as_of": "2026-06-04T12:00:00Z | null",
  "source": [ { "provider": "ATTOM", "fetched_at": "..." } ],
  "coverage": "full | partial | none",
  "unavailable_reason": "PROVIDER_NOT_CONFIGURED | NO_ATTOM_MATCH | NO_FLOOD_POLYGON | OUT_OF_COVERAGE | BUILD_PENDING | null",
  "data": { /* section-specific, or null */ }
}
```

This maps 1:1 onto the client **Loading / Empty / Loaded / Error** state machine. **Design principle: section-level degradation, never all-or-nothing.** A home with no ATTOM match still shows live flood + AQI + density; the property card just renders its own `unavailable` state.

### 2.4 The sections (full shape, day one)

```jsonc
{
  "schema_version": 1,
  "home_id": "...",
  "sections": {

    "property":     { /* envelope */ "data": { "year_built", "sqft", "bedrooms", "bathrooms", "lot_sqft", "property_type" } },        // 🟡 ATTOM
    "valuation":    { /* envelope */ "data": { "estimated_value", "value_range_low", "value_range_high", "value_confidence",
                                               "assessed_value", "market_value", "zip_median_value", "sales_trend_pct",
                                               "equity" /* 🟠 derived */ } },                                                          // 🟡 ATTOM
    "risk":         { /* envelope */ "data": { "flood_zone", "flood_zone_description" /* 🟢 */,
                                               "seismic" /* 🟠 */, "wildfire" /* 🟠 */ } },
    "environment":  { /* envelope */ "data": { "weather", "forecast", "aqi", "alerts", "sunrise", "sunset" /* 🟢 */,
                                               "allergen" /* 🟠 */, "trash_pickup" /* 🟠 */, "outage" /* 🟠 */ } },                     // the daily layer
    "neighborhood": { /* envelope */ "data": { "census" /* 🟢 */, "walk_score", "transit_score", "bike_score" /* 🟡 */,
                                               "density" /* 🟢 */, "bill_benchmark" /* 🟢 */,
                                               "commute" /* 🟠 */ } },
    "civic":        { /* envelope */ "data": null, "status": "unavailable", "unavailable_reason": "BUILD_PENDING" },                    // 🟠 placeholder
    "development":  { /* envelope */ "data": null, "status": "unavailable", "unavailable_reason": "BUILD_PENDING" },                    // 🟠 placeholder
    "documents":    { /* envelope */ "data": { "residency_letter_available": true } }                                                  // 🟠-easy (action, not data)
  },

  "meta": {
    "computed_at": "...",
    "partial_failures": [ { "section": "valuation", "reason": "..." } ],
    "schema_version": 1
  }
}
```

**The architectural payoff:** every section ships in the contract from day one, even when its status is `unavailable` (`PROVIDER_NOT_CONFIGURED` or `BUILD_PENDING`). The client and the shared archetype are built **once** against the full shape. Lighting up a provider — setting `ATTOM_API_KEY`, landing the civic adapter — just flips a section `unavailable → loaded` with **zero client change** on either platform. This is what makes parity affordable.

### 2.5 Visibility / permission

Respect the existing access model (`checkHomePermission` + the 9 per-home privacy toggles in `homePrivacy.js`):

- Whole endpoint gated by home access (owner / household).
- **Owner-or-household only:** `valuation`, `documents`, property-owner detail (sensitive / financial).
- **Any member with home access:** `risk`, `environment`, `neighborhood.density`, `neighborhood.bill_benchmark`, `civic`, `development` — these are aggregate/anonymous, no PII.
- `documents` (residency letter) also respects the per-home Documents privacy group.

### 2.6 "Reorganize the backend," concretely

A new orchestrator — `placeIntelligenceService` — composes the existing services behind one stable interface, rather than each screen calling four services directly:

- **Reuses:** `propertyIntelligenceService` (property + valuation), `neighborhoodProfileService` (census + walk + flood), `external/noaa` + `external/airNow` + `context/providers/openMeteo` (environment), `NeighborhoodPreview` (density), `BillBenchmark` (benchmark), `seededBusinessService` (local services).
- **Adds, as they land:** civic adapter, permits adapter, seismic/wildfire adapters, residency-letter action.
- Each provider implements a common `fetchSection(home) → SectionEnvelope`. The `context/providerInterfaces.js` pattern already exists — extend it rather than inventing a new one.
- Orchestrator owns **parallel fetch** (`Promise.allSettled`, same as `neighborhoodProfileService`) and **per-section caching/TTL**.

**Freshness / TTL (prevents the "updated daily" mistake):**

| Section | TTL | Section | TTL |
|---|---|---|---|
| environment (weather/alerts) | ~10 min | property | 30 days |
| environment (aqi) | ~30 min | valuation | 7–30 days |
| density | ~15 min | neighborhood (census/walk/flood) | 90 days |
| bill_benchmark | ~6 hours | civic / development | per-source |

"Updated daily" in the product copy applies to the **environment layer only**. Property/valuation/risk are long-cached; the UI copy must not imply daily property refresh.

---

## Part 3 — Open decisions this surfaces (needed before screens)

1. **Naming.** `PlaceIntelligence` vs `HomeIntelligence`, and how it reconciles with the existing **"Pulse"** brand — is the dashboard a *new* destination, or "Pulse, evolved"? (Affects copy and IA.)
2. **IA / navigation.** Where does the dashboard live in the tab bar? This forces the open **4-tab-structure decision** (the current bar matches neither documented option). Is it the same surface as **DiscoverHub** (currently on sample data) or a distinct "Your Place" destination?
3. **Hero / section order.** What's the top card — property+value, today's environment, or a floating risk/alert when one is active? The Pulse already computes `overall_status` / signal `priority`; reuse that to float urgent items into the dashboard hero.
4. **ATTOM budget.** ATTOM is the one real recurring cost at dashboard scale. Decide gating: fetch only on home-detail open, cache aggressively, and consider shipping **dashboard v1 on the free layers** (FEMA + NOAA + AirNow + Census + density + benchmark) with ATTOM property/valuation behind a flag.
5. **Coverage honesty.** Civic and permits will have ragged geographic coverage. Decide the empty-state copy now (graceful "not available for your area yet" vs hiding the section).

---

## Part 4 — What Step 1 produces, and the next step

**Step 1 output (this doc):** the inventory (Part 1) + the `PlaceIntelligence` contract (Part 2), plus the decisions to resolve (Part 3).

**Step 2 (next):** the **screen + shared-archetype spec** — a single "ProfileDashboard" archetype (sectioned, card-based, progressively loading) that the dashboard and the #3/#5/#6 surfaces instantiate, specced parity-first against this contract for iOS / Android / web.

**Step 3:** the sequenced **Claude Code prompt playbook** — backend orchestrator + per-section adapters + the two native clients + web, in dependency order, with per-prompt verification.

Recommended immediate move: lock the naming/keying decision (Part 3 #1–#2) and confirm the section list, then I'll produce the Step 2 archetype spec against it.
