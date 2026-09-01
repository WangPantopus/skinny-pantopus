# Database Migrations And Beacons - Interview Deep Dive

This document is written as an interview-prep answer for a senior software
engineer or database engineer discussion. It answers the following questions in
depth:

- Why are there two migration systems: `backend/database/migrations` and
  `supabase/migrations`?
- Which directory is the source of truth for production schema?
- How do we guarantee migration ordering across the two systems?
- What is the rollback strategy for a bad migration?
- How are destructive migrations reviewed?
- How do we test migrations against realistic production data volume?
- What schema changes are backwards-compatible with the currently deployed
  backend?
- Why does migration `148_enable_beacons_by_default.sql` flip
  `audience_profile` globally?
- What criteria made Beacons safe to enable by default?
- What is the kill switch if that migration causes privacy, load, or UX issues?

The short answer is that this repository has two migration directories because
there are two operational workflows:

- The backend directory is the human-readable backend engineering history.
- The Supabase directory is the timestamped deployment stream that Supabase CLI
  understands.

The long answer is that this dual-system setup only remains safe if it is
treated as a mirrored representation of one logical migration stream, with CI
guardrails that prevent drift.

## Executive Answer

There are two migration systems because they serve different consumers.
`backend/database/migrations` is the backend-owned, sequence-numbered history.
It makes feature sequencing easy to review, discuss, and reference in runbooks.
`supabase/migrations` is the Supabase-compatible deploy stream. Supabase CLI
uses timestamped filenames and records applied migrations in its own migration
ledger.

For production, the source of truth is not `backend/database/schema.sql`. That
file explicitly says it is a frozen snapshot and not applied by any migration
runner. The production source of truth is:

1. The live production Postgres schema and Supabase migration ledger.
2. The ordered SQL in `supabase/migrations` for future production applies.
3. Smoke tests and runbooks that verify the live schema after application.

The backend-numbered migrations are useful mirrors, documentation, and direct
`psql` runbook inputs, but hosted Supabase production should be driven by the
timestamped Supabase migration stream.

The key risk is drift. If a logical migration exists in only one directory, or
if the same migration has different SQL in the two directories, we no longer
have one migration system. We have two competing systems. The repository already
contains evidence of this risk: migration `148_enable_beacons_by_default.sql`
exists under `backend/database/migrations`, but there is no timestamped
Supabase copy under `supabase/migrations` at the time this analysis was written.
That means it is safe as a direct `psql` migration, but not yet fully represented
in the Supabase CLI production stream.

The rollback strategy is layered:

1. Prefer feature/data rollback first. For Beacons, flip
   `FeatureFlag.audience_profile` back off.
2. Roll back application code using the backend Docker image rollback workflow.
3. Only perform hard database rollback when necessary, and only with an explicit
   reverse plan, backup table, or point-in-time restore.

For migration `148`, rollback is intentionally simple because it is data-only:
it updates one feature flag row. The kill switch is either the database feature
flag or the coarser runtime environment gates:

```text
IDENTITY_FIREWALL_ENABLED=false
PERSONA_ENABLED=false
PERSONA_BROADCAST_ENABLED=false
```

The database flag is a fast partial disable. The environment flags are the full
feature shutdown because they prevent the Beacon routers from mounting at all.

## Repository Evidence

These are the important files and what they prove:

| File | Why It Matters |
|---|---|
| `backend/database/schema.sql` | Its header says it is a frozen snapshot, not the source of truth, and not applied by a runner. |
| `backend/database/migrations/135_feature_flag.sql` | Creates `FeatureFlag`, seeds `audience_profile` default off, and documents beta/internal rollout. |
| `backend/database/migrations/148_enable_beacons_by_default.sql` | Flips `audience_profile.enabled_globally` to true. It is data-only and idempotent. |
| `supabase/migrations` | Timestamped Supabase-compatible deployment stream. |
| `docs/phase-0-deployment-runbook.md` | Documents applying backend-numbered migrations directly with `psql`, and notes Supabase CLI uses timestamped copies. |
| `backend/services/featureFlagService.js` | Implements DB-backed feature flag evaluation, cache, beta cohort, internal-team tier, and admin invalidation. |
| `backend/utils/featureFlags.js` | Implements environment-level gates for Identity Firewall, Persona, and Persona Broadcast. |
| `backend/app.js` | Mounts identity and persona routers only when environment gates are enabled. |
| `backend/scripts/ci/run-privacy-gates.js` | Orchestrates privacy gates before rollout. |
| `backend/scripts/identity-firewall-migration-smoke.js` | Read-only live schema smoke test for the identity migration set. |
| `.github/workflows/rollback-backend.yml` | Application-level rollback mechanism for backend images. |

## Question 1: Why Are There Two Migration Systems?

### Direct Interview Answer

There are two migration directories because the project has two migration
consumers:

- Backend engineers need a human-readable, sequential feature history.
- Supabase CLI needs timestamped migration filenames for deployment ordering.

`backend/database/migrations` gives us filenames like:

```text
135_feature_flag.sql
136_persona_tier_and_membership_extension.sql
...
148_enable_beacons_by_default.sql
```

Those are easy to discuss in engineering review: "migration 135 created the
flag table", "migration 148 flips the rollout flag", "migration 132 collapsed
PersonaFollow into PersonaMembership".

`supabase/migrations` gives us filenames like:

```text
20260508000004_feature_flag.sql
20260511000001_unified_audience_identity.sql
20260511000002_persona_membership_seen_mute.sql
```

That is the convention Supabase CLI uses for ordered deployment.

The intended model is not "two independent systems". The intended model is
"one logical migration stream with two filename schemes".

### Why This Can Be Reasonable

This is a pragmatic compromise during rapid product development:

- The backend migration numbers are stable references in docs, PRs, runbooks,
  and tests.
- Supabase timestamps support `supabase db push`, local resets, hosted
  Supabase workflows, and Supabase migration ledger compatibility.
- Direct `psql` application is still available for emergency or highly
  controlled rollout.

This model is common in teams that started with manual backend SQL migrations
and later adopted Supabase CLI. The important engineering discipline is to
avoid letting the two directories diverge semantically.

### The Risk

The risk is split-brain migration history:

- A backend migration exists but Supabase CLI never applies it.
- A Supabase migration exists but backend docs/tests do not know about it.
- Files with the same logical name differ in SQL content.
- Numeric ordering and timestamp ordering disagree.
- A migration has been applied manually in production but not recorded in the
  Supabase migration ledger.

Once any of those happen, the codebase no longer has an authoritative migration
history. Debugging then becomes "what happened to this particular database?"
instead of "what migrations define this product state?"

### Current Repo Reality

The repo already acknowledges the dual structure in `backend/database/schema.sql`
and the phase-0 runbook. The schema snapshot header says runnable migrations
live under both directories, but also says the snapshot is not applied by a
runner.

The phase-0 runbook says the backend-numbered files can be applied directly via
`psql`, and that timestamped files in `supabase/migrations` are the Supabase
CLI copies.

The current gap is migration `148_enable_beacons_by_default.sql`: it exists in
`backend/database/migrations`, but not as a timestamped file under
`supabase/migrations`. If production deploys through Supabase CLI, that is a
real deployment gap. The immediate fix is to add the corresponding Supabase
timestamped migration and then add CI checks so this cannot recur.

## Question 2: Which Directory Is The Source Of Truth For Production Schema?

### Direct Interview Answer

For production deploys, `supabase/migrations` should be treated as the source of
truth for the ordered migration stream because hosted Supabase production is
managed by the Supabase migration ledger.

More precisely, production truth has three layers:

1. The live production database schema is the ultimate runtime truth.
2. The Supabase migration ledger plus `supabase/migrations` is the deployable
   history that should reproduce that schema.
3. Backend smoke tests and runbooks verify that production actually matches the
   expected shape.

`backend/database/schema.sql` is not source of truth. It says so explicitly.
It is a generated snapshot for orientation, not a migration runner input.

### Why Not `backend/database/schema.sql`?

`schema.sql` is useful, but dangerous if treated as authoritative. It can lag
behind migrations, and in this repository it explicitly does. Its header notes
that phase-0 audience-profile migrations added tables and columns not reflected
in the snapshot.

That is a major signal: a static schema dump is useful for grep, onboarding,
and broad architecture review, but it cannot be the production migration source
unless it is regenerated as part of a strict release process.

### Why Not `backend/database/migrations` Alone?

The backend migration directory is readable and operationally useful, but it is
not what Supabase CLI uses to calculate migration state. If production is
hosted Supabase and deployment is done with `supabase db push`, the timestamped
directory must be complete.

Direct `psql` application from `backend/database/migrations` is acceptable only
when the operator has a specific runbook and also reconciles the production
migration ledger afterward.

### Production Source Of Truth Policy

The policy I would enforce:

- New production migration must have a file under `supabase/migrations`.
- If backend-numbered migrations remain, the corresponding backend file must
  either match byte-for-byte or explicitly be marked as a documentation/direct
  apply wrapper.
- `schema.sql` can be regenerated after a release, but it cannot be the release
  mechanism.
- Live production verification must be done with smoke tests, not by assuming
  checked-in files were applied.

## Question 3: How Do You Guarantee Migration Ordering Across The Two Systems?

### Direct Interview Answer

Ordering must be guaranteed by treating the two directories as mirrors of one
logical sequence, then enforcing the mapping in CI.

The intended ordering rule is:

- `backend/database/migrations/NNN_name.sql` orders by `NNN`.
- `supabase/migrations/YYYYMMDDHHMMSS_name.sql` orders by timestamp.
- For every logical migration `name`, its backend sequence position must match
  its Supabase timestamp position.

The repository currently relies too much on convention and runbook discipline.
I would harden it with automated checks.

### Concrete CI Guardrail

I would add a script that:

1. Lists backend migration basenames with numeric prefix removed.
2. Lists Supabase migration basenames with timestamp prefix removed.
3. Flags backend-only migrations, unless allowlisted.
4. Flags Supabase-only migrations, unless allowlisted.
5. For paired files, compares file checksums.
6. Verifies sorted backend order and sorted Supabase order produce the same
   logical sequence for paired migrations.
7. Flags duplicate timestamps in Supabase.
8. Flags duplicate numeric prefixes in backend.
9. Flags non-idempotent patterns in known "must be rerunnable" migration
   windows.
10. Flags destructive operations without an inline rollback note or linked
    runbook.

Pseudo-code:

```bash
backend_names=$(
  find backend/database/migrations -maxdepth 1 -name '*.sql' \
    -exec basename {} \; | sed -E 's/^[0-9]+_//'
)

supabase_names=$(
  find supabase/migrations -maxdepth 1 -name '*.sql' \
    -exec basename {} \; | sed -E 's/^[0-9]{14}_//'
)

comm -23 <(printf '%s\n' "$backend_names" | sort) \
         <(printf '%s\n' "$supabase_names" | sort)

comm -13 <(printf '%s\n' "$backend_names" | sort) \
         <(printf '%s\n' "$supabase_names" | sort)
```

For matching names, use `cmp` or `sha256sum` to detect content drift.

### Why Ordering Matters More Than It Looks

Postgres migrations are not independent when they touch:

- enum values
- check constraints
- views
- RLS policies
- generated functions
- columns that app code immediately reads
- backfilled data with constraints applied afterward
- trigger dependencies
- indexes needed for new queries

For example:

- `FeatureFlag` must exist before `148_enable_beacons_by_default.sql` can upsert
  the `audience_profile` row.
- `PersonaMembership` must exist before tier, DM, quota, and audience identity
  migrations reference it.
- `PersonaTier` must exist before tier-rank-aware broadcast reads can be fully
  enforced.
- `AudienceIdentity` backfills depend on both `PersonaMembership` and
  `PublicPersona`.

So ordering is not cosmetic. It is a correctness requirement.

### How I Would Explain This In An Interview

I would say:

> I do not want production ordering to be a social contract. I want it to be a
> CI-enforced invariant. The backend-numbered files are excellent for humans,
> but Supabase timestamps are what production automation consumes. Therefore
> every migration PR must prove the two views of the migration stream are
> synchronized before it can merge.

## Question 4: What Is The Rollback Strategy For A Bad Migration?

### Direct Interview Answer

Rollback depends on the type of migration. I classify migrations into four
categories:

1. Data-only flag/config migration.
2. Additive schema migration.
3. Backfill or data transformation.
4. Destructive schema migration.

Each class has a different rollback strategy.

### Class 1: Data-Only Flag Or Config Migration

Migration `148_enable_beacons_by_default.sql` is this kind. It only upserts
`FeatureFlag.audience_profile` and sets `enabled_globally = true`.

Rollback is a forward data update:

```sql
UPDATE "public"."FeatureFlag"
SET
  "enabled_globally" = false,
  "enabled_for_internal_team" = false,
  "beta_user_ids" = ARRAY[]::uuid[],
  "updated_at" = now()
WHERE "flag_name" = 'audience_profile';
```

Or through the admin API:

```bash
curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled_globally": false, "enabled_for_internal_team": false, "beta_user_ids": []}' \
  "$API/api/admin/feature-flags/audience_profile"
```

This is the best kind of rollout migration because rollback does not require
undoing schema.

### Class 2: Additive Schema Migration

Examples:

- Add nullable column.
- Add new table with no old-code dependency.
- Add index.
- Add optional relation.
- Add new RLS-safe view.

Rollback is usually not dropping the schema. It is:

1. Disable the code path or feature flag.
2. Roll back application code if needed.
3. Leave additive schema in place until the next cleanup window.

This avoids making rollback worse than the incident. Dropping harmless additive
schema can break code that already started writing to it or can erase forensic
data needed to understand the failure.

### Class 3: Backfill Or Data Transformation

Examples:

- Backfill display names.
- Collapse per-Beacon fan handles into unified `AudienceIdentity`.
- Migrate published broadcasts into `Post`.

Rollback requires more care because data may have been transformed. The safe
patterns are:

- Snapshot affected rows into an audit table before mutation.
- Make the migration idempotent.
- Preserve old columns through at least one rollout window.
- Use application compatibility code during the transition.
- Verify row counts and semantic invariants after migration.
- Prefer a forward corrective migration over reverse mutation when users may
  have edited data after the migration.

Migration `133_local_profile_display_name_username_default.sql` is a good
pattern because it creates a snapshot table before the display-name update.
Migration `146_local_profile_display_name_name_backfill.sql` similarly stores
previous and new values in a backfill audit table before updating local
profiles.

### Class 4: Destructive Schema Migration

Examples:

- Drop table.
- Drop column.
- Drop function used by old code.
- Tighten `NOT NULL`.
- Replace a table with a view.
- Remove an enum/check value old clients may still send.

Rollback must be explicit before merge.

The playbook:

1. Confirm no deployed code path still reads or writes the old object.
2. Confirm no mobile version in the wild still depends on it.
3. Add compatibility shims where possible.
4. Create backup table before destructive operation if data is valuable.
5. Run production-clone validation.
6. Deploy code that no longer depends on old object.
7. Wait one rollout window.
8. Drop in a later migration.
9. If rollback is needed after drop, restore from backup table or PITR.

Migration `132_collapse_persona_follow_into_membership.sql` uses a safer
destructive pattern:

- It creates `PersonaFollow_pre_migration_backup`.
- It creates the new canonical `PersonaMembership` table.
- It migrates data.
- It drops the old `PersonaFollow` table.
- It recreates `PersonaFollow` as a compatibility view.

That view is the key compatibility contract. Old read paths can keep asking for
`PersonaFollow` while new writes move to `PersonaMembership`.

### Application Rollback

The backend rollback mechanism is image-based. The workflow
`.github/workflows/rollback-backend.yml` lets an operator redeploy a previous
Docker image tag to staging or production.

Important distinction:

- Application rollback is fast and safe if schema is backward-compatible.
- Application rollback is dangerous if the schema migration removed objects the
  old app needs.

That is why destructive migration review is really backward-compatibility
review.

## Question 5: How Are Destructive Migrations Reviewed?

### Direct Interview Answer

I review destructive migrations as production incidents in advance. The
question is not "does this SQL run?" The question is "can every currently
deployed client and backend version survive before, during, and after this
change?"

### Destructive Migration Checklist

Every destructive migration should answer:

1. What deployed code path still references this object?
2. What mobile or web clients may still send the old shape?
3. Is the operation actually required now, or can we deprecate first?
4. Is there a compatibility view, alias, or trigger?
5. Is there a backup table?
6. Is there a point-in-time restore plan?
7. What is the expected row count before and after?
8. What privacy or authorization semantics change?
9. Does RLS still fail closed?
10. Does service-role access bypass RLS intentionally?
11. Are grants preserved or intentionally changed?
12. What locks will Postgres take?
13. Could the migration rewrite a large table?
14. Is the migration inside a transaction when safe?
15. Does the app tolerate partial migration failure?
16. Is the migration idempotent?
17. Is there a smoke test that proves the new schema shape?
18. Is there a feature flag or env kill switch?
19. Is there a runbook?
20. Is the rollback path tested?

### Patterns That Require Extra Review

I would require a stronger review for:

- `DROP TABLE`
- `DROP COLUMN`
- `DROP FUNCTION`
- `DROP VIEW`
- `ALTER COLUMN SET NOT NULL`
- `ALTER TABLE ... ADD CONSTRAINT` on hot tables
- replacing RLS policies
- changing public RPC functions
- enum changes
- large `UPDATE` statements without batching
- backfills that join `User` private fields into public-profile data
- migrations that modify identity, privacy, payments, home ownership, or
  notification visibility

### Example: `remove_user_follow`

`supabase/migrations/20260510000001_remove_user_follow.sql` is a destructive
migration. It:

- migrates old post visibility values
- replaces an RLS policy
- drops old feed RPCs
- drops the `sync_followers_count` trigger/function
- drops `UserFollow`
- drops `User.followers_count`
- drops `UserFeedPreference.show_politics_following`

That is not a small schema cleanup. It touches social graph semantics, feed
visibility, denormalized counts, and old RPCs. It deserves a compatibility
review and production-clone testing.

The later backend migration `147_restore_user_follow_profile.sql` recreates the
personal follower graph. That is a useful lesson: destructive migrations are
often semantically risky even when the SQL is syntactically correct. Product
semantics can outlive a code path.

### Review Output I Expect

For destructive migrations, I want the PR to include a table like this:

| Concern | Answer |
|---|---|
| Object being removed | `UserFollow` |
| Last known reader | none in main backend after commit X |
| Mobile clients affected | version Y and older do not call this route |
| Compatibility shim | none, because route removed and feed no longer uses RPC |
| Backup | PITR or explicit backup table |
| Rollback | restore table from backup or apply forward recreate migration |
| Smoke | feed visibility, profile pages, follower counts |
| Kill switch | feature/env flag if applicable |

## Question 6: How Do You Test Migrations Against Realistic Production Data Volume?

### Direct Interview Answer

There are three levels of migration testing:

1. Syntax and unit tests against mocks.
2. Real Postgres integration tests.
3. Production-volume rehearsal on an anonymized clone or staging restore.

This repository currently has strong levels 1 and 2 for identity behavior, and
it has migration smoke scripts. For truly realistic production volume, I would
add a repeatable production-clone rehearsal step before high-risk migrations.

### What Exists Today

The repo has:

- unit tests using the in-memory Supabase mock
- integration test config that can run against a real Supabase instance
- identity migration smoke script using direct Postgres access
- phase-0 runbook with preflight and post-migration SQL checks
- privacy gate orchestrator
- backend image rollback workflow

The integration config explicitly says it does not use mocks when configured
with real Supabase env vars.

### What I Would Add For Production-Volume Testing

For high-risk migrations, I would run this process:

1. Restore a recent production snapshot into an isolated staging database.
2. Anonymize private data if the environment is not locked down.
3. Capture table cardinalities and relation sizes.
4. Run preflight smoke.
5. Apply migrations using the exact production method.
6. Measure wall time, lock waits, deadlocks, row counts, and errors.
7. Run post-migration smoke.
8. Run application integration tests against that database.
9. Run privacy gates.
10. Run representative read/write traffic.
11. Compare query plans before and after.
12. Record rollback timing.

### Metrics To Capture

At minimum:

```sql
SELECT relname, n_live_tup, n_dead_tup
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;
```

```sql
SELECT
  schemaname,
  relname,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
```

While the migration runs:

```sql
SELECT
  pid,
  state,
  wait_event_type,
  wait_event,
  query
FROM pg_stat_activity
WHERE datname = current_database();
```

For lock analysis:

```sql
SELECT
  locktype,
  relation::regclass,
  mode,
  granted,
  pid
FROM pg_locks
WHERE relation IS NOT NULL;
```

For changed hot queries:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT ...
```

### How To Test Backfills

Large backfills must answer:

- How many rows are touched?
- Does the statement rewrite the table?
- Does it take an exclusive lock?
- Can it be batched?
- Is it resumable?
- Does it preserve rows inserted during rollout?
- Is the target constraint applied only after data is clean?

For example, a safe pattern is:

1. Add nullable column.
2. Deploy code that writes both old and new columns.
3. Backfill in batches.
4. Verify completeness.
5. Add constraint as `NOT VALID` where possible.
6. Validate constraint.
7. Deploy code that reads new column.
8. Remove old column in a later release.

### How To Test Beacons Specifically

For Beacons, realistic data testing should include:

- many `PublicPersona` rows
- many `PersonaMembership` rows per persona
- high-follower personas
- many `Post` rows with `identity_context_type = 'persona'`
- tier-gated posts
- old `BroadcastMessage` rows migrated into `Post`
- blocked fans
- pending follow requests
- paid memberships
- expired/canceled memberships
- users with both Local Profile and Beacon
- users with bridge settings enabled and disabled
- users with privacy settings restricting search

Then test:

- feed queries
- public Beacon pages
- "Beacons You Follow"
- membership stats
- DM thread list
- notification fanout
- identity search
- privacy preview
- owner moderation
- feature flag checks

The critical thing is not just row count. It is skew. One creator with 100,000
members is a different database problem than 100,000 creators with one member.

## Question 7: What Schema Changes Are Backwards-Compatible With The Currently Deployed Backend?

### Direct Interview Answer

Backward-compatible schema changes are changes that both the old deployed code
and the new code can tolerate during a rolling deploy or rollback.

Generally safe:

- create new table
- add nullable column
- add column with safe default when it does not rewrite a hot table badly
- add index concurrently where needed
- add RLS-safe view
- add function with new name
- add enum value if old code ignores it
- add optional foreign key where existing data is valid
- expand check constraint to allow more values
- seed a feature flag default off
- data-only update behind a kill switch

Generally unsafe:

- drop table
- drop column
- rename table or column
- tighten check constraint
- make column `NOT NULL`
- change column type in place
- remove enum/check value old clients may send
- replace a function signature old code calls
- change RLS policy in a way old code cannot satisfy
- revoke grants old runtime depends on
- add a trigger that changes write semantics old code assumes
- enable a feature globally without disabling controls

### Backward-Compatible Pattern For Additive Features

The ideal sequence:

1. Add schema, default hidden.
2. Deploy code that can read/write both old and new.
3. Backfill data.
4. Verify.
5. Flip feature flag for internal users.
6. Expand beta cohort.
7. Flip global.
8. Remove old schema later.

That is exactly the philosophy behind `FeatureFlag`:

- Migration 135 creates the flag and seeds `audience_profile` off.
- Later code paths check the flag.
- Migration 148 flips the feature globally only after the system is ready.

### Specific Current Backend Compatibility

The current backend expects the audience-profile schema to exist if persona
routes are enabled:

- `FeatureFlag`
- `LocalProfile`
- `PublicPersona`
- `PersonaMembership`
- `PersonaTier`
- `AudienceIdentity`
- `IdentityBridgeSetting`
- `BroadcastChannel`
- `BroadcastMessage`
- `PersonaBlock`
- `PersonaDmThread`
- `PersonaDmMessage`
- `PersonaQuotaUsage`

However, environment gates can keep these routers from mounting:

- `IDENTITY_FIREWALL_ENABLED`
- `PERSONA_ENABLED`
- `PERSONA_BROADCAST_ENABLED`

That means schema changes to Beacon tables are backward-compatible if:

- the old backend does not need to read missing new columns, or
- the routers are disabled, or
- the code has defensive fallbacks.

### Compatibility Examples From The Repo

`145_persona_membership_seen_mute.sql` is backward-compatible because it adds
nullable columns:

- `last_seen_at`
- `muted_until`

The route falls back to `joined_at` when `last_seen_at` is null. That avoids a
slow hot-table backfill and makes old rows safe.

`144_unified_audience_identity.sql` is more complex. It adds a new
`AudienceIdentity` table, adds `audience_identity_id` to `PersonaMembership`,
backfills, and updates snapshot columns. It is mostly additive, but because it
updates existing membership rows, it must have strong smoke checks and privacy
tests.

`136_persona_tier_and_membership_extension.sql` is more risky because it
eventually sets `PersonaMembership.tier_id` to `NOT NULL`. It is safe only
because it first creates tiers, backfills every membership to rank-1, and then
adds the constraint.

## Question 8: Why Does Migration 148 Flip `audience_profile` Globally?

### Direct Interview Answer

Migration `148_enable_beacons_by_default.sql` flips `audience_profile` globally
because Beacons have graduated from beta/internal rollout to normal shipped app
behavior.

The migration is intentionally data-only:

```sql
INSERT INTO "public"."FeatureFlag" (
  "flag_name",
  "description",
  "enabled_globally"
)
VALUES (
  'audience_profile',
  'Beacon / audience profile feature.',
  true
)
ON CONFLICT ("flag_name") DO UPDATE
SET
  "enabled_globally" = true,
  "updated_at" = now();
```

This is the right shape for a global rollout because it is:

- idempotent
- reversible with a single update
- isolated to feature access
- not a schema mutation
- compatible with admin flag updates
- compatible with environment kill switches

### Why This Is Separate From Migration 135

Migration 135 created the `FeatureFlag` table and seeded `audience_profile`
off. Its comments say the feature should ship behind a flag, default off in
production for the initial rollout, with beta cohort and internal-team
enablement.

Migration 148 is the graduation point:

- 135: create gate, default off
- rollout: internal users and beta cohorts
- 148: enable as normal app feature

That separation is important. We do not want schema creation to automatically
turn on user-visible surfaces. We want schema first, code second, beta third,
global flip last.

### Why Use A Migration Instead Of Manual Admin Toggle?

Using a migration for the final flip gives us:

- code-reviewed rollout intent
- auditability in git
- repeatability across environments
- idempotence
- a single source for new environments
- a clear release marker

Manual admin toggles are useful for emergency operations and beta cohorts. A
global product-state change should be checked into source control.

### Current Concern

At the time this document was written, `148_enable_beacons_by_default.sql` exists
only under `backend/database/migrations`. If production uses Supabase CLI, we
need a timestamped copy under `supabase/migrations`. Otherwise the global flip
is not part of the Supabase migration stream.

## Question 9: What Criteria Made Beacons Safe To Enable By Default?

### Direct Interview Answer

Beacons were safe to enable by default only after the product had a defensible
identity firewall:

- personal identity and audience identity are separate
- bridges are off by default
- serializers prevent raw private `User` fields from leaking
- Beacon follow/membership is separate from local/personal relationships
- persona posts use explicit identity context
- fan identity is represented by audience-side handles
- public routes avoid owner/fan `user_id` leakage
- feature-flagged routes fail closed with 404
- runtime env gates can disable the whole subsystem
- privacy gates and integration tests cover the main cross-context risks

### Safety Criterion 1: Separate Storage Models

The system separates:

- private account identity: `User`
- local/neighborhood identity: `LocalProfile`
- public audience identity: `PublicPersona`
- fan-side audience identity: `AudienceIdentity`
- membership relationship: `PersonaMembership`
- explicit bridge settings: `IdentityBridgeSetting`

That matters because the most dangerous failure mode is accidentally using the
private `User` row as the public identity.

### Safety Criterion 2: Bridges Off By Default

A Local Profile and a Beacon do not automatically point at each other. Bridge
settings default off:

- `show_persona_on_local = false`
- `show_local_on_persona = false`

This means a neighbor, friend, or household member cannot infer a user's Beacon
unless the user explicitly enables the bridge.

### Safety Criterion 3: Context-Specific Serializers

Public response shapes must use serializers that know the viewing context.

For Beacons, a public viewer should see:

- Beacon handle
- Beacon display name
- Beacon avatar/banner
- public links
- follower/member count where allowed
- public or authorized posts

They should not see:

- private user id
- email
- phone
- legal name
- exact address
- home identity
- private local profile fields
- private relationship graph

The privacy tests assert this.

### Safety Criterion 4: Separate Graphs

The system separates:

- personal/local relationship graph
- Beacon/fan membership graph
- home/household graph
- business seat graph

This prevents "followed my Beacon" from meaning "knows where I live" or "can
see my neighborhood identity".

### Safety Criterion 5: Persona Posts Have Explicit Identity Context

Posts have identity fields:

- `author_user_id`
- `identity_context_type`
- `identity_context_id`

Beacon posts are not just ordinary posts with a different label. They are
explicitly tagged as persona-context posts. That lets feed and visibility logic
branch by graph.

### Safety Criterion 6: Privacy Gates In CI

The repo includes a privacy gate runner that checks:

- serializer forbidden keys
- notification context firewall
- legacy identity alias patterns
- raw personal-identity selects
- nested User selects
- end-to-end audience-profile invariants

The raw-select guard is especially important. It scans backend routes/services
for patterns that select personal `User` fields into audience-side code.

### Safety Criterion 7: Feature Flags And Env Gates

There are two levels:

- DB-level per-user flag: `FeatureFlag.audience_profile`
- runtime environment gates: `IDENTITY_FIREWALL_ENABLED`,
  `PERSONA_ENABLED`, `PERSONA_BROADCAST_ENABLED`

The DB flag controls user access for many routes. The env gates control router
mounting and are stronger.

### Safety Criterion 8: Backward-Compatible Public Behavior

The system preserves public read compatibility where needed:

- compatibility views
- fallback route behavior
- legacy follow path still supported for old clients
- public tier route intentionally not gated where discovery requires it
- feature-disabled routes return 404 rather than exposing a disabled feature

### Safety Criterion 9: Operational Smoke

The migration smoke script verifies required tables, columns, views, RLS, enum
values, and grants. The phase runbook adds manual product smoke:

- web feed
- marketplace
- Beacon/local profile pages
- mobile feed
- mobile marketplace
- comment threads
- privacy gate pass

### Safety Criterion 10: Known Residual Risks Are Kill-Switchable

No system is perfectly safe. The reason it can be enabled by default is that the
remaining major risks have operational controls:

- privacy issue: disable DB flag or env gates
- load issue: disable broadcast/persona gates
- UX issue: disable web/mobile public flags or DB flag
- payment issue: disable paid membership env/public feature flag
- category compliance issue: sensitive categories are env-gated separately

## Question 10: What Is The Kill Switch If Migration 148 Causes Privacy, Load, Or UX Issues?

### Direct Interview Answer

There are two kill switches:

1. A fast DB-level feature flag rollback.
2. A stronger runtime environment shutdown.

For most UX or scoped rollout issues, flip the DB flag off:

```sql
UPDATE "public"."FeatureFlag"
SET
  "enabled_globally" = false,
  "enabled_for_internal_team" = false,
  "beta_user_ids" = ARRAY[]::uuid[],
  "updated_at" = now()
WHERE "flag_name" = 'audience_profile';
```

For privacy, load, or systemic issues, set runtime flags and redeploy/restart:

```text
IDENTITY_FIREWALL_ENABLED=false
PERSONA_ENABLED=false
PERSONA_BROADCAST_ENABLED=false
```

If the issue is specifically broadcast load:

```text
PERSONA_BROADCAST_ENABLED=false
```

If the issue is all Beacon routes:

```text
PERSONA_ENABLED=false
```

If the issue is broader identity firewall behavior:

```text
IDENTITY_FIREWALL_ENABLED=false
```

### Why The Env Kill Switch Is Stronger

The DB flag is evaluated inside protected routes. But some public/discovery
surfaces are intentionally controlled by environment-level persona gates rather
than by the per-user DB flag. For example:

- app router mounting depends on `isPersonaEnabled()`
- broadcast router mounting depends on `isPersonaBroadcastEnabled()`
- identity search includes public profiles only if persona is enabled

Therefore, if the incident is severe, use environment gates.

### Kill Switch Propagation

DB flag propagation:

- feature flag service caches values for 60 seconds
- admin update invalidates local process cache
- direct SQL update may wait for cache TTL unless processes are restarted or
  invalidation path is used

Env flag propagation:

- requires redeploy or process restart
- prevents routers from mounting on startup
- stronger blast-radius reduction

### Incident Playbook

If migration 148 causes an incident:

1. Identify category:
   - privacy
   - load
   - UX
   - payments
   - search/discovery
   - mobile/web only
2. For privacy: immediately set environment kill switch and redeploy/restart.
3. For load: disable `PERSONA_BROADCAST_ENABLED` first if broadcast-specific,
   otherwise disable `PERSONA_ENABLED`.
4. For UX: flip `audience_profile` DB flag off and public web/mobile flags off.
5. Roll back backend image if code behavior is the source.
6. Keep schema in place unless schema itself is corrupting data.
7. Run privacy gates and smoke tests before re-enabling.
8. Re-enable only for internal users, then beta, then global.

### SQL Rollback For Migration 148

Minimum rollback:

```sql
UPDATE "public"."FeatureFlag"
SET "enabled_globally" = false,
    "updated_at" = now()
WHERE "flag_name" = 'audience_profile';
```

Full cohort reset:

```sql
UPDATE "public"."FeatureFlag"
SET "enabled_globally" = false,
    "enabled_for_internal_team" = false,
    "beta_user_ids" = ARRAY[]::uuid[],
    "updated_at" = now()
WHERE "flag_name" = 'audience_profile';
```

Partial rollback to internal-only:

```sql
UPDATE "public"."FeatureFlag"
SET "enabled_globally" = false,
    "enabled_for_internal_team" = true,
    "beta_user_ids" = ARRAY[]::uuid[],
    "updated_at" = now()
WHERE "flag_name" = 'audience_profile';
```

## Migration 148 Specific Review

### What It Does

`148_enable_beacons_by_default.sql`:

- inserts `FeatureFlag(flag_name = 'audience_profile')` if missing
- sets `enabled_globally = true`
- updates `updated_at`
- is idempotent through `ON CONFLICT`

### What It Does Not Do

It does not:

- create tables
- drop tables
- alter constraints
- backfill user data
- change RLS
- change grants
- rewrite hot tables
- create indexes
- migrate posts
- touch private identity rows

This is operationally good. It means rollout and rollback are both data-level
operations.

### Why It Still Requires Serious Review

Even data-only feature flag changes can be high impact because they expose
existing code paths to all users.

The review must answer:

- Are all exposed routes privacy safe?
- Are all exposed pages UX-ready?
- Are query paths indexed?
- Are public and authenticated surfaces appropriately separated?
- Are mobile and web clients consistent?
- Are notification counts correct?
- Are hidden/beta routes now exposed accidentally?
- Are payment-related Beacon features separately gated?
- Is there an immediate rollback path?

### Required Fix Before Supabase Production

Add a Supabase migration twin, for example:

```text
supabase/migrations/YYYYMMDDHHMMSS_enable_beacons_by_default.sql
```

with the same SQL content.

Then add the pairing CI guard. This prevents global rollout from depending on
manual direct `psql` execution while the rest of production uses Supabase CLI.

## Recommended Migration Governance Improvements

### 1. Add Migration Pair Check

Create a CI script:

```text
backend/scripts/ci/check-migration-pairs.js
```

Responsibilities:

- compare backend logical names with Supabase logical names
- check content equality for paired migrations
- allowlist known historical divergence with explicit comments
- fail on missing `148` Supabase twin
- fail on duplicate prefixes/timestamps

### 2. Add Destructive Migration Linter

Scan SQL for:

```text
DROP TABLE
DROP COLUMN
DROP FUNCTION
DROP VIEW
TRUNCATE
DELETE FROM
ALTER COLUMN ... SET NOT NULL
DROP POLICY
REVOKE
```

For each match, require one of:

- `-- rollback: ...`
- `-- destructive-reviewed: ...`
- linked runbook
- allowlist entry

### 3. Add Production-Clone Rehearsal Checklist

For high-risk migrations, require evidence:

- production clone created
- anonymization completed
- migration runtime recorded
- lock waits reviewed
- row counts verified
- smoke passed
- privacy gates passed
- rollback tested

### 4. Add Schema Drift Detection

After production migration:

```bash
pg_dump --schema-only --no-owner --no-privileges --no-publications \
  --no-subscriptions "$DATABASE_URL" > /tmp/prod-schema.sql
```

Compare against expected generated schema or a controlled snapshot.

Do not blindly commit every diff, but review drift intentionally.

### 5. Make `schema.sql` Regeneration Explicit

`backend/database/schema.sql` currently warns it is stale. Either:

- regenerate it after successful migration batches, or
- stop using it in architecture docs as a current schema source.

If it remains in the repo, CI can check that its header date or generation hash
matches the latest applied migration batch.

## Strong Interview Framing

If asked these questions in an interview, I would frame the answer like this:

> I inherited or built a system with two migration directories because one is
> optimized for backend engineering review and one is optimized for Supabase
> deployment. That can be fine, but only if we treat them as two views of one
> migration stream. The production source of truth is the Supabase migration
> stream and the live database ledger, not a stale schema dump. The main risk is
> drift, and I would eliminate that with CI checks for pairing, ordering, and
> checksum equality.
>
> For rollback, I do not pretend every migration has a clean down migration.
> PostgreSQL production rollback is usually a forward recovery operation. For
> additive schema, leave schema in place and roll back code. For data-only
> rollout flags like migration 148, flip the flag back. For destructive
> migrations, require a backup table, compatibility view, or PITR plan before
> merge.
>
> Beacons were safe to enable globally only because the identity firewall exists:
> separate local and audience identities, bridges off by default, context-specific
> serializers, raw personal field guards, integration tests, privacy gates, and
> both DB and environment kill switches. The global flip is intentionally
> data-only so we can undo it in seconds without mutating schema.

## One-Minute Answer

If time is short:

> The two directories exist because backend engineering uses numbered migrations
> for review and runbooks, while Supabase CLI uses timestamped migrations for
> deployment. Production should be driven by `supabase/migrations` plus the live
> Supabase migration ledger. `schema.sql` is only a snapshot and explicitly says
> it is not a source of truth.
>
> The safety rule is that the two directories must be mirrors of one logical
> migration stream. Today I would add CI checks for missing twins, checksum
> drift, duplicate order keys, and destructive SQL. Rollback is layered: feature
> flag first, code image rollback second, hard DB rollback only with backup/PITR.
>
> Migration 148 flips Beacons globally because the feature graduated from beta.
> It is data-only and reversible. If it causes trouble, turn off
> `FeatureFlag.audience_profile` or, for a severe incident, set
> `IDENTITY_FIREWALL_ENABLED=false`, `PERSONA_ENABLED=false`, or
> `PERSONA_BROADCAST_ENABLED=false` and redeploy.

## Appendix A: Commands I Would Run During A Migration Review

List migration files:

```bash
find backend/database/migrations -maxdepth 1 -type f -name '*.sql' | sort -V
find supabase/migrations -maxdepth 1 -type f -name '*.sql' | sort
```

Find backend migrations without Supabase twins:

```bash
comm -23 \
  <(find backend/database/migrations -maxdepth 1 -type f -name '*.sql' \
      -exec basename {} \; | sed -E 's/^[0-9]+_//' | sort) \
  <(find supabase/migrations -maxdepth 1 -type f -name '*.sql' \
      -exec basename {} \; | sed -E 's/^[0-9]{14}_//' | sort)
```

Find Supabase migrations without backend twins:

```bash
comm -13 \
  <(find backend/database/migrations -maxdepth 1 -type f -name '*.sql' \
      -exec basename {} \; | sed -E 's/^[0-9]+_//' | sort) \
  <(find supabase/migrations -maxdepth 1 -type f -name '*.sql' \
      -exec basename {} \; | sed -E 's/^[0-9]{14}_//' | sort)
```

Search for destructive SQL:

```bash
rg -n "DROP TABLE|DROP COLUMN|DROP VIEW|DROP FUNCTION|DELETE FROM|TRUNCATE|ALTER TABLE.*DROP|DROP POLICY" \
  backend/database/migrations supabase/migrations -g '*.sql'
```

Run identity migration smoke:

```bash
cd backend
pnpm run smoke:identity-firewall:preflight
pnpm run smoke:identity-firewall
pnpm run smoke:identity-firewall -- --both --json
```

Run privacy gates:

```bash
cd backend
pnpm run test:privacy
```

Run backend tests:

```bash
cd backend
pnpm test
```

Run real-Supabase integration tests when env vars are configured:

```bash
cd backend
pnpm test:integration
```

## Appendix B: Migration Classes And Rollback Matrix

| Migration Type | Example | Risk | Rollback |
|---|---|---:|---|
| Feature flag data update | `148_enable_beacons_by_default.sql` | Low schema risk, high product exposure | Update flag back off |
| Add nullable column | `145_persona_membership_seen_mute.sql` | Low | Leave schema, disable code path |
| Create new table | `FeatureFlag`, `PersonaTier` | Low to medium | Leave table unless corrupting behavior |
| Backfill | `AudienceIdentity` backfill | Medium | Use audit table/forward fix |
| Constraint tightening | `tier_id SET NOT NULL` | Medium to high | Requires verified backfill before apply |
| Table replacement with view | `PersonaFollow` to `PersonaMembership` | High | Backup table + compatibility view |
| Drop table/column | `remove_user_follow` | High | Restore backup/PITR or forward recreate |
| RLS rewrite | identity safe views | High privacy impact | Feature disable + policy fix |

## Appendix C: Beacons Risk Matrix

| Risk | Severity | Control |
|---|---:|---|
| Private identity leaks into Beacon response | Critical | serializers, forbidden-key tests, raw select guards |
| Local profile and Beacon linked unexpectedly | Critical | bridge settings default off, explicit confirmation |
| Fan identity exposed to other fans | High | `PersonaMembership` fan handles, private visibility |
| Home exact address exposed | Critical | no home data in Beacon serializers |
| Broadcast fanout causes load | High | `PERSONA_BROADCAST_ENABLED` kill switch, indexes, caps |
| Paid membership confusion | Medium | paid memberships separately gated and Stripe-backed |
| Sensitive categories exposed too broadly | Medium/High | category policy and env gate |
| Old clients hit new routes incorrectly | Medium | legacy follow path and compatibility views |
| Search exposes too much | High | search visibility settings and identity search policy |
| Admin/moderator misuse | High | `AdminAccessLog`, audit trails |

## Appendix D: Ideal Future State

The clean future state would be:

- One canonical migration generator.
- Supabase migration stream as deploy source.
- Backend migration docs generated from Supabase metadata.
- CI-enforced pairing until the backend directory is retired.
- Automated production-clone rehearsal for high-risk migrations.
- Schema drift reports after every production deploy.
- Feature flags declared in code and seeded by migration.
- Every global enablement migration has an explicit rollback SQL snippet.
- Every destructive migration has a linked runbook.

Until then, the dual-directory model is workable, but only with discipline and
automation.
