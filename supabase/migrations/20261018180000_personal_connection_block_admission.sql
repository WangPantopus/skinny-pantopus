-- Backwards compatible: yes. Guard new requests, accepts and follows against an
-- existing personal block. No tables, columns, grants or existing rows change.
-- Relationship blocks, profile-scope blocks and persona blocks stay distinct.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE FUNCTION public.personal_connection_block_admission() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp SET lock_timeout = '5s' AS $$
DECLARE v_a uuid; v_b uuid;
BEGIN
  IF TG_TABLE_NAME = 'Relationship' THEN
    IF NEW.status NOT IN ('pending', 'accepted') THEN RETURN NEW; END IF;
    v_a := NEW.requester_id;
    v_b := NEW.addressee_id;
  ELSE
    v_a := NEW.follower_id;
    v_b := NEW.following_id;
  END IF;

  -- Reuse the rendezvous held by every UserBlock write. The separate SELECT
  -- after the wait takes a fresh READ COMMITTED snapshot: a block which commits
  -- while admission waits must be visible. Do not make this function STABLE.
  PERFORM pg_advisory_xact_lock(public.direct_message_block_lock_key(v_a, v_b));
  IF EXISTS (
    SELECT 1 FROM public."UserBlock"
    WHERE (blocker_user_id = v_a AND blocked_user_id = v_b)
       OR (blocker_user_id = v_b AND blocked_user_id = v_a)
  ) THEN
    RAISE EXCEPTION 'PERSONAL_CONNECTION_BLOCKED' USING ERRCODE = 'PT403';
  END IF;
  RETURN NEW;
END $$;

-- The follow gate also covers the mutual follows created after accepting a
-- request: a block can commit between acceptance and those separate writes.
CREATE TRIGGER personal_connection_block_admission
BEFORE INSERT OR UPDATE OF requester_id, addressee_id, status ON public."Relationship"
FOR EACH ROW EXECUTE FUNCTION public.personal_connection_block_admission();

CREATE TRIGGER personal_follow_block_admission
BEFORE INSERT OR UPDATE OF follower_id, following_id ON public."UserFollow"
FOR EACH ROW EXECUTE FUNCTION public.personal_connection_block_admission();

REVOKE ALL ON FUNCTION public.personal_connection_block_admission() FROM PUBLIC, anon, authenticated;
COMMIT;
