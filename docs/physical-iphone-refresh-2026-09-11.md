# Physical iPhone app refresh

## September 15, 2026 — latest committed client

The owner requested all current work committed/pushed and the newest repository
app installed over the existing iPhone version. Code head `c9cb69825871b089db172f1c2c214953074b605e`
is pushed to both `codex/paid-gig-integration` and PR34's `codex/staging-paid-gig`.
The integration tree was clean before building. Unrelated owner changes are preserved.

Pantopus **1.0.0 (3)** is installed in place on the connected iPhone 16 Pro,
replacing **1.0.0 (2)**. The Staging device build succeeds from that exact source.
The main app and widget pass deep strict signature checks; both profiles include
the device and remain unexpired. Their app/Keychain/app-group/APNs identities match
the preserved September11 product. Existing API/socket and integration settings
are retained, using HTTPS staging rather than a loopback fixture. The current iOS
source is identical to c7d45dd09, whose CI34993419890 passed all15 applicable jobs.
Combined c9cb69825 CI34998717315 was still running at installation; this is not a
claim that the new combined CI or all app workflows are accepted.

The installer returned success and a separate device inventory reports bundle
`app.pantopus.ios`, version1.0.0, build3. No uninstall, data clear, app launch,
account action, notification test, backend deployment, migration or provider
activation was performed. Features needing pending server/schema changes still
require their coordinated release. Installation does not establish their runtime
acceptance or close an inventory row.

Private build/install evidence and signed product are preserved in
`/private/tmp/pantopus-iphone-refresh-c9cb69825/` and mirrored under the owner's
ignored `.pantopus-recovery/audits/20260915-iphone-refresh-c9cb69825/` directory.
All292 mirrored app files match their recorded hashes and the mirrored signature
verifies. Source bindings, old/new entitlements, provisioning checks, build log,
installation result and independent device inventory remain private. The first
verification script expected `-D STAGING` instead of the compiler's `-DSTAGING`;
the corrected checker passes on the unchanged successful product. Earlier signed
products and all other devices/worktrees remain preserved.

Next resume existing Start Work backend/native recovery verification and the
ordered backlog. PR34 remains draft. This documentation follow-up is pushed on
the integration branch while the existing canonical source CI finishes.

## September 11, 2026 — preceding device update

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
