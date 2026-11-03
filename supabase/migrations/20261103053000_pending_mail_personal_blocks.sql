-- Backwards compatible: yes. Existing tables and mail shapes are unchanged. Personal blocks now withdraw
-- undelivered personal correspondence and reject new deliveries across that block. Delivered correspondence,
-- household mail and mail sent as a business keep their existing rules. No new table or client requirement.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- Serialise a personal send/claim with a block of the same pair. Both trigger functions are volatile, so their
-- queries after waiting for this lock see the transaction that just committed (also under READ COMMITTED).
CREATE FUNCTION public.lock_personal_mail_pair(p_first uuid, p_second uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT pg_advisory_xact_lock(hashtextextended(
    'personal-mail:' || least(p_first, p_second)::text || ':' || greatest(p_first, p_second)::text, 0));
$$;
REVOKE ALL ON FUNCTION public.lock_personal_mail_pair(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lock_personal_mail_pair(uuid, uuid) TO service_role;

-- Resolve only Auth-confirmed contacts, never an editable profile email/phone. This lookup is service-only:
-- callers cannot use it to discover which email addresses have accounts. Unknown contacts remain claimable.
CREATE FUNCTION public.personal_mail_contact_user(p_contact text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT u.id FROM auth.users u WHERE
    (u.email_confirmed_at IS NOT NULL AND lower(btrim(u.email)) = lower(btrim(p_contact)))
    OR (u.phone_confirmed_at IS NOT NULL AND '+' || regexp_replace(u.phone, '[^0-9]', '', 'g') = p_contact)
  ORDER BY u.id LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.personal_mail_contact_user(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.personal_mail_contact_user(text) TO service_role;

CREATE FUNCTION public.withdraw_pending_personal_mail(p_first uuid, p_second uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM public.lock_personal_mail_pair(p_first, p_second);
  -- Keep the request receipt: a retry after a block or a later unblock must never recreate the card. Clearing
  -- every destination removes the piece from lists, counts, bundles, search, notices, details and enclosures.
  -- Its private storage object is unlinked, just as for a sender's take-back; no recipient route can read it.
  UPDATE public."Mail" m SET
    escrow_status = 'withdrawn', recipient_user_id = NULL, recipient_home_id = NULL,
    delivery_target_type = NULL, delivery_target_id = NULL, recipient_type = NULL, recipient_id = NULL,
    attn_user_id = NULL, attn_label = NULL, delivery_visibility = NULL,
    object_id = NULL, content = '', content_excerpt = '', preview_text = NULL, attachments = '{}',
    key_facts = '[]', translation_text = NULL, cover_image_url = NULL, download_url = NULL,
    mail_extracted = CASE WHEN m.mail_extracted->'card' IS NOT NULL THEN
      jsonb_build_object('card', jsonb_build_object(
        'request', m.mail_extracted #> '{card,request}',
        'withdrawn', jsonb_build_object('reason', 'blocked', 'at', clock_timestamp())))
      ELSE jsonb_build_object('withdrawn', jsonb_build_object('reason', 'blocked', 'at', clock_timestamp())) END
  WHERE m.sender_entity_id IS NULL AND m.recipient_home_id IS NULL
    AND (m.delivered_at > clock_timestamp() OR m.escrow_status = 'pending')
    AND ((m.sender_user_id = p_first AND coalesce(m.recipient_user_id,
            public.personal_mail_contact_user(m.escrow_recipient_contact)) = p_second)
      OR (m.sender_user_id = p_second AND coalesce(m.recipient_user_id,
            public.personal_mail_contact_user(m.escrow_recipient_contact)) = p_first));
END;
$$;

REVOKE ALL ON FUNCTION public.withdraw_pending_personal_mail(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_pending_personal_mail(uuid, uuid) TO service_role;

CREATE FUNCTION public.withdraw_mail_on_personal_block()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM public.withdraw_pending_personal_mail(NEW.blocker_user_id, NEW.blocked_user_id);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.withdraw_mail_on_personal_block() FROM PUBLIC, anon, authenticated;

-- BEFORE also runs on an ignored duplicate block, repairing pending mail from older servers on a retry.
CREATE TRIGGER withdraw_mail_on_personal_block
BEFORE INSERT OR UPDATE OF blocker_user_id, blocked_user_id ON public."UserBlock"
FOR EACH ROW EXECUTE FUNCTION public.withdraw_mail_on_personal_block();

CREATE FUNCTION public.admit_personal_mail_unblocked()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_recipient uuid;
BEGIN
  IF NEW.sender_entity_id IS NOT NULL OR NEW.recipient_home_id IS NOT NULL
    OR NEW.sender_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.sender_user_id IS NOT DISTINCT FROM OLD.sender_user_id
    AND NEW.recipient_user_id IS NOT DISTINCT FROM OLD.recipient_user_id
    AND NEW.escrow_recipient_contact IS NOT DISTINCT FROM OLD.escrow_recipient_contact THEN
    RETURN NEW;
  END IF;
  v_recipient := coalesce(NEW.recipient_user_id,
    CASE WHEN NEW.escrow_status = 'pending' THEN public.personal_mail_contact_user(NEW.escrow_recipient_contact) END);
  IF v_recipient IS NULL THEN RETURN NEW; END IF;
  PERFORM public.lock_personal_mail_pair(NEW.sender_user_id, v_recipient);
  IF EXISTS (SELECT 1 FROM public."UserBlock" b
    WHERE (b.blocker_user_id = NEW.sender_user_id AND b.blocked_user_id = v_recipient)
       OR (b.blocker_user_id = v_recipient AND b.blocked_user_id = NEW.sender_user_id)) THEN
    RAISE EXCEPTION 'MAIL_RECIPIENT_UNAVAILABLE' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.admit_personal_mail_unblocked() FROM PUBLIC, anon, authenticated;

-- Includes email claims: a known account cannot get around a block by addressing its email instead.
CREATE TRIGGER admit_personal_mail_unblocked
BEFORE INSERT OR UPDATE OF sender_user_id, recipient_user_id, escrow_recipient_contact ON public."Mail"
FOR EACH ROW EXECUTE FUNCTION public.admit_personal_mail_unblocked();

-- Apply the same rule to mail still waiting when this migration is installed. Previously delivered mail stays.
DO $$
DECLARE v_pair record;
BEGIN
  FOR v_pair IN
    SELECT DISTINCT b.blocker_user_id, b.blocked_user_id FROM public."UserBlock" b
    JOIN public."Mail" m ON
      ((m.sender_user_id = b.blocker_user_id AND coalesce(m.recipient_user_id,
          public.personal_mail_contact_user(m.escrow_recipient_contact)) = b.blocked_user_id)
        OR (m.sender_user_id = b.blocked_user_id AND coalesce(m.recipient_user_id,
          public.personal_mail_contact_user(m.escrow_recipient_contact)) = b.blocker_user_id))
    WHERE (m.delivered_at > clock_timestamp() OR m.escrow_status = 'pending')
      AND m.sender_entity_id IS NULL AND m.recipient_home_id IS NULL
    ORDER BY b.blocker_user_id, b.blocked_user_id
  LOOP
    PERFORM public.withdraw_pending_personal_mail(v_pair.blocker_user_id, v_pair.blocked_user_id);
  END LOOP;
END;
$$;

COMMIT;
