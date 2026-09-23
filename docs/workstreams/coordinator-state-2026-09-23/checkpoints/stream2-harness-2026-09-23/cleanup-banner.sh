#!/bin/zsh
# Banner + hub-gate milestones cleanup: capture exact ids of every row created since the hub cleanup (T0),
# keeping only the Android app's current owner session (75d186fb…).
set -e
P=/private/tmp/pantopus-stream2-r06-runtime/psql.sh
W=/private/tmp/pantopus-stream2-r06-runtime/work
T0="2026-09-23 01:42:00+00"
SYN="'308747db-6ddc-49ee-be07-97030559bc27','272a980c-e62d-4b8a-8194-c08ac195d179'"
HOME="'f0e51100-0000-4000-8000-000000000200'"
KEEP="(select id from auth.sessions where id::text like '75d186fb%' and user_id='3d61b2c3-d767-458a-82ff-a63c5c85da99')"
$P -qAt > $W/cleanup-ids-banner.json <<SQL
select json_build_object(
 'kept_session', (select coalesce(json_agg(id),'[]') from $KEEP s),
 'HomeResidencyClaim', (select coalesce(json_agg(id),'[]') from "HomeResidencyClaim" where user_id in ($SYN)),
 'HomeResidencySubmissionCommand', (select coalesce(json_agg(json_build_array(actor_user_id, request_id)),'[]') from "HomeResidencySubmissionCommand" where actor_user_id in ($SYN)),
 'HomeOccupancy', (select coalesce(json_agg(id),'[]') from "HomeOccupancy" where user_id in ($SYN)),
 'HomeInvite', (select coalesce(json_agg(id),'[]') from "HomeInvite" where invitee_user_id in ($SYN) or accepted_by_user_id in ($SYN)),
 'HomeAuditLog', (select coalesce(json_agg(id),'[]') from "HomeAuditLog" where home_id=$HOME and created_at >= '$T0'),
 'Notification', (select coalesce(json_agg(id),'[]') from "Notification" where created_at >= '$T0'),
 'MailPreferences', (select coalesce(json_agg(user_id),'[]') from "MailPreferences" where user_id in ($SYN)),
 'UserPublicProfile', (select coalesce(json_agg(id),'[]') from "UserPublicProfile" where id in ($SYN)),
 'UserPaymentSummary', (select coalesce(json_agg(user_id),'[]') from "UserPaymentSummary" where user_id in ($SYN)),
 'AuthDevice', (select coalesce(json_agg(id),'[]') from "AuthDevice" where user_id in ($SYN) or created_at >= '$T0'),
 'AuthSecurityEvent', (select coalesce(json_agg(id),'[]') from "AuthSecurityEvent" where created_at >= '$T0' or user_id in ($SYN)),
 'AuthSession', (select coalesce(json_agg(id),'[]') from "AuthSession" where (issued_at >= '$T0' or user_id in ($SYN)) and id not in (select id from $KEEP k)),
 'auth.sessions', (select coalesce(json_agg(id),'[]') from auth.sessions where (created_at >= '$T0' or user_id in ($SYN)) and id not in (select id from $KEEP k)),
 'auth.audit_log_entries', (select coalesce(json_agg(id),'[]') from auth.audit_log_entries where created_at >= '$T0'),
 'User', (select coalesce(json_agg(id),'[]') from "User" where id in ($SYN))
);
SQL
python3 -c "import json;d=json.load(open('$W/cleanup-ids-banner.json'));print({k:len(v) for k,v in d.items()})"
