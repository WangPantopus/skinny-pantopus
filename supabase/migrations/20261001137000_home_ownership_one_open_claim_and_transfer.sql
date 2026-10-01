-- Home ownership: one open claim per Home, claimant, claim type and method, and one open transfer proposal per Home,
-- proposer and buyer.
--
-- Stream 5's native-POST audit (2026-10-01, audit 20261001-stream5-native-post-idempotency-r1) found that a repeated
-- co-owner invite, ownership transfer or ownership claim could open a second identical row. #1390 made the routes
-- return the open row when the repeat arrives after the first request finished. These indexes close the simultaneous
-- case: the second insert fails with a unique violation, and the routes re-read and return the row that got in (200).
--
-- "Open" is the claim policies' set of open states (homeSecurityPolicy canSubmitOwnerClaim), not merged into another
-- claim, with no terminal reason. Claims without a method stay outside the index (NULL keys never collide).
--
-- Existing duplicates are counted and reported with a NOTICE before anything changes, then:
--   * claims: in each group of open claims with the same Home, claimant, claim type and method, the newest stays open.
--     The older ones become revoked (phase withdrawn, terminal reason duplicate_redundant_claim), each with a
--     HomeAuditLog row. The claim resolution of every Home touched is then reconciled.
--   * transfer proposals: in each group of 'proposed' TRANSFER_OWNERSHIP proposals with the same Home, proposer and
--     buyer, the newest stays; the older ones become expired, each with a HomeAuditLog row.
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
    FROM public."HomeOwnershipClaim" AS c
   WHERE c.state IN ('draft', 'submitted', 'needs_more_info', 'pending_review', 'pending_challenge_window')
     AND c.merged_into_claim_id IS NULL AND c.terminal_reason = 'none' AND c.method IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public."HomeOwnershipClaim" AS newer
        WHERE newer.home_id = c.home_id AND newer.claimant_user_id = c.claimant_user_id
          AND newer.claim_type = c.claim_type AND newer.method = c.method
          AND newer.state IN ('draft', 'submitted', 'needs_more_info', 'pending_review', 'pending_challenge_window')
          AND newer.merged_into_claim_id IS NULL AND newer.terminal_reason = 'none'
          AND (newer.created_at, newer.id) > (c.created_at, c.id));
  SELECT count(*) INTO v_proposals
    FROM public."HomeQuorumAction" AS a
   WHERE a.action_type = 'TRANSFER_OWNERSHIP' AND a.state = 'proposed' AND a.metadata ? 'buyer_user_id'
     AND EXISTS (
       SELECT 1 FROM public."HomeQuorumAction" AS newer
        WHERE newer.home_id = a.home_id AND newer.proposed_by = a.proposed_by
          AND newer.action_type = 'TRANSFER_OWNERSHIP' AND newer.state = 'proposed'
          AND newer.metadata->>'buyer_user_id' = a.metadata->>'buyer_user_id'
          AND (newer.created_at, newer.id) > (a.created_at, a.id));
  RAISE NOTICE '20261001137000: closing % older duplicate open claim(s) and % older duplicate open transfer proposal(s)',
    v_claims, v_proposals;
END $$;

WITH closed AS (
  UPDATE public."HomeOwnershipClaim" AS c
     SET state = 'revoked', claim_phase_v2 = 'withdrawn', terminal_reason = 'duplicate_redundant_claim', updated_at = now()
   WHERE c.state IN ('draft', 'submitted', 'needs_more_info', 'pending_review', 'pending_challenge_window')
     AND c.merged_into_claim_id IS NULL AND c.terminal_reason = 'none' AND c.method IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public."HomeOwnershipClaim" AS newer
        WHERE newer.home_id = c.home_id AND newer.claimant_user_id = c.claimant_user_id
          AND newer.claim_type = c.claim_type AND newer.method = c.method
          AND newer.state IN ('draft', 'submitted', 'needs_more_info', 'pending_review', 'pending_challenge_window')
          AND newer.merged_into_claim_id IS NULL AND newer.terminal_reason = 'none'
          AND (newer.created_at, newer.id) > (c.created_at, c.id))
  RETURNING c.id, c.home_id
)
INSERT INTO public."HomeAuditLog" (home_id, actor_user_id, action, target_type, target_id, metadata)
SELECT home_id, NULL, 'OWNERSHIP_CLAIM_DUPLICATE_CLOSED', 'HomeOwnershipClaim', id,
       jsonb_build_object('migration', '20261001137000', 'terminal_reason', 'duplicate_redundant_claim')
  FROM closed;

-- A separate statement, so the reconcile reads the claims as closed above.
SELECT public.reconcile_home_claim_review(touched.home_id)
  FROM (SELECT DISTINCT home_id FROM public."HomeAuditLog"
         WHERE action = 'OWNERSHIP_CLAIM_DUPLICATE_CLOSED' AND metadata->>'migration' = '20261001137000') AS touched;

WITH closed AS (
  UPDATE public."HomeQuorumAction" AS a
     SET state = 'expired', updated_at = now()
   WHERE a.action_type = 'TRANSFER_OWNERSHIP' AND a.state = 'proposed' AND a.metadata ? 'buyer_user_id'
     AND EXISTS (
       SELECT 1 FROM public."HomeQuorumAction" AS newer
        WHERE newer.home_id = a.home_id AND newer.proposed_by = a.proposed_by
          AND newer.action_type = 'TRANSFER_OWNERSHIP' AND newer.state = 'proposed'
          AND newer.metadata->>'buyer_user_id' = a.metadata->>'buyer_user_id'
          AND (newer.created_at, newer.id) > (a.created_at, a.id))
  RETURNING a.id, a.home_id
)
INSERT INTO public."HomeAuditLog" (home_id, actor_user_id, action, target_type, target_id, metadata)
SELECT home_id, NULL, 'TRANSFER_DUPLICATE_EXPIRED', 'HomeQuorumAction', id, jsonb_build_object('migration', '20261001137000')
  FROM closed;

CREATE UNIQUE INDEX "HomeOwnershipClaim_one_open_per_claimant_method"
  ON public."HomeOwnershipClaim" (home_id, claimant_user_id, claim_type, method)
  WHERE state IN ('draft', 'submitted', 'needs_more_info', 'pending_review', 'pending_challenge_window')
    AND merged_into_claim_id IS NULL AND terminal_reason = 'none';

CREATE UNIQUE INDEX "HomeQuorumAction_one_open_transfer_per_buyer"
  ON public."HomeQuorumAction" (home_id, proposed_by, (metadata->>'buyer_user_id'))
  WHERE action_type = 'TRANSFER_OWNERSHIP' AND state = 'proposed';
