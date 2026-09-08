# Backend recovery and staging rehearsal

## Confirmed data ownership

The owner confirmed these assignments during recovery. Earlier notes that called
the Mac's database production were incorrect.

| Project | Purpose | Handling |
| --- | --- | --- |
| `ankjdyvoduutkhhaxvhx` | Existing production database | Preserve; project is absent from the currently authenticated Supabase account and its API/database hostnames return NXDOMAIN. Account/project recovery remains necessary. |
| `gzzdqechcbfpalfvgyro` / Pantopus-backend | Existing local testing database | Preserve existing data and schema; read-only source for the staging rehearsal. |
| `ptudkfqdhqpkbkzqlabu` / Pantopus-staging | New isolated staging database | Created on the verified Free plan in Oregon; contains no copied user, home, message, or notification records. |

No production migration, ledger repair, database reset, or DNS cutover has been
performed. An inaccessible hostname does not prove that production data has been
deleted. Recover the owning Supabase account before deciding how to restore it.

## Existing AWS host

The owner authorized restarting the existing Oregon server and attaching a
dedicated management role. The server is running and Systems Manager is online.
The instance profile grants only agent registration and SSM message-channel
actions, with an `ec2:SourceInstanceARN` condition for this instance. It has no
Parameter Store or S3 permissions.

SSH's host key was obtained through authenticated SSM and pinned before use.
The June 12 production image and its container remain intact. A private copy of
its environment and container configuration is retained on the host; this is
**not** a backup of the inaccessible production database.

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

- Configure the Lob **test** webhook and save its signing secret privately.
  Proposed endpoint: `https://staging-api.pantopus.com/api/v1/webhooks/lob`.
- Keep `NODE_ENV=production`, `APP_ENV=staging`, Lob test mode and Stripe test keys.
- Configure isolated storage, email testing, and push-provider credentials.
  Never copy the old host's entire production environment into staging.
- Verify API and queue-worker readiness, HTTPS, authentication, and test-account
  flows before describing staging as ready. A passing Docker health check alone
  does not prove these flows or physical notification delivery.
