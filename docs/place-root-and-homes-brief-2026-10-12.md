# Place root, homes sheet and default home: build brief

**Date:** October 12, 2026. **Checked against:** `master` at `2f553dd89` and PR #2189 at `07553bc1e` (branch `codex/remove-place-hub`). Anchors are symbols, not line numbers; if code moved, find the same symbol before changing anything.
**Status:** written from the founder's review of PR #2189 on October 12. The founder approved the direction; nothing here is built. Where this brief and PR #2189 differ, this brief wins.
**Platforms:** iOS and Android. The backend and one additive migration are in WP4 only. No web interface work: the web keeps its Hub.

---

## 0. Read this before you start

- [AGENTS.md](../AGENTS.md) governs: reuse the existing screen, route, service and table; keep working screens' layouts; the four tabs and the Your Place sections don't change; launch flags stay off; migrations are additive; no new tables; no new unit tests (update an existing test or accessibility id in the same PR when the behavior it checks changed on purpose).
- **Done means verified in the real apps** (section 6): iOS simulator and Android emulator, a real local backend and database, relaunch, and the other person's view where there is one. Name what you couldn't verify.
- **Hot files.** `HubTabRoot.swift`, `RootTabScreen.kt`, `PlaceDashboardView.swift` and `PlaceDashboardScreen.kt` change in many open Instant Screens PRs (2152 to 2182). Rebase right before you open each PR, keep your diff in those files to what the work package needs, and never combine work packages.
- One work package per PR, in the order of section 3. WP2 on iOS and on Android can run in parallel. WP4's backend half can start any time.
- Don't message other sessions. If another session owns a file you need, the founder relays.

## 1. What the founder decided (October 12)

1. The mobile Hub stays removed (PR #2189).
2. The Place tab opens on Your Place for anyone with a Home they can open (shared or private setup). No list sits behind it.
3. Someone with no Home sees the address-first screen they saw before signing in: the promise and an address field. Not "No saved Homes yet".
4. The address under "Your Place" is a button. It opens a sheet that lists their homes, with Add a home, Manage homes and a default.
5. The person chooses the default home. It decides which Home the Place tab opens on, what Today shows and what the morning and evening briefings describe.
6. Add a home stays one tap away: a row in the sheet, and the + button on My homes.

Limit from September 22: the Place tab "stays as shipped" (the "place file" and "Your places" redesigns are out). This work changes the tab's navigation and one header control. It doesn't change the dashboard's sections or the four tabs.

## 2. How it works today

- **Landing.** iOS `HubTabRoot.resolvePlaceLanding` and `primaryHomeId(in:)` pick the home where the person is primary owner, else the first shared home (the list is newest first), else their private setup, then **push** `.placeDashboard(homeId:)` over a root view. Android `HomeTabHostViewModel.landingHome` plus a `LaunchedEffect` in the `PantopusRoute.Place` composable navigate to `ChildRoutes.placeDashboard`.
- **State kept only for that push.** iOS: `didAutoLandPlace`, `placeLandingNeedsHome`, `placeLandingOwed`, `isResolvingPlace`, `placeResolutionError`, `placeResolutionGeneration`, `confirmPlaceLanding`, `placeLandingDropped`, and `RootTabModel.placeAtRoot` / `placeReselectedAtRoot`. Android: `didLandPlace`, `homesShown`, `relandOnReturn` (`consumeReland`, `markLeftFromHomeList`), `placeReselects`.
- **The dashboard** hides its navigation bar and, once loaded, has no Back button (`place.back` exists only in its loading and error states). Re-tapping the Place tab pops to the root: UIKit does it on iOS, `popToTabRoot` on Android. So the root is reachable by tab re-tap, Android Back and the drawer's "Back to Place" row.
- **The switcher.** iOS `PlaceSwitcherSheet` and `PlaceSwitcherViewModel`, Android `PlaceSwitcherSheet` and `PlaceSwitcherViewModel`, titled "Switch place". It opens from the avatar. It lists `sharedHomes` only, so **a private setup is missing from it**. Selecting a row pushes another dashboard. It has an "Add a place" row (`place.switcher.add`).
- **My homes** rows open Home tools or Home tasks, never Your Place. It has a + button and a top-bar "Find or add a home".
- **Add Home** completion (`AddHomeOutboundEvent.openHomes` on both platforms) pushes My homes. The wizard knows `createdHomeId`; the event doesn't carry it.
- **No stored default.** Rules that can disagree for a person with two homes:
  - Place landing (above).
  - Today tab: its own copy of the same rule, iOS `AddressTodayTabView.resolveHome`, Android `TodayTabViewModel` (the home pick near the end of the file).
  - `GET /api/homes/primary` (`homeListService.read({ primary: true })`): oldest current occupancy, shared homes only ("personal setup is not residency").
  - Today content and the morning and evening briefings: `locationResolver.makePrimaryHomeResult`, the first active `HomeOccupancy` row with coordinates. That read has no `ORDER BY`.
  - Other client copies: iOS `MeViewModel.primaryHome(in:)`; Android `DeepLinkPlaceResolverViewModel`, `MeViewModel.primaryHome`.
- **A trap on the preferences row.** `UserNotificationPreferences.evening_briefing_enabled` defaults to true and the seeder schedules everyone with a row. Creating that row starts nightly pushes. `POST /api/saved-places` shows the safe pattern: insert only, with both briefings off, never overwrite.
- **Instant Screens.** Clients cache the home list under the `homes` topic. After a write they mark it stale (iOS `MyHomesListViewModel.deleteHome`: `store.markStale(topics: [ScreenTopic.homes, ScreenTopic.home(id), ScreenTopic.today])`). The server tells other devices with `sync:changed` (`backend/services/syncChangedService.js`, the `RULES` map).

## 3. Work packages (one PR each, in this order)

### WP1. First-run screen and three small fixes (amends PR #2189)

The founder relays this to the session that owns #2189, or it lands as a PR on top of master once #2189 merges.

**1.1 First-run screen.** A person with no Home entries at all sees the promise and the address field, using what already exists:
- iOS: give `PlaceLaunchView` an `embedded` mode that drops its top row (brand lockup, region pill, Cancel) and keeps everything else (promise, address field, preview, "Only you will see this.", example card). Host it as the Place root content: `PlaceLaunchView(onSignIn: {}, onCreateAccount: {}, onSavePreview: { path.append(.placeArrival) }, embedded: true)`. The signed-in call site in `HubTabRoot` (`case .savePlace`) shows the wiring. Keep the navigation bar with the bell and menu that #2189 added.
- Android: the same. The signed-in flow today is the `ChildRoutes.SAVE_PLACE` composable in `RootTabScreen`: `PlaceLaunchScreen(onSavePreview = ...)`, then `PendingPlaceScreen` fed by `HomeTabHostViewModel.arrival`. Extract that body into one function used by both the route and the first-run root, and give `PlaceLaunchScreen` an `embedded` parameter. Show the bell and menu as #2189 does on My homes.
- Don't touch the arrival flow, the preview or what "Save privately" does (`PendingPlaceView`: Save privately, See Today, Set up a Home). Use the strings already on the screen; there is no new copy.
- If the preview step collides with the navigation bar, hide the bar only while the preview shows.

**1.2 People with entries but none they can open** (only a pending ownership claim or residency request): keep My homes as the root for this case only, with its rows and their actions. Split the no-home landing in two: no entries at all gives the first-run screen; entries but none openable gives My homes. iOS: `resolvePlaceLanding` already reads the list. Android: split `HomeLanding.Homes`.

**1.3 One add control.** My homes shows the + button only when it has rows (the empty state's button is the add action). iOS `MyHomesListViewModel.fab`; Android `MyHomesListScreen` `fab`.

**1.4 "Back to Place" goes to Your Place.** The drawer row (Home and Business contexts) currently clears the stack to the root, which is now a list. Make it return to Your Place for the current home: iOS `onBackToHub` in `navigationDrawerOverlay`, Android the matching drawer handler. Row title stays "Back to Place"; subtitle becomes "Return to Your Place".

**1.5 Add Home ends on Your Place.** Carry the new home's id in the completion event (`openHome(homeId:)` replacing `openHomes`, or an added payload) on both platforms. When the new home is openable (shared or private setup) open Your Place for it; when it is a pending claim, open My homes as today.

### WP2. The "Your homes" sheet

```
Your homes                          x
+------------------------------------+
| (house) 412 Birch Ln     [Default] |
|         Camas · Verified           |
+------------------------------------+
| (house) 9 Elm St       Set default |
|         Vancouver · Claimed        |
+------------------------------------+
| (clock) 1207 Marina Cove           |
|         Verification in progress   |
+------------------------------------+
  (+) Add a home
      Claim or verify another address
              Manage homes
```

**2.1 The address is the button.** The address row under "Your Place" opens the sheet: iOS `PlaceDashboardView.header`, Android the header `Row` in `PlaceDashboardContent` (the `label` text). Show a map pin, the address and a trailing chevron in a tinted pill using existing tokens; 44 pt minimum target; the address truncates at large text. The avatar keeps opening the sheet too. Identifier `place.addressSwitcher`; accessibility label "Your homes", hint "Switch home or add a home".

**2.2 Rows.** Every Home the person can open (`access_kind` shared or private_setup), then pending entries (`verification`) as status rows that open My homes when tapped. Replace the trailing status chip and chevron with the Default pill or the Set default button (WP4); the status moves into the subtitle: "<City> · Verified", "<City> · Claimed", "<City> · Private setup"; pending rows reuse the strings My homes uses ("Verification in progress", "Ownership in review"). Active row keeps its highlight. Sort: default first (WP4), then by address.

**2.3 Footer.** "Add a home" with the subtitle "Claim or verify another address" (rename from "Add a place"; keep `place.switcher.add`), then a text link "Manage homes" that opens My homes (`place.switcher.manage`). With one home the sheet still shows the one row, Add a home and Manage homes, and no default controls.

**2.4 Data.** iOS `PlaceSwitcherViewModel.load()` and Android `PlaceSwitcherViewModel.load()` replace `sharedHomes` with the entries where `hasValidListContext` holds. Keep showing the store copy at once, then refresh.

**2.5 Selecting a row** keeps today's behavior in this package (open that home's dashboard). WP3 changes it.

### WP3. Your Place is the Place tab (and the Hub code goes)

**3.1 iOS root.** In `HubTabRoot.stackRoot` (hub mode) root the stack on a `placeRoot` state: `resolving`, `home(String)`, `firstRun`, `homesList` (pending-only), `error(String)`. Build the dashboard with the same factory the `.placeDashboard(homeId:)` destination uses (extract it), with `isActive` set to `path.isEmpty && rootTabs.selected == owningTab`. Remove `didAutoLandPlace`, `placeLandingNeedsHome`, `placeLandingOwed`, the scenePhase retry for an owed landing (the root's `.task(id:)` re-resolves when the tab is selected or the app becomes active), `confirmPlaceLanding`, `placeLandingDropped`, and `RootTabModel.placeAtRoot`. Keep the offline landing from the kept home list, `PlacePendingStore.bind` leading to `.placeArrival`, and the first-sign-in case where the Face ID offer and the "Save Password?" sheet cut a landing short.

**3.2 Android root.** Render `PlaceDashboardScreen(homeId = landing.homeId, ...)` directly in the `PantopusRoute.Place` composable; its view model is already keyed `place-$homeId`. Remove `didLandPlace`, `homesShown`, the landing-restoring `LaunchedEffect`s, `relandOnReturn` (`consumeReland`, `markLeftFromHomeList`) and `placeReselects`. Keep `replaceUnavailable` for a home that stops being readable. Keep `ChildRoutes.PLACE_DASHBOARD` for links.

**3.3 One current home.** The root's home is the person's current home. It is set by the landing, by choosing a row in the sheet and by a deep link to another home. Choosing a row **replaces** the root content (no push, no growing stack). iOS `onSelectHome`, Android `onSwitchHome`. The deep link case `pushPlace(homeId:slug:)` becomes: set the current home, pop to the root, push the detail page if the link named one.

**3.4 Tab re-tap** pops pushed screens back to the dashboard and scrolls it to the top. It never shows a list. iOS: reuse `placeReselectedAtRoot` as a scroll-to-top signal; Android: scroll in `PantopusBottomBar`'s re-tap path.

**3.5 States.** Loading shows the dashboard skeleton. Error shows Try again plus the bell and menu. First-run and pending-only roots show the bell and menu. My homes stays reachable from the sheet's Manage homes link, the drawer's "My homes" row and the pending-only root.

**3.6 Delete what the Hub left behind.**
- iOS: `Features/Hub/HubView.swift`, `HubViewModel*.swift`, `HubState.swift`, `Features/Hub/Sections/Hub*.swift` (about 2,800 lines) and `PantopusTests/Features/Hub/HubViewModelTests.swift`.
- Android: `ui/screens/hub/HubScreen.kt`, `HubViewModel.kt`, `HubUiState.kt`, `sections/Hub*.kt` (about 3,300 lines) and `HubViewModelTest.kt`.
- Keep `Features/Hub/Today/*` and `ui/screens/hub/today/*` (the briefing detail) and the DTOs and endpoints they use. Move `HubViewModel.greeting()` next to its only caller, `PlacePulseView`.
- The Recent activity screens and routes (iOS `HubRoute.recentActivity`, `RecentActivityView`; Android `RecentActivityScreen`, `ChildRoutes.RECENT_ACTIVITY`) lost their only entry point with the Hub. Delete them if nothing else reaches them when you build this.
- Update existing UI tests and ids that assumed the old root (`place.back` fallbacks, `myHomesList`). Don't add tests.

### WP4. Default home

**4.1 Migration** (additive; follow `scripts/db/check-migrations.cjs`; name it after master's newest migration):

```sql
-- Backwards compatible: yes. Adds one nullable column; nothing reads it until the app is updated.
SET LOCAL lock_timeout = '5s';
ALTER TABLE public."UserNotificationPreferences" ADD COLUMN IF NOT EXISTS default_home_id uuid;
COMMENT ON COLUMN public."UserNotificationPreferences".default_home_id IS
  'The Home the person chose as their default. Honored only while it is still one they can open; otherwise the automatic pick applies.';
```

Why this table: the row is private (profile endpoints never select it), the Today resolver already reads it, and its `location_mode = 'primary_home'` already names the idea. No foreign key and no index: validate on read and write. A new table needs the founder's approval, so don't add one. Never apply anything to a hosted database; the release path does that.

**4.2 API.**
- `PUT /api/homes/default` with `{ "home_id": "<uuid>" }`. `verifyToken`; Joi uuid; the home must be in `homeListService.read(userId).homes` with `access_kind` shared or private_setup. If the person has no preferences row, create it **insert only with `daily_briefing_enabled: false` and `evening_briefing_enabled: false`** (the pattern in `POST /api/saved-places`), then set only `default_home_id`. Call `clearHubTodayCache(userId)`. Return `{ "default_home_id": "<uuid>" }`. Don't call it `/primary`: `GET /api/homes/primary` means "oldest shared home" and keeps its meaning.
- `GET /api/homes/my-homes`: add `is_default: boolean` to every entry (additive, optional for old clients). Exactly one openable entry is true: the stored default if it is still openable, else the automatic pick. Verification entries are always false.
- The automatic pick is one function in `homeListService`: shared homes ranked as `read({ primary: true })` already ranks them (current occupancy, then verified owner, then the rest, oldest first), then private setups, oldest first.
- `locationResolver.resolveLocation`: add `default_home_id` to its existing preferences select; put that home first among `homeCandidates` when it is one of them; add `.order('created_at', { ascending: true })` to the `HomeOccupancy` read so "first" is deterministic. Today content and the briefings follow it with no other change.
- `syncChangedService.js`: add `'homes'` to the `UserNotificationPreferences` rule's topics so another device refreshes its list.

**4.3 Clients.**
- Decode `is_default` (optional, default false): iOS `MyHome` in `HomeDTOs.swift`, Android `MyHome` in `HomeDtos.kt`. Add one helper next to `MyHomesResponse` on each platform: the entry with `isDefault`, else today's rule. Make every copy of the pick use it: iOS `HubTabRoot.primaryHomeId(in:)`, `AddressTodayTabView.resolveHome`, `MeViewModel.primaryHome(in:)`; Android `HomeTabHostViewModel.landingHome`, `TodayTabViewModel`, `DeepLinkPlaceResolverViewModel`, `MeViewModel.primaryHome`. Leave the scheduling and mailbox copies (launch-cut features) alone.
- Sheet: the Default pill on the default row; a "Set default" text button on every other openable row, shown only when there are two or more openable homes. Tapping it calls `PUT /api/homes/default`, marks `homes` and `today` stale the way `deleteHome` does, and updates the sheet in place without closing it. On failure show an inline line, "Couldn't change your default home. Try again.", and keep the list as it was. Accessibility: button "Make <address> your default home"; pill "Default home"; identifier `place.switcher.default.<homeId>`.
- Today and the briefings follow the default, not the temporary current home chosen in the sheet (3.3). The Today header already shows its address.

**4.4 Don't.** Don't create a preferences row with briefings on. Don't change what `GET /api/homes/primary` returns (the web Hub reads it). Don't expose `default_home_id` through a profile endpoint. Don't add a settings screen for it. A pending claim can't be the default. Don't change any push.

## 4. Copy

| Where | Text |
|---|---|
| Sheet title | Your homes |
| Row subtitle | `<City> · Verified`, `<City> · Claimed`, `<City> · Private setup` |
| Pending row | Verification in progress, Ownership in review |
| Default pill | Default |
| Row action | Set default |
| Add row | Add a home / Claim or verify another address |
| Footer link | Manage homes |
| Drawer row | Back to Place / Return to Your Place |
| Address button | label "Your homes", hint "Switch home or add a home" |
| Set default failed | Couldn't change your default home. Try again. |
| First-run | the strings already in `PlaceLaunchView` and `PlaceLaunchScreen`; no new copy |

Copy is exact on both platforms. If a string doesn't fit, shorten it with the same meaning and say so in the PR.

## 5. Not in this build

- Any web change (the web Hub stays). Any new table. Any new screen: the first-run screen is the existing arrival screen in an embedded mode.
- Changes to the dashboard's sections, the four tabs, launch flags, `PendingPlaceView`, the preview, or Add Home's steps.
- A default-home settings screen, per-home push settings, pushes for homes other than the default.
- New unit tests.

## 6. Verify in the real apps

Use a real local backend and database, fresh synthetic accounts, the iOS simulator and the Android emulator. For each package, check what applies:

- **Accounts:** (a) brand new, no address; (b) a saved place only; (c) one private setup; (d) one verified Home; (e) two openable homes plus one pending claim; (f) only a pending claim.
- **WP1:** (a) shows the promise and the address field with the bell and menu, one add control only; preview, "Save privately" and "Set up a Home" still work; (f) shows My homes; "Back to Place" returns to Your Place; finishing Add Home lands on Your Place for the new home; a pending claim lands on My homes.
- **WP2:** the sheet lists (c) and (d) correctly, shows pending rows, never shows an empty list for a private setup; Add a home and Manage homes work; large text and TalkBack/VoiceOver.
- **WP3:** cold launch, relaunch, background and foreground, switching tabs and back, re-tap on Place (never a list), Android Back, the drawer, `pantopus://place` with and without a home id and with a section slug, a push tap, leaving a Home while viewing it, offline relaunch with a saved copy, sign out and in as another account (nothing from the first account shows), light and dark.
- **WP4:** set the default on one device and relaunch (lands on it); Today shows its address; the briefing preview for that account describes it (`backend/routes/internalBriefing.js` uses `resolveLocation`); leave the default home and check the fallback; a second device refreshes its list; confirm no `UserNotificationPreferences` row was created with briefings on.
- Run the relevant existing checks before pushing: SwiftLint and SwiftFormat, `verify-icons`, `verify-overline`, ktlint and detekt, the existing tests near what you changed, the backend tests that cover `homeListService` and `locationResolver`.
- Name what you could not check: physical phones, hosted services.

## 7. Decisions and defaults

The founder said to go with recommendations. Change any of these in this file.

1. The default home drives the Place landing, Today and the briefings. Other homes' reminders show in the app but don't push until multi-home accounts exist. Default: as written.
2. The automatic default (nothing chosen) is the first home added. Default: as written, section 4.2.
3. Choosing a home in the sheet changes the current home for the session; the default decides cold starts, Today and pushes. Default: as written.
4. The Recent activity screens are deleted with the Hub. Default: delete. Ask the founder if you find another way to reach them.
5. The web Hub stays until after pilot data.

## 8. Prompts to paste

Each starts a session on one package. Replace nothing; the brief carries the detail.

**WP1 (the session that owns PR #2189)**
> Read docs/place-root-and-homes-brief-2026-10-12.md (until it merges, run git fetch origin docs/place-root-and-homes-brief-2026-10-12 and read it from that branch). Build WP1 only, on iOS and Android, on top of PR #2189 (branch codex/remove-place-hub). Reuse the existing arrival screen; add no new screens or tests. Verify in the simulator and emulator with the accounts in section 6. Do not merge. Report what you could not verify.

**WP2**
> Read docs/place-root-and-homes-brief-2026-10-12.md (until it merges, run git fetch origin docs/place-root-and-homes-brief-2026-10-12 and read it from that branch). Build WP2 only (the Your homes sheet) on iOS and Android, in your own worktree from master. Keep the diff in PlaceDashboardView, PlaceDashboardScreen and the switcher files small and rebase right before opening the PR. Verify with the section 6 accounts. Do not merge.

**WP3**
> Read docs/place-root-and-homes-brief-2026-10-12.md (until it merges, run git fetch origin docs/place-root-and-homes-brief-2026-10-12 and read it from that branch). Build WP3 only (Your Place as the Place tab, and delete the dead Hub code) on iOS and Android, after WP1 and WP2 have merged. HubTabRoot.swift and RootTabScreen.kt are hot files: rebase right before the PR. Walk the whole section 6 WP3 list in the real apps. Do not merge.

**WP4**
> Read docs/place-root-and-homes-brief-2026-10-12.md (until it merges, run git fetch origin docs/place-root-and-homes-brief-2026-10-12 and read it from that branch). Build WP4 (default home): the migration, PUT /api/homes/default, is_default on my-homes, the resolver change, then the iOS and Android clients on top of WP2. Never create a UserNotificationPreferences row with briefings on. Do not touch hosted databases. Verify per section 6 WP4. Do not merge.
