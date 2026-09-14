-- Backwards compatible: yes. Finance API paths and record shapes remain;
-- direct clients must satisfy the same explicit finance permissions as the API.
-- No role grants or existing financial records change.
SET LOCAL lock_timeout = '5s';

DROP POLICY IF EXISTS "HomeBill_select" ON public."HomeBill";
DROP POLICY IF EXISTS "HomeBill_insert" ON public."HomeBill";
DROP POLICY IF EXISTS "HomeBill_update" ON public."HomeBill";
DROP POLICY IF EXISTS "HomeBill_delete" ON public."HomeBill";
DROP POLICY IF EXISTS homebill_select ON public."HomeBill";
DROP POLICY IF EXISTS homebill_write ON public."HomeBill";
DROP POLICY IF EXISTS "HomeSubscription_select" ON public."HomeSubscription";
DROP POLICY IF EXISTS "HomeSubscription_insert" ON public."HomeSubscription";
DROP POLICY IF EXISTS "HomeSubscription_update" ON public."HomeSubscription";
DROP POLICY IF EXISTS "HomeSubscription_delete" ON public."HomeSubscription";
DROP POLICY IF EXISTS homesub_select ON public."HomeSubscription";
DROP POLICY IF EXISTS homesub_write ON public."HomeSubscription";
DROP POLICY IF EXISTS "HomeBillSplit_select" ON public."HomeBillSplit";
DROP POLICY IF EXISTS "HomeBillSplit_insert" ON public."HomeBillSplit";
DROP POLICY IF EXISTS "HomeBillSplit_update" ON public."HomeBillSplit";
DROP POLICY IF EXISTS "HomeBillSplit_delete" ON public."HomeBillSplit";
DROP POLICY IF EXISTS homebsplit_select ON public."HomeBillSplit";
DROP POLICY IF EXISTS homebsplit_write ON public."HomeBillSplit";

-- Do not silently preserve an unreviewed permissive policy during adoption, or
-- remove an unknown restrictive policy that an operator deliberately installed.
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_policy WHERE polrelid IN (
    'public."HomeBill"'::regclass, 'public."HomeSubscription"'::regclass,
    'public."HomeBillSplit"'::regclass)) THEN
    RAISE EXCEPTION 'Unreviewed Home finance policies remain; reconcile them before applying this migration';
  END IF;
END $$;

-- Resolve a split's exact parent without inheriting the parent's SELECT policy.
-- This permits a management-only INSERT without exposing the bill. The caller
-- cannot supply another user, arbitrary table or a non-finance permission.
CREATE FUNCTION public.home_bill_has_finance_permission(p_bill_id uuid, p_permission public.home_permission)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce((SELECT public.home_has_permission(b.home_id, p_permission)
    FROM public."HomeBill" b WHERE b.id = p_bill_id
      AND p_permission IN ('finance.view', 'finance.manage')), false);
$$;
REVOKE ALL ON FUNCTION public.home_bill_has_finance_permission(uuid, public.home_permission)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.home_bill_has_finance_permission(uuid, public.home_permission)
  TO authenticated, service_role;

-- Separate command policies: FOR ALL would make finance.manage bypass an
-- explicit finance.view deny. PostgreSQL also requires SELECT for filtered
-- UPDATE/DELETE and RETURNING; blind INSERT does not imply read permission.
CREATE POLICY homebill_select ON public."HomeBill" FOR SELECT TO authenticated
  USING (public.home_has_permission(home_id, 'finance.view'));
CREATE POLICY homebill_insert ON public."HomeBill" FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.home_has_permission(home_id, 'finance.manage'));
CREATE POLICY homebill_update ON public."HomeBill" FOR UPDATE TO authenticated
  USING (public.home_has_permission(home_id, 'finance.manage'))
  WITH CHECK (public.home_has_permission(home_id, 'finance.manage'));
CREATE POLICY homebill_delete ON public."HomeBill" FOR DELETE TO authenticated
  USING (public.home_has_permission(home_id, 'finance.manage'));

CREATE POLICY homesub_select ON public."HomeSubscription" FOR SELECT TO authenticated
  USING (public.home_has_permission(home_id, 'finance.view'));
CREATE POLICY homesub_insert ON public."HomeSubscription" FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.home_has_permission(home_id, 'finance.manage'));
CREATE POLICY homesub_update ON public."HomeSubscription" FOR UPDATE TO authenticated
  USING (public.home_has_permission(home_id, 'finance.manage'))
  WITH CHECK (public.home_has_permission(home_id, 'finance.manage'));
CREATE POLICY homesub_delete ON public."HomeSubscription" FOR DELETE TO authenticated
  USING (public.home_has_permission(home_id, 'finance.manage'));

CREATE POLICY homebsplit_select ON public."HomeBillSplit" FOR SELECT TO authenticated
  USING (public.home_bill_has_finance_permission(bill_id, 'finance.view'));
CREATE POLICY homebsplit_insert ON public."HomeBillSplit" FOR INSERT TO authenticated
  WITH CHECK (public.home_bill_has_finance_permission(bill_id, 'finance.manage'));
CREATE POLICY homebsplit_update ON public."HomeBillSplit" FOR UPDATE TO authenticated
  USING (public.home_bill_has_finance_permission(bill_id, 'finance.manage'))
  WITH CHECK (public.home_bill_has_finance_permission(bill_id, 'finance.manage'));
CREATE POLICY homebsplit_delete ON public."HomeBillSplit" FOR DELETE TO authenticated
  USING (public.home_bill_has_finance_permission(bill_id, 'finance.manage'));

-- RLS does not govern TRUNCATE. Clients retain ordinary DML subject to the
-- policies above; schema/trigger operations remain operator capabilities.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public."HomeBill", public."HomeSubscription",
  public."HomeBillSplit" FROM PUBLIC, anon, authenticated;
