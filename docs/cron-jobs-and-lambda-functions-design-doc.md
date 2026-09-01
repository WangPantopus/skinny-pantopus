# Cron Jobs & Lambda Functions Design Doc

> Last updated: 2026-04-09

This document catalogs every scheduled job and Lambda function in the Pantopus platform, including schedules, triggers, and responsibilities.

---

## Table of Contents

1. [Overview](#overview)
2. [Node-Cron Backend Jobs](#node-cron-backend-jobs)
3. [AWS Lambda Functions](#aws-lambda-functions)
4. [Shared Infrastructure](#shared-infrastructure)

---

## Overview

| Runtime           | Count | Scheduler             | Config Location                                      |
|-------------------|-------|-----------------------|------------------------------------------------------|
| Node.js (backend) | 33    | `node-cron` v4.2.1    | `backend/jobs/index.js`                              |
| Python 3.13 (AWS) | 8     | EventBridge (CloudWatch Events) | `pantopus-seeder/deploy/template.yaml` |

**Total scheduled processes: 41**

---

## Node-Cron Backend Jobs

All jobs are defined in `backend/jobs/index.js` and run in **UTC timezone**.

### Payments & Escrow

| Job | Cron | Frequency | Description |
|-----|------|-----------|-------------|
| `authorizeUpcomingGigs` | `5 * * * *` | Hourly at :05 | For gigs starting within 24h with saved cards, creates off-session Stripe PaymentIntents |
| `processPendingTransfers` | `15 * * * *` | Hourly at :15 | Releases escrow to provider's Stripe Connect account after 48h cooling period |
| `retryCaptureFailures` | `5,20,35,50 * * * *` | Every 15 min | Retries payment capture for gigs where owner confirmed completion |
| `expireUncapturedAuthorizations` | `0 3 * * *` | Daily 3:00 AM | Cancels gigs with expiring payment auth; alerts for in-progress gigs |
| `checkAndAlertStuckPayments` | `12,27,42,57 * * * *` | Every 15 min | Detects stuck payments; sends Slack/PagerDuty alerts |
| `expirePendingPaymentBids` | `*/2 * * * *` | Every 2 min | Reverts bids stuck in `pending_payment` past 10-min expiry |

### Marketplace & Listings

| Job | Cron | Frequency | Description |
|-----|------|-----------|-------------|
| `autoArchivePosts` | `0 4 * * *` | Daily 4:00 AM | Archives local posts (Nearby, Neighborhood) based on TTL rules |
| `expireListings` | `3,18,33,48 * * * *` | Every 15 min | Archives expired listings; decrements inventory counts |
| `expireOffers` | `1,16,31,46 * * * *` | Every 15 min | Expires pending offers older than 48h; notifies buyers |
| `expireGigs` | `8,23,38,53 * * * *` | Every 15 min | Cancels gigs past deadline so they disappear from browse |
| `organicMatch` | `*/2 * * * *` | Every 2 min | Matches local businesses to community posts with `service_category` |

### Mail & Notifications

| Job | Cron | Frequency | Description |
|-----|------|-----------|-------------|
| `mailDayNotification` | `0 8 * * *` | Daily 8:00 AM | Builds mailbox summary and logs `mail_day_notification` events |
| `mailInterruptNotification` | `*/5 * * * *` | Every 5 min | Detects time-critical mail events (out-for-delivery, urgent, certified) |
| `mailPartyExpiry` | `* * * * *` | Every minute | Expires party invitations older than 90s; notifies host |

### Feed & Discovery

| Job | Cron | Frequency | Description |
|-----|------|-----------|-------------|
| `recomputeUtilityScores` | `10,25,40,55 * * * *` | Every 15 min | Recomputes `utility_score` on posts for feed ranking |
| `refreshDiscoveryCache` | `*/2 * * * *` | Every 2 min | Refreshes geohash-based discovery cache |

### Trust, Reputation & Moderation

| Job | Cron | Frequency | Description |
|-----|------|-----------|-------------|
| `earnRiskReview` | `*/15 * * * *` | Every 15 min | Reviews risk sessions, calculates scores, transitions users through risk tiers |
| `computeReputation` | `7,37 * * * *` | Every 30 min | Recomputes reputation for users with recent reviews |
| `trustAnomalyDetection` | `45 */6 * * *` | Every 6h at :45 | Flags providers with suspicious `neighbor_count` growth |
| `communityModeration` | `*/30 * * * *` | Every 30 min | Flags community items with multiple "concerned" reactions |
| `stampAwarder` | `35 */6 * * *` | Every 6h at :35 | Checks user milestones and awards stamps |

### Home & Household

| Job | Cron | Frequency | Description |
|-----|------|-----------|-------------|
| `processClaimWindows` | `7,17,27,37,47,57 * * * *` | Every 10 min | Promotes provisional occupancies to verified after challenge window expires |
| `validateHomeCoordinates` | `12,42 * * * *` | Every 30 min | Reverse-geocodes recent homes via Mapbox; flags mismatches |
| `notifyClaimWindowExpiry` | `20 */2 * * *` | Every 2h at :20 | Sends 48h warning before ownership claim window closes |
| `expireInitiatedHomeClaims` | `11 * * * *` | Hourly at :11 | Expires initiated ownership claims past evidence deadline |
| `reconcileHomeHouseholdResolution` | `14,44 * * * *` | Every 30 min | Recomputes household resolution for homes with claim activity |
| `vacationHoldExpiry` | `25 * * * *` | Hourly at :25 | Expires completed vacation holds; activates scheduled ones |

### Business

| Job | Cron | Frequency | Description |
|-----|------|-----------|-------------|
| `computeAvgResponseTime` | `0 5 * * *` | Daily 5:00 AM | Computes avg response time for each business profile |
| `cleanupGhostBusinesses` | `30 2 * * *` | Daily 2:30 AM | Removes orphaned incomplete business accounts |
| `expirePopupBusinesses` | `45 * * * *` | Hourly at :45 | Unpublishes temporary businesses past `active_until` date |
| `draftBusinessReminder` | `0 10 * * *` | Daily 10:00 AM | Reminds about draft businesses < 7 days old (max 3 reminders) |

### Chat

| Job | Cron | Frequency | Description |
|-----|------|-----------|-------------|
| `chatRedactionJob` | `30 * * * *` | Hourly at :30 | Permanently redacts soft-deleted messages past retention period |

### Gigs & Workers

| Job | Cron | Frequency | Description |
|-----|------|-----------|-------------|
| `autoRemindWorker` | `2,7,12,17,22,27,32,37,42,47,52,57 * * * *` | Every 5 min | Auto-reminds workers approaching start time (max 2 per assignment) |

### Support Trains

| Job | Cron | Frequency | Description |
|-----|------|-----------|-------------|
| `supportTrainReminders` | `9,39 * * * *` | Every 30 min | Sends 24h and day-of reminders; nudges about unfilled slots |

### Vault

| Job | Cron | Frequency | Description |
|-----|------|-----------|-------------|
| `vaultWeeklyDigest` | `0 9 * * 1` | Mondays 9:00 AM | Summarizes vault activity and storage stats |

---

## AWS Lambda Functions

All Lambda functions are defined in `pantopus-seeder/deploy/template.yaml`. They run on **Python 3.13 (arm64)** with 256 MB memory and are triggered by EventBridge schedules.

### 1. Fetcher

| Property | Value |
|----------|-------|
| **Function name** | `pantopus-seeder-fetcher-{env}` |
| **Handler** | `src.handlers.fetcher.handler` |
| **Source** | `pantopus-seeder/src/handlers/fetcher.py` |
| **Schedule** | `rate(2 hours)` |
| **Timeout** | 120s |

**Purpose:** Pulls content from RSS feeds, APIs, and seasonal engine sources into the `seeder_content_queue` table.

**Key operations:**
- Loads active regions dynamically from database
- Fetches items from configured sources per region
- Computes dedup hashes to prevent duplicates
- Filters items by relevance score
- Purges old queue entries based on status retention periods
- Publishes `SeederQueueDepth` metric to CloudWatch

---

### 2. Poster

| Property | Value |
|----------|-------|
| **Function name** | `pantopus-seeder-poster-{env}` |
| **Handler** | `src.handlers.poster.handler` |
| **Source** | `pantopus-seeder/src/handlers/poster.py` |
| **Schedule** | `cron(0 14-23,0-1 * * ? *)` — hourly during posting windows (7 AM–6 PM PT) |
| **Timeout** | 600s |

**Purpose:** Selects best queued content, humanizes it via Claude Haiku, and posts to the Pantopus API.

**Key operations:**
- Detects current posting slot (morning/noon/evening PT)
- Applies weekend rules (skips Sunday, limits Saturday to morning only)
- Applies random jitter to appear natural
- Selects best item by priority (P1: safety/weather > P2: news/events > P3: community > P4: filler)
- Calls humanizer pipeline to rewrite raw content
- Authenticates curator account and posts via API
- Updates queue item status: `queued → humanized → posted/failed`

---

### 3. Discovery

| Property | Value |
|----------|-------|
| **Function name** | `pantopus-seeder-discovery-{env}` |
| **Handler** | `src.handlers.discovery.handler` |
| **Source** | `pantopus-seeder/src/handlers/discovery.py` |
| **Schedule** | `rate(1 day)` |
| **Timeout** | 120s |

**Purpose:** Detects user location clusters and auto-provisions new seeder regions.

**Key operations:**
- Loads user viewing locations
- Clusters uncovered users using geospatial algorithms
- Reverse-geocodes cluster centers to get region names and timezones
- Creates new `seeder_config` rows with region metadata
- Auto-provisions P1/P2 sources (NWS Weather, USGS Earthquakes, Google News, Seasonal)
- Safety cap: max 3 new regions per run

---

### 4. Briefing Scheduler

| Property | Value |
|----------|-------|
| **Function name** | `pantopus-briefing-scheduler-{env}` |
| **Handler** | `src.handlers.briefing.handler` |
| **Source** | `pantopus-seeder/src/handlers/briefing.py` |
| **Schedule** | `rate(15 minutes)` |
| **Timeout** | 300s |

**Purpose:** Finds users whose briefing time has arrived and triggers personalized daily briefing delivery.

**Key operations:**
- Queries `UserNotificationPreferences` for users with briefing enabled
- Timezone-aware window calculation (±15 min around preferred time)
- Respects quiet hours settings
- Idempotency via `DailyBriefingDelivery` table (prevents duplicate sends per date)
- Calls backend `/api/internal/briefing/send` for each eligible user
- Cap: 100 users per invocation
- Publishes metrics: `BriefingEligibleUsers`, `BriefingSent`, `BriefingSkipped`, `BriefingFailed`, `BriefingLatencyMs`

---

### 5. Briefing Cleanup

| Property | Value |
|----------|-------|
| **Function name** | `pantopus-briefing-cleanup-{env}` |
| **Handler** | `src.handlers.briefing_cleanup.handler` |
| **Source** | `pantopus-seeder/src/handlers/briefing_cleanup.py` |
| **Schedule** | `rate(1 day)` |
| **Timeout** | 120s |

**Purpose:** Purges old delivery logs, cleans expired context cache, and retries failed briefings.

**Key operations:**
- Deletes `DailyBriefingDelivery` rows older than 30 days
- Purges expired `ContextCache` entries
- Resets deliveries stuck in "composing" status for >15 min (crash recovery)
- Retries failed deliveries from today (marks with `[RETRY]` to prevent loops)

---

### 6. Alert Checker

| Property | Value |
|----------|-------|
| **Function name** | `pantopus-alert-checker-{env}` |
| **Handler** | `src.handlers.alert_checker.handler` |
| **Source** | `pantopus-seeder/src/handlers/alert_checker.py` |
| **Schedule** | `rate(10 minutes)` |
| **Timeout** | 120s |

**Purpose:** Checks NOAA weather alerts and AQI for user home locations; sends real-time push notifications.

**Key operations:**
- Groups users by geohash (5-char precision) to batch API calls
- **Weather:** Fetches NOAA alerts; notifies for moderate+ severity
- **AQI:** Fetches AirNow data; triggers at AQI >= 101 (unhealthy+)
- Dedup via `AlertNotificationHistory` table
- Purges expired alert history entries
- Publishes metrics: `AlertGeohashesChecked`, `WeatherAlertsFound`, `AqiAlertsFound`, `UsersNotified`

**External APIs:** NOAA Weather API, AirNow AQI API

---

### 7. Home Reminders

| Property | Value |
|----------|-------|
| **Function name** | `pantopus-home-reminders-{env}` |
| **Handler** | `src.handlers.home_reminders.handler` |
| **Source** | `pantopus-seeder/src/handlers/home_reminders.py` |
| **Schedule** | Two triggers: `cron(0 14 * * ? *)` (7 AM PT) and `cron(0 1 * * ? *)` (6 PM PT) |
| **Timeout** | 120s |

**Purpose:** Sends push notifications for bills due, tasks due, and upcoming calendar events.

**Key operations:**
- **Bills:** Queries `HomeBill` for unpaid bills due today/tomorrow; sends to all household members
- **Tasks:** Queries `HomeTask` for incomplete tasks due today; sends to assignee or all members
- **Calendar:** Queries `HomeCalendarEvent` for events in next 2 hours; calculates time-to-event
- Dedup per item per day via `AlertNotificationHistory`
- Publishes metrics: `BillsNotified`, `TasksNotified`, `CalendarNotified`

---

### 8. Mail Notifications

| Property | Value |
|----------|-------|
| **Function name** | `pantopus-mail-notifications-{env}` |
| **Handler** | `src.handlers.mail_notifications.handler` |
| **Source** | `pantopus-seeder/src/handlers/mail_notifications.py` |
| **Schedule** | `rate(5 minutes)` |
| **Timeout** | 120s |

**Purpose:** Sends urgent mail notifications and daily mailbox summary push notifications.

**Key operations:**
- **Urgent mail** (runs every 5 min): Notifies for `time_sensitive`/`overdue` items and certified mail pending acknowledgment
- **Daily summary** (runs 7–9 AM PT only): Aggregates unarchived mail per user; counts bills, packages, urgent items
- Dedup via `AlertNotificationHistory` with `alert_type = 'mail'`
- Publishes metrics: `UrgentMailSent`, `SummarySent`, `MailNotifSkipped`

---

## Shared Infrastructure

### Secrets Manager

All Lambda functions read credentials from a single AWS Secrets Manager secret:

- **Secret name:** `pantopus/seeder/{environment}`
- **Keys:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PANTOPUS_API_BASE_URL`, `CURATOR_EMAIL`, `CURATOR_PASSWORD`, `OPENAI_API_KEY`, `INTERNAL_API_KEY`

### CloudWatch Metrics Namespaces

| Namespace | Published by |
|-----------|-------------|
| `Pantopus/Seeder/{env}` | Fetcher (`SeederQueueDepth`) |
| `Pantopus/Briefing/{env}` | Briefing Scheduler |
| `Pantopus/Alerts/{env}` | Alert Checker |
| `Pantopus/Reminders/{env}` | Home Reminders |
| `Pantopus/MailNotifications/{env}` | Mail Notifications |

### Key Database Tables

| Table | Used by |
|-------|---------|
| `seeder_content_queue` | Fetcher, Poster |
| `seeder_config` | Fetcher, Poster, Discovery |
| `seeder_sources` | Fetcher, Discovery |
| `UserNotificationPreferences` | Briefing Scheduler |
| `DailyBriefingDelivery` | Briefing Scheduler, Briefing Cleanup |
| `ContextCache` | Briefing Cleanup |
| `AlertNotificationHistory` | Alert Checker, Home Reminders, Mail Notifications |
| `HomeOccupancy` | Alert Checker, Home Reminders |
| `HomeBill` / `HomeTask` / `HomeCalendarEvent` | Home Reminders |
| `Mail` | Mail Notifications |

### Deployment

- **SAM template:** `pantopus-seeder/deploy/template.yaml`
- **Build script:** `pantopus-seeder/deploy/build.sh`
- **Runtime:** Python 3.13, ARM64 (Graviton2)
- **Default memory:** 256 MB
