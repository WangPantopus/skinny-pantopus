#!/bin/zsh
# R06 web/API milestone cleanup: capture exact ids of every row this run created, then delete exactly those.
set -e
P=/private/tmp/pantopus-stream2-r06-runtime/psql.sh
W=/private/tmp/pantopus-stream2-r06-runtime/work
T0="2026-09-22 23:50:00+00"
SYN="'48d33af4-7cf9-4f66-8aa0-03f397545beb','a93c1c2c-e18f-483b-99e1-3481c0428e97','b62bc162-482d-41b4-b723-bc0d3be3a60d','8b8a626c-f42e-4e12-9609-577b388c0afb','9cbc42a4-692c-4ffe-8ae1-69aedfeccbbe'"
HOME="'f0e51100-0000-4000-8000-000000000200'"
$P -qAt > $W/cleanup-ids-r1.json <<SQL
select json_build_object(
 'ResidencyLetter', (select coalesce(json_agg(id order by issued_at),'[]') from "ResidencyLetter" where home_id=$HOME and issued_at >= '$T0'),
 'HomeOccupancy', (select coalesce(json_agg(id),'[]') from "HomeOccupancy" where user_id in ($SYN)),
 'HomeInvite', (select coalesce(json_agg(id),'[]') from "HomeInvite" where invitee_user_id in ($SYN)),
 'HomeAuditLog', (select coalesce(json_agg(id),'[]') from "HomeAuditLog" where home_id=$HOME and created_at >= '$T0'),
 'Notification', (select coalesce(json_agg(id),'[]') from "Notification" where created_at >= '$T0'),
 'HomeResidencySubmissionCommand', (select coalesce(json_agg(json_build_array(actor_user_id,request_id)),'[]') from "HomeResidencySubmissionCommand" where actor_user_id in ($SYN)),
 'HomeMemberRemovalCommand', (select coalesce(json_agg(json_build_array(actor_user_id,request_id)),'[]') from "HomeMemberRemovalCommand" where target_user_id in ($SYN)),
 'MailPreferences', (select coalesce(json_agg(user_id),'[]') from "MailPreferences" where user_id in ($SYN)),
 'AuthSecurityEvent', (select coalesce(json_agg(id),'[]') from "AuthSecurityEvent" where created_at >= '$T0' and user_agent like 'stream2-r06-%'),
 'AuthSession', (select coalesce(json_agg(id),'[]') from "AuthSession" where issued_at >= '$T0' and user_agent like 'stream2-r06-%'),
 'auth.audit_log_entries', (select coalesce(json_agg(id),'[]') from auth.audit_log_entries where created_at >= '$T0'),
 'User', (select coalesce(json_agg(id),'[]') from "User" where id in ($SYN))
);
SQL
python3 -c "import json;d=json.load(open('$W/cleanup-ids-r1.json'));print({k:len(v) for k,v in d.items()})"
