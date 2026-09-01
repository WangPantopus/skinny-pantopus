# Mobile Seamlessness / Production-Hardening Pass (Block 2F)

**Date:** 2026-06-04
**Scope:** Cross-cutting state / offline / refresh / mutation polish on the
already-wired feature screens, both platforms
(iOS `frontend/apps/ios/Pantopus`, Android
`frontend/apps/android/app/src/main/java/app/pantopus/android`).
**Mode:** Sweep + standardize. Introduce one missing shared state component,
convert representative wired screens onto it, and audit the remaining five
hardening dimensions against the live code so the rest of the rollout is a
mechanical follow-up rather than a discovery exercise.

This pass runs on top of an already-mature base: the four-state rule, the
shared `EmptyState` / `OfflineBanner` / `Shimmer` components, and a uniform
`APIClient` / `ApiService` networking layer all predate it (documented in each
platform's `CLAUDE.md`). The job here is consistency, not new surface.

---

## 1. What shipped in this pass

### 1.1 New shared component — `ErrorState` (both platforms)

The four-state rule (loading → skeleton, empty → `EmptyState`, loaded, error →
"headline + body + Retry") was enforced everywhere, but the **error** state was
the one state with **no shared component** — every screen hand-rolled it. The
result: ~42 iOS screens and ~47 Android screens each repeating an
`EmptyState(icon: .alertCircle, …, cta: "Try again"/"Retry")` block, with the
CTA label and copy drifting screen to screen.

This pass adds the missing component so the error surface is declared once:

| Platform | File |
|----------|------|
| iOS | `Core/Design/Components/ErrorState.swift` |
| Android | `ui/components/ErrorState.kt` |

It is a deliberately thin wrapper over the existing `EmptyState`:

```swift
ErrorState(headline: "Couldn't load Earn", message: message) {
    await viewModel.refresh()
}
```

```kotlin
ErrorState(
    headline = "Couldn't load Earn",
    message = current.message,
    modifier = Modifier.testTag("earnError"),
    onRetry = onRetry,
)
```

Design notes:

- **Renders identically** to the de-facto `EmptyState(icon: .alertCircle …)`
  error block it replaces (same hero circle, same icon, same `Try again` CTA,
  same default tint/accent). Converting an existing inline error block is
  therefore a **no-visual-change refactor** — it does not move any snapshot
  golden.
- Ships sane **default copy** ("Something went wrong" / "We couldn't load this.
  Check your connection and try again.") for new screens, while existing
  screens keep their specific copy (e.g. "Couldn't load Earn") so error-message
  assertions in the unit suites stay green.
- `retryTitle` defaults to **"Try again"** — chosen as the canonical label over
  the minority "Retry" so the affordance reads the same app-wide.
- iOS smoke coverage added to `PantopusTests/Design/Components/ComponentRenderTests.swift`
  (`testErrorStateRenders`); Android ships `@Preview`s (a Paparazzi golden is
  intentionally **not** added — the component renders through the
  already-snapshotted `EmptyState`, and recording a new baseline requires a
  device/emulator run this pass can't perform).

### 1.2 Screens converted onto `ErrorState`

Converted the recently-wired Wave-2 (2A) feature screens whose error state
already used the canonical `EmptyState(.alertCircle)` idiom, so the conversion
is provably render-identical on both platforms:

| Feature | iOS | Android |
|---------|-----|---------|
| Earn dashboard (2A) | `Features/Mailbox/Earn/EarnView.swift` | `ui/screens/mailbox/earn/EarnScreen.kt` |
| Mail Task (2A) | `Features/Mailbox/MailTask/MailTaskView.swift` | `ui/screens/mailbox/mail_task/MailTaskContentViews.kt` |

Each keeps its existing accessibility identifier / test tag (`earnError`,
`mailTask_error`) and its headline/message copy, so existing UI and snapshot
tests are unaffected.

---

## 2. The two error idioms (standardization decision)

The sweep surfaced that the app actually carries **two** error-state visual
languages — this is the real inconsistency, and naming it is half the fix:

1. **`EmptyState` idiom (dominant).** 72 px tinted hero circle + `alertCircle`
   glyph (primary accent) + H3 headline + muted body + `PrimaryButton`, on
   `appBg`. ~42 iOS / ~47 Android screens (Earn, Mail Task, Business Owner,
   Edit Business Page, most Homes detail/form screens, …).
2. **Bespoke "inline" idiom.** A 40 px `alertCircle` in `Theme.Color.error`
   (no circle) + heading + body + `Try again`, used by the shared
   `ListOfRows` shell (`Features/Shared/ListOfRows/ListOfRowsView.swift:785`;
   `ui/screens/shared/list_of_rows/ListOfRowsScreen.kt:992`), and by a few
   hand-rolled screens (`CreatorInbox`, `SavedPlaces`, `DiscoverHub`).

**Decision:** `ErrorState` standardizes on idiom #1 (the majority). Idiom #2 is
left in place for now because:

- The `ListOfRows`/`GroupedList` shells and `CreatorInbox` are covered by
  **error-state snapshot goldens** (e.g.
  `…grouped_list_GroupedListSnapshotTest_grouped_list_loading_and_error_states.png`,
  the iOS `creator-inbox` render-smoke). Converting them changes pixels and
  requires a golden re-record, which needs the emulator/simulator suites that
  this environment cannot run (see §6).
- `SavedPlaces` pairs a **bespoke empty *and* error** on `appSurfaceMuted`
  (`SavedPlacesView.swift:237`, `SavedPlacesScreen.kt:500`). Converting only the
  error half would mismatch its own empty half — both should move together in a
  dedicated follow-up.

Reconciling idiom #2 onto `ErrorState` (or vice-versa) is the single largest
remaining consistency item and is called out as **Follow-up F1** below.

---

## 3. Dimension-by-dimension audit

Status legend: ✅ standardized · 🟡 partial / inconsistent · ⛔ gap.

### 3.1 States (loading / empty / error+retry) — 🟡→✅ for error

- Loading skeletons (`Shimmer` / feature skeletons) and `EmptyState` are
  already uniform per each `CLAUDE.md` state rule and enforced in review.
- Error was the gap; `ErrorState` (§1) closes the **component** gap. The
  **rollout** gap (converting the remaining ~40 idiom-#1 screens) is mechanical
  and snapshot-neutral — see **Follow-up F2** for the inventory.

### 3.2 Offline / network — 🟡 (iOS) · ⛔ (Android parity gap)

- **Offline banner.** iOS applies `.offlineBanner(isOffline:)` on **58**
  screens; Android's equivalent `OfflineBannerHost` is wired on only **3**
  (`grep -rl OfflineBanner ui/screens` → 3). This is the **biggest single
  parity gap** found. The component exists and is correct on both platforms —
  Android simply hasn't adopted it at the screen level. **Follow-up F3.**
- **Disable mutations while offline.** Present on only ~5 iOS / ~9 Android
  screens — **not** systematic. There is no shared "offline-disables-this-CTA"
  helper; today it's an ad-hoc `.disabled(!NetworkMonitor.shared.isOnline)` /
  `enabled = isOnline`. **Follow-up F4** proposes a shared modifier.
- **Auto-retry / refresh on reconnect.** Effectively absent — no
  `onChange(of: isOnline)` → reload on iOS, and a single Android screen
  (`BusinessTeamScreen.kt`) does it. The offline banner today only *shows*; it
  does not *recover*. **Follow-up F5.**
- **Request failures surfaced (not silent/crashing).** ✅ Failures map through
  `APIError` (iOS) / `NetworkResult.Failure(NetworkError)` (Android) and land in
  the `.error` state or a non-blocking `Toast`; no silent catches were found on
  the wired screens.

### 3.3 Refresh / pagination — ✅ refresh · 🟡 pagination (confirm per endpoint)

- **Pull-to-refresh.** Broadly wired: iOS `.refreshable` and the Android
  pull-refresh wrapper appear on the wired lists/details. (`refresh()` /
  `viewModel.refresh()` are the standard re-fetch entry points the new
  `ErrorState` retries call into.)
- **Pagination.** The `ListOfRows` shell already exposes `loadMoreIfNeeded()` /
  paging hooks, and limit/offset/cursor plumbing exists in many view-models.
  What's missing is a **per-endpoint confirmation table** (which endpoints
  actually accept `limit`/`offset`/cursor vs. return whole collections). That
  audit is endpoint-by-endpoint against `backend/routes/*` and is scoped as
  **Follow-up F6** — no list should *fake* infinite scroll over a
  non-paginating endpoint.

### 3.4 Optimistic mutations — ✅ (already standardized)

This dimension is in good shape and predates the pass:

- iOS: follow/unfollow optimistically mutate + roll back on failure
  (`Features/Following/FollowingViewModel.swift:180`); connections accept/reject
  likewise (`Features/Connections/ConnectionsViewModel.swift:214`).
- Android: optimistic + rollback across My Bids
  (`ui/screens/my_bids/MyBidsViewModel.kt`), Business Team role-change /
  permissions (`businesses/team/*ViewModel.kt`), Saved Places
  (`saved_places/SavedPlacesViewModel.kt`), etc.

The pattern (snapshot → apply locally → call → revert + error toast on failure)
is consistent. No code change needed; documented here as the reference pattern
for any new mutation.

### 3.5 Loading dedup / cancellation / debounce — 🟡

- **Search/filter debounce + cancellation** is centralized in the shared
  `SearchList` shell (iOS `Features/Shared/SearchList/*`, Android
  `ui/screens/shared/search_list/*`) — search screens that adopt the shell get
  debounce + in-flight cancellation for free.
- Bespoke (non-shell) lists rely on SwiftUI `.task`/Compose
  `collectAsStateWithLifecycle` lifecycle cancellation, which covers
  view-disappear but **not** param-change de-dup uniformly. No shared
  "cancel previous load on param change" helper exists outside the shells.
  Low-severity; **Follow-up F7.**

### 3.6 Auth / 401 — ✅ (uniform, graceful) · 🟡 (no token-refresh retry)

- **Uniform routing.** ✅ Every request routes 401 through one place per
  platform:
  - iOS `Core/Networking/APIClient.swift:207` → `AuthManager.shared.handleUnauthorized()` → `signOut()`.
  - Android `data/auth/AuthInterceptor.kt:38` (OkHttp interceptor on every
    request) → `AuthRepository.signOut()`; `SafeApiCall` also maps 401 →
    `NetworkError.Unauthorized`.
- **Graceful landing.** ✅ A hard 401 flips the app to the signed-out root, not
  a dead screen.
- **Token-refresh-on-401 is not wired.** Both platforms have the refresh
  primitive (`AuthManager.refreshSession()` at `AuthManager.swift:293`; Android
  `AuthApi.refresh`), but `handleUnauthorized` signs out immediately instead of
  attempting a silent refresh first (the iOS code even marks the spot:
  *"Extension point: try refresh-token flow here. For now, sign out."*). Wiring
  a single refresh-then-retry at these two choke points would remove avoidable
  sign-outs without touching any screen. **Follow-up F8.**

---

## 4. Standardized in this pass — summary

| Item | iOS | Android |
|------|-----|---------|
| Shared `ErrorState` component | ✅ added | ✅ added |
| Earn error → `ErrorState` | ✅ | ✅ |
| Mail Task error → `ErrorState` | ✅ | ✅ |
| Component smoke/preview coverage | ✅ render test | ✅ previews |

## 5. Couldn't follow the pattern (and why)

| Screen / area | Reason | Tracked as |
|---------------|--------|------------|
| `ListOfRows` / `GroupedList` shells | Use error idiom #2; covered by error-state goldens — needs a snapshot re-record (no emulator/simulator here) | F1 |
| `CreatorInbox` | Idiom #2 + `creator-inbox` golden | F1 |
| `SavedPlaces` | Bespoke empty+error pair on `appSurfaceMuted`; must convert both together | F1 |
| Home Settings index (2A) | Renders content with graceful fallback — has no dedicated full-screen error state to convert | n/a |
| Android offline-banner adoption (55 screens) | Wrapping each screen in `OfflineBannerHost` shifts the composition tree; needs per-screen snapshot verification | F3 |

## 6. Verification

This environment is Linux with no Xcode and no Android SDK, so the platform
build/lint/snapshot gates could **not** be run locally. Changes were made
**correct-by-construction**:

- All conversions are render-identical (same component output, identifiers, and
  copy) → existing snapshot goldens and error-message assertions are unmoved.
- New components mirror the established `EmptyState` API and the surrounding
  file/lint idioms (token-only colours, ktlint import order, trailing commas,
  detekt param limits, SwiftLint line length).
- Android import hygiene checked by hand: `EmptyState` is fully removed from the
  two converted files (import + call), `PantopusIcon` remains used, and the
  `ErrorState` import is placed in alphabetical order.

The authoritative gates remain CI:

- **iOS** (`.github/workflows/ios-ci.yml`): SwiftLint `--strict`,
  SwiftFormat `--lint`, feature-code hex guard, unit/snapshot tests on the iOS
  18.5 simulators.
- **Android** (`.github/workflows/android-ci.yml`): `ktlintCheck`, `detekt`,
  `lintDebug`, `test`, `paparazziVerify`, `:app:assembleDebug`.

Both jobs are path-filtered to `frontend/apps/{ios,android}/**`, so this pass
triggers both on the PR.

## 7. Prioritized follow-ups

| # | Follow-up | Effort | Why it matters |
|---|-----------|--------|----------------|
| F3 | Adopt `OfflineBannerHost` on the Android wired screens (→ parity with iOS's 58) | M | Largest parity gap; component already exists |
| F8 | Wire `refreshSession()` into `handleUnauthorized` / `AuthInterceptor` (refresh-then-retry before sign-out) | S | Removes avoidable sign-outs; two choke points |
| F5 | Auto-refresh on reconnect (`onChange(isOnline)` / `isOnline` collector → `refresh()`) | S–M | Offline banner currently shows but doesn't recover |
| F4 | Shared "disable-while-offline" modifier for mutating CTAs | S | Replaces ad-hoc `.disabled(!isOnline)` scattered across ~14 screens |
| F2 | Convert the remaining ~40 idiom-#1 error blocks to `ErrorState` | M | Mechanical, snapshot-neutral; finishes the §1 rollout |
| F6 | Per-endpoint pagination confirmation table (limit/offset/cursor vs. whole-collection) | M | Ensures no list fakes infinite scroll |
| F1 | Reconcile error idiom #2 (`ListOfRows`/shells/bespoke) onto `ErrorState`; re-record goldens | M–L | Removes the second error visual language |
| F7 | Shared "cancel previous load on param change" helper for non-shell lists | S | Tightens de-dup beyond the search shells |
