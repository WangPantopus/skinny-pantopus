# Lambda Functions & Pantopus Seeder

> Complete documentation of the AWS Lambda-based content seeding service, all Lambda functions, EventBridge schedules, content pipeline, and alert systems.

---

## 1. System Overview

The **pantopus-seeder** is a standalone AWS Lambda service that automatically seeds community content (local news, events, alerts, seasonal tips) into the Pantopus platform. It also handles user notifications (briefings, alerts, reminders, mail notifications).

```
 +-------------------+     +------------------+     +------------------+
 |   EventBridge     | --> |  Lambda Function | --> |  Supabase DB     |
 |   (Cron Rules)    |     |  (Python 3.12)   |     |  (Shared with    |
 +-------------------+     +--------+---------+     |   Backend API)   |
                                    |               +------------------+
                           +--------+--------+
                           |                 |
                  +--------v------+  +-------v--------+
                  | External APIs |  | Backend API    |
                  | (NOAA, USGS,  |  | /api/internal  |
                  |  Google News) |  | /api/posts     |
                  +---------------+  +----------------+
```

### Technology Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Python 3.12 |
| IaC | AWS SAM (CloudFormation) |
| Triggers | EventBridge schedule rules |
| Secrets | AWS Secrets Manager |
| Metrics | CloudWatch custom namespaces |
| AI | OpenAI (gpt-4o-mini) for humanization |
| HTTP | httpx (async) |
| RSS | feedparser |
| Validation | Pydantic 2.0 |
| DB Client | supabase-py |

---

## 2. Lambda Functions (8 Total)

### Function Reference

```
 Function          | Trigger              | Freq       | Timeout | Memory
 ==================|======================|============|=========|=======
 Fetcher           | rate(2 hours)        | Every 2h   | 120s    | 256MB
 Poster            | cron(0 14-23,0-1 *)  | Hourly     | 600s    | 256MB
 Discovery         | rate(1 day)          | Daily      | 120s    | 256MB
 Briefing          | rate(15 minutes)     | Every 15m  | 300s    | 256MB
 BriefingCleanup   | rate(1 day)          | Daily      | 120s    | 256MB
 AlertChecker      | rate(10 minutes)     | Every 10m  | 120s    | 256MB
 HomeReminders     | cron (2x daily)      | 7AM & 6PM  | 120s    | 256MB
 MailNotifications | rate(5 minutes)      | Every 5m   | 120s    | 256MB
```

---

### 2.1 Fetcher (`src/handlers/fetcher.py`)

**Purpose**: Pull content from external sources into the content queue.

```
 EventBridge (every 2h)
   |
   v
 Load active regions from seeder_config
   |
   v
 For each region:
   +-- Load sources from seeder_sources
   +-- For each source:
   |     +-- Instantiate source adapter (RSS, NWS, USGS, etc.)
   |     +-- Fetch content items
   |     +-- Dedup check (SHA-256 hash)
   |     +-- Relevance filter (blocklist, freshness, quality)
   |     +-- Insert to seeder_content_queue (status: queued | filtered_out)
   |
   v
 Queue hygiene: purge old rows, mark stale items
   |
   v
 Publish SeederQueueDepth metric to CloudWatch
```

**Queue Hygiene Rules**:

| Status | Purge After |
|--------|-------------|
| `filtered_out` | 7 days |
| `skipped` | 7 days |
| `posted` | 30 days |
| `queued` (stale) | 48 hours -> mark as `skipped` |

---

### 2.2 Poster (`src/handlers/poster.py`)

**Purpose**: Select best queued content, humanize via AI, and post to Pantopus.

```
 EventBridge (hourly, 14:00-01:00 UTC)
   |
   v
 Determine posting slot (Pacific time):
   morning=7h, midday=12h, evening=17h (+-1h tolerance)
   |
   +-- Skip Sunday entirely
   +-- Skip Saturday non-morning slots
   +-- Apply random jitter (0-5 min)
   |
   v
 For each region:
   |
   v
 Check tapering stage (RPC: get_seeder_tapering_metrics)
   |
   v
 Should this slot post? (based on tapering rules)
   |
   +-- NO -> skip
   +-- YES:
         |
         v
       Select best queued item (scoring):
         +-- P1 sources (safety/weather) = highest priority
         +-- Category bonuses (event, seasonal)
         +-- Source diversity (prefer different from last post)
         +-- Seasonal: only if none posted in 7 days
         |
         v
       Humanize via OpenAI API (gpt-4o-mini)
         |
         v
       Quality gate (length, tone, format validation)
         |
         v
       Auth as curator (Supabase sign_in_with_password)
         |
         v
       POST /api/posts (Pantopus API)
         |
         v
       Update queue status: posted | failed
```

**Category -> Post Mapping**:

| Category | postType | purpose |
|----------|----------|---------|
| local_news | local_update | local_update |
| event | event | event |
| weather | alert | heads_up |
| safety | alert | heads_up |
| air_quality | alert | heads_up |
| earthquake | alert | heads_up |
| seasonal | local_update | local_update |
| community_resource | recommendation | recommend |
| history | local_update | local_update |
| sports | local_update | local_update |

---

### 2.3 Discovery (`src/handlers/discovery.py`)

**Purpose**: Automatically detect user clusters and provision new content regions.

```
 EventBridge (daily)
   |
   v
 Load all UserViewingLocation coordinates
   |
   v
 Load existing regions from seeder_config
   |
   v
 Grid-cell clustering (0.25 degrees ~ 27.8km at 45 lat)
   |
   v
 Filter uncovered users (not within existing region radius)
   |
   v
 Find clusters with >= threshold users (default: 5)
   |
   v
 For each candidate (max 3 per run):
   +-- Reverse geocode via Nominatim (free, no key)
   +-- Generate region slug (e.g., "seattle_wa")
   +-- Derive timezone from coordinates
   +-- Create seeder_config row (active=true)
   +-- Upsert default sources:
         - NWS Alerts (P1)
         - USGS Earthquakes (P1)
         - Google News (P2)
         - Seasonal (P2)
```

**Cluster Filtering Rules**:
- Minimum 20km from existing regions
- Minimum 20km between candidates
- Cap: 3 new regions per run

---

### 2.4 Briefing Scheduler (`src/handlers/briefing.py`)

**Purpose**: Find users in their briefing window and trigger daily briefing delivery.

```
 EventBridge (every 15 min)
   |
   v
 Query UserNotificationPreferences:
   WHERE daily_briefing_enabled=true OR evening_briefing_enabled=true
   |
   v
 For each user:
   +-- Get timezone (default: America/Los_Angeles)
   +-- Is current local time within +-15 min of preferred time?
   +-- Is user in quiet hours? -> Skip
   +-- Already delivered today (DailyBriefingDelivery check)? -> Skip
   |
   v
 For eligible users (cap: 100 per invocation):
   POST /api/internal/briefing/send
     Header: x-internal-api-key
     Body: { userId, briefingKind: "morning" | "evening" }
   |
   v
 Publish metrics:
   BriefingEligibleUsers, BriefingSent, BriefingSkipped,
   BriefingFailed, BriefingLatencyMs
```

---

### 2.5 Briefing Cleanup (`src/handlers/briefing_cleanup.py`)

**Purpose**: Maintenance tasks for the briefing system.

```
 EventBridge (daily)
   |
   v
 Task 1: Purge DailyBriefingDelivery rows older than 30 days
   |
   v
 Task 2: Purge expired ContextCache rows
   |
   v
 Task 3: Reset stale "composing" rows (stuck > 15 min) to "failed"
   |
   v
 Task 4: Retry failed deliveries
   +-- Find status=failed with briefing_date in {yesterday, today, tomorrow}
   +-- Skip if error starts with "[RETRY]" marker
   +-- POST /api/internal/briefing/send
   +-- On re-failure, prefix error with "[RETRY]" (prevents infinite retry)
```

---

### 2.6 Alert Checker (`src/handlers/alert_checker.py`)

**Purpose**: Monitor weather and air quality, send push notifications for new alerts.

```
 EventBridge (every 10 min)
   |
   v
 Get unique geohash5 locations from HomeOccupancy + Home coordinates
   |
   v
 For each geohash:
   |
   +-- NOAA Weather Alerts:
   |     GET https://api.weather.gov/alerts/active?point={lat},{lng}
   |     Filter: severity >= moderate
   |     Dedup: AlertNotificationHistory by alert_id + geohash
   |     -> Push new alerts to users
   |
   +-- AQI Check:
         GET https://www.airnowapi.org/aq/observation/latLong/current/
         Threshold: AQI >= 101 (Unhealthy)
         Dedup: Per geohash per day per bucket (unhealthy | very_unhealthy | hazardous)
         -> Push AQI alerts to affected users
   |
   v
 POST /api/internal/briefing/alert-push
   Body: { userIds, title, body, alertType, data }
   |
   v
 Cleanup: Delete expired AlertNotificationHistory entries
   |
   v
 Publish metrics:
   AlertGeohashesChecked, WeatherAlertsFound, AqiAlertsFound,
   UsersNotified, AlertCheckerLatencyMs
```

---

### 2.7 Home Reminders (`src/handlers/home_reminders.py`)

**Purpose**: Push notifications for household bills, tasks, and events.

```
 EventBridge:
   cron(0 14 * * ? *)  -> ~7 AM PT (morning)
   cron(0 1 * * ? *)   -> ~6 PM PT (evening)
   |
   v
 Bills Due:
   Query HomeBill: unpaid, due today/tomorrow
   Group by home -> notify all active household members
   Dedup: AlertNotificationHistory (bill ID + date)
   |
   v
 Tasks Due:
   Query HomeTask: incomplete, due today
   Notify assigned user or all members if unassigned
   Dedup: AlertNotificationHistory (task ID + date)
   |
   v
 Calendar Events:
   Query HomeCalendarEvent: starting within 2 hours
   Notify all household members
   Dedup: AlertNotificationHistory (event ID + date)
   |
   v
 POST /api/internal/briefing/reminder-push
   |
   v
 Publish metrics:
   BillsNotified, TasksNotified, CalendarNotified,
   ReminderErrors, ReminderLatencyMs
```

---

### 2.8 Mail Notifications (`src/handlers/mail_notifications.py`)

**Purpose**: Push notifications for urgent mail and daily mailbox summaries.

```
 EventBridge (every 5 min)
   |
   v
 [Always runs]:
   |
   +-- Urgent Mail:
   |     Query Mail: urgency IN ('time_sensitive', 'overdue'), last 5 min
   |     Dedup: Per item ID
   |
   +-- Certified Mail:
         Query Mail: ack_required=true, ack_status=pending, last 5 min
         Dedup: Per item ID
   |
   v
 [Morning window only: 7-9 AM PT]:
   |
   +-- Daily Summary:
         Query Mail: lifecycle IN ('delivered', 'opened'), not archived
         Count: bills, packages, urgent items
         Dedup: Per user ID per date
   |
   v
 POST /api/internal/briefing/reminder-push
   |
   v
 Publish metrics:
   UrgentMailSent, SummarySent, MailNotifSkipped,
   MailNotifErrors, MailNotifLatencyMs
```

---

## 3. Content Sources

### Source Registry

| Type | Class | API | Auth | Purpose |
|------|-------|-----|------|---------|
| `rss` | RssSource | Various RSS feeds | None | Local news, events |
| `google_news` | GoogleNewsSource | Google News RSS | None | Regional news search |
| `nws_alerts` | NwsAlertsSource | api.weather.gov | None (free) | Severe weather alerts |
| `usgs_earthquakes` | UsgsEarthquakeSource | earthquake.usgs.gov | None (free) | Earthquakes M>=2.5 |
| `air_quality` | AirQualitySource | open-meteo.com | None (free) | AQI when >= 51 |
| `seasonal` | SeasonalSource | Hardcoded tips | N/A | PNW seasonal tips |
| `on_this_day` | OnThisDaySource | Wikipedia REST API | None | Historical events |

### Source Priority Levels

| Priority | Label | Example Sources | Behavior |
|----------|-------|----------------|----------|
| P1 | Critical/Safety | NWS Alerts, USGS Earthquakes | Always surfaces first |
| P2 | Core | Google News, Seasonal | Standard posting |
| P3 | Enrichment | Local RSS, On This Day | When queue needs variety |
| P4 | Filler | General RSS | Only in dormant stages |

### Source Details

**RSS Source**:
- Parses RSS/Atom via `feedparser`
- Extracts: title, summary, link, media (from `media:content`, `media:thumbnail`, enclosures)
- Freshness filter: category-specific (`FRESHNESS_HOURS`)
- Returns up to 20 items, sorted by publish date

**NWS Alerts**:
- `GET https://api.weather.gov/alerts/active?point={lat},{lng}`
- Filters: severity >= moderate
- Returns up to 5 alerts
- Category: `weather` (or `safety` for Severe/Extreme)

**USGS Earthquakes**:
- `GET https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&...`
- Filters: magnitude >= 2.5, radius <= 200km, age <= 48h
- Category: `earthquake` (or `safety` if M >= 5.0)

**Air Quality**:
- `GET https://air-quality-api.open-meteo.com/v1/air-quality?...`
- Filters: US AQI >= 51 (Moderate+)
- Category: `air_quality` (or `safety` if AQI >= 151)

**Google News**:
- `GET https://news.google.com/rss/search?q={query}+when:2d&...`
- Strips trailing " - Source Name" from titles
- Returns up to 15 items

**Seasonal**:
- 6 PNW seasons with hardcoded tip banks:
  - winter_ice (Dec 1 - Feb 29)
  - spring_cleanup (Mar 1 - Apr 30)
  - summer_dry (Jun 1 - Aug 31)
  - smoke_season (Jul 15 - Sep 30)
  - fall_prep (Sep 1 - Nov 30)
  - holiday_season (Nov 15 - Dec 31)
- Returns 1 random unused tip per active season

---

## 4. Content Processing Pipeline

### 4.1 Deduplication (`src/pipeline/dedup.py`)

```
Hash = SHA-256(source_id | identifier | date)

identifier = source_url (or title if URL unavailable)
date = published_at date (YYYY-MM-DD) or today's UTC date

Duplicate check: seeder_content_queue WHERE dedup_hash = hash
  AND status NOT IN ('filtered_out', 'skipped')
```

### 4.2 Relevance Filter (`src/pipeline/relevance_filter.py`)

Four-pass filter:

| Pass | Check | Action |
|------|-------|--------|
| **1. Blocklist** | Substring match in title + body | Block crime/violence, politics, paywalled, obituaries |
| **2. Freshness** | Age vs category threshold | default: 48h, event: 72h, history: 24h |
| **3. Quality** | Title >= 10 chars, not ALL CAPS, combined >= 20 chars | Reject low-quality |
| **4. Generic** | Pattern match (TV listings, scores, standings) | Reject non-content |

### 4.3 Humanizer (`src/pipeline/humanizer.py`)

```
 Raw content
   |
   v
 OpenAI API (gpt-4o-mini)
   |
   +-- System prompt: Two-part gate
   |     [QUALITY GATE] -> reject low-value -> "SKIP"
   |     [REWRITE] -> 2-3 sentences, warm tone, source attribution
   |
   v
 Validation:
   +-- Length <= 500 chars
   +-- <= 1 exclamation mark
   +-- No greeting prefix
   +-- No first-person "I"
   +-- No placeholder text
   |
   +-- FAIL -> retry once with corrective prompt
   |
   v
 Humanized text
```

**Rewrite Rules**:
- 2-3 sentences max
- Lead with actionable info (date, time, location)
- No exclamation marks (unless genuinely exciting)
- No greetings, hashtags, emoji, first-person
- Must include source attribution
- Add casual engagement question

---

## 5. Tapering System

### Purpose
Reduce seeded content as organic community activity grows.

### Stage Detection

```
get_seeder_tapering_metrics(lat, lng, radius) RPC
  -> avg_daily_posts (organic, last 7d)
  -> active_posters (unique, last 7d)
```

### Thresholds

| Stage | Organic Posts/Day | Active Posters/7d |
|-------|------------------|-------------------|
| **full** | <= 1 | <= 5 |
| **reduced** | 1-2 | 5-10 |
| **minimal** | 2-5 | 10-15 |
| **dormant** | 5+ | 15+ |

### Posting Rules per Stage

```
 Stage    | Max Slots | Active Slots          | Categories Allowed
 =========|===========|=======================|=====================
 full     | 3         | morning, midday, eve  | All
 reduced  | 2         | morning, evening      | All
 minimal  | 1         | morning only          | Limited (no sports, history)
 dormant  | 0         | None                  | Only weather, safety, earthquake
```

---

## 6. Geographic Discovery

### Clustering Algorithm

```
 Step 1: Divide map into 0.25-degree grid cells (~27.8km at 45 lat)
 Step 2: Load uncovered users (not within existing region radius)
 Step 3: Count users per cell
 Step 4: Find cells with >= threshold (default: 5 users)
 Step 5: If none, try merging adjacent 3x3 blocks
 Step 6: Filter candidates:
           >= 20km from existing regions
           >= 20km from other candidates
 Step 7: Sort by user count descending
 Step 8: Cap at 3 new regions per run
```

### Reverse Geocoding

- **Service**: Nominatim (OpenStreetMap), free, no API key
- **Endpoint**: `https://nominatim.openstreetmap.org/reverse`
- **Output**: city/state -> slug (e.g., "denver_co"), display name (e.g., "Denver, CO")
- **Fallback**: Coordinate-based name (e.g., "region_n45_1_w122_3")

### Timezone Detection

Simple longitude-based rules for CONUS:

| Zone | Rule |
|------|------|
| Hawaii | lon < -154 |
| Alaska | lat > 51 or lon < -130 |
| Pacific | lon < -114.5 |
| Mountain | lon < -102 |
| Central | lon < -87 |
| Eastern | else |

---

## 7. Secrets Management

### AWS Secrets Manager

**Secret Name**: `pantopus/seeder/{Environment}`

| Key | Used By | Purpose |
|-----|---------|---------|
| `SUPABASE_URL` | All Lambdas | Database connection |
| `SUPABASE_SERVICE_ROLE_KEY` | All Lambdas | DB admin access |
| `PANTOPUS_API_BASE_URL` | Poster, Briefing, Alerts, Reminders | Backend API endpoint |
| `CURATOR_EMAIL` | Poster | Curator auth (seeded posts) |
| `CURATOR_PASSWORD` | Poster | Curator auth |
| `OPENAI_API_KEY` | Poster | Content humanization |
| `INTERNAL_API_KEY` | Briefing, Alerts, Reminders | Internal API auth |
| `AIRNOW_API_KEY` | AlertChecker | AQI data |

Secrets are cached per Lambda invocation (cold start loads, warm invocations reuse).

---

## 8. CloudWatch Metrics

| Namespace | Lambda | Metrics |
|-----------|--------|---------|
| `Pantopus/Seeder/{Env}` | Fetcher | SeederQueueDepth |
| `Pantopus/Briefing/{Env}` | Briefing | BriefingEligibleUsers, BriefingSent, BriefingSkipped, BriefingFailed, BriefingLatencyMs |
| `Pantopus/Alerts/{Env}` | AlertChecker | AlertGeohashesChecked, WeatherAlertsFound, AqiAlertsFound, UsersNotified, AlertCheckerLatencyMs |
| `Pantopus/Reminders/{Env}` | HomeReminders | BillsNotified, TasksNotified, CalendarNotified, ReminderErrors, ReminderLatencyMs |
| `Pantopus/MailNotifications/{Env}` | MailNotifications | UrgentMailSent, SummarySent, MailNotifSkipped, MailNotifErrors, MailNotifLatencyMs |

---

## 9. Database Tables (Seeder-Specific)

### `seeder_config`

| Column | Type | Purpose |
|--------|------|---------|
| region | text (PK) | Unique region ID (e.g., "portland_metro") |
| curator_user_id | uuid | Curator account for posting |
| active | boolean | Region is active |
| lat, lng | float | Region center |
| radius_meters | integer | Coverage radius |
| timezone | text | Region timezone |
| display_name | text | Human-readable name |
| active_sources | text[] | Active source IDs |
| tapering_thresholds | jsonb | Custom thresholds |

### `seeder_sources`

| Column | Type | Purpose |
|--------|------|---------|
| source_id | text | Unique source ID |
| source_type | text | rss, seasonal, google_news, nws_alerts, usgs_earthquakes, air_quality, on_this_day |
| url | text | Feed URL, search query, or null |
| category | text | Content category |
| display_name | text | Human-readable name |
| region | text (FK) | Associated region |
| active | boolean | Source is active |
| priority | integer | 1=critical, 2=core, 3=enrichment, 4=filler |

### `seeder_content_queue`

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid (PK) | Queue item ID |
| source | text | Source ID |
| source_url | text | Original content URL |
| raw_title | text | Original title |
| raw_body | text | Original body |
| region | text | Target region |
| category | text | Content category |
| status | text | queued, filtered_out, humanized, posted, skipped, failed |
| humanized_text | text | AI-rewritten text |
| post_id | uuid | Pantopus post ID (after posting) |
| dedup_hash | text | SHA-256 hash for deduplication |
| failure_reason | text | Error details |
| media_urls | text[] | Image/video URLs |
| media_types | text[] | "image" or "video" |

### `AlertNotificationHistory`

| Column | Type | Purpose |
|--------|------|---------|
| alert_type | text | weather, aqi, reminder, mail |
| alert_id | text | External alert ID |
| geohash | text | Geographic area |
| severity | text | Alert severity |
| headline | text | Alert headline |
| users_notified | integer | Count of notified users |
| expires_at | timestamp | Auto-cleanup timestamp |

### `DailyBriefingDelivery`

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid (PK) | Delivery ID |
| user_id | uuid | Target user |
| briefing_date_local | date | Local date of briefing |
| briefing_kind | text | morning, evening |
| status | text | composing, sent, failed |
| error_message | text | Error details |

---

## 10. Deployment

### Build & Deploy

```bash
# First time
chmod +x deploy/build.sh
./deploy/build.sh
cd deploy
sam deploy --guided

# Updates
./deploy/build.sh
cd deploy
sam deploy
```

### First-Time Setup

```bash
# 1. Create curator account
python scripts/setup_curator_account.py --dry-run
python scripts/setup_curator_account.py

# 2. Populate secrets
aws secretsmanager put-secret-value \
  --secret-id pantopus/seeder/production \
  --secret-string '{"SUPABASE_URL":"...", ...}'

# 3. Deploy
./deploy/build.sh && cd deploy && sam deploy --guided
```

### SAM Template Parameters

| Parameter | Default | Purpose |
|-----------|---------|---------|
| Environment | production | Selects secret name and metric namespace |

---

## 11. Design Decisions

1. **Dynamic Region Discovery**: Auto-discovers user clusters vs hardcoded regions
2. **Tapering by Activity**: Reduces seeded content as community grows organically
3. **AI Quality Gate**: Claude can reject low-value content (returns "SKIP")
4. **Geohash-Based Alert Dedup**: Groups users by location to prevent duplicate notifications
5. **Idempotent Briefings**: DailyBriefingDelivery tracks by date/user/kind
6. **Serverless**: All state in Supabase; no persistence between Lambda invocations
7. **Source Priority**: P1 (safety) always surfaces first; P4 (filler) only when dormant
8. **Curator Account**: Seeded posts appear as regular user posts (organic feel)
9. **Media Support**: RSS media (images/videos) carried through to Pantopus posts
10. **Retry Safety**: "[RETRY]" marker prevents infinite retry loops in briefing cleanup

---

*This completes the comprehensive Pantopus backend design documentation.*
