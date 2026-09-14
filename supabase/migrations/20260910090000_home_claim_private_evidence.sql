-- Backwards compatible: yes. Add private claim evidence intent/inspection
-- contracts; legacy references stay quarantined and no pending proof is verified.
SET LOCAL lock_timeout='5s';

CREATE TABLE public."HomeClaimEvidenceIntent" (
  id uuid PRIMARY KEY,
  original_home_id uuid NOT NULL,
  original_claim_id uuid NOT NULL,
  uploaded_by uuid NOT NULL,
  home_id uuid REFERENCES public."Home"(id) ON DELETE SET NULL,
  claim_id uuid REFERENCES public."HomeOwnershipClaim"(id) ON DELETE SET NULL,
  file_id uuid REFERENCES public."File"(id) ON DELETE SET NULL,
  evidence_type text NOT NULL CHECK(evidence_type IN ('deed','closing_disclosure','tax_bill','utility_bill','lease')),
  storage_bucket text NOT NULL CHECK(storage_bucket ~ '^[a-z0-9][a-z0-9-]{2,62}$'),
  sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
  file_name text NOT NULL CHECK(length(file_name) BETWEEN 1 AND 255),
  mime_type text NOT NULL CHECK(mime_type IN ('application/pdf','text/plain','image/jpeg','image/png','image/webp','image/heic','image/heif')),
  file_size bigint NOT NULL CHECK(file_size BETWEEN 1 AND 26214400),
  state text NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','ready','retired')),
  verified_by uuid,
  verified_at timestamptz,
  upload_attempt uuid,
  cleanup_claim uuid,
  cleanup_pending boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  retired_at timestamptz,
  CHECK(home_id IS NULL OR home_id=original_home_id),
  CHECK(claim_id IS NULL OR claim_id=original_claim_id),
  CHECK(file_id IS NULL OR file_id=id),
  CHECK(state='retired' OR (home_id IS NOT NULL AND claim_id IS NOT NULL)),
  CHECK((verified_by IS NULL)=(verified_at IS NULL))
);
ALTER TABLE public."HomeClaimEvidenceIntent" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."HomeClaimEvidenceIntent" FROM PUBLIC,anon,authenticated;
GRANT ALL ON public."HomeClaimEvidenceIntent" TO service_role;
CREATE INDEX home_claim_evidence_intent_claim ON public."HomeClaimEvidenceIntent"(original_home_id,original_claim_id,id);
CREATE INDEX home_claim_evidence_cleanup_due ON public."HomeClaimEvidenceIntent"(updated_at,id) WHERE state<>'ready';
ALTER TABLE public."HomeVerificationEvidence" ADD COLUMN private_upload_id uuid UNIQUE REFERENCES public."HomeClaimEvidenceIntent"(id);

CREATE TABLE public."HomeClaimEvidenceInspection" (
  receipt_hash text PRIMARY KEY CHECK(receipt_hash ~ '^[a-f0-9]{64}$'),
  upload_id uuid NOT NULL REFERENCES public."HomeClaimEvidenceIntent"(id),
  actor_user_id uuid NOT NULL,
  platform_admin boolean NOT NULL,
  review_token text NOT NULL CHECK(review_token ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '15 minutes',
  verified_at timestamptz,
  result_snapshot text,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public."HomeClaimEvidenceInspection" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."HomeClaimEvidenceInspection" FROM PUBLIC,anon,authenticated;
GRANT ALL ON public."HomeClaimEvidenceInspection" TO service_role;
CREATE POLICY file_claim_evidence_api_only ON public."File" AS RESTRICTIVE FOR SELECT TO PUBLIC
  USING(coalesce(metadata->>'storage_contract','')<>'home_claim_evidence_v1');

CREATE FUNCTION public.home_claim_evidence_key(i public."HomeClaimEvidenceIntent") RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
  SELECT 'claim-evidence/'||i.original_home_id::text||'/'||i.original_claim_id::text||'/'||i.id::text||'/'||i.sha256;
$$;
CREATE FUNCTION public.home_claim_evidence_storage(i public."HomeClaimEvidenceIntent") RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
  SELECT jsonb_build_object('upload_id',i.id,'home_id',i.original_home_id,'claim_id',i.original_claim_id,
    'bucket',i.storage_bucket,'sha256',i.sha256,'size',i.file_size,'mime_type',i.mime_type,
    'upload_attempt',i.upload_attempt,'cleanup_claim',i.cleanup_claim);
$$;
CREATE FUNCTION public.home_claim_evidence_projection(i public."HomeClaimEvidenceIntent") RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
  SELECT jsonb_build_object('id',i.id,'home_id',i.original_home_id,'claim_id',i.original_claim_id,
    'evidence_type',i.evidence_type,'provider','manual','status',CASE WHEN i.state='retired' THEN 'failed' WHEN i.verified_at IS NOT NULL THEN 'verified' ELSE 'pending' END,
    'file_name',i.file_name,'file_size',i.file_size,'mime_type',i.mime_type,'created_at',i.created_at,
    'state',i.state,'available',i.state='ready','eligible_for_review',i.state='ready' AND i.verified_at IS NOT NULL,
    'cleanup_pending',i.cleanup_pending);
$$;

CREATE FUNCTION public.protect_home_claim_evidence_intent() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Claim upload tombstones must be retained' USING ERRCODE='23514'; END IF;
  IF ROW(NEW.id,NEW.original_home_id,NEW.original_claim_id,NEW.uploaded_by,NEW.evidence_type,NEW.storage_bucket,
      NEW.sha256,NEW.file_name,NEW.mime_type,NEW.file_size,NEW.created_at) IS DISTINCT FROM
    ROW(OLD.id,OLD.original_home_id,OLD.original_claim_id,OLD.uploaded_by,OLD.evidence_type,OLD.storage_bucket,
      OLD.sha256,OLD.file_name,OLD.mime_type,OLD.file_size,OLD.created_at)
    OR (OLD.state='retired' AND NEW.state<>'retired') OR (OLD.state='ready' AND NEW.state='reserved')
    OR (OLD.home_id IS NULL AND NEW.home_id IS NOT NULL) OR (OLD.claim_id IS NULL AND NEW.claim_id IS NOT NULL)
    OR (OLD.verified_at IS NOT NULL AND ROW(NEW.verified_by,NEW.verified_at) IS DISTINCT FROM ROW(OLD.verified_by,OLD.verified_at)) THEN
    RAISE EXCEPTION 'Claim upload identity and history are immutable' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
-- The intent, quota reservation and published pending evidence are separate
-- checkpoints. Provider writes occur only after a committed reservation.
CREATE FUNCTION public.mutate_home_claim_evidence(p_home_id uuid,p_claim_id uuid,p_actor_id uuid,
  p_action text,p_upload_id uuid,p_payload jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE a jsonb; i public."HomeClaimEvidenceIntent"%ROWTYPE; f public."File"%ROWTYPE;
BEGIN
  IF p_upload_id IS NULL OR p_action IS NULL OR p_action NOT IN ('reserve','begin_upload','finalize','retire')
    OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR (p_action<>'reserve' AND p_payload<>'{}') THEN
    RETURN '{"ok":false,"code":"CLAIM_EVIDENCE_INVALID","status":400}'::jsonb; END IF;
  a:=public.authorize_home_claim_evidence(p_home_id,p_claim_id,p_actor_id,CASE WHEN p_action='retire' THEN 'retire' ELSE 'upload' END);
  IF a->>'ok' IS DISTINCT FROM 'true' THEN RETURN a; END IF;
  SELECT * INTO i FROM public."HomeClaimEvidenceIntent" WHERE id=p_upload_id FOR UPDATE;
  IF FOUND AND (i.original_home_id<>p_home_id OR i.original_claim_id<>p_claim_id OR i.uploaded_by<>p_actor_id) THEN
    RETURN '{"ok":false,"code":"CLAIM_UPLOAD_CONFLICT","status":409}'::jsonb; END IF;
  a:=public.authorize_home_claim_evidence(p_home_id,p_claim_id,p_actor_id,CASE WHEN p_action='retire' THEN 'retire' ELSE 'upload' END);
  IF a->>'ok' IS DISTINCT FROM 'true' THEN RETURN a; END IF;
  IF p_action='reserve' THEN
    IF EXISTS(SELECT FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('bucket','sha256','file_name','mime_type','file_size','evidence_type'))
      OR coalesce(p_payload->>'bucket','') !~ '^[a-z0-9][a-z0-9-]{2,62}$'
      OR coalesce(p_payload->>'sha256','') !~ '^[a-f0-9]{64}$'
      OR length(coalesce(p_payload->>'file_name','')) NOT BETWEEN 1 AND 255
      OR coalesce(p_payload->>'mime_type','') NOT IN ('application/pdf','text/plain','image/jpeg','image/png','image/webp','image/heic','image/heif')
      OR coalesce(p_payload->>'evidence_type','') NOT IN ('deed','closing_disclosure','tax_bill','utility_bill','lease')
      OR coalesce(p_payload->>'file_size','') !~ '^[0-9]{1,8}$' THEN
      RETURN '{"ok":false,"code":"CLAIM_EVIDENCE_INVALID","status":400}'::jsonb; END IF;
    IF (p_payload->>'file_size')::bigint NOT BETWEEN 1 AND 26214400 THEN
      RETURN '{"ok":false,"code":"CLAIM_EVIDENCE_INVALID","status":400}'::jsonb; END IF;
    IF i.id IS NOT NULL AND (i.storage_bucket IS DISTINCT FROM p_payload->>'bucket' OR i.sha256 IS DISTINCT FROM p_payload->>'sha256'
      OR i.file_name IS DISTINCT FROM p_payload->>'file_name' OR i.mime_type IS DISTINCT FROM p_payload->>'mime_type'
      OR i.file_size IS DISTINCT FROM (p_payload->>'file_size')::bigint OR i.evidence_type IS DISTINCT FROM p_payload->>'evidence_type') THEN
      RETURN '{"ok":false,"code":"CLAIM_UPLOAD_CONFLICT","status":409}'::jsonb; END IF;
    IF i.id IS NULL THEN
      INSERT INTO public."HomeClaimEvidenceIntent"(id,original_home_id,original_claim_id,uploaded_by,home_id,claim_id,
        evidence_type,storage_bucket,sha256,file_name,mime_type,file_size)
      VALUES(p_upload_id,p_home_id,p_claim_id,p_actor_id,p_home_id,p_claim_id,p_payload->>'evidence_type',p_payload->>'bucket',
        p_payload->>'sha256',p_payload->>'file_name',p_payload->>'mime_type',(p_payload->>'file_size')::bigint) RETURNING * INTO i;
      INSERT INTO public."File"(id,user_id,home_id,filename,original_filename,file_path,file_url,file_size,mime_type,file_extension,
        file_type,visibility,processing_status,metadata)
      VALUES(i.id,i.uploaded_by,i.home_id,i.file_name,i.file_name,public.home_claim_evidence_key(i),'',i.file_size,i.mime_type,'',
        'other','private','uploading',jsonb_build_object('storage_contract','home_claim_evidence_v1','upload_id',i.id));
      UPDATE public."HomeClaimEvidenceIntent" SET file_id=id WHERE id=i.id RETURNING * INTO i;
    END IF;
  ELSIF i.id IS NULL THEN RETURN '{"ok":false,"code":"CLAIM_EVIDENCE_NOT_FOUND","status":404}'::jsonb;
  END IF;
  IF p_action<>'retire' AND i.state='retired' THEN RETURN '{"ok":false,"code":"CLAIM_UPLOAD_RETIRED","status":409}'::jsonb; END IF;
  IF p_action='retire' AND i.verified_at IS NOT NULL THEN
    RETURN '{"ok":false,"code":"CLAIM_EVIDENCE_RETENTION_REQUIRED","status":409}'::jsonb; END IF;
  SELECT * INTO f FROM public."File" WHERE id=i.file_id FOR UPDATE;
  IF NOT FOUND OR f.metadata->>'storage_contract' IS DISTINCT FROM 'home_claim_evidence_v1'
    OR f.is_deleted IS DISTINCT FROM (i.state='retired') THEN RETURN '{"ok":false,"code":"CLAIM_EVIDENCE_UNAVAILABLE","status":503}'::jsonb; END IF;
  IF p_action='begin_upload' AND i.state='reserved' THEN
    UPDATE public."HomeClaimEvidenceIntent" SET upload_attempt=gen_random_uuid(),updated_at=clock_timestamp() WHERE id=i.id RETURNING * INTO i;
  ELSIF p_action='finalize' AND i.state='reserved' THEN
    IF i.upload_attempt IS NULL THEN RETURN '{"ok":false,"code":"CLAIM_UPLOAD_CONFLICT","status":409}'::jsonb; END IF;
    UPDATE public."HomeClaimEvidenceIntent" SET state='ready',updated_at=clock_timestamp() WHERE id=i.id RETURNING * INTO i;
    UPDATE public."File" SET processing_status='completed',updated_at=clock_timestamp() WHERE id=i.file_id;
    INSERT INTO public."HomeVerificationEvidence"(id,private_upload_id,claim_id,evidence_type,provider,status,storage_ref,metadata)
      VALUES(i.id,i.id,i.original_claim_id,i.evidence_type,'manual','pending',NULL,
        jsonb_build_object('storage_contract','home_claim_evidence_v1','upload_id',i.id));
  ELSIF p_action='retire' AND i.state<>'retired' THEN
    UPDATE public."HomeClaimEvidenceIntent" SET state='retired',retired_at=clock_timestamp(),updated_at=clock_timestamp(),
      cleanup_pending=true,cleanup_claim=gen_random_uuid() WHERE id=i.id RETURNING * INTO i;
    UPDATE public."HomeVerificationEvidence" SET status='failed',updated_at=clock_timestamp() WHERE private_upload_id=i.id AND id=i.id;
    UPDATE public."File" SET is_deleted=true,deleted_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=i.file_id;
    UPDATE public."FileQuota" SET storage_used=greatest(storage_used-i.file_size,0),file_count=greatest(file_count-1,0),updated_at=clock_timestamp()
      WHERE user_id=i.uploaded_by;
  ELSIF p_action='retire' THEN
    UPDATE public."HomeClaimEvidenceIntent" SET cleanup_pending=true,cleanup_claim=gen_random_uuid(),updated_at=clock_timestamp()
      WHERE id=i.id RETURNING * INTO i;
  END IF;
  a:=public.authorize_home_claim_evidence(p_home_id,p_claim_id,p_actor_id,CASE WHEN p_action='retire' THEN 'retire' ELSE 'upload' END);
  IF a->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Claim access changed' USING ERRCODE='PT403'; END IF;
  RETURN jsonb_build_object('ok',true,'record',public.home_claim_evidence_projection(i),'storage',public.home_claim_evidence_storage(i));
EXCEPTION WHEN SQLSTATE 'PT403' THEN RETURN a;
END $$;
CREATE TRIGGER protect_home_claim_evidence_intent BEFORE UPDATE OR DELETE ON public."HomeClaimEvidenceIntent"
  FOR EACH ROW EXECUTE FUNCTION public.protect_home_claim_evidence_intent();

CREATE FUNCTION public.protect_home_claim_evidence_file() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE i public."HomeClaimEvidenceIntent"%ROWTYPE;
BEGIN
  IF TG_OP<>'INSERT' AND OLD.metadata->>'storage_contract'='home_claim_evidence_v1' THEN
    IF TG_OP='DELETE' OR NEW.metadata->>'storage_contract' IS DISTINCT FROM 'home_claim_evidence_v1' THEN
      RAISE EXCEPTION 'Claim File history must be retained' USING ERRCODE='23514'; END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF NEW.metadata->>'storage_contract' IS DISTINCT FROM 'home_claim_evidence_v1' THEN RETURN NEW; END IF;
  SELECT * INTO i FROM public."HomeClaimEvidenceIntent" WHERE id=NEW.id FOR SHARE;
  IF NOT FOUND OR NEW.user_id IS DISTINCT FROM i.uploaded_by OR NEW.home_id IS DISTINCT FROM i.home_id
    OR NEW.file_path IS DISTINCT FROM public.home_claim_evidence_key(i) OR NEW.file_url<>''
    OR NEW.original_filename IS DISTINCT FROM i.file_name OR NEW.filename IS DISTINCT FROM i.file_name
    OR NEW.file_size IS DISTINCT FROM i.file_size OR NEW.mime_type IS DISTINCT FROM i.mime_type
    OR NEW.file_type IS DISTINCT FROM 'other' OR NEW.visibility IS DISTINCT FROM 'private'
    OR NEW.metadata IS DISTINCT FROM jsonb_build_object('storage_contract','home_claim_evidence_v1','upload_id',i.id)
    OR NEW.is_deleted IS DISTINCT FROM (i.state='retired') OR NEW.post_id IS NOT NULL OR NEW.gig_id IS NOT NULL
    OR NEW.comment_id IS NOT NULL OR NEW.profile_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid private claim File binding' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_home_claim_evidence_file BEFORE INSERT OR UPDATE OR DELETE ON public."File"
  FOR EACH ROW EXECUTE FUNCTION public.protect_home_claim_evidence_file();

CREATE FUNCTION public.protect_home_claim_evidence_record() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE i public."HomeClaimEvidenceIntent"%ROWTYPE;
BEGIN
  IF TG_OP<>'INSERT' AND OLD.private_upload_id IS NOT NULL THEN
    IF TG_OP='DELETE' OR NEW.private_upload_id IS DISTINCT FROM OLD.private_upload_id THEN
      RAISE EXCEPTION 'Private evidence history must be retained' USING ERRCODE='23514'; END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF NEW.private_upload_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO i FROM public."HomeClaimEvidenceIntent" WHERE id=NEW.private_upload_id FOR SHARE;
  IF NOT FOUND OR NEW.id<>i.id OR NEW.claim_id<>i.original_claim_id OR i.state='reserved'
    OR NEW.provider<>'manual' OR NEW.evidence_type<>i.evidence_type OR NEW.storage_ref IS NOT NULL
    OR NEW.metadata IS DISTINCT FROM jsonb_build_object('storage_contract','home_claim_evidence_v1','upload_id',i.id)
    OR NEW.status IS DISTINCT FROM (CASE WHEN i.state='retired' THEN 'failed' WHEN i.verified_at IS NOT NULL THEN 'verified' ELSE 'pending' END) THEN
    RAISE EXCEPTION 'Invalid private evidence binding' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_home_claim_evidence_record BEFORE INSERT OR UPDATE OR DELETE ON public."HomeVerificationEvidence"
  FOR EACH ROW EXECUTE FUNCTION public.protect_home_claim_evidence_record();

-- Ordinary evidence access never creates household membership or ownership.
-- An exact claimant may retire their own unverified bytes after withdrawing
-- through the protected transaction. This does not grant private Home setup.
CREATE FUNCTION public.home_claim_evidence_own_withdrawal(c public."HomeOwnershipClaim",u uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT coalesce(c.claimant_user_id=u AND c.state='revoked' AND c.claim_phase_v2='withdrawn'
    AND c.terminal_reason='withdrawn_by_user' AND c.merged_into_claim_id IS NULL
    AND EXISTS(SELECT FROM public."HomeClaimReviewReceipt" r WHERE r.home_id=c.home_id
      AND r.claim_id=c.id AND r.actor_user_id=u AND r.action='withdraw' AND NOT r.platform_admin),false);
$$;
CREATE FUNCTION public.authorize_home_claim_evidence(p_home_id uuid,p_claim_id uuid,p_actor_id uuid,
  p_operation text,p_platform_admin boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE c public."HomeOwnershipClaim"%ROWTYPE; h public."Home"%ROWTYPE; o public."HomeOccupancy"%ROWTYPE;
  v_now timestamptz; v_reviewer boolean;
BEGIN
  IF p_actor_id IS NULL OR p_platform_admin IS NULL OR p_operation IS NULL OR p_operation NOT IN ('upload','read','verify','retire') THEN
    RETURN '{"ok":false,"code":"CLAIM_EVIDENCE_INVALID","status":400}'::jsonb; END IF;
  IF NOT public.lock_home_claim_scope(p_home_id) THEN RETURN '{"ok":false,"code":"HOME_NOT_FOUND","status":404}'::jsonb; END IF;
  SELECT * INTO c FROM public."HomeOwnershipClaim" WHERE id=p_claim_id AND home_id=p_home_id;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"CLAIM_NOT_FOUND","status":404}'::jsonb; END IF;
  SELECT * INTO h FROM public."Home" WHERE id=p_home_id;
  IF h.home_status IN ('merged','archived') OR h.security_state IN ('frozen','frozen_silent','disputed') THEN
    RETURN '{"ok":false,"code":"CLAIM_EVIDENCE_DENIED","status":403}'::jsonb; END IF;
  IF c.state='disputed' OR c.claim_phase_v2='challenged' OR c.challenge_state='challenged' OR c.routing_classification='challenge_claim' THEN
    RETURN '{"ok":false,"code":"CLAIM_CHALLENGE_REVIEW_REQUIRED","status":409}'::jsonb; END IF;
  v_now:=clock_timestamp();
  IF p_operation<>'read' AND (NOT public.home_claim_is_active(c) OR c.expires_at<=v_now)
    AND NOT (p_operation='retire' AND public.home_claim_evidence_own_withdrawal(c,p_actor_id)) THEN
    RETURN '{"ok":false,"code":"CLAIM_NOT_ELIGIBLE","status":409}'::jsonb; END IF;
  v_reviewer:=c.claimant_user_id<>p_actor_id AND public.home_claim_review_authority(p_home_id,p_actor_id,p_platform_admin);
  IF (p_operation IN ('upload','retire') AND (p_actor_id<>c.claimant_user_id OR p_platform_admin))
    OR (p_operation='verify' AND NOT coalesce(v_reviewer,false))
    OR (p_operation='read' AND p_actor_id<>c.claimant_user_id AND NOT coalesce(v_reviewer,false)) THEN
    RETURN '{"ok":false,"code":"CLAIM_EVIDENCE_DENIED","status":403}'::jsonb; END IF;
  IF p_actor_id=c.claimant_user_id THEN
    -- Existing explicit membership/history restrictions cannot be restored by
    -- a personal upload. No occupancy is required for a genuine first claim.
    SELECT * INTO o FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_actor_id;
    v_now:=clock_timestamp();
    IF o.id IS NOT NULL AND (o.is_active IS DISTINCT FROM true OR coalesce(o.role_base,public.home_invite_role(o.role)) IS NULL
      OR o.verification_status IS NULL OR o.verification_status NOT IN ('verified','unverified','pending','pending_doc','pending_postcard','pending_approval','provisional_bootstrap')
      OR (o.verification_status<>'verified' AND o.verified_at IS NOT NULL) OR o.start_at>v_now OR o.end_at<=v_now
      OR o.access_start_at>v_now OR o.access_end_at<=v_now) THEN
      RETURN '{"ok":false,"code":"CLAIM_EVIDENCE_DENIED","status":403}'::jsonb; END IF;
    IF EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user' AND subject_id=p_actor_id
      AND owner_status IN ('revoked','disputed')) THEN RETURN '{"ok":false,"code":"CLAIM_EVIDENCE_DENIED","status":403}'::jsonb; END IF;
  END IF;
  RETURN jsonb_build_object('ok',true,'home_id',p_home_id,'claim_id',p_claim_id,'claimant_id',c.claimant_user_id,
    'review_token',public.home_claim_review_snapshot(c),'can_verify',coalesce(v_reviewer,false));
END $$;

CREATE FUNCTION public.get_home_claim_evidence(p_home_id uuid,p_claim_id uuid,p_actor_id uuid,
  p_upload_id uuid DEFAULT NULL,p_platform_admin boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE a jsonb; i public."HomeClaimEvidenceIntent"%ROWTYPE; records jsonb:='[]'::jsonb; ref jsonb;
BEGIN
  a:=public.authorize_home_claim_evidence(p_home_id,p_claim_id,p_actor_id,'read',p_platform_admin);
  IF a->>'ok' IS DISTINCT FROM 'true' THEN RETURN a; END IF;
  PERFORM id FROM public."HomeClaimEvidenceIntent" WHERE original_home_id=p_home_id AND original_claim_id=p_claim_id
    AND (p_upload_id IS NULL OR id=p_upload_id) ORDER BY id FOR SHARE;
  a:=public.authorize_home_claim_evidence(p_home_id,p_claim_id,p_actor_id,'read',p_platform_admin);
  IF a->>'ok' IS DISTINCT FROM 'true' THEN RETURN a; END IF;
  FOR i IN SELECT * FROM public."HomeClaimEvidenceIntent" WHERE home_id=p_home_id AND claim_id=p_claim_id
    AND (p_upload_id IS NULL OR id=p_upload_id) AND (state='ready' OR uploaded_by=p_actor_id) ORDER BY created_at,id LOOP
    records:=records||jsonb_build_array(public.home_claim_evidence_projection(i));
    IF p_upload_id IS NOT NULL AND i.state='ready' AND EXISTS(SELECT FROM public."HomeVerificationEvidence" e
      WHERE e.id=i.id AND e.private_upload_id=i.id AND e.claim_id=p_claim_id) THEN ref:=public.home_claim_evidence_storage(i); END IF;
  END LOOP;
  IF p_upload_id IS NOT NULL AND ref IS NULL THEN RETURN '{"ok":false,"code":"CLAIM_EVIDENCE_NOT_FOUND","status":404}'::jsonb; END IF;
  RETURN a||jsonb_build_object('records',records,'storage',ref);
END $$;

-- Called only after the service fetched and hashed the exact authorized bytes.
-- The raw random receipt is returned once; the DB stores only its digest.
CREATE FUNCTION public.record_home_claim_evidence_inspection(p_home_id uuid,p_claim_id uuid,p_actor_id uuid,
  p_upload_id uuid,p_platform_admin boolean,p_review_token text,p_receipt_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE a jsonb;
BEGIN
  IF p_review_token IS NULL OR p_review_token !~ '^[a-f0-9]{64}$' OR p_receipt_hash IS NULL OR p_receipt_hash !~ '^[a-f0-9]{64}$' THEN
    RETURN '{"ok":false,"code":"CLAIM_EVIDENCE_INVALID","status":400}'::jsonb; END IF;
  a:=public.authorize_home_claim_evidence(p_home_id,p_claim_id,p_actor_id,'verify',p_platform_admin);
  IF a->>'ok' IS DISTINCT FROM 'true' THEN RETURN a; END IF;
  PERFORM id FROM public."HomeClaimEvidenceIntent" WHERE id=p_upload_id AND home_id=p_home_id AND claim_id=p_claim_id
    AND state='ready' FOR SHARE;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"CLAIM_EVIDENCE_NOT_FOUND","status":404}'::jsonb; END IF;
  a:=public.authorize_home_claim_evidence(p_home_id,p_claim_id,p_actor_id,'verify',p_platform_admin);
  IF a->>'ok' IS DISTINCT FROM 'true' THEN RETURN a; END IF;
  IF a->>'review_token'<>p_review_token THEN RETURN '{"ok":false,"code":"CLAIM_REVIEW_CHANGED","status":409}'::jsonb; END IF;
  INSERT INTO public."HomeClaimEvidenceInspection"(receipt_hash,upload_id,actor_user_id,platform_admin,review_token)
    VALUES(p_receipt_hash,p_upload_id,p_actor_id,p_platform_admin,p_review_token);
  RETURN a||jsonb_build_object('upload_id',p_upload_id,'inspection_recorded',true);
END $$;

CREATE FUNCTION public.verify_home_claim_evidence(p_home_id uuid,p_claim_id uuid,p_actor_id uuid,
  p_upload_id uuid,p_platform_admin boolean,p_review_token text,p_receipt_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE a jsonb; i public."HomeClaimEvidenceIntent"%ROWTYPE; receipt public."HomeClaimEvidenceInspection"%ROWTYPE;
  c public."HomeOwnershipClaim"%ROWTYPE; v_result jsonb;
BEGIN
  IF p_review_token IS NULL OR p_review_token !~ '^[a-f0-9]{64}$' OR p_receipt_hash IS NULL OR p_receipt_hash !~ '^[a-f0-9]{64}$' THEN
    RETURN '{"ok":false,"code":"CLAIM_EVIDENCE_INVALID","status":400}'::jsonb; END IF;
  a:=public.authorize_home_claim_evidence(p_home_id,p_claim_id,p_actor_id,'verify',p_platform_admin);
  IF a->>'ok' IS DISTINCT FROM 'true' THEN RETURN a; END IF;
  SELECT * INTO i FROM public."HomeClaimEvidenceIntent" WHERE id=p_upload_id AND home_id=p_home_id AND claim_id=p_claim_id FOR UPDATE;
  IF NOT FOUND OR i.state<>'ready' THEN RETURN '{"ok":false,"code":"CLAIM_EVIDENCE_NOT_FOUND","status":404}'::jsonb; END IF;
  SELECT * INTO receipt FROM public."HomeClaimEvidenceInspection" WHERE receipt_hash=p_receipt_hash FOR UPDATE;
  IF NOT FOUND OR receipt.upload_id<>i.id OR receipt.actor_user_id<>p_actor_id OR receipt.platform_admin<>p_platform_admin
    OR receipt.review_token<>p_review_token THEN RETURN '{"ok":false,"code":"CLAIM_EVIDENCE_INSPECTION_REQUIRED","status":409}'::jsonb; END IF;
  a:=public.authorize_home_claim_evidence(p_home_id,p_claim_id,p_actor_id,'verify',p_platform_admin);
  IF a->>'ok' IS DISTINCT FROM 'true' THEN RETURN a; END IF;
  IF receipt.verified_at IS NOT NULL THEN
    IF i.verified_by<>p_actor_id OR receipt.result_snapshot IS DISTINCT FROM a->>'review_token' THEN
      RETURN '{"ok":false,"code":"CLAIM_REVIEW_CHANGED","status":409}'::jsonb; END IF;
    RETURN receipt.result||jsonb_build_object('replayed',true);
  END IF;
  IF receipt.expires_at<=clock_timestamp() THEN RETURN '{"ok":false,"code":"CLAIM_EVIDENCE_INSPECTION_REQUIRED","status":409}'::jsonb; END IF;
  IF a->>'review_token'<>p_review_token OR i.verified_at IS NOT NULL THEN RETURN '{"ok":false,"code":"CLAIM_REVIEW_CHANGED","status":409}'::jsonb; END IF;
  UPDATE public."HomeClaimEvidenceIntent" SET verified_by=p_actor_id,verified_at=clock_timestamp(),updated_at=clock_timestamp()
    WHERE id=i.id RETURNING * INTO i;
  UPDATE public."HomeVerificationEvidence" SET status='verified',updated_at=clock_timestamp() WHERE id=i.id AND private_upload_id=i.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Missing exact evidence record' USING ERRCODE='23514'; END IF;
  SELECT * INTO c FROM public."HomeOwnershipClaim" WHERE id=p_claim_id;
  v_result:=jsonb_build_object('ok',true,'home_id',p_home_id,'claim_id',p_claim_id,'upload_id',i.id,'action','verify_evidence',
    'review_token',public.home_claim_review_snapshot(c),'record',public.home_claim_evidence_projection(i),'replayed',false);
  UPDATE public."HomeClaimEvidenceInspection" SET verified_at=i.verified_at,result_snapshot=v_result->>'review_token',result=v_result
    WHERE receipt_hash=p_receipt_hash;
  a:=public.authorize_home_claim_evidence(p_home_id,p_claim_id,p_actor_id,'verify',p_platform_admin);
  IF a->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Reviewer access changed' USING ERRCODE='PT403'; END IF;
  RETURN v_result;
EXCEPTION WHEN SQLSTATE 'PT403' THEN RETURN a;
END $$;

CREATE OR REPLACE FUNCTION public.home_claim_review_verified_evidence(e public."HomeVerificationEvidence") RETURNS boolean
LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
  SELECT coalesce(CASE
    WHEN e.status IS DISTINCT FROM 'verified' OR e.storage_ref IS NOT NULL THEN false
    WHEN e.private_upload_id IS NOT NULL THEN e.provider='manual' AND EXISTS(
      SELECT FROM public."HomeClaimEvidenceIntent" i JOIN public."File" f ON f.id=i.file_id
      WHERE i.id=e.private_upload_id AND i.id=e.id AND i.original_claim_id=e.claim_id
        AND i.state='ready' AND i.verified_at IS NOT NULL AND i.evidence_type=e.evidence_type AND NOT f.is_deleted
        AND e.metadata=jsonb_build_object('storage_contract','home_claim_evidence_v1','upload_id',i.id))
    ELSE NOT coalesce(e.metadata ?| ARRAY['file_url','storage_ref','storage_path','storage_contract'],false)
      AND ((e.provider='stripe_identity' AND e.evidence_type='idv')
        OR (e.provider IN ('attom','corelogic') AND e.evidence_type='title_match' AND e.metadata->>'matched'='true'
          AND CASE WHEN jsonb_typeof(e.metadata->'confidence')='number'
            THEN (e.metadata->>'confidence')::numeric BETWEEN 70 AND 100 ELSE false END))
  END,false);
$$;

CREATE FUNCTION public.claim_home_claim_evidence_cleanup(p_upload_id uuid,p_bucket text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE i public."HomeClaimEvidenceIntent"%ROWTYPE; v_home uuid;
BEGIN
  SELECT home_id INTO v_home FROM public."HomeClaimEvidenceIntent" WHERE id=p_upload_id;
  IF v_home IS NOT NULL THEN PERFORM public.lock_home_claim_scope(v_home); END IF;
  SELECT * INTO i FROM public."HomeClaimEvidenceIntent" WHERE id=p_upload_id FOR UPDATE;
  IF NOT FOUND OR i.storage_bucket IS DISTINCT FROM p_bucket OR i.state='ready'
    OR (i.state='reserved' AND (i.created_at>clock_timestamp()-interval '1 day' OR i.updated_at>clock_timestamp()-interval '10 minutes'))
    OR (i.state='retired' AND i.updated_at>clock_timestamp()-CASE WHEN i.cleanup_pending THEN interval '10 minutes' ELSE interval '1 day' END)
    THEN RETURN NULL; END IF;
  IF i.state='reserved' THEN
    UPDATE public."HomeClaimEvidenceIntent" SET state='retired',retired_at=clock_timestamp() WHERE id=i.id;
    UPDATE public."File" SET is_deleted=true,deleted_at=clock_timestamp(),processing_status='failed',updated_at=clock_timestamp()
      WHERE id=i.file_id AND is_deleted=false;
    IF FOUND THEN UPDATE public."FileQuota" SET storage_used=greatest(storage_used-i.file_size,0),file_count=greatest(file_count-1,0),
      updated_at=clock_timestamp() WHERE user_id=i.uploaded_by; END IF;
  END IF;
  UPDATE public."HomeClaimEvidenceIntent" SET cleanup_pending=true,cleanup_claim=gen_random_uuid(),updated_at=clock_timestamp()
    WHERE id=i.id RETURNING * INTO i;
  RETURN public.home_claim_evidence_storage(i);
END $$;
CREATE FUNCTION public.home_claim_evidence_cleanup_candidates(p_bucket text,p_limit integer DEFAULT 100)
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT id FROM public."HomeClaimEvidenceIntent" WHERE storage_bucket=p_bucket AND state<>'ready'
    AND ((state='reserved' AND created_at<clock_timestamp()-interval '1 day' AND updated_at<clock_timestamp()-interval '10 minutes')
      OR (state='retired' AND updated_at<clock_timestamp()-CASE WHEN cleanup_pending THEN interval '10 minutes' ELSE interval '1 day' END))
  ORDER BY updated_at,id LIMIT greatest(1,least(coalesce(p_limit,100),100));
$$;
CREATE FUNCTION public.finish_home_claim_evidence_cleanup(p_upload_id uuid,p_claim uuid,p_succeeded boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  UPDATE public."HomeClaimEvidenceIntent" SET cleanup_pending=NOT coalesce(p_succeeded,false),cleanup_claim=NULL,updated_at=clock_timestamp()
    WHERE id=p_upload_id AND state='retired' AND cleanup_claim=p_claim;
  RETURN FOUND;
END $$;
CREATE FUNCTION public.note_home_claim_evidence_upload_finished(p_upload_id uuid,p_attempt uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
  UPDATE public."HomeClaimEvidenceIntent" SET cleanup_pending=true,cleanup_claim=NULL,updated_at=clock_timestamp()
    WHERE id=p_upload_id AND state='retired' AND upload_attempt=p_attempt;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_old_deleted_files(days_old integer DEFAULT 30)
RETURNS TABLE(deleted_count integer, freed_space bigint)
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_deleted_count integer; v_freed_space bigint;
BEGIN
  WITH removed AS (
    DELETE FROM public."File" WHERE is_deleted = true
      AND deleted_at < now() - interval '1 day' * days_old
      AND coalesce(metadata->>'storage_contract', '') NOT IN ('home_document_v1','home_task_media_v1','home_claim_evidence_v1')
    RETURNING file_size
  ) SELECT count(*)::integer, coalesce(sum(file_size), 0) INTO v_deleted_count, v_freed_space FROM removed;
  RETURN QUERY SELECT v_deleted_count, v_freed_space;
END;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_file(p_file_id uuid, p_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_file public."File"%ROWTYPE;
BEGIN
  SELECT * INTO v_file FROM public."File"
  WHERE id = p_file_id AND user_id = p_user_id AND is_deleted = false FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'File not found or already deleted');
  END IF;
  IF v_file.metadata->>'storage_contract' IN ('home_document_v1','home_task_media_v1','home_claim_evidence_v1') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  UPDATE public."File" SET is_deleted = true, deleted_at = now(), updated_at = now() WHERE id = p_file_id;
  UPDATE public."FileQuota" SET storage_used = greatest(storage_used - v_file.file_size, 0),
    file_count = greatest(file_count - 1, 0), updated_at = now() WHERE user_id = p_user_id;
  RETURN jsonb_build_object('success', true, 'fileId', p_file_id, 'freedSpace', v_file.file_size);
END;
$$;

-- Own private setup remains available while its immutable pending upload is
-- reserved, ready or retired. A reviewed/foreign claim never uses this exception.
CREATE FUNCTION public.home_claim_evidence_own_setup(i public."HomeClaimEvidenceIntent",p_actor_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT coalesce(i.uploaded_by=p_actor_id AND i.verified_at IS NULL AND EXISTS(SELECT FROM public."HomeOwnershipClaim" c
    WHERE c.id=i.original_claim_id AND c.home_id=i.original_home_id AND c.claimant_user_id=p_actor_id
      AND (c.state IN ('draft','submitted') OR public.home_claim_own_private_withdrawal(c,p_actor_id))
      AND c.reviewed_by IS NULL AND c.reviewed_at IS NULL AND c.merged_into_claim_id IS NULL),false);
$$;

CREATE OR REPLACE FUNCTION public.home_secret_context(p_home_id uuid,p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_home public."Home"%ROWTYPE; v_occ public."HomeOccupancy"%ROWTYPE;
  v_access jsonb; v_role public.home_role_base; v_now timestamptz:=clock_timestamp();
  v_permissions text[]; v_denied constant jsonb:='{"allowed":false,"private":false,"permissions":[]}'::jsonb;
BEGIN
  IF p_actor_id IS NULL THEN RETURN v_denied; END IF;
  SELECT * INTO v_home FROM public."Home" WHERE id=p_home_id;
  IF NOT FOUND OR v_home.security_state IN ('frozen','frozen_silent') THEN RETURN v_denied; END IF;
  SELECT * INTO v_occ FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_actor_id;
  IF v_occ.id IS NOT NULL AND (v_occ.is_active IS DISTINCT FROM true OR v_occ.age_band IN ('child','teen')
    OR v_occ.start_at>v_now OR v_occ.end_at<=v_now OR v_occ.access_start_at>v_now OR v_occ.access_end_at<=v_now) THEN
    RETURN v_denied;
  END IF;
  v_access:=public.home_effective_access(p_home_id,p_actor_id);
  IF v_access->>'is_owner'='true' AND EXISTS (SELECT FROM public."HomeOwner" o WHERE o.home_id=p_home_id
    AND o.subject_type='user' AND o.subject_id=p_actor_id AND o.owner_status IN ('revoked','disputed'))
    AND NOT EXISTS (SELECT FROM public."HomeOwner" o WHERE o.home_id=p_home_id AND o.subject_type='user'
      AND o.subject_id=p_actor_id AND o.owner_status='verified') THEN RETURN v_denied; END IF;
  IF v_access->>'has_access'='true' THEN
    RETURN jsonb_build_object('allowed',true,'private',false,'permissions',v_access->'permissions',
      'role',v_access->>'effective_role_base');
  END IF;
  v_role:=coalesce(v_occ.role_base,CASE v_occ.role
    WHEN 'owner' THEN 'owner' WHEN 'admin' THEN 'admin' WHEN 'manager' THEN 'manager'
    WHEN 'property_manager' THEN 'manager' WHEN 'tenant' THEN 'lease_resident'
    WHEN 'renter' THEN 'lease_resident' WHEN 'lease_resident' THEN 'lease_resident'
    WHEN 'member' THEN 'member' WHEN 'roommate' THEN 'member' WHEN 'family' THEN 'member'
    WHEN 'restricted_member' THEN 'restricted_member' WHEN 'caregiver' THEN 'restricted_member'
    WHEN 'guest' THEN 'guest' WHEN 'service_provider' THEN 'service_provider' ELSE NULL END::public.home_role_base);
  IF v_home.created_by_user_id IS DISTINCT FROM p_actor_id
    OR (v_home.owner_id IS NOT NULL AND v_home.owner_id<>p_actor_id)
    OR v_occ.id IS NULL OR v_role IS NULL OR v_occ.verified_at IS NOT NULL
    OR v_occ.verification_status IS NULL OR v_occ.verification_status NOT IN ('pending_doc','provisional_bootstrap')
    OR EXISTS (SELECT FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id<>p_actor_id)
    OR EXISTS (SELECT FROM public."HomeOwner" WHERE home_id=p_home_id
      AND (subject_type<>'user' OR subject_id<>p_actor_id OR owner_status<>'pending')) THEN RETURN v_denied; END IF;
  -- Explicit private setup allowlist, separate from destructive deletion.
    IF EXISTS (SELECT FROM public."HomeOwnershipClaim" c WHERE home_id = p_home_id
        AND (claimant_user_id <> p_actor_id OR (state NOT IN ('draft','submitted')
          AND NOT public.home_claim_own_private_withdrawal(c,p_actor_id)) OR reviewed_by IS NOT NULL
          OR reviewed_at IS NOT NULL OR merged_into_claim_id IS NOT NULL))
      OR EXISTS (SELECT FROM public."HomeOwnershipClaim" foreign_claim JOIN public."HomeOwnershipClaim" own_claim
        ON foreign_claim.merged_into_claim_id = own_claim.id WHERE own_claim.home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeClaimReviewReceipt" receipt WHERE receipt.home_id=p_home_id
        AND NOT (receipt.actor_user_id=p_actor_id AND receipt.action='withdraw' AND receipt.private_setup
          AND NOT receipt.platform_admin AND EXISTS(SELECT FROM public."HomeOwnershipClaim" c
            WHERE c.id=receipt.claim_id AND c.home_id=p_home_id
              AND public.home_claim_own_private_withdrawal(c,p_actor_id))))
      OR EXISTS (SELECT FROM public."HomeAuditLog" a WHERE a.home_id = p_home_id AND (
        a.actor_user_id IS DISTINCT FROM p_actor_id OR NOT coalesce(
          (a.action = 'OCCUPANCY_TEMPLATE_APPLIED' AND a.target_type = 'HomeOccupancy'
            AND a.target_id = v_occ.id
            AND a.metadata->>'verification_status' IN ('provisional_bootstrap','pending_doc'))
          OR public.home_secret_own_setup_audit(a,p_actor_id)
          OR public.home_record_own_setup_audit(a,p_actor_id)
          OR (a.action='OWNERSHIP_CLAIM_WITHDRAWN' AND a.target_type='HomeOwnershipClaim'
            AND EXISTS(SELECT FROM public."HomeOwnershipClaim" c WHERE c.id=a.target_id
              AND c.home_id=p_home_id AND public.home_claim_own_private_withdrawal(c,p_actor_id)))
          OR (a.action = 'OWNERSHIP_CLAIM_SUBMITTED' AND a.target_type = 'HomeOwnershipClaim'
            AND EXISTS (SELECT FROM public."HomeOwnershipClaim" c WHERE c.id = a.target_id
              AND c.home_id = p_home_id AND c.claimant_user_id = p_actor_id)),false)))
      OR EXISTS (SELECT FROM public."HomeAccessSecret" WHERE home_id = p_home_id AND created_by IS DISTINCT FROM p_actor_id)
      OR EXISTS (SELECT FROM public."HomePermissionOverride" WHERE home_id = p_home_id
        AND (user_id <> p_actor_id OR created_by IS DISTINCT FROM p_actor_id))
      OR EXISTS (SELECT FROM public."UnlistedRemoval" WHERE home_id = p_home_id AND user_id <> p_actor_id)
      OR EXISTS (SELECT FROM public."AddressCalendarRule" WHERE scope_type = 'home'
        AND public.home_calendar_scope_id(scope_key) = p_home_id AND created_by IS DISTINCT FROM p_actor_id)
      OR EXISTS (SELECT FROM public."HomeDocument" WHERE home_id=p_home_id)
      OR EXISTS (SELECT FROM public."CommunityMailItem" WHERE home_id=p_home_id)
      OR EXISTS (SELECT FROM public."HomeMapPin" WHERE home_id=p_home_id)
      OR EXISTS (SELECT FROM public."VacationHold" WHERE home_id=p_home_id)
      OR EXISTS (SELECT FROM public."MailDeliveryIntent" WHERE intended_home_id=p_home_id)
      OR EXISTS (SELECT FROM public."NeighborEndorsement" WHERE endorser_home_id=p_home_id)
      -- Own pending verification evidence does not confer shared-document access
      -- and does not make the creator lose access to their own Wi-Fi setup.
      OR EXISTS(SELECT FROM public."HomeClaimEvidenceIntent" i WHERE i.original_home_id=p_home_id
        AND NOT public.home_claim_evidence_own_setup(i,p_actor_id))
      OR EXISTS (SELECT FROM public."File" f WHERE f.home_id=p_home_id AND (
        f.user_id<>p_actor_id OR (NOT EXISTS (SELECT FROM public."HomeVerificationEvidence" e
          JOIN public."HomeOwnershipClaim" c ON c.id=e.claim_id WHERE c.home_id=p_home_id
            AND c.claimant_user_id=p_actor_id AND (c.state IN ('draft','submitted')
              OR public.home_claim_own_private_withdrawal(c,p_actor_id))
            AND c.reviewed_by IS NULL AND c.reviewed_at IS NULL AND e.storage_ref=f.file_path)
          AND NOT EXISTS(SELECT FROM public."HomeClaimEvidenceIntent" i WHERE i.id=f.id AND i.home_id=p_home_id
            AND f.metadata=jsonb_build_object('storage_contract','home_claim_evidence_v1','upload_id',i.id)
            AND public.home_claim_evidence_own_setup(i,p_actor_id)))))
      OR EXISTS (SELECT FROM public."HomeVerificationEvidence" e JOIN public."HomeOwnershipClaim" c ON c.id=e.claim_id
        JOIN public."File" f ON f.file_path=e.storage_ref WHERE c.home_id=p_home_id
          AND (f.user_id<>p_actor_id OR (f.home_id IS NOT NULL AND f.home_id<>p_home_id)))
      OR EXISTS (SELECT FROM public."Activity" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."AddressReviewCase" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."AttomPropertyCache" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."BlockFounder" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."BlockInvite" WHERE sender_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."BookingPackage" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."BookingPage" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Booking" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."BusinessProfileView" WHERE viewer_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."ChatRoom" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."EventType" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."FridgeCard" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeAsset" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeAuthority" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeBill" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeBusinessLink" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeCalendarEvent" e WHERE home_id = p_home_id
        AND (NOT public.home_event_private_setup(e,p_actor_id)
          OR EXISTS (SELECT FROM public."HomeCalendarEventAttendee" a WHERE a.event_id=e.id AND a.user_id<>p_actor_id)))
      OR EXISTS (SELECT FROM public."HomeDevice" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeDispute" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeEmergency" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeEstateFields" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeGuestPass" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeHouseholdAccessRequest" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeInvite" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeIssue" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeLeaseInvite" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeLease" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeMaintenanceLog" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeMaintenanceTemplate" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeMedia" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePackage" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePet" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePoll" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePostcardCode" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePrivacy" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePrivateData" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePublicData" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeQuorumAction" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeRecordWatch" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeRentReport" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeReputation" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeResidencyClaim" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeResource" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeRvStatus" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeScopedGrant" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeSeasonalChecklistItem" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeSubscription" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeSystem" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeTaskMedia" m WHERE home_id = p_home_id
        OR EXISTS(SELECT FROM public."HomeTask" t WHERE t.id=m.task_id AND t.home_id=p_home_id))
      OR EXISTS (SELECT FROM public."HomeTask" t WHERE home_id = p_home_id
        AND NOT public.home_task_private_setup(t,p_actor_id))
      OR EXISTS (SELECT FROM public."HomeVendor" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeVerification" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Home" WHERE parent_home_id = p_home_id OR canonical_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."ListingInventorySlot" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Listing" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."MailAlias" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."MailDayItem" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."MailPartySession" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."MailRoutingQueue" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Mail" WHERE address_home_id = p_home_id OR address_id = p_home_id OR recipient_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."MessageTemplate" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."NeighborMessage" WHERE sender_home_id = p_home_id OR recipient_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Post" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."PropertyIntelligenceCache" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."ResidencyClaim" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."ResidencyLetter" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."SavedTaskTemplate" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."SchedulingPoll" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."SchedulingWorkflow" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."SupportTrain" WHERE recipient_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."VaultFolder" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Gig" WHERE origin_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Payment" WHERE home_id = p_home_id) THEN
      RETURN v_denied;
    END IF;
  SELECT coalesce(array_agg(p::text),'{}'::text[]) INTO v_permissions
    FROM unnest(ARRAY['access.view_wifi','access.view_codes','access.manage']::public.home_permission[]) p
    WHERE NOT EXISTS (SELECT FROM public."HomePermissionOverride" o WHERE o.home_id=p_home_id
      AND o.user_id=p_actor_id AND o.permission=p AND NOT o.allowed)
    AND NOT EXISTS (SELECT FROM public."HomeRolePermission" r WHERE r.role_base=v_role AND r.permission=p AND NOT r.allowed
      AND NOT EXISTS (SELECT FROM public."HomePermissionOverride" o WHERE o.home_id=p_home_id
        AND o.user_id=p_actor_id AND o.permission=p AND o.allowed));
  RETURN jsonb_build_object('allowed',true,'private',true,'permissions',v_permissions,'role',v_role);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_home_claim_review(p_home_id uuid,p_claim_id uuid,p_actor_id uuid,p_platform_admin boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE c public."HomeOwnershipClaim"%ROWTYPE; h uuid; v_evidence jsonb; v_home jsonb; v_user jsonb;
BEGIN
  SELECT home_id INTO h FROM public."HomeOwnershipClaim" WHERE id=p_claim_id;
  IF h IS NULL OR (p_home_id IS NOT NULL AND p_home_id<>h) THEN RETURN '{"ok":false,"code":"CLAIM_NOT_FOUND","status":404}'::jsonb; END IF;
  IF NOT public.lock_home_claim_scope(h) THEN RETURN '{"ok":false,"code":"HOME_NOT_FOUND","status":404}'::jsonb; END IF;
  SELECT * INTO c FROM public."HomeOwnershipClaim" WHERE id=p_claim_id AND home_id=h;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"CLAIM_NOT_FOUND","status":404}'::jsonb; END IF;
  IF public.home_claim_review_authority(h,p_actor_id,p_platform_admin) IS DISTINCT FROM true THEN
    RETURN '{"ok":false,"code":"CLAIM_REVIEW_DENIED","status":403}'::jsonb; END IF;
  SELECT coalesce(jsonb_agg(CASE WHEN i.id IS NOT NULL THEN public.home_claim_evidence_projection(i) ELSE jsonb_build_object('id',e.id,'evidence_type',e.evidence_type,'provider',e.provider,
    'status',e.status,'created_at',e.created_at,'storage_ref',NULL,'file_url',NULL,'file_name',NULL,
    'file_size',NULL,'mime_type',NULL,'available',false,'availability_code',
      CASE WHEN e.storage_ref IS NOT NULL OR e.metadata ? 'file_url' THEN 'CLAIM_EVIDENCE_PRIVATE_REUPLOAD_REQUIRED'
        ELSE 'CLAIM_EVIDENCE_METADATA_ONLY' END,
    'eligible_for_review',public.home_claim_review_verified_evidence(e)) END ORDER BY e.created_at DESC,e.id),'[]')
    INTO v_evidence FROM public."HomeVerificationEvidence" e LEFT JOIN public."HomeClaimEvidenceIntent" i
      ON i.id=e.private_upload_id AND i.id=e.id AND i.original_claim_id=e.claim_id WHERE e.claim_id=p_claim_id;
  SELECT jsonb_build_object('id',id,'address',address,'city',city,'state',state,'zipcode',zipcode,'name',name,
    'home_type',home_type,'security_state',security_state,'tenure_mode',tenure_mode) INTO v_home FROM public."Home" WHERE id=h;
  SELECT jsonb_build_object('id',id,'username',username,'name',name,'email',email,'created_at',created_at,
    'profile_picture_url',profile_picture_url) INTO v_user FROM public."User" WHERE id=c.claimant_user_id;
  RETURN jsonb_build_object('ok',true,'homeId',h,'claimId',p_claim_id,
    'claim',to_jsonb(c)||jsonb_build_object('review_token',public.home_claim_review_snapshot(c),'evidence',v_evidence),
    'home',v_home,'claimant',v_user,'evidence',v_evidence);
END $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND (p.proname LIKE '%home_claim_evidence%' OR p.proname='home_claim_review_verified_evidence') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
  END LOOP;
END $$;
