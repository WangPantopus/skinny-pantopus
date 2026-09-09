# Baseline reference data and function gate — September 8, 2026

The required static references now replay into the isolated fresh database, and
the reviewed function gate passes. This continues the
[empty-schema milestone](database-empty-replay-2026-09-08.md); repository baseline
activation and hosted adoption remain separate steps.

## Reference-data decision

The fresh replay now includes 6,467 existing static rows across HomeRolePermission
(24), PostCategoryTTL (18), AddressCalendarRule (74), CountyRadonZone (3,128) and
HudFmr (3,223). All five complete row fingerprints match the preserved upgraded
copy. The [read-only inventory](../scripts/db/reference-inventory.sql) uses an
explicit C sort order: platform default collations initially produced different
aggregate hashes for identical TTL rows.

These are existing application/reference data. The baseline preserves the
current permission matrix. Empty Home presets/template metadata and business
permissions/presets remain an existing product gap, to be addressed by a separate
permission change with behavioral review. Installing the checked-in business
seed during recovery would grant rights absent from both source databases.

The fresh environment also gets an explicitly disabled Beacon feature flag with
an empty beta list. This is an installation default; it does not overwrite a
hosted environment's flag, internal-team setting or beta membership. No user,
device token, notification or household rows were imported into the fresh DB.
The private reference SQL and source fingerprints remain outside Git until
canonical baseline review.

## Explicit lint-gate correction

The pinned CLI scans PL/pgSQL routines without distinguishing extension members
and omits trigger functions. The newest checked release, 2.117.0, retains that
scan; upgrading alone does not fix the issue. Sources:
[pinned scan](https://github.com/supabase/cli/blob/v2.116.0/apps/cli/src/legacy/commands/db/lint/lint.lint-sql.ts),
[2.117.0 scan](https://github.com/supabase/cli/blob/v2.117.0/apps/cli/src/commands/db/lint/lint.lint-sql.ts).

The six stock PostGIS diagnostics involve dynamic records, transaction tables
created during execution, or optional raster functions handled at runtime. The
new [runtime contract](../scripts/db/contracts/postgis-lint-runtime.sql) passes
on both the upgraded copy and fresh database: both extent overloads return exact
bounds, geometry metadata is correct, version reporting works without raster,
authorization creates its temporary table, and conflicting row locks are denied.
All setup and changes roll back; no extension definitions are edited.

The [new gate](../scripts/db/check-function-lint.cjs) therefore retains the full
pinned CLI scan at `--fail-on error`, then applies an explicit, narrow review of
these diagnostics. The [manifest](../scripts/db/postgis-lint-review.json) binds
each exception to its exact function identity, PostGIS membership/version,
definition hash, complete error contents and runtime contract. An application
overload cannot borrow an extension's exception. Extra occurrences, new errors,
modified code, lost membership, version changes, malformed output or unexpected
process failure all fail the gate.

The gate separately checks 111 application functions and 71 attached trigger
bindings, ignoring in-comment lint suppressions. Two existing unattached comment
triggers remain explicitly unverified and hash-pinned; changing them or adding
another orphan fails. It also requires all six PostGIS runtime paths to pass.
Connections are constrained to the local project's loopback port; operator
Postgres/Supabase environment overrides are excluded. Raw reports are stored in
private temporary files and are not printed or uploaded as CI artifacts.

This is a deliberate replacement of the **raw exit-code rule**, not a claim
that raw CLI lint is error-free: it still returns 1 with six reviewed errors and
38 warnings. The combined gate passes with zero application errors. Unknown
extension errors are not exempted.

## Verification

Eight gate regressions pass; with migration-policy/catalog tests there are 19
passing Node tests. Four actual local database negative controls were rejected:
a missing-table function, a same-name PostGIS/application overload, a broken
attached trigger and a new unattached trigger. Their fixtures were removed, and
the clean gate passed again. These controls complement the earlier three local
application-lint negative tests.

Next: finish canonical baseline review and activate empty replay, pgTAP and real
integration checks; carry the tested Beacon storage/RPC restrictions forward;
then implement the Beacon-only push preference and verify staged access denial.
No hosted schema, ledger, runtime, flag, token or device preference changed in
this continuation.
