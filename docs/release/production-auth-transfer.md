# Production Auth transfer: April logins into the new project

**Decision, October 8, 2026:** create a new production Supabase project from the
canonical migrations. Preserve April users' ability to sign in, including
email/password, Google and Apple identities. Leave April's Homes, Trains,
payments, uploads and other product records in the old project. Keep the old
project available as an archive. This is the D3 path in
[the launch checklist](prod-config-checklist.md).

This is a preparation and acceptance runbook. **There is no approved import
command yet.** Write and rehearse the import against the new project's actual
Auth schema before the founder runs it. Never run `pg_restore` directly from an
April dump into the production project: the old managed Auth schema and the
new application schema may differ.

## Source and privacy

The April source is Supabase project `ankjdyvoduutkhhaxvhx`, shown as
**Backend Production** in the founder's Chrome dashboard. The new destination
is `pantopus-production`, project `falmvysvndmwtfxsrxek`, created in Oregon
under the same Supabase login. Both are currently in the `Pantopus` Free
organization. Moving the empty destination to another organization is optional
billing isolation before a Pro upgrade, not a migration requirement. The Mac's
current CLI login belongs to the separate staging account. The transfer uses
database connections to each project, so account or organization boundaries do
not prevent it.

Read-only inspection on October 9 found the new project healthy, with no Auth
users, no identities and no `public."User"` table yet. The source and destination
`auth.users` and `auth.identities` columns and nullability match. The new project
has the Data API enabled, automatic exposure of new tables disabled, and the
automatic RLS event trigger enabled. It has no application migrations or
scheduled backups yet. This schema comparison does not replace a rehearsed
explicit-column transfer or the post-migration profile-schema check.

Only the founder enters credentials, writes secrets into hosted services and
runs the production import. Keep source dumps, temporary tables and every
record-level comparison outside the public repository, PRs, screenshots and
chat. Use a private directory on an encrypted disk with mode `0700`; files in
it should have mode `0600`. Print counts and pass/fail results, never email
addresses, identity payloads, password hashes or user IDs.

For the source export, the founder puts the **Session pooler** host, port 5432,
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

1. Preserve each selected `auth.users.id`, email, confirmation state and
   encrypted password, plus the linked rows in `auth.identities`. The source
   currently has email, Google and Apple identities. Importing email addresses
   without the identity records or password hashes would break sign-in.
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

1. **Founder:** decide whether the empty destination should remain in the
   `Pantopus` organization or move to another organization for billing isolation.
   Upgrade whichever organization holds it to Pro and verify daily backups
   before transferring April logins. Apply the canonical migrations only after
   confirming the project is still empty. Keep the backend, Vercel and Lambdas
   pointed away from it during import.
2. **L4 and founder:** capture a private, read-only source export of
   `auth.users`, `auth.identities` and `public."User"`. Use the source project's
   session-pooler connection from **Connect** and a private password file or
   environment file outside the repository. Do not paste the connection
   string into a command line or chat. The export is a staging artifact, not
   an instruction to restore every old profile or field.
3. **L4:** inspect source and destination column/constraint differences, then
   write the smallest explicit-column import for the chosen rows. Rehearse it
   on an isolated local database with the canonical migrations and synthetic
   records for password, Google, Apple, unconfirmed email, admin and curator
   cases. Do not use a shared stream runtime. Verify the importer refuses a
   nonempty target and rolls back on any mismatch.
4. **Founder:** review the script and its local results, then run it once on
   the new hosted project. L4 compares source and destination counts, verifies
   every imported Auth ID has one app profile, and checks the new project's
   backup and migration ledger. Production credentials stay in private files.
5. **Founder and L4:** test sign-in in the real web app with a founder-owned
   existing password account and the configured Google and Apple providers.
   Check sign-out and re-entry, profile loading and access in the new app.
   Only then point `api.pantopus.com` and the production Vercel build at the
   new project.

Supabase confirms that Auth user records can carry password hashes between
projects, but offers no one-size-fits-all Auth-only import script. See
[Supabase's Auth migration guidance](https://supabase.com/docs/guides/troubleshooting/migrating-auth-users-between-projects)
and [its SQL backup and restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).
