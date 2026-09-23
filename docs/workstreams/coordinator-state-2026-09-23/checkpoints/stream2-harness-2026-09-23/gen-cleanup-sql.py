import json,sys
d=json.load(open('/private/tmp/pantopus-stream2-r06-runtime/work/cleanup-ids-hub.json'))
q=lambda v: "'"+str(v).replace("'","''")+"'"
lst=lambda k: ','.join(q(x) for x in d[k]) or 'NULL'
out=['BEGIN;']
out.append(f'DELETE FROM public."ResidencyClaimAccess" WHERE id IN ({lst("ResidencyClaimAccess")});')
out.append(f'DELETE FROM public."ResidencyClaim" WHERE id IN ({lst("ResidencyClaim")});')
out.append(f'DELETE FROM public."ResidencyLetter" WHERE id IN ({lst("ResidencyLetter")});')
out.append(f'DELETE FROM public."Notification" WHERE id IN ({lst("Notification")});')
out.append(f'DELETE FROM public."HomeAuditLog" WHERE id IN ({lst("HomeAuditLog")});')
for a,r in d['HomeMemberRemovalCommand']:
    out.append(f'DELETE FROM public."HomeMemberRemovalCommand" WHERE actor_user_id={q(a)} AND request_id={q(r)};')
out.append(f'DELETE FROM public."HomeInvite" WHERE id IN ({lst("HomeInvite")});')
out.append(f'DELETE FROM public."HomeOccupancy" WHERE id IN ({lst("HomeOccupancy")});')
out.append(f'DELETE FROM public."MailPreferences" WHERE user_id IN ({lst("MailPreferences")});')
out.append(f'DELETE FROM public."AuthDevice" WHERE id IN ({lst("AuthDevice")});')
out.append(f'DELETE FROM public."AuthSecurityEvent" WHERE id IN ({lst("AuthSecurityEvent")});')
out.append(f'DELETE FROM public."AuthSession" WHERE id IN ({lst("AuthSession")});')
out.append(f'DELETE FROM auth.sessions WHERE id IN ({lst("AuthSession")});')
out.append(f'DELETE FROM auth.audit_log_entries WHERE id IN ({lst("auth.audit_log_entries")});')
out.append(f'DELETE FROM public."User" WHERE id IN ({lst("User")});')
out.append(f'DELETE FROM auth.users WHERE id IN ({lst("User")});')
out.append('COMMIT;')
print('\n'.join(out))
