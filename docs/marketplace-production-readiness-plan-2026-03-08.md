# Marketplace Production Readiness Plan

Last updated: 2026-03-08  
Scope baseline: current code in `backend/routes/listings.js`, `backend/services/marketplace/marketplaceService.js`, `frontend/packages/api/src/endpoints/listings.ts`, `frontend/packages/ui-utils/src/marketplace-constants.ts`, `frontend/apps/web/src/app/(app)/app/marketplace/*`, and related marketplace detail/message flows.

## 1. Executive Summary

The marketplace is not production-ready today.

The main issue is not that the product concept is weak. The main issue is that the current implementation has multiple release-blocking failures across privacy, correctness, API contract alignment, seller workflows, and scalable browse behavior.

The most serious blockers are:

- browse/map can expose exact listing coordinates despite the product having location-privacy controls
- create/edit/filter enums drift across frontend and backend, so visible UI options can fail or silently return wrong results
- the edit flow is wired to the wrong HTTP verb and will fail to save
- browse/discover ignore authenticated viewer context, which breaks hidden/block filtering and saved-state enrichment
- nearest sort is not actually nearest under larger datasets
- seller message counts and seller inbox rendering are both incorrect
- remote/locationless listings are effectively dropped from the new browse surface even though the product already has a regression test asserting support

Recommendation:

- Do not ship the marketplace broadly until Phase 0 is complete.
- Treat Phase 0 as a release gate, not a nice-to-have backlog.
- After Phase 0, move immediately into robustness, observability, and UX hardening before any large acquisition or paid growth push.

## 2. Product Standard

The production bar for this marketplace should be:

- privacy-safe by default
- correct results before clever results
- a single, typed contract across backend, web, and mobile
- auth-aware and trust-aware browse behavior
- seller workflows that never lose or miscount buyer intent
- performance that stays correct as inventory grows
- instrumentation that makes failures visible within minutes
- a test suite that protects the core marketplace flows from regression

If the marketplace is going to be a signature product surface, it must feel trustworthy, explainable, and fast. “Best product ever” only becomes real after correctness and trust are boringly reliable.

## 3. What Was Found

### 3.1 Release-Blocking Findings

#### A. Privacy leak: exact coordinates can be exposed on marketplace browse/map

Evidence:

- `frontend/apps/web/src/app/(app)/app/marketplace/CreateListingModal.tsx`
  - current create flow auto-submits `latitude`/`longitude` from the viewer's geolocation
- `backend/services/marketplace/marketplaceService.js`
  - browse returns raw `latitude`/`longitude`
- `backend/routes/listings.js`
  - detail route explicitly redacts or blurs location based on `reveal_policy` and `location_precision`

Impact:

- a listing can reveal home-level location on the browse/map surface even though the product model says location privacy is conditional
- this is a trust and safety issue, not just a UX issue
- this can create real user harm and materially damage product trust

Root problem:

- privacy logic is implemented on detail but not on browse
- create defaults are too aggressive for a trust-sensitive surface

#### B. Frontend marketplace enums no longer match backend validation

Evidence:

- `frontend/packages/ui-utils/src/marketplace-constants.ts`
- `frontend/apps/web/src/app/(app)/app/marketplace/[id]/edit/page.tsx`
- `backend/routes/listings.js`
- `frontend/packages/types/src/listing.ts`
- `frontend/packages/api/src/endpoints/listings.ts`

Examples:

- frontend uses `baby_kids`, backend expects `kids_baby`
- frontend uses `sports`, backend expects `sports_outdoors`
- frontend uses `books`, backend expects `books_media`
- frontend exposes `pets` while backend validation does not accept it
- frontend condition uses `poor`, backend expects `for_parts`

Impact:

- visible categories can fail on create or edit
- browse filters can appear to work while returning zero or wrong results
- type safety is illusory because the packages do not agree on the contract

#### C. Listing edit flow is broken by an API verb mismatch

Evidence:

- `frontend/packages/api/src/endpoints/listings.ts` uses `put('/api/listings/:id')`
- `backend/routes/listings.js` only defines `PATCH /api/listings/:id`
- `frontend/apps/web/src/app/(app)/app/marketplace/[id]/edit/page.tsx` calls the broken client method

Impact:

- listing edits can fail even when the UI appears valid
- seller trust drops immediately because edits are a basic ownership workflow

#### D. Browse and discover ignore authenticated viewer context

Evidence:

- `backend/routes/listings.js`
  - `/browse`, `/discover`, `/autocomplete` read `req.user?.id`
  - these routes do not run `verifyToken`
- `backend/middleware/verifyToken.js`
  - only middleware that populates `req.user`
- `frontend/packages/api/src/client.ts`
  - bearer token is sent by the client

Impact:

- blocked users, muted users, and hidden listings are not reliably filtered
- `userHasSaved` enrichment does not work in browse/discovery
- the surface behaves like an anonymous surface even inside the authenticated app

#### E. “Nearest” sort is not correct at scale

Evidence:

- `backend/services/marketplace/marketplaceService.js`
  - for `nearest`, the service fetches a capped recent subset and sorts in JS

Impact:

- in large bounds or denser inventories, older-but-closer listings never appear
- cursor pagination becomes logically wrong
- “nearest” becomes a misleading label rather than a ranking guarantee

Root problem:

- distance ordering is being approximated in application code instead of pushed into the database

#### F. Seller inquiry count is broken

Evidence:

- `backend/routes/listings.js`
  - listing fetch for message creation does not select `message_count`
  - follow-up update uses `(listing.message_count || 0) + 1`

Impact:

- message counts can be reset to `1` repeatedly
- seller inbox stats and marketplace overview stats become unreliable

#### G. Seller messages page does not match the API payload

Evidence:

- `backend/routes/listings.js`
  - `/api/listings/:id/messages` returns `buyer:buyer_id (...)`
- `frontend/apps/web/src/app/(app)/app/marketplace/[id]/messages/page.tsx`
  - UI reads `sender`, `user`, `sender_id`, `user_id`, `content`, and `text`

Impact:

- sender identity falls back to anonymous
- reply action can be missing or broken
- a core seller workflow is visibly unreliable

#### H. Remote/locationless listings are effectively dropped from the new marketplace

Evidence:

- `backend/services/marketplace/marketplaceService.js`
  - browse excludes `NULL` coordinates
- `frontend/packages/ui-utils/src/marketplace-constants.ts`
  - UI exposes a `remote` pill
- `frontend/apps/web/src/app/(app)/app/marketplace/page.tsx`
  - `remote` and `new_today` pills are not handled in filter logic
- `backend/tests/unit/listingsRemoteRegression.test.js`
  - existing regression test explicitly asserts remote/locationless listings must remain visible in nearby results

Impact:

- remote listings are a product promise but not a working behavior in the new surface
- the UI offers filters that do nothing
- new browse experience regresses prior behavior

### 3.2 Secondary Findings

These are not as severe as the blockers above, but they are still important before broad launch.

#### I. Marketplace-specific TypeScript contract is not clean

Marketplace files fail type-check for reasons including:

- undefined references like `STATUS_OPTIONS`
- stale shapes for `ListingQuestion`
- stale shapes for `ListingMessage`
- mismatches between `ListingDetail`, list item data, and view components
- missing icon mappings for visible filter keys

Impact:

- future changes will be slower and riskier
- product regressions can slip in because the type system is not protecting the contracts

#### J. Inventory cap enforcement is race-prone

Evidence:

- `backend/routes/listings.js`
  - cap is checked before insert
  - slot count is incremented later in a separate operation

Impact:

- concurrent creates can exceed caps
- address-attached inventory integrity degrades under real traffic

#### K. “New listings” socket banner is global, not scoped

Evidence:

- `frontend/apps/web/src/app/(app)/app/marketplace/page.tsx`
  - increments for every `listing:new` event without checking active bounds, filters, or tab

Impact:

- banner can be noisy and misleading
- user trust in real-time signals drops

#### L. Discovery and count reporting are approximate, not authoritative

Evidence:

- `backend/services/marketplace/marketplaceService.js`
  - count query runs asynchronously
  - fallback count is a rough estimate from the current page

Impact:

- counts can fluctuate or under-report
- “snapshot” style metrics are not reliable enough for seller trust or decision-making

#### M. Category clusters are sampled, not representative

Evidence:

- `backend/services/marketplace/marketplaceService.js`
  - category clusters are built from up to 200 recent listings and aggregated in JS

Impact:

- discovery category modules can misrepresent inventory distribution
- the issue gets worse as the marketplace grows

#### N. Save behavior is inconsistent between list and map detail preview

Evidence:

- grid/list view uses optimistic save state
- map preview save button calls the API but does not update shared UI state consistently

Impact:

- saved state can appear flaky
- users lose confidence in one of the core engagement actions

## 4. Production Readiness Plan

### Phase 0. Ship Blockers

Goal:

- make the marketplace safe, correct, and internally coherent

This phase is mandatory before any broad rollout.

#### Workstream 0A. Privacy and trust hardening

Tasks:

- stop auto-attaching exact coordinates in create flow without explicit user choice
- introduce a clear location-sharing model in create/edit:
  - exact meetup area
  - approximate area
  - neighborhood only
  - remote / no location
- enforce privacy rules consistently in browse, discover, detail, search, and saved listings
- add a single backend helper that transforms listing location fields for viewer context
- verify business rules for `reveal_policy`, `location_precision`, and `visibility_scope`

Acceptance criteria:

- no browse response returns exact coordinates unless policy explicitly allows it
- detail and browse return consistent privacy-safe location shapes
- create/edit UI makes location-sharing level visible and understandable

#### Workstream 0B. Contract unification

Tasks:

- define one canonical listing contract for:
  - categories
  - conditions
  - listing types
  - filters
  - message payloads
  - question payloads
- make `frontend/packages/ui-utils`, `frontend/packages/api`, `frontend/packages/types`, and backend validation all use the same source of truth
- remove or hide unsupported categories and filters until backend support exists

Acceptance criteria:

- every category and condition shown in UI is valid on create, edit, and browse
- type-check for marketplace files is clean
- web and backend tests cover the shared enum contract

#### Workstream 0C. Broken flow repair

Tasks:

- fix listing edit verb mismatch
- fix seller messages page payload mapping
- fix message count increment logic
- fix save-state consistency across list, map preview, detail, and saved listings
- implement or remove `remote` and `new_today` pills

Acceptance criteria:

- create, edit, save, unsave, message seller, view seller messages, and refresh listing all work end to end
- message count stays monotonic and accurate

#### Workstream 0D. Auth-aware browse and discover

Tasks:

- add soft-auth middleware for browse/discover/autocomplete
- populate viewer context when token is present without making the routes auth-required
- apply hidden/muted/blocked filtering consistently
- return `userHasSaved` correctly in browse/discovery

Acceptance criteria:

- authenticated and anonymous responses differ only where intended
- hidden/blocked content never appears to the affected viewer
- saved-state is consistent across all marketplace surfaces

#### Workstream 0E. Ranking correctness

Tasks:

- replace JS-sorted “nearest” with database-backed distance ordering
- decide explicit handling for remote listings in sort semantics
- define what “nearest” means for:
  - exact coordinates
  - approximate area
  - remote listings

Acceptance criteria:

- nearest sort remains correct with thousands of listings
- cursor pagination for nearest remains deterministic and complete

### Phase 1. Robustness and Reliability

Goal:

- remove hidden failure modes and concurrency risks

#### Workstream 1A. Transactional integrity

Tasks:

- make inventory cap enforcement transactional or database-enforced
- move counter updates to safe server-side logic or triggers
- add idempotency where repeated clicks or retries can duplicate work

Acceptance criteria:

- concurrent create requests cannot exceed address caps
- retries do not corrupt counts or duplicate side effects

#### Workstream 1B. Error handling and empty states

Tasks:

- standardize loading, retry, and empty states across map, grid, detail, create, edit, and seller inbox
- expose actionable error messages to users
- avoid silent failures in catches that currently do nothing

Acceptance criteria:

- all critical marketplace actions show success or failure clearly
- no core action fails silently

#### Workstream 1C. Real-time correctness

Tasks:

- scope `listing:new` updates by active bounds, tabs, and filter state
- deduplicate repeated socket events
- support “new since your last view” semantics instead of raw increment spam

Acceptance criteria:

- real-time banners reflect relevant inventory only
- real-time signals are trusted by users

### Phase 2. Performance and Scalability

Goal:

- make marketplace behavior correct and fast as volume grows

#### Workstream 2A. Query architecture

Tasks:

- move proximity ranking to Postgres/PostGIS or equivalent database-native ordering
- design dedicated paths for:
  - browse in bounds
  - nearby search
  - remote listings
  - discovery sections
- avoid JS aggregation for ranking-critical behaviors

Acceptance criteria:

- map browse and nearest sort stay correct under high inventory
- p95 browse and discover latency targets are met

#### Workstream 2B. Count and discovery accuracy

Tasks:

- replace rough count fallback with reliable count strategy
- decide where approximate counts are acceptable and label them clearly if used
- redesign category clusters using authoritative grouped data rather than a 200-row sample

Acceptance criteria:

- counts and clusters are explainable and stable
- seller-facing metrics are accurate enough to influence decisions

#### Workstream 2C. Search quality

Tasks:

- define search behavior for titles, categories, synonyms, and remote listings
- ensure autocomplete, search, browse, and category filters share the same vocabulary
- add search monitoring for zero-result rates and misleading filter combinations

Acceptance criteria:

- search suggestions map to actual retrievable inventory
- zero-result states are meaningfully reduced

## 5. UX Plan: From Functional to Excellent

After the blockers are fixed, the next step is not more features. The next step is product sharpness.

### 5.1 Core UX improvements

- make location sharing explicit and easy to understand
- add trust explanation:
  - why a listing is shown
  - what “Verified Neighbor” means
  - what level of location precision is being shown
- improve zero-result flows:
  - “expand area”
  - “save search”
  - “notify me”
  - “post what you need”
- make seller inbox more actionable:
  - inquiry state
  - response status
  - unread badges
  - quick accept / quick reply patterns where appropriate

### 5.2 Product differentiation ideas after stabilization

- saved searches with notifications
- explainable ranking signals on demand
- listing freshness and response-time badges
- better seller reputation surfaces
- neighborhood inventory trends
- stronger remote/local mode split rather than hiding remote in generic browse

## 6. Testing Plan

The marketplace needs a dedicated protection suite. Existing coverage is too thin for this surface.

### 6.1 Unit tests

Add tests for:

- listing privacy transformation by viewer context
- enum contract parity across frontend and backend
- browse param building
- remote listing inclusion rules
- nearest cursor encoding and pagination
- message count updates
- save toggle state transitions

### 6.2 Integration tests

Add route-level integration coverage for:

- create listing with each supported category and condition
- edit listing success path
- browse with and without auth token
- blocked/muted/hidden listing exclusion
- seller messages payload shape
- question and answer payload shape
- remote listing behavior
- inventory cap under concurrent creates

### 6.3 End-to-end tests

Add browser tests for:

- create listing
- edit listing
- save/unsave from grid, map preview, and detail
- search and filter combinations
- seller viewing messages and replying
- privacy-safe browse behavior for approximate vs remote listings

### 6.4 Load and correctness tests

Before broad launch:

- load test browse/discover on realistic inventory sizes
- validate nearest ranking against a known dataset
- validate cursor pagination under heavy inventory churn

## 7. Observability and Release Gates

The marketplace should not be launched without dedicated telemetry.

### 7.1 Metrics

Track at minimum:

- browse latency p50/p95/p99
- discover latency p50/p95/p99
- zero-result search rate
- create failure rate
- edit failure rate
- message send failure rate
- seller message page load failure rate
- save/unsave failure rate
- percentage of listings with exact vs approximate vs remote location
- counts of hidden/block exclusion hits

### 7.2 Logging

Add structured logs for:

- browse and discover query params
- privacy transformation decisions
- counter updates
- seller message creation
- inventory cap enforcement path
- autocomplete behavior

### 7.3 Alerting

Alert on:

- spikes in 4xx/5xx for marketplace routes
- latency regressions on browse/discover
- create/edit failure spikes
- anomalous drop in seller message creation
- high zero-result rate after deployment

### 7.4 Release gates

Do not ship until:

- Phase 0 work is complete
- marketplace-specific type-check is clean
- integration and e2e coverage exists for create/edit/browse/message/save
- privacy review is complete
- browse/discover latency is within target on realistic load

## 8. Rollout Strategy

### 8.1 Safe rollout order

1. Internal-only
2. Staff + seeded users
3. Small geography or cohort
4. Wider authenticated rollout
5. Marketing or growth push only after metrics are stable

### 8.2 Feature flags

Gate separately:

- new browse service
- remote listing support
- nearest ranking implementation
- seller inbox UI
- real-time listing banner

### 8.3 Rollback plan

Prepare rollback for:

- browse service path
- nearest sort implementation
- real-time event behavior
- create/edit flow changes

## 9. Suggested Execution Order

### Week 1: stop the bleeding

- privacy-safe browse
- enum contract unification
- edit route fix
- seller message count fix
- seller message payload fix

### Week 2: restore trust

- soft-auth browse/discover
- remote listing strategy
- remove or implement dead filters
- marketplace-specific type cleanup

### Week 3: make results trustworthy

- database-backed nearest ranking
- count and cluster accuracy improvements
- end-to-end regression coverage

### Week 4: harden for scale

- inventory cap transaction safety
- observability dashboards and alerts
- load testing and rollout rehearsals

## 10. Final Position

The marketplace has the ingredients for a strong product:

- unified browse surface
- map + grid interaction model
- seller inbox concept
- trust badges
- discovery modules

But it currently fails the reliability and trust bar that a production marketplace needs.

The path forward is clear:

- fix safety and correctness first
- unify the contract second
- make ranking and seller workflows dependable third
- then invest in quality-of-life and differentiation

If this sequence is followed, the marketplace can move from “fragile but promising” to a real flagship product surface.
