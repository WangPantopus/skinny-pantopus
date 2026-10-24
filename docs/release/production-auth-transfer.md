# Production Auth transfer: April logins into the new project

**Founder confirmation, October 23:** the native apps will update the original `com.pantopus.app` store listings. Transfer existing sign-ins and their matching profiles only; all product content starts fresh. Complete the rehearsal, explicitly authorized production transfer and old-account sign-in checks before releasing 2.0.4.

**October 24 completed transfer:** the founder explicitly authorized importing
the 35 non-overlapping legacy accounts as ordinary users and keeping the four
overlapping current accounts and their sign-in methods unchanged. The import
committed 35 Auth users, 37 identities and 35 matching app profiles. The
destination now has 41 Auth users, 43 identities and 42 profiles. Independent
post-import comparisons confirmed that all six pre-existing Auth users, six
identities and seven profiles are unchanged. The Auth Admin API sees all 35
imported users, and production API/database health passed afterward.

The previous **Backend Production** project in **us-east-2** remains paused.
Its October 16 database backup was downloaded through the authenticated
dashboard and stored privately on an encrypted volume. No source restart or
password reset was needed. The snapshot contains 39 Auth users, 43 identities
(20 email, 15 Google, 8 Apple) and 41 app profiles. Every Auth user has a
profile; the two profiles without Auth users are excluded from the transfer.
No deleted, banned, anonymous or super-admin Auth users, or MFA factors, were
found in this snapshot.

Before import, the live destination contained six Auth users, six identities and
seven app profiles. Every destination Auth user had a profile. Four source
emails match destination accounts with different IDs; two also match OAuth
identities in the destination, and one has a username collision. The identity
matches do not all point to the same destination accounts as the email matches,
so none of those four source accounts was imported, merged or used to replace
current passwords or identities. Of the other 35 accounts, one had a legacy
admin role; all 35 imported profiles are now ordinary, unverified individual
users. Existing destination privileges remain unchanged. Record-level
comparisons remain private.

A fresh full destination backup was captured and checksummed privately before
the write. The live columns, constraints, triggers and migration ledger were
checked. An isolated local rehearsal used the actual destination's schema and
synthetic accounts only. It verified password hashes, Google/Apple identity
subjects, confirmation state, removal of legacy privileges and product fields,
preservation of existing rows, five collision types, destination-drift rejection,
repeat-execution rejection and rollback after a forced post-write failure.
Through the local Auth service, a confirmed synthetic user signed in with its
original password (HTTP 200); an unconfirmed user remained blocked with
`email_not_confirmed` (HTTP 400).

The production transaction used explicit columns, fresh collision checks and
before/after comparisons under locks on the three account tables. It preserved
17 password hashes, 33 confirmed emails and two unconfirmed emails. It imported
no legacy sessions, tokens, addresses, verification/ownership claims, payment
bindings, file references or other product content. No schema or production
configuration was changed by this import. Backups, the executed script,
payloads, checksums and receipts are retained privately on the encrypted volume.

**Remaining release acceptance:** owners must verify their imported
email/password, Google and Apple sign-ins as applicable in the real apps,
including profile loading and fresh content. Synthetic Auth-service checks and
the production Admin API inventory do not establish those user journeys.

**Decision, October 8, 2026:** create a new production Supabase project from the
canonical migrations. Preserve April users' ability to sign in, including
email/password, Google and Apple identities. Leave April's Homes, Trains,
payments, uploads and other product records in the old project. Keep the old
project available as an archive. This is the D3 path in
[the launch checklist](prod-config-checklist.md).

This runbook records the approved October 24 transfer and its remaining
acceptance checks. The executed import is private and must not be rerun; any
additional transfer needs a fresh inventory, reconciliation and authorization.
Never run `pg_restore` directly from an
April dump into the production project: the old managed Auth schema and the
new application schema may differ.

## Source and privacy

The April source is Supabase project `ankjdyvoduutkhhaxvhx`, shown as
**Backend Production** in the founder's Chrome dashboard. The new destination
is `pantopus-production`, project `falmvysvndmwtfxsrxek`, created in Oregon
under the same Supabase login. Both are currently in the `Pantopus` Free
organization. The founder previously chose to stay on Free; changing plans or
organizations requires a separate decision. The destination is no longer empty.
The Mac's CLI login belongs to the separate staging account, while the source
backup was obtained through the founder's production dashboard login.

Historical read-only inspection on October 9 found the new project healthy, with no Auth
users, no identities and no `public."User"` table yet. The source and destination
`auth.users` and `auth.identities` columns and nullability matched. The new project
had the Data API enabled, automatic exposure of new tables disabled, and the
automatic RLS event trigger enabled. At that time it had no application
migrations or scheduled backups. That empty-project state is historical; the
October 24 completed transfer above supersedes it. The full private backup
taken for this transfer does not establish recurring managed backups.

The founder controls credential entry, hosted secret changes and production
imports. The October 24 import was explicitly delegated for the 35-account
scope above; that authorization does not cover future imports. Keep source
dumps, temporary tables and every
record-level comparison outside the public repository, PRs, screenshots and
chat. Use a private directory on an encrypted disk with mode `0700`; files in
it should have mode `0600`. Print counts and pass/fail results, never email
addresses, identity payloads, password hashes or user IDs.

For a paused source, use **Download backups → Database backup** in its project
overview. Record the snapshot date and checksum privately, then inspect only
the Auth and matching-profile data. Do not restore the full backup into the
live destination. Keep the archive and extracted rows on an encrypted volume
with the permissions above; a private directory alone does not encrypt a disk.

If a fresh connection-based export is needed, the founder puts the **Session pooler** host, port 5432,
`postgres.<source ref>` user, database `postgres` and source database password
into a private shell file as `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE` and
`PGPASSWORD`. Use `PGSSLMODE=verify-full` with the trusted Supabase CA file
named by `PGSSLROOTCERT`. Do not put the password in a URL or command argument.
After setting `AUTH_EXPORT_DIR` to a new path outside the repository, the
founder can make the read-only export with:

```bash
(
  umask 077
  set -a
  source ~/.config/pantopus/hosted-secrets/april-db-export.env
  set +a
  : "${AUTH_EXPORT_DIR:?set an absolute private export directory}"
  [[ "$AUTH_EXPORT_DIR" == /* ]] || { echo 'Use an absolute export path' >&2; exit 2; }
  mkdir -p "$AUTH_EXPORT_DIR"
  pg_dump --format=custom --data-only --no-owner --no-acl \
    --table=auth.users --table=auth.identities --table='public."User"' \
    --file="$AUTH_EXPORT_DIR/source-auth-and-profiles.dump"
  pg_restore --list "$AUTH_EXPORT_DIR/source-auth-and-profiles.dump" \
    | rg 'TABLE DATA (auth (users|identities)|public User) '
)
```

The list command prints table names, never row contents. Keep the dump private
until the transformed import is rehearsed. The export intentionally includes
the whole old `User` table as input; the importer will select only the profiles
and columns allowed by the decision below.

## What the import must preserve

1. For new accounts without collisions, preserve each selected `auth.users.id`, email, confirmation state and
   encrypted password, plus the linked rows in `auth.identities`. The source
   currently has email, Google and Apple identities. Importing email addresses
   without the identity records or password hashes would break sign-in.
   Existing destination accounts require a separately reviewed mapping. Do not
   overwrite their IDs, passwords, profiles or linked identities, or merge
   accounts automatically by matching email alone.
2. Create exactly one `public."User"` profile with the same `id` for each
   imported Auth user. `POST /api/users/login` revokes the session when this
   profile is missing. Carry only the profile data needed for account arrival,
   such as username and name, after checking the new schema's constraints.
3. Review the old curator and admin accounts separately. Preserving a login
   does not authorize copying old privileges into the new application. The
   production curator account and any admin grant need explicit provisioning
   through the new project's normal controls.
4. Exclude profiles without an Auth user, old sessions and refresh tokens,
   device tokens, verification or ownership claims, stored addresses, payment
   credentials and all other April product records. New-project JWT signing
   means existing sessions expire; users sign in again with their existing
   credentials. Review any old OAuth provider configuration against the new
   Supabase callback URL.

## Sequence and acceptance

1. **L4 and founder:** confirm the source snapshot and capture a fresh private
   destination backup and account inventory before any write. Verify the
   destination's migration ledger and recovery procedure. Production already
   serves the new project; do not replay the original empty-project cutover or
   change its endpoints as part of this transfer.
2. **L4:** inspect the actual source and destination columns, constraints and
   triggers. Prepare a record-level reconciliation for ID, email, username and
   provider-identity conflicts. Keep every existing destination account and its
   content intact until the founder approves an explicit alternative. Review
   curator/admin cases separately; preserving a login grants no old privileges.
3. **L4:** write the smallest explicit-column, transactional import for the
   approved mapping. Rehearse it on an isolated local database using the
   canonical application schema and compatible Auth schema, with synthetic
   password, Google, Apple, unconfirmed-email, privileged-account and collision
   cases. Do not use a shared stream runtime. Verify that unexpected destination
   rows or conflicts stop the import, and that any mismatch rolls it back.
4. **Founder:** review the exact script, mapping, backup and rehearsal results,
   then authorize or run the production transfer. The script must check the
   expected destination and recheck collisions at execution time. Production
   credentials and account data stay in private files.
5. **Founder and L4:** reconcile counts and confirm that each imported Auth user
   has exactly one matching app profile. Test existing password, Google and
   Apple sign-in as applicable in the real web and native apps, including
   sign-out, re-entry and profile loading. Verify the approved fresh-content
   behavior and the preservation of pre-existing destination accounts before
   public mobile release.

Supabase confirms that Auth user records can carry password hashes between
projects, but offers no one-size-fits-all Auth-only import script. See
[Supabase's Auth migration guidance](https://supabase.com/docs/guides/troubleshooting/migrating-auth-users-between-projects)
and [its SQL backup and restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).
