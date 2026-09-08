# Database baseline adoption rehearsal

The September 8 continuation closes the previously identified table/column gaps
on an isolated local upgrade candidate. This is a prerequisite for the remaining
Beacon push preference, whose additive migration is blocked by legacy mode.
Neither the canonical baseline nor a hosted ledger has been adopted.

## Candidate and preservation

Docker Desktop's unresponsive local engine was recovered without resetting or
pruning its data. The original restore container's startup command attempts
`initdb` every time, so restarting it exits when its database already exists.
Its saved data directory was copied privately into a new Docker volume; the
original container and both earlier databases remain intact.

The new container, `pantopus-baseline-adoption-20260908`, has no Docker network
and no published ports. `pantopus_candidate` was cloned from the preserved
`pantopus_upgrade` database. It is an extension of the earlier local upgrade
rehearsal, not a new production backup. All source archives and operator SQL
remain outside Git under the private recovery root's `baseline-adoption/`.

The forward candidate adds:

- Four tables: `AnalyticsEvent`, `GigShare`, `ListingShare`, `MailDeliveryIntent`.
- All 35 previously missing columns and both `PushToken.platform` / `provider`
  columns, for 37 additions. Existing Expo-shaped tokens receive a provider only
  when it is absent; no token value is changed.
- Four pricing/scheduling enums, their six consistency checks, required indexes,
  both structured gig query functions and both share-count trigger functions.

All four new tables enable RLS and deny browser-role access; the service role
receives explicit CRUD privileges. This intentionally strengthens the testing
schema, where the first three tables lacked RLS. New feed RPCs are service-only
because their results include fields the backend must project before exposure.
Existing production-only tables, columns and constraints are preserved.

The old catalog comparison now reports no missing application table or column;
the candidate has 318 application tables, including production's extra table.
SHA-256 hashes of every original column value match before and after this
expansion and the rolled-back contract tests: **345 tables / 18,437 rows** in
the prior upgrade copy. Comparison is by table, not query-output order. This
does not replace the earlier archive's separate 299-COPY-section verification.

## Real SQL checks and a newly found defect

[Upgrade contracts](../scripts/db/contracts/upgrade-gaps.sql) pass on the candidate:
actual `anon` / `authenticated` read and write denial; service writes; share
insert/delete counts; one delivery intent per mail; invalid-rate rejection;
exact structured gig query results; listing returns; notification retry
idempotency; and native push-column writes. All synthetic fixtures roll back.
The previous recovery contracts for job locks, inventory, chat/profile/storage,
credential grants and atomic calendar replacement also pass.

The listing contract initially failed. The restored production schema stores
listing categories and several other fields as enums, and `quality_score` as
`numeric(4,2)`, while `browse_listings_by_distance` promises text and integer
columns. Its select list needed explicit casts. The local forward correction
preserves the function signature and existing grants; both the linter and the
actual synthetic listing query now pass. Frozen migration files are unchanged.

The additional [application linter](../scripts/db/lint-application-functions.sql)
uses `plpgsql_check` and catalog extension membership, and checks each attached
application trigger against its table. It reports **111 functions, 71 trigger
bindings, zero errors and three warnings**. Two unattached legacy comment-count
trigger functions are explicitly reported as unverified. Separate transactional
negative controls all fail as intended: a missing-table query, a broken function
overloading a PostGIS name, and a trigger referring to a nonexistent field.

This diagnostic does **not** replace or weaken the required Supabase lint gate.
Pinned CLI 2.116.0 scans PL/pgSQL routines by schema without excluding extension
members or binding triggers; see its [lint SQL](https://github.com/supabase/cli/blob/v2.116.0/apps/cli/src/legacy/commands/db/lint/lint.lint-sql.ts).
The six previously recorded PostGIS diagnostics still need an explicit,
validated resolution in the canonical replay. A passing application diagnostic
alone does not mean the full adoption gate passes.

## Remaining adoption work

The legacy policy and all historical hashes remain unchanged; `db:check` and its
six regression tests pass. No migration, baseline hash, feature flag, hosted
schema, ledger or deployment switch changed. The Beacon push-only field/API/UI
is still pending.

Next, extend the comparison beyond table/column presence to complete object
definitions, indexes, constraints, RLS/ACLs, custom managed-schema objects and
reference data. Preserve intentional production-only objects and explain every
change. Build a reviewed, public-safe baseline and replay it on a new empty
Supabase stack, resolve the full lint gate, and run SQL/backend contracts on
both fresh-install and upgrade paths. Only then transition the repository's
migration policy and add the Beacon preference migration. Hosted adoption and
production release still require the concrete reviewed plan in the
[adoption runbook](supabase-migration-automation-runbook.md).
