-- Backwards compatible: yes. Preserves the service-only signature and response.
-- Phone readers mark a letter viewed through this function; record the same opened timestamp/lifecycle
-- the web reader uses, so read mail has a dated envelope trail across clients. No data backfill.
SET LOCAL lock_timeout='5s';

CREATE OR REPLACE FUNCTION public.mark_mail_viewed_by_reader(p_mail_id uuid, p_user_id uuid)
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
    UPDATE public."Mail" SET last_opened_at = v_now, opened_at = COALESCE(opened_at, viewed_at, v_now),
      lifecycle = CASE WHEN lifecycle IS NULL OR lifecycle = 'delivered' THEN 'opened' ELSE lifecycle END WHERE id = p_mail_id;
    RETURN jsonb_build_object('success', true, 'alreadyViewed', true, 'payout', v_mail.payout_amount,
      'viewedAt', v_mail.viewed_at);
  END IF;

  UPDATE public."Mail"
  SET viewed = true,
      opened_at = COALESCE(opened_at, v_now),
      lifecycle = CASE WHEN lifecycle IS NULL OR lifecycle = 'delivered' THEN 'opened' ELSE lifecycle END,
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
