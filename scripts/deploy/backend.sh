#!/usr/bin/env bash
# Runs on the EC2 host. Deploy and rollback use this same transaction.
set -Eeuo pipefail

target=${1:?Usage: backend.sh staging|production repository@sha256:digest [host-bind] [--local-image]}
image=${2:?An immutable image digest is required}
api_bind=${3:-8000}
image_mode=${4:-registry}
[[ "$api_bind" =~ ^((127\.0\.0\.1|0\.0\.0\.0):)?([1-9][0-9]{0,4})$ ]] &&
  (( BASH_REMATCH[3] <= 65535 )) || { echo 'Invalid API host binding' >&2; exit 2; }
case "$target" in
  production) api=pantopus-backend; worker=pantopus-worker; suffix=prod ;;
  staging) api=pantopus-backend-staging; worker=pantopus-worker-staging; suffix=staging ;;
  *) echo 'Invalid environment' >&2; exit 2 ;;
esac
case "$image_mode" in
  registry)
    [[ "$image" =~ ^[a-z0-9./_-]+@sha256:[a-f0-9]{64}$ ]] || { echo 'Use an immutable image digest' >&2; exit 2; }
    ;;
  --local-image)
    # Recovery on an existing host can use an image transferred over pinned SSH.
    # Keep the same immutable identity and rollback checks without publishing it.
    [[ "$target" == staging && "$image" =~ ^sha256:[a-f0-9]{64}$ &&
       "${PANTOPUS_EXPECTED_REVISION:-}" =~ ^[a-f0-9]{40}$ ]] || {
      echo 'Local images require staging, a full image ID and an expected commit SHA' >&2; exit 2;
    }
    actual_revision=$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image")
    [[ "$actual_revision" == "$PANTOPUS_EXPECTED_REVISION" ]] || {
      echo 'Local image revision does not match the verified release' >&2; exit 2;
    }
    ;;
  *) echo 'Invalid image mode' >&2; exit 2 ;;
esac
env_file=${PANTOPUS_ENV_FILE:-$HOME/pantopus/.env.$suffix}
[[ -r "$env_file" ]] || { echo "Missing environment file: $env_file" >&2; exit 2; }
# Docker's default json-file driver never rotates, so container logs could fill
# the host disk. The local driver keeps five compressed 20 MB files per container.
log_options=(--log-driver local --log-opt max-size=20m --log-opt max-file=5)
health_attempts=${PANTOPUS_HEALTH_ATTEMPTS:-40}
health_interval=${PANTOPUS_HEALTH_INTERVAL:-3}
lock_dir=${PANTOPUS_LOCK_DIR:-$HOME/pantopus}

# Also serializes manual host invocations, independently of GitHub concurrency.
exec 9>"$lock_dir/deploy-$target.lock"
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
    # A restart during readiness means the process exited; the restart policy
    # would otherwise hide a crash loop until the readiness timeout.
    status=$(docker inspect --format '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}} {{.RestartCount}}' "$name") || return 1
    case "$status" in
      *' '[1-9]*) echo "$name restarted during readiness" >&2; return 1 ;;
      'running healthy '*) return 0 ;;
      'exited '*|'dead '*|'restarting '*|'running unhealthy '*) echo "$name failed readiness" >&2; return 1 ;;
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

# Every release pulls a new image, so remove this repository's release images
# that no container uses. Every container keeps its image: both targets' services
# and their stopped -previous release (the recovery path), and anything started
# by hand. Tagged images, images without a name (such as a --local-image load),
# other repositories and the release being deployed stay. Rollback Backend pulls
# an older release from the registry again.
prune_releases() {
  local reference tag id
  while read -r reference tag id; do
    [[ "$tag" == '<none>' && "${reference#*@}" != "${image#*@}" ]] || continue
    [[ -z "$(docker ps -aq --filter "ancestor=$id")" ]] || continue
    if docker image rm "$reference" >/dev/null; then echo "Removed unused release image $reference"; fi
  done < <(docker image ls --digests --no-trunc --format '{{.Repository}}@{{.Digest}} {{.Tag}} {{.ID}}' "${image%@*}")
}
# A pull unpacks each layer next to its compressed download. Rather than run out
# of disk partway, stop before the pull unless the disk holds twice the size of
# the release this target runs (2 GB on a first deployment).
require_free_space() {
  local current size root free inodes need
  docker image inspect "$image" >/dev/null 2>&1 && return 0 # Nothing to download.
  current=$(docker inspect --format '{{.Image}}' "$api" 2>/dev/null) &&
    size=$(docker image inspect --format '{{.Size}}' "$current") || size=$((1 << 30))
  root=$(docker info --format '{{.DockerRootDir}}')
  free=$(df -Pk "$root" | awk 'NR == 2 { print int($4 / 1024) }')
  # Shown, not checked: Docker can't say how many files a layer holds, and a
  # full inode table fails a pull the same way.
  inodes=$(df -Pi "$root" | awk 'NR == 2 { print $4 }')
  need=$(( (size * 2 + 1048575) / 1048576 ))
  if (( free < need )); then
    echo "Not enough disk space to pull $image: $free MB ($inodes inodes) free in $root, about $need MB needed. Free space on the host, then rerun." >&2
    exit 1
  fi
  echo "Disk: $free MB ($inodes inodes) free in $root; this pull needs about $need MB."
}

if [[ "$image_mode" == registry ]]; then
  # Both targets share the host's images, and a new release has no container
  # between its pull and its start. Each rollout holds this lock shared from its
  # pull until it exits, so cleanup never runs while another rollout is under
  # way. Lock the directory itself: on a full disk, creating a file can fail.
  exec 8<"$lock_dir"
  if flock -xn 8; then prune_releases; else echo 'Another rollout is under way; skipping image cleanup'; fi
  flock -s 8
  require_free_space
  docker pull "$image"
fi
# The candidate is unexposed and runs no background jobs. Verify DB readiness
# before interrupting the old API or worker, even on a first-ever deployment.
docker rm -f "$candidate" >/dev/null 2>&1 || true
docker run -d --name "$candidate" --env-file "$env_file" "${log_options[@]}" \
  -e NODE_ENV=production -e APP_ENV="$target" \
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
docker run -d --name "$api" --env-file "$env_file" "${log_options[@]}" \
  -e NODE_ENV=production -e APP_ENV="$target" \
  -e PGBOSS_ENABLED=false -e CRON_ENABLED=false \
  -p "$api_bind:8000" --restart unless-stopped \
  --health-cmd='node scripts/healthcheck.js' --health-interval=5s --health-start-period=20s \
  "$image" >/dev/null
healthy "$api"
worker_created=true
docker run -d --name "$worker" --env-file "$env_file" "${log_options[@]}" \
  -e NODE_ENV=production -e APP_ENV="$target" \
  -e PGBOSS_ENABLED=true -e CRON_ENABLED=true --restart unless-stopped \
  --health-cmd='node scripts/worker-healthcheck.js' --health-interval=5s --health-start-period=30s \
  "$image" node worker.js >/dev/null
healthy "$worker"
committed=true
printf 'Deployed %s to %s (API and worker).\n' "$image" "$target"
# Retain stopped previous containers and their images for incident recovery.
