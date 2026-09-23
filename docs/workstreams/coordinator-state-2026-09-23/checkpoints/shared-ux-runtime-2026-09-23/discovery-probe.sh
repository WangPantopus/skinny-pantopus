#!/bin/bash
# discovery-probe.sh <out> : alice's Hub Discover API per filter on backend 18138 (items, types, titles, routes, usernames).
BASE=http://127.0.0.1:18138; T=$(cat /private/tmp/pantopus-shared-ux-runtime/.alice-token)
P=$(lsof -t -nP -iTCP:18138 -sTCP:LISTEN); CWD=$(lsof -p $P | awk '$4=="cwd"{print $NF}')
{
echo "captured $(date -u +%FT%TZ); backend cwd $CWD at $(git -C $CWD rev-parse HEAD)"
for f in businesses people gigs posts; do
  echo "== filter=$f"
  curl -s "$BASE/api/hub/discovery?filter=$f&limit=8" -H "Authorization: Bearer $T" | python3 -c 'import sys,json; d=json.load(sys.stdin); its=d.get("items",[]); print("items:",len(its)); [print("  ",i.get("type"),"|",i.get("title"),"|",i.get("subtitle"),"|",i.get("route"),"| username=",i.get("username")) for i in its]'
done
} > "$1"
cat "$1"
