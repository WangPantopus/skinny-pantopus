# Geo Migration — Staged Rollout Plan

> **Owner:** Eng team · **Last updated:** 2026-03-10
>
> **Pre-requisites:** Feature flags (Prompt 7-1), monitoring (Prompt 7-2),
> runbooks (Prompt 7-2), E2E tests (Prompt 7-3) are all in place.

---

## 1  Rollout Stages

| Stage | Audience | % Traffic | Duration | Gate |
|-------|----------|-----------|----------|------|
| S0 — Baseline | Nobody (new code deployed, all flags `false`) | 0 % | 1 day | Deploy clean, collect baseline metrics |
| S1 — Internal | Engineering team (by user ID allowlist) | ~10 users | 2 days | Go/no-go review |
| S2 — Dogfood | First 50 beta users | ~50 users | 3 days | Go/no-go review |
| S3 — 5 % | Consistent-hash cohort | 5 % | 3 days | Go/no-go review |
| S4 — 25 % | Consistent-hash cohort | 25 % | 3 days | Go/no-go review |
| S5 — GA | All users | 100 % | Ongoing | Post-launch monitoring |

---

## 2  Feature Flag Configuration per Stage

All four flags from `backend/config/geo.js` are toggled independently. The
table below shows the target state at each stage.

| Flag | S0 | S1 | S2 | S3 | S4 | S5 |
|------|----|----|----|----|----|----|
| `GEO_USE_NEW_PROVIDER` | `false` | gated | gated | gated | gated | `true` |
| `GEO_USE_MAPBOX_TILES` | `false` | gated | gated | gated | gated | `true` |
| `GEO_USE_RESOLVE_FLOW` | `false` | gated | gated | gated | gated | `true` |
| `GEO_PROVENANCE_WRITE` | `false` | gated | gated | gated | gated | `true` |

"gated" = enabled only for users in the active cohort (see § 3 below).

---

## 3  Audience Gating Logic

The gating mechanism determines whether a given user should receive the new
geo behavior. Each stage uses a progressively broader audience.

### 3.1  Environment Variables

Add three runtime env vars to control the gate:

| Env Var | Type | Example | Description |
|---------|------|---------|-------------|
| `GEO_ROLLOUT_STAGE` | string | `internal` | Current rollout stage: `off`, `internal`, `dogfood`, `percent`, `ga` |
| `GEO_ROLLOUT_IDS` | string | `aaa…,bbb…` | Comma-separated user UUIDs for `internal` and `dogfood` stages |
| `GEO_ROLLOUT_PERCENT` | integer | `5` | Percentage of users to include in `percent` stage (1–99) |

### 3.2  Gating Function

Add to `backend/config/geo.js` (or a new `backend/utils/geoRollout.js`):

```js
const crypto = require('crypto');

const GEO_ROLLOUT_STAGE = (process.env.GEO_ROLLOUT_STAGE || 'off').toLowerCase();
const GEO_ROLLOUT_IDS = (process.env.GEO_ROLLOUT_IDS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const GEO_ROLLOUT_PERCENT = Math.min(
  100,
  Math.max(0, parseInt(process.env.GEO_ROLLOUT_PERCENT || '0', 10) || 0)
);

/**
 * Determine whether `userId` should experience the new geo behavior.
 *
 * Uses consistent hashing so the same user always gets the same result
 * (no flip-flopping between requests).
 */
function isGeoEnabled(userId) {
  switch (GEO_ROLLOUT_STAGE) {
    case 'ga':
      return true;

    case 'off':
      return false;

    case 'internal':
    case 'dogfood':
      return GEO_ROLLOUT_IDS.includes(userId);

    case 'percent': {
      // Consistent hash: SHA-256 of the user ID → first 4 bytes → mod 100
      const hash = crypto.createHash('sha256').update(userId).digest();
      const bucket = hash.readUInt32BE(0) % 100;
      return bucket < GEO_ROLLOUT_PERCENT;
    }

    default:
      return false;
  }
}
```

**Consistent hashing properties:**
- Deterministic — same user ID always produces the same bucket.
- Uniform — SHA-256 distributes evenly across buckets.
- Monotonically inclusive — a user in the 5 % cohort stays in the 25 % and
  100 % cohorts (because `bucket < 5` ⊂ `bucket < 25` ⊂ `bucket < 100`).

### 3.3  Stage-Specific Audience Configuration

#### S1 — Internal Team

```bash
GEO_ROLLOUT_STAGE=internal
GEO_ROLLOUT_IDS=<comma-separated UUIDs of engineering team members>
```

Identify internal users with:
```sql
SELECT id, email FROM auth.users
WHERE email LIKE '%@pantopus.com'
ORDER BY created_at;
```

#### S2 — Dogfood (First 50 Beta Users)

```bash
GEO_ROLLOUT_STAGE=dogfood
GEO_ROLLOUT_IDS=<comma-separated UUIDs of first 50 beta users>
```

Identify beta users with:
```sql
SELECT id, email FROM auth.users
ORDER BY created_at ASC
LIMIT 50;
```

Append the internal IDs from S1 so the engineering team stays enrolled.

#### S3 — 5 % of All Users

```bash
GEO_ROLLOUT_STAGE=percent
GEO_ROLLOUT_PERCENT=5
```

No ID list needed — consistent hashing selects the cohort automatically.
Previous `internal` and `dogfood` users will either be in the 5 % bucket
already (statistically likely for most) or can be force-included by combining:
```bash
GEO_ROLLOUT_STAGE=percent
GEO_ROLLOUT_PERCENT=5
GEO_ROLLOUT_IDS=<internal + dogfood IDs as fallback override>
```

Update `isGeoEnabled()` for the combined check:
```js
case 'percent': {
  if (GEO_ROLLOUT_IDS.includes(userId)) return true; // override
  const hash = crypto.createHash('sha256').update(userId).digest();
  const bucket = hash.readUInt32BE(0) % 100;
  return bucket < GEO_ROLLOUT_PERCENT;
}
```

#### S4 — 25 %

```bash
GEO_ROLLOUT_STAGE=percent
GEO_ROLLOUT_PERCENT=25
```

#### S5 — GA (100 %)

```bash
GEO_ROLLOUT_STAGE=ga
# or simply:
GEO_ROLLOUT_PERCENT=100
```

At GA, all four feature flags can be hard-set to `true` and the gating
function becomes a no-op. Plan to remove gating code in the next release
cycle.

---

## 4  Integrating the Gate with Feature Flags

Each flag check should be wrapped so it respects the per-user gate. In route
handlers with access to `req.user.id`:

```js
const { isGeoEnabled } = require('../utils/geoRollout');
const geoConfig = require('../config/geo');

// Instead of reading the flag directly:
//   if (geoConfig.GEO_USE_NEW_PROVIDER) { … }
// Use the gated version:
const useNewProvider = geoConfig.GEO_USE_NEW_PROVIDER && isGeoEnabled(req.user.id);
```

For **client-side flags** (`GEO_USE_MAPBOX_TILES`, `GEO_USE_RESOLVE_FLOW`),
the gating decision must be communicated to the frontend. Two options:

**Option A — Server-rendered config endpoint:**

```
GET /api/config/geo?userId=<id>
→ { useMapboxTiles: true, useResolveFlow: true }
```

The frontend fetches this on app load and uses the response instead of reading
`NEXT_PUBLIC_*` env vars directly.

**Option B — Middleware (SSR apps):**

For Next.js SSR, compute the gate in `getServerSideProps` / middleware and
inject it into the page props. This avoids an extra API call.

---

## 5  Monitoring Checklist per Stage

At every stage, monitor the following metrics before advancing to the next.
Reference: `docs/geo-monitoring.md` for queries and alert definitions.

### 5.1  Core Metrics

| # | Metric | Source | Baseline Collected At |
|---|--------|--------|-----------------------|
| M1 | Geo endpoint error rate (5xx) | A1 alert, `geo_response` where `status=500` | S0 |
| M2 | Tile load success rate | Client-side `tileerror` events or Mapbox dashboard | S0 |
| M3 | Autocomplete → resolve funnel completion | `geo_response` per endpoint pair | S0 |
| M4 | Address validation success rate (resolve 200s) | A3 alert, `geo_response` `/geo/resolve` | S0 |
| M5 | Geo endpoint p95 latency | A4 alert, APM `getMetrics()` | S0 |
| M6 | Cache hit rate | A5 alert, `geo_response` `cache_hit` field | S0 |
| M7 | Map-related support tickets | Support queue, tagged `geo` / `map` / `address` | S0 |

### 5.2  Stage-Specific Checks

| Stage | Additional Checks |
|-------|-------------------|
| S0 (Baseline) | Record all metrics above for 24 h with flags `false`. This is the comparison baseline for all subsequent stages. |
| S1 (Internal) | Manual smoke test all 6 flows: autocomplete, resolve, reverse, home onboarding, business location, gig creation. Verify provenance columns are written. Check logs for `provider: 'geo_provider'`. |
| S2 (Dogfood) | All S1 checks + watch for user-reported issues in beta channel. Verify consistent hashing stability (same user sees same behavior on repeat visits). |
| S3 (5 %) | All S2 checks + compare cohort metrics vs control. Look for statistically significant differences in error rate, latency, and funnel completion. |
| S4 (25 %) | All S3 checks + load/capacity review. Mapbox API usage should scale linearly — verify no rate-limit 429s. |
| S5 (GA) | All S4 checks + confirm deprecated `/normalize` usage (M12) is zero. Plan removal of gating code and legacy paths. |

### 5.3  Monitoring Queries (Quick Reference)

**Error rate comparison (cohort vs control):**

```bash
# Cohort errors (requests with provider='geo_provider')
grep 'geo_response' combined.log \
  | grep '"provider":"geo_provider"' \
  | grep '"status":500' | wc -l

# Cohort total
grep 'geo_response' combined.log \
  | grep '"provider":"geo_provider"' | wc -l

# Control errors (requests with provider='mapbox_legacy')
grep 'geo_response' combined.log \
  | grep '"provider":"mapbox_legacy"' \
  | grep '"status":500' | wc -l

# Control total
grep 'geo_response' combined.log \
  | grep '"provider":"mapbox_legacy"' | wc -l
```

**Latency comparison:**

```bash
# Cohort p95
grep 'geo_response' combined.log \
  | grep '"provider":"geo_provider"' \
  | grep -oP '"response_time_ms":\K[0-9.]+' \
  | sort -n | awk '{a[NR]=$1} END {print "p95:", a[int(NR*0.95)]}'

# Control p95
grep 'geo_response' combined.log \
  | grep '"provider":"mapbox_legacy"' \
  | grep -oP '"response_time_ms":\K[0-9.]+' \
  | sort -n | awk '{a[NR]=$1} END {print "p95:", a[int(NR*0.95)]}'
```

---

## 6  Go / No-Go Criteria

### 6.1  Quantitative Criteria

A stage **passes** if ALL of the following hold for the full observation window:

| # | Criterion | Threshold | Measurement |
|---|-----------|-----------|-------------|
| G1 | Geo endpoint error rate | ≤ baseline + 10 % (relative) | `status=500` / total `geo_response` |
| G2 | Tile load success rate | ≥ baseline − 10 % (relative) | Client-side tile success / total tile requests |
| G3 | Address flow completion rate | ≥ baseline − 10 % (relative) | Resolve 200s / autocomplete 200s |
| G4 | Geo endpoint p95 latency | ≤ baseline + 10 % (relative) | APM or log-derived p95 |
| G5 | Cache hit rate | ≥ baseline − 10 % (relative) | `cache_hit=true` / total |
| G6 | Support tickets (geo/map) | ≤ baseline + 2 tickets/day | Support queue |

**Example:** If the S0 baseline error rate is 0.5 %, the G1 threshold for
subsequent stages is ≤ 0.55 % (0.5 × 1.10).

### 6.2  Qualitative Criteria

| # | Criterion |
|---|-----------|
| Q1 | No P0/P1 bugs reported against the new geo behavior |
| Q2 | No Mapbox API rate-limit warnings (429s) |
| Q3 | Internal/dogfood users report no UX regressions |
| Q4 | Provenance data is accurate (spot-check 10 records per stage) |

### 6.3  Go / No-Go Decision Matrix

| Quantitative | Qualitative | Decision |
|--------------|-------------|----------|
| All pass | All pass | **GO** — advance to next stage |
| All pass | 1+ fail | **HOLD** — investigate qualitative issue, fix, re-evaluate |
| 1+ fail | — | **NO-GO** — do not advance; see § 7 for rollback |

---

## 7  Rollback Procedure

### 7.1  Automatic Rollback Triggers

Roll back immediately (do not wait for go/no-go review) if any of:

| Trigger | Action |
|---------|--------|
| Geo error rate > 10 % for 5 minutes | Rollback all 4 flags |
| Tile auth failures > 5 % for 5 minutes | Rollback `GEO_USE_MAPBOX_TILES` |
| Resolve success rate < 80 % for 10 minutes | Rollback `GEO_USE_RESOLVE_FLOW` |
| p95 latency > 2000 ms for 10 minutes | Rollback `GEO_USE_NEW_PROVIDER` |

### 7.2  Rollback Steps (by Scope)

**Full rollback (all flags):**

```bash
# Backend
export GEO_ROLLOUT_STAGE=off
# or set each flag individually:
export GEO_USE_NEW_PROVIDER=false
export GEO_PROVENANCE_WRITE=false
# Restart backend

# Web
export NEXT_PUBLIC_GEO_USE_MAPBOX_TILES=false
export NEXT_PUBLIC_GEO_USE_RESOLVE_FLOW=false
# Rebuild and redeploy web

# Mobile
export EXPO_PUBLIC_GEO_USE_RESOLVE_FLOW=false
# Rebuild mobile
```

**Partial rollback (single flag):**

Only set the offending flag to `false`. Other flags remain at their current
stage. See `docs/geo-runbooks.md` R3 for per-flag rollback procedures.

### 7.3  Rollback Verification

After rollback, confirm:

1. `grep 'geo_provider_flag' combined.log | tail -1` shows the expected flag
   state.
2. Geo endpoint error rate returns to baseline within 5 minutes.
3. New rows in `Post`, `Gig`, `Home`, `BusinessLocation` have `NULL`
   provenance columns (if `GEO_PROVENANCE_WRITE=false`).
4. Web tile requests go to `tile.openstreetmap.org` (if `GEO_USE_MAPBOX_TILES=false`).

### 7.4  Post-Rollback Process

1. File an incident report documenting the metric degradation.
2. Root-cause the regression before re-attempting the failed stage.
3. Add regression test coverage for the identified issue.
4. Re-enter the same stage (do not skip ahead) after the fix.

---

## 8  Stage Execution Checklist

Copy this checklist for each stage transition.

```
## Stage Transition: S__ → S__

### Pre-flight
- [ ] Previous stage observation window complete (see Duration in § 1)
- [ ] All go/no-go criteria met (§ 6)
- [ ] Baseline metrics recorded and documented
- [ ] Rollback procedure reviewed with on-call engineer
- [ ] Alerts enabled for auto-rollback triggers (§ 7.1)

### Execution
- [ ] Update env vars to target stage configuration (§ 3.3)
- [ ] Deploy backend (restart)
- [ ] Deploy web (rebuild + redeploy)
- [ ] Smoke-test: autocomplete, resolve, reverse geocode
- [ ] Smoke-test: home onboarding, business location, gig creation
- [ ] Verify logs show correct provider label

### Post-deploy monitoring (first 2 hours)
- [ ] Error rate within threshold (G1)
- [ ] Tile loads succeeding (G2)
- [ ] Address flow completion normal (G3)
- [ ] Latency within threshold (G4)
- [ ] Cache hit rate normal (G5)
- [ ] No support tickets filed (G6)

### Observation window (full duration)
- [ ] Metrics stable for entire window
- [ ] No P0/P1 bugs filed
- [ ] No Mapbox 429 rate-limit responses
- [ ] Spot-check 10 provenance records for accuracy
- [ ] Document metrics snapshot for this stage

### Decision
- [ ] GO / HOLD / NO-GO (circle one)
- [ ] Sign-off: _________________ Date: ___________
```

---

## 9  Timeline (Estimated)

| Day | Activity |
|-----|----------|
| D0 | Deploy with all flags `false`. Baseline collection begins (S0). |
| D1 | S0 complete. Review baseline metrics. Enable S1 (internal). |
| D3 | S1 observation complete. Go/no-go review. Enable S2 (dogfood). |
| D6 | S2 observation complete. Go/no-go review. Enable S3 (5 %). |
| D9 | S3 observation complete. Go/no-go review. Enable S4 (25 %). |
| D12 | S4 observation complete. Go/no-go review. Enable S5 (GA). |
| D13+ | GA monitoring. Plan gating code removal. |

Total estimated rollout: **~13 days** (assuming no rollbacks).

---

## 10  Post-GA Cleanup

After GA has been stable for 7 days:

1. Remove `GEO_ROLLOUT_STAGE`, `GEO_ROLLOUT_IDS`, `GEO_ROLLOUT_PERCENT` env vars.
2. Remove `isGeoEnabled()` gating function and all call sites.
3. Hard-code all four feature flags to `true` (or remove the `envFlag()` checks entirely).
4. Remove the deprecated `/normalize` endpoint and client-side fallback code.
5. Remove the OSM tile fallback path in `constants.ts`.
6. Remove the `mapbox_legacy` provider label from log queries and dashboards.
7. Update `docs/geo-feature-flags.md` to mark flags as retired.
