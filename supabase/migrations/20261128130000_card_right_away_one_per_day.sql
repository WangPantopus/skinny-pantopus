-- Backwards compatible: yes. No table, column, index, policy or trigger changes; one function is replaced with the same
-- signature, owner and grants: public.admit_one_card_per_morning() (20261115100000_card_one_per_person_morning), which
-- the existing BEFORE INSERT trigger admit_one_card_per_morning keeps calling. Nothing is checked or changed in rows
-- already stored. A backend from before this change never writes the new mark, so its cards are decided exactly as
-- before; it answers the new refusal, which it can never cause, as "couldn't send your card just now" (503).
--
-- Founder approved, November 28, 2026: a Christmas card to someone on Pantopus can go right away. One such card from
-- a sender to the same person in a day where that person lives. The server marks a right-away card with that day
-- (mail_extracted.card.instant_day, 'YYYY-MM-DD' by the recipient's clock; never shown to anyone) and checks the rule
-- before it stores the card (routes/mailbox.js cardRightAwayThatDay), but several sends at once could all pass that
-- check before any of them was stored. The rule is decided here too, under the pair lock this function already takes
-- (lock_personal_mail_pair), so sends at once are decided one after another: a second card with the same sender,
-- recipient and instant_day is refused with CARD_SAME_DAY. A recipient deleting their copy doesn't open the day again.
-- A marked card is decided by its day alone: it lands the moment it is sent, so the one-per-morning rule (the same
-- delivered_at) has nothing to say about it. A card without the mark is decided exactly as before.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.admit_one_card_per_morning()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE instant_day text;
BEGIN
  IF NEW.sender_user_id IS NULL OR NEW.recipient_user_id IS NULL OR NEW.delivered_at IS NULL
    OR NEW.tags IS NULL OR NOT ('holiday_card' = ANY (NEW.tags)) THEN
    RETURN NEW;
  END IF;
  PERFORM public.lock_personal_mail_pair(NEW.sender_user_id, NEW.recipient_user_id);
  instant_day := NEW.mail_extracted->'card'->>'instant_day';
  IF instant_day IS NOT NULL THEN
    -- Right away: one from this sender to this person for that day.
    IF EXISTS (SELECT 1 FROM public."Mail" m
      WHERE m.recipient_user_id = NEW.recipient_user_id AND m.sender_user_id = NEW.sender_user_id
        AND 'holiday_card' = ANY (m.tags) AND m.mail_extracted->'card'->>'instant_day' = instant_day
        AND m.id IS DISTINCT FROM NEW.id) THEN
      RAISE EXCEPTION 'CARD_SAME_DAY' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public."Mail" m
    WHERE m.recipient_user_id = NEW.recipient_user_id AND m.delivered_at = NEW.delivered_at AND m.deleted_at IS NULL
      AND m.sender_user_id = NEW.sender_user_id AND 'holiday_card' = ANY (m.tags) AND m.id IS DISTINCT FROM NEW.id) THEN
    RAISE EXCEPTION 'CARD_SAME_MORNING' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.admit_one_card_per_morning() FROM PUBLIC, anon, authenticated;

COMMIT;
