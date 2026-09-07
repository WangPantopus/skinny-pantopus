# Native Home, Pulse, and Beacon entry continuity

Implemented September 6, 2026. Follow-up to the [web/backend entry package](entry-continuity-implementation-2026-09-06.md).

## Behavior

Both native clients now offer an explicit **Save privately** confirmation after sign-in. Neither client calls the Home-creation endpoint automatically. Saving creates an account-scoped SavedPlace bookmark; setting up and verifying a household remains a separate action through the existing wizard.

The launch flow keeps a draft only when the visitor continues from a selected address preview. It retains the complete suggestion label and coordinates instead of splitting display text into guessed city/state/ZIP fields. A generic sign-in can resume an unfinished draft on the same device. Browsing Beacon clears the address intent and uses the existing protected-link replay to open Beacon without requiring an address.

Drafts have a random identifier and a fixed 24-hour expiry. They are bound to the user returned by registration or authentication, including registration before email verification. Reading a draft does not consume it. An expired, malformed, legacy, or differently owned draft is cleared. Session endings, including explicit signout, and cancellation clear drafts; a draft cleared by session termination requires a new lookup. Retrying a save neither extends the expiry nor creates duplicate saved places. A late response cannot clear a replacement draft.

The confirmation screen displays the address, privacy explanation, save/retry action, and an independently loaded public preview. Failed or unconfirmed saves keep the draft. Save requests include `expectedUserId`, and clients check the response's `user_id` and the current session before acknowledging success. Duplicate taps are coalesced. A confirmed save exposes Saved places and the existing Home setup flow. Native setup still asks the user to select and validate the address; this increment does not add web's saved-address input prefill to the native wizard.

The draft store lives in each client's core routing layer so authentication and the launch/review UI share one lifecycle contract. No exact address is added to auth URLs by this native flow. This is device-local draft recovery, not cross-device synchronization of unfinished previews.

## Social continuity

Native routers now accept the web `/app` route prefix, preserve `feed?surface=personas` as Beacon, and preserve `feed?post=…` as the specific Pulse post. Public `/persona/:handle` destinations remain Beacon profiles. All three are tested through signed-out deferral and signed-in replay. Existing Home links retain their routing.

The simulator follow-up found that Place could consume a Pulse link before root navigation selected Nearby, leaving the user at the feed instead of the post. Stack consumers now enforce destination ownership: Nearby receives Pulse/task/listing links; Place and Mail cannot consume each other's links. Initial navigation waits for stack mounting before pushing a destination. A mount task and an already-queued observation callback could also push the same Beacon twice in one frame; callbacks now check the router's current pending value before acting, preventing duplicate navigation.

Home auto-navigation checks the active tab, stack, and pending content destination after the asynchronous home lookup. It cannot push a Home over an incoming social destination. On iOS, Home arrival is reconsidered when the user later selects that tab. A bookmark never follows a Beacon or submits a post.

## Existing intelligence

The verified-Home dashboard, permissions, property/ATTOM information, weather, air quality, sunlight visualization, and civic/election sections were not changed. The new arrival screen reads public preview data and creates no new entitlement to a household's private information.

## Validation

- Android: **95 focused tests passed** (9 draft/save/API-contract tests and 86 routing tests), plus **2 UI snapshots verified** for retry and success states. Both layouts were visually inspected. API calls are mocked.
- iOS: **77 focused tests passed** (9 arrival, 54 general routing, 9 Place routing, and 5 Hub-route tests) on an iPhone 17 simulator in the original workspace. Tests use separate UserDefaults suites and mocked saves. The Hub-route tests cover exclusive ownership of social and mailbox links during tab changes.
- iOS: **3 app UI journeys passed** using an isolated, stateful API fixture on the iPhone 17 simulator: address selection → registration → verification callback after termination → sign-in → failed private save → termination/session restore → retry → Saved places; Pulse post link → sign-in → the exact post; Beacon profile link → sign-in → explicit free follow → termination/session restore → Following state. Passing screenshots were visually inspected.
- New Swift files pass SwiftLint; the new/changed entry-flow Kotlin files pass targeted ktlint. `git diff --check` passes.

The follow-up fixes the normal workspace iOS build: `MyPackagesView.swift` now uses the existing `Theme.Color.personal` token. The iOS ignore file also explicitly includes `Pantopus/Features/Scheduling/Business/Packages/`, whose ten existing source files had been hidden by the generic `Packages/` rule. The simulator build and focused tests now pass in the original workspace, without a scratch-copy substitution.

Android's instrumentation build also passes (`:app:assembleDebugAndroidTest`). Four old navigation/accessibility test harnesses referenced the removed five-tab route enum; they now use the current Place, Today, Nearby, and Mail routes. These bottom-bar tests use stub destinations and do not claim full-screen journey coverage. No Android device or usable emulator image is installed locally, so instrumentation execution remains outstanding.

Reproducible test targets:

```sh
# frontend/apps/android
./gradlew --offline :app:testDebugUnitTest \
  --tests 'app.pantopus.android.ui.screens.place.PlaceArrivalTest' \
  --tests 'app.pantopus.android.core.routing.DeepLinkRouterTest'
./gradlew --offline :app:verifyPaparazziDebug \
  --tests 'app.pantopus.android.ui.screens.place.PlaceArrivalSnapshotTest'

# frontend/apps/ios
xcodegen generate
xcodebuild -project Pantopus.xcodeproj -scheme Pantopus \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  -only-testing:PantopusTests/PlaceArrivalTests \
  -only-testing:PantopusTests/DeepLinkRouterTests \
  -only-testing:PantopusTests/DeepLinkRouterPlaceTests \
  -only-testing:PantopusTests/HubRouteTests test
```

## Simulator UI journeys

`PantopusUITests/EntryContinuityUITests.swift` uses production screens and AuthManager with a DEBUG-only fixture enabled by both `UI_TESTS_ENTRY=1` and `UI_TESTS_STUB_API=1`. Fake credentials and API state use a dedicated UserDefaults suite, separate from real Keychain credentials. The test resets that suite between scenarios and preserves it for app-termination checks. Failures include screenshots and accessibility hierarchies; successful journeys retain screenshots in the Xcode result bundle. These tests assert failures rather than skipping missing screens.

```sh
# frontend/apps/ios
xcodebuild -project Pantopus.xcodeproj -scheme Pantopus \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  -only-testing:PantopusUITests/EntryContinuityUITests test
```

The callback and content-link fixtures enter the real in-app router through a launch environment value. This verifies app routing and restoration, not OS universal-link association or delivery from an email provider. API persistence in this suite is simulated locally; backend persistence and authorization require the backend tests and staging checks. The existing verified-Home intelligence and access rules remain unchanged.

The visual pass also removed duplicate native back bars from signup and Beacon, which already provide their own navigation controls.

## Before release

Ship the additive backend expected-account check before these native clients. No database migration was introduced. Complete actual iOS/Android device journeys for email verification, OAuth, app termination, expired sessions, inbound Home/Pulse/Beacon links, and authorized household access. Local tests do not verify provider callbacks, deployed configuration, or real notification delivery.

No deployment, production account, email, public follow/post, or household creation was performed for this work. Calendar correctness/delivery and the remaining [release journey audit](v1-journey-audit-2026-09-06.md) remain separate release work.
