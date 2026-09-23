#!/bin/bash
# mkuser.sh <handle> <First> <Last>  -> creates confirmed auth user + public.User row (sux_ prefix). Prints id.
set -e
H="$1"; FN="$2"; LN="$3"
source <(grep -E '^(API_URL|SERVICE_ROLE_KEY)=' /private/tmp/pantopus-stream1-wallet-read-r1/.keys.env)
PW=$(cat /private/tmp/pantopus-shared-ux-runtime/.fixture-password)
EMAIL="sux.${H}.0923@example.com"
ID=$(curl -s -X POST "$API_URL/auth/v1/admin/users" -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PW\",\"email_confirm\":true,\"user_metadata\":{\"first_name\":\"$FN\",\"last_name\":\"$LN\"}}" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("id",""))')
[ -n "$ID" ] || { echo "auth create failed"; exit 1; }
curl -s -X POST "$API_URL/rest/v1/User" -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H 'Content-Type: application/json' -H 'Prefer: return=minimal' \
  -d "{\"id\":\"$ID\",\"email\":\"$EMAIL\",\"username\":\"sux_$H\",\"first_name\":\"$FN\",\"last_name\":\"$LN\",\"name\":\"$FN $LN\",\"account_type\":\"individual\",\"verified\":false,\"role\":\"user\"}" -w '%{http_code}\n'
echo "$ID $EMAIL sux_$H $(date -u +%FT%TZ)" >> /private/tmp/pantopus-shared-ux-runtime/fixtures-users.txt
echo "$ID"
