# Empty-database adoption rehearsal — September 8, 2026

The private candidate now replays into an empty local Supabase database through
the pinned migration CLI and passes real-role contracts. This advances the
[adoption prerequisite](database-baseline-rehearsal-2026-09-08.md) for the remaining
Beacon preference and storage restrictions. It does **not** adopt repository
history, change a hosted ledger, or deploy a database correction.

## Empty replay and the grant defect it found

A new local project, `pantopus-canonical-empty-replay`, was started separately
from the preserved production restore and upgrade copies. Its database uses port
56322. Only this newly created scratch project's database was reset during the
rehearsal. No existing project or volume was reset or pruned.

The input is a private, schema-only export of the reconciled candidate. It
explicitly installs three application extensions, preserves owners, removes
dump-only psql commands, and retains the tested Beacon policy/RPC restrictions.
Credential-pattern inspection found no URLs, JWTs, private keys, AWS access keys
or quoted credential assignments; this scan does not replace complete baseline
review. No production records were loaded into the empty database.

The first replay exposed a portability defect: fresh Supabase default privileges
added browser grants absent from the source. ACLs differed on **49 tables and
22 routines**, including verification tables and Beacon maintenance RPCs. The
existing Beacon role contract failed with a browser-callable service RPC.
Copying the dump's ordinary GRANT statements alone was insufficient.

The corrected replay explicitly restores scoped application ACLs. It leaves the
platform administrator's three default-privilege groups to Supabase: their 12
GRANT statements cannot be applied by the migration role, and those groups
already match the source. The initial `postgres` attempt failed transactionally
at these statements. The revised input applies through **Supabase CLI 2.116.0
`migration up --local`** as the normal migration role, without superuser setup.

The strict comparator now agrees on all captured owners, ACLs, effective access,
RLS, policies, routine definitions, triggers, indexes, views, sequences, types
and default privileges: 318 application tables, 1,242 indexes, 135 routines,
71 triggers, 511 policies, 81 enum/domain types, 12 views and two sequences.
It deliberately still reports two definition-text differences: PostgreSQL moves
a `varchar[]` → `text[]` cast onto each constant in the `GigSavedSearch`
pay/schedule CHECK expressions. No comparator exception or normalization was
added. The [saved-search contract](../scripts/db/contracts/saved-search-portability.sql)
passes all 20 valid combinations, including NULLs, and rejects six invalid
values through the exact named constraints on both databases.

## Home and managed-surface reconciliation

Testing's Home policies allow a `home.edit` member to delete the home and retain
direct access solely through `created_by_user_id`. Production is stricter. The
backend's deletion route independently requires the primary owner, with a
bounded creator fallback for an otherwise unclaimed household. Creator
onboarding and verified-owner deletion use the backend service role. The fresh
baseline therefore preserves production's policies.

The [Home role contract](../scripts/db/contracts/home-policy-boundary.sql) passes
on the upgraded copy and empty replay: anonymous and nonmember creator reads
reveal no private Home row; an active member with `home.edit` can read/update;
that editor cannot delete; the legacy primary owner can. The test supplies one
permission inside its rolled-back transaction to isolate policy behavior from
incomplete historical reference data. It does not certify all Home permissions
or modify the stored permission matrix.

The [managed-surface inventory](../scripts/db/managed-surface-inventory.sql)
compares the preserved production restore, upgraded copy and fresh platform.
All have four identical storage triggers, no Auth triggers, no Auth/storage
policies, no storage buckets, and an empty `supabase_realtime` publication.
There is no `cron.job` relation. Their 21 Auth/storage routine signatures and
grants match; two platform storage search routine definition hashes differ.
These managed definitions were not overwritten. The fresh stack additionally
has `_realtime` and `supabase_functions` schemas created by Supabase.

This is evidence from the preserved production backup, not a fresh hosted
production inventory. Hosted Auth hooks/settings, other managed object kinds,
custom composite types, role membership and external storage bytes still need
their adoption review. Empty bucket metadata does not prove historical external
files can be recovered.

## Reference data and verification limits

Production and the candidate have the same historical gaps: 24 Home
role-permission rows and 18 post TTL rows, but no Home role presets/template
metadata or business role permissions/presets. The checked-in business seed
proposes additional permissions; it was not applied just to make databases
agree. The upgrade also has 74 address-calendar rules, 3,128 county radon rows
and 3,223 HUD reference rows. These rows and the feature flag are absent from
this schema-only empty replay.

Before canonical adoption, distinguish required deterministic reference data
from optional imports and explicitly review the missing permission matrix.
Do not copy user-specific feature beta lists or silently grant new roles.

Verification completed:

- Pinned CLI empty-schema replay succeeds with scoped ACL restoration.
- Gap/compatibility, Beacon storage, prior recovery, Home policy and saved-search
  SQL contracts pass. New Home/saved-search contracts also pass on the upgraded
  production copy. All synthetic fixtures roll back.
- Application lint passes for 111 functions and 71 attached trigger bindings,
  with zero errors; existing warnings/unattached-trigger limits remain.
- All 345 original table-value hashes match after these contracts: 18,437
  original rows/columns remain unchanged. Sequence counters are outside this check.
- Full pinned CLI lint still fails on the six known PostGIS diagnostics in
  this fresh database. The application diagnostic does not waive that gate.

The repository remains in legacy migration mode; canonical CI replay,
pgTAP/integration checks and hosted ledger adoption are still pending. Finish
reference data and baseline review, resolve the lint gate, and validate the
upgrade/ledger plan before shipping Beacon storage restrictions and the push-only
preference. Hosted schemas, runtimes, flags, device preferences and rollout
switches were not changed during this continuation.

Private SQL, catalogs, logs and manifests remain in the ignored recovery root
indexed by `OPERATOR_HANDOFF.md`. Only synthetic contracts, read-only inventory
code and this sanitized report are included in the review branch.
