# Hub Context Engine & Daily Briefing — Setup & Testing Guide

Complete guide to setting up, testing, and verifying the Hub Today card, daily briefing push notifications, and notification preferences.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Environment Setup](#2-environment-setup)
3. [Database Migrations](#3-database-migrations)
4. [Backend Verification](#4-backend-verification)
5. [Frontend Verification](#5-frontend-verification)
6. [Testing the Hub Today Card](#6-testing-the-hub-today-card)
7. [Testing Notification Preferences](#7-testing-notification-preferences)
8. [Testing the Daily Briefing Pipeline](#8-testing-the-daily-briefing-pipeline)
9. [Lambda Scheduler Setup](#9-lambda-scheduler-setup)
10. [End-to-End Smoke Test](#10-end-to-end-smoke-test)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Prerequisites

- Node.js 22+
- pnpm 9+
- Python 3.12+ (for Lambda)
- Supabase project (local or hosted)
- AWS CLI + SAM CLI (for Lambda deployment)
- A registered user account in Pantopus with at least one home

---

## 2. Environment Setup

### 2.1 Install dependencies

From the repo root:

```bash
pnpm install
```

This installs all workspaces including the `ngeohash` package added to `backend/package.json`.

### 2.2 Backend environment variables

Add these to `backend/.env` (in addition to existing vars):

```bash
# ── Hub Context Engine (new) ──────────────────────────────

# WeatherKit (optional — Open-Meteo is the free fallback)
# Leave blank to use Open-Meteo only
WEATHERKIT_KEY_ID=
WEATHERKIT_TEAM_ID=
WEATHERKIT_SERVICE_ID=
WEATHERKIT_PRIVATE_KEY=

# AirNow (optional — AQI will be hidden if not set)
# Get a free key at https://docs.airnowapi.org/account/request
AIRNOW_API_KEY=

# Internal API key for Lambda → Node communication
# Generate a strong random key: openssl rand -hex 32
INTERNAL_API_KEY=your-random-key-here

# OpenAI (already set if using AI chat)
# Used for AI-polished briefings (optional — templates work without it)
OPENAI_API_KEY=sk-...
OPENAI_DRAFT_MODEL=gpt-4o-mini
```

### 2.3 Minimum viable setup (no API keys)

The system works with **zero external API keys**:

| Feature | Without keys | With keys |
|---|---|---|
| Weather | Open-Meteo (free, no key) | WeatherKit (Apple) |
| AQI | Hidden | AirNow |
| Alerts | NOAA (free, no key) | NOAA |
| AI briefings | Template mode | AI-polished mode |

So for local testing, you only need `INTERNAL_API_KEY` set.

---

## 3. Database Migrations

Apply the two new migrations to your Supabase instance:

```bash
# If using Supabase CLI:
supabase db push

# Or apply manually via SQL editor:
# 1. supabase/migrations/20260407000001_hub_notification_preferences.sql
# 2. supabase/migrations/20260407000002_hub_briefing_delivery_and_context_cache.sql
```

### Verify tables were created

Run in SQL editor or `psql`:

```sql
-- Should return columns for all 3 new tables
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_name IN (
  'UserNotificationPreferences',
  'DailyBriefingDelivery',
  'ContextCache'
)
ORDER BY table_name, ordinal_position;
```

Expected: 18 columns for `UserNotificationPreferences`, 15 for `DailyBriefingDelivery`, 11 for `ContextCache`.

---

## 4. Backend Verification

### 4.1 Run unit tests

```bash
cd backend
pnpm test -- tests/hubContext.test.js
```

Expected: **26 tests passed** across 4 groups (Location Resolver, Usefulness Engine, Briefing Composer, Provider Orchestrator).

### 4.2 Start the dev server

```bash
cd backend
pnpm dev
```

Verify no startup errors. The server should log something like:
```
Server running on port 3001
```

### 4.3 Verify new endpoints exist

```bash
# Hub Today (requires auth token)
curl -s http://localhost:3001/api/hub/today \
  -H "Authorization: Bearer YOUR_TOKEN" | jq '.display_mode'

# Preferences (requires auth token)
curl -s http://localhost:3001/api/hub/preferences \
  -H "Authorization: Bearer YOUR_TOKEN" | jq '.preferences.daily_briefing_enabled'

# Internal briefing preview (requires internal API key)
curl -s -X POST http://localhost:3001/api/internal/briefing/preview \
  -H "Content-Type: application/json" \
  -H "x-internal-api-key: YOUR_INTERNAL_API_KEY" \
  -d '{"userId": "YOUR_USER_UUID"}' | jq '.'
```

---

## 5. Frontend Verification

### 5.1 Mobile (Expo)

```bash
cd frontend/apps/mobile
pnpm start
```

Open the app → navigate to Hub tab. You should see:
- **HubTodayCard** above the existing Neighborhood Pulse card
- If loading: skeleton shimmer
- If no location: card is hidden
- If weather data available: temperature, condition, summary

### 5.2 Web (Next.js)

```bash
cd frontend/apps/web
pnpm dev
```

Navigate to `http://localhost:3000/app/hub`. You should see:
- **HubTodayCard** above PlaceBriefCard
- Same display modes as mobile

---

## 6. Testing the Hub Today Card

### 6.1 Verify data flow

The Hub Today card gets its data from the `today` field in the `GET /api/hub` response. Check it:

```bash
curl -s http://localhost:3001/api/hub \
  -H "Authorization: Bearer YOUR_TOKEN" | jq '.today'
```

Expected response shape:
```json
{
  "location": { "label": "Near Vancouver, WA", "source": "primary_home", "confidence": 0.95 },
  "summary": "Clear and mild near home today.",
  "display_mode": "minimal",
  "weather": { "current_temp_f": 52, "condition_code": "clear", "condition_label": "Clear" },
  "aqi": null,
  "alerts": [],
  "signals": [],
  "seasonal": { "season": "spring_cleanup", "tip": "Spring cleanup time." },
  "meta": { "providers_used": ["OPEN_METEO"], "total_latency_ms": 234 }
}
```

### 6.2 Test display modes

The card displays differently based on signal urgency:

| To trigger | What to do |
|---|---|
| **hidden** | User with no home and no viewing location |
| **minimal** | Calm weather, no alerts, no bills/tasks due |
| **reduced** | Moderate signals (AQI 101-150, or bills due in 2-3 days) |
| **full** | Active NOAA alert, or AQI > 150, or rain > 80% in 3h |

You can check `display_mode` in the API response to confirm.

### 6.3 Test the standalone Today endpoint

```bash
curl -s http://localhost:3001/api/hub/today \
  -H "Authorization: Bearer YOUR_TOKEN" | jq '{
    display_mode: .display_mode,
    signal_count: (.signals | length),
    top_signal: .signals[0].kind,
    latency_ms: .meta.total_latency_ms
  }'
```

This endpoint has a `Cache-Control: private, max-age=300` header (5-minute client cache).

### 6.4 Verify the 2-second timeout

The `today` block in `GET /api/hub` has a hard 2-second timeout. If the context pipeline is slow, `today` will be `null` but the rest of the hub payload still loads normally.

---

## 7. Testing Notification Preferences

### 7.1 Read defaults

```bash
curl -s http://localhost:3001/api/hub/preferences \
  -H "Authorization: Bearer YOUR_TOKEN" | jq '.preferences'
```

Before any user action, returns defaults:
```json
{
  "daily_briefing_enabled": false,
  "daily_briefing_time_local": "07:30",
  "daily_briefing_timezone": "America/Los_Angeles",
  "weather_alerts_enabled": true,
  "aqi_alerts_enabled": true,
  "mail_summary_enabled": true,
  "gig_updates_enabled": true,
  "home_reminders_enabled": true,
  "quiet_hours_start_local": null,
  "quiet_hours_end_local": null,
  "location_mode": "primary_home"
}
```

### 7.2 Enable daily briefing

```bash
curl -s -X PUT http://localhost:3001/api/hub/preferences \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "daily_briefing_enabled": true,
    "daily_briefing_time_local": "08:00"
  }' | jq '.preferences.daily_briefing_enabled'
```

### 7.3 Set quiet hours

```bash
curl -s -X PUT http://localhost:3001/api/hub/preferences \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "quiet_hours_start_local": "22:00",
    "quiet_hours_end_local": "07:00"
  }' | jq '.preferences | {quiet_hours_start_local, quiet_hours_end_local}'
```

### 7.4 Verify in UI

- **Mobile:** Profile → Settings → "Notification Preferences"
- **Web:** `/app/settings/notifications`

Both should show the 4 sections (Daily Briefing, Alert Preferences, Quiet Hours, Location). Changes auto-save with a "Saved" confirmation.

### 7.5 Verify database

```sql
SELECT user_id, daily_briefing_enabled, daily_briefing_time_local,
       weather_alerts_enabled, quiet_hours_start_local, location_mode
FROM "UserNotificationPreferences"
WHERE user_id = 'YOUR_USER_UUID';
```

---

## 8. Testing the Daily Briefing Pipeline

### 8.1 Preview a briefing (without sending)

```bash
curl -s -X POST http://localhost:3001/api/internal/briefing/preview \
  -H "Content-Type: application/json" \
  -H "x-internal-api-key: YOUR_INTERNAL_API_KEY" \
  -d '{"userId": "YOUR_USER_UUID"}' | jq '.'
```

Expected response:
```json
{
  "text": "Good morning. Clear and mild near home today. Your electric bill is due tomorrow.",
  "mode": "template",
  "tokens_used": 0,
  "should_send": true,
  "skip_reason": null,
  "signals": [...],
  "location_geohash": "c20g8"
}
```

**Key things to check:**
- `should_send`: `true` means the briefing has useful content
- `mode`: `template` (no AI) or `ai_polished` (used gpt-4o-mini)
- `signals`: array of ranked signals with scores
- `skip_reason`: if `should_send` is `false`, tells you why (`low_signal_day`, `no_location`)

### 8.2 Send a briefing (actually delivers push)

**Prerequisites:** User must have `daily_briefing_enabled = true` in preferences AND a registered push token.

```bash
curl -s -X POST http://localhost:3001/api/internal/briefing/send \
  -H "Content-Type: application/json" \
  -H "x-internal-api-key: YOUR_INTERNAL_API_KEY" \
  -d '{"userId": "YOUR_USER_UUID"}' | jq '.'
```

Possible responses:

| status | Meaning |
|---|---|
| `sent` | Push notification delivered |
| `skipped` + `opted_out` | User has `daily_briefing_enabled = false` |
| `skipped` + `quiet_hours` | Current time is in user's quiet hours |
| `skipped` + `already_processed` | Briefing already sent/skipped today |
| `skipped` + `low_signal_day` | Nothing useful to report |
| `skipped` + `no_push_token` | User has no registered push token |
| `failed` | Error during composition or delivery |

### 8.3 Verify delivery log

```sql
SELECT id, user_id, briefing_date_local, status, skip_reason,
       summary_text, composition_mode, ai_tokens_used,
       location_geohash, created_at
FROM "DailyBriefingDelivery"
WHERE user_id = 'YOUR_USER_UUID'
ORDER BY created_at DESC
LIMIT 5;
```

### 8.4 Test idempotency

Send the same briefing twice:

```bash
# First call — should return "sent" or "skipped" with a reason
curl -s -X POST http://localhost:3001/api/internal/briefing/send \
  -H "Content-Type: application/json" \
  -H "x-internal-api-key: YOUR_INTERNAL_API_KEY" \
  -d '{"userId": "YOUR_USER_UUID"}' | jq '.status'

# Second call — should return "skipped" with "already_processed"
curl -s -X POST http://localhost:3001/api/internal/briefing/send \
  -H "Content-Type: application/json" \
  -H "x-internal-api-key: YOUR_INTERNAL_API_KEY" \
  -d '{"userId": "YOUR_USER_UUID"}' | jq '.'
```

### 8.5 Test auth protection

```bash
# Missing API key — should return 401
curl -s -X POST http://localhost:3001/api/internal/briefing/send \
  -H "Content-Type: application/json" \
  -d '{"userId": "test"}' | jq '.'

# Wrong API key — should return 401
curl -s -X POST http://localhost:3001/api/internal/briefing/send \
  -H "Content-Type: application/json" \
  -H "x-internal-api-key: wrong-key" \
  -d '{"userId": "test"}' | jq '.'
```

---

## 9. Lambda Scheduler Setup

### 9.1 Local testing (without AWS)

You can test the Lambda handler locally using Python:

```bash
cd pantopus-seeder
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create a `.env` file:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-key
PANTOPUS_API_BASE_URL=http://localhost:3001
INTERNAL_API_KEY=same-key-as-backend
```

Test the handler:
```python
python -c "
from src.handlers.briefing import handler
result = handler({}, None)
print(result)
"
```

### 9.2 Run Lambda unit tests

```bash
cd pantopus-seeder
pip install pytest httpx pydantic
python -m pytest tests/test_briefing_handler.py -v
```

Expected: **20 tests passed**.

### 9.3 Deploy to AWS

```bash
cd pantopus-seeder
chmod +x deploy/build.sh
./deploy/build.sh

cd deploy
sam build --use-container
sam deploy --config-env dev  # or staging/prod
```

### 9.4 Update Secrets Manager

After deploying, add `INTERNAL_API_KEY` to the shared secret:

```bash
# First, get current secret value
aws secretsmanager get-secret-value \
  --secret-id pantopus/seeder/dev \
  --query 'SecretString' --output text | jq '.'

# Update with the new key added
aws secretsmanager put-secret-value \
  --secret-id pantopus/seeder/dev \
  --secret-string '{
    "SUPABASE_URL": "...",
    "SUPABASE_SERVICE_ROLE_KEY": "...",
    "PANTOPUS_API_BASE_URL": "...",
    "CURATOR_EMAIL": "...",
    "CURATOR_PASSWORD": "...",
    "OPENAI_API_KEY": "...",
    "INTERNAL_API_KEY": "same-key-as-backend-env"
  }'
```

**Critical:** The `INTERNAL_API_KEY` value must match exactly between the Lambda secret and the backend's `INTERNAL_API_KEY` environment variable.

### 9.5 Verify Lambda is running

Check CloudWatch Logs:
```bash
aws logs tail /aws/lambda/pantopus-briefing-scheduler-dev --follow
```

Check CloudWatch Metrics:
```bash
aws cloudwatch get-metric-statistics \
  --namespace Pantopus/Briefing/dev \
  --metric-name BriefingEligibleUsers \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 900 \
  --statistics Sum
```

### 9.6 Manual Lambda invocation

```bash
aws lambda invoke \
  --function-name pantopus-briefing-scheduler-dev \
  --payload '{}' \
  response.json && cat response.json | jq '.'
```

---

## 10. End-to-End Smoke Test

Complete checklist to verify everything works together:

### Step 1: Database
- [ ] Migrations applied (3 new tables exist)
- [ ] RLS policies active (`UserNotificationPreferences` allows user read/write, `DailyBriefingDelivery` allows user read, `ContextCache` service-role only)

### Step 2: Backend
- [ ] `pnpm test -- tests/hubContext.test.js` — 26 tests pass
- [ ] Dev server starts without errors
- [ ] `GET /api/hub` returns response with `today` field
- [ ] `GET /api/hub/today` returns Today card data
- [ ] `GET /api/hub/preferences` returns defaults
- [ ] `PUT /api/hub/preferences` updates and returns saved data
- [ ] `POST /api/internal/briefing/preview` returns briefing preview
- [ ] `POST /api/internal/briefing/send` returns sent/skipped
- [ ] Internal endpoints reject requests without valid `x-internal-api-key`

### Step 3: Frontend
- [ ] Mobile Hub shows HubTodayCard (or skeleton while loading)
- [ ] Mobile Profile → Settings → "Notification Preferences" opens
- [ ] Toggling preferences shows "Saved" toast
- [ ] Web Hub shows HubTodayCard
- [ ] Web `/app/settings/notifications` page loads and saves

### Step 4: Daily Briefing Pipeline
- [ ] Enable `daily_briefing_enabled` for a test user
- [ ] Preview shows `should_send: true` with signals
- [ ] Send delivers push notification to device (requires Expo push token)
- [ ] Second send returns `already_processed` (idempotency)
- [ ] `DailyBriefingDelivery` table has a row with `status = 'sent'`

### Step 5: Lambda (if deployed)
- [ ] Lambda tests pass: `pytest tests/test_briefing_handler.py` — 20 pass
- [ ] `INTERNAL_API_KEY` matches between Lambda secret and backend env
- [ ] Lambda invocation returns stats JSON
- [ ] CloudWatch shows `BriefingEligibleUsers` metric

---

## 11. Troubleshooting

### "Cannot find module 'ngeohash'"

```bash
# From repo root:
pnpm install
# Or specifically:
pnpm --filter pantopus-backend add ngeohash
```

### Hub Today returns `null`

Check in order:
1. Does the user have a home? (location resolver needs coordinates)
2. Is the 2-second timeout being hit? Check backend logs for `orchestrator: getHubToday exceeded 700ms`
3. Are weather APIs reachable? Check for timeout warnings in logs

### Briefing preview returns `should_send: false`

The usefulness engine requires a signal score > 0.20. If it's a calm day with no bills/tasks:
- Check `signals` array in preview response — if empty, there's nothing to report
- This is expected behavior — the system intentionally stays quiet on low-signal days

### Briefing send returns "opted_out"

The user hasn't enabled daily briefings:
```sql
UPDATE "UserNotificationPreferences"
SET daily_briefing_enabled = true
WHERE user_id = 'YOUR_USER_UUID';
```

### Briefing send returns "no_push_token"

The user's device hasn't registered for push notifications:
```sql
SELECT * FROM "PushToken" WHERE user_id = 'YOUR_USER_UUID';
```

If empty, the user needs to open the mobile app and accept push notification permissions.

### Lambda returns "supabase_init_failed"

The Secrets Manager secret is missing or has wrong values:
```bash
aws secretsmanager get-secret-value \
  --secret-id pantopus/seeder/dev \
  --query 'SecretString' --output text | jq '.'
```

### Weather data is empty

- Without `WEATHERKIT_*` env vars: Open-Meteo is used automatically (no config needed)
- If Open-Meteo also fails: check network connectivity, look for timeout warnings in logs
- Circuit breaker: after 3 WeatherKit failures, it auto-skips to Open-Meteo for 10 minutes

### Context cache not working

Verify the `ContextCache` table exists and has the right permissions:
```sql
SELECT count(*) FROM "ContextCache";
-- If 0, the cache is empty (normal on first run)
-- Entries appear after the first weather/AQI fetch
```

---

## Architecture Quick Reference

```
EventBridge (every 15 min)
  → briefing.py Lambda
      → Query UserNotificationPreferences (timezone-aware window)
      → For each eligible user:
          POST /api/internal/briefing/send
            → locationResolver (5-level hierarchy)
            → Promise.allSettled:
                weatherProvider (WeatherKit → Open-Meteo fallback)
                aqiProvider (AirNow wrapper)
                alertsProvider (NOAA wrapper)
                internalContextCollector (bills, tasks, mail, gigs)
            → seasonalEngine (deterministic PNW tips)
            → usefulnessEngine (rank + score + cap at 5)
            → briefingComposer (template or AI polish)
            → pushService.sendToUser (Expo push)
            → DailyBriefingDelivery (delivery log)
```

**New files created:**
- `backend/services/context/` — 11 files (context pipeline)
- `backend/routes/internalBriefing.js` — Lambda-callable endpoints
- `pantopus-seeder/src/handlers/briefing.py` — scheduler Lambda
- `pantopus-seeder/src/handlers/briefing_cleanup.py` — cleanup Lambda
- `supabase/migrations/20260407000001_*.sql` — preferences table
- `supabase/migrations/20260407000002_*.sql` — delivery log + cache tables
- `frontend/*/HubTodayCard.tsx` — mobile + web Today card
- `frontend/*/notification-preferences.tsx` — mobile + web preferences UI
