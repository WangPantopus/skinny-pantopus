-- Synthetic, transactionally rolled-back checks for the local adoption candidate.
-- Requires the reviewed gap expansion; it does not apply schema or ledger changes.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = public, extensions, pg_catalog;

INSERT INTO auth.users (id, email)
VALUES ('aaa00000-0000-4000-8000-000000000001', 'adoption-contract@example.invalid');
INSERT INTO public."User" (id, email, username, name)
VALUES ('aaa00000-0000-4000-8000-000000000001', 'adoption-contract@example.invalid',
        'adoption_contract_fixture', 'Adoption contract fixture');
INSERT INTO public."Gig" (id, user_id, title, description, price, exact_location, approx_location)
VALUES ('aaa00000-0000-4000-8000-000000000002', 'aaa00000-0000-4000-8000-000000000001',
        'Synthetic contract gig', 'Local database fixture', 10,
        ST_SetSRID(ST_MakePoint(-122.67, 45.63), 4326),
        ST_SetSRID(ST_MakePoint(-122.67, 45.63), 4326));
INSERT INTO public."Listing" (id, user_id, title, latitude, longitude)
VALUES ('aaa00000-0000-4000-8000-000000000003', 'aaa00000-0000-4000-8000-000000000001',
        'Synthetic contract listing', 45.63, -122.67);
INSERT INTO public."Mail" (id, sender_user_id, recipient_user_id, type, content)
VALUES ('aaa00000-0000-4000-8000-000000000004', 'aaa00000-0000-4000-8000-000000000001',
        'aaa00000-0000-4000-8000-000000000001', 'letter', 'Local database fixture');

-- Real browser roles must not be able to read or write the new service tables.
DO $$
DECLARE role_name text; table_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    EXECUTE format('SET LOCAL ROLE %I', role_name);
    FOREACH table_name IN ARRAY ARRAY['AnalyticsEvent', 'GigShare', 'ListingShare', 'MailDeliveryIntent'] LOOP
      BEGIN
        EXECUTE format('SELECT 1 FROM public.%I LIMIT 1', table_name);
        RAISE EXCEPTION 'Unexpected browser read on %', table_name;
      EXCEPTION WHEN insufficient_privilege THEN NULL;
      END;
      BEGIN
        EXECUTE format('INSERT INTO public.%I DEFAULT VALUES', table_name);
        RAISE EXCEPTION 'Unexpected browser write on %', table_name;
      EXCEPTION WHEN insufficient_privilege THEN NULL;
      END;
    END LOOP;
    RESET ROLE;
  END LOOP;
END $$;

SET LOCAL ROLE service_role;
INSERT INTO public."AnalyticsEvent" (user_id, event)
VALUES ('aaa00000-0000-4000-8000-000000000001', 'adoption_contract');
INSERT INTO public."GigShare" (gig_id, user_id)
VALUES ('aaa00000-0000-4000-8000-000000000002', 'aaa00000-0000-4000-8000-000000000001');
INSERT INTO public."ListingShare" (listing_id, user_id)
VALUES ('aaa00000-0000-4000-8000-000000000003', 'aaa00000-0000-4000-8000-000000000001');
INSERT INTO public."MailDeliveryIntent" (mail_id, sender_user_id, route_type)
VALUES ('aaa00000-0000-4000-8000-000000000004', 'aaa00000-0000-4000-8000-000000000001',
        'invited_person_at_address');

DO $$
BEGIN
  IF (SELECT share_count FROM public."Gig" WHERE id = 'aaa00000-0000-4000-8000-000000000002') <> 1
    OR (SELECT share_count FROM public."Listing" WHERE id = 'aaa00000-0000-4000-8000-000000000003') <> 1 THEN
    RAISE EXCEPTION 'Share insert did not update the parent count';
  END IF;
  BEGIN
    INSERT INTO public."MailDeliveryIntent" (mail_id, sender_user_id, route_type)
    VALUES ('aaa00000-0000-4000-8000-000000000004', 'aaa00000-0000-4000-8000-000000000001',
            'invited_person_at_address');
    RAISE EXCEPTION 'Duplicate delivery intent was allowed';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    UPDATE public."Gig" SET pricing_mode = 'rate'
    WHERE id = 'aaa00000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'Rate pricing without amount/unit was allowed';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

UPDATE public."Gig" SET pricing_mode = 'rate', rate_amount_cents = 1500, pay_unit = 'hour'
WHERE id = 'aaa00000-0000-4000-8000-000000000002';
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM public.find_gigs_in_bounds_v3(45.62, -122.68, 45.64, -122.66,
      p_pricing_mode := 'rate', p_pay_unit := 'hour')
      WHERE id = 'aaa00000-0000-4000-8000-000000000002' AND rate_amount_cents = 1500) THEN
    RAISE EXCEPTION 'Structured bounds query did not return the exact priced gig';
  END IF;
  IF NOT EXISTS (SELECT FROM public.find_gigs_nearby_v3(45.63, -122.67,
      p_pricing_mode := 'rate', p_pay_unit := 'hour')
      WHERE id = 'aaa00000-0000-4000-8000-000000000002' AND rate_amount_cents = 1500) THEN
    RAISE EXCEPTION 'Structured nearby query did not return the exact priced gig';
  END IF;
  IF NOT EXISTS (SELECT FROM public.browse_listings_by_distance(45.62, -122.68, 45.64, -122.66, 45.63, -122.67)
      WHERE id = 'aaa00000-0000-4000-8000-000000000003' AND category = 'other') THEN
    RAISE EXCEPTION 'Listing enum-to-text return contract failed';
  END IF;
END $$;

INSERT INTO public."Notification" (user_id, type, title, idempotency_key)
VALUES ('aaa00000-0000-4000-8000-000000000001', 'test', 'Local fixture', 'adoption-contract-notification');
INSERT INTO public."Notification" (user_id, type, title, idempotency_key)
VALUES ('aaa00000-0000-4000-8000-000000000001', 'test', 'Local fixture retry', 'adoption-contract-notification')
ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;
INSERT INTO public."PushToken" (user_id, token, platform, provider)
VALUES ('aaa00000-0000-4000-8000-000000000001', 'local-contract-not-a-device-token', 'ios', 'apns');
DELETE FROM public."GigShare" WHERE gig_id = 'aaa00000-0000-4000-8000-000000000002';
DELETE FROM public."ListingShare" WHERE listing_id = 'aaa00000-0000-4000-8000-000000000003';
DO $$
BEGIN
  IF (SELECT count(*) FROM public."Notification" WHERE idempotency_key = 'adoption-contract-notification') <> 1 THEN
    RAISE EXCEPTION 'Notification retry created a duplicate';
  END IF;
  IF (SELECT share_count FROM public."Gig" WHERE id = 'aaa00000-0000-4000-8000-000000000002') <> 0
    OR (SELECT share_count FROM public."Listing" WHERE id = 'aaa00000-0000-4000-8000-000000000003') <> 0 THEN
    RAISE EXCEPTION 'Share deletion did not restore the parent count';
  END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: browser denial, service writes, share counts, intent uniqueness, pricing constraints/RPCs, listing returns, notification idempotency, native push columns' AS result;
