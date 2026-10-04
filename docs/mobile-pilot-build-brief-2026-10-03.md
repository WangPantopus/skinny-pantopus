# Mobile pilot build brief

**Date:** October 3, 2026. **Checked against:** `master` at `2f7bea45f`. Line numbers are anchors from that commit; if code moved, find the same symbol before changing anything.
**Status:** the founder-approved build instructions for the pilot. Agents build from this file. [NEXT_STEPS.md](../NEXT_STEPS.md) tracks status and points here.
**Platforms:** iOS and Android, plus the backend, database and seeder changes the apps need. No web interface work.

---

## 0. Read this before you start

### 0.1 What this brief is

This brief is the founder's authorization for the new behavior in sections 3 to 10. It meets the "verified gap or concrete unmet requirement" condition in [AGENTS.md](../AGENTS.md) for that behavior. Every other AGENTS.md rule still governs how you build it: find the existing screen, caller, endpoint, service and table first; extend in place; no parallel tables; forward migrations only; keep existing screen designs unless a package below says otherwise.

### 0.2 Scope rules

1. **Mobile only.** Build interface changes on iOS (`frontend/apps/ios/Pantopus`) and Android (`frontend/apps/android/app/src/main/java/app/pantopus/android`). Do not change any web page, component or route under `frontend/apps/web`. The current web must keep working, so every API change is additive: new optional fields and new routes, never a removed or renamed field.
2. **Backend is in scope.** Express routes and services in `backend/`, SQL migrations in `supabase/migrations/`, and the seeder in `pantopus-seeder/` change wherever a package says so.
3. **Build exactly the packages below.** The [first-person loop design](first-person-loop-design-2026-09-16.md) describes larger versions of several of these features. Where this brief and that design differ, this brief wins.
4. **Nothing from section 13,** even where a design export or the loop design describes it.
5. **Copy is exact.** Use the strings in this brief word for word on both platforms. If a string doesn't fit, shorten it with the same meaning and record the change in your PR body.

### 0.3 Sources, in order of authority

1. This brief.
2. The September 26 amendments to the loop design, `docs/launch-boundary-2026-09-26/design-amendments/first-person-loop-amendments.md` ([PR 1499](https://github.com/WangPantopus/skinny-pantopus/pull/1499) until merged). This brief already carries every part of them this build needs.
3. The [first-person loop design](first-person-loop-design-2026-09-16.md), for detail this brief points to by section.
4. The Claude Design exports in `docs/design/exports/<surface>/`, reviewed in `docs/design/exports/VERIFICATION.md`, for the look of the screens listed in section 12. Ignore every export for a feature in section 13.
5. The shipped app, for everything else.

### 0.4 How work moves

- **Ownership and merges.** The live coordination guide is `docs/workstreams/README.md` on the `codex/workstream-coordination` branch. Stream 1 runs the only merge queue and assigns these packages; section 11 proposes an owner for each. Shared files (routes, navigation, contracts, Place, design tokens, notification plumbing) have one named writer per patch, with review by the other affected owner.
- **Migrations.** Ask Stream 1 for a migration number before you create the file. Every new migration contains `Backwards compatible: yes.` with a reason, sets `SET LOCAL lock_timeout='5s';`, revokes EXECUTE on any SECURITY DEFINER function from PUBLIC, anon and authenticated, and enables row-level security on any new table (`scripts/db/check-migrations.cjs`). Never edit an applied migration.
- **Runtime and devices.** Use your stream's runtime and the lease rules in the guide for shared runtimes, simulators and emulators.
- **Done means verified in the apps.** A package is done when its acceptance checks pass on the iOS simulator and the Android emulator, through the real API and database of your stream's runtime, with your stream's usual evidence and seal. CI is informational. Keep running lint and the existing targeted tests for code you change.
- **Decisions.** If something here is ambiguous, choose the option that keeps people's data private and the copy honest. Record what you chose, why, and what you rejected in your PR body and your stream's status file, and keep going. That is the founder's standing instruction.
- **Hard limits.** Never touch the founder's environment, never put secrets or credentials in Git or chat, keep Stripe in test mode, and run no destructive git commands.

### 0.5 Words used in this brief

- **Home:** a Home the person can act for. Either *shared* (`access_kind = 'shared'` in `GET /api/homes/my-homes`) or a *private setup* the person created (`access_kind = 'private_setup'`). A newly added home stays a private setup until it is verified. The server already lets a private-setup creator set pickup days and create tasks (`supabase/migrations/20260910003000_home_pickup_private_access.sql:30-50`, `20260910060000_home_record_transactions.sql:74-85`).
- **Saved place:** a `SavedPlace` row: a private bookmark of an address, with no Home.
- **Confirmed pickup day:** a pickup rule with scope `home`, written through `PUT /api/homes/:id/calendar/pickup-day`. City rules are defaults and stay unconfirmed.
- **Today tab:** iOS `AddressTodayTabView` (`Features/Place/Detail/AddressTodayTabView.swift`) inside `TodayTabRoot` (`Features/Root/RootTabView.swift:320-385`); Android `TodayTabScreen` and `TodayTabViewModel` (`ui/screens/place/today/`).

---

## 1. What the pilot tests

- **Promise:** "Know what matters for your home, and stay on top of it."
- **First customer:** first-time homeowners in Vancouver, Camas and Washougal, recruited by hand. Anyone can still sign up anywhere.
- **Hypothesis:** a household keeps Pantopus when it catches something relevant the household wasn't tracking, and reminds them reliably about what recurs. The address preview is how people arrive; it is not why they stay.
- **What would show it:** households handle at least one responsibility through Pantopus in week four and in week eight. App opens are not the measure.
- **Shape:** five households once one full journey works on the hosted backend and a scheduled reminder has reached a physical phone; then 30 to 50 after two pickup weeks with no wrong or missed reminder; eight weeks per household.

## 2. The journeys and the packages that build them

| Journey | What the household experiences | Packages |
|---|---|---|
| Arrival | Saves their address or adds their home, and Today works at once | WP2, WP5 |
| J1 · Pickup | Confirms pickup days; the evening before each pickup, one push with a "Bins out" button; holiday weeks move the day; quiet evenings send nothing | WP3 |
| J2 · Radon | Today asks whether radon was tested; "No or not sure" becomes a dated task and a reminder with "Done" and "Not now" | WP4 |
| J3 · Household | The owner invites a co-resident, who sees the radon task and completes it; the owner hears | WP6 |
| Everywhere | Truthful surfaces, measurement, and reliable Support Train reminders | WP1, WP7, WP8 |

---

## 3. WP1 · Finish the truthfulness fixes (F9)

**Proposed owner:** Stream 1. **Depends on:** nothing.

**3.1 Hide the Hub's "Earn today" pill.**
- Backend: `backend/routes/hub.js:451-458` pushes the `inbox_offers` status item ("N offers available", subtitle "Earn today") whenever unread ad or newsletter mail exists. Push it only when `isLaunchFeatureEnabled('mail_extras')` (`backend/utils/featureFlags.js:38`).
- Apps: no change. iOS shows whatever the server sends (`Features/Hub/HubViewModel+StatusStrip.swift:80-82` doesn't filter it); Android likewise.
- Acceptance: with production launch flags (`mail_extras` off) and unread ad mail, neither app shows an "Earn today" pill. Unread personal mail still shows its own row.

**3.2 Label curator posts.**
- Backend: no change. Feed rows already carry `origin` with `user`, `curator` or `system` (`backend/services/feedService.js:241`).
- iOS: decode `origin` in `FeedPostDTO` (`Core/Networking/Models/Feed/FeedDTOs.swift:14`), carry it through `PulseFeedViewModel.project` (`Features/Feed/PulseFeedViewModel.swift:804`), and show the chip on `PulsePostCard` (`Features/Feed/Pulse/PulsePostCard.swift:179`).
- Android: add `@Json(name = "origin") val origin: String? = null` to `FeedPost` (`data/api/models/feed/FeedDtos.kt:12`); add the chip in `PulseFeedViewModel.projectCard` (`ui/screens/feed/pulse/PulseFeedViewModel.kt:978`) the way the "Visitor" label is added (`:1059`); render it in `PulsePostCard` (`ui/screens/feed/pulse/PulsePostCard.kt:131`).
- Render it as a chip, as drawn in the `f9-curator-chip` export, in the spot where the "Visitor" text appears (iOS `PulsePostCard.swift:488`; Android `PulseFeedViewModel.kt:1055-1061`). "Visitor" is plain meta-line text, so the chip is new UI there.
- Copy: chip **"Pantopus curator"**. The post's own "Source: …" line stays. Report and mute stay available.
- Do not use `is_seeded` / `isSeeded`: that flag marks system fact posts, not curator posts.
- Acceptance: a curator post shows the chip on both apps; a neighbor's post doesn't.

**3.3 Seeder prompt lines.**
- `pantopus-seeder/src/pipeline/humanizer.py:51-55`: delete the ENGAGEMENT block, which tells the model to end posts with a question to locals.
- Same file, `:105`: delete "It should read like something a neighbor might say, NOT like ESPN copy." Keep the rest of the sports lane.
- Curator exclusion: taper metrics already exclude curator posts by account type (`get_seeder_tapering_metrics`, baseline migration `:5067-5108`). Check `backend/services/funnelReport.js` and the density counts behind the unlock meters. Exclude `origin = 'curator'` only where curator posts are counted. Record what you found either way.
- Acceptance: five non-sports posts from a fresh seeder run contain no closing question and no neighbor-voice phrasing. Sports posts keep their question format (`humanizer.py:107-108`).

## 4. WP2 · Today works for a saved place and a newly added home (F1)

**Proposed owner:** 4-1. **Depends on:** nothing.

**Why:** both apps show "Today starts at your address" unless the person has a *shared* home (`sharedHomes`: iOS `Core/Networking/Models/Homes/HomeDTOs.swift:149`, Android `data/api/models/homes/HomeDtos.kt:102`). Someone who saved an address, or who added their home and is still in private setup, gets nothing.

**Backend**
1. **Saved place as a location.** In `resolveLocation` (`backend/services/context/locationResolver.js:224`), after the home fallback (`:327`) and before the unpinned viewing location (`:329`), resolve the user's newest `SavedPlace` (by `created_at`) with source `saved_place`. Add `saved_place: 0.60` to `CONFIDENCE` (`:19`). A home always wins (founder ruling, September 22). The saved place goes before the unpinned viewing location because anyone who once picked a feed area has a `UserViewingLocation` row (`PUT /api/location`, `backend/routes/location.js:150`); otherwise the saved-place chip would sit over feed-area weather.
2. **Saving a place.** In `POST /api/saved-places` (`backend/routes/savedPlaces.js:25`), after a successful upsert:
   - If the user has no `UserNotificationPreferences` row, insert one with `daily_briefing_enabled = false` and `evening_briefing_enabled = false`. Never change an existing row. The column default for the evening briefing is true and `pantopus-seeder/src/handlers/briefing.py` schedules everyone with a row, so without this a saved place would start nightly pushes.
   - Call `clearHubTodayCache(userId)` (`backend/services/context/providerOrchestrator.js:159`). Also call it in `DELETE /api/saved-places/:id` (`:69-83`), which doesn't today.
   - In `PUT /api/hub/preferences` (`backend/routes/hub.js:801-811`), which upserts: when it creates a new row for an account that has a saved place and no home, insert `evening_briefing_enabled: false` unless the request sets it. The column default is true (baseline `:14981`), so the morning card's first write would otherwise start evening pushes.
3. **Place data for a private setup.** `GET /api/homes/:id/intelligence` (`backend/routes/placeIntelligence.js:45`) returns 403 unless `checkHomePermission(..., 'home.view')` grants access, which a private setup never gets. When access is denied, allow the request if the home is the caller's private setup: `home_record_context(home, user)` returns `allowed` and `private` true and `Home.created_by_user_id` is the caller, the same test as `backend/services/homeListService.js:78`, and the home isn't blocked by the rules at `:69-72` (archived or merged home, disputed owner, revoked owner with no verified owner). Pass the denied `access` object through unchanged. `resolveTier` then returns `T1` (`backend/services/placeIntelligenceService.js:61`), so only band A sections are available: weather, air, the address calendar, radon and the other public readings. Every household section stays locked.

**iOS**
4. **Which home Today shows.** `AddressTodayTabView.resolveHome` (`AddressTodayTabView.swift:122-140`) picks from `sharedHomes`. New order: the shared home where the person is primary owner, then any shared home, then their newest `private_setup` home by `created_at`. Never use a home whose `access_kind` is `verification`; it carries no access.
   - **Re-resolve every time.** Today currently resolves once and keeps the result (`AddressTodayTabView.swift:122-126`: "A successful one is final for this view's life"). Re-resolve the home and saved place each time the Today tab appears and after the Add Home flow finishes, so Today switches to a newly added home.
5. **Saved-place Today.** With no home, call `SavedPlacesEndpoints.list()` (`Core/Networking/Endpoints/SavedPlacesEndpoints.swift:15`). If a saved place exists, show the live Today content (`TodayDetailViewModel.fetchLive`, `GET /api/hub/today`, `Features/Hub/Today/TodayDetailViewModel.swift:113-157`) inside the Today tab, with the chip and the reminders row below. Keep "Today starts at your address" (`AddressTodayTabView.swift:67-96`) only when there's neither a home nor a saved place.
6. **Morning opt-in card** on the saved-place Today. Add `daily_briefing_prompted_at` (decode, optional) and `daily_briefing_prompted` (encode, optional) to the preferences DTOs (iOS `NotificationPreferencesDTOs.swift:110-123`; Android `NotificationPreferencesDtos.kt:34-51`); the server already accepts and returns them (`hub.js:766`). Show the card only while `daily_briefing_prompted_at` is null, and send `daily_briefing_prompted: true` when it is first displayed. "Not now" only hides it. "Turn on" sends `daily_briefing_enabled: true` and the device's IANA time zone as `daily_briefing_timezone` through `PUT /api/hub/preferences`.

**Android**
7. **Which home Today shows.** `TodayTabViewModel.resolvePrimaryHome` (`TodayTabViewModel.kt:77`) uses `myHomes().sharedHomes`. Same order and rules as iOS, private setup last, never `verification`. The view model caches `homeId` and skips reloading (`:44-47`, `:54`); re-resolve when the tab appears and after Add Home finishes, as on iOS.
8. **Saved-place Today.** Use `SavedPlacesRepository` (`data/saved_places/SavedPlacesRepository.kt:20`; the API client already exists). With a saved place and no home, render the hub Today content (the content evening and morning briefing pushes open, mapped by `ui/screens/hub/today/TodayDetailMapper.kt`) inside the Today tab, with the chip and the reminders row. Keep `NoPlaceCard` (`TodayTabScreen.kt:110`) only when there's neither.
9. **Morning opt-in card** through `NotificationPreferencesApi` (`data/api/services/NotificationPreferencesApi.kt:22,32`), as on iOS.

**Copy**
- Chip: **"Saved place · Only you"**
- Reminders row: title **"Get reminders for this address"**, body **"Pickup and radon reminders need your home on Pantopus."**, button **"Add your home"**, which opens the existing Add Home flow (iOS `AddHomeWizardView`, `Features/Homes/AddHome/AddHomeWizardView.swift:17`; Android `ChildRoutes.ADD_HOME`).
- Morning card: title **"A morning heads-up?"**, body **"Weather, air and alerts for this address, only when something's worth knowing."**, buttons **"Turn on"** and **"Not now"**.

**Do not** build a place chooser or "Your places", change the Place tab, or ask for location permission.

**Acceptance**
- A new account with no home saves its previewed address after sign-in (the existing pending-place "Save privately"). Today on both apps shows that address's weather, air and alerts with the chip. The chip shows only when `location.source` is `saved_place`. `GET /api/hub/today` reports `location.source = 'saved_place'`.
- That user gets no briefing push that evening or the next morning.
- The same user adds their home in the same session. Today switches to the home and shows the address calendar card. Until WP3 item 7a lands, Android shows its existing pickup prompt and iOS the open editor; after it, both open the pickup editor.
- A user with a shared home and a saved place sees the home on Today.
- A private-setup home's Today never shows a household section.

## 5. WP3 · Night-before pickup reminders people can act on (F4)

**Proposed owner:** 4-1 for the backend and Today; the shared notification-action plumbing (item 10) goes to one writer Stream 1 names, Stream 5 by default because it owns notifications. **Depends on:** WP2.

**Backend**
1. **A pickup signal for the evening briefing.** `composeEveningBriefing` (`backend/services/context/providerOrchestrator.js:578`) already fetches the address calendar and passes it to `selectEveningSignal` (`backend/services/context/eveningBriefingService.js:304`), which drops it. Accept `addressCalendar` there and add `buildTomorrowPickupSignal(addressCalendar, timeZone, recentBriefings, now)`:
   - take `addressCalendar.upcoming` events with `days_until === 1`, kind in `garbage`, `recycling`, `yard_waste`, `bulk_pickup`, and `scope === 'home'` only;
   - combine the kinds into one signal built with `createSignal('address_calendar', 0.66, …)`, label from the copy below, data `{ identity: 'pickup:<date>', kinds, date, homeId, moved }` (`hasRecentSignalIdentity` matches `data.identity` only, `eveningBriefingService.js:88-94`), where `moved` holds the `holiday` and `shift_days` of a moved occurrence, if any;
   - skip it when `hasRecentSignalIdentity` shows it was already sent;
   - **the pickup signal leads the evening push whatever the scores.** `selectEveningSignal` sends only the top-scoring signal, and several outrank 0.66: an alert (0.70 or 0.90), a calendar event (0.74), a bill (0.72), an urgent or high-priority task (0.70) (`:131-217`, `:322-323`). Only an alert whose severity isn't `moderate` (score 0.90) beats a pickup. Everything else keeps its Hub Today row.
2. **Quiet evenings send nothing.** In `composeEveningBriefing`, remove the third pass that falls back to the evening tip. Return `emptyBriefingResult('low_signal_day')` unless the selected signal's `costOfInaction` (`backend/services/context/usefulnessEngine.js`, exported) is at least `MIN_PUSH_COST` (`providerOrchestrator.js:92`). A weather line alone never sends. A `local_update` signal (cost 0.30, which passes the 0.25 gate) never leads an evening push either.
3. **The pickup push.** In `POST /api/internal/briefing/send` (`backend/routes/internalBriefing.js:133`, push at `:286-297`), when the lead signal is the pickup signal: title is the signal label; body is "Bins out tonight." plus the holiday sentence when a day moved; add `data.category = 'PICKUP_REMINDER'`, `data.pickupDate` and `data.homeId`, and set both `data.link` and `data.route` to `'/app/today'`. Every other briefing keeps its current title and payload.
4. **Category on iOS pushes.** `backend/services/push/apnsClient.js:84` `buildPayload`: when `data.category` is present, set `aps.category` to it. `backend/services/push/fcmClient.js:92` already carries every data key.
5. **City defaults never push, and pickups push only in the evening.** The primer promises "Nothing on other days", and today the morning briefing can lead with a pickup: `generateAddressCalendarSignals` scores it 0.62 with cost 0.60, which clears the push gate (`providerOrchestrator.js:541-551`), so a household with both briefings on would hear about one pickup up to three times.
   - In `generateAddressCalendarSignals` (`usefulnessEngine.js:277`), skip `garbage`, `recycling`, `yard_waste` and `bulk_pickup` events whose `scope` isn't `home`, and skip `pickup_holiday` items; the moved pickups carry the holiday. They all still show on the Place Today card. For other unconfirmed kinds, replace the pickup-specific suffix (`:313`) with " (Unconfirmed.)". `street_sweeping` keeps its score and can still push; its unconfirmed suffix becomes " (Unconfirmed.)" too.
   - In `composeMorningBriefing` (`providerOrchestrator.js:466`), choose the push's lead from the ranked signals without `address_calendar` signals whose `data.kind` is one of those four pickup kinds. Hub Today keeps listing them.
6. **Holiday moves.** One migration:
   - widen `AddressCalendarRule_kind_chk` with `pickup_holiday`;
   - add `params jsonb NOT NULL DEFAULT '{}'::jsonb` to `AddressCalendarRule`.
   A holiday is one city-scope row: kind `pickup_holiday`, `rrule 'FREQ=DAILY;COUNT=1'`, `dtstart` on the holiday, `params {"holiday":"Thanksgiving","kinds":["garbage","recycling","yard_waste"],"shift_days":1}`, a title such as "Thanksgiving: pickup moves one day later", `source`, `source_url` and `confidence`.

   In `backend/services/addressCalendarService.js`:
   - Add `params` to the `loadRules` select (`:62-71`).
   - `expandRule` (`:86`) already builds `new RRule({...options, dtstart, until})` from `RRule.parseString(rule.rrule)` with a noon-UTC `dtstart`. Keep that, and add the rule to a `new RRuleSet()` so dates can be removed and added. Do not switch to `rrulestr`: it ignores the `dtstart` option (verified).
   - For each `pickup_holiday` row in scope, every occurrence of a kind listed in its `params.kinds`, from the holiday through the following Saturday, gets an `exdate` at its noon-UTC instant and an `rdate` moved by `shift_days`. This applies to household and city rules alike.
   - A moved occurrence in `upcoming` carries two new fields: `moved_from`, the original date, and `holiday`, from `params.holiday`. Both are additive; current clients ignore them.
   - The holiday row also appears in `upcoming` as an information item with its title.
7. **Holiday data.** Once the founder has confirmed each provider's rules by hand (NEXT_STEPS section 2), add the rows for Camas, and Vancouver or Washougal if pilot households live there, as a data migration with sources, before November 20. Today Camas is the only city with pickup rows (garbage, recycling and council, all unconfirmed). Every state also has state-scope `property_tax` rows (`supabase/migrations/20260908234527_reference_baseline.sql:10-11` for Washington, `official`), so a Washington home's `address_calendar` section is `ready` even with no pickup rules.

**iOS and Android**
7a. **Set a pickup day where the city has no pickup rows.** For a Vancouver or Washougal home the section is `ready`, because of the state property-tax rows, with `needs_pickup_day` true and no pickup events. iOS already opens the editor in that state (`PlaceTodayDetailContent.swift:463`); Android only shows `PickupPrompt` (`PlaceTodayDetailContent.kt:436-438`), and with nothing due in two weeks both say "Nothing on the calendar for the next two weeks.", which reads as an all-clear.
   - Android: start `AddressCalendarCard` with `picking = data.needsPickupDay`, as iOS does. Keep the "Pickup schedule" toggle.
   - Both apps: while `needs_pickup_day` is true and no `upcoming` event has kind `garbage`, `recycling`, `yard_waste` or `bulk_pickup`, show **"Set your pickup day and your pickups start here."** If the list is empty, it replaces "Nothing on the calendar for the next two weeks." (iOS `:496-497`; Android `UpcomingEvents`, `:500-503`); otherwise it goes above the list.
   - Rare case, a home with no city or a state with no rows: the server returns the section `unavailable` and unavailable sections carry no data (`backend/serializers/placeIntelligenceSerializer.js:104`). Then load `GET /api/homes/:id/calendar` (iOS `AddressCalendarEndpoints.calendar(homeId:)`, `Core/Networking/Endpoints/HomesEndpoints.swift:721`; Android `PlaceApi.addressCalendar`, `data/api/services/PlaceApi.kt:48`; Android only when `viewModel` isn't null). The route answers only someone who may read the calendar (`getPickupContext`) and returns `needs_pickup_day`, `pickup_version` and `rule_count` whatever the count. Render the existing card with it and the line above. If the request fails, keep the fallback card.
   - Don't change the server's section status or the web.
8. **Pickup primer on the first save.** After a home's pickup schedule is saved for the first time (iOS `AddressCalendarCard.choose`, `Features/Place/Detail/PlaceTodayDetailContent.swift:653-686`; Android `PickupScheduleEditor` "Save schedule", `ui/screens/place/detail/PickupScheduleEditor.kt:87`), show the primer once per home; record it on the device under `pickupPrimer.shown.<homeId>`. "Not now" sends nothing. "Remind me" sends `evening_briefing_enabled: true` and `daily_briefing_timezone` through `PUT /api/hub/preferences`, then asks for notification permission if the system hasn't decided: Android 13+ `POST_NOTIFICATIONS`; iOS already asks at launch (`App/AppDelegate.swift:49-74`). If notifications are denied, "Remind me" still saves the preference and then shows **"Notifications are off for Pantopus. Turn them on in Settings."** with a button **"Open Settings"** that opens the system settings for the app.
9. **Unconfirmed rows on Android.** Android parses `confidence` but never shows it (`data/api/models/place/PlaceIntelligenceDtos.kt:1047`). Show the suffix iOS already shows, " · unconfirmed, please double-check" (`PlaceTodayDetailContent.swift:617-620`).
10. **Notification actions. This is shared plumbing with one writer.** Register at app launch:
    - iOS: `UNNotificationCategory` `PICKUP_REMINDER` with action `BINS_OUT` ("Bins out", runs in the background); `TASK_REMINDER` with `TASK_DONE` ("Done", background, requires the device to be unlocked) and `TASK_NOT_NOW` ("Not now", opens the app). Handle them in `userNotificationCenter(_:didReceive:)` (`App/AppDelegate.swift:143-174`).
    - Android: in `NotificationDispatcher.dispatch` (`push/NotificationDispatcher.kt:99`), when `data.category` is set, add the matching `NotificationCompat.Action`s. Background actions go to a new `BroadcastReceiver` registered in the manifest; "Not now" uses an activity intent with the task deep link.
    - "Bins out" sends `reminder_action` with `{kind: 'pickup', action: 'bins_out', date}` (WP7). Nothing else changes.
11. **Where the push lands.** `/app/today` must open the Today tab itself. Today both routers strip `app` and treat `today` as an alias of `hub-today`: Android `core/routing/DeepLinkRouter.kt:648`, `:683-685` sends it to the briefing detail (`ui/screens/root/RootTabScreen.kt:2436-2441`), and iOS `Core/Routing/DeepLinkRouter.swift:487`, `:603` maps it to `.hubToday(nil, nil)`. Split it on both: `today` (from `/app/today`) → a new `TodayTab` destination that selects the Today tab root; `hub-today` and `hub_today` keep opening the briefing detail. Android must not navigate to `ChildRoutes.todayDetail` for `/app/today`.

**Copy**
- Push title by kinds tomorrow: **"Garbage tomorrow"**, **"Recycling tomorrow"**, **"Yard waste tomorrow"**, **"Bulk pickup tomorrow"**. Several kinds always go in the order garbage, recycling, yard waste, bulk pickup, with only the first word capitalized: two **"{A} and {B} tomorrow"** ("Garbage and recycling tomorrow"), three or more **"{A}, {B} and {C} tomorrow"**.
- Push body: **"Bins out tonight."** When a pickup in the push was moved: **"Bins out tonight. Moved a day for {holiday}."**, or **"Bins out tonight. Moved for {holiday}."** if `shift_days` isn't 1.
- Primer: title **"Get a reminder the night before?"**, body **"One notification the evening before each pickup. Nothing on other days."**, buttons **"Remind me"** and **"Not now"**.
- Action: **"Bins out"**.

**Do not** add a new job or schedule, or let a city default push.

**Acceptance** (both apps; set the runtime clock where needed)
- A home confirms garbage on Tuesday and recycling every other Tuesday. On the Monday at 6 p.m. local it gets exactly one push, "Garbage and recycling tomorrow" / "Bins out tonight.", with "Bins out". Tapping the push opens Today. Tapping "Bins out" records the event and changes nothing else.
- The same Monday with a bill due Tuesday: the push is still the pickup.
- On an evening with nothing due the next day, the delivery is skipped with `low_signal_day` and no push is sent, even with a nearby update.
- With the morning briefing also on, neither the Monday nor the Tuesday morning briefing leads with the pickup.
- A Camas home without a confirmed day never gets a pickup push. Its Today card shows the city rows with the unconfirmed suffix and the pickup editor open.
- A Vancouver or Washougal home shows the pickup editor open and "Set your pickup day and your pickups start here.", never "Nothing on the calendar for the next two weeks." After saving Tuesday, Today shows the household's own pickups, and the Monday evening push arrives.
- With a Thanksgiving row (Thursday, November 26), a Thursday pickup moves to Friday and a Friday pickup to Saturday. For a Thursday-pickup home, Wednesday evening sends no pickup push, and Thursday evening sends "Garbage tomorrow" / "Bins out tonight. Moved a day for Thanksgiving." Today shows the moved dates and the holiday line.
- Daylight saving ends November 1. The 6 p.m. push arrives at 6 p.m. local before and after.
- A private-setup home behaves the same as a shared home.

## 6. WP4 · Radon, from fact to reminder (F5, small)

**Proposed owner:** 4-1, with 3-1 reviewing the task path. **Depends on:** WP2, and the notification actions from WP3 for the buttons.

**Where:** on the Today tab of a home, shared or private setup, below the address calendar card, whenever the home's `lead_radon` section reports a `radon_zone`.

**How answers are stored.** No new table, column or settings key. An answer is a `HomeTask` whose `details.suggestion` is `"radon_test"`. The server accepts `task_type 'reminder'`, `status 'done'`, `visibility` and `details` on create; `details` may hold any keys except `source`, `sourceMailId`, `source_mail_id`, `sourceMailType` and `sourceObjectId` (live rules: `supabase/migrations/20260930153000_home_attribution_survives_account_deletion.sql:386-404`). Create through `POST /api/homes/:id/tasks` (`backend/routes/home.js:2524`; iOS `Features/Homes/Tasks/HomeTaskAccess.swift:133`; Android `ui/screens/homes/tasks/HomeTaskAccess.kt:95`).
- **The apps can't send these fields yet.** Add optional `status`, `details` (a JSON object) and `visibility` to `CreateHomeTaskRequest` (iOS `Core/Networking/Models/Homes/HomeTaskDTOs.swift:125-156`; Android `data/api/models/homes/HomeTaskDtos.kt:88-97`), and an optional, leniently decoded `details` to `HomeTaskDTO` / `HomeTaskDto` (iOS `:24-58`; Android `:23-41`).
- **Every radon create sends `visibility: 'members'`.** Without it the task takes `Home.default_visibility`, which an owner can set to managers only (`20260930080000_home_task_default_visibility.sql`), and invited members wouldn't see it.
- **Dates.** A chosen date is sent as `due_at` at 09:00 local time on that date, ISO 8601 with offset. Show dates as "Nov 12".
- The card's state comes from `GET /api/homes/:id/tasks`. With several radon tasks, use the newest open one, else the newest done one.

**County name.** The `lead_radon` section has no county name (`backend/services/placeSectionAdapters.js:303-312` returns `year_built`, `lead_paint_risk`, `radon_zone`, `summary`, `disclaimer`). In `composeLeadRadon`, also select `county_label` from `CountyRadonZone` (for example `'Clark County'`) and return it as `county_name`, an additive field. The apps decode it as optional; when it's missing, `{County}` is **"Your county"**.

**The card**
- **Ask** (no radon task exists, and not dismissed on this device):
  - Title: **"Was radon tested during your inspection or since you moved in?"**
  - Body, by zone: zone 1 **"{County} is in the EPA's highest radon zone."**; zone 2 **"{County} is in the EPA's moderate radon zone."**; zone 3 **"{County} is in the EPA's lowest radon zone."** Then: **"The EPA recommends testing every home, whatever the zone."**
  - Source line: **"EPA radon zones"**, linking to https://www.epa.gov/radon/epa-map-radon-zones-0
  - Buttons: **"Yes"**, **"No or not sure"**, **"Not now"**.
- **Yes:** a sheet **"When was it tested?"** with an optional date and an optional **"Result (pCi/L)"**, then **"Save"**. Creates `{task_type: 'reminder', title: 'Radon test', status: 'done', due_at: <date or today>, details: {suggestion: 'radon_test', tested_on?, result_pci?}}`. The card then reads **"Radon tested {date}"**, plus **" · {result} pCi/L"** when known. Sends `suggestion_decision` with `already_tested`.
- **No or not sure:** a sheet **"Add a radon test to your list"** with a date that defaults to 14 days from today and can't be in the past, then **"Add reminder"**. Creates `{task_type: 'reminder', title: 'Test for radon', description: 'The EPA recommends testing every home. Short-term test kits are sold at hardware stores and online. https://www.epa.gov/radon', due_at: <date>, details: {suggestion: 'radon_test'}}`. The card then reads **"Radon test on your list for {date}"** with **"Change date"**. Sends `suggestion_decision` with `reminder_added`.
- **Not now:** hides the card on this device for 30 days (iOS `UserDefaults`, Android DataStore; key `radonCard.dismissedUntil.<homeId>`). Sends `suggestion_decision` with `not_now`.
- A done radon task that has `details.tested_on`, or the title "Radon test", reads **"Radon tested {details.tested_on, else due_at}"**. Any other done radon task reads **"Radon test done {completed_at}"**.
- An open radon task past its due date reads **"Radon test was due {date}"** with **"Change date"**.
- "Change date" opens the same date sheet and updates `due_at` with `PUT /api/homes/:homeId/tasks/:taskId`.

**The reminder**
The due-day push comes from `_process_tasks_due` in `pantopus-seeder/src/handlers/home_reminders.py:147-205`, through `POST /api/internal/briefing/reminder-push` (`backend/routes/internalBriefing.js:478`). Fix three defects there first:
1. The status filter at `:157` excludes `"completed"` and `"cancelled"`, but the stored values are `done` and `canceled`, so finished tasks still get pushes. Use `not.in.("done","canceled")`.
2. Recipients ignore the task's visibility: the job sends to the assignee, otherwise to every active occupant. Send to the assignee if set. Otherwise send to the task's creator and to each active occupant for whom `home_record_recipient(home_id, user_id, 'task', visibility)` returns true (`supabase/migrations/20260910060000_home_record_transactions.sql`). The creator rule keeps private-setup homes working, because their creator isn't verified yet.
3. The due window is the UTC day (`:149-160`), and the job runs at 14:00 and 01:00 UTC (`pantopus-seeder/deploy/template.yaml:345,352`). The 01:00 UTC run, 6 p.m. Pacific the evening before, already treats local tomorrow as today and sends "is due today", then its dedup key (`:178`, keyed on the UTC date) silences the morning. Select tasks whose `due_at` falls on today's date in the recipient's `daily_briefing_timezone` (default America/Los_Angeles), key the dedup on that local date, and send task reminders only from the 14:00 UTC run.

Then add `category: 'TASK_REMINDER'`, `taskId` and `homeId` to the `task_due` reminder data so the buttons appear, set `link` and `route` to `/app/homes/{homeId}/tasks/{taskId}` (the task route both apps already open, `HomeTaskNotificationRoute`; `reminder-push` currently overrides it with the Place route, `internalBriefing.js:530-537`, so let `data.link` win), and record `reminder_sent` (WP7).

One more source of duplicates: the evening briefing pushes "Task due tomorrow: …" for any task (`buildTomorrowTaskSignal`, `eveningBriefingService.js:195-217`). Make it skip tasks whose `details.suggestion` is set; the due-day reminder covers them.
- **"Done"** sends `PUT /api/homes/:homeId/tasks/:taskId` with `{status: 'done'}` (iOS `HomeTaskAccess.swift:102`; Android `HomeTaskAccess.kt:65`), then `reminder_action` with `{kind: 'task', action: 'done'}`.
- **"Not now"** opens the task (`/app/homes/{homeId}/tasks/{taskId}`) with its edit sheet open on the due date, and sends `reminder_action` with `{kind: 'task', action: 'not_now'}`.

**Do not** build a suggestion engine or other suggestions, the `saved_place` calendar scope, new tables or columns, or kit links.

**Acceptance** (on a shared home and on a private-setup home)
- "No or not sure" with tomorrow's date puts "Test for radon" in the home's task list. Nothing arrives that evening. The next morning at about 7 a.m. local the reminder arrives with "Done" and "Not now". "Done" completes the task, and the card reads "Radon test done {date}".
- "Yes" with a date records a done task, and no device asks again.
- "Not now" hides the card on this device for 30 days.
- A done or canceled task never gets a due-day push.
- A task whose visibility excludes someone never reaches that person.
- The card names the county, e.g. "Clark County is in the EPA's moderate radon zone."

## 7. WP5 · One first-use prompt (F2, small)

**Proposed owner:** 4-1. **Depends on:** WP3 and WP4.

- On a home's Today tab, above the other cards, show one card while the home needs a pickup day or the radon question is unanswered, unless it was dismissed on this device. A home needs a pickup day when its calendar's `needs_pickup_day` is true. In the rare `unavailable` case, use the calendar WP3 item 7a loads.
- Title **"Two things for your home"**. Rows: **"Set your pickup day"**, which opens the pickup editor, and **"Was radon tested?"**, which scrolls to the radon card. Each row disappears once done. **"Later"** hides the card on this device (key `firstUse.dismissed.<homeId>`).
- Show the radon row only when the radon card would show (the home has a `radon_zone`). Tapping it while the radon card is dismissed clears that dismissal.
- No server storage and no new endpoint.
- Acceptance: a new private-setup home shows the card with both rows; setting a pickup day removes the first row; answering radon removes the card; "Later" hides it on this device.

## 8. WP6 · The household step and the invite verification fix (F3 small, F3b gate)

**Proposed owner:** 3-1. **Depends on:** WP4. The household step needs a shared home, because a private setup can't hold household members.

**8.1 Tell the creator when someone else finishes a task.**
- Wire `notifyTaskCompleted` (`backend/services/notificationService.js:537`; it has no callers today). Add a `taskId` parameter and store `metadata: { home_id, task_id }`; today it stores only `home_id`, so a tap falls back to the tasks tab instead of the task (`HomeTaskNotificationRoute.swift:9-12`, `HomeTaskNotificationRoute.kt:18-25`).
- Its text names the task and the person on the lock screen, which the task-assignment notice deliberately avoids (`supabase/migrations/20260910180000_home_task_assignment_delivery.sql:94-98`). Use title **"A Home task was completed"** and no body detail; the task opens on tap. Call it after a successful update that moves a task to `done` when the actor isn't the creator, in `PUT /api/homes/:id/tasks/:recordId` (`backend/routes/home.js:2555`) and `PATCH /tasks/:id` (`backend/routes/mailboxV2Phase3.js:1083`). Notify once per completion: setting `done` again doesn't notify again.
- With `task_id` in the metadata, tapping it opens the task on both apps (iOS `Core/Routing/HomeTaskNotificationRoute.swift:5-22`; Android `core/routing/HomeTaskNotificationRoute.kt:36`).
- **Members complete only tasks they created or that are assigned to them.** They have `tasks.view` and `tasks.edit` but not `tasks.manage` (`supabase/migrations/20260912050000_home_member_task_defaults.sql:1-3`, `:18-19`); `can_complete` is `manage OR (edit AND (created_by = actor OR assigned_to = actor))` (`20260930153000_home_attribution_survives_account_deletion.sql:233`, write gate `:362-365`), and both apps hide "Done" without it (iOS `HomeTaskAccess.swift:107`, Android `HomeTaskAccess.kt:69`). In J3 the owner assigns "Test for radon" to the member with the existing assign flow, which sends `task_assigned`. No permission change.

**8.2 The F3b gate (decision 8, September 16).** One migration:
- Add `HomeOccupancy.verification_source text NOT NULL DEFAULT 'legacy'` with `CHECK (verification_source IN ('address','household','legacy'))`.
- Backfill: `address` for an occupancy with a verified postcard (`HomePostcard*` tables), an approved document or claim review (`HomeVerificationEvidence`, `HomeOwnershipClaim`) or a landlord-approved lease (`HomeLease`) for that home and user; otherwise `household` when it came from an accepted `HomeInvite` or a manager-approved residency request for that home and user; the rest stay `legacy`. `address` wins when both apply.
- **Writers are SQL functions.** Occupancies become verified only inside SQL functions; `backend/services/occupancyAttachService.js` has no production callers, so don't change it. In the same migration, `CREATE OR REPLACE` each function below from its newest body (search `supabase/migrations/` for the newest definition), changing only the occupancy UPDATE and INSERT statements to also set `verification_source`, and keep every grant and revoke identical:
  - `household`: `act_on_home_invitation` (newest body `20260912040000_home_invitation_sender_recovery.sql:278`, UPDATE `:391`, INSERT `:400`); `review_home_residency` for the manager `attach` and `approve` actions (`20260912060000_home_residency_legacy_compatibility.sql:272`, `:440-446`); `mutate_home_claim_invitation` (`20260910045000_home_claim_merge_transactions.sql:100`, occupancy at `:218`).
  - `address`: `verify_home_postcard_current` and `promote_home_postcard_review` (`20260912010000_home_postcard_verification_recovery.sql:102`, `:231`); `mutate_home_claim_review` (`20260910080000_home_claim_review_transactions.sql:295`); `decide_home_lease` (`20260913050000_home_lease_decisions.sql:9`).
  - If you find another function that sets `verification_status = 'verified'` on `HomeOccupancy`, classify it the same way and record it in the PR.

Then the server code:
- **Gate.** `isVerifiedResident` (`backend/utils/homePermissions.js:432`) returns false when `verification_source === 'household'`; `legacy` counts as address. That covers block founders, fridge cards, record watches, Real Rent, residency claims and residency letters. Apply the same rule to `hasVerifiedSenderHome` (`backend/routes/mailCompose.js:28-48`).
- **Tier.** In `resolveTier` (`backend/services/placeIntelligenceService.js:61`), return `T3` instead of `T4` when `access.occupancy.verification_source === 'household'`. That covers the neighbor-message sender gate (`backend/routes/neighborMessages.js:119-126`, which checks `resolveTier(access) !== 'T4'`) and the band D `real_rent` section of `/intelligence`. Leave `findVerifiedResident` (`neighborMessages.js:77-92`, the recipient lookup) as it is, so household members still receive messages.
- **Household tools stay as they are.** Tasks, calendar and the household mailbox keep using `verification_status`.

On the apps:
- **Copy.** Replace "This invitation does not grant ownership." on iOS (`Features/TokenAccept/HomeInvitationDecisionView.swift:116`) and Android (`ui/screens/token_accept/HomeInvitationDecisionScreen.kt:102`) with **"This invitation gives you household access. To send neighbor messages or get a residency letter, verify the address yourself."**

**Acceptance**
- An owner with a shared home invites a member by email. The member accepts on the other platform and sees "Test for radon". The owner assigns it to the member; the member completes it. The owner gets the task-completed notification, and tapping it opens the task.
- The invited member can't request a residency letter, send a neighbor message or see Real Rent, and gets the existing locked responses, but still receives neighbor messages. A resident verified by postcard before the migration still can do all of it.
- All three source values behave as specified. Add a case to the existing home invitation SQL contract tests if they cover `act_on_home_invitation`.

## 9. WP7 · Pilot measurement

**Proposed owner:** Stream 1. **Depends on:** nothing. Land the migration first so the other packages can record events.

**Backend**
- Migration: widen `funnelevent_type_check` (baseline `:9651`) with `session_open`, `reminder_sent`, `reminder_action` and `suggestion_decision`, keeping the six existing values.
- `backend/services/funnelEvents.js`: add the four types to `FUNNEL_EVENT_TYPES`, and add `APP_POSTABLE_EVENT_TYPES = ['session_open', 'reminder_action', 'suggestion_decision']`. Leave the anonymous `CLIENT_POSTABLE_EVENT_TYPES` unchanged.
- New route `POST /api/hub/funnel-events` in `backend/routes/hub.js` (mounted at `/api/hub`, `backend/app.js:448`). It uses `verifyToken`, takes a body of `{event_type, meta}`, rejects bodies over 2,048 characters of `JSON.stringify(req.body)` (a route-level `express.json` limit does nothing, because `bodyParser.json({limit:'20mb'})` runs first, `app.js:219`), accepts only app-postable types, keeps only the `meta` keys `platform`, `trigger`, `push_type`, `kind`, `action`, `date`, `suggestion` and `decision` with string values of at most 40 characters, records with `userId: req.user.id`, and always returns 204. The anonymous `POST /api/public/funnel-events` (`backend/routes/public.js:753`) stays as is.
- The server records `reminder_sent`. In `/api/internal/briefing/send`, record it after a pickup-led evening push, with `meta {kind: 'pickup'}`. In `/api/internal/briefing/reminder-push`, record it after a `task_due` push, with `meta {kind: 'task'}`.
- In `backend/services/funnelReport.js` (`loadFunnelSummary`, `:118`), add counts per new type, grouped by `meta.kind`, `meta.action`, `meta.decision` and `meta.trigger`.
- Add an activation count: users created in the window who, within seven days, have a saved place or a home, and either a confirmed pickup day or a radon task. It's read through `GET /api/admin/funnel/summary` (`backend/routes/admin.js:92`).

**Apps**
- `session_open` fires on cold start, and on returning to the foreground after 30 minutes or more in the background. Send `meta {platform: 'ios'|'android', trigger: 'push'|'organic', push_type?}`, where `push` means the app was opened from a notification and `push_type` is that payload's `type`.
- `reminder_action` and `suggestion_decision` fire as WP3 and WP4 describe. `suggestion_decision` meta is `{suggestion: 'radon_test', decision: 'already_tested' | 'reminder_added' | 'not_now'}`.
- Never put addresses, coordinates, names or free text in `meta`.
- Leave the apps' existing analytics alone (iOS `Core/Analytics/Analytics.swift:265`, Android `data/analytics/Analytics.kt:325`). `FunnelEvent` is the pilot's record.

**Acceptance:** after running the WP3 and WP4 journeys, every new event shows up in the funnel summary with the right counts.

## 10. WP8 · Support Train reminders for helpers who signed up by email

**Proposed owner:** Stream 1. **Depends on:** nothing.

**Why:** Support Trains is the only part of the app with real use today. Two defects in its reminder jobs (`backend/jobs/supportTrainReminders.js`):
- both jobs skip guest reservations (`:42`, `:108`, `.not('user_id','is',null)`);
- both compare the slot's local `slot_date` and `start_time` with UTC dates and times (`:28-30`, `:92-96`, `:116-119`), so the day-before reminder can go about 40 hours early and the "today" one at about 11 p.m. the night before; and slots without `start_time` never get the day-of reminder;
- both read and stamp the same `last_reminder_sent` (`:41`/`:107`, `:72-75`/`:139-142`), so a helper who got the 24-hour reminder never gets the day-of one.

**Backend**
- Migration: add `SupportTrainReservation.day_of_reminder_sent_at timestamptz`, nullable. The 24-hour job keeps `last_reminder_sent`; the day-of job uses the new column.
- **Local time.** Compute dates and times in the train's timezone, `inferTimezone(delivery_lat, delivery_lng)` (`backend/services/context/locationResolver.js:46`; add it to that file's exports), default America/Los_Angeles; `SupportTrain` has no timezone column. Send the day-before reminder at 5 p.m. local or later on the day before `slot_date`. Send the day-of reminder at 7 a.m. local or later on `slot_date`, or 4 hours before `start_time` if that's earlier. Slots without `start_time` still get the day-of reminder.
- Include guest reservations, where `user_id` is null and `guest_email` is set (baseline `:14627`). They get an email instead of a push, through a new `sendGuestReservationReminderEmail` in `backend/services/emailService.js`. Model it on `sendGuestReservationConfirmationEmail` (`:597`).
  - Contents: the train title, the slot's date and time window, what the helper signed up to bring (`contribution_mode` plus `dish_title` or `restaurant_name`), and the same links the confirmation email carries.
  - Include the drop-off address only when the reservation's `guest_address_shared_at` is set, meaning the guest already received it (`sendGuestReservationAddressEmail`, `:703`).
- Signed-in helpers keep their push reminders.

**Copy:** subject **"Reminder: {train title} tomorrow"** and **"Reminder: {train title} today"**.

**Acceptance**
- A helper who signed up by email with a slot tomorrow gets one email after 5 p.m. local the day before and one on the morning of the slot.
- A signed-in helper gets both pushes.
- Rerunning either job sends no duplicates.

---

## 11. Order, dependencies and proposed owners

Stream 1 assigns. This is the proposal.

| Package | Proposed owner | Can start | Touches |
|---|---|---|---|
| WP7 Measurement (migration and route first) | Stream 1 | Now | Backend, then both apps |
| WP1 Truthfulness fixes | Stream 1 | Now | Backend, seeder, both apps |
| WP8 Support Train reminders | Stream 1 | Now | Backend |
| WP2 Today for saved places and new homes | 4-1 | Now | Backend, both apps |
| Notification actions plumbing (WP3, item 10) | Stream 5, or the writer Stream 1 names | Now | Both apps |
| WP3 Pickup reminders | 4-1 | After WP2 | Backend, both apps |
| WP4 Radon | 4-1, 3-1 reviewing | After WP2; buttons after the plumbing | Seeder, backend, both apps |
| WP5 First-use prompt | 4-1 | After WP3 and WP4 | Both apps |
| WP6 Household step and F3b gate | 3-1 | After WP4 | SQL, backend, both apps |

**Pilot-ready** means every package here is done, the founder's items in NEXT_STEPS section 2 are done, and journeys J1 to J3 pass end to end against the hosted backend on a physical iPhone and a physical Android phone.

## 12. Design references

**Only the exports in the first table are design sources for this build.** Every other folder in `docs/design/exports/` is out for now, even where it draws a screen this build touches; the second table says why. Where an export and this brief differ, this brief wins, including all copy.

Build each component into the shipped screen and keep that screen's layout. The "host" screens in the exports are the design board's, not the app's. Don't copy the drawing defects listed here; they come from `docs/design/exports/VERIFICATION.md`.

| Surface | Export | Use it for | Drawing defects not to copy |
|---|---|---|---|
| Today for a saved place | `f1-today-tab` | The saved-place Today and its chip | Tab bar escaping the phone; the wrong spoken label on "Change pickup day" |
| Pickup card on Today | `f4-today-pickup-card` | Card states | Asking more than one thing at a time |
| Pickup primer | `f4-notification-primer` | The primer sheet | Visible "[PLACEHOLDER]" boxes; the empty tray icon |
| Morning opt-in card | `f4-briefing-optin-card` | The card | Links shown by color alone; the cut-off AX5 link |
| Date picker for pickup and radon | `x-date-sheet` | Pickup mode and a single date only | Leader lines through labels |
| Source and "unconfirmed" line | `x-provenance-sheet` | The source line style only | Hosts hidden under the sheet |
| Curator chip | `f9-curator-chip` | The chip on a post card only, with the copy in 3.2. Not its "Why am I seeing this?" explainer or its mute and report flows | Not reviewed in `VERIFICATION.md`; page 15 is out of manifest order |

**No export exists** for the radon card, the first-use card or the notification buttons. Build them from existing design-system components (the foundations in `docs/design/exports/00a` to `00d` and the shipped components) and this brief's copy.

**Not design sources for this build:**

| Exports | Why they're out |
|---|---|
| `f1-add-place-sheet`, `f1-email-verify-handoff`, `f1-claim-receipt`, `f1-save-confirmation`, `f1-today-air-band`, `f5-today-calendar-strip` | The build keeps the shipped arrival flows and Today content; WP2 changes behavior, not these screens |
| `f3-bill-detail-web`, `f3-bills-list`, `f3-household-block`, `f3-household-calendar`, `f3-household-notifications`, `f3-invite-banner`, `f3-invite-composer`, `f3-member-home-dashboard`, `f3-members-roster` | F3 beyond WP6 (section 13) |
| `f3b-invitation-decision`, `f3b-locked-action-row`, `f3b-owner-attestation`, `f3b-verify-address-sheet` | WP6 changes one line of copy on the shipped invitation screen (8.2); the redesigns are in section 13 |
| `f1-your-places`, `x-place-file`, `f4-notification-settings` | Redesigns the founder decided against (section 13) |
| `f6-home-basics-rows`, `f6-place-section-details` | F6 is dropped |
| `f7-today-widget`, `f7-widget-gallery`, `f7-widget-howto-sheet`, `f7-widget-tap-landing` | F7 comes later |
| `f8-compare-arrival-header`, `f8-compare-reveal`, `f8-compare-sheet`, `f8-native-share-compare`, `f8-og-compare-card`, `f8-positioning-copy`, `f8-scale-strips`, `f8-seasonal-aha` | F8 comes later |
| `f9-earn-removal`, `f9-verification-promise-copy`, `f9-privacy-mirror`, `f9-nearby-cells-map`, `f9-block-founders-panel`, `f9-founding-meter-preview` | Outside WP1, which needs only the curator chip; the growth panels come later |

Design work for this build: finish the fix passes for the seven exports in the first table only.

## 13. Not in this build

Do not build any of these, even where the loop design or a design export describes them.

- Any web interface change, including `/start`, the web Today tab and the share image.
- F2's full first-week checklist. Only WP5's one card.
- F3 beyond WP6:
  - member permission defaults for the calendar, bills and member list;
  - bill-paid and calendar-event notifications;
  - the members roster, invitation list and invite-channel redesigns.
- F3b beyond its server gate and the invitation copy: owner attestation, the "Verify this address" sheet redesign and locked-action rows.
- F5 beyond WP4:
  - lease, notice, insurance, warranty and dues dates;
  - pickup days or reminders for a saved place without a home;
  - the `saved_place` calendar scope.
- F6: just-moved ticks on the account, the voter-registration step and election-deadline rows.
- These loop features in full:
  - F7 widgets;
  - F8 compare link, rotating headline, positioning line and two-column share image;
  - F9's referral rewards, tier rename and Founding Neighbor name collapse;
  - F10 mail snap;
  - F11 keeper;
  - F12 appeal windows and radon kit links.
- Two redesigns the founder decided for the design pack on September 22: the Place tab rebuilt around a "place file" and "Your places", and the one-page notification settings. The Place tab and notification settings stay as shipped.
- Alert pushes for saved places.
- The election feature, Places, the creator network, the stylized home picture and the address QR inbox.
- Anything behind a first-launch flag: `beacon`, `personas`, `marketplace`, `open_gigs`, `public_scheduling`, `business_directory`, `household_extras`, `mail_extras` (see [launch-scope-flags-2026-10-01.md](launch-scope-flags-2026-10-01.md)).

## 14. Decisions behind this brief

**Made by the founder on October 3:**
- New builds are mobile only, on iOS and Android. Web waits.
- The F1 to F12 scope:
  - build F1, F4 and the rest of F9's truthfulness fixes;
  - build small versions of F2, F3 and F5;
  - ship F3b's server gate with F3;
  - leave F7, F8, F10 and F12's appeal windows for later;
  - drop F6 and F11;
  - park the home picture and the address QR inbox.

**Made on October 3 under the founder's standing instruction to go with the recommended option.** Each one is recorded in [NEXT_STEPS.md](../NEXT_STEPS.md), where the founder can change it.
1. Pickup reminders push only for a confirmed pickup day. City defaults show as unconfirmed in the app and never push, morning or evening.
2. Pickup and radon reminders need a home. A private setup counts, so a household gets reminders the day it adds its home, without waiting for verification. A saved place without a home gets Today and an "Add your home" row.
3. The night-before pickup rides the existing evening briefing at the person's evening time. There's no new schedule.
4. "Bins out" records an event and changes nothing else.
5. "Not now" on a task reminder opens that task's date picker. It never snoozes silently.
6. Holiday moves come from city-level holiday rows that shift that week's pickups. There are no per-home edits and no new table.
7. Radon answers are home tasks marked `details.suggestion = "radon_test"`. "Not now" is remembered on the device only.
8. The radon card and the first-use card live on the Today tab, so they work for private-setup homes, which have no Place dashboard.
9. F3b's server gate ships with WP6. Everyone verified by postcard, document, landlord or admin before it ships stays verified. People who joined through an invitation or a manager's approval become household-verified: they keep household tools and lose neighbor messaging, residency letters and Real Rent until they verify the address themselves.
10. The radon card, first-use card and notification buttons have no design export. They're built from existing components and this brief's copy.
11. On a pickup evening the pickup leads the push over bills, tasks and calendar events; only an alert more serious than `moderate` beats it. Nearby updates never lead an evening push.
12. A member completes the radon task when the owner assigns it to them. Member permissions don't change.
13. The task-completed push names neither the task nor the person on the lock screen.
14. Radon tasks are always visible to all members, and task reminders arrive in the morning of the due day, in the household's time zone.
15. Support Train reminders use the train's local time: the evening before and the morning of the slot.

**Still open. The brief builds the default until the founder decides:**
- The September 26 promise and pilot shape. Default: section 1.
- Who builds each package. Default: section 11; Stream 1 assigns.
- Whether invited household members see pickup days and bills. Default: not in the pilot. They see shared tasks and complete the ones assigned to them.
- Where the new promise appears. Default: the store listings and the app's first screen.
- The pilot start date. Default: when the founder's hosting work is done and one full journey works on the hosted backend.

## 15. Existing acceptance rows on the pilot path

These rows belong to their owning streams' backlogs, and this brief doesn't change their acceptance. The IDs are from the September 26 tiers proposal in `docs/launch-boundary-2026-09-26/` ([PR 1499](https://github.com/WangPantopus/skinny-pantopus/pull/1499)), not the coordination guide, whose IDs collide (there, N05 is the booking-reminder failure contract). Check each row's status with its owning stream before relying on it.

| Area | Rows |
|---|---|
| Hosting and delivery (founder-owned) | O01, O03, O04, O05, O06, L01, L03 |
| Reminders | N05, N01, I04; N02 for an Android phone |
| Arrival and facts | A01, A02, A04, I05, I06 |
| Home path | H08, then H07 for the household step, and D06 |
| States on the journey screens | U03 |
