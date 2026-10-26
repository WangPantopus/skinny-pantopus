-- Backwards compatible: yes. Adds one allowed value to HomeOccupancy.verification_source, one switched-off
-- FeatureFlag row, five new service-only functions, and forward replacements of eight existing functions with
-- the same signatures and grants. While home_instant_claim is off (its default) nothing creates a 'claim'
-- occupancy, so every replaced function behaves exactly as before for existing rows; deployed apps and the
-- current backend never send or read the new value.
--
-- Home claims plan, PR 3 (the Claimed level; plan "when-users-claim-an-streamed-willow", approved by the
-- founder on 2026-10-25 together with instant claims at addresses where nobody lives yet, behind a flag
-- that is off by default). A private setup's creator who says "I live here" or "I own it" can claim it at
-- once: household access, the Home's own sections, and inviting their household. A claim is not proof:
-- 'claim' joins 'household' (F3b) among the sources no address-proof gate accepts, a claim never reviews
-- or challenges a newcomer, and a claimer has no authority over anyone who proved the address.
-- A proof always beats a claim (the plan; the 2026-10-26 review found a claimer kept every grant after the real
-- resident proved the address): once someone who proved the address lives at the Home, people whose access is a
-- claim keep only their role's defaults until one of them says they live there (home_claim_set_aside), and anyone
-- who proved it may remove or confirm them. Nothing is stored for the step back, so it lifts by itself.
--
-- Latest permitted sources (bodies copied unchanged except the lines commented below):
--   home_effective_access            supabase/migrations/20260910001500_home_effective_permissions.sql:20
--   home_residency_review_authority  supabase/migrations/20260910233000_home_residency_review_receipts.sql:40
--   home_postcard_current_context    supabase/migrations/20261006190147_home_postcard_pending_owner.sql:20
--   home_invite_target_policy        supabase/migrations/20261006212635_home_invitation_restores_ended_membership.sql:13
--   act_on_home_invitation           supabase/migrations/20261007014348_home_open_link_no_readmit.sql:13
--   home_member_removal_context      supabase/migrations/20260913010000_home_member_removal_recovery.sql:34
--   mutate_home_member               supabase/migrations/20260913010000_home_member_removal_recovery.sql:201
--   home_secret_context              supabase/migrations/20260910200000_home_task_recurrence.sql:250
SET LOCAL lock_timeout='5s';

ALTER TABLE public."HomeOccupancy" DROP CONSTRAINT "HomeOccupancy_verification_source_check";
ALTER TABLE public."HomeOccupancy" ADD CONSTRAINT "HomeOccupancy_verification_source_check"
  CHECK (verification_source IN ('address','household','legacy','claim')) NOT VALID;
ALTER TABLE public."HomeOccupancy" VALIDATE CONSTRAINT "HomeOccupancy_verification_source_check";
COMMENT ON COLUMN public."HomeOccupancy".verification_source IS
  'Origin of residency trust: address proof, household consent, retained legacy verification, or a claim (an instant claim at an address with no household, or an invitation from someone whose own access is a claim). Status/access/expiry still apply.';

-- Off until the founder turns it on (POST /api/admin/feature-flags/home_instant_claim). Turning it off stops
-- new claims within the flag cache's minute in the API and at once in claim_home_private_setup below.
INSERT INTO public."FeatureFlag" (flag_name, enabled_globally, enabled_for_internal_team, beta_user_ids, description)
VALUES ('home_instant_claim', false, false, ARRAY[]::uuid[],
  'Instant Claimed status: a private setup at an address with no household becomes a claimed home at once (household tools, the Home''s own sections, invitations). Off by default; turn it off to stop new claims.')
ON CONFLICT (flag_name) DO NOTHING;

-- Someone who proved the address: their own current, verified, adult membership rests on proof (a postcard, document,
-- landlord, or legacy verification: source address or legacy) and they live there as a member, not as a guest,
-- service provider or restricted member.
CREATE FUNCTION public.home_proof_holder(p_home_id uuid,p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS(SELECT FROM public."HomeOccupancy" o WHERE o.home_id=p_home_id AND o.user_id=p_user_id
    AND o.is_active IS TRUE AND o.verification_status='verified' AND o.verification_source IN ('address','legacy')
    AND coalesce(o.age_band::text,'adult')='adult'
    AND coalesce(o.role_base,public.home_invite_role(o.role))::text IN ('owner','admin','manager','lease_resident','member')
    AND (o.start_at IS NULL OR o.start_at<=now()) AND (o.end_at IS NULL OR o.end_at>now())
    AND (o.access_start_at IS NULL OR o.access_start_at<=now()) AND (o.access_end_at IS NULL OR o.access_end_at>now()))
$$;

-- Proof beats a claim. Someone whose access is a claim steps back while someone who proved the address lives at the
-- Home and none of the people who proved it has said they live there too (a HOME_CLAIM_CONFIRMED row on their
-- membership from a current proof holder, written since it was last verified): home_effective_access then leaves
-- them only their role's defaults, not the claim's grants. Nothing is stored for the step back, so it lifts by itself
-- when no proof holder remains or one confirms them.
CREATE FUNCTION public.home_claim_set_aside(p_home_id uuid,p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS(SELECT FROM public."HomeOccupancy" c WHERE c.home_id=p_home_id AND c.user_id=p_user_id
    AND c.verification_source='claim' AND c.verification_status='verified'
    AND EXISTS(SELECT FROM public."HomeOccupancy" p WHERE p.home_id=p_home_id AND p.user_id<>p_user_id
      AND public.home_proof_holder(p_home_id,p.user_id))
    AND NOT EXISTS(SELECT FROM public."HomeAuditLog" a WHERE a.home_id=p_home_id AND a.action='HOME_CLAIM_CONFIRMED'
      AND a.target_type='HomeOccupancy' AND a.target_id=c.id AND a.created_at>=c.verified_at
      AND a.actor_user_id<>p_user_id AND public.home_proof_holder(p_home_id,a.actor_user_id)))
$$;

-- The rank a non-owner's authority over another member is measured against (invitations, role and permission
-- changes, removals): the target's role must rank below it. Normally that is the actor's own role. Three rules:
--   * Proof beats a claim. Someone whose own access is only a claim has no authority over a member who isn't
--     also unproven by claim (who proved the address, or whom an owner or a proven member let in).
--   * And the other way: someone who proved the address (home_proof_holder) decides about people whose access is
--     a claim, up to lease_resident, never a manager, admin or owner.
--   * The person who set up the Home (its creator, with a current verified adult occupancy) brings in their
--     household: they may invite, and manage people admitted by household consent or by their claim, up to
--     lease_resident, never a manager, admin or owner, and never someone who proved the address themselves.
-- p_target_source is the target occupancy's verification_source, or NULL for someone not yet in the Home.
CREATE FUNCTION public.home_member_rank_ceiling(p_home_id uuid,p_actor_id uuid,p_actor_role public.home_role_base,
  p_target_source text) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT CASE
    WHEN o.verification_source='claim' AND p_target_source IS NOT NULL AND p_target_source<>'claim' THEN 0
    WHEN p_target_source='claim' AND public.home_proof_holder(p_home_id,p_actor_id)
      THEN greatest(public.home_role_rank(p_actor_role),public.home_role_rank('lease_resident')+1)
    WHEN h.created_by_user_id=p_actor_id AND o.verification_status='verified' AND o.is_active IS TRUE
      AND coalesce(o.age_band::text,'adult')='adult' AND coalesce(p_target_source,'claim') IN ('claim','household')
      THEN greatest(public.home_role_rank(p_actor_role),public.home_role_rank('lease_resident')+1)
    ELSE public.home_role_rank(p_actor_role) END
  FROM public."Home" h LEFT JOIN public."HomeOccupancy" o ON o.home_id=h.id AND o.user_id=p_actor_id
  WHERE h.id=p_home_id
$$;

-- An instant claim (founder decision, 2026-10-25): the creator of a Home that is still their private setup, at an
-- address where nobody else has anything (home_secret_context's private predicate: no other person, owner, claim,
-- record, file or history), who said "I live here" or "I own it", gets household access now. Their occupancy becomes
-- verified with source 'claim', which no address-proof gate accepts, and the household tools they would use at
-- their own home are granted to them by permission rows they can't extend to mail, ownership, security, disputes or
-- votes. A property manager's setup isn't a claim to live there and keeps the existing flow. Ownership stays
-- pending: a claim never confirms ownership. The FeatureFlag row is read here, at the moment of the claim, so
-- turning home_instant_claim off stops new claims at once; existing claims keep their access.
-- p_settle_days (7, or 14 for a medium address watch) is recorded for the later probation and vote work.
CREATE FUNCTION public.claim_home_private_setup(p_home_id uuid,p_actor_id uuid,p_settle_days integer,
  p_validity_days integer,p_watch jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE h public."Home"%ROWTYPE; o public."HomeOccupancy"%ROWTYPE; v_context jsonb;
  v_role public.home_role_base; v_now timestamptz; v_permission public.home_permission;
BEGIN
  IF p_home_id IS NULL OR p_actor_id IS NULL OR p_settle_days IS NULL OR p_settle_days NOT BETWEEN 1 AND 90
    OR p_validity_days IS NULL OR p_validity_days NOT BETWEEN 1 AND 3650 OR jsonb_typeof(p_watch) IS DISTINCT FROM 'object' THEN
    RETURN jsonb_build_object('ok',false,'code','HOME_CLAIM_INVALID','status',400); END IF;
  -- The same audience as featureFlagService.isFeatureEnabled: everyone, admin/staff accounts, or listed accounts.
  IF NOT EXISTS(SELECT FROM public."FeatureFlag" f WHERE f.flag_name='home_instant_claim'
      AND (f.enabled_globally OR p_actor_id=ANY(coalesce(f.beta_user_ids,'{}'::uuid[]))
        OR (f.enabled_for_internal_team AND EXISTS(SELECT FROM public."User" u WHERE u.id=p_actor_id
          AND lower(coalesce(u.role::text,'')) IN ('admin','staff'))))) THEN
    RETURN jsonb_build_object('ok',false,'code','HOME_CLAIM_OFF','status',404); END IF;
  -- The private-setup lock order: Home, role defaults, people, ownership, claims, evidence, history, secrets.
  IF NOT public.lock_home_secret_scope(p_home_id) THEN
    RETURN jsonb_build_object('ok',false,'code','HOME_NOT_FOUND','status',404); END IF;
  SELECT * INTO h FROM public."Home" WHERE id=p_home_id;
  SELECT * INTO o FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_actor_id;
  IF o.id IS NOT NULL AND o.verification_status='verified' AND o.verification_source='claim'
    AND h.created_by_user_id=p_actor_id THEN
    RETURN jsonb_build_object('ok',true,'replayed',true,'home_id',p_home_id,'occupancy_id',o.id); END IF;
  IF h.home_status IS DISTINCT FROM 'active' OR h.security_state IS DISTINCT FROM 'normal' THEN
    RETURN jsonb_build_object('ok',false,'code','HOME_CLAIM_UNAVAILABLE','status',409); END IF;
  v_context:=public.home_secret_context(p_home_id,p_actor_id);
  IF v_context->>'allowed' IS DISTINCT FROM 'true' OR v_context->>'private' IS DISTINCT FROM 'true' THEN
    RETURN jsonb_build_object('ok',false,'code','HOME_CLAIM_UNAVAILABLE','status',409); END IF;
  -- home_secret_context admits only the creator's own current, adult (or unknown-age) pending occupancy.
  v_role:=CASE coalesce(o.role_base::text,o.role)
    WHEN 'restricted_member' THEN 'member' WHEN 'member' THEN 'member' WHEN 'lease_resident' THEN 'lease_resident'
    ELSE NULL END::public.home_role_base;
  IF v_role IS NULL OR (o.role_base='restricted_member' AND NOT EXISTS(SELECT FROM public."HomeOwner"
      WHERE home_id=p_home_id AND subject_type='user' AND subject_id=p_actor_id AND owner_status='pending')) THEN
    RETURN jsonb_build_object('ok',false,'code','HOME_CLAIM_ROLE_UNSUPPORTED','status',409); END IF;
  v_now:=clock_timestamp();
  FOREACH v_permission IN ARRAY ARRAY['home.view','home.edit','members.view','members.manage','access.view_wifi',
    'access.view_codes','access.manage','docs.view','docs.upload','docs.manage','calendar.view','calendar.edit',
    'calendar.manage','tasks.view','tasks.edit','tasks.manage','maintenance.view','maintenance.edit','maintenance.manage',
    'assets.view','assets.manage','devices.view','devices.manage','vendors.view','vendors.manage','packages.view',
    'packages.edit','packages.manage','finance.view','finance.manage','sensitive.view']::public.home_permission[] LOOP
    -- A deny the person set for themselves stays.
    INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed,created_by)
      VALUES(p_home_id,p_actor_id,v_permission,true,p_actor_id) ON CONFLICT(home_id,user_id,permission) DO NOTHING;
  END LOOP;
  UPDATE public."HomeOccupancy" SET role=v_role::text,role_base=v_role,verification_status='verified',
    verification_source='claim',verified_at=v_now,verification_expires_at=v_now+make_interval(days=>p_validity_days),
    can_manage_home=true,can_manage_access=true,can_manage_finance=true,can_manage_tasks=true,can_view_sensitive=true,
    updated_at=v_now WHERE id=o.id RETURNING * INTO o;
  UPDATE public."Home" SET vacancy_at=NULL,updated_at=v_now WHERE id=p_home_id AND vacancy_at IS NOT NULL;
  INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
    VALUES(p_home_id,p_actor_id,'HOME_CLAIMED','HomeOccupancy',o.id,jsonb_build_object('role_base',v_role,
      'verification_source','claim','settles_at',v_now+make_interval(days=>p_settle_days),'address_watch',p_watch));
  RETURN jsonb_build_object('ok',true,'replayed',false,'home_id',p_home_id,'occupancy_id',o.id,
    'role_base',v_role,'settles_at',v_now+make_interval(days=>p_settle_days));
END $$;

-- Someone who proved the address says a person whose access is a claim lives here too ("Yes, they live here"), and
-- the claim's grants come back to them (home_claim_set_aside). The confirmation is a HomeAuditLog row on that
-- membership: it ends with the membership and counts only while its author still holds proof. The person stays a
-- claim, with no authority over anyone who proved the address. An owner or manager doesn't need this: they can remove
-- someone or change their permissions already, and only proof holders' confirmations count.
CREATE FUNCTION public.confirm_home_claim_member(p_home_id uuid,p_actor_id uuid,p_target_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE v_home public."Home"%ROWTYPE; v_target public."HomeOccupancy"%ROWTYPE; v_label text;
BEGIN
  IF p_home_id IS NULL OR p_actor_id IS NULL OR p_target_id IS NULL THEN
    RETURN jsonb_build_object('ok',false,'code','CLAIM_CONFIRM_INVALID','status',400); END IF;
  IF p_actor_id=p_target_id THEN
    RETURN jsonb_build_object('ok',false,'code','SELF_ADMISSION_FORBIDDEN','status',403); END IF;
  -- The member-authority lock order (Home, then people): a confirmation can't race a removal, a role change or a proof.
  SELECT * INTO v_home FROM public."Home" WHERE id=p_home_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','HOME_NOT_FOUND','status',404); END IF;
  PERFORM id FROM public."HomeOccupancy" WHERE home_id=p_home_id ORDER BY id FOR UPDATE;
  IF v_home.security_state IN ('frozen','frozen_silent') OR v_home.home_status IN ('merged','archived')
    OR NOT public.home_proof_holder(p_home_id,p_actor_id) THEN
    RETURN jsonb_build_object('ok',false,'code','CLAIM_CONFIRM_PROOF_REQUIRED','status',403); END IF;
  SELECT * INTO v_target FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_target_id;
  IF NOT FOUND OR v_target.is_active IS DISTINCT FROM true OR v_target.verification_status IS DISTINCT FROM 'verified'
    OR v_target.verification_source IS DISTINCT FROM 'claim' THEN
    RETURN jsonb_build_object('ok',false,'code','CLAIM_CONFIRM_NOT_CLAIM','status',409); END IF;
  v_label:=coalesce(v_home.name,v_home.address,'your home');
  IF NOT public.home_claim_set_aside(p_home_id,p_target_id) THEN
    RETURN jsonb_build_object('ok',true,'replayed',true,'target_id',p_target_id,'home_label',v_label); END IF;
  INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
    VALUES(p_home_id,p_actor_id,'HOME_CLAIM_CONFIRMED','HomeOccupancy',v_target.id,jsonb_build_object('user_id',p_target_id));
  RETURN jsonb_build_object('ok',true,'replayed',false,'target_id',p_target_id,'home_label',v_label);
END $$;

CREATE OR REPLACE FUNCTION public.home_residency_review_authority(p_home_id uuid,p_actor_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE h public."Home"%ROWTYPE; a jsonb; t timestamptz:=clock_timestamp();
BEGIN
  SELECT * INTO h FROM public."Home" WHERE id=p_home_id;
  IF NOT FOUND OR p_actor_id IS NULL THEN RETURN false; END IF;
  a:=public.home_effective_access(p_home_id,p_actor_id);
  RETURN coalesce(
    h.security_state NOT IN ('frozen','frozen_silent','disputed')
    AND h.home_status NOT IN ('merged','archived')
    AND (a->'permissions') ? 'members.manage'
    -- A claim is not proof: someone whose access is only their own claim (or an invitation from one) never
    -- decides on, or challenges, a newcomer who may be the real resident. Owners keep this right.
    AND NOT (a->>'is_owner' IS DISTINCT FROM 'true' AND EXISTS (SELECT FROM public."HomeOccupancy"
      WHERE home_id=p_home_id AND user_id=p_actor_id AND verification_source='claim'))
    AND NOT EXISTS (SELECT FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_actor_id
      AND (start_at>t OR end_at<=t OR access_start_at>t OR access_end_at<=t))
    AND NOT (a->>'is_owner'='true'
      AND EXISTS (SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user'
        AND subject_id=p_actor_id AND owner_status IN ('revoked','disputed'))
      AND NOT EXISTS (SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user'
        AND subject_id=p_actor_id AND owner_status='verified')),false);
END;
$$;

CREATE OR REPLACE FUNCTION public.home_postcard_current_context(p_home_id uuid,p_actor_id uuid,p_confirmation boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  h public."Home"%ROWTYPE; o public."HomeOccupancy"%ROWTYPE;
  r public."HomeResidencyClaim"%ROWTYPE; u public."User"%ROWTYPE;
  t timestamptz:=clock_timestamp(); v_role text; v_age public.home_age_band;
  v_authorities boolean;
BEGIN
  IF p_home_id IS NULL OR p_actor_id IS NULL OR p_confirmation IS NULL THEN
    RETURN jsonb_build_object('ok',false,'code','POSTCARD_REQUEST_INVALID','status',400); END IF;
  SELECT * INTO h FROM public."Home" WHERE id=p_home_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','HOME_NOT_FOUND','status',404); END IF;
  SELECT * INTO u FROM public."User" WHERE id=p_actor_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','POSTCARD_ACCOUNT_UNAVAILABLE','status',403); END IF;
  IF h.security_state IN ('frozen','frozen_silent','disputed') OR h.home_status IN ('archived','merged') THEN
    RETURN jsonb_build_object('ok',false,'code','POSTCARD_HOME_UNAVAILABLE','status',403); END IF;
  SELECT * INTO o FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_actor_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','POSTCARD_RESIDENCY_REQUEST_REQUIRED','status',409); END IF;
  SELECT * INTO r FROM public."HomeResidencyClaim" WHERE home_id=p_home_id AND user_id=p_actor_id;
  v_role:=coalesce(o.role_base::text,CASE o.role
    WHEN 'tenant' THEN 'lease_resident' WHEN 'renter' THEN 'lease_resident'
    WHEN 'roommate' THEN 'member' WHEN 'family' THEN 'member' WHEN 'member' THEN 'member'
    WHEN 'caregiver' THEN 'restricted_member' ELSE o.role END);
  -- A pending ownership claim no longer blocks address proof (founder decision,
  -- 2026-10-06): the claimant can verify they live here while the claim waits.
  -- Verified, disputed and revoked ownership still uses the ownership flow.
  IF h.owner_id=p_actor_id OR v_role IN ('owner','admin','manager','property_manager')
    OR EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user' AND subject_id=p_actor_id
      AND owner_status IS DISTINCT FROM 'pending') THEN
    RETURN jsonb_build_object('ok',false,'code','OWNERSHIP_FLOW_REQUIRED','status',409); END IF;
  IF v_role IS NULL OR v_role NOT IN ('member','lease_resident','restricted_member')
    OR o.is_active IS DISTINCT FROM true OR o.end_at IS NOT NULL
    OR o.start_at>t OR o.access_start_at>t OR o.access_end_at<=t
    OR o.verification_status IS NULL OR o.verification_status NOT IN
      ('verified','unverified','pending','pending_approval','pending_doc','pending_postcard','provisional_bootstrap','provisional')
    OR r.status='rejected' THEN
    RETURN jsonb_build_object('ok',false,'code','POSTCARD_ACCESS_REVIEW_REQUIRED','status',409); END IF;
  -- Household consent (an accepted invitation or a household-reviewed claim)
  -- is not address proof (F3b), so it must not block the postcard that adds it.
  -- Neither is an instant claim at an address with no household ('claim').
  IF NOT p_confirmation AND o.verification_source NOT IN ('household','claim')
    AND (o.verification_status IN ('verified','provisional') OR r.status='verified') THEN
    RETURN jsonb_build_object('ok',false,'code','POSTCARD_REVIEW_ALREADY_RECORDED','status',409); END IF;
  IF o.verification_status NOT IN ('verified','provisional') AND
    (o.verified_at IS NOT NULL OR o.verification_expires_at IS NOT NULL OR r.status='verified') THEN
    RETURN jsonb_build_object('ok',false,'code','POSTCARD_ACCESS_REVIEW_REQUIRED','status',409); END IF;
  -- Preserve a stricter saved band and tighten it for a currently known minor.
  -- Physical-address proof cannot loosen an existing age restriction.
  v_age:=o.age_band;
  IF u.date_of_birth>(t AT TIME ZONE 'UTC')::date-interval '13 years' THEN v_age:='child';
  ELSIF u.date_of_birth>(t AT TIME ZONE 'UTC')::date-interval '18 years' AND v_age IS DISTINCT FROM 'child' THEN v_age:='teen'; END IF;
  SELECT EXISTS(SELECT FROM (
    SELECT user_id AS candidate FROM public."HomeOccupancy" WHERE home_id=p_home_id
    UNION SELECT subject_id FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user'
    UNION SELECT h.owner_id
  ) candidates WHERE candidate IS NOT NULL AND candidate<>p_actor_id
    AND public.home_residency_review_authority(p_home_id,candidate)) INTO v_authorities;
  RETURN jsonb_build_object('ok',true,'age_band',v_age,'has_authorities',v_authorities,
    'already_verified',o.verification_status='verified','occupancy_id',o.id,'claim_id',r.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.home_invite_target_policy(p_home_id uuid,p_inviter_id uuid,p_target_id uuid,
  p_policy jsonb,p_start_at timestamptz,p_end_at timestamptz) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor jsonb; v_target public."HomeOccupancy"%ROWTYPE; v_has_target boolean; v_ended boolean;
  v_role public.home_role_base; v_old_role public.home_role_base; v_age public.home_age_band;
  v_permissions text[]; v_actor_permissions text[]; v_now timestamptz:=clock_timestamp();
  v_start timestamptz; v_end timestamptz;
BEGIN
  v_actor:=public.home_invite_authority(p_home_id,p_inviter_id);
  IF v_actor IS NULL THEN RETURN jsonb_build_object('ok',false,'code','MEMBERS_MANAGE_REQUIRED','status',403); END IF;
  IF p_target_id=p_inviter_id THEN RETURN jsonb_build_object('ok',false,'code','SELF_ADMISSION_FORBIDDEN','status',403); END IF;
  IF p_policy IS NULL THEN RETURN jsonb_build_object('ok',false,'code','INVITE_POLICY_INVALID','status',400); END IF;
  v_role:=(p_policy->>'role_base')::public.home_role_base;
  SELECT * INTO v_target FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_target_id;
  v_has_target:=FOUND;
  -- A membership that ended (the person left or was removed) is history, not current access. Only the
  -- household's fresh invitation (or an approved request to join, which becomes one) admits them again,
  -- and only on the new invitation's terms: its role and dates, household verification, and none of the
  -- old row's dates, permissions or address proof. Self-service paths (Add Home, postcard, claims) still
  -- refuse an ended row with MEMBERSHIP_RENEWAL_REQUIRED.
  v_ended:=v_has_target AND v_target.is_active IS DISTINCT FROM true;
  v_old_role:=coalesce(v_target.role_base,public.home_invite_role(v_target.role));
  IF EXISTS(SELECT FROM public."Home" WHERE id=p_home_id AND owner_id=p_target_id)
    OR v_old_role='owner' OR EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=p_home_id
      AND subject_type='user' AND subject_id=p_target_id) THEN
    RETURN jsonb_build_object('ok',false,'code','OWNERSHIP_FLOW_REQUIRED','status',409); END IF;
  v_age:=CASE WHEN v_target.age_band='child' OR p_policy->>'age_ceiling'='child'
    THEN 'child'::public.home_age_band ELSE v_target.age_band END;
  v_start:=CASE WHEN v_ended THEN p_start_at ELSE greatest(v_target.start_at,v_target.access_start_at,p_start_at) END;
  v_end:=CASE WHEN v_ended THEN p_end_at ELSE least(v_target.end_at,v_target.access_end_at,p_end_at) END;
  IF v_end<=v_now OR v_start>=v_end OR (v_has_target AND NOT v_ended AND (
    v_old_role IS NULL
    OR v_target.verification_status IS NULL OR v_target.verification_status NOT IN
      ('verified','unverified','pending','pending_doc','pending_postcard','pending_approval','provisional_bootstrap')
    OR (v_target.verification_status<>'verified' AND v_target.verified_at IS NOT NULL))) THEN
    RETURN jsonb_build_object('ok',false,'code','MEMBERSHIP_RENEWAL_REQUIRED','status',409); END IF;
  IF v_has_target AND NOT v_ended AND v_target.verification_status='verified' THEN
    RETURN jsonb_build_object('ok',true,'existing_verified',true,'occupancy',to_jsonb(v_target)); END IF;
  IF v_role='owner' OR (v_actor->>'is_owner'<>'true' AND (
    public.home_role_rank(v_role)>=public.home_member_rank_ceiling(p_home_id,p_inviter_id,(v_actor->>'effective_role_base')::public.home_role_base,NULL)
    OR (v_has_target AND NOT v_ended AND public.home_role_rank(v_old_role)>=public.home_member_rank_ceiling(p_home_id,p_inviter_id,(v_actor->>'effective_role_base')::public.home_role_base,NULL))))
    OR (v_age='child' AND public.home_role_rank(v_role)>20)
    OR (v_age='teen' AND public.home_role_rank(v_role)>30) THEN
    RETURN jsonb_build_object('ok',false,'code','PROPOSED_ROLE_FORBIDDEN','status',403); END IF;
  v_permissions:=public.home_member_policy_permissions(p_home_id,p_target_id,v_role,v_age,p_policy->>'preset_key');
  SELECT ARRAY(SELECT jsonb_array_elements_text(v_actor->'permissions')) INTO v_actor_permissions;
  IF EXISTS(SELECT FROM unnest(v_permissions) p WHERE NOT p=ANY(v_actor_permissions))
    OR EXISTS(SELECT FROM jsonb_array_elements_text(p_policy->'grant_perms') p
      WHERE NOT p=ANY(v_actor_permissions) OR NOT public.home_authority_age_allows(v_age,p::public.home_permission)) THEN
    RETURN jsonb_build_object('ok',false,'code','PERMISSION_DELEGATION_FORBIDDEN','status',403); END IF;
  RETURN jsonb_build_object('ok',true,'existing_verified',false,'renewal',v_ended,'role_base',v_role,'age_band',v_age,
    'access_start_at',CASE WHEN v_ended THEN p_start_at ELSE greatest(v_target.access_start_at,p_start_at) END,
    'access_end_at',CASE WHEN v_ended THEN p_end_at ELSE least(v_target.access_end_at,p_end_at) END,'permissions',v_permissions);
END $$;

CREATE OR REPLACE FUNCTION public.act_on_home_invitation(p_invite_id uuid,p_token text,p_actor_id uuid,
  p_action text,p_validity_days integer DEFAULT 365) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE v_invite public."HomeInvite"%ROWTYPE; v_home public."Home"%ROWTYPE;
  v_occupancy public."HomeOccupancy"%ROWTYPE; v_inviter public."User"%ROWTYPE;
  v_policy jsonb; v_target_policy jsonb; v_permissions jsonb; v_hash text; v_count integer;
  v_now timestamptz; v_recipient boolean; v_open boolean; v_permission public.home_permission; v_source text;
BEGIN
  IF p_action IS NULL OR p_action NOT IN ('preview','accept','decline')
    OR (p_invite_id IS NULL)=(p_token IS NULL) OR (p_action<>'preview' AND p_actor_id IS NULL)
    OR p_validity_days IS NULL OR p_validity_days NOT BETWEEN 1 AND 3650 OR length(p_token)>512 THEN
    RETURN jsonb_build_object('ok',false,'code','INVITE_INVALID','status',400); END IF;
  IF p_token IS NOT NULL THEN v_hash:=encode(sha256(convert_to(p_token,'UTF8')),'hex'); END IF;
  SELECT count(*) INTO v_count FROM public."HomeInvite" WHERE
    (p_invite_id IS NOT NULL AND id=p_invite_id) OR (p_token IS NOT NULL AND
      (token_hash=v_hash OR (token_hash IS NULL AND token=p_token) OR id IN (SELECT invitation_id FROM public."HomeInvitationCapability" WHERE token_hash=v_hash)));
  IF v_count=0 THEN RETURN jsonb_build_object('ok',false,'code','INVITE_NOT_FOUND','status',404); END IF;
  IF v_count<>1 THEN RETURN jsonb_build_object('ok',false,'code','INVITE_UNAVAILABLE','status',503); END IF;
  SELECT * INTO v_invite FROM public."HomeInvite" WHERE
    (p_invite_id IS NOT NULL AND id=p_invite_id) OR (p_token IS NOT NULL AND
      (token_hash=v_hash OR (token_hash IS NULL AND token=p_token) OR id IN (SELECT invitation_id FROM public."HomeInvitationCapability" WHERE token_hash=v_hash)));
  IF NOT public.lock_home_invitation_scope(v_invite.home_id) THEN
    RETURN jsonb_build_object('ok',false,'code','INVITE_NOT_FOUND','status',404); END IF;
  -- Recheck the exact token after locking, including legacy hash-null fallback.
  SELECT * INTO v_invite FROM public."HomeInvite" WHERE id=v_invite.id AND
    (p_token IS NULL OR token_hash=v_hash OR (token_hash IS NULL AND token=p_token) OR id IN (SELECT invitation_id FROM public."HomeInvitationCapability" WHERE token_hash=v_hash));
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','INVITE_NOT_FOUND','status',404); END IF;
  SELECT * INTO v_home FROM public."Home" WHERE id=v_invite.home_id;
  -- Serialize confirmation/email changes with email-bound redemption. The
  -- application never substitutes a mutable public-profile email here.
  IF v_invite.invitee_user_id IS NULL AND v_invite.invitee_email IS NOT NULL AND p_actor_id IS NOT NULL THEN
    PERFORM id FROM auth.users WHERE id=p_actor_id FOR SHARE;
  END IF;
  v_now:=clock_timestamp();
  v_recipient:=public.home_invite_is_recipient(v_invite,p_actor_id);
  v_open:=v_invite.is_open_invite IS TRUE AND v_invite.invitee_user_id IS NULL AND v_invite.invitee_email IS NULL;
  IF p_action='decline' THEN
    IF NOT coalesce(v_recipient,false)
      AND public.home_invite_authority(v_invite.home_id,p_actor_id) IS NULL THEN
      -- Declining an open link is this viewer's decision, not authority to
      -- revoke the invitation for every other potential recipient.
      IF v_open AND p_token IS NOT NULL THEN RETURN jsonb_build_object('ok',true,'replayed',true); END IF;
      RETURN jsonb_build_object('ok',false,'code','INVITE_EMAIL_MISMATCH','status',403); END IF;
    IF v_invite.status='revoked' THEN RETURN jsonb_build_object('ok',true,'replayed',true); END IF;
    IF v_invite.status<>'pending' THEN RETURN jsonb_build_object('ok',false,'code','INVITE_ALREADY_USED','status',409); END IF;
    UPDATE public."HomeInvite" SET status='revoked' WHERE id=v_invite.id;
    INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
      VALUES(v_invite.home_id,p_actor_id,'HOME_INVITE_REVOKED','HomeInvite',v_invite.id,'{}');
    RETURN jsonb_build_object('ok',true,'replayed',false);
  END IF;
  IF p_action='accept' AND NOT coalesce(v_recipient,false) AND NOT (v_open AND p_token IS NOT NULL) THEN
    RETURN jsonb_build_object('ok',false,'code','INVITE_EMAIL_MISMATCH','status',403); END IF;
  IF p_action='preview' AND (v_invite.status<>'pending' OR v_invite.expires_at<=v_now) THEN
    RETURN jsonb_build_object('ok',true,'invitation',jsonb_build_object('id',v_invite.id,
      'status',CASE WHEN v_invite.status='pending' THEN 'expired' ELSE v_invite.status END),
      'expired',v_invite.status='expired' OR (v_invite.status='pending' AND v_invite.expires_at<=v_now),
      'alreadyUsed',v_invite.status='accepted'); END IF;
  IF p_action='accept' AND v_invite.status='accepted' THEN
    -- A committed admission is independent of its former inviter. An exact
    -- winner retry may return only their current occupancy, never reapply it.
    SELECT * INTO v_occupancy FROM public."HomeOccupancy" WHERE home_id=v_invite.home_id AND user_id=p_actor_id;
    IF v_invite.accepted_by_user_id=p_actor_id AND v_occupancy.is_active IS TRUE
      AND v_occupancy.verification_status='verified'
      AND coalesce(v_occupancy.role_base,public.home_invite_role(v_occupancy.role)) IS NOT NULL
      AND (v_occupancy.end_at IS NULL OR v_occupancy.end_at>v_now)
      AND (v_occupancy.access_end_at IS NULL OR v_occupancy.access_end_at>v_now) THEN
      RETURN jsonb_build_object('ok',true,'replayed',true,'homeId',v_invite.home_id,'occupancy',to_jsonb(v_occupancy)); END IF;
    RETURN jsonb_build_object('ok',false,'code','INVITE_ALREADY_USED','status',409);
  END IF;
  IF v_invite.status<>'pending' THEN RETURN jsonb_build_object('ok',false,'code','INVITE_ALREADY_USED','status',409); END IF;
  IF v_invite.expires_at<=v_now THEN RETURN jsonb_build_object('ok',false,'code','INVITE_EXPIRED','status',410); END IF;
  IF public.home_invite_authority(v_invite.home_id,v_invite.invited_by) IS NULL THEN
    RETURN jsonb_build_object('ok',false,'code','INVITER_ACCESS_CHANGED','status',403); END IF;
  IF p_action='preview' THEN
    SELECT * INTO v_inviter FROM public."User" WHERE id=v_invite.invited_by;
    RETURN jsonb_build_object('ok',true,'invitation',jsonb_build_object('id',v_invite.id,'status',v_invite.status,
      'proposed_role',v_invite.proposed_role,'invitee_email',v_invite.invitee_email,'invitee_user_id',v_invite.invitee_user_id,
      'created_at',v_invite.created_at,'expires_at',v_invite.expires_at,
      'access_start_at',v_invite.access_start_at,'access_end_at',v_invite.access_end_at),
      'home',jsonb_build_object('id',v_home.id,'name',coalesce(v_home.name,'A Home'),
        'city',concat_ws(', ',v_home.city,v_home.state),'home_type',v_home.home_type),
      'inviter',jsonb_build_object('name',coalesce(v_inviter.name,v_inviter.first_name,v_inviter.username,'Someone'),
        'username',v_inviter.username,'profilePicture',v_inviter.profile_picture_url));
  END IF;
  IF p_actor_id=v_invite.invited_by THEN
    RETURN jsonb_build_object('ok',false,'code','SELF_ADMISSION_FORBIDDEN','status',403); END IF;
  IF v_invite.proposed_preset_key LIKE 'claim_merge:%' THEN
    -- Dedicated ownership enrollment remains a distinct service. Never let a
    -- disabled feature flag fall through to ordinary owner-template creation.
    RETURN jsonb_build_object('ok',true,'kind','claim_merge','invitation',to_jsonb(v_invite)); END IF;
  IF v_invite.source_request_id IS NOT NULL AND NOT EXISTS(
    SELECT FROM public."HomeHouseholdAccessRequest" WHERE id=v_invite.source_request_id
      AND home_id=v_invite.home_id AND requester_user_id=p_actor_id AND status='approved'
      AND resolved_by=v_invite.invited_by
      AND CASE requested_identity WHEN 'resident' THEN 'lease_resident' WHEN 'guest' THEN 'guest'
        WHEN 'household_member' THEN 'member' ELSE 'owner' END=v_invite.proposed_role_base::text) THEN
    RETURN jsonb_build_object('ok',false,'code','INVITE_SOURCE_CHANGED','status',409); END IF;
  v_policy:=public.home_invite_policy(coalesce(v_invite.proposed_role_base::text,v_invite.proposed_role),
    CASE WHEN v_invite.proposed_preset_key LIKE 'access_request:%' THEN NULL ELSE v_invite.proposed_preset_key END);
  IF v_policy IS NULL OR (v_invite.admission_policy IS NOT NULL AND v_invite.admission_policy IS DISTINCT FROM v_policy) THEN
    RETURN jsonb_build_object('ok',false,'code','INVITE_POLICY_CHANGED','status',409); END IF;
  v_target_policy:=public.home_invite_target_policy(v_invite.home_id,v_invite.invited_by,p_actor_id,
    v_policy,v_invite.access_start_at,v_invite.access_end_at);
  IF v_target_policy->>'ok'<>'true' THEN RETURN v_target_policy; END IF;
  -- An invitation from someone whose own access is only a claim (no proof, not an owner) passes on that claim,
  -- not household trust: the new member is as unproven as the household that let them in.
  v_source:=CASE WHEN EXISTS(SELECT FROM public."HomeOccupancy" WHERE home_id=v_invite.home_id
      AND user_id=v_invite.invited_by AND verification_source='claim')
    AND public.home_invite_authority(v_invite.home_id,v_invite.invited_by)->>'is_owner' IS DISTINCT FROM 'true'
    THEN 'claim' ELSE 'household' END;
  IF v_target_policy->>'existing_verified'='true' THEN
    SELECT * INTO v_occupancy FROM public."HomeOccupancy" WHERE home_id=v_invite.home_id AND user_id=p_actor_id;
  ELSE
    SELECT * INTO v_occupancy FROM public."HomeOccupancy" WHERE home_id=v_invite.home_id AND user_id=p_actor_id;
    -- A link anyone can open is not the household inviting this person back. A membership that ended
    -- any other way than leaving (removed by the household, suspended) returns only through an
    -- invitation addressed to that person (account or email) or an approved request. Someone who left
    -- on their own may use the link, as they may also apply again by themselves.
    IF FOUND AND v_target_policy->>'renewal'='true' AND v_open
      AND v_occupancy.verification_status IS DISTINCT FROM 'moved_out' THEN
      RETURN jsonb_build_object('ok',false,'code','MEMBERSHIP_RENEWAL_REQUIRED','status',409); END IF;
    IF FOUND AND v_target_policy->>'renewal'='true' THEN
      -- Restore an ended membership as a new one (see home_invite_target_policy): nothing from the
      -- earlier membership comes back, including address verification and permission overrides.
      DELETE FROM public."HomePermissionOverride" WHERE home_id=v_invite.home_id AND user_id=p_actor_id;
      UPDATE public."HomeOccupancy" SET role=v_policy->>'role_base',role_base=(v_policy->>'role_base')::public.home_role_base,
        age_band=(v_target_policy->>'age_band')::public.home_age_band,is_active=true,start_at=now(),end_at=NULL,
        access_start_at=(v_target_policy->>'access_start_at')::timestamptz,
        access_end_at=(v_target_policy->>'access_end_at')::timestamptz,added_by_user_id=v_invite.invited_by,
        verification_status='verified',verification_source=v_source,verified_at=v_now,
        verification_expires_at=v_now+make_interval(days=>p_validity_days),
        challenge_window_started_at=NULL,challenge_window_ends_at=NULL,can_manage_home=false,can_manage_access=false,
        can_manage_finance=false,can_manage_tasks=false,can_view_sensitive=false,
        updated_at=v_now WHERE id=v_occupancy.id RETURNING * INTO v_occupancy;
    ELSIF FOUND THEN
      UPDATE public."HomeOccupancy" SET role=v_policy->>'role_base',role_base=(v_policy->>'role_base')::public.home_role_base,
        age_band=(v_target_policy->>'age_band')::public.home_age_band,
        access_start_at=(v_target_policy->>'access_start_at')::timestamptz,
        access_end_at=(v_target_policy->>'access_end_at')::timestamptz,
        verification_status='verified',verification_source=CASE WHEN verification_source='address' OR (verification_status='verified' AND verification_source='legacy') THEN verification_source ELSE v_source END,verified_at=v_now,verification_expires_at=v_now+make_interval(days=>p_validity_days),
        updated_at=v_now WHERE id=v_occupancy.id RETURNING * INTO v_occupancy;
    ELSE
      INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,is_active,start_at,
        access_start_at,access_end_at,added_by_user_id,verification_status,verification_source,verified_at,verification_expires_at,
        can_manage_home,can_manage_access,can_manage_finance,can_manage_tasks,can_view_sensitive)
        VALUES(v_invite.home_id,p_actor_id,v_policy->>'role_base',(v_policy->>'role_base')::public.home_role_base,
          (v_target_policy->>'age_band')::public.home_age_band,true,now(),
          (v_target_policy->>'access_start_at')::timestamptz,(v_target_policy->>'access_end_at')::timestamptz,
          v_invite.invited_by,'verified',v_source,v_now,v_now+make_interval(days=>p_validity_days),false,false,false,false,false)
        RETURNING * INTO v_occupancy;
    END IF;
    FOR v_permission IN SELECT jsonb_array_elements_text(v_policy->'grant_perms')::public.home_permission LOOP
      INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed,created_by)
        VALUES(v_invite.home_id,p_actor_id,v_permission,true,v_invite.invited_by)
        ON CONFLICT(home_id,user_id,permission) DO NOTHING;
    END LOOP;
    FOR v_permission IN SELECT jsonb_array_elements_text(v_policy->'deny_perms')::public.home_permission LOOP
      INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed,created_by)
        VALUES(v_invite.home_id,p_actor_id,v_permission,false,v_invite.invited_by)
        ON CONFLICT(home_id,user_id,permission) DO UPDATE SET allowed=false,created_by=v_invite.invited_by,updated_at=v_now;
    END LOOP;
    v_permissions:=CASE WHEN (v_occupancy.start_at IS NULL OR v_occupancy.start_at<=v_now)
      AND (v_occupancy.access_start_at IS NULL OR v_occupancy.access_start_at<=v_now)
      THEN v_target_policy->'permissions' ELSE '[]'::jsonb END;
    UPDATE public."HomeOccupancy" SET can_manage_home=v_permissions ? 'home.edit',
      can_manage_access=v_permissions ?| ARRAY['access.manage','members.manage'],
      can_manage_finance=v_permissions ? 'finance.manage',can_manage_tasks=v_permissions ?| ARRAY['tasks.edit','tasks.manage'],
      can_view_sensitive=v_permissions ? 'sensitive.view' WHERE id=v_occupancy.id RETURNING * INTO v_occupancy;
    UPDATE public."Home" SET vacancy_at=NULL,updated_at=v_now WHERE id=v_invite.home_id AND vacancy_at IS NOT NULL;
  END IF;
  UPDATE public."HomeInvite" SET status='accepted',accepted_by_user_id=p_actor_id,accepted_at=v_now WHERE id=v_invite.id;
  INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
    VALUES(v_invite.home_id,p_actor_id,'HOME_INVITE_ACCEPTED','HomeInvite',v_invite.id,
      jsonb_build_object('inviter_id',v_invite.invited_by,'occupancy_id',v_occupancy.id));
  RETURN jsonb_build_object('ok',true,'replayed',false,'homeId',v_invite.home_id,'occupancy',to_jsonb(v_occupancy),
    'inviter_id',v_invite.invited_by,'home_label',coalesce(v_home.name,'A home'));
END $$;

CREATE OR REPLACE FUNCTION public.home_member_removal_context(p_home_id uuid,p_actor_id uuid,p_target_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE v_home public."Home"%ROWTYPE; v_target public."HomeOccupancy"%ROWTYPE;
  v_actor jsonb; v_actor_role public.home_role_base; v_target_role public.home_role_base;
  v_self boolean; v_target_owner boolean; v_actor_perms text[]; v_now timestamptz;
  v_stale_pointer boolean; v_terminal boolean; v_ownership_cleanup boolean; v_profile jsonb;
  v_home_view jsonb; v_target_view jsonb; v_hash text;
BEGIN
  IF p_home_id IS NULL OR p_actor_id IS NULL OR p_target_id IS NULL THEN
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
  v_self := p_actor_id=p_target_id;
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
  -- Proof beats a claim: someone who proved the address may remove a person whose access is a claim without
  -- members.manage (up to lease_resident, home_member_rank_ceiling below).
  IF NOT v_self AND NOT ('members.manage'=ANY(v_actor_perms))
    AND NOT (public.home_proof_holder(p_home_id,p_actor_id) AND EXISTS(SELECT FROM public."HomeOccupancy"
      WHERE home_id=p_home_id AND user_id=p_target_id AND verification_source='claim')) THEN
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
  IF NOT v_self AND (v_actor_role IS DISTINCT FROM 'owner')
    AND (v_target_owner OR public.home_role_rank(v_target_role)
      >=public.home_member_rank_ceiling(p_home_id,p_actor_id,v_actor_role,v_target.verification_source)) THEN
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

CREATE OR REPLACE FUNCTION public.mutate_home_member(
  p_home_id uuid, p_actor_id uuid, p_target_id uuid, p_action text, p_payload jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
SET lock_timeout = '5s' AS $$
DECLARE
  v_home public."Home"%ROWTYPE; v_target public."HomeOccupancy"%ROWTYPE;
  v_actor jsonb; v_actor_role public.home_role_base; v_target_role public.home_role_base;
  v_new_role public.home_role_base; v_preset public."HomeRolePreset"%ROWTYPE;
  v_permission public.home_permission; v_allowed boolean; v_self boolean;
  v_target_owner boolean; v_before text[]; v_after text[]; v_actor_perms text[];
  v_access jsonb; v_now timestamptz := clock_timestamp(); v_grant public.home_permission;
  v_notify uuid[] := '{}'::uuid[];
BEGIN
  IF p_home_id IS NULL OR p_actor_id IS NULL OR p_target_id IS NULL
    OR p_action NOT IN ('role','override','remove') OR p_action IS NULL
    OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
    RETURN jsonb_build_object('ok',false,'code','INVALID_AUTHORITY_REQUEST','status',400);
  END IF;
  SELECT * INTO v_home FROM public."Home" WHERE id=p_home_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','HOME_NOT_FOUND','status',404); END IF;
  LOCK TABLE public."HomeRolePermission", public."HomeRolePreset" IN SHARE MODE;
  PERFORM id FROM public."HomeOccupancy" WHERE home_id=p_home_id ORDER BY id FOR UPDATE;
  PERFORM id FROM public."HomeOwner" WHERE home_id=p_home_id ORDER BY id FOR UPDATE;
  PERFORM user_id FROM public."HomePermissionOverride" WHERE home_id=p_home_id ORDER BY user_id,permission FOR UPDATE;
  -- now() remains the transaction start across lock waits. Authority must still
  -- be current when this mutation is admitted, including an expiring actor.
  v_now := clock_timestamp();
  v_self := p_actor_id=p_target_id;
  IF NOT (p_action='remove' AND v_self) AND (
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
  IF NOT (p_action='remove' AND v_self) AND v_actor->>'is_owner'='true'
    AND EXISTS (SELECT FROM public."HomeOwner" o WHERE o.home_id=p_home_id AND o.subject_type='user'
      AND o.subject_id=p_actor_id AND o.owner_status IN ('revoked','disputed'))
    AND NOT EXISTS (SELECT FROM public."HomeOwner" o WHERE o.home_id=p_home_id AND o.subject_type='user'
      AND o.subject_id=p_actor_id AND o.owner_status='verified') THEN
    RETURN jsonb_build_object('ok',false,'code','MEMBERS_MANAGE_REQUIRED','status',403);
  END IF;
  v_actor_role := (v_actor->>'effective_role_base')::public.home_role_base;
  SELECT ARRAY(SELECT jsonb_array_elements_text(v_actor->'permissions')) INTO v_actor_perms;
  IF NOT (p_action='remove' AND v_self) AND NOT ('members.manage'=ANY(v_actor_perms)) THEN
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
  IF v_target_role IS NULL AND NOT (p_action='remove' AND v_self) THEN
    RETURN jsonb_build_object('ok',false,'code','MEMBER_ROLE_UNKNOWN','status',409);
  END IF;
  v_target_owner := coalesce(v_home.owner_id=p_target_id,false) OR v_target_role='owner'
    OR EXISTS (SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user'
      AND subject_id=p_target_id AND owner_status='verified');
  IF NOT v_self AND (v_actor_role IS DISTINCT FROM 'owner')
    AND (v_target_owner OR public.home_role_rank(v_target_role)
      >=public.home_member_rank_ceiling(p_home_id,p_actor_id,v_actor_role,v_target.verification_source)) THEN
    RETURN jsonb_build_object('ok',false,'code','TARGET_RANK_FORBIDDEN','status',403);
  END IF;

  IF p_action='remove' THEN
    RETURN public.apply_home_member_removal(p_home_id,p_actor_id,p_target_id);
  ELSIF p_action='override' THEN
    IF (SELECT count(*) FROM jsonb_object_keys(p_payload))<>2
      OR NOT (p_payload ? 'permission' AND p_payload ? 'allowed')
      OR jsonb_typeof(p_payload->'allowed')<>'boolean' THEN
      RETURN jsonb_build_object('ok',false,'code','INVALID_AUTHORITY_REQUEST','status',400);
    END IF;
    BEGIN v_permission:=(p_payload->>'permission')::public.home_permission;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN jsonb_build_object('ok',false,'code','INVALID_PERMISSION','status',400);
    END;
    v_allowed := (p_payload->>'allowed')::boolean;
    IF v_permission IS NULL THEN RETURN jsonb_build_object('ok',false,'code','INVALID_PERMISSION','status',400); END IF;
    IF v_allowed AND (v_self OR NOT (v_permission::text=ANY(v_actor_perms))
      OR NOT public.home_authority_age_allows(v_target.age_band,v_permission)) THEN
      RETURN jsonb_build_object('ok',false,'code','PERMISSION_DELEGATION_FORBIDDEN','status',403);
    END IF;
    INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed,created_by)
      VALUES(p_home_id,p_target_id,v_permission,v_allowed,p_actor_id)
      ON CONFLICT(home_id,user_id,permission) DO UPDATE SET allowed=EXCLUDED.allowed,created_by=p_actor_id,updated_at=v_now;
  ELSE
    IF EXISTS (SELECT FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('role_base','preset_key','start_at','end_at'))
      OR ((p_payload->>'role_base') IS NULL)=((p_payload->>'preset_key') IS NULL) THEN
      RETURN jsonb_build_object('ok',false,'code','INVALID_AUTHORITY_REQUEST','status',400);
    END IF;
    -- A role change cannot renew expired access or erase the existing schedule.
    IF (p_payload ? 'start_at' AND (p_payload->>'start_at')::timestamptz IS DISTINCT FROM v_target.start_at)
      OR (p_payload ? 'end_at' AND (p_payload->>'end_at')::timestamptz IS DISTINCT FROM v_target.end_at) THEN
      RETURN jsonb_build_object('ok',false,'code','ACCESS_WINDOW_CHANGE_FORBIDDEN','status',403);
    END IF;
    IF p_payload->>'preset_key' IS NOT NULL THEN
      SELECT * INTO v_preset FROM public."HomeRolePreset" WHERE key=p_payload->>'preset_key';
      IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','UNKNOWN_PRESET','status',400); END IF;
      v_new_role:=v_preset.role_base;
    ELSE
      BEGIN v_new_role:=(p_payload->>'role_base')::public.home_role_base;
      EXCEPTION WHEN invalid_text_representation THEN
        RETURN jsonb_build_object('ok',false,'code','INVALID_ROLE','status',400);
      END;
    END IF;
    IF v_self OR v_target_owner OR v_new_role='owner' THEN
      RETURN jsonb_build_object('ok',false,'code','OWNERSHIP_OR_SELF_ROLE_CHANGE_FORBIDDEN','status',403);
    END IF;
    IF (v_actor_role<>'owner' AND public.home_role_rank(v_new_role)
      >=public.home_member_rank_ceiling(p_home_id,p_actor_id,v_actor_role,v_target.verification_source))
      OR (v_target.age_band='child' AND public.home_role_rank(v_new_role)>20)
      OR (v_target.age_band='teen' AND public.home_role_rank(v_new_role)>30) THEN
      RETURN jsonb_build_object('ok',false,'code','PROPOSED_ROLE_FORBIDDEN','status',403);
    END IF;
    v_before:=public.home_member_policy_permissions(p_home_id,p_target_id,v_target_role,v_target.age_band);
    v_after:=public.home_member_policy_permissions(p_home_id,p_target_id,v_new_role,v_target.age_band,v_preset.key);
    IF EXISTS (SELECT FROM unnest(v_after) permission
      WHERE NOT (permission=ANY(v_before)) AND NOT (permission=ANY(v_actor_perms)))
      OR EXISTS (SELECT FROM unnest(v_preset.grant_perms) permission
        WHERE NOT (permission::text=ANY(v_actor_perms)) OR NOT public.home_authority_age_allows(v_target.age_band,permission)) THEN
      RETURN jsonb_build_object('ok',false,'code','PERMISSION_DELEGATION_FORBIDDEN','status',403);
    END IF;
    UPDATE public."HomeOccupancy" SET role_base=v_new_role,role=v_new_role::text,updated_at=v_now WHERE id=v_target.id;
    -- Presets add their exact changes. Existing explicit denies are never erased.
    FOREACH v_grant IN ARRAY coalesce(v_preset.grant_perms,'{}'::public.home_permission[]) LOOP
      INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed,created_by)
        VALUES(p_home_id,p_target_id,v_grant,true,p_actor_id)
        ON CONFLICT(home_id,user_id,permission) DO NOTHING;
    END LOOP;
    FOREACH v_grant IN ARRAY coalesce(v_preset.deny_perms,'{}'::public.home_permission[]) LOOP
      INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed,created_by)
        VALUES(p_home_id,p_target_id,v_grant,false,p_actor_id)
        ON CONFLICT(home_id,user_id,permission) DO UPDATE SET allowed=false,created_by=p_actor_id,updated_at=v_now;
    END LOOP;
  END IF;
  IF p_action<>'remove' THEN
    v_access:=public.home_effective_access(p_home_id,p_target_id);
    UPDATE public."HomeOccupancy" SET
      can_manage_home=(v_access->'permissions') ? 'home.edit',
      can_manage_access=(v_access->'permissions') ?| ARRAY['access.manage','members.manage'],
      can_manage_finance=(v_access->'permissions') ? 'finance.manage',
      can_manage_tasks=(v_access->'permissions') ?| ARRAY['tasks.edit','tasks.manage'],
      can_view_sensitive=(v_access->'permissions') ? 'sensitive.view' WHERE id=v_target.id;
  END IF;
  INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
    VALUES(p_home_id,p_actor_id,'member_'||p_action,'HomeOccupancy',v_target.id,
      jsonb_build_object('user_id',p_target_id,'role_base',v_new_role,'preset_key',v_preset.key,'permission',v_permission,'allowed',v_allowed));
  RETURN jsonb_build_object('ok',true,'code','MEMBER_UPDATED','role_base',v_new_role,
    'preset_key',v_preset.key,'permission',v_permission,'allowed',v_allowed,
    'notify_user_ids',v_notify,'reconciled_stale_occupancy',p_action='remove' AND v_self AND NOT v_target.is_active);
END;
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
      OR EXISTS (SELECT FROM public."HomeTaskRecurrence" s WHERE s.home_id=p_home_id
        AND NOT (s.actor_user_id=p_actor_id AND s.private_setup))
      OR EXISTS (SELECT FROM public."HomeTaskRecurrenceCommand" s WHERE s.home_id=p_home_id
        AND NOT (s.actor_user_id=p_actor_id AND s.private_setup))
      OR EXISTS (SELECT FROM public."HomeTaskCreateReceipt" receipt WHERE receipt.home_id=p_home_id
        AND NOT (receipt.actor_user_id=p_actor_id AND receipt.private_setup))
      OR EXISTS (SELECT FROM public."HomeTaskAssignmentDelivery" d WHERE d.home_id=p_home_id)
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
            AND public.home_claim_evidence_own_setup(i,p_actor_id))
          AND NOT EXISTS(SELECT FROM public."HomeTaskMediaIntent" i WHERE i.id=f.id AND i.home_id=p_home_id
            AND f.metadata=jsonb_build_object('storage_contract','home_task_media_v1','upload_id',i.id)
            AND public.home_task_media_own_setup(i,p_actor_id)))))
      OR EXISTS (SELECT FROM public."HomeVerificationEvidence" e JOIN public."HomeOwnershipClaim" c ON c.id=e.claim_id
        JOIN public."File" f ON f.file_path=e.storage_ref WHERE c.home_id=p_home_id
          AND (f.user_id<>p_actor_id OR (f.home_id IS NOT NULL AND f.home_id<>p_home_id)))
      OR EXISTS (SELECT FROM public."Activity" WHERE home_id = p_home_id)
      -- An address-watch case about the creator's own claim (an instant claim held for review, home claims PR 3)
      -- is not another person's history: their private setup stays theirs while it waits.
      OR EXISTS (SELECT FROM public."AddressReviewCase" WHERE home_id = p_home_id
        AND NOT (trigger = 'address_watch' AND user_id = p_actor_id))
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
      OR EXISTS(SELECT FROM public."HomeTaskMediaIntent" i WHERE i.original_home_id=p_home_id
        AND NOT public.home_task_media_own_setup(i,p_actor_id))
      OR EXISTS (SELECT FROM public."HomeTaskMedia" m WHERE (home_id = p_home_id
        OR EXISTS(SELECT FROM public."HomeTask" t WHERE t.id=m.task_id AND t.home_id=p_home_id))
        AND NOT EXISTS(SELECT FROM public."HomeTaskMediaIntent" i WHERE i.id=m.private_upload_id AND i.id=m.id
          AND i.home_id=p_home_id AND i.task_id=m.task_id AND public.home_task_media_own_setup(i,p_actor_id)))
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

  -- Home claims PR 3: a proof always beats a claim. While someone who proved the address lives here and hasn't said
  -- this person lives here too (home_claim_set_aside), a claim keeps only its role's defaults (and its own denies), not
  -- the claim's grants. Someone who proved the address at a Home with a claim sees who lives there (members.view), so
  -- they can decide about it.
  IF NOT v_owner AND v_occ.verification_source = 'claim' AND public.home_claim_set_aside(p_home_id, p_user_id) THEN
    v_permissions := ARRAY(SELECT p FROM unnest(v_permissions) p WHERE EXISTS (SELECT FROM public."HomeRolePermission" r
      WHERE r.role_base = v_role AND r.permission::text = p AND r.allowed) ORDER BY p);
  ELSIF v_occ.verification_source IN ('address', 'legacy') AND NOT 'members.view' = ANY(v_permissions)
    AND public.home_proof_holder(p_home_id, p_user_id)
    AND EXISTS (SELECT FROM public."HomeOccupancy" WHERE home_id = p_home_id AND user_id <> p_user_id
      AND verification_source = 'claim')
    AND NOT EXISTS (SELECT FROM public."HomePermissionOverride" o WHERE o.home_id = p_home_id
      AND o.user_id = p_user_id AND o.permission = 'members.view' AND NOT o.allowed) THEN
    v_permissions := ARRAY(SELECT p FROM unnest(v_permissions || 'members.view'::text) p ORDER BY p);
  END IF;

  RETURN jsonb_build_object('role_base', v_role, 'effective_role_base', v_effective_role,
    'age_band', v_occ.age_band, 'has_access', true,
    'is_owner', v_owner AND NOT coalesce(v_minor, false), 'permissions', v_permissions);
END;
$$;

REVOKE ALL ON FUNCTION public.home_proof_holder(uuid,uuid),public.home_claim_set_aside(uuid,uuid),
  public.home_member_rank_ceiling(uuid,uuid,public.home_role_base,text),
  public.claim_home_private_setup(uuid,uuid,integer,integer,jsonb),
  public.confirm_home_claim_member(uuid,uuid,uuid),public.home_effective_access(uuid,uuid),
  public.home_residency_review_authority(uuid,uuid),
  public.home_postcard_current_context(uuid,uuid,boolean),
  public.home_invite_target_policy(uuid,uuid,uuid,jsonb,timestamptz,timestamptz),
  public.act_on_home_invitation(uuid,text,uuid,text,integer),
  public.home_member_removal_context(uuid,uuid,uuid),
  public.mutate_home_member(uuid,uuid,uuid,text,jsonb),
  public.home_secret_context(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.home_proof_holder(uuid,uuid),public.home_claim_set_aside(uuid,uuid),
  public.home_member_rank_ceiling(uuid,uuid,public.home_role_base,text),
  public.claim_home_private_setup(uuid,uuid,integer,integer,jsonb),
  public.confirm_home_claim_member(uuid,uuid,uuid),public.home_effective_access(uuid,uuid),
  public.home_residency_review_authority(uuid,uuid),
  public.home_postcard_current_context(uuid,uuid,boolean),
  public.home_invite_target_policy(uuid,uuid,uuid,jsonb,timestamptz,timestamptz),
  public.act_on_home_invitation(uuid,text,uuid,text,integer),
  public.home_member_removal_context(uuid,uuid,uuid),
  public.mutate_home_member(uuid,uuid,uuid,text,jsonb),
  public.home_secret_context(uuid,uuid) TO service_role;
