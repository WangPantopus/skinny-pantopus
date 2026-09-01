# Calendarly — Android Parallel Work-Stream Specification

> Platform: **Android** (Jetpack Compose, Kotlin, Hilt DI, Retrofit/Moshi; base package `app.pantopus.android`).
> App root: `frontend/apps/android`. Screens under `app/src/main/java/app/pantopus/android/ui/screens/`.
> Companion contract: [`reference/calendarly-backend-api.md`](../calendarly-backend-api.md) (backend feature-complete on `feature/calendarly` — migrations 159–165, ~70 endpoints). Screen specs: `~/Downloads/calendarly-design-prompt-suite.md` (= `reference/calendarly-design-prompt-suite.md`).

This document defines **1 Foundation stream (A0)** + **18 feature streams (A1…A18)** that collectively deliver all **93 buildable Android screens** of Calendarly (the canonical 94-screen inventory minus only `C9 Embed Widget` = web-only; `D9` is still built, as a native deep-link interstitial, and `H14` is a cross-cutting a11y task owned by A18). Foundation (A0) is a **serial gate**: it merges to `master` first. After that, all 18 feature streams run **fully in parallel** and **merge to `master` in any order with zero conflicts**, because every feature stream edits a **disjoint set of files** — the only files touched by more than one stream are owned exclusively by Foundation, and Foundation is already merged before any feature stream branches.

Calendarly is a Calendly/Cal.com-style booking layer over Pantopus with **one owner-polymorphic engine** and three identity pillars: **Personal (sky / `PantopusColors.primary600`)**, **Home (green / `PantopusColors.home`)**, **Business (violet / `PantopusColors.business`)**.

---

## 1. How to use this doc

The operator runs ~19 independent agent sessions:

1. **First, run Foundation (A0).** Hand the agent the entire "Foundation spec (A0)" section. It merges to `master`. **Nothing else starts until A0 is on `master`.**
2. **Then, for each feature stream**, start one fresh agent session and paste:
   - that stream's full section from this doc (it is self-contained), **plus**
   - the **shared RULES preamble** + **GLOBAL WIRING CONTRACT** (§4), **plus**
   - the **design prompts for that stream's screen IDs** (the operator copies them from `reference/calendarly-design-prompt-suite.md` at build time — only the screen designs, not the whole suite).
3. Each agent branches from `master` (which already contains A0), builds **only the files its section lists under "Files this stream OWNS"**, opens **one PR**, and merges to `master`.

An agent must be able to build its entire stream from **its section + the pasted designs + the shared preamble** alone. If an agent finds it needs to edit a shared seam file (a route, a DI provider, a Me tile, a DTO, an endpoint, a shared component), it **STOPS and flags a Foundation gap** — it never edits the seam locally. That rule is what preserves conflict-free parallel merge.

---

## 2. Screen scope on Android (93 of 94)

- **`C9 Embed Widget` — WEB ONLY.** Not built on Android. (An embeddable web widget has no native analog.)
- **`D9 Open-in-App / Deep-Link Hand-off`** — on native this is a **local interstitial** that consumes an inbound `pantopus://…/book/…` deep link and routes into the in-app booking flow. It reuses the existing deep-link handling **read-only** (`core/routing/DeepLinkRouter`, referenced from `RootTabScreen`); it adds no new global route plumbing.
- **`H14 Accessibility & Large-Text pass`** is a **cross-cutting audit folded into A18** (scoped to A18's own files + a checklist applied per stream).

All remaining screens are built — **93 in total** (94 minus C9). Each appears in **exactly one** stream (coverage table in §7).

---

## 3. Conflict-safety architecture (Android)

### 3.1 The shared seams (the real hazards)

On Android, four file regions are edited by feature work in the *normal* (non-parallel) flow. Left to 18 agents, they would collide on every PR. Foundation **centralizes all four** so feature streams never touch them:

| Seam | File | Why it collides | Foundation mitigation |
|---|---|---|---|
| **Nav routes + NavHost** | `ui/screens/root/RootTabScreen.kt` (the `private object ChildRoutes` route constants + builder funcs + the `NavHost { composable(route, arguments){…} }` blocks; file is ~4,360 lines) | Every screen adds a `const val` route + a `composable(...)` block | A0 **pre-adds ALL scheduling route constants + ALL `composable(...)` blocks**, each pointing at a **stub screen composable** declared in a feature folder. Feature streams fill the stub body in their **own** files; `RootTabScreen.kt` is never re-edited. |
| **Hilt DI providers** | `di/NetworkModule.kt` | Each new Retrofit `*Api` needs an `@Provides @Singleton` | A0 adds the `@Provides` for **every** scheduling Api (`SchedulingApi`, `SchedulingPublicApi`) once. |
| **"Me" hub tiles + dispatch** | `ui/screens/you/me/MeViewModel.kt` (`MeActionTile`/`MeSectionRow` with `routeKey`) + `ui/screens/you/YouScreen.kt` (the `when (tile.routeKey)` dispatch) | Entry points into scheduling per pillar | A0 adds the Calendarly tiles (e.g. `me.scheduling.hub`) + their dispatch lambdas once. |
| **Networking contract** | `data/api/services/SchedulingApi.kt`, `SchedulingPublicApi.kt`; `data/api/models/scheduling/*Dtos.kt`; `data/scheduling/SchedulingRepository.kt` | Shared DTOs + endpoints used by many streams | A0 owns **the entire contract layer**: both Api interfaces (all ~70 endpoints), all DTOs, the repository, the `SchedulingOwner` helper, and the typed 409/error decoder. |

### 3.2 Why Foundation must go first

A feature stream cannot compile without: (a) the `composable(...)` route block + stub it fills, (b) the `*Api`/DTO/`SchedulingRepository` it calls, (c) the DI provider, (d) the Me tile that reaches it. All four live in A0-owned files. So **A0 merges to `master` first**; every feature stream branches from a `master` that already has them. There is exactly one serial dependency edge in the whole plan: `A0 → {A1…A18}`.

### 3.3 The disjoint-ownership guarantee

After A0 is merged, each feature stream creates files only under **its own scheduling sub-folder** (e.g. `ui/screens/scheduling/hub/**`, `ui/screens/scheduling/eventtypes/**`, …) and never edits a seam file. Two different streams never name the same file. Therefore any two feature-stream PRs touch **disjoint file sets** and **git-merge cleanly in any order**. There is no shared mutable index, manifest, or generated file: Compose Navigation is wired entirely inside the already-merged `RootTabScreen.kt`; Hilt providers already exist; Moshi adapters are generated per-DTO via KSP from A0-owned DTOs.

### 3.4 The two exclusive-owner exceptions

Two streams edit **existing files outside** the scheduling folder. Each is the **sole/exclusive owner** of those files for the duration of the project, so there is still no contention:

- **A10 (Home calendar & RSVP)** is the **EXCLUSIVE owner** of `ui/screens/homes/calendar/**` (`HomeCalendarScreen`/`ViewModel`, `AddEventFormScreen`/`VM`, `EventDetailScreen`/`VM`, `CalendarEventCategory`, `MonthStripHeader`). It *extends* the existing Home Calendar module to render the **booking union** (`source:'booking'`) and RSVP. No other stream edits these files.
- **A14 (Payments & payouts)** is the **EXCLUSIVE owner** of additions under `ui/screens/wallet/**` (Calendarly payments setup, payouts/earnings views) and reuses the existing Stripe Connect plumbing. No other stream edits wallet files.

These two are called out so the orchestrator does not accidentally hand the same existing files to another stream.

### 3.5 Why there are no conflicts on *this* platform specifically

- **Web** avoids conflicts via **file-based routing** (each page is its own file; no shared router) — N/A here.
- **iOS** avoids conflicts because **`project.pbxproj` is generated by XcodeGen and is NOT tracked in git** (verified via `git check-ignore`) — new `.swift` files are auto-discovered on `xcodegen generate` (`make bootstrap`), so adding files needs no shared-file edit. (Correction to the iOS implementation-phases doc, which treated pbxproj as the #1 hazard and prescribed a `PBXFileSystemSynchronizedRootGroup` conversion: that is unnecessary — pbxproj is regenerated locally and never committed. The iOS routing seam is still centralized in iOS Foundation, like Android's NavHost.)
- **Android** has **no per-file manifest** (Gradle compiles the whole source tree) — the only shared mutable surfaces are the **NavHost/DI/Me** seams, which Foundation **pre-stubs and centralizes**. After that, adding a screen = adding a new file in your own folder. Hence zero conflicts.

---

## 4. Shared RULES preamble + GLOBAL WIRING CONTRACT

> **Paste this section verbatim into every feature-stream agent session.**

### 4.1 RULES every feature-stream agent MUST follow

1. **Only create/edit files this stream OWNS.** If you think you need to add/edit a shared seam file (contract types/DTOs, endpoints/API service, DI provider, a route/`composable(...)` block in `RootTabScreen.kt`, a Me tile in `MeViewModel.kt`/`YouScreen.kt`, or a Foundation shared component), **STOP and flag it as a Foundation gap** — do not add it locally.
2. **Present this stream's sheets/modals/states LOCALLY** from your own parent screens (Compose `ModalBottomSheet`, dialogs, in-screen state). **Never add a global route/destination.** The stub `composable(...)` for your top-level screens already exists in `RootTabScreen.kt`; you only fill the stub body in your own files.
3. **Reuse the shared shells and Foundation components**; use **design-system theme tokens only** (`ui/theme/Color.kt` `PantopusColors`, `LocalPantopusTokens` from `Theme.kt`). **No hardcoded colors/spacing.** Pillar accents: Personal = `primary600`, Home = `home`, Business = `business`.
4. **Honor the GLOBAL WIRING CONTRACT** (§4.2): owner context, tz, manageToken, 409 alternatives, calendar union, paused/secret/expired states, paid feature flag, 501 connect.
5. **Targeted tests only.** Test only this stream's ViewModels/services. Verify on an emulator with a **hosted-dev account** against the **live endpoint** (migrations 159–165 applied). Never run full suites. Keep test bookings/pages.
6. **One PR per stream to `master`** (never push `master` directly). Build green + verified + screenshots vs design. Branch name: `claude/calendarly-android-<id>-<slug>`.

### 4.2 GLOBAL WIRING CONTRACT (from `reference/calendarly-backend-api.md`)

- **Owner context** (use the Foundation `SchedulingOwner` helper, which injects this):
  - **Personal** → omit owner fields (defaults to signed-in user).
  - **Business** → `owner_type:'business'` + `owner_id:<business_user_id>` (query param on GET, body field on writes).
  - **Home** → call the `/api/homes/:homeId/scheduling/*` alias (no owner fields).
- **Timezone:** ALWAYS pass `tz` (IANA) on slot/calendar reads. **Render `startLocal`, store/compare UTC.**
- **manageToken:** persist the one-time `manageToken` returned by `POST /book/...` (and `POST /book/o/:token`) — it is the invitee's only handle for manage/reschedule/cancel/.ics.
- **409 conflict:** every booking create/reschedule may return `409 { error, alternatives:[{start,end,startLocal}] }` (codes `SLOT_TAKEN | SLOT_UNAVAILABLE | SLOT_FULL`). **Surface nearest open times — never a dead end.** Use the Foundation 409 decoder.
- **Home calendar UNION:** home bookings appear via `GET /api/homes/:id/events` rows tagged `source:'booking'` (+ `booking_status`). **NEVER create `HomeCalendarEvent` rows for bookings.**
- **First-class non-error states:** `paused`, `secret`, `unavailable`, `expired` are response states, not errors (e.g. `status:'paused'`, `status:'expired'`, `status:'unavailable'`).
- **Paid surfaces** (priced event types, packages, invoices, payouts) sit behind the Foundation **feature flag** + **Stripe TEST mode**. Payout settlement is deferred server-side — show **processing/pending**.
- **`POST /connected-calendars/connect` returns 501** → show **"coming soon"**; read endpoints return empty.
- **Error envelope:** `{ error:'CODE', message }`; validation → `400 { error:'Validation failed', details:[{field,message}] }`. Use the Foundation typed decoder.
- **Public booking fetch** hits the backend origin directly: `/api/public/book/:slug` (slug = the **booking PAGE slug**, not a booking id). One-off links: `/api/public/book/o/:token`. Manage: `/api/public/booking/:token*`.

---

## 5. Foundation spec (A0) — the serial gate

**Branch & PR:** `claude/calendarly-android-A0-foundation` → one PR → merge to `master` **before any feature stream branches**.

**Goal:** Build the entire shared scaffold so the 18 feature streams compile and run against disjoint files: the full networking contract (both Api interfaces, all DTOs, repository, owner helper, error/409 decoder), the DI providers, the centralized NavHost routes + pre-stubbed screen composables, the Me hub tiles + dispatch, the feature flag, and the shared scheduling-specific components. **A0 builds NO finished feature screen** — only stubs + shared infrastructure.

It is fine to split A0 into two PRs if useful (**A0a = contract + DI + flag + shared components**, **A0b = NavHost route stubs + Me tiles + dispatch**), as long as both land on `master` before feature streams start.

### 5.1 Files A0 OWNS (creates/edits)

**Contract layer (creates):**
- `data/api/services/SchedulingApi.kt` — Retrofit interface for the **host** mount. Covers `/api/scheduling/*` and the `/api/homes/{homeId}/scheduling/*` alias: booking-page CRUD + slug + check-slug + reset-slug + disable; event-types CRUD + `:id` + assignees + questions; availability schedules/rules/overrides/blocks; notification-preferences; one-off-links; workflows; message-templates (+ preview); payments/status; connected-calendars (read + connect-501); bookings (list, summary, `:id`, available-slots, create, approve/decline/cancel/reschedule/no-show/reassign/rsvp, recurring, nudge, propose-reschedule, apply-credit, insights/no-shows, insights/team); invoices (list/`:id`/send); packages (CRUD + buy); my-packages; my-bookings; find-a-time; whos-free; resources (CRUD + book); visits; waitlist (list + promote); polls (create/list/`:id`/finalize); team-availability. Each method carries a doc-comment with the backend route + the API-doc line.
- `data/api/services/SchedulingPublicApi.kt` — Retrofit interface for the **public** mount (`/api/public/*`, **backend origin, no auth**): `GET /book/{slug}`, `GET /book/{slug}/{eventTypeSlug}/slots`, `POST /book/{slug}/{eventTypeSlug}`, `POST /book/{slug}/{eventTypeSlug}/waitlist`, `GET /book/o/{token}`, `POST /book/o/{token}`, `GET /booking/{token}`, `GET /booking/{token}/available-slots`, `GET /booking/{token}/ics`, `POST /booking/{token}/reschedule`, `POST /booking/{token}/cancel`, `POST /booking/{token}/unsubscribe`, `POST /booking/{token}/accept-reschedule`, `POST /booking/{token}/decline-reschedule`, `GET /poll/{id}`, `POST /poll/{id}/vote`.
- `data/api/models/scheduling/*Dtos.kt` — all DTOs, `@JsonClass(generateAdapter=true)` + `@Json(name="snake_case")`. Suggested files: `BookingPageDtos.kt`, `EventTypeDtos.kt`, `AvailabilityDtos.kt`, `SlotDtos.kt` (Slot `{start,end,startLocal,eligibleHosts}`), `BookingDtos.kt`, `PublicBookingDtos.kt` (page view, event-type view, manage view + `actions`/`payment`), `WorkflowDtos.kt`, `MessageTemplateDtos.kt`, `PackageDtos.kt`, `InvoiceDtos.kt`, `ResourceDtos.kt`, `VisitDtos.kt`, `PollDtos.kt`, `WaitlistDtos.kt`, `InsightsDtos.kt`, `NotificationPrefsDtos.kt`, `SchedulingErrorDtos.kt` (`{error,message}`, `{error:'Validation failed',details:[{field,message,code}]}`, `409 {error,alternatives:[{start,end,startLocal}]}`).
- `data/scheduling/SchedulingRepository.kt` — wraps both Apis in `safeApiCall` → `NetworkResult<T>` (pattern: `data/api/net/NetworkResult.kt`, `safeApiCall`). One repository (or a host/public split) exposing suspend funs for every endpoint. **All streams call this repository, never the Api directly.**
- `data/scheduling/SchedulingOwner.kt` — the owner-context helper. A sealed type `SchedulingOwner { Personal; Business(businessUserId); Home(homeId) }` with helpers that (a) produce GET query params (`owner_type`/`owner_id` for Business; nothing for Personal), (b) produce write-body owner fields, and (c) pick the host base path vs the `/api/homes/{homeId}/scheduling` alias for Home. Repository methods accept a `SchedulingOwner`.
- `data/scheduling/SchedulingError.kt` — typed decoder mapping the error envelope to a sealed type: `Validation(details)`, `Conflict(code, alternatives)` (the 409 `SLOT_TAKEN|SLOT_UNAVAILABLE|SLOT_FULL` decode), `Paused`, `Expired`, `Unavailable`, `SlugTaken(suggestions)`, `NotAvailable501`, `Generic(code,message)`. Extends/uses `NetworkError` from `data/api/net/`.
- `data/scheduling/SchedulingFeatureFlags.kt` — the **paid feature flag** (e.g. `paidSchedulingEnabled`), driven from `BuildConfig` / remote-config; default OFF in prod, ON for hosted-dev. Foundation also exposes Stripe **test-mode** wiring reuse.

**DI (edits):**
- `di/NetworkModule.kt` — add `@Provides @Singleton fun provideSchedulingApi(retrofit): SchedulingApi` (uses the existing authed Retrofit/`OkHttpClient`). **For the PUBLIC api you MUST provide a dedicated UNAUTHENTICATED client** — the repo's sole `OkHttpClient` unconditionally installs `AuthInterceptor`, which would attach a stale/absent `Authorization` header on the true invitee (signed-out) flow. Add a qualified `@Named("publicScheduling")` `OkHttpClient` + `Retrofit` that **omits `AuthInterceptor`** (keep logging/retry/Sentry), then `@Provides @Singleton fun provideSchedulingPublicApi(@Named("publicScheduling") retrofit): SchedulingPublicApi`. The public base URL is the backend origin — if it equals `PANTOPUS_API_BASE_URL` (same host, unauth `/api/public/*` paths) reuse the URL but a SEPARATE client; only add a second base-url if the origin truly differs. Public calls must carry NO `Authorization` header.

**Routing seam (edits):**
- `ui/screens/root/RootTabScreen.kt` — in `private object ChildRoutes`, add **EVERY** scheduling route `const val` below (one per navigable top-level screen across all 18 streams), each with its `{arg}` placeholders, **and** a matching `NavHost { composable(route, arguments=listOf(navArgument(...))) { … } }` block calling a **stub screen composable by name** in the owning stream's folder (e.g. `composable(ChildRoutes.SCHEDULING_HUB){ SchedulingHubScreen(...) }`). A0 declares thin placeholder stub bodies so the project compiles; each feature stream replaces the body in its own file. **A0 is the LAST edit to `RootTabScreen.kt`.**

  ⚠️ **This manifest IS the contract.** Every route a feature stream lists under "Fills A0 stubs" MUST appear here verbatim, or that stream hits a Foundation gap and stalls (per RULE 1). Exhaustive list (≈65 net-new + 3 pre-existing home routes left as-is) — derived from the streams' "Fills A0 stubs" clauses:
  - **A1:** `SCHEDULING_HUB="scheduling/hub"`, `SCHEDULING_SETUP_WIZARD="scheduling/setup"`, `SCHEDULING_SETTINGS="scheduling/settings"`, `SCHEDULING_NOTIFICATIONS="scheduling/settings/notifications"`, `SCHEDULING_ONBOARDING="scheduling/onboarding"`
  - **A2:** `EVENT_TYPE_LIST="scheduling/event-types"`, `EVENT_TYPE_EDITOR="scheduling/event-types/{eventTypeId}"`, `INTAKE_QUESTIONS_EDITOR="scheduling/event-types/{eventTypeId}/questions"`, `CONNECTED_CALENDARS="scheduling/connected-calendars"`
  - **A3:** `AVAILABILITY_LIST="scheduling/availability"`, `WEEKLY_HOURS_EDITOR="scheduling/availability/{scheduleId}"`, `DATE_OVERRIDES="scheduling/availability/{scheduleId}/overrides"`, `BOOKING_LIMITS="scheduling/availability/limits"`, `BLOCK_OFF_TIME="scheduling/availability/blocks"`
  - **A4:** `BOOKING_PAGE_MANAGE="scheduling/booking-page"`, `PUBLIC_PAGE_PREVIEW="scheduling/booking-page/preview"`, `ONE_OFF_LINK_GENERATOR="scheduling/booking-page/one-off"`
  - **A5:** `PUBLIC_BOOKING="book/{slug}"`, `PUBLIC_BOOKING_ONEOFF="book/o/{token}"`
  - **A6:** `MANAGE_BOOKING="booking/{manageToken}"`
  - **A7:** `MY_BOOKINGS="scheduling/my-bookings"`, `OPEN_IN_APP_INTERSTITIAL="scheduling/open-in-app"`, `RECURRING_SETUP="scheduling/my-bookings/recurring"`
  - **A8:** `BOOKINGS_INBOX="scheduling/bookings"`, `BOOKING_DETAIL="scheduling/bookings/{bookingId}"`
  - **A9:** `BOOKING_SEARCH="scheduling/bookings/search"`, `GROUP_ROSTER="scheduling/bookings/{bookingId}/roster"`, `MANUAL_BOOKING="scheduling/bookings/manual"`, `WAITLIST="scheduling/waitlist"`, `POST_MEETING_FOLLOWUP="scheduling/bookings/{bookingId}/followup"`
  - **A10:** `HOUSEHOLD_AVAILABILITY="scheduling/home/availability"`, `PERMISSION_GATED_SCHEDULER="scheduling/home/scheduler"` (the existing `HOME_CALENDAR`, `ADD_CALENDAR_EVENT`, `CALENDAR_EVENT_DETAIL` already exist — left as-is; A10 edits only the screens they point to)
  - **A11:** `FIND_A_TIME="scheduling/find-a-time"`, `FIND_A_TIME_SLOTS="scheduling/find-a-time/slots"`, `MEMBER_POLL_RESPONSE="scheduling/poll/{pollId}"`, `WHOS_FREE="scheduling/whos-free"`
  - **A12:** `RESOURCE_LIST="scheduling/resources"`, `RESOURCE_EDITOR="scheduling/resources/{resourceId}/edit"`, `RESOURCE_DETAIL="scheduling/resources/{resourceId}"`, `BOOK_RESOURCE="scheduling/resources/{resourceId}/book"`, `VISIT_SETUP="scheduling/visits/new"`, `VISIT_DETAIL="scheduling/visits/{visitId}"`
  - **A13:** `BUSINESS_SCHEDULING_SETTINGS="scheduling/business"`, `TEAM_BOOKING_AVAILABILITY="scheduling/business/team-availability"`, `COLLECTIVE_EVENT_SETUP="scheduling/business/collective/{eventTypeId}"`, `MEMBER_WORKING_HOURS="scheduling/business/members/{memberId}/hours"`
  - **A14:** `PAYMENTS_SETUP="scheduling/payments"`, `PAYOUTS="scheduling/payments/payouts"`, `CANCELLATION_REFUND_POLICY="scheduling/payments/policy"`
  - **A15:** `PACKAGES_LIST="scheduling/packages"`, `PACKAGE_EDITOR="scheduling/packages/{packageId}/edit"`, `BUY_PACKAGE="scheduling/packages/{packageId}/buy"`, `MY_PACKAGES="scheduling/my-packages"`, `INVOICES_LIST="scheduling/invoices"`, `INVOICE_DETAIL="scheduling/invoices/{invoiceId}"`
  - **A16:** `REMINDERS_QUICK_SETUP="scheduling/reminders"`, `WORKFLOWS_LIST="scheduling/workflows"`, `WORKFLOW_EDITOR="scheduling/workflows/{workflowId}"`, `MESSAGE_TEMPLATE_EDITOR="scheduling/templates/{templateId}"`, `TEMPLATE_LIBRARY="scheduling/templates"`
  - **A17:** `INSIGHTS_DASHBOARD="scheduling/insights"`, `EVENT_TYPE_PERFORMANCE="scheduling/insights/event-types"`, `NO_SHOW_REPORT="scheduling/insights/no-shows"`, `TEAM_PERFORMANCE="scheduling/insights/team"`
  - **A18:** `NOTIFICATION_PERMISSION_PROMPT="scheduling/notifications-permission"`
  (Sheets/dialogs/pickers — C3 share, C7 tz, G1 round-robin, H4 trigger, H6 variable, H7 preview, H13 filter, the approve/decline/cancel/no-show/nudge sheets — are LOCAL `ModalBottomSheet`s with NO route and NO entry here. Path strings are the canonical defaults; keep them stable since feature streams build `navigate(...)` calls against these exact constants.)

**Me seam (edits):**
- `ui/screens/you/me/MeViewModel.kt` — add `MeActionTile`/`MeSectionRow` entries with routeKeys (e.g. `me.scheduling.hub` for Personal; `me.business.scheduling` for Business; `me.home.scheduling` / reuse the existing `me.calendar` for Home).
- `ui/screens/you/YouScreen.kt` — add the `when (tile.routeKey)` dispatch arms calling new `onOpenScheduling*` lambdas, and thread those lambdas down from `RootTabScreen`.
- (Read-only reference: `ui/screens/you/me/MeIdentity.kt` for pillar colors.)

**Shared scheduling components A0 must build (creates, under `ui/screens/scheduling/_shared/`):**
- `OwnerPillarChrome.kt` — applies the Personal/Home/Business accent to a screen header (wraps `PantopusColors` + `WizardIdentity` mapping).
- `SlotPicker.kt` — reusable date+time slot grid that takes `List<SlotDto>`, renders `startLocal`, exposes selection; used by C6, E4, F5, etc.
- `TimezonePicker.kt` — IANA tz selector (C7).
- `ConflictAlternativesSheet.kt` — a local `ModalBottomSheet` that renders 409 `alternatives` (nearest open times) and re-emits a chosen slot. Used by every create/reschedule surface (do not duplicate per stream).
- `PausedExpiredUnavailableState.kt` — the first-class non-error state surface (paused / expired / unavailable / secret).
- `SchedulingStateScaffolding.kt` — shared loading/empty/error scaffolding aligned to `ListOfRowsUiState` so streams reuse one state idiom.
- `ManageTokenStore.kt` — persistence for the one-time `manageToken` (e.g. DataStore-backed), keyed by booking id.
- `MoneyAndFlag.kt` — price formatting (`price_cents`/`currency`) + the `SchedulingFeatureFlags` gate composable for paid surfaces.

**Tests (creates):** `app/src/test/.../scheduling/SchedulingOwnerTest.kt`, `SchedulingErrorDecoderTest.kt` (409 alternatives + validation + paused/expired decode), `SchedulingRepositoryTest.kt` (owner-context param injection per pillar).

### 5.2 Files A0 MUST produce so feature streams have stubs

For **every top-level screen route** added to `ChildRoutes`, A0 ensures a `composable(...)` block exists that calls a screen composable **by name** in the owning stream's folder. A0 may declare a minimal placeholder body; the feature stream replaces that file's body. The route + composable wiring is **never re-touched** by feature streams.

### 5.3 Acceptance (A0)

- Builds green: `./gradlew ktlintCheck detekt test :app:assembleDebug` (run `ktlintFormat --rerun-tasks` first per repo CI quirk; detekt baseline at `app/detekt-baseline.xml`).
- New unit tests pass: `./gradlew :app:testDebugUnitTest --tests "app.pantopus.android.*.scheduling.*"`.
- App launches on emulator with a hosted-dev account; every scheduling route resolves to its stub without crash; Me tiles navigate to the stubs.
- `SchedulingRepository` verified against the live endpoint for at least one read per pillar (Personal `GET /booking-page`, Home alias `GET /api/homes/:id/scheduling/...`, Business with `owner_type=business`).
- **Merge to `master` first.**

---

## 6. The 18 feature streams

> **Common to all streams below.** Track = which pillar(s) the stream primarily serves. "Files this stream MUST NOT touch" always includes the A0 seam files: `RootTabScreen.kt`, `di/NetworkModule.kt`, `ui/screens/you/me/MeViewModel.kt`, `ui/screens/you/YouScreen.kt`, `data/api/services/SchedulingApi.kt`, `data/api/services/SchedulingPublicApi.kt`, `data/api/models/scheduling/**`, `data/scheduling/**`, `ui/screens/scheduling/_shared/**` — plus every other stream's folder. **Reuses (read-only)** always include: A0's `SchedulingRepository`, `SchedulingOwner`, `SchedulingError`, the `_shared/` components, and the shells `ui/screens/shared/{list_of_rows,form,wizard,content_detail}/`. ViewModels are `@HiltViewModel` with `StateFlow<XUiState>` sealed states; read nav args via `SavedStateHandle`. **Acceptance, common to all:** `./gradlew ktlintCheck detekt :app:assembleDebug` green; targeted tests `./gradlew :app:testDebugUnitTest --tests "app.pantopus.android.ui.screens.scheduling.<folder>.*"`; Paparazzi snapshots for new screens (`./gradlew :app:paparazziVerify` / record); verify on emulator with a hosted-dev account against the live endpoint; screenshots vs the pasted designs. **Depends on:** Android Foundation (A0) only. **Branch:** `claude/calendarly-android-<id>-<slug>`, one PR, merges to `master` conflict-free.

---

### Stream A1 — Setup & Hub   [Personal/Home/Business] [MVP+v2]  (~6 screens)
**Goal:** The entry experience — the Scheduling Hub, the first-run wizard that creates a booking link, the settings root, notification prefs, the summary card, and the Home/Business onboarding.
**Screens (this stream owns):** A1 Scheduling Hub [MVP]; A2 First-Run Wizard / Set Up Booking Link [MVP]; A3 Scheduling Settings Root [MVP]; A4 Notifications Preferences [MVP]; A5 Summary Card [MVP]; A6 Onboarding for Home & Business [v2].
**Backend endpoints used:** `GET /booking-page` (auto-creates if missing), `PUT /booking-page`, `GET /booking-page/check-slug`, `PUT /booking-page/slug`, `POST /booking-page/reset-slug`, `GET /bookings/summary` (A5/A1 metrics), `GET /notification-preferences` + `PUT /notification-preferences` (A4). Owner context via `SchedulingOwner` — A6 drives Home (homeId alias) and Business (`owner_type=business`) onboarding paths.
**Files this stream OWNS:** `ui/screens/scheduling/hub/**` (`SchedulingHubScreen.kt` + `SchedulingHubViewModel.kt`, `SummaryCard.kt`), `ui/screens/scheduling/setup/**` (`FirstRunWizardScreen.kt`/`VM` using `WizardShell`+`WizardIdentity`, `OnboardingHomeBusinessScreen.kt`/`VM`), `ui/screens/scheduling/settings/**` (`SchedulingSettingsRootScreen.kt`/`VM`, `NotificationPrefsScreen.kt`/`VM`). Fills the A0 stubs for `SCHEDULING_HUB`, `SCHEDULING_SETUP_WIZARD`, `SCHEDULING_SETTINGS`, `SCHEDULING_NOTIFICATIONS`, `SCHEDULING_ONBOARDING`.
**Files this stream MUST NOT touch:** the A0 seam files (above) + all other stream folders.
**Reuses (read-only):** `WizardShell`/`WizardIdentity`, `FormShell`, `OwnerPillarChrome`, `SchedulingStateScaffolding`, repository slug/page/summary/prefs calls.
**Required states/behaviors:** loading; empty/zero-state (no page yet → wizard CTA); slug **available/taken** with suggestions (live `check-slug`); reset-slug **danger-zone confirm** (invalidates old link); pillar accenting per `SchedulingOwner`; tz selection persisted on the page; error envelope decode. No 409/manageToken here.
**Acceptance checks:** common acceptance; verify slug check + page create on live dev; targeted tests for `SchedulingHubViewModel`/`FirstRunWizardViewModel`/`NotificationPrefsViewModel`.

---

### Stream A2 — Event Types   [Personal/Home/Business] [MVP+v2]  (~4 screens)
**Goal:** Create and configure bookable event types/services, intake questions, and the (501) connected-calendars surface.
**Screens (this stream owns):** B1 Event Type/Service List [MVP]; B2 Event Type/Service Editor [MVP]; B3 Intake Questions Editor [v2]; B8 Connected Calendars [v2 → 501].
**Backend endpoints used:** `GET /event-types`, `POST /event-types`, `GET /event-types/:id` (returns assignees + questions), `PUT /event-types/:id`, `DELETE /event-types/:id` (409 `HAS_UPCOMING_BOOKINGS` → deactivate-instead path), `PUT /event-types/:id/questions` (B3, replace-all), `GET /connected-calendars` (read; empty), `POST /connected-calendars/connect` (**501 → "coming soon"**). Owner context via `SchedulingOwner`. Note `default_duration` must be in `durations`; `visibility:'public'|'secret'`; `price_cents`/`currency` gated by the paid flag in the editor.
**Files this stream OWNS:** `ui/screens/scheduling/eventtypes/**` (`EventTypeListScreen.kt`/`VM`, `EventTypeEditorScreen.kt`/`VM`, `IntakeQuestionsEditorScreen.kt`/`VM`, `ConnectedCalendarsScreen.kt`/`VM`). Fills A0 stubs `EVENT_TYPE_LIST`, `EVENT_TYPE_EDITOR`, `INTAKE_QUESTIONS_EDITOR`, `CONNECTED_CALENDARS`.
**Files this stream MUST NOT touch:** A0 seams + other folders. (Availability lives in A3 — link out by route only.)
**Reuses (read-only):** `FormShell`, `ListOfRowsScreen`/`ListOfRowsUiState`, `OwnerPillarChrome`, `MoneyAndFlag` (price + paid-flag gate), repository event-type calls.
**Required states/behaviors:** loading; empty (no event types → create CTA); editor validation (duration range, slug `^[a-z0-9][a-z0-9-]{0,60}$`, `default_duration ∈ durations`); `SLUG_TAKEN` 409 inline; `DELETE` 409 → suggest deactivate; **secret** visibility flag; **501** connect → coming-soon; paid fields hidden when flag off.
**Acceptance checks:** common; verify CRUD + 501 connect on live dev; targeted tests for `EventTypeListViewModel`/`EventTypeEditorViewModel`.

---

### Stream A3 — Availability   [Personal] [MVP+v2]  (~5 screens)
**Goal:** Manage availability schedules, weekly hours, date overrides/holidays, booking limits/notice rules, and ad-hoc block-off time.
**Screens (this stream owns):** B4 Availability Schedule List [MVP]; B5 Weekly Hours Editor [MVP]; B6 Date Overrides & Holidays [v2]; B7 Booking Limits & Notice Rules [v2]; B9 Block off time [MVP].
**Backend endpoints used:** `GET /availability` (schedules + rules + overrides; **always personal — `req.user`, no owner fields**), `POST /availability`, `PUT /availability/:id`, `DELETE /availability/:id` (409 `CANNOT_DELETE_DEFAULT`), `PUT /availability/:id/rules` (B5, weekday `0=Sun`, `HH:MM`), `PUT /availability/:id/overrides` (B6, date-level `is_unavailable`/partial), `POST /availability/blocks` + `DELETE /availability/blocks/:blockId` (B9, RRULE optional). B7 booking-limits/notice are **event-type fields** (`min_notice_min`, `max_horizon_days`, `slot_interval_min`, `daily_cap`, `per_booker_cap`) edited via `PUT /event-types/:id` — B7 reads/writes those *for the selected event type via the repository* without entering A2's folder.
**Files this stream OWNS:** `ui/screens/scheduling/availability/**` (`AvailabilityListScreen.kt`/`VM`, `WeeklyHoursEditorScreen.kt`/`VM`, `DateOverridesScreen.kt`/`VM`, `BookingLimitsScreen.kt`/`VM`, `BlockOffTimeScreen.kt`/`VM`). Fills A0 stubs `AVAILABILITY_LIST`, `WEEKLY_HOURS_EDITOR`, `DATE_OVERRIDES`, `BOOKING_LIMITS`, `BLOCK_OFF_TIME`.
**Files this stream MUST NOT touch:** A0 seams + other folders (incl. A2's `eventtypes/`).
**Reuses (read-only):** `FormShell`, `ListOfRowsScreen`, `TimezonePicker`, repository availability calls.
**Required states/behaviors:** loading; auto-created default schedule; `CANNOT_DELETE_DEFAULT` 409 (reassign-default flow); weekly grid validation; override is-unavailable vs partial-day; block create/delete; tz per schedule. No public 409 alternatives here.
**Acceptance checks:** common; verify rules/overrides/blocks round-trip on live dev; targeted tests for `WeeklyHoursEditorViewModel`/`AvailabilityListViewModel`.

---

### Stream A4 — Booking page & sharing   [Personal/Home/Business] [MVP+v2]  (~5 screens)
**Goal:** Manage the public booking page, preview it, share the link, generate one-off/single-use links, and present link/page empty + zero states. **(No C9 Embed Widget — web only.)**
**Screens (this stream owns):** C1 Booking Link/Public Page Management [MVP]; C2 Public Booking Page Preview [MVP]; C3 Share Your Link Sheet [MVP]; C4 One-off/Single-use Link Generator [MVP]; H16 Booking-Link/Page Empty & Zero-State [MVP].
**Backend endpoints used:** `GET /booking-page`, `PUT /booking-page` (is_live/is_paused/visibility/branding), `POST /booking-page/disable`, `PUT /booking-page/slug` + `GET /booking-page/check-slug` (shared concern with A1 — A4 reads page state, A1 owns the wizard), `POST /booking-page/one-off-links` (C4; returns `{token, path, expires_at, single_use}` — **token returned once**, store in the share href), and for **C2 preview** the public `GET /api/public/book/:slug` (render the live page exactly as invitees see it, honoring `status:'paused'`).
**Files this stream OWNS:** `ui/screens/scheduling/bookingpage/**` (`BookingPageManageScreen.kt`/`VM`, `PublicPagePreviewScreen.kt`/`VM`, `ShareLinkSheet.kt` (local `ModalBottomSheet`), `OneOffLinkGeneratorScreen.kt`/`VM`, `BookingPageZeroState.kt`). Fills A0 stubs `BOOKING_PAGE_MANAGE`, `PUBLIC_PAGE_PREVIEW`, `ONE_OFF_LINK_GENERATOR`.
**Files this stream MUST NOT touch:** A0 seams + other folders. (A1 owns the first-run wizard; A5/A6 own the invitee-side public render — A4's C2 preview is the **host's** preview of their own page.)
**Reuses (read-only):** `content_detail` shell for preview, `OwnerPillarChrome`, share via existing `shareText(...)` + `InviteLinks` from `ui/components/SystemSheets.kt` (read-only), `PausedExpiredUnavailableState`, repository page + one-off calls + `SchedulingPublicApi` read.
**Required states/behaviors:** loading; **zero-state** (H16: no page / no event types yet → setup CTA); `is_paused`/`is_live` toggles; **paused** preview state; share sheet (copy/share intent); one-off link **expiry + single-use** config; **token-shown-once** persistence; disable (danger).
**Acceptance checks:** common; verify one-off link create + public preview render on live dev; targeted tests for `BookingPageManageViewModel`/`OneOffLinkGeneratorViewModel`.

---

### Stream A5 — Invitee discovery   [Personal/Home/Business] [MVP]  (~4 screens)
**Goal:** The public invitee-facing discovery flow: booker landing/profile, date+time slot picker, timezone selector, and the no-availability state. **(Public, unauthenticated — hits the backend origin.)**
**Screens (this stream owns):** C5 Booking Landing/Booker Profile [MVP]; C6 Date+Time Slot Picker [MVP]; C7 Timezone Selector [MVP]; C8 Slot/No-Availability State [MVP].
**Backend endpoints used (public):** `GET /api/public/book/:slug` (page + event-type list; `status:'active'|'paused'`, 404 `status:'unavailable'`), `GET /api/public/book/:slug/:eventTypeSlug/slots?from&to&tz` (slots with `startLocal`; paused → empty + `status:'paused'`), and for one-off entry `GET /api/public/book/o/:token` (404 `status:'expired'`). **Always pass `tz`.** This stream stops at slot selection; A6 owns confirm/checkout.
**Files this stream OWNS:** `ui/screens/scheduling/invitee/discovery/**` (`BookerLandingScreen.kt`/`VM`, `SlotPickerScreen.kt`/`VM`, `TimezoneSelectorSheet.kt`, `NoAvailabilityState.kt`). Fills A0 stubs `PUBLIC_BOOKING` (`book/{slug}`) and the one-off entry `PUBLIC_BOOKING_ONEOFF` (`book/o/{token}`).
**Files this stream MUST NOT touch:** A0 seams + other folders.
**Reuses (read-only):** `SlotPicker`, `TimezonePicker`, `PausedExpiredUnavailableState`, `content_detail` shell, `SchedulingPublicApi` reads via repository.
**Required states/behaviors:** loading; **paused** page; **expired** one-off; **unavailable** (404); **no-availability** (C8 — empty slots in range → next-available CTA, advance date window); tz selection drives re-fetch; render `startLocal`, store UTC start. No writes here.
**Acceptance checks:** common; verify public page + slots fetch (no auth) on live dev with a real dev page slug; targeted tests for `SlotPickerViewModel`/`BookerLandingViewModel`.

---

### Stream A6 — Invitee confirm & manage   [Personal/Home/Business] [MVP]  (~4 screens)
**Goal:** The invitee booking commit + post-book flow: intake form, review/confirm/checkout, confirmed/thank-you, and manage-your-booking. **Owns the booking POST and the manageToken handoff.**
**Screens (this stream owns):** D1 Intake/Booking Details Form [MVP]; D2 Review & Confirm/Checkout [MVP]; D3 Booking Confirmed/Thank-You [MVP]; D4 Manage Your Booking [MVP].
**Backend endpoints used (public):** `POST /api/public/book/:slug/:eventTypeSlug` (and `POST /api/public/book/o/:token`) → returns `{booking, manageToken, clientSecret?}` (**persist manageToken**, handle `clientSecret` for priced under the paid flag); `GET /api/public/booking/:token` (D4 manage view + `actions`/`payment`); `GET /api/public/booking/:token/ics` (link to A7's Add-to-Calendar). **409** `SLOT_TAKEN|SLOT_UNAVAILABLE|SLOT_FULL` with `alternatives` on the POST → surface via `ConflictAlternativesSheet`. `409 PAGE_PAUSED` and one-off `LINK_USED`/`SLOT_NOT_OFFERED` handled.
**Files this stream OWNS:** `ui/screens/scheduling/invitee/confirm/**` (`IntakeFormScreen.kt`/`VM`, `ReviewConfirmScreen.kt`/`VM`, `ConfirmedScreen.kt`/`VM`, `ManageBookingScreen.kt`/`VM`). Fills A0 stub `MANAGE_BOOKING` (`booking/{manageToken}`); the intake/review steps are local steps reached from A5's slot selection (pass slot + slug via nav args/`SavedStateHandle`).
**Files this stream MUST NOT touch:** A0 seams + other folders. (A7 owns edge/cancel/add-to-cal screens; A6 deep-links to D7/D8/D10 by route.)
**Reuses (read-only):** `FormShell`, `ConflictAlternativesSheet`, `ManageTokenStore`, `MoneyAndFlag` (paid checkout gate), `SchedulingPublicApi` writes via repository.
**Required states/behaviors:** loading/submitting; intake answers (typed per event-type questions); **409 alternatives** → re-pick; **manageToken persisted** (`ManageTokenStore`) keyed to booking; `requires_approval` → pending confirmation copy; priced → Stripe **test-mode** clientSecret behind flag; D4 actions gated by `can_cancel`/`can_reschedule`/deadlines.
**Acceptance checks:** common; verify free booking POST + manage fetch on live dev (keep the test booking); force a 409 (double-book a slot) and confirm alternatives surface; targeted tests for `ReviewConfirmViewModel`/`ManageBookingViewModel` incl. 409 decode.

---

### Stream A7 — Invitee edge & customer   [Personal/Home/Business] [MVP+v2]  (~8 screens)
**Goal:** All invitee/customer edge states + the customer's own surfaces: slot-taken/conflict, payment retry, unavailable/expired/paused/secret, add-to-calendar, open-in-app interstitial, reschedule/cancel cutoff policy, my-bookings, and recurring/multi-session setup.
**Screens (this stream owns):** D5 Slot Taken/Conflict [MVP]; D6 Payment Failed/Retry [v2]; D7 Unavailable/Expired/Paused/Secret [MVP]; D8 Add to Calendar [MVP]; D9 Open-in-App/Deep-Link Hand-off [MVP, native interstitial]; D10 Reschedule/Cancel Cutoff & Policy-Blocked [MVP]; D11 My Bookings (customer) [v2]; D12 Recurring/Multi-Session Setup [v2].
**Backend endpoints used:** D5 — the 409 `alternatives` payload (reused decode, presented full-screen); D6 — re-confirm the Stripe `clientSecret` from the booking POST (paid flag, test mode), `payment` block from `GET /booking/:token`; D7 — the `status:'unavailable'|'expired'|'paused'` + `secret` states from public reads; D8 — `GET /api/public/booking/:token/ics` (download/attach) + native add-to-calendar intent; D10 — `GET /api/public/booking/:token` `actions` (deadlines), `POST /api/public/booking/:token/reschedule`, `POST /api/public/booking/:token/cancel`, accept/decline-reschedule; D11 — `GET /my-bookings` (authed customer); D12 — `POST /bookings/recurring` (host-side) and invitee recurring via repeated slots.
**Files this stream OWNS:** `ui/screens/scheduling/invitee/edge/**` (`SlotTakenScreen.kt`, `PaymentRetryScreen.kt`/`VM`, `UnavailableExpiredScreen.kt`, `AddToCalendarSheet.kt`, `OpenInAppInterstitialScreen.kt`, `RescheduleCancelPolicyScreen.kt`/`VM`), `ui/screens/scheduling/invitee/customer/**` (`MyBookingsScreen.kt`/`VM`, `RecurringSetupScreen.kt`/`VM`). Fills A0 stubs `MY_BOOKINGS`, `OPEN_IN_APP_INTERSTITIAL`, `RECURRING_SETUP`.
**Files this stream MUST NOT touch:** A0 seams + other folders; **D9 references `core/routing/DeepLinkRouter` READ-ONLY** (consume the inbound deep link via the already-wired `RootTabScreen` handoff — add no new global route plumbing).
**Reuses (read-only):** `ConflictAlternativesSheet`/decoder, `PausedExpiredUnavailableState`, `ManageTokenStore`, `MoneyAndFlag`, repository public + my-bookings calls.
**Required states/behaviors:** full-screen 409 conflict; payment retry (test mode, paid flag); all four first-class non-error states + secret; ICS add-to-calendar; **deep-link interstitial → in-app booking** (read-only deep-link reuse); policy-blocked cutoff messaging; my-bookings list states; recurring session-array setup.
**Acceptance checks:** common; verify ICS fetch + my-bookings + a policy-blocked cancel on live dev; verify the `pantopus://…/book/…` deep link opens the interstitial on the emulator (`adb shell am start -a android.intent.action.VIEW -d "pantopus://…"`); targeted tests for `MyBookingsViewModel`/`RescheduleCancelPolicyViewModel`.

---

### Stream A8 — Bookings inbox & core   [Personal/Home/Business] [MVP]  (~5 screens)
**Goal:** The host's bookings lifecycle core: inbox, detail, approve/decline, reschedule/reassign, cancel/refund.
**Screens (this stream owns):** E1 Bookings Inbox [MVP]; E2 Booking Detail [MVP]; E3 Approve/Decline Sheet [MVP]; E4 Reschedule/Reassign Sheet [MVP]; E5 Cancel & Refund Sheet [MVP].
**Backend endpoints used:** `GET /bookings?status&event_type_id&from&to&q` (E1), `GET /bookings/:id` (E2; booking + attendees + eventType), `GET /bookings/:id/available-slots?from&to&tz` (E4 reschedule slots), `POST /bookings/:id/approve` / `decline` (E3), `POST /bookings/:id/reschedule` (+ optional `host_user_id`) / `POST /bookings/:id/reassign` (E4; 409 `SLOT_CONFLICT`/`INVALID_HOST`/`PAST_DEADLINE`), `POST /bookings/:id/cancel` (E5; refund logic, 409 `PAST_DEADLINE`/`REFUND_FAILED`). Owner context via `SchedulingOwner` (Personal/Business `owner_type`/Home alias).
**Files this stream OWNS:** `ui/screens/scheduling/bookings/**` (`BookingsInboxScreen.kt`/`VM`, `BookingDetailScreen.kt`/`VM`, `ApproveDeclineSheet.kt`, `RescheduleReassignSheet.kt`/`VM`, `CancelRefundSheet.kt`/`VM`). Fills A0 stubs `BOOKINGS_INBOX`, `BOOKING_DETAIL`. (Sheets are local `ModalBottomSheet`s off the detail screen.)
**Files this stream MUST NOT touch:** A0 seams + other folders. (A9 owns bookings *extras* — share the folder boundary: A9 uses `ui/screens/scheduling/bookings_extra/**`, not `bookings/`.)
**Reuses (read-only):** `ListOfRowsScreen`, `content_detail` shell, `SlotPicker`, `ConflictAlternativesSheet`, `OwnerPillarChrome`, `MoneyAndFlag` (refund amounts), repository bookings calls.
**Required states/behaviors:** loading; empty inbox per status filter (upcoming/pending/past/cancelled); 409 conflict on reschedule → alternatives; reassign validates assignee membership (`INVALID_HOST`); cancel refund estimate + `PAST_DEADLINE`; optimistic status flip with refetch-on-error.
**Acceptance checks:** common; verify inbox + approve/cancel against a test booking on live dev; targeted tests for `BookingsInboxViewModel`/`RescheduleReassignViewModel`.

---

### Stream A9 — Bookings extras   [Personal/Home/Business] [v2]  (~8 screens)
**Goal:** Host bookings power-features: no-show, post-meeting follow-up, group roster & seats, search & filter, double-book warning, nudge, manual/on-behalf booking, waitlist.
**Screens (this stream owns):** E6 Mark No-Show [v2]; E7 Post-Meeting Follow-up [v2]; E8 Group Event Roster & Seats [v2]; E9 Booking Search & Filter [v2]; E10 Double-Book Warning (host) [v2]; E11 Send a Nudge [v2]; E12 Manual/On-Behalf Booking [v2]; E13 Waitlist Join & Management [v2].
**Backend endpoints used:** `POST /bookings/:id/no-show` (E6; 409 `NOT_APPLICABLE_YET`), `POST /bookings/:id/nudge` (E11), `POST /bookings` (E12 manual create; `createdVia='manual'`; 409 `SLOT_CONFLICT`), `GET /bookings/:id` attendees (E8 roster/seats; `seat_cap`), `GET /bookings?q&...` (E9 search/filter — its own filter sheet, distinct from A8's inbox), `GET /bookings/:id/available-slots` (E10 double-book detection / E12 slot pick), `GET /event-types/:id/waitlist` + `POST /waitlist/:id/promote` (E13; public join via `POST /api/public/book/:slug/:eventTypeSlug/waitlist`). E7 follow-up reuses `POST /bookings/:id/nudge` or a message template send.
**Files this stream OWNS:** `ui/screens/scheduling/bookings_extra/**` (`NoShowSheet.kt`, `PostMeetingFollowupScreen.kt`/`VM`, `GroupRosterScreen.kt`/`VM`, `BookingSearchFilterScreen.kt`/`VM`, `DoubleBookWarning.kt`, `NudgeSheet.kt`, `ManualBookingScreen.kt`/`VM`, `WaitlistScreen.kt`/`VM`). Fills A0 stubs `BOOKING_SEARCH`, `GROUP_ROSTER`, `MANUAL_BOOKING`, `WAITLIST`, `POST_MEETING_FOLLOWUP`.
**Files this stream MUST NOT touch:** A0 seams + other folders incl. A8's `bookings/`.
**Reuses (read-only):** `ListOfRowsScreen`, `filter_sheet`/`activity_filter_sheet` shells (read-only), `SlotPicker`, `ConflictAlternativesSheet`, `FormShell`, repository calls.
**Required states/behaviors:** no-show `NOT_APPLICABLE_YET` guard; roster seat counts vs `seat_cap`; search debounce + empty; double-book warning before manual create; nudge confirm; manual create 409 alternatives; waitlist join/promote states.
**Acceptance checks:** common; verify manual create + waitlist promote on live dev; targeted tests for `ManualBookingViewModel`/`WaitlistViewModel`/`BookingSearchFilterViewModel`.

---

### Stream A10 — Home calendar & RSVP   [Home] [MVP]  (~5 screens)  ⚠ EXCLUSIVE owner of existing Home Calendar module
**Goal:** Extend the existing Home Calendar to surface the **booking union**, RSVP, household availability settings, and the permission-gated scheduler view.
**Screens (this stream owns):** F1 Home Calendar/Agenda [MVP]; F2 Home Event Detail + RSVP [MVP]; F3 Home Add/Edit Event [MVP]; F8 My Household Availability Settings [MVP]; F15 Permission-Gated Scheduler View [MVP].
**Backend endpoints used:** `GET /api/homes/:id/events?start_after&start_before` (F1 — **the union**; rows tagged `source:'event'|'booking'` + `booking_status`), `GET /api/homes/:id/events/:eventId` (F2 detail + attendees), `POST /api/homes/:id/events` / `PUT` / `DELETE` (F3; `request_rsvp`, `reminders`), `POST /api/homes/:id/events/:eventId/rsvp` (F2 RSVP `going|maybe|declined|pending`), `GET /availability` (F8 personal household availability), and `/api/homes/:homeId/scheduling/*` reads for F15 gating. **NEVER create `HomeCalendarEvent` rows for bookings** — booking rows are query-time union only; tap-through on a `source:'booking'` row routes to A8's Booking Detail by route.
**Files this stream OWNS (EXCLUSIVE — existing module):** `ui/screens/homes/calendar/**` (`HomeCalendarScreen.kt`/`ViewModel`, `AddEventFormScreen.kt`/`VM`, `EventDetailScreen.kt`/`VM`, `CalendarEventCategory.kt`, `MonthStripHeader.kt`), **plus** new `ui/screens/scheduling/home/**` (`HouseholdAvailabilityScreen.kt`/`VM` for F8, `PermissionGatedSchedulerScreen.kt`/`VM` for F15). Fills A0 stubs `HOUSEHOLD_AVAILABILITY`, `PERMISSION_GATED_SCHEDULER`; the existing `HOME_CALENDAR`/`ADD_CALENDAR_EVENT`/`CALENDAR_EVENT_DETAIL` routes already exist in `RootTabScreen.kt` and are **left as-is** (A10 edits only the screen files they point to).
**Files this stream MUST NOT touch:** A0 seams + other folders. **No other stream may edit `ui/screens/homes/calendar/**`.**
**Reuses (read-only):** existing calendar components, `content_detail` shell, `OwnerPillarChrome` (Home green), `PausedExpiredUnavailableState`, repository home-events + availability calls.
**Required states/behaviors:** union render with **booking vs event** differentiation (`source`/`booking_status` badges, pending/confirmed); RSVP upsert states; permission gating — gate on the home member role (`MemberRole` from `ui/screens/homes/members/MemberRolePalette.kt`) + the `calendar.view` permission the `/api/homes/:homeId/scheduling/*` reads enforce; render a no-access state when the backend returns 403/forbidden; tz; never persist booking rows.
**Acceptance checks:** common; verify the booking union appears in the home calendar after creating a home booking on live dev; targeted tests for `HomeCalendarViewModel` (union mapping) + `HouseholdAvailabilityViewModel`. Re-record existing calendar Paparazzi snapshots if visuals change.

---

### Stream A11 — Find-a-time & who's-free   [Home] [MVP+v2]  (~4 screens)
**Goal:** Household coordination: find-a-time setup + suggested slots, member poll response, and who's-free household availability.
**Screens (this stream owns):** F4 Find a Time — Setup [MVP]; F5 Find a Time — Suggested Slots [MVP]; F6 Find a Time — Member Poll Response [v2]; F7 Who's Free — Household Availability [v2].
**Backend endpoints used (home-only):** `GET /find-a-time?owner_type=home&owner_id&member_ids&mode&duration_min&from&to&slot_interval_min&timezone` (F4/F5; common slots + `eligibleHosts`), `GET /whos-free?from&to&tz` (F7; `freeByMember` grids), polls for F6: `POST /polls` + `GET /poll/:id` (public) + `POST /poll/:id/vote` (public member response). **Home-only** — use the `/api/homes/:homeId/scheduling` alias for find-a-time/whos-free.
**Files this stream OWNS:** `ui/screens/scheduling/findatime/**` (`FindATimeSetupScreen.kt`/`VM`, `SuggestedSlotsScreen.kt`/`VM`, `MemberPollResponseScreen.kt`/`VM`, `WhosFreeScreen.kt`/`VM`). Fills A0 stubs `FIND_A_TIME`, `FIND_A_TIME_SLOTS`, `MEMBER_POLL_RESPONSE`, `WHOS_FREE`.
**Files this stream MUST NOT touch:** A0 seams + other folders. (A13 owns business team-availability/polls config — A11 is the *home* find-a-time; poll *creation for business* is A13/A16's concern.)
**Reuses (read-only):** `SlotPicker`, `TimezonePicker`, `FormShell`, `ListOfRowsScreen`, repository find-a-time/whos-free/poll calls.
**Required states/behaviors:** member multi-select; mode (collective/round_robin); empty common-slots state; per-member free grids; poll open/closed (`POLL_CLOSED`); public vote (signed-in or email); tz throughout.
**Acceptance checks:** common; verify find-a-time + whos-free on a dev home with ≥2 members; targeted tests for `FindATimeSetupViewModel`/`WhosFreeViewModel`.

---

### Stream A12 — Home resources & visits   [Home] [v2]  (~6 screens)
**Goal:** Bookable home resources (rooms/vehicles/tools) and household visits (vendor/guest).
**Screens (this stream owns):** F9 Bookable Home Resources — List [v2]; F10 Resource Editor [v2]; F11 Resource Detail/Booking Calendar [v2]; F12 Book a Resource [v2]; F13 Schedule a Visit — Setup [v2]; F14 Visit Detail [v2].
**Backend endpoints used (home-only):** `GET /resources` (F9), `POST /resources` / `PUT /resources/:rid` / `DELETE /resources/:rid` (F10), `POST /resources/:rid/book` (F12; 409 `SLOT_CONFLICT`/`RESOURCE_UNAVAILABLE`, member-only in v1), resource booking calendar via `GET /resources` + booking reads (F11), `POST /visits` (F13; stored as `HomeCalendarEvent`, 409 `BAD_RANGE`), and visit detail via `GET /api/homes/:id/events/:eventId` (F14 — visits are calendar events). Owner `owner_type='home'` / homeId alias.
**Files this stream OWNS:** `ui/screens/scheduling/resources/**` (`ResourceListScreen.kt`/`VM`, `ResourceEditorScreen.kt`/`VM`, `ResourceDetailScreen.kt`/`VM`, `BookResourceScreen.kt`/`VM`), `ui/screens/scheduling/visits/**` (`VisitSetupScreen.kt`/`VM`, `VisitDetailScreen.kt`/`VM`). Fills A0 stubs `RESOURCE_LIST`, `RESOURCE_EDITOR`, `RESOURCE_DETAIL`, `BOOK_RESOURCE`, `VISIT_SETUP`, `VISIT_DETAIL`.
**Files this stream MUST NOT touch:** A0 seams + other folders incl. `ui/screens/homes/calendar/**` (A10 owns it — link to visit detail by route or read via repository).
**Reuses (read-only):** `ListOfRowsScreen`, `FormShell`, `content_detail` shell, `SlotPicker`, `ConflictAlternativesSheet`, repository resource/visit calls.
**Required states/behaviors:** empty resource list; resource type/who_can_book/available_hours editor; resource booking 409 (`RESOURCE_UNAVAILABLE`); member-only gating; visit range validation (`BAD_RANGE`, ≤30 days); who-is-home assignment; tz.
**Acceptance checks:** common; verify resource create + book + visit create on a dev home; targeted tests for `ResourceEditorViewModel`/`BookResourceViewModel`/`VisitSetupViewModel`.

---

### Stream A13 — Business config & team   [Business] [MVP+v2]  (~5 screens)
**Goal:** Business scheduling configuration and team coordination: round-robin, collective events, team booking availability, member working-hours, and business scheduling settings.
**Screens (this stream owns):** G1 Round-Robin Assignment Sheet [v2]; G2 Collective Event Setup [v2]; G3 Team Booking Availability [MVP]; G4 Member Working-Hours Editor [v2]; G5 Business Scheduling Settings [MVP].
**Backend endpoints used (business owner context `owner_type=business`):** `PUT /event-types/:id/assignees` (G1 round-robin / G2 collective — `subject_type`, `weight`, `priority`; 400 `INVALID_ASSIGNEE` for non-members), `PUT /event-types/:id` (`assignment_mode:'collective'|'round_robin'`), `GET /team-availability?from&to&tz` (G3; business-only `freeByMember`), `GET /availability`/`PUT /availability/:id/rules` (G4 member working-hours — per-member, personal availability semantics), `GET /booking-page` + `PUT /booking-page` (G5 business settings) and `GET /payments/status` (G5 readout). 
**Files this stream OWNS:** `ui/screens/scheduling/business/**` (`RoundRobinSheet.kt`, `CollectiveEventSetupScreen.kt`/`VM`, `TeamBookingAvailabilityScreen.kt`/`VM`, `MemberWorkingHoursScreen.kt`/`VM`, `BusinessSchedulingSettingsScreen.kt`/`VM`). Fills A0 stubs `BUSINESS_SCHEDULING_SETTINGS`, `TEAM_BOOKING_AVAILABILITY`, `COLLECTIVE_EVENT_SETUP`, `MEMBER_WORKING_HOURS`.
**Files this stream MUST NOT touch:** A0 seams + other folders incl. A2's `eventtypes/` (assignees are set via the repository, not by editing A2 screens) and A14's payments folder (G5 only *reads* payments status).
**Reuses (read-only):** `FormShell`, `ListOfRowsScreen`, `SlotPicker`, `TimezonePicker`, `OwnerPillarChrome` (Business violet), repository assignees/team-availability/availability calls.
**Required states/behaviors:** business-only gating (`BUSINESS_ONLY`); assignee membership validation (`INVALID_ASSIGNEE`); round-robin weight/priority; collective all-required; team free grids; per-member hours; tz; paid-flag-aware settings readout.
**Acceptance checks:** common; verify assignees set + team-availability on a dev business with ≥2 team members; targeted tests for `TeamBookingAvailabilityViewModel`/`CollectiveEventSetupViewModel`.

---

### Stream A14 — Payments & payouts   [Business] [MVP]  (~3 screens)  ⚠ EXCLUSIVE owner of Wallet additions
**Goal:** Stripe Connect payments setup + tax, payouts/earnings, and the cancellation & refund policy. **Behind the paid feature flag + Stripe TEST mode; payout settlement is deferred → show processing/pending.**
**Screens (this stream owns):** G6 Payments Setup/Stripe Connect & Tax [MVP]; G7 Payouts & Earnings [MVP]; G14 Cancellation & Refund Policy [MVP].
**Backend endpoints used:** `GET /payments/status` (G6; `connected`/`charges_enabled`/`payouts_enabled`; `applicable:false` for homes), existing Stripe Connect onboarding plumbing (reuse), payouts/earnings via existing wallet read endpoints + scheduling booking payment data (`payment` blocks from bookings; settlement deferred → **processing/pending** badges), `PUT /booking-page` + `PUT /event-types/:id` for `cancellation_policy`/`refund_policy`/`cancellation_window_min`/`reschedule_cutoff_min` (G14). Owner `owner_type=business` (payments are per-user; homes not applicable).
**Files this stream OWNS (EXCLUSIVE — existing module additions):** new files under `ui/screens/wallet/**` for Calendarly payments (e.g. `wallet/scheduling/PaymentsSetupScreen.kt`/`VM`, `wallet/scheduling/PayoutsEarningsScreen.kt`/`VM`) reusing existing Stripe Connect; **plus** `ui/screens/scheduling/payments/CancellationRefundPolicyScreen.kt`/`VM` for G14. Fills A0 stubs `PAYMENTS_SETUP`, `PAYOUTS`, `CANCELLATION_REFUND_POLICY`.
**Files this stream MUST NOT touch:** A0 seams + other folders. **No other stream may add files under `ui/screens/wallet/**`.** Do not modify existing wallet read screens beyond additive Calendarly views; reuse `WalletViewModel`/Connect helpers read-only where possible.
**Reuses (read-only):** existing Wallet/Stripe Connect components, `MoneyAndFlag` + `SchedulingFeatureFlags` (gate all of G6/G7 behind the paid flag), `content_detail` shell, repository payments-status call.
**Required states/behaviors:** paid flag OFF → entire surface hidden / "not enabled"; Stripe **test mode**; Connect not-connected vs connected (`charges_enabled`/`payouts_enabled`); **payout settlement deferred → processing/pending** copy; homes `applicable:false` → not-applicable state; policy editor validation.
**Acceptance checks:** common; verify `payments/status` + Connect entry + policy save on a dev business in **Stripe test mode**; targeted tests for `PaymentsSetupViewModel`/`CancellationRefundPolicyViewModel`. Re-record wallet Paparazzi snapshots if existing visuals change.

---

### Stream A15 — Packages & invoices   [Business] [v2]  (~6 screens)
**Goal:** Session packages (owner + customer) and invoices. **Paid surfaces behind the flag + Stripe test mode.**
**Screens (this stream owns):** G8 Packages List (owner) [v2]; G9 Create/Edit Package [v2]; G10 Buy Package (customer) [v2]; G11 My Packages/Credits [v2]; G12 Invoices List [v2]; G13 Invoice Detail [v2].
**Backend endpoints used:** `GET /packages` (G8 owner), `POST /packages` / `PUT /packages/:id` / `DELETE /packages/:id` (G9; soft-delete `is_active=false`), `POST /packages/:id/buy` (G10; returns `credit` + `clientSecret?` for priced — paid flag + test mode), `GET /my-packages` (G11 customer credits + nested package), `POST /bookings/:id/apply-credit` (G11 redeem; 409 `ALREADY_APPLIED`/`CREDIT_NOT_APPLICABLE`), `GET /invoices` (G12 business-only), `GET /invoices/:id` (G13), `POST /invoices/:id/send` (G13). Owner `owner_type=business` for owner-side; customer endpoints not owner-gated.
**Files this stream OWNS:** `ui/screens/scheduling/packages/**` (`PackagesListScreen.kt`/`VM`, `PackageEditorScreen.kt`/`VM`, `BuyPackageScreen.kt`/`VM`, `MyPackagesScreen.kt`/`VM`), `ui/screens/scheduling/invoices/**` (`InvoicesListScreen.kt`/`VM`, `InvoiceDetailScreen.kt`/`VM`). Fills A0 stubs `PACKAGES_LIST`, `PACKAGE_EDITOR`, `BUY_PACKAGE`, `MY_PACKAGES`, `INVOICES_LIST`, `INVOICE_DETAIL`.
**Files this stream MUST NOT touch:** A0 seams + other folders. (There is an existing `homes/packages/` for *physical* package logging and a `contentdetail/InvoiceDetailScreen` for gig invoices — **do not edit those**; Calendarly packages/invoices live in the new scheduling folders.)
**Reuses (read-only):** `ListOfRowsScreen`, `FormShell`, `content_detail` shell, `MoneyAndFlag` + `SchedulingFeatureFlags`, repository package/invoice calls.
**Required states/behaviors:** paid flag gate; owner list/empty; create/edit + soft-delete; buy → Stripe test-mode clientSecret; my-credits + remaining sessions; apply-credit 409s; invoices business-only empty; invoice send confirm.
**Acceptance checks:** common; verify package create + buy (test mode) + my-packages on a dev business; targeted tests for `PackageEditorViewModel`/`BuyPackageViewModel`/`MyPackagesViewModel`.

---

### Stream A16 — Reminders / workflows / templates   [Personal/Home/Business] [MVP+v2]  (~8 screens)
**Goal:** Automations: default reminders quick-setup, workflows list/editor, trigger picker, message template editor + variable picker + preview, and the template library.
**Screens (this stream owns):** H1 Default Reminders Quick-Setup [MVP]; H2 Workflows List [v2]; H3 Workflow Editor [v2]; H4 Trigger Picker [v2]; H5 Message Template Editor [v2]; H6 Variable Picker [v2]; H7 Message Preview [v2]; H8 Message Template Library [v2].
**Backend endpoints used:** `PUT /booking-page` `reminder_minutes[]` (H1 quick reminders), `GET /workflows` / `POST /workflows` / `PUT /workflows/:id` / `DELETE /workflows/:id` (H2/H3/H4; trigger `booking_created|cancelled|rescheduled|before_start|after_end`, action `email|push|in_app|sms`, `offset_minutes`), `GET /message-templates` / `POST /message-templates` / `PUT /message-templates/:id` / `DELETE /message-templates/:id` (H5/H8), `POST /message-templates/preview` (H7 — interpolate `{{variables}}`). H6 variable picker is client-side over the known template variable set. Owner context via `SchedulingOwner`.
**Files this stream OWNS:** `ui/screens/scheduling/automations/**` (`RemindersQuickSetupScreen.kt`/`VM`, `WorkflowsListScreen.kt`/`VM`, `WorkflowEditorScreen.kt`/`VM`, `TriggerPickerSheet.kt`, `MessageTemplateEditorScreen.kt`/`VM`, `VariablePickerSheet.kt`, `MessagePreviewScreen.kt`/`VM`, `TemplateLibraryScreen.kt`/`VM`). Fills A0 stubs `REMINDERS_QUICK_SETUP`, `WORKFLOWS_LIST`, `WORKFLOW_EDITOR`, `MESSAGE_TEMPLATE_EDITOR`, `TEMPLATE_LIBRARY`.
**Files this stream MUST NOT touch:** A0 seams + other folders.
**Reuses (read-only):** `ListOfRowsScreen`, `FormShell`, `content_detail` shell, repository workflow/template calls.
**Required states/behaviors:** empty workflows/templates; reminder minutes presets; trigger + offset config; template `{{variable}}` insert + live preview; subject required for email channel; delete confirm; per-event-type vs all (`event_type_id` null).
**Acceptance checks:** common; verify workflow create + template preview on live dev; targeted tests for `WorkflowEditorViewModel`/`MessageTemplateEditorViewModel`.

---

### Stream A17 — Insights & reports   [Business/Personal] [v2]  (~5 screens)
**Goal:** Analytics: insights dashboard, per-event-type performance, no-show & cancellation report, team performance, and the period/filter sheet.
**Screens (this stream owns):** H9 Insights Dashboard [v2]; H10 Per-Event-Type Performance [v2]; H11 No-Show & Cancellation Report [v2]; H12 Team Performance [v2]; H13 Insights Period & Filter Sheet [v2].
**Backend endpoints used:** `GET /bookings/summary` (H9 headline metrics), `GET /bookings/insights/no-shows?days` (H11; `byEventType`/`byHost`/`recent`), `GET /bookings/insights/team?days` (H12; business-only, `BUSINESS_ONLY`), `GET /bookings?status&event_type_id&from&to` (H10 per-event-type aggregation + H13 filtering). Owner context via `SchedulingOwner`.
**Files this stream OWNS:** `ui/screens/scheduling/insights/**` (`InsightsDashboardScreen.kt`/`VM`, `EventTypePerformanceScreen.kt`/`VM`, `NoShowReportScreen.kt`/`VM`, `TeamPerformanceScreen.kt`/`VM`, `InsightsFilterSheet.kt`). Fills A0 stubs `INSIGHTS_DASHBOARD`, `EVENT_TYPE_PERFORMANCE`, `NO_SHOW_REPORT`, `TEAM_PERFORMANCE`.
**Files this stream MUST NOT touch:** A0 seams + other folders.
**Reuses (read-only):** `content_detail` shell, `ListOfRowsScreen`, `filter_sheet` shell (read-only), `OwnerPillarChrome`, repository insights/summary calls.
**Required states/behaviors:** loading; empty (no data in period); period/days filter (`days` ≤365); team report **business-only gate** (`BUSINESS_ONLY` → not-applicable); no charting library beyond existing tokens (simple bars/rows).
**Acceptance checks:** common; verify summary + no-show report on a dev owner with bookings; targeted tests for `InsightsDashboardViewModel`/`NoShowReportViewModel`.

---

### Stream A18 — Cross-cutting & polish   [Personal/Home/Business] [MVP+v2]  (~2 screens + a11y cross-cut)
**Goal:** The notification/reminder permission & channel-connect prompt, and the **accessibility & large-text pass (H14)** scoped to A18's own files + a checklist for other streams. **Schedule LAST** (or scope strictly to own files) so it never collides.
**Screens (this stream owns):** H15 Notification/Reminder Permission & Channel Connect Prompt [v2]; H14 Accessibility & Large-Text pass [MVP, cross-cutting].
**Backend endpoints used:** `GET /notification-preferences` + `PUT /notification-preferences` (H15 channel prefs), reuse `POST /connected-calendars/connect` 501 messaging for the "connect" prompt where relevant, and native notification-permission request (Android 13+ `POST_NOTIFICATIONS`). H14 is non-API (audit + checklist).
**Files this stream OWNS:** `ui/screens/scheduling/polish/**` (`NotificationPermissionPromptScreen.kt`/`VM`, `A11yChecklist.kt` — a shared doc/component capturing the large-text/contrast/touch-target audit). Fills A0 stub `NOTIFICATION_PERMISSION_PROMPT`. **H14 audit:** A18 may file Foundation-gap notes for any a11y fix needed in `_shared/` components, but otherwise applies the a11y pass **only to its own files**; the H14 *checklist* is handed to every other stream to apply in-place (each stream applies it to its own files — no cross-folder edits by A18).
**Files this stream MUST NOT touch:** A0 seams + **all other stream folders** (the a11y pass on other streams' files is done *by those streams*, not by A18). A18 edits only `polish/` + flags gaps.
**Reuses (read-only):** `FormShell`, `content_detail` shell, `LocalPantopusTokens` (dynamic type), repository prefs call, existing notification-permission helpers (read-only).
**Required states/behaviors:** permission granted/denied/blocked; channel connect (501 coming-soon where applicable); large-text reflow; min 48dp touch targets; contrast against pillar accents; TalkBack content descriptions.
**Acceptance checks:** common; verify notification-permission prompt + prefs save on emulator; run Compose accessibility checks / large-font (`adb shell settings put system font_scale 1.3`) on A18 screens; targeted tests for `NotificationPermissionPromptViewModel`. Because A18 only edits `polish/`, it merges last with zero contention.

---

## 7. Coverage table — every screen mapped to exactly one stream

| Group | Screen ID | Name | MVP/v2 | Stream |
|---|---|---|---|---|
| A | A1 | Scheduling Hub | MVP | A1 |
| A | A2 | First-Run Wizard / Set Up Booking Link | MVP | A1 |
| A | A3 | Scheduling Settings Root | MVP | A1 |
| A | A4 | Notifications Preferences | MVP | A1 |
| A | A5 | Summary Card | MVP | A1 |
| A | A6 | Onboarding for Home & Business | v2 | A1 |
| B | B1 | Event Type/Service List | MVP | A2 |
| B | B2 | Event Type/Service Editor | MVP | A2 |
| B | B3 | Intake Questions Editor | v2 | A2 |
| B | B4 | Availability Schedule List | MVP | A3 |
| B | B5 | Weekly Hours Editor | MVP | A3 |
| B | B6 | Date Overrides & Holidays | v2 | A3 |
| B | B7 | Booking Limits & Notice Rules | v2 | A3 |
| B | B8 | Connected Calendars (→501) | v2 | A2 |
| B | B9 | Block off time | MVP | A3 |
| C | C1 | Booking Link/Public Page Management | MVP | A4 |
| C | C2 | Public Booking Page Preview | MVP | A4 |
| C | C3 | Share Your Link Sheet | MVP | A4 |
| C | C4 | One-off/Single-use Link Generator | MVP | A4 |
| C | C5 | Booking Landing/Booker Profile | MVP | A5 |
| C | C6 | Date+Time Slot Picker | MVP | A5 |
| C | C7 | Timezone Selector | MVP | A5 |
| C | C8 | Slot/No-Availability State | MVP | A5 |
| C | C9 | Embed Widget | WEB-ONLY | — (not on Android) |
| D | D1 | Intake/Booking Details Form | MVP | A6 |
| D | D2 | Review & Confirm/Checkout | MVP | A6 |
| D | D3 | Booking Confirmed/Thank-You | MVP | A6 |
| D | D4 | Manage Your Booking | MVP | A6 |
| D | D5 | Slot Taken/Conflict | MVP | A7 |
| D | D6 | Payment Failed/Retry | v2 | A7 |
| D | D7 | Unavailable/Expired/Paused/Secret | MVP | A7 |
| D | D8 | Add to Calendar | MVP | A7 |
| D | D9 | Open-in-App/Deep-Link Hand-off | MVP | A7 |
| D | D10 | Reschedule/Cancel Cutoff & Policy-Blocked | MVP | A7 |
| D | D11 | My Bookings (customer) | v2 | A7 |
| D | D12 | Recurring/Multi-Session Setup | v2 | A7 |
| E | E1 | Bookings Inbox | MVP | A8 |
| E | E2 | Booking Detail | MVP | A8 |
| E | E3 | Approve/Decline Sheet | MVP | A8 |
| E | E4 | Reschedule/Reassign Sheet | MVP | A8 |
| E | E5 | Cancel & Refund Sheet | MVP | A8 |
| E | E6 | Mark No-Show | v2 | A9 |
| E | E7 | Post-Meeting Follow-up | v2 | A9 |
| E | E8 | Group Event Roster & Seats | v2 | A9 |
| E | E9 | Booking Search & Filter | v2 | A9 |
| E | E10 | Double-Book Warning (host) | v2 | A9 |
| E | E11 | Send a Nudge | v2 | A9 |
| E | E12 | Manual/On-Behalf Booking | v2 | A9 |
| E | E13 | Waitlist Join & Management | v2 | A9 |
| F | F1 | Home Calendar/Agenda | MVP | A10 |
| F | F2 | Home Event Detail + RSVP | MVP | A10 |
| F | F3 | Home Add/Edit Event | MVP | A10 |
| F | F4 | Find a Time — Setup | MVP | A11 |
| F | F5 | Find a Time — Suggested Slots | MVP | A11 |
| F | F6 | Find a Time — Member Poll Response | v2 | A11 |
| F | F7 | Who's Free — Household Availability | v2 | A11 |
| F | F8 | My Household Availability Settings | MVP | A10 |
| F | F9 | Bookable Home Resources — List | v2 | A12 |
| F | F10 | Resource Editor | v2 | A12 |
| F | F11 | Resource Detail/Booking Calendar | v2 | A12 |
| F | F12 | Book a Resource | v2 | A12 |
| F | F13 | Schedule a Visit — Setup | v2 | A12 |
| F | F14 | Visit Detail | v2 | A12 |
| F | F15 | Permission-Gated Scheduler View | MVP | A10 |
| G | G1 | Round-Robin Assignment Sheet | v2 | A13 |
| G | G2 | Collective Event Setup | v2 | A13 |
| G | G3 | Team Booking Availability | MVP | A13 |
| G | G4 | Member Working-Hours Editor | v2 | A13 |
| G | G5 | Business Scheduling Settings | MVP | A13 |
| G | G6 | Payments Setup/Stripe Connect & Tax | MVP | A14 |
| G | G7 | Payouts & Earnings | MVP | A14 |
| G | G8 | Packages List (owner) | v2 | A15 |
| G | G9 | Create/Edit Package | v2 | A15 |
| G | G10 | Buy Package (customer) | v2 | A15 |
| G | G11 | My Packages/Credits | v2 | A15 |
| G | G12 | Invoices List | v2 | A15 |
| G | G13 | Invoice Detail | v2 | A15 |
| G | G14 | Cancellation & Refund Policy | MVP | A14 |
| H | H1 | Default Reminders Quick-Setup | MVP | A16 |
| H | H2 | Workflows List | v2 | A16 |
| H | H3 | Workflow Editor | v2 | A16 |
| H | H4 | Trigger Picker | v2 | A16 |
| H | H5 | Message Template Editor | v2 | A16 |
| H | H6 | Variable Picker | v2 | A16 |
| H | H7 | Message Preview | v2 | A16 |
| H | H8 | Message Template Library | v2 | A16 |
| H | H9 | Insights Dashboard | v2 | A17 |
| H | H10 | Per-Event-Type Performance | v2 | A17 |
| H | H11 | No-Show & Cancellation Report | v2 | A17 |
| H | H12 | Team Performance | v2 | A17 |
| H | H13 | Insights Period & Filter Sheet | v2 | A17 |
| H | H14 | Accessibility & Large-Text pass | MVP (cross-cut) | A18 |
| H | H15 | Notification/Reminder Permission & Channel Connect | v2 | A18 |
| H | H16 | Booking-Link/Page Empty & Zero-State | MVP | A4 |

**Totals:** 94 canonical screens; `C9` is web-only → **93 built on Android**, each in exactly one stream. Stream screen counts: A1=6, A2=4, A3=5, A4=5, A5=4, A6=4, A7=8, A8=5, A9=8, A10=5, A11=4, A12=6, A13=5, A14=3, A15=6, A16=8, A17=5, A18=2 → **93**.

---

## 8. Dependency / wave diagram & execution order

```
                       ┌──────────────────────────────────────────────┐
                       │  A0  FOUNDATION  (serial gate — merge FIRST)   │
                       │  contract+DTOs+repo+owner+409 decoder, DI,     │
                       │  NavHost route stubs, Me tiles, _shared/, flag │
                       └───────────────────────┬──────────────────────┘
                                               │  (only dependency edge in the plan)
        ┌──────────────┬───────────────┬───────┴───────┬───────────────┬──────────────┐
        ▼              ▼               ▼               ▼               ▼              ▼
  WAVE 1 (MVP backbone — start together, merge in any order)
   A1 Hub/Setup   A2 EventTypes   A3 Availability   A4 Page/Share   A5 Discovery   A6 Confirm/Manage
        │                                                                                  │
        └─────── A8 Inbox/Core ────── A10 HomeCalendar(excl) ────── A13 BizConfig ──── A14 Payments(excl)
                                                                                          
  WAVE 2 (v2 / depth — also only depend on A0; can run concurrently with Wave 1)
   A7 InviteeEdge   A9 BookingsExtras   A11 FindATime   A12 Resources/Visits
   A15 Packages/Invoices   A16 Automations   A17 Insights

  WAVE 3 (polish — schedule LAST; edits only polish/ so still conflict-free)
   A18 Cross-cutting & a11y
```

- **Every feature stream depends on A0 only.** The "waves" are a *recommended scheduling order by value/risk*, **not** hard dependencies — all 18 can technically run the moment A0 is on `master`, and all 18 merge to `master` in any order without conflict because their file sets are disjoint.
- **Recommended order:** (1) A0 → merge. (2) MVP backbone: A1, A2, A3, A4, A5, A6, A8, A10, A13, A14. (3) v2 depth: A7, A9, A11, A12, A15, A16, A17. (4) A18 last.
- **Exclusive-owner streams** (A10 home calendar, A14 wallet) have no extra ordering constraint — they are simply the only editors of their existing files.
- **Inter-stream links are by route, not by code:** e.g. A10's `source:'booking'` row → A8's `BOOKING_DETAIL` route; A5's slot → A6's intake step; A6's manage → A7's add-to-calendar/policy screens. Because every top-level route already exists in the A0-merged `RootTabScreen.kt`, these cross-links compile without any stream editing another's files.
