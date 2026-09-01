# Wedge Phase 1.5 — "The aha audit" implementation record · 2026-09-01

Implements Phase 1.5 of the repositioning plan ("The Pantopus Wedge", v2
deep review — decisions D1–D6). Phase 1 ("Commit & shrink",
`docs/wedge-phase1-implementation-2026-09-01.md`) shipped the same
morning; this phase fixes what the v2 code review found wrong with it:
a starved no-account taste, two dead tabs, and a privacy promise the
product could not yet keep. Web + iOS lead; **Android stays on the
Phase-1 IA** (deliberate, see Follow-ups).

## What shipped

### D1 — The taste: every free layer at T0, led by an aha card

The shipped preview showed a FEMA zone letter, a fuzzy density bucket
and a Census teaser, and locked weather / air / alerts as "anti-leak"
even though 12 of the 13 launch sections are free public data. A
one-shot snapshot leaks nothing recurring; the account's reasons are
*save*, *claim*, *every morning*.

- `backend/services/placePreviewService.js` (new) —
  `composePreviewSections({lat,lng,city,state})` runs the Band-A
  adapters for a *point* (a synthetic home whose id is its geohash-6
  cell — never the typed address): today (weather / AQI / alerts via the
  new `placeIntelligenceService.composeTodayForPoint`), sunrise, seismic,
  wildfire, radon, drinking water, EPA facilities, HUD rent band, civic
  districts, election. **Each section has its own time budget**
  (`PLACE_PREVIEW_SECTION_BUDGET_MS`, default 3500 ms): a slow provider
  degrades only its own section to `unavailable` ("Still loading from
  the source…") while its fetch keeps running so the shared
  `PlaceSectionCache` is warm for the next visitor.
  `assemblePreviewSections` merges the route's own flood / census /
  density layers into dashboard order. `pickAha(sections)` ranks the
  ready sections by *surprise* (an active warning 100, unhealthy air 95,
  high flood 95, high wildfire 85–92, seismic D/E 78–85, radon zone 1
  75, water violations 74, …, rent band 30, districts 22) and returns
  one card: `{section_id, tone alert|watch|info|calm, grade, headline,
  detail, follow_up}`. Below a floor of 35 the card is the calm one
  ("Quiet on every layer — minimal flood risk, low wildfire hazard, good
  air today, no active alerts. That's rarer than you'd think.").
- `backend/routes/public.js` — `GET /api/public/place` now returns
  `sections` (full Band-A envelopes) and `aha` alongside the unchanged
  `free` mini-shape native clients decode. `locked` shrinks to Band B
  only (`home_details`, ATTOM, claim). Density labels never read as a
  zero: below the floor the card says *"Founding Neighbor slots are
  open here."* The no-persistence contract holds: every cache key is
  `geo:` / `state:` / `us:` / `county:`-scoped (asserted by test).
- `backend/services/placeIntelligenceService.js` — `composeToday` is
  now a thin wrapper over a shared `buildTodayEnvelopes`; new
  `composeTodayForPoint(lat, lng)` (providers required lazily — the
  WeatherKit chain must not load for the dashboard route's tests).
- `backend/services/placeSectionAdapters.js` — county FIPS is cached by
  **geohash-7**, not `home:<id>` (a fact about land; claimed homes and
  the preview share one row; no per-home key), and single-flighted so
  radon / rent / water share one geocoder call.
- Web: `@pantopus/api` `PlacePreview` gains `sections` + `aha`
  (`PlacePreviewAha`). `StartFunnel` renders the aha card
  (`archetypes/place/AhaCard`, new), then every free layer through the
  dashboard's own `renderSection`, the density card with the server
  label + a Founding-Neighbor CTA, the single locked card ("Claim it to
  see"), then the privacy promise, then the wall. Copy: hero subtitle,
  preview card, wall ("This address has one page. Claim it, free." /
  "Save it, get it every morning, see everything." / button "Claim it").
  `DensityCard` accepts a `label` override.
- `/dev/start-preview` — fixture page (a High-wildfire spot and a Quiet
  spot) for design QA and the aha audit without a live backend.

### The privacy promise — and making it true

`components/place/PrivacyPromise.tsx` (new) is shown at the soft wall
and again on the claim Review step (`homes/new`, step 4). Every line was
checked against the code before it was written; two draft lines from
the v2 artifact were **not** shippable and were changed:

| Draft line | Reality found in the code | Shipped line |
|---|---|---|
| "Location is used only to check for fraud" | GPS is not used in verification at all (`addressValidation/` has no geolocation; `risk_tier` is hardcoded `'low'`) | "Verifying never asks for your GPS. It works by mail, a landlord, or a document you choose." |
| "Verification photos are deleted after review" | No deletion exists — S3 objects under `ownership-evidence/` are never purged; claim self-delete orphans them | "Verification documents are seen by one reviewer and never by neighbors." (deletion → Follow-ups) |
| "Neighbors see a first name and a street, never a house number or unit" | **False before this phase**: `GET /api/homes/discover` and `GET /api/homes/:id/public-profile` returned the full street address + zipcode + the owner's real full name to any signed-in user (public_preview homes; and *any* home with a verified owner via the user-B join probe) | Made true — see below |

- `backend/utils/addressRedaction.js` (new) — `redactStreet` ("1214 NE
  Birch St Apt 3" → "NE Birch St"; PO boxes → "PO Box"),
  `houseNumberOf`, `queryKnowsNumber` (the discover knowledge proof: a
  searcher who typed the house number already knows it), `firstNameOnly`.
- `backend/routes/home.js` — **discover**: outsiders get the street, no
  zip, owner first name, plus `address_redacted: true`; members,
  claimants, and searchers who typed the number get the exact match.
  **public-profile**: `insider` (member / creator / claimant) sees the
  exact address; `public_preview` viewers and the user-B join flow see
  the street + first name. The join flow still works (they typed the
  number to find the home).

### D2 — Four alive tabs: Place · Today · Nearby · Mail

Neighborhood was locked for months and Messages was empty at zero
density: half the tab bar told the truth the meter was meant to soften.

- **Web** `AppShell.tsx` — Place · Today · Nearby · Mail. Today →
  `/app/today` (re-exports the Hub's full briefing screen at
  `/app/hub/today`, which stays for deep links and the morning push).
  Nearby → `/app/nearby` (the door, renamed; `/app/neighborhood`
  redirects). Mail absorbs Messages: the unread badge moves to the Mail
  item, `/app/chat` keeps its routes and is reached from a new "Inbox"
  section at the top of `MailboxNav`. `NavIcons.today` / `.nearby`
  added. Playwright nav assertion updated (it was already stale).
- **iOS** `RootTabView.swift` — `RootTab` is `place · today · nearby ·
  mail` (ids drive `tab.<id>`; icons `.home / .sun / .compass / .mail`).
  New `TodayTabRoot` hosts `TodayDetailView` and consumes `.hubToday`
  push deep links itself (re-seeding with the stored delivery id). New
  `MailTabRoot` is a segmented container — **Mailbox | Messages** — over
  `HubTabRoot(mode: .mailbox)` and `InboxTabRoot` (only the visible
  segment is mounted, so each root's deep-link consumption is
  unchanged); the badge sits on the Mail tab. New `MailTabStore`
  carries a pending segment for cross-tab hand-offs (`.conversation`
  deep links, `/app/chat` status items from the Hub). Cross-tab dispatch
  retargeted: feed/post/gig/listing → `.nearby`; `.hubToday` → `.today`;
  `.conversation` → `.mail` + Messages. The door's Swift types keep their
  `Neighborhood*` names (no pbxproj churn); the user-facing label is
  "Nearby" and its a11y ids are `nearbyDoor / nearbyMeter / nearbyInvite
  / nearbyRetry / nearbySurface.*`.
- iOS tests: `RootTabUITests` (4 tabs = place/today/nearby/mail; Today →
  `todayDetail`; Nearby → `nearbyDoor`; Mail → Messages segment → empty
  chat state), `DynamicTypeAudit` tab list, `StoreScreenshots`
  (`10_NearbyDoor`, chat via the Mail segment), and `NavigationSmokeTest`
  **rewritten for the four-tab IA** (it still asserted the pre-Phase-1
  `hub/nearby/inbox/you` ids): You is opened via the avatar cover, chat
  via the Mail segment.

## Verification
- Backend: `tests/publicPlace.test.js` 33/33 (new: the unlocked
  snapshot, budget degradation, cache-key hygiene, aha ranking incl. the
  calm fallback); `tests/unit/addressRedaction.test.js` +
  `tests/homeAddressRedaction.test.js` 25/25; the two suites that broke
  at import (`funnelEvents`, `placeIntelligence.endpoint`) fixed by
  lazy-requiring the Today providers and by adding the missing
  `../../../utils/logger` entry to the jest `moduleNameMapper` (the
  WeatherKit / Open-Meteo providers sit one level deeper than the
  mapper covered). **Full suite: 219 suites passed (1 skipped), 3314
  tests passed, 16 skipped, 0 failed.**
- Web: `pnpm -F @pantopus/web lint` 0 errors. `type-check` reports the
  same 170 pre-existing errors as before this phase (138 × TS18047
  `pathname`/`searchParams` possibly null, etc.); **none in files touched
  here** except two pre-existing `AppShell.tsx` `string | null` errors at
  the `currentPath` call sites that predate the rename.
- iOS: `make build` (from `frontend/apps/ios`) **BUILD SUCCEEDED**;
  SwiftLint on the changed files: 0 warnings after two fixes (a
  `swiftlint:disable:next cyclomatic_complexity` on the flat deep-link
  dispatch switch, one multiline chain in `RootTabUITests`). iOS UI
  tests remain environmentally red in this checkout (Phase 1 note) and
  are not a signal either way; `RootTabUITests` / `NavigationSmokeTest`
  / `DynamicTypeAudit` / `StoreScreenshots` were updated for the new ids
  and need a CI re-baseline.
- Visual: `/dev/start-preview` on the local dev server renders the full
  composition for both fixtures (aha card → six groups → locked card →
  privacy promise), verified by page text. A live `/start` run needs a
  backend with keys (this checkout has no `backend/.env`); that is the
  founder's aha audit (Follow-up 6). Six pre-existing console errors
  (`<svg> attribute height: Expected length, "auto"`) come from a
  component outside this phase's files.

## Follow-ups
1. **Delete verification evidence after review** — add an S3 purge on
   claim approve/reject + a retention sweep for orphaned
   `ownership-evidence/` objects; then the promise line can say so.
2. **Place privacy mirror** — extend `identityCenter` `view-as` with a
   `surface=home` mode driven by the production serializers
   (`serializeHomeIdentityForViewer`, `densityReader`,
   `neighborMessageSerializer`) and a `/app/place/privacy` screen.
3. **Nearby window** — the "always alive" content (rooftop map, curated
   local items, signed businesses, nearby permits). Point the seeder's
   morning slot at Today; posting stays behind the meter.
4. **Android** — port the four-tab IA + the Today tab + Mail segments
   once the IA settles (this phase deliberately did not touch it).
5. **iOS SignUpView slim**, **Hub absorption into Place**, and the
   **setup-checklist reorder** carry over from Phase 1.
6. **The aha audit itself** — needs a backend with real keys: run 20
   Camas addresses through `/start`, grade each preview, and fix data
   gaps (county assessor/GIS is free; prefer it to ATTOM where public).
7. **Native preview clients** — iOS/Android still render the `free`
   mini-shape; teach `PlaceLaunchViewModel` (both) to render `sections`
   + `aha` so the native taste matches web.
