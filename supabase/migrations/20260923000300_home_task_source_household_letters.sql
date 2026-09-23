-- Backwards compatible: yes. Replaces one SECURITY DEFINER function body with the
-- same signature, return type and grants; no tables, rows or callers change.
-- Deploy migration before backend/web.
-- A household member could read a v1 household letter but not create a task
-- from it: home_task_source_access accepted only privacy 'shared_household' for
-- a household letter, while v1 letters sent to a Home keep 'private_to_person'.
-- "Create Task" on the letter (POST /api/mailbox/v2/p3/tasks/from-mail) and the
-- send-time create_task fan-out both failed with HOME_TASK_SOURCE_DENIED. Only
-- the final household test changes; recipient, attention, expiry, shred and
-- Home-binding checks are untouched.
SET LOCAL lock_timeout='5s';
CREATE OR REPLACE FUNCTION public.home_task_source_access(p_home_id uuid,p_user_id uuid,p_source_mail_id uuid,
  p_external boolean DEFAULT false) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE m public."Mail"%ROWTYPE; v_now timestamptz;
BEGIN
  IF p_source_mail_id IS NULL THEN RETURN true; END IF;
  SELECT * INTO m FROM public."Mail" WHERE id=p_source_mail_id FOR SHARE;
  IF NOT FOUND THEN RETURN false; END IF;
  v_now:=clock_timestamp();
  IF m.expires_at<=v_now OR m.time_limited_expires_at<=v_now OR m.lifecycle='shredded'
    OR m.access_count_max IS NOT NULL OR m.privacy IS NULL OR m.privacy NOT IN ('private_to_person','shared_household')
    OR m.recipient_home_id IS NOT NULL AND m.recipient_home_id<>p_home_id
    OR m.address_home_id IS NOT NULL AND m.address_home_id<>p_home_id
    OR m.address_id IS NOT NULL AND m.address_id<>p_home_id
    OR m.delivery_target_type='home' AND m.delivery_target_id IS DISTINCT FROM p_home_id
    OR m.recipient_type='home' AND m.recipient_id IS DISTINCT FROM p_home_id THEN RETURN false; END IF;
  IF p_external THEN
    RETURN m.recipient_home_id=p_home_id AND m.recipient_user_id IS NULL AND m.attn_user_id IS NULL
      AND (m.recipient_type IS NULL OR m.recipient_type='home')
      AND (m.delivery_target_type IS NULL OR m.delivery_target_type='home')
      AND (m.recipient_id IS NULL OR m.recipient_id=p_home_id)
      AND (m.delivery_target_id IS NULL OR m.delivery_target_id=p_home_id)
      AND m.privacy='shared_household' AND coalesce(m.delivery_visibility,'home_members')='home_members';
  END IF;
  IF p_user_id IS NULL THEN RETURN false; END IF;
  IF (m.recipient_user_id IS NOT NULL AND m.recipient_user_id<>p_user_id)
    OR (m.attn_user_id IS NOT NULL AND m.attn_user_id<>p_user_id)
    OR (m.recipient_type='user' AND m.recipient_id IS DISTINCT FROM p_user_id)
    OR (m.delivery_target_type='user' AND m.delivery_target_id IS DISTINCT FROM p_user_id)
    OR (m.delivery_visibility IN ('attn_only','attn_plus_admins') AND m.attn_user_id IS DISTINCT FROM p_user_id) THEN RETURN false; END IF;
  IF m.recipient_user_id IS NOT NULL THEN RETURN true; END IF;
  IF m.attn_user_id IS NOT NULL OR m.delivery_visibility IN ('attn_only','attn_plus_admins') THEN
    -- Administrative Home authority never substitutes for the actual addressee.
    RETURN m.attn_user_id=p_user_id;
  END IF;
  -- v1 letters sent to a Home keep the column default privacy
  -- 'private_to_person'. With no personal recipient or attention person they
  -- are household letters, as the Home mail rule (utils/homeMailAccess) reads them.
  RETURN m.recipient_home_id=p_home_id AND m.privacy IN ('shared_household','private_to_person')
    AND coalesce(m.delivery_visibility,'home_members')='home_members';
END $$;

