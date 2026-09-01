# Phase 1 · Block P1-C — Business owner data wiring (notes)

**Date:** 2026-06-03
**Scope:** native iOS + Android. Business **owner** screens only (team/roles is Phase 2).
**Branch:** `claude/upbeat-pasteur-arnFh`

Summary of the three screens in this block:

| Screen | Outcome | Reason |
|---|---|---|
| Owner Dashboard | ✅ **Wired** (both platforms) | Content model holds real-mappable data; owner endpoints exist. |
| Page Editor (Edit Business Page) | ⛔ **STOP-and-report** | Read-only visual prototype — no inputs/field-setters, so "save" has no user edits to round-trip; content model is sample-coupled (palette enums, no image URLs, orphan `price` field). |
| Create Business | ⛔ **STOP-and-report** | Wizard steps 2–4 are unbuilt stubs that collect no create payload; the only mutation it references (`POST /api/businesses/custom-categories`) does not exist. |

Per the Phase-1 recipe's hard rule ("never fabricate an endpoint … do not invent a
backend or leave a silent stub"), the two prototype screens are reported here rather
than wired with fabricated/lossy data. The **backends for them exist and are
identified below** — the blocker is the front-end (no edit/data-collection layer),
not the API.

---

## 1. Owner Dashboard — WIRED ✅

iOS `Features/Businesses/OwnerDashboard/BusinessOwnerViewModel.swift`
Android `ui/screens/businesses/owner_dashboard/BusinessOwnerViewModel.kt`

| Element | Wiring |
|---|---|
| Public render (`publicProfile`) | Reuses the Business Profile projection — `GET /api/businesses/:businessId` (businesses.js:912) + `GET /api/businesses/public/:username` (businesses.js:3277) + public-profile reviews/stats. iOS reuses `BusinessProfileViewModel`; Android extracts a pure `BusinessProfileMapper`. |
| Live status + edit recency + profile-strength checklist | `GET /api/businesses/:businessId/dashboard` (businesses.js:979) — `profile.is_published`, `profile.updated_at`, `onboarding.checklist/completed_count/total_count`. |
| "This week" insight tiles | `GET /api/businesses/:businessId/insights` (businesses.js:3915) — `views`/`followers`/`reviews` + week-over-week trends. |
| Reviews list (reply composer) | `GET /api/businesses/:businessId/reviews` (businesses.js:3441). |
| Submit reply (mutation) | `POST /api/businesses/:businessId/reviews/:reviewId/respond` (businesses.js:3552) — optimistic update + rollback on failure. |
| Business picker that opens this screen | `GET /api/businesses/my-businesses` (businesses.js:682) — **already wired** in `MyBusinessesViewModel` (no change needed). |

States: loading (shimmer) / loaded / not-found / error (retry) — all reachable.
`testTag` / `accessibilityIdentifier` strings unchanged. `BusinessOwnerSampleData`
retained as the preview/snapshot seam (`content:` on iOS, `seedForPreview` on Android).

**Design-vs-data note:** the design's insight tiles read *Views / Saves / Contacts*,
but the backend only exposes *views / followers / reviews* analytics. Tiles are mapped
to the real metrics (Views / Followers / Reviews) — there is no "saves" or "contacts"
counter to surface and Phase 1 must not fabricate one. Positive trends only render the
up-arrow pill (matches the tile component, which draws a fixed up-arrow).

---

## 2. Page Editor (Edit Business Page) — STOP-and-report ⛔

iOS `Features/Businesses/PageEditor/*` · Android `ui/screens/businesses/page_editor/*`

**Save endpoint (confirmed, exists):** `PATCH /api/businesses/:businessId`
(businesses.js:1072, `updateBusinessSchema` businesses.js:124) — accepts
`name, tagline, bio, business_type, categories, description, public_email,
public_phone, website, founded_year, employee_count, service_area, is_published, …`.
Publish toggle is the same route with `is_published: true` (or
`POST /:businessId/publish` businesses.js:1288).

**Why it cannot be wired in Phase 1 (front-end blocker):**

1. **The screen is a read-only visual prototype.** `BizField` renders
   `Text(field.current …)` and `BizTextarea` renders `Text(field.current)` — there
   are **no `TextField`s / input bindings**, and the view-model exposes **no field
   setters** (only `load/save/saveDraft/publish/discard`). The content model fields
   are immutable (`let`). A user cannot enter any edit, so `save()` has nothing the
   user changed to send — wiring it to `PATCH` would round-trip the just-loaded
   values unchanged. The `original ≠ current` dirty states only exist because the
   sample fixtures pre-bake them. Parity confirmed: the Android VM has no setters /
   repository / API references either.
2. **The content model is sample-coupled.** Banner/logo/gallery are represented by
   single-case, Roost-Café-specific palette enums
   (`BannerPalette.cafeGoldenHour`, `LogoPalette.sunrise`,
   gallery `Palette{croissant,coffee,interior,bread,latte,crowd}`) with **no
   image-URL/file-id field**, so real `logo_file_id` / `banner_file_id` / gallery
   images cannot be represented. There is also a top-level `price` field with no
   business-profile backend source. Faithfully loading an arbitrary business would
   require **restructuring the content model/View**, which the recipe forbids.

**To unblock (future prompt / phase):**
- Convert `BizField`/`BizTextarea` to real inputs bound to view-model field-setters
  (capture edits → dirty tracking from real `original`).
- Replace the palette enums with image URLs/file-ids (banner/logo/gallery), and add
  image upload via `MultipartUploader` (separate from the JSON `PATCH`).
- Decide the source (or removal) of the `price` field.
- Then: `load()` ← `GET /:businessId` (+ public hours/catalog + dashboard onboarding
  for setup mode); `save()`/`saveDraft()` → `PATCH /:businessId` (dirty profile
  fields); `publish()` → `PATCH is_published:true`. Hours/services/location/images
  edits each need their own existing endpoints
  (`PUT /:businessId/locations/:locationId/hours`, the catalog routes,
  `PATCH /:businessId/locations/:locationId`, file upload).

No code changed for this screen — the sample/preview seam is left intact to avoid a
regression and to avoid fabricating display data (e.g. a café banner palette on a
non-café business).

---

## 3. Create Business — STOP-and-report ⛔

iOS `Features/Businesses/CreateBusiness/*` · Android `ui/screens/businesses/create_business/*`

**Create endpoints (confirmed, exist):**
`POST /api/businesses` (businesses.js:401, `createBusinessSchema` businesses.js:112 —
requires `username, name, email`),
`POST /api/businesses/create-full` (businesses.js:554, `createBusinessFullSchema`).
**Founding offer:** `GET /api/businesses/founding-offer/status`
(businessFounding.js:29), `POST /api/businesses/:businessId/founding-offer/claim`
(businessFounding.js:98).

**Why it cannot be wired in Phase 1 (front-end blocker):**

1. **No create payload is collected.** Only step 1 (pick-category) is built; it
   captures `selectedCategoryId` + `searchText` and nothing else. Steps 2–4
   (`legalInfo`, `profile`, `confirm`) are explicit stub placeholders
   (`createBusinessStubPlaceholder`) that "gate the CTA open so the flow can be
   walked end-to-end" and collect **no** `name` / `username` / `email` /
   description / address / legal info. `primaryTapped()` on `.confirm` just sets
   `pendingEvent = .dismiss` — there is no create call. Building those steps is new
   design/forms, explicitly **out of Phase 1 scope** ("No new design").
2. **The one mutation it references doesn't exist.** `submitCustomCategory()` is a
   stub with `TODO(audit-q3): wire to POST /api/businesses/custom-categories` —
   that route is **not present** in `backend/routes/businesses.js` (or any business
   route file). Per the hard rule, this is reported, not invented.
3. **Founding offer is conditional and not shown.** The block ties the founding
   endpoints to "*if the create flow shows the offer*". The wizard shows **no**
   founding-offer step/banner, so those endpoints are out of scope for this screen
   as built.

**To unblock (future prompt / phase):** build the data-collection steps (name +
username + email + business_type/categories + optional description/address), add a
username-availability check (`GET /api/businesses/check-username`, businesses.js:358),
then wire the confirm step's submit to `POST /api/businesses` (or `/create-full`) and,
if the founding-offer surface is added, `GET /founding-offer/status` +
`POST /:businessId/founding-offer/claim`.

---

## Verification

Owner Dashboard tests updated/added on both platforms:
- iOS `BusinessOwnerViewModelTests` — injected-content seam, live primary-failure →
  error, pure projection (`makeContent`: tiles/strength/reviews), optimistic reply.
- Android `BusinessOwnerViewModelTest` — mocked-repo projection, primary 404 →
  not-found, dashboard 403 → error, optimistic reply + rollback.
- Android `BusinessProfileViewModelTest` is unchanged and still guards the extracted
  `BusinessProfileMapper` (the VM keeps a thin `computeOpenState` wrapper).

**Build/lint could not be run in this environment** (no iOS toolchain; no Android SDK
/ AGP network access in the container). The changes were self-reviewed against the
existing wired references and the project conventions. Before merge, run:
- iOS: `make bootstrap` (only if project files changed — none were added here) →
  build Pantopus scheme → `swiftformat --lint` + `swiftlint` on changed files.
- Android: `./gradlew :app:assembleDebug ktlintCheck detekt test` on the changed
  modules.
