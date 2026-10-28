-- Backwards compatible: yes. Adds a service-only entry point; no table or data change.
-- The API checks the same Mailbox access rule as GET before starting a read session.
-- The legacy entry point remains unchanged for older backend deployments.
SET LOCAL lock_timeout='5s';

CREATE FUNCTION public.open_mail_read_session_by_reader(p_mail_id uuid, p_user_id uuid, p_client_meta jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_session public."MailReadSession"%ROWTYPE;
  v_mail public."Mail"%ROWTYPE;
BEGIN
  SELECT *
  INTO v_mail
  FROM public."Mail"
  WHERE id = p_mail_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mail not found');
  END IF;

  IF p_user_id IS NULL OR v_mail.deleted_at IS NOT NULL OR v_mail.delivered_at IS NULL
    OR v_mail.delivered_at > now() OR v_mail.lifecycle = 'shredded' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;

  SELECT *
  INTO v_session
  FROM public."MailReadSession"
  WHERE mail_id = p_mail_id
    AND user_id = p_user_id
    AND session_ended_at IS NULL
  LIMIT 1;

  IF FOUND THEN
    UPDATE public."MailReadSession"
    SET session_last_seen_at = now(),
        client_meta = COALESCE(client_meta, '{}'::jsonb) || COALESCE(p_client_meta, '{}'::jsonb),
        updated_at = now()
    WHERE id = v_session.id
    RETURNING * INTO v_session;
  ELSE
    INSERT INTO public."MailReadSession"(mail_id, user_id, client_meta)
    VALUES (p_mail_id, p_user_id, COALESCE(p_client_meta, '{}'::jsonb))
    RETURNING * INTO v_session;
  END IF;

  -- Keep viewed semantics compatible with existing app behavior.
  UPDATE public."Mail"
  SET viewed = TRUE,
      opened_at = COALESCE(opened_at, now()),
      lifecycle = CASE WHEN lifecycle IS NULL OR lifecycle = 'delivered' THEN 'opened' ELSE lifecycle END,
      viewed_at = COALESCE(viewed_at, now()),
      first_opened_at = COALESCE(first_opened_at, now()),
      last_opened_at = now(),
      view_count = view_count + 1
  WHERE id = p_mail_id;

  INSERT INTO public."MailEngagementEvent"(mail_id, user_id, session_id, event_type, event_meta)
  VALUES (p_mail_id, p_user_id, v_session.id, 'open', COALESCE(p_client_meta, '{}'::jsonb));

  INSERT INTO public."MailAction"(mail_id, user_id, action_type, metadata)
  VALUES (
    p_mail_id,
    p_user_id,
    'opened',
    jsonb_build_object('sessionId', v_session.id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'sessionId', v_session.id,
    'mailId', p_mail_id
  );
END;
$$;


REVOKE ALL ON FUNCTION public.open_mail_read_session_by_reader(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.open_mail_read_session_by_reader(uuid, uuid, jsonb) TO service_role;
