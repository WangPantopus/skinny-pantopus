-- Backwards compatible: yes. No table, column or index changes; one function is replaced with the same signature,
-- owner rights and grants. A card withdrawn by a block (20261103053000_pending_mail_personal_blocks) now keeps the
-- card's picture (design id) and the recipient's display name as stored when it was sent, inside its withdrawn record
-- (mail_extracted.card.withdrawn), so the sender's Sent can say "Couldn't be delivered" for it (founder, 2026-11-10;
-- memories contract section 8). They sit under `withdrawn`, not `card.design`, so every existing read still treats the
-- record as no card at all: no list, count, notice, search or recipient ever shows it. The note, media, recipient and
-- everything else are still removed exactly as before. Cards withdrawn before this migration stay as they are.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.withdraw_pending_personal_mail(p_first uuid, p_second uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM public.lock_personal_mail_pair(p_first, p_second);
  -- Keep the request receipt: a retry after a block or a later unblock must never recreate the card. Clearing
  -- every destination removes the piece from lists, counts, bundles, search, notices, details and enclosures.
  -- Its private storage object is unlinked, just as for a sender's take-back; no recipient route can read it.
  -- A card also keeps its picture and the name it went to, for its sender's Sent only.
  UPDATE public."Mail" m SET
    escrow_status = 'withdrawn', recipient_user_id = NULL, recipient_home_id = NULL,
    address_id = NULL, address_home_id = NULL,
    delivery_target_type = NULL, delivery_target_id = NULL, recipient_type = NULL, recipient_id = NULL,
    attn_user_id = NULL, attn_label = NULL, delivery_visibility = NULL,
    object_id = NULL, content = '', content_excerpt = '', preview_text = NULL, attachments = '{}',
    key_facts = '[]', translation_text = NULL, cover_image_url = NULL, download_url = NULL,
    mail_extracted = CASE WHEN m.mail_extracted->'card' IS NOT NULL THEN
      jsonb_build_object('card', jsonb_build_object(
        'request', m.mail_extracted #> '{card,request}',
        'withdrawn', jsonb_strip_nulls(jsonb_build_object('reason', 'blocked', 'at', clock_timestamp(),
          'design', m.mail_extracted #>> '{card,design}', 'to_name', m.mail_extracted #>> '{card,to_name}'))))
      ELSE jsonb_build_object('withdrawn', jsonb_build_object('reason', 'blocked', 'at', clock_timestamp())) END
  WHERE m.sender_entity_id IS NULL AND m.type = 'letter' AND m.delivery_target_type IS DISTINCT FROM 'home'
    AND (m.delivered_at > clock_timestamp() OR m.escrow_status = 'pending')
    AND ((m.sender_user_id = p_first AND coalesce(m.recipient_user_id,
            public.personal_mail_contact_user(m.escrow_recipient_contact)) = p_second)
      OR (m.sender_user_id = p_second AND coalesce(m.recipient_user_id,
            public.personal_mail_contact_user(m.escrow_recipient_contact)) = p_first));
END;
$$;

REVOKE ALL ON FUNCTION public.withdraw_pending_personal_mail(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_pending_personal_mail(uuid, uuid) TO service_role;

COMMIT;
