# Calendarly iOS — Kickoff Prompts (one per work-stream)

> **How to kick off a stream:** open a fresh agent session and paste **(1) the SHARED PREAMBLE** (below, identical for every stream) **+ (2) that stream's BLOCK** + **(3) the screen designs** for exactly the screen IDs that stream owns (from `~/Downloads/calendarly-design-prompt-suite.md`). The agent reads its full spec from `reference/calendarly-workstreams/20-ios-workstreams.md` and builds only that stream.
>
> **Order:** `I0a` → merge → `I0b` → merge → then `I1…I18` in **any order, fully parallel** (waves are a suggestion only; every feature stream depends solely on Foundation and is file-disjoint).
>
> **Scope:** iOS only. Backend is feature-complete on `feature/calendarly` (migrations 159–165). 93 buildable iOS screens across I1–I18 (C9 is web-only).

---

## SHARED PREAMBLE  *(paste at the top of EVERY stream prompt below)*

```
You are an autonomous senior iOS engineer (SwiftUI) building ONE work-stream of the Pantopus "Calendarly" scheduling feature. The backend is feature-complete on branch `feature/calendarly` (migrations 159–165). Build this stream's screens pixel-faithfully to the designs I paste in this session and wire them to the live backend. Work autonomously through all screens in this stream; do not stop for check-ins.

READ FIRST (authoritative specs already in the repo):
• reference/calendarly-workstreams/20-ios-workstreams.md → YOUR stream's section, plus §3 (conflict-safety), §4 (rules + GLOBAL WIRING CONTRACT), §5 (Foundation — what you consume read-only), §6 (common acceptance/forbidden/reuse), §7 (coverage). Your stream's section is your contract — owns/forbidden files, endpoints, and required states are all there.
• reference/calendarly-backend-api.md → exact request/response for every endpoint you call.

NON-NEGOTIABLE RULES (violating these breaks other parallel streams):
1. Create/edit ONLY the files YOUR stream OWNS (listed in your section). Everything shared — Core/Networking/Endpoints/Scheduling*.swift + Core/Networking/Endpoints/HomesEndpoints.swift, Core/Networking/Models/Scheduling/** + Core/Networking/Models/Homes/CalendarEventDTOs.swift, Features/Scheduling/Foundation/**, Features/Scheduling/Routing/**, Features/Scheduling/SharedUI/**, Features/Root/HubTabRoot.swift, Features/Root/YouTabRoot.swift, Features/Me/* — is built by Foundation (I0a/I0b). CONSUME it read-only. If anything shared is missing or wrong, STOP and flag it as a Foundation gap — do NOT add it locally.
2. Fill the Foundation stub View+ViewModel ONLY for your ROUTED FULL screens. Sheets, modals, and embedded cards have NO route/stub — present them locally (.sheet/.fullScreenCover/inline) from your own parent screens.
3. Reuse the shells (ListOfRowsView / FormShell / WizardShell + WizardIdentity / ContentDetailShell) and Foundation SharedUI (SlotPicker, SchedulingStatusPill, SchedulingIdentityTheme, and the shared sheets TimezoneSelectorSheet/AddToCalendarSheet/SlotTakenSheet/ShareLinkSheet/CancellationPolicySheet). Theme tokens only (Theme.Color.*, Spacing, Radii, Icon(...)) — no hardcoded colors/spacing.
4. Honor the wiring contract: owner-context via SchedulingOwner (Personal = omit owner fields / Business = owner_type:'business' + owner_id / Home = use the /api/homes/:homeId/scheduling/* alias); ALWAYS send tz (IANA) on slot/calendar reads, render startLocal, store/compare UTC; persist the one-time manageToken; handle 409 {error, alternatives:[{start,end,startLocal}]} on every create/reschedule via the Foundation SlotTakenSheet (surface nearest times — never a dead end); home bookings render via the calendar UNION (rows tagged source:'booking') — NEVER create HomeCalendarEvent rows for bookings; paused/secret/unavailable/expired are first-class response states, not errors; paid surfaces stay behind SchedulingFeatureFlags.paidEnabled + Stripe TEST mode (payout settlement deferred → show processing/pending); POST /connected-calendars/connect returns 501 → show "coming soon".
5. iOS specifics: project.pbxproj is NOT git-tracked (XcodeGen) — just add files under Features/Scheduling/** and run `make bootstrap` (which runs `xcodegen generate`) to build. Xcode 16.4 / Swift 5.10 / SWIFT_STRICT_CONCURRENCY=complete. NEVER use default-argument @MainActor view-model initializers (known Xcode 16.4 crash) — inject deps explicitly and hold VMs via @State.

WORKFLOW & ACCEPTANCE: branch `claude/calendarly-ios-<id>-<slug>`; one PR to master (never push master). Build green via `make bootstrap` then build the Pantopus scheme. Verify EACH screen in the iOS Simulator signed into a hosted-dev test account against the LIVE endpoint (migrations 159–165 applied) — keep your test bookings/pages. Screenshot each built screen vs the pasted design. Targeted tests ONLY for this stream's view-models/services under PantopusTests/Scheduling/<Stream>/ using APIClient(retryPolicy:.none, session: SequencedURLProtocol.makeSession()) — never run full suites. Every fetchable surface ships loading skeleton / empty (EmptyState) / loaded / error+Retry, wrapped in .offlineBanner(...). Run SwiftLint + .swiftformat before the PR.

DEPENDS ON: iOS Foundation (I0a + I0b) already merged to master.
```

---

# FOUNDATION (serial gate — build + merge these two FIRST, in order)

## I0a — Contract layer (no UI)

```
[SHARED PREAMBLE above]

=== YOUR STREAM: I0a — Contract layer (no UI). Branch: claude/calendarly-ios-i0a-contract ===
This is the FIRST Foundation gate. It has NO screens and NO designs — it is the shared contract every feature stream consumes. Build exactly what §5.1 of 20-ios-workstreams.md lists:
• Core/Networking/Endpoints/SchedulingEndpoints.swift — host builders for ALL /api/scheduling/* and /api/homes/:homeId/scheduling/* routes (full list in §5.1), mirroring HomesEndpoints.swift/GigsEndpoints.swift; each takes a SchedulingOwner.
• Core/Networking/Endpoints/SchedulingPublicEndpoints.swift — all public builders (authenticated:false): /api/public/book/:slug[/:eventTypeSlug[/slots|/waitlist]], /book/o/:token, /booking/:token[/available-slots|/ics|/reschedule|/cancel|/unsubscribe|/accept-reschedule|/decline-reschedule], /poll/:id[/vote].
• Core/Networking/Models/Scheduling/*DTOs.swift — one file per resource group (§5.1 list): Decodable/Sendable/Hashable (Identifiable when id), explicit snake_case CodingKeys (APIClient does NOT convertFromSnakeCase). Public DTOs include the slot {start,end,startLocal}, the booking-create response with manageToken+clientSecret, and the manage view with actions/payment.
• Features/Scheduling/Foundation/SchedulingOwner.swift (owner-context helper: queryItems / ownerBody / pathPrefix), SchedulingError.swift (typed decoder for {error,message}, 400 validation details[], and 409 {code, alternatives[]}; SchedulingStatus enum for paused/secret/unavailable/expired), SchedulingFeatureFlags.swift (paidEnabled), SchedulingTime.swift (UTC↔tz helpers).
• EDIT Core/Networking/Models/Homes/CalendarEventDTOs.swift — add booking-union + migration-164 fields to CalendarEventDTO (source, bookingStatus, bookingId, visibility, requestRsvp, reminders — all Optional, snake_case CodingKeys) + a HomeEventAttendeeDTO + HomeEventDetailResponse. (This is the BLOCKER fix: I10/I12 consume these; centralize here so they don't collide.)
• EDIT Core/Networking/Endpoints/HomesEndpoints.swift — add getHomeEvent(homeId:eventId:) → GET /api/homes/:id/events/:eventId and rsvpHomeEvent(homeId:eventId:body:) → POST .../rsvp.
MUST NOT touch: Features/Root/*, Features/Me/*, any OTHER existing endpoint/DTO file, any feature folder. Pure-additive except the two Homes/ edits above.
ACCEPTANCE: `make bootstrap` + build the Pantopus scheme green; decode tests under PantopusTests/Scheduling/Contract/ proving each DTO decodes from a stubbed 200 body and SchedulingError parses alternatives[]/details[]/status from stubbed 400/409 bodies; SwiftLint + .swiftformat pass. No designs to request from me — confirm the endpoint/DTO inventory against reference/calendarly-backend-api.md.
```

## I0b — Routing seam + shared UI kit + per-screen stubs

```
[SHARED PREAMBLE above]

=== YOUR STREAM: I0b — Routing seam + shared UI kit + stubs. Branch: claude/calendarly-ios-i0b-uikit-routing. DEPENDS ON: I0a merged ===
Second Foundation gate. Build exactly what §5.2 of 20-ios-workstreams.md lists:
• Features/Scheduling/Routing/SchedulingRoute.swift — one case per NAVIGABLE FULL-SCREEN destination ONLY (Hashable payloads: ids/slugs/tokens/SchedulingOwner). Do NOT add cases for sheets/modals/cards — those are local (see the §2 "Stub model" non-routed ID list: A5, C3, C7, D8, E3, E4, E5, E6, E7, E9, E10, E11, G1, G2, G4, H4, H6, H13, …).
• Features/Scheduling/Routing/SchedulingRouter.swift — @ViewBuilder destination(for:owner:push:) switching every case → its stub view (the only route→view map).
• Features/Scheduling/Routing/Stubs/*.swift — one stub View + @Observable @MainActor ViewModel per routed screen, grouped by area folder; placeholder body. Feature streams later replace their own stub bodies.
• Features/Scheduling/SharedUI/** — SlotPicker.swift (tz-aware date+time grid driven by [SlotDTO], with loading/empty/no-availability states), SchedulingStatusPill.swift, SchedulingIdentityTheme.swift (SchedulingOwner → WizardIdentity .accent/.accentBg), and the shared sheets TimezoneSelectorSheet (C7), AddToCalendarSheet (D8, .ics via requestData), SlotTakenSheet (renders 409 alternatives), ShareLinkSheet (C3), CancellationPolicySheet (G14/D10). Optional SchedulingClient.swift thin wrapper.
• SEAM EDITS (the only existing-file edits): HubTabRoot.swift + YouTabRoot.swift — add `case scheduling(SchedulingRoute)` + one delegating arm to SchedulingRouter; YouTabRoot — add me.scheduling* dispatch in handleAction/handleSection; MeViewModel.swift (+ MeIdentity.swift) — add the Scheduling MeActionTile/MeSectionRow (routeKey me.scheduling + home/business variants).
DESIGNS I WILL PASTE: the SlotPicker visual, status pills, and the FIVE shared sheets (C3 Share Link, C7 Timezone Selector, D8 Add to Calendar, G14 Cancellation Policy, and the 409 Slot-Taken presenter). Build those here; feature streams only present them.
ACCEPTANCE: `make bootstrap` + build green; every SchedulingRoute case resolves to a stub that renders in a #Preview without crash; tapping the Me "Scheduling" tile navigates to the Hub stub in the simulator; SlotPicker renders against a real …/slots response; NO default-argument @MainActor VM inits anywhere; SwiftLint + .swiftformat pass.
```

---

# FEATURE STREAMS  *(all depend on I0a + I0b merged; then fully parallel, any order)*

## I1 — Setup & Hub   `[host config]`  *(you have already started this one)*

```
[SHARED PREAMBLE above]

=== YOUR STREAM: I1 — Setup & Hub. Branch: claude/calendarly-ios-i1-setup-hub ===
Build A1 Scheduling Hub, A2 First-Run Wizard / Set Up Booking Link, A3 Scheduling Settings Root, A4 Notifications Preferences, A5 Summary Card, A6 Onboarding for Home & Business.
Authoritative spec: §"Stream I1 — Setup & Hub" in 20-ios-workstreams.md.
Stream-specific notes: A5 Summary Card is an embedded card inside A1/A3 (a local view, NOT a routed screen — no stub). Fill stubs for A1, A2, A3, A4, A6 only. Wizard does a debounced live slug check via /booking-page/check-slug with suggestions on 409 SLUG_TAKEN. Notification prefs is a flexible object — round-trip unknown keys. A6 walks all three pillars (Home via the /api/homes/:homeId/scheduling alias, Business via owner_type:'business').
I will now paste the designs for A1–A6. Build, wire, verify each in the simulator, screenshot, open the PR.
```

## I2 — Event Types   `[host config]`

```
[SHARED PREAMBLE above]

=== YOUR STREAM: I2 — Event Types. Branch: claude/calendarly-ios-i2-event-types ===
Build B1 Event Type/Service List, B2 Event Type/Service Editor, B3 Intake Questions Editor, B8 Connected Calendars.
Authoritative spec: §"Stream I2 — Event Types" in 20-ios-workstreams.md.
Stream-specific notes: DELETE /event-types/:id returns 409 HAS_UPCOMING_BOOKINGS → offer "deactivate instead" (PUT is_active=false). Editor validates default_duration ∈ durations and slug (409 SLUG_TAKEN). Priced fields (price_cents/deposit/refund_policy) are hidden unless SchedulingFeatureFlags.paidEnabled. B8 Connected Calendars: read returns empty, connect → 501 "coming soon". Assignee editing is NOT here — it lives in I13; the editor links out for collective/round-robin config.
I will now paste the designs for B1, B2, B3, B8. Build, wire, verify, screenshot, PR.
```

## I3 — Availability   `[host config]`

```
[SHARED PREAMBLE above]

=== YOUR STREAM: I3 — Availability. Branch: claude/calendarly-ios-i3-availability ===
Build B4 Availability Schedule List, B5 Weekly Hours Editor, B6 Date Overrides & Holidays, B7 Booking Limits & Notice Rules, B9 Block off time.
Authoritative spec: §"Stream I3 — Availability" in 20-ios-workstreams.md.
Stream-specific notes: availability is ALWAYS personal (scoped to req.user — NO owner context/switch). Replacing rules/overrides is a whole-set PUT (build the full payload). DELETE default schedule → 409 CANNOT_DELETE_DEFAULT (prompt reassign first). HH:MM 24h; weekday 0=Sunday. Blocks support an optional RRULE. B7 booking-limits/notice rules persist on the EVENT TYPE (min_notice_min/max_horizon_days/slot_interval_min/daily_cap/per_booker_cap/buffers) via PUT /event-types/:id — own only the rules surface here; link to I2's editor for type-level fields, don't duplicate it.
I will now paste the designs for B4, B5, B6, B7, B9. Build, wire, verify, screenshot, PR.
```

## I4 — Booking page & sharing   `[host config]`

```
[SHARED PREAMBLE above]

=== YOUR STREAM: I4 — Booking page & sharing. Branch: claude/calendarly-ios-i4-booking-page ===
Build C1 Booking Link/Public Page Management, C2 Public Booking Page Preview, C3 Share Your Link Sheet, C4 One-off/Single-use Link Generator, H16 Booking-Link/Page Empty & Zero-State. (C9 Embed Widget is web-only — NOT here.)
Authoritative spec: §"Stream I4 — Booking page & sharing" in 20-ios-workstreams.md.
Stream-specific notes: C3 uses the Foundation ShareLinkSheet — present it locally, do not redefine it (no stub for C3). reset-slug shows a danger confirm (invalidates the old link). C4 one-off links return token+path+expires_at — store the token in the shared link; support offered_slots + single-use. C2 preview fetches the PUBLIC view GET /api/public/book/:slug (authenticated:false) and must render status:'paused' honestly. H16 zero-state CTAs route into A2/B2.
I will now paste the designs for C1, C2, C3, C4, H16. Build, wire, verify, screenshot, PR.
```

## I5 — Invitee discovery   `[invitee/public]`

```
[SHARED PREAMBLE above]

=== YOUR STREAM: I5 — Invitee discovery. Branch: claude/calendarly-ios-i5-invitee-discovery ===
Build C5 Booking Landing/Booker Profile, C6 Date+Time Slot Picker, C7 Timezone Selector, C8 Slot/No-Availability State.
Authoritative spec: §"Stream I5 — Invitee discovery" in 20-ios-workstreams.md.
Stream-specific notes: ALL endpoints are public (authenticated:false), hit the backend origin. C7 = Foundation TimezoneSelectorSheet, presented locally (no stub); fill stubs for C5, C6, C8 only (C8 may be an empty-state inside C6 — if so, local). Always pass tz; render startLocal; tz selector defaults to device IANA and re-fetches slots on change. status:'paused' → friendly paused state (not error); secret event types are absent from the list; C8 no-availability offers next-horizon paging. This stream STOPS at slot selection — hand off to I6 via the router carrying slug/eventTypeSlug/start/tz. Wrap the Foundation SlotPicker.
I will now paste the designs for C5, C6, C7, C8. Build, wire, verify, screenshot, PR.
```

## I6 — Invitee confirm & manage   `[invitee/public]`

```
[SHARED PREAMBLE above]

=== YOUR STREAM: I6 — Invitee confirm & manage. Branch: claude/calendarly-ios-i6-invitee-confirm ===
Build D1 Intake/Booking Details Form, D2 Review & Confirm/Checkout, D3 Booking Confirmed/Thank-You, D4 Manage Your Booking.
Authoritative spec: §"Stream I6 — Invitee confirm & manage" in 20-ios-workstreams.md.
Stream-specific notes: build D1's form dynamically from eventType.questions (text/textarea/select/multiselect/checkbox/phone + required). On POST create: PERSIST the returned manageToken (add Features/Scheduling/Invitee/ManageTokenStore.swift) and route to D3 with it. Handle 409 on create via the Foundation SlotTakenSheet (alternatives). D3 offers Add-to-Calendar (Foundation AddToCalendarSheet, .ics). D4 computes can_cancel/can_reschedule from the booking `actions`. Paid path uses clientSecret only when SchedulingFeatureFlags.paidEnabled (Stripe TEST; settlement deferred → show processing). Reschedule/cancel edge surfaces are I7 — D4 links to them via router carrying the token.
I will now paste the designs for D1, D2, D3, D4. Build, wire, verify, screenshot, PR.
```

## I7 — Invitee edge & customer   `[invitee/public + customer]`

```
[SHARED PREAMBLE above]

=== YOUR STREAM: I7 — Invitee edge & customer. Branch: claude/calendarly-ios-i7-invitee-edge ===
Build D5 Slot Taken/Conflict, D6 Payment Failed/Retry, D7 Unavailable/Expired/Paused/Secret, D8 Add to Calendar, D9 Open-in-App/Deep-Link Hand-off, D10 Reschedule/Cancel Cutoff & Policy-Blocked, D11 My Bookings (customer), D12 Recurring/Multi-Session Setup.
Authoritative spec: §"Stream I7 — Invitee edge & customer" in 20-ios-workstreams.md.
Stream-specific notes: every status (unavailable/expired/paused/secret) is a first-class state keyed by SchedulingStatus, NOT an error screen. D8 reuses the Foundation AddToCalendarSheet; D10 reuses CancellationPolicySheet and surfaces deadlines from `actions` (reschedule_deadline/free_cancel_until). D9 reads Core/Routing/DeepLinkRouter.swift READ-ONLY (offers Open-in-App vs continue-in-web). D6 only when the paid flag is on. D11 (GET /my-bookings) dedupes by booking id (past/upcoming). D12 builds sessions[] for POST /bookings/recurring.
I will now paste the designs for D5–D12. Build, wire, verify, screenshot, PR.
```

## I8 — Bookings inbox & core   `[host lifecycle]`

```
[SHARED PREAMBLE above]

=== YOUR STREAM: I8 — Bookings inbox & core. Branch: claude/calendarly-ios-i8-bookings-inbox ===
Build E1 Bookings Inbox, E2 Booking Detail, E3 Approve/Decline Sheet, E4 Reschedule/Reassign Sheet, E5 Cancel & Refund Sheet.
Authoritative spec: §"Stream I8 — Bookings inbox & core" in 20-ios-workstreams.md.
Stream-specific notes: fill stubs for the routed full screens E1, E2 ONLY — E3/E4/E5 are sheets presented locally from E1/E2 (no stubs). Inbox tabs map to the status filter (upcoming/pending/past/cancelled) + search q. E4 wraps SlotPicker, honors tz, and handles 409 (SLOT_CONFLICT/PAST_DEADLINE) via SlotTakenSheet; reassign is home/business only (handle INVALID_HOST). E5 surfaces refund_issued + reason. Optimistic status flip with refetch-on-error; surface PAST_DEADLINE/ALREADY_* guards.
I will now paste the designs for E1–E5. Build, wire, verify, screenshot, PR.
```

## I9 — Bookings extras   `[host lifecycle]`

```
[SHARED PREAMBLE above]

=== YOUR STREAM: I9 — Bookings extras. Branch: claude/calendarly-ios-i9-bookings-extras ===
Build E6 Mark No-Show, E7 Post-Meeting Follow-up, E8 Group Event Roster & Seats, E9 Booking Search & Filter, E10 Double-Book Warning (host), E11 Send a Nudge, E12 Manual/On-Behalf Booking, E13 Waitlist Join & Management.
Authoritative spec: §"Stream I9 — Bookings extras" in 20-ios-workstreams.md.
Stream-specific notes: fill stubs ONLY for the routed full screens E8, E12, E13 — E6 No-Show, E7 Follow-up, E9 Search & Filter, E10 Double-Book Warning, E11 Nudge are sheets/modals presented locally (no stubs). E6 no-show only after event end (handle NOT_APPLICABLE_YET). E12 manual booking is owner-scoped + 409 alternatives. E7 calls POST /bookings/:id/nudge (and may read message-templates) directly — do NOT build the template-authoring UI (that's I16). Double-book (E10) is advisory, not a hard block. Waitlist promote notifies.
I will now paste the designs for E6–E13. Build, wire, verify, screenshot, PR.
```

## I10 — Home calendar & RSVP   `[home]`  *(EXCLUSIVE owner of Features/Homes/Calendar/*)*

```
[SHARED PREAMBLE above]

=== YOUR STREAM: I10 — Home calendar & RSVP. Branch: claude/calendarly-ios-i10-home-calendar ===
Build F1 Home Calendar/Agenda, F2 Home Event Detail + RSVP, F3 Home Add/Edit Event, F8 My Household Availability Settings, F15 Permission-Gated Scheduler View.
Authoritative spec: §"Stream I10 — Home calendar & RSVP" in 20-ios-workstreams.md.
Stream-specific notes: you are the EXCLUSIVE owner of Features/Homes/Calendar/* — extend HomeCalendarView/ViewModel, EventDetailView, AddEventForm*, CalendarEventCategory, MonthStripHeader to render the booking UNION. CONSUME read-only (Foundation/I0a owns these — do NOT edit): the booking-union fields on CalendarEventDTO and getHomeEvent/rsvpHomeEvent in HomesEndpoints.swift. Render source:'booking' rows distinctly (badge + booking_status pill); they are render-only and deep-link into Scheduling Booking Detail (E2) via router — NEVER create HomeCalendarEvent rows for bookings. RSVP upsert with optimistic flip. F8 household availability uses the personal /availability* for the signed-in member. F15 hides the scheduler when the member lacks calendar.view (render a no-access state on backend 403).
I will now paste the designs for F1, F2, F3, F8, F15. Build, wire, verify, screenshot, PR.
```

## I11 — Find-a-time & who's-free   `[home]`

```
[SHARED PREAMBLE above]

=== YOUR STREAM: I11 — Find-a-time & who's-free. Branch: claude/calendarly-ios-i11-find-a-time ===
Build F4 Find a Time — Setup, F5 Find a Time — Suggested Slots, F6 Find a Time — Member Poll Response, F7 Who's Free — Household Availability.
Authoritative spec: §"Stream I11 — Find-a-time & who's-free" in 20-ios-workstreams.md.
Stream-specific notes: home-only, owner ctx via /api/homes/:homeId/scheduling. find-a-time requires ≥1 member_id; collective vs round_robin toggle; pass tz, render startLocal; wrap SlotPicker for F5. F7 who's-free renders per-member free grids (members + freeByMember). F6 uses host polls (POST /polls, GET /polls/:id, POST /polls/:id/finalize) + public member voting (GET /api/public/poll/:id, POST .../vote) — handle POLL_CLOSED/INVALID_OPTION; finalize records finalized_start_at.
I will now paste the designs for F4, F5, F6, F7. Build, wire, verify, screenshot, PR.
```

## I12 — Home resources & visits   `[home]`

```
[SHARED PREAMBLE above]

=== YOUR STREAM: I12 — Home resources & visits. Branch: claude/calendarly-ios-i12-home-resources ===
Build F9 Bookable Home Resources — List, F10 Resource Editor, F11 Resource Detail/Booking Calendar, F12 Book a Resource, F13 Schedule a Visit — Setup, F14 Visit Detail.
Authoritative spec: §"Stream I12 — Home resources & visits" in 20-ios-workstreams.md.
Stream-specific notes: home-only, owner ctx. resource_type enum (room/vehicle/tool/charger/other); who_can_book v1 = members only. POST /resources/:rid/book honors max_duration_min/buffer_min/requires_approval and returns 409 SLOT_CONFLICT/RESOURCE_UNAVAILABLE → alternatives/busy state. F11 reads resource bookings via the home events UNION (GET /api/homes/:id/events) — never creates booking rows. Visits (POST /visits, vendor|guest) have a ≤30-day range (BAD_RANGE); F14 visit detail renders from GET .../events/:eventId (visits are stored as HomeCalendarEvent).
I will now paste the designs for F9–F14. Build, wire, verify, screenshot, PR.
```

## I13 — Business config & team   `[business]`

```
[SHARED PREAMBLE above]

=== YOUR STREAM: I13 — Business config & team. Branch: claude/calendarly-ios-i13-business-config ===
Build G1 Round-Robin Assignment Sheet, G2 Collective Event Setup, G3 Team Booking Availability, G4 Member Working-Hours Editor (see scope note), G5 Business Scheduling Settings.
Authoritative spec: §"Stream I13 — Business config & team" in 20-ios-workstreams.md.
Stream-specific notes: business owner ctx (owner_type:'business' + owner_id); identity theme = business violet. PUT /event-types/:id/assignees REPLACES the whole assignee set — validate membership (INVALID_ASSIGNEE); round-robin uses weight/priority. G3 team-availability is business-only (handle BUSINESS_ONLY). G4 SCOPE CORRECTION: /availability is hard-scoped to req.user.id with no member param, so an owner CANNOT edit another member's hours — build G4 as a SELF-SERVICE "My Working Hours" surface (each member edits their own); from G3, tapping another member deep-links them to set their own hours (or shows read-only). Do NOT ship an owner-edits-other-member editor. G1/G2/G4 are sheets (present locally); the assignment_mode field itself is set on the event type in I2's editor.
I will now paste the designs for G1–G5. Build, wire, verify, screenshot, PR.
```

## I14 — Payments & payouts   `[business/payments]`  *(EXCLUSIVE owner of Wallet additions; behind paid flag)*

```
[SHARED PREAMBLE above]

=== YOUR STREAM: I14 — Payments & payouts. Branch: claude/calendarly-ios-i14-payments ===
Build G6 Payments Setup/Stripe Connect & Tax, G7 Payouts & Earnings, G14 Cancellation & Refund Policy.
Authoritative spec: §"Stream I14 — Payments & payouts" in 20-ios-workstreams.md.
Stream-specific notes: the ENTIRE stream is gated by SchedulingFeatureFlags.paidEnabled — when off, show a disabled/coming-soon state. Stripe TEST mode only. You are the EXCLUSIVE owner of the Wallet additions under Features/Wallet/Scheduling/** (no other stream touches Features/Wallet/*). G6 GET /payments/status (applicable:false for homes). G7 payouts render settlement as PROCESSING/PENDING (deferred server-side); reuse existing Wallet/earnings data where present. G14 reuses the Foundation CancellationPolicySheet and round-trips cancellation_policy / cancellation_window_min / reschedule_cutoff_min / refund_policy (full|partial|none|deposit_only) / no_show_fee_cents via PUT /booking-page + PUT /event-types/:id.
I will now paste the designs for G6, G7, G14. Build, wire, verify, screenshot, PR.
```

## I15 — Packages & invoices   `[business/payments]`  *(behind paid flag)*

```
[SHARED PREAMBLE above]

=== YOUR STREAM: I15 — Packages & invoices. Branch: claude/calendarly-ios-i15-packages-invoices ===
Build G8 Packages List (owner), G9 Create/Edit Package, G10 Buy Package (customer), G11 My Packages/Credits, G12 Invoices List, G13 Invoice Detail.
Authoritative spec: §"Stream I15 — Packages & invoices" in 20-ios-workstreams.md.
Stream-specific notes: all priced behavior behind SchedulingFeatureFlags.paidEnabled + Stripe TEST. Packages soft-delete (is_active=false). POST /packages/:id/buy returns credit + optional clientSecret. GET /my-packages shows remaining_sessions per credit; "use credit" calls POST /bookings/:id/apply-credit (guards ALREADY_APPLIED/CREDIT_NOT_APPLICABLE). Invoices are business-only (empty otherwise); POST /invoices/:id/send. Flag-off → packages/invoices hidden or coming-soon.
I will now paste the designs for G8–G13. Build, wire, verify, screenshot, PR.
```

## I16 — Reminders / workflows / templates   `[automations]`

```
[SHARED PREAMBLE above]

=== YOUR STREAM: I16 — Reminders / workflows / templates. Branch: claude/calendarly-ios-i16-automations ===
Build H1 Default Reminders Quick-Setup, H2 Workflows List, H3 Workflow Editor, H4 Trigger Picker, H5 Message Template Editor, H6 Variable Picker, H7 Message Preview, H8 Message Template Library.
Authoritative spec: §"Stream I16 — Reminders / workflows / templates" in 20-ios-workstreams.md.
Stream-specific notes: H1 writes reminder_minutes[] via PUT /booking-page. Workflows CRUD: trigger ∈ booking_created|cancelled|rescheduled|before_start|after_end, action ∈ email|push|in_app|sms, offset_minutes for before/after. Templates require a subject for the email channel; POST /message-templates/preview interpolates {{variable}}. H4 trigger picker + H6 variable picker are local sheets feeding H3/H5 (no stubs).
I will now paste the designs for H1–H8. Build, wire, verify, screenshot, PR.
```

## I17 — Insights & reports   `[insights]`

```
[SHARED PREAMBLE above]

=== YOUR STREAM: I17 — Insights & reports. Branch: claude/calendarly-ios-i17-insights ===
Build H9 Insights Dashboard, H10 Per-Event-Type Performance, H11 No-Show & Cancellation Report, H12 Team Performance, H13 Insights Period & Filter Sheet.
Authoritative spec: §"Stream I17 — Insights & reports" in 20-ios-workstreams.md.
Stream-specific notes: read-only surfaces (no mutations) — empty/zero-data states prominent. H9 GET /bookings/summary; H11 GET /bookings/insights/no-shows?days; H12 GET /bookings/insights/team?days is business-only (handle BUSINESS_ONLY); H10 derives from GET /bookings?event_type_id aggregates + summary. H13 is a local filter sheet driving days (≤365) + date range. No hardcoded chart colors — theme tokens only.
I will now paste the designs for H9–H13. Build, wire, verify, screenshot, PR.
```

## I18 — Cross-cutting & polish   `[polish]`  *(schedule LAST; own-files only)*

```
[SHARED PREAMBLE above]

=== YOUR STREAM: I18 — Cross-cutting & polish. Branch: claude/calendarly-ios-i18-polish ===
Build H15 Notification/Reminder Permission & Channel Connect Prompt, and H14 Accessibility & Large-Text pass.
Authoritative spec: §"Stream I18 — Cross-cutting & polish" in 20-ios-workstreams.md.
Stream-specific notes: run this LAST so the a11y audit reflects the merged Scheduling surface. H15 handles OS permission states (granted/denied/undetermined) + channel connect via GET/PUT /notification-preferences + the 501 connected-calendars "coming soon". H14 is scoped to its OWN files only — add A11y helper modifiers + an audit checklist under Features/Scheduling/Polish/A11y* and verify Dynamic-Type reflow / VoiceOver labels / contrast / accessibilityIdentifier strings. If H14 finds gaps inside ANOTHER stream's files, FILE them as follow-up issues — do NOT edit other streams' files (preserve disjointness).
I will now paste the designs for H15 (and the H14 audit checklist context). Build, wire, verify, screenshot, PR.
```
