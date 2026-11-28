-- Backwards compatible: yes. No table, column, index, policy or trigger changes; one function is replaced with the same
-- signature, owner and grants: public.mail_stamp_card_accounting() (20261111090000_card_media_bought_stamp), which the
-- existing trigger mail_stamp_card_accounting keeps calling.
-- Founder approved, November 28, 2026: a person's first two cards with their own photo or voice greeting are free;
-- after them each such card spends a bought stamp, as every one has since November 11. How many are free is the
-- server's setting, so the server writes it on the card when it asks for a free one:
-- mail_extracted.card.media_free = true and media_free_limit = <how many> (never shown to anyone), with no media_stamp.
-- A card so marked is given a free one only while fewer than that many of its sender's cards hold one, counted here
-- under the same per-person lock as the stamp balance, so sends at once can't take more than there are. It then takes
-- a stamp like a card without a photo or voice: free stamps first. With none left it is refused with
-- CARD_MEDIA_FREE_USED and nothing is stored or spent; the server then stores it as a card marked media_stamp, which
-- is decided exactly as before.
-- A card holds its free one for as long as it is stored and was neither taken back nor expired: a recipient deleting
-- their copy (deleted_at) gives nothing back. Taking a card back, or its invitation expiring, returns its free one as
-- it returns its stamp (a card to a person that is taken back loses its marks or its row; one by email or link turns
-- 'withdrawn' or 'expired').
-- A card without the new mark is charged exactly as before, by the same statements in the same order. A backend from
-- before this change never writes the mark. A marked card stored after a rollback of this migration would be charged
-- as a card without a photo or voice, so the backend that writes the mark must be released after this migration.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.mail_stamp_card_accounting() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b jsonb; spent "MailStampLedger"; bucket_name text; with_media boolean; wants_free boolean; free_limit integer;
BEGIN
 IF TG_OP='INSERT' THEN
  with_media := NEW.mail_extracted->'card'->>'media_stamp' IS NOT NULL;
  -- Asking for one of the sender's free photo or voice cards; a card marked media_stamp never is.
  wants_free := NOT with_media AND COALESCE(NEW.mail_extracted->'card'->>'media_free','') = 'true';
  IF NEW.mail_extracted->'card'->>'postage_v1' IS DISTINCT FROM 'true' THEN
   -- A card's own photo or voice never goes on a card without a stamp.
   IF with_media OR wants_free THEN RAISE EXCEPTION 'CARD_MEDIA_NEEDS_STAMP'; END IF;
   RETURN NEW;
  END IF;
  IF NOT ('holiday_card'=ANY(NEW.tags)) OR NEW.sender_user_id IS NULL THEN RAISE EXCEPTION 'STAMP_INVALID_CARD'; END IF;
  b:=mail_stamp_balance(NEW.sender_user_id);
  IF wants_free THEN
   -- Under the sender's lock (mail_stamp_balance took it): the cards of theirs that hold a free one now, this one apart.
   free_limit := CASE WHEN NEW.mail_extracted->'card'->>'media_free_limit' ~ '^[0-9]{1,4}$'
    THEN (NEW.mail_extracted->'card'->>'media_free_limit')::int ELSE 0 END;
   IF (SELECT count(*) FROM "Mail" m WHERE m.sender_user_id=NEW.sender_user_id AND m.id<>NEW.id
     AND 'holiday_card'=ANY(m.tags) AND m.mail_extracted->'card'->>'media_free'='true'
     AND (m.escrow_status IS NULL OR m.escrow_status NOT IN ('withdrawn','expired')))>=free_limit THEN
    RAISE EXCEPTION 'CARD_MEDIA_FREE_USED';
   END IF;
  END IF;
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
