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
- iOS: decode `origin` in `FeedPostDTO` (`Core/Networking/Models/Feed/FeedDTOs.swift:14`), carry it through `PulseFeedViewModel.project` (`Features/Feed/PulseFeedViewModel.swift:804`), and show the chip on `PulsePostCard` (`Features/Feed/PulsePostCard.swift:179`).
- Android: add `@Json(name = "origin") val origin: String? = null` to `FeedPost` (`data/api/models/feed/FeedDtos.kt:12`); add the chip in `PulseFeedViewModel.projectCard` (`ui/screens/feed/pulse/PulseFeedViewModel.kt:978`) the way the "Visitor" label is added (`:1059`); render it in `PulsePostCard` (`ui/screens/feed/pulse/PulsePostCard.kt:131`).
- Copy: chip **"Pantopus curator"**. The post's own "Source: …" line stays. Report and mute stay available.
- Do not use `is_seeded` / `isSeeded`: that flag marks system fact posts, not curator posts.
- Acceptance: a curator post shows the chip on both apps; a neighbor's post doesn't.

**3.3 Seeder prompt lines.**
- `pantopus-seeder/src/pipeline/humanizer.py:51-55`: delete the ENGAGEMENT block, which tells the model to end posts with a question to locals.
- Same file, `:105`: delete "It should read like something a neighbor might say, NOT like ESPN copy." Keep the rest of the sports lane.
- Curator exclusion: taper metrics already exclude curator posts by account type (`get_seeder_tapering_metrics`, baseline migration `:5067-5108`). Check `backend/services/funnelReport.js` and the density counts behind the unlock meters. Exclude `origin = 'curator'` only where curator posts are counted. Record what you found either way.
- Acceptance: five posts from a fresh seeder run contain no closing question and no neighbor-voice phrasing.

## 4. WP2 · Today works for a saved place and a newly added home (F1)

**Proposed owner:** 4-1. **Depends on:** nothing.

**Why:** both apps show "Today starts at your address" unless the person has a *shared* home (`sharedHomes`: iOS `Core/Networking/Models/Homes/HomeDTOs.swift:149`, Android `data/api/models/homes/HomeDtos.kt:102`). Someone who saved an address, or who added their home and is still in private setup, gets nothing.

**Backend**
1. **Saved place as a location.** In `resolveLocation` (`backend/services/context/locationResolver.js:224`), after the unpinned viewing location (`:330`) and before `EMPTY_RESULT` (`:336`), resolve the user's newest `SavedPlace` (by `created_at`) with source `saved_place`. Add `saved_place: 0.60` to `CONFIDENCE` (`:19`). A home always wins (founder ruling, September 22).
2. **Saving a place.** In `POST /api/saved-places` (`backend/routes/savedPlaces.js:25`), after a successful upsert:
   - If the user has no `UserNotificationPreferences` row, insert one with `daily_briefing_enabled = false` and `evening_briefing_enabled = false`. Never change an existing row. The column default for the evening briefing is true and `pantopus-seeder/src/handlers/briefing.py` schedules everyone with a row, so without this a saved place would start nightly pushes.
   - Call `clearHubTodayCache(userId)` (`backend/services/context/providerOrchestrator.js:159`). `DELETE /api/saved-places/:id` (`:69`) clears it too.
3. **Place data for a private setup.** `GET /api/homes/:id/intelligence` (`backend/routes/placeIntelligence.js:45`) returns 403 unless `checkHomePermission(..., 'home.view')` grants access, which a private setup never gets. When access is denied, allow the request if the home is the caller's private setup: `home_record_context(home, user)` returns `allowed` and `private` true and `Home.created_by_user_id` is the caller, the same test as `backend/services/homeListService.js:78`. Pass the denied `access` object through unchanged. `resolveTier` then returns `T1` (`backend/services/placeIntelligenceService.js:61`), so only band A sections are available: weather, air, the address calendar, radon and the other public readings. Every household section stays locked.

**iOS**
4. **Which home Today shows.** `AddressTodayTabView.resolveHome` (`AddressTodayTabView.swift:122-140`) picks from `sharedHomes`. New order: the shared home where the person is primary owner, then any shared home, then their private-setup home.
5. **Saved-place Today.** With no home, call `SavedPlacesEndpoints.list()` (`Core/Networking/Endpoints/SavedPlacesEndpoints.swift:15`). If a saved place exists, show the live Today content (`TodayDetailViewModel.fetchLive`, `GET /api/hub/today`, `Features/Hub/Today/TodayDetailViewModel.swift:113-157`) inside the Today tab, with the chip and the reminders row below. Keep "Today starts at your address" (`AddressTodayTabView.swift:67-96`) only when there's neither a home nor a saved place.
6. **Morning opt-in card** on the saved-place Today, shown once: record that it was shown with `daily_briefing_prompted: true`; "Turn on" sends `daily_briefing_enabled: true` and the device's IANA time zone as `daily_briefing_timezone` through `PUT /api/hub/preferences`.

**Android**
7. **Which home Today shows.** `TodayTabViewModel.resolvePrimaryHome` (`TodayTabViewModel.kt:77`) uses `myHomes().sharedHomes`. Same order as iOS, private setup last.
8. **Saved-place Today.** Use `SavedPlacesRepository` (`data/saved_places/SavedPlacesRepository.kt:20`; the API client already exists). With a saved place and no home, render the hub Today content (the content evening and morning briefing pushes open, mapped by `ui/screens/hub/today/TodayDetailMapper.kt`) inside the Today tab, with the chip and the reminders row. Keep `NoPlaceCard` (`TodayTabScreen.kt:110`) only when there's neither.
9. **Morning opt-in card** through `NotificationPreferencesApi` (`data/api/services/NotificationPreferencesApi.kt:22,32`), as on iOS.

**Copy**
- Chip: **"Saved place · Only you"**
- Reminders row: title **"Get reminders for this address"**, body **"Pickup and radon reminders need your home on Pantopus."**, button **"Add your home"**, which opens the existing Add Home flow (iOS `AddHomeWizard`; Android `ChildRoutes.ADD_HOME`).
- Morning card: title **"A morning heads-up?"**, body **"Weather, air and alerts for this address, only when something's worth knowing."**, buttons **"Turn on"** and **"Not now"**.

**Do not** build a place chooser or "Your places", change the Place tab, or ask for location permission.

**Acceptance**
- A new account with no home saves its previewed address after sign-in (the existing pending-place "Save privately"). Today on both apps shows that address's weather, air and alerts with the chip. `GET /api/hub/today` reports `location.source = 'saved_place'`.
- That user gets no briefing push that evening or the next morning.
- The same user adds their home. Today switches to the home and shows the address calendar card with "Set your pickup day". For a city with no calendar rows yet, that card comes from WP3 item 7a. Until WP3 lands, the fallback card is expected there.
- A user with a shared home and a saved place sees the home on Today.
- A private-setup home's Today never shows a household section.

## 5. WP3 · Night-before pickup reminders people can act on (F4)

**Proposed owner:** 4-1 for the backend and Today; the shared notification-action plumbing (item 10) goes to one writer Stream 1 names, Stream 5 by default because it owns notifications. **Depends on:** WP2.

**Backend**
1. **A pickup signal for the evening briefing.** `composeEveningBriefing` (`backend/services/context/providerOrchestrator.js:578`) already fetches the address calendar and passes it to `selectEveningSignal` (`backend/services/context/eveningBriefingService.js:304`), which drops it. Accept `addressCalendar` there and add `buildTomorrowPickupSignal(addressCalendar, timeZone, recentBriefings, now)`:
   - take `addressCalendar.upcoming` events with `days_until === 1`, kind in `garbage`, `recycling`, `yard_waste`, `bulk_pickup`, and `scope === 'home'` only;
   - combine the kinds into one signal built with `createSignal('address_calendar', 0.66, …)`, identity `pickup:<date>`, label from the copy below, data `{ kinds, date, homeId }`;
   - skip it when `hasRecentSignalIdentity` shows it was already sent.
2. **Quiet evenings send nothing.** In `composeEveningBriefing`, remove the third pass that falls back to the evening tip. Return `emptyBriefingResult('low_signal_day')` unless the selected signal's `costOfInaction` (`backend/services/context/usefulnessEngine.js`, exported) is at least `MIN_PUSH_COST` (`providerOrchestrator.js:92`). A weather line alone never sends.
3. **The pickup push.** In `POST /api/internal/briefing/send` (`backend/routes/internalBriefing.js:133`, push at `:286-297`), when the lead signal is the pickup signal: title is the signal label; body is "Bins out tonight." plus the holiday sentence when a day moved; add `data.category = 'PICKUP_REMINDER'`, `data.pickupDate` and `data.homeId`, and set both `data.link` and `data.route` to `'/app/today'`. Every other briefing keeps its current title and payload.
4. **Category on iOS pushes.** `backend/services/push/apnsClient.js:84` `buildPayload`: when `data.category` is present, set `aps.category` to it. `backend/services/push/fcmClient.js:92` already carries every data key.
5. **City defaults never push, and pickups push only in the evening.** The primer promises "Nothing on other days", and today the morning briefing can lead with a pickup: `generateAddressCalendarSignals` scores it 0.62 with cost 0.60, which clears the push gate (`providerOrchestrator.js:541-551`), so a household with both briefings on would hear about one pickup up to three times.
   - In `generateAddressCalendarSignals` (`usefulnessEngine.js:277`), skip `garbage`, `recycling`, `yard_waste` and `bulk_pickup` events whose `scope` isn't `home`, and skip `pickup_holiday` items; the moved pickups carry the holiday. They all still show on the Place Today card. For other unconfirmed kinds, replace the pickup-specific suffix (`:313`) with " (Unconfirmed.)". Leave `street_sweeping` as it is.
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
7. **Holiday data.** Once the founder has confirmed each provider's rules by hand (NEXT_STEPS section 2), add the rows for Camas, and Vancouver or Washougal if pilot households live there, as a data migration with sources, before November 20. Today only Camas has calendar rows, all unconfirmed.

**iOS and Android**
7a. **Set a pickup day where the city has no calendar yet.** Today only Camas has calendar rows. For a home in a city with none (Vancouver and Washougal today), `composeAddressCalendar` (`backend/services/placeIntelligenceService.js:458-476`) returns the section as `unavailable` with "No calendar for {city} yet. Set your pickup day and it starts here." Unavailable sections carry no data (`backend/serializers/placeIntelligenceSerializer.js:104`). Both apps then show only the fallback card, iOS at `PlaceTodayDetailContent.swift:52-60` and Android at `AddressCalendarSection` (`PlaceTodayDetailContent.kt:415-420`), so the household can't reach the pickup editor. Fix it in the apps:
   - When the `address_calendar` section is `unavailable`, load `GET /api/homes/:id/calendar` for the home on screen: iOS with `PlaceDetailViewModel.homeId`; Android only when `viewModel` isn't null, because the editor needs it. The route returns the calendar only to someone who may read it (`getPickupContext`), so the server keeps deciding access. The client exists on both apps: iOS `AddressCalendarEndpoints.calendar(homeId:)` (`Core/Networking/Endpoints/HomesEndpoints.swift:721`), Android `PlaceApi.addressCalendar` (`data/api/services/PlaceApi.kt:48`). It returns the calendar whatever the rule count, with `needs_pickup_day`, `pickup_version` and `rule_count`.
   - If it returns a calendar with `rule_count` 0, render the existing `AddressCalendarCard` with it, which opens on the pickup editor because `needs_pickup_day` is true. Save through the existing editor with that payload's `pickup_version`. After the save, Today reloads and the section comes back ready.
   - While `rule_count` is 0, show the section's `unavailable_reason` in place of "Nothing on the calendar for the next two weeks." (iOS `:496-497`; Android `UpcomingEvents`, `:500-503`). With no rules, an empty list isn't an all-clear.
   - If the request fails, keep the fallback card as it is.
   - Don't change the server's section status. A `ready` status there would make the web's Place dashboard tile read "Nothing in the next two weeks" (`frontend/apps/web/src/components/place/presentation.tsx:203`). The web stays as it is.
8. **Pickup primer on the first save.** After a home's pickup schedule is saved for the first time (iOS `AddressCalendarCard.choose`, `Features/Place/Detail/PlaceTodayDetailContent.swift:653-686`; Android `PickupScheduleEditor` "Save schedule", `ui/screens/place/detail/PickupScheduleEditor.kt:87`), show the primer once per home. "Remind me" sends `evening_briefing_enabled: true` and `daily_briefing_timezone` through `PUT /api/hub/preferences`, then asks for notification permission if the system hasn't decided: Android 13+ `POST_NOTIFICATIONS`; iOS already asks at launch (`App/AppDelegate.swift:49-74`).
9. **Unconfirmed rows on Android.** Android parses `confidence` but never shows it (`data/api/models/place/PlaceIntelligenceDtos.kt:1047`). Show the suffix iOS already shows, " · unconfirmed, please double-check" (`PlaceTodayDetailContent.swift:617-620`).
10. **Notification actions. This is shared plumbing with one writer.** Register at app launch:
    - iOS: `UNNotificationCategory` `PICKUP_REMINDER` with action `BINS_OUT` ("Bins out", runs in the background); `TASK_REMINDER` with `TASK_DONE` ("Done", background, requires the device to be unlocked) and `TASK_NOT_NOW` ("Not now", opens the app). Handle them in `userNotificationCenter(_:didReceive:)` (`App/AppDelegate.swift:143-174`).
    - Android: in `NotificationDispatcher.dispatch` (`push/NotificationDispatcher.kt:99`), when `data.category` is set, add the matching `NotificationCompat.Action`s. Background actions go to a new `BroadcastReceiver` registered in the manifest; "Not now" uses an activity intent with the task deep link.
    - "Bins out" sends `reminder_action` with `{kind: 'pickup', action: 'bins_out', date}` (WP7). Nothing else changes.
11. **Where the push lands.** `/app/today` opens the Today tab itself on both apps. Add the mapping to iOS `Core/Routing/DeepLinkRouter.swift` and Android `core/routing/DeepLinkRouter.kt` if it's missing. Don't reuse `/hub-today`, which opens the briefing detail.

**Copy**
- Push title by kinds tomorrow: **"Garbage tomorrow"**, **"Recycling tomorrow"**, **"Yard waste tomorrow"**, **"Bulk pickup tomorrow"**; two kinds **"Recycling and garbage tomorrow"** (pattern "{A} and {B} tomorrow"); three **"Garbage, recycling and yard waste tomorrow"**.
- Push body: **"Bins out tonight."** When a pickup in the push was moved: **"Bins out tonight. Moved a day for {holiday}."**, or **"Bins out tonight. Moved for {holiday}."** if `shift_days` isn't 1.
- Primer: title **"Get a reminder the night before?"**, body **"One notification the evening before each pickup. Nothing on other days."**, buttons **"Remind me"** and **"Not now"**.
- Action: **"Bins out"**.

**Do not** add a new job or schedule, or let a city default push.

**Acceptance** (both apps; set the runtime clock where needed)
- A home confirms garbage on Tuesday and recycling every other Tuesday. On the Monday at 6 p.m. local it gets exactly one push, "Recycling and garbage tomorrow" / "Bins out tonight.", with "Bins out". Tapping the push opens Today. Tapping "Bins out" records the event and changes nothing else.
- On an evening with nothing due the next day, the delivery is skipped with `low_signal_day` and no push is sent.
- With the morning briefing also on, neither the Monday nor the Tuesday morning briefing leads with the pickup.
- A city default schedule never pushes. Its Today card shows the unconfirmed suffix and "Set your pickup day".
- A home in a city with no calendar rows (a Vancouver or Washougal address) shows "No calendar for {city} yet. Set your pickup day and it starts here." with the pickup editor open. After saving Tuesday, Today shows the household's own pickups, and the Monday evening push arrives.
- With a Thanksgiving row (Thursday, November 26), a Thursday pickup moves to Friday and a Friday pickup to Saturday. For a Thursday-pickup home, Wednesday evening sends no pickup push, and Thursday evening sends "Garbage tomorrow" / "Bins out tonight. Moved a day for Thanksgiving." Today shows the moved dates and the holiday line.
- Daylight saving ends November 1. The 6 p.m. push arrives at 6 p.m. local before and after.
- A private-setup home behaves the same as a shared home.

## 6. WP4 · Radon, from fact to reminder (F5, small)

**Proposed owner:** 4-1, with 3-1 reviewing the task path. **Depends on:** WP2, and the notification actions from WP3 for the buttons.

**Where:** on the Today tab of a home, shared or private setup, below the address calendar card, whenever the home's `lead_radon` section reports a `radon_zone`.

**How answers are stored.** No new table, column or settings key. An answer is a `HomeTask` whose `details.suggestion` is `"radon_test"`. Task writes accept `task_type`, `title`, `description`, `due_at`, `status`, `details` and a few other fields, and `details` may hold any keys except the source-mail keys (`supabase/migrations/20260910060000_home_record_transactions.sql:237-251`). Create through `POST /api/homes/:id/tasks` (`backend/routes/home.js:2524`; iOS `Features/Homes/Tasks/HomeTaskAccess.swift:133`; Android `HomeTaskAccess.kt:95`). Decode `details` in the task models if they don't already. The card's state comes from `GET /api/homes/:id/tasks`: an open radon task means "on your list", a done one means "tested".

**The card**
- **Ask** (no radon task exists, and not dismissed on this device):
  - Title: **"Was radon tested during your inspection or since you moved in?"**
  - Body, by zone: zone 1 **"{County} is in the EPA's highest radon zone."**; zone 2 **"{County} is in the EPA's moderate radon zone."**; zone 3 **"{County} is in the EPA's lowest radon zone."** Then: **"The EPA recommends testing every home, whatever the zone."**
  - Source line: **"EPA radon zones"**, linking to https://www.epa.gov/radon/epa-map-radon-zones-0
  - Buttons: **"Yes"**, **"No or not sure"**, **"Not now"**.
- **Yes:** a sheet **"When was it tested?"** with an optional date and an optional **"Result (pCi/L)"**, then **"Save"**. Creates `{task_type: 'reminder', title: 'Radon test', status: 'done', due_at: <date or today>, details: {suggestion: 'radon_test', tested_on?, result_pci?}}`. The card then reads **"Radon tested {date}"**, plus **" · {result} pCi/L"** when known. Sends `suggestion_decision` with `already_tested`.
- **No or not sure:** a sheet **"Add a radon test to your list"** with a date that defaults to 14 days from today and can't be in the past, then **"Add reminder"**. Creates `{task_type: 'reminder', title: 'Test for radon', description: 'The EPA recommends testing every home. Short-term test kits are sold at hardware stores and online. https://www.epa.gov/radon', due_at: <date>, details: {suggestion: 'radon_test'}}`. The card then reads **"Radon test on your list for {date}"** with **"Change date"**. Sends `suggestion_decision` with `reminder_added`.
- **Not now:** hides the card on this device for 30 days (iOS `UserDefaults`, Android DataStore; key `radonCard.dismissedUntil.<homeId>`). Sends `suggestion_decision` with `not_now`.
- After the task is done: **"Radon test done {date}"**.

**The reminder**
The due-day push comes from `_process_tasks_due` in `pantopus-seeder/src/handlers/home_reminders.py:147-205`, through `POST /api/internal/briefing/reminder-push` (`backend/routes/internalBriefing.js:478`). Fix two defects there first:
1. The status filter at `:157` excludes `"completed"` and `"cancelled"`, but the stored values are `done` and `canceled`, so finished tasks still get pushes. Use `not.in.("done","canceled")`.
2. Recipients ignore the task's visibility: the job sends to the assignee, otherwise to every active occupant. Send to the assignee if set. Otherwise send to the task's creator and to each active occupant for whom `home_record_recipient(home_id, user_id, 'task', visibility)` returns true (`supabase/migrations/20260910060000_home_record_transactions.sql`). The creator rule keeps private-setup homes working, because their creator isn't verified yet.

Then add `category: 'TASK_REMINDER'`, `taskId` and `homeId` to the `task_due` reminder data so the buttons appear, and record `reminder_sent` (WP7).
- **"Done"** sends `PUT /api/homes/:homeId/tasks/:taskId` with `{status: 'done'}` (iOS `HomeTaskAccess.swift:102`; Android `HomeTaskAccess.kt:65`), then `reminder_action` with `{kind: 'task', action: 'done'}`.
- **"Not now"** opens the task with its due-date editor, and sends `reminder_action` with `{kind: 'task', action: 'not_now'}`.

**Do not** build a suggestion engine or other suggestions, the `saved_place` calendar scope, new tables or columns, or kit links.

**Acceptance** (on a shared home and on a private-setup home)
- "No or not sure" with tomorrow's date puts "Test for radon" in the home's task list. The next day the reminder arrives with "Done" and "Not now". "Done" completes the task, and the card reads "Radon test done {date}".
- "Yes" with a date records a done task, and no device asks again.
- "Not now" hides the card on this device for 30 days.
- A done or canceled task never gets a due-day push.
- A task whose visibility excludes someone never reaches that person.

## 7. WP5 · One first-use prompt (F2, small)

**Proposed owner:** 4-1. **Depends on:** WP3 and WP4.

- On a home's Today tab, above the other cards, show one card while the home needs a pickup day or the radon question is unanswered, unless it was dismissed on this device. A home needs a pickup day when its calendar's `needs_pickup_day` is true. When the `address_calendar` section is `unavailable`, use the calendar WP3 item 7a loads.
- Title **"Two things for your home"**. Rows: **"Set your pickup day"**, which opens the pickup editor, and **"Was radon tested?"**, which scrolls to the radon card. Each row disappears once done. **"Later"** hides the card on this device (key `firstUse.dismissed.<homeId>`).
- No server storage and no new endpoint.
- Acceptance: a new private-setup home shows the card with both rows; setting a pickup day removes the first row; answering radon removes the card; "Later" hides it on this device.

## 8. WP6 · The household step and the invite verification fix (F3 small, F3b gate)

**Proposed owner:** 3-1. **Depends on:** WP4. The household step needs a shared home, because a private setup can't hold household members.

**8.1 Tell the creator when someone else finishes a task.**
- Wire `notifyTaskCompleted({creatorUserId, completedByName, taskTitle, homeId})` (`backend/services/notificationService.js:537`; it has no callers today). Call it after a successful update that moves a task to `done` when the actor isn't the creator, in `PUT /api/homes/:id/tasks/:recordId` (`backend/routes/home.js:2555`) and `PATCH /tasks/:id` (`backend/routes/mailboxV2Phase3.js:1083`). Notify once per completion: setting `done` again doesn't notify again.
- Tapping it already opens the task on both apps (iOS `Core/Routing/HomeTaskNotificationRoute.swift:5-22`; Android `core/routing/HomeTaskNotificationRoute.kt:36`).
- Members already have `tasks.view` and `tasks.edit` (`supabase/migrations/20260912050000_home_member_task_defaults.sql:18-19`), so an invited member sees the radon task and can complete it. No permission change.

**8.2 The F3b gate (decision 8, September 16).** One migration:
- Add `HomeOccupancy.verification_source text NOT NULL DEFAULT 'legacy'` with `CHECK (verification_source IN ('address','household','legacy'))`.
- Backfill: an occupancy that came from an accepted `HomeInvite` for that home and user gets `household`. One with a verified address claim, postcard or document verification for that home and user gets `address`. The rest stay `legacy`.
- Replace `act_on_home_invitation` with `CREATE OR REPLACE FUNCTION`, copied from its latest body (`supabase/migrations/20260912040000_home_invitation_sender_recovery.sql:278`). Make one change: the UPDATE (`:391`) and INSERT (`:400`) also set `verification_source = 'household'`. Keep its grants and revokes identical.

Then the server code:
- **Writers.** `backend/services/occupancyAttachService.js` sets `verification_source = 'address'` wherever it marks an occupancy verified (`_createOccupancy :581`, `_reactivateOccupancy :646`, `_handleExistingActive :710-720`), and so does the admin override.
- **Gate.** `isVerifiedResident` (`backend/utils/homePermissions.js:432`) returns false when `verification_source === 'household'`; `legacy` counts as address. That covers block founders, fridge cards, record watches, Real Rent, residency claims and residency letters. Apply the same rule to the neighbor-message sender gate (`backend/routes/neighborMessages.js:77-92, :126`) and to `hasVerifiedSenderHome` (`backend/routes/mailCompose.js:28-48`).
- **Household tools stay as they are.** Tasks, calendar and the household mailbox keep using `verification_status`.

On the apps:
- **Copy.** Replace "This invitation does not grant ownership." on iOS (`Features/TokenAccept/HomeInvitationDecisionView.swift:116`) and Android (`ui/screens/token_accept/HomeInvitationDecisionScreen.kt:102`) with **"This invitation gives you household access. To send neighbor messages or get a residency letter, verify the address yourself."**

**Acceptance**
- An owner with a shared home invites a member by email. The member accepts on the other platform, sees "Test for radon" and completes it. The owner gets the task-completed notification, and tapping it opens the task.
- The invited member can't request a residency letter or send a neighbor message, and gets the existing locked responses. A resident verified by postcard before the migration still can.
- All three source values behave as specified. Add a case to the existing home invitation SQL contract tests if they cover `act_on_home_invitation`.

## 9. WP7 · Pilot measurement

**Proposed owner:** Stream 1. **Depends on:** nothing. Land the migration first so the other packages can record events.

**Backend**
- Migration: widen `funnelevent_type_check` (baseline `:9651`) with `session_open`, `reminder_sent`, `reminder_action` and `suggestion_decision`, keeping the six existing values.
- `backend/services/funnelEvents.js`: add the four types to `FUNNEL_EVENT_TYPES`, and add `APP_POSTABLE_EVENT_TYPES = ['session_open', 'reminder_action', 'suggestion_decision']`. Leave the anonymous `CLIENT_POSTABLE_EVENT_TYPES` unchanged.
- New route `POST /api/hub/funnel-events` in `backend/routes/hub.js` (mounted at `/api/hub`, `backend/app.js:448`). It uses `verifyToken` and `express.json({ limit: '2kb' })`, takes a body of `{event_type, meta}`, accepts only app-postable types, records with `userId: req.user.id`, and always returns 204. The anonymous `POST /api/public/funnel-events` (`backend/routes/public.js:753`) stays as is.
- The server records `reminder_sent`. In `/api/internal/briefing/send`, record it after a pickup-led evening push, with `meta {kind: 'pickup'}`. In `/api/internal/briefing/reminder-push`, record it after a `task_due` push, with `meta {kind: 'task'}`.
- In `backend/services/funnelReport.js` (`loadFunnelSummary`, `:118`), add counts per new type, grouped by `meta.kind`, `meta.action`, `meta.decision` and `meta.trigger`.
- Add an activation count: users created in the window who, within seven days, have a saved place or a home, and either a confirmed pickup day or a radon task. It's read through `GET /api/admin/funnel/summary` (`backend/routes/admin.js:92`).

**Apps**
- `session_open` fires on cold start, and on returning to the foreground after 30 minutes or more in the background. Send `meta {platform: 'ios'|'android', trigger: 'push'|'organic', push_type?}`, where `push` means the app was opened from a notification and `push_type` is that payload's `type`.
- `reminder_action` and `suggestion_decision` fire as WP3 and WP4 describe.
- Never put addresses, coordinates, names or free text in `meta`.
- Leave the apps' existing analytics alone (iOS `Core/Analytics/Analytics.swift:265`, Android `data/analytics/Analytics.kt:325`). `FunnelEvent` is the pilot's record.

**Acceptance:** after running the WP3 and WP4 journeys, every new event shows up in the funnel summary with the right counts.

## 10. WP8 · Support Train reminders for helpers who signed up by email

**Proposed owner:** Stream 1. **Depends on:** nothing.

**Why:** Support Trains is the only part of the app with real use today. Two defects in its reminder jobs (`backend/jobs/supportTrainReminders.js`):
- both jobs skip guest reservations (`:42`, `:108`, `.not('user_id','is',null)`);
- both read and stamp the same `last_reminder_sent` (`:41`/`:107`, `:72-75`/`:139-142`), so a helper who got the 24-hour reminder never gets the day-of one.

**Backend**
- Migration: add `SupportTrainReservation.day_of_reminder_sent_at timestamptz`, nullable. The 24-hour job keeps `last_reminder_sent`; the day-of job uses the new column.
- Include guest reservations, where `user_id` is null and `guest_email` is set (baseline `:14610`). They get an email instead of a push, through a new `sendGuestReservationReminderEmail` in `backend/services/emailService.js`. Model it on `sendGuestReservationConfirmationEmail` (`:597`).
  - Contents: the train title, the slot's date and time window, what the helper signed up to bring, and the same links the confirmation email carries.
  - Include the drop-off address only if the guest already received it, the same rule `sendGuestReservationAddressEmail` (`:703`) follows.
- Signed-in helpers keep their push reminders.

**Copy:** subject **"Reminder: {train title} tomorrow"** and **"Reminder: {train title} today"**.

**Acceptance**
- A helper who signed up by email with a slot tomorrow gets one email the day before and one on the day.
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

Build each component into the shipped screen and keep that screen's layout. The "host" screens in the exports are the design board's, not the app's. Don't copy the drawing defects listed here; they come from `docs/design/exports/VERIFICATION.md`.

| Surface | Export | Use it for | Drawing defects not to copy |
|---|---|---|---|
| Today for a saved place | `f1-today-tab` | The saved-place Today and its chip | Tab bar escaping the phone; the wrong spoken label on "Change pickup day" |
| Pickup card on Today | `f4-today-pickup-card` | Card states | Asking more than one thing at a time |
| Pickup primer | `f4-notification-primer` | The primer sheet | Visible "[PLACEHOLDER]" boxes; the empty tray icon |
| Morning opt-in card | `f4-briefing-optin-card` | The card | Links shown by color alone; the cut-off AX5 link |
| Date picker for pickup and radon | `x-date-sheet` | Pickup mode and a single date only | Leader lines through labels |
| Source and "unconfirmed" line | `x-provenance-sheet` | The source line style only | Hosts hidden under the sheet |
| Curator chip | `f9-curator-chip` | The chip | None noted |

No export exists for the radon card, the first-use card or the notification buttons. Build them from existing design-system components and this brief's copy. The founder may draw them later.

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
9. F3b's server gate ships with WP6. Everyone verified before it ships stays verified.
10. The radon card, first-use card and notification buttons have no design export. They're built from existing components and this brief's copy.

**Still open. The brief builds the default until the founder decides:**
- The September 26 promise and pilot shape. Default: section 1.
- Who builds each package. Default: section 11; Stream 1 assigns.
- Whether invited household members see pickup days and bills. Default: not in the pilot. They see and complete shared tasks.
- Where the new promise appears. Default: the store listings and the app's first screen.
- The pilot start date. Default: when the founder's hosting work is done and one full journey works on the hosted backend.

## 15. Existing acceptance rows on the pilot path

These rows belong to their owning streams' backlogs, and this brief doesn't change their acceptance. Check their current status in the coordination guide before relying on them. From the September 26 tiers proposal:

| Area | Rows |
|---|---|
| Hosting and delivery (founder-owned) | O01, O03, O04, O05, O06, L01, L03 |
| Reminders | N05, N01, I04; N02 for an Android phone |
| Arrival and facts | A01, A02, A04, I05, I06 |
| Home path | H08, then H07 for the household step, and D06 |
| States on the journey screens | U03 |
