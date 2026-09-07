-- Runs only inside test-address-calendar-pickup-local.sh's disposable cluster.
DO $$
DECLARE
    old_rows jsonb;
    new_rows jsonb;
    pair jsonb := '[
      {"kind":"garbage","title":"Garbage day","rrule":"FREQ=WEEKLY;BYDAY=TH","dtstart":"2026-09-03"},
      {"kind":"recycling","title":"Recycling day","rrule":"FREQ=WEEKLY;INTERVAL=2;BYDAY=FR","dtstart":"2026-09-11"}
    ]';
BEGIN
    IF has_function_privilege('anon', 'public.set_home_pickup_rules(text,jsonb)', 'EXECUTE')
        OR has_function_privilege('authenticated', 'public.set_home_pickup_rules(text,jsonb)', 'EXECUTE')
        OR NOT has_function_privilege('service_role', 'public.set_home_pickup_rules(text,jsonb)', 'EXECUTE') THEN
        RAISE EXCEPTION 'Pickup RPC permissions must be service-role only';
    END IF;

    IF public.set_home_pickup_rules('home-a', pair) <> 2 THEN
        RAISE EXCEPTION 'Expected two rules';
    END IF;
    PERFORM public.set_home_pickup_rules('home-b', pair);
    SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) INTO old_rows FROM public."AddressCalendarRule" r;

    -- Force a real insert constraint failure AFTER the function deletes.
    BEGIN
        PERFORM public.set_home_pickup_rules('home-a', '[{"kind":"invalid","title":"Broken","rrule":"FREQ=WEEKLY","dtstart":"2026-09-03"}]');
        RAISE EXCEPTION 'Expected check_violation';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) INTO new_rows FROM public."AddressCalendarRule" r;
    IF old_rows IS DISTINCT FROM new_rows THEN
        RAISE EXCEPTION 'Failed insert changed the existing schedule';
    END IF;

    -- Repeating a successful swap never stacks rules, and preserves the date.
    PERFORM public.set_home_pickup_rules('home-a', pair);
    IF (SELECT count(*) FROM public."AddressCalendarRule" WHERE scope_key = 'home-a') <> 2
        OR NOT EXISTS (SELECT 1 FROM public."AddressCalendarRule" WHERE scope_key = 'home-a' AND kind = 'recycling' AND dtstart = '2026-09-11') THEN
        RAISE EXCEPTION 'Replacement duplicated rules or changed the anchor';
    END IF;
    PERFORM public.set_home_pickup_rules('home-a', jsonb_build_array(pair->0));
    IF (SELECT count(*) FROM public."AddressCalendarRule" WHERE scope_key = 'home-a') <> 1
        OR (SELECT count(*) FROM public."AddressCalendarRule" WHERE scope_key = 'home-b') <> 2
        OR (SELECT count(*) FROM public."AddressCalendarRule" WHERE scope_type <> 'home') <> 5 THEN
        RAISE EXCEPTION 'Garbage-only replacement lost another household or public rules';
    END IF;
END $$;
SELECT 'PASS: RPC permissions, real transaction rollback, retry, explicit anchor, household isolation' AS result;
