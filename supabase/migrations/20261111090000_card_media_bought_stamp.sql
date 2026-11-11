-- Backwards compatible: yes. No table, column, index, policy or trigger changes; one function is replaced with the same
-- signature, owner and grants: public.mail_stamp_card_accounting() (20261108010000_christmas_stamp_books), which the
-- existing trigger mail_stamp_card_accounting keeps calling.
-- Founder approved, November 11, 2026: a card's own photo or voice greeting goes only on a card sent with a bought
-- stamp. The server marks such a card when it stores it (mail_extracted.card.media_stamp = 'paid'; never shown to
-- anyone). A marked card always spends a bought stamp (bucket 'paid'), even while free stamps are left, and is refused
-- with CARD_MEDIA_NEEDS_STAMP when no bought stamp is left. That is decided under the same per-person lock as the
-- balance, so two sends at once can't both take the last bought stamp, and a marked card never goes without a stamp
-- (the free daily card). Cards without the mark are charged exactly as before: free stamps first. Taking a card back,
-- or its invitation expiring, still returns the stamp to the bucket it came from.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.mail_stamp_card_accounting() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b jsonb; spent "MailStampLedger"; bucket_name text; with_media boolean;
BEGIN
 IF TG_OP='INSERT' THEN
  with_media := NEW.mail_extracted->'card'->>'media_stamp' IS NOT NULL;
  IF NEW.mail_extracted->'card'->>'postage_v1' IS DISTINCT FROM 'true' THEN
   -- A card's own photo or voice never goes on a card without a stamp.
   IF with_media THEN RAISE EXCEPTION 'CARD_MEDIA_NEEDS_STAMP'; END IF;
   RETURN NEW;
  END IF;
  IF NOT ('holiday_card'=ANY(NEW.tags)) OR NEW.sender_user_id IS NULL THEN RAISE EXCEPTION 'STAMP_INVALID_CARD'; END IF;
  b:=mail_stamp_balance(NEW.sender_user_id);
  IF with_media AND (b->>'paid_remaining')::int<1 THEN RAISE EXCEPTION 'CARD_MEDIA_NEEDS_STAMP'; END IF;
  IF (b->>'available')::int<1 THEN RAISE EXCEPTION 'STAMPS_REQUIRED'; END IF;
  IF (SELECT count(*) FROM "MailStampLedger" WHERE user_id=NEW.sender_user_id AND delta=-1 AND mail_id IS NOT NULL AND created_at>now()-interval '24 hours')>=50 THEN RAISE EXCEPTION 'STAMP_DAILY_LIMIT'; END IF;
  bucket_name:=CASE WHEN with_media THEN 'paid' WHEN (b->>'free_remaining')::int>0 THEN 'free' ELSE 'paid' END;
  INSERT INTO "MailStampLedger"(user_id,event_key,bucket,delta,mail_id) VALUES(NEW.sender_user_id,'send:'||NEW.id,bucket_name,-1,NEW.id);
  RETURN NEW;
 END IF;
 -- Returning a card or expiring its invitation restores the original bucket once. Deleting delivered mail does not.
 IF (TG_OP='UPDATE' AND NEW.escrow_status IN ('withdrawn','expired') AND OLD.escrow_status IS DISTINCT FROM NEW.escrow_status)
 OR (TG_OP='DELETE' AND (OLD.delivered_at>now() OR OLD.escrow_status='pending')) THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('mail-stamps:'||OLD.sender_user_id::text,0));
  SELECT * INTO spent FROM "MailStampLedger" WHERE event_key='send:'||OLD.id;
  IF FOUND THEN INSERT INTO "MailStampLedger"(user_id,event_key,bucket,delta,mail_id) VALUES(spent.user_id,'return:'||OLD.id,spent.bucket,1,OLD.id) ON CONFLICT(event_key) DO NOTHING; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
REVOKE ALL ON FUNCTION public.mail_stamp_card_accounting() FROM PUBLIC, anon, authenticated;

COMMIT;
