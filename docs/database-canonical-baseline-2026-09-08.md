# Canonical database baseline — September 8, 2026

The adoption branch now has a replayable canonical migration stream. This is a
source and local-verification milestone. No hosted schema, ledger, deployment
switch or production traffic changed.

## Canonical stream

`20260908234526_application_baseline.sql` installs the reviewed public schema on
a fresh Supabase PostgreSQL 17 database, including the six rehearsed forward
corrections, explicit ACL restoration, restrictive Beacon Post policy and
service-only maintenance RPC grants. `20260908234527_reference_baseline.sql`
installs five allowlisted static datasets: HomeRolePermission (24),
PostCategoryTTL (18), AddressCalendarRule (74), CountyRadonZone (3,128) and HudFmr
(3,223). A separate fresh-install audience_profile flag defaults to global and
internal disabled, with an empty beta list.

Timestamped history and development patches move byte-for-byte into
`supabase/migrations-archive`. Numbered history remains in place. Frozen
legacyFiles hashes are unchanged. The two identity-firewall fixture paths now
point to the archive; their eight tests pass. The migration policy changes to
baselined with the two baseline hashes, retaining CLI 2.116.0. Required CI now
activates replay, the reviewed function gate, SQL contracts and real integration.

Existing populated projects require a reviewed forward upgrade and separate
ledger adoption. **Never run baseline DDL over an existing application schema.**
Hosted migration/deployment switches remain disabled. Do not overwrite existing
feature flags or silently add permissions. The incomplete Home/business role
matrix remains a separate product decision; adoption preserves existing grants.

## Local evidence

The owned pantopus-canonical-empty-replay scratch project was reset with the
pinned CLI, applying exactly the two canonical versions through normal Postgres
credentials. No existing developer or restored database was reset.

| Check | Result |
| --- | --- |
| Replay/history | Pass; two canonical ledger entries, archived history hashes preserved |
| Strict catalog comparison | 318 tables, 1,242 indexes, 135 routines, 71 triggers, 511 policies, 81 enum/domain types, 12 views, two sequences, six default-ACL entries and eight extensions match in count; only the two reviewed GigSavedSearch CHECK-expression formatting differences remain |
| CHECK semantics | 20 valid combinations and six named-constraint rejection cases pass on upgraded and fresh databases |
| Reference content | All 6,467 full-row fingerprints match across five tables, with timezone/collation fixed |
| Function gate | Pass: 111 application functions and 71 trigger bindings; six reviewed PostGIS diagnostics, 38 warnings and two explicitly reviewed unattached trigger functions |
| pgTAP | Seven contracts pass: Beacon storage/RPC access, Home boundaries, managed auth/storage access, PostGIS runtime, reference defaults, saved-search portability and upgrade gaps |
| Real integration | Five tests pass through the real SDK, PostgREST JWT verification and actual Following service on the complete schema |
| Cleanup | Zero public users, auth users, posts and notifications remain in the fresh project |
| Upgrade preservation | Original-column fingerprints across 345 tables / 18,437 rows remain identical after local contracts |

The integration tests verify browser denial of raw Beacon rows including the
owner, denied direct publication/conversion, service-only maintenance RPCs,
exact free/Member Following results excluding drafts/archives, and exact stored
notification destinations with retry duplicate rejection. Signed local JWTs
exercise PostgREST enforcement; these tests do not exercise Supabase Auth login
or push delivery.

Raw CLI lint still exits 1 for six stock PostGIS diagnostics. The combined gate
verifies exact diagnostic content, extension version/membership/source hashes
and runtime behavior. Unknown errors, same-name application overloads and changed
provenance fail. See the [lint decision](database-reference-lint-2026-09-08.md).
Function lint and SQL contracts run sequentially because SQL test tooling
temporarily installs pgTAP; pgTAP errors are not additional exceptions.

## Managed platform coverage

A fresh production metadata inventory used verified TLS and a read-only session.
Managed sections match the preserved backup except extension owners for
uuid-ossp, pg_stat_statements and pgcrypto: production uses postgres; the restore
assigned supabase_admin. Versions and schemas match. The baseline leaves
platform-owned objects alone.

The source has four storage triggers, no auth triggers, no auth/storage policies,
no buckets, an empty realtime publication and no cron jobs. Fresh Supabase keeps
its own storage implementation: two search routine bodies differ by platform
version, while identities and grants match. Six platform event triggers match.
There are no extra custom schemas, foreign tables or partitioned tables. Public
composite types geometry_dump and valid_detail belong to PostGIS. Platform/CLI
helper roles are not copied into the application baseline.

The managed-access contract proves that inserting an auth user does not create a
public profile automatically, service-role profile/private-object metadata
operations work, and browser roles cannot read auth records or access that
private object. All fixtures roll back. This does not certify hosted Auth
dashboard hooks, external storage bytes, HTTP uploads/downloads or email delivery.

## Review and next action

Schema extraction was limited to public application definitions and audited for
embedded credentials, URLs and private data. Reference extraction used the
five-table allowlist. No user, device, membership or notification rows are in the
baseline. Private catalogs, archives and operator logs remain outside Git.
The schema file retains 72 existing trailing-whitespace lines inside function
bodies so their catalog fingerprints remain exact; other changed files pass
the whitespace check.

Obtain green CI on the canonical head, then add the default-enabled Beacon
push-only preference through a new migration, API and client controls. Prepare a
concrete per-environment upgrade/ledger adoption plan before hosted changes.
Staging still needs the Beacon storage/RPC restrictions and hosted role denial
checks. Production adoption and traffic cutover remain separate actions.

Evidence is in [PR #11](https://github.com/WangPantopus/skinny-pantopus/pull/11),
stacked over [PR #10](https://github.com/WangPantopus/skinny-pantopus/pull/10).
The [empty replay](database-empty-replay-2026-09-08.md),
[upgrade rehearsal](database-baseline-rehearsal-2026-09-08.md) and
[reference/lint report](database-reference-lint-2026-09-08.md) retain detailed
decisions. The handoff records exact canonical CI evidence when it completes.
