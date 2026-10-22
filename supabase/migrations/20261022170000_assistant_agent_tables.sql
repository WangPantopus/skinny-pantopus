-- Backwards compatible: yes. Adds three new server-only tables, "AgentRequest",
-- "AgentStep" and "AgentMemoryItem" (approved by the founder on 2026-10-20 for
-- the AI assistant's phase 3, "when phase 2 ships"; see NEXT_STEPS.md, "Made on
-- October 20 (AI assistant)"), and one nullable column, AIRequestLog.
-- agent_request_id. No existing column, row or function changes; deployed apps
-- never read the new tables (no client grants, RLS on, no policies), and older
-- servers never write them.
--
-- docs/product/ai-assistant-phase3-contract-2026-10-22.md section 3:
--   AgentRequest     one thing the assistant was asked (a chat turn), did on its
--                    own (a brief or nudge), or was asked to check back on (a
--                    follow-up, waiting until due_at);
--   AgentStep        each step of a request: tool calls, the cards shown (their
--                    done state, keyed by the card's id) and pushes sent or held;
--   AgentMemoryItem  one thing the person asked Pantopus to remember, theirs alone.
-- Requests and their cards live as long as their conversation (cascade); tool
-- and notify steps are purged after 90 days by a daily job; memory items stay
-- until the person deletes them. Deleting the account deletes all three.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE public."AgentRequest" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  -- Deleting the conversation deletes its requests, their steps and any
  -- follow-up still waiting.
  conversation_id uuid REFERENCES public."AIConversation"(id) ON DELETE CASCADE,
  home_id uuid REFERENCES public."Home"(id) ON DELETE SET NULL,
  origin text NOT NULL CHECK (origin IN ('chat', 'nudge', 'follow_up')),
  -- The nudge kind (brief, plan_weather, ...), or follow_up; null for chat turns.
  kind text CHECK (kind IS NULL OR char_length(kind) <= 40),
  status text NOT NULL CHECK (status IN ('working', 'waiting', 'done', 'couldnt', 'cancelled')),
  -- Follow-ups only: what to check, as the card showed it. Chat turns keep their
  -- words in the conversation, never here.
  summary text CHECK (summary IS NULL OR char_length(summary) <= 200),
  -- { "type": "post" | "plan" | "task" | "home" | "person", "id": uuid, "home_id"?: uuid }
  subject jsonb CHECK (subject IS NULL OR jsonb_typeof(subject) = 'object'),
  due_at timestamptz,
  -- { "notification_id": uuid } once sent; { "error": "<code>" } when it couldn't.
  outcome jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(outcome) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  CONSTRAINT agent_request_follow_up_due CHECK (origin <> 'follow_up' OR due_at IS NOT NULL)
);

CREATE INDEX agent_request_user_idx ON public."AgentRequest" (user_id, created_at DESC);
CREATE INDEX agent_request_due_idx ON public."AgentRequest" (due_at) WHERE status = 'waiting';
CREATE INDEX agent_request_conversation_idx ON public."AgentRequest" (conversation_id) WHERE conversation_id IS NOT NULL;

ALTER TABLE public."AgentRequest" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."AgentRequest" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."AgentRequest" TO service_role;

COMMENT ON TABLE public."AgentRequest" IS
  'AI assistant phase 3: one chat turn, nudge or follow-up. Server-only (service role); every read names the person.';

CREATE TABLE public."AgentStep" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public."AgentRequest"(id) ON DELETE CASCADE,
  -- The request's person, so a card is found by its owner without a join.
  user_id uuid NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  seq integer NOT NULL,
  type text NOT NULL CHECK (type IN ('tool', 'proposal', 'notify')),
  -- The tool's name, the card type or the notification type.
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  -- The status line the apps showed, or the card's title.
  label text CHECK (label IS NULL OR char_length(label) <= 120),
  status text NOT NULL CHECK (
    (type = 'tool' AND status IN ('ok', 'error'))
    OR (type = 'proposal' AND status IN ('open', 'done', 'dismissed'))
    OR (type = 'notify' AND status IN ('sent', 'held', 'dropped'))
  ),
  -- Proposals only: the card envelope as it was sent. The code keeps it to the
  -- chat's cap for cards (32,000 characters of JSON); this is a backstop, since
  -- jsonb's text form spells the same card a little longer.
  payload jsonb CHECK (payload IS NULL OR (jsonb_typeof(payload) = 'object' AND char_length(payload::text) <= 64000)),
  -- Proposals only: { "done": [ { item_id, action_id, at, link } ], "ref": uuid }.
  result jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(result) = 'object'),
  -- Proposals only: the card's id.
  idempotency_key text CHECK (idempotency_key IS NULL OR char_length(idempotency_key) <= 100),
  expires_at timestamptz,
  latency_ms integer,
  -- Tool steps only: a short code, never inputs, outputs or anyone's words.
  error text CHECK (error IS NULL OR char_length(error) <= 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  done_at timestamptz
);

-- Rows without a key (tool and notify steps) never collide.
CREATE UNIQUE INDEX agent_step_card_key ON public."AgentStep" (user_id, idempotency_key);
CREATE INDEX agent_step_request_idx ON public."AgentStep" (request_id, seq);
CREATE INDEX agent_step_purge_idx ON public."AgentStep" (created_at) WHERE type <> 'proposal';

ALTER TABLE public."AgentStep" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."AgentStep" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."AgentStep" TO service_role;

COMMENT ON TABLE public."AgentStep" IS
  'AI assistant phase 3: the steps of an AgentRequest (tool calls, cards with their done state, pushes). Server-only.';

CREATE TABLE public."AgentMemoryItem" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  -- Used only while the person can still see this home.
  home_id uuid REFERENCES public."Home"(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'fact' CHECK (kind IN ('fact', 'plan_alert')),
  topic text NOT NULL CHECK (topic IN ('you', 'household', 'home', 'plans', 'nearby', 'other')),
  fact text NOT NULL CHECK (char_length(fact) BETWEEN 3 AND 280),
  -- plan_alert only: { "plan_kinds": [...], "within_miles": n }.
  structured jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(structured) = 'object'),
  -- Health, children, money, beliefs and the like: used only when a request is about it.
  sensitive boolean NOT NULL DEFAULT false,
  source_request_id uuid REFERENCES public."AgentRequest"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- When the person last saved, edited or confirmed it (the yearly review).
  reviewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX agent_memory_user_idx ON public."AgentMemoryItem" (user_id, updated_at DESC);
CREATE INDEX agent_memory_plan_alert_idx ON public."AgentMemoryItem" (user_id) WHERE kind = 'plan_alert';

ALTER TABLE public."AgentMemoryItem" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."AgentMemoryItem" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."AgentMemoryItem" TO service_role;

COMMENT ON TABLE public."AgentMemoryItem" IS
  'AI assistant phase 3: what a person asked Pantopus to remember. Only they see it; kept until they delete it. Server-only.';

-- A request's cost is the sum of its log rows. No foreign key and no index: the
-- log keeps its rows after a request or an account is deleted, as it keeps them
-- today with user_id nulled.
ALTER TABLE public."AIRequestLog" ADD COLUMN agent_request_id uuid;

COMMIT;
