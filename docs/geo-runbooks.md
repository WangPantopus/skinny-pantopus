# Geo Runbooks — Operational Procedures

Quick-reference procedures for the geo subsystem. Each runbook covers:
**when to use it**, **steps**, **verification**, and **rollback**.

> **Pre-requisite:** SSH / deploy access to the backend service and the ability
> to set environment variables and restart the process (or trigger a redeploy).

---

## R1 — Switch Tile Provider (Mapbox ↔ OSM)

**When:** Mapbox tile CDN is down, tokens are expired/revoked, or billing is
suspended — users see grey/broken map tiles.

### Steps

1. **Set the feature flag** on the web deployment:

   ```bash
   # Disable Mapbox tiles → fall back to OSM
   NEXT_PUBLIC_GEO_USE_MAPBOX_TILES=false
   ```

2. **Redeploy the web app** (Next.js requires a rebuild for `NEXT_PUBLIC_*`
   env vars to take effect):

   ```bash
   pnpm --filter web build && pnpm --filter web start
   # or trigger your CI/CD pipeline
   ```

3. **No backend restart needed** — tiles are loaded client-side.

### Verification

- Open the web app in a browser and inspect the map.
- Tiles should now be served from `tile.openstreetmap.org`.
- Check the Network tab — requests go to `tile.openstreetmap.org/{z}/{x}/{y}.png`
  with no `access_token` query param.
- Attribution should read "© OpenStreetMap contributors".

### Rollback

Remove or set `NEXT_PUBLIC_GEO_USE_MAPBOX_TILES=true` (or unset — defaults to
`true`), rebuild, and redeploy.

---

## R2 — Disable Autocomplete Temporarily

**When:** Mapbox geocoding API is returning errors or extreme latency, and you
want to stop making upstream calls while keeping the rest of the app running.

### Option A — Return empty results (no code change)

The autocomplete handler already returns `{ suggestions: [] }` for queries
shorter than 3 characters. To make it return empty for *all* queries, set the
Mapbox server token to an empty string:

```bash
# Unset the server-side Mapbox token
MAPBOX_ACCESS_TOKEN=''
```

Restart the backend. The `requireToken()` guard in `mapboxProvider.js` will
throw, and the route error handler returns `{ error: "..." }` with status 500.

> **Downside:** This also breaks `/resolve` and `/reverse`.

### Option B — Rate-limit to zero (middleware)

If you have rate-limit middleware configured, set the geo endpoint limit to 0:

```bash
GEO_RATE_LIMIT=0   # if your rateLimiter reads this
```

### Option C — Feature flag (recommended)

Set `GEO_USE_NEW_PROVIDER=false` so the factory forces `mapboxProvider`
directly. If the issue is with the factory/future provider rather than Mapbox
itself, this bypasses the abstraction:

```bash
GEO_USE_NEW_PROVIDER=false
```

Restart the backend.

### Verification

```bash
curl -s "https://your-api/api/geo/autocomplete?q=portland" | jq .
# Should return { "suggestions": [] } or { "error": "..." }
```

Check logs:
```bash
grep 'geo_response.*autocomplete' backend/logs/combined.log | tail -5
```

### Rollback

Restore `MAPBOX_ACCESS_TOKEN` to its real value (or unset
`GEO_USE_NEW_PROVIDER`), restart the backend.

---

## R3 — Force Fallback to Old Geo Paths (Feature Flags)

**When:** The new provider abstraction or resolve flow is causing regressions
and you need to revert per-subsystem without a full code rollback.

There are four independent flags. Set any combination:

| Flag | Set to `false` to… | Where to set | Restart? |
|------|---------------------|--------------|----------|
| `GEO_USE_NEW_PROVIDER` | Bypass provider factory → force `mapboxProvider` | Backend env | Yes |
| `GEO_USE_MAPBOX_TILES` | Use OSM tiles instead of Mapbox | Web env (`NEXT_PUBLIC_`) | Rebuild web |
| `GEO_USE_RESOLVE_FLOW` | Route `resolve()` calls to `/normalize` instead | Web env (`NEXT_PUBLIC_`) / Mobile env (`EXPO_PUBLIC_`) | Rebuild |
| `GEO_PROVENANCE_WRITE` | Skip writing geocode provenance columns | Backend env | Yes |

### Steps (example: roll back everything)

```bash
# Backend
export GEO_USE_NEW_PROVIDER=false
export GEO_PROVENANCE_WRITE=false
# restart backend

# Web
export NEXT_PUBLIC_GEO_USE_MAPBOX_TILES=false
export NEXT_PUBLIC_GEO_USE_RESOLVE_FLOW=false
# rebuild & redeploy web

# Mobile
export EXPO_PUBLIC_GEO_USE_RESOLVE_FLOW=false
# rebuild mobile
```

### Verification

**Backend — check startup log:**
```bash
grep 'geo_provider_flag' backend/logs/combined.log | tail -1
# Should show: { flag: 'GEO_USE_NEW_PROVIDER', value: false, action: 'forcing mapboxProvider (legacy mode)' }
```

**Backend — check route logs use legacy label:**
```bash
grep 'geo_response' backend/logs/combined.log | tail -5
# provider field should be "mapbox_legacy" not "geo_provider"
```

**Web — check tiles:**
Open DevTools → Network → filter `tile.openstreetmap.org`.

**Web — check resolve falls back to normalize:**
Search for an address → DevTools → Network → should call `/api/geo/normalize`
instead of `/api/geo/resolve`.

**Provenance — verify no metadata written:**
```sql
SELECT geocode_provider, geocode_source_flow
FROM "Post"
WHERE created_at > NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC
LIMIT 5;
-- geocode_provider and geocode_source_flow should be NULL for new rows
```

### Rollback

Unset the flags (or set to `true`), restart backend, rebuild & redeploy
frontend.

---

## R4 — Pause Re-Geocode / Coordinate Validation Jobs

**When:** Mapbox API is rate-limited or billing is suspended, and background
jobs are burning through the quota or logging errors.

### Which jobs are affected?

| Job | Schedule | File |
|-----|----------|------|
| `validateHomeCoordinates` | Every 30 min (:12, :42) | `backend/jobs/validateHomeCoordinates.js` |

> Note: `recomputeUtilityScores` reads lat/lng but makes no Mapbox calls.

### Option A — Disable via environment variable

The job runner in `backend/jobs/index.js` uses `node-cron`. To skip a specific
job without stopping the whole scheduler:

```bash
# Set a kill-switch env var (requires code support — see "Adding a kill-switch" below)
DISABLE_JOB_VALIDATE_HOME_COORDS=true
```

### Option B — Comment out in job index (quick fix)

Edit `backend/jobs/index.js` and comment out the `validateHomeCoordinates`
schedule entry:

```js
// cron.schedule('12,42 * * * *', () => runJob('validateHomeCoordinates', validateHomeCoordinates));
```

Restart the backend.

### Option C — Stop the cron process entirely

If all scheduled jobs should stop:

```bash
# If jobs run in a separate worker process
docker stop pantopus-worker
# or
pm2 stop jobs
```

### Adding a kill-switch (recommended enhancement)

Add to the job runner wrapper in `backend/jobs/index.js`:

```js
function runJob(name, fn) {
  const envKey = `DISABLE_JOB_${name.replace(/[A-Z]/g, c => '_' + c).toUpperCase()}`;
  if (process.env[envKey] === 'true') {
    logger.info(`[CRON] Skipped (disabled): ${name}`);
    return;
  }
  // ... existing run logic
}
```

### Verification

```bash
# Check no validation runs in last hour
grep 'validateCoords' backend/logs/combined.log | tail -5
# Should show no new entries after the change

# Or check cron log
grep '\[CRON\].*validateHomeCoordinates' backend/logs/combined.log | tail -3
```

### Rollback

Uncomment the schedule entry (Option B), or unset `DISABLE_JOB_*` env var
(Option A), or restart the worker (Option C). The next cron tick will resume
the job.

---

## Quick Reference — Environment Variables

All geo-related env vars in one place:

| Variable | Runtime | Default | Purpose |
|----------|---------|---------|---------|
| `MAPBOX_ACCESS_TOKEN` | Backend | (none) | Server-side geocoding token |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Web | (none) | Client-side tile/style token |
| `GEO_PROVIDER` | Backend | `mapbox` | Active geocoding provider |
| `GEO_USE_NEW_PROVIDER` | Backend | `true` | Feature flag: provider factory |
| `GEO_USE_MAPBOX_TILES` | Web (`NEXT_PUBLIC_`) | `true` | Feature flag: tile source |
| `GEO_USE_RESOLVE_FLOW` | Web/Mobile (`NEXT_PUBLIC_` / `EXPO_PUBLIC_`) | `true` | Feature flag: resolve vs normalize |
| `GEO_PROVENANCE_WRITE` | Backend | `true` | Feature flag: provenance metadata |

**Flag parsing:** `'0'` or `'false'` (case-insensitive) → disabled.
Anything else (including unset) → enabled.

---

## Escalation Path

1. **Self-service:** Use the runbooks above to toggle flags and pause jobs.
2. **Check upstream:** [Mapbox Status](https://status.mapbox.com/) for API/CDN health.
3. **Code rollback:** If flags don't resolve the issue, revert to the last
   known-good deploy (pre-geo-migration tag).
4. **Database:** Provenance columns are nullable — disabling `GEO_PROVENANCE_WRITE`
   leaves existing data intact and writes NULLs going forward. No migration needed.
