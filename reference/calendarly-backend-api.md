# Calendarly — Backend API Reference (for frontend / mobile wiring)

> Generated from the live route handlers + Joi schemas on `feature/calendarly-backend` (migrations 159–165).
> Companion to [calendarly-design-doc.md](./calendarly-design-doc.md) and [calendarly-implementation-plan.md](./calendarly-implementation-plan.md).
> Status: backend feature-complete. The ONLY deferred pieces are gig-payment **settlement** (payouts) and external **calendar OAuth sync** — see "Guardrails" below.

---

## Auth & base paths
- **Auth:** Supabase access token as `Authorization: Bearer <token>` (or the `pantopus_access` cookie). Authed routes run CSRF protection, same as the rest of the app.
- **Host APIs** — `/api/scheduling/*` (personal/business) **and** `/api/homes/:homeId/scheduling/*` (home; same router, owner implied by `:homeId`).
- **Public (no auth / optionalAuth)** — `/api/public/book/*`, `/api/public/booking/:token*`, `/api/public/poll/*`.
- **Home calendar** — `/api/homes/:id/events*` (the home catch-all router — distinct from the `:homeId/scheduling` mount).

## Owner context (the one pattern to internalize)
On `/api/scheduling/*`, tell the backend whose schedule you mean:
- **Personal:** omit owner fields → defaults to `owner_type:'user'` = the signed-in user.
- **Business:** `owner_type:'business'` + `owner_id:<business_user_id>` (query param on GET, body field on writes).
- **Home:** use the `/api/homes/:homeId/scheduling/*` alias (don't pass owner fields).

## Conventions
- **Success:** keyed by resource — `{ eventTypes:[...] }`, `{ booking:{...} }`, `{ ok:true }`.
- **Errors:** `{ error:'CODE', message }` + HTTP status. **Validation** → `400 { error:'Validation failed', details:[{field,message,code}] }`. **Slot conflict** → `409 { error:'SLOT_TAKEN'|'SLOT_UNAVAILABLE'|'SLOT_FULL', alternatives:[{start,end,startLocal}] }`.
- **Times:** all UTC ISO; slot/listing responses also include `startLocal` rendered in the `tz` (IANA) you pass. Always pass `tz` on slot/calendar reads.
- **PUT = partial update** for event types / schedules / resources (omitted fields are left untouched).

## Build order
1. Personal core: `/availability*` → `/event-types*` → `/booking-page*`.
2. Public flow: `GET /book/:slug` → `…/slots` → `POST /book/:slug/:eventTypeSlug` (returns **manageToken** — persist it; **clientSecret** if priced) → `GET /booking/:token`.
3. Bookings inbox + lifecycle (`/bookings*`).
4. Home: calendar union + find-a-time + resources + RSVP.
5. Business / paid (behind a flag) → advanced (workflows / insights / packages / polls / waitlist).

## Guardrails
- **Apply migrations 159–165** to each environment first (mirrors in `supabase/migrations/20260613000000–6`).
- **Paid bookings/packages: charge works, payout settlement is deferred** — keep priced event types behind a feature flag; safe to exercise in **Stripe test mode**. Free flows are fully live.
- **`POST /connected-calendars/connect` returns 501** (OAuth sync deferred); read endpoints exist.
- **Manage token** is returned **once** on booking create — persist it for the invitee's manage/reschedule/cancel/.ics.
- Build the frontend contract layer (`frontend/packages/types/src/scheduling.ts`, `api/src/endpoints/scheduling.ts` + `publicBooking.ts`) mirroring the existing `home.ts`.

---

## Host Scheduling Configuration (Booking Page, Event Types, Availability, Notification Preferences, Payments, Connected Calendars, Message Templates, Workflows)

_Auth: verifyToken (Bearer token or pantopus_access cookie) sets req.user. Owner context via owner_type + owner_id in query/body for /api/scheduling mount, or implied by :homeId for /api/homes/:homeId/scheduling mount. withOwner('view'|'edit') gates on assertCanManageOwner. Error envelope: { error: CODE, message?: string } or { error: 'Validation failed', details: [...] } for 400 validation. All responses keyed by resource name (page, eventType, schedule, etc.) or { ok: true }._

#### `GET /booking-page`
- **Auth:** authed (verifyToken) + owner view required via withOwner('view')
- **Request:** none; owner_type + owner_id resolved from query or implied by :homeId
- **Response:** { page: BookingPage object (id, owner_type, owner_id, slug, is_live, is_paused, title, tagline, avatar_url, intro, confirmation_message, timezone, reminder_minutes[], cancellation_policy, visibility, branding, created_at, updated_at, created_by) }
- **Errors:** 404 not found (if owner has no page; will auto-create on first access)
- _Auto-creates page if missing; GET+withOwner('view') is read-only_

#### `PUT /booking-page`
- **Auth:** authed + owner edit required via withOwner('edit')
- **Request:** body: { title?, tagline?, avatar_url?, intro?, confirmation_message?, timezone?, is_live?, is_paused?, reminder_minutes: number[]?, cancellation_policy?, visibility: 'listed'|'unlisted'?, branding?: object }. Validated against pageUpdateSchema (all optional, max lengths enforced).
- **Response:** { page: updated BookingPage object }
- **Errors:** 400 validation failure
- _owner_type and owner_id in body are stripped. Updated_at timestamp auto-added._

#### `PUT /booking-page/slug`
- **Auth:** authed + owner edit required via withOwner('edit')
- **Request:** body: { slug: string (lowercase, 3-50 chars, alphanumeric + hyphens), owner_type, owner_id }. Validated against slugSchema.
- **Response:** { page: updated BookingPage with new slug }
- **Errors:** 409 SLUG_TAKEN if slug already in use by another owner; 400 validation failure
- _Uniqueness check via uniqueViolation(error). Slug is the public booking link identifier._

#### `GET /booking-page/check-slug`
- **Auth:** authed + owner view required via withOwner('view')
- **Request:** query: slug (string). No validation side effects.
- **Response:** { available: boolean, suggestions: string[] (3 alternatives if taken), error?: 'INVALID_SLUG', message?: string }
- **Errors:** 400 if slug format invalid (must match /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/)
- _Read-only slug check; provides suggestions if already taken. Used in first-run wizard._

#### `POST /booking-page/reset-slug`
- **Auth:** authed + owner edit required via withOwner('edit')
- **Request:** body: none (empty or {})
- **Response:** { page: updated BookingPage with newly generated slug }
- **Errors:** 500 RESET_FAILED if unable to generate unique slug after 5 retries
- _Danger zone—invalidates old public link. Generates random slug (owner-type + 8 random chars). Updates updated_at._

#### `POST /booking-page/disable`
- **Auth:** authed + owner edit required via withOwner('edit')
- **Request:** body: none
- **Response:** { page: updated BookingPage with is_live=false }
- _Takes public page offline. Reversible via PUT /booking-page with is_live=true._

#### `GET /event-types`
- **Auth:** authed + owner view required via withOwner('view')
- **Request:** none; owner resolved from query or :homeId
- **Response:** { eventTypes: EventType[] (sorted by sort_order then created_at ascending) }
- _Lists all active event types for the owner. Returns empty array if none exist._

#### `POST /event-types`
- **Auth:** authed + owner edit required via withOwner('edit')
- **Request:** body: { owner_type, owner_id, name: string (1-200), slug: string (alphanumeric + hyphen, /^[a-z0-9][a-z0-9-]{0,60}$/), description?: string, color?: string, durations: number[] (5-1440 min, default [30]), default_duration?: number, location_mode: 'video'|'phone'|'in_person'|'custom'|'ask' (default 'video'), location_detail?: string, assignment_mode: 'one_on_one'|'collective'|'round_robin'|'group' (default 'one_on_one'), requires_approval?: boolean, visibility: 'public'|'secret' (default 'public'), buffer_before_min?: number (0-720), buffer_after_min?: number (0-720), min_notice_min?: number, max_horizon_days?: number (1-730, default 60), slot_interval_min?: number (5-240, default 15), daily_cap?: number|null, per_booker_cap?: number|null, seat_cap?: number (1-1000, default 1), price_cents?: number (0+, default 0), currency?: string (3-char uppercase, default 'USD'), deposit_cents?: number, deposit_refundable?: boolean, cancellation_window_min?: number, reschedule_cutoff_min?: number, no_show_fee_cents?: number, refund_policy: 'full'|'partial'|'none'|'deposit_only' (default 'full'), allow_invitee_cancel?: boolean (default true), allow_invitee_reschedule?: boolean (default true), schedule_id?: uuid|null (auto-assigned to owner's default schedule for user owner types) }. Validated against eventTypeSchema.
- **Response:** { eventType: EventType object with all fields (id, page_id, created_at, etc.) }
- **Errors:** 409 SLUG_TAKEN if slug already exists for this owner; 400 validation failure
- _Auto-creates booking page if missing. Auto-ensures user owners are attached to default availability schedule. default_duration must be included in durations array._

#### `GET /event-types/:id`
- **Auth:** authed (no explicit withOwner, but loads event type and checks ownership via assertCanManageOwner in loadOwnedEventType)
- **Request:** none; :id is event type UUID
- **Response:** { eventType: EventType object, assignees: EventTypeAssignee[] (with subject_id, subject_type, weight, priority, is_active), questions: EventTypeQuestion[] (with label, field_type, options, required, sort_order) }
- **Errors:** 404 NOT_FOUND if event type not found or user lacks permission
- _Returns full event type plus linked assignees and questions, ordered by question sort_order._

#### `PUT /event-types/:id`
- **Auth:** authed + event type owner edit required (checked in handler via assertCanManageOwner)
- **Request:** body: all fields from eventTypeSchema are optional (partial update). Validated against eventTypePatchSchema.
- **Response:** { eventType: updated EventType object }
- **Errors:** 409 SLUG_TAKEN if slug already exists; 400 validation failure; 404 not found
- _Partial update; omitted fields untouched. Ensures default_duration is in durations array if both provided._

#### `DELETE /event-types/:id`
- **Auth:** authed + event type owner edit required
- **Request:** none
- **Response:** { ok: true }
- **Errors:** 409 HAS_UPCOMING_BOOKINGS if pending or confirmed bookings exist for this event type at or after now; 404 not found
- _Prevents deletion if active bookings exist. Caller should deactivate instead (PUT is_active=false) to preserve history._

#### `PUT /event-types/:id/assignees`
- **Auth:** authed + event type owner edit required
- **Request:** body: { assignees: [ { subject_id: uuid, subject_type: 'user'|'business_team' (default 'user'), weight?: number (default 1), priority?: number (default 0), is_active?: boolean (default true) }, ... ] }. Validated against assigneesSchema.
- **Response:** { assignees: EventTypeAssignee[] (inserted rows with all fields) }
- **Errors:** 400 INVALID_ASSIGNEE if any subject_id is not a member of the owner (home occupant, business team member, or owner itself); 404 not found
- _Replaces entire assignee set (DELETE then INSERT). Validates all assignees are members to prevent pulling non-member availability or assigning to non-members._

#### `PUT /event-types/:id/questions`
- **Auth:** authed + event type owner edit required
- **Request:** body: { questions: [ { label: string (1-300), field_type: 'text'|'textarea'|'select'|'multiselect'|'checkbox'|'phone' (default 'text'), options?: string[] (default []), required?: boolean (default false), sort_order?: number }, ... ] }. Validated against questionsSchema.
- **Response:** { questions: EventTypeQuestion[] (inserted rows with all fields) }
- **Errors:** 404 not found; 400 validation failure
- _Replaces entire question set. Questions are ordered by sort_order in GET /event-types/:id response._

#### `GET /availability`
- **Auth:** authed (verifyToken); no withOwner because availability is always personal (req.user.id)
- **Request:** none
- **Response:** { schedules: AvailabilitySchedule[], rules: AvailabilityRule[], overrides: AvailabilityOverride[] }. Schedules ordered by is_default descending. Auto-creates default schedule if none exist.
- _Availability is ALWAYS scoped to req.user, not owner context. Returns schedules, rules (weekday slots), and date-level overrides._

#### `POST /availability`
- **Auth:** authed; personal (req.user.id)
- **Request:** body: { name?: string (1-120, default 'Working hours'), timezone: string (required, max 64), is_default?: boolean (default false) }. Validated against scheduleSchema.
- **Response:** { schedule: AvailabilitySchedule object (id, user_id, name, timezone, is_default, created_at, updated_at) }
- **Errors:** 400 validation failure
- _If is_default=true, unsets is_default on any previous default schedule for this user._

#### `PUT /availability/:id`
- **Auth:** authed + schedule must belong to req.user (checked in loadOwnedSchedule)
- **Request:** body: { name?: string (1-120), timezone?: string (max 64), is_default?: boolean }. Validated against schedulePatchSchema (min 1 field required).
- **Response:** { schedule: updated AvailabilitySchedule object }
- **Errors:** 404 NOT_FOUND if schedule not found or belongs to different user; 400 validation failure
- _Partial update. If is_default=true, unsets is_default on previous default._

#### `DELETE /availability/:id`
- **Auth:** authed + schedule must belong to req.user
- **Request:** none
- **Response:** { ok: true }
- **Errors:** 409 CANNOT_DELETE_DEFAULT if this is the default schedule; 404 not found
- _Cannot delete default schedule. Caller must reassign default first._

#### `PUT /availability/:id/rules`
- **Auth:** authed + schedule must belong to req.user
- **Request:** body: { rules: [ { weekday: number (0-6, where 0=Sunday), start_time: 'HH:MM' or 'HH:MM:SS', end_time: 'HH:MM' or 'HH:MM:SS' }, ... ] }. Validated against rulesSchema.
- **Response:** { rules: AvailabilityRule[] (inserted rows) }
- **Errors:** 404 not found; 400 validation failure
- _Replaces entire rule set for this schedule. Weekdays are ISO (0=Sunday, 1=Monday, ..., 6=Saturday). Times are 24-hour format._

#### `PUT /availability/:id/overrides`
- **Auth:** authed + schedule must belong to req.user
- **Request:** body: { overrides: [ { date: 'YYYY-MM-DD', is_unavailable: boolean (default false), start_time?: 'HH:MM' or 'HH:MM:SS'|null, end_time?: 'HH:MM' or 'HH:MM:SS'|null }, ... ] }. Validated against overridesSchema.
- **Response:** { overrides: AvailabilityOverride[] (inserted rows) }
- **Errors:** 404 not found; 400 validation failure
- _Replaces entire override set. Overrides are date-level. If is_unavailable=true, user is blocked all day (start/end times ignored). Otherwise, override is a partial-day adjustment (available only during start_time-end_time)._

#### `POST /availability/blocks`
- **Auth:** authed (personal)
- **Request:** body: { title?: string (max 200), start_at: ISO 8601 datetime (required), end_at: ISO 8601 datetime (required), recurrence_rule?: string (RRULE format, max 500) }. Validated against blockSchema.
- **Response:** { block: AvailabilityBlock object (id, user_id, title, start_at, end_at, recurrence_rule, created_at) }
- **Errors:** 400 validation failure
- _Time-blocks (e.g., vacation, lunch breaks) that mark user unavailable. recurrence_rule is optional RRULE string for recurring blocks._

#### `DELETE /availability/blocks/:blockId`
- **Auth:** authed; block must belong to req.user
- **Request:** none
- **Response:** { ok: true }
- **Errors:** 404 NOT_FOUND if block not found or belongs to different user
- _Deletes an availability block._

#### `GET /notification-preferences`
- **Auth:** authed (personal)
- **Request:** none
- **Response:** { prefs: object (structure defined by schedulingNotifyPrefs service; includes notification channel/event preferences) }
- _Returns scheduling notification preferences for logged-in user. Structure is service-defined and flexible (object.unknown(true))._

#### `PUT /notification-preferences`
- **Auth:** authed (personal)
- **Request:** body: { prefs: object (required, flexible structure). Validated against Joi.object({ prefs: Joi.object().unknown(true).required() }).
- **Response:** { prefs: updated preferences object }
- **Errors:** 400 validation failure (missing prefs field)
- _Upserts notification preferences. If record exists, updates; else inserts. Flexible structure allows client to store arbitrary pref keys._

#### `POST /booking-page/one-off-links`
- **Auth:** authed + owner edit required via withOwner('edit')
- **Request:** body: { owner_type, owner_id, event_type_id: uuid (required), expires_in_min?: number (5-525600, default 10080 = 7 days), single_use?: boolean (default true), offered_slots?: [ { start: ISO datetime, end: ISO datetime }, ... ] (max 50) }. Validated against oneOffSchema.
- **Response:** { token: string (raw token, returned once), path: string (e.g., '/book/o/{token}'), expires_at: ISO datetime, single_use: boolean }
- **Errors:** 404 EVENT_TYPE_NOT_FOUND if event type doesn't exist or belongs to different owner; 400 validation failure
- _Generates one-time or limited-use booking link. Token is hashed server-side. Client should store token in href. Public flow is GET/POST /api/public/book/o/:token._

#### `GET /workflows`
- **Auth:** authed + owner view required via withOwner('view')
- **Request:** none; owner resolved from query/path
- **Response:** { workflows: SchedulingWorkflow[] (sorted by created_at descending) }
- _Lists automations for the owner. Returns empty array if none exist._

#### `POST /workflows`
- **Auth:** authed + owner edit required via withOwner('edit')
- **Request:** body: { owner_type, owner_id, event_type_id?: uuid|null, name: string (1-200, required), trigger: 'booking_created'|'cancelled'|'rescheduled'|'before_start'|'after_end' (required), offset_minutes?: number (0-525600, default 0), action: 'email'|'push'|'in_app'|'sms' (required), message_template?: string (max 5000), is_active?: boolean (default true) }. Validated against workflowSchema.
- **Response:** { workflow: SchedulingWorkflow object (id, all fields, created_at, updated_at) }
- **Errors:** 400 validation failure
- _Creates an automation rule. offset_minutes applies to 'before_start' and 'after_end' triggers. event_type_id scopes to a single type or null for all types._

#### `PUT /workflows/:id`
- **Auth:** authed; workflow owner edit required (checked via loadOwnedRow and assertCanManageOwner)
- **Request:** body: partial update of workflowSchema fields (name, trigger, action are optional per fork). Validated against modified workflowSchema.
- **Response:** { workflow: updated SchedulingWorkflow object }
- **Errors:** 404 not found; 400 validation failure; 403 permission denied
- _Partial update._

#### `DELETE /workflows/:id`
- **Auth:** authed + workflow owner edit required
- **Request:** none
- **Response:** { ok: true }
- **Errors:** 404 not found; 403 permission denied
- _Deletes workflow automation._

#### `GET /message-templates`
- **Auth:** authed + owner view required via withOwner('view')
- **Request:** none
- **Response:** { templates: MessageTemplate[] (sorted by created_at descending) }
- _Lists message templates for the owner (used in workflows and manual sends)._

#### `POST /message-templates`
- **Auth:** authed + owner edit required via withOwner('edit')
- **Request:** body: { owner_type, owner_id, name: string (1-200, required), channel: 'email'|'push'|'in_app'|'sms' (default 'email'), subject?: string (max 300), body: string (1-5000, required, trimmed), is_active?: boolean (default true) }. Validated against templateSchema.
- **Response:** { template: MessageTemplate object (id, all fields, created_by, created_at, updated_at) }
- **Errors:** 400 validation failure
- _subject required for email channel. Body can contain {{variable}} placeholders._

#### `POST /message-templates/preview`
- **Auth:** authed (no owner gate; used by any authenticated user)
- **Request:** body: { subject?: string, body: string (required), variables?: object (default {}, flexible structure) }. Validated against Joi.object({ ... }).
- **Response:** { subject: string (filled), body: string (filled) }
- **Errors:** 400 validation failure
- _Preview endpoint: interpolates {{variable}} placeholders with provided values. Used to preview templates before sending._

#### `PUT /message-templates/:id`
- **Auth:** authed + template owner edit required (checked via loadOwnedRow)
- **Request:** body: partial update (name and body are optional per fork). Validated against modified templateSchema.
- **Response:** { template: updated MessageTemplate object }
- **Errors:** 404 not found; 400 validation failure; 403 permission denied
- _Partial update._

#### `DELETE /message-templates/:id`
- **Auth:** authed + template owner edit required
- **Request:** none
- **Response:** { ok: true }
- **Errors:** 404 not found; 403 permission denied
- _Deletes message template._

#### `GET /payments/status`
- **Auth:** authed + owner view required via withOwner('view')
- **Request:** none; owner resolved from query/path
- **Response:** { applicable: boolean (true for user owners, false for homes), connected: boolean, charges_enabled?: boolean, payouts_enabled?: boolean }
- _Returns Stripe account status for the owner. Homes are not applicable (payments are per-user). Returns { applicable: false, connected: false } for home owners._

#### `GET /connected-calendars`
- **Auth:** authed (personal, req.user.id)
- **Request:** none
- **Response:** { calendars: ConnectedCalendar[] (with id, provider, external_account, check_conflicts, write_target, status, last_synced_at) }
- _Lists connected external calendars (Google, Outlook, etc.) for conflict checking. OAuth sync is deferred (returns empty array in v1). POST /connected-calendars/connect returns 501 NOT_AVAILABLE._

#### `POST /connected-calendars/connect`
- **Auth:** authed (personal)
- **Request:** none (structure TBD; returns not-available in v1)
- **Response:** status 501: { error: 'NOT_AVAILABLE', message: 'External calendar sync is coming soon.' }
- **Errors:** 501 NOT_IMPLEMENTED
- _Placeholder endpoint. External calendar OAuth and sync are deferred to Tier C._

---

## Host bookings & operations (Calendarly scheduling)

_Auth: verifyToken sets req.user (Bearer or pantopus_access cookie). Owner context via owner_type+owner_id in query/body for /api/scheduling mount, or implied by :homeId for /api/homes/:homeId/scheduling. Ownership assertion at 'view' or 'edit' level via assertCanManageOwner. Error envelope: { error, message }, validation failures: 400 { error:'Validation failed', details:[...] }. Resource bookings (HomeResource) use Booking table with event_type_id=null. Home-only endpoints checked via requireHome(). All timestamps in ISO 8601 UTC. Pagination limit 200 by default."_

#### `GET /bookings`
- **Auth:** host-authed(owner view)
- **Request:** Query params: status (upcoming|pending|past|cancelled), event_type_id (uuid), from (ISO date), to (ISO date), q (invitee name search). All optional. Owner context (ownerType, ownerId) resolved from query owner_type+owner_id (/api/scheduling) or :homeId (/api/homes/:homeId/scheduling).
- **Response:** { bookings: [{ id, owner_type, owner_id, event_type_id, status, start_at, end_at, invitee_name, invitee_email, invitee_user_id, invitee_timezone, payment_id, package_credit_id, created_at, updated_at, ... }] }. Limit 200. Ordered by start_at (ascending for upcoming/pending, descending for past/cancelled).
- **Errors:** 400 validation (missing/invalid filters); 403 ownership mismatch; 404 owner not found
- _Status filter: 'upcoming'=confirmed+future, 'pending'=pending status, 'past'=confirmed|completed|no_show+past, 'cancelled'=cancelled|declined. No filter=all bookings. Filters are ANDed (event_type_id, from/to, name search)._

#### `GET /bookings/summary`
- **Auth:** host-authed(owner view)
- **Request:** Query params: owner_type, owner_id (for /api/scheduling mount).
- **Response:** { upcomingCount, pendingCount, totalThisMonth, noShowRate, nextBooking: { start_at, invitee_name }, ... } (from bookingMetricsService.getSummary).
- **Errors:** 403 ownership mismatch; 404 owner not found
- _Summary card for the Scheduling Hub. Registered BEFORE /bookings/:id so 'summary' is not captured as a booking ID._

#### `GET /bookings/:id`
- **Auth:** host-authed(owner view)
- **Request:** No request body/params beyond :id.
- **Response:** { booking: { id, owner_type, owner_id, event_type_id, status, start_at, end_at, invitee_name, invitee_email, invitee_user_id, invitee_timezone, intake_answers, payment_id, package_credit_id, created_at, updated_at, ... }, attendees: [{ id, booking_id, user_id, email, name, rsvp_status, ... }], eventType: { id, name, location_mode } or null }.
- **Errors:** 404 booking not found; 403 ownership mismatch
- _Loads booking detail, attendee list, and minimal event type metadata._

#### `GET /bookings/:id/available-slots`
- **Auth:** host-authed(owner view)
- **Request:** Query params: from (ISO date, required), to (ISO date, required), tz (timezone for viewer, optional). Returns slots for reschedule/reassign, excluding the current booking.
- **Response:** { slots: [{ start (ISO UTC), end (ISO UTC), startLocal (local ISO), eligibleHosts (array of user IDs for this slot) }, ...] }.
- **Errors:** 400 missing range (from/to); 404 booking/event type not found
- _For host reschedule/reassign sheet. Slots exclude the booking being rescheduled. Resource bookings (event_type_id=null) return empty slots. Uses availabilityService.computeSlots with excludeBookingId._

#### `POST /bookings`
- **Auth:** host-authed(owner edit)
- **Request:** { owner_type, owner_id, event_type_id (uuid, required), start_at (ISO UTC, required), duration_min (int 5-1440, optional), invitee_name (string <=200, optional), invitee_email (email <=320, optional), invitee_phone (string <=40, optional), invitee_timezone (string <=64, optional), intake_answers (object, optional) }.
- **Response:** 201 { booking: { id, status='pending'|'confirmed', start_at, end_at, invitee_name, invitee_email, invitee_user_id, payment_id, ... }, attendees: [...] } (from bookingService.createBooking).
- **Errors:** 400 validation; 403 owner mismatch; 404 event type not found; 409 SLOT_CONFLICT, INVALID_TIME_RANGE, etc. (from bookingService)
- _Manual booking creation (via host UI). Sets createdVia='manual', actorUserId=req.user.id. Duration defaults to event type's default_duration if omitted. Email is normalized at creation time._

#### `POST /bookings/:id/approve`
- **Auth:** host-authed(owner edit)
- **Request:** No request body.
- **Response:** { booking: { id, status='confirmed', updated_at, ... } }.
- **Errors:** 404 booking not found; 403 ownership mismatch; 409 ALREADY_APPROVED, INVALID_STATUS (from bookingService)
- _Approve a pending booking. Transitions status from 'pending' to 'confirmed'._

#### `POST /bookings/:id/decline`
- **Auth:** host-authed(owner edit)
- **Request:** { reason (string <=500, optional) }.
- **Response:** { booking: { id, status='declined', updated_at, ... } }.
- **Errors:** 404 booking not found; 403 ownership mismatch; 409 ALREADY_DECLINED, INVALID_STATUS (from bookingService)
- _Decline a pending booking (and notify invitee). Optional reason stored._

#### `POST /bookings/:id/cancel`
- **Auth:** host-authed(owner edit)
- **Request:** { reason (string <=500, optional) }.
- **Response:** { booking: { id, status='cancelled', updated_at, refund_issued, ... } }.
- **Errors:** 404 booking not found; 403 ownership mismatch; 409 ALREADY_CANCELLED, PAST_DEADLINE, REFUND_FAILED, etc.
- _Cancel a confirmed booking (post-approval). Applies refund logic and notifies invitee. Called with reason='host' origin._

#### `POST /bookings/:id/reschedule`
- **Auth:** host-authed(owner edit)
- **Request:** { start_at (ISO UTC, required), host_user_id (uuid, optional), reason (string <=500, optional) }.
- **Response:** { booking: { id, status, start_at (new), end_at (new), updated_at, ... } }.
- **Errors:** 404 booking not found; 403 ownership mismatch; 409 SLOT_CONFLICT, INVALID_TIME, PAST_DEADLINE
- _Host reschedules confirmed booking to new start_at. Optional host_user_id for round-robin reassignment. Notifies invitee of new time._

#### `POST /bookings/:id/no-show`
- **Auth:** host-authed(owner edit)
- **Request:** No request body.
- **Response:** { booking: { id, status='no_show', updated_at, no_show_fee_applied, ... } }.
- **Errors:** 404 booking not found; 403 ownership mismatch; 409 NOT_APPLICABLE_YET (event hasn't passed)
- _Mark booking as no-show. Applies no-show fee from event type if configured._

#### `POST /bookings/:id/reassign`
- **Auth:** host-authed(owner edit)
- **Request:** { host_user_id (uuid, required), reason (string <=500, optional) }.
- **Response:** { booking: { id, host_user_id (new), status, updated_at, ... } }.
- **Errors:** 404 booking not found; 403 ownership mismatch; 409 INVALID_HOST (not a team member/assignee)
- _Reassign confirmed booking to a different team member (home/business only). Validates assignee membership._

#### `POST /bookings/:id/rsvp`
- **Auth:** authed (attendee self-service, not owner-gated)
- **Request:** { status (going|maybe|declined|pending, required) }.
- **Response:** { attendee: { id, booking_id, user_id, rsvp_status, updated_at, ... } }.
- **Errors:** 403 NOT_AN_ATTENDEE; 404 booking or attendee not found
- _Signed-in user updates their own RSVP status for a booking they're attending. Not owner-gated._

#### `POST /bookings/recurring`
- **Auth:** host-authed(owner edit)
- **Request:** { owner_type, owner_id, event_type_id (uuid, required), sessions (array of ISO dates, 1-52, required), invitee_name (string <=200, optional), invitee_email (email <=320, optional), invitee_timezone (string <=64, optional) }.
- **Response:** 201 { bookings: [{ id, status, start_at, end_at, invitee_name, ... }, ...], ... } (from bookingService.createRecurringBookings).
- **Errors:** 400 validation; 403 owner mismatch; 404 event type not found; 409 SLOT_CONFLICT, etc.
- _Create multiple linked bookings from an array of session start times. Each session inherits duration from event type. Email normalized._

#### `POST /bookings/:id/nudge`
- **Auth:** host-authed(owner edit)
- **Request:** { message (string <=1000, optional) }.
- **Response:** { ok: true }.
- **Errors:** 404 booking not found; 403 ownership mismatch
- _Send a reminder notification/email to invitee. Defaults to 'A reminder about your upcoming booking.' if message omitted. Uses notificationService or emailService based on invitee_user_id vs invitee_email._

#### `POST /bookings/:id/propose-reschedule`
- **Auth:** host-authed(owner edit)
- **Request:** { start_at (ISO UTC, required), host_user_id (uuid, optional) }.
- **Response:** { booking: { id, status, start_at, updated_at, ... } }.
- **Errors:** 404 booking not found; 403 ownership mismatch; 409 INVALID_TIME, etc.
- _Propose a reschedule to the invitee (creates a pending proposal). Invitee must confirm or decline._

#### `POST /bookings/:id/apply-credit`
- **Auth:** authed (customer self-service, not owner-gated)
- **Request:** { credit_id (uuid, required) }.
- **Response:** { ok: true, remaining (int): remaining sessions on the credit } }.
- **Errors:** 403 NOT_YOUR_BOOKING; 404 booking/credit not found; 409 ALREADY_APPLIED, CREDIT_NOT_APPLICABLE
- _Customer applies a package credit to their own booking (invitee_user_id match). Not owner-gated. Validates credit belongs to buyer and booking event type._

#### `GET /bookings/insights/no-shows`
- **Auth:** host-authed(owner view)
- **Request:** Query params: days (int, default 90, max 365).
- **Response:** { noShowCount (int), noShowRate (percent), byEventType: [{ event_type_id, name, count, rate }, ...], byHost: [{ user_id, name, count, rate }, ...], recent: [{ booking_id, invitee_name, scheduled_at, no_show_at }, ...] }.
- **Errors:** 403 ownership mismatch; 404 owner not found
- _No-show analytics report. From bookingMetricsService.getNoShowReport._

#### `GET /bookings/insights/team`
- **Auth:** host-authed(owner view, business-only)
- **Request:** Query params: days (int, default 90, max 365).
- **Response:** { teamMembers: [{ user_id, name, bookingsCount, revenue, noShowRate, avgDuration }, ...], totalRevenue, totalBookings, avgBookingValue, ... }.
- **Errors:** 400 BUSINESS_ONLY; 403 ownership mismatch
- _Team performance report (business round-robin). From bookingMetricsService.getTeamPerformance._

#### `GET /invoices`
- **Auth:** host-authed(owner view, business-only)
- **Request:** No query params.
- **Response:** { invoices: [{ id, business_user_id, recipient_user_id, total_cents, currency, created_at, ... }, ...] } (limit 200).
- **Errors:** 403 ownership mismatch
- _List BusinessInvoice records for this business owner (empty array if not business). Ordered by created_at descending. Invoices are a gig system reuse (not bookings-only)._

#### `GET /invoices/:id`
- **Auth:** host-authed(owner view, business-only)
- **Request:** No request body.
- **Response:** { invoice: { id, business_user_id, recipient_user_id, total_cents, currency, line_items, created_at, ... } }.
- **Errors:** 404 invoice not found; 403 ownership mismatch
- _Fetch a single invoice detail._

#### `POST /invoices/:id/send`
- **Auth:** host-authed(owner edit, business-only)
- **Request:** No request body.
- **Response:** { ok: true }.
- **Errors:** 404 invoice not found; 403 ownership mismatch
- _Send invoice to recipient via in-app notification (does not mutate invoice state — avoids the gig invoice state machine)._

#### `GET /packages`
- **Auth:** host-authed(owner view)
- **Request:** No query params.
- **Response:** { packages: [{ id, owner_type, owner_id, name, sessions_count, price_cents, currency, event_type_id, is_active, created_at, ... }, ...] }.
- **Errors:** 403 ownership mismatch; 404 owner not found
- _List session packages offered by this owner. Ordered by created_at descending._

#### `POST /packages`
- **Auth:** host-authed(owner edit)
- **Request:** { owner_type, owner_id, name (string 1-200, required), sessions_count (int 1-1000, required), price_cents (int >=0, default 0), currency (3-char uppercase, default USD), event_type_id (uuid, optional), is_active (bool, default true) }.
- **Response:** 201 { package: { id, owner_type, owner_id, name, sessions_count, price_cents, currency, event_type_id, is_active, created_at, ... } }.
- **Errors:** 400 validation; 403 owner mismatch
- _Create a new session package. event_type_id can be null (seller's choice what event types are included)._

#### `PUT /packages/:id`
- **Auth:** host-authed(owner edit)
- **Request:** { name, sessions_count, price_cents, currency, event_type_id, is_active } (all optional, but at least one required for PATCH).
- **Response:** { package: { id, owner_type, owner_id, name, sessions_count, price_cents, currency, event_type_id, is_active, updated_at, ... } }.
- **Errors:** 404 package not found; 403 ownership mismatch
- _Partial update to package metadata._

#### `DELETE /packages/:id`
- **Auth:** host-authed(owner edit)
- **Request:** No request body.
- **Response:** { ok: true }.
- **Errors:** 404 package not found; 403 ownership mismatch
- _Soft-delete (sets is_active=false)._

#### `POST /packages/:id/buy`
- **Auth:** authed (customer, not owner-gated)
- **Request:** No request body.
- **Response:** 201 { credit: { id, package_id, buyer_user_id, remaining_sessions, purchased_at, ... }, clientSecret (string or null): Stripe payment intent secret if price_cents>0 }.
- **Errors:** 404 PACKAGE_NOT_FOUND; 400 PAYMENT_FAILED, ALREADY_OWNED, etc. (from packageService.purchasePackage)
- _Customer purchases a package. If price_cents>0, returns Stripe clientSecret for payment confirmation. Creates PackageCredit record._

#### `GET /my-packages`
- **Auth:** authed (customer, not owner-gated)
- **Request:** No query params.
- **Response:** { credits: [{ id, buyer_user_id, package_id, remaining_sessions, purchased_at, BookingPackage: { name, sessions_count, owner_type, owner_id, event_type_id }, ... }, ...] }.
- **Errors:** None (empty array if no credits)
- _List package credits owned by the current user. Includes nested package metadata. Ordered by purchased_at descending._

#### `GET /my-bookings`
- **Auth:** authed (invitee/customer, not owner-gated)
- **Request:** No query params.
- **Response:** { bookings: [{ id, owner_type, owner_id, event_type_id, status, start_at, end_at, invitee_name, invitee_email, invitee_user_id, host_user_id, payment_id, package_credit_id, ... }, ...] } (limit 200).
- _List all bookings for the current user, matched by invitee_user_id OR normalized invitee_email (deduped by booking.id). Ordered by start_at descending. Spans all owners/event types._

#### `GET /find-a-time`
- **Auth:** host-authed(owner view, home-only)
- **Request:** { owner_type='home', owner_id, member_ids (array of uuids, 1+, required), mode (collective|round_robin, default collective), duration_min (int 5-1440, default 30), from (ISO date, required), to (ISO date, required), slot_interval_min (int 5-240, default 30), timezone (string, optional) }.
- **Response:** { slots: [{ start (ISO UTC), end (ISO UTC), startLocal (local ISO), eligibleHosts (array of member IDs for this slot) }, ...] }.
- **Errors:** 400 MISSING_FIELDS, NOT_HOME; 403 ownership mismatch
- _Find common free slots across home members. Synthesizes ephemeral event type with specified mode. Uses availabilityService.computeSlots with memberOverride. Home-only endpoint._

#### `GET /whos-free`
- **Auth:** host-authed(owner view, home-only)
- **Request:** Query params: from (ISO date, required), to (ISO date, required), tz (timezone, optional).
- **Response:** { members: [uuid, ...], freeByMember: { [userId]: [{ start, end, startLocal, eligibleHosts }, ...], ... } }.
- **Errors:** 400 MISSING_RANGE, NOT_HOME; 403 ownership mismatch
- _Per-member free grids for a home. Returns active home occupants' availability. Home-only endpoint._

#### `GET /resources`
- **Auth:** host-authed(owner view, home-only)
- **Request:** No query params.
- **Response:** { resources: [{ id, home_id, name, resource_type (room|vehicle|tool|charger|other), photo_url, who_can_book (members|specific|guests), max_duration_min, buffer_min, requires_approval, available_hours (object), is_active, created_at, ... }, ...] }.
- **Errors:** 400 NOT_HOME; 403 ownership mismatch
- _List active HomeResource records for a home. Home-only endpoint._

#### `POST /resources`
- **Auth:** host-authed(owner edit, home-only)
- **Request:** { owner_type='home', owner_id, name (string 1-200, required), resource_type (room|vehicle|tool|charger|other, default other), photo_url (string <=1000, optional), who_can_book (members|specific|guests, default members), max_duration_min (int >=5, optional), buffer_min (int >=0, default 0), requires_approval (bool, default false), available_hours (object, default {}) }.
- **Response:** 201 { resource: { id, home_id, name, resource_type, photo_url, who_can_book, max_duration_min, buffer_min, requires_approval, available_hours, is_active=true, created_at, created_by, ... } }.
- **Errors:** 400 validation, NOT_HOME; 403 ownership mismatch
- _Create a new home resource (room, vehicle, tool, etc.). Home-only endpoint. v1 allows active members to book; 'specific'/'guests' policies TBD._

#### `PUT /resources/:rid`
- **Auth:** host-authed(owner edit, home-only)
- **Request:** { name, resource_type, photo_url, who_can_book, max_duration_min, buffer_min, requires_approval, available_hours } (all optional, at least one required).
- **Response:** { resource: { id, home_id, name, resource_type, ..., updated_at, ... } }.
- **Errors:** 404 resource not found; 400 NOT_HOME; 403 ownership mismatch
- _Update resource metadata. Home-only endpoint._

#### `DELETE /resources/:rid`
- **Auth:** host-authed(owner edit, home-only)
- **Request:** No request body.
- **Response:** { ok: true }.
- **Errors:** 400 NOT_HOME; 403 ownership mismatch
- _Soft-delete (sets is_active=false). Home-only endpoint._

#### `POST /resources/:rid/book`
- **Auth:** home member (via withOwner view)
- **Request:** { owner_type='home', owner_id, start_at (ISO UTC, required), duration_min (int 5-1440, optional), name (string <=200, optional) }.
- **Response:** 201 { booking: { id, resource_id=:rid, start_at, end_at, name, booked_by, status='confirmed', created_at, ... } }.
- **Errors:** 404 RESOURCE_NOT_FOUND; 400 validation, NOT_HOME; 409 SLOT_CONFLICT, RESOURCE_UNAVAILABLE; 403 ownership mismatch or not a home member
- _Book a home resource. Only active home members allowed in v1 (who_can_book='members'). Calls bookingService.createResourceBooking._

#### `POST /visits`
- **Auth:** host-authed(owner edit, home-only)
- **Request:** { owner_type='home', owner_id, visit_type (vendor|guest, default vendor), title (string 1-200, required), description (string <=2000, optional), start_at (ISO UTC, required), end_at (ISO UTC, required), who_is_home (array of uuids, default []), location_notes (string <=500, optional) }.
- **Response:** 201 { visit: { id, home_id, event_type=visit_type, title, description, start_at, end_at, assigned_to=who_is_home (or null if empty), location_notes, created_by, created_at, ... } }.
- **Errors:** 400 BAD_RANGE (end_at before start_at, or span >30 days), NOT_HOME; 403 ownership mismatch
- _Schedule a vendor/guest visit (stored as HomeCalendarEvent). Assigned members count as busy in availability. Home-only endpoint._

#### `GET /event-types/:id/waitlist`
- **Auth:** host-authed(owner view)
- **Request:** No query params.
- **Response:** { waitlist: [{ id, event_type_id, invitee_name, invitee_email, invitee_user_id, status='waiting', created_at, ... }, ...] }.
- **Errors:** 404 event type not found; 403 ownership mismatch
- _List waitlist entries (status='waiting') for an event type. Ordered by created_at._

#### `POST /waitlist/:id/promote`
- **Auth:** host-authed(owner edit)
- **Request:** No request body.
- **Response:** { ok: true }.
- **Errors:** 404 waitlist entry not found; 403 ownership mismatch
- _Promote a waitlist entry (sets status='promoted', notified_at=now). Notifies invitee via in-app or email._

#### `POST /polls`
- **Auth:** host-authed(owner edit)
- **Request:** { owner_type, owner_id, title (string 1-200, required), description (string <=2000, optional), duration_min (int 5-1440, default 30), options (array of {start: ISO, end: ISO}, 1-20, required) }.
- **Response:** 201 { poll: { id, owner_type, owner_id, title, description, duration_min, status='open', created_by, created_at, ... }, options: [{ id, poll_id, start_at, end_at, ... }, ...] }.
- **Errors:** 400 validation; 403 owner mismatch
- _Create a time poll with multiple slot options. Used for meeting scheduling._

#### `GET /polls`
- **Auth:** host-authed(owner view)
- **Request:** No query params.
- **Response:** { polls: [{ id, owner_type, owner_id, title, description, status, created_by, created_at, ... }, ...] }.
- **Errors:** 403 ownership mismatch; 404 owner not found
- _List polls for this owner. Ordered by created_at descending._

#### `GET /polls/:id`
- **Auth:** host-authed(owner view)
- **Request:** No query params.
- **Response:** { poll: { id, owner_type, owner_id, title, description, status, created_by, created_at, ... }, options: [{ id, poll_id, start_at, end_at, ... }, ...], votes: [{ option_id, voter_name, value (usually 1), ... }, ...] }.
- **Errors:** 404 poll not found; 403 ownership mismatch
- _Get poll detail with all options and votes._

#### `POST /polls/:id/finalize`
- **Auth:** host-authed(owner edit)
- **Request:** { option_id (uuid, required) }.
- **Response:** { poll: { id, status='closed', finalized_start_at, updated_at, ... }, finalized_start_at (ISO) }.
- **Errors:** 404 poll/option not found; 403 ownership mismatch
- _Close a poll and record the chosen option as finalized_start_at. Prevents further voting._

#### `GET /team-availability`
- **Auth:** host-authed(owner view, business-only)
- **Request:** Query params: from (ISO date, required), to (ISO date, required), tz (timezone, optional).
- **Response:** { members: [uuid, ...], freeByMember: { [userId]: [{ start, end, startLocal, eligibleHosts }, ...], ... } }.
- **Errors:** 400 MISSING_RANGE, BUSINESS_ONLY; 403 ownership mismatch
- _Per-member free grids for a business team. Returns active team members' availability. Business-only endpoint. Used for round-robin slot selection._

---

## Public Scheduling Booking Flow (schedulingPublic.js, mounted at /api/public)

_Auth: optionalAuth for writes (no Bearer/cookie required but email-bound if signed in); previewLimiter on GET endpoints, bookingWriteLimiter on POST/write endpoints. Error envelope: { error, message } for most errors; validation failures return 400 { error:'Validation failed', details:[...] } via validate middleware. Token-based endpoints use manage/one-off token hashes. Email normalization enforced. Identity binding: signed-in user attributed to booking only if their email matches invitee email (anti-spoof)._

#### `GET /book/:slug`
- **Auth:** public
- **Request:** Query: none required. Path param: slug (string, case-insensitive)
- **Response:** { page: { slug, title, tagline, avatar_url, intro, timezone, branding, owner_type, cancellation_policy }, status: 'active' | 'paused', eventTypes: [{ id, name, slug, description, color, durations, default_duration, location_mode, location_detail, price_cents, currency, deposit_cents, deposit_refundable, refund_policy, cancellation_window_min, reschedule_cutoff_min, requires_approval }] }
- **Errors:** 404 { error: 'NOT_FOUND', status: 'unavailable', message: 'This booking page is not available.' } if page not found or not is_live
- _Lists only is_active=true AND visibility='public' event types. Paused pages return status:'paused'. previewLimiter applied._

#### `GET /book/:slug/:eventTypeSlug/slots`
- **Auth:** public
- **Request:** Path: slug, eventTypeSlug. Query (required): from (ISO date), to (ISO date). Query (optional): tz (timezone string, defaults to page.timezone)
- **Response:** { eventType: {...publicEventTypeView...}, timezone: string, status: 'active' | 'paused', slots: [{ start: ISO, end: ISO, startLocal: ISO }] }
- **Errors:** 404 { error: 'NOT_FOUND' } if page or eventType not found. 400 { error: 'MISSING_RANGE', message: 'from and to are required.' } if query params missing
- _Paused pages return status:'paused' with empty slots array. Slots exclude host eligibility (internal only). previewLimiter applied._

#### `POST /book/:slug/:eventTypeSlug`
- **Auth:** optionalAuth
- **Request:** Body (Joi schema): { start_at: ISO string (required), duration_min: integer 5-1440 (optional), name: string 1-200 (required), email: email string max 320 (required), phone: string max 40 or null (optional), timezone: string max 64 or null (optional), answers: object unknown keys (optional, default {}) }
- **Response:** 201 { booking: { id, status, start_at, end_at, requires_approval (bool), policy_snapshot }, eventType: {...publicEventTypeView...}, page: { confirmation_message, timezone }, manageToken: string, clientSecret: string or null }
- **Errors:** 404 { error: 'NOT_FOUND' } if page or eventType not found. 409 { error: 'PAGE_PAUSED', message: 'This page is not accepting bookings right now.' } if page.is_paused. 409 { error: 'SLOT_TAKEN' | 'SLOT_UNAVAILABLE' | 'SLOT_FULL', message: string, alternatives: [...] } on conflict with nearest open times. 400 { error: 'Validation failed', details: [...] } on schema violation. 500 { error: 'INTERNAL', message: 'Could not create the booking.' } on unexpected error
- _Email normalized before use. Identity binding: if req.user present and their email matches invitee email, booking attributed to user.id. bookingWriteLimiter applied. optionalAuth optionally sets req.user._

#### `GET /book/o/:token`
- **Auth:** public
- **Request:** Path: token (raw one-off token). Query (optional): tz (timezone, default 'UTC'), from (ISO, default now), to (ISO, default +60 days or max_horizon_days)
- **Response:** { eventType: {...publicEventTypeView...}, single_use: boolean, slots: [{ start: ISO, end: ISO, startLocal: ISO }] }
- **Errors:** 404 { error: 'NOT_FOUND', status: 'expired', message: 'This link is invalid, already used, or expired.' } if token not found, expired, or consumed on single_use
- _One-off token: kind='one_off'. Validates token_hash against raw token. Checks expires_at and single_use+consumed_at. Slots from offered_slots (if present) or computed availability. previewLimiter applied._

#### `POST /book/o/:token`
- **Auth:** optionalAuth
- **Request:** Body (Joi schema, same as /book/:slug/:eventTypeSlug): { start_at: ISO (required), duration_min: int 5-1440 (opt), name: string 1-200 (req), email: email max 320 (req), phone: string max 40 or null (opt), timezone: string max 64 or null (opt), answers: object (opt) }
- **Response:** 201 { booking: { id, status, start_at, end_at }, eventType: {...publicEventTypeView...}, manageToken: string, clientSecret: string or null }
- **Errors:** 404 { error: 'NOT_FOUND', message: 'This link is invalid, already used, or expired.' } if token not found/expired/consumed. 400 { error: 'SLOT_NOT_OFFERED', message: 'Please choose one of the offered times.' } if offered_slots exist and start_at not in set. 409 { error: 'LINK_USED', message: 'This single-use link has already been used.' } if single_use claim fails. 400 { error: 'Validation failed', details: [...] } on schema violation. 500 { error: 'INTERNAL', message: 'Could not create the booking.' }
- _Atomically claims single_use token (check consumed_at IS NULL before update). Email normalized. Identity binding same as /book/:slug/:eventTypeSlug. Token released on failure. bookingWriteLimiter applied._

#### `GET /booking/:token`
- **Auth:** public
- **Request:** Path: token (manage token). No query params required
- **Response:** { booking: { id, status, start_at, end_at, invitee_name, invitee_timezone, location_mode, location_detail, previous_start_at, cancel_reason, policy_snapshot }, actions: { can_cancel, can_reschedule, invitee_cancel_allowed, invitee_reschedule_allowed, reschedule_deadline, free_cancel_until, refund_estimate_cents (if payment) }, payment: { amount_total, currency, payment_status, paid_at } or null, eventType: {...publicEventTypeView...} or null, page: { ...publicPageView..., cancellation_policy } or null }
- **Errors:** 404 { error: 'NOT_FOUND', message: 'This booking link is invalid or expired.' } if token not found, expired, or booking not found
- _Token kind='manage'. Actions computed from booking.status, policy_snapshot, event times, now, and invitee permissions. refund_estimate_cents only included if payment exists. previewLimiter applied._

#### `GET /booking/:token/available-slots`
- **Auth:** public
- **Request:** Path: token. Query (optional): from (ISO), to (ISO), tz (timezone). from/to required to return slots
- **Response:** { slots: [{ start: ISO, end: ISO, startLocal: ISO }] }
- **Errors:** 404 { error: 'NOT_FOUND' } if token invalid/expired
- _Returns empty slots [] if from/to missing or eventType not found. Excludes current booking.id from availability. previewLimiter applied._

#### `GET /booking/:token/ics`
- **Auth:** public
- **Request:** Path: token. No query params
- **Response:** Raw .ics file (text/calendar; charset=utf-8) with Content-Disposition: attachment; filename='invite.ics'. ICS method: 'CANCEL' if booking cancelled/declined, else 'REQUEST'. Sequence: 1 if previous_start_at set, else 0
- **Errors:** 404 { error: 'NOT_FOUND' } if token invalid/expired
- _RFC 5545 calendar invite. Includes attendeeEmail from booking.invitee_email if present. previewLimiter applied._

#### `POST /booking/:token/reschedule`
- **Auth:** public
- **Request:** Body (Joi schema): { start_at: ISO string (required) }
- **Response:** { booking: { id, status, start_at, end_at } }
- **Errors:** 404 { error: 'NOT_FOUND' } if token invalid/expired. 400 { error: 'Validation failed', details: [...] } on schema violation. Custom booking service errors returned as { error: code, message: string }
- _Invitee-side reschedule via manage token. Delegates to bookingService.rescheduleBooking(booking.id, invitee_user_id, start_at, 'invitee'). bookingWriteLimiter applied._

#### `POST /booking/:token/cancel`
- **Auth:** public
- **Request:** Body (Joi schema): { reason: string max 500 or null (optional) }
- **Response:** { booking: { id, status } }
- **Errors:** 404 { error: 'NOT_FOUND' } if token invalid/expired. 400 { error: 'Validation failed', details: [...] } on schema violation. Custom booking service errors as { error: code, message: string }
- _Invitee-side cancel via manage token. Delegates to bookingService.cancelBooking(booking.id, invitee_user_id, reason, 'invitee'). bookingWriteLimiter applied._

#### `POST /booking/:token/unsubscribe`
- **Auth:** public
- **Request:** Path: token. No body required
- **Response:** { ok: true }
- **Errors:** 404 { error: 'NOT_FOUND' } if token invalid/expired or booking.invitee_email missing
- _One-click unsubscribe from reminder emails only; transactional confirmations still sent. Hashes email and inserts into EmailSuppression table with reason='invitee_unsubscribe'. bookingWriteLimiter applied._

#### `POST /book/:slug/:eventTypeSlug/waitlist`
- **Auth:** optionalAuth
- **Request:** Path: slug, eventTypeSlug. Body (Joi schema): { name: string max 200 or null (optional), email: email max 320 (required), desired_from: ISO or null (optional), desired_to: ISO or null (optional) }
- **Response:** 201 { waitlist: { id, status } }
- **Errors:** 404 { error: 'NOT_FOUND' } if page or eventType not found. 400 { error: 'Validation failed', details: [...] } on schema violation. Database error propagated
- _Email normalized. Identity binding: if req.user present and email matches, invitee_user_id set. Inserts into SchedulingWaitlist table. bookingWriteLimiter applied._

#### `POST /booking/:token/accept-reschedule`
- **Auth:** public
- **Request:** Path: token. No body required
- **Response:** { booking: { id, status, start_at, end_at } }
- **Errors:** 404 { error: 'NOT_FOUND' } if token invalid/expired. Custom booking service errors as { error: code, message: string }
- _Invitee accepts a host-proposed reschedule via manage token. Delegates to bookingService.acceptProposedReschedule(booking.id, invitee_user_id). bookingWriteLimiter applied._

#### `POST /booking/:token/decline-reschedule`
- **Auth:** public
- **Request:** Path: token. No body required
- **Response:** { booking: { id, status } }
- **Errors:** 404 { error: 'NOT_FOUND' } if token invalid/expired
- _Invitee declines a host-proposed reschedule via manage token. Delegates to bookingService.declineProposedReschedule(booking.id). bookingWriteLimiter applied._

#### `GET /poll/:id`
- **Auth:** public
- **Request:** Path: id (poll UUID). No query params
- **Response:** { poll: { id, title, description, duration_min, status, finalized_start_at }, options: [{ id, start_at, end_at }], votes: [{ option_id, voter_name, value: 'yes' | 'maybe' | 'no' }] }
- **Errors:** 404 { error: 'NOT_FOUND' } if poll not found
- _Fetches poll from SchedulingPoll, options from SchedulingPollOption (ordered by start_at), and votes from SchedulingPollVote. previewLimiter applied._

#### `POST /poll/:id/vote`
- **Auth:** optionalAuth
- **Request:** Path: id (poll UUID). Body (Joi schema): { name: string max 200 or null (optional), email: email max 320 or null (optional), votes: [{ option_id: UUID (required), value: 'yes' | 'maybe' | 'no' (optional, default 'yes') }] (required, min 1 vote) }
- **Response:** { ok: true }
- **Errors:** 404 { error: 'NOT_FOUND' } if poll not found. 409 { error: 'POLL_CLOSED' } if poll.status !== 'open'. 400 { error: 'VOTER_REQUIRED', message: 'Sign in or provide an email to vote.' } if no req.user.id and no email provided. 400 { error: 'INVALID_OPTION', message: 'One or more options do not belong to this poll.' } if any option_id not found in poll. 400 { error: 'Validation failed', details: [...] } on schema violation
- _Voter identity: req.user.id or normalized email. Name optional but recorded if provided. Validates all options belong to poll before recording any votes. Upserts per (option_id, voter_key) — updates existing vote or inserts new. bookingWriteLimiter applied._

---

## Home Calendar (home.js): /api/homes/:id/events endpoints for household calendar event CRUD and RSVP management

_Auth: verifyToken (Bearer or pantopus_access cookie) required for all endpoints; req.user.id extracted from token. Permission: checkHomePermission(homeId, userId) gates access — returns { hasAccess, isOwner, occupancy }. Error envelope: { error: string, message?: string }. Validation failures: 400 { error: 'Validation failed', details: [...] }. Database tables: HomeCalendarEvent (with request_rsvp + reminders added in migration 164); HomeCalendarEventAttendee for per-user RSVP status. Booking union (calendar.view permission): confirmed/pending bookings from Booking table are merged into event list at query time (not persisted)._

#### `GET /:id/events`
- **Auth:** authed-user (verifyToken)
- **Request:** Query params: start_after (ISO timestamp, optional) | start_before (ISO timestamp, optional)
- **Response:** { events: [ { id (uuid), home_id (uuid), event_type (string: 'guest'|'vendor'|'maintenance'|'trash_recycling'|'chore'|'appointment'|'resource_booking'|'house'|'other'), title (string), description (string|null), start_at (ISO timestamp), end_at (ISO timestamp|null), location_notes (string|null), recurrence_rule (string|null), assigned_to (uuid[]|null), alerts_enabled (boolean), created_by (uuid), created_at (ISO timestamp), updated_at (ISO timestamp), visibility (string: 'private'|'members'|'public_preview'), source (string: 'event'|'booking' — booking union marker), booking_id (uuid — only if source='booking'), booking_status (string: 'pending'|'confirmed' — only if source='booking') } ] }
- **Errors:** 403 { error: 'No access to this home' }, 500 { error: 'Failed to fetch events' }
- _Returns union of HomeCalendarEvent rows + query-time merged confirmed/pending Booking rows (gated on calendar.view permission). Bookings are never persisted in HomeCalendarEvent; union is live. Sorted by start_at ascending. start_after/start_before filter both tables. Booking rows synthesized with source='booking' and booking_status fields for client differentiation._

#### `POST /:id/events`
- **Auth:** authed-user (verifyToken)
- **Request:** Body: { event_type (string, required: one of 'guest'|'vendor'|'maintenance'|'trash_recycling'|'chore'|'appointment'|'resource_booking'|'house'|'other'), title (string, required), description (string, optional), start_at (ISO timestamp, required), end_at (ISO timestamp, optional), location_notes (string, optional), recurrence_rule (string, optional), assigned_to (uuid[], optional), alerts_enabled (boolean, optional, default=true), request_rsvp (boolean, optional, default=false), reminders (array, optional, default=[]) }
- **Response:** 201 { event: { id (uuid), home_id (uuid), event_type (string), title (string), description (string|null), start_at (ISO timestamp), end_at (ISO timestamp|null), location_notes (string|null), recurrence_rule (string|null), assigned_to (uuid[]|null), alerts_enabled (boolean), request_rsvp (boolean), reminders (jsonb array), created_by (uuid), created_at (ISO timestamp), updated_at (ISO timestamp), visibility (string, default='members') } }
- **Errors:** 400 { error: 'event_type, title, and start_at are required' }, 403 { error: 'No access to this home' }, 500 { error: 'Failed to create event' }
- _No Joi validation; basic required field checks only. event_type must match enum. alerts_enabled defaults to true if not explicitly false. request_rsvp coerced to boolean (true if === true). reminders coerced to array if already array, else [] . created_by set to req.user.id. visibility defaults to 'members'. Both request_rsvp and reminders are new fields (migration 164)._

#### `PUT /:id/events/:eventId`
- **Auth:** authed-user (verifyToken)
- **Request:** Body: any subset of { title (string), description (string), event_type (string), start_at (ISO timestamp), end_at (ISO timestamp), location_notes (string), recurrence_rule (string), assigned_to (uuid[]), alerts_enabled (boolean), request_rsvp (boolean), reminders (array) }
- **Response:** 200 { event: { id (uuid), home_id (uuid), event_type (string), title (string), description (string|null), start_at (ISO timestamp), end_at (ISO timestamp|null), location_notes (string|null), recurrence_rule (string|null), assigned_to (uuid[]|null), alerts_enabled (boolean), request_rsvp (boolean), reminders (jsonb array), created_by (uuid), created_at (ISO timestamp), updated_at (ISO timestamp), visibility (string) } }
- **Errors:** 403 { error: 'No access to this home' }, 500 { error: 'Failed to update event' }
- _Partial update; only whitelisted keys are accepted: title, description, event_type, start_at, end_at, location_notes, recurrence_rule, assigned_to, alerts_enabled, request_rsvp, reminders. updated_at automatically set to current ISO timestamp. No validation — any value is accepted and stored (e.g., invalid event_type not checked at handler level)._

#### `DELETE /:id/events/:eventId`
- **Auth:** authed-user (verifyToken)
- **Request:** No body
- **Response:** 200 { message: 'Event deleted' }
- **Errors:** 403 { error: 'No access to this home' }, 500 { error: 'Failed to delete event' }
- _Soft delete not implemented; row is removed from HomeCalendarEvent. Cascades to HomeCalendarEventAttendee (ON DELETE CASCADE)._

#### `GET /:id/events/:eventId`
- **Auth:** authed-user (verifyToken)
- **Request:** No query params or body
- **Response:** 200 { event: { id (uuid), home_id (uuid), event_type (string), title (string), description (string|null), start_at (ISO timestamp), end_at (ISO timestamp|null), location_notes (string|null), recurrence_rule (string|null), assigned_to (uuid[]|null), alerts_enabled (boolean), request_rsvp (boolean), reminders (jsonb array), created_by (uuid), created_at (ISO timestamp), updated_at (ISO timestamp), visibility (string) }, attendees: [ { user_id (uuid), rsvp_status (string: 'pending'|'going'|'maybe'|'declined'), updated_at (ISO timestamp) } ] }
- **Errors:** 403 { error: 'No access to this home' }, 404 { error: 'Event not found' }, 500 { error: 'Failed to load event' }
- _Fetches event detail + all RSVP attendee rows from HomeCalendarEventAttendee. attendees list is empty if no one has RSVP'd. Only user_id, rsvp_status, and updated_at are returned for attendees (not id, created_at, or event_id)._

#### `POST /:id/events/:eventId/rsvp`
- **Auth:** authed-user (verifyToken)
- **Request:** Body: { status (string, required): 'going' | 'maybe' | 'declined' | 'pending' }
- **Response:** 200 { attendee: { user_id (uuid), rsvp_status (string: 'pending'|'going'|'maybe'|'declined') } }
- **Errors:** 400 { error: 'status must be going | maybe | declined | pending' }, 403 { error: 'No access to this home' }, 404 { error: 'Event not found' }, 500 { error: 'Failed to record RSVP' }
- _Upsert pattern: if HomeCalendarEventAttendee row exists (event_id + user_id), updates rsvp_status and updated_at; else inserts new row with rsvp_status from body. status must match enum exactly (case-sensitive). user_id is req.user.id. If existing row exists, uses update path; otherwise insert path. Both return only user_id and rsvp_status (not id or updated_at)._

---
