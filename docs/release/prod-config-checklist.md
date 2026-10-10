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

Staging, GitHub release gates and Lambda schedules rechecked: 2026-10-10 by L4. Other rows retain their recorded checks.

Production web, Supabase, Google Cloud, Apple, Firebase and Play checked on 2026-10-10 in the founder's signed-in browser (a Claude session working beside the founder). The rows below and the "Found October 10" list record what was read and what was changed. Secret values were never read or entered.

## 0. What's running today

| Piece | State on October 7, 2026 (19:15Z) |
|---|---|
| Website `pantopus.com` | Up, on Vercel. The deployment is about four months old (June). Its JavaScript calls `https://api.pantopus.com`. Checked October 10: the Vercel project `pantopus-web` (Hobby plan, in the founder's personal team) is connected to `WangPantopus/skinny-pantopus` with root `frontend/apps/web`, `pnpm install --frozen-lockfile`, `pnpm --filter @pantopus/web build`, Node 22 and production branch `master`; `pantopus.com` and `www.pantopus.com` are assigned to Production. Nothing has deployed from `master` yet. The `pantopus-staging` project is not in that login. |
| Production API `api.pantopus.com` | Checked October 10: doesn't answer. DNS points straight at the server's Elastic IP (DNS only) and the certificate was issued October 9, but nginx returns 502 because no production backend container has been deployed. Every "Deploy Backend to production" run is green, but its release job skips every step while `BACKEND_DEPLOY_ENABLED=false` ("Backend deployment is disabled"), so a green run is not a release. P5 and P6 below are still to do. |
| Staging | `https://staging-api.pantopus.com` runs the API and worker; `https://staging.pantopus.com` is the Vercel project `pantopus-staging`, with production branch `dev`. Last verified backend release: October 9 at 04:47 UTC (`dev 1cf15565f`); the web subsequently deployed `dev 1905772d1` at 22:11 UTC. That later push did not release the backend: CI failed on a rate-limited public PostgreSQL image pull and Deploy Backend skipped. PR 2119 repairs this for the next push. Checked October 10: API healthy, hosted checks 9/10 (Android app links await P10), active and daily staging Lambdas without observed errors, six alarms OK. S10 below distinguishes completed checks from the remaining web and physical-Android checks. |
| `pantopus.app` | The zone is on Cloudflare with no records, so `pantopus.app`, `api.pantopus.app` and `staging.api.pantopus.app` don't resolve. |
| April store apps | App Store "Pantopus" (`com.pantopus.app`, version 1.5.0 from May 12) and Google Play `com.pantopus.app`: the Expo app from the older repository. The live website links to both. Their API host was set in Expo's build settings (the old guides used `https://api.pantopus.com`); it can't be read from here. |
| New native apps | iOS `app.pantopus.ios`, Android `app.pantopus.android`: different app IDs from the April apps, so they're new store listings (decision D2). No build is uploaded anywhere yet. Checked October 10: both iOS App IDs, the App Group and the web Services ID exist with the needed capabilities; the App Store Connect record "Pantopus Home" now exists (Apple ID 6821263216, created October 10); `app.pantopus.android` is registered in Firebase `pantopus-staging`; the Play app does not exist yet (its Create app form was pre-filled). See section 4. |
| Supabase | The April production project and new `pantopus-production` project (`falmvysvndmwtfxsrxek`) are in the founder's `Pantopus` Free organization. The new project is healthy in Oregon; all 148 canonical migrations were applied and verified on October 9, and the private `home-documents` bucket is configured. Auth transfer, the two 100 MB buckets, the S3 key and managed daily backups are pending. Checked October 10 in the dashboard: Site URL `https://pantopus.com`; four redirect URLs; custom SMTP through Postmark from `hello@pantopus.com`; "Confirm email" on; Apple and Google providers disabled; minimum password length 6 (the default; the checklist's S3 says 12, and the backend and web register page already enforce 12); leaked-password protection and CAPTCHA off. Auth rate limits were raised that day from the defaults (30 / 150 / 30 per 5 minutes) to 300 sign-ups and sign-ins, 1500 refreshes and 300 verifications, as S3 specifies; email sends stay at 30 an hour. `Pantopus-staging` is separate and was reset to the canonical migrations on October 7 (S2). A separate production organization is optional billing isolation. |
| GitHub | `staging` releases from `dev` after CI. Checked October 10: `production` has nine secrets, `DB_MIGRATIONS_ENABLED=true`, and `BACKEND_DEPLOY_ENABLED=false`; automatic master runs still skip the production release. Preparation is not a deployed production service: the founder enables it at the reviewed cutover step. Store signing setup remains separate (section 4): the `ios-release` and `android-release` environments have no secrets or variables yet (checked October 10). |
| AWS Lambdas | Staging stack `pantopus-seeder-staging` carries the seeder, briefing, home-reminder, weather-alert, mail and job-trigger functions. The founder paused the April `pantopus-seeder-production` stack: all 14 EventBridge rules were independently confirmed `DISABLED` on October 10, and its briefing log has no event after October 8 at 19:14 UTC. Keep them disabled until P8 replaces the old production configuration. The April `pantopus-seeder-dev` functions were deleted; its ten schedules have nothing to run. |

**Reminders run on AWS Lambda.** Morning and evening briefings (the night-before
pickup push rides the evening one), task and bill reminders, weather alerts and
mail notices are sent by the Lambdas, which call the backend's internal API.
The pilot can't start until the Lambda stack runs against the hosted backend
(steps S8 and P8).

**Found October 10 (open items; each has the recommended fix):**

- **Stripe mode.** Vercel's `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is a live key
  (`pk_live_`, all environments), but D4 says production runs on test keys, and a
  live publishable key with a test secret key breaks card entry. In chat on
  October 10 the founder chose live payments at launch. Update D4, Appendix A's
  `STRIPE_*` rows, P7 and the Android release settings (section 4) together: the
  backend then needs the live secret key and a live webhook, and
  `PANTOPUS_ALLOW_TEST_PAYMENTS` must stay unset.
- **Google and Apple sign-in on the web.** `/login` and `/register` always show
  "Continue with Google" and "Continue with Apple", but both providers are
  disabled in the production Supabase project, so the buttons fail until the
  founder enables them (a Google client ID and secret; Apple's Services ID
  `app.pantopus.web` and its key). The Google client "Web client 1" in
  `pantopus-prod` lists only the two April Supabase callbacks: add
  `https://falmvysvndmwtfxsrxek.supabase.co/auth/v1/callback` and create a new
  secret, because Google no longer shows an existing one. The staging project's
  Google consent screen is in Testing mode with no test users.
- **Vercel plan.** The account is on Hobby: 100 deployments a day, and Vercel
  limits Hobby to personal, non-commercial use. `master` took about 200 merges
  in the 24 hours before this check, and once `"master": true` ships each one
  deploys. "Skip deployments when there are no changes to the root directory or
  its dependencies" was turned on October 10; moving to Pro (P9 already says to)
  removes the cap.
- **Password length.** Production Supabase accepts 6-character passwords; set
  12 as S3 says.

## 1. Decisions (founder)

Each has a default that the steps below follow until you change it here.

- [x] **D1 API hosts.** Decided October 6, as recommended. Default: production `https://api.pantopus.com`, staging
  `https://staging-api.pantopus.com`, for the website and both apps. Both names
  already exist in your Cloudflare zone, staging already has a certificate, and
  the website calls `api.pantopus.com` today. (The native apps defaulted to
  `api.pantopus.app`, which has no DNS; L4 switches them.) Also point
  `pantopus.app` and `www.pantopus.app` at the website (step P10): the apps share
  `https://pantopus.app` links.
- [x] **D2 Store listings.** Decided October 6, as recommended. Default: new listings for `app.pantopus.ios` and
  `app.pantopus.android`; take the April apps off sale once the new ones are
  live. The App Store won't accept a second app named exactly "Pantopus" while
  the April app holds that name, so either give the new listing a longer name
  (for example "Pantopus Home") or rename the April app first with an update.
  The alternative, shipping the native apps as updates to `com.pantopus.app`,
  means changing the native app IDs, push setup and signing; L4 doesn't
  recommend it this close to the pilot.
- [x] **D3 Production database.** Decided October 8: create a new production
  Supabase project from the canonical migrations and transfer April users'
  logins and matching app profiles after an isolated rehearsal. Preserve the
  Auth identities needed for email, Google and Apple sign-in; leave April's
  Homes, Trains and other product data in the old project. The founder runs
  the reviewed production import. See [the Auth transfer runbook](production-auth-transfer.md).
- [x] **D4 Payments during the pilot.** Decided October 6, as recommended. Default: production uses Stripe **test**
  keys until you activate live payments; no pilot journey takes money. Pilot
  store builds then carry the matching `pk_test_` key (L4 adjusts the Android
  release guard, which demands `pk_live_`). A real card fails in test mode
  instead of being charged.
- [x] **D5 Postcards.** Updated by the founder October 9: defer Lob, Google Address Validation and Smarty setup for the first public web release. Set `DEFER_ADDRESS_PROVIDER_SETUP=true` in the production backend only. Missing providers stay unavailable; no mock postcard may be sent or reported as sent. New address validation, Add Home without a fresh cached validation, and mail verification/invitations will fail until the providers are configured. When enabling Lob, provide `LOB_ENV=live`, a `live_` key, its webhook secret and a real return address (`LOB_FROM_*`; the defaults are a placeholder San Francisco address), then remove the deferral switch. Staging still requires its test providers.
- [ ] **D6 Email.** Open (October 6): the founder is checking which email service is already paid for; use that one if it does SMTP. Default: Postmark SMTP for backend email and for Supabase
  Auth email, sending from `pantopus.com` with SPF, DKIM and DMARC.
- [x] **D7 Error monitoring.** Decided October 6, as recommended. Default: off. Sentry and PostHog keys are optional
  (backend `SLACK_ALERTS_WEBHOOK_URL`, app `SENTRY_DSN`).
- [x] **D8 Hosting.** Decided October 6, as recommended. Default: the September server carries both staging
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

**First stop everything connected to the staging database.** The September
staging server still runs a backend and a worker against `Pantopus-staging`;
while they are connected, `db reset` fails with "deadlock detected" (it did on
October 7). On the server:

```bash
docker ps --format '{{.Names}}'                                 # find the staging containers
docker stop pantopus-backend-staging pantopus-worker-staging    # use the names docker ps shows
```

Leave them stopped: S6's first release starts new ones on the reset database.
If a September staging Lambda stack is running (CloudFormation
`pantopus-seeder-staging`), disable its EventBridge schedules until S8 too; it
writes through Supabase's API. If a reset already failed with "deadlock
detected", stop them and run `sb db reset --linked` again; it starts from
scratch.

Then on the Mac, from the repository root. Run the CLI version that
`supabase/migration-policy.json` pins (2.116.0) through `npx`; the first run
downloads it once (about 40 MB). The Mac's own `supabase` command (Homebrew,
2.98.2) runs the launch streams' local test databases, so leave it as it is.

```bash
alias sb='npx --yes supabase@2.116.0'   # used again in P2
sb login
sb link --project-ref <staging project ref>
sb db reset --linked        # existing project: drops its objects, replays every migration
# or, for a brand-new empty project:
sb db push --linked
```

Then in the Supabase dashboard → Storage, create three buckets: **private**
`home-documents` (file size limit 25 MB), **private** `gig-completion` (100 MB)
and **public** `pantopus-uploads` (100 MB) for avatars and post photos. Under
Storage → S3 Connection, create an access key for the backend (Appendix A,
storage row).

**Check:** before the reset, `docker ps` on the server lists no staging
backend or worker. After it, `sb migration list --linked` shows every file in
`supabase/migrations/` on both sides, and `sb db push --linked --dry-run`
reports nothing to push. In the dashboard, `home-documents` and `gig-completion`
show as private.

### S3. Staging Auth (founder)

Supabase dashboard → Authentication:

- URL configuration: Site URL `https://staging.pantopus.com`; redirect URLs
  `https://staging.pantopus.com/auth/callback`, `https://staging.pantopus.com/**`
  and `pantopus://auth/callback`.
- Email: confirm email **on**; minimum password length **12**; custom SMTP from
  D6 (sender `Pantopus Staging <staging@pantopus.com>`).
- Rate limits: every sign-in, sign-up, token refresh, password reset and email
  confirmation reaches Supabase from the API server's one address, so
  Supabase's per-address defaults would cap the whole app (30 sign-ups, resets
  and resends, and 150 sign-ins and refreshes, per 5 minutes; a launch-day
  burst of sign-ups would fail). The API already limits each visitor (20
  sign-ins or sign-ups a minute per address; resets and resends have their
  own limits). Under Rate Limits set, per 5 minutes: sign-ups and sign-ins
  **300**, token refreshes **1500**, verifications **300**. Email sending
  follows your SMTP plan.
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
values). Startup only checks that the provider keys exist, so test the Smarty
keys, which must belong to an account with an active subscription (on October 7
staging's didn't, and every Add Home said verification was unavailable). This
prints `200`; `402` means no active subscription, `401` wrong keys:

```bash
id=$(grep '^SMARTY_AUTH_ID=' ~/pantopus/.env.staging | cut -d= -f2-); tok=$(grep '^SMARTY_AUTH_TOKEN=' ~/pantopus/.env.staging | cut -d= -f2-); curl -s -o /dev/null -w '%{http_code}\n' "https://us-street.api.smarty.com/street-address?auth-id=$id&auth-token=$tok&street=616+NE+4th+Ave&city=Camas&state=WA"
```

The backend's own startup checks run in S6.

### S5. GitHub `staging` environment (founder)

Repository → Settings → Environments → `staging`:

| Kind | Name | Value |
|---|---|---|
| Secret | `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` | Docker Hub user and a read/write access token |
| Secret | `EC2_HOST` | the Elastic IP |
| Secret | `EC2_USERNAME` | the server's SSH user |
| Secret | `EC2_SSH_KEY` | private key for that user |
| Secret | `EC2_KNOWN_HOSTS` | the verified host-key line (`ssh-keyscan` output checked against the console) |
| Secret | `SUPABASE_ACCESS_TOKEN` | a Supabase access token (Account → Access Tokens) |
| Secret | `SUPABASE_PROJECT_ID`, `SUPABASE_DB_PASSWORD` | the staging project's ref and database password |
| Variable | `BACKEND_API_BIND` | `127.0.0.1:18001` |
| Variable | `SUPABASE_SESSION_POOLER_HOST` | the session-pooler host from the staging project's **Connect** dialog (`aws-<n>-us-west-2.pooler.supabase.com`). GitHub's runners have no IPv6 and the project's direct address is IPv6-only. |
| Variable | `DB_MIGRATIONS_ENABLED` | `true` (the database took the migrations in S2) |
| Variable | `BACKEND_DEPLOY_ENABLED` | `true` (last, after everything above) |

Each release first applies any new migrations to the staging project, then swaps
the containers; without the three Supabase secrets, the pooler host and
`DB_MIGRATIONS_ENABLED=true` it stops before the swap. Deployment branch rule:
allow `master` and `dev` (see `docs/ci-cd.md`). **Done October 7.**

### S6. Staging releases (founder starts, L4 watches)

The first release ran on October 7 (19:00Z). Release master to staging again
whenever you want staging current:

```bash
git fetch origin
git push origin origin/master:refs/heads/dev
```

If Git rejects that as non-fast-forward, `dev` holds a commit master doesn't
(on October 7, PR 1832's branch commit, which master took as a squash). When
`git log --oneline origin/master..origin/dev` lists only work master already
has, replace it: `git push --force-with-lease origin origin/master:refs/heads/dev`.

CI runs on `dev`; when it passes, **Deploy Backend** builds the image, applies
new migrations, starts an unexposed candidate, checks its database connection,
then swaps the API and worker together and keeps the previous containers for
rollback. GitHub lists the run under `master`; its name reads `Deploy Backend to
staging (dev <commit>)`. It skips quietly when no backend file changed since
staging's last release; to release anyway (for example after changing an
environment setting), run `gh workflow run deploy-backend.yml --ref dev`.

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
  `NEXT_PUBLIC_MAPBOX_TOKEN=<public pk.… token>`, and
  `EDGE_PROXY_SECRET` (a plain variable, never `NEXT_PUBLIC_`; the value in
  `hosted-secrets/staging.env`, which the server's env file also gets in S4).
  It lets the API see each web visitor's own address instead of Vercel's, so
  web sign-ins and sign-ups are limited per visitor, not shared by everyone.
  Leave `NEXT_PUBLIC_LAUNCH_FEATURES` empty: cut features stay hidden.
- Domains: assign `staging.pantopus.com` to the `dev` branch, then change its
  Cloudflare record to Vercel's CNAME (DNS only). The September staging site on
  the server can then be retired.
- Automatic deployments: `frontend/apps/web/vercel.json` lets only `dev`
  deploy. The Hobby plan allows 100 deployments in any 24 hours, and a preview
  of every pull-request push and every merge to `master` (over 100 merges on
  October 8 alone) used them up, so the `dev` push that releases staging could
  not deploy. CI builds the production web app for every web change instead
  (the "Production build" step).

**Check:** `https://staging.pantopus.com` loads, sign-in works, and the browser's
network panel shows API calls going to `/api/...` on the same origin (Next.js
forwards them to the staging API). Then send the signed-in account a chat
message from another account: it must appear without a reload. The web's
realtime connects to `/socket.io` on its own origin; Vercel doesn't proxy
WebSockets, so Socket.IO stays on HTTP long-polling through that rewrite (its
25-second polls fit Vercel's 120-second origin timeout). A failed WebSocket
upgrade in the network panel is expected; chat that only updates on reload is not.
Also run `node scripts/staging/check-hosted.cjs https://staging.pantopus.com https://staging-api.pantopus.com`
from the repository: every line passes except Android app links, which wait for P10.

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

L4 runs the pilot journey on staging with a synthetic account the founder signs
up and signs in (L4 creates no accounts on hosted hosts): email confirmation,
Add Home (private setup), Today, pickup days, radon task, task done, a reminder
push delivered to the founder's iPhone (TestFlight) and an Android phone,
notification tap-through, and the web for the same account. Failures go to the
owning stream. A household invitation needs a verified owner, so it waits for
the identity decision (Stripe Identity or a photo-ID check).

**Verified so far:** the founder created and signed in the staging owner; the Android
staging app completed Add Home in private setup, Today, pickup days, radon, task
creation/completion and relaunch persistence. The founder confirmed the October 8
7 AM task reminder reached the iPhone and opened the task. On October 10, the
signed-out web address preview loaded current weather, air and alerts and carried
its preview into sign-in; area facts still need the Census key.

**Still open:** the same-account signed-in web journey, the physical Android
reminder, and the invitation after the identity decision. Vercel released the newer
web independently of backend CI. A new `dev` push must
finish CI and Deploy Backend before the newer API changes count as staging-verified.

## 3. Production

Same shape as staging, with live vendors where D4 and D5 say so.

### Before P1: keep the April Lambda stack paused (founder completed)

**Verified October 10:** all 14 rules are disabled; no recent production briefing runs.
The command below remains the pause/rollback reference. Do not enable schedules before P8.

The April stack `pantopus-seeder-production` retains its April database settings
(section 0). Enabling its schedules before replacing those settings could send
April users briefings and reminders with the old code. To pause its 14 schedules
again if needed, without deleting anything:

```bash
for r in $(aws cloudformation describe-stack-resources --region us-west-2 --stack-name pantopus-seeder-production \
    --query "StackResources[?ResourceType=='AWS::Events::Rule'].PhysicalResourceId" --output text); do
  aws events disable-rule --region us-west-2 --name "$r"
done
```

**Check:** the command below prints `14 DISABLED`, and 15 minutes later the
CloudWatch log group `/aws/lambda/pantopus-briefing-scheduler-production` has no
new run:

```bash
aws events list-rules --region us-west-2 --name-prefix pantopus- \
  --query "Rules[?ends_with(Name,'-production')].State" --output text | tr '\t' '\n' | sort | uniq -c
```

To undo, run the loop with `enable-rule`. P8 turns the stack into the
production one and switches the schedules back on.

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

### P2A. Production database: new project (founder)

1. The founder created `pantopus-production` (`falmvysvndmwtfxsrxek`) in
   `us-west-2` (Oregon, next to the server). It is currently empty in the
   existing `Pantopus` Free organization. It can stay there. If the founder
   wants the April archive to remain on Free after the production upgrade,
   transfer the new project to a separate organization first; Supabase plans
   apply to the whole organization. **Before transferring April logins or
   sending production traffic, upgrade the organization holding the new project
   to Pro and confirm daily backups are available.** The two planned 100 MB
   Storage buckets also require Pro: Supabase's Free global upload limit cannot
   exceed 50 MB. Set the global Storage file-size limit to at least 100 MB
   before setting those bucket limits.
   Point-in-time recovery is optional.
2. From a dedicated production worktree based on the latest `master`, after its
   CI is green, use the CLI version pinned in S2. Do not relink the staging
   checkout. The Mac's saved CLI login is for staging. The founder creates a
   production Supabase access token and puts it and the new project's database
   password in a private `0600` file outside the repository, as
   `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD`; never paste either into
   chat or a command argument. Scope the token to `pantopus-production` only,
   with Read access to Project Settings, API Keys, API Key Secrets, and
   Database → Connection Pooling; leave all other permissions off. The last
   permission lets the CLI discover the IPv4 pooler endpoint on networks
   without IPv6. The environment token overrides the saved
   staging login. The founder loads that file only in this terminal session.
   Nothing should be connected to the new project yet; if a production backend
   or worker already points at it, stop it first. Verify that the linked ref is
   exactly `falmvysvndmwtfxsrxek` and review the dry-run migration list before
   the founder runs the push. `--skip-vault` prevents an unrelated Vault update.
   ```bash
   alias sb='npx --yes supabase@2.116.0'
   set -a
   source ~/.config/pantopus/hosted-secrets/supabase-prod-cli.env
   set +a
   : "${SUPABASE_ACCESS_TOKEN:?missing production token}"
   : "${SUPABASE_DB_PASSWORD:?missing production database password}"
   sb link --project-ref falmvysvndmwtfxsrxek
   test "$(cat supabase/.temp/project-ref)" = falmvysvndmwtfxsrxek
   test -s supabase/.temp/pooler-url
   sb db push --linked --skip-vault --dry-run
   # Founder only, after checking the dry run and project ref:
   sb db push --linked --skip-vault
   sb migration list --linked
   unset SUPABASE_ACCESS_TOKEN SUPABASE_DB_PASSWORD
   ```
   Stop if either `test` fails or the dry run cannot connect; the project must
   be linked to the expected ref through its IPv4 pooler before any push.
   Never use `db reset --linked` or `--include-seed` on production.
3. Storage buckets and the S3 access key as in S2. The private 25 MB
   `home-documents` bucket can be created on Free. For the 100 MB private
   `gig-completion` and public `pantopus-uploads` buckets, upgrade first and
   verify the global Storage limit; do not silently substitute 50 MB limits.
   See [Supabase's file limits](https://supabase.com/docs/guides/storage/uploads/file-limits).
4. Transfer April logins and matching app profiles only after the private
   export and isolated rehearsal in [the Auth transfer runbook](production-auth-transfer.md).
   Check matching IDs, email/password and OAuth sign-in, and new-app access
   before pointing the API at the project. The founder runs the reviewed import.
5. Keep the April project available until the login transfer and sign-in checks
   pass; don't delete it. A project in a Pro organization cannot be paused, so
   keeping both projects in `Pantopus` will also keep the April archive active
   and billed for its compute. Decide its long-term archive placement later.
6. Supabase's daily backups cover the database only, not uploaded files. Set
   up the file backup in Appendix C before the first household signs up.

**Check:** as in S2: `sb db push --linked --skip-vault --dry-run` reports nothing to
push, and the three buckets exist with the right privacy.

**Schema status, October 9:** the founder applied the 148 migrations to
`falmvysvndmwtfxsrxek` from the dedicated production worktree. Read-only
verification found 148 matching local and remote migration versions, no
local-only or remote-only versions, and no pending migration in a fresh dry run.
The two 100 MB Storage buckets, S3 access key, Auth transfer and backup
upgrade remain to be done.

**Plan decision, October 9:** stay on Free for now. Defer the two 100 MB
buckets and April login import until the founder chooses to upgrade. The
private 25 MB `home-documents` bucket can be prepared on Free. The founder
later directed a public backend and web cutover before importing April
logins, accepting that those accounts cannot sign in to the new project yet.
Do not report login preservation as complete until the Auth transfer is
rehearsed, run and verified. The two deferred buckets also leave their upload
flows unavailable.

**Storage status, October 9:** the founder created `home-documents`. A
read-only Storage API check confirmed it is private with a 26,214,400-byte
(25 MiB) file-size limit. `gig-completion` and `pantopus-uploads` are absent,
as planned.

### P2B. Production database: adopt the April project (only if D3 says so)

Don't run any of this until L4 has rehearsed it on a copy:

1. Founder: take a full backup outside the repository:
   `sb db dump --linked -f <private>/schema.sql`,
   `sb db dump --linked --data-only --use-copy -f <private>/data.sql`, and
   the ledger with `sb migration list --linked` (the `sb` alias from S2). Hand L4 the files
   privately (they contain real users' data).
2. L4: restore them into a disposable local database, apply the September
   forward-upgrade SQL (retained in the private evidence archive under
   `baseline-adoption/`), compare catalogs with the canonical baseline, then
   apply every later migration, and write the exact ledger-repair commands.
3. Founder, in a maintenance window: first stop everything connected to the
   April project, as in S2 (on the server, the June production container and
   any worker: `docker ps`, then `docker stop` them; schema changes deadlock
   with live connections). Then run the reviewed SQL and ledger repair, and
   `sb db push --linked`. See `docs/supabase-migration-automation-runbook.md`.

### P3. Production Auth (founder)

As in S3, with Site URL `https://pantopus.com`, redirect URLs
`https://pantopus.com/auth/callback`, `https://www.pantopus.com/auth/callback`,
`https://pantopus.com/**` and `pantopus://auth/callback`, production SMTP sender
`Pantopus <hello@pantopus.com>`, the same rate limits, and the production Apple
and Google settings.

**Status, October 10:** Site URL, the four redirect URLs, Postmark SMTP,
"Confirm email" and the S3 rate limits (300 / 1500 / 300) are set. Still open:
the Apple and Google providers (disabled; see "Found October 10") and the
12-character minimum password length (it is 6).

### P4. Production Firebase and APNs (founder)

- Firebase: add an Android app `app.pantopus.android` (in a production Firebase
  project, or `pantopus-staging` if you accept one project for the pilot),
  download its `google-services.json` for the `GOOGLE_SERVICES_JSON` release
  secret, and create a service account with only the Firebase Cloud Messaging
  admin role for the backend (`FCM_SERVICE_ACCOUNT_JSON`, one line).
  **October 10:** `app.pantopus.android` is registered in `pantopus-staging`
  (the one-project option; before that only `app.pantopus.android.debug` was
  there). Downloading `google-services.json` and creating the service-account
  key are still the founder's steps.
- APNs: the existing key works for sandbox and production. Production uses
  `APNS_PRODUCTION=true`: TestFlight and App Store builds receive production
  pushes.

### P5. Production env file (founder, on the server)

Write `~/pantopus/.env.prod` as in S4 from `hosted-secrets/production.env` and
Appendix A's production column. **First move the June file aside**
(`mv .env.prod .env.prod.june-2026`): the deploy reads `.env.prod` for the new
containers, and none of the June settings (old database, old keys) may carry
over. Then run S4's checks against `.env.prod`; skip the Smarty lookup only
while `DEFER_ADDRESS_PROVIDER_SETUP=true` and Smarty keys are absent.

### P6. GitHub `production` environment and first release (founder)

Only after P1 to P5: the release needs the server's address, a database with
every migration, Auth, and `.env.prod` (use the explicit provider deferral in
D5 if the live keys are not ready). Same secrets as S5 with production values
(the production project's ref and database password); variables
`BACKEND_API_BIND=127.0.0.1:8000`, `SUPABASE_SESSION_POOLER_HOST` from the
production project's **Connect** dialog and `DB_MIGRATIONS_ENABLED=true` (P2A's
dry run reports nothing to push); keep the environment restricted to `master`;
set `BACKEND_DEPLOY_ENABLED=true` last. Then start the first release yourself
rather than waiting for a backend merge:

```bash
gh workflow run deploy-backend.yml --ref master
```

The run reads `Deploy Backend to production (master <commit>)`; after it, every
master merge that changes the backend releases automatically. If the June
container is named `pantopus-backend`, the deploy stops it and keeps it as
`pantopus-backend-previous`, the automatic fallback if the first start fails.

**Check:** `curl -s https://api.pantopus.com/health` is healthy, and both
containers are healthy on the server.

### P7. Stripe and Lob webhooks (founder)

- Stripe (test mode per D4, live later): endpoint
  `https://api.pantopus.com/api/webhooks/stripe`, events as listed in
  `backend/stripe/stripeWebhooks.js`; put its signing secret in
  `STRIPE_WEBHOOK_SECRET`.
- Lob (live, when mail is enabled): webhook
  `https://api.pantopus.com/api/v1/webhooks/lob`; its secret in
  `LOB_WEBHOOK_SECRET`.

### P8. Production scheduled jobs (founder runs, L4 prepared)

The April stack `pantopus-seeder-production` already exists, so
`sam deploy --config-env prod` updates it in place: new code, the job trigger,
the failure alarms and the Pacific-time reminder schedules. The stack never
writes secret contents, so the secret `pantopus/seeder/production` keeps its
April values (the April database and its service key) until you replace them.
In this order:

1. Make sure the April schedules are paused (start of section 3). While they
   run, a new secret would let April's code act on the new production.
2. Replace the secret's value as in S8 step 2, with the production values: the
   production project's `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`,
   `PANTOPUS_API_BASE_URL=https://api.pantopus.com`, the production
   `INTERNAL_API_KEY` (in `hosted-secrets/production.env`), a production
   curator account, `OPENAI_API_KEY`, `AIRNOW_API_KEY` and the WeatherKit keys:
   ```bash
   aws secretsmanager put-secret-value --secret-id pantopus/seeder/production --secret-string file://<private json file>
   ```
3. Deploy as in S8 step 1, ending with `sam deploy --config-env prod`.
4. Switch the schedules back on. A deploy that doesn't change a schedule leaves
   it paused:
   ```bash
   for r in $(aws cloudformation describe-stack-resources --region us-west-2 --stack-name pantopus-seeder-production \
       --query "StackResources[?ResourceType=='AWS::Events::Rule'].PhysicalResourceId" --output text); do
     aws events enable-rule --region us-west-2 --name "$r"
   done
   ```
5. Subscribe your inbox to `pantopus-job-alarms-production` as in S8 step 4.

**Check:** as S8 with `-production` names. Every rule in the stack is
`ENABLED`; `aws scheduler list-schedules --region us-west-2` lists
`pantopus-home-reminders-morning-production` and
`pantopus-home-reminders-evening-production`; and the log of
`pantopus-briefing-scheduler-production` shows requests to the database you
chose in P2 (with P2A, the new project's `<ref>.supabase.co`, not the April
`ankjdyvoduutkhhaxvhx`).

### P9. Production web (founder)

Vercel Production environment variables: `NEXT_PUBLIC_API_URL=https://api.pantopus.com`,
`NEXT_PUBLIC_APP_URL=https://pantopus.com`, `NEXT_PUBLIC_APP_ENV=production`,
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (matching D4), `NEXT_PUBLIC_MAPBOX_TOKEN`,
`EDGE_PROXY_SECRET` (the value in `hosted-secrets/production.env`, as in S7).
Leave `NEXT_PUBLIC_IOS_APP_STORE_URL`, `NEXT_PUBLIC_IOS_APP_STORE_APP_ID` and
`NEXT_PUBLIC_ANDROID_PLAY_STORE_URL` unset until the new store listings exist;
remove any old values pointing to the April apps from the Vercel project. The
web app no longer falls back to April store links. Regenerate the two landing
page QR images for the new listings before setting
`NEXT_PUBLIC_STORE_QR_CODES_READY=true` to reveal that download block.
Production branch `master`.
Before this step L4 adds `"master": true` under `git.deploymentEnabled` in
`frontend/apps/web/vercel.json` (S7); without it `master` never deploys. Keep
the Vercel account on Pro from here, or production and staging deployments
share the 100-a-day Hobby limit.

**Status, October 10:** the project's Production variables are
`NEXT_PUBLIC_API_URL=https://api.pantopus.com`,
`NEXT_PUBLIC_APP_URL=https://pantopus.com`, `NEXT_PUBLIC_APP_ENV=production`,
`NEXT_PUBLIC_MAPBOX_TOKEN`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (a live key; see
"Found October 10") and `EDGE_PROXY_SECRET` (its value can't be read back, so
confirm it matches the server through the Settings → Security check below). No
store-link variables are set. `NEXT_PUBLIC_API_URL` is read at build time by
`next.config.js` for the `/api` and `/socket.io` rewrites; without it a build
proxies to `http://localhost:8000`, so change variables only with a new build.

**Check:** `https://pantopus.com` shows the new home page; sign-in works;
`https://pantopus.com/.well-known/apple-app-site-association` returns JSON;
the web's Settings → Security page (`/app/settings/security`) shows this
browser's last address as your own network's, not a Vercel or Amazon one (if it
doesn't, `EDGE_PROXY_SECRET` differs between Vercel and the server).

### P10. Domains and app links (founder, L4 regenerates the files)

- Vercel: add `pantopus.app` and `www.pantopus.app` to the same project without
  a redirect, so `/.well-known` files load there too (Cloudflare records DNS only).
- L4 regenerates the association files once the signing certificates exist:
  `APPLE_TEAM_ID=<team> ANDROID_SHA256_FINGERPRINTS=<Play signing>,<upload> node tools/gen-association-files.mjs`.
  **October 10:** the iOS half is already on master (`6UYZBA546R.app.pantopus.ios`
  in `applinks` and `webcredentials`; `APPLE_TEAM_ID=6UYZBA546R node
  tools/gen-association-files.mjs --check` reports "up to date", and the Team ID
  is the one on the founder's Apple account). The hosted-check failure for it
  came from the June deployment still being live. Only the Android statement is
  missing: it needs the Play App Signing and upload certificate SHA-256s, which
  exist after the Play app and its first upload.

**Check:** Apple's and Google's link checkers accept both domains, and
`node scripts/staging/check-hosted.cjs https://pantopus.com https://api.pantopus.com --production`
passes every line (health, HTTPS, security headers, the web's API and realtime forwarding, both
app-link files, robots.txt).

## 4. Store builds

### iOS (TestFlight, then App Store)

- [ ] Founder: in Certificates, Identifiers & Profiles register the App Group
  `group.app.pantopus.ios` and two App IDs: `app.pantopus.ios` with **Sign in
  with Apple**, **Push Notifications**, **Associated Domains** (app links and
  saved passwords) and **App Groups** (that group), and
  `app.pantopus.ios.widgets` (the home-screen widget, which ships inside the
  app) with **App Groups** (the same group). Do this before `match` creates the
  App Store profiles, because a profile only carries the capabilities its App ID
  had then. Then the App Store Connect app record for `app.pantopus.ios` (name
  per D2), an App Store Connect API key, a private `match` repository and
  password. Create both profiles once on the Mac, from `frontend/apps/ios`:
  `bundle exec fastlane match appstore --app_identifier app.pantopus.ios,app.pantopus.ios.widgets`
  (CI runs `match` read-only). The release lanes sign both targets with these
  profiles (`app_store_signing` in the Fastfile).
  Secrets in the GitHub `ios-release` environment: `STRIPE_PUBLISHABLE_KEY`,
  `MATCH_GIT_URL`, `MATCH_PASSWORD`, `MATCH_GIT_BASIC_AUTHORIZATION`,
  `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`,
  `APP_STORE_CONNECT_KEY_CONTENT` (base64 of the `.p8`), `APPLE_TEAM_ID`.
  **Status, October 10 (checked in the developer account and App Store
  Connect):** done: both App IDs with their capabilities (the main one has Sign in
  with Apple, Push Notifications, Associated Domains, App Groups and In-App
  Purchase; the widget has App Groups), the App Group `group.app.pantopus.ios`,
  the web Services ID `app.pantopus.web`, and the App Store Connect record
  "Pantopus Home" (Apple ID 6821263216, SKU `pantopus-home-ios`, created October
  10). The App Privacy answers from `docs/compliance/appstore-privacy-labels.md`
  are entered (17 data types: 16 for App Functionality, Product Interaction for
  Analytics, all linked, none for tracking) with the privacy policy URL
  `https://pantopus.com/privacy`; they are **not published**, so review them and
  click Publish. That sheet files chat messages under "Other User Content" while
  the app's privacy manifest also lists "Emails or Text Messages"; consider
  adding it to the label so the two agree. Still to do: the age rating (not in
  the approved docs), App Review sign-in details, pricing and availability, the
  App Store Connect API key, the private `match` repository, the secrets, the
  profiles (`match` creates them; none exist for the new App IDs) and the
  TestFlight run.
- [ ] L4: Release build points at `https://api.pantopus.com`, has no test keys or
  local URLs, and meets current App Store rules (privacy manifest, account
  deletion, Sign in with Apple, permission strings). The app is iPhone-only (no
  iPad layouts), so App Store Connect needs iPhone screenshots only.
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
  `MAPS_API_KEY` and `GOOGLE_SERVICES_JSON` (P4). While the pilot uses Stripe test
  mode (D4), the secret is the `pk_test_` key and the environment also needs the
  **variable** (not secret) `PANTOPUS_ALLOW_TEST_PAYMENTS=true`; without it the
  release build refuses anything but `pk_live_`. Delete the variable when live
  payments start. iOS needs no switch: its secret simply carries the matching key.
  **Status, October 10:** the Play account is an organization account with only
  the April app. The Create app form for "Pantopus Home" (`app.pantopus.android`,
  English (United States), App, Free) was filled in and the package name is
  available; the founder accepts the two declarations and presses Create. After
  that: Play App Signing, the upload keystore, the service account, the secrets
  above, then Data safety (from `docs/compliance/play-data-safety.md`, after the
  web deploy so `/delete-account` is live), the content rating, target audience
  and App access (a review account). Firebase has `app.pantopus.android`
  registered; `GOOGLE_SERVICES_JSON` is still the founder's download.
- [ ] Founder: run **Android Beta (Play Store)**.

### Listings (founder approves; L4 drafts)

- [x] Founder approved the listing text, screenshots, privacy answers and the
  account-deletion page on October 7 (decisions A and B are written into the
  privacy scripts). Both listings use the name "Pantopus Home" per D2.
- [x] L4: the approved files are where the lanes read them. iOS: text in
  `frontend/apps/ios/fastlane/metadata/en-US/` and 8 iPhone screenshots
  (6.9-inch, 1320 × 2868) in `frontend/apps/ios/fastlane/screenshots/en-US/`;
  the `release` lane uploads both and submits for review. Android: text and
  images in `frontend/apps/android/fastlane/metadata/android/en-US/` (5 phone
  screenshots at 1080 × 2160, the 512 × 512 icon and the 1024 × 500 feature
  graphic Play requires). Once the app exists in Play Console, run
  `bundle exec fastlane listing` from `frontend/apps/android` with the service
  account file in `fastlane/play-service-account.json` (as the beta lane uses),
  or upload the same files in the console; the beta and release lanes still
  skip the listing.
- [ ] Founder: enter the App Privacy and Data safety answers
  (`docs/compliance/appstore-privacy-labels.md`, `play-data-safety.md`) and
  create a review account for each store. Play's Delete account URL
  (`https://pantopus.com/delete-account`) is live after the production web
  deploy (P9). Nothing is submitted without you.

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
- [ ] Log retention: CloudWatch keeps Lambda logs forever unless told otherwise,
  and on October 8 every `pantopus-*` log group was set that way. The April
  production ones hold about 110 MB, including April users' ids from the old
  code's request logging. Keep 30 days on all of them, after P8 and again
  whenever a function is added (it deletes older log lines, nothing else):
  ```bash
  for g in $(aws logs describe-log-groups --region us-west-2 --log-group-name-prefix /aws/lambda/pantopus- \
      --query 'logGroups[].logGroupName' --output text); do
    aws logs put-retention-policy --region us-west-2 --log-group-name "$g" --retention-in-days 30
  done
  ```
  **Check:** this prints `[]` (on October 8 it listed all 27 groups):
  ```bash
  aws logs describe-log-groups --region us-west-2 --log-group-name-prefix /aws/lambda/pantopus- \
    --query 'logGroups[?retentionInDays!=`30`].logGroupName'
  ```
- [ ] Rollback: the **Rollback Backend** workflow with the previous release
  digest from the deploy summary (see `docs/ci-cd.md`). L4 rehearsed the same
  deploy and rollback transaction locally on October 6: about 22 s per release,
  about 3 s of API downtime, and a broken release stops before the running API.
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
| `EDGE_PROXY_SECRET` | gen | gen | `hosted-secrets/`; the same value goes into Vercel (S7, P9) |
| `GOOGLE_ADDRESS_VALIDATION_API_KEY`, `GOOGLE_PLACES_API_KEY` | required | deferred for first web release | Google Cloud (restrict to the server's IP) |
| `SMARTY_AUTH_ID`, `SMARTY_AUTH_TOKEN` | required | deferred for first web release | Smarty (subscription must be active; S4 checks it) |
| `DEFER_ADDRESS_PROVIDER_SETUP` | unset | `true` until the live Google, Smarty and Lob settings are ready; then remove | production-only startup switch, D5 |
| `MAPBOX_ACCESS_TOKEN` | required | required | Mapbox secret token |
| `ATTOM_API_KEY` | optional | required for property facts | ATTOM |
| `AIRNOW_API_KEY` | required for air quality | required for air quality | free AirNow key; without it the air section says it couldn't load. Also goes in the Lambda secret (S8) |
| `CENSUS_API_KEY` | required for area facts | required for area facts | free Census key (api.census.gov/data/key_signup.html); the Census API refuses keyless calls, so without it Place's "Homes here", the address preview's area facts and the tract medians are unavailable (checked on staging October 9) |
| `OPENAI_API_KEY` | required for AI features | required for AI features | OpenAI project with a budget cap |
| `OPENAI_CHAT_MODEL`, `OPENAI_DRAFT_MODEL` | `gpt-6-luna` | `gpt-6-luna` | the model the streams verify against locally (a reasoning model: code paths pass `max_completion_tokens`, no custom `temperature`) |
| `PROPERTY_SUGGESTIONS_LLM_MODEL`, `MAGIC_TASK_AI_MODEL` | unset | unset | their defaults (`gpt-4o-mini`, `gpt-4o`) match how those calls are written; a reasoning model there rejects `max_tokens`/`temperature` |
| `LOB_ENV` | `test` | `live` when Lob is enabled | D5 |
| `LOB_API_KEY` | `test_…` | deferred; `live_…` when enabled | Lob |
| `LOB_WEBHOOK_SECRET` | Lob test webhook | deferred; live webhook secret when enabled | Lob → Webhooks |
| `LOB_FROM_NAME`, `LOB_FROM_ADDRESS_LINE1`, `LOB_FROM_CITY`, `LOB_FROM_STATE`, `LOB_FROM_ZIP` | test address | real return address before enabling mail | D5 |
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
| `HOUSEHOLD_CLAIM_V2_READ_PATHS`, `HOUSEHOLD_CLAIM_PARALLEL_SUBMISSION`, `HOUSEHOLD_CLAIM_CHALLENGE_FLOW`, `HOUSEHOLD_CLAIM_ADMIN_COMPARE` | `true` | `true` | the ownership-claim behaviour the apps were verified against locally (a second claimant on a Home gets a parallel claim, not a refusal); unset, all four default to `false`, the older claim path |

Startup still requires `CSRF_SECRET` and `STEP_UP_SECRET`. By default it also
requires Google, Smarty and live Lob settings. Only the explicit production
deferral permits those providers to be absent; a configured Lob sender still
requires its live key, `LOB_ENV=live` and webhook secret. Staging still requires
test Lob and Stripe keys. Provider deferral does not cover other production
settings such as Supabase, SMTP or payment configuration.

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
the new project's URL and keys) and run a release. `sb db push --linked --dry-run`
afterwards should list only migrations added since the backup.

What the script handles (found in the October 6 rehearsal): the postgres role
can't write Supabase's two (empty) vector-bucket tables, so they're excluded; the
migration ledger isn't part of a normal dump, so it's dumped separately; and
`aws s3 sync` would skip the files because the restored rows make them look
present, so the restore uploads each file explicitly.
