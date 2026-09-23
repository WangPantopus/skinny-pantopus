#!/bin/zsh
# Read/write SQL against the retained Stream 2 DB (64554) via the container's psql.
docker exec -i supabase_db_pantopus-stream2-native-r1 psql -U postgres -d postgres -v ON_ERROR_STOP=1 -P pager=off "$@"
