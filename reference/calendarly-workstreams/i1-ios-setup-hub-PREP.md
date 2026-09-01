# I1 — Setup & Hub (iOS) — BUILD-READY PREP NOTE

> **Status: PARKED, waiting on Foundation (I0a + I0b).** This file is read-only prep
> ("scaffold notes") produced while Foundation is built elsewhere. **No Swift files
> have been created** — doing so would risk a conflicting duplicate of the shared
> layer and break the disjoint-merge guarantee for the other 17 streams.
>
> Branch: `claude/calendarly-ios-setup-hub` (== `feature/calendarly` tip). New scheduling
> branches must be based on `feature/calendarly`, never `master`.
> App root: `frontend/apps/ios/Pantopus`.

---

## 0. Resume procedure (when Foundation merges)

1. Rebase/merge so the Foundation layer is in the working tree, then run the
   **Foundation verification checklist** (§2). If any symbol is missing/wrong → STOP,
   flag the specific gap (do NOT add it locally).
2. `make bootstrap` (runs `xcodegen generate`) + build the `Pantopus` scheme → confirm
   green WITH Foundation present, before adding I1 code.
3. Build screens in order A2 (wizard) → A1 (hub) → A3 (settings) → A4 (notif prefs) →
   A5 (summary card, embedded) → A6 (v2 onboarding). A1 depends on A5 + on routing to A2/A3/A4.
4. Verify each in the iOS Simulator on a hosted-dev account against the live endpoint
   (migrations 159–165). Screenshot vs the design prompt. Keep test bookings/pages.
5. Targeted tests under `PantopusTests/Scheduling/Setup/` only, driving the VMs with
   `APIClient(retryPolicy: .none, session: SequencedURLProtocol.makeSession())`.
6. SwiftLint hex-grep guard + `.swiftformat` → one PR to `master`.

Designs are in-repo: `reference/calendarly-design-prompt-suite.md` lines 107–171 (Group A).
Authoritative contract: `20-ios-workstreams.md` §"Stream I1" + §4 (wiring) + §6 (common).

---

## 1. Scope — screens this stream OWNS

| ID | Name | MVP/v2 | Routed? | Shell |
|----|------|--------|---------|-------|
| A1 | Scheduling Hub | MVP | yes (stub) | ListOfRows / dashboard |
| A2 | First-Run Wizard / Set Up Booking Link | MVP | yes (stub) | `WizardShell` |
| A3 | Scheduling Settings Root | MVP | yes (stub) | grouped list (`ListOfRowsView`) |
| A4 | Notifications Preferences | MVP | yes (stub) | `FormShell` (channel-triad matrix) |
| A5 | Summary Card | MVP | **NO** — embedded card in A1/A3 (local view) | inline |
| A6 | Onboarding Home & Business | v2 | yes (stub) | `WizardShell` ×2 (home + business) |

**Owns files:** `Features/Scheduling/Setup/**` (Hub, FirstRunWizard*, SettingsRoot,
NotificationsPrefs, SummaryCard, OnboardingHomeBusiness*) + the **stub bodies** for
A1, A2, A3, A4, A6 under `Features/Scheduling/Routing/Stubs/Setup/*`.
A5 has **no stub** (embedded).

**MUST NOT touch:** the Foundation files (Scheduling endpoints/models, `Features/Scheduling/Foundation/**`,
`Routing/SchedulingRoute.swift`, `Routing/SchedulingRouter.swift`, `SharedUI/**`),
`Features/Root/HubTabRoot.swift`, `Features/Root/YouTabRoot.swift`, `Features/Me/*`.

---

## 2. Foundation symbols I CONSUME (verification checklist — fail-closed)

When Foundation lands, confirm each exists with a compatible shape. If any is missing/wrong → flag as Foundation gap.

- [ ] `SchedulingOwner` enum `{ case personal; case business(id:); case home(homeId:) }`
      with `queryItems` (GET owner_type/owner_id), `ownerBody` (write fields), `pathPrefix`
      (`/api/scheduling` vs `/api/homes/<homeId>/scheduling`). **A6 needs `.home`/`.business`.**
- [ ] `SchedulingError` typed decoder: `{error,message}`, 400 `details[]`, 409 `alternatives[]`,
      and `SchedulingStatus` enum (paused/secret/unavailable/expired). I1 mainly needs SLUG_TAKEN (409)
      + generic envelope; `is_paused` is a page field, not an error.
- [ ] `SchedulingFeatureFlags.paidEnabled` — A3 "Payments & payouts" row + A6 business price field gate on it.
- [ ] `SchedulingTime` — device IANA tz default + UTC↔local helpers (A2 timezone chip, A1 agenda times).
- [ ] DTOs (in `Core/Networking/Models/Scheduling/`):
  - [ ] `BookingPageDTO` — id, owner_type, owner_id, slug, is_live, is_paused, title, tagline,
        avatar_url, intro, confirmation_message, timezone, reminder_minutes[], cancellation_policy,
        visibility (`listed`|`unlisted`), branding, created_at, updated_at, created_by.
  - [ ] check-slug response — `{ available: Bool, suggestions: [String], error?: String, message? }`.
  - [ ] `BookingSummaryDTO` — upcomingCount, pendingCount, totalThisMonth, noShowRate,
        nextBooking { start_at, invitee_name }, (+ delta/sparkline fields if present).
  - [ ] notification-preferences — **flexible object**; must round-trip unknown keys
        (decode to a dictionary-backed type, not a fixed struct). If Foundation models it as a
        rigid struct that drops unknown keys → flag (A4 requires round-trip).
  - [ ] EventType DTO (A2 step-2 starter type create; A1 "Event Types · 3 active" count — read-only here).
- [ ] Endpoint builders (in `SchedulingEndpoints.swift`, each taking `SchedulingOwner`):
  - [ ] `getBookingPage`, `putBookingPage(body:)`, `putBookingPageSlug(body:)`,
        `checkSlug(slug:)`, `resetSlug`, `disableBookingPage`
  - [ ] `getBookingsSummary`
  - [ ] `getNotificationPreferences`, `putNotificationPreferences(body:)` (personal only)
  - [ ] `getEventTypes` (A1 count), `createEventType(body:)` (A2 starter type)
- [ ] Routing: `SchedulingRoute` has cases for A1, A2, A3, A4, A6 + stub View/VM per case under
      `Routing/Stubs/Setup/`. `SchedulingRouter.destination(for:owner:push:)` maps them.
      **I fill only my own stub bodies; never edit the route enum or router switch.**
- [ ] SharedUI: `SchedulingIdentityTheme` (SchedulingOwner → WizardIdentity accent), `SchedulingStatusPill`.
      (I1 does NOT need SlotPicker / the shared sheets.)
- [ ] Seam: Me tile `routeKey = me.scheduling` (+ home/business variants) navigates to the A1 Hub stub.

---

## 3. Backend contracts (verified — `reference/calendarly-backend-api.md`)

Owner ctx on ALL of these via `SchedulingOwner` (personal omits; business adds owner_type/owner_id;
home uses the `/api/homes/:homeId/scheduling` alias). Notification-prefs is **personal-only** (no owner ctx).

- `GET /booking-page` → `{ page }`. **Auto-creates** the page on first access. (A1, A3)
- `PUT /booking-page` body `{ title?, tagline?, avatar_url?, intro?, confirmation_message?, timezone?,
  is_live?, is_paused?, reminder_minutes?: number[], cancellation_policy?, visibility?, branding? }`
  → `{ page }`. Used for: A1 master pause (`is_paused`), A3 toggles (`is_live`), A4 reminder chips
  (`reminder_minutes[]`). owner_type/owner_id in body are stripped server-side.
- `PUT /booking-page/slug` body `{ slug, owner_type, owner_id }` → `{ page }`. **409 SLUG_TAKEN.** (A2 commit)
- `GET /booking-page/check-slug?slug=` → `{ available, suggestions[] (3 if taken), error?, message? }`.
  400 if format invalid (`/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/`). **A2 debounced live check.**
- `POST /booking-page/reset-slug` → `{ page }` (new random slug). **Danger — invalidates old link.** (A3)
- `POST /booking-page/disable` → `{ page, is_live=false }`. Reversible via PUT is_live=true. (A3)
- `GET /bookings/summary` → `{ upcomingCount, pendingCount, totalThisMonth, noShowRate,
  nextBooking{start_at,invitee_name}, ... }`. (A5 / A1)
- `GET /notification-preferences` → `{ prefs: <flexible object> }` (personal). (A4)
- `PUT /notification-preferences` body `{ prefs: <flexible object, required> }` → `{ prefs }`.
  **Round-trip arbitrary keys** (`object.unknown(true)`). (A4)
- `GET /event-types` → `{ eventTypes[] }` (A1 "N active" count, read-only). `POST /event-types` (A2 starter).

**A2 slug flow nuance:** the *live debounced* check uses `GET check-slug` (200 + `suggestions[]`);
the *commit* uses `PUT /booking-page/slug` which may return **409 SLUG_TAKEN** → re-surface suggestions.

---

## 4. Reuse inventory (verified present in tree — read-only)

- `Features/Shared/Wizard/WizardShell.swift` — `WizardShell<Content>`; chrome has `progressLabel`
  `.stepOf(current,total)`, leading `.back`/`.close`. (A2, A6)
- `Features/Shared/Wizard/WizardIdentity.swift` — `enum { personal, home, business, warm }` with
  `.accent` (personal→primary600, home→Theme.Color.home, business→Theme.Color.business) + `.accentBg`.
  `SchedulingIdentityTheme` (Foundation) maps SchedulingOwner→this.
- `Features/Shared/Form/FormShell.swift` — `FormShell<Content>`, leading `.close`/`.back`,
  `FirstInvalidShake` modifier. (A4, parts of A3)
- `Features/Shared/ListOfRows/ListOfRowsView.swift` — `ListOfRowsView<DataSource, Header>` with
  state body loading/loaded(sections,hasMore)/empty(content)/error(message); `ListRowCard`;
  row accent enum primary/home/business/warning. (A1, A3)
- `Features/Shared/ContentDetail/ContentDetailShell.swift` — header/body/cta builders. (A5 if needed)
- `Core/Design/Components/EmptyState.swift` — `EmptyState`. (empty states)
- `Core/Design/Components/OfflineBanner.swift` — `OfflineBanner` + `.offlineBanner(...)` View ext.
  **Wrap every fetchable surface body.**
- `Features/Shared/Feed/FeedComponents.swift` — shimmer skeletons.
- Tokens: `Core/Design/{Theme,Colors,Spacing,Radii,Icons}.swift`. Identity colors:
  `Theme.Color.{personalBg, homeBg, businessBg, home, business, primary600, warmAmber, warmAmberBg}`.
  **Theme tokens only — no hardcoded hex/spacing** (SwiftLint hex-grep guards this).

---

## 5. Screen-by-screen build plan + required states

Every fetchable surface ships **loading skeleton / empty (EmptyState) / loaded / error+Retry**,
wrapped in `.offlineBanner(...)`. No default-arg `@MainActor` VM inits — inject deps explicitly,
hold VM via `@State`.

### A2 — First-Run Wizard `[MVP]` (build first)
`WizardShell`, 4 steps, Personal sky theme, StepRail "step X of 4".
1. **Claim handle** — monospace input prefilled `pantopus.com/book/<suggested>`; debounced
   `check-slug` → green "Available" chip OR inline `--color-error` "That link is taken" + 3 suggestion chips.
2. **Starter event type** — 2-col tile picker, preselect "30-min meeting"; video/in-person segmented.
   (Creates one EventType via `POST /event-types`.)
3. **Default weekly hours + tz** — Mon–Fri time-range rows + auto-detected tz chip
   "America/New_York · auto" (tappable). (Availability writes are I3's domain; I1 only seeds via
   page timezone / defaults — keep to what the booking-page contract allows; if hours need
   `/availability`, that is I3 — link out, don't duplicate.)
4. **SuccessHero** — success disc, live link copy card, primary "Share link" + ghost "Add another".
States: default / handle-taken conflict / loading (shimmer on availability row) / resume (re-enter step 3,
steps 1–2 checked). Each step has "Use defaults" skip. Commit slug via `PUT /booking-page/slug`
(handle 409 SLUG_TAKEN). On finish → route to A1 Hub.

### A1 — Scheduling Hub `[MVP]`
Owner-polymorphic front door. Mirror Me.html structure; 56px top bar (no back at tab root,
title "Scheduling", trailing overflow). Top→bottom:
1. IdentitySwitcherPillRow (Personal/Home/Business — re-scopes screen via `SchedulingOwner`; accent follows).
2. Booking-link card — preview thumbnail rail, monospace handle, ghost "Copy link" + "Share".
3. Master "Pause all bookings" row — toggle bound to `is_paused` via `PUT /booking-page` (optimistic + refetch-on-error).
4. Today + Upcoming agenda strip — reuse Home-calendar agenda rows from `nextBooking`/summary; "See all bookings" → Bookings Inbox (route to I8's E1).
5. Quick rows group (A14.3 chevron rows w/ current-value sub): Event Types ("N active" from `GET /event-types`),
   Availability, Connected Calendars, Bookings ("N need approval" from summary.pendingCount), Settings (→ A3).
6. Primary CTA "Share booking link".
Embeds **A5 Summary Card** at top.
States: **empty/first-run** (collapse sections to a single amber "Set up your booking link" banner → A2);
loading (shimmer, never "Loading…"); **paused** (amber banner + Resume pill replacing toggle card);
**Home variant** (composed-availability explainer + member-avatar stack); **permission-gated**
(hide edit affordances/chevrons for members lacking `calendar.edit` → read-only rows).

### A3 — Scheduling Settings Root `[MVP]`
Grouped list (A14.3), 52px top bar "Booking settings". Groups:
- **AUTOMATION:** Default reminders (→ I16 H1), Workflows & follow-ups (→ I16), Message templates (→ I16),
  Booking notifications (→ A4).
- **SCHEDULING DEFAULTS:** Default timezone, Default availability (→ I3), Cancellation policy (→ I14 G14).
- **PAYMENTS:** Payments & payouts (chip Connected/Connect → I14 G6) — **gate on `paidEnabled`**.
- **DANGER ZONE** (red card, pinned last): "Reset booking link" (`POST reset-slug`, danger confirm —
  invalidates old link) + "Disable scheduling" (`POST disable` / `PUT is_live=false`), mono footer w/ URL + owner id.
States: loaded / fresh (chips→"Off"/"Set up" amber, empty subs) / saving (inline shimmer on written row) /
saved (success check chip) / **Business variant** (adds TEAM group: "Team & seats", "Auto-confirm vs approve" segmented).
Toggles optimistic w/ refetch-on-error.

### A4 — Notifications Preferences `[MVP]`
Design says "category card in existing A14.5 matrix" but I1 **owns a routed stub** and must NOT edit the
global Notifications screen → build a **standalone Scheduling Notifications screen** (`FormShell`) that
**mirrors the A14.5 channel-triad matrix 1:1** (P·E·S chips per row; on=primary fill, off=border, disabled=gray).
Two sub-cards under one overline:
- **NOTIFY ME:** New booking, Cancellation, Reschedule, Reminder sent, No-show, Daily agenda (P/E/S triad each).
- **NOTIFY ATTENDEES:** Booking confirmation (locked on), Reminder, Reschedule notice, Cancellation notice.
SMS (S) column present but **locked "Coming soon"** (disabled + lock glyph). Reminder lead-time chip row
("1 day"/"1 hr"/"15 min"/"+ Add") → writes `reminder_minutes[]` via `PUT /booking-page` (NOTE: lead-times
live on the page, not notification-prefs). The P/E/S matrix round-trips through `GET/PUT /notification-preferences`
(**flexible prefs object — preserve unknown keys**). Mono legend "P · Push  E · Email  S · SMS (soon)".
States: loaded / paused (master-pause amber banner above, card→55% opacity, disabled chips) /
SMS-locked / permission-gated (push off at OS → "Turn on push in Settings" notice, gray P column).

### A5 — Summary Card `[MVP]` (embedded, NO stub)
Local view embedded at top of A1 (and Business pillar). Me.html stats card: overline "THIS MONTH" +
period chip group (This week/This month); 3–4 StatCellRow cells (bookings, +Δ% vs last in success/error,
upcoming, no-show); tiny inline sparkline polyline in pillar color; "See insights" link → I17 H9.
Powered by `GET /bookings/summary`. States: default / empty ("No bookings yet — share your link" + primary
"Share booking link") / loading (shimmer rects sized to cells) / error ("Couldn't load your numbers" + Retry ghost) /
single-event-type (hide per-type breakdown).

### A6 — Onboarding Home & Business `[v2]`
Two `WizardShell` wizards parallel to A2, recolored per pillar.
- **HOME (green, 3 steps):** (1) "Choose who's scheduled" — member multi-select w/ per-member toggle + "Invite someone";
  (2) "How should times combine?" — 2-col mode picker Collective vs Round-robin + locked composed-availability
  explainer card + shared-tz confirm chip; (3) SuccessHero w/ family booking link.
  Owner ctx = `.home(homeId:)` (uses `/api/homes/:homeId/scheduling/*`).
- **BUSINESS (violet, 4 steps):** (1) "Claim your business link" (handle + check-slug + conflict suggestions);
  (2) "Add your first service" (service tile picker + duration/price — price field **gated on `paidEnabled`**);
  (3) "Seat your team" (member rows + role chips + seat counters + "Invite teammate" + composed-availability explainer);
  (4) "Auto-confirm or approve?" segmented + SuccessHero. Owner ctx = `.business(id:)`.
Both: skip/"use defaults" on optional steps; composed-availability explainer always visible where members compose.

---

## 6. Wiring contract reminders (I1-relevant subset)

- Owner context ALWAYS via `SchedulingOwner` — never hand-roll owner params. A1 pill switches the owner;
  A6 walks home + business explicitly.
- `is_paused`/`is_live`/`visibility:'unlisted'`/`status:'paused'` are **first-class page states**, not errors.
- Notification-prefs **flexible object** — round-trip unknown keys (don't drop them).
- 409 SLUG_TAKEN on `PUT /booking-page/slug` → surface `suggestions[]` (A2/A6 business). No dead ends.
- Paid surfaces (A3 Payments row, A6 business price) behind `SchedulingFeatureFlags.paidEnabled`.
- Reminder lead-times persist on the **booking-page** (`reminder_minutes[]`), not notification-prefs.
