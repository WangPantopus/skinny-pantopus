#!/bin/zsh
# Milestone cleanup for #233 / #234 / #239 (M01 + v2 per-item access): exact ids of every row created since
# T8 (2026-09-23 03:24:37Z) by the probes, the two disposable users (m01outsider, xmember) and harness/web/iOS
# sessions. Keeps the Android owner session 75d186fb… (created 02:12Z) and its rotated refresh token.
set -e
P=/private/tmp/pantopus-stream2-r06-runtime/psql.sh
W=/private/tmp/pantopus-stream2-r06-runtime/work
T8="2026-09-23 03:24:37+00"
SYN="'c75d24fc-2af2-476d-9cca-262a8b868281','971d5c92-cb5d-4e33-aa23-a0f2d00a01b7'"
KEEP="'75d186fb-ec7d-42d4-8d2c-6723cc651dd0'"
$P -qAt > $W/cleanup-ids-y.json <<SQL
with m as (select id from "Mail" where created_at >= '$T8' and subject like 'Stream2 %')
select json_build_object(
 'Mail', (select coalesce(json_agg(id),'[]') from m),
 'MailPackage', (select coalesce(json_agg(id),'[]') from "MailPackage" where mail_id in (select id from m)),
 'PackageEvent', (select coalesce(json_agg(id),'[]') from "PackageEvent" where package_id in (select id from "MailPackage" where mail_id in (select id from m))),
 'BookletPage', (select coalesce(json_agg(id),'[]') from "BookletPage" where mail_id in (select id from m)),
 'MailLink', (select coalesce(json_agg(id),'[]') from "MailLink" where mail_item_id in (select id from m)),
 'HomeBill', (select coalesce(json_agg(target_id),'[]') from "MailLink" where mail_item_id in (select id from m) and target_type = 'bill'),
 'MailRoutingQueue', (select coalesce(json_agg(id),'[]') from "MailRoutingQueue" where mail_id in (select id from m)),
 'MailDayItem', (select coalesce(json_agg(id),'[]') from "MailDayItem" where created_at >= '$T8' or mail_id in (select id from m)),
 'MailPartySession', (select coalesce(json_agg(id),'[]') from "MailPartySession" where created_at >= '$T8' or mail_id in (select id from m)),
 'MailPartyParticipant', (select coalesce(json_agg(id),'[]') from "MailPartyParticipant" where session_id in (select id from "MailPartySession" where created_at >= '$T8' or mail_id in (select id from m))),
 'HomeMapPin', (select coalesce(json_agg(id),'[]') from "HomeMapPin" where created_at >= '$T8'),
 'MailEvent', (select coalesce(json_agg(id),'[]') from "MailEvent" where created_at >= '$T8'),
 'Notification', (select coalesce(json_agg(id),'[]') from "Notification" where created_at >= '$T8' or user_id in ($SYN)),
 'VaultFolder', (select coalesce(json_agg(id),'[]') from "VaultFolder" where created_at >= '$T8'),
 'HomeAuditLog', (select coalesce(json_agg(id),'[]') from "HomeAuditLog" where created_at >= '$T8'),
 'HomeInvite', (select coalesce(json_agg(id),'[]') from "HomeInvite" where created_at >= '$T8'),
 'HomeOccupancy', (select coalesce(json_agg(id),'[]') from "HomeOccupancy" where created_at >= '$T8' and user_id in ($SYN)),
 'MailPreferences', (select coalesce(json_agg(user_id),'[]') from "MailPreferences" where user_id in ($SYN)),
 'AuthDevice', (select coalesce(json_agg(id),'[]') from "AuthDevice" where created_at >= '$T8' or user_id in ($SYN)),
 'AuthSecurityEvent', (select coalesce(json_agg(id),'[]') from "AuthSecurityEvent" where created_at >= '$T8' or user_id in ($SYN)),
 'AuthSession', (select coalesce(json_agg(id),'[]') from "AuthSession" where (issued_at >= '$T8' or user_id in ($SYN)) and id not in ($KEEP)),
 'auth.sessions', (select coalesce(json_agg(id),'[]') from auth.sessions where (created_at >= '$T8' or user_id in ($SYN)) and id not in ($KEEP)),
 'auth.audit_log_entries', (select coalesce(json_agg(id),'[]') from auth.audit_log_entries where created_at >= '$T8'),
 'User', (select coalesce(json_agg(id),'[]') from "User" where id in ($SYN))
);
SQL
python3 -c "import json;d=json.load(open('$W/cleanup-ids-y.json'));print({k:len(v) for k,v in d.items()})"
