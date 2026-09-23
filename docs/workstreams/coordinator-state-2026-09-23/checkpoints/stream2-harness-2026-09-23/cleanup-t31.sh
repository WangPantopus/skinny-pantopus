#!/bin/zsh
# Deletes one worker's Earn-check fixture by exact id: the ad letter (and its actions, events, notifications), the
# wallet credit, the synthetic payment and task, and resets or removes the worker's wallet.
# Usage: cleanup-t31.sh <line-number> <worker-uuid> <keep-wallet: yes|no>
set -e
cd /private/tmp/pantopus-stream2-r06-runtime
N=$1; U=$2; KEEP=$3; WIN=$(cat work/t31-window.txt)
G=$(sed -n ${N}p work/t31-gig-ids.txt); P=$(sed -n ${N}p work/t31-payment-ids.txt); M=$(sed -n ${N}p work/t31-mail-ids.txt)
q() { ./psql.sh -Atc "$1"; }
echo "# t31 cleanup $(date -u +%FT%TZ): worker ${U:0:8}, task $G, payment $P, ad letter $M"
q "select 'before: WalletTransaction ' || (select count(*) from \"WalletTransaction\" where payment_id='$P') || ', Payment ' || (select count(*) from \"Payment\" where id='$P') || ', Gig ' || (select count(*) from \"Gig\" where id='$G') || ', Mail ' || (select count(*) from \"Mail\" where id='$M') || ', MailAction ' || (select count(*) from \"MailAction\" where mail_id='$M') || ', MailEvent ' || (select count(*) from \"MailEvent\" where mail_id='$M') || ', Notification ' || (select count(*) from \"Notification\" where created_at > '$WIN' and (coalesce(link,'')||coalesce(metadata::text,'')) ~ '($G|$M)') || ', wallet ' || coalesce((select balance || '/' || lifetime_received from \"Wallet\" where user_id='$U'),'none')"
q "begin;
delete from \"WalletTransaction\" where payment_id='$P';
$( [ "$KEEP" = yes ] && echo "update \"Wallet\" set balance=0, lifetime_received=0 where user_id='$U';" || echo "delete from \"Wallet\" where user_id='$U';" )
delete from \"Notification\" where created_at > '$WIN' and (coalesce(link,'')||coalesce(metadata::text,'')) ~ '($G|$M)';
delete from \"MailEvent\" where mail_id='$M';
delete from \"Mail\" where id='$M';
delete from \"Payment\" where id='$P';
delete from \"Gig\" where id='$G';
commit;"
q "select 'after: WalletTransaction ' || (select count(*) from \"WalletTransaction\" where payment_id='$P') || ', Payment ' || (select count(*) from \"Payment\" where id='$P') || ', Gig ' || (select count(*) from \"Gig\" where id='$G') || ', GigPublic ' || (select count(*) from \"GigPublic\" where id='$G') || ', Mail ' || (select count(*) from \"Mail\" where id='$M') || ', MailAction ' || (select count(*) from \"MailAction\" where mail_id='$M') || ', wallet ' || coalesce((select balance || '/' || lifetime_received from \"Wallet\" where user_id='$U'),'none')"
