-- Backwards compatible: yes. Existing API fields/card rows are preserved.
-- The API service owns writes; authenticated clients retain their owned reads.
-- is_default is the app's saved-card preference, independent of Stripe invoice
-- defaults and of explicit checkout selections/already-authorized payments.
SET LOCAL lock_timeout = '5s';

CREATE TABLE public."PaymentMethodRemoval" (
 stripe_payment_method_id text PRIMARY KEY,
 user_id uuid REFERENCES public."User"(id) ON DELETE CASCADE,
 method_id uuid UNIQUE,
 stripe_customer_id text,
 created_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 CONSTRAINT payment_method_removal_owner CHECK (
  (user_id IS NULL AND method_id IS NULL AND stripe_customer_id IS NULL)
  OR (user_id IS NOT NULL AND method_id IS NOT NULL AND stripe_customer_id IS NOT NULL)
 )
);
ALTER TABLE public."PaymentMethodRemoval" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."PaymentMethodRemoval" FROM PUBLIC,anon,authenticated;
GRANT ALL ON public."PaymentMethodRemoval" TO service_role;
REVOKE ALL ON public."PaymentMethod" FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public."PaymentMethod" TO authenticated;
DROP POLICY IF EXISTS payment_method_insert_own ON public."PaymentMethod";
DROP POLICY IF EXISTS payment_method_update_own ON public."PaymentMethod";
DROP POLICY IF EXISTS payment_method_delete_own ON public."PaymentMethod";

-- Keep the latest selected default when older races left multiple flags. No
-- cards are deleted, and existing accounts with no default are not rewritten.
WITH ranked AS (
 SELECT id,row_number() OVER (PARTITION BY user_id
  ORDER BY updated_at DESC NULLS LAST,created_at DESC NULLS LAST,id DESC) AS n
 FROM public."PaymentMethod" WHERE is_default IS TRUE
)
UPDATE public."PaymentMethod" m SET is_default=false
FROM ranked r WHERE m.id=r.id AND r.n>1;
CREATE UNIQUE INDEX payment_method_one_default_per_user
 ON public."PaymentMethod" (user_id) WHERE is_default IS TRUE;

CREATE FUNCTION public.protect_payment_customer_binding()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=public,pg_temp AS $$
BEGIN
 IF current_user NOT IN ('postgres','supabase_admin','service_role') AND (
  (TG_OP='INSERT' AND NEW.stripe_customer_id IS NOT NULL)
  OR (TG_OP='UPDATE' AND NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id)
 ) THEN RAISE EXCEPTION 'Payment customer binding is managed by the service' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_payment_customer_binding
 BEFORE INSERT OR UPDATE OF stripe_customer_id ON public."User"
 FOR EACH ROW EXECUTE FUNCTION public.protect_payment_customer_binding();
REVOKE ALL ON FUNCTION public.protect_payment_customer_binding() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.protect_payment_customer_binding() TO service_role;

CREATE FUNCTION public.bind_payment_customer(p_user_id uuid,p_customer_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE v_customer text;
BEGIN
 IF p_customer_id IS NULL OR p_customer_id !~ '^cus_[A-Za-z0-9]+$' THEN
 RAISE EXCEPTION 'Invalid payment customer' USING ERRCODE='22023'; END IF;
 SELECT stripe_customer_id INTO v_customer FROM public."User" WHERE id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 IF v_customer IS NULL THEN
  UPDATE public."User" SET stripe_customer_id=p_customer_id WHERE id=p_user_id;
  v_customer:=p_customer_id;
 END IF;
 RETURN jsonb_build_object('customer_id',v_customer);
END $$;

CREATE FUNCTION public.save_payment_method(p_user_id uuid,p_customer_id text,p_method_id text,p_details jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE v_customer text; v_method public."PaymentMethod"%ROWTYPE; v_default boolean;
BEGIN
 IF p_user_id IS NULL OR p_customer_id IS NULL OR p_method_id IS NULL
 OR p_method_id !~ '^pm_[A-Za-z0-9]+$' OR jsonb_typeof(p_details) IS DISTINCT FROM 'object'
 OR p_details->>'payment_method_type' IS NULL
 OR p_details->>'payment_method_type' NOT IN ('card','us_bank_account') THEN
 RAISE EXCEPTION 'Invalid saved payment method' USING ERRCODE='22023'; END IF;
 -- Transaction locks only protect database work, never an external request.
 -- Every save/removal acquires method then User, including unknown detach events.
 PERFORM pg_advisory_xact_lock(hashtextextended('payment-method:'||p_method_id,0));
 SELECT stripe_customer_id INTO v_customer FROM public."User" WHERE id=p_user_id FOR UPDATE;
 IF NOT FOUND OR v_customer IS DISTINCT FROM p_customer_id THEN
 RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 IF EXISTS(SELECT FROM public."PaymentMethodRemoval" WHERE stripe_payment_method_id=p_method_id) THEN
 RETURN jsonb_build_object('error','REMOVED'); END IF;
 SELECT * INTO v_method FROM public."PaymentMethod" WHERE stripe_payment_method_id=p_method_id;
 IF FOUND AND (v_method.user_id<>p_user_id OR v_method.stripe_customer_id<>p_customer_id) THEN
 RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 v_default:=COALESCE(v_method.is_default,false) OR NOT EXISTS(
  SELECT FROM public."PaymentMethod" WHERE user_id=p_user_id AND is_default IS TRUE);
 INSERT INTO public."PaymentMethod" (user_id,stripe_customer_id,stripe_payment_method_id,payment_method_type,
  card_brand,card_last4,card_exp_month,card_exp_year,card_funding,bank_name,bank_last4,bank_account_type,is_default)
 VALUES (p_user_id,p_customer_id,p_method_id,p_details->>'payment_method_type',
  p_details->>'card_brand',p_details->>'card_last4',(p_details->>'card_exp_month')::integer,
  (p_details->>'card_exp_year')::integer,p_details->>'card_funding',p_details->>'bank_name',
  p_details->>'bank_last4',p_details->>'bank_account_type',v_default)
 ON CONFLICT (stripe_payment_method_id) DO UPDATE SET
  payment_method_type=excluded.payment_method_type,card_brand=excluded.card_brand,card_last4=excluded.card_last4,
  card_exp_month=excluded.card_exp_month,card_exp_year=excluded.card_exp_year,card_funding=excluded.card_funding,
  bank_name=excluded.bank_name,bank_last4=excluded.bank_last4,bank_account_type=excluded.bank_account_type,
  is_default=excluded.is_default,updated_at=now()
 RETURNING * INTO v_method;
 RETURN jsonb_build_object('payment_method',to_jsonb(v_method));
END $$;

CREATE FUNCTION public.set_default_payment_method(p_user_id uuid,p_method_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE v_method public."PaymentMethod"%ROWTYPE;
BEGIN
 PERFORM 1 FROM public."User" WHERE id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 SELECT * INTO v_method FROM public."PaymentMethod" WHERE id=p_method_id AND user_id=p_user_id;
 IF NOT FOUND OR EXISTS(SELECT FROM public."PaymentMethodRemoval" WHERE stripe_payment_method_id=v_method.stripe_payment_method_id) THEN
 RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 UPDATE public."PaymentMethod" SET is_default=false WHERE user_id=p_user_id AND id<>p_method_id AND is_default IS TRUE;
 UPDATE public."PaymentMethod" SET is_default=true WHERE id=p_method_id RETURNING * INTO v_method;
 RETURN jsonb_build_object('payment_method',to_jsonb(v_method));
END $$;

CREATE FUNCTION public.begin_payment_method_removal(p_user_id uuid,p_method_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE v_method public."PaymentMethod"%ROWTYPE; v_removal public."PaymentMethodRemoval"%ROWTYPE; v_provider_id text;
BEGIN
 SELECT stripe_payment_method_id INTO v_provider_id FROM public."PaymentMethod" WHERE id=p_method_id AND user_id=p_user_id;
 IF NOT FOUND THEN
  SELECT stripe_payment_method_id INTO v_provider_id FROM public."PaymentMethodRemoval" WHERE method_id=p_method_id AND user_id=p_user_id;
 END IF;
 IF v_provider_id IS NULL THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('payment-method:'||v_provider_id,0));
 PERFORM 1 FROM public."User" WHERE id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 SELECT * INTO v_removal FROM public."PaymentMethodRemoval" WHERE method_id=p_method_id AND user_id=p_user_id;
 IF FOUND THEN RETURN jsonb_build_object('removal',to_jsonb(v_removal)); END IF;
 SELECT * INTO v_method FROM public."PaymentMethod" WHERE id=p_method_id AND user_id=p_user_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 INSERT INTO public."PaymentMethodRemoval" (stripe_payment_method_id,user_id,method_id,stripe_customer_id)
 VALUES(v_method.stripe_payment_method_id,p_user_id,p_method_id,v_method.stripe_customer_id)
 RETURNING * INTO v_removal;
 RETURN jsonb_build_object('removal',to_jsonb(v_removal));
END $$;

CREATE FUNCTION public.complete_payment_method_removal(p_method_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE v_method public."PaymentMethod"%ROWTYPE; v_user_id uuid; v_fallback uuid;
BEGIN
 IF p_method_id IS NULL OR p_method_id !~ '^pm_[A-Za-z0-9]+$' THEN
 RAISE EXCEPTION 'Invalid removed payment method' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('payment-method:'||p_method_id,0));
 SELECT * INTO v_method FROM public."PaymentMethod" WHERE stripe_payment_method_id=p_method_id;
 v_user_id:=v_method.user_id;
 IF v_user_id IS NULL THEN
  SELECT user_id INTO v_user_id FROM public."PaymentMethodRemoval" WHERE stripe_payment_method_id=p_method_id;
 END IF;
 IF v_user_id IS NOT NULL THEN PERFORM 1 FROM public."User" WHERE id=v_user_id FOR UPDATE; END IF;
 -- A verified detached method is permanently fenced even if its attachment
 -- webhook/save has not arrived yet. Clients cannot inspect unowned tombstones.
 INSERT INTO public."PaymentMethodRemoval" (stripe_payment_method_id,user_id,method_id,stripe_customer_id,completed_at)
 VALUES(p_method_id,v_method.user_id,v_method.id,v_method.stripe_customer_id,now())
 ON CONFLICT(stripe_payment_method_id) DO UPDATE SET completed_at=COALESCE("PaymentMethodRemoval".completed_at,excluded.completed_at);
 DELETE FROM public."PaymentMethod" WHERE stripe_payment_method_id=p_method_id;
 IF v_user_id IS NOT NULL AND NOT EXISTS(SELECT FROM public."PaymentMethod" WHERE user_id=v_user_id AND is_default IS TRUE) THEN
  SELECT m.id INTO v_fallback FROM public."PaymentMethod" m WHERE m.user_id=v_user_id
   AND NOT EXISTS(SELECT FROM public."PaymentMethodRemoval" r WHERE r.stripe_payment_method_id=m.stripe_payment_method_id)
   ORDER BY m.created_at DESC NULLS LAST,m.id DESC LIMIT 1;
  IF FOUND THEN UPDATE public."PaymentMethod" SET is_default=true WHERE id=v_fallback; END IF;
 END IF;
 RETURN jsonb_build_object('completed',true);
END $$;

REVOKE ALL ON FUNCTION public.bind_payment_customer(uuid,text),public.save_payment_method(uuid,text,text,jsonb),public.set_default_payment_method(uuid,uuid),
 public.begin_payment_method_removal(uuid,uuid),public.complete_payment_method_removal(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bind_payment_customer(uuid,text),public.save_payment_method(uuid,text,text,jsonb),public.set_default_payment_method(uuid,uuid),
 public.begin_payment_method_removal(uuid,uuid),public.complete_payment_method_removal(text) TO service_role;
