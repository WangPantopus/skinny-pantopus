# Current system: every ATTOM, Smarty and Lob call and what depends on it

Re-checked on master [`ffd28e60a1`][master] (November 5, 2026). Line numbers are as of that commit; the links are
pinned to it. This replaces PR #3433's contract audit (master `e49cb33a6a`) and sections 1 and 8 of #3418's design
record (`1c5ddb658c`, `4c0b685efa`); where they differ, this re-check governs. It describes code paths, not hosted
state: which keys production holds, how many vendor copies the hosted database keeps and which store builds people run
were not checked (see "Not checked" at the end).

"Current" means a reachable code path. The free field test in [sourcing.md](sourcing.md) made no ATTOM, Smarty or Lob
calls.

## At a glance

| Vendor | What Pantopus calls | Caller | Longest wait | Where results are kept, and for how long | Production |
|---|---|---|---|---|---|
| ATTOM | Property API `/property/detail`, `/attomavm/detail`, `/salestrend/snapshot` | [`propertyIntelligenceService.js`][pis] 26-28 | 10 s per call (31) | Five copies; property detail forever (65), value and ZIP trend 30 days (30) | Key and trial dates are founder-only facts |
| Smarty | US Street API (one candidate, enhanced match) | [`smartyProvider.js`][smarty] 118-131 | 2.5 s, after Google's 2.5 s ([config][avcfg] 62, 74) | `HomeAddress.validation_raw_response`, reused 90 days ([config][avcfg] 122) | No key since Oct 9 ([NEXT_STEPS][next] 72, 195) |
| Google Address Validation | `validateAddress` with USPS CASS on | [`googleProvider.js`][google] 110 | 2.5 s | `HomeAddress` columns and stored decision inputs, no expiry | No key since Oct 9 |
| Lob | `POST /v1/postcards`; signed delivery webhooks | [`lobMailProvider.js`][lob] 134, 258; [`lobWebhook.js`][lobhook] | Up to 3 attempts with an idempotency key (207) | `HomePostcardCode`, `MailVerificationJob`, `BlockInvite` rows | No key since Oct 9; hosted servers refuse to mail without it ([`mailVendorService.js`][mailvendor] 45-48) |

Shared autocomplete and resolve (`/api/geo/*`) use Mapbox ([`geo/index.js`][geo] 5-15), not Smarty or Lob. Neither
design document the founder supplied saw that.

## ATTOM

### The adapter

[`propertyIntelligenceService.js`][pis] targets ATTOM Property API v1.0.0. A home's street line includes its unit; the
ZIP trend uses `geoid=ZI<ZIP>`.

| Endpoint | What the app reads | Kept |
|---|---|---|
| `/property/detail` | Physical, legal, use, assessment, tax and sale characteristics; feeds prefill, the county record, Place, the house outline, exemption logic and AI context | Forever: `maxAgeMs: Infinity` (65), `ExternalFeedCache.expires_at = 'infinity'` ([`cacheHelper.js`][cache] 178) |
| `/attomavm/detail` | Value, range, confidence, date | 30 days, then asked again (30) |
| `/salestrend/snapshot` | ZIP median sale price now and before; ±2% band gives up/down/flat (454-460) | 30 days |

### Five stored copies

All five are read before ATTOM is asked (database first, the founder's Nov 1 direction,
[`provider-data-persistence-2026-11-01.md`][persist]).

| Copy | Where | Lines |
|---|---|---|
| The Home's own snapshot | `Home.niche_data.attom_property_detail`, written at Home create and on refresh | [`home.js`][home] 1122, 1167; [`pis`][pis] 313-348 |
| Per-home raw responses | `AttomPropertyCache`, 30-day `expires_at`, read past expiry when ATTOM fails | [`pis`][pis] 24, 242-308 |
| Per-address copy for Add Home | `PlaceSectionCache` section `attom_property_detail`, keyed `address:<id>` | [`pis`][pis] 909-955 |
| Shared copy of each ATTOM answer | `ExternalFeedCache`, one row per request, no expiry | [`cacheHelper.js`][cache] 132-192 |
| The built profile | `PropertyIntelligenceCache`, 30 days, served stale when ATTOM is down | [`pis`][pis] 535-590, 844-847 |

The operator prefill script ([`prefill-provider-cache.js`][prefill]) is a sixth call path (dry run by default).

### Who reads it

| Flow | Route and code | What it uses | What a replacement must keep |
|---|---|---|---|
| Add Home prefill | `POST /api/homes/property-suggestions` ([`home.js`][home] 581) → [`propertySuggestionsService.js`][suggest] 161-206: ATTOM tier first, then address heuristics (218), then an optional LLM (238) | Type, bedrooms, baths, size, lot, year built; `tiers_used` and per-field `sources` (`attom`, `heuristic`, `llm`; 130, 182-206, 271-275) | Editable, sourced fields; typed values never overwritten; a blank or a prompt when the dwelling can't be matched |
| Home create | `POST /api/homes` ([`home.js`][home] 1299); copies the server's own per-address record into `niche_data` (1122, 1167). A client-sent `attom_property_detail` is accepted and ignored (148-154) | The whole detail bundle | Never trust a client-sent record; store the server's own copy with its source |
| Property details (verified owners) | `GET /api/homes/:id/property-details` ([`home.js`][home] 1972) → [`homeDetailService.js`][detail] 196-215: non-owners get `OWNER_ONLY` and the Home's own facts (200-203); owners get `county_record` from [`countyRecordSerializer.js`][serializer] plus the legacy ATTOM payload | Every curated path ([evidence/attom-display-contract.csv](evidence/attom-display-contract.csv), 124 entries) in sections (serializer 30) | The owner gate, the section groups, the older client shape; the real source label |
| Place "Your home" | [`placeIntelligenceService.js`][place] 969-1016, under the 3.5 s section budget (619-624, 1394) | Facts, value, trend, household-filled gaps (`household_fields`), the house outline | Role filtering (owners see value; renters don't), household gap-filling, honest empty states |
| Exemption check (owners) | [`exemptionCheckService.js`][exempt] 178, from Place (1339) | Exemption fields and assessed figures | Present, explicitly empty and unknown stay different; uncertainty kept in over-assessment hints |
| Today sky house | [`houseShape.js`][shape] 4-9, 210, via the profile | Building size, stories, roof, parking | The plain-house fallback |
| Home value card | `GET /api/homes/:id/property-value` ([`home.js`][home] 5509-5547) | `estimated_value`, range, confidence, ZIP trend, year built, size, `last_updated`, `source` | See the value mapping and app checks below |
| AI property profile | `GET /api/ai/property-profile` ([`ai.js`][ai] 472-486) | The profile | Same fields, same viewer check |
| Neighborhood Pulse | [`neighborhoodPulseComposer.js`][pulse] 274 | The profile | Same fields |
| Parcel classification in the address check (off) | [`parcelIntelProvider.js`][parcel] 131-160, 231; flags `ENABLE_ADDRESS_PARCEL_PROVIDER` and its enforcement flag, both off ([config][avcfg] 140-141) | Land use, parcel ID, building and unit counts | Advisory only until a precise match and an audited classification exist |
| Owner-name match for claims (off) | [`propertyDataService.js`][propdata] 12-31: `PROPERTY_DATA_PROVIDER` defaults to `none`; ATTOM or CoreLogic, records at most 24 hours old | Owner names | Not replaced: owner names stay out of Pantopus's record; documents and manual review remain |
| Public Place preview | [`public.js`][public] 167-172 | Nothing from ATTOM | Stays provider-free |

### Value fields: three mapping bugs

In `buildProfileFromAttomResponses` ([`pis`][pis] 425-499):

1. `estimated_value` falls back from the AVM to the county's market total and then to the **assessed** total (485), so a
   tax figure can appear as an estimate.
2. `zip_median_value` is the home's own assessed total (489), not a ZIP statistic.
3. The ZIP trend starts as `'flat'` (454) and stays flat when no trend was observed.

Two confidence paths disagree: the profile reads `avm.confidence` (488); the county-record serializer shows
`avm.amount.scr` (serializer 179). The replacement keeps official values, sales, trends and estimates as separately
labeled facts ([architecture.md](architecture.md#7-fact-precedence-field-by-field)).

### How long people wait

On master, a first lookup holds the screen: Add Home waits for property suggestions (up to ATTOM's 10 s), Property
details waits, the Pulse composer and the AI profile wait. Place's Your home card and the exemption check give up after
3.5 s and show a retryable error while the lookup finishes in the background. A value older than 30 days is asked again
before the page answers. "No record" answers are never saved ([`cacheHelper.js`][cache] 132;
[`placeSectionCache.js`][psc] 28-29), so an unknown address is asked on every visit.
Duplicate lookups merge only inside one server process (`responseFlights`, [`cacheHelper.js`][cache] 104).

PR #3439 (session `make-attom-lookups-non-b`, started by the founder; merged and released after this re-check, master
`ec131e91f8`, with Add Home on web #3445 and iOS #3446 merged and Android #3447 open) changes this: screens answer at once from
the database, a missing record is looked up in the background and fills in through the existing `sync:changed` signal,
an empty or failed refresh keeps the last value with its date (`status: stale`), "no record" is remembered for 30 days,
and Add Home gets `?lookup=background` / `?lookup=check` (old store builds keep today's behavior). The replacement
keeps that request pattern ([architecture.md](architecture.md#4-request-path-and-latency)).

### What the apps assume

These are compatibility traps for any change of source:

- **Allowed `source` values.** iOS ([`HomeIntelligenceValidation.swift`][iosval] 8, 48) and Android
  ([`HomeIntelligenceValidation.kt`][andval] 18, 91) drop the whole Home value card unless `source` is one of `cache`,
  `cache_stale`, `attom`, `fallback`, `unavailable`, `last_updated` is a timestamp, confidence is 0-100 and the trend
  is `up`, `down` or `flat`. The server's own Property details check accepts `home`, `cache`, `attom`, `unavailable`
  ([`homeDetailService.js`][detail] 207).
- **"ATTOM" in copy.** iOS and Android Add Home show "Public records (ATTOM)" and "Data from public records via ATTOM."
  when `tiers_used` contains `attom` ([iOS][iosadd] 231-246; [Android][andadd] 260-290), and otherwise "No ATTOM property
  record was returned…" or "…was available…" ([iOS view model][iosvm] 972-981; [Android view model][andvm] 1554-1557).
  Store build 2.0.7 keys this on `attom_property_detail`, not `tiers_used`, so since #3203 it says "No ATTOM…" with the
  fields filled in.
  Web Property details falls back to "Data from public records via ATTOM" ([`page.tsx`][webdetail] 317). Store builds
  keep these strings until they update.
- **Vendor IDs.** The serializer shows "ATTOM ID" (145-147).

Rule for the switch: never label a county source "ATTOM" to suit old builds; ship readers that accept new values first,
and answer old builds in the vocabulary they accept ([architecture.md](architecture.md#15-compatibility-with-the-apps-in-the-stores)).

### Beyond today's three calls

ATTOM sells more (deeds and mortgages, foreclosures, permits, schools, hazards, rental AVMs). Pantopus does not call
them. Record Watch's deed half was never built. A future feature that needs one of those needs its own source, rights
and accuracy check (#3433's table, kept in [sourcing.md](sourcing.md#9-beyond-todays-scope)).

## Smarty and the address check

### The pipeline

`POST /api/v1/address/validate` and `/validate/unit` ([`addressValidation.js`][avroutes] 97, 165) run
[`pipelineService.js`][pipeline]: Google first (397), then Smarty on Google's normalized address (437), each up to 2.5 s
in sequence. Optional layers, all off by default: a Smarty secondary-unit lookup (541-553;
`ENABLE_ADDRESS_SECONDARY_PROVIDER`, [config][avcfg] 139), parcel intelligence (597-610), Google Places (137-138).
Home create, the address claim (`/claim`, 260) and Mailbox Check use the stored result.

### What the Smarty adapter returns

[`smartyProvider.js`][smarty] 147-171: `dpv_match_code`, `rdi_type` (`residential`, `commercial`, `unknown`),
`missing_secondary`, `commercial_mailbox` (CMRA), `vacant_flag`, footnotes. Two facts matter for the replacement:

- `missing_secondary` comes from footnote `CC` (165). `CC` means "secondary number not matched and **not required**";
  the footnotes for a required, missing unit are `N1` and `C1` (Google's and Smarty's published definitions).
- A failure returns `inconclusive` (267-279), which the engine treats as a service error.

### The decision engine

[`addressDecisionEngine.js`][engine] rules, in order (9-16): SERVICE_ERROR, UNDELIVERABLE, PO_BOX,
MISSING_STREET_NUMBER, UNVERIFIED_STREET_NUMBER, MISSING_UNIT, BUSINESS, MIXED_USE, LOW_CONFIDENCE, MULTIPLE_MATCHES,
CONFLICT, OK.

- **Smarty is mandatory:** no Smarty result, or an inconclusive one, is SERVICE_ERROR (205-220, 478-481).
- **`D` is read as "confirmed default"** (495-496). `D` means the building's number is confirmed and a **required
  unit is missing**. `S` (a unit was given but not confirmed) triggers MISSING_UNIT (581), the opposite of its meaning.
- **Confidence** (1025-1048) starts at 0.5: +0.25 for `Y`, +0.1 for `D`, +0.1 residential, +0.1 premise or rooftop,
  +0.05 no unconfirmed parts.
- **The regression #3433 reproduced, confirmed by reading master:** a residential address with `D` and footnote `N1`
  scores 0.85 and comes out OK, with a postcard offered; a blank DPV (never checked) comes out OK at 0.75. The address
  claim auto-verifies at OK with confidence ≥ 0.8 ([`addressValidation.js`][avroutes] 258, 319), so `D`/`N1` can
  verify a claim on a building without its unit.
- **Home or business** reads Smarty's RDI (331) and place and parcel signals; Smarty's `unknown` already falls back to
  place types and parcel type (364-387). CMRA is always business (813).
- **PO boxes** are caught by `carrier_route_type === 'P'` (247, 520) or a line-1 pattern (45, 250).

Mailbox Check reads the stored DPV and interprets it correctly ([`mailboxCheckService.js`][mailbox] 30-47: `D` = "A
unit number is missing", `S` = "Your unit number isn't matching"), so two parts of the app read the same code
differently today.

### The Google adapter today

[`googleProvider.js`][google] already asks for USPS CASS (110) and parses part of the answer (231-243). Checked against
Google's published `validateAddress` reference (read November 5, 2026):

| Google field | Adapter today | Effect |
|---|---|---|
| `uspsData.dpvConfirmation` (`Y`, `N`, `D`, `S`, or absent = not submitted for DPV) | Kept as `dpv_match_code` | Correct value; the engine misreads `D` and `S` (above) |
| `uspsData.dpvFootnote` (`AA`, `A1`, `BB`, `CC`, `C1`, `N1`, `M1`, `M3`, `P1`, `P3`, `F1`, …) | **Dropped** | No `N1`/`C1` to say a unit is required |
| `uspsData.dpvVacant`, `dpvCmra` (`Y`/`N`) | `=== 'Y'` (236-237): absent becomes **false** | "Not known" reads as "not vacant" and "not a mail-drop store" |
| `uspsData.dpvNoStat`, `dpvNoStatReasonCode`, `dpvThrowback`, `dpvNonDeliveryDays`, `dpvDrop`, `dpvPbsa` | Dropped | No "USPS doesn't deliver here" or seasonal signals |
| `uspsData.addressRecordType` (`F`, `G`, `H` building or apartment, `P` PO box, `R`, `S`) | Dropped | — |
| `uspsData.carrierRouteType`, `postOfficeCityStateInfo` | Read (234-239) | **Not Google fields** (Google has `carrierRouteIndicator`, `postOfficeCity`, `postOfficeState`): `carrier_route_type` and the post-office city are always empty, so the PO-box route rule never fires from Google; only the line-1 pattern catches PO boxes |
| `uspsData.poBoxOnlyPostalCode`, `cassProcessed`, `defaultAddress` | Dropped | — |
| `result.metadata.residential`, `business`, `poBox` (booleans; unset = unknown) | **Dropped**; only `metadata.placeId` is read (146) | No home-or-business answer without Smarty |

`uspsData` comes only for the US and Puerto Rico. Google's terms forbid sending made-up addresses for those places
(see [cost-and-rights.md](cost-and-rights.md#6-google-address-validation-retention)), which shapes how Phase 1 is tested.

### Where postal answers are stored and reused

- `HomeAddress` keeps the normalized address, coordinates, DPV, RDI, flags and decision inputs with no expiry; Smarty's
  raw candidate is reused for 90 days ([`smartyProvider.js`][smarty] 183-256). Google's terms cap most of this at 30
  days ([cost-and-rights.md](cost-and-rights.md#6-google-address-validation-retention)).
- **Home create during an outage** ([`home.js`][home] 855-1000): with `ENABLE_SAFE_ADDRESS_OUTAGE_FALLBACK` on
  ([config][avcfg] 126) it re-runs the engine on the stored inputs of a recent validation and allows only an OK at the
  minimum confidence; otherwise it answers 503 `ADDRESS_VALIDATION_UNAVAILABLE` (371-378).
- Mailbox Check reads the stored flags (68-76).

### Unit lookup (off)

The Smarty secondary adapter ([`secondaryAddressProvider.js`][secondary]) can ask for a building's unit count and list
and check a submitted unit. It is off. A count can't validate a named unit.

## Lob and physical mail

### Flows

| Flow | Routes | Code |
|---|---|---|
| Address verification postcard | `/api/v1/address/verify/mail/start`, `/:verification_id`, `/resend`, `/confirm` ([`addressValidation.js`][avroutes] 479, 560-580, 650) | [`mailVerificationService.js`][mailverify]; attempts, tokens and `MailVerificationJob` |
| Home postcard (residency and ownership) | `/api/homes/:id/postcard-requests` and its status and cancel; legacy `request-postcard` and `verify-postcard` ([`homeOwnership.js`][ownership] 2535-2548, 2587, 2619) | [`homePostcardRequestService.js`][hprequest], [`homePostcardService.js`][hpcard]; codes are hashed and confirmed in one database call (93-133) |
| Block Founders "invite a neighbor" | Verified residents only; 3 per sender per week, 90-day per-recipient dedup, permanent opt-out ([`blockFoundersService.js`][founders] 20-22, 37-38) | `sendCustomPostcard` (597) |

### Provider selection and sending

- [`mailVendorService.js`][mailvendor] 27-37 picks Lob when configured (and always on hosted servers), otherwise a mock
  that prints the code. There is a provider interface (`sendPostcard`, `getJobStatus`) but no second real printer and
  no switch between printers.
- Verification cards send an `Idempotency-Key` from the request id and retry up to 3 times
  ([`lobMailProvider.js`][lob] 143, 198, 207-230). Block Founders cards don't (`sendCustomPostcard`, 258-292).
- Block Founders reserves the invite row before sending and deletes the reservation on any exception (603-606), even
  when Lob may have accepted the card (a timeout), so a retry can mail twice.

### Delivery events

[`lobWebhook.js`][lobhook] verifies Lob's signature and rejects stale timestamps (26-60) and routes events by metadata.
The Home postcard handler ([`homePostcardService.js`][hpcard] 79-92) moves a card to `accepted` for **any** event,
including `returned_to_sender`, `re-routed` and `failed` (events listed in [`lobWebhook.js`][lobhook] 11-15): a
returned card leaves the person waiting until the code expires. The older address flow expires the attempt on return.

## Pieces the replacement reuses

| Need | Existing piece |
|---|---|
| Versioned index files with a manifest and a last-good copy in memory | [`plans/placesIndex.js`][placesindex] and its build workflow [`places-index.yml`][placeswf] |
| A separate process for heavy jobs | [`worker.js`][worker], [`pgBossJobs.js`][pgboss] |
| Screens that fill in by themselves | [`syncChangedService.js`][syncchanged] (`sync:changed` for `home:<id>`, `place:<id>`), already re-read on web, iOS and Android (#3439's notes) |
| Stored per-section answers with freshness | [`placeSectionCache.js`][psc], `ExternalFeedCache` |
| Capability switches read in one place | [`config/addressVerification.js`][avcfg] (env flags with defaults) |
| Household values beside the record | `Home.year_built`, `sq_ft`, `bedrooms`, `bathrooms`, `lot_sq_ft`, `home_type`, already merged as `household_fields` ([`pis`][pis] 462-471) |
| Mail provider shape | `sendPostcard` / `getJobStatus` in [`mailVendorService.js`][mailvendor] |

## Not checked

- Which keys production and staging hold, and ATTOM's agreement (founder-only facts).
- How many ATTOM, Smarty and Google copies the hosted databases keep.
- Live vendor answers (no vendor calls were made for this package), old store builds' exact versions in use,
  physical phones.

[master]: https://github.com/WangPantopus/skinny-pantopus/tree/ffd28e60a1d9478342351a15fa588d09d4e20466
[pis]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/backend/services/ai/propertyIntelligenceService.js
[cache]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/backend/services/external/cacheHelper.js
[psc]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/backend/services/placeSectionCache.js
[persist]: ../../provider-data-persistence-2026-11-01.md
[home]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/backend/routes/home.js
[prefill]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/backend/scripts/prefill-provider-cache.js
[suggest]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/backend/services/ai/propertySuggestionsService.js
[detail]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/backend/services/homeDetailService.js
[serializer]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/backend/serializers/countyRecordSerializer.js
[place]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/backend/services/placeIntelligenceService.js
[exempt]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/backend/services/exemptionCheckService.js
[shape]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/backend/services/place/houseShape.js
[ai]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/backend/routes/ai.js
[pulse]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/backend/services/ai/neighborhoodPulseComposer.js
[parcel]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/backend/services/addressValidation/parcelIntelProvider.js
[propdata]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/backend/services/propertyDataService.js
[public]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/backend/routes/public.js
[iosval]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/frontend/apps/ios/Pantopus/Features/Homes/HomeIntelligenceValidation.swift
[andval]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/HomeIntelligenceValidation.kt
[iosadd]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/frontend/apps/ios/Pantopus/Features/Homes/AddHome/AddHomeDetailsSection.swift
[andadd]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/add_home/AddHomeDetailsSection.kt
[iosvm]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/frontend/apps/ios/Pantopus/Features/Homes/AddHome/AddHomeWizardViewModel.swift
[andvm]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/add_home/AddHomeWizardViewModel.kt
[webdetail]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/frontend/apps/web/src/app/(site)/(app)/app/homes/%5Bid%5D/property-details/page.tsx
[avroutes]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/backend/routes/addressValidation.js
[pipeline]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/backend/services/addressValidation/pipelineService.js
[avcfg]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/backend/config/addressVerification.js
[smarty]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/backend/services/addressValidation/smartyProvider.js
[google]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/backend/services/addressValidation/googleProvider.js
[engine]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/backend/services/addressValidation/addressDecisionEngine.js
[mailbox]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/backend/services/mailboxCheckService.js
[secondary]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/backend/services/addressValidation/secondaryAddressProvider.js
[geo]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/backend/services/geo/index.js
[lob]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/backend/services/addressValidation/lobMailProvider.js
[lobhook]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/backend/routes/lobWebhook.js
[mailvendor]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/backend/services/addressValidation/mailVendorService.js
[mailverify]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/backend/services/addressValidation/mailVerificationService.js
[ownership]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/backend/routes/homeOwnership.js
[hprequest]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/backend/services/homePostcardRequestService.js
[hpcard]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/backend/services/homePostcardService.js
[founders]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/backend/services/blockFoundersService.js
[placesindex]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/backend/services/plans/placesIndex.js
[placeswf]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/.github/workflows/places-index.yml
[worker]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/backend/worker.js
[pgboss]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/backend/jobs/pgBossJobs.js
[syncchanged]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/backend/services/syncChangedService.js
[next]: https://github.com/WangPantopus/skinny-pantopus/blob/ffd28e60a1d9478342351a15fa588d09d4e20466/NEXT_STEPS.md
