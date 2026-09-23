#!/bin/zsh
# #242 milestone cleanup: exact ids of the rows created since 2026-09-23 04:32:03Z by the send probes (8 letters),
# their notifications and mail events, and the harness/web sessions. Keeps the Android owner session 75d186fb….
set -e
P=/private/tmp/pantopus-stream2-r06-runtime/psql.sh
W=/private/tmp/pantopus-stream2-r06-runtime/work
TS="2026-09-23 04:32:03+00"
MAILS="$(grep -E '^[0-9a-f-]{36}$' $W/s-sent-mail-ids.txt | sed "s/.*/'&'/" | paste -sd, -)"
KEEP="'75d186fb-ec7d-42d4-8d2c-6723cc651dd0'"
$P -qAt > $W/cleanup-ids-s.json <<SQL
select json_build_object(
 'Mail', (select coalesce(json_agg(id),'[]') from "Mail" where id in ($MAILS)),
 'MailLink', (select coalesce(json_agg(id),'[]') from "MailLink" where mail_item_id in ($MAILS)),
 'HomeBill', (select coalesce(json_agg(target_id),'[]') from "MailLink" where mail_item_id in ($MAILS) and target_type = 'bill'),
 'MailEvent', (select coalesce(json_agg(id),'[]') from "MailEvent" where created_at >= '$TS'),
 'Notification', (select coalesce(json_agg(id),'[]') from "Notification" where created_at >= '$TS'),
 'AuthSecurityEvent', (select coalesce(json_agg(id),'[]') from "AuthSecurityEvent" where created_at >= '$TS'),
 'AuthSession', (select coalesce(json_agg(id),'[]') from "AuthSession" where issued_at >= '$TS' and id not in ($KEEP)),
 'auth.sessions', (select coalesce(json_agg(id),'[]') from auth.sessions where created_at >= '$TS' and id not in ($KEEP)),
 'auth.audit_log_entries', (select coalesce(json_agg(id),'[]') from auth.audit_log_entries where created_at >= '$TS')
);
SQL
python3 -c "import json;d=json.load(open('$W/cleanup-ids-s.json'));print({k:len(v) for k,v in d.items()})"
python3 - <<'PY'
import json
W='/private/tmp/pantopus-stream2-r06-runtime/work'
d=json.load(open(W+'/cleanup-ids-s.json'))
q=lambda v: "'"+str(v).replace("'","''")+"'"
lst=lambda k: ','.join(q(x) for x in d[k]) or 'NULL'
o=['BEGIN;',
 f'DELETE FROM public."MailLink" WHERE id IN ({lst("MailLink")});',
 f'DELETE FROM public."HomeBill" WHERE id IN ({lst("HomeBill")});',
 f'DELETE FROM public."MailEvent" WHERE id IN ({lst("MailEvent")});',
 f'DELETE FROM public."Notification" WHERE id IN ({lst("Notification")});',
 f'DELETE FROM public."Mail" WHERE id IN ({lst("Mail")});',
 f'DELETE FROM public."AuthSecurityEvent" WHERE id IN ({lst("AuthSecurityEvent")});',
 f'DELETE FROM public."AuthSession" WHERE id IN ({lst("AuthSession")});',
 f'DELETE FROM auth.refresh_tokens WHERE session_id IN ({lst("auth.sessions")});',
 f'DELETE FROM auth.sessions WHERE id IN ({lst("auth.sessions")});',
 f'DELETE FROM auth.audit_log_entries WHERE id IN ({lst("auth.audit_log_entries")});',
 'COMMIT;']
open(W+'/cleanup-s.sql','w').write('\n'.join(o)+'\n')
PY
