# Place Intelligence — Implementation Plan (Web + Backend)

> Written 2026-06-11 against the audit of the current codebase. Companion docs in this
> directory: `pantopus-product-design-doc.md` (product model, trust ladder, gating matrix),
> `place-intelligence-step1-inventory-and-contract.md` (data inventory + section contract),
> `address anchored features/` (22 designed mobile screens the web mirrors).
>
> Scope: **web app (`frontend/apps/web`) + backend (`backend/`)**. Mobile is out of scope for now.
> Workflow: one feature branch (`claude/<slug>`) + PR per phase. Targeted tests only.

---

## Where we are (audited 2026-06-11)

**Done and wired end-to-end:**
- Backend orchestrator `services/placeIntelligenceService.js` + `GET /api/homes/:id/intelligence`
  (section envelope: `status / as_of / source / coverage / unavailable_reason / data`; band × tier gating;
  T1/T3/T4 from occupancy verification).
- Anonymous T0 preview `GET /api/public/place` (`routes/public.js`, `previewLimiter`).
- Live sections: weather, air_quality, alerts (NOAA/AirNow), flood (FEMA), census_context,
  block_density (k-anon buckets), bill_benchmark (≥10-household floor). `your_home` (ATTOM) wired but dark (no key).
- Claim → postcard verify (Lob) → T4; neighbor messaging (T4-only, geohash-6 block, template-only, weekly cap).
- Web: `/start` funnel (hero → autocomplete → T0 preview → soft wall → sessionStorage stash → post-signup save),
  `/app/place` dashboard + 7 detail pages, verify prompt/success, message compose/received, switcher, pulse stream,
  non-US "coming to your region". ~21/22 designed screens have counterparts.

**The 17-section launch set** (`serializers/placeIntelligenceSerializer.js` → `PLACE_SECTION_META`); 8 return
`BUILD_PENDING`: sunrise_sunset, lead_radon, drinking_water, environmental_hazards, incentives, rent_band,
civic_districts, civic_election.

**Key gaps:** residency letter is client-side `document.write` (not server-attested); no `?sections=` subset;
homePrivacy toggles not consulted by intelligence; ATTOM dark; zero tests on the `/start` funnel; dashboard is a
mobile column on desktop.

---

## Phase 0 — Contract completion ✅ DONE (2026-06-11, branch `claude/place-phase0-contract-completion`)

> Shipped: `?sections=` subset (route validation + composer subsetting), homePrivacy integration
> (`services/homePrivacyService.js` shared by route + intelligence; `address_precision` strips the unit from the
> place ref; other 8 toggles documented as not applying to this member-only payload), `PlaceSectionCache`
> (migration 156 + `services/placeSectionCache.js` read-through with stale-serve + missing-table passthrough),
> optional `sections` param on the web api client. Drive-by fixes verified end-to-end: FEMA NFHL URL was stale
> (`/gis/nfhl/rest` → `/arcgis/rest`) — flood section now returns real zones; Census ACS now REQUIRES a key
> (set `CENSUS_API_KEY`, free signup) — clear log + graceful degradation without it.
> Verified e2e on a local Supabase stack (auth → claim → T3/T4 → live NOAA/FEMA/ATTOM/density/benchmark data)
> and against the hosted dev DB. ⚠️ Dev DB is missing migrations 153/154/155/156 — apply via SQL editor.

**0.1 `?sections=` subset support** on `GET /homes/:id/intelligence`.
Parse the param in `routes/placeIntelligence.js`, validate against `PLACE_SECTION_IDS`, compose only requested
sections (others omitted, not `unavailable`). Lets detail pages and the pulse refresh cheaply.
Tests: extend `tests/placeIntelligence.endpoint.test.js`.

**0.2 homePrivacy integration.** `placeIntelligenceService` consults the 9 toggles (migration 153):
at minimum `address_precision` (coarsen the address ref in the payload) and the Documents group
(gates the identity/letters section). Document which toggles intentionally do NOT affect intelligence.
Tests: unit tests on the composer with toggles set.

**0.3 Generic per-section cache.** Today only ATTOM (30d) and neighborhood profile (90d) cache.
Add `place_section_cache` migration (home_id/geo key, section_id, payload JSONB, fetched_at, expires_at) +
a tiny read-through helper, so every Phase 2–4 adapter gets TTL caching for free. TTLs per the Step-1 doc
(environment ~10–30 min, density 15 min, benchmark 6 h, property 30 d, census/flood 90 d).

*Effort: small. No product decisions needed. Dependency for Phases 2–4.*

---

## Phase 1 — Server-attested residency letter (#11) ✅ DONE (2026-06-11, on `feature/place-web`)

> Shipped: migration 157 `ResidencyLetter` (frozen printed facts + exact PDF base64 + sha256 + unguessable
> letter_code, issued/revoked lifecycle), `services/residencyLetterService.js` (pdfkit render, ~78-bit codes,
> issuer-scoped privacy — household members never see each other's letters), routes
> `POST/GET /api/homes/:id/residency-letters[, /:letterId/pdf, /:letterId/revoke]` (T4 gate: verified occupancy
> required — unverified owners cannot issue) + public `GET /api/public/residency-letters/:code` (previewLimiter,
> uniform {valid:false}), 10/day issue limiter. Web: IdentityDetail issues real letters (download exact PDF,
> mail-a-copy includes the code, revoke, history list), new public `/verify-residency[/[code]]` checker page
> (active=green / revoked=amber / unknown=neutral). Verified end-to-end through the real UI (login → issue →
> list → verify page) and curl (hash-identical download, revoke kills verification, T3 blocked 403).
> Deferred to later: Lob-mailed physical letter, QR code on the PDF, notarized variant (gated).

Today "Generate a residency letter" prints browser-built HTML (`IdentityDetail.tsx`) — not verifiable.

**Backend:**
- Migration `residency_letters`: id, home_id, user_id, purpose, letter_code (public verification code),
  status (issued/revoked), issued_at, pdf_sha256, lob_letter_id (nullable).
- `services/residencyLetterService.js`: T4 gate (verified occupancy via existing access check), renders a PDF
  server-side (letterhead, verified address, resident name, issue date, letter_code + QR/URL), stores the record.
- Routes: `POST /api/homes/:id/residency-letters` (create), `GET /api/homes/:id/residency-letters` (history),
  `GET /api/homes/:id/residency-letters/:id/pdf` (download), and **public**
  `GET /api/public/residency-letters/:code/verify` → {valid, issued_at, address line masked} — this is what makes
  the letter mean something to a third party.
- Optional v1.1: Lob-mailed physical letter (Lob is already integrated for postcards).
- Respect the per-home Documents privacy group (ties into 0.2).

**Web:** `IdentityDetail.tsx` calls the API: purpose field → issue → download PDF + history list; drop `document.write`.

**Tests:** backend endpoint tests (T3 denied, T4 issued, code verifies, revoked code fails); frontend component test.

*Effort: medium. Depends on 0.2 only loosely. Decisions: letterhead copy + whether v1 includes Lob mail (recommend: PDF-only v1).*

---

## Phase 2 — Fill the Band-A data sections ✅ MOSTLY DONE (2026-06-11, on `feature/place-web`)

> Shipped 5 of 8 + the slug fold: **sunrise_sunset** (Open-Meteo, 6 h cache), **lead_radon** (migration 158
> `CountyRadonZone` — EPA 1993 radon zones joined to 2020 county FIPS, 3,128 counties + year-built lead screening),
> **rent_band** (migration 158 `HudFmr` — HUD FY2026 FMRs, 3,223 counties, NE town lo/hi folded), **drinking_water**
> (EPA SDWIS via data.epa.gov dmapservice — county CWS, city-name match then largest, health violations last 5 y,
> 90 d cache), **environmental_hazards** (EPA ECHO get_facilities, 1 mi radius, 90 d cache — wired to the documented
> contract but ECHO **blocks this dev network's IP**; verify from the deployed server). All ride the Phase-0
> `PlaceSectionCache` via `services/placeSectionAdapters.js`; county FIPS comes from the Census geocoder, cached
> 90 d per home. Web: `health_environment` now folds into the **Risk & readiness** page (lead/radon, drinking water,
> EPA facilities cards + dashboard tap-through). Verified live: Camas home → sunrise 5:19 AM/sunset 8:58 PM, built
> 1972 → lead possible + radon zone 1, CAMAS MUNICIPAL WATER (0 violations), 3BR FMR $2,619–$3,143.
> **Still pending:** `incentives` (DSIRE API is license-gated — needs a license or a different source; curated
> federal copy would rot post-OBBBA), civic pair (Phase 3). NOTE: Census ACS now requires `CENSUS_API_KEY` and the
> radon/FMR joins miss ~14 renamed counties (CT planning regions, old AK areas) — they degrade gracefully.

Each is an adapter implementing the existing `fetchSection(home) → envelope` pattern + cache (0.3) + targeted tests.
The frontend detail pages already render these sections — they light up with zero client change. Order by effort:

1. **sunrise_sunset** — Open-Meteo daily (already a provider: `context/providers/openMeteo.js`) or computed from lat/lng. Trivial.
2. **rent_band** — HUD Fair Market Rents: annual static dataset by metro/county/ZIP. Import as a lookup table
   (migration `hud_fmr`) + yearly refresh script. No API key, no runtime dependency.
3. **lead_radon** — EPA radon zone by county (static dataset → lookup table) + lead-paint disclosure rule keyed on
   `year_built` (from ATTOM when lit, else "unknown year" copy).
4. **incentives** — DSIRE by state (+ federal staples like 25C/25D). Start with a curated state-level dataset; live
   DSIRE API later. Coverage-honest copy.
5. **drinking_water** — EPA SDWIS: nearest community water system by county → violations summary. API is clunky;
   cache 90 d.
6. **environmental_hazards** — EPA FRS/ECHO facilities within radius of lat/lng → count + nearest categories. Cache 90 d.

Also reconcile one frontend mismatch: backend groups lead_radon/drinking_water/environmental_hazards under
`health_environment`, which has **no detail slug** on web (cards don't tap through; RiskDetail renders some of them).
Decide: give health_environment its own detail page or fold into Risk — small `sections.ts` change.

*Effort: each adapter is small-to-medium; the phase is parallelizable. Ship one PR per 2–3 adapters.*

---

## Phase 3 — Civic ✅ DONE (2026-06-11, on `feature/place-web`)

> **civic_districts** is live and KEYLESS: the Census Bureau geocoder (`layers=all`) returns the full elected
> ladder per point — U.S. House (rendered "Washington's 3rd District"), State Senate/House, county, city, school
> district — cached 90 d per geohash-6; `representatives` ships empty per the contract (companion source later).
> **civic_election** is wired to Google Civic (`/elections`, state-matched via ocdDivisionId, 1 d cache by state)
> but key-gated: the Google Cloud project doesn't have the Civic Information API enabled (probed: 403). To light it
> up: enable "Google Civic Information API" on the existing project + set `GOOGLE_CIVIC_API_KEY`. Until then the
> section renders the designed off-season state ("No upcoming election"). polling_place/ballot (voterInfoQuery)
> land with the key. Verified live: Camas home → all 6 districts + graceful election state in CivicDetail.
>
> **Representatives added 2026-06-11 (keyless):** federal seats from the canonical
> `unitedstates/congress-legislators` dataset (reduced per-state index, 7 d cache) and state legislators from
> OpenStates' published current-people CSVs (`data.openstates.org/people/current/{state}.csv`, 7 d cache) —
> matched on the geocoder's CD / SLDU / SLDL codes (leading-zero-tolerant). Verified live: Camas → Gluesenkamp
> Perez + Cantwell + Murray (with phones) and LD-17's Stuebe / Waters / Harris (with emails). City/county
> officials have no national source — the list is honestly partial at the local level.

- **civic_districts**: Google Civic Information API — **verify current API status first** (representatives endpoint was
  deprecated; districts/divisions still live). Fallback: Cicero (paid) or OpenStates (state level). Cache 90 d.
- **civic_election**: Google Civic elections endpoint / Democracy Works TurboVote for upcoming elections + polling info.
  Ragged coverage → the envelope's `coverage: partial` + honest empty copy (already designed in CivicDetail).
- Migration: reuse `place_section_cache`. Env keys: `GOOGLE_CIVIC_API_KEY`.

*Effort: medium. Decision: paid fallback or state-level-only if Google coverage is insufficient.*

---

## Phase 4 — Risk completion ✅ DONE (2026-06-11, on `feature/place-web`)

> Contract extended with two new section ids (TS + backend serializer): **seismic** — USGS design-maps service
> (ASCE 7-22, keyless) returns the point's Seismic Design Category (Camas → **D**, SDS 0.67, Cascadia checks out);
> **wildfire** — USFS Wildfire Hazard Potential 2023 classified raster via the geoplatform.gov ImageServer
> identify (keyless; geometry needs embedded wkid:4326; classes 1–5 + non-burnable/water → `burnable:false`).
> Both cached 180 d (multi-year data vintages). Risk detail's "coming soon" rows replaced with real cards;
> dashboard cards show Design-category / hazard chips. ALSO: the Today sun arc now plots the sun's REAL position
> (daylight fraction elapsed, parametrized on the arc's true ellipse; pre-dawn/after-dark states). Emergency-plan
> stays the informational checklist (liability stance unchanged). Verified live end-to-end.

- **seismic** — USGS NSHM hazard value at lat/lng → qualitative band (the current "Cascadia" copy is editorial; replace
  with per-address data).
- **wildfire** — USFS Wildfire Hazard Potential raster/tile lookup → band. (First Street is the paid upgrade; not v1.)
- Extend the `risk_readiness` group data shape; RiskDetail already has the layout pattern.
- **Emergency plan upgrade** (routes/shelters/go-bag): liability-sensitive → keep manual form, add source-cited
  informational links only. Defer anything resembling auto-generated evacuation advice.

*Effort: medium (raster lookups are the fiddly part).*

---

## Phase 5 — Money & valuation completion ✅ DONE (2026-06-11, on `feature/place-web`) — within key limits

> **ATTOM is live** (key set; cache + on-open fetch already built) and a real matching bug is fixed: address1 sent
> the full geocoder-formatted string ("…Court, Camas, Washington 98607, United States"), which can never match —
> now the street segment only. ⚠️ The current key is a **trial** (sample coverage: the White House matches, most
> addresses don't) — full property/valuation data needs the paid plan (your ATTOM budget decision).
> **Sales trend**: ATTOM retired raw-ZIP geoids; /salestrend now needs their v4 hashed geoIdV4 (from property
> responses / the v4 lookup) — wire when the paid plan lands; degrades gracefully meanwhile.
> **Tax appeal (#2)**: AssessmentCard now carries the informational layer — assessment vs market estimate (±5%
> in-line band, "above market is the usual basis for an appeal") + how-appeals-work education. No savings claims,
> no advice (the legal gate). **Equity**: stays the implemented device-local private input — that privacy stance
> ("only the resident can see") is deliberate in the codebase; server-side persistence reversed it for little gain.

## Phase 7 status — funnel tests ✅ LEAN PASS DONE (2026-06-11)

> `tests/startFunnel.test.tsx` (6 tests): hero CTA gating, T0 preview (free subset + locked teasers + wall +
> register routing + sessionStorage stash), non-US region branch, lookup-error retry, AddressAutocomplete
> (debounce → suggestions → keyboard selection; edit-after-select clears). Playwright e2e intentionally skipped
> per the "don't over-invest in tests" guidance — the Jest layer covers the funnel logic.

1. **ATTOM enablement** — set `ATTOM_API_KEY`, define budget policy: fetch only on dashboard/home-detail open,
   30-day property cache (already built: `AttomPropertyCache`), AVM tier decision (paid add-on; fall back to assessor
   totals — fallback already coded). Feature-flag so cost is controllable.
2. **Equity** — needs a mortgage balance. Decision: keep the current device-only input (private, zero backend) or add
   a server field (Home → Bills "mortgage" type) so equity appears in the valuation envelope and survives devices.
   Recommend: server-side optional field, encrypted-at-rest semantics same as other bills.
3. **Sales trend** — ATTOM `/salestrend/snapshot` by ZIP into `money_signals`/valuation data.
4. **Tax appeal (informational only, #2)** — assessment vs ZIP comps + "how appeals work in your county" copy.
   No savings claims (legal gate per the inventory doc). Ship as a subsection of YourHomeDetail/MoneyDetail.
5. Insurance (#8)/energy (#9): stay deferred (regulated/partner-gated); BillBenchmark remains the peer-proxy angle.

*Effort: small-medium code; the real items are the ATTOM contract/budget and the equity decision.*

---

## Phase 6 — Web design upgrade ✅ CORE DONE (2026-06-11, on `feature/place-web`)

> Shipped: **desktop-grade Place surface** — new `PlaceShell` + `PlaceNavRail`: at lg+ a persistent left section
> rail (Overview / Today / Your home / Risk / Block / Money / Civic / Identity / Pulse) beside a wider (760px)
> content column, shared by the dashboard, all 7 detail pages, and the pulse stream — dashboard ⇄ detail is one
> click, the back chevron hides at lg (in-page leaves keep it). Group cards pair up **2-across at lg** (lone/odd
> cards span the row — pure CSS, mobile stack untouched). Motion: staggered dashboard group entrance, staged
> VerifiedSuccess reveal (seal → heading → Band-D rows → CTA), all `motion-safe` so reduced-motion stays static.
> /start: wider at sm+, larger hero type, preview fade-in, wall bar gets safe-area inset + rounded/shadow top,
> and the preview inherits the 2-up grid. A11y: skeletons announce via role=status + sr-only, truncated addresses
> get title tooltips. Drive-by: ECHO adapter now does the documented two-step (get_facilities count → get_qid
> rows) and refuses to cache half-payloads (count>0 with no rows throws → stale/error).
> Verified in the preview browser at 1440px (rail + grids + one-click section nav) and 375px (designed mobile
> experience unchanged); the /start anonymous funnel re-verified end-to-end with live FEMA + density data.
> Remaining polish (not blocking): contrast audit on muted tokens, /start designed-Preview hero-stat treatment.

1. **Desktop-grade dashboard layout**: keep the single column ≤`md`; at `lg+` go two-column — left rail (header,
   Today hero, verify nudge/identity) + right sections grid; raise max width from 640px (~960–1100px).
2. **Detail pages**: persistent left section nav at `lg+` (dashboard ⇄ detail without full-page jumps); mobile keeps
   the current stacked pages.
3. **/start preview**: bring the hierarchy of the designed `Place - Preview` screen (hero stat treatment, grouped
   free sections, stronger locked-card teasers) instead of the flat list; sticky wall stays.
4. **Motion**: verify-success reveal (staged Band-D rows), sheet enter/exit easing, subtle hero→pulse transition.
5. **A11y pass**: contrast check on `app-text-secondary`/`muted` tokens, SR text for skeletons, `title` on truncated
   addresses, safe-area inset on bottom sheets/wall bar, 320px viewport check.
6. **Resilience**: fetch timeout (~6 s) → error card with retry; batch primaryHome+myHomes queries.

*Effort: medium-large. Pure frontend; can run in parallel with Phases 2–5. Use `colors_and_type.css` + the HTML
screens in `reference/address anchored features/` as the source of visual truth, adapted to web tokens.*

---

## Phase 7 — Test coverage & hardening (interleave with each phase; this closes the rest)

- **Jest (web)**: StartFunnel (hero → preview → wall → region branch), AddressAutocomplete (debounce/keyboard/abort),
  PlaceDashboard container (auth gate, tier rendering), VerifiedSuccess, PendingPlaceSaver (stash → create).
- **Playwright e2e**: `/start` → preview → register → place saved → dashboard (the acquisition path has zero coverage today).
- **Backend**: `GET /api/public/place` contract + rate-limit test; neighbor-message weekly-cap test; `?sections=`;
  privacy-toggle composition; residency-letter lifecycle.

---

## Caching model ✅ AUDITED + HARDENED (2026-06-11) — database-first everywhere

> Rule implemented across the stack: **fresh DB row → serve; expired → call API; API down → serve the expired
> row (stale envelope); permanent data → effectively never refetched.** Decisions made:
> - **Permanent**: claimed homes' lat/lng (Home row, since claim); tract/county assignment (changes only at the
>   decennial census — `_tract` per ~150 m cell + `_county_fips` per home, 365 d safety valve); CountyRadonZone
>   (1993 dataset, static seed); HudFmr (annual re-import).
> - **Periodic + stale-fallback** (PlaceSectionCache `readThrough`): sunrise 6 h · election 1 d · drinking water,
>   hazards, districts, flood, census teaser 90 d · seismic/wildfire 180 d · congress/state legislators 7 d.
> - **ATTOM** (the paid one): fresh 30 d; on API failure/no-result an EXPIRED real-ATTOM row now serves as a
>   `stale` envelope (database-first), and home-row fallback profiles cache only 1 DAY so an outage can't shadow
>   real data for a month.
> - **Neighborhood profile** (census+flood+walkscore): profiles missing census or flood now cache 1 day instead
>   of 90 (a keyless-census profile no longer hides ACS data for a quarter once the key lands); total provider
>   failure serves the expired profile; the tract geocode no longer re-runs on every call.
> - **Weather** (Open-Meteo): on API failure a ≤6 h-old expired snapshot serves as `cache_stale`. **Alerts are
>   the deliberate exception — never served stale** (an expired warning must not reappear).
> - **Anonymous T0 preview**: flood + census teaser now persist in the shared geohash-keyed PlaceSectionCache
>   (facts about land — survives restarts, shared across instances) with in-memory L1 on top. **The typed
>   address and its geocode still never touch the database** — that's both the §4 anti-leak promise and Mapbox's
>   temporary-result ToS (persisting geocodes requires their paid permanent endpoint). Searched-address geocodes
>   are the ONE thing deliberately not stored.
> No new tables needed — PlaceSectionCache (migration 156) carries all of it.
> Verified end-to-end: preview survives restart with zero FEMA re-calls (fetched_at unchanged); ATTOM outage
> simulation served the expired row as `your_home | stale | 585000` through the full HTTP stack; partial profile
> wrote a 1-day TTL row. Targeted suites 27/27.

## Phase 8 — Deferred (tracked, not scheduled)

| Item | Why deferred |
|---|---|
| T2 "Located" tier / global approximate-location discovery | Product decision (design doc §5 Option B) |
| Commute times | Needs routing API (Google/Mapbox/OSRM) — paid |
| Allergen / trash pickup / power outage | Paid or fragmented per-municipality sources |
| Permits / development (#6) | Per-municipality; pilot metros later |
| Notarized letter, portable verified-ID (#10) | Partner/regulatory gated |
| Insurance (#8) / energy rates (#9) beyond benchmark | Carrier partners / compliance |

## Open product decisions (block nothing in Phases 0–2; needed by 3/5/6)

1. Dashboard naming ("Your Place" vs "Home") — affects web copy in Phase 6.
2. ATTOM budget + AVM tier — Phase 5.
3. Civic fallback provider if Google coverage disappoints — Phase 3.
4. Equity: device-only vs server-side mortgage field — Phase 5 (recommend server-side).
5. health_environment detail page vs fold into Risk — Phase 2 (recommend fold into Risk).

## Suggested execution order

```
PR 1: Phase 0 (sections param + privacy toggles + section cache)
PR 2: Phase 1 (residency letter, PDF-only v1)
PR 3: Phase 2a (sunrise_sunset, rent_band, lead_radon) + slug reconciliation
PR 4: Phase 2b (incentives, drinking_water, environmental_hazards)
PR 5: Phase 6 (web design upgrade)            ← can start any time, parallel track
PR 6: Phase 3 (civic)
PR 7: Phase 4 (seismic, wildfire)
PR 8: Phase 5 (ATTOM live, equity, sales trend, tax-appeal info)
PR 9: Phase 7 leftovers (e2e funnel test if not landed earlier)
```
