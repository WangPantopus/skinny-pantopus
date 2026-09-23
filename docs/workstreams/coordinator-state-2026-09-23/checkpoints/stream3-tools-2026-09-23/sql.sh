#!/bin/bash
# Owned Stream 3 retained DB (64532) — read/write helper; reads SQL from stdin or -c args
exec docker exec -i supabase_db_pantopus-stream3-block-r1 psql -U postgres -d postgres -X -A -F '|' -P pager=off -v ON_ERROR_STOP=1 "$@"
