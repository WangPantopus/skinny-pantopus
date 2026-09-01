# Calendarly — Implementation Plan

> Engineering plan for the Pantopus **Calendarly** feature: personal + family/home + business scheduling and booking, payments included. Pairs with the design prompt suite (`~/Downloads/calendarly-design-prompt-suite.md`, 94 screens) and the companion [design doc](./calendarly-design-doc.md).
>
> Status: planning, **revised after a grounded review pass** (Jun 2026). All file paths and line numbers below were verified against the current tree (master @ migration 158). Changes from the first draft are called out inline with **[REVIEW]** tags so the deltas are auditable.
>
> **Decisions locked this pass:** (1) v1 ships **Personal + Home together** (not personal-only). (2) Confirmed home bookings use a **query-time union** of `Booking` + `HomeCalendarEvent`, **not** a write-through copy. (3) **Transactional email is a v1 channel** (not deferred) — non-user invitees are the common case and cannot receive in-app/push. (4) The slot-race guard is a **DB-level overlap-exclusion constraint**, not application-only re-check.

---

## 1. Scope & guiding decisions

- **One owner-polymorphic engine.** A single scheduling engine keyed by `owner_type ∈ {user, home, business}` + `owner_id`. The identity pill (Personal sky / Home green / Business violet) re-scopes the same screens and APIs — no parallel implementations, no sixth bottom tab.
- **Personal availability is the source of truth.** Home and Business scheduling **compose** members' personal availability (collective = intersect required members; round-robin = union + rule). They never copy it. See the [design doc](./calendarly-design-doc.md) for the engine algorithm. **[REVIEW]** Composition reads one member's personal free/busy into another owner's slot view — this crosses the app's **identity firewall** (see `BusinessSeat`/`SeatBinding`, notification context allowlists). The contract: compose free/busy **booleans only** (never titles/details), require assignee opt-in, and treat a member with no schedule as contributing *nothing* + a host-visible warning (never a fabricated 9–5).
- **Reuse over build.** The feature is mostly composition over existing infrastructure (see §9). The genuinely new subsystem is the **availability / free-busy engine** (§5). **[REVIEW]** "Reuse" is honest about *existence* but was optimistic about *glue*: the payment stack, reminder cron, slot UI, and polls all reuse cleanly at the verb level but need real, gig-shaped adapter work (§4.4, §9). External calendar sync (Google/Outlook/Apple) is deferred — it is the one expensive gap. A **read-only Google free/busy import** is a strong candidate to pull into v1 for the **personal** pillar specifically (it removes the double-book risk); see §12.
- **New backend dependencies.** **[REVIEW]** The engine needs libraries that do **not** yet exist anywhere in the repo: `luxon` (DST-aware wall-clock-in-zone math), `rrule` (RRULE expansion — the `recurrence_rule` text field exists but is never expanded today), and `ical-generator` (`.ics` for invitee add-to-calendar). Pin versions in `backend/package.json`. `nodemailer` already exists (used by `emailService.js`).
- **Surface counts** (from the screen inventory): ~95 surfaces → ~30 navigable screens → **18-screen personal core + the home find-a-time loop** for v1. Phasing in §10.

---

## 2. Architecture at a glance

```
                       ┌──────────────────────────────────────────┐
   identity pill  ───► │  Scheduling engine (owner_type/owner_id)  │
 (Personal/Home/Biz)   │  EventType · AvailabilityEngine · Booking │
                       └───────────────┬──────────────────────────┘
        ┌──────────────────────────────┼───────────────────────────────┐
   Personal (user)                Home (home_id)                Business (business_user_id)
   availability = truth      composes member availability    composes team availability
        │                              │                               │
        ▼                              ▼                               ▼
  /book/[slug]                /book/[slug]  + HomeResource      /book/[slug]
  (public web flow)           + find-a-time (compose)          round-robin via BusinessTeam
                              + who's-free; calendar = UNION
                              (Booking ∪ HomeCalendarEvent)
```

**[REVIEW]** All three owner types route through a single **`/book/[slug]`** namespace (the resolved decision). The earlier diagram showed business at `/b/[username]`, which would collide with the existing live `/b/[username]` business page — removed.

Reused infra (verified): `HomeCalendarEvent`, `BusinessTeam`/`BusinessSeat`, `HomeOccupancy` (members + `role_base`), `homePermissions.hasPermission`, `notificationService` + `pushService` + Socket.IO, `emailService` (transactional email, incl. guest-confirmation precedent), `node-cron` jobs, the full **Stripe Connect** stack (`backend/stripe/stripeService.js` — note: under `stripe/`, not `services/`), `BusinessInvoice`, `walletService`, public-page + token-invite patterns.

---

## 3. Data model — new tables

Migrations follow the verified convention: a numbered file `backend/database/migrations/159_calendarly_core.sql` (next number after `158_place_county_data.sql`) **plus** a byte-identical timestamped mirror in `supabase/migrations/` (latest is `20260611100000_gig_saved_searches.sql`).

**[REVIEW] The skeleton has evolved — follow current (148–158) practice, not the historical one.** Migrations 030–147 used `BEGIN/COMMIT`, `ENABLE ROW LEVEL SECURITY` + policies, and `GRANT`. Migrations **148–158 use only** `CREATE TABLE IF NOT EXISTS` + idempotent `DO $$ … EXCEPTION WHEN duplicate_object` blocks for enums/FKs — **no `BEGIN/COMMIT`, no RLS, no GRANT**. Decide explicitly (§3.8) whether Calendarly tables add RLS (defense-in-depth, matching `HomeCalendarEvent`) or follow the recent route-gating-only practice; do not silently assume the old skeleton.

**[REVIEW] New extension required:** the booking overlap-exclusion constraint (§3.4) needs the **`btree_gist`** Postgres extension (`CREATE EXTENSION IF NOT EXISTS btree_gist;`), which this repo does not currently enable. Confirm it is available on the managed/Supabase instance before relying on it.

Split across ~3 migrations to keep them reviewable: `159_calendarly_core` (extension, enums, event types + policy columns, availability), `160_calendarly_bookings` (bookings + overlap constraint, attendees, tokens, resources, the `Payment.booking_id` column + CHECK-constraint ALTERs), `161_calendarly_packages_automations` (packages, workflows, connected-calendar stub).

### 3.1 Enums

```sql
CREATE TYPE "public"."scheduling_owner_type" AS ENUM ('user', 'home', 'business');
CREATE TYPE "public"."assignment_mode"      AS ENUM ('one_on_one', 'collective', 'round_robin', 'group');
CREATE TYPE "public"."location_mode"        AS ENUM ('video', 'phone', 'in_person', 'custom', 'ask');
CREATE TYPE "public"."booking_status"       AS ENUM ('pending', 'confirmed', 'cancelled', 'declined', 'completed', 'no_show');
CREATE TYPE "public"."rsvp_status"          AS ENUM ('pending', 'going', 'maybe', 'declined');
CREATE TYPE "public"."booking_token_kind"   AS ENUM ('manage', 'one_off');
CREATE TYPE "public"."refund_policy"        AS ENUM ('full', 'partial', 'none', 'deposit_only');  -- [REVIEW] new
```

**[REVIEW] Note on the *reused* payment enums:** `Payment.payment_type` and `WalletTransaction.type` are **`varchar` + CHECK constraints, NOT Postgres enums** (`schema.sql:7717`, `:4543`). Adding `booking_payment`/`package_payment`/`booking_income` is an `ALTER TABLE … DROP CONSTRAINT … ADD CONSTRAINT`, not `ALTER TYPE … ADD VALUE`. See §3.6/§4.4.

### 3.2 Public page & event types

| Table | Key columns | Notes |
|---|---|---|
| **BookingPage** | `id`, `owner_type`, `owner_id`, **`user_id`/`home_id`/`business_user_id` (exactly-one-non-null, real FKs, ON DELETE CASCADE)** `[REVIEW]`, `slug` (unique), **`timezone`** `[REVIEW]`, `title`, `tagline`, `avatar_url`, `intro`, `confirmation_message`, `is_live` bool, `visibility` ('listed'/'unlisted'), `branding` jsonb, `created_by`, timestamps | One per owner. Drives `/book/[slug]`. **[REVIEW]** `slug` uniqueness = a single **global** unique index on `lower(slug)` (one `/book/:slug` namespace for all owner types); use `citext` or an expression index so `Smith`/`smith` collide. `timezone` is the default display tz for the public page when the viewer tz is unknown and for home/business composed pages (which have no single member tz). |
| **EventType** | `id`, `owner_type`, `owner_id`, `page_id` FK, `name`, `slug`, `description`, `color`, `durations` int[] (minutes), `default_duration`, `location_mode`, `location_detail`, `assignment_mode`, `requires_approval` bool, `visibility` ('public'/'secret'), `buffer_before_min`, `buffer_after_min`, `min_notice_min`, `max_horizon_days`, `slot_interval_min`, `daily_cap`, `per_booker_cap`, **`seat_cap` (group events)** `[REVIEW]`, `price_cents`, `currency`, `deposit_cents`, **`deposit_refundable` bool, `cancellation_window_min`, `reschedule_cutoff_min`, `no_show_fee_cents`, `refund_policy` refund_policy, `allow_invitee_cancel` bool, `allow_invitee_reschedule` bool** `[REVIEW — policy columns the §5 lifecycle needs]`, `schedule_id` FK (nullable), `is_active`, `sort_order`, timestamps | `schedule_id` set for personal; null for home/business (composed from assignees). |
| **EventTypeAssignee** | `id`, `event_type_id` FK, `subject_type` ('user'/'business_team'), `subject_id` **(real FK to the membership table; engine filters on `is_active`)** `[REVIEW]`, `weight` int, `priority` int, **`assigned_count` int, `last_assigned_at` timestamptz** `[REVIEW — round-robin rotation state]`, `is_active` | Round-robin/collective eligibility. For home, `subject_id` → `HomeOccupancy.user_id`; for business → `BusinessTeam.user_id`. **[REVIEW]** Add a trigger (or `is_active` reconciliation) so a member leaving a home/team deactivates the assignee — otherwise the engine resolves a deleted user. |
| **EventTypeQuestion** | `id`, `event_type_id` FK, `label`, `field_type` ('text'/'textarea'/'select'/'multiselect'/'checkbox'/'phone'), `options` jsonb, `required` bool, `sort_order` | Intake form. Name+email are implicit defaults. |

**[REVIEW] Owner-polymorphic integrity.** `owner_id` cannot have a polymorphic FK. Every owner-scoped table (`BookingPage`, `EventType`, `Booking`, `BookingPackage`, `HomeResource`) carries the polymorphic `(owner_type, owner_id)` pair **plus** the three nullable typed FK columns above with an `exactly-one-non-null` CHECK and per-column `ON DELETE CASCADE`. This gives real referential integrity and free cleanup on user/home/business deletion. Add an integration test asserting deletion cascades.

### 3.3 Availability (personal source of truth)

| Table | Key columns | Notes |
|---|---|---|
| **AvailabilitySchedule** | `id`, `user_id` FK, `name`, `timezone`, `is_default` bool, timestamps | User-scoped only. Seed one default per user. **[REVIEW]** The `User` table has **no** timezone column — `AvailabilitySchedule.timezone` is the only tz source, so it **must be seeded for every member** added as an `EventTypeAssignee` (seed at add-time, not lazily), or the engine has no tz fallback. |
| **AvailabilityRule** | `id`, `schedule_id` FK, `weekday` smallint (0–6), `start_time` time, `end_time` time | Multiple rows/weekday → multiple blocks per day. **[REVIEW]** Index `(schedule_id, weekday)`. |
| **AvailabilityOverride** | `id`, `schedule_id` FK, `date`, `is_unavailable` bool, `start_time` time, `end_time` time | Date overrides + day-off + vacation ranges. |
| **AvailabilityBlock** | `id`, `user_id` FK, `title`, `start_at` timestamptz, `end_at` timestamptz, `recurrence_rule` text | The "block off time" busy override (inverse of a booking). Feeds free/busy directly. **[REVIEW]** Index `(user_id, start_at, end_at)`. Recurring blocks are RRULE-expanded at compute time (§5) — they are **not** fetched by a `start_at`-window filter (their anchor predates the window). |

### 3.4 Bookings & lifecycle

| Table | Key columns | Notes |
|---|---|---|
| **Booking** | `id`, `event_type_id` FK, `owner_type`, `owner_id` (+ typed FKs per §3.2), `page_id`, `host_user_id` (assigned member; set at **create** time for round-robin), `invitee_user_id` (nullable), `invitee_name`, `invitee_email`, `invitee_phone`, `invitee_timezone`, `start_at`, `end_at`, `status` booking_status, `location_mode`, `location_detail`, `intake_answers` jsonb, **`policy_snapshot` jsonb** `[REVIEW — cancellation/refund terms frozen at booking time]`, **`rescheduled_from_booking_id` self-FK (nullable), `previous_start_at`** `[REVIEW — reschedule audit trail]`, `recurrence_group_id` uuid (nullable), `resource_id` FK (nullable), `payment_id` FK→Payment (nullable), `package_credit_id` FK (nullable), `created_via` ('public_link'/'in_app'/'manual'/'one_off'), `cancel_reason`, `cancelled_by`, `created_by`, timestamps | **[REVIEW] No write-through.** Confirmed home bookings are surfaced on the household calendar via a **query-time union** (§3.5, §12), so there is no `HomeCalendarEvent` copy to keep in sync. |

**[REVIEW] Indexes & the slot-race guard (the highest-stakes correctness item):**
- Ordinary: `(owner_type, owner_id, start_at DESC)`, `(host_user_id, start_at)`, `(invitee_user_id, start_at)`, `(invitee_email, start_at)`, `(status)`.
- Hot-path partial: `Booking(start_at) WHERE status IN ('pending','confirmed')` for the slot-subtraction and reminder scans.
- **Atomic double-book prevention** — an application re-check is *not* atomic under concurrency. Use a Postgres **exclusion constraint** (needs `btree_gist`):
  ```sql
  ALTER TABLE "Booking" ADD CONSTRAINT booking_no_overlap
    EXCLUDE USING gist (
      host_user_id WITH =,
      tstzrange(start_at - (buffer_before || ' min')::interval,
                end_at   + (buffer_after  || ' min')::interval) WITH &&
    ) WHERE (status IN ('pending','confirmed'));
  ```
  The range is **buffer-padded** so adjacent buffered bookings collide. For **group** events (`assignment_mode='group'`, `seat_cap > 1`) this hard exclusion is wrong — N invitees may share a slot up to `seat_cap`; handle group capacity with a count-check at create time (mirror `supportTrains.js:2317`), not the exclusion constraint. The booking-create path catches the `23P01` (exclusion violation) and returns **409 "slot taken."**

| Table | Key columns | Notes |
|---|---|---|
| **BookingAttendee** | `id`, `booking_id` FK, `user_id`, `rsvp_status`, `is_required` bool | Group events, collective required-members, and home RSVP. |
| **BookingToken** | `id`, `booking_id` (nullable), `event_type_id` (nullable), `token_hash`, `kind` booking_token_kind, `expires_at`, `single_use` bool, `consumed_at` | Reuses the verified token pattern from **`backend/routes/businessSeats.js`** `[REVIEW — it's a route helper, not a "BusinessSeat service"]`: `crypto.randomBytes(32).toString('hex')` → store SHA-256 hash, send raw token. Powers `/manage` links and one-off links. **[REVIEW]** The cited precedent clears the hash on use; we use `consumed_at` instead for a cleaner audit trail — note the intentional divergence. |

### 3.5 Home extensions

| Table | Key columns | Notes |
|---|---|---|
| **HomeResource** | `id`, `home_id` FK, `name`, `resource_type` ('room'/'vehicle'/'tool'/'charger'/'other'), `photo_url`, `who_can_book` ('members'/'specific'/'guests'), `max_duration_min`, `buffer_min`, `requires_approval` bool, `available_hours` jsonb, `created_by`, timestamps | Resource bookings are `Booking` rows with `resource_id` set + `owner_type='home'`. |

**[REVIEW] Household calendar = query-time union (decided).** Find-a-time, who's-free, visits, and the household calendar read are **computed views** that `UNION` `Booking` + `HomeCalendarEvent` + member availability — nothing is copied between tables. This eliminates the dual-write drift class entirely (the rejected write-through alternative required a `booking_id` back-pointer on `HomeCalendarEvent` and in-transaction mirroring of every cancel/reschedule). The engine's home-busy step (§5) reads `HomeCalendarEvent` directly. **Attribution rule:** a `HomeCalendarEvent` makes member *m* busy iff `assigned_to IS NULL` (whole-home) **OR** `m = ANY(assigned_to)`. **Timezone:** `HomeCalendarEvent.start_at/end_at` are bare `timestamptz` (instants) with no tz column; the engine localizes them into the schedule's tz before subtracting from wall-clock windows.

**[REVIEW] Meeting polls are NOT free reuse of `HomePoll`.** `HomePoll`/`HomePollVote` are choice-voting (`single_choice`/`multiple_choice`/`yes_no`/`ranking`) over free-text options, and live only in a supabase migration — they are absent from `schema.sql` and `home.js:7209` even guards with a "table not found" fallback. They have **no** time-slot semantics. For v1, prefer **direct availability intersection** (the who's-free grid) over Doodle-style polls — it needs no poll model. If time-polls are wanted later, budget a `start/end/tz` option type + a vote→engine reconciliation adapter as **new** work, not reuse.

### 3.6 Payments, packages, invoicing (extends the gig-shaped stack — see §4.4)

**[REVIEW] Reframed.** "Zero new payment *tables*" is true, but the stack is structurally gig-shaped, so this is **extend**, not free reuse. Concretely required:
- `Payment.booking_id` (nullable, FK→Booking, ON DELETE SET NULL) + index — there is **no** generic source-link column today (`gig_id`/`gig_application_id`/`home_id` only), so bookings need their own back-pointer for webhook/settlement lookup.
- `ALTER` the `Payment.payment_type` CHECK (`schema.sql:7717`) to add `'booking_payment'`/`'package_payment'`, and the `WalletTransaction.type` CHECK (`schema.sql:4543`) to add `'booking_income'`.
- Review the `lifetime_spent`/`lifetime_received` trigger logic (`schema.sql:4664`, keyed on `p_type IN ('gig_payment','tip_sent')`) so booking spend/income is classified.

| Table | Key columns | Notes |
|---|---|---|
| **BookingPackage** | `id`, `owner_type`, `owner_id` (+ typed FKs), `name`, `sessions_count`, `price_cents`, `currency`, `event_type_id` (nullable), `is_active`, timestamps | A sellable bundle of sessions. **[REVIEW]** v2-leaning — see §10. |
| **PackageCredit** | `id`, `package_id` FK, `buyer_user_id`, `total`, `remaining`, `payment_id` FK→Payment, `purchased_at`, `expires_at` | Redeemed by `Booking.package_credit_id`. |

**Invoices** reuse the existing `BusinessInvoice` table (`line_items` jsonb, `subtotal_cents`, `fee_cents`, `total_cents`, `status`, `payment_id`, `stripe_payment_intent_id`). **Payments** reuse the `Payment`/`Refund`/`Payout`/`Wallet`/`WalletTransaction` tables with the extensions above.

### 3.7 Automations & deferred

| Table | Key columns | Notes |
|---|---|---|
| **SchedulingWorkflow** | `id`, `owner_type`, `owner_id`, `event_type_id` (nullable), `name`, `trigger` ('booking_created'/'cancelled'/'rescheduled'/'before_start'/'after_end'), `offset_minutes`, `action` ('email'/'push'/'in_app'/'sms'), `message_template`, `is_active` | v1 ships a "default reminders" preset (1 day + 1 hour before); the full editor is v2. |
| **BookingReminderLog** | `id`, `booking_id` FK, `workflow_id` (nullable), `kind`, `sent_at`, **`UNIQUE(booking_id, kind)`** `[REVIEW — the plan relies on dedupe but tabled no constraint]` | Idempotence for the reminder cron (mirrors `auto_reminder_count`/`last_worker_reminder_at` on gigs). |
| **EmailSuppression** *(v1, for non-user invitees)* `[REVIEW]` | `id`, `email_hash`, `reason`, `created_at` | One-click unsubscribe / suppression list for **reminder** emails to non-users (transactional confirmations are always sent). The reminder cron consults it. |
| **ConnectedCalendar** *(stub)* | `id`, `user_id`, `provider`, `external_account`, `access_token_enc`, `refresh_token_enc`, `sync_token`, `check_conflicts` bool, `write_target` bool, `last_synced_at`, `status` | Created empty/disabled; the engine reads it only when populated. **[REVIEW]** The cheapest, highest-value first slice is **read-only Google free/busy import** (`check_conflicts=true`, `write_target=false`) for the **personal** pillar — strongly consider for v1 (§12). |

### 3.8 RLS & access control

**[REVIEW] First, reconcile with current migration practice** (§3 intro): recent feature migrations (148–158) ship **without** RLS/GRANT and rely on route-handler gating. Decide whether Calendarly re-introduces RLS as defense-in-depth (recommended for the home-scoped + public-read tables, matching `HomeCalendarEvent`) or matches recent practice. Whichever — **route handlers remain the primary gate** (they use `supabaseAdmin`/`service_role` after `homePermissions.hasPermission(...)`).

- **Home-scoped** rows (`HomeResource`, home `Booking`/`EventType`/`BookingPage`): RLS via `home_has_permission(home_id, 'calendar.view'|'calendar.edit')` + `home_can_see_visibility(...)`, like `HomeCalendarEvent` (`schema.sql:6240`). `calendar.view`/`calendar.edit` exist (`schema.sql:233-234`). **[REVIEW]** A richer IAM exists than the plan assumed — `HomeRolePermission` + `HomePermissionOverride` (per-user overrides), already integrated in `homePermissions.js:61-81`. Call `hasPermission()` directly; don't reimplement role logic.
- **User-scoped** rows (`AvailabilitySchedule`, `AvailabilityRule/Override/Block`, personal `EventType`/`BookingPage`/`Booking`): RLS via `created_by = auth.uid()` / `user_id = auth.uid()`.
- **Business-scoped** rows: `BusinessTeam` membership check. **[REVIEW]** Note the identity-firewall split: `BusinessTeam` (membership) vs `BusinessSeat` (invite/seat, newer, in `20260301000001_identity_firewall_tables.sql`) + `SeatBinding` (the vault mapping seats→real users). Pin `EventTypeAssignee.subject_id` to `BusinessTeam.user_id` (membership) explicitly.
- **Public read**: `/api/public/book/:slug` reads via `supabaseAdmin` and redacts (the `routes/public.js` pattern). Public **writes** are new — see §4.2.

---

## 4. Backend — routes & services

### 4.1 New files (follow the verified anatomy)

```
backend/routes/scheduling.js          # personal + business host APIs (mount: app.use('/api/scheduling', ...))
backend/routes/schedulingPublic.js    # OR add to routes/public.js — the /book/:slug flow (NB: public WRITES, see §4.2)
backend/services/scheduling/
  availabilityService.js              # the free/busy compute engine (§5) — THE new subsystem
  bookingService.js                   # create/confirm/cancel/reschedule + DB-level conflict 409 (§3.4)
  eventTypeService.js                 # CRUD + assignee/question management
  packageService.js                   # package purchase + credit redemption (wraps stripeService)
  schedulingPaymentsService.js        # booking↔Payment orchestration over backend/stripe/stripeService.js
  bookingNotifyService.js             # [REVIEW] invitee-type-aware fan-out: user→notif+push, email-only→emailService
  icsService.js                       # [REVIEW] .ics (VEVENT) generation for add-to-calendar
backend/jobs/bookingReminders.js      # node-cron; cron scaffold ports from autoRemindWorker, worker body is new
```

**[REVIEW] Path corrections:** the Stripe service is at **`backend/stripe/stripeService.js`**, not `backend/services/`. Scheduling services `require('../../config/supabaseAdmin')` and `require('../../stripe/stripeService')`.

Home-scoped endpoints mount under the existing home router surface (`/api/homes/:id/scheduling/*`) so they inherit `homePermissions`; personal/business under `/api/scheduling`. Mount in `backend/app.js` near the other feature routers (lines ~305–404), **before** any catch-all `/:id` routes. All write routes use `verifyToken` + `validate(joiSchema)`.

### 4.2 Endpoint inventory

**Host — authed (`/api/scheduling`, owner context via query/body; home alias `/api/homes/:id/scheduling`):**

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/event-types` | list / create |
| GET/PUT/DELETE | `/event-types/:id` | read / update / delete |
| PUT | `/event-types/:id/questions` · `/assignees` | intake + round-robin/collective config |
| GET/POST | `/availability` | list / create schedule |
| GET/PUT/DELETE | `/availability/:id` | read / update / delete schedule |
| PUT | `/availability/:id/rules` · `/overrides` | weekly hours + date overrides |
| POST/DELETE | `/availability/blocks` · `/blocks/:id` | block off / unblock time |
| GET/PUT | `/booking-page` · `/booking-page/slug` | page config + slug claim |
| GET | `/bookings?status&scope` | inbox (Upcoming/Pending/Past/Cancelled, scope pill) |
| GET | `/bookings/:id` | detail |
| POST | `/bookings` | manual / on-behalf booking |
| POST | `/bookings/:id/approve` · `/decline` · `/reschedule` · `/cancel` · `/no-show` · `/reassign` | lifecycle |
| GET/POST · GET/PUT | `/packages` · `/packages/:id` | package CRUD (v2-leaning) |
| GET | `/invoices` · `/invoices/:id` | reuse `BusinessInvoice` |
| POST | `/invoices/:id/send` | reuse |
| GET/POST · PUT/DELETE | `/workflows` · `/workflows/:id` | automations (v2) |
| GET | `/insights` | analytics (v2 dashboard; **capture v1 — see §4.3**) |

**Public — no auth (`/api/public`) — [REVIEW] these are the repo's first unauthenticated WRITE endpoints:**

| Method | Path | Purpose |
|---|---|---|
| GET | `/book/:slug` | page + visible event types (`is_live` gate) |
| GET | `/book/:slug/:eventTypeSlug/slots?from&to&tz` | **computed free slots** (calls availabilityService; **clamp window to `max_horizon_days`, reject larger with 400**) |
| POST | `/book/:slug/:eventTypeSlug` | create booking (pending/confirmed; payment step if priced) |
| GET | `/booking/:token` | manage view via token |
| GET | `/booking/:token/ics` | **[REVIEW]** download `.ics` |
| POST | `/booking/:token/reschedule` · `/cancel` | invitee-side, policy-gated |

**[REVIEW] Security model for public writes (do NOT copy the read-only `routes/public.js` pattern + `previewLimiter`).** The correct precedent is the Support Trains guest-reserve flow (`backend/routes/supportTrains.js:2439`):
- Add a dedicated **`bookingWriteLimiter`** to `middleware/rateLimiter.js` (tighter than the 60/min read `previewLimiter`; per-IP + per-slug).
- Gate booking on `BookingPage.is_live` (analog of `sharing_mode==='private_link'`).
- **Identity binding** via `optionalAuth` + email-match: `invitee_user_id = (req.user?.id && normalizeEmail(req.user.email) === inviteeEmail) ? req.user.id : null` (`supportTrains.js:2450`). This both prevents identity spoofing via a typed email *and* decides which notification channel fires (§4.3).
- Abuse-protect the email path (an anonymous POST can otherwise email any typed address). No captcha exists in the repo today — decide (turnstile/hcaptcha, or stricter per-IP+per-email throttle) before exposing the POST.

**Home find-a-time / resources (`/api/homes/:id/scheduling`):**

| Method | Path | Purpose |
|---|---|---|
| POST | `/find-a-time` | composed slots for {members, mode, duration, window} |
| GET | `/whos-free?from&to` | composed availability grid |
| GET/POST · GET/PUT/DELETE | `/resources` · `/resources/:rid` | resource CRUD |
| POST | `/resources/:rid/book` | book a resource (conflict-checked) |
| POST | `/visits` | vendor/guest visit window + optional link |

### 4.3 Notifications, realtime, reminders, email, .ics (reuse + new channel)

**[REVIEW] Email is a v1 channel, not deferred** — `createNotification` and `pushService.sendToUser` are strictly `userId`-keyed (`notificationService.js:301` returns null without a userId; `pushService.js:104` queries `PushToken` by user_id), but the common invitee (`invitee_user_id` NULL) is a non-user. **The infra already exists:** `emailService.js:574 sendGuestReservationConfirmationEmail` does exactly this for Support Trains guests, and `nodemailer` is a dependency.

- **`bookingNotifyService` fan-out:** if `invitee_user_id` is set → `createNotification` (`context: 'personal'`) + `pushService.sendToUser` + Socket.IO `notification:new` (all automatic, as `autoRemindWorker.js` does). If only `invitee_email` → **email** via a new `sendBookingConfirmationEmail`/`sendBookingReminderEmail` modeled on the guest-confirmation precedent, with a `.ics` attachment (§icsService) and a one-click unsubscribe token (→ `EmailSuppression`). Hosts (always users) get in-app + push.
- Register `booking_*` templates in `notificationTemplateRegistry` (`booking_confirmed`, `booking_request`, `booking_cancelled`, `booking_rescheduled`, `booking_reminder_24h`, `booking_reminder_1h`, `rsvp_request`, `find_a_time_proposed`) — none exist yet (gig/home/mail/person only). Templates are registered imperatively at module load (`notificationService.js:81-141`), not in a separate file.
- **Reminders:** `backend/jobs/bookingReminders.js` on `cron.schedule('*/15 * * * *', wrapJob('bookingReminders', fn), { timezone: 'UTC' })`, registered in `backend/jobs/index.js`. **[REVIEW]** Only the cron scaffold + `wrapJob` port from `autoRemindWorker`; the worker body is new (dual-recipient host+invitee fan-out, T-24h/T-1h windows, dedupe via `BookingReminderLog UNIQUE(booking_id,kind)`, suppression check, and render the human time in `invitee_timezone` even though the scan runs in UTC).
- **`.ics`:** `icsService` emits a `VEVENT` with a stable `UID` per booking, `METHOD:REQUEST` on confirm and `METHOD:CANCEL` on cancel (so reschedules update rather than duplicate the invitee's calendar). Same DST/DTSTART hazards as the engine — share the `luxon` tz handling.
- **Insights capture (v1, dashboard v2):** **[REVIEW]** if insights is a real surface, write a lightweight `SchedulingEvent` log (`page_id`, `event 'view'/'slot_select'/'booked'`, `ip_hash`, `ts`) from the public GET/POST in v1 — ISR caching (`revalidate:60`) means a server-component fetch won't see every view, so a client beacon may be needed. Otherwise the v1 funnel is unrecoverable.

### 4.4 Payments orchestration (extends `backend/stripe/stripeService.js`)

**[REVIEW] The stateless verbs reuse cleanly; the persistence/settlement/notification glue is gig-shaped and is real work:**
- **Paid booking**: a thin `createPaymentIntentForBooking` over `createPaymentIntentForGig` (`stripeService.js:881`, manual capture) — but set `metadata.kind='booking'`, `booking_id`, and a booking description; **do not** pass `gigId:null` into the gig path (it hardcodes gig metadata/description). On confirm → `capturePayment` (`:1075`). On cancel within policy → `createSmartRefund(paymentId, amount, …)` (`:1315`) — **`amount` is computed from the `Booking.policy_snapshot`** (§3.4), which is why the policy columns (§3.2) are a v1 requirement.
- **Settlement**: `processPendingTransfers` (`backend/jobs/processPendingTransfers.js`) is gig-coupled — it calls `creditGigIncome` unconditionally (`:238`), joins `Gig` for notification text (`:260`), links `/gigs/${gig_id}` (`:291`), and writes state back to the `Gig` row (`:86,:352`). **Branch on `payment_type`**: add a `creditBookingIncome` wallet helper (`walletService.creditGigIncome` hardcodes `p_type:'gig_income'`), and skip the Gig dual-write for bookings. The `wallet_credit` SQL function takes `p_gig_id` and rolls only `gig_income`/`tip_income` into `lifetime_received` — add a `p_booking_id` param or a sibling RPC.
- **Webhooks**: route booking events through the existing `POST /api/webhooks/stripe` (`stripeWebhooks.js`) — but every notification branch resolves gig context (`getGigInfo(payment.gig_id)` in succeeded `:498/595`, action_required `:685`, auth_required `:789`, with copy like *"Your payment for {gig title}"* and `/gigs/` links). Add a `getBookingInfo()` helper and a `payment_type` switch in each builder, else a booking payer gets *"your payment for a gig"* linking to `/gigs/null`. Add a test asserting a booking-tagged PI produces booking copy + a valid `/book` link.
- **Connect onboarding & fees**: reuse `createConnectAccount` + `createAccountLink`; fees via `calculateFees`/`getEffectiveFeeRate`.
- **CI smoke test** **[REVIEW]**: insert a `booking_payment` Payment and a `booking_income` WalletTransaction in CI so a missing CHECK-constraint mirror (§3.6) fails fast rather than at first real charge.

---

## 5. The availability / free-busy engine (the one new subsystem)

`availabilityService.computeSlots({ ownerType, ownerId, eventType, from, to, viewerTimezone })` → `Slot[]`. **[REVIEW] This is net-new ~end-to-end** — `supportTrainSlotAvailability.js` (115 lines) only counts reservations against pre-created capacity rows and has zero tz/DST/working-hours/recurrence/buffer logic, so it is not a template. Build on **`luxon`** (DST-safe wall-clock-in-zone) + **`rrule`** (expansion). Full pseudocode and edge cases in the [design doc §4](./calendarly-design-doc.md).

1. **Resolve the availability set.**
   - `user`: the event type's `AvailabilitySchedule` (rules + overrides).
   - `home`/`business`: the active `EventTypeAssignee` set → each member's personal schedule, then **intersect** (collective) or keep per-member (round-robin). A member with **no schedule contributes nothing** + surfaces a host warning (never a fabricated 9–5). **[REVIEW]** Batch every member's busy in **one** query per source (`user_id = ANY(...)`), not per-member (avoid N+1).
2. **Generate candidate starts** at `slot_interval_min` within working windows across `[from, to]`, in the schedule's timezone. Clamp `[from,to]` to `max_horizon_days` server-side.
3. **Subtract busy**: existing `Booking`s, `AvailabilityBlock`s, and — for home — overlapping `HomeCalendarEvent`s (union read, attribution rule per §3.5).
   - **[REVIEW] Overlap, not start-only.** Non-recurring busy: `start_at < to AND end_at > from` (the existing Calendar module's `start_at`-only filter would silently drop busy that starts before the window). Recurring busy: fetch **all** rows with `recurrence_rule IS NOT NULL` regardless of anchor, RRULE-expand into instances clipped to `[from,to]` (bound with UNTIL/COUNT).
   - **[REVIEW] Buffer arithmetic is asymmetric**: pad a busy interval `[s,e]` to `[s − new_event.buffer_after, e + new_event.buffer_before]` (the buffers belong to the *candidate* meeting). The create-time conflict guard (§3.4) compares the same buffer-padded ranges.
   - **[REVIEW] DST conversion**: localize `timestamptz` busy into the schedule's tz before subtracting from wall-clock windows. Test the canonical case: a 9:00 rule stays 9:00 across a spring-forward day.
4. **Apply guardrails**: `min_notice_min`, `max_horizon_days`, override-blocked dates. **[REVIEW]** `per_booker_cap` is **unenforceable at compute time** for anonymous invitees (no identity behind `previewLimiter`) — enforce it (and per-host `daily_cap`) at the **create** path, atomically with the slot-race guard; document that for anonymous invitees the cap is email-keyed and best-effort.
5. **Round-robin (eligibility only at compute time).** **[REVIEW]** computeSlots is a pure read called repeatedly — it must only compute the **set** of eligible hosts per slot (deterministic). The actual fair-rotation pick happens at **create** time, reading+updating `EventTypeAssignee.last_assigned_at`/`assigned_count` transactionally with the insert, then applying per-host `daily_cap`. (Otherwise two viewers see different hosts for the same slot, and the picked host ≠ the assigned host.)
6. **Convert** to `viewerTimezone` (DST-safe) and return labelled slots.

**[REVIEW] visibility / one-off / group matrix:** `secret` event types are excluded from page listing but slots remain computable by direct slug (obscurity, not enforcement) — confirm that's intended. `one_off` tokens pre-bind an event type (+ optional pre-selected slot), `single_use` consumes on book. `group` events hit the single-host branch but allow up to `seat_cap` concurrent bookings per slot — the create guard is **capacity-aware**, not the hard exclusion constraint.

**[REVIEW] Reschedule semantics:** during a recompute for a reschedule, exclude the in-flight booking's **own** range as busy (so it can re-pick the same time) but treat it as busy for everyone else; a confirmed reschedule atomically releases the old range and claims the new one (the exclusion constraint handles this on `UPDATE`).

**[REVIEW] Performance & DoS:** the public slots endpoint is cacheless and unauthenticated. Add: batched per-source busy queries (step 1), a short-TTL cache of computed free-sets keyed by `(owner,eventType,from,to,membersHash,busyVersion)` invalidated on Booking/Block writes, the server-side horizon clamp, and a stated target latency + a load test in Phase 0.

**[REVIEW] Phase-0 validation surface:** add a dev-only slots-debug endpoint / fixture harness that prints computed slots for real seeded schedules across a DST boundary, so engine correctness is observable **before** any UI wires it.

---

## 6. Shared TS packages

- `frontend/packages/types/src/scheduling.ts` — `EventType`, `AvailabilitySchedule`, `Booking`, `BookingPage`, `Slot`, `BookingPackage`, etc. (add to the barrel; mirror the `home.ts` style).
- `frontend/packages/api/src/endpoints/scheduling.ts` — host endpoints using the `get/post/put/del` helpers from `client.ts`; `endpoints/publicBooking.ts` for the `/api/public/book/*` flow (server-fetch friendly).
- `frontend/packages/utils/src/index.ts` — add `buildBookingPath(slug)` → `/book/${slug}` and `buildBookingPageUrl(slug)` → `${APP_WEB_URL}/book/${slug}` (mirrors `buildSupportTrainPath`/`buildSupportTrainShareUrl` at `utils/src/index.ts:60,64-65`).

---

## 7. Web surfaces

- **Public flow**: `frontend/apps/web/src/app/book/[slug]/page.tsx` (+ `book/[slug]/[eventType]/page.tsx`). Server-component fetch via a `fetchPublicBooking` helper in `src/lib/publicShare.ts` (mirrors `fetchPublicSupportTrain` at `publicShare.ts:66`, ISR `revalidate: 60`). `/book/` is confirmed-free (existing public routes are `/[username]`, `/u/[username]`, `/b/[username]`, `/gig`, `/listing`, `/post`). Add OG metadata. **[REVIEW]** The invitee **slot-picker is a new component** (date strip + time-of-day grid + tz label + "try a wider range" empty state) — Support Trains' calendar is a *visual reference*, not a base (its data model is a materialized signup list, §9).
- **Host management**: `frontend/apps/web/src/app/(app)/app/profile/schedule/*` (hub, event types, availability, booking page, bookings inbox, packages, invoices).

---

## 8. Native route additions

### 8.1 iOS (`frontend/apps/ios/Pantopus`)

1. **New module** `Features/Scheduling/` (Hub, EventTypeList/Editor, Availability, BookingsInbox, BookingDetail + action sheets), using the shared shells `ListOfRowsView`, `FormShell`, `WizardShell` (exposes `WizardIdentity` `.personal/.home/.business` — plus a `.warm` case used by Support Trains), `ContentDetailShell` (`Features/Shared/...`).
2. **Routes**: add cases to `HubRoute` (`Features/Root/HubTabRoot.swift:13`) for home-scoped scheduling and to `YouRoute` (`Features/Root/YouTabRoot.swift:18`) for personal; wire each in `destination(for:)` (where `homeCalendar`/`calendarEventDetail` are wired).
3. **Me entry**: add a `MeActionTile`/`MeSectionRow` with `routeKey = "me.scheduling"` in `Features/Me/MeViewModel.swift` (`homeActionTiles` ~L301, `homeSections` ~L314; add a Personal-pillar tile too), then handle it in `YouTabRoot.handleAction(...)`/`handleSection(...)`.
4. **Networking**: `Core/Networking/Endpoints/SchedulingEndpoints.swift` (mirror `HomesEndpoints`/`GigsEndpoints`, annotate each `/// Route backend/routes/scheduling.js:LINE`) + `Core/Networking/Models/Scheduling/*DTOs.swift` (like `Core/Networking/Models/Homes/CalendarEventDTOs.swift:13`). Calls via `APIClient.shared.request(...)`.
5. **Extend** `Features/Homes/Calendar/` for find-a-time, who's-free, and the FAB create-menu (don't replace `HomeCalendarView`). **[REVIEW]** The invitee slot-picker is a new view, not the Support Trains store.

### 8.2 Android (`frontend/apps/android/app/.../`)

1. **New package** `ui/screens/scheduling/` using shared shells `shared/list_of_rows`, `shared/form`, `shared/wizard` (`WizardIdentity` Personal/Home/Business/Warm at `wizard/WizardIdentity.kt:24`), `shared/content_detail`.
2. **Routes**: add constants + `fun` builders to `ChildRoutes` in `ui/screens/root/RootTabScreen.kt:307` and `composable(route, arguments=...)` blocks in the NavHost, mirroring `HOME_CALENDAR`.
3. **Me entry**: add a `MeActionTile`/`MeSectionRow` with `routeKey = "me.scheduling"` in `ui/screens/you/me/MeViewModel.kt:327` (add Personal too); wire route handling in `YouScreen.kt`.
4. **Networking**: `data/api/services/SchedulingApi.kt` (Retrofit) + `data/api/models/scheduling/*Dtos.kt` (`@JsonClass(generateAdapter=true)`, `@Json(name="snake_case")`, like `data/api/models/homes/CalendarEventDtos.kt:13`) + a `SchedulingRepository` (`safeApiCall`) + DI in `NetworkModule.kt`. ViewModels `@HiltViewModel` with `StateFlow<…UiState>` sealed states.
5. **Extend** `ui/screens/homes/calendar/` for find-a-time + create menu.

Both platforms have working Calendar modules and DTOs (`CalendarEventDTO`/`CalendarEventDto`) to copy as the DTO starting template.

---

## 9. Reuse map — what we reuse, and how much glue it actually needs

**[REVIEW] Re-graded.** ✅ = reuse cleanly · 🟡 = extend (real, gig-shaped glue) · 🔵 = visual/conceptual reference only (new code).

| Need | Reuse | Grade |
|---|---|---|
| Household calendar, recurrence field, multi-assignee | `HomeCalendarEvent` (`schema.sql:6240`; `assigned_to uuid[]`, `recurrence_rule`) — **read via union; `recurrence_rule` is currently un-expanded text** | 🟡 |
| Slot grid / reservation visuals | Support Trains UI — **materialized signup list, not a computed time-picker; new invitee component** | 🔵 |
| Business "team" for round-robin | `BusinessTeam` (`schema.sql:5243`) — membership; `BusinessSeat` is the separate invite/seat table | ✅ |
| Home members + roles + permissions | `HomeOccupancy` (`role_base`), `homePermissions.hasPermission` (`utils/homePermissions.js:53`), `calendar.view`/`calendar.edit`, `HomeRolePermission`/`HomePermissionOverride` | ✅ |
| Paid bookings, refunds, transfers, escrow | `backend/stripe/stripeService.js` stateless verbs reuse; **but `Payment` needs `booking_id`, 2 CHECK ALTERs, wallet RPC/helper changes, `processPendingTransfers` + `stripeWebhooks` branches** | 🟡 |
| Invoices | `BusinessInvoice` table | ✅ |
| Payouts / earnings | `walletService.js`, `earningsService.js`, `routes/wallet.js`, Wallet/Earn screens — **add `creditBookingIncome` + `booking_income` ledger type** | 🟡 |
| Notifications + push + realtime | `notificationService`, `notificationTemplateRegistry`, `pushService`, `notification:new` — **users only; non-user invitees need email** | 🟡 |
| Transactional email (non-user invitees) | `emailService.js:574 sendGuestReservationConfirmationEmail` precedent + `nodemailer` — **new booking templates + `.ics` + suppression** | 🟡 |
| Time-based reminders | `jobs/autoRemindWorker.js` — **cron scaffold + `wrapJob` port; worker body new** | 🟡 |
| Shareable / one-off links | `businessSeats` token pattern (`routes/businessSeats.js:99`, `randomBytes`+SHA-256+expiry) | ✅ |
| Public pages | `routes/public.js` (reads), web `[username]`/`support-trains/[id]`, `lib/publicShare.ts` — **public *writes* are new; use the `supportTrains.js:2439` write precedent** | 🟡 |
| Find-a-time / meeting polls | `HomePoll` — **choice-voting, no time-slot semantics, migration-only; prefer direct intersection** | 🔵 |
| Native shells | `ListOfRows`/`Form`/`Wizard`/`ContentDetail` (both platforms) | ✅ |

---

## 10. v1 / v2 phasing

**[REVIEW] v1 = Personal + Home together** (decided). Engine-first sequencing is retained.

**Phase 0 — Engine + data (foundation).** Migrations 159–161 (incl. `btree_gist`, the overlap constraint, policy columns, `Payment.booking_id`, CHECK ALTERs); add `luxon`/`rrule`/`ical-generator`; `availabilityService` + a thorough test suite (DST, buffers, recurring-busy overlap, intersection); `bookingService` core with the DB-level 409; `bookingNotifyService` + email; `icsService`; shared types. The **slots-debug validation surface**. No UI.

**Phase 1 — Personal + Home v1 (the lovable core).**
- *Personal:* event-type list/editor, availability editor + block-off-time, booking-page management + share, public `/book/[slug]` flow (landing → slot picker → details+confirm → confirmed → email + `.ics`), bookings inbox + detail + approve/reschedule/cancel, default reminders. **[REVIEW]** Personal carries the real-calendar caveat — strongly consider the read-only Google free/busy import (§3.7/§12) so a personal link doesn't double-book against the user's real calendar.
- *Home:* extend Home calendar (FAB menu, RSVP), **find-a-time** (compose member availability), **who's-free**, resources, schedule-a-visit, household calendar = union. This is the differentiated wedge where the no-sync gap is survivable.

**Phase 2 — Business (single-host paid).** Business pillar, single-host paid bookings (one assignee, manual capture → capture-on-confirm → smart refund), invoices. **[REVIEW]** Round-robin assignment is deferred here — it's hard correctness code on top of the riskiest subsystem, for a realistic team size of 1–3.

**Phase 3 — Round-robin + packages + automations + insights.** Round-robin fair rotation (create-time, §5), packages/credits, workflow editor + message templates, analytics dashboards (data captured from v1, §4.3).

**Deferred (Tier C).** Full external calendar sync (Google two-way → Outlook → Apple/CalDAV), video integration (Zoom/Meet/Teams), SMS/WhatsApp (Twilio). The `ConnectedCalendar` stub exists so sync lights up without a schema change. **[REVIEW]** Read-only Google free/busy *import* is split out of this and proposed for v1-personal — it is far cheaper than two-way write-back+webhooks.

---

## 11. Risks & sequencing

1. **Free/busy correctness** (timezones, DST, buffers, intersection, **recurring-busy overlap**) is the top risk — engine first, behind a thorough test suite + the slots-debug surface, before any UI.
2. **Atomic double-booking** — the 409 must be a **DB-level overlap-exclusion constraint** (§3.4), not an application re-check. The Support Trains atomicity came from a unique partial index on materialized slots, which does not transfer to on-the-fly slots.
3. **Recurrence** needs `rrule`; `HomeCalendarEvent.recurrence_rule` is stored text that nothing expands today — this is build, not reuse.
4. **Non-user invitee delivery** — email is on the v1 critical path; without it the core loop can't confirm/remind the person who booked.
5. **Payment glue is gig-shaped** — budget the column/constraint/RPC/cron/webhook branching as real Phase-0/2 work, and ship the CHECK ALTERs in the numbered+timestamped mirror pair (this repo has had migration drift).
6. **Public-write abuse** — dedicated limiter + `is_live` gate + email-match binding + abuse protection on the email path.
7. **Identity firewall** — composing a member's personal free/busy into another owner's view must expose booleans only and require opt-in.
8. **Targeted tests only** (per team convention) — test the new scheduling services/screens, not full suites.

---

## 12. Open decisions

- **Read-only Google free/busy import in v1?** **[REVIEW]** Strongly recommended for the **personal** pillar to remove the double-book against users' real calendars (the cheap ~20% of full sync: OAuth + free/busy read, `check_conflicts=true`, no write-back). Decide before exposing a public personal `/book` link. *(Owner: product + eng.)*
- **RLS vs route-gating for the new tables.** **[REVIEW]** Recent migrations (148–158) ship without RLS. Recommend RLS on home-scoped + public-read tables (defense-in-depth) and route-gating for the rest. *(§3.8)*
- **Owner context in API**: home under the home router (inherits permissions), personal/business under `/api/scheduling`. *(Recommended.)*
- **Group seat caps**: capacity-aware create-check (mirror `supportTrains.js:2317`) vs the hard exclusion constraint — **decided: capacity-check for group, exclusion for everything else.**
- **`BookingToken`**: `consumed_at` (cleaner audit) vs clear-hash-on-use (the cited precedent) — **decided: `consumed_at`.**
- **Slug namespace**: single global `lower(slug)` unique across all owner types under `/book/` — **decided.** Seed personal pages from username where free, suffix otherwise.
- **Home calendar surfacing**: **decided — query-time union**, not write-through.
- **Package fee override**: extend `getEffectiveFeeRate` per-package vs inherit business default — **inherit for v1.**
- **Per-invitee self-overlap** (same email books two conflicting slots across event types/owners): accept (Calendly default) vs prevent. **[REVIEW]** Recommend accept for v1 (invitee is responsible) but state it explicitly; if prevent, add a create-time check + index on `(invitee_email, start_at)`.
