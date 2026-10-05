# Owner checkout recovery — October 3, 2026

The user requested a clean owner repository with the latest merged code. This
milestone repairs Git state and the demonstrated migration-test isolation defect;
it changes no application screen, service, schema or migration body.

## Observed problem and preservation

Owner checkout: `/Users/yingpengwang/skinny-pantopus`, branch `master`.
Its original head was `b86ee935d`. Nine commits titled `Original
inventory`, `Adopted history` and `Adopted baseline` followed real master
`ed5ea9ec5`. Git tracked four fixture files, reporting the real codebase as
untracked. Fresh origin master was `2f7bea45fde75911ea1271f969fba1e211e0d128`,
1,283 commits ahead of the last real checkout, with none of the fixture commits.

An alternate index loaded from `ed5ea9ec5` established zero tracked-file disk
differences. Five additional documents were copied outside the checkout with
SHA-256 verification before moving them out of the clean working tree:

- `docs/launch-boundary-2026-09-26/README.md`
- `docs/launch-boundary-2026-09-26/acceptance-tiers/remaining-work-tiers.md`
- `docs/launch-boundary-2026-09-26/design-amendments/first-person-loop-amendments.md`
- `docs/launch-boundary-2026-09-26/next-steps/launch-order-and-journeys.md`
- `docs/marketing/launch-assets-2026-10-01.md`

Original master remains on `codex/backup-master-before-recovery-20261003`.
The private recovery root is
`/Users/yingpengwang/pantopus-repo-recovery-20261003`, including the original
index/ref/worktree inventory, document copies and hash manifest, and isolated
reproduction/test evidence. The backup ref is local only. Existing branches,
ignored local configuration, dependencies, private evidence, devices and databases
were retained.

## Root-cause evidence and smallest repair

The three fixture commits match the Git calls in the existing
[`check-migrations.test.cjs`](../scripts/db/check-migrations.test.cjs). In a
disposable outer repository, invoking the unchanged tests with its `GIT_DIR`
exported changed the outer HEAD through all three fixture commits while the tests
exited successfully. This reproduces the exact corruption mechanism. The original
September 30 invocation environment is not available, so its precise caller is
unverified.

The existing fixture commands and policy checker now remove inherited `GIT_*`
variables for their local Git subprocesses. Git resolves the requested repository
from its explicit working directory. The checker needs the same isolation so
fixture policy comparisons read fixture history rather than the caller's history.
The regression extends the existing test file; no replacement checker, new test
file or application implementation is needed. It runs the three existing fixture
journeys under both `GIT_DIR` alone and multiple inherited routing variables,
checking the caller's HEAD, index, status and uncommitted file bytes stay intact.

## Recovery and verification

- Preserved the original head/index and verified local document copies.
- Restored branch/index to the last real ancestor without changing real source
  bytes, then fast-forwarded to fresh origin master. No new origin path collided
  with a local file. Restored checkout tracks 11,332 files and has zero local
  changes or ahead/behind commits.
- Archived metadata for 33 registrations whose worktree paths no longer exist,
  then pruned them. All 19 present worktrees remain registered; their branch heads
  and working files are retained.
- Preserved and removed one orphan `.rev` file lacking both its pack and index.
  `git count-objects -v` now reports zero garbage. No object/branch garbage
  collection or cache deletion was performed. Git object connectivity also passes
  (`git fsck --connectivity-only --no-dangling`).
- Nine migration-checker tests pass, including inherited-environment regression.
  The complete CI safeguard command passes all 75 tests. Migration policy against
  `origin/master` and `git diff --check` pass.

Master [CI 37158813142](https://github.com/WangPantopus/skinny-pantopus/actions/runs/37158813142)
at `2f7bea45f` passed safeguards, backend/privacy, web, seeder, Docker, Android and
database replay at inspection; iOS jobs were still queued. Earlier green
[CI 37114067654](https://github.com/WangPantopus/skinny-pantopus/actions/runs/37114067654)
belongs to `7d7bc2ee3`, not the new master. Deploy Backend on new master was
skipped. No deployment or fresh application journey acceptance is claimed.

The safety fix and this handoff/report stay on
`codex/fix-migration-test-git-isolation` for review and required CI. Return the
owner checkout to clean origin master afterward. Only the coordinator integrates
the repair; existing unrelated PRs and the stream merge queue remain intact.
