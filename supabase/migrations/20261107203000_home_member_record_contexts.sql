-- Backwards compatible: yes. Adds one service-only read function and changes nothing else; the deployed backend
-- doesn't call it, and the backend that does calls it only where it checks members one by one today.
-- A Home's member list checks each current member against home_record_context (the SQL admission fence and age
-- ceiling), one call per member after the members are read, and again for the consistency recheck. This returns that
-- same context for every active, verified occupant of a Home in one call, so the check can go out alongside the
-- members' read instead of after it.
SET LOCAL lock_timeout='5s';

CREATE FUNCTION public.home_member_record_contexts(p_home_id uuid)
RETURNS TABLE(user_id uuid, context jsonb)
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT o.user_id, public.home_record_context(p_home_id, o.user_id)
  FROM public."HomeOccupancy" o
  WHERE o.home_id = p_home_id AND o.is_active = true AND o.verification_status = 'verified'
$$;

REVOKE ALL ON FUNCTION public.home_member_record_contexts(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.home_member_record_contexts(uuid) TO service_role;
