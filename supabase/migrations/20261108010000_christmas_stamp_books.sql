-- Backwards compatible: yes. Additive, server-only accounting; only cards explicitly marked postage_v1 are charged.
-- Founder approved purchase and credit tables, November 7, 2026.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE public."MailStampPurchase" (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public."User"(id),
 provider text NOT NULL CHECK(provider IN ('stripe','apple','google')), reference text NOT NULL,
 product_id text NOT NULL, credits integer NOT NULL CHECK(credits IN (5,20,50)),
 revoked boolean NOT NULL DEFAULT false, checked_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(provider,reference)
);
CREATE TABLE public."MailStampLedger" (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, user_id uuid NOT NULL REFERENCES public."User"(id),
 event_key text NOT NULL UNIQUE, bucket text NOT NULL CHECK(bucket IN ('free','paid')),
 delta integer NOT NULL CHECK(delta <> 0), mail_id uuid, purchase_id uuid REFERENCES public."MailStampPurchase"(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public."MailStampLedger"(user_id,created_at);
CREATE INDEX ON public."MailStampLedger"(mail_id) WHERE mail_id IS NOT NULL;
CREATE INDEX ON public."MailStampPurchase"(checked_at) WHERE NOT revoked;
ALTER TABLE public."MailStampPurchase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MailStampLedger" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."MailStampPurchase", public."MailStampLedger" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."MailStampPurchase", public."MailStampLedger" TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public."MailStampLedger_id_seq" TO service_role;

CREATE FUNCTION public.mail_stamp_balance(p_user uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE f integer; p integer;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('mail-stamps:'||p_user::text,0));
 INSERT INTO "MailStampLedger"(user_id,event_key,bucket,delta) VALUES(p_user,'welcome:'||p_user,'free',3) ON CONFLICT(event_key) DO NOTHING;
 SELECT COALESCE(sum(delta) FILTER(WHERE bucket='free'),0), COALESCE(sum(delta) FILTER(WHERE bucket='paid'),0) INTO f,p FROM "MailStampLedger" WHERE user_id=p_user;
 RETURN jsonb_build_object('free_remaining',f,'paid_remaining',p,'available',CASE WHEN p<0 THEN 0 ELSE greatest(0,f+p) END);
END $$;

CREATE FUNCTION public.mail_stamp_purchase(p_user uuid,p_provider text,p_reference text,p_product text,p_credits integer,p_revoked boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE purchase "MailStampPurchase";
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('mail-stamps:'||p_user::text,0));
 INSERT INTO "MailStampPurchase"(user_id,provider,reference,product_id,credits) VALUES(p_user,p_provider,p_reference,p_product,p_credits) ON CONFLICT(provider,reference) DO NOTHING;
 SELECT * INTO STRICT purchase FROM "MailStampPurchase" WHERE provider=p_provider AND reference=p_reference FOR UPDATE;
 IF purchase.user_id<>p_user OR purchase.product_id<>p_product OR purchase.credits<>p_credits THEN RAISE EXCEPTION 'STAMP_PURCHASE_CONFLICT'; END IF;
 INSERT INTO "MailStampLedger"(user_id,event_key,bucket,delta,purchase_id) VALUES(p_user,'purchase:'||purchase.id,'paid',p_credits,purchase.id) ON CONFLICT(event_key) DO NOTHING;
 IF p_revoked OR purchase.revoked THEN
  INSERT INTO "MailStampLedger"(user_id,event_key,bucket,delta,purchase_id) VALUES(p_user,'revoke:'||purchase.id,'paid',-p_credits,purchase.id) ON CONFLICT(event_key) DO NOTHING;
 END IF;
 UPDATE "MailStampPurchase" SET revoked=revoked OR p_revoked,checked_at=now() WHERE id=purchase.id;
 RETURN mail_stamp_balance(p_user);
END $$;

CREATE FUNCTION public.mail_stamp_card_accounting() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b jsonb; spent "MailStampLedger"; bucket_name text;
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.mail_extracted->'card'->>'postage_v1' IS DISTINCT FROM 'true' THEN RETURN NEW; END IF;
  IF NOT ('holiday_card'=ANY(NEW.tags)) OR NEW.sender_user_id IS NULL THEN RAISE EXCEPTION 'STAMP_INVALID_CARD'; END IF;
  b:=mail_stamp_balance(NEW.sender_user_id);
  IF (b->>'available')::int<1 THEN RAISE EXCEPTION 'STAMPS_REQUIRED'; END IF;
  IF (SELECT count(*) FROM "MailStampLedger" WHERE user_id=NEW.sender_user_id AND delta=-1 AND mail_id IS NOT NULL AND created_at>now()-interval '24 hours')>=50 THEN RAISE EXCEPTION 'STAMP_DAILY_LIMIT'; END IF;
  bucket_name:=CASE WHEN (b->>'free_remaining')::int>0 THEN 'free' ELSE 'paid' END;
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
CREATE TRIGGER mail_stamp_card_accounting AFTER INSERT OR UPDATE OR DELETE ON public."Mail" FOR EACH ROW EXECUTE FUNCTION public.mail_stamp_card_accounting();
REVOKE ALL ON FUNCTION public.mail_stamp_balance(uuid),public.mail_stamp_purchase(uuid,text,text,text,integer,boolean),public.mail_stamp_card_accounting() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mail_stamp_balance(uuid),public.mail_stamp_purchase(uuid,text,text,text,integer,boolean) TO service_role;
-- Direct PostgREST callers must use the checked server composer for cards, even while monetization is off.
CREATE POLICY mail_cards_server_insert ON public."Mail" AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK (mail_extracted->'card' IS NULL AND NOT COALESCE('holiday_card'=ANY(tags),false));
CREATE FUNCTION public.mail_stamp_protect_card() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF current_user NOT IN ('postgres','service_role') AND
    (OLD.mail_extracted->'card' IS NOT NULL OR NEW.mail_extracted->'card' IS NOT NULL) AND
    (NEW.mail_extracted IS DISTINCT FROM OLD.mail_extracted OR NEW.escrow_status IS DISTINCT FROM OLD.escrow_status
     OR NEW.delivered_at IS DISTINCT FROM OLD.delivered_at OR NEW.escrow_expires_at IS DISTINCT FROM OLD.escrow_expires_at
     OR NEW.sender_user_id IS DISTINCT FROM OLD.sender_user_id OR NEW.id IS DISTINCT FROM OLD.id) THEN
  RAISE EXCEPTION 'STAMP_CARD_SERVER_ONLY';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER mail_stamp_protect_card BEFORE UPDATE ON public."Mail" FOR EACH ROW EXECUTE FUNCTION public.mail_stamp_protect_card();
REVOKE ALL ON FUNCTION public.mail_stamp_protect_card() FROM PUBLIC,anon,authenticated;
COMMIT;
