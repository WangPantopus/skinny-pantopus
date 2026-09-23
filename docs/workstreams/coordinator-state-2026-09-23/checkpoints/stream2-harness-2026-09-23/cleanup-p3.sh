#!/bin/zsh
# Phase-3 privacy + D09 reader milestones cleanup: exact ids of every row created since the banner cleanup
# (T2 = 2026-09-23 02:30:30Z) plus the synthetic Mail rows (one is back-dated a year), keeping the Android
# app's owner session 75d186fb… (created before T2).
set -e
P=/private/tmp/pantopus-stream2-r06-runtime/psql.sh
W=/private/tmp/pantopus-stream2-r06-runtime/work
T2="2026-09-23 02:30:30+00"
OUT="'c9cfeea6-348f-4cfb-be32-58651af15532'"
MAILS="$(cat $W/probe-mail-ids.txt $W/d09-mail-ids.txt | grep -E '^[0-9a-f-]{36}$' | sed "s/.*/'&'/" | paste -sd, -)"
$P -qAt > $W/cleanup-ids-p3.json <<SQL
select json_build_object(
 'Mail', (select coalesce(json_agg(id),'[]') from "Mail" where id in ($MAILS)),
 'MailAssetLink', (select coalesce(json_agg(id),'[]') from "MailAssetLink" where mail_id in ($MAILS) or created_at >= '$T2'),
 'HomeAsset', (select coalesce(json_agg(id),'[]') from "HomeAsset" where created_at >= '$T2'),
 'HomeMapPin', (select coalesce(json_agg(id),'[]') from "HomeMapPin" where created_at >= '$T2'),
 'MailEvent', (select coalesce(json_agg(id),'[]') from "MailEvent" where created_at >= '$T2'),
 'HomeAuditLog', (select coalesce(json_agg(id),'[]') from "HomeAuditLog" where created_at >= '$T2'),
 'Notification', (select coalesce(json_agg(id),'[]') from "Notification" where created_at >= '$T2'),
 'AuthSecurityEvent', (select coalesce(json_agg(id),'[]') from "AuthSecurityEvent" where created_at >= '$T2' or user_id in ($OUT)),
 'AuthSession', (select coalesce(json_agg(id),'[]') from "AuthSession" where issued_at >= '$T2' or user_id in ($OUT)),
 'auth.sessions', (select coalesce(json_agg(id),'[]') from auth.sessions where created_at >= '$T2' or user_id in ($OUT)),
 'auth.audit_log_entries', (select coalesce(json_agg(id),'[]') from auth.audit_log_entries where created_at >= '$T2'),
 'AuthDevice', (select coalesce(json_agg(id),'[]') from "AuthDevice" where created_at >= '$T2' or user_id in ($OUT)),
 'MailPreferences', (select coalesce(json_agg(user_id),'[]') from "MailPreferences" where user_id in ($OUT)),
 'User', (select coalesce(json_agg(id),'[]') from "User" where id in ($OUT))
);
SQL
python3 -c "import json;d=json.load(open('$W/cleanup-ids-p3.json'));print({k:len(v) for k,v in d.items()})"
