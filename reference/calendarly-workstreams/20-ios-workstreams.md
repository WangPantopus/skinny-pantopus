# Calendarly — iOS Parallel Work-Stream Specification

> **Platform:** iOS (SwiftUI, XcodeGen project, Xcode 16.4 / Swift 5.10 language mode, `SWIFT_STRICT_CONCURRENCY=complete`).
> **App root:** `frontend/apps/ios/Pantopus` (project at `frontend/apps/ios/`, `project.yml` + `Makefile`).
> **Backend:** feature-complete on `feature/calendarly` (migrations 159–165, ~70 endpoints in [`reference/calendarly-backend-api.md`](../calendarly-backend-api.md)).
> **Frontend:** greenfield for scheduling.

## 1. Overview

This document is the single source of truth handed to ~19 independent agents to build the **Calendarly** booking layer for the Pantopus iOS app. Calendarly is a Calendly/Cal.com-style booking system over **one owner-polymorphic engine** with three identity pillars: **Personal** (sky), **Home** (green), **Business** (violet).

Work is split into **1 Foundation stream (serial gate, sub-split I0a → I0b)** followed by **18 feature streams (I1…I18) that run fully in parallel and merge to `master` in any order with zero conflicts.** Collectively the 18 feature streams + Foundation cover **all 93 buildable iOS screens** (the canonical inventory is 94; only `C9 Embed Widget` is web-only and excluded — so 93 built on native. `H14 Accessibility & Large-Text pass` is a cross-cutting a11y task owned by I18, not a new screen.)

**The parallel-merge guarantee:** the only files edited by more than one stream are owned by **Foundation**, which merges first. After Foundation lands, every feature stream edits a **disjoint set of files** (its own folder under `Features/Scheduling/**`, plus — for two streams only — exclusive ownership of specific existing files). Because the Xcode project file (`project.pbxproj`) is **generated and gitignored** on this project, there are also **zero project-file merge conflicts** no matter how many files each stream adds. See §3.

---

## 2. How to use this doc

This doc pairs with **`~/Downloads/calendarly-design-prompt-suite.md`** (the 94 screen designs). The operator drives execution like this:

1. **Run Foundation first** (§5). I0a merges to `master`, then I0b merges to `master`. Nothing else starts until both are merged.
2. **For each feature stream**, the operator opens one fresh agent and pastes:
   - that stream's section from this doc (it is self-contained), **plus**
   - the **design prompts for exactly the screen IDs that stream owns**, copied from the design-prompt suite.
3. That agent builds **only** that stream, on its own branch, opens **one PR**, and merges to `master`.
4. Because every stream is file-disjoint after Foundation, the 18 PRs merge in **any order** with no rebases and no conflicts.

> **Where do the designs for shared sheets go?** A handful of sheets are built ONCE by Foundation (I0b) and only *presented* locally by feature streams: `ShareLinkSheet` (C3), `TimezoneSelectorSheet` (C7), `AddToCalendarSheet` (D8), `CancellationPolicySheet` (G14/D10 building block), `SlotTakenSheet` (the 409-alternatives presenter). **Paste those screens' designs to the I0b/Foundation agent**, not the nominal feature stream — the feature stream only wires presentation.

> **Stub model (read once):** Foundation (I0b) creates a `SchedulingRoute` case + a `View`/`ViewModel` **stub ONLY for navigable full-screen destinations**. **Sheets, modals, and embedded cards are NOT routed and have NO stub** — a feature stream presents them locally (`.sheet`/`.fullScreenCover`/inline) from its own parent screen. So each feature stream "fills stubs" only for its *routed full screens*; its sheets/cards are net-new local files. Non-routed IDs include (non-exhaustive): A5 (card), C3, C7, D8 (Foundation sheets), E3, E4, E5, E6, E7, E9, E10, E11 (host sheets/modals), G1, G2, G4 (assignment sheets), H4, H6, H13 (pickers/filter sheets).

Each feature-stream section gives the agent: the goal, the exact screen IDs it owns, the exact backend endpoints to call (with owner-context handling), the exact files it owns vs must-not-touch, the required states/behaviors, and the concrete build/verify/test acceptance commands. An agent reading **only its section + the pasted designs** has everything it needs.

---

## 3. Conflict-safety architecture (iOS)

### 3.1 The iOS shared seams (the ONLY files >1 stream would otherwise touch)

There are exactly **three** real shared-code seams in the iOS app where a new top-level feature must register itself. Foundation owns all of them and makes the **minimal** edit to each, wiring everything to **stub** Scheduling views that feature streams later fill in:

| Seam file | What Foundation adds | What feature streams do |
|---|---|---|
| `Features/Root/HubTabRoot.swift` | one enum case `case scheduling(SchedulingRoute)` on `HubRoute`; one arm in `destination(for:push:)` that delegates → `SchedulingRouter.destination(for: route, owner:, push:)` | never touch — they present their own sheets/screens locally |
| `Features/Root/YouTabRoot.swift` | one enum case `case scheduling(SchedulingRoute)` on `YouRoute`; one arm in `destination(for:)` delegating → `SchedulingRouter`; Me-tile dispatch arms in `handleAction(_:)`/`handleSection(_:)` for `me.scheduling*` routeKeys | never touch |
| `Features/Me/MeViewModel.swift` (+ `Features/Me/MeIdentity.swift`) | the `MeActionTile`/`MeSectionRow` entries (`routeKey` = `me.scheduling`, etc.) that surface scheduling in the You tab | never touch |

All routing **beyond** those three edits lives **inside the Scheduling folder**: `SchedulingRoute` (an enum with a case per routed full screen) and `SchedulingRouter` (the `@ViewBuilder destination(for:owner:push:)` switch) live in `Features/Scheduling/Routing/`. Foundation creates `SchedulingRoute` + `SchedulingRouter` and points every case at a **stub `View` + `ViewModel`** (one stub per routed screen). Feature streams **fill in the stub bodies for their own screens** and never edit the router switch or the route enum.

> Implication: a feature stream adds a screen by editing the **stub file Foundation already created for that screen** (replacing the placeholder body), not by adding a route or a destination arm. The route → stub mapping is established once, by Foundation.

### 3.2 Why Foundation must go first

Foundation owns the **contract layer** every feature stream consumes read-only: the DTOs, the endpoint builders (host + public), the `SchedulingOwner` helper, the typed `SchedulingError`/409 decoder, the shared UI kit (SlotPicker, status pills, identity theming, shared sheets), the feature flag, **and** the route enum + router + per-screen stubs. If two feature streams ran before this existed, they would both try to create these shared files → conflict. Foundation creating them once, first, is what makes the 18 downstream streams disjoint.

Foundation sub-splits to shorten the critical path:
- **I0a** — pure contract layer (project wiring, networking endpoints, DTOs, owner helper, error decoder, feature flag). No UI. Merges first.
- **I0b** — routing seam + shared UI kit + per-screen stubs. Depends on I0a. Merges second.

Both merge before **any** feature stream starts.

### 3.3 The disjoint-ownership guarantee

After I0b merges, the file map is:

- **Foundation owns** (frozen for feature streams): `Core/Networking/Endpoints/Scheduling*.swift`, `Core/Networking/Models/Scheduling/**`, `Features/Scheduling/Foundation/**`, `Features/Scheduling/Routing/**`, `Features/Scheduling/SharedUI/**`, **plus the Home-calendar contract additions `Core/Networking/Endpoints/HomesEndpoints.swift` (booking-union + event-detail + RSVP builders) and `Core/Networking/Models/Homes/CalendarEventDTOs.swift` (booking-union fields `source`/`booking_status`/`booking_id` + migration-164 fields)** — these are EDITED by I0a, then frozen — and the three seam edits in §3.1.
- **Each feature stream Ix owns** a disjoint set of screen files, almost always **new files** under `Features/Scheduling/<Area>/**` plus the **stub bodies** for exactly its screen IDs. No two streams own the same file.

Because the sets are disjoint, the 18 PRs never touch the same line and merge in any order.

### 3.4 Two exclusive-owner exceptions (existing files outside the Scheduling folder)

Two streams extend **pre-existing** modules instead of living entirely in `Features/Scheduling/`. Each is the **sole/exclusive owner** of the files it edits there, so there is still no contention:

- **I10 (Home calendar & RSVP)** is the **EXCLUSIVE owner** of `Features/Homes/Calendar/*` — it extends `HomeCalendarView`/`HomeCalendarViewModel`, `EventDetailView`, `AddEventForm*`, `CalendarEventCategory`, `MonthStripHeader` to render the **booking union** (`source:'booking'`) and RSVP. No other stream touches `Features/Homes/Calendar/*`.
- **I14 (Payments & payouts)** is the **EXCLUSIVE owner** of the Wallet **extension** files it adds under `Features/Wallet/*` (e.g. `Features/Wallet/Scheduling/*` additions for payouts/earnings surfaces). No other stream touches Wallet.

These are called out again in each stream's section.

### 3.5 The platform-specific reason there are no conflicts on iOS

> **CRITICAL CORRECTION vs `reference/calendarly-ios-implementation-phases.md`.**
> That doc treats the Xcode project file as its **#1 hazard** and prescribes a `PBXFileSystemSynchronizedRootGroup` strategy to avoid `project.pbxproj` merge conflicts when many streams add files.
> **That entire strategy is UNNECESSARY and MOOT on this project.** Verified ground truth:
> - The project is **XcodeGen-based**: source of truth is `frontend/apps/ios/project.yml`; the project is generated with `make bootstrap` / `xcodegen generate`.
> - **`frontend/apps/ios/Pantopus.xcodeproj/project.pbxproj` is GIT-IGNORED** (confirmed: `git check-ignore` returns the path). It is a generated artifact and is **never committed**.
>
> Therefore there are **ZERO `project.pbxproj` merge conflicts regardless of how many files each stream adds**, because each branch regenerates its own `project.pbxproj` locally and never commits it. **Foundation does NOT touch `project.pbxproj` and does NOT touch `project.yml`** (XcodeGen auto-discovers sources under the synchronized group). Every agent simply: adds `.swift` files under `Features/Scheduling/**` (or its exclusive existing files), runs `make bootstrap` (which runs `xcodegen generate`) to regenerate the project locally, then builds. Adding N files needs **no shared-file edit**.

Net: on iOS the only shared edits are the three §3.1 seams (Foundation-only) and the centralized route enum/router/stubs (Foundation-only). Everything else is disjoint new files. (Compare: web relies on file-based routing + no shared router; Android centralizes NavHost/DI/Me in Foundation with pre-stubbed destinations. iOS relies on pbxproj-not-tracked + the centralized routing seam.)

---

## 4. Shared preamble — RULES + GLOBAL WIRING CONTRACT

### 4.1 RULES EVERY FEATURE-STREAM AGENT MUST FOLLOW (verbatim)

1. **Only create/edit files this stream OWNS.** If you think you need to add/edit a shared seam file (contract types, endpoints/API service, DI, router, Me entry, a Foundation shared component), **STOP and flag it as a Foundation gap** — do not add it locally.
2. **Present this stream's sheets/modals/states LOCALLY** from your own parent screens; never add a global route/destination.
3. **Reuse the shared shells and Foundation components**; use design-system theme tokens only (no hardcoded colors/spacing).
4. **Honor the global wiring contract** (owner context, tz, manageToken, 409 alternatives, calendar union, paused/secret/expired states, paid feature flag, 501 connect).
5. **Targeted tests only.** Verify in simulator/emulator/preview with a hosted-dev account against the live endpoint (migrations 159–165 applied). Keep test bookings/pages.
6. **One PR per stream to `master`** (never push `master` directly). Build green + verified + screenshots vs design.

### 4.2 GLOBAL WIRING CONTRACT (every stream must honor)

From `reference/calendarly-backend-api.md` (backend feature-complete on this branch, migrations 159–165):

- **Owner context.** Personal ⇒ omit owner fields (signed-in user). Business ⇒ `owner_type:'business'` + `owner_id:<business_user_id>` (query param on GET, body field on writes). Home ⇒ call the `/api/homes/:homeId/scheduling/*` alias (no owner fields). **Foundation provides a `SchedulingOwner` helper that injects this** — never hand-roll owner params.
- **Timezone.** ALWAYS pass `tz` (IANA) on slot/calendar reads; render `startLocal`, store/compare UTC.
- **manageToken.** Persist the one-time `manageToken` returned by `POST /book/...` (and `POST /book/o/:token`) — it is the invitee's only handle for manage/reschedule/cancel/.ics.
- **409 conflict.** Handle `409 { error, alternatives:[{start,end,startLocal}] }` on every booking create/reschedule (codes `SLOT_TAKEN | SLOT_UNAVAILABLE | SLOT_FULL`) — surface nearest open times, never a dead end. (Foundation's `SchedulingError` decoder parses the `alternatives` array.)
- **Home calendar UNION.** Home bookings appear via `GET /api/homes/:id/events` rows tagged `source:'booking'` (+ `booking_status`). **NEVER** create `HomeCalendarEvent` rows for bookings.
- **First-class states.** `paused` / `secret` / `unavailable` / `expired` are response states, not errors (e.g. `status:'paused'`, `status:'expired'`, `status:'unavailable'`).
- **Paid surfaces** (priced event types, packages, invoices, payouts) sit behind a **FEATURE FLAG + Stripe TEST mode** (payout settlement deferred server-side — show processing/pending). Foundation defines the flag (`SchedulingFeatureFlags.paidEnabled`).
- **Connected calendars.** `POST /connected-calendars/connect` returns **501** → show "coming soon"; read endpoints return empty.
- **Error envelope.** `{ error:'CODE', message }`; validation → `400 { error:'Validation failed', details:[{field,message}] }`. Foundation provides a typed decoder.
- **Public booking fetch** hits the backend origin directly at `/api/public/book/:slug` (slug = the booking **page** slug, NOT a booking id). One-off links: `/api/public/book/o/:token`. Manage: `/api/public/booking/:token*`. (Public endpoints use `Endpoint(..., authenticated: false)`.)

---

## 5. Foundation (I0) — serial gate

**Branch(es):** `claude/calendarly-ios-i0a-contract`, then `claude/calendarly-ios-i0b-uikit-routing`.
**Depends on:** nothing.
**Gate:** I0a merges to `master`, then I0b merges to `master`. No feature stream starts until **both** are merged.

Foundation owns the entire shared contract + routing seam + shared UI kit. It builds **nothing user-visible beyond stubs** — its job is to unblock all 18 feature streams.

### 5.1 I0a — Contract layer (no UI)

**Branch:** `claude/calendarly-ios-i0a-contract`.

**Files I0a OWNS (creates):**
- `Core/Networking/Endpoints/SchedulingEndpoints.swift` — host endpoint builders for `/api/scheduling/*` AND the `/api/homes/:homeId/scheduling/*` alias. Mirror `Core/Networking/Endpoints/HomesEndpoints.swift` + `GigsEndpoints.swift` style: each helper returns `Endpoint(method:, path:, query:, body:)` with a doc-comment citing the backend route. Cover **all** host routes used across streams: booking-page (get/put/slug/check-slug/reset-slug/disable/one-off-links), event-types (CRUD + assignees + questions), availability (schedules/rules/overrides/blocks), notification-preferences, payments/status, connected-calendars (get + connect→501), message-templates (+ preview), workflows, bookings (list/summary/detail/available-slots/create/approve/decline/cancel/reschedule/no-show/reassign/rsvp/recurring/nudge/propose-reschedule/apply-credit), bookings insights (no-shows/team), invoices (list/detail/send), packages (CRUD + buy), my-packages, my-bookings, find-a-time, whos-free, team-availability, resources (CRUD + book), visits, waitlist (list + promote), polls (create/list/detail/finalize).
- `Core/Networking/Endpoints/SchedulingPublicEndpoints.swift` — public endpoint builders (all `authenticated: false`): `GET /api/public/book/:slug`, `GET /api/public/book/:slug/:eventTypeSlug/slots`, `POST /api/public/book/:slug/:eventTypeSlug`, `GET/POST /api/public/book/o/:token`, `GET /api/public/booking/:token`, `…/available-slots`, `…/ics`, `…/reschedule`, `…/cancel`, `…/unsubscribe`, `…/accept-reschedule`, `…/decline-reschedule`, `POST /api/public/book/:slug/:eventTypeSlug/waitlist`, `GET /api/public/poll/:id`, `POST /api/public/poll/:id/vote`.
- `Core/Networking/Models/Scheduling/*DTOs.swift` — one file per resource group; each DTO `public struct …: Decodable, Sendable, Hashable` (`Identifiable` when it has `id`) with explicit snake_case `CodingKeys` (APIClient does NOT convertFromSnakeCase). Suggested files: `BookingPageDTOs.swift`, `EventTypeDTOs.swift`, `AvailabilityDTOs.swift`, `BookingDTOs.swift`, `PublicBookingDTOs.swift` (page view, public event-type view, slot `{start,end,startLocal}`, booking-create response incl. `manageToken`/`clientSecret`, manage view incl. `actions`/`payment`), `PaymentsSchedulingDTOs.swift`, `PackageDTOs.swift`, `InvoiceDTOs.swift`, `WorkflowDTOs.swift`, `MessageTemplateDTOs.swift`, `ResourceDTOs.swift`, `VisitDTOs.swift`, `FindATimeDTOs.swift` (slots + `eligibleHosts`, `freeByMember`), `PollDTOs.swift`, `WaitlistDTOs.swift`, `InsightsDTOs.swift`, `NotificationPrefsDTOs.swift`.
- `Features/Scheduling/Foundation/SchedulingOwner.swift` — the owner-context helper. Models `enum SchedulingOwner { case personal; case business(id: String); case home(homeId: String) }`. Exposes: `queryItems` (owner_type/owner_id for GET), `ownerBody` fields for write payloads, and a `pathPrefix` that returns `/api/scheduling` for personal/business and `/api/homes/<homeId>/scheduling` for home. Every endpoint builder takes a `SchedulingOwner` and uses this — feature streams never hand-roll owner params.
- `Features/Scheduling/Foundation/SchedulingError.swift` — typed error + decoder. Decodes the error envelope `{ error, message }`, validation `400 { error:'Validation failed', details:[{field,message}] }`, and the **409 conflict** `{ error: SLOT_TAKEN|SLOT_UNAVAILABLE|SLOT_FULL, message, alternatives:[{start,end,startLocal}] }`. Provide `static func from(_ apiError: APIError, data: Data?) -> SchedulingError` that downcasts `APIError.clientError(status:message:)` and re-decodes the body for `alternatives`/`details`/`status`. Also surface first-class response states (`paused/secret/unavailable/expired`) as a `SchedulingStatus` enum used by public DTOs.
- `Features/Scheduling/Foundation/SchedulingFeatureFlags.swift` — `enum SchedulingFeatureFlags { static var paidEnabled: Bool }` (the paid feature flag; default off; toggled via `AppEnvironment`/UserDefaults). Gates all priced surfaces.
- `Features/Scheduling/Foundation/SchedulingTime.swift` — small tz helpers: parse UTC ISO, render `startLocal` for a given IANA tz, device-tz default, and `TimeZone.identifier` IANA list source for the timezone selector.
- **EDIT `Core/Networking/Models/Homes/CalendarEventDTOs.swift`** (the ONE pre-existing file I0a edits, besides the seam) — add the booking-union + migration-164 fields to `CalendarEventDTO`: `source` (`event`|`booking`), `bookingStatus` (`pending`|`confirmed`), `bookingId`, plus `visibility`, `requestRsvp`, `reminders` — each `Optional` with explicit snake_case `CodingKeys` so existing decodes still pass. Add a `HomeEventAttendeeDTO` (`user_id`,`rsvp_status`,`updated_at`) + a `HomeEventDetailResponse` (event + attendees) for the event-detail call. **Rationale:** the Home-calendar UNION (`GET /api/homes/:id/events`) and RSVP are consumed by I10 (and the calendar read by I12), and both would otherwise add these fields → collision; centralizing them in I0a keeps I10/I12 disjoint.
- **EDIT `Core/Networking/Endpoints/HomesEndpoints.swift`** — add `getHomeEvent(homeId:eventId:)` → `GET /api/homes/:id/events/:eventId` and `rsvpHomeEvent(homeId:eventId:body:)` → `POST /api/homes/:id/events/:eventId/rsvp`. (`homeEvents`/`createHomeEvent`/`updateHomeEvent`/`deleteHomeEvent` already exist; the home `/events*` router is separate from the `:homeId/scheduling` mount.) I10/I12 consume these read-only.

**I0a MUST NOT touch:** any `Features/Root/*`, `Features/Me/*`, any other existing endpoint/DTO file (the two `Homes/` files above are the only pre-existing edits), any other stream's folder. (Almost-pure additive contract.)

**Acceptance (I0a):** `make bootstrap` then build the `Pantopus` scheme succeeds (Xcode 16.4, Swift 5.10, strict concurrency complete) with the new contract files compiling; targeted decode tests under `PantopusTests/Scheduling/Contract/` driving `APIClient(retryPolicy: .none, session: SequencedURLProtocol.makeSession())` with stubbed `.status(200, body:)` / `.status(409, body:)` fixtures proving each DTO decodes and `SchedulingError` parses `alternatives`/`details`; SwiftLint hex-grep guard + `.swiftformat` pass.

### 5.2 I0b — Routing seam + shared UI kit + per-screen stubs

**Branch:** `claude/calendarly-ios-i0b-uikit-routing`. **Depends on:** I0a merged.

**Files I0b OWNS (creates):**
- `Features/Scheduling/Routing/SchedulingRoute.swift` — `public enum SchedulingRoute: Hashable` with **one case per navigable FULL-SCREEN destination only** (carry only `Hashable` payloads: ids, slugs, tokens, the `SchedulingOwner`). **Do NOT add cases for sheets/modals/cards** — those are presented locally by the owning stream and have no route or stub (see the "Stub model" note in §2 for the non-routed ID list). Create exactly one stub `View`+`ViewModel` per routed case; feature streams fill their own stubs and present their own sheets locally.
- `Features/Scheduling/Routing/SchedulingRouter.swift` — `@ViewBuilder static func destination(for route: SchedulingRoute, owner: SchedulingOwner, push: @escaping @MainActor @Sendable (SchedulingRoute) -> Void) -> some View` switching every case → its **stub view**. **This switch is the only place the route→view mapping lives; feature streams never edit it.**
- `Features/Scheduling/Routing/Stubs/*.swift` — one **stub `View` + stub `@Observable @MainActor ViewModel`** per routed screen (placeholder body = a labeled `EmptyView`/`Text` + the wired `init`). Feature streams replace the placeholder body in **their** stub file. Group stubs by area folder mirroring the streams (e.g. `Stubs/Setup/A1HubStub.swift`).
- `Features/Scheduling/SharedUI/**` — the reusable kit every stream consumes read-only:
  - `SlotPicker.swift` — date + time slot grid driven by `[SlotDTO]` (`start/end/startLocal`), tz-aware, with loading/empty/no-availability states.
  - `SchedulingStatusPill.swift` — pills for `pending/confirmed/cancelled/declined/no_show/paused/secret/expired/unavailable`.
  - `SchedulingIdentityTheme.swift` — maps `SchedulingOwner` → identity accent (`.personal` sky / `.home` green / `.business` violet) reusing `WizardIdentity` `.accent`/`.accentBg` from `Features/Shared/Wizard/WizardIdentity.swift`; tokens only (`Theme.Color.*`).
  - Shared sheets (presented locally by streams, defined once here): `TimezoneSelectorSheet.swift` (C7), `AddToCalendarSheet.swift` (D8, `.ics` download via `requestData`), `SlotTakenSheet.swift` (renders 409 `alternatives`), `ShareLinkSheet.swift` (C3 building block), `CancellationPolicySheet.swift` (G14/D10 building block).
- `Features/Scheduling/Foundation/SchedulingClient.swift` (optional thin service) — convenience wrappers over `APIClient.shared.request(...)` that fold in `SchedulingOwner` + map thrown `APIError` → `SchedulingError`. Streams may call this or `APIClient` directly.

**Seam edits I0b makes (the ONLY edits to existing files):**
- `Features/Root/HubTabRoot.swift`: add `case scheduling(SchedulingRoute)` to `HubRoute`; add one arm in `destination(for:push:)` → `SchedulingRouter.destination(for: route, owner:, push: { push(.scheduling($0)) })`.
- `Features/Root/YouTabRoot.swift`: add `case scheduling(SchedulingRoute)` to `YouRoute`; add one arm in `destination(for:)` → `SchedulingRouter…`; add `me.scheduling*` dispatch arms in `handleAction(_:)`/`handleSection(_:)`.
- `Features/Me/MeViewModel.swift` + `Features/Me/MeIdentity.swift`: add the `MeActionTile`/`MeSectionRow` entries that surface Scheduling (routeKey `me.scheduling`, plus home/business variants) in the You tab.

**I0b MUST NOT touch:** any feature-screen logic beyond stub scaffolding; the contract files from I0a (consume read-only).

**Acceptance (I0b):** `make bootstrap` + build green; every `SchedulingRoute` case resolves to a stub that renders without crash in a SwiftUI `#Preview`; the Hub/You/Me entry points navigate to the Scheduling Hub stub in the simulator (hosted-dev account); **no default-argument `@MainActor` view-model initializers** anywhere (known Xcode 16.4 crash — init VMs without default args, hold via `@State`); SwiftLint + `.swiftformat` pass.

---

## 6. The 18 feature streams

> **Common acceptance for every feature stream** (not repeated per section): builds green via `make bootstrap` then build the `Pantopus` scheme (Xcode 16.4 / Swift 5.10 / strict concurrency complete); **verify in the iOS Simulator signed in with a hosted-dev account against the live endpoint** (migrations 159–165 applied) — exercise each owned screen end-to-end and keep the test bookings/pages; **targeted tests only** under `PantopusTests/Scheduling/<Stream>/` driving the stream's view-models/services with `APIClient(retryPolicy: .none, session: SequencedURLProtocol.makeSession())` (never run full suites — see memory: targeted tests only); capture screenshots vs the pasted designs; SwiftLint hex-grep guard + `.swiftformat` pass; **no default-argument `@MainActor` VM inits**. Every fetchable surface ships the four states (loading skeleton / empty `EmptyState` / loaded / error+Retry) and wraps the body in `.offlineBanner(...)`. **One PR per stream; merge to `master` conflict-free.**
>
> **Common "MUST NOT touch" for every feature stream** (not repeated per section): the Foundation-owned files — `Core/Networking/Endpoints/Scheduling*.swift`, `Core/Networking/Models/Scheduling/**`, `Core/Networking/Endpoints/HomesEndpoints.swift`, `Core/Networking/Models/Homes/CalendarEventDTOs.swift`, `Features/Scheduling/Foundation/**`, `Features/Scheduling/Routing/SchedulingRoute.swift`, `Features/Scheduling/Routing/SchedulingRouter.swift`, `Features/Scheduling/SharedUI/**` — and `Features/Root/HubTabRoot.swift`, `Features/Root/YouTabRoot.swift`, `Features/Me/*`. (I10 owns the Home-calendar *view* files in `Features/Homes/Calendar/*` but still consumes the `Homes/` DTO + endpoint additions read-only.) A stream edits **only its own stub bodies** under `Features/Scheduling/Routing/Stubs/<its screens>` and creates **new files** under its own `Features/Scheduling/<Area>/**` folder (exceptions: I10 owns `Features/Homes/Calendar/*`, I14 owns its `Features/Wallet/*` additions).
>
> **Common reuses for every feature stream** (not repeated per section): the shells in `Features/Shared/` (`ListOfRowsView`, `FormShell`, `WizardShell`+`WizardIdentity`, `ContentDetailShell`), `Core/Design` tokens (`Theme.Color.*`, `Spacing`, `Radii`, `Icon(...)`), `Core/Design/Components/EmptyState.swift`, `Features/Shared/Feed/FeedComponents.swift` skeletons, and **all** Foundation contract + SharedUI components (DTOs, endpoints, `SchedulingOwner`, `SchedulingError`, `SchedulingFeatureFlags`, `SlotPicker`, `SchedulingStatusPill`, `SchedulingIdentityTheme`, `TimezoneSelectorSheet`, `AddToCalendarSheet`, `SlotTakenSheet`, `ShareLinkSheet`, `CancellationPolicySheet`).

---

### Stream I1 — Setup & Hub   [host config] [MVP-heavy]  (~6 screen-equivalents)
**Goal:** The scheduling entry experience — the Hub, the first-run wizard that creates the booking link, the settings root, notification prefs, and the summary card — for all three pillars.
**Screens (this stream owns):** A1 Scheduling Hub[MVP]; A2 First-Run Wizard / Set Up Booking Link[MVP]; A3 Scheduling Settings Root[MVP]; A4 Notifications Preferences[MVP]; A5 Summary Card[MVP]; A6 Onboarding for Home & Business[v2].
**Backend endpoints used:** `GET /bookings/summary` (A5/A1, owner ctx); `GET /booking-page` (auto-creates; A1/A3); `GET /booking-page/check-slug`, `PUT /booking-page/slug`, `POST /booking-page/reset-slug` (A2 wizard); `PUT /booking-page` (A3 toggles is_live); `GET/PUT /notification-preferences` (A4, personal). Owner context via `SchedulingOwner` on all `/booking-page`/`/bookings` calls; A6 walks Home (`/api/homes/:homeId/scheduling/*`) + Business (`owner_type:'business'`).
**Files this stream OWNS:** `Features/Scheduling/Setup/**` (HubView/ViewModel, FirstRunWizard* using `WizardShell`, SettingsRootView/ViewModel, NotificationsPrefsView/ViewModel using `FormShell`, SummaryCardView, OnboardingHomeBusiness*); the stub bodies for the routed full screens A1, A2, A3, A4, A6 under `Features/Scheduling/Routing/Stubs/Setup/*` (A5 Summary Card is an embedded card inside A1/A3 — a local view, NOT a routed screen, so it has no stub).
**Required states/behaviors:** Hub empty/zero-state when no page+no bookings (drive into A2). Wizard: live slug check via `check-slug` (debounced) with suggestions on 409 SLUG_TAKEN; persist chosen slug; identity-themed steps per pillar. Settings toggles optimistic with refetch-on-error. Notification prefs flexible object — round-trip unknown keys. Summary card uses `nextBooking`/counts; loading skeleton mirrors card geometry.

---

### Stream I2 — Event Types   [host config] [MVP+v2]  (~4 screen-equivalents)
**Goal:** Create, list, and edit event types/services (durations, location, pricing, approval, visibility) incl. intake questions; surface connected-calendars "coming soon".
**Screens (this stream owns):** B1 Event Type/Service List[MVP]; B2 Event Type/Service Editor[MVP]; B3 Intake Questions Editor[v2]; B8 Connected Calendars[v2 →501].
**Backend endpoints used:** `GET /event-types`, `POST /event-types`, `GET /event-types/:id`, `PUT /event-types/:id`, `DELETE /event-types/:id` (409 HAS_UPCOMING_BOOKINGS → offer deactivate via `PUT is_active=false`); `PUT /event-types/:id/questions` (B3); `GET /connected-calendars` (empty), `POST /connected-calendars/connect` (501 → "coming soon"). Owner ctx via `SchedulingOwner`. Priced fields (price_cents/deposit/refund_policy) gated behind `SchedulingFeatureFlags.paidEnabled`.
**Files this stream OWNS:** `Features/Scheduling/EventTypes/**` (ListView/VM via `ListOfRowsView`, EditorView/VM via `FormShell`, IntakeQuestionsEditor*, ConnectedCalendarsView/VM); stub bodies for B1,B2,B3,B8.
**Required states/behaviors:** list empty-state → "create your first"; editor slug check (409 SLUG_TAKEN) + `default_duration ∈ durations`; delete guard surfaces upcoming-bookings 409 with deactivate fallback; 501 connect shows coming-soon, read returns empty; priced section hidden when flag off; assignees editing is NOT here (lives in I13 — editor links out via router for collective/round-robin).

---

### Stream I3 — Availability   [host config] [MVP+v2]  (~5 screen-equivalents)
**Goal:** Manage availability schedules, weekly hours, date overrides/holidays, booking limits/notice rules, and ad-hoc blocked time.
**Screens (this stream owns):** B4 Availability Schedule List[MVP]; B5 Weekly Hours Editor[MVP]; B6 Date Overrides & Holidays[v2]; B7 Booking Limits & Notice Rules[v2]; B9 Block off time[MVP].
**Backend endpoints used:** `GET /availability` (schedules+rules+overrides; **always personal** — no owner ctx, scoped to `req.user`); `POST /availability`, `PUT /availability/:id`, `DELETE /availability/:id` (409 CANNOT_DELETE_DEFAULT); `PUT /availability/:id/rules` (B5, weekday 0=Sun, HH:MM); `PUT /availability/:id/overrides` (B6); `POST /availability/blocks`, `DELETE /availability/blocks/:blockId` (B9). B7 booking-limits/notice rules persist on the **event type** (`min_notice_min`, `max_horizon_days`, `slot_interval_min`, `daily_cap`, `per_booker_cap`, buffers) via `PUT /event-types/:id` — read-only event-type fields; do not duplicate the editor (link from B7 to I2's editor for type-level fields, own only the rules surface here).
**Files this stream OWNS:** `Features/Scheduling/Availability/**` (ScheduleListView/VM, WeeklyHoursEditor*, DateOverridesView/VM, BookingLimitsView/VM, BlockOffTimeSheet/VM); stub bodies for B4–B7,B9.
**Required states/behaviors:** availability is personal-only (no owner switch); replacing rules/overrides is whole-set PUT (build full payload); cannot-delete-default guard prompts reassign; HH:MM 24h validation; blocks support optional RRULE; default schedule auto-created on first GET.

---

### Stream I4 — Booking page & sharing   [host config] [MVP]  (~5 screen-equivalents)
**Goal:** Manage the public booking page (live/paused/visibility), preview it, share the link, generate one-off links, and the page empty/zero-state.
**Screens (this stream owns):** C1 Booking Link/Public Page Management[MVP]; C2 Public Booking Page Preview[MVP]; C3 Share Your Link Sheet[MVP]; C4 One-off/Single-use Link Generator[MVP]; H16 Booking-Link/Page Empty & Zero-State[MVP]. (C9 Embed Widget is web-only — NOT in this stream.)
**Backend endpoints used:** `GET /booking-page`, `PUT /booking-page` (title/tagline/intro/branding/is_live/is_paused/visibility), `POST /booking-page/disable`, `POST /booking-page/reset-slug`, `GET /booking-page/check-slug`/`PUT /booking-page/slug` (C1); `POST /booking-page/one-off-links` (C4 — returns `token`+`path`+`expires_at`, store token in the shared link, supports `offered_slots`); for C2 preview, fetch the public view `GET /api/public/book/:slug` (authenticated:false). Owner ctx via `SchedulingOwner`.
**Files this stream OWNS:** `Features/Scheduling/BookingPage/**` (PageManagementView/VM via `FormShell`, PublicPreviewView/VM, OneOffLinkGeneratorView/VM); stub bodies for C1,C2,C4,H16. **Reuses `ShareLinkSheet` (Foundation) for C3 — presents it locally; does not redefine it.**
**Required states/behaviors:** paused/unlisted reflected in management + preview; reset-slug danger confirm (invalidates old link); one-off expiry + single-use options; H16 zero-state when no event types/no page (CTA into A2/B2 via router); preview renders the public `status:'paused'` state honestly.

---

### Stream I5 — Invitee discovery   [invitee/public] [MVP]  (~4 screen-equivalents)
**Goal:** The public invitee-facing landing → slot picking → timezone selection → no-availability flow (against the backend origin, no auth).
**Screens (this stream owns):** C5 Booking Landing/Booker Profile[MVP]; C6 Date+Time Slot Picker[MVP]; C7 Timezone Selector[MVP]; C8 Slot/No-Availability State[MVP].
**Backend endpoints used (all public, `authenticated:false`):** `GET /api/public/book/:slug` (C5 — page + eventTypes; `status:'paused'|'active'`); `GET /api/public/book/:slug/:eventTypeSlug/slots?from&to&tz` (C6/C8 — `slots[]`, `status:'paused'` → empty); one-off entry `GET /api/public/book/o/:token` (C6 alt). **Always pass `tz`**; render `startLocal`.
**Files this stream OWNS:** `Features/Scheduling/Invitee/Discovery/**` (BookingLandingView/VM via `ContentDetailShell`, DiscoverySlotPickerView/VM wrapping Foundation `SlotPicker`, NoAvailabilityView). **Reuses `TimezoneSelectorSheet` (Foundation) for C7 — presents locally (no stub).** Stub bodies for the routed full screens C5, C6, C8 (C7 is a Foundation sheet; C8 may instead be an empty-state inside C6 — if so present locally).
**Required states/behaviors:** `status:'paused'` → friendly paused state (not error); secret event types absent from list; no-availability (C8) offers next-horizon paging; tz selector defaults to device IANA, re-fetches slots on change; this stream STOPS at slot selection — confirm/checkout is I6 (hand off via router carrying slug/eventTypeSlug/start/tz).

---

### Stream I6 — Invitee confirm & manage   [invitee/public] [MVP]  (~4 screen-equivalents)
**Goal:** The invitee booking commit (intake form → review/checkout → confirmed) and the manage-your-booking surface, persisting and using `manageToken`.
**Screens (this stream owns):** D1 Intake/Booking Details Form[MVP]; D2 Review & Confirm/Checkout[MVP]; D3 Booking Confirmed/Thank-You[MVP]; D4 Manage Your Booking[MVP].
**Backend endpoints used (public, `authenticated:false`):** `POST /api/public/book/:slug/:eventTypeSlug` and `POST /api/public/book/o/:token` (D2 — returns `manageToken` + optional `clientSecret`; **persist manageToken**); `GET /api/public/booking/:token` (D4 — `booking`+`actions`+`payment`+`eventType`+`page`); `GET /api/public/booking/:token/available-slots`. **409 handling required** on create (SLOT_TAKEN/UNAVAILABLE/FULL → present Foundation `SlotTakenSheet` with `alternatives`). Paid path uses `clientSecret` only when `SchedulingFeatureFlags.paidEnabled` (Stripe TEST mode; settlement deferred → show processing).
**Files this stream OWNS:** `Features/Scheduling/Invitee/Confirm/**` (IntakeFormView/VM via `FormShell` from `eventType.questions`, ReviewConfirmView/VM, ConfirmedView/VM, ManageBookingView/VM); `Features/Scheduling/Invitee/ManageTokenStore.swift` (persists manageToken). Stub bodies for D1,D2,D3,D4. **Reuses `AddToCalendarSheet`/`SlotTakenSheet` (Foundation), presents locally.**
**Required states/behaviors:** intake from dynamic questions (text/textarea/select/multiselect/checkbox/phone, required flags); review shows policy snapshot + price when flagged; on create persist `manageToken` and route to D3 with it; D3 offers Add-to-Calendar (`.ics`); D4 computes can_cancel/can_reschedule from `actions`; 409 alternatives flow; reschedule/cancel are I7's edge surfaces (D4 links to them via router carrying token).

---

### Stream I7 — Invitee edge & customer   [invitee/public + customer] [MVP+v2]  (~8 screen-equivalents)
**Goal:** All invitee edge states (conflict, payment failure, unavailable/expired/paused/secret, policy-blocked), add-to-calendar, the native deep-link interstitial, plus the customer's bookings/packages list and recurring setup.
**Screens (this stream owns):** D5 Slot Taken/Conflict[MVP]; D6 Payment Failed/Retry[v2]; D7 Unavailable/Expired/Paused/Secret[MVP]; D8 Add to Calendar[MVP]; D9 Open-in-App/Deep-Link Hand-off[MVP, native interstitial]; D10 Reschedule/Cancel Cutoff & Policy-Blocked[MVP]; D11 My Bookings (customer)[v2]; D12 Recurring/Multi-Session Setup[v2].
**Backend endpoints used:** public reschedule/cancel via `POST /api/public/booking/:token/reschedule|cancel` + `…/accept-reschedule|decline-reschedule` (D10); `GET /api/public/booking/:token/ics` (D8, raw `.ics` via `requestData`); `GET /api/public/book/:slug` / `…/o/:token` to detect `status:'unavailable'|'expired'|'paused'` + secret (D7); `GET /my-bookings` (D11, authed customer); `POST /bookings/recurring` (D12, owner ctx) or public-flow repeated; D6 retries the priced `clientSecret` confirm (flagged). 409 alternatives feed D5.
**Files this stream OWNS:** `Features/Scheduling/Invitee/Edge/**` (SlotTakenView/VM rendering 409 alternatives as a screen, PaymentFailedView/VM, UnavailableExpiredView/VM keyed by `SchedulingStatus`, PolicyBlockedView/VM, RecurringSetupView/VM), `Features/Scheduling/Customer/MyBookingsView+VM.swift`, `Features/Scheduling/Invitee/DeepLinkInterstitialView.swift` (D9 — presented locally; **reads `Core/Routing/DeepLinkRouter.swift` read-only**, does not edit it). Stub bodies for D5,D6,D7,D9,D10,D11,D12. **Reuses Foundation `AddToCalendarSheet` for D8, `CancellationPolicySheet` for D10.**
**Required states/behaviors:** every status state is first-class (not an error screen); policy-blocked surfaces deadlines from `actions` (reschedule_deadline/free_cancel_until); D9 interstitial offers Open-in-App vs continue-in-web; D6 only when paid flag on; D11 dedupes by booking id, shows past/upcoming; D12 builds `sessions[]`.

---

### Stream I8 — Bookings inbox & core   [host lifecycle] [MVP]  (~5 screen-equivalents)
**Goal:** The host bookings inbox, booking detail, and the core lifecycle actions (approve/decline, reschedule/reassign, cancel/refund).
**Screens (this stream owns):** E1 Bookings Inbox[MVP]; E2 Booking Detail[MVP]; E3 Approve/Decline Sheet[MVP]; E4 Reschedule/Reassign Sheet[MVP]; E5 Cancel & Refund Sheet[MVP].
**Backend endpoints used (host, owner ctx):** `GET /bookings?status&event_type_id&from&to&q` (E1); `GET /bookings/:id` (E2 — booking+attendees+eventType); `POST /bookings/:id/approve`, `…/decline` (E3); `GET /bookings/:id/available-slots?from&to&tz` + `POST /bookings/:id/reschedule` (start_at[,host_user_id]) + `POST /bookings/:id/reassign` (host_user_id) (E4); `POST /bookings/:id/cancel` (reason → refund_issued/refund logic) (E5). 409 on reschedule (SLOT_CONFLICT/PAST_DEADLINE) → alternatives.
**Files this stream OWNS:** `Features/Scheduling/Bookings/**` (InboxView/VM via `ListOfRowsView` with status tabs, BookingDetailView/VM via `ContentDetailShell`, ApproveDeclineSheet/VM, RescheduleReassignSheet/VM wrapping `SlotPicker`, CancelRefundSheet/VM); stub bodies for the routed full screens E1, E2 only (E3 Approve/Decline, E4 Reschedule/Reassign, E5 Cancel & Refund are sheets presented locally from E1/E2 — no stubs).
**Required states/behaviors:** inbox tabs map to `status` filter (upcoming/pending/past/cancelled); search `q`; detail shows `SchedulingStatusPill`; reassign only for home/business (validate INVALID_HOST); reschedule honors tz + 409 alternatives; cancel surfaces refund_issued + reason; optimistic status flip with refetch; PAST_DEADLINE/ALREADY_* guards surfaced.

---

### Stream I9 — Bookings extras   [host lifecycle] [v2]  (~8 screen-equivalents)
**Goal:** Advanced host booking ops: no-show, post-meeting follow-up, group rosters/seats, search & filter, double-book warning, nudges, manual/on-behalf booking, and waitlist management.
**Screens (this stream owns):** E6 Mark No-Show[v2]; E7 Post-Meeting Follow-up[v2]; E8 Group Event Roster & Seats[v2]; E9 Booking Search & Filter[v2]; E10 Double-Book Warning (host)[v2]; E11 Send a Nudge[v2]; E12 Manual/On-Behalf Booking[v2]; E13 Waitlist Join & Management[v2].
**Backend endpoints used (host, owner ctx):** `POST /bookings/:id/no-show` (E6, NOT_APPLICABLE_YET guard); `POST /bookings/:id/nudge` (E11); `POST /bookings` manual create + `POST /bookings/:id/propose-reschedule` (E12 — createdVia manual; 409 alternatives); `GET /bookings/:id` attendees for roster (E8); `GET /bookings?…` advanced filters (E9); `GET /event-types/:id/waitlist`, `POST /waitlist/:id/promote` (E13); E7 follow-up uses `POST /bookings/:id/nudge` / message-templates (read-only from I16's owned endpoints — call endpoint directly, do not edit templates UI). E10 double-book detection reads `GET /bookings/:id/available-slots` conflicts.
**Files this stream OWNS:** `Features/Scheduling/BookingsExtras/**` (NoShowSheet, FollowUpSheet, GroupRosterView/VM, SearchFilterView/VM, DoubleBookWarningView, NudgeSheet, ManualBookingView/VM via `WizardShell`/`FormShell`, WaitlistView/VM); stub bodies for the routed full screens E8 (Group Roster), E12 (Manual/On-Behalf Booking), E13 (Waitlist) only — E6 No-Show, E7 Follow-up, E9 Search & Filter, E10 Double-Book Warning, E11 Nudge are sheets/modals presented locally (no stubs).
**Required states/behaviors:** no-show only after event end (handle NOT_APPLICABLE_YET); roster shows `seat_cap` vs attendees, RSVP states; manual booking owner-scoped + 409 alternatives; nudge optional message; waitlist promote notifies; double-book warning is advisory, not a hard block.

---

### Stream I10 — Home calendar & RSVP   [home] [MVP]  (~5 screen-equivalents)  — **EXCLUSIVE owner of `Features/Homes/Calendar/*`**
**Goal:** Extend the existing Home Calendar to render the **booking union** (`source:'booking'`), home event detail + RSVP, add/edit home events, household availability settings, and the permission-gated scheduler view.
**Screens (this stream owns):** F1 Home Calendar/Agenda[MVP]; F2 Home Event Detail + RSVP[MVP]; F3 Home Add/Edit Event[MVP]; F8 My Household Availability Settings[MVP]; F15 Permission-Gated Scheduler View[MVP].
**Backend endpoints used:** `GET /api/homes/:id/events?start_after&start_before` (UNION — rows tagged `source:'event'|'booking'` + `booking_status`); `POST/PUT/DELETE /api/homes/:id/events`, `GET /api/homes/:id/events/:eventId`, `POST /api/homes/:id/events/:eventId/rsvp` (status going|maybe|declined|pending); F8 household availability via `GET/POST/PUT /availability*` (personal) for the signed-in member; F15 gates on `checkHomePermission`/`calendar.view`. **NEVER create HomeCalendarEvent rows for bookings** — booking rows are render-only, deep-link into Scheduling booking detail (E2 via router).
**Files this stream OWNS (EXCLUSIVE):** `Features/Homes/Calendar/*` — extends `HomeCalendarView.swift`/`HomeCalendarViewModel.swift`, `EventDetailView.swift`, `AddEventFormView.swift`/`AddEventFormViewModel*.swift`/`AddEventFormTypes.swift`, `CalendarEventCategory.swift`, `MonthStripHeader.swift`, `CalendarEventFormRoute.swift`; plus new `Features/Scheduling/Home/HouseholdAvailability*` + `Features/Scheduling/Home/PermissionGatedScheduler*` for F8/F15. Stub bodies for F1,F2,F3,F8,F15. **No other stream touches `Features/Homes/Calendar/*`.** **CONSUME read-only (do NOT edit — owned by I0a/Foundation):** the booking-union fields on `CalendarEventDTO` and the `getHomeEvent`/`rsvpHomeEvent` builders in `HomesEndpoints.swift`. If a needed field/endpoint is missing, STOP and flag it as a Foundation (I0a) gap — do not add it here.
**Required states/behaviors:** differentiate `source:'booking'` rows visually (badge + `booking_status` pill); RSVP upsert with optimistic flip; permission-gated view hides scheduler when no `calendar.view`; add/edit honors the home event_type enum; booking rows open Scheduling detail, not the event editor.

---

### Stream I11 — Find-a-time & who's-free   [home] [MVP+v2]  (~4 screen-equivalents)
**Goal:** Cross-member scheduling for a household — set up a find-a-time search, view suggested common slots, member poll responses, and the who's-free availability grid.
**Screens (this stream owns):** F4 Find a Time — Setup[MVP]; F5 Find a Time — Suggested Slots[MVP]; F6 Find a Time — Member Poll Response[v2]; F7 Who's Free — Household Availability[v2].
**Backend endpoints used (home-only, owner ctx via `/api/homes/:homeId/scheduling`):** `GET /find-a-time?member_ids&mode&duration_min&from&to&slot_interval_min&timezone` (F4/F5 — slots + `eligibleHosts`); `GET /whos-free?from&to&tz` (F7 — `members`+`freeByMember`); polls for F6: `POST /polls`, `GET /polls/:id`, `POST /polls/:id/finalize` (host) + public `GET /api/public/poll/:id`, `POST /api/public/poll/:id/vote` (member response).
**Files this stream OWNS:** `Features/Scheduling/FindATime/**` (FindATimeSetupView/VM, SuggestedSlotsView/VM wrapping `SlotPicker`, MemberPollResponseView/VM, WhosFreeView/VM grid); stub bodies for F4,F5,F6,F7.
**Required states/behaviors:** find-a-time requires ≥1 member_id; collective vs round_robin mode toggle; tz passed + `startLocal` rendered; who's-free renders per-member free grids; F6 vote upsert with POLL_CLOSED/INVALID_OPTION handling; finalize records `finalized_start_at`.

---

### Stream I12 — Home resources & visits   [home] [v2]  (~6 screen-equivalents)
**Goal:** Bookable home resources (rooms/vehicles/tools) — list, edit, detail/calendar, booking — plus scheduling household visits (vendor/guest).
**Screens (this stream owns):** F9 Bookable Home Resources — List[v2]; F10 Resource Editor[v2]; F11 Resource Detail/Booking Calendar[v2]; F12 Book a Resource[v2]; F13 Schedule a Visit — Setup[v2]; F14 Visit Detail[v2].
**Backend endpoints used (home-only, owner ctx):** `GET /resources`, `POST /resources`, `PUT /resources/:rid`, `DELETE /resources/:rid` (F9/F10); `POST /resources/:rid/book` (F12 — 409 SLOT_CONFLICT/RESOURCE_UNAVAILABLE; v1 members-only); F11 calendar reads resource bookings via `GET /api/homes/:id/events` union (resource_booking rows); `POST /visits` (F13 — vendor|guest, BAD_RANGE guard) + visit detail rendered from the calendar `GET …/events/:eventId` (visits stored as HomeCalendarEvent) (F14).
**Files this stream OWNS:** `Features/Scheduling/Resources/**` (ResourceListView/VM via `ListOfRowsView`, ResourceEditorView/VM via `FormShell`, ResourceDetailView/VM, BookResourceSheet/VM, ScheduleVisitView/VM, VisitDetailView/VM); stub bodies for F9–F14.
**Required states/behaviors:** resource_type enum (room/vehicle/tool/charger/other); who_can_book v1 = members; book honors `max_duration_min`/`buffer_min`/`requires_approval`; 409 conflict on resource book → alternatives or busy state; visit range ≤30 days (BAD_RANGE); resource calendar reads union (never creates booking rows).

---

### Stream I13 — Business config & team   [business] [MVP+v2]  (~5 screen-equivalents)
**Goal:** Business-pillar scheduling config — round-robin & collective assignment, team booking availability, member working hours, and business scheduling settings.
**Screens (this stream owns):** G1 Round-Robin Assignment Sheet[v2]; G2 Collective Event Setup[v2]; G3 Team Booking Availability[MVP]; G4 Member Working-Hours Editor[v2 — see scope note]; G5 Business Scheduling Settings[MVP].
**Backend endpoints used (business owner ctx `owner_type:'business'`+`owner_id`):** `PUT /event-types/:id/assignees` (G1/G2 — subjects must be members; INVALID_ASSIGNEE; weight/priority for round-robin); `GET /team-availability?from&to&tz` (G3 — `members`+`freeByMember`, BUSINESS_ONLY); `GET/POST/PUT /availability*` for the **signed-in member's OWN** working hours (G4). **G4 SCOPE CORRECTION:** availability is hard-scoped to `req.user.id` with NO owner/member param — a business owner therefore **cannot** edit another member's hours through `/availability`. So G4 = a **self-service "My Working Hours"** surface (each team member edits their own); from the team-availability grid (G3), tapping a *different* member deep-links them to set their own hours (or shows read-only). Do NOT ship an owner-edits-other-member editor against `/availability` — it is a dead end. (Cross-member editing would require a new owner-aware backend endpoint; out of scope.) Plus `GET/PUT /booking-page` + `PUT /event-types/:id` business-level settings (G5). Assignment mode set on event type (`assignment_mode` round_robin|collective) via `PUT /event-types/:id` (read field; the editor UI lives in I2 — this stream owns only the assignment **sheets**).
**Files this stream OWNS:** `Features/Scheduling/Business/**` (RoundRobinAssignmentSheet/VM, CollectiveEventSetupView/VM, TeamBookingAvailabilityView/VM, MemberWorkingHoursEditor*, BusinessSchedulingSettingsView/VM); stub bodies for G1–G5.
**Required states/behaviors:** assignees replace whole set; validate membership (INVALID_ASSIGNEE); team-availability business-only (handle BUSINESS_ONLY); round-robin weights/priority; collective requires all assignees free; identity theme = business violet.

---

### Stream I14 — Payments & payouts   [business/payments] [MVP]  (~3 screen-equivalents)  — **EXCLUSIVE owner of Wallet additions**
**Goal:** Stripe Connect setup + tax, payouts & earnings, and the cancellation/refund policy editor — all behind the paid feature flag, Stripe TEST mode, payout settlement shown as pending.
**Screens (this stream owns):** G6 Payments Setup/Stripe Connect & Tax[MVP]; G7 Payouts & Earnings[MVP]; G14 Cancellation & Refund Policy[MVP].
**Backend endpoints used (owner ctx):** `GET /payments/status` (G6 — `applicable/connected/charges_enabled/payouts_enabled`; homes not applicable); G7 earnings/payouts surface uses `GET /bookings/summary` + booking payment fields (settlement deferred → render processing/pending; reuse existing Wallet/earnings data where present); G14 cancellation policy persists on booking-page/event-type via `PUT /booking-page` (`cancellation_policy`) + `PUT /event-types/:id` (`cancellation_window_min`/`reschedule_cutoff_min`/`refund_policy`/`no_show_fee_cents`).
**Files this stream OWNS (EXCLUSIVE Wallet additions):** `Features/Wallet/Scheduling/**` (PaymentsSetupView/VM, PayoutsEarningsView/VM extending the Wallet/earnings module) + `Features/Scheduling/Payments/CancellationPolicyEditor*` (G14). **Reuses Foundation `CancellationPolicySheet`.** Stub bodies for G6,G7,G14. **No other stream touches `Features/Wallet/*`.**
**Required states/behaviors:** **entire stream gated by `SchedulingFeatureFlags.paidEnabled`** — when off, surfaces show a disabled/coming-soon state; Stripe TEST mode; `applicable:false` for homes; payouts render settlement as **processing/pending** (deferred server-side); G14 policy editor round-trips refund_policy enum (full/partial/none/deposit_only).

---

### Stream I15 — Packages & invoices   [business/payments] [v2]  (~6 screen-equivalents)
**Goal:** Session packages (owner CRUD + customer buy + my-packages/credits) and business invoices (list + detail).
**Screens (this stream owns):** G8 Packages List (owner)[v2]; G9 Create/Edit Package[v2]; G10 Buy Package (customer)[v2]; G11 My Packages/Credits[v2]; G12 Invoices List[v2]; G13 Invoice Detail[v2].
**Backend endpoints used:** `GET /packages`, `POST /packages`, `PUT /packages/:id`, `DELETE /packages/:id` (owner ctx, G8/G9); `POST /packages/:id/buy` (G10 — returns `credit` + optional `clientSecret`, customer-authed); `GET /my-packages` (G11, customer); `GET /invoices`, `GET /invoices/:id`, `POST /invoices/:id/send` (G12/G13, business-only); credit application via `POST /bookings/:id/apply-credit` (read-only call from G11 "use credit"). All priced behavior behind `SchedulingFeatureFlags.paidEnabled` + Stripe TEST.
**Files this stream OWNS:** `Features/Scheduling/Packages/**` (PackagesListView/VM via `ListOfRowsView`, PackageEditorView/VM via `FormShell`, BuyPackageView/VM, MyPackagesView/VM) + `Features/Scheduling/Invoices/**` (InvoicesListView/VM, InvoiceDetailView/VM via `ContentDetailShell`); stub bodies for G8–G13.
**Required states/behaviors:** packages soft-delete (is_active=false); buy returns clientSecret when priced (flag-gated, TEST mode); my-packages shows remaining_sessions per credit; invoices business-only (empty otherwise); apply-credit guards (ALREADY_APPLIED/CREDIT_NOT_APPLICABLE); flag-off → packages/invoices hidden or coming-soon.

---

### Stream I16 — Reminders / workflows / templates   [automations] [MVP+v2]  (~8 screen-equivalents)
**Goal:** Default reminders quick-setup, workflow automations (list/editor/triggers), and the message-template authoring suite (editor/variables/preview/library).
**Screens (this stream owns):** H1 Default Reminders Quick-Setup[MVP]; H2 Workflows List[v2]; H3 Workflow Editor[v2]; H4 Trigger Picker[v2]; H5 Message Template Editor[v2]; H6 Variable Picker[v2]; H7 Message Preview[v2]; H8 Message Template Library[v2].
**Backend endpoints used (owner ctx):** H1 reminders persist on booking-page `PUT /booking-page` (`reminder_minutes[]`); `GET/POST/PUT/DELETE /workflows` (H2/H3 — trigger ∈ booking_created|cancelled|rescheduled|before_start|after_end, action ∈ email|push|in_app|sms, offset_minutes); `GET/POST/PUT/DELETE /message-templates` (H5/H8); `POST /message-templates/preview` (H7 — interpolates `{{variable}}`). H4 trigger picker + H6 variable picker are client-side pickers feeding H3/H5.
**Files this stream OWNS:** `Features/Scheduling/Automations/**` (DefaultRemindersView/VM, WorkflowsListView/VM via `ListOfRowsView`, WorkflowEditorView/VM via `FormShell`, TriggerPickerSheet, MessageTemplateEditorView/VM, VariablePickerSheet, MessagePreviewView/VM, TemplateLibraryView/VM); stub bodies for H1–H8.
**Required states/behaviors:** reminders quick-setup writes `reminder_minutes[]`; workflow editor validates trigger/action enums + offset for before/after triggers; templates require subject for email channel; preview round-trips `{{variable}}` with sample values; pickers presented locally.

---

### Stream I17 — Insights & reports   [insights] [v2]  (~5 screen-equivalents)
**Goal:** The insights dashboard, per-event-type performance, no-show & cancellation report, team performance, and the period/filter sheet.
**Screens (this stream owns):** H9 Insights Dashboard[v2]; H10 Per-Event-Type Performance[v2]; H11 No-Show & Cancellation Report[v2]; H12 Team Performance[v2]; H13 Insights Period & Filter Sheet[v2].
**Backend endpoints used (host, owner ctx):** `GET /bookings/summary` (H9 — counts/noShowRate/nextBooking); `GET /bookings/insights/no-shows?days` (H11 — byEventType/byHost/recent); `GET /bookings/insights/team?days` (H12 — business-only, BUSINESS_ONLY guard); H10 per-event-type derives from `GET /bookings?event_type_id` aggregates + summary; H13 period/filter is a client-side sheet feeding `days`/`from`/`to`.
**Files this stream OWNS:** `Features/Scheduling/Insights/**` (InsightsDashboardView/VM, PerEventTypePerformanceView/VM, NoShowReportView/VM, TeamPerformanceView/VM, PeriodFilterSheet/VM); stub bodies for H9–H13.
**Required states/behaviors:** all v2 — empty/zero-data states prominent; team performance business-only (handle BUSINESS_ONLY); period sheet drives `days` (≤365) and date range; no hardcoded chart colors (theme tokens); read-only surfaces (no mutations).

---

### Stream I18 — Cross-cutting & polish   [polish] [MVP cross-cut + v2]  (~2 screen-equivalents)  — **schedule LAST / own-files only**
**Goal:** The notification/reminder permission & channel-connect prompt, and the accessibility & large-text pass across the Scheduling surface.
**Screens (this stream owns):** H15 Notification/Reminder Permission & Channel Connect Prompt[v2]; H14 Accessibility & Large-Text pass[MVP, cross-cutting].
**Backend endpoints used:** H15 permission prompt is OS-permission + `GET/PUT /notification-preferences` (channel connect) + the 501 connected-calendars "coming soon"; H14 makes no new calls.
**Files this stream OWNS:** `Features/Scheduling/Polish/**` (NotificationPermissionPromptView/VM, ChannelConnectPromptView/VM) for H15. **H14 accessibility pass is scoped to its OWN files only** — it adds `accessibilityIdentifier(...)`/Dynamic-Type fixes by creating `Features/Scheduling/Polish/A11y*` helper modifiers and an audit checklist; **it does NOT edit other streams' screen files** (to preserve disjointness). If H14 finds a11y gaps requiring edits inside another stream's files, it **files those as follow-up issues** rather than editing them. Stub bodies for H15 (and an H14 audit entry point if routed).
**Required states/behaviors:** H15 handles granted/denied/undetermined permission states + 501 connect coming-soon; H14 verifies large-text reflow, VoiceOver labels, contrast (theme tokens already AA), and mirrored `accessibilityIdentifier` strings — but only within Polish-owned files. **Schedule this stream LAST** so its audit reflects the merged Scheduling surface; because it edits only its own files, it still merges conflict-free in any order.

---

## 7. Coverage table (screen ID → stream, each screen exactly once)

| ID | Name | MVP/v2 | Stream | | ID | Name | MVP/v2 | Stream |
|----|------|--------|--------|---|----|------|--------|--------|
| A1 | Scheduling Hub | MVP | I1 | | E6 | Mark No-Show | v2 | I9 |
| A2 | First-Run Wizard | MVP | I1 | | E7 | Post-Meeting Follow-up | v2 | I9 |
| A3 | Scheduling Settings Root | MVP | I1 | | E8 | Group Roster & Seats | v2 | I9 |
| A4 | Notifications Preferences | MVP | I1 | | E9 | Booking Search & Filter | v2 | I9 |
| A5 | Summary Card | MVP | I1 | | E10 | Double-Book Warning | v2 | I9 |
| A6 | Onboarding Home & Business | v2 | I1 | | E11 | Send a Nudge | v2 | I9 |
| B1 | Event Type/Service List | MVP | I2 | | E12 | Manual/On-Behalf Booking | v2 | I9 |
| B2 | Event Type/Service Editor | MVP | I2 | | E13 | Waitlist Join & Mgmt | v2 | I9 |
| B3 | Intake Questions Editor | v2 | I2 | | F1 | Home Calendar/Agenda | MVP | I10 |
| B8 | Connected Calendars | v2→501 | I2 | | F2 | Home Event Detail + RSVP | MVP | I10 |
| B4 | Availability Schedule List | MVP | I3 | | F3 | Home Add/Edit Event | MVP | I10 |
| B5 | Weekly Hours Editor | MVP | I3 | | F8 | Household Availability Settings | MVP | I10 |
| B6 | Date Overrides & Holidays | v2 | I3 | | F15 | Permission-Gated Scheduler | MVP | I10 |
| B7 | Booking Limits & Notice Rules | v2 | I3 | | F4 | Find a Time — Setup | MVP | I11 |
| B9 | Block off time | MVP | I3 | | F5 | Find a Time — Suggested Slots | MVP | I11 |
| C1 | Booking Link/Page Mgmt | MVP | I4 | | F6 | Find a Time — Member Poll | v2 | I11 |
| C2 | Public Booking Page Preview | MVP | I4 | | F7 | Who's Free — Availability | v2 | I11 |
| C3 | Share Your Link Sheet | MVP | I4 | | F9 | Resources — List | v2 | I12 |
| C4 | One-off Link Generator | MVP | I4 | | F10 | Resource Editor | v2 | I12 |
| H16 | Booking-Link Empty/Zero-State | MVP | I4 | | F11 | Resource Detail/Calendar | v2 | I12 |
| C5 | Booking Landing/Profile | MVP | I5 | | F12 | Book a Resource | v2 | I12 |
| C6 | Date+Time Slot Picker | MVP | I5 | | F13 | Schedule a Visit — Setup | v2 | I12 |
| C7 | Timezone Selector | MVP | I5 | | F14 | Visit Detail | v2 | I12 |
| C8 | Slot/No-Availability State | MVP | I5 | | G1 | Round-Robin Assignment | v2 | I13 |
| D1 | Intake/Booking Details Form | MVP | I6 | | G2 | Collective Event Setup | v2 | I13 |
| D2 | Review & Confirm/Checkout | MVP | I6 | | G3 | Team Booking Availability | MVP | I13 |
| D3 | Booking Confirmed/Thank-You | MVP | I6 | | G4 | Member Working-Hours Editor | v2 | I13 |
| D4 | Manage Your Booking | MVP | I6 | | G5 | Business Scheduling Settings | MVP | I13 |
| D5 | Slot Taken/Conflict | MVP | I7 | | G6 | Payments Setup/Stripe Connect | MVP | I14 |
| D6 | Payment Failed/Retry | v2 | I7 | | G7 | Payouts & Earnings | MVP | I14 |
| D7 | Unavailable/Expired/Paused/Secret | MVP | I7 | | G14 | Cancellation & Refund Policy | MVP | I14 |
| D8 | Add to Calendar | MVP | I7 | | G8 | Packages List (owner) | v2 | I15 |
| D9 | Open-in-App/Deep-Link | MVP | I7 | | G9 | Create/Edit Package | v2 | I15 |
| D10 | Reschedule/Cancel Policy-Blocked | MVP | I7 | | G10 | Buy Package (customer) | v2 | I15 |
| D11 | My Bookings (customer) | v2 | I7 | | G11 | My Packages/Credits | v2 | I15 |
| D12 | Recurring/Multi-Session Setup | v2 | I7 | | G12 | Invoices List | v2 | I15 |
| E1 | Bookings Inbox | MVP | I8 | | G13 | Invoice Detail | v2 | I15 |
| E2 | Booking Detail | MVP | I8 | | H1 | Default Reminders Quick-Setup | MVP | I16 |
| E3 | Approve/Decline Sheet | MVP | I8 | | H2 | Workflows List | v2 | I16 |
| E4 | Reschedule/Reassign Sheet | MVP | I8 | | H3 | Workflow Editor | v2 | I16 |
| E5 | Cancel & Refund Sheet | MVP | I8 | | H4 | Trigger Picker | v2 | I16 |
| H5 | Message Template Editor | v2 | I16 | | H10 | Per-Event-Type Performance | v2 | I17 |
| H6 | Variable Picker | v2 | I16 | | H11 | No-Show & Cancellation Report | v2 | I17 |
| H7 | Message Preview | v2 | I16 | | H12 | Team Performance | v2 | I17 |
| H8 | Message Template Library | v2 | I16 | | H13 | Insights Period & Filter | v2 | I17 |
| H9 | Insights Dashboard | v2 | I17 | | H15 | Notification/Channel Prompt | v2 | I18 |
| | | | | | H14 | Accessibility & Large-Text | MVP cross-cut | I18 |

**Buildable on iOS:** 93 screens (A:6, B:9, C:8 [C9 web-only excluded], D:12, E:13, F:15, G:14, H:16). Every buildable screen appears in **exactly one** stream. **C9 Embed Widget is WEB-ONLY** and is the only intentionally-absent screen. **H14 Accessibility & Large-Text pass** is owned by I18 but is a cross-cutting a11y task scoped to its own files (not a new screen) — it is counted in H:16 as an owned deliverable.

---

## 8. Dependency / wave diagram & execution order

```
                         ┌──────────────────────────────┐
                         │  I0a  Contract layer (no UI)  │   serial gate
                         │  endpoints · DTOs · owner ·   │   (merge 1st)
                         │  error decoder · feature flag │
                         └───────────────┬──────────────┘
                                         ▼
                         ┌──────────────────────────────┐
                         │  I0b  Routing seam + UI kit   │   serial gate
                         │  SchedulingRoute/Router ·     │   (merge 2nd)
                         │  per-screen stubs · SlotPicker│
                         │  · pills · sheets · seam edits│
                         └───────────────┬──────────────┘
                                         ▼
   ── after Foundation merges, ALL 18 run fully parallel, merge in ANY order ──

  WAVE 1 (MVP backbone — start these first for a usable product):
    I1 Setup&Hub   I2 EventTypes   I3 Availability   I4 BookingPage&Share
    I5 InviteeDiscovery   I6 InviteeConfirm&Manage   I8 BookingsInbox&Core
    I10 HomeCalendar&RSVP*   I13 BusinessConfig&Team   I14 Payments&Payouts*
    I16 Reminders/Workflows

  WAVE 2 (v2 depth — any time after Foundation; independent of Wave 1):
    I7 InviteeEdge&Customer   I9 BookingsExtras   I11 FindATime&WhosFree
    I12 HomeResources&Visits   I15 Packages&Invoices   I17 Insights&Reports

  LAST (own-files only; audit reflects merged surface):
    I18 Cross-cutting & polish (H15 + H14 a11y)

  * I10 = EXCLUSIVE owner of Features/Homes/Calendar/*
  * I14 = EXCLUSIVE owner of Features/Wallet/* additions
```

**Recommended execution order:**
1. **I0a → I0b** (serial; both merge before anything else).
2. **Wave 1** for a shippable MVP slice (host config → public booking → host lifecycle → home calendar → business/payments → reminders).
3. **Wave 2** for v2 depth, in parallel, any order.
4. **I18 last** so the accessibility audit covers the fully-merged Scheduling surface (it still merges conflict-free because it touches only its own files).

The waves are an **ordering recommendation only** — every feature stream depends solely on **iOS Foundation (I0a+I0b)** and is file-disjoint from the others, so they may all be run simultaneously and merged in any order with zero conflicts.
