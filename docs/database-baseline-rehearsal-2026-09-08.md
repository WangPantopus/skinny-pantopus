# Database baseline adoption rehearsal

The later [empty-database milestone](database-empty-replay-2026-09-08.md)
supersedes this report's pending empty-schema/Home-policy checks. It records
normal-role CLI replay, the fresh-platform ACL correction, managed-surface
comparison and remaining reference/lint limits.

The September 8 continuation closes the previously identified table/column gaps
on an isolated local upgrade candidate. This is a prerequisite for the remaining
Beacon push preference, whose additive migration is blocked by legacy mode.
Neither the canonical baseline nor a hosted ledger has been adopted.
The reviewable diagnostics/contracts and this record are in draft
[PR #11](https://github.com/WangPantopus/skinny-pantopus/pull/11), stacked on the
Beacon fixes in PR #10.

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

## Further catalog and Beacon checks

### Broader catalog and compatibility milestone

The read-only [catalog inventory](../scripts/db/catalog-inventory.sql) now
captures public tables/columns, constraints, indexes, routines and their grants,
trigger bindings, policies, enum/domain types, views, sequences, default grants
and extension versions. It includes visible column order, public-schema grants
and effective access for the three application roles. The offline [comparator](../scripts/db/compare-catalogs.cjs)
reports counts and changed paths without printing private catalog values. Its
five tests cover equal-count drift, ACL/RLS changes, invalid indexes, disabled
triggers, enum ordering, private-value omission and malformed inventories.

The broader comparison found compatibility issues that column presence missed.
The local candidate now permits free/draft gigs and pending-recipient mail,
preserves rejection of negative gig prices, and adds seven missing query indexes.
It also normalizes newly introduced application-object ownership to `postgres`
where that matches the reference. Production's equivalent geohash unique key,
extra fields/tables, stronger RLS flags and `Payment.home_id` deletion behavior
are retained rather than overwritten to make a comparison empty.

The reference mail check had a separate NULL bug: a recipient-free row with no
escrow status produced SQL `UNKNOWN`, which a CHECK accepts. A failing negative
contract demonstrated it; the local correction explicitly requires a non-null
pending/expired/withdrawn escrow state when both recipients are absent. The
expanded real SQL contracts pass, and all 345 original-value hashes still match.

### Beacon database access blocker

The catalog audit also found a Beacon access route outside the backend API.
In the local candidate, `anon` could select a synthetic public-visibility Beacon
draft because the old permissive `Post` RLS policy checked visibility without
checking Beacon publication state. A read-only inspection of current staging
confirmed the same permissive public-read policy and browser SELECT grants,
with no restrictive Beacon policy. No hosted fixture or schema was changed.

A local restrictive policy now reserves raw persona/broadcast rows for the
backend service, where identity projection and membership/block/draft checks
already run. It guards both reads and writes, including attempts to convert an
ordinary post into a persona post. The
[storage access contract](../scripts/db/contracts/beacon-storage-access.sql)
failed before this correction and now passes for `anon`, `authenticated` with
an owner claim, and `service_role`. It covers published, draft, Member-only,
archived and legacy persona markers, while preserving ordinary public reads.
Repository inspection found no direct frontend `Post` table/RPC consumer.

Three SECURITY DEFINER Post maintenance RPCs also retained browser EXECUTE:
`auto_archive_expired_posts`, `get_seeder_tapering_metrics`, and
`record_post_unique_view`. Their local candidate grants are now service-only.
Actual denied browser calls and successful service calls pass. The current
backend and seeder callers use the service role. No public view directly
referencing `Post` was found in this candidate.

**These database corrections are not deployed.** The successful device/API
journey does not certify direct PostgREST authorization. Carry the restrictive
policy and RPC grants into the reviewed forward upgrade/canonical baseline,
then verify hosted denial before marking Beacon access acceptance complete.
Full Home-policy reconciliation, managed-schema customizations, effective-role
membership, composite types, reference rows and external files remain outside
this public-catalog diagnostic's coverage.

### Repeatable upgrade evidence

All six private forward SQL steps were replayed on a second new clone of the
preserved prior upgrade. The captured catalogs compare equal, including
definitions, RLS, explicit/effective grants and object ordering: 318 tables,
1,242 indexes, 135 routines, 71 trigger bindings, 511 policies, 81 enum/domain
types, 12 views and two sequences. Both new SQL contract suites and application
lint pass on this second candidate, with all 345 original-value hashes matching.
This is a repeatable **upgrade** check; it is not an empty-database baseline
replay. A fresh private candidate archive and ordered SQL/hash manifest are saved
in the operator evidence root. Sequence counter values are not part of the
column-value comparison; rolled-back tests can advance them on these local copies.

## Remaining adoption work

The legacy policy and all historical hashes remain unchanged; `db:check` and its
six regression tests plus the five comparator tests pass. No migration, baseline hash, feature flag, hosted
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
