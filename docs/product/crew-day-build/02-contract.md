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
- Off: every `/api/crew-days*` and `/api/admin/crew-days*` route answers 403
  `{ "error": "Crew Day isn't available.", "code": "CREW_DAY_UNAVAILABLE" }` before any sign-in check (SRV-1);
  every `crew_day_*` notification type is dropped at creation and filtered from lists and counts (the type map in
  `featureFlags.js`); the jobs skip (`skipForLaunchCut('crew_day', …)`); the web's Crew Day pages are not found and
  its entry points hidden; the apps hide entry points and drop Crew Day links.
- Tests keep running with `all`.

## 2. Tables

Three new tables, approved by the founder on November 5, in `supabase/migrations/20261105100000_crew_day.sql` (SRV-1).
RLS enabled with no client policies or grants: only the server (service role) reads and writes them, like the Plans
tables. A trigger (`crew_day_booking_admit`) refuses a new active booking when the day isn't `open`/`in_progress`
(`CREW_DAY_NOT_OPEN`) or its active bookings already fill `capacity` (`CREW_DAY_FULL`); it locks the day's row while
counting, so two households booking the last spot at once get one booking and one `DAY_FULL`.

### `CrewDay`: a crew's street day, or a household's request for one

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `kind` | text | `offer` (a crew's street day) or `request` (a household's "Ask for a Crew Day") |
| `business_user_id` | uuid → `User` (cascade) | the crew's business account; null for a request |
| `created_by` | uuid → `User` (set null) | the crew member, or the requesting household; kept when that account goes |
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
| `submitted_at` | timestamptz | when it was sent for approval (the operator's "waiting since") |
| `review_note` (≤ 500), `reviewed_by`, `reviewed_at` | | the operator's approval or decline, or the answer to a request |
| `cancel_reason` (≤ 500), `cancelled_by` (`crew`, `operator`), `cancelled_by_user_id`, `cancelled_at` | | |
| `proposed_dates` | jsonb | the open rain proposal: `{ "id", "dates": [{ "date", "window_start", "window_end" }], "deadline_at", "note", "sent_at" }` or null |
| `request_months` | text[] | requests: `["2026-12", …]` or `["any"]` |
| `request_note` | text ≤ 500 | requests |
| `request_home_id` | uuid | requests; no foreign key (like `Plan.place_home_id`) |
| `fulfilled_by` | uuid → `CrewDay` | a request answered by an offer |
| `repeat_of` | uuid → `CrewDay` | "Offer a Crew Day here again" |
| `created_at`, `updated_at`, `started_at`, `completed_at` | timestamptz | |

An offer always has its whole form (business, radius, date, window with `window_end` after `window_start`, capacity,
`booking_closes_at`, `price_options`, `share_code`), drafts included; a request has no business and has
`request_months` (1–7). Other limits as listed: `title`, `street_label`, `city` 1–80, `state` 1–40, `included` ≤ 6.

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
| `add_on_ids` | text[] | ≤ 4 |
| `line_items` | jsonb | what was booked as priced then: `[{ "kind": "option" or "add_on", "id", "label", "price_cents" }]`; later price-list edits never change it (the invoice's line items come from it) |
| `price_cents` | int | null while `price_pending` (and on a `declined` or `cancelled` booking that never got a price) |
| `status` | text | below |
| `service_date`, `window_start`, `window_end` | | the booking's own day (rain can split a Crew Day across dates) |
| `eta_start`, `eta_end`, `eta_updated_at` | timestamptz | "On the way · expected 10–11 AM" |
| `route_position` | int | the crew's order |
| `access_note` | text ≤ 500 | crew-visible in the job window only; cleared 7 days after the booking ends |
| `gate_ready_at` | timestamptz | |
| `cant_get_in_at` | timestamptz | the crew tapped "Can't get in" (the note is in the event) |
| `payment_method_id` | text | the household's saved Stripe payment method, checked at booking |
| `reminder_sent_at` | timestamptz | the evening-before reminder went out (once per booking) |
| `release_asked_at` | timestamptz | the household asked the crew to cancel inside the cutoff ("Needs you") |
| `done_at`, `done_by`, `done_note` (≤ 500), `photo_paths` (text[] 1–8) | | |
| `charge_due_at` | timestamptz | `done_at` + 24 h |
| `household_confirmed_at` | timestamptz | "Everything looks good" |
| `invoice_id` | uuid → `BusinessInvoice` (set null) | made when the crew marks the home done |
| `charge_claimed_at`, `charge_attempts` | | the charge job claims a booking before charging it, so overlapping runs never charge twice |
| `charge_failure` | text | `card_declined`, `authentication_required`, … |
| `paid_at` | timestamptz | when the charge (or the household's own payment) went through |
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
household per Crew Day (a unique index), and `client_request_id` is unique per household.

### `CrewDayEvent`: the timeline (append-only)

`id`, `crew_day_id` (cascade), `booking_id` (nullable, cascade), `actor_user_id` (nullable for the system; set null),
`actor_role` (`household`, `crew`, `operator`, `system`), `kind` (lowercase snake case, 3–40 characters), `data`
jsonb object, `visible_to` (`household`, `crew`, `both`, `operator`), `created_at`.
Kinds: `day_created`, `day_edited`, `day_submitted`, `day_done`, `day_approved`, `day_declined`, `day_cancelled`, `day_started`,
`dates_proposed`, `price_requested`, `price_offered`, `price_approved`, `price_declined`, `booked`, `booking_changed`,
`booking_cancelled`, `release_asked`, `released`, `access_note_changed` (never the text), `gate_ready`, `on_the_way`,
`eta_changed`, `cant_get_in`, `done`, `household_confirmed`, `charged`, `charge_failed`, `paid_by_household`,
`problem_opened`, `problem_note`, `problem_resolved`, `refunded`, `date_answered`, `invited_past`, `today_dismissed`,
`request_created`, `request_answered`, `operator_viewed`, `operator_note`. Events are how every "what happened" line on
both sides is drawn, and how the operator reads a case.

### Photos

Completion and problem photos are images in the existing private completion bucket (`GIG_COMPLETION_BUCKET`, the
gig completion photos' bucket; no new bucket), under `crew-day/<crew_day_id>/<booking_id>/done-<uuid>.jpg` or
`problem-<uuid>.jpg`, stored without metadata (location, camera, time; HEIC becomes JPEG, as every Pantopus photo
upload), and read through signed URLs that last an hour (`photos: [{ path, url }]`).

## 3. Money

- **Saving the card:** booking needs a saved card. Apps and web use the existing payment-method flow
  (`backend/routes/pays.js` `GET/POST /api/pays/methods` and the existing add-card sheet / web add-card form). The
  booking stores the chosen `payment_method_id`; the server checks it belongs to the household's Stripe customer.
- **Marking done** creates the invoice: one `BusinessInvoice` per booking (business = the crew, recipient = the
  household, one line item per option and add-on (`{ description, amount_cents, quantity: 1 }`), `subtotal_cents` =
  `total_cents` = `price_cents`, `fee_cents` by `stripeService.getEffectiveFeeRate` and `calculateFees`, `status`
  `sent`, memo "Crew Day: Gutter Day on Maple Lane, Tue, Nov 17", `due_date` = `charge_due_at`). No generic `invoice_received` notification and no Mail bill for these invoices (the
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
- **Refunds:** operator only, through the existing refund machinery (`createSmartRefund`, admin mode) on the
  invoice's payment, which refunds an invoice payment **in full** only (a partial refund would strand the rest in the
  48-hour hold): after a charge the operator refunds all of it (`REFUND_IN_FULL` otherwise) and the booking ends
  `refunded`. Before a charge, refunding the whole price means the charge never runs (the invoice is voided, the
  booking ends `cancelled` by the operator, nothing is charged); an amount off ("Refunded $60 of $180") voids the
  invoice, makes a new one for the rest ("…, less $60.00 from Pantopus support") and charges it at once, with
  `refunded_cents` = the amount off.
- **The shared path** is `backend/services/invoicePayments.js` (`startInvoicePayment`, `captureInvoicePayment`,
  `markInvoicePaid`), used by `POST /api/businesses/invoices/:invoiceId/pay` and `/confirm` (unchanged) and by the
  charges. `markInvoicePaid` also turns a Crew Day booking `paid` (event `charged`, or `paid_by_household` after a
  failed charge) and sends `crew_day_charged`. A declined card ends `payment_failed` with `charge_failure` (Stripe's
  decline code, or `authentication_required`).
- **Known people:** a household with a booking counts as known to the crew in `knownInvoiceRecipients`
  (`relation: 'crew_day'`), so the crew can invoice extra work with the existing invoices.

## 4. API

All JSON. Errors are `{ "error": "<sentence for people>", "code": "<CODE>" }`. Reads answer the object itself (no
wrapper); writes that change one booking or one day answer `{ "booking": … }` or `{ "crew_day": … }`, the same shape
the matching read returns; lists answer the named arrays shown. Times are ISO instants plus the Crew
Day's `timezone`; dates are `YYYY-MM-DD` local. Money in cents. Auth is the existing `verifyToken`; the operator
routes add `requireAdmin`. Rate-limit the public routes like the Plans share routes.

### Public (no account)

| Route | Returns |
|---|---|
| `GET /api/crew-days/public/:code` | the invitation: `id`, `code`, `title`, `service`, `street_label`, `city`, `state`, `timezone`, `service_date`, `window_start`, `window_end`, `window_starts_at`, `window_ends_at`, `booking_closes_at`, `included`, `outside_only`, `price_from_cents`, `price_options`, `add_ons`, `capacity`, `booked_count`, `spots_left`, `availability` (`open`, `full`, `closed`, `cancelled`, `done`; `state` is the US state everywhere), `crew { business_user_id, name, username, avatar_url, verified, rating { average, count } or null }`, and when signed in `viewer { role: crew/household/none, booking_id }`. Also `service_label`, `price_options[{ id, label, price_cents or null, needs_look }]`, `add_ons[{ id, label, price_cents }]`. Never addresses, households or the area's coordinates. 404 `NOT_FOUND` ("This Crew Day isn't available.") for unknown or malformed codes and for days not yet approved (a day cancelled after approval stays readable as `cancelled`). Limited like the Plans share page (60 a minute per IP). |
| `POST /api/crew-days/public/:code/quote` | body `{ latitude, longitude, address_line, option_id, add_on_ids }` → `{ in_area, price_cents or null, needs_look, line_items, message }`. `message` is the out-of-area sentence ("This Crew Day doesn't reach 456 Oak Street. It covers homes near Maple Lane.") or the look-first one, else null. Same limits and 404 as the public read. |

### Household

| Route | Does |
|---|---|
| `POST /api/crew-days/:id/bookings` | body `{ client_request_id (8–100), home_id?, address { line, city, state, zip, latitude, longitude }, option_id, add_on_ids, access_note?, payment_method_id, approve_terms: true }` → 201 `{ booking }` (the booking page below; `booked`, or `price_pending` for a look-first option). With `home_id` (one of the person's homes) the home's address and point are used and `address` is ignored. `payment_method_id` is a Stripe `pm_…` the household saved through the add-card flow (`GET /api/payments/methods`). Refuses: `VALIDATION` (422; also `approve_terms` not true), `NOT_FOUND`, `DAY_NOT_OPEN`, `BOOKING_CLOSED` (409, "Booking closed on Sun, Nov 15."), `DAY_FULL` (409, "This Crew Day filled up while you were booking."), `OUT_OF_AREA` (422, with the out-of-area sentence), `ALREADY_BOOKED` (409), `PAYMENT_METHOD_INVALID` (422, "Your card couldn't be saved. Try another card."), `OWN_CREW` (409), `CANNOT_BOOK` (422, a block either way; no reason given). A retry with the same `client_request_id` answers 200 with the same booking. |
| `GET /api/crew-days/mine` | `{ upcoming: [card], requests: [request], past: [card] }` for screen 10. Booking card: `{ booking_id, crew_day_id, code, title, service, service_label, street_label, timezone, service_date, window_start, window_end, window_starts_at, status, price_cents, charge, eta, photo_count, problem_status, crew { name, username } }`; past cards add `book_again { crew_day_id, code, service_date }` or null (the same crew has an open day reaching this home). Request: `{ id, title, service, service_label, street_label, months, note, status, answer_note, answered_at, offer { crew_day_id, code } or null, created_at }`. |
| `GET /api/crew-days/today` | `{ mine: [card + today_state], nearby: [card] }` for screen 9. `mine`: active bookings from 7 days before their date through 2 days after, or any that needs an answer; `today_state` is `price_ready`, `new_dates`, `payment_failed`, `done` (photos to check), `on_the_way`, `today`, `tomorrow`, or the status. `nearby`: at most one open day (booking still open, not full) whose area holds one of my homes, not booked, not dismissed, no block either way: `{ crew_day_id, code, title, service, service_label, street_label, timezone, service_date, window_start, window_end, price_from_cents, booking_closes_at }`. |
| `POST /api/crew-days/:id/dismiss` | "Not for me" on the Today card → `{ dismissed: true }` (for good; idempotent) |
| `GET /api/crew-days/bookings/:bookingId` | the household's booking page (screen 5), its household only (404 otherwise): `crew_day { id, code, title, service, service_label, street_label, city, state, timezone, status, included, outside_only, crew }`, `status`, `steps [{ key: booked/on_the_way/done/paid, label ("Requested" while the price is pending), state: done/current/todo }]`, `service_date`, `window_start`, `window_end`, `window_starts_at`, `window_ends_at`, `eta { start, end, updated_at }`, `gate_ready_at`, `cant_get_in_at`, `prep_note`, `access_note`, `address { line, city, state, zip }`, `home_id`, `option { id, label }`, `add_ons`, `line_items`, `price_cents`, `card { brand, last4 }`, `cancel_cutoff_at`, `can_cancel`, `can_change`, `can_ask_release`, `release_asked_at`, `charge { state, amount_cents, due_at, paid_at, refunded_cents, failure }`, `invoice_id`, `done_at`, `photos` (signed URLs, SRV-4) and `done_note`, `household_confirmed_at`, `problem`, `proposal` (when `new_dates`), `new_date_choice`, `remind_next_season`, `cancelled_by`, `cancelled_at`, `share { url, flyer_url, message, booked_count, spots_left }`, `events` (visible to the household) |
| `PATCH /api/crew-days/bookings/:bookingId` | `{ access_note?, option_id?, add_on_ids?, remind_next_season? }` → `{ booking }`. The note changes until the work is done (`access_note_changed`, never the text); option and add-ons only before the cutoff (`ASK_THE_CREW` after), re-priced (look-first → `price_pending`, and the crew is asked); `remind_next_season` only once paid (`NOT_EDITABLE`) |
| `POST /api/crew-days/bookings/:bookingId/cancel` | before the cutoff: `cancelled` (free) → `{ booking }`; the crew is told. After: 409 `ASK_THE_CREW`; once the work started: `NOT_CANCELLABLE` |
| `POST /api/crew-days/bookings/:bookingId/ask-release` | after the cutoff: records `release_asked_at` and tells the crew → `{ booking }`. Before it: 409 `CAN_CANCEL` |
| `POST /api/crew-days/bookings/:bookingId/price-answer` | `{ approve: true or false }` on `price_offered` → `{ booking }`: approve → `booked` (the household gets `crew_day_booked`, the crew `crew_day_new_booking`); decline → `cancelled` (free). Otherwise 409 `NO_PRICE_OFFER` |
| `POST /api/crew-days/bookings/:bookingId/gate-ready` | sets `gate_ready_at`, tells the crew |
| `POST /api/crew-days/bookings/:bookingId/confirm` | "Everything looks good" on a `done` home: records `household_confirmed_at` and charges now → `{ booking }` (`paid`, or `payment_failed`, or still `done` if Stripe is settling). `NOT_DONE`, `PROBLEM_OPEN` |
| `POST /api/crew-days/bookings/:bookingId/problem` | `{ kind (missed, damage, no_show, charge, other), note (1–1,000), photo_paths (≤ 4, uploaded as `problem`) }` → `problem_status` `open`, charge paused, `problem_due_at` = 5 PM local the next business day; tells the crew (`crew_day_problem`) and the operator (`crew_day_problem_opened`) → `{ booking }`. Once the crew has come (on or after the home's date). A second call while open adds a note or photos (`problem_note`). `NOT_REPORTABLE` |
| `POST /api/crew-days/bookings/:bookingId/new-date` | `{ proposal_id, choice: "YYYY-MM-DD" or "cancel" }` on a `new_dates` booking before the deadline → `{ booking }`: a date books that date and window (`booked`); `cancel` ends it free. The crew gets `crew_day_dates_answered` ("1 of 3 picked a new date", in-app). `NO_PROPOSAL`, `CHANGED` (an older proposal id), `DEADLINE_PASSED` |
| `POST /api/crew-days/uploads` | multipart: `photo` (JPEG, PNG or HEIC, ≤ 10 MB; HEIC converted), `booking_id`, `purpose` (`done`: any member of that booking's crew; `problem`: that booking's household) → 201 `{ path }`. Refuses `PHOTO_TOO_LARGE` (413), `PHOTO_UNREADABLE` / `PHOTO_TYPE` (415), `NOT_FOUND` (not your booking). |
| `POST /api/crew-days/bookings/:bookingId/gate-ready` | on the day (from 6 PM the evening before) while the crew is coming: sets `gate_ready_at`, tells the crew → `{ booking }`. `TOO_EARLY`, `NOT_ON_ROUTE` |
| `POST /api/crew-days/requests` | `{ service, home_id? (default: their first home), months (["YYYY-MM", …] in the next six, or ["any"]), note? (≤ 500) }` → 201 `{ request }` (the `mine` request card; title "Holiday lights on Oak Street", the street without the house number); tells the operator (`crew_day_request_new`). No home: 422 `HOME_REQUIRED` ("Add your home first.") |

### Crew

`businessId` is the crew's business user id; access through the existing `checkBusinessPermission` (`profile.edit` for
create, edit, prices, dates, cancel and release; any business access for reading and the route).

| Route | Does |
|---|---|
| `GET /api/crew-days/business/:businessId` | any member. `{ readiness { published, payouts_enabled, documents_verified, missing[] }, can_edit, fee { rate_pct, founding }, services[{ key, label, day_title, included[] }], today, upcoming, pending, drafts, past }`. `missing` holds the required steps only: `publish_page`, `set_up_payouts` (documents are optional: `documents_verified` drives the badge row). Sections hold day cards (below); `pending` has `pending_review` and `declined` (with `review_note`); a day whose dates are all past moves to `past`. |
| `POST /api/crew-days` | owners and editors (`profile.edit`). create: `{ business_id, service, street_label, city, state, center { latitude, longitude }, radius_m, service_date, window_start, window_end, capacity, booking_closes_at?, included, outside_only, prep_note, price_options, add_ons, submit, repeat_of?, title? }` → 201 `{ crew_day }`, `draft` or `pending_review`. Refuses `VALIDATION` (422, with `field`), `NOT_ALLOWED` (403, a member without `profile.edit`), `NOT_FOUND`, `BUSINESS_NOT_READY` (409, with `missing`). The date must be after today and within six months; booking must stay open at least an hour from now and close by the window's start (default: 48 hours before it). Option and add-on ids are made by the server (`opt_…`, `add_…`); send them back to keep them. |
| `PATCH /api/crew-days/:id` | owners and editors; any form field above → `{ crew_day }`. Draft, declined and waiting days take every field; an open or started day takes only `capacity` (not below its active bookings: `CAPACITY_BELOW_BOOKED`), `included`, `outside_only`, `prep_note`, `price_options`, `add_ons` (an option or add-on a booking uses can be repriced, not removed: `OPTION_IN_USE`; existing bookings keep their prices). Other fields: 409 `NOT_EDITABLE` with `fields`. `crew_day.editable_fields` lists what the viewer may change. |
| `POST /api/crew-days/:id/submit` | draft or declined → `pending_review` → `{ crew_day }`; tells the operator. Refuses `DAY_NOT_DRAFT`, `BUSINESS_NOT_READY`, `VALIDATION` (a date that has passed). |
| `GET /api/crew-days/:id/crew` | any member. The crew's day (15): the whole form (`center`, `radius_m`, `included`, `prep_note`, `price_options`, `add_ons`, `price_from_cents`), the card fields, `can_edit`, `editable_fields`, `review_note`, `cancel_*`, `money { gross_cents, fee_rate, net_cents, charged_cents, scheduled_cents, paused_cents }` (`fee_rate` in percent), `needs_you { price_checks: [home], release_asks: [home] }`, `bookings: [home]` (active, in booking order), `ended: [home]` (cancelled or declined), `events` (visible to the crew). Home: `{ id, label ("Home 3"), details ("Two stories · clean the gutter guards"), line_items, price_cents, status, service_date, window_start, window_end, address_visible, address { line, city, state, zip, latitude, longitude } or null, first_name or null, access_note or null, route_position, eta, gate_ready_at, cant_get_in_at, release_asked_at, done_at, photo_count, charge_state, charge_due_at, problem, new_date_choice, created_at }`. The address and first name show from 6 PM the evening before the home's date through that day, and at once while its price is pending or offered (never the access note then). |
| `POST /api/crew-days/:id/bookings/:bookingId/price` | owners and editors. `{ price_cents }` (the look-first option's price; add-ons keep theirs; total = both) → `price_offered`, or `{ decline: true, note }` → `declined` → `{ booking }` (the crew's home shape). `NO_PRICE_CHECK` otherwise |
| `POST /api/crew-days/:id/bookings/:bookingId/release` | owners and editors; a home not yet started, at no charge (a household's release ask, or the crew's own call) → `cancelled` (`crew`) → `{ booking }`; the household is told |
| `POST /api/crew-days/:id/invite-past` | owners and editors, an open day: households this business served with a `paid` booking within the area in the last 400 days, not booked here and not blocked, once each per day (`crew_day_invite`, with their price when their past option's label is on this day's list) → `{ invited }`. The crew's day has `past_customers` (how many could be invited). |
| `POST /api/crew-days/:id/propose-dates` | owners and editors. `{ dates: [{ date, window_start, window_end }] (2–3, after today, within 14 days), note? }` → every `booked` (or still-answering) home becomes `new_dates`; `crew_day.proposed_dates` = `{ id, dates, deadline_at (24 h before the earliest date's window), note, sent_at, homes }`; each household gets `crew_day_new_dates` → `{ crew_day }` (the crew's day). `NO_HOMES`, `DAY_NOT_OPEN` |
| `POST /api/crew-days/:id/cancel` | owners and editors. `{ reason }` → the day `cancelled` (`cancelled_by: crew`) and every home not yet worked on `cancelled` (free; `crew_day_cancelled` to each); done or paid homes keep their state → `{ crew_day }`. The invitation then reads `cancelled`. |
| `GET /api/crew-days/:id/route?date=` | any member. `{ crew_day_id, title, date, dates, timezone, window_start, window_end, total, done, homes: [home + photos, problem_photos, done_note] }` in the crew's order (`route_position`, then booking order), each with what the job window allows. Without `date`: the first of its dates from today. |
| `POST /api/crew-days/:id/route/order` | any member. `{ booking_ids }` (homes on one date) → the route |
| `POST /api/crew-days/bookings/:bookingId/on-the-way` | any member, on or after the home's date. `{ eta_start, eta_end }` (ISO instants, up to 4 hours apart) → `on_the_way` (the day becomes `in_progress`) → `{ booking }` (home shape); the household gets `crew_day_on_the_way`. Again on an `on_the_way` home: a new time (`crew_day_eta_changed`). `NOT_TODAY`, `NOT_ON_ROUTE` |
| `POST /api/crew-days/:id/running-late` | any member. `{ minutes: 30, 60 or 90, date? (today) }` → every home still `booked` or `on_the_way` that date moves its window (and its expected time) back and is told → `{ date, minutes, moved, route }`. `TOO_LATE` past midnight |
| `POST /api/crew-days/bookings/:bookingId/cant-get-in` | any member. `{ note }` (required) → `cant_get_in_at`, event with the note, `crew_day_cant_get_in` to the household → `{ booking }` |
| `POST /api/crew-days/bookings/:bookingId/done` | any member, on or after the home's date. `{ photo_paths (1–8, uploaded for this booking as `done`), note? }` → `done`, the invoice (below), `charge_due_at` = now + 24 h, `crew_day_done` to the household → `{ booking }` (home shape). Repeating it answers the same. |

### Shapes

- **Day card** (crew lists, and the base of every crew and operator day): `id`, `title`, `service`, `service_label`,
  `street_label`, `city`, `state`, `timezone`, `service_date`, `window_start`, `window_end` (`HH:MM`),
  `window_starts_at`, `window_ends_at`, `status`, `capacity`, `booked_count`, `spots_left`, `is_full`,
  `booking_closes_at`, `is_closed`, `price_checks`, `release_asks`, `done_count`, `charged_cents`, `paid_out` (past
  list only: every charge's money transferred to the crew), `dates` (the dates
  its active bookings are on, or its own date), `review_note` (declined only), `submitted_at`,
  `share { code, url, flyer_url }`, `updated_at`.
- **Errors common to every route:** `UNAVAILABLE` (503, try again), `SERVER_ERROR` (500), `CHANGED` (409, someone
  changed it meanwhile; refresh), `NOT_FOUND` (404, also for a day the viewer can't see).

### Operator

| Route | Does |
|---|---|
| `GET /api/admin/crew-days?tab=waiting,open,today,problems,done,requests` | lists for 20, 22, 23: `{ tab, counts { waiting, open, today, problems, done, requests }, items }`. Day items are the crew's day plus `crew { business_user_id, name, username, avatar_url, verified, rating, published, payouts_enabled, founding, past_days, problems }`; `problems` items are bookings (operator shape below) with `crew_day` and `crew`; `requests` items are `{ id, kind: "request", title, service, service_label, street_label, city, state, months, note, status, asked_by { user_id, first_name }, answer_note, answered_at, offer_crew_day_id, created_at }`. Non-admins get 403 `NOT_OPERATOR`. |
| `GET /api/admin/crew-days/:id` | everything (21): `{ kind: "offer", day, money, bookings, events }` (every booking with `household { user_id, first_name, last_name, name, email }`, `address`, `line_items`, `price_cents`, `status`, `charge_state` (`not_yet`, `scheduled`, `paused`, `charged`, `partially_refunded`, `refunded`, `failed`, `none`), `invoice_id`, `problem`, …; every event) or `{ kind: "request", request }`; records `operator_viewed` (once per ten minutes per operator) |
| `POST /api/admin/crew-days/:id/approve` | `{ note? }` → `open` → `{ crew_day }`; tells the crew. Refuses `NOT_WAITING`, `BUSINESS_NOT_READY`, `DAY_PASSED` (booking would already be closed) |
| `POST /api/admin/crew-days/:id/decline` | `{ note }` (required, ≤ 500) → `declined` → `{ crew_day }`; tells the crew |
| `POST /api/admin/crew-days/:id/cancel` | `{ reason }` (required) → as the crew's cancel, `cancelled_by: operator`; the crew gets `crew_day_cancelled` too → `{ crew_day }` |
| `POST /api/admin/crew-days/bookings/:bookingId/problem` | `{ action, amount_cents?, note }` → `{ booking }` (operator shape + `crew_day`). `note`: a note to the household (`crew_day_problem_update`) and on the timeline. `release`: resolved (`released`), the charge runs now ("Charge released: $180 paid."). `refund`: see §3 (`amount_cents` defaults to the whole price). `resolve`: resolved with a required note to both; the charge then runs on its schedule. `NO_OPEN_PROBLEM`, `REFUND_IN_FULL`, `NOTHING_TO_REFUND` |
| `POST /api/admin/crew-days/requests/:id` | `{ action: offer_ready, crew_day_id (an open day), note? }` or `{ action: no_crew, note }` → `{ request }` (operator request card); tells the household (`crew_day_request_answered`; an offer links `/crew-day/<code>`). The household's `mine` request shows `offer { crew_day_id, code }` while that day is open. |

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
marked. Crew notices go to the business's primary owner and the member who created the day.

**Emails** (SRV-7, `notices.send()` with `email`, through the existing `emailService`; Mailpit locally) go to the
account's address of each person a notice was just made for, so nobody gets one while `crew_day` is off and an
idempotent notice (the reminder, the invite) is never emailed twice. Anyone who turned off Email Notifications (web
Settings, `MailPreferences.email_notifications`) gets the notice without the email, as with the monthly summary. Each
email is the notice's title (the subject) and body, a card with the day's title and date, a button to the notice's
link on the web (`APP_URL`), and a footer saying why it came with an "Email settings" link. They leave one at a time
after the notice is stored, so no request waits on the mail server. The receipt (`crew_day_charged`) adds what was
done, line by line with cents, any amount Pantopus support took off, the total paid, the card that paid ("Visa ending
4242"), the date, and "See the receipt" (`/app/invoice/<invoice_id>`). Operator alerts go to each `ADMIN_ALERT_EMAIL`
address and each admin account: the subject is "[Pantopus] Crew Day to approve · Camas, WA" (also "Crew Day problem
to answer", "Crew Day request to answer"; the city only, never an address), the body has the day or request, the ids
and a link to its admin page, never a household's name, address or note.

| Type | To | Push | Email | Title · body |
|---|---|---|---|---|
| `crew_day_booked` | household | yes | yes | "You're on the route" · "Gutter Day on Maple Lane, Tue, Nov 17, 9 AM–1 PM. Total $180. We'll remind you the evening before." |
| `crew_day_price_offered` | household | yes | yes | "Your price is ready: $260" · "Example Gutter Co. looked at your home. Approve it to book." |
| `crew_day_reminder` | household | yes | yes | "Gutter Day is tomorrow" · "9 AM–1 PM. Please keep the side gate unlocked and pets inside. You don't need to be home." (6 PM local, the evening before) |
| `crew_day_on_the_way` | household | yes | no | "Your crew is on the way" · "Expected 10–11 AM. Tap when the gate is ready." |
| `crew_day_eta_changed` | household | yes | no | "New arrival time" · "Example Gutter Co. now expects 11 AM–12 PM." |
| `crew_day_cant_get_in` | household | yes | no | "The crew can't get in" · the crew's note |
| `crew_day_done` | household | yes | yes | "One thing off your list" · "Gutters cleaned and flushed. See the photos. We'll charge $180 tomorrow at 11:42 AM unless something needs attention." |
| `crew_day_charged` | household | no | yes (receipt) | "Paid: $180.00 to Example Gutter Co." |
| `crew_day_charge_failed` | household | yes | yes | "Your card didn't go through" · "Pay $180 to Example Gutter Co. in Pantopus." |
| `crew_day_new_dates` | household | yes | yes | "Rain changed the plan" · "Example Gutter Co. can come Thu, Nov 19 or Sat, Nov 21 at the same price. No payment has been taken. If you don't answer by Wed 9 AM, we won't book a new date." |
| `crew_day_cancelled` | household; the crew too when the operator cancels its day | yes | yes | "Your Gutter Day was cancelled" · who cancelled; "Nothing was charged." (the crew: "Pantopus cancelled Gutter Day on Maple Lane" · the reason; "Nobody was charged.") |
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

- `crewDayCharges` (every 10 min, `backend/jobs/crewDayJobs.js`; `POST /api/internal/jobs/crew-day-charges` runs it
  once): §3. Each booking is claimed (`charge_claimed_at`) before charging; a claim older than 15 minutes is taken
  again.
- `crewDayReminders` (every 15 min; `POST /api/internal/jobs/crew-day-reminders`): `crew_day_reminder` from 6 PM
  local the evening before until the window starts, once per booking (`reminder_sent_at`; a new date clears it).
- `crewDayDeadlines` (every 15 min; `POST /api/internal/jobs/crew-day-deadlines`): new-date deadlines → unanswered
  bookings `cancelled` (`system`, `no_new_date`); price checks not answered by `booking_closes_at` → `cancelled`
  (`price_not_answered`); open or started days whose dates have passed and whose homes are all paid, refunded,
  cancelled or declined → `done` (`day_done`); access notes cleared 7 days after the booking's day.

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
