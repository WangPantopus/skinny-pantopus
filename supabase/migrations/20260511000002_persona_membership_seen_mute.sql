-- Adds the read-state + temporary-mute columns required by the
-- "Beacons You Follow" management screen.
--
-- last_seen_at: timestamp of the most recent view of the beacon's
--   broadcasts by this fan. Drives the "N new updates" badge.
--   Left nullable; the GET /me/following route falls back to joined_at
--   when the column is null (handles new follows + skips a slow backfill
--   on a hot table).
--
-- muted_until: temporary mute expiry (NULL = not muted). Distinct from
--   the legacy status='muted' value, which represents a permanent
--   owner-imposed mute and suppresses the row entirely. This column
--   only gates push notifications; the row stays visible in the fan's
--   followed list.
--
-- Idempotent: safe to re-run. No indexes are added — neither column is
-- used in a query predicate today, so the partial-index cost isn't
-- justified. A future "show me only muted beacons" filter can add one.

ALTER TABLE "public"."PersonaMembership"
  ADD COLUMN IF NOT EXISTS "last_seen_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "muted_until" timestamp with time zone;
