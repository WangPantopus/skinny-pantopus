-- Backwards compatible: yes. Revokes EXECUTE on two SECURITY DEFINER functions
-- from PUBLIC, anon and authenticated; service_role keeps it. Nothing calls
-- either one from a client or the backend: the API reads memberships and applies
-- role presets itself, as service_role (routes/businessIam.js).
--
-- business_get_user_permissions(p_business_user_id, p_user_id DEFAULT auth.uid())
-- used whatever p_user_id a caller passed. So anyone holding the anon key, with
-- no sign-in at all, could learn whether a person is on a business team and what
-- they may do there. The DEFAULT auth.uid() made it look bound to the caller,
-- and #996's scan listed it that way.
--
-- apply_business_role_preset checks the caller's team.manage, but a manager
-- calling it directly skipped the API's rules: only the owner promotes to owner,
-- nobody demotes themselves from owner, and ranks are enforced.
SET LOCAL lock_timeout='5s';

REVOKE ALL ON FUNCTION public.business_get_user_permissions(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_business_role_preset(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.business_get_user_permissions(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_business_role_preset(uuid, uuid, text) TO service_role;
