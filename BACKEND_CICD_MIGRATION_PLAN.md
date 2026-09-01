# Backend and CI/CD Migration Plan

## Purpose

This repository is the native Pantopus repository. The long-term goal is to keep
the current native iOS app in Swift/SwiftUI and the current native Android app in
Kotlin/Jetpack Compose, while continuing to use the same production backend, web
app infrastructure, and backend/web CI/CD that exist in the current production
React Native repository.

The copied `pantopus/` directory in this repository is a temporary reference
copy of the current production React Native repository. It exists only so the
engineer can compare and migrate production backend and CI/CD behavior into this
repository. It should not be treated as a nested application that will remain in
the repository, and it should not be committed wholesale.

The required target state is:

- `backend/` in this repository contains all production backend behavior from
  `pantopus/backend/`.
- `backend/` also preserves backend changes that were made only in this native
  repository after the native migration started.
- Backend and web app CI/CD/infrastructure from `pantopus/.github/workflows/`
  is copied into this repository's `.github/workflows/`.
- Existing native iOS and Android source code, workflows, docs, and release
  setup remain intact.
- `frontend/apps/web/` application code is not migrated in this phase because it
  has substantial divergence and is intentionally out of scope for now.
- The copied `pantopus/` reference directory remains available for owner
  verification after the migration work is completed.

## Repository Roles

### Current Repository Root

Path: repository root.

This is the destination repository. It currently contains:

- Native iOS app: `frontend/apps/ios/`
- Native Android app: `frontend/apps/android/`
- Current backend destination: `backend/`
- Current web app: `frontend/apps/web/`
- Current shared web packages: `frontend/packages/`
- Current native CI/CD workflows: `.github/workflows/ios-*` and
  `.github/workflows/android-*`

The root repository branch currently uses `master` in local git, while the
production reference repository under `pantopus/` uses `main`.

### Temporary Production Reference

Path: `pantopus/`.

This is a copied production React Native repository. It currently contains:

- Production backend: `pantopus/backend/`
- Production backend/web workflows: `pantopus/.github/workflows/`
- Production React Native app: `pantopus/frontend/apps/mobile/`
- Production web app: `pantopus/frontend/apps/web/`
- Local/generated files such as `.git`, `node_modules`, `.pnpm-store`,
  `.next`, `.next-dev`, `.expo`, logs, environment files, virtualenvs, and build
  artifacts.

Important: do not copy or commit the copied repository as a whole. Use it as a
reference source for the specific migration surfaces listed in this document.

## Scope

### In Scope

1. Reconcile backend code:
   - Production backend source from `pantopus/backend/`
   - Current native-repo-only backend changes from `backend/`
   - Backend package metadata and backend test configuration
   - Backend database schema/migration files under `backend/database/`

2. Reconcile backend/web CI/CD and infrastructure:
   - Production workflows from `pantopus/.github/workflows/`
   - Existing native workflows already in `.github/workflows/`
   - Root infrastructure files only when they directly support backend/web
     CI/CD, such as Docker, deployment, or package-manager configuration

3. Preserve current native work:
   - `frontend/apps/ios/`
   - `frontend/apps/android/`
   - Native app docs and release workflows
   - Native app package/build configuration

4. Produce an auditable migration:
   - Keep a clear diff.
   - Avoid generated/local files.
   - Run backend and CI-relevant checks before handoff.

### Out of Scope

1. Do not migrate or overwrite `frontend/apps/web/` application code in this
   phase.
2. Do not migrate the React Native app from `pantopus/frontend/apps/mobile/`.
3. Do not replace the native iOS or Android apps with anything from the copied
   production repo.
4. Do not commit generated artifacts, local env files, caches, logs, app store
   binaries, virtualenvs, or dependency directories from `pantopus/`.
5. Do not remove the copied `pantopus/` reference directory as part of the
   engineering migration. The owner will remove it manually after verification.

## Current Findings to Preserve

The production reference backend and current destination backend are not
identical. The migration must be a merge, not a direct copy.

Known current-repo-only backend additions observed during inspection include:

- Gig boost support:
  - Migration `backend/database/migrations/149_gig_boost.sql`
  - `boosted_at` and `boost_expires_at` columns
  - `POST /api/gigs/:gigId/boost`
  - Boost columns included in gig list/detail selections

- Gig task format support:
  - Migration `backend/database/migrations/150_gig_task_format.sql`
  - Supabase migration `supabase/migrations/20260516000001_gig_task_format.sql`
  - `task_format` enum/column
  - `task_format` accepted in gig creation and Magic Task posting

- Home maintenance task support:
  - Migration `backend/database/migrations/151_home_maintenance_tasks.sql`
  - Extended `HomeMaintenanceLog` schema
  - `GET/POST/PUT/DELETE /api/homes/:id/maintenance`

- Admin claim queue enhancements:
  - Bucketed claim listing for `pending`, `approved`, and `rejected`
  - Claim count endpoint
  - Enriched claim payloads with home, claimant, and evidence count

- Home poll option-count support:
  - Poll responses include total vote count and per-option count breakdown

- Hub discovery enhancements:
  - Discovery support for listings
  - Additional structured discovery fields such as subtitle, price, rating,
    locality, verification/free/wanted flags, and created timestamp

- Business list locality support:
  - My-businesses responses include business city/state where needed by native
    screens

These features may or may not all be final product requirements, but they are
known destination-only changes and must be reviewed intentionally. They must not
be lost accidentally by overwriting `backend/` from `pantopus/backend/`.

## Desired Merge Strategy

Use production backend as the baseline, then layer current destination backend
changes on top.

The practical process should be:

1. Create a clean working branch for this migration.
2. Record the current state:
   - `git status --short --branch`
   - `git log -1 --oneline --decorate`
   - `git -C pantopus log -1 --oneline --decorate`
3. Generate an inventory of backend differences between `backend/` and
   `pantopus/backend/`, excluding local/generated files.
4. Categorize every backend difference into one of these groups:
   - Production change that should replace destination behavior.
   - Destination-only change that must be preserved.
   - Same feature changed on both sides and needs manual reconciliation.
   - Local/generated/secret artifact that must be ignored.
5. Replace destination backend files with production backend files only after the
   destination-only changes have been captured.
6. Re-apply destination-only backend changes intentionally.
7. Resolve conflicts at the feature level, not by choosing whole files blindly.
8. Run backend tests and CI-equivalent checks.
9. Review the final diff for accidental deletion of native work, web app code,
   env files, or generated artifacts.

## Recommended Backend Diff Commands

Use read-only comparison first:

```bash
diff -qr \
  -x .DS_Store \
  -x node_modules \
  -x .pnpm-store \
  -x .turbo \
  -x .next \
  -x .next-dev \
  -x .expo \
  -x Pods \
  -x .gradle \
  -x build \
  -x dist \
  -x coverage \
  -x logs \
  -x 'combined*.log' \
  -x '*.tsbuildinfo' \
  -x '*.ipa' \
  -x '.env' \
  -x '.env.*' \
  backend pantopus/backend
```

For each differing backend file, inspect actual hunks:

```bash
diff -u backend/path/to/file pantopus/backend/path/to/file
```

For current-only files, confirm whether they are destination-only product work
or local artifacts:

```bash
find backend -type f | sort > /tmp/current-backend-files.txt
find pantopus/backend -type f | sort > /tmp/production-backend-files.txt
```

Do not use these file lists directly for copy operations. They are only for
audit and planning.

## Backend Implementation Plan

### 1. Prepare a Safe Branch

Create a dedicated migration branch from the current repository state:

```bash
git checkout -b codex/backend-cicd-production-merge
```

Before making changes, confirm:

```bash
git status --short --branch
```

The only expected pre-existing untracked item may be the copied `pantopus/`
reference directory. If other user changes exist, do not overwrite them.

### 2. Save a Backend Difference Report

Create a temporary, uncommitted working note or terminal log containing:

- Files only in `backend/`
- Files only in `pantopus/backend/`
- Files present in both but different
- Generated/local files that must be ignored

The known high-impact backend differences should be reviewed first:

- `backend/routes/gigs.js`
- `backend/routes/magicTask.js`
- `backend/routes/home.js`
- `backend/routes/admin.js`
- `backend/routes/businesses.js`
- `backend/routes/hub.js`
- `backend/utils/columns.js`
- `backend/database/schema.sql`
- `backend/database/migrations/*`

### 3. Use Production Backend as the Baseline

After the difference report is complete, copy production backend source from
`pantopus/backend/` into `backend/`, but exclude all ignored/local/generated
items.

Do not copy:

- `.env`, `.env.*`, `.env.local`
- `node_modules/`
- `logs/`
- `combined*.log`
- `.DS_Store`
- generated coverage/build/cache output
- one-off local helper files that are intentionally ignored by production, such
  as `generate-apple-secret.js`, unless the team explicitly decides it belongs
  in source control

### 4. Re-apply Destination-Only Backend Features

Re-apply the current native-repo-only backend changes on top of the production
baseline.

At minimum, review and preserve the feature groups listed in "Current Findings
to Preserve":

- Gig boost
- Gig `task_format`
- Home maintenance tasks
- Admin claim buckets/counts/enrichment
- Poll option counts
- Hub discovery listing support and structured discovery metadata
- My-businesses city/state locality support

When re-applying these, update all related layers together:

- Route validation
- Route handlers
- Shared backend column selection helpers
- Database schema snapshot
- Database migrations
- Tests

Do not preserve a destination-only change only because it exists. Preserve it
because it is part of the native migration work or a required backend contract.
If a destination-only change conflicts with a newer production behavior, merge
the behavior manually so production behavior remains intact and the native-only
contract still works.

### 5. Database and Migration Rules

Do not remove production migrations from `pantopus/backend/database/migrations/`.

Do preserve current-only additive migrations that support native backend
contracts:

- `149_gig_boost.sql`
- `150_gig_task_format.sql`
- `151_home_maintenance_tasks.sql`

Also preserve the matching Supabase migration:

- `supabase/migrations/20260516000001_gig_task_format.sql`

If a schema snapshot such as `backend/database/schema.sql` differs, regenerate
or manually update it only after deciding the final migration set. The final
schema should represent production backend plus preserved destination-only
additive changes.

### 6. Backend Tests

After backend reconciliation, run:

```bash
cd backend
pnpm test
```

Also run focused tests for preserved destination-only features if present:

```bash
cd backend
pnpm test -- tests/homeMaintenance.test.js
pnpm test -- tests/unit/adminClaimsBuckets.test.js
```

If test names or paths change during the merge, update the commands to the
final paths and document the actual commands run in the PR or handoff notes.

## CI/CD and Infrastructure Plan

### Goal

Backend and web app CI/CD/infrastructure should match the production reference
repo as closely as possible. Existing native iOS/Android CI/CD in this repo must
remain.

### Production Workflows to Bring Over

From `pantopus/.github/workflows/`, bring over:

- `ci.yml`
- `deploy-backend.yml`
- `rollback-backend.yml`
- `release-notify.yml`

These production workflows cover:

- Backend tests
- Seeder tests
- Web type-check/lint/test checks
- Backend Docker image build and push
- Staging backend deploy
- Production backend deploy
- Backend rollback
- Release notifications

### Native Workflows to Preserve

Keep the existing native workflows already in this repository:

- `android-ci.yml`
- `android-benchmark.yml`
- `android-beta.yml`
- `ios-ci.yml`
- `ios-beta.yml`

Do not overwrite these with anything from the production React Native repo.

### Branch Filter Note

The production workflows from `pantopus/.github/workflows/` currently target
`main` and `dev`. The current destination repository is locally on `master`.

For this migration, copy the production backend/web workflows as production has
them unless the repository owner explicitly asks to change branch filters.

If CI must run on `master` immediately after migration, that is a follow-up
decision and should be made explicitly. Do not silently change branch behavior
while claiming the production CI/CD was copied exactly.

### Web App Code Rule

Copying CI/CD does not mean copying web app source code.

Do not overwrite:

- `frontend/apps/web/`
- `frontend/packages/`
- Web routes, components, hooks, tests, or package code

However, if a copied production workflow expects scripts that the current web
package does not have, handle that as a CI compatibility issue:

- Prefer adding or preserving package scripts only when they are required for
  the copied CI workflow to run.
- Do not port production web application behavior in this phase.
- If a workflow cannot run without web code migration, document that limitation
  instead of changing large web app surfaces.

### Root Infrastructure Files

Root infrastructure files should be compared before changing:

- `docker-compose.yml`
- `docker-compose.dev.yml`
- `turbo.json`
- `package.json`
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml`
- `.gitignore`
- `.dockerignore`
- `.nvmrc`
- Prettier config files

Observed during inspection:

- `docker-compose.yml`, `docker-compose.dev.yml`, and `turbo.json` already
  match the production reference.
- `package.json` and `pnpm-workspace.yaml` intentionally differ because this
  repository excludes the React Native workspace and includes native scripts.
- `pnpm-lock.yaml` differs and may need regeneration after final package
  changes.
- Production has repo hygiene files such as `.nvmrc`, `.PRETTIERRC`,
  `.PRETTIERIGNORE`, `.dockerignore`, and `CONTRIBUTING.md` that should be
  reviewed individually.

Do not replace root workspace files blindly. Keep native workspace definitions
and native scripts intact.

## Files and Artifacts That Must Not Be Committed

The copied production reference contains local/generated/sensitive files. Do
not commit them.

Known examples:

- `pantopus/.git/`
- `pantopus/node_modules/`
- `pantopus/.pnpm-store/`
- `pantopus/.turbo/`
- `pantopus/frontend/apps/web/.next/`
- `pantopus/frontend/apps/web/.next-dev/`
- `pantopus/frontend/apps/web/playwright-report/`
- `pantopus/frontend/apps/web/test-results/`
- `pantopus/frontend/apps/mobile/.expo/`
- `pantopus/frontend/apps/mobile/dist/`
- `pantopus/frontend/apps/mobile/build-*.ipa`
- `pantopus/backend/logs/`
- `pantopus/backend/combined*.log`
- `pantopus/pantopus-seeder/.venv/`
- `pantopus/pantopus-seeder/venv/`
- `pantopus/pantopus-seeder/.pytest_cache/`
- `pantopus/pantopus-seeder/**/__pycache__/`
- `pantopus/pantopus-seeder/build/`
- `pantopus/pantopus-seeder/deploy/.aws-sam/`
- Any `.env`, `.env.*`, or `.env.local` file from `pantopus/`

Before committing, run:

```bash
git status --short
git status --ignored --short
```

Review the output carefully. The migration commit should not include the copied
reference repository itself or any generated/local artifacts from it.

## Verification Checklist

### Backend Verification

- `backend/` contains production backend behavior from `pantopus/backend/`.
- Current destination-only backend contracts have been reviewed and intentionally
  preserved or intentionally dropped with a written explanation.
- Known destination-only features listed in this document are either present in
  the final backend or explicitly documented as removed.
- Backend migrations include production migrations plus preserved additive
  native-repo migrations.
- `backend/database/schema.sql` matches the final migration decision.
- Backend tests pass, or failures are documented with root cause and owner
  decision.

### CI/CD Verification

- Production backend/web workflows exist in `.github/workflows/`.
- Existing native iOS/Android workflows still exist and were not overwritten.
- Workflow branch filters are either copied exactly from production or changed
  only with an explicit owner decision.
- Docker build/deploy workflow references still point to the correct backend
  path and expected secrets.
- Rollback workflow remains available.
- Release notification workflow remains available.

### Repository Hygiene Verification

- No React Native mobile source was copied into the active workspace.
- No production web app source was overwritten.
- No native iOS or Android source was removed.
- No env files, logs, caches, virtualenvs, build output, dependency directories,
  or app binaries were committed from `pantopus/`.
- `pnpm-lock.yaml` was updated only if package/workspace changes require it.
- Final `git diff` is understandable and organized by backend merge plus CI/CD
  workflow migration.

## Suggested Commit Structure

Prefer separate commits if possible:

1. Backend reconciliation:
   - Production backend baseline
   - Preserved destination-only backend changes
   - Backend tests/migrations/schema updates

2. CI/CD migration:
   - Production backend/web workflows
   - Any required workflow compatibility adjustments
   - Native workflows preserved

3. Optional repo hygiene:
   - `.gitignore` or root config updates required to prevent accidental commits
   - Only include if necessary and reviewed

If the backend reconciliation is large, it is acceptable to keep it as one
commit, but the PR or handoff notes must clearly explain which destination-only
backend features were preserved.

## Acceptance Criteria

The migration is complete when all of the following are true:

- The active `backend/` is production-compatible with `pantopus/backend/`.
- Destination-only backend changes required by the native migration are still
  present.
- Production backend/web CI/CD workflows are present in this repository.
- Existing native iOS/Android workflows and code remain present.
- Web app source code was not migrated or overwritten.
- The final diff contains no copied local/generated/sensitive artifacts.
- Backend tests and CI-relevant checks have been run, or any failures are
  documented clearly.
- The owner can compare against `pantopus/` during final verification because
  the reference directory has not been removed by the engineer.

