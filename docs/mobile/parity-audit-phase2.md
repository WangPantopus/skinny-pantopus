# Mobile Parity, Deep-Link & Accessibility Audit — Phase 2 (Block 2G)

**Date:** 2026-06-04
**Scope:** iOS (`frontend/apps/ios/Pantopus`) vs Android
(`frontend/apps/android/app/src/main/java/app/pantopus/android`), focused on
the Phase 1–2 wired + net-new screens.
**Mode:** Audit + small corrective edits only. Every claimed mismatch below was
**verified against source** before acting — automated string-diffs
over-report parity failures (constant-based tags, shell-rendered states, and
deliberate platform idioms all look like "missing" identifiers to a naive
grep). The false positives are recorded in §6 so they aren't re-chased.

## Summary

| Check | Verdict | Fixes applied |
|-------|---------|---------------|
| 1. testTag / accessibilityIdentifier parity | **PASS** (after verification) | none needed — see §6 |
| 2. Behavior parity (states/actions/sort-filter/copy) | **PASS** w/ 2 copy fixes | Earn + Mail Task error copy (Android) |
| 3. Deep links | **FAIL → fixed** | 2 Android routes (`business/:username`, `businesses/:id/page-editor`) |
| 4. Accessibility | **PARTIAL** | documented; tap-target / type / contrast deferred (visual, need snapshot re-record) |

---

## CHECK 1 — Identifier parity (testTag ⟺ accessibilityIdentifier)

**Verdict: PASS.** Across the audited Wave-1/2 features (Earn, Mail Task, Home
Settings, Saved Places, Following, Audience Profile, Creator Audience, Business
Owner/Team, Transaction Reviews, Review Signups), the stable identifier sets
match once constant-defined tags and shared shells are accounted for.

| Feature | iOS file | Android file | Verdict |
|---------|----------|--------------|---------|
| Earn | `Features/Mailbox/Earn/EarnView.swift` | `ui/screens/mailbox/earn/EarnScreen.kt` | PASS |
| Mail Task | `Features/Mailbox/MailTask/MailTaskView.swift` | `…/mail_task/MailTaskScreen.kt` | PASS |
| Saved Places | `Features/SavedPlaces/SavedPlacesView.swift` (`savedPlaces.screen`) | `…/saved_places/SavedPlacesScreen.kt` (`SAVED_PLACES_TAG = "savedPlaces.screen"`) | PASS |
| Following | `Features/Following/FollowingView.swift` (`followingScreen`) | `…/following/FollowingScreen.kt` (`FOLLOWING_TAG = "followingScreen"`) | PASS |
| Creator Audience | `Features/CreatorAudience/YourAudienceView.swift` | `…/creator_audience/YourAudienceScreen.kt` | PASS |
| Business Owner | `Features/Businesses/OwnerDashboard/*` | `…/businesses/owner_dashboard/*` | PASS (idiom note below) |
| Business Team | `Features/Businesses/Team/*` | `…/businesses/team/*` | PASS |
| Transaction Reviews | `Features/TransactionReviews/*` | `…/transaction_reviews/*` | PASS |
| Review Signups | `Features/ReviewSignups/*` | `…/review_signups/*` (exists) | PASS |

### Acceptable platform-idiom divergences (NOT mismatches — left as-is)

- **Following mute custom-duration control.** iOS uses a native SwiftUI
  `Stepper` (`FollowingActionSheet.swift:151`, one tag
  `followingMute.customStepper`). Android uses an idiomatic custom `–`/value/`+`
  row (`FollowingActionSheet.kt`, three tags `followingMute.customMinus` /
  `customValue` / `customPlus`). The shared semantic contract (set custom mute
  days, then `followingMute.customApply`) is identical; the per-control tags
  legitimately differ because the control structure differs by platform idiom.
- **Following action-sheet dismissal.** iOS shows an explicit in-sheet **Cancel**
  card (`followingActionCancel`); Android uses Material's `ModalBottomSheet`
  scrim/drag dismiss (`onDismissRequest`). No `followingActionCancel` on Android
  is correct — there is no such button.
- **Home Settings root tag.** iOS tags the screen root `homeSettings`
  (`HomeSettingsView.swift:34`). Android renders Home Settings through the shared
  `GroupedListScreen` shell, which carries the shell's own root identifier; the
  shell takes no `modifier`, so a per-screen `homeSettings` root tag would mean
  threading a modifier through the shared shell — a shell-architecture change,
  not a small edit. Recorded as a minor follow-up (§7).

---

## CHECK 2 — Behavior parity

**Verdict: PASS** on render states, actions, sort/filter/tabs, and empty copy
across the spot-checked clusters (Mailbox, Homes, Business owner/team, Reviews,
Following/Audience). Representative confirmations:

- **Mailbox tabs** `all / unread / starred` match (`MailboxListViewModel`).
- **My Homes / My Businesses role labels**, empty headline+body strings match
  verbatim.
- **Review Signups filter** `All / Pending / Confirmed / Edited / Canceled` and
  every per-filter empty headline match verbatim.
- **Audience** tabs `Updates / Followers / Threads`, follower sort
  (`newestActive / highestTier / recentlyJoined / mostEngaged`), and thread
  filter (`all / unread / bronzePlus / flagged`) match.
- **Optimistic mutations** (follow/unfollow, mark-seen, mute, approve/decline,
  confirm signup) have matching optimistic+rollback shapes on both platforms.

### FIX — error-state copy divergence (Earn, Mail Task)

Two screens surfaced the **repository's generic error string** on Android where
iOS sets fixed, screen-specific copy. The error **headline** already matched
(Block 2F); the **body** drifted. Aligned Android to the iOS copy:

| Screen | iOS copy (reference) | Android before | Fix |
|--------|----------------------|----------------|-----|
| Earn | "We couldn't load your earnings. Check your connection and try again." (`EarnViewModel.swift:110`) | `summary.error.message` (raw) | `EarnViewModel.kt` now sets the iOS string |
| Mail Task | "We couldn't load this task. Check your connection and try again." (`MailTaskViewModel.swift:82`) | `result.error.message` (raw) | `MailTaskViewModel.kt` now sets the iOS string |

(The Mail Task 404 branch — "This task is no longer available." — already
matched on both platforms.) No earn/mailtask error-state snapshot golden exists
and no VM test asserts the error string, so the change is snapshot- and
test-safe.

---

## CHECK 3 — Deep links

Both platforms parse `pantopus://…` and `https://pantopus.app/…` through a
mirrored router (iOS `Core/Routing/DeepLinkRouter.swift`, Android
`core/routing/DeepLinkRouter.kt`) and resolve from cold start. The full route
table matched **except two** Android gaps — both with the target screen + nav
route already present, only the resolver/consumer wiring missing.

### FAIL → fixed

| Deep link | iOS | Android before | Fix |
|-----------|-----|----------------|-----|
| `pantopus://business/:username` (A10.6 public profile) | `.businessProfile` (tested) | **no `business` case → Unknown** | Added `Destination.BusinessProfile` + resolver `"business"` branch + consumer → `ChildRoutes.businessProfile(id)` |
| `pantopus://businesses/:id/page-editor` (A13.10 editor) | `.editBusinessPage` (tested) | **trailing path → Unknown** | Added `Destination.EditBusinessPage` + resolver branch + consumer → `ChildRoutes.editBusinessPage(id)` |

The Android `businesses/:id/<other>` trailing path was also aligned to iOS
(unknown trailing → `BusinessOwner`, matching `businessesDestination`). Added
mirrored resolver tests `business_profile_route` + `edit_business_page_route` to
`DeepLinkRouterTest.kt` (iOS already has `testBusinessProfileRoute` /
`testEditBusinessPageRoute`). With these, the Android `Destination` set is a
**full superset-match** of iOS — every externally-linkable screen resolves on
both platforms.

### Verified-parity routes (no change)

`feed · home · notifications · post · gig · listing · homes/:id[/dashboard /
members?tab=requests / owners/transfer / verify-landlord / verify-postcard /
waiting-room] · conversation · user · connections · beacons · discover-hub ·
support-trains/:id[/manage] · businesses/new · invite/:token ·
auth/reset-password?token · auth/verify-email?token&email · (+ bare
/reset-password, /verify-email) · settings/payments · wallet ·
mailbox/[vacation / mailday / stamps / earn / unboxing?id / translation?id /
tasks/:id] · identity/preview` — all resolve identically, including the
token/token_hash + fragment-param handling on the auth links.

---

## CHECK 4 — Accessibility

**Verdict: PARTIAL.** Labels are in good shape; tap-target / dynamic-type /
contrast items are real but are **visual or app-wide** and were deferred (a
size change shifts layout and would fail the Paparazzi / snapshot gates, which
this environment can't re-record — see §8).

### 4a. Interactive-element labels — PASS (with correction)

Icon-only controls carry accessible names on both platforms — iOS
`.accessibilityLabel` (e.g. EarnView back/help, overflow "More"), Android
`contentDescription` (e.g. `EarnScreen.kt` back "Back"). Decorative icons that
sit **next to a text label** inside the same control correctly use
`contentDescription = null` (e.g. `MailTaskScreen.kt:284` ShieldCheck + "Verified",
`:408` icon + label) — adding a description there would cause duplicate
TalkBack announcements. (These were the bulk of an automated tool's "FAIL"
list; they are correct as-is.)

### 4b. Tap targets ≥ 44pt / 48dp — findings (deferred)

Verified controls below the minimum (full hit area = an icon-only button frame):

| Platform | Location | Size |
|----------|----------|------|
| iOS | `SavedPlaceRowView.swift:101` (row overflow) | 28×28 |
| iOS | `SavePlaceSheet.swift:133` (sheet back) | 32×32 |
| iOS | `FollowingActionSheet.swift:126` (sheet back) | 32×32 |
| iOS | `FollowingView.swift:396` (row overflow) | 28×28 |
| Android | `FollowingScreen.kt:336` (row overflow) | 28.dp |
| Android | `FollowingActionSheet.kt:145` (avatar tap) | 32.dp |

Recommended: expand the tappable frame to 44pt / 48dp (icon stays visually
small, hit area grows). Deferred because it shifts layout in snapshotted rows.

### 4c. Dynamic Type / font scale — PARTIAL (app-wide pattern)

Both platforms use fixed sizes (`.font(.system(size:))` / `fontSize = N.sp`)
per designer frames rather than scalable text styles, app-wide. No critical
**body** text was found inside a fixed-height clipping container on the Wave-2
screens. Adopting `Dynamic Type` / `MaterialTheme.typography` tokens is an
app-wide effort tracked as a follow-up, not a 2G edit.

### 4d. Contrast tokens — PARTIAL

`appTextMuted` = `#9CA3AF` (verified `ui/theme/Color.kt:136`; iOS asset
`Neutral/AppTextMuted`) on `appSurface` `#FFFFFF` / `appBg` `#F6F7F9` is below
the WCAG-AA 4.5:1 threshold for normal-size body text. It is used only for
small captions/timestamps/hints (where the requirement is relaxed), so this is
a **watch item**: don't promote `appTextMuted` to body copy; prefer
`appTextSecondary` (`#6B7280`) there. Token-level, identical on both platforms.

---

## 5. Fixes applied (this pass)

| # | Fix | Files |
|---|-----|-------|
| 1 | Android deep link: `business/:username` → public profile | `core/routing/DeepLinkRouter.kt`, `ui/screens/root/RootTabScreen.kt`, `core/routing/DeepLinkRouterTest.kt` |
| 2 | Android deep link: `businesses/:id/page-editor` → editor | same three files |
| 3 | Earn error copy → matches iOS | `ui/screens/mailbox/earn/EarnViewModel.kt` |
| 4 | Mail Task error copy → matches iOS | `ui/screens/mailbox/mail_task/MailTaskViewModel.kt` |

All edits are Android-side (iOS was the complete reference for both deep links
and error copy). No iOS source changed in 2G.

## 6. False positives corrected (do not re-chase)

A naive cross-platform grep flagged these as failures; each is actually at
parity. Recorded so the next audit skips them:

- `savedPlaces.screen`, `followingScreen` "missing on Android" — present via
  the `SAVED_PLACES_TAG` / `FOLLOWING_TAG` **constants**, not string literals.
- `audienceSection.pending`, `audiencePending.approve/decline`,
  `audienceSection.tier{n}` "missing on Android" — all present in
  `YourAudienceScreen.kt` (`:300`, `:393`, `:386`, `:323`).
- Business Owner `topBar / liveBar / previewBar` "missing on iOS" — present in
  `BusinessOwnerView.swift`.
- Review Signups "missing on Android" — `review_signups/ReviewSignupsScreen.kt`
  exists with a ViewModel and tests.

## 7. Follow-ups (not in scope for a small-edit audit)

| Item | Effort | Notes |
|------|--------|-------|
| Tap-target sizing (6 controls in §4b) | S | Visual; bundle with a Paparazzi/snapshot re-record |
| `homeSettings` root tag on Android | S | Thread a `modifier` through `GroupedListScreen` |
| Dynamic Type / typography tokens | L | App-wide; replace fixed sizes with scalable styles |
| `appTextMuted` contrast review | S | Confirm AA wherever it's used at body size |

## 8. Verification

Linux environment with no Xcode and no Android SDK — the iOS/Android
build/lint/snapshot gates can't run locally, so changes are
correct-by-construction: deep-link edits are compiler-forced complete (the
consumer `when` over the sealed `Destination` is exhaustive, so the two new
cases require their consumer branches), reuse existing `ChildRoutes` builders
and registered NavHost routes, and are covered by new resolver tests mirroring
iOS. Error-copy edits change only string literals (no snapshot/test asserts
them). The authoritative gates are CI (`ios-ci.yml`, `android-ci.yml`:
ktlint / detekt / lint / test / paparazziVerify / assembleDebug), which run on
the PR.
