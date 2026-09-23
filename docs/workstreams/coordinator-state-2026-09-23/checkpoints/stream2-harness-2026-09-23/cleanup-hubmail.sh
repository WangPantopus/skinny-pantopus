#!/bin/zsh
# Hub mail + memory-probe cleanup: exact ids of every row created since T7 (2026-09-23 03:18:12Z), keeping the
# Android owner session 75d186fb… (and its rotated refresh token).
set -e
P=/private/tmp/pantopus-stream2-r06-runtime/psql.sh
W=/private/tmp/pantopus-stream2-r06-runtime/work
T7="2026-09-23 03:18:12+00"
MAILS="$(grep -E '^[0-9a-f-]{36}$' $W/hubmail-mail-ids.txt | sed "s/.*/'&'/" | paste -sd, -)"
$P -qAt > $W/cleanup-ids-hubmail.json <<SQL
select json_build_object(
 'Mail', (select coalesce(json_agg(id),'[]') from "Mail" where id in ($MAILS)),
 'AuthSecurityEvent', (select coalesce(json_agg(id),'[]') from "AuthSecurityEvent" where created_at >= '$T7'),
 'AuthSession', (select coalesce(json_agg(id),'[]') from "AuthSession" where issued_at >= '$T7' and id::text not like '75d186fb%'),
 'auth.sessions', (select coalesce(json_agg(id),'[]') from auth.sessions where created_at >= '$T7' and id::text not like '75d186fb%'),
 'auth.audit_log_entries', (select coalesce(json_agg(id),'[]') from auth.audit_log_entries where created_at >= '$T7')
);
SQL
python3 -c "import json;d=json.load(open('$W/cleanup-ids-hubmail.json'));print({k:len(v) for k,v in d.items()})"
