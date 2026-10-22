-- Backwards compatible: yes. Adds one new server-only table, "AgentRule" (standing
-- rules, approved by the founder on 2026-10-22: "approve", in reply to "approve or
-- decline standing rules (AgentRule)"; see NEXT_STEPS.md and
-- docs/product/ai-assistant-phase3-contract-2026-10-22.md section 18), one nullable
-- column, AgentRequest.rule_id, and two wider check lists: AgentRequest.origin gains
-- 'rule' (a rule's run) and AgentStep.type gains 'action' (a write done under a
-- rule, done or error). No existing row changes and every value allowed before is
-- still allowed; deployed apps never read these tables (no client grants, RLS on, no
-- policies), and older servers never write the new values.
--
-- A standing rule is one thing Pantopus does on its own after the person turned it
-- on from a card: a weekly plan it posts for them (plan_repeat), or a household
-- member reminded the night before each pickup day the household set
-- (pickup_reminder). Each run is an AgentRequest (origin rule) with one action step;
-- deleting the rule deletes its runs (the plans it posted stay), runs are purged
-- after a year, and deleting the account deletes everything by cascade.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE public."AgentRule" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  -- pickup_reminder: the home. No foreign key on purpose, as AgentRequest.home_id:
  -- Home deletion stays governed by its explicit policy (home_delete_eligibility),
  -- which this table doesn't join. A rule whose home is gone pauses at its next run.
  home_id uuid,
  kind text NOT NULL CHECK (kind IN ('plan_repeat', 'pickup_reminder')),
  -- The sentence the card and the list show, written by the server.
  summary text NOT NULL CHECK (char_length(summary) BETWEEN 1 AND 200),
  -- plan_repeat: { latest_plan_id, weekday, start_local, duration_minutes, timezone };
  -- pickup_reminder: { member_user_id, kinds }.
  config jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(config) = 'object'),
  enabled boolean NOT NULL DEFAULT true,
  -- Why it stopped on its own; null while it runs, or when the person switched it off.
  paused_reason text CHECK (paused_reason IS NULL OR paused_reason IN ('nobody_came', 'cannot_post', 'ended', 'member_left')),
  -- plan_repeat: at most 12 weeks after it was turned on or extended.
  ends_at timestamptz,
  -- When the job looks at it next.
  next_run_at timestamptz,
  last_run_at timestamptz,
  run_count integer NOT NULL DEFAULT 0 CHECK (run_count >= 0),
  -- The chat turn whose card turned it on.
  source_request_id uuid REFERENCES public."AgentRequest"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_rule_pickup_home CHECK (kind <> 'pickup_reminder' OR home_id IS NOT NULL)
);

CREATE INDEX agent_rule_user_idx ON public."AgentRule" (user_id, created_at DESC);
CREATE INDEX agent_rule_due_idx ON public."AgentRule" (next_run_at) WHERE enabled;

ALTER TABLE public."AgentRule" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."AgentRule" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."AgentRule" TO service_role;

COMMENT ON TABLE public."AgentRule" IS
  'AI assistant phase 3: a standing rule the person turned on from a card (a weekly plan, a pickup reminder). Server-only.';

-- A rule's runs: deleting the rule deletes them (the plans it posted stay).
ALTER TABLE public."AgentRequest" ADD COLUMN rule_id uuid REFERENCES public."AgentRule"(id) ON DELETE CASCADE;
CREATE INDEX agent_request_rule_idx ON public."AgentRequest" (rule_id) WHERE rule_id IS NOT NULL;

-- Wider check lists: every value allowed before is still allowed.
ALTER TABLE public."AgentRequest" DROP CONSTRAINT "AgentRequest_origin_check";
ALTER TABLE public."AgentRequest" ADD CONSTRAINT "AgentRequest_origin_check"
  CHECK (origin IN ('chat', 'nudge', 'follow_up', 'rule'));
ALTER TABLE public."AgentRequest" ADD CONSTRAINT agent_request_rule_run CHECK (origin <> 'rule' OR rule_id IS NOT NULL);

ALTER TABLE public."AgentStep" DROP CONSTRAINT "AgentStep_type_check";
ALTER TABLE public."AgentStep" ADD CONSTRAINT "AgentStep_type_check"
  CHECK (type IN ('tool', 'proposal', 'notify', 'action'));
ALTER TABLE public."AgentStep" DROP CONSTRAINT "AgentStep_check";
ALTER TABLE public."AgentStep" ADD CONSTRAINT "AgentStep_check" CHECK (
  (type = 'tool' AND status IN ('ok', 'error'))
  OR (type = 'proposal' AND status IN ('open', 'done', 'dismissed'))
  OR (type = 'notify' AND status IN ('sent', 'held', 'dropped'))
  OR (type = 'action' AND status IN ('done', 'error'))
);

COMMIT;
