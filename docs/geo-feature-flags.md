# Geo Migration Feature Flags

Four independent, rollback-safe feature flags control the geo migration rollout.
Each flag defaults to **enabled** (new behavior). Set to `false` or `0` to revert
the specific subsystem to its legacy path — no all-or-nothing toggle required.

## Flag Reference

| Env Var | Default | Backend | Web | Mobile | Description |
|---------|---------|---------|-----|--------|-------------|
| `GEO_USE_NEW_PROVIDER` | `true` | ✅ | — | — | Use factory-selected GeoProvider vs force Mapbox |
| `GEO_USE_MAPBOX_TILES` | `true` | — | ✅ `NEXT_PUBLIC_` | — | Mapbox raster tiles vs OSM tiles |
| `GEO_USE_RESOLVE_FLOW` | `true` | — | ✅ `NEXT_PUBLIC_` | ✅ `EXPO_PUBLIC_` | `/resolve` endpoint vs deprecated `/normalize` |
| `GEO_PROVENANCE_WRITE` | `true` | ✅ | — | — | Write geocode provenance metadata columns |

## Per-Flag Details

### `GEO_USE_NEW_PROVIDER`

**Where:** `backend/services/geo/index.js`, logged in `backend/routes/geo.js`

When **true** (default): the provider factory selects the implementation based
on the `GEO_PROVIDER` env var (currently only `mapbox`).

When **false**: the factory is bypassed and `mapboxProvider` is always loaded,
regardless of `GEO_PROVIDER`. All route logs show `provider: 'mapbox_legacy'`
instead of `'geo_provider'` for observability.

**Rollback:** `GEO_USE_NEW_PROVIDER=false` → restart backend.

---

### `GEO_USE_MAPBOX_TILES`

**Where:** `frontend/apps/web/src/components/map/constants.ts`

Env var: `NEXT_PUBLIC_GEO_USE_MAPBOX_TILES`

When **true** (default): map tiles are loaded from Mapbox (`streets-v12`).

When **false**: map tiles fall back to OSM raster tiles
(`https://tile.openstreetmap.org/{z}/{x}/{y}.png`) with simplified attribution.
No Mapbox token is needed in this mode.

**Rollback:** `NEXT_PUBLIC_GEO_USE_MAPBOX_TILES=false` → redeploy web.

---

### `GEO_USE_RESOLVE_FLOW`

**Where:** `frontend/packages/api/src/endpoints/geo.ts`

Env vars: `NEXT_PUBLIC_GEO_USE_RESOLVE_FLOW` (web), `EXPO_PUBLIC_GEO_USE_RESOLVE_FLOW` (mobile)

When **true** (default): the `resolve()` API function calls `POST /api/geo/resolve`.

When **false**: `resolve()` internally routes to the deprecated
`POST /api/geo/normalize` endpoint instead, passing `{ feature: { id: suggestionId } }`.
This restores the old normalize-based lookup path while keeping the same call
signature in consumer components.

**Rollback:** `NEXT_PUBLIC_GEO_USE_RESOLVE_FLOW=false` → redeploy web.
`EXPO_PUBLIC_GEO_USE_RESOLVE_FLOW=false` → rebuild mobile.

---

### `GEO_PROVENANCE_WRITE`

**Where:** `backend/routes/posts.js`, `listings.js`, `home.js`, `magicTask.js`

When **true** (default): create/update handlers write geocode provenance columns
(`geocode_provider`, `geocode_mode`, `geocode_accuracy`, `geocode_place_id`,
`geocode_source_flow`, `geocode_created_at`) alongside location data.

When **false**: provenance columns are omitted; only lat/lng are written.
Existing rows are not modified.

**Rollback:** `GEO_PROVENANCE_WRITE=false` → restart backend.

## Verification

With **all flags set to `false`**, the system should behave identically to the
pre-migration baseline:

1. Backend geocoding uses `mapboxProvider` directly (no factory indirection).
2. Web maps render OSM tiles.
3. Address selection flows through `/normalize` instead of `/resolve`.
4. No provenance metadata is written to the database.

### Quick smoke test

```bash
# Backend — verify legacy provider path
GEO_USE_NEW_PROVIDER=false GEO_PROVENANCE_WRITE=false node -e "
  const geo = require('./config/geo');
  console.log('NEW_PROVIDER:', geo.GEO_USE_NEW_PROVIDER);  // false
  console.log('PROVENANCE:', geo.GEO_PROVENANCE_WRITE);     // false
"

# Web — verify OSM tiles
NEXT_PUBLIC_GEO_USE_MAPBOX_TILES=false npx next build  # → check tile URL in output
```

## Flag Parsing

All flags use the `envFlag(name, defaultValue)` helper in `backend/config/geo.js`:

- Unset or empty string → `defaultValue` (true)
- `'0'` or `'false'` (case-insensitive) → `false`
- Any other value → `true`

Frontend flags (`NEXT_PUBLIC_*`, `EXPO_PUBLIC_*`) use inline parsing with the
same `'0'` / `'false'` convention.

## Dependencies

The four flags are fully independent. They can be toggled in any combination.
No flag depends on another flag's value.

## Files Modified

| File | Flags Used |
|------|------------|
| `backend/config/geo.js` | Defines all 4 flags + `envFlag()` helper |
| `backend/.env.example` | Documents all 4 flags |
| `backend/services/geo/index.js` | `GEO_USE_NEW_PROVIDER` |
| `backend/routes/geo.js` | `GEO_USE_NEW_PROVIDER` (logging) |
| `backend/routes/posts.js` | `GEO_PROVENANCE_WRITE` |
| `backend/routes/listings.js` | `GEO_PROVENANCE_WRITE` |
| `backend/routes/home.js` | `GEO_PROVENANCE_WRITE` |
| `backend/routes/magicTask.js` | `GEO_PROVENANCE_WRITE` |
| `frontend/apps/web/src/components/map/constants.ts` | `GEO_USE_MAPBOX_TILES` |
| `frontend/packages/api/src/endpoints/geo.ts` | `GEO_USE_RESOLVE_FLOW` |
