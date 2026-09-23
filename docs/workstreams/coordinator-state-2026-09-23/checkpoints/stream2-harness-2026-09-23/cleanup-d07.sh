#!/bin/zsh
# R06 native/role-guard milestone cleanup: capture exact ids of every row created since the r1 cleanup, then delete them.
set -e
P=/private/tmp/pantopus-stream2-r06-runtime/psql.sh
W=/private/tmp/pantopus-stream2-r06-runtime/work
T1="2026-09-23 01:19:00+00"
SYN="'7b45274b-ec6d-4793-b659-964258341e02','30c40671-4395-4ef8-afc2-84ab0333750b','94016585-b8a9-479d-8829-4e559d133ff5','6e3548be-d321-425f-9608-89c0e28bd749'"
HOME="'f0e51100-0000-4000-8000-000000000200'"
$P -qAt > $W/cleanup-ids-d07.json <<SQL
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
python3 -c "import json;d=json.load(open('$W/cleanup-ids-d07.json'));print({k:len(v) for k,v in d.items()})"
