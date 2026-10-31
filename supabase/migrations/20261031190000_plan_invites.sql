-- Backwards compatible: yes. Adds the PlanInvite table (the founder approved it on October 31: hosts invite people on
-- Pantopus and people by email or text), the `plans_invites` flag (on, as Plans is; an off switch for invitations
-- alone) and two funnel events. No existing column or API shape changes; deployed apps never read the new table.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- One row per invitation. An account invite names the person; an email or link invite carries a token (only its
-- sha256 is kept) until someone opens it and the row names them too. Accepting an invite makes an ordinary
-- PlanRequest, so seats, the waitlist, the chat and the exact place work as they do for asks.
CREATE TABLE public."PlanInvite" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public."Plan"(post_id) ON DELETE CASCADE,
  host_user_id uuid NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('account', 'email', 'link')),
  -- The person: set when the host invites an account, or when someone opens an email or link invite.
  invitee_user_id uuid REFERENCES public."User"(id) ON DELETE CASCADE,
  -- Email invites: the address the host typed, lowercased. Only the host sees it.
  email text CHECK (email IS NULL OR (char_length(email) BETWEEN 3 AND 254 AND email = lower(email))),
  token_hash text UNIQUE CHECK (token_hash IS NULL OR token_hash ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  -- An email invite opened by an account whose verified email isn't the one invited (a forwarded email, Hide My
  -- Email): the host says yes before they see anything private.
  needs_host_ok boolean NOT NULL DEFAULT false,
  email_status text CHECK (email_status IS NULL OR email_status IN ('sent', 'failed', 'skipped')),
  -- "Don't send me invitations": set on every row with the address, and checked before any later email to it.
  email_opted_out_at timestamptz,
  claimed_at timestamptz,
  opened_at timestamptz,
  answered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plan_invite_channel_fields CHECK (
    (channel = 'account' AND invitee_user_id IS NOT NULL AND email IS NULL AND token_hash IS NULL)
    OR (channel = 'email' AND email IS NOT NULL AND token_hash IS NOT NULL)
    OR (channel = 'link' AND email IS NULL AND token_hash IS NOT NULL)
  )
);

-- One open invite per account and per address on a plan; a cancelled one can be sent again.
CREATE UNIQUE INDEX plan_invite_one_per_account ON public."PlanInvite" (post_id, invitee_user_id)
  WHERE channel = 'account' AND status <> 'cancelled';
CREATE UNIQUE INDEX plan_invite_one_per_email ON public."PlanInvite" (post_id, email)
  WHERE email IS NOT NULL AND status <> 'cancelled';
CREATE INDEX plan_invite_post_idx ON public."PlanInvite" (post_id, created_at);
CREATE INDEX plan_invite_invitee_idx ON public."PlanInvite" (invitee_user_id, status) WHERE invitee_user_id IS NOT NULL;
CREATE INDEX plan_invite_email_idx ON public."PlanInvite" (email) WHERE email IS NOT NULL;
CREATE INDEX plan_invite_host_created_idx ON public."PlanInvite" (host_user_id, created_at);

ALTER TABLE public."PlanInvite" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."PlanInvite" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."PlanInvite" TO service_role;

INSERT INTO public."FeatureFlag" (flag_name, enabled_globally, enabled_for_internal_team, beta_user_ids, description)
VALUES ('plans_invites', true, false, ARRAY[]::uuid[],
  'Plans invitations: hosts invite people on Pantopus, by email and by text. On with Plans; turning it off stops new invitations and their emails.')
ON CONFLICT (flag_name) DO NOTHING;

ALTER TABLE public."FunnelEvent" DROP CONSTRAINT funnelevent_type_check;
ALTER TABLE public."FunnelEvent" ADD CONSTRAINT funnelevent_type_check CHECK (
  event_type IN (
    't0_preview_viewed', 't0_aha_viewed', 't0_share_clicked',
    't0_wall_viewed', 'register_started', 't1_account_created',
    'session_open', 'reminder_sent', 'reminder_action', 'suggestion_decision',
    'plan_viewed', 'plan_created', 'plan_requested', 'plan_accepted',
    'plan_attended', 'plan_hosted_again', 'plan_share_opened',
    'pulse_helpful_marked', 'pulse_follow',
    'plan_invited', 'plan_invite_joined'
  )
);
COMMIT;
