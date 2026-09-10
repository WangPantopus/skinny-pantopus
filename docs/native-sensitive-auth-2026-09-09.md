# Native sensitive-screen authentication — September 9, 2026

## Result

Both native clients keep payment and wallet screens protected when the operating
system cannot establish authentication capability. A prompt started for one
account cannot unlock another account, change its saved App Lock preference or
grant it a sensitive-action grace period after logout or account switching.

Previously, any capability other than `available` let the screen guard proceed.
Android also proceeded without an activity hosting the prompt, including the
one-shot withdrawal guard. Transient capability failures could silently disable
a saved App Lock preference. Delayed prompt completion could mutate the next
account's state, including an iOS error callback that removed its lock.

## Changes

- Centralize sensitive-screen verification in each App Lock manager. A confirmed
  missing device passcode retains the existing no-credential policy; unknown,
  unsupported, unavailable and invalid-context results fail closed.
- On Android, distinguish missing biometrics from missing device credentials
  using Keyguard's `isDeviceSecure`. Use the supported biometric/credential mask
  for the OS version; leave the separate cryptographic prompt's strength intact.
- Require a hosting activity for Android screen and one-shot verification.
- Preserve saved App Lock and the locked cover on transient capability failure.
- Fence prompts, error callbacks and post-await preference writes by an identity
  generation that changes on account configuration and logout. Clear account-local
  grace when identity changes, and avoid old callbacks owning a new prompt's state.
- Add controlled authentication seams for tests without product flags or any
  provider bypass. Production continues to use the platform authentication APIs.

Platform references: [Android biometric authentication](https://developer.android.com/identity/sign-in/biometric-auth)
documents credential detection and authenticator compatibility; Apple's
[device-owner authentication policy](https://developer.apple.com/documentation/localauthentication/lapolicy/deviceownerauthentication)
provides the passcode-capable policy used by iOS.

## Verification

- iOS: 19 tests pass (14 sensitive authentication cases and 5 existing App Lock
  preference cases) on iPhone 17 / iOS 26.5 simulator. The final run includes
  delayed success and error completion across account changes, logout, failed
  capability, credential removal and grace behavior. SwiftLint and SwiftFormat pass.
- Android: all 12 focused authentication tests pass; Detekt and debug APK assembly
  pass. Tests cover missing activity, unknown capability, credential detection,
  saved-lock preservation, success/failure grace and four delayed entry points.
- Independent review findings about late account mutation and the Android
  withdrawal helper were reproduced and repaired before these final checks.

These are platform build and controlled failure-path tests, not a new physical
device acceptance claim. Completed saved-card and Beacon device journeys remain
recorded in their own reports and were not repeated. No backend, database,
provider, hosted runtime or production settings changed for this milestone.

## Integration and next action

Based on master `d7be416b872a31ceb53094d7d19c3f114185831f`, after PR #31's
complete final-head CI and merge. Finish independent review and current-head CI
before merging this repair. Continue paid-gig checkout recovery and Home
admission/resource boundaries from the project handoff.
