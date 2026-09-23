#!/bin/zsh
# Deletes synthetic letters by exact id (one uuid per line in the given file), with their MailEvent, MailDayItem and
# Notification rows (Notification matched by the mail id in its link or metadata); other tables cascade.
# Usage: cleanup-letters.sh <label> <ids-file>
set -e
cd /private/tmp/pantopus-stream2-r06-runtime
L=$1; F=$2
IDS=$(grep -E '^[0-9a-f-]{36}$' $F | sort -u)
LIST=$(echo "$IDS" | sed "s/.*/'&'/" | paste -sd, -)
RX=$(echo "$IDS" | paste -sd'|' -)
q() { ./psql.sh -Atc "$1"; }
echo "# $L cleanup $(date -u +%FT%TZ): $(echo "$IDS" | wc -l | tr -d ' ') synthetic letters: $(echo "$IDS" | cut -c1-8 | paste -sd' ' -)"
counts() { q "select 'Mail ' || (select count(*) from \"Mail\" where id in ($LIST)) || ', MailEvent ' || (select count(*) from \"MailEvent\" where mail_id in ($LIST)) || ', MailDayItem ' || (select count(*) from \"MailDayItem\" where mail_id in ($LIST)) || ', MailReadSession ' || (select count(*) from \"MailReadSession\" where mail_id in ($LIST)) || ', HomeTask ' || (select count(*) from \"HomeTask\" where mail_id in ($LIST)) || ', EarnTransaction ' || (select count(*) from \"EarnTransaction\" where mail_id in ($LIST)) || ', Notification ' || (select count(*) from \"Notification\" where (coalesce(link,'')||coalesce(metadata::text,'')) ~ '($RX)')"; }
echo "before: $(counts)"
q "begin;
delete from \"MailEvent\" where mail_id in ($LIST);
delete from \"MailDayItem\" where mail_id in ($LIST);
delete from \"Notification\" where (coalesce(link,'')||coalesce(metadata::text,'')) ~ '($RX)';
delete from \"Mail\" where id in ($LIST);
commit;"
echo "after: $(counts)"
