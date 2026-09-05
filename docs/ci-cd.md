# CI/CD

Everything runs on GitHub Actions from `.github/workflows/`. The repository
is public, so runner minutes are free; the design goal is short wall-clock
and no work for surfaces a change did not touch.

## Workflows

| Workflow | File | Runs when | What it gates |
|---|---|---|---|
| CI | `ci.yml` | every PR; pushes to `master` / `dev` | backend privacy gates + Jest, backend Docker image build (PRs only), web lint + typecheck gate + Jest, web Identity Firewall Playwright spec, seeder pytest |
| iOS CI | `ios-ci.yml` | PRs and `master` pushes touching `frontend/apps/ios/**` | SwiftLint (strict, pinned 0.63.3), SwiftFormat (pinned 0.61.1), icon and token guards, hex-literal guard, unit + snapshot tests on three simulators (Xcode 16.4, iOS 18.5) |
| Android CI | `android-ci.yml` | PRs and `master` pushes touching `frontend/apps/android/**` | ktlint, detekt, Android Lint, JVM unit tests, Paparazzi snapshot verify, debug APK; Compose instrumented tests on an emulator (PRs only) |
| Deploy Backend | `deploy-backend.yml` | pushes to `master` / `dev` touching `backend/**`, `docker-compose.yml` or the workflow; manual | build + push `pantopus-backend` image, SSH deploy to staging (`dev`) or production (`master`) |
| Rollback Backend | `rollback-backend.yml` | manual | redeploy a previous image tag to staging or production |
| Release Notifications | `release-notify.yml` | after Deploy / Rollback on `master` | Slack / Discord webhook message (skips when no webhook secret) |
| iOS Beta | `ios-beta.yml` | tag `ios-v*`; manual | Fastlane `beta` → TestFlight |
| Android Beta | `android-beta.yml` | tag `android-v*`; manual | Fastlane `beta` → Play internal track |

### How `ci.yml` stays fast

- **Path detection.** On a pull request the `changes` job classifies the
  diff (backend / web / seeder) and only the matching jobs run. Pushes to
  `master` and `dev` run everything.
- **One required check.** `CI OK` depends on every job and fails if any of
  them failed. Mark only `CI OK` as required on `master`; skipped jobs for
  an unrelated change count as passing.
- **Caching.** The pnpm store (via `actions/setup-node`), pip, Playwright
  browsers and Docker layers (GitHub Actions cache) are all cached.
- **Concurrency.** A new push to the same PR cancels the in-flight run.

### Typecheck gate

`pnpm --filter=@pantopus/web type-check:gate` compares `tsc` output against
`frontend/apps/web/tsc-baseline.json`. The baseline is empty, so any type
error fails the web job. If you ever need to grandfather errors, run
`type-check:baseline` and commit the file with an explanation.

### iOS lint pins

The lint job downloads SwiftLint 0.63.3 and SwiftFormat 0.61.1 from their
GitHub releases so results do not drift with the runner image. Install the
same versions locally (`brew install swiftlint swiftformat` then pin, or use
the release binaries) and run `make lint` / `make format` in
`frontend/apps/ios` before pushing.

## Enabling deploys

`deploy-backend.yml` is safe to leave enabled before any secret exists: its
`preflight` job checks for the Docker Hub secrets and skips the pipeline
with a warning when they are missing. To turn deploys on, add these
repository secrets (Settings → Secrets and variables → Actions):

| Secret | Used by |
|---|---|
| `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` | image push and pull on the hosts |
| `EC2_SSH_KEY`, `EC2_USERNAME` | SSH into the EC2 hosts |
| `STAGING_EC2_HOST` | deploy / rollback from `dev` |
| `PROD_EC2_HOST` | deploy / rollback from `master` |
| `SLACK_WEBHOOK_URL`, `DISCORD_WEBHOOK_URL` | optional release notifications |

The `staging` and `production` environments are created automatically on
first use. Add required reviewers to `production` in Settings →
Environments if you want a manual approval step before a production deploy.

If another repository still deploys the same backend image and host, turn
its deploy workflow off when you enable this one so two pipelines never race
for the same container.

### Mobile release secrets

`ios-beta.yml` uses the `ios-release` environment with
`STRIPE_PUBLISHABLE_KEY`, `MATCH_GIT_URL`, `MATCH_PASSWORD`,
`APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`,
`APP_STORE_CONNECT_KEY_CONTENT` (base64 `.p8`) and `APPLE_TEAM_ID`.

`android-beta.yml` uses the `android-release` environment with
`ANDROID_KEYSTORE_BASE64`, `PANTOPUS_KEYSTORE_PASSWORD`, `PANTOPUS_KEY_ALIAS`,
`PANTOPUS_KEY_PASSWORD`, `PLAY_STORE_SERVICE_ACCOUNT_JSON`,
`PANTOPUS_API_BASE_URL`, `PANTOPUS_SOCKET_URL`, `STRIPE_PUBLISHABLE_KEY` and
`MAPS_API_KEY`.

## Branch protection

Recommended once the first green run lands on `master`:

```bash
gh api -X PUT repos/WangPantopus/skinny-pantopus/branches/master/protection \
  --input - <<'JSON'
{
  "required_status_checks": { "strict": false, "contexts": ["CI OK"] },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null
}
JSON
```

`iOS CI` and `Android CI` only run when their app changed, so leave them out
of the required list; a red run still blocks the merge button visually.

## Running the same checks locally

```bash
# backend
cd backend && pnpm run test:privacy && pnpm test

# web
pnpm --filter=@pantopus/web lint
pnpm --filter=@pantopus/web type-check:gate
pnpm --filter=@pantopus/web test

# seeder
cd pantopus-seeder && pytest tests/ -q

# iOS / Android
cd frontend/apps/ios && make lint && make test
cd frontend/apps/android && make lint && make test
```
