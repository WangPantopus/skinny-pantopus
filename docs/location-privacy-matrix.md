# Location Privacy Matrix

Defines how location coordinates are exposed across entity types, viewer
relationships, and precision levels. **Every API response that includes
coordinates MUST pass through `applyLocationPrecision()` before serialization.**

## Precision Levels

| Level              | Coordinate Treatment            | Address Text       | Map Pin         |
|--------------------|---------------------------------|--------------------|-----------------|
| `exact_place`      | Full lat/lng (6+ decimals)      | Full address       | Exact pin       |
| `approx_area`      | Rounded to ~0.005 (~500m jitter)| City, State only   | Fuzzy circle    |
| `neighborhood_only`| Rounded to ~0.01 (~1km)         | Neighborhood/City  | Area indicator  |
| `none`             | `null` / omitted                | Omitted            | No pin          |

## Entity Rules

### Homes

| Viewer Relationship | Coordinates Returned     | Address  |
|---------------------|--------------------------|----------|
| Household member    | exact (from Home record) | Full     |
| Non-household       | **NEVER**                | City/State only |
| Public/anonymous    | **NEVER**                | City/State only |

> Homes are the most sensitive entity. Exact coordinates must never leak to
> anyone outside the household. The `Home` table's `location` column is only
> used for server-side distance calculations — it is never serialized to
> non-household API responses.

### Businesses

| Viewer Relationship | Coordinates Returned     | Address  |
|---------------------|--------------------------|----------|
| Owner / team member | exact                    | Full     |
| Public              | exact (owner controls)   | Full     |

> Business locations are intentionally public and discoverable. Owners opt-in
> to showing their address. No precision downgrade is applied.

### Gigs

| Viewer Relationship            | Coordinates Returned                       | `locationUnlocked` |
|--------------------------------|--------------------------------------------|---------------------|
| Creator / beneficiary          | exact (always)                              | `true`             |
| Accepted helper (assigned/active/in_progress/completed) | exact | `true`             |
| Browsing (not assigned)        | Respect `location_precision` field          | `false`            |
| `reveal_policy = after_assignment` | `approx_area` until assigned, then exact | status-dependent   |
| `reveal_policy = never_public` | `approx_area` always for non-owner          | `false`            |

Default `location_precision`: **`approx_area`**
Default `reveal_policy`: **`after_assignment`**

**Progressive disclosure:** When a bid is accepted, the accepted helper's gig
status transitions to `assigned`. At that point `resolveGigPrecision()` returns
`exact_place` + `locationUnlocked: true`. A system message with the address is
also posted to the gig chat, and the bid-accepted notification includes the
address.

### Listings (Marketplace)

| Viewer Relationship            | Coordinates Returned                       | `locationUnlocked` |
|--------------------------------|--------------------------------------------|---------------------|
| Creator                        | exact (always)                              | `true`             |
| Address grantee (in `ListingAddressGrant`) | exact                       | `true`             |
| Browsing (not creator, no grant)| Respect `location_precision` field         | `false`            |
| `reveal_policy = after_interest` | `approx_area` until grant issued          | `false` → `true`   |

Default `location_precision`: **`approx_area`**

**Progressive disclosure:** Listing authors can explicitly reveal their address
to a buyer via `POST /api/listings/:id/reveal-address`. This creates a row in
the `ListingAddressGrant` table. The grantee then receives exact coordinates
and `locationUnlocked: true`. Authors can list grants (`GET`) and revoke them
(`DELETE`). A system message is posted to the listing chat upon grant creation.

> Already partially enforced in `GET /api/listings/:id` (listings.js:1060-1073).
> This document codifies and extends that behavior.

### Posts (Feed)

| Viewer Relationship | Coordinates Returned                       | `locationUnlocked` |
|---------------------|--------------------------------------------|---------------------|
| Author              | exact (always)                              | `true`             |
| Other viewers       | **Minimum `approx_area`** (permanent blur)  | `false` (always)   |

Default `location_precision`: **`approx_area`**
Home-place posts forced to: **`approx_area`** (enforced at creation time)

**Permanent blur:** Non-authors never see exact post locations, even if the
author set `location_precision = exact_place` and `reveal_policy = public`.
The feed service and post detail endpoint enforce a floor of `approx_area`
via `leastPrecise()`. Posts always return `locationUnlocked: false` for
non-authors.

### Saved / Viewing Places

These are per-user preferences stored locally or in `SavedPlace`.
**Never exposed to other users** in any API response.

## Implementation

### Backend Utility

`backend/utils/locationPrivacy.js` exports:

```js
applyLocationPrecision(obj, precision, isOwner, opts)
// opts.setUnlockedFlag (default true) — sets obj.locationUnlocked
resolveGigPrecision(gig, viewerId)
// Returns { precision, isOwner, locationUnlocked }
precisionRank(precision)
leastPrecise(a, b)
```

- If `isOwner === true` → return coordinates unchanged, `locationUnlocked: true`
- If `precision === 'exact_place'` → return coordinates unchanged, `locationUnlocked: true`
- If `precision === 'approx_area'` → jitter ±0.005 (~500m), strip address, `locationUnlocked: false`
- If `precision === 'neighborhood_only'` → round to 2 decimals (~1km), strip address, `locationUnlocked: false`
- If `precision === 'none'` → null out lat/lng, strip address and location_name, `locationUnlocked: false`

`backend/services/marketplace/locationPrivacy.js` exports:

```js
applyLocationPrivacy(listing, viewerUserId, opts)
// opts.grantedUserIds — Set of user IDs with address grants
applyLocationPrivacyBatch(listings, viewerUserId, opts)
// opts.grantsByListingId — Map<listingId, Set<userId>>
```

- Grantees (users in `ListingAddressGrant`) get exact coords + `locationUnlocked: true`

### API Response Flag

All entity endpoints now include a `locationUnlocked` boolean:
- `true` — client may show exact pin, full address string, remove blur circle
- `false` — client should show radius circle, hide street-level address

### Where Applied

| Route / Service                         | Entity   | Status |
|-----------------------------------------|----------|--------|
| `GET /api/gigs/:id`                     | Gig      | Fixed  |
| `GET /api/gigs` (list)                  | Gig      | Fixed (per-viewer `resolveGigPrecision`) |
| `GET /api/gigs/browse` (v2 RPC)        | Gig      | Fixed (privacy loop before sectioning) |
| `GET /api/gigs/nearby`                  | Gig      | Fixed (privacy loop on results) |
| `GET /api/gigs/in-bounds`              | Gig      | Fixed (privacy in enrichment) |
| `feedService.normalizeFeedPostRow()`    | Post     | Fixed (permanent blur via `leastPrecise`) |
| `GET /api/posts/:id`                    | Post     | Fixed (permanent blur for non-authors) |
| `GET /api/posts/map` (tasks layer)      | Post     | Fixed (`resolveGigPrecision` per gig) |
| `GET /api/posts/map` (offers layer)     | Post     | Fixed (`resolveGigPrecision` per gig) |
| `GET /api/listings/:id`                 | Listing  | Fixed (grant-aware, `locationUnlocked`) |
| `GET /api/listings` (browse)            | Listing  | Fixed |
| `GET /api/listings/search` (RPC)        | Listing  | Fixed (viewer-aware) |
| `GET /api/listings/search` (fallback)   | Listing  | Fixed (viewer-aware) |
| `GET /api/listings/user/:userId`        | Listing  | Fixed (viewer-aware) |
| `GET /api/listings/carousel`            | Listing  | Fixed (viewer-aware) |
| `GET /api/listings/in-bounds`           | Listing  | Fixed (`applyLocationPrivacyBatch`) |
| `GET /api/listings/nearby`              | Listing  | Fixed (`applyLocationPrivacyBatch`) |
| `POST /api/listings/:id/reveal-address` | Listing  | New (creates grant + chat msg) |
| `GET /api/listings/:id/address-grants`  | Listing  | New (author-only) |
| `DELETE /api/listings/:id/address-grants/:userId` | Listing | New (revoke grant) |
| Home routes (all)                       | Home     | No coordinates returned to non-members (verified) |
| Business discovery                      | Business | exact (intentional) |

## Pin Visibility Rules

### Verified vs Unverified Pin Rendering

Businesses with a verified address (`BusinessLocation.decision_status = 'ok'`)
are returned with `verified: true` in the map marker response. The frontend
should render these with a distinct visual treatment (e.g., checkmark badge,
solid border) to distinguish them from unverified listings.

| Entity Type     | Pin Visible On Map? | Verified Badge? | Coordinate Source            |
|-----------------|---------------------|-----------------|------------------------------|
| Verified Business | Yes (public)       | Yes (`verified: true`) | Address validation pipeline |
| Unverified Business | Yes (public)     | No              | Mapbox geocode               |
| Home            | **NEVER** (public)   | N/A             | N/A (household-only access)  |
| Gig             | Yes (public)         | No              | Precision-controlled         |
| Listing         | Yes (public)         | No              | Precision-controlled         |
| Post            | Yes (public)         | No              | Precision-controlled         |

### Home Pin Rules (Critical)

Home pins are **only** visible to household members. Even verified homes with
verified addresses must NEVER appear on public map surfaces:

- `GET /api/businesses/map` — only returns businesses, never homes
- `GET /api/posts/map` — returns post locations, not home coordinates
- `GET /api/gigs/in-bounds` — returns gig locations, not home coordinates
- `GET /api/homes/:id` — requires `checkHomePermission` (403 for non-members)
- `GET /api/homes/:id/public-profile` — returns text address only, no coordinates
- `GET /api/location` — returns authenticated user's own homes only
- `GET /api/hub` — returns authenticated user's own homes only

**Verification does NOT equal public visibility.** A verified home address
confirms the user lives there; it does not make the location public.

### Verified Coordinate Guard

Rows with `geocode_mode: 'verified'` are protected from non-verified overwrites.
See `backend/utils/verifiedCoordinateGuard.js`:
- `shouldBlockCoordinateOverwrite()` blocks non-verified writes to verified rows
- Applied to: `PATCH /api/homes/:id`, `PATCH /api/businesses/:id/locations/:id`
- Verified-to-verified overwrites are allowed (re-validation pipeline)

## Audit Checklist

- [x] Home coordinates never sent to non-household (verified: discover + public-profile omit lat/lng)
- [x] Gig detail enforces location_precision + reveal_policy + `locationUnlocked`
- [x] Gig list applies per-viewer `resolveGigPrecision`
- [x] Gig nearby/in-bounds/browse enforce location privacy
- [x] Post detail enforces permanent blur for non-authors (`leastPrecise`)
- [x] Feed service enforces permanent blur on every row
- [x] Posts/map tasks+offers layers enforce per-gig privacy
- [x] Listing detail enforces location_precision + grant-awareness + `locationUnlocked`
- [x] Listing browse enforces location_precision
- [x] Listing search/user/carousel pass viewer ID for privacy
- [x] Listing in-bounds/nearby enforce `applyLocationPrivacyBatch`
- [x] Listing address grants: create, list, revoke endpoints
- [x] Business discovery returns exact (intentional, owner-controlled)
- [x] Business map markers include `verified` flag based on address decision_status
- [x] Business search results include `address_verified` flag
- [x] Chat location messages: only share sender's own location (no home leak)
- [x] Shareable links / SEO pages: no coordinates in HTML meta or URL params
- [x] Verified coordinates protected from non-verified overwrites
- [x] `locationUnlocked` boolean included in all entity API responses
- [x] Gig bid acceptance posts address system message to chat
- [x] Listing reveal-address posts system message to chat
- [x] `ListingAddressGrant` table with RLS policies created
