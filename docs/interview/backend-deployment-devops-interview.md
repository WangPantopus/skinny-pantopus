# Backend Deployment and DevOps Interview Notes

This document captures a senior-engineering answer to the deployment, release,
rollback, reproducibility, secrets, and CI/security questions raised for this
repository.

The answer is intentionally split into two layers:

- What the repository does today, with concrete file references.
- How I would explain, defend, and improve the design in an interview.

The important posture is honesty. The current system is a pragmatic,
early-stage branch-to-environment deployment pipeline. It is serviceable for a
small team, but there are clear places where production maturity requires
stronger controls.

## Repository Evidence

The following files are the primary evidence for the current answers:

| Area | Evidence |
| --- | --- |
| Backend deploy | `.github/workflows/deploy-backend.yml` |
| Backend rollback | `.github/workflows/rollback-backend.yml` |
| CI gates | `.github/workflows/ci.yml` |
| Release notifications | `.github/workflows/release-notify.yml` |
| Backend Docker build | `backend/Dockerfile` |
| Monorepo package manager | `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml` |
| Local compose env profiles | `.env.dev`, `.env.staging`, `.env.prod`, `docker-compose.yml` |
| Secret ignore rules | `.gitignore`, `.dockerignore`, `backend/.dockerignore` |
| Migration runbook example | `docs/phase-0-deployment-runbook.md` |
| Public deployment summary | `README.md` |

## Executive Summary

The deployment model is:

1. Developers open feature branches and PR into `dev` or `main`.
2. CI runs on pull requests and pushes to `dev` and `main`.
3. Pushes to `dev` build and deploy the backend to staging EC2.
4. Pushes to `main` build and deploy the backend to production EC2.
5. Docker images are pushed to Docker Hub with environment tags and short-SHA
   tags.
6. Rollback is manual through a GitHub Actions workflow that redeploys a chosen
   image tag to staging or production.
7. Database migrations are not deployed by the backend deploy workflow. They are
   applied through explicit runbooks and must be treated as a separate release
   phase.

The current pipeline is simple and understandable. Its biggest production gaps
are:

- Backend Docker dependency installation is not fully reproducible because it
  uses `npm install` without a backend `package-lock.json`.
- Production deploys are in-place container replacement, so they have real
  downtime.
- Production promotion rebuilds from `main` instead of promoting the exact
  staging-tested image digest.
- Runtime backend secrets are injected through EC2 env files rather than a
  managed secret runtime such as AWS Secrets Manager or SSM Parameter Store.
- Security scanning for dependencies, container images, and committed secrets is
  not currently wired into CI.
- Web type-check is explicitly informational due to existing TypeScript debt.

Those gaps are fixable without changing the product architecture. They are
release-engineering hardening work.

## 1. Why Is Deploy Triggered Directly From Pushes To `main` And `dev`?

### Current Behavior

The backend deploy workflow listens to:

```yaml
on:
  workflow_dispatch:
  push:
    branches: [main, dev]
    paths:
      - 'backend/**'
      - 'docker-compose.yml'
      - '.github/workflows/deploy-backend.yml'
```

The path filter matters. Backend deployment is not triggered by every change in
the repository. It only runs for backend code, root compose config, or the deploy
workflow itself.

The branch mapping is:

| Branch | Image tags | Environment | EC2 target |
| --- | --- | --- | --- |
| `dev` | `staging`, `dev-<short-sha>` | `staging` | `STAGING_EC2_HOST` |
| `main` | `prod`, `latest`, `main-<short-sha>` | `production` | `PROD_EC2_HOST` |

The intended control is not that any engineer directly pushes to protected
branches. The intended control is:

1. Feature work happens on feature branches.
2. Pull requests target `dev` or `main`.
3. CI and review gates must pass.
4. The merge commit lands on a protected branch.
5. The protected branch push becomes the deploy event.

So in the intended model, a push to `main` or `dev` means "a reviewed and tested
change reached a release branch," not "somebody bypassed review."

### Interview Answer

I would explain it this way:

> I chose branch-based deploys because this codebase currently has two long-lived
> release environments: `dev` maps to staging and `main` maps to production. The
> deploy workflow is intentionally simple: once a commit has passed CI and branch
> protection, the branch itself is the release control plane. This reduces manual
> handoffs and prevents a class of drift where code is merged but not deployed.
>
> The safety of that model depends on protected branches and required checks. I
> would not defend direct unprotected pushes to `main`. In production, `main` and
> `dev` should require PR review, required CI jobs, no force-push, and ideally
> GitHub Environment protection rules for production approval.

### Why This Can Be Reasonable

Branch-triggered deployment is reasonable when:

- The team is small enough that release ownership is clear.
- There is a single deployable backend service.
- Environments have a simple one-branch-to-one-environment mapping.
- Protected branches enforce review and CI.
- Rollback is available.
- Production deployments are frequent and small.

It is less appropriate when:

- The organization has strict release windows.
- Multiple services must be promoted atomically.
- Compliance requires explicit manual approvals.
- Database migrations require heavy coordination.
- Deployments must be guaranteed zero-downtime.
- The staging artifact must be promoted unchanged to production.

### What I Would Harden

I would add or verify the following GitHub controls:

1. Protect `main` and `dev`.
2. Require PR review before merge.
3. Require the blocking CI jobs from `.github/workflows/ci.yml`.
4. Require conversation resolution.
5. Disallow force-push.
6. Require linear history or squash merges if release traceability benefits.
7. Use GitHub Environments:
   - `staging` can auto-deploy.
   - `production` requires approval from an owner.
8. Add deployment concurrency so only one deploy per environment runs at a time.

Example improvement:

```yaml
concurrency:
  group: deploy-backend-${{ github.ref }}
  cancel-in-progress: false
```

For production, I would generally avoid `cancel-in-progress: true` because a
half-finished deploy should be allowed to finish or fail deterministically.

## 2. What Is The Promotion Path From Dev To Staging To Production?

### Current Path

The current promotion flow is:

1. A developer opens a feature branch.
2. A PR targets `dev`.
3. CI runs:
   - Backend tests.
   - Privacy gates.
   - Seeder tests.
   - Web lint/tests/Playwright identity test.
   - Mobile release checks.
4. Merge to `dev`.
5. `deploy-backend.yml` builds a Docker image from the backend context and pushes:
   - `pantopus-backend:staging`
   - `pantopus-backend:dev-<short-sha>`
6. The workflow SSHes into staging EC2 and runs the staging image with
   `~/pantopus/.env.staging`.
7. Engineers validate staging manually or through smoke tests.
8. The tested commit is merged or cherry-picked into `main`.
9. Push to `main` builds a production image and pushes:
   - `pantopus-backend:prod`
   - `pantopus-backend:latest`
   - `pantopus-backend:main-<short-sha>`
10. The workflow SSHes into production EC2 and runs the production image with
    `~/pantopus/.env.prod`.

### Important Nuance: This Is Commit Promotion, Not Artifact Promotion

The current process promotes source code by merging from `dev` to `main`.
Production then rebuilds a new Docker image from the `main` checkout.

That means the production image should be equivalent to the staging image if:

- The promoted source commit is the same.
- The Docker base image has not changed.
- Dependency resolution is deterministic.
- The Docker build context is identical.
- Build-time network responses are equivalent.

Today, not all of those assumptions are guaranteed. In particular, the backend
Dockerfile uses `npm install` without a lockfile. That means the production
rebuild can resolve different transitive dependency versions from the staging
build.

### Stronger Promotion Model

The stronger production-grade model is artifact promotion:

1. Build once for the commit.
2. Test that image in staging.
3. Promote the same image digest to production.
4. Deploy by immutable digest, not mutable tag.

For example:

```text
Build commit abc1234
  -> image digest sha256:...
  -> tag dev-abc1234
  -> deploy digest sha256:... to staging
  -> validate
  -> tag same digest as prod-2026-05-13.1
  -> deploy same digest to production
```

This removes an entire class of "works in staging, different in production"
failures.

### Interview Answer

> The current promotion path is branch-based. `dev` is the staging branch and
> `main` is production. A feature lands in `dev`, deploys automatically to
> staging, gets validated, and is then merged or cherry-picked into `main`.
> The production deploy is triggered by the `main` push.
>
> I would be transparent that this promotes source commits, not immutable
> artifacts. For a stricter production posture I would change it so the image
> built for the `dev` commit is promoted by digest after staging validation. That
> gives us exactly one build artifact moving through environments and makes
> rollback and auditability much stronger.

## 3. Why Does Backend Docker Install With `npm` While The Monorepo Uses `pnpm`?

### Current Behavior

The root package declares:

```json
"packageManager": "pnpm@9.15.4"
```

The workspace is defined in `pnpm-workspace.yaml`:

```yaml
packages:
  - 'backend'
  - 'frontend/apps/*'
  - 'frontend/packages/*'
```

CI uses pnpm:

```yaml
corepack enable && corepack prepare pnpm@9.15.4 --activate
pnpm install --frozen-lockfile
```

The backend Dockerfile, however, does this:

```dockerfile
FROM base AS prod-deps
COPY package.json ./
RUN npm install --omit=dev
```

That is inconsistent with the monorepo package-manager policy.

### Why It Probably Happened

The backend image is built with:

```yaml
context: ./backend
target: production
```

Because the Docker build context is only `./backend`, the Dockerfile cannot see
the root `pnpm-lock.yaml` unless the workflow changes the build context or
copies the lockfile into the backend context.

The backend also currently behaves like an isolated Node service. It does not
depend on local workspace packages such as `@pantopus/types`, while the web and
mobile apps do.

So the historical reason is likely:

- The backend was deployable as a standalone Node service.
- `npm install` was easy inside a `backend/`-only Docker context.
- The Dockerfile predates the stricter monorepo pnpm standard.

### Why I Would Not Defend This As Ideal

The current approach is not ideal because:

- CI tests dependencies resolved by pnpm from `pnpm-lock.yaml`.
- Docker production installs dependencies resolved by npm without a lockfile.
- Transitive dependency versions can drift between CI and production.
- It weakens vulnerability triage because the deployed dependency graph is not
  necessarily the CI dependency graph.
- It makes production build reproducibility weaker.

### Preferred Fix

I would make backend Docker use pnpm and the lockfile.

A clean approach is to use root context and a backend-targeted install:

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json backend/package.json
RUN pnpm install --frozen-lockfile --filter pantopus-backend --prod

FROM base AS production
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY backend ./backend
WORKDIR /app/backend
CMD ["node", "app.js"]
```

The exact Dockerfile depends on how pnpm lays out workspace symlinks and whether
the backend remains independent from internal packages. The core rule is simple:
production must install from the same lockfile as CI.

Alternative acceptable fix:

- Add a committed `backend/package-lock.json`.
- Use `npm ci --omit=dev`.
- Make CI also validate backend production install with `npm ci`.

I prefer pnpm for consistency with the repo.

### Interview Answer

> The backend Dockerfile currently uses npm because the image is built from the
> `backend/` directory as a standalone service. That made the Docker build
> simple, but it is not the final state I would want. The monorepo standard is
> pnpm, and CI uses `pnpm install --frozen-lockfile`.
>
> For reproducible production builds, Docker should use the same package manager
> and lockfile as CI. I would change backend Docker to use Corepack and pnpm from
> the root lockfile, or at minimum switch to `npm ci` with a committed backend
> lockfile. I would not claim the current `npm install` path gives strict
> reproducibility.

## 4. How Do You Guarantee Reproducible Backend Builds?

### Current Guarantees

The current system provides some traceability:

- Docker images are tagged with short commit SHAs.
- `dev` deploys include `dev-<short-sha>`.
- `main` deploys include `main-<short-sha>`.
- Rollback can choose a specific image tag.
- CI uses `pnpm install --frozen-lockfile`.

Those are useful, but they are traceability controls, not full reproducibility
controls.

### Current Gaps

The current backend image build is not fully reproducible because:

1. `npm install --omit=dev` is used without `package-lock.json`.
2. `backend/package.json` uses semver ranges.
3. The Node base image is `node:20-alpine`, a mutable tag.
4. The deploy workflow deploys mutable tags such as `staging` and `prod`.
5. Build output is not recorded with image digest in the deploy step.
6. There is no SBOM artifact.
7. There is no image signature or provenance attestation.

### Strong Reproducibility Standard

To guarantee reproducible backend builds, I would require:

1. **Pinned dependency graph**
   - Use `pnpm install --frozen-lockfile --prod`.
   - Fail if the lockfile is missing or stale.

2. **Pinned package manager**
   - Use Corepack.
   - Use the exact pnpm version from root `packageManager`.

3. **Pinned runtime**
   - Pin the base image by digest:

   ```dockerfile
   FROM node:20-alpine@sha256:<digest>
   ```

4. **Deterministic Docker context**
   - Exclude logs, local env files, tests if not needed, and local artifacts.
   - Ensure `.dockerignore` excludes `.env*` in the backend context.

5. **Immutable image identity**
   - Deploy by image digest:

   ```text
   docker.io/org/pantopus-backend@sha256:<digest>
   ```

6. **Build provenance**
   - Record:
     - Git SHA.
     - Dockerfile digest.
     - Base image digest.
     - pnpm lockfile hash.
     - Image digest.
     - Build timestamp.
     - Builder identity.

7. **SBOM and scan**
   - Generate CycloneDX or SPDX SBOM.
   - Scan dependencies and OS packages.

8. **No unreviewed network drift**
   - All package resolution comes from lockfiles.
   - Any dependency update is a code review event.

### Practical CI Changes

Add a build validation step before pushing:

```yaml
- name: Verify backend lockfile install
  run: pnpm install --frozen-lockfile --filter pantopus-backend

- name: Build backend image
  uses: docker/build-push-action@v5
  with:
    context: .
    file: backend/Dockerfile
    target: production
    push: true
    tags: ${{ steps.meta.outputs.tags }}
    labels: ${{ steps.meta.outputs.labels }}
    provenance: true
    sbom: true
```

Then capture the digest:

```yaml
outputs:
  image-digest: ${{ steps.build.outputs.digest }}
```

Deploy:

```sh
IMAGE="$DOCKERHUB_USERNAME/pantopus-backend@${IMAGE_DIGEST}"
docker pull "$IMAGE"
docker run ... "$IMAGE"
```

### Interview Answer

> Today we have traceability through commit-SHA image tags, but not a full
> reproducibility guarantee. The production-grade guarantee is to make CI and
> Docker use the same lockfile, pin the package manager and base image, build
> from a clean context, emit an SBOM/provenance, and deploy immutable image
> digests rather than mutable tags.
>
> The most important immediate fix is replacing `npm install` in the backend
> Dockerfile with a lockfile-enforced install. Without that, staging and
> production can resolve different dependency versions even for the same source
> commit.

## 5. The EC2 Deploy Stops And Removes The Old Container Before Starting The New One. What Downtime Is Acceptable?

### Current Behavior

The current production deploy does:

```sh
docker pull "$IMAGE"

docker stop pantopus-backend || true
docker rm pantopus-backend || true
docker run -d \
  --name pantopus-backend \
  --env-file ~/pantopus/.env.prod \
  -p 8000:8000 \
  --restart unless-stopped \
  "$IMAGE"
```

After the new container starts, the workflow polls Docker health:

```sh
for i in $(seq 1 20); do
  status=$(docker inspect --format='{{.State.Health.Status}}' pantopus-backend)
  ...
  sleep 3
done
```

The Dockerfile healthcheck probes `http://localhost:8000/`.

### Actual Downtime Profile

The deploy pulls the image before stopping the old container, which is good.
The outage window starts at `docker stop` and ends when the new container is
listening and usable.

Minimum downtime:

- Time to stop the old container.
- Time to create/start the new container.
- Node process boot time.
- Time until the server binds port 8000.

Potential downtime:

- If startup is slow, seconds to tens of seconds.
- If the container never becomes healthy, the outage persists until manual
  rollback because the old container has already been removed.

The health-check loop detects failure; it does not prevent downtime.

### Acceptability

For staging:

- This is acceptable.
- Staging prioritizes simplicity and fast iteration.

For production:

- This is acceptable only if the product is in beta or low-traffic mode and the
  business explicitly accepts short API blips.
- It is not acceptable for a mature production system with real-time chat,
  payments, critical notifications, or strict availability SLOs.

If I had to put a number on the current production acceptance:

- Target: under 10 seconds.
- Maximum tolerated for this implementation: under 60 seconds.
- Anything requiring payment flow continuity, chat reliability, or high
  availability should move to zero-downtime deployment.

The workflow already waits up to about 60 seconds for health, but user-visible
downtime should be much shorter than that. The 60-second loop is a failure
detection window, not an SLO.

### Better Single-Host Deployment

On one EC2 host, a safer pattern is blue/green with local ports:

1. Keep current container serving on port 8000 through Nginx.
2. Start new container on port 8001 or 8002.
3. Run health checks against the new container.
4. Switch Nginx upstream to the new port.
5. Reload Nginx.
6. Keep the old container for a short rollback window.
7. Remove old container after validation.

Example shape:

```sh
NEW_NAME="pantopus-backend-$GITHUB_SHA"
NEW_PORT="8001"

docker run -d \
  --name "$NEW_NAME" \
  --env-file ~/pantopus/.env.prod \
  -p "$NEW_PORT:8000" \
  "$IMAGE"

curl --fail "http://localhost:$NEW_PORT/"

# Update reverse proxy upstream and reload.
sudo nginx -s reload

# Then stop the previous container after traffic has moved.
```

### Better Cloud-Native Deployment

For a stronger production path:

- Put EC2 instances behind an ALB.
- Run at least two backend tasks/instances.
- Use ECS, ASG rolling deploys, or Kubernetes.
- Only deregister old targets after new targets are healthy.
- Use connection draining.
- Add readiness checks separate from liveness checks.

### Interview Answer

> The current EC2 deploy has real downtime because it stops the serving
> container before the replacement is healthy. For staging that is fine. For
> production, I would only accept that as an explicit early-stage tradeoff with a
> short outage budget, roughly single-digit seconds and definitely under a
> minute.
>
> The fix is not complicated: start the new container first on an alternate port,
> health-check it, switch traffic at Nginx or an ALB, then stop the old
> container. The mature version is an ALB/ECS rolling or blue/green deploy with
> connection draining and deploy-by-digest.

## 6. What Is The Rollback Process When A Migration And Container Deploy Both Ship?

### Current Rollback Workflow

The repository has `.github/workflows/rollback-backend.yml`.

It is manually triggered with:

- `target`: `staging` or `production`.
- `image_tag`: the Docker image tag to deploy.

The rollback workflow:

1. SSHes into the chosen EC2 host.
2. Logs into Docker Hub.
3. Pulls the requested image tag.
4. Stops/removes the current container.
5. Starts the requested image.
6. Waits for the Docker healthcheck.

This is a code/container rollback only.

### What It Does Not Do

It does not:

- Revert database migrations.
- Restore database backups.
- Run down migrations.
- Check schema compatibility before rollback.
- Coordinate feature flags automatically.
- Recreate data that a migration transformed or deleted.

Therefore, migrations and code deploys must be designed so that code rollback is
safe.

### Current Migration Discipline In The Repo

The `docs/phase-0-deployment-runbook.md` shows the intended discipline:

1. Run pre-flight tests.
2. Apply migrations in explicit order.
3. Run a smoke script after every migration.
4. Verify domain invariants with SQL.
5. Use feature flags for behavior activation.
6. Prefer flag-off and code rollback before hard DB rollback.
7. Only do hard DB rollback with explicit reverse-order instructions and data
   restoration steps.

This is the right instinct. The deploy workflow itself does not encode migration
automation, so migration safety has to live in release process and migration
design.

### Correct Rollback Philosophy

The production-grade rule is:

> Roll forward by default. Roll back code only when the database schema remains
> backward-compatible. Roll back data only from a rehearsed, environment-specific
> runbook.

For migrations, the safest pattern is expand/contract:

1. **Expand**
   - Add nullable columns, new tables, new indexes, new views.
   - Add new code that can read old and new shapes.
   - Do not remove old columns yet.

2. **Backfill**
   - Backfill in batches.
   - Make scripts idempotent.
   - Keep progress markers.
   - Validate counts and invariants.

3. **Dual-read or dual-write**
   - Write both old and new if needed.
   - Read new with fallback to old.
   - Keep feature flags available.

4. **Cutover**
   - Turn on the feature flag or switch read path.
   - Monitor.

5. **Contract**
   - Drop old columns/tables only after at least one rollback window.
   - Contract migrations are separate releases.

### Rollback Scenarios

#### Scenario A: Code Bug, Migration Is Backward-Compatible

Action:

1. Disable the feature flag if applicable.
2. Run rollback workflow with previous known-good image tag.
3. Confirm health.
4. Run smoke tests.
5. Investigate forward fix.

This is the ideal case.

#### Scenario B: Migration Bug, Code Is Fine

Action:

1. Stop further deploys.
2. Disable feature flag if applicable.
3. Assess data impact.
4. If the migration was additive, ship a corrective migration.
5. If data was corrupted, restore from backup or use a repair script.
6. Avoid rolling the app back unless old code can tolerate the new schema.

#### Scenario C: Code Requires New Schema, Need Code Rollback

This is why backward compatibility matters.

If old code cannot run against the new schema, rollback becomes risky. The
release should instead:

1. Disable feature flag.
2. Ship a forward hotfix compatible with the current schema.
3. Only perform DB rollback if there is a tested reverse migration and backup.

#### Scenario D: Destructive Migration Shipped

Action:

1. Declare an incident.
2. Freeze deploys.
3. Restore from backup or point-in-time recovery if necessary.
4. Reconcile data written after the migration.
5. Ship a forward repair.

Destructive migrations should not be part of the same deploy as application code
unless the rollback plan is explicit and rehearsed.

### Interview Answer

> The rollback workflow redeploys an older container image by tag. It does not
> roll back the database. That is intentional in the sense that database rollback
> is not something I want hidden inside a generic deploy script.
>
> The way I make that safe is migration discipline: additive migrations,
> backward-compatible code, feature flags, idempotent backfills, smoke checks, and
> delayed destructive changes. If a code deploy and migration ship together, the
> first rollback move is usually flag-off or code rollback to a version that is
> compatible with the expanded schema. Hard DB rollback is a separate runbook,
> done in reverse order, with backups and data-restoration steps.

## 7. How Are Secrets Injected And Rotated?

### Current Secret Injection

There are three different secret patterns in the repo:

#### GitHub Actions Secrets

The deploy workflow reads:

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`
- `EC2_SSH_KEY`
- `EC2_USERNAME`
- `STAGING_EC2_HOST`
- `PROD_EC2_HOST`

The release notification workflow optionally reads:

- `SLACK_WEBHOOK_URL`
- `DISCORD_WEBHOOK_URL`

These are injected into GitHub Actions at runtime from GitHub Secrets.

#### EC2 Runtime Env Files

The backend container is run with:

```sh
--env-file ~/pantopus/.env.staging
```

or:

```sh
--env-file ~/pantopus/.env.prod
```

Those files live on the EC2 host outside the repository checkout.

#### AWS Secrets Manager For Seeder/Lambda

The seeder/Lambda code and docs use AWS Secrets Manager. The Python seeder
loads secrets through `pantopus-seeder/src/config/secrets.py` using a
`SECRET_NAME` environment variable and `secretsmanager:GetSecretValue`.

### Current Rotation Process

For GitHub Actions secrets:

1. Create the new token/key in the provider.
2. Update the GitHub Secret.
3. Re-run the workflow or wait for the next deploy.
4. Revoke the old token after validation.

For EC2 runtime env files:

1. Create the new provider secret.
2. SSH or configuration-manage the updated value into
   `~/pantopus/.env.prod` or `~/pantopus/.env.staging`.
3. Restart or redeploy the container.
4. Verify health and provider functionality.
5. Revoke the old value.

For AWS Secrets Manager:

1. Update the JSON secret value.
2. Redeploy or let Lambda pick it up on next cold start, depending on caching.
3. Validate function behavior.
4. Revoke old provider credentials.

### Security Gaps

The EC2 env-file model works, but it has weaknesses:

- Secret distribution is manual.
- Rotation requires SSH/configuration access.
- Access auditing is weaker than Secrets Manager.
- There is no built-in version staging such as `AWSCURRENT`/`AWSPREVIOUS`.
- Secret file permissions must be maintained manually.
- A compromised host exposes all environment variables to that container/user.

There is also a Docker context issue:

- Root `.dockerignore` excludes several env patterns, but not every checked-in
  env profile.
- `backend/.dockerignore` currently does not exclude `.env*`.
- If a local developer has untracked `backend/.env.prod` and builds from
  `./backend`, Docker can include it in the build context unless ignored.

Even if the production workflow builds from a clean GitHub checkout where those
files are not tracked, local build hygiene should still protect secrets.

### Preferred Secret Architecture

For backend runtime secrets, I would move from EC2 env files to AWS Secrets
Manager or SSM Parameter Store:

1. Store secrets under names such as:
   - `pantopus/backend/staging`
   - `pantopus/backend/production`
2. Give the EC2 instance role permission to read only the environment-specific
   secret.
3. During deploy, fetch the secret and write a temporary env file with strict
   permissions, or use a lightweight entrypoint that exports variables at
   container start.
4. Rotate through Secrets Manager with version labels.
5. Restart the container after rotation.
6. Audit access through CloudTrail.

An even cleaner path is ECS:

- Task definitions reference Secrets Manager entries directly.
- ECS injects secrets into the container.
- IAM controls are per task role.
- Rollback and deploy are first-class primitives.

### Rotation Policy

Recommended rotation policy:

| Secret class | Rotation trigger | Target cadence |
| --- | --- | --- |
| Docker Hub token | Person leaves, suspected leak, periodic | 90 days |
| EC2 SSH key | Person leaves, suspected leak | Replace with SSM Session Manager |
| Supabase service role | Suspected leak, access change | As needed, rehearsed |
| Stripe secret | Suspected leak, personnel/access change | As needed, with webhook validation |
| SMTP password | Provider policy/personnel change | 90-180 days |
| OpenAI/API provider keys | Suspected leak, usage anomaly | 90-180 days |
| Internal API key | Any service exposure risk | 90 days |
| Webhook secrets | Provider rotation support | 90-180 days |

### Interview Answer

> CI/CD secrets are injected from GitHub Secrets. Runtime backend secrets are
> currently injected on EC2 through environment files passed to `docker run`.
> Lambda/seeder secrets use AWS Secrets Manager.
>
> The EC2 env-file model is simple, but I would move the backend to Secrets
> Manager or SSM Parameter Store. Rotation should be a documented process:
> create the new provider key, update the secret store, redeploy/restart,
> validate, then revoke the old key. I would also tighten Docker ignore rules so
> local env files can never enter a build context.

## 8. Why Are `.env.dev`, `.env.prod`, And `.env.staging` Tracked?

### Current State

The tracked root env files contain compose/build profile values:

- `COMPOSE_PROJECT_NAME`
- `APP_ENV`
- `DOCKER_TARGET`
- `NODE_ENV`
- `BACKEND_PORT`
- `WEB_PORT`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

These are used by root `docker-compose.yml`:

```yaml
env_file:
  - ./backend/.env.${APP_ENV:-dev}
```

and by the web Docker build args:

```yaml
args:
  NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://localhost:8000}
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: ${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:-}
```

So the tracked root files are environment defaults/profiles, not intended to be
secret-bearing backend runtime files.

The repository `.gitignore` ignores:

```text
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
.env*.local
```

It does not ignore `.env.dev`, `.env.staging`, or `.env.prod`, which is why the
root versions are tracked.

### Why This Can Be Defensible

Tracking non-secret environment profiles can be useful because:

- Developers can run compose without guessing port and environment names.
- Staging and production public URLs are documented in code.
- Next.js public build-time variables are not secret by definition.
- Compose behavior is reproducible across machines.

But the naming is dangerous.

### Why The Naming Is Risky

Files named `.env.prod` and `.env.staging` strongly imply secrets. That creates
two risks:

1. Engineers may add real secrets to tracked files by mistake.
2. Reviewers may become desensitized to `.env` files in diffs.

Also, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is public, but it should still be
real-environment managed. Even public keys should not casually drift.

### Preferred Pattern

I would rename the tracked files to make their non-secret role clear:

```text
compose.dev.env
compose.staging.env
compose.prod.env
```

or:

```text
.env.dev.example
.env.staging.example
.env.prod.example
```

Then keep real secret-bearing files ignored:

```text
.env
.env.local
.env.*.local
backend/.env
backend/.env.*
!backend/.env.example
```

If the root files must remain tracked, I would add a header:

```text
# This file is tracked and must contain only non-secret compose defaults.
# Do not add service role keys, provider secrets, passwords, tokens, or private keys.
# Put real runtime secrets in the secret manager or untracked local env files.
```

### Interview Answer

> The tracked root `.env.dev`, `.env.staging`, and `.env.prod` files are compose
> profiles, not secret stores. They define ports, Docker targets, environment
> names, and public client build variables. The real backend runtime secrets are
> expected to live outside Git, either in EC2 env files or a secret manager.
>
> That said, I would improve the naming because `.env.prod` looks like it should
> contain secrets. I would rename these to compose profile files or `.example`
> files and enforce ignore rules for all real secret-bearing env files.

## 9. Do You Run Security Scanning For Dependencies, Docker Images, And Secrets?

### Current State

The current CI has strong product/privacy gates, especially around identity
firewall behavior, serializers, notification templates, and source-level
privacy checks.

However, the GitHub Actions workflows do not currently show:

- Dependency vulnerability scanning.
- Docker image vulnerability scanning.
- Secret scanning.
- CodeQL.
- Semgrep.
- SBOM generation.
- Docker image signing.
- Container provenance enforcement.

So the honest answer is:

> Not yet in this repo's CI pipeline, beyond domain-specific privacy/security
> tests.

### What Exists Today

CI currently runs:

- Backend unit tests.
- Backend privacy gates.
- Full backend Jest suite.
- Seeder pytest suite.
- Web lint.
- Web identity tests.
- Web Playwright identity test.
- Mobile Expo compatibility check.
- Mobile tests.
- Mobile TypeScript check.
- Android export smoke.

The privacy gates are valuable and security-relevant, but they are not a
replacement for dependency, image, and secret scanning.

### What I Would Add

#### Dependency Scanning

For JavaScript/TypeScript:

```sh
pnpm audit --audit-level high
```

For Python:

```sh
pip-audit -r pantopus-seeder/requirements.txt
pip-audit -r pantopus-seeder/requirements-lambda.txt
```

I would pair this with Dependabot or Renovate so vulnerabilities result in
reviewable update PRs.

#### Container Image Scanning

Use Trivy:

```yaml
- name: Scan backend image
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ env.IMAGE_NAME }}:${{ steps.meta.outputs.version }}
    format: table
    exit-code: '1'
    severity: CRITICAL,HIGH
```

or Grype:

```sh
grype docker.io/org/pantopus-backend@sha256:<digest> --fail-on high
```

#### Secret Scanning

Use gitleaks:

```yaml
- name: Secret scan
  uses: gitleaks/gitleaks-action@v2
```

or TruffleHog:

```yaml
- name: Secret scan
  uses: trufflesecurity/trufflehog@main
  with:
    path: ./
    base: ${{ github.event.repository.default_branch }}
    head: HEAD
```

Also enable GitHub Advanced Security secret scanning if available.

#### Static Analysis

Use CodeQL:

```yaml
name: CodeQL
on:
  pull_request:
  push:
    branches: [main, dev]
```

Use Semgrep for additional rules if desired, especially for Express, Supabase
service-role misuse, SQL construction, and unsafe file handling.

#### SBOM And Provenance

Use Docker Buildx SBOM/provenance:

```yaml
with:
  sbom: true
  provenance: true
```

Store SBOMs as build artifacts and attach them to releases.

#### Image Signing

Use Cosign:

```sh
cosign sign docker.io/org/pantopus-backend@sha256:<digest>
cosign verify docker.io/org/pantopus-backend@sha256:<digest>
```

### Blocking Policy

Recommended blocking rules:

| Scan | Blocks merge? | Notes |
| --- | --- | --- |
| Secret scan | Yes | Any verified secret blocks. |
| Dependency high/critical | Yes | Allow expiring exceptions with owner and justification. |
| Docker high/critical OS vulns | Yes for production deploy | Some base-image CVEs need exception handling. |
| CodeQL high/critical | Yes | Especially auth, injection, path traversal. |
| SBOM generation | Yes | Missing SBOM indicates incomplete release artifact. |
| License scan | Usually informational at first | Can become blocking after policy is defined. |
| Low/medium dependency vulns | Informational initially | Track and batch-fix. |

### Interview Answer

> Today the repo has meaningful privacy/security tests, but it does not yet have
> general-purpose dependency, image, and secret scanning wired into Actions. I
> would add gitleaks or TruffleHog for secrets, pnpm audit and pip-audit for
> dependencies, Trivy or Grype for Docker images, CodeQL for static analysis,
> and SBOM/provenance generation in the Docker build.
>
> My blocking policy would be strict for verified secrets and high/critical
> reachable vulnerabilities, while allowing lower-severity findings to start as
> informational until the backlog is clean enough to enforce.

## 10. Which CI Failures Block Merges, And Which Are Informational Only?

### Current CI Jobs

`.github/workflows/ci.yml` defines four main jobs:

1. `backend-test`
2. `seeder-test`
3. `web-checks`
4. `mobile-checks`

CI runs on:

```yaml
pull_request:
  branches: [main, dev]
push:
  branches: [main, dev]
```

Whether a job blocks merging depends on GitHub branch protection settings. The
workflow defines job behavior; branch protection decides which jobs are required.
The repo documentation says `main` and `dev` are protected, but the exact GitHub
settings are outside the repository.

### Blocking By Workflow Semantics

Within the workflow itself, these steps fail their job if they fail:

#### Backend

- `pnpm install --frozen-lockfile`
- Identity Firewall backend tests.
- `pnpm run test:privacy`
- Full `pnpm test`

The privacy gates are especially important. The contributing guide says every PR
must pass them.

#### Seeder

- Python dependency installation.
- `pytest tests/ -q`.

#### Web

- `pnpm install --frozen-lockfile`
- Web lint.
- Identity Firewall web test.
- Playwright Chromium install.
- Identity Firewall Playwright test.

#### Mobile

- `pnpm install --frozen-lockfile`
- Expo dependency compatibility check.
- Identity Firewall mobile tests.
- Mobile TypeScript check.
- Android export smoke.

### Explicitly Informational

The web type-check step is explicitly non-blocking:

```yaml
- name: Type-check web
  run: pnpm --filter=@pantopus/web type-check
  continue-on-error: true
```

The workflow comment says:

```text
Pre-existing TS errors exist - runs but won't block CI for now
```

So web type-check is informational today.

### Deploy Failures Are Release Failures, Not PR Merge Gates

The backend deploy workflow runs on push to `main` or `dev`, not on pull request.
That means deploy failure does not normally block a PR from merging. It indicates
that a merged commit failed to release.

For production maturity, I would make deployment status visible and alerting
strong:

- Slack/Discord notification already exists for production deploy and rollback
  workflows.
- Add paging or incident hooks for production deploy failure.
- Add automatic rollback only if the failure mode is well understood.
- Require production environment approval before deployment if the team needs a
  manual release gate.

### Recommended Required Checks

I would require these branch protection checks:

| Check | Required? | Rationale |
| --- | --- | --- |
| Backend Tests | Yes | API, privacy, and domain behavior. |
| Seeder Tests | Yes | Background content jobs affect production data. |
| Web Type-check & Lint | Yes, except current type-check substep | Web UI and identity surfaces. |
| Mobile Release Checks | Yes | Mobile clients must remain compatible. |
| Secret scan | Yes once added | Prevent key leaks. |
| Dependency scan | Yes after baseline cleanup | Prevent known high-risk vulnerabilities. |
| Docker build | Yes for backend-changing PRs | Catch production image failures before merge. |
| Docker image scan | Yes for deploy | Prevent shipping vulnerable images. |

The current workflow does not build the backend Docker image in CI before merge.
It builds during deploy. I would add a PR-time Docker build check for changes to
`backend/**` or `backend/Dockerfile`.

### Interview Answer

> The blocking checks are the CI jobs required by branch protection. In the
> workflow itself, backend tests/privacy gates/full Jest, seeder pytest, web lint
> and identity tests, mobile compatibility/tests/type-check/export all fail their
> jobs on error. The one explicitly informational step is web type-check because
> it has `continue-on-error: true` due to existing TypeScript debt.
>
> Deploy failures happen after merge because deploy runs on branch push. They
> should page or notify release owners, but they are not PR merge gates today. I
> would add PR-time Docker build checks and security scans so production deploys
> are less likely to discover problems after merge.

## Recommended Hardening Roadmap

This section expands beyond the direct interview questions and shows how I would
turn the current system into a stronger production pipeline.

### Phase 1: Close Reproducibility Gaps

1. Convert backend Docker install to pnpm with root lockfile.
2. Pin Node base image by digest.
3. Add backend Docker build check to PR CI.
4. Add `.env*` exclusions to `backend/.dockerignore`.
5. Capture and print the pushed image digest.
6. Deploy by digest instead of mutable tag.

### Phase 2: Add Security Gates

1. Add gitleaks or TruffleHog.
2. Add pnpm audit with baseline exceptions.
3. Add pip-audit for seeder dependencies.
4. Add Trivy or Grype image scan.
5. Add CodeQL.
6. Generate SBOM and provenance.
7. Define severity thresholds and exception process.

### Phase 3: Improve Deployment Availability

1. Add deploy concurrency per environment.
2. Implement blue/green on the EC2 host through Nginx and alternate ports.
3. Keep previous container available for fast local rollback.
4. Add readiness checks that verify downstream dependencies, not only `/`.
5. Move toward ALB plus at least two targets.
6. Consider ECS for first-class rolling deploys and secret injection.

### Phase 4: Improve Promotion

1. Build image once per candidate commit.
2. Deploy that digest to staging.
3. Validate staging.
4. Promote the exact digest to production.
5. Record release metadata:
   - Source SHA.
   - Image digest.
   - Migration set.
   - Feature flags changed.
   - Operator/approver.
   - Validation evidence.

### Phase 5: Formalize Migration Operations

1. Classify every migration as additive, backfill, cutover, or destructive.
2. Require rollback notes in migration PRs.
3. Require staging migration smoke before production.
4. Require backup/PITR verification before destructive operations.
5. Delay contract migrations until after a rollback window.
6. Maintain a release checklist for schema and app compatibility.

### Phase 6: Secret Management Maturity

1. Move backend runtime secrets to AWS Secrets Manager or SSM.
2. Replace SSH deploy with SSM Session Manager or a deployment agent.
3. Scope IAM permissions per environment.
4. Add rotation runbooks.
5. Add secret access audit review.
6. Add automated checks that tracked env files contain only approved public keys
   and non-secret defaults.

## Strong Interview Closing Answer

If asked to summarize the system in a senior interview, I would say:

> This repository currently uses a pragmatic branch-to-environment deployment
> model. `dev` deploys to staging, `main` deploys to production, and Docker
> images are tagged with both environment tags and commit-SHA tags. CI runs
> backend, privacy, seeder, web, and mobile checks, with web type-check currently
> informational due to known debt. Rollback is manual by image tag.
>
> The design is simple and appropriate for an early single-service EC2 backend,
> but I would not oversell it as a fully mature release platform. The biggest
> improvements are to make backend Docker builds lockfile-reproducible, deploy
> immutable image digests, promote the exact staging-tested artifact, move runtime
> secrets into AWS Secrets Manager or SSM, add dependency/image/secret scanning,
> and replace in-place container restarts with blue/green or rolling deploys.
>
> The important engineering principle is that release safety comes from multiple
> layers: protected branches, deterministic builds, immutable artifacts,
> environment approvals, compatible migrations, secret hygiene, security scans,
> health checks, and rehearsed rollback. This repo has several of those layers
> already, especially clear branch mapping, CI, privacy gates, image tags, and a
> rollback workflow. The next step is hardening the gaps so the deployment path
> is not just convenient but operationally robust.

