#!/bin/zsh
# api-restart.sh <logN>: restart the owned Stream 3 API on 18130 from /private/tmp/pantopus-stream3-api/backend
R=/private/tmp/pantopus-stream3-20260923-r1
P=$(lsof -nP -tiTCP:18130 -sTCP:LISTEN)
if [ -n "$P" ]; then
  C=$(ps -p $P -o command=)
  case "$C" in *http-probe.cjs*app.js*) kill $P;; *) echo "port 18130 owned by unexpected process: $C"; exit 1;; esac
fi
for i in $(seq 1 10); do lsof -nP -tiTCP:18130 -sTCP:LISTEN > /dev/null || break; sleep 1; done
(nohup python3 $R/api-launch.py /private/tmp/pantopus-stream3-api/backend > $R/api-runtime-$1.log 2>&1 &)
for i in $(seq 1 30); do sleep 2; curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:18130/health 2>/dev/null | grep -q 200 && break; done
echo "api $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:18130/health) pid $(lsof -nP -tiTCP:18130 -sTCP:LISTEN) head $(git -C /private/tmp/pantopus-stream3-api rev-parse --short=9 HEAD) at $(date -u +%FT%TZ)"
