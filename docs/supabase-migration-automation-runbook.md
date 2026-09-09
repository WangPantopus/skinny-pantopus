# Supabase migration automation: adoption and activation

Updated September 8, 2026: canonical source adoption is prepared in PR #11.
See the [canonical evidence](database-canonical-baseline-2026-09-08.md).
The historical implementation description below records the original PR #3;
the adoption branch now uses `mode: baselined`. Hosted adoption remains pending.

**Decision: prepare automation now; defer production baselining and ledger
changes to a dedicated adoption change.** The research in the original runbook
identified the right architecture: one canonical timestamped migration stream,
a baseline captured from the live schema, fresh-database checks on PRs, and
serialized deployment from GitHub Actions. It is unsafe to enable `db push`
against today's incomplete, conflicting histories.

## What this PR implements

- `supabase/migration-policy.json` records SHA-256 hashes of the existing SQL in
  both migration directories, with `mode: legacy`. CI permits this exact history
  while rejecting edits, deletion, or new migration files until adoption. The
  exception is a transition to a verified baseline with preserved archives.
- `pnpm db:check` protects history, validates names and uniqueness after adoption,
  rejects psql meta-commands, and requires a compatibility declaration and
  bounded lock timeout in new migrations. CI also rejects changes to previously
  committed migrations and newly inserted versions older than the base branch.
- Once `mode` becomes `baselined`, CI replays the entire stream on a fresh local
  Supabase Postgres, lints functions, runs SQL contracts and includes the result
  in required check `CI OK`. PR jobs receive no hosted database credentials.
- Deploy Backend waits for successful CI on the exact branch commit. After
  adoption it links, dry-runs, and pushes migrations before deploying API and
  worker, all under the **same environment concurrency lock** as app rollback.
- Hosted SQL is disabled in legacy mode. Baselined releases additionally require
  environment variable `DB_MIGRATIONS_ENABLED=true` and three environment secrets.
  A missing activation prerequisite fails the release before application rollout.

This is preparation, not a claim that production was baselined. No hosted schema,
ledger, password, data, or project configuration was changed by this PR.

## Existing history and why a baseline is necessary

The original September 5 investigation found 179 top-level timestamped files
plus three development patches, and 178 numbered migrations. The streams are not
mirrors; the base tables preceding numbered migration 030 are missing. The first
timestamped migration alters `public.User`, which a fresh database cannot create
from this stream. Several timestamp prefixes repeat. Supabase's ledger keys on
the version prefix, so these files cannot safely be replayed unchanged.

The existing numbered SQL remains historical evidence and test fixtures. Do not
rename duplicate versions and replay them against production: matching filenames
does not prove matching production state. On September 7 the owner confirmed that
`gzzdqechcbfpalfvgyro` (Pantopus-backend, used by this Mac) is a testing database;
the old AWS backend's `ankjdyvoduutkhhaxvhx` is production. Preserve both. See the
[recovery record](backend-recovery-2026-09-07.md) and re-verify the owning account
and current schema before production adoption.

## Corrections to the original proposal

1. **Verify before repairing history.** Preserve the complete existing ledger,
   including `statements`, and validate the baseline before touching ledger rows.
   The original order cleared remote versions before proving a replacement.
2. **Schema counts are insufficient.** Matching table/function/policy counts can
   conceal different definitions, grants, RLS settings, triggers and indexes.
   Compare normalized schema definitions and exercise real database contracts.
3. **`pnpm test` does not validate the live schema.** The backend's default Jest
   config maps Supabase to mocks. Use SQL contracts and explicitly configured
   integration tests against an isolated local stack; never use production test
   credentials. Audit the integration suite before selecting tests because some
   existing files have their own mocks or assume specific seed fixtures.
4. **Read managed-schema customizations from production.** An old migration is
   not proof that an auth trigger or storage policy still matches production.
   Inventory custom objects in `auth`, `storage`, extensions and scheduled jobs
   from the live catalogs. Do not recreate Supabase-managed schemas wholesale.
5. **One deploy sequence.** Independent push-triggered database and app workflows
   can race CI and each other. The implemented release workflow waits for CI,
   migrates first, then deploys code under a shared lock.
6. **No routine `--include-all` or history repair.** Resolve out-of-order migration
   filenames before merge. Production SQL failures require diagnosis and a
   forward fix; ledger repair is an audited incident operation.
7. **A local replay proves structure, not production data compatibility.** Add
   upgrade-path tests and representative synthetic data, including large-table
   locking and constraints, alongside fresh installs.
8. **Schema-only does not guarantee public-safe.** Function bodies, cron commands,
   defaults and URLs can contain embedded secrets. Review dumps before committing
   any baseline. Keep ledger/data backups outside this public repository.

## Adoption procedure

Use a dedicated branch and a planned window with database changes frozen.
Application traffic can remain running if no schema writes are needed, but
coordinate every SQL editor, CLI, integration and old deployment writer.

### 1. Read-only inventory and recoverable backups

- Confirm production's project ref and Postgres major version against
  `supabase/config.toml`. Use the CLI version pinned in `migration-policy.json`
  (2.116.0 at implementation); verify current release notes before changing it.
- Capture the full migration ledger and normalized schema/catalog inventory.
  Record custom schemas, owners, grants/default privileges, RLS enable/force
  flags, policies, indexes/constraints, routines, triggers, extensions, auth
  hooks, storage policies and scheduled jobs.
- Take encrypted schema and data backups **outside the repository and public
  Actions artifacts**. Include necessary custom roles. Verify that they can be
  restored to an isolated project. Backing up storage metadata does not back up
  the storage object bytes; handle those separately if needed for recovery.
- Do not reset a production database password merely to run this procedure.
  Obtain the authorized connection details or schedule a coordinated rotation.

Typical schema/data commands after explicitly linking to the intended project:

```bash
supabase migration list --linked
supabase db dump --linked -f /private/backup/location/schema.sql
supabase db dump --linked --data-only --use-copy -f /private/backup/location/data.sql
```

These commands alone are not the complete inventory/restore verification.

### 2. Prepare and review the baseline locally

- Move `supabase/migrations/` to `supabase/migrations-archive/` byte-for-byte.
  Leave numbered SQL unchanged. Preserve `legacyFiles` in the policy file.
- Create a new `supabase/migrations/` containing reviewed schema-only baseline
  files with unique 14-digit UTC prefixes newer than the archived history.
- Preserve extensions and custom objects in managed schemas without overwriting
  platform-owned definitions. Strip unsupported psql commands such as `\restrict`.
- Audit custom function bodies and cron commands for credentials/PII before
  committing anything. Do not dump production rows into a public seed file.
- Include required application reference rows in deterministic migrations, not
  just `seed.sql`, if new hosted environments must receive them too. Local-only
  fixtures may use an explicitly configured, synthetic seed file.
- Update the two identity-firewall unit-test paths to the archive; keep numbered
  address-calendar fixtures intact. Add archived-history READMEs.
- Set policy `mode` to `baselined` and populate `baselineFiles` with SHA-256 hashes
  keyed by full repository-relative baseline filenames. Keep `cliVersion` pinned.

### 3. Validate without production writes

Use a **new, isolated work directory/project id**, not the developer's existing
Supabase stack. Do not run `supabase stop --no-backup` against a valuable local
database to obtain a clean test environment.

- `pnpm db:check` must pass.
- `supabase db start` must apply the complete baseline on an empty local stack.
- `node scripts/db/check-function-lint.cjs` must pass. It runs the pinned
  `supabase db lint --local --fail-on error` scan, checks application routines
  and attached triggers, and executes the PostGIS runtime contract. Fix
  application errors; do not lower the failure threshold. The only accepted
  CLI errors are the six stock PostGIS diagnostics recorded in the reviewed
  manifest, with exact extension membership, version, function hashes and
  diagnostic contents. Unknown errors, application-name collisions and changed
  provenance fail. This explicit exception replaces the raw CLI exit-code gate;
  the raw CLI still exits 1 for these six diagnostics. See the
  [reference and lint evidence](database-reference-lint-2026-09-08.md).
- Add pgTAP SQL tests under `supabase/tests/` for auth-user triggers, RLS as actual
  `anon`/`authenticated` roles, sensitive grants, storage policies and core RPCs.
  `supabase test db` must pass with real assertions, not an empty test directory.
- Compare normalized schema definitions/catalogs with production and explain
  every intentional platform-managed difference.
- Exercise the chosen real backend integration tests with local credentials and
  synthetic fixtures. Verify denied access as well as successful API/RPC calls.
- Test the upgrade path and application rollback compatibility separately from a
  fresh install. Schema expansion must work with the currently deployed app.
- Obtain a green PR run, including the new database replay gate.

### 4. Adopt the remote ledger only after validation

With all database writers still coordinated, save a final ledger snapshot.
Prepare an exact, reviewable list of old ledger versions to retire and baseline
versions to record. `migration repair` changes metadata; it neither applies nor
undoes the corresponding SQL. Never infer a reverted schema from a reverted row.

The old rows may need `repair --status reverted` because their files have moved
out of the runnable stream. Record only verified baseline versions with
`repair --status applied`. Treat the sequence as a controlled adoption operation
with restoration instructions for the saved ledger if it is interrupted.
Do not execute these commands from a generic CI workflow or a laptop pointed at
an unverified project.

Afterward, `migration list --linked` must show precisely the baseline versions on
both sides and `db push --linked --dry-run` must report nothing pending. Archive
the verification evidence privately. Do not apply the baseline DDL to the already
populated production schema.

### 5. Enable hosted automation

For each enabled backend environment configure environment secrets:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_PROJECT_ID`

Restrict the production environment to `master`; follow `docs/ci-cd.md` for the
staging workflow_run context. A staging deployment needs its **own** project and
verified ledger; never reuse production database credentials to make staging green.
Set `DB_MIGRATIONS_ENABLED=true` only after that environment's adoption succeeds.

Merge the adoption PR with required, strict `CI OK` protection. The release first
runs migrations (expected no-op), then deploys the application. Exercise a small,
backward-compatible smoke migration through another PR and verify its ledger
entry and actual database effect. Keep old automated/manual SQL writers disabled.

## Future migrations

Create a timestamped file with `supabase migration new <snake_case_name>`. Do not
add numbered twins or edit applied migrations. A normal transactional migration
starts with:

```sql
-- Explain the change and operational impact.
-- Backwards compatible: yes
set local lock_timeout = '5s';
-- DDL / deterministic reference data changes
```

The compatibility assertion is a review aid, not a proof. Use expand/contract:
add compatible schema first, deploy both old/new-compatible code, backfill with
bounded operations, and remove obsolete schema in a later release after the
rollback window. `db push --dry-run` checks pending history; it does not execute
or validate SQL.

Nontransactional operations (such as concurrent index creation) need a separate
file and a tested recovery procedure. Use a session `SET lock_timeout` where
`SET LOCAL` would have no surrounding transaction. Verify behavior with the pinned
CLI and Postgres. A failed nontransactional file can leave a committed index
without a ledger row; inspect validity before retrying. `IF NOT EXISTS` alone
does not repair an invalid index.

CI compares new versions with the base branch. If another migration merges first,
update the branch and give the unmerged file a later timestamp. Do not use
`--include-all` in routine releases. A failed multi-file push can leave earlier
files applied: keep them immutable and ship a forward-compatible fix. Application
rollback never runs down migrations or modifies the database ledger.

## Acceptance evidence still required

The [September 8 local continuation](database-baseline-rehearsal-2026-09-08.md)
closes the known table/column gaps on a preserved production-upgrade copy and
adds real SQL contracts plus read-only catalog comparison tools. It also finds
and locally corrects a direct Beacon-storage authorization gap. These results
now underpin the [canonical baseline](database-canonical-baseline-2026-09-08.md),
which activates repository database CI. Hosted adoption remains pending; private
forward SQL and catalogs stay in the operator evidence root.
The additional application linter cannot pass the gate by itself. The
[reviewed function gate](../scripts/db/check-function-lint.cjs) retains the
complete pinned CLI scan and adds provenance checks and real PostGIS calls.
Its narrowly reviewed extension exceptions do not permit application errors.

Production baselining is deliberately deferred. Completion requires: privately
verified backups, exact schema equivalence, custom managed-schema objects and
reference data captured, real SQL/integration tests, local replay, an adopted
remote ledger, no pending baseline SQL, per-environment secrets/project isolation,
and a successful smoke migration through the full release sequence.

## Sources

- [Supabase database migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase managing environments](https://supabase.com/docs/guides/deployment/managing-environments)
- [Supabase CLI reference](https://supabase.com/docs/reference/cli/introduction)
- [Supabase backups](https://supabase.com/docs/guides/platform/backups)
- [GitHub workflow_run semantics](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run)
