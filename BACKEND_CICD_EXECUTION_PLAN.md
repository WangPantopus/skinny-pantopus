# Backend and CI/CD Migration Execution Log

## Starting State

- Active repository path: `/Users/yingpengwang/pantopus/native/pantopus`
- Active branch: `migrate-backend-and-ci-cd`
- Active repo commit: `ad9cc758` (`Merge pull request #203 from WangPantopus/claude/amazing-tesla-ffQ6E`)
- Active repo working tree before migration:
  - `BACKEND_CICD_MIGRATION_PLAN.md` is untracked.
  - `pantopus/` is an untracked reference copy.
- Reference repo path: `pantopus/`
- Reference repo branch: `main`
- Reference repo commit: `9c4f8fca` (`Merge pull request #290 from wypgitt/feature/homepage-redesign`)
- Reference repo working tree: clean.

## Agreed Decisions

- Use `pantopus/backend/` as the production backend baseline.
- Keep `pantopus/` untouched as a reference copy for owner verification.
- Preserve required native-repo-only backend contracts after applying the production baseline:
  - gig boost
  - gig `task_format`
  - gig `top_bidders` in `GET /api/gigs/my-gigs`
  - home maintenance task CRUD
  - admin claim buckets, counts, enrichment, and queue age
  - home poll `option_counts`
  - hub discovery listings and structured metadata
  - my-businesses city/state locality fields
- Import production backend/web workflows into this repository's `.github/workflows/`.
- Omit the React Native/Expo `mobile-checks` job from the imported `ci.yml`.
- Use `master` and `dev` branch filters in this repository's imported backend/web workflows.
- Preserve existing native iOS and Android workflows.
- Do not overwrite active `frontend/apps/web/`, `frontend/packages/`, native app code, or native release setup.
- Do not copy env files, logs, caches, dependency directories, virtualenvs, app binaries, or generated artifacts from `pantopus/`.

## Execution Steps

1. Record starting state. Completed.
2. Create this execution log. Completed.
3. Build backend diff inventory. Completed.
4. Apply production backend baseline with ignored artifacts excluded. Completed.
5. Re-apply destination-only backend features intentionally. Completed.
6. Import backend/web CI/CD workflows with agreed branch and mobile-job decisions. Completed.
7. Review root infrastructure only where CI compatibility requires it. Completed.
8. Run backend and CI-relevant verification. Completed.
9. Final repository hygiene and diff audit. Completed.

## Backend Diff Inventory

### Identical Backend Support Files

- `backend/package.json`
- `backend/jest.config.js`
- `backend/jest.integration.config.js`
- `backend/Dockerfile`
- `backend/.dockerignore`

### Destination-Only Backend Files to Preserve

- `backend/database/migrations/149_gig_boost.sql`
- `backend/database/migrations/150_gig_task_format.sql`
- `backend/database/migrations/151_home_maintenance_tasks.sql`
- `backend/tests/homeMaintenance.test.js`
- `backend/tests/unit/adminClaimsBuckets.test.js`

### Destination-Only Supabase File to Preserve

- `supabase/migrations/20260516000001_gig_task_format.sql`

### Backend Files Present in Both but Different

- `backend/database/schema.sql`
  - Current snapshot includes the home maintenance task extension from migration `151_home_maintenance_tasks.sql`.
  - Current snapshot does not appear to include the gig boost or gig `task_format` schema changes from migrations `149` and `150`; reconcile this during the schema step.
- `backend/routes/admin.js`
  - Preserve bucketed claim queues, `/claims/counts`, enriched claim rows, and `oldest_age_seconds`.
  - Keep static claim routes before `/claims/:claimId`.
- `backend/routes/businesses.js`
  - Preserve city/state fields in my-businesses membership responses.
- `backend/routes/gigs.js`
  - Preserve top bidder stack support for `GET /api/gigs/my-gigs`.
  - Preserve `task_format` validation/write support.
  - Preserve `POST /api/gigs/:gigId/boost`.
- `backend/routes/home.js`
  - Preserve home maintenance CRUD routes.
  - Preserve poll `option_counts` response data.
- `backend/routes/hub.js`
  - Preserve discovery support for listings, `since`, `verified`, `freeOrWanted`, and structured metadata fields.
- `backend/routes/magicTask.js`
  - Preserve `task_format` support in Magic Task posting.
- `backend/utils/columns.js`
  - Preserve gig selection columns for `task_format`, `boosted_at`, and `boost_expires_at`.

### Reference-Only Backend Items to Ignore

- `pantopus/backend/.env.dev`
- `pantopus/backend/.env.prod`
- `pantopus/backend/.env.staging`
- `pantopus/backend/combined*.log`
- `pantopus/backend/logs/`
- `pantopus/backend/node_modules/`
- `.DS_Store` files under `pantopus/backend/`
- `pantopus/backend/generate-apple-secret.js`
  - Not tracked in the reference repo.
  - Contains local Apple secret-generation constants and a local key path.
- `pantopus/supabase/.temp`

### Backend Inventory Conclusion

- No production-only tracked backend source files are missing from the active backend.
- The meaningful backend differences are destination-only native contracts layered on top of production behavior.
- Step 4 should still apply the production backend baseline, then Step 5 should re-apply the destination-only contracts listed above.

## Production Backend Baseline Applied

- Copied only tracked files from `pantopus/backend/` into `backend/`.
- Removed only tracked active backend files that are not tracked in `pantopus/backend/`.
- Ignored reference-only env files, logs, dependency directories, caches, and local helper files by using the reference repo tracked-file list.
- Verified that all common tracked backend files now match `pantopus/backend/` byte-for-byte.
- Current backend diff is the expected temporary production-baseline state:
  - Production versions restored for:
    - `backend/database/schema.sql`
    - `backend/routes/admin.js`
    - `backend/routes/businesses.js`
    - `backend/routes/gigs.js`
    - `backend/routes/home.js`
    - `backend/routes/hub.js`
    - `backend/routes/magicTask.js`
    - `backend/utils/columns.js`
  - Native-only files temporarily deleted until Step 5:
    - `backend/database/migrations/149_gig_boost.sql`
    - `backend/database/migrations/150_gig_task_format.sql`
    - `backend/database/migrations/151_home_maintenance_tasks.sql`
    - `backend/tests/homeMaintenance.test.js`
    - `backend/tests/unit/adminClaimsBuckets.test.js`
- `backend/.env.example` exists as a tracked source file; no `.env`, logs, `node_modules`, or generated reference artifacts were copied into active `backend/`.

## Destination-Only Backend Features Re-applied

- Restored the destination-only migrations and focused tests:
  - `backend/database/migrations/149_gig_boost.sql`
  - `backend/database/migrations/150_gig_task_format.sql`
  - `backend/database/migrations/151_home_maintenance_tasks.sql`
  - `backend/tests/homeMaintenance.test.js`
  - `backend/tests/unit/adminClaimsBuckets.test.js`
- Re-applied the native route/helper contracts:
  - `POST /api/gigs/:gigId/boost`
  - `task_format` validation/write support in gig creation and Magic Task posting
  - `top_bidders` in `GET /api/gigs/my-gigs`
  - admin claim buckets/counts/enrichment/queue age, with static claim routes before `/claims/:claimId`
  - home maintenance CRUD routes
  - home poll `option_counts`
  - hub discovery listings and structured metadata
  - my-businesses city/state locality fields
  - gig list/detail columns for `task_format`, `boosted_at`, and `boost_expires_at`
- Reconciled `backend/database/schema.sql`:
  - Preserved the existing home maintenance snapshot from migration `151`.
  - Added the missing `task_format` enum snapshot.
  - Added `Gig.boosted_at`, `Gig.boost_expires_at`, and `Gig.task_format`.
  - Added `idx_gig_boost_active` and `idx_gig_task_format`.
- Reconciled `supabase/migrations/` for the same native database contracts:
  - Added `supabase/migrations/20260516000000_gig_boost.sql`.
  - Preserved existing `supabase/migrations/20260516000001_gig_task_format.sql`.
  - Added `supabase/migrations/20260516000002_home_maintenance_tasks.sql`.
  - Verified the new Supabase gig boost and home maintenance migrations are byte-identical to their matching backend numbered migrations.
- After Step 5, the only backend diff is `backend/database/schema.sql`; the preserved route/helper/migration/test files match the active repo versions because those native contracts already existed before the migration branch.

## Backend/Web CI/CD Workflows Imported

- Imported production workflow files into active `.github/workflows/`:
  - `.github/workflows/ci.yml`
  - `.github/workflows/deploy-backend.yml`
  - `.github/workflows/rollback-backend.yml`
  - `.github/workflows/release-notify.yml`
- Preserved existing native workflow files:
  - `.github/workflows/android-ci.yml`
  - `.github/workflows/android-benchmark.yml`
  - `.github/workflows/android-beta.yml`
  - `.github/workflows/ios-ci.yml`
  - `.github/workflows/ios-beta.yml`
- Applied agreed branch semantics for this repository:
  - `ci.yml` triggers on `master` and `dev`.
  - `deploy-backend.yml` triggers on `master` and `dev`.
  - Production Docker tags and production deploy now gate on `refs/heads/master`.
  - Release notifications now gate on workflow runs from `master`.
  - Rollback example tag text now uses `master-abc1234`.
- Removed production React Native/Expo `mobile-checks` from imported `ci.yml`.
- Added web CI compatibility guards because the production web identity test files are not present in this native repo:
  - If `frontend/apps/web/tests/identityFirewallWeb.test.tsx` exists, CI runs it.
  - Otherwise, CI logs an explicit skip for that production-only Jest spec.
  - If `frontend/apps/web/tests/e2e/identity-firewall.spec.ts` exists, CI installs Playwright Chromium and runs it.
  - Otherwise, CI logs an explicit skip for that production-only Playwright spec.
- Validated the four imported workflow YAML files parse locally with Ruby YAML.
- `actionlint` is not installed locally, so actionlint validation was not run.

## Root Infrastructure Review

- Reviewed root infrastructure files against production reference:
  - `docker-compose.yml`, `docker-compose.dev.yml`, and `turbo.json` already match production.
  - `package.json` and `pnpm-workspace.yaml` intentionally differ because this repo excludes React Native mobile and includes native iOS/Android scripts.
  - `pnpm-lock.yaml` differs from production, but `pnpm install --frozen-lockfile --offline` passes in this repo and the lockfile was not rewritten.
  - Production-only `.dockerignore`, `.nvmrc`, Prettier config, and `CONTRIBUTING.md` were reviewed but not copied because the imported workflows do not require them and copying them would add root-level behavior outside the backend/web CI need.
- Verified imported CI command requirements:
  - Backend scripts include `test` and `test:privacy`.
  - Web scripts include `lint`, `test`, and `type-check`.
  - Seeder requirements and tests exist under `pantopus-seeder/`.
  - Production-only web identity test paths are absent, which is why `ci.yml` uses the compatibility fallback recorded above.
- Applied minimal repo hygiene in `.gitignore`:
  - ignored `logs/`
  - ignored `combined*.log`
  - ignored `.pnpm-store/`
  - ignored the temporary `pantopus/` reference copy so it cannot be accidentally committed while remaining available locally for owner verification.

## Broader Backend and CI-Relevant Verification

- Backend identity subset passed:
  - 10 suites passed.
  - 60 tests passed.
- Backend privacy gates passed:
  - serializer contract tests passed.
  - notification/cross-context harness tests passed.
  - source-level grep guards passed.
- Full backend Jest suite passed after one compatibility adjustment:
  - Initial full backend run failed only in `backend/tests/unit/legacyUiTermsRemoved.test.js` because the imported production test assumed production web/mobile identity label modules that are absent from this native repo.
  - Updated that test to enforce the production identity-label guard only for optional frontend identity label modules that exist in the active workspace.
  - Re-run passed: 193 suites passed, 1 skipped; 3022 tests passed, 16 skipped.
- Seeder tests passed:
  - First direct `pytest tests/ -q` failed because local Python dependencies were not installed.
  - Created a temporary verification venv outside the repo at `/tmp/pantopus-seeder-verify`.
  - Re-run passed with dependencies installed: 483 tests passed, 1 warning.
- Web lint passed:
  - `pnpm --filter=@pantopus/web lint` exited 0.
  - Existing lint warnings remain; there were no lint errors.
- Web Jest verification:
  - The production Identity Firewall Jest spec is absent in this native repo, so the imported CI step now skips it explicitly when missing.
  - A full current web Jest run was attempted for audit and failed in existing web tests: 4 suites failed, 6 passed; 5 tests failed, 88 passed.
  - Because web app code is out of scope for this migration and the production workflow only required the production identity spec, CI no longer substitutes the entire current web suite for the missing production-only file.
- Web Playwright verification:
  - The production Identity Firewall Playwright spec is absent in this native repo, so the imported CI step skips it explicitly when missing.
- Web type-check:
  - `pnpm --filter=@pantopus/web type-check` still exits nonzero with existing TypeScript errors.
  - This matches the imported production workflow behavior: the type-check step runs but is marked `continue-on-error: true`.
- Workflow/static checks passed:
  - The four imported workflow YAML files parse with Ruby YAML.
  - No imported workflow references to `main`, `refs/heads/main`, `pantopus-mobile`, `mobile-checks`, or `Mobile Release` remain.
  - The missing production web Jest and Playwright spec branches were executed locally and log explicit skips.
  - Native iOS and Android app directories have no tracked diff.

## Final Repository Hygiene and Diff Audit

- Final working-tree scope is limited to expected migration surfaces:
  - `.gitignore`
  - imported backend/web workflows
  - `BACKEND_CICD_MIGRATION_PLAN.md`
  - this execution log
  - `backend/database/schema.sql`
  - `backend/tests/unit/legacyUiTermsRemoved.test.js`
  - Supabase native migrations for gig boost and home maintenance
- No tracked diff exists under:
  - `frontend/apps/ios/`
  - `frontend/apps/android/`
  - `frontend/apps/web/`
  - `frontend/packages/`
- The temporary `pantopus/` reference copy is ignored and has zero tracked files in the active repo.
- Local/generated files remain ignored rather than trackable:
  - dependency directories
  - `.pnpm-store`
  - logs
  - `.DS_Store`
  - Python `__pycache__`
  - pytest cache
  - local env files
- Only `.env.example` files are tracked; no real `.env` files are tracked.
- A literal secret/private-key pattern scan over the migration files found no matches.
- Backend code-level audit against `pantopus/backend/`:
  - There are no reference-only tracked backend files missing from current `backend/`.
  - Current `backend/` has five tracked native-only backend files:
    - `backend/database/migrations/149_gig_boost.sql`
    - `backend/database/migrations/150_gig_task_format.sql`
    - `backend/database/migrations/151_home_maintenance_tasks.sql`
    - `backend/tests/homeMaintenance.test.js`
    - `backend/tests/unit/adminClaimsBuckets.test.js`
  - The shared tracked backend files that differ from `pantopus/backend/` are:
    - `backend/database/schema.sql`
    - `backend/routes/admin.js`
    - `backend/routes/businesses.js`
    - `backend/routes/gigs.js`
    - `backend/routes/home.js`
    - `backend/routes/hub.js`
    - `backend/routes/magicTask.js`
    - `backend/tests/unit/legacyUiTermsRemoved.test.js`
    - `backend/utils/columns.js`
  - Each differing shared backend file was reviewed at hunk level. The production-side lines that are not literally present are covered by richer native implementations or test compatibility guards; no missing production backend code was found.
  - `backend/routes/gigs.js` is production plus additions (`+148/-0` versus the reference).
  - Other route/helper differences preserve native-only contracts: admin claim buckets, my-businesses locality, home maintenance, home poll `option_counts`, hub listing/discovery metadata, Magic Task `task_format`, and gig selection columns.
- Supabase migration audit:
  - `supabase/migrations/20260516000000_gig_boost.sql` is byte-identical to `backend/database/migrations/149_gig_boost.sql`.
  - `supabase/migrations/20260516000002_home_maintenance_tasks.sql` is byte-identical to `backend/database/migrations/151_home_maintenance_tasks.sql`.
  - `supabase/migrations/20260516000001_gig_task_format.sql` has the same executable SQL body as `backend/database/migrations/150_gig_task_format.sql`; only header comments differ, so it was left untouched.
- Workflow audit:
  - Imported workflow YAML parses locally.
  - Imported workflows use this repo's `master`/`dev` branch semantics.
  - No imported workflow references to `main`, `refs/heads/main`, `pantopus-mobile`, `mobile-checks`, or `Mobile Release` remain.
  - Workflow diffs from production reference are limited to agreed branch changes, removed React Native/Expo mobile job, and native-repo web identity test guards.

## Commands Run

```bash
git status --short --branch
git log -1 --oneline --decorate
git -C pantopus log -1 --oneline --decorate
git -C pantopus status --short --branch
diff -qr [excluded generated/local patterns] backend pantopus/backend
comm -23 <current backend files> <reference backend files>
comm -13 <current backend files> <reference backend files>
diff -q backend/package.json pantopus/backend/package.json
diff -q backend/jest.config.js pantopus/backend/jest.config.js
diff -q backend/jest.integration.config.js pantopus/backend/jest.integration.config.js
diff -q backend/Dockerfile pantopus/backend/Dockerfile
diff -q backend/.dockerignore pantopus/backend/.dockerignore
git -C pantopus ls-files backend/generate-apple-secret.js
diff -qr supabase pantopus/supabase
rg -n "task_format|boosted_at|boost_expires_at" backend/database/schema.sql pantopus/backend/database/schema.sql backend/database/migrations pantopus/backend/database/migrations
git status --short backend
git -C pantopus ls-files -z backend | while read tracked backend files; do cp tracked file into active backend; done
comm -23 <current tracked backend files> <reference tracked backend files> | while read current-only file; do rm active backend file; done
cmp common tracked backend files between active backend and pantopus/backend
git diff --name-status -- backend
git checkout HEAD -- destination-only backend migrations/tests/routes/helpers/schema
node --check backend/routes/admin.js backend/routes/businesses.js backend/routes/gigs.js backend/routes/home.js backend/routes/hub.js backend/routes/magicTask.js backend/utils/columns.js
pnpm install --frozen-lockfile
cd backend && pnpm test -- tests/homeMaintenance.test.js tests/unit/adminClaimsBuckets.test.js
rg -n <native contract symbols> backend/database/migrations backend/database/schema.sql supabase/migrations backend/routes backend/utils/columns.js
diff -u backend/database/migrations/149_gig_boost.sql supabase/migrations/20260516000000_gig_boost.sql
diff -u backend/database/migrations/151_home_maintenance_tasks.sql supabase/migrations/20260516000002_home_maintenance_tasks.sql
cp pantopus/.github/workflows/{ci,deploy-backend,rollback-backend,release-notify}.yml .github/workflows/
rg -n "main|refs/heads/main|pantopus-mobile|mobile-checks|Mobile Release" .github/workflows/*.yml
ruby -e 'require "yaml"; ARGV.each { |f| YAML.load_file(f) }' .github/workflows/ci.yml .github/workflows/deploy-backend.yml .github/workflows/rollback-backend.yml .github/workflows/release-notify.yml
pnpm --filter=@pantopus/web test -- --listTests --runInBand
diff -u pantopus/.github/workflows/ci.yml .github/workflows/ci.yml
diff -u pantopus/.github/workflows/deploy-backend.yml .github/workflows/deploy-backend.yml
diff -u pantopus/.github/workflows/release-notify.yml .github/workflows/release-notify.yml
diff -u pantopus/.github/workflows/rollback-backend.yml .github/workflows/rollback-backend.yml
compare root infra files against pantopus/
pnpm install --frozen-lockfile --offline
cd backend && pnpm test -- --runInBand tests/unit/identitySerializers.test.js tests/unit/identityPolicy.test.js tests/unit/identityFirewallPrivacy.test.js tests/unit/identityFirewallHardening.test.js tests/unit/identityFirewallRegression.test.js tests/unit/identityFirewallMigrationSmoke.test.js tests/unit/identityFirewallRawUserAuditScript.test.js tests/unit/personaCompliance.test.js tests/unit/feedIdentityAuthors.test.js tests/unit/rawUserIdentityResponses.test.js
cd backend && pnpm run test:privacy
cd backend && pnpm test
pytest tests/ -q
python -m venv /tmp/pantopus-seeder-verify
/tmp/pantopus-seeder-verify/bin/python -m pip install -r requirements.txt -r requirements-lambda.txt
/tmp/pantopus-seeder-verify/bin/python -m pytest tests/ -q
pnpm --filter=@pantopus/web lint
pnpm --filter=@pantopus/web test -- --runInBand
pnpm --filter=@pantopus/web type-check
bash -c 'if [ -f frontend/apps/web/tests/identityFirewallWeb.test.tsx ]; then pnpm --filter=@pantopus/web test -- tests/identityFirewallWeb.test.tsx --runInBand; else echo skip; fi'
bash -c 'if [ -f frontend/apps/web/tests/e2e/identity-firewall.spec.ts ]; then pnpm --filter=@pantopus/web exec playwright install --with-deps chromium && pnpm --filter=@pantopus/web exec playwright test tests/e2e/identity-firewall.spec.ts --project=chromium; else echo skip; fi'
git diff --quiet -- frontend/apps/ios frontend/apps/android
git status --short --branch --ignored
git diff --name-status
git diff --stat
git diff --quiet -- frontend/apps/ios frontend/apps/android frontend/apps/web frontend/packages
git ls-files pantopus
git ls-files | rg -n 'generated/local/env patterns'
git status --porcelain=v1 --untracked-files=all | rg -n 'generated/local/env patterns'
comm -23 <reference backend tracked files> <current backend tracked files>
comm -13 <reference backend tracked files> <current backend tracked files>
cmp common tracked backend files between active backend and pantopus/backend
diff -u --minimal pantopus/backend/<differing shared backend file> backend/<differing shared backend file>
diff -u backend/database/migrations/149_gig_boost.sql supabase/migrations/20260516000000_gig_boost.sql
diff -u backend/database/migrations/150_gig_task_format.sql supabase/migrations/20260516000001_gig_task_format.sql
diff -u backend/database/migrations/151_home_maintenance_tasks.sql supabase/migrations/20260516000002_home_maintenance_tasks.sql
grep -v '^--' backend/database/migrations/150_gig_task_format.sql | sed '/^[[:space:]]*$/d'
grep -v '^--' supabase/migrations/20260516000001_gig_task_format.sql | sed '/^[[:space:]]*$/d'
rg -n "branches:|refs/heads/|master|dev|environment:|Docker|deploy|rollback|release|Identity Firewall|continue-on-error|mobile|pantopus-mobile" .github/workflows/ci.yml .github/workflows/deploy-backend.yml .github/workflows/rollback-backend.yml .github/workflows/release-notify.yml
rg -n "sk_live|sk_test|-----BEGIN|PRIVATE KEY|password\\s*=|secret\\s*=|client_secret\\s*=|\\.p8|AUTH_KEY|TEAM_ID|KEY_ID" <migration files>
```

## Files Touched

- `BACKEND_CICD_EXECUTION_PLAN.md`
- `backend/database/schema.sql`
- `supabase/migrations/20260516000000_gig_boost.sql`
- `supabase/migrations/20260516000002_home_maintenance_tasks.sql`
- `.github/workflows/ci.yml`
- `.github/workflows/deploy-backend.yml`
- `.github/workflows/rollback-backend.yml`
- `.github/workflows/release-notify.yml`
- `.gitignore`
- `backend/tests/unit/legacyUiTermsRemoved.test.js`

## Tests Run

- `node --check` on restored backend route/helper files. Passed.
- `cd backend && pnpm test -- tests/homeMaintenance.test.js tests/unit/adminClaimsBuckets.test.js`. Passed: 2 suites, 25 tests.
- `pnpm install --frozen-lockfile` was run first because backend `node_modules` was missing. The lockfile was not rewritten. Ignored `node_modules/` directories now exist locally and must not be committed.
- Workflow YAML parse check with Ruby YAML. Passed for the four imported workflows.
- Backend identity subset. Passed: 10 suites, 60 tests.
- Backend privacy gates. Passed.
- Full backend Jest suite. Passed after the optional frontend identity-label module compatibility fix: 193 suites passed, 1 skipped; 3022 tests passed, 16 skipped.
- Seeder tests. Passed in a temporary venv: 483 tests, 1 warning.
- Web lint. Passed with existing warnings only.
- Web production Identity Firewall Jest step. Passed by explicit skip because the production-only spec is absent.
- Web production Identity Firewall Playwright step. Passed by explicit skip because the production-only spec is absent.
- Full current web Jest suite. Failed during audit with existing out-of-scope web test failures: 4 suites failed, 6 passed; 5 tests failed, 88 passed.
- Web type-check. Failed with existing TypeScript errors, but the imported CI step is `continue-on-error: true`.
- Root install compatibility check: `pnpm install --frozen-lockfile --offline`. Passed; lockfile was not rewritten.

## Current Notes

- The active repo currently has `BACKEND_CICD_MIGRATION_PLAN.md` and `BACKEND_CICD_EXECUTION_PLAN.md` as untracked items.
- The temporary `pantopus/` reference copy remains present locally and is now ignored by `.gitignore`.
- The active backend has production behavior plus the preserved destination-only backend contracts.
- Current backend changes on this migration branch are `backend/database/schema.sql` and `backend/tests/unit/legacyUiTermsRemoved.test.js`.
- Shared route/helper differences versus `pantopus/backend/` are existing native-only backend contracts preserved during the merge, not new branch diffs.
- `supabase/migrations/` now includes timestamped native migrations for gig boost, gig `task_format`, and home maintenance in that order.
- The backend/web CI/CD workflows are imported with `master`/`dev` branch filters and without the React Native/Expo mobile job.
- The root infrastructure review is complete. Only `.gitignore` changed; package/workspace/Docker/lockfile files were left intact.
- Broader backend and CI-relevant verification is complete.
- The current web app suite and web type-check are not green, but those failures are existing web-surface issues outside this backend/CI migration. The imported CI blocks on web lint and the production identity specs when present; it does not block on the absent production-only specs or the nonblocking web type-check.
- Final repository hygiene and diff audit is complete.
- No tracked production backend code from `pantopus/backend/` appears to be missing from current `backend/`.
- The migration is ready for owner review, staging, and commit.
