# CI/CD

`CI OK` is the required merge check. It includes backend tests, the production
backend image, web lint/type checks/Jest/**production build**, the Identity
Firewall Playwright test, seeder tests, Android, iOS and infrastructure checks.
Mobile workflows are reusable children of CI, so a mobile failure or cancellation
fails the aggregate. PR path filtering happens at the job level. Pushes to
`master` and `dev` validate every surface. Database replay joins the aggregate
only after the verified baseline is adopted.

## Mobile checks

Android runs lint, JVM tests, Paparazzi verification, a debug build and emulator
tests. The navigation smoke tests cover Place, Today, Nearby and Mail. Place's
route retains `root/home` for compatibility. Snapshot updates require inspecting
the diff; do not increase tolerance to hide a failure.

iOS builds the test bundle once for the runner's architecture, preserves symlinks in a tar artifact, then runs
that same bundle on three iOS 18.5 simulators. Build and test timeouts are
separate, and cancellation preserves diagnostics. Xcode 16.4/iOS 18.5 retain the
existing snapshot contract. TestFlight archives use Xcode 26.2 to meet Apple's
current SDK upload requirement. UI tests are compiled but not executed on hosted
simulators because the existing XCUITest injection issue is still unresolved;
run them locally with `make test`. The pre-existing token-literal backlog is also
not enforced yet. SwiftLint, SwiftFormat and the icon guard are enforced.

## Deployment sequence

1. CI succeeds on the current `master` (production) or `dev` (staging) commit.
2. Deploy Backend verifies the exact commit against the latest CI run and branch
   head. A manual dispatch has the same requirement; PR/fork runs cannot deploy.
3. The environment must explicitly enable deployment and provide all secrets.
4. Build a frozen-lockfile image, push a commit tag, and use its immutable digest
   for the API and worker. No `prod`, `staging`, or `latest` tag is used at runtime.
5. After database adoption, apply validated migrations **before** the application
   rollout. A migration failure stops deployment. Before adoption, migration
   files are frozen and no hosted SQL executes.
6. On EC2, start an unexposed API candidate with background jobs disabled. Its
   `/health` probe must reach Supabase successfully before cutover.
7. Preserve the old containers; replace API and worker together. If startup,
   binding or readiness fails, stop partial replacements and restore the old
   containers. This is a short stop/start deployment, so existing sockets may
   disconnect; it is not a zero-downtime load-balancer rollout.
8. Keep stopped previous containers/images and record the release digest in the
   Actions summary. Never automatically prune the only rollback image.

Deploy and rollback share `backend-production` / `backend-staging` concurrency
groups. A host `flock` also prevents overlapping script invocations. Database
writes occur inside the same workflow lock. Disable deployment in the old
repository before enabling this one: GitHub concurrency is repository-scoped.

## Configure each environment

Create `production` and `staging`. Restrict production to `master`. Staging must
allow `master` (the default-branch context of `workflow_run`) and `dev` (manual
runs). The workflow independently verifies the source branch. Optional required
reviewers can be added if your release policy calls for approval.

Set these **environment** secrets in each environment, using distinct hosts and
database projects where applicable:

| Secret | Value |
|---|---|
| `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` | Image repository credentials |
| `EC2_HOST`, `EC2_USERNAME`, `EC2_SSH_KEY` | SSH host, account and private key |
| `EC2_KNOWN_HOSTS` | Verified OpenSSH known_hosts entry for that host |

Verify host keys through a trusted channel (for example the EC2 console). Do
not blindly accept a key obtained over the same untrusted network connection.
The SSH user needs Docker access, `flock`, and `~/pantopus/.env.prod` or
`~/pantopus/.env.staging`. Configure the API to listen on port 8000. Those env
files carry runtime secrets; they are never copied into an image or Actions
artifact. The deployment overrides `PGBOSS_ENABLED` and `CRON_ENABLED` to false
on the API and true on the worker. `DATABASE_URL` is needed for pg-boss; the
worker retains the application's existing cron fallback if it is unavailable.

Set environment variable `BACKEND_DEPLOY_ENABLED=true` only after configuring
all secrets and the host. Missing secrets then fail clearly; a disabled
environment produces a notice and no release notification.

For the future database activation, see
[supabase-migration-automation-runbook.md](supabase-migration-automation-runbook.md).
Do not point staging migration credentials at the production project.

## Rollback

Run **Rollback Backend** from `master` for production or `dev` for staging.
Supply a previous successful release's `sha256:...` digest from its Actions
summary. The repository name comes from the environment, not from input.
Rollback uses the same candidate/readiness/recovery script and restores both API
and worker. It does not undo database migrations; use backward-compatible
expand/contract schema changes so the previous application remains usable.

If automatic recovery itself fails, the workflow reports a critical error.
Inspect retained `*-previous` containers on the host and recover service before
retrying. A failed first deployment has no prior service to restore.

## Required check and permissions

Protect `master` with required check `CI OK`, strict up-to-date branches, and
admin enforcement. Use the GitHub Actions app as the expected source. Do not
require path-filtered standalone mobile workflows. The workflows themselves use
read-only repository permissions and keep deployment secrets out of PR jobs.

## Mobile releases and notifications

- iOS: `ios-v*` tags or manual dispatch use `ios-release`. Configure
  `STRIPE_PUBLISHABLE_KEY`, `MATCH_GIT_URL`, `MATCH_PASSWORD`,
  `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`,
  `APP_STORE_CONNECT_KEY_CONTENT` (base64 `.p8`) and `APPLE_TEAM_ID`.
  The signing repository also needs `MATCH_GIT_BASIC_AUTHORIZATION` (base64
  `username:token`) or your supported private-repository authentication.
- Android: `android-v*` tags or manual dispatch use `android-release`. Configure
  `ANDROID_KEYSTORE_BASE64`, `PANTOPUS_KEYSTORE_PASSWORD`, `PANTOPUS_KEY_ALIAS`,
  `PANTOPUS_KEY_PASSWORD`, `PLAY_STORE_SERVICE_ACCOUNT_JSON`,
  `PANTOPUS_API_BASE_URL`, `PANTOPUS_SOCKET_URL`, `STRIPE_PUBLISHABLE_KEY` and
  `MAPS_API_KEY`. Commit a new increasing `versionCode` before each new upload;
  tags do not change the app version. Store acceptance/signing must be verified
  with the actual accounts before the first release.
- Optional repository secrets `SLACK_WEBHOOK_URL` / `DISCORD_WEBHOOK_URL` send
  production deployment outcomes. A disabled deployment is not a success alert.

## Local checks

```bash
pnpm install --frozen-lockfile
pnpm --dir backend run test:privacy
pnpm --dir backend test
pnpm --filter=@pantopus/web lint
pnpm --filter=@pantopus/web type-check:gate
pnpm --filter=@pantopus/web test
pnpm --filter=@pantopus/web build
node --test scripts/deploy/*.test.cjs scripts/db/*.test.cjs
pnpm db:check
docker build -f backend/Dockerfile --target production .
```

Android: `./gradlew ktlintCheck detekt :app:lintDebug test paparazziVerify
:app:assembleDebug` from `frontend/apps/android`, plus
`connectedDebugAndroidTest` with an emulator. iOS: `make lint` and `make test`
from `frontend/apps/ios`. Seeder: `pytest tests/ -q` from `pantopus-seeder`.
