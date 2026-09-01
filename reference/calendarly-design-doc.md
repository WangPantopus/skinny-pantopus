# Calendarly — Design Doc

> Product & architecture design for **Calendarly**, Pantopus's scheduling/booking layer (a Calendly/Cal.com analog scoped to a neighborhood/home app). Companion to the [implementation plan](./calendarly-implementation-plan.md) (tables, endpoints, phasing) and the design prompt suite (`~/Downloads/calendarly-design-prompt-suite.md`, 94 screens). This doc covers the *why* and the engine *algorithm*.
>
> **Revised after a grounded review pass (Jun 2026).** Key decisions: v1 ships **Personal + Home together**; home bookings surface on the household calendar via a **query-time union** (not a write-through copy); **transactional email is a v1 channel** for non-user invitees. Deltas are tagged **[REVIEW]**.

---

## 1. Problem & shape

Pantopus already has an internal shared **household calendar** (`HomeCalendarEvent`) and a slot/reservation primitive (**Support Trains**). What it lacks is **bookable availability** — the Calendly idea: publish when you're free, share a link, let someone pick a slot, and have it land on your calendar without back-and-forth.

Calendarly adds that booking layer across three contexts that already exist as the app's identity pillars:

- **Personal** (sky) — "book time with me" (a neighbor, a tutor, a handyman, a consultation).
- **Family/Home** (green) — coordinate across a household: find a time everyone's free, book the guest room, schedule a vendor when someone's home.
- **Business** (violet) — book a service; distribute across a team.

The product bet: most of this is *composition* over infrastructure Pantopus already has. The literal Cal.com superset (CRM routing, dev platform, enterprise SSO, self-hosting) is out of scope — it doesn't fit a neighborhood app. We build the slice that fits.

**[REVIEW] Where the two pillars differ on day-one viability.** The **Home** pillar is the most defensible wedge: "find a time my whole household is free, land it on our shared calendar" is genuinely differentiated, and because the in-Pantopus `HomeCalendarEvent` is plausibly the household's *real* shared calendar, availability is meaningfully complete even without external sync. The **Personal** pillar is closer to a head-on Calendly clone, and its availability is blind to the user's real Google/Apple calendar — so a personal `/book` link risks double-booking on day one. v1 ships both, but the Personal link should pull in a **read-only Google free/busy import** to neutralize that risk (see §7).

---

## 2. Core model — one engine, owner-polymorphic

A single scheduling engine keyed by `(owner_type, owner_id)` where `owner_type ∈ {user, home, business}`. The same screens, APIs, and engine serve all three; the **identity pill re-scopes** the data. This is idiomatic to the codebase — `MeView` already splits into Personal/Home/Business pillars, and `notificationService` already has personal/audience/platform contexts.

Why one engine, not three features:

- **No duplication.** Event types, availability, bookings, reminders, payments are structurally identical across contexts; only the *owner* and the *availability source* differ.
- **Composability.** Home and Business scheduling are defined *in terms of* Personal availability (next section). Three separate features couldn't share that cleanly.
- **One mental model for users.** Switching the pill re-scopes the screen — it doesn't open a different app.

### The central invariant: personal availability is the source of truth

A user's availability (working hours + overrides + busy blocks + existing bookings) lives in **exactly one place** — their personal `AvailabilitySchedule`. Home and Business never store a copy. They **compose** it:

- **Collective** ("when is the whole household / the required staff free?") → **intersect** the required members' free time.
- **Round-robin** ("any one of us can take it") → **union** the members' free time; assign each slot to an eligible member by rule.

This is the principled meaning of "family references personal": a member edits their hours once, and every context they participate in stays correct. It's Calendly's *collective* and *round-robin* event types, repurposed for a household and a small business.

```
Personal availability (atomic)
   ├── Home "find a time"  = ∩ required members   (collective)
   │                       = ∪ members + rule      (round-robin)
   └── Business service    = ∪ team seats + rule   (round-robin)
                           = ∩ required staff       (collective)
```

**[REVIEW] Composition crosses the identity firewall.** Reading one member's personal free/busy into a *different* owner's slot view (a business owner computing slots over a team member; a household member over another) touches the privacy boundary the app invests in (`BusinessSeat`/`SeatBinding`, notification context allowlists). The contract: compose **free/busy booleans only** (never event titles/details), require members to **opt in** to being an assignee, and treat a member who has set **no schedule** as contributing *nothing* (with a host-visible "N members haven't set hours" warning) — never a silently fabricated 9–5.

---

## 3. Entities (conceptual)

- **BookingPage** — the public face of an owner (`/book/[slug]`): who they are, which event types are visible. **[REVIEW]** Carries a `timezone` (the default display tz for home/business pages, which have no single member tz) and real per-type owner FKs alongside the polymorphic pair.
- **EventType** — a bookable template: duration(s), location, price, buffers, limits, approval, assignment mode, intake questions, **and cancellation/refund/no-show policy** `[REVIEW]`. (Calendly "event type"; for business, a "service".)
- **AvailabilitySchedule** (+ rules, overrides, blocks) — *personal only*. Weekly hours, date overrides, and ad-hoc busy blocks. The free/busy source.
- **Booking** — a confirmed/pending slot with an invitee. **[REVIEW]** Freezes a `policy_snapshot` at creation and links `rescheduled_from_booking_id` for audit. For home it is surfaced on the shared calendar via a **query-time union** (§6) — there is no copied `HomeCalendarEvent`.
- **EventTypeAssignee** — for home/business, which members are eligible (with weight/priority, **and rotation state for round-robin**) — the bridge to composition.
- **Package / PackageCredit**, **Invoice** (reused `BusinessInvoice`), **Payment** (reused, **extended** — §6) — monetization.

Full schema in the [implementation plan §3](./calendarly-implementation-plan.md).

---

## 4. The availability engine (the one new subsystem)

`computeSlots({ ownerType, ownerId, eventType, from, to, viewerTimezone }) → Slot[]`. This is the only genuinely new, non-trivial code; everything else is CRUD + reuse. **[REVIEW]** It is net-new ~end-to-end — the Support Trains availability helper only counts reservations against pre-created capacity rows and has no tz/DST/working-hours/recurrence/buffer logic, so it is not a template. Build on **`luxon`** (DST-safe wall-clock-in-zone math) + **`rrule`** (expansion) — neither exists in the repo yet, and `HomeCalendarEvent.recurrence_rule` is stored text that nothing currently expands. Pseudocode:

```
function computeSlots(ownerType, ownerId, eventType, from, to, viewerTz):
    clamp [from, to] to eventType.max_horizon_days   # [REVIEW] reject larger ranges 400

    # 1. Resolve whose availability matters
    if ownerType == 'user':
        members = [ownerId]
        schedules = { ownerId: eventType.schedule }      # personal source of truth
    else:                                                 # home or business
        members = activeAssignees(eventType)              # HomeOccupancy / BusinessTeam, is_active
        schedules = { m: defaultSchedule(m) for m in members }   # no schedule => contributes nothing

    # 2. Per member, build free intervals in [from, to]   (batch busy in ONE query/source — no N+1)
    freeByMember = {}
    for m in members:
        windows = weeklyWindows(schedules[m], from, to)   # AvailabilityRule, in schedule tz
        windows = applyOverrides(windows, schedules[m])   # AvailabilityOverride (day off / special)
        busy    = bookingsOverlapping(m, from, to)        # start_at < to AND end_at > from  [REVIEW]
                ∪ blocks(m)                               # incl. recurrence_rule IS NOT NULL, RRULE-expanded [REVIEW]
        if ownerType == 'home':
            busy = busy ∪ homeCalendarEvents(ownerId, m)  # union read; busy iff assigned_to NULL OR m∈assigned_to
        busy = localizeToScheduleTz(busy, schedules[m].tz)   # [REVIEW] instants -> wall-clock before subtract
        free = subtract(windows, padBuffers(busy, eventType))   # [REVIEW] asymmetric: [s-buf_after, e+buf_before]
        freeByMember[m] = free

    # 3. Combine per assignment mode
    if mode == 'collective':
        combined = intersectAll(freeByMember.values())    # all required free
    elif mode == 'round_robin':
        combined = unionWithEligibility(freeByMember)      # any one; remember the eligible SET per slot
    else:                                                  # one_on_one / group
        combined = freeByMember[members[0]]

    # 4. Discretize into candidate starts and apply guardrails
    slots = gridStarts(combined, eventType.slot_interval_min, eventType.default_duration)
    slots = filter(slots, minNotice, maxHorizon, overrideBlockedDates)
    # [REVIEW] per_booker_cap & per-host daily_cap are enforced at CREATE time, not here
    #          (anonymous invitee has no identity behind the public, unauthenticated endpoint)

    # 5. Round-robin: eligibility only (deterministic). The fair-rotation PICK happens at create time.
    if mode == 'round_robin':
        for s in slots: s.eligibleHosts = eligibleAt(s)    # [REVIEW] do NOT pick here — see below

    # 6. Present in the viewer's timezone (DST-safe)
    return [toTz(s, viewerTz) for s in slots]
```

The same function backs three surfaces: the invitee slot picker, the host reschedule sheet, and the home "find a time" flow.

### Edge cases that must be handled (the bug-prone ones)

- **Timezones & DST.** Store schedule times as wall-clock `time` + schedule `timezone`; compute in that tz; convert to viewer tz at the end. Never store local times as UTC. A 9:00 rule must stay 9:00 across a DST boundary. **[REVIEW]** `HomeCalendarEvent` busy is stored as `timestamptz` *instants* with no tz column — localize it into the schedule's tz before subtracting from wall-clock windows. The `User` table has **no** timezone column, so `AvailabilitySchedule.timezone` is the only source and must be seeded for every member.
- **Recurring busy is anchored in the past.** **[REVIEW]** A recurring `AvailabilityBlock`/`Booking`/`HomeCalendarEvent` has a single `start_at` at the series anchor, typically *before* `from`. A naive `start_at`-window filter (what the existing Calendar read does) silently drops it → double-booking. Fetch all `recurrence_rule IS NOT NULL` rows regardless of anchor and RRULE-expand into instances clipped to `[from,to]`.
- **Buffer math is asymmetric.** **[REVIEW]** Buffers belong to the *candidate* meeting: pad a busy `[s,e]` to `[s − buffer_after, e + buffer_before]`. The create-time conflict guard compares the *same* buffer-padded ranges, so two back-to-back bookings can't violate each other's buffers.
- **Empty intersection is normal.** Collective composition frequently yields *zero* slots in a window — that's an expected state with a "try a wider range / relax members" affordance, not an error. (But distinguish it from "members have no schedule," which is a misconfiguration to surface.)
- **Round-robin fairness is a create-time decision.** **[REVIEW]** computeSlots is a pure read called repeatedly; if it *picked* a host from mutable rotation state, two viewers would see different hosts for the same slot and the picked host could differ from the assigned one. So compute only the eligible *set* at read time; do the fair pick (read+update `EventTypeAssignee.last_assigned_at`/`assigned_count`) transactionally at create time, then apply per-host `daily_cap`.
- **Race on booking.** **[REVIEW]** Two invitees can select the same slot; an application re-check is not atomic. Enforce with a Postgres **exclusion constraint** (`EXCLUDE USING gist` over `host_user_id` + buffer-padded `tstzrange`, `WHERE status IN ('pending','confirmed')`, needs `btree_gist`); the create path catches the `23P01` violation and returns **409 "slot taken."** Group events (`seat_cap > 1`) instead use a capacity count-check, not the hard exclusion.
- **Performance / DoS.** **[REVIEW]** The public slots endpoint is cacheless and unauthenticated. Batch per-source busy queries, cache computed free-sets keyed by `(owner,eventType,from,to,membersHash,busyVersion)` with short TTL, clamp the horizon server-side, and load-test in Phase 0.
- **Secret / one-off / group.** **[REVIEW]** `secret` event types are excluded from listing but slots stay computable by direct slug (obscurity); `one_off` tokens pre-bind an event type (+ optional slot) and consume on use; `group` allows up to `seat_cap` concurrent bookings per slot.

---

## 5. Booking lifecycle

```
            ┌────────── requires_approval ──────────┐
            ▼                                        │
  (book) → pending ──approve──► confirmed ──start──► completed
            │  └──decline──► declined        │ └──no-show──► no_show
            │                                ├──reschedule──► confirmed (new time)
   auto-confirm ─────────────► confirmed     └──cancel──► cancelled (+ refund per policy)
```

- **Approval** is an event-type setting; auto-confirm skips `pending`.
- **Reschedule** can be host-forced or invitee-proposed (the propose-vs-force toggle). **[REVIEW]** During recompute, exclude the in-flight booking's *own* range (so it can re-pick the same time) but treat it as busy for everyone else; a confirmed reschedule atomically releases the old range and claims the new one (the exclusion constraint handles this on `UPDATE`); links `rescheduled_from_booking_id`.
- **Cancel** runs the policy: within free-window → full refund; otherwise per cancellation policy; deposits may be non-refundable; a no-show may incur a fee. **[REVIEW]** This requires policy data that must be *stored* — `EventType` carries `cancellation_window_min`, `reschedule_cutoff_min`, `deposit_refundable`, `no_show_fee_cents`, `refund_policy`, and each Booking freezes a `policy_snapshot` at creation. `stripeService.createSmartRefund(paymentId, amount, …)` takes the *amount*, computed from that snapshot. Refund path: pre-capture cancel / post-capture refund / post-transfer clawback.
- **Notifications fire on every transition** — but the channel depends on the invitee. **[REVIEW]** `createNotification`/`pushService` are user-keyed; the common public-link invitee (`invitee_user_id` NULL) is a non-user and gets **email** (modeled on the existing `emailService.sendGuestReservationConfirmationEmail` precedent) with an **`.ics`** attachment (stable `UID`, `METHOD:REQUEST` on confirm / `CANCEL` on cancel). Hosts (always users) get in-app + push + realtime. See §7 — email is a v1 channel, not deferred.

---

## 6. Reuse philosophy

The design deliberately maximizes reuse so the surface area of new, risky code is small. **[REVIEW]** The reuse claims are honest about what *exists* (verified in the tree), but several reuses need real, gig-shaped *glue* — graded below so the effort isn't under-counted.

| Concern | Decision | Reality |
|---|---|---|
| Household calendar | Home bookings surface via a **query-time union** of `Booking` + `HomeCalendarEvent` — **[REVIEW] not** a write-through copy. | ✅ Eliminates dual-write drift on reschedule/cancel; slightly more complex read path. |
| Payments | **No new payment tables**, but the stack is gig-shaped: add `Payment.booking_id`, `ALTER` two CHECK constraints (`payment_type`, `WalletTransaction.type`), add `creditBookingIncome`, and branch `processPendingTransfers` + `stripeWebhooks` on `payment_type`. Invoices reuse `BusinessInvoice`. | 🟡 Stateless verbs reuse; persistence/settlement/webhook glue is real work. |
| Team | Round-robin uses the existing `BusinessTeam` membership model. | ✅ (`BusinessSeat` is the separate invite/seat table.) |
| Reminders | A cron job whose **scaffold** (`node-cron` + `wrapJob`) ports from `autoRemindWorker.js`; the worker body (dual-recipient, T-24h/T-1h, `BookingReminderLog` dedupe, suppression) is new. | 🟡 |
| Links | Token links reuse the `routes/businessSeats.js` crypto+hash+expiry pattern. | ✅ |
| Slot UI | A **new** invitee slot-picker (date strip + time-of-day grid + tz label + empty state). | 🔵 Support Trains is a materialized signup list, a visual reference only. |
| Email to non-users | New booking templates + `.ics` + unsubscribe, modeled on `emailService.sendGuestReservationConfirmationEmail`; `nodemailer` already present. | 🟡 |
| Find-a-time | Prefer **direct availability intersection**; `HomePoll` is choice-voting with no time-slot semantics (and is migration-only). | 🔵 |

The result: the *only* substantial new subsystem is the availability engine (§4) — but "everything else" is schema + CRUD + a meaningful amount of **adapter** wiring (email/`.ics`, payment branching, the new slot-picker, public-write security), not pure glue.

---

## 7. What we deliberately don't build (and why)

- **Full external calendar sync** (Google/Outlook/Apple/CalDAV two-way) — the most expensive piece (OAuth per provider, token refresh, write-back, change webhooks). Deferred. The `ConnectedCalendar` table is stubbed so it can light up without a schema change. **[REVIEW] But read-only Google free/busy *import* is split out and proposed for v1 (personal pillar):** it's the cheap ~20% (OAuth + free/busy read, `check_conflicts=true`, no write-back) and it removes the day-one double-book risk that makes a standalone personal `/book` link feel broken. For the **home** pillar the in-Pantopus calendar is a sufficient availability source, so the gap is survivable there. **This is the single most important thing to communicate to users** for any surface that ships without it.
- **Email — [REVIEW] NOT deferred; required for v1.** The first draft put email in the "later" pile; the review found that non-user invitees (the common case) can't receive in-app/push, so the core loop can't confirm/remind the booker. Email rides the existing `emailService` + `nodemailer`. **SMS/WhatsApp** remain deferred (Twilio is a later channel).
- **Video integration** (Zoom/Meet/Teams) — per-provider OAuth; deferred. First-party video — never.
- **Enterprise/dev-platform features** — CRM/ATS routing, public REST API, OAuth provider, SAML/SCIM, self-hosting, seat-based org billing, browser extensions. Out of scope: these serve B2B SaaS, not a neighborhood app.

---

## 8. Decision log

| Decision | Choice | Rationale |
|---|---|---|
| One engine vs. three features | **One**, owner-polymorphic | No duplication; composition; one user model. |
| Availability storage | **Personal-only**, composed for home/business | "Family references personal"; edit-once correctness. |
| v1 scope | **[REVIEW] Personal + Home together** | Home is the differentiated wedge; Personal is the recognizable hook. Ship both, engine-first. |
| Home bookings on the calendar | **[REVIEW] Query-time union** (`Booking` ∪ `HomeCalendarEvent`) | Eliminates dual-write drift; no back-pointer column or in-transaction mirroring to maintain. |
| Invitee notifications | **[REVIEW] User → in-app+push; non-user → email + `.ics`** | Public-link invitees are usually non-users; user-keyed channels can't reach them. |
| Double-book prevention | **[REVIEW] DB-level exclusion constraint** (`btree_gist`, buffer-padded range) | On-the-fly slots have no materialized row to unique-index; app re-check isn't atomic. |
| Date/recurrence math | **[REVIEW] `luxon` + `rrule`** (new deps) | No tz/RRULE library exists; `recurrence_rule` is currently un-expanded text. |
| Payments | **Reuse Stripe verbs; extend the gig-shaped persistence/settlement glue** | `Payment` needs `booking_id`, CHECK ALTERs, wallet + cron + webhook branching. |
| Public flow host | **Web `/book/[slug]`** for all owner types | Single namespace; mirrors `support-trains/[id]`; native handles host + in-app invitee. |
| Public writes | **[REVIEW] Dedicated limiter + `is_live` gate + email-match binding** | The `supportTrains.js` guest-reserve flow, not the read-only `public.js` pattern. |
| Navigation | **No new bottom tab**; under You/Me pillars + Home calendar | Explicit anti-goal; keeps the app's 5-tab shell. |
| External sync | **Deferred** (stub table); **read-only free/busy import considered for v1-personal** | Two-way is the most expensive; read-only import is cheap and removes the double-book. |
| Build order | **Engine → Personal+Home → Business(single-host) → round-robin/packages/automations** | Front-load the risky engine; defer round-robin (hard correctness, tiny teams). |

---

## 9. Success criteria for v1

**[REVIEW]** Two lovable outcomes, with the no-sync caveat applied where it actually holds:

- **Home (headline):** a household can "find a time" that correctly intersects two+ members' availability across a DST boundary, land the result on the shared household calendar (visible via the union read), and have a reminder fire before the meeting — all without leaving the app, and without external calendar sync (the in-app calendar is the household's real one).
- **Personal:** a first user can, in under ~2 minutes, claim a `/book/[slug]` link, accept default hours, share it, and receive + approve a booking — the invitee (even a non-user) gets a confirmation email with an `.ics` and a reminder. **This surface should ship with the read-only free/busy import** so it doesn't double-book against the user's real calendar; the no-sync limitation must be clearly surfaced on any personal link that ships without it.
