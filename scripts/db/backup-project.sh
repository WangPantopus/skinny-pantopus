#!/usr/bin/env bash
# Back up a Supabase project: roles, schema, data, the migration ledger and every
# Storage file. Supabase's own daily backups cover the database only, not the
# bytes of uploaded files. Run from the repository root with the Supabase CLI,
# psql and the AWS CLI; the AWS CLI talks only to the project's S3 endpoint.
#
#   DB_URL       the project's Postgres connection string (Connect → Session pooler)
#   S3_ENDPOINT  https://<project ref>.supabase.co/storage/v1/s3 (Storage → S3 Connection)
#   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION  that S3 access key
#
# usage: scripts/db/backup-project.sh <new folder outside the repository>
# Restore with scripts/db/restore-project.sh. The folder holds real user data:
# keep it private and encrypted at rest.
set -euo pipefail

out=${1:?usage: backup-project.sh <new folder outside the repository>}
: "${DB_URL:?set DB_URL}" "${S3_ENDPOINT:?set S3_ENDPOINT}" "${AWS_ACCESS_KEY_ID:?set AWS_ACCESS_KEY_ID}"
: "${AWS_SECRET_ACCESS_KEY:?set AWS_SECRET_ACCESS_KEY}" "${AWS_REGION:?set AWS_REGION}"
[[ ! -e "$out" ]] || { echo "$out already exists; use a new folder" >&2; exit 2; }
repo=$(git rev-parse --show-toplevel 2>/dev/null || true)
umask 077
mkdir -p "$out/files"
out=$(cd "$out" && pwd)
if [[ -n "$repo" && "$out/" == "$repo/"* ]]; then
  rmdir "$out/files" "$out"
  echo 'Keep backups outside the repository (they contain user data)' >&2
  exit 2
fi

supabase db dump --db-url "$DB_URL" -f "$out/roles.sql" --role-only
supabase db dump --db-url "$DB_URL" -f "$out/schema.sql"
# The postgres role can't write these two Storage tables on restore; Pantopus
# doesn't use vector buckets, so they're always empty.
supabase db dump --db-url "$DB_URL" -f "$out/data.sql" --use-copy --data-only \
  -x storage.buckets_vectors,storage.vector_indexes
# The migration ledger isn't in the dumps above. Without it, `supabase db push`
# would try to apply every migration again after a restore.
supabase db dump --db-url "$DB_URL" -f "$out/ledger-schema.sql" -s supabase_migrations
supabase db dump --db-url "$DB_URL" -f "$out/ledger-data.sql" --use-copy --data-only -s supabase_migrations

psql "$DB_URL" -At -c 'select id from storage.buckets order by 1' > "$out/buckets.txt"
while read -r bucket; do
  aws s3 sync "s3://$bucket" "$out/files/$bucket" --endpoint-url "$S3_ENDPOINT" --only-show-errors </dev/null
done < "$out/buckets.txt"

# Every object row needs its bytes; a missing file means the backup is incomplete.
psql "$DB_URL" -At -F $'\t' -c 'select bucket_id, name from storage.objects order by 1, 2' > "$out/objects.tsv"
missing=0
while IFS=$'\t' read -r bucket name; do
  [[ -f "$out/files/$bucket/$name" ]] || { echo "missing file: $bucket/$name" >&2; missing=$((missing + 1)); }
done < "$out/objects.tsv"
echo "Backed up the database and $(wc -l < "$out/objects.tsv" | tr -d ' ') Storage files to $out ($missing missing)."
[[ $missing -eq 0 ]]
