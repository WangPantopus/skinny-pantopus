# Map phase — the structural findings that change the screen count

Verified by 5 agents reading real files on branch `work-design-and-next-steps`, 2026-09-16.
169 existing surfaces mapped, 84 gaps. Full raw data: `wf-raw-results.json`, all gaps: `map-gaps.md`.

## A. The one that reshapes everything: "Today" exists TWICE on every platform

Two different screens are both called Today, fed by two different payloads, gated differently:

| Platform | Screen 1 — briefing payload `GET /api/hub/today` | Screen 2 — intelligence payload `GET /api/homes/:id/intelligence` |
|---|---|---|
| Web | `/app/today` (re-exports `hub/today/page.tsx`) — no home needed | `/app/place/today` (`TodayDetail.tsx` via `PlaceSectionDetail`) — **requires a claimed primary home** |
| iOS | `TodayDetailView` — reachable ONLY when a push carries a briefing deliveryId (`RootTabView.swift:257-263`) | `AddressTodayTabView` — the actual Today tab, needs a home id (`:132`) |
| Android | hub/today briefing screen (`TodayDetailUiState`) | `TodayTabViewModel` -> `PlaceTodayDetailContent` (`GET .../intelligence`, L58) |

Consequences the design doc does not name:
- **F1 changes screen 1. F5 and F11 target screen 2.** The doc's copy does not distinguish them.
- `today.location.source` (the thing F1's "Saved place · Only you" chip switches on) exists only on
  screen 1. Screen 2's payload has no `location.source` at all.
- iOS screen 1 is **unreachable without a push**. Android's `kicker` slot F11 names is on screen 1,
  but the Today *tab* (`PlaceTodayDetailContent.kt:58-111`) has no kicker at all.
- The morning-briefing opt-in the doc wants "moved into the Today tab" lives on screen 2 on web
  (`TodayDetail.tsx:415-529`, appendix cite `:443-498` is stale) and in Settings-only on iOS
  (`NotificationSettingsViewModel.swift:251-295`) and has no Android twin on Today.

**This is a screen-design decision, not a detail.** Either unify the two Todays or state which one
each feature lands on. It is the single biggest open question the inventory has to answer.

## B. The design doc's Android premise is WRONG

Doc says "Android has no saved-places client" and budgets 3d for F1 on Android (the largest single
native line in the effort table). It exists:
- `SavedPlacesApi.kt:18-44` (list/save/delete against `/api/saved-places`)
- `SavedPlacesRepository.kt:20-30`, `SavedPlacesDtos.kt` (all four payloads)
- `SavedPlacesScreen.kt:64-120` renders the list
- `HomeTabHostViewModel.kt:73-109` already POSTs a saved place in the post-signin arrival flow

F1's Android estimate should drop. But Android's *real* F1 obstacle is different and unnamed:
`TodayTabViewModel` renders the **intelligence** payload, never `/api/hub/today`, so there is no
`location.source` on that screen to switch a chip on (see finding A).

## C. F2's checklist is invisible to exactly the users F2 targets

- **Web:** `PlaceDashboard` returns `SavedPlaceContext` and stops at `:133-139`, *before* the
  `SetupBanner` mount at `:157-159`. A user with a saved place and no home never sees any checklist
  on the Place tab. The only other mount is `/app/hub` (`hub/page.tsx:215`) — **and `/app/hub` is not
  one of the four tabs** (`MobileTabBar.tsx:22-27`).
- **iOS:** `hub.setup.steps` renders only in the first-run state gated on `hub.homes.isEmpty`
  (`HubViewModel.swift:207-229, :300-304`). Every other session collapses to a hard-coded amber
  "Verify your address" banner (`HubState.swift:221-229`). Step copy cannot be expressed.
- **Android:** `HubViewModel.kt:384-391` builds step titles mechanically from the backend key
  (`key.replace('_',' ').capitalize()`), so the designed strings ("Set your pickup day") are
  impossible — it would render "Pickup day".
- **Web again:** `SetupBanner.tsx:14-21` knows only 6 keys; an unknown key renders the raw key string
  and routes to `/app/profile/edit` (`:45`). Shipping the new keys from `hub.js` before the client map
  lands degrades silently. And `:34` picks the title "Set up your place" only when a step keyed
  `home` or `verify` is undone — re-keying `home`→`save_place` silently flips the title to
  "Complete your profile".

F2 therefore needs a real checklist surface, not a re-key.

## D. Free screens — already built, not reachable

- **Web household calendar exists and is ORPHANED.** `/app/homes/[id]/calendar` (`HomeAgenda`, full
  read-only gated mode) has **no link anywhere in the web app**. `HomeHeader.tsx:17-22` tabs are
  Dashboard | Share | Members & Security | Settings only. F3 wants members to see the household
  calendar; the screen is done, it needs an entry point.
- **`getHomeInvitations()` exists and is dead.** `frontend/packages/api/src/endpoints/homes.ts:397`
  → `GET /api/homes/invitations`, **zero callers** on web; no iOS client; no Android client. The
  "Invitations waiting for you" list is a render away on web, a client away on natives.
- **iOS camera plumbing is reusable** for F10: `SystemCameraPicker.swift:13`, wired in `UnboxingView`.
  Android has CameraX available. The "Scan today's stack" CTA is fully built on both and wired to a
  no-op (`YouTabRoot.swift:1019-1022`; `RootTabScreen.kt:5617`).
- **`AddressCalendarCard` has a half-built `homeId=null` preview mode** (`:99-101, :153, :166`) with a
  test (`addressCalendarCard.test.tsx:21`) but no app code ever renders it with null. It hides the
  control when null — it is a preview mode, not a saved-place mode; it still cannot write anything.

## E. Bugs found that are worse than the doc says

1. **The web Members "Invite" button LIES.** Both buttons (`members/page.tsx:204-209`, `:281-286`)
   push to `/members/add-guest`, and `add-guest/page.tsx:27-36` makes **no API call at all** — the
   comment reads "This would call the invite/guest-pass API" and it **toasts success unconditionally**.
   Someone who taps Invite today believes they invited a person and nothing happened. The doc calls
   this a "Members page fix"; it is a silent data-loss-shaped bug on the household's front door.
2. **Web documents delete is client-only** (`docs/page.tsx:42-47`): filters local state, toasts
   "Document removed", **no API call**. Relevant before F3b classifies documents as a household surface.
3. **Per-home notification toggles are fake** (`homes/[id]/settings/page.tsx:157-167`): five toggles in
   local `useState` with an explicit "real impl would persist" comment (`:37-38`). F5's calendar
   reminders and F3's three new notification types have no working opt-out surface.
4. **Bill delete status bug confirmed** (`bills/page.tsx:91` writes `'cancelled'`, filter at `:58-59`
   excludes `'canceled'`) — a deleted bill stays in Upcoming.
5. **iOS already stamps a green "Household access" chip** off `occupancy.verificationStatus == "verified"`
   in `MyHomesListViewModel` — directly contradicts F3b's split before it ships.
6. **Hub mail counts are silently wrong and swallowed** (`hub.js:221-227`, `:255-261` wrapped in
   `.catch(() => ({count: 0}))`). Doc risk #9 confirmed: F11's keeper mood would read zeros.
7. **Web pickup signal renders with the wrong icon today.** Backend emits kind `address_calendar`
   (`usefulnessEngine.js:310`); `HubTodaySignal.kind` (`types/src/ai.ts:334`) has no such member and
   both `SignalIcon` switches (`hub/today/page.tsx:50-66`, `HubTodayCard.tsx:49-66`) have a `calendar`
   case and no `address_calendar` case → falls through to the default Sparkles icon.

## F. Measurement is web-only by construction

**No funnel-event emitter exists on iOS or Android at all.** grep for `recordFunnelEvent` /
`FunnelEvent` returns nothing in either native tree. So:
- §5's `session_open { trigger }` has no native call site.
- F8's spread metric (compares ÷ aha views) is web-only.
- iOS parses `pantopus://today?src=widget` (`DeepLinkRouter.swift:493-500`) but **discards `src`**
  (reads only `deliveryId`/`kind`). Android's `DeepLinkRouter.kt` has no `src` handling at all.
- Android's `DeepLinkRouter.kt:551-570` enumerates only 8 `/homes/:id` destinations; F3's `bill_paid`
  link `/app/homes/:id/bills` and any calendar link fall through to `else -> HomeDetail(id)` (L569),
  i.e. **every new notification deep link mis-lands on the dashboard.**

This is a prerequisite, not a nice-to-have: the pilot's success criteria cannot be measured without it.

## G. Type-system tripwires that gate the work

- `HubTodayLocation.source` (`types/src/ai.ts:302`) is a **closed union** without `saved_place`.
  Adding it is a types-package change plus a rebuild of every consumer.
- `PlaceCalendarKind` (`types/src/placeIntelligence.ts:236-239`) has the 15 shipped kinds;
  `KIND_ICON` (`AddressCalendarCard.tsx:38-54`) is typed as a **total** `Record<PlaceCalendarKind, LucideIcon>`
  → widening the union is a **compile error** until every one of the 6 new F5 kinds gets an icon.
- Android `WidgetSnapshotStore.kt` interface is **hard-typed** to `List<WidgetTaskSnapshot>` (L55-65),
  prefs file name is `"tasks_near_me_widget"` (L143) — not extensible as-is for F7.
- iOS `WidgetSnapshotStoring` is typed to one concrete type; `project.yml:229-235` shares only
  `GigActivityAttributes` + `GigWidgetSnapshot` into the extension.

## H. Other unnamed obstacles

- **`move_in_date` is never collected or edited anywhere.** `JustMovedCard` (F6) is invisible without
  it (`isRecentMove` returns false for null), and `/app/homes/[id]/settings` exposes only nickname,
  address, type, role. F6 needs a place to enter a move-in date.
- **No evening-briefing control in the Place/Today area** on any platform — only
  `settings/notifications/page.tsx:146-150`. F4 rides the evening briefing and §5's activation counts
  `evening_briefing_enabled`.
- **`/app/place/*` detail pages resolve only the PRIMARY home** (`PlaceSectionDetail.tsx:82-89` uses
  `getPrimaryHome` with no `selectedHomeId`), unlike the dashboard which honours a switcher. A
  multi-home user who switches and taps into Today silently gets the primary home's calendar — which
  matters the moment F5 lets people *write* dates from that screen.
- **The saved-place surface renders in two different frames**: `/app/place?savedPlace=` renders
  `SavedPlaceContext` bare in a 760px div with no `PlaceShell`/nav rail (`place/page.tsx:43-44`),
  while the no-home fallback renders the same component inside `PlaceShell` (`PlaceDashboard.tsx:134-138`).
- **Every error retry on the web Today detail is a full page reload** (`TodayDetail.tsx:560,576,584,592`
  → `window.location.reload()`). Any new F5 write control there must survive or avoid that.
- **Two parallel settings surfaces and two parallel member surfaces on web** with no cross-links:
  `/app/homes/[id]/settings` vs dashboard `HomeSettingsTab.tsx` (636 lines); `/app/homes/[id]/members`
  vs `MembersSecurityTab.tsx` (537 lines). Any F3 copy change must be made in both or they drift.
- **F3b has no upgrade path**: `AuthenticatedInvitationPage` success offers only "Check current Home
  access" / "Open Home" (`:64-73`); `VerifyPromptSheet.tsx` ("What this unlocks", `:153-170`) is
  reachable only from the Place dashboard banner.
- **F8 native**: `PlacePreviewBody.swift` has **no share control at all** (wall at `:314-331` is
  headline + Continue + 24-hour line). iOS is a step behind Android, which has `ShareAddressLink`
  (`PlaceLaunchScreen.kt`). `frontend/packages/types/src/copy.ts` **does not exist** — the positioning
  line is duplicated verbatim in 5 places.
- **F8 OG**: `/api/og/place` reads only `address` (`route.tsx:45`), returns `ImageResponse` with **no
  headers argument** (`:124`) → no Cache-Control today; and it fetches the live preview with
  `cache:'no-store'` (`:51`), so a token-rendered card needs a different data path.
