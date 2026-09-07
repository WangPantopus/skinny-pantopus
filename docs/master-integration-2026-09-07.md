# Integration with master — September 7, 2026

PR #4's `codex/entry-continuity-and-calendar` branch was reconciled with `origin/master` at `d0a5129eb` using a merge, preserving the feature branch's published history.

Eight files required conflict resolution:

- Calendar tests retain the instrumented atomic-swap mock required by the new failure/retry assertions.
- Four Android navigation/accessibility test files use master's Hilt-free four-tab fixtures and selected-tab assertions.
- iOS Neighborhood retains the distinction between immediately available Pulse/Beacons and density-gated local Marketplace/Tasks.
- iOS Home Today retains the explicit garbage/recycling schedule controls and copy.
- iOS Place launch retains address-error recovery and the address-free Beacon entry, with master's formatting cleanup.

The merge also incorporates master's CI workflows, tracked Scheduling Packages files, API exports, Place development-fixture fixes, and removal of the obsolete Pages-router document. The six previously reported web type signatures are resolved. Local Next.js types were regenerated because the existing generated compatibility declarations still referred to the removed Pages directory; the resulting type-check gate has zero errors against master's empty baseline.

Additional integration fixes are limited to the existing Beacon media test's missing Next router mock, the privacy scanner's pre-existing compatibility exemption moving from line 305 to 306 after the auth import (same mapping; no new exemption), and Swift formatting/closure conventions required by the newly strict CI gates. Android validation conditions were split into named checks, coordinate/schedule limits were named, and the unused feed follow-count argument was removed. The Nearby composable keeps explicit navigation callbacks with a function-scoped parameter-count annotation, consistent with the app’s callback-based screen API. Duplicate ignore entries from both branches were consolidated.

The merged iOS build passes 104 selected unit tests and all six isolated app journeys. Android’s debug build, ktlint, Detekt, Android Lint, and Paparazzi verification pass: 4,141 unit/snapshot tests pass with 80 existing skips. All 10 selected emulator navigation/accessibility checks pass on API 34, including the four conflicted test files and the Nearby/Following actions. Web production build and type check pass; all 812 web tests pass after the router-mock repair. Backend full-suite testing plus the two repaired gate suites yields 4,230 passing tests and 16 existing skips. Privacy gates, migration-history check, SwiftLint strict, SwiftFormat lint, and the iOS icon guard pass. Web lint has no errors and retains existing warnings.

No deployment, live notification, database migration execution, or merge of PR #4 into master is part of this integration. A pre-existing untracked local runbook draft is preserved separately while the merge is committed, then restored as local work; it is excluded from the merge commit.

GitHub subsequently completed the full [CI run for integration commit `4172e37fc`](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34142598999) successfully, including all three iOS simulator test jobs, the Android quality and emulator jobs, and the aggregate `CI OK` check. Staging delivery readiness is recorded separately in [beacon-staging-verification-2026-09-07.md](beacon-staging-verification-2026-09-07.md).
