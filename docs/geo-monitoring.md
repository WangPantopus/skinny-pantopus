# Geo Observability — Metrics, Queries & Alerts

> **Logging stack:** Winston 3 → stdout (`printf` format) + `combined.log` (50 MB × 5 rotated).
> Log lines follow the pattern: `<timestamp> [<level>]: <event> {JSON meta}`
>
> **APM:** In-memory per-route p50/p95/p99 via `backend/middleware/apm.js`.
> Exposes `getMetrics()` for ad-hoc inspection.
>
> **Cache:** In-memory LRU (`backend/utils/geoCache.js`), no built-in counters.

---

## 1  Key Metrics

These are the geo subsystem metrics referenced in the migration plan (§ 6.9).

| # | Metric | Source event / field | Notes |
|---|--------|---------------------|-------|
| M1 | Autocomplete request count | `geo_request` where `endpoint = '/geo/autocomplete'` | Per-minute throughput |
| M2 | Autocomplete success rate | `geo_response` where `endpoint = '/geo/autocomplete'` AND `status = 200` ÷ total | Include cache hits |
| M3 | Autocomplete error rate | `geo_response` where `status = 500` | Also watch `mapbox_autocomplete_error` |
| M4 | Resolve success / error | `geo_response` where `endpoint = '/geo/resolve'` | Track `mapbox_resolve_error` separately |
| M5 | Reverse geocode success / error | `geo_response` where `endpoint = '/geo/reverse'` | 404 = no address ≠ failure |
| M6 | Geocode cache hit rate | `geo_response` where `cache_hit = true` ÷ total | Per-endpoint breakdown recommended |
| M7 | Map viewport fetch latency | APM `GET /geo/reverse` p95 | Collected by `apm.js` |
| M8 | Map empty-state rate | `geo_response` where `result_count = 0` AND `endpoint = '/geo/autocomplete'` | Filter out short queries (< 3 chars return empty by design) |
| M9 | Provider fallback rate | `geo_provider_flag` at startup + `provider` field in `geo_response` showing `mapbox_legacy` | Non-zero when `GEO_USE_NEW_PROVIDER=false` |
| M10 | Address validation success by step | `geo_response` per endpoint (autocomplete → resolve → reverse) | Track funnel conversion |
| M11 | Tile load errors | Client-side only — `tilecachemiss` events in `CachedTileLayer.tsx` | Not yet reported to backend; see Gap G4 below |
| M12 | Normalize (deprecated) usage | `geo_deprecated_endpoint` count | Should trend toward zero |
| M13 | Resolve cache miss (provider-level) | `geo_resolve_cache_miss` from `mapboxProvider.js` | Extra Mapbox API call triggered |

---

## 2  Alert Definitions

Each alert specifies: **condition**, **log query**, **threshold**, **window**, and **remediation**.

### A1 — Geocoder Error Rate > 5 %

| Field | Value |
|-------|-------|
| **Condition** | `status = 500` events from any `/geo/*` endpoint exceed 5 % of total requests |
| **Window** | 5 minutes (rolling) |
| **Severity** | Critical |

**Query (grep / structured-log search):**

```bash
# Count errors in last 5 min
grep 'geo_response' combined.log \
  | grep '"status":500' \
  | awk -v cutoff="$(date -u -v-5M +%Y-%m-%dT%H:%M:%S)" '$1 >= cutoff' \
  | wc -l

# Count total in last 5 min
grep 'geo_response' combined.log \
  | awk -v cutoff="$(date -u -v-5M +%Y-%m-%dT%H:%M:%S)" '$1 >= cutoff' \
  | wc -l
```

**Structured query (CloudWatch Logs Insights / Datadog Logs equivalent):**

```
filter @message like /geo_response/
| parse @message '"status":*,' as status
| stats count(*) as total,
        sum(case when status = 500 then 1 else 0 end) as errors
| filter errors / total > 0.05
```

**Remediation:**
1. Check `mapbox_autocomplete_error`, `mapbox_resolve_error`, `mapbox_reverse_error` for upstream Mapbox failures.
2. If Mapbox is down → set `GEO_USE_NEW_PROVIDER=false` and restart to force legacy path (see runbook R3).
3. If errors are on `/normalize` only → clients still using deprecated endpoint; check `geo_deprecated_endpoint` logs.

---

### A2 — Tile Auth Failure Rate > 1 %

| Field | Value |
|-------|-------|
| **Condition** | Mapbox tile 401/403 responses exceed 1 % of tile requests |
| **Window** | 5 minutes |
| **Severity** | Critical |

**Note:** Tile requests are client-side (browser → Mapbox CDN). No server logs
exist for these. Detection requires one of:
- Client-side error reporting (recommended: add Sentry/analytics hook to the
  `tilecachemiss` / `tileerror` events in `CachedTileLayer.tsx`).
- Mapbox dashboard tile request metrics.

**Interim detection (server-side proxy):**

If tile requests go through a backend proxy, grep for 401/403:

```bash
grep 'tile' combined.log | grep -E '"status":(401|403)' | wc -l
```

**Remediation:**
1. Verify `NEXT_PUBLIC_MAPBOX_TOKEN` is set and hasn't expired.
2. Check Mapbox account dashboard for token restrictions or billing issues.
3. Fallback: set `NEXT_PUBLIC_GEO_USE_MAPBOX_TILES=false` to switch to OSM tiles (see runbook R1).

---

### A3 — Address Validation Success Rate < 90 %

| Field | Value |
|-------|-------|
| **Condition** | Resolve success (status 200 on `/geo/resolve`) drops below 90 % of resolve attempts |
| **Window** | 10 minutes |
| **Severity** | Warning |

**Query:**

```bash
# Success count
grep 'geo_response' combined.log \
  | grep '/geo/resolve' \
  | grep '"status":200' \
  | awk -v cutoff="$(date -u -v-10M +%Y-%m-%dT%H:%M:%S)" '$1 >= cutoff' \
  | wc -l

# Total count
grep 'geo_response' combined.log \
  | grep '/geo/resolve' \
  | awk -v cutoff="$(date -u -v-10M +%Y-%m-%dT%H:%M:%S)" '$1 >= cutoff' \
  | wc -l
```

**Structured query:**

```
filter @message like /geo_response/ and @message like /\/geo\/resolve/
| stats count(*) as total,
        sum(case when @message like /"status":200/ then 1 else 0 end) as success
| filter total > 10 and success / total < 0.90
```

**Remediation:**
1. Check `geo_resolve_cache_miss` rate — high miss rate may indicate autocomplete ↔ resolve session desync.
2. Check `mapbox_resolve_error` for upstream failures.
3. If persistent → roll back to normalize flow: set `NEXT_PUBLIC_GEO_USE_RESOLVE_FLOW=false` (see runbook R3).

---

### A4 — Geo Endpoint p95 Latency > 1000 ms

| Field | Value |
|-------|-------|
| **Condition** | p95 `response_time_ms` on any `/geo/*` endpoint exceeds 1000 ms |
| **Window** | 10 minutes |
| **Severity** | Warning |

**Query (extract response_time_ms from logs):**

```bash
grep 'geo_response' combined.log \
  | awk -v cutoff="$(date -u -v-10M +%Y-%m-%dT%H:%M:%S)" '$1 >= cutoff' \
  | grep -oP '"response_time_ms":\K[0-9.]+' \
  | sort -n \
  | awk '{a[NR]=$1} END {print "p95:", a[int(NR*0.95)]}'
```

**APM (in-memory, real-time):**

```js
const apm = require('./middleware/apm');
const metrics = apm.getMetrics();
// Check: metrics['GET /geo/autocomplete'].p95_ms
// Check: metrics['POST /geo/resolve'].p95_ms
// Check: metrics['GET /geo/reverse'].p95_ms
```

**Structured query:**

```
filter @message like /geo_response/
| parse @message '"response_time_ms":*,' as latency
| stats pct(latency, 95) as p95 by endpoint
| filter p95 > 1000
```

**Remediation:**
1. Check Mapbox status page for degraded performance.
2. Review cache hit rate (A5) — low hit rate causes more upstream calls.
3. Check server load / memory (in-memory cache may be evicting under pressure).
4. If Mapbox is slow → the provider abstraction doesn't help; could temporarily increase cache TTL in route handlers.

---

### A5 — Cache Hit Rate < 50 %

| Field | Value |
|-------|-------|
| **Condition** | `cache_hit = true` events drop below 50 % of total `geo_response` events |
| **Window** | 10 minutes |
| **Severity** | Warning |

**Query:**

```bash
grep 'geo_response' combined.log \
  | awk -v cutoff="$(date -u -v-10M +%Y-%m-%dT%H:%M:%S)" '$1 >= cutoff' \
  | tee >(grep '"cache_hit":true' | wc -l > /tmp/hits) \
  | wc -l > /tmp/total
echo "hit rate: $(cat /tmp/hits) / $(cat /tmp/total)"
```

**Structured query:**

```
filter @message like /geo_response/
| stats count(*) as total,
        sum(case when @message like /"cache_hit":true/ then 1 else 0 end) as hits
| filter total > 20 and hits / total < 0.50
```

**Remediation:**
1. A sustained low hit rate may indicate:
   - Process restart (cache is in-memory, lost on restart).
   - Unusual traffic spike with many unique queries.
   - Memory pressure causing excessive LRU eviction (max 2000 entries).
2. If after recent deploy → expected; cache warms over ~5 minutes—wait and re-check.
3. If persistent → investigate whether the 2000-entry or TTL limits need tuning in `geoCache.js`.

---

## 3  Dashboard Panels

Recommended panels for a Grafana / CloudWatch / Datadog dashboard:

| Panel | Type | Query basis |
|-------|------|-------------|
| Geo request rate | Time-series | Count of `geo_request` per minute, grouped by `endpoint` |
| Error rate by endpoint | Time-series (%) | `status=500` / total from `geo_response`, grouped by `endpoint` |
| p95 latency by endpoint | Time-series | `response_time_ms` percentiles from `geo_response` |
| Cache hit ratio | Gauge + time-series | `cache_hit=true` / total from `geo_response` |
| Provider distribution | Pie chart | `provider` field values from `geo_response` |
| Deprecated endpoint usage | Time-series | Count of `geo_deprecated_endpoint` events |
| Resolve cache miss rate | Time-series | Count of `geo_resolve_cache_miss` events |
| Coordinate validation results | Bar chart | `[validateCoords]` job log results |
| Active feature flags | Status panel | One-time startup log `geo_provider_flag` + env dump |

---

## 4  Known Observability Gaps

| # | Gap | Impact | Recommendation |
|---|-----|--------|----------------|
| G1 | Log format is `printf`, not JSON | Hard to parse in log aggregators | Add a JSON transport for production or switch `winston.format.json()` |
| G2 | `geoCache` emits no metrics | Can't track hit/miss/eviction rates directly; rely on route-level `cache_hit` field | Add `hits`/`misses`/`evictions` counters to `GeoCache` class |
| G3 | APM metrics are in-memory only | Lost on restart; no external export | Export to Prometheus `/metrics` endpoint or push to Datadog/CloudWatch |
| G4 | Tile load failures are client-side only | No server visibility into tile auth errors | Add error reporting hook in `CachedTileLayer.tsx` (`tilecachemiss` → analytics/Sentry) |
| G5 | `validateHomeCoordinates` job bypasses `geoProvider` | Its Mapbox errors don't match provider-level log events | Refactor job to use `geoProvider.reverseGeocode()` |
