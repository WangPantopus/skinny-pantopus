-- Backwards compatible: yes. Existing authorized reads/content edits remain;
-- revoked proxy creators lose access. No table, column or stored row changes.
SET LOCAL lock_timeout='5s';

-- Bind the caller to auth.uid() and reuse existing friend/business permission
-- resolution. The definer wrapper avoids recursively applying BusinessTeam RLS
-- while evaluating Gig RLS; callers cannot ask about another actor's authority.
-- VOLATILE makes the UPDATE WITH CHECK read current authority after a row-lock
-- wait instead of retaining the statement's pre-revocation membership snapshot.
CREATE FUNCTION public.gig_creator_has_current_authority(p_owner_id uuid)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT auth.uid() IS NOT NULL AND coalesce(
  auth.uid()=p_owner_id OR public.can_proxy_post(auth.uid(),p_owner_id)
  OR (EXISTS(SELECT FROM public."User" WHERE id=p_owner_id AND account_type='business')
   AND public.business_has_permission(p_owner_id,'gigs.manage'::public.business_permission,auth.uid())),false)
$$;
REVOKE ALL ON FUNCTION public.gig_creator_has_current_authority(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gig_creator_has_current_authority(uuid) TO anon,authenticated,service_role;

ALTER POLICY gig_select_authorized ON public."Gig" USING (
 auth.uid()=user_id OR auth.uid()=beneficiary_user_id OR auth.uid()=accepted_by
 OR (auth.uid()=created_by AND public.gig_creator_has_current_authority(user_id))
);
ALTER POLICY gig_update_creator ON public."Gig" USING (
 auth.uid()=created_by AND public.gig_creator_has_current_authority(user_id)
) WITH CHECK (
 auth.uid()=created_by AND public.gig_creator_has_current_authority(user_id)
);
