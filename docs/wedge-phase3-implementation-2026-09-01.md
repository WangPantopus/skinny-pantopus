# Wedge v2 — Phase 3 implementation record (2026-09-01)

Third slice of "The Pantopus Wedge" v2, after the real-data aha audit. Everything here is engineering that needed no founder decision; the founder items and the two product calls stay at the end of the Phase 2 record.

## What shipped

### 1. The wedge is measurable — aha rate and share rate
- Two client beacons join `FunnelEvent`: `t0_aha_viewed` (meta: `section_id`, `tone`, `grade`) and `t0_share_clicked` (meta: `method` share|copy). Migration **196** (`supabase/migrations/20260901000003_…`) widens the CHECK constraint. The web funnel fires them from the aha card and the share link; metas never carry the address (asserted in `tests/startFunnel.test.tsx`).
- `services/funnelReport.js` + **`GET /api/admin/funnel/summary?days=30`**: previews → aha → share → wall → register → account, per distinct visitor (anon id) with event totals alongside; the **aha rate** excludes calm cards; the ladder is also split by the `?r=` route on every beacon, which is the route-level CAC the EDDM drop needs. Anon ids are counted, never returned.

### 2. The privacy promise has a net — evidence retention sweep
- `jobs/evidenceRetentionSweep.js`, daily 04:17 UTC (`householdClaimJobsDryRun` honoured): every evidence row still pointing at an S3 object whose claim is decided (`state` approved/rejected/revoked, or `claim_phase_v2` verified/rejected/expired/withdrawn, or the claim row gone) is purged through `evidencePurge`. Open claims are untouched. A row cascade-deleted with its claim cannot be found from the table; that is a manual bucket clean-up, noted in the job header.

### 3. The privacy mirror
- `serializers/homeProfileSerializer.js` is now the one projection of a home for a viewer; `GET /api/homes/:id/public-profile` uses it (identical output), and **`GET /api/identity-center/view-as?surface=home&home_id=…`** (members only, `services/homeMirror.js`) returns the same projection with `reveal=false` plus `HIDDEN_FROM_OUTSIDERS` — house number and unit, zip, last name, household, uploaded documents, move-in date. Because both routes share the serializer, the mirror cannot drift from what an outsider actually gets (`tests/unit/homeMirror.test.js` asserts equality).
- Web: **`/app/homes/[id]/privacy`** ("What neighbors see") renders the neighbor card from the API — first name, street · city — the hidden list, and the privacy promise; the Place dashboard carries a one-line "Private by default. See what neighbors see of this address." row.

### 4. Native previews render the aha card and the sections (iOS)
- `PlacePreview` decodes `aha` (`PlacePreviewAha`, tone open-set → `.info`) and `sections` (`[PlaceSectionEnvelope]`, the dashboard's envelope). `PlacePreviewBody` leads with the aha card (grade chip by tone, headline, detail, follow-up → create account), then the Band-A sections grouped in the launch order through `PlaceSectionView`, then the locked Band-B card; a backend that sends only `free` still renders the three legacy tiles. Decoding tests in `PlaceMoneyLeadDecodingTests`. Android still renders `free` (Android batch).

### 5. The Nearby window — density by block cell
- **`GET /api/neighborhood/cells`**: the 5×5 grid of geohash-6 cells around the viewer's place, each with ONLY its bucket from `densityReader.bucketForCount` (none / forming / few / growing) — never a count below the k-anon floor and never a point; the viewer's cell is flagged and the returned centre is the cell's centre. Web `NearbyCellsMap` (react-leaflet, client-only) shades cells by bucket, outlines the home cell, and says so in the caption; it sits above the meter in every state that has a place. Tiles need `NEXT_PUBLIC_MAPBOX_TOKEN`; the cells render without it.

### 6. The Android batch (same day, third slice)
Android had never left the five-tab hub IA (Home · Pulse · Tasks · Marketplace · Messages). It now matches web and iOS:
- **Tabs** (`PantopusRoute`): **Place · Today · Nearby · Mail**. Place keeps the legacy `root/home` path (deep links and saved state survive) and still lands on the Place dashboard when a primary home exists. Pulse, Tasks, Marketplace and Messages stay registered as routes off the bar — every existing push still lands — and `fromPath` resolves them so the bar simply shows no selection there. The inbox badge moved to Mail.
- **Today tab** (`ui/screens/place/today/`): the primary home's Today group as a tab root (resolved from `/api/homes/my-homes` like the Place tab), with a claim prompt when there is no place. `PlaceTodayDetailContent` now takes an `AddressCalendarActions` host so the Today tab and the Place detail page share one card.
- **Address calendar** (D6): `address_calendar` section id, `PlaceAddressCalendarData` / `PlaceCalendarEvent` DTOs, adapter branches, presentation config + reading, the calendar card with the weekday picker and "clear" in the Today content, `PlaceApi` calendar endpoints, repository + view-model actions. The "Trash & recycling — coming soon" row is gone because it shipped.
- **Nearby tab** (`ui/screens/nearby/`): `NeighborhoodApi` (meter + cells) and repository; the cells window as Google Maps Compose polygons shaded by the same buckets (`cellFillAlpha`), the home cell outlined, the legend from the server; the honest meter (count withheld below the k-anon floor); the three surfaces as a locked preview with a meter, or live rows into Pulse / Marketplace / Tasks once unlocked.
- **Mail tab**: `MailboxRootScreen` at the root with an inbox entry ("Messages") above the drawers, so chat lives inside Mail.
- **Residency door** (D3): the verify sheet offers **document · mail · landlord** in that order with honest latency copy, and each pushes a real flow — the residency variant of the claim wizard (`verifyResidency`), the postcard, the landlord wizard — instead of the status mock-up.
- **Founding tier** (D5): `BlockFounding` on `BlockStatus` and the founding line under the rank row, copy identical to iOS (`BlockFounding.line()` is pure and tested).
- **Movers** (D5): `HomeDetail.move_in_date`, the dashboard loads the home row alongside the intelligence, and `JustMovedCard` (60-day window, `isRecentMove` pure and tested) leads the page with five links into Today, Mail Day, Money, Civic, and the block.
- **Preview** (D1): `PlacePreview.aha` + `sections`; the launch screen leads with the aha card (tone → chip, icon), then every Band-A section through `PlaceSectionView` grouped in the launch order; a backend that sends only `free` still renders the three tiles.
- Tests: `PlaceWedgeDecodingTest` (5: aha + sections, unknown tone, address calendar reading, founding line, movers window), `NeighborhoodDecodingTest` (3). `make build` / `make lint` — see the commit.

### 7. National footing (same day, fourth slice)
YP asked whether the product was "only Camas". The logic never was; the content was. Two hooks fixed:
- **Calendar registry, 50 states.** Migration **197** seeds the property-tax due dates for every state whose schedule is set statewide by statute (36 states + DC, 69 rows), all `unverified` with the state revenue source named; county- and town-set states (AK GA IL ME NE NH NY OH PA RI VT VA) are deliberately absent because silence beats a wrong date. `tests/unit/addressCalendarSeeds.test.js` parses both seed migrations and checks every RRULE against its `dtstart`, the state coverage, and the confidence rule.
- **Seasonal engine by climate region.** `services/ai/seasonalEngine.js` resolves one of twelve regions from the home's state (coordinates as a coarse fallback), runs the base calendar everywhere minus the seasons that do not apply, layers regional seasons (hurricane, tornado, monsoon, heat, wildfire, winter storm, blizzard, deep freeze, pollen) with NWS/NOAA-dated copy and no invented local numbers, keeps the PNW copy verbatim for the PNW, keeps `primary_season` a base key so the checklist and health score keep working, and still fails closed without any location. Hub, briefing, Pulse and the health score now carry seasonal content nationally.

### 8. Parity (same slice)
- **iOS:** the privacy mirror (`PlacePrivacyMirrorView`, `HubRoute.privacyMirror`, a row on the Place dashboard) and the cells window (`NearbyCellsMapCard`, MapKit `MapPolygon`s over the same buckets, above the meter on the Nearby tab, best-effort so it never takes the meter down). `make build` regenerates the project from `project.yml`, so new Swift files are fine.
- **Android:** the privacy mirror (`ui/screens/place/privacy/`, `ChildRoutes.PLACE_PRIVACY_MIRROR`, dashboard row), the share card on the anonymous preview (system share sheet with `${PANTOPUS_WEB_BASE_URL}/start?address=`; the origin is a `buildConfigField`, default `https://pantopus.com`), and "Just moved here" on the add-home details step (stamps `move_in_date` = today).

### 9. The Phase 1 carry-overs, closed (2026-09-02)
- **Setup checklist in wedge order.** `routes/hub.js` now emits `home` (claim) → `verify` (any verified occupancy or verified-owner row) → `complete_profile` → `profile_photo`; the gig-worker items (`skills`, `payout_method`) only appear once the person is already on the earning path (skills, a payout method, or a business). `SetupBanner` knows the two new keys ("Claim your address", "Verify your address") and titles itself "Set up your place" until they are done.
- **Hub absorption into Place (the useful half).** The web Place page reads the hub payload and shows the checklist above the dashboard until every step is done; `/app/hub` stays reachable for the business and discovery blocks.
- **The unlock event.** `densityReader.unlockThreshold()` is the one source of truth; `jobs/neighborhoodPreviewRefresh.js` always treats the threshold as a milestone and announces the crossing as "Your neighborhood is open" (deep link to Nearby, `metadata.unlocked`) instead of a round number. `tests/unit/neighborhoodPreviewRefresh.test.js` covers both copies.
- **Signup slim, iOS and Android.** Both native forms now match web: email + password + terms. Username, names, date of birth and address are optional (still validated when typed, 18+ when a birth date is given) and travel as absent keys, never as empty strings; the server generates the username. The Profile and Address groups are gone from both screens; OAuth no longer demands a birth date first. Tests rewritten on both platforms.

## Verification
- Backend: new/extended `tests/funnelEvents`, `tests/unit/funnelReport` (3), `tests/unit/evidenceRetentionSweep` (4), `tests/unit/homeMirror` (4), `tests/neighborhoodMeter` (+3 cells); full suite and privacy gates — see the commit.
- Web: `tests/startFunnel` (+1 beacon case), `tests/homePrivacyMirror` (3), `tests/nearbyCells` (1); lint clean; no type errors in touched files.
- iOS: `make build` **BUILD SUCCEEDED**; `PlaceMoneyLeadDecodingTests` (+2).

## Still open (engineering)
- Calendar feeds (permits, agendas) once a Camas source exists; county-level tax rules for the twelve county-set states.
- Retiring the standalone Hub surface once its business and discovery blocks have a home (Place carries the checklist now).
- Store screenshots for the four-tab IA (tooling, not product).
- 0% marketplace fee for Founding Neighbors (needs a marketplace fee to exist).

## Founder items and product calls — unchanged, see the Phase 2 record
Set the production keys (Census, AirNow, Google Civic, Mapbox, `ADMIN_ALERT_EMAIL`), apply migrations 158/195/196, confirm the Camas schedules, walk the street, agents' kit, first HOA, EDDM routes with `?r=`, business walk; decide the block meter and the badge rename.
