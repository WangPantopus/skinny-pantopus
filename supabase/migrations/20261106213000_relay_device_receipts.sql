-- Backwards compatible: yes. Adds one defaulted column to five delivery tables (founder approved, November 6) and one new
-- service-only function. No existing function, row, trigger or index changes: the deployed backend never reads the column
-- or calls the function, and its claim, read and finish calls behave as before.
--
-- While any device's outcome is unknown, the durable relays retry the whole delivery, so a device that already got the
-- push got it again on every retry. Each delivery now remembers the push registrations a provider accepted, as chat's
-- outbox does (20261023210000). gig_completion and gig_tip have no delivery table: their state is
-- Notification.metadata->'gig_completion_delivery_v1' and Payment.metadata->'gig_tip_delivery_v1', and the ids live there.
-- claim and finish rebuild those objects from what's already in them, so they keep the new key. Each read strips or ignores
-- the object before the notice reaches a push payload, and gig_completion's note hash excludes it.
--
-- One narrow function instead of changing the 14 read_ and finish_ functions: a finish_ overload with a defaulted argument
-- would make the deployed backend's call ambiguous in PostgREST, and rewriting them would put their eligibility and money
-- checks at risk for nothing. It takes the same lease guard as finish_, on the row lock, so a worker that lost its lease
-- writes nothing. It returns NULL for that worker and otherwise the merged ids; an empty p_accepted reads them without writing.
SET LOCAL lock_timeout='5s';

ALTER TABLE public."GigAcceptanceDelivery" ADD COLUMN accepted_registration_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public."PaymentWalletDelivery" ADD COLUMN accepted_registration_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public."GigAuthorizationExpiryDelivery" ADD COLUMN accepted_registration_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public."GigStopDelivery" ADD COLUMN accepted_registration_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public."HomeTaskAssignmentDelivery" ADD COLUMN accepted_registration_ids uuid[] NOT NULL DEFAULT '{}';

CREATE FUNCTION public.merge_delivery_device_receipts(p_kind text,p_id uuid,p_lease_id uuid,p_accepted uuid[] DEFAULT '{}')
RETURNS uuid[] LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE target text; state_key text; d jsonb; saved uuid[]; merged uuid[];
BEGIN
 target:=CASE p_kind WHEN 'gig_acceptance' THEN 'GigAcceptanceDelivery' WHEN 'wallet_settlement' THEN 'PaymentWalletDelivery'
  WHEN 'gig_expiry' THEN 'GigAuthorizationExpiryDelivery' WHEN 'gig_stop' THEN 'GigStopDelivery'
  WHEN 'home_task_assignment' THEN 'HomeTaskAssignmentDelivery' END;
 IF target IS NOT NULL THEN
  EXECUTE format('SELECT accepted_registration_ids FROM public.%I WHERE id=$1 AND lease_id=$2 AND state=''processing''
   AND lease_until>clock_timestamp() FOR UPDATE',target) INTO saved USING p_id,p_lease_id;
 ELSIF p_kind IN ('gig_completion','gig_tip') THEN
  target:=CASE p_kind WHEN 'gig_completion' THEN 'Notification' ELSE 'Payment' END;
  state_key:=p_kind||'_delivery_v1';
  EXECUTE format('SELECT metadata->$2 FROM public.%I WHERE id=$1 FOR UPDATE',target) INTO d USING p_id,state_key;
  IF d->>'lease_id'=p_lease_id::text AND d->>'state'='processing'
   AND coalesce((d->>'lease_until')::timestamptz,'-infinity')>clock_timestamp() THEN
   saved:=ARRAY(SELECT x::uuid FROM jsonb_array_elements_text(coalesce(d->'accepted_registration_ids','[]'::jsonb)) AS e(x));
  END IF;
 ELSE
  RAISE EXCEPTION 'Invalid delivery kind';
 END IF;
 IF saved IS NULL THEN RETURN NULL; END IF;
 merged:=ARRAY(SELECT DISTINCT x FROM unnest(saved||coalesce(p_accepted,'{}')) AS a(x) WHERE x IS NOT NULL ORDER BY x);
 IF merged=saved THEN RETURN merged; END IF;
 IF state_key IS NULL THEN
  EXECUTE format('UPDATE public.%I SET accepted_registration_ids=$1 WHERE id=$2',target) USING merged,p_id;
 ELSE
  -- The capture trigger admits a change to this object only inside its delivery transaction.
  PERFORM set_config('app.'||p_kind||'_delivery','on',true);
  EXECUTE format('UPDATE public.%I SET metadata=jsonb_set(metadata,ARRAY[$3],$1) WHERE id=$2',target)
   USING d||jsonb_build_object('accepted_registration_ids',to_jsonb(merged)),p_id,state_key;
  PERFORM set_config('app.'||p_kind||'_delivery','off',true);
 END IF;
 RETURN merged;
END $$;
REVOKE ALL ON FUNCTION public.merge_delivery_device_receipts(text,uuid,uuid,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.merge_delivery_device_receipts(text,uuid,uuid,uuid[]) TO service_role;
