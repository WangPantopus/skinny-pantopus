# Cross-platform inventory diff (P6.7)

iOS (SwiftUI) ↔ Android (Jetpack Compose) per-screen parity audit. Every
screen built across Tiers 0–6 is compared on seven dimensions; any deltas
are listed under that screen. A dimension marked **Match** was verified
equivalent on both platforms after reading both sides. **N/A** marks a
dimension that does not apply (e.g. a screen with no inputs has no field
set). A screen with all-seven **Match** has parity.

This report only *records* drift. It does **not** fix anything — fixes are
the next prompt (P6.8).

## Dimensions compared

1. **State coverage** — loading / empty / populated / error (all four
   required for fetchable screens; forms & static pages legitimately have
   fewer — noted where so).
2. **Action affordances** — every button / link / tap target on one
   platform exists on the other.
3. **Field set** — every input field on one platform exists on the other.
4. **Validation rules** — same constraints (required, length, regex, …).
5. **Empty-state copy** — must match word-for-word.
6. **Error-state copy** — must match word-for-word.
7. **Animation / transition** — push vs sheet vs modal must match.

Paths in each section are relative to:
- iOS — `frontend/apps/ios/Pantopus/Features/`
- Android — `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/`

## Summary

**95 screen sections below**, covering every iOS↔Android surface across Tiers
0–6. The apps are built with strong parity discipline (shared archetype
shells, mirrored test tags, shared validators), so the large majority of
dimensions are **Match**. The deltas that exist cluster into a few systemic
patterns plus a set of per-screen specifics. (Fixes are P6.8, not this doc.)

### Systemic deltas (recur across many screens)

1. **Error-copy fallback drift.** iOS list/detail view-models hold a
   feature-specific fallback (e.g. `"Couldn't load your packages."`) behind
   `(error as? APIError)?.errorDescription`; the Android counterparts surface
   the raw `NetworkError.message` (or, on a few screens, always a hardcoded
   literal). Visible **headlines and the literal strings match** — the
   divergence is whether a server-supplied message can replace the fallback
   (and what shows when the network message is empty). Affects ~30 fetchable
   screens (Hub, Notifications, Recent activity, My homes/claims, Bills,
   Calendar, Documents, Emergency, Maintenance ×3, Members ×2, Owners,
   Packages ×3, Polls, Household tasks ×2, My listings/tasks/bids, Mailbox
   list/detail, Mail detail, Vault, My posts, My businesses, Identity Center,
   Creator inbox, Audience profile, Content detail, Nearby). Screens that
   hardcode the *same* literal both sides are full Match (Offers, Listing
   offers, Access codes, Support trains, Review signups, Review claims,
   Blocked users).

2. **Overflow / confirm presentation primitive.** iOS uses
   `.confirmationDialog` / `.alert`; Android uses `ModalBottomSheet` /
   `AlertDialog`. Same items + copy, different chrome. Overflow/kebab menus on
   Public profile, Business profile, My posts, Pulse post detail; Maintenance
   delete (iOS action sheet vs Android centered alert).

3. **Wizard / form presentation.** iOS presents the Invite-Member and
   Add/Edit-Pet wizards as `.sheet`; Android as full-screen `Dialog`. Owners
   "Invite an owner" is an in-place `.sheet` on iOS but a separate route on
   Android.

4. **Date entry control.** iOS uses native inline `DatePicker` wheels; Android
   substitutes a `DatePickerDialog` (Maintenance, Gig compose, Start poll) or,
   for Household-tasks due-date, a bare `yyyy-MM-dd` text field with no picker.
   Start-poll close-date loses time-of-day selection on Android.

5. **Offline submit guard.** iOS Start-poll, Add-household-task, Disambiguate,
   and Ceremonial-compose forms block submit when offline with the toast
   `"You're offline. Try again when you're back online."`; the Android
   equivalents have no pre-submit offline check.

6. **Loading representation.** Edit profile uses a screen-level `ProgressView`
   spinner on iOS vs a shimmer skeleton on Android (the project rule mandates
   a skeleton). Nearby and Content detail use a plain spinner on *both*
   (shared house-rule gap).

### Per-screen deltas (highest signal)

- **Verify email** — Android lacks the resend-countdown label and the
  "change email" sheet/field/validation iOS has.
- **Token Accept** — Android adds "Done"/"Close" buttons on terminal frames;
  iOS presents the screen as `.fullScreenCover` (modal) vs Android pushed route.
- **Public profile** — Android error state has no back chevron (unescapable).
- **Me / You** — Android Personal tab has a 7th "Support trains" tile absent
  on iOS.
- **Chat conversation** — Android attach button is a no-op (no attach menu).
- **Chat search** — iOS folds diacritics; Android folds case only.
- **Content detail (gig)** — Android renders the bids module to any viewer;
  iOS gates it to the owner.
- **Claim ownership** — iOS picker is image-only with a client 10 MB guard;
  Android also accepts PDF and has no size guard; accept-hint copy differs.
- **Invite owner** — iOS maps any HTTP 409 to the friendly inline error;
  Android matches on body substring only.
- **My bids** — iOS sets per-sheet detents (medium/large); Android uses
  full-height sheets for all three.
- **Gig compose / Pulse compose** — validation deltas (event-date rule; body
  min-length "Add a description.") + a couple Android-only placeholder strings.
- **Mail detail** — eyebrow trust dot is green on iOS vs slate on Android for
  `legal`/`tax` mail; community last-reply preview uses a colon on Android.
- **Start a train** — Android emits phase-specific launch errors ("Couldn't
  add a slot…", "Couldn't publish…") with no iOS counterpart.
- **Edit signup** — Android-only "missing seed" state + dietary-notes
  placeholder.
- **Settings → Help center** — "Email support" opens mail on iOS, no-op on
  Android.
- **Settings → Password change** — iOS-only HTTP-429 toast "Too many attempts.
  Wait a minute and try again."
- **Nearby** — neither platform has a dedicated empty state; drag velocity
  threshold (600 vs 1200) and active-pin pulse (animated iOS / static Android)
  differ.

### Parity confirmed
All 95 screens exist on both platforms (no platform-only screen). Empty-state
and error-state copy match word-for-word except where a fallback is bypassed
(systemic delta 1). Test tags, field sets, validators, and four-state coverage
match except where flagged in the sections below.

---

## P6.8 resolution log

Disposition of every P6.7 delta. **Environment note:** this container has
**no Swift toolchain, no Xcode, and no Android SDK**, so neither platform can
be compiled or snapshot-tested here — the authoritative gates are CI
(`ios-ci.yml`, `android-ci.yml`). Per the agreed approach, genuine localized
bugs are fixed in place (one commit per screen), native-platform idioms are
recorded as intentional, and structural / cross-DI / iOS-only changes that
can't be safely landed blind are tracked with a precise spec.

### Fixed (committed this session)

| Screen | Delta | Fix |
|---|---|---|
| Invite owner | Android matched "already active" on body substring only | Android `mapInviteError` now also keys on `NetworkError.code == 409`, mirroring iOS. |
| Public profile | Android error state had no back chevron (unescapable) | `ErrorLayout` now renders the `ContentDetailTopBar(onBack=)` that `LoadingLayout` already uses, matching iOS. |
| Me / You | iOS Personal grid missing the "Support trains" tile (design + Android have it) | Added the tile (`.handCoins`, `me.supportTrains`); route was already wired in `YouTabRoot`. |

### Already at parity (P6.7 false positive — corrected)

- **Settings → Help center.** P6.7 reported the Android "Email support" CTA as
  a no-op. It is in fact wired at `RootTabScreen.kt:2470-2480` to a
  `mailto:support@pantopus.app?subject=Help` intent (the audit missed the call
  site). No change needed; section corrected below.

### Intentional native-platform differences (no change — "keep native, document")

iOS HIG and Android Material prescribe different primitives for the same UX
role; forcing them identical would break platform convention.

- **Confirm / overflow menus** — iOS `.confirmationDialog`/`.alert` vs Android
  `ModalBottomSheet`/`AlertDialog` (Public profile & Business profile overflow,
  My posts & Pulse-post kebab, Maintenance delete). Same items + copy.
- **Date entry** — iOS inline wheel `DatePicker` vs Android `DatePickerDialog`
  (Maintenance, Gig compose, Start poll, Edit-profile DOB, Bills due-date).
- **Wizard / form presentation** — iOS `.sheet` vs Android full-screen `Dialog`
  (Invite member, Add pet); Owners invite `.sheet` vs route. Both modal.
- **My bids** — iOS partial sheet detents vs Android full-height sheet (both
  `ModalBottomSheet`-class). Sheet sizing only.
- **Token Accept** — iOS `.fullScreenCover` vs Android pushed route; the Android
  terminal Done/Close buttons exist because a pushed route needs an explicit
  dismiss where iOS dismisses the cover via callback. Tied to the nav model.
- **Map + motion** — Nearby uses MapKit (iOS) vs Google Maps (Android); release
  velocity (600 vs 1200) and active-pin pulse (animated iOS / static Android for
  Paparazzi determinism) differ by gesture/snapshot system. Detent heights match.
- **Household-tasks due-date (Android)** — a plain `yyyy-MM-dd` text field rather
  than a calendar dialog: an intentional Compose-DatePicker / Paparazzi
  compatibility choice noted in-code.
- **Nearby & Content-detail loading** — a plain spinner on *both* platforms (a
  shared house-rule gap, not a cross-platform delta).

### Tracked follow-ups (genuine; need a toolchain to land + verify)

Real cross-platform gaps whose fix is structural, crosses DI, or is iOS-only —
not safe to land blind in a no-compiler container. Spec'd for a toolchain env.

1. **Systemic error-copy fallback (~30 fetchable screens).** Android list/detail
   VMs surface raw `NetworkError.message`; iOS shows a feature fallback when the
   error has no description. Align by wrapping Android's string:
   `…Error(result.error.message.ifBlank { "Couldn't load X." })` per screen (or
   have iOS prefer the server message). Mechanical but broad — one dedicated
   sweep so it compiles + snapshot-checks together.
2. **Verify email (Android).** Add the resend-countdown label (render
   `cooldownRemaining()` as "Resend in Ns") + the "change email" sheet with its
   "New email" field and `AuthValidation.email` gate, matching iOS.
3. **Edit profile (iOS).** Replace the screen-level `ProgressView("Loading
   profile…")` with a shimmer skeleton (house-rule; Android already has
   `EditProfileSkeleton`).
4. **Content detail — gig bids (Android).** Gate the bids fetch + module on
   viewer-is-owner like iOS; requires injecting a current-user-id source into
   `GigDetailViewModel`. (Confirm whether the backend already restricts
   `/:gigId/bids` to the owner — if so this is defense-in-depth.)
5. **Chat conversation (Android).** Wire the attach button to an attach menu —
   after confirming the iOS attach actions are live flows vs stubs, mirror the
   live ones.
6. **Chat search (Android).** Add diacritic-insensitive matching to
   `ChatSearchText` (NFD-fold) preserving original-string offsets so highlight
   spans stay aligned.
7. **Claim ownership.** Reconcile picker types (iOS image-only + 10 MB guard;
   Android image+PDF, no guard) and accept-hint copy against backend support.
8. **Gig / Pulse compose.** Align validation + placeholders: Pulse body
   min-length message, event-date validator, Gig-compose description placeholder.
9. **Mail detail.** (a) Elevate `legal`/`tax` generic fallthrough to `.verified`
   on Android to match iOS. (b) Align community last-reply preview ("Author:
   preview" vs bold-author "Author preview").
10. **Start a train.** Pick canonical launch-error wording (iOS one generic vs
    Android phase-specific) and make both match.

Tracked as `P6.8-followup-*`; each lands as a scoped commit once a build/test
toolchain is available.

---

<!-- cluster:tier0-auth -->

## Login
- **iOS:** `Auth/LoginView.swift` · **Android:** `auth/LoginScreen.kt` (+ `LoginViewModel.kt`)
- **State coverage:** Match — form screen (no fetch). Both expose idle / loading (`isLoading` spinner in submit button) / error (inline banner). No empty/populated states needed.
- **Action affordances:** Match — submit "Log in" (`LoginView.swift:76` / `LoginScreen.kt:164`), "Forgot password?" link (`LoginView.swift:71` / `LoginScreen.kt:341`), "Create account" link (`LoginView.swift:107` / `LoginScreen.kt:206`), password visibility toggle (`LoginView.swift:269` / `LoginScreen.kt:398`), error-banner dismiss (both).
- **Field set:** Match — Email + Password on both.
- **Validation rules:** Match — `canSubmit` = not loading AND `AuthValidation.email(email) == nil` AND password length ≥ 6 (`LoginView.swift:337` / `LoginViewModel.kt:36`). Email regex identical across `AuthValidation.swift:19` / `AuthValidation.kt:14`.
- **Empty-state copy:** N/A
- **Error-state copy:** Match — banner headline "Couldn't complete that" both (`SignUpView.swift:428` / `SignUpScreen.kt:664`); body is the typed `AuthError` description, identical strings on both, e.g. invalid creds "Invalid email or password." iOS reads `error.errorDescription`, Android reads `error.message` — same resolved text.
- **Animation / transition:** Match — destinations pushed onto `NavigationStack` (iOS) / NavHost composables (Android).

## Sign up / Create account
- **iOS:** `Auth/Screens/SignUpView.swift` (+ `SignUpViewModel.swift`) · **Android:** `auth/sign_up/SignUpScreen.kt` (+ `SignUpViewModel.kt`)
- **State coverage:** Match — form screen. Both: idle / submitting (`isSubmitting`) / error (top-level banner). No empty/populated.
- **Action affordances:** Match — bottom "Create account" CTA (`SignUpView.swift:27` / `SignUpScreen.kt:104`), account-type segmented control, terms checkbox, per-field password visibility toggles, DOB picker, banner dismiss, top-bar X close (FormShell). All present both sides.
- **Field set:** Match — email, password, confirmPassword, username, firstName, middleName, lastName, dateOfBirth, phoneNumber, address, city, state, zipcode, accountType, inviteCode, agreedToTerms (`SignUpViewModel.swift:48-63` ↔ `SignUpViewModel.kt:50-65`).
- **Validation rules:** Match — per-field validators identical: confirm "Confirm your password." / "Passwords don't match."; address ≥5, city ≥2, state ≥2, zip ≥3; DOB 18+; phone optional E.164; username 3–20 lowercase/digits/underscore; password ≥8 + letter + number; `isValid` gated on terms + all fields (`SignUpViewModel.swift:153` ↔ `SignUpViewModel.kt:111`).
- **Empty-state copy:** N/A
- **Error-state copy:** Match — banner "Couldn't complete that" + typed `AuthError` body (same shared strings as Login). Password-meter helper "Min 8 chars · letters + numbers. Symbols make it stronger." identical (`SignUpView.swift:359` / `SignUpScreen.kt:400`); strength labels Weak/Fair/Strong/"—" identical.
- **Animation / transition:** Match — pushed in nav stack / NavHost; both wrap in FormShell.
- **Note (minor):** Banner-dismiss timing differs — Android `onEmailChange` also clears the top-level banner (`SignUpViewModel.kt:188`); iOS field changes never clear `topLevelError` (`SignUpViewModel.swift:224-228`). Cosmetic, not a field/validation delta.

## Auth error
- **iOS:** `Auth/Screens/AuthErrorView.swift` · **Android:** `auth/auth_error/AuthErrorScreen.kt` (+ `AuthErrorViewModel.kt`)
- **State coverage:** Match — static error surface; renders headline/body per `AuthError`. No fetch states.
- **Action affordances:** Match — "Try again" (only when retryable + `onRetry` provided) and "Go back" (`AuthErrorView.swift:51,55` / `AuthErrorScreen.kt:101,107`). `isRetryable` logic identical (emailAlreadyExists/invalidCredentials/weakPassword = false; networkError/rateLimited/serverError/unknown = true; `AuthErrorView.swift:126-133` ↔ `AuthErrorViewModel.kt:65-76`).
- **Field set:** N/A (no inputs)
- **Validation rules:** N/A
- **Empty-state copy:** N/A
- **Error-state copy:** Match (word-for-word) — all 7 cases identical, e.g. invalidCredentials "Couldn't sign you in" / "Double-check your email and password, then try again." (`AuthErrorView.swift:86-89` ↔ `AuthErrorViewModel.kt:28-31`); networkError "Can't reach Pantopus" / "Check your connection and try again."; unknown "Something went wrong" / "We're not sure what happened. Try again or go back."
- **Animation / transition:** Match — full-screen surface pushed in the auth stack / NavHost.

## Forgot password
- **iOS:** `Auth/Screens/ForgotPasswordView.swift` · **Android:** `auth/forgot_password/ForgotPasswordScreen.kt` (+ `ForgotPasswordViewModel.kt`)
- **State coverage:** Match — form phase + sent phase; both: idle / loading / error / sent (transitions to shared Status "Check your email").
- **Action affordances:** Match — back chevron, "Send reset link" submit, banner dismiss; on sent screen: primary "Resend" + secondary "Back to login". 30s resend cooldown on both (`ForgotPasswordView.swift:160` / `ForgotPasswordViewModel.kt:121`).
- **Field set:** Match — single Email field.
- **Validation rules:** Match — `canSubmit` = not loading AND `AuthValidation.email == nil` (`ForgotPasswordView.swift:162` ↔ `ForgotPasswordViewModel.kt:51`).
- **Empty-state copy:** N/A
- **Error-state copy:** Match — shared `ErrorBanner` with typed `AuthError` (same strings as Login).
- **Animation / transition:** Match — pushed; in-place phase swap to the Status frame on success.

## Reset password
- **iOS:** `Auth/Screens/ResetPasswordView.swift` · **Android:** `auth/reset_password/ResetPasswordScreen.kt` (+ `ResetPasswordViewModel.kt`)
- **State coverage:** Match — form / loading / error / reset-success (transitions to shared Status "Password reset" with 3s auto-redirect; iOS `redirectDelay` 3 / Android `redirectDelayMs` 3_000).
- **Action affordances:** Match — X close, "Set password" submit, banner dismiss; success screen shows single primary "Back to login" (`passwordReset()` sets `secondaryCta = nil` both). Android `SuccessBody` passes an unused `onSecondary` (`ResetPasswordScreen.kt:359`) but no secondary CTA renders — no visible affordance delta.
- **Field set:** Match — New password + Confirm new password.
- **Validation rules:** Match — `canSubmit` = not loading AND `AuthValidation.password == nil` (≥8 + letter + number) AND passwords match (confirm non-empty) AND token non-empty (`ResetPasswordView.swift:232` ↔ `ResetPasswordViewModel.kt:52`). Confirm-mismatch error "Passwords don't match." both.
- **Empty-state copy:** N/A
- **Error-state copy:** Match — shared `ErrorBanner` typed `AuthError`.
- **Animation / transition:** Match — pushed; in-place phase swap to Status frame on success.

## Verify email
- **iOS:** `Auth/Screens/VerifyEmailView.swift` · **Android:** `auth/verify_email/VerifyEmailScreen.kt` (+ `VerifyEmailViewModel.kt`)
- **State coverage:** Match — auto-verify-on-token surface; both render verifying / verified / error / resent banners + soft-gate idle.
- **Action affordances:** **DELTA** — (1) **Resend countdown label missing on Android.** iOS resend button label switches to `"Resend in \(Int(remaining))s"` while cooldown is active (`VerifyEmailView.swift:237-242`); Android's resend button is hardcoded "Resend email" (`VerifyEmailScreen.kt:241`) — VM exposes `cooldownRemaining()` (`VerifyEmailViewModel.kt:53`) but the screen never renders it. (2) **"Wrong email? Change it":** iOS opens a `ChangeEmailSheet` modal (`VerifyEmailView.swift:93-102, 259-301`); Android calls `onChangeEmail(state.email)` directly with no sheet (`VerifyEmailScreen.kt:260-270`).
- **Field set:** **DELTA** — iOS has a "New email" input (`verifyEmailChangeField`, `VerifyEmailView.swift:284-292`) in the change-email sheet; Android has no such field.
- **Validation rules:** **DELTA** — iOS gates the change-email Submit on `AuthValidation.email(draft) != nil` (`VerifyEmailView.swift:276`); Android has no equivalent. Core verify/resend logic otherwise matches.
- **Empty-state copy:** N/A
- **Error-state copy:** Match — verifying "Verifying your email…", verified "Email verified. You can now sign in.", resent "Verification email sent." Body "We sent a verification link to {email}. Click it to unlock all features." identical (`VerifyEmailView.swift:131` / `VerifyEmailScreen.kt:148`).
- **Animation / transition:** **DELTA** — iOS change-email is a `.sheet` (medium detent modal, `VerifyEmailView.swift:299`); Android has no modal (direct callback). Main screen is pushed on both.

## Status / Waiting
- **iOS:** `Status/StatusWaitingView.swift` (+ `StatusWaitingContent.swift`) · **Android:** `status/StatusWaitingScreen.kt` (+ `StatusWaitingContent.kt`)
- **State coverage:** Match — presentational render-model; renders illustration/headline/subcopy/etaChip/timeline/actionCards/explainer/sticky-CTAs, each hidden when empty.
- **Action affordances:** Match — action-card taps, primary + secondary sticky CTAs, gated identically on `primaryCta != nil || secondaryCta != nil` (`StatusWaitingView.swift:49` / `StatusWaitingScreen.kt:94`).
- **Field set:** N/A (no inputs)
- **Validation rules:** N/A
- **Empty-state copy:** N/A (this screen is itself the waiting presentation)
- **Error-state copy:** N/A (no error state). Factory copy word-for-word identical, e.g. `claimSubmitted` "Claim submitted" / "We'll review your evidence and email you when {venue} is verified."; `resetLinkSent` "Check your email" / "We sent a reset link to {recipient}. Click it to set a new password."; `passwordReset` "Password reset" / "You can now log in with your new password." (`StatusWaitingContent.swift` ↔ `StatusWaitingContent.kt`).
- **Animation / transition:** Match — presentational; container provided by host.

## Token Accept
- **iOS:** `TokenAccept/TokenAcceptView.swift` (+ `TokenAcceptContent.swift`, `TokenAcceptViewModel.swift`) · **Android:** `token_accept/TokenAcceptScreen.kt` (+ `TokenAcceptContent.kt`, `TokenAcceptViewModel.kt`)
- **State coverage:** Match — loading (shimmer) / ready / accepting / accepted / declined / expired / error. Same 7-state enum both (`TokenAcceptContent.swift:86-94` ↔ `TokenAcceptContent.kt:42-56`).
- **Action affordances:** **DELTA** — Android terminal frames add extra dismiss buttons: `AcceptedFrame`/`DeclinedFrame`/`ExpiredFrame` each render "Done" (`TokenAcceptScreen.kt:494,526,557`) and `ErrorFrame` adds "Close" alongside "Try again" (`TokenAcceptScreen.kt:589-601`). iOS terminal frames have NO button (`TokenAcceptView.swift:285-338`) and the error frame has only "Try again" (`TokenAcceptView.swift:351`) — iOS dismisses via VM callbacks instead. Offer-screen CTAs (decline + accept/"Accepting…") match.
- **Field set:** N/A (no inputs)
- **Validation rules:** N/A
- **Empty-state copy:** N/A
- **Error-state copy:** Match (word-for-word) — error title "Couldn't load this invite" both; accept-failure message "Couldn't accept this invitation." both (`TokenAcceptViewModel.swift:98` / `TokenAcceptViewModel.kt:119`); expired/used/not-found and accepted/declined copy identical.
- **Animation / transition:** **DELTA** — iOS presents TokenAccept as a `.fullScreenCover` modal (`RootTabView.swift:85-98`); Android navigates to a pushed NavHost route `invite/{token}` (`RootTabScreen.kt:984`). Modal (iOS) vs push (Android).

## Root tab scaffold
- **iOS:** `Root/RootTabView.swift` (+ `HubTabRoot`/`InboxTabRoot`/`NearbyTabRoot`/`YouTabRoot`) · **Android:** `root/RootTabScreen.kt` (+ `PantopusBottomBar.kt`, `PantopusRoute.kt`)
- **State coverage:** N/A — container scaffold.
- **Action affordances:** Match — 4 tabs selectable both; Inbox badge present both (`RootTabView.swift:71` / `PantopusBottomBar.kt:131`). Tab a11y ids mirror: `tab.hub/tab.nearby/tab.inbox/tab.you` both.
- **Field set:** N/A
- **Validation rules:** N/A
- **Empty-state copy:** N/A
- **Error-state copy:** N/A
- **Action affordances (tab set):** Match — Hub, Nearby, Inbox, You in the same order; labels "Hub"/"Nearby"/"Inbox"/"You" and icons home/map/inbox/user identical; active tint `primary600` both.
- **Animation / transition:** Match (tab-swap) — iOS `TabView` instant swap with per-tab `NavigationStack`; Android single `NavHost` with `popUpTo(start){saveState}; launchSingleTop; restoreState` (default crossfade). Both tab-swap, not push. (TokenAccept's modal-vs-push delta noted in its own section.)

<!-- cluster:tier1-hub -->

## Hub
- **iOS:** `Hub/HubView.swift` (+ `HubViewModel.swift`, `HubState.swift`, `Sections/HubSections.swift`) · **Android:** `hub/HubScreen.kt` (+ `HubViewModel.kt`, `HubUiState.kt`, `sections/HubSections.kt`)
- **State coverage:** Match — both expose Skeleton / FirstRun / Populated / Error (`HubState.swift:13-17` ↔ `HubUiState.kt:13-31`). All 11 sections present on both (TopBar, ActionStrip, SetupBanner, Today, FirstRunHero, PillarGrid, DiscoveryRail, JumpBackIn, RecentActivity, FloatingProgress, Skeleton).
- **Action affordances:** Match — bell/menu taps, action chips, setup-banner start+dismiss, today tap, 4 pillar taps, discovery tap + "See all", jump-back tap, recent-activity "See all", first-run hero start, floating-progress continue, all with mirrored testTags (`hubBellButton`, `hub.pillar.<name>`, `hubDiscoveryRail.seeAll`, …).
- **Field set:** N/A (no inputs)
- **Validation rules:** N/A
- **Empty-state copy:** N/A — Hub has no `EmptyState`; the new-user case is the FirstRun hero, whose copy matches: "Verify your home to unlock Pantopus" / "Takes 4 minutes. Gets you mail, gigs, and neighbor features." (`HubSections.swift:200,206` / `HubSections.kt:335,345`). Setup-banner subcopy "Unlock gigs + mail receiving." and FloatingProgress "Complete your setup" match.
- **Error-state copy:** Match (headline) — "Couldn't load your hub" both (`HubView.swift:153` / `HubScreen.kt:218`) + dynamic message subcopy + "Try again". **Note:** iOS VM has a static fallback subcopy "Couldn't load your hub." (`HubViewModel.swift:70`) for the no-description case; Android uses raw `error.message` with no static fallback (`HubViewModel.kt:68`) — body subcopy can diverge only when the network layer returns an empty message.
- **Animation / transition:** Match — pushed within the tab stack; pull-to-refresh both (`HubView.swift:41` / `HubScreen.kt:67-92`).

## Pulse feed
- **iOS:** `Feed/FeedView.swift` (+ `PulseFeedViewModel.swift`, `Feed/Pulse/*`) · **Android:** `feed/FeedScreen.kt` (+ `feed/pulse/*`)
- **State coverage:** Match — loading / empty / loaded / error both (`pulseFeedLoading/Empty/List/Error` testTags mirror).
- **Action affordances:** Match — back, 6 filter chips (keys all/ask/recommend/event/lost/announce), compose FAB, card tap, primary reaction, event RSVP, Reply, empty "Create post", error "Try again". Chip ids align (`PulseIntent.swift:14-20` / `PulseIntent.kt:19-24`).
- **Field set:** N/A (no inputs)
- **Validation rules:** N/A
- **Empty-state copy:** Match — "Nothing here yet" / "Be the first to post. Ask, recommend, or announce something local." (`FeedView.swift:114,117` / `FeedScreen.kt:195,202`). Scope hint "Showing posts within …" same words; Android lacks the bold weight on the scope token (cosmetic, not copy).
- **Error-state copy:** Match — "Couldn't load Pulse" both (`FeedView.swift:198` / `FeedScreen.kt:309`) + dynamic subcopy.
- **Animation / transition:** Match — pushed in tab stack; pull-to-refresh + bottom-trailing FAB both.

## Post detail
- **iOS:** `Posts/PulsePostDetailView.swift` (+ `PulsePostDetailViewModel.swift`) · **Android:** `posts/PulsePostDetailScreen.kt` (+ `PulsePostDetailViewModel.kt`)
- **State coverage:** Match — loading / loaded / error both (no empty state — single-resource detail). Both use `ContentDetailShell`.
- **Action affordances:** Match — back, author/comment avatar→profile, reaction tap, inline comment composer + send, "show more replies", owner overflow → "Edit post" (`pulsePostDetail-edit`), error "Try again". Overflow gated by `isOwner` both.
- **Field set:** Match — single inline comment composer (`composerText`) both.
- **Validation rules:** Match — send gated on non-blank trimmed text; no max length on either.
- **Empty-state copy:** N/A
- **Error-state copy:** Match (word-for-word) — "Couldn't load this post" both; subcopy "We couldn't find this post." / "You don't have access to this post." / "Check your connection and try again." / "Something went wrong. Try again." identical; toasts "Couldn't update your reaction" / "Couldn't post your comment" match.
- **Animation / transition:** **DELTA** — screen pushed on both, but the owner overflow menu differs: iOS `confirmationDialog` action sheet ("Post options" / "Edit post" / "Cancel", `PulsePostDetailView.swift:52-62`) vs Android `ModalBottomSheet` (`PulsePostDetailScreen.kt:141-193`). Same items, different modal style.

## Pulse compose
- **iOS:** `Compose/PulseCompose/PulseComposeView.swift` (+ `PulseComposeViewModel.swift`, `PulseComposeContent.swift`) · **Android:** `compose/pulse/PulseComposeScreen.kt` (+ `PulseComposeViewModel.kt`)
- **State coverage:** Match — `FormShell` + prefill sub-state (ready/loading/error) for edit mode; skeleton + error testTags mirror.
- **Action affordances:** Match — 5 intent chips, 3 identity chips, intent-specific selectors (ask category, recommend star rating, lost/found toggle, announce audience), date pickers, photo add/remove, 3 visibility radios, FormShell close + commit, prefill-error retry. Intent lock in edit mode matches.
- **Field set:** Match — identical 8-field map (title, body, recommendBusiness, eventDate, eventLocation, eventCapacity, lostLastSeenLocation, lostLastSeenDate); labels + placeholders match verbatim; photo cap 4 both.
- **Validation rules:** **DELTA (two)** — (1) **Body min-length:** iOS emits "Add a description." when trimmed body too short (`PulseComposeViewModel.swift:411`); Android only checks max length + `required("Description")` → "Description is required." (`PulseComposeViewModel.kt:394-407`), never "Add a description.". (2) **Event date:** iOS bespoke validator accepts `yyyy-MM-dd`/`yyyy-MM-dd HH:mm`/ISO-T, error "Use YYYY-MM-DD or pick a date." (`swift:427-444`); Android uses `required + isoDateOrEmpty` → "Event date is required." / "Use the format YYYY-MM-DD." (`kt:417-418`) and rejects the `HH:mm` shape (picker only emits `yyyy-MM-dd`, so divergence is in the rule not the happy path). Other validators match.
- **Empty-state copy:** N/A (form)
- **Error-state copy:** Match — prefill error "Couldn't load this post" both; submit toasts "Couldn't post. Try again." / "Couldn't save. Try again.", validation "Fix the highlighted field.", offline "You're offline. Try again when you're back online.", success "Posted" / "Saved" all match.
- **Animation / transition:** Match — pushed in tab stack (not a sheet) both; shared FormShell discard dialog copy identical.

## Notifications
- **iOS:** `Notifications/NotificationsView.swift` (+ `NotificationsViewModel.swift`) · **Android:** `notifications/NotificationsScreen.kt` (+ `NotificationsViewModel.kt`)
- **State coverage:** Match — thin `ListOfRows` wrappers: loading / empty / loaded / error; two empty variants (All vs Unread) both; Today/Earlier bucketing both.
- **Action affordances:** Match — two tabs (All / Unread N), per-row tap (mark-read + deep-link), "Mark all read" (disabled when unread==0), pull-to-refresh, pagination, Unread-empty "View all notifications" → switches to All.
- **Field set:** N/A
- **Validation rules:** N/A
- **Empty-state copy:** Match — All: "All caught up" / "When something needs your attention, it'll show up here."; Unread: "You're all caught up" (curly apostrophe both) / "No unread notifications. Replies, mentions, claim updates, and safety alerts from your neighborhood will land here." + CTA "View all notifications".
- **Error-state copy:** **Note (latent)** — iOS static fallback "Couldn't load notifications." (`NotificationsViewModel.swift:342`) when APIError has no description; Android passes raw `result.error.message` (`NotificationsViewModel.kt:304`). Diverges only on empty network message; otherwise same shared taxonomy string.
- **Animation / transition:** Match — pushed; shared ListOfRows chrome both.

## Recent activity
- **iOS:** `RecentActivity/RecentActivityView.swift` (+ `RecentActivityViewModel.swift`) · **Android:** `recent_activity/RecentActivityScreen.kt` (+ `RecentActivityViewModel.kt`, `RecentActivityDestination.kt`)
- **State coverage:** Match — `ListOfRows` loading / empty / loaded / error; no pagination (backend caps at 10; both `loadMoreIfNeeded` no-ops); single section.
- **Action affordances:** Match — per-row tap via typed destination (6 identical cases: gigDetail/listingDetail/mailItemDetail/pulsePost/homeDashboard/placeholder), pull-to-refresh, back. No tabs/FAB/top-bar action either.
- **Field set:** N/A
- **Validation rules:** N/A
- **Empty-state copy:** Match — "No activity yet" / "Check back later — replies, claims, gigs, and mail events will show up here." (em-dash preserved both).
- **Error-state copy:** **Note (latent)** — iOS static fallback "Couldn't load activity." (`RecentActivityViewModel.swift:92`); Android raw `result.error.message` (`RecentActivityViewModel.kt:68`). Same empty-message divergence pattern as Hub/Notifications.
- **Animation / transition:** Match — pushed; shared ListOfRows chrome both.

<!-- cluster:tier2-gigs -->

## Gigs feed
- **iOS:** `Gigs/GigsFeedView.swift` (+ `GigsFeedViewModel.swift`, `GigsContent.swift`, `GigsCategoryChipRow.swift`) · **Android:** `gigs/GigsFeedScreen.kt` (+ `GigsFeedViewModel.kt`, `GigsContent.kt`)
- **State coverage:** Match — loading (4 skeleton cards) / empty / loaded / error both.
- **Action affordances:** Match — back, map toggle, search bar, 9 category chips (same keys), sort menu (Newest/Closest/Highest pay/Fewest bids), filters button, "Post a task" FAB. Nuance: Android `GigRow` hides body when empty (`GigsFeedScreen.kt:556`) while iOS always renders it (`GigsFeedView.swift:339`) — empty-string render guard, not an affordance delta.
- **Field set:** N/A
- **Validation rules:** N/A
- **Empty-state copy:** Match — "No gigs nearby" / "Be the first to post one." (`GigsFeedView.swift:198,201` / `GigsFeedScreen.kt:408,416`); radius pill "Within N · widen in filter" matches.
- **Error-state copy:** Match — "Couldn't load Gigs" / "Try again" both (`GigsFeedView.swift:288,298` / `GigsFeedScreen.kt:693,717`); iOS dynamic fallback "Couldn't load gigs." differs only on empty message.
- **Animation / transition:** Match — full-screen pillar, bottom-trailing FAB; filter opens as sheet both.

## Gigs search
- **iOS:** `Gigs/Search/GigSearchView.swift` (+ `GigSearchViewModel.swift`) · **Android:** `gigs/GigSearchScreen.kt` (+ `GigSearchViewModel.kt`)
- **State coverage:** Match — idle/loading/loaded/empty/error via shared `SearchListShell`.
- **Action affordances:** Match — search field, cancel/back, category chip strip in `filters` slot, result rows reuse `GigRow`.
- **Field set:** Match — single query field; 250ms debounce both.
- **Validation rules:** N/A
- **Empty-state copy:** Match — "No matches" / "Try a different keyword or category." both.
- **Error-state copy:** Match — "Couldn't search" + dynamic message both.
- **Animation / transition:** Match — pushed search surface, system nav bar hidden, shell paints header.

## Gig filter sheet
- **iOS:** `Gigs/GigFilterSheet.swift` · **Android:** `gigs/GigFilterSheet.kt`
- **State coverage:** N/A (stateless projection over shared `FilterSheetShell`).
- **Action affordances:** Match — same 5 sections in order: Category (chips), Budget (range slider), Schedule (chips), Bids (single chip), Posted within (radio), + shell Apply/Close.
- **Field set:** Match — category options (8, `all` excluded), budget min 0/max 500/step 25, schedule (One-time/Recurring/Flexible), "Open to bids only", posted-within (Anytime/Today/This week/This month).
- **Validation rules:** Match — `activeCount` + budget predicate identical.
- **Empty-state copy:** N/A
- **Error-state copy:** N/A
- **Animation / transition:** Match — bottom sheet; title "Filters" both.

## Gig compose
- **iOS:** `Compose/GigCompose/GigComposeWizardView.swift` (+ `GigComposeViewModel.swift`, `GigComposeSteps.swift`) · **Android:** `compose/gig/GigComposeWizardScreen.kt` (+ `GigComposeViewModel.kt`, `GigComposeSteps.kt`)
- **State coverage:** Match — 6 steps + terminal success + inline error banner + isSubmitting, via `WizardShell`.
- **Action affordances:** Match — leading back/close, CTA "Continue"/"Post task"/"View task", success secondary "Done"; category tiles (9), budget/schedule/location radios, photo add/remove. **DELTA (date):** iOS one-time schedule uses native compact `DatePicker` "When" defaulting now+1h (`GigComposeWizardView.swift:449-453`); Android uses a tappable row placeholder "Pick a date & time" shortcutting to +24h (`GigComposeWizardScreen.kt:455,468-469`).
- **Field set:** Match — title, description, photos, budget min/max, scheduledStart, place (Street/City/State/ZIP). **DELTA (placeholder):** iOS description `TextEditor` has no placeholder (`swift:255`); Android description shows "Add as much detail as you can." (`kt:271`).
- **Validation rules:** Match — title 5–100, description 20–2000, max 6 photos, budget>0 (offers exempt), one-time requires future date.
- **Empty-state copy:** Match (success hero) — "Task posted" / "Helpers can now see it on the Gigs feed. We'll notify you when bids come in."
- **Error-state copy:** Match — "You're offline. Try again when you're back online." / "Please complete each step before posting." / "Couldn't post your task. Please try again."
- **Animation / transition:** Match — pushed wizard both.

## Marketplace
- **iOS:** `Marketplace/MarketplaceView.swift` (+ `MarketplaceViewModel.swift`, `MarketplaceContent.swift`) · **Android:** `marketplace/MarketplaceScreen.kt` (+ `MarketplaceViewModel.kt`, `MarketplaceContent.kt`)
- **State coverage:** Match — loading (6-cell skeleton grid) / empty / loaded (2-col grid) / error both.
- **Action affordances:** Match — back, search bar with clear (X), 5 chips (All/Goods/Rentals/Free/Vehicles), camera "Snap & sell" FAB (business violet), card taps.
- **Field set:** Match — single search field (submit on enter, clear) both.
- **Validation rules:** N/A
- **Empty-state copy:** Match — "Nothing for sale nearby yet" / "Be the first to post. Tap the camera to snap and sell."; radius pill "Showing within N · widen in filter" matches.
- **Error-state copy:** Match — "Couldn't load Marketplace" / "Try again" both.
- **Animation / transition:** Match — full-screen tab, bottom-trailing FAB.

## Listing compose
- **iOS:** `Compose/ListingCompose/ListingComposeWizardView.swift` (+ steps, `ListingComposeWizardViewModel.swift`) · **Android:** `compose/listing/ListingComposeWizardScreen.kt` (+ `ListingComposeSteps.kt`, `ListingComposeWizardViewModel.kt`)
- **State coverage:** Match — 6 steps + success, edit-mode prefill shimmer, inline error banner, isSubmitting both.
- **Action affordances:** Match — back/close, CTAs "Continue"/"List it"|"Save changes"/"View listing"|"Back to listing", success secondary "Back to Marketplace"|"Done"; photo add/remove + reorder + remove-confirm ("Remove this photo?"), category/condition/price-kind/fulfillment/location-kind radios.
- **Field set:** Match — photos, title, category, condition, description, price amount, fulfillment, location kind, meet-point label; same placeholders.
- **Validation rules:** Match — title 5–80, description 20–2000, max 8 photos, price>0 for Fixed/Negotiable (Free exempt); inline errors identical.
- **Empty-state copy:** Match (success hero) — "Your listing is live" / "Neighbors can find it in Marketplace now. We'll notify you when an offer comes in."
- **Error-state copy:** Match — "You're offline…" / "Couldn't list your item. Please try again." / "Couldn't save your changes. Please try again." / "Couldn't load the listing. Pull to retry."
- **Animation / transition:** Match — pushed wizard; remove-photo confirm (iOS `confirmationDialog`, Android `AlertDialog`).

## My listings
- **iOS:** `Listings/MyListingsView.swift` (+ `MyListingsViewModel.swift`) · **Android:** `listings/MyListingsScreen.kt` (+ `MyListingsViewModel.kt`)
- **State coverage:** Match — loading/loaded/empty(per-tab)/error via shared ListOfRows.
- **Action affordances:** Match — 3 tabs (Active/Sold/Drafts), canonical-create FAB "List something", row chips (views/offers/status), row tap → detail.
- **Field set:** N/A
- **Validation rules:** N/A
- **Empty-state copy:** Match — Active "No active listings" / "Post your first item to start hearing from neighbors." / "List something"; Sold "Nothing sold yet" / "Items move here automatically once you mark them sold."; Drafts "No drafts" / "Saved drafts will appear here so you can finish them later."
- **Error-state copy:** **Note (latent)** — iOS fallback "Something went wrong." (`MyListingsViewModel.swift:120`); Android passes `result.error.message` (`MyListingsViewModel.kt:113`). Diverges only when API error has no description.
- **Animation / transition:** Match — list screen, no modals.

## Listings (browse / detail in this dir)
- **iOS:** `Listings/` (only My-listings present) · **Android:** `listings/` (only My-listings present)
- **State coverage:** N/A — both `Listings`/`listings` dirs contain only the My-listings screen (verified via `find`). Symmetric — no per-platform delta. Listing *browse* lives on Marketplace; listing *detail* lives at iOS `ContentDetail/ListingDetailView.swift` ↔ Android `contentdetail/ListingDetailScreen.kt` (both present).
- **Action affordances:** N/A
- **Field set:** N/A
- **Validation rules:** N/A
- **Empty-state copy:** N/A
- **Error-state copy:** N/A
- **Animation / transition:** N/A

## My tasks (V2)
- **iOS:** `MyTasks/MyTasksView.swift` (+ `MyTasksViewModel.swift`) · **Android:** `my_tasks/MyTasksScreen.kt` (+ `MyTasksViewModel.kt`)
- **State coverage:** Match — loading/loaded/empty(per-tab + filtered)/error via shared ListOfRows.
- **Action affordances:** Match — 4 tabs (Open/Active/Done/Closed), filter top-bar action, MagicCreate FAB "Post a task with Magic Task", open-tab banner, per-status footer actions identical, status chip labels identical.
- **Field set:** N/A (filter lives in shared ActivityFilterSheet — status Open/In progress/Done/Closed, title "Task status", identical).
- **Validation rules:** N/A
- **Empty-state copy:** Match — Open "No tasks posted yet — try Magic Task" / "Describe what you need in a sentence. Magic Task drafts the title, budget, and schedule — you just confirm and post." / "Try Magic Task"; Active/Done/Closed + filtered "No tasks match your filters" / "Clear filters" all match.
- **Error-state copy:** **Note (latent)** — iOS fallback "Couldn't load your tasks." (`MyTasksViewModel.swift:466`); Android `result.error.message` (`MyTasksViewModel.kt:418`). Diverges only on empty message.
- **Animation / transition:** Match — list screen; filter opens as sheet both.

## My bids
- **iOS:** `MyBids/MyBidsView.swift` (+ `MyBidsViewModel.swift`, `EditBidSheetView.swift`, `LeaveReviewSheetView.swift`) · **Android:** `my_bids/MyBidsScreen.kt` (+ `MyBidsViewModel.kt`, `EditBidSheet.kt`, `LeaveReviewSheet.kt`)
- **State coverage:** Match — loading/loaded/empty(per-tab + filtered)/error via shared ListOfRows.
- **Action affordances:** Match — 4 tabs (Active/Accepted/Rejected/Done), filter top-bar action, ExtendedNav FAB "Browse tasks", Active-tab banner, footer actions identical, withdraw/edit-bid/leave-review sheets, edit/review toasts.
- **Field set:** Match — withdraw reason picker; Edit-bid (Amount required, Message/ETA/Terms optional); Leave-review (rating 1–5 required, comment optional); labels/placeholders match.
- **Validation rules:** Match — bid amount parses & >0; review rating 1–5.
- **Empty-state copy:** Match — all four tabs' copy + sheet/toast copy ("Bid updated.", "Review submitted. Thanks!", "Couldn't update bid.", "Couldn't submit review.", …) match.
- **Error-state copy:** **Note (latent)** — iOS fallback "Couldn't load your bids." (`MyBidsViewModel.swift:351`); Android `result.error.message` (`MyBidsViewModel.kt:336`). Diverges only on empty message.
- **Animation / transition:** **DELTA (detents)** — withdraw/edit/review present as bottom sheets both, but iOS sets per-sheet detents (withdraw `.medium`, edit `.large`, review `[.medium,.large]`, `MyBidsView.swift:39,49,59`) while Android uses `ModalBottomSheet(skipPartiallyExpanded = true)` (full height) for all three (`MyBidsScreen.kt:180,201,222`).

## Offers
- **iOS:** `Offers/OffersView.swift` (+ `OffersViewModel.swift`) · **Android:** `offers/OffersScreen.kt` (+ `OffersViewModel.kt`)
- **State coverage:** Match — loading/loaded/empty(per-tab + filtered)/error via shared ListOfRows.
- **Action affordances:** Match — 2 tabs (Received/Sent), no FAB, filter top-bar action, row tap → detail; status chip labels identical.
- **Field set:** N/A (shared ActivityFilterSheet — status Pending/Accepted/Declined, title "Offer status").
- **Validation rules:** N/A
- **Empty-state copy:** Match — Received "No offers yet" / "When a neighbor offers a price on one of your listings, it'll land here. …" / "Post a task"; Sent "No offers sent yet" / "Browse listings and gigs you'd like to buy or help with — your offers will show up here." / "Browse listings"; filtered + "Clear filters" match.
- **Error-state copy:** Match — both fall back to literal "Couldn't load offers." (`OffersViewModel.swift:295` / `OffersViewModel.kt:319`).
- **Animation / transition:** Match — list screen; filter opens as sheet both.

## Listing offers
- **iOS:** `ListingOffers/ListingOffersView.swift` (+ `ListingOffersViewModel.swift`) · **Android:** `listing_offers/ListingOffersScreen.kt` (+ `ListingOffersViewModel.kt`)
- **State coverage:** Match — loading (title-hint context card)/loaded/empty/error via shared ListOfRows; no tabs.
- **Action affordances:** Match — share top-bar action, listing-context header with sort menu (Highest/Lowest offer/Newest/Oldest), edit-price affordance, per-status footer actions identical, counter sheet; status chip labels identical; LEADING highlight on top pending offer.
- **Field set:** Match — counter sheet: amount (required), optional message; labels "Your counter amount" / "Optional message".
- **Validation rules:** Match — counter amount parses & >0.
- **Empty-state copy:** Match — "No offers on this listing yet" / "Most listings draw their first offer within 24 hours. Share it with a few neighborhoods to speed things up." / "Share listing"; counter-sheet copy matches.
- **Error-state copy:** Match — both fall back to literal "Couldn't load offers." (`ListingOffersViewModel.swift:415` / `ListingOffersViewModel.kt:668`).
- **Animation / transition:** Match — list screen; counter is a half-sheet (iOS `.presentationDetents([.medium])`, Android `ModalBottomSheet`).

<!-- cluster:tier-homes-core -->

## My homes
- **iOS:** `Homes/MyHomesListView.swift` (+ `MyHomesListViewModel.swift`) · **Android:** `homes/MyHomesListScreen.kt` (+ `MyHomesListViewModel.kt`)
- **State coverage:** Match — loading/empty/loaded/error via shared ListOfRows; both short-circuit `load()` when already loaded.
- **Action affordances:** Match — FAB `.plusCircle` / "Claim a home" / `secondaryCreate` / `.home` both; no tabs; intro banner both.
- **Field set:** N/A
- **Validation rules:** N/A
- **Empty-state copy:** Match — "You don't belong to any homes yet" / "Claim or join a verified home to unlock packages, bills, tasks, and member chat." / "Claim a home".
- **Error-state copy:** Match — shared error taxonomy (iOS `APIError.errorDescription`, Android `NetworkError.message`) carry the same canned strings. **Note (latent):** iOS adds a non-APIError fallback "Something went wrong." that Android lacks.
- **Animation / transition:** Match — list root in nav stack both.

## Add home
- **iOS:** `Homes/AddHome/AddHomeWizardView.swift` (+ `AddHomeWizardViewModel.swift`, `AddHomeSteps.swift`) · **Android:** `homes/add_home/AddHomeWizardScreen.kt` (+ `AddHomeWizardViewModel.kt`, `AddHomeSteps.kt`)
- **State coverage:** Match — 4 steps + success, same per-step chrome/progress/CTA labels; inline error banner both.
- **Action affordances:** Match — CTAs "Continue"/"Submit"/"View home", success secondary "Back to Hub"; address suggestion list both.
- **Field set:** Match — Street, Unit (optional), City, State, ZIP; primary-home toggle + role radios both.
- **Validation rules:** Match — `isComplete` requires street/city/state/zip non-blank; role required to submit.
- **Empty-state copy:** N/A
- **Error-state copy:** Match — "Couldn't add your home. Please try again." / "Couldn't verify that address. Try again." / offline string all match.
- **Animation / transition:** Match — `WizardShell`; iOS `@SceneStorage` ↔ Android `SavedStateHandle` restore (equivalent).

## Claim ownership
- **iOS:** `Homes/ClaimOwnership/ClaimOwnershipWizardView.swift` (+ VM, `ClaimOwnershipSteps.swift`, `Steps/*`) · **Android:** `homes/claim_ownership/ClaimOwnershipWizardScreen.kt` (+ VM, `ClaimOwnershipSteps.kt`)
- **State coverage:** Match — 3 steps (start/upload/success) + per-slot upload states.
- **Action affordances:** Match — CTAs "Start claim"/"Submit claim"/"View status", success secondary "Back to home"; two upload tiles + reviewer note both.
- **Field set:** **DELTA** — accept-hint differs: iOS "JPG or PNG up to 10 MB" (`ClaimOwnershipSteps.swift:45`) vs Android "JPG, PNG, or PDF up to 10 MB" (`ClaimOwnershipSteps.kt:28`); backing this, iOS picker accepts images only (`ClaimUploadStep.swift:55` `.images`) while Android accepts `image/*` + `application/pdf` (`ClaimOwnershipWizardScreen.kt:186`). Reviewer-note field (500-char cap) present both.
- **Validation rules:** **DELTA** — iOS enforces a client-side 10 MB pre-upload guard "That file is over 10 MB. Try a smaller photo." (`ClaimOwnershipWizardViewModel.swift:173-176`); Android has no size check (`ClaimOwnershipWizardScreen.kt:163-166`) so oversized files round-trip to the server. Both require both slots filled.
- **Empty-state copy:** N/A
- **Error-state copy:** Match — "Couldn't submit. Retry." / "We're already working on a claim for this home." / offline string match. Minor: iOS labels both upload + evidence failures "Upload failed"; Android uses "Upload failed" for the file but "Couldn't register evidence" for the evidence step (`ClaimOwnershipWizardViewModel.kt:244,274`).
- **Animation / transition:** Match — `WizardShell` both.

## My claims
- **iOS:** `Homes/Claims/MyClaimsListView.swift` (+ `MyClaimsListViewModel.swift`) · **Android:** `homes/claims/MyClaimsListScreen.kt` (+ `MyClaimsListViewModel.kt`)
- **State coverage:** Match — loading/empty/loaded/error; both always refetch on `load()`.
- **Action affordances:** Match — no FAB, no tabs, no top-bar action; row tap → `onOpenClaim`; empty CTA "Add a home".
- **Field set:** N/A
- **Validation rules:** N/A
- **Empty-state copy:** Match — "No claims yet" / "Submit a claim from a home dashboard. New here? Add a home and pick the Owner role to start."
- **Error-state copy:** Match — iOS fallback "Couldn't load your claims." (non-APIError only); Android shared `result.error.message`; typed-error strings identical.
- **Animation / transition:** Match — list root in nav stack both.

## Invite owner
- **iOS:** `Homes/InviteOwner/InviteOwnerFormView.swift` (+ `InviteOwnerFormViewModel.swift`) · **Android:** `homes/invite_owner/InviteOwnerFormScreen.kt` (+ `InviteOwnerFormViewModel.kt`)
- **State coverage:** Match (form) — editing + saving + toast + dismiss-on-success via `FormShell`.
- **Action affordances:** Match — right action "Send"; success toast then auto-dismiss after 1.5s both.
- **Field set:** Match — Email + Phone (optional). Minor: phone placeholder differs — iOS "+1 555 555 0123" vs Android "+15555550123".
- **Validation rules:** Match — email = `[.email, .emailNotMatching(currentUserEmail)]`, phone = E.164; `isValid` requires non-empty email both.
- **Empty-state copy:** N/A
- **Error-state copy:** **Resolved (P6.8)** — Android `mapInviteError` now keys on `NetworkError.code == 409 || raw.contains("already active")`, matching iOS, so any 409 maps to the friendly "An ownership claim is already active for this home." inline error. Shared strings ("Already an owner of this home.", "We couldn't find a Pantopus account with that email.", "Fix the highlighted field.", "Invite sent.") match.
- **Animation / transition:** Match — bottom toast with fade/slide both.

## Bills
- **iOS:** `Homes/Bills/BillsListView.swift` (+ VM; `AddBillWizardView.swift`/VM, `BillDetailView.swift`) · **Android:** `homes/bills/BillsListScreen.kt` (+ VM; `AddBillWizardScreen.kt`/VM, `BillDetailScreen.kt`)
- **State coverage:** Match — list loading/empty/loaded/error; detail loading/loaded/error; add-wizard 3 steps + success.
- **Action affordances:** Match — list FAB `.plus` / "Add a bill" / `canonicalCreate` / `.home`; tabs Upcoming/Paid/All with counts; `topBarAction == nil` by design; detail "Edit bill"/"Remove bill"/"Mark paid"; add-wizard schedule One-time/Recurring monthly/quarterly/yearly.
- **Field set:** Match (add-wizard) — Payee, Amount, Due date, Schedule. Minor presentation delta: iOS due-date uses always-populated inline `DatePicker` (defaults today, no placeholder); Android shows "Pick a date" placeholder + dialog, so the unset state is visible only on Android.
- **Validation rules:** Match — `detailsValid` = payee non-blank + amount parses > 0.
- **Empty-state copy:** Match — "No bills tracked yet" / "Add the utilities, insurance, and HOA dues for this home. Schedule auto-pay or split between household members."; banner titles match.
- **Error-state copy:** Match — list "Couldn't load your bills." (iOS non-APIError fallback) / shared message; detail "Couldn't load this bill." / "This bill is no longer available." both; add-wizard iOS fallbacks "Couldn't add this bill."/"Couldn't save these changes." vs Android raw message (same latent gap; typed strings identical).
- **Animation / transition:** Match — list root; detail `ContentDetailShell`; add-wizard `WizardShell` both.

## Home calendar
- **iOS:** `Homes/Calendar/HomeCalendarView.swift` (+ `HomeCalendarViewModel.swift`) · **Android:** `homes/calendar/HomeCalendarScreen.kt` (+ `HomeCalendarViewModel.kt`)
- **State coverage:** Match — loading/empty/loaded/error + filtered-empty "Nothing on this day" both.
- **Action affordances:** Match — FAB `.plus` / "Add event" / `secondaryCreate` / `.home`; month-strip prev/next + day-tap; banner "Today" CTA; no tabs.
- **Field set:** N/A
- **Validation rules:** N/A
- **Empty-state copy:** Match — full-empty "No events scheduled" / "Plan chores, repairs, birthdays, and household milestones. Members get notified automatically."; filtered-empty "Nothing on this day" / "Pick a different day or tap Today to see the full agenda."
- **Error-state copy:** Match — iOS fallback "Couldn't load your calendar." (non-APIError); Android shared message; typed strings identical.
- **Animation / transition:** Match — list root + custom month-strip header both.

## Documents
- **iOS:** `Homes/Documents/DocumentsView.swift` (+ `DocumentsViewModel.swift`) · **Android:** `homes/documents/DocumentsScreen.kt` (+ `DocumentsViewModel.kt`)
- **State coverage:** Match — loading/empty/loaded/error + per-filter empty both.
- **Action affordances:** Match — chip strip All/Recent/Expiring/Shared with counts; FAB `.upload` / "Upload document" / `secondaryCreate` / `.home`; top-bar search "Search documents"; banner "Export" CTA; row kebab.
- **Field set:** N/A (no inputs on this list)
- **Validation rules:** N/A
- **Empty-state copy:** Match — "No documents yet" / "Upload your lease, insurance, or warranties. Stored end-to-end encrypted, shareable with household members."; per-filter headlines + "Switch chips above or upload a document to populate this scope." match.
- **Error-state copy:** Match — iOS fallback "Couldn't load your documents." (non-APIError); Android shared message; typed strings identical.
- **Animation / transition:** Match — list root with chip-strip header both.

## Emergency info
- **iOS:** `Homes/Emergency/EmergencyInfoView.swift` (+ `EmergencyInfoViewModel.swift`) · **Android:** `homes/emergency/EmergencyInfoScreen.kt` (+ `EmergencyInfoViewModel.kt`)
- **State coverage:** Match — loading/empty/loaded/error + per-scope empty; pinned pseudo-section (All chip) both.
- **Action affordances:** Match — chip strip All/Shutoffs/Contacts/Evac/Medical with counts; FAB `.plus` / "Add emergency info" / `secondaryCreate` / `.home`; top-bar share "Share emergency info"; banner "Print card" CTA; per-row circular action.
- **Field set:** N/A (no inputs on this list)
- **Validation rules:** N/A
- **Empty-state copy:** Match — "No emergency info set up" / "Set up shutoffs, key contacts, evac spots, and medical info for this home. Easier to do now than during a 2 AM water leak."; scoped-empty + "Switch chips above or add an item to populate this category." match.
- **Error-state copy:** Match — iOS fallback "Couldn't load emergency info." (non-APIError); Android shared message; typed strings identical.
- **Animation / transition:** Match — list root with chip-strip header both.

## Access codes
- **iOS:** `Homes/AccessCodes/AccessCodesView.swift` (+ `AccessCodesViewModel.swift`) · **Android:** `homes/accesscodes/AccessCodesScreen.kt` (+ `AccessCodesViewModel.kt`)
- **State coverage:** Match — loading/empty/loaded/error + filtered-empty; both idempotent `load()`.
- **Action affordances:** Match — chip strip "All (N)" + per-category with counts; FAB `.plus` / "Add access code" / `secondaryCreate` / `.home`; top-bar search "Search access codes"; per-row copy + kebab; tap-to-reveal toggle + "Code copied" toast; shared a11y ids match string-for-string.
- **Field set:** N/A (no inputs on this list)
- **Validation rules:** N/A
- **Empty-state copy:** Match — "No access codes yet" / "One vault for every code at this address. Codes are encrypted, masked by default, and only shared with members you choose."; filtered variants + "Add <Category> code" CTA match.
- **Error-state copy:** Match — both hardcode "Couldn't load access codes. Try again." identically.
- **Animation / transition:** Match — bottom toast with fade/slide both; list root in nav stack both.

<!-- cluster:tier-homes-pillar2 -->

## Maintenance — list
- **iOS:** `Homes/Maintenance/MaintenanceListView.swift` (+ VM) · **Android:** `homes/maintenance/MaintenanceListScreen.kt` (+ VM)
- **State coverage:** Match — loading/empty/loaded/error via ListOfRows.
- **Action affordances:** Match — 3 tabs (Scheduled/Completed/All), "Log maintenance" canonicalCreate FAB (home tint), Scheduled-tab banner, no top-bar action.
- **Field set:** N/A
- **Validation rules:** N/A
- **Empty-state copy:** Match — "No maintenance logged yet" / "Track HVAC tune-ups, gutter cleans, filter swaps and inspections. Build a service history that protects warranties and resale value."
- **Error-state copy:** **Note (latent)** — iOS fallback "Couldn't load your maintenance log." (`MaintenanceListViewModel.swift:199`); Android raw `result.error.message` (`MaintenanceListViewModel.kt:163`). Same systemic pattern.
- **Animation / transition:** Match — pushed list.

## Maintenance — detail
- **iOS:** `Homes/Maintenance/MaintenanceDetailView.swift` · **Android:** `homes/maintenance/MaintenanceDetailScreen.kt` (+ VM)
- **State coverage:** Match — loading/loaded/error (no empty, single item).
- **Action affordances:** Match — Edit + Delete, delete-confirm; testTags `maintenanceDetail_edit/_delete/_deleteConfirm` mirror.
- **Field set:** N/A
- **Validation rules:** N/A
- **Empty-state copy:** N/A
- **Error-state copy:** Match — not-found "This maintenance entry is no longer available." both; headline "Couldn't load this entry" both. Generic fetch/delete fallbacks: iOS literals vs Android `result.error.message`. Delete-confirm body "It won't appear in the maintenance log anymore." matches.
- **Animation / transition:** **DELTA** — iOS delete confirm `.confirmationDialog` (action sheet, `MaintenanceDetailView.swift:162`) vs Android centered `AlertDialog` (`MaintenanceDetailScreen.kt:129`).

## Maintenance — log/edit form
- **iOS:** `Homes/Maintenance/LogMaintenanceFormView.swift` (+ VM) · **Android:** `homes/maintenance/LogMaintenanceFormScreen.kt` (+ VM)
- **State coverage:** Match — form (editing + submitting/error inline).
- **Action affordances:** Match — 7-tile category grid, performed-by segmented, next-due toggle, recurrence segmented, photo add/remove ×4, receipt attach/remove, close + commit.
- **Field set:** Match — category, title, dateCompleted, performedBy, performerName, performerContact, cost, nextDueToggle, nextDueDate, recurrence, notes, photos, receipt.
- **Validation rules:** Match — submit enabled iff non-blank title (+ Android also gates on `isDirty`; iOS FormShell receives both).
- **Empty-state copy:** N/A
- **Error-state copy:** **Note (latent)** — iOS "Couldn't save this maintenance entry." vs Android `result.error.message`.
- **Animation / transition:** Match (field-level) — both full-screen form; date: iOS inline `DatePicker`, Android `DatePickerDialog` (platform-idiomatic, same field).

## Members — list
- **iOS:** `Homes/Members/MembersListView.swift` (+ VM) · **Android:** `homes/members/MembersListScreen.kt` (+ VM)
- **State coverage:** Match — loading/empty-per-tab/loaded/error.
- **Action affordances:** Match — 3 tabs (Members/Guests/Pending), "Invite member" userPlus secondaryCreate FAB (home), member kebab→remove, pending Resend/Cancel, remove-confirm.
- **Field set:** N/A
- **Validation rules:** N/A
- **Empty-state copy:** Match — Members "No members yet" / "Invite a housemate to share tasks, bills, calendar, and access codes for this home."; Guests "No active guests" / "Add someone short-term — a sitter, visitor, or contractor — to share access while they're around."; Pending "No pending invites" / "Invitations you send to housemates appear here until they accept." (CTAs match).
- **Error-state copy:** **Note (latent)** — iOS "Couldn't load members. Try again." vs Android `result.error.message`. Remove-confirm body + button "Remove <name>" + title "Remove member?" match.
- **Animation / transition:** Match — remove-confirm iOS `.alert` ↔ Android `AlertDialog` (both modal).

## Members — invite member wizard
- **iOS:** `Homes/Members/InviteMemberWizardView.swift` (+ VM) · **Android:** `homes/members/InviteMemberWizardSheet.kt` (+ VM)
- **State coverage:** Match — form (Role/Identify/Review steps + inline error banner).
- **Action affordances:** Match — Role tiles, Next/Send invite, Back/Close, email field, personal-note editor.
- **Field set:** Match — email, message.
- **Validation rules:** Match — loose email (non-empty, ≤254, exactly one `@`, domain has `.`); Next gated on valid email both. Step copy matches verbatim.
- **Empty-state copy:** N/A
- **Error-state copy:** **Note (latent)** — iOS "Couldn't send the invite. Try again." vs Android `result.error.message`.
- **Animation / transition:** **DELTA** — iOS presents wizard as `.sheet(isPresented:)` (`MembersListView.swift:38`); Android as full-screen `Dialog` `usePlatformDefaultWidth=false` (`InviteMemberWizardSheet.kt:125-133`). Slide-up sheet vs fade dialog.

## Owners
- **iOS:** `Homes/Owners/OwnersListView.swift` (+ VM) · **Android:** `homes/owners/OwnersListScreen.kt` (+ VM)
- **State coverage:** Match — loading/empty/loaded/error; no tabs.
- **Action affordances:** **DELTA** — both have "Invite an owner" userPlus secondaryCreate FAB (home) + kebab→remove-confirm, but (1) remove-confirm button: iOS "Remove <name>" (`OwnersListView.swift:58`) vs Android bare "Remove" (`OwnersListScreen.kt:100`); (2) FAB→invite routing: iOS presents `InviteOwnerFormView` in an in-place `.sheet` (`OwnersListView.swift:39`) vs Android emits `OpenInvite` → external route `onOpenInvite(homeId)` (`OwnersListScreen.kt:61-63`).
- **Field set:** N/A
- **Validation rules:** N/A
- **Empty-state copy:** Match — "No owners yet" / "Invite a spouse, sibling, or co-investor who's on the deed. They'll upload proof and split the share with you."
- **Error-state copy:** **Note (latent)** — iOS "Couldn't load owners. Try again." vs Android `result.error.message`. Remove-confirm body + title "Remove owner?" match.
- **Animation / transition:** **DELTA** — iOS Invite Owner `.sheet` (modal) vs Android separate route (full-screen push). Remove-confirm iOS `.alert` ↔ Android `AlertDialog`.

## Packages — list
- **iOS:** `Homes/Packages/PackagesListView.swift` (+ VM) · **Android:** `homes/packages/PackagesListScreen.kt` (+ VM)
- **State coverage:** Match — loading/empty-per-tab/loaded/error.
- **Action affordances:** Match — 3 tabs (Expected/Delivered/Archived), "Log a package" canonicalCreate FAB (home), Expected-tab banner, row tap→detail.
- **Field set:** N/A
- **Validation rules:** N/A
- **Empty-state copy:** Match — Expected "No packages tracked yet" / "Log incoming deliveries so the household can see what's arriving — tracking, drop instructions, and who it's for."; Delivered "No delivered packages" / "Delivered packages show up here once a carrier marks them dropped off."; Archived "No archived packages" / "Returned or missing packages move to Archived after their lifecycle closes."
- **Error-state copy:** **Note (latent)** — iOS "Couldn't load your packages." vs Android `result.error.message`.
- **Animation / transition:** Match — pushed.

## Packages — detail
- **iOS:** `Homes/Packages/PackageDetailView.swift` · **Android:** `homes/packages/PackageDetailScreen.kt` (+ VM)
- **State coverage:** Match — loading/loaded/error.
- **Action affordances:** Match — "Mark picked up" primary, "Mark missing" ghost, "Remove package" destructive (when not returned); primary label state machine matches.
- **Field set:** N/A
- **Validation rules:** N/A
- **Empty-state copy:** N/A
- **Error-state copy:** Match — not-found "This package is no longer available." + headline "Couldn't load this package" both; generic fallbacks iOS literals vs Android `result.error.message`.
- **Animation / transition:** Match — pushed, `ContentDetailShell`.

## Packages — log a package form
- **iOS:** `Homes/Packages/LogPackageSheetView.swift` · **Android:** `homes/packages/LogPackageScreen.kt` (+ VM)
- **State coverage:** Match — single-page form (submit/error inline).
- **Action affordances:** Match — Cancel + Log package; testTags `logPackage_cancel/_submit`.
- **Field set:** Match — carrier, tracking number, description, drop instructions.
- **Validation rules:** Match — submit enabled iff any of carrier/tracking/description non-blank.
- **Empty-state copy:** N/A
- **Error-state copy:** **Note (latent)** — iOS "Couldn't log this package." vs Android `result.error.message`. Intro blurb matches.
- **Animation / transition:** **DELTA (chrome)** — iOS uses a nav-style sheet with title + top-bar leading "Cancel" (`LogPackageSheetView.swift:166-172`); Android renders an inline header Row with title + right-side inline "Cancel", no top app bar (`LogPackageScreen.kt:140-162`).

## Pets — list
- **iOS:** `Homes/Pets/PetsListView.swift` (+ VM) · **Android:** `homes/pets/PetsListScreen.kt` (+ VM)
- **State coverage:** Match — loading/empty/loaded/error; no tabs.
- **Action affordances:** **DELTA** — both have "Add a pet" plusCircle secondaryCreate FAB + row tap→edit + kebab→delete-confirm, but delete-confirm button: iOS "Remove <name>" (`PetsListView.swift:55`) vs Android bare "Remove" (`PetsListScreen.kt:113`).
- **Field set:** N/A
- **Validation rules:** N/A
- **Empty-state copy:** Match — "No pets yet" / "Add your pets so household members and pet-sitters have the info they need."
- **Error-state copy:** **Note (latent)** — iOS "Couldn't load pets. Try again." vs Android `result.error.message`. Delete-confirm body + title "Remove pet?" match.
- **Animation / transition:** **DELTA** — delete-confirm iOS `.alert` ↔ Android `AlertDialog`; wizard presentation differs (below).

## Pets — add/edit pet wizard
- **iOS:** `Homes/Pets/AddPetWizardView.swift` (+ VM) · **Android:** `homes/pets/AddPetWizardSheet.kt` (+ VM)
- **State coverage:** Match — form (Species/Basics/Details steps + error banner).
- **Action affordances:** Match — species tiles, Next / "Add pet"|"Save changes", Back/Close, name/breed/photoUrl fields + notes editor.
- **Field set:** Match — species, name, breed, photoUrl, notes.
- **Validation rules:** Match — primary gated on non-blank name; edit-mode titles/CTA match. Step copy matches verbatim.
- **Empty-state copy:** N/A
- **Error-state copy:** **Note (latent)** — iOS "Couldn't save the pet. Try again." vs Android `result.error.message`.
- **Animation / transition:** **DELTA** — iOS `.sheet`/`.sheet(item:)`; Android full-screen `Dialog`.

## Polls — list
- **iOS:** `Homes/Polls/PollsListView.swift` (+ VM) · **Android:** `homes/polls/PollsListScreen.kt` (+ VM)
- **State coverage:** Match — loading/empty-per-tab/loaded/error.
- **Action affordances:** Match — 2 tabs (Active/Closed), "Start a poll" secondaryCreate FAB (home), Active-tab banner, row chevron→detail; empty-CTA only on Active tab both.
- **Field set:** N/A
- **Validation rules:** N/A
- **Empty-state copy:** Match — Active "No active polls" / "Ask the household. Paint colours, weekend plans, whether to replace the dishwasher — get a quick read instead of a long thread."; Closed "No closed polls yet" / "Closed polls show up here once a vote wraps up or a member closes it manually."
- **Error-state copy:** **Note (latent)** — iOS "Couldn't load polls for this home." vs Android `result.error.message`.
- **Animation / transition:** Match — pushed.

## Polls — detail
- **iOS:** `Homes/Polls/PollDetailView.swift` · **Android:** `homes/polls/PollDetailScreen.kt` (+ VM)
- **State coverage:** Match — loading/loaded/error.
- **Action affordances:** Match — per-option `PollResultBar` tap-to-vote when active; optimistic vote + rollback; voteError text; vote disabled on closed both.
- **Field set:** N/A
- **Validation rules:** Match — block vote when closed.
- **Empty-state copy:** N/A
- **Error-state copy:** Match — not-found "This poll is no longer available." + headline "Couldn't load this poll" both; generic fallbacks iOS literals vs Android `result.error.message`.
- **Animation / transition:** Match — pushed, `ContentDetailShell`.

## Polls — start a poll form
- **iOS:** `Homes/Polls/StartPollFormView.swift` (+ Content, VM) · **Android:** `homes/polls/StartPollFormScreen.kt` (+ VM)
- **State coverage:** Match — editing/submitting/success/error; audience picker has loading shimmer + empty "No other members to invite." both.
- **Action affordances:** Match — kind picker (5), options add/remove, audience all + per-member toggles, close-date picker, anonymity toggle, Post, X close.
- **Field set:** Match — question, kind, options[], audience, closesAt, isAnonymous; question char-counter "<n> / 200" both.
- **Validation rules:** Match — question required 5–200; ≥2 unique non-empty options; close date required & ≥1h ahead. Error strings match verbatim ("Add at least 2 options.", "Each option must be unique.", "Close date must be at least 1 hour in the future.", …).
- **Empty-state copy:** N/A (audience-empty "No other members to invite." matches)
- **Error-state copy:** **DELTA** — iOS submit fallback "Couldn't start the poll." (`StartPollFormViewModel.swift:241`); Android `result.error.message ?: "Couldn't start the poll."` (`StartPollFormViewModel.kt:392`). **Plus:** iOS has an offline guard blocking submit with "You're offline. Try again when you're back online." (`swift:222-226`); Android `submit()` has no offline check.
- **Animation / transition:** **DELTA** — close-date entry: iOS inline `DatePicker` with `[.date, .hourAndMinute]` (date+time); Android `DatePickerDialog` date-only then auto-assigns time (5pm / now+2h) — Android cannot pick the close time-of-day.

## Household tasks — list
- **iOS:** `Homes/Tasks/HouseholdTasksListView.swift` (+ VM) · **Android:** `homes/tasks/HouseholdTasksListScreen.kt` (+ VM)
- **State coverage:** Match — loading/empty-per-tab/loaded/error.
- **Action affordances:** Match — 3 tabs (Active/Done/Recurring), "Add a task" secondaryCreate FAB (home), Active circular-checkbox optimistic toggle-done, Done status chip, Recurring kebab, Active-tab banner. Checkbox a11y labels "Mark done"/"Mark not done" match.
- **Field set:** N/A
- **Validation rules:** N/A
- **Empty-state copy:** Match — Active "No tasks yet" / "Track who's doing what. Add a one-off chore, or set up the recurring stuff (trash, dog walks, plants) once and let it spawn itself."; Done "Nothing done yet" / "Finished chores from the last 30 days will show up here."; Recurring "No recurring chores" / "Set up the weekly trash run, daily dog walks, or plant watering once and they'll spawn themselves." + "Add a recurring task".
- **Error-state copy:** **Note (latent)** — iOS "Couldn't load your tasks." vs Android `result.error.message`.
- **Animation / transition:** Match — pushed.

## Household tasks — add/edit task form
- **iOS:** `Homes/Tasks/AddHouseholdTaskFormView.swift` (+ field/schedule splits, VM, Skeleton) · **Android:** `homes/tasks/AddHouseholdTaskFormScreen.kt` (+ VM)
- **State coverage:** Match — loading[edit]/editing/error. Minor: Android edit-skeleton hardcodes title "Edit task" inside the shimmer (`AddHouseholdTaskFormScreen.kt:733`); iOS skeleton is geometry-only.
- **Action affordances:** Match — title + char counter, category chips ×7, assignee radios (incl. "Unassigned (any member)"), recurrence radios ×5, custom interval+unit sub-form, due-date field with Clear, notes editor, Save, X close.
- **Field set:** Match — title, category, assignedTo, recurrence, customInterval, customUnit, dueAt, notes.
- **Validation rules:** Match — title required + max 80; enum validity; custom interval whole 1–365 when recurrence=Custom. Custom-interval error strings match.
- **Empty-state copy:** N/A (assignee-empty "No members found in this home." matches)
- **Error-state copy:** Match on most — edit-load "Couldn't find that task." + headline "Couldn't load the task" + "Fix the highlighted field." + "Task added."/"Task updated." match. **DELTA:** iOS `save()` has offline guard "You're offline. Try again when you're back online." (`swift:436-441`); Android `save()` has none. Submit fallbacks iOS literals vs Android `result.error.message`-then-literal.
- **Animation / transition:** **DELTA** — due-date input: iOS inline `DatePicker` wheel; Android a plain `yyyy-MM-dd` text field (KeyboardType.Number, placeholder "YYYY-MM-DD", `AddHouseholdTaskFormScreen.kt:631-639`) — no calendar picker on Android.

<!-- cluster:tier-mailbox -->

## Mailbox list
- **iOS:** `Mailbox/MailboxListView.swift` (+ VM) · **Android:** `mailbox/MailboxListScreen.kt` (+ VM)
- **State coverage:** Match — ListOfRows loading/empty/loaded/error; tabs All/Unread/Starred; same pageSize 25 + query params (`viewed`/`archived`/`starred`).
- **Action affordances:** Match — top-bar "Search mail", row tap→open, pull-to-refresh, paginate; `fab = nil` both. Minor: iOS has a dormant `ToastBanner` overlay the VM never sets; Android has no toast surface — no reachable toast either side.
- **Field set:** N/A
- **Validation rules:** N/A
- **Empty-state copy:** Match — "No mail yet" / "When something lands in your mailbox, it'll show up here."
- **Error-state copy:** **Note (latent)** — iOS "Couldn't load mail." fallback vs Android `result.error.message` (generic NetworkError strings).
- **Animation / transition:** Match — list; detail pushed.

## Mailbox item detail (legacy generic)
- **iOS:** `Mailbox/ItemDetail/MailboxItemDetailView.swift` (+ VM, Shell) · **Android:** `mailbox/item_detail/MailboxItemDetailScreen.kt` (+ VM, Shell)
- **State coverage:** Match (3 states: loading/loaded/error) — but loading & error chrome differ (see below).
- **Action affordances:** **DELTA** — (1) Loading: iOS shows accent strip + `ContentDetailTopBar` with working Back (`MailboxItemDetailView.swift:182-194`); Android omits the top bar, puts a `PrimaryButton "Back"` at the bottom of the shimmer (`MailboxItemDetailScreen.kt:233`). (2) Error: iOS `ErrorLayout` has top-bar Back + EmptyState; Android `ErrorLayout` is EmptyState only, **no Back affordance / no top bar** (`MailboxItemDetailScreen.kt:237-249`). Loaded affordances (sender-avatar tap, AI chips, primary/ghost CTAs, certified terms sheet) match.
- **Field set:** N/A (certified ack checkbox present both)
- **Validation rules:** Match — certified primary gated on `certifiedAckChecked` both.
- **Empty-state copy:** N/A
- **Error-state copy:** Match headline "Couldn't load this item"; iOS fallback "Couldn't load this item." vs Android `result.error.message`. Offline CTA toast "You're offline. Try again when you're back online." matches.
- **Animation / transition:** Match — pushed; certified "View terms" sheet both.

## Mail detail A17 (generic + Booklet + Certified + Community)
- **iOS:** `Mailbox/MailDetail/MailDetailView.swift` (+ VM, `Variants/*`, shared `MailItemDetailShell.swift`) · **Android:** `mailbox/mail_detail/MailDetailScreen.kt` (+ VM, `variants/*`, shared `MailItemDetailShell.kt`)
- **State coverage:** Match — loading (top bar + 3 shimmers) / loaded / error; no empty.
- **Action affordances:** Match per variant — generic overflow (Forward, Save to vault, Archive, Mark unread, Delete, Report) + acknowledge + secondary tiles; Booklet (Share/Save to vault/Save PDF/Archive/Delete + "Save to Vault" primary); Certified (Save-to-vault eyebrow + overflow + acknowledge + Pay/Calendar/Dispute/Archive); Community (Share/Save to vault/Add to calendar/Mute/Report/Delete + RSVP Going/Maybe/Can't make it + pulse-thread CTA). All present both.
- **Field set:** N/A (read-only)
- **Validation rules:** N/A
- **Empty-state copy:** N/A
- **Error-state copy:** Match headline "Couldn't load this item"; iOS fallback "Couldn't load this item." vs Android `result.error.message`.
- **Animation / transition:** Match (pushed; sheets/dialogs match). **Two minor DELTAs:** (1) **eyebrow trust dot** — iOS generic projection elevates `certified/community/legal/tax` to `.verified` (`MailDetailViewModel.swift:373-376`); Android always uses `trust.detailTrust` (=`.neutral`) (`MailDetailViewModel.kt:345`), so `legal`/`tax` mail shows a green dot on iOS vs slate on Android (variant layouts hardcode their own trust, unaffected). (2) **community last-reply preview** — iOS "Author preview" (`CommunityDetailLayout.swift:847`) vs Android "Author: preview" with a colon (`CommunityDetailLayout.kt:1151`).

## Mailbox disambiguate
- **iOS:** `Mailbox/Disambiguate/DisambiguateMailFormView.swift` (+ VM) · **Android:** `mailbox/disambiguate/DisambiguateMailFormScreen.kt` (+ VM)
- **State coverage:** Match — form (editing + inline error toast).
- **Action affordances:** Match — 3 recipient radios, alias-notes field, sticky "Confirm recipient", FormShell close/discard; envelope image with shimmer + placeholder.
- **Field set:** Match — recipient choice + alias notes; both POST `drawer` + optional `addAlias`/`aliasString`.
- **Validation rules:** Match — alias ≤255 ("Notes must be 255 characters or fewer."), `canSubmit = selected != null && aliasError == null && !isSubmitting`. **Minor DELTA:** iOS-only pre-submit offline guard (`isOnlineProvider`); Android relies on the failure path.
- **Empty-state copy:** N/A
- **Error-state copy:** Match (effectively) — submit failure iOS `errorDescription ?? "Couldn't route this mail."` vs Android `error.message ?: "Couldn't route this mail."` (same literal); "Pick a destination first." + success "Mail routed to <choice>." match; iOS-only offline toast.
- **Animation / transition:** Match — pushed both (production route). (iOS YouTabRoot debug entry uses `.sheet` — debug-only.)

## Mailbox search
- **iOS:** `Mailbox/Search/MailboxSearchView.swift` (+ VM) · **Android:** `mailbox/search/MailboxSearchScreen.kt` (+ VM)
- **State coverage:** Match — shared SearchListShell (recent/typing-shimmer/results/empty); no error phase either side (by design).
- **Action affordances:** Match — search field, cancel/back, result-row tap→open; rows reuse `MailboxListViewModel.makeRow`.
- **Field set:** Match — single query field (placeholder "Search mail"); case-insensitive substring across sender/address/subject/title/preview/content/category; corpus limit 100.
- **Validation rules:** Match — blank query → [].
- **Empty-state copy:** Match — "No matching mail" / "Try a different sender, subject, or category."
- **Error-state copy:** N/A
- **Animation / transition:** Match — pushed; shell paints header.

## Vault
- **iOS:** `Mailbox/Vault/VaultListView.swift` (+ VM) · **Android:** `mailbox/vault/VaultListScreen.kt` (+ VM)
- **State coverage:** Match — ListOfRows loading/empty/loaded/error; both fetch folders then union per-folder items (limit 20) in parallel.
- **Action affordances:** Match — FAB "Save mail to vault" (SecondaryCreate, sky), search bar, row tap + kebab (open item), empty CTA "Open Mailbox".
- **Field set:** Match — search query ("Search vault"); substring over title/subtitle/folder label.
- **Validation rules:** Match.
- **Empty-state copy:** Match — "Your vault is empty" / "Save mail to keep it. Anything you bookmark from your Mailbox lands here — civic notices, permits, receipts, scanned letters." / "Open Mailbox".
- **Error-state copy:** **Note (latent)** — iOS "Couldn't load your vault." vs Android `result.error.message`.
- **Animation / transition:** Match — list; pushed detail.

## Ceremonial Mail Compose
- **iOS:** `CeremonialMail/CeremonialMailWizardView.swift` (+ VM, Content) · **Android:** `ceremonial_mail/CeremonialMailWizardScreen.kt` (+ VM, Content)
- **State coverage:** Match — 5 steps (decide/verify/compose/commit/success); recipient search `isSearching` spinner; inline submit-error banner.
- **Action affordances:** Match — recipient search + results + selected card, intent radios, address ack toggles, stationery/ink/seal pickers, body editor, voice postscript record/clear, send-timing radios, review card, per-step CTA + success secondary "Back to Hub". WizardShell chrome.
- **Field set:** Match — recipient query, intent, 2 toggles, 3 chip pickers, body, voice postscript, send-timing.
- **Validation rules:** Match — decide=recipient, verify=addressConfirmed, compose=non-blank body, commit=!submitting; search ≥2 chars + 250ms debounce.
- **Empty-state copy:** N/A
- **Error-state copy:** **DELTA** — iOS `errorDescription ?? "Couldn't send your letter. Try again."` (`CeremonialMailViewModel.swift:342`); Android hardcodes "Couldn't send your letter. Try again." ignoring `result.error.message` (`CeremonialMailViewModel.kt:204`). Same literal; iOS would show a server message when present.
- **Animation / transition:** Match — WizardShell step transitions; pushed.

## Ceremonial Mail Open
- **iOS:** `CeremonialMailOpen/CeremonialMailOpenView.swift` (+ VM, Content) · **Android:** `ceremonial_mail_open/CeremonialMailOpenScreen.kt` (+ VM, Content)
- **State coverage:** Match — loading (top bar + 3 shimmers) / error / loaded(phase). Android adds a "Missing mail id." error when the nav arg is blank (`CeremonialMailOpenViewModel.kt:35`); iOS always receives a non-empty mailId.
- **Action affordances:** Match across all 4 frames — porch (Close, tap-envelope, "Open envelope", "Skip animation"); reading (Close, Share, Archive, voice play/pause, sticky Reply/Save/Archive); reply handoff (Back, "Continue →", paper/ink swatches, compose icons). testTags mirror.
- **Field set:** N/A (reply compose is a static handoff preview, "Begin your reply…" placeholder, no live editor either)
- **Validation rules:** N/A
- **Empty-state copy:** N/A
- **Error-state copy:** Match — headline "Couldn't open this letter" + "Couldn't load this letter." both (Android hardcodes same literal).
- **Animation / transition:** Match — pushed (not modal). Seal phases align: sealed→breaking auto-advance 750ms, glow 1.2s autoreverse, lift −6 over 300ms, scale 1.04, paper 300ms+50ms delay, "≤2s" budget, reduce-motion + "Skip animation" jump to open both. **Edge DELTA:** under reduce-motion in the breaking phase, iOS sets scale 0.96 (`CeremonialMailOpenView.swift:209-210`) while Android `tween(0)` snaps to 1.04 (`CeremonialMailOpenContent.kt:330-334`) — transient (both skip to open).

<!-- cluster:tier2-chat-identity -->

## Chat list
- **iOS:** `Chat/ChatListView.swift` (+ VM) · **Android:** `inbox/chat/ChatListScreen.kt` (+ VM)
- **State coverage:** Match — loading/empty/loaded/error.
- **Action affordances:** Match — compose button, search bar, 4 filter tabs, row tap, empty "New message", error "Try again". **Minor (non-button):** iOS populated list has `.refreshable` pull-to-refresh (`ChatListView.swift:131`); Android `PopulatedFrame` has none (`ChatListScreen.kt:394`).
- **Field set:** N/A
- **Validation rules:** N/A
- **Empty-state copy:** Match — "No conversations yet" / "Message someone you've verified nearby." / "Only verified neighbors can DM you".
- **Error-state copy:** Match — headline "Couldn't load chat"; both fall back to "Couldn't load conversations."
- **Animation / transition:** Match — inline tab content both.

## Chat conversation
- **iOS:** `Chat/Conversation/ChatConversationView.swift` (+ VM) · **Android:** `inbox/conversation/ChatConversationScreen.kt` (+ Content, VM)
- **State coverage:** Match — loading/empty(person/group/AI welcome)/loaded/error. (Both use a spinner for loading — symmetric.)
- **Action affordances:** **DELTA** — iOS attach button opens a `confirmationDialog` ("Photo or video"/"Listing"/"Gig"/"Location"/"Payment request"/"Cancel", `ChatConversationView.swift:52-63`); Android attach disc is a no-op `.clickable {}` with no menu (`ChatConversationScreen.kt:926`). Send/back/quick chips/AI prompts/retry/header icons match.
- **Field set:** Match — single composer field both.
- **Validation rules:** Match — send gated on non-empty trimmed text + not sending.
- **Empty-state copy:** Match — "Say hi to <first>" + "You're both verified neighbors on <locality>. New conversations stay private." / "You're both verified neighbors. New conversations stay private."; pill "DMs end-to-end encrypted between verified addresses"; AI "Hi! I can help you post tasks, find listings, or summarize mail. What can I help with today?".
- **Error-state copy:** Match — headline "Couldn't load this conversation"; iOS fallback "Couldn't load this conversation." vs Android `error.message`.
- **Animation / transition:** Match — pushed full-screen; attach action sheet is iOS-only (tied to affordance delta).

## New message picker
- **iOS:** `Chat/NewMessage/NewMessageView.swift` (+ VM) · **Android:** `inbox/newmessage/NewMessageScreen.kt` (+ VM)
- **State coverage:** Match — loading/empty/loaded(+ in-loaded "no matches" pivot)/error.
- **Action affordances:** Match — Cancel, search clear, row tap, empty "Invite someone to Pantopus", error "Try again".
- **Field set:** Match — single search field; placeholder "Search by name or neighborhood".
- **Validation rules:** Match — verified search at ≥2 chars, 280ms debounce.
- **Empty-state copy:** Match — "Search for someone to message" / "You can message anyone with a verified Pantopus account. Search by name, or invite someone who isn't on the platform yet." + hints; pivot "No matches" / "Try a different name or neighborhood."
- **Error-state copy:** Match — "Couldn't load contacts" / "Couldn't load contacts. Try again."
- **Animation / transition:** Match — modal-style top bar with Cancel; presented as route/sheet both.

## Chat search
- **iOS:** `Chat/Search/ChatSearchView.swift` (+ VM, Content) · **Android:** `inbox/search/ChatSearchScreen.kt` (+ VM, Content)
- **State coverage:** Match — shared SearchListShell (loading shimmer/empty/results); no error state either (client-side index).
- **Action affordances:** Match — search field, cancel/back, result-row tap.
- **Field set:** Match — single search field; placeholder "Search people and messages".
- **Validation rules:** **DELTA** — match rule differs: iOS folds case AND diacritics (`[.caseInsensitive, .diacriticInsensitive]`, `ChatSearchContent.swift:82,94,124`); Android folds case only (`ignoreCase = true`, `ChatSearchContent.kt:52,66,87`). Snippet window matches.
- **Empty-state copy:** Match — "No matches" / "Try a name or a word from a message."
- **Error-state copy:** N/A
- **Animation / transition:** Match — shared SearchListShell.

## Connections
- **iOS:** `Connections/ConnectionsView.swift` (+ VM) · **Android:** `connections/ConnectionsScreen.kt` (+ VM)
- **State coverage:** Match — shared ListOfRows (loading/loaded/empty-per-tab/error); error only when both GETs fail.
- **Action affordances:** Match — back, top-bar `user-plus`, FAB `user-plus`, search bar, 3 tabs, per-row Message CTA, Accept/Ignore, empty "Find people".
- **Field set:** Match — search field "Search by name or neighborhood".
- **Validation rules:** N/A (client-side substring filter; identical)
- **Empty-state copy:** Match — All "No connections yet" / "Meet verified neighbors. Browse the Pulse, reply to a post, or invite someone you know on the block." + "Find people"; Neighbors + Pending copy match.
- **Error-state copy:** Match — "Couldn't load your connections. Try again."
- **Animation / transition:** Match — pushed list.

## Public profile
- **iOS:** `Profile/PublicProfileView.swift` (+ VM, `PublicProfileChrome.swift`) · **Android:** `profile/PublicProfileScreen.kt` (+ VM, `PublicProfileChrome.kt`)
- **State coverage:** **Resolved (P6.8)** — Android `ErrorLayout` now renders a `ContentDetailTopBar(onBack=)` above the `EmptyState` (mirroring `LoadingLayout`), matching iOS's escapable error screen. Both: loading/loaded/error (no empty by design).
- **Action affordances:** Match — back, overflow (Block/Report), Persona Follow CTA, Local Message+Connect CTAs, stats tabs, locked-broadcast "Subscribe to unlock", error "Try again".
- **Field set:** N/A
- **Validation rules:** N/A
- **Empty-state copy:** N/A as a state; posts-feed empty matches — Persona "No broadcasts yet — check back soon." / Local "No posts from this neighbor yet."
- **Error-state copy:** Match — headline "Couldn't load this profile"; friendlyMessage identical ("We couldn't find this profile." / "This profile is private." / "Check your connection and try again." / "Something went wrong. Try again."). Both call `GET /api/users/id/:id` (agree).
- **Animation / transition:** **DELTA** — overflow menu: iOS `.confirmationDialog` (`PublicProfileView.swift:55-68`) vs Android `ModalBottomSheet` (`PublicProfileScreen.kt:127-143`). Report sheet is a bottom sheet on both (match).

## Edit profile
- **iOS:** `Profile/EditProfileView.swift` (+ VM) · **Android:** `profile/EditProfileScreen.kt` (+ VM)
- **State coverage:** **DELTA** — loaded/error match, but **loading** differs: iOS renders `ProgressView("Loading profile…")` (screen-level spinner, `EditProfileView.swift:23`); Android renders a shimmer skeleton `EditProfileSkeleton` (`EditProfileScreen.kt:551`). Project state-rule mandates a skeleton; iOS uses a spinner.
- **Action affordances:** Match — Close, Save, per-field edit, DOB "Clear", success/error toast, error "Try again". Sub-affordance: iOS native `DatePicker` for DOB vs Android `yyyy-MM-dd` text field + deferred system picker.
- **Field set:** Match — identical `EditProfileField` enum (firstName, middleName, lastName, bio, tagline, phoneNumber, dateOfBirth, address, city, state, zipcode, website, linkedin, twitter, instagram, facebook, profileVisibility); email read-only both.
- **Validation rules:** Match — 1:1 validators (names req+max255, bio max2000, tagline max255, phone E.164, dob isoDateOrEmpty, address 5-255, city 2-100, state 2-50, zip 3-20, social urlOrEmpty, visibility ∈ {public,registered,private}).
- **Empty-state copy:** N/A
- **Error-state copy:** Match — load error "Couldn't load profile"; toasts "Fix the highlighted field." / "You're offline. Try again when you're back online." / "Profile updated." / "Couldn't save profile." match.
- **Animation / transition:** Match — sheet/route; both hold success toast ~700ms before dismiss.

## Report user sheet
- **iOS:** `Profile/ReportUserSheet.swift` · **Android:** `profile/ReportUserSheet.kt` (+ VM)
- **State coverage:** Match — idle/submitting/succeeded/failed; no fetchable loading (form-only).
- **Action affordances:** Match — 6 reason radios, details field, "Submit report", "Cancel". (iOS has Cancel in nav toolbar AND a ghost Cancel; Android has a ghost Cancel + relies on sheet-dismiss.)
- **Field set:** Match — reason (radio) + details (multiline).
- **Validation rules:** Match — submit enabled when a reason chosen; "Other" requires non-empty details; backendKey mapping matches.
- **Empty-state copy:** N/A
- **Error-state copy:** Match — friendlyMessage identical ("We couldn't find that user." / "You don't have permission to do that." / "Check your connection and try again." / "Couldn't submit your report."); intro + labels + placeholders match.
- **Animation / transition:** **DELTA** — iOS `.sheet` wrapping a `NavigationStack` (nav bar + title "Report @handle", inline Cancel); Android `ModalBottomSheet` with in-content title, no nav bar. Both bottom-sheet, but iOS carries nav chrome Android lacks.

## Me / You
- **iOS:** `Me/MeView.swift` (+ VM, `MeIdentity.swift`) · **Android:** `you/me/MeView.kt` (+ VM, `MeIdentity.kt`); sign-out/debug chrome in `you/YouScreen.kt`
- **State coverage:** Match — loading(skeleton)/loaded(3 identity bundles)/error. (iOS `toastMessage` overlay is dormant — VM never sets it; Android omits.)
- **Action affordances:** **Resolved (P6.8)** — iOS now includes the 7th "Support trains" tile (`me.supportTrains`, `.handCoins`) in the Personal grid, matching Android + the design (`me-frames.jsx:352`); the route was already wired in `YouTabRoot`. Identity pills/stats/section rows/destructive card/sign-out match.
- **Field set:** N/A
- **Validation rules:** N/A
- **Empty-state copy:** Match (per-identity unbound) — Home "Claim a home" / "Add a home from the Hub to unlock household tools."; Business "Add a business" / "Business identity is set up in the web app today; mobile read APIs land later."
- **Error-state copy:** Match — headline "Couldn't load this tab"; body fallback "Couldn't load your profile." both.
- **Animation / transition:** Match — scrollable tab content; identity switch is in-place rebind. Sign-out confirm: Android `AlertDialog` ("Sign out of Pantopus?" / "You'll need to sign in again to access your hub.") ↔ iOS host-level `onLogOut`.

## Identity Center
- **iOS:** `IdentityCenter/IdentityCenterView.swift` (+ VM, Content) · **Android:** `identity_center/IdentityCenterScreen.kt` (+ VM, Content)
- **State coverage:** Match — loading/loaded/error; no empty (always 4 cards).
- **Action affordances:** Match — back, switcher (`menu`) → sheet, 4 identity cards, 2 "Profile links" toggles, privacy rows, disclosure rows, error "Try again".
- **Field set:** N/A (toggles only)
- **Validation rules:** N/A
- **Empty-state copy:** N/A
- **Error-state copy:** **DELTA (body)** — headline "Couldn't load Profiles & Privacy" both; iOS body `(error as? APIError)?.errorDescription ?? "Couldn't load Profiles & Privacy."` (dynamic, `IdentityCenterViewModel.swift:35`); Android always the literal (`IdentityCenterViewModel.kt:51`) — Android never surfaces the server message. Card/row copy matches verbatim.
- **Animation / transition:** Match — switcher is a sheet both (iOS `.sheet` `[.medium,.large]`; Android `ModalBottomSheet`).

## My posts
- **iOS:** `MyPosts/MyPostsView.swift` (+ VM) · **Android:** `my_posts/MyPostsScreen.kt` (+ VM)
- **State coverage:** Match — shared ListOfRows loading/loaded/empty-per-tab/error.
- **Action affordances:** Match — back, top-bar filter, FAB "Write a post", 2 tabs (Active/Archived), row tap, kebab → Archive/Restore + Delete, delete confirm, empty CTAs, filter sheet. Kebab labels "Restore post"/"Archive post"/"Delete post"/"Cancel" match.
- **Field set:** N/A (filter sheet is shared `ActivityFilterSheet`)
- **Validation rules:** N/A
- **Empty-state copy:** Match — Active "You haven't posted yet" / "Ask a question, recommend a spot, or share a local heads-up. Your neighbors will see it on the Pulse." + "Write a post"; Archived + filtered "No posts match your filters" / "Clear filters" match.
- **Error-state copy:** **Note (latent)** — iOS "Couldn't load your posts." vs Android `result.error.message`. Delete-confirm "Delete this post?" / "This post will be permanently removed from your profile and the Pulse feed." matches.
- **Animation / transition:** **DELTA** — kebab: iOS `.confirmationDialog` (`MyPostsView.swift:28-55`) vs Android `ModalBottomSheet` (`MyPostsScreen.kt:99-111`). Delete confirm `.alert` ↔ `AlertDialog` (match); filter is a sheet both.

<!-- cluster:tier-discover-nearby -->

## Discover hub
- **iOS:** `DiscoverHub/DiscoverHubView.swift` (+ VM, `DiscoveryFilterSheet.swift`) · **Android:** `discoverhub/DiscoverHubScreen.kt` (+ VM, `DiscoveryFilterSheet.kt`)
- **State coverage:** Match — loading (skeleton)/loaded/whole-screen empty (all 4 sections empty)/error (all 4 fetches fail).
- **Action affordances:** Match — `sliders-horizontal` filter w/ badge, chip strip (Nearby/New today/Verified/Free/wanted), 4 section "See all" + per-row taps. Both fan out 4 parallel `GET /api/hub/discovery?filter=…` with same params.
- **Field set:** N/A (filter fields below)
- **Validation rules:** N/A
- **Empty-state copy:** Match — "Nothing to discover yet" / "You're early to this block. People, businesses, gigs, and listings will appear here as neighbors verify and join. Check back soon."
- **Error-state copy:** Match — "Couldn't load discovery. Try again."
- **Animation / transition:** Match — DiscoveryFilterSheet bottom sheet both (iOS `.sheet`+`.presentationDetents([.medium])`, Android `ModalBottomSheet`); fields identical.

## Discover businesses
- **iOS:** `DiscoverBusinesses/DiscoverBusinessesView.swift` (+ VM, `BusinessFilterSheet.swift`) · **Android:** `discoverbusinesses/DiscoverBusinessesScreen.kt` (+ VM, `BusinessFilterSheet.kt`)
- **State coverage:** Match — loading/loaded/two empties (no-results + no-location)/error; both keep prior list during chip/search refetch.
- **Action affordances:** Match — search bar, filter w/ badge, category chip strip (`all`+8), per-row tap, empty CTAs ("Invite a business" / "Widen radius"). Same `GET /api/businesses/search` params.
- **Field set:** Match — search "Search businesses or services"; filter (Category, Distance slider, Rating radio, Open-now toggle) identical.
- **Validation rules:** Match — 300ms search debounce.
- **Empty-state copy:** Match — no-results "No verified businesses nearby yet" / "Widen your search radius, or invite a business you trust on the block. They'll show up here once they verify their address."; no-location "Set a home address" / "We need a verified home address to surface businesses near you. Add one in your profile and they'll appear here."
- **Error-state copy:** Match — "Couldn't load businesses. Try again."
- **Animation / transition:** Match — BusinessFilterSheet bottom sheet both.

## Audience profile / Creator hub (+ Broadcast detail)
- **iOS:** `AudienceProfile/AudienceProfileView.swift` (+ VM, Content) + `BroadcastDetail/` · **Android:** `audience_profile/AudienceProfileScreen.kt` (+ VM, Content) + `broadcast_detail/`
- **State coverage:** Match — loading(shimmer)/loaded(3 tabs)/empty(no persona→setup)/error; per-tab sub-empties all present. BroadcastDetail loading/loaded/error.
- **Action affordances:** Match — back, 3 tabs (Updates/Followers/Threads), composer (visibility picker + Post update), update tap→broadcast detail, tier filter chips, follower sort chips, follower search, threads filter chips, "View all messages"→Creator Inbox, setup/retry. Both use `/api/personas/*` exclusively. **Endpoint follow-up RESOLVED:** the `/api/users/:id` concern is NOT here — it's in visitor-side `Profile/PublicProfileViewModel`, where both platforms call the same `GET /api/users/id/:id`.
- **Field set:** Match — composer input, follower search input.
- **Validation rules:** Match — composer `canSubmit` (non-empty body AND tier target when tierOrAbove AND !submitting).
- **Empty-state copy:** Match — screen-empty "Create a Public Profile to send updates and manage followers."; all tab/sub copy verified word-for-word; BroadcastDetail "No replies yet" / "Reply first — your followers will see your message under this broadcast."
- **Error-state copy:** **DELTA (default matches)** — iOS `errorDescription ?? "Couldn't load Public Profile."` (`AudienceProfileViewModel.swift:78`); Android hardcodes "Couldn't load Public Profile." (`AudienceProfileViewModel.kt:73,83,124`). BroadcastDetail "Couldn't load this broadcast." matches.
- **Animation / transition:** Match — full-screen push. Minor: BroadcastDetail tier-bar percent rounds (iOS `.rounded()`) vs truncates (Android `.toInt()`) — off-by-1% label possible, cosmetic.

## Creator inbox
- **iOS:** `CreatorInbox/CreatorInboxView.swift` (+ VM, Content) · **Android:** `creator_inbox/CreatorInboxScreen.kt` (+ VM, Content)
- **State coverage:** Match — loading(shimmer)/loaded/empty(no threads→prompt hero)/filtered-empty/error.
- **Action affordances:** Match — back, counts banner Settings link, filter chip strip (All/Unread/Bronze+/Flagged) w/ live counts, row tap→conversation, empty prompt rows. Top-bar check/sliders glyphs decorative both.
- **Field set:** N/A
- **Validation rules:** N/A
- **Empty-state copy:** Match — "No DM threads yet" / "Your fans haven't reached out. DMs usually start after a broadcast, a paywall reply, or a tip — try one of these to get the inbox moving." + 3 prompt rows + footnote + filtered-empty, verified word-for-word.
- **Error-state copy:** **DELTA (default matches)** — iOS `errorDescription ?? "Couldn't load your inbox."`; Android hardcodes "Couldn't load your inbox." Headline matches.
- **Animation / transition:** Match — standard push.

## Business profile
- **iOS:** `BusinessProfile/BusinessProfileView.swift` (+ VM, Content) · **Android:** `business_profile/BusinessProfileScreen.kt` (+ VM, Content)
- **State coverage:** Match — loading(violet-band shimmer)/loaded/notFound/error.
- **Action affordances:** Match — back, share, overflow (Share business/Report/Cancel), 3 tabs (Overview/Services/Reviews), contact rows, sticky dock Message+Save+Visit, retry; per-tab empties present.
- **Field set:** N/A
- **Validation rules:** N/A
- **Empty-state copy:** Match — Overview/Services/Reviews empties + not-found "Business not found" / "This business may have moved or unpublished their profile." verified word-for-word.
- **Error-state copy:** Match — headline "Couldn't load this business"; friendly messages identical.
- **Animation / transition:** **DELTA** — overflow menu: iOS `.confirmationDialog` (`BusinessProfileView.swift:55-66`) vs Android `ModalBottomSheet` (`BusinessProfileScreen.kt:151-168`). Toast transition differs (iOS slide+opacity vs Android static box).

## My businesses
- **iOS:** `Businesses/MyBusinessesView.swift` (+ VM) · **Android:** `businesses/MyBusinessesScreen.kt` (+ VM)
- **State coverage:** Match — loading/loaded/empty/error via ListOfRows; `GET /api/businesses/my-businesses`.
- **Action affordances:** Match — `building2` SecondaryCreate FAB (business tint) "Register a business", row tap→dashboard, intro banner, empty CTA "Register a business".
- **Field set:** N/A
- **Validation rules:** N/A
- **Empty-state copy:** Match — "No businesses yet" / "Create a business profile to take quotes inside Pantopus and earn the violet verified mark." / "Register a business".
- **Error-state copy:** **Note (latent)** — iOS `errorDescription ?? "Something went wrong."` vs Android raw `result.error.message` (no fixed fallback).
- **Animation / transition:** Match — standard push.

## Nearby (MapListHybrid)
- **iOS:** `Nearby/NearbyMapView.swift` (+ VM, Content) · **Android:** `nearby/map/NearbyMapScreen.kt` (+ VM, Content). (Android `nearby/NearbyScreen.kt` is a dead `NotYetAvailableView` placeholder; live tab wires `NearbyMapScreen`.)
- **State coverage:** **DELTA (shared gap)** — both have loading/loaded/error in the sheet but **no `.empty` state** (zero entities → empty rail under "0 gigs nearby"). Loading uses a bare spinner on both (violates the house "no screen-spinner" rule) — equal to each other.
- **Action affordances:** Match — back, "Gigs" title, filters button, category dot-chips, Locate me + Layers, sort dropdown (Newest/Closest/Highest pay/Fewest bids), pin tap→open+select, cluster tap→zoom, card/row tap, collapsed "drag up" prompt. Same `GET /api/gigs/in-bounds` + `/api/listings/in-bounds`.
- **Field set:** N/A (map filter below)
- **Validation rules:** N/A
- **Empty-state copy:** N/A (no empty state either)
- **Error-state copy:** **DELTA** — iOS hardcodes "Couldn't load map data." (`NearbyMapViewModel.swift:191`); Android uses gig failure `error.message` (`NearbyMapViewModel.kt:176-177`).
- **Animation / transition:** Match on detents — 3-stop sheet collapsed 0.20 / standard 0.40 / expanded 0.70 (`NearbyMapContent.swift:85-91` / `NearbyMapContent.kt:36-40`). **DELTAs:** (1) drag-release velocity threshold iOS 600 vs Android 1200 (+ Android 60px drag threshold + `tween(240ms)` vs iOS `interpolatingSpring(stiffness:320,damping:30)`); (2) active-pin pulse halo animates on iOS (1.6s repeatForever) but is static on Android; map engine MapKit vs Google Maps (expected native difference).

## Map filter sheet
- **iOS:** `Nearby/MapFilterSheet.swift` · **Android:** `nearby/map/MapFilterSheet.kt`
- **State coverage:** N/A (stateless sheet; Apply re-projects client-side).
- **Action affordances:** Match — Apply (re-projects + drops stale selection) + dismiss; shared FilterSheetShell.
- **Field set:** Match — `entityType` radio (Both/Gigs/Listings) + `distance` range slider (0–5 mi, step 1) + shared gig sections (category / budget $0–$500+ / schedule / openToBids / postedWithin).
- **Validation rules:** Match — `isDistanceActive` + `activeCount` identical.
- **Empty-state copy:** N/A
- **Error-state copy:** N/A
- **Animation / transition:** Match — bottom sheet both.

## Content detail (gig / listing / invoice)
- **iOS:** `ContentDetail/TransactionalDetailShell.swift` (+ Content, GigDetailViewModel, ListingDetailViewModel, InvoiceDetailViewModel) · **Android:** `contentdetail/ContentDetailShell.kt` (+ Content, 3 VMs)
- **State coverage:** Match — shell loading/loaded/error (no empty by design). Loading uses a centered spinner both. Gig `GET /api/gigs/:id` (+bids); Listing `GET /api/listings/:id`; Invoice hardcoded fixture both.
- **Action affordances:** **DELTA (gig bids gating)** — iOS fetches/renders bids only when `viewerIsOwner` (`GigDetailViewModel.swift:43-49`); Android fetches `repo.bids(gigId)` and renders the Bids module for any viewer with non-empty bids (`GigDetailViewModel.kt:51-56,177`, no owner check) — a non-owner sees bids on Android that iOS hides. Otherwise match (back, overflow, sticky dock primary/secondary, Message, cover paging; listing dock swaps "Make offer"↔"View offers" by ownership; invoice "Pay $…").
- **Field set:** N/A
- **Validation rules:** N/A
- **Empty-state copy:** N/A
- **Error-state copy:** **DELTA (headline matches)** — shell headline "Couldn't load detail" both; body iOS entity-specific fallbacks "Couldn't load gig." / "Couldn't load listing." behind `errorDescription`, Android passes `result.error.message`.
- **Animation / transition:** Match — push + sticky dock. Minor content deltas: iOS formats gig `scheduledStart`/`deadline` (`"EEE MMM d · h:mm a"`) while Android renders raw ISO; iOS adds a `deadline`→"By" fallback Android lacks.

## Privacy handshake
- **iOS:** `PrivacyHandshake/PrivacyHandshakeWizardView.swift` (+ VM, Content) · **Android:** `handshake/PrivacyHandshakeScreen.kt` (+ VM, Content)
- **State coverage:** Match — loading(shimmer)/ready(6 wizard steps)/error.
- **Action affordances:** Match — Wizard leading (Close/Back), primary CTA, secondary "Manage notifications", handle field, username-ack checkbox, tier radios, retry, opens-checkout→browser. `POST /api/personas/:id/follow` both.
- **Field set:** Match — fan-handle field + username-ack checkbox.
- **Validation rules:** Match — handle 3–40, regex `^[A-Za-z0-9_.\-]+$`; CTA also requires username-ack when handle == username; submit error "Handle must be 3–40 letters, numbers, dots, dashes, or underscores." identical.
- **Empty-state copy:** N/A (wizard)
- **Error-state copy:** Match on shared strings — headline "Couldn't open the handshake"; "Public Profile not found." + per-field errors match. **Minor DELTA:** iOS load fallback `errorDescription ?? "Couldn't open Privacy Handshake."` vs Android hardcoded literal; Android adds a blank-handle guard "Missing persona handle." iOS lacks.
- **Animation / transition:** Match — shared WizardShell; opens-checkout → system browser both.

<!-- cluster:tier-support-settings -->

## Support trains list
- **iOS:** `SupportTrains/SupportTrainsView.swift` (+ VM) · **Android:** `support_trains/SupportTrainsScreen.kt` (+ VM)
- **State coverage:** Match — loading/empty-per-tab/loaded/error.
- **Action affordances:** Match — search top-bar action, "Start a train" FAB, 3 tabs (My trains/Nearby/Invitations), row tap, per-tab empty CTA.
- **Field set:** N/A
- **Validation rules:** N/A
- **Empty-state copy:** Match — all three tabs verbatim ("No support trains yet" / "A support train is a calendar of neighbors taking turns helping someone through a life event. Start one for someone, or join one nearby."; Nearby + Invitations match).
- **Error-state copy:** Match — "Couldn't load support trains. Try again."
- **Animation / transition:** Match — pushed.

## Support trains search
- **iOS:** `SupportTrains/Search/SupportTrainsSearchView.swift` (+ VM) · **Android:** `support_trains/search/SupportTrainsSearchScreen.kt` (+ VM)
- **State coverage:** Match — shared SearchListShell (recent/typing/results/empty); corpus-load failure degrades to "no matches" both.
- **Action affordances:** Match — search field, cancel, result-row tap.
- **Field set:** Match — single query field, placeholder "Search support trains".
- **Validation rules:** N/A
- **Empty-state copy:** Match — "No matching trains" / "Try a different name or train type, or check the spelling."
- **Error-state copy:** N/A (degrades to empty by design)
- **Animation / transition:** Match — pushed; shell header.

## Start a train
- **iOS:** `SupportTrains/StartTrain/StartSupportTrainWizardView.swift` (+ VM, Content) · **Android:** `support_trains/start_train/StartSupportTrainWizardScreen.kt` (+ VM, Content)
- **State coverage:** Match — 3-step + Success; launch-error banner; submitting flag.
- **Action affordances:** Match — beneficiary search + results + clear, reason field, 6 kind cells, 2 date pickers, 4 slot-duration chips, allow-comments toggle, 3 visibility radios, CTAs, success "Back to trains".
- **Field set:** Match — beneficiary query, reason, kind, start/end date, slot duration, allow-comments, visibility.
- **Validation rules:** Match — beneficiary + non-empty reason; endDate ≥ startDate && slots non-empty; reason ≤500; 90-slot cap; end clamped to start.
- **Empty-state copy:** Match — slot grid empty "Pick a date range to generate slots."
- **Error-state copy:** **DELTA** — iOS uses one generic "Couldn't launch the train. Try again." for the whole create→addSlot→publish chain (`StartSupportTrainWizardViewModel.swift:336`); Android emits phase-specific strings "Couldn't launch the train. Try again." / "Couldn't add a slot. Try again." / "Couldn't publish the train. Try again." (`StartSupportTrainViewModel.kt:328,345,355`) — Android's slot/publish strings have no iOS counterpart. Also iOS surfaces server `APIError` text when present.
- **Animation / transition:** Match — pushed; shared WizardShell.

## Edit signup
- **iOS:** `SupportTrains/EditSignupFormView.swift` (+ VM) · **Android:** `support_trains/edit_signup/EditSignupFormScreen.kt` (+ VM)
- (iOS counterpart EXISTS — lives directly under `Features/SupportTrains/`, not a subfolder.)
- **State coverage:** **DELTA** — Android adds a "missing seed" empty/error state (`isMissingSeed`→`MissingSeedBody`, `EditSignupFormScreen.kt:93-95,132-141`) for when the staged reservation can't be found (deep link / process death), because Android passes only a reservation id via SavedStateHandle. iOS receives the full `SupportTrainReservationDTO` by value, so it has no missing-seed path — Android-only state.
- **Action affordances:** Match for the form (Save, close, contribution field, drop-off time picker, dietary notes, toast). Android MissingSeedBody adds a "Close" CTA.
- **Field set:** Match — contribution, drop-off time, dietary notes. **DELTA:** Android sets a dietary-notes placeholder "Allergies, access needs, anything the helper should know." (`EditSignupFormScreen.kt:292`); iOS uses that string only as helper text, not a placeholder.
- **Validation rules:** Match — contribution ≤200, dropoff timeHHmm, dietary notes ≤1000.
- **Empty-state copy:** **DELTA (Android-only state)** — Android MissingSeedBody "Reservation unavailable" / "Open the helper's row from the Review signups list to edit their signup." — no iOS counterpart.
- **Error-state copy:** Match — validation toast "Fix the highlighted field."; success "Signup updated." both.
- **Animation / transition:** Match — pushed (not a sheet) both.

## Review signups
- **iOS:** `ReviewSignups/ReviewSignupsView.swift` (+ VM) · **Android:** `review_signups/ReviewSignupsScreen.kt` (+ VM)
- **State coverage:** Match — loading/empty-per-filter/loaded/error; both guard empty supportTrainId → "Missing support train id." error.
- **Action affordances:** Match — share top-bar action, 5 filter chips (All/Pending/Confirmed/Edited/Canceled), row tap→edit, Confirm/Edit footer (pending), Message footer (confirmed), optimistic confirm + pending-edit replay.
- **Field set:** N/A
- **Validation rules:** N/A
- **Empty-state copy:** Match — all five filters verbatim ("No signups yet" / "Share the train so neighbors can grab a slot. …", Pending/Confirmed/Edited/Canceled match).
- **Error-state copy:** Match — "Couldn't load signups. Try again." + "Missing support train id."
- **Animation / transition:** Match — pushed.

## Review claims
- **iOS:** `ReviewClaims/ReviewClaimsView.swift` (+ VM) · **Android:** `review_claims/ReviewClaimsScreen.kt` (+ VM)
- (Both platforms have a REAL `ListOfRows`-backed screen — NOT a placeholder/NotYetAvailableView. The "web-only" note is resolved on both.)
- **State coverage:** Match — loading/empty-per-bucket/loaded/error + per-bucket row cache + pending banner.
- **Action affordances:** Match — 3 tabs (Pending/Approved/Rejected), pending triage banner, row tap→open claim, "Review claim" footer, evidence/status chips, pending-empty "View approved" CTA.
- **Field set:** N/A
- **Validation rules:** N/A
- **Empty-state copy:** Match — Pending "No claims to review" / "You're all caught up. New ownership claims will appear here when neighbors submit address verification."; Approved + Rejected match.
- **Error-state copy:** Match — "Couldn't load claims. Try again."; banner "N claim(s) awaiting review" + "Oldest in queue: …" match.
- **Animation / transition:** Match — pushed.

## Settings index
- **iOS:** `Settings/SettingsView.swift` (+ `SettingsViewModels.swift`) · **Android:** `settings/SettingsScreens.kt` (+ `SettingsViewModels.kt`)
- **State coverage:** Match — loading→loaded; identical group set (Account/Privacy/Notifications/Payments/Support/[Admin]/Session); no error state (read-only index).
- **Action affordances:** Match — all rows present (Edit profile, Password, Verification +Verified chip, Blocked users +count, Profiles & Privacy, Data export, Notification preferences, Payments & payouts +Stripe chip, Help, Legal, About +version, admin-only Review claims, Log out). Routing identical. **Minor (not a transition delta):** iOS `verified` derived from `user.email.contains("@")` (`SettingsViewModels.swift:61`) vs Android hardcodes `verified = true` (`SettingsViewModels.kt:69`) — affects whether the Verified chip shows.
- **Field set:** N/A
- **Validation rules:** N/A
- **Empty-state copy:** N/A
- **Error-state copy:** N/A
- **Animation / transition:** Match — both push (iOS inner `NavigationStack(path:)`, Android `composable`/navController).

## Settings — About
- **iOS:** `Settings/About/AboutView.swift` · **Android:** `settings/about/AboutScreen.kt`
- **State coverage:** Match — static, no fetch states.
- **Action affordances:** Match — back only; no interactive elements; neither links out.
- **Field set:** N/A
- **Validation rules:** N/A
- **Empty-state copy:** N/A
- **Error-state copy:** N/A
- **Animation / transition:** Match — ContentDetailShell, pushed. (Body copy — Mission, Built by, Attributions, copyright, "Version X (Y)" — verbatim equal.)

## Settings — Blocked users
- **iOS:** `Settings/Blocks/BlockedUsersView.swift` (+ VM) · **Android:** `settings/blocks/BlockedUsersScreen.kt` (+ VM)
- **State coverage:** Match — loading/empty/loaded/error.
- **Action affordances:** Match — row kebab → optimistic unblock + rollback, pull-to-refresh. (iOS adds its own `SettingsTopBar` because the Settings stack hides the system nav bar; cosmetic chrome.)
- **Field set:** N/A
- **Validation rules:** N/A
- **Empty-state copy:** Match — "No one blocked" / "When you block someone, they'll appear here. Unblock from this list anytime."
- **Error-state copy:** Match — "Couldn't load your blocked list."
- **Animation / transition:** Match — pushed in settings stack.

## Settings — Help center
- **iOS:** `Settings/Help/HelpCenterView.swift` · **Android:** `settings/help/HelpCenterScreen.kt`
- **State coverage:** Match — static FAQ, no fetch states.
- **Action affordances:** **Match (P6.7 false positive corrected)** — both render an "Email support" CTA (`helpCenterContactCTA`) wired to a `mailto:support@pantopus.app?subject=Help` intent: iOS in-view (`HelpCenterView.swift:82-87`), Android at the call site (`RootTabScreen.kt:2470-2480`). P6.7 flagged Android as a no-op — that was wrong (the call site was missed).
- **Field set:** N/A
- **Validation rules:** N/A
- **Empty-state copy:** N/A
- **Error-state copy:** N/A
- **Animation / transition:** Match — ContentDetailShell, pushed. (FAQ/body copy — header "How can we help?", 3 sections, all Q&A, "Still stuck?" + "Email support" — verbatim equal.)

## Settings — Legal (index + content)
- **iOS:** `Settings/Legal/LegalIndexView.swift` + `LegalContentView.swift` · **Android:** `settings/legal/LegalScreens.kt`
- **State coverage:** Match — static index + static content.
- **Action affordances:** Match — index 5 rows (Terms/Privacy/Acceptable use/Cookies/Open-source licenses) in Policies + Credits groups → content viewer; content back only.
- **Field set:** N/A
- **Validation rules:** N/A
- **Empty-state copy:** N/A
- **Error-state copy:** N/A
- **Animation / transition:** Match — index GroupedList, content ContentDetailShell, both pushed. (All doc titles/subtitles, footer "All documents are kept in plain language. Reach out via Help if anything's unclear.", "Last updated: 2026-05-01", and all 5 docs' full content — verbatim equal.)

## Settings — Password change
- **iOS:** `Settings/Password/PasswordChangeView.swift` (+ VM) · **Android:** `settings/password/PasswordChangeScreen.kt` (+ VM)
- **State coverage:** Match — loading→ready via auth-methods discovery; both default `hasPassword=true` on failure; errors surface inline.
- **Action affordances:** Match — Save, close, current (conditional on hasPassword), new, confirm secure fields; group title swaps "Update password"/"Set a password".
- **Field set:** Match — current/new/confirm; testTags `field_current/new/confirm`.
- **Validation rules:** Match — min length 8, confirm == new, current required when hasPassword, new ≠ current. Inline messages verbatim ("Required", "At least 8 characters", "Choose something different from your current password", "Doesn't match").
- **Empty-state copy:** N/A
- **Error-state copy:** **DELTA** — iOS special-cases HTTP 429 with toast "Too many attempts. Wait a minute and try again." (`PasswordChangeViewModel.swift:167-168`); Android `mapServerError` has no 429 branch (lands in `ClientError` → `error.body ?: "Couldn't update your password"`). Other strings match ("Current password is incorrect", "We couldn't find your account. Try signing back in.", "Couldn't update your password. Try again.", success "Password updated").
- **Animation / transition:** Match — FormShell, pushed; both auto-dismiss 700ms after success.

## Settings — Verification center
- **iOS:** `Settings/Verification/VerificationCenterView.swift` (+ VM) · **Android:** `settings/verification/VerificationCenterScreen.kt` (+ VM)
- **State coverage:** Match — loading→loaded via identity-center overview; both fall back to `emailVerified=false` on failure; no first-class error state (read-only grid).
- **Action affordances:** Match — Email status row + conditional Resend (only when unverified) with Idle/Sending/Sent/Failed label cycling; Phone/Home/Photo ID display-only rows; retry wired.
- **Field set:** N/A
- **Validation rules:** N/A
- **Empty-state copy:** N/A
- **Error-state copy:** Match — resend failure subtext "Couldn't send the verification email."
- **Animation / transition:** Match — GroupedList, pushed. (Footer "Verified neighbors can find you in search and reach you with confidence.", resend labels, group helpers, Phone/Home "Coming soon"+"Not started", Photo ID "Used by business listings only"+"Optional" — verbatim equal.)