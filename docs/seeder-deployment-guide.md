# Community Content Seeder — Deployment Guide

Complete step-by-step guide to deploy and operate the Pantopus Community Content Seeder. This system automatically seeds local news, sports, weather alerts, events, and community content into The Pulse feed during cold-start, tapering off as organic community activity grows.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Secrets and API Keys](#secrets-and-api-keys)
4. [Step 1: Run Database Migrations](#step-1-run-database-migrations)
5. [Step 2: Verify Content Sources](#step-2-verify-content-sources)
6. [Step 3: Set Up the Curator Account](#step-3-set-up-the-curator-account)
7. [Step 4: Deploy the Backend Link Preview Endpoint](#step-4-deploy-the-backend-link-preview-endpoint)
8. [Step 5: Build and Deploy Lambda Functions](#step-5-build-and-deploy-lambda-functions)
9. [Step 6: Populate AWS Secrets Manager](#step-6-populate-aws-secrets-manager)
10. [Step 7: Verify the Deployment](#step-7-verify-the-deployment)
11. [Adding New Regions](#adding-new-regions)
12. [Content Sources](#content-sources)
13. [Source Priority System](#source-priority-system)
14. [Local Development](#local-development)
15. [Operations and Monitoring](#operations-and-monitoring)
16. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

The seeder consists of three AWS Lambda functions running on schedules:

| Component | Schedule | Purpose |
|-----------|----------|---------|
| **Fetcher** | Every 2 hours | Pulls content from RSS feeds, Google News, weather APIs, earthquake feeds, and more; filters, deduplicates, and inserts into `seeder_content_queue` |
| **Poster** | Hourly, 14:00–01:00 UTC | Selects the best queued item (by source priority), humanizes it via OpenAI (gpt-5-mini), authenticates as the curator, and posts to the Pantopus API |
| **Discovery** | Daily | Detects user clusters in new areas, reverse-geocodes them, and auto-provisions new regions with default sources |

**Data flow:** Content Sources → Fetcher Lambda → `seeder_content_queue` (Supabase) → Poster Lambda → OpenAI gpt-5-mini (humanize) → Pantopus API → Post in The Pulse

**Content sources (10 types):**
- RSS feeds (local news, community, sports)
- Google News RSS (universal, works for any city or team)
- NWS Weather Alerts (free API, no key needed)
- Air Quality (Open-Meteo, free, no key)
- USGS Earthquakes (free, no key)
- Wikipedia "On This Day" (free, no key)
- Seasonal tips (PNW-specific, generated locally)

**Dynamic regions:** Regions are stored in the `seeder_config` database table (not hardcoded). New regions are provisioned three ways: (1) **instant provisioning** when any user sets their location to an uncovered area, (2) **Discovery Lambda** batches user clusters daily, or (3) **CLI command** for manual setup. Each region has its own content sources in the `seeder_sources` table.

**Source priority system:** Each source has a priority (1–4) that controls posting order. Critical content (weather alerts, earthquakes) always posts before enrichment content (sports, reddit). New regions start with only P1+P2 sources active to avoid overwhelming users.

**Tapering:** The poster checks organic community activity (posts/day, active users) in each region and automatically reduces posting frequency as the community grows. Four stages: full (3/day) → reduced (2/day) → minimal (1/day) → dormant (0/day).

**Default regions:**
- `clark_county` — centered at (45.6387, -122.6615), 25km radius
- `portland_metro` — centered at (45.5152, -122.6784), 25km radius

---

## Prerequisites

Install these tools on your local machine:

- **Python 3.12+** — matches the Lambda runtime
- **pip** — Python package manager
- **AWS CLI v2** — configured with credentials that can deploy CloudFormation stacks
- **AWS SAM CLI** — `pip install aws-sam-cli` or [install guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
- **Node.js 18+** — for the backend (link preview endpoint)
- **A Supabase project** — with the database already running the Pantopus schema

Verify your AWS CLI is configured:

```bash
aws sts get-caller-identity
# Should print your account ID and IAM user/role
```

---

## Secrets and API Keys

You need **6 secrets** before deployment. Here's where to get each one:

| Secret | Where to Get It |
|--------|----------------|
| `SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL (e.g. `https://abc123.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → `service_role` secret key. **Never expose client-side.** |
| `PANTOPUS_API_BASE_URL` | Your deployed Pantopus backend URL (e.g. `https://api.pantopus.com`) |
| `CURATOR_EMAIL` | Choose an email for the curator bot account (e.g. `curator@pantopus.com`). This account will be created in Step 3. |
| `CURATOR_PASSWORD` | Choose a strong password for the curator account. Store securely. |
| `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com) → API Keys → Create key. Used for gpt-5-mini to humanize content. |

---

## Step 1: Run Database Migrations

The seeder requires **6 migration files** run **in order** against your Supabase database. These create the schema only — region data is seeded by the setup script in Step 3.

> **Important:** Run migrations first, then the setup script. The migrations create tables and constraints. The setup script creates the curator account and populates `seeder_config` + `seeder_sources` with region data. Seed data in migrations 3–5 is guarded by `WHERE EXISTS` checks and will be skipped if regions don't exist yet (which is expected on a fresh deploy).

### Migration 1: Curator account type + seeder tables

File: `supabase/migrations/20260404000001_seeder_curator_account_tables.sql`

- Adds `'curator'` to the `User.account_type` CHECK constraint
- Creates `seeder_content_queue` and `seeder_config` tables
- Creates the `get_seeder_tapering_metrics()` RPC function

### Migration 2: Media columns on the queue

File: `supabase/migrations/20260405000001_seeder_queue_media_columns.sql`

- Adds `media_urls` and `media_types` array columns to `seeder_content_queue`

### Migration 3: Dynamic regions

File: `supabase/migrations/20260405000002_dynamic_regions.sql`

- Adds geo columns (`lat`, `lng`, `radius_meters`, `timezone`, `display_name`) to `seeder_config`
- Creates `seeder_sources` table (per-region content source definitions)
- Removes hardcoded region CHECK constraint
- Seeds initial RSS sources for existing regions *(skipped if regions don't exist yet)*

### Migration 4: New content source types + constraint expansion

File: `supabase/migrations/20260405000003_new_content_source_types.sql`

- Ensures `seeder_sources` table exists (safe re-run if migration 3 already created it)
- Expands CHECK constraints on `seeder_sources` (source_type, category) and `seeder_content_queue` (category) to support all 7 source types and 10 categories
- Adds `provisioned_by` column to `seeder_config` to track region creation method ('manual', 'discovery', 'instant')
- Seeds NWS alerts, air quality, earthquake, On This Day, Reddit, KGW, OPB, and Oregon Metro sources *(skipped if regions don't exist yet)*
- Deactivates broken feeds (Portland Tribune, Clark County Gov, City of Vancouver)

### Migration 5: Sports sources

File: `supabase/migrations/20260405000004_sports_content_sources.sql`

- Seeds sports sources: Trail Blazers, Timbers, Thorns, Seahawks, World Cup 2026 *(skipped if regions don't exist yet)*

### Migration 6: Source priority

File: `supabase/migrations/20260405000005_source_priority.sql`

- Adds `priority` column to `seeder_sources` and `source_priority` column to `seeder_content_queue`
- Sets priority levels (P1–P4) for all existing sources
- Creates index for priority-based queue queries

### How to run

**Option A: Supabase CLI (recommended)**

```bash
# From the project root
supabase db push
```

**Option B: Supabase Dashboard**

1. Go to Supabase Dashboard → SQL Editor
2. Paste the contents of each migration file and run them **in order** (1 → 6)

**Option C: Direct psql**

```bash
for f in supabase/migrations/20260404*.sql supabase/migrations/20260405*.sql; do
  echo "Running $f..."
  psql "$DATABASE_URL" -f "$f"
done
```

### Verify

```sql
-- Confirm tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('seeder_content_queue', 'seeder_config', 'seeder_sources');

-- Tables should exist but seeder_config and seeder_sources will be empty
-- until you run the setup script in Step 3
```

---

## Step 2: Verify Content Sources

Most content sources require no API keys and work out of the box. RSS feed URLs should be verified before deployment.

### API sources (no verification needed)

These are free public APIs that work for any location:

| Source Type | API | Auth Required |
|------------|-----|---------------|
| NWS Weather Alerts | `api.weather.gov` | None (include User-Agent header) |
| Air Quality | `air-quality-api.open-meteo.com` | None |
| USGS Earthquakes | `earthquake.usgs.gov` | None |
| Wikipedia On This Day | `en.wikipedia.org/api/rest_v1` | None |
| Google News RSS | `news.google.com/rss/search` | None |

### RSS feeds to verify

Open each URL in your browser or use `curl -sI <url>` to confirm it returns valid RSS/Atom XML:

| Source | URL | Region | Priority |
|--------|-----|--------|----------|
| The Columbian | `https://www.columbian.com/feed/` | clark_county | P2 |
| Camas-Washougal Post-Record | `https://www.camaspostrecord.com/feed/` | clark_county | P2 |
| OregonLive | `https://www.oregonlive.com/arc/outboundfeeds/rss/category/portland/` | portland_metro | P2 |
| KGW News (local) | `https://www.kgw.com/feeds/syndication/rss/news/local` | portland_metro | P2 |
| OPB | `https://www.opb.org/arc/outboundfeeds/rss/?outputType=xml` | portland_metro | P2 |
| KGW Sports | `https://www.kgw.com/feeds/syndication/rss/sports` | portland_metro | P3 |
| City of Portland | `https://www.portland.gov/news/feed` | portland_metro | P3 |
| Oregon Metro | `https://www.oregonmetro.gov/metro-rss-feeds` | portland_metro | P3 |

**Reddit feeds** (`reddit.com/r/{subreddit}/top/.rss?sort=top&t=day`) generally work but Reddit may rate-limit server IPs. Test from your deployment environment.

**Tips for finding replacement RSS URLs:**
- Look for an RSS icon on the source's website
- Try appending `/feed`, `/rss`, `/feed.xml`, or `/rss.xml` to the domain
- Check the page's HTML source for `<link rel="alternate" type="application/rss+xml">`
- If a feed is broken, disable it in the DB and rely on Google News as a fallback

---

## Step 3: Set Up the Curator Account and Seed Regions

> **This is the step that populates your database with the curator account and all region data.** Migrations (Step 1) only create empty tables. This script creates the curator user, `seeder_config` rows, and all `seeder_sources` entries.

```bash
cd pantopus-seeder

# Install Python dependencies
pip install -r requirements.txt

# Copy and fill in the .env file
cp .env.example .env
# Edit .env with your actual values for:
#   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
#   CURATOR_EMAIL, CURATOR_PASSWORD
```

### Dry run first

```bash
python scripts/setup_curator_account.py --dry-run
```

This will print what it would do without making changes. Verify the output looks correct.

### Run for real

```bash
python scripts/setup_curator_account.py
```

This will:
1. Create a Supabase Auth user with the curator email/password (email auto-confirmed)
2. Update the `User` row: `account_type = 'curator'`, `name = 'Pantopus Local'`, `username = 'pantopus_local'`
3. Insert `seeder_config` rows for both `clark_county` and `portland_metro` regions
4. Seed `seeder_sources` with all configured content sources (RSS, Google News, NWS, sports, etc.) with priority levels

### Verify

```sql
-- Check the curator user exists
SELECT id, email, account_type, name, username
FROM "User"
WHERE account_type = 'curator';

-- Check seeder_config rows
SELECT region, display_name, lat, lng, active FROM seeder_config;

-- Check content sources with priorities
SELECT region, source_id, priority, active FROM seeder_sources ORDER BY region, priority;
```

---

## Step 4: Deploy the Backend Link Preview Endpoint

The seeder posts include links to original articles. The frontend displays link preview cards using a backend endpoint that fetches Open Graph metadata.

### Install the cheerio dependency

```bash
cd backend
npm install cheerio
```

### Verify the route is registered

Check that `backend/app.js` includes:

```javascript
const linkPreviewRoutes = require('./routes/linkPreview');
app.use('/api/link-preview', linkPreviewRoutes);
```

### Deploy the backend

Deploy your backend as you normally would (e.g., push to your hosting platform). The link preview endpoint will be available at `GET /api/link-preview?url=...`.

---

## Step 5: Build and Deploy Lambda Functions

### Build

```bash
cd pantopus-seeder

# Run the build script (installs deps for arm64 Lambda, copies source, runs tests)
bash deploy/build.sh
```

The build script will:
1. Install pip dependencies into `build/` targeting arm64 Lambda
2. Copy `src/` into `build/`
3. Run the test suite — **build aborts if tests fail**

### Deploy with SAM

```bash
cd deploy

# First-time deployment (interactive — will ask for stack parameters)
sam build && sam deploy --guided

# Subsequent deployments
sam build && sam deploy --config-file samconfig.toml
```

SAM will create (all suffixed with the environment name):
- **`pantopus-seeder-fetcher-{env}`** — Lambda triggered every 2 hours by EventBridge
- **`pantopus-seeder-poster-{env}`** — Lambda triggered hourly from 14:00–01:00 UTC
- **`pantopus-seeder-discovery-{env}`** — Lambda triggered daily for auto-provisioning new regions
- **`pantopus/seeder/{env}`** — Secrets Manager secret (placeholder values)
- IAM policies for Secrets Manager access and CloudWatch metrics

### Deployment parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `Environment` | `production` | `production` or `staging` — controls all resource naming |
| `SecretName` | *(auto: `pantopus/seeder/{Environment}`)* | Override the Secrets Manager secret name. Leave empty to use the default. |

Deploy separate environments with different stack names:

```bash
# Production
sam build && sam deploy --stack-name pantopus-seeder-production \
  --parameter-overrides Environment=production

# Staging
sam build && sam deploy --stack-name pantopus-seeder-staging \
  --parameter-overrides Environment=staging
```

---

## Step 6: Populate AWS Secrets Manager

After the first SAM deployment, the secret container exists but its contents are
managed outside CloudFormation. You must populate it with real values, and
future `sam deploy` runs will not overwrite them.

### Option A: AWS Console

1. Go to AWS Console → Secrets Manager → `pantopus/seeder/production` (or `pantopus/seeder/staging`)
2. Click "Retrieve secret value" → "Edit"
3. Replace all `REPLACE_ME` values with your actual secrets:

```json
{
  "SUPABASE_URL": "https://your-project.supabase.co",
  "SUPABASE_SERVICE_ROLE_KEY": "eyJhbGciOi...",
  "PANTOPUS_API_BASE_URL": "https://api.pantopus.com",
  "CURATOR_EMAIL": "curator@pantopus.com",
  "CURATOR_PASSWORD": "your-secure-password",
  "OPENAI_API_KEY": "sk-...",
  "INTERNAL_API_KEY": "your-internal-api-key",
  "WEATHERKIT_KEY_ID": "",
  "WEATHERKIT_TEAM_ID": "",
  "WEATHERKIT_SERVICE_ID": "",
  "WEATHERKIT_PRIVATE_KEY": ""
}
```

### Option B: AWS CLI

```bash
aws secretsmanager update-secret \
  --secret-id pantopus/seeder/production \
  --secret-string '{
    "SUPABASE_URL": "https://your-project.supabase.co",
    "SUPABASE_SERVICE_ROLE_KEY": "eyJhbGciOi...",
    "PANTOPUS_API_BASE_URL": "https://api.pantopus.com",
    "CURATOR_EMAIL": "curator@pantopus.com",
    "CURATOR_PASSWORD": "your-secure-password",
    "OPENAI_API_KEY": "sk-...",
    "INTERNAL_API_KEY": "your-internal-api-key",
    "WEATHERKIT_KEY_ID": "",
    "WEATHERKIT_TEAM_ID": "",
    "WEATHERKIT_SERVICE_ID": "",
    "WEATHERKIT_PRIVATE_KEY": ""
  }' \
  --region us-west-2
```

---

## Step 7: Verify the Deployment

### Test the Fetcher

Invoke the fetcher manually to confirm it can connect to RSS feeds and Supabase:

```bash
aws lambda invoke \
  --function-name pantopus-seeder-SeederFetcherFunction-XXXXX \
  --payload '{}' \
  --region us-west-2 \
  /dev/stdout
```

Expected response:

```json
{
  "regions_processed": 2,
  "total_queued": 5,
  "total_filtered": 2,
  "total_deduped": 0,
  "total_errors": 0,
  "queue_depth": 5
}
```

### Check the queue

```sql
SELECT status, COUNT(*) FROM seeder_content_queue GROUP BY status;
```

You should see rows with `status = 'queued'`.

### Test the Poster

Invoke the poster manually:

```bash
aws lambda invoke \
  --function-name pantopus-seeder-SeederPosterFunction-XXXXX \
  --payload '{}' \
  --region us-west-2 \
  /dev/stdout
```

If it's within a posting window (7am/12pm/5pm PT ±1h), it should select an item, humanize it, and post. Outside a posting window, you'll get `{"skipped": "no_matching_slot"}`.

### Verify in the app

Open Pantopus and check The Pulse feed. You should see a post from **Pantopus Local** with humanized local content and a link to the original article.

---

## Adding New Regions

Regions are fully dynamic — no code deployment needed. Four ways to add a new region:

### Option A: CLI command (recommended)

```bash
cd pantopus-seeder

python scripts/setup_curator_account.py --add-region seattle_metro \
    --region-lat 47.6062 --region-lng -122.3321 \
    --region-display-name "Seattle Metro" \
    --sports-teams "Seattle Seahawks NFL,Seattle Kraken NHL,Seattle Mariners MLB,Seattle Sounders MLS"
```

This creates:
- A `seeder_config` row with coordinates and 25km radius
- **P1 (active):** NWS weather alerts, USGS earthquakes
- **P2 (active):** Google News local, seasonal tips
- **P3 (inactive):** Air quality, sports team sources (if `--sports-teams` provided)
- **P4 (inactive):** On This Day (Wikipedia)

P3/P4 sources are pre-configured but inactive — enable them as the community grows:

```sql
UPDATE seeder_sources SET active = true
WHERE region = 'seattle_metro' AND priority IN (3, 4);
```

Optional flags:
- `--region-timezone "America/Los_Angeles"` (default)
- `--region-radius 30000` (meters, default 25000)
- `--google-news-query "Seattle WA breaking news"` (custom search query)
- `--sports-teams "Team1 League1,Team2 League2"` (comma-separated)
- `--dry-run` — preview without making changes

### Option B: Instant provisioning (automatic, on location set)

When a user sets their viewing location (`PUT /api/location`) and no existing seeder region covers that area, the system **instantly provisions a new region** with P1+P2 sources. This solves the cold-start problem: even a single user in a new city gets local content on the next fetcher cycle.

How it works:
1. User sets viewing location (e.g., Miami, FL)
2. Backend checks if any `seeder_config` region covers those coordinates
3. If not, creates a new region with:
   - **P1 (active):** NWS weather alerts, USGS earthquakes
   - **P2 (active):** Google News for that city, seasonal tips
4. Timezone auto-derived from coordinates (US longitude bands)
5. The fetcher picks up the new region on its next run (within 2 hours)

The provisioning runs fire-and-forget so it doesn't slow down the user's location update. The `provisioned_by` column in `seeder_config` is set to `'instant'` for tracking.

### Option C: Automatic discovery (Discovery Lambda)

The Discovery Lambda runs daily and:
1. Queries `UserViewingLocation` for all active user positions
2. Filters out users already covered by an existing region
3. Clusters remaining users using a grid-cell density algorithm
4. If a cluster has ≥ 5 users (configurable), provisions a new region
5. Reverse-geocodes via Nominatim (OpenStreetMap) for naming
6. Creates `seeder_config` + P1/P2 sources automatically
7. Timezone auto-derived from coordinates

Safety limits:
- Max 3 new regions per run
- New regions must be ≥ 20km from any existing region
- Threshold override: `{"threshold": 3}` in the Lambda event payload

### Option D: Direct database insert

```sql
INSERT INTO seeder_config (region, curator_user_id, active, lat, lng, radius_meters, timezone, display_name, active_sources)
VALUES ('seattle_wa', '<curator-uuid>', true, 47.6062, -122.3321, 25000, 'America/Los_Angeles', 'Seattle, WA',
        '["google_news:seattle_wa", "seasonal:seattle_wa"]');

INSERT INTO seeder_sources (source_id, source_type, url, category, display_name, region, priority, active)
VALUES
  ('nws_alerts:seattle_wa', 'nws_alerts', '47.6062,-122.3321', 'weather', 'NWS Weather Alerts', 'seattle_wa', 1, true),
  ('google_news:seattle_wa', 'google_news', 'Seattle WA local news', 'local_news', 'Google News (Seattle)', 'seattle_wa', 2, true),
  ('seasonal:seattle_wa', 'seasonal', NULL, 'seasonal', 'Pantopus Seasonal', 'seattle_wa', 2, true),
  ('google_news:seattle_seahawks', 'google_news', 'Seattle Seahawks NFL', 'sports', 'Seahawks News', 'seattle_wa', 3, false);
```

### Adding custom sources to a region

```sql
-- Add an RSS feed
INSERT INTO seeder_sources (source_id, source_type, url, category, display_name, region, priority, active)
VALUES ('rss:seattle_times', 'rss', 'https://www.seattletimes.com/feed/', 'local_news', 'The Seattle Times', 'seattle_wa', 2, true);

-- Add a Reddit community feed
INSERT INTO seeder_sources (source_id, source_type, url, category, display_name, region, priority, active)
VALUES ('rss:reddit_seattle', 'rss', 'https://www.reddit.com/r/Seattle/top/.rss?sort=top&t=day', 'community_resource', 'r/Seattle', 'seattle_wa', 3, true);
```

The fetcher picks up new sources on its next run (within 2 hours).

---

## Content Sources

### Source types

| Type | Class | Description | Auth |
|------|-------|-------------|------|
| `rss` | `RssSource` | Any RSS/Atom feed URL | None |
| `google_news` | `GoogleNewsSource` | Google News search query | None |
| `nws_alerts` | `NwsAlertsSource` | NWS weather alerts by lat/lng | None |
| `air_quality` | `AirQualitySource` | AQI from Open-Meteo by lat/lng | None |
| `usgs_earthquakes` | `UsgsEarthquakeSource` | USGS earthquakes by lat/lng | None |
| `on_this_day` | `OnThisDaySource` | Wikipedia historical events | None |
| `seasonal` | `SeasonalSource` | PNW seasonal tips (local) | None |

### Categories

| Category | Post Type | Purpose | Used By |
|----------|-----------|---------|---------|
| `local_news` | general | information | RSS, Google News |
| `event` | event | information | RSS |
| `weather` | safety_alert | alert | NWS Alerts |
| `seasonal` | general | information | Seasonal |
| `community_resource` | general | information | RSS (Reddit, gov sites) |
| `safety` | safety_alert | alert | NWS (severe), AQ (unhealthy), USGS (M5+) |
| `air_quality` | safety_alert | alert | Air Quality |
| `earthquake` | safety_alert | alert | USGS Earthquakes |
| `history` | general | information | On This Day |
| `sports` | general | information | Google News, RSS (team subs) |

### PNW sports sources (pre-configured)

| Team | Source | Region |
|------|--------|--------|
| Portland Trail Blazers | Google News + r/ripcity | Both |
| Portland Timbers | Google News + r/timbers | portland_metro |
| Portland Thorns | Google News | Both |
| Seattle Seahawks | Google News | portland_metro |
| FIFA World Cup 2026 | Google News | Both |
| KGW Sports | RSS | portland_metro |

---

## Source Priority System

Every source has a priority level (1–4) that controls what gets posted first. This prevents content overload — new communities see only essential content, with more variety added as they grow.

| Priority | Level | Categories | Default State (new regions) |
|----------|-------|------------|----------------------------|
| **P1** | Critical | weather, safety, earthquake | Active |
| **P2** | Core | local_news, events, seasonal | Active |
| **P3** | Enrichment | community, sports, air_quality | **Inactive** |
| **P4** | Filler | history, reddit subs | **Inactive** |

### How it works

1. The **fetcher** stores `source_priority` on each queue item when ingesting
2. The **poster** scores items primarily by priority: P1 always beats P2, P2 always beats P3, etc.
3. Within the same priority tier, category bonuses apply (safety > events > seasonal > news)
4. Source diversity bonus: prefers a different source than the last posted item

### Enabling enrichment sources

As a community grows, enable additional sources:

```sql
-- Enable all P3 sources for a region
UPDATE seeder_sources SET active = true WHERE region = 'seattle_metro' AND priority = 3;

-- Enable specific sports sources
UPDATE seeder_sources SET active = true WHERE region = 'seattle_metro' AND category = 'sports';

-- Enable everything
UPDATE seeder_sources SET active = true WHERE region = 'seattle_metro';
```

---

## Local Development

For testing without deploying to AWS:

```bash
cd pantopus-seeder

# Set up environment
cp .env.example .env
# Fill in all 6 values in .env

# Install dependencies
pip install -r requirements.txt

# Run the fetcher locally
python -c "from src.handlers.fetcher import handler; print(handler({}, None))"

# Run the poster locally
python -c "from src.handlers.poster import handler; print(handler({}, None))"

# Run tests
python -m pytest tests/ -v
```

When `SECRET_NAME` is not set (no AWS environment), the secrets module falls back to reading from environment variables (loaded from `.env` by python-dotenv).

---

## Operations and Monitoring

### Posting Schedule

| Day | Slots (Pacific Time) |
|-----|---------------------|
| Mon–Fri | 7:00 AM, 12:00 PM, 5:00 PM |
| Saturday | 7:00 AM only |
| Sunday | No posts |

Each slot includes 0–5 minutes of random jitter to appear more human.

### Tapering Stages

The poster checks organic activity in each region every invocation:

| Stage | Trigger | Posts/Day | Slot Schedule |
|-------|---------|-----------|---------------|
| **Full** | < 1 post/day, < 5 active users | 3 | morning, midday, evening |
| **Reduced** | ≥ 1 post/day, ≥ 5 active users | 2 | morning, evening |
| **Minimal** | ≥ 2 posts/day, ≥ 10 active users | 1 | morning only |
| **Dormant** | ≥ 5 posts/day, ≥ 15 active users | 0 | none |

### CloudWatch Metrics

The fetcher publishes `SeederQueueDepth` to the `Pantopus/Seeder` CloudWatch namespace. Set up an alarm if the queue drops to 0 (no content being fetched) or grows too large (items not being posted).

### Queue Hygiene

The fetcher automatically:
- Purges `filtered_out` and `skipped` rows older than 7 days
- Purges `posted` rows older than 30 days
- Marks `queued` items older than 48 hours as `stale` (skipped)

### Lambda Timeouts

| Function | Timeout |
|----------|---------|
| Fetcher | 120 seconds |
| Poster | 600 seconds (includes jitter sleep + OpenAI API call) |
| Discovery | 120 seconds |

### Logs

View Lambda logs in CloudWatch Logs:

```bash
# Fetcher logs
aws logs tail /aws/lambda/pantopus-seeder-SeederFetcherFunction-XXXXX --follow

# Poster logs
aws logs tail /aws/lambda/pantopus-seeder-SeederPosterFunction-XXXXX --follow
```

---

## Troubleshooting

### Fetcher returns `total_queued: 0`

- Check RSS feed URLs are valid (Step 2)
- Check the relevance filter isn't blocking everything — review `filtered_out` rows:
  ```sql
  SELECT raw_title, failure_reason FROM seeder_content_queue
  WHERE status = 'filtered_out' ORDER BY created_at DESC LIMIT 20;
  ```
- The blocklist in `src/config/constants.py` filters out crime, politics, paywalled content, and obituaries
- Check that sources are `active = true` in `seeder_sources`:
  ```sql
  SELECT source_id, active, priority FROM seeder_sources WHERE region = 'your_region';
  ```

### Poster returns `{"skipped": "no_matching_slot"}`

- The poster only fires during posting windows: 7am, 12pm, 5pm Pacific Time (±1h)
- Check if it's Sunday (no posts) or Saturday afternoon (morning only)
- To force a test post, temporarily adjust `POSTING_SLOTS` in `src/config/constants.py`

### Curator authentication fails

- Verify the curator email/password in Secrets Manager match what was used in `setup_curator_account.py`
- Check the curator user exists: `SELECT id, email FROM "User" WHERE account_type = 'curator';`
- Re-run `python scripts/setup_curator_account.py` if needed (it handles duplicates gracefully)

### Humanizer fails

- Check your Anthropic API key is valid and has credits
- The humanizer uses OpenAI (`gpt-5-mini`) with a dynamic system prompt tailored to each region's display name
- PNW regions get seasonal context in the prompt; non-PNW regions do not
- Look at the `failure_reason` column for failed items:
  ```sql
  SELECT id, raw_title, failure_reason FROM seeder_content_queue
  WHERE status = 'failed' ORDER BY updated_at DESC LIMIT 10;
  ```

### Secrets Manager access denied

- Ensure the Lambda execution role has `secretsmanager:GetSecretValue` permission on the secret ARN
- SAM template already includes this policy, but verify with:
  ```bash
  aws lambda get-function-configuration --function-name <function-name> --query 'Role'
  ```

### Link preview cards not showing

- Verify `cheerio` is installed in the backend: `cd backend && npm ls cheerio`
- Check the route is registered in `backend/app.js`
- Test directly: `curl -H "Authorization: Bearer <token>" "https://api.pantopus.com/api/link-preview?url=https://example.com"`
