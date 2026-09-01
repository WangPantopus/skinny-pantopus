# Calendarly — iOS Implementation Phases (parallel-safe, Opus-4.8-sized)

> Execution plan for building the **entire Calendarly feature in the Pantopus iOS app** (SwiftUI), split into phases that can be implemented by **independent Opus 4.8 agents running simultaneously** and **merged to `master` in any order without conflicts**.
>
> Companion docs: [calendarly-design-doc.md](./calendarly-design-doc.md) · [calendarly-implementation-plan.md](./calendarly-implementation-plan.md) · [calendarly-backend-api.md](./calendarly-backend-api.md) (the wiring contract) · the 94-screen design suite `calendarly-design-prompt-suite.md`.
>
> **Backend status:** feature-complete on `feature/calendarly-backend` (migrations 159–165). Only deferred: gig-payment **payout settlement** and external **calendar OAuth sync** (`connect` → 501). Paid surfaces stay behind a feature flag / Stripe test mode.
>
> **iOS status:** greenfield — zero scheduling code exists.

---

## 0. How to read & use this plan

- The plan has **two Foundation sub-phases (serial, merge first)** then **~18 feature phases (fully parallel)**.
- Each feature phase is sized to **one focused Opus 4.8 agent session** and owns a **disjoint set of files**.
- For each phase, the operator (you) **pastes the exact design** for each listed screen into that phase's agent, alongside the phase spec. The agent implements those screens pixel-faithfully and wires them to the named endpoints.
- Every one of the **94 designed screens** is assigned to exactly one phase (coverage matrix in §9). One screen is web-only and excluded (C9 Embed Widget); one "screen" is a cross-cutting a11y note folded into every phase.

### Design-handoff protocol (per screen)
1. Operator opens the phase, reads its screen list.
2. For each screen, operator pastes: **(a)** the screen's design (image/spec), **(b)** the phase spec section, **(c)** a pointer to this file + the backend API doc.
3. Agent builds into the **pre-created stub files** for that screen (created by Foundation), wires the endpoints, handles the listed states, and verifies in the simulator.

---

## 1. Opus 4.8 capability & how phases are sized

What one Opus 4.8 (1M-context) coding-agent session does **well** — i.e., coherently, correctly, wired, and simulator-verified — in a single sitting:

- **~6–12 new/edited Swift files**, **~1,500–3,000 net new LOC** of SwiftUI views + `@Observable @MainActor` view models + networking calls.
- Holds the **design specs for ~4–8 screens** in context simultaneously without drift.
- Can read the existing shells/DTO patterns, mirror them, build, fix compile errors, and exercise the result against a live endpoint.

Beyond that, quality degrades: later screens drift from earlier conventions, wiring bugs go unverified, and the diff becomes unreviewable. So each phase is budgeted in **"screen-equivalents":**

| Screen kind | Weight | Why |
|---|---|---|
| Full screen + non-trivial VM (lists, editors, pickers) | **1.5–2.0** | new view + VM + networking + states |
| Section / sub-screen embedded in a parent | **1.0** | view + some VM logic |
| Sheet / modal hanging off a built parent | **0.5–0.75** | local presentation, small VM |
| State / empty / error / interstitial | **0.25–0.5** | mostly view |

**Target per phase: ~5–8 screen-equivalents.** That keeps each phase a clean, reviewable, verifiable PR. This is why some design groups (B, D, E, F, G, H) are split across 2–3 phases.

---

## 2. THE parallel-merge-safety architecture (read this first)

Goal: **N agents build N phases at the same time on N branches off `master`, and each PR merges back in any order with no conflicts.**

### 2.1 The three conflict hazards in this repo
1. **`project.pbxproj` (8,663 lines, no synchronized groups).** Adding any file edits this file in several sections (`PBXBuildFile`, `PBXFileReference`, group `children`, `Sources` build phase). Parallel adds = guaranteed conflicts. **This is the #1 hazard.**
2. **Shared routing files** — `Features/Root/HubTabRoot.swift` (`HubRoute` enum + `destination(for:)`), `Features/Root/YouTabRoot.swift` (`YouRoute` + `destination` + `handleAction/handleSection`). Every phase adding cases/switch-arms here would collide.
3. **Shared registries** — `Features/Me/MeViewModel.swift` (entry tiles), `Core/Analytics/Analytics.swift` (event enum, if any), a single `Localizable.strings`/`.xcstrings`, DI/composition root, `Info.plist`.

### 2.2 The fix — engineered in Foundation, then never touched again
**Pillar A — Synchronized group for the whole feature.** Foundation converts `Features/Scheduling/` (and the test target's `PantopusTests/Scheduling/`) into **file-system-synchronized root groups** (`PBXFileSystemSynchronizedRootGroup`, supported by Xcode 16.4, which CI already uses). After this **one** pbxproj change, *any* `.swift` file created or modified anywhere under `Features/Scheduling/` is auto-included with **zero pbxproj edits**. → Feature phases never touch `project.pbxproj`. Hazard #1 eliminated.

**Pillar B — A single routing seam, pre-wired with stubs.** Foundation adds **exactly one** case to `HubRoute` and `YouRoute`: `case scheduling(SchedulingRoute)`, and one delegating arm in each `destination(for:)` → `SchedulingRouter.destination(for:owner:)`. `SchedulingRoute` (an enum with a case for **every full-screen** across all phases) and `SchedulingRouter` live **inside the synced feature folder** and are written **completely in Foundation**, each routing to a **stub view**. Feature phases then **fill the stub view bodies** — they never edit `SchedulingRoute`, `SchedulingRouter`, `HubTabRoot`, `YouTabRoot`, or `MeViewModel`. Hazards #2/#3 eliminated.

**Pillar C — Disjoint file ownership + stub-fill.** Foundation pre-creates a `…View.swift` + `…ViewModel.swift` **stub** for every routed full screen. Each feature phase is assigned a **disjoint set** of those stubs to fill in, plus freedom to add its own sheet/state/component files **within the synced folder**. No two phases ever touch the same file.

**Pillar D — Shared things live in Foundation.** Any DTO, endpoint, component, or sheet used by **more than one phase** is built in Foundation (§4). Feature phases **consume** them (read-only import) — they never add DTOs or shared components. (A phase needing a one-off helper adds it inside its own folder.)

### 2.3 The resulting guarantee (and the one caveat)
- ✅ After Foundation is on `master`, every feature phase branches from that point, edits only its disjoint files, and **merges back in any order with no conflicts** — including `project.pbxproj` (untouched, thanks to the synced group).
- ⚠️ **Caveat (unavoidable):** the Foundation sub-phases (P0a → P0b) are **serial and must merge first**. You cannot make the feature phases conflict-free without the shared seam existing. P0a→P0b is ~1–1.5 sessions total; after that, full parallelism.
- 🔁 Three feature phases **extend existing files outside the synced folder** (Home Calendar, Wallet). Each such file has a **single exclusive owner phase** (P10, P14) so there is still no contention. These are called out explicitly.

### 2.4 Rules every feature-phase agent must follow (put in each agent's prompt)
1. **Do NOT edit `project.pbxproj`.** Create files only under `Features/Scheduling/**` (synced). If you believe you must add a file elsewhere, stop and flag it.
2. **Do NOT edit** `SchedulingRoute.swift`, `SchedulingRouter.swift`, `HubTabRoot.swift`, `YouTabRoot.swift`, `MeViewModel.swift`, any file under `Models/Scheduling/**`, `Endpoints/Scheduling*`, or any shared component in `Features/Scheduling/Shared/**`. If a route/DTO/component is missing, **flag it as a Foundation gap** — do not add it locally.
3. **Only touch the files this phase owns** (listed in the phase spec). Present sheets/states for your screens **locally** (`.sheet`/`.fullScreenCover`) from your own parent views — never add a global route.
4. Reuse the shared shells (`ListOfRows/Form/Wizard/ContentDetail`) and Foundation components. Use **theme tokens only** (no hardcoded colors/spacing).
5. Branch name: `claude/calendarly-ios-pNN-<slug>`. One PR per phase. PR must build green and be simulator-verified.

---

## 3. Global wiring contract (applies to every phase)

From [calendarly-backend-api.md](./calendarly-backend-api.md):

- **Owner context:** Personal → omit owner fields (signed-in user). Business → `owner_type:'business'` + `owner_id:<business_user_id>` (query on GET, body on writes). Home → call the `/api/homes/:homeId/scheduling/*` alias (no owner fields). Foundation provides a `SchedulingOwner` helper that injects this correctly.
- **Always pass `tz`** (IANA) on slot/calendar reads; render `startLocal`, store/compare UTC.
- **Persist the one-time `manageToken`** returned by `POST /book/...` — it is the invitee's only handle for manage/reschedule/cancel/.ics.
- **Handle `409 { error, alternatives[] }`** on every booking create/reschedule (slot picker surfaces nearest open times — never a dead end). Codes: `SLOT_TAKEN | SLOT_UNAVAILABLE | SLOT_FULL`.
- **Paused / secret / unavailable / expired** are first-class response states, not errors (`status:'paused'` etc.).
- **Home bookings appear via the calendar UNION** (`GET /api/homes/:id/events` returns rows with `source:'booking'`). Never create `HomeCalendarEvent` rows for bookings.
- **Paid surfaces (priced event types, packages, invoices, payouts) behind a feature flag** + Stripe test mode (payout settlement deferred server-side). Foundation defines the flag.
- **`POST /connected-calendars/connect` → 501** — show "coming soon"; read endpoints return empty.
- **Error envelope:** `{ error:'CODE', message }`; validation → `400 { error:'Validation failed', details:[{field,message}] }`. Foundation provides a typed decoder.

---

## 4. FOUNDATION (serial — merges to `master` before any feature phase)

> Foundation is the only place shared files are edited. It is split into two **sequential** sub-phases (P0b depends on P0a). Together ≈ 1–1.5 Opus-4.8 sessions. Do P0a, merge, then P0b, merge. Then fan out.

### Phase 0a — Project scaffolding, networking & models
**Goal:** all shared data plumbing + the conflict-proof project structure.
- **Project structure (the pbxproj change):** create `Features/Scheduling/` and `PantopusTests/Scheduling/` and convert each to a **file-system-synchronized root group**. **Acceptance:** project opens in Xcode 16.4, builds clean, and a new file dropped into the folder appears in the target with no pbxproj diff. *(Verify first; this is the linchpin of the whole strategy.)*
- **Networking:** `Features/Scheduling/Networking/SchedulingEndpoints.swift` (host: `/api/scheduling/*` + `/api/homes/:homeId/scheduling/*`) and `SchedulingPublicEndpoints.swift` (`/api/public/book|booking|poll/*`) — **every** endpoint from the API doc as a static `Endpoint` factory, each annotated `/// backend route + line`. Mirror `Core/Networking/Endpoints/HomesEndpoints.swift`.
- **Owner context:** `SchedulingOwner` enum (`.user / .home(id) / .business(id)`) + helpers that add owner query params / body fields / pick the home alias path.
- **DTOs:** `Features/Scheduling/Models/*DTOs.swift` — every request/response shape: `BookingPageDTO`, `EventTypeDTO` (+ assignee/question), `AvailabilityScheduleDTO`/rule/override/block, `BookingDTO` (+ attendee), `SlotDTO`, `BookingSummaryDTO`, `PackageDTO`/`PackageCreditDTO`, `InvoiceDTO`, `WorkflowDTO`, `MessageTemplateDTO`, `ResourceDTO`, `VisitDTO`, `PollDTO`, `WaitlistDTO`, insights DTOs, `NotificationPrefsDTO`, `ConnectedCalendarDTO`. Explicit `CodingKeys` (snake_case), `Decodable/Sendable/Identifiable`, mirroring `CalendarEventDTOs.swift`.
- **Error/409 decoding:** typed `SchedulingError` that decodes `{error,message}` + `{error,alternatives[]}`; surfaced from `APIClient` non-2xx. A reusable `SlotConflict` model with `alternatives`.
- **Feature flag** for paid surfaces; any `Info.plist` keys (decide: prefer **share-sheet `.ics`** over EventKit to avoid a calendar-permission prompt; if EventKit is chosen, add `NSCalendarsUsageDescription`).
- **Verify-first list (resolve in P0a):** does the app use a single `Localizable.strings`/`.xcstrings` (→ phases must use per-screen/inline strings, never one shared file)? Does `Analytics.swift` use a central event enum (→ Foundation pre-adds all `scheduling_*` events, or phases use a string API)? Is there a DI/composition root to register a scheduling service?
- **Size:** ~10–14 files, mostly mechanical DTOs/endpoints. **No screens.**
- **Acceptance:** builds; a throwaway smoke call decodes a real response from a hosted-dev endpoint; synced-group verified.

### Phase 0b — Routing seam, shared UI kit & screen stubs
**Goal:** the single integration seam + every shared component + a stub for every routed screen, so feature phases only fill bodies.
- **Routing seam (the only shared-file edits in the whole project):**
  - `HubTabRoot.swift` + `YouTabRoot.swift`: add `case scheduling(SchedulingRoute)` to `HubRoute`/`YouRoute`; one arm in each `destination(for:)` → `SchedulingRouter.destination(for: route, owner: ...)`.
  - `MeViewModel.swift`: add a Personal-pillar `MeActionTile` (`routeKey:"me.scheduling"`) and the Home-context tile; handle `"me.scheduling"` in `YouTabRoot.handleAction`.
  - `Features/Scheduling/Routing/SchedulingRoute.swift` — enum with a case for **every full-screen** (≈ the screens marked "full/section" in §9), carrying owner context where needed.
  - `Features/Scheduling/Routing/SchedulingRouter.swift` — `destination(for:owner:)` switch mapping every case to its (stubbed) view.
- **Shared UI kit** in `Features/Scheduling/Shared/`:
  - **SlotPicker** — date strip + tz-aware time-of-day grid + tz label + loading/empty/"try wider range" states + 409-alternatives presenter (the riskiest reused component; build it well here).
  - **Identity-pillar theming** helper (personal/home/business accent), scheduling **status pills** (pending/confirmed/cancelled/no-show/completed), scheduling **row/cell** styles for `ListOfRows`, **empty/zero-state**, **loading skeleton**, **conflict/paused/unavailable** state views.
  - **Cross-phase shared sheets** (used by ≥2 phases): `TimezoneSelectorSheet` (C7), `AddToCalendarSheet` (D8), `SlotTakenSheet` (D5), `ShareLinkSheet` (C3), `CancellationPolicySheet` (G14). Built once here.
- **Stubs:** a `…View.swift` + `…ViewModel.swift` stub for **every routed full screen** (body = `SchedulingStubView("<screenId>")`). Feature phases fill these.
- **Size:** SlotPicker + theming + ~5 shared sheets + seam + stubs ≈ 1 session (stubs are tiny).
- **Acceptance:** app builds; tapping the new Me "Scheduling" tile navigates to a stub Hub; SlotPicker renders against a real `…/slots` response in a harness; no other shared file will need editing after this.

---

## 5. FEATURE PHASES (all parallel after Foundation)

> Each is one Opus-4.8 session, owns disjoint files, touches no shared files, needs no pbxproj edit. Endpoints are abbreviated; see the API doc for exact request/response. Every phase: handle the global states (§3), apply the a11y/large-text pass, add targeted tests, verify in simulator with a hosted-dev account.

### Phase 1 — Setup & Hub  `[track: Personal core]`
- **Screens:** A1 Scheduling Hub `[MVP]` (full) · A2 Set Up Your Booking Link / First-Run Wizard `[MVP]` (wizard) · A3 Scheduling Settings Root `[MVP]` (section) · A4 Notifications Preferences `[MVP]` (section) · A5 Summary Card `[MVP]` (section) · A6 Onboarding for Home & Business `[v2]` (wizard).
- **Endpoints:** `GET/PUT /booking-page`, `/booking-page/slug` + `/check-slug`, `GET /bookings/summary`, `GET/PUT /notification-preferences`.
- **Reuses:** `ListOfRows` (Hub), `WizardShell(.personal)` (A2/A6), summary card component.
- **Owns:** `Features/Scheduling/Hub/*` (fills A1 stub + A2 wizard + A3–A5 sections + A6 wizard).
- **Shared touched:** none. **Depends on:** Foundation. **Size:** ~6 screen-equiv (Hub + Wizard heavy).

### Phase 2 — Event Types  `[Personal core]`
- **Screens:** B1 Event Type / Service List `[MVP]` (full) · B2 Event Type / Service Editor `[MVP]` (full) · B3 Intake Questions Editor `[v2]` (sheet) · B8 Connected Calendars `[v2]` (sheet → 501 "coming soon").
- **Endpoints:** `GET/POST /event-types`, `GET/PUT/DELETE /event-types/:id`, `PUT …/questions`, `PUT …/assignees`, `GET /connected-calendars` (+ `connect`→501).
- **Reuses:** `ListOfRows` (B1), `FormShell` (B2), local sheets (B3/B8).
- **Owns:** `Features/Scheduling/EventTypes/*`. **Size:** ~5 (editor heavy).

### Phase 3 — Availability  `[Personal core]`
- **Screens:** B4 Availability Schedule List `[MVP]` (full) · B5 Weekly Hours Editor `[MVP]` (full) · B6 Date Overrides & Holidays `[v2]` (sheet) · B7 Booking Limits & Notice Rules `[v2]` (sheet) · B9 Block off time `[MVP]` (sheet).
- **Endpoints:** `GET/POST /availability`, `GET/PUT/DELETE /availability/:id`, `PUT …/rules`, `PUT …/overrides`, `POST/DELETE /availability/blocks`.
- **Reuses:** `ListOfRows` (B4), `FormShell` + weekly-hours grid (B5), local sheets.
- **Owns:** `Features/Scheduling/Availability/*`. **Size:** ~5.

### Phase 4 — Booking page & link sharing  `[Personal core]`
- **Screens:** C1 Booking Link / Public Page Management `[MVP]` (section) · C2 Public Booking Page Preview `[MVP]` (modal) · C3 Share Your Link Sheet `[MVP]` (uses shared `ShareLinkSheet`) · C4 One-off / Single-use Link Generator `[MVP]` (sheet) · H16 Booking-Link / Page Empty & Zero-State `[MVP]` (state).
- **Endpoints:** `GET/PUT /booking-page` (+ `disable`, `reset-slug`), `POST /booking-page/one-off-links`, `GET /book/:slug` (preview).
- **Reuses:** `ContentDetail`/section, `ShareLinkSheet` (Foundation), `buildBookingPageUrl` util.
- **Owns:** `Features/Scheduling/BookingPage/*`. **Size:** ~4.5.

### Phase 5 — Invitee discovery (slot picking)  `[Invitee — risk-first core]`
- **Screens:** C5 Booking Landing / Booker Profile `[MVP]` (full) · C6 Date + Time Slot Picker `[MVP]` (full, uses Foundation **SlotPicker**) · C7 Timezone Selector `[MVP]` (shared sheet wiring) · C8 Slot/No-Availability State `[MVP]` (state).
- **Endpoints:** `GET /book/:slug`, `GET /book/:slug/:eventTypeSlug/slots?from&to&tz`, one-off `GET /book/o/:token`.
- **Reuses:** SlotPicker, status/empty/loading components (Foundation).
- **Owns:** `Features/Scheduling/Invitee/Discover/*`. **Size:** ~4 (validates the engine contract end-to-end).

### Phase 6 — Invitee confirm & manage  `[Invitee]`
- **Screens:** D1 Intake / Booking Details Form `[MVP]` (full) · D2 Review & Confirm / Checkout `[MVP]` (section) · D3 Booking Confirmed / Thank-You `[MVP]` (full) · D4 Manage Your Booking `[MVP]` (full).
- **Endpoints:** `POST /book/:slug/:eventTypeSlug` (→ `manageToken`, `clientSecret` if priced — **persist token**), `GET /booking/:token`, `POST /booking/:token/reschedule|cancel`, `GET /booking/:token/ics`. Payment via Foundation flag + Stripe test mode.
- **Reuses:** `FormShell` (D1), SlotPicker (reschedule in D4), `AddToCalendarSheet`/`SlotTakenSheet` (Foundation).
- **Owns:** `Features/Scheduling/Invitee/Confirm/*`. **Size:** ~5 (heavy).

### Phase 7 — Invitee edge states & customer extras  `[Invitee]`
- **Screens:** D5 Slot Taken / Conflict `[MVP]` (shared sheet wiring) · D6 Payment Failed / Retry `[v2]` (sheet) · D7 Unavailable/Expired/Paused/Secret `[MVP]` (states) · D8 Add to Calendar `[MVP]` (shared sheet wiring) · D9 Open-in-App / Deep-Link Hand-off `[MVP]` (interstitial) · D10 Reschedule/Cancel Cutoff & Policy-Blocked `[MVP]` (state) · D11 My Bookings (customer) `[v2]` (list) · D12 Recurring / Multi-Session Setup `[v2]` (flow).
- **Endpoints:** `GET /my-bookings`, `POST /bookings/recurring`, `GET /booking/:token` (action flags), ics; deep-link via `DeepLinkRouter` (read-only reference, present locally).
- **Reuses:** Foundation state views + sheets, `ListOfRows` (D11).
- **Owns:** `Features/Scheduling/Invitee/Edge/*`. **Size:** ~7 (mostly light states/sheets).

### Phase 8 — Bookings lifecycle: inbox & core actions  `[Host lifecycle]`
- **Screens:** E1 Bookings Inbox `[MVP]` (full) · E2 Booking Detail `[MVP]` (full) · E3 Approve / Decline Sheet `[MVP]` (sheet) · E4 Reschedule / Reassign Sheet `[MVP]` (sheet, SlotPicker) · E5 Cancel & Refund Sheet `[MVP]` (sheet).
- **Endpoints:** `GET /bookings?status&event_type&from&to&q`, `GET /bookings/:id`, `GET /bookings/:id/available-slots`, `POST /bookings/:id/approve|decline|cancel|reschedule|reassign`.
- **Reuses:** `ListOfRows` (E1), `ContentDetail` (E2), SlotPicker (E4), local sheets.
- **Owns:** `Features/Scheduling/Bookings/Core/*`. **Size:** ~5 (Inbox + Detail heavy).

### Phase 9 — Bookings lifecycle: extras  `[Host lifecycle]`
- **Screens:** E6 Mark No-Show `[v2]` (modal) · E7 Post-Meeting Follow-up `[v2]` (sheet) · E8 Group Event Roster & Seats `[v2]` (full) · E9 Booking Search & Filter `[v2]` (sheet) · E10 Double-Book Warning (host) `[v2]` (modal) · E11 Send a Nudge `[v2]` (sheet) · E12 Manual / On-Behalf Booking `[v2]` (flow) · E13 Waitlist Join & Management `[v2]` (sheet/state).
- **Endpoints:** `POST /bookings/:id/no-show|nudge|propose-reschedule`, `POST /bookings` (manual), `GET /event-types/:id/waitlist`, `POST /waitlist/:id/promote`, `POST /book/:slug/:eventTypeSlug/waitlist`.
- **Reuses:** SlotPicker (E12), local sheets/modals.
- **Owns:** `Features/Scheduling/Bookings/Extras/*`. **Size:** ~7 (mostly sheets + 1–2 full).

### Phase 10 — Home calendar & RSVP (extends existing)  `[Home]`
- **Screens:** F1 Home Calendar / Agenda `[MVP]` (extend existing) · F2 Home Event Detail + RSVP `[MVP]` (extend) · F3 Home Add / Edit Event `[MVP]` (extend) · F8 My Household Availability Settings `[MVP]` (sheet) · F15 Permission-Gated Scheduler View `[MVP]` (render-mode).
- **Endpoints:** `GET /api/homes/:id/events` (booking **union** — render `source:'booking'`), `POST …/events/:eventId/rsvp`, `GET …/events/:eventId`, availability for household settings.
- **⚠️ Extends existing files OUTSIDE the synced folder** — `Features/Homes/Calendar/HomeCalendarView.swift`/`…ViewModel.swift`/`EventDetail*`/`AddEventForm*`. **P10 is the SOLE owner of these files** → still conflict-free. (Editing existing files does not touch pbxproj.)
- **Owns:** the Home Calendar module files (exclusive) + `Features/Scheduling/Home/Calendar/*` for new pieces.
- **Size:** ~5. **Note in agent prompt:** you alone touch `Features/Homes/Calendar/*`.

### Phase 11 — Find-a-time & who's-free  `[Home]`
- **Screens:** F4 Find a Time — Setup `[MVP]` (sheet) · F5 Find a Time — Suggested Slots `[MVP]` (full) · F6 Find a Time — Member Poll Response `[v2]` (sheet) · F7 Who's Free — Household Availability `[v2]` (full).
- **Endpoints:** `GET /find-a-time` (members, mode, window), `GET /whos-free`, polls (`POST/GET /polls`, `GET /poll/:id`, `POST /poll/:id/vote`).
- **Reuses:** SlotPicker/grid components, `ListOfRows`.
- **Owns:** `Features/Scheduling/Home/FindATime/*`. **Size:** ~5.

### Phase 12 — Home resources & visits  `[Home]`
- **Screens:** F9 Bookable Home Resources — List `[v2]` (full) · F10 Resource Editor `[v2]` (sheet) · F11 Resource Detail / Booking Calendar `[v2]` (full) · F12 Book a Resource `[v2]` (flow) · F13 Schedule a Visit — Setup `[v2]` (sheet) · F14 Visit Detail `[v2]` (full).
- **Endpoints:** `GET/POST/PUT/DELETE /resources` (+ `/resources/:rid/book`), `POST /visits`, `GET /api/homes/:id/events` (resource bookings/visits surface here too).
- **Reuses:** `ListOfRows`, `FormShell`, SlotPicker.
- **Owns:** `Features/Scheduling/Home/Resources/*`. **Size:** ~6.

### Phase 13 — Business config & team  `[Business]`
- **Screens:** G1 Round-Robin Assignment Sheet `[v2]` (sheet) · G2 Collective Event Setup `[v2]` (sheet) · G3 Team Booking Availability `[MVP]` (section) · G4 Member Working-Hours Editor `[v2]` (sheet) · G5 Business Scheduling Settings `[MVP]` (section).
- **Endpoints:** `PUT /event-types/:id/assignees`, `GET /team-availability`, event-types/availability with `owner_type:'business'`.
- **Reuses:** assignee components, who's-free grid (mirror F7).
- **Owns:** `Features/Scheduling/Business/Config/*`. **Size:** ~5.

### Phase 14 — Payments & payouts (flagged, extends Wallet)  `[Business]`
- **Screens:** G6 Payments Setup / Stripe Connect & Tax `[MVP]` (section) · G7 Payouts & Earnings `[MVP]` (extend existing Wallet) · G14 Cancellation & Refund Policy `[MVP]` (shared sheet wiring).
- **Endpoints:** `GET /payments/status`, reuse existing **Stripe Connect onboarding** + **Wallet/earnings** screens/endpoints; `CancellationPolicySheet` (Foundation).
- **⚠️ Extends existing Wallet files (exclusive owner = P14).** Behind the **paid feature flag**; Stripe **test mode** only (payout settlement deferred server-side — show "processing"/pending states).
- **Owns:** `Features/Scheduling/Business/Payments/*` + the Wallet extension (exclusive). **Size:** ~3 + reuse.

### Phase 15 — Packages & invoices (flagged)  `[Business]`
- **Screens:** G8 Packages List (owner) `[v2]` (full) · G9 Create / Edit Package `[v2]` (full) · G10 Buy Package (customer) `[v2]` (sheet) · G11 My Packages / Credits `[v2]` (full) · G12 Invoices List `[v2]` (full) · G13 Invoice Detail `[v2]` (full).
- **Endpoints:** `GET/POST/PUT/DELETE /packages`, `POST /packages/:id/buy` (→ clientSecret), `GET /my-packages`, `POST /bookings/:id/apply-credit`, `GET /invoices`, `GET /invoices/:id`, `POST /invoices/:id/send`.
- **Reuses:** `ListOfRows`, `FormShell`, payment confirm (Stripe test). **Flagged.**
- **Owns:** `Features/Scheduling/Business/Packages/*`. **Size:** ~6.

### Phase 16 — Reminders, workflows & message templates  `[Automations]`
- **Screens:** H1 Default Reminders Quick-Setup `[MVP]` (sheet) · H2 Workflows List `[v2]` (full) · H3 Workflow Editor `[v2]` (full) · H4 Trigger Picker `[v2]` (sheet) · H5 Message Template Editor `[v2]` (sheet) · H6 Variable Picker `[v2]` (sheet) · H7 Message Preview `[v2]` (sheet) · H8 Message Template Library `[v2]` (full).
- **Endpoints:** `GET/POST/PUT/DELETE /workflows`, `GET/POST/PUT/DELETE /message-templates`, `POST /message-templates/preview`, `PUT /booking-page` (`reminder_minutes`).
- **Reuses:** `ListOfRows`, `FormShell`, local pickers.
- **Owns:** `Features/Scheduling/Automations/*`. **Size:** ~7 (mostly sheets + 2–3 full). *Split into 16a (reminders+workflows) / 16b (templates) if the agent runs hot.*

### Phase 17 — Insights & reports  `[Insights]`
- **Screens:** H9 Insights Dashboard `[v2]` (full) · H10 Per-Event-Type Performance `[v2]` (full) · H11 No-Show & Cancellation Report `[v2]` (full) · H12 Team Performance `[v2]` (full) · H13 Insights Period & Filter Sheet `[v2]` (sheet).
- **Endpoints:** `GET /bookings/insights/no-shows`, `GET /bookings/insights/team`, `GET /bookings/summary`.
- **Reuses:** chart/stat components (build simple in-folder), `ListOfRows`.
- **Owns:** `Features/Scheduling/Insights/*`. **Size:** ~5.

### Phase 18 — Cross-cutting prompts & polish  `[Cross-cutting]`
- **Screens:** H15 Notification / Reminder Permission & Channel Connect Prompt `[v2]` (prompt) · H14 Accessibility & Large-Text pass `[MVP]` (cross-cutting — audit + fix dynamic-type/contrast/VoiceOver across shared components built so far).
- **Endpoints:** push/notification permission via existing app helpers; `GET/PUT /notification-preferences`.
- **Owns:** `Features/Scheduling/CrossCutting/*` + a11y fixes limited to Foundation `Shared/*` (⚠️ if it must touch shared components, run **after** all phases or have Foundation pre-harden — see §8). **Size:** ~2 + audit. *Schedule this LAST or scope its edits to its own files to stay conflict-free.*

---

## 6. Recommended execution waves

You can launch **all** feature phases at once after Foundation. If you'd rather stage by value/risk:
- **Wave 1 (after Foundation):** P5 → P6 (invitee slot→book→manage — proves the engine end-to-end), P1 (Hub), P2, P3 (personal host core). These are the lovable MVP loop.
- **Wave 2:** P4, P7, P8, P9, P10, P11 (sharing, host lifecycle, home).
- **Wave 3:** P12, P13, P14, P15, P16, P17, P18 (resources, business, payments, automations, insights, polish).

All waves are optional staging — every phase is independently parallel-safe.

---

## 7. Coverage matrix (all 94 screens → phase)

| Group | Screens → Phase |
|---|---|
| **A** (6) | A1–A6 → **P1** |
| **B** (9) | B1,B2,B3,B8 → **P2** · B4,B5,B6,B7,B9 → **P3** |
| **C** (9) | C1–C4,H16 → **P4** · C5–C8 → **P5** · *C9 Embed Widget = **web-only, excluded*** |
| **D** (12) | D1–D4 → **P6** · D5–D12 → **P7** |
| **E** (13) | E1–E5 → **P8** · E6–E13 → **P9** |
| **F** (15) | F1–F3,F8,F15 → **P10** · F4–F7 → **P11** · F9–F14 → **P12** |
| **G** (14) | G1–G5 → **P13** · G6,G7,G14 → **P14** · G8–G13 → **P15** |
| **H** (16) | H1–H8 → **P16** · H9–H13 → **P17** · H15 + H14(a11y) → **P18** · H16 → P4 |

**Coverage:** 94 designed entries → 92 buildable iOS screens across P1–P18, 1 web-only excluded (C9), 1 cross-cutting note (H14) folded into P18. **Every iOS screen lands in exactly one phase.**

---

## 8. Residual conflict checks (be honest)

- **`project.pbxproj`:** ✅ untouched after Foundation (synced group). *If the synced-group conversion turns out unsupported in this project, fall back to: Foundation pre-creates **every** screen file (full stub set) so phases only modify existing files — but then any phase adding an unplanned file must hand it to a serialized "integration" mini-PR. The synced-group path avoids this entirely; verify it in P0a.*
- **Shared routing / Me / analytics:** ✅ edited only in Foundation.
- **Shared DTOs/components:** ✅ owned by Foundation; phases consume read-only. A missing DTO/component is a **Foundation gap** (flag, patch Foundation, re-merge) — never added in a feature phase.
- **Existing-file extensions:** ⚠️ P10 (Home Calendar) and P14 (Wallet) edit existing files — each is the **sole owner**, so no contention. Don't assign those files to any other phase.
- **P18 a11y pass:** ⚠️ if it must edit Foundation `Shared/*`, run it last or fold the hardening into Foundation P0b. Otherwise keep its edits inside its own folder.
- **Strings/assets:** ✅ if the app has a single shared strings/asset-catalog file, phases must NOT all edit it — use per-screen/inline strings and per-asset files (verified in P0a).

---

## 9. Dev / test / verification workflow (every phase)

- **Targeted tests only** — test the new scheduling view models / services for that phase; never run full suites.
- **Simulator verification** with a **hosted-dev test account** (token minting / login per the dev-accounts runbook); exercise each screen against the **live** endpoint (requires migrations 159–165 applied to the target env). Keep test bookings/pages.
- **CI gotchas (iOS):** Xcode 16.4 / Swift 6.1.2 — **avoid default-argument `@MainActor` view-model initializers** (known crash); SwiftLint 0.63.3 / SwiftFormat pinned; be aware of pre-existing snapshot/test failures unrelated to scheduling (don't "fix" by churning baselines).
- **Branching/PR:** `claude/calendarly-ios-pNN-<slug>` → PR to `master` (per repo workflow; never push `master` directly). Each PR: builds green, simulator-verified, targeted tests, screenshots of the built screens vs the design.

---

## 10. Summary

- **2 serial Foundation sub-phases** (P0a, P0b) establish a **synchronized file group** (no more pbxproj edits) + a **single routing seam** + **all shared DTOs/components/stubs**.
- **18 feature phases** then run **fully in parallel**, each owning a **disjoint file set** under `Features/Scheduling/**` (plus two exclusive existing-file extensions), touching **no shared file** → **merge to `master` in any order, conflict-free**.
- Each phase ≈ one Opus-4.8 session (~5–8 screen-equivalents); hand each its screens' designs + its spec section.
- All **92 iOS screens** covered; paid surfaces flagged; the engine contract (tz, manage token, 409 alternatives, calendar union, paused states) honored throughout.
