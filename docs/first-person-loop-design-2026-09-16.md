# The first-person loop: design for sign-up and return with zero other users

**Date:** September 16, 2026
**Status:** Implementation design. Nothing here is built; no application code, migration or configuration was changed to write it. Every "today" claim cites the file and line inspected on master `711340225` on September 16.
**Reads with:** [NEXT_STEPS.md](../NEXT_STEPS.md) (the checklist), the [design docs review](https://claude.ai/code/artifact/09276a14-1587-41be-86ef-54e95505d2d8), the [idea ledger](https://claude.ai/code/artifact/51f601e7-1e56-416e-b549-fbd036e421ba), the [Wedge v2 strategy](https://claude.ai/artifact/GLUkeCRhnFZnsj7tRr1L4D), and [AGENTS.md](../AGENTS.md).
**Decisions this design assumes (made September 16):** navigation stays Place · Today · Nearby · Mail; the density meter gates status, never access; the seeder stays as a labeled platform publisher; the General ban stays; no SavedItem / Action / Watch tables, extend `SavedPlace` and existing tables instead; pilot = available nationwide, observed locally; cash Earn is hidden until withdrawable.

## Contents

1. Goal, loop, and success criteria
2. Design rules
3. Facts about the code the whole design depends on
4. Feature designs (F1–F12)
5. Measurement and instrumentation
6. Build order, migrations, flags, effort
7. Risks and open questions
8. Appendix: files and tests per feature

---

## 1. Goal, loop, and success criteria

**Goal.** A stranger with no neighbors on Pantopus signs up because of one true fact about their address, gets something useful the same minute, and comes back next week because the address keeps producing things worth knowing. Social features stay available but are never the reason to return.

**The loop.** Each step hands the person to the next; none needs another user.

1. **Sign-up from a fact.** `/start` shows what is on record about an address. The compare card carries it to the next stranger (F8).
2. **The bridge.** Saving the place makes it the person's location for Today and the briefing the same minute (F1). The first week asks for three things: pickup day, one important date, the people you live with (F2).
3. **Weekly return.** "Recycling tomorrow." (F4)
4. **Conditional daily return.** Weather, air and alerts only when they cross a threshold, and a home-screen widget that needs no notification at all (F4, F7).
5. **Monthly return with investment.** Snap a bill, get it on the calendar, mark it paid (F10, phase 2).
6. **Annual return.** Tax due, appeal window, lease and insurance renewals, radon month, voter registration (F5, F6, F12).
7. **The household is the first network.** Co-residents share the calendar, tasks and bills and get each other's updates (F3).
8. **The keeper is the face.** A named creature whose mood is a summary of real obligations (F11, phase 2).

**Success criteria for the pilot (30 movers, seeded metro, four weeks).**

| Measure | Definition | Bar |
|---|---|---|
| Activation | Address saved, plus briefing or widget on, plus one household fact (pickup day, an important date, or a co-resident) within 7 days | 50% of sign-ups |
| Week-four return | Activated users who open the app in week 4, attributed to trigger | 40% |
| Spread | compares sent ÷ aha views × compare links opened ÷ compares sent × reveals ÷ opens | k ≥ 0.3 |
| Honesty | Zero reports of a card read as a claim about a neighbor's home; zero pushes that fire on a guessed schedule as if confirmed | 0 |

**Out of scope for this design:** the source-discovery engine, capture sheet, place pages, Recent conditions, Moment category, bill paying by the keeper, deals, navigation changes, native redesigns. See the ledger's "Not now" list.

---

## 2. Design rules

1. **Extend, never rebuild.** Every feature below names the existing screen, route, table and job it extends. No parallel tables. Forward migrations only, additive where possible.
2. **Honest states everywhere.** Every new surface has loading, empty, error and offline states with the copy written here. "Unverified" data says so on the surface that shows it. A push never fires on a guessed schedule as if it were confirmed.
3. **Private by default.** Nothing about a saved place is visible to anyone else. The compare card carries grades and a city, never an address. Household data follows the existing permission model.
4. **Notification etiquette.** One push per trigger per day at most. Silence is a valid outcome. Every push has an in-app equivalent that works with notifications off. Every push deep-links to the exact surface.
5. **Three platforms, one contract.** Backend changes ship first; web second; iOS and Android follow with the same copy and states. Where a platform lacks a client today (Android has no saved-places client), the design says so and sequences it.
6. **Instrumented from day one.** Every step of the loop writes an event that the existing funnel summary can read.

---

## 3. Facts about the code the whole design depends on

These were verified by inspection on September 16 and are cited throughout.

**Location for Today and the briefings.** `resolveLocation` (`backend/services/context/locationResolver.js:224-342`) reads `UserNotificationPreferences` (custom pin), `UserViewingLocation`, `HomeOccupancy`, then `HomeOwner`/`Home`, in that order, and returns `EMPTY_RESULT` (source `none`) otherwise. It never reads `SavedPlace`. So a T1 account that saved a place gets `GET /api/hub/today` = "Location not available." with `display_mode: 'hidden'` (`providerOrchestrator.js:126-141`), and both briefings skip with `no_location` (`:668-674`). The web Today tab already reads `/api/hub/today`; iOS `AddressTodayTabView` and Android `TodayTabViewModel` gate on `GET /api/homes/my-homes` and show "Today starts at your address" with "Claim your address".

**Two different Today payloads.** `GET /api/hub/today` (weather, aqi, alerts, ranked signals, seasonal tip) feeds the briefing screens and the web Today tab. The native Today tabs render the Place intelligence payload `GET /api/homes/:id/intelligence` whose `air_quality` and `address_calendar` sections are what a widget needs; pickup appears in `/api/hub/today` only as a `signals[]` entry of kind `address_calendar` inside the lead window (`usefulnessEngine.js:277-322`).

**The address calendar.** `AddressCalendarRule` (baseline `:7538-7561`) has scope `state|county|city|home`, kinds `garbage|recycling|yard_waste|bulk_pickup|street_sweeping|property_tax|utility_bill|burn_ban|boil_water|road_closure|council|permit_hearing|school|election_deadline|other`, `rrule`, `lead_days 0-30`, `confidence official|unverified`, and a partial unique index one row per `(scope_key, kind)` for home scope. `composeForHome` (`addressCalendarService.js:109-170`) expands 14 days; household pickup rules are written through the `mutate_home_pickup_calendar` RPC, which requires home access. No route creates rows for a saved place, and `HomeBill` rows are not merged into the calendar.

**Briefings and pushes.** The morning briefing has an interrupt gate (`MIN_PUSH_SCORE 0.20`, `MIN_PUSH_COST 0.25`, skip reason `low_signal_day`, `providerOrchestrator.js:91-92, 536-547`). The evening briefing has no gate and falls back to a tip plus a weather lead-in (`:620-640`); `selectEveningSignal` ignores the address calendar it is handed (`eveningBriefingService.js:304-327`). Scheduling is the seeder Lambda `briefing.py` every 15 minutes, only for users who have a `UserNotificationPreferences` row. Threshold-crossing alert pushes (AQI ≥ 101, NOAA) come from `alert_checker.py` keyed on `HomeOccupancy` geohashes only. Bill and task reminders come from `home_reminders.py` twice daily through `POST /api/internal/briefing/reminder-push` (`internalBriefing.js:458-515`), which is the generic reminder channel any new date can reuse. Home pushes are double-gated by `MailPreferences.push_notifications` and `UserNotificationPreferences.home_reminders_enabled` (`notificationService.js:246-251, 374-386`). Briefing and reminder pushes bypass `notificationTemplateRegistry`.

**Household.** Membership is `HomeOccupancy` (there is no `HomeMember`); invitations are `HomeInvite` (there is no `HomeInvitation`). Invitations exist end to end on all three platforms through the recovery-safe sender commands (`POST /api/homes/invitations/sender/commands`, `home.js:1376`) with email, in-app notification and link/QR delivery on web; iOS offers email only. Accepting an invite sets `HomeOccupancy.verification_status='verified'` immediately (`20260912040000` L391-402). The ordinary `member` role has only `home.view`, `tasks.view`, `tasks.edit` (`HomeRolePermission`; `20260911030000`, `20260912050000`), so an invited co-resident cannot see the member list, the household calendar, or bills. Marking a bill paid (`PUT /:id/bills/:billId`, `home.js:2706-2745`) emits nothing; `task_completed` has a template but no emitter (`notificationService.js:530`); `task_assigned` is the only transactional co-resident notification (`20260910180000` L65-107). No screen prompts an invite during home creation. `GET /api/homes/invitations` (received list) has no caller.

**The start funnel and share card.** `/start` → `StartFunnel.tsx` → `GET /api/public/place` (`public.js:475-627`, 60/min per IP, persists nothing) → server-ranked aha (`placePreviewService.js` `pickAha :438-473`) plus every Band-A section, sticky `WallBar` ("Keep this address handy."), and "Share this address" copying `/start?address=`. The OG image `frontend/apps/web/src/app/api/og/place/route.tsx` renders one address: aha grade/headline/detail and up to four chips (Flood, Wildfire, Air today, Radon). `FunnelEvent` is CHECK-constrained to six event types (baseline `:9651`); adding one needs a migration mirroring `196_funnel_event_aha_share.sql`. The anonymous preview receives only a boolean `founding_open` (`public.js:549`, `placePreviewService.js:191`); slot counts and the window end exist only on the signed-in block detail. `public.js:557` defaults `founding_open` to `true` on a failed lookup. The positioning line is hard-coded in five places (web page metadata, `StartFunnel.tsx:114`, `HeroSection.tsx:41`, `PlaceLaunchView.swift:128`, `PlaceLaunchScreen.kt:143`).

**Feed privacy.** `normalizeFeedPostRow` copies `effective_latitude/longitude` verbatim (`feedService.js:199-200`); `applyPostLocationPrivacy` (`:251-271`) jitters only `latitude/longitude`. Every non-persona post therefore reaches non-authors with raw effective coordinates on list, map, saved posts and `GET /api/posts/:id`. No client reads the field. `Post.origin` (`user|curator|system`) is emitted (`feedService.js:236`) but undeclared on the web `Post` type, iOS `FeedPostDTO` and Android `FeedPostDto`.

**Mail.** "Mail Day" is a physical-mail triage screen fed by unresolved digital `MailRoutingQueue` rows, not a scanner. `POST /api/mailbox/v2/mailday/items` (`mailDay.js:358`) takes text fields only. The iOS and Android "Scan today's stack" buttons are wired to no-ops (`YouTabRoot.swift:1020`, `RootTabScreen.kt:5617`). AI extraction is text-only (`agentService.summarizeMail :745`, `mailSummaryJsonSchema` types `metadata` as a string) and unpersisted; the photo→JSON pattern exists in `draftListingFromImages` (`:567-670`). `HomeBill` CRUD, "Mark paid" on all three platforms, bill trends, and seeder bill reminders all exist. `HomePreference.settings jsonb` (`20260911010000`) is the only free per-home slot.

**Widgets.** Both native apps ship a "Tasks near me" widget on an app-writes-snapshot / widget-reads-snapshot pattern (iOS App Group `group.app.pantopus.ios`, `GigWidgetSnapshot.swift`, `WidgetSnapshotStore.swift`; Android `WidgetSnapshotStore.kt`, classic RemoteViews `TasksNearMeWidgetProvider`, no Glance dependency). Widget extensions cannot call the API: keychain items are app-private and `AUTH_DEVICE_BINDING=required` would reject them. No background refresh exists on either platform.

---

## 4. Feature designs

Each feature: goal, stories, today, design (UX per platform with copy and states), data and API, notifications, privacy and honesty, acceptance, effort, tests.

### F1. Save sets location (the bridge)

**Goal.** A T1 account that saves a place gets Today, the seasonal card and the briefing immediately, without claiming a home.

**Stories.** As a new user who just saved my address, I open Today and see my weather, air, alerts and what is coming up. As the same user, I can turn on the morning briefing from Today.

**Today.** See §3, "Location". `POST /api/saved-places` (`savedPlaces.js:25-66`) upserts and touches nothing else: no `UserViewingLocation`, no `UserNotificationPreferences` row, no hub cache clear. Web `SavedPlaceContext` shows the anonymous preview only. Android has no saved-places client.

**Design.**

*Backend.*
- `resolveLocation`: add step 6b between recent viewing location and `EMPTY_RESULT`: newest `SavedPlace` for the user → `makeResult(lat, lng, label, 'saved_place', null, fallbackTimezone)`; add `saved_place: 0.60` to `CONFIDENCE`. Precedence stays below every home and pinned source so a verified resident who once previewed a friend's address never gets that address's briefing.
- `POST /api/saved-places`: after the upsert, upsert a `UserNotificationPreferences` row for the user with defaults (`daily_briefing_enabled=false`, timezone inferred from coordinates) so the scheduler can see the user; call `clearHubTodayCache(userId)`.
- No new `location_mode`; `saved_place` is a resolver source, not a user mode.

*Web.* Today tab (`hub/today/page.tsx`): the empty branch (`:177-181`) becomes source-aware. When `today.location.source === 'none'`: title "Today starts with a place", body "Save an address and Today will show its weather, air, alerts and dates.", button "Preview an address" → `/start`. When the source is `saved_place`, render the normal Today with a one-line header chip "Saved place · Only you" and the existing morning-briefing opt-in ("A morning heads-up?" from `TodayDetail.tsx:443-498`) moved into this tab so it no longer requires a Home.

*iOS.* `AddressTodayTabView.resolveHome` (`:120-142`): when `my-homes` is empty, call `SavedPlacesEndpoints.list()`; if a saved place exists, host the existing `TodayDetailView` (already used for briefing deep links, `RootTabView.swift:256-262`) with the same chip; keep the "Today starts at your address" card only when there is neither a home nor a saved place, and change its button to "Preview an address" when the user has no home.

*Android.* Add the missing saved-places client (`SavedPlacesApi` mirroring `SavedPlacesEndpoints.swift:15-30`), then the same branch in `TodayTabViewModel.kt:43-70`.

*States.* Loading: existing skeletons. Error: "Couldn't load today." + Retry (existing). Offline: show the last successful payload with "Updated 2h ago" (the hub cache TTL makes this cheap on web; natives keep the last loaded state in the view model).

**Data and API.** No table changes. One resolver branch, one side effect on save, one cache clear.

**Privacy and honesty.** A saved place is "Only you" and never appears to anyone else; the chip says so. A saved-place Today never shows the address calendar as if confirmed (F5 covers what a T1 user can set).

**Acceptance.**
- A new account that saves a place and opens Today sees weather, air, alerts and the seasonal card within one request; `today.location.source === 'saved_place'`.
- A user with a home or a pinned viewing location is unaffected (resolver test with both rows present).
- The morning briefing for a saved-place user composes and sends when enabled; `DailyBriefingDelivery.skip_reason` is never `no_location` for such users.
- Removing the last saved place returns Today to the "starts with a place" state.

**Effort.** Backend hours; web 1 day; iOS 1–2 days; Android 2–3 days including the client.

**Tests.** `backend/tests/hubContext.test.js` (Location Resolver block), `backend/tests/unit/savedPlaces.routes.test.js`, `frontend/apps/web/tests/savedPlaceContext.test.tsx`, iOS `TodayDetailViewModelTests`, Android `TodayTabViewModel` tests.

### F2. The three-question first week

**Goal.** Onboarding asks for exactly the three facts that predict return: pickup day, one important date, the people you live with.

**Today.** The setup checklist (`hub.js:188-199`) has keys `home`, `verify`, `complete_profile`, `profile_photo`, plus gig steps on the earning path; it renders on web only (`PlaceDashboard.tsx:157-158`, `SetupBanner.tsx`). No step for a saved place, pickup day, an important date, or co-residents.

**Design.**
- Reorder and re-key the checklist: `save_place` (done when a `SavedPlace` or Home exists) → `pickup_day` (done when a pickup rule exists for the saved place or home) → `important_date` (done when one user-entered rule exists, F5) → `household` (done when `members_active > 1` or a pending invite exists, F3) → `verify` → `complete_profile` → `profile_photo`. Gig steps unchanged.
- Title "Set up your place" (existing). Step copy: "Save your address", "Set your pickup day", "Add one date that matters", "Add the people you live with", "Verify you live here".
- Render on iOS and Android Today above the content, using the same payload (`payload.setup`, `hub.js:569-578`); dismissible per step; no confetti; a step that is done just disappears.

**Acceptance.** A user who completes the three first-week steps is `activated` by the §5 definition. The banner never shows a step the user cannot complete at their tier (pickup and dates work at T1 via F5; household requires a claimed home, so it shows "Claim your address to add your household" at T1).

**Effort.** Backend hours; web hours; natives 1 day each.

### F3. The household is the first network

**Goal.** Co-residents see each other, the calendar and bills, are invited in the first week, and get a push when someone else in the home acts.

**Stories.** As a new resident, I am asked who lives with me and can invite them by email, username or link. As a co-resident, I see the pickup schedule, tasks, bills and calendar without asking for permissions. As a household member, I get "Sam marked the water bill paid" and "Maya finished 'Change furnace filter'".

**Today.** See §3, "Household".

**Design.**

*Permissions (one additive migration).* Copy the pattern of `20260912050000_home_member_task_defaults.sql`: insert `HomeRolePermission` rows for `member`: `members.view`, `calendar.view`, `calendar.edit`, `finance.view`. Add a SQL contract test next to `supabase/tests/home-member-task-defaults.test.sql`. Consequence, documented in the migration header: pending invitations carrying an `admission_policy` snapshot return `INVITE_POLICY_CHANGED` and must be reissued; effective permissions of existing members change immediately.

*First-week prompt.* On the home dashboard when `summary.members_active === 1` or within 7 days of the actor's `HomeOccupancy.start_at`: card "Who lives here with you?" / "Add the people you live with. They see the same pickup day, calendar and bills. Nothing about your home is shared with anyone else." / buttons "Invite by email", "Share a link". Web opens the existing `InviteMemberModal`; iOS `InviteMemberWizardView`; Android `InviteMemberWizardSheet`. Dismiss with "Just me" (persists on `HomeOccupancy` alongside the just-moved flags in F6).

*iOS parity.* Add username and link channels to `InviteMemberWizardViewModel` (backend already accepts `user_id`/`username` and open invites).

*Received invitations.* Render `GET /api/homes/invitations` on My Homes (web `homes/page.tsx`, iOS `MyHomesListViewModel`, Android My Homes) as "Invitations waiting for you" rows linking to `/invite/:token`.

*Notifications.*
- `bill_paid`: after a successful `PUT /:id/bills/:billId` with `status='paid'`, insert a `Notification` of new type `bill_paid` for each active verified occupant other than the actor: title "{actor} marked the {provider or bill type} bill paid", body "${amount} · due {date}", link `/app/homes/:id/bills`. Register in `PERSONAL_TEMPLATES` and `HOME_TYPES`. Best-effort after commit (bills are plain writes with no transaction).
- `task_completed`: call the existing `notifyTaskCompleted` from the record PUT handler when `status` becomes `done` and `created_by !== actorId`.
- `home_event_created`: on event create, notify verified members other than the actor: "{actor} added '{title}' for {date}".
- All three obey the existing double gate; the in-app row always exists even when push is off.

*Members page fix.* The web Members "Invite" button (`members/page.tsx:205-208`) points at the household invitation flow; Add Guest becomes a secondary action.

**Privacy and honesty.** An invite offers household access, not residency verification; keep the existing copy "This invitation does not grant ownership." Open-link invites widen exposure; the first-week card offers email first and shows the existing warning on the link option. See §7 for the verification-status question.

**Acceptance.**
- An invited `member` can list co-residents, read and edit the calendar, and read bills without any role change by the owner.
- A pending invite created before the migration shows the reissue message, not a silent failure.
- Marking a bill paid produces exactly one `bill_paid` notification per other verified member, with an idempotency key `bill_paid:{billId}:{paidAt}`.
- The first-week card appears once per home per user and never after a co-resident is added or "Just me" is chosen.

**Effort.** Migration and notifications 1–2 days; first-week card 1 day web + 1 day per native; iOS channel parity 2 days; received list 1 day per platform.

**Tests.** `supabase/tests/home-member-*.test.sql`, `backend/tests/unit/homeInvitation*.test.js`, `backend/tests/integration/homeOnboarding.test.js`, `frontend/apps/web/tests/homeInviteFlow.test.tsx`, iOS `InviteMemberWizardViewModelTests`, Android `HomeInvitationSenderCoordinatorTest`.

### F3b. Address-verified vs household-verified (decision 8, September 16)

**Decision.** Only address verification (postcard code, reviewed document, landlord confirmation, admin override) makes someone an address-verified resident. Accepting a household invitation makes someone a household-verified member: full household tools, no attested artifacts.

**Today.** `act_on_home_invitation` writes `HomeOccupancy.verification_status='verified'` with `verified_at` and an expiry on accept (`20260912040000_home_invitation_sender_recovery.sql:385-402`). The address paths write the same status through `occupancyAttachService` (`:710-725`), recording the method only in the audit log. `isVerifiedResident` (`homePermissions.js:432-443`) checks `verification_status === 'verified'` and staleness, nothing else, and is the single gate for residency letters, residency claims, fridge cards, Real Rent, Block Founder rank and invites, and home record watches (`grep isVerifiedResident backend/routes`). Neighbor messaging and mail compose also filter on `verification_status='verified'` (`neighborMessages.js:77`, `mailCompose.js:78`).

**Design.**
- Migration (additive): `HomeOccupancy.verification_source text CHECK IN ('address','household','legacy') NOT NULL DEFAULT 'legacy'`. Backfill: rows with a matching `AddressClaim` / verification attempt for `(home_id, user_id)` → `address`; rows matching an accepted `HomeInvite.accepted_by_user_id` for the home → `household`; the rest stay `legacy`.
- Writers: `occupancyAttachService` attach and upgrade paths and the admin override set `address`; `act_on_home_invitation` and the claim-merge path (`20260910045000`) set `household`. The audit log keeps the method as today.
- Gate: `isVerifiedResident` returns false when `verification_source === 'household'`; `legacy` is treated as `address` so no existing resident loses an unlock. Add `isHouseholdMember(access)` for surfaces that need "verified member of this home" without attestation.
- Surfaces that require **address** verification: residency letters, Residency Pass and residency claims, fridge cards, Real Rent reporting, Block Founder rank and postcard invites, neighbor messages, the verified badge, the Founding Neighbor tier. Surfaces that stay **household**: tasks, calendar, bills, documents, the household mailbox, member list, and every F3 notification.
- Copy on the invitation decision screens (web `AuthenticatedInvitationPage`, iOS `HomeInvitationDecisionView`, Android `HomeInvitationDecisionScreen`), replacing the ownership line: "This invitation gives you household access. To send neighbor messages or get a residency letter, verify the address yourself." The verify sheet's "What this unlocks" list is unchanged and is shown to household members as the next step.
- Hub `verified` flag (`hub.js:118`) and the dashboard's `mailbox.view` check keep household semantics; the profile badge uses the address gate.

**Acceptance.** An invited member can use every household tool and cannot mint a residency letter, fridge card, Real Rent report, Block Founder rank or neighbor message until they verify the address; an existing resident verified by postcard before the migration keeps all unlocks; the SQL contract test covers all three source values.

**Effort.** Migration and gate 1 day; writers and copy on three platforms 1–2 days.

**Tests.** `supabase/tests/home-invitation-transactions.test.sql`, `backend/tests/unit/homePermissions*.test.js`, `backend/tests/residencyLetters*.test.js`, `backend/tests/blockFounders.test.js`, `backend/tests/integration/homeOnboarding.test.js` (Scenario E token invite bypass prevention).

### F4. Night-before pickup push and the conditional briefing

**Goal.** One weekly push everyone wants ("Recycling tomorrow, bins out tonight"), and a daily briefing that only interrupts when something changed.

**Today.** See §3, "Briefings". The morning briefing can already carry "Garbage day is tomorrow" but at 07:30 the day before; the evening briefing ignores the calendar and always sends something.

**Design.**

*Night-before pickup.*
- `eveningBriefingService.selectEveningSignal` gains `addressCalendar`; add `buildTomorrowPickupSignal`: items with `days_until === 1` and kind in `PICKUP_KINDS` (plus `bulk_pickup`) → signal kind `address_calendar`, score 0.66, identity `${kind}:${date}`, copy "{Recycling and garbage | Garbage | Recycling} tomorrow. Bins out tonight." with "(Unconfirmed city schedule. Set your pickup day to make it yours.)" appended when `confidence === 'unverified'`, action route `/place/today`.
- It rides the existing evening briefing (`DailyBriefingDelivery.briefing_kind='evening'`), so no new kind, no new schedule. Evening time default 18:00 (existing preference).

*Conditional briefing.*
- Apply the morning interrupt gate to `composeEveningBriefing`: drop the tip-only third pass; require a selected signal with `cost_of_inaction ≥ MIN_PUSH_COST`; otherwise `emptyBriefingResult('low_signal_day')`.
- Morning: unchanged gate; add "no repeat" rule: a signal identity already pushed within 24h (weather lead-in excepted) does not count toward the gate.
- Threshold crossings (AQI ≥ 101, NOAA alerts) stay in `alert_checker.py`; extend `_get_user_geohashes` to include saved-place users (query `SavedPlace` newest per user) so F1 users get alerts too.

*Copy.* Morning title stays "Your Morning Briefing"; evening title becomes the signal's headline when it is a pickup or bill ("Recycling tomorrow") and "Your Evening Briefing" otherwise.

*In-app.* Today shows the same items whether or not the push fired; a quiet day shows "Nothing needs your attention today" only when all checks succeeded (existing state semantics from the nationwide doc §5.2, adopted).

**Privacy and honesty.** City-default pickup rules are `unverified` and the push says so. A household-confirmed rule drops the caveat. Never push a pickup for a saved place without a user-set day (F5).

**Acceptance.**
- With a pickup rule for tomorrow and evening briefing enabled, the user receives one push at their evening time with the pickup headline; the delivery row records the signal snapshot.
- With no signal above the gate, `DailyBriefingDelivery.status='skipped'` with `low_signal_day`, and no push is sent.
- A user with notifications off sees the same item on Today.

**Effort.** Backend 2–3 days including tests; no client work beyond copy.

**Tests.** `backend/tests/hubContext.test.js` (Evening Briefing Service, Provider Orchestrator interrupt gate), `backend/tests/unit/internalBriefing.test.js`, `backend/tests/unit/addressCalendar.test.js` (briefing signals).

### F5. Important dates

**Goal.** Lease end and notice deadline, insurance renewal, warranty expiry, HOA dues, and a pickup day, all user-entered, all on the address calendar, all reminded, and available at T1 for a saved place.

**Today.** No user-entered dates exist. `AddressCalendarRule` home scope is the nearest structure but requires a Home and home-access RPCs.

**Design.**

*Data (one forward migration, no new table).*
- Extend `AddressCalendarRule_kind_chk` with `lease_end`, `lease_notice`, `insurance_renewal`, `warranty_end`, `hoa_dues`, `tax_appeal`.
- Extend `AddressCalendarRule_scope_chk` with `saved_place`; `scope_key = SavedPlace.id`. The home-scope partial unique index is unchanged; add the same partial unique `(scope_key, kind) WHERE scope_type='saved_place'`. One row per kind per place in v1 (a second warranty goes into `HomeCalendarEvent` later); the UI says "one per kind for now".

*API.*
- `GET/PUT/DELETE /api/saved-places/:id/calendar[/pickup-day|/dates/:kind]`: same payload shape as the home calendar; composes with `scopeKeysFor` using the saved place's `state` and `city` (county absent → state and city scopes only) and the timezone inferred by the resolver. Rules are written directly (owner = the user), bypassing the home RPCs by design because a saved place has no household.
- `PUT /api/homes/:id/calendar/dates/:kind` for homes (any verified member, same as pickup day): `{ date, lead_days?, title? }`.

*UX (all platforms, inside the existing address-calendar card).* Header "NEXT 14 DAYS AT THIS ADDRESS" gains a "Dates" toggle next to "Pickup schedule". Sheet: "Add a date that matters" with kind picker (Lease ends · Notice deadline · Insurance renews · Warranty ends · HOA dues · Property-tax appeal window closes), a date, and "Remind me" 60 / 30 / 7 / 1 days (maps to `lead_days`, capped at 30 today; 60 requires raising the CHECK to 0–60 in the same migration). Confirmation toast "Saved to your calendar. Only you." at T1, "Saved to your household calendar." at T3. Empty: "Nothing on the calendar for the next two weeks." (existing). Error: "Couldn't save that date. Try again."

*Reminders.* `home_reminders.py` gains a `_process_calendar_dates` pass over rule occurrences with `days_until ∈ {lead_days, 1, 0}` for the new kinds, pushing through `reminder-push` with `reminderType 'calendar'`: "Lease notice deadline in 30 days" / "Insurance renews tomorrow". Dedup key `rule_{id}_{date}`. Also insert a `Notification` row (today the Lambda is push-only); register a `calendar_date` template in the personal context.

**Privacy and honesty.** User-entered dates are the user's claim; the calendar shows them with source "You". They never appear to neighbors.

**Acceptance.**
- A T1 user with a saved place can set a pickup day and one lease-end date and sees both on Today and in the calendar within the window.
- Reminders fire at lead, day-before and day-of, once each, and appear in the in-app list.
- A home member without `calendar.edit` cannot write dates (403 with the existing message).

**Effort.** Migration and service 2 days; routes 1 day; web 1–2 days; natives 2 days each; seeder 1 day.

**Tests.** `backend/tests/unit/addressCalendar.test.js`, `addressCalendarSeeds.test.js`, iOS `AddressCalendarContractTests.swift`, Android `PickupScheduleSnapshotTest.kt`.

### F6. Just Moved on the account, plus voter registration

**Goal.** The movers' checklist survives devices and fills itself, and includes the one civic deadline movers actually miss.

**Today.** Ticks and dismissal are device-local on all three platforms (`JustMovedCard.tsx:22-23`, `JustMovedCard.swift:39-66`, `JustMovedCard.kt:121-134`); the card requires `Home.move_in_date`; `civic_election` returns `{name, date, days_until}` behind an unset `GOOGLE_CIVIC_API_KEY` and no registration data; no `election_deadline` rows are seeded.

**Design.**
- Migration: add `just_moved_done text[] NOT NULL DEFAULT '{}'` and `just_moved_dismissed_at timestamptz` to `HomeOccupancy` (the existing per-user-per-home row, pattern `density_milestone_seen`). Expose on home detail; `PATCH /api/homes/:id/just-moved { done: [...], dismissed: bool }`. Merge rule on first sync: union of local and server ticks; dismissed if either.
- Sixth step `register`: "Update your voter registration" → `/app/place/civic`, auto-ticks when the user taps "I did this" (self-report, labeled).
- Seed state-scoped `AddressCalendarRule` rows of kind `election_deadline` for the November 3, 2026 general election registration deadlines (online/by-mail/in-person dates differ by state; seed the earliest with `detail` listing the others and `source_url` to the state's election office), `confidence 'unverified'` until each is checked. The seasonal headline (F8) reads these rows.
- Copy for the step: "Moved in? Registration is per address. Deadline for November 3: {date} ({state}). Check or update at {state office}." Never claim to know whether the user is registered.

**Acceptance.** Ticks made on web appear on iOS after the next detail fetch; the card hides for a home when dismissed on any device; the voter step shows the seeded deadline for the home's state with its source.

**Effort.** Migration and route 1 day; three clients 1 day each; seed data 1–2 days of verification against state sites.

### F7. Home-screen widgets

**Goal.** "Recycling Tue · AQI 42 · Lease notice in 12 days" on the phone's home screen with no notification.

**Today.** See §3, "Widgets". No Today widget, no snapshot contract, no write site.

**Design (snapshot pattern, no API calls from the extension).**

*iOS.*
- New `Pantopus/Core/Widgets/TodayWidgetSnapshot.swift` (Foundation-only): `TodayWidgetSnapshot { generatedAt, placeLabel, nextPickup: {kind, date, unverified}?, aqi: {index, label}?, nextDate: {kind, title, date}? }`; contract key `todaySnapshotV1`, kind `TodayWidget`, same App Group. Add to `project.yml` under `PantopusWidgets.sources` next to `GigWidgetSnapshot.swift`.
- `WidgetSnapshotStore`: `write(_ snapshot: TodayWidgetSnapshot)` with `reloadTimelines(ofKind:)`.
- Write site: `PlaceDetailViewModel.fetch()` after `.loaded` (`:47`) for home users; the F1 saved-place Today view model for T1 users.
- `PantopusWidgets/TodayWidget.swift`: clone `TasksNearMeWidget`; small and medium; timeline `.after(+30 min)`; **compute "today/tomorrow/in N days" from the stored ISO date at render time**, never from a stored `days_until`; placeholder "Open Pantopus to see today at your address"; no-place placeholder "Save an address to see today here"; `widgetURL pantopus://today?src=widget`.

*Android.* Classic RemoteViews (no Glance): `TodayWidgetProvider` cloned from `TasksNearMeWidgetProvider`; `WidgetSnapshotStore.kt` gains a `TodayWidgetSnapshot` under `KEY_TODAY_SNAPSHOT`; write site `TodayTabViewModel.refresh()` on `Success`; `updatePeriodMillis 1800000`; tap → `pantopus://today?src=widget`; strings `widget_today_*`.

*Copy.* Line 1 pickup: "Recycling + garbage Tue" / "Garbage tomorrow" / "Set your pickup day"; add "·unconfirmed" glyph when `unverified`. Line 2 air: "AQI 42 Good". Line 3 next date: "Lease notice · 12d" / "Tax due Oct 31".

*Staleness.* After 6h without a write, show the last values greyed with "Open to refresh". This mirrors the existing widgets and avoids any background-refresh or token-sharing work.

**Acceptance.** Adding the widget after one Today open shows all three lines; killing the app and waiting a day shows "tomorrow" turning into "today" without an app open; a user with no place sees the placeholder.

**Effort.** iOS 1–2 weeks; Android 1–2 weeks (three-line RemoteViews layout, provider, strings, tests).

**Tests.** Snapshot writers like `GigsFeedViewModelTests` / `GigsFeedViewModelTest` with a fake store; a render-time date test for the timeline provider.

### F8. The compare card, the rotating headline, and the positioning line

**Goal.** After the aha, one tap creates a link that carries your four grades and city, never your address; the friend sees your column, types theirs, and gets the side-by-side reveal plus their own aha. The headline layer rotates to the fact with an official source, a deadline or free action, and emotion this month.

**Today.** See §3, "The start funnel".

**Design.**

*Compare token (server-signed, nothing stored).*
- `POST /api/public/compare-card { address }` → runs the same preview composition (cached by geohash, never by address, per the anti-leak contract in `tests/publicPlace.test.js`) and returns `{ token }` where token = base64url of `{ v:1, c:"Camas, WA", n?:"Maya", g:{flood:"A",wildfire:"C",air:"B",radon:"D"}, h: <aha headline ≤ 90>, exp }` plus an HMAC using the keyring pattern of `backend/utils/homePostcardCodeMaterial.js` (env `COMPARE_CARD_KEYS_JSON`). Rate limit as `/place`. The token carries no address and no coordinates.
- `GET /api/public/compare-card/:token` → verifies and returns the payload (used by the OG route and by native clients).

*Web `/start?vs=<token>`.*
- `page.tsx` `generateMetadata`: when `vs` is present, title "What's true about Maya's place. Yours?", image `/api/og/place?vs=<token>`.
- `StartFunnel.tsx`: read `vs`; render a "compare header" above the hero: sender's column (city, four grade chips, headline) and an empty "Your place" column with the address field inside it; after a successful preview, show both columns side by side above the normal aha and sections; fire `t0_compare_viewed` on load and the existing `t0_aha_viewed` on reveal.
- Under the aha (with or without `vs`): button "Compare with a friend" → calls `compare-card`, builds `/start?vs=<token>`, opens the share sheet on mobile web, copies on desktop ("Link copied"). Fires `t0_share_clicked` with `meta.method: 'compare'`.
- Optional first-name field on the compare sheet ("Show my first name on the card", off by default).

*OG image.* `route.tsx`: with `vs`, verify the token and render two columns: sender chips and headline; right column "Yours?" with an address-shaped placeholder. Add `Cache-Control: public, max-age=3600` to the image response (the token is immutable). Without `vs`, unchanged.

*Native.* iOS gains "Share this address" and "Compare with a friend" on the T0 preview (`PlacePreviewBody.swift:316-322`, `SystemSheets.swift`); Android's `ShareAddressLink` gains the compare variant. Both open `/start?vs=` on the web; no native compare screen in v1.

*Grades.* The four chips already exist on the OG card: Flood = `flood.risk_level`, Wildfire = `wildfire.hazard_label`, Air = `air_quality.category_label`, Radon = `Zone N`. Add a per-chip "how we know" line on the compare view: "County radon zone (EPA)", "FEMA flood zone", "USFS wildfire hazard, quarter-mile", "AirNow, today". Air is time-varying and says "today".

*Same-cell Founding line.* `public.js:549`: replace `foundingSlotsOpen(geohash)` with `cellFoundingWindow(geohash)` and pass `{open, slots_open, ends_at}` into the density envelope (never a verified-home count). `WallBar`: when the compare sender and the viewer share a geohash-6 and slots are open: "You two are on the same block. {slots_open} Founding Neighbor slots still open, closes {date}." Otherwise unchanged. Fail closed: absent or failed window → no line (see F9).

*Rotating headline.* `pickAha` accepts `{ date, state }` and consults a small `SEASONAL_HEADLINES` table (in `placePreviewService.js`; date-ranged, not month-only) before the default ranking:
- Sept 20 – state deadline: `election_deadline` rows for the state (F6 seeds) with `days_until ≤ 30` → "Voter registration for November 3 closes {date} in {state}." follow-up "Moved recently? Registration is per address."
- Apr 1–30 and Oct 1–31: `property_tax` / `tax_appeal` rows within 30 days → "Property tax due {date}." / "Assessment appeal window closes {date}."
- Jan 1–31: radon zone 1 → existing radon aha, follow-up gains "{State} offers free test kits" with `program_url` from a new per-state map in `composeLeadRadon` (F12 data).
- Jun 15 – Sep 30: AQI ≥ 101 today or wildfire hazard High → existing air/wildfire aha.
- Otherwise the existing ranking. The calm fallback ("Quiet on every layer") is unchanged.

*Positioning line.* One constant on each platform: web `frontend/packages/types/src/copy.ts` `POSITIONING_LINE = "See what's true about your address."` and `POSITIONING_CONTRAST = "Nextdoor is what your neighbors say. Pantopus is what's on record about your address."`; iOS and Android string resources. The contrast line appears under the hero lede on `/start` and in the OG footer.

*Funnel.* Migration adds `t0_compare_viewed` and `session_open` (§5) to `funnelevent_type_check`, mirroring `196_funnel_event_aha_share.sql`; `funnelEvents.js`, `funnel.ts`, `funnelReport.js` gain the types and a `compare` rate.

**States.** Invalid or expired token: render the normal `/start` with a quiet banner "That comparison link has expired. Type an address to see your own place." Token valid but preview fails for the sender's city: show the token's chips (they are self-contained). Recipient preview errors: existing copy.

**Privacy and honesty.** The token holds grades, city, an optional first name and a headline. It cannot be turned into an address. The recipient compares only their own address; there is no "look up a third address" path. The card never says "your neighbor's house": copy is about places and sources. The anonymous route still persists nothing.

**Acceptance.**
- A compare link opened on a fresh browser shows the sender's column and, after typing an address, both columns and the recipient's aha; `t0_compare_viewed` and `t0_aha_viewed` are recorded with the same `anon_id`.
- A tampered token renders the expired banner.
- `GET /api/og/place?vs=` renders two columns and is cacheable; without `vs` the image is byte-identical to today.
- In October, a Washington address shows the registration headline with the seeded deadline and its source; in January, a Zone 1 county shows the kit link.

**Effort.** Backend 2–3 days; web 3–4 days; OG 1 day; natives 1 day each; seeds per F6/F12.

**Tests.** `frontend/apps/web/tests/startFunnel.test.tsx`, `backend/tests/publicPlace.test.js` (anti-leak assertions must still pass), `backend/tests/funnelEvents.test.js`, `backend/tests/unit/foundingWindow.test.js`, a token sign/verify unit test.

### F9. The hygiene set

Ship before inviting anyone. All items are cited in §3.

| Item | Change | Test |
|---|---|---|
| Coordinate leak | In `applyPostLocationPrivacy` (`feedService.js:251-271`), inside `if (!isAuthor)`, set `effective_latitude/longitude` to the already-jittered values. Verify distance computations that read `effective_*` (`:911, 1181, 1279`) run before privacy is applied. Apply on `GET /api/posts/:id` for anonymous viewers too. | New case in `postSavedPrivacyContract.test.js`; `feedService.test.js` |
| Founding label fails open | `public.js:557` default `false`; flip the `foundingOpen = true` defaults in `placePreviewService.js:64,188,198` to `false`. | Rejection case next to `publicPlace.test.js:264` |
| Hide cash Earn | `hub.js:410-417`: push the `inbox_offers` item only when the user has an `EarnTransaction` with status `available` or `paid`. Native routers (`HubTabRoot.swift:707,1012`, `RootTabScreen.kt:2426,5571`), mailbox drawer CTAs and web `MailboxNav` entries gated on the same condition; `/earn/*` routes return 404 unless the user has such a transaction. Deep link `pantopus://mailbox/earn` degrades to the mailbox. | `hubContext.test.js`; iOS `EarnViewModelTests` |
| Curator label | Add `origin` to web `Post`, iOS `FeedPostDTO`, Android `FeedPostDto`; render a "Pantopus curator" chip and the "Source:" line on the three post cards; keep report/mute available. | Decoding fixtures `FeedSampleData.*`; card snapshot tests |
| Seeder prompt | Remove the ENGAGEMENT block (`humanizer.py:51-55`) and the sports "read like something a neighbor might say" lines (`:105-108`); add tests asserting absence. Exclude `origin='curator'` rows from the taper RPC and from every "organic" count. | `tests/test_humanizer.py` |
| Referral tiers pay | `FEATURE_TIERS`: 1 referral → `+1` weekly postcard invite (`blockFoundersService.invites_remaining` reads converted referrals; cap 3 + min(referrals, 3)); 3 → cells-map detail; drop `priority_matching` until gig matching exists; rename tier 4 to "Block Builder" and update the three client mirrors. | `blockFounders.test.js:145,214,261-272`; new `inviteRewardService` test |
| One name | "Block Founder #N" = rank; "Founding Neighbor" = first-5 tier; referral tier renamed; the business `founding_badge` column is untouched. Remove the "permanent 0% marketplace fee" line from the wedge records. | Copy greps in `publicPlace.test.js:259-270` |

**Effort.** Two to three days total.

### F10. Mail snap (phase 2, after the pilot's first read)

**Goal.** Photograph a piece of paper mail; the app says what it is and when it is due, puts it on the address calendar, reminds you, and you mark it paid.

**Today.** See §3, "Mail". Requires a claimed home in v1 because `HomeBill` needs `home_id` and `can_manage_finance`; T1 users use F5 manual dates instead.

**Design.**
- `POST /api/mailbox/v2/mailday/items` accepts multipart `image` (reuse `validateAndStripUploads`, magic-byte check, EXIF strip). Store in the private bucket `HOME_DOCUMENTS_BUCKET` under `mail-snaps/{homeId}/{uploadId}/{sha256}`, never a public URL. Create a `Mail` row (`type` from classification, `content` = OCR text or "Photographed mail", `recipient_home_id`, `cover_image_url` = private key) and link it via `MailDayItem.mail_id`, so the existing route/junk/return flow and streak work.
- `agentService.extractMailFromImage` mirroring `draftListingFromImages` (`input_image` parts) with a typed schema `{ kind, payee, amount, due_date, account_last4?, confidence }`; persist to `Mail.key_facts`, `Mail.due_date`, `Mail.urgency`. With no `OPENAI_API_KEY`, the item still saves and the client asks for due date and amount by hand.
- Action `pay` in `POST /item/:id/action` upserts a `HomeBill` (`details.source_mail_id`, extraction confidence) and a `MailLink` of type `bill`; `remind` reuses `POST /p3/tasks/from-mail`.
- `composeForHome` merges unpaid `HomeBill` rows inside the window as calendar items ("Electric bill · $142 · due Oct 12 · Mark paid"), so bills appear everywhere the calendar renders. Reminders come from the existing `home_reminders.py` (day-before and day-of); the Node `mailDayNotification` job stays triage-only to avoid stacking.
- Clients: wire the existing "Scan today's stack" CTAs to the camera (iOS `SystemCameraPicker` from Unboxing; Android CameraX `TakePicture`), show extracted fields as editable chips ("Due Oct 12 · $142 · Clark PUD · Confirm"), and add a web Mail Day page with a file input `capture="environment"`. Fix the web bill delete status `cancelled` → `canceled`.
- Confirmation copy: "Added to your calendar. We'll remind you {lead} before." Never "Paid" until the user marks it.

**Privacy and honesty.** Bill photos hold account numbers: private storage, authenticated download, deletable with the bill; extraction is a suggestion the user confirms. Amounts and payees are never shown to non-finance members.

**Acceptance.** Photo → confirmed fields → bill on calendar → reminder → mark paid → appears under Paid, on all three platforms; with AI unavailable the manual path completes the same journey.

**Effort.** Backend 1 week; web 3–4 days; iOS and Android 1 week each.

### F11. The keeper, thin version (phase 2)

**Goal.** A named creature on Today whose mood is a truthful summary of obligations, that grows as the home file fills.

**Design.**
- Storage: `HomePreference.settings.keeper = { name ≤ 24, species ∈ {otter, owl, fox, heron, cat, dog}, created_at }` through the existing home settings routes; for T1 saved-place users, the same object on `UserNotificationPreferences.settings` (add a jsonb column in the F5 migration) keyed by saved place.
- Mood, computed in `GET /api/hub` from already-loaded `dueBills`, `dueTasks`, `statusItems` and the calendar: `relaxed` ("Nothing due this week."), `attentive` ("Recycling tomorrow."), `fidgeting` ("Tax due in 3 days."), `worried` ("A bill is overdue."). Fix the invalid `Mail` column names at `hub.js:221-260` first so the mail half of the mood is real.
- Growth: level = count of distinct facts on file (pickup day, dates, bills, documents, co-residents, verified); shown as "Ollie knows 6 things about this place", no streaks, no decay.
- Render: iOS `TodayDetailContent.kicker` slot, Android `TodayDetailUiState`, web `HubTodayCard`; Rive or Lottie avatar on web first. Naming sheet appears once on the second Today open: "Give your place a keeper" with species tiles and a name field; "Skip" persists.

**Honesty.** The keeper never expresses a state that is not derived from a record. It never nags to open the app.

**Effort.** Backend 2 days; web 3 days; natives 3 days each.

### F12. Appeal windows and radon kits (phase 2 data)

- Seed county-scoped `AddressCalendarRule` rows of kind `tax_appeal` for the 50 largest counties (title "Assessment appeal window closes", `source_url` the assessor page, `confidence 'unverified'` until checked). The calendar and the F8 headline read them without code changes beyond the kind.
- Per-state radon program map in `composeLeadRadon`: `program_url` and `free_kit: bool` (from state health department pages), surfaced as the radon aha follow-up in January.
- Assessment change from ATTOM only if display terms allow; otherwise the deadline alone.

**Effort.** Data verification 2–3 days per set; code hours.

---

## 5. Measurement and instrumentation

**Activation** is computed by query, not by a new event: a user is activated when, within 7 days of `t1_account_created`, they have a `SavedPlace` or Home, and (`daily_briefing_enabled` or `evening_briefing_enabled` or a widget snapshot written, reported by the client as an event) and one of: a pickup rule, an F5 date, or a second active occupant.

**Return with attribution.** Add one client-postable `FunnelEvent` type `session_open` with `meta { trigger: 'push'|'widget'|'email'|'compare'|'organic', kind?: 'pickup'|'briefing'|'bill'|'date'|'alert' }`, one per app open, written by all three clients. Triggers come from the push data payload `type`, the `?src=widget` deep link, `?src=email`, and `?vs=`. At pilot scale the row volume is trivial; add a 90-day retention sweep alongside the existing evidence sweep.

**Report.** Extend `funnelReport.js` with an `activation` block and a `returns` block (week-one, week-four, week-eight among activated, by trigger). Keep `GET /api/admin/funnel/summary` as the single read-out.

**Spread.** `compare` rate = `t0_share_clicked(method=compare)` ÷ `t0_aha_viewed`; hop = `t0_compare_viewed` ÷ compares; reveal = `t0_aha_viewed` with `vs` ÷ `t0_compare_viewed`.

**The honesty counter.** Count `DailyBriefingDelivery` rows whose pickup signal carried `confidence 'unverified'` and any user report tagged "not my schedule"; target zero pushes without the caveat.

---

## 6. Build order, migrations, flags, effort

**Order.** F9 (hygiene) → F1 (bridge) → F2 → F4 → F5 → F3 → F8 → F6 → F7 → pilot → F10 → F11 → F12.

**Migrations (all forward, additive; mirror into both migration directories per the repo convention).**
1. `funnel_event_compare_and_session` — CHECK gains `t0_compare_viewed`, `session_open`.
2. `home_member_household_defaults` — `HomeRolePermission` inserts for `member`.
3. `address_calendar_dates_and_saved_place` — kinds, `saved_place` scope, partial unique index, `lead_days` 0–60, `UserNotificationPreferences.settings jsonb`.
4. `home_occupancy_just_moved` — two columns.
5. `election_deadline_seeds_2026` and later `tax_appeal_seeds` — data only.

**Flags and env.** `COMPARE_CARD_KEYS_JSON` (keyring). No feature flag for the loop itself; the Earn gate is data-driven. `GOOGLE_CIVIC_API_KEY` stays optional; the voter step uses seeded deadlines.

**Effort summary (one person, web first).**

| Feature | Backend | Web | iOS | Android |
|---|---|---|---|---|
| F9 hygiene | 1.5 d | 0.5 d | 0.5 d | 0.5 d |
| F1 bridge | 0.5 d | 1 d | 1.5 d | 3 d |
| F2 checklist | 0.5 d | 0.5 d | 1 d | 1 d |
| F4 pickup push + gate | 2.5 d | — | — | — |
| F5 dates | 3 d | 1.5 d | 2 d | 2 d |
| F3 household | 2 d | 2 d | 3 d | 2 d |
| F8 compare + headline | 3 d | 4 d | 1 d | 1 d |
| F6 just moved + voter | 1 d + seeds 2 d | 1 d | 1 d | 1 d |
| F7 widgets | — | — | 6 d | 6 d |
| **Loop total** | **≈ 16 d** | **≈ 10.5 d** | **≈ 16 d** | **≈ 16.5 d** |
| F10 mail snap | 5 d | 4 d | 5 d | 5 d |
| F11 keeper | 2 d | 3 d | 3 d | 3 d |
| F12 data | 1 d + 5 d data | — | — | — |

Backend plus web for the loop is roughly six working weeks; each native platform adds about three. Ship backend and web first, run the pilot on web and iOS, and let Android follow.

---

## 7. Risks and open questions

1. **Invited co-residents counted as verified residents.** Resolved September 16 (decision 8): split into address-verified and household-verified; see F3b. Ship F3b with F3 so the easier invite never widens the attested unlocks.
2. **Permission defaults invalidate pending invites.** Accepted; the message exists. Ship the migration in a quiet window and tell pilot households.
3. **Evening gate reduces pushes for everyone.** Expected; the honesty counter and `low_signal_day` skips are the evidence. Announce in release notes.
4. **Location precedence.** `saved_place` sits below every home and pinned source; a test must cover a user with both.
5. **Compare token exposure.** A token reveals four grades and a city. Documented on the compare sheet: "This card shows grades and your city, never your address."
6. **Seeded deadlines can be wrong.** All state and county rows ship `unverified` with a source link and the calendar's existing "(unconfirmed)" treatment until checked by hand.
7. **Widgets show stale data.** Accepted, mirrors the shipped widgets; the render-time date rule prevents "tomorrow" lying.
8. **Three-platform drift.** Copy lives in this document; each platform's PR links the section it implements. Natives may lag web by a sprint; the pilot recruits web and iOS first.
9. **Hub mail counts are silently wrong** (`hub.js:221-260` references nonexistent columns). Fix before the keeper reads them.
10. **Rate limits.** The compare token endpoint shares the 60/min per-IP preview limit; OG crawlers hitting two-column cards double upstream calls; the `Cache-Control` on the image mitigates.

---

## 8. Appendix: files and tests per feature

**F1.** `backend/services/context/locationResolver.js`, `backend/routes/savedPlaces.js`, `backend/services/context/providerOrchestrator.js` (cache clear), `frontend/apps/web/src/app/(app)/app/hub/today/page.tsx`, `frontend/apps/web/src/components/place/detail/TodayDetail.tsx` (opt-in move), `frontend/apps/ios/Pantopus/Features/Place/Detail/AddressTodayTabView.swift`, `frontend/apps/ios/Pantopus/Core/Networking/Endpoints/SavedPlacesEndpoints.swift`, Android new `SavedPlacesApi.kt`, `ui/screens/place/today/TodayTabViewModel.kt`. Tests: `backend/tests/hubContext.test.js`, `backend/tests/unit/savedPlaces.routes.test.js`, `frontend/apps/web/tests/savedPlaceContext.test.tsx`.

**F2.** `backend/routes/hub.js:188-199`, `frontend/apps/web/src/components/place/SetupBanner.tsx`, native Today roots.

**F3.** New migration; `backend/routes/home.js:2706-2745, 2440-2479`; `backend/services/notificationService.js:44-47, 221-235, 530`; `frontend/apps/web/src/app/(app)/app/homes/[id]/dashboard/page.tsx`, `members/page.tsx`, `homes/page.tsx`; `frontend/apps/ios/Pantopus/Features/Homes/Members/InviteMemberWizardViewModel.swift`; Android `HomeInvitationSenderContent.kt`. Tests: `supabase/tests/home-member-*.test.sql`, `backend/tests/unit/homeInvitation*.test.js`, `backend/tests/integration/homeOnboarding.test.js`.

**F4.** `backend/services/context/eveningBriefingService.js:153-172, 304-327`, `backend/services/context/providerOrchestrator.js:576-660`, `pantopus-seeder/src/handlers/alert_checker.py:168-210`. Tests: `backend/tests/hubContext.test.js`, `backend/tests/unit/internalBriefing.test.js`.

**F5.** New migration; `backend/services/addressCalendarService.js:49-58, 109-181`; `backend/routes/addressCalendar.js`; new saved-place calendar routes; `pantopus-seeder/src/handlers/home_reminders.py`; `frontend/apps/web/src/components/place/AddressCalendarCard.tsx`; iOS `PlaceTodayDetailContent.swift`; Android `PlaceTodayDetailContent`. Tests: `backend/tests/unit/addressCalendar.test.js`, `addressCalendarSeeds.test.js`.

**F6.** New migration; `backend/services/homeDetailService.js:16`; `JustMovedCard.tsx/.swift/.kt`; seed file for `election_deadline`.

**F7.** iOS `Pantopus/Core/Widgets/*`, `PantopusWidgets/*`, `project.yml`; Android `data/widget/WidgetSnapshotStore.kt`, `widget/TodayWidgetProvider.kt`, manifest, `res/xml`, `res/layout`, `res/values/strings.xml`.

**F8.** `backend/routes/public.js`, `backend/services/placePreviewService.js`, `backend/services/place/foundingWindow.js`, `backend/services/funnelEvents.js`, `backend/services/funnelReport.js`, new `backend/utils/compareCardToken.js`, `frontend/apps/web/src/app/start/page.tsx`, `frontend/apps/web/src/components/place/StartFunnel.tsx`, `frontend/apps/web/src/app/api/og/place/route.tsx`, `frontend/packages/api/src/endpoints/funnel.ts`, `frontend/packages/types/src/copy.ts` (new), `PlacePreviewBody.swift`, `PlaceLaunchScreen.kt`. Tests: `frontend/apps/web/tests/startFunnel.test.tsx`, `backend/tests/publicPlace.test.js`, `backend/tests/funnelEvents.test.js`.

**F9.** Listed in the table in §4.

**F10.** `backend/routes/mailDay.js`, `backend/services/ai/agentService.js`, `schemas.js`, `prompts.js`, `backend/routes/mailboxV2.js:452-478`, `backend/services/addressCalendarService.js`, `backend/services/homeClaimEvidenceStorage.js` (new key prefix), web Mail Day page, iOS `YouTabRoot.swift:1020` / `HubTabRoot.swift:2845`, Android `RootTabScreen.kt:5617`.

**F11.** `backend/routes/hub.js:221-260, 441-454`, home settings routes, `HubTodayCard.tsx`, `TodayDetailContent.swift`, `TodayDetailUiState.kt`.

**F12.** Seed files; `backend/services/placeSectionAdapters.js:275-317`.
