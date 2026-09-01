# Calendarly Android — Kickoff Prompts (one per work-stream)

> **How to kick off a stream:** open a fresh agent session and paste **(1) the SHARED PREAMBLE** (below, identical for every stream) **+ (2) that stream's BLOCK** + **(3) the screen designs** for exactly the screen IDs that stream owns (from `~/Downloads/calendarly-design-prompt-suite.md`). The agent reads its full spec from `reference/calendarly-workstreams/30-android-workstreams.md` and builds only that stream.
>
> **Order:** `A0` (Foundation) → merge → then `A1…A18` in **any order, fully parallel** (A18 a11y sweep last). Every feature stream depends solely on A0 and is file-disjoint.
>
> **Scope:** Android only (`frontend/apps/android`, base package `app.pantopus.android`). Backend feature-complete on `feature/calendarly` (migrations 159–165). 93 Android-buildable screens across A1–A18 (C9 Embed is web-only).

---

## SHARED PREAMBLE  *(paste at the top of EVERY stream prompt below)*

```
You are an autonomous senior Android engineer (Jetpack Compose, Kotlin, Hilt, Retrofit/Moshi) building ONE work-stream of the Pantopus "Calendarly" scheduling feature for the ANDROID app (frontend/apps/android, base package app.pantopus.android). The backend is feature-complete on branch `feature/calendarly` (migrations 159–165). Build this stream's screens pixel-faithfully to the designs I paste in this session and wire them to the live backend. Work autonomously through all screens in this stream; do not stop for check-ins.

READ FIRST (authoritative specs already in the repo):
• reference/calendarly-workstreams/30-android-workstreams.md → YOUR stream's section, plus §3 (conflict-safety), §4 (RULES + GLOBAL WIRING CONTRACT), §5 (Foundation A0 — what you consume read-only), §6 (your stream), §7 (coverage). Your stream's section is your contract — owns/forbidden files, endpoints, and required states are all there.
• reference/calendarly-backend-api.md → exact request/response for every endpoint you call.

NON-NEGOTIABLE RULES (violating these breaks other parallel streams):
1. Create/edit ONLY the files YOUR stream OWNS (listed in your section). Everything shared is built by A0 Foundation and is FROZEN — consume it read-only: ui/screens/root/RootTabScreen.kt (routes + NavHost), di/NetworkModule.kt (DI), ui/screens/you/me/MeViewModel.kt + ui/screens/you/YouScreen.kt (Me tiles + dispatch), data/api/services/SchedulingApi.kt + SchedulingPublicApi.kt, data/api/models/scheduling/**, data/scheduling/** (SchedulingRepository, SchedulingOwner, SchedulingError, SchedulingFeatureFlags), and ui/screens/scheduling/_shared/** (the shared kit). If anything shared is missing or wrong, STOP and flag it as an A0 Foundation gap — do NOT add it locally.
2. Your screen's route + composable(...) block ALREADY EXISTS in RootTabScreen.kt (A0 pre-added it pointing at a stub composable in YOUR folder). You only FILL THE STUB BODY in your own files — never edit RootTabScreen.kt. Present sheets/modals/states LOCALLY (Compose ModalBottomSheet, dialogs, in-screen state) from your own parent screens; never add a global route.
3. Reuse the A0 _shared/ components (SlotPicker, TimezonePicker, ConflictAlternativesSheet, PausedExpiredUnavailableState, SchedulingStateScaffolding, ManageTokenStore, MoneyAndFlag, OwnerPillarChrome) and the shells ui/screens/shared/{list_of_rows,form,wizard,content_detail}/. Theme tokens only (PantopusColors from ui/theme/Color.kt, LocalPantopusTokens from Theme.kt) — no hardcoded colors/spacing. Pillar accents: Personal=primary600, Home=home, Business=business.
4. Honor the wiring contract: owner-context via SchedulingOwner (Personal = omit owner fields / Business = owner_type:'business' + owner_id / Home = use the /api/homes/:homeId/scheduling/* alias); ALWAYS send tz (IANA) on slot/calendar reads, render startLocal, store/compare UTC; PERSIST the one-time manageToken (ManageTokenStore); handle 409 {error, alternatives:[{start,end,startLocal}]} on every create/reschedule via ConflictAlternativesSheet (surface nearest times — never a dead end); home bookings render via the calendar UNION (rows tagged source:'booking') — NEVER create HomeCalendarEvent rows for bookings; paused/secret/unavailable/expired are first-class response states (render PausedExpiredUnavailableState), not errors; paid surfaces stay behind SchedulingFeatureFlags + Stripe TEST mode (payout settlement deferred → show processing/pending); POST /connected-calendars/connect returns 501 → show "coming soon". Public reads/writes hit the backend origin via SchedulingPublicApi (NO auth header — A0 provides an unauthenticated client).
5. Android specifics: call SchedulingRepository (never the Api directly). ViewModels are @HiltViewModel with StateFlow<XUiState> sealed states; read nav args via SavedStateHandle. There is NO per-file manifest (Gradle compiles the whole tree) — adding a screen = adding a new file in your own ui/screens/scheduling/<folder>/.

WORKFLOW & ACCEPTANCE: branch `claude/calendarly-android-<id>-<slug>`; one PR to master (never push master). Build green: run `./gradlew ktlintFormat --rerun-tasks` first (repo CI quirk), then `./gradlew ktlintCheck detekt :app:assembleDebug` (detekt baseline at app/detekt-baseline.xml). Targeted tests ONLY: `./gradlew :app:testDebugUnitTest --tests "app.pantopus.android.ui.screens.scheduling.<your-folder>.*"` — never full suites. Paparazzi snapshots for new screens (`./gradlew :app:paparazziVerify`; record if needed). Verify EACH screen on an emulator signed into a hosted-dev test account against the LIVE endpoint (migrations 159–165 applied) — keep your test bookings/pages. Screenshot each built screen vs the pasted design. Every fetchable surface ships loading / empty / loaded / error states via SchedulingStateScaffolding.

DEPENDS ON: Android Foundation (A0) already merged to master.
```

---

# FOUNDATION (build + merge FIRST)

## A0 — Foundation: contract + DI + NavHost stubs + Me seam + shared kit

```
[SHARED PREAMBLE above]

=== YOUR STREAM: A0 — Foundation (serial gate). Branch: claude/calendarly-android-A0-foundation ===
The SINGLE gate. Build NO finished feature screen — only the shared scaffold + stubs every feature stream compiles against. Build exactly §5 of 30-android-workstreams.md. (You MAY split into two PRs: A0a = contract+DI+flag+_shared; A0b = NavHost route stubs + Me tiles + dispatch — both must land before feature streams.)
CONTRACT (create): data/api/services/SchedulingApi.kt (host Retrofit — ALL /api/scheduling/* + /api/homes/{homeId}/scheduling/* routes per §5.1), data/api/services/SchedulingPublicApi.kt (public /api/public/* — NO auth), data/api/models/scheduling/*Dtos.kt (every DTO; @JsonClass(generateAdapter=true) + @Json snake_case; incl. SchedulingErrorDtos for {error,message}/validation details/409 alternatives), data/scheduling/SchedulingRepository.kt (wraps both Apis in safeApiCall → NetworkResult<T>; ALL streams call this, never the Api), data/scheduling/SchedulingOwner.kt (sealed Personal/Business(id)/Home(homeId) → query params / body fields / host-vs-home-alias path), data/scheduling/SchedulingError.kt (typed decoder: Validation/Conflict(code,alternatives)/Paused/Expired/Unavailable/SlugTaken/NotAvailable501/Generic), data/scheduling/SchedulingFeatureFlags.kt (paid flag; OFF prod, ON hosted-dev).
DI (edit): di/NetworkModule.kt — provideSchedulingApi (authed Retrofit). For SchedulingPublicApi you MUST add a dedicated @Named("publicScheduling") OkHttpClient + Retrofit that OMITS AuthInterceptor (keep logging/retry/Sentry) — the sole existing client always attaches AuthInterceptor, which would send a stale/absent token on the signed-out invitee flow. Public calls carry NO Authorization header.
ROUTING (edit): ui/screens/root/RootTabScreen.kt — add EVERY scheduling route const + NavHost composable(...) block from the EXHAUSTIVE manifest in §5.1 (≈65 net-new routes; the 3 existing home routes stay as-is). Each composable calls a stub screen composable by name in the owning stream's folder; A0 declares thin placeholder bodies. THIS MANIFEST IS THE CONTRACT — every route a feature stream lists under "Fills A0 stubs" must appear verbatim. This is A0's last edit to RootTabScreen.kt.
ME SEAM (edit): MeViewModel.kt (MeActionTile/MeSectionRow routeKeys: me.scheduling.hub personal, me.business.scheduling, me.home.scheduling) + YouScreen.kt (when(tile.routeKey) dispatch + onOpenScheduling* lambdas threaded from RootTabScreen).
SHARED KIT (create under ui/screens/scheduling/_shared/): OwnerPillarChrome, SlotPicker, TimezonePicker, ConflictAlternativesSheet (409 alternatives ModalBottomSheet), PausedExpiredUnavailableState, SchedulingStateScaffolding (aligned to ListOfRowsUiState), ManageTokenStore (DataStore, keyed by booking), MoneyAndFlag (price formatting + paid-flag gate).
TESTS (create): SchedulingOwnerTest, SchedulingErrorDecoderTest (409/validation/paused decode), SchedulingRepositoryTest (owner-context param injection per pillar).
DESIGNS I WILL PASTE: SlotPicker, TimezonePicker, the 409 ConflictAlternativesSheet, and the paused/expired/unavailable/secret state surface. Build those here; feature streams only consume them.
ACCEPTANCE: ./gradlew ktlintFormat --rerun-tasks then ktlintCheck detekt test :app:assembleDebug green; new unit tests pass; app launches on emulator (hosted-dev) and EVERY scheduling route resolves to its stub without crash; Me tiles navigate to stubs; SchedulingRepository verified against the live endpoint for one read per pillar (Personal GET /booking-page, Home alias, Business owner_type=business). Merge BEFORE any feature stream.
```

---

# FEATURE STREAMS  *(all depend on A0 merged; then fully parallel, any order)*

```
=== A1 — Setup & Hub. Branch: claude/calendarly-android-a1-setup-hub ===
Build A1 Scheduling Hub, A2 First-Run Wizard / Set Up Booking Link, A3 Settings Root, A4 Notifications Prefs, A5 Summary Card, A6 Onboarding Home & Business. Spec: §Stream A1.
Owns: ui/screens/scheduling/hub/** (SchedulingHubScreen+VM, SummaryCard), /setup/** (FirstRunWizardScreen+VM via WizardShell+WizardIdentity, OnboardingHomeBusinessScreen+VM), /settings/** (SchedulingSettingsRootScreen+VM, NotificationPrefsScreen+VM). Fills A0 stubs SCHEDULING_HUB, SCHEDULING_SETUP_WIZARD, SCHEDULING_SETTINGS, SCHEDULING_NOTIFICATIONS, SCHEDULING_ONBOARDING.
Notes: A5 Summary Card is a reusable composable (embedded in the hub). Wizard does a live slug check via /booking-page/check-slug (available/taken + suggestions). reset-slug = danger-zone confirm (invalidates old link). Notification prefs is a flexible object — round-trip unknown keys. Empty hub (no page yet) → wizard CTA. Pillar accenting per SchedulingOwner. No 409/manageToken here.
I will now paste the designs for A1–A6.

=== A2 — Event Types. Branch: claude/calendarly-android-a2-event-types ===
Build B1 List, B2 Editor, B3 Intake Questions, B8 Connected Calendars (→501). Spec: §Stream A2.
Owns: ui/screens/scheduling/eventtypes/** (EventTypeListScreen+VM, EventTypeEditorScreen+VM, IntakeQuestionsEditorScreen+VM, ConnectedCalendarsScreen+VM). Fills A0 stubs EVENT_TYPE_LIST, EVENT_TYPE_EDITOR, INTAKE_QUESTIONS_EDITOR, CONNECTED_CALENDARS.
Notes: PUT = partial update. Editor validation: duration range, slug ^[a-z0-9][a-z0-9-]{0,60}$, default_duration ∈ durations. SLUG_TAKEN 409 inline. DELETE → 409 HAS_UPCOMING_BOOKINGS → offer deactivate (PUT is_active=false). visibility public|secret. Price fields hidden unless the paid flag (MoneyAndFlag). B8 read empty + connect→501 "coming soon". Assignees config is NOT here (A13) — link out by route.
I will now paste the designs for B1, B2, B3, B8.

=== A3 — Availability. Branch: claude/calendarly-android-a3-availability ===
Build B4 Schedule List, B5 Weekly Hours, B6 Date Overrides, B7 Booking Limits/Notice, B9 Block off time. Spec: §Stream A3.
Owns: ui/screens/scheduling/availability/** (AvailabilityListScreen+VM, WeeklyHoursEditorScreen+VM, DateOverridesScreen+VM, BookingLimitsScreen+VM, BlockOffTimeScreen+VM). Fills A0 stubs AVAILABILITY_LIST, WEEKLY_HOURS_EDITOR, DATE_OVERRIDES, BOOKING_LIMITS, BLOCK_OFF_TIME.
Notes: availability is ALWAYS personal (GET /availability scoped to req.user — no owner fields). Default schedule auto-created. DELETE default → 409 CANNOT_DELETE_DEFAULT (reassign flow). Rules: weekday 0=Sun, HH:MM; overrides date-level is_unavailable/partial; blocks optional RRULE. B7 limits are EVENT-TYPE fields (min_notice_min/max_horizon_days/slot_interval_min/daily_cap/per_booker_cap) edited via PUT /event-types/:id through the repository — do NOT enter A2's folder.
I will now paste the designs for B4, B5, B6, B7, B9.

=== A4 — Booking page & sharing. Branch: claude/calendarly-android-a4-booking-page ===
Build C1 Page Management, C2 Public Preview, C3 Share Sheet, C4 One-off Link Generator, H16 Empty/Zero-State. (No C9 — web only.) Spec: §Stream A4.
Owns: ui/screens/scheduling/bookingpage/** (BookingPageManageScreen+VM, PublicPagePreviewScreen+VM, ShareLinkSheet (local ModalBottomSheet), OneOffLinkGeneratorScreen+VM, BookingPageZeroState). Fills A0 stubs BOOKING_PAGE_MANAGE, PUBLIC_PAGE_PREVIEW, ONE_OFF_LINK_GENERATOR.
Notes: C3 Share is a LOCAL sheet using shareText(...) + InviteLinks from ui/components/SystemSheets.kt (read-only). C2 preview fetches the public GET /api/public/book/:slug and renders status:'paused' honestly (host's preview of their own page). C4 one-off returns {token,path,expires_at,single_use} — token shown ONCE, store in the share href; expiry + single-use config. H16 zero-state (no page/no event types) → setup CTA. is_live/is_paused toggles; disable = danger. A1 owns the first-run wizard — don't duplicate it.
I will now paste the designs for C1, C2, C3, C4, H16.

=== A5 — Invitee discovery. Branch: claude/calendarly-android-a5-invitee-discovery ===
Build C5 Booker Landing/Profile, C6 Slot Picker, C7 Timezone Selector, C8 No-Availability. Spec: §Stream A5.
Owns: ui/screens/scheduling/invitee/discovery/** (BookerLandingScreen+VM, SlotPickerScreen+VM, TimezoneSelectorSheet (local), NoAvailabilityState). Fills A0 stubs PUBLIC_BOOKING (book/{slug}) and PUBLIC_BOOKING_ONEOFF (book/o/{token}).
Notes: PUBLIC, unauthenticated (SchedulingPublicApi, no auth header). GET /api/public/book/:slug (status active|paused, 404 unavailable); slots GET .../:eventTypeSlug/slots?from&to&tz (paused → empty + status:'paused'); one-off GET /book/o/:token (404 expired). C7 wraps the _shared TimezonePicker (local sheet); C8 no-availability → next-available CTA / advance window. Always pass tz; render startLocal, store UTC. STOP at slot selection → hand to A6 (pass slot+slug via nav args). No writes here.
I will now paste the designs for C5, C6, C7, C8.

=== A6 — Invitee confirm & manage. Branch: claude/calendarly-android-a6-invitee-confirm ===
Build D1 Intake Form, D2 Review/Confirm/Checkout, D3 Confirmed/Thank-You, D4 Manage Your Booking. Spec: §Stream A6.
Owns: ui/screens/scheduling/invitee/confirm/** (IntakeFormScreen+VM, ReviewConfirmScreen+VM, ConfirmedScreen+VM, ManageBookingScreen+VM). Fills A0 stub MANAGE_BOOKING (booking/{manageToken}); intake/review are local steps reached from A5's slot selection.
Notes: build D1 dynamically from eventType.questions. POST /api/public/book/:slug/:eventTypeSlug (or /book/o/:token) → {booking, manageToken, clientSecret?}; PERSIST manageToken via ManageTokenStore. 409 SLOT_TAKEN/UNAVAILABLE/FULL → ConflictAlternativesSheet (re-pick); handle PAGE_PAUSED, one-off LINK_USED/SLOT_NOT_OFFERED. requires_approval → pending copy. Priced → Stripe TEST clientSecret behind the paid flag. D4 actions gated by can_cancel/can_reschedule/deadlines from GET /booking/:token. Reschedule/cancel/add-to-cal edge screens are A7 — deep-link by route + token.
I will now paste the designs for D1, D2, D3, D4.

=== A7 — Invitee edge & customer. Branch: claude/calendarly-android-a7-invitee-edge ===
Build D5 Slot Taken, D6 Payment Failed/Retry, D7 Unavailable/Expired/Paused/Secret, D8 Add to Calendar, D9 Open-in-App/Deep-Link interstitial, D10 Reschedule/Cancel Cutoff & Policy-Blocked, D11 My Bookings, D12 Recurring. Spec: §Stream A7.
Owns: ui/screens/scheduling/invitee/edge/** (SlotTakenScreen, PaymentRetryScreen+VM, UnavailableExpiredScreen, AddToCalendarSheet, OpenInAppInterstitialScreen, RescheduleCancelPolicyScreen+VM), ui/screens/scheduling/invitee/customer/** (MyBookingsScreen+VM, RecurringSetupScreen+VM). Fills A0 stubs MY_BOOKINGS, OPEN_IN_APP_INTERSTITIAL, RECURRING_SETUP.
Notes: D5 full-screen 409 alternatives; D7 the four first-class states + secret (PausedExpiredUnavailableState); D8 GET /booking/:token/ics + native add-to-calendar intent; D9 references core/routing/DeepLinkRouter READ-ONLY (consume the inbound pantopus://…/book/… link via the already-wired RootTabScreen handoff — add NO route plumbing); D10 enforces cutoff/policy from actions (POST /booking/:token/reschedule|cancel|accept-reschedule|decline-reschedule); D6 retries the Stripe clientSecret (TEST, paid flag); D11 GET /my-bookings (authed); D12 sessions array. Reuse persisted manageToken for token routes.
I will now paste the designs for D5–D12.

=== A8 — Bookings inbox & core. Branch: claude/calendarly-android-a8-bookings-inbox ===
Build E1 Inbox, E2 Detail, E3 Approve/Decline, E4 Reschedule/Reassign, E5 Cancel & Refund. Spec: §Stream A8.
Owns: ui/screens/scheduling/bookings/** (BookingsInboxScreen+VM, BookingDetailScreen+VM, ApproveDeclineSheet, RescheduleReassignSheet+VM, CancelRefundSheet+VM). Fills A0 stubs BOOKINGS_INBOX, BOOKING_DETAIL. Sheets are LOCAL ModalBottomSheets off the detail screen.
Notes: inbox status filter (upcoming/pending/past/cancelled) + search q. E4 reuses SlotPicker, honors tz, 409 SLOT_CONFLICT/PAST_DEADLINE → ConflictAlternativesSheet; reassign validates assignee (INVALID_HOST). E5 refund estimate + PAST_DEADLINE/REFUND_FAILED; refund amounts via MoneyAndFlag. Optimistic status flip with refetch-on-error. A9 owns bookings EXTRAS in ui/screens/scheduling/bookings_extra/** — do NOT touch it; link by route.
I will now paste the designs for E1–E5.

=== A9 — Bookings extras. Branch: claude/calendarly-android-a9-bookings-extras ===
Build E6 No-Show, E7 Follow-up, E8 Group Roster & Seats, E9 Search & Filter, E10 Double-Book Warning, E11 Nudge, E12 Manual/On-Behalf Booking, E13 Waitlist. Spec: §Stream A9.
Owns: ui/screens/scheduling/bookings_extra/** (NoShowSheet, PostMeetingFollowupScreen+VM, GroupRosterScreen+VM, BookingSearchFilterScreen+VM, DoubleBookWarning, NudgeSheet, ManualBookingScreen+VM, WaitlistScreen+VM). Fills A0 stubs BOOKING_SEARCH, GROUP_ROSTER, MANUAL_BOOKING, WAITLIST, POST_MEETING_FOLLOWUP.
Notes: folder is bookings_extra/ (NOT bookings/ — that's A8). E6 no-show 409 NOT_APPLICABLE_YET guard. E8 roster seats vs seat_cap. E9 own filter sheet (distinct from A8 inbox). E10 double-book warning before manual create. E12 POST /bookings manual (createdVia='manual'; 409 alternatives). E13 GET /event-types/:id/waitlist + POST /waitlist/:id/promote (public join via POST /api/public/book/:slug/:eventTypeSlug/waitlist). E7 reuses /nudge or a template send.
I will now paste the designs for E6–E13.

=== A10 — Home calendar & RSVP. Branch: claude/calendarly-android-a10-home-calendar === (EXCLUSIVE owner of ui/screens/homes/calendar/**)
Build F1 Home Calendar/Agenda, F2 Event Detail + RSVP, F3 Add/Edit Event, F8 Household Availability, F15 Permission-Gated Scheduler. Spec: §Stream A10.
Owns (EXCLUSIVE): ui/screens/homes/calendar/** (extend HomeCalendarScreen+VM, AddEventFormScreen+VM, EventDetailScreen+VM, CalendarEventCategory, MonthStripHeader) + new ui/screens/scheduling/home/** (HouseholdAvailabilityScreen+VM F8, PermissionGatedSchedulerScreen+VM F15). Fills A0 stubs HOUSEHOLD_AVAILABILITY, PERMISSION_GATED_SCHEDULER (the existing HOME_CALENDAR/ADD_CALENDAR_EVENT/CALENDAR_EVENT_DETAIL routes stay as-is — edit only the screens they point to).
Notes: render the UNION (GET /api/homes/:id/events, rows source:'event'|'booking' + booking_status) — booking rows are READ-ONLY → tap routes to A8's BOOKING_DETAIL; NEVER create HomeCalendarEvent rows for bookings. RSVP upsert (POST .../events/:eventId/rsvp). F15 gates on the home MemberRole (ui/screens/homes/members/MemberRolePalette.kt) + calendar.view (no-access state on backend 403). Home green pillar. No other stream edits homes/calendar/**.
I will now paste the designs for F1, F2, F3, F8, F15.

=== A11 — Find-a-time & who's-free. Branch: claude/calendarly-android-a11-find-a-time ===
Build F4 Find a Time — Setup, F5 Suggested Slots, F6 Member Poll Response, F7 Who's Free. Spec: §Stream A11.
Owns: ui/screens/scheduling/findatime/** (FindATimeSetupScreen+VM, SuggestedSlotsScreen+VM, MemberPollResponseScreen+VM, WhosFreeScreen+VM). Fills A0 stubs FIND_A_TIME, FIND_A_TIME_SLOTS, MEMBER_POLL_RESPONSE, WHOS_FREE.
Notes: home-only via the /api/homes/:homeId/scheduling alias. GET /find-a-time (member_ids, mode collective|round_robin, duration, window) → common slots + eligibleHosts; GET /whos-free → freeByMember grids. F6 polls: POST /polls + public GET /poll/:id + POST /poll/:id/vote (POLL_CLOSED). Member multi-select; empty common-slots state; pass tz, render startLocal. Business team-availability/polls config is A13's concern — this is the HOME find-a-time.
I will now paste the designs for F4, F5, F6, F7.

=== A12 — Home resources & visits. Branch: claude/calendarly-android-a12-home-resources ===
Build F9 Resources List, F10 Resource Editor, F11 Resource Detail/Calendar, F12 Book a Resource, F13 Schedule a Visit, F14 Visit Detail. Spec: §Stream A12.
Owns: ui/screens/scheduling/resources/** (ResourceListScreen+VM, ResourceEditorScreen+VM, ResourceDetailScreen+VM, BookResourceScreen+VM), ui/screens/scheduling/visits/** (VisitSetupScreen+VM, VisitDetailScreen+VM). Fills A0 stubs RESOURCE_LIST, RESOURCE_EDITOR, RESOURCE_DETAIL, BOOK_RESOURCE, VISIT_SETUP, VISIT_DETAIL.
Notes: home-only (owner_type=home / homeId alias). POST /resources/:rid/book honors capacity/availability; 409 SLOT_CONFLICT/RESOURCE_UNAVAILABLE; members-only v1. F11 reads resource bookings via the home events union. Visits: POST /visits (stored as HomeCalendarEvent; 409 BAD_RANGE, ≤30 days; who-is-home assignment); F14 from GET /api/homes/:id/events/:eventId. Do NOT touch ui/screens/homes/calendar/** (A10) — link by route.
I will now paste the designs for F9–F14.

=== A13 — Business config & team. Branch: claude/calendarly-android-a13-business-config ===
Build G1 Round-Robin, G2 Collective Setup, G3 Team Availability, G4 Member Working-Hours, G5 Business Settings. Spec: §Stream A13.
Owns: ui/screens/scheduling/business/** (RoundRobinSheet, CollectiveEventSetupScreen+VM, TeamBookingAvailabilityScreen+VM, MemberWorkingHoursScreen+VM, BusinessSchedulingSettingsScreen+VM). Fills A0 stubs BUSINESS_SCHEDULING_SETTINGS, TEAM_BOOKING_AVAILABILITY, COLLECTIVE_EVENT_SETUP, MEMBER_WORKING_HOURS.
Notes: ALL with owner_type=business via SchedulingOwner; Business violet pillar. PUT /event-types/:id/assignees (subject_type/weight/priority; 400 INVALID_ASSIGNEE) — set via the repository, do NOT edit A2's eventtypes/. GET /team-availability business-only (BUSINESS_ONLY). G4 member working-hours uses personal /availability semantics per member. G5 GET/PUT /booking-page + GET /payments/status readout. G1 round-robin is a LOCAL sheet. A14 owns payments — G5 only READS payments status.
I will now paste the designs for G1–G5.

=== A14 — Payments & payouts. Branch: claude/calendarly-android-a14-payments === (EXCLUSIVE owner of ui/screens/wallet/** additions; behind paid flag)
Build G6 Stripe Connect & Tax, G7 Payouts & Earnings, G14 Cancellation & Refund Policy. Spec: §Stream A14.
Owns (EXCLUSIVE additions): new files under ui/screens/wallet/** (wallet/scheduling/PaymentsSetupScreen+VM, wallet/scheduling/PayoutsEarningsScreen+VM) reusing existing Stripe Connect; plus ui/screens/scheduling/payments/CancellationRefundPolicyScreen+VM (G14). Fills A0 stubs PAYMENTS_SETUP, PAYOUTS, CANCELLATION_REFUND_POLICY.
Notes: ENTIRE stream behind SchedulingFeatureFlags (off → hidden/"not enabled"); Stripe TEST mode. GET /payments/status (connected/charges_enabled/payouts_enabled; applicable:false for homes → not-applicable state). Payout settlement deferred → PROCESSING/PENDING badges. G14 writes cancellation_policy/refund_policy/cancellation_window_min/reschedule_cutoff_min via PUT /booking-page + PUT /event-types/:id. Reuse existing Wallet/Connect components READ-ONLY (don't modify existing wallet screens beyond additive views). No other stream adds files under ui/screens/wallet/**. Re-record wallet Paparazzi if visuals change.
I will now paste the designs for G6, G7, G14.

=== A15 — Packages & invoices. Branch: claude/calendarly-android-a15-packages-invoices === (behind paid flag)
Build G8 Packages List, G9 Create/Edit Package, G10 Buy Package (customer), G11 My Packages/Credits, G12 Invoices List, G13 Invoice Detail. Spec: §Stream A15.
Owns: ui/screens/scheduling/packages/** (PackagesListScreen+VM, PackageEditorScreen+VM, BuyPackageScreen+VM, MyPackagesScreen+VM), ui/screens/scheduling/invoices/** (InvoicesListScreen+VM, InvoiceDetailScreen+VM). Fills A0 stubs PACKAGES_LIST, PACKAGE_EDITOR, BUY_PACKAGE, MY_PACKAGES, INVOICES_LIST, INVOICE_DETAIL.
Notes: behind the paid flag + Stripe TEST. Packages soft-delete (is_active=false). POST /packages/:id/buy → credit + clientSecret?. GET /my-packages credits + remaining sessions; redeem via POST /bookings/:id/apply-credit (409 ALREADY_APPLIED/CREDIT_NOT_APPLICABLE). Invoices business-only (empty otherwise); POST /invoices/:id/send. Do NOT edit the existing homes/packages/ (physical packages) or the gig contentdetail/InvoiceDetailScreen — Calendarly lives in the new scheduling folders.
I will now paste the designs for G8–G13.

=== A16 — Reminders / workflows / templates. Branch: claude/calendarly-android-a16-automations ===
Build H1 Default Reminders Quick-Setup, H2 Workflows List, H3 Workflow Editor, H4 Trigger Picker, H5 Template Editor, H6 Variable Picker, H7 Message Preview, H8 Template Library. Spec: §Stream A16.
Owns: ui/screens/scheduling/automations/** (RemindersQuickSetupScreen+VM, WorkflowsListScreen+VM, WorkflowEditorScreen+VM, TriggerPickerSheet, MessageTemplateEditorScreen+VM, VariablePickerSheet, MessagePreviewScreen+VM, TemplateLibraryScreen+VM). Fills A0 stubs REMINDERS_QUICK_SETUP, WORKFLOWS_LIST, WORKFLOW_EDITOR, MESSAGE_TEMPLATE_EDITOR, TEMPLATE_LIBRARY.
Notes: H1 writes reminder_minutes[] via PUT /booking-page. Workflows CRUD (trigger booking_created|cancelled|rescheduled|before_start|after_end; action email|push|in_app|sms; offset_minutes). Templates require subject for email; POST /message-templates/preview interpolates {{variables}}. H4 trigger picker + H6 variable picker + H7 preview = local sheets/panels (no routes). event_type_id null = all types.
I will now paste the designs for H1–H8.

=== A17 — Insights & reports. Branch: claude/calendarly-android-a17-insights ===
Build H9 Dashboard, H10 Per-Event-Type Performance, H11 No-Show/Cancellation Report, H12 Team Performance, H13 Period/Filter Sheet. Spec: §Stream A17.
Owns: ui/screens/scheduling/insights/** (InsightsDashboardScreen+VM, EventTypePerformanceScreen+VM, NoShowReportScreen+VM, TeamPerformanceScreen+VM, InsightsFilterSheet). Fills A0 stubs INSIGHTS_DASHBOARD, EVENT_TYPE_PERFORMANCE, NO_SHOW_REPORT, TEAM_PERFORMANCE.
Notes: read-only (no mutations); prominent empty/zero-data states. GET /bookings/summary (H9); GET /bookings/insights/no-shows?days (H11); GET /bookings/insights/team?days business-only (H12, BUSINESS_ONLY → not-applicable); H10 aggregates GET /bookings?event_type_id. H13 is a LOCAL filter sheet (days ≤365 + range). No charting lib beyond tokens (simple bars/rows).
I will now paste the designs for H9–H13.

=== A18 — Cross-cutting & polish. Branch: claude/calendarly-android-a18-polish === (run LAST; own-files only)
Build H15 Notification/Reminder Permission & Channel Connect Prompt, H14 Accessibility & Large-Text pass. Spec: §Stream A18.
Owns: ui/screens/scheduling/polish/** (NotificationPermissionPromptScreen+VM, A11yChecklist). Fills A0 stub NOTIFICATION_PERMISSION_PROMPT.
Notes: H15 = OS notification-permission (Android 13+ POST_NOTIFICATIONS, granted/denied/blocked) + channel connect via GET/PUT /notification-preferences + the 501 connect "coming soon". H14 is a cross-cutting a11y AUDIT — apply fixes ONLY to A18's own files; for shared (_shared/) gaps, file a Foundation-gap note; hand the H14 checklist to every other stream to apply IN-PLACE (no cross-folder edits by A18). Run LAST. Verify large-text (adb shell settings put system font_scale 1.3), 48dp targets, contrast, TalkBack.
I will now paste the designs for H15 (+ the H14 audit checklist context).
```
