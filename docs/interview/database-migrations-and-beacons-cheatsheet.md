# Database Migrations And Beacons - Interview Cheatsheet

Use this as the short spoken answer. The deeper version is in
`docs/interview/database-migrations-and-beacons.md`.

## Why Two Migration Directories?

`backend/database/migrations` is the backend engineering history. It uses
numbered files like `148_enable_beacons_by_default.sql`, which are easy to
reference in PRs, docs, tests, and runbooks.

`supabase/migrations` is the Supabase deployment stream. Supabase CLI expects
timestamped files and records applied migrations in its own ledger.

The correct mental model is not two independent systems. It is one logical
migration stream represented in two filename schemes.

## Production Source Of Truth

For production, the source of truth is:

1. the live production Postgres schema,
2. the Supabase migration ledger,
3. the ordered SQL in `supabase/migrations`.

`backend/database/schema.sql` is not source of truth. Its header says it is a
frozen snapshot and not applied by any migration runner.

## Ordering Guarantee

Ordering must be CI-enforced:

- backend order: numeric prefix
- Supabase order: timestamp prefix
- paired migrations must have matching logical names
- paired migrations should have identical SQL unless explicitly allowlisted
- backend and Supabase sorted order must agree

Current important gap: migration `148_enable_beacons_by_default.sql` exists in
`backend/database/migrations`, but needs a timestamped twin in
`supabase/migrations` if Supabase CLI is the production deploy path.

## Rollback Strategy

Rollback depends on migration type:

- data-only flag migration: flip data back
- additive schema: disable feature or roll back code, usually leave schema
- backfill: use snapshot/audit table or forward correction
- destructive migration: restore from backup/PITR or apply planned reverse

For migration 148:

```sql
UPDATE "public"."FeatureFlag"
SET enabled_globally = false,
    enabled_for_internal_team = false,
    beta_user_ids = ARRAY[]::uuid[],
    updated_at = now()
WHERE flag_name = 'audience_profile';
```

## Destructive Migration Review

Review destructive migrations as production incidents in advance.

Required checks:

- no deployed code still reads/writes the old object
- no mobile client still depends on the old shape
- compatibility view or shim if needed
- backup table or PITR plan
- row-count parity checks
- lock and rewrite analysis
- RLS/grant review
- smoke tests
- rollback runbook

## Production-Volume Testing

Run high-risk migrations on a production-like database:

1. restore anonymized production snapshot
2. capture table sizes and row counts
3. run preflight smoke
4. apply migration with timing and lock monitoring
5. run post-migration smoke
6. run integration tests
7. run privacy gates
8. compare query plans
9. rehearse rollback

## Backward-Compatible Changes

Usually safe:

- new nullable columns
- new tables
- new indexes
- new views
- additive enum values
- expanded check constraints
- default-off feature flags
- data-only changes with kill switch

Usually unsafe:

- drop table/column
- rename table/column
- tighten constraints
- set `NOT NULL`
- remove enum/check values
- replace RPC signatures
- change RLS in a way old code cannot satisfy
- revoke grants old code needs

## Why Migration 148 Flips `audience_profile` Globally

Migration 135 created the feature flag default off for staged rollout.
Migration 148 graduates Beacons to a normal shipped feature by setting:

```sql
FeatureFlag.audience_profile.enabled_globally = true
```

It is data-only, idempotent, and easy to reverse.

## Why Beacons Were Safe To Enable

Safety criteria:

- separate `User`, `LocalProfile`, `PublicPersona`, `AudienceIdentity`
- `IdentityBridgeSetting` defaults links off
- context-specific serializers
- raw private `User` field guards
- Beacon membership graph separate from personal/local graph
- persona posts use explicit identity context
- public routes avoid `user_id` leakage
- privacy gates pass
- integration tests cover the creator/fan/tier/payment/DM/block/broadcast loop
- DB flag and env kill switches exist

## Kill Switch

Fast scoped kill switch:

```sql
UPDATE "public"."FeatureFlag"
SET enabled_globally = false,
    updated_at = now()
WHERE flag_name = 'audience_profile';
```

Strong runtime kill switches:

```text
IDENTITY_FIREWALL_ENABLED=false
PERSONA_ENABLED=false
PERSONA_BROADCAST_ENABLED=false
```

Use the DB flag for UX or cohort issues. Use env gates for privacy, severe load,
or systemic Beacon incidents.

## Strong Closing Answer

The system is safe only if we treat migrations as a single ordered stream,
verify production with live smoke tests, and prefer reversible feature rollout
over irreversible schema rollback. Migration 148 is a good rollout migration
because it changes product exposure without changing schema, and it has both a
fast database rollback and stronger runtime kill switches.
