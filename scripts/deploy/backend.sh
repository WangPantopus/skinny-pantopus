#!/usr/bin/env bash
# Runs on the EC2 host. Deploy and rollback use this same transaction.
set -Eeuo pipefail

target=${1:?Usage: backend.sh staging|production repository@sha256:digest}
image=${2:?An immutable image digest is required}
case "$target" in
  production) api=pantopus-backend; worker=pantopus-worker; suffix=prod ;;
  staging) api=pantopus-backend-staging; worker=pantopus-worker-staging; suffix=staging ;;
  *) echo 'Invalid environment' >&2; exit 2 ;;
esac
[[ "$image" =~ ^[a-z0-9./_-]+@sha256:[a-f0-9]{64}$ ]] || { echo 'Use an immutable image digest' >&2; exit 2; }
env_file=${PANTOPUS_ENV_FILE:-$HOME/pantopus/.env.$suffix}
[[ -r "$env_file" ]] || { echo "Missing environment file: $env_file" >&2; exit 2; }
health_attempts=${PANTOPUS_HEALTH_ATTEMPTS:-40}
health_interval=${PANTOPUS_HEALTH_INTERVAL:-3}

# Also serializes manual host invocations, independently of GitHub concurrency.
exec 9>"${PANTOPUS_LOCK_DIR:-$HOME/pantopus}/deploy-$target.lock"
flock -n 9 || { echo 'Another rollout holds the host lock' >&2; exit 1; }

candidate=$api-candidate
api_backup=$api-previous
worker_backup=$worker-previous
api_saved=false
worker_saved=false
api_created=false
worker_created=false
committed=false

exists() { docker container inspect "$1" >/dev/null 2>&1; }
healthy() {
  local name=$1 status attempt
  for ((attempt=1; attempt<=health_attempts; attempt++)); do
    status=$(docker inspect --format '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' "$name") || return 1
    case "$status" in
      'running healthy') return 0 ;;
      'exited '*|'dead '*|'running unhealthy') echo "$name failed readiness" >&2; return 1 ;;
    esac
    sleep "$health_interval"
  done
  echo "$name timed out waiting for readiness" >&2
  return 1
}
cleanup() {
  local status=$? recovery_failed=false
  trap - EXIT
  set +e
  docker rm -f "$candidate" >/dev/null 2>&1
  if [[ "$committed" != true ]]; then
    # Stop the new worker before restoring any old embedded queue consumers.
    if [[ "$worker_created" == true ]]; then docker rm -f "$worker" >/dev/null || recovery_failed=true; fi
    if [[ "$api_created" == true ]]; then docker rm -f "$api" >/dev/null || recovery_failed=true; fi
    if [[ "$api_saved" == true ]]; then
      docker rename "$api_backup" "$api" && docker start "$api" >/dev/null && healthy "$api" || recovery_failed=true
    fi
    if [[ "$worker_saved" == true ]]; then
      docker rename "$worker_backup" "$worker" && docker start "$worker" >/dev/null || recovery_failed=true
    fi
    if [[ "$recovery_failed" == true ]]; then
      echo 'CRITICAL: automatic recovery needs operator attention; previous containers/images are retained.' >&2
    elif [[ "$api_saved" == true || "$worker_saved" == true ]]; then
      echo 'Rollout failed; previous containers restored.' >&2
    fi
    [[ $status -ne 0 ]] || status=1
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

docker pull "$image"
# The candidate is unexposed and runs no background jobs. Verify DB readiness
# before interrupting the old API or worker, even on a first-ever deployment.
docker rm -f "$candidate" >/dev/null 2>&1 || true
docker run -d --name "$candidate" --env-file "$env_file" \
  -e PGBOSS_ENABLED=false -e CRON_ENABLED=false \
  --health-cmd='node scripts/healthcheck.js' --health-interval=5s --health-start-period=20s \
  "$image" >/dev/null
healthy "$candidate"
docker rm -f "$candidate" >/dev/null

# A leftover backup without its current service may be the only recoverable
# container from an interrupted run. Refuse to discard it on a blind retry.
for name in "$api" "$worker"; do
  if exists "$name-previous" && ! exists "$name"; then
    echo "Restore $name-previous before retrying this rollout" >&2
    exit 1
  fi
done
# Remove only stopped backups from a previously successful rollout.
for backup in "$api_backup" "$worker_backup"; do
  if exists "$backup"; then docker rm "$backup" >/dev/null; fi
done
if exists "$api"; then
  docker rename "$api" "$api_backup"
  api_saved=true
  docker stop --time 30 "$api_backup" >/dev/null
fi
if exists "$worker"; then
  docker rename "$worker" "$worker_backup"
  worker_saved=true
  docker stop --time 30 "$worker_backup" >/dev/null
fi
# Set created before docker run: Docker can create a container and then fail
# while binding its port. Recovery must remove that partial container too.
api_created=true
docker run -d --name "$api" --env-file "$env_file" \
  -e PGBOSS_ENABLED=false -e CRON_ENABLED=false \
  -p 8000:8000 --restart unless-stopped \
  --health-cmd='node scripts/healthcheck.js' --health-interval=5s --health-start-period=20s \
  "$image" >/dev/null
healthy "$api"
worker_created=true
docker run -d --name "$worker" --env-file "$env_file" \
  -e PGBOSS_ENABLED=true -e CRON_ENABLED=true --restart unless-stopped \
  --health-cmd='node scripts/worker-healthcheck.js' --health-interval=5s --health-start-period=30s \
  "$image" node worker.js >/dev/null
healthy "$worker"
committed=true
printf 'Deployed %s to %s (API and worker).\n' "$image" "$target"
# Retain stopped previous containers and their images for incident recovery.
