-- Backwards compatible: yes. Guard new requests, accepts and follows against an
-- existing personal block. No tables, columns, grants or existing rows change.
-- Relationship blocks, profile-scope blocks and persona blocks stay distinct.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- One trigger function per table. NEW has a different shape on each table, and
-- the schema lint (scripts/db/check-function-lint.cjs) checks every function
-- against each table it is attached to, so the two gates stay separate.
--
-- Both reuse the rendezvous held by every UserBlock write. The separate SELECT
-- after the wait takes a fresh READ COMMITTED snapshot: a block which commits
-- while admission waits must be visible. Do not make these functions STABLE.
CREATE FUNCTION public.personal_connection_block_admission() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp SET lock_timeout = '5s' AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'accepted') THEN RETURN NEW; END IF;

  PERFORM pg_advisory_xact_lock(public.direct_message_block_lock_key(NEW.requester_id, NEW.addressee_id));
  IF EXISTS (
    SELECT 1 FROM public."UserBlock"
    WHERE (blocker_user_id = NEW.requester_id AND blocked_user_id = NEW.addressee_id)
       OR (blocker_user_id = NEW.addressee_id AND blocked_user_id = NEW.requester_id)
  ) THEN
    RAISE EXCEPTION 'PERSONAL_CONNECTION_BLOCKED' USING ERRCODE = 'PT403';
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION public.personal_follow_block_admission() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp SET lock_timeout = '5s' AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(public.direct_message_block_lock_key(NEW.follower_id, NEW.following_id));
  IF EXISTS (
    SELECT 1 FROM public."UserBlock"
    WHERE (blocker_user_id = NEW.follower_id AND blocked_user_id = NEW.following_id)
       OR (blocker_user_id = NEW.following_id AND blocked_user_id = NEW.follower_id)
  ) THEN
    RAISE EXCEPTION 'PERSONAL_CONNECTION_BLOCKED' USING ERRCODE = 'PT403';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER personal_connection_block_admission
BEFORE INSERT OR UPDATE OF requester_id, addressee_id, status ON public."Relationship"
FOR EACH ROW EXECUTE FUNCTION public.personal_connection_block_admission();

-- The follow gate also covers the mutual follows created after accepting a
-- request: a block can commit between acceptance and those separate writes.
CREATE TRIGGER personal_follow_block_admission
BEFORE INSERT OR UPDATE OF follower_id, following_id ON public."UserFollow"
FOR EACH ROW EXECUTE FUNCTION public.personal_follow_block_admission();

REVOKE ALL ON FUNCTION public.personal_connection_block_admission(),
  public.personal_follow_block_admission() FROM PUBLIC, anon, authenticated;
COMMIT;
