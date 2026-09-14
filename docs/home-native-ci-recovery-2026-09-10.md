# Home native verification recovery — September 10, 2026

## Refreshed source state

Origin was fetched before resuming. Home was clean at `5441da1b8`, draft
[PR #32](https://github.com/WangPantopus/skinny-pantopus/pull/32); paid gigs were
clean at `e9ef2decb`, draft [PR #34](https://github.com/WangPantopus/skinny-pantopus/pull/34).
The owner checkout remains at `939878b4f` with its unrelated modified handoff
and two untracked design files preserved. No branch was merged.

The Home checkpoint's [CI run](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34526095061)
passes backend, privacy, database replay and browser checks. Android quality
stops at formatting in `HomeTaskMediaControlsTest`; its instrumentation job also
fails and requires diagnosis. iOS is still running at this observation. The
payment checkpoint's [CI run](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34526168928)
passes backend, database and browser checks, with native jobs still running.
These observations do not replace final-head verification.

## iOS simulator host repair

The shared CI build now uses ad-hoc simulator signing and retains the project's
entitlements. The prior command disabled signing and explicitly erased the
entitlement input. A build gate checks the signed simulator product and its
exact embedded application identifier before packaging the test bundles.
Xcode stores simulated entitlements in the Mach-O `__TEXT,__entitlements`
section; the macOS signature's entitlement dictionary can correctly be empty.
No developer certificate or provisioning profile is installed by this change.
Device and release signing are unchanged.

The claim footer assertion now matches the reviewed current product copy:
private documents are visible to their owner and currently authorized claim
reviewers. It no longer asserts an assigned-reviewer-only policy.

The actual app and both test bundles built successfully for the dedicated
Home task simulator. The binary entitlement gate passes. All 13 selected
`HomeTaskSavedRequestTests` and `ClaimUploadStepSnapshotTests` pass, including
the actual protected-store round trip, exact account/Home isolation and
matching-only Keychain removal. The changed Swift file passes format and strict
lint. Local runtime is iOS 26.5; the required iOS 18.5 CI matrix remains a
separate gate. Installed login/picker/upload acceptance has not yet been rerun.

Private evidence: `/private/tmp/pantopus-home-native-ci-ios-build-r1.log`,
`/private/tmp/pantopus-home-native-ci-ios-tests-r1.log` and its adjacent result
bundle. These are operator artifacts, not Git attachments.

## Next

Finish Android attachment cancellation cleanup, formatting/compiler findings,
reviewed task-form snapshots and installed workflows. Resolve all four browser
form findings from the session checkpoint and exercise actual protected browser
storage. Retry the isolated installed iOS journey with explicit failure exits.
PRs #32/#34 remain unfinished drafts; migration reconciliation, payments and
the remaining Home/release scope are still open. Paid dependencies remain one
final launch-preparation bundle. No hosted data, paid service or owner phone
was changed, and completed physical Beacon/saved-card checks were not repeated.
