# Calendarly — Web Work-Stream Specification (Next.js App Router)

> **Platform:** Web — `frontend/apps/web` (Next.js App Router, TypeScript, Tailwind + CSS-var design tokens).
> **Backend:** feature-complete on `feature/calendarly` (migrations 159–165, ~70+ endpoints in [`reference/calendarly-backend-api.md`](../calendarly-backend-api.md)). Frontend is **greenfield** for scheduling.
> **Streams:** 1 Foundation gate (**W0**) + **18 fully-parallel feature streams** (**W1–W18**) covering all **93 web-buildable screens** (92 cross-platform + **C9 Embed Widget**, web-only).
> **Parallel-merge guarantee:** Foundation merges first (serial gate). After that, every feature stream edits a **disjoint set of files** (its own route folder + components), so all 18 PRs merge to `master` **in any order with zero conflicts**. Two streams (W10 Home calendar, W14 Payments/Wallet) touch a small number of existing files *outside* the scheduling tree — each is the **sole/exclusive owner** of those files, so there is still no contention.

This doc is the single source of truth handed to ~19 independent agents. It was authored against the **real repo layout** (paths verified via Read/Grep on `feature/calendarly`).

---

## 1. Overview

Calendarly is a Cal.com/Calendly-style booking layer riding on **one owner-polymorphic backend engine** with three identity pillars:

- **Personal** (sky `#0284C7`, token `app-personal` / `app-personal-bg`) — omit owner fields; signed-in user.
- **Home** (green `#16A34A`, token `app-home` / `app-home-bg`) — call the `/api/homes/:homeId/scheduling/*` alias.
- **Business** (violet `#7C3AED`, token `app-business` / `app-business-bg`) — pass `owner_type:'business'` + `owner_id:<business_user_id>`.

The web app's killer advantage is **file-based routing**: adding a route folder/`page.tsx` is inherently conflict-free — there is **no shared router file**. The only files more than one stream would ever touch are the **contract layer + lib helpers + shared components**, all owned by **W0 Foundation**. Foundation ships first; then the 18 feature streams build in parallel inside disjoint folders.

Public booking lives at new routes under `src/app/book/*` and `src/app/booking/*` (both **outside** the `(app)` auth group — public, like `src/app/support-trains/*`). Host management lives under `src/app/(app)/app/scheduling/*` (the new scheduling home) with two exclusive-owner extensions into the existing **Home calendar** (`(app)/app/homes/[id]/calendar`) and **Payments/Wallet** (`(app)/app/settings/payments`, `(app)/app/wallet`) modules.

---

## 2. How to use this doc

1. **One stream → one agent.** The operator copies a single stream section (W0, or any of W1–W18) **plus the relevant screen designs** from `~/Downloads/calendarly-design-prompt-suite.md` (pasted at build time) into a fresh agent. That agent builds **only** that stream.
2. **Foundation first.** W0 must be merged to `master` before any feature-stream agent starts — it provides the contract types, API namespaces, `fetchPublicBooking`, the feature flag, the shared components, and the route skeletons every feature stream imports.
3. **Each feature section is self-contained.** An agent reading only its section + the pasted designs knows exactly: what to build, which endpoints to call (with owner-context handling), which files it OWNS vs MUST NOT TOUCH, which states to handle, and the acceptance checks.
4. **The screen designs are the visual spec.** This doc gives IDs + names + behavior/wiring + file ownership. The pasted Claude Design prompt gives pixels. Build to both.

---

## 3. Conflict-safety architecture (web)

### The shared seams (the ONLY multi-writer files — all owned by W0 Foundation)
1. `frontend/packages/types/src/scheduling.ts` (+ barrel re-export in `frontend/packages/types/src/index.ts`).
2. `frontend/packages/api/src/endpoints/scheduling.ts` and `…/endpoints/publicBooking.ts` (+ namespace export in `frontend/packages/api/src/index.ts`).
3. `frontend/packages/utils/src/index.ts` — add `buildBookingPagePath/Url`, `buildBookingManagePath/Url`, `buildOneOffBookingPath`, `buildBookingPageAppUrl` (mirroring `buildSupportTrain*`).
4. `frontend/apps/web/src/lib/publicShare.ts` — add `fetchPublicBooking`, `fetchPublicOneOff`, `fetchPublicBookingByToken`, `fetchPublicPoll`.
5. `frontend/apps/web/src/lib/featureFlags.ts` — add the `schedulingPaid` flag (Stripe TEST mode gate).
6. `frontend/apps/web/src/components/scheduling/**` — the shared component library (SlotPicker, status pills, state views, AddToCalendar, ShareLink, CancellationPolicy, TimezoneSelector, SchedulingOwner helper, etc.).

### Why Foundation must go first
Every feature stream **imports** from items 1–6. If two feature streams each tried to add their own `scheduling.ts` type or a new namespace export to the API barrel, they'd collide on the same files. By forcing all shared-seam edits into W0 and merging it first, the feature streams only ever *consume* (read-only) those files — never edit them.

### The disjoint-ownership guarantee
After W0, each feature stream owns a **distinct directory** (a route folder under `src/app/book/*`, `src/app/booking/*`, or `src/app/(app)/app/scheduling/<area>/*`) plus its own components subfolder under `src/components/scheduling/<area>/*`. No two feature streams share a file. Because Next routing is file-based, adding `src/app/(app)/app/scheduling/event-types/page.tsx` (W2) and `src/app/(app)/app/scheduling/availability/page.tsx` (W3) are independent file creations — **git sees no overlap**, so the PRs merge in any order.

### The two exclusive-owner exceptions (existing files outside the scheduling tree)
- **W10 (Home calendar & RSVP)** edits the existing `(app)/app/homes/[id]/calendar/page.tsx` and adds sibling files under `(app)/app/homes/[id]/scheduling/*`. On web there is **no pre-existing web home-*scheduling* module** (home calendar today reads home tasks/bills/events via `homeProfile`, not the scheduling engine). W10 is therefore the **sole owner** of the home calendar route file and the new home-scheduling route folder. No other stream touches them.
- **W14 (Payments & payouts)** edits the existing `(app)/app/settings/payments/page.tsx` and `(app)/app/wallet/page.tsx` to add scheduling earnings/payout tabs and reuses `components/payments/StripeProvider.tsx` (read-only). W14 is the **sole owner** of any edit to those two existing pages. No other stream touches them.

Because each of these two is a *single* owner of its existing files, there is still zero contention.

### Platform-specific reasoning — why web has essentially no merge risk
- **File-based routing, no shared router.** Unlike native (which centralizes a NavHost/route enum that every feature must register against), Next.js resolves routes from the filesystem. Adding a folder *is* registering a route. There is no `routes.ts`, no `NavHost.kt`, no `*.pbxproj` to edit.
- **No DI container, no "Me" tab registry.** Web wires data per-page via `@pantopus/api` calls; there is no shared module-registration file.
- **The only shared seams are the contract packages + 2 lib files + the shared component dir** — all corralled into Foundation.

> **iOS note (for cross-platform readers / the implementation-phases doc):** On iOS, the project file (`*.pbxproj`) is **NOT tracked in git** in this repo — files are resolved via folder-sync / file-system-synchronized groups, so adding a Swift file does **not** dirty a shared pbxproj. This is a **correction** to the older `reference/calendarly-ios-implementation-phases.md`, which assumed pbxproj contention and serialized iOS streams to avoid it. With pbxproj untracked, the iOS routing seam is centralized in iOS Foundation (a route enum + pre-stubbed destinations) exactly like Android's NavHost, and iOS feature streams parallelize the same way web does. (This doc is web; the note is here only because the operator asked for it to be stated prominently.)

---

## 4. Shared RULES preamble (verbatim — include in every feature-stream brief)

> **RULES EVERY FEATURE-STREAM AGENT MUST FOLLOW**
> 1. **Only create/edit files this stream OWNS.** If you think you need to add/edit a shared seam file (contract types, endpoints/API service, utils builders, `publicShare`, `featureFlags`, a Foundation shared component), **STOP and flag it as a Foundation gap** — do not add it locally.
> 2. **Present this stream's sheets/modals/states LOCALLY** from your own parent screens (React state + a local `<Modal>`/`<BottomSheet>`); never add a global route/destination for a sheet.
> 3. **Reuse the shared shells and Foundation components**; use design-system theme tokens only (`app-personal/home/business`, `app-surface`, `app-text`, etc.) — **no hardcoded colors/spacing**.
> 4. **Honor the global wiring contract** (owner context, tz, manageToken, 409 alternatives, calendar union, paused/secret/expired/unavailable states, paid feature flag, 501 connect).
> 5. **Targeted tests only.** Verify in the browser/preview with a hosted-dev account against the live endpoint (migrations 159–165 applied). Keep test bookings/pages. Never run full suites.
> 6. **One PR per stream to `master`** (never push `master` directly). Build green + verified + screenshots vs design.

### GLOBAL WIRING CONTRACT (every stream must honor)
- **Owner context.** Personal → omit owner fields (signed-in user). Business → `owner_type:'business'` + `owner_id:<business_user_id>` (query param on GET, body field on writes). Home → call the `/api/homes/:homeId/scheduling/*` alias (no owner fields). Foundation provides a **`SchedulingOwner`** helper that injects this into every host call.
- **Timezone.** ALWAYS pass `tz` (IANA) on slot/calendar reads; render `startLocal`, store/compare UTC.
- **manageToken.** Persist the one-time `manageToken` returned by `POST /book/:slug/:eventTypeSlug` (and `POST /book/o/:token`) — it is the invitee's only handle for manage/reschedule/cancel/.ics.
- **409 alternatives.** Handle `409 { error, alternatives:[{start,end,startLocal}] }` on every booking create/reschedule (codes `SLOT_TAKEN | SLOT_UNAVAILABLE | SLOT_FULL`) — surface nearest open times via the Foundation 409-presenter, never a dead end.
- **Home calendar UNION.** Home bookings appear via `GET /api/homes/:id/events` rows tagged `source:'booking'` (+ `booking_status`). **NEVER** create `HomeCalendarEvent` rows for bookings.
- **First-class states.** `paused` / `secret` / `unavailable` / `expired` are response states, not errors (e.g. `status:'paused'`, `status:'expired'`, `status:'unavailable'`). Render the Foundation state views.
- **Paid surfaces.** Priced event types, packages, invoices, payouts sit behind `webFeatureFlags.schedulingPaid` + Stripe **TEST** mode. Payout settlement is deferred server-side — show **processing/pending**.
- **Connect 501.** `POST /connected-calendars/connect` returns **501** → show "coming soon"; read endpoints return empty.
- **Error envelope.** `{ error:'CODE', message }`; validation → `400 { error:'Validation failed', details:[{field,message}] }`. Use the Foundation typed decoder.
- **Public fetch hits the backend origin directly.** `${API_BASE}/api/public/book/:slug` (slug = the booking **PAGE** slug, NOT a booking id). One-off links: `/api/public/book/o/:token`. Manage: `/api/public/booking/:token*`. Polls: `/api/public/poll/:id`.

---

## 5. Foundation — Stream **W0** (serial gate; merges before W1–W18)

**Goal:** Ship the entire shared contract + helper + component layer so the 18 feature streams can build in parallel against stable, typed seams. No screens of its own (it builds the *parts* screens are made of) plus thin route skeletons/layouts so feature folders drop in cleanly.

**Files W0 OWNS (creates/edits — these are the shared seams; no feature stream may touch them):**

*Contract — types package*
- `frontend/packages/types/src/scheduling.ts` — **new.** Mirror `home.ts` style. Export: `SchedulingOwnerType ('user'|'business'|'home')`, `SchedulingOwnerRef`, `BookingPage`, `EventType` (+ `EventTypePricing`, `EventTypeLocation`, `IntakeQuestion`, `Assignment` round-robin/collective), `AvailabilitySchedule` (+ `WeeklyHours`, `DateOverride`, `BookingLimits`, `NoticeRules`), `AvailabilityBlock`, `NotificationPreferences`, `Booking` (+ `BookingStatus`, `BookingSource`, `Invitee`, `BookingAnswer`), `BookingSlot` (`{start,end,startLocal}`), `SlotConflict` (`{error,alternatives}`), `OneOffLink`, `PublicBookingPage`, `PublicEventType`, `Workflow`, `WorkflowTrigger`, `MessageTemplate`, `Package`, `MyPackageCredit`, `Invoice`, `InvoiceLineItem`, `PaymentsStatus`, `ConnectedCalendar`, `Resource`, `ResourceBooking`, `Visit`, `FindATime`, `WhosFree`, `Poll`, `PollOption`, `PollVote`, `TeamAvailability`, `WaitlistEntry`, `NoShowInsights`, `TeamInsights`, `HomeCalendarUnionEvent` (`source:'booking'|'event'` + `booking_status`).
- `frontend/packages/types/src/index.ts` — **edit (append only):** `export type { … } from './scheduling';` block.

*Contract — api package*
- `frontend/packages/api/src/endpoints/scheduling.ts` — **new.** Host functions wrapping `get/post/put/del` from `client.ts`, base `/api/scheduling`. Every function accepts an `owner?: SchedulingOwnerRef` and routes: home → `/api/homes/${homeId}/scheduling/...` (no owner params); business → adds `owner_type/owner_id` (query for GET via `get(url, params)`, body for writes); personal → nothing. Cover: booking-page (get/put/putSlug/checkSlug/resetSlug/disable/oneOffLinks), event-types (list/create/get/update/del/assignees/questions), availability (list/create/update/del/rules/overrides/blocks create+del), notification-preferences (get/put), workflows (list/create/update/del), message-templates (list/create/preview/update/del), payments/status, connected-calendars (get/connect→501), bookings (list/summary/get/availableSlots/create/approve/decline/cancel/reschedule/noShow/reassign/rsvp/recurring/nudge/proposeReschedule/applyCredit/insights.noShows/insights.team), invoices (list/get/send), packages (list/create/update/del/buy/myPackages), my-bookings, find-a-time, whos-free, resources (list/create/update/del/book), visits, waitlist (eventTypeWaitlist/promote), polls (create/list/get/finalize), team-availability.
- `frontend/packages/api/src/endpoints/publicBooking.ts` — **new.** Unauthed functions hitting `/api/public/*`: `getPublicPage(slug, tz)`, `getPublicSlots(slug, eventTypeSlug, {tz,from,to})`, `createPublicBooking(slug, eventTypeSlug, body)` → returns `{ booking, manageToken, clientSecret? }`, `getOneOff(token,tz)`, `createOneOffBooking(token, body)`, `getBookingByToken(token)`, `getManageSlots(token,{tz})`, `getIcs(token)` (returns URL/blob), `rescheduleByToken(token, body)`, `cancelByToken(token, body)`, `unsubscribeByToken(token)`, `joinWaitlistPublic(slug, eventTypeSlug, body)`, `acceptReschedule(token)`, `declineReschedule(token)`, `getPoll(id)`, `votePoll(id, body)`. **All 409s** return a typed `SlotConflict`.
- `frontend/packages/api/src/index.ts` — **edit (append only):** `export * as scheduling from './endpoints/scheduling';` and `export * as publicBooking from './endpoints/publicBooking';` (+ convenience type re-exports).

*Contract — utils package*
- `frontend/packages/utils/src/index.ts` — **edit (append only):** `buildBookingPagePath(slug)` → `/book/${slug}`; `buildBookingPageUrl(slug)` → `${APP_WEB_URL}/book/${slug}`; `buildBookingEventPath(slug, eventTypeSlug)`; `buildOneOffBookingPath(token)` → `/book/o/${token}`; `buildBookingManagePath(token)` → `/booking/${token}`; `buildBookingManageUrl(token)`; `buildBookingPageAppUrl(slug)` → `pantopus:///book/${slug}`; `buildBookingManageAppUrl(token)`. Mirror existing `buildSupportTrain*` exactly.

*Web lib*
- `frontend/apps/web/src/lib/publicShare.ts` — **edit (append only):** `fetchPublicBooking(slug, tz?)` → `cache()` + `fetchPublicJson('/api/public/book/'+encodeURIComponent(slug))` (mirror `fetchPublicSupportTrain`; `next:{revalidate:60}` for the page shell, but **slots fetched client-side** with no-store so availability is fresh); `fetchPublicOneOff(token)`; `fetchPublicBookingByToken(token)`; `fetchPublicPoll(id)`. Reuse existing `API_BASE`, `buildShareMetadata`, `getStoreDownloadCta`, `displayNameForUser`, `absoluteMediaUrl`.
- `frontend/apps/web/src/lib/featureFlags.ts` — **edit (append only):** add `schedulingPaid = enabled(process.env.NEXT_PUBLIC_SCHEDULING_PAID_ENABLED, defaultEnabled)` to the `webFeatureFlags` object (default ON in non-prod, OFF in prod, like the identity flags). Optionally also `scheduling` master flag.

*Shared component library — `frontend/apps/web/src/components/scheduling/**` (W0 owns the whole tree's shared pieces; feature streams add their own subfolders elsewhere):*
- `components/scheduling/SchedulingOwnerProvider.tsx` + `useSchedulingOwner()` — resolves the active pillar (personal/home/business) from route/context and yields the `SchedulingOwnerRef` to pass to `@pantopus/api` calls. (Reads existing `ProfileToggle`/identity context conventions.)
- `components/scheduling/SlotPicker.tsx` — the canonical date-strip + tz time-of-day grid; props `{ slug?, eventTypeSlug?, ownerRef?, manageToken?, onPick }`; internally fetches slots (client, no-store), shows loading skeleton, **empty/"no availability — try a wider range"** state, and a `tz` label. Used by both public and host flows.
- `components/scheduling/SlotConflictAlternatives.tsx` — the **409-presenter**: given `SlotConflict.alternatives`, renders nearest open times as one-tap re-picks.
- `components/scheduling/TimezoneSelector.tsx` — IANA picker (defaults to `Intl.DateTimeFormat().resolvedOptions().timeZone`), emits the chosen tz upward.
- `components/scheduling/BookingStatusPill.tsx` — status pills (pending/confirmed/declined/cancelled/no_show/rescheduled/paused/secret/expired/unavailable) using pillar + semantic tokens.
- `components/scheduling/states/PausedView.tsx`, `SecretView.tsx`, `ExpiredView.tsx`, `UnavailableView.tsx`, `NoAvailabilityView.tsx` — first-class state screens (reuse `ui/EmptyState`, `ui/ErrorState`).
- `components/scheduling/AddToCalendar.tsx` — Google/Outlook/Apple links + **.ics download** (host: build inline; public manage: `getIcs(token)`).
- `components/scheduling/ShareLink.tsx` — copy/QR/share-sheet for a booking-page or one-off URL (mirror `public-share` patterns).
- `components/scheduling/CancellationPolicy.tsx` — renders a policy object (cutoff window, refund rule) read-only; used in confirm/manage.
- `components/scheduling/PillarThemeProvider.tsx` (or a `pillarTokens(ownerType)` util) — maps owner pillar → `app-personal/home/business` token set so every stream themes consistently.
- `components/scheduling/decodeError.ts` — typed decoder for `{ error, message }` / `400 { error:'Validation failed', details }` / `409 SlotConflict`; returns a discriminated union the streams switch on.
- `components/scheduling/index.ts` — barrel re-export of all of the above.

*Route skeletons / layouts (thin shells feature folders extend; W0 creates the empty shells + nav):*
- `frontend/apps/web/src/app/(app)/app/scheduling/layout.tsx` — host scheduling shell using the existing `AppShell`/`PageHeader`. **Pre-include left-nav links for EVERY feature-stream area so each section is reachable once it merges** (before merge they 404, expected during parallel build): Hub, Event Types, Availability, Booking Page, Bookings, Bookings·Search, Waitlist, Business, Payments, Packages, Invoices, My Bookings, My Packages, Reminders, Workflows, Templates, Insights, Connected Calendars, Channels. **Only the layout + nav links** — each section's `page.tsx` is owned by its feature stream.
- `frontend/apps/web/src/app/(app)/app/scheduling/page.tsx` — **W1 owns this** (Hub). W0 leaves it absent; W1 creates it. (W0 only ships `layout.tsx`.)
- `frontend/apps/web/src/app/book/layout.tsx` and `frontend/apps/web/src/app/booking/layout.tsx` — minimal public layouts (no `(app)` chrome), mirroring `support-trains` standalone styling.

**Seam edits (the only "shared" git touches; all in W0):** the four package barrels (`types/index.ts`, `api/index.ts`, `utils/src/index.ts`) + `publicShare.ts` + `featureFlags.ts`. After W0 merges, these are frozen for the scheduling work; feature streams import only.

**Required states/behaviors W0 must encode in shared components:** loading skeletons, empty/zero, typed error decode, 409-alternatives, paused/secret/expired/unavailable, tz default + render-local/store-UTC, manageToken persistence helper (e.g. `localStorage` keyed by booking-page slug, returned to caller), the paid feature flag gate, the 501 "coming soon" affordance.

**Acceptance checks (DoD):**
- `pnpm --filter @pantopus/types build && pnpm --filter @pantopus/api build && pnpm --filter @pantopus/utils build` green; `pnpm --filter @pantopus/web typecheck` green.
- A throwaway smoke page can import `scheduling`/`publicBooking` namespaces and render `SlotPicker` against a hosted-dev booking page (migrations 159–165 applied) showing real slots in the local tz.
- `SchedulingOwner` helper verified producing correct params for all three pillars (unit test on the param-builder only).
- Lints/format pass; targeted tests for the param-builder + `decodeError` only.

**Branch & PR:** `claude/calendarly-web-w0-foundation` ; one PR; must merge **before** any feature stream.

**Depends on:** nothing (it is the gate).

---

## 6. Feature streams W1–W18

> Each section is self-contained. All depend on **W0 only**. All follow the shared RULES preamble and GLOBAL WIRING CONTRACT in §4. "Owner context" below names which pillars the screens serve and therefore which `SchedulingOwner` mode the agent passes.

---

### Stream W1 — Setup & Hub   [host config] [MVP-heavy]  (~6 screen-equivalents)
**Goal:** The host's scheduling home — landing hub, first-run wizard to claim a booking link, settings root, notification prefs, and a reusable summary card; plus the Home/Business onboarding variant.
**Screens (this stream owns):** A1 Scheduling Hub[MVP]; A2 First-Run Wizard / Set Up Booking Link[MVP]; A3 Scheduling Settings Root[MVP]; A4 Notifications Preferences[MVP]; A5 Summary Card[MVP] (reusable summary widget); A6 Onboarding for Home & Business[v2].
**Backend endpoints used:** `GET/PUT /booking-page`, `GET /booking-page/check-slug`, `PUT /booking-page/slug`, `POST /booking-page/reset-slug`, `POST /booking-page/disable`, `GET/PUT /notification-preferences`, `GET /bookings/summary` (for A5). All host calls go through `SchedulingOwner` (personal default; business adds `owner_type/owner_id`; home → `/api/homes/:homeId/scheduling/*`).
**Files this stream OWNS:**
- `src/app/(app)/app/scheduling/page.tsx` (A1 Hub — the section index W0 left for W1)
- `src/app/(app)/app/scheduling/setup/page.tsx` (A2 wizard) and `src/app/(app)/app/scheduling/setup/onboarding/page.tsx` (A6)
- `src/app/(app)/app/scheduling/settings/page.tsx` (A3 root) and `src/app/(app)/app/scheduling/settings/notifications/page.tsx` (A4)
- `src/components/scheduling/hub/**` (HubCards, SetupWizardSteps, SlugClaimField, NotificationPrefsForm, SchedulingSummaryCard [A5])
**Files this stream MUST NOT touch:** any shared seam (§3 list); other streams' `scheduling/<area>` folders.
**Reuses (read-only):** W0 `SchedulingOwnerProvider`, `ShareLink`, `decodeError`, `BookingStatusPill`, `PillarThemeProvider`; existing `AppShell`, `PageHeader`, `ui/*`.
**Required states/behaviors:** slug live-check debounce + taken/available; loading/empty hub when no page yet (CTA → wizard); disable/re-enable page; pillar theming by active owner; A5 reused as a pure component (other streams may import it read-only).
**Acceptance checks:** `pnpm --filter @pantopus/web build && pnpm --filter @pantopus/web typecheck` green; verify in browser/preview against hosted-dev for all three pillars; targeted tests for the slug-check + notification-prefs form logic only; screenshots vs design; lint/format pass.
**Branch & PR:** `claude/calendarly-web-w1-setup-hub`.
**Depends on:** Web Foundation only.

---

### Stream W2 — Event Types   [host config] [MVP+v2]  (~4 screen-equivalents)
**Goal:** Create/list/edit bookable event types/services, configure intake questions, and surface the Connected-Calendars (501 "coming soon") screen.
**Screens (this stream owns):** B1 Event Type/Service List[MVP]; B2 Event Type/Service Editor[MVP]; B3 Intake Questions Editor[v2]; B8 Connected Calendars[v2 →501].
**Backend endpoints used:** `GET/POST /event-types`, `GET/PUT/DELETE /event-types/:id`, `PUT /event-types/:id/assignees`, `PUT /event-types/:id/questions`, `GET /connected-calendars`, `POST /connected-calendars/connect` (→501). Pricing fields gated by `webFeatureFlags.schedulingPaid`. `SchedulingOwner` for all calls.
**Files this stream OWNS:**
- `src/app/(app)/app/scheduling/event-types/page.tsx` (B1)
- `src/app/(app)/app/scheduling/event-types/[id]/page.tsx` (B2 editor; `new` handled via `[id]==='new'` or a `/new` route)
- `src/app/(app)/app/scheduling/event-types/[id]/questions/page.tsx` (B3) — or a local tab in B2
- `src/app/(app)/app/scheduling/connected-calendars/page.tsx` (B8)
- `src/components/scheduling/event-types/**` (EventTypeCard, EventTypeForm, PricingFields[flag], LocationField, IntakeQuestionsEditor, ConnectComingSoon)
**Files this stream MUST NOT touch:** shared seams; availability/booking-page folders (W3/W4).
**Reuses (read-only):** W0 `SchedulingOwnerProvider`, `decodeError`, `CancellationPolicy`, `PillarThemeProvider`; `ui/*`.
**Required states/behaviors:** PUT = partial update (don't clobber omitted fields); priced fields hidden unless `schedulingPaid`; 501 connect → "coming soon" card, read list empty; validation `400 details` mapped to field errors; pillar theming.
**Acceptance checks:** web build + typecheck green; verify CRUD against hosted-dev (personal + business owner); targeted tests for EventTypeForm validation mapping; screenshots; lint/format.
**Branch & PR:** `claude/calendarly-web-w2-event-types`.
**Depends on:** Web Foundation only.

---

### Stream W3 — Availability   [host config] [MVP+v2]  (~5 screen-equivalents)
**Goal:** Manage availability schedules, weekly hours, date overrides/holidays, booking limits/notice rules, and block-off-time.
**Screens (this stream owns):** B4 Availability Schedule List[MVP]; B5 Weekly Hours Editor[MVP]; B6 Date Overrides & Holidays[v2]; B7 Booking Limits & Notice Rules[v2]; B9 Block off time[MVP].
**Backend endpoints used:** `GET/POST /availability`, `PUT/DELETE /availability/:id`, `PUT /availability/:id/rules`, `PUT /availability/:id/overrides`, `POST /availability/blocks`, `DELETE /availability/blocks/:blockId`. `SchedulingOwner` for all.
**Files this stream OWNS:**
- `src/app/(app)/app/scheduling/availability/page.tsx` (B4)
- `src/app/(app)/app/scheduling/availability/[id]/page.tsx` (B5 weekly hours; tabs/local sections for B6 overrides + B7 limits)
- `src/app/(app)/app/scheduling/availability/blocks/page.tsx` (B9 block-off-time)
- `src/components/scheduling/availability/**` (ScheduleList, WeeklyHoursGrid, DateOverrideEditor, BookingLimitsForm, NoticeRulesForm, BlockOffForm)
**Files this stream MUST NOT touch:** shared seams; event-types folder (W2).
**Reuses (read-only):** W0 `TimezoneSelector`, `decodeError`, `PillarThemeProvider`; `ui/*`.
**Required states/behaviors:** tz-aware hours (store UTC offsets per backend contract, render in schedule tz); PUT partial-update semantics for rules/overrides; block create/delete optimistic-then-refetch; loading/empty (no schedule yet → CTA create); validation field mapping.
**Acceptance checks:** web build + typecheck green; verify against hosted-dev (personal + business); targeted tests for WeeklyHoursGrid serialization; screenshots; lint/format.
**Branch & PR:** `claude/calendarly-web-w3-availability`.
**Depends on:** Web Foundation only.

---

### Stream W4 — Booking page, sharing & embed   [host config + public] [MVP]  (~5 screen-equivalents)
**Goal:** Manage the public booking page, preview it, share the link, generate one-off single-use links, define the page empty/zero state, and ship the **web-only embed widget**.
**Screens (this stream owns):** C1 Booking Link/Public Page Management[MVP]; C2 Public Booking Page Preview[MVP]; C3 Share Your Link Sheet[MVP]; C4 One-off/Single-use Link Generator[MVP]; H16 Booking-Link/Page Empty & Zero-State[MVP]; **C9 Embed Widget[WEB-ONLY]**.
**Backend endpoints used:** `GET/PUT /booking-page`, `PUT /booking-page/slug`, `GET /booking-page/check-slug`, `POST /booking-page/reset-slug`, `POST /booking-page/disable`, `POST /booking-page/one-off-links`, plus public read `GET /api/public/book/:slug` (preview). `SchedulingOwner` for host calls.
**Files this stream OWNS:**
- `src/app/(app)/app/scheduling/booking-page/page.tsx` (C1 management + H16 empty state)
- `src/app/(app)/app/scheduling/booking-page/preview/page.tsx` (C2; or render preview in-page)
- `src/app/(app)/app/scheduling/booking-page/one-off/page.tsx` (C4)
- `src/app/(app)/app/scheduling/booking-page/embed/page.tsx` (C9 embed config + copyable snippet)
- `src/app/book/[slug]/embed/page.tsx` — the **embeddable iframe target** the snippet points at
- `src/app/book/[slug]/embed/layout.tsx` — **W4-owned bare layout** (no header/footer/app chrome — just `html/body`) so the iframe target renders zero chrome regardless of `book/layout.tsx`. The embed must not inherit any standalone-page wrapper.
- `src/components/scheduling/booking-page/**` (PageManager, PagePreview, OneOffGenerator, EmbedSnippetBuilder, EmptyZeroState [H16])
**Files this stream MUST NOT touch:** shared seams; the public booking flow folders `src/app/book/[slug]/page.tsx`, `…/[eventType]`, `src/app/book/o/[token]` (those are W5/W6/W7 — W4 only owns the `embed` subroute under `book/[slug]`); ShareLink lives in W0 (reuse, don't fork).
**Reuses (read-only):** W0 `ShareLink`, `PausedView`, `SlotPicker` (for preview), `decodeError`, `PillarThemeProvider`; `public-share/OpenInAppButton`.
**Required states/behaviors:** slug edit + check + reset; disable/paused (PausedView); H16 zero-state when page never set up; one-off token display + copy + persist; **embed**: build `<script>`/`<iframe>` snippet pointing at `/book/[slug]/embed`, support theme/owner params; preview must reflect paused/secret/visibility states.
**Acceptance checks:** web build + typecheck green; verify management + one-off generation against hosted-dev; load the embed route in an isolated iframe and confirm a booking can start; screenshots; lint/format.
**Branch & PR:** `claude/calendarly-web-w4-booking-page-embed`.
**Depends on:** Web Foundation only.

---

### Stream W5 — Invitee discovery (public)   [public] [MVP]  (~4 screen-equivalents)
**Goal:** The public booker's discovery surface — landing/booker profile, the date+time slot picker, timezone selection, and the no-availability state.
**Screens (this stream owns):** C5 Booking Landing/Booker Profile[MVP]; C6 Date+Time Slot Picker[MVP]; C7 Timezone Selector[MVP]; C8 Slot/No-Availability State[MVP].
**Backend endpoints used:** `GET /api/public/book/:slug` (page + event-type list; via `fetchPublicBooking` server-side for SEO + metadata), `GET /api/public/book/:slug/:eventTypeSlug/slots?tz=&from=&to=` (client-side, no-store). **No auth.** Slug = the booking PAGE slug.
**Files this stream OWNS:**
- `src/app/book/[slug]/page.tsx` (C5 landing — server component + `generateMetadata`, mirroring `support-trains/[id]/page.tsx`)
- `src/app/book/[slug]/[eventType]/page.tsx` (C6 slot picker for a chosen event type)
- `src/components/scheduling/public/discovery/**` (BookerProfileHeader, EventTypeMenu, PublicSlotPicker wrapper [wraps W0 `SlotPicker`], TimezoneBar [wraps W0 `TimezoneSelector` for C7], NoAvailabilityState [wraps W0 `NoAvailabilityView` for C8])
**Files this stream MUST NOT touch:** shared seams; `book/[slug]/embed` (W4); `book/o/[token]` (W7); the confirm/checkout routes (W6); `publicShare.ts` (reuse `fetchPublicBooking`, don't edit).
**Reuses (read-only):** W0 `SlotPicker`, `TimezoneSelector`, `NoAvailabilityView`, `PausedView`/`SecretView`/`ExpiredView`/`UnavailableView`, `PillarThemeProvider`; `publicShare.fetchPublicBooking`, `getStoreDownloadCta`, `OpenInAppButton`.
**Required states/behaviors:** tz default from browser, user-overridable (C7) and threaded into slot reads; render `startLocal`; loading skeleton; C8 empty/no-availability with "try a wider range"; paused/secret/expired/unavailable page states; pillar theming from page owner; deep-link/Open-in-App affordance.
**Acceptance checks:** web build + typecheck green; verify against a hosted-dev public page (free event type) across two timezones; lighthouse/SEO check that `generateMetadata` resolves; screenshots; lint/format.
**Branch & PR:** `claude/calendarly-web-w5-invitee-discovery`.
**Depends on:** Web Foundation only.

---

### Stream W6 — Invitee confirm & manage (public)   [public] [MVP]  (~4 screen-equivalents)
**Goal:** The booking commit path — intake form, review/confirm (with paid checkout behind the flag), thank-you, and manage-your-booking.
**Screens (this stream owns):** D1 Intake/Booking Details Form[MVP]; D2 Review & Confirm/Checkout[MVP]; D3 Booking Confirmed/Thank-You[MVP]; D4 Manage Your Booking[MVP].
**Backend endpoints used:** `POST /api/public/book/:slug/:eventTypeSlug` (create → `{ booking, manageToken, clientSecret? }`), `GET /api/public/booking/:token` (manage view), `GET /api/public/booking/:token/available-slots?tz=` (read for D4 context). Paid path uses `clientSecret` + `StripeProvider` behind `schedulingPaid`.
**Files this stream OWNS:**
- `src/app/book/[slug]/[eventType]/confirm/page.tsx` (D1 + D2; intake → review → submit). May also live as a step within the eventType route — but the **route file is W6's**, distinct from W5's `[eventType]/page.tsx`. To avoid co-owning `[eventType]/page.tsx`, **W6 owns `[eventType]/confirm/**` only**; W5 owns `[eventType]/page.tsx`.
- `src/app/booking/[token]/page.tsx` (D4 Manage) and `src/app/booking/[token]/confirmed/page.tsx` (D3 Thank-You) — or D3 as a client state after POST; the **route file is W6's**.
- `src/components/scheduling/public/confirm/**` (IntakeForm, ReviewSummary, CheckoutPanel[flag, wraps StripeProvider], ConfirmedCard, ManageBookingPanel)
**Files this stream MUST NOT touch:** shared seams; W5's `[eventType]/page.tsx` and `book/[slug]/page.tsx`; W7's edge/cutoff/one-off routes; `StripeProvider.tsx` (reuse read-only).
**Reuses (read-only):** W0 `SlotConflictAlternatives`, `AddToCalendar`, `CancellationPolicy`, `BookingStatusPill`, `decodeError`, `PillarThemeProvider`; `components/payments/StripeProvider`; `publicBooking.*`.
**Required states/behaviors:** **persist `manageToken`** (W0 helper, keyed by booking-page slug) on success; **409 alternatives** on create (SlotConflictAlternatives → re-pick); validation `400 details` → field errors; paid → confirm Stripe payment (TEST) before/with create, show processing if payout deferred; D3 offers AddToCalendar + manage link; D4 shows status pill + policy + reschedule/cancel entry points (the actual reschedule/cancel cutoff logic is D10/W7 — D4 links to it).
**Acceptance checks:** web build + typecheck green; verify a **free** booking end-to-end against hosted-dev (create → token persisted → manage loads → .ics); verify a **paid TEST** booking with `schedulingPaid` on; screenshots; targeted tests for IntakeForm validation + manageToken persistence; lint/format.
**Branch & PR:** `claude/calendarly-web-w6-invitee-confirm-manage`.
**Depends on:** Web Foundation only.

---

### Stream W7 — Invitee edge & customer   [public] [MVP+v2]  (~8 screen-equivalents)
**Goal:** Every non-happy-path invitee surface + customer-side booking management: conflicts, payment retry, paused/secret/expired/unavailable, add-to-calendar, open-in-app, reschedule/cancel cutoff, my-bookings, recurring setup.
**Screens (this stream owns):** D5 Slot Taken/Conflict[MVP]; D6 Payment Failed/Retry[v2]; D7 Unavailable/Expired/Paused/Secret[MVP]; D8 Add to Calendar[MVP]; D9 Open-in-App/Deep-Link Hand-off[MVP, web = OpenInApp button]; D10 Reschedule/Cancel Cutoff & Policy-Blocked[MVP]; D11 My Bookings (customer)[v2]; D12 Recurring/Multi-Session Setup[v2].
**Backend endpoints used:** `POST /api/public/booking/:token/reschedule`, `POST /api/public/booking/:token/cancel`, `GET /api/public/booking/:token/available-slots?tz=`, `GET /api/public/booking/:token/ics`, `POST /api/public/booking/:token/unsubscribe`, `POST /api/public/booking/:token/accept-reschedule`, `POST /api/public/booking/:token/decline-reschedule`, `POST /api/public/book/:slug/:eventTypeSlug/waitlist` (if reached from edge), `GET /api/public/book/o/:token` + `POST /api/public/book/o/:token` (one-off), `GET /scheduling/my-bookings` (D11, authed customer), `POST /scheduling/bookings/recurring` (D12, authed). One-off public read via `fetchPublicOneOff`.
**Files this stream OWNS:**
- `src/app/book/o/[token]/page.tsx` (one-off single-use link landing → reuses W0 SlotPicker; D5/D7 states surface here too)
- `src/app/booking/[token]/reschedule/page.tsx` (D10 reschedule + cutoff/policy-blocked) and `src/app/booking/[token]/cancel/page.tsx` (D10 cancel)
- `src/app/booking/[token]/states/page.tsx` (D5/D7 conflict/paused/secret/expired/unavailable presenter) — or render via components from the manage route's children owned here
- `src/app/(app)/app/scheduling/my-bookings/page.tsx` (D11 customer) and `src/app/(app)/app/scheduling/my-bookings/recurring/page.tsx` (D12)
- `src/components/scheduling/public/edge/**` (ConflictView[D5], PaymentRetryPanel[D6, flag], StateRouter[D7], AddToCalendarPanel[D8 wraps W0 AddToCalendar], OpenInAppHandoff[D9], CutoffPolicyBlocked[D10], MyBookingsList[D11], RecurringSetup[D12])
**Files this stream MUST NOT touch:** shared seams; W6's `booking/[token]/page.tsx` + `…/confirmed`, W6's `[eventType]/confirm/*`; W5's discovery routes.
**Reuses (read-only):** W0 `SlotConflictAlternatives`, `AddToCalendar`, `CancellationPolicy`, all `states/*` views, `BookingStatusPill`, `decodeError`; `public-share/OpenInAppButton`; `buildBookingManageAppUrl`/`buildBookingPageAppUrl` (utils); `StripeProvider` (D6).
**Required states/behaviors:** D5 surfaces 409 alternatives; D7 renders the 4 first-class states; D10 enforces **cutoff/policy-blocked** (disable reschedule/cancel past cutoff, show policy); D6 retries the Stripe PaymentIntent (TEST) under `schedulingPaid`; D9 web = OpenInApp button + store fallback (no native interstitial); D11/D12 authed via `SchedulingOwner` (personal customer); tz throughout; reuse persisted manageToken for token-scoped routes.
**Acceptance checks:** web build + typecheck green; verify reschedule + cancel + .ics + one-off + a paused/expired page against hosted-dev; verify D11 lists the customer's bookings; screenshots; targeted tests for cutoff logic; lint/format.
**Branch & PR:** `claude/calendarly-web-w7-invitee-edge-customer`.
**Depends on:** Web Foundation only.

---

### Stream W8 — Bookings inbox & core   [host lifecycle] [MVP]  (~5 screen-equivalents)
**Goal:** The host's bookings inbox + detail + the core lifecycle actions: approve/decline, reschedule/reassign, cancel & refund.
**Screens (this stream owns):** E1 Bookings Inbox[MVP]; E2 Booking Detail[MVP]; E3 Approve/Decline Sheet[MVP]; E4 Reschedule/Reassign Sheet[MVP]; E5 Cancel & Refund Sheet[MVP].
**Backend endpoints used:** `GET /bookings`, `GET /bookings/summary`, `GET /bookings/:id`, `GET /bookings/:id/available-slots?tz=`, `POST /bookings/:id/approve`, `POST /bookings/:id/decline`, `POST /bookings/:id/reschedule`, `POST /bookings/:id/reassign`, `POST /bookings/:id/cancel`. Refund on cancel under `schedulingPaid`. `SchedulingOwner` for all (host inbox per pillar).
**Files this stream OWNS:**
- `src/app/(app)/app/scheduling/bookings/page.tsx` (E1 inbox)
- `src/app/(app)/app/scheduling/bookings/[id]/page.tsx` (E2 detail; E3/E4/E5 are **local sheets** opened from here)
- `src/components/scheduling/bookings/**` (BookingsInbox, BookingRow, BookingDetail, ApproveDeclineSheet, RescheduleReassignSheet, CancelRefundSheet)
**Files this stream MUST NOT touch:** shared seams; W9's bookings-extras files; public booking routes.
**Reuses (read-only):** W0 `BookingStatusPill`, `SlotPicker` (reschedule), `SlotConflictAlternatives`, `CancellationPolicy`, `decodeError`, `PillarThemeProvider`; `ui/BottomSheet`/`ModalShell`.
**Required states/behaviors:** sheets are **local** (no global routes); 409 on reschedule → alternatives; optimistic status update then refetch; cancel refund visible only with `schedulingPaid` (else cancel-only); paused/secret states reflected in rows; loading/empty inbox; tz on slot reads.
**Acceptance checks:** web build + typecheck green; verify inbox + approve/decline + reschedule + cancel against hosted-dev (personal + business owner); screenshots; targeted tests for action state-machine; lint/format.
**Branch & PR:** `claude/calendarly-web-w8-bookings-inbox`.
**Depends on:** Web Foundation only.

---

### Stream W9 — Bookings extras   [host lifecycle] [v2]  (~8 screen-equivalents)
**Goal:** Advanced host booking ops: no-show, post-meeting follow-up, group roster/seats, search & filter, double-book warning, nudge, manual/on-behalf booking, waitlist.
**Screens (this stream owns):** E6 Mark No-Show[v2]; E7 Post-Meeting Follow-up[v2]; E8 Group Event Roster & Seats[v2]; E9 Booking Search & Filter[v2]; E10 Double-Book Warning (host)[v2]; E11 Send a Nudge[v2]; E12 Manual/On-Behalf Booking[v2]; E13 Waitlist Join & Management[v2].
**Backend endpoints used:** `POST /bookings/:id/no-show`, `POST /bookings/:id/nudge`, `POST /bookings/:id/propose-reschedule` (E7 follow-up may use), `POST /bookings` (E12 manual create → 409 = E10 double-book warning), `GET /bookings` (E9 with filter params), `GET /bookings/:id` (E8 roster), `GET /event-types/:id/waitlist`, `POST /waitlist/:id/promote`. `SchedulingOwner` for all.
**Files this stream OWNS:**
- `src/app/(app)/app/scheduling/bookings/search/page.tsx` (E9)
- `src/app/(app)/app/scheduling/bookings/manual/page.tsx` (E12; 409 → E10 warning inline)
- `src/app/(app)/app/scheduling/bookings/[id]/roster/page.tsx` (E8) — or a local panel; route owned here
- `src/app/(app)/app/scheduling/waitlist/page.tsx` (E13 management)
- `src/components/scheduling/bookings-extras/**` (NoShowSheet[E6], FollowUpSheet[E7], RosterSeats[E8], BookingSearchFilter[E9], DoubleBookWarning[E10], NudgeSheet[E11], ManualBooking[E12], WaitlistManager[E13])
**Files this stream MUST NOT touch:** shared seams; **W8's** `bookings/page.tsx`, `bookings/[id]/page.tsx`, and `components/scheduling/bookings/**` (W9 mounts its sheets from its *own* routes/components, or W8 imports W9 components read-only only if W9 ships them first — to stay conflict-free, **W9 keeps E6/E7/E10/E11 as components in its own folder** and W8's detail page links to W9 routes rather than co-editing files).
**Reuses (read-only):** W0 `BookingStatusPill`, `SlotPicker`, `SlotConflictAlternatives`, `decodeError`; W8 components are NOT edited.
**Required states/behaviors:** E10 = the 409/double-book presenter on manual create; waitlist promote → confirms; nudge/no-show optimistic then refetch; search/filter debounced query params; seats roster respects capacity; all v2 behind no extra flag (free), paid bits behind `schedulingPaid`.
**Acceptance checks:** web build + typecheck green; verify manual booking (incl. forced 409), no-show, nudge, waitlist promote against hosted-dev; screenshots; targeted tests for filter param builder; lint/format.
**Branch & PR:** `claude/calendarly-web-w9-bookings-extras`.
**Depends on:** Web Foundation only.

---

### Stream W10 — Home calendar & RSVP   [home; EXCLUSIVE owner of home calendar files] [MVP]  (~5 screen-equivalents)
**Goal:** The household calendar/agenda showing the **booking union**, event detail + RSVP, add/edit event, household availability settings, and the permission-gated scheduler view. **Web has no pre-existing home-scheduling module** — this stream builds it and is the sole owner of the home calendar route file it extends.
**Screens (this stream owns):** F1 Home Calendar/Agenda[MVP]; F2 Home Event Detail + RSVP[MVP]; F3 Home Add/Edit Event[MVP]; F8 My Household Availability Settings[MVP]; F15 Permission-Gated Scheduler View[MVP].
**Backend endpoints used:** `GET /api/homes/:id/events?tz=` (the **UNION** — rows tagged `source:'booking'|'event'` + `booking_status`), `POST /api/homes/:id/events`, `PUT/DELETE /api/homes/:id/events/:eventId`, `GET /api/homes/:id/events/:eventId`, `POST /api/homes/:id/events/:eventId/rsvp`; household availability via `/api/homes/:homeId/scheduling/availability*` (home alias). **NEVER create event rows for bookings** — booking rows are read-only in the calendar and deep-link to the scheduling booking detail.
**Files this stream OWNS (incl. the exclusive existing-file extension):**
- `src/app/(app)/app/homes/[id]/calendar/page.tsx` — **EXCLUSIVE edit** (existing file; W10 is its sole owner) to render the scheduling union + RSVP alongside today's tasks/bills/events.
- `src/app/(app)/app/homes/[id]/scheduling/page.tsx` (F15 permission-gated scheduler home), `…/scheduling/availability/page.tsx` (F8), `…/scheduling/events/new/page.tsx` (F3), `…/scheduling/events/[eventId]/page.tsx` (F2)
- `src/components/scheduling/home/*` — **TOP-LEVEL files only (non-recursive)**: HomeAgenda, UnionEventRow, EventDetailRsvp, AddEditEventForm, HouseholdAvailabilityForm, PermissionGate. ⚠️ Do NOT own/create anything under `home/find-a-time/**` (W11) or `home/resources/**` (W12) — those subtrees belong to other streams. Keep W10's files flat in `home/`.
**Files this stream MUST NOT touch:** shared seams; the `src/components/scheduling/home/find-a-time/**` subtree (W11) and `src/components/scheduling/home/resources/**` subtree (W12); W11/W12 home route folders (find-a-time, resources); other homes route files (only `calendar/page.tsx` + the new `scheduling/*` subtree, excluding find-a-time/resources/whos-free).
**Reuses (read-only):** W0 `SchedulingOwnerProvider` (home mode), `BookingStatusPill`, `TimezoneSelector`, `decodeError`, `PillarThemeProvider`; existing `components/home/cards/CalendarCard` (read-only), `homeProfile` endpoints (existing tasks/bills) used alongside the union.
**Required states/behaviors:** union dedupe (booking rows vs event rows); booking rows are **non-editable** in the calendar (tap → scheduling booking detail); RSVP optimistic; F15 gates the scheduler by household permission (hide/disable if not allowed); tz on the events read; green pillar theming.
**Acceptance checks:** web build + typecheck green; verify the union renders a real booking next to a manual home event against hosted-dev; RSVP round-trips; F15 hides for a non-permitted member; screenshots; targeted tests for union dedupe; lint/format.
**Branch & PR:** `claude/calendarly-web-w10-home-calendar-rsvp`.
**Depends on:** Web Foundation only.

---

### Stream W11 — Find-a-time & who's-free   [home] [MVP+v2]  (~4 screen-equivalents)
**Goal:** Household coordination — set up a find-a-time, view suggested slots, member poll responses, and the who's-free household availability overview.
**Screens (this stream owns):** F4 Find a Time — Setup[MVP]; F5 Find a Time — Suggested Slots[MVP]; F6 Find a Time — Member Poll Response[v2]; F7 Who's Free — Household Availability[v2].
**Backend endpoints used:** `GET /find-a-time?tz=` (home alias), `GET /whos-free?tz=`, `POST /polls`, `GET /polls`, `GET /polls/:id`, `POST /polls/:id/finalize`, plus public poll response via `GET /api/public/poll/:id` + `POST /api/public/poll/:id/vote` (F6 member, may be public or in-app). Home owner context via the `/api/homes/:homeId/scheduling/*` alias.
**Files this stream OWNS:**
- `src/app/(app)/app/homes/[id]/scheduling/find-a-time/page.tsx` (F4 setup → F5 suggested slots)
- `src/app/(app)/app/homes/[id]/scheduling/whos-free/page.tsx` (F7)
- `src/app/poll/[id]/page.tsx` (F6 public/member poll response — public route, mirrors `support-trains` pattern)
- `src/components/scheduling/home/find-a-time/**` (FindATimeSetup, SuggestedSlots, PollResponse, WhosFreeGrid)
**Files this stream MUST NOT touch:** shared seams; **W10's** `homes/[id]/calendar/page.tsx` and `homes/[id]/scheduling/page.tsx` (W11 only adds new `find-a-time` + `whos-free` subfolders); W12's resource folders.
**Reuses (read-only):** W0 `SlotPicker`, `TimezoneSelector`, `decodeError`, `NoAvailabilityView`, `PillarThemeProvider`; `publicBooking.getPoll/votePoll`, `fetchPublicPoll`.
**Required states/behaviors:** suggested slots respect overlapping household availability; poll create → vote → finalize; F6 public route handles expired/closed poll states; tz throughout; green pillar.
**Acceptance checks:** web build + typecheck green; verify find-a-time suggestions + a poll vote/finalize against hosted-dev home; screenshots; targeted tests for slot-intersection helper if any; lint/format.
**Branch & PR:** `claude/calendarly-web-w11-find-a-time-whos-free`.
**Depends on:** Web Foundation only.

---

### Stream W12 — Home resources & visits   [home] [v2]  (~6 screen-equivalents)
**Goal:** Bookable household resources (list/editor/detail/book) and the "schedule a visit" flow (setup + detail).
**Screens (this stream owns):** F9 Bookable Home Resources — List[v2]; F10 Resource Editor[v2]; F11 Resource Detail/Booking Calendar[v2]; F12 Book a Resource[v2]; F13 Schedule a Visit — Setup[v2]; F14 Visit Detail[v2].
**Backend endpoints used:** `GET /resources`, `POST /resources`, `PUT/DELETE /resources/:rid`, `POST /resources/:rid/book`, `POST /visits`, plus `GET /bookings/:id` for visit detail. All via the home alias (`/api/homes/:homeId/scheduling/*`).
**Files this stream OWNS:**
- `src/app/(app)/app/homes/[id]/scheduling/resources/page.tsx` (F9), `…/resources/[rid]/page.tsx` (F11 detail/calendar), `…/resources/[rid]/edit/page.tsx` (F10), `…/resources/[rid]/book/page.tsx` (F12)
- `src/app/(app)/app/homes/[id]/scheduling/visits/new/page.tsx` (F13), `…/visits/[id]/page.tsx` (F14)
- `src/components/scheduling/home/resources/**` (ResourceList, ResourceEditor, ResourceCalendar, BookResource, VisitSetup, VisitDetail)
**Files this stream MUST NOT touch:** shared seams; W10/W11 home subfolders (`calendar`, `scheduling/page.tsx`, `find-a-time`, `whos-free`); W12 only adds `resources` + `visits` subfolders.
**Reuses (read-only):** W0 `SlotPicker`, `SlotConflictAlternatives`, `TimezoneSelector`, `BookingStatusPill`, `decodeError`, `PillarThemeProvider`.
**Required states/behaviors:** resource booking honors capacity/availability; 409 on resource book → alternatives; visit create → detail; tz; green pillar; all v2 (free unless priced → `schedulingPaid`).
**Acceptance checks:** web build + typecheck green; verify resource CRUD + a resource booking + a visit against hosted-dev home; screenshots; targeted tests for resource form; lint/format.
**Branch & PR:** `claude/calendarly-web-w12-home-resources-visits`.
**Depends on:** Web Foundation only.

---

### Stream W13 — Business config & team   [business] [MVP+v2]  (~5 screen-equivalents)
**Goal:** Business-pillar scheduling config: round-robin assignment, collective event setup, team booking availability, member working-hours, and business scheduling settings.
**Screens (this stream owns):** G1 Round-Robin Assignment Sheet[v2]; G2 Collective Event Setup[v2]; G3 Team Booking Availability[MVP]; G4 Member Working-Hours Editor[v2]; G5 Business Scheduling Settings[MVP].
**Backend endpoints used:** `PUT /event-types/:id/assignees` (G1 round-robin / G2 collective), `GET /team-availability`, `GET/POST /availability` + `PUT /availability/:id/rules` (G3/G4 per-member), `GET/PUT /booking-page` + `GET/PUT /notification-preferences` (G5). **All with `owner_type:'business'` + `owner_id` via `SchedulingOwner` (business mode).**
**Files this stream OWNS:**
- `src/app/(app)/app/scheduling/business/page.tsx` (G5 settings)
- `src/app/(app)/app/scheduling/business/team-availability/page.tsx` (G3)
- `src/app/(app)/app/scheduling/business/members/[memberId]/hours/page.tsx` (G4)
- `src/components/scheduling/business/**` (RoundRobinSheet[G1], CollectiveSetup[G2], TeamAvailabilityGrid[G3], MemberHoursEditor[G4], BusinessSettings[G5])
**Files this stream MUST NOT touch:** shared seams; W2's event-types pages (G1/G2 are **sheets** mounted from W13's own business pages or imported by W2 read-only — to stay disjoint, **W13 ships G1/G2 as components in its folder** and W2's editor links to them rather than co-editing); W3 availability pages; W14 payments.
**Reuses (read-only):** W0 `SchedulingOwnerProvider` (business), `TimezoneSelector`, `decodeError`, `BookingStatusPill`, `PillarThemeProvider`; reads W2/W3 endpoints via the shared `scheduling` namespace.
**Required states/behaviors:** business owner_id resolution (active business context); round-robin/collective assignment lists; team availability aggregation; violet pillar theming; validation mapping; MVP G3/G5 must work, v2 G1/G2/G4 layered.
**Acceptance checks:** web build + typecheck green; verify team availability + business settings against a hosted-dev business; assignees update round-trips; screenshots; targeted tests for owner_id param injection; lint/format.
**Branch & PR:** `claude/calendarly-web-w13-business-config-team`.
**Depends on:** Web Foundation only.

---

### Stream W14 — Payments & payouts   [business/paid; EXCLUSIVE owner of payments/wallet edits] [MVP]  (~3 screen-equivalents)
**Goal:** Stripe Connect setup + tax, payouts & earnings, and the cancellation/refund policy editor — all behind `schedulingPaid` + Stripe TEST mode. Reuses the existing `StripeProvider` and extends the existing payments/wallet pages as their **sole owner** for scheduling tabs.
**Screens (this stream owns):** G6 Payments Setup/Stripe Connect & Tax[MVP]; G7 Payouts & Earnings[MVP]; G14 Cancellation & Refund Policy[MVP].
**Backend endpoints used:** `GET /payments/status` (scheduling), plus existing platform payments (`payments.*`, `wallet.*`) for the Connect/earnings tabs; `PUT /booking-page` (G14 `cancellation_policy`). Payout **settlement deferred** → show processing/pending. `SchedulingOwner` (business) for status; existing payment APIs for Connect.
**Files this stream OWNS (incl. exclusive existing-file extensions):**
- `src/app/(app)/app/settings/payments/page.tsx` — **EXCLUSIVE edit** (existing file; W14 sole owner) to add a "Scheduling earnings/payouts" tab reading `GET /payments/status`.
- `src/app/(app)/app/wallet/page.tsx` — **EXCLUSIVE edit** (existing file; W14 sole owner) to surface scheduling earnings if applicable.
- `src/app/(app)/app/scheduling/payments/page.tsx` (G6 Connect & Tax + G7 Payouts & Earnings, scheduling-scoped)
- `src/app/(app)/app/scheduling/payments/policy/page.tsx` (G14 cancellation & refund policy editor)
- `src/components/scheduling/payments/**` (SchedulingConnectPanel, PayoutsEarnings, RefundPolicyEditor)
**Files this stream MUST NOT touch:** shared seams; `components/payments/StripeProvider.tsx` + `StripeConnectOnboarding.tsx` (reuse read-only); any other stream's folders. W14 is the **only** stream allowed to edit `settings/payments/page.tsx` and `wallet/page.tsx`.
**Reuses (read-only):** `components/payments/StripeProvider`, `StripeConnectOnboarding`, `PaymentStatusBadge`; W0 `decodeError`, `CancellationPolicy`, `PillarThemeProvider`.
**Required states/behaviors:** everything behind `webFeatureFlags.schedulingPaid` (hidden if off); Stripe TEST mode; payouts show **processing/pending** (settlement deferred); G14 writes `cancellation_policy` to the booking page; violet pillar; loading/empty when no Connect account.
**Acceptance checks:** web build + typecheck green; verify Connect status + payouts (showing pending) + policy save against hosted-dev business in TEST mode; confirm the payments/wallet tabs render when flag on and are absent when off; screenshots; targeted tests for the flag-gating + policy serialization; lint/format.
**Branch & PR:** `claude/calendarly-web-w14-payments-payouts`.
**Depends on:** Web Foundation only.

---

### Stream W15 — Packages & invoices   [paid] [v2]  (~6 screen-equivalents)
**Goal:** Owner packages (list/create/edit), customer buy + my-packages/credits, and invoices (list/detail). All behind `schedulingPaid`.
**Screens (this stream owns):** G8 Packages List (owner)[v2]; G9 Create/Edit Package[v2]; G10 Buy Package (customer)[v2]; G11 My Packages/Credits[v2]; G12 Invoices List[v2]; G13 Invoice Detail[v2].
**Backend endpoints used:** `GET/POST /packages`, `PUT/DELETE /packages/:id`, `POST /packages/:id/buy` (→ `clientSecret`, Stripe TEST), `GET /my-packages`, `GET /invoices`, `GET /invoices/:id`, `POST /invoices/:id/send`. `SchedulingOwner` (business owner for G8/G9/G12/G13; personal customer for G10/G11). Credit redemption ties into D-flow `apply-credit` (booking side owned by W8/W7 — W15 only sells/lists).
**Files this stream OWNS:**
- `src/app/(app)/app/scheduling/packages/page.tsx` (G8), `…/packages/[id]/edit/page.tsx` (G9)
- `src/app/(app)/app/scheduling/my-packages/page.tsx` (G11)
- `src/app/(app)/app/scheduling/invoices/page.tsx` (G12), `…/invoices/[id]/page.tsx` (G13)
- `src/app/book/[slug]/packages/[packageId]/page.tsx` (G10 buy — public/customer, reuses StripeProvider)
- `src/components/scheduling/packages/**` (PackageList, PackageEditor, BuyPackage, MyPackages, InvoiceList, InvoiceDetail)
**Files this stream MUST NOT touch:** shared seams; W4's `book/[slug]/embed` + booking-page folders, W5/W6/W7 booking routes (W15 only adds `book/[slug]/packages/*`); W14 payments pages.
**Reuses (read-only):** `components/payments/StripeProvider`; W0 `decodeError`, `CancellationPolicy`, `BookingStatusPill`, `PillarThemeProvider`.
**Required states/behaviors:** everything behind `schedulingPaid`; buy → Stripe TEST PaymentIntent → credits granted; my-packages shows remaining credits; invoices send → status; pillar by owner; loading/empty.
**Acceptance checks:** web build + typecheck green; verify create package → buy (TEST) → credit appears in my-packages → invoice list against hosted-dev; screenshots; targeted tests for package form + credit display; lint/format.
**Branch & PR:** `claude/calendarly-web-w15-packages-invoices`.
**Depends on:** Web Foundation only.

---

### Stream W16 — Reminders, workflows & templates   [automations] [MVP+v2]  (~8 screen-equivalents)
**Goal:** Default reminders quick-setup, the full workflow builder (list/editor/trigger picker), and the message-template system (editor/variable picker/preview/library).
**Screens (this stream owns):** H1 Default Reminders Quick-Setup[MVP]; H2 Workflows List[v2]; H3 Workflow Editor[v2]; H4 Trigger Picker[v2]; H5 Message Template Editor[v2]; H6 Variable Picker[v2]; H7 Message Preview[v2]; H8 Message Template Library[v2].
**Backend endpoints used:** `GET/PUT /notification-preferences` (H1 reminders `reminder_minutes[]`), `GET/POST /workflows`, `PUT/DELETE /workflows/:id`, `GET/POST /message-templates`, `POST /message-templates/preview` (H7), `PUT/DELETE /message-templates/:id`. `SchedulingOwner` for all.
**Files this stream OWNS:**
- `src/app/(app)/app/scheduling/reminders/page.tsx` (H1)
- `src/app/(app)/app/scheduling/workflows/page.tsx` (H2), `…/workflows/[id]/page.tsx` (H3; H4 trigger picker = local sheet)
- `src/app/(app)/app/scheduling/templates/page.tsx` (H8 library), `…/templates/[id]/page.tsx` (H5; H6 variable picker + H7 preview = local panels)
- `src/components/scheduling/automations/**` (RemindersQuickSetup, WorkflowList, WorkflowEditor, TriggerPicker, TemplateEditor, VariablePicker, MessagePreview, TemplateLibrary)
**Files this stream MUST NOT touch:** shared seams; W1's notification-prefs page (**H1 reminders is its own route**; if it must edit the A4 prefs screen, that is a Foundation/W1 boundary — instead W16 owns a dedicated reminders route and W1 keeps A4); W17 insights.
**Reuses (read-only):** W0 `decodeError`, `PillarThemeProvider`; `ui/*`.
**Required states/behaviors:** H1 edits `reminder_minutes[]` quickly; workflow editor composes trigger→template; H7 preview calls the preview endpoint with sample vars; H4/H6 are local pickers (no global routes); validation mapping; pillar theming.
**Acceptance checks:** web build + typecheck green; verify reminders save + a workflow create + a template preview against hosted-dev; screenshots; targeted tests for the template variable substitution preview wiring; lint/format.
**Branch & PR:** `claude/calendarly-web-w16-reminders-workflows-templates`.
**Depends on:** Web Foundation only.

---

### Stream W17 — Insights & reports   [analytics] [v2]  (~5 screen-equivalents)
**Goal:** Scheduling analytics — insights dashboard, per-event-type performance, no-show & cancellation report, team performance, and the period/filter sheet.
**Screens (this stream owns):** H9 Insights Dashboard[v2]; H10 Per-Event-Type Performance[v2]; H11 No-Show & Cancellation Report[v2]; H12 Team Performance[v2]; H13 Insights Period & Filter Sheet[v2].
**Backend endpoints used:** `GET /bookings/summary`, `GET /bookings/insights/no-shows` (H11), `GET /bookings/insights/team` (H12), `GET /bookings` (with filters for H10), `GET /team-availability` (H12 context). `SchedulingOwner` (personal/business). All reads honor `tz` + period params.
**Files this stream OWNS:**
- `src/app/(app)/app/scheduling/insights/page.tsx` (H9 dashboard; H13 period/filter = local sheet)
- `src/app/(app)/app/scheduling/insights/event-types/page.tsx` (H10)
- `src/app/(app)/app/scheduling/insights/no-shows/page.tsx` (H11)
- `src/app/(app)/app/scheduling/insights/team/page.tsx` (H12)
- `src/components/scheduling/insights/**` (InsightsDashboard, EventTypePerformance, NoShowReport, TeamPerformance, PeriodFilterSheet)
**Files this stream MUST NOT touch:** shared seams; W8/W9 bookings folders (insights reads via the `scheduling` namespace, never editing booking pages); W16 automations.
**Reuses (read-only):** W0 `decodeError`, `BookingStatusPill`, `PillarThemeProvider`; any existing chart primitives in `components/ui` (read-only) or a local lightweight chart.
**Required states/behaviors:** period/filter sheet drives all reports (local sheet, no global route); tz + date-range params; loading/empty (no data yet); business owner_id when business pillar; pillar theming.
**Acceptance checks:** web build + typecheck green; verify dashboard + no-show report + team performance against hosted-dev (business); screenshots; targeted tests for the period/filter param builder; lint/format.
**Branch & PR:** `claude/calendarly-web-w17-insights-reports`.
**Depends on:** Web Foundation only.

---

### Stream W18 — Cross-cutting & polish   [polish; schedule LAST or scope to own files] [MVP+v2]  (~2 screen-equivalents)
**Goal:** Notification/reminder permission & channel-connect prompt, and the accessibility & large-text cross-cutting pass.
**Screens (this stream owns):** H15 Notification/Reminder Permission & Channel Connect Prompt[v2]; H14 Accessibility & Large-Text pass[MVP, cross-cutting].
**Backend endpoints used:** `GET/PUT /notification-preferences` (H15 channel connect), `GET /connected-calendars` + `POST /connected-calendars/connect` (→501, "coming soon" for channel connect). `SchedulingOwner`.
**Files this stream OWNS:**
- `src/app/(app)/app/scheduling/settings/channels/page.tsx` (H15 permission & channel connect prompt)
- `src/components/scheduling/polish/**` (ChannelConnectPrompt[H15], a11y helpers/audit notes)
**H14 scoping (critical for conflict-safety):** H14 is a **cross-cutting a11y audit**. To stay conflict-free it is **scheduled LAST** (after W1–W17 merge) and any fixes it makes to other streams' files are applied as a single sweep on a quiet tree — OR scoped to W18's own files + a shared `components/scheduling/a11y.css`/tokens that W18 owns. **W18 must NOT edit another stream's files while that stream's PR is open.** Preferred: W18 ships an a11y checklist + fixes only to W0/W18-owned shared components (focus rings, ARIA on `SlotPicker`/pills/sheets, large-text scaling via tokens), and files any per-stream a11y gaps back to those streams.
**Files this stream MUST NOT touch (while their PRs are open):** all other streams' folders; shared seams (flag a Foundation gap instead). After all merge, H14 fixes are a final sweep PR.
**Reuses (read-only):** W0 components (audits them); `ui/*`.
**Required states/behaviors:** H15 = permission prompt + 501 channel-connect "coming soon"; H14 = WCAG AA contrast, focus order, keyboard nav, large-text/zoom, screen-reader labels across the shared scheduling components.
**Acceptance checks:** web build + typecheck green; H15 verified against hosted-dev; H14 verified via axe/lighthouse a11y pass on the key public + host screens; screenshots; lint/format.
**Branch & PR:** `claude/calendarly-web-w18-cross-cutting-polish` (merge LAST).
**Depends on:** Web Foundation only (H14 sweep depends on W1–W17 being merged).

---

## 7. Coverage table — every screen mapped to exactly one stream

| ID | Name | Stream | MVP/v2 |
|----|------|--------|--------|
| A1 | Scheduling Hub | W1 | MVP |
| A2 | First-Run Wizard / Set Up Booking Link | W1 | MVP |
| A3 | Scheduling Settings Root | W1 | MVP |
| A4 | Notifications Preferences | W1 | MVP |
| A5 | Summary Card | W1 | MVP |
| A6 | Onboarding for Home & Business | W1 | v2 |
| B1 | Event Type/Service List | W2 | MVP |
| B2 | Event Type/Service Editor | W2 | MVP |
| B3 | Intake Questions Editor | W2 | v2 |
| B8 | Connected Calendars (→501) | W2 | v2 |
| B4 | Availability Schedule List | W3 | MVP |
| B5 | Weekly Hours Editor | W3 | MVP |
| B6 | Date Overrides & Holidays | W3 | v2 |
| B7 | Booking Limits & Notice Rules | W3 | v2 |
| B9 | Block off time | W3 | MVP |
| C1 | Booking Link/Public Page Management | W4 | MVP |
| C2 | Public Booking Page Preview | W4 | MVP |
| C3 | Share Your Link Sheet | W4 | MVP |
| C4 | One-off/Single-use Link Generator | W4 | MVP |
| H16 | Booking-Link/Page Empty & Zero-State | W4 | MVP |
| C9 | Embed Widget (WEB-ONLY) | W4 | web-only |
| C5 | Booking Landing/Booker Profile | W5 | MVP |
| C6 | Date+Time Slot Picker | W5 | MVP |
| C7 | Timezone Selector | W5 | MVP |
| C8 | Slot/No-Availability State | W5 | MVP |
| D1 | Intake/Booking Details Form | W6 | MVP |
| D2 | Review & Confirm/Checkout | W6 | MVP |
| D3 | Booking Confirmed/Thank-You | W6 | MVP |
| D4 | Manage Your Booking | W6 | MVP |
| D5 | Slot Taken/Conflict | W7 | MVP |
| D6 | Payment Failed/Retry | W7 | v2 |
| D7 | Unavailable/Expired/Paused/Secret | W7 | MVP |
| D8 | Add to Calendar | W7 | MVP |
| D9 | Open-in-App/Deep-Link Hand-off | W7 | MVP |
| D10 | Reschedule/Cancel Cutoff & Policy-Blocked | W7 | MVP |
| D11 | My Bookings (customer) | W7 | v2 |
| D12 | Recurring/Multi-Session Setup | W7 | v2 |
| E1 | Bookings Inbox | W8 | MVP |
| E2 | Booking Detail | W8 | MVP |
| E3 | Approve/Decline Sheet | W8 | MVP |
| E4 | Reschedule/Reassign Sheet | W8 | MVP |
| E5 | Cancel & Refund Sheet | W8 | MVP |
| E6 | Mark No-Show | W9 | v2 |
| E7 | Post-Meeting Follow-up | W9 | v2 |
| E8 | Group Event Roster & Seats | W9 | v2 |
| E9 | Booking Search & Filter | W9 | v2 |
| E10 | Double-Book Warning (host) | W9 | v2 |
| E11 | Send a Nudge | W9 | v2 |
| E12 | Manual/On-Behalf Booking | W9 | v2 |
| E13 | Waitlist Join & Management | W9 | v2 |
| F1 | Home Calendar/Agenda | W10 | MVP |
| F2 | Home Event Detail + RSVP | W10 | MVP |
| F3 | Home Add/Edit Event | W10 | MVP |
| F8 | My Household Availability Settings | W10 | MVP |
| F15 | Permission-Gated Scheduler View | W10 | MVP |
| F4 | Find a Time — Setup | W11 | MVP |
| F5 | Find a Time — Suggested Slots | W11 | MVP |
| F6 | Find a Time — Member Poll Response | W11 | v2 |
| F7 | Who's Free — Household Availability | W11 | v2 |
| F9 | Bookable Home Resources — List | W12 | v2 |
| F10 | Resource Editor | W12 | v2 |
| F11 | Resource Detail/Booking Calendar | W12 | v2 |
| F12 | Book a Resource | W12 | v2 |
| F13 | Schedule a Visit — Setup | W12 | v2 |
| F14 | Visit Detail | W12 | v2 |
| G1 | Round-Robin Assignment Sheet | W13 | v2 |
| G2 | Collective Event Setup | W13 | v2 |
| G3 | Team Booking Availability | W13 | MVP |
| G4 | Member Working-Hours Editor | W13 | v2 |
| G5 | Business Scheduling Settings | W13 | MVP |
| G6 | Payments Setup/Stripe Connect & Tax | W14 | MVP |
| G7 | Payouts & Earnings | W14 | MVP |
| G14 | Cancellation & Refund Policy | W14 | MVP |
| G8 | Packages List (owner) | W15 | v2 |
| G9 | Create/Edit Package | W15 | v2 |
| G10 | Buy Package (customer) | W15 | v2 |
| G11 | My Packages/Credits | W15 | v2 |
| G12 | Invoices List | W15 | v2 |
| G13 | Invoice Detail | W15 | v2 |
| H1 | Default Reminders Quick-Setup | W16 | MVP |
| H2 | Workflows List | W16 | v2 |
| H3 | Workflow Editor | W16 | v2 |
| H4 | Trigger Picker | W16 | v2 |
| H5 | Message Template Editor | W16 | v2 |
| H6 | Variable Picker | W16 | v2 |
| H7 | Message Preview | W16 | v2 |
| H8 | Message Template Library | W16 | v2 |
| H9 | Insights Dashboard | W17 | v2 |
| H10 | Per-Event-Type Performance | W17 | v2 |
| H11 | No-Show & Cancellation Report | W17 | v2 |
| H12 | Team Performance | W17 | v2 |
| H13 | Insights Period & Filter Sheet | W17 | v2 |
| H15 | Notification/Reminder Permission & Channel Connect | W18 | v2 |
| H14 | Accessibility & Large-Text pass | W18 | MVP (cross-cut) |

**Total: 93 web-buildable screens** — 92 cross-platform + C9 (web-only). Each appears in **exactly one** stream.

---

## 8. Dependency / wave diagram & execution order

```
                         ┌─────────────────────────────┐
                         │  W0  FOUNDATION (serial gate) │
                         │  contract types + api ns +    │
                         │  utils builders + publicShare │
                         │  + featureFlags(schedulingPaid)│
                         │  + components/scheduling/** +  │
                         │  route skeletons/layouts       │
                         └──────────────┬──────────────────┘
                                        │ merge to master FIRST
        ┌───────────────────────────────┼───────────────────────────────┐
        │                               │                               │
   ── WAVE 1 (all parallel; merge in ANY order, zero conflicts) ──────────
   W1 Setup&Hub      W2 EventTypes    W3 Availability   W4 BookingPage+Embed(C9)
   W5 Discovery      W6 Confirm&Manage W7 Edge&Customer W8 Bookings inbox
   W9 Bookings extras W10 Home cal*    W11 Find-a-time   W12 Home resources
   W13 Business cfg   W14 Payments*    W15 Packages      W16 Reminders/workflows
   W17 Insights
        │
   ── WAVE 2 (after Wave-1 streams merge) ─────────────────────────────────
   W18 Cross-cutting & polish (H14 a11y sweep last; H15 anytime after W0)

   *W10 and W14 are EXCLUSIVE owners of a few existing files outside the
    scheduling tree (homes/[id]/calendar/page.tsx; settings/payments + wallet).
    Single-owner ⇒ still no contention with any other stream.
```

**Recommended execution order**
1. **W0 Foundation** — merge before anything else (the gate).
2. **Wave 1 — all 17 of W1–W17 in parallel.** Suggested priority for early value (MVP critical path first), though order does not affect merge safety:
   - First: **W1, W2, W3, W4, W5, W6, W8** (the personal host-config + public booking happy path + host inbox = a working end-to-end MVP).
   - Then: **W7, W10, W13, W14** (edge cases, home calendar, business config, paid setup — MVP completers).
   - Then v2 fan-out: **W9, W11, W12, W15, W16, W17**.
3. **Wave 2 — W18** last (a11y sweep on a quiet tree; H15 may land any time after W0).

Because Wave-1 streams write **disjoint files** (distinct route folders + component subfolders, with W10/W14 as single owners of their two existing-file extensions), their 17 PRs merge to `master` **in any order with zero conflicts**.
