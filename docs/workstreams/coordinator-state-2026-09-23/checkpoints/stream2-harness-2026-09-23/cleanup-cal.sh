#!/bin/zsh
# Hub Today calendar milestone cleanup: exact ids of every row created since T5 (2026-09-23 03:14:21Z). The Camas
# fixture Home (with its occupancies, ownership and household pickup rule) was already deleted through
# DELETE /api/homes/:id. Keeps the Android owner session 75d186fb….
set -e
P=/private/tmp/pantopus-stream2-r06-runtime/psql.sh
W=/private/tmp/pantopus-stream2-r06-runtime/work
T5="2026-09-23 03:14:21+00"
SYN="'db1ef503-ed14-4872-9b66-79b7689ccc4d','4d091d8d-66eb-4a5d-8cf8-5d0370d9aa79'"
$P -qAt > $W/cleanup-ids-cal.json <<SQL
select json_build_object(
 'ContextCache', (select coalesce(json_agg(id),'[]') from "ContextCache" where created_at >= '$T5'),
 'NeighborhoodProfileCache', (select coalesce(json_agg(id),'[]') from "NeighborhoodProfileCache" where created_at >= '$T5'),
 'Notification', (select coalesce(json_agg(id),'[]') from "Notification" where created_at >= '$T5' or user_id in ($SYN)),
 'MailPreferences', (select coalesce(json_agg(user_id),'[]') from "MailPreferences" where user_id in ($SYN)),
 'AuthDevice', (select coalesce(json_agg(id),'[]') from "AuthDevice" where created_at >= '$T5' or user_id in ($SYN)),
 'AuthSecurityEvent', (select coalesce(json_agg(id),'[]') from "AuthSecurityEvent" where created_at >= '$T5' or user_id in ($SYN)),
 'AuthSession', (select coalesce(json_agg(id),'[]') from "AuthSession" where issued_at >= '$T5' or user_id in ($SYN)),
 'auth.sessions', (select coalesce(json_agg(id),'[]') from auth.sessions where created_at >= '$T5' or user_id in ($SYN)),
 'auth.audit_log_entries', (select coalesce(json_agg(id),'[]') from auth.audit_log_entries where created_at >= '$T5'),
 'User', (select coalesce(json_agg(id),'[]') from "User" where id in ($SYN))
);
SQL
python3 -c "import json;d=json.load(open('$W/cleanup-ids-cal.json'));print({k:len(v) for k,v in d.items()})"
