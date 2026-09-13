-- Backwards compatible: yes. Source bills and historical BillBenchmark rows
-- are preserved. New readers use current, same-currency household/month totals.
SET LOCAL lock_timeout='5s';

CREATE FUNCTION public.home_bill_geohash(p_point public.geography,p_lat double precision,p_lng double precision)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path=public,pg_temp AS $$
 SELECT CASE WHEN p_point IS NOT NULL THEN public.ST_GeoHash(p_point::public.geometry,6)
   WHEN p_lat BETWEEN -90 AND 90 AND p_lng BETWEEN -180 AND 180
   THEN public.ST_GeoHash(public.ST_SetSRID(public.ST_MakePoint(p_lng,p_lat),4326),6)
   ELSE NULL END;
$$;
CREATE INDEX idx_home_bill_comparison_cell ON public."Home"
  (public.home_bill_geohash(location,map_center_lat,map_center_lng));
CREATE INDEX idx_home_bill_paid_month ON public."HomeBill"(home_id,period_start,bill_type,currency)
  INCLUDE(amount) WHERE status='paid' AND amount>0 AND period_start IS NOT NULL;

-- Service-only aggregate read. Amounts are MAJOR units in the requested
-- currency, never individual neighbor values. The floor cannot be lowered.
CREATE FUNCTION public.read_bill_peer_months(p_geohash text,p_currency text DEFAULT 'USD')
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 WITH monthly AS (
   SELECT b.home_id,b.bill_type,date_trunc('month',b.period_start)::date AS period,
     sum(b.amount) AS amount
   FROM public."Home" h JOIN public."HomePreference" p ON p.home_id=h.id
   JOIN public."HomeBill" b ON b.home_id=h.id
   WHERE p_geohash ~ '^[0123456789bcdefghjkmnpqrstuvwxyz]{6}$' AND p_currency ~ '^[A-Z]{3}$'
     AND public.home_bill_geohash(h.location,h.map_center_lat,h.map_center_lng)=p_geohash
     AND p.settings @> '{"bill_benchmark_opt_in":true}'::jsonb
     AND b.status='paid' AND b.amount>0 AND b.amount<'Infinity'::numeric
     AND upper(btrim(b.currency))=p_currency
     AND b.period_start>=date_trunc('month',CURRENT_DATE)-interval '23 months'
     AND b.period_start<=CURRENT_DATE
   GROUP BY b.home_id,b.bill_type,date_trunc('month',b.period_start)::date
 ), peers AS (
   SELECT bill_type,period,count(*)::integer AS household_count,
     CASE WHEN count(*)>=10 THEN round(avg(amount),2) END AS avg_amount,
     CASE WHEN count(*)>=10 THEN round((percentile_cont(0.5) WITHIN GROUP(ORDER BY amount))::numeric,2) END AS median_amount
   FROM monthly GROUP BY bill_type,period HAVING count(*)>=3
 ) SELECT coalesce(jsonb_agg(jsonb_build_object('bill_type',bill_type,'month',to_char(period,'YYYY-MM'),
   'currency',p_currency,'household_count',household_count,'avg_amount',avg_amount,'median_amount',median_amount)
   ORDER BY bill_type,period),'[]'::jsonb) FROM peers;
$$;
REVOKE ALL ON FUNCTION public.read_bill_peer_months(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.read_bill_peer_months(text,text) TO service_role;

-- One statement snapshot for current authority, personal totals, opt-in and
-- peer aggregates. No historical derived cache or provider is consulted.
CREATE FUNCTION public.get_home_bill_comparison(p_home_id uuid,p_actor_id uuid,p_currency text DEFAULT 'USD')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE h public."Home"; a jsonb; own_rows jsonb:='[]'; currencies jsonb:='[]';
  can_finance boolean; cell text; opted_in boolean;
BEGIN
  IF p_currency IS NULL OR p_currency !~ '^[A-Z]{3}$' THEN RETURN '{"ok":false,"code":"HOME_BILLS_INVALID"}'::jsonb; END IF;
  a:=public.home_effective_access(p_home_id,p_actor_id);
  IF a->>'has_access' IS DISTINCT FROM 'true' OR NOT a->'permissions' ? 'home.view' THEN
    RETURN '{"ok":false,"code":"HOME_BILLS_DENIED"}'::jsonb;
  END IF;
  SELECT * INTO h FROM public."Home" WHERE id=p_home_id;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"HOME_BILLS_DENIED"}'::jsonb; END IF;
  -- A recorded revoked ownership cannot be replaced by an old owner pointer.
  IF a->>'is_owner'='true' AND EXISTS(SELECT FROM public."HomeOwner" o WHERE o.home_id=p_home_id
    AND o.subject_type='user' AND o.subject_id=p_actor_id AND o.owner_status IN('revoked','disputed'))
    AND NOT EXISTS(SELECT FROM public."HomeOwner" o WHERE o.home_id=p_home_id AND o.subject_type='user'
      AND o.subject_id=p_actor_id AND o.owner_status='verified') THEN RETURN '{"ok":false,"code":"HOME_BILLS_DENIED"}'::jsonb; END IF;
  can_finance:=a->'permissions' ? 'finance.view';
  IF can_finance THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('bill_type',bill_type,'month',to_char(period,'YYYY-MM'),
      'amount',amount) ORDER BY bill_type,period),'[]'::jsonb) INTO own_rows
    FROM (SELECT bill_type,date_trunc('month',period_start)::date AS period,sum(amount) AS amount
      FROM public."HomeBill" WHERE home_id=p_home_id AND status='paid' AND amount>0 AND amount<'Infinity'::numeric
        AND upper(btrim(currency))=p_currency
        AND period_start>=date_trunc('month',CURRENT_DATE)-interval '23 months' AND period_start<=CURRENT_DATE
      GROUP BY bill_type,date_trunc('month',period_start)::date) monthly;
    SELECT coalesce(jsonb_agg(currency ORDER BY currency),'[]'::jsonb) INTO currencies FROM
      (SELECT DISTINCT upper(btrim(currency)) AS currency FROM public."HomeBill"
       WHERE home_id=p_home_id AND status='paid' AND amount>0 AND amount<'Infinity'::numeric
         AND upper(btrim(currency)) ~ '^[A-Z]{3}$'
         AND period_start>=date_trunc('month',CURRENT_DATE)-interval '23 months' AND period_start<=CURRENT_DATE) known;
  END IF;
  SELECT coalesce((settings->'bill_benchmark_opt_in')='true'::jsonb,false) INTO opted_in
    FROM public."HomePreference" WHERE home_id=p_home_id;
  cell:=public.home_bill_geohash(h.location,h.map_center_lat,h.map_center_lng);
  RETURN jsonb_build_object('ok',true,'home_id',p_home_id,'currency',p_currency,
    'can_view_finance',can_finance,'own_months',own_rows,'available_currencies',currencies,
    'peer_months',public.read_bill_peer_months(cell,p_currency),
    'bill_benchmark_opt_in',coalesce(opted_in,false),'as_of',statement_timestamp(),
    'calculation_version',2,'period_basis','paid bills grouped by period-start month');
END $$;
REVOKE ALL ON FUNCTION public.get_home_bill_comparison(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_home_bill_comparison(uuid,uuid,text) TO service_role;
