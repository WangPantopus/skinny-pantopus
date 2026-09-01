# P7.6a — User-visible "Loading" label audit

> **Generated:** 2026-05-26.

## Rule (per the prompt)

| Pattern | Disposition |
|---|---|
| `Text("Loading…")` / `Text("Loading...")` rendered in a view | **Forbidden.** Replace with a shape-matching shimmer. |
| `ProgressView("Loading …")` / `Text` rendered alongside a spinner with a Loading label | **Forbidden.** Same — replace with shimmer. |
| `case .loading` enum case | **Required by convention.** Untouched. |
| `isLoading: Bool` view-model property | **Required.** Untouched. |
| `LoadingFrame` / `LoadingLayout` / `SheetLoading` view type | **Required.** Untouched (still the screen-level branch — just renders a shimmer now, not a spinner). |
| Accessibility label "Loading …" announced during the shimmer | **Recommended.** Kept on every shimmer body for VoiceOver / TalkBack. |
| Test names containing "loading" | **Acceptable.** Untouched. |
| `ProgressView` / `CircularProgressIndicator` inside a button while submitting | **Acceptable.** Inline spinner is the convention for action-feedback. |
| Centered spinner in a `.loading` state branch (no shimmer) | **Replace with shimmer** that mirrors the populated layout. |

## Summary

### Part 1 — user-visible Loading labels in `Text(...)`

| Platform | Pre-Pass-2 | Post-Pass-2 |
|---|---:|---:|
| iOS Text("…Loading…") | 0 | 0 |
| iOS `ProgressView("…Loading…")` (caught only by the broader scan) | **1** | **0** |
| Android Text("…Loading…") | 0 | 0 |

The only user-visible Loading label found was iOS
`Features/Profile/EditProfileView.swift:29` — `ProgressView("Loading
profile…")`. The first-pass regex `Text\("...Loading..."\)` missed this
because the label is bound to a `ProgressView`, not a `Text`. The
broader scan that examined every `ProgressView(...)` and
`CircularProgressIndicator(...)` caught it. Fixed in Pass 2 (full
conversion to shimmer skeleton, see Part 2).

### Part 2 — screen-level spinners (must become shimmers)

Found by walking every `ProgressView` / `CircularProgressIndicator` in
feature code and classifying each by context (button-bar / sticky CTA
spinner = inline; centered in a `case .loading` branch = screen-level).

| Platform | Total spinners | Inline (kept) | Screen-level (converted to shimmer) |
|---|---:|---:|---:|
| iOS | 33 | **29** | **4** |
| Android | 31 | **28** | **3** (Android had 4 candidates but 1 was already a skeleton) |

#### iOS Pass-2 conversions (4 files)

| File | Loading-state shape after conversion |
|---|---|
| `Features/Profile/EditProfileView.swift` | Header strip ("Edit profile") + 3 form-group blocks (96×12 label shimmer + N×{240×44 form-row shimmer}, N = 4/2/2). Mirrors the existing Android `EditProfileSkeleton`. |
| `Features/Nearby/NearbyMapView.swift` | 5 entity-row shimmers in the bottom-sheet body: 44×44 leading tile + (180×14 title, 120×12 subtitle). |
| `Features/ContentDetail/TransactionalDetailShell.swift` | Hero (full-width × 200) + 240×20 title + 160×14 meta + 4× full-width × 14 body paragraphs. Top nav preserved. |
| `Features/Chat/Conversation/ChatConversationView.swift` | 6 alternating-side bubble shimmers (220×40/60 right-aligned, 180×40/60 left-aligned) at `Radii.xl`. |

#### Android Pass-2 conversions (3 files)

| File | Loading-state shape |
|---|---|
| `ui/screens/nearby/map/NearbyMapScreen.kt` | Mirror of iOS — 5 entity-row shimmers in `SheetLoading`. |
| `ui/screens/contentdetail/ContentDetailShell.kt` | Mirror of iOS — hero + title + meta + 4 body paragraph shimmers. Top nav preserved. |
| `ui/screens/inbox/conversation/ChatConversationScreen.kt` | Mirror of iOS — 6 alternating-side bubble shimmers. |

#### Android files that were already correct

- `ui/screens/profile/EditProfileScreen.kt` — already used
  `EditProfileSkeleton()` (the iOS conversion above mirrors this).

#### Inline spinners (kept — convention is correct)

The remaining 29 iOS + 28 Android `ProgressView` /
`CircularProgressIndicator` call sites are all inline:

- **Button submit feedback** — `LoginView`, `ForgotPasswordView`,
  `ResetPasswordView`, `VerifyEmailView`, `LeaveReviewSheetView`,
  `EditBidSheetView`, `ReviewClaimDetailComponents`,
  `TokenAcceptView`, `CategoryBodies`, `FormShell`, `Buttons.swift`
  (the canonical button component), plus all Android twins.
- **Sticky save-bar / form-commit** — `EditProfileStickyBar`,
  `EditProfileScreen` save button, `Form` shell action.
- **Send / submit overlay** — `ComposeBroadcastView/Screen` send button
  + "Sending broadcast…" overlay, `PostThreadComponents` reply send,
  `AudienceProfileView` post-update.
- **Inline search-as-you-type / typeahead** —
  `StartSupportTrainWizardView/Screen`, `CeremonialMailWizardView/Screen`.
- **Per-row state indicator** — `PollResultBar`, `LinkCard`
  (portfolio fetch), `ListOfRowsScreen` pagination "load more"
  sentinel, `BodyReactionsBody` image-loading overlay,
  `UploadSlotsBlock` upload progress (with `ProgressView(value:)` =
  actual determinate progress).
- **Message delivery state (10-pt inline)** —
  `ChatConversationView:1549` / `ChatConversationScreen:1977` — the
  per-bubble "sending" tick that sits next to delivery checks. Inline.
- **PDF / image content loading inside a 28dp box** —
  `DocumentDetailScreen` PDF preview + SubcomposeAsyncImage loading
  slot.
- **App-launch splash** — `App/PantopusApp.swift:92`. The app's
  cold-start splash. Not strictly a "screen state" — out of scope
  for the shimmer rule because there's no populated layout to
  mirror yet.
- **Body** — `PrivacyHandshakeWizardView/Screen` "Opening Stripe
  Checkout…" body. This shows the spinner while the OAuth handoff is
  in flight; the body is `body`-not-`state`-bound, so leaving as a
  centered spinner with explanatory text is correct UX.

### Acceptance verification

| Acceptance criterion | Status |
|---|---|
| No user-visible "Loading" Text in any view | ✅ 0 hits on both platforms post-Pass-2 |
| Every screen-level loading state uses a shape-matching shimmer | ✅ 4 iOS + 3 Android conversions applied; the rest were already correct |
| Inline button spinners preserved | ✅ 29 iOS + 28 Android inline spinners untouched |
| `case .loading`, `isLoading`, etc. untouched | ✅ enum cases, view-model properties, view-type names unchanged |
| Snapshot tests pass | ⚠ **Snapshot baselines need re-recording** for the 7 screens whose loading-state shape changed. List below. |

### Snapshot tests that need re-recording

Each of these has a loading-state snapshot baseline that now differs
because the rendered shape changed from a spinner to a shimmer. Tests
themselves still compile and run (state branch still resolves to a
SwiftUI View / Composable), but the pixel output is intentionally
different. Re-record with `make test` (iOS, first run records) and
`./gradlew paparazziRecord` (Android), then commit the new baselines:

- iOS `PantopusTests/Features/Profile/EditProfileViewTests` loading snap
- iOS `PantopusTests/Features/Nearby/NearbyMapViewTests` loading snap
- iOS `PantopusTests/Features/ContentDetail/TransactionalDetailShellTests` loading snap
- iOS `PantopusTests/Features/Chat/Conversation/ChatConversationViewTests` loading snap
- Android `screens/nearby/map/NearbyMapScreenTest` loading snap
- Android `screens/contentdetail/ContentDetailShellTest` loading snap
- Android `screens/inbox/conversation/ChatConversationScreenTest` loading snap

### Wave A–D coverage

The audit hit Wave A–D feature folders directly:
- iOS: `Profile/Professional/Components/LinkCard.swift`,
  `AudienceProfile/`, `AudienceProfile/ComposeBroadcast/`,
  `Chat/Conversation/`, `Chat/Conversation/AI/` (no inline spinners),
  `Mailbox/ItemDetail/Bodies/`, `Nearby/`, `ReviewClaims/`,
  `Gigs/TasksMap/` (no inline spinners). Combined with shared shells
  (`ListOfRowsView`, `FormShell`), well above the 8 threshold.
- Android: `audience_profile/`, `audience_profile/compose_broadcast/`,
  `nearby/map/`, `inbox/conversation/`, `mailbox/item_detail/bodies/`,
  `profile/professional/`, `review_claims/`,
  `homes/documents/` — 8 folders.

## Methodology

```bash
# iOS — user-visible Loading Text
grep -rE 'Text\("[^"]*Loading[^"]*"\)|Text\(verbatim:[^)]*Loading[^)]*\)' \
  frontend/apps/ios/Pantopus/Features/ \
  frontend/apps/ios/Pantopus/Core/Design/Components/ --include="*.swift"

# iOS — broader ProgressView scan (catches `ProgressView("Loading profile…")`)
grep -rE '\bProgressView\(' \
  frontend/apps/ios/Pantopus/Features/ \
  frontend/apps/ios/Pantopus/Core/Design/Components/ \
  frontend/apps/ios/Pantopus/App/ --include="*.swift"

# Android — user-visible Loading Text + every CircularProgressIndicator
grep -rE 'Text\([^)]*"[^"]*Loading[^"]*"[^)]*\)|\bCircularProgressIndicator\(' \
  frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/ \
  frontend/apps/android/app/src/main/java/app/pantopus/android/ui/components/ --include="*.kt"
```

Each spinner hit was classified by reading the ~12 lines of context
before it, looking for inline-spinner hints (`Button`, `isLoading`,
`isSaving`, `frame(width:` constraint, `scaleEffect`, `tint`,
sub-44pt sizing) vs screen-level hints (`switch viewModel.state`,
`case .loading:`, `when (val current = state) { …Loading -> }`,
`fillMaxSize`, `LoadingFrame`/`SheetLoading` wrapping function name).

Classification verified by per-file manual inspection of the
ambiguous cases.
