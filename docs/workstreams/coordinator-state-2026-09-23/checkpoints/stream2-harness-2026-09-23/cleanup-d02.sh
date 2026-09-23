#!/bin/zsh
# D02 Mail Day settings milestone cleanup: exact ids of every row created since T3 (2026-09-23 02:56:11Z),
# including the two MailDaySettings rows the checks created for base fixture users; keeps the Android owner
# session 75d186fb… (created before T3).
set -e
P=/private/tmp/pantopus-stream2-r06-runtime/psql.sh
W=/private/tmp/pantopus-stream2-r06-runtime/work
T3="2026-09-23 02:56:11+00"
SYN="'0100b112-51c0-4d43-803e-b5ae2f8080da'"
$P -qAt > $W/cleanup-ids-d02.json <<SQL
select json_build_object(
 'MailDaySettings', (select coalesce(json_agg(user_id),'[]') from "MailDaySettings" where created_at >= '$T3' or user_id in ($SYN)),
 'MailEvent', (select coalesce(json_agg(id),'[]') from "MailEvent" where created_at >= '$T3'),
 'AuthDevice', (select coalesce(json_agg(id),'[]') from "AuthDevice" where created_at >= '$T3' or user_id in ($SYN)),
 'AuthSecurityEvent', (select coalesce(json_agg(id),'[]') from "AuthSecurityEvent" where created_at >= '$T3' or user_id in ($SYN)),
 'AuthSession', (select coalesce(json_agg(id),'[]') from "AuthSession" where issued_at >= '$T3' or user_id in ($SYN)),
 'auth.sessions', (select coalesce(json_agg(id),'[]') from auth.sessions where created_at >= '$T3' or user_id in ($SYN)),
 'auth.audit_log_entries', (select coalesce(json_agg(id),'[]') from auth.audit_log_entries where created_at >= '$T3'),
 'MailPreferences', (select coalesce(json_agg(user_id),'[]') from "MailPreferences" where user_id in ($SYN)),
 'Notification', (select coalesce(json_agg(id),'[]') from "Notification" where created_at >= '$T3'),
 'User', (select coalesce(json_agg(id),'[]') from "User" where id in ($SYN))
);
SQL
python3 -c "import json;d=json.load(open('$W/cleanup-ids-d02.json'));print({k:len(v) for k,v in d.items()})"
