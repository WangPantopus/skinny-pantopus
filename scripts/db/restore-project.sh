#!/usr/bin/env bash
# Restore a scripts/db/backup-project.sh folder into a NEW, empty Supabase
# project: the database in one transaction, then every Storage file with its
# original content type. Set DB_URL, S3_ENDPOINT and the AWS_* S3 access key
# variables for the new project, as for the backup.
#
# usage: scripts/db/restore-project.sh <backup folder>
set -euo pipefail

in=${1:?usage: restore-project.sh <backup folder>}
: "${DB_URL:?set DB_URL}" "${S3_ENDPOINT:?set S3_ENDPOINT}" "${AWS_ACCESS_KEY_ID:?set AWS_ACCESS_KEY_ID}"
: "${AWS_SECRET_ACCESS_KEY:?set AWS_SECRET_ACCESS_KEY}" "${AWS_REGION:?set AWS_REGION}"
for f in roles.sql schema.sql data.sql ledger-schema.sql ledger-data.sql objects.tsv; do
  [[ -f "$in/$f" ]] || { echo "Missing $in/$f" >&2; exit 2; }
done
existing=$(psql "$DB_URL" -At -c "select count(*) from information_schema.tables where table_schema = 'public'")
[[ "$existing" == 0 ]] || { echo 'The target project already has tables; restore only into a new, empty project' >&2; exit 2; }

psql --single-transaction --variable ON_ERROR_STOP=1 --dbname "$DB_URL" \
  --file "$in/roles.sql" --file "$in/schema.sql" \
  --command 'SET session_replication_role = replica' \
  --file "$in/data.sql" --file "$in/ledger-schema.sql" --file "$in/ledger-data.sql"

# The restored storage.objects rows describe every file, so `aws s3 sync` would
# treat the files as present and skip them. Upload each one explicitly, keeping
# its content type (some names don't match their type: avatars are WebP).
uploaded=0 failed=0
while IFS=$'\t' read -r bucket name type cache; do
  if aws s3 cp "$in/files/$bucket/$name" "s3://$bucket/$name" --endpoint-url "$S3_ENDPOINT" \
    --content-type "$type" --cache-control "$cache" --only-show-errors </dev/null; then
    uploaded=$((uploaded + 1))
  else
    echo "failed to upload: $bucket/$name" >&2; failed=$((failed + 1))
  fi
done < <(psql "$DB_URL" -At -F $'\t' -c "select bucket_id, name,
  coalesce(metadata->>'mimetype', 'application/octet-stream'),
  coalesce(metadata->>'cacheControl', 'max-age=3600') from storage.objects order by 1, 2")
echo "Restored the database and $uploaded of $(wc -l < "$in/objects.tsv" | tr -d ' ') Storage files ($failed failed)."
[[ $failed -eq 0 ]]
