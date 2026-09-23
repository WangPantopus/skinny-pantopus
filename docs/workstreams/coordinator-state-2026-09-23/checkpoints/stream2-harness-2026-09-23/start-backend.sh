#!/bin/zsh
# Starts the retained Stream 2 backend (checkout given as $1) on 127.0.0.1:18143 against SQL 64554.
# Paid/external provider keys are blanked so synthetic journeys cannot reach real providers.
set -e
SRC=${1:-/private/tmp/pantopus-stream2-backend-latest}
RT=/private/tmp/pantopus-stream2-r06-runtime
set -a; source /private/tmp/pantopus-workstream-home/.stream2-verification/native/supabase.env; set +a
cd $SRC/backend
env SUPABASE_URL=$API_URL SUPABASE_ANON_KEY=$ANON_KEY SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY \
  SUPABASE_JWT_SECRET=$JWT_SECRET JWT_SECRET=$JWT_SECRET DATABASE_URL=$DB_URL PORT=18143 HOST=127.0.0.1 \
  APP_URLS=http://127.0.0.1:18144,http://localhost:18144 PGBOSS_ENABLED=false CRON_ENABLED=false LAMBDA_BACKED_CRON_ENABLED=false \
  TWILIO_ACCOUNT_SID= TWILIO_AUTH_TOKEN= TWILIO_PHONE_NUMBER= STRIPE_SECRET_KEY=sk_test_stream2_offline_placeholder OPENAI_API_KEY= LOB_API_KEY= \
  ATTOM_API_KEY= SMARTY_AUTH_ID= SMARTY_AUTH_TOKEN= GOOGLE_ADDRESS_VALIDATION_API_KEY= GOOGLE_PLACES_API_KEY= \
  MAPBOX_ACCESS_TOKEN= SMTP_HOST= SMTP_USER= SMTP_PASS= AWS_ACCESS_KEY_ID= AWS_SECRET_ACCESS_KEY= \
  nohup node app.js >> $RT/backend-18143.log 2>&1 &
echo $! > $RT/backend.pid
