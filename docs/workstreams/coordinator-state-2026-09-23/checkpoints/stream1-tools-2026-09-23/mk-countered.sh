#!/bin/zsh
# mk-countered.sh <amount> : …0003 offers <amount> on a007, …0002 counters at 24. Appends to the offers fixture log.
O=/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20260923-stream1-listing-offers-actions-r1
B2=f9230b01-0000-4000-8000-000000000002; B3=f9230b01-0000-4000-8000-000000000003; L7=f9230b01-0000-4000-8000-00000000a007; H=http://127.0.0.1:18132
call(){ actor=$1; shift; curl -s -m 15 -H 'content-type: application/json' -H "x-fixture-actor: $actor" -H "authorization: Bearer $actor" "$@" -w '\nHTTP %{http_code}\n'; }
{
echo "# $(date -u +%FT%TZ) new countered offer on a007 (\$$1 from …0003, countered at \$24 by …0002)"
R=$(call $B3 -X POST $H/api/listings/$L7/offers -d "{\"amount\":$1,\"message\":\"$1 then?\"}"); echo "$R" | cut -c1-120
OID=$(echo "$R" | head -1 | python3 -c "import json,sys; print(json.load(sys.stdin)['offer']['id'])" 2>/dev/null)
[ -n "$OID" ] && call $B2 -X POST $H/api/listings/$L7/offers/$OID/counter -d '{"counterAmount":24,"counterMessage":"24 and it is yours"}' | cut -c1-120
psql "postgresql://postgres:postgres@127.0.0.1:64562/postgres" -X -A -F '|' -c "select right(id::text,4), right(buyer_id::text,4) buyer, amount, counter_amount, status from public.\"ListingOffer\" where listing_id='$L7' order by created_at"
} 2>&1 | tee -a $O/evidence/fixture-offers-a007-a008.txt
