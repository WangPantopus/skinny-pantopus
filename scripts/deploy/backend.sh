#!/usr/bin/env bash
# Runs on the EC2 host. Deploy and rollback use this same transaction.
set -Eeuo pipefail

target=${1:?Usage: backend.sh staging|production repository@sha256:digest [host-bind] [--local-image]}
image=${2:?An immutable image digest is required}
api_bind=${3:-8000}
image_mode=${4:-registry}
[[ "$api_bind" =~ ^((127\.0\.0\.1|0\.0\.0\.0):)?([1-9][0-9]{0,4})$ ]] &&
  (( BASH_REMATCH[3] <= 65535 )) || { echo 'Invalid API host binding' >&2; exit 2; }
api_port=${BASH_REMATCH[3]}
# The target's proxy listens on the binding; each release's API takes the loopback
# port the live one doesn't use.
api_ports=($((api_port + 100)) $((api_port + 200)))
(( api_ports[1] <= 65535 )) || { echo 'Invalid API host binding' >&2; exit 2; }
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
# The API and worker need none of the Linux capabilities Docker grants by default (changing file owners,
# raw sockets, binding low ports...) and never gain privileges through a setuid binary: they listen on
# 8000 and write only under /tmp. This holds for an earlier release image too, whose process is root:
# without capabilities it still reads its own files and writes /tmp. The proxy already runs this way.
confine_options=(--cap-drop ALL --security-opt no-new-privileges)
health_attempts=${PANTOPUS_HEALTH_ATTEMPTS:-40}
health_interval=${PANTOPUS_HEALTH_INTERVAL:-3}
lock_dir=${PANTOPUS_LOCK_DIR:-$HOME/pantopus}

# Also serializes manual host invocations, independently of GitHub concurrency.
exec 9>"$lock_dir/deploy-$target.lock"
flock -n 9 || { echo 'Another rollout holds the host lock' >&2; exit 1; }

next=$api-next
proxy=$api-proxy
api_backup=$api-previous
worker_backup=$worker-previous
# Pinned like the release image. A TCP proxy passes requests through unchanged.
proxy_image=nginx:1.30.6-alpine-slim@sha256:dede8895648b461178c3bc604f7eed4423efe5220b2c4d839f5eb3d34ac3f8f7
proxy_dir=$lock_dir/proxy-$target
next_created=false
next_renamed=false
api_saved=false
legacy_stopped=false
proxy_created=false
old_proxy_image=
routed=false
worker_saved=false
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
# The host port a container publishes the API on.
published_port() {
  docker inspect --format '{{with index .HostConfig.PortBindings "8000/tcp"}}{{(index . 0).HostPort}}{{end}}' "$1" 2>/dev/null
}
# The proxy (unprivileged nginx) reads this; it names the API port that new
# connections go to.
write_proxy_config() {
  mkdir -p "$proxy_dir" && chmod 755 "$proxy_dir" || return 1
  cat > "$proxy_dir/nginx.conf.new" <<EOF || return 1
# Written by scripts/deploy/backend.sh on each release.
daemon off;
worker_processes 1;
worker_shutdown_timeout 10m;
pid /tmp/nginx.pid;
error_log stderr notice;
events { worker_connections 4096; }
stream {
  # Logs only connections that failed.
  map \$status \$failed { 200 0; default 1; }
  log_format failed '\$time_iso8601 \$remote_addr \$status \$upstream_addr \$session_time';
  access_log /dev/stdout failed if=\$failed;
  server {
    listen $api_bind;
    proxy_pass 127.0.0.1:$1;
    proxy_connect_timeout 5s;
    proxy_timeout 1h;
  }
}
EOF
  chmod 644 "$proxy_dir/nginx.conf.new" && mv "$proxy_dir/nginx.conf.new" "$proxy_dir/nginx.conf"
}
start_proxy() {
  docker run -d --name "$proxy" --network host --restart unless-stopped "${log_options[@]}" \
    --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges --user 101:101 \
    -v "$proxy_dir:/etc/pantopus-proxy:ro" --entrypoint nginx \
    "$1" -c /etc/pantopus-proxy/nginx.conf >/dev/null
}
# A request through the target's port must reach a ready API.
probe() {
  local attempt
  for ((attempt=1; attempt<=5; attempt++)); do
    docker exec "$proxy" wget -q -T 5 -O /dev/null "http://127.0.0.1:$api_port/health" && return 0
    sleep 1
  done
  echo "$proxy does not reach a ready API" >&2
  return 1
}
# PIDs of the proxy's nginx workers that accept connections. A worker told to
# stop closes its listening sockets and renames itself "... is shutting down".
proxy_workers() {
  docker exec "$proxy" sh -c 'for p in /proc/[0-9]*; do
    [ "$(tr "\0" "\n" < "$p/cmdline" | head -n 1)" = "nginx: worker process" ] && echo "${p#/proc/}"
  done 2>/dev/null; true' | tr '\n' ' '
}
reloaded() {
  local now pid
  now=" $(proxy_workers) "
  [[ "$now" =~ [0-9] ]] || return 1
  for pid in $1; do [[ "$now" != *" $pid "* ]] || return 1; done
}
# Sends new connections to another API port. nginx starts new workers with the
# new configuration; the old ones finish the connections they already carry.
# Reload through exec: a signal sent with docker kill marks the container as
# stopped by hand, and Docker would then not restart it after a host reboot.
route() {
  local before attempt
  write_proxy_config "$1" || return 1
  docker exec "$proxy" nginx -t -q -c /etc/pantopus-proxy/nginx.conf || return 1
  before=$(proxy_workers) && docker exec "$proxy" nginx -s reload -c /etc/pantopus-proxy/nginx.conf || return 1
  for ((attempt=1; attempt<=50; attempt++)); do
    if reloaded "$before"; then probe; return; fi
    sleep 0.2
  done
  echo "$proxy did not reload" >&2
  return 1
}
cleanup() {
  local status=$? recovery_failed=false
  trap - EXIT
  set +e
  if [[ "$committed" != true ]]; then
    # Send new connections back to the old API before removing the new one.
    if [[ "$routed" == true ]]; then route "$live_port" || recovery_failed=true; fi
    if [[ "$proxy_created" == true ]]; then
      docker rm -f "$proxy" >/dev/null 2>&1
      if [[ -n "$old_proxy_image" ]]; then
        write_proxy_config "$live_port" && start_proxy "$old_proxy_image" && probe || recovery_failed=true
      fi
    fi
    if [[ "$next_renamed" == true ]]; then docker rename "$api" "$next" || recovery_failed=true; fi
    if [[ "$api_saved" == true ]]; then docker rename "$api_backup" "$api" || recovery_failed=true; fi
    # Stop the new worker before restoring any old embedded queue consumers.
    if [[ "$worker_created" == true ]]; then docker rm -f "$worker" >/dev/null || recovery_failed=true; fi
    if [[ "$next_created" == true ]]; then docker rm -f "$next" >/dev/null || recovery_failed=true; fi
    if [[ "$legacy_stopped" == true ]]; then
      docker start "$api" >/dev/null && healthy "$api" || recovery_failed=true
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
docker image inspect "$proxy_image" >/dev/null 2>&1 || docker pull "$proxy_image"

live_port=$(published_port "$api") || live_port=
new_port=${api_ports[0]}
[[ "$live_port" != "$new_port" ]] || new_port=${api_ports[1]}
# The new API starts beside the live one, reachable only on its loopback port and
# with background jobs disabled. Verify DB readiness before interrupting the old
# API or worker, even on a first-ever deployment.
docker rm -f "$next" >/dev/null 2>&1 || true
# Set created before docker run: Docker can create a container and then fail
# while binding its port. Recovery must remove that partial container too.
next_created=true
docker run -d --name "$next" --env-file "$env_file" "${log_options[@]}" "${confine_options[@]}" \
  -e NODE_ENV=production -e APP_ENV="$target" \
  -e PGBOSS_ENABLED=false -e CRON_ENABLED=false \
  -p "127.0.0.1:$new_port:8000" --restart unless-stopped \
  --health-cmd='node scripts/healthcheck.js' --health-interval=5s --health-start-period=20s \
  "$image" >/dev/null
healthy "$next"

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
# Replace the worker first, so the old worker never takes jobs from the new API.
if exists "$worker"; then
  docker rename "$worker" "$worker_backup"
  worker_saved=true
  docker stop --time 30 "$worker_backup" >/dev/null
fi
worker_created=true
docker run -d --name "$worker" --env-file "$env_file" "${log_options[@]}" "${confine_options[@]}" \
  -e NODE_ENV=production -e APP_ENV="$target" \
  -e PGBOSS_ENABLED=true -e CRON_ENABLED=true --restart unless-stopped \
  --health-cmd='node scripts/worker-healthcheck.js' --health-interval=5s --health-start-period=30s \
  "$image" node worker.js >/dev/null
healthy "$worker"

# The old API keeps serving until the proxy sends new connections to the new one.
if exists "$api"; then
  docker rename "$api" "$api_backup"
  api_saved=true
fi
docker rename "$next" "$api"
next_renamed=true
proxy_state=$(docker inspect --format '{{.State.Running}} {{.Config.Image}}' "$proxy" 2>/dev/null) || proxy_state=
if [[ "$proxy_state" == "true "*"@${proxy_image#*@}" ]]; then
  routed=true
  route "$new_port"
else
  # Start the proxy: the first release behind it, or it was stopped or runs
  # another image. Before the proxy, the API published the target's port itself.
  if [[ -n "$proxy_state" ]]; then
    old_proxy_image=${proxy_state#* }
    proxy_created=true
    docker rm -f "$proxy" >/dev/null
  fi
  if [[ "$live_port" == "$api_port" ]]; then
    legacy_stopped=true
    docker stop --time 75 "$api_backup" >/dev/null
  fi
  write_proxy_config "$new_port"
  proxy_created=true
  start_proxy "$proxy_image"
  probe
fi
committed=true
# The old API finishes the requests it has (app.js allows them 60 s), then stops.
# Retain stopped previous containers and their images for incident recovery.
if [[ "$legacy_stopped" != true ]] && exists "$api_backup"; then
  docker stop --time 75 "$api_backup" >/dev/null
fi
printf 'Deployed %s to %s (API and worker).\n' "$image" "$target"
