# Backend recovery and staging rehearsal

## Confirmed data ownership

The owner confirmed these assignments during recovery. Earlier notes that called
the Mac's database production were incorrect.

| Project | Purpose | Handling |
| --- | --- | --- |
| `ankjdyvoduutkhhaxvhx` | Existing production database | Owner resumed the paused project. Auth/REST access and a TLS-verified PostgreSQL session-pooler connection work. A private database backup was captured; the operator CLI still lacks project management access. |
| `gzzdqechcbfpalfvgyro` / Pantopus-backend | Existing local testing database | Preserve existing data and schema; read-only source for the staging rehearsal. |
| `ptudkfqdhqpkbkzqlabu` / Pantopus-staging | New isolated staging database | Created on the verified Free plan in Oregon; contains no copied user, home, message, or notification records. |

The new staging schema has been initialized with 317 application tables, 3,128
public county-radon reference rows, and 3,223 public rent reference rows. Hosted
synthetic SQL contracts passed and rolled their account/home/chat/file fixtures
back. Both existing databases remain unchanged.

No production migration, ledger repair, database reset, or DNS cutover has been
performed. Read-only queries confirmed existing production records are present.
Its REST schema metadata lacks current device/session, Lob webhook and address
calendar tables. A custom-format database backup includes Auth data and storage
metadata. A full local database restore now passes, with every archived data
section verified against the restored rows. Externally stored file contents are
not included. The production upgrade rehearsal below still has unresolved
schema gaps; production is not ready for the current backend.

## Production backup restore and upgrade rehearsal

The actual production archive was restored into a separate local Supabase
PostgreSQL 17.6 container using `--network none`, no published ports, and only a
Unix socket. No application, queue consumer, or external provider was connected.
All artifacts and logs remain private and excluded from Git.

- `pg_restore --exit-on-error --single-transaction` completed with owners and
  ACLs retained. The cluster was initialized with `supabase_admin` as its
  bootstrap role so PostgreSQL 17 could restore the original role grantors.
  Role passwords were not exported.
- All **299 COPY data sections** matched the archive by row count and
  order-independent row hashes, with no missing, extra, or mismatched sections.
- The logical replication publication was restored. The expected warning about
  non-logical `wal_level` applies to this disconnected local rehearsal; it does
  not establish working hosted replication or external-file recovery.

A second database was cloned locally from that verified restore for upgrade
experiments. The first restored database and original archive remain intact.
The normalized catalog comparison uses the same `pg_catalog` search path in both
databases to avoid treating qualified and unqualified expressions as changes.

Before the upgrade, production had 264 application tables and staging had 317.
Staging contained 54 tables and 51 columns missing from production. Production
also contained `ListingAddressGrant` and legacy columns absent from staging;
these must not be dropped just to make catalog counts equal.

All 49 unchanged June–September migration files used in staging executed on the
local production copy. The rollback-only SQL contracts then reproduced the
job-lock boolean/integer error. After applying the nine function corrections
already rehearsed in staging, those contracts passed, including ownership,
inventory limits, chat names, profile ordering, storage totals, credential-access
denials, and atomic calendar replacement. Synthetic fixtures were rolled back.
Across 268 original application/auth/storage tables, record counts were retained
and every available primary-key set matched. Two legacy tables have no primary
key and were checked by count only. This check does not claim that intentional
column transformations preserve every old value.

The historical migrations still leave **four missing tables and 35 missing
columns** relative to staging: `AnalyticsEvent`, `GigShare`, `ListingShare`, and
`MailDeliveryIntent`, plus onboarding, sharing, task pricing, neighborhood
statistics, and notification idempotency fields. These gaps require reviewed
forward changes, data transformations, and application compatibility checks.
The rehearsal does not authorize blindly replaying the frozen history, adopting
the testing schema over production, or enabling hosted migration automation.

## Existing AWS host

The owner authorized restarting the existing Oregon server and attaching a
dedicated management role. The server is running and Systems Manager is online.
The instance profile grants only agent registration and SSM message-channel
actions, with an `ec2:SourceInstanceARN` condition for this instance. It has no
Parameter Store or S3 permissions.

SSH's host key was obtained through authenticated SSM and pinned before use.
The June 12 production image and its container remain intact. A private copy of
its environment and container configuration is retained on the host; this is
**not** a backup of the production database.

The server's public address changed when it started. Cloudflare's existing
`api.pantopus.com` record still points to the old address. Do not direct traffic
to the old image or substitute the testing database to make health checks pass.

## Sharing the host with staging

`scripts/deploy/backend.sh` accepts an optional third argument for the host
binding, for example `127.0.0.1:18001`. The container still listens on port 8000.
The default remains `8000` for existing deployments.

For GitHub staging, set environment variable `BACKEND_API_BIND` to the chosen
binding. `remote.sh` validates it before opening SSH and passes it to the host.
Only a numeric port or an explicit `127.0.0.1` / `0.0.0.0` IPv4 address plus port
is accepted. Candidate and worker containers remain unexposed.

A loopback binding needs a separately verified reverse proxy/HTTPS route before
phones or webhook providers can connect. Changing this variable alone does not
configure nginx, DNS, Cloudflare origin rules, or certificates. Production and
staging must use different host ports when they share a server.

For a manual staging recovery without a registry upload, transfer the image over
pinned SSH and use its full `sha256:` image ID with the fourth argument
`--local-image`. Set `PANTOPUS_EXPECTED_REVISION` to the exact verified commit.
The script verifies the image's revision label, skips registry access, and retains
the same candidate readiness and rollback transaction. This mode rejects mutable
tags and production deployments. Normal GitHub releases still require registry
digests and their existing CI checks.

## Schema rehearsal evidence and limits

A private schema-only export from the **testing** database was restored to a new
local Supabase PostgreSQL 17 container. Missing June–September migrations were
rehearsed there, including scheduling changes already partially present in the
testing schema. Legacy migration files and hashes remain unchanged.

The rehearsal exposed and locally corrected:

- Missing device-auth, home, mail-day, address-calendar and other current tables.
- Scheduling email suppression lacked owner columns and retained a global
  unique index; the empty rehearsal table was reconciled to owner-scoped records.
  Existing production suppression records will need an explicit upgrade policy.
- SQL errors in job-lock row counts, post-archive row counts, listing enum casts,
  trust-anomaly completion timestamps, chat return types, profile aggregate
  ordering, storage aggregates, and an ambiguous identifier in a legacy feed.
- Browser grants on legacy feed RPCs and the pickup replacement RPC; the latter
  inherited explicit grants despite revoking `PUBLIC`. The service-only chat RPC
  was also restricted to `service_role`.

The image's real identity schema smoke check passed all 25 checks. Transactional
synthetic SQL contracts passed for job ownership/expiry, listing caps, chat names,
profile ordering, storage totals, verification-credential grants, and atomic
calendar replacement. All account/home/chat/file fixtures were rolled back.

The hosted restore required explicit ACL reconciliation: Supabase's new-project
default grants otherwise reintroduced browser access that was absent locally.
After correction, all 8,461 normalized application permission statements matched
the tested local schema exactly. Include this step and verify effective grants
when preparing the eventual canonical baseline; a schema dump alone did not
preserve the intended effective permissions on a fresh hosted project.

With pinned Supabase CLI 2.116.0, no application-function lint errors remained.
Six diagnostics remain in PostGIS-owned routines; the full `db lint --fail-on
error` command still exits nonzero. No CI gate has been weakened. The unused
legacy three-argument feed overload also remains ambiguous when called directly;
browser execution is denied and the current backend does not use it.

Reference data is limited to public county/rent/calendar datasets, shared role
templates, retention defaults, the repository's business permission seed, and a
disabled audience-profile flag. No existing user's beta membership is copied.

Private artifacts and manifests are retained under the recovery operator's
staging work directories. This is an isolated deployment rehearsal, **not**
production baseline adoption. Production compatibility, a recoverable production
backup, complete reference-data coverage, and the canonical migration/ledger
adoption described in the migration runbook remain separate release gates.

## Remaining runtime setup

- The Lob **test** webhook signing secret is saved in the private staging env.
  Endpoint: `https://staging-api.pantopus.com/api/v1/webhooks/lob`.
- The staging A record points directly to the current server (DNS only).
  Existing Cloudflare zone TLS is Flexible, so staging is being prepared with
  its own certificate instead of inheriting that origin transport. The owner
  opened ports 80/443. A hostname-only TLS virtual host now serves staging;
  existing nginx configurations and default listeners were preserved after
  automatic review rejected broader changes. HTTP serves ACME challenges and
  maintenance responses. Public HTTPS is verified with TLS 1.3.
  Certbot's renewal timer is enabled, with a staging-scoped nginx reload hook;
  a simulated renewal including the hook passed.
- Keep `NODE_ENV=production`, `APP_ENV=staging`, Lob test mode and Stripe test keys.
- The image includes Supabase's public database CA under `config/certificates`.
  Configure the worker's private connection URL with `sslmode=verify-full` and
  that CA path. Client TLS 1.3 with full verification was checked against staging.
- Configure isolated storage, email testing, and push-provider credentials.
  Never copy the old host's entire production environment into staging.
- Verify API and queue-worker readiness, HTTPS, authentication, and test-account
  flows before describing staging as ready. A passing Docker health check alone
  does not prove these flows or physical notification delivery.

## Runtime verification and fixes

Release `9d1fe24dc1f9ba4d6c07137405fa85b5b2cc3afb` passed the complete
[CI run](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34184722652)
and is deployed as `pantopus-backend-staging` and `pantopus-worker-staging`.
The API binds only to `127.0.0.1:18001` behind nginx. Both containers passed
readiness with zero restarts after deployment. All 11 application queue
schedules registered, and actual scheduled jobs completed in staging.

The public HTTPS API passed authenticated password login, notification
preferences and ownership, mark-read behavior, secure cookie transport, CSRF
enforcement, and Lob signature/age/duplicate checks. Home list, Hub, Following,
Identity Center and device registry queries also passed. Authenticated WebSocket
connections worked through nginx; unauthenticated socket connections were
rejected. CORS allowed the designated staging web origin and withheld access for
an unrelated origin. Debug and metrics routes are not publicly exposed.
Synthetic Auth accounts were
created without sending signup email, and their profiles/notifications and the
webhook event were deleted afterward; staging had no remaining Auth users.
These checks do not verify email signup,
external Lob delivery, storage uploads, or physical push delivery.

CI's Following contract failed twice before executing its assertions because the
Supabase ECR mirror rate-limited the image pull. The test now uses upstream
`postgrest/postgrest:v14.10`, pinned to the identical multi-platform digest. All
five contract cases passed locally and the backend CI job subsequently passed.

The hosted worker preflight exposed a pg-boss 12 import incompatibility hidden
by cron fallback. The manager now uses the library's named `PgBoss` export.
Hosted workers exit on queue initialization or registration failure, and clear
the previous readiness marker before startup. Development fallback and explicit
queue disable remain supported. CI now exercises actual enqueue/consumption in
the production image against disposable PostgreSQL, alongside startup failure
and rollback tests; no hosted credentials are used by these checks.
