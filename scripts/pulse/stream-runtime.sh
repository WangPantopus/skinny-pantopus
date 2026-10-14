#!/usr/bin/env bash
# One isolated local runtime per Pulse build stream: its own Supabase stack (own project name, own
# ports), so streams never share a database or collide on ports. Local development only.
#
#   scripts/pulse/stream-runtime.sh start  <stream> [--env backend/.env]
#   scripts/pulse/stream-runtime.sh stop   <stream>
#   scripts/pulse/stream-runtime.sh status <stream>
#
# Streams and port blocks (base B):  pb 55000 · pi 56000 · pa 57000 · ps 58000 · pc 59000 · pv 60000
#   B+0 shadow db · B+1 API · B+2 Postgres · B+3 studio (off) · B+4 mail inbox · B+7 analytics (off)
#   B+8 edge inspector (off) · B+9 pooler · B+100 backend (PORT) · B+101 web dev server
#
# The stack applies every migration under this checkout's supabase/migrations (symlinked, so your
# branch's migrations are what runs). Only the services the backend needs are started (about 450 MB
# idle; Supabase Realtime is off because nothing in this repo uses it: the apps' realtime is the
# backend's own Socket.IO). `--env` writes a
# backend .env (gitignored) pointing at this stack, with background jobs off and Stripe not required.
set -euo pipefail

cmd="${1:-}"; stream="${2:-}"; shift 2 || true
env_out=""
while [ $# -gt 0 ]; do
  case "$1" in
    --env) env_out="${2:-}"; shift 2 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

case "$stream" in
  pb) base=55000 ;; pi) base=56000 ;; pa) base=57000 ;;
  ps) base=58000 ;; pc) base=59000 ;; pv) base=60000 ;;
  *) echo "usage: $0 start|stop|status <pb|pi|pa|ps|pc|pv> [--env backend/.env]" >&2; exit 2 ;;
esac

root="$(git rev-parse --show-toplevel)"
rt="${PULSE_RUNTIME_ROOT:-$HOME/.config/pantopus}/pulse-$stream-runtime"
excluded="studio,imgproxy,edge-runtime,vector,logflare,postgres-meta,supavisor,realtime"

shadow=$base; api=$((base + 1)); db=$((base + 2)); studio=$((base + 3)); inbox=$((base + 4))
analytics=$((base + 7)); inspector=$((base + 8)); pooler=$((base + 9))
backend_port=$((base + 100)); web_port=$((base + 101))

prepare() {
  mkdir -p "$rt/supabase"
  sed -E \
    -e "s/^project_id = .*/project_id = \"pantopus-pulse-$stream\"/" \
    -e "s/^port = 54321$/port = $api/" \
    -e "s/^port = 54322$/port = $db/" \
    -e "s/^shadow_port = 54320$/shadow_port = $shadow/" \
    -e "s/^port = 54323$/port = $studio/" \
    -e "s/^port = 54324$/port = $inbox/" \
    -e "s/^port = 54327$/port = $analytics/" \
    -e "s/^inspector_port = 8083$/inspector_port = $inspector/" \
    -e "s/^port = 54329$/port = $pooler/" \
    "$root/supabase/config.toml" > "$rt/supabase/config.toml"
  ln -sfn "$root/supabase/migrations" "$rt/supabase/migrations"
}

write_env() {
  command -v supabase >/dev/null || { echo "supabase CLI not found" >&2; exit 1; }
  local values; values="$(supabase status --workdir "$rt" -o env 2>/dev/null)"
  get() { printf '%s\n' "$values" | sed -nE "s/^$1=\"?([^\"]*)\"?$/\1/p" | head -1; }
  umask 077
  cat > "$env_out" <<EOF
# Local development only, written by scripts/pulse/stream-runtime.sh ($stream). Gitignored.
SUPABASE_URL=$(get API_URL)
SUPABASE_ANON_KEY=$(get ANON_KEY)
SUPABASE_SERVICE_ROLE_KEY=$(get SERVICE_ROLE_KEY)
DATABASE_URL=$(get DB_URL)
JWT_SECRET=$(get JWT_SECRET)
NODE_ENV=development
APP_ENV=local
PORT=$backend_port
APP_URL=http://127.0.0.1:$web_port
AUTH_REDIRECT_URL=http://127.0.0.1:$web_port
CRON_ENABLED=false
PGBOSS_ENABLED=false
LAMBDA_BACKED_CRON_ENABLED=false
EOF
  echo "wrote $env_out (backend on port $backend_port; mail inbox at http://127.0.0.1:$inbox)"
}

case "$cmd" in
  start)
    docker info >/dev/null 2>&1 || { echo "Docker is not running. Start Docker Desktop first." >&2; exit 1; }
    prepare
    supabase start --workdir "$rt" -x "$excluded"
    [ -n "$env_out" ] && write_env
    echo "stream $stream: API http://127.0.0.1:$api · Postgres 127.0.0.1:$db · backend port $backend_port · web port $web_port"
    ;;
  stop)
    [ -d "$rt/supabase" ] || { echo "no runtime for $stream"; exit 0; }
    supabase stop --workdir "$rt"
    ;;
  status)
    [ -d "$rt/supabase" ] || { echo "no runtime for $stream"; exit 0; }
    supabase status --workdir "$rt" | sed -E 's/(key|secret|token)[^|]*\|.*/\1 <hidden>/I'
    ;;
  *)
    echo "usage: $0 start|stop|status <stream> [--env backend/.env]" >&2; exit 2 ;;
esac
