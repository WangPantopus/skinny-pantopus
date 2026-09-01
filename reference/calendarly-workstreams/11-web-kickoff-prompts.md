# Calendarly Web — Kickoff Prompts (one per work-stream)

> **How to kick off a stream:** open a fresh agent session and paste **(1) the SHARED PREAMBLE** (below, identical for every stream) **+ (2) that stream's BLOCK** + **(3) the screen designs** for exactly the screen IDs that stream owns (from `~/Downloads/calendarly-design-prompt-suite.md`). The agent reads its full spec from `reference/calendarly-workstreams/10-web-workstreams.md` and builds only that stream.
>
> **Order:** `W0` (Foundation) → merge → then `W1…W18` in **any order, fully parallel** (W18's a11y sweep last). Every feature stream depends solely on W0 and is file-disjoint.
>
> **Scope:** Web only (`frontend/apps/web`). Backend feature-complete on `feature/calendarly` (migrations 159–165). 93 web-buildable screens across W1–W18 (incl. C9 Embed, web-only).

---

## SHARED PREAMBLE  *(paste at the top of EVERY stream prompt below)*

```
You are an autonomous senior frontend engineer (Next.js App Router, TypeScript) building ONE work-stream of the Pantopus "Calendarly" scheduling feature for the WEB app (frontend/apps/web). The backend is feature-complete on branch `feature/calendarly` (migrations 159–165). Build this stream's screens pixel-faithfully to the designs I paste in this session and wire them to the live backend. Work autonomously through all screens in this stream; do not stop for check-ins.

READ FIRST (authoritative specs already in the repo):
• reference/calendarly-workstreams/10-web-workstreams.md → YOUR stream's section, plus §3 (conflict-safety), §4 (RULES + GLOBAL WIRING CONTRACT), §5 (Foundation W0 — what you consume read-only), §6 (your stream), §7 (coverage). Your stream's section is your contract — owns/forbidden files, endpoints, and required states are all there.
• reference/calendarly-backend-api.md → exact request/response for every endpoint you call.

NON-NEGOTIABLE RULES (violating these breaks other parallel streams):
1. Create/edit ONLY the files YOUR stream OWNS (listed in your section). Everything shared is built by W0 Foundation and is FROZEN — consume it read-only (import only): frontend/packages/types/src/scheduling.ts (+ types index barrel), frontend/packages/api/src/endpoints/scheduling.ts + publicBooking.ts (+ api index barrel), frontend/packages/utils/src/index.ts builders, frontend/apps/web/src/lib/publicShare.ts, frontend/apps/web/src/lib/featureFlags.ts, frontend/apps/web/src/components/scheduling/** (the shared kit), and src/app/(app)/app/scheduling/layout.tsx + the book/ & booking/ public layouts. If anything shared is missing or wrong, STOP and flag it as a W0 Foundation gap — do NOT add it locally.
2. Web routing is FILE-BASED — you register a route by creating its folder/page.tsx (there is NO shared router file to edit). Create ONLY the route folders your section lists. Present sheets/modals/state panels LOCALLY (React state + a local <Modal>/<BottomSheet>) — never carve a global route for a sheet. Do NOT edit the shared scheduling layout.tsx or any other stream's folder.
3. Reuse the W0 shared components (SlotPicker, SlotConflictAlternatives, TimezoneSelector, BookingStatusPill, the states/* views PausedView/SecretView/ExpiredView/UnavailableView/NoAvailabilityView, AddToCalendar, ShareLink, CancellationPolicy, SchedulingOwnerProvider/useSchedulingOwner, decodeError, PillarThemeProvider) and existing app shells (AppShell, PageHeader, ui/*). Theme tokens only (app-personal/home/business + -bg, app-surface, app-text, …) — no hardcoded colors/spacing.
4. Honor the wiring contract: owner-context via SchedulingOwner (Personal = omit owner fields / Business = owner_type:'business' + owner_id / Home = use the /api/homes/:homeId/scheduling/* alias); ALWAYS send tz (IANA) on slot/calendar reads, render startLocal, store/compare UTC; PERSIST the one-time manageToken (W0 helper, keyed by page slug); handle 409 {error, alternatives:[{start,end,startLocal}]} on every create/reschedule via SlotConflictAlternatives (surface nearest times — never a dead end); home bookings render via the calendar UNION (rows tagged source:'booking') — NEVER create HomeCalendarEvent rows for bookings; paused/secret/unavailable/expired are first-class response states (render the W0 state views), not errors; paid surfaces stay behind webFeatureFlags.schedulingPaid + Stripe TEST mode (reuse components/payments/StripeProvider; payout settlement deferred → show processing/pending); POST /connected-calendars/connect returns 501 → show "coming soon". Public reads hit the backend origin directly (fetchPublicBooking server-side for SEO + generateMetadata; slots fetched client-side, no-store).
5. Web specifics: public routes live OUTSIDE the (app) auth group — src/app/book/*, src/app/booking/*, src/app/poll/* — mirroring src/app/support-trains/*. Host management lives under src/app/(app)/app/scheduling/*. Use server components for SEO + generateMetadata on public landing pages; client components for interactive slot pickers/forms.

WORKFLOW & ACCEPTANCE: branch `claude/calendarly-web-<id>-<slug>`; one PR to master (never push master). Build green via `pnpm --filter @pantopus/web build` + `pnpm --filter @pantopus/web typecheck` (you should NOT need to build types/api/utils — those are W0; if you do, you touched a shared seam, which is forbidden). Verify EACH screen in the browser/preview signed into a hosted-dev test account against the LIVE endpoint (migrations 159–165 applied) — keep your test bookings/pages. Screenshot each built screen vs the pasted design. Targeted tests ONLY for this stream's logic (form validation, param builders, state machines) — never run full suites. Every fetchable surface ships loading skeleton / empty / loaded / error+Retry. Run lint + format before the PR.

DEPENDS ON: Web Foundation (W0) already merged to master.
```

---

# FOUNDATION (build + merge FIRST)

## W0 — Foundation: contract layer + shared components + route skeletons

```
[SHARED PREAMBLE above]

=== YOUR STREAM: W0 — Foundation (serial gate). Branch: claude/calendarly-web-w0-foundation ===
The SINGLE gate. No screens of its own — it builds the shared parts every feature stream imports. Build exactly §5 of 10-web-workstreams.md:
CONTRACT (packages):
• frontend/packages/types/src/scheduling.ts (NEW, mirror home.ts) — all scheduling types (BookingPage, EventType+pricing/location/questions/assignment, AvailabilitySchedule+rules/overrides/limits/blocks, Booking+status/source/invitee, BookingSlot {start,end,startLocal}, SlotConflict {error,alternatives}, OneOffLink, PublicBookingPage/PublicEventType, Workflow, MessageTemplate, Package/MyPackageCredit, Invoice, PaymentsStatus, ConnectedCalendar, Resource/ResourceBooking, Visit, FindATime, WhosFree, Poll/PollOption/PollVote, TeamAvailability, WaitlistEntry, NoShowInsights/TeamInsights, HomeCalendarUnionEvent). + append export block to packages/types/src/index.ts.
• frontend/packages/api/src/endpoints/scheduling.ts (NEW) — host fns wrapping get/post/put/del; EACH takes owner?: SchedulingOwnerRef and routes home→/api/homes/:homeId/scheduling, business→owner_type/owner_id, personal→none. Cover the full route list in §5.
• frontend/packages/api/src/endpoints/publicBooking.ts (NEW) — unauthed /api/public/* fns (getPublicPage, getPublicSlots, createPublicBooking→{booking,manageToken,clientSecret?}, getOneOff, createOneOffBooking, getBookingByToken, getManageSlots, getIcs, reschedule/cancel/unsubscribe/accept/declineByToken, joinWaitlistPublic, getPoll/votePoll); all 409s → typed SlotConflict. + append both namespaces to packages/api/src/index.ts.
• frontend/packages/utils/src/index.ts (append) — buildBookingPagePath/Url, buildBookingEventPath, buildOneOffBookingPath, buildBookingManagePath/Url, buildBookingPageAppUrl, buildBookingManageAppUrl (mirror buildSupportTrain*).
WEB LIB:
• frontend/apps/web/src/lib/publicShare.ts (append) — fetchPublicBooking(slug,tz?) [cache() + fetchPublicJson('/api/public/book/'+slug), revalidate:60 for the shell; slots fetched client-side no-store], fetchPublicOneOff, fetchPublicBookingByToken, fetchPublicPoll.
• frontend/apps/web/src/lib/featureFlags.ts (append) — schedulingPaid flag (default ON non-prod / OFF prod).
SHARED COMPONENTS frontend/apps/web/src/components/scheduling/** — SchedulingOwnerProvider + useSchedulingOwner, SlotPicker, SlotConflictAlternatives (409 presenter), TimezoneSelector, BookingStatusPill, states/{Paused,Secret,Expired,Unavailable,NoAvailability}View, AddToCalendar (.ics), ShareLink, CancellationPolicy, PillarThemeProvider/pillarTokens, decodeError, + index.ts barrel.
ROUTE SKELETONS: src/app/(app)/app/scheduling/layout.tsx (host shell + left-nav links pre-included for ALL feature areas per §5 so each is reachable once it merges), src/app/book/layout.tsx + src/app/booking/layout.tsx (minimal public layouts, no app chrome).
MUST NOT touch: nothing else — W0 is the only stream that edits these shared files; do not build any feature screen.
DESIGNS I WILL PASTE: SlotPicker, the status pills, the first-class state views (paused/secret/expired/unavailable/no-availability), and the shared sheets (ShareLink C3, AddToCalendar D8, CancellationPolicy G14, TimezoneSelector C7, the 409 Slot-Taken presenter). Build those here; feature streams only consume them.
ACCEPTANCE: pnpm --filter @pantopus/types build && --filter @pantopus/api build && --filter @pantopus/utils build green; pnpm --filter @pantopus/web typecheck green; a throwaway smoke page imports the scheduling/publicBooking namespaces and renders SlotPicker against a hosted-dev page showing real slots in local tz; unit tests for the SchedulingOwner param-builder (all 3 pillars) + decodeError; lint/format pass. Merge BEFORE any feature stream.
```

---

# FEATURE STREAMS  *(all depend on W0 merged; then fully parallel, any order)*

```
=== W1 — Setup & Hub. Branch: claude/calendarly-web-w1-setup-hub ===
Build A1 Scheduling Hub, A2 First-Run Wizard / Set Up Booking Link, A3 Settings Root, A4 Notifications Prefs, A5 Summary Card, A6 Onboarding Home & Business. Spec: §Stream W1.
Owns: src/app/(app)/app/scheduling/page.tsx (A1 Hub — the section index W0 left for you), /setup/page.tsx (A2) + /setup/onboarding/page.tsx (A6), /settings/page.tsx (A3) + /settings/notifications/page.tsx (A4), src/components/scheduling/hub/**.
Notes: A5 Summary Card is a reusable component (other streams import it read-only). Wizard does a debounced slug check via /booking-page/check-slug (taken/available + suggestions). Empty hub when no page yet → CTA to wizard. Notification prefs is a flexible object — round-trip unknown keys. Theme by active pillar via PillarThemeProvider. All host calls go through SchedulingOwner.
I will now paste the designs for A1–A6.

=== W2 — Event Types. Branch: claude/calendarly-web-w2-event-types ===
Build B1 List, B2 Editor, B3 Intake Questions, B8 Connected Calendars (→501). Spec: §Stream W2.
Owns: scheduling/event-types/page.tsx (B1), /event-types/[id]/page.tsx (B2; new via [id]==='new'), /event-types/[id]/questions/page.tsx (B3 or a local tab), /connected-calendars/page.tsx (B8), components/scheduling/event-types/**.
Notes: PUT = partial update (don't clobber omitted fields). Priced fields (price/deposit/refund_policy) hidden unless webFeatureFlags.schedulingPaid. DELETE → 409 HAS_UPCOMING_BOOKINGS → offer deactivate (is_active=false). 400 validation details → field errors. B8 read empty + connect→501 "coming soon". Assignees config is NOT here (W13) — link out.
I will now paste the designs for B1, B2, B3, B8.

=== W3 — Availability. Branch: claude/calendarly-web-w3-availability ===
Build B4 Schedule List, B5 Weekly Hours, B6 Date Overrides, B7 Booking Limits/Notice, B9 Block off time. Spec: §Stream W3.
Owns: scheduling/availability/page.tsx (B4), /availability/[id]/page.tsx (B5 + tabs for B6/B7), /availability/blocks/page.tsx (B9), components/scheduling/availability/**.
Notes: tz-aware hours (render in schedule tz, store per backend contract). PUT partial-update for rules/overrides (whole-set per the API). Block create/delete optimistic-then-refetch. Empty (no schedule) → CTA create. B7 limits persist on the EVENT TYPE — keep B7 a thin surface; defer type-level fields to W2's editor.
I will now paste the designs for B4, B5, B6, B7, B9.

=== W4 — Booking page, sharing & embed. Branch: claude/calendarly-web-w4-booking-page-embed ===
Build C1 Page Management, C2 Public Preview, C3 Share Sheet, C4 One-off Link Generator, H16 Empty/Zero-State, and C9 EMBED WIDGET (web-only). Spec: §Stream W4.
Owns: scheduling/booking-page/page.tsx (C1 + H16), /booking-page/preview/page.tsx (C2), /booking-page/one-off/page.tsx (C4), /booking-page/embed/page.tsx (C9 config + snippet), src/app/book/[slug]/embed/page.tsx (the iframe target) + src/app/book/[slug]/embed/layout.tsx (BARE layout — no chrome), components/scheduling/booking-page/**.
Notes: C3 reuses the W0 ShareLink (present locally). reset-slug danger confirm. C4 one-off returns token+path+expires_at (+offered_slots/single-use) — display+copy. C2 fetches public GET /api/public/book/:slug and renders status:'paused' honestly. C9 builds an <iframe>/<script> snippet pointing at /book/[slug]/embed; the embed route ships its OWN bare layout.tsx so it inherits zero app chrome. MUST NOT touch the public booking flow folders (book/[slug]/page.tsx, [eventType], book/o/[token]) — those are W5/W6/W7; you own only the embed subroute.
I will now paste the designs for C1, C2, C3, C4, H16, C9.

=== W5 — Invitee discovery (public). Branch: claude/calendarly-web-w5-invitee-discovery ===
Build C5 Landing/Booker Profile, C6 Slot Picker, C7 Timezone Selector, C8 No-Availability. Spec: §Stream W5.
Owns: src/app/book/[slug]/page.tsx (C5 — server component + generateMetadata, mirror support-trains/[id]/page.tsx), src/app/book/[slug]/[eventType]/page.tsx (C6), components/scheduling/public/discovery/**.
Notes: public, no auth. Page shell via fetchPublicBooking (server, SEO); slots client-side, no-store. tz default from browser + user-overridable (C7 wraps W0 TimezoneSelector) threaded into slot reads; render startLocal. paused/secret/expired/unavailable page states via W0 views; C8 no-availability with "try a wider range". STOP at slot selection → hand to W6 via the [eventType]/confirm route. MUST NOT touch [eventType]/confirm (W6), book/o/[token] (W7), book/[slug]/embed (W4), or publicShare.ts.
I will now paste the designs for C5, C6, C7, C8.

=== W6 — Invitee confirm & manage (public). Branch: claude/calendarly-web-w6-invitee-confirm-manage ===
Build D1 Intake Form, D2 Review/Checkout, D3 Confirmed/Thank-You, D4 Manage Your Booking. Spec: §Stream W6.
Owns: src/app/book/[slug]/[eventType]/confirm/** (D1+D2 — you own confirm/ ONLY; W5 owns [eventType]/page.tsx), src/app/booking/[token]/page.tsx (D4) + src/app/booking/[token]/confirmed/page.tsx (D3), components/scheduling/public/confirm/**.
Notes: build D1 dynamically from eventType.questions. On create PERSIST manageToken (W0 helper, keyed by page slug) → route to D3. 409 on create → SlotConflictAlternatives (re-pick). 400 details → field errors. Paid path: clientSecret + StripeProvider (read-only) behind schedulingPaid (TEST); show processing if payout deferred. D3 offers AddToCalendar + manage link. D4 shows status pill + policy + reschedule/cancel ENTRY points (actual cutoff logic is D10/W7 — link to it). MUST NOT touch W5's [eventType]/page.tsx or book/[slug]/page.tsx, W7's routes, or StripeProvider.tsx.
I will now paste the designs for D1, D2, D3, D4.

=== W7 — Invitee edge & customer. Branch: claude/calendarly-web-w7-invitee-edge-customer ===
Build D5 Slot Taken, D6 Payment Failed/Retry, D7 Unavailable/Expired/Paused/Secret, D8 Add to Calendar, D9 Open-in-App/Deep-Link, D10 Reschedule/Cancel Cutoff & Policy-Blocked, D11 My Bookings, D12 Recurring. Spec: §Stream W7.
Owns: src/app/book/o/[token]/page.tsx (one-off landing → W0 SlotPicker; D5/D7 surface here), src/app/booking/[token]/reschedule/page.tsx + /cancel/page.tsx (D10), src/app/booking/[token]/states/page.tsx (D5/D7 presenter), src/app/(app)/app/scheduling/my-bookings/page.tsx (D11) + /my-bookings/recurring/page.tsx (D12), components/scheduling/public/edge/**.
Notes: D5 surfaces 409 alternatives; D7 renders the 4 first-class states (W0 views); D10 enforces cutoff/policy-blocked (disable past cutoff, show policy via CancellationPolicy); D6 retries the Stripe PaymentIntent (TEST) under schedulingPaid; D9 web = OpenInApp button + store fallback (NO native interstitial); D11/D12 authed via SchedulingOwner (personal customer). Reuse the persisted manageToken for token-scoped routes. MUST NOT touch W6's booking/[token]/page.tsx + /confirmed or [eventType]/confirm/*, W5's discovery routes.
I will now paste the designs for D5–D12.

=== W8 — Bookings inbox & core. Branch: claude/calendarly-web-w8-bookings-inbox ===
Build E1 Inbox, E2 Detail, E3 Approve/Decline, E4 Reschedule/Reassign, E5 Cancel & Refund. Spec: §Stream W8.
Owns: scheduling/bookings/page.tsx (E1), /bookings/[id]/page.tsx (E2; E3/E4/E5 are LOCAL sheets opened from here), components/scheduling/bookings/**.
Notes: sheets are LOCAL (no global routes). Inbox tabs map to status filter; search q. E4 reuses SlotPicker, honors tz, 409 → SlotConflictAlternatives; reassign home/business only (INVALID_HOST). E5 refund visible only with schedulingPaid (else cancel-only); surfaces refund_issued + reason. Optimistic status update then refetch; PAST_DEADLINE/ALREADY_* guards. MUST NOT touch W9's bookings-extras files (W9 keeps its own components; your detail page LINKS to W9 routes, never co-edits).
I will now paste the designs for E1–E5.

=== W9 — Bookings extras. Branch: claude/calendarly-web-w9-bookings-extras ===
Build E6 No-Show, E7 Follow-up, E8 Group Roster & Seats, E9 Search & Filter, E10 Double-Book Warning, E11 Nudge, E12 Manual/On-Behalf Booking, E13 Waitlist. Spec: §Stream W9.
Owns: scheduling/bookings/search/page.tsx (E9), /bookings/manual/page.tsx (E12; 409→E10 inline), /bookings/[id]/roster/page.tsx (E8), scheduling/waitlist/page.tsx (E13), components/scheduling/bookings-extras/** (NoShowSheet, FollowUpSheet, RosterSeats, BookingSearchFilter, DoubleBookWarning, NudgeSheet, ManualBooking, WaitlistManager).
Notes: keep E6/E7/E10/E11 as components in YOUR folder (W8's detail page links to your routes — do NOT co-edit W8's bookings/page.tsx, bookings/[id]/page.tsx, or components/scheduling/bookings/**). E6 no-show only after event end (NOT_APPLICABLE_YET). E12 manual create → 409 = E10 double-book warning inline. Waitlist promote confirms. Search/filter debounced query params.
I will now paste the designs for E6–E13.

=== W10 — Home calendar & RSVP. Branch: claude/calendarly-web-w10-home-calendar-rsvp === (EXCLUSIVE owner of homes/[id]/calendar/page.tsx)
Build F1 Home Calendar/Agenda, F2 Event Detail + RSVP, F3 Add/Edit Event, F8 Household Availability, F15 Permission-Gated Scheduler. Spec: §Stream W10.
Owns: src/app/(app)/app/homes/[id]/calendar/page.tsx (EXCLUSIVE edit of the existing file — sole owner), homes/[id]/scheduling/page.tsx (F15) + /scheduling/availability/page.tsx (F8) + /scheduling/events/new/page.tsx (F3) + /scheduling/events/[eventId]/page.tsx (F2), src/components/scheduling/home/* (TOP-LEVEL files ONLY — non-recursive).
Notes: render the booking UNION (GET /api/homes/:id/events, rows tagged source:'booking') alongside today's tasks/bills/events. Booking rows are READ-ONLY → tap deep-links to the scheduling booking detail; NEVER create event rows for bookings. RSVP optimistic upsert. F8 uses the home alias /api/homes/:homeId/scheduling/availability*. F15 gates the scheduler by household permission (hide/disable if not allowed). Green pillar. ⚠️ Do NOT create anything under components/scheduling/home/find-a-time/** (W11) or home/resources/** (W12) — keep your files flat in home/. Do NOT touch W11/W12 home route subfolders.
I will now paste the designs for F1, F2, F3, F8, F15.

=== W11 — Find-a-time & who's-free. Branch: claude/calendarly-web-w11-find-a-time-whos-free ===
Build F4 Find a Time — Setup, F5 Suggested Slots, F6 Member Poll Response, F7 Who's Free. Spec: §Stream W11.
Owns: homes/[id]/scheduling/find-a-time/page.tsx (F4→F5), homes/[id]/scheduling/whos-free/page.tsx (F7), src/app/poll/[id]/page.tsx (F6 — PUBLIC route, mirror support-trains), src/components/scheduling/home/find-a-time/**.
Notes: home alias for find-a-time/whos-free; pass tz, render startLocal; reuse SlotPicker for F5. F7 = per-member free grid (members + freeByMember). F6 poll: create→vote→finalize; public response via fetchPublicPoll + votePoll; handle expired/closed poll. Green pillar. Only add find-a-time + whos-free subfolders — do NOT touch W10's calendar/page.tsx or scheduling/page.tsx, or W12's resources.
I will now paste the designs for F4, F5, F6, F7.

=== W12 — Home resources & visits. Branch: claude/calendarly-web-w12-home-resources-visits ===
Build F9 Resources List, F10 Resource Editor, F11 Resource Detail/Calendar, F12 Book a Resource, F13 Schedule a Visit, F14 Visit Detail. Spec: §Stream W12.
Owns: homes/[id]/scheduling/resources/page.tsx (F9) + /resources/[rid]/page.tsx (F11) + /resources/[rid]/edit/page.tsx (F10) + /resources/[rid]/book/page.tsx (F12), homes/[id]/scheduling/visits/new/page.tsx (F13) + /visits/[id]/page.tsx (F14), src/components/scheduling/home/resources/**.
Notes: home alias for all. Resource book honors capacity/availability; 409 → SlotConflictAlternatives. F11 reads the home events UNION (never creates booking rows). Visit create → detail; tz; green pillar. Only add resources + visits subfolders — do NOT touch W10/W11 home subfolders (calendar, scheduling/page.tsx, find-a-time, whos-free).
I will now paste the designs for F9–F14.

=== W13 — Business config & team. Branch: claude/calendarly-web-w13-business-config-team ===
Build G1 Round-Robin, G2 Collective Setup, G3 Team Availability, G4 Member Working-Hours, G5 Business Settings. Spec: §Stream W13.
Owns: scheduling/business/page.tsx (G5), /business/team-availability/page.tsx (G3), /business/members/[memberId]/hours/page.tsx (G4), src/components/scheduling/business/** (RoundRobinSheet G1, CollectiveSetup G2, TeamAvailabilityGrid G3, MemberHoursEditor G4, BusinessSettings G5).
Notes: ALL calls with owner_type:'business' + owner_id via SchedulingOwner (business mode); resolve the active business context; violet pillar. /assignees REPLACES the whole set (INVALID_ASSIGNEE; weight/priority for round-robin). G3 team-availability business-only (BUSINESS_ONLY). Ship G1/G2 as COMPONENTS in your folder (W2's editor links to them) — do NOT co-edit W2's event-types pages, W3 availability, or W14 payments.
I will now paste the designs for G1–G5.

=== W14 — Payments & payouts. Branch: claude/calendarly-web-w14-payments-payouts === (EXCLUSIVE owner of settings/payments + wallet edits; behind paid flag)
Build G6 Stripe Connect & Tax, G7 Payouts & Earnings, G14 Cancellation & Refund Policy. Spec: §Stream W14.
Owns: src/app/(app)/app/settings/payments/page.tsx (EXCLUSIVE edit — add a Scheduling earnings/payouts tab), src/app/(app)/app/wallet/page.tsx (EXCLUSIVE edit — surface scheduling earnings), scheduling/payments/page.tsx (G6+G7), scheduling/payments/policy/page.tsx (G14), src/components/scheduling/payments/**.
Notes: ENTIRE stream behind webFeatureFlags.schedulingPaid (hidden if off); Stripe TEST mode. Reuse components/payments/StripeProvider + StripeConnectOnboarding + PaymentStatusBadge READ-ONLY (do NOT edit them). G6 GET /payments/status. G7 payouts show PROCESSING/PENDING (settlement deferred). G14 writes cancellation_policy via PUT /booking-page (reuse W0 CancellationPolicy). You are the ONLY stream allowed to edit settings/payments/page.tsx and wallet/page.tsx. Violet pillar.
I will now paste the designs for G6, G7, G14.

=== W15 — Packages & invoices. Branch: claude/calendarly-web-w15-packages-invoices === (behind paid flag)
Build G8 Packages List, G9 Create/Edit Package, G10 Buy Package (customer), G11 My Packages/Credits, G12 Invoices List, G13 Invoice Detail. Spec: §Stream W15.
Owns: scheduling/packages/page.tsx (G8) + /packages/[id]/edit/page.tsx (G9), scheduling/my-packages/page.tsx (G11), scheduling/invoices/page.tsx (G12) + /invoices/[id]/page.tsx (G13), src/app/book/[slug]/packages/[packageId]/page.tsx (G10 buy — public/customer, reuse StripeProvider), src/components/scheduling/packages/**.
Notes: everything behind schedulingPaid + Stripe TEST. Packages soft-delete. buy → PaymentIntent (TEST) → credits granted. my-packages shows remaining credits; credit redemption itself is the booking side (W7/W8) — you only sell/list. Invoices business-only; send → status. Only add book/[slug]/packages/* on the public side — do NOT touch W4/W5/W6/W7 booking routes or W14 payments pages.
I will now paste the designs for G8–G13.

=== W16 — Reminders, workflows & templates. Branch: claude/calendarly-web-w16-reminders-workflows-templates ===
Build H1 Default Reminders Quick-Setup, H2 Workflows List, H3 Workflow Editor, H4 Trigger Picker, H5 Template Editor, H6 Variable Picker, H7 Message Preview, H8 Template Library. Spec: §Stream W16.
Owns: scheduling/reminders/page.tsx (H1), scheduling/workflows/page.tsx (H2) + /workflows/[id]/page.tsx (H3; H4 = local sheet), scheduling/templates/page.tsx (H8) + /templates/[id]/page.tsx (H5; H6+H7 = local panels), src/components/scheduling/automations/**.
Notes: H1 edits reminder_minutes[] via /notification-preferences — H1 is its OWN reminders route; do NOT edit W1's A4 prefs screen. Workflow editor composes trigger→template (trigger/action enums + offset for before/after). H7 preview calls /message-templates/preview with sample vars. Templates need subject for email channel. H4/H6 are local pickers (no global routes).
I will now paste the designs for H1–H8.

=== W17 — Insights & reports. Branch: claude/calendarly-web-w17-insights-reports ===
Build H9 Dashboard, H10 Per-Event-Type Performance, H11 No-Show/Cancellation Report, H12 Team Performance, H13 Period/Filter Sheet. Spec: §Stream W17.
Owns: scheduling/insights/page.tsx (H9; H13 = local sheet), /insights/event-types/page.tsx (H10), /insights/no-shows/page.tsx (H11), /insights/team/page.tsx (H12), src/components/scheduling/insights/**.
Notes: read-only (no mutations); prominent zero-data states. H12 team business-only (BUSINESS_ONLY). H13 local filter sheet drives all reports (tz + date-range + days params). No hardcoded chart colors (tokens). Read via the scheduling namespace — never edit W8/W9 bookings folders or W16 automations.
I will now paste the designs for H9–H13.

=== W18 — Cross-cutting & polish. Branch: claude/calendarly-web-w18-cross-cutting-polish === (run LAST; own-files only)
Build H15 Notification/Reminder Permission & Channel Connect Prompt, H14 Accessibility & Large-Text pass. Spec: §Stream W18.
Owns: scheduling/settings/channels/page.tsx (H15), src/components/scheduling/polish/** (ChannelConnectPrompt + a11y helpers/notes).
Notes: H15 = permission prompt + 501 channel-connect "coming soon". H14 is a cross-cutting a11y AUDIT — run it LAST (after W1–W17 merge); apply fixes only to W0/W18-owned shared components (focus rings, ARIA on SlotPicker/pills/sheets, large-text scaling via tokens, keyboard nav, WCAG AA contrast) and FILE per-stream a11y gaps back to those streams. Do NOT edit another stream's files while its PR is open. Verify via axe/lighthouse on the key public + host screens.
I will now paste the designs for H15 (+ the H14 audit context).
```
