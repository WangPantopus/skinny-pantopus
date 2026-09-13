# Pantopus verified-boundary handoff — September 13, 2026

**Current continuation:** native history now passes both installed readers, both fresh native cycles and exact fixture cleanup. Both devices are stopped with data retained. See [the current project handoff](PROJECT_HANDOFF.md) and [native evidence/CI limits](home-native-history-wip-2026-09-13.md). The frozen source/next-step details below are historical; native integration awaits its exact-head CI. Current-claims alias correction passes SQL CI, while its consumers and populated acceptance remain unfinished.

This is the current session boundary. Read PROJECT_HANDOFF.md, SESSION_RESUME_2026-09-10.md and REMAINING_WORK_2026-09-11.md; historical “next” instructions are superseded. The owner requested a smooth handoff with all source committed/pushed. No new feature scope should be inferred from this checkpoint.

## Source and verification

Primary: `/private/tmp/pantopus-home-permission-boundaries`, `codex/home-permission-boundaries`, PR #32. The commit containing this document fixes the direct history SDK import to use the client's default export. Resolve its exact SHA with Git and compare local, origin, PR and successful CI head before proceeding. Final exact-head evidence is in the PR and private operator index; this document cannot embed its own commit hash.

Accepted native removal predecessor a389001a01c1b0a0f57404e54a71db5c99a457cf passed all 16 checks in CI 34752389239. Backend/browser reviewer-history integration eb22e615cd92914647b4cf6bfb0faec6a2c84825 exposed TS2614 in CI 34764027820: a direct module incorrectly imported apiClient as a named export. This handoff commit corrects it. Primary type checking and all 1,312 web tests / 102 suites pass after the fix. A real Axios/default-client loopback smoke makes four GETs successfully; the old import fails before dispatch. Invalid references do not dispatch, no-cache/session behavior and raw 403 are checked.

The earlier isolated dependency links resolved shared packages through primary, masking this new-module type error before integration. Prior actual history acceptance exercised HTTP → production routes → Supabase SDK → SQL; it did not exercise this new frontend SDK wrapper. Browser history uses the valid root apiClient re-export. Preserve those accepted results with these limits; do not call the failed predecessor CI green or widen a typecheck baseline.

Two unfinished scopes are committed/pushed separately and excluded from primary:

| Branch / worktree | Frozen commit | Limits |
| --- | --- | --- |
| `codex/home-residency-review-history`, `/private/tmp/pantopus-home-residency-review-history` | `579959f8a` | 24 native files plus the same SDK fix and WIP report. iOS signed build/format/lint pass; six test setup actor-isolation warnings, 31 focused tests/full/installed pending. Android 21 tests prepared, build and all acceptance pending. |
| `codex/home-current-residency-claims`, `/private/tmp/pantopus-home-current-residency-claims` | `51eb2ea0f` | 12 backend/SQL/SDK and four browser files plus WIP report, based on a389. Fifteen focused backend tests pass; browser typecheck/lint pass with dependency-link limits. SQL/populated upgrade/HTTP/UI unrun. Second browser consumer and native consumers unfinished. |

Each WIP branch contains its own detailed dated report. Four node_modules symlinks in each isolated worktree are intentional local-only dependencies; no source remains unstaged. Do not commit them. Reconcile history/claims router and SDK exports plus migration ordering before integrating claims.

PR #32 remains an open draft because its Home scope is unfinished. PR #34 remains an open conflicting draft at e9ef2decbb7ec435589bb3b92639041cfc4618a6 because paid scope and migration reconciliation are unfinished. Neither is awaiting routine owner approval. No new WIP PR, merge, deployment, provider activation or permanent migration adoption was performed.

## Accepted progress and remaining scope

Eight of 80 acceptance rows are locally closed (H01–H06, R01–R02); 72 are partial/open. This is not an implementation percentage or estimate of time left. Accepted subjourneys include sender/recipient invitations across browser/iOS/Android, ordinary-member Task first use, older-client residency compatibility, protected member removal and native reader recovery. Backend/browser own-review history now passes pagination/detail, current-authority expiry, failures/retry, account changes and a separate fresh applicant/reviewer cycle. Native history and current-claims privacy are unfinished. Wider H07/H08 onboarding, ownership/residency distinctions and renewal, feature/UI/payment/provider/integration/launch rows remain in the ordered inventory.

Primary migration inventory remains 49 Home / 21 paid / 58 combined versions, 12 byte-identical shared versions, zero collisions. The unintegrated current-claims migration is not included. Combined populated replay, adoption and hosted release/rollback preparation remain unfinished. Local acceptance does not establish hosted readiness. Keep all paid/provider activation in one final launch bundle.

## One next task

Resume the frozen native reviewer-history candidate. First repair iOS test-only actor-isolated setup, bind its changed test bundle, then run the 31 focused tests and appropriate full regression before exclusive-leased installed reader acceptance. Build/test Android's frozen 14-file candidate serially with the heavy build slot, then prove both actual readers and separate fresh native applicant/reviewer cycles. Preserve the accepted removal products and failed history predecessors. Only then integrate accepted native changes into primary and verify exact-head CI. Next reconcile/complete current-claims WIP and continue the inventory.

The private history fixture preparation revision r4 accounts only for the corrected SDK import. Its 528 product hashes and 17 private source hashes are bound; prior r3 is preserved. Read driver limits before running. Android cancellation of a held reply does not prove actual delivery of an obsolete 200. Browser controlled focus events are not OS lifecycle proof. Legacy NULL claim dates remain legitimate and must not be fabricated.

## Runtime, storage and evidence

All four history fixtures were exactly cleaned with complete retained logical schema/row restoration; API 18084 and history REST 18086 are closed. History DB/configuration remain. Owned Next servers 18080/18081 are stopped. Owned iOS F9BBAB33-BAA0-4A00-9ECE-E3B1343627A8 and Android emulator-5556 are stopped with data retained. No physical iPhone loopback install. Retain Supabase replay API 64521 / DB 64522 and separate removal REST 18085; inspect live ownership before a writer. No build process remains.

Storage cleanup previously reclaimed approximately 52.7 GiB of regenerable Gradle cache outputs; external compiler-cache relocation was reversed and verified. No external storage is now required. Approximately 23 GiB was available at freeze; check again before heavy builds. Never clean databases, device data, archives or unrelated owner work.

The owner checkout `/Users/yingpengwang/skinny-pantopus` remains on old master with its modified handoff and two untracked Place design files untouched. Do not reset, clean, prune, stash or incidentally commit that work.

Private durable root: `/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/20260907/home-invitation-handoff-20260912/residency-cycle-20260913/`. Accepted history archive `history-backend-browser-r1` has 1,975 files, manifest SHA256 601eb742e7ade0e67709f0979d5591ca51977db8262018e58e1dff12eed471d6. Integration archive `history-backend-browser-integration-eb22e615-r1` has 40 files, manifest 8c5a809b6e316657a4c42708fb2e538cb4d03f739ca944b8695fa93042660a1b. Final CI correction, native products/preparation and claims WIP are saved in a separate handoff extension; existing frozen evidence is not overwritten.

Private operator index: `/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/20260907/OPERATOR_HANDOFF.md`. Inspect only as needed; never print secrets or commit tokens, database archives, credentials or operator logs. Private evidence is not recoverable from Git alone.
