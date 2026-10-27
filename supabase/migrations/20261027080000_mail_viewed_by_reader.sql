-- Backwards compatible: yes. Adds one service-only function; no table, column, constraint or data change. Deployed
-- apps never call it, and mark_mail_viewed keeps its current rule for anyone who still calls it.
--
-- Opening a letter marks it read through PATCH /api/mailbox/:id/view, which called mark_mail_viewed. That function
-- decides access with can_view_mail, where a Home letter needs the mailbox.view permission that only owners have by
-- default, so a household member who opened a household letter got "Access denied" (400) and it stayed unread. The
-- backend now decides access with the Mailbox's own rule (canAccessMail, the rule every other mailbox route uses) and
-- then marks the letter read here, the same way mark_mail_viewed does.
SET LOCAL lock_timeout='5s';

CREATE FUNCTION public.mark_mail_viewed_by_reader(p_mail_id uuid, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_mail public."Mail"%ROWTYPE;
  v_now timestamptz := now();
BEGIN
  IF p_mail_id IS NULL OR p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mail not found');
  END IF;

  SELECT * INTO v_mail FROM public."Mail" WHERE id = p_mail_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mail not found');
  END IF;

  IF v_mail.viewed THEN
    UPDATE public."Mail" SET last_opened_at = v_now WHERE id = p_mail_id;
    RETURN jsonb_build_object('success', true, 'alreadyViewed', true, 'payout', v_mail.payout_amount,
      'viewedAt', v_mail.viewed_at);
  END IF;

  UPDATE public."Mail"
  SET viewed = true,
      viewed_at = v_now,
      first_opened_at = COALESCE(first_opened_at, v_now),
      last_opened_at = v_now,
      view_count = view_count + 1
  WHERE id = p_mail_id;

  INSERT INTO public."MailAction"(mail_id, user_id, action_type, metadata)
  VALUES (p_mail_id, p_user_id, 'viewed', jsonb_build_object('source', 'mark_mail_viewed'));

  IF v_mail.type = 'ad' AND v_mail.payout_amount IS NOT NULL THEN
    UPDATE public."Mail" SET payout_status = 'pending' WHERE id = p_mail_id AND payout_status IS NULL;
  END IF;

  RETURN jsonb_build_object('success', true, 'alreadyViewed', false, 'payout', v_mail.payout_amount, 'viewedAt', v_now);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_mail_viewed_by_reader(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_mail_viewed_by_reader(uuid, uuid) TO service_role;
