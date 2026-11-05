# Crew Day contract

The data, API, money flow, notifications and jobs. **CDSRV owns this file**: it may refine it, and every change ships
in the PR that implements it, with a line in the notes folder's `CHANGES.md`. Apps build to what is merged in
`crew-day`. Screen numbers refer to [`01-spec.md`](01-spec.md).

## 1. The switch

- Key `crew_day`, added beside `pulse_redesign` in `backend/utils/featureFlags.js` (env `LAUNCH_FEATURES`),
  `frontend/apps/web/src/lib/featureFlags.ts` (`NEXT_PUBLIC_LAUNCH_FEATURES`, `launchFeatures.crewDay`),
  `frontend/apps/ios/Pantopus/Core/Environment/LaunchFeatures.swift` (`case crewDay = "crew_day"`) and
  `frontend/apps/android/.../core/LaunchFeatures.kt` (`CREW_DAY("crew_day")`), and a row in
  `docs/launch-scope-flags-2026-10-01.md` (cut 13).
- Off: every `/api/crew-days*` and `/api/admin/crew-days*` route answers 403 `{ "code": "CREW_DAY_UNAVAILABLE" }`;
  every `crew_day_*` notification type is dropped at creation and filtered from lists and counts (the type map in
  `featureFlags.js`); the jobs skip (`skipForLaunchCut('crew_day', …)`); the web's Crew Day pages are not found and
  its entry points hidden; the apps hide entry points and drop Crew Day links.
- Tests keep running with `all`.

## 2. Tables

Three new tables, approved by the founder on November 5. One additive migration in `supabase/migrations/`, timestamped
after `crew-day`'s newest. RLS enabled with no client policies: only the server (service role) reads and writes them,
like the Plans tables.

### `CrewDay`: a crew's street day, or a household's request for one

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `kind` | text | `offer` (a crew's street day) or `request` (a household's "Ask for a Crew Day") |
| `business_user_id` | uuid → `User` | the crew's business account; null for a request |
| `created_by` | uuid → `User` | the crew member, or the requesting household |
| `service` | text | `gutter_cleaning`, `leaf_cleanup`, `roof_moss`, `holiday_lights`, `window_washing`, `pressure_washing`, `other` |
| `title` | text 1–80 | "Gutter Day on Maple Lane" (the server builds it from service + street when not given) |
| `street_label` | text 1–80 | "Maple Lane" |
| `city`, `state` | text | "Camas", "WA" |
| `center_latitude`, `center_longitude` | double | the area's center (offers: from the crew; requests: the household's home) |
| `radius_m` | int 100–1600 | offers only |
| `timezone` | text | IANA, default `America/Los_Angeles` |
| `service_date` | date | offers |
| `window_start`, `window_end` | time | the arrival window, local |
| `capacity` | int 1–60 | homes |
| `booking_closes_at` | timestamptz | default: the window's start minus 48 hours |
| `included` | text[] | up to 6 items, each ≤ 120 |
| `outside_only` | boolean | default true |
| `prep_note` | text ≤ 500 | shown to households after booking |
| `price_options` | jsonb | `[{ "id", "label", "price_cents" (null when needs_look), "needs_look": bool }]`, 1–6 |
| `add_ons` | jsonb | `[{ "id", "label", "price_cents" }]`, 0–4 |
| `share_code` | text unique | 8 characters, `[a-z2-9]` without look-alikes; the invitation URL |
| `status` | text | offers: `draft`, `pending_review`, `declined`, `open`, `in_progress`, `done`, `cancelled`; requests: `requested`, `offer_ready`, `no_crew` |
| `review_note`, `reviewed_by`, `reviewed_at` | | the operator's approval or decline |
| `cancel_reason`, `cancelled_by`, `cancelled_at` | | |
| `proposed_dates` | jsonb | the open rain proposal: `{ "id", "dates": [{ "date", "window_start", "window_end" }], "deadline_at", "note", "sent_at" }` or null |
| `request_months` | text[] | requests: `["2026-12", …]` or `["any"]` |
| `request_note` | text ≤ 500 | requests |
| `request_home_id` | uuid | requests; no foreign key (like `Plan.place_home_id`) |
| `fulfilled_by` | uuid → `CrewDay` | a request answered by an offer |
| `repeat_of` | uuid → `CrewDay` | "Offer a Crew Day here again" |
| `created_at`, `updated_at`, `started_at`, `completed_at` | timestamptz | |

Derived, never stored: `booked_count` (active bookings), `spots_left`, `is_full`, `is_closed` (now ≥
`booking_closes_at`), `window_starts_at` / `window_ends_at` (instants), `cancel_cutoff_at` (= `window_starts_at` − 48 h).

### `CrewDayBooking`: one home on a crew's route

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `crew_day_id` | uuid → `CrewDay` (cascade) | |
| `household_user_id` | uuid → `User` | who booked |
| `home_id` | uuid | when booked for a Home in Pantopus; no foreign key |
| `address_line`, `address_city`, `address_state`, `address_zip` | text | the address the crew sees in the job window |
| `latitude`, `longitude` | double | in-area check and route order |
| `option_id` | text | from `price_options` |
| `add_on_ids` | text[] | |
| `price_cents` | int | null while `price_pending` |
| `status` | text | below |
| `service_date`, `window_start`, `window_end` | | the booking's own day (rain can split a Crew Day across dates) |
| `eta_start`, `eta_end`, `eta_updated_at` | timestamptz | "On the way · expected 10–11 AM" |
| `route_position` | int | the crew's order |
| `access_note` | text ≤ 500 | crew-visible in the job window only; cleared 7 days after the booking ends |
| `gate_ready_at` | timestamptz | |
| `payment_method_id` | text | the household's saved Stripe payment method, checked at booking |
| `done_at`, `done_by`, `done_note` (≤ 500), `photo_paths` (text[] 1–8) | | |
| `charge_due_at` | timestamptz | `done_at` + 24 h |
| `household_confirmed_at` | timestamptz | "Everything looks good" |
| `invoice_id` | uuid → `BusinessInvoice` | made when the crew marks the home done |
| `charge_failure` | text | `card_declined`, `authentication_required`, … |
| `problem_status` | text | null, `open`, `resolved` |
| `problem_kind` | text | `missed`, `damage`, `no_show`, `charge`, `other` |
| `problem_note` (≤ 1000), `problem_photo_paths` (≤ 4), `problem_opened_at`, `problem_due_at`, `problem_resolved_at`, `problem_resolution` (`released`, `refunded`, `partial_refund`, `resolved`), `refunded_cents` | | |
| `new_date_choice` | jsonb | `{ "proposal_id", "date" or "cancel", "answered_at" }` |
| `remind_next_season` | boolean | default false |
| `cancelled_by` (`household`, `crew`, `operator`, `system`), `cancelled_at`, `cancel_reason` | | |
| `client_request_id` | text | idempotent booking; unique per household |
| `created_at`, `updated_at` | | |

**Status:** `price_pending` (waiting for the crew's price) → `price_offered` (household approves or declines) →
`booked` → (`new_dates` → `booked` | `cancelled`) → `on_the_way` → `done` → `paid` (or `payment_failed` → `paid`
when the household pays) → `refunded` (full refund). `cancelled` and `declined` (the crew can't take this home) end
it. Active (counts toward capacity): every status except `cancelled`, `declined`, `refunded`. One active booking per
household per Crew Day.

### `CrewDayEvent`: the timeline (append-only)

`id`, `crew_day_id`, `booking_id` (nullable), `actor_user_id` (nullable for the system), `actor_role` (`household`,
`crew`, `operator`, `system`), `kind`, `data` jsonb, `visible_to` (`household`, `crew`, `both`, `operator`), `created_at`.
Kinds: `day_created`, `day_submitted`, `day_approved`, `day_declined`, `day_cancelled`, `day_started`,
`dates_proposed`, `price_requested`, `price_offered`, `price_approved`, `price_declined`, `booked`, `booking_changed`,
`booking_cancelled`, `release_asked`, `released`, `access_note_changed` (never the text), `gate_ready`, `on_the_way`,
`eta_changed`, `cant_get_in`, `done`, `household_confirmed`, `charged`, `charge_failed`, `paid_by_household`,
`problem_opened`, `problem_note`, `problem_resolved`, `refunded`, `date_answered`, `invited_past`, `today_dismissed`,
`request_created`, `request_answered`, `operator_viewed`, `operator_note`. Events are how every "what happened" line on
both sides is drawn, and how the operator reads a case.

### Photos

Completion and problem photos are images in a private storage bucket, under `crew-day/<crew_day_id>/<booking_id>/`,
read through short-lived signed URLs. CDSRV prefers an existing private bucket and pattern; if a new bucket is needed
it is created by the migration (additive) and listed in `FOUNDER.md` for production.

## 3. Money

- **Saving the card:** booking needs a saved card. Apps and web use the existing payment-method flow
  (`backend/routes/pays.js` `GET/POST /api/pays/methods` and the existing add-card sheet / web add-card form). The
  booking stores the chosen `payment_method_id`; the server checks it belongs to the household's Stripe customer.
- **Marking done** creates the invoice: one `BusinessInvoice` per booking (business = the crew, recipient = the
  household, one line item per option and add-on, `total_cents` = `price_cents`, fee by
  `stripeService.getEffectiveFeeRate`, `status` `sent`, memo "Crew Day: Gutter Day on Maple Lane, Tue, Nov 17",
  due date = the charge day). No generic `invoice_received` notification and no Mail bill for these invoices (the
  `crew_day_done` notice replaces them). It appears in the household's received invoices as usual.
- **The charge** (`crewDayCharges` job, every 10 minutes, and at once on "Everything looks good"): for `done`
  bookings with no open problem whose `charge_due_at` has passed or that the household confirmed, pay the invoice
  off-session with the saved card, reusing the invoice payment path (factor the internals of
  `POST /api/businesses/invoices/:invoiceId/pay` and `/confirm` into a shared service without changing those routes:
  `createPaymentIntentForGig` with `paymentMethodId` (off-session confirm), capture, `markInvoicePaid`). Success →
  `paid`, `crew_day_charged` to the household; the existing `invoice_paid` notice tells the crew. Failure
  (declined, authentication required) → `payment_failed`, `crew_day_charge_failed`; the household pays the same
  invoice through the existing invoice pay screen, which marks the booking `paid`.
- **Payout:** unchanged: the existing 48-hour hold and `processPendingTransfers` move the crew's share to its Stripe
  account. Crew Day requires payouts enabled, so the money never goes to an owner's wallet.
- **Refunds:** operator only, through the existing refund machinery (`createSmartRefund`) on the invoice's payment;
  the crew gets the existing refund notice. Before a charge, "refund" means the charge never runs: the invoice is
  voided and the booking ends `cancelled` by the operator.
- **Known people:** a household with a booking counts as known to the crew in `knownInvoiceRecipients`
  (`relation: 'crew_day'`), so the crew can invoice extra work with the existing invoices.

## 4. API

All JSON. Errors are `{ "error": "<sentence for people>", "code": "<CODE>" }`. Times are ISO instants plus the Crew
Day's `timezone`; dates are `YYYY-MM-DD` local. Money in cents. Auth is the existing `verifyToken`; the operator
routes add `requireAdmin`. Rate-limit the public routes like the Plans share routes.

### Public (no account)

| Route | Returns |
|---|---|
| `GET /api/crew-days/public/:code` | the invitation: `id`, `code`, `title`, `service`, `street_label`, `city`, `state`, `timezone`, `service_date`, `window_start`, `window_end`, `window_starts_at`, `window_ends_at`, `booking_closes_at`, `included`, `outside_only`, `price_from_cents`, `price_options`, `add_ons`, `capacity`, `booked_count`, `spots_left`, `state` (`open`, `full`, `closed`, `cancelled`, `done`), `crew { business_user_id, name, username, avatar_url, verified, rating { average, count } or null }`, and when signed in `viewer { role: crew/household/none, booking_id }`. Never addresses, households or the area's coordinates. 404 `NOT_FOUND` for unknown codes and for days not yet approved. |
| `POST /api/crew-days/public/:code/quote` | body `{ latitude, longitude, address_line, option_id, add_on_ids }` → `{ in_area, price_cents or null, needs_look, message }` |

### Household

| Route | Does |
|---|---|
| `POST /api/crew-days/:id/bookings` | body `{ client_request_id, home_id?, address { line, city, state, zip, latitude, longitude }, option_id, add_on_ids, access_note?, payment_method_id, approve_terms: true }` → 201 `{ booking }` (`booked`, or `price_pending` for a look-first option). Refuses: `DAY_NOT_OPEN`, `BOOKING_CLOSED`, `DAY_FULL`, `OUT_OF_AREA`, `ALREADY_BOOKED`, `PAYMENT_METHOD_INVALID`, `OWN_CREW`, blocked (422, no reason given). A retry with the same `client_request_id` answers with the same booking. |
| `GET /api/crew-days/mine` | `{ upcoming: [card], requests: [card], past: [card] }` for screen 10 |
| `GET /api/crew-days/today` | `{ mine: [card], nearby: [card] }` for screen 9 (nearby: at most one open day whose area holds one of my homes, not booked, not dismissed) |
| `POST /api/crew-days/:id/dismiss` | "Not for me" on the Today card |
| `GET /api/crew-days/bookings/:bookingId` | the household's booking page (screen 5): the day summary, `status`, `steps`, `eta`, `prep_note`, `access_note`, address, option and add-ons, `price_cents`, card (brand, last4), `cancel_cutoff_at`, `can_cancel`, `can_change`, `charge { due_at, amount_cents, state }`, `invoice_id`, `photos` (signed URLs) and `done_note`, `problem`, `proposal` (when `new_dates`), `share { url, message, booked_count, spots_left }`, `events` (visible to the household) |
| `PATCH /api/crew-days/bookings/:bookingId` | `{ access_note?, option_id?, add_on_ids?, remind_next_season? }`; option changes only before the cutoff, re-priced (look-first → `price_pending`) |
| `POST /api/crew-days/bookings/:bookingId/cancel` | before the cutoff: `cancelled` (free). After: 409 `ASK_THE_CREW` |
| `POST /api/crew-days/bookings/:bookingId/ask-release` | after the cutoff: records `release_asked` and tells the crew |
| `POST /api/crew-days/bookings/:bookingId/price-answer` | `{ approve: true or false }` on `price_offered` |
| `POST /api/crew-days/bookings/:bookingId/gate-ready` | sets `gate_ready_at`, tells the crew |
| `POST /api/crew-days/bookings/:bookingId/confirm` | "Everything looks good": charges now; answers with the booking (`paid` or `payment_failed`) |
| `POST /api/crew-days/bookings/:bookingId/problem` | `{ kind, note, photo_paths }` → `problem_status` `open`, charge paused, `problem_due_at` = next business day 5 PM local; tells the operator and the crew. A second call adds a note or photos. |
| `POST /api/crew-days/bookings/:bookingId/new-date` | `{ proposal_id, choice: "YYYY-MM-DD" or "cancel" }` |
| `POST /api/crew-days/uploads` | multipart image (JPEG, PNG or HEIC, ≤ 10 MB; HEIC converted) → `{ path }`; household or crew of that booking |
| `POST /api/crew-days/requests` | `{ service, home_id, months, note }` → the request (`requested`); tells the operator |

### Crew

`businessId` is the crew's business user id; access through the existing `checkBusinessPermission` (`profile.edit` for
create, edit, prices, dates, cancel and release; any business access for reading and the route).

| Route | Does |
|---|---|
| `GET /api/crew-days/business/:businessId` | `{ readiness { published, payouts_enabled, documents_verified, missing[] }, today, upcoming, pending, drafts, past }` |
| `POST /api/crew-days` | create: `{ business_id, service, street_label, city, state, center { latitude, longitude }, radius_m, service_date, window_start, window_end, capacity, booking_closes_at?, included, outside_only, prep_note, price_options, add_ons, submit, repeat_of? }` → `draft` or `pending_review` (refused until ready: `BUSINESS_NOT_READY` with `missing`) |
| `PATCH /api/crew-days/:id` | edit within the rules in `01-spec.md` 14 |
| `POST /api/crew-days/:id/submit` | draft → `pending_review` |
| `GET /api/crew-days/:id/crew` | the crew's day (15): counts, `money { gross_cents, fee_rate, net_cents, charged_cents, scheduled_cents, paused_cents }`, `needs_you` (price checks, release asks), bookings (address and first name only when the privacy rule allows; otherwise `label` "Home 3"), share link and flyer URL, events |
| `POST /api/crew-days/:id/bookings/:bookingId/price` | `{ price_cents }` → `price_offered`, or `{ decline: true, note }` → `declined` |
| `POST /api/crew-days/:id/bookings/:bookingId/release` | a home inside the cutoff, at no charge → `cancelled` (`crew`) |
| `POST /api/crew-days/:id/invite-past` | invites households this business served with a `paid` booking within the area in the last 400 days, once each → `{ invited }` |
| `POST /api/crew-days/:id/propose-dates` | `{ dates: [{ date, window_start, window_end }] (2–3), note? }` → every `booked` booking on the original date becomes `new_dates`; deadline = 24 h before the earliest date |
| `POST /api/crew-days/:id/cancel` | `{ reason }` → the day and every active booking `cancelled`, nobody charged |
| `GET /api/crew-days/:id/route?date=` | ordered homes for the date, with what the job window allows |
| `POST /api/crew-days/:id/route/order` | `{ booking_ids }` |
| `POST /api/crew-days/bookings/:bookingId/on-the-way` | `{ eta_start, eta_end }` → `on_the_way` (the day becomes `in_progress`) |
| `POST /api/crew-days/:id/running-late` | `{ minutes: 30, 60 or 90, date }` → shifts every remaining home's window and tells them |
| `POST /api/crew-days/bookings/:bookingId/cant-get-in` | `{ note }` → event, tells the household |
| `POST /api/crew-days/bookings/:bookingId/done` | `{ photo_paths (≥ 1), note? }` → `done`, the invoice, `charge_due_at` |

### Operator

| Route | Does |
|---|---|
| `GET /api/admin/crew-days?tab=waiting,open,today,problems,done,requests` | lists for 20, 22, 23 |
| `GET /api/admin/crew-days/:id` | everything (21); records `operator_viewed` |
| `POST /api/admin/crew-days/:id/approve` | `{ note? }` → `open`; tells the crew |
| `POST /api/admin/crew-days/:id/decline` | `{ note }` (required) → `declined`; tells the crew |
| `POST /api/admin/crew-days/:id/cancel` | `{ reason }` |
| `POST /api/admin/crew-days/bookings/:bookingId/problem` | `{ action: note, release, refund, resolve, amount_cents?, note }` |
| `POST /api/admin/crew-days/requests/:id` | `{ action: offer_ready, crew_day_id }` or `{ action: no_crew, note }`; tells the household |

## 5. Links

| What | Web | Apps |
|---|---|---|
| Invitation | `https://pantopus.com/crew-day/<code>` (public; `/price`, `/book`, `/booked`, `/flyer` below it) | universal link / app link on the same path; add `/crew-day/*` to the association files |
| Household booking | `/app/crew-days/bookings/<bookingId>` | native screen 5 |
| Your Crew Days | `/app/crew-days` | native screen 10 |
| Ask | `/app/crew-days/ask` | native screen 11 |
| Crew list | `/app/businesses/<businessId>/dashboard?tab=crew-days` | native screen 13 |
| Crew day | `/app/businesses/<businessId>/crew-days/<crewDayId>` | native screen 15 (16 on the day) |
| Operator | `/app/admin/crew-days`, `/app/admin/crew-days/<crewDayId>` | web only |

Notification `link`s use the web paths; the apps map them to native screens by type (memory: notification links are
resolved natively by type).

## 6. Notifications and emails

`notificationService.createNotification` with `context: 'personal'`, metadata `{ crew_day_id, booking_id }`. Push where
marked; email through the existing `emailService` (Mailpit locally). Crew notices go to the business's primary owner
and the member who created the day.

| Type | To | Push | Email | Title · body |
|---|---|---|---|---|
| `crew_day_booked` | household | yes | yes | "You're on the route" · "Gutter Day on Maple Lane, Tue, Nov 17, 9 AM–1 PM. Total $180. We'll remind you the evening before." |
| `crew_day_price_offered` | household | yes | yes | "Your price is ready: $260" · "Example Gutter Co. looked at your home. Approve it to book." |
| `crew_day_reminder` | household | yes | yes | "Gutter Day is tomorrow" · "9 AM–1 PM. Please keep the side gate unlocked and pets inside. You don't need to be home." (6 PM local, the evening before) |
| `crew_day_on_the_way` | household | yes | no | "Your crew is on the way" · "Expected 10–11 AM. Tap when the gate is ready." |
| `crew_day_eta_changed` | household | yes | no | "New arrival time" · "Example Gutter Co. now expects 11 AM–12 PM." |
| `crew_day_cant_get_in` | household | yes | no | "The crew can't get in" · the crew's note |
| `crew_day_done` | household | yes | yes | "One thing off your list" · "Gutters cleaned and flushed. See the photos. We'll charge $180 tomorrow at 11:42 AM unless something needs attention." |
| `crew_day_charged` | household | no | yes (receipt) | "Paid: $180 to Example Gutter Co." |
| `crew_day_charge_failed` | household | yes | yes | "Your card didn't go through" · "Pay $180 to Example Gutter Co. in Pantopus." |
| `crew_day_new_dates` | household | yes | yes | "Rain changed the plan" · "Example Gutter Co. can come Thu, Nov 19 or Sat, Nov 21 at the same price. No payment has been taken. If you don't answer by Wed 9 AM, we won't book a new date." |
| `crew_day_cancelled` | household | yes | yes | "Your Gutter Day was cancelled" · who cancelled; "Nothing was charged." |
| `crew_day_problem_update` | household | yes | yes | "Update on your Crew Day" · the operator's note or the outcome |
| `crew_day_request_answered` | household | yes | yes | "A crew can come to Maple Lane" / "No crew yet for Maple Lane" |
| `crew_day_invite` | household (past customers) | yes | yes | "Example Gutter Co. is back on Maple Lane" · "Tue, Nov 17. Book again: your price is $180." |
| `crew_day_approved` / `crew_day_declined` | crew | yes | yes | "Your Crew Day is open" · "Share the link: 0 of 10 booked." / "Pantopus didn't approve Leaf Day on Birch Court" · the note |
| `crew_day_new_booking` | crew | yes | no | "New home on your route" · "Gutter Day on Maple Lane: 6 of 10 booked." |
| `crew_day_price_needed` | crew | yes | yes | "A home needs your price" · "Three stories on Maple Lane." |
| `crew_day_booking_cancelled` | crew | yes | no | "A home cancelled" · "Gutter Day on Maple Lane: 5 of 10 booked." |
| `crew_day_release_asked` | crew | yes | no | "A home asks to cancel" · "Release it at no charge in Crew Days." |
| `crew_day_gate_ready` | crew | yes | no | "Gate is ready at 123 Maple Lane" |
| `crew_day_problem` | crew | yes | yes | "A household reported a problem" · "Pantopus support has it. Their charge waits." |
| `crew_day_dates_answered` | crew | no | no | in-app: "4 of 6 picked a new date" |
| `crew_day_review_needed`, `crew_day_problem_opened`, `crew_day_request_new` | operator (`ADMIN_ALERT_EMAIL` + admin users) | no | yes | with a link to the admin page |

## 7. Jobs

Follow `backend/jobs/planJobs.js` and `pgBossJobs.js`; every job skips while `crew_day` is off. Locally they run once
through the existing job launcher, so scenarios don't wait for the clock.

- `crewDayCharges` (every 10 min): §3.
- `crewDayReminders` (every 15 min): `crew_day_reminder` at 6 PM local the evening before, once per booking.
- `crewDayDeadlines` (every 15 min): new-date deadlines → unanswered bookings `cancelled` (`system`); price offers not
  answered by `booking_closes_at` → `cancelled`; days whose bookings are all settled → `done`; access notes cleared
  7 days after a booking ends.

## 8. Privacy checks on the server

- The public read and every list return counts, never other households.
- The crew's reads return an address, first name and access note only when the job window or a price check allows
  (`01-spec.md` rule 7); otherwise `label: "Home N"` and details.
- Photos: signed URLs only to the booking's household, the crew and admins.
- Blocks (`blockService`) in either direction refuse booking and hide the day from Today cards.
- Admin reads of a day record `operator_viewed`.

## 9. Room left for later (don't build)

A read of open Crew Days near a place (for the paused Pulse redesign's `service_options`, and the assistant's Stage 3)
fits `GET /api/crew-days/public/*` and the `CrewDay` area columns; postcards with per-home codes would be a column on
`CrewDayBooking`-adjacent invitations later.
