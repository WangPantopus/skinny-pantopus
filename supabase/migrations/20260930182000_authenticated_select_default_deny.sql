-- Backwards compatible: yes. Revokes every remaining privilege on public tables,
-- views and sequences from authenticated, including SELECT, and makes tables and
-- sequences created later start without them. service_role keeps its privileges,
-- and functions (EXECUTE) and rows are unchanged. The row-level-security policies
-- stay as defense in depth; the only policy change is at the end, where the three
-- chat read policies stop recursing, with the same meaning.
--
-- No app reads the database as a signed-in user. Web, iOS and Android call the
-- API, and none ships a Supabase client or the anon key. The backend reads and
-- writes through the service role; its per-request auth clients make only
-- GoTrue calls, and it never attaches a user session to a data client. Nothing
-- in this repository subscribes to Realtime, the supabase_realtime publication
-- is empty, no Storage policy reads public tables (the backend uses Storage
-- through the service role), and no auth hook is configured.
--
-- Until now, anyone with the anon key and their own session token could read,
-- straight through PostgREST, every row the read policies admit, around the
-- API's field masking. 20260930174000 (#992) removed client writes and
-- 20260930181000 (#1022) everything anon held.
--
-- PostGIS owns spatial_ref_sys, geography_columns and geometry_columns, so the
-- REVOKE only warns for those; they hold spatial reference metadata.
SET LOCAL lock_timeout='5s';

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM authenticated;

-- The chat read policies (defense in depth now) asked ChatParticipant about the
-- caller's own membership from inside ChatParticipant's own policy, so every
-- direct read of ChatParticipant, ChatRoom or ChatMessage failed with 42P17
-- (infinite recursion) before the privilege check could refuse it. The same
-- membership question now goes through a SECURITY DEFINER helper, so a direct
-- read is refused cleanly (42501) and the policies keep their meaning: an
-- active participant of the room. The helper answers only for the caller.
CREATE FUNCTION public.is_active_chat_participant(p_room_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public."ChatParticipant"
    WHERE room_id = p_room_id AND user_id = auth.uid() AND is_active)
$$;
REVOKE ALL ON FUNCTION public.is_active_chat_participant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_chat_participant(uuid) TO authenticated, service_role;

ALTER POLICY "Participants can view room participants" ON public."ChatParticipant"
  USING (public.is_active_chat_participant(room_id));
ALTER POLICY "Participants can view their chat rooms" ON public."ChatRoom"
  USING (public.is_active_chat_participant(id));
ALTER POLICY "Participants can view room messages" ON public."ChatMessage"
  USING (public.is_active_chat_participant(room_id));
