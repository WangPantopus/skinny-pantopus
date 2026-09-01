# Sample-data audit

Five iOS view-models and six Android files have shipped to production
hydrating from `…SampleData` instead of the backend. This document
inventories each, maps it against the design archetype it implements,
checks whether the underlying server route exists, summarises what any
decision doc says about the gap, and lists a "wire to backend" task plus
a "make obvious in UI" fallback we can ship while the wiring lands.

Scope is read-only audit: no production code was touched.

Two corrections to the original audit list, found while compiling this
document:

- **Mailbox map is not Android-only.** `frontend/apps/ios/Pantopus/Features/Mailbox/MailboxMap/MailboxMapViewModel.swift:5`
  carries `"A11.4 Mailbox map view-model. No backend — `load()` surfaces
  the [seeded spots]"`. Both platforms ship the same sample-data shape.
  Six surfaces total, not five-plus-one.
- **AI chat backend exists today.** The iOS view-model
  (`Features/Chat/Conversation/ChatConversationViewModel.swift:22`) says
  "SSE streaming via `/api/ai/chat` lands later" — that comment is stale.
  `backend/routes/ai.js:120` ships `POST /api/ai/chat` with
  `Content-Type: text/event-stream` SSE today. iOS just isn't wired to
  it. See row 5.

## Summary table

| # | Surface | iOS state | Android state | Backend route | Decision doc |
|---|---------|-----------|---------------|---------------|--------------|
| 1 | Professional profile (A13.11) | sample-only | sample-only | **exists, not wired** | UI-only |
| 2 | Explore map (A11.2) | sample-only | sample-only | **does not exist** (need fan-out aggregator) | UI-only |
| 3 | Tasks map (A11.1) | sample-only | sample-only | **exists, not wired** | UI-only |
| 4 | Discover hub magazine (A11.3, partial) | partial sample (magazine only) | partial sample (magazine only) | **does not exist** (separate magazine endpoint) | UI-only |
| 5 | Chat "Ask Pantopus" (`.ai`) | sample-only | sample-only | **exists, not wired** (iOS comment is stale) | UI-only |
| 6 | Mailbox map (A11.4) | sample-only | sample-only | **partially exists** (`HomeMapPin` ≠ mailbox spot) | UI-only |

"UI-only" decision-doc status means the surface is listed as `REAL_VIEW`
/ reachable in `docs/screen-parity-inventory.md` and
`docs/ship-readiness.md`, but no doc explicitly marks the backend gap as
planned-for-sprint-X or deferred. `plan.md` and `RELEASES.md` contain
zero matches for any of the six surface terms.

---

## 1. Professional profile (A13.11)

- **iOS:** `frontend/apps/ios/Pantopus/Features/Profile/Professional/ProfessionalProfileViewModel.swift`
- **iOS seed:** `Features/Profile/Professional/ProfessionalProfileSampleData.swift` (`.published`)
- **Android:** `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/profile/professional/ProfessionalProfileViewModel.kt`
- **Android seed:** same folder, `ProfessionalProfileSampleData.kt`
- **Marker (iOS):** lines 5–8 — *"Backend was removed from the repo, so
  `load()` hydrates from `ProfessionalProfileSampleData` instead of hitting
  a route."* Also line 53: *"Hydrate from sample data. No network (backend
  removed)."*
- **Marker (Android):** no header comment; behavioural — VM uses
  `@Inject constructor()` with no repository, defaults
  `seed = ProfessionalProfileSampleData.published` at line 23.

### (a) Design archetype

Form. iOS `ProfessionalProfileView.swift` wraps the body in `FormShell(...)`;
Android `ProfessionalProfileScreen.kt:172` uses the matching `FormShell`.

### (b) Does the backend route exist?

**Yes — and the iOS view-model is not wired to it.**

- `backend/routes/professional.js:164` — `GET /api/professional/profile/me`
- `backend/routes/professional.js:190` — `PATCH /api/professional/profile/me`
- `backend/routes/professional.js:89`  — `POST /api/professional/profile`
  (create/enable)
- `backend/routes/professional.js:221` — `DELETE /api/professional/profile/me`
- `backend/routes/professional.js:310` — `POST /verification/start`
- `backend/routes/professional.js:372` — `GET /verification/status`

Persistence is the `UserProfessionalProfile` table. Note the path is
`/profile/me`, not `/professional-profile`; mobile must use PATCH (not
PUT).

### (c) Planned-vs-deferred status

Undocumented as deferred. `docs/screen-parity-inventory.md:217` lists
A13.11 as `REAL_VIEW` on both platforms with no backend-status note;
`docs/screen-parity-inventory.md:105–109` flags that the
admin-review-in-progress (`.pending` from server) state is ambiguous and
currently modelled only as the dirty-edits state. `docs/requirements.md:64`
references the `UserProfessionalProfile` table without describing the
client gap.

### (d) User-visible consequence

`saveAndSubmit()` (VM:157–184) only mutates the in-memory `working` →
`baseline` and fires a success toast. **No network, no disk, no
keychain.** Every edit — title, years in role, skills, certifications,
portfolio links, visibility toggles — evaporates on app relaunch. The
"Submitted — N claims in review" toast is cosmetic; nothing is in review
on the server. New skill / certification / portfolio chips render with
placeholder strings (`"New skill"`, `"Awaiting upload"`) that never
resolve.

### Tasks

- **Wire to backend.** Add `Core/Networking/Endpoints/ProfessionalEndpoints.swift`
  with `getProfileMe()` → `GET /api/professional/profile/me` and
  `updateProfileMe(body:)` → `PATCH /api/professional/profile/me`
  (route comments: `backend/routes/professional.js:164` and `:190`). DTOs
  in `Core/Networking/Models/Professional/ProfessionalDTOs.swift`. Have
  `load()` call `getProfileMe`, fall back to `seed` on transport error
  with an inline `.error` retry banner; have `saveAndSubmit()` call
  `updateProfileMe(body:)` and only commit `baseline` on the `200`. Mirror
  the same `HubRepository`-style injection on Android
  (`@Inject constructor(private val repo: ProfessionalRepository)`). PR
  scope: ~iOS 250 LOC + Android 280 LOC; per-platform parity test against
  `SequencedURLProtocol`.
- **Make obvious in UI (fallback).** Render a non-dismissable amber
  `BannerView` at the top of the form body (above the section list, below
  the top bar) reading *"Editing locally — your changes won't be saved
  yet. We're wiring the professional-profile sync."* iOS:
  `Features/Shared/Banners/InlineBanner.swift` style, `Theme.Color.warningBg`
  background, `Icon(.triangleAlert)` leading, no close action. Suppress
  the "Submitted — N claims in review" success toast and swap for
  *"Saved locally."* Android mirror: `ui/components/InlineBanner` with the
  same copy and `Modifier.testTag("professionalProfile.localOnlyBanner")`.

---

## 2. Explore map (A11.2)

- **iOS:** `frontend/apps/ios/Pantopus/Features/Explore/ExploreMapViewModel.swift`
- **iOS seed:** `Features/Explore/ExploreMapSampleData.swift` (387 lines;
  header lines 4–8 *"backend has been removed from the repo, so the
  Explore map is wired against these stub entities"*)
- **Android:** `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/explore/ExploreMapViewModel.kt`
- **Android seed:** same folder, `ExploreMapSampleData.kt`
- **Marker (iOS):** lines 8–9 — *"Filtering + clustering run locally over
  the sample set (no network — backend removed from the repo)."*
- **Marker (Android):** lines 17–18 mirror the iOS line verbatim.

### (a) Design archetype

Bespoke map. iOS uses hand-rolled `Map(position:)` + drag-driven bottom
sheet (`ExploreMapView.swift:41–54, 325–440`); it is *not* the shared
`MapListHybridShell`. Android mirrors with a custom `draggable` sheet,
also not the shared shell. This is the only map surface that opts out of
`MapListHybrid`.

### (b) Does the backend route exist?

**No — no unified cross-type endpoint exists.** The Explore map's whole
value proposition (People · Businesses · Gigs · Listings all pinned on
the same canvas, with one type-toggle + shared filter sheet + shared
clustering) has no matching server aggregator. The four close
substitutes are type-specific:

- `backend/routes/gigs.js:1111` — `GET /api/gigs/nearby`
- `backend/routes/gigs.js:2603` — `GET /api/gigs/in-bounds`
- `backend/routes/listings.js:796` — `GET /api/listings/nearby`
- `backend/routes/listings.js:862` — `GET /api/listings/in-bounds`
- `backend/routes/businessDiscovery.js:290` — `GET /api/business-discovery/map`
- `backend/routes/professional.js:256` — `GET /api/professional/discover`

`backend/routes/geo.js` (251 lines) is `/autocomplete`, `/resolve`,
`/reverse` only — no entity fetch. `backend/routes/hub.js:763` `GET /api/hub/discovery`
returns four types in a paged-list shape (no lat/lng), so it can seed
the bottom-sheet rail but not the pin canvas.

### (c) Planned-vs-deferred status

Undocumented as deferred. `docs/screen-parity-inventory.md:250` lists
A11.2 as `REAL_VIEW` with no backend-status note; `ship-readiness.md:52–67`
marks it as front-end-reachable. No design doc identifies an owner for
the cross-type aggregator.

### (d) User-visible consequence

`ExploreMapSampleData.center` hard-codes the anchor to
`(40.7484, -73.9857)` (Midtown Manhattan). Every user — Boston, Boise,
Berlin — sees the same fixed Manhattan neighbours and the same
`"you are here"` disc planted in Midtown. Filter / type-toggle / zoom
all only re-bucket the fixture; the empty state ("Widen area") cannot
ever produce new entities. Selection persists across launches because
the fixture is deterministic.

### Tasks

- **Wire to backend.** Land a composite endpoint
  `GET /api/explore/map?bbox=<minLat,minLng,maxLat,maxLng>&kinds=person,business,gig,listing&since=...&verified=...`
  in `backend/routes/hub.js` (closest existing aggregator;
  `backend/routes/hub.js:763` already returns the same four types in a
  paged shape). Reply shape: `{entities: ExploreEntity[], center: {lat, lng}}`
  with one DTO union per kind. Add `ExploreEndpoints.swift` +
  `ExploreRepository.kt`. Fetch on bbox change (camera-stopped) +
  `applyFilters`; the existing client-side `cluster(...)` and filter
  predicates already work over the same DTO shape, so no projection
  rewrite. PR scope: ~backend 350 LOC + iOS 200 LOC + Android 220 LOC,
  plus an integration test that exercises bbox + kind filtering. If a
  composite endpoint is rejected, the fallback is a 4-way fan-out using
  the type-specific routes above — same client surface, more network.
- **Make obvious in UI (fallback).** Render a non-dismissable info strip
  pinned to the top of the bottom sheet (between the type-toggle row and
  the rail) reading *"Showing demo neighbours — real Explore data is
  coming. The map and list are placeholders for now."* iOS:
  `ExploreMapView.swift` — insert a `MapSampleDataNotice` strip
  (`Theme.Color.infoBg`, `Icon(.info)`, no close), with
  `accessibilityIdentifier("exploreMap.sampleNotice")`. Suppress the
  "you are here" disc when the user's resolved coordinate is non-NYC
  (avoid implying we know where they are). Android mirror with the same
  copy and `Modifier.testTag("exploreMap.sampleNotice")`.

---

## 3. Tasks map (A11.1)

- **iOS VM:** `frontend/apps/ios/Pantopus/Features/Gigs/TasksMap/TasksMapViewModel.swift`
- **iOS seed:** `Features/Gigs/TasksMap/TasksMapSampleData.swift` (121
  lines, 9 items)
- **Android VM:** `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/gigs/tasks_map/TasksMapViewModel.kt`
- **Android seed:** same folder, `TasksMapSampleData.kt`
- **Marker (iOS):** VM line 5 — *"No backend — seeds from
  `TasksMapSampleData` and applies the live category filter + sort."*
  Sample data line 5 — *"Deterministic seed for the Tasks map (backend
  removed)."*
- **Marker (Android):** VM line 17 mirrors verbatim.

### (a) Design archetype

Shared `MapListHybridShell` (iOS `TasksMapView.swift:5` "Gigs-only mode
of the MapListHybrid archetype"; Android `TasksMapScreen.kt:54`).

### (b) Does the backend route exist?

**Yes — and the view-model is not wired to it.**

- `backend/routes/gigs.js:1111` — `GET /api/gigs/nearby` (RPC
  `find_gigs_nearby` at `:1124`, returns gigs with coords + location-
  privacy resolution at `:1140–1160`)
- `backend/routes/gigs.js:2603` — `GET /api/gigs/in-bounds` (viewport
  query)
- `backend/routes/gigs.js:1816` — `GET /api/gigs/search` (category +
  sort)
- `backend/routes/gigs.js:3190` — `GET /api/gigs/browse` (category +
  bidCount)

`backend/routes/gigsV2.js` (435 lines) has no map/nearby routes; the V2
file is instant-accept / share-status / update-location only.

### (c) Planned-vs-deferred status

Undocumented as deferred. `docs/screen-parity-inventory.md:250–253`
lists A11.1 as `REAL_VIEW`. `docs/nav-graph-closure.md:111, 409`
explicitly **deprecates** an earlier `nearbyMapForGigs(categoryKey:)`
route in favour of A11.1 / `tasksMap`, implying A11.1 is the canonical
surface — yet the backend wiring is still missing.

### (d) User-visible consequence

The same nine hand-authored Midtown Manhattan gigs render regardless of
where the user actually is. The category-chip strip and the
closest/highest-pay/fewest-bids sorts all run over the fixture, so they
*appear* responsive even though the fixture is fixed. The "moving" and
"tutoring" pins are statically `.pending`, never confirmed. Distance
labels are string-parsed (`"0.2 mi"` → `Double`) instead of computed
from the user's real coordinate.

### Tasks

- **Wire to backend.** Add `GigsEndpoints.nearby(lat:lng:radius:limit:status:category:)`
  → `GET /api/gigs/nearby` (route doc-comment
  `backend/routes/gigs.js:1111`). Call from `load()` and on
  `selectCategory` (server-side `category` param) and on camera-stop
  with bbox via `in-bounds` (`:2603`). Replace
  `TasksMapSampleData.anchor` with the resolved user coordinate from
  `LocationService`. Keep the seed as a `previewState:` fallback for
  snapshot tests. PR scope: ~iOS 180 LOC + Android 200 LOC; reuse the
  existing `GigDTO`.
- **Make obvious in UI (fallback).** Render a non-dismissable amber
  banner inside the bottom sheet, just under the category-chip strip,
  reading *"Demo gigs only — these aren't real tasks in your area yet.
  Backend wiring in progress."* iOS:
  `Features/Gigs/TasksMap/TasksMapView.swift` — insert
  `TasksMapSampleNotice` (`Theme.Color.warningBg`, `Icon(.triangleAlert)`,
  no close), with `accessibilityIdentifier("tasksMap.sampleNotice")`.
  Disable the "Bid" / "Save" CTAs on the per-task cards (or surface
  them as `.disabled` with a tooltip *"Demo task — bidding will open
  when real gigs land"*) so users don't post real bids against fake
  tasks. Android mirror with the same copy and
  `Modifier.testTag("tasksMap.sampleNotice")`.

---

## 4. Discover hub magazine (A11.3, partial)

- **iOS VM:** `frontend/apps/ios/Pantopus/Features/DiscoverHub/DiscoverHubViewModel.swift`
- **iOS seed:** `Features/DiscoverHub/DiscoverHubSampleData.swift`
- **Android VM:** `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/discoverhub/DiscoverHubViewModel.kt`
- **Android seed:** same folder, `DiscoverHubSampleData.kt`

This view-model is **half-wired**. The typed-rows list (People /
Businesses / Gigs / Listings) hits the real backend via
`HubEndpoints.discovery` → `backend/routes/hub.js:763`. Sample-data scope
is limited to the **magazine sub-state**:

- iOS sample-driven methods: `loadMagazine` (VM:227), `refreshMagazine`
  (VM:241), `selectMagazineFilter` (VM:245), `openMap` (VM:249),
  `selectTask/MarketplaceItem/Post` (VM:253–263), `seeAllTasks/Marketplace/Posts`
  (VM:265–275), `notifyWhenActive` (VM:277, comment *"no network call is
  made here"*).
- Marker: lives in `DiscoverHubSampleData.swift:5–7` —
  *"Backend is intentionally not used for this surface; the view-model
  seeds deterministic content"*.
- Android mirror at `DiscoverHubViewModel.kt:135–136, 211, 249`. The
  main `discovery` fan-out (lines 300, 311, 320, 329) calls
  `HubRepository.discovery` for real.

### (a) Design archetype

`ListOfRows` (iOS: `ListOfRowsDataSource` conformance at VM:104;
Android: `ListOfRowsUiState`) for the typed-rows list; **bespoke**
`DiscoverHubMagazineContentView` (iOS `DiscoverHubView.swift:43`) for the
magazine hero, hero map strip, "Tasks near you" / Marketplace / Posts
rails, and map-kind filter chips (Task / Item / Post / Spot / Event).

### (b) Does the backend route exist?

**No.** `backend/routes/hub.js` (1052 lines) ships only `/`, `/today`,
`/briefings/:id`, `/preferences`, `/discovery`, `/dismiss-density-milestone`.
There is no `/api/hub/magazine` or `/api/hub/feed` endpoint, and zero
matches for "magazine" or "featured" in the file. The magazine UI is
designed to project on top of `/api/hub/discovery`, but the projection
is per-section — there is no single curated-feed shape on the server
today.

### (c) Planned-vs-deferred status

Undocumented as deferred. `docs/screen-parity-inventory.md:255–256`
defines A11.3 explicitly as the *"magazine surface"* (compact map strip
+ rails) distinct from A11.2 Explore — but the doc doesn't acknowledge
the backend isn't there yet.

### (d) User-visible consequence

The typed rows (People / Businesses / Gigs / Listings) are real. The
magazine hero map and the rail strips below it are **fixed authored
cards** — the "Tasks near you" strip always shows the same three
fictional tasks; the "Marketplace" rail always the same three fictional
items; the "Posts" rail always the same three fictional posts.
Selecting a map-kind chip (Task / Item / Post / Spot / Event) only
filters the fixture. The "Notify when active" CTA in the magazine empty
state is silently a no-op (comment confirms — no alerts service is
called).

### Tasks

- **Wire to backend.** Either (a) extend `GET /api/hub/discovery` to
  return a `magazine: { hero, rails: [{ kind, items[] }] }` block when
  `?include=magazine` is set, then drop the magazine sample-data path;
  or (b) ship a new `GET /api/hub/magazine` that composes the rail
  strips from existing nearby-gigs, nearby-listings, and nearby-posts
  queries. (a) is the cheaper change. The `notifyWhenActive` CTA needs
  the alerts service (out of scope for this audit). PR scope: ~backend
  250 LOC + iOS 150 LOC + Android 170 LOC.
- **Make obvious in UI (fallback).** Render a non-dismissable info strip
  at the **top of the magazine sub-surface only** (not the typed-rows
  list — that's live) reading *"Featured tasks, items, and posts shown
  here are samples while we finish the magazine feed."* iOS:
  `Features/DiscoverHub/Magazine/DiscoverHubMagazineContentView.swift` —
  pin the strip above the hero, `Theme.Color.infoBg`, `Icon(.info)`, no
  close, `accessibilityIdentifier("discoverHubMagazine.sampleNotice")`.
  Replace the "Notify when active" CTA copy with *"We'll add alerts
  soon"* and disable it. Android mirror with the same copy and
  `Modifier.testTag("discoverHubMagazine.sampleNotice")`.

---

## 5. Chat "Ask Pantopus" — `.ai` thread

- **iOS VM:** `frontend/apps/ios/Pantopus/Features/Chat/Conversation/ChatConversationViewModel.swift`
  (only the `case .ai` branch; `.room` and `.person` are fully wired)
- **iOS seed:** `Features/Chat/Conversation/ChatConversationSampleData.swift`
  (used by previews / snapshot tests only — production renders the empty
  state)
- **Android VM:** `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/inbox/conversation/ChatConversationViewModel.kt`
  (only the `ChatThreadMode.Ai` branch)
- **Markers (iOS):**
  - VM:22–27 — *"`.ai` is a synthetic mode for the 'Ask Pantopus' thread
    (no backend wiring today — SSE streaming via `/api/ai/chat` lands
    later)."* **This comment is stale; see (b).**
  - VM:187–191 (`send()`) — *"AI thread: no backend wired in T2.2;
    surface a placeholder optimistic row so the design's 'Ask anything…'
    composer still feels alive."*
  - VM:311–316 (`fetch()`) — `case .ai:` short-circuits to `state = .empty`.
  - `resolveRoomIdForReadMark()` VM:384, `resolveRoomId()` VM:398:
    `.ai` → `nil`.
- **Markers (Android):** VM:171–179 (`send()` AI branch returns before
  any `repo.*` call); VM:281–283 (`fetch()` AI short-circuits to
  `Empty`); VM:243 (`scheduleMarkRead()` AI is no-op).

### (a) Design archetype

Bespoke. Custom `ChatTimelineRow` list + composer; no shared shell
(iOS `ChatConversationView.swift:262, 341` uses raw `ScrollView` /
`VStack`; Android `ChatConversationScreen.kt` has no
`*Shell` import).

### (b) Does the backend route exist?

**Yes — and is shipped today.** The iOS comment is stale.

- `backend/routes/ai.js:120` — `POST /api/ai/chat`, `verifyToken`,
  `aiChatLimiter`, SSE: `Content-Type: text/event-stream` at `:126`,
  `sseWriter` helper at `:133`, streams via `agentService.streamChat`
  at `:156`.
- `backend/routes/ai.js:358` — `GET /api/ai/conversations` (history
  list)
- `backend/routes/ai.js:363` — `DELETE /api/ai/conversations/:id`
- `backend/routes/ai.js:387` — `POST /api/ai/transcribe`
- Plus 8 other AI helper routes (`/draft/*`, `/summarize/mail`,
  `/place-brief`, `/property-profile`, `/pulse`, `/health`).
- `docs/02-api-routes-and-services.md:263–279` documents `POST /chat`
  as *"Token, 20/hr, Streaming multi-turn chat"* — confirming the route
  is intentionally live, not WIP.

### (c) Planned-vs-deferred status

Undocumented as deferred on the client side.
`docs/ship-readiness.md:68–71` lists the *"AI Assistant chat thread"*
as reachable from Chat List "Ask Pantopus AI" entry — frontend-only
checkbox. No doc captures that the mobile clients are not wired even
though the SSE route is live. **This is the cheapest of the six to
fix** — backend cost is zero.

### (d) User-visible consequence

Opening "Ask Pantopus" always renders the empty state + welcome
capability chips (Price a task / Draft a Pulse post / Summarize mail /
Find a neighbor). Typing or tapping a chip echoes the user's text as
an optimistic outgoing bubble that is **never resolved by a server
reply** — the conversation reads as one-sided ghost-town. No history
persists across sessions (the `.ai` mode never lists nor stores
conversation ids). Read-marking and reactions are no-ops for AI
threads.

### Tasks

- **Wire to backend.** Add `AiChatEndpoint.chat(prompt:conversationId:)`
  that opens an SSE connection against `POST /api/ai/chat` (route
  doc-comment `backend/routes/ai.js:120`) and feeds streamed tokens
  into `ChatConversationViewModel` as a single growing optimistic
  message (or one-message-per-`event` frame, matching whatever
  `agentService.streamChat` emits per
  `backend/routes/ai.js:156`). Add `getConversations` → `GET /api/ai/conversations`
  (`:358`) for history and `deleteConversation` for the long-press
  delete. The `.ai` `send()` path swaps from "drop the bubble and
  return" to "open SSE, stream chunks, swap pending → confirmed on
  stream-complete." Update the stale comment at VM:22–27 to reflect
  shipped state. PR scope: ~iOS 280 LOC + Android 300 LOC; integration
  test against a stubbed SSE source.
- **Make obvious in UI (fallback).** Until the SSE wiring lands, render
  a non-dismissable amber banner pinned to the top of the AI
  conversation (above the welcome card and above the timeline) reading
  *"Ask Pantopus isn't connected yet — your messages won't get an
  answer. We're hooking up the assistant."* iOS:
  `Features/Chat/Conversation/ChatConversationView.swift` — pin a
  `ChatAiUnavailableBanner` strip only when `mode == .ai`,
  `Theme.Color.warningBg`, `Icon(.triangleAlert)`, no close,
  `accessibilityIdentifier("chatConversation.aiUnavailableBanner")`.
  Visually disable the composer send disc on the AI thread (or surface
  it as `.disabled` with the tooltip *"Coming soon"*) so users don't
  send into the void. Android mirror with the same copy and
  `Modifier.testTag("chatConversation.aiUnavailableBanner")`.

---

## 6. Mailbox map (A11.4)

> Originally listed as Android-only; the iOS file exists too.

- **iOS VM:** `frontend/apps/ios/Pantopus/Features/Mailbox/MailboxMap/MailboxMapViewModel.swift`
- **iOS seed:** `Features/Mailbox/MailboxMap/MailboxMapSampleData.swift`
- **Android VM:** `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mailbox_map/MailboxMapViewModel.kt`
- **Android seed:** same folder, `MailboxMapSampleData.kt`
- **Marker (iOS):** VM:5 — *"A11.4 Mailbox map view-model. No backend —
  `load()` surfaces the [seeded spots]."*
- **Marker (Android):** VM:15–16 — *"A11.4 Mailbox map view-model. No
  backend — [load] surfaces the seeded spots (mirroring the fetch shape
  so the four render states still apply)."* VM:18 — *"Mirrors the iOS
  `MailboxMapViewModel`."*

### (a) Design archetype

Shared `MapListHybridShell` (Android `MailboxMapScreen.kt:84–85` uses
`MapListHybridDetent` / `MapListHybridDetentResolver`; iOS mirrors).

### (b) Does the backend route exist?

**Partially.** The closest endpoint is `HomeMapPin`-shaped:

- `backend/routes/mailboxV2Phase3.js:431` — `GET /map/pins` (bounds-
  filtered, table `HomeMapPin` at `:441`)
- `backend/routes/mailboxV2Phase3.js:472` — `POST /map/pin`
- `backend/routes/mailboxV2Phase3.js:511` — `GET /map/pin/:id`
- `backend/routes/mailboxV2Phase3.js:540` — `DELETE /map/pin/:id`

But these are **home-scoped mail pins**, not the broader "mailbox
spots" concept the mobile code models — `MailboxSpotKind` covers `post
/ drop / locker / carrier / civic` per
`docs/token-drift-color.md:136`. `backend/routes/mailbox.js` (3164
lines), `mailboxV2.js` (1307 lines), `mailboxV2Phase2.js` (1855 lines)
have no `/spots` or `/map` routes. `savedPlaces.js` has only generic
`GET /` and `POST /`. The existing `HomeMapPin` route is the closest
extension point but the data model needs broadening (add `kind` enum,
remove the home-scope filter) before it can serve this surface.

### (c) Planned-vs-deferred status

Undocumented as deferred. `docs/screen-parity-inventory.md:250–253`
lists A11.4 as `REAL_VIEW`. `docs/nav-graph-closure.md:386, 389, 391`
confirms `MAILBOX_MAP` Android route is registered and referenced.
`docs/ship-readiness.md:52–67` marks it as front-end-reachable.

### (d) User-visible consequence

The same hardcoded set of mailbox spots renders for every user. None
of them correspond to real-world infrastructure — taps on a "carrier"
pin can't navigate to a real route, drops can't be added, and "find
nearest locker" produces a fictional answer regardless of where the
user stands. The four render states (loading / empty / populated /
error) all trigger over the seed, so the UI plumbing works — only the
geo data is fake.

### Tasks

- **Wire to backend.** Extend `HomeMapPin` to a broader `MailboxSpot`
  table with a `kind` enum (`post / drop / locker / carrier / civic`,
  matching `MailboxSpotKind`) and lift the home-scope filter for read
  queries. Land `GET /api/mailbox/spots?bbox=...&kinds=...` as the
  primary endpoint (extension of `mailboxV2Phase3.js:431`). On the
  client, replace `MailboxMapSampleData.spots` with the
  `MailboxRepository.spotsInBounds(bbox:)` call wired on camera-stop.
  PR scope: ~backend 300 LOC (migration + route) + iOS 180 LOC +
  Android 200 LOC. If lifting the home-scope filter is too risky,
  ship `/api/mailbox/spots` as a separate read-only aggregator that
  unions `HomeMapPin` with a `PublicMailboxSpot` seeder for the
  carrier / civic kinds.
- **Make obvious in UI (fallback).** Render a non-dismissable info
  strip pinned to the top of the bottom sheet (above the spot-kind
  chip row) reading *"Demo mailbox spots — real locations are coming
  once the spot service is wired. Don't use these for routing yet."*
  iOS: `Features/Mailbox/MailboxMap/MailboxMapView.swift` — insert
  `MailboxMapSampleNotice` (`Theme.Color.infoBg`, `Icon(.info)`, no
  close), `accessibilityIdentifier("mailboxMap.sampleNotice")`.
  Disable the "Get directions" / "Set as drop" CTAs on the per-spot
  cards (or surface as `.disabled` with tooltip *"Demo spot"*) so
  users don't navigate to fake addresses. Android mirror with the
  same copy and `Modifier.testTag("mailboxMap.sampleNotice")`.

---

## Recommended sequencing

If we ship the fallback banners first (one shared `InlineBanner`
component on each platform, six call-sites), users stop being deceived
within a single sprint at low risk. Then wire the three surfaces whose
backend already exists (rows 1, 3, 5) — those are the cheapest
end-to-end-real moves since the server cost is zero. Land the two
new endpoints (rows 2, 4) and the broader mailbox-spot model
(row 6) as separate tracks with their own backend+migration scope.

Order proposed: **6 banners** → **AI chat wire** (row 5; smallest
diff, biggest credibility win) → **Tasks map wire** (row 3) →
**Professional profile wire** (row 1) → **Explore composite endpoint
+ wire** (row 2) → **DiscoverHub magazine endpoint + wire** (row 4)
→ **Mailbox spot model + wire** (row 6).
