-- Backwards compatible: yes. Direct-room sends are re-decided inside the
-- inserting transaction, because the backend reaches PostgreSQL only through
-- PostgREST: the route's isBlocked() pre-check and the ChatMessage insert are
-- separate single-statement transactions, so a UserBlock committed between them
-- used to be invisible and the message still reached the blocker.
--
-- No table, column, index, RLS policy or RPC is created or altered. In
-- particular get_or_create_direct_chat is untouched (its own create-time race is
-- a separate contract), UserProfileBlock / PersonaBlock / Relationship remain
-- distinct contracts, and gig / group / home / support_train admission plus the
-- existing room read policy are unchanged. This migration adds two row triggers
-- and three functions only.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- Unordered rendezvous key for one human pair. Both the sender's admission
-- check and every UserBlock write must compute the SAME key, which is why the
-- pair is normalised with least()/greatest() rather than used in argument order.
-- hashtextextended is the house idiom (20260914010000_home_unit_create_authority).
CREATE FUNCTION public.direct_message_block_lock_key(p_a uuid, p_b uuid) RETURNS bigint
LANGUAGE sql IMMUTABLE STRICT SET search_path=public,pg_temp AS $$
  SELECT hashtextextended('direct-message-block:'||least(p_a::text,p_b::text)||':'||greatest(p_a::text,p_b::text), 0);
$$;

-- Every block state transition takes the pair lock in its own transaction, so a
-- send that already holds the lock cannot be overtaken: the blocker's write is
-- held until the message has COMMITTED. Note this orders commits, not deliveries
-- -- backend/routes/chats.js emits message:new after the insert returns, so a
-- send that won the lock can still surface to the blocker after the block's HTTP
-- response. What is closed is admission: a block committed before the insert
-- statement can no longer be overtaken by that insert.
-- DELETE coverage is load-bearing -- unblock is a DELETE (backend/routes/blocks.js).
--
-- Deliberately WITHOUT lock_timeout, unlike the admission gate below. The two
-- sides are not symmetric: a timed-out send is an inconvenience the caller can
-- retry, but a timed-out block is a safety failure -- blocks.js would surface 500
-- and the block would simply not exist. A sender holds the pair key only for the
-- duration of one INSERT statement, so this wait is short and bounded in practice
-- by the session's own statement_timeout rather than by a limit that would make
-- blocking fail precisely when someone is actively messaging the blocker.
CREATE FUNCTION public.user_block_pair_lock() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public."UserBlock"%ROWTYPE; v_key bigint; v_keys bigint[];
BEGIN
  r := CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
  v_keys := ARRAY[public.direct_message_block_lock_key(r.blocker_user_id, r.blocked_user_id)];
  -- An UPDATE that repoints either party changes TWO pairs, and leaving the old
  -- pair unlocked would let a send into it overtake the transition. OLD is only
  -- referenced under UPDATE: it is unassigned on INSERT, and on DELETE it is
  -- already the row bound above.
  IF TG_OP = 'UPDATE' THEN
    v_keys := v_keys || public.direct_message_block_lock_key(OLD.blocker_user_id, OLD.blocked_user_id);
  END IF;
  -- Ascending order, matching the admission gate's ordering discipline.
  FOR v_key IN SELECT DISTINCT k FROM unnest(v_keys) AS k ORDER BY k LOOP
    PERFORM pg_advisory_xact_lock(v_key);
  END LOOP;
  RETURN r;
END $$;

-- Direct-room send admission, evaluated inside the inserting transaction.
--
-- VOLATILE is load-bearing and must never be relaxed to STABLE: it is what makes
-- each plpgsql statement take a fresh READ COMMITTED snapshot, so the EXISTS
-- below -- a SEPARATE statement from the PERFORM that waits on the lock -- sees a
-- block that committed while this transaction was waiting. Folding the lock
-- acquisition and the block check into one SQL statement would silently reinstate
-- the race this migration exists to close.
--
-- ChatParticipant.is_active is NULLABLE with default true. This deliberately
-- diverges from the route's .eq('is_active', true) and uses IS NOT FALSE, because
-- a bare `p.is_active` drops NULL rows from BOTH the lock set and the block
-- check, making a NULL-is_active counterparty invisible to the gate. IS NOT FALSE
-- can only ever produce more denials, never more delivery.
--
-- Under REPEATABLE READ or SERIALIZABLE the transaction snapshot is taken at the
-- INSERT rather than after the lock wait, so the re-check degrades to
-- statement-snapshot semantics. That still denies a block committed before the
-- statement began -- the reproduced failure -- and only reopens the narrow
-- post-SELECT overlap. The isolation level is asserted in the SQL contract rather
-- than at runtime, so configuration drift breaks the test suite instead of
-- turning every message send into an outage.
CREATE FUNCTION public.direct_message_block_admission() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE v_room_type text; v_actor uuid; v_key bigint;
BEGIN
  SELECT r.type INTO v_room_type FROM public."ChatRoom" r WHERE r.id = NEW.room_id;
  IF v_room_type IS DISTINCT FROM 'direct' THEN RETURN NEW; END IF;

  -- ChatMessage.user_id is the SENDER and may be a business identity;
  -- actor_user_id is the HUMAN actor and is NULL when the human is the user_id.
  -- user_id is NOT NULL, so v_actor is never NULL and the STRICT key function can
  -- never silently skip a lock.
  v_actor := coalesce(NEW.actor_user_id, NEW.user_id);

  -- Defence in depth against a spoofed actor. Unreachable through
  -- backend/routes/chats.js, which never takes actor_user_id from the client and
  -- sets it only when the sender identity differs from the authenticated user.
  IF NEW.actor_user_id IS NOT NULL AND (
       NEW.actor_user_id = NEW.user_id
    OR NOT EXISTS (SELECT FROM public."ChatParticipant" p
                   WHERE p.room_id = NEW.room_id AND p.user_id = NEW.actor_user_id AND p.is_active IS NOT FALSE))
  THEN
    RAISE EXCEPTION 'DIRECT_MESSAGE_ACTOR_INVALID' USING ERRCODE='PT403',
      DETAIL='Direct message names a human who is not an active member of this room';
  END IF;

  -- Ascending key order over a total, sender-independent ordering of the shared
  -- key space is the deadlock-freedom argument for multi-counterparty rooms.
  FOR v_key IN
    SELECT DISTINCT public.direct_message_block_lock_key(v_actor, p.user_id) AS k
    FROM public."ChatParticipant" p
    WHERE p.room_id = NEW.room_id AND p.is_active IS NOT FALSE AND p.user_id <> v_actor
    ORDER BY k
  LOOP
    PERFORM pg_advisory_xact_lock(v_key);
  END LOOP;

  IF EXISTS (SELECT FROM public."ChatParticipant" p
             JOIN public."UserBlock" b
               ON (b.blocker_user_id = v_actor AND b.blocked_user_id = p.user_id)
               OR (b.blocker_user_id = p.user_id AND b.blocked_user_id = v_actor)
             WHERE p.room_id = NEW.room_id AND p.is_active IS NOT FALSE AND p.user_id <> v_actor)
  THEN
    RAISE EXCEPTION 'DIRECT_MESSAGE_BLOCKED' USING ERRCODE='PT403',
      DETAIL='Direct message refused; this conversation has an active block';
  END IF;

  -- An empty counterparty set denies nothing, preserving the existing
  -- no-counterparty behaviour of a single-participant direct room.
  RETURN NEW;
END $$;

-- BEFORE, not AFTER, so the existing AFTER INSERT trigger_increment_unread never
-- fires for a denied send and no unread badge survives the rollback.
CREATE TRIGGER trigger_direct_message_block_admission BEFORE INSERT ON public."ChatMessage"
  FOR EACH ROW EXECUTE FUNCTION public.direct_message_block_admission();

CREATE TRIGGER trigger_user_block_pair_lock BEFORE INSERT OR UPDATE OR DELETE ON public."UserBlock"
  FOR EACH ROW EXECUTE FUNCTION public.user_block_pair_lock();

-- Revoking EXECUTE does not stop a trigger firing; it only stops a client
-- calling the gate directly. SECURITY DEFINER is mandatory rather than
-- stylistic: "UserBlock" has row level security enabled, so a definer-less gate
-- invoked as `authenticated` would be blind to the counterparty's block row and
-- would fail open in exactly the direction this migration closes.
REVOKE ALL ON FUNCTION public.direct_message_block_admission(), public.user_block_pair_lock(),
  public.direct_message_block_lock_key(uuid,uuid) FROM PUBLIC, anon, authenticated;

COMMIT;
