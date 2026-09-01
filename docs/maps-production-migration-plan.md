# Pantopus Maps Production Migration Plan

Status: Draft  
Date: 2026-03-08  
Scope: Web maps, mobile maps, autocomplete, reverse geocoding, persistent geocoding, address verification, discovery/location UX, privacy/compliance, observability, rollout

## 1. Executive Summary

Pantopus already has the right product shape for maps:

- web map surfaces for gigs, marketplace, feed, mailbox, discover, and previews
- native mobile map surfaces for explore, gigs, marketplace, feed, mailbox, and address confirmation
- spatial discovery driven by Supabase/PostGIS instead of vendor lock-in
- verified-address flows already using paid trust-grade services

The problem is not feature coverage. The problem is production readiness.

Today the repo mixes:

- public OpenStreetMap tiles on web
- public Nominatim fallback/batch geocoding
- Mapbox-backed autocomplete/reverse geocoding
- Google Address Validation + Smarty + Lob for trust-critical address verification
- native `react-native-maps` on mobile

That is good enough for development and small beta traffic, but not good enough for production scale, vendor compliance, or long-term maintainability.

The correct move is not a big-bang rewrite to one paid maps suite. The correct move is:

1. Keep Pantopus's own spatial data model and PostGIS queries as the product core.
2. Replace public OSM/Nominatim dependencies with production-safe providers.
3. Introduce a provider abstraction so client code no longer depends on Mapbox-specific payload shapes.
4. Keep Google/Smarty/Lob for authoritative address verification.
5. Harden web/mobile map rendering, keys, privacy rules, telemetry, caching, and rollout.

## 2. What "Production Ready" Means Here

For Pantopus, production-ready maps means:

- no direct dependency on public best-effort tile or geocoding infrastructure
- explicit licensing compliance and visible attribution
- keys restricted by platform, domain, package, and endpoint use
- one normalized geo API contract across web and mobile
- permanent geocoding rules handled correctly for stored coordinates
- verified-address workflows remain authoritative and auditable
- location privacy rules are consistent across homes, posts, gigs, businesses, and listings
- map-heavy surfaces are observable, debounced, cached, and cost-controlled
- every major location flow has automated tests and a rollback path

## 3. Current State In This Repo

### 3.1 Web rendering

Web map surfaces currently use Leaflet and direct OSM raster tiles:

- `frontend/apps/web/src/components/map/constants.ts`
- `frontend/apps/web/src/app/(app)/app/marketplace/MarketplaceMap.tsx`
- `frontend/apps/web/src/app/(app)/app/gigs/GigsMap.tsx`
- `frontend/apps/web/src/app/(app)/app/feed/FeedMap.tsx`
- `frontend/apps/web/src/app/(app)/app/mailbox/map/page.tsx`
- `frontend/apps/web/src/components/business/MapPreview.tsx`
- `frontend/apps/web/src/components/address/AddressMap.tsx`

Observations:

- web maps are largely raster-tile + custom marker UIs
- clustering is mostly client-side and manual
- this is good enough for current product behavior
- several surfaces hardcode `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`
- some preview surfaces disable attribution entirely

### 3.2 Mobile rendering

Mobile surfaces use `react-native-maps`:

- `frontend/apps/mobile/src/app/explore-map.tsx`
- `frontend/apps/mobile/src/components/gigs/GigsMapView.tsx`
- `frontend/apps/mobile/src/components/discover-businesses/BusinessMapView.tsx`
- `frontend/apps/mobile/src/components/marketplace/MarketplaceMapView.tsx`
- `frontend/apps/mobile/src/components/feed/FeedMapView.tsx`
- `frontend/apps/mobile/src/app/mailbox/maps.tsx`
- `frontend/apps/mobile/src/components/address/ConfirmAddress.tsx`

Observations:

- mobile rendering is already native and product-appropriate
- no evidence of advanced custom route rendering or vector-style requirements yet
- `frontend/apps/mobile/app.config.js` already injects `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`

### 3.3 Search, autocomplete, reverse geocoding

Current geo API:

- `backend/routes/geo.js`
- `frontend/packages/api/src/endpoints/geo.ts`

Observations:

- autocomplete and reverse geocode are Mapbox-backed
- clients pass provider-shaped feature payloads back into `/api/geo/normalize`
- web and mobile UI code know too much about provider response shape
- this makes vendor swapping and contract testing harder than it should be

### 3.4 Persistent geocoding

Current geocoding and fallback paths:

- `backend/utils/geocoding.js`
- `backend/services/businessAddressService.js`
- `backend/scripts/backfill-business-locations.js`

Observations:

- public Nominatim is used as fallback and in backfill flows
- Nominatim is not acceptable as a production dependency for commercial scale or batch jobs
- current Mapbox usage does not explicitly distinguish temporary vs permanent geocoding storage

### 3.5 Verified address pipeline

Current trust/verification path:

- `backend/routes/addressValidation.js`
- `backend/services/addressValidation/googleProvider.js`
- `backend/services/addressValidation/smartyProvider.js`
- `backend/config/addressVerification.js`

Observations:

- this is already the right place to pay for reliability
- homes and trust-critical business address flows should keep using paid verification-grade providers
- this path should remain the authoritative address source for high-trust entities

### 3.6 Spatial query engine

Current spatial product engine:

- `backend/routes/businessDiscovery.js`
- `backend/routes/gigs.js`
- `backend/routes/posts.js`
- Supabase/PostGIS RPCs such as `find_businesses_in_bounds` and `find_gigs_nearby_v2`

Observations:

- this is Pantopus's moat
- provider migration must not move ranking, trust, clustering, or browse logic into a vendor platform
- vendors should supply base maps and geocoding, not replace Pantopus's geospatial product logic

## 4. Target Production Architecture

### 4.1 Core decision

Pantopus should move to a hybrid production stack:

- `Pantopus/PostGIS` remains the system of record for spatial discovery and browse
- `Paid tile service` replaces direct public OSM tile usage on web
- `Paid geocoding/search provider` powers autocomplete, reverse geocode, and persistent non-verified coordinates
- `Google Address Validation + Smarty + Lob` remain the authoritative trust/verification stack
- `react-native-maps` remains the mobile renderer

### 4.2 Recommended provider strategy

### Immediate recommendation

- Keep `react-native-maps` on mobile.
- Keep `Leaflet` on web for the first production hardening pass.
- Standardize on `Mapbox Search/Geocoding + paid web tiles` for non-verified search/reverse/forward geocoding and web tile delivery.
- Keep `Google Address Validation + Smarty + Lob` for homes and verification-critical business address workflows.

### Why this is the right target

- minimal churn relative to current code
- no big-bang rewrite of mobile or web map UI
- preserves existing Mapbox-based autocomplete/reverse flows
- removes the two highest-risk public dependencies: public OSM tiles and public Nominatim
- keeps trust-critical addresses on stronger verification infrastructure than generic geocoding

### What not to do

- do not rewrite the whole app to Google Maps just because Google is paid
- do not move discovery/ranking into vendor APIs
- do not keep public OSM/Nominatim in production
- do not keep passing raw provider payloads from client to server forever

### 4.3 Long-term option

If Pantopus later needs:

- much denser map layers
- custom vector styling
- 3D/camera-driven UI
- higher-performance client clustering
- tighter cartographic control

then upgrade the heavy web surfaces from Leaflet to `MapLibre GL JS` in a second-stage migration. That is not required to become production-ready today.

## 5. Product Feature Coverage Matrix

| Product area | Current state | Target state |
| --- | --- | --- |
| Web marketplace map | Leaflet + public OSM tiles + custom clustering | Leaflet + paid tile provider + shared map config |
| Web gigs map | Leaflet + Pantopus bounds queries | Keep query engine, harden tiles/config/telemetry |
| Web feed map | Leaflet + Pantopus post markers | Keep behavior, standardize location privacy and map contract |
| Web discover map | Multi-layer Pantopus queries | Keep architecture, add better layer caching and observability |
| Web mailbox map + previews | Leaflet + OSM, some attribution gaps | Move to paid tiles and restore compliant attribution |
| Mobile explore/gigs/marketplace/feed/mailbox | `react-native-maps` | Keep renderer, harden keys, permissions, QA |
| Current location UX | Reverse geocode via `/api/geo/reverse` | Keep feature, normalize contract and caching |
| Address autocomplete | Mapbox-shaped responses | Move to provider-agnostic suggestion contract |
| Business/home/listing/post persistence | Mixed geocoding paths | One explicit permanent geocode path per entity type |
| Home/business verification | Google + Smarty + Lob | Keep and make canonical source of truth |

## 6. Workstreams

### 6.1 Workstream A: Provider Abstraction and Configuration

### Goal

Remove provider-specific assumptions from UI code and centralize geo configuration.

### Deliverables

1. Add a backend `GeoProvider` layer with methods such as:
   - `autocomplete(query, sessionContext)`
   - `resolveSuggestion(suggestionId, sessionContext)`
   - `reverseGeocode(lat, lng)`
   - `forwardGeocodePermanent(address)`
   - `forwardGeocodeTemporary(address)`

2. Replace `/api/geo/normalize { feature }` with a provider-agnostic resolution flow:
   - `GET /api/geo/autocomplete?q=...`
   - `POST /api/geo/resolve { suggestion_id }`
   - `GET /api/geo/reverse?lat=...&lon=...`

3. Introduce shared map config:
   - `MAP_TILE_URL`
   - `MAP_TILE_ATTRIBUTION`
   - `MAP_PUBLIC_TOKEN`
   - `GEO_PROVIDER`
   - `GEO_SERVER_TOKEN`
   - `GEOCODE_PERMANENT_PROVIDER`

4. Move all hardcoded tile URLs and attribution strings into one shared config path.

### Files affected first

- `backend/routes/geo.js`
- `backend/utils/geocoding.js`
- `frontend/packages/api/src/endpoints/geo.ts`
- `frontend/apps/web/src/components/AddressAutocomplete.tsx`
- `frontend/apps/mobile/src/components/address/AddressAutocomplete.tsx`
- `frontend/apps/mobile/src/components/business/BusinessAddressFlow.tsx`
- `frontend/apps/mobile/src/components/PostingLocationPicker.tsx`
- `frontend/apps/web/src/components/LocationPicker.tsx`

### Acceptance criteria

- no client sends raw vendor feature payloads back to the server
- all client geo calls use one normalized contract
- changing geo vendor only changes backend adapter code and config

### 6.2 Workstream B: Web Map Hardening

### Goal

Make all web map surfaces production-safe without rewriting them.

### Deliverables

1. Replace direct public OSM tiles on all web surfaces with a paid tile source.
2. Restore visible attribution on every surface, including previews.
3. Centralize shared tile config in `frontend/apps/web/src/components/map/constants.ts`.
4. Add request-level telemetry for map bounds fetches and tile-load-adjacent UX events.
5. Audit map previews and embedded maps for reduced but still compliant attribution behavior.

### Files to update

- `frontend/apps/web/src/components/map/constants.ts`
- `frontend/apps/web/src/components/map/BaseMap.tsx`
- `frontend/apps/web/src/app/(app)/app/marketplace/MarketplaceMap.tsx`
- `frontend/apps/web/src/app/(app)/app/gigs/GigsMap.tsx`
- `frontend/apps/web/src/app/(app)/app/feed/FeedMap.tsx`
- `frontend/apps/web/src/components/discover/DiscoverMap.tsx`
- `frontend/apps/web/src/components/business/MapPreview.tsx`
- `frontend/apps/web/src/components/address/AddressMap.tsx`
- `frontend/apps/web/src/app/(app)/app/mailbox/map/page.tsx`
- `frontend/apps/web/src/components/DashboardMap.tsx`

### Acceptance criteria

- no direct references to `tile.openstreetmap.org` remain in production code
- all surfaces render with valid attribution
- all maps read tile settings from shared config

### 6.3 Workstream C: Mobile Map Hardening

### Goal

Keep native map rendering, but make key management, permissions, and UX consistent.

### Deliverables

1. Lock down mobile map keys by:
   - iOS bundle ID
   - Android package name + SHA
   - API restrictions to only required Maps SDKs

2. Decide platform behavior explicitly:
   - either keep native-default renderers per platform
   - or switch to Google provider consistently if unified appearance is required

3. Standardize map camera behavior across:
   - explore
   - gigs
   - feed
   - marketplace
   - mailbox
   - address confirmation

4. Add production QA around:
   - permission denial
   - stale location permission state
   - empty-map overlays
   - cluster tapping
   - low-connectivity behavior

### Files to review/update

- `frontend/apps/mobile/app.config.js`
- `frontend/apps/mobile/src/app/explore-map.tsx`
- `frontend/apps/mobile/src/components/explore-map/useExploreMapData.ts`
- `frontend/apps/mobile/src/components/gigs/GigsMapView.tsx`
- `frontend/apps/mobile/src/components/marketplace/MarketplaceMapView.tsx`
- `frontend/apps/mobile/src/components/feed/FeedMapView.tsx`
- `frontend/apps/mobile/src/app/mailbox/maps.tsx`
- `frontend/apps/mobile/src/components/address/ConfirmAddress.tsx`

### Acceptance criteria

- mobile builds have restricted, non-overbroad keys
- permissions failures are handled without broken flows
- map behavior is consistent across major surfaces

### 6.4 Workstream D: Search, Autocomplete, Reverse Geocoding

### Goal

Make location search fast, reliable, and cheap enough to scale.

### Deliverables

1. Debounce and throttle centrally instead of ad hoc in each component.
2. Introduce session-aware search semantics server-side.
3. Cache recent reverse geocodes and repeated place lookups.
4. Normalize all suggestion payloads to:
   - `suggestion_id`
   - `primary_text`
   - `secondary_text`
   - `label`
   - `center`
   - `kind`

5. Stop deriving structured addresses from provider-specific context fields in UI code.
6. Add search analytics:
   - suggestions shown
   - suggestion selected
   - reverse geocode success/failure
   - search-to-post/create conversion

### Pantopus-specific flows to cover

- home onboarding
- business address onboarding
- posting location picker
- current-location selection
- viewing-location picker
- profile edit location
- chat/location cards

### Acceptance criteria

- autocomplete works identically on web and mobile
- reverse geocode has cache hit tracking
- no UI component parses vendor-specific context directly

### 6.5 Workstream E: Persistent Geocoding and Data Migration

### Goal

Ensure every stored coordinate in the product is derived from a compliant, auditable path.

### Deliverables

1. Classify every stored location type:
   - verified home address
   - business location
   - listing location
   - post location
   - viewing/saved place
   - derived preview coordinate

2. For each type, define the allowed persistence path:
   - `verified`: Google Address Validation + Smarty + canonical address record
   - `persistent non-verified`: permanent geocoding via paid provider
   - `ephemeral UI-only`: temporary geocoding allowed, not persisted

3. Add metadata fields or JSONB for:
   - `geocode_provider`
   - `geocode_mode` (`verified`, `permanent`, `temporary`)
   - `geocode_place_id`
   - `geocode_accuracy`
   - `geocode_created_at`
   - `geocode_source_flow`

4. Remove Nominatim from production fallback and from any batch/backfill job.
5. Re-geocode existing rows with missing or untrusted provenance.
6. Produce a migration report:
   - total rows checked
   - rows re-geocoded
   - rows changed by more than N meters
   - rows needing manual review

### Files/processes to update

- `backend/utils/geocoding.js`
- `backend/services/businessAddressService.js`
- `backend/scripts/backfill-business-locations.js`
- any jobs or routes that persist lat/lng without provenance

### Acceptance criteria

- no persisted production location depends on public Nominatim
- every persisted location has source/provenance metadata
- backfills run through compliant geocoding only

### 6.6 Workstream F: Verified Address Pipeline as Source of Truth

### Goal

Keep the trust-critical Pantopus address model stronger than the consumer geocoder.

### Deliverables

1. Preserve Google Address Validation + Smarty + Lob as the authoritative trust path.
2. Ensure verified-home coordinates propagate cleanly into:
   - home records
   - occupancy/claim flows
   - nearby/trust decisions
   - mailbox routing

3. Ensure verified business location decisions propagate into:
   - business location visibility
   - pin display eligibility
   - trust/review/discovery signals

4. Store canonical address IDs wherever a feature claims a verified place relationship.

### Files to treat as authoritative

- `backend/routes/addressValidation.js`
- `backend/services/addressValidation/googleProvider.js`
- `backend/services/addressValidation/smartyProvider.js`
- `backend/services/addressValidation/canonicalAddressService.js`
- `backend/services/businessAddressService.js`

### Acceptance criteria

- verified addresses and generic geocoded addresses are not conflated
- trust-critical entities always reference canonical verified address data when applicable

### 6.7 Workstream G: Performance, Clustering, and Cost Controls

### Goal

Scale the map UX without exploding API cost or client jank.

### Deliverables

1. Consolidate bounds-change debounce rules across web and mobile.
2. Add server-side or shared-library clustering strategy for high-density surfaces.
3. Cache expensive viewport queries where safe.
4. Define per-surface fetch budgets:
   - max results
   - refetch debounce
   - cluster threshold
   - mobile vs web payload size

5. Add cost controls:
   - sessionized autocomplete
   - reverse-geocode caching
   - repeated bounds suppression
   - batch backfill quotas

### Recommended implementation sequence

- keep current client clustering in phase 1
- introduce shared clustering utilities next
- evaluate server-side precluster/vector tile path only if dense urban views need it

### Acceptance criteria

- heavy surfaces do not requery aggressively on every small camera move
- provider request volume is measurable and bounded
- dense-map UX remains responsive on low-end devices

### 6.8 Workstream H: Privacy, Safety, and Trust Rules

### Goal

Make location exposure deliberate and consistent across the product.

### Deliverables

1. Define one location visibility matrix for:
   - homes
   - businesses
   - gigs
   - listings
   - posts
   - saved/viewing places

2. Standardize precision levels:
   - exact place
   - approximate area
   - neighborhood only
   - hidden

3. Apply precision consistently to:
   - map pins
   - previews
   - chat cards
   - feed cards
   - shareable links

4. Remove any accidental full-address leakage from generic map or preview flows.
5. Add explicit audit logging for trust-sensitive location changes.

### Acceptance criteria

- product behavior matches one documented privacy matrix
- no public/nearby feature leaks exact verified home addresses
- map and non-map surfaces use the same location precision rules

### 6.9 Workstream I: Observability and Operations

### Goal

Be able to see breakage, cost drift, and UX regressions before users do.

### Deliverables

1. Metrics:
   - autocomplete request count
   - autocomplete success/error rate
   - reverse geocode success/error rate
   - geocode cache hit rate
   - map viewport fetch latency by route
   - map empty-state rate
   - provider fallback rate
   - address validation success by step

2. Structured logs:
   - provider
   - flow
   - request class
   - billing mode
   - response class

3. Alerts:
   - spike in geocoder failures
   - tile auth failures
   - address verification provider outage
   - cost anomaly
   - map endpoint p95 latency regression

4. Runbooks:
   - switch tile provider
   - disable autocomplete temporarily
   - force fallback mode
   - pause re-geocode jobs

### Acceptance criteria

- provider outages degrade gracefully
- on-call can tell whether failure is tiles, geocoder, verification, or Pantopus backend

### 6.10 Workstream J: Testing, Release, and Rollback

### Goal

Ship this without breaking onboarding, posting, discovery, or trust flows.

### Deliverables

1. Contract tests for geo API normalization.
2. Unit tests for provider adapters and persistence policy.
3. E2E coverage for:
   - home onboarding by autocomplete
   - business location onboarding
   - current-location selection
   - map-based discover
   - posting with location
   - chat location cards

4. Staged rollout:
   - internal
   - dogfood
   - 5%
   - 25%
   - 100%

5. Rollback controls:
   - feature flag for new geo API
   - feature flag for new tile provider
   - feature flag for permanent-geocode persistence path

### Acceptance criteria

- new stack can be rolled back per subsystem
- geo contract changes are not all-or-nothing

## 7. Implementation Phases

### Phase 0: Decision Freeze and Instrumentation

Duration: 3-5 days

### Tasks

- choose paid tile provider
- choose permanent geocoding provider of record
- document location entity classes and persistence rules
- add baseline telemetry to existing geo endpoints and viewport endpoints

### Exit criteria

- provider decisions are explicit
- baseline usage numbers exist before migration starts

### Phase 1: Compliance and Safety Fixes

Duration: 1 week

### Tasks

- remove public OSM tile URLs from production web config
- restore attribution everywhere
- remove Nominatim from production runtime paths
- restrict mobile/web keys

### Exit criteria

- no production code depends on public OSM/Nominatim services
- attribution and key restrictions are correct

### Phase 2: Backend Geo Contract Rewrite

Duration: 1-2 weeks

### Tasks

- introduce provider abstraction
- replace raw-feature normalize flow with suggestion resolution flow
- add reverse-geocode cache
- add contract tests

### Exit criteria

- clients use normalized geo contract only
- provider swapping is backend-only

### Phase 3: Client Surface Migration

Duration: 1-2 weeks

### Tasks

- migrate web address/location pickers
- migrate mobile address/location pickers
- migrate profile/home/business onboarding flows
- verify all map surfaces still behave the same

### Exit criteria

- no client depends on vendor-specific context parsing
- all location selection flows pass

### Phase 4: Persistent Location Provenance

Duration: 1-2 weeks

### Tasks

- add provenance fields
- implement permanent geocode rules
- update all persistence paths
- build re-geocode/report scripts

### Exit criteria

- every stored coordinate has compliant provenance

### Phase 5: Verified Address Integration Cleanup

Duration: 1 week

### Tasks

- ensure verified-address coordinates are canonical
- align business/home trust rules with verified address source
- audit address-linked pin visibility rules

### Exit criteria

- trust-critical flows use canonical address truth end to end

### Phase 6: Performance and Experience

Duration: 1-2 weeks

### Tasks

- unify debounce logic
- optimize cluster behavior
- add better empty/loading/selection states
- optimize high-density surfaces

### Exit criteria

- map UX is smooth under production-like density

### Phase 7: Rollout and Operations

Duration: 1 week

### Tasks

- staged rollout
- cost monitoring
- failure drills
- final cleanup and doc updates

### Exit criteria

- all map/location flows are running on the new stack
- rollback and runbooks are tested

## 8. File-Level First Pass Order

If execution starts now, the first-pass order should be:

1. `backend/routes/geo.js`
2. `frontend/packages/api/src/endpoints/geo.ts`
3. `backend/utils/geocoding.js`
4. `backend/services/businessAddressService.js`
5. `backend/scripts/backfill-business-locations.js`
6. `frontend/apps/web/src/components/map/constants.ts`
7. `frontend/apps/web/src/components/map/BaseMap.tsx`
8. `frontend/apps/web/src/components/AddressAutocomplete.tsx`
9. `frontend/apps/mobile/src/components/address/AddressAutocomplete.tsx`
10. `frontend/apps/web/src/components/LocationPicker.tsx`
11. `frontend/apps/mobile/src/components/PostingLocationPicker.tsx`
12. `frontend/apps/mobile/src/components/business/BusinessAddressFlow.tsx`
13. web map surfaces using shared config
14. mobile QA pass and key restrictions

## 9. "Best Product Ever" Layer After Production Readiness

Do not mix these into the compliance/hardening migration. Ship them after the platform is stable.

### High-value experience upgrades

1. Unified location sheet across web and mobile
   - one mental model for `Current`, `Home`, `Saved place`, `Address`

2. Better map/list synchronization
   - hover/select parity
   - pinned result cards
   - "search this area" consistency everywhere

3. Saved searches and map alerts
   - "new gigs in this area"
   - "new businesses near home"
   - "posts near saved place"

4. Trust-rich pins
   - verified business/home badges
   - confidence-aware pin styling
   - privacy-aware precision rendering

5. Smart ranking on map surfaces
   - use Pantopus trust/ranking, not raw recency
   - surface "best nearby" and "worth opening" clusters

6. Future optional geo features
   - travel-time chips
   - route previews for gigs or deliveries
   - better saved-place intelligence

These are product wins. They should ride on top of a hardened geo foundation, not replace it.

## 10. Success Metrics

This migration is successful when:

- 100% of production web map traffic uses a paid tile source
- 0% of production geocoding depends on public Nominatim
- 100% of persisted coordinates have source metadata
- all onboarding/location-selection E2E tests pass
- map endpoint p95 and error rates stay within agreed budgets
- address verification success and trust metrics do not regress
- support tickets for wrong/missing location behavior decrease

## 11. Open Decisions

These need explicit owner decisions before implementation:

1. Paid web tile provider:
   - easiest path: Mapbox
   - acceptable alternative: another production tile/CDN provider

2. Persistent geocoder of record for non-verified entities:
   - likely easiest: Mapbox permanent geocoding mode
   - alternative: Google Geocoding server-side

3. Web rendering future:
   - stay Leaflet after hardening
   - or stage a later MapLibre upgrade for heavy surfaces only

4. iOS mobile renderer:
   - keep native-default behavior
   - or standardize on Google provider for visual consistency

## 12. Recommended Final Decision

If no new constraints appear, execute this plan with:

- `Mapbox` for web tiles and non-verified search/reverse/forward geocoding
- `Google Address Validation + Smarty + Lob` for authoritative address verification
- `react-native-maps` for mobile rendering
- `Leaflet` retained for phase-1 web hardening
- `MapLibre` deferred unless density/performance needs justify it later

That is the highest-leverage path from the current repo to a real production geo stack.

## 13. Source Notes

This plan is informed by the official policies and pricing/docs current on 2026-03-08:

- OpenStreetMap tile usage policy: https://operations.osmfoundation.org/policies/tiles/
- Nominatim usage policy: https://operations.osmfoundation.org/policies/nominatim/
- Mapbox pricing: https://www.mapbox.com/pricing/
- Mapbox temporary vs permanent geocoding: https://docs.mapbox.com/help/dive-deeper/understand-temporary-vs-permanent-geocoding/
- Google Maps usage and billing docs: https://developers.google.com/maps/documentation/javascript/usage-and-billing
- Google Geocoding usage and billing docs: https://developers.google.com/maps/documentation/geocoding/usage-and-billing
- Google Places usage and billing docs: https://developers.google.com/maps/documentation/places/web-service/usage-and-billing
