# Phase 0 deployment runbook

This is the consolidated list of human-driven steps that ship Phase 0 to a
running environment. The code is committed and tested; this file is what an
operator follows in order.

Owner: whoever is rolling Phase 0. Pair-required for the SQL backfill steps
(P0.1, P0.2). Ping #pantopus-eng before starting.

Affected commits: `claude/super-user-followers-IONpi` from P0.1 (`8f43490`)
through P0.8 (`34d292f`) plus the P0.7 audit follow-up commit. Merge to
`feature/super-user-followers` from a `wypgitt`-authored commit before
deploying — the git proxy rejects `claude` pushes to `feature/*`.

## Pre-flight (every environment)

1. `git pull` the merged Phase 0 branch.
2. `pnpm install --frozen-lockfile`.
3. `cd backend && pnpm test` — must pass cleanly (167 suites, ~2660 tests,
   3 todo).
4. `cd backend && pnpm run test:privacy` — must print
   "OK — all privacy gates passed."
5. Confirm the new env vars are set as needed:
   - `PERSONA_FOLLOW_VIEW_ACTIVE` — leave unset for default behaviour;
     set explicitly to `false` ONLY to force a startup error during a
     coordinated rollback.
   - SMTP / mail env vars — required for P0.2 email job
     (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, optional `SMTP_FROM`,
     `APP_URL`).

## Apply migrations (in this order)

```sh
# Apply each in turn. They are independent, but running them numerically
# matches both the backend/database/migrations/ filename order and the
# supabase/migrations/ timestamp order.
psql "$DATABASE_URL" -f backend/database/migrations/132_collapse_persona_follow_into_membership.sql
psql "$DATABASE_URL" -f backend/database/migrations/133_local_profile_display_name_username_default.sql
psql "$DATABASE_URL" -f backend/database/migrations/134_notification_context.sql
psql "$DATABASE_URL" -f backend/database/migrations/135_feature_flag.sql
```

If you use the Supabase CLI: the timestamped files in `supabase/migrations/`
are byte-identical copies and `supabase db push` picks them up
automatically.

After every migration:

```sh
cd backend && pnpm run smoke:identity-firewall
```

The smoke script checks every table, column, RLS policy, and constraint
the Phase 0 work introduced. A `pass` line for every `REQUIRED_TABLES`
entry — including `PersonaMembership`, `FeatureFlag`, and
`LocalProfileDisplayNameMigrationP02` — means the migrations applied
cleanly.

## P0.1 verification (PersonaFollow → PersonaMembership)

After migration 132:

```sql
-- Privacy invariant: zero fan_handles equal the underlying user's username.
SELECT COUNT(*) AS leaks
FROM "PersonaMembership" pm
JOIN "User" u ON u.id = pm.user_id
WHERE pm.fan_handle = u.username;
-- Expected: 0
```

```sql
-- Data parity: row count in the new table matches the pre-migration backup.
SELECT
  (SELECT COUNT(*) FROM "PersonaMembership")              AS membership_rows,
  (SELECT COUNT(*) FROM "PersonaFollow_pre_migration_backup") AS backup_rows;
-- Expected: equal counts.
```

```sql
-- View parity: the PersonaFollow view returns the same shape clients used
-- to read from the table.
SELECT COUNT(*) AS view_rows FROM "PersonaFollow";
SELECT * FROM "PersonaFollow" LIMIT 1;
```

After at least one rollout window with no follow-up issues, drop the
backup:

```sql
DROP TABLE IF EXISTS "PersonaFollow_pre_migration_backup";
```

## P0.2 verification + email job

After migration 133:

```sql
-- Snapshot of every user whose display_name was migrated.
SELECT COUNT(*) AS affected_user_count FROM "LocalProfileDisplayNameMigrationP02";

-- Audit log entry per migrated user.
SELECT COUNT(*) AS audit_log_entries
FROM "IdentityAuditLog"
WHERE action = 'display_name_migrated_p0_2';
-- Expected: same count as affected_user_count.

-- Spot-check 5 users.
SELECT lp.id, lp.display_name, u.username, mig.previous_display_name
FROM "LocalProfile" lp
JOIN "User" u ON u.id = lp.user_id
JOIN "LocalProfileDisplayNameMigrationP02" mig ON mig.local_profile_id = lp.id
LIMIT 5;
-- Expected: lp.display_name = u.username for every row.
```

Now run the email job (dry-run first, ALWAYS):

```sh
cd backend
pnpm run p0-2:send-emails:dry-run
# Eyeball the count + a sample row's previous_display_name in the logs.

pnpm run p0-2:send-emails
# Sends one email per pending row. Idempotent; rerun is safe.
```

Verify counts match:

```sql
SELECT
  COUNT(*) FILTER (WHERE email_sent_at IS NOT NULL) AS sent,
  COUNT(*) FILTER (WHERE email_failed_at IS NOT NULL) AS failed,
  COUNT(*) FILTER (WHERE email_sent_at IS NULL AND email_failed_at IS NULL) AS pending
FROM "LocalProfileDisplayNameMigrationP02";
```

Investigate any rows with `email_failed_at`. Re-run the job to retry
(it skips already-sent rows).

## P0.6 verification (notification firewall)

Trigger one existing notification on staging (a `gig_accepted`, a
`bid_received`, anything in the inventory at
`docs/notification-template-inventory.md`):

```sql
-- Should show context = 'personal' (the default for every existing notify*
-- helper). Not 'audience' — that's Phase 1.
SELECT id, user_id, type, context, context_type, created_at
FROM "Notification"
ORDER BY created_at DESC
LIMIT 5;
```

Confirm the push notification still lands on the device exactly as it did
before — the only change at P0.6 is the `context` column on the row.

## P0.8 verification (feature flag)

The flag is **off** by default. Verify:

```sh
# Authenticated as a regular user. Expect: { "flagName": "audience_profile", "enabled": false }
curl -H "Authorization: Bearer $REGULAR_USER_TOKEN" \
  "$API/api/feature-flags/audience_profile"
```

Flip on internal-team enablement via the admin route:

```sh
# admin-token is a user with role='admin' or role='staff'.
curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled_for_internal_team": true}' \
  "$API/api/admin/feature-flags/audience_profile"
```

```sh
# Same regular user. Still expect: { "enabled": false }.
curl -H "Authorization: Bearer $REGULAR_USER_TOKEN" "$API/api/feature-flags/audience_profile"

# Authenticated as an internal user (role admin or staff). Expect: { "enabled": true }.
curl -H "Authorization: Bearer $INTERNAL_USER_TOKEN" "$API/api/feature-flags/audience_profile"
```

The audit log should record the flip:

```sql
SELECT actor_user_id, action, target_id, metadata, created_at
FROM "IdentityAuditLog"
WHERE action = 'feature_flag.updated'
ORDER BY created_at DESC
LIMIT 5;
```

To add a beta cohort:

```sh
curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"beta_user_ids\": [\"$USER_UUID_1\", \"$USER_UUID_2\"]}" \
  "$API/api/admin/feature-flags/audience_profile"
```

## Smoke checks across the stack

After applying migrations + flipping `enabled_for_internal_team` on an
internal user:

1. **Web feed** — load `/app` as an internal user. Verify post creator
   names + avatars render. Open `/app/feed/post/<id>` (post detail).
2. **Web marketplace** — `/app/marketplace`. Listing cards must show the
   seller name + avatar (this was the regression the audit caught).
3. **Web persona / local profile pages** — `/@<persona_handle>` and
   `/local/<local_handle>` render with the new identity shape.
4. **Mobile feed + marketplace** — same checks on iOS / Android.
5. **Comment threads** (web `CommentThread.tsx`, mobile
   `CommentSection.tsx`) — author avatars + names render.

## Rollback

In order of severity (lightest first):

1. Flip the flag off:
   ```sh
   curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"enabled_globally": false, "enabled_for_internal_team": false, "beta_user_ids": []}' \
     "$API/api/admin/feature-flags/audience_profile"
   ```
2. Revert the deploy (no DB rollback needed for code-only issues).
3. Hard rollback (DB): drop the new tables in REVERSE migration order.
   `LocalProfileDisplayNameMigrationP02` and `FeatureFlag` are
   independent and can be dropped without affecting Identity Firewall.
   Reverting migration 132 (PersonaMembership) requires restoring the
   `PersonaFollow` table from `PersonaFollow_pre_migration_backup`
   first — only feasible if the backup hasn't been dropped. After
   restoring, set `PERSONA_FOLLOW_VIEW_ACTIVE=false` before starting
   the backend so the startup guard catches the mismatch loudly
   instead of failing on the first follow attempt.

## Done

Phase 0 is fully shipped when:

- All 4 migrations applied without errors.
- `pnpm run smoke:identity-firewall` shows pass on every required check.
- P0.1 + P0.2 SQL invariants verified (zero leaks).
- P0.2 email job ran to completion (`pending = 0`).
- P0.6 push notification confirmed firing on staging.
- P0.8 flag flipped on for internal team and verified per-user.
- The five smoke-check screens render correctly on web + mobile.
- `pnpm run test:privacy` continues to pass on the deployed branch.
