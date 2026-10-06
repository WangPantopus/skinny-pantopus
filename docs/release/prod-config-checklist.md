# Pantopus launch checklist

One ordered list from "nothing hosted" to "pilot live": decisions first, then
staging, then production, store builds and go-live. Work through it top to
bottom. Each step says **who** does it, **what** to do with the exact values or
commands, and **check**: how to see that it worked.

- **Founder** steps need your accounts or consoles (AWS, Cloudflare, Supabase,
  Vercel, GitHub settings, App Store Connect, Google Play, Stripe, Lob).
  Agents never enter credentials in consoles or write secrets into hosted
  services.
- **L4** steps are prepared in this repository or on the Mac by launch stream L4.
- Secret *values* never go in this file. L4 generated the internal secrets into
  `~/.config/pantopus/hosted-secrets/staging.env` and `production.env` on the
  Mac (mode 600); provider keys come from each provider's console.

Last checked: 2026-10-06 by L4.

## 0. What's running today

| Piece | State on October 6, 2026 |
|---|---|
| Website `pantopus.com` | Up, on Vercel. The deployment is about four months old (June). Its JavaScript calls `https://api.pantopus.com`. |
| Production API `api.pantopus.com` | Doesn't answer. The DNS record is proxied by Cloudflare to the server's old public address; the server's address changed when it restarted in September. |
| September server (AWS, Oregon) | Running. nginx serves `https://staging-api.pantopus.com` (healthy, database connected, backend release from September 8) and `https://staging.pantopus.com`. The June production container and its env file are kept on the same server, unrouted. It costs money every hour it runs. |
| `pantopus.app` | The zone is on Cloudflare with no records, so `pantopus.app`, `api.pantopus.app` and `staging.api.pantopus.app` don't resolve. |
| April store apps | App Store "Pantopus" (`com.pantopus.app`, version 1.5.0 from May 12) and Google Play `com.pantopus.app`: the Expo app from the older repository. The live website links to both. Their API host was set in Expo's build settings (the old guides used `https://api.pantopus.com`); it can't be read from here. |
| New native apps | iOS `app.pantopus.ios`, Android `app.pantopus.android`: different app IDs from the April apps, so they're new store listings (decision D2). Not uploaded anywhere yet. |
| Supabase | The April production project, a testing project, and the September `Pantopus-staging` project (Free). No project has adopted the canonical migration ledger. |
| GitHub | Environments `production` and `staging` exist with no secrets; `BACKEND_DEPLOY_ENABLED` is unset, so each master push ends with "Backend deployment is disabled". There's no `dev` branch. `ios-release` and `android-release` have no secrets. |
| AWS Lambdas | Unknown from here. The seeder stack (`pantopus-seeder/deploy/template.yaml`) also carries the briefing, home-reminder, weather-alert, mail and job-trigger functions. |

**Reminders run on AWS Lambda.** Morning and evening briefings (the night-before
pickup push rides the evening one), task and bill reminders, weather alerts and
mail notices are sent by the Lambdas, which call the backend's internal API.
The pilot can't start until the Lambda stack runs against the hosted backend
(steps S8 and P8).

## 1. Decisions (founder)

Each has a default that the steps below follow until you change it here.

- [ ] **D1 API hosts.** Default: production `https://api.pantopus.com`, staging
  `https://staging-api.pantopus.com`, for the website and both apps. Both names
  already exist in your Cloudflare zone, staging already has a certificate, and
  the website calls `api.pantopus.com` today. (The native apps defaulted to
  `api.pantopus.app`, which has no DNS; L4 switches them.) Also point
  `pantopus.app` and `www.pantopus.app` at the website (step P10): the apps share
  `https://pantopus.app` links.
- [ ] **D2 Store listings.** Default: new listings for `app.pantopus.ios` and
  `app.pantopus.android`; take the April apps off sale once the new ones are
  live. The App Store won't accept a second app named exactly "Pantopus" while
  the April app holds that name, so either give the new listing a longer name
  (for example "Pantopus Home") or rename the April app first with an update.
  The alternative, shipping the native apps as updates to `com.pantopus.app`,
  means changing the native app IDs, push setup and signing; L4 doesn't
  recommend it this close to the pilot.
- [ ] **D3 Production database.** Default (L4's recommendation): **a new
  production Supabase project** built from the canonical migrations, exactly as
  staging is. Keep the April project untouched and paused as an archive; the
  April users (friends) sign up again in the new app. The alternative is to
  adopt the April project (keeps their accounts and meal trains, but needs a
  backup, a local rehearsal of the September forward-upgrade SQL on a copy of
  real data, and a maintenance window; section P2B).
- [ ] **D4 Payments during the pilot.** Default: production uses Stripe **test**
  keys until you activate live payments; no pilot journey takes money. Pilot
  store builds then carry the matching `pk_test_` key (L4 adjusts the Android
  release guard, which demands `pk_live_`). A real card fails in test mode
  instead of being charged.
- [ ] **D5 Postcards.** Production won't start without Lob live settings:
  `LOB_ENV=live`, a live key, the webhook secret and a real return address
  (`LOB_FROM_*`; the defaults are a placeholder San Francisco address). Default:
  provide them before production (step P5). Staging uses Lob test mode.
- [ ] **D6 Email.** Default: Postmark SMTP for backend email and for Supabase
  Auth email, sending from `pantopus.com` with SPF, DKIM and DMARC.
- [ ] **D7 Error monitoring.** Default: off. Sentry and PostHog keys are optional
  (backend `SLACK_ALERTS_WEBHOOK_URL`, app `SENTRY_DSN`).
- [ ] **D8 Hosting.** Default: the September server carries both staging
  (`127.0.0.1:18001`) and production (`127.0.0.1:8000`) behind nginx, as designed
  in September. It's enough for 5 to 50 households; give production its own
  instance before a wider launch.

## 2. Staging

Staging uses production security settings (`NODE_ENV=production`,
`APP_ENV=staging`) with sandbox vendors: Stripe test, Lob test, APNs and FCM
staging. Only synthetic accounts and the founder's own devices.

### S1. Server address (founder)

1. AWS console → EC2 → Elastic IPs → **Allocate**, then **Associate** it with
   the September server. A fixed address stops DNS breaking when the server
   restarts.
2. Cloudflare → `pantopus.com` DNS: set `staging-api` and `staging` A records to
   the Elastic IP, **DNS only** (grey cloud). Leave `api` for step P1.
3. Keep the server's SSH host key pinned: compare the key in the EC2 console
   (or through Systems Manager) before accepting it.

**Check:** `curl -s https://staging-api.pantopus.com/health` returns
`{"status":"healthy","database":"connected",...}` from the new address.

### S2. Staging database (founder runs, L4 prepared)

Default: reset the existing `Pantopus-staging` project to the canonical
migrations (it holds only synthetic data). If you'd rather keep it, create a new
Free project `pantopus-staging-2` in the same region and use it instead.

On the Mac, from the repository root, with the Supabase CLI pinned in
`supabase/migration-policy.json` (2.116.0):

```bash
supabase login
supabase link --project-ref <staging project ref>
supabase db reset --linked        # existing project: drops its objects, replays every migration
# or, for a brand-new empty project:
supabase db push --linked
```

Then in the Supabase dashboard → Storage, create three buckets: **private**
`home-documents` (file size limit 25 MB), **private** `gig-completion` (100 MB)
and **public** `pantopus-uploads` (100 MB) for avatars and post photos. Under
Storage → S3 Connection, create an access key for the backend (Appendix A,
storage row).

**Check:** `supabase migration list --linked` shows every file in
`supabase/migrations/` on both sides, and `supabase db push --linked --dry-run`
reports nothing to push. In the dashboard, `home-documents` and `gig-completion`
show as private.

### S3. Staging Auth (founder)

Supabase dashboard → Authentication:

- URL configuration: Site URL `https://staging.pantopus.com`; redirect URLs
  `https://staging.pantopus.com/auth/callback`, `https://staging.pantopus.com/**`
  and `pantopus://auth/callback`.
- Email: confirm email **on**; minimum password length **12**; custom SMTP from
  D6 (sender `Pantopus Staging <staging@pantopus.com>`).
- Providers (L3 verifies sign-in):
  - Apple: a Services ID (for example `app.pantopus.web`) whose Return URL is
    `https://<staging ref>.supabase.co/auth/v1/callback`, a Sign in with Apple
    key (`.p8`) turned into the client secret (it expires after at most six
    months: put the renewal in your calendar), and Supabase "Client IDs"
    `app.pantopus.web,app.pantopus.ios` (the iOS app uses Apple's native sheet,
    so the bundle ID must be listed).
  - Google: a Web OAuth client in Google Cloud with the authorized redirect URI
    `https://<staging ref>.supabase.co/auth/v1/callback`; its client ID and
    secret go into the Supabase Google provider.

**Check:** a new synthetic account receives the confirmation email and can sign
in on the web and both apps.

### S4. Staging env file (founder, on the server)

On the server, back up the current file, then write `~/pantopus/.env.staging`
(mode 600). Appendix A lists every setting. The generated internal secrets come
from the Mac:

```bash
# On the Mac: copy the generated staging secrets to the server over the pinned SSH key
scp -i <key> ~/.config/pantopus/hosted-secrets/staging.env <user>@<elastic ip>:~/pantopus/staging-generated.env
# On the server:
cd ~/pantopus && cp -p .env.staging .env.staging.$(date -u +%Y%m%d) 2>/dev/null
# write the provider settings from Appendix A into .env.staging, then append the generated ones:
cat staging-generated.env >> .env.staging && rm staging-generated.env && chmod 600 .env.staging
```

`HOME_POSTCARD_CODE_KEYS_JSON` replaces any older staging value; staging
postcards sent with an old key stop verifying, which is acceptable for synthetic
data. Never copy the June production env file into staging.

**Check:** `stat -c %a ~/pantopus/.env.staging` prints `600`, and
`grep -E '^[A-Z_0-9]+=$' ~/pantopus/.env.staging` prints nothing (no empty
values). The backend's own startup checks run in S6.

### S5. GitHub `staging` environment (founder)

Repository → Settings → Environments → `staging`:

| Kind | Name | Value |
|---|---|---|
| Secret | `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` | Docker Hub user and a read/write access token |
| Secret | `EC2_HOST` | the Elastic IP |
| Secret | `EC2_USERNAME` | the server's SSH user |
| Secret | `EC2_SSH_KEY` | private key for that user |
| Secret | `EC2_KNOWN_HOSTS` | the verified host-key line (`ssh-keyscan` output checked against the console) |
| Variable | `BACKEND_API_BIND` | `127.0.0.1:18001` |
| Variable | `BACKEND_DEPLOY_ENABLED` | `true` (last, after everything above) |

Leave `DB_MIGRATIONS_ENABLED` unset until the database steps are proven; the
staging database already took the migrations in S2. Deployment branch rule:
allow `master` and `dev` (see `docs/ci-cd.md`).

### S6. First staging release (founder starts, L4 watches)

```bash
git push origin origin/master:refs/heads/dev
```

CI runs on `dev`; when it passes, **Deploy Backend** builds the image, starts an
unexposed candidate, checks its database connection, then swaps the API and
worker together and keeps the previous containers for rollback.

**Check:** the workflow summary shows the commit and image digest;
`curl -s https://staging-api.pantopus.com/health` is healthy; on the server,
`docker ps` shows `pantopus-backend-staging` and `pantopus-worker-staging`
healthy, and `docker logs pantopus-worker-staging` shows `[Worker] Ready`.

### S7. Staging web (founder)

Vercel → the Pantopus project:

- Git: connect `WangPantopus/skinny-pantopus`, root directory
  `frontend/apps/web`, framework Next.js, Node 22. Install command
  `pnpm install --frozen-lockfile`; build command `pnpm --filter @pantopus/web build`
  (or the default `next build`).
- Preview environment variables (used by the `dev` branch):
  `NEXT_PUBLIC_API_URL=https://staging-api.pantopus.com`,
  `NEXT_PUBLIC_APP_URL=https://staging.pantopus.com`,
  `NEXT_PUBLIC_APP_ENV=staging`,
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<pk_test_…>`,
  `NEXT_PUBLIC_MAPBOX_TOKEN=<public pk.… token>`.
  Leave `NEXT_PUBLIC_LAUNCH_FEATURES` empty: cut features stay hidden.
- Domains: assign `staging.pantopus.com` to the `dev` branch, then change its
  Cloudflare record to Vercel's CNAME (DNS only). The September staging site on
  the server can then be retired.

**Check:** `https://staging.pantopus.com` loads, sign-in works, and the browser's
network panel shows API calls going to `/api/...` on the same origin (Next.js
forwards them to the staging API).

### S8. Staging scheduled jobs (founder runs, L4 prepared)

The worker container already runs cron and pg-boss. The Lambda stack sends the
reminders:

1. Deploy from the Mac with AWS SAM (needs Docker running; `sam deploy` shows
   the change set and asks before creating anything):
   ```bash
   cd pantopus-seeder
   python3.13 -m venv .venv && .venv/bin/pip install -r requirements.txt   # once
   PATH="$PWD/.venv/bin:$PATH" ./deploy/build.sh   # copies the code, runs the tests
   cd deploy && sam build --use-container && sam deploy --config-env staging
   ```
   Don't skip `sam build`: without it the functions deploy without their
   Python packages and fail on import.
2. The stack creates the secret `pantopus/seeder/staging` with placeholders. Fill
   it from a private JSON file with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   (staging), `PANTOPUS_API_BASE_URL=https://staging-api.pantopus.com`,
   `INTERNAL_API_KEY` (the value in `hosted-secrets/staging.env`),
   `CURATOR_EMAIL` and `CURATOR_PASSWORD` (a staging curator account),
   `OPENAI_API_KEY`, `AIRNOW_API_KEY` (air-quality alerts; the backend's
   `AIRNOW_KEY` value), and optionally `WEATHERKIT_KEY_ID`, `WEATHERKIT_TEAM_ID`,
   `WEATHERKIT_SERVICE_ID`, `WEATHERKIT_PRIVATE_KEY`:
   ```bash
   aws secretsmanager put-secret-value --secret-id pantopus/seeder/staging --secret-string file://<private json file>
   ```
3. The stack includes `JobTriggerFunction`, which runs ten payment and
   maintenance jobs through the backend's locked internal endpoints. Appendix A
   therefore sets `LAMBDA_BACKED_CRON_ENABLED=false`, so the worker doesn't run
   the same ten jobs at the same minute. The open-gigs nudge in the stack finds
   nothing while open gigs stay off.
4. Job-failure alarms: the stack creates CloudWatch alarms on the briefing,
   home-reminder, mail, weather-alert, briefing-cleanup and job-trigger
   functions (about $0.60 a month) and the SNS topic `pantopus-job-alarms-staging`.
   Subscribe your inbox once and click the confirmation link AWS emails you:
   ```bash
   aws sns subscribe --topic-arn "$(aws cloudformation describe-stacks --stack-name pantopus-seeder-staging \
     --query "Stacks[0].Outputs[?OutputKey=='JobAlarmTopicArn'].OutputValue" --output text)" \
     --protocol email --notification-endpoint <your email>
   ```

Task reminders go out at 7:00 and the evening run at 18:00 Pacific, through
daylight saving (EventBridge Scheduler); briefings follow each person's own time.

**Check:** CloudWatch logs for `pantopus-briefing-scheduler-staging` show runs
every 15 minutes with no errors; `select job_name, last_success, last_failure
from job_locks` in the staging SQL editor shows the job-trigger runs; the
CloudWatch alarms list shows six `pantopus-*-errors-staging` alarms in OK; the
founder's staging phone gets one scheduled reminder (section 5).

### S9. Staging apps (founder, L4 builds)

For the founder's own devices: an iOS build and an Android build pointing at
`https://staging-api.pantopus.com`, with the staging Firebase project. L4
prepares them with the store build work (section 4): iOS through TestFlight or
installed from this Mac, Android as a signed APK.

### S10. Staging journey (L4 with founder)

L4 runs the pilot journey on staging with synthetic accounts: sign-up and email
confirmation, Add Home (private setup), Today, pickup days, radon task, a
household invitation, task done, a reminder push delivered to the founder's
iPhone (TestFlight) and an Android phone, notification tap-through, and the
web for the same account. Failures go to the owning stream.

## 3. Production

Same shape as staging, with live vendors where D4 and D5 say so.

### P1. Production address (founder)

1. Cloudflare → `pantopus.com` DNS: set `api` to the Elastic IP. Default: **DNS
   only** (grey cloud), like staging, with the backend's `TRUST_PROXY=1`. If you
   keep Cloudflare's proxy (orange cloud), set `TRUST_PROXY=2` and allow the
   server's port 443 only from Cloudflare's address ranges, or rate limits see
   Cloudflare's address instead of the visitor's.
2. On the server, add an nginx site for `api.pantopus.com` proxying to
   `127.0.0.1:8000` (copy the staging site: same headers, WebSocket upgrade for
   `/socket.io/`, `client_max_body_size 110m` because videos may be 100 MB), then
   `sudo certbot --nginx -d api.pantopus.com`.

**Check:** `curl -sI https://api.pantopus.com/` shows a valid certificate
(after P6 the health check answers).

### P2A. Production database: new project (default, founder)

1. Supabase → New project `pantopus-production`, **Pro** plan, region
   `us-west-2` (Oregon, next to the server). Turn on daily backups (included in
   Pro); point-in-time recovery is optional.
2. On the Mac:
   ```bash
   supabase link --project-ref <production ref>
   supabase db push --linked --dry-run   # lists every migration in supabase/migrations
   supabase db push --linked
   ```
3. Storage buckets and the S3 access key as in S2.
4. Keep the April project as it is (pause it; don't delete it).
5. Supabase's daily backups cover the database only, not uploaded files. Set
   up the file backup in Appendix C before the first household signs up.

**Check:** as in S2: `supabase db push --linked --dry-run` reports nothing to
push, and the three buckets exist with the right privacy.

### P2B. Production database: adopt the April project (only if D3 says so)

Don't run any of this until L4 has rehearsed it on a copy:

1. Founder: take a full backup outside the repository:
   `supabase db dump --linked -f <private>/schema.sql`,
   `supabase db dump --linked --data-only --use-copy -f <private>/data.sql`, and
   the ledger with `supabase migration list --linked`. Hand L4 the files
   privately (they contain real users' data).
2. L4: restore them into a disposable local database, apply the September
   forward-upgrade SQL (retained in the private evidence archive under
   `baseline-adoption/`), compare catalogs with the canonical baseline, then
   apply every later migration, and write the exact ledger-repair commands.
3. Founder, in a maintenance window: run the reviewed SQL and ledger repair, then
   `supabase db push --linked`. See `docs/supabase-migration-automation-runbook.md`.

### P3. Production Auth (founder)

As in S3, with Site URL `https://pantopus.com`, redirect URLs
`https://pantopus.com/auth/callback`, `https://www.pantopus.com/auth/callback`,
`https://pantopus.com/**` and `pantopus://auth/callback`, production SMTP sender
`Pantopus <hello@pantopus.com>`, and the production Apple and Google settings.

### P4. Production Firebase and APNs (founder)

- Firebase: add an Android app `app.pantopus.android` (in a production Firebase
  project, or `pantopus-staging` if you accept one project for the pilot),
  download its `google-services.json` for the `GOOGLE_SERVICES_JSON` release
  secret, and create a service account with only the Firebase Cloud Messaging
  admin role for the backend (`FCM_SERVICE_ACCOUNT_JSON`, one line).
- APNs: the existing key works for sandbox and production. Production uses
  `APNS_PRODUCTION=true`: TestFlight and App Store builds receive production
  pushes.

### P5. Production env file (founder, on the server)

Write `~/pantopus/.env.prod` as in S4 from `hosted-secrets/production.env` and
Appendix A's production column. **First move the June file aside**
(`mv .env.prod .env.prod.june-2026`): the deploy reads `.env.prod` for the new
containers, and none of the June settings (old database, old keys) may carry
over.

### P6. GitHub `production` environment and first release (founder)

Same secrets as S5 (production values) plus `BACKEND_API_BIND=127.0.0.1:8000`;
restrict the environment to `master`; set `BACKEND_DEPLOY_ENABLED=true` last.
The next CI success on master deploys. If the June container is named
`pantopus-backend`, the deploy stops it and keeps it as
`pantopus-backend-previous`, the automatic fallback if the first start fails.

**Check:** `curl -s https://api.pantopus.com/health` is healthy, and both
containers are healthy on the server.

### P7. Stripe and Lob webhooks (founder)

- Stripe (test mode per D4, live later): endpoint
  `https://api.pantopus.com/api/webhooks/stripe`, events as listed in
  `backend/stripe/stripeWebhooks.js`; put its signing secret in
  `STRIPE_WEBHOOK_SECRET`.
- Lob (live): webhook `https://api.pantopus.com/api/v1/webhooks/lob`; its
  secret in `LOB_WEBHOOK_SECRET`.

### P8. Production scheduled jobs (founder runs, L4 prepared)

As S8 with `pantopus/seeder/production`, `PANTOPUS_API_BASE_URL=https://api.pantopus.com`,
the production `INTERNAL_API_KEY` and a production curator account:
`sam build --use-container && sam deploy --config-env prod`, then subscribe your
inbox to `pantopus-job-alarms-production` (stack `pantopus-seeder-production`).

### P9. Production web (founder)

Vercel Production environment variables: `NEXT_PUBLIC_API_URL=https://api.pantopus.com`,
`NEXT_PUBLIC_APP_URL=https://pantopus.com`, `NEXT_PUBLIC_APP_ENV=production`,
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (matching D4), `NEXT_PUBLIC_MAPBOX_TOKEN`,
and, once the new store listings exist, `NEXT_PUBLIC_IOS_APP_STORE_URL`,
`NEXT_PUBLIC_IOS_APP_STORE_APP_ID` and `NEXT_PUBLIC_ANDROID_PLAY_STORE_URL`
(today's defaults point at the April apps). Production branch `master`.

**Check:** `https://pantopus.com` shows the new home page; sign-in works;
`https://pantopus.com/.well-known/apple-app-site-association` returns JSON.

### P10. Domains and app links (founder, L4 regenerates the files)

- Vercel: add `pantopus.app` and `www.pantopus.app` to the same project without
  a redirect, so `/.well-known` files load there too (Cloudflare records DNS only).
- L4 regenerates the association files once the signing certificates exist:
  `APPLE_TEAM_ID=<team> ANDROID_SHA256_FINGERPRINTS=<Play signing>,<upload> node tools/gen-association-files.mjs`.

**Check:** Apple's and Google's link checkers accept both domains.

## 4. Store builds

### iOS (TestFlight, then App Store)

- [ ] Founder: turn on the **Sign in with Apple** capability for the App ID
  `app.pantopus.ios` (before `match` creates the App Store profile), then the
  App Store Connect app record for `app.pantopus.ios` (name per D2), an App
  Store Connect API key, a private `match` repository and password.
  Secrets in the GitHub `ios-release` environment: `STRIPE_PUBLISHABLE_KEY`,
  `MATCH_GIT_URL`, `MATCH_PASSWORD`, `MATCH_GIT_BASIC_AUTHORIZATION`,
  `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`,
  `APP_STORE_CONNECT_KEY_CONTENT` (base64 of the `.p8`), `APPLE_TEAM_ID`.
- [ ] L4: Release build points at `https://api.pantopus.com`, has no test keys or
  local URLs, and meets current App Store rules (privacy manifest, account
  deletion, Sign in with Apple, permission strings).
- [ ] Founder: run **iOS Beta (TestFlight)** (tag `ios-v<version>` or manual run).

### Android (Play internal track)

- [ ] L4: target API 36 (Google Play's requirement for new apps and updates
  since August 31, 2026), drop the unused photo and video read permissions (the
  app uses the system photo picker), Release build checks.
- [ ] Founder: Play Console app `app.pantopus.android` with Play App Signing, an
  upload keystore, a service account with release access. Secrets in
  `android-release`: `ANDROID_KEYSTORE_BASE64`, `PANTOPUS_KEYSTORE_PASSWORD`,
  `PANTOPUS_KEY_ALIAS`, `PANTOPUS_KEY_PASSWORD`, `PLAY_STORE_SERVICE_ACCOUNT_JSON`,
  `PANTOPUS_API_BASE_URL=https://api.pantopus.com`,
  `PANTOPUS_SOCKET_URL=https://api.pantopus.com`, `STRIPE_PUBLISHABLE_KEY`,
  `MAPS_API_KEY` and `GOOGLE_SERVICES_JSON` (P4).
- [ ] Founder: run **Android Beta (Play Store)**.

### Listings (founder approves; L4 drafts)

Listing text around "Know what matters for your home, and stay on top of it.",
screenshots from the simulator and emulator with test data, App Privacy and
Data safety answers from `docs/compliance/privacy-data-inventory.md`, a review
account for each store. Nothing is submitted without your approval.

## 5. Go-live

- [ ] The pilot journey passes on **production** with a founder test account
  (S10's list), on iOS, Android and the web.
- [ ] One scheduled reminder reaches the founder's iPhone (TestFlight build) and
  an Android phone from production, and tapping it opens the right screen.
- [ ] Backups: Supabase daily backup visible in the dashboard, and a first
  `scripts/db/backup-project.sh` run of production finishes with "0 missing"
  (Appendix C). L4 rehearsed the backup and restore locally on October 6.
- [ ] Monitoring: an uptime check on `https://api.pantopus.com/health` every
  minute (for example UptimeRobot or Better Stack, free tiers) alerting the
  founder's email; optional Slack alerts via `SLACK_ALERTS_WEBHOOK_URL`.
- [ ] Rollback: the **Rollback Backend** workflow with the previous release
  digest from the deploy summary (see `docs/ci-cd.md`).
- [ ] Turn off what's no longer used: the September staging site on the server
  once Vercel serves staging, and the April apps per D2.
- [ ] Start with five households (NEXT_STEPS section 4).

## Appendix A. Backend settings

Write these as `KEY=value` lines (no quotes, one line each) into
`~/pantopus/.env.staging` and `~/pantopus/.env.prod`. The deploy script adds
`NODE_ENV=production`, `APP_ENV`, `PGBOSS_ENABLED` and `CRON_ENABLED` itself.
"gen" means the value is in `~/.config/pantopus/hosted-secrets/<env>.env`.

| Setting | Staging | Production | Source |
|---|---|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | staging project | production project | Supabase → Project Settings → API |
| `DATABASE_URL` | session pooler URI, port 5432, ending `?sslmode=verify-full&sslrootcert=/app/config/certificates/supabase-prod-ca-2021.crt` | same, production | Supabase → Connect → Session pooler (the direct host is IPv6 only) |
| `PUBLIC_API_BASE_URL` | `https://staging-api.pantopus.com` | `https://api.pantopus.com` | D1 |
| `APP_URL`, `AUTH_REDIRECT_URL`, `WEB_APP_URL`, `CLIENT_URL`, `FRONTEND_URL`, `PUBLIC_WEB_URL`, `WEB_BASE_URL` | `https://staging.pantopus.com` | `https://pantopus.com` | web address |
| `APP_URLS` (allowed web origins) | `https://staging.pantopus.com` | `https://pantopus.com,https://www.pantopus.com` | |
| `TRUST_PROXY` | `1` | `1` (or `2` behind Cloudflare's proxy, P1) | |
| `INTERNAL_API_KEY`, `CSRF_SECRET`, `STEP_UP_SECRET`, `LOCATION_JITTER_SECRET`, `EMAIL_INBOUND_HMAC_SECRET`, `HOME_POSTCARD_CODE_KEYS_JSON`, `HOME_POSTCARD_CODE_ACTIVE_KEY` | gen | gen | `hosted-secrets/` |
| `GOOGLE_ADDRESS_VALIDATION_API_KEY`, `GOOGLE_PLACES_API_KEY` | required | required | Google Cloud (restrict to the server's IP) |
| `SMARTY_AUTH_ID`, `SMARTY_AUTH_TOKEN` | required | required | Smarty (subscription must be active) |
| `MAPBOX_ACCESS_TOKEN` | required | required | Mapbox secret token |
| `ATTOM_API_KEY` | optional | required for property facts | ATTOM |
| `AIRNOW_API_KEY` | required for air quality | required for air quality | free AirNow key; without it the air section says it couldn't load. Also goes in the Lambda secret (S8) |
| `OPENAI_API_KEY` | required for AI features | required for AI features | OpenAI project with a budget cap |
| `OPENAI_CHAT_MODEL`, `OPENAI_DRAFT_MODEL` | `gpt-6-luna` | `gpt-6-luna` | the model the streams verify against locally (a reasoning model: code paths pass `max_completion_tokens`, no custom `temperature`) |
| `PROPERTY_SUGGESTIONS_LLM_MODEL`, `MAGIC_TASK_AI_MODEL` | unset | unset | their defaults (`gpt-4o-mini`, `gpt-4o`) match how those calls are written; a reasoning model there rejects `max_tokens`/`temperature` |
| `LOB_ENV` | `test` | `live` | D5 |
| `LOB_API_KEY` | `test_…` | `live_…` | Lob |
| `LOB_WEBHOOK_SECRET` | Lob test webhook | Lob live webhook | Lob → Webhooks |
| `LOB_FROM_NAME`, `LOB_FROM_ADDRESS_LINE1`, `LOB_FROM_CITY`, `LOB_FROM_STATE`, `LOB_FROM_ZIP` | test address | real return address | D5 |
| `STRIPE_SECRET_KEY` | `sk_test_…` (required) | per D4 | Stripe |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_…` | per D4 | Stripe |
| `STRIPE_WEBHOOK_SECRET` | test endpoint's `whsec_…` | per D4 | Stripe → Webhooks (P7) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | D6 | D6 | Postmark (server token) |
| `SUPPORT_EMAIL`, `PLATFORM_SUPPORT_EMAIL`, `ADMIN_ALERT_EMAIL` | founder's address | support address | |
| `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY_BASE64` | existing key | existing key | Apple Developer |
| `APNS_BUNDLE_ID` | `app.pantopus.ios` | `app.pantopus.ios` | |
| `APNS_PRODUCTION` | `true` for TestFlight builds, `false` for development-signed builds | `true` | |
| `FCM_SERVICE_ACCOUNT_JSON` | `pantopus-staging` sender | production sender (P4) | Firebase, one line |
| `AWS_S3_ENDPOINT`, `AWS_S3_FORCE_PATH_STYLE=true`, `AWS_S3_REGION` and `AWS_REGION` (project region), `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET=pantopus-uploads`, `AWS_CLOUDFRONT_URL=https://<ref>.supabase.co/storage/v1/object/public/pantopus-uploads` | staging project | production project | Supabase Storage → S3 Connection (the same setup the local test kit uses). An AWS S3 bucket also works: drop the endpoint and path-style lines. |
| `HOME_DOCUMENTS_BUCKET`, `GIG_COMPLETION_BUCKET` | `home-documents`, `gig-completion` | same | S2 / P2A buckets |
| `LAMBDA_BACKED_CRON_ENABLED` | `false` | `false` | S8 |
| `SLACK_ALERTS_WEBHOOK_URL` | optional | optional | D7 |
| `LAUNCH_FEATURES` | empty | empty | launch cuts stay off |

Startup refuses a production process without `CSRF_SECRET`, `STEP_UP_SECRET`,
the Google, Smarty and Lob keys, `LOB_WEBHOOK_SECRET` and the right `LOB_ENV`,
and refuses staging without test Lob and Stripe keys.

## Appendix B. Costs (prices checked September 22, 2026)

Known recurring cost for one production Supabase Pro project, staging on Free,
one Vercel Pro seat and Postmark Basic: about **$60 a month** before usage
($25 + $20 + $15). Add the EC2 server and its disk, an Elastic IP ($3.60 a
month), Smarty ($552 a year if the Professional plan is chosen), the Apple
Developer membership ($99 a year), Play registration ($25 once if not already
paid), Lob postcards (from $0.905 each), Stripe fees on live payments (2.9% +
$0.30 per card charge; Connect payouts $2 per active account a month plus 0.25%
+ $0.25), Google and Mapbox usage beyond their free tiers, and OpenAI usage.
Check current prices before buying; these are not approvals to spend.

## Appendix C. Backups and restore (O02)

Supabase's daily backups restore the database, including the list of stored
files, but not the files' bytes (photos, documents, task media). Back up both
with `scripts/db/backup-project.sh` weekly and before any risky change. It needs
Docker (for the Supabase CLI), `psql` and the AWS CLI, which talks only to
Supabase's S3 endpoint. Keep the values in a private file, never in the shell
history, for example `~/.config/pantopus/hosted-secrets/backup-production.env`
(mode 600):

```bash
DB_URL=<Connect → Session pooler connection string, with the database password>
S3_ENDPOINT=https://<project ref>.supabase.co/storage/v1/s3
AWS_ACCESS_KEY_ID=<Storage → S3 Connection: access key id>
AWS_SECRET_ACCESS_KEY=<its secret>
AWS_REGION=us-west-2
```

```bash
set -a; source ~/.config/pantopus/hosted-secrets/backup-production.env; set +a
scripts/db/backup-project.sh ~/PantopusBackups/production-$(date -u +%Y%m%d)
```

**Check:** it ends with `Backed up the database and N Storage files … (0 missing)`.
The folder holds real user data: keep it outside the repository on an encrypted
disk (FileVault), keep the last four, and never upload it anywhere public.

To recover after losing the project, create a new empty Supabase project (P2A
steps 1 and 3: buckets and S3 key, but not `db push`), point the same variables
at it, and run:

```bash
scripts/db/restore-project.sh ~/PantopusBackups/production-<date>
```

It restores roles, schema, data and the migration ledger in one transaction,
then uploads every file with its original content type. It refuses a project
that already has tables. Then repeat P3–P5 (Auth settings, push, server env with
the new project's URL and keys) and run a release. `supabase db push --dry-run`
afterwards should list only migrations added since the backup.

What the script handles (found in the October 6 rehearsal): the postgres role
can't write Supabase's two (empty) vector-bucket tables, so they're excluded; the
migration ledger isn't part of a normal dump, so it's dumped separately; and
`aws s3 sync` would skip the files because the restored rows make them look
present, so the restore uploads each file explicitly.
