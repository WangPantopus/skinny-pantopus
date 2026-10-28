-- Backwards compatible: yes. Disputed Homes cannot issue invitations or
-- admit recipients through previously issued invitations. Existing roles,
-- policies, invite identities, and membership rows remain unchanged.
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.home_invite_authority(p_home_id uuid,p_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_access jsonb; v_now timestamptz:=clock_timestamp();
BEGIN
  v_access:=public.home_effective_access(p_home_id,p_user_id);
  IF p_user_id IS NULL OR NOT (v_access->'permissions') ? 'members.manage'
    OR EXISTS (SELECT FROM public."Home" WHERE id=p_home_id
      AND (security_state IN ('frozen','frozen_silent','disputed') OR home_status IN ('merged','archived')))
    OR EXISTS (SELECT FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_user_id
      AND (start_at>v_now OR end_at<=v_now OR access_start_at>v_now OR access_end_at<=v_now))
    OR (v_access->>'is_owner'='true' AND EXISTS (SELECT FROM public."HomeOwner" WHERE home_id=p_home_id
      AND subject_type='user' AND subject_id=p_user_id AND owner_status IN ('revoked','disputed'))
      AND NOT EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user'
        AND subject_id=p_user_id AND owner_status='verified')) THEN RETURN NULL; END IF;
  RETURN v_access;
END $$;

REVOKE ALL ON FUNCTION public.home_invite_authority(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.home_invite_authority(uuid,uuid) TO service_role;
