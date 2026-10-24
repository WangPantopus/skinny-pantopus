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

Staging, GitHub release gates and Lambda schedules rechecked: 2026-10-11 by L4. Other rows retain their recorded checks.

## Current verification and founder handoff — October 13, 2026

This read-only pass used the founder's signed-in Chrome dashboards, GitHub,
AWS metadata and the existing public hosted checks. No hosted configuration,
database, credential, billing, notification schedule or store submission was
changed. The dated sections below remain procedural references; the observations
here supersede their earlier status snapshots, not founder decisions.

### Completed independent checks

- [x] Checked the clean worktree, remote branches and open PRs before work.
  Remote `master` was `e4bb30e90`; `dev` was still `132e45a5f`.
  CI for the current master was pending when inspected. A previous successful
  Deploy Backend workflow is **not** a production release: in
  [run 38516417130](https://github.com/WangPantopus/skinny-pantopus/actions/runs/38516417130),
  preflight succeeded and **Release backend was skipped**.
- [x] Re-ran `scripts/staging/check-hosted.cjs` on both environments.
  Staging passes 9/10; the missing native Android association is the only
  failure. Production passes 3/10: the home page, HTTPS origin and production
  robots policy. API health and both realtime paths return 502; API forwarding
  returns 502; web security headers and both native app associations fail.
  A passing anonymous check does not complete S10 or the production journey.
- [x] Checked GitHub environment metadata, without reading secret values.
  Production still has `BACKEND_DEPLOY_ENABLED=false` and
  `DB_MIGRATIONS_ENABLED=true`, with nine secret names present. Both
  `ios-release` and `android-release` have **zero environment secrets**;
  `android-release` also lacks `PANTOPUS_ALLOW_TEST_PAYMENTS`. Neither beta
  workflow has a run in its current workflow history.
- [x] Verified Vercel's `pantopus-web` production deployment is still the
  June 11 build (`5f76594`, source branch `main`); the project's current
  production branch is `master`. The signed-in production team is on Hobby.
  Existing draft [PR 2019](https://github.com/WangPantopus/skinny-pantopus/pull/2019)
  prepares the web cutover and is green for its recorded checks. Do not duplicate
  it or merge it before its production API prerequisite and browser checks.
  On October 17, after P6,
  [PR 2413](https://github.com/WangPantopus/skinny-pantopus/pull/2413)
  carried its changes onto master in its place (P9).
- [x] Verified `pantopus-production` is healthy in Oregon, in a Free
  organization, with **No backups** shown. Storage lists only
  `home-documents` at 25 MB. The saved Auth Site URL and all four redirect URLs
  match P3. Custom SMTP is enabled at `smtp.postmarkapp.com`, port 587, and
  email confirmation is on. Auth limits match S3: sign-ups/sign-ins 300,
  refreshes 1500 and verifications 300 per five minutes. Both **Apple and
  Google Auth providers are disabled**. This pass did not replay migrations, export users or verify
  SMTP delivery, OAuth sign-in, Storage policies or the server's private env file.
- [x] Verified Apple's native App IDs already exist. The main app has
  Sign In with Apple, Push Notifications, Associated Domains and App Groups
  enabled. Both the app and widget have `group.app.pantopus.ios` assigned.
  App Store Connect already has **Pantopus Home**, bundle `app.pantopus.ios`,
  version 1.0 **Prepare for Submission**; TestFlight has **No Builds**.
  Do not create duplicate App IDs, an App Group or an iOS listing.
- [x] Verified Google Cloud project `pantopus-prod` already has Address
  Validation, Places API (New), Maps SDK for Android and the Google Play
  Android Developer API enabled. Its existing Web OAuth client allows the
  staging and April Supabase callbacks, **but not the new production callback**.
  Existing API keys were listed by name only; their values were not revealed.
  Play Console's selected developer account lists only the April
  `com.pantopus.app`; the new native Android listing is still needed.
- [x] Verified both `pantopus.app` and `www.pantopus.app` still fail DNS
  resolution. The repository's iOS association is already current for
  team `6UYZBA546R` (`tools/gen-association-files.mjs --check` passes).
  Native Android association generation still needs the actual signing
  certificate fingerprints; do not insert a debug or invented certificate.
- [x] Verified all 14 production EventBridge rules remain disabled. Only
  staging has the two Pacific-time EventBridge Scheduler reminders and the
  six job-failure alarms; all six alarms are OK. The production Lambda stack
  was last updated in May and its seeder secret last changed in April.
  Secret metadata does not verify secret contents. All **29** Pantopus Lambda
  log groups still have no retention policy. No raw logs or device tokens
  were retrieved.
- [x] Ran the existing migration policy check (passes; it does not replay a
  database) and parsed both native iOS privacy manifests successfully.
  Confirmed release source uses the production API and APNs environment;
  Android targets API 36 and removes broad media-read permissions. Store text,
  screenshots and privacy-answer drafts already exist in the paths below.
  These source checks do not establish a signed release or physical delivery.
- [x] Opened the staging deletion page in Chrome: it renders the deletion
  instructions. The production URL still serves the old app shell, so the
  production deletion-page gate stays open until P9.

### What needs the founder, in dependency order

1. **Finish the production backend prerequisites (P1–P6).** Review the server
   address/nginx, current migration dry run, production `.env.prod`, provider
   deferral and GitHub production values before enabling the release gate.
   Only then set `BACKEND_DEPLOY_ENABLED=true` and run the first release.
   Wait for the database and backend jobs to actually run and health to become
   healthy. A green skipped workflow is insufficient. Keep April schedules
   paused. No server-private settings were validated in this pass.
2. **Resolve production Auth and storage (P2A/P3).** Add
   `https://falmvysvndmwtfxsrxek.supabase.co/auth/v1/callback` to the existing
   Google Web OAuth client's allowed redirect URIs, retaining the two current
   callbacks. Configure and enable the production Google and Apple providers;
   verify Postmark delivery, password rules and rate limits, then perform
   sign-in with founder accounts.
   Choose when to upgrade Supabase for managed backups and the two 100 MB
   buckets. The recorded Free-plan deferral remains in force. April Auth
   transfer was pending at this October 13 check. **October 24 update:** the
   approved 35-account transfer and isolated rehearsal are complete; four
   overlaps were skipped and current accounts preserved. Real imported-account
   sign-in checks remain open in [its runbook](production-auth-transfer.md).
3. **Supply provider credentials (Appendix A and P7).** Enter keys privately
   in the designated backend/GitHub/AWS destinations. Review Census, AirNow,
   Anthropic, Mapbox, SMTP and Stripe test configuration and webhooks. Google
   API enablement alone does not configure the backend. Lob/Smarty/address
   setup stays deferred until ready; enable live postcards only with the real
   return address and live webhook settings. Do not paste any secret into chat.
4. **Release the web and link domains (P9/P10).** The API has been healthy
   since October 17 (P6). Verify the Vercel production variables and billing
   choice, then merge
   [PR 2413](https://github.com/WangPantopus/skinny-pantopus/pull/2413)
   (PR 2019's changes on current master): the merge deploys `pantopus.com`.
   Configure DNS and Vercel for both `.app` hosts without redirects. After
   signing is ready, L4 can regenerate Android associations and re-run the
   hosted checks.
5. **Finish store signing (section 4).** iOS identifiers, capabilities, App
   Group and listing are already done. Still configure App Store Connect API
   access, the private match repo/password, App Store profiles for both targets
   and the eight listed `ios-release` secrets. Create the native Android Play
   listing, set up Play App Signing/upload key and release service-account
   access, configure release Firebase and the ten listed `android-release`
   secrets, and set `PANTOPUS_ALLOW_TEST_PAYMENTS=true` while D4 applies.
   Supply an approved Maps SDK key and actual signing fingerprints. The
   founder initiates the beta uploads and approves privacy/review-account
   entries; nothing has been submitted by this pass.
6. **Replace the April jobs (P8), then verify delivery.** Populate the reviewed
   production seeder secret privately and deploy the current stack before
   re-enabling schedules. Configure/confirm the alarm email subscription.
   Have the founder's iPhone and physical Android phone receive scheduled
   reminders and check tap-through. Complete S10 and the production journey,
   including persistence and the household's second-person view. These cannot
   be completed by anonymous checks or without signed-in test accounts/devices.
7. **Finish operational gates (section 5).** Founder sets the 30-day Lambda
   log policy using the existing command below (it expires older logs),
   configures the uptime alert recipient and completes the private production
   database-plus-files backup. Confirm rollback readiness; retire the old site
   and April apps only at the documented transition point. Pilot recruitment
   and real-user invitations remain founder actions.

The logged-in sessions made inspection possible; AGENTS.md still reserves
hosted writes, credentials, spending, real-person sends and store submissions
to the founder. No unchecked hosted or physical-device gate is claimed complete.

## 0. What's running today

| Piece | State on October 7, 2026 (19:15Z) |
|---|---|
| Website `pantopus.com` | Up, on Vercel. The deployment is about four months old (June). Its JavaScript calls `https://api.pantopus.com`, which since October 17 is the new production API (P6). On October 10 the Vercel project `pantopus-web` was connected to this repository with root `frontend/apps/web`, `pnpm install --frozen-lockfile`, `pnpm --filter @pantopus/web build`, Node 22 and production branch `master`, with `pantopus.com` and `www.pantopus.com` on Production. Nothing has deployed from `master` yet (P9). |
| Production API `api.pantopus.com` | Checked October 14 at 17:00 Pacific (L4): the name resolves straight to the server (DNS only, the same address as `staging-api.pantopus.com`) and serves a Let's Encrypt certificate issued October 9. Since October 17 at 00:24 UTC it runs the production API and worker from master `91018743a` (P6, [run 38985891255](https://github.com/WangPantopus/skinny-pantopus/actions/runs/38985891255)); `/health` answers healthy with the database connected. |
| Staging | `https://staging-api.pantopus.com` runs the API and worker; `https://staging.pantopus.com` is the Vercel project `pantopus-staging`, with production branch `dev`. Both services released `dev 132e45a5f` on October 10: the API and worker deployment completed at 10:24 UTC ([run 38044657594](https://github.com/WangPantopus/skinny-pantopus/actions/runs/38044657594)); Vercel released the web at 09:52 UTC (deployment 6979118646). The backend database and deployment steps ran successfully, rather than skipping. Checked October 11 at 17:36 Pacific: API healthy, hosted checks 9/10 (Android app links await P10). The October 10 Lambda check found no observed errors in active/daily staging jobs and six alarms OK. S10 below distinguishes completed checks from the remaining web and physical-Android checks. |
| `pantopus.app` | The zone is on Cloudflare with no records, so `pantopus.app`, `api.pantopus.app` and `staging.api.pantopus.app` don't resolve. |
| April store apps | App Store "Pantopus" (`com.pantopus.app`, version 1.5.0 from May 12) and Google Play `com.pantopus.app`: the Expo app from the older repository. The live website links to both. Their API host was set in Expo's build settings (the old guides used `https://api.pantopus.com`); it can't be read from here. |
| New native apps | iOS `app.pantopus.ios`, Android `app.pantopus.android`: different app IDs from the April apps, so they're new store listings (decision D2). Not uploaded anywhere yet. |
| Supabase | The April production project and new `pantopus-production` project (`falmvysvndmwtfxsrxek`) are in the founder's `Pantopus` Free organization. The new project is healthy in Oregon; all 148 canonical migrations were applied and verified on October 9, the first production release applied the 36 newer ones on October 17 (184 in all), and the private `home-documents` bucket is configured. Auth transfer, the two 100 MB buckets, the S3 key and managed daily backups are pending. `Pantopus-staging` is separate and was reset to the canonical migrations on October 7 (S2). A separate production organization is optional billing isolation. |
| GitHub | `staging` releases from `dev` after CI. `production` has nine secrets, `DB_MIGRATIONS_ENABLED=true`, and, since October 17 at 00:20 UTC, `BACKEND_DEPLOY_ENABLED=true`: every master merge that changes the backend releases to production after CI, migrations first. Store signing setup remains separate (section 4). |
| AWS Lambdas | Staging stack `pantopus-seeder-staging` carries the seeder, briefing, home-reminder, weather-alert, mail and job-trigger functions. The founder paused the April `pantopus-seeder-production` stack: all 14 EventBridge rules were independently confirmed `DISABLED` on October 11, and its briefing log has no event after October 8 at 19:14 UTC. P8 then replaced its code and secret (paused, October 17) and turned on only the briefing rule and its daily cleanup (October 18), followed by the approved local seeder, Home/weather and maintenance groups on October 21 (P8). The April `pantopus-seeder-dev` functions were deleted; its ten schedules have nothing to run. |

**Reminders run on AWS Lambda.** Morning and evening briefings (the night-before
pickup push rides the evening one), task and bill reminders, weather alerts and
mail notices are sent by the Lambdas, which call the backend's internal API.
The pilot can't start until the Lambda stack runs against the hosted backend
(steps S8 and P8).

## 1. Decisions (founder)

Each has a default that the steps below follow until you change it here.

- [x] **D1 API hosts.** Decided October 6, as recommended. Default: production `https://api.pantopus.com`, staging
  `https://staging-api.pantopus.com`, for the website and both apps. Both names
  already exist in your Cloudflare zone, staging already has a certificate, and
  the website calls `api.pantopus.com` today. (The native apps defaulted to
  `api.pantopus.app`, which has no DNS; L4 switches them.) Also point
  `pantopus.app` and `www.pantopus.app` at the website (step P10): the apps share
  `https://pantopus.app` links.
- [x] **D2 Store listings.** **Replaced October 23 by the founder:** update the existing **Pantopus** listings, using `com.pantopus.app` on both platforms. iOS App Store ID `6760512315`; Google Play app ID `4974977490173375457`. Prepare **2.0.4** as the next update. Do not rename the original app, take it off sale, or publish the separate Pantopus Home records (`6821263216` / `app.pantopus.ios`, and `app.pantopus.android`). Earlier October 6–22 new-listing instructions and build evidence below are historical.
- [x] **D3 Production database.** Decided October 8: create a new production
  Supabase project from the canonical migrations and transfer April users'
  logins and matching app profiles after an isolated rehearsal. Preserve the
  Auth identities needed for email, Google and Apple sign-in; leave April's
  Homes, Trains and other product data in the old project. The founder runs
  the reviewed production import or explicitly delegates its scope. **October 24:** the founder authorized importing 35 non-overlapping accounts as ordinary users and preserving current accounts. That transfer is complete; four legacy overlaps were skipped. Product content starts fresh. Complete imported-account sign-in checks before releasing 2.0.4. See [the Auth transfer runbook](production-auth-transfer.md).
- [x] **D4 Payments during the pilot.** Decided October 6, as recommended. Default: production uses Stripe **test**
  keys until you activate live payments; no pilot journey takes money. Pilot
  store builds then carry the matching `pk_test_` key (L4 adjusts the Android
  release guard, which demands `pk_live_`). A real card fails in test mode
  instead of being charged. **October 22:** the founder chose Crew Day, paid through business invoices, as the
  first money feature (NEXT_STEPS section 0); [P11](#p11-live-payments-for-crew-day-founder) turns on live payments for it.
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
  deploy, and `master` from P9. The Hobby plan allows 100 deployments in any
  24 hours, and a preview of every pull-request push and every merge to
  `master` (over 100 merges on October 8 alone) used them up, so the `dev` push
  that releases staging could not deploy. CI builds the production web app for
  every web change instead (the "Production build" step). Both Vercel projects
  read this file: `pantopus-web` already builds each `dev` push as a preview,
  and from P9 this project also builds each `master` push as one.

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
   `ANTHROPIC_API_KEY`, `AIRNOW_API_KEY` (air-quality alerts; the backend's
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

The home-reminder job checks every 15 minutes, all day. Task reminders become
eligible at 07:00 in each recipient's resolved local time zone; bills also have
an 18:00 local window. Briefings check every minute for the person's saved
morning/evening time (defaults 07:30 and 18:00). Both use IANA time zones,
including Alaska, the Aleutians, Hawaii and Arizona's daylight-saving exceptions.
The selected home/place supplies the zone; a valid saved device zone is the
fallback when no location is available. An unknown zone is skipped, never
silently assigned Pacific time. Failed briefings retry only during the same
15-minute local slot; daily housekeeping never sends a catch-up briefing.

**Check:** CloudWatch logs for `pantopus-briefing-scheduler-staging` show runs
every minute with no errors; `select job_name, last_success, last_failure
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
reminder, and the invitation after the identity decision. Both the web and backend
now run the October 10 `dev 132e45a5f` release. Deployment and public health checks
do not complete the signed-in journey. After the remaining release fixes merge,
the next `dev` push must finish CI and the actual Deploy Backend deployment steps.

## 3. Production

Same shape as staging, with live vendors where D4 and D5 say so.

### Before P1: keep the April Lambda stack paused (founder completed)

**Verified October 11:** all 14 rules are disabled; the six staging alarms are OK.
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

**Checked October 14 at 17:00 Pacific (L4):** the certificate is valid (Let's Encrypt, issued
October 9) and nginx answers 502 until P6 starts the backend, so this step looks
done.

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
   before release. **October 24:** the API already serves this project; its
   endpoints were unchanged. The explicitly authorized 35-account import is
   complete, with all current accounts preserved and four overlaps skipped.
   Real imported-account sign-in checks remain open.
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

**Status, October 17:** done. At the founder's direction `BACKEND_DEPLOY_ENABLED`
went to `true` at 00:20 UTC and the first release ran from master `91018743a`
([run 38985891255](https://github.com/WangPantopus/skinny-pantopus/actions/runs/38985891255)).
Its dry run listed the 36 migrations newer than the October 9 baseline
(`20261009085129` to `20261016060442`) and all 36 applied before the rollout;
the candidate, API and worker passed readiness. At 00:24 UTC `/health` answered
healthy with the database connected, and `check-hosted.cjs --production` passes
7/10 (the June web's headers and iOS association wait for P9, Android app links
for P10). The containers were not inspected on the host.

### P7. Stripe and Lob webhooks (founder)

- Stripe (test mode per D4, live later): endpoint
  `https://api.pantopus.com/api/webhooks/stripe`, events as listed in
  `backend/stripe/stripeWebhooks.js`; put its signing secret in
  `STRIPE_WEBHOOK_SECRET`.
- Lob (live, when mail is enabled): webhook
  `https://api.pantopus.com/api/v1/webhooks/lob`; its secret in
  `LOB_WEBHOOK_SECRET`.

### P8. Production scheduled jobs (approved launch groups active October 21)

**Current state, verified October 21:** `SchedulesEnabled=false`, with
`BriefingsEnabled`, `SeederEnabled`, `HomeRemindersEnabled`, `AlertsEnabled` and
`MaintenanceJobsEnabled` true; `PaymentJobsEnabled=false`. There are **13 enabled
and 11 disabled schedules**. Briefing, Home reminder and local poster functions
each reserve one invocation. Sports, Mail and no-bid schedules remain disabled.
The founder explicitly approved curator setup, normal metered local seeding,
Home/weather/maintenance activation and production alarm routing. Useful-update-only
briefings remain the chosen behavior.

The existing setup script created the labeled **Pantopus Local** curator, two
initial regions (Clark County, WA and Portland Metro), and 10 active critical/core
sources. All 55 enrichment sources, including sports, are inactive. Curator login
was verified and credentials saved in the production secret without changing its
other fields. The registered iPhone's location is within the configured coverage.
A bootstrap publisher run created two real posts with zero failures; both appeared
in the production web Pulse and the founder confirmed seeing a new post on the
physical iPhone. A subsequent fetch completed with zero errors.
The first manual fetch overlapped the newly enabled schedule and encountered
unique-key deduplication conflicts; no duplicate queue rows were inserted.

All six maintenance jobs completed through the deployed Lambda/backend path.
Home and weather checks completed without failures, with no eligible reminders
or alerts to send. Daily discovery completed with no new clusters. CloudFormation
reported `UPDATE_COMPLETE`; the activation preserved all 12 function packages.
The subsequent launch-reliability update replaced the shared package with the
reviewed monitoring/lookup fixes; all 12 functions remain Active. The production
SNS email subscription is confirmed, all 17 alarms route to it, and the earlier
one-time routing test arrived in the inbox.
The worker's Lambda cron fallback remains off to prevent duplicate scheduling.
Before host maintenance, all 17 alarms reached OK. The normal 17:00 local seeder run
published two additional posts with zero failures; the ongoing briefing and
Home schedules also completed without reported failures.

Production FCM OAuth and a validation-only message request passed (HTTP 200),
and the privately saved Android release Firebase configuration matches the
server project. No Android registration exists yet, so this does not prove
Android receipt.

The founder confirmed physical iPhone receipt of the authorized generic push test
and that tapping opened Today. **Scheduled useful briefing/Home-reminder receipt
on physical iPhone and Android remains unverified.** Quiet-day suppression is
intentional; a successful generic push does not prove briefing composition,
idempotency or the briefing-specific destination. P8's physical checks remain open.

**Launch reliability follow-up:** local fetcher, poster and discovery now report
caught and partial failures through a bounded CloudWatch metric. Weather checks
also report per-location and push failures. Housekeeping and Home-member lookup
failures propagate to their existing error alarms. Quiet/no-recipient runs are successful;
publishing failures keep their existing retry behavior to avoid extra posts.
The production update completed October 21. Existing seeder tests (505), SAM
lint and the 128 activation combinations passed. Live fetcher, poster, discovery
and weather checks completed without errors. Error alarms combine application
outcomes with Lambda crashes/timeouts. Eight
missing-invocation alarms cover the enabled functions, including daily housekeeping;
their actions follow the schedule switches so intentional pauses stay silent.
The jobs alarm covers the shared trigger; inspect each maintenance rule separately
when changing schedules. Failure alarms use the existing confirmed production inbox.

The April stack `pantopus-seeder-production` already exists, so
`sam deploy --config-env prod` updates it in place: new code, the job trigger,
the failure alarms and recipient-local reminder schedules. The stack never
writes secret contents, so the secret `pantopus/seeder/production` keeps its
previous values until they are replaced separately.
The checked-in production deploy configuration matches the live stack:
the approved launch groups above on, payment and launch-cut jobs paused. A plain
`sam deploy --config-env prod` keeps that state; changing activation is an
explicit parameter change, recorded here and in `samconfig.toml` together.

**Independent activation controls (deployed October 21):** keep
`SchedulesEnabled=false` and enable only the groups the founder has reviewed.
All new controls default to false, preserving existing deployments. The older
`SchedulesEnabled=true` remains an all-jobs override, including sports, Mail and
no-bid nudges; it is not the launch activation command.

| Parameter | Schedules enabled | Before activation |
| --- | --- | --- |
| `BriefingsEnabled` | Briefing scheduler and cleanup (2) | Production API/database and internal-key authentication; preferences, location and native push registration |
| `SeederEnabled` | Local fetcher, poster and region discovery (3) | Production curator account and credentials, region/source rows, reviewed source coverage and paid-composition approval; national sports stays paused |
| `HomeRemindersEnabled` | Recipient-local Home reminders (1) | Due-day task/bill/calendar checks and physical-phone receipt |
| `AlertsEnabled` | Weather/AQI checks (1) | Location coverage, preferences and working weather/AQI providers |
| `MaintenanceJobsEnabled` | Post expiry, Ask reminders, chat redaction, ghost-business cleanup, response statistics and trust checks (6) | Review the existing jobs' effects and verify the worker is not also running them |
| `PaymentJobsEnabled` | Authorization, transfers, capture retry, authorization expiry and stuck-payment checks (5) | Verify actual Stripe mode and review pending work before allowing financial side effects |

The initial October 21 read-only check found all 11 generic job-trigger schedules
disabled and `LAMBDA_BACKED_CRON_ENABLED=false` on the production worker. Those
jobs had no scheduler; healthy API/worker containers did not establish that
these jobs ran. Leave the worker fallback off when activating their Lambda
schedules, so each job has one scheduler.

The initial check found no production curator credentials or region/source/queue
rows. Use the existing `pantopus-seeder/scripts/setup_curator_account.py` after
reviewing its dry run, rather than reusing the April account or adding tables.
Keep its output private. Check the resulting curator login and regional feed
before enabling the poster. Existing location-driven region provisioning and
daily discovery extend coverage after the curator exists; default setup regions
alone are not nationwide coverage proof.

Subscribe and confirm an operator inbox on the **production** SNS topic before
activation. Initially the subscription belonged only to staging; the production subscription
is now confirmed. An `OK`
Lambda error alarm does not detect a disabled schedule or prove content/push
delivery. Check invocation counts and application outcomes as well.

Paused jobs do not reserve Lambda concurrency. Before activation, check
`aws lambda get-account-settings --region us-west-2`: the account must have
capacity for one reserved briefing invocation (and one each for home reminders
and the content poster when all jobs are enabled), above AWS's required
unreserved floor. The October
17 account limit was only 10, with all 10 required to remain unreserved; AWS
rejected reserving even one invocation. A quota increase is required before
activation. Keep the single-run safeguards; do not remove them to bypass the
quota. The founder authorized an AWS quota/support request for this rollout.

**Initial read-only check, October 17, before rollout:** all 14 existing production rules were
disabled. The briefing Lambda was last deployed May 3; its last log event was
October 8 at 12:14 Pacific. Its secret still points to the April database and
its internal API key differs from the prepared current-production key. The
current-production key passed an empty `/api/internal/briefing/timezones`
lookup against the live API (no users processed). Aggregate reads of the new
production database found zero notification-preference rows and zero briefing
deliveries. No hosted configuration or user preferences were changed during
that initial check.

**Paused rollout, October 17, with founder authorization:** the production
secret now contains the verified current database/API credentials. The SAM
stack completed its update; all 23 EventBridge rules and the one local-reminder
Scheduler schedule are disabled. The deployed briefing package matches the
committed handlers. A live scheduler invocation against the current database
completed with zero eligible recipients, zero sends and zero failures. This
checks the deployed runtime and database connection, not physical push delivery.
The database still has no notification-preference rows. A private rollback copy
of the prior secret was retained outside Git.

AWS opened a support case for the founder-authorized Lambda quota request;
approval is pending and the account limit remains 10. Keep all schedules paused
until capacity permits the briefing's reserved concurrency. The processed AWS
template was checked for all three modes: paused enables zero schedules and
reserves zero invocations; briefing-only enables the two briefing rules and
reserves one; full activation enables 24 schedules and reserves three. Use
conditional `State`, not conditional `Enabled`, so the SAM transform preserves
the pause conditions. Actual scheduled delivery on iPhone and Android is still
unverified, and P8 remains incomplete.

**Briefing-only activation, October 18, with explicit founder authorization:**
AWS raised the account's Lambda concurrency quota to 1,000, which resolved the
quota blocker above. At 06:17 UTC a reviewed parameter-only change set reused
the deployed template and changed exactly three properties: it enabled the
every-minute briefing rule and the daily briefing cleanup and reserved one
concurrent briefing scheduler invocation. CloudFormation reported
UPDATE_COMPLETE at 06:18 UTC. The 12 deployed Lambda packages were unchanged,
every function was Active and the six error alarms were OK. The first two
scheduled runs completed with zero eligible, sent, skipped or failed
deliveries and no logged errors or timeouts. That shows scheduling is live; it
does not show receipt on a phone.

In this order:

1. Make sure the April schedules are paused (start of section 3). While they
   run, a new secret would let April's code act on the new production.
2. Replace the secret's value as in S8 step 2, with the production values: the
   production project's `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`,
   `PANTOPUS_API_BASE_URL=https://api.pantopus.com`, the production
   `INTERNAL_API_KEY` (in `hosted-secrets/production.env`), a production
   curator account, `ANTHROPIC_API_KEY`, `AIRNOW_API_KEY` and optional WeatherKit keys.
   A private candidate was prepared on the Mac at
   `~/.config/pantopus/hosted-secrets/seeder-production-prepared-2026-10-17.json`
   (mode 600), using `production-server-candidate.env`. Its database credential
   passed read-only checks against the new production, and its internal API key
   passed the live API check above. Revalidate if production credentials change.
   That historical candidate has blank curator fields and must not overwrite the
   current secret: the production curator was created on October 21. Verify
   the current curator login before enabling content publishing. Briefings need only the database URL/key,
   API URL and internal API key; they can be enabled independently below.
   ```bash
   aws secretsmanager put-secret-value --region us-west-2 \
     --secret-id pantopus/seeder/production --secret-string file://<private json file>
   ```
3. Build and deploy as in S8 step 1, using `sam build --use-container --config-env prod`
   and `sam deploy --config-env prod --parameter-overrides Environment=production
   SchedulesEnabled=false BriefingsEnabled=false` (done October 17). This deploy
   kept every schedule paused, including the new
   `pantopus-home-reminders-local-production` Scheduler resource. Review the
   change set before executing it. Verify the deployed code date, secret target
   and internal-key authentication while still paused.
4. Activate **only morning/evening briefings and their housekeeping** first
   (done October 18; superseded by the approved October 21 group settings):
   ```bash
   sam deploy --config-env prod \
     --parameter-overrides Environment=production SchedulesEnabled=false BriefingsEnabled=true
   ```
   In the founder's app, enable the desired briefing in notification settings,
   choose its local time and allow OS notifications. A preference row and a
   registered push token must exist; neither is created by deploying Lambda.
   Wait for the actual scheduled delivery on iPhone and Android. Quiet hours,
   opt-out and a low-signal day intentionally suppress delivery; inspect only
   aggregate status/skip reasons, never paste raw user or device-token rows.
5. After reviewing each group's prerequisites above, prepare the exact desired
   parameter values in `samconfig.toml`, retaining `SchedulesEnabled=false`.
   Review the CloudFormation change set before executing it. For example,
   enabling **only Home reminders in addition to the existing briefings** is:
   ```bash
   sam deploy --config-env prod \
     --parameter-overrides Environment=production SchedulesEnabled=false \
       BriefingsEnabled=true SeederEnabled=false HomeRemindersEnabled=true \
       AlertsEnabled=false MaintenanceJobsEnabled=false PaymentJobsEnabled=false
   ```
   This example is not production activation approval. Change only the approved
   groups, and explicitly include every switch so a retained parameter cannot
   keep an unintended group running. To pause everything, set `SchedulesEnabled`
   and **all six group switches** to false. To roll back a single group, set its
   switch false while preserving the other reviewed values.
   Whenever activation changes, update `parameter_overrides` in
   `pantopus-seeder/deploy/samconfig.toml` to the same values, so a later plain
   `sam deploy --config-env prod` never silently pauses or enables jobs. Do not
   enable individual rules by hand and leave their state different from the
   template.

**Check:** as S8 with `-production` names. After step 4, only the briefing and
cleanup rules are enabled. After step 5, compare every rule with the approved
groups; sports, Mail and no-bid schedules remain disabled. When Home reminders
are approved, `aws scheduler list-schedules --region us-west-2` must list
`pantopus-home-reminders-local-production` as enabled (every 15 minutes UTC,
with recipient eligibility evaluated in local time). The briefing scheduler runs every minute
against the new production database and delivers at most one successful
morning and one evening brief per recipient's local date. Check summer, winter
and DST transitions, including Alaska, Adak, Hawaii and Arizona; the AWS region
`us-west-2` is the hosting region, not a delivery time zone. P8 stays incomplete
until the hosted and physical-phone checks pass.

### P9. Production web (founder)

Vercel Production environment variables: `NEXT_PUBLIC_API_URL=https://api.pantopus.com`,
`NEXT_PUBLIC_APP_URL=https://pantopus.com`, `NEXT_PUBLIC_APP_ENV=production`,
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (matching D4), `NEXT_PUBLIC_MAPBOX_TOKEN`,
`EDGE_PROXY_SECRET` (the value in `hosted-secrets/production.env`, as in S7).
Leave `NEXT_PUBLIC_LAUNCH_FEATURES` empty, as in S7.
Leave `NEXT_PUBLIC_IOS_APP_STORE_URL`, `NEXT_PUBLIC_IOS_APP_STORE_APP_ID` and
`NEXT_PUBLIC_ANDROID_PLAY_STORE_URL` unset until the new store listings exist;
remove any old values pointing to the April apps from the Vercel project. The
web app no longer falls back to April store links. Regenerate the two landing
page QR images for the new listings before setting
`NEXT_PUBLIC_STORE_QR_CODES_READY=true` to reveal that download block.
Production branch `master`.
[PR 2413](https://github.com/WangPantopus/skinny-pantopus/pull/2413) adds
`"master": true` under `git.deploymentEnabled` in
`frontend/apps/web/vercel.json` (S7); without it `master` never deploys.
Merging it releases the web, and from then on every `master` merge that
changes the web deploys to `pantopus.com`. Keep the Vercel account on Pro from
here, or production and staging deployments share the 100-a-day Hobby limit
(Hobby is also for non-commercial use only). `pantopus-staging` reads the same
file, so it also starts a preview build for each `master` push.

**Status, October 10** (read in Vercel for PR 2019): the Production variables
were `NEXT_PUBLIC_API_URL=https://api.pantopus.com`,
`NEXT_PUBLIC_APP_URL=https://pantopus.com`, `NEXT_PUBLIC_APP_ENV=production`,
`NEXT_PUBLIC_MAPBOX_TOKEN`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` and
`EDGE_PROXY_SECRET`; no store-link variables were set. The Stripe key was a
`pk_live_` key while D4 says test keys: it must be in the same mode as the
backend's `STRIPE_SECRET_KEY`, or card entry fails. `EDGE_PROXY_SECRET` can't
be read back, so the Settings → Security check below confirms it. The account
was on Hobby, and "Skip deployments when there are no changes to the root
directory or its dependencies" was turned on that day. `NEXT_PUBLIC_API_URL`
is read when the web is built (the `/api` and `/socket.io` rewrites in
`next.config.js`; without it a build forwards to `http://localhost:8000`), so a
changed variable needs a new deployment. To undo a release, Vercel's Instant
Rollback returns `pantopus.com` to the previous deployment.

**Check:** `https://pantopus.com` shows the new home page (tab title "Pantopus -
Know what matters for your home"; June's is "Pantopus - Your real-world
network") with no App Store or Google Play badges; email, Google and Apple
sign-in land on `/app/place` without the June callback page's brief "Sign-in
failed / No authorization code received" card;
`https://pantopus.com/.well-known/apple-app-site-association` returns JSON;
the web's Settings → Security page (`/app/settings/security`) shows this
browser's last address as your own network's, not a Vercel or Amazon one (if it
doesn't, `EDGE_PROXY_SECRET` differs between Vercel and the server).

### P10. Domains and app links (founder, L4 regenerates the files)

- Vercel: add `pantopus.app` and `www.pantopus.app` to the same project without
  a redirect, so `/.well-known` files load there too (Cloudflare records DNS only).
- L4 regenerates the association files once the signing certificates exist:
  `APPLE_TEAM_ID=<team> ANDROID_SHA256_FINGERPRINTS=<Play signing>,<upload> node tools/gen-association-files.mjs`.

**Check:** Apple's and Google's link checkers accept both domains, and
`node scripts/staging/check-hosted.cjs https://pantopus.com https://api.pantopus.com --production`
passes every line (health, HTTPS, security headers, the web's API and realtime forwarding, both
app-link files, robots.txt).

### P11. Live payments for Crew Day (founder)

Decided October 22 (NEXT_STEPS section 0): Crew Day street days are paid through business invoices, so production takes
real cards for them. A crew invoices each household from its Pantopus business page; the household pays by card; 48
hours later the payment jobs move the crew's share to the crew's Stripe account, minus Pantopus's fee (10% for the
first 50 businesses, 15% for home services). This ends D4's test-mode pilot for payments. Do it after the business fee
fix is merged and released (NEXT_STEPS, section 4A). Keys stay in Stripe, `~/pantopus/.env.prod`, Vercel and the
GitHub environments; never in Git or chat.

1. **Stripe account, live.** In the Stripe Dashboard, activate live payments: business details, Pantopus's bank
   account and the identity check. Set the statement descriptor (what card statements show) to PANTOPUS.
2. **Connect, live.** Settings → Connect: complete the platform profile for live mode, keep Express accounts, and set
   the name, icon and color crews see during Stripe onboarding. Pantopus charges the card on its own account and
   transfers the crew's share later ("separate charges and transfers").
3. **Live webhook.** Developers → Webhooks, in live mode: add `https://api.pantopus.com/api/webhooks/stripe` for
   events on your account, with the events `backend/stripe/stripeWebhooks.js` handles:
   ```text
   account.application.authorized account.application.deauthorized account.updated capability.updated
   charge.dispute.closed charge.dispute.created charge.dispute.updated charge.failed charge.refund.updated
   charge.refunded charge.succeeded checkout.session.completed customer.subscription.created
   customer.subscription.deleted customer.subscription.updated customer.updated invoice.paid
   invoice.payment_failed payment_intent.amount_capturable_updated payment_intent.canceled
   payment_intent.payment_failed payment_intent.requires_action payment_intent.succeeded
   payment_method.attached payment_method.detached payout.created payout.failed payout.paid refund.created
   refund.failed refund.updated setup_intent.setup_failed setup_intent.succeeded transfer.created
   transfer.failed transfer.paid transfer.reversed
   ```
   Keep its signing secret for step 4. The server checks one signing secret, and this one endpoint is enough: a
   crew's Stripe onboarding status is read from Stripe again whenever its payout page opens
   (`GET /api/businesses/:businessId/stripe/account`), so no endpoint for connected accounts is needed. Events from
   crews' own Stripe accounts (their bank payouts) don't reach the server; crews see those in their Stripe Express
   dashboard.
4. **Server keys.** In `~/pantopus/.env.prod` on the server: `STRIPE_SECRET_KEY` (the live `sk_live_…`),
   `STRIPE_PUBLISHABLE_KEY` (`pk_live_…`) and `STRIPE_WEBHOOK_SECRET` (step 3's `whsec_…`). Keep the test values
   somewhere outside Git for a rollback. Then re-run the latest production deployment (or restart the API and worker
   containers) so they read the new values. Staging keeps its test keys; it refuses live ones.
5. **Web key.** Vercel production: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` must be this account's `pk_live_…`. On
   October 10 it already held a `pk_live_` key while the server used test keys, so card entry on the web fails until
   both match. Confirm it is this account's live key, then redeploy the web, since the key is built in.
6. **Payment jobs.** Turn on `PaymentJobsEnabled` the P8 way, changing only that switch from the October 21 state:
   ```bash
   sam deploy --config-env prod \
     --parameter-overrides Environment=production SchedulesEnabled=false \
       BriefingsEnabled=true SeederEnabled=true HomeRemindersEnabled=true \
       AlertsEnabled=true MaintenanceJobsEnabled=true PaymentJobsEnabled=true
   ```
   Review the change set before executing it, and update `parameter_overrides` in `samconfig.toml` afterwards.
   Without these jobs no crew is ever paid.
7. **A real $1 check.** With your own accounts: create a home-service business, finish its Stripe onboarding with
   your real details, invoice your own member account $1, pay it with your own card on pantopus.com, and check the
   charge in Stripe. After 48 hours, check the transfer to the business's Stripe account ($1 minus the fee) and its
   payout to the bank. Refund the $1 afterwards if you like.
8. **Apps.** The current store builds carry the test key, so their card form fails against live keys: until new
   builds ship, households pay on pantopus.com. For the next builds, put the `pk_live_…` key in the `ios-release`
   and `android-release` secrets `STRIPE_PUBLISHABLE_KEY`, and delete the `PANTOPUS_ALLOW_TEST_PAYMENTS` variable
   (section 4).
9. **Rollback.** Put the test keys back in `.env.prod` and Vercel, redeploy both, and set `PaymentJobsEnabled=false`
   the same way. Payments already taken stay in Stripe; refund them there if needed.

After each street day, check the Dashboard for the day's charges, transfers and any dispute. Stripe emails you when a
dispute opens.

## 4. Store builds

### Current direction — October 23: update the original Pantopus apps

This section supersedes the historical signing/upload instructions below. Both stores still serve 1.5.0. The next intended version is **2.0.4**; do not trigger a beta upload until its signing and service configuration are correct.

| Setting | Required value |
|---|---|
| iOS record / main bundle | `6760512315` / `com.pantopus.app` |
| iOS widget bundle | `com.pantopus.app.widgets` |
| iOS signing team | `6UYZBA546R` (same as published 1.5.0) |
| App Group | Reuse `group.app.pantopus.ios`; both original app and renamed widget need membership and matching profiles |
| Android record / application ID | `4974977490173375457` / `com.pantopus.app` |
| Android Kotlin namespace | Keep `app.pantopus.android`; this is source packaging, not the store identity |
| Android debug application ID | `com.pantopus.app.debug` |
| Store title | `Pantopus` |

- [x] Read the original records: iOS 1.5.0 (84), iPhone family, team `6UYZBA546R`; Android original production listing exists. The old Android Play-signing SHA-256 matches the repository's `com.pantopus.app` association.
- [x] Created the original iOS record's **2.0.4 / Prepare for Submission** draft, with current description, subtitle, keywords, promotional text, update notes, support/marketing links and reviewer instructions. Manual release is selected. Updated age-rating answers (13+ in most regions) and content-rights information to the current app's answers. No build is selected or submitted.
- [x] Saved the original Play listing's current title, descriptions, icon, feature graphic and four phone screenshots as a draft. Removed obsolete tablet screenshot references; no new tablet screenshots are claimed. No changes were sent for review.
- [x] Replaced repository store screenshots with actual October 23 native captures of welcome, Place, Today and household tasks. iPhone images are 1320×2868 (large Dynamic Island display); Android images are 1080×2400. Synthetic test household only. Apple's four images are saved in the large-display slot and inherited by smaller sizes; obsolete 1.5.0 screenshot references were removed from the editable version.
- [x] Saved an additive Play Data safety draft: optional health/audio collection, device-ID functionality/security purposes, contact account-management purposes, and the current account-deletion URL. Kept existing legacy declarations pending a review covering every distributed version. See the compliance document's transition note; this is not final compliance approval.
- [x] Local checks: iOS simulator build and Android debug assembly passed under the restored identities; Android ktlint/detekt, both Ruby Fastfile syntax checks, existing native-config tests (6), and association-file tests (5) passed. Both apps signed into a real local backend/database and displayed the same synthetic home/tasks. Created tasks persisted across iOS relaunch and were visible on Android; Android sign-in persisted after force-stop/relaunch. Initial native evidence used base `fc3223d3f`; these checks do not prove release signing, old-account transfer or a physical upgrade.
- [x] With the founder's explicit October 23 authorization, enabled App Groups on `com.pantopus.app`, registered `com.pantopus.app.widgets`, and assigned both to the existing `group.app.pantopus.ios`. Reopened both App IDs to verify membership. Generated active `match AppStore com.pantopus.app` and `match AppStore com.pantopus.app.widgets` profiles using the existing team distribution certificate; both expire October 16, 2027. Stored the encrypted profiles in the existing private Match repository. Readonly retrieval using CI's existing signing credential, profile entitlement/certificate checks, and private-key signing/signature verification all passed. Existing iOS release secrets, pilot profiles and distribution certificate are unchanged. No release archive/export, upload, submission or physical upgrade was performed.
- [x] Android: recovered the **original app's upload keystore** from the existing Expo/EAS project. Its certificate matches the certificate downloaded from the original Play record: SHA-256 `20:D3:0B:09:8D:06:A4:E1:9D:E1:40:65:EF:70:96:55:EF:4D:F7:91:BB:89:BB:DA:33:48:F7:0B:B1:F3:FB:8B`. The private key successfully signed a local verification JAR, whose signature passed verification. **No upload-key reset is needed**; the unused reset form was discarded.
- [x] With the founder's explicit October 23 authorization, replaced the four `android-release` signing secrets with the recovered original key and its passwords/alias. GitHub accepted all four updates and their modification timestamps were verified. The separate Pantopus Home key remains unchanged locally. No build or upload was triggered.
- [x] Registered `com.pantopus.app` in production Firebase (`pantopus-prod`) and added the original Play app-signing SHA-1 `42:AC:48:11:1A:63:75:95:03:4E:01:0F:5F:F1:DF:DE:F5:8F:6C:6C` and SHA-256 `33:60:AE:F8:09:B6:BF:18:3F:FB:DE:4F:F7:CD:BD:68:0A:F0:2E:5F:84:61:5A:2E:9A:A0:F3:89:EF:73:02:EF`. Both persisted after reload. Downloaded its genuine config, verified project/package/app identity, and updated `android-release/GOOGLE_SERVICES_JSON`. Also registered `com.pantopus.app.debug` in `pantopus-staging` and saved its config privately. Existing pilot Firebase apps remain registered; the checked-in JSON remains a build-only placeholder.
- [x] Granted the existing Play release service account app-scoped read information/quality access and testing-track release access for original Pantopus. Production publishing, admin, financial and store-presence permissions remain off. Reopened the console to verify persistence; the service account successfully read the original tracks, including production **1.5.0 / version code 25**. Discarded the temporary API inspection edit without committing changes. No bundle upload or release occurred.
- [ ] Match Maps/OAuth restrictions to the restored package and verify real sign-in and physical push delivery. Firebase registration, stored fingerprints, API access and secret-update acknowledgements do not establish these runtime checks or a store-signed upgrade.
- [x] October 24, with the founder's explicit authorization: changed only production `APNS_BUNDLE_ID` to `com.pantopus.app` and restarted the API and worker on their unchanged image. Both containers and public API health passed; a private rollback copy of the prior environment is retained. The backend has one global APNs topic, so this no longer delivers to the separate `app.pantopus.ios` pilot builds. A fresh physical push check after this change is still required.
- [x] October 24, with explicit founder authorization: completed D3's transfer of 35 non-overlapping legacy accounts as ordinary users, importing 37 identities and 35 profiles. Skipped the four overlapping legacy records. Fresh comparisons verified all six existing Auth users, six identities and seven profiles unchanged. Destination totals are 41 Auth users, 43 identities and 42 profiles. The Auth Admin API sees all imported users and production API/database health passed. No legacy product content was imported.
- [x] After the October 24 import, the founder reported successful sign-in and profile loading for a migrated account they control. The sign-in method was not specified; this does not record separate password, Google and Apple coverage.
- [ ] Finish any applicable provider-specific sign-in and fresh-content checks not covered by the reported journey. Explain the content reset in the store update notes. New minimum iOS is 17; the old build supported 15.1.
- [x] October 24, founder-reported physical checks on **iOS 2.0.4 (85)** and **Android 2.0.4 (26)**: in-place upgrade from 1.5.0, existing-account sign-in, and receiving/opening a push passed on both phones. This evidence applies to those exact builds and predates the APNs topic correction above; it does not establish transfer coverage for every April account or validate a refreshed build.
- [x] The refreshed source at `7b8ab3c7a3` passed [full CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/40126546394), including Android instrumented tests, Android quality/build checks, iOS simulator tests and database replay/lint. Both CI apps signed into a real local backend/database. A synthetic household task created on iOS persisted after relaunch and appeared on Android. Android completed it and retained sign-in and the completed task after force-stop/relaunch; iOS then displayed that completion after relaunch.
- [ ] Investigate an intermittent iOS 27 simulator relaunch stall: one launch remained on the splash screen for several minutes with sustained main-thread SwiftUI/Observation work. Terminating and reopening recovered the signed-in app and task state. Two additional cold launches reached the signed-in home; the later debugger capture showed an idle main run loop. The cause and release-build/physical-device impact remain unverified; successful launches do not close this gate.
- [ ] Upload refreshed signed builds through an allowed release ref. The branch-triggered [iOS](https://github.com/WangPantopus/skinny-pantopus/actions/runs/40128914101) and [Android](https://github.com/WangPantopus/skinny-pantopus/actions/runs/40128915997) attempts stopped before any build step because the release environments allow only `master` and their platform's release tags. No new signed build was produced, no protection rule was changed, and existing tags remain pinned.
- [x] Before the approved transfer, captured a fresh full private destination backup and checked its live schema. Rehearsed with the actual destination schema and synthetic accounts only: password/provider identity preservation, ordinary-user conversion, unchanged existing rows, collision/drift/repeat rejection and rollback after a forced failure all passed. The local Auth service accepted the confirmed synthetic user's original password and rejected the unconfirmed user. The [Auth transfer runbook](production-auth-transfer.md) records the completed production scope and remaining real-account acceptance; account rows, SQL payloads and operator logs remain private.
- [ ] Complete fresh-install, links, widgets, relaunch and old-local-data checks, and recheck the refreshed release builds on physical phones. The release branch now incorporates master `f561a6f375`, including the native privacy repairs in #2812 and the recent Plans fixes; the earlier build numbers do not contain those changes.
- [x] Signed builds **2.0.4 (85)** and **2.0.4 (26)** reached the original records. October 24: Apple reports build 85 valid and unexpired; its public 2.0.4 version remains Prepare for Submission with manual release and no build selected. Play reports 2.0.4 available to internal testers. Refreshed candidates need new build numbers; existing tags and artifacts remain preserved.
- [x] October 24: the reviewer credentials already saved in App Store Connect successfully signed in through the production API. This verifies API login, not the complete reviewer journey in the native apps.
- [x] October 24: removed the unsupported optional data-only deletion answer from Play's Data safety draft. The required `https://pantopus.com/delete-account` link remains, and the save persisted after reload. No changes were submitted for review.
- [ ] Finish privacy labels/Data safety and the native reviewer journey against production. Apple privacy's final data-type action is **Publish and Continue**, so the form remains unpublished; reconcile the live 1.5.0 collection before the cutover. Play's additive draft still needs the full legacy/current-version review. The App Store icon comes from the new binary; uploading screenshots alone does not replace it.
- [ ] Founder submits and releases after these gates pass. Use manual release on iOS and keep Android listing/release edits unsubmitted while preparing.

Draft-only listing commands (after loading the correct private credentials):

```sh
# frontend/apps/ios; saves metadata/screenshots without a binary or review submission
bundle exec fastlane listing version:2.0.4
# frontend/apps/android; commits listing edits without sending changes for review
bundle exec fastlane listing
```

The `release` lanes submit/promote builds and remain founder actions. The existing store links on the website already point to the correct original records.

**Android key recovery, October 23:** after the initial Mac file search found
no matching keystore, the existing Expo CLI login provided access to the
original project's matching Android build credentials. The original key and
passwords are now stored outside Git in
`~/.config/pantopus/credentials/android/original-pantopus/` (directory mode
700, private files mode 600). `upload-signing.json` references the recovered
`pantopus-upload.jks`; preserve the separate pilot credentials unchanged.
Both the exported certificate and a successful private-key signing check
confirm this is usable, not merely a public certificate copy. No key reset
was needed. Recovery itself made no hosted credential changes; the subsequent
founder-authorized configuration updates are recorded above.

`ANDROID_KEYSTORE_BASE64`, `PANTOPUS_KEYSTORE_PASSWORD`, `PANTOPUS_KEY_ALIAS`
and `PANTOPUS_KEY_PASSWORD` are now set in GitHub's `android-release`
environment from that private material. Play's existing app-signing key is
unchanged. Validate a signed internal-track update after the other release
gates pass; the local verification JAR is not an app upload or upgrade test.

A local `apply-github-signing.py` in the same private directory verifies the
original certificate and previews these four secret names by default. The
founder authorized its `--apply` mode after reviewing the prepared setup; the
dry run and all four secret writes succeeded. It does not configure Firebase
or start a build, upload or release. Firebase's config was updated separately
from the genuine downloaded file, without printing any secret values.

### Historical October 6–22 setup (different app identities)


### iOS (TestFlight, then App Store)

- [x] Already registered (found October 13; see the verification section at the
  top): the App Group `group.app.pantopus.ios`, both App IDs with the
  capabilities below and the App Store Connect record **Pantopus Home**. Don't
  create them again; the rest of the next step is still open.
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
- [ ] L4: Release build points at `https://api.pantopus.com`, has no local URLs
  or development credentials, uses the pilot-approved Stripe mode (D4), and
  meets current App Store rules (privacy manifest, account deletion, Sign in
  with Apple, permission strings). The app is iPhone-only (no
  iPad layouts), so App Store Connect needs iPhone screenshots only.
- [x] Founder: run **iOS Beta (TestFlight)** (tag `ios-v<version>` or manual run).
  October 17: version 2.0.0 (the founder's choice), build 1, from tag `ios-v2.0.0`
  ([run 39004323686](https://github.com/WangPantopus/skinny-pantopus/actions/runs/39004323686)).
  App Store Connect processed it at 05:26 UTC and distributed it to internal
  testers. The first two runs ran out of memory compiling the app as one
  module; Release now compiles file by file (PR 2416).

**Source check, October 11:** the release workflow selects Xcode 26.2, meeting
[Apple’s Xcode 26 / iOS 26 SDK minimum](https://developer.apple.com/news/?id=ueeok6yw).
This does not verify store signing or an uploaded build.

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
- [x] Founder: run **Android Beta (Play Store)**.
  October 17: version 2.0.0, version code 2, from tag `android-v2.0.0`
  ([run 38988562456](https://github.com/WangPantopus/skinny-pantopus/actions/runs/38988562456)),
  uploaded to the internal track as a **draft**: roll it out to testers in
  Play Console.

**Source check, October 11:** `targetSdk=36` meets the
[current Play target requirement](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en);
the manifest removes broad image/video read permissions in favor of the system
photo picker. Signed release and physical-device checks remain open.

**Map acceptance remains open:** the local Android configuration checked on
October 11 has an empty `MAPS_API_KEY`. The founder must supply an approved
[Maps SDK for Android key](https://developers.google.com/maps/documentation/android-sdk/get-api-key)
before the owning stream rebuilds and verifies tiles, pin selection and camera
gestures. Any console, SDK activation or billing change remains founder-owned.
Household pins also need their pending backend coordinate-decoder repair and
native access checks; passing data and offline checks alone does not close this gate.

### Listings (founder approves; L4 drafts)

- [x] Founder approved the listing text, screenshots, privacy answers and the
  account-deletion page on October 7 (decisions A and B are written into the
  privacy scripts). The October 23 D2 amendment changes both store titles to "Pantopus".
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
| `ANTHROPIC_API_KEY` | required for AI features | required for AI features | Anthropic Console workspace with a spend limit. Also goes in the seeder secret (S8): the seeder Lambdas refuse to start without it, so set it before deploying them |
| `ANTHROPIC_CHAT_MODEL`, `ANTHROPIC_DRAFT_MODEL` | unset | unset | default `claude-sonnet-5-5` (Claude Sonnet 5.5). A value that doesn't start with `claude-` is ignored, so a leftover `OPENAI_CHAT_MODEL` / `OPENAI_DRAFT_MODEL` does no harm; remove them and `OPENAI_API_KEY` once the Claude key works |
| `ANTHROPIC_CHAT_EFFORT`, `ANTHROPIC_DRAFT_EFFORT`, `ANTHROPIC_SUPPORT_TRAIN_EFFORT` | unset | unset | how long Claude thinks before it answers (`low` to `max`); defaults `low`, `low`, `medium`. `low` keeps replies fast (the API's own default, `high`, is several times slower); raise one only with a measured quality gain |
| `AI_WARMUP` | unset | unset | on by default in staging and production (`NODE_ENV=production`): one one-token request per response schema at startup and every 20 hours, so the first draft after a quiet day doesn't pay about 3 s of schema compilation (under a cent a round). `off` disables it |
| `PROPERTY_SUGGESTIONS_LLM_MODEL`, `MAGIC_TASK_AI_MODEL` | unset | unset | follow the draft model (`claude-sonnet-5-5`); a value that isn't a Claude model is ignored. Claude Sonnet 5.5 takes no `temperature`, so none is sent (`MAGIC_TASK_AI_TEMPERATURE` no longer exists) |
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
+ $0.25), Google and Mapbox usage beyond their free tiers, and Claude (Anthropic) usage.
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

**October 21 recovery check:** a fresh production database, migration ledger and
Storage backup was saved outside Git on FileVault-encrypted local storage. All
three buckets were inventoried; there were no stored objects and no missing
files. A network-isolated local PostgreSQL restore succeeded, with matching row
counts across 398 tables. The rehearsal aligned managed role names and used an
additional auth/storage/public/pgboss schema export because the local Supabase
bootstrap differs from the hosted service. This is a database recovery rehearsal,
not a hosted-project failover or an app acceptance check. Production/staging host
environment, Nginx and TLS configuration were also backed up privately.

These are point-in-time copies; automatic recurring off-host backups are not
configured by this check. Keep following the weekly and pre-change procedure
above. An EC2 root snapshot does not back up the external Supabase database or
uploaded files.

**October 21 approved host maintenance:** the shared production/staging EC2
instance now boots from an encrypted 8 GiB gp3 root volume under the AWS-managed
EBS key. A snapshot and encrypted copy were prepared while the stateless host
remained online, then the instance was stopped, its root volume exchanged and
the same instance restarted. The original device mapping, disk performance,
Elastic IP, security groups, API/worker image digests and environment
configuration were preserved. Pinned SSH and both HTTPS API readiness checks
passed; all four API/worker containers were healthy. A maintenance job also
completed through the deployed Lambda-to-API path. Readiness probes observed
approximately 2 minutes 7 seconds of interruption, ending at 17:49 PDT.
EC2's system, instance and attached-disk checks subsequently all reported OK.
The briefing scheduler's error alarm detected connection timeouts/502 responses
during the restart; scheduled runs recovered automatically once the API returned.

The original disk and the private source/encrypted snapshots are retained for
rollback pending the founder's retention decision; they incur ongoing storage
charges. Key-only SSH and IMDSv2 remain in force, with the existing broad SSH
ingress unchanged. This maintenance does not establish physical-phone delivery
or automatic recurring backups. Future host stops require their own maintenance
window; a Lambda rollout does not require stopping this host.
