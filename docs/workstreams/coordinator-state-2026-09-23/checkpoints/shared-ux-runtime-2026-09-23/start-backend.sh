#!/bin/bash
# Shared UX backend on 18138 against the retained Stream 1 stack (PostgREST 64561 / SQL 64562). Read-mostly.
set -a
source /private/tmp/pantopus-stream1-wallet-read-r1/.keys.env
set +a
export SUPABASE_URL="$API_URL" SUPABASE_ANON_KEY="$ANON_KEY" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" DATABASE_URL="$DB_URL"
# Stripe TEST key only (read at runtime; never copied)
SK=$(grep -E '^STRIPE_SECRET_KEY=' /Users/yingpengwang/skinny-pantopus/backend/.env | head -1 | cut -d= -f2- | tr -d '"'"'")
case "$SK" in sk_test_*) export STRIPE_SECRET_KEY="$SK";; *) echo "refusing: not a Stripe TEST key"; exit 1;; esac
export PORT=18138 HOST=127.0.0.1 NODE_ENV=development PGBOSS_ENABLED=false CRON_ENABLED=false LAMBDA_BACKED_CRON_ENABLED=false
export APP_URL=http://sharedux.localhost:18139 APP_URLS=http://sharedux.localhost:18139
cd "${BACKEND_DIR:-/private/tmp/pantopus-shared-ux/backend}"
exec node ${NODE_PRELOAD:+-r $NODE_PRELOAD} app.js
