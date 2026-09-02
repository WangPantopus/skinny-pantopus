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

## Verification
- Backend: new/extended `tests/funnelEvents`, `tests/unit/funnelReport` (3), `tests/unit/evidenceRetentionSweep` (4), `tests/unit/homeMirror` (4), `tests/neighborhoodMeter` (+3 cells); full suite and privacy gates — see the commit.
- Web: `tests/startFunnel` (+1 beacon case), `tests/homePrivacyMirror` (3), `tests/nearbyCells` (1); lint clean; no type errors in touched files.
- iOS: `make build` **BUILD SUCCEEDED**; `PlaceMoneyLeadDecodingTests` (+2).

## Still open (engineering)
- Android batch: tabs, residency door, calendar card, founding tier, movers card, aha/sections preview, cells map.
- iOS parity for the cells map and the privacy mirror.
- Calendar feeds (permits, agendas); Hub absorption into Place; iOS signup slim.
- 0% marketplace fee for Founding Neighbors (needs a marketplace fee to exist).

## Founder items and product calls — unchanged, see the Phase 2 record
Set the production keys (Census, AirNow, Google Civic, Mapbox, `ADMIN_ALERT_EMAIL`), apply migrations 158/195/196, confirm the Camas schedules, walk the street, agents' kit, first HOA, EDDM routes with `?r=`, business walk; decide the block meter and the badge rename.
