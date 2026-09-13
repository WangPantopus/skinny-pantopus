# iOS claim review and withdrawal — September 10, 2026

The ordinary Home and platform claim screens now submit the exact review token
from the displayed evidence snapshot. Approval confirms the returned claim,
claimant, Home, action, resulting state and occupancy before reporting success.
An uncertain response retains the same decision and token for a safe retry;
changing the decision requires a fresh review. Concurrent taps issue one write.

Each screen stays bound to its opening account, session and API. Missing opening
identity, changed accounts and late responses cannot submit or show success in a
replacement session. Disputed claims stay outside this ordinary review flow.
Actionable server evidence errors remain visible instead of becoming a generic
stale-snapshot message.

The platform screen displays actual evidence eligibility, identity status and
review notes. Fabricated ownership percentages, identity checks, claimant
statements, co-owner counts and review timing promises were removed. Successful
ordinary review does not imply that the claimant became an owner or that a
notification was delivered.

Withdrawal requires an exact non-destructive receipt: withdrawn/revoked, the
expected Home and claim, and `deleted: false`. Missing, mismatched or ambiguous
results keep the screen open with a retry. The confirmation explains that
verification and audit history are retained. Approved or revoked claims are not
offered for ordinary withdrawal.

## Verification

- Full app compilation and 47 focused simulator tests pass in the final run:
  17 decision/snapshot tests, seven withdrawal tests, 13 existing Home review
  view-model tests and ten platform queue tests.
- Tests cover exact request/receipt identity, evidence counts, missing tokens,
  stale snapshots, disputed claims, retrying an uncertain decision, concurrent
  writes, missing opening identity and account changes before/during reads and
  mutations. Withdrawal regressions include destructive/malformed receipts and
  terminal statuses.
- SwiftFormat and strict SwiftLint pass for all 16 owned Swift files. Final app
  compilation has no new claim warnings. Root independently reviewed the
  ordinary review and withdrawal paths.
- Private evidence: `/private/tmp/pantopus-home-native-claim-ios-root-r1.log`
  contains the initial 37 passing tests; the final run in
  `/private/tmp/pantopus-home-native-claim-ios-root-r2.log` passes all 47. These are local simulator/API-fixture checks, not device push
  delivery or a complete household acceptance run.

## Remaining work

Android parity is being completed independently. Trusted private evidence
upload/read/retirement remains the next backend checkpoint; quarantined legacy
references are not treated as verified evidence. Dedicated ownership challenge,
transfer and lease flows remain separate. Existing relationship/residency
helpers still require their own exact receipt and workflow acceptance checks.
This checkpoint does not complete Home release acceptance, change role defaults,
apply hosted migrations or replace final-head remote CI.
