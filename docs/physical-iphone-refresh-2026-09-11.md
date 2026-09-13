# Physical iPhone app refresh — September 11, 2026

The owner requested the latest app build on the already configured iPhone.
Pantopus **1.0.0 (2)** is now installed in place on the connected iPhone 16 Pro,
iOS 26.5.2, from committed iOS source at `139868c1d` on
`codex/home-permission-boundaries`. There were no uncommitted iOS changes.
The Android creation work in progress is not part of this iPhone product.

The Staging device build succeeds with the existing development signing team
and device provisioning. Deep strict signature verification passes. The new
app retains the preserved prior device product's API/socket origin, public
integration settings, Keychain groups, app groups and development APNs identity.
The profile includes the existing device and is unexpired. Device inventory
after successful installation independently reports bundle `app.pantopus.ios`
at build `2`.

Installation used the ordinary in-place update. No uninstall, data clear,
account action, app launch, notification test, hosted deployment, migration or
paid-service activation was performed. This is build/install evidence, not new
physical-device feature acceptance. The new backend-dependent Home workflows
still require their reviewed staging rollout. Completed physical Beacon
acceptance remains closed.

Private evidence and the signed product are retained under
`/private/tmp/pantopus-iphone-refresh-139868c1d/`: `manifest.json`, `build-r1.log`,
`verification.json`, signature entitlement comparisons, `install.json` and
`installed-app.json`. The verification records the source and binary digest.
The private build overlay and raw device/operator output remain outside Git.
The previously accepted physical app in
`/private/tmp/pantopus-native-staging-build/DerivedData/` and all accepted
simulator/native milestone products remain preserved.

Continue Android retained creation and unit identity, browser creation,
existing-Home join, private first use/invitations, native residency and the
ordered backlog. Android's current production sources compile, its Debug APK
and instrumented test sources build, and 29 focused recovery/wizard checks pass.
Installed acceptance is in progress on the owned recurrence emulator; its
creation fixture on 18084 requires exact cleanup after the journey.
