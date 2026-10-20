# pantopus-seeder

Community content seeder for Pantopus. Runs as AWS Lambda functions triggered by EventBridge schedules to post local news, events, and seasonal tips via a branded curator account during cold-start periods.

**This is a standalone service. It is not part of the main Pantopus monorepo.**

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run Tests

```bash
pytest
```

## Project Structure

```
pantopus-seeder/
├── src/
│   ├── handlers/
│   │   ├── fetcher.py           # Content fetcher (every 2h)
│   │   ├── poster.py            # Content poster (3x/day)
│   │   ├── discovery.py         # Region auto-provisioning (daily)
│   │   ├── briefing.py          # Daily briefing scheduler (every 15 min)
│   │   └── briefing_cleanup.py  # Briefing cleanup + retry (daily)
│   ├── sources/         # Content source adapters (RSS, seasonal engine)
│   ├── pipeline/        # Content processing (filter, dedup, humanize, post)
│   ├── tapering/        # Organic activity checks for cadence reduction
│   ├── discovery/       # Region discovery (clustering, geocode, timezone)
│   ├── config/
│   │   ├── secrets.py   # SeederSecrets + BriefingSecrets loaders
│   │   ├── constants.py # Tapering thresholds, cadence rules
│   │   └── region_registry.py
│   └── models/          # Pydantic models for queue items
├── tests/               # Test suite
├── scripts/             # One-time setup and backfill scripts
└── deploy/              # SAM template and build scripts
```

## Architecture

Five Lambda functions share a common Python package:

- **Fetcher** (every 2 hours): Pulls content from RSS feeds, NOAA, and a seasonal engine into a `seeder_content_queue` table in Supabase.
- **Poster** (hourly, self-selects 3 slots/day at ~7am, 12pm, 5pm PT): Picks the best queued item, humanizes it via Claude Sonnet 5.5, and posts to the Pantopus API as the curator account.
- **Discovery** (daily): Detects user clusters and auto-provisions new seeder regions.
- **Briefing Scheduler** (every minute): Finds users whose morning or evening briefing time is now and sends personalized push notifications (see below).
- **Briefing Cleanup** (daily): Purges old delivery logs, cleans expired context cache, and resets stale composing attempts. Failed briefings retry on the minute scheduler only within their original local delivery window.

## Daily Briefing Scheduler

Two additional Lambda functions handle morning and evening briefings:

- **Briefing Scheduler** (every minute): Queries `UserNotificationPreferences` for enabled morning/evening slots. It asks the backend for each person's resolved IANA time zone, then checks the 15 minutes starting at their preferred local time (defaults 07:30 and 18:00), quiet hours and idempotency (`DailyBriefingDelivery`). For each eligible user it calls `POST /api/internal/briefing/send`. Failed attempts can retry on a later minute within that same local slot; sent, skipped and composing attempts cannot. Caps at 100 users per invocation.
- **Briefing Cleanup** (daily): Purges `DailyBriefingDelivery` rows older than 30 days, deletes expired `ContextCache` entries, and resets stale composing attempts. It never sends notifications.

Delivery uses geographic time-zone boundaries and daylight-saving rules,
including Alaska, the Aleutians, Hawaii and Arizona. The AWS hosting region
does not define the user's clock. See [P8](../docs/release/prod-config-checklist.md#p8-production-scheduled-jobs-founder-runs-l4-prepared)
for the paused production deployment and the separate briefing-only activation.

### Secrets

The briefing Lambdas use the same Secrets Manager secret as the seeder. Add `INTERNAL_API_KEY` to the secret:

```bash
# Update the secret to include the briefing API key
aws secretsmanager put-secret-value \
  --secret-id pantopus/seeder/{environment} \
  --secret-string '{
    "SUPABASE_URL": "...",
    "SUPABASE_SERVICE_ROLE_KEY": "...",
    "PANTOPUS_API_BASE_URL": "...",
    "CURATOR_EMAIL": "...",
    "CURATOR_PASSWORD": "...",
    "ANTHROPIC_API_KEY": "...",
    "INTERNAL_API_KEY": "your-internal-api-key-here"
  }'
```

The `INTERNAL_API_KEY` must match the `INTERNAL_API_KEY` environment variable on the Pantopus backend server.

### CloudWatch Metrics

The briefing scheduler publishes metrics to `Pantopus/Briefing/{environment}`:

- `BriefingEligibleUsers` — users found in the current window
- `BriefingSent` — briefings successfully sent
- `BriefingSkipped` — briefings skipped (opted out, quiet hours, low signal day, no push token)
- `BriefingFailed` — briefings that failed
- `BriefingLatencyMs` — total execution time per invocation

## Deployment

### Prerequisites

- AWS CLI (configured with credentials)
- AWS SAM CLI (`sam --version`)
- Python 3.13 (the Lambda runtime) and Docker (for `sam build --use-container`)

### First-time setup

1. **Create the curator account** (run locally with `.env` or exported env vars):

   ```bash
   python scripts/setup_curator_account.py --dry-run   # verify first
   python scripts/setup_curator_account.py
   ```

2. **Deploy the stack** (creates the Secrets Manager secret with placeholder values):

   ```bash
   python3.13 -m venv .venv && .venv/bin/pip install -r requirements.txt   # once
   PATH="$PWD/.venv/bin:$PATH" ./deploy/build.sh   # copies src into build/ and runs the tests
   cd deploy
   sam build --use-container   # installs the Lambda dependencies for Linux arm64
   sam deploy --config-env staging   # or prod; see samconfig.toml
   ```

   The build script copies source code and `requirements-lambda.txt` into `build/`
   (the template's `CodeUri`); `sam build --use-container` installs the
   dependencies. Deploying without `sam build` uploads code without them.

3. **Populate the secret** in AWS Secrets Manager with real values.
   The stack creates the secret container, but secret contents are managed
   outside CloudFormation so future deploys do not overwrite them:

   ```bash
   aws secretsmanager put-secret-value \
     --secret-id pantopus/seeder/production \
     --secret-string '{
       "SUPABASE_URL": "https://your-project.supabase.co",
       "SUPABASE_SERVICE_ROLE_KEY": "your-service-role-key",
       "PANTOPUS_API_BASE_URL": "https://api.pantopus.com",
       "CURATOR_EMAIL": "curator@pantopus.com",
       "CURATOR_PASSWORD": "your-curator-password",
       "ANTHROPIC_API_KEY": "sk-ant-...",
       "INTERNAL_API_KEY": "your-internal-api-key",
       "WEATHERKIT_KEY_ID": "",
       "WEATHERKIT_TEAM_ID": "",
       "WEATHERKIT_SERVICE_ID": "",
       "WEATHERKIT_PRIVATE_KEY": "",
       "AIRNOW_API_KEY": ""
     }'
   ```

   `AIRNOW_API_KEY` enables the alert checker's air-quality pushes; without it
   only weather alerts run.

   The stack also creates the SNS topic `pantopus-job-alarms-{environment}`,
   which CloudWatch alarms notify when a reminder or job function fails.
   Subscribe an inbox once (AWS emails a confirmation link):

   ```bash
   aws sns subscribe --topic-arn <JobAlarmTopicArn from the stack outputs> \
     --protocol email --notification-endpoint <your email>
   ```

4. **Seed the Sports event registry** after applying the Sports topic migration:

   ```bash
   python scripts/seed_sports_events.py --dry-run   # verify rows first
   python scripts/seed_sports_events.py
   ```

   The national Sports poster only runs while rows are active in
   `sports_events` / `active_sports_events`. Re-run this script when major
   event windows change or new events are added.

### Updating

```bash
./deploy/build.sh
cd deploy
sam deploy
```

### Monitoring

- **CloudWatch Logs**: Each Lambda writes to its own log group (`/aws/lambda/pantopus-seeder-SeederFetcherFunction-*` and `SeederPosterFunction`).
- **CloudWatch Metrics**: The fetcher publishes a `SeederQueueDepth` metric under the `Pantopus/Seeder` namespace.
- **Supabase**: Query `seeder_content_queue` for pipeline status (`queued`, `posted`, `failed`, etc.).

### Teardown

```bash
cd deploy
sam delete
```
