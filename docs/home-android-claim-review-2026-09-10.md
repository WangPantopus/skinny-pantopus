# Android claim review and withdrawal — September 10, 2026

Ordinary Home and platform review now bind a decision to the displayed claim,
claimant, Home and evidence token. A successful receipt must confirm the same
action and resulting state; approval also confirms the exact occupancy. An
uncertain response retains the original action, note and token for retry.
A stale-snapshot response requires a fresh review and cannot automatically
approve newly changed evidence. Concurrent confirmation sends one write.

Screens capture the opening account/session/API immediately. Before and after
each claim read or write, they compare that opening identity with a coherent
current credential snapshot read from TokenStorage. A same-account replacement
session is rejected even before its token-flow collector runs. Missing opening
identity cannot bind to a later sign-in. Flow invalidation separately removes
old screen content. The TokenStorage addition only reads one stored snapshot;
it changes no login, refresh or credential persistence behavior.

Withdrawal accepts only an exact `withdraw`/`revoked` receipt with
`withdrawn: true` and `deleted: false`. Missing, mismatched or ambiguous results
keep the screen open for retry. The confirmation explains that verification and
audit history remain. Approved, revoked and unknown claim statuses are not
offered for ordinary withdrawal.

Platform review displays actual identity status, evidence metadata and review
notes. Fabricated ownership shares, claimant statements, synthetic document
previews, co-owner counts and timing promises were removed. Successful review
does not imply owner promotion or confirmed notification delivery. Dedicated
disputed claims cannot use the ordinary decision controls.

## Verification

The final candidate passes 47 focused checks: 18 decision/snapshot tests,
seven withdrawal tests, 12 existing Home review view-model tests and ten
TokenStorage tests. Collector-lag regressions exercise same-actor replacement
sessions before a write and before accepting a delayed response. Other cases
cover exact request/receipt identities, unknown-result retry, stale snapshots,
concurrent taps, missing opening identity, destructive withdrawal receipts and
terminal claim statuses.

Final formatting, Detekt, Android lint and debug assembly pass. Android lint
reports zero errors. The initial actual failures caught an HTTP error
handling defect: `NetworkError` derives directly from `Throwable`, so an
`Exception` catch did not handle it. Explicit `NetworkError` handling now retains
retry state and invalidates stale decisions correctly. Test assertions were not
relaxed. Parent independently reviewed the live session and response boundaries.
Credential-storage I/O failure additionally denies the retained action and
offers reopening/retry. Unexpected fatal errors are not swallowed. Final run
evidence is in `/private/tmp/pantopus-home-native-claim-android-root-r5.log`;
Detekt passed separately before that final pipeline. The final pipeline
completed formatting checks, all 47 tests, Android lint and debug assembly.

## Remaining work

These unit/API-fixture checks do not replace complete household acceptance.
Trusted private evidence upload/read/verification/retirement is the next backend
and web checkpoint, with native evidence controls following it. Existing
relationship/residency helpers still need their own exact receipt/workflow
acceptance. Dedicated ownership challenge, transfer, lease and final Home release
acceptance remain separate. No role defaults, hosted policies or subscriptions
changed in this checkpoint. Final-head CI remains required before merge.
