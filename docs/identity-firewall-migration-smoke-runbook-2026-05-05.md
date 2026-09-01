# Identity Firewall Migration Smoke Runbook

Last updated: 2026-05-05

This runbook verifies the Identity Firewall database rollout after applying:

- `backend/database/migrations/128_identity_firewall_personas.sql`
- `backend/database/migrations/129_identity_firewall_hardening.sql`
- `backend/database/migrations/130_identity_firewall_followers_broadcast_analytics.sql`
- `backend/database/migrations/131_identity_firewall_rls_safe_views.sql`
- `supabase/migrations/20260505000001_identity_firewall_personas.sql`
- `supabase/migrations/20260505000002_identity_firewall_hardening.sql`
- `supabase/migrations/20260506000001_identity_firewall_followers_broadcast_analytics.sql`
- `supabase/migrations/20260506000002_identity_firewall_rls_safe_views.sql`

The smoke script is read-only. It connects directly to Postgres through `pg`.

## Connection

Set one of:

```bash
export IDENTITY_FIREWALL_DATABASE_URL='postgres://...'
```

or use one of the existing supported names:

```bash
DATABASE_URL
SUPABASE_DB_URL
POSTGRES_URL
POSTGRESQL_URL
POSTGRES_PRISMA_URL
PGHOST / PGDATABASE / PGUSER / PGPASSWORD
```

For Supabase hosted Postgres, the script automatically uses SSL unless `PGSSLMODE=disable`.

## 1. Preflight Before Applying Migration

```bash
cd backend
npm run smoke:identity-firewall:preflight
```

Expected:

- Base tables exist: `User`, `Post`, `UserFollow`, `UserPrivacySettings`.
- Base enums exist: `post_as_type`, `post_audience`.
- Any normalized local-handle collisions are reported.

Collision note:

The migration now handles case-insensitive username collisions by suffixing the Local Profile handle with the user's UUID. A warning here does not block migration anymore, but it tells you which handles should be reviewed after rollout.

## 2. Apply Migration

Apply the Supabase migration using the normal environment process.

For a direct SQL apply, use the Supabase migration file:

```bash
psql "$IDENTITY_FIREWALL_DATABASE_URL" -f supabase/migrations/20260505000001_identity_firewall_personas.sql
psql "$IDENTITY_FIREWALL_DATABASE_URL" -f supabase/migrations/20260505000002_identity_firewall_hardening.sql
psql "$IDENTITY_FIREWALL_DATABASE_URL" -f supabase/migrations/20260506000001_identity_firewall_followers_broadcast_analytics.sql
psql "$IDENTITY_FIREWALL_DATABASE_URL" -f supabase/migrations/20260506000002_identity_firewall_rls_safe_views.sql
```

## 3. Post-Migration Smoke

```bash
cd backend
npm run smoke:identity-firewall
```

Expected pass checks:

- Tables exist:
  - `LocalProfile`
  - `PublicPersona`
  - `PersonaFollow`
  - `IdentityBridgeSetting`
  - `BroadcastChannel`
  - `BroadcastMessage`
  - `IdentityAuditLog`
- Enum values exist:
  - `post_as_type = persona`
  - `post_audience = public`
- Post columns exist:
  - `author_user_id`
  - `identity_context_type`
  - `identity_context_id`
- `UserFollow.source` exists.
- Every `User` has a `LocalProfile`.
- `PersonaFollow.source` allows `follow_request`.
- `PublicPersona_one_active_per_user` unique index exists.
- `BroadcastMessage.delivered_count` and `BroadcastMessage.read_count` exist.
- Safe public views exist:
  - `PublicLocalProfileView`
  - `PublicAudienceProfileView`
  - `PublicBroadcastMessageView`
- RLS is enabled on:
  - `LocalProfile`
  - `PublicPersona`
  - `PersonaFollow`
  - `IdentityBridgeSetting`
  - `BroadcastChannel`
  - `BroadcastMessage`
  - `IdentityAuditLog`
- Legacy feed RPC execute grants are revoked from `anon` and `authenticated`.
- `persona` and `public` enum casts succeed.

Warnings to investigate:

- Existing `Post` rows missing identity context. This usually means orphaned historical posts whose `user_id` no longer maps to a `User` / `LocalProfile`.

## 4. Combined Check

After the migration is applied, this runs both preflight and post checks:

```bash
cd backend
npm run smoke:identity-firewall -- --both
```

Machine-readable output:

```bash
npm run smoke:identity-firewall -- --both --json
```

## 5. Product Smoke After Schema Passes

Use two test accounts.

1. Log in as User A.
2. Open `/app/identity`.
3. Create a Public Profile from `/app/persona`.
4. Visit `/@handle`.
5. Create a persona post from the web composer.
6. Confirm it appears on the audience surface/feed.
7. Create a local post as Local Profile.
8. Confirm it appears on `/local/:handle`, not `/@:handle`.
9. Log in as User B.
10. Follow User A's Public Profile.
11. Confirm User B sees persona posts and broadcasts only.
12. Confirm User B does not see User A's gigs, listings, home info, local posts, local reviews, or local connections.

The backend contract tests already cover the privacy invariants. This product smoke confirms the deployed schema, API, and web UX are wired together.
