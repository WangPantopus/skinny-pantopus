#!/bin/zsh
# R06 native/role-guard milestone cleanup: capture exact ids of every row created since the r1 cleanup, then delete them.
set -e
P=/private/tmp/pantopus-stream2-r06-runtime/psql.sh
W=/private/tmp/pantopus-stream2-r06-runtime/work
T1="2026-09-23 00:21:00+00"
SYN="'13e9d4ce-1ced-4bf1-bcbe-3f356ab65d72','c4d047d7-7c9b-4a20-a6d7-93d527018f97','086d81e3-8acb-42d6-b3bf-18f856e5f92b','57c221ea-9b76-41d9-9bb9-83c1b0a9cecc'"
HOME="'f0e51100-0000-4000-8000-000000000200'"
$P -qAt > $W/cleanup-ids-r2.json <<SQL
select json_build_object(
 'ResidencyLetter', (select coalesce(json_agg(id order by issued_at),'[]') from "ResidencyLetter" where home_id=$HOME and issued_at >= '$T1'),
 'ResidencyClaim', (select coalesce(json_agg(id order by issued_at),'[]') from "ResidencyClaim" where home_id=$HOME and issued_at >= '$T1'),
 'ResidencyClaimAccess', (select coalesce(json_agg(a.id),'[]') from "ResidencyClaimAccess" a join "ResidencyClaim" c on c.id=a.claim_id where c.home_id=$HOME and c.issued_at >= '$T1'),
 'HomeOccupancy', (select coalesce(json_agg(id),'[]') from "HomeOccupancy" where user_id in ($SYN)),
 'HomeInvite', (select coalesce(json_agg(id),'[]') from "HomeInvite" where invitee_user_id in ($SYN)),
 'HomeAuditLog', (select coalesce(json_agg(id),'[]') from "HomeAuditLog" where home_id=$HOME and created_at >= '$T1'),
 'Notification', (select coalesce(json_agg(id),'[]') from "Notification" where created_at >= '$T1'),
 'HomeMemberRemovalCommand', (select coalesce(json_agg(json_build_array(actor_user_id,request_id)),'[]') from "HomeMemberRemovalCommand" where target_user_id in ($SYN)),
 'MailPreferences', (select coalesce(json_agg(user_id),'[]') from "MailPreferences" where user_id in ($SYN)),
 'AuthDevice', (select coalesce(json_agg(id),'[]') from "AuthDevice" where user_id in ($SYN)),
 'AuthSecurityEvent', (select coalesce(json_agg(id),'[]') from "AuthSecurityEvent" where created_at >= '$T1' and (user_id in ($SYN) or user_agent like 'stream2-r06-%')),
 'AuthSession', (select coalesce(json_agg(id),'[]') from "AuthSession" where issued_at >= '$T1' and (user_id in ($SYN) or user_agent like 'stream2-r06-%')),
 'auth.audit_log_entries', (select coalesce(json_agg(id),'[]') from auth.audit_log_entries where created_at >= '$T1'),
 'User', (select coalesce(json_agg(id),'[]') from "User" where id in ($SYN))
);
SQL
python3 -c "import json;d=json.load(open('$W/cleanup-ids-r2.json'));print({k:len(v) for k,v in d.items()})"
