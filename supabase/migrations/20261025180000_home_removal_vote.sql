-- Backwards compatible: yes. Adds one allowed value to HomeQuorumAction.action_type, one partial unique index, one
-- switched-off FeatureFlag row, new service-only functions, narrower read policies on the two vote tables, and
-- forward replacements of two existing functions with the same signatures and grants. Only the new functions create
-- a REMOVE_MEMBER vote, only the new API routes call them, and none opens while home_removal_vote is off (its
-- default); until one exists, every replaced function behaves exactly as before for every existing row. Deployed
-- apps never read the vote tables directly.
--
-- Home claims plan, PR 5: the resident removal vote (plan "when-users-claim-an-streamed-willow", approved by the
-- founder on 2026-10-25, behind a flag that ships off: the founder turns it on only after testing and after the iOS
-- and Android apps have voting screens). Settled residents can remove someone who doesn't belong without an owner
-- or manager:
--   * Who can start one: a settled resident (home_settled_resident): a current, verified adult member who isn't a
--     guest, service provider or restricted member, has been a verified member for at least 7 days (counted from
--     when they were admitted or last verified, not from when they asked; an instant claim: until its settles_at),
--     and isn't the subject of an open vote. Probation and a challenged person aren't verified.
--   * One vote at a time per Home: the person a vote is about can't vote, so votes side by side would take each
--     other's voters away.
--   * Who can be removed: a current, verified member below a manager who isn't an owner of record. Owners stay
--     under the owners' vote; residents can never vote out an owner.
--   * Threshold: a majority of the other settled residents when the vote opens, and at least 2 of them. With fewer
--     than 2 others (a two-person household) there is no vote; the owner or manager can remove someone, as today.
--   * During the vote (up to 7 days): the person keeps access but can't invite, answer a request to join, remove
--     anyone or vote (home_effective_access drops members.manage; voters must be settled). They're told it's open
--     and the result, never who voted: ballots and proposers are readable only by the service role, and the audit
--     rows a vote writes have no actor.
--   * Time to contest: a vote that reaches its majority takes effect no sooner than 72 hours after it opened
--     (contest_until; chosen 2026-10-26 for the founder to confirm or change), so the person has read the notice
--     and can contest first. The hourly job (jobs/processQuorumActions.js) decides a vote that passed meanwhile.
--   * Contesting means proving: someone whose own access is proof of the address (postcard, document, landlord or
--     legacy verification) can contest, and a vote that passes then goes to Pantopus review (AddressReviewCase,
--     trigger removal_vote) instead of removing them. Resolving that case decides the vote: approved removes them,
--     rejected or dismissed keeps them. Without proof, a vote that passes removes them.
--   * After removal: apply_home_member_removal, unchanged (access, scoped grants and residency letters end; no
--     rejoining without an invitation), called with no actor through a vote mode in home_member_removal_context.
--
-- Latest permitted sources (bodies copied unchanged except the lines commented below):
--   home_effective_access          supabase/migrations/20260910001500_home_effective_permissions.sql:20
--   home_member_removal_context    supabase/migrations/20261025120000_home_instant_claim.sql:445
SET LOCAL lock_timeout='5s';

ALTER TABLE public."HomeQuorumAction" DROP CONSTRAINT "HomeQuorumAction_action_type_chk";
ALTER TABLE public."HomeQuorumAction" ADD CONSTRAINT "HomeQuorumAction_action_type_chk" CHECK (action_type IN (
  'CHANGE_OWNER_CLAIM_POLICY','REMOVE_OWNER','TRANSFER_OWNERSHIP','CHANGE_PRIMARY_OWNER','MAIL_ROUTING_CHANGE',
  'FREEZE_HOME','CHANGE_MEMBER_ATTACH_POLICY','ADD_SERVICE_PROVIDER','CHANGE_PRIVACY_MASK','CHANGE_TENURE_MODE',
  'REMOVE_MEMBER')) NOT VALID;
ALTER TABLE public."HomeQuorumAction" VALIDATE CONSTRAINT "HomeQuorumAction_action_type_chk";

-- One open household vote per Home (open_home_removal_vote also finds it first, under the Home lock).
CREATE UNIQUE INDEX "HomeQuorumAction_one_open_removal_vote" ON public."HomeQuorumAction" (home_id)
  WHERE action_type = 'REMOVE_MEMBER' AND state IN ('proposed', 'collecting_votes');

-- Votes are private. A verified owner could read every vote row of their Home's actions, and the action's proposer,
-- through the tables directly; a household vote's are left out (the service role still reads them for the API).
DROP POLICY quorum_action_select ON public."HomeQuorumAction";
CREATE POLICY quorum_action_select ON public."HomeQuorumAction" FOR SELECT USING (
  "HomeQuorumAction".action_type <> 'REMOVE_MEMBER' AND EXISTS (SELECT 1 FROM public."HomeOwner" ho
    WHERE ho.home_id = "HomeQuorumAction".home_id AND ho.subject_id = auth.uid()
      AND ho.owner_status = 'verified'::public.owner_status_type));
DROP POLICY quorum_vote_select ON public."HomeQuorumVote";
CREATE POLICY quorum_vote_select ON public."HomeQuorumVote" FOR SELECT USING (EXISTS (SELECT 1
  FROM public."HomeQuorumAction" qa JOIN public."HomeOwner" ho ON ho.home_id = qa.home_id
  WHERE qa.id = "HomeQuorumVote".quorum_action_id AND qa.action_type <> 'REMOVE_MEMBER'
    AND ho.subject_id = auth.uid() AND ho.owner_status = 'verified'::public.owner_status_type));

-- Off: it ships off. The founder turns it on only after testing and after the iOS and Android apps have voting
-- screens (today only the web Members page has one), with POST /api/admin/feature-flags/home_removal_vote and
-- {"enabled_globally": true}. Turning it off again stops new votes at once; votes already open run to their end.
INSERT INTO public."FeatureFlag" (flag_name, enabled_globally, enabled_for_internal_team, beta_user_ids, description)
VALUES ('home_removal_vote', false, false, ARRAY[]::uuid[],
  'Resident removal vote: settled residents can vote to remove a member who doesn''t belong (majority of the other settled residents, at least 2, 7 days). Off by default; the founder turns it on after testing, once the iOS and Android apps have voting screens. Turn it off to stop new votes.')
ON CONFLICT (flag_name) DO NOTHING;

-- Is a household vote about removing this person open at this Home: collecting votes and not past its end?
CREATE FUNCTION public.home_removal_vote_open(p_home_id uuid,p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS(SELECT FROM public."HomeQuorumAction" WHERE home_id=p_home_id AND action_type='REMOVE_MEMBER'
    AND state IN ('proposed','collecting_votes') AND expires_at>now() AND metadata->>'target_user_id'=p_user_id::text)
$$;

-- A settled resident: a current, verified adult member who isn't a guest, service provider or restricted member,
-- has been a verified member for at least 7 days (an instant claim also waits for its settles_at, 7 or 14 days), and
-- isn't the subject of an open removal vote. Probation and a challenged person aren't verified, so they never count.
-- The 7 days run from the latest of verified_at (admitted, or verified again), start_at (a rejoined row restarts it)
-- and created_at: a request that waited for an answer starts counting when it's approved, not when it was sent.
CREATE FUNCTION public.home_settled_resident(p_home_id uuid,p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS(SELECT FROM public."HomeOccupancy" o WHERE o.home_id=p_home_id AND o.user_id=p_user_id
      AND o.is_active IS TRUE AND o.verification_status='verified'
      AND coalesce(o.role_base::text,CASE o.role WHEN 'tenant' THEN 'lease_resident' WHEN 'renter' THEN 'lease_resident'
        WHEN 'family' THEN 'member' WHEN 'roommate' THEN 'member' WHEN 'property_manager' THEN 'manager'
        ELSE o.role END) IN ('owner','admin','manager','lease_resident','member')
      AND coalesce(o.age_band::text,'adult')='adult'
      AND (o.start_at IS NULL OR o.start_at<=now()) AND (o.end_at IS NULL OR o.end_at>now())
      AND (o.access_start_at IS NULL OR o.access_start_at<=now()) AND (o.access_end_at IS NULL OR o.access_end_at>now())
      AND greatest(o.verified_at,o.start_at,o.created_at)<=now()-interval '7 days'
      AND NOT EXISTS(SELECT FROM public."HomeAuditLog" a WHERE a.home_id=p_home_id AND a.target_id=o.id
        AND a.action='HOME_CLAIMED' AND (a.metadata->>'settles_at')::timestamptz>now()))
    AND NOT public.home_removal_vote_open(p_home_id,p_user_id)
$$;

-- Who a household vote can remove: a current, verified member below a manager (lease member, member, restricted
-- member, guest or service provider) who isn't an owner of record. Owners stay under the owners' vote.
CREATE FUNCTION public.home_removal_vote_target(p_home_id uuid,p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS(SELECT FROM public."HomeOccupancy" o WHERE o.home_id=p_home_id AND o.user_id=p_user_id
      AND o.is_active IS TRUE AND o.verification_status='verified'
      AND coalesce(o.role_base::text,CASE o.role WHEN 'tenant' THEN 'lease_resident' WHEN 'renter' THEN 'lease_resident'
        WHEN 'family' THEN 'member' WHEN 'roommate' THEN 'member' WHEN 'caregiver' THEN 'restricted_member'
        ELSE o.role END) IN ('lease_resident','member','restricted_member','guest','service_provider')
      AND (o.start_at IS NULL OR o.start_at<=now()) AND (o.end_at IS NULL OR o.end_at>now())
      AND (o.access_start_at IS NULL OR o.access_start_at<=now()) AND (o.access_end_at IS NULL OR o.access_end_at>now()))
    AND NOT EXISTS(SELECT FROM public."Home" WHERE id=p_home_id AND owner_id=p_user_id)
    AND NOT EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user'
      AND subject_id=p_user_id AND owner_status='verified')
$$;

-- Opens a household vote to remove p_target_id, with the proposer's own vote to remove. The voters are the settled
-- residents other than the person, fixed when it opens; it passes with a majority of them and at least 2, no sooner
-- than contest_until (72 hours after it opens), and is decided against them once a majority can no longer be
-- reached. It closes after 7 days; silence never removes anyone. One vote is open per Home at a time. Asking again
-- about the same person waits 30 days from the last vote that didn't remove them, and none opens while Pantopus
-- reviews a contested one. The open vote about the person, asked again by one of its voters, is answered as it is
-- (replayed). Returns the voters to tell (everyone asked but the proposer).
CREATE FUNCTION public.open_home_removal_vote(p_home_id uuid,p_actor_id uuid,p_target_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE h public."Home"%ROWTYPE; o public."HomeOccupancy"%ROWTYPE; a public."HomeQuorumAction"%ROWTYPE;
  v_voters uuid[]; n integer; v_required integer; t timestamptz;
BEGIN
  IF p_home_id IS NULL OR p_actor_id IS NULL OR p_target_id IS NULL THEN
    RETURN '{"ok":false,"code":"REMOVAL_VOTE_INVALID","status":400}'::jsonb; END IF;
  IF p_actor_id=p_target_id THEN RETURN '{"ok":false,"code":"REMOVAL_VOTE_SELF","status":409}'::jsonb; END IF;
  IF NOT EXISTS(SELECT FROM public."FeatureFlag" WHERE flag_name='home_removal_vote' AND enabled_globally) THEN
    RETURN '{"ok":false,"code":"REMOVAL_VOTE_OFF","status":404}'::jsonb; END IF;
  -- Votes about a Home are opened, cast and applied one at a time, in the Home lock removals take first.
  SELECT * INTO h FROM public."Home" WHERE id=p_home_id FOR UPDATE;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"HOME_NOT_FOUND","status":404}'::jsonb; END IF;
  t:=clock_timestamp();
  IF h.security_state IN ('frozen','frozen_silent','disputed') OR h.home_status IN ('archived','merged') THEN
    RETURN '{"ok":false,"code":"REMOVAL_VOTE_UNAVAILABLE","status":409}'::jsonb; END IF;
  IF NOT public.home_settled_resident(p_home_id,p_actor_id) THEN
    RETURN '{"ok":false,"code":"REMOVAL_VOTE_NOT_SETTLED","status":403}'::jsonb; END IF;
  -- One at a time: one that ran out or lost its subject stays until the hourly job settles it.
  SELECT * INTO a FROM public."HomeQuorumAction" WHERE home_id=p_home_id AND action_type='REMOVE_MEMBER'
    AND state IN ('proposed','collecting_votes');
  IF FOUND AND a.metadata->>'target_user_id'=p_target_id::text AND a.expires_at>t
      AND (a.metadata->'electorate') ? p_actor_id::text THEN
    RETURN jsonb_build_object('ok',true,'replayed',true,'vote_id',a.id,'closes_at',a.expires_at,
      'contest_until',a.metadata->'contest_until'); END IF;
  IF FOUND THEN RETURN '{"ok":false,"code":"REMOVAL_VOTE_BUSY","status":409}'::jsonb; END IF;
  IF NOT public.home_removal_vote_target(p_home_id,p_target_id) THEN
    RETURN '{"ok":false,"code":"REMOVAL_VOTE_TARGET_UNAVAILABLE","status":409}'::jsonb; END IF;
  IF EXISTS(SELECT FROM public."HomeQuorumAction" WHERE home_id=p_home_id AND action_type='REMOVE_MEMBER'
      AND metadata->>'target_user_id'=p_target_id::text AND state='approved'
      AND metadata->'execution'->>'status'='held') THEN
    RETURN '{"ok":false,"code":"REMOVAL_VOTE_IN_REVIEW","status":409}'::jsonb; END IF;
  IF EXISTS(SELECT FROM public."HomeQuorumAction" WHERE home_id=p_home_id AND action_type='REMOVE_MEMBER'
      AND metadata->>'target_user_id'=p_target_id::text AND created_at>t-interval '30 days'
      AND NOT (state='approved' AND metadata->'execution'->>'status'='applied')) THEN
    RETURN '{"ok":false,"code":"REMOVAL_VOTE_RECENT","status":409}'::jsonb; END IF;
  SELECT coalesce(array_agg(x.user_id ORDER BY x.user_id),'{}'::uuid[]) INTO v_voters FROM public."HomeOccupancy" x
    WHERE x.home_id=p_home_id AND x.user_id<>p_target_id AND public.home_settled_resident(p_home_id,x.user_id);
  n:=cardinality(v_voters);
  IF n<2 THEN RETURN '{"ok":false,"code":"REMOVAL_VOTE_TOO_FEW","status":409}'::jsonb; END IF;
  v_required:=greatest(2,n/2+1);
  SELECT * INTO o FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_target_id;
  INSERT INTO public."HomeQuorumAction"(home_id,proposed_by,action_type,state,risk_tier,required_rule,required_approvals,
      min_rejects_to_block,expires_at,passive_approval_at,metadata)
    VALUES(p_home_id,p_actor_id,'REMOVE_MEMBER','collecting_votes',2,'majority',v_required,n-v_required+1,
      t+interval '7 days',NULL,jsonb_build_object('target_user_id',p_target_id,'target_occupancy_id',o.id,
        'target_source',o.verification_source,'electorate',to_jsonb(v_voters),'contest_until',t+interval '72 hours'))
    RETURNING * INTO a;
  INSERT INTO public."HomeQuorumVote"(quorum_action_id,voter_user_id,vote,voted_at) VALUES(a.id,p_actor_id,'approve',t);
  -- No actor: the Home's activity says a vote opened, never who asked.
  INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
    VALUES(p_home_id,NULL,'REMOVAL_VOTE_OPENED','HomeQuorumAction',a.id,
      jsonb_build_object('user_id',p_target_id,'closes_at',a.expires_at));
  RETURN jsonb_build_object('ok',true,'replayed',false,'vote_id',a.id,'closes_at',a.expires_at,
    'contest_until',a.metadata->'contest_until','notify_user_ids',to_jsonb(array_remove(v_voters,p_actor_id)),
    'target_proven',o.verification_source IN ('address','legacy'));
END $$;

-- The votes that count on a household vote: those of the people asked, other than the person it's about, who are
-- still settled residents.
CREATE FUNCTION public.home_removal_vote_tally(p_vote_id uuid) RETURNS TABLE(approvals integer,rejections integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT (count(*) FILTER (WHERE v.vote='approve'))::integer,(count(*) FILTER (WHERE v.vote='reject'))::integer
  FROM public."HomeQuorumAction" a JOIN public."HomeQuorumVote" v ON v.quorum_action_id=a.id
  WHERE a.id=p_vote_id AND v.voter_user_id::text<>a.metadata->>'target_user_id'
    AND (a.metadata->'electorate') ? v.voter_user_id::text AND public.home_settled_resident(a.home_id,v.voter_user_id)
$$;

-- Decides an open household vote at p_t when it can be decided. The caller holds the Home's lock, then the vote's.
--   * The person it's about can no longer be removed by a vote (they left, were removed or now manage the Home): it
--     closes with nothing to decide ('withdrawn').
--   * Kept ('kept') once a majority to remove can no longer be reached.
--   * Passed at the majority, but not before contest_until, so the person has had time to contest: it removes them
--     (apply_home_member_removal, in home_member_removal_context's vote mode), unless they proved the address and
--     contested: then Pantopus reviews it (AddressReviewCase, trigger removal_vote) and they keep access meanwhile.
--   * Otherwise it closes without a decision at expires_at ('expired'), and they stay.
-- Returns the vote's state, and the outcome once it's decided. Counts are never returned.
CREATE FUNCTION public.home_removal_vote_decide(p_vote_id uuid,p_t timestamptz) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public."HomeQuorumAction"%ROWTYPE; v_target uuid; v_approvals integer; v_rejections integer;
  v_removal jsonb; v_case uuid; v_outcome text; v_state public.quorum_action_state;
BEGIN
  SELECT * INTO a FROM public."HomeQuorumAction" WHERE id=p_vote_id AND action_type='REMOVE_MEMBER';
  IF NOT FOUND OR a.state NOT IN ('proposed','collecting_votes') THEN RETURN jsonb_build_object('state',a.state); END IF;
  v_target:=(a.metadata->>'target_user_id')::uuid;
  SELECT x.approvals,x.rejections INTO v_approvals,v_rejections FROM public.home_removal_vote_tally(a.id) x;
  IF NOT public.home_removal_vote_target(a.home_id,v_target) THEN
    v_state:='expired'; v_outcome:='withdrawn';
  ELSIF v_rejections>=a.min_rejects_to_block THEN
    v_state:='rejected'; v_outcome:='kept';
  ELSIF v_approvals>=a.required_approvals AND p_t>=(a.metadata->>'contest_until')::timestamptz THEN
    v_state:='approved';
    IF a.metadata ? 'contested_at' AND EXISTS(SELECT FROM public."HomeOccupancy" WHERE home_id=a.home_id
        AND user_id=v_target AND is_active IS TRUE AND verification_status='verified'
        AND verification_source IN ('address','legacy')) THEN
      INSERT INTO public."AddressReviewCase"(home_id,user_id,verdict_status,reasons,trigger,status)
        VALUES(a.home_id,v_target,'REMOVAL_VOTE_CONTESTED',jsonb_build_array(jsonb_build_object(
          'code','REMOVAL_VOTE_CONTESTED','quorum_action_id',a.id)),'removal_vote','open')
        RETURNING id INTO v_case;
      UPDATE public."HomeQuorumAction" SET state='approved',updated_at=p_t,metadata=a.metadata||jsonb_build_object(
        'execution',jsonb_build_object('status','held','approved_at',p_t,'review_case_id',v_case)) WHERE id=a.id;
      v_outcome:='review';
    ELSE
      UPDATE public."HomeQuorumAction" SET state='approved',updated_at=p_t,metadata=a.metadata||jsonb_build_object(
        'execution',jsonb_build_object('status','applying','approved_at',p_t,'attempt_at',p_t)) WHERE id=a.id;
      v_removal:=public.apply_home_member_removal(a.home_id,NULL,v_target);
      IF v_removal->>'ok'='true' THEN
        UPDATE public."HomeQuorumAction" SET updated_at=p_t,metadata=a.metadata||jsonb_build_object('execution',
          jsonb_build_object('status','applied','approved_at',p_t,'applied_at',coalesce(v_removal->'completed_at',to_jsonb(p_t))))
          WHERE id=a.id;
        v_outcome:='removed';
      ELSE
        UPDATE public."HomeQuorumAction" SET updated_at=p_t,metadata=a.metadata||jsonb_build_object('execution',
          jsonb_build_object('status','failed','approved_at',p_t,'failed_at',p_t,'failure',jsonb_build_object(
            'code',v_removal->>'code'))) WHERE id=a.id;
        v_outcome:='not_applied';
      END IF;
    END IF;
  ELSIF a.expires_at<=p_t THEN
    v_state:='expired'; v_outcome:='expired';
  ELSE
    RETURN jsonb_build_object('state',a.state);
  END IF;
  IF v_state<>'approved' THEN UPDATE public."HomeQuorumAction" SET state=v_state,updated_at=p_t WHERE id=a.id; END IF;
  -- No actor and no tally: the Home's activity shows the outcome only.
  INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
    VALUES(a.home_id,NULL,'REMOVAL_VOTE_ENDED','HomeQuorumAction',a.id,jsonb_build_object('user_id',v_target,
      'outcome',v_outcome,'code',v_removal->>'code'));
  RETURN jsonb_build_object('state',v_state,'outcome',v_outcome,'home_id',a.home_id,'vote_id',a.id,
    'target_user_id',v_target,'occupancy_id',v_removal->>'occupancy_id','completed_at',v_removal->>'completed_at',
    'code',v_removal->>'code','review_case_id',v_case);
END $$;

-- Records one voter's vote (they can change it while the vote is open) and decides the vote when it can be
-- (home_removal_vote_decide): kept once a majority can no longer be reached; passed at the majority once
-- contest_until has passed. A majority reached sooner waits for the hourly job (settle_home_removal_vote), and
-- voters can still change their votes meanwhile. Counts are never returned.
CREATE FUNCTION public.cast_home_removal_vote(p_home_id uuid,p_vote_id uuid,p_voter_id uuid,p_vote text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE a public."HomeQuorumAction"%ROWTYPE; t timestamptz; v_target uuid;
BEGIN
  IF p_home_id IS NULL OR p_vote_id IS NULL OR p_voter_id IS NULL OR p_vote IS NULL OR p_vote NOT IN ('approve','reject') THEN
    RETURN '{"ok":false,"code":"REMOVAL_VOTE_INVALID","status":400}'::jsonb; END IF;
  PERFORM 1 FROM public."Home" WHERE id=p_home_id FOR UPDATE;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"REMOVAL_VOTE_NOT_FOUND","status":404}'::jsonb; END IF;
  SELECT * INTO a FROM public."HomeQuorumAction" WHERE id=p_vote_id AND home_id=p_home_id AND action_type='REMOVE_MEMBER'
    FOR UPDATE;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"REMOVAL_VOTE_NOT_FOUND","status":404}'::jsonb; END IF;
  t:=clock_timestamp();
  v_target:=(a.metadata->>'target_user_id')::uuid;
  IF p_voter_id=v_target OR NOT (a.metadata->'electorate') ? p_voter_id::text
    OR NOT public.home_settled_resident(p_home_id,p_voter_id) THEN
    RETURN '{"ok":false,"code":"REMOVAL_VOTE_NOT_ELIGIBLE","status":403}'::jsonb; END IF;
  IF a.state NOT IN ('proposed','collecting_votes') OR a.expires_at<=t THEN
    RETURN '{"ok":false,"code":"REMOVAL_VOTE_CLOSED","status":409}'::jsonb; END IF;
  INSERT INTO public."HomeQuorumVote"(quorum_action_id,voter_user_id,vote,voted_at) VALUES(a.id,p_voter_id,p_vote,t)
    ON CONFLICT (quorum_action_id,voter_user_id) DO UPDATE SET vote=EXCLUDED.vote,voted_at=EXCLUDED.voted_at;
  RETURN jsonb_build_object('ok',true,'vote',p_vote)||public.home_removal_vote_decide(a.id,t);
END $$;

-- The hourly job (jobs/processQuorumActions.js) settles household votes nobody is voting on any more: a majority
-- reached before contest_until, a vote past its end, or one whose subject has left. due_home_removal_votes lists
-- them (oldest first, a page at a time); settle_home_removal_vote decides one (home_removal_vote_decide), under the
-- Home's lock, and returns its outcome for the notices.
CREATE FUNCTION public.due_home_removal_votes() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT jsonb_build_object('ok',true,'votes',
    coalesce(jsonb_agg(jsonb_build_object('home_id',d.home_id,'vote_id',d.id) ORDER BY d.created_at),'[]'::jsonb))
  FROM (SELECT a.id,a.home_id,a.created_at FROM public."HomeQuorumAction" a
    WHERE a.action_type='REMOVE_MEMBER' AND a.state IN ('proposed','collecting_votes')
      AND (a.expires_at<=now() OR NOT public.home_removal_vote_target(a.home_id,(a.metadata->>'target_user_id')::uuid)
        OR ((a.metadata->>'contest_until')::timestamptz<=now()
          AND (SELECT x.approvals FROM public.home_removal_vote_tally(a.id) x)>=a.required_approvals))
    ORDER BY a.created_at LIMIT 200) d
$$;

CREATE FUNCTION public.settle_home_removal_vote(p_home_id uuid,p_vote_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
BEGIN
  IF p_home_id IS NULL OR p_vote_id IS NULL THEN RETURN '{"ok":false,"code":"REMOVAL_VOTE_INVALID","status":400}'::jsonb; END IF;
  PERFORM 1 FROM public."Home" WHERE id=p_home_id FOR UPDATE;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"REMOVAL_VOTE_NOT_FOUND","status":404}'::jsonb; END IF;
  PERFORM 1 FROM public."HomeQuorumAction" WHERE id=p_vote_id AND home_id=p_home_id AND action_type='REMOVE_MEMBER'
    FOR UPDATE;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"REMOVAL_VOTE_NOT_FOUND","status":404}'::jsonb; END IF;
  RETURN '{"ok":true}'::jsonb||public.home_removal_vote_decide(p_vote_id,clock_timestamp());
END $$;

-- Pantopus decides a contested household vote (routes/adminAddressReview.js, through homeRemovalVoteService):
-- resolving its review case (trigger removal_vote) decides the held vote in the same transaction. Approved: the vote
-- removes the person (vote mode, as an uncontested vote that passes). Rejected or dismissed: they stay, and the vote
-- ends kept. Any other case isn't handled here ("handled": false); the caller resolves it as before.
CREATE FUNCTION public.resolve_home_removal_vote_review(p_case_id uuid,p_reviewer_id uuid,p_outcome text,p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE c public."AddressReviewCase"%ROWTYPE; a public."HomeQuorumAction"%ROWTYPE; t timestamptz; v_target uuid;
  v_removal jsonb; v_outcome text;
BEGIN
  IF p_case_id IS NULL OR p_reviewer_id IS NULL OR p_outcome IS NULL OR p_outcome NOT IN ('approved','rejected','dismissed') THEN
    RETURN '{"ok":false,"code":"REMOVAL_VOTE_INVALID","status":400}'::jsonb; END IF;
  SELECT * INTO c FROM public."AddressReviewCase" WHERE id=p_case_id;
  IF NOT FOUND OR c.trigger IS DISTINCT FROM 'removal_vote' OR c.home_id IS NULL THEN
    RETURN '{"ok":true,"handled":false}'::jsonb; END IF;
  -- The Home's lock first, as votes and removals take it.
  PERFORM 1 FROM public."Home" WHERE id=c.home_id FOR UPDATE;
  SELECT * INTO c FROM public."AddressReviewCase" WHERE id=p_case_id FOR UPDATE;
  IF c.status NOT IN ('open','in_review') THEN
    RETURN '{"ok":false,"code":"REVIEW_CASE_RESOLVED","status":409}'::jsonb; END IF;
  t:=clock_timestamp();
  UPDATE public."AddressReviewCase" SET status=p_outcome,resolved_by=p_reviewer_id,resolved_at=t,
    resolution_note=p_note,updated_at=t WHERE id=c.id;
  SELECT * INTO a FROM public."HomeQuorumAction" WHERE home_id=c.home_id AND action_type='REMOVE_MEMBER'
    AND state='approved' AND metadata->'execution'->>'status'='held'
    AND metadata->'execution'->>'review_case_id'=c.id::text FOR UPDATE;
  IF NOT FOUND THEN RETURN '{"ok":true,"handled":true}'::jsonb; END IF;
  v_target:=(a.metadata->>'target_user_id')::uuid;
  IF p_outcome='approved' THEN
    UPDATE public."HomeQuorumAction" SET updated_at=t,metadata=a.metadata||jsonb_build_object('execution',
      (a.metadata->'execution')||jsonb_build_object('status','applying','reviewed_at',t,'attempt_at',t)) WHERE id=a.id;
    v_removal:=public.apply_home_member_removal(c.home_id,NULL,v_target);
    IF v_removal->>'ok'='true' THEN
      UPDATE public."HomeQuorumAction" SET updated_at=t,metadata=a.metadata||jsonb_build_object('execution',
        (a.metadata->'execution')||jsonb_build_object('status','applied','reviewed_at',t,
          'applied_at',coalesce(v_removal->'completed_at',to_jsonb(t)))) WHERE id=a.id;
      v_outcome:='removed';
    ELSE
      UPDATE public."HomeQuorumAction" SET updated_at=t,metadata=a.metadata||jsonb_build_object('execution',
        (a.metadata->'execution')||jsonb_build_object('status','failed','reviewed_at',t,'failed_at',t,
          'failure',jsonb_build_object('code',v_removal->>'code'))) WHERE id=a.id;
      v_outcome:='not_applied';
    END IF;
  ELSE
    UPDATE public."HomeQuorumAction" SET state='rejected',updated_at=t,metadata=a.metadata||jsonb_build_object(
      'execution',(a.metadata->'execution')||jsonb_build_object('status','overturned','reviewed_at',t)) WHERE id=a.id;
    v_outcome:='kept';
  END IF;
  INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
    VALUES(c.home_id,NULL,'REMOVAL_VOTE_ENDED','HomeQuorumAction',a.id,jsonb_build_object('user_id',v_target,
      'outcome',v_outcome,'reviewed',true,'code',v_removal->>'code'));
  RETURN jsonb_build_object('ok',true,'handled',true,'outcome',v_outcome,'home_id',c.home_id,'vote_id',a.id,
    'target_user_id',v_target,'occupancy_id',v_removal->>'occupancy_id','completed_at',v_removal->>'completed_at',
    'code',v_removal->>'code');
END $$;

-- The person a vote is about contests it. Contesting means proving: only someone whose own access is proof of the
-- address (a postcard, document, landlord or legacy verification) can, and a vote that then passes goes to Pantopus
-- review instead of removing them. Anyone else is told to prove the address first (REMOVAL_VOTE_PROOF_REQUIRED).
CREATE FUNCTION public.contest_home_removal_vote(p_home_id uuid,p_vote_id uuid,p_actor_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE a public."HomeQuorumAction"%ROWTYPE; t timestamptz;
BEGIN
  IF p_home_id IS NULL OR p_vote_id IS NULL OR p_actor_id IS NULL THEN
    RETURN '{"ok":false,"code":"REMOVAL_VOTE_INVALID","status":400}'::jsonb; END IF;
  PERFORM 1 FROM public."Home" WHERE id=p_home_id FOR UPDATE;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"REMOVAL_VOTE_NOT_FOUND","status":404}'::jsonb; END IF;
  SELECT * INTO a FROM public."HomeQuorumAction" WHERE id=p_vote_id AND home_id=p_home_id AND action_type='REMOVE_MEMBER'
    AND metadata->>'target_user_id'=p_actor_id::text FOR UPDATE;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"REMOVAL_VOTE_NOT_FOUND","status":404}'::jsonb; END IF;
  t:=clock_timestamp();
  IF a.state NOT IN ('proposed','collecting_votes') OR a.expires_at<=t THEN
    RETURN '{"ok":false,"code":"REMOVAL_VOTE_CLOSED","status":409}'::jsonb; END IF;
  IF NOT EXISTS(SELECT FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_actor_id AND is_active IS TRUE
      AND verification_status='verified' AND verification_source IN ('address','legacy')) THEN
    RETURN '{"ok":false,"code":"REMOVAL_VOTE_PROOF_REQUIRED","status":409}'::jsonb; END IF;
  IF a.metadata ? 'contested_at' THEN
    RETURN jsonb_build_object('ok',true,'replayed',true,'contested_at',a.metadata->'contested_at'); END IF;
  UPDATE public."HomeQuorumAction" SET metadata=metadata||jsonb_build_object('contested_at',t),updated_at=t WHERE id=a.id;
  INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
    VALUES(p_home_id,p_actor_id,'REMOVAL_VOTE_CONTESTED','HomeQuorumAction',a.id,jsonb_build_object('user_id',p_actor_id));
  RETURN jsonb_build_object('ok',true,'replayed',false,'contested_at',t);
END $$;

-- What the viewer sees of household votes: the open ones about them, and those they were asked to decide while
-- they're still a member here (their own vote only; never who started one or how anyone else voted), and the
-- members they could start one about now: nobody while a vote is open. That list is offered only to someone who may
-- see the household's member list (members.view), so it never tells anyone else who lives there.
CREATE FUNCTION public.list_home_removal_votes(p_home_id uuid,p_viewer_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_votes jsonb; v_settled uuid[]; v_can_start uuid[]:='{}'::uuid[]; v_access jsonb;
BEGIN
  IF p_home_id IS NULL OR p_viewer_id IS NULL THEN
    RETURN '{"ok":false,"code":"REMOVAL_VOTE_INVALID","status":400}'::jsonb; END IF;
  v_access:=public.home_effective_access(p_home_id,p_viewer_id);
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'target_user_id',a.metadata->>'target_user_id',
      'about_you',a.metadata->>'target_user_id'=p_viewer_id::text,'opened_at',a.created_at,'closes_at',a.expires_at,
      'contest_until',a.metadata->'contest_until','contested',a.metadata ? 'contested_at',
      'my_vote',(SELECT v.vote FROM public."HomeQuorumVote" v WHERE v.quorum_action_id=a.id
        AND v.voter_user_id=p_viewer_id AND a.metadata->>'target_user_id'<>p_viewer_id::text),
      'can_vote',a.metadata->>'target_user_id'<>p_viewer_id::text AND public.home_settled_resident(p_home_id,p_viewer_id),
      'can_contest',a.metadata->>'target_user_id'=p_viewer_id::text AND NOT a.metadata ? 'contested_at'
        AND EXISTS(SELECT FROM public."HomeOccupancy" o WHERE o.home_id=p_home_id AND o.user_id=p_viewer_id
          AND o.is_active IS TRUE AND o.verification_status='verified' AND o.verification_source IN ('address','legacy')))
      ORDER BY a.created_at),'[]'::jsonb) INTO v_votes
    FROM public."HomeQuorumAction" a WHERE a.home_id=p_home_id AND a.action_type='REMOVE_MEMBER'
      AND a.state IN ('proposed','collecting_votes') AND a.expires_at>now()
      AND (a.metadata->>'target_user_id'=p_viewer_id::text
        OR ((a.metadata->'electorate') ? p_viewer_id::text AND v_access->>'has_access'='true'));
  IF public.home_settled_resident(p_home_id,p_viewer_id)
    AND (v_access->'permissions') ? 'members.view'
    AND EXISTS(SELECT FROM public."FeatureFlag" WHERE flag_name='home_removal_vote' AND enabled_globally)
    AND EXISTS(SELECT FROM public."Home" WHERE id=p_home_id AND security_state NOT IN ('frozen','frozen_silent','disputed')
      AND home_status NOT IN ('archived','merged'))
    AND NOT EXISTS(SELECT FROM public."HomeQuorumAction" q WHERE q.home_id=p_home_id AND q.action_type='REMOVE_MEMBER'
      AND q.state IN ('proposed','collecting_votes')) THEN
    SELECT coalesce(array_agg(x.user_id),'{}'::uuid[]) INTO v_settled FROM public."HomeOccupancy" x
      WHERE x.home_id=p_home_id AND public.home_settled_resident(p_home_id,x.user_id);
    -- The same rules open_home_removal_vote applies, so a member listed here can be asked about now.
    SELECT coalesce(array_agg(x.user_id ORDER BY x.user_id),'{}'::uuid[]) INTO v_can_start FROM public."HomeOccupancy" x
      WHERE x.home_id=p_home_id AND x.user_id<>p_viewer_id AND public.home_removal_vote_target(p_home_id,x.user_id)
        AND cardinality(array_remove(v_settled,x.user_id))>=2
        AND NOT EXISTS(SELECT FROM public."HomeQuorumAction" q WHERE q.home_id=p_home_id AND q.action_type='REMOVE_MEMBER'
          AND q.metadata->>'target_user_id'=x.user_id::text
          AND ((q.state='approved' AND q.metadata->'execution'->>'status'='held')
            OR (q.created_at>now()-interval '30 days'
              AND NOT (q.state='approved' AND q.metadata->'execution'->>'status'='applied'))));
  END IF;
  RETURN jsonb_build_object('ok',true,'votes',v_votes,'can_start_for',to_jsonb(v_can_start));
END $$;

CREATE OR REPLACE FUNCTION public.home_effective_access(p_home_id uuid, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_denied constant jsonb := '{"role_base":null,"effective_role_base":null,"age_band":null,"has_access":false,"is_owner":false,"permissions":[]}';
  v_home public."Home"%ROWTYPE;
  v_occ public."HomeOccupancy"%ROWTYPE;
  v_has_occ boolean;
  v_role public.home_role_base;
  v_effective_role public.home_role_base;
  v_owner boolean := false;
  v_minor boolean := false;
  v_permissions text[];
  v_age_ceiling text[] := ARRAY[
    'home.view', 'members.view', 'tasks.view', 'calendar.view', 'docs.view',
    'packages.view', 'maintenance.view', 'assets.view', 'devices.view', 'vendors.view'];
BEGIN
  IF p_home_id IS NULL OR p_user_id IS NULL THEN RETURN v_denied; END IF;
  IF p_user_id IS DISTINCT FROM auth.uid()
    AND coalesce(current_setting('role', true), '') <> 'service_role'
    AND NOT (coalesce(current_setting('role', true), 'none') = 'none'
      AND session_user IN ('postgres', 'supabase_admin')) THEN
    RETURN v_denied;
  END IF;

  SELECT * INTO v_home FROM public."Home" WHERE id = p_home_id;
  IF NOT FOUND THEN RETURN v_denied; END IF;
  SELECT * INTO v_occ FROM public."HomeOccupancy"
    WHERE home_id = p_home_id AND user_id = p_user_id;
  v_has_occ := FOUND;
  IF v_has_occ THEN
    v_role := v_occ.role_base;
    IF v_role IS NULL THEN
      v_role := CASE v_occ.role
        WHEN 'owner' THEN 'owner' WHEN 'admin' THEN 'admin'
        WHEN 'manager' THEN 'manager' WHEN 'property_manager' THEN 'manager'
        WHEN 'tenant' THEN 'lease_resident' WHEN 'renter' THEN 'lease_resident'
        WHEN 'lease_resident' THEN 'lease_resident'
        WHEN 'member' THEN 'member' WHEN 'roommate' THEN 'member' WHEN 'family' THEN 'member'
        WHEN 'restricted_member' THEN 'restricted_member' WHEN 'caregiver' THEN 'restricted_member'
        WHEN 'guest' THEN 'guest' WHEN 'service_provider' THEN 'service_provider'
        ELSE NULL END;
    END IF;
    -- An existing revoked/invalid occupancy fences even legacy/verified owners.
    -- NULL verification status is historical unknown, not verified residency.
    IF v_occ.is_active IS DISTINCT FROM true OR v_role IS NULL
      OR v_occ.verification_status IS DISTINCT FROM 'verified'
      OR (v_occ.start_at IS NOT NULL AND v_occ.start_at > now())
      OR (v_occ.end_at IS NOT NULL AND v_occ.end_at <= now())
      OR (v_occ.access_start_at IS NOT NULL AND v_occ.access_start_at > now())
      OR (v_occ.access_end_at IS NOT NULL AND v_occ.access_end_at <= now()) THEN
      RETURN v_denied;
    END IF;
    v_minor := v_occ.age_band IN ('child', 'teen');
  END IF;

  v_owner := v_home.owner_id = p_user_id OR EXISTS (
    SELECT FROM public."HomeOwner" o WHERE o.home_id = p_home_id
      AND o.subject_type = 'user' AND o.subject_id = p_user_id AND o.owner_status = 'verified')
    OR (v_has_occ AND v_role = 'owner');
  v_owner := coalesce(v_owner, false);
  IF NOT v_has_occ AND NOT v_owner THEN RETURN v_denied; END IF;
  v_role := coalesce(v_role, 'owner'::public.home_role_base);
  v_effective_role := CASE WHEN v_owner THEN 'owner'::public.home_role_base ELSE v_role END;
  IF coalesce(v_minor, false) THEN
    IF v_occ.age_band = 'child' AND public.home_role_rank(v_effective_role) > 20 THEN
      v_effective_role := 'restricted_member';
    ELSIF v_occ.age_band = 'teen' AND public.home_role_rank(v_effective_role) > 30 THEN
      v_effective_role := 'member';
    END IF;
    IF v_occ.age_band = 'teen' THEN
      v_age_ceiling := v_age_ceiling || ARRAY[
        'tasks.edit', 'calendar.edit', 'docs.upload', 'maintenance.edit', 'packages.edit'];
    END IF;
  END IF;

  -- Preserve explicit user grants over role defaults. Owner entitlement uses
  -- owner defaults; a recorded member default cannot demote verified ownership.
  -- Explicit user denies win, then minor ceilings restrict every source.
  SELECT coalesce(array_agg(p::text ORDER BY p::text), '{}'::text[])
    INTO v_permissions
    FROM unnest(enum_range(NULL::public.home_permission)) AS p
    WHERE ((v_owner AND NOT EXISTS (
      SELECT FROM public."HomeRolePermission" r WHERE r.role_base = 'owner'
        AND r.permission = p AND NOT r.allowed)) OR (NOT v_owner AND EXISTS (
      SELECT FROM public."HomeRolePermission" r WHERE r.role_base = v_role
        AND r.permission = p AND r.allowed))
      OR EXISTS (SELECT FROM public."HomePermissionOverride" o
        WHERE o.home_id = p_home_id AND o.user_id = p_user_id AND o.permission = p AND o.allowed))
    AND NOT EXISTS (SELECT FROM public."HomePermissionOverride" o
      WHERE o.home_id = p_home_id AND o.user_id = p_user_id AND o.permission = p AND NOT o.allowed)
    AND (NOT coalesce(v_minor, false) OR p::text = ANY(v_age_ceiling));

  -- Home claims PR 5: someone a household vote may remove keeps their access while the vote is open, but not the
  -- power to bring people in or decide about them (invite, answer a request to join, remove, change a role).
  IF NOT v_owner AND 'members.manage' = ANY(v_permissions)
    AND public.home_removal_vote_open(p_home_id, p_user_id) THEN
    v_permissions := array_remove(v_permissions, 'members.manage');
  END IF;

  RETURN jsonb_build_object('role_base', v_role, 'effective_role_base', v_effective_role,
    'age_band', v_occ.age_band, 'has_access', true,
    'is_owner', v_owner AND NOT coalesce(v_minor, false), 'permissions', v_permissions);
END;
$$;

CREATE OR REPLACE FUNCTION public.home_member_removal_context(p_home_id uuid,p_actor_id uuid,p_target_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE v_home public."Home"%ROWTYPE; v_target public."HomeOccupancy"%ROWTYPE;
  v_actor jsonb; v_actor_role public.home_role_base; v_target_role public.home_role_base;
  v_self boolean; v_target_owner boolean; v_actor_perms text[]; v_now timestamptz;
  v_stale_pointer boolean; v_terminal boolean; v_ownership_cleanup boolean; v_profile jsonb;
  v_home_view jsonb; v_target_view jsonb; v_hash text; v_vote boolean;
BEGIN
  IF p_home_id IS NULL OR p_target_id IS NULL THEN
    RETURN '{"ok":false,"code":"MEMBER_REMOVAL_INVALID","status":400}'::jsonb; END IF;
  SELECT * INTO v_home FROM public."Home" WHERE id=p_home_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','HOME_NOT_FOUND','status',404); END IF;
  LOCK TABLE public."HomeRolePermission", public."HomeRolePreset" IN SHARE MODE;
  PERFORM id FROM public."HomeOccupancy" WHERE home_id=p_home_id ORDER BY id FOR UPDATE;
  PERFORM id FROM public."HomeOwner" WHERE home_id=p_home_id ORDER BY id FOR UPDATE;
  PERFORM user_id FROM public."HomePermissionOverride" WHERE home_id=p_home_id ORDER BY user_id,permission FOR UPDATE;
  -- Profile review can block too; finish it before measuring current authority.
  PERFORM 1 FROM public."User" WHERE id=p_target_id FOR SHARE;
  -- now() remains the transaction start across lock waits. Authority must still
  -- be current when this mutation is admitted, including an expiring actor.
  v_now := clock_timestamp();
  v_self := coalesce(p_actor_id=p_target_id,false);
  -- Home claims PR 5: a household vote that passed removes the member with no actor (cast_home_removal_vote). Only
  -- an approved REMOVE_MEMBER vote about this person that is being applied now admits that; the person's role and
  -- ownership are still checked below, and the frozen-Home refusal above applies too.
  v_vote := p_actor_id IS NULL AND EXISTS(SELECT FROM public."HomeQuorumAction" WHERE home_id=p_home_id
    AND action_type='REMOVE_MEMBER' AND state='approved' AND metadata->>'target_user_id'=p_target_id::text
    AND metadata->'execution'->>'status'='applying');
  IF p_actor_id IS NULL AND NOT v_vote THEN
    RETURN '{"ok":false,"code":"MEMBER_REMOVAL_INVALID","status":400}'::jsonb; END IF;
  IF NOT v_self AND (
    v_home.security_state IN ('frozen','frozen_silent') OR EXISTS (
      SELECT FROM public."HomeOccupancy" o WHERE o.home_id=p_home_id AND o.user_id=p_actor_id
        AND (o.start_at>v_now OR o.end_at<=v_now OR o.access_start_at>v_now OR o.access_end_at<=v_now))) THEN
    RETURN jsonb_build_object('ok',false,'code','MEMBERS_MANAGE_REQUIRED','status',403);
  END IF;
  v_actor := public.home_effective_access(p_home_id,p_actor_id);
  -- A revoked ownership proof cannot leave implicit owner powers behind via a
  -- stale pointer/role. Historical revoked rows may coexist with a current
  -- verified owner; a former owner with independently granted admin rights also
  -- keeps those bounded rights rather than inheriting implicit ownership.
  IF NOT v_self AND v_actor->>'is_owner'='true'
    AND EXISTS (SELECT FROM public."HomeOwner" o WHERE o.home_id=p_home_id AND o.subject_type='user'
      AND o.subject_id=p_actor_id AND o.owner_status IN ('revoked','disputed'))
    AND NOT EXISTS (SELECT FROM public."HomeOwner" o WHERE o.home_id=p_home_id AND o.subject_type='user'
      AND o.subject_id=p_actor_id AND o.owner_status='verified') THEN
    RETURN jsonb_build_object('ok',false,'code','MEMBERS_MANAGE_REQUIRED','status',403);
  END IF;
  v_actor_role := (v_actor->>'effective_role_base')::public.home_role_base;
  SELECT ARRAY(SELECT jsonb_array_elements_text(v_actor->'permissions')) INTO v_actor_perms;
  IF NOT v_self AND NOT v_vote AND NOT ('members.manage'=ANY(v_actor_perms)) THEN
    RETURN jsonb_build_object('ok',false,'code','MEMBERS_MANAGE_REQUIRED','status',403);
  END IF;
  SELECT * INTO v_target FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_target_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','MEMBER_NOT_FOUND','status',404); END IF;
  v_target_role := v_target.role_base;
  IF v_target_role IS NULL THEN
    v_target_role := CASE v_target.role
      WHEN 'owner' THEN 'owner' WHEN 'admin' THEN 'admin' WHEN 'manager' THEN 'manager'
      WHEN 'property_manager' THEN 'manager' WHEN 'tenant' THEN 'lease_resident'
      WHEN 'renter' THEN 'lease_resident' WHEN 'lease_resident' THEN 'lease_resident'
      WHEN 'member' THEN 'member' WHEN 'family' THEN 'member' WHEN 'roommate' THEN 'member'
      WHEN 'restricted_member' THEN 'restricted_member' WHEN 'caregiver' THEN 'restricted_member'
      WHEN 'guest' THEN 'guest' WHEN 'service_provider' THEN 'service_provider' ELSE NULL END::public.home_role_base;
  END IF;
  IF v_target_role IS NULL AND NOT v_self THEN
    RETURN jsonb_build_object('ok',false,'code','MEMBER_ROLE_UNKNOWN','status',409);
  END IF;
  v_target_owner := coalesce(v_home.owner_id=p_target_id,false) OR v_target_role='owner'
    OR EXISTS (SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user'
      AND subject_id=p_target_id AND owner_status='verified');
  IF NOT v_self AND NOT v_vote AND (v_actor_role IS DISTINCT FROM 'owner')
    AND (v_target_owner OR public.home_role_rank(v_target_role)
      >=public.home_member_rank_ceiling(p_home_id,p_actor_id,v_actor_role,v_target.verification_source)) THEN
    RETURN jsonb_build_object('ok',false,'code','TARGET_RANK_FORBIDDEN','status',403);
  END IF;
  -- A household vote never removes a manager, an admin or an owner (owners go to OWNERSHIP_FLOW_REQUIRED below).
  IF v_vote AND NOT v_target_owner AND public.home_role_rank(v_target_role)>=public.home_role_rank('manager') THEN
    RETURN jsonb_build_object('ok',false,'code','TARGET_RANK_FORBIDDEN','status',403);
  END IF;

  IF NOT v_self AND v_target_owner THEN
    RETURN '{"ok":false,"code":"OWNERSHIP_FLOW_REQUIRED","status":409}'::jsonb; END IF;
  v_stale_pointer:=v_self AND coalesce(v_home.owner_id=p_target_id,false)
    AND EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user'
      AND subject_id=p_target_id AND owner_status IN ('revoked','disputed'))
    AND NOT EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user'
      AND subject_id=p_target_id AND owner_status='verified');
  IF v_self AND ((v_home.owner_id=p_target_id AND NOT v_stale_pointer) OR EXISTS(SELECT FROM public."HomeOwner"
    WHERE home_id=p_home_id AND subject_type='user' AND subject_id=p_target_id
      AND owner_status='verified' AND is_primary_owner)) THEN
    RETURN '{"ok":false,"code":"TRANSFER_REQUIRED","status":409}'::jsonb; END IF;
  v_terminal:=public.home_member_removal_terminal(v_target,v_now);
  v_ownership_cleanup:=v_self AND (v_stale_pointer OR EXISTS(SELECT FROM public."HomeOwner"
    WHERE home_id=p_home_id AND subject_type='user' AND subject_id=p_target_id
      AND NOT is_primary_owner AND owner_status IS DISTINCT FROM 'revoked') OR
    (v_home.vacancy_at IS NULL AND NOT EXISTS(SELECT FROM (
      SELECT user_id FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id<>p_target_id
      UNION SELECT subject_id FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user' AND owner_status='verified' AND subject_id<>p_target_id
      UNION SELECT owner_id FROM public."Home" WHERE id=p_home_id AND owner_id IS NOT NULL AND owner_id<>p_target_id
    ) remaining WHERE public.home_has_role_at_least(p_home_id,'manager',remaining.user_id)
      AND NOT EXISTS(SELECT FROM public."HomeOccupancy" o WHERE o.home_id=p_home_id AND o.user_id=remaining.user_id
        AND (o.start_at>v_now OR o.end_at<=v_now OR o.access_start_at>v_now OR o.access_end_at<=v_now)))));
  SELECT jsonb_build_object('id',id,'name',NULL,'username',username) INTO v_profile FROM public."User" WHERE id=p_target_id;
  IF v_profile IS NULL OR v_target.is_active IS NULL THEN
    RETURN '{"ok":false,"code":"MEMBER_NOT_FOUND","status":404}'::jsonb; END IF;
  v_home_view:=jsonb_build_object('id',v_home.id,'name',v_home.name);
  v_target_view:=v_profile||jsonb_build_object('role_base',v_target_role,'is_self',v_self,
    'is_active',v_target.is_active,'verification_status',v_target.verification_status,
    'start_at',v_target.start_at,'end_at',v_target.end_at,'access_start_at',v_target.access_start_at,'access_end_at',v_target.access_end_at);
  v_hash:=encode(sha256(convert_to(jsonb_build_object('version',1,'actor_id',p_actor_id,
    'occupancy',to_jsonb(v_target)-ARRAY['updated_at','density_milestone_seen'],
    'target',v_target_view,'home',v_home_view,'owner_id',v_home.owner_id,'security_state',v_home.security_state,
    'vacancy_at',v_home.vacancy_at,'target_owners',(SELECT coalesce(jsonb_agg(to_jsonb(o) ORDER BY id),'[]')
      FROM public."HomeOwner"o WHERE home_id=p_home_id AND subject_type='user' AND subject_id=p_target_id))::text,'UTF8')),'hex');
  RETURN jsonb_build_object('ok',true,'home_id',p_home_id,'target_user_id',p_target_id,'occupancy_id',v_target.id,
    'action','remove','decision_token',v_hash,'home',v_home_view,'target',v_target_view,
    'terminal',v_terminal,'ownership_cleanup',v_ownership_cleanup,'stale_pointer',v_stale_pointer);
END $$;

-- The replaced functions keep their service-only grants; restated here with the new functions'. The tally and the
-- decision run only inside the functions that take the locks first, so nobody is granted them.
REVOKE ALL ON FUNCTION public.home_removal_vote_tally(uuid),
  public.home_removal_vote_decide(uuid,timestamptz) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.home_removal_vote_open(uuid,uuid),
  public.home_settled_resident(uuid,uuid),
  public.home_removal_vote_target(uuid,uuid),
  public.home_effective_access(uuid,uuid),
  public.home_member_removal_context(uuid,uuid,uuid),
  public.open_home_removal_vote(uuid,uuid,uuid),
  public.cast_home_removal_vote(uuid,uuid,uuid,text),
  public.due_home_removal_votes(),
  public.settle_home_removal_vote(uuid,uuid),
  public.resolve_home_removal_vote_review(uuid,uuid,text,text),
  public.contest_home_removal_vote(uuid,uuid,uuid),
  public.list_home_removal_votes(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.home_removal_vote_open(uuid,uuid),
  public.home_settled_resident(uuid,uuid),
  public.home_removal_vote_target(uuid,uuid),
  public.home_effective_access(uuid,uuid),
  public.home_member_removal_context(uuid,uuid,uuid),
  public.open_home_removal_vote(uuid,uuid,uuid),
  public.cast_home_removal_vote(uuid,uuid,uuid,text),
  public.due_home_removal_votes(),
  public.settle_home_removal_vote(uuid,uuid),
  public.resolve_home_removal_vote_review(uuid,uuid,text,text),
  public.contest_home_removal_vote(uuid,uuid,uuid),
  public.list_home_removal_votes(uuid,uuid) TO service_role;
