#!/bin/zsh
# Prints the probe letters' ownership/routing state; user ids shown as labels.
RT=/private/tmp/pantopus-stream2-r06-runtime
ids=$(cut -d= -f2 $RT/work/x2-fixture-ids.txt | sed "s/.*/'&'/" | paste -sd, -)
$RT/psql.sh -Atc "select substr(m.id::text,1,8), m.subject, case m.recipient_user_id when '20bd1f37-7f90-49a4-8445-47eb5acb395d' then 'viewer' when 'c75d24fc-2af2-476d-9cca-262a8b868281' then 'OUTSIDER' when 'de50270f-222e-405f-bc30-9ecc7801c245' then 'editor' when null then '-' else coalesce(m.recipient_user_id::text,'-') end as recipient, m.drawer, m.privacy, coalesce(m.routing_method,'-'), m.lifecycle from \"Mail\" m where m.id in ($ids) and m.subject like '%$1%' order by m.subject"
