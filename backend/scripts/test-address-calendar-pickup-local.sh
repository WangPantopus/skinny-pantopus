#!/usr/bin/env bash
# Disposable local PostgreSQL container. No existing database or .env is read.
set -euo pipefail
calendar_root="$(cd "$(dirname "$0")/.." && pwd)"
case "$(docker context inspect --format '{{.Endpoints.docker.Host}}')" in
  unix://*) ;;
  *) echo 'This test requires a local Docker context.' >&2; exit 1 ;;
esac
calendar_container="$(docker run -d --rm --network none \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  -v "$calendar_root/database/migrations:/migrations:ro" \
  -v "$calendar_root/tests/sql:/tests:ro" postgres:17-alpine)"
trap 'docker rm -f "$calendar_container" >/dev/null 2>&1 || true' EXIT
calendar_ready=false
for calendar_attempt in {1..30}; do
  if docker exec "$calendar_container" pg_isready -U postgres >/dev/null 2>&1; then
    calendar_ready=true; break
  fi
  sleep 1
done
if [ "$calendar_ready" != true ]; then
  docker logs "$calendar_container"; exit 1
fi
calendar_psql=(docker exec "$calendar_container" psql -X -v ON_ERROR_STOP=1 -U postgres)
"${calendar_psql[@]}" -c 'CREATE ROLE service_role; CREATE ROLE anon; CREATE ROLE authenticated;' >/dev/null
"${calendar_psql[@]}" -f /migrations/195_address_calendar_rules.sql >/dev/null
"${calendar_psql[@]}" -f /migrations/199_address_calendar_pickup_swap.sql >/dev/null
"${calendar_psql[@]}" -f /tests/address-calendar-pickup.sql
