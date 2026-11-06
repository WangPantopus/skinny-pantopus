# Provider data persistence

The founder's November 1 direction is to reuse stored property and other stable
reference facts before calling a third-party API. This change covers the backend;
web, iOS and Android continue using the same Pantopus endpoints and response shapes.

For the proposed independent property index, permitted retention, and vendor exit gates, see the [nationwide ATTOM, Smarty and Lob replacement design](research/provider-replacement/README.md).

## Storage and request flow

No new table or migration is necessary. `ExternalFeedCache` already has a JSONB
`payload`, provider, request key, fetched/expiry timestamps, and a unique
`(provider, place_key)` constraint. Its access is restricted to the backend.
`AttomPropertyCache`, `PlaceSectionCache`, `PropertyIntelligenceCache`,
`NeighborhoodProfileCache`, `HomeAddress` and `Home.niche_data` remain in use.

`backend/services/external/cacheHelper.js` now stores raw reference responses in
`ExternalFeedCache` under `RESPONSE_V1:<provider>`. The payload contains a schema
version, endpoint and the **complete JSON response**, including unknown nested
fields, arrays, additional properties and provider metadata. There is no mapping
that silently drops new fields. The existing application models still select the
fields they display.

The request key is a SHA-256 digest of the endpoint and sorted query parameters.
Credentials are excluded. ATTOM also normalizes case and whitespace. Apartment
and unit information remains part of the key; separate units are not merged.
These rows describe provider requests, not the identity of the person looking up
an address. Their expiry is PostgreSQL `infinity`, so feed cleanup does not erase
saved reference responses. Freshness checks for changeable data use `fetched_at`
independently of retention.

1. Read the matching database row, before checking provider credentials.
2. Validate the actual records, not just a nonempty status envelope.
3. Return usable stable facts directly. TTL expiry alone does not cause another
   property-detail request.
4. On a miss, fetch the provider asynchronously and await the database upsert
   before returning the result. Concurrent identical requests in one backend
   process share the fetch and write.
5. Null, empty or error results are not saved as successful responses and do not
   suppress the next lookup. A failed write is logged as **not saved**; the
   current client can still receive the provider answer, and a later request
   retries. Database availability remains necessary for durable storage.

This is response reuse, not a historical archive of every version. A successful
refresh replaces that request's previous raw response. A failure does not erase
the last good raw response. Independent backend processes can still race on a
first miss; the unique constraint prevents duplicate rows, not duplicate calls
across processes.

## Source audit and policy

| Source / paths | Database behavior |
| --- | --- |
| ATTOM property details: `propertyIntelligenceService`, `propertySuggestionsService`, `parcelIntelProvider` | All use the same request cache. Full response retained; stable facts reused without expiry. Home and validated-address copies are reused, including old successful records. No property-type restriction: houses, condos, townhouses, apartments and complexes follow the same path. |
| ATTOM AVM and sales trends | Full responses retained and checked first; their existing 30-day freshness budget remains because values change. |
| ATTOM / CoreLogic ownership matching: `propertyDataService` | Full response retained; reuse requires acquisition within 24 hours. Older property facts cannot approve an ownership claim when the provider is unavailable. |
| Census geographies and vintage-specific ACS: `neighborhoodProfileService`, `placeSectionAdapters` | Complete responses stored before normalization. Stable tract/county and 2023 ACS results reused; versioned request URLs separate different datasets. |
| Census civic boundaries: `ballot/governments` | Complete responses stored by the exact request, shared across anonymous and saved-home lookups without an account association. The existing 30-day freshness limit remains for civic boundaries. |
| FEMA NFHL flood zones | Complete response retained; database first with the existing 90-day freshness budget. A stale map is not silently relabeled as a fresh map. |
| USGS ASCE 7-22 and USFS WHP | Complete design/raster responses retained; stable section rows reused beyond expiry. These are hazard models, not real-time earthquake or fire alerts. |
| EPA service areas, SDWIS and ECHO | Complete responses retained; database first with 90-day freshness. ECHO's search and detail responses are saved together; a temporary query ID alone is never a complete result. |
| Smarty secondary/unit lookup | Complete count/list responses saved before reducing them to unit hints, with 90-day validation freshness. Existing Smarty postal validation already reads `HomeAddress` first and retains its candidate; address validation continues using its existing freshness limits. |
| Google Address Validation / Places | Existing address-validation persistence remains. No new unrestricted raw-response cache is added; Google Places restricts storage of its content. |
| Mapbox geocoding / place labels | Existing geocoder behavior remains. Permanent storage requires a permanent-geocoding entitlement/request; this change does not purchase or enable it. |
| Walk Score | Existing neighborhood-profile behavior remains. No expanded raw-response retention: the published terms require written caching approval. |
| OpenStreetMap / Overpass / Pantopus places index | The existing places index and `PlaceSectionCache` already serve stored places first, then refresh in the background. Its 24-hour budget remains because opening hours and availability inform Plans. |
| HUD rent bands, county radon zones, pickup calendars and other bundled reference data | Already database or repository reads; no per-screen third-party request to eliminate. |
| OpenFEMA NFIP premiums and Freddie Mac PMMS | Existing database-first aggregate/history caches remain. Premium benchmarks refresh at 90 days; the weekly mortgage survey at 3 days. These are changing cost data. |
| WeatherKit, Open-Meteo, NOAA/NWS, AirNow and heat outlooks | Existing short-lived weather/context caches remain. Reusing these indefinitely would present old conditions as current. |
| Election/civic officials, sports schedules, RSS/news seeding | Existing freshness and ingestion paths remain. Seeder items are stored/deduplicated in `seeder_content_queue`; new feed fetches discover new items. These are not permanent property facts. |
| Stripe, Lob, Postmark/email, push, OAuth, S3/Supabase storage and AI generation | Transaction, delivery, identity, file or generation operations; not stable reference-data GETs. No blanket memoization is applied. |

Provider policy references checked for this work: [ATTOM response documentation](https://api.developer.attomdata.com/docs),
[Google Places storage policy](https://developers.google.com/maps/documentation/places/web-service/policies),
[Mapbox storage modes](https://docs.mapbox.com/api/search/geocoding/),
[Walk Score terms](https://www.walkscore.com/professional/terms-of-use.php),
[Smarty enrichment terms](https://www.smarty.com/legal/product-terms).
This change does not alter subscriptions or claim rights beyond those contracts.

## Bounded ATTOM prefill

`backend/scripts/prefill-provider-cache.js` is an operator command, not a public
route or scheduled job. It reads a privately stored JSONL address manifest and
uses the same `/property/detail` request identity and response validator as the
application. It writes complete responses to the existing `ExternalFeedCache`;
it does not create Homes, canonical addresses, memberships, or ownership claims.
Smarty prefill is deferred.

The command defaults to a dry run. Execution requires an explicit database
hostname, the fingerprint of the account's existing key, recently checked
included usage, and a per-run budget. The plan distinguishes request-count
(`hits`) quotas from returned-property (`reports`) quotas: report budgets reserve
ten credits per request, with the API's default page size explicitly fixed at
ten. Reservations happen before the network request and are not refunded after
errors or empty results. At least half the observed remaining allowance stays
reserved for normal application traffic. The batch selects at most 200 distinct
addresses, spaces requests at no more than 30 per minute and half the account's
own rate limit, and stops when its quota observation is 15 minutes old.

A private durable ledger prevents concurrent runs and repeat purchases after a
restart. A received response is saved privately before its database upsert, so a
failed write can be recovered without another provider request. Ambiguous
requests, HTTP errors (including 401/402/429), unexpected responses and database
read/write failures stop execution. Empty ATTOM results are recorded only in the
operator ledger, not as successful database cache entries. Raw responses,
addresses, credentials, account details and operator logs must remain outside
the public repository.

Manifest rows contain `line1`, optional `line2`, `city`, `state`, `zip`, and a
`source` reference. The current command is scoped to Camas, Washougal and
Vancouver, Washington postal-city areas, including unincorporated surroundings;
it does not filter property types. A county address-point inventory is not a
complete parcel inventory, and Clark County alone does not cover the entire
Washougal postal area in Skamania County.

```sh
node backend/scripts/prefill-provider-cache.js \
  --manifest /private/operator/addresses.jsonl \
  --plan /private/operator/plan.json \
  --state-dir /private/operator/run
```

After reviewing the dry run, `--execute` runs the bounded batch. The private
plan has `databaseHost`, ISO `quotaCheckedAt` / `quotaExpiresAt`, and
`providers.ATTOM` containing `quotaUnit`, `remainingCredits`, `reserveCredits`,
`maxCredits`, `rateLimitPerMinute`, `requestsPerMinute`, and
`credentialFingerprint` (SHA-256 of the existing API key). Use a fresh dashboard
reading before resuming; do not reset the ledger to bypass its previous spend.
A stale lock or an ambiguous request requires inspection, not an automatic retry.
After reconciling usage, an operator can mark an unresolved ledger entry
`abandoned`; it is skipped while its credit reservation remains consumed.

The [published ATTOM trial terms](https://api.developer.attomdata.com/legal)
restrict evaluation use, database building and retention beyond 24 hours.
A quota allowance by itself does not establish production or retention rights.
The relevant agreement must be considered separately from these technical
spending controls. Prefilling a database also does not deploy the reader code:
verify the running backend includes database-first reads before claiming live
web or native requests will reuse the imported rows.

The operator command was exercised against an isolated real database with
synthetic provider responses in both quota modes. Checks covered credit ceilings,
request spacing, restart/resume, separate apartment keys, unknown/zero/false JSON
fields, application lookup reuse, failed-write recovery without repurchasing,
database-read failures before any provider call, and stopping on HTTP 429 without
retrying. A native smoke check after restarting the local backend kept the saved
home facts visible in both iOS and Android with the provider offline and no new
provider calls. No new unit tests were added; privacy gates passed. One unrelated
HTTP parser failure occurred in the full backend run; that paid-gig route suite
passed all 240 tests on its focused rerun.

## Verification

The final full backend run passed 6,632 tests (16 skipped), and all privacy gates
passed. Focused reruns also passed after the additional data-integrity audit.
Existing assertions were updated for persistent Census reuse, empty results,
and apartment isolation. No new unit tests were added.

On an isolated local Supabase database and the real Pantopus HTTP route, with
synthetic ATTOM responses:

- Three simultaneous property-suggestion requests made one provider call.
- Full nested and previously unknown fields survived the JSONB round trip.
- After restarting the backend, a deliberately old stored record answered with
  the provider offline and no new provider call.
- An empty stored property array caused a new fetch and was replaced.
- Different apartment units used separate request keys.
- Anonymous and authenticated database clients could neither read nor write raw
  provider responses. An unrelated user received HTTP 403 for another Home's profile.
- Direct database reads of `Home.niche_data` were denied for owner, member,
  guest and unrelated-user accounts. The property-details HTTP route returned
  the raw ATTOM bundle only to the authorized owner; a household member received
  the owner-only restriction, and guests and unrelated users received HTTP 403.
- Partial property profiles retried only their missing AVM/trend endpoints;
  complete profiles made no further provider calls. Raw acquisition timestamps
  prevent rebuilding a profile from extending the freshness of old valuations.
- A stale record remained usable for ordinary building facts but could not
  approve ownership when the provider was unavailable.
- A deliberately rejected database write returned `persisted: false`; the next
  lookup fetched again and saved successfully. The temporary local failure
  trigger was removed after the check.
- Query ordering and credential rotation reused the same request key; units
  remained separate. Zero, false and unknown nested fields survived unchanged.

The audit also corrected empty full-response envelopes masking valid legacy
property records, address-only AVM responses counting as complete valuations,
and missing Census tract/town or USGS seismic-category fields becoming permanent
cache hits. Home identity edits remain rejected by the existing address-change
flow; ordinary settings edits cannot silently move a cached profile to a different
address.

An actual Census geographies response for a public civic-building location was
saved in the isolated database; a second lookup made no additional external call.
The real web app displayed the synthetic ATTOM property facts on Your home and
kept them after reload with the provider offline. An authorized household member
also received the saved property profile through the real API while the provider
was offline. Both iOS and Android builds passed. The isolated iOS simulator and
Android emulator displayed the saved year, floor area, beds/baths and lot size
after app and backend restarts with the provider offline and no additional ATTOM
calls. The restarted backend logged database cache hits. Android's data-partition
and desktop window-input issues were resolved; sign-in and screen verification
used desktop controls, including the emulator's on-screen keyboard. No
physical-device checks were performed.

These checks do not validate the hosted database, a live provider subscription,
provider retention entitlements, or production deployment. Existing records whose
old code discarded fields cannot regain those fields without another provider
response. ATTOM verification used a synthetic provider, not paid live requests.
