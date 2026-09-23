#!/bin/zsh
# D10 milestone cleanup: exact ids of every row created since T4 (2026-09-23 03:06:47Z): the two disposable users,
# the refused create-home command and its address event, notifications, map-pin mail events and harness sessions.
# The two fixture Homes were already deleted through the real web UI. Keeps the Android owner session 75d186fb….
set -e
P=/private/tmp/pantopus-stream2-r06-runtime/psql.sh
W=/private/tmp/pantopus-stream2-r06-runtime/work
T4="2026-09-23 03:06:47+00"
SYN="'23f1fd49-2c50-41c5-8adb-e225030e7abc','8df5e799-07dc-4625-bc48-dc03d767905b'"
$P -qAt > $W/cleanup-ids-d10.json <<SQL
select json_build_object(
 'HomeCreateCommand', (select coalesce(json_agg(json_build_array(actor_user_id, request_id)),'[]') from "HomeCreateCommand" where actor_user_id in ($SYN)),
 'AddressVerificationEvent', (select coalesce(json_agg(id),'[]') from "AddressVerificationEvent" where created_at >= '$T4'),
 'Notification', (select coalesce(json_agg(id),'[]') from "Notification" where created_at >= '$T4' or user_id in ($SYN)),
 'MailEvent', (select coalesce(json_agg(id),'[]') from "MailEvent" where created_at >= '$T4'),
 'MailPreferences', (select coalesce(json_agg(user_id),'[]') from "MailPreferences" where user_id in ($SYN)),
 'AuthDevice', (select coalesce(json_agg(id),'[]') from "AuthDevice" where created_at >= '$T4' or user_id in ($SYN)),
 'AuthSecurityEvent', (select coalesce(json_agg(id),'[]') from "AuthSecurityEvent" where created_at >= '$T4' or user_id in ($SYN)),
 'AuthSession', (select coalesce(json_agg(id),'[]') from "AuthSession" where issued_at >= '$T4' or user_id in ($SYN)),
 'auth.sessions', (select coalesce(json_agg(id),'[]') from auth.sessions where created_at >= '$T4' or user_id in ($SYN)),
 'auth.audit_log_entries', (select coalesce(json_agg(id),'[]') from auth.audit_log_entries where created_at >= '$T4'),
 'User', (select coalesce(json_agg(id),'[]') from "User" where id in ($SYN))
);
SQL
python3 -c "import json;d=json.load(open('$W/cleanup-ids-d10.json'));print({k:len(v) for k,v in d.items()})"
