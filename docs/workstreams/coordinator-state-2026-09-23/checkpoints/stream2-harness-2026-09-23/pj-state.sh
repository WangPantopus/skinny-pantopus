#!/bin/zsh
# Participants of the party sessions this probe created (user ids shown as labels).
RT=/private/tmp/pantopus-stream2-r06-runtime
ids=$(sort -u $RT/work/x2-created-sessions.txt | sed "s/.*/'&'/" | paste -sd, -)
$RT/psql.sh -Atc "select substr(s.id::text,1,8), s.status, case p.user_id when '20bd1f37-7f90-49a4-8445-47eb5acb395d' then 'viewer' when 'c75d24fc-2af2-476d-9cca-262a8b868281' then 'OUTSIDER' when 'de50270f-222e-405f-bc30-9ecc7801c245' then 'editor' else p.user_id::text end from \"MailPartySession\" s left join \"MailPartyParticipant\" p on p.session_id=s.id where s.id in ($ids) order by s.created_at, 3"
