-- Home ownership: one open claim per Home, claimant, claim type and method, and one open transfer proposal per Home,
-- proposer and buyer.
--
-- Stream 5's native-POST audit (2026-10-01, audit 20261001-stream5-native-post-idempotency-r1) found that a repeated
-- co-owner invite, ownership transfer or ownership claim could open a second identical row. #1390 made the routes
-- return the open row when the repeat arrives after the first request finished. These indexes close the simultaneous
-- case: the second insert fails with a unique violation, and the routes re-read and return the row that got in (200).
--
-- "Open" is the claim policies' set of open states (homeSecurityPolicy canSubmitOwnerClaim), not merged into another
-- claim, with no terminal reason. Rows with a NULL key column stay outside both indexes (NULL keys never collide), and
-- outside the duplicate groups below.
--
-- Existing duplicates are counted and reported with a NOTICE before anything changes. In each group one row stays open,
-- chosen so that nothing the person or the other owners already did is set aside:
--   * claims (same Home, claimant, claim type and method): the one furthest in review (pending_challenge_window, then
--     pending_review or needs_more_info, then submitted, then draft), then the one with the most verification evidence,
--     then the newest. The others become revoked (phase withdrawn, terminal reason duplicate_redundant_claim), each
--     with a HomeAuditLog row naming the claim kept. The claim resolution of every Home touched is then reconciled.
--   * transfer proposals ('proposed' TRANSFER_OWNERSHIP with the same Home, proposer and buyer): one not yet past its
--     expiry first, then the one with the most votes, then the newest. The others become expired, each with a
--     HomeAuditLog row naming the proposal kept.
--
-- Backwards compatible: yes. Both indexes are partial and no table changes shape. The deployed backend keeps working: a
-- sequential repeat already returns the open row (#1390). Only a simultaneous duplicate insert now fails with a unique
-- violation, which the deployed routes answer with their existing errors until this branch's routes re-read and
-- return the row.
--
-- One narrow case fails safely until this branch's backend is live. A transfer to a buyer who already holds an open
-- co-owner invitation claim answers 503 and changes nothing; that backend would have opened a second claim. This
-- branch's backend reuses the open claim instead.

SET LOCAL lock_timeout = '5s';

DO $$
DECLARE v_claims integer; v_proposals integer;
BEGIN
  SELECT count(*) INTO v_claims
    FROM (SELECT row_number() OVER (PARTITION BY c.home_id, c.claimant_user_id, c.claim_type, c.method) AS n
            FROM public."HomeOwnershipClaim" AS c
           WHERE c.state IN ('draft', 'submitted', 'needs_more_info', 'pending_review', 'pending_challenge_window')
             AND c.merged_into_claim_id IS NULL AND c.terminal_reason = 'none'
             AND c.home_id IS NOT NULL AND c.claimant_user_id IS NOT NULL AND c.claim_type IS NOT NULL
             AND c.method IS NOT NULL) AS g
   WHERE g.n > 1;
  SELECT count(*) INTO v_proposals
    FROM (SELECT row_number() OVER (PARTITION BY a.home_id, a.proposed_by, a.metadata->>'buyer_user_id') AS n
            FROM public."HomeQuorumAction" AS a
           WHERE a.action_type = 'TRANSFER_OWNERSHIP' AND a.state = 'proposed'
             AND a.home_id IS NOT NULL AND a.proposed_by IS NOT NULL
             AND a.metadata->>'buyer_user_id' IS NOT NULL) AS g
   WHERE g.n > 1;
  RAISE NOTICE '20261001137000: closing % duplicate open claim(s) and % duplicate open transfer proposal(s)',
    v_claims, v_proposals;
END $$;

WITH ranked AS (
  SELECT c.id, c.home_id,
         row_number() OVER keep AS keep_rank,
         first_value(c.id) OVER keep AS kept_claim_id
    FROM public."HomeOwnershipClaim" AS c
   WHERE c.state IN ('draft', 'submitted', 'needs_more_info', 'pending_review', 'pending_challenge_window')
     AND c.merged_into_claim_id IS NULL AND c.terminal_reason = 'none'
     AND c.home_id IS NOT NULL AND c.claimant_user_id IS NOT NULL AND c.claim_type IS NOT NULL
     AND c.method IS NOT NULL
  WINDOW keep AS (
    PARTITION BY c.home_id, c.claimant_user_id, c.claim_type, c.method
    ORDER BY CASE c.state WHEN 'pending_challenge_window' THEN 3 WHEN 'pending_review' THEN 2
                          WHEN 'needs_more_info' THEN 2 WHEN 'submitted' THEN 1 ELSE 0 END DESC,
             (SELECT count(*) FROM public."HomeVerificationEvidence" AS e WHERE e.claim_id = c.id) DESC,
             c.created_at DESC, c.id DESC)
), closed AS (
  UPDATE public."HomeOwnershipClaim" AS c
     SET state = 'revoked', claim_phase_v2 = 'withdrawn', terminal_reason = 'duplicate_redundant_claim', updated_at = now()
    FROM ranked
   WHERE ranked.id = c.id AND ranked.keep_rank > 1
  RETURNING c.id, c.home_id, ranked.kept_claim_id
)
INSERT INTO public."HomeAuditLog" (home_id, actor_user_id, action, target_type, target_id, metadata)
SELECT home_id, NULL, 'OWNERSHIP_CLAIM_DUPLICATE_CLOSED', 'HomeOwnershipClaim', id,
       jsonb_build_object('migration', '20261001137000', 'terminal_reason', 'duplicate_redundant_claim',
                          'kept_claim_id', kept_claim_id)
  FROM closed;

-- A separate statement, so the reconcile reads the claims as closed above.
SELECT public.reconcile_home_claim_review(touched.home_id)
  FROM (SELECT DISTINCT home_id FROM public."HomeAuditLog"
         WHERE action = 'OWNERSHIP_CLAIM_DUPLICATE_CLOSED' AND metadata->>'migration' = '20261001137000') AS touched;

WITH ranked AS (
  SELECT a.id, a.home_id,
         row_number() OVER keep AS keep_rank,
         first_value(a.id) OVER keep AS kept_quorum_action_id
    FROM public."HomeQuorumAction" AS a
   WHERE a.action_type = 'TRANSFER_OWNERSHIP' AND a.state = 'proposed'
     AND a.home_id IS NOT NULL AND a.proposed_by IS NOT NULL AND a.metadata->>'buyer_user_id' IS NOT NULL
  WINDOW keep AS (
    PARTITION BY a.home_id, a.proposed_by, a.metadata->>'buyer_user_id'
    ORDER BY (a.expires_at IS NULL OR a.expires_at > now()) DESC,
             (SELECT count(*) FROM public."HomeQuorumVote" AS v WHERE v.quorum_action_id = a.id) DESC,
             a.created_at DESC, a.id DESC)
), closed AS (
  UPDATE public."HomeQuorumAction" AS a
     SET state = 'expired', updated_at = now()
    FROM ranked
   WHERE ranked.id = a.id AND ranked.keep_rank > 1
  RETURNING a.id, a.home_id, ranked.kept_quorum_action_id
)
INSERT INTO public."HomeAuditLog" (home_id, actor_user_id, action, target_type, target_id, metadata)
SELECT home_id, NULL, 'TRANSFER_DUPLICATE_EXPIRED', 'HomeQuorumAction', id,
       jsonb_build_object('migration', '20261001137000', 'kept_quorum_action_id', kept_quorum_action_id)
  FROM closed;

CREATE UNIQUE INDEX "HomeOwnershipClaim_one_open_per_claimant_method"
  ON public."HomeOwnershipClaim" (home_id, claimant_user_id, claim_type, method)
  WHERE state IN ('draft', 'submitted', 'needs_more_info', 'pending_review', 'pending_challenge_window')
    AND merged_into_claim_id IS NULL AND terminal_reason = 'none';

CREATE UNIQUE INDEX "HomeQuorumAction_one_open_transfer_per_buyer"
  ON public."HomeQuorumAction" (home_id, proposed_by, (metadata->>'buyer_user_id'))
  WHERE action_type = 'TRANSFER_OWNERSHIP' AND state = 'proposed';
