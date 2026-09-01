-- ============================================================================
-- WARNING: this file is a frozen snapshot. It is NOT the source of truth
-- and is NOT applied by any migration runner.
-- ============================================================================
-- The runnable migrations live under:
--   backend/database/migrations/   (numbered NNN_*.sql)
--   supabase/migrations/           (timestamped YYYYMMDD*_*.sql, byte-identical)
--
-- Phase 0 (audience-profile foundation) added migrations 132–135 but those
-- changes are NOT reflected here. To regenerate this snapshot from a
-- migrated database run:
--
--   pg_dump --schema-only --no-owner --no-privileges --no-publications \
--     --no-subscriptions "$DATABASE_URL" > backend/database/schema.sql
--
-- Until that's done, the following tables / columns are missing here but
-- ARE present in any migrated environment:
--   * PersonaMembership  (migration 132 — replaces PersonaFollow as the
--                          base table; PersonaFollow becomes a SQL view)
--   * LocalProfileDisplayNameMigrationP02
--                        (migration 133 — display-name migration audit
--                          snapshot)
--   * Notification.context  (migration 134 — personal | audience | platform)
--   * idx_notification_user_context
--   * FeatureFlag         (migration 135 — audience_profile rollout gate)
--
-- The migration smoke script
--   `pnpm --filter pantopus-backend run smoke:identity-firewall`
-- enumerates every required table / column and is the operational
-- source of truth for what the schema looks like in production.
-- ============================================================================



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."archive_reason" AS ENUM (
    'expired',
    'resolved',
    'manual',
    'moderation'
);


ALTER TYPE "public"."archive_reason" OWNER TO "postgres";


CREATE TYPE "public"."business_address_decision_status" AS ENUM (
    'ok',
    'need_suite',
    'multiple_matches',
    'cmra_detected',
    'po_box',
    'place_mismatch',
    'undeliverable',
    'low_confidence',
    'conflict',
    'mixed_use',
    'high_risk',
    'service_error'
);


ALTER TYPE "public"."business_address_decision_status" OWNER TO "postgres";


CREATE TYPE "public"."business_identity_verification_tier" AS ENUM (
    'bi0_unverified',
    'bi1_basic',
    'bi2_domain_social',
    'bi3_documented',
    'bi4_authority'
);


ALTER TYPE "public"."business_identity_verification_tier" OWNER TO "postgres";


CREATE TYPE "public"."business_location_type" AS ENUM (
    'storefront',
    'office',
    'warehouse',
    'home_based_private',
    'service_area_only',
    'mailing_only',
    'unknown'
);


ALTER TYPE "public"."business_location_type" OWNER TO "postgres";


CREATE TYPE "public"."business_location_verification_tier" AS ENUM (
    'bl0_none',
    'bl1_deliverable',
    'bl2_presence_light',
    'bl3_presence_strong',
    'bl4_managed'
);


ALTER TYPE "public"."business_location_verification_tier" OWNER TO "postgres";


CREATE TYPE "public"."business_permission" AS ENUM (
    'profile.view',
    'profile.edit',
    'locations.view',
    'locations.edit',
    'locations.manage',
    'hours.view',
    'hours.edit',
    'catalog.view',
    'catalog.edit',
    'catalog.manage',
    'pages.view',
    'pages.edit',
    'pages.publish',
    'pages.manage',
    'team.view',
    'team.invite',
    'team.manage',
    'reviews.view',
    'reviews.respond',
    'gigs.post',
    'gigs.manage',
    'mail.view',
    'mail.send',
    'ads.view',
    'ads.manage',
    'finance.view',
    'finance.manage',
    'insights.view',
    'sensitive.view'
);


ALTER TYPE "public"."business_permission" OWNER TO "postgres";


CREATE TYPE "public"."business_role_base" AS ENUM (
    'owner',
    'admin',
    'editor',
    'staff',
    'viewer'
);


ALTER TYPE "public"."business_role_base" OWNER TO "postgres";


CREATE TYPE "public"."claim_status" AS ENUM (
    'pending',
    'verified',
    'rejected'
);


ALTER TYPE "public"."claim_status" OWNER TO "postgres";


CREATE TYPE "public"."delegation_level" AS ENUM (
    'none',
    'request_only',
    'request_and_place'
);


ALTER TYPE "public"."delegation_level" OWNER TO "postgres";


CREATE TYPE "public"."home_age_band" AS ENUM (
    'child',
    'teen',
    'adult'
);


ALTER TYPE "public"."home_age_band" OWNER TO "postgres";


CREATE TYPE "public"."home_member_attach_policy" AS ENUM (
    'open_invite',
    'admin_approval',
    'verified_only'
);


ALTER TYPE "public"."home_member_attach_policy" OWNER TO "postgres";


CREATE TYPE "public"."home_owner_claim_policy" AS ENUM (
    'open',
    'review_required'
);


ALTER TYPE "public"."home_owner_claim_policy" OWNER TO "postgres";


CREATE TYPE "public"."home_permission" AS ENUM (
    'home.view',
    'home.edit',
    'members.view',
    'members.manage',
    'access.view_wifi',
    'access.view_codes',
    'access.manage',
    'docs.view',
    'docs.upload',
    'docs.manage',
    'calendar.view',
    'calendar.edit',
    'calendar.manage',
    'tasks.view',
    'tasks.edit',
    'tasks.manage',
    'maintenance.view',
    'maintenance.edit',
    'maintenance.manage',
    'assets.view',
    'assets.manage',
    'devices.view',
    'devices.manage',
    'vendors.view',
    'vendors.manage',
    'packages.view',
    'packages.edit',
    'packages.manage',
    'mailbox.view',
    'mailbox.manage',
    'finance.view',
    'finance.manage',
    'sensitive.view',
    'verification.manage',
    'ownership.view',
    'ownership.manage',
    'ownership.transfer',
    'security.manage',
    'dispute.view',
    'dispute.manage',
    'quorum.vote',
    'quorum.propose'
);


ALTER TYPE "public"."home_permission" OWNER TO "postgres";


CREATE TYPE "public"."home_privacy_mask_level" AS ENUM (
    'normal',
    'high',
    'invite_only_discovery'
);


ALTER TYPE "public"."home_privacy_mask_level" OWNER TO "postgres";


CREATE TYPE "public"."home_record_visibility" AS ENUM (
    'public',
    'members',
    'managers',
    'sensitive'
);


ALTER TYPE "public"."home_record_visibility" OWNER TO "postgres";


CREATE TYPE "public"."home_role_base" AS ENUM (
    'owner',
    'admin',
    'manager',
    'member',
    'restricted_member',
    'guest',
    'lease_resident',
    'service_provider'
);


ALTER TYPE "public"."home_role_base" OWNER TO "postgres";


CREATE TYPE "public"."home_security_state" AS ENUM (
    'normal',
    'claim_window',
    'review_required',
    'disputed',
    'frozen',
    'frozen_silent'
);


ALTER TYPE "public"."home_security_state" OWNER TO "postgres";


CREATE TYPE "public"."home_tenure_mode" AS ENUM (
    'unknown',
    'owner_occupied',
    'rental',
    'managed_property'
);


ALTER TYPE "public"."home_tenure_mode" OWNER TO "postgres";


CREATE TYPE "public"."listing_category" AS ENUM (
    'furniture',
    'electronics',
    'clothing',
    'kids_baby',
    'tools',
    'home_garden',
    'sports_outdoors',
    'vehicles',
    'books_media',
    'collectibles',
    'appliances',
    'free_stuff',
    'other'
);


ALTER TYPE "public"."listing_category" OWNER TO "postgres";


CREATE TYPE "public"."listing_condition" AS ENUM (
    'new',
    'like_new',
    'good',
    'fair',
    'for_parts'
);


ALTER TYPE "public"."listing_condition" OWNER TO "postgres";


CREATE TYPE "public"."listing_status" AS ENUM (
    'draft',
    'active',
    'pending_pickup',
    'sold',
    'archived'
);


ALTER TYPE "public"."listing_status" OWNER TO "postgres";


CREATE TYPE "public"."listing_layer" AS ENUM (
    'goods',
    'gigs',
    'rentals',
    'vehicles'
);


ALTER TYPE "public"."listing_layer" OWNER TO "postgres";


CREATE TYPE "public"."listing_type" AS ENUM (
    'sell_item',
    'free_item',
    'wanted_request',
    'rent_sublet',
    'vehicle_sale',
    'vehicle_rent',
    'service_gig'
);


ALTER TYPE "public"."listing_type" OWNER TO "postgres";


CREATE TYPE "public"."location_precision" AS ENUM (
    'exact_place',
    'approx_area',
    'neighborhood_only',
    'none'
);


ALTER TYPE "public"."location_precision" OWNER TO "postgres";


CREATE TYPE "public"."location_visibility_level" AS ENUM (
    'none',
    'city',
    'places',
    'active_gigs',
    'full'
);


ALTER TYPE "public"."location_visibility_level" OWNER TO "postgres";


CREATE TYPE "public"."mail_event_type" AS ENUM (
    'open',
    'heartbeat',
    'scroll',
    'link_click',
    'attachment_open',
    'close'
);


ALTER TYPE "public"."mail_event_type" OWNER TO "postgres";


CREATE TYPE "public"."mail_object_format" AS ENUM (
    'mailjson_v1',
    'html',
    'markdown',
    'plain_text',
    'pdf',
    'binary'
);


ALTER TYPE "public"."mail_object_format" OWNER TO "postgres";


CREATE TYPE "public"."mail_object_status" AS ENUM (
    'pending_upload',
    'ready',
    'failed',
    'deleted'
);


ALTER TYPE "public"."mail_object_status" OWNER TO "postgres";


CREATE TYPE "public"."muted_entity_type" AS ENUM (
    'user',
    'business'
);


ALTER TYPE "public"."muted_entity_type" OWNER TO "postgres";


CREATE TYPE "public"."owner_added_via" AS ENUM (
    'claim',
    'transfer',
    'escrow',
    'landlord_portal'
);


ALTER TYPE "public"."owner_added_via" OWNER TO "postgres";


CREATE TYPE "public"."owner_status_type" AS ENUM (
    'pending',
    'verified',
    'disputed',
    'revoked'
);


ALTER TYPE "public"."owner_status_type" OWNER TO "postgres";


CREATE TYPE "public"."owner_verification_tier" AS ENUM (
    'weak',
    'standard',
    'strong',
    'legal'
);


ALTER TYPE "public"."owner_verification_tier" OWNER TO "postgres";


CREATE TYPE "public"."ownership_claim_method" AS ENUM (
    'invite',
    'vouch',
    'doc_upload',
    'escrow_agent',
    'landlord_portal',
    'property_data_match'
);


ALTER TYPE "public"."ownership_claim_method" OWNER TO "postgres";


CREATE TYPE "public"."ownership_claim_state" AS ENUM (
    'draft',
    'submitted',
    'needs_more_info',
    'pending_review',
    'pending_challenge_window',
    'approved',
    'rejected',
    'disputed',
    'revoked'
);


ALTER TYPE "public"."ownership_claim_state" OWNER TO "postgres";


CREATE TYPE "public"."claim_challenge_state" AS ENUM (
    'none',
    'challenged',
    'resolved_upheld',
    'resolved_revoked'
);


ALTER TYPE "public"."claim_challenge_state" OWNER TO "postgres";


CREATE TYPE "public"."claim_phase_v2" AS ENUM (
    'initiated',
    'evidence_submitted',
    'under_review',
    'verified',
    'challenged',
    'withdrawn',
    'expired',
    'merged_into_household',
    'rejected'
);


ALTER TYPE "public"."claim_phase_v2" OWNER TO "postgres";


CREATE TYPE "public"."claim_routing_classification" AS ENUM (
    'standalone_claim',
    'parallel_claim',
    'challenge_claim',
    'merge_candidate'
);


ALTER TYPE "public"."claim_routing_classification" OWNER TO "postgres";


CREATE TYPE "public"."claim_strength" AS ENUM (
    'resident_low',
    'resident_standard',
    'owner_standard',
    'owner_strong',
    'owner_legal'
);


ALTER TYPE "public"."claim_strength" OWNER TO "postgres";


CREATE TYPE "public"."claim_terminal_reason" AS ENUM (
    'none',
    'withdrawn_by_user',
    'expired_no_evidence',
    'merged_via_invite',
    'rejected_review',
    'superseded_by_stronger_claim',
    'duplicate_redundant_claim',
    'revoked_after_challenge'
);


ALTER TYPE "public"."claim_terminal_reason" OWNER TO "postgres";


CREATE TYPE "public"."evidence_confidence_level" AS ENUM (
    'low',
    'medium',
    'high'
);


ALTER TYPE "public"."evidence_confidence_level" OWNER TO "postgres";


CREATE TYPE "public"."household_resolution_state" AS ENUM (
    'unclaimed',
    'pending_single_claim',
    'contested',
    'verified_household',
    'disputed'
);


ALTER TYPE "public"."household_resolution_state" OWNER TO "postgres";


CREATE TYPE "public"."identity_status" AS ENUM (
    'not_started',
    'pending',
    'verified',
    'failed'
);


ALTER TYPE "public"."identity_status" OWNER TO "postgres";


CREATE TYPE "public"."post_as_type" AS ENUM (
    'personal',
    'business',
    'home',
    'persona'
);


ALTER TYPE "public"."post_as_type" OWNER TO "postgres";


CREATE TYPE "public"."post_audience" AS ENUM (
    'connections',
    'followers',
    'network',
    'nearby',
    'saved_place',
    'household',
    'neighborhood',
    'target_area',
    'public',
    'national'
);


ALTER TYPE "public"."post_audience" OWNER TO "postgres";


CREATE TYPE "public"."post_format" AS ENUM (
    'standard',
    'quick_pulse',
    'deep_dive',
    'shout_out',
    'show_and_tell'
);


ALTER TYPE "public"."post_format" OWNER TO "postgres";


CREATE TYPE "public"."professional_category" AS ENUM (
    'handyman',
    'plumber',
    'electrician',
    'landscaping',
    'cleaning',
    'painting',
    'moving',
    'pet_care',
    'tutoring',
    'photography',
    'catering',
    'personal_training',
    'auto_repair',
    'carpentry',
    'roofing',
    'hvac',
    'pest_control',
    'appliance_repair',
    'interior_design',
    'event_planning',
    'music_lessons',
    'web_development',
    'graphic_design',
    'writing',
    'consulting',
    'childcare',
    'elder_care',
    'delivery',
    'errand_running',
    'other'
);


ALTER TYPE "public"."professional_category" OWNER TO "postgres";


CREATE TYPE "public"."quorum_action_state" AS ENUM (
    'proposed',
    'collecting_votes',
    'approved',
    'rejected',
    'expired'
);


ALTER TYPE "public"."quorum_action_state" OWNER TO "postgres";


CREATE TYPE "public"."relationship_status" AS ENUM (
    'pending',
    'accepted',
    'blocked'
);


ALTER TYPE "public"."relationship_status" OWNER TO "postgres";


CREATE TYPE "public"."reveal_policy" AS ENUM (
    'public',
    'after_interest',
    'after_assignment',
    'never_public'
);


ALTER TYPE "public"."reveal_policy" OWNER TO "postgres";


CREATE TYPE "public"."safety_alert_kind" AS ENUM (
    'traffic',
    'infra_outage',
    'weather_env',
    'crime_incident',
    'public_safety',
    'road_hazard',
    'power_outage',
    'weather_damage',
    'missing_pet',
    'official_notice'
);


ALTER TYPE "public"."safety_alert_kind" OWNER TO "postgres";


CREATE TYPE "public"."subject_type" AS ENUM (
    'user',
    'business',
    'trust'
);


ALTER TYPE "public"."subject_type" OWNER TO "postgres";


CREATE TYPE "public"."task_format" AS ENUM (
    'in_person',
    'drop_off',
    'remote',
    'hybrid'
);


ALTER TYPE "public"."task_format" OWNER TO "postgres";


CREATE TYPE "public"."user_place_kind" AS ENUM (
    'office',
    'frequent',
    'temporary',
    'vehicle',
    'rv',
    'other'
);


ALTER TYPE "public"."user_place_kind" OWNER TO "postgres";


CREATE TYPE "public"."verification_status" AS ENUM (
    'none',
    'pending',
    'verified',
    'rejected'
);


ALTER TYPE "public"."verification_status" OWNER TO "postgres";


CREATE TYPE "public"."viewing_location_type" AS ENUM (
    'gps',
    'home',
    'business',
    'searched',
    'recent'
);


ALTER TYPE "public"."viewing_location_type" OWNER TO "postgres";


CREATE TYPE "public"."visibility_scope" AS ENUM (
    'neighborhood',
    'city',
    'radius',
    'global'
);


ALTER TYPE "public"."visibility_scope" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_chat_participant"("p_room_id" "uuid", "p_user_id" "uuid", "p_role" character varying DEFAULT 'member'::character varying) RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  INSERT INTO "ChatParticipant" (room_id, user_id, role)
  VALUES (p_room_id, p_user_id, p_role)
  ON CONFLICT (room_id, user_id) 
  DO UPDATE SET 
    is_active = TRUE,
    left_at = NULL;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."add_chat_participant"("p_room_id" "uuid", "p_user_id" "uuid", "p_role" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_business_role_preset"("p_business_user_id" "uuid", "p_user_id" "uuid", "p_preset_key" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_role   public.business_role_base;
  v_grants public.business_permission[];
  v_denies public.business_permission[];
BEGIN
  IF NOT public.business_has_permission(
    p_business_user_id, 'team.manage'::public.business_permission, auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: requires team.manage';
  END IF;

  SELECT role_base, grant_perms, deny_perms
  INTO v_role, v_grants, v_denies
  FROM public."BusinessRolePreset"
  WHERE key = p_preset_key;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Unknown preset key: %', p_preset_key;
  END IF;

  -- Upsert team membership
  INSERT INTO public."BusinessTeam"(
    business_user_id, user_id, role_base, invited_by, is_active
  ) VALUES (
    p_business_user_id, p_user_id, v_role, auth.uid(), true
  )
  ON CONFLICT (business_user_id, user_id) DO UPDATE
    SET role_base = EXCLUDED.role_base,
        is_active = true,
        updated_at = now();

  -- Clear existing overrides
  DELETE FROM public."BusinessPermissionOverride"
  WHERE business_user_id = p_business_user_id AND user_id = p_user_id;

  -- Apply grants
  IF v_grants IS NOT NULL AND array_length(v_grants, 1) > 0 THEN
    INSERT INTO public."BusinessPermissionOverride"(
      business_user_id, user_id, permission, allowed, created_by
    )
    SELECT p_business_user_id, p_user_id, perm, true, auth.uid()
    FROM unnest(v_grants) AS perm
    ON CONFLICT (business_user_id, user_id, permission)
    DO UPDATE SET allowed = true, updated_at = now();
  END IF;

  -- Apply denies
  IF v_denies IS NOT NULL AND array_length(v_denies, 1) > 0 THEN
    INSERT INTO public."BusinessPermissionOverride"(
      business_user_id, user_id, permission, allowed, created_by
    )
    SELECT p_business_user_id, p_user_id, perm, false, auth.uid()
    FROM unnest(v_denies) AS perm
    ON CONFLICT (business_user_id, user_id, permission)
    DO UPDATE SET allowed = false, updated_at = now();
  END IF;

  -- Audit
  BEGIN
    INSERT INTO public."BusinessAuditLog"(
      business_user_id, actor_user_id, action, target_type, target_id, metadata
    ) VALUES (
      p_business_user_id, auth.uid(), 'apply_role_preset',
      'BusinessTeam', p_user_id,
      jsonb_build_object('preset_key', p_preset_key, 'role_base', v_role::text)
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END;
$$;


ALTER FUNCTION "public"."apply_business_role_preset"("p_business_user_id" "uuid", "p_user_id" "uuid", "p_preset_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_home_role_preset"("p_home_id" "uuid", "p_user_id" "uuid", "p_preset_key" "text", "p_start_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_end_at" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_role public.home_role_base;
  v_grants public.home_permission[];
  v_denies public.home_permission[];
begin
  -- Only home member-managers can apply presets
  if not public.home_has_permission(p_home_id, 'members.manage'::public.home_permission, auth.uid()) then
    raise exception 'Unauthorized: requires members.manage';
  end if;

  select role_base, grant_perms, deny_perms
  into v_role, v_grants, v_denies
  from public."HomeRolePreset"
  where key = p_preset_key;

  if v_role is null then
    raise exception 'Unknown preset key: %', p_preset_key;
  end if;

  -- Ensure HomeOccupancy row exists (upsert) and set role_base + dates
  insert into public."HomeOccupancy"(home_id, user_id, role, role_base, start_at, end_at, is_active, created_at, updated_at)
  values (p_home_id, p_user_id, v_role::text, v_role, p_start_at, p_end_at, true, now(), now())
  on conflict (home_id, user_id) do update
    set role_base = excluded.role_base,
        role = excluded.role,
        start_at = excluded.start_at,
        end_at = excluded.end_at,
        is_active = true,
        updated_at = now();

  -- Clear existing overrides for this user+home (so preset is deterministic)
  delete from public."HomePermissionOverride"
  where home_id = p_home_id and user_id = p_user_id;

  -- Apply grants
  if v_grants is not null then
    insert into public."HomePermissionOverride"(home_id, user_id, permission, allowed, created_by)
    select p_home_id, p_user_id, perm, true, auth.uid()
    from unnest(v_grants) as perm
    on conflict (home_id, user_id, permission) do update set allowed = excluded.allowed, updated_at = now();
  end if;

  -- Apply denies
  if v_denies is not null then
    insert into public."HomePermissionOverride"(home_id, user_id, permission, allowed, created_by)
    select p_home_id, p_user_id, perm, false, auth.uid()
    from unnest(v_denies) as perm
    on conflict (home_id, user_id, permission) do update set allowed = excluded.allowed, updated_at = now();
  end if;

  -- Audit (best-effort)
  begin
    insert into public."HomeAuditLog"(home_id, actor_user_id, action, target_type, target_id, metadata)
    values (
      p_home_id,
      auth.uid(),
      'apply_role_preset',
      'HomeOccupancy',
      p_user_id,
      jsonb_build_object('preset_key', p_preset_key, 'role_base', v_role::text)
    );
  exception when others then
    -- ignore if audit table missing or RLS blocks (shouldn't)
    null;
  end;
end $$;


ALTER FUNCTION "public"."apply_home_role_preset"("p_home_id" "uuid", "p_user_id" "uuid", "p_preset_key" "text", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_archive_expired_posts"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  archived_count integer := 0;
  ttl_row RECORD;
BEGIN
  -- Archive posts that exceeded their category TTL
  FOR ttl_row IN
    SELECT post_type, ttl_days FROM "public"."PostCategoryTTL" WHERE ttl_days > 0
  LOOP
    UPDATE "public"."Post"
    SET archived_at = now(),
        archive_reason = 'expired'
    WHERE post_type = ttl_row.post_type
      AND archived_at IS NULL
      AND created_at < (now() - (ttl_row.ttl_days || ' days')::interval);

    archived_count := archived_count + ROW_COUNT;
  END LOOP;

  -- Archive deals past their explicit expiration
  UPDATE "public"."Post"
  SET archived_at = now(),
      archive_reason = 'expired'
  WHERE post_type IN ('deal', 'deals_promos')
    AND archived_at IS NULL
    AND deal_expires_at IS NOT NULL
    AND deal_expires_at < now();

  archived_count := archived_count + ROW_COUNT;

  -- Archive events past their end date (with 24h grace period)
  UPDATE "public"."Post"
  SET archived_at = now(),
      archive_reason = 'expired'
  WHERE post_type = 'event'
    AND archived_at IS NULL
    AND event_end_date IS NOT NULL
    AND event_end_date < (now() - interval '24 hours');

  archived_count := archived_count + ROW_COUNT;

  -- Archive expired stories
  UPDATE "public"."Post"
  SET archived_at = now(),
      archive_reason = 'expired'
  WHERE is_story = true
    AND archived_at IS NULL
    AND story_expires_at IS NOT NULL
    AND story_expires_at < now();

  archived_count := archived_count + ROW_COUNT;

  RETURN archived_count;
END;
$$;


ALTER FUNCTION "public"."auto_archive_expired_posts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."batch_endorsement_counts"("p_business_user_ids" "uuid"[], "p_viewer_home_id" "uuid", "p_radius_meters" integer DEFAULT 8047) RETURNS TABLE("business_user_id" "uuid", "endorsement_count" bigint)
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_viewer_location  geography;
BEGIN
  -- Get viewer home location
  SELECT h.location INTO v_viewer_location
  FROM "Home" h
  WHERE h.id = p_viewer_home_id;

  IF v_viewer_location IS NULL THEN
    -- Return zero counts for all requested businesses
    RETURN QUERY
    SELECT unnest(p_business_user_ids), 0::BIGINT;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    e.business_user_id,
    COUNT(*)::BIGINT AS endorsement_count
  FROM "NeighborEndorsement" e
  JOIN "Home" endorser_home ON endorser_home.id = e.endorser_home_id
  WHERE e.business_user_id = ANY(p_business_user_ids)
    AND ST_DWithin(endorser_home.location, v_viewer_location, p_radius_meters)
    -- Verified occupancy gate
    AND EXISTS (
      SELECT 1 FROM "HomeOccupancy" ho
      WHERE ho.home_id = e.endorser_home_id
        AND ho.user_id = e.endorser_user_id
        AND ho.is_active = true
        AND ho.role_base NOT IN ('guest')
    )
    -- Minimum home age: 14 days
    AND endorser_home.created_at <= (now() - INTERVAL '14 days')
  GROUP BY e.business_user_id;
END;
$$;


ALTER FUNCTION "public"."batch_endorsement_counts"("p_business_user_ids" "uuid"[], "p_viewer_home_id" "uuid", "p_radius_meters" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."business_get_user_permissions"("p_business_user_id" "uuid", "p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_role   public.business_role_base;
  v_result jsonb DEFAULT '{}';
  v_perm   record;
BEGIN
  SELECT bt.role_base INTO v_role
  FROM public."BusinessTeam" bt
  WHERE bt.business_user_id = p_business_user_id
    AND bt.user_id = p_user_id
    AND bt.is_active = true;

  IF v_role IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  -- Owner: all permissions
  IF v_role = 'owner' THEN
    SELECT jsonb_object_agg(e.perm::text, true)
    INTO v_result
    FROM unnest(enum_range(NULL::public.business_permission)) AS e(perm);
    RETURN v_result;
  END IF;

  -- Build map: role defaults overlaid with per-user overrides
  FOR v_perm IN
    SELECT
      p.perm,
      COALESCE(
        bpo.allowed,
        brp.allowed,
        false
      ) AS allowed
    FROM unnest(enum_range(NULL::public.business_permission)) AS p(perm)
    LEFT JOIN public."BusinessRolePermission" brp
      ON brp.role_base = v_role AND brp.permission = p.perm
    LEFT JOIN public."BusinessPermissionOverride" bpo
      ON bpo.business_user_id = p_business_user_id
      AND bpo.user_id = p_user_id
      AND bpo.permission = p.perm
  LOOP
    v_result := v_result || jsonb_build_object(v_perm.perm::text, v_perm.allowed);
  END LOOP;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."business_get_user_permissions"("p_business_user_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."business_has_permission"("p_business_user_id" "uuid", "p_permission" "public"."business_permission", "p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_role     public.business_role_base;
  v_override boolean;
  v_base     boolean;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Get user's role in this business
  SELECT bt.role_base INTO v_role
  FROM public."BusinessTeam" bt
  WHERE bt.business_user_id = p_business_user_id
    AND bt.user_id = p_user_id
    AND bt.is_active = true
  LIMIT 1;

  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  -- Owner always has all permissions
  IF v_role = 'owner' THEN
    RETURN true;
  END IF;

  -- Check per-user override first
  SELECT bpo.allowed INTO v_override
  FROM public."BusinessPermissionOverride" bpo
  WHERE bpo.business_user_id = p_business_user_id
    AND bpo.user_id = p_user_id
    AND bpo.permission = p_permission
  LIMIT 1;

  IF v_override IS NOT NULL THEN
    RETURN v_override;
  END IF;

  -- Fall back to role default
  SELECT exists (
    SELECT 1
    FROM public."BusinessRolePermission" brp
    WHERE brp.role_base = v_role
      AND brp.permission = p_permission
      AND brp.allowed = true
  ) INTO v_base;

  RETURN COALESCE(v_base, false);
END;
$$;


ALTER FUNCTION "public"."business_has_permission"("p_business_user_id" "uuid", "p_permission" "public"."business_permission", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_platform_fee"("p_amount" integer, "p_fee_percentage" numeric DEFAULT 15.0) RETURNS integer
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Platform takes percentage (e.g., 15%)
  RETURN FLOOR(p_amount * p_fee_percentage / 100);
END;
$$;


ALTER FUNCTION "public"."calculate_platform_fee"("p_amount" integer, "p_fee_percentage" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_stripe_fee"("p_amount" integer, "p_country" character varying DEFAULT 'US'::character varying) RETURNS integer
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- US: 2.9% + 30 cents
  -- Adjust for other countries as needed
  RETURN FLOOR(p_amount * 0.029) + 30;
END;
$$;


ALTER FUNCTION "public"."calculate_stripe_fee"("p_amount" integer, "p_country" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_proxy_post"("actor" "uuid", "beneficiary" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    actor = beneficiary
    OR (
      -- Existing: friend-based delegation
      public.is_friends(actor, beneficiary)
      AND exists (
        SELECT 1
        FROM public."RelationshipPermission" rp
        WHERE rp.owner_id = beneficiary
          AND rp.viewer_id = actor
          AND rp.delegation IN ('request_only','request_and_place')
      )
    )
    OR (
      -- NEW: business team members with gigs.post permission
      exists (
        SELECT 1
        FROM public."User" u
        WHERE u.id = beneficiary
          AND u.account_type = 'business'
      )
      AND public.business_has_permission(
        beneficiary, 'gigs.post'::public.business_permission, actor
      )
    );
$$;


ALTER FUNCTION "public"."can_proxy_post"("actor" "uuid", "beneficiary" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_upload_file"("p_user_id" "uuid", "p_file_size" bigint) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_quota RECORD;
BEGIN
  -- Get user quota
  SELECT * INTO v_quota
  FROM "FileQuota"
  WHERE user_id = p_user_id;
  
  -- Create quota if doesn't exist
  IF NOT FOUND THEN
    INSERT INTO "FileQuota" (user_id)
    VALUES (p_user_id);
    
    SELECT * INTO v_quota
    FROM "FileQuota"
    WHERE user_id = p_user_id;
  END IF;
  
  -- Check storage limit
  IF v_quota.storage_used + p_file_size > v_quota.storage_limit THEN
    RETURN jsonb_build_object(
      'canUpload', false,
      'reason', 'storage_limit_exceeded',
      'storageUsed', v_quota.storage_used,
      'storageLimit', v_quota.storage_limit,
      'storageAvailable', v_quota.storage_limit - v_quota.storage_used
    );
  END IF;
  
  -- Check file count limit
  IF v_quota.file_count >= v_quota.max_files THEN
    RETURN jsonb_build_object(
      'canUpload', false,
      'reason', 'file_count_limit_exceeded',
      'fileCount', v_quota.file_count,
      'maxFiles', v_quota.max_files
    );
  END IF;
  
  -- Check daily upload limit (prevent abuse)
  IF v_quota.uploads_today >= 100 THEN
    RETURN jsonb_build_object(
      'canUpload', false,
      'reason', 'daily_upload_limit_exceeded',
      'uploadsToday', v_quota.uploads_today
    );
  END IF;
  
  -- All checks passed
  RETURN jsonb_build_object(
    'canUpload', true,
    'storageAvailable', v_quota.storage_limit - v_quota.storage_used
  );
END;
$$;


ALTER FUNCTION "public"."can_upload_file"("p_user_id" "uuid", "p_file_size" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_view_mail"("p_recipient_user_id" "uuid", "p_recipient_home_id" "uuid", "p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select (
    (p_recipient_user_id is not null and p_recipient_user_id = p_user_id)
    or
    (p_recipient_home_id is not null and public.home_has_permission(p_recipient_home_id, 'mailbox.view'::public.home_permission, p_user_id))
  );
$$;


ALTER FUNCTION "public"."can_view_mail"("p_recipient_user_id" "uuid", "p_recipient_home_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_typing"() RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  DELETE FROM "ChatTyping"
  WHERE expires_at < NOW();
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_typing"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_deleted_files"("days_old" integer DEFAULT 30) RETURNS TABLE("deleted_count" integer, "freed_space" bigint)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_deleted_count INT;
  v_freed_space BIGINT;
BEGIN
  -- Get stats before deletion
  SELECT COUNT(*), COALESCE(SUM(file_size), 0)
  INTO v_deleted_count, v_freed_space
  FROM "File"
  WHERE is_deleted = TRUE 
    AND deleted_at < NOW() - INTERVAL '1 day' * days_old;
  
  -- Delete old files
  DELETE FROM "File"
  WHERE is_deleted = TRUE 
    AND deleted_at < NOW() - INTERVAL '1 day' * days_old;
  
  RETURN QUERY SELECT v_deleted_count, v_freed_space;
END;
$$;


ALTER FUNCTION "public"."cleanup_old_deleted_files"("days_old" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."close_mail_read_session"("p_session_id" "uuid", "p_user_id" "uuid", "p_active_time_ms" integer DEFAULT 0, "p_max_scroll_percent" numeric DEFAULT NULL::numeric, "p_event_meta" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_session public."MailReadSession"%ROWTYPE;
  v_delta_ms integer;
BEGIN
  SELECT *
  INTO v_session
  FROM public."MailReadSession"
  WHERE id = p_session_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session not found');
  END IF;

  v_delta_ms := GREATEST(COALESCE(p_active_time_ms, 0), 0);

  UPDATE public."MailReadSession"
  SET active_time_ms = GREATEST(active_time_ms, v_delta_ms),
      max_scroll_percent = GREATEST(COALESCE(max_scroll_percent, 0), COALESCE(p_max_scroll_percent, 0)),
      session_last_seen_at = now(),
      session_ended_at = COALESCE(session_ended_at, now()),
      updated_at = now()
  WHERE id = v_session.id
  RETURNING * INTO v_session;

  UPDATE public."Mail"
  SET total_read_time_ms = total_read_time_ms + v_delta_ms,
      last_opened_at = now()
  WHERE id = v_session.mail_id;

  INSERT INTO public."MailEngagementEvent"(mail_id, user_id, session_id, event_type, dwell_ms, event_meta)
  VALUES (
    v_session.mail_id,
    p_user_id,
    v_session.id,
    'close',
    v_delta_ms,
    COALESCE(p_event_meta, '{}'::jsonb)
  );

  INSERT INTO public."MailAction"(mail_id, user_id, action_type, metadata)
  VALUES (
    v_session.mail_id,
    p_user_id,
    'closed',
    jsonb_build_object(
      'sessionId', v_session.id,
      'activeTimeMs', v_delta_ms,
      'maxScrollPercent', v_session.max_scroll_percent
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'mailId', v_session.mail_id,
    'sessionId', v_session.id,
    'activeTimeMs', v_delta_ms
  );
END;
$$;


ALTER FUNCTION "public"."close_mail_read_session"("p_session_id" "uuid", "p_user_id" "uuid", "p_active_time_ms" integer, "p_max_scroll_percent" numeric, "p_event_meta" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."compute_user_avg_rating"("p_user_id" "uuid") RETURNS numeric
    LANGUAGE "sql" STABLE
    AS $$
  SELECT COALESCE(ROUND(AVG(rating)::numeric, 2), 0)
  FROM "public"."Review"
  WHERE reviewee_id = p_user_id;
$$;


ALTER FUNCTION "public"."compute_user_avg_rating"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrement_comment_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  UPDATE "Post"
  SET comment_count = GREATEST(comment_count - 1, 0)
  WHERE id = OLD.post_id;
  
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."decrement_comment_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_mail_update_columns"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if current_user = 'service_role' or current_user = 'postgres' then
    return new;
  end if;

  -- Allowed changes for normal users: viewed, viewed_at, archived, starred
  if (new.viewed is distinct from old.viewed)
     or (new.viewed_at is distinct from old.viewed_at)
     or (new.archived is distinct from old.archived)
     or (new.starred is distinct from old.starred) then
    -- ensure all other fields are unchanged
    if (new.recipient_user_id is distinct from old.recipient_user_id)
       or (new.recipient_home_id is distinct from old.recipient_home_id)
       or (new.sender_user_id is distinct from old.sender_user_id)
       or (new.sender_business_name is distinct from old.sender_business_name)
       or (new.sender_address is distinct from old.sender_address)
       or (new.type is distinct from old.type)
       or (new.subject is distinct from old.subject)
       or (new.content is distinct from old.content)
       or (new.attachments is distinct from old.attachments)
       or (new.payout_amount is distinct from old.payout_amount)
       or (new.payout_status is distinct from old.payout_status)
       or (new.payout_at is distinct from old.payout_at)
       or (new.category is distinct from old.category)
       or (new.tags is distinct from old.tags)
       or (new.priority is distinct from old.priority)
       or (new.expires_at is distinct from old.expires_at)
       or (new.created_at is distinct from old.created_at) then
      raise exception 'Only viewed/viewed_at/archived/starred may be updated by recipients';
    end if;

    return new;
  end if;

  -- No other updates allowed
  raise exception 'No editable columns in Mail for non-service users';
end $$;


ALTER FUNCTION "public"."enforce_mail_update_columns"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_businesses_in_bounds"("p_south" double precision, "p_west" double precision, "p_north" double precision, "p_east" double precision, "p_categories" "text"[] DEFAULT NULL::"text"[], "p_open_now_only" boolean DEFAULT false, "p_limit" integer DEFAULT 500) RETURNS TABLE("business_user_id" "uuid", "username" character varying, "name" character varying, "profile_picture_url" "text", "latitude" double precision, "longitude" double precision, "categories" "text"[], "business_type" "text", "average_rating" numeric, "review_count" integer, "completed_gigs" bigint, "is_open_now" boolean, "is_new_business" boolean)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_bounds geography;
BEGIN
  -- Build bounding box envelope for spatial query
  v_bounds := ST_SetSRID(
    ST_MakeEnvelope(p_west, p_south, p_east, p_north),
    4326
  )::geography;

  RETURN QUERY
  SELECT
    u.id AS business_user_id,
    u.username,
    u.name,
    u.profile_picture_url,
    ST_Y(bl.location::geometry) AS latitude,
    ST_X(bl.location::geometry) AS longitude,
    bp.categories,
    bp.business_type,
    u.average_rating,
    u.review_count,

    -- Completed gigs count (for pin tier: 0=small, 1-9=medium, 10+=large)
    (SELECT COUNT(*) FROM "Gig" g WHERE g.accepted_by = u.id AND g.status = 'completed') AS completed_gigs,

    -- Open-now check (timezone-aware with special hours override)
    CASE WHEN bl.timezone IS NOT NULL THEN
      COALESCE(
        -- Special hours override for today
        (
          SELECT
            CASE WHEN bsh.is_closed THEN FALSE
              WHEN bsh.open_time IS NULL OR bsh.close_time IS NULL THEN TRUE
              WHEN bsh.close_time < bsh.open_time THEN
                (NOW() AT TIME ZONE bl.timezone)::TIME >= bsh.open_time
                OR (NOW() AT TIME ZONE bl.timezone)::TIME <= bsh.close_time
              ELSE
                (NOW() AT TIME ZONE bl.timezone)::TIME >= bsh.open_time
                AND (NOW() AT TIME ZONE bl.timezone)::TIME <= bsh.close_time
            END
          FROM "BusinessSpecialHours" bsh
          WHERE bsh.location_id = bl.id
            AND bsh.date = (NOW() AT TIME ZONE bl.timezone)::DATE
          LIMIT 1
        ),
        -- Regular hours for today
        (
          SELECT
            CASE WHEN bh.is_closed THEN FALSE
              WHEN bh.open_time IS NULL OR bh.close_time IS NULL THEN TRUE
              WHEN bh.close_time < bh.open_time THEN
                (NOW() AT TIME ZONE bl.timezone)::TIME >= bh.open_time
                OR (NOW() AT TIME ZONE bl.timezone)::TIME <= bh.close_time
              ELSE
                (NOW() AT TIME ZONE bl.timezone)::TIME >= bh.open_time
                AND (NOW() AT TIME ZONE bl.timezone)::TIME <= bh.close_time
            END
          FROM "BusinessHours" bh
          WHERE bh.location_id = bl.id
            AND bh.day_of_week = EXTRACT(DOW FROM NOW() AT TIME ZONE bl.timezone)::INT
          LIMIT 1
        ),
        NULL
      )
    ELSE NULL
    END AS is_open_now,

    -- New business flag (< 3 completed gigs AND profile < 30 days old)
    (
      (SELECT COUNT(*) FROM "Gig" g WHERE g.accepted_by = u.id AND g.status = 'completed') < 3
      AND bp.created_at > NOW() - INTERVAL '30 days'
    ) AS is_new_business

  FROM "User" u
  JOIN "BusinessProfile" bp ON bp.business_user_id = u.id
  JOIN "BusinessLocation" bl ON bl.business_user_id = u.id
    AND bl.is_primary = true
    AND bl.is_active = true
  WHERE u.account_type = 'business'
    AND bp.is_published = true
    AND bl.location IS NOT NULL
    -- Bounding box filter
    AND ST_Intersects(bl.location, v_bounds)
    -- Category filter (optional)
    AND (p_categories IS NULL OR bp.categories && p_categories)
    -- Open-now filter (optional, applied in WHERE for perf)
    AND (
      NOT p_open_now_only
      OR bl.timezone IS NULL
      OR COALESCE(
        (
          SELECT
            CASE WHEN bsh2.is_closed THEN FALSE
              WHEN bsh2.open_time IS NULL OR bsh2.close_time IS NULL THEN TRUE
              WHEN bsh2.close_time < bsh2.open_time THEN
                (NOW() AT TIME ZONE bl.timezone)::TIME >= bsh2.open_time
                OR (NOW() AT TIME ZONE bl.timezone)::TIME <= bsh2.close_time
              ELSE
                (NOW() AT TIME ZONE bl.timezone)::TIME >= bsh2.open_time
                AND (NOW() AT TIME ZONE bl.timezone)::TIME <= bsh2.close_time
            END
          FROM "BusinessSpecialHours" bsh2
          WHERE bsh2.location_id = bl.id
            AND bsh2.date = (NOW() AT TIME ZONE bl.timezone)::DATE
          LIMIT 1
        ),
        (
          SELECT
            CASE WHEN bh2.is_closed THEN FALSE
              WHEN bh2.open_time IS NULL OR bh2.close_time IS NULL THEN TRUE
              WHEN bh2.close_time < bh2.open_time THEN
                (NOW() AT TIME ZONE bl.timezone)::TIME >= bh2.open_time
                OR (NOW() AT TIME ZONE bl.timezone)::TIME <= bh2.close_time
              ELSE
                (NOW() AT TIME ZONE bl.timezone)::TIME >= bh2.open_time
                AND (NOW() AT TIME ZONE bl.timezone)::TIME <= bh2.close_time
            END
          FROM "BusinessHours" bh2
          WHERE bh2.location_id = bl.id
            AND bh2.day_of_week = EXTRACT(DOW FROM NOW() AT TIME ZONE bl.timezone)::INT
          LIMIT 1
        ),
        TRUE  -- If no hours data, treat as open (don't filter out)
      ) = TRUE
    )
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."find_businesses_in_bounds"("p_south" double precision, "p_west" double precision, "p_north" double precision, "p_east" double precision, "p_categories" "text"[], "p_open_now_only" boolean, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_businesses_nearby"("p_center_lat" double precision, "p_center_lon" double precision, "p_radius_meters" integer DEFAULT 8047, "p_viewer_home_id" "uuid" DEFAULT NULL::"uuid", "p_categories" "text"[] DEFAULT NULL::"text"[], "p_rating_min" numeric DEFAULT NULL::numeric, "p_limit" integer DEFAULT 200) RETURNS TABLE("business_user_id" "uuid", "username" character varying, "name" character varying, "profile_picture_url" "text", "average_rating" numeric, "review_count" integer, "categories" "text"[], "description" "text", "business_type" "text", "logo_file_id" "uuid", "banner_file_id" "uuid", "avg_response_minutes" integer, "profile_created_at" timestamp with time zone, "location_id" "uuid", "primary_address" "text", "primary_city" "text", "primary_state" "text", "location_timezone" "text", "distance_meters" integer, "neighbor_count" bigint, "completed_gigs" bigint, "profile_completeness" integer, "last_activity_at" timestamp with time zone, "is_open_now" boolean, "accepts_gigs" boolean)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_center geography;
  v_viewer_location geography;
BEGIN
  -- Build center point for distance calculation
  v_center := ST_SetSRID(ST_MakePoint(p_center_lon, p_center_lat), 4326)::geography;

  -- Resolve viewer home location for neighbor trust count
  IF p_viewer_home_id IS NOT NULL THEN
    SELECT h.location INTO v_viewer_location
    FROM "Home" h
    WHERE h.id = p_viewer_home_id;
  END IF;

  RETURN QUERY
  SELECT
    u.id AS business_user_id,
    u.username,
    u.name,
    u.profile_picture_url,
    u.average_rating,
    u.review_count,
    bp.categories,
    bp.description,
    bp.business_type,
    bp.logo_file_id,
    bp.banner_file_id,
    bp.avg_response_minutes,
    bp.created_at AS profile_created_at,
    bl.id AS location_id,
    bl.address AS primary_address,
    bl.city AS primary_city,
    bl.state AS primary_state,
    bl.timezone AS location_timezone,
    CAST(ST_Distance(bl.location, v_center) AS INT) AS distance_meters,

    -- Neighbor trust count (with gaming protections, without rate-limit for perf)
    CASE WHEN v_viewer_location IS NOT NULL THEN
      (
        SELECT COUNT(DISTINCT g.origin_home_id)
        FROM "Gig" g
        JOIN "Home" oh ON oh.id = g.origin_home_id
        JOIN "HomeOccupancy" ho ON ho.home_id = oh.id
          AND ho.is_active = true
          AND (ho.role_base IS NULL OR ho.role_base != 'guest')
        WHERE g.accepted_by = u.id
          AND g.status = 'completed'
          AND g.price >= 10
          AND g.payment_status IN ('captured_hold','transfer_scheduled','transfer_pending','transferred')
          AND g.origin_home_id IS NOT NULL
          AND oh.location IS NOT NULL
          AND ST_DWithin(oh.location, v_viewer_location, p_radius_meters)
          AND (
            EXISTS (SELECT 1 FROM "HomeOwnershipClaim" hoc WHERE hoc.home_id = oh.id AND hoc.state = 'approved')
            OR EXISTS (SELECT 1 FROM "HomeResidencyClaim" hrc WHERE hrc.home_id = oh.id AND hrc.status = 'verified')
          )
          AND NOT EXISTS (
            SELECT 1 FROM "Payment" p
            WHERE p.gig_id = g.id
              AND p.payment_status IN ('disputed','refunded','refunded_full','refunded_partial')
          )
      )
    ELSE 0
    END AS neighbor_count,

    -- Completed gigs (for new-business check)
    (SELECT COUNT(*) FROM "Gig" g WHERE g.accepted_by = u.id AND g.status = 'completed') AS completed_gigs,

    -- Profile completeness (0-100, each component = 20pts)
    (
      (CASE WHEN bp.logo_file_id IS NOT NULL THEN 20 ELSE 0 END)
      + (CASE WHEN bp.banner_file_id IS NOT NULL THEN 20 ELSE 0 END)
      + (CASE WHEN bp.description IS NOT NULL AND bp.description != '' THEN 20 ELSE 0 END)
      + (CASE WHEN EXISTS (SELECT 1 FROM "BusinessCatalogItem" ci WHERE ci.business_user_id = u.id AND ci.status = 'active') THEN 20 ELSE 0 END)
      + (CASE WHEN EXISTS (SELECT 1 FROM "BusinessHours" bh WHERE bh.location_id = bl.id) THEN 20 ELSE 0 END)
    ) AS profile_completeness,

    -- Last activity: most recent completed gig or post
    GREATEST(
      (SELECT MAX(g2.created_at) FROM "Gig" g2 WHERE g2.accepted_by = u.id AND g2.status = 'completed'),
      (SELECT MAX(po.created_at) FROM "Post" po WHERE po.user_id = u.id)
    ) AS last_activity_at,

    -- Open-now: checks special hours override, then regular hours, handles overnight
    CASE WHEN bl.timezone IS NOT NULL THEN
      COALESCE(
        -- Special hours for today (override)
        (
          SELECT
            CASE WHEN bsh.is_closed THEN FALSE
              WHEN bsh.open_time IS NULL OR bsh.close_time IS NULL THEN TRUE
              WHEN bsh.close_time < bsh.open_time THEN
                (NOW() AT TIME ZONE bl.timezone)::TIME >= bsh.open_time
                OR (NOW() AT TIME ZONE bl.timezone)::TIME <= bsh.close_time
              ELSE
                (NOW() AT TIME ZONE bl.timezone)::TIME >= bsh.open_time
                AND (NOW() AT TIME ZONE bl.timezone)::TIME <= bsh.close_time
            END
          FROM "BusinessSpecialHours" bsh
          WHERE bsh.location_id = bl.id
            AND bsh.date = (NOW() AT TIME ZONE bl.timezone)::DATE
          LIMIT 1
        ),
        -- Regular hours for today
        (
          SELECT
            CASE WHEN bh.is_closed THEN FALSE
              WHEN bh.open_time IS NULL OR bh.close_time IS NULL THEN TRUE
              WHEN bh.close_time < bh.open_time THEN
                (NOW() AT TIME ZONE bl.timezone)::TIME >= bh.open_time
                OR (NOW() AT TIME ZONE bl.timezone)::TIME <= bh.close_time
              ELSE
                (NOW() AT TIME ZONE bl.timezone)::TIME >= bh.open_time
                AND (NOW() AT TIME ZONE bl.timezone)::TIME <= bh.close_time
            END
          FROM "BusinessHours" bh
          WHERE bh.location_id = bl.id
            AND bh.day_of_week = EXTRACT(DOW FROM NOW() AT TIME ZONE bl.timezone)::INT
          LIMIT 1
        ),
        NULL  -- no hours data
      )
    ELSE NULL
    END AS is_open_now,

    -- Accepts gig requests: has active team member with gig-capable role
    EXISTS (
      SELECT 1 FROM "BusinessTeam" bt
      WHERE bt.business_user_id = u.id
        AND bt.is_active = true
        AND bt.role_base IN ('owner', 'admin', 'editor', 'staff')
    ) AS accepts_gigs

  FROM "User" u
  JOIN "BusinessProfile" bp ON bp.business_user_id = u.id
  JOIN "BusinessLocation" bl ON bl.business_user_id = u.id
    AND bl.is_primary = true
    AND bl.is_active = true
  WHERE u.account_type = 'business'
    AND bp.is_published = true
    AND bl.location IS NOT NULL
    AND ST_DWithin(bl.location, v_center, p_radius_meters)
    -- Category filter (array overlap)
    AND (p_categories IS NULL OR bp.categories && p_categories)
    -- Rating minimum filter
    AND (p_rating_min IS NULL OR COALESCE(u.average_rating, 0) >= p_rating_min)
  ORDER BY ST_Distance(bl.location, v_center) ASC
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."find_businesses_nearby"("p_center_lat" double precision, "p_center_lon" double precision, "p_radius_meters" integer, "p_viewer_home_id" "uuid", "p_categories" "text"[], "p_rating_min" numeric, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_gigs_by_category_nearby"("user_lat" double precision, "user_lon" double precision, "gig_category" character varying, "radius_meters" integer DEFAULT 10000) RETURNS TABLE("id" "uuid", "title" character varying, "description" "text", "price" numeric, "deadline" timestamp with time zone, "user_id" "uuid", "distance_meters" integer, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.id,
    g.title,
    g.description,
    g.price,
    g.deadline,
    g.user_id,
    CAST(
      ST_Distance(
        g.exact_location,
        ST_Point(user_lon, user_lat)::GEOGRAPHY
      ) AS INT
    ) as distance_meters,
    g.created_at
  FROM "Gig" g
  WHERE 
    g.status = 'open'
    AND g.category = gig_category
    AND g.exact_location IS NOT NULL
    AND ST_Distance(
      g.exact_location,
      ST_Point(user_lon, user_lat)::GEOGRAPHY
    ) <= radius_meters
  ORDER BY distance_meters ASC;
END;
$$;


ALTER FUNCTION "public"."find_gigs_by_category_nearby"("user_lat" double precision, "user_lon" double precision, "gig_category" character varying, "radius_meters" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_gigs_in_bounds"("min_lat" double precision, "min_lon" double precision, "max_lat" double precision, "max_lon" double precision, "gig_status" character varying DEFAULT 'open'::character varying) RETURNS TABLE("id" "uuid", "title" character varying, "description" "text", "price" numeric, "category" character varying, "user_id" "uuid", "status" character varying, "latitude" double precision, "longitude" double precision, "created_at" timestamp with time zone)
    LANGUAGE "sql" STABLE
    AS $$
  SELECT
    g.id,
    g.title,
    g.description,
    g.price,
    g.category,
    g.user_id,
    g.status,
    ST_Y(g.approx_location::geometry) AS latitude,
    ST_X(g.approx_location::geometry) AS longitude,
    g.created_at
  FROM "Gig" g
  WHERE
    g.status = gig_status
    AND g.approx_location IS NOT NULL
    AND ST_Intersects(
      g.approx_location::geometry,
      ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326)
    )
  ORDER BY g.created_at DESC;
$$;


ALTER FUNCTION "public"."find_gigs_in_bounds"("min_lat" double precision, "min_lon" double precision, "max_lat" double precision, "max_lon" double precision, "gig_status" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_gigs_nearby"("user_lat" double precision, "user_lon" double precision, "radius_meters" integer DEFAULT 5000, "gig_status" character varying DEFAULT 'open'::character varying) RETURNS TABLE("id" "uuid", "title" character varying, "description" "text", "price" numeric, "category" character varying, "deadline" timestamp with time zone, "estimated_duration" double precision, "user_id" "uuid", "status" character varying, "accepted_by" "uuid", "created_at" timestamp with time zone, "distance_meters" integer, "creator_name" character varying, "creator_username" character varying)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.id,
    g.title,
    g.description,
    g.price,
    g.category,
    g.deadline,
    g.estimated_duration,
    g.user_id,
    g.status,
    g.accepted_by,
    g.created_at,
    CAST(
      ST_Distance(
        g.exact_location,
        ST_Point(user_lon, user_lat)::GEOGRAPHY
      ) AS INT
    ) as distance_meters,
    u.name as creator_name,
    u.username as creator_username
  FROM "Gig" g
  LEFT JOIN "User" u ON g.user_id = u.id
  WHERE 
    g.status = gig_status
    AND g.exact_location IS NOT NULL
    AND ST_Distance(
      g.exact_location,
      ST_Point(user_lon, user_lat)::GEOGRAPHY
    ) <= radius_meters
  ORDER BY distance_meters ASC;
END;
$$;


ALTER FUNCTION "public"."find_gigs_nearby"("user_lat" double precision, "user_lon" double precision, "radius_meters" integer, "gig_status" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_listings_in_bounds"("p_south" double precision, "p_west" double precision, "p_north" double precision, "p_east" double precision, "p_category" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 100) RETURNS TABLE("id" "uuid", "title" "text", "price" numeric, "is_free" boolean, "category" "public"."listing_category", "media_urls" "text"[], "latitude" double precision, "longitude" double precision, "location_precision" "public"."location_precision", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_bounds geometry;
BEGIN
    v_bounds := ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326);

    RETURN QUERY
    SELECT
        l.id,
        l.title,
        l.price,
        l.is_free,
        l.category,
        l.media_urls,
        -- For approx_area, add random offset to lat/lng (privacy blur)
        CASE
            WHEN l.location_precision = 'exact_place' THEN l.latitude
            WHEN l.location_precision = 'approx_area' THEN l.latitude + (random() - 0.5) * 0.005
            ELSE NULL
        END,
        CASE
            WHEN l.location_precision = 'exact_place' THEN l.longitude
            WHEN l.location_precision = 'approx_area' THEN l.longitude + (random() - 0.5) * 0.005
            ELSE NULL
        END,
        l.location_precision,
        l.created_at
    FROM "Listing" l
    WHERE
        l.status = 'active'
        AND l.location IS NOT NULL
        AND l.location_precision != 'none'
        AND l.location_precision != 'neighborhood_only'
        AND ST_Intersects(l.location::geometry, v_bounds)
        AND (p_category IS NULL OR l.category::text = p_category)
    ORDER BY l.created_at DESC
    LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."find_listings_in_bounds"("p_south" double precision, "p_west" double precision, "p_north" double precision, "p_east" double precision, "p_category" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_listings_nearby"("p_latitude" double precision, "p_longitude" double precision, "p_radius_meters" integer DEFAULT 16000, "p_limit" integer DEFAULT 20, "p_offset" integer DEFAULT 0, "p_category" "text" DEFAULT NULL::"text", "p_min_price" numeric DEFAULT NULL::numeric, "p_max_price" numeric DEFAULT NULL::numeric, "p_is_free" boolean DEFAULT NULL::boolean, "p_condition" "text" DEFAULT NULL::"text", "p_search" "text" DEFAULT NULL::"text", "p_sort" "text" DEFAULT 'newest'::"text") RETURNS TABLE("id" "uuid", "user_id" "uuid", "username" character varying, "user_name" character varying, "user_profile_picture" "text", "title" "text", "description" "text", "price" numeric, "is_free" boolean, "category" "public"."listing_category", "subcategory" "text", "condition" "public"."listing_condition", "status" "public"."listing_status", "media_urls" "text"[], "media_types" "text"[], "location_name" "text", "location_precision" "public"."location_precision", "tags" "text"[], "view_count" integer, "save_count" integer, "created_at" timestamp with time zone, "distance_meters" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_point geography;
BEGIN
    v_point := ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography;

    RETURN QUERY
    SELECT
        l.id,
        l.user_id,
        u.username,
        u.name AS user_name,
        u.profile_picture_url AS user_profile_picture,
        l.title,
        l.description,
        l.price,
        l.is_free,
        l.category,
        l.subcategory,
        l.condition,
        l.status,
        l.media_urls,
        l.media_types,
        l.location_name,
        l.location_precision,
        l.tags,
        l.view_count,
        l.save_count,
        l.created_at,
        CASE
            WHEN l.location IS NOT NULL THEN
                CAST(ST_Distance(l.location, v_point) AS INT)
            ELSE NULL
        END AS distance_meters
    FROM "Listing" l
    JOIN "User" u ON l.user_id = u.id
    WHERE
        l.status = 'active'
        AND (l.location IS NULL OR ST_DWithin(l.location, v_point, p_radius_meters))
        AND (p_category IS NULL OR l.category::text = p_category)
        AND (p_min_price IS NULL OR l.price >= p_min_price)
        AND (p_max_price IS NULL OR l.price <= p_max_price)
        AND (p_is_free IS NULL OR l.is_free = p_is_free)
        AND (p_condition IS NULL OR l.condition::text = p_condition)
        AND (p_search IS NULL OR l.search_vector @@ plainto_tsquery('english', p_search))
    ORDER BY
        CASE WHEN p_sort = 'newest' THEN l.created_at END DESC,
        CASE WHEN p_sort = 'price_asc' THEN l.price END ASC,
        CASE WHEN p_sort = 'price_desc' THEN l.price END DESC,
        CASE WHEN p_sort = 'distance' AND l.location IS NOT NULL THEN ST_Distance(l.location, v_point) END ASC,
        l.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;


ALTER FUNCTION "public"."find_listings_nearby"("p_latitude" double precision, "p_longitude" double precision, "p_radius_meters" integer, "p_limit" integer, "p_offset" integer, "p_category" "text", "p_min_price" numeric, "p_max_price" numeric, "p_is_free" boolean, "p_condition" "text", "p_search" "text", "p_sort" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_building_trust_count"("p_business_user_id" "uuid", "p_parent_home_id" "uuid", "p_category" "text" DEFAULT NULL::"text") RETURNS bigint
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_count BIGINT;
BEGIN
  SELECT COUNT(DISTINCT g.origin_home_id) INTO v_count
  FROM "Gig" g
  JOIN "Home" origin_home ON origin_home.id = g.origin_home_id
  JOIN "HomeOccupancy" ho
    ON ho.home_id = origin_home.id
    AND ho.is_active = true
    AND (ho.role_base IS NULL OR ho.role_base != 'guest')
  WHERE g.accepted_by = p_business_user_id
    AND g.status = 'completed'
    AND g.price >= 10
    AND g.payment_status IN ('captured_hold', 'transfer_scheduled', 'transfer_pending', 'transferred')
    AND g.origin_home_id IS NOT NULL
    AND origin_home.parent_home_id = p_parent_home_id
    -- Same verified address gate
    AND (
      EXISTS (
        SELECT 1 FROM "HomeOwnershipClaim" hoc
        WHERE hoc.home_id = origin_home.id AND hoc.state = 'approved'
      )
      OR EXISTS (
        SELECT 1 FROM "HomeResidencyClaim" hrc
        WHERE hrc.home_id = origin_home.id AND hrc.status = 'verified'
      )
    )
    -- Same rate limit
    AND NOT EXISTS (
      SELECT 1 FROM "Gig" g2
      WHERE g2.origin_home_id = g.origin_home_id
        AND g2.accepted_by = g.accepted_by
        AND g2.category = g.category
        AND g2.id != g.id
        AND g2.status = 'completed'
        AND g2.created_at > g.created_at - INTERVAL '30 days'
        AND g2.created_at < g.created_at
    )
    -- Same payment check
    AND NOT EXISTS (
      SELECT 1 FROM "Payment" p
      WHERE p.gig_id = g.id
        AND p.payment_status IN ('disputed', 'refunded', 'refunded_full', 'refunded_partial')
    )
    AND (p_category IS NULL OR g.category = p_category);

  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."get_building_trust_count"("p_business_user_id" "uuid", "p_parent_home_id" "uuid", "p_category" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_endorsement_count"("p_business_user_id" "uuid", "p_viewer_home_id" "uuid", "p_radius_meters" integer DEFAULT 8047, "p_category" "text" DEFAULT NULL::"text") RETURNS TABLE("endorsement_count" bigint, "by_category" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_viewer_location  geography;
BEGIN
  -- Get viewer home location
  SELECT h.location INTO v_viewer_location
  FROM "Home" h
  WHERE h.id = p_viewer_home_id;

  IF v_viewer_location IS NULL THEN
    RETURN QUERY SELECT 0::BIGINT, '[]'::JSONB;
    RETURN;
  END IF;

  RETURN QUERY
  WITH eligible_endorsements AS (
    SELECT
      e.id,
      e.category
    FROM "NeighborEndorsement" e
    JOIN "Home" endorser_home ON endorser_home.id = e.endorser_home_id
    -- Only endorsements from within radius
    WHERE e.business_user_id = p_business_user_id
      AND (p_category IS NULL OR e.category = p_category)
      AND ST_DWithin(endorser_home.location, v_viewer_location, p_radius_meters)
      -- Verified occupancy gate: endorser must have active, non-guest occupancy
      AND EXISTS (
        SELECT 1 FROM "HomeOccupancy" ho
        WHERE ho.home_id = e.endorser_home_id
          AND ho.user_id = e.endorser_user_id
          AND ho.is_active = true
          AND ho.role_base NOT IN ('guest')
      )
      -- Minimum home age: 14 days (anti-gaming)
      AND endorser_home.created_at <= (now() - INTERVAL '14 days')
  )
  SELECT
    COUNT(*)::BIGINT,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('category', cat, 'count', cnt))
       FROM (
         SELECT category AS cat, COUNT(*) AS cnt
         FROM eligible_endorsements
         GROUP BY category
         ORDER BY cnt DESC
       ) sub),
      '[]'::JSONB
    )
  FROM eligible_endorsements;
END;
$$;


ALTER FUNCTION "public"."get_endorsement_count"("p_business_user_id" "uuid", "p_viewer_home_id" "uuid", "p_radius_meters" integer, "p_category" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_full_home_profile"("p_home_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'home', row_to_json(h.*),
    'members', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'user_id', ho.user_id,
        'role', ho.role,
        'is_active', ho.is_active,
        'can_manage_home', ho.can_manage_home,
        'can_manage_finance', ho.can_manage_finance,
        'can_manage_tasks', ho.can_manage_tasks,
        'name', u.name,
        'username', u.username,
        'profile_picture_url', u.profile_picture_url
      )), '[]'::jsonb)
      FROM "HomeOccupancy" ho
      JOIN "User" u ON u.id = ho.user_id
      WHERE ho.home_id = p_home_id AND ho.is_active = true
    ),
    'media', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', hm.id,
        'file_id', hm.file_id,
        'url', f.file_url,
        'category', hm.media_category,
        'is_primary', hm.is_primary
      ) ORDER BY hm.is_primary DESC, hm.display_order), '[]'::jsonb)
      FROM "HomeMedia" hm
      JOIN "File" f ON f.id = hm.file_id
      WHERE hm.home_id = p_home_id AND f.is_deleted = false
    ),
    'reputation', (
      SELECT row_to_json(hr.*)
      FROM "HomeReputation" hr WHERE hr.home_id = p_home_id
    ),
    'open_issues_count', (
      SELECT count(*) FROM "HomeIssue"
      WHERE home_id = p_home_id AND status IN ('open','scheduled','in_progress')
    ),
    'pending_bills_count', (
      SELECT count(*) FROM "HomeBill"
      WHERE home_id = p_home_id AND status IN ('due','overdue')
    )
  ) INTO v_result
  FROM "Home" h WHERE h.id = p_home_id;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_full_home_profile"("p_home_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_gigs_by_distance"("user_lat" double precision, "user_lon" double precision, "limit_count" integer DEFAULT 20) RETURNS TABLE("id" "uuid", "title" character varying, "description" "text", "price" numeric, "category" character varying, "deadline" timestamp with time zone, "user_id" "uuid", "status" character varying, "created_at" timestamp with time zone, "distance_meters" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.id,
    g.title,
    g.description,
    g.price,
    g.category,
    g.deadline,
    g.user_id,
    g.status,
    g.created_at,
    CAST(
      ST_Distance(
        g.exact_location,
        ST_Point(user_lon, user_lat)::GEOGRAPHY
      ) AS INT
    ) as distance_meters
  FROM "Gig" g
  WHERE g.status = 'open' AND g.exact_location IS NOT NULL
  ORDER BY distance_meters ASC
  LIMIT limit_count;
END;
$$;


ALTER FUNCTION "public"."get_gigs_by_distance"("user_lat" double precision, "user_lon" double precision, "limit_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_home_profile_with_media"("p_home_id" "uuid", "p_visibility" character varying DEFAULT 'public'::character varying) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'home', row_to_json(h.*),
    'photos', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', hm.id,
          'fileId', hm.file_id,
          'url', f.file_url,
          'category', hm.media_category,
          'title', hm.title,
          'description', hm.description,
          'isPrimary', hm.is_primary,
          'thumbnails', (
            SELECT jsonb_object_agg(
              ft.size_name,
              ft.file_url
            )
            FROM "FileThumbnail" ft
            WHERE ft.file_id = f.id
          )
        )
        ORDER BY hm.is_primary DESC, hm.display_order, hm.created_at
      )
      FROM "HomeMedia" hm
      JOIN "File" f ON hm.file_id = f.id
      WHERE hm.home_id = p_home_id
        AND (p_visibility = 'private' OR hm.visibility = 'public')
        AND f.is_deleted = FALSE
    )
  ) INTO v_result
  FROM "Home" h
  WHERE h.id = p_home_id;
  
  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_home_profile_with_media"("p_home_id" "uuid", "p_visibility" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_neighbor_trust_count"("p_business_user_id" "uuid", "p_viewer_home_id" "uuid", "p_radius_meters" integer DEFAULT 1609, "p_category" "text" DEFAULT NULL::"text") RETURNS TABLE("neighbor_count" bigint, "home_density" bigint)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_viewer_location geography;
BEGIN
  -- Resolve viewer home location
  SELECT h.location INTO v_viewer_location
  FROM "Home" h
  WHERE h.id = p_viewer_home_id;

  -- If viewer has no location, return zeros
  IF v_viewer_location IS NULL THEN
    RETURN QUERY SELECT 0::BIGINT, 0::BIGINT;
    RETURN;
  END IF;

  RETURN QUERY
  WITH trust_gigs AS (
    SELECT DISTINCT g.origin_home_id
    FROM "Gig" g
    JOIN "Home" origin_home ON origin_home.id = g.origin_home_id
    JOIN "HomeOccupancy" ho
      ON ho.home_id = origin_home.id
      AND ho.is_active = true
      AND (ho.role_base IS NULL OR ho.role_base != 'guest')
    WHERE g.accepted_by = p_business_user_id
      AND g.status = 'completed'
      AND g.price >= 10                              -- price floor (anti-spam)
      AND g.payment_status IN ('captured_hold', 'transfer_scheduled', 'transfer_pending', 'transferred')  -- real payment only
      AND g.origin_home_id IS NOT NULL
      -- Verified address gate: home must have approved ownership or verified residency
      AND (
        EXISTS (
          SELECT 1 FROM "HomeOwnershipClaim" hoc
          WHERE hoc.home_id = origin_home.id
            AND hoc.state = 'approved'
        )
        OR EXISTS (
          SELECT 1 FROM "HomeResidencyClaim" hrc
          WHERE hrc.home_id = origin_home.id
            AND hrc.status = 'verified'
        )
      )
      -- Rate limit: 1 trust-counting completion per (home, provider, category) per 30 days
      -- Only count the earliest gig in each 30-day window
      AND NOT EXISTS (
        SELECT 1 FROM "Gig" g2
        WHERE g2.origin_home_id = g.origin_home_id
          AND g2.accepted_by = g.accepted_by
          AND g2.category = g.category
          AND g2.id != g.id
          AND g2.status = 'completed'
          AND g2.created_at > g.created_at - INTERVAL '30 days'
          AND g2.created_at < g.created_at
      )
      -- No disputed or refunded payments for this gig
      AND NOT EXISTS (
        SELECT 1 FROM "Payment" p
        WHERE p.gig_id = g.id
          AND p.payment_status IN ('disputed', 'refunded', 'refunded_full', 'refunded_partial')
      )
      -- Optional category filter
      AND (p_category IS NULL OR g.category = p_category)
      -- Proximity: origin home within radius of viewer home
      AND origin_home.location IS NOT NULL
      AND ST_DWithin(origin_home.location, v_viewer_location, p_radius_meters)
  )
  SELECT
    (SELECT COUNT(*) FROM trust_gigs)::BIGINT AS neighbor_count,
    (
      SELECT COUNT(DISTINCT ho2.home_id)
      FROM "HomeOccupancy" ho2
      JOIN "Home" h2 ON h2.id = ho2.home_id
      WHERE ho2.is_active = true
        AND h2.location IS NOT NULL
        AND ST_DWithin(h2.location, v_viewer_location, p_radius_meters)
    )::BIGINT AS home_density;
END;
$$;


ALTER FUNCTION "public"."get_neighbor_trust_count"("p_business_user_id" "uuid", "p_viewer_home_id" "uuid", "p_radius_meters" integer, "p_category" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_neighborhood_feed"("p_user_id" "uuid", "p_limit" integer DEFAULT 20, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "user_id" "uuid", "username" character varying, "user_name" character varying, "content" "text", "media_urls" "text"[], "post_type" character varying, "like_count" integer, "comment_count" integer, "created_at" timestamp with time zone, "user_has_liked" boolean, "distance_meters" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  WITH user_location AS (
    SELECT h.location
    FROM "HomeOccupancy" ho
    JOIN "Home" h ON ho.home_id = h.id
    WHERE ho.user_id = p_user_id
    LIMIT 1
  )
  SELECT 
    p.id,
    p.user_id,
    u.username,
    u.name as user_name,
    p.content,
    p.media_urls,
    p.post_type,
    p.like_count,
    p.comment_count,
    p.created_at,
    EXISTS(
      SELECT 1 FROM "PostLike" pl 
      WHERE pl.post_id = p.id AND pl.user_id = p_user_id
    ) as user_has_liked,
    CASE 
      WHEN p.home_id IS NOT NULL AND (SELECT location FROM user_location) IS NOT NULL THEN
        CAST(
          ST_Distance(
            h.location,
            (SELECT location FROM user_location)
          ) AS INT
        )
      ELSE NULL
    END as distance_meters
  FROM "Post" p
  JOIN "User" u ON p.user_id = u.id
  LEFT JOIN "Home" h ON p.home_id = h.id
  WHERE 
    p.is_archived = FALSE
    AND p.visibility IN ('public', 'neighborhood')
    AND (
      -- Posts from same city
      u.city = (SELECT city FROM "User" WHERE id = p_user_id)
      OR
      -- Posts from users they follow
      EXISTS(
        SELECT 1 FROM "UserFollow" uf 
        WHERE uf.follower_id = p_user_id AND uf.following_id = p.user_id
      )
    )
  ORDER BY p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;


ALTER FUNCTION "public"."get_neighborhood_feed"("p_user_id" "uuid", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_neighborhood_feed"("p_user_id" "uuid", "p_limit" integer DEFAULT 20, "p_offset" integer DEFAULT 0, "p_post_type" "text" DEFAULT NULL::"text", "p_radius_meters" integer DEFAULT 16000) RETURNS TABLE("id" "uuid", "user_id" "uuid", "username" character varying, "user_name" character varying, "user_first_name" character varying, "user_profile_picture" "text", "user_city" character varying, "user_state" character varying, "content" "text", "media_urls" "text"[], "media_types" "text"[], "post_type" character varying, "visibility" character varying, "like_count" integer, "comment_count" integer, "share_count" integer, "is_pinned" boolean, "is_edited" boolean, "created_at" timestamp with time zone, "user_has_liked" boolean, "home_id" "uuid", "home_address" character varying, "home_city" character varying, "post_latitude" double precision, "post_longitude" double precision, "post_location_name" "text", "distance_meters" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_user_location geography;
  v_user_city     text;
BEGIN
  -- Resolve the caller's location from their primary home
  SELECT h.location, u.city
  INTO v_user_location, v_user_city
  FROM "User" u
  LEFT JOIN "HomeOccupancy" ho ON ho.user_id = u.id
  LEFT JOIN "Home" h ON ho.home_id = h.id AND h.location IS NOT NULL
  WHERE u.id = p_user_id
  LIMIT 1;

  RETURN QUERY
  SELECT
    p.id,
    p.user_id,
    u.username,
    u.name              AS user_name,
    u.first_name        AS user_first_name,
    u.profile_picture_url AS user_profile_picture,
    u.city              AS user_city,
    u.state             AS user_state,
    p.content,
    p.media_urls,
    p.media_types,
    p.post_type,
    p.visibility,
    p.like_count,
    p.comment_count,
    p.share_count,
    p.is_pinned,
    p.is_edited,
    p.created_at,
    EXISTS(
      SELECT 1 FROM "PostLike" pl
      WHERE pl.post_id = p.id AND pl.user_id = p_user_id
    ) AS user_has_liked,
    p.home_id,
    h.address           AS home_address,
    h.city              AS home_city,
    p.latitude          AS post_latitude,
    p.longitude         AS post_longitude,
    p.location_name     AS post_location_name,
    CASE
      WHEN v_user_location IS NOT NULL AND (p.location IS NOT NULL OR h.location IS NOT NULL) THEN
        CAST(ST_Distance(
          COALESCE(p.location, h.location),
          v_user_location
        ) AS INT)
      ELSE NULL
    END AS distance_meters
  FROM "Post" p
  JOIN "User" u ON p.user_id = u.id
  LEFT JOIN "Home" h ON p.home_id = h.id
  WHERE
    p.is_archived = FALSE
    AND p.visibility IN ('public', 'neighborhood')
    -- Post type filter (optional)
    AND (p_post_type IS NULL OR p.post_type::text = p_post_type)
    AND (
      -- Geo proximity: posts within radius
      (
        v_user_location IS NOT NULL
        AND (p.location IS NOT NULL OR h.location IS NOT NULL)
        AND ST_DWithin(
          COALESCE(p.location, h.location),
          v_user_location,
          p_radius_meters
        )
      )
      OR
      -- City fallback: same city (case-insensitive)
      (LOWER(u.city) = LOWER(v_user_city) AND v_user_city IS NOT NULL)
      OR
      -- Following: always show followed users
      EXISTS(
        SELECT 1 FROM "UserFollow" uf
        WHERE uf.follower_id = p_user_id AND uf.following_id = p.user_id
      )
      OR
      -- Own posts
      p.user_id = p_user_id
    )
  ORDER BY
    p.is_pinned DESC,     -- pinned first
    p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;


ALTER FUNCTION "public"."get_neighborhood_feed"("p_user_id" "uuid", "p_limit" integer, "p_offset" integer, "p_post_type" "text", "p_radius_meters" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_neighborhood_feed_at"("p_user_id" "uuid", "p_latitude" double precision, "p_longitude" double precision, "p_limit" integer DEFAULT 20, "p_offset" integer DEFAULT 0, "p_post_type" "text" DEFAULT NULL::"text", "p_radius_meters" integer DEFAULT 16000) RETURNS TABLE("id" "uuid", "user_id" "uuid", "username" character varying, "user_name" character varying, "user_first_name" character varying, "user_profile_picture" "text", "user_city" character varying, "user_state" character varying, "content" "text", "media_urls" "text"[], "media_types" "text"[], "post_type" character varying, "visibility" character varying, "like_count" integer, "comment_count" integer, "share_count" integer, "is_pinned" boolean, "is_edited" boolean, "created_at" timestamp with time zone, "user_has_liked" boolean, "home_id" "uuid", "home_address" character varying, "home_city" character varying, "post_latitude" double precision, "post_longitude" double precision, "post_location_name" "text", "distance_meters" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_user_location geography;
BEGIN
  -- Build a geography point from the explicit coordinates
  v_user_location := ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography;

  RETURN QUERY
  SELECT
    p.id,
    p.user_id,
    u.username,
    u.name              AS user_name,
    u.first_name        AS user_first_name,
    u.profile_picture_url AS user_profile_picture,
    u.city              AS user_city,
    u.state             AS user_state,
    p.content,
    p.media_urls,
    p.media_types,
    p.post_type,
    p.visibility,
    p.like_count,
    p.comment_count,
    p.share_count,
    p.is_pinned,
    p.is_edited,
    p.created_at,
    EXISTS(
      SELECT 1 FROM "PostLike" pl
      WHERE pl.post_id = p.id AND pl.user_id = p_user_id
    ) AS user_has_liked,
    p.home_id,
    h.address           AS home_address,
    h.city              AS home_city,
    p.latitude          AS post_latitude,
    p.longitude         AS post_longitude,
    p.location_name     AS post_location_name,
    CASE
      WHEN (p.location IS NOT NULL OR h.location IS NOT NULL) THEN
        CAST(ST_Distance(
          COALESCE(p.location, h.location),
          v_user_location
        ) AS INT)
      ELSE NULL
    END AS distance_meters
  FROM "Post" p
  JOIN "User" u ON p.user_id = u.id
  LEFT JOIN "Home" h ON p.home_id = h.id
  WHERE
    p.is_archived = FALSE
    AND p.visibility IN ('public', 'neighborhood')
    -- Post type filter (optional)
    AND (p_post_type IS NULL OR p.post_type::text = p_post_type)
    AND (
      -- Geo proximity: posts within radius of the provided coordinates
      (
        (p.location IS NOT NULL OR h.location IS NOT NULL)
        AND ST_DWithin(
          COALESCE(p.location, h.location),
          v_user_location,
          p_radius_meters
        )
      )
      OR
      -- Following: always show followed users
      EXISTS(
        SELECT 1 FROM "UserFollow" uf
        WHERE uf.follower_id = p_user_id AND uf.following_id = p.user_id
      )
      OR
      -- Own posts
      p.user_id = p_user_id
    )
  ORDER BY
    p.is_pinned DESC,
    p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;


ALTER FUNCTION "public"."get_neighborhood_feed_at"("p_user_id" "uuid", "p_latitude" double precision, "p_longitude" double precision, "p_limit" integer, "p_offset" integer, "p_post_type" "text", "p_radius_meters" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_neighborhood_feed_v2"("p_user_id" "uuid", "p_latitude" double precision, "p_longitude" double precision, "p_limit" integer DEFAULT 20, "p_offset" integer DEFAULT 0, "p_post_type" "text" DEFAULT NULL::"text", "p_radius_meters" integer DEFAULT 16000, "p_tags" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("id" "uuid", "user_id" "uuid", "username" character varying, "user_name" character varying, "user_first_name" character varying, "user_profile_picture" "text", "user_city" character varying, "user_state" character varying, "title" "text", "content" "text", "media_urls" "text"[], "media_types" "text"[], "post_type" character varying, "post_format" "public"."post_format", "visibility" character varying, "visibility_scope" "public"."visibility_scope", "location_precision" "public"."location_precision", "tags" "text"[], "like_count" integer, "comment_count" integer, "share_count" integer, "is_pinned" boolean, "is_edited" boolean, "created_at" timestamp with time zone, "user_has_liked" boolean, "user_has_saved" boolean, "home_id" "uuid", "home_city" character varying, "post_latitude" double precision, "post_longitude" double precision, "post_location_name" "text", "distance_meters" integer, "event_date" timestamp with time zone, "event_end_date" timestamp with time zone, "event_venue" "text", "safety_alert_kind" "public"."safety_alert_kind", "safety_happened_at" timestamp with time zone, "deal_expires_at" timestamp with time zone, "ref_listing_id" "uuid", "ref_task_id" "uuid")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_user_location geography;
BEGIN
    v_user_location := ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography;

    RETURN QUERY
    SELECT
        p.id,
        p.user_id,
        u.username,
        u.name              AS user_name,
        u.first_name        AS user_first_name,
        u.profile_picture_url AS user_profile_picture,
        u.city              AS user_city,
        u.state             AS user_state,
        p.title,
        p.content,
        p.media_urls,
        p.media_types,
        p.post_type,
        p.post_format,
        p.visibility,
        p.visibility_scope,
        p.location_precision,
        p.tags,
        p.like_count,
        p.comment_count,
        p.share_count,
        p.is_pinned,
        p.is_edited,
        p.created_at,
        EXISTS(
            SELECT 1 FROM "PostLike" pl
            WHERE pl.post_id = p.id AND pl.user_id = p_user_id
        ) AS user_has_liked,
        EXISTS(
            SELECT 1 FROM "PostSave" ps
            WHERE ps.post_id = p.id AND ps.user_id = p_user_id
        ) AS user_has_saved,
        p.home_id,
        h.city              AS home_city,
        -- Apply location precision to returned coordinates
        CASE
            WHEN p.location_precision = 'exact_place' THEN p.latitude
            WHEN p.location_precision = 'approx_area' THEN p.latitude + (random() - 0.5) * 0.005
            ELSE NULL
        END AS post_latitude,
        CASE
            WHEN p.location_precision = 'exact_place' THEN p.longitude
            WHEN p.location_precision = 'approx_area' THEN p.longitude + (random() - 0.5) * 0.005
            ELSE NULL
        END AS post_longitude,
        p.location_name     AS post_location_name,
        CASE
            WHEN (p.location IS NOT NULL OR h.location IS NOT NULL) THEN
                CAST(ST_Distance(
                    COALESCE(p.location, h.location),
                    v_user_location
                ) AS INT)
            ELSE NULL
        END AS distance_meters,
        p.event_date,
        p.event_end_date,
        p.event_venue,
        p.safety_alert_kind,
        p.safety_happened_at,
        p.deal_expires_at,
        p.ref_listing_id,
        p.ref_task_id
    FROM "Post" p
    JOIN "User" u ON p.user_id = u.id
    LEFT JOIN "Home" h ON p.home_id = h.id
    WHERE
        p.is_archived = FALSE
        AND p.visibility IN ('public', 'neighborhood', 'city', 'radius')
        AND (p_post_type IS NULL OR p.post_type::text = p_post_type)
        AND (p_tags IS NULL OR p.tags && p_tags)  -- array overlap: has any of the requested tags
        AND (
            -- Geo proximity
            (
                (p.location IS NOT NULL OR h.location IS NOT NULL)
                AND ST_DWithin(
                    COALESCE(p.location, h.location),
                    v_user_location,
                    p_radius_meters
                )
            )
            OR
            -- Following
            EXISTS(
                SELECT 1 FROM "UserFollow" uf
                WHERE uf.follower_id = p_user_id AND uf.following_id = p.user_id
            )
            OR
            -- Own posts
            p.user_id = p_user_id
        )
    ORDER BY
        p.is_pinned DESC,
        p.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;


ALTER FUNCTION "public"."get_neighborhood_feed_v2"("p_user_id" "uuid", "p_latitude" double precision, "p_longitude" double precision, "p_limit" integer, "p_offset" integer, "p_post_type" "text", "p_radius_meters" integer, "p_tags" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_direct_chat"("p_user_id_1" "uuid", "p_user_id_2" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_room_id UUID;
BEGIN
  -- Look for an existing direct chat between these two users
  SELECT cp1.room_id INTO v_room_id
  FROM "ChatParticipant" cp1
  JOIN "ChatParticipant" cp2 ON cp1.room_id = cp2.room_id
  JOIN "ChatRoom" r ON r.id = cp1.room_id
  WHERE cp1.user_id = p_user_id_1
    AND cp2.user_id = p_user_id_2
    AND r.type = 'direct'
  LIMIT 1;

  IF v_room_id IS NOT NULL THEN
    -- Reactivate participants if they left
    UPDATE "ChatParticipant"
    SET is_active = true, left_at = NULL
    WHERE room_id = v_room_id
      AND user_id IN (p_user_id_1, p_user_id_2)
      AND is_active = false;

    RETURN v_room_id;
  END IF;

  -- Create a new direct chat room
  INSERT INTO "ChatRoom" (type)
  VALUES ('direct')
  RETURNING id INTO v_room_id;

  -- Add both participants
  INSERT INTO "ChatParticipant" (room_id, user_id, role, is_active)
  VALUES
    (v_room_id, p_user_id_1, 'owner', true),
    (v_room_id, p_user_id_2, 'member', true);

  RETURN v_room_id;
END;
$$;


ALTER FUNCTION "public"."get_or_create_direct_chat"("p_user_id_1" "uuid", "p_user_id_2" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_gig_chat"("p_gig_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_room_id UUID;
  v_gig_title TEXT;
BEGIN
  -- Check if a gig chat room already exists
  SELECT id INTO v_room_id
  FROM "ChatRoom"
  WHERE gig_id = p_gig_id
    AND type = 'gig'
  LIMIT 1;

  -- If found, return it
  IF v_room_id IS NOT NULL THEN
    RETURN v_room_id;
  END IF;

  -- Get gig title for the room name
  SELECT title INTO v_gig_title
  FROM "Gig"
  WHERE id = p_gig_id;

  -- Create a new gig chat room
  INSERT INTO "ChatRoom" (type, gig_id, name)
  VALUES ('gig', p_gig_id, COALESCE('Gig: ' || v_gig_title, 'Gig Chat'))
  RETURNING id INTO v_room_id;

  RETURN v_room_id;
END;
$$;


ALTER FUNCTION "public"."get_or_create_gig_chat"("p_gig_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_home_chat"("p_home_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_room_id UUID;
BEGIN
  -- Try to find existing room
  SELECT id INTO v_room_id
  FROM "ChatRoom"
  WHERE home_id = p_home_id AND type = 'home'
  LIMIT 1;
  
  -- Create if doesn't exist
  IF v_room_id IS NULL THEN
    INSERT INTO "ChatRoom" (type, home_id, name)
    VALUES ('home', p_home_id, 'Home Chat')
    RETURNING id INTO v_room_id;
  END IF;
  
  RETURN v_room_id;
END;
$$;


ALTER FUNCTION "public"."get_or_create_home_chat"("p_home_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_user_quota"("p_user_id" "uuid") RETURNS TABLE("storage_limit" bigint, "storage_used" bigint, "storage_available" bigint, "file_count" integer, "max_files" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Create quota if doesn't exist
  INSERT INTO "FileQuota" (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Return quota info
  RETURN QUERY
  SELECT 
    q.storage_limit,
    q.storage_used,
    q.storage_limit - q.storage_used as storage_available,
    q.file_count,
    q.max_files
  FROM "FileQuota" q
  WHERE q.user_id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."get_or_create_user_quota"("p_user_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."Wallet" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "balance" bigint DEFAULT 0 NOT NULL,
    "currency" character varying(3) DEFAULT 'usd'::character varying NOT NULL,
    "frozen" boolean DEFAULT false NOT NULL,
    "lifetime_deposits" bigint DEFAULT 0 NOT NULL,
    "lifetime_withdrawals" bigint DEFAULT 0 NOT NULL,
    "lifetime_received" bigint DEFAULT 0 NOT NULL,
    "lifetime_spent" bigint DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "Wallet_balance_nonneg" CHECK (("balance" >= 0))
);


ALTER TABLE "public"."Wallet" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_wallet"("p_user_id" "uuid") RETURNS "public"."Wallet"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_wallet "public"."Wallet";
BEGIN
  -- Try to find existing wallet
  SELECT * INTO v_wallet FROM "Wallet" WHERE user_id = p_user_id;

  IF v_wallet IS NOT NULL THEN
    RETURN v_wallet;
  END IF;

  -- Create new wallet
  INSERT INTO "Wallet" (user_id, balance, currency)
  VALUES (p_user_id, 0, 'usd')
  ON CONFLICT (user_id) DO NOTHING
  RETURNING * INTO v_wallet;

  -- Handle race condition: if insert did nothing, select again
  IF v_wallet IS NULL THEN
    SELECT * INTO v_wallet FROM "Wallet" WHERE user_id = p_user_id;
  END IF;

  RETURN v_wallet;
END;
$$;


ALTER FUNCTION "public"."get_or_create_wallet"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_posts_in_bounds"("p_user_id" "uuid", "p_south" double precision, "p_west" double precision, "p_north" double precision, "p_east" double precision, "p_limit" integer DEFAULT 50, "p_post_type" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "user_id" "uuid", "username" character varying, "user_name" character varying, "user_profile_picture" "text", "content" "text", "post_type" character varying, "like_count" integer, "comment_count" integer, "created_at" timestamp with time zone, "latitude" double precision, "longitude" double precision, "location_name" "text", "home_address" character varying)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_bbox geography;
BEGIN
  -- Build bounding box
  v_bbox := ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326)::geography;

  RETURN QUERY
  SELECT
    p.id,
    p.user_id,
    u.username,
    u.name AS user_name,
    u.profile_picture_url AS user_profile_picture,
    -- Truncate content for map tooltip
    LEFT(p.content, 200) AS content,
    p.post_type,
    p.like_count,
    p.comment_count,
    p.created_at,
    -- Prefer post's own location, fall back to home
    COALESCE(p.latitude, ST_Y(h.location::geometry))  AS latitude,
    COALESCE(p.longitude, ST_X(h.location::geometry)) AS longitude,
    p.location_name,
    h.address AS home_address
  FROM "Post" p
  JOIN "User" u ON p.user_id = u.id
  LEFT JOIN "Home" h ON p.home_id = h.id
  WHERE
    p.is_archived = FALSE
    AND p.visibility IN ('public', 'neighborhood')
    AND (p_post_type IS NULL OR p.post_type::text = p_post_type)
    AND (
      -- Post has own location within bounds
      (p.location IS NOT NULL AND ST_Intersects(p.location, v_bbox))
      OR
      -- Post linked to home within bounds
      (p.home_id IS NOT NULL AND h.location IS NOT NULL AND ST_Intersects(h.location, v_bbox))
    )
  ORDER BY p.created_at DESC
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."get_posts_in_bounds"("p_user_id" "uuid", "p_south" double precision, "p_west" double precision, "p_north" double precision, "p_east" double precision, "p_limit" integer, "p_post_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_business_locations"("p_user_id" "uuid") RETURNS TABLE("location_id" "uuid", "business_name" character varying, "location_label" "text", "city" "text", "state" "text", "latitude" double precision, "longitude" double precision)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    bl.id          AS location_id,
    u.name         AS business_name,
    bl.label       AS location_label,
    bl.city,
    bl.state,
    CASE WHEN bl.location IS NOT NULL THEN ST_Y(bl.location::geometry) ELSE NULL END AS latitude,
    CASE WHEN bl.location IS NOT NULL THEN ST_X(bl.location::geometry) ELSE NULL END AS longitude
  FROM "BusinessTeam" bt
  JOIN "User" u ON bt.business_user_id = u.id
  JOIN "BusinessLocation" bl ON bl.business_user_id = bt.business_user_id AND bl.is_active = TRUE
  WHERE bt.user_id = p_user_id
    AND bt.is_active = TRUE
  ORDER BY bl.is_primary DESC, bl.sort_order ASC;
END;
$$;


ALTER FUNCTION "public"."get_user_business_locations"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_chat_rooms"("p_user_id" "uuid", "p_limit" integer DEFAULT 50) RETURNS TABLE("id" "uuid", "room_type" character varying, "room_name" character varying, "description" "text", "gig_id" "uuid", "home_id" "uuid", "is_active" boolean, "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "last_message_at" timestamp with time zone, "last_message_preview" "text", "unread_count" integer, "last_read_at" timestamp with time zone, "role" character varying, "other_participant_name" "text", "other_participant_username" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.type AS room_type,
    r.name AS room_name,
    r.description,
    r.gig_id,
    r.home_id,
    r.is_active,
    r.created_at,
    r.updated_at,
    -- Use the latest message time, or fall back to room updated_at
    COALESCE(
      (SELECT MAX(cm.created_at) FROM "ChatMessage" cm WHERE cm.room_id = r.id AND cm.deleted = false),
      r.updated_at
    ) AS last_message_at,
    -- Get last message preview
    (
      SELECT LEFT(cm.message, 100)
      FROM "ChatMessage" cm
      WHERE cm.room_id = r.id AND cm.deleted = false
      ORDER BY cm.created_at DESC
      LIMIT 1
    ) AS last_message_preview,
    cp.unread_count,
    cp.last_read_at,
    cp.role,
    -- Get the other participant's name (for direct/gig chats)
    (
      SELECT COALESCE(u.name, u.first_name || ' ' || u.last_name, u.username)
      FROM "ChatParticipant" cp2
      JOIN "User" u ON u.id = cp2.user_id
      WHERE cp2.room_id = r.id
        AND cp2.user_id != p_user_id
        AND cp2.is_active = true
      LIMIT 1
    ) AS other_participant_name,
    (
      SELECT u.username
      FROM "ChatParticipant" cp2
      JOIN "User" u ON u.id = cp2.user_id
      WHERE cp2.room_id = r.id
        AND cp2.user_id != p_user_id
        AND cp2.is_active = true
      LIMIT 1
    ) AS other_participant_username
  FROM "ChatParticipant" cp
  JOIN "ChatRoom" r ON r.id = cp.room_id
  WHERE cp.user_id = p_user_id
    AND cp.is_active = true
  ORDER BY COALESCE(
    (SELECT MAX(cm.created_at) FROM "ChatMessage" cm WHERE cm.room_id = r.id AND cm.deleted = false),
    r.updated_at
  ) DESC NULLS LAST
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."get_user_chat_rooms"("p_user_id" "uuid", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_earnings"("p_user_id" "uuid", "p_start_date" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_end_date" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH scoped AS (
    SELECT
      payment_status,
      GREATEST(0, COALESCE(amount_to_payee, 0) - COALESCE(refunded_amount, 0)) AS net_amount,
      COALESCE(is_escrowed, FALSE) AS is_escrowed,
      escrow_released_at
    FROM "Payment"
    WHERE payee_id = p_user_id
      AND (p_start_date IS NULL OR created_at >= p_start_date)
      AND (p_end_date IS NULL OR created_at <= p_end_date)
      AND payment_status IN (
        'captured_hold', 'transfer_scheduled', 'transfer_pending', 'transferred',
        'refund_pending', 'refunded_partial', 'refunded_full', 'disputed',
        'succeeded', 'processing'
      )
  ),
  earnings AS (
    SELECT
      COUNT(*) as total_payments,
      COALESCE(SUM(net_amount), 0) as total_earned,
      COALESCE(SUM(CASE WHEN payment_status IN ('transferred', 'succeeded') THEN net_amount ELSE 0 END), 0) as total_paid,
      COALESCE(SUM(CASE WHEN is_escrowed = TRUE AND escrow_released_at IS NULL THEN net_amount ELSE 0 END), 0) as total_escrowed,
      COALESCE(SUM(CASE WHEN ((is_escrowed = FALSE) OR escrow_released_at IS NOT NULL OR payment_status IN ('transferred', 'succeeded')) THEN net_amount ELSE 0 END), 0) as total_available
    FROM scoped
  )
  SELECT jsonb_build_object(
    'totalPayments', total_payments,
    'totalEarned', total_earned,
    'totalPaid', total_paid,
    'totalEscrowed', total_escrowed,
    'totalAvailable', total_available,
    'currency', 'USD'
  ) INTO v_result
  FROM earnings;
  
  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_user_earnings"("p_user_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_home_locations"("p_user_id" "uuid") RETURNS TABLE("home_id" "uuid", "home_name" "text", "address" character varying, "city" character varying, "state" character varying, "zipcode" character varying, "latitude" double precision, "longitude" double precision)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    h.id        AS home_id,
    h.name      AS home_name,
    h.address,
    h.city,
    h.state,
    h.zipcode,
    CASE WHEN h.location IS NOT NULL THEN ST_Y(h.location::geometry) ELSE NULL END AS latitude,
    CASE WHEN h.location IS NOT NULL THEN ST_X(h.location::geometry) ELSE NULL END AS longitude
  FROM "HomeOccupancy" ho
  JOIN "Home" h ON ho.home_id = h.id
  WHERE ho.user_id = p_user_id
    AND ho.is_active = TRUE
  ORDER BY ho.created_at ASC;  -- first home = primary
END;
$$;


ALTER FUNCTION "public"."get_user_home_locations"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_inbox"("p_user_id" "uuid", "p_type" character varying DEFAULT NULL::character varying, "p_viewed" boolean DEFAULT NULL::boolean, "p_archived" boolean DEFAULT false, "p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "type" character varying, "subject" character varying, "sender_business_name" character varying, "viewed" boolean, "starred" boolean, "payout_amount" numeric, "created_at" timestamp with time zone, "expires_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.type,
    m.subject,
    m.sender_business_name,
    m.viewed,
    m.starred,
    m.payout_amount,
    m.created_at,
    m.expires_at
  FROM "Mail" m
  WHERE 
    m.recipient_user_id = p_user_id
    AND m.archived = p_archived
    AND (p_type IS NULL OR m.type = p_type)
    AND (p_viewed IS NULL OR m.viewed = p_viewed)
    AND (m.expires_at IS NULL OR m.expires_at > NOW())
  ORDER BY m.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;


ALTER FUNCTION "public"."get_user_inbox"("p_user_id" "uuid", "p_type" character varying, "p_viewed" boolean, "p_archived" boolean, "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_pending_earnings"("p_user_id" "uuid") RETURNS numeric
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_total DECIMAL;
BEGIN
  SELECT COALESCE(SUM(payout_amount), 0) INTO v_total
  FROM "Mail"
  WHERE 
    recipient_user_id = p_user_id
    AND type = 'ad'
    AND viewed = false
    AND payout_amount IS NOT NULL
    AND (expires_at IS NULL OR expires_at > NOW());
  
  RETURN v_total;
END;
$$;


ALTER FUNCTION "public"."get_user_pending_earnings"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_profile_with_media"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'user', row_to_json(u.*),
    'skills', (
      SELECT jsonb_agg(row_to_json(s.*))
      FROM "UserSkill" s
      WHERE s.user_id = p_user_id AND s.show_on_profile = TRUE
      ORDER BY s.display_order, s.skill_name
    ),
    'portfolio', (
      SELECT jsonb_agg(row_to_json(p.*))
      FROM "UserPortfolio" p
      WHERE p.user_id = p_user_id AND p.is_visible = TRUE
      ORDER BY p.is_featured DESC, p.display_order, p.created_at DESC
    ),
    'certifications', (
      SELECT jsonb_agg(row_to_json(c.*))
      FROM "UserCertification" c
      WHERE c.user_id = p_user_id AND c.show_on_profile = TRUE
      ORDER BY c.issue_date DESC
    ),
    'experience', (
      SELECT jsonb_agg(row_to_json(e.*))
      FROM "UserExperience" e
      WHERE e.user_id = p_user_id AND e.show_on_profile = TRUE
      ORDER BY e.is_current DESC, e.start_date DESC
    )
  ) INTO v_result
  FROM "User" u
  WHERE u.id = p_user_id;
  
  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_user_profile_with_media"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_spending"("p_user_id" "uuid", "p_start_date" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_end_date" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH scoped AS (
    SELECT
      amount_total,
      refunded_amount,
      payment_status
    FROM "Payment"
    WHERE payer_id = p_user_id
      AND (p_start_date IS NULL OR created_at >= p_start_date)
      AND (p_end_date IS NULL OR created_at <= p_end_date)
  ),
  spending AS (
    SELECT
      COUNT(*) as total_payments,
      COALESCE(SUM(amount_total), 0) as total_spent,
      COALESCE(SUM(CASE WHEN payment_status IN ('captured_hold', 'transfer_scheduled', 'transfer_pending', 'transferred', 'refund_pending', 'refunded_partial', 'refunded_full', 'disputed', 'succeeded', 'processing') THEN GREATEST(0, amount_total - COALESCE(refunded_amount, 0)) ELSE 0 END), 0) as total_paid,
      COALESCE(SUM(COALESCE(refunded_amount, 0)), 0) as total_refunded
    FROM scoped
  )
  SELECT jsonb_build_object(
    'totalPayments', total_payments,
    'totalSpent', total_spent,
    'totalPaid', total_paid,
    'totalRefunded', total_refunded,
    'currency', 'USD'
  ) INTO v_result
  FROM spending;
  
  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_user_spending"("p_user_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_storage_stats"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_stats JSONB;
BEGIN
  SELECT jsonb_build_object(
    'totalFiles', COUNT(*),
    'totalSize', COALESCE(SUM(file_size), 0),
    'byType', jsonb_object_agg(
      file_type,
      jsonb_build_object(
        'count', COUNT(*),
        'size', SUM(file_size)
      )
    )
  ) INTO v_stats
  FROM "File"
  WHERE user_id = p_user_id AND is_deleted = FALSE
  GROUP BY user_id;
  
  RETURN COALESCE(v_stats, '{}'::jsonb);
END;
$$;


ALTER FUNCTION "public"."get_user_storage_stats"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_stripe_account"("p_user_id" "uuid") RETURNS TABLE("stripe_account_id" character varying, "charges_enabled" boolean, "payouts_enabled" boolean, "onboarding_completed" boolean)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sa.stripe_account_id,
    sa.charges_enabled,
    sa.payouts_enabled,
    sa.onboarding_completed
  FROM "StripeAccount" sa
  WHERE sa.user_id = p_user_id
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_user_stripe_account"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_total_earned"("p_user_id" "uuid") RETURNS numeric
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_total DECIMAL;
BEGIN
  SELECT COALESCE(SUM(payout_amount), 0) INTO v_total
  FROM "Mail"
  WHERE 
    recipient_user_id = p_user_id
    AND type = 'ad'
    AND viewed = true
    AND payout_status IN ('pending', 'paid');
  
  RETURN v_total;
END;
$$;


ALTER FUNCTION "public"."get_user_total_earned"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_home_permission"("p_home_id" "uuid", "p_perm" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    -- Owner bypass
    EXISTS (
      SELECT 1 FROM "Home"
      WHERE id = p_home_id AND owner_id = auth.uid()
    )
    OR COALESCE(
      (
        SELECT CASE p_perm
          WHEN 'manage_home'    THEN ho.can_manage_home
          WHEN 'manage_finance' THEN ho.can_manage_finance
          WHEN 'manage_access'  THEN ho.can_manage_access
          WHEN 'manage_tasks'   THEN ho.can_manage_tasks
          WHEN 'view_sensitive' THEN ho.can_view_sensitive
          ELSE false
        END
        FROM "HomeOccupancy" ho
        WHERE ho.home_id = p_home_id
          AND ho.user_id = auth.uid()
          AND ho.is_active = true
        LIMIT 1
      ),
      false
    );
$$;


ALTER FUNCTION "public"."has_home_permission"("p_home_id" "uuid", "p_perm" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."home_can_see_visibility"("p_home_id" "uuid", "p_vis" "public"."home_record_visibility", "p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select case p_vis
    when 'public' then true
    when 'members' then public.home_is_active_member(p_home_id, p_user_id)
    when 'managers' then public.home_has_role_at_least(p_home_id, 'manager'::public.home_role_base, p_user_id)
    when 'sensitive' then public.home_has_permission(p_home_id, 'sensitive.view'::public.home_permission, p_user_id)
  end;
$$;


ALTER FUNCTION "public"."home_can_see_visibility"("p_home_id" "uuid", "p_vis" "public"."home_record_visibility", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."home_get_user_permissions"("p_home_id" "uuid", "p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS "text"[]
    LANGUAGE "plpgsql" STABLE
    AS $$
declare
  v_role public.home_role_base;
  v_perms text[];
begin
  -- Get user's role_base
  select ho.role_base
    into v_role
  from public."HomeOccupancy" ho
  where ho.home_id = p_home_id
    and ho.user_id = p_user_id
    and ho.is_active = true
    and (ho.start_at is null or ho.start_at <= now())
    and (ho.end_at is null or ho.end_at > now())
  limit 1;

  if v_role is null then
    return '{}'::text[];
  end if;

  -- Get base role permissions
  select array_agg(hrp.permission::text)
    into v_perms
  from public."HomeRolePermission" hrp
  where hrp.role_base = v_role and hrp.allowed = true;

  v_perms := coalesce(v_perms, '{}'::text[]);

  -- Apply overrides: add granted, remove denied
  -- Add explicit grants
  v_perms := v_perms || coalesce((
    select array_agg(hpo.permission::text)
    from public."HomePermissionOverride" hpo
    where hpo.home_id = p_home_id
      and hpo.user_id = p_user_id
      and hpo.allowed = true
  ), '{}'::text[]);

  -- Remove explicit denies
  v_perms := array(
    select unnest(v_perms)
    except
    select hpo.permission::text
    from public."HomePermissionOverride" hpo
    where hpo.home_id = p_home_id
      and hpo.user_id = p_user_id
      and hpo.allowed = false
  );

  -- Deduplicate
  v_perms := array(select distinct unnest(v_perms));

  return v_perms;
end $$;


ALTER FUNCTION "public"."home_get_user_permissions"("p_home_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."home_has_permission"("p_home_id" "uuid", "p_perm" "public"."home_permission", "p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "plpgsql" STABLE
    AS $$
declare
  v_role public.home_role_base;
  v_override boolean;
  v_base boolean;
begin
  if p_user_id is null then
    return false;
  end if;

  select ho.role_base
    into v_role
  from public."HomeOccupancy" ho
  where ho.home_id=p_home_id and ho.user_id=p_user_id and ho.is_active=true
    and (ho.start_at is null or ho.start_at <= now())
    and (ho.end_at is null or ho.end_at > now())
  limit 1;

  if v_role is null then
    return false;
  end if;

  select hpo.allowed
    into v_override
  from public."HomePermissionOverride" hpo
  where hpo.home_id=p_home_id and hpo.user_id=p_user_id and hpo.permission=p_perm
  limit 1;

  if v_override is not null then
    return v_override;
  end if;

  select exists (
    select 1 from public."HomeRolePermission" hrp
    where hrp.role_base=v_role and hrp.permission=p_perm and hrp.allowed=true
  ) into v_base;

  return coalesce(v_base,false);
end $$;


ALTER FUNCTION "public"."home_has_permission"("p_home_id" "uuid", "p_perm" "public"."home_permission", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."home_has_role_at_least"("p_home_id" "uuid", "p_min_role" "public"."home_role_base", "p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select public.home_is_active_member(p_home_id, p_user_id)
     and public.home_role_rank(public.home_my_role(p_home_id, p_user_id)) >= public.home_role_rank(p_min_role);
$$;


ALTER FUNCTION "public"."home_has_role_at_least"("p_home_id" "uuid", "p_min_role" "public"."home_role_base", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."home_has_scoped_grant"("p_home_id" "uuid", "p_resource_type" "text", "p_resource_id" "uuid", "p_need" "text", "p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1
    from public."HomeScopedGrant" g
    where g.home_id = p_home_id
      and g.grantee_user_id = p_user_id
      and g.resource_type = p_resource_type
      and g.resource_id = p_resource_id
      and (g.end_at is null or g.end_at > now())
      and (case p_need
            when 'view' then g.can_view
            when 'edit' then g.can_edit
            when 'upload' then g.can_upload
            else false
          end)
  );
$$;


ALTER FUNCTION "public"."home_has_scoped_grant"("p_home_id" "uuid", "p_resource_type" "text", "p_resource_id" "uuid", "p_need" "text", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."home_is_active_member"("p_home_id" "uuid", "p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1
    from public."HomeOccupancy" ho
    where ho.home_id = p_home_id
      and ho.user_id = p_user_id
      and ho.is_active = true
      and (ho.start_at is null or ho.start_at <= now())
      and (ho.end_at is null or ho.end_at > now())
  );
$$;


ALTER FUNCTION "public"."home_is_active_member"("p_home_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."home_member_can"("p_home_id" "uuid", "p_perm" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce((
    select case p_perm
      when 'manage_home'      then ho."can_manage_home"
      when 'manage_finance'   then ho."can_manage_finance"
      when 'manage_access'    then ho."can_manage_access"
      when 'manage_tasks'     then ho."can_manage_tasks"
      when 'view_sensitive'   then ho."can_view_sensitive"
      else false
    end
    from public."HomeOccupancy" ho
    where ho."home_id" = p_home_id
      and ho."user_id" = auth.uid()
      and ho."is_active" = true
    limit 1
  ), false);
$$;


ALTER FUNCTION "public"."home_member_can"("p_home_id" "uuid", "p_perm" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."home_my_role"("p_home_id" "uuid", "p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS "public"."home_role_base"
    LANGUAGE "sql" STABLE
    AS $$
  select coalesce(
    (select ho.role_base
     from public."HomeOccupancy" ho
     where ho.home_id=p_home_id and ho.user_id=p_user_id and ho.is_active=true
       and (ho.start_at is null or ho.start_at <= now())
       and (ho.end_at is null or ho.end_at > now())
     limit 1),
    'guest'::public.home_role_base
  );
$$;


ALTER FUNCTION "public"."home_my_role"("p_home_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."home_role_rank"("p_role" "public"."home_role_base") RETURNS integer
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select case p_role
    when 'guest' then 10
    when 'restricted_member' then 20
    when 'member' then 30
    when 'manager' then 40
    when 'admin' then 50
    when 'owner' then 60
  end;
$$;


ALTER FUNCTION "public"."home_role_rank"("p_role" "public"."home_role_base") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_comment_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  UPDATE "Post"
  SET comment_count = comment_count + 1
  WHERE id = NEW.post_id;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."increment_comment_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_file_access"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  UPDATE "File"
  SET 
    access_count = access_count + 1,
    last_accessed_at = NEW.accessed_at
  WHERE id = NEW.file_id;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."increment_file_access"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_unread_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  UPDATE "ChatParticipant"
  SET unread_count = unread_count + 1
  WHERE 
    room_id = NEW.room_id 
    AND user_id != NEW.user_id
    AND is_active = TRUE;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."increment_unread_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_unread_count"("p_room_id" "uuid", "p_exclude_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE "ChatParticipant"
  SET unread_count = unread_count + 1
  WHERE room_id = p_room_id
    AND user_id != p_exclude_user_id
    AND is_active = true;
END;
$$;


ALTER FUNCTION "public"."increment_unread_count"("p_room_id" "uuid", "p_exclude_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_business_team_member"("p_business_user_id" "uuid", "p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT exists (
    SELECT 1
    FROM public."BusinessTeam"
    WHERE business_user_id = p_business_user_id
      AND user_id = p_user_id
      AND is_active = true
  );
$$;


ALTER FUNCTION "public"."is_business_team_member"("p_business_user_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_friends"("a" "uuid", "b" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1
    from "public"."Relationship" r
    where r.status = 'accepted'
      and (
        (r.requester_id = a and r.addressee_id = b)
        or
        (r.requester_id = b and r.addressee_id = a)
      )
  );
$$;


ALTER FUNCTION "public"."is_friends"("a" "uuid", "b" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_home_member"("p_home_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM "HomeOccupancy"
    WHERE home_id = p_home_id
      AND user_id = auth.uid()
      AND is_active = true
  )
  OR EXISTS (
    SELECT 1 FROM "Home"
    WHERE id = p_home_id
      AND owner_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_home_member"("p_home_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."listing_set_location_geog"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  ELSE
    NEW.location := NULL;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."listing_set_location_geog"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_mail_viewed"("p_mail_id" "uuid", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_mail public."Mail"%ROWTYPE;
  v_now timestamp with time zone := now();
BEGIN
  SELECT *
  INTO v_mail
  FROM public."Mail"
  WHERE id = p_mail_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mail not found');
  END IF;

  IF NOT public.can_view_mail(v_mail.recipient_user_id, v_mail.recipient_home_id, p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;

  IF v_mail.viewed THEN
    UPDATE public."Mail"
    SET last_opened_at = v_now
    WHERE id = p_mail_id;

    RETURN jsonb_build_object(
      'success', true,
      'alreadyViewed', true,
      'payout', v_mail.payout_amount,
      'viewedAt', v_mail.viewed_at
    );
  END IF;

  UPDATE public."Mail"
  SET viewed = true,
      viewed_at = v_now,
      first_opened_at = COALESCE(first_opened_at, v_now),
      last_opened_at = v_now,
      view_count = view_count + 1
  WHERE id = p_mail_id;

  INSERT INTO public."MailAction"(mail_id, user_id, action_type, metadata)
  VALUES (
    p_mail_id,
    p_user_id,
    'viewed',
    jsonb_build_object('source', 'mark_mail_viewed')
  );

  IF v_mail.type = 'ad' AND v_mail.payout_amount IS NOT NULL THEN
    UPDATE public."Mail"
    SET payout_status = 'pending'
    WHERE id = p_mail_id
      AND payout_status IS NULL;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'alreadyViewed', false,
    'payout', v_mail.payout_amount,
    'viewedAt', v_now
  );
END;
$$;


ALTER FUNCTION "public"."mark_mail_viewed"("p_mail_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_messages_read"("p_room_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  UPDATE "ChatParticipant"
  SET 
    last_read_at = NOW(),
    unread_count = 0
  WHERE room_id = p_room_id AND user_id = p_user_id;
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."mark_messages_read"("p_room_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_address_hash"("p_line1" "text", "p_line2" "text", "p_city" "text", "p_state" "text", "p_postal" "text", "p_country" "text" DEFAULT 'US'::"text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
    v_norm text;
BEGIN
    v_norm := lower(trim(coalesce(p_line1, '')))
        || '|' || lower(trim(coalesce(p_line2, '')))
        || '|' || lower(trim(coalesce(p_city, '')))
        || '|' || lower(trim(coalesce(p_state, '')))
        || '|' || trim(coalesce(p_postal, ''))
        || '|' || lower(trim(coalesce(p_country, 'us')));
    RETURN encode(digest(v_norm, 'sha256'), 'hex');
END;
$$;


ALTER FUNCTION "public"."normalize_address_hash"("p_line1" "text", "p_line2" "text", "p_city" "text", "p_state" "text", "p_postal" "text", "p_country" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."open_mail_read_session"("p_mail_id" "uuid", "p_user_id" "uuid", "p_client_meta" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_session public."MailReadSession"%ROWTYPE;
  v_mail public."Mail"%ROWTYPE;
BEGIN
  SELECT *
  INTO v_mail
  FROM public."Mail"
  WHERE id = p_mail_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mail not found');
  END IF;

  IF NOT public.can_view_mail(v_mail.recipient_user_id, v_mail.recipient_home_id, p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;

  SELECT *
  INTO v_session
  FROM public."MailReadSession"
  WHERE mail_id = p_mail_id
    AND user_id = p_user_id
    AND session_ended_at IS NULL
  LIMIT 1;

  IF FOUND THEN
    UPDATE public."MailReadSession"
    SET session_last_seen_at = now(),
        client_meta = COALESCE(client_meta, '{}'::jsonb) || COALESCE(p_client_meta, '{}'::jsonb),
        updated_at = now()
    WHERE id = v_session.id
    RETURNING * INTO v_session;
  ELSE
    INSERT INTO public."MailReadSession"(mail_id, user_id, client_meta)
    VALUES (p_mail_id, p_user_id, COALESCE(p_client_meta, '{}'::jsonb))
    RETURNING * INTO v_session;
  END IF;

  -- Keep viewed semantics compatible with existing app behavior.
  UPDATE public."Mail"
  SET viewed = TRUE,
      viewed_at = COALESCE(viewed_at, now()),
      first_opened_at = COALESCE(first_opened_at, now()),
      last_opened_at = now(),
      view_count = view_count + 1
  WHERE id = p_mail_id;

  INSERT INTO public."MailEngagementEvent"(mail_id, user_id, session_id, event_type, event_meta)
  VALUES (p_mail_id, p_user_id, v_session.id, 'open', COALESCE(p_client_meta, '{}'::jsonb));

  INSERT INTO public."MailAction"(mail_id, user_id, action_type, metadata)
  VALUES (
    p_mail_id,
    p_user_id,
    'opened',
    jsonb_build_object('sessionId', v_session.id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'sessionId', v_session.id,
    'mailId', p_mail_id
  );
END;
$$;


ALTER FUNCTION "public"."open_mail_read_session"("p_mail_id" "uuid", "p_user_id" "uuid", "p_client_meta" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."post_set_location_geog"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  ELSE
    NEW.location := NULL;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."post_set_location_geog"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."soft_delete_file"("p_file_id" "uuid", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_file RECORD;
BEGIN
  -- Get file
  SELECT * INTO v_file
  FROM "File"
  WHERE id = p_file_id AND user_id = p_user_id AND is_deleted = FALSE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'File not found or already deleted');
  END IF;
  
  -- Mark as deleted
  UPDATE "File"
  SET 
    is_deleted = TRUE,
    deleted_at = NOW(),
    updated_at = NOW()
  WHERE id = p_file_id;
  
  -- Update quota
  UPDATE "FileQuota"
  SET 
    storage_used = GREATEST(storage_used - v_file.file_size, 0),
    file_count = GREATEST(file_count - 1, 0),
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'fileId', p_file_id,
    'freedSpace', v_file.file_size
  );
END;
$$;


ALTER FUNCTION "public"."soft_delete_file"("p_file_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_followers_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE "User" SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE "User" SET followers_count = GREATEST(followers_count - 1, 0) WHERE id = OLD.following_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."sync_followers_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_home_access_secret_value"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if (tg_op = 'INSERT' or tg_op = 'UPDATE') then
    if coalesce(new.secret_value,'') not in ('', 'EMPTY') then
      insert into public."HomeAccessSecretValue"(access_secret_id, secret_value, updated_at)
      values (new.id, new.secret_value, now())
      on conflict (access_secret_id) do update
        set secret_value = excluded.secret_value,
            updated_at = now();

      new.secret_value := '';
    end if;
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."sync_home_access_secret_value"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_home_issue_sensitive"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if (tg_op = 'INSERT' or tg_op = 'UPDATE') then
    if coalesce(new.secret_fixes,'') <> '' then
      insert into public."HomeIssueSensitive"(issue_id, secret_fixes, updated_at)
      values (new.id, new.secret_fixes, now())
      on conflict (issue_id) do update
        set secret_fixes = excluded.secret_fixes,
            updated_at = now();

      new.secret_fixes := null;
    end if;
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."sync_home_issue_sensitive"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_post_comment_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE "Post" SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE "Post" SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."sync_post_comment_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_post_share_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE "Post" SET share_count = share_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE "Post" SET share_count = GREATEST(share_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."sync_post_share_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_listing_save"("p_listing_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_exists boolean;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM "ListingSave"
        WHERE listing_id = p_listing_id AND user_id = p_user_id
    ) INTO v_exists;

    IF v_exists THEN
        DELETE FROM "ListingSave"
        WHERE listing_id = p_listing_id AND user_id = p_user_id;

        UPDATE "Listing" SET save_count = GREATEST(save_count - 1, 0)
        WHERE id = p_listing_id;

        RETURN false; -- unsaved
    ELSE
        INSERT INTO "ListingSave" (listing_id, user_id) VALUES (p_listing_id, p_user_id);

        UPDATE "Listing" SET save_count = save_count + 1
        WHERE id = p_listing_id;

        RETURN true; -- saved
    END IF;
END;
$$;


ALTER FUNCTION "public"."toggle_listing_save"("p_listing_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_post_like"("p_post_id" "uuid", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_exists BOOLEAN;
  v_new_count INT;
BEGIN
  -- Check if like exists
  SELECT EXISTS(
    SELECT 1 FROM "PostLike" 
    WHERE post_id = p_post_id AND user_id = p_user_id
  ) INTO v_exists;
  
  IF v_exists THEN
    -- Unlike
    DELETE FROM "PostLike" 
    WHERE post_id = p_post_id AND user_id = p_user_id;
    
    UPDATE "Post" 
    SET like_count = GREATEST(like_count - 1, 0)
    WHERE id = p_post_id
    RETURNING like_count INTO v_new_count;
    
    RETURN jsonb_build_object(
      'liked', false,
      'likeCount', v_new_count
    );
  ELSE
    -- Like
    INSERT INTO "PostLike" (post_id, user_id)
    VALUES (p_post_id, p_user_id);
    
    UPDATE "Post" 
    SET like_count = like_count + 1
    WHERE id = p_post_id
    RETURNING like_count INTO v_new_count;
    
    RETURN jsonb_build_object(
      'liked', true,
      'likeCount', v_new_count
    );
  END IF;
END;
$$;


ALTER FUNCTION "public"."toggle_post_like"("p_post_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_post_save"("p_post_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_exists boolean;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM "PostSave"
        WHERE post_id = p_post_id AND user_id = p_user_id
    ) INTO v_exists;

    IF v_exists THEN
        DELETE FROM "PostSave"
        WHERE post_id = p_post_id AND user_id = p_user_id;
        RETURN false;
    ELSE
        INSERT INTO "PostSave" (post_id, user_id) VALUES (p_post_id, p_user_id);
        RETURN true;
    END IF;
END;
$$;


ALTER FUNCTION "public"."toggle_post_save"("p_post_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_post_unique_view"("p_post_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_row_count integer := 0;
BEGIN
  IF p_post_id IS NULL OR p_user_id IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO "PostView" ("post_id", "user_id")
  VALUES (p_post_id, p_user_id)
  ON CONFLICT ("post_id", "user_id") DO NOTHING;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;

  IF v_row_count > 0 THEN
    UPDATE "Post"
    SET "view_count" = COALESCE("view_count", 0) + 1
    WHERE "id" = p_post_id;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;


ALTER FUNCTION "public"."record_post_unique_view"("p_post_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trim_recent_locations"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM public."UserRecentLocation"
  WHERE id IN (
    SELECT id
    FROM public."UserRecentLocation"
    WHERE user_id = NEW.user_id
    ORDER BY used_at DESC
    OFFSET 5
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trim_recent_locations"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_payment_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_payment_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_quota_after_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Decrement storage and file count
  UPDATE "FileQuota"
  SET 
    storage_used = GREATEST(storage_used - OLD.file_size, 0),
    file_count = GREATEST(file_count - 1, 0),
    updated_at = NOW()
  WHERE user_id = OLD.user_id;
  
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."update_quota_after_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_quota_after_upload"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Increment storage and file count
  INSERT INTO "FileQuota" (user_id, storage_used, file_count, uploads_today)
  VALUES (NEW.user_id, NEW.file_size, 1, 1)
  ON CONFLICT (user_id) DO UPDATE SET
    storage_used = "FileQuota".storage_used + NEW.file_size,
    file_count = "FileQuota".file_count + 1,
    uploads_today = CASE
      WHEN "FileQuota".uploads_today_reset_at < NOW() THEN 1
      ELSE "FileQuota".uploads_today + 1
    END,
    uploads_today_reset_at = CASE
      WHEN "FileQuota".uploads_today_reset_at < NOW() 
      THEN DATE_TRUNC('day', NOW() + INTERVAL '1 day')
      ELSE "FileQuota".uploads_today_reset_at
    END,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_quota_after_upload"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_profile_picture"("p_user_id" "uuid", "p_file_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_file RECORD;
  v_old_file_id UUID;
BEGIN
  -- Get file details
  SELECT * INTO v_file
  FROM "File"
  WHERE id = p_file_id AND user_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'File not found');
  END IF;
  
  -- Get old profile picture ID
  SELECT profile_picture_file_id INTO v_old_file_id
  FROM "User"
  WHERE id = p_user_id;
  
  -- Update user profile
  UPDATE "User"
  SET 
    profile_picture_file_id = p_file_id,
    profile_picture_url = v_file.file_url,
    updated_at = NOW()
  WHERE id = p_user_id;
  
  -- Mark file as profile picture
  UPDATE "File"
  SET 
    file_type = 'profile_picture',
    profile_user_id = p_user_id
  WHERE id = p_file_id;
  
  -- Optionally delete old profile picture
  IF v_old_file_id IS NOT NULL AND v_old_file_id != p_file_id THEN
    UPDATE "File"
    SET is_deleted = TRUE, deleted_at = NOW()
    WHERE id = v_old_file_id;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'profilePictureUrl', v_file.file_url
  );
END;
$$;


ALTER FUNCTION "public"."update_user_profile_picture"("p_user_id" "uuid", "p_file_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_rating"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_target_id uuid;
    v_avg numeric(3,2);
    v_count integer;
BEGIN
    -- Determine which user to recalculate for
    IF TG_OP = 'DELETE' THEN
        v_target_id := OLD.reviewee_id;
    ELSE
        v_target_id := NEW.reviewee_id;
    END IF;

    -- Recalculate
    SELECT COALESCE(AVG(rating)::numeric(3,2), NULL), COUNT(*)
    INTO v_avg, v_count
    FROM "Review"
    WHERE reviewee_id = v_target_id;

    UPDATE "User"
    SET average_rating = v_avg,
        review_count = v_count,
        updated_at = now()
    WHERE id = v_target_id;

    -- On UPDATE, if reviewee changed, also update the old reviewee
    IF TG_OP = 'UPDATE' AND OLD.reviewee_id IS DISTINCT FROM NEW.reviewee_id THEN
        SELECT COALESCE(AVG(rating)::numeric(3,2), NULL), COUNT(*)
        INTO v_avg, v_count
        FROM "Review"
        WHERE reviewee_id = OLD.reviewee_id;

        UPDATE "User"
        SET average_rating = v_avg,
            review_count = v_count,
            updated_at = now()
        WHERE id = OLD.reviewee_id;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_user_rating"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."WalletTransaction" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "wallet_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" character varying(30) NOT NULL,
    "amount" bigint NOT NULL,
    "direction" character varying(6) NOT NULL,
    "balance_before" bigint NOT NULL,
    "balance_after" bigint NOT NULL,
    "description" "text",
    "currency" character varying(3) DEFAULT 'usd'::character varying NOT NULL,
    "payment_id" "uuid",
    "gig_id" "uuid",
    "counterparty_id" "uuid",
    "stripe_payment_intent_id" character varying(255),
    "stripe_transfer_id" character varying(255),
    "idempotency_key" character varying(255),
    "status" character varying(20) DEFAULT 'completed'::character varying NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "WalletTransaction_amount_pos" CHECK (("amount" > 0)),
    CONSTRAINT "WalletTransaction_direction_check" CHECK ((("direction")::"text" = ANY ((ARRAY['credit'::character varying, 'debit'::character varying])::"text"[]))),
    CONSTRAINT "WalletTransaction_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['completed'::character varying, 'pending'::character varying, 'failed'::character varying, 'reversed'::character varying])::"text"[]))),
    CONSTRAINT "WalletTransaction_type_check" CHECK ((("type")::"text" = ANY ((ARRAY['deposit'::character varying, 'withdrawal'::character varying, 'gig_income'::character varying, 'gig_payment'::character varying, 'tip_income'::character varying, 'tip_sent'::character varying, 'refund'::character varying, 'adjustment'::character varying, 'transfer_in'::character varying, 'transfer_out'::character varying, 'cancellation_fee'::character varying])::"text"[])))
);


ALTER TABLE "public"."WalletTransaction" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_credit"("p_user_id" "uuid", "p_amount" bigint, "p_type" character varying, "p_description" "text" DEFAULT NULL::"text", "p_payment_id" "uuid" DEFAULT NULL::"uuid", "p_gig_id" "uuid" DEFAULT NULL::"uuid", "p_counterparty_id" "uuid" DEFAULT NULL::"uuid", "p_stripe_pi_id" character varying DEFAULT NULL::character varying, "p_idempotency_key" character varying DEFAULT NULL::character varying, "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "public"."WalletTransaction"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_wallet "public"."Wallet";
  v_tx     "public"."WalletTransaction";
  v_balance_before bigint;
  v_balance_after  bigint;
BEGIN
  -- Ensure wallet exists
  SELECT * INTO v_wallet FROM get_or_create_wallet(p_user_id);

  -- Check idempotency
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_tx FROM "WalletTransaction"
    WHERE idempotency_key = p_idempotency_key;
    IF v_tx IS NOT NULL THEN
      RETURN v_tx;  -- Already processed
    END IF;
  END IF;

  -- Lock the wallet row for update (prevents concurrent modifications)
  SELECT * INTO v_wallet FROM "Wallet"
  WHERE id = v_wallet.id
  FOR UPDATE;

  IF v_wallet.frozen THEN
    RAISE EXCEPTION 'Wallet is frozen';
  END IF;

  v_balance_before := v_wallet.balance;
  v_balance_after  := v_wallet.balance + p_amount;

  -- Update balance
  UPDATE "Wallet"
  SET balance = v_balance_after,
      lifetime_received = CASE
        WHEN p_type IN ('gig_income', 'tip_income') THEN lifetime_received + p_amount
        ELSE lifetime_received
      END,
      lifetime_deposits = CASE
        WHEN p_type = 'deposit' THEN lifetime_deposits + p_amount
        ELSE lifetime_deposits
      END,
      updated_at = now()
  WHERE id = v_wallet.id;

  -- Insert ledger entry
  INSERT INTO "WalletTransaction" (
    wallet_id, user_id, type, amount, direction,
    balance_before, balance_after, description,
    payment_id, gig_id, counterparty_id,
    stripe_payment_intent_id, idempotency_key, metadata
  ) VALUES (
    v_wallet.id, p_user_id, p_type, p_amount, 'credit',
    v_balance_before, v_balance_after, p_description,
    p_payment_id, p_gig_id, p_counterparty_id,
    p_stripe_pi_id, p_idempotency_key, p_metadata
  )
  RETURNING * INTO v_tx;

  RETURN v_tx;
END;
$$;


ALTER FUNCTION "public"."wallet_credit"("p_user_id" "uuid", "p_amount" bigint, "p_type" character varying, "p_description" "text", "p_payment_id" "uuid", "p_gig_id" "uuid", "p_counterparty_id" "uuid", "p_stripe_pi_id" character varying, "p_idempotency_key" character varying, "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_debit"("p_user_id" "uuid", "p_amount" bigint, "p_type" character varying, "p_description" "text" DEFAULT NULL::"text", "p_payment_id" "uuid" DEFAULT NULL::"uuid", "p_gig_id" "uuid" DEFAULT NULL::"uuid", "p_counterparty_id" "uuid" DEFAULT NULL::"uuid", "p_stripe_transfer" character varying DEFAULT NULL::character varying, "p_idempotency_key" character varying DEFAULT NULL::character varying, "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "public"."WalletTransaction"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_wallet "public"."Wallet";
  v_tx     "public"."WalletTransaction";
  v_balance_before bigint;
  v_balance_after  bigint;
BEGIN
  -- Ensure wallet exists
  SELECT * INTO v_wallet FROM get_or_create_wallet(p_user_id);

  -- Check idempotency
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_tx FROM "WalletTransaction"
    WHERE idempotency_key = p_idempotency_key;
    IF v_tx IS NOT NULL THEN
      RETURN v_tx;  -- Already processed
    END IF;
  END IF;

  -- Lock the wallet row for update
  SELECT * INTO v_wallet FROM "Wallet"
  WHERE id = v_wallet.id
  FOR UPDATE;

  IF v_wallet.frozen THEN
    RAISE EXCEPTION 'Wallet is frozen';
  END IF;

  v_balance_before := v_wallet.balance;
  v_balance_after  := v_wallet.balance - p_amount;

  -- Check sufficient balance
  IF v_balance_after < 0 THEN
    RAISE EXCEPTION 'Insufficient wallet balance. Available: %, Required: %',
      v_wallet.balance, p_amount;
  END IF;

  -- Update balance
  UPDATE "Wallet"
  SET balance = v_balance_after,
      lifetime_spent = CASE
        WHEN p_type IN ('gig_payment', 'tip_sent') THEN lifetime_spent + p_amount
        ELSE lifetime_spent
      END,
      lifetime_withdrawals = CASE
        WHEN p_type = 'withdrawal' THEN lifetime_withdrawals + p_amount
        ELSE lifetime_withdrawals
      END,
      updated_at = now()
  WHERE id = v_wallet.id;

  -- Insert ledger entry
  INSERT INTO "WalletTransaction" (
    wallet_id, user_id, type, amount, direction,
    balance_before, balance_after, description,
    payment_id, gig_id, counterparty_id,
    stripe_transfer_id, idempotency_key, metadata
  ) VALUES (
    v_wallet.id, p_user_id, p_type, p_amount, 'debit',
    v_balance_before, v_balance_after, p_description,
    p_payment_id, p_gig_id, p_counterparty_id,
    p_stripe_transfer, p_idempotency_key, p_metadata
  )
  RETURNING * INTO v_tx;

  RETURN v_tx;
END;
$$;


ALTER FUNCTION "public"."wallet_debit"("p_user_id" "uuid", "p_amount" bigint, "p_type" character varying, "p_description" "text", "p_payment_id" "uuid", "p_gig_id" "uuid", "p_counterparty_id" "uuid", "p_stripe_transfer" character varying, "p_idempotency_key" character varying, "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_transfer"("p_from_user_id" "uuid", "p_to_user_id" "uuid", "p_amount" bigint, "p_type_debit" character varying, "p_type_credit" character varying, "p_description" "text" DEFAULT NULL::"text", "p_payment_id" "uuid" DEFAULT NULL::"uuid", "p_gig_id" "uuid" DEFAULT NULL::"uuid", "p_idempotency_key" character varying DEFAULT NULL::character varying, "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS TABLE("debit_tx" "uuid", "credit_tx" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_debit_tx  "public"."WalletTransaction";
  v_credit_tx "public"."WalletTransaction";
  v_debit_key varchar(255);
  v_credit_key varchar(255);
BEGIN
  -- Create paired idempotency keys
  v_debit_key  := CASE WHEN p_idempotency_key IS NOT NULL
                       THEN p_idempotency_key || ':debit' ELSE NULL END;
  v_credit_key := CASE WHEN p_idempotency_key IS NOT NULL
                       THEN p_idempotency_key || ':credit' ELSE NULL END;

  -- Debit the payer
  SELECT * INTO v_debit_tx FROM wallet_debit(
    p_from_user_id, p_amount, p_type_debit, p_description,
    p_payment_id, p_gig_id, p_to_user_id, NULL, v_debit_key, p_metadata
  );

  -- Credit the payee
  SELECT * INTO v_credit_tx FROM wallet_credit(
    p_to_user_id, p_amount, p_type_credit, p_description,
    p_payment_id, p_gig_id, p_from_user_id, NULL, v_credit_key, p_metadata
  );

  RETURN QUERY SELECT v_debit_tx.id, v_credit_tx.id;
END;
$$;


ALTER FUNCTION "public"."wallet_transfer"("p_from_user_id" "uuid", "p_to_user_id" "uuid", "p_amount" bigint, "p_type_debit" character varying, "p_type_credit" character varying, "p_description" "text", "p_payment_id" "uuid", "p_gig_id" "uuid", "p_idempotency_key" character varying, "p_metadata" "jsonb") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."AdCampaign" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_user_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "target_cities" "text"[] DEFAULT '{}'::"text"[],
    "target_states" "text"[] DEFAULT '{}'::"text"[],
    "target_zipcodes" "text"[] DEFAULT '{}'::"text"[],
    "target_location" "public"."geography"(Point,4326),
    "target_radius_meters" integer,
    "budget_total" numeric(10,2),
    "budget_remaining" numeric(10,2),
    "price_per_view" numeric(10,2) DEFAULT 0.10,
    "status" character varying(50) DEFAULT 'draft'::character varying,
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    "sent_count" integer DEFAULT 0,
    "viewed_count" integer DEFAULT 0,
    "clicked_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "AdCampaign_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['draft'::character varying, 'active'::character varying, 'paused'::character varying, 'completed'::character varying, 'cancelled'::character varying])::"text"[])))
);


ALTER TABLE "public"."AdCampaign" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."AssetPhoto" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "asset_id" "uuid" NOT NULL,
    "url" "text" NOT NULL,
    "caption" "text",
    "taken_at" timestamp with time zone DEFAULT "now"(),
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."AssetPhoto" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Assignment" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "gig_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "current_status" character varying(50) DEFAULT 'accepted'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "Assignment_current_status_check" CHECK ((("current_status")::"text" = ANY ((ARRAY['accepted'::character varying, 'completed'::character varying, 'cancelled'::character varying])::"text"[])))
);


ALTER TABLE "public"."Assignment" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."AssignmentHistory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "assignment_id" "uuid" NOT NULL,
    "status" character varying(50) NOT NULL,
    "changed_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."AssignmentHistory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."BookletPage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mail_id" "uuid" NOT NULL,
    "page_number" integer NOT NULL,
    "image_url" "text",
    "text_content" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."BookletPage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."BusinessAuditLog" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_user_id" "uuid" NOT NULL,
    "actor_user_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "target_type" "text",
    "target_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."BusinessAuditLog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."BusinessCatalogCategory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "slug" "text",
    "sort_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."BusinessCatalogCategory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."BusinessCatalogItem" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_user_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "kind" "text" DEFAULT 'service'::"text" NOT NULL,
    "price_cents" integer,
    "price_max_cents" integer,
    "price_unit" "text",
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "duration_minutes" integer,
    "image_file_id" "uuid",
    "image_url" "text",
    "gallery_file_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "is_featured" boolean DEFAULT false,
    "available_at_location_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "BusinessCatalogItem_kind_check" CHECK (("kind" = ANY (ARRAY['service'::"text", 'product'::"text", 'menu_item'::"text", 'class'::"text", 'rental'::"text", 'membership'::"text", 'other'::"text"]))),
    CONSTRAINT "BusinessCatalogItem_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'draft'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."BusinessCatalogItem" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."BusinessAddress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "address_line1_norm" "text" NOT NULL,
    "address_line2_norm" "text" DEFAULT '',
    "city_norm" "text" NOT NULL,
    "state" character varying(2) NOT NULL,
    "postal_code" character varying(10) NOT NULL,
    "plus4" character varying(4) DEFAULT '',
    "country" character varying(2) DEFAULT 'US',
    "address_hash" character varying(64) NOT NULL,
    "geocode_lat" double precision,
    "geocode_lng" double precision,
    "location" "public"."geography"(Point,4326),
    "is_multi_tenant" boolean DEFAULT false,
    "is_cmra" boolean DEFAULT false,
    "is_po_box" boolean DEFAULT false,
    "rdi" character varying(1) DEFAULT NULL,
    "place_type" "text" DEFAULT NULL,
    "validation_provider" "text" DEFAULT NULL,
    "validation_granularity" "text" DEFAULT NULL,
    "raw_validation_response" "jsonb" DEFAULT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."BusinessAddress" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."BusinessAddressDecision" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_user_id" "uuid",
    "location_id" "uuid",
    "input_address" "text" NOT NULL,
    "input_address2" "text" DEFAULT '',
    "input_city" "text",
    "input_state" "text",
    "input_zipcode" "text",
    "input_place_id" "text",
    "input_location_intent" "text",
    "decision_status" "public"."business_address_decision_status" NOT NULL,
    "decision_reasons" "text"[] DEFAULT '{}',
    "business_location_type" "public"."business_location_type",
    "capabilities" "jsonb",
    "required_verification" "text"[],
    "canonical_address_id" "uuid",
    "candidates" "jsonb" DEFAULT '[]',
    "raw_validation_response" "jsonb" DEFAULT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."BusinessAddressDecision" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."BusinessFollow" (
    "user_id" "uuid" NOT NULL,
    "business_user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "BusinessFollow_no_self" CHECK (("user_id" <> "business_user_id"))
);


ALTER TABLE "public"."BusinessFollow" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."BusinessHours" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "location_id" "uuid" NOT NULL,
    "day_of_week" smallint NOT NULL,
    "open_time" time without time zone,
    "close_time" time without time zone,
    "is_closed" boolean DEFAULT false NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "BusinessHours_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6)))
);


ALTER TABLE "public"."BusinessHours" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."BusinessLocation" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_user_id" "uuid" NOT NULL,
    "label" "text" DEFAULT 'Main'::"text" NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "address" "text" NOT NULL,
    "address2" "text",
    "city" "text" NOT NULL,
    "state" "text",
    "zipcode" "text",
    "country" "text" DEFAULT 'US'::"text" NOT NULL,
    "location" "public"."geography"(Point,4326),
    "timezone" "text",
    "phone" "text",
    "email" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "address_id" "uuid",
    "address_hash" character varying(64),
    "location_type" "public"."business_location_type" DEFAULT 'unknown',
    "location_verification_tier" "public"."business_location_verification_tier" DEFAULT 'bl0_none',
    "is_customer_facing" boolean DEFAULT false,
    "display_location" "public"."geography"(Point,4326),
    "show_exact_location" boolean DEFAULT false,
    "decision_status" "public"."business_address_decision_status",
    "decision_reasons" "text"[] DEFAULT '{}',
    "capabilities" "jsonb" DEFAULT '{"map_pin": false, "show_in_nearby": false, "receive_mail": true, "enable_payouts": false}',
    "required_verification" "text"[] DEFAULT '{}',
    "service_area" "jsonb",
    "verified_at" timestamp with time zone
);


ALTER TABLE "public"."BusinessLocation" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."BusinessMailingAddress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_user_id" "uuid" NOT NULL,
    "address_id" "uuid",
    "address_line1" "text" NOT NULL,
    "address_line2" "text" DEFAULT '',
    "city" "text" NOT NULL,
    "state" character varying(2) NOT NULL,
    "postal_code" character varying(10) NOT NULL,
    "country" character varying(2) DEFAULT 'US',
    "is_cmra" boolean DEFAULT false,
    "is_po_box" boolean DEFAULT false,
    "is_primary" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."BusinessMailingAddress" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."BusinessPage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_user_id" "uuid" NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "is_default" boolean DEFAULT false NOT NULL,
    "show_in_nav" boolean DEFAULT true NOT NULL,
    "nav_order" integer DEFAULT 0,
    "icon_key" "text",
    "draft_revision" integer DEFAULT 1 NOT NULL,
    "published_revision" integer DEFAULT 0 NOT NULL,
    "published_at" timestamp with time zone,
    "published_by" "uuid",
    "seo" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "theme" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."BusinessPage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."BusinessPageBlock" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "page_id" "uuid" NOT NULL,
    "revision" integer NOT NULL,
    "block_type" "text" NOT NULL,
    "schema_version" integer DEFAULT 1 NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "location_id" "uuid",
    "show_from" timestamp with time zone,
    "show_until" timestamp with time zone,
    "is_visible" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "BusinessPageBlock_block_type_check" CHECK (("block_type" = ANY (ARRAY['hero'::"text", 'text'::"text", 'gallery'::"text", 'catalog_grid'::"text", 'hours'::"text", 'locations_map'::"text", 'cta'::"text", 'faq'::"text", 'reviews'::"text", 'embed'::"text", 'divider'::"text", 'stats'::"text", 'team'::"text", 'contact_form'::"text", 'posts_feed'::"text"])))
);


ALTER TABLE "public"."BusinessPageBlock" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."BusinessPageRevision" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "page_id" "uuid" NOT NULL,
    "revision" integer NOT NULL,
    "blocks_snapshot" "jsonb" NOT NULL,
    "published_by" "uuid",
    "published_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notes" "text"
);


ALTER TABLE "public"."BusinessPageRevision" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."BusinessPermissionOverride" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_user_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "permission" "public"."business_permission" NOT NULL,
    "allowed" boolean NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."BusinessPermissionOverride" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."BusinessPrivate" (
    "business_user_id" "uuid" NOT NULL,
    "legal_name" "text",
    "tax_id_last4" "text",
    "support_email" "text",
    "banking_info" "jsonb" DEFAULT '{}'::"jsonb",
    "legal_doc_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."BusinessPrivate" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."BusinessInvoice" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_user_id" "uuid" NOT NULL,
    "recipient_user_id" "uuid" NOT NULL,
    "gig_id" "uuid",
    "line_items" "jsonb" NOT NULL DEFAULT '[]'::"jsonb",
    "subtotal_cents" integer NOT NULL,
    "fee_cents" integer NOT NULL DEFAULT 0,
    "total_cents" integer NOT NULL,
    "currency" character(3) DEFAULT 'usd' NOT NULL,
    "status" character varying(20) DEFAULT 'draft' NOT NULL,
    "due_date" timestamp with time zone,
    "memo" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "paid_at" timestamp with time zone,
    "payment_id" "uuid",
    "stripe_payment_intent_id" character varying(255),
    CONSTRAINT "BusinessInvoice_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BusinessInvoice_status_check" CHECK (
        ("status")::text = ANY (ARRAY[
            'draft'::text, 'sent'::text, 'viewed'::text,
            'paid'::text, 'void'::text, 'overdue'::text
        ])
    ),
    CONSTRAINT "BusinessInvoice_total_positive" CHECK ("total_cents" > 0)
);


CREATE TABLE IF NOT EXISTS "public"."BusinessProfile" (
    "business_user_id" "uuid" NOT NULL,
    "business_type" "text" DEFAULT 'general'::"text" NOT NULL,
    "categories" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "description" "text",
    "logo_file_id" "uuid",
    "banner_file_id" "uuid",
    "public_email" "text",
    "public_phone" "text",
    "website" "text",
    "social_links" "jsonb" DEFAULT '{}'::"jsonb",
    "primary_location_id" "uuid",
    "founded_year" integer,
    "employee_count" "text",
    "service_area" "jsonb" DEFAULT '{}'::"jsonb",
    "is_published" boolean DEFAULT false NOT NULL,
    "published_at" timestamp with time zone,
    "theme" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "attributes" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "avg_response_minutes" integer,
    "identity_verification_tier" "public"."business_identity_verification_tier" DEFAULT 'bi0_unverified',
    "mailing_address_id" "uuid",
    "personal_user_id" "uuid",
    "active_from" timestamp with time zone,
    "active_until" timestamp with time zone,
    "reminder_count" integer DEFAULT 0
);


ALTER TABLE "public"."BusinessProfile" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."BusinessProfileView" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_user_id" "uuid" NOT NULL,
    "viewer_user_id" "uuid",
    "viewer_home_id" "uuid",
    "source" "text" DEFAULT 'direct_link'::"text",
    "viewed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."BusinessProfileView" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."NeighborhoodSignalCache" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "signal_type" "text" NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "title" "text" NOT NULL,
    "detail" "text",
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "place_key" character varying(255),
    "privacy_level" "text" DEFAULT 'public'::"text",
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."NeighborhoodSignalCache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."BusinessRolePermission" (
    "role_base" "public"."business_role_base" NOT NULL,
    "permission" "public"."business_permission" NOT NULL,
    "allowed" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."BusinessRolePermission" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."BusinessRolePreset" (
    "key" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "role_base" "public"."business_role_base" NOT NULL,
    "grant_perms" "public"."business_permission"[] DEFAULT '{}'::"public"."business_permission"[] NOT NULL,
    "deny_perms" "public"."business_permission"[] DEFAULT '{}'::"public"."business_permission"[] NOT NULL,
    "icon_key" "text",
    "sort_order" integer DEFAULT 100 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."BusinessRolePreset" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."BusinessSpecialHours" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "location_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "label" "text",
    "open_time" time without time zone,
    "close_time" time without time zone,
    "is_closed" boolean DEFAULT false NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."BusinessSpecialHours" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."BusinessTeam" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_user_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role_base" "public"."business_role_base" DEFAULT 'viewer'::"public"."business_role_base" NOT NULL,
    "title" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "invited_by" "uuid",
    "invited_at" timestamp with time zone,
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "left_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."BusinessTeam" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ChatMessage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "message" "text" NOT NULL,
    "type" character varying(50) DEFAULT 'text'::character varying,
    "attachments" "jsonb" DEFAULT '[]'::"jsonb",
    "edited" boolean DEFAULT false,
    "edited_at" timestamp with time zone,
    "deleted" boolean DEFAULT false,
    "deleted_at" timestamp with time zone,
    "reply_to_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "topic_id" "uuid",
    CONSTRAINT "ChatMessage_type_check" CHECK ((("type")::"text" = ANY (ARRAY['text'::"text", 'image'::"text", 'video'::"text", 'file'::"text", 'audio'::"text", 'location'::"text", 'system'::"text", 'gig_offer'::"text", 'listing_offer'::"text"])))
);


ALTER TABLE "public"."ChatMessage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."MessageReaction" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "reaction" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "MessageReaction_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MessageReaction_message_user_reaction_key" UNIQUE ("message_id", "user_id", "reaction"),
    CONSTRAINT "MessageReaction_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."ChatMessage"("id") ON DELETE CASCADE,
    CONSTRAINT "MessageReaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE
);


ALTER TABLE "public"."MessageReaction" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ChatParticipant" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" character varying(50) DEFAULT 'member'::character varying,
    "last_read_at" timestamp with time zone,
    "unread_count" integer DEFAULT 0,
    "notifications_enabled" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "left_at" timestamp with time zone,
    CONSTRAINT "ChatParticipant_role_check" CHECK ((("role")::"text" = ANY ((ARRAY['owner'::character varying, 'admin'::character varying, 'member'::character varying])::"text"[])))
);


ALTER TABLE "public"."ChatParticipant" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ChatRoom" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" character varying(50) NOT NULL,
    "gig_id" "uuid",
    "home_id" "uuid",
    "name" character varying(255),
    "description" "text",
    "is_active" boolean DEFAULT true,
    "max_participants" integer DEFAULT 50,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ChatRoom_check" CHECK ((((("type")::"text" = 'gig'::"text") AND ("gig_id" IS NOT NULL)) OR ((("type")::"text" = 'home'::"text") AND ("home_id" IS NOT NULL)) OR (("type")::"text" = ANY ((ARRAY['direct'::character varying, 'group'::character varying])::"text"[])))),
    CONSTRAINT "ChatRoom_type_check" CHECK ((("type")::"text" = ANY ((ARRAY['gig'::character varying, 'home'::character varying, 'direct'::character varying, 'group'::character varying])::"text"[])))
);


ALTER TABLE "public"."ChatRoom" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ChatTyping" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '00:00:10'::interval)
);


ALTER TABLE "public"."ChatTyping" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."CommentLike" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comment_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."CommentLike" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."CommunityMailItem" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mail_id" "uuid",
    "published_by" "uuid" NOT NULL,
    "home_id" "uuid" NOT NULL,
    "community_type" "text" NOT NULL,
    "published_to" "text" DEFAULT 'neighborhood'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "sender_display" "text",
    "sender_trust" "text",
    "category" "text",
    "verified_sender" boolean DEFAULT false,
    "event_date" "date",
    "rsvp_deadline" "date",
    "map_pin_id" "uuid",
    "views" integer DEFAULT 0,
    "neighbors_received" integer DEFAULT 0,
    "rsvp_count" integer DEFAULT 0,
    "flagged" boolean DEFAULT false,
    "flag_count" integer DEFAULT 0,
    "hidden" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "CommunityMailItem_community_type_check" CHECK (("community_type" = ANY (ARRAY['civic_notice'::"text", 'neighborhood_event'::"text", 'local_business'::"text", 'building_announcement'::"text"]))),
    CONSTRAINT "CommunityMailItem_published_to_check" CHECK (("published_to" = ANY (ARRAY['building'::"text", 'neighborhood'::"text", 'city'::"text"])))
);


ALTER TABLE "public"."CommunityMailItem" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."CommunityReaction" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "community_item_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "reaction_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "CommunityReaction_reaction_type_check" CHECK (("reaction_type" = ANY (ARRAY['acknowledged'::"text", 'will_attend'::"text", 'concerned'::"text", 'thumbs_up'::"text"])))
);


ALTER TABLE "public"."CommunityReaction" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ConversationTopic" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_user_id_1" "uuid" NOT NULL,
    "conversation_user_id_2" "uuid" NOT NULL,
    "topic_type" character varying(50) DEFAULT 'general'::character varying NOT NULL,
    "topic_ref_id" "uuid",
    "title" character varying(255) NOT NULL,
    "status" character varying(50) DEFAULT 'active'::character varying,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_activity_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "ConversationTopic_status_check" CHECK ((("status")::"text" = ANY (ARRAY['active'::"text", 'completed'::"text", 'archived'::"text"]))),
    CONSTRAINT "ConversationTopic_type_check" CHECK ((("topic_type")::"text" = ANY (ARRAY['general'::"text", 'task'::"text", 'listing'::"text", 'delivery'::"text", 'home'::"text", 'business'::"text"]))),
    CONSTRAINT "ConversationTopic_user_order" CHECK (("conversation_user_id_1" < "conversation_user_id_2"))
);


ALTER TABLE "public"."ConversationTopic" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."EarnOffer" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "advertiser_id" "uuid" NOT NULL,
    "business_name" "text" NOT NULL,
    "business_init" "text",
    "business_color" "text",
    "offer_title" "text" NOT NULL,
    "offer_subtitle" "text",
    "offer_code" "text",
    "payout_amount" numeric(10,2) DEFAULT 0.10 NOT NULL,
    "expires_at" timestamp with time zone,
    "status" "text" DEFAULT 'active'::"text",
    "max_redemptions" integer,
    "current_redemptions" integer DEFAULT 0,
    "target_cities" "text"[],
    "target_states" "text"[],
    "target_zipcodes" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "merchant_id" "uuid",
    "merchant_on_pantopus" boolean DEFAULT false,
    "discount_type" "text" DEFAULT 'percentage'::"text",
    "discount_value" numeric(10,2),
    "qr_code_url" "text",
    CONSTRAINT "EarnOffer_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'paused'::"text", 'expired'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."EarnOffer" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."EarnRiskSession" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_start" timestamp with time zone DEFAULT "now"(),
    "opens_count" integer DEFAULT 0,
    "total_dwell_ms" bigint DEFAULT 0,
    "distinct_advertisers" integer DEFAULT 0,
    "saves_count" integer DEFAULT 0,
    "reveals_count" integer DEFAULT 0,
    "risk_score" integer DEFAULT 0,
    "ip_hash" "text",
    "device_fingerprint" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."EarnRiskSession" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."EarnSuspension" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "risk_score" integer,
    "duration_days" integer DEFAULT 7,
    "started_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    "appealed" boolean DEFAULT false,
    "appeal_text" "text",
    "appeal_at" timestamp with time zone,
    "resolved" boolean DEFAULT false,
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."EarnSuspension" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."EarnTransaction" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "offer_id" "uuid" NOT NULL,
    "mail_id" "uuid",
    "amount" numeric(10,2) NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "dwell_ms" integer,
    "opened_at" timestamp with time zone DEFAULT "now"(),
    "verified_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "risk_score" integer DEFAULT 0,
    "risk_flags" "jsonb" DEFAULT '[]'::"jsonb",
    "review_reason" "text",
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    CONSTRAINT "EarnTransaction_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'verified'::"text", 'available'::"text", 'paid'::"text", 'flagged'::"text", 'rejected'::"text", 'under_review'::"text", 'suspended'::"text"])))
);


ALTER TABLE "public"."EarnTransaction" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."EarnWallet" (
    "user_id" "uuid" NOT NULL,
    "available_balance" numeric(10,2) DEFAULT 0,
    "pending_balance" numeric(10,2) DEFAULT 0,
    "lifetime_earned" numeric(10,2) DEFAULT 0,
    "lifetime_saved" numeric(10,2) DEFAULT 0,
    "withdrawal_method" "text",
    "withdrawal_threshold" numeric(10,2) DEFAULT 10.00,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "EarnWallet_withdrawal_method_check" CHECK (("withdrawal_method" = ANY (ARRAY['pantopus_credit'::"text", 'bank_transfer'::"text", 'gift_card'::"text"])))
);


ALTER TABLE "public"."EarnWallet" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."File" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "filename" character varying(255) NOT NULL,
    "original_filename" character varying(255) NOT NULL,
    "file_path" character varying(500) NOT NULL,
    "file_url" "text" NOT NULL,
    "file_size" bigint NOT NULL,
    "mime_type" character varying(100) NOT NULL,
    "file_extension" character varying(10) NOT NULL,
    "file_type" character varying(50) NOT NULL,
    "visibility" character varying(20) DEFAULT 'public'::character varying,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "post_id" "uuid",
    "gig_id" "uuid",
    "home_id" "uuid",
    "comment_id" "uuid",
    "processing_status" character varying(50) DEFAULT 'completed'::character varying,
    "processing_error" "text",
    "is_deleted" boolean DEFAULT false,
    "deleted_at" timestamp with time zone,
    "access_count" integer DEFAULT 0,
    "last_accessed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "profile_user_id" "uuid",
    CONSTRAINT "File_file_type_check" CHECK ((("file_type")::"text" = ANY ((ARRAY['profile_picture'::character varying, 'post_image'::character varying, 'post_video'::character varying, 'gig_attachment'::character varying, 'home_document'::character varying, 'chat_file'::character varying, 'mailbox_attachment'::character varying, 'other'::character varying])::"text"[]))),
    CONSTRAINT "File_processing_status_check" CHECK ((("processing_status")::"text" = ANY ((ARRAY['uploading'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying])::"text"[]))),
    CONSTRAINT "File_visibility_check" CHECK ((("visibility")::"text" = ANY ((ARRAY['public'::character varying, 'private'::character varying])::"text"[])))
);


ALTER TABLE "public"."File" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."FileAccessLog" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "file_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "access_type" character varying(50) NOT NULL,
    "ip_address" character varying(45),
    "user_agent" "text",
    "success" boolean DEFAULT true,
    "error_message" "text",
    "accessed_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "FileAccessLog_access_type_check" CHECK ((("access_type")::"text" = ANY ((ARRAY['view'::character varying, 'download'::character varying, 'delete'::character varying, 'share'::character varying])::"text"[])))
);


ALTER TABLE "public"."FileAccessLog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."FileQuota" (
    "user_id" "uuid" NOT NULL,
    "storage_limit" bigint DEFAULT 1073741824,
    "storage_used" bigint DEFAULT 0,
    "max_files" integer DEFAULT 1000,
    "file_count" integer DEFAULT 0,
    "bandwidth_limit" bigint DEFAULT '5368709120'::bigint,
    "bandwidth_used" bigint DEFAULT 0,
    "bandwidth_reset_at" timestamp with time zone DEFAULT "date_trunc"('month'::"text", ("now"() + '1 mon'::interval)),
    "uploads_today" integer DEFAULT 0,
    "uploads_today_reset_at" timestamp with time zone DEFAULT "date_trunc"('day'::"text", ("now"() + '1 day'::interval)),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."FileQuota" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."FileThumbnail" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "file_id" "uuid" NOT NULL,
    "size_name" character varying(50) NOT NULL,
    "width" integer NOT NULL,
    "height" integer NOT NULL,
    "file_size" bigint NOT NULL,
    "file_path" character varying(500) NOT NULL,
    "file_url" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."FileThumbnail" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Gig" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" character varying(255) NOT NULL,
    "description" "text" NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "category" character varying(100),
    "deadline" timestamp with time zone,
    "estimated_duration" double precision,
    "attachments" "text"[] DEFAULT '{}'::"text"[],
    "exact_location" "public"."geography"(Point,4326),
    "approx_location" "public"."geography"(Point,4326),
    "user_id" "uuid" NOT NULL,
    "status" character varying(50) DEFAULT 'open'::character varying,
    "accepted_by" "uuid",
    "accepted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "estimated_dur" numeric,
    "created_by" "uuid",
    "beneficiary_user_id" "uuid",
    "origin_home_id" "uuid",
    "origin_user_place_id" "uuid",
    "exact_address" "text",
    "exact_city" "text",
    "exact_state" "text",
    "exact_zip" "text",
    "origin_mode" "text",
    "origin_place_id" "text",
    "started_at" timestamp with time zone,
    "worker_completed_at" timestamp with time zone,
    "owner_confirmed_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "cancellation_reason" "text",
    "cancellation_policy" "text" DEFAULT 'standard'::"text",
    "cancelled_by" "uuid",
    "cancellation_zone" smallint,
    "cancellation_fee" numeric(10,2) DEFAULT 0,
    "scheduled_start" timestamp with time zone,
    "completion_note" "text",
    "completion_photos" "text"[] DEFAULT '{}'::"text"[],
    "completion_checklist" "jsonb" DEFAULT '[]'::"jsonb",
    "owner_confirmation_note" "text",
    "owner_satisfaction" smallint,
    "payment_id" "uuid",
    "payment_status" character varying(50) DEFAULT 'none'::character varying,
    "location_precision" "public"."location_precision" DEFAULT 'approx_area'::"public"."location_precision",
    "reveal_policy" "public"."reveal_policy" DEFAULT 'after_assignment'::"public"."reveal_policy",
    "visibility_scope" "public"."visibility_scope" DEFAULT 'city'::"public"."visibility_scope",
    "radius_miles" numeric(8,2) DEFAULT 100,
    "is_urgent" boolean DEFAULT false,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "ref_listing_id" "uuid",
    "items" "jsonb" DEFAULT '[]'::"jsonb",
    "source_type" "text",
    "source_id" "uuid",
    "ref_post_id" "uuid",
    "last_worker_reminder_at" timestamp with time zone,
    "worker_ack_status" character varying(50),
    "worker_ack_eta_minutes" integer,
    "worker_ack_note" text,
    "worker_ack_updated_at" timestamp with time zone,
    "auto_reminder_count" integer DEFAULT 0,
    "boosted_at" timestamp with time zone,
    "boost_expires_at" timestamp with time zone,
    "task_format" "public"."task_format" DEFAULT 'in_person'::"public"."task_format" NOT NULL,
    CONSTRAINT "Gig_price_check" CHECK (("price" > (0)::numeric)),
    CONSTRAINT "Gig_status_check" CHECK ((("status")::"text" = ANY (ARRAY['open'::"text", 'assigned'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "gig_origin_mode_check" CHECK (("origin_mode" = ANY (ARRAY['home'::"text", 'address'::"text", 'current'::"text"]))),
    CONSTRAINT "gig_source_type_check" CHECK ((("source_type" IS NULL) OR ("source_type" = ANY (ARRAY['listing'::"text", 'post'::"text", 'event'::"text"]))))
);


ALTER TABLE "public"."Gig" OWNER TO "postgres";


COMMENT ON COLUMN "public"."Gig"."cancellation_policy" IS 'flexible | standard | strict — determines grace windows and fees';



COMMENT ON COLUMN "public"."Gig"."cancelled_by" IS 'User ID of whoever cancelled (poster or worker)';



COMMENT ON COLUMN "public"."Gig"."cancellation_zone" IS '0=pre-accept, 1=post-accept pre-start, 2=post-start';



COMMENT ON COLUMN "public"."Gig"."cancellation_fee" IS 'Fee amount (informational until payments are live)';



COMMENT ON COLUMN "public"."Gig"."scheduled_start" IS 'When work is expected to begin (for grace window calculations)';



COMMENT ON COLUMN "public"."Gig"."completion_photos" IS 'URLs of photos submitted by worker as proof of completion';



COMMENT ON COLUMN "public"."Gig"."completion_checklist" IS 'JSON array of checklist items with done status';



COMMENT ON COLUMN "public"."Gig"."owner_satisfaction" IS 'Quick 1-5 rating given at confirm time';



COMMENT ON COLUMN "public"."Gig"."items" IS 'Optional item details for errand/pickup tasks. Array of {name, notes, budgetCap, preferredStore}';



COMMENT ON COLUMN "public"."Gig"."source_type" IS 'Type of source object this task was created from: listing, post, event';



COMMENT ON COLUMN "public"."Gig"."source_id" IS 'ID of the source object this task was created from';



COMMENT ON COLUMN "public"."Gig"."ref_post_id" IS 'Reference to a Post that this task was created from';



CREATE TABLE IF NOT EXISTS "public"."GigBid" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "gig_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "bid_amount" numeric(10,2) NOT NULL,
    "message" "text",
    "proposed_time" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    "withdrawal_reason" "text",
    "withdrawn_at" timestamp with time zone,
    "counter_amount" numeric(10,2),
    "counter_message" "text",
    "countered_at" timestamp with time zone,
    "countered_by" "uuid",
    "counter_status" "text",
    "pending_payment_expires_at" timestamp with time zone,
    "pending_payment_intent_id" "text"
);


ALTER TABLE "public"."GigBid" OWNER TO "postgres";


COMMENT ON COLUMN "public"."GigBid"."expires_at" IS 'Auto-expire time. NULL = no expiry. Default set by backend.';



COMMENT ON COLUMN "public"."GigBid"."withdrawal_reason" IS 'Reason for withdrawal: schedule_conflict, underpriced, mistake, other';



COMMENT ON COLUMN "public"."GigBid"."counter_amount" IS 'Requester counter-offer amount. NULL if no counter.';



COMMENT ON COLUMN "public"."GigBid"."counter_status" IS 'pending | accepted | declined. NULL if no counter-offer.';



CREATE TABLE IF NOT EXISTS "public"."GigChangeOrder" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "gig_id" "uuid" NOT NULL,
    "requested_by" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "description" "text" NOT NULL,
    "amount_change" numeric(10,2) DEFAULT 0,
    "time_change_minutes" integer DEFAULT 0,
    "status" "text" DEFAULT 'pending'::"text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "rejection_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "GigChangeOrder_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'withdrawn'::"text"]))),
    CONSTRAINT "GigChangeOrder_type_check" CHECK (("type" = ANY (ARRAY['price_increase'::"text", 'price_decrease'::"text", 'scope_addition'::"text", 'scope_reduction'::"text", 'timeline_extension'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."GigChangeOrder" OWNER TO "postgres";


COMMENT ON TABLE "public"."GigChangeOrder" IS 'Tracks scope/price/timeline change requests during active gigs';



COMMENT ON COLUMN "public"."GigChangeOrder"."amount_change" IS 'Positive = increase, negative = decrease. Added to original gig price.';



COMMENT ON COLUMN "public"."GigChangeOrder"."time_change_minutes" IS 'Additional minutes needed. 0 = no time change.';



CREATE TABLE IF NOT EXISTS "public"."GigIncident" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "gig_id" "uuid" NOT NULL,
    "reported_by" "uuid" NOT NULL,
    "reported_against" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "description" "text",
    "evidence_urls" "text"[] DEFAULT '{}'::"text"[],
    "status" "text" DEFAULT 'open'::"text",
    "resolution" "text",
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."GigIncident" OWNER TO "postgres";


COMMENT ON TABLE "public"."GigIncident" IS 'Tracks no-show reports, disputes, and safety incidents for gigs';



CREATE TABLE IF NOT EXISTS "public"."GigMedia" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "gig_id" "uuid" NOT NULL,
    "uploaded_by" "uuid" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_key" "text" NOT NULL,
    "file_name" "text",
    "file_type" "text" NOT NULL,
    "mime_type" "text",
    "file_size" bigint DEFAULT 0,
    "thumbnail_url" "text",
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."GigMedia" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."GigPrivateLocation" (
    "gig_id" "uuid" NOT NULL,
    "exact_location" "public"."geography"(Point,4326),
    "exact_address" "text",
    "exact_city" "text",
    "exact_state" "text",
    "exact_zipcode" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."GigPrivateLocation" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."GigPublic" AS
 SELECT "id",
    "title",
    "description",
    "price",
    "category",
    "deadline",
    "estimated_duration",
    "attachments",
    "approx_location",
    "status",
    "accepted_by",
    "accepted_at",
    "created_at",
    "updated_at",
    "created_by",
    "beneficiary_user_id",
    "origin_home_id",
    "origin_user_place_id"
   FROM "public"."Gig" "g";


ALTER VIEW "public"."GigPublic" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."GigQuestion" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "gig_id" "uuid" NOT NULL,
    "asked_by" "uuid" NOT NULL,
    "question" "text" NOT NULL,
    "answer" "text",
    "answered_by" "uuid",
    "answered_at" timestamp with time zone,
    "is_pinned" boolean DEFAULT false,
    "upvote_count" integer DEFAULT 0,
    "status" "text" DEFAULT 'open'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "question_attachments" "text"[] DEFAULT '{}'::"text"[],
    "answer_attachments" "text"[] DEFAULT '{}'::"text"[],
    CONSTRAINT "GigQuestion_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'answered'::"text"])))
);


ALTER TABLE "public"."GigQuestion" OWNER TO "postgres";


COMMENT ON TABLE "public"."GigQuestion" IS 'Structured Q&A thread for gigs — replaces open comments';



CREATE TABLE IF NOT EXISTS "public"."GigQuestionUpvote" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "question_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."GigQuestionUpvote" OWNER TO "postgres";


COMMENT ON TABLE "public"."GigQuestionUpvote" IS 'Tracks upvotes on gig questions for sorting';



CREATE TABLE IF NOT EXISTS "public"."Home" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "address" character varying(255) NOT NULL,
    "city" character varying(100) NOT NULL,
    "state" character varying(50) NOT NULL,
    "zipcode" character varying(20) NOT NULL,
    "location" "public"."geography"(Point,4326),
    "owner_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "primary_photo_url" "text",
    "photo_gallery_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "description" "text",
    "wifi_qr_file_id" "uuid",
    "house_rules_file_id" "uuid",
    "amenities" "jsonb" DEFAULT '{}'::"jsonb",
    "name" "text",
    "home_type" "text" DEFAULT 'house'::"text",
    "address2" "text",
    "country" "text" DEFAULT 'US'::"text",
    "entry_instructions" "text",
    "parking_instructions" "text",
    "visibility" "text" DEFAULT 'private'::"text",
    "niche_data" "jsonb" DEFAULT '{}'::"jsonb",
    "bedrooms" smallint,
    "bathrooms" numeric(2,1),
    "sq_ft" integer,
    "year_built" integer,
    "move_in_date" "date",
    "is_owner" boolean DEFAULT false,
    "cover_photo_url" "text",
    "address_id" "uuid",
    "parent_home_id" "uuid",
    "home_status" "text" DEFAULT 'active'::"text" NOT NULL,
    "canonical_home_id" "uuid",
    "security_state" "public"."home_security_state" DEFAULT 'normal'::"public"."home_security_state" NOT NULL,
    "claim_window_ends_at" timestamp with time zone,
    "member_attach_policy" "public"."home_member_attach_policy" DEFAULT 'open_invite'::"public"."home_member_attach_policy" NOT NULL,
    "owner_claim_policy" "public"."home_owner_claim_policy" DEFAULT 'open'::"public"."home_owner_claim_policy" NOT NULL,
    "privacy_mask_level" "public"."home_privacy_mask_level" DEFAULT 'normal'::"public"."home_privacy_mask_level" NOT NULL,
    "tenure_mode" "public"."home_tenure_mode" DEFAULT 'unknown'::"public"."home_tenure_mode" NOT NULL,
    "address_hash" "text",
    "place_type" "text" DEFAULT 'unknown'::"text",
    "created_by_user_id" "uuid",
    "household_resolution_state" "public"."household_resolution_state" DEFAULT 'unclaimed'::"public"."household_resolution_state" NOT NULL,
    "household_resolution_updated_at" timestamp with time zone,
    "lot_sq_ft" integer,
    "mail_party_enabled" boolean DEFAULT true,
    "map_center_lat" double precision,
    "map_center_lng" double precision,
    CONSTRAINT "Home_home_status_chk" CHECK (("home_status" = ANY (ARRAY['active'::"text", 'merged'::"text", 'archived'::"text"]))),
    CONSTRAINT "Home_home_type_chk" CHECK (("home_type" = ANY (ARRAY['house'::"text", 'apartment'::"text", 'condo'::"text", 'townhouse'::"text", 'studio'::"text", 'rv'::"text", 'mobile_home'::"text", 'trailer'::"text", 'multi_unit'::"text", 'other'::"text"]))),
    CONSTRAINT "Home_place_type_chk2" CHECK ((("place_type" IS NULL) OR ("place_type" = ANY (ARRAY['single_family'::"text", 'unit'::"text", 'building'::"text", 'multi_parcel'::"text", 'rv_spot'::"text", 'unknown'::"text"])))),
    CONSTRAINT "Home_visibility_chk" CHECK (("visibility" = ANY (ARRAY['private'::"text", 'members'::"text", 'public_preview'::"text"]))),
    CONSTRAINT "home_home_type_chk" CHECK ((("home_type" IS NULL) OR ("home_type" = ANY (ARRAY['house'::"text", 'apartment'::"text", 'condo'::"text", 'townhouse'::"text", 'studio'::"text", 'rv'::"text", 'mobile_home'::"text", 'trailer'::"text", 'multi_unit'::"text", 'other'::"text"]))))
);


ALTER TABLE "public"."Home" OWNER TO "postgres";


COMMENT ON COLUMN "public"."Home"."lot_sq_ft" IS 'Lot size in square feet (optional).';



CREATE TABLE IF NOT EXISTS "public"."HomeAccessSecret" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "access_type" "text" NOT NULL,
    "label" "text" NOT NULL,
    "secret_value" "text" NOT NULL,
    "notes" "text",
    "visibility" "public"."home_record_visibility" DEFAULT 'members'::"public"."home_record_visibility" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "HomeAccessSecret_type_chk" CHECK (("access_type" = ANY (ARRAY['wifi'::"text", 'door_code'::"text", 'gate_code'::"text", 'lockbox'::"text", 'garage'::"text", 'alarm'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."HomeAccessSecret" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomeAccessSecretValue" (
    "access_secret_id" "uuid" NOT NULL,
    "secret_value" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."HomeAccessSecretValue" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."HomeAccess" WITH ("security_invoker"='true') AS
 SELECT "s"."id",
    "s"."home_id",
    "s"."access_type",
    "s"."label",
        CASE
            WHEN (("s"."access_type" = 'wifi'::"text") AND "public"."home_has_permission"("s"."home_id", 'access.view_wifi'::"public"."home_permission") AND "public"."home_can_see_visibility"("s"."home_id", "s"."visibility")) THEN "v"."secret_value"
            WHEN (("s"."access_type" <> 'wifi'::"text") AND "public"."home_has_permission"("s"."home_id", 'access.view_codes'::"public"."home_permission") AND "public"."home_can_see_visibility"("s"."home_id", "s"."visibility")) THEN "v"."secret_value"
            WHEN "public"."home_has_permission"("s"."home_id", 'access.manage'::"public"."home_permission") THEN "v"."secret_value"
            ELSE NULL::"text"
        END AS "secret_value",
    (("v"."secret_value" IS NOT NULL) AND ("v"."secret_value" <> ''::"text")) AS "has_secret",
    "s"."notes",
    "s"."visibility",
    "s"."created_by",
    "s"."created_at",
    "s"."updated_at"
   FROM ("public"."HomeAccessSecret" "s"
     LEFT JOIN "public"."HomeAccessSecretValue" "v" ON (("v"."access_secret_id" = "s"."id")));


ALTER VIEW "public"."HomeAccess" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomeAddress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "address_line1_norm" "text" NOT NULL,
    "address_line2_norm" "text",
    "city_norm" "text" NOT NULL,
    "state" "text" NOT NULL,
    "postal_code" "text" NOT NULL,
    "country" "text" DEFAULT 'US'::"text" NOT NULL,
    "address_hash" "text" NOT NULL,
    "geocode_lat" double precision,
    "geocode_lng" double precision,
    "place_type" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "postal_code_plus4" "text",
    "dpv_match_code" "text",
    "rdi_type" "text" DEFAULT 'unknown'::"text",
    "missing_secondary_flag" boolean DEFAULT false,
    "commercial_mailbox_flag" boolean DEFAULT false,
    "deliverability_status" "text" DEFAULT 'unverified'::"text",
    "parcel_type" "text" DEFAULT 'unknown'::"text",
    "building_type" "text" DEFAULT 'unknown'::"text",
    "google_place_types" "text"[],
    "validation_vendor" "text",
    "last_validated_at" timestamp with time zone,
    "validation_raw_response" "jsonb" DEFAULT '{}'::"jsonb",
    "geocode_granularity" "text",
    "google_verdict" "jsonb" DEFAULT '{}'::"jsonb",
    "google_place_id" "text",
    "google_place_primary_type" "text",
    "google_business_status" "text",
    "google_place_name" "text",
    "verification_level" "text",
    "risk_flags" "text"[] DEFAULT ARRAY[]::"text"[],
    "provider_versions" "jsonb" DEFAULT '{}'::"jsonb",
    "last_place_validated_at" timestamp with time zone,
    "provider_place_types" "text"[] DEFAULT ARRAY[]::"text"[],
    "secondary_required" boolean,
    "unit_count_estimate" integer,
    "unit_intelligence_confidence" numeric(4,3),
    "last_secondary_validated_at" timestamp with time zone,
    "parcel_provider" "text",
    "parcel_id" "text",
    "parcel_land_use" "text",
    "parcel_property_type" "text",
    "parcel_confidence" numeric(4,3),
    "building_count" integer,
    "residential_unit_count" integer,
    "non_residential_unit_count" integer,
    "usage_class" "text",
    "last_parcel_validated_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "HomeAddress_building_type_chk" CHECK (("building_type" = ANY (ARRAY['single_family'::"text", 'multi_unit'::"text", 'commercial'::"text", 'mixed_use'::"text", 'unknown'::"text"]))),
    CONSTRAINT "HomeAddress_deliverability_status_chk" CHECK (("deliverability_status" = ANY (ARRAY['deliverable'::"text", 'undeliverable'::"text", 'partial'::"text", 'unverified'::"text"]))),
    CONSTRAINT "HomeAddress_parcel_type_chk" CHECK (("parcel_type" = ANY (ARRAY['residential'::"text", 'commercial'::"text", 'mixed'::"text", 'unknown'::"text"]))),
    CONSTRAINT "HomeAddress_place_type_chk" CHECK (("place_type" = ANY (ARRAY['single_family'::"text", 'unit'::"text", 'building'::"text", 'multi_parcel'::"text", 'rv_spot'::"text", 'unknown'::"text"]))),
    CONSTRAINT "HomeAddress_rdi_type_chk" CHECK (("rdi_type" = ANY (ARRAY['residential'::"text", 'commercial'::"text", 'unknown'::"text"])))
);


ALTER TABLE "public"."HomeAddress" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."AddressVerificationEvent" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "address_id" "uuid",
    "event_type" "text" NOT NULL,
    "provider" "text",
    "status" "text" NOT NULL,
    "reasons" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "raw_response" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "AddressVerificationEvent_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "public"."HomeAddress"("id") ON DELETE SET NULL
);


ALTER TABLE "public"."AddressVerificationEvent" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomeAsset" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "name" "text" NOT NULL,
    "room" "text",
    "brand" "text",
    "model" "text",
    "serial_number" "text",
    "purchase_date" "date",
    "purchase_price" numeric(12,2),
    "warranty_expires_at" "date",
    "receipt_document_id" "uuid",
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "location" "text",
    "ownership_user_id" "uuid",
    "notes" "text",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "HomeAsset_cat_chk" CHECK (("category" = ANY (ARRAY['appliance'::"text", 'electronics'::"text", 'furniture'::"text", 'tool'::"text", 'valuable'::"text", 'consumable'::"text", 'fixture'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."HomeAsset" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomeAuditLog" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "actor_user_id" "uuid",
    "action" "text" NOT NULL,
    "target_type" "text",
    "target_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "before_data" "jsonb",
    "after_data" "jsonb"
);


ALTER TABLE "public"."HomeAuditLog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomeBill" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "bill_type" "text" NOT NULL,
    "provider_name" "text",
    "amount" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "period_start" "date",
    "period_end" "date",
    "due_date" "date",
    "status" "text" DEFAULT 'due'::"text" NOT NULL,
    "paid_at" timestamp with time zone,
    "paid_by" "uuid",
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "HomeBill_status_chk" CHECK (("status" = ANY (ARRAY['due'::"text", 'paid'::"text", 'overdue'::"text", 'canceled'::"text"]))),
    CONSTRAINT "HomeBill_type_chk" CHECK (("bill_type" = ANY (ARRAY['rent'::"text", 'mortgage'::"text", 'electric'::"text", 'gas'::"text", 'water'::"text", 'sewer'::"text", 'trash'::"text", 'internet'::"text", 'cable'::"text", 'hoa'::"text", 'insurance'::"text", 'subscription'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."HomeBill" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomeBillSplit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bill_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "share_amount" numeric(12,2),
    "share_percent" numeric(5,2),
    "status" "text" DEFAULT 'owed'::"text" NOT NULL,
    "paid_at" timestamp with time zone,
    CONSTRAINT "HomeBillSplit_status_chk" CHECK (("status" = ANY (ARRAY['owed'::"text", 'paid'::"text", 'forgiven'::"text"])))
);


ALTER TABLE "public"."HomeBillSplit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomeBusinessLink" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "business_user_id" "uuid" NOT NULL,
    "kind" "text" DEFAULT 'favorite'::"text" NOT NULL,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "HomeBusinessLink_kind_check" CHECK (("kind" = ANY (ARRAY['favorite'::"text", 'vendor'::"text", 'building_amenity'::"text", 'recommended'::"text", 'blocked'::"text"])))
);


ALTER TABLE "public"."HomeBusinessLink" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomeCalendarEvent" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "start_at" timestamp with time zone NOT NULL,
    "end_at" timestamp with time zone,
    "location_notes" "text",
    "recurrence_rule" "text",
    "assigned_to" "uuid"[],
    "alerts_enabled" boolean DEFAULT true,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "visibility" "public"."home_record_visibility" DEFAULT 'members'::"public"."home_record_visibility" NOT NULL,
    CONSTRAINT "HomeCalendarEvent_type_chk" CHECK (("event_type" = ANY (ARRAY['guest'::"text", 'vendor'::"text", 'maintenance'::"text", 'trash_recycling'::"text", 'chore'::"text", 'appointment'::"text", 'resource_booking'::"text", 'house'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."HomeCalendarEvent" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomeDevice" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "device_type" "text" NOT NULL,
    "label" "text" NOT NULL,
    "status" "text" DEFAULT 'offline'::"text",
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "access_codes" "jsonb" DEFAULT '{}'::"jsonb",
    "battery_change_date" "date",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "HomeDevice_type_chk" CHECK (("device_type" = ANY (ARRAY['camera'::"text", 'thermostat'::"text", 'sensor'::"text", 'alarm'::"text", 'light'::"text", 'lock'::"text", 'garage_door'::"text", 'sprinkler'::"text", 'oven'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."HomeDevice" OWNER TO "postgres";


COMMENT ON COLUMN "public"."HomeDevice"."access_codes" IS 'May include sensitive device codes/tokens. RLS requires manage_access to write; read requires membership.';



CREATE TABLE IF NOT EXISTS "public"."HomeDocument" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "file_id" "uuid",
    "doc_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "storage_bucket" "text",
    "storage_path" "text",
    "mime_type" "text",
    "size_bytes" bigint,
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "visibility" "public"."home_record_visibility" DEFAULT 'members'::"public"."home_record_visibility" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "HomeDocument_type_chk" CHECK (("doc_type" = ANY (ARRAY['lease'::"text", 'insurance'::"text", 'warranty'::"text", 'manual'::"text", 'permit'::"text", 'floor_plan'::"text", 'receipt'::"text", 'photo'::"text", 'paint_color'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."HomeDocument" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomeEmergency" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "label" "text" NOT NULL,
    "location" "text",
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "HomeEmergency_type_chk" CHECK (("type" = ANY (ARRAY['shutoff_water'::"text", 'shutoff_gas'::"text", 'shutoff_electric'::"text", 'breaker_map'::"text", 'extinguisher'::"text", 'first_aid'::"text", 'evac_plan'::"text", 'emergency_contacts'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."HomeEmergency" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomeEstateFields" (
    "home_id" "uuid" NOT NULL,
    "acreage" numeric(10,2),
    "irrigation_schedule" "text",
    "fence_notes" "text",
    "zoning_notes" "text",
    "soil_notes" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."HomeEstateFields" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomeGuestPass" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "kind" "text" DEFAULT 'guest'::"text" NOT NULL,
    "token_hash" "text" NOT NULL,
    "role_base" "public"."home_role_base" DEFAULT 'guest'::"public"."home_role_base" NOT NULL,
    "permissions" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "start_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "end_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "homeguestpass_kind_chk" CHECK (("kind" = ANY (ARRAY['wifi_only'::"text", 'guest'::"text", 'airbnb'::"text", 'vendor'::"text"])))
);


ALTER TABLE "public"."HomeGuestPass" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomeInvite" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "invited_by" "uuid" NOT NULL,
    "invitee_email" "text",
    "invitee_user_id" "uuid",
    "proposed_role" "text" DEFAULT 'member'::"text" NOT NULL,
    "token" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "proposed_role_base" "public"."home_role_base",
    "proposed_preset_key" "text",
    CONSTRAINT "HomeInvite_status_chk" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'revoked'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."HomeInvite" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomeIssue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "severity" "text" DEFAULT 'medium'::"text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "reported_by" "uuid" NOT NULL,
    "assigned_vendor_id" "uuid",
    "estimated_cost" numeric(12,2),
    "photos" "text"[] DEFAULT '{}'::"text"[],
    "secret_fixes" "text",
    "linked_gig_id" "uuid",
    "resolved_at" timestamp with time zone,
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "visibility" "public"."home_record_visibility" DEFAULT 'members'::"public"."home_record_visibility" NOT NULL,
    CONSTRAINT "HomeIssue_severity_chk" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "HomeIssue_status_chk" CHECK (("status" = ANY (ARRAY['open'::"text", 'scheduled'::"text", 'in_progress'::"text", 'resolved'::"text", 'canceled'::"text"])))
);


ALTER TABLE "public"."HomeIssue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomeIssueSensitive" (
    "issue_id" "uuid" NOT NULL,
    "secret_fixes" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."HomeIssueSensitive" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomeMaintenanceLog" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "template_id" "uuid",
    "performed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "performed_by" "uuid",
    "vendor_id" "uuid",
    "cost" numeric(12,2),
    "notes" "text",
    "document_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "task" "text" DEFAULT ''::"text" NOT NULL,
    "vendor" "text",
    "recurrence" "text" DEFAULT 'one_time'::"text" NOT NULL,
    "due_date" timestamp with time zone,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "HomeMaintenance_recurrence_chk" CHECK (("recurrence" = ANY (ARRAY['one_time'::"text", 'weekly'::"text", 'monthly'::"text", 'quarterly'::"text", 'yearly'::"text"]))),
    CONSTRAINT "HomeMaintenance_status_chk" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."HomeMaintenanceLog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomeMaintenanceTemplate" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "maint_type" "text",
    "interval_days" integer,
    "season" "text",
    "instructions" "text",
    "default_cost" numeric(12,2),
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "HomeMaintTpl_season_chk" CHECK ((("season" IS NULL) OR ("season" = ANY (ARRAY['spring'::"text", 'summer'::"text", 'fall'::"text", 'winter'::"text"])))),
    CONSTRAINT "HomeMaintTpl_type_chk" CHECK ((("maint_type" IS NULL) OR ("maint_type" = ANY (ARRAY['hvac'::"text", 'roof'::"text", 'gutter'::"text", 'appliance'::"text", 'pest'::"text", 'plumbing'::"text", 'electrical'::"text", 'landscaping'::"text", 'pool'::"text", 'other'::"text"]))))
);


ALTER TABLE "public"."HomeMaintenanceTemplate" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomeMapPin" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "mail_id" "uuid",
    "created_by" "uuid" NOT NULL,
    "pin_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "lat" double precision NOT NULL,
    "lng" double precision NOT NULL,
    "radius_meters" integer,
    "visible_to" "text" DEFAULT 'household'::"text" NOT NULL,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "HomeMapPin_pin_type_check" CHECK (("pin_type" = ANY (ARRAY['permit'::"text", 'delivery'::"text", 'notice'::"text", 'civic'::"text", 'utility_work'::"text", 'community'::"text"]))),
    CONSTRAINT "HomeMapPin_visible_to_check" CHECK (("visible_to" = ANY (ARRAY['personal'::"text", 'household'::"text", 'neighborhood'::"text", 'public'::"text"])))
);


ALTER TABLE "public"."HomeMapPin" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomeMedia" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "file_id" "uuid" NOT NULL,
    "media_category" character varying(50),
    "title" character varying(255),
    "description" "text",
    "display_order" integer DEFAULT 0,
    "is_primary" boolean DEFAULT false,
    "visibility" "public"."home_record_visibility" DEFAULT 'members'::"public"."home_record_visibility",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "HomeMedia_media_category_check" CHECK ((("media_category")::"text" = ANY ((ARRAY['exterior'::character varying, 'interior'::character varying, 'bedroom'::character varying, 'kitchen'::character varying, 'bathroom'::character varying, 'living_room'::character varying, 'outdoor'::character varying, 'amenity'::character varying, 'floor_plan'::character varying, 'document'::character varying, 'other'::character varying])::"text"[])))
);


ALTER TABLE "public"."HomeMedia" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomeOccupancy" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "role" "text" DEFAULT 'member'::"text",
    "start_at" timestamp with time zone DEFAULT "now"(),
    "end_at" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "can_manage_home" boolean DEFAULT false NOT NULL,
    "can_manage_finance" boolean DEFAULT false NOT NULL,
    "can_manage_access" boolean DEFAULT false NOT NULL,
    "can_manage_tasks" boolean DEFAULT true NOT NULL,
    "can_view_sensitive" boolean DEFAULT false NOT NULL,
    "role_base" "public"."home_role_base",
    "age_band" "public"."home_age_band",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "access_start_at" timestamp with time zone,
    "access_end_at" timestamp with time zone,
    "added_by_user_id" "uuid",
    CONSTRAINT "HomeOccupancy_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'tenant'::"text", 'member'::"text", 'guest'::"text", 'renter'::"text", 'roommate'::"text", 'family'::"text", 'property_manager'::"text", 'caregiver'::"text", 'admin'::"text", 'manager'::"text", 'restricted_member'::"text", 'lease_resident'::"text", 'service_provider'::"text"])))
);


ALTER TABLE "public"."HomeOccupancy" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomeOwner" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "subject_type" "public"."subject_type" DEFAULT 'user'::"public"."subject_type" NOT NULL,
    "subject_id" "uuid" NOT NULL,
    "owner_status" "public"."owner_status_type" DEFAULT 'pending'::"public"."owner_status_type" NOT NULL,
    "is_primary_owner" boolean DEFAULT false NOT NULL,
    "added_via" "public"."owner_added_via" DEFAULT 'claim'::"public"."owner_added_via" NOT NULL,
    "verification_tier" "public"."owner_verification_tier" DEFAULT 'weak'::"public"."owner_verification_tier" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."HomeOwner" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomeOwnershipClaim" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "claimant_user_id" "uuid" NOT NULL,
    "claim_type" "text" DEFAULT 'owner'::"text" NOT NULL,
    "state" "public"."ownership_claim_state" DEFAULT 'draft'::"public"."ownership_claim_state" NOT NULL,
    "method" "public"."ownership_claim_method",
    "risk_score" numeric(5,2) DEFAULT 0,
    "challenge_window_ends_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "review_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "claim_phase_v2" "public"."claim_phase_v2",
    "terminal_reason" "public"."claim_terminal_reason" DEFAULT 'none'::"public"."claim_terminal_reason" NOT NULL,
    "challenge_state" "public"."claim_challenge_state" DEFAULT 'none'::"public"."claim_challenge_state" NOT NULL,
    "claim_strength" "public"."claim_strength",
    "routing_classification" "public"."claim_routing_classification",
    "identity_status" "public"."identity_status" DEFAULT 'not_started'::"public"."identity_status" NOT NULL,
    "merged_into_claim_id" "uuid",
    "expires_at" timestamp with time zone,
    CONSTRAINT "HomeOwnershipClaim_type_chk" CHECK (("claim_type" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'resident'::"text"])))
);


ALTER TABLE "public"."HomeOwnershipClaim" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomePackage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "carrier" "text",
    "tracking_number" "text",
    "vendor_name" "text",
    "description" "text",
    "delivery_instructions" "text",
    "status" "text" DEFAULT 'expected'::"text" NOT NULL,
    "expected_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "picked_up_by" "uuid",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "visibility" "public"."home_record_visibility" DEFAULT 'members'::"public"."home_record_visibility" NOT NULL,
    CONSTRAINT "HomePackage_status_chk" CHECK (("status" = ANY (ARRAY['expected'::"text", 'out_for_delivery'::"text", 'delivered'::"text", 'picked_up'::"text", 'lost'::"text", 'returned'::"text"])))
);


ALTER TABLE "public"."HomePackage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomePermissionOverride" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "permission" "public"."home_permission" NOT NULL,
    "allowed" boolean NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."HomePermissionOverride" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomePostcardCode" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "verified_at" timestamp with time zone,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '30 days'::interval) NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "HomePostcardCode_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'verified'::"text", 'expired'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."HomePostcardCode" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomePreference" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "visibility_level" "text" DEFAULT 'building'::"text",
    "share_unit_number" boolean DEFAULT false,
    "open_to_lending" boolean DEFAULT true,
    "open_to_services" boolean DEFAULT true,
    "open_to_social" boolean DEFAULT false,
    "quiet_hours_start" time without time zone,
    "quiet_hours_end" time without time zone,
    "notification_radius_meters" integer DEFAULT 500,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "HomePreference_vis_chk" CHECK (("visibility_level" = ANY (ARRAY['unit_only'::"text", 'building'::"text", 'neighborhood'::"text", 'city'::"text"])))
);


ALTER TABLE "public"."HomePreference" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomePrivateData" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "type" character varying(100) NOT NULL,
    "data" "jsonb" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "visibility" "public"."home_record_visibility" DEFAULT 'sensitive'::"public"."home_record_visibility" NOT NULL
);


ALTER TABLE "public"."HomePrivateData" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomePublicData" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "type" character varying(100) NOT NULL,
    "data" "jsonb" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "visibility" "public"."home_record_visibility" DEFAULT 'public'::"public"."home_record_visibility" NOT NULL
);


ALTER TABLE "public"."HomePublicData" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomeQuorumAction" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "proposed_by" "uuid" NOT NULL,
    "action_type" "text" NOT NULL,
    "state" "public"."quorum_action_state" DEFAULT 'proposed'::"public"."quorum_action_state" NOT NULL,
    "risk_tier" smallint DEFAULT 0 NOT NULL,
    "required_rule" "text" DEFAULT 'majority'::"text" NOT NULL,
    "required_approvals" smallint DEFAULT 1 NOT NULL,
    "min_rejects_to_block" smallint DEFAULT 1 NOT NULL,
    "expires_at" timestamp with time zone,
    "passive_approval_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "HomeQuorumAction_action_type_chk" CHECK (("action_type" = ANY (ARRAY['CHANGE_OWNER_CLAIM_POLICY'::"text", 'REMOVE_OWNER'::"text", 'TRANSFER_OWNERSHIP'::"text", 'CHANGE_PRIMARY_OWNER'::"text", 'MAIL_ROUTING_CHANGE'::"text", 'FREEZE_HOME'::"text", 'CHANGE_MEMBER_ATTACH_POLICY'::"text", 'ADD_SERVICE_PROVIDER'::"text", 'CHANGE_PRIVACY_MASK'::"text", 'CHANGE_TENURE_MODE'::"text"]))),
    CONSTRAINT "HomeQuorumAction_risk_chk" CHECK ((("risk_tier" >= 0) AND ("risk_tier" <= 3))),
    CONSTRAINT "HomeQuorumAction_rule_chk" CHECK (("required_rule" = ANY (ARRAY['2_of_n'::"text", 'majority'::"text", 'primary_plus_one'::"text"])))
);


ALTER TABLE "public"."HomeQuorumAction" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomeQuorumVote" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quorum_action_id" "uuid" NOT NULL,
    "voter_user_id" "uuid" NOT NULL,
    "vote" "text" NOT NULL,
    "reason" "text",
    "voted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "HomeQuorumVote_vote_chk" CHECK (("vote" = ANY (ARRAY['approve'::"text", 'reject'::"text"])))
);


ALTER TABLE "public"."HomeQuorumVote" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomeReputation" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "overall_rating" numeric(3,2) DEFAULT 0,
    "total_transactions" integer DEFAULT 0,
    "total_reviews" integer DEFAULT 0,
    "lend_score" numeric(3,2) DEFAULT 0,
    "borrow_score" numeric(3,2) DEFAULT 0,
    "response_rate" numeric(5,2) DEFAULT 0,
    "avg_response_minutes" integer,
    "last_active_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."HomeReputation" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomeResidencyClaim" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "claimed_address" "text",
    "claimed_latitude" double precision,
    "claimed_longitude" double precision,
    "status" "public"."claim_status" DEFAULT 'pending'::"public"."claim_status" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "review_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "claimed_role" "text" DEFAULT 'member'::"text"
);


ALTER TABLE "public"."HomeResidencyClaim" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomeRolePermission" (
    "role_base" "public"."home_role_base" NOT NULL,
    "permission" "public"."home_permission" NOT NULL,
    "allowed" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."HomeRolePermission" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomeRolePreset" (
    "key" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "role_base" "public"."home_role_base" NOT NULL,
    "grant_perms" "public"."home_permission"[] DEFAULT '{}'::"public"."home_permission"[] NOT NULL,
    "deny_perms" "public"."home_permission"[] DEFAULT '{}'::"public"."home_permission"[] NOT NULL,
    "icon_key" "text",
    "sort_order" integer DEFAULT 100 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."HomeRolePreset" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomeRoleTemplateMeta" (
    "role_base" "public"."home_role_base" NOT NULL,
    "display_name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "icon_key" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."HomeRoleTemplateMeta" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomeRvStatus" (
    "home_id" "uuid" NOT NULL,
    "fresh_water_percent" integer,
    "grey_water_percent" integer,
    "black_water_percent" integer,
    "battery_voltage" numeric(6,2),
    "propane_percent" integer,
    "is_level" boolean,
    "notes" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "HomeRvStatus_black_water_percent_check" CHECK ((("black_water_percent" >= 0) AND ("black_water_percent" <= 100))),
    CONSTRAINT "HomeRvStatus_fresh_water_percent_check" CHECK ((("fresh_water_percent" >= 0) AND ("fresh_water_percent" <= 100))),
    CONSTRAINT "HomeRvStatus_grey_water_percent_check" CHECK ((("grey_water_percent" >= 0) AND ("grey_water_percent" <= 100))),
    CONSTRAINT "HomeRvStatus_propane_percent_check" CHECK ((("propane_percent" >= 0) AND ("propane_percent" <= 100)))
);


ALTER TABLE "public"."HomeRvStatus" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomeScopedGrant" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "grantee_user_id" "uuid",
    "resource_type" "text" NOT NULL,
    "resource_id" "uuid" NOT NULL,
    "can_view" boolean DEFAULT true NOT NULL,
    "can_edit" boolean DEFAULT false NOT NULL,
    "can_upload" boolean DEFAULT false NOT NULL,
    "start_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "end_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "homescopedgrant_resource_type_chk" CHECK (("resource_type" = ANY (ARRAY['HomeIssue'::"text", 'HomeTask'::"text", 'HomeDocument'::"text", 'HomeCalendarEvent'::"text", 'HomeAsset'::"text", 'HomePackage'::"text"])))
);


ALTER TABLE "public"."HomeScopedGrant" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomeSubscription" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "service_name" "text" NOT NULL,
    "cost" numeric(10,2) NOT NULL,
    "renewal_date" "date" NOT NULL,
    "frequency" "text" DEFAULT 'monthly'::"text",
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "HomeSubscription_freq_chk" CHECK (("frequency" = ANY (ARRAY['monthly'::"text", 'quarterly'::"text", 'annual'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."HomeSubscription" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomeTask" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "task_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "assigned_to" "uuid",
    "due_at" timestamp with time zone,
    "recurrence_rule" "text",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text",
    "budget" numeric(12,2),
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "completed_at" timestamp with time zone,
    "linked_gig_id" "uuid",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "visibility" "public"."home_record_visibility" DEFAULT 'members'::"public"."home_record_visibility" NOT NULL,
    "viewer_user_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "mail_id" "uuid",
    "converted_to_gig_id" "uuid",
    CONSTRAINT "HomeTask_priority_chk" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "HomeTask_status_chk" CHECK (("status" = ANY (ARRAY['open'::"text", 'in_progress'::"text", 'done'::"text", 'canceled'::"text"]))),
    CONSTRAINT "HomeTask_type_chk" CHECK (("task_type" = ANY (ARRAY['chore'::"text", 'shopping'::"text", 'project'::"text", 'reminder'::"text", 'repair'::"text"])))
);


ALTER TABLE "public"."HomeTask" OWNER TO "postgres";


COMMENT ON COLUMN "public"."HomeTask"."viewer_user_ids" IS 'Specific user IDs who can view this task, in addition to the visibility level';



CREATE TABLE IF NOT EXISTS "public"."HomeTaskMedia" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "home_id" "uuid" NOT NULL,
    "uploaded_by" "uuid" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_key" "text" NOT NULL,
    "file_name" "text",
    "file_type" "text" NOT NULL,
    "mime_type" "text",
    "file_size" bigint DEFAULT 0,
    "thumbnail_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."HomeTaskMedia" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomeVendor" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "service_category" "text",
    "phone" "text",
    "email" "text",
    "website" "text",
    "contact" "jsonb" DEFAULT '{}'::"jsonb",
    "rating" integer,
    "notes" "text",
    "history" "jsonb" DEFAULT '{}'::"jsonb",
    "trusted" boolean DEFAULT false,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "HomeVendor_rating_chk" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."HomeVendor" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomeVerification" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "method" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "verified_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "HomeVerification_method_chk" CHECK (("method" = ANY (ARRAY['mail_code'::"text", 'lease_upload'::"text", 'utility_bill'::"text", 'neighbor_vouch'::"text", 'gps_check'::"text"]))),
    CONSTRAINT "HomeVerification_status_chk" CHECK (("status" = ANY (ARRAY['pending'::"text", 'verified'::"text", 'rejected'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."HomeVerification" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HomeVerificationEvidence" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "claim_id" "uuid" NOT NULL,
    "evidence_type" "text" NOT NULL,
    "provider" "text" DEFAULT 'manual'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "redaction_status" "text" DEFAULT 'required'::"text" NOT NULL,
    "storage_ref" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "confidence_level" "public"."evidence_confidence_level",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "HomeVerificationEvidence_provider_chk" CHECK (("provider" = ANY (ARRAY['manual'::"text", 'stripe_identity'::"text", 'attom'::"text", 'corelogic'::"text", 'other'::"text"]))),
    CONSTRAINT "HomeVerificationEvidence_redact_chk" CHECK (("redaction_status" = ANY (ARRAY['required'::"text", 'ok'::"text"]))),
    CONSTRAINT "HomeVerificationEvidence_status_chk" CHECK (("status" = ANY (ARRAY['pending'::"text", 'verified'::"text", 'failed'::"text"]))),
    CONSTRAINT "HomeVerificationEvidence_type_chk" CHECK (("evidence_type" = ANY (ARRAY['deed'::"text", 'closing_disclosure'::"text", 'tax_bill'::"text", 'utility_bill'::"text", 'lease'::"text", 'idv'::"text", 'escrow_attestation'::"text", 'title_match'::"text"])))
);


ALTER TABLE "public"."HomeVerificationEvidence" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Listing" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "price" numeric(10,2),
    "is_free" boolean DEFAULT false,
    "category" "public"."listing_category" DEFAULT 'other'::"public"."listing_category" NOT NULL,
    "subcategory" "text",
    "condition" "public"."listing_condition",
    "quantity" integer DEFAULT 1,
    "status" "public"."listing_status" DEFAULT 'active'::"public"."listing_status",
    "media_urls" "text"[] DEFAULT '{}'::"text"[],
    "media_types" "text"[] DEFAULT '{}'::"text"[],
    "latitude" double precision,
    "longitude" double precision,
    "location" "public"."geography"(Point,4326),
    "location_name" "text",
    "location_address" "text",
    "location_precision" "public"."location_precision" DEFAULT 'approx_area'::"public"."location_precision",
    "reveal_policy" "public"."reveal_policy" DEFAULT 'after_interest'::"public"."reveal_policy",
    "visibility_scope" "public"."visibility_scope" DEFAULT 'city'::"public"."visibility_scope",
    "radius_miles" numeric(8,2) DEFAULT 100,
    "meetup_preference" "text" DEFAULT 'public_meetup'::"text",
    "delivery_available" boolean DEFAULT false,
    "available_from" timestamp with time zone,
    "available_until" timestamp with time zone,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "view_count" integer DEFAULT 0,
    "save_count" integer DEFAULT 0,
    "message_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "sold_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    "search_vector" "tsvector" GENERATED ALWAYS AS (("setweight"("to_tsvector"('"english"'::"regconfig", COALESCE("title", ''::"text")), 'A'::"char") || "setweight"("to_tsvector"('"english"'::"regconfig", COALESCE("description", ''::"text")), 'B'::"char"))) STORED,
    "source_type" "text",
    "source_id" "uuid",
    -- Marketplace redesign (migration 064)
    "layer" "public"."listing_layer" DEFAULT 'goods'::"public"."listing_layer",
    "listing_type" "public"."listing_type" DEFAULT 'sell_item'::"public"."listing_type",
    "home_id" "uuid",
    "is_address_attached" boolean DEFAULT false,
    "expires_at" timestamp with time zone,
    "last_refreshed_at" timestamp with time zone,
    "refresh_count" integer DEFAULT 0,
    "quality_score" numeric(4,2) DEFAULT 0.00,
    "risk_score" numeric(4,2) DEFAULT 0.00,
    "context_tags" "text"[] DEFAULT '{}'::"text"[],
    "is_wanted" boolean DEFAULT false,
    "budget_max" numeric(10,2),
    CONSTRAINT "Listing_price_check" CHECK ((("price" >= (0)::numeric) OR ("price" IS NULL))),
    CONSTRAINT "listing_source_type_check" CHECK ((("source_type" IS NULL) OR ("source_type" = ANY (ARRAY['gig'::"text", 'post'::"text"])))),
    CONSTRAINT "listing_layer_type_check" CHECK (
      (("layer" = 'goods' AND "listing_type" IN ('sell_item', 'free_item', 'wanted_request'))
      OR ("layer" = 'gigs' AND "listing_type" = 'service_gig')
      OR ("layer" = 'rentals' AND "listing_type" = 'rent_sublet')
      OR ("layer" = 'vehicles' AND "listing_type" IN ('vehicle_sale', 'vehicle_rent')))
    ),
    CONSTRAINT "Listing_quality_score_check" CHECK (("quality_score" >= 0 AND "quality_score" <= 10)),
    CONSTRAINT "Listing_risk_score_check" CHECK (("risk_score" >= 0 AND "risk_score" <= 10)),
    CONSTRAINT "Listing_budget_max_check" CHECK (("budget_max" IS NULL OR "budget_max" >= 0))
);


ALTER TABLE "public"."Listing" OWNER TO "postgres";


COMMENT ON COLUMN "public"."Listing"."source_type" IS 'Type of source object this listing was created from: gig, post';



COMMENT ON COLUMN "public"."Listing"."source_id" IS 'ID of the source object this listing was created from';



CREATE TABLE IF NOT EXISTS "public"."ListingInventorySlot" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "layer" "public"."listing_layer" NOT NULL,
    "active_count" integer DEFAULT 0,
    "max_count" integer NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    PRIMARY KEY ("id"),
    UNIQUE ("home_id", "layer"),
    FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."ListingInventorySlot" OWNER TO "postgres";

ALTER TABLE "public"."ListingInventorySlot" ENABLE ROW LEVEL SECURITY;



CREATE TABLE IF NOT EXISTS "public"."ListingMessage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "buyer_id" "uuid" NOT NULL,
    "seller_id" "uuid" NOT NULL,
    "offer_amount" numeric(10,2),
    "message" "text",
    "status" character varying(50) DEFAULT 'pending'::character varying,
    "chat_room_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ListingMessage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ListingQuestion" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "asked_by" "uuid" NOT NULL,
    "question" "text" NOT NULL,
    "answer" "text",
    "answered_by" "uuid",
    "answered_at" timestamp with time zone,
    "is_pinned" boolean DEFAULT false,
    "upvote_count" integer DEFAULT 0,
    "status" "text" DEFAULT 'open'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "question_attachments" "text"[] DEFAULT '{}'::"text"[],
    "answer_attachments" "text"[] DEFAULT '{}'::"text"[],
    CONSTRAINT "ListingQuestion_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'answered'::"text"])))
);


ALTER TABLE "public"."ListingQuestion" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ListingQuestionUpvote" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "question_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ListingQuestionUpvote" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ListingReport" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "reported_by" "uuid" NOT NULL,
    "reason" character varying(100) NOT NULL,
    "details" "text",
    "status" character varying(50) DEFAULT 'pending'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "resolved_at" timestamp with time zone,
    CONSTRAINT "ListingReport_reason_check" CHECK ((("reason")::"text" = ANY (ARRAY['scam'::"text", 'prohibited'::"text", 'counterfeit'::"text", 'harassment'::"text", 'spam'::"text", 'inappropriate'::"text", 'other'::"text"]))),
    CONSTRAINT "ListingReport_status_check" CHECK ((("status")::"text" = ANY (ARRAY['pending'::"text", 'reviewed'::"text", 'resolved'::"text", 'dismissed'::"text"])))
);


ALTER TABLE "public"."ListingReport" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ListingSave" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ListingSave" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ListingView" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ListingView" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Mail" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipient_user_id" "uuid",
    "recipient_home_id" "uuid",
    "sender_user_id" "uuid",
    "sender_business_name" character varying(255),
    "sender_address" "text",
    "type" character varying(50) NOT NULL,
    "subject" character varying(500),
    "content" "text" NOT NULL,
    "attachments" "text"[] DEFAULT '{}'::"text"[],
    "viewed" boolean DEFAULT false,
    "viewed_at" timestamp with time zone,
    "archived" boolean DEFAULT false,
    "starred" boolean DEFAULT false,
    "payout_amount" numeric(10,2),
    "payout_status" character varying(50),
    "payout_at" timestamp with time zone,
    "category" character varying(100),
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "priority" character varying(20) DEFAULT 'normal'::character varying,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "object_id" "uuid",
    "content_excerpt" "text",
    "first_opened_at" timestamp with time zone,
    "last_opened_at" timestamp with time zone,
    "total_read_time_ms" bigint DEFAULT 0 NOT NULL,
    "view_count" integer DEFAULT 0 NOT NULL,
    "delivery_target_type" "text",
    "delivery_target_id" "uuid",
    "address_home_id" "uuid",
    "attn_user_id" "uuid",
    "attn_label" "text",
    "delivery_visibility" "text",
    "mail_type" "text",
    "display_title" "text",
    "preview_text" "text",
    "primary_action" "text",
    "action_required" boolean DEFAULT false NOT NULL,
    "ack_required" boolean DEFAULT false NOT NULL,
    "ack_status" "text",
    "sender_entity_id" "uuid",
    "recipient_type" "text",
    "recipient_id" "uuid",
    "address_id" "uuid",
    "mail_extracted" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "drawer" "text" DEFAULT 'personal'::"text",
    "recipient_name" "text",
    "recipient_address_id" "uuid",
    "sender_display" "text",
    "sender_logo_url" "text",
    "sender_trust" "text" DEFAULT 'unknown'::"text",
    "urgency" "text" DEFAULT 'none'::"text",
    "privacy" "text" DEFAULT 'private_to_person'::"text",
    "lifecycle" "text" DEFAULT 'delivered'::"text",
    "due_date" "date",
    "opened_at" timestamp with time zone,
    "key_facts" "jsonb" DEFAULT '[]'::"jsonb",
    "mail_object_type" "text" DEFAULT 'envelope'::"text",
    "routing_confidence" real,
    "routing_method" "text",
    "certified" boolean DEFAULT false,
    "requires_acknowledgment" boolean DEFAULT false,
    "acknowledged_at" timestamp with time zone,
    "acknowledged_by" "uuid",
    "audit_trail" "jsonb" DEFAULT '[]'::"jsonb",
    "legal_timestamp" "text",
    "sender_confirmation_url" "text",
    "page_count" integer,
    "cover_image_url" "text",
    "download_url" "text",
    "download_size_bytes" bigint,
    "streaming_available" boolean DEFAULT false,
    "bundle_id" "uuid",
    "bundle_label" "text",
    "bundle_type" "text",
    "collapsed_by_default" boolean DEFAULT true,
    "bundle_item_count" integer DEFAULT 0,
    "vault_folder_id" "uuid",
    "community_published" boolean DEFAULT false,
    "translation_text" "text",
    "translation_lang" "text",
    "translation_cached_at" timestamp with time zone,
    "stamp_id" "uuid",
    "time_limited_expires_at" timestamp with time zone,
    "access_count_max" integer,
    "access_count_used" integer DEFAULT 0,
    "linked_task_id" "uuid",
    CONSTRAINT "Mail_ack_status_check" CHECK ((("ack_status" IS NULL) OR ("ack_status" = ANY (ARRAY['pending'::"text", 'acknowledged'::"text"])))),
    CONSTRAINT "Mail_bundle_type_check" CHECK ((("bundle_type" IS NULL) OR ("bundle_type" = ANY (ARRAY['auto'::"text", 'manual'::"text", 'sender_grouped'::"text", 'date_grouped'::"text"])))),
    CONSTRAINT "Mail_check" CHECK (((("recipient_user_id" IS NOT NULL) AND ("recipient_home_id" IS NULL)) OR (("recipient_user_id" IS NULL) AND ("recipient_home_id" IS NOT NULL)) OR (("recipient_user_id" IS NOT NULL) AND ("recipient_home_id" IS NOT NULL)))),
    CONSTRAINT "Mail_delivery_target_type_check" CHECK ((("delivery_target_type" IS NULL) OR ("delivery_target_type" = ANY (ARRAY['home'::"text", 'user'::"text"])))),
    CONSTRAINT "Mail_delivery_visibility_check" CHECK ((("delivery_visibility" IS NULL) OR ("delivery_visibility" = ANY (ARRAY['home_members'::"text", 'attn_only'::"text", 'attn_plus_admins'::"text"])))),
    CONSTRAINT "Mail_drawer_check" CHECK ((("drawer" IS NULL) OR ("drawer" = ANY (ARRAY['personal'::"text", 'home'::"text", 'business'::"text", 'earn'::"text"])))),
    CONSTRAINT "Mail_lifecycle_check" CHECK ((("lifecycle" IS NULL) OR ("lifecycle" = ANY (ARRAY['delivered'::"text", 'opened'::"text", 'filed'::"text", 'shredded'::"text", 'forwarded'::"text", 'claimed'::"text", 'archived'::"text"])))),
    CONSTRAINT "Mail_mail_object_type_check" CHECK ((("mail_object_type" IS NULL) OR ("mail_object_type" = ANY (ARRAY['envelope'::"text", 'postcard'::"text", 'package'::"text", 'booklet'::"text", 'bundle'::"text"])))),
    CONSTRAINT "Mail_mail_type_check" CHECK ((("mail_type" IS NULL) OR ("mail_type" = ANY (ARRAY['letter'::"text", 'packet'::"text", 'bill'::"text", 'book'::"text", 'notice'::"text", 'promotion'::"text", 'other'::"text"])))),
    CONSTRAINT "Mail_payout_status_check" CHECK ((("payout_status")::"text" = ANY ((ARRAY['pending'::character varying, 'paid'::character varying, 'failed'::character varying, NULL::character varying])::"text"[]))),
    CONSTRAINT "Mail_primary_action_check" CHECK ((("primary_action" IS NULL) OR ("primary_action" = ANY (ARRAY['open'::"text", 'review'::"text", 'read'::"text", 'view_bill'::"text", 'open_packet'::"text"])))),
    CONSTRAINT "Mail_priority_check" CHECK ((("priority")::"text" = ANY ((ARRAY['low'::character varying, 'normal'::character varying, 'high'::character varying, 'urgent'::character varying])::"text"[]))),
    CONSTRAINT "Mail_privacy_check" CHECK ((("privacy" IS NULL) OR ("privacy" = ANY (ARRAY['private_to_person'::"text", 'shared_household'::"text", 'business_team'::"text"])))),
    CONSTRAINT "Mail_recipient_type_check" CHECK ((("recipient_type" IS NULL) OR ("recipient_type" = ANY (ARRAY['user'::"text", 'home'::"text"])))),
    CONSTRAINT "Mail_sender_trust_check" CHECK ((("sender_trust" IS NULL) OR ("sender_trust" = ANY (ARRAY['verified_gov'::"text", 'verified_utility'::"text", 'verified_business'::"text", 'pantopus_user'::"text", 'unknown'::"text"])))),
    CONSTRAINT "Mail_type_check" CHECK ((("type")::"text" = ANY ((ARRAY['ad'::character varying, 'letter'::character varying, 'bill'::character varying, 'statement'::character varying, 'notice'::character varying, 'package'::character varying, 'newsletter'::character varying, 'promotion'::character varying, 'document'::character varying, 'other'::character varying])::"text"[]))),
    CONSTRAINT "Mail_urgency_check" CHECK ((("urgency" IS NULL) OR ("urgency" = ANY (ARRAY['none'::"text", 'due_soon'::"text", 'overdue'::"text", 'time_sensitive'::"text"]))))
);


ALTER TABLE "public"."Mail" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."MailAction" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mail_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "action_type" character varying(50) NOT NULL,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "MailAction_action_type_check" CHECK ((("action_type")::"text" = ANY (ARRAY['viewed'::"text", 'clicked'::"text", 'starred'::"text", 'unstarred'::"text", 'archived'::"text", 'unarchived'::"text", 'deleted'::"text", 'forwarded'::"text", 'reported'::"text", 'opened'::"text", 'closed'::"text", 'engaged'::"text"])))
);


ALTER TABLE "public"."MailAction" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."MailAlias" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "home_id" "uuid" NOT NULL,
    "alias" "text" NOT NULL,
    "alias_normalized" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."MailAlias" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."MailAnalyticsSummary" AS
SELECT
    NULL::"uuid" AS "mail_id",
    NULL::character varying(50) AS "type",
    NULL::timestamp with time zone AS "created_at",
    NULL::boolean AS "viewed",
    NULL::timestamp with time zone AS "viewed_at",
    NULL::integer AS "view_count",
    NULL::bigint AS "total_read_time_ms",
    NULL::bigint AS "read_sessions",
    NULL::numeric(12,2) AS "avg_session_ms",
    NULL::integer AS "max_session_ms";


ALTER VIEW "public"."MailAnalyticsSummary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."MailAssetLink" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mail_id" "uuid" NOT NULL,
    "asset_id" "uuid" NOT NULL,
    "linked_by" "uuid" NOT NULL,
    "link_type" "text" DEFAULT 'manual'::"text" NOT NULL,
    "confidence" double precision DEFAULT 1.0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "MailAssetLink_link_type_check" CHECK (("link_type" = ANY (ARRAY['manual'::"text", 'auto_detected'::"text", 'warranty'::"text", 'receipt'::"text", 'repair'::"text"])))
);


ALTER TABLE "public"."MailAssetLink" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."MailDaySettings" (
    "user_id" "uuid" NOT NULL,
    "delivery_time" time without time zone DEFAULT '08:00:00'::time without time zone,
    "timezone" "text" DEFAULT 'America/Los_Angeles'::"text",
    "enabled" boolean DEFAULT true,
    "sound_enabled" boolean DEFAULT true,
    "sound_type" "text" DEFAULT 'soft'::"text",
    "haptics_enabled" boolean DEFAULT true,
    "include_personal" boolean DEFAULT true,
    "include_home" boolean DEFAULT true,
    "include_business" boolean DEFAULT true,
    "include_earn_count" boolean DEFAULT true,
    "include_community" boolean DEFAULT false,
    "interrupt_time_sensitive" boolean DEFAULT true,
    "interrupt_packages_otd" boolean DEFAULT true,
    "interrupt_certified" boolean DEFAULT true,
    "current_theme" "text" DEFAULT 'auto'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "MailDaySettings_sound_type_check" CHECK (("sound_type" = ANY (ARRAY['off'::"text", 'soft'::"text", 'classic'::"text"])))
);


ALTER TABLE "public"."MailDaySettings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."MailEngagementEvent" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mail_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_id" "uuid",
    "event_type" "public"."mail_event_type" NOT NULL,
    "dwell_ms" integer,
    "event_meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "MailEngagementEvent_dwell_ms_check" CHECK ((("dwell_ms" IS NULL) OR ("dwell_ms" >= 0)))
);


ALTER TABLE "public"."MailEngagementEvent" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."MailEvent" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "mail_id" "uuid",
    "user_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."MailEvent" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."MailLink" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mail_item_id" "uuid" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "created_by" "text" DEFAULT 'system'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "MailLink_created_by_check" CHECK (("created_by" = ANY (ARRAY['system'::"text", 'user'::"text"]))),
    CONSTRAINT "MailLink_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'undone'::"text"]))),
    CONSTRAINT "MailLink_target_type_check" CHECK (("target_type" = ANY (ARRAY['bill'::"text", 'issue'::"text", 'package'::"text", 'document'::"text"])))
);


ALTER TABLE "public"."MailLink" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."MailMemory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "memory_type" "text" NOT NULL,
    "reference_date" "date" NOT NULL,
    "mail_item_ids" "jsonb" DEFAULT '[]'::"jsonb",
    "headline" "text" NOT NULL,
    "body" "text",
    "shown_at" timestamp with time zone,
    "dismissed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "MailMemory_memory_type_check" CHECK (("memory_type" = ANY (ARRAY['on_this_day'::"text", 'year_in_mail'::"text", 'first_mail_from_sender'::"text"])))
);


ALTER TABLE "public"."MailMemory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."MailObject" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_by_user_id" "uuid",
    "storage_provider" "text" DEFAULT 's3'::"text" NOT NULL,
    "bucket_name" "text",
    "object_key" "text",
    "object_version_id" "text",
    "format" "public"."mail_object_format" DEFAULT 'mailjson_v1'::"public"."mail_object_format" NOT NULL,
    "mime_type" "text" DEFAULT 'application/json'::"text" NOT NULL,
    "size_bytes" bigint,
    "sha256" "text",
    "status" "public"."mail_object_status" DEFAULT 'pending_upload'::"public"."mail_object_status" NOT NULL,
    "encryption_meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "object_meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "uploaded_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "MailObject_sha256_check" CHECK ((("sha256" IS NULL) OR ("sha256" ~ '^[0-9a-fA-F]{64}$'::"text"))),
    CONSTRAINT "MailObject_size_bytes_check" CHECK ((("size_bytes" IS NULL) OR ("size_bytes" >= 0))),
    CONSTRAINT "MailObject_storage_check" CHECK ((("storage_provider" = 'legacy-inline'::"text") OR (("bucket_name" IS NOT NULL) AND ("object_key" IS NOT NULL)))),
    CONSTRAINT "MailObject_storage_provider_check" CHECK (("storage_provider" = ANY (ARRAY['s3'::"text", 'supabase-storage'::"text", 'legacy-inline'::"text"])))
);


ALTER TABLE "public"."MailObject" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."MailPackage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mail_id" "uuid" NOT NULL,
    "carrier" "text",
    "tracking_id_masked" "text",
    "tracking_id_hash" "text",
    "weight_lbs" real,
    "dimensions_l" real,
    "dimensions_w" real,
    "dimensions_h" real,
    "fragile" boolean DEFAULT false,
    "estimated_value" numeric(10,2),
    "eta_earliest" timestamp with time zone,
    "eta_latest" timestamp with time zone,
    "eta_confidence" "text" DEFAULT 'medium'::"text",
    "delivery_photo_url" "text",
    "delivery_location_note" "text",
    "status" "text" DEFAULT 'pre_receipt'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "condition_photo_url" "text",
    "unboxing_video_url" "text",
    "unboxing_completed" boolean DEFAULT false,
    "warranty_saved" boolean DEFAULT false,
    "manual_saved" boolean DEFAULT false,
    "gig_id" "uuid",
    "gig_type" "text",
    "gig_accepted_by" "uuid",
    "gig_accepted_at" timestamp with time zone,
    "neighbor_helper_name" "text",
    "inferred_item_name" "text",
    CONSTRAINT "MailPackage_eta_confidence_check" CHECK (("eta_confidence" = ANY (ARRAY['high'::"text", 'medium'::"text", 'low'::"text"]))),
    CONSTRAINT "MailPackage_status_check" CHECK (("status" = ANY (ARRAY['pre_receipt'::"text", 'in_transit'::"text", 'out_for_delivery'::"text", 'delivered'::"text", 'exception'::"text"])))
);


ALTER TABLE "public"."MailPackage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."MailPartyParticipant" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text",
    "joined_at" timestamp with time zone,
    "present" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."MailPartyParticipant" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."MailPartySession" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mail_id" "uuid" NOT NULL,
    "home_id" "uuid" NOT NULL,
    "initiated_by" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "opened_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    CONSTRAINT "MailPartySession_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'completed'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."MailPartySession" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."MailPreferences" (
    "user_id" "uuid" NOT NULL,
    "receive_ads" boolean DEFAULT true,
    "receive_promotions" boolean DEFAULT true,
    "receive_newsletters" boolean DEFAULT true,
    "max_ads_per_day" integer DEFAULT 5,
    "preferred_ad_categories" "text"[] DEFAULT '{}'::"text"[],
    "blocked_senders" "text"[] DEFAULT '{}'::"text"[],
    "email_notifications" boolean DEFAULT true,
    "push_notifications" boolean DEFAULT true,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."MailPreferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."MailReadSession" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mail_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "session_last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "session_ended_at" timestamp with time zone,
    "active_time_ms" integer DEFAULT 0 NOT NULL,
    "max_scroll_percent" numeric(5,2),
    "client_meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "MailReadSession_active_time_ms_check" CHECK (("active_time_ms" >= 0)),
    CONSTRAINT "MailReadSession_max_scroll_percent_check" CHECK ((("max_scroll_percent" IS NULL) OR (("max_scroll_percent" >= (0)::numeric) AND ("max_scroll_percent" <= (100)::numeric))))
);


ALTER TABLE "public"."MailReadSession" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."MailRoutingQueue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mail_id" "uuid" NOT NULL,
    "home_id" "uuid" NOT NULL,
    "recipient_name_raw" "text" NOT NULL,
    "best_match_user_id" "uuid",
    "best_match_confidence" real,
    "resolved" boolean DEFAULT false,
    "resolved_drawer" "text",
    "resolved_by" "uuid",
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."MailRoutingQueue" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."MailboxSummary" WITH ("security_invoker"='true') AS
 SELECT "auth"."uid"() AS "user_id",
    "count"(*) AS "total_mail",
    "count"(*) FILTER (WHERE ("viewed" = false)) AS "unread_count",
    "count"(*) FILTER (WHERE (("type")::"text" = 'ad'::"text")) AS "ad_count",
    "count"(*) FILTER (WHERE ((("type")::"text" = 'ad'::"text") AND ("viewed" = false))) AS "unread_ad_count",
    "count"(*) FILTER (WHERE ("starred" = true)) AS "starred_count",
    COALESCE("sum"("payout_amount") FILTER (WHERE ((("type")::"text" = 'ad'::"text") AND ("viewed" = true))), (0)::numeric) AS "total_earned",
    COALESCE("sum"("payout_amount") FILTER (WHERE ((("type")::"text" = 'ad'::"text") AND ("viewed" = false))), (0)::numeric) AS "pending_earnings"
   FROM "public"."Mail" "m"
  WHERE (("auth"."uid"() IS NOT NULL) AND ("archived" = false) AND "public"."can_view_mail"("recipient_user_id", "recipient_home_id"));


ALTER VIEW "public"."MailboxSummary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."NeighborEndorsement" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "endorser_home_id" "uuid" NOT NULL,
    "endorser_user_id" "uuid" NOT NULL,
    "business_user_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."NeighborEndorsement" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Notification" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "icon" "text" DEFAULT '🔔'::"text",
    "link" "text",
    "is_read" boolean DEFAULT false NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."Notification" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."OfferRedemption" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "offer_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "merchant_id" "uuid",
    "redemption_type" "text" DEFAULT 'code_reveal'::"text" NOT NULL,
    "order_id" "uuid",
    "order_total" numeric(10,2),
    "discount_applied" numeric(10,2),
    "code" "text",
    "code_revealed_at" timestamp with time zone,
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "redeemed_at" timestamp with time zone,
    CONSTRAINT "OfferRedemption_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'redeemed'::"text", 'expired'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "OfferRedemption_type_check" CHECK (("redemption_type" = ANY (ARRAY['in_app_order'::"text", 'code_reveal'::"text", 'save'::"text", 'in_store_qr'::"text"])))
);


ALTER TABLE "public"."OfferRedemption" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."PackageEvent" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "location" "text",
    "occurred_at" timestamp with time zone NOT NULL,
    "photo_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."PackageEvent" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."PasswordResetToken" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" character varying(255) NOT NULL,
    "token" character varying(255) NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."PasswordResetToken" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Payment" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payer_id" "uuid" NOT NULL,
    "payee_id" "uuid" NOT NULL,
    "gig_id" "uuid",
    "gig_application_id" "uuid",
    "stripe_payment_intent_id" character varying(255),
    "stripe_charge_id" character varying(255),
    "stripe_transfer_id" character varying(255),
    "amount_total" integer NOT NULL,
    "amount_subtotal" integer NOT NULL,
    "amount_platform_fee" integer NOT NULL,
    "amount_to_payee" integer NOT NULL,
    "amount_processing_fee" integer DEFAULT 0,
    "currency" character varying(3) DEFAULT 'USD'::character varying,
    "payment_status" character varying(50) DEFAULT 'pending'::character varying,
    "transfer_status" character varying(50) DEFAULT 'pending'::character varying,
    "is_escrowed" boolean DEFAULT true,
    "escrow_released_at" timestamp with time zone,
    "escrow_released_by" "uuid",
    "payment_method_type" character varying(50),
    "payment_method_last4" character varying(4),
    "payment_method_brand" character varying(50),
    "description" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "refunded_amount" integer DEFAULT 0,
    "refund_reason" "text",
    "failure_code" character varying(100),
    "failure_message" "text",
    "payment_attempted_at" timestamp with time zone,
    "payment_succeeded_at" timestamp with time zone,
    "transfer_completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "home_id" "uuid",
    "stripe_setup_intent_id" character varying(255),
    "stripe_payment_method_id" character varying(255),
    "stripe_customer_id" character varying(255),
    "captured_at" timestamp with time zone,
    "cooling_off_ends_at" timestamp with time zone,
    "transfer_scheduled_at" timestamp with time zone,
    "authorization_expires_at" timestamp with time zone,
    "off_session_auth_required" boolean DEFAULT false,
    "tip_amount" integer DEFAULT 0,
    "tip_payment_intent_id" character varying(255),
    "payment_type" character varying(50) DEFAULT 'gig_payment'::character varying,
    "dispute_id" character varying(255),
    "dispute_status" character varying(50),
    "dispute_evidence_submitted_at" timestamp with time zone,
    "risk_band" character varying(20) DEFAULT 'normal'::character varying,
    "stripe_transfer_reversal_id" character varying(255),
    "funded_from_wallet" boolean DEFAULT false,
    "wallet_transaction_id" "uuid",
    CONSTRAINT "Payment_payment_status_check" CHECK ((("payment_status")::"text" = ANY (ARRAY['none'::"text", 'setup_pending'::"text", 'ready_to_authorize'::"text", 'authorize_pending'::"text", 'authorized'::"text", 'authorization_failed'::"text", 'capture_pending'::"text", 'captured_hold'::"text", 'transfer_scheduled'::"text", 'transfer_pending'::"text", 'transferred'::"text", 'refund_pending'::"text", 'refunded_partial'::"text", 'refunded_full'::"text", 'disputed'::"text", 'canceled'::"text", 'pending'::"text", 'requires_payment_method'::"text", 'requires_confirmation'::"text", 'processing'::"text", 'succeeded'::"text", 'failed'::"text", 'refunded'::"text", 'partially_refunded'::"text"]))),
    CONSTRAINT "Payment_payment_type_check" CHECK ((("payment_type")::"text" = ANY (ARRAY['gig_payment'::"text", 'tip'::"text", 'cancellation_fee'::"text"]))),
    CONSTRAINT "Payment_transfer_status_check" CHECK ((("transfer_status")::"text" = ANY ((ARRAY['pending'::character varying, 'in_transit'::character varying, 'paid'::character varying, 'failed'::character varying, 'reversed'::character varying, 'wallet_credited'::character varying, 'partially_reversed'::character varying])::"text"[])))
);


ALTER TABLE "public"."Payment" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."PaymentMethod" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "stripe_customer_id" character varying(255) NOT NULL,
    "stripe_payment_method_id" character varying(255) NOT NULL,
    "payment_method_type" character varying(50) NOT NULL,
    "card_brand" character varying(50),
    "card_last4" character varying(4),
    "card_exp_month" integer,
    "card_exp_year" integer,
    "card_funding" character varying(20),
    "bank_name" character varying(255),
    "bank_last4" character varying(4),
    "bank_account_type" character varying(20),
    "is_default" boolean DEFAULT false,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."PaymentMethod" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Payout" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stripe_account_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "stripe_payout_id" character varying(255),
    "amount" integer NOT NULL,
    "currency" character varying(3) DEFAULT 'USD'::character varying,
    "payout_status" character varying(50) DEFAULT 'pending'::character varying,
    "destination_type" character varying(50),
    "destination_last4" character varying(4),
    "arrival_date" "date",
    "failure_code" character varying(100),
    "failure_message" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "Payout_payout_status_check" CHECK ((("payout_status")::"text" = ANY ((ARRAY['pending'::character varying, 'in_transit'::character varying, 'paid'::character varying, 'failed'::character varying, 'canceled'::character varying])::"text"[])))
);


ALTER TABLE "public"."Payout" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Post" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "home_id" "uuid",
    "content" "text" NOT NULL,
    "media_urls" "text"[] DEFAULT '{}'::"text"[],
    "media_types" "text"[] DEFAULT '{}'::"text"[],
    "media_thumbnails" "text"[],
    "media_live_urls" "text"[],
    "post_type" character varying(50) DEFAULT 'general'::character varying,
    "visibility" character varying(50) DEFAULT 'neighborhood'::character varying,
    "like_count" integer DEFAULT 0,
    "comment_count" integer DEFAULT 0,
    "share_count" integer DEFAULT 0,
    "is_pinned" boolean DEFAULT false,
    "is_edited" boolean DEFAULT false,
    "edited_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "view_count" integer DEFAULT 0,
    "is_archived" boolean DEFAULT false,
    "latitude" double precision,
    "longitude" double precision,
    "location" "public"."geography"(Point,4326),
    "location_name" "text",
    "location_address" "text",
    "title" "text",
    "post_format" "public"."post_format" DEFAULT 'standard'::"public"."post_format",
    "location_precision" "public"."location_precision" DEFAULT 'approx_area'::"public"."location_precision",
    "visibility_scope" "public"."visibility_scope" DEFAULT 'neighborhood'::"public"."visibility_scope",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "event_date" timestamp with time zone,
    "event_end_date" timestamp with time zone,
    "event_venue" "text",
    "safety_alert_kind" "public"."safety_alert_kind",
    "safety_happened_at" timestamp with time zone,
    "safety_happened_end" timestamp with time zone,
    "safety_behavior_description" "text",
    "safety_is_verified" boolean DEFAULT false,
    "deal_expires_at" timestamp with time zone,
    "deal_business_name" "text",
    "lost_found_type" "text",
    "lost_found_contact_pref" "text",
    "service_category" "text",
    "ref_listing_id" "uuid",
    "ref_task_id" "uuid",
    "radius_miles" numeric(8,2),
    "post_as" "public"."post_as_type" DEFAULT 'personal'::"public"."post_as_type",
    "audience" "public"."post_audience" DEFAULT 'nearby'::"public"."post_audience",
    "target_place_id" "uuid",
    "business_id" "uuid",
    "resolved_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    "archive_reason" "public"."archive_reason",
    "is_story" boolean DEFAULT false,
    "story_expires_at" timestamp with time zone,
    "distribution_targets" "text"[] DEFAULT '{}'::"text"[],
    "broadcast_channel_id" "uuid",
    "target_tier_rank" integer,
    "delivered_count" integer DEFAULT 0 NOT NULL,
    "read_count" integer DEFAULT 0 NOT NULL,
    "gps_timestamp" timestamp with time zone,
    "matched_business_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "matched_businesses_cache" "jsonb" DEFAULT '[]'::"jsonb",
    CONSTRAINT "Post_post_type_check" CHECK ((("post_type")::"text" = ANY ((ARRAY['general'::character varying, 'event'::character varying, 'lost_found'::character varying, 'recommendation'::character varying, 'question'::character varying, 'complaint'::character varying, 'announcement'::character varying, 'safety_alert'::character varying, 'deals_promos'::character varying, 'service_offer'::character varying, 'poll'::character varying, 'services_offers'::character varying, 'resources_howto'::character varying, 'progress_wins'::character varying, 'ask_local'::character varying, 'deal'::character varying, 'alert'::character varying, 'local_update'::character varying, 'neighborhood_win'::character varying, 'visitor_guide'::character varying, 'personal_update'::character varying])::"text"[]))),
    CONSTRAINT "Post_target_tier_rank_check" CHECK ((("target_tier_rank" IS NULL) OR (("target_tier_rank" >= 1) AND ("target_tier_rank" <= 4)))),
    CONSTRAINT "Post_visibility_check" CHECK ((("visibility")::"text" = ANY (ARRAY['public'::"text", 'neighborhood'::"text", 'followers'::"text", 'private'::"text", 'city'::"text", 'radius'::"text", 'connections'::"text"])))
);


ALTER TABLE "public"."Post" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."PostCategoryTTL" (
    "post_type" character varying(50) NOT NULL,
    "ttl_days" integer NOT NULL
);


ALTER TABLE "public"."PostCategoryTTL" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."PostComment" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "comment" "text" NOT NULL,
    "parent_comment_id" "uuid",
    "like_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_edited" boolean DEFAULT false,
    "edited_at" timestamp with time zone,
    "is_deleted" boolean DEFAULT false,
    "mentioned_business_ids" "uuid"[] DEFAULT '{}'::"uuid"[]
);


ALTER TABLE "public"."PostComment" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."PostHide" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "post_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."PostHide" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."PostLike" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."PostLike" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."PostMute" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "muted_entity_type" "public"."muted_entity_type" NOT NULL,
    "muted_entity_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "surface" "text"
);


ALTER TABLE "public"."PostMute" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."PostReport" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "reported_by" "uuid" NOT NULL,
    "reason" character varying(100) NOT NULL,
    "details" "text",
    "status" character varying(50) DEFAULT 'pending'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "resolved_at" timestamp with time zone,
    CONSTRAINT "PostReport_reason_check" CHECK ((("reason")::"text" = ANY ((ARRAY['spam'::character varying, 'harassment'::character varying, 'inappropriate'::character varying, 'misinformation'::character varying, 'other'::character varying])::"text"[]))),
    CONSTRAINT "PostReport_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'reviewed'::character varying, 'resolved'::character varying, 'dismissed'::character varying])::"text"[])))
);


ALTER TABLE "public"."PostReport" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."PostSave" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."PostSave" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."PostShare" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "share_type" character varying(50) DEFAULT 'repost'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "PostShare_share_type_check" CHECK ((("share_type")::"text" = ANY ((ARRAY['repost'::character varying, 'quote'::character varying, 'external'::character varying])::"text"[])))
);


ALTER TABLE "public"."PostShare" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."PostView" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."PostView" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Refund" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "stripe_refund_id" character varying(255),
    "amount" integer NOT NULL,
    "currency" character varying(3) DEFAULT 'USD'::character varying,
    "reason" character varying(100),
    "description" "text",
    "refund_status" character varying(50) DEFAULT 'pending'::character varying,
    "initiated_by" "uuid" NOT NULL,
    "approved_by" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "refund_succeeded_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "Refund_reason_check" CHECK ((("reason")::"text" = ANY ((ARRAY['duplicate'::character varying, 'fraudulent'::character varying, 'requested_by_customer'::character varying, 'work_not_completed'::character varying, 'other'::character varying])::"text"[]))),
    CONSTRAINT "Refund_refund_status_check" CHECK ((("refund_status")::"text" = ANY ((ARRAY['pending'::character varying, 'succeeded'::character varying, 'failed'::character varying, 'canceled'::character varying])::"text"[])))
);


ALTER TABLE "public"."Refund" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Relationship" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "requester_id" "uuid" NOT NULL,
    "addressee_id" "uuid" NOT NULL,
    "status" "public"."relationship_status" DEFAULT 'pending'::"public"."relationship_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "responded_at" timestamp with time zone,
    "blocked_by" "uuid",
    "block_reason" "text",
    "accepted_at" timestamp with time zone,
    CONSTRAINT "relationship_not_self" CHECK (("requester_id" <> "addressee_id"))
);


ALTER TABLE "public"."Relationship" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."RelationshipPermission" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "viewer_id" "uuid" NOT NULL,
    "visibility" "public"."location_visibility_level" DEFAULT 'none'::"public"."location_visibility_level" NOT NULL,
    "delegation" "public"."delegation_level" DEFAULT 'none'::"public"."delegation_level" NOT NULL,
    "can_view_active_temporaries" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "relperm_not_self" CHECK (("owner_id" <> "viewer_id"))
);


ALTER TABLE "public"."RelationshipPermission" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Review" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "gig_id" "uuid" NOT NULL,
    "reviewer_id" "uuid" NOT NULL,
    "reviewee_id" "uuid" NOT NULL,
    "rating" integer NOT NULL,
    "comment" "text",
    "media_urls" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "owner_response" "text",
    "owner_responded_at" timestamp with time zone,
    CONSTRAINT "Review_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."Review" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."SavedPlace" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "place_type" "text" DEFAULT 'searched'::"text" NOT NULL,
    "latitude" double precision NOT NULL,
    "longitude" double precision NOT NULL,
    "city" "text",
    "state" "text",
    "source_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."SavedPlace" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."SeasonalTheme" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "season" "text",
    "background_palette" "jsonb" DEFAULT '[]'::"jsonb",
    "mailbox_illustration_url" "text",
    "card_texture" "text",
    "accent_color" "text",
    "auto_apply" boolean DEFAULT false,
    "active_from" "date",
    "active_until" "date",
    "unlock_condition" "text" DEFAULT 'default'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "SeasonalTheme_season_check" CHECK (("season" = ANY (ARRAY['spring'::"text", 'summer'::"text", 'autumn'::"text", 'winter'::"text", 'custom'::"text"]))),
    CONSTRAINT "SeasonalTheme_unlock_condition_check" CHECK (("unlock_condition" = ANY (ARRAY['default'::"text", 'stamp_milestone'::"text", 'earned'::"text", 'seasonal_auto'::"text", 'premium'::"text"])))
);


ALTER TABLE "public"."SeasonalTheme" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Stamp" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "stamp_type" "text" NOT NULL,
    "rarity" "text" DEFAULT 'common'::"text" NOT NULL,
    "earned_at" timestamp with time zone DEFAULT "now"(),
    "earned_by" "text",
    "name" "text" NOT NULL,
    "description" "text",
    "visual_url" "text",
    "color_palette" "jsonb" DEFAULT '[]'::"jsonb",
    "displayed_in_gallery" boolean DEFAULT true,
    CONSTRAINT "Stamp_rarity_check" CHECK (("rarity" = ANY (ARRAY['common'::"text", 'uncommon'::"text", 'rare'::"text", 'legendary'::"text"])))
);


ALTER TABLE "public"."Stamp" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."StripeAccount" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "stripe_account_id" character varying(255) NOT NULL,
    "account_type" character varying(50) DEFAULT 'express'::character varying,
    "onboarding_completed" boolean DEFAULT false,
    "details_submitted" boolean DEFAULT false,
    "charges_enabled" boolean DEFAULT false,
    "payouts_enabled" boolean DEFAULT false,
    "verification_status" character varying(50) DEFAULT 'pending'::character varying,
    "verification_fields_needed" "text"[] DEFAULT '{}'::"text"[],
    "business_type" character varying(50),
    "country" character varying(2) DEFAULT 'US'::character varying,
    "currency" character varying(3) DEFAULT 'USD'::character varying,
    "card_payments_enabled" boolean DEFAULT false,
    "transfers_enabled" boolean DEFAULT false,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "requirements" "jsonb" DEFAULT '{}'::"jsonb",
    "last_synced_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tax_forms_status" character varying(50),
    "business_profile_mcc_snapshot" character varying(10),
    CONSTRAINT "StripeAccount_account_type_check" CHECK ((("account_type")::"text" = ANY ((ARRAY['express'::character varying, 'standard'::character varying, 'custom'::character varying])::"text"[]))),
    CONSTRAINT "StripeAccount_verification_status_check" CHECK ((("verification_status")::"text" = ANY ((ARRAY['pending'::character varying, 'verified'::character varying, 'unverified'::character varying, 'under_review'::character varying, 'rejected'::character varying])::"text"[])))
);


ALTER TABLE "public"."StripeAccount" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."StripeWebhookEvent" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stripe_event_id" character varying(255) NOT NULL,
    "event_type" character varying(255) NOT NULL,
    "event_data" "jsonb" NOT NULL,
    "processed" boolean DEFAULT false,
    "processed_at" timestamp with time zone,
    "processing_error" "text",
    "retry_count" integer DEFAULT 0,
    "api_version" character varying(50),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."StripeWebhookEvent" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Subscription" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "stripe_subscription_id" character varying(255),
    "stripe_customer_id" character varying(255) NOT NULL,
    "subscription_status" character varying(50) DEFAULT 'incomplete'::character varying,
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "cancel_at_period_end" boolean DEFAULT false,
    "trial_start" timestamp with time zone,
    "trial_end" timestamp with time zone,
    "canceled_at" timestamp with time zone,
    "cancellation_reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "Subscription_subscription_status_check" CHECK ((("subscription_status")::"text" = ANY ((ARRAY['incomplete'::character varying, 'incomplete_expired'::character varying, 'trialing'::character varying, 'active'::character varying, 'past_due'::character varying, 'canceled'::character varying, 'unpaid'::character varying, 'paused'::character varying])::"text"[])))
);


ALTER TABLE "public"."Subscription" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."SubscriptionPlan" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_name" character varying(255) NOT NULL,
    "plan_description" "text",
    "stripe_product_id" character varying(255),
    "stripe_price_id" character varying(255),
    "amount" integer NOT NULL,
    "currency" character varying(3) DEFAULT 'USD'::character varying,
    "billing_interval" character varying(20) NOT NULL,
    "billing_interval_count" integer DEFAULT 1,
    "trial_period_days" integer DEFAULT 0,
    "features" "jsonb" DEFAULT '[]'::"jsonb",
    "is_active" boolean DEFAULT true,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "SubscriptionPlan_billing_interval_check" CHECK ((("billing_interval")::"text" = ANY ((ARRAY['day'::character varying, 'week'::character varying, 'month'::character varying, 'year'::character varying])::"text"[])))
);


ALTER TABLE "public"."SubscriptionPlan" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."User" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" character varying(255) NOT NULL,
    "username" character varying(30) NOT NULL,
    "first_name" character varying(255),
    "last_name" character varying(255),
    "name" character varying(255),
    "phone_number" character varying(20),
    "date_of_birth" "date",
    "address" character varying(255),
    "city" character varying(100),
    "state" character varying(50),
    "zipcode" character varying(20),
    "account_type" character varying(50) DEFAULT 'individual'::character varying,
    "role" character varying(50) DEFAULT 'user'::character varying,
    "verified" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "profile_picture_url" "text",
    "cover_photo_url" "text",
    "profile_picture_file_id" "uuid",
    "cover_photo_file_id" "uuid",
    "bio" "text",
    "tagline" character varying(255),
    "social_links" "jsonb" DEFAULT '{}'::"jsonb",
    "middle_name" character varying(255),
    "average_rating" numeric(3,2) DEFAULT NULL::numeric,
    "review_count" integer DEFAULT 0,
    "followers_count" integer DEFAULT 0,
    "no_show_count" integer DEFAULT 0,
    "late_cancel_count" integer DEFAULT 0,
    "gigs_completed" integer DEFAULT 0,
    "gigs_posted" integer DEFAULT 0,
    "reliability_score" numeric(5,2) DEFAULT 100.00,
    "stripe_customer_id" character varying(255),
    "profile_visibility" character varying(20) DEFAULT 'public'::character varying,
    "show_email" boolean DEFAULT false,
    "show_phone" boolean DEFAULT false,
    "mailbox_notification_time" time without time zone DEFAULT '08:00:00'::time without time zone,
    "mail_party_enabled" boolean DEFAULT true,
    "earn_suspended_until" timestamp with time zone,
    "mail_day_enabled" boolean DEFAULT true,
    "mail_day_time" time without time zone DEFAULT '08:00:00'::time without time zone,
    "preferred_language" "text" DEFAULT 'en'::"text",
    "streak_days" integer DEFAULT 0,
    "streak_last_date" "date",
    "vacation_mode" boolean DEFAULT false,
    "vacation_start" "date",
    "vacation_end" "date",
    CONSTRAINT "User_account_type_check" CHECK ((("account_type")::"text" = ANY ((ARRAY['individual'::character varying, 'business'::character varying])::"text"[])))
);


ALTER TABLE "public"."User" OWNER TO "postgres";


COMMENT ON COLUMN "public"."User"."reliability_score" IS '0-100 score. Starts at 100, decreases with no-shows and late cancels';



CREATE TABLE IF NOT EXISTS "public"."UserCertification" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "certification_name" character varying(255) NOT NULL,
    "issuing_organization" character varying(255) NOT NULL,
    "credential_id" character varying(100),
    "credential_url" "text",
    "certificate_file_id" "uuid",
    "certificate_url" "text",
    "issue_date" "date" NOT NULL,
    "expiry_date" "date",
    "is_verified" boolean DEFAULT false,
    "show_on_profile" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."UserCertification" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."UserChatRooms" WITH ("security_invoker"='true') AS
 SELECT "cp"."user_id",
    "cr"."id" AS "room_id",
    "cr"."type",
    "cr"."name",
    "cr"."gig_id",
    "cr"."home_id",
    "cp"."unread_count",
    "cp"."last_read_at",
    ( SELECT "ChatMessage"."message"
           FROM "public"."ChatMessage"
          WHERE ("ChatMessage"."room_id" = "cr"."id")
          ORDER BY "ChatMessage"."created_at" DESC
         LIMIT 1) AS "last_message",
    ( SELECT "ChatMessage"."created_at"
           FROM "public"."ChatMessage"
          WHERE ("ChatMessage"."room_id" = "cr"."id")
          ORDER BY "ChatMessage"."created_at" DESC
         LIMIT 1) AS "last_message_at"
   FROM ("public"."ChatParticipant" "cp"
     JOIN "public"."ChatRoom" "cr" ON (("cp"."room_id" = "cr"."id")))
  WHERE (("cp"."is_active" = true) AND ("cr"."is_active" = true));


ALTER VIEW "public"."UserChatRooms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."UserExperience" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "experience_type" character varying(50),
    "title" character varying(255) NOT NULL,
    "organization" character varying(255) NOT NULL,
    "location" character varying(255),
    "description" "text",
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "is_current" boolean DEFAULT false,
    "media_urls" "text"[] DEFAULT '{}'::"text"[],
    "file_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "skills_used" "text"[] DEFAULT '{}'::"text"[],
    "display_order" integer DEFAULT 0,
    "show_on_profile" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "UserExperience_experience_type_check" CHECK ((("experience_type")::"text" = ANY ((ARRAY['work'::character varying, 'education'::character varying, 'volunteer'::character varying, 'gig'::character varying])::"text"[])))
);


ALTER TABLE "public"."UserExperience" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."UserFeedPreference" (
    "user_id" "uuid" NOT NULL,
    "hide_deals_place" boolean DEFAULT false NOT NULL,
    "hide_alerts_place" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."UserFeedPreference" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."UserFollow" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "follower_id" "uuid" NOT NULL,
    "following_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "UserFollow_check" CHECK (("follower_id" <> "following_id"))
);


ALTER TABLE "public"."UserFollow" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."UserPaymentSummary" WITH ("security_invoker"='true') AS
 SELECT "u"."id" AS "user_id",
    "u"."username",
    "count"(DISTINCT "p_payee"."id") AS "payments_received_count",
    COALESCE("sum"("p_payee"."amount_to_payee"), (0)::bigint) AS "total_earned",
    COALESCE("sum"(
        CASE
            WHEN (("p_payee"."payment_status")::"text" = 'succeeded'::"text") THEN "p_payee"."amount_to_payee"
            ELSE 0
        END), (0)::bigint) AS "total_paid_out",
    COALESCE("sum"(
        CASE
            WHEN (("p_payee"."is_escrowed" = true) AND ("p_payee"."escrow_released_at" IS NULL)) THEN "p_payee"."amount_to_payee"
            ELSE 0
        END), (0)::bigint) AS "total_in_escrow",
    "count"(DISTINCT "p_payer"."id") AS "payments_made_count",
    COALESCE("sum"("p_payer"."amount_total"), (0)::bigint) AS "total_spent",
    "sa"."charges_enabled" AS "can_receive_payments",
    "sa"."payouts_enabled" AS "can_receive_payouts",
    "sa"."onboarding_completed" AS "stripe_setup_complete"
   FROM ((("public"."User" "u"
     LEFT JOIN "public"."Payment" "p_payee" ON (("u"."id" = "p_payee"."payee_id")))
     LEFT JOIN "public"."Payment" "p_payer" ON (("u"."id" = "p_payer"."payer_id")))
     LEFT JOIN "public"."StripeAccount" "sa" ON (("u"."id" = "sa"."user_id")))
  GROUP BY "u"."id", "u"."username", "sa"."charges_enabled", "sa"."payouts_enabled", "sa"."onboarding_completed";


ALTER VIEW "public"."UserPaymentSummary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."UserPlace" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "kind" "public"."user_place_kind" DEFAULT 'other'::"public"."user_place_kind" NOT NULL,
    "label" "text" NOT NULL,
    "notes" "text",
    "address" "text",
    "city" "text",
    "state" "text",
    "zipcode" "text",
    "country" "text" DEFAULT 'US'::"text",
    "location" "public"."geography"(Point,4326),
    "valid_from" timestamp with time zone,
    "valid_to" timestamp with time zone,
    "is_favorite" boolean DEFAULT false,
    "hide_exact" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."UserPlace" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."UserPortfolio" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" character varying(255) NOT NULL,
    "description" "text",
    "portfolio_type" character varying(50),
    "media_urls" "text"[] DEFAULT '{}'::"text"[],
    "thumbnail_url" "text",
    "file_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "skills_used" "text"[] DEFAULT '{}'::"text"[],
    "external_url" "text",
    "github_url" "text",
    "demo_url" "text",
    "completed_at" "date",
    "display_order" integer DEFAULT 0,
    "is_featured" boolean DEFAULT false,
    "is_visible" boolean DEFAULT true,
    "view_count" integer DEFAULT 0,
    "like_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "UserPortfolio_portfolio_type_check" CHECK ((("portfolio_type")::"text" = ANY ((ARRAY['project'::character varying, 'photo'::character varying, 'video'::character varying, 'article'::character varying, 'certificate'::character varying, 'achievement'::character varying, 'other'::character varying])::"text"[])))
);


ALTER TABLE "public"."UserPortfolio" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."UserProfessionalProfile" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "headline" "text",
    "bio" "text",
    "categories" "public"."professional_category"[] DEFAULT '{}'::"public"."professional_category"[],
    "service_area" "jsonb",
    "pricing_meta" "jsonb",
    "is_public" boolean DEFAULT true NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "verification_tier" smallint DEFAULT 0 NOT NULL,
    "verification_status" "public"."verification_status" DEFAULT 'none'::"public"."verification_status" NOT NULL,
    "verification_submitted_at" timestamp with time zone,
    "verification_completed_at" timestamp with time zone,
    "boost_multiplier" numeric(4,2) DEFAULT 1.00 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "UserProfessionalProfile_boost_multiplier_check" CHECK (("boost_multiplier" >= (0)::numeric)),
    CONSTRAINT "UserProfessionalProfile_verification_tier_check" CHECK ((("verification_tier" >= 0) AND ("verification_tier" <= 2)))
);


ALTER TABLE "public"."UserProfessionalProfile" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."UserPublicProfile" WITH ("security_invoker"='true') AS
 SELECT "id",
    "username",
    COALESCE("name", (TRIM(BOTH FROM (((COALESCE("first_name", ''::character varying))::"text" || ' '::"text") || (COALESCE("last_name", ''::character varying))::"text")))::character varying) AS "display_name",
    "profile_picture_url",
    "cover_photo_url",
    "bio",
    "tagline",
    "social_links",
    "verified",
    "created_at"
   FROM "public"."User";


ALTER VIEW "public"."UserPublicProfile" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."UserRecentLocation" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "type" "public"."viewing_location_type" DEFAULT 'searched'::"public"."viewing_location_type" NOT NULL,
    "latitude" double precision NOT NULL,
    "longitude" double precision NOT NULL,
    "radius_miles" smallint DEFAULT 100 NOT NULL,
    "source_id" "uuid",
    "city" "text",
    "state" "text",
    "zipcode" "text",
    "used_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."UserRecentLocation" OWNER TO "postgres";


COMMENT ON TABLE "public"."UserRecentLocation" IS 'Stores up to 5 recent Viewing Location selections per user. Auto-trimmed by trigger.';



CREATE TABLE IF NOT EXISTS "public"."UserSkill" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "skill_name" character varying(100) NOT NULL,
    "skill_category" character varying(100),
    "proficiency_level" character varying(50),
    "is_verified" boolean DEFAULT false,
    "verified_by" "uuid",
    "verified_at" timestamp with time zone,
    "display_order" integer DEFAULT 0,
    "show_on_profile" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "UserSkill_proficiency_level_check" CHECK ((("proficiency_level")::"text" = ANY ((ARRAY['beginner'::character varying, 'intermediate'::character varying, 'advanced'::character varying, 'expert'::character varying])::"text"[])))
);


ALTER TABLE "public"."UserSkill" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."UserViewingLocation" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "type" "public"."viewing_location_type" DEFAULT 'gps'::"public"."viewing_location_type" NOT NULL,
    "latitude" double precision NOT NULL,
    "longitude" double precision NOT NULL,
    "radius_miles" smallint DEFAULT 100 NOT NULL,
    "is_pinned" boolean DEFAULT false NOT NULL,
    "source_id" "uuid",
    "city" "text",
    "state" "text",
    "zipcode" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "UserViewingLocation_radius_chk" CHECK (("radius_miles" = ANY (ARRAY[1, 3, 10, 25, 100, 1000, 25000])))
);


ALTER TABLE "public"."UserViewingLocation" OWNER TO "postgres";


COMMENT ON TABLE "public"."UserViewingLocation" IS 'Stores each user''s active Viewing Location for Feed/Gigs/Discover. One row per user (upsert pattern).';



CREATE TABLE IF NOT EXISTS "public"."VacationHold" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "home_id" "uuid" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "hold_action" "text" DEFAULT 'hold_in_vault'::"text" NOT NULL,
    "forward_user_id" "uuid",
    "package_action" "text" DEFAULT 'ask_neighbor'::"text" NOT NULL,
    "auto_neighbor_request" boolean DEFAULT false,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "items_held_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "VacationHold_hold_action_check" CHECK (("hold_action" = ANY (ARRAY['hold_in_vault'::"text", 'forward_to_household'::"text", 'notify_urgent_only'::"text"]))),
    CONSTRAINT "VacationHold_package_action_check" CHECK (("package_action" = ANY (ARRAY['hold_at_carrier'::"text", 'ask_neighbor'::"text", 'locker'::"text"]))),
    CONSTRAINT "VacationHold_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'active'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."VacationHold" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."VaultFolder" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "home_id" "uuid",
    "drawer" "text" NOT NULL,
    "label" "text" NOT NULL,
    "icon" "text",
    "color" "text",
    "system" boolean DEFAULT false,
    "item_count" integer DEFAULT 0,
    "auto_file_rules" "jsonb" DEFAULT '[]'::"jsonb",
    "last_item_preview" "text",
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "VaultFolder_drawer_check" CHECK (("drawer" = ANY (ARRAY['personal'::"text", 'home'::"text", 'business'::"text"])))
);


ALTER TABLE "public"."VaultFolder" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."VerificationToken" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" character varying(255) NOT NULL,
    "token" character varying(255) NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."VerificationToken" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."YearInMail" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "year" integer NOT NULL,
    "total_items" integer DEFAULT 0,
    "by_drawer" "jsonb" DEFAULT '{}'::"jsonb",
    "by_type" "jsonb" DEFAULT '{}'::"jsonb",
    "top_senders" "jsonb" DEFAULT '[]'::"jsonb",
    "total_packages" integer DEFAULT 0,
    "total_earned" numeric(10,2) DEFAULT 0,
    "total_saved" numeric(10,2) DEFAULT 0,
    "first_mail_date" "date",
    "most_active_month" "text",
    "share_card_url" "text",
    "generated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."YearInMail" OWNER TO "postgres";


ALTER TABLE ONLY "public"."AdCampaign"
    ADD CONSTRAINT "AdCampaign_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."AssetPhoto"
    ADD CONSTRAINT "AssetPhoto_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."AssignmentHistory"
    ADD CONSTRAINT "AssignmentHistory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Assignment"
    ADD CONSTRAINT "Assignment_gig_id_user_id_key" UNIQUE ("gig_id", "user_id");



ALTER TABLE ONLY "public"."Assignment"
    ADD CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."BookletPage"
    ADD CONSTRAINT "BookletPage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."BookletPage"
    ADD CONSTRAINT "BookletPage_unique_page" UNIQUE ("mail_id", "page_number");



ALTER TABLE ONLY "public"."BusinessAuditLog"
    ADD CONSTRAINT "BusinessAuditLog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."BusinessCatalogCategory"
    ADD CONSTRAINT "BusinessCatalogCategory_business_user_id_slug_key" UNIQUE ("business_user_id", "slug");



ALTER TABLE ONLY "public"."BusinessCatalogCategory"
    ADD CONSTRAINT "BusinessCatalogCategory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."BusinessCatalogItem"
    ADD CONSTRAINT "BusinessCatalogItem_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."BusinessAddress"
    ADD CONSTRAINT "BusinessAddress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."BusinessAddressDecision"
    ADD CONSTRAINT "BusinessAddressDecision_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."BusinessFollow"
    ADD CONSTRAINT "BusinessFollow_pkey" PRIMARY KEY ("user_id", "business_user_id");



ALTER TABLE ONLY "public"."BusinessHours"
    ADD CONSTRAINT "BusinessHours_location_id_day_of_week_open_time_key" UNIQUE ("location_id", "day_of_week", "open_time");



ALTER TABLE ONLY "public"."BusinessHours"
    ADD CONSTRAINT "BusinessHours_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."BusinessLocation"
    ADD CONSTRAINT "BusinessLocation_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."BusinessMailingAddress"
    ADD CONSTRAINT "BusinessMailingAddress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."BusinessPageBlock"
    ADD CONSTRAINT "BusinessPageBlock_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."BusinessPageRevision"
    ADD CONSTRAINT "BusinessPageRevision_page_id_revision_key" UNIQUE ("page_id", "revision");



ALTER TABLE ONLY "public"."BusinessPageRevision"
    ADD CONSTRAINT "BusinessPageRevision_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."BusinessPage"
    ADD CONSTRAINT "BusinessPage_business_user_id_slug_key" UNIQUE ("business_user_id", "slug");



ALTER TABLE ONLY "public"."BusinessPage"
    ADD CONSTRAINT "BusinessPage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."BusinessPermissionOverride"
    ADD CONSTRAINT "BusinessPermissionOverride_business_user_id_user_id_permiss_key" UNIQUE ("business_user_id", "user_id", "permission");



ALTER TABLE ONLY "public"."BusinessPermissionOverride"
    ADD CONSTRAINT "BusinessPermissionOverride_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."BusinessPrivate"
    ADD CONSTRAINT "BusinessPrivate_pkey" PRIMARY KEY ("business_user_id");



ALTER TABLE ONLY "public"."BusinessProfileView"
    ADD CONSTRAINT "BusinessProfileView_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."BusinessProfile"
    ADD CONSTRAINT "BusinessProfile_pkey" PRIMARY KEY ("business_user_id");



ALTER TABLE ONLY "public"."BusinessRolePermission"
    ADD CONSTRAINT "BusinessRolePermission_pkey" PRIMARY KEY ("role_base", "permission");



ALTER TABLE ONLY "public"."BusinessRolePreset"
    ADD CONSTRAINT "BusinessRolePreset_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."BusinessSpecialHours"
    ADD CONSTRAINT "BusinessSpecialHours_location_id_date_key" UNIQUE ("location_id", "date");



ALTER TABLE ONLY "public"."BusinessSpecialHours"
    ADD CONSTRAINT "BusinessSpecialHours_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."BusinessTeam"
    ADD CONSTRAINT "BusinessTeam_business_user_id_user_id_key" UNIQUE ("business_user_id", "user_id");



ALTER TABLE ONLY "public"."BusinessTeam"
    ADD CONSTRAINT "BusinessTeam_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ChatMessage"
    ADD CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ChatParticipant"
    ADD CONSTRAINT "ChatParticipant_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ChatParticipant"
    ADD CONSTRAINT "ChatParticipant_room_id_user_id_key" UNIQUE ("room_id", "user_id");



ALTER TABLE ONLY "public"."ChatRoom"
    ADD CONSTRAINT "ChatRoom_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ChatTyping"
    ADD CONSTRAINT "ChatTyping_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ChatTyping"
    ADD CONSTRAINT "ChatTyping_room_id_user_id_key" UNIQUE ("room_id", "user_id");



ALTER TABLE ONLY "public"."CommentLike"
    ADD CONSTRAINT "CommentLike_comment_id_user_id_key" UNIQUE ("comment_id", "user_id");



ALTER TABLE ONLY "public"."CommentLike"
    ADD CONSTRAINT "CommentLike_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."CommunityMailItem"
    ADD CONSTRAINT "CommunityMailItem_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."CommunityReaction"
    ADD CONSTRAINT "CommunityReaction_community_item_id_user_id_reaction_type_key" UNIQUE ("community_item_id", "user_id", "reaction_type");



ALTER TABLE ONLY "public"."CommunityReaction"
    ADD CONSTRAINT "CommunityReaction_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ConversationTopic"
    ADD CONSTRAINT "ConversationTopic_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ConversationTopic"
    ADD CONSTRAINT "ConversationTopic_unique_ref" UNIQUE ("conversation_user_id_1", "conversation_user_id_2", "topic_type", "topic_ref_id");



ALTER TABLE ONLY "public"."EarnOffer"
    ADD CONSTRAINT "EarnOffer_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."EarnRiskSession"
    ADD CONSTRAINT "EarnRiskSession_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."EarnSuspension"
    ADD CONSTRAINT "EarnSuspension_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."EarnTransaction"
    ADD CONSTRAINT "EarnTransaction_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."EarnTransaction"
    ADD CONSTRAINT "EarnTransaction_unique_user_offer" UNIQUE ("user_id", "offer_id");



ALTER TABLE ONLY "public"."EarnWallet"
    ADD CONSTRAINT "EarnWallet_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."FileAccessLog"
    ADD CONSTRAINT "FileAccessLog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."FileQuota"
    ADD CONSTRAINT "FileQuota_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."FileThumbnail"
    ADD CONSTRAINT "FileThumbnail_file_id_size_name_key" UNIQUE ("file_id", "size_name");



ALTER TABLE ONLY "public"."FileThumbnail"
    ADD CONSTRAINT "FileThumbnail_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."File"
    ADD CONSTRAINT "File_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."GigBid"
    ADD CONSTRAINT "GigBid_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."GigChangeOrder"
    ADD CONSTRAINT "GigChangeOrder_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."GigIncident"
    ADD CONSTRAINT "GigIncident_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."GigMedia"
    ADD CONSTRAINT "GigMedia_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."GigPrivateLocation"
    ADD CONSTRAINT "GigPrivateLocation_pkey" PRIMARY KEY ("gig_id");



ALTER TABLE ONLY "public"."GigQuestionUpvote"
    ADD CONSTRAINT "GigQuestionUpvote_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."GigQuestionUpvote"
    ADD CONSTRAINT "GigQuestionUpvote_question_id_user_id_key" UNIQUE ("question_id", "user_id");



ALTER TABLE ONLY "public"."GigQuestion"
    ADD CONSTRAINT "GigQuestion_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Gig"
    ADD CONSTRAINT "Gig_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."HomeAccessSecretValue"
    ADD CONSTRAINT "HomeAccessSecretValue_pkey" PRIMARY KEY ("access_secret_id");



ALTER TABLE ONLY "public"."HomeAccessSecret"
    ADD CONSTRAINT "HomeAccessSecret_home_label_uq" UNIQUE ("home_id", "access_type", "label");



ALTER TABLE ONLY "public"."HomeAccessSecret"
    ADD CONSTRAINT "HomeAccessSecret_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."AddressVerificationEvent"
    ADD CONSTRAINT "AddressVerificationEvent_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."HomeAddress"
    ADD CONSTRAINT "HomeAddress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."HomeAsset"
    ADD CONSTRAINT "HomeAsset_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."HomeAuditLog"
    ADD CONSTRAINT "HomeAuditLog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."HomeBillSplit"
    ADD CONSTRAINT "HomeBillSplit_bill_id_user_id_key" UNIQUE ("bill_id", "user_id");



ALTER TABLE ONLY "public"."HomeBillSplit"
    ADD CONSTRAINT "HomeBillSplit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."HomeBill"
    ADD CONSTRAINT "HomeBill_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."HomeBusinessLink"
    ADD CONSTRAINT "HomeBusinessLink_home_id_business_user_id_kind_key" UNIQUE ("home_id", "business_user_id", "kind");



ALTER TABLE ONLY "public"."HomeBusinessLink"
    ADD CONSTRAINT "HomeBusinessLink_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."HomeCalendarEvent"
    ADD CONSTRAINT "HomeCalendarEvent_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."HomeDevice"
    ADD CONSTRAINT "HomeDevice_home_label_uq" UNIQUE ("home_id", "device_type", "label");



ALTER TABLE ONLY "public"."HomeDevice"
    ADD CONSTRAINT "HomeDevice_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."HomeDocument"
    ADD CONSTRAINT "HomeDocument_home_id_file_id_key" UNIQUE ("home_id", "file_id");



ALTER TABLE ONLY "public"."HomeDocument"
    ADD CONSTRAINT "HomeDocument_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."HomeEmergency"
    ADD CONSTRAINT "HomeEmergency_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."HomeEstateFields"
    ADD CONSTRAINT "HomeEstateFields_pkey" PRIMARY KEY ("home_id");



ALTER TABLE ONLY "public"."HomeGuestPass"
    ADD CONSTRAINT "HomeGuestPass_home_id_token_hash_key" UNIQUE ("home_id", "token_hash");



ALTER TABLE ONLY "public"."HomeInvite"
    ADD CONSTRAINT "HomeInvite_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."HomeInvite"
    ADD CONSTRAINT "HomeInvite_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."HomeIssueSensitive"
    ADD CONSTRAINT "HomeIssueSensitive_pkey" PRIMARY KEY ("issue_id");



ALTER TABLE ONLY "public"."HomeIssue"
    ADD CONSTRAINT "HomeIssue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."HomeMaintenanceLog"
    ADD CONSTRAINT "HomeMaintenanceLog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."HomeMaintenanceTemplate"
    ADD CONSTRAINT "HomeMaintenanceTemplate_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."HomeMapPin"
    ADD CONSTRAINT "HomeMapPin_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."HomeMedia"
    ADD CONSTRAINT "HomeMedia_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."HomeOccupancy"
    ADD CONSTRAINT "HomeOccupancy_home_id_user_id_key" UNIQUE ("home_id", "user_id");



ALTER TABLE ONLY "public"."HomeOccupancy"
    ADD CONSTRAINT "HomeOccupancy_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."HomeOwner"
    ADD CONSTRAINT "HomeOwner_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."HomeOwnershipClaim"
    ADD CONSTRAINT "HomeOwnershipClaim_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."HomePackage"
    ADD CONSTRAINT "HomePackage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."HomePermissionOverride"
    ADD CONSTRAINT "HomePermissionOverride_home_id_user_id_permission_key" UNIQUE ("home_id", "user_id", "permission");



ALTER TABLE ONLY "public"."HomePermissionOverride"
    ADD CONSTRAINT "HomePermissionOverride_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."HomePostcardCode"
    ADD CONSTRAINT "HomePostcardCode_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."HomePreference"
    ADD CONSTRAINT "HomePreference_home_id_key" UNIQUE ("home_id");



ALTER TABLE ONLY "public"."HomePreference"
    ADD CONSTRAINT "HomePreference_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."HomePrivateData"
    ADD CONSTRAINT "HomePrivateData_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."HomePublicData"
    ADD CONSTRAINT "HomePublicData_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."HomeQuorumAction"
    ADD CONSTRAINT "HomeQuorumAction_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."HomeQuorumVote"
    ADD CONSTRAINT "HomeQuorumVote_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."HomeReputation"
    ADD CONSTRAINT "HomeReputation_home_id_key" UNIQUE ("home_id");



ALTER TABLE ONLY "public"."HomeReputation"
    ADD CONSTRAINT "HomeReputation_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."HomeResidencyClaim"
    ADD CONSTRAINT "HomeResidencyClaim_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."HomeRolePermission"
    ADD CONSTRAINT "HomeRolePermission_pkey" PRIMARY KEY ("role_base", "permission");



ALTER TABLE ONLY "public"."HomeRolePreset"
    ADD CONSTRAINT "HomeRolePreset_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."HomeRoleTemplateMeta"
    ADD CONSTRAINT "HomeRoleTemplateMeta_pkey" PRIMARY KEY ("role_base");



ALTER TABLE ONLY "public"."HomeRvStatus"
    ADD CONSTRAINT "HomeRvStatus_pkey" PRIMARY KEY ("home_id");



ALTER TABLE ONLY "public"."HomeSubscription"
    ADD CONSTRAINT "HomeSubscription_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."HomeTaskMedia"
    ADD CONSTRAINT "HomeTaskMedia_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."HomeTask"
    ADD CONSTRAINT "HomeTask_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."HomeVendor"
    ADD CONSTRAINT "HomeVendor_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."HomeVerificationEvidence"
    ADD CONSTRAINT "HomeVerificationEvidence_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."HomeVerification"
    ADD CONSTRAINT "HomeVerification_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Home"
    ADD CONSTRAINT "Home_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ListingMessage"
    ADD CONSTRAINT "ListingMessage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ListingQuestionUpvote"
    ADD CONSTRAINT "ListingQuestionUpvote_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ListingQuestionUpvote"
    ADD CONSTRAINT "ListingQuestionUpvote_question_id_user_id_key" UNIQUE ("question_id", "user_id");



ALTER TABLE ONLY "public"."ListingQuestion"
    ADD CONSTRAINT "ListingQuestion_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ListingReport"
    ADD CONSTRAINT "ListingReport_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ListingSave"
    ADD CONSTRAINT "ListingSave_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ListingSave"
    ADD CONSTRAINT "ListingSave_unique" UNIQUE ("listing_id", "user_id");



ALTER TABLE ONLY "public"."ListingView"
    ADD CONSTRAINT "ListingView_listing_id_user_id_key" UNIQUE ("listing_id", "user_id");



ALTER TABLE ONLY "public"."ListingView"
    ADD CONSTRAINT "ListingView_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Listing"
    ADD CONSTRAINT "Listing_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."MailAction"
    ADD CONSTRAINT "MailAction_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."MailAlias"
    ADD CONSTRAINT "MailAlias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."MailAlias"
    ADD CONSTRAINT "MailAlias_unique_alias_per_home" UNIQUE ("home_id", "alias_normalized");



ALTER TABLE ONLY "public"."MailAssetLink"
    ADD CONSTRAINT "MailAssetLink_mail_id_asset_id_key" UNIQUE ("mail_id", "asset_id");



ALTER TABLE ONLY "public"."MailAssetLink"
    ADD CONSTRAINT "MailAssetLink_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."MailDaySettings"
    ADD CONSTRAINT "MailDaySettings_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."MailEngagementEvent"
    ADD CONSTRAINT "MailEngagementEvent_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."MailEvent"
    ADD CONSTRAINT "MailEvent_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."MailLink"
    ADD CONSTRAINT "MailLink_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."MailMemory"
    ADD CONSTRAINT "MailMemory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."MailObject"
    ADD CONSTRAINT "MailObject_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."MailPackage"
    ADD CONSTRAINT "MailPackage_mail_id_unique" UNIQUE ("mail_id");



ALTER TABLE ONLY "public"."MailPackage"
    ADD CONSTRAINT "MailPackage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."MailPartyParticipant"
    ADD CONSTRAINT "MailPartyParticipant_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."MailPartyParticipant"
    ADD CONSTRAINT "MailPartyParticipant_unique" UNIQUE ("session_id", "user_id");



ALTER TABLE ONLY "public"."MailPartySession"
    ADD CONSTRAINT "MailPartySession_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."MailPreferences"
    ADD CONSTRAINT "MailPreferences_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."MailReadSession"
    ADD CONSTRAINT "MailReadSession_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."MailRoutingQueue"
    ADD CONSTRAINT "MailRoutingQueue_mail_id_unique" UNIQUE ("mail_id");



ALTER TABLE ONLY "public"."MailRoutingQueue"
    ADD CONSTRAINT "MailRoutingQueue_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."Mail"
    ADD CONSTRAINT "Mail_address_required_for_target" CHECK ((("delivery_target_type" IS NULL) OR ("delivery_target_type" = 'user'::"text") OR ("address_home_id" IS NOT NULL))) NOT VALID;



ALTER TABLE "public"."Mail"
    ADD CONSTRAINT "Mail_delivery_target_consistency" CHECK ((("delivery_target_type" IS NULL) OR (("delivery_target_type" = 'home'::"text") AND ("recipient_home_id" IS NOT NULL) AND ("delivery_target_id" = "recipient_home_id")) OR (("delivery_target_type" = 'user'::"text") AND ("recipient_user_id" IS NOT NULL) AND ("delivery_target_id" = "recipient_user_id")))) NOT VALID;



ALTER TABLE ONLY "public"."Mail"
    ADD CONSTRAINT "Mail_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."NeighborEndorsement"
    ADD CONSTRAINT "NeighborEndorsement_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."OfferRedemption"
    ADD CONSTRAINT "OfferRedemption_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."PackageEvent"
    ADD CONSTRAINT "PackageEvent_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."PasswordResetToken"
    ADD CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."PasswordResetToken"
    ADD CONSTRAINT "PasswordResetToken_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."PaymentMethod"
    ADD CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."PaymentMethod"
    ADD CONSTRAINT "PaymentMethod_stripe_payment_method_id_key" UNIQUE ("stripe_payment_method_id");



ALTER TABLE ONLY "public"."Payment"
    ADD CONSTRAINT "Payment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Payment"
    ADD CONSTRAINT "Payment_stripe_payment_intent_id_key" UNIQUE ("stripe_payment_intent_id");



ALTER TABLE ONLY "public"."Payout"
    ADD CONSTRAINT "Payout_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Payout"
    ADD CONSTRAINT "Payout_stripe_payout_id_key" UNIQUE ("stripe_payout_id");



ALTER TABLE ONLY "public"."PostCategoryTTL"
    ADD CONSTRAINT "PostCategoryTTL_pkey" PRIMARY KEY ("post_type");



ALTER TABLE ONLY "public"."PostComment"
    ADD CONSTRAINT "PostComment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."PostHide"
    ADD CONSTRAINT "PostHide_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."PostLike"
    ADD CONSTRAINT "PostLike_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."PostLike"
    ADD CONSTRAINT "PostLike_post_id_user_id_key" UNIQUE ("post_id", "user_id");



ALTER TABLE ONLY "public"."PostMute"
    ADD CONSTRAINT "PostMute_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."PostReport"
    ADD CONSTRAINT "PostReport_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."PostSave"
    ADD CONSTRAINT "PostSave_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."PostSave"
    ADD CONSTRAINT "PostSave_unique" UNIQUE ("post_id", "user_id");



ALTER TABLE ONLY "public"."PostShare"
    ADD CONSTRAINT "PostShare_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."PostView"
    ADD CONSTRAINT "PostView_post_id_user_id_key" UNIQUE ("post_id", "user_id");


ALTER TABLE ONLY "public"."PostView"
    ADD CONSTRAINT "PostView_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."Post"
    ADD CONSTRAINT "Post_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Refund"
    ADD CONSTRAINT "Refund_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Refund"
    ADD CONSTRAINT "Refund_stripe_refund_id_key" UNIQUE ("stripe_refund_id");



ALTER TABLE ONLY "public"."RelationshipPermission"
    ADD CONSTRAINT "RelationshipPermission_owner_id_viewer_id_key" UNIQUE ("owner_id", "viewer_id");



ALTER TABLE ONLY "public"."RelationshipPermission"
    ADD CONSTRAINT "RelationshipPermission_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Relationship"
    ADD CONSTRAINT "Relationship_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Review"
    ADD CONSTRAINT "Review_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Review"
    ADD CONSTRAINT "Review_unique_per_gig" UNIQUE ("gig_id", "reviewer_id");



ALTER TABLE ONLY "public"."SavedPlace"
    ADD CONSTRAINT "SavedPlace_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."SavedPlace"
    ADD CONSTRAINT "SavedPlace_user_id_latitude_longitude_key" UNIQUE ("user_id", "latitude", "longitude");



ALTER TABLE ONLY "public"."SeasonalTheme"
    ADD CONSTRAINT "SeasonalTheme_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Stamp"
    ADD CONSTRAINT "Stamp_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Stamp"
    ADD CONSTRAINT "Stamp_user_id_stamp_type_key" UNIQUE ("user_id", "stamp_type");



ALTER TABLE ONLY "public"."StripeAccount"
    ADD CONSTRAINT "StripeAccount_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."StripeAccount"
    ADD CONSTRAINT "StripeAccount_stripe_account_id_key" UNIQUE ("stripe_account_id");



ALTER TABLE ONLY "public"."StripeAccount"
    ADD CONSTRAINT "StripeAccount_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."StripeWebhookEvent"
    ADD CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."StripeWebhookEvent"
    ADD CONSTRAINT "StripeWebhookEvent_stripe_event_id_key" UNIQUE ("stripe_event_id");



ALTER TABLE ONLY "public"."SubscriptionPlan"
    ADD CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."SubscriptionPlan"
    ADD CONSTRAINT "SubscriptionPlan_stripe_price_id_key" UNIQUE ("stripe_price_id");



ALTER TABLE ONLY "public"."SubscriptionPlan"
    ADD CONSTRAINT "SubscriptionPlan_stripe_product_id_key" UNIQUE ("stripe_product_id");



ALTER TABLE ONLY "public"."Subscription"
    ADD CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Subscription"
    ADD CONSTRAINT "Subscription_stripe_subscription_id_key" UNIQUE ("stripe_subscription_id");



ALTER TABLE ONLY "public"."UserCertification"
    ADD CONSTRAINT "UserCertification_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."UserExperience"
    ADD CONSTRAINT "UserExperience_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."UserFeedPreference"
    ADD CONSTRAINT "UserFeedPreference_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."UserFollow"
    ADD CONSTRAINT "UserFollow_follower_id_following_id_key" UNIQUE ("follower_id", "following_id");



ALTER TABLE ONLY "public"."UserFollow"
    ADD CONSTRAINT "UserFollow_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."UserPlace"
    ADD CONSTRAINT "UserPlace_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."UserPortfolio"
    ADD CONSTRAINT "UserPortfolio_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."UserProfessionalProfile"
    ADD CONSTRAINT "UserProfessionalProfile_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."UserRecentLocation"
    ADD CONSTRAINT "UserRecentLocation_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."UserSkill"
    ADD CONSTRAINT "UserSkill_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."UserSkill"
    ADD CONSTRAINT "UserSkill_user_id_skill_name_key" UNIQUE ("user_id", "skill_name");



ALTER TABLE ONLY "public"."UserViewingLocation"
    ADD CONSTRAINT "UserViewingLocation_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."UserViewingLocation"
    ADD CONSTRAINT "UserViewingLocation_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."User"
    ADD CONSTRAINT "User_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."User"
    ADD CONSTRAINT "User_phone_number_key" UNIQUE ("phone_number");



ALTER TABLE ONLY "public"."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."User"
    ADD CONSTRAINT "User_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."VacationHold"
    ADD CONSTRAINT "VacationHold_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."VaultFolder"
    ADD CONSTRAINT "VaultFolder_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."VerificationToken"
    ADD CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."VerificationToken"
    ADD CONSTRAINT "VerificationToken_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."WalletTransaction"
    ADD CONSTRAINT "WalletTransaction_idempotency_key" UNIQUE ("idempotency_key");



ALTER TABLE ONLY "public"."WalletTransaction"
    ADD CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Wallet"
    ADD CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Wallet"
    ADD CONSTRAINT "Wallet_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."YearInMail"
    ADD CONSTRAINT "YearInMail_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."YearInMail"
    ADD CONSTRAINT "YearInMail_user_id_year_key" UNIQUE ("user_id", "year");



ALTER TABLE ONLY "public"."HomeResidencyClaim"
    ADD CONSTRAINT "one_pending_claim_per_user_home" UNIQUE ("user_id", "home_id");



ALTER TABLE ONLY "public"."UserProfessionalProfile"
    ADD CONSTRAINT "one_profile_per_user" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."NeighborEndorsement"
    ADD CONSTRAINT "uq_endorsement" UNIQUE ("endorser_home_id", "business_user_id", "category");



CREATE UNIQUE INDEX "PostHide_user_post_unique" ON "public"."PostHide" USING "btree" ("user_id", "post_id");



CREATE UNIQUE INDEX "PostMute_user_entity_unique" ON "public"."PostMute" USING "btree" ("user_id", "muted_entity_type", "muted_entity_id");



CREATE INDEX "PostMute_user_surface_idx" ON "public"."PostMute" USING "btree" ("user_id", "surface");



CREATE INDEX "Post_archived_at_idx" ON "public"."Post" USING "btree" ("archived_at") WHERE ("archived_at" IS NULL);



CREATE INDEX "Post_audience_idx" ON "public"."Post" USING "btree" ("audience");



CREATE INDEX "Post_business_id_idx" ON "public"."Post" USING "btree" ("business_id") WHERE ("business_id" IS NOT NULL);



CREATE INDEX "Post_cursor_idx" ON "public"."Post" USING "btree" ("created_at" DESC, "id" DESC) WHERE ("archived_at" IS NULL);



CREATE INDEX "Post_distribution_targets_idx" ON "public"."Post" USING "gin" ("distribution_targets") WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_post_broadcast_channel_created" ON "public"."Post" USING "btree" ("broadcast_channel_id", "created_at" DESC) WHERE ((("identity_context_type")::"text" = 'persona'::"text") AND ("archived_at" IS NULL));



CREATE INDEX "idx_post_persona_tier_feed" ON "public"."Post" USING "btree" ("identity_context_id", "target_tier_rank", "created_at" DESC) WHERE ((("identity_context_type")::"text" = 'persona'::"text") AND ("archived_at" IS NULL));



CREATE INDEX "Post_location_cursor_idx" ON "public"."Post" USING "gist" ("location") WHERE (("archived_at" IS NULL) AND ("location" IS NOT NULL));



CREATE INDEX "Post_nearby_feed_idx" ON "public"."Post" USING "btree" ("audience", "is_archived", "created_at" DESC) WHERE ("archived_at" IS NULL);



CREATE INDEX "Post_post_as_idx" ON "public"."Post" USING "btree" ("post_as");



CREATE INDEX "Post_story_expires_idx" ON "public"."Post" USING "btree" ("story_expires_at") WHERE ("is_story" = true);



CREATE INDEX "Post_target_place_idx" ON "public"."Post" USING "btree" ("target_place_id") WHERE ("target_place_id" IS NOT NULL);



CREATE INDEX "Post_user_cursor_idx" ON "public"."Post" USING "btree" ("user_id", "created_at" DESC, "id" DESC) WHERE ("archived_at" IS NULL);



CREATE INDEX "gig_beneficiary_idx" ON "public"."Gig" USING "btree" ("beneficiary_user_id");



CREATE INDEX "gig_created_by_idx" ON "public"."Gig" USING "btree" ("created_by");



CREATE INDEX "gig_origin_home_idx" ON "public"."Gig" USING "btree" ("origin_home_id");



CREATE INDEX "gig_origin_userplace_idx" ON "public"."Gig" USING "btree" ("origin_user_place_id");



CREATE INDEX "gigpriv_loc_gix" ON "public"."GigPrivateLocation" USING "gist" ("exact_location");



CREATE UNIQUE INDEX "homeaddress_hash_unique" ON "public"."HomeAddress" USING "btree" ("address_hash");



CREATE INDEX "HomeAddress_parcel_id_idx" ON "public"."HomeAddress" USING "btree" ("parcel_id");



CREATE INDEX "idx_addr_verif_event_address_created_at" ON "public"."AddressVerificationEvent" USING "btree" ("address_id", "created_at" DESC);



CREATE INDEX "idx_addr_verif_event_provider_created_at" ON "public"."AddressVerificationEvent" USING "btree" ("provider", "created_at" DESC) WHERE ("provider" IS NOT NULL);



CREATE INDEX "idx_addr_verif_event_type_created_at" ON "public"."AddressVerificationEvent" USING "btree" ("event_type", "created_at" DESC);



CREATE INDEX "idx_home_address_deliverability_status" ON "public"."HomeAddress" USING "btree" ("deliverability_status") WHERE ("deliverability_status" <> 'unverified'::"text");



CREATE INDEX "idx_home_address_google_place_id" ON "public"."HomeAddress" USING "btree" ("google_place_id") WHERE ("google_place_id" IS NOT NULL);



CREATE INDEX "idx_home_address_rdi_type" ON "public"."HomeAddress" USING "btree" ("rdi_type") WHERE ("rdi_type" <> 'unknown'::"text");



CREATE INDEX "homeoccupancy_home_idx" ON "public"."HomeOccupancy" USING "btree" ("home_id");



CREATE UNIQUE INDEX "homeoccupancy_unique_active" ON "public"."HomeOccupancy" USING "btree" ("home_id", "user_id") WHERE ("end_at" IS NULL);



CREATE INDEX "homeoccupancy_user_idx" ON "public"."HomeOccupancy" USING "btree" ("user_id");



CREATE UNIQUE INDEX "homeowner_primary_unique" ON "public"."HomeOwner" USING "btree" ("home_id") WHERE ("is_primary_owner" = true);



CREATE UNIQUE INDEX "homeowner_subject_unique" ON "public"."HomeOwner" USING "btree" ("home_id", "subject_type", "subject_id") WHERE ("owner_status" <> 'revoked'::"public"."owner_status_type");



CREATE INDEX "idx_ad_campaign_business" ON "public"."AdCampaign" USING "btree" ("business_user_id");



CREATE INDEX "idx_ad_campaign_location" ON "public"."AdCampaign" USING "gist" ("target_location") WHERE ("target_location" IS NOT NULL);



CREATE INDEX "idx_ad_campaign_status" ON "public"."AdCampaign" USING "btree" ("status");



CREATE INDEX "idx_asset_photo_asset" ON "public"."AssetPhoto" USING "btree" ("asset_id");



CREATE INDEX "idx_assignment_gig_id" ON "public"."Assignment" USING "btree" ("gig_id");



CREATE INDEX "idx_assignment_history_assignment_id" ON "public"."AssignmentHistory" USING "btree" ("assignment_id");



CREATE INDEX "idx_assignment_history_created_at" ON "public"."AssignmentHistory" USING "btree" ("created_at");



CREATE INDEX "idx_assignment_status" ON "public"."Assignment" USING "btree" ("current_status");



CREATE INDEX "idx_assignment_user_id" ON "public"."Assignment" USING "btree" ("user_id");



CREATE INDEX "idx_bal_business" ON "public"."BusinessAuditLog" USING "btree" ("business_user_id", "created_at" DESC);



CREATE INDEX "idx_bcc_business" ON "public"."BusinessCatalogCategory" USING "btree" ("business_user_id");



CREATE INDEX "idx_bci_active" ON "public"."BusinessCatalogItem" USING "btree" ("business_user_id") WHERE ("status" = 'active'::"text");



CREATE INDEX "idx_bci_business" ON "public"."BusinessCatalogItem" USING "btree" ("business_user_id");



CREATE INDEX "idx_bci_category" ON "public"."BusinessCatalogItem" USING "btree" ("category_id");



CREATE INDEX "idx_bci_kind" ON "public"."BusinessCatalogItem" USING "btree" ("business_user_id", "kind");



CREATE INDEX "idx_bci_tags" ON "public"."BusinessCatalogItem" USING "gin" ("tags");



CREATE UNIQUE INDEX "businessaddress_hash_unique" ON "public"."BusinessAddress" USING "btree" ("address_hash");



CREATE INDEX "idx_businessaddress_geo" ON "public"."BusinessAddress" USING "gist" ("location");



CREATE INDEX "idx_businessaddressdecision_business" ON "public"."BusinessAddressDecision" USING "btree" ("business_user_id");



CREATE INDEX "idx_businessaddressdecision_canonical" ON "public"."BusinessAddressDecision" USING "btree" ("canonical_address_id");



CREATE INDEX "idx_bf_business" ON "public"."BusinessFollow" USING "btree" ("business_user_id");



CREATE INDEX "idx_bhours_loc" ON "public"."BusinessHours" USING "btree" ("location_id");



CREATE INDEX "idx_bloc_business" ON "public"."BusinessLocation" USING "btree" ("business_user_id");



CREATE INDEX "idx_bloc_geo" ON "public"."BusinessLocation" USING "gist" ("location");



CREATE INDEX "idx_bloc_primary" ON "public"."BusinessLocation" USING "btree" ("business_user_id") WHERE ("is_primary" = true);



CREATE INDEX "idx_bloc_address_id" ON "public"."BusinessLocation" USING "btree" ("address_id");



CREATE INDEX "idx_bloc_address_hash" ON "public"."BusinessLocation" USING "btree" ("address_hash");



CREATE INDEX "idx_bloc_conflict_detect" ON "public"."BusinessLocation" USING "btree" ("address_hash", "address2") WHERE ("is_active" = true);



CREATE INDEX "idx_businessmailingaddress_business" ON "public"."BusinessMailingAddress" USING "btree" ("business_user_id");



CREATE INDEX "idx_booklet_page_mail" ON "public"."BookletPage" USING "btree" ("mail_id");



CREATE INDEX "idx_booklet_page_text_fts" ON "public"."BookletPage" USING "gin" ("to_tsvector"('"english"'::"regconfig", COALESCE("text_content", ''::"text")));



CREATE INDEX "idx_bp_categories" ON "public"."BusinessProfile" USING "gin" ("categories");



CREATE INDEX "idx_bp_published" ON "public"."BusinessProfile" USING "btree" ("business_user_id") WHERE ("is_published" = true);



CREATE INDEX "idx_bp_type" ON "public"."BusinessProfile" USING "btree" ("business_type");



CREATE INDEX "idx_bpage_business" ON "public"."BusinessPage" USING "btree" ("business_user_id");



CREATE INDEX "idx_bpage_default" ON "public"."BusinessPage" USING "btree" ("business_user_id") WHERE ("is_default" = true);



CREATE INDEX "idx_bpb_location" ON "public"."BusinessPageBlock" USING "btree" ("location_id") WHERE ("location_id" IS NOT NULL);



CREATE INDEX "idx_bpb_page_revision" ON "public"."BusinessPageBlock" USING "btree" ("page_id", "revision");



CREATE INDEX "idx_bpb_page_sort" ON "public"."BusinessPageBlock" USING "btree" ("page_id", "revision", "sort_order");



CREATE INDEX "idx_bpo_business_user" ON "public"."BusinessPermissionOverride" USING "btree" ("business_user_id", "user_id");



CREATE INDEX "idx_bpr_page" ON "public"."BusinessPageRevision" USING "btree" ("page_id", "revision" DESC);



CREATE INDEX "idx_bpv_business_viewed" ON "public"."BusinessProfileView" USING "btree" ("business_user_id", "viewed_at");



CREATE INDEX "idx_bspecial_loc_date" ON "public"."BusinessSpecialHours" USING "btree" ("location_id", "date");



CREATE INDEX "idx_bt_active" ON "public"."BusinessTeam" USING "btree" ("business_user_id") WHERE ("is_active" = true);



CREATE INDEX "idx_bt_business" ON "public"."BusinessTeam" USING "btree" ("business_user_id");



CREATE INDEX "idx_bt_user" ON "public"."BusinessTeam" USING "btree" ("user_id");



CREATE INDEX "idx_certification_file" ON "public"."UserCertification" USING "btree" ("certificate_file_id");



CREATE INDEX "idx_certification_user" ON "public"."UserCertification" USING "btree" ("user_id");



CREATE INDEX "idx_change_order_gig" ON "public"."GigChangeOrder" USING "btree" ("gig_id");



CREATE INDEX "idx_change_order_status" ON "public"."GigChangeOrder" USING "btree" ("gig_id", "status");



CREATE INDEX "idx_chat_message_created" ON "public"."ChatMessage" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_chat_message_deleted" ON "public"."ChatMessage" USING "btree" ("deleted") WHERE ("deleted" = false);



CREATE INDEX "idx_chat_message_room" ON "public"."ChatMessage" USING "btree" ("room_id");



CREATE INDEX "idx_chat_message_room_topic_created" ON "public"."ChatMessage" USING "btree" ("room_id", "topic_id", "created_at" DESC);



CREATE INDEX "idx_chat_message_topic" ON "public"."ChatMessage" USING "btree" ("topic_id") WHERE ("topic_id" IS NOT NULL);



CREATE INDEX "idx_chat_message_user" ON "public"."ChatMessage" USING "btree" ("user_id");



CREATE INDEX "idx_chat_participant_active" ON "public"."ChatParticipant" USING "btree" ("is_active");



CREATE INDEX "idx_chat_participant_room" ON "public"."ChatParticipant" USING "btree" ("room_id");



CREATE INDEX "idx_chat_participant_user" ON "public"."ChatParticipant" USING "btree" ("user_id");



CREATE INDEX "idx_chat_room_active" ON "public"."ChatRoom" USING "btree" ("is_active");



CREATE INDEX "idx_chat_room_gig" ON "public"."ChatRoom" USING "btree" ("gig_id") WHERE ("gig_id" IS NOT NULL);



CREATE INDEX "idx_chat_room_home" ON "public"."ChatRoom" USING "btree" ("home_id") WHERE ("home_id" IS NOT NULL);



CREATE INDEX "idx_chat_room_type" ON "public"."ChatRoom" USING "btree" ("type");



CREATE INDEX "idx_chat_typing_expires" ON "public"."ChatTyping" USING "btree" ("expires_at");



CREATE INDEX "idx_chat_typing_room" ON "public"."ChatTyping" USING "btree" ("room_id");



CREATE INDEX "idx_claim_home" ON "public"."HomeResidencyClaim" USING "btree" ("home_id");



CREATE INDEX "idx_claim_status" ON "public"."HomeResidencyClaim" USING "btree" ("status") WHERE ("status" = 'pending'::"public"."claim_status");



CREATE INDEX "idx_claim_user" ON "public"."HomeResidencyClaim" USING "btree" ("user_id");



CREATE INDEX "idx_comment_like_comment" ON "public"."CommentLike" USING "btree" ("comment_id");



CREATE INDEX "idx_comment_like_user" ON "public"."CommentLike" USING "btree" ("user_id");



CREATE INDEX "idx_community_mail_created" ON "public"."CommunityMailItem" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_community_mail_fts" ON "public"."CommunityMailItem" USING "gin" ("to_tsvector"('"english"'::"regconfig", ((COALESCE("title", ''::"text") || ' '::"text") || COALESCE("body", ''::"text"))));



CREATE INDEX "idx_community_mail_home" ON "public"."CommunityMailItem" USING "btree" ("home_id");



CREATE INDEX "idx_community_mail_published_to" ON "public"."CommunityMailItem" USING "btree" ("published_to");



CREATE INDEX "idx_community_mail_type" ON "public"."CommunityMailItem" USING "btree" ("community_type");



CREATE INDEX "idx_community_reaction_item" ON "public"."CommunityReaction" USING "btree" ("community_item_id");



CREATE INDEX "idx_conversation_topic_activity" ON "public"."ConversationTopic" USING "btree" ("last_activity_at" DESC);



CREATE INDEX "idx_conversation_topic_ref" ON "public"."ConversationTopic" USING "btree" ("topic_type", "topic_ref_id") WHERE ("topic_ref_id" IS NOT NULL);



CREATE INDEX "idx_conversation_topic_users" ON "public"."ConversationTopic" USING "btree" ("conversation_user_id_1", "conversation_user_id_2");



CREATE INDEX "idx_earn_offer_expires" ON "public"."EarnOffer" USING "btree" ("expires_at") WHERE ("expires_at" IS NOT NULL);



CREATE INDEX "idx_earn_offer_status" ON "public"."EarnOffer" USING "btree" ("status");



CREATE INDEX "idx_earn_risk_score" ON "public"."EarnRiskSession" USING "btree" ("risk_score") WHERE ("risk_score" >= 30);



CREATE INDEX "idx_earn_risk_user" ON "public"."EarnRiskSession" USING "btree" ("user_id");



CREATE INDEX "idx_earn_suspension_active" ON "public"."EarnSuspension" USING "btree" ("resolved") WHERE ("resolved" = false);



CREATE INDEX "idx_earn_suspension_user" ON "public"."EarnSuspension" USING "btree" ("user_id");



CREATE INDEX "idx_earn_tx_offer" ON "public"."EarnTransaction" USING "btree" ("offer_id");



CREATE INDEX "idx_earn_tx_status" ON "public"."EarnTransaction" USING "btree" ("status");



CREATE INDEX "idx_earn_tx_user" ON "public"."EarnTransaction" USING "btree" ("user_id");



CREATE INDEX "idx_endorsement_business" ON "public"."NeighborEndorsement" USING "btree" ("business_user_id", "category");



CREATE INDEX "idx_endorsement_home" ON "public"."NeighborEndorsement" USING "btree" ("endorser_home_id");



CREATE INDEX "idx_evidence_claim" ON "public"."HomeVerificationEvidence" USING "btree" ("claim_id");



CREATE INDEX "idx_experience_type" ON "public"."UserExperience" USING "btree" ("experience_type");



CREATE INDEX "idx_experience_user" ON "public"."UserExperience" USING "btree" ("user_id");



CREATE INDEX "idx_file_access_file" ON "public"."FileAccessLog" USING "btree" ("file_id");



CREATE INDEX "idx_file_access_time" ON "public"."FileAccessLog" USING "btree" ("accessed_at" DESC);



CREATE INDEX "idx_file_access_user" ON "public"."FileAccessLog" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_file_created" ON "public"."File" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_file_deleted" ON "public"."File" USING "btree" ("is_deleted") WHERE ("is_deleted" = false);



CREATE INDEX "idx_file_gig" ON "public"."File" USING "btree" ("gig_id") WHERE ("gig_id" IS NOT NULL);



CREATE INDEX "idx_file_home" ON "public"."File" USING "btree" ("home_id") WHERE ("home_id" IS NOT NULL);



CREATE INDEX "idx_file_metadata" ON "public"."File" USING "gin" ("metadata");



CREATE INDEX "idx_file_post" ON "public"."File" USING "btree" ("post_id") WHERE ("post_id" IS NOT NULL);



CREATE INDEX "idx_file_processing" ON "public"."File" USING "btree" ("processing_status") WHERE (("processing_status")::"text" <> 'completed'::"text");



CREATE INDEX "idx_file_profile_user" ON "public"."File" USING "btree" ("profile_user_id") WHERE ("profile_user_id" IS NOT NULL);



CREATE INDEX "idx_file_type" ON "public"."File" USING "btree" ("file_type");



CREATE INDEX "idx_file_user" ON "public"."File" USING "btree" ("user_id");



CREATE INDEX "idx_file_visibility" ON "public"."File" USING "btree" ("visibility");



CREATE INDEX "idx_gig_approx_location" ON "public"."Gig" USING "gist" ("approx_location");



CREATE INDEX "idx_gig_boost_active" ON "public"."Gig" USING "btree" ("boost_expires_at") WHERE ("boost_expires_at" IS NOT NULL);



CREATE INDEX "idx_gig_bid_expires_at" ON "public"."GigBid" USING "btree" ("expires_at") WHERE (("status" = 'pending'::"text") AND ("expires_at" IS NOT NULL));



CREATE INDEX "idx_gig_category" ON "public"."Gig" USING "btree" ("category");



CREATE INDEX "idx_gig_created_at" ON "public"."Gig" USING "btree" ("created_at");



CREATE INDEX "idx_gig_exact_location" ON "public"."Gig" USING "gist" ("exact_location");



CREATE INDEX "idx_gig_incident_gig" ON "public"."GigIncident" USING "btree" ("gig_id");



CREATE INDEX "idx_gig_incident_reported_against" ON "public"."GigIncident" USING "btree" ("reported_against");



CREATE INDEX "idx_gig_media_gig" ON "public"."GigMedia" USING "btree" ("gig_id", "display_order");



CREATE INDEX "idx_gig_payment_status" ON "public"."Gig" USING "btree" ("payment_status") WHERE (("payment_status")::"text" <> 'none'::"text");



CREATE INDEX "idx_gig_question_asked_by" ON "public"."GigQuestion" USING "btree" ("asked_by");



CREATE INDEX "idx_gig_question_gig" ON "public"."GigQuestion" USING "btree" ("gig_id");



CREATE INDEX "idx_gig_question_upvote_question" ON "public"."GigQuestionUpvote" USING "btree" ("question_id");



CREATE INDEX "idx_gig_ref_listing" ON "public"."Gig" USING "btree" ("ref_listing_id") WHERE ("ref_listing_id" IS NOT NULL);



CREATE INDEX "idx_gig_ref_post" ON "public"."Gig" USING "btree" ("ref_post_id") WHERE ("ref_post_id" IS NOT NULL);



CREATE INDEX "idx_gig_source" ON "public"."Gig" USING "btree" ("source_type", "source_id") WHERE ("source_type" IS NOT NULL);



CREATE INDEX "idx_gig_status" ON "public"."Gig" USING "btree" ("status");



CREATE INDEX "idx_gig_task_format" ON "public"."Gig" USING "btree" ("task_format");



CREATE INDEX "idx_gig_tags" ON "public"."Gig" USING "gin" ("tags");



CREATE INDEX "idx_gig_trust" ON "public"."Gig" USING "btree" ("accepted_by", "status", "origin_home_id", "payment_status");



CREATE INDEX "idx_gig_urgent" ON "public"."Gig" USING "btree" ("is_urgent") WHERE (("is_urgent" = true) AND (("status")::"text" = 'open'::"text"));



CREATE INDEX "idx_gig_user_id" ON "public"."Gig" USING "btree" ("user_id");



CREATE INDEX "idx_gigbid_gig_id" ON "public"."GigBid" USING "btree" ("gig_id");



CREATE INDEX "idx_gigbid_status" ON "public"."GigBid" USING "btree" ("status");



CREATE INDEX "idx_gigbid_user_id" ON "public"."GigBid" USING "btree" ("user_id");



CREATE INDEX "idx_hbl_business" ON "public"."HomeBusinessLink" USING "btree" ("business_user_id");



CREATE INDEX "idx_hbl_home" ON "public"."HomeBusinessLink" USING "btree" ("home_id");



CREATE INDEX "idx_home_access_home" ON "public"."HomeAccessSecret" USING "btree" ("home_id");



CREATE INDEX "idx_home_address_hash_active" ON "public"."Home" USING "btree" ("address_hash") WHERE ("home_status" = 'active'::"text");



CREATE INDEX "idx_home_asset_home_cat" ON "public"."HomeAsset" USING "btree" ("home_id", "category");



CREATE INDEX "idx_home_asset_serial" ON "public"."HomeAsset" USING "btree" ("serial_number") WHERE ("serial_number" IS NOT NULL);



CREATE INDEX "idx_home_audit_home_created" ON "public"."HomeAuditLog" USING "btree" ("home_id", "created_at" DESC);



CREATE INDEX "idx_home_bill_home_due" ON "public"."HomeBill" USING "btree" ("home_id", "due_date" DESC);



CREATE INDEX "idx_home_bsplit_bill" ON "public"."HomeBillSplit" USING "btree" ("bill_id");



CREATE INDEX "idx_home_bsplit_user" ON "public"."HomeBillSplit" USING "btree" ("user_id");



CREATE INDEX "idx_home_cal_home_start" ON "public"."HomeCalendarEvent" USING "btree" ("home_id", "start_at" DESC);



CREATE INDEX "idx_home_city" ON "public"."Home" USING "btree" ("city");



CREATE INDEX "idx_home_device_home" ON "public"."HomeDevice" USING "btree" ("home_id");



CREATE INDEX "idx_home_doc_home_type" ON "public"."HomeDocument" USING "btree" ("home_id", "doc_type");



CREATE INDEX "idx_home_emergency_home" ON "public"."HomeEmergency" USING "btree" ("home_id");



CREATE INDEX "idx_home_guest_pass_hash" ON "public"."HomeGuestPass" USING "btree" ("token_hash");



CREATE INDEX "idx_home_guest_pass_home" ON "public"."HomeGuestPass" USING "btree" ("home_id", "created_at" DESC);
CREATE INDEX "idx_home_household_resolution_state" ON "public"."Home" USING "btree" ("household_resolution_state");



CREATE INDEX "idx_home_invite_home" ON "public"."HomeInvite" USING "btree" ("home_id");



CREATE INDEX "idx_home_invite_invitee" ON "public"."HomeInvite" USING "btree" ("invitee_user_id") WHERE ("invitee_user_id" IS NOT NULL);



CREATE INDEX "idx_home_issue_home_status" ON "public"."HomeIssue" USING "btree" ("home_id", "status");



CREATE INDEX "idx_home_location" ON "public"."Home" USING "gist" ("location");



CREATE INDEX "idx_home_maint_log_home" ON "public"."HomeMaintenanceLog" USING "btree" ("home_id", "performed_at" DESC);



CREATE INDEX "idx_home_maint_log_status_due" ON "public"."HomeMaintenanceLog" USING "btree" ("home_id", "status", "due_date" ASC);



CREATE INDEX "idx_home_maint_tpl_home" ON "public"."HomeMaintenanceTemplate" USING "btree" ("home_id");



CREATE INDEX "idx_home_map_pin_expires" ON "public"."HomeMapPin" USING "btree" ("expires_at") WHERE ("expires_at" IS NOT NULL);



CREATE INDEX "idx_home_map_pin_geo" ON "public"."HomeMapPin" USING "btree" ("lat", "lng");



CREATE INDEX "idx_home_map_pin_home" ON "public"."HomeMapPin" USING "btree" ("home_id");



CREATE INDEX "idx_home_map_pin_type" ON "public"."HomeMapPin" USING "btree" ("pin_type");



CREATE INDEX "idx_home_media_category" ON "public"."HomeMedia" USING "btree" ("media_category");



CREATE INDEX "idx_home_media_file" ON "public"."HomeMedia" USING "btree" ("file_id");



CREATE INDEX "idx_home_media_home" ON "public"."HomeMedia" USING "btree" ("home_id");



CREATE INDEX "idx_home_media_primary" ON "public"."HomeMedia" USING "btree" ("is_primary") WHERE ("is_primary" = true);



CREATE INDEX "idx_home_occ_access_window" ON "public"."HomeOccupancy" USING "btree" ("home_id", "access_start_at", "access_end_at") WHERE ("access_end_at" IS NOT NULL);



CREATE INDEX "idx_home_occ_home_active" ON "public"."HomeOccupancy" USING "btree" ("home_id", "is_active");



CREATE INDEX "idx_home_occ_user_active" ON "public"."HomeOccupancy" USING "btree" ("user_id", "is_active");



CREATE INDEX "idx_home_occupancy_home_id" ON "public"."HomeOccupancy" USING "btree" ("home_id");



CREATE INDEX "idx_home_occupancy_user_id" ON "public"."HomeOccupancy" USING "btree" ("user_id");



CREATE INDEX "idx_home_owner_id" ON "public"."Home" USING "btree" ("owner_id");



CREATE INDEX "idx_home_parent" ON "public"."Home" USING "btree" ("parent_home_id") WHERE ("parent_home_id" IS NOT NULL);



CREATE INDEX "idx_home_perm_override_home_user" ON "public"."HomePermissionOverride" USING "btree" ("home_id", "user_id");



CREATE INDEX "idx_home_pkg_home_status" ON "public"."HomePackage" USING "btree" ("home_id", "status");



CREATE INDEX "idx_home_pkg_tracking" ON "public"."HomePackage" USING "btree" ("tracking_number") WHERE ("tracking_number" IS NOT NULL);



CREATE INDEX "idx_home_private_data_home_id" ON "public"."HomePrivateData" USING "btree" ("home_id");



CREATE INDEX "idx_home_private_data_type" ON "public"."HomePrivateData" USING "btree" ("type");



CREATE INDEX "idx_home_public_data_home_id" ON "public"."HomePublicData" USING "btree" ("home_id");



CREATE INDEX "idx_home_public_data_type" ON "public"."HomePublicData" USING "btree" ("type");



CREATE INDEX "idx_home_scoped_grant_grantee" ON "public"."HomeScopedGrant" USING "btree" ("grantee_user_id");



CREATE INDEX "idx_home_scoped_grant_home" ON "public"."HomeScopedGrant" USING "btree" ("home_id");



CREATE INDEX "idx_home_scoped_grant_resource" ON "public"."HomeScopedGrant" USING "btree" ("resource_type", "resource_id");



CREATE INDEX "idx_home_security_state" ON "public"."Home" USING "btree" ("security_state") WHERE ("security_state" <> 'normal'::"public"."home_security_state");



CREATE INDEX "idx_home_sub_home" ON "public"."HomeSubscription" USING "btree" ("home_id");



CREATE INDEX "idx_home_sub_renewal" ON "public"."HomeSubscription" USING "btree" ("renewal_date");



CREATE INDEX "idx_home_subscription_home_renewal" ON "public"."HomeSubscription" USING "btree" ("home_id", "renewal_date");



CREATE INDEX "idx_home_task_assigned" ON "public"."HomeTask" USING "btree" ("assigned_to") WHERE ("assigned_to" IS NOT NULL);



CREATE INDEX "idx_home_task_home_status" ON "public"."HomeTask" USING "btree" ("home_id", "status");



CREATE INDEX "idx_home_task_media_task" ON "public"."HomeTaskMedia" USING "btree" ("task_id");



CREATE INDEX "idx_home_vendor_home" ON "public"."HomeVendor" USING "btree" ("home_id");



CREATE INDEX "idx_home_verification_home" ON "public"."HomeVerification" USING "btree" ("home_id");



CREATE INDEX "idx_homeowner_home" ON "public"."HomeOwner" USING "btree" ("home_id");



CREATE INDEX "idx_homeowner_subject" ON "public"."HomeOwner" USING "btree" ("subject_id");



CREATE INDEX "idx_listing_category" ON "public"."Listing" USING "btree" ("category");



CREATE INDEX "idx_listing_created" ON "public"."Listing" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_listing_free" ON "public"."Listing" USING "btree" ("is_free") WHERE (("is_free" = true) AND ("status" = 'active'::"public"."listing_status"));



CREATE INDEX "idx_listing_location" ON "public"."Listing" USING "gist" ("location");



CREATE INDEX "idx_listing_price" ON "public"."Listing" USING "btree" ("price") WHERE ("status" = 'active'::"public"."listing_status");



CREATE INDEX "idx_listing_question_asker" ON "public"."ListingQuestion" USING "btree" ("asked_by");



CREATE INDEX "idx_listing_question_listing" ON "public"."ListingQuestion" USING "btree" ("listing_id");



CREATE INDEX "idx_listing_question_upvote_question" ON "public"."ListingQuestionUpvote" USING "btree" ("question_id");



CREATE INDEX "idx_listing_search" ON "public"."Listing" USING "gin" ("search_vector");



CREATE INDEX "idx_listing_status" ON "public"."Listing" USING "btree" ("status");



CREATE INDEX "idx_listing_tags" ON "public"."Listing" USING "gin" ("tags");



CREATE INDEX "idx_listing_user" ON "public"."Listing" USING "btree" ("user_id");



CREATE INDEX "idx_listingmsg_buyer" ON "public"."ListingMessage" USING "btree" ("buyer_id");



CREATE INDEX "idx_listingmsg_listing" ON "public"."ListingMessage" USING "btree" ("listing_id");



CREATE INDEX "idx_listingmsg_seller" ON "public"."ListingMessage" USING "btree" ("seller_id");



CREATE INDEX "idx_listingsave_listing" ON "public"."ListingSave" USING "btree" ("listing_id");



CREATE INDEX "idx_listingsave_user" ON "public"."ListingSave" USING "btree" ("user_id");



CREATE INDEX "idx_listingview_listing_id" ON "public"."ListingView" USING "btree" ("listing_id");



CREATE INDEX "idx_mail_action_created_at" ON "public"."MailAction" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_mail_action_mail" ON "public"."MailAction" USING "btree" ("mail_id");



CREATE INDEX "idx_mail_action_required" ON "public"."Mail" USING "btree" ("action_required") WHERE ("action_required" = true);



CREATE INDEX "idx_mail_action_type" ON "public"."MailAction" USING "btree" ("action_type");



CREATE INDEX "idx_mail_action_user" ON "public"."MailAction" USING "btree" ("user_id");



CREATE INDEX "idx_mail_address_home" ON "public"."Mail" USING "btree" ("address_home_id") WHERE ("address_home_id" IS NOT NULL);



CREATE INDEX "idx_mail_address_id" ON "public"."Mail" USING "btree" ("address_id") WHERE ("address_id" IS NOT NULL);



CREATE INDEX "idx_mail_alias_home" ON "public"."MailAlias" USING "btree" ("home_id");



CREATE INDEX "idx_mail_alias_normalized" ON "public"."MailAlias" USING "btree" ("alias_normalized");



CREATE INDEX "idx_mail_alias_user" ON "public"."MailAlias" USING "btree" ("user_id");



CREATE INDEX "idx_mail_archived" ON "public"."Mail" USING "btree" ("archived");



CREATE INDEX "idx_mail_asset_link_asset" ON "public"."MailAssetLink" USING "btree" ("asset_id");



CREATE INDEX "idx_mail_asset_link_mail" ON "public"."MailAssetLink" USING "btree" ("mail_id");



CREATE INDEX "idx_mail_attn_user" ON "public"."Mail" USING "btree" ("attn_user_id") WHERE ("attn_user_id" IS NOT NULL);



CREATE INDEX "idx_mail_bundle_id" ON "public"."Mail" USING "btree" ("bundle_id") WHERE ("bundle_id" IS NOT NULL);



CREATE INDEX "idx_mail_certified" ON "public"."Mail" USING "btree" ("certified") WHERE ("certified" = true);



CREATE INDEX "idx_mail_content_fts" ON "public"."Mail" USING "gin" ("to_tsvector"('"english"'::"regconfig", (((((COALESCE("subject", ''::character varying))::"text" || ' '::"text") || COALESCE("content", ''::"text")) || ' '::"text") || COALESCE("sender_display", ''::"text"))));



CREATE INDEX "idx_mail_created_at" ON "public"."Mail" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_mail_delivery_target" ON "public"."Mail" USING "btree" ("delivery_target_type", "delivery_target_id");



CREATE INDEX "idx_mail_drawer" ON "public"."Mail" USING "btree" ("drawer");



CREATE INDEX "idx_mail_due_date" ON "public"."Mail" USING "btree" ("due_date") WHERE ("due_date" IS NOT NULL);



CREATE INDEX "idx_mail_eng_event_mail" ON "public"."MailEngagementEvent" USING "btree" ("mail_id", "created_at" DESC);



CREATE INDEX "idx_mail_eng_event_session" ON "public"."MailEngagementEvent" USING "btree" ("session_id") WHERE ("session_id" IS NOT NULL);



CREATE INDEX "idx_mail_eng_event_user" ON "public"."MailEngagementEvent" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_mail_event_created" ON "public"."MailEvent" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_mail_event_mail_id" ON "public"."MailEvent" USING "btree" ("mail_id") WHERE ("mail_id" IS NOT NULL);



CREATE INDEX "idx_mail_event_type" ON "public"."MailEvent" USING "btree" ("event_type");



CREATE INDEX "idx_mail_event_user_id" ON "public"."MailEvent" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_mail_expires_at" ON "public"."Mail" USING "btree" ("expires_at") WHERE ("expires_at" IS NOT NULL);



CREATE INDEX "idx_mail_last_opened_at" ON "public"."Mail" USING "btree" ("last_opened_at" DESC) WHERE ("last_opened_at" IS NOT NULL);



CREATE INDEX "idx_mail_lifecycle" ON "public"."Mail" USING "btree" ("lifecycle");



CREATE INDEX "idx_mail_link_mail_item" ON "public"."MailLink" USING "btree" ("mail_item_id", "created_at" DESC);



CREATE INDEX "idx_mail_link_target" ON "public"."MailLink" USING "btree" ("target_type", "target_id");



CREATE UNIQUE INDEX "idx_mail_link_unique_target" ON "public"."MailLink" USING "btree" ("mail_item_id", "target_type", "target_id");



CREATE INDEX "idx_mail_mail_type" ON "public"."Mail" USING "btree" ("mail_type");



CREATE INDEX "idx_mail_memory_date" ON "public"."MailMemory" USING "btree" ("reference_date");



CREATE INDEX "idx_mail_memory_user" ON "public"."MailMemory" USING "btree" ("user_id");



CREATE INDEX "idx_mail_object_created_by" ON "public"."MailObject" USING "btree" ("created_by_user_id");



CREATE INDEX "idx_mail_object_id" ON "public"."Mail" USING "btree" ("object_id") WHERE ("object_id" IS NOT NULL);



CREATE INDEX "idx_mail_object_status" ON "public"."MailObject" USING "btree" ("status");



CREATE UNIQUE INDEX "idx_mail_object_storage_unique" ON "public"."MailObject" USING "btree" ("bucket_name", "object_key", COALESCE("object_version_id", ''::"text")) WHERE ("object_key" IS NOT NULL);



CREATE INDEX "idx_mail_object_type" ON "public"."Mail" USING "btree" ("mail_object_type");



CREATE INDEX "idx_mail_package_mail_id" ON "public"."MailPackage" USING "btree" ("mail_id");



CREATE INDEX "idx_mail_package_status" ON "public"."MailPackage" USING "btree" ("status");



CREATE INDEX "idx_mail_party_home" ON "public"."MailPartySession" USING "btree" ("home_id");



CREATE INDEX "idx_mail_party_mail" ON "public"."MailPartySession" USING "btree" ("mail_id");



CREATE INDEX "idx_mail_party_participant_session" ON "public"."MailPartyParticipant" USING "btree" ("session_id");



CREATE INDEX "idx_mail_party_status" ON "public"."MailPartySession" USING "btree" ("status") WHERE ("status" = ANY (ARRAY['pending'::"text", 'active'::"text"]));



CREATE INDEX "idx_mail_read_session_mail" ON "public"."MailReadSession" USING "btree" ("mail_id", "session_started_at" DESC);



CREATE UNIQUE INDEX "idx_mail_read_session_open_unique" ON "public"."MailReadSession" USING "btree" ("mail_id", "user_id") WHERE ("session_ended_at" IS NULL);



CREATE INDEX "idx_mail_read_session_user" ON "public"."MailReadSession" USING "btree" ("user_id", "session_started_at" DESC);



CREATE INDEX "idx_mail_recipient_address" ON "public"."Mail" USING "btree" ("recipient_address_id") WHERE ("recipient_address_id" IS NOT NULL);



CREATE INDEX "idx_mail_recipient_home" ON "public"."Mail" USING "btree" ("recipient_home_id") WHERE ("recipient_home_id" IS NOT NULL);



CREATE INDEX "idx_mail_recipient_scope" ON "public"."Mail" USING "btree" ("recipient_type", "recipient_id");



CREATE INDEX "idx_mail_recipient_user" ON "public"."Mail" USING "btree" ("recipient_user_id") WHERE ("recipient_user_id" IS NOT NULL);



CREATE INDEX "idx_mail_routing_queue_home" ON "public"."MailRoutingQueue" USING "btree" ("home_id");



CREATE INDEX "idx_mail_routing_queue_unresolved" ON "public"."MailRoutingQueue" USING "btree" ("resolved") WHERE ("resolved" = false);



CREATE INDEX "idx_mail_sender_user" ON "public"."Mail" USING "btree" ("sender_user_id") WHERE ("sender_user_id" IS NOT NULL);



CREATE INDEX "idx_mail_stamp" ON "public"."Mail" USING "btree" ("stamp_id") WHERE ("stamp_id" IS NOT NULL);



CREATE INDEX "idx_mail_time_limited" ON "public"."Mail" USING "btree" ("time_limited_expires_at") WHERE ("time_limited_expires_at" IS NOT NULL);



CREATE INDEX "idx_mail_type" ON "public"."Mail" USING "btree" ("type");



CREATE INDEX "idx_mail_urgency" ON "public"."Mail" USING "btree" ("urgency") WHERE ("urgency" <> 'none'::"text");



CREATE INDEX "idx_mail_vault_folder" ON "public"."Mail" USING "btree" ("vault_folder_id") WHERE ("vault_folder_id" IS NOT NULL);



CREATE INDEX "idx_mail_viewed" ON "public"."Mail" USING "btree" ("viewed");



CREATE INDEX "idx_offer_redemption_offer" ON "public"."OfferRedemption" USING "btree" ("offer_id");



CREATE INDEX "idx_offer_redemption_order" ON "public"."OfferRedemption" USING "btree" ("order_id") WHERE ("order_id" IS NOT NULL);



CREATE INDEX "idx_offer_redemption_user" ON "public"."OfferRedemption" USING "btree" ("user_id");



CREATE INDEX "idx_ownership_claim_claimant" ON "public"."HomeOwnershipClaim" USING "btree" ("claimant_user_id", "state");
CREATE INDEX "idx_ownership_claim_challenge_state_home" ON "public"."HomeOwnershipClaim" USING "btree" ("home_id", "challenge_state");
CREATE INDEX "idx_ownership_claim_expires_initiated" ON "public"."HomeOwnershipClaim" USING "btree" ("expires_at") WHERE ("claim_phase_v2" = 'initiated'::"public"."claim_phase_v2");
CREATE INDEX "idx_ownership_claim_home_claim_phase_v2" ON "public"."HomeOwnershipClaim" USING "btree" ("home_id", "claim_phase_v2");
CREATE INDEX "idx_ownership_claim_home_routing_classification" ON "public"."HomeOwnershipClaim" USING "btree" ("home_id", "routing_classification");



CREATE INDEX "idx_ownership_claim_home_state" ON "public"."HomeOwnershipClaim" USING "btree" ("home_id", "state");



CREATE INDEX "idx_package_event_package_id" ON "public"."PackageEvent" USING "btree" ("package_id");



CREATE INDEX "idx_password_reset_token_email" ON "public"."PasswordResetToken" USING "btree" ("email");



CREATE INDEX "idx_password_reset_token_expires_at" ON "public"."PasswordResetToken" USING "btree" ("expires_at");



CREATE INDEX "idx_payment_authorize" ON "public"."Payment" USING "btree" ("payment_status") WHERE (("payment_status")::"text" = 'ready_to_authorize'::"text");



CREATE INDEX "idx_payment_cooling_off" ON "public"."Payment" USING "btree" ("payment_status", "cooling_off_ends_at") WHERE (("payment_status")::"text" = 'captured_hold'::"text");



CREATE INDEX "idx_payment_created" ON "public"."Payment" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_payment_escrowed" ON "public"."Payment" USING "btree" ("is_escrowed") WHERE ("is_escrowed" = true);



CREATE INDEX "idx_payment_gig" ON "public"."Payment" USING "btree" ("gig_id") WHERE ("gig_id" IS NOT NULL);



CREATE INDEX "idx_payment_gig_id" ON "public"."Payment" USING "btree" ("gig_id");



CREATE INDEX "idx_payment_method_default" ON "public"."PaymentMethod" USING "btree" ("is_default") WHERE ("is_default" = true);



CREATE INDEX "idx_payment_method_stripe_customer" ON "public"."PaymentMethod" USING "btree" ("stripe_customer_id");



CREATE INDEX "idx_payment_method_stripe_id" ON "public"."PaymentMethod" USING "btree" ("stripe_payment_method_id");



CREATE INDEX "idx_payment_method_user" ON "public"."PaymentMethod" USING "btree" ("user_id");



CREATE INDEX "idx_payment_payee" ON "public"."Payment" USING "btree" ("payee_id");



CREATE INDEX "idx_payment_payer" ON "public"."Payment" USING "btree" ("payer_id");



CREATE INDEX "idx_payment_setup_intent" ON "public"."Payment" USING "btree" ("stripe_setup_intent_id") WHERE ("stripe_setup_intent_id" IS NOT NULL);



CREATE INDEX "idx_payment_status" ON "public"."Payment" USING "btree" ("payment_status");



CREATE INDEX "idx_payment_status_type" ON "public"."Payment" USING "btree" ("payment_status", "payment_type");



CREATE INDEX "idx_payment_stripe_intent" ON "public"."Payment" USING "btree" ("stripe_payment_intent_id");



CREATE INDEX "idx_payout_status" ON "public"."Payout" USING "btree" ("payout_status");



CREATE INDEX "idx_payout_stripe_account" ON "public"."Payout" USING "btree" ("stripe_account_id");



CREATE INDEX "idx_payout_stripe_id" ON "public"."Payout" USING "btree" ("stripe_payout_id");



CREATE INDEX "idx_payout_user" ON "public"."Payout" USING "btree" ("user_id");



CREATE INDEX "idx_portfolio_featured" ON "public"."UserPortfolio" USING "btree" ("is_featured") WHERE ("is_featured" = true);



CREATE INDEX "idx_portfolio_type" ON "public"."UserPortfolio" USING "btree" ("portfolio_type");



CREATE INDEX "idx_portfolio_user" ON "public"."UserPortfolio" USING "btree" ("user_id");



CREATE INDEX "idx_post_archived" ON "public"."Post" USING "btree" ("is_archived") WHERE ("is_archived" = false);



CREATE INDEX "idx_post_comment_deleted" ON "public"."PostComment" USING "btree" ("is_deleted") WHERE ("is_deleted" = false);



CREATE INDEX "idx_post_comment_post" ON "public"."PostComment" USING "btree" ("post_id");



CREATE INDEX "idx_post_comment_user" ON "public"."PostComment" USING "btree" ("user_id");



CREATE INDEX "idx_post_created" ON "public"."Post" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_post_event_date" ON "public"."Post" USING "btree" ("event_date") WHERE ("event_date" IS NOT NULL);



CREATE INDEX "idx_post_feed" ON "public"."Post" USING "btree" ("is_archived", "visibility", "created_at" DESC);



CREATE INDEX "idx_post_home" ON "public"."Post" USING "btree" ("home_id");



CREATE INDEX "idx_post_like_post" ON "public"."PostLike" USING "btree" ("post_id");



CREATE INDEX "idx_post_like_user" ON "public"."PostLike" USING "btree" ("user_id");



CREATE INDEX "idx_post_location" ON "public"."Post" USING "gist" ("location");



CREATE INDEX "idx_post_location_precision" ON "public"."Post" USING "btree" ("location_precision");



CREATE INDEX "idx_post_report_post" ON "public"."PostReport" USING "btree" ("post_id");



CREATE INDEX "idx_post_report_status" ON "public"."PostReport" USING "btree" ("status");



CREATE INDEX "idx_post_safety_happened" ON "public"."Post" USING "btree" ("safety_happened_at") WHERE (("post_type")::"text" = 'safety_alert'::"text");



CREATE INDEX "idx_post_share_post" ON "public"."PostShare" USING "btree" ("post_id");



CREATE INDEX "idx_post_share_user" ON "public"."PostShare" USING "btree" ("user_id");



CREATE INDEX "idx_post_tags" ON "public"."Post" USING "gin" ("tags");



CREATE INDEX "idx_post_type" ON "public"."Post" USING "btree" ("post_type");



CREATE INDEX "idx_post_type_created" ON "public"."Post" USING "btree" ("post_type", "created_at" DESC) WHERE ("is_archived" = false);



CREATE INDEX "idx_post_user" ON "public"."Post" USING "btree" ("user_id");



CREATE UNIQUE INDEX "idx_postcard_code_active" ON "public"."HomePostcardCode" USING "btree" ("home_id", "user_id") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_postcard_code_home_user" ON "public"."HomePostcardCode" USING "btree" ("home_id", "user_id");



CREATE INDEX "idx_postcard_code_status" ON "public"."HomePostcardCode" USING "btree" ("status") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_postsave_post" ON "public"."PostSave" USING "btree" ("post_id");



CREATE INDEX "idx_postsave_user" ON "public"."PostSave" USING "btree" ("user_id");



CREATE INDEX "idx_pro_profile_active_public" ON "public"."UserProfessionalProfile" USING "btree" ("is_active", "is_public") WHERE (("is_active" = true) AND ("is_public" = true));



CREATE INDEX "idx_pro_profile_categories" ON "public"."UserProfessionalProfile" USING "gin" ("categories");



CREATE INDEX "idx_pro_profile_user" ON "public"."UserProfessionalProfile" USING "btree" ("user_id");



CREATE INDEX "idx_pro_profile_verification" ON "public"."UserProfessionalProfile" USING "btree" ("verification_tier", "verification_status");



CREATE INDEX "idx_quorum_home_state" ON "public"."HomeQuorumAction" USING "btree" ("home_id", "state");



CREATE INDEX "idx_quota_bandwidth_reset" ON "public"."FileQuota" USING "btree" ("bandwidth_reset_at");



CREATE INDEX "idx_quota_storage" ON "public"."FileQuota" USING "btree" ("storage_used");



CREATE INDEX "idx_refund_payment" ON "public"."Refund" USING "btree" ("payment_id");



CREATE INDEX "idx_refund_status" ON "public"."Refund" USING "btree" ("refund_status");



CREATE INDEX "idx_refund_stripe_id" ON "public"."Refund" USING "btree" ("stripe_refund_id");



CREATE INDEX "idx_review_gig" ON "public"."Review" USING "btree" ("gig_id");



CREATE INDEX "idx_review_reviewee" ON "public"."Review" USING "btree" ("reviewee_id", "created_at" DESC);



CREATE INDEX "idx_review_reviewer" ON "public"."Review" USING "btree" ("reviewer_id");



CREATE INDEX "idx_saved_place_user" ON "public"."SavedPlace" USING "btree" ("user_id");



CREATE INDEX "idx_stamp_type" ON "public"."Stamp" USING "btree" ("stamp_type");



CREATE INDEX "idx_stamp_user" ON "public"."Stamp" USING "btree" ("user_id");



CREATE INDEX "idx_stripe_account_status" ON "public"."StripeAccount" USING "btree" ("charges_enabled", "payouts_enabled");



CREATE INDEX "idx_stripe_account_stripe_id" ON "public"."StripeAccount" USING "btree" ("stripe_account_id");



CREATE INDEX "idx_stripe_account_user" ON "public"."StripeAccount" USING "btree" ("user_id");



CREATE INDEX "idx_subscription_plan" ON "public"."Subscription" USING "btree" ("plan_id");



CREATE INDEX "idx_subscription_plan_active" ON "public"."SubscriptionPlan" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_subscription_plan_stripe_price" ON "public"."SubscriptionPlan" USING "btree" ("stripe_price_id");



CREATE INDEX "idx_subscription_status" ON "public"."Subscription" USING "btree" ("subscription_status");



CREATE INDEX "idx_subscription_stripe_id" ON "public"."Subscription" USING "btree" ("stripe_subscription_id");



CREATE INDEX "idx_subscription_user" ON "public"."Subscription" USING "btree" ("user_id");



CREATE INDEX "idx_thumbnail_file" ON "public"."FileThumbnail" USING "btree" ("file_id");



CREATE INDEX "idx_user_city" ON "public"."User" USING "btree" ("city");



CREATE INDEX "idx_user_cover_photo" ON "public"."User" USING "btree" ("cover_photo_file_id");



CREATE INDEX "idx_user_created_at" ON "public"."User" USING "btree" ("created_at");



CREATE INDEX "idx_user_email" ON "public"."User" USING "btree" ("email");



CREATE INDEX "idx_user_follow_follower" ON "public"."UserFollow" USING "btree" ("follower_id");



CREATE INDEX "idx_user_follow_following" ON "public"."UserFollow" USING "btree" ("following_id");



CREATE INDEX "idx_user_middle_name" ON "public"."User" USING "btree" ("middle_name");



CREATE INDEX "idx_user_profile_picture" ON "public"."User" USING "btree" ("profile_picture_file_id");



CREATE INDEX "idx_user_recent_location_user_used" ON "public"."UserRecentLocation" USING "btree" ("user_id", "used_at" DESC);



CREATE INDEX "idx_user_skill_category" ON "public"."UserSkill" USING "btree" ("skill_category");



CREATE INDEX "idx_user_skill_user" ON "public"."UserSkill" USING "btree" ("user_id");



CREATE INDEX "idx_user_stripe_customer" ON "public"."User" USING "btree" ("stripe_customer_id") WHERE ("stripe_customer_id" IS NOT NULL);



CREATE INDEX "idx_user_username" ON "public"."User" USING "btree" ("username");



CREATE INDEX "idx_user_viewing_location_user" ON "public"."UserViewingLocation" USING "btree" ("user_id");



CREATE INDEX "idx_vacation_hold_dates" ON "public"."VacationHold" USING "btree" ("start_date", "end_date");



CREATE INDEX "idx_vacation_hold_status" ON "public"."VacationHold" USING "btree" ("status");



CREATE INDEX "idx_vacation_hold_user" ON "public"."VacationHold" USING "btree" ("user_id");



CREATE INDEX "idx_vault_folder_drawer" ON "public"."VaultFolder" USING "btree" ("drawer");



CREATE INDEX "idx_vault_folder_home" ON "public"."VaultFolder" USING "btree" ("home_id") WHERE ("home_id" IS NOT NULL);



CREATE INDEX "idx_vault_folder_user" ON "public"."VaultFolder" USING "btree" ("user_id");



CREATE INDEX "idx_verification_token_email" ON "public"."VerificationToken" USING "btree" ("email");



CREATE INDEX "idx_verification_token_expires_at" ON "public"."VerificationToken" USING "btree" ("expires_at");



CREATE INDEX "idx_wallet_tx_created" ON "public"."WalletTransaction" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_wallet_tx_gig" ON "public"."WalletTransaction" USING "btree" ("gig_id") WHERE ("gig_id" IS NOT NULL);



CREATE INDEX "idx_wallet_tx_idempotency" ON "public"."WalletTransaction" USING "btree" ("idempotency_key") WHERE ("idempotency_key" IS NOT NULL);



CREATE INDEX "idx_wallet_tx_payment" ON "public"."WalletTransaction" USING "btree" ("payment_id") WHERE ("payment_id" IS NOT NULL);



CREATE INDEX "idx_wallet_tx_pending" ON "public"."WalletTransaction" USING "btree" ("status") WHERE (("status")::"text" = 'pending'::"text");



CREATE INDEX "idx_wallet_tx_status" ON "public"."WalletTransaction" USING "btree" ("status");



CREATE INDEX "idx_wallet_tx_type" ON "public"."WalletTransaction" USING "btree" ("type", "created_at" DESC);



CREATE INDEX "idx_wallet_tx_user" ON "public"."WalletTransaction" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_wallet_tx_wallet" ON "public"."WalletTransaction" USING "btree" ("wallet_id", "created_at" DESC);



CREATE INDEX "idx_wallet_user" ON "public"."Wallet" USING "btree" ("user_id");



CREATE INDEX "idx_webhook_event_created" ON "public"."StripeWebhookEvent" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_webhook_event_processed" ON "public"."StripeWebhookEvent" USING "btree" ("processed");



CREATE INDEX "idx_webhook_event_stripe_id" ON "public"."StripeWebhookEvent" USING "btree" ("stripe_event_id");



CREATE INDEX "idx_webhook_event_type" ON "public"."StripeWebhookEvent" USING "btree" ("event_type");



CREATE INDEX "notification_created_idx" ON "public"."Notification" USING "btree" ("created_at");



CREATE INDEX "notification_user_read_idx" ON "public"."Notification" USING "btree" ("user_id", "is_read", "created_at" DESC);



CREATE UNIQUE INDEX "quorumvote_unique_voter" ON "public"."HomeQuorumVote" USING "btree" ("quorum_action_id", "voter_user_id");



CREATE UNIQUE INDEX "relationship_unique_pair" ON "public"."Relationship" USING "btree" (LEAST("requester_id", "addressee_id"), GREATEST("requester_id", "addressee_id"));



CREATE INDEX "userplace_kind_idx" ON "public"."UserPlace" USING "btree" ("kind");



CREATE INDEX "userplace_location_gix" ON "public"."UserPlace" USING "gist" ("location");



CREATE INDEX "userplace_user_idx" ON "public"."UserPlace" USING "btree" ("user_id");



CREATE OR REPLACE VIEW "public"."MailAnalyticsSummary" AS
 SELECT "m"."id" AS "mail_id",
    "m"."type",
    "m"."created_at",
    "m"."viewed",
    "m"."viewed_at",
    "m"."view_count",
    "m"."total_read_time_ms",
    "count"(DISTINCT "rs"."id") AS "read_sessions",
    (COALESCE("avg"("rs"."active_time_ms"), (0)::numeric))::numeric(12,2) AS "avg_session_ms",
    COALESCE("max"("rs"."active_time_ms"), 0) AS "max_session_ms"
   FROM ("public"."Mail" "m"
     LEFT JOIN "public"."MailReadSession" "rs" ON (("rs"."mail_id" = "m"."id")))
  GROUP BY "m"."id";



CREATE OR REPLACE TRIGGER "trg_businesscatalogcat_updated" BEFORE UPDATE ON "public"."BusinessCatalogCategory" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_businesscatalogitem_updated" BEFORE UPDATE ON "public"."BusinessCatalogItem" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_businesshours_updated" BEFORE UPDATE ON "public"."BusinessHours" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_businesslocation_updated" BEFORE UPDATE ON "public"."BusinessLocation" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_businesspage_updated" BEFORE UPDATE ON "public"."BusinessPage" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_businesspageblock_updated" BEFORE UPDATE ON "public"."BusinessPageBlock" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_businesspermoverride_updated" BEFORE UPDATE ON "public"."BusinessPermissionOverride" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_businessprivate_updated" BEFORE UPDATE ON "public"."BusinessPrivate" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_businessprofile_updated" BEFORE UPDATE ON "public"."BusinessProfile" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_businessspecialhours_updated" BEFORE UPDATE ON "public"."BusinessSpecialHours" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_businessteam_updated" BEFORE UPDATE ON "public"."BusinessTeam" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_enforce_mail_update_columns" BEFORE UPDATE ON "public"."Mail" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_mail_update_columns"();



CREATE OR REPLACE TRIGGER "trg_home_updated_at" BEFORE UPDATE ON "public"."Home" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_homeaccesssecret_updated_at" BEFORE UPDATE ON "public"."HomeAccessSecret" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_homeasset_updated_at" BEFORE UPDATE ON "public"."HomeAsset" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_homebill_updated_at" BEFORE UPDATE ON "public"."HomeBill" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_homecalendarevent_updated_at" BEFORE UPDATE ON "public"."HomeCalendarEvent" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_homedevice_updated_at" BEFORE UPDATE ON "public"."HomeDevice" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_homedocument_updated_at" BEFORE UPDATE ON "public"."HomeDocument" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_homeemergency_updated_at" BEFORE UPDATE ON "public"."HomeEmergency" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_homeestatefields_updated_at" BEFORE UPDATE ON "public"."HomeEstateFields" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_homeguestpass_updated_at" BEFORE UPDATE ON "public"."HomeGuestPass" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_homeissue_updated_at" BEFORE UPDATE ON "public"."HomeIssue" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_homeocc_updated_at" BEFORE UPDATE ON "public"."HomeOccupancy" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_homepackage_updated_at" BEFORE UPDATE ON "public"."HomePackage" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_homepermoverride_updated_at" BEFORE UPDATE ON "public"."HomePermissionOverride" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_homepreference_updated_at" BEFORE UPDATE ON "public"."HomePreference" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_homereputation_updated_at" BEFORE UPDATE ON "public"."HomeReputation" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_homerolepreset_updated_at" BEFORE UPDATE ON "public"."HomeRolePreset" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_homeroletemplatemeta_updated_at" BEFORE UPDATE ON "public"."HomeRoleTemplateMeta" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_homervstatus_updated_at" BEFORE UPDATE ON "public"."HomeRvStatus" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_homescopedgrant_updated_at" BEFORE UPDATE ON "public"."HomeScopedGrant" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_homesubscription_updated_at" BEFORE UPDATE ON "public"."HomeSubscription" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_hometask_updated_at" BEFORE UPDATE ON "public"."HomeTask" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_homevendor_updated_at" BEFORE UPDATE ON "public"."HomeVendor" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_listing_set_location" BEFORE INSERT OR UPDATE OF "latitude", "longitude" ON "public"."Listing" FOR EACH ROW EXECUTE FUNCTION "public"."listing_set_location_geog"();



CREATE OR REPLACE TRIGGER "trg_listing_updated_at" BEFORE UPDATE ON "public"."Listing" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_post_set_location" BEFORE INSERT OR UPDATE OF "latitude", "longitude" ON "public"."Post" FOR EACH ROW EXECUTE FUNCTION "public"."post_set_location_geog"();



CREATE OR REPLACE TRIGGER "trg_sync_comment_count" AFTER INSERT OR DELETE ON "public"."PostComment" FOR EACH ROW EXECUTE FUNCTION "public"."sync_post_comment_count"();



CREATE OR REPLACE TRIGGER "trg_sync_followers_count" AFTER INSERT OR DELETE ON "public"."UserFollow" FOR EACH ROW EXECUTE FUNCTION "public"."sync_followers_count"();



CREATE OR REPLACE TRIGGER "trg_sync_homeaccesssecret_value" BEFORE INSERT OR UPDATE ON "public"."HomeAccessSecret" FOR EACH ROW EXECUTE FUNCTION "public"."sync_home_access_secret_value"();



CREATE OR REPLACE TRIGGER "trg_sync_homeissue_sensitive" BEFORE INSERT OR UPDATE ON "public"."HomeIssue" FOR EACH ROW EXECUTE FUNCTION "public"."sync_home_issue_sensitive"();



CREATE OR REPLACE TRIGGER "trg_sync_share_count" AFTER INSERT OR DELETE ON "public"."PostShare" FOR EACH ROW EXECUTE FUNCTION "public"."sync_post_share_count"();



CREATE OR REPLACE TRIGGER "trg_trim_recent_locations" AFTER INSERT ON "public"."UserRecentLocation" FOR EACH ROW EXECUTE FUNCTION "public"."trim_recent_locations"();



CREATE OR REPLACE TRIGGER "trg_update_user_rating" AFTER INSERT OR DELETE OR UPDATE ON "public"."Review" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_rating"();



CREATE OR REPLACE TRIGGER "trigger_increment_file_access" AFTER INSERT ON "public"."FileAccessLog" FOR EACH ROW EXECUTE FUNCTION "public"."increment_file_access"();



CREATE OR REPLACE TRIGGER "trigger_increment_unread" AFTER INSERT ON "public"."ChatMessage" FOR EACH ROW EXECUTE FUNCTION "public"."increment_unread_count"();



CREATE OR REPLACE TRIGGER "trigger_payment_updated" BEFORE UPDATE ON "public"."Payment" FOR EACH ROW EXECUTE FUNCTION "public"."update_payment_timestamp"();



CREATE OR REPLACE TRIGGER "trigger_update_quota_delete" AFTER DELETE ON "public"."File" FOR EACH ROW WHEN (("old"."is_deleted" = false)) EXECUTE FUNCTION "public"."update_quota_after_delete"();



CREATE OR REPLACE TRIGGER "trigger_update_quota_upload" AFTER INSERT ON "public"."File" FOR EACH ROW WHEN (("new"."is_deleted" = false)) EXECUTE FUNCTION "public"."update_quota_after_upload"();



ALTER TABLE ONLY "public"."AdCampaign"
    ADD CONSTRAINT "AdCampaign_business_user_id_fkey" FOREIGN KEY ("business_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."AssetPhoto"
    ADD CONSTRAINT "AssetPhoto_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."AssignmentHistory"
    ADD CONSTRAINT "AssignmentHistory_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."Assignment"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."AssignmentHistory"
    ADD CONSTRAINT "AssignmentHistory_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."User"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Assignment"
    ADD CONSTRAINT "Assignment_gig_id_fkey" FOREIGN KEY ("gig_id") REFERENCES "public"."Gig"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Assignment"
    ADD CONSTRAINT "Assignment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."BookletPage"
    ADD CONSTRAINT "BookletPage_mail_id_fkey" FOREIGN KEY ("mail_id") REFERENCES "public"."Mail"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."BusinessAuditLog"
    ADD CONSTRAINT "BusinessAuditLog_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."BusinessAuditLog"
    ADD CONSTRAINT "BusinessAuditLog_business_user_id_fkey" FOREIGN KEY ("business_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."BusinessCatalogCategory"
    ADD CONSTRAINT "BusinessCatalogCategory_business_user_id_fkey" FOREIGN KEY ("business_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."BusinessCatalogItem"
    ADD CONSTRAINT "BusinessCatalogItem_business_user_id_fkey" FOREIGN KEY ("business_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."BusinessCatalogItem"
    ADD CONSTRAINT "BusinessCatalogItem_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."BusinessCatalogCategory"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."BusinessCatalogItem"
    ADD CONSTRAINT "BusinessCatalogItem_image_file_id_fkey" FOREIGN KEY ("image_file_id") REFERENCES "public"."File"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."BusinessAddressDecision"
    ADD CONSTRAINT "BusinessAddressDecision_business_user_id_fkey" FOREIGN KEY ("business_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."BusinessAddressDecision"
    ADD CONSTRAINT "BusinessAddressDecision_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."BusinessLocation"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."BusinessAddressDecision"
    ADD CONSTRAINT "BusinessAddressDecision_canonical_address_id_fkey" FOREIGN KEY ("canonical_address_id") REFERENCES "public"."BusinessAddress"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."BusinessFollow"
    ADD CONSTRAINT "BusinessFollow_business_user_id_fkey" FOREIGN KEY ("business_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."BusinessFollow"
    ADD CONSTRAINT "BusinessFollow_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."BusinessHours"
    ADD CONSTRAINT "BusinessHours_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."BusinessLocation"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."BusinessLocation"
    ADD CONSTRAINT "BusinessLocation_business_user_id_fkey" FOREIGN KEY ("business_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."BusinessLocation"
    ADD CONSTRAINT "BusinessLocation_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "public"."BusinessAddress"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."BusinessMailingAddress"
    ADD CONSTRAINT "BusinessMailingAddress_business_user_id_fkey" FOREIGN KEY ("business_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."BusinessMailingAddress"
    ADD CONSTRAINT "BusinessMailingAddress_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "public"."BusinessAddress"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."BusinessPageBlock"
    ADD CONSTRAINT "BusinessPageBlock_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."BusinessLocation"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."BusinessPageBlock"
    ADD CONSTRAINT "BusinessPageBlock_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "public"."BusinessPage"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."BusinessPageRevision"
    ADD CONSTRAINT "BusinessPageRevision_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "public"."BusinessPage"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."BusinessPageRevision"
    ADD CONSTRAINT "BusinessPageRevision_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."BusinessPage"
    ADD CONSTRAINT "BusinessPage_business_user_id_fkey" FOREIGN KEY ("business_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."BusinessPage"
    ADD CONSTRAINT "BusinessPage_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."BusinessPermissionOverride"
    ADD CONSTRAINT "BusinessPermissionOverride_business_user_id_fkey" FOREIGN KEY ("business_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."BusinessPermissionOverride"
    ADD CONSTRAINT "BusinessPermissionOverride_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."BusinessPermissionOverride"
    ADD CONSTRAINT "BusinessPermissionOverride_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."BusinessPrivate"
    ADD CONSTRAINT "BusinessPrivate_business_user_id_fkey" FOREIGN KEY ("business_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."BusinessProfileView"
    ADD CONSTRAINT "BusinessProfileView_business_user_id_fkey" FOREIGN KEY ("business_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."BusinessProfileView"
    ADD CONSTRAINT "BusinessProfileView_viewer_user_id_fkey" FOREIGN KEY ("viewer_user_id") REFERENCES "public"."User"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."BusinessProfileView"
    ADD CONSTRAINT "BusinessProfileView_viewer_home_id_fkey" FOREIGN KEY ("viewer_home_id") REFERENCES "public"."Home"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."BusinessProfile"
    ADD CONSTRAINT "BusinessProfile_banner_file_id_fkey" FOREIGN KEY ("banner_file_id") REFERENCES "public"."File"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."BusinessProfile"
    ADD CONSTRAINT "BusinessProfile_business_user_id_fkey" FOREIGN KEY ("business_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."BusinessProfile"
    ADD CONSTRAINT "BusinessProfile_logo_file_id_fkey" FOREIGN KEY ("logo_file_id") REFERENCES "public"."File"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."BusinessProfile"
    ADD CONSTRAINT "BusinessProfile_mailing_address_id_fkey" FOREIGN KEY ("mailing_address_id") REFERENCES "public"."BusinessMailingAddress"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."BusinessSpecialHours"
    ADD CONSTRAINT "BusinessSpecialHours_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."BusinessLocation"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."BusinessTeam"
    ADD CONSTRAINT "BusinessTeam_business_user_id_fkey" FOREIGN KEY ("business_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."BusinessTeam"
    ADD CONSTRAINT "BusinessTeam_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."BusinessTeam"
    ADD CONSTRAINT "BusinessTeam_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ChatMessage"
    ADD CONSTRAINT "ChatMessage_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "public"."ChatMessage"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ChatMessage"
    ADD CONSTRAINT "ChatMessage_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."ChatRoom"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ChatMessage"
    ADD CONSTRAINT "ChatMessage_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."ConversationTopic"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ChatMessage"
    ADD CONSTRAINT "ChatMessage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ChatParticipant"
    ADD CONSTRAINT "ChatParticipant_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."ChatRoom"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ChatParticipant"
    ADD CONSTRAINT "ChatParticipant_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ChatRoom"
    ADD CONSTRAINT "ChatRoom_gig_id_fkey" FOREIGN KEY ("gig_id") REFERENCES "public"."Gig"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ChatRoom"
    ADD CONSTRAINT "ChatRoom_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ChatTyping"
    ADD CONSTRAINT "ChatTyping_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."ChatRoom"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ChatTyping"
    ADD CONSTRAINT "ChatTyping_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."CommentLike"
    ADD CONSTRAINT "CommentLike_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."PostComment"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."CommentLike"
    ADD CONSTRAINT "CommentLike_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."CommunityMailItem"
    ADD CONSTRAINT "CommunityMailItem_mail_id_fkey" FOREIGN KEY ("mail_id") REFERENCES "public"."Mail"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."CommunityMailItem"
    ADD CONSTRAINT "CommunityMailItem_map_pin_id_fkey" FOREIGN KEY ("map_pin_id") REFERENCES "public"."HomeMapPin"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."CommunityMailItem"
    ADD CONSTRAINT "CommunityMailItem_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."CommunityReaction"
    ADD CONSTRAINT "CommunityReaction_community_item_id_fkey" FOREIGN KEY ("community_item_id") REFERENCES "public"."CommunityMailItem"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."CommunityReaction"
    ADD CONSTRAINT "CommunityReaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."ConversationTopic"
    ADD CONSTRAINT "ConversationTopic_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."User"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ConversationTopic"
    ADD CONSTRAINT "ConversationTopic_user1_fkey" FOREIGN KEY ("conversation_user_id_1") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ConversationTopic"
    ADD CONSTRAINT "ConversationTopic_user2_fkey" FOREIGN KEY ("conversation_user_id_2") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."EarnOffer"
    ADD CONSTRAINT "EarnOffer_advertiser_id_fkey" FOREIGN KEY ("advertiser_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."EarnRiskSession"
    ADD CONSTRAINT "EarnRiskSession_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."EarnSuspension"
    ADD CONSTRAINT "EarnSuspension_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."EarnTransaction"
    ADD CONSTRAINT "EarnTransaction_mail_id_fkey" FOREIGN KEY ("mail_id") REFERENCES "public"."Mail"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."EarnTransaction"
    ADD CONSTRAINT "EarnTransaction_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "public"."EarnOffer"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."EarnTransaction"
    ADD CONSTRAINT "EarnTransaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."EarnWallet"
    ADD CONSTRAINT "EarnWallet_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."FileAccessLog"
    ADD CONSTRAINT "FileAccessLog_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."File"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."FileAccessLog"
    ADD CONSTRAINT "FileAccessLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."FileQuota"
    ADD CONSTRAINT "FileQuota_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."FileThumbnail"
    ADD CONSTRAINT "FileThumbnail_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."File"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."File"
    ADD CONSTRAINT "File_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."PostComment"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."File"
    ADD CONSTRAINT "File_gig_id_fkey" FOREIGN KEY ("gig_id") REFERENCES "public"."Gig"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."File"
    ADD CONSTRAINT "File_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."File"
    ADD CONSTRAINT "File_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."Post"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."File"
    ADD CONSTRAINT "File_profile_user_id_fkey" FOREIGN KEY ("profile_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."File"
    ADD CONSTRAINT "File_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."GigBid"
    ADD CONSTRAINT "GigBid_countered_by_fkey" FOREIGN KEY ("countered_by") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."GigBid"
    ADD CONSTRAINT "GigBid_gig_id_fkey" FOREIGN KEY ("gig_id") REFERENCES "public"."Gig"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."GigBid"
    ADD CONSTRAINT "GigBid_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."GigChangeOrder"
    ADD CONSTRAINT "GigChangeOrder_gig_id_fkey" FOREIGN KEY ("gig_id") REFERENCES "public"."Gig"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."GigChangeOrder"
    ADD CONSTRAINT "GigChangeOrder_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."GigChangeOrder"
    ADD CONSTRAINT "GigChangeOrder_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."GigIncident"
    ADD CONSTRAINT "GigIncident_gig_id_fkey" FOREIGN KEY ("gig_id") REFERENCES "public"."Gig"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."GigIncident"
    ADD CONSTRAINT "GigIncident_reported_against_fkey" FOREIGN KEY ("reported_against") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."GigIncident"
    ADD CONSTRAINT "GigIncident_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."GigIncident"
    ADD CONSTRAINT "GigIncident_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."GigMedia"
    ADD CONSTRAINT "GigMedia_gig_id_fkey" FOREIGN KEY ("gig_id") REFERENCES "public"."Gig"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."GigMedia"
    ADD CONSTRAINT "GigMedia_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."GigPrivateLocation"
    ADD CONSTRAINT "GigPrivateLocation_gig_id_fkey" FOREIGN KEY ("gig_id") REFERENCES "public"."Gig"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."GigQuestionUpvote"
    ADD CONSTRAINT "GigQuestionUpvote_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."GigQuestion"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."GigQuestionUpvote"
    ADD CONSTRAINT "GigQuestionUpvote_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."GigQuestion"
    ADD CONSTRAINT "GigQuestion_answered_by_fkey" FOREIGN KEY ("answered_by") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."GigQuestion"
    ADD CONSTRAINT "GigQuestion_asked_by_fkey" FOREIGN KEY ("asked_by") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."GigQuestion"
    ADD CONSTRAINT "GigQuestion_gig_id_fkey" FOREIGN KEY ("gig_id") REFERENCES "public"."Gig"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Gig"
    ADD CONSTRAINT "Gig_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "public"."User"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Gig"
    ADD CONSTRAINT "Gig_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."Gig"
    ADD CONSTRAINT "Gig_ref_listing_fk" FOREIGN KEY ("ref_listing_id") REFERENCES "public"."Listing"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Gig"
    ADD CONSTRAINT "Gig_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeAccessSecretValue"
    ADD CONSTRAINT "HomeAccessSecretValue_access_secret_id_fkey" FOREIGN KEY ("access_secret_id") REFERENCES "public"."HomeAccessSecret"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeAccessSecret"
    ADD CONSTRAINT "HomeAccessSecret_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."HomeAccessSecret"
    ADD CONSTRAINT "HomeAccessSecret_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeAsset"
    ADD CONSTRAINT "HomeAsset_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."HomeAsset"
    ADD CONSTRAINT "HomeAsset_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeAsset"
    ADD CONSTRAINT "HomeAsset_ownership_user_id_fkey" FOREIGN KEY ("ownership_user_id") REFERENCES "public"."User"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."HomeAsset"
    ADD CONSTRAINT "HomeAsset_receipt_document_id_fkey" FOREIGN KEY ("receipt_document_id") REFERENCES "public"."HomeDocument"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."HomeAuditLog"
    ADD CONSTRAINT "HomeAuditLog_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "public"."User"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."HomeAuditLog"
    ADD CONSTRAINT "HomeAuditLog_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeBillSplit"
    ADD CONSTRAINT "HomeBillSplit_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "public"."HomeBill"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeBillSplit"
    ADD CONSTRAINT "HomeBillSplit_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeBill"
    ADD CONSTRAINT "HomeBill_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."HomeBill"
    ADD CONSTRAINT "HomeBill_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeBill"
    ADD CONSTRAINT "HomeBill_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "public"."User"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."HomeBusinessLink"
    ADD CONSTRAINT "HomeBusinessLink_business_user_id_fkey" FOREIGN KEY ("business_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeBusinessLink"
    ADD CONSTRAINT "HomeBusinessLink_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."HomeBusinessLink"
    ADD CONSTRAINT "HomeBusinessLink_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeCalendarEvent"
    ADD CONSTRAINT "HomeCalendarEvent_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."HomeCalendarEvent"
    ADD CONSTRAINT "HomeCalendarEvent_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeDevice"
    ADD CONSTRAINT "HomeDevice_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."HomeDevice"
    ADD CONSTRAINT "HomeDevice_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeDocument"
    ADD CONSTRAINT "HomeDocument_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."HomeDocument"
    ADD CONSTRAINT "HomeDocument_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."File"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."HomeDocument"
    ADD CONSTRAINT "HomeDocument_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeEmergency"
    ADD CONSTRAINT "HomeEmergency_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."HomeEmergency"
    ADD CONSTRAINT "HomeEmergency_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeEstateFields"
    ADD CONSTRAINT "HomeEstateFields_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeGuestPass"
    ADD CONSTRAINT "HomeGuestPass_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."User"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."HomeGuestPass"
    ADD CONSTRAINT "HomeGuestPass_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeInvite"
    ADD CONSTRAINT "HomeInvite_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeInvite"
    ADD CONSTRAINT "HomeInvite_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeInvite"
    ADD CONSTRAINT "HomeInvite_invitee_user_id_fkey" FOREIGN KEY ("invitee_user_id") REFERENCES "public"."User"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."HomeIssueSensitive"
    ADD CONSTRAINT "HomeIssueSensitive_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "public"."HomeIssue"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeIssue"
    ADD CONSTRAINT "HomeIssue_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeIssue"
    ADD CONSTRAINT "HomeIssue_linked_gig_id_fkey" FOREIGN KEY ("linked_gig_id") REFERENCES "public"."Gig"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."HomeIssue"
    ADD CONSTRAINT "HomeIssue_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."HomeIssue"
    ADD CONSTRAINT "HomeIssue_vendor_fkey" FOREIGN KEY ("assigned_vendor_id") REFERENCES "public"."HomeVendor"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."HomeMaintenanceLog"
    ADD CONSTRAINT "HomeMaintenanceLog_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."HomeDocument"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."HomeMaintenanceLog"
    ADD CONSTRAINT "HomeMaintenanceLog_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeMaintenanceLog"
    ADD CONSTRAINT "HomeMaintenanceLog_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "public"."User"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."HomeMaintenanceLog"
    ADD CONSTRAINT "HomeMaintenanceLog_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."HomeMaintenanceTemplate"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."HomeMaintenanceLog"
    ADD CONSTRAINT "HomeMaintenanceLog_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."HomeVendor"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."HomeMaintenanceLog"
    ADD CONSTRAINT "HomeMaintenanceLog_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."User"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."HomeMaintenanceTemplate"
    ADD CONSTRAINT "HomeMaintenanceTemplate_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."HomeMaintenanceTemplate"
    ADD CONSTRAINT "HomeMaintenanceTemplate_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeMapPin"
    ADD CONSTRAINT "HomeMapPin_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."HomeMapPin"
    ADD CONSTRAINT "HomeMapPin_mail_id_fkey" FOREIGN KEY ("mail_id") REFERENCES "public"."Mail"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."HomeMedia"
    ADD CONSTRAINT "HomeMedia_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."File"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeMedia"
    ADD CONSTRAINT "HomeMedia_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeOccupancy"
    ADD CONSTRAINT "HomeOccupancy_added_by_fkey" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."User"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."HomeOccupancy"
    ADD CONSTRAINT "HomeOccupancy_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeOccupancy"
    ADD CONSTRAINT "HomeOccupancy_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeOwner"
    ADD CONSTRAINT "HomeOwner_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeOwnershipClaim"
    ADD CONSTRAINT "HomeOwnershipClaim_claimant_fkey" FOREIGN KEY ("claimant_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeOwnershipClaim"
    ADD CONSTRAINT "HomeOwnershipClaim_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."HomeOwnershipClaim"
    ADD CONSTRAINT "HomeOwnershipClaim_merged_into_claim_id_fkey" FOREIGN KEY ("merged_into_claim_id") REFERENCES "public"."HomeOwnershipClaim"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."HomeOwnershipClaim"
    ADD CONSTRAINT "HomeOwnershipClaim_reviewer_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."User"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."HomePackage"
    ADD CONSTRAINT "HomePackage_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."HomePackage"
    ADD CONSTRAINT "HomePackage_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomePackage"
    ADD CONSTRAINT "HomePackage_picked_up_by_fkey" FOREIGN KEY ("picked_up_by") REFERENCES "public"."User"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."HomePermissionOverride"
    ADD CONSTRAINT "HomePermissionOverride_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."User"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."HomePermissionOverride"
    ADD CONSTRAINT "HomePermissionOverride_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomePermissionOverride"
    ADD CONSTRAINT "HomePermissionOverride_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomePostcardCode"
    ADD CONSTRAINT "HomePostcardCode_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomePostcardCode"
    ADD CONSTRAINT "HomePostcardCode_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomePreference"
    ADD CONSTRAINT "HomePreference_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomePrivateData"
    ADD CONSTRAINT "HomePrivateData_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."User"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."HomePrivateData"
    ADD CONSTRAINT "HomePrivateData_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomePublicData"
    ADD CONSTRAINT "HomePublicData_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."User"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."HomePublicData"
    ADD CONSTRAINT "HomePublicData_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeQuorumAction"
    ADD CONSTRAINT "HomeQuorumAction_home_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeQuorumAction"
    ADD CONSTRAINT "HomeQuorumAction_proposer_fkey" FOREIGN KEY ("proposed_by") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeQuorumVote"
    ADD CONSTRAINT "HomeQuorumVote_action_fkey" FOREIGN KEY ("quorum_action_id") REFERENCES "public"."HomeQuorumAction"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeQuorumVote"
    ADD CONSTRAINT "HomeQuorumVote_voter_fkey" FOREIGN KEY ("voter_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeReputation"
    ADD CONSTRAINT "HomeReputation_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeResidencyClaim"
    ADD CONSTRAINT "HomeResidencyClaim_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeResidencyClaim"
    ADD CONSTRAINT "HomeResidencyClaim_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."HomeResidencyClaim"
    ADD CONSTRAINT "HomeResidencyClaim_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeRvStatus"
    ADD CONSTRAINT "HomeRvStatus_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeScopedGrant"
    ADD CONSTRAINT "HomeScopedGrant_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."User"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."HomeScopedGrant"
    ADD CONSTRAINT "HomeScopedGrant_grantee_user_id_fkey" FOREIGN KEY ("grantee_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeScopedGrant"
    ADD CONSTRAINT "HomeScopedGrant_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeSubscription"
    ADD CONSTRAINT "HomeSubscription_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."HomeSubscription"
    ADD CONSTRAINT "HomeSubscription_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeTaskMedia"
    ADD CONSTRAINT "HomeTaskMedia_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeTaskMedia"
    ADD CONSTRAINT "HomeTaskMedia_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."HomeTask"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeTaskMedia"
    ADD CONSTRAINT "HomeTaskMedia_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeTask"
    ADD CONSTRAINT "HomeTask_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."User"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."HomeTask"
    ADD CONSTRAINT "HomeTask_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."HomeTask"
    ADD CONSTRAINT "HomeTask_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeTask"
    ADD CONSTRAINT "HomeTask_linked_gig_id_fkey" FOREIGN KEY ("linked_gig_id") REFERENCES "public"."Gig"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."HomeTask"
    ADD CONSTRAINT "HomeTask_mail_id_fkey" FOREIGN KEY ("mail_id") REFERENCES "public"."Mail"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."HomeVendor"
    ADD CONSTRAINT "HomeVendor_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."HomeVendor"
    ADD CONSTRAINT "HomeVendor_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeVerificationEvidence"
    ADD CONSTRAINT "HomeVerificationEvidence_claim_fkey" FOREIGN KEY ("claim_id") REFERENCES "public"."HomeOwnershipClaim"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HomeVerification"
    ADD CONSTRAINT "HomeVerification_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Home"
    ADD CONSTRAINT "Home_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "public"."HomeAddress"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Home"
    ADD CONSTRAINT "Home_canonical_home_id_fkey" FOREIGN KEY ("canonical_home_id") REFERENCES "public"."Home"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Home"
    ADD CONSTRAINT "Home_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."User"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Home"
    ADD CONSTRAINT "Home_house_rules_file_id_fkey" FOREIGN KEY ("house_rules_file_id") REFERENCES "public"."File"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Home"
    ADD CONSTRAINT "Home_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Home"
    ADD CONSTRAINT "Home_parent_home_id_fkey" FOREIGN KEY ("parent_home_id") REFERENCES "public"."Home"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Home"
    ADD CONSTRAINT "Home_wifi_qr_file_id_fkey" FOREIGN KEY ("wifi_qr_file_id") REFERENCES "public"."File"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ListingMessage"
    ADD CONSTRAINT "ListingMessage_buyer_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ListingMessage"
    ADD CONSTRAINT "ListingMessage_listing_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."Listing"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ListingMessage"
    ADD CONSTRAINT "ListingMessage_seller_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ListingQuestionUpvote"
    ADD CONSTRAINT "ListingQuestionUpvote_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."ListingQuestion"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ListingQuestionUpvote"
    ADD CONSTRAINT "ListingQuestionUpvote_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ListingQuestion"
    ADD CONSTRAINT "ListingQuestion_answered_by_fkey" FOREIGN KEY ("answered_by") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."ListingQuestion"
    ADD CONSTRAINT "ListingQuestion_asked_by_fkey" FOREIGN KEY ("asked_by") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ListingQuestion"
    ADD CONSTRAINT "ListingQuestion_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."Listing"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ListingReport"
    ADD CONSTRAINT "ListingReport_listing_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."Listing"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ListingReport"
    ADD CONSTRAINT "ListingReport_user_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ListingSave"
    ADD CONSTRAINT "ListingSave_listing_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."Listing"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ListingSave"
    ADD CONSTRAINT "ListingSave_user_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ListingView"
    ADD CONSTRAINT "ListingView_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."Listing"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ListingView"
    ADD CONSTRAINT "ListingView_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Listing"
    ADD CONSTRAINT "Listing_user_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."MailAction"
    ADD CONSTRAINT "MailAction_mail_id_fkey" FOREIGN KEY ("mail_id") REFERENCES "public"."Mail"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."MailAction"
    ADD CONSTRAINT "MailAction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."MailAlias"
    ADD CONSTRAINT "MailAlias_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."MailAlias"
    ADD CONSTRAINT "MailAlias_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."MailAssetLink"
    ADD CONSTRAINT "MailAssetLink_linked_by_fkey" FOREIGN KEY ("linked_by") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."MailAssetLink"
    ADD CONSTRAINT "MailAssetLink_mail_id_fkey" FOREIGN KEY ("mail_id") REFERENCES "public"."Mail"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."MailDaySettings"
    ADD CONSTRAINT "MailDaySettings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."MailEngagementEvent"
    ADD CONSTRAINT "MailEngagementEvent_mail_id_fkey" FOREIGN KEY ("mail_id") REFERENCES "public"."Mail"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."MailEngagementEvent"
    ADD CONSTRAINT "MailEngagementEvent_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."MailReadSession"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."MailEngagementEvent"
    ADD CONSTRAINT "MailEngagementEvent_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."MailEvent"
    ADD CONSTRAINT "MailEvent_mail_id_fkey" FOREIGN KEY ("mail_id") REFERENCES "public"."Mail"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."MailEvent"
    ADD CONSTRAINT "MailEvent_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."MailLink"
    ADD CONSTRAINT "MailLink_mail_item_id_fkey" FOREIGN KEY ("mail_item_id") REFERENCES "public"."Mail"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."MailMemory"
    ADD CONSTRAINT "MailMemory_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."MailObject"
    ADD CONSTRAINT "MailObject_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."User"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."MailPackage"
    ADD CONSTRAINT "MailPackage_mail_id_fkey" FOREIGN KEY ("mail_id") REFERENCES "public"."Mail"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."MailPartyParticipant"
    ADD CONSTRAINT "MailPartyParticipant_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."MailPartySession"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."MailPartyParticipant"
    ADD CONSTRAINT "MailPartyParticipant_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."MailPartySession"
    ADD CONSTRAINT "MailPartySession_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."MailPartySession"
    ADD CONSTRAINT "MailPartySession_initiated_by_fkey" FOREIGN KEY ("initiated_by") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."MailPartySession"
    ADD CONSTRAINT "MailPartySession_mail_id_fkey" FOREIGN KEY ("mail_id") REFERENCES "public"."Mail"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."MailPreferences"
    ADD CONSTRAINT "MailPreferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."MailReadSession"
    ADD CONSTRAINT "MailReadSession_mail_id_fkey" FOREIGN KEY ("mail_id") REFERENCES "public"."Mail"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."MailReadSession"
    ADD CONSTRAINT "MailReadSession_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."MailRoutingQueue"
    ADD CONSTRAINT "MailRoutingQueue_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."MailRoutingQueue"
    ADD CONSTRAINT "MailRoutingQueue_mail_id_fkey" FOREIGN KEY ("mail_id") REFERENCES "public"."Mail"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Mail"
    ADD CONSTRAINT "Mail_address_home_id_fk" FOREIGN KEY ("address_home_id") REFERENCES "public"."Home"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Mail"
    ADD CONSTRAINT "Mail_address_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."Home"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Mail"
    ADD CONSTRAINT "Mail_attn_user_id_fk" FOREIGN KEY ("attn_user_id") REFERENCES "public"."User"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Mail"
    ADD CONSTRAINT "Mail_object_id_fk_mail_object" FOREIGN KEY ("object_id") REFERENCES "public"."MailObject"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."Mail"
    ADD CONSTRAINT "Mail_recipient_home_id_fkey" FOREIGN KEY ("recipient_home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Mail"
    ADD CONSTRAINT "Mail_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Mail"
    ADD CONSTRAINT "Mail_sender_entity_id_fk" FOREIGN KEY ("sender_entity_id") REFERENCES "public"."User"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Mail"
    ADD CONSTRAINT "Mail_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "public"."User"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."NeighborEndorsement"
    ADD CONSTRAINT "NeighborEndorsement_business_user_id_fkey" FOREIGN KEY ("business_user_id") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."NeighborEndorsement"
    ADD CONSTRAINT "NeighborEndorsement_endorser_home_id_fkey" FOREIGN KEY ("endorser_home_id") REFERENCES "public"."Home"("id");



ALTER TABLE ONLY "public"."NeighborEndorsement"
    ADD CONSTRAINT "NeighborEndorsement_endorser_user_id_fkey" FOREIGN KEY ("endorser_user_id") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."Notification"
    ADD CONSTRAINT "Notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."OfferRedemption"
    ADD CONSTRAINT "OfferRedemption_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."User"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."OfferRedemption"
    ADD CONSTRAINT "OfferRedemption_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "public"."EarnOffer"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."OfferRedemption"
    ADD CONSTRAINT "OfferRedemption_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."PackageEvent"
    ADD CONSTRAINT "PackageEvent_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."MailPackage"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."PaymentMethod"
    ADD CONSTRAINT "PaymentMethod_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Payment"
    ADD CONSTRAINT "Payment_escrow_released_by_fkey" FOREIGN KEY ("escrow_released_by") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."Payment"
    ADD CONSTRAINT "Payment_gig_id_fkey" FOREIGN KEY ("gig_id") REFERENCES "public"."Gig"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Payment"
    ADD CONSTRAINT "Payment_payee_id_fkey" FOREIGN KEY ("payee_id") REFERENCES "public"."User"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."Payment"
    ADD CONSTRAINT "Payment_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "public"."User"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."Payout"
    ADD CONSTRAINT "Payout_stripe_account_id_fkey" FOREIGN KEY ("stripe_account_id") REFERENCES "public"."StripeAccount"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."Payout"
    ADD CONSTRAINT "Payout_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."PostComment"
    ADD CONSTRAINT "PostComment_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."PostComment"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."PostComment"
    ADD CONSTRAINT "PostComment_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."Post"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."PostComment"
    ADD CONSTRAINT "PostComment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."PostHide"
    ADD CONSTRAINT "PostHide_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."Post"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."PostHide"
    ADD CONSTRAINT "PostHide_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."PostLike"
    ADD CONSTRAINT "PostLike_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."Post"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."PostLike"
    ADD CONSTRAINT "PostLike_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."PostMute"
    ADD CONSTRAINT "PostMute_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."PostReport"
    ADD CONSTRAINT "PostReport_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."Post"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."PostReport"
    ADD CONSTRAINT "PostReport_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."PostSave"
    ADD CONSTRAINT "PostSave_post_fk" FOREIGN KEY ("post_id") REFERENCES "public"."Post"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."PostSave"
    ADD CONSTRAINT "PostSave_user_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."PostShare"
    ADD CONSTRAINT "PostShare_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."Post"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."PostShare"
    ADD CONSTRAINT "PostShare_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."PostView"
    ADD CONSTRAINT "PostView_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."Post"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."PostView"
    ADD CONSTRAINT "PostView_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."Post"
    ADD CONSTRAINT "Post_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Post"
    ADD CONSTRAINT "Post_broadcast_channel_id_fkey" FOREIGN KEY ("broadcast_channel_id") REFERENCES "public"."BroadcastChannel"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Post"
    ADD CONSTRAINT "Post_ref_listing_fk" FOREIGN KEY ("ref_listing_id") REFERENCES "public"."Listing"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Post"
    ADD CONSTRAINT "Post_ref_task_fk" FOREIGN KEY ("ref_task_id") REFERENCES "public"."Gig"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Post"
    ADD CONSTRAINT "Post_target_place_id_fkey" FOREIGN KEY ("target_place_id") REFERENCES "public"."SavedPlace"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Post"
    ADD CONSTRAINT "Post_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Refund"
    ADD CONSTRAINT "Refund_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."Refund"
    ADD CONSTRAINT "Refund_initiated_by_fkey" FOREIGN KEY ("initiated_by") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."Refund"
    ADD CONSTRAINT "Refund_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."Payment"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."RelationshipPermission"
    ADD CONSTRAINT "RelationshipPermission_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."RelationshipPermission"
    ADD CONSTRAINT "RelationshipPermission_viewer_id_fkey" FOREIGN KEY ("viewer_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Relationship"
    ADD CONSTRAINT "Relationship_addressee_id_fkey" FOREIGN KEY ("addressee_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Relationship"
    ADD CONSTRAINT "Relationship_blocked_by_fkey" FOREIGN KEY ("blocked_by") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."Relationship"
    ADD CONSTRAINT "Relationship_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Review"
    ADD CONSTRAINT "Review_gig_id_fkey" FOREIGN KEY ("gig_id") REFERENCES "public"."Gig"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Review"
    ADD CONSTRAINT "Review_reviewee_id_fkey" FOREIGN KEY ("reviewee_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Review"
    ADD CONSTRAINT "Review_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."SavedPlace"
    ADD CONSTRAINT "SavedPlace_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Stamp"
    ADD CONSTRAINT "Stamp_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."StripeAccount"
    ADD CONSTRAINT "StripeAccount_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Subscription"
    ADD CONSTRAINT "Subscription_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."SubscriptionPlan"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."Subscription"
    ADD CONSTRAINT "Subscription_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."UserCertification"
    ADD CONSTRAINT "UserCertification_certificate_file_id_fkey" FOREIGN KEY ("certificate_file_id") REFERENCES "public"."File"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."UserCertification"
    ADD CONSTRAINT "UserCertification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."UserExperience"
    ADD CONSTRAINT "UserExperience_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."UserFeedPreference"
    ADD CONSTRAINT "UserFeedPreference_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."UserFollow"
    ADD CONSTRAINT "UserFollow_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."UserFollow"
    ADD CONSTRAINT "UserFollow_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."UserPlace"
    ADD CONSTRAINT "UserPlace_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."UserPortfolio"
    ADD CONSTRAINT "UserPortfolio_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."UserProfessionalProfile"
    ADD CONSTRAINT "UserProfessionalProfile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."UserRecentLocation"
    ADD CONSTRAINT "UserRecentLocation_user_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."UserSkill"
    ADD CONSTRAINT "UserSkill_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."UserSkill"
    ADD CONSTRAINT "UserSkill_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "public"."User"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."UserViewingLocation"
    ADD CONSTRAINT "UserViewingLocation_user_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."User"
    ADD CONSTRAINT "User_cover_photo_file_id_fkey" FOREIGN KEY ("cover_photo_file_id") REFERENCES "public"."File"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."User"
    ADD CONSTRAINT "User_profile_picture_file_id_fkey" FOREIGN KEY ("profile_picture_file_id") REFERENCES "public"."File"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."VacationHold"
    ADD CONSTRAINT "VacationHold_forward_user_id_fkey" FOREIGN KEY ("forward_user_id") REFERENCES "public"."User"("id");



ALTER TABLE ONLY "public"."VacationHold"
    ADD CONSTRAINT "VacationHold_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."VaultFolder"
    ADD CONSTRAINT "VaultFolder_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."VaultFolder"
    ADD CONSTRAINT "VaultFolder_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."WalletTransaction"
    ADD CONSTRAINT "WalletTransaction_gig_fk" FOREIGN KEY ("gig_id") REFERENCES "public"."Gig"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."WalletTransaction"
    ADD CONSTRAINT "WalletTransaction_payment_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."Payment"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."WalletTransaction"
    ADD CONSTRAINT "WalletTransaction_user_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."WalletTransaction"
    ADD CONSTRAINT "WalletTransaction_wallet_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."Wallet"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."Wallet"
    ADD CONSTRAINT "Wallet_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."YearInMail"
    ADD CONSTRAINT "YearInMail_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."BusinessProfile"
    ADD CONSTRAINT "bp_primary_location_fk" FOREIGN KEY ("primary_location_id") REFERENCES "public"."BusinessLocation"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Gig"
    ADD CONSTRAINT "gig_beneficiary_fk" FOREIGN KEY ("beneficiary_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Gig"
    ADD CONSTRAINT "gig_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Gig"
    ADD CONSTRAINT "gig_origin_home_fk" FOREIGN KEY ("origin_home_id") REFERENCES "public"."Home"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Gig"
    ADD CONSTRAINT "gig_origin_userplace_fk" FOREIGN KEY ("origin_user_place_id") REFERENCES "public"."UserPlace"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Gig"
    ADD CONSTRAINT "gig_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."Payment"("id");



ALTER TABLE ONLY "public"."Payment"
    ADD CONSTRAINT "payment_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE SET NULL;



ALTER TABLE "public"."AdCampaign" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Advertisers can create campaigns" ON "public"."AdCampaign" FOR INSERT WITH CHECK (("auth"."uid"() = "business_user_id"));



CREATE POLICY "Advertisers can update their campaigns" ON "public"."AdCampaign" FOR UPDATE USING (("auth"."uid"() = "business_user_id"));



CREATE POLICY "Advertisers can view their own campaigns" ON "public"."AdCampaign" FOR SELECT USING (("auth"."uid"() = "business_user_id"));



CREATE POLICY "Anyone can view public home data" ON "public"."HomePublicData" FOR SELECT USING (true);



ALTER TABLE "public"."Assignment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."AssignmentHistory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."BusinessAuditLog" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."BusinessAddress" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."BusinessAddressDecision" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."BusinessCatalogCategory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."BusinessCatalogItem" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."BusinessHours" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."BusinessLocation" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."BusinessMailingAddress" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."BusinessPage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."BusinessPageBlock" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."BusinessPageRevision" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."BusinessPermissionOverride" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."BusinessPrivate" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."BusinessProfile" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."BusinessRolePermission" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."BusinessRolePreset" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."BusinessSpecialHours" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."BusinessTeam" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ChatMessage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ChatParticipant" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ChatRoom" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ChatTyping" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."CommentLike" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ConversationTopic" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."File" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."FileAccessLog" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."FileQuota" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."FileThumbnail" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Gig" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."GigBid" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."GigPrivateLocation" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Home" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Home owners can add occupants" ON "public"."HomeOccupancy" FOR INSERT WITH CHECK (("home_id" IN ( SELECT "Home"."id"
   FROM "public"."Home"
  WHERE ("Home"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Home owners can remove occupants" ON "public"."HomeOccupancy" FOR DELETE USING (("home_id" IN ( SELECT "Home"."id"
   FROM "public"."Home"
  WHERE ("Home"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Home owners can view occupants" ON "public"."HomeOccupancy" FOR SELECT USING (("home_id" IN ( SELECT "Home"."id"
   FROM "public"."Home"
  WHERE ("Home"."owner_id" = "auth"."uid"()))));



ALTER TABLE "public"."HomeAccessSecret" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."HomeAccessSecretValue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."AddressVerificationEvent" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."HomeAddress" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."HomeAsset" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "HomeAsset_insert" ON "public"."HomeAsset" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "created_by") AND "public"."is_home_member"("home_id")));



CREATE POLICY "HomeAsset_select" ON "public"."HomeAsset" FOR SELECT TO "authenticated" USING ("public"."is_home_member"("home_id"));



CREATE POLICY "HomeAsset_update" ON "public"."HomeAsset" FOR UPDATE TO "authenticated" USING (("public"."is_home_member"("home_id") AND (("auth"."uid"() = "created_by") OR "public"."has_home_permission"("home_id", 'manage_home'::"text")))) WITH CHECK ("public"."is_home_member"("home_id"));



ALTER TABLE "public"."HomeAuditLog" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."HomeBill" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."HomeBillSplit" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "HomeBillSplit_delete" ON "public"."HomeBillSplit" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."HomeBill" "hb"
  WHERE (("hb"."id" = "HomeBillSplit"."bill_id") AND ("public"."has_home_permission"("hb"."home_id", 'manage_finance'::"text") OR "public"."has_home_permission"("hb"."home_id", 'manage_home'::"text"))))));



CREATE POLICY "HomeBillSplit_insert" ON "public"."HomeBillSplit" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."HomeBill" "hb"
  WHERE (("hb"."id" = "HomeBillSplit"."bill_id") AND ("public"."has_home_permission"("hb"."home_id", 'manage_finance'::"text") OR "public"."has_home_permission"("hb"."home_id", 'manage_home'::"text"))))));



CREATE POLICY "HomeBillSplit_select" ON "public"."HomeBillSplit" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."HomeBill" "hb"
  WHERE (("hb"."id" = "HomeBillSplit"."bill_id") AND "public"."is_home_member"("hb"."home_id"))))));



CREATE POLICY "HomeBillSplit_update" ON "public"."HomeBillSplit" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."HomeBill" "hb"
  WHERE (("hb"."id" = "HomeBillSplit"."bill_id") AND "public"."is_home_member"("hb"."home_id") AND (("auth"."uid"() = "HomeBillSplit"."user_id") OR "public"."has_home_permission"("hb"."home_id", 'manage_finance'::"text") OR "public"."has_home_permission"("hb"."home_id", 'manage_home'::"text")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."HomeBill" "hb"
  WHERE (("hb"."id" = "HomeBillSplit"."bill_id") AND "public"."is_home_member"("hb"."home_id")))));



CREATE POLICY "HomeBill_delete" ON "public"."HomeBill" FOR DELETE TO "authenticated" USING (("public"."is_home_member"("home_id") AND ("public"."has_home_permission"("home_id", 'manage_finance'::"text") OR "public"."has_home_permission"("home_id", 'manage_home'::"text"))));



CREATE POLICY "HomeBill_insert" ON "public"."HomeBill" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "created_by") AND "public"."is_home_member"("home_id") AND ("public"."has_home_permission"("home_id", 'manage_finance'::"text") OR "public"."has_home_permission"("home_id", 'manage_home'::"text"))));



CREATE POLICY "HomeBill_select" ON "public"."HomeBill" FOR SELECT TO "authenticated" USING ("public"."is_home_member"("home_id"));



CREATE POLICY "HomeBill_update" ON "public"."HomeBill" FOR UPDATE TO "authenticated" USING (("public"."is_home_member"("home_id") AND ("public"."has_home_permission"("home_id", 'manage_finance'::"text") OR "public"."has_home_permission"("home_id", 'manage_home'::"text")))) WITH CHECK (("public"."is_home_member"("home_id") AND ("public"."has_home_permission"("home_id", 'manage_finance'::"text") OR "public"."has_home_permission"("home_id", 'manage_home'::"text"))));



ALTER TABLE "public"."HomeBusinessLink" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."HomeCalendarEvent" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "HomeCalendarEvent_delete" ON "public"."HomeCalendarEvent" FOR DELETE TO "authenticated" USING (("public"."is_home_member"("home_id") AND (("auth"."uid"() = "created_by") OR "public"."has_home_permission"("home_id", 'manage_home'::"text"))));



CREATE POLICY "HomeCalendarEvent_insert" ON "public"."HomeCalendarEvent" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "created_by") AND "public"."is_home_member"("home_id") AND ("public"."has_home_permission"("home_id", 'manage_tasks'::"text") OR "public"."has_home_permission"("home_id", 'manage_home'::"text"))));



CREATE POLICY "HomeCalendarEvent_select" ON "public"."HomeCalendarEvent" FOR SELECT TO "authenticated" USING ("public"."is_home_member"("home_id"));



CREATE POLICY "HomeCalendarEvent_update" ON "public"."HomeCalendarEvent" FOR UPDATE TO "authenticated" USING (("public"."is_home_member"("home_id") AND ("public"."has_home_permission"("home_id", 'manage_tasks'::"text") OR "public"."has_home_permission"("home_id", 'manage_home'::"text")))) WITH CHECK ("public"."is_home_member"("home_id"));



ALTER TABLE "public"."HomeDevice" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "HomeDevice_delete" ON "public"."HomeDevice" FOR DELETE TO "authenticated" USING (("public"."is_home_member"("home_id") AND ("public"."has_home_permission"("home_id", 'manage_access'::"text") OR "public"."has_home_permission"("home_id", 'manage_home'::"text"))));



CREATE POLICY "HomeDevice_insert" ON "public"."HomeDevice" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "created_by") AND ("public"."has_home_permission"("home_id", 'manage_access'::"text") OR "public"."has_home_permission"("home_id", 'manage_home'::"text"))));



CREATE POLICY "HomeDevice_select" ON "public"."HomeDevice" FOR SELECT TO "authenticated" USING ("public"."is_home_member"("home_id"));



CREATE POLICY "HomeDevice_update" ON "public"."HomeDevice" FOR UPDATE TO "authenticated" USING (("public"."is_home_member"("home_id") AND ("public"."has_home_permission"("home_id", 'manage_access'::"text") OR "public"."has_home_permission"("home_id", 'manage_home'::"text")))) WITH CHECK ("public"."is_home_member"("home_id"));



ALTER TABLE "public"."HomeDocument" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."HomeEmergency" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "HomeEmergency_delete" ON "public"."HomeEmergency" FOR DELETE TO "authenticated" USING (("public"."is_home_member"("home_id") AND (("auth"."uid"() = "created_by") OR "public"."has_home_permission"("home_id", 'manage_home'::"text"))));



CREATE POLICY "HomeEmergency_insert" ON "public"."HomeEmergency" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "created_by") AND "public"."is_home_member"("home_id")));



CREATE POLICY "HomeEmergency_select" ON "public"."HomeEmergency" FOR SELECT TO "authenticated" USING ("public"."is_home_member"("home_id"));



CREATE POLICY "HomeEmergency_update" ON "public"."HomeEmergency" FOR UPDATE TO "authenticated" USING (("public"."is_home_member"("home_id") AND (("auth"."uid"() = "created_by") OR "public"."has_home_permission"("home_id", 'manage_home'::"text")))) WITH CHECK ("public"."is_home_member"("home_id"));



ALTER TABLE "public"."HomeEstateFields" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "HomeEstateFields_all" ON "public"."HomeEstateFields" TO "authenticated" USING ("public"."is_home_member"("home_id"));



CREATE POLICY "HomeEstateFields_select" ON "public"."HomeEstateFields" FOR SELECT TO "authenticated" USING ("public"."is_home_member"("home_id"));



ALTER TABLE "public"."HomeGuestPass" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."HomeInvite" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "HomeInvite_insert" ON "public"."HomeInvite" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "invited_by") AND "public"."has_home_permission"("home_id", 'manage_home'::"text")));



CREATE POLICY "HomeInvite_select" ON "public"."HomeInvite" FOR SELECT TO "authenticated" USING ("public"."is_home_member"("home_id"));



CREATE POLICY "HomeInvite_update" ON "public"."HomeInvite" FOR UPDATE TO "authenticated" USING ("public"."has_home_permission"("home_id", 'manage_home'::"text")) WITH CHECK ("public"."has_home_permission"("home_id", 'manage_home'::"text"));



ALTER TABLE "public"."HomeIssue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."HomeIssueSensitive" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "HomeIssue_delete" ON "public"."HomeIssue" FOR DELETE TO "authenticated" USING (("public"."is_home_member"("home_id") AND (("auth"."uid"() = "reported_by") OR "public"."has_home_permission"("home_id", 'manage_tasks'::"text") OR "public"."has_home_permission"("home_id", 'manage_home'::"text"))));



CREATE POLICY "HomeIssue_insert" ON "public"."HomeIssue" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "reported_by") AND "public"."is_home_member"("home_id")));



CREATE POLICY "HomeIssue_select" ON "public"."HomeIssue" FOR SELECT TO "authenticated" USING ("public"."is_home_member"("home_id"));



CREATE POLICY "HomeIssue_update" ON "public"."HomeIssue" FOR UPDATE TO "authenticated" USING (("public"."is_home_member"("home_id") AND (("auth"."uid"() = "reported_by") OR "public"."has_home_permission"("home_id", 'manage_tasks'::"text") OR "public"."has_home_permission"("home_id", 'manage_home'::"text")))) WITH CHECK ("public"."is_home_member"("home_id"));



CREATE POLICY "HomeMaintLog_insert" ON "public"."HomeMaintenanceLog" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_home_member"("home_id"));



CREATE POLICY "HomeMaintLog_select" ON "public"."HomeMaintenanceLog" FOR SELECT TO "authenticated" USING ("public"."is_home_member"("home_id"));



CREATE POLICY "HomeMaintTpl_insert" ON "public"."HomeMaintenanceTemplate" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "created_by") AND "public"."is_home_member"("home_id")));



CREATE POLICY "HomeMaintTpl_select" ON "public"."HomeMaintenanceTemplate" FOR SELECT TO "authenticated" USING ("public"."is_home_member"("home_id"));



CREATE POLICY "HomeMaintTpl_update" ON "public"."HomeMaintenanceTemplate" FOR UPDATE TO "authenticated" USING (("public"."is_home_member"("home_id") AND (("auth"."uid"() = "created_by") OR "public"."has_home_permission"("home_id", 'manage_home'::"text")))) WITH CHECK ("public"."is_home_member"("home_id"));



ALTER TABLE "public"."HomeMaintenanceLog" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."HomeMaintenanceTemplate" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."HomeMedia" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."HomeOccupancy" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."HomeOwner" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."HomeOwnershipClaim" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."HomePackage" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "HomePackage_delete" ON "public"."HomePackage" FOR DELETE TO "authenticated" USING (("public"."is_home_member"("home_id") AND (("auth"."uid"() = "created_by") OR "public"."has_home_permission"("home_id", 'manage_home'::"text"))));



CREATE POLICY "HomePackage_insert" ON "public"."HomePackage" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "created_by") AND "public"."is_home_member"("home_id")));



CREATE POLICY "HomePackage_select" ON "public"."HomePackage" FOR SELECT TO "authenticated" USING ("public"."is_home_member"("home_id"));



CREATE POLICY "HomePackage_update" ON "public"."HomePackage" FOR UPDATE TO "authenticated" USING (("public"."is_home_member"("home_id") AND (("auth"."uid"() = "created_by") OR "public"."has_home_permission"("home_id", 'manage_home'::"text")))) WITH CHECK ("public"."is_home_member"("home_id"));



ALTER TABLE "public"."HomePermissionOverride" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."HomePreference" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "HomePreference_select" ON "public"."HomePreference" FOR SELECT TO "authenticated" USING ("public"."is_home_member"("home_id"));



CREATE POLICY "HomePreference_upsert" ON "public"."HomePreference" TO "authenticated" USING ("public"."has_home_permission"("home_id", 'manage_home'::"text"));



ALTER TABLE "public"."HomePrivateData" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."HomePublicData" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."HomeQuorumAction" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."HomeQuorumVote" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."HomeReputation" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "HomeReputation_select" ON "public"."HomeReputation" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."HomeResidencyClaim" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."HomeRolePermission" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."HomeRolePreset" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."HomeRoleTemplateMeta" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."HomeRvStatus" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "HomeRvStatus_all" ON "public"."HomeRvStatus" TO "authenticated" USING ("public"."is_home_member"("home_id"));



CREATE POLICY "HomeRvStatus_select" ON "public"."HomeRvStatus" FOR SELECT TO "authenticated" USING ("public"."is_home_member"("home_id"));



ALTER TABLE "public"."HomeScopedGrant" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."HomeSubscription" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "HomeSubscription_delete" ON "public"."HomeSubscription" FOR DELETE TO "authenticated" USING (("public"."is_home_member"("home_id") AND ("public"."has_home_permission"("home_id", 'manage_finance'::"text") OR "public"."has_home_permission"("home_id", 'manage_home'::"text"))));



CREATE POLICY "HomeSubscription_insert" ON "public"."HomeSubscription" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "created_by") AND ("public"."has_home_permission"("home_id", 'manage_finance'::"text") OR "public"."has_home_permission"("home_id", 'manage_home'::"text"))));



CREATE POLICY "HomeSubscription_select" ON "public"."HomeSubscription" FOR SELECT TO "authenticated" USING ("public"."is_home_member"("home_id"));



CREATE POLICY "HomeSubscription_update" ON "public"."HomeSubscription" FOR UPDATE TO "authenticated" USING (("public"."is_home_member"("home_id") AND ("public"."has_home_permission"("home_id", 'manage_finance'::"text") OR "public"."has_home_permission"("home_id", 'manage_home'::"text")))) WITH CHECK ("public"."is_home_member"("home_id"));



ALTER TABLE "public"."HomeTask" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "HomeTask_delete" ON "public"."HomeTask" FOR DELETE TO "authenticated" USING (("public"."is_home_member"("home_id") AND (("auth"."uid"() = "created_by") OR "public"."has_home_permission"("home_id", 'manage_tasks'::"text") OR "public"."has_home_permission"("home_id", 'manage_home'::"text"))));



CREATE POLICY "HomeTask_insert" ON "public"."HomeTask" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "created_by") AND "public"."is_home_member"("home_id")));



CREATE POLICY "HomeTask_select" ON "public"."HomeTask" FOR SELECT TO "authenticated" USING ("public"."is_home_member"("home_id"));



CREATE POLICY "HomeTask_update" ON "public"."HomeTask" FOR UPDATE TO "authenticated" USING (("public"."is_home_member"("home_id") AND (("auth"."uid"() = "created_by") OR ("auth"."uid"() = "assigned_to") OR "public"."has_home_permission"("home_id", 'manage_tasks'::"text") OR "public"."has_home_permission"("home_id", 'manage_home'::"text")))) WITH CHECK ("public"."is_home_member"("home_id"));



ALTER TABLE "public"."HomeVendor" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "HomeVendor_delete" ON "public"."HomeVendor" FOR DELETE TO "authenticated" USING (("public"."is_home_member"("home_id") AND (("auth"."uid"() = "created_by") OR "public"."has_home_permission"("home_id", 'manage_home'::"text"))));



CREATE POLICY "HomeVendor_insert" ON "public"."HomeVendor" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "created_by") AND "public"."is_home_member"("home_id")));



CREATE POLICY "HomeVendor_select" ON "public"."HomeVendor" FOR SELECT TO "authenticated" USING ("public"."is_home_member"("home_id"));



CREATE POLICY "HomeVendor_update" ON "public"."HomeVendor" FOR UPDATE TO "authenticated" USING (("public"."is_home_member"("home_id") AND (("auth"."uid"() = "created_by") OR "public"."has_home_permission"("home_id", 'manage_home'::"text")))) WITH CHECK ("public"."is_home_member"("home_id"));



ALTER TABLE "public"."HomeVerification" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."HomeVerificationEvidence" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "HomeVerification_select" ON "public"."HomeVerification" FOR SELECT TO "authenticated" USING ("public"."is_home_member"("home_id"));



CREATE POLICY "Household members can create private home data" ON "public"."HomePrivateData" FOR INSERT WITH CHECK ((("auth"."uid"() = "created_by") AND ("home_id" IN ( SELECT "h"."id"
   FROM "public"."Home" "h"
  WHERE (("h"."owner_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."HomeOccupancy" "ho"
          WHERE (("ho"."home_id" = "h"."id") AND ("ho"."user_id" = "auth"."uid"())))))))));



CREATE POLICY "Household members can create public home data" ON "public"."HomePublicData" FOR INSERT WITH CHECK ((("auth"."uid"() = "created_by") AND ("home_id" IN ( SELECT "h"."id"
   FROM "public"."Home" "h"
  WHERE (("h"."owner_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."HomeOccupancy" "ho"
          WHERE (("ho"."home_id" = "h"."id") AND ("ho"."user_id" = "auth"."uid"())))))))));



CREATE POLICY "Household members can view private home data" ON "public"."HomePrivateData" FOR SELECT USING (("home_id" IN ( SELECT "h"."id"
   FROM "public"."Home" "h"
  WHERE (("h"."owner_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."HomeOccupancy" "ho"
          WHERE (("ho"."home_id" = "h"."id") AND ("ho"."user_id" = "auth"."uid"()))))))));



ALTER TABLE "public"."Listing" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ListingMessage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ListingReport" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ListingSave" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ListingView" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Mail" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."MailAction" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."MailPreferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Notification" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Participants can add themselves to rooms" ON "public"."ChatParticipant" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Participants can create typing indicators" ON "public"."ChatTyping" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND ("room_id" IN ( SELECT "ChatParticipant"."room_id"
   FROM "public"."ChatParticipant"
  WHERE ("ChatParticipant"."user_id" = "auth"."uid"())))));



CREATE POLICY "Participants can send messages" ON "public"."ChatMessage" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND ("room_id" IN ( SELECT "ChatParticipant"."room_id"
   FROM "public"."ChatParticipant"
  WHERE ("ChatParticipant"."user_id" = "auth"."uid"())))));



CREATE POLICY "Participants can view room messages" ON "public"."ChatMessage" FOR SELECT USING (("room_id" IN ( SELECT "ChatParticipant"."room_id"
   FROM "public"."ChatParticipant"
  WHERE ("ChatParticipant"."user_id" = "auth"."uid"()))));



CREATE POLICY "Participants can view room participants" ON "public"."ChatParticipant" FOR SELECT USING (("room_id" IN ( SELECT "ChatParticipant_1"."room_id"
   FROM "public"."ChatParticipant" "ChatParticipant_1"
  WHERE ("ChatParticipant_1"."user_id" = "auth"."uid"()))));



CREATE POLICY "Participants can view their chat rooms" ON "public"."ChatRoom" FOR SELECT USING (("id" IN ( SELECT "ChatParticipant"."room_id"
   FROM "public"."ChatParticipant"
  WHERE ("ChatParticipant"."user_id" = "auth"."uid"()))));



CREATE POLICY "Participants can view typing indicators" ON "public"."ChatTyping" FOR SELECT USING (("room_id" IN ( SELECT "ChatParticipant"."room_id"
   FROM "public"."ChatParticipant"
  WHERE ("ChatParticipant"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."PasswordResetToken" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Payment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."PaymentMethod" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Payout" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Post" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."PostComment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."PostLike" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."PostReport" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."PostSave" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."PostShare" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Recipients can update their mail" ON "public"."Mail" FOR UPDATE USING (("auth"."uid"() = "recipient_user_id"));



ALTER TABLE "public"."Refund" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Relationship" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."RelationshipPermission" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Room owners/admins can add others" ON "public"."ChatParticipant" FOR INSERT WITH CHECK (("room_id" IN ( SELECT "ChatParticipant_1"."room_id"
   FROM "public"."ChatParticipant" "ChatParticipant_1"
  WHERE (("ChatParticipant_1"."user_id" = "auth"."uid"()) AND (("ChatParticipant_1"."role")::"text" = ANY ((ARRAY['owner'::character varying, 'admin'::character varying])::"text"[]))))));



ALTER TABLE "public"."SavedPlace" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Senders can update their own messages" ON "public"."ChatMessage" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Senders can view mail they sent" ON "public"."Mail" FOR SELECT USING (("auth"."uid"() = "sender_user_id"));



ALTER TABLE "public"."StripeAccount" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."StripeWebhookEvent" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Subscription" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."SubscriptionPlan" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."User" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."UserCertification" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."UserExperience" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."UserFollow" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."UserPlace" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."UserPortfolio" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."UserProfessionalProfile" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."UserRecentLocation" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."UserSkill" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."UserViewingLocation" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Users can create actions on their mail" ON "public"."MailAction" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND ("mail_id" IN ( SELECT "Mail"."id"
   FROM "public"."Mail"
  WHERE ("Mail"."recipient_user_id" = "auth"."uid"())))));



CREATE POLICY "Users can create assignment history" ON "public"."AssignmentHistory" FOR INSERT WITH CHECK (("auth"."uid"() = "changed_by"));



CREATE POLICY "Users can create assignments for themselves" ON "public"."Assignment" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create chat rooms" ON "public"."ChatRoom" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can create mail as sender" ON "public"."Mail" FOR INSERT WITH CHECK (("auth"."uid"() = "sender_user_id"));



CREATE POLICY "Users can create refund requests" ON "public"."Refund" FOR INSERT WITH CHECK (("auth"."uid"() = "initiated_by"));



CREATE POLICY "Users can create their own mail preferences" ON "public"."MailPreferences" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own saved places" ON "public"."SavedPlace" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own saved places" ON "public"."SavedPlace" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own conversation topics" ON "public"."ConversationTopic" FOR INSERT WITH CHECK ((("auth"."uid"() = "conversation_user_id_1") OR ("auth"."uid"() = "conversation_user_id_2")));



CREATE POLICY "Users can update own quota" ON "public"."FileQuota" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own assignments" ON "public"."Assignment" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own conversation topics" ON "public"."ConversationTopic" FOR UPDATE USING ((("auth"."uid"() = "conversation_user_id_1") OR ("auth"."uid"() = "conversation_user_id_2")));



CREATE POLICY "Users can update their own mail preferences" ON "public"."MailPreferences" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own typing indicators" ON "public"."ChatTyping" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view actions on their mail" ON "public"."MailAction" FOR SELECT USING (("mail_id" IN ( SELECT "Mail"."id"
   FROM "public"."Mail"
  WHERE ("Mail"."recipient_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view assignment history for their assignments" ON "public"."AssignmentHistory" FOR SELECT USING (("assignment_id" IN ( SELECT "Assignment"."id"
   FROM "public"."Assignment"
  WHERE ("Assignment"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view assignment history for their gigs" ON "public"."AssignmentHistory" FOR SELECT USING (("assignment_id" IN ( SELECT "a"."id"
   FROM ("public"."Assignment" "a"
     JOIN "public"."Gig" "g" ON (("a"."gig_id" = "g"."id")))
  WHERE ("g"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view assignments for gigs they posted" ON "public"."Assignment" FOR SELECT USING (("gig_id" IN ( SELECT "Gig"."id"
   FROM "public"."Gig"
  WHERE ("Gig"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view mail for homes they occupy" ON "public"."Mail" FOR SELECT USING (("recipient_home_id" IN ( SELECT "HomeOccupancy"."home_id"
   FROM "public"."HomeOccupancy"
  WHERE ("HomeOccupancy"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view own quota" ON "public"."FileQuota" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own saved places" ON "public"."SavedPlace" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view refunds for their payments" ON "public"."Refund" FOR SELECT USING (("payment_id" IN ( SELECT "Payment"."id"
   FROM "public"."Payment"
  WHERE (("Payment"."payer_id" = "auth"."uid"()) OR ("Payment"."payee_id" = "auth"."uid"())))));



CREATE POLICY "Users can view refunds they initiated" ON "public"."Refund" FOR SELECT USING (("auth"."uid"() = "initiated_by"));



CREATE POLICY "Users can view their own assignments" ON "public"."Assignment" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own conversation topics" ON "public"."ConversationTopic" FOR SELECT USING ((("auth"."uid"() = "conversation_user_id_1") OR ("auth"."uid"() = "conversation_user_id_2")));



CREATE POLICY "Users can view their own mail" ON "public"."Mail" FOR SELECT USING (("auth"."uid"() = "recipient_user_id"));



CREATE POLICY "Users can view their own mail preferences" ON "public"."MailPreferences" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own occupancy" ON "public"."HomeOccupancy" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own payouts" ON "public"."Payout" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own recent locations" ON "public"."UserRecentLocation" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own viewing location" ON "public"."UserViewingLocation" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."VerificationToken" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Wallet" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."WalletTransaction" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "access_log_select_own" ON "public"."FileAccessLog" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "bal_select" ON "public"."BusinessAuditLog" FOR SELECT USING ("public"."is_business_team_member"("business_user_id"));



CREATE POLICY "businessaddress_select_authenticated" ON "public"."BusinessAddress" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "businessaddress_service" ON "public"."BusinessAddress" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "businessaddressdecision_select_owner" ON "public"."BusinessAddressDecision" FOR SELECT USING (("business_user_id" = "auth"."uid"()));



CREATE POLICY "businessaddressdecision_service" ON "public"."BusinessAddressDecision" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "businessmailingaddress_select_owner" ON "public"."BusinessMailingAddress" FOR SELECT USING (("business_user_id" = "auth"."uid"()));



CREATE POLICY "businessmailingaddress_insert_owner" ON "public"."BusinessMailingAddress" FOR INSERT WITH CHECK (("business_user_id" = "auth"."uid"()));



CREATE POLICY "businessmailingaddress_update_owner" ON "public"."BusinessMailingAddress" FOR UPDATE USING (("business_user_id" = "auth"."uid"())) WITH CHECK (("business_user_id" = "auth"."uid"()));



CREATE POLICY "businessmailingaddress_delete_owner" ON "public"."BusinessMailingAddress" FOR DELETE USING (("business_user_id" = "auth"."uid"()));



CREATE POLICY "bcc_select" ON "public"."BusinessCatalogCategory" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."BusinessProfile" "bp"
  WHERE (("bp"."business_user_id" = "bp"."business_user_id") AND ("bp"."is_published" = true)))) OR "public"."business_has_permission"("business_user_id", 'catalog.view'::"public"."business_permission")));



CREATE POLICY "bcc_write" ON "public"."BusinessCatalogCategory" USING ("public"."business_has_permission"("business_user_id", 'catalog.manage'::"public"."business_permission")) WITH CHECK ("public"."business_has_permission"("business_user_id", 'catalog.manage'::"public"."business_permission"));



CREATE POLICY "bci_select" ON "public"."BusinessCatalogItem" FOR SELECT USING (((("status" = 'active'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."BusinessProfile" "bp"
  WHERE (("bp"."business_user_id" = "bp"."business_user_id") AND ("bp"."is_published" = true))))) OR "public"."business_has_permission"("business_user_id", 'catalog.view'::"public"."business_permission")));



CREATE POLICY "bci_write" ON "public"."BusinessCatalogItem" USING ("public"."business_has_permission"("business_user_id", 'catalog.edit'::"public"."business_permission")) WITH CHECK ("public"."business_has_permission"("business_user_id", 'catalog.edit'::"public"."business_permission"));



CREATE POLICY "bhours_select" ON "public"."BusinessHours" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM ("public"."BusinessLocation" "bl"
     JOIN "public"."BusinessProfile" "bp" ON (("bp"."business_user_id" = "bl"."business_user_id")))
  WHERE (("bl"."id" = "BusinessHours"."location_id") AND ("bp"."is_published" = true)))) OR (EXISTS ( SELECT 1
   FROM "public"."BusinessLocation" "bl"
  WHERE (("bl"."id" = "BusinessHours"."location_id") AND "public"."business_has_permission"("bl"."business_user_id", 'hours.view'::"public"."business_permission"))))));



CREATE POLICY "bhours_write" ON "public"."BusinessHours" USING ((EXISTS ( SELECT 1
   FROM "public"."BusinessLocation" "bl"
  WHERE (("bl"."id" = "BusinessHours"."location_id") AND "public"."business_has_permission"("bl"."business_user_id", 'hours.edit'::"public"."business_permission"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."BusinessLocation" "bl"
  WHERE (("bl"."id" = "BusinessHours"."location_id") AND "public"."business_has_permission"("bl"."business_user_id", 'hours.edit'::"public"."business_permission")))));



CREATE POLICY "bloc_select" ON "public"."BusinessLocation" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."BusinessProfile" "bp"
  WHERE (("bp"."business_user_id" = "bp"."business_user_id") AND ("bp"."is_published" = true)))) OR "public"."business_has_permission"("business_user_id", 'locations.view'::"public"."business_permission")));



CREATE POLICY "bloc_write" ON "public"."BusinessLocation" USING ("public"."business_has_permission"("business_user_id", 'locations.manage'::"public"."business_permission")) WITH CHECK ("public"."business_has_permission"("business_user_id", 'locations.manage'::"public"."business_permission"));



CREATE POLICY "bp_select" ON "public"."BusinessProfile" FOR SELECT USING ((("is_published" = true) OR "public"."is_business_team_member"("business_user_id")));



CREATE POLICY "bp_write" ON "public"."BusinessProfile" USING ("public"."business_has_permission"("business_user_id", 'profile.edit'::"public"."business_permission")) WITH CHECK ("public"."business_has_permission"("business_user_id", 'profile.edit'::"public"."business_permission"));



CREATE POLICY "bpage_select" ON "public"."BusinessPage" FOR SELECT USING ((("published_revision" > 0) OR "public"."business_has_permission"("business_user_id", 'pages.view'::"public"."business_permission")));



CREATE POLICY "bpage_write" ON "public"."BusinessPage" USING ("public"."business_has_permission"("business_user_id", 'pages.edit'::"public"."business_permission")) WITH CHECK ("public"."business_has_permission"("business_user_id", 'pages.edit'::"public"."business_permission"));



CREATE POLICY "bpb_select" ON "public"."BusinessPageBlock" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."BusinessPage" "bp"
  WHERE (("bp"."id" = "BusinessPageBlock"."page_id") AND ("bp"."published_revision" = "BusinessPageBlock"."revision") AND ("bp"."published_revision" > 0)))) OR (EXISTS ( SELECT 1
   FROM "public"."BusinessPage" "bp"
  WHERE (("bp"."id" = "BusinessPageBlock"."page_id") AND "public"."business_has_permission"("bp"."business_user_id", 'pages.view'::"public"."business_permission"))))));



CREATE POLICY "bpb_write" ON "public"."BusinessPageBlock" USING ((EXISTS ( SELECT 1
   FROM "public"."BusinessPage" "bp"
  WHERE (("bp"."id" = "BusinessPageBlock"."page_id") AND "public"."business_has_permission"("bp"."business_user_id", 'pages.edit'::"public"."business_permission"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."BusinessPage" "bp"
  WHERE (("bp"."id" = "BusinessPageBlock"."page_id") AND "public"."business_has_permission"("bp"."business_user_id", 'pages.edit'::"public"."business_permission")))));



CREATE POLICY "bpo_write" ON "public"."BusinessPermissionOverride" USING ("public"."business_has_permission"("business_user_id", 'team.manage'::"public"."business_permission")) WITH CHECK ("public"."business_has_permission"("business_user_id", 'team.manage'::"public"."business_permission"));



CREATE POLICY "bpr_select" ON "public"."BusinessPageRevision" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."BusinessPage" "bp"
  WHERE (("bp"."id" = "BusinessPageRevision"."page_id") AND "public"."business_has_permission"("bp"."business_user_id", 'pages.view'::"public"."business_permission")))));



CREATE POLICY "bpriv_select" ON "public"."BusinessPrivate" FOR SELECT USING ("public"."business_has_permission"("business_user_id", 'sensitive.view'::"public"."business_permission"));



CREATE POLICY "bpriv_write" ON "public"."BusinessPrivate" USING ("public"."business_has_permission"("business_user_id", 'sensitive.view'::"public"."business_permission")) WITH CHECK ("public"."business_has_permission"("business_user_id", 'sensitive.view'::"public"."business_permission"));



CREATE POLICY "brp_select" ON "public"."BusinessRolePermission" FOR SELECT USING (true);



CREATE POLICY "brpreset_select" ON "public"."BusinessRolePreset" FOR SELECT USING (true);



CREATE POLICY "bspecial_select" ON "public"."BusinessSpecialHours" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM ("public"."BusinessLocation" "bl"
     JOIN "public"."BusinessProfile" "bp" ON (("bp"."business_user_id" = "bl"."business_user_id")))
  WHERE (("bl"."id" = "BusinessSpecialHours"."location_id") AND ("bp"."is_published" = true)))) OR (EXISTS ( SELECT 1
   FROM "public"."BusinessLocation" "bl"
  WHERE (("bl"."id" = "BusinessSpecialHours"."location_id") AND "public"."business_has_permission"("bl"."business_user_id", 'hours.view'::"public"."business_permission"))))));



CREATE POLICY "bspecial_write" ON "public"."BusinessSpecialHours" USING ((EXISTS ( SELECT 1
   FROM "public"."BusinessLocation" "bl"
  WHERE (("bl"."id" = "BusinessSpecialHours"."location_id") AND "public"."business_has_permission"("bl"."business_user_id", 'hours.edit'::"public"."business_permission"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."BusinessLocation" "bl"
  WHERE (("bl"."id" = "BusinessSpecialHours"."location_id") AND "public"."business_has_permission"("bl"."business_user_id", 'hours.edit'::"public"."business_permission")))));



CREATE POLICY "bt_select" ON "public"."BusinessTeam" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."business_has_permission"("business_user_id", 'team.view'::"public"."business_permission")));



CREATE POLICY "bt_write" ON "public"."BusinessTeam" USING ("public"."business_has_permission"("business_user_id", 'team.manage'::"public"."business_permission")) WITH CHECK ("public"."business_has_permission"("business_user_id", 'team.manage'::"public"."business_permission"));



CREATE POLICY "cert_delete_own" ON "public"."UserCertification" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "cert_insert_own" ON "public"."UserCertification" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "cert_select_shown" ON "public"."UserCertification" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR ("show_on_profile" = true)));



CREATE POLICY "cert_update_own" ON "public"."UserCertification" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "claim_insert_own" ON "public"."HomeResidencyClaim" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "claim_select_involved" ON "public"."HomeResidencyClaim" FOR SELECT USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."HomeOccupancy" "ho"
  WHERE (("ho"."home_id" = "HomeResidencyClaim"."home_id") AND ("ho"."user_id" = "auth"."uid"()) AND ("ho"."is_active" = true) AND ("ho"."role_base" = ANY (ARRAY['owner'::"public"."home_role_base", 'admin'::"public"."home_role_base", 'manager'::"public"."home_role_base"])))))));



CREATE POLICY "claim_update_home_authority" ON "public"."HomeResidencyClaim" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."HomeOccupancy" "ho"
  WHERE (("ho"."home_id" = "HomeResidencyClaim"."home_id") AND ("ho"."user_id" = "auth"."uid"()) AND ("ho"."is_active" = true) AND ("ho"."role_base" = ANY (ARRAY['owner'::"public"."home_role_base", 'admin'::"public"."home_role_base", 'manager'::"public"."home_role_base"]))))));



CREATE POLICY "comment_delete_self" ON "public"."PostComment" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "comment_insert_self" ON "public"."PostComment" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "comment_select_all" ON "public"."PostComment" FOR SELECT USING (("is_deleted" = false));



CREATE POLICY "comment_update_self" ON "public"."PostComment" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "evidence_select" ON "public"."HomeVerificationEvidence" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."HomeOwnershipClaim" "c"
  WHERE (("c"."id" = "HomeVerificationEvidence"."claim_id") AND (("c"."claimant_user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."HomeOwner" "ho"
          WHERE (("ho"."home_id" = "c"."home_id") AND ("ho"."subject_id" = "auth"."uid"()) AND ("ho"."owner_status" = ANY (ARRAY['verified'::"public"."owner_status_type", 'pending'::"public"."owner_status_type"]))))))))));



CREATE POLICY "evidence_service" ON "public"."HomeVerificationEvidence" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "exp_delete_own" ON "public"."UserExperience" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "exp_insert_own" ON "public"."UserExperience" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "exp_select_shown" ON "public"."UserExperience" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR ("show_on_profile" = true)));



CREATE POLICY "exp_update_own" ON "public"."UserExperience" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "file_delete_own" ON "public"."File" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "file_insert_own" ON "public"."File" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "file_select_own" ON "public"."File" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (("visibility")::"text" = 'public'::"text")));



CREATE POLICY "file_update_own" ON "public"."File" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "gig_insert_creator_or_proxy" ON "public"."Gig" FOR INSERT WITH CHECK ((("auth"."uid"() = "created_by") AND "public"."can_proxy_post"("auth"."uid"(), "beneficiary_user_id")));



CREATE POLICY "gig_select_authorized" ON "public"."Gig" FOR SELECT USING ((("auth"."uid"() = "created_by") OR ("auth"."uid"() = "beneficiary_user_id") OR ("auth"."uid"() = "accepted_by")));



CREATE POLICY "gig_update_creator" ON "public"."Gig" FOR UPDATE USING (("auth"."uid"() = "created_by")) WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "gigpriv_select_authorized" ON "public"."GigPrivateLocation" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."Gig" "g"
  WHERE (("g"."id" = "GigPrivateLocation"."gig_id") AND (("auth"."uid"() = "g"."created_by") OR ("auth"."uid"() = "g"."beneficiary_user_id") OR ("auth"."uid"() = "g"."accepted_by"))))));



CREATE POLICY "gigpriv_update_creator" ON "public"."GigPrivateLocation" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."Gig" "g"
  WHERE (("g"."id" = "GigPrivateLocation"."gig_id") AND ("auth"."uid"() = "g"."created_by"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."Gig" "g"
  WHERE (("g"."id" = "GigPrivateLocation"."gig_id") AND ("auth"."uid"() = "g"."created_by")))));



CREATE POLICY "gigpriv_upsert_creator" ON "public"."GigPrivateLocation" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."Gig" "g"
  WHERE (("g"."id" = "GigPrivateLocation"."gig_id") AND ("auth"."uid"() = "g"."created_by")))));



CREATE POLICY "hal_insert_manage" ON "public"."HomeAuditLog" FOR INSERT TO "authenticated" WITH CHECK ("public"."home_has_permission"("home_id", 'members.manage'::"public"."home_permission"));



CREATE POLICY "hal_select_manage" ON "public"."HomeAuditLog" FOR SELECT TO "authenticated" USING ("public"."home_has_permission"("home_id", 'members.manage'::"public"."home_permission"));



CREATE POLICY "has_select_access_meta" ON "public"."HomeAccessSecret" FOR SELECT TO "authenticated" USING ((("public"."home_has_permission"("home_id", 'access.manage'::"public"."home_permission") OR ((("access_type" = 'wifi'::"text") AND "public"."home_has_permission"("home_id", 'access.view_wifi'::"public"."home_permission")) OR (("access_type" <> 'wifi'::"text") AND "public"."home_has_permission"("home_id", 'access.view_codes'::"public"."home_permission")))) AND "public"."home_can_see_visibility"("home_id", "visibility")));



CREATE POLICY "has_select_access_value" ON "public"."HomeAccessSecretValue" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."HomeAccessSecret" "s"
  WHERE (("s"."id" = "HomeAccessSecretValue"."access_secret_id") AND ("public"."home_has_permission"("s"."home_id", 'access.manage'::"public"."home_permission") OR ((("s"."access_type" = 'wifi'::"text") AND "public"."home_has_permission"("s"."home_id", 'access.view_wifi'::"public"."home_permission")) OR (("s"."access_type" <> 'wifi'::"text") AND "public"."home_has_permission"("s"."home_id", 'access.view_codes'::"public"."home_permission")))) AND "public"."home_can_see_visibility"("s"."home_id", "s"."visibility")))));



CREATE POLICY "has_write_access_meta" ON "public"."HomeAccessSecret" TO "authenticated" USING ("public"."home_has_permission"("home_id", 'access.manage'::"public"."home_permission")) WITH CHECK ("public"."home_has_permission"("home_id", 'access.manage'::"public"."home_permission"));



CREATE POLICY "has_write_access_value" ON "public"."HomeAccessSecretValue" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."HomeAccessSecret" "s"
  WHERE (("s"."id" = "HomeAccessSecretValue"."access_secret_id") AND "public"."home_has_permission"("s"."home_id", 'access.manage'::"public"."home_permission"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."HomeAccessSecret" "s"
  WHERE (("s"."id" = "HomeAccessSecretValue"."access_secret_id") AND "public"."home_has_permission"("s"."home_id", 'access.manage'::"public"."home_permission")))));



CREATE POLICY "hbl_select" ON "public"."HomeBusinessLink" FOR SELECT USING ("public"."is_home_member"("home_id"));



CREATE POLICY "hbl_write" ON "public"."HomeBusinessLink" USING ("public"."home_has_permission"("home_id", 'vendors.manage'::"public"."home_permission")) WITH CHECK ("public"."home_has_permission"("home_id", 'vendors.manage'::"public"."home_permission"));



CREATE POLICY "hgp_select_manage" ON "public"."HomeGuestPass" FOR SELECT TO "authenticated" USING ("public"."home_has_permission"("home_id", 'members.manage'::"public"."home_permission"));



CREATE POLICY "hgp_write_manage" ON "public"."HomeGuestPass" TO "authenticated" USING ("public"."home_has_permission"("home_id", 'members.manage'::"public"."home_permission")) WITH CHECK ("public"."home_has_permission"("home_id", 'members.manage'::"public"."home_permission"));



CREATE POLICY "home_delete_owner" ON "public"."Home" FOR DELETE TO "authenticated" USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "home_insert_owner" ON "public"."Home" FOR INSERT TO "authenticated" WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "home_insert_self" ON "public"."Home" FOR INSERT WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "home_select_member" ON "public"."Home" FOR SELECT TO "authenticated" USING (("public"."home_is_active_member"("id") OR ("owner_id" = "auth"."uid"())));



CREATE POLICY "home_update_editors" ON "public"."Home" FOR UPDATE TO "authenticated" USING (("public"."home_has_permission"("id", 'home.edit'::"public"."home_permission") OR ("owner_id" = "auth"."uid"()))) WITH CHECK (("public"."home_has_permission"("id", 'home.edit'::"public"."home_permission") OR ("owner_id" = "auth"."uid"())));



CREATE POLICY "home_update_self" ON "public"."Home" FOR UPDATE USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "addr_verif_event_service" ON "public"."AddressVerificationEvent" FOR ALL TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "homeaddress_select_members" ON "public"."HomeAddress" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."Home" "h"
     JOIN "public"."HomeOccupancy" "ho" ON (("ho"."home_id" = "h"."id")))
  WHERE (("h"."address_id" = "HomeAddress"."id") AND ("ho"."user_id" = "auth"."uid"()) AND ("ho"."is_active" = true)))));



CREATE POLICY "homeaddress_service" ON "public"."HomeAddress" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "homeasset_delete" ON "public"."HomeAsset" FOR DELETE TO "authenticated" USING ("public"."home_has_permission"("home_id", 'assets.manage'::"public"."home_permission"));



CREATE POLICY "homeasset_insert" ON "public"."HomeAsset" FOR INSERT TO "authenticated" WITH CHECK (("public"."home_has_permission"("home_id", 'assets.manage'::"public"."home_permission") AND ("created_by" = "auth"."uid"())));



CREATE POLICY "homeasset_select" ON "public"."HomeAsset" FOR SELECT TO "authenticated" USING ("public"."home_has_permission"("home_id", 'assets.view'::"public"."home_permission"));



CREATE POLICY "homeasset_update" ON "public"."HomeAsset" FOR UPDATE TO "authenticated" USING ("public"."home_has_permission"("home_id", 'assets.manage'::"public"."home_permission")) WITH CHECK ("public"."home_has_permission"("home_id", 'assets.manage'::"public"."home_permission"));



CREATE POLICY "homebill_select" ON "public"."HomeBill" FOR SELECT TO "authenticated" USING ("public"."home_has_permission"("home_id", 'finance.view'::"public"."home_permission"));



CREATE POLICY "homebill_write" ON "public"."HomeBill" TO "authenticated" USING ("public"."home_has_permission"("home_id", 'finance.manage'::"public"."home_permission")) WITH CHECK ("public"."home_has_permission"("home_id", 'finance.manage'::"public"."home_permission"));



CREATE POLICY "homebsplit_select" ON "public"."HomeBillSplit" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."HomeBill" "b"
  WHERE (("b"."id" = "HomeBillSplit"."bill_id") AND "public"."home_has_permission"("b"."home_id", 'finance.view'::"public"."home_permission")))));



CREATE POLICY "homebsplit_write" ON "public"."HomeBillSplit" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."HomeBill" "b"
  WHERE (("b"."id" = "HomeBillSplit"."bill_id") AND "public"."home_has_permission"("b"."home_id", 'finance.manage'::"public"."home_permission"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."HomeBill" "b"
  WHERE (("b"."id" = "HomeBillSplit"."bill_id") AND "public"."home_has_permission"("b"."home_id", 'finance.manage'::"public"."home_permission")))));



CREATE POLICY "homecal_delete" ON "public"."HomeCalendarEvent" FOR DELETE TO "authenticated" USING ("public"."home_has_permission"("home_id", 'calendar.manage'::"public"."home_permission"));



CREATE POLICY "homecal_insert" ON "public"."HomeCalendarEvent" FOR INSERT TO "authenticated" WITH CHECK (("public"."home_has_permission"("home_id", 'calendar.edit'::"public"."home_permission") AND ("created_by" = "auth"."uid"())));



CREATE POLICY "homecal_select" ON "public"."HomeCalendarEvent" FOR SELECT TO "authenticated" USING (("public"."home_has_permission"("home_id", 'calendar.view'::"public"."home_permission") AND "public"."home_can_see_visibility"("home_id", "visibility")));



CREATE POLICY "homecal_update" ON "public"."HomeCalendarEvent" FOR UPDATE TO "authenticated" USING (((("created_by" = "auth"."uid"()) AND "public"."home_has_permission"("home_id", 'calendar.edit'::"public"."home_permission")) OR "public"."home_has_permission"("home_id", 'calendar.manage'::"public"."home_permission"))) WITH CHECK (((("created_by" = "auth"."uid"()) AND "public"."home_has_permission"("home_id", 'calendar.edit'::"public"."home_permission")) OR "public"."home_has_permission"("home_id", 'calendar.manage'::"public"."home_permission")));



CREATE POLICY "homedevice_select" ON "public"."HomeDevice" FOR SELECT TO "authenticated" USING ("public"."home_has_permission"("home_id", 'devices.view'::"public"."home_permission"));



CREATE POLICY "homedevice_write" ON "public"."HomeDevice" TO "authenticated" USING ("public"."home_has_permission"("home_id", 'devices.manage'::"public"."home_permission")) WITH CHECK ("public"."home_has_permission"("home_id", 'devices.manage'::"public"."home_permission"));



CREATE POLICY "homedoc_delete" ON "public"."HomeDocument" FOR DELETE TO "authenticated" USING ("public"."home_has_permission"("home_id", 'docs.manage'::"public"."home_permission"));



CREATE POLICY "homedoc_insert" ON "public"."HomeDocument" FOR INSERT TO "authenticated" WITH CHECK (("public"."home_has_permission"("home_id", 'docs.upload'::"public"."home_permission") AND ("created_by" = "auth"."uid"()) AND "public"."home_can_see_visibility"("home_id", "visibility")));



CREATE POLICY "homedoc_select" ON "public"."HomeDocument" FOR SELECT TO "authenticated" USING (("public"."home_has_permission"("home_id", 'docs.view'::"public"."home_permission") AND "public"."home_can_see_visibility"("home_id", "visibility")));



CREATE POLICY "homedoc_update" ON "public"."HomeDocument" FOR UPDATE TO "authenticated" USING (((("created_by" = "auth"."uid"()) AND "public"."home_has_permission"("home_id", 'docs.upload'::"public"."home_permission")) OR "public"."home_has_permission"("home_id", 'docs.manage'::"public"."home_permission"))) WITH CHECK (((("created_by" = "auth"."uid"()) AND "public"."home_has_permission"("home_id", 'docs.upload'::"public"."home_permission")) OR "public"."home_has_permission"("home_id", 'docs.manage'::"public"."home_permission")));



CREATE POLICY "homeemerg_select" ON "public"."HomeEmergency" FOR SELECT TO "authenticated" USING ("public"."home_has_permission"("home_id", 'home.view'::"public"."home_permission"));



CREATE POLICY "homeemerg_write" ON "public"."HomeEmergency" TO "authenticated" USING ("public"."home_has_permission"("home_id", 'home.edit'::"public"."home_permission")) WITH CHECK ("public"."home_has_permission"("home_id", 'home.edit'::"public"."home_permission"));



CREATE POLICY "homeestate_select" ON "public"."HomeEstateFields" FOR SELECT TO "authenticated" USING ("public"."home_has_permission"("home_id", 'home.view'::"public"."home_permission"));



CREATE POLICY "homeestate_write" ON "public"."HomeEstateFields" TO "authenticated" USING ("public"."home_has_permission"("home_id", 'home.edit'::"public"."home_permission")) WITH CHECK ("public"."home_has_permission"("home_id", 'home.edit'::"public"."home_permission"));



CREATE POLICY "homeinvite_select" ON "public"."HomeInvite" FOR SELECT TO "authenticated" USING ("public"."home_has_permission"("home_id", 'members.manage'::"public"."home_permission"));



CREATE POLICY "homeinvite_write" ON "public"."HomeInvite" TO "authenticated" USING ("public"."home_has_permission"("home_id", 'members.manage'::"public"."home_permission")) WITH CHECK ("public"."home_has_permission"("home_id", 'members.manage'::"public"."home_permission"));



CREATE POLICY "homeissue_delete" ON "public"."HomeIssue" FOR DELETE TO "authenticated" USING ("public"."home_has_permission"("home_id", 'maintenance.manage'::"public"."home_permission"));



CREATE POLICY "homeissue_insert" ON "public"."HomeIssue" FOR INSERT TO "authenticated" WITH CHECK (("public"."home_has_permission"("home_id", 'maintenance.edit'::"public"."home_permission") AND ("reported_by" = "auth"."uid"())));



CREATE POLICY "homeissue_select" ON "public"."HomeIssue" FOR SELECT TO "authenticated" USING ((("public"."home_has_permission"("home_id", 'maintenance.view'::"public"."home_permission") AND "public"."home_can_see_visibility"("home_id", "visibility")) OR "public"."home_has_scoped_grant"("home_id", 'HomeIssue'::"text", "id", 'view'::"text")));



CREATE POLICY "homeissue_update" ON "public"."HomeIssue" FOR UPDATE TO "authenticated" USING (((("reported_by" = "auth"."uid"()) AND "public"."home_has_permission"("home_id", 'maintenance.edit'::"public"."home_permission")) OR "public"."home_has_permission"("home_id", 'maintenance.manage'::"public"."home_permission") OR "public"."home_has_scoped_grant"("home_id", 'HomeIssue'::"text", "id", 'edit'::"text"))) WITH CHECK (((("reported_by" = "auth"."uid"()) AND "public"."home_has_permission"("home_id", 'maintenance.edit'::"public"."home_permission")) OR "public"."home_has_permission"("home_id", 'maintenance.manage'::"public"."home_permission") OR "public"."home_has_scoped_grant"("home_id", 'HomeIssue'::"text", "id", 'edit'::"text")));



CREATE POLICY "homeissuesens_select" ON "public"."HomeIssueSensitive" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."HomeIssue" "i"
  WHERE (("i"."id" = "HomeIssueSensitive"."issue_id") AND "public"."home_has_permission"("i"."home_id", 'sensitive.view'::"public"."home_permission")))));



CREATE POLICY "homeissuesens_write" ON "public"."HomeIssueSensitive" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."HomeIssue" "i"
  WHERE (("i"."id" = "HomeIssueSensitive"."issue_id") AND "public"."home_has_permission"("i"."home_id", 'maintenance.manage'::"public"."home_permission"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."HomeIssue" "i"
  WHERE (("i"."id" = "HomeIssueSensitive"."issue_id") AND "public"."home_has_permission"("i"."home_id", 'maintenance.manage'::"public"."home_permission")))));



CREATE POLICY "homemaintlog_delete" ON "public"."HomeMaintenanceLog" FOR DELETE TO "authenticated" USING ("public"."home_has_permission"("home_id", 'maintenance.manage'::"public"."home_permission"));



CREATE POLICY "homemaintlog_insert" ON "public"."HomeMaintenanceLog" FOR INSERT TO "authenticated" WITH CHECK ("public"."home_has_permission"("home_id", 'maintenance.edit'::"public"."home_permission"));



CREATE POLICY "homemaintlog_select" ON "public"."HomeMaintenanceLog" FOR SELECT TO "authenticated" USING ("public"."home_has_permission"("home_id", 'maintenance.view'::"public"."home_permission"));



CREATE POLICY "homemaintlog_update" ON "public"."HomeMaintenanceLog" FOR UPDATE TO "authenticated" USING ("public"."home_has_permission"("home_id", 'maintenance.manage'::"public"."home_permission")) WITH CHECK ("public"."home_has_permission"("home_id", 'maintenance.manage'::"public"."home_permission"));



CREATE POLICY "homemainttpl_select" ON "public"."HomeMaintenanceTemplate" FOR SELECT TO "authenticated" USING ("public"."home_has_permission"("home_id", 'maintenance.view'::"public"."home_permission"));



CREATE POLICY "homemainttpl_write" ON "public"."HomeMaintenanceTemplate" TO "authenticated" USING ("public"."home_has_permission"("home_id", 'maintenance.manage'::"public"."home_permission")) WITH CHECK ("public"."home_has_permission"("home_id", 'maintenance.manage'::"public"."home_permission"));



CREATE POLICY "homemedia_select" ON "public"."HomeMedia" FOR SELECT TO "authenticated" USING (("public"."home_has_permission"("home_id", 'home.view'::"public"."home_permission") AND "public"."home_can_see_visibility"("home_id", "visibility")));



CREATE POLICY "homemedia_write" ON "public"."HomeMedia" TO "authenticated" USING ("public"."home_has_permission"("home_id", 'docs.manage'::"public"."home_permission")) WITH CHECK ("public"."home_has_permission"("home_id", 'docs.manage'::"public"."home_permission"));



CREATE POLICY "homeocc_delete_membersmanage" ON "public"."HomeOccupancy" FOR DELETE TO "authenticated" USING ("public"."home_has_permission"("home_id", 'members.manage'::"public"."home_permission"));



CREATE POLICY "homeocc_insert_membersmanage" ON "public"."HomeOccupancy" FOR INSERT TO "authenticated" WITH CHECK ("public"."home_has_permission"("home_id", 'members.manage'::"public"."home_permission"));



CREATE POLICY "homeocc_select_self_or_membersview" ON "public"."HomeOccupancy" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."home_has_permission"("home_id", 'members.view'::"public"."home_permission")));



CREATE POLICY "homeocc_update_membersmanage" ON "public"."HomeOccupancy" FOR UPDATE TO "authenticated" USING ("public"."home_has_permission"("home_id", 'members.manage'::"public"."home_permission")) WITH CHECK ("public"."home_has_permission"("home_id", 'members.manage'::"public"."home_permission"));



CREATE POLICY "homeowner_select" ON "public"."HomeOwner" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."HomeOccupancy" "ho"
  WHERE (("ho"."home_id" = "HomeOwner"."home_id") AND ("ho"."user_id" = "auth"."uid"()) AND ("ho"."is_active" = true)))) OR ("subject_id" = "auth"."uid"())));



CREATE POLICY "homeowner_service" ON "public"."HomeOwner" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "homepkg_delete" ON "public"."HomePackage" FOR DELETE TO "authenticated" USING ("public"."home_has_permission"("home_id", 'packages.manage'::"public"."home_permission"));



CREATE POLICY "homepkg_insert" ON "public"."HomePackage" FOR INSERT TO "authenticated" WITH CHECK (("public"."home_has_permission"("home_id", 'packages.edit'::"public"."home_permission") AND ("created_by" = "auth"."uid"())));



CREATE POLICY "homepkg_select" ON "public"."HomePackage" FOR SELECT TO "authenticated" USING (("public"."home_has_permission"("home_id", 'packages.view'::"public"."home_permission") AND "public"."home_can_see_visibility"("home_id", "visibility")));



CREATE POLICY "homepkg_update" ON "public"."HomePackage" FOR UPDATE TO "authenticated" USING (((("created_by" = "auth"."uid"()) AND "public"."home_has_permission"("home_id", 'packages.edit'::"public"."home_permission")) OR "public"."home_has_permission"("home_id", 'packages.manage'::"public"."home_permission"))) WITH CHECK (((("created_by" = "auth"."uid"()) AND "public"."home_has_permission"("home_id", 'packages.edit'::"public"."home_permission")) OR "public"."home_has_permission"("home_id", 'packages.manage'::"public"."home_permission")));



CREATE POLICY "homepref_select" ON "public"."HomePreference" FOR SELECT TO "authenticated" USING ("public"."home_has_permission"("home_id", 'home.view'::"public"."home_permission"));



CREATE POLICY "homepref_write" ON "public"."HomePreference" TO "authenticated" USING ("public"."home_has_permission"("home_id", 'home.edit'::"public"."home_permission")) WITH CHECK ("public"."home_has_permission"("home_id", 'home.edit'::"public"."home_permission"));



CREATE POLICY "homepriv_select" ON "public"."HomePrivateData" FOR SELECT TO "authenticated" USING (("public"."home_has_permission"("home_id", 'sensitive.view'::"public"."home_permission") AND "public"."home_can_see_visibility"("home_id", "visibility")));



CREATE POLICY "homepriv_write" ON "public"."HomePrivateData" TO "authenticated" USING ("public"."home_has_permission"("home_id", 'home.edit'::"public"."home_permission")) WITH CHECK ("public"."home_has_permission"("home_id", 'home.edit'::"public"."home_permission"));



CREATE POLICY "homepub_select" ON "public"."HomePublicData" FOR SELECT TO "authenticated" USING (("public"."home_has_permission"("home_id", 'home.view'::"public"."home_permission") AND "public"."home_can_see_visibility"("home_id", "visibility")));



CREATE POLICY "homepub_write" ON "public"."HomePublicData" TO "authenticated" USING ("public"."home_has_permission"("home_id", 'home.edit'::"public"."home_permission")) WITH CHECK ("public"."home_has_permission"("home_id", 'home.edit'::"public"."home_permission"));



CREATE POLICY "homerep_select" ON "public"."HomeReputation" FOR SELECT TO "authenticated" USING ("public"."home_has_permission"("home_id", 'home.view'::"public"."home_permission"));



CREATE POLICY "homerep_write" ON "public"."HomeReputation" TO "authenticated" USING ("public"."home_has_permission"("home_id", 'home.edit'::"public"."home_permission")) WITH CHECK ("public"."home_has_permission"("home_id", 'home.edit'::"public"."home_permission"));



CREATE POLICY "homerv_select" ON "public"."HomeRvStatus" FOR SELECT TO "authenticated" USING ("public"."home_has_permission"("home_id", 'home.view'::"public"."home_permission"));



CREATE POLICY "homerv_write" ON "public"."HomeRvStatus" TO "authenticated" USING ("public"."home_has_permission"("home_id", 'home.edit'::"public"."home_permission")) WITH CHECK ("public"."home_has_permission"("home_id", 'home.edit'::"public"."home_permission"));



CREATE POLICY "homesub_select" ON "public"."HomeSubscription" FOR SELECT TO "authenticated" USING ("public"."home_has_permission"("home_id", 'finance.view'::"public"."home_permission"));



CREATE POLICY "homesub_write" ON "public"."HomeSubscription" TO "authenticated" USING ("public"."home_has_permission"("home_id", 'finance.manage'::"public"."home_permission")) WITH CHECK ("public"."home_has_permission"("home_id", 'finance.manage'::"public"."home_permission"));



CREATE POLICY "hometask_delete" ON "public"."HomeTask" FOR DELETE TO "authenticated" USING ("public"."home_has_permission"("home_id", 'tasks.manage'::"public"."home_permission"));



CREATE POLICY "hometask_insert" ON "public"."HomeTask" FOR INSERT TO "authenticated" WITH CHECK (("public"."home_has_permission"("home_id", 'tasks.edit'::"public"."home_permission") AND ("created_by" = "auth"."uid"())));



CREATE POLICY "hometask_select" ON "public"."HomeTask" FOR SELECT TO "authenticated" USING ((("public"."home_has_permission"("home_id", 'tasks.view'::"public"."home_permission") AND "public"."home_can_see_visibility"("home_id", "visibility")) OR "public"."home_has_scoped_grant"("home_id", 'HomeTask'::"text", "id", 'view'::"text")));



CREATE POLICY "hometask_update" ON "public"."HomeTask" FOR UPDATE TO "authenticated" USING (((("created_by" = "auth"."uid"()) AND "public"."home_has_permission"("home_id", 'tasks.edit'::"public"."home_permission")) OR "public"."home_has_permission"("home_id", 'tasks.manage'::"public"."home_permission") OR "public"."home_has_scoped_grant"("home_id", 'HomeTask'::"text", "id", 'edit'::"text"))) WITH CHECK (((("created_by" = "auth"."uid"()) AND "public"."home_has_permission"("home_id", 'tasks.edit'::"public"."home_permission")) OR "public"."home_has_permission"("home_id", 'tasks.manage'::"public"."home_permission") OR "public"."home_has_scoped_grant"("home_id", 'HomeTask'::"text", "id", 'edit'::"text")));



CREATE POLICY "homevendor_select" ON "public"."HomeVendor" FOR SELECT TO "authenticated" USING ("public"."home_has_permission"("home_id", 'vendors.view'::"public"."home_permission"));



CREATE POLICY "homevendor_write" ON "public"."HomeVendor" TO "authenticated" USING ("public"."home_has_permission"("home_id", 'vendors.manage'::"public"."home_permission")) WITH CHECK ("public"."home_has_permission"("home_id", 'vendors.manage'::"public"."home_permission"));



CREATE POLICY "homeverif_select" ON "public"."HomeVerification" FOR SELECT TO "authenticated" USING ("public"."home_has_permission"("home_id", 'verification.manage'::"public"."home_permission"));



CREATE POLICY "homeverif_write" ON "public"."HomeVerification" TO "authenticated" USING ("public"."home_has_permission"("home_id", 'verification.manage'::"public"."home_permission")) WITH CHECK ("public"."home_has_permission"("home_id", 'verification.manage'::"public"."home_permission"));



CREATE POLICY "hpo_select_membersmanage" ON "public"."HomePermissionOverride" FOR SELECT TO "authenticated" USING ("public"."home_has_permission"("home_id", 'members.manage'::"public"."home_permission"));



CREATE POLICY "hpo_write_membersmanage" ON "public"."HomePermissionOverride" TO "authenticated" USING ("public"."home_has_permission"("home_id", 'members.manage'::"public"."home_permission")) WITH CHECK ("public"."home_has_permission"("home_id", 'members.manage'::"public"."home_permission"));



CREATE POLICY "hrp_select_all" ON "public"."HomeRolePermission" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "hrpreset_select_all" ON "public"."HomeRolePreset" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "hrtm_select_all" ON "public"."HomeRoleTemplateMeta" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "hsg_select_manage" ON "public"."HomeScopedGrant" FOR SELECT TO "authenticated" USING (("public"."home_has_permission"("home_id", 'members.manage'::"public"."home_permission") OR ("grantee_user_id" = "auth"."uid"())));



CREATE POLICY "hsg_write_manage" ON "public"."HomeScopedGrant" TO "authenticated" USING ("public"."home_has_permission"("home_id", 'members.manage'::"public"."home_permission")) WITH CHECK ("public"."home_has_permission"("home_id", 'members.manage'::"public"."home_permission"));



CREATE POLICY "like_delete_self" ON "public"."PostLike" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "like_insert_self" ON "public"."PostLike" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "like_select_all" ON "public"."PostLike" FOR SELECT USING (true);



CREATE POLICY "listing_delete_own" ON "public"."Listing" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "listing_insert" ON "public"."Listing" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "listing_select_active" ON "public"."Listing" FOR SELECT USING ((("status" = 'active'::"public"."listing_status") OR ("user_id" = "auth"."uid"())));



CREATE POLICY "listing_update_own" ON "public"."Listing" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "listingmsg_insert" ON "public"."ListingMessage" FOR INSERT WITH CHECK (("buyer_id" = "auth"."uid"()));



CREATE POLICY "listingmsg_select" ON "public"."ListingMessage" FOR SELECT USING ((("buyer_id" = "auth"."uid"()) OR ("seller_id" = "auth"."uid"())));



CREATE POLICY "listingreport_insert" ON "public"."ListingReport" FOR INSERT WITH CHECK (("reported_by" = "auth"."uid"()));



CREATE POLICY "listingreport_select_own" ON "public"."ListingReport" FOR SELECT USING (("reported_by" = "auth"."uid"()));



CREATE POLICY "listingsave_delete_own" ON "public"."ListingSave" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "listingsave_insert_own" ON "public"."ListingSave" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "listingsave_select_own" ON "public"."ListingSave" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "mail_delete_service" ON "public"."Mail" FOR DELETE TO "authenticated" USING ((CURRENT_USER = 'service_role'::"name"));



CREATE POLICY "mail_insert_sender_or_service" ON "public"."Mail" FOR INSERT TO "authenticated" WITH CHECK ((("sender_user_id" = "auth"."uid"()) OR (CURRENT_USER = 'service_role'::"name")));



CREATE POLICY "mail_select_visible" ON "public"."Mail" FOR SELECT TO "authenticated" USING ("public"."can_view_mail"("recipient_user_id", "recipient_home_id"));



CREATE POLICY "mail_update_recipient_or_service" ON "public"."Mail" FOR UPDATE TO "authenticated" USING (("public"."can_view_mail"("recipient_user_id", "recipient_home_id") OR (CURRENT_USER = 'service_role'::"name"))) WITH CHECK (("public"."can_view_mail"("recipient_user_id", "recipient_home_id") OR (CURRENT_USER = 'service_role'::"name")));



CREATE POLICY "mailaction_insert_visible" ON "public"."MailAction" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."Mail" "m"
  WHERE (("m"."id" = "MailAction"."mail_id") AND "public"."can_view_mail"("m"."recipient_user_id", "m"."recipient_home_id"))))));



CREATE POLICY "mailaction_select_own" ON "public"."MailAction" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "mailpref_select_own" ON "public"."MailPreferences" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "mailpref_write_own" ON "public"."MailPreferences" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "notification_delete_own" ON "public"."Notification" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "notification_select_own" ON "public"."Notification" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "notification_update_own" ON "public"."Notification" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "ownershipclaim_select" ON "public"."HomeOwnershipClaim" FOR SELECT USING ((("claimant_user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."HomeOwner" "ho"
  WHERE (("ho"."home_id" = "HomeOwnershipClaim"."home_id") AND ("ho"."subject_id" = "auth"."uid"()) AND ("ho"."owner_status" = ANY (ARRAY['verified'::"public"."owner_status_type", 'pending'::"public"."owner_status_type"])))))));



CREATE POLICY "ownershipclaim_service" ON "public"."HomeOwnershipClaim" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "payment_insert_as_payer" ON "public"."Payment" FOR INSERT WITH CHECK (("auth"."uid"() = "payer_id"));



CREATE POLICY "payment_method_delete_own" ON "public"."PaymentMethod" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "payment_method_insert_own" ON "public"."PaymentMethod" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "payment_method_select_own" ON "public"."PaymentMethod" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "payment_method_update_own" ON "public"."PaymentMethod" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "payment_select_involved" ON "public"."Payment" FOR SELECT USING ((("auth"."uid"() = "payer_id") OR ("auth"."uid"() = "payee_id")));



CREATE POLICY "payment_update_involved" ON "public"."Payment" FOR UPDATE USING ((("auth"."uid"() = "payer_id") OR ("auth"."uid"() = "payee_id")));



CREATE POLICY "portfolio_delete_own" ON "public"."UserPortfolio" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "portfolio_insert_own" ON "public"."UserPortfolio" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "portfolio_select_visible" ON "public"."UserPortfolio" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR ("is_visible" = true)));



CREATE POLICY "portfolio_update_own" ON "public"."UserPortfolio" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "post_delete_self" ON "public"."Post" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "post_insert_self" ON "public"."Post" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "post_select_public" ON "public"."Post" FOR SELECT USING (((("visibility")::"text" = 'public'::"text") OR ("user_id" = "auth"."uid"()) OR ((("visibility")::"text" = 'neighborhood'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."User" "u1",
    "public"."User" "u2"
  WHERE (("u1"."id" = "auth"."uid"()) AND ("u2"."id" = "Post"."user_id") AND (("u1"."city")::"text" = ("u2"."city")::"text"))))) OR ((("visibility")::"text" = 'followers'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."UserFollow"
  WHERE (("UserFollow"."follower_id" = "auth"."uid"()) AND ("UserFollow"."following_id" = "Post"."user_id")))))));



CREATE POLICY "post_update_self" ON "public"."Post" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "postsave_delete_own" ON "public"."PostSave" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "postsave_insert_own" ON "public"."PostSave" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "postsave_select_own" ON "public"."PostSave" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "pro_profile_delete_own" ON "public"."UserProfessionalProfile" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "pro_profile_insert_own" ON "public"."UserProfessionalProfile" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "pro_profile_select_public" ON "public"."UserProfessionalProfile" FOR SELECT USING ((("auth"."uid"() = "user_id") OR (("is_active" = true) AND ("is_public" = true))));



CREATE POLICY "pro_profile_update_own" ON "public"."UserProfessionalProfile" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "quorum_action_select" ON "public"."HomeQuorumAction" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."HomeOwner" "ho"
  WHERE (("ho"."home_id" = "HomeQuorumAction"."home_id") AND ("ho"."subject_id" = "auth"."uid"()) AND ("ho"."owner_status" = 'verified'::"public"."owner_status_type")))));



CREATE POLICY "quorum_action_service" ON "public"."HomeQuorumAction" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "quorum_vote_select" ON "public"."HomeQuorumVote" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."HomeQuorumAction" "qa"
     JOIN "public"."HomeOwner" "ho" ON (("ho"."home_id" = "qa"."home_id")))
  WHERE (("qa"."id" = "HomeQuorumVote"."quorum_action_id") AND ("ho"."subject_id" = "auth"."uid"()) AND ("ho"."owner_status" = 'verified'::"public"."owner_status_type")))));



CREATE POLICY "quorum_vote_service" ON "public"."HomeQuorumVote" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "quota_select_own" ON "public"."FileQuota" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "relationship_insert_requester" ON "public"."Relationship" FOR INSERT WITH CHECK (("auth"."uid"() = "requester_id"));



CREATE POLICY "relationship_select_participant" ON "public"."Relationship" FOR SELECT USING ((("auth"."uid"() = "requester_id") OR ("auth"."uid"() = "addressee_id")));



CREATE POLICY "relationship_update_participant" ON "public"."Relationship" FOR UPDATE USING ((("auth"."uid"() = "requester_id") OR ("auth"."uid"() = "addressee_id"))) WITH CHECK ((("auth"."uid"() = "requester_id") OR ("auth"."uid"() = "addressee_id")));



CREATE POLICY "relperm_delete_owner" ON "public"."RelationshipPermission" FOR DELETE USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "relperm_select_owner_or_viewer" ON "public"."RelationshipPermission" FOR SELECT USING ((("auth"."uid"() = "owner_id") OR ("auth"."uid"() = "viewer_id")));



CREATE POLICY "relperm_update_owner" ON "public"."RelationshipPermission" FOR UPDATE USING (("auth"."uid"() = "owner_id")) WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "relperm_upsert_owner" ON "public"."RelationshipPermission" FOR INSERT WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "skill_delete_own" ON "public"."UserSkill" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "skill_insert_own" ON "public"."UserSkill" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "skill_select_own_or_public" ON "public"."UserSkill" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR ("show_on_profile" = true)));



CREATE POLICY "skill_update_own" ON "public"."UserSkill" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "stripe_account_insert_own" ON "public"."StripeAccount" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "stripe_account_select_own" ON "public"."StripeAccount" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "stripe_account_update_own" ON "public"."StripeAccount" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "subscription_insert_own" ON "public"."Subscription" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "subscription_plan_select_all" ON "public"."SubscriptionPlan" FOR SELECT USING (("is_active" = true));



CREATE POLICY "subscription_select_own" ON "public"."Subscription" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "subscription_update_own" ON "public"."Subscription" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "thumbnail_insert_own" ON "public"."FileThumbnail" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."File"
  WHERE (("File"."id" = "FileThumbnail"."file_id") AND ("File"."user_id" = "auth"."uid"())))));



CREATE POLICY "thumbnail_select_all" ON "public"."FileThumbnail" FOR SELECT USING (true);



CREATE POLICY "user_insert_self" ON "public"."User" FOR INSERT TO "authenticated" WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "user_select_self" ON "public"."User" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "user_update_self" ON "public"."User" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "userplace_delete_owner" ON "public"."UserPlace" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "userplace_insert_owner" ON "public"."UserPlace" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "userplace_select_owner" ON "public"."UserPlace" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "userplace_update_owner" ON "public"."UserPlace" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "wallet_select_own" ON "public"."Wallet" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "wallet_service_all" ON "public"."Wallet" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "wallet_tx_select_own" ON "public"."WalletTransaction" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "wallet_tx_service_all" ON "public"."WalletTransaction" USING (("auth"."role"() = 'service_role'::"text"));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON TYPE "public"."listing_category" TO "authenticated";
GRANT ALL ON TYPE "public"."listing_category" TO "service_role";



GRANT ALL ON TYPE "public"."listing_condition" TO "authenticated";
GRANT ALL ON TYPE "public"."listing_condition" TO "service_role";



GRANT ALL ON TYPE "public"."listing_status" TO "authenticated";
GRANT ALL ON TYPE "public"."listing_status" TO "service_role";



GRANT ALL ON TYPE "public"."location_precision" TO "authenticated";
GRANT ALL ON TYPE "public"."location_precision" TO "service_role";



GRANT ALL ON TYPE "public"."post_format" TO "authenticated";
GRANT ALL ON TYPE "public"."post_format" TO "service_role";



GRANT ALL ON TYPE "public"."reveal_policy" TO "authenticated";
GRANT ALL ON TYPE "public"."reveal_policy" TO "service_role";



GRANT ALL ON TYPE "public"."safety_alert_kind" TO "authenticated";
GRANT ALL ON TYPE "public"."safety_alert_kind" TO "service_role";



GRANT ALL ON TYPE "public"."visibility_scope" TO "authenticated";
GRANT ALL ON TYPE "public"."visibility_scope" TO "service_role";



GRANT ALL ON FUNCTION "public"."add_chat_participant"("p_room_id" "uuid", "p_user_id" "uuid", "p_role" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."add_chat_participant"("p_room_id" "uuid", "p_user_id" "uuid", "p_role" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_chat_participant"("p_room_id" "uuid", "p_user_id" "uuid", "p_role" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_business_role_preset"("p_business_user_id" "uuid", "p_user_id" "uuid", "p_preset_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."apply_business_role_preset"("p_business_user_id" "uuid", "p_user_id" "uuid", "p_preset_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_business_role_preset"("p_business_user_id" "uuid", "p_user_id" "uuid", "p_preset_key" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."apply_home_role_preset"("p_home_id" "uuid", "p_user_id" "uuid", "p_preset_key" "text", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_home_role_preset"("p_home_id" "uuid", "p_user_id" "uuid", "p_preset_key" "text", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."apply_home_role_preset"("p_home_id" "uuid", "p_user_id" "uuid", "p_preset_key" "text", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_home_role_preset"("p_home_id" "uuid", "p_user_id" "uuid", "p_preset_key" "text", "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_archive_expired_posts"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_archive_expired_posts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_archive_expired_posts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."batch_endorsement_counts"("p_business_user_ids" "uuid"[], "p_viewer_home_id" "uuid", "p_radius_meters" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."batch_endorsement_counts"("p_business_user_ids" "uuid"[], "p_viewer_home_id" "uuid", "p_radius_meters" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."batch_endorsement_counts"("p_business_user_ids" "uuid"[], "p_viewer_home_id" "uuid", "p_radius_meters" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."business_get_user_permissions"("p_business_user_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."business_get_user_permissions"("p_business_user_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."business_get_user_permissions"("p_business_user_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."business_has_permission"("p_business_user_id" "uuid", "p_permission" "public"."business_permission", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."business_has_permission"("p_business_user_id" "uuid", "p_permission" "public"."business_permission", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."business_has_permission"("p_business_user_id" "uuid", "p_permission" "public"."business_permission", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_platform_fee"("p_amount" integer, "p_fee_percentage" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_platform_fee"("p_amount" integer, "p_fee_percentage" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_platform_fee"("p_amount" integer, "p_fee_percentage" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_stripe_fee"("p_amount" integer, "p_country" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_stripe_fee"("p_amount" integer, "p_country" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_stripe_fee"("p_amount" integer, "p_country" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."can_proxy_post"("actor" "uuid", "beneficiary" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_proxy_post"("actor" "uuid", "beneficiary" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_proxy_post"("actor" "uuid", "beneficiary" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_upload_file"("p_user_id" "uuid", "p_file_size" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."can_upload_file"("p_user_id" "uuid", "p_file_size" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_upload_file"("p_user_id" "uuid", "p_file_size" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."can_view_mail"("p_recipient_user_id" "uuid", "p_recipient_home_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_view_mail"("p_recipient_user_id" "uuid", "p_recipient_home_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_view_mail"("p_recipient_user_id" "uuid", "p_recipient_home_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_typing"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_typing"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_typing"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_deleted_files"("days_old" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_deleted_files"("days_old" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_deleted_files"("days_old" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."close_mail_read_session"("p_session_id" "uuid", "p_user_id" "uuid", "p_active_time_ms" integer, "p_max_scroll_percent" numeric, "p_event_meta" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."close_mail_read_session"("p_session_id" "uuid", "p_user_id" "uuid", "p_active_time_ms" integer, "p_max_scroll_percent" numeric, "p_event_meta" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."close_mail_read_session"("p_session_id" "uuid", "p_user_id" "uuid", "p_active_time_ms" integer, "p_max_scroll_percent" numeric, "p_event_meta" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."compute_user_avg_rating"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."compute_user_avg_rating"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."compute_user_avg_rating"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."decrement_comment_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."decrement_comment_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrement_comment_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_mail_update_columns"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_mail_update_columns"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_mail_update_columns"() TO "service_role";



GRANT ALL ON FUNCTION "public"."find_businesses_in_bounds"("p_south" double precision, "p_west" double precision, "p_north" double precision, "p_east" double precision, "p_categories" "text"[], "p_open_now_only" boolean, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."find_businesses_in_bounds"("p_south" double precision, "p_west" double precision, "p_north" double precision, "p_east" double precision, "p_categories" "text"[], "p_open_now_only" boolean, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_businesses_in_bounds"("p_south" double precision, "p_west" double precision, "p_north" double precision, "p_east" double precision, "p_categories" "text"[], "p_open_now_only" boolean, "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."find_businesses_nearby"("p_center_lat" double precision, "p_center_lon" double precision, "p_radius_meters" integer, "p_viewer_home_id" "uuid", "p_categories" "text"[], "p_rating_min" numeric, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."find_businesses_nearby"("p_center_lat" double precision, "p_center_lon" double precision, "p_radius_meters" integer, "p_viewer_home_id" "uuid", "p_categories" "text"[], "p_rating_min" numeric, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_businesses_nearby"("p_center_lat" double precision, "p_center_lon" double precision, "p_radius_meters" integer, "p_viewer_home_id" "uuid", "p_categories" "text"[], "p_rating_min" numeric, "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."find_gigs_by_category_nearby"("user_lat" double precision, "user_lon" double precision, "gig_category" character varying, "radius_meters" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."find_gigs_by_category_nearby"("user_lat" double precision, "user_lon" double precision, "gig_category" character varying, "radius_meters" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_gigs_by_category_nearby"("user_lat" double precision, "user_lon" double precision, "gig_category" character varying, "radius_meters" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."find_gigs_in_bounds"("min_lat" double precision, "min_lon" double precision, "max_lat" double precision, "max_lon" double precision, "gig_status" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."find_gigs_in_bounds"("min_lat" double precision, "min_lon" double precision, "max_lat" double precision, "max_lon" double precision, "gig_status" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_gigs_in_bounds"("min_lat" double precision, "min_lon" double precision, "max_lat" double precision, "max_lon" double precision, "gig_status" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."find_gigs_nearby"("user_lat" double precision, "user_lon" double precision, "radius_meters" integer, "gig_status" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."find_gigs_nearby"("user_lat" double precision, "user_lon" double precision, "radius_meters" integer, "gig_status" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_gigs_nearby"("user_lat" double precision, "user_lon" double precision, "radius_meters" integer, "gig_status" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."find_listings_in_bounds"("p_south" double precision, "p_west" double precision, "p_north" double precision, "p_east" double precision, "p_category" "text", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."find_listings_in_bounds"("p_south" double precision, "p_west" double precision, "p_north" double precision, "p_east" double precision, "p_category" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_listings_in_bounds"("p_south" double precision, "p_west" double precision, "p_north" double precision, "p_east" double precision, "p_category" "text", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."find_listings_nearby"("p_latitude" double precision, "p_longitude" double precision, "p_radius_meters" integer, "p_limit" integer, "p_offset" integer, "p_category" "text", "p_min_price" numeric, "p_max_price" numeric, "p_is_free" boolean, "p_condition" "text", "p_search" "text", "p_sort" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."find_listings_nearby"("p_latitude" double precision, "p_longitude" double precision, "p_radius_meters" integer, "p_limit" integer, "p_offset" integer, "p_category" "text", "p_min_price" numeric, "p_max_price" numeric, "p_is_free" boolean, "p_condition" "text", "p_search" "text", "p_sort" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_listings_nearby"("p_latitude" double precision, "p_longitude" double precision, "p_radius_meters" integer, "p_limit" integer, "p_offset" integer, "p_category" "text", "p_min_price" numeric, "p_max_price" numeric, "p_is_free" boolean, "p_condition" "text", "p_search" "text", "p_sort" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_building_trust_count"("p_business_user_id" "uuid", "p_parent_home_id" "uuid", "p_category" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_building_trust_count"("p_business_user_id" "uuid", "p_parent_home_id" "uuid", "p_category" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_building_trust_count"("p_business_user_id" "uuid", "p_parent_home_id" "uuid", "p_category" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_endorsement_count"("p_business_user_id" "uuid", "p_viewer_home_id" "uuid", "p_radius_meters" integer, "p_category" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_endorsement_count"("p_business_user_id" "uuid", "p_viewer_home_id" "uuid", "p_radius_meters" integer, "p_category" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_endorsement_count"("p_business_user_id" "uuid", "p_viewer_home_id" "uuid", "p_radius_meters" integer, "p_category" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_full_home_profile"("p_home_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_full_home_profile"("p_home_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_full_home_profile"("p_home_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_gigs_by_distance"("user_lat" double precision, "user_lon" double precision, "limit_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_gigs_by_distance"("user_lat" double precision, "user_lon" double precision, "limit_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_gigs_by_distance"("user_lat" double precision, "user_lon" double precision, "limit_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_home_profile_with_media"("p_home_id" "uuid", "p_visibility" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."get_home_profile_with_media"("p_home_id" "uuid", "p_visibility" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_home_profile_with_media"("p_home_id" "uuid", "p_visibility" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_neighbor_trust_count"("p_business_user_id" "uuid", "p_viewer_home_id" "uuid", "p_radius_meters" integer, "p_category" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_neighbor_trust_count"("p_business_user_id" "uuid", "p_viewer_home_id" "uuid", "p_radius_meters" integer, "p_category" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_neighbor_trust_count"("p_business_user_id" "uuid", "p_viewer_home_id" "uuid", "p_radius_meters" integer, "p_category" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_neighborhood_feed"("p_user_id" "uuid", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_neighborhood_feed"("p_user_id" "uuid", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_neighborhood_feed"("p_user_id" "uuid", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_neighborhood_feed"("p_user_id" "uuid", "p_limit" integer, "p_offset" integer, "p_post_type" "text", "p_radius_meters" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_neighborhood_feed"("p_user_id" "uuid", "p_limit" integer, "p_offset" integer, "p_post_type" "text", "p_radius_meters" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_neighborhood_feed"("p_user_id" "uuid", "p_limit" integer, "p_offset" integer, "p_post_type" "text", "p_radius_meters" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_neighborhood_feed_at"("p_user_id" "uuid", "p_latitude" double precision, "p_longitude" double precision, "p_limit" integer, "p_offset" integer, "p_post_type" "text", "p_radius_meters" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_neighborhood_feed_at"("p_user_id" "uuid", "p_latitude" double precision, "p_longitude" double precision, "p_limit" integer, "p_offset" integer, "p_post_type" "text", "p_radius_meters" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_neighborhood_feed_at"("p_user_id" "uuid", "p_latitude" double precision, "p_longitude" double precision, "p_limit" integer, "p_offset" integer, "p_post_type" "text", "p_radius_meters" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_neighborhood_feed_v2"("p_user_id" "uuid", "p_latitude" double precision, "p_longitude" double precision, "p_limit" integer, "p_offset" integer, "p_post_type" "text", "p_radius_meters" integer, "p_tags" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_neighborhood_feed_v2"("p_user_id" "uuid", "p_latitude" double precision, "p_longitude" double precision, "p_limit" integer, "p_offset" integer, "p_post_type" "text", "p_radius_meters" integer, "p_tags" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_neighborhood_feed_v2"("p_user_id" "uuid", "p_latitude" double precision, "p_longitude" double precision, "p_limit" integer, "p_offset" integer, "p_post_type" "text", "p_radius_meters" integer, "p_tags" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_direct_chat"("p_user_id_1" "uuid", "p_user_id_2" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_direct_chat"("p_user_id_1" "uuid", "p_user_id_2" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_direct_chat"("p_user_id_1" "uuid", "p_user_id_2" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_gig_chat"("p_gig_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_gig_chat"("p_gig_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_gig_chat"("p_gig_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_home_chat"("p_home_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_home_chat"("p_home_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_home_chat"("p_home_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_user_quota"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_user_quota"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_user_quota"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."Wallet" TO "anon";
GRANT ALL ON TABLE "public"."Wallet" TO "authenticated";
GRANT ALL ON TABLE "public"."Wallet" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_wallet"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_wallet"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_wallet"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_posts_in_bounds"("p_user_id" "uuid", "p_south" double precision, "p_west" double precision, "p_north" double precision, "p_east" double precision, "p_limit" integer, "p_post_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_posts_in_bounds"("p_user_id" "uuid", "p_south" double precision, "p_west" double precision, "p_north" double precision, "p_east" double precision, "p_limit" integer, "p_post_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_posts_in_bounds"("p_user_id" "uuid", "p_south" double precision, "p_west" double precision, "p_north" double precision, "p_east" double precision, "p_limit" integer, "p_post_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_business_locations"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_business_locations"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_business_locations"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_chat_rooms"("p_user_id" "uuid", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_chat_rooms"("p_user_id" "uuid", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_chat_rooms"("p_user_id" "uuid", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_earnings"("p_user_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_earnings"("p_user_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_earnings"("p_user_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_home_locations"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_home_locations"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_home_locations"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_inbox"("p_user_id" "uuid", "p_type" character varying, "p_viewed" boolean, "p_archived" boolean, "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_inbox"("p_user_id" "uuid", "p_type" character varying, "p_viewed" boolean, "p_archived" boolean, "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_inbox"("p_user_id" "uuid", "p_type" character varying, "p_viewed" boolean, "p_archived" boolean, "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_pending_earnings"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_pending_earnings"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_pending_earnings"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_profile_with_media"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_profile_with_media"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_profile_with_media"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_spending"("p_user_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_spending"("p_user_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_spending"("p_user_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_storage_stats"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_storage_stats"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_storage_stats"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_stripe_account"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_stripe_account"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_stripe_account"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_total_earned"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_total_earned"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_total_earned"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_home_permission"("p_home_id" "uuid", "p_perm" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_home_permission"("p_home_id" "uuid", "p_perm" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_home_permission"("p_home_id" "uuid", "p_perm" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."home_can_see_visibility"("p_home_id" "uuid", "p_vis" "public"."home_record_visibility", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."home_can_see_visibility"("p_home_id" "uuid", "p_vis" "public"."home_record_visibility", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."home_can_see_visibility"("p_home_id" "uuid", "p_vis" "public"."home_record_visibility", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."home_get_user_permissions"("p_home_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."home_get_user_permissions"("p_home_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."home_get_user_permissions"("p_home_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."home_has_permission"("p_home_id" "uuid", "p_perm" "public"."home_permission", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."home_has_permission"("p_home_id" "uuid", "p_perm" "public"."home_permission", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."home_has_permission"("p_home_id" "uuid", "p_perm" "public"."home_permission", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."home_has_role_at_least"("p_home_id" "uuid", "p_min_role" "public"."home_role_base", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."home_has_role_at_least"("p_home_id" "uuid", "p_min_role" "public"."home_role_base", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."home_has_role_at_least"("p_home_id" "uuid", "p_min_role" "public"."home_role_base", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."home_has_scoped_grant"("p_home_id" "uuid", "p_resource_type" "text", "p_resource_id" "uuid", "p_need" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."home_has_scoped_grant"("p_home_id" "uuid", "p_resource_type" "text", "p_resource_id" "uuid", "p_need" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."home_has_scoped_grant"("p_home_id" "uuid", "p_resource_type" "text", "p_resource_id" "uuid", "p_need" "text", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."home_is_active_member"("p_home_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."home_is_active_member"("p_home_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."home_is_active_member"("p_home_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."home_member_can"("p_home_id" "uuid", "p_perm" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."home_member_can"("p_home_id" "uuid", "p_perm" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."home_member_can"("p_home_id" "uuid", "p_perm" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."home_my_role"("p_home_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."home_my_role"("p_home_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."home_my_role"("p_home_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."home_role_rank"("p_role" "public"."home_role_base") TO "anon";
GRANT ALL ON FUNCTION "public"."home_role_rank"("p_role" "public"."home_role_base") TO "authenticated";
GRANT ALL ON FUNCTION "public"."home_role_rank"("p_role" "public"."home_role_base") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_comment_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_comment_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_comment_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_file_access"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_file_access"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_file_access"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_unread_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_unread_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_unread_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_unread_count"("p_room_id" "uuid", "p_exclude_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_unread_count"("p_room_id" "uuid", "p_exclude_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_unread_count"("p_room_id" "uuid", "p_exclude_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_business_team_member"("p_business_user_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_business_team_member"("p_business_user_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_business_team_member"("p_business_user_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_friends"("a" "uuid", "b" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_friends"("a" "uuid", "b" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_friends"("a" "uuid", "b" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_home_member"("p_home_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_home_member"("p_home_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_home_member"("p_home_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."listing_set_location_geog"() TO "anon";
GRANT ALL ON FUNCTION "public"."listing_set_location_geog"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."listing_set_location_geog"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_mail_viewed"("p_mail_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_mail_viewed"("p_mail_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_mail_viewed"("p_mail_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_messages_read"("p_room_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_messages_read"("p_room_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_messages_read"("p_room_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_address_hash"("p_line1" "text", "p_line2" "text", "p_city" "text", "p_state" "text", "p_postal" "text", "p_country" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_address_hash"("p_line1" "text", "p_line2" "text", "p_city" "text", "p_state" "text", "p_postal" "text", "p_country" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_address_hash"("p_line1" "text", "p_line2" "text", "p_city" "text", "p_state" "text", "p_postal" "text", "p_country" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."open_mail_read_session"("p_mail_id" "uuid", "p_user_id" "uuid", "p_client_meta" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."open_mail_read_session"("p_mail_id" "uuid", "p_user_id" "uuid", "p_client_meta" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."open_mail_read_session"("p_mail_id" "uuid", "p_user_id" "uuid", "p_client_meta" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."post_set_location_geog"() TO "anon";
GRANT ALL ON FUNCTION "public"."post_set_location_geog"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."post_set_location_geog"() TO "service_role";



GRANT ALL ON FUNCTION "public"."soft_delete_file"("p_file_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."soft_delete_file"("p_file_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."soft_delete_file"("p_file_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_followers_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_followers_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_followers_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_home_access_secret_value"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_home_access_secret_value"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_home_access_secret_value"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_home_issue_sensitive"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_home_issue_sensitive"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_home_issue_sensitive"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_post_comment_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_post_comment_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_post_comment_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_post_share_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_post_share_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_post_share_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."toggle_listing_save"("p_listing_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."toggle_listing_save"("p_listing_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_listing_save"("p_listing_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."toggle_post_like"("p_post_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."toggle_post_like"("p_post_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_post_like"("p_post_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."toggle_post_save"("p_post_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."toggle_post_save"("p_post_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_post_save"("p_post_id" "uuid", "p_user_id" "uuid") TO "service_role";


GRANT ALL ON FUNCTION "public"."record_post_unique_view"("p_post_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trim_recent_locations"() TO "anon";
GRANT ALL ON FUNCTION "public"."trim_recent_locations"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trim_recent_locations"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_payment_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_payment_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_payment_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_quota_after_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_quota_after_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_quota_after_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_quota_after_upload"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_quota_after_upload"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_quota_after_upload"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_profile_picture"("p_user_id" "uuid", "p_file_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_profile_picture"("p_user_id" "uuid", "p_file_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_profile_picture"("p_user_id" "uuid", "p_file_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_rating"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_rating"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_rating"() TO "service_role";



GRANT ALL ON TABLE "public"."WalletTransaction" TO "anon";
GRANT ALL ON TABLE "public"."WalletTransaction" TO "authenticated";
GRANT ALL ON TABLE "public"."WalletTransaction" TO "service_role";



GRANT ALL ON FUNCTION "public"."wallet_credit"("p_user_id" "uuid", "p_amount" bigint, "p_type" character varying, "p_description" "text", "p_payment_id" "uuid", "p_gig_id" "uuid", "p_counterparty_id" "uuid", "p_stripe_pi_id" character varying, "p_idempotency_key" character varying, "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."wallet_credit"("p_user_id" "uuid", "p_amount" bigint, "p_type" character varying, "p_description" "text", "p_payment_id" "uuid", "p_gig_id" "uuid", "p_counterparty_id" "uuid", "p_stripe_pi_id" character varying, "p_idempotency_key" character varying, "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."wallet_credit"("p_user_id" "uuid", "p_amount" bigint, "p_type" character varying, "p_description" "text", "p_payment_id" "uuid", "p_gig_id" "uuid", "p_counterparty_id" "uuid", "p_stripe_pi_id" character varying, "p_idempotency_key" character varying, "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."wallet_debit"("p_user_id" "uuid", "p_amount" bigint, "p_type" character varying, "p_description" "text", "p_payment_id" "uuid", "p_gig_id" "uuid", "p_counterparty_id" "uuid", "p_stripe_transfer" character varying, "p_idempotency_key" character varying, "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."wallet_debit"("p_user_id" "uuid", "p_amount" bigint, "p_type" character varying, "p_description" "text", "p_payment_id" "uuid", "p_gig_id" "uuid", "p_counterparty_id" "uuid", "p_stripe_transfer" character varying, "p_idempotency_key" character varying, "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."wallet_debit"("p_user_id" "uuid", "p_amount" bigint, "p_type" character varying, "p_description" "text", "p_payment_id" "uuid", "p_gig_id" "uuid", "p_counterparty_id" "uuid", "p_stripe_transfer" character varying, "p_idempotency_key" character varying, "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."wallet_transfer"("p_from_user_id" "uuid", "p_to_user_id" "uuid", "p_amount" bigint, "p_type_debit" character varying, "p_type_credit" character varying, "p_description" "text", "p_payment_id" "uuid", "p_gig_id" "uuid", "p_idempotency_key" character varying, "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."wallet_transfer"("p_from_user_id" "uuid", "p_to_user_id" "uuid", "p_amount" bigint, "p_type_debit" character varying, "p_type_credit" character varying, "p_description" "text", "p_payment_id" "uuid", "p_gig_id" "uuid", "p_idempotency_key" character varying, "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."wallet_transfer"("p_from_user_id" "uuid", "p_to_user_id" "uuid", "p_amount" bigint, "p_type_debit" character varying, "p_type_credit" character varying, "p_description" "text", "p_payment_id" "uuid", "p_gig_id" "uuid", "p_idempotency_key" character varying, "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON TABLE "public"."AdCampaign" TO "anon";
GRANT ALL ON TABLE "public"."AdCampaign" TO "authenticated";
GRANT ALL ON TABLE "public"."AdCampaign" TO "service_role";



GRANT ALL ON TABLE "public"."AssetPhoto" TO "anon";
GRANT ALL ON TABLE "public"."AssetPhoto" TO "authenticated";
GRANT ALL ON TABLE "public"."AssetPhoto" TO "service_role";



GRANT ALL ON TABLE "public"."Assignment" TO "anon";
GRANT ALL ON TABLE "public"."Assignment" TO "authenticated";
GRANT ALL ON TABLE "public"."Assignment" TO "service_role";



GRANT ALL ON TABLE "public"."AssignmentHistory" TO "anon";
GRANT ALL ON TABLE "public"."AssignmentHistory" TO "authenticated";
GRANT ALL ON TABLE "public"."AssignmentHistory" TO "service_role";



GRANT ALL ON TABLE "public"."BookletPage" TO "anon";
GRANT ALL ON TABLE "public"."BookletPage" TO "authenticated";
GRANT ALL ON TABLE "public"."BookletPage" TO "service_role";



GRANT ALL ON TABLE "public"."BusinessAuditLog" TO "anon";
GRANT ALL ON TABLE "public"."BusinessAuditLog" TO "authenticated";
GRANT ALL ON TABLE "public"."BusinessAuditLog" TO "service_role";



GRANT ALL ON TABLE "public"."BusinessCatalogCategory" TO "anon";
GRANT ALL ON TABLE "public"."BusinessCatalogCategory" TO "authenticated";
GRANT ALL ON TABLE "public"."BusinessCatalogCategory" TO "service_role";



GRANT ALL ON TABLE "public"."BusinessCatalogItem" TO "anon";
GRANT ALL ON TABLE "public"."BusinessCatalogItem" TO "authenticated";
GRANT ALL ON TABLE "public"."BusinessCatalogItem" TO "service_role";



GRANT ALL ON TABLE "public"."BusinessAddress" TO "anon";
GRANT ALL ON TABLE "public"."BusinessAddress" TO "authenticated";
GRANT ALL ON TABLE "public"."BusinessAddress" TO "service_role";



GRANT ALL ON TABLE "public"."BusinessAddressDecision" TO "anon";
GRANT ALL ON TABLE "public"."BusinessAddressDecision" TO "authenticated";
GRANT ALL ON TABLE "public"."BusinessAddressDecision" TO "service_role";



GRANT ALL ON TABLE "public"."BusinessFollow" TO "anon";
GRANT ALL ON TABLE "public"."BusinessFollow" TO "authenticated";
GRANT ALL ON TABLE "public"."BusinessFollow" TO "service_role";



GRANT ALL ON TABLE "public"."BusinessHours" TO "anon";
GRANT ALL ON TABLE "public"."BusinessHours" TO "authenticated";
GRANT ALL ON TABLE "public"."BusinessHours" TO "service_role";



GRANT ALL ON TABLE "public"."BusinessLocation" TO "anon";
GRANT ALL ON TABLE "public"."BusinessLocation" TO "authenticated";
GRANT ALL ON TABLE "public"."BusinessLocation" TO "service_role";



GRANT ALL ON TABLE "public"."BusinessMailingAddress" TO "anon";
GRANT ALL ON TABLE "public"."BusinessMailingAddress" TO "authenticated";
GRANT ALL ON TABLE "public"."BusinessMailingAddress" TO "service_role";



GRANT ALL ON TABLE "public"."BusinessPage" TO "anon";
GRANT ALL ON TABLE "public"."BusinessPage" TO "authenticated";
GRANT ALL ON TABLE "public"."BusinessPage" TO "service_role";



GRANT ALL ON TABLE "public"."BusinessPageBlock" TO "anon";
GRANT ALL ON TABLE "public"."BusinessPageBlock" TO "authenticated";
GRANT ALL ON TABLE "public"."BusinessPageBlock" TO "service_role";



GRANT ALL ON TABLE "public"."BusinessPageRevision" TO "anon";
GRANT ALL ON TABLE "public"."BusinessPageRevision" TO "authenticated";
GRANT ALL ON TABLE "public"."BusinessPageRevision" TO "service_role";



GRANT ALL ON TABLE "public"."BusinessPermissionOverride" TO "anon";
GRANT ALL ON TABLE "public"."BusinessPermissionOverride" TO "authenticated";
GRANT ALL ON TABLE "public"."BusinessPermissionOverride" TO "service_role";



GRANT ALL ON TABLE "public"."BusinessPrivate" TO "anon";
GRANT ALL ON TABLE "public"."BusinessPrivate" TO "authenticated";
GRANT ALL ON TABLE "public"."BusinessPrivate" TO "service_role";



GRANT ALL ON TABLE "public"."BusinessProfile" TO "anon";
GRANT ALL ON TABLE "public"."BusinessProfile" TO "authenticated";
GRANT ALL ON TABLE "public"."BusinessProfile" TO "service_role";



GRANT ALL ON TABLE "public"."BusinessProfileView" TO "anon";
GRANT ALL ON TABLE "public"."BusinessProfileView" TO "authenticated";
GRANT ALL ON TABLE "public"."BusinessProfileView" TO "service_role";



GRANT ALL ON TABLE "public"."BusinessRolePermission" TO "anon";
GRANT ALL ON TABLE "public"."BusinessRolePermission" TO "authenticated";
GRANT ALL ON TABLE "public"."BusinessRolePermission" TO "service_role";



GRANT ALL ON TABLE "public"."BusinessRolePreset" TO "anon";
GRANT ALL ON TABLE "public"."BusinessRolePreset" TO "authenticated";
GRANT ALL ON TABLE "public"."BusinessRolePreset" TO "service_role";



GRANT ALL ON TABLE "public"."BusinessSpecialHours" TO "anon";
GRANT ALL ON TABLE "public"."BusinessSpecialHours" TO "authenticated";
GRANT ALL ON TABLE "public"."BusinessSpecialHours" TO "service_role";



GRANT ALL ON TABLE "public"."BusinessTeam" TO "anon";
GRANT ALL ON TABLE "public"."BusinessTeam" TO "authenticated";
GRANT ALL ON TABLE "public"."BusinessTeam" TO "service_role";



GRANT ALL ON TABLE "public"."ChatMessage" TO "anon";
GRANT ALL ON TABLE "public"."ChatMessage" TO "authenticated";
GRANT ALL ON TABLE "public"."ChatMessage" TO "service_role";



GRANT ALL ON TABLE "public"."ChatParticipant" TO "anon";
GRANT ALL ON TABLE "public"."ChatParticipant" TO "authenticated";
GRANT ALL ON TABLE "public"."ChatParticipant" TO "service_role";



GRANT ALL ON TABLE "public"."ChatRoom" TO "anon";
GRANT ALL ON TABLE "public"."ChatRoom" TO "authenticated";
GRANT ALL ON TABLE "public"."ChatRoom" TO "service_role";



GRANT ALL ON TABLE "public"."ChatTyping" TO "anon";
GRANT ALL ON TABLE "public"."ChatTyping" TO "authenticated";
GRANT ALL ON TABLE "public"."ChatTyping" TO "service_role";



GRANT ALL ON TABLE "public"."CommentLike" TO "anon";
GRANT ALL ON TABLE "public"."CommentLike" TO "authenticated";
GRANT ALL ON TABLE "public"."CommentLike" TO "service_role";



GRANT ALL ON TABLE "public"."CommunityMailItem" TO "anon";
GRANT ALL ON TABLE "public"."CommunityMailItem" TO "authenticated";
GRANT ALL ON TABLE "public"."CommunityMailItem" TO "service_role";



GRANT ALL ON TABLE "public"."CommunityReaction" TO "anon";
GRANT ALL ON TABLE "public"."CommunityReaction" TO "authenticated";
GRANT ALL ON TABLE "public"."CommunityReaction" TO "service_role";



GRANT ALL ON TABLE "public"."ConversationTopic" TO "anon";
GRANT ALL ON TABLE "public"."ConversationTopic" TO "authenticated";
GRANT ALL ON TABLE "public"."ConversationTopic" TO "service_role";



GRANT ALL ON TABLE "public"."EarnOffer" TO "anon";
GRANT ALL ON TABLE "public"."EarnOffer" TO "authenticated";
GRANT ALL ON TABLE "public"."EarnOffer" TO "service_role";



GRANT ALL ON TABLE "public"."EarnRiskSession" TO "anon";
GRANT ALL ON TABLE "public"."EarnRiskSession" TO "authenticated";
GRANT ALL ON TABLE "public"."EarnRiskSession" TO "service_role";



GRANT ALL ON TABLE "public"."EarnSuspension" TO "anon";
GRANT ALL ON TABLE "public"."EarnSuspension" TO "authenticated";
GRANT ALL ON TABLE "public"."EarnSuspension" TO "service_role";



GRANT ALL ON TABLE "public"."EarnTransaction" TO "anon";
GRANT ALL ON TABLE "public"."EarnTransaction" TO "authenticated";
GRANT ALL ON TABLE "public"."EarnTransaction" TO "service_role";



GRANT ALL ON TABLE "public"."EarnWallet" TO "anon";
GRANT ALL ON TABLE "public"."EarnWallet" TO "authenticated";
GRANT ALL ON TABLE "public"."EarnWallet" TO "service_role";



GRANT ALL ON TABLE "public"."File" TO "anon";
GRANT ALL ON TABLE "public"."File" TO "authenticated";
GRANT ALL ON TABLE "public"."File" TO "service_role";



GRANT ALL ON TABLE "public"."FileAccessLog" TO "anon";
GRANT ALL ON TABLE "public"."FileAccessLog" TO "authenticated";
GRANT ALL ON TABLE "public"."FileAccessLog" TO "service_role";



GRANT ALL ON TABLE "public"."FileQuota" TO "anon";
GRANT ALL ON TABLE "public"."FileQuota" TO "authenticated";
GRANT ALL ON TABLE "public"."FileQuota" TO "service_role";



GRANT ALL ON TABLE "public"."FileThumbnail" TO "anon";
GRANT ALL ON TABLE "public"."FileThumbnail" TO "authenticated";
GRANT ALL ON TABLE "public"."FileThumbnail" TO "service_role";



GRANT ALL ON TABLE "public"."Gig" TO "anon";
GRANT ALL ON TABLE "public"."Gig" TO "authenticated";
GRANT ALL ON TABLE "public"."Gig" TO "service_role";



GRANT ALL ON TABLE "public"."GigBid" TO "anon";
GRANT ALL ON TABLE "public"."GigBid" TO "authenticated";
GRANT ALL ON TABLE "public"."GigBid" TO "service_role";



GRANT ALL ON TABLE "public"."GigChangeOrder" TO "anon";
GRANT ALL ON TABLE "public"."GigChangeOrder" TO "authenticated";
GRANT ALL ON TABLE "public"."GigChangeOrder" TO "service_role";



GRANT ALL ON TABLE "public"."GigIncident" TO "anon";
GRANT ALL ON TABLE "public"."GigIncident" TO "authenticated";
GRANT ALL ON TABLE "public"."GigIncident" TO "service_role";



GRANT ALL ON TABLE "public"."GigMedia" TO "anon";
GRANT ALL ON TABLE "public"."GigMedia" TO "authenticated";
GRANT ALL ON TABLE "public"."GigMedia" TO "service_role";



GRANT ALL ON TABLE "public"."GigPrivateLocation" TO "anon";
GRANT ALL ON TABLE "public"."GigPrivateLocation" TO "authenticated";
GRANT ALL ON TABLE "public"."GigPrivateLocation" TO "service_role";



GRANT ALL ON TABLE "public"."GigPublic" TO "anon";
GRANT ALL ON TABLE "public"."GigPublic" TO "authenticated";
GRANT ALL ON TABLE "public"."GigPublic" TO "service_role";



GRANT ALL ON TABLE "public"."GigQuestion" TO "anon";
GRANT ALL ON TABLE "public"."GigQuestion" TO "authenticated";
GRANT ALL ON TABLE "public"."GigQuestion" TO "service_role";



GRANT ALL ON TABLE "public"."GigQuestionUpvote" TO "anon";
GRANT ALL ON TABLE "public"."GigQuestionUpvote" TO "authenticated";
GRANT ALL ON TABLE "public"."GigQuestionUpvote" TO "service_role";



GRANT ALL ON TABLE "public"."Home" TO "anon";
GRANT ALL ON TABLE "public"."Home" TO "authenticated";
GRANT ALL ON TABLE "public"."Home" TO "service_role";



GRANT ALL ON TABLE "public"."HomeAccessSecret" TO "anon";
GRANT ALL ON TABLE "public"."HomeAccessSecret" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeAccessSecret" TO "service_role";



GRANT ALL ON TABLE "public"."HomeAccessSecretValue" TO "anon";
GRANT ALL ON TABLE "public"."HomeAccessSecretValue" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeAccessSecretValue" TO "service_role";



GRANT ALL ON TABLE "public"."HomeAccess" TO "anon";
GRANT ALL ON TABLE "public"."HomeAccess" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeAccess" TO "service_role";



GRANT ALL ON TABLE "public"."AddressVerificationEvent" TO "service_role";



GRANT ALL ON TABLE "public"."HomeAddress" TO "anon";
GRANT ALL ON TABLE "public"."HomeAddress" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeAddress" TO "service_role";



GRANT ALL ON TABLE "public"."HomeAsset" TO "anon";
GRANT ALL ON TABLE "public"."HomeAsset" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeAsset" TO "service_role";



GRANT ALL ON TABLE "public"."HomeAuditLog" TO "anon";
GRANT ALL ON TABLE "public"."HomeAuditLog" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeAuditLog" TO "service_role";



GRANT ALL ON TABLE "public"."HomeBill" TO "anon";
GRANT ALL ON TABLE "public"."HomeBill" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeBill" TO "service_role";



GRANT ALL ON TABLE "public"."HomeBillSplit" TO "anon";
GRANT ALL ON TABLE "public"."HomeBillSplit" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeBillSplit" TO "service_role";



GRANT ALL ON TABLE "public"."HomeBusinessLink" TO "anon";
GRANT ALL ON TABLE "public"."HomeBusinessLink" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeBusinessLink" TO "service_role";



GRANT ALL ON TABLE "public"."HomeCalendarEvent" TO "anon";
GRANT ALL ON TABLE "public"."HomeCalendarEvent" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeCalendarEvent" TO "service_role";



GRANT ALL ON TABLE "public"."HomeDevice" TO "anon";
GRANT ALL ON TABLE "public"."HomeDevice" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeDevice" TO "service_role";



GRANT ALL ON TABLE "public"."HomeDocument" TO "anon";
GRANT ALL ON TABLE "public"."HomeDocument" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeDocument" TO "service_role";



GRANT ALL ON TABLE "public"."HomeEmergency" TO "anon";
GRANT ALL ON TABLE "public"."HomeEmergency" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeEmergency" TO "service_role";



GRANT ALL ON TABLE "public"."HomeEstateFields" TO "anon";
GRANT ALL ON TABLE "public"."HomeEstateFields" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeEstateFields" TO "service_role";



GRANT ALL ON TABLE "public"."HomeGuestPass" TO "anon";
GRANT ALL ON TABLE "public"."HomeGuestPass" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeGuestPass" TO "service_role";



GRANT ALL ON TABLE "public"."HomeInvite" TO "anon";
GRANT ALL ON TABLE "public"."HomeInvite" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeInvite" TO "service_role";



GRANT ALL ON TABLE "public"."HomeIssue" TO "anon";
GRANT ALL ON TABLE "public"."HomeIssue" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeIssue" TO "service_role";



GRANT ALL ON TABLE "public"."HomeIssueSensitive" TO "anon";
GRANT ALL ON TABLE "public"."HomeIssueSensitive" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeIssueSensitive" TO "service_role";



GRANT ALL ON TABLE "public"."HomeMaintenanceLog" TO "anon";
GRANT ALL ON TABLE "public"."HomeMaintenanceLog" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeMaintenanceLog" TO "service_role";



GRANT ALL ON TABLE "public"."HomeMaintenanceTemplate" TO "anon";
GRANT ALL ON TABLE "public"."HomeMaintenanceTemplate" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeMaintenanceTemplate" TO "service_role";



GRANT ALL ON TABLE "public"."HomeMapPin" TO "anon";
GRANT ALL ON TABLE "public"."HomeMapPin" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeMapPin" TO "service_role";



GRANT ALL ON TABLE "public"."HomeMedia" TO "anon";
GRANT ALL ON TABLE "public"."HomeMedia" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeMedia" TO "service_role";



GRANT ALL ON TABLE "public"."HomeOccupancy" TO "anon";
GRANT ALL ON TABLE "public"."HomeOccupancy" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeOccupancy" TO "service_role";



GRANT ALL ON TABLE "public"."HomeOwner" TO "anon";
GRANT ALL ON TABLE "public"."HomeOwner" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeOwner" TO "service_role";



GRANT ALL ON TABLE "public"."HomeOwnershipClaim" TO "anon";
GRANT ALL ON TABLE "public"."HomeOwnershipClaim" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeOwnershipClaim" TO "service_role";



GRANT ALL ON TABLE "public"."HomePackage" TO "anon";
GRANT ALL ON TABLE "public"."HomePackage" TO "authenticated";
GRANT ALL ON TABLE "public"."HomePackage" TO "service_role";



GRANT ALL ON TABLE "public"."HomePermissionOverride" TO "anon";
GRANT ALL ON TABLE "public"."HomePermissionOverride" TO "authenticated";
GRANT ALL ON TABLE "public"."HomePermissionOverride" TO "service_role";



GRANT ALL ON TABLE "public"."HomePostcardCode" TO "anon";
GRANT ALL ON TABLE "public"."HomePostcardCode" TO "authenticated";
GRANT ALL ON TABLE "public"."HomePostcardCode" TO "service_role";



GRANT ALL ON TABLE "public"."HomePreference" TO "anon";
GRANT ALL ON TABLE "public"."HomePreference" TO "authenticated";
GRANT ALL ON TABLE "public"."HomePreference" TO "service_role";



GRANT ALL ON TABLE "public"."HomePrivateData" TO "anon";
GRANT ALL ON TABLE "public"."HomePrivateData" TO "authenticated";
GRANT ALL ON TABLE "public"."HomePrivateData" TO "service_role";



GRANT ALL ON TABLE "public"."HomePublicData" TO "anon";
GRANT ALL ON TABLE "public"."HomePublicData" TO "authenticated";
GRANT ALL ON TABLE "public"."HomePublicData" TO "service_role";



GRANT ALL ON TABLE "public"."HomeQuorumAction" TO "anon";
GRANT ALL ON TABLE "public"."HomeQuorumAction" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeQuorumAction" TO "service_role";



GRANT ALL ON TABLE "public"."HomeQuorumVote" TO "anon";
GRANT ALL ON TABLE "public"."HomeQuorumVote" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeQuorumVote" TO "service_role";



GRANT ALL ON TABLE "public"."HomeReputation" TO "anon";
GRANT ALL ON TABLE "public"."HomeReputation" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeReputation" TO "service_role";



GRANT ALL ON TABLE "public"."HomeResidencyClaim" TO "anon";
GRANT ALL ON TABLE "public"."HomeResidencyClaim" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeResidencyClaim" TO "service_role";



GRANT ALL ON TABLE "public"."HomeRolePermission" TO "anon";
GRANT ALL ON TABLE "public"."HomeRolePermission" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeRolePermission" TO "service_role";



GRANT ALL ON TABLE "public"."HomeRolePreset" TO "anon";
GRANT ALL ON TABLE "public"."HomeRolePreset" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeRolePreset" TO "service_role";



GRANT ALL ON TABLE "public"."HomeRoleTemplateMeta" TO "anon";
GRANT ALL ON TABLE "public"."HomeRoleTemplateMeta" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeRoleTemplateMeta" TO "service_role";



GRANT ALL ON TABLE "public"."HomeRvStatus" TO "anon";
GRANT ALL ON TABLE "public"."HomeRvStatus" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeRvStatus" TO "service_role";



GRANT ALL ON TABLE "public"."HomeScopedGrant" TO "anon";
GRANT ALL ON TABLE "public"."HomeScopedGrant" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeScopedGrant" TO "service_role";



GRANT ALL ON TABLE "public"."HomeSubscription" TO "anon";
GRANT ALL ON TABLE "public"."HomeSubscription" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeSubscription" TO "service_role";



GRANT ALL ON TABLE "public"."HomeTask" TO "anon";
GRANT ALL ON TABLE "public"."HomeTask" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeTask" TO "service_role";



GRANT ALL ON TABLE "public"."HomeTaskMedia" TO "anon";
GRANT ALL ON TABLE "public"."HomeTaskMedia" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeTaskMedia" TO "service_role";



GRANT ALL ON TABLE "public"."HomeVendor" TO "anon";
GRANT ALL ON TABLE "public"."HomeVendor" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeVendor" TO "service_role";



GRANT ALL ON TABLE "public"."HomeVerification" TO "anon";
GRANT ALL ON TABLE "public"."HomeVerification" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeVerification" TO "service_role";



GRANT ALL ON TABLE "public"."HomeVerificationEvidence" TO "anon";
GRANT ALL ON TABLE "public"."HomeVerificationEvidence" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeVerificationEvidence" TO "service_role";



GRANT ALL ON TABLE "public"."Listing" TO "anon";
GRANT ALL ON TABLE "public"."Listing" TO "authenticated";
GRANT ALL ON TABLE "public"."Listing" TO "service_role";



GRANT ALL ON TABLE "public"."ListingMessage" TO "anon";
GRANT ALL ON TABLE "public"."ListingMessage" TO "authenticated";
GRANT ALL ON TABLE "public"."ListingMessage" TO "service_role";



GRANT ALL ON TABLE "public"."ListingQuestion" TO "anon";
GRANT ALL ON TABLE "public"."ListingQuestion" TO "authenticated";
GRANT ALL ON TABLE "public"."ListingQuestion" TO "service_role";



GRANT ALL ON TABLE "public"."ListingQuestionUpvote" TO "anon";
GRANT ALL ON TABLE "public"."ListingQuestionUpvote" TO "authenticated";
GRANT ALL ON TABLE "public"."ListingQuestionUpvote" TO "service_role";



GRANT ALL ON TABLE "public"."ListingReport" TO "anon";
GRANT ALL ON TABLE "public"."ListingReport" TO "authenticated";
GRANT ALL ON TABLE "public"."ListingReport" TO "service_role";



GRANT ALL ON TABLE "public"."ListingSave" TO "anon";
GRANT ALL ON TABLE "public"."ListingSave" TO "authenticated";
GRANT ALL ON TABLE "public"."ListingSave" TO "service_role";



GRANT ALL ON TABLE "public"."ListingView" TO "anon";
GRANT ALL ON TABLE "public"."ListingView" TO "authenticated";
GRANT ALL ON TABLE "public"."ListingView" TO "service_role";



GRANT ALL ON TABLE "public"."Mail" TO "anon";
GRANT ALL ON TABLE "public"."Mail" TO "authenticated";
GRANT ALL ON TABLE "public"."Mail" TO "service_role";



GRANT ALL ON TABLE "public"."MailAction" TO "anon";
GRANT ALL ON TABLE "public"."MailAction" TO "authenticated";
GRANT ALL ON TABLE "public"."MailAction" TO "service_role";



GRANT ALL ON TABLE "public"."MailAlias" TO "anon";
GRANT ALL ON TABLE "public"."MailAlias" TO "authenticated";
GRANT ALL ON TABLE "public"."MailAlias" TO "service_role";



GRANT ALL ON TABLE "public"."MailAnalyticsSummary" TO "anon";
GRANT ALL ON TABLE "public"."MailAnalyticsSummary" TO "authenticated";
GRANT ALL ON TABLE "public"."MailAnalyticsSummary" TO "service_role";



GRANT ALL ON TABLE "public"."MailAssetLink" TO "anon";
GRANT ALL ON TABLE "public"."MailAssetLink" TO "authenticated";
GRANT ALL ON TABLE "public"."MailAssetLink" TO "service_role";



GRANT ALL ON TABLE "public"."MailDaySettings" TO "anon";
GRANT ALL ON TABLE "public"."MailDaySettings" TO "authenticated";
GRANT ALL ON TABLE "public"."MailDaySettings" TO "service_role";



GRANT ALL ON TABLE "public"."MailEngagementEvent" TO "anon";
GRANT ALL ON TABLE "public"."MailEngagementEvent" TO "authenticated";
GRANT ALL ON TABLE "public"."MailEngagementEvent" TO "service_role";



GRANT ALL ON TABLE "public"."MailEvent" TO "anon";
GRANT ALL ON TABLE "public"."MailEvent" TO "authenticated";
GRANT ALL ON TABLE "public"."MailEvent" TO "service_role";



GRANT ALL ON TABLE "public"."MailLink" TO "anon";
GRANT ALL ON TABLE "public"."MailLink" TO "authenticated";
GRANT ALL ON TABLE "public"."MailLink" TO "service_role";



GRANT ALL ON TABLE "public"."MailMemory" TO "anon";
GRANT ALL ON TABLE "public"."MailMemory" TO "authenticated";
GRANT ALL ON TABLE "public"."MailMemory" TO "service_role";



GRANT ALL ON TABLE "public"."MailObject" TO "anon";
GRANT ALL ON TABLE "public"."MailObject" TO "authenticated";
GRANT ALL ON TABLE "public"."MailObject" TO "service_role";



GRANT ALL ON TABLE "public"."MailPackage" TO "anon";
GRANT ALL ON TABLE "public"."MailPackage" TO "authenticated";
GRANT ALL ON TABLE "public"."MailPackage" TO "service_role";



GRANT ALL ON TABLE "public"."MailPartyParticipant" TO "anon";
GRANT ALL ON TABLE "public"."MailPartyParticipant" TO "authenticated";
GRANT ALL ON TABLE "public"."MailPartyParticipant" TO "service_role";



GRANT ALL ON TABLE "public"."MailPartySession" TO "anon";
GRANT ALL ON TABLE "public"."MailPartySession" TO "authenticated";
GRANT ALL ON TABLE "public"."MailPartySession" TO "service_role";



GRANT ALL ON TABLE "public"."MailPreferences" TO "anon";
GRANT ALL ON TABLE "public"."MailPreferences" TO "authenticated";
GRANT ALL ON TABLE "public"."MailPreferences" TO "service_role";



GRANT ALL ON TABLE "public"."MailReadSession" TO "anon";
GRANT ALL ON TABLE "public"."MailReadSession" TO "authenticated";
GRANT ALL ON TABLE "public"."MailReadSession" TO "service_role";



GRANT ALL ON TABLE "public"."MailRoutingQueue" TO "anon";
GRANT ALL ON TABLE "public"."MailRoutingQueue" TO "authenticated";
GRANT ALL ON TABLE "public"."MailRoutingQueue" TO "service_role";



GRANT ALL ON TABLE "public"."MailboxSummary" TO "anon";
GRANT ALL ON TABLE "public"."MailboxSummary" TO "authenticated";
GRANT ALL ON TABLE "public"."MailboxSummary" TO "service_role";



GRANT ALL ON TABLE "public"."NeighborEndorsement" TO "anon";
GRANT ALL ON TABLE "public"."NeighborEndorsement" TO "authenticated";
GRANT ALL ON TABLE "public"."NeighborEndorsement" TO "service_role";



GRANT ALL ON TABLE "public"."Notification" TO "anon";
GRANT ALL ON TABLE "public"."Notification" TO "authenticated";
GRANT ALL ON TABLE "public"."Notification" TO "service_role";



GRANT ALL ON TABLE "public"."OfferRedemption" TO "anon";
GRANT ALL ON TABLE "public"."OfferRedemption" TO "authenticated";
GRANT ALL ON TABLE "public"."OfferRedemption" TO "service_role";



GRANT ALL ON TABLE "public"."PackageEvent" TO "anon";
GRANT ALL ON TABLE "public"."PackageEvent" TO "authenticated";
GRANT ALL ON TABLE "public"."PackageEvent" TO "service_role";



GRANT ALL ON TABLE "public"."PasswordResetToken" TO "anon";
GRANT ALL ON TABLE "public"."PasswordResetToken" TO "authenticated";
GRANT ALL ON TABLE "public"."PasswordResetToken" TO "service_role";



GRANT ALL ON TABLE "public"."Payment" TO "anon";
GRANT ALL ON TABLE "public"."Payment" TO "authenticated";
GRANT ALL ON TABLE "public"."Payment" TO "service_role";



GRANT ALL ON TABLE "public"."PaymentMethod" TO "anon";
GRANT ALL ON TABLE "public"."PaymentMethod" TO "authenticated";
GRANT ALL ON TABLE "public"."PaymentMethod" TO "service_role";



GRANT ALL ON TABLE "public"."Payout" TO "anon";
GRANT ALL ON TABLE "public"."Payout" TO "authenticated";
GRANT ALL ON TABLE "public"."Payout" TO "service_role";



GRANT ALL ON TABLE "public"."Post" TO "anon";
GRANT ALL ON TABLE "public"."Post" TO "authenticated";
GRANT ALL ON TABLE "public"."Post" TO "service_role";



GRANT ALL ON TABLE "public"."PostCategoryTTL" TO "anon";
GRANT ALL ON TABLE "public"."PostCategoryTTL" TO "authenticated";
GRANT ALL ON TABLE "public"."PostCategoryTTL" TO "service_role";



GRANT ALL ON TABLE "public"."PostComment" TO "anon";
GRANT ALL ON TABLE "public"."PostComment" TO "authenticated";
GRANT ALL ON TABLE "public"."PostComment" TO "service_role";



GRANT ALL ON TABLE "public"."PostHide" TO "anon";
GRANT ALL ON TABLE "public"."PostHide" TO "authenticated";
GRANT ALL ON TABLE "public"."PostHide" TO "service_role";



GRANT ALL ON TABLE "public"."PostLike" TO "anon";
GRANT ALL ON TABLE "public"."PostLike" TO "authenticated";
GRANT ALL ON TABLE "public"."PostLike" TO "service_role";



GRANT ALL ON TABLE "public"."PostMute" TO "anon";
GRANT ALL ON TABLE "public"."PostMute" TO "authenticated";
GRANT ALL ON TABLE "public"."PostMute" TO "service_role";



GRANT ALL ON TABLE "public"."PostReport" TO "anon";
GRANT ALL ON TABLE "public"."PostReport" TO "authenticated";
GRANT ALL ON TABLE "public"."PostReport" TO "service_role";



GRANT ALL ON TABLE "public"."PostSave" TO "anon";
GRANT ALL ON TABLE "public"."PostSave" TO "authenticated";
GRANT ALL ON TABLE "public"."PostSave" TO "service_role";



GRANT ALL ON TABLE "public"."PostShare" TO "anon";
GRANT ALL ON TABLE "public"."PostShare" TO "authenticated";
GRANT ALL ON TABLE "public"."PostShare" TO "service_role";


GRANT ALL ON TABLE "public"."PostView" TO "service_role";



GRANT ALL ON TABLE "public"."Refund" TO "anon";
GRANT ALL ON TABLE "public"."Refund" TO "authenticated";
GRANT ALL ON TABLE "public"."Refund" TO "service_role";



GRANT ALL ON TABLE "public"."Relationship" TO "anon";
GRANT ALL ON TABLE "public"."Relationship" TO "authenticated";
GRANT ALL ON TABLE "public"."Relationship" TO "service_role";



GRANT ALL ON TABLE "public"."RelationshipPermission" TO "anon";
GRANT ALL ON TABLE "public"."RelationshipPermission" TO "authenticated";
GRANT ALL ON TABLE "public"."RelationshipPermission" TO "service_role";



GRANT ALL ON TABLE "public"."Review" TO "anon";
GRANT ALL ON TABLE "public"."Review" TO "authenticated";
GRANT ALL ON TABLE "public"."Review" TO "service_role";



GRANT ALL ON TABLE "public"."SavedPlace" TO "anon";
GRANT ALL ON TABLE "public"."SavedPlace" TO "authenticated";
GRANT ALL ON TABLE "public"."SavedPlace" TO "service_role";



GRANT ALL ON TABLE "public"."SeasonalTheme" TO "anon";
GRANT ALL ON TABLE "public"."SeasonalTheme" TO "authenticated";
GRANT ALL ON TABLE "public"."SeasonalTheme" TO "service_role";



GRANT ALL ON TABLE "public"."Stamp" TO "anon";
GRANT ALL ON TABLE "public"."Stamp" TO "authenticated";
GRANT ALL ON TABLE "public"."Stamp" TO "service_role";



GRANT ALL ON TABLE "public"."StripeAccount" TO "anon";
GRANT ALL ON TABLE "public"."StripeAccount" TO "authenticated";
GRANT ALL ON TABLE "public"."StripeAccount" TO "service_role";



GRANT ALL ON TABLE "public"."StripeWebhookEvent" TO "anon";
GRANT ALL ON TABLE "public"."StripeWebhookEvent" TO "authenticated";
GRANT ALL ON TABLE "public"."StripeWebhookEvent" TO "service_role";



GRANT ALL ON TABLE "public"."Subscription" TO "anon";
GRANT ALL ON TABLE "public"."Subscription" TO "authenticated";
GRANT ALL ON TABLE "public"."Subscription" TO "service_role";



GRANT ALL ON TABLE "public"."SubscriptionPlan" TO "anon";
GRANT ALL ON TABLE "public"."SubscriptionPlan" TO "authenticated";
GRANT ALL ON TABLE "public"."SubscriptionPlan" TO "service_role";



GRANT ALL ON TABLE "public"."User" TO "anon";
GRANT ALL ON TABLE "public"."User" TO "authenticated";
GRANT ALL ON TABLE "public"."User" TO "service_role";



GRANT ALL ON TABLE "public"."UserCertification" TO "anon";
GRANT ALL ON TABLE "public"."UserCertification" TO "authenticated";
GRANT ALL ON TABLE "public"."UserCertification" TO "service_role";



GRANT ALL ON TABLE "public"."UserChatRooms" TO "anon";
GRANT ALL ON TABLE "public"."UserChatRooms" TO "authenticated";
GRANT ALL ON TABLE "public"."UserChatRooms" TO "service_role";



GRANT ALL ON TABLE "public"."UserExperience" TO "anon";
GRANT ALL ON TABLE "public"."UserExperience" TO "authenticated";
GRANT ALL ON TABLE "public"."UserExperience" TO "service_role";



GRANT ALL ON TABLE "public"."UserFeedPreference" TO "anon";
GRANT ALL ON TABLE "public"."UserFeedPreference" TO "authenticated";
GRANT ALL ON TABLE "public"."UserFeedPreference" TO "service_role";



GRANT ALL ON TABLE "public"."UserFollow" TO "anon";
GRANT ALL ON TABLE "public"."UserFollow" TO "authenticated";
GRANT ALL ON TABLE "public"."UserFollow" TO "service_role";



GRANT ALL ON TABLE "public"."UserPaymentSummary" TO "anon";
GRANT ALL ON TABLE "public"."UserPaymentSummary" TO "authenticated";
GRANT ALL ON TABLE "public"."UserPaymentSummary" TO "service_role";



GRANT ALL ON TABLE "public"."UserPlace" TO "anon";
GRANT ALL ON TABLE "public"."UserPlace" TO "authenticated";
GRANT ALL ON TABLE "public"."UserPlace" TO "service_role";



GRANT ALL ON TABLE "public"."UserPortfolio" TO "anon";
GRANT ALL ON TABLE "public"."UserPortfolio" TO "authenticated";
GRANT ALL ON TABLE "public"."UserPortfolio" TO "service_role";



GRANT ALL ON TABLE "public"."UserProfessionalProfile" TO "anon";
GRANT ALL ON TABLE "public"."UserProfessionalProfile" TO "authenticated";
GRANT ALL ON TABLE "public"."UserProfessionalProfile" TO "service_role";



GRANT ALL ON TABLE "public"."UserPublicProfile" TO "anon";
GRANT ALL ON TABLE "public"."UserPublicProfile" TO "authenticated";
GRANT ALL ON TABLE "public"."UserPublicProfile" TO "service_role";



GRANT ALL ON TABLE "public"."UserRecentLocation" TO "anon";
GRANT ALL ON TABLE "public"."UserRecentLocation" TO "authenticated";
GRANT ALL ON TABLE "public"."UserRecentLocation" TO "service_role";



GRANT ALL ON TABLE "public"."UserSkill" TO "anon";
GRANT ALL ON TABLE "public"."UserSkill" TO "authenticated";
GRANT ALL ON TABLE "public"."UserSkill" TO "service_role";



GRANT ALL ON TABLE "public"."UserViewingLocation" TO "anon";
GRANT ALL ON TABLE "public"."UserViewingLocation" TO "authenticated";
GRANT ALL ON TABLE "public"."UserViewingLocation" TO "service_role";



GRANT ALL ON TABLE "public"."VacationHold" TO "anon";
GRANT ALL ON TABLE "public"."VacationHold" TO "authenticated";
GRANT ALL ON TABLE "public"."VacationHold" TO "service_role";



GRANT ALL ON TABLE "public"."VaultFolder" TO "anon";
GRANT ALL ON TABLE "public"."VaultFolder" TO "authenticated";
GRANT ALL ON TABLE "public"."VaultFolder" TO "service_role";



GRANT ALL ON TABLE "public"."VerificationToken" TO "anon";
GRANT ALL ON TABLE "public"."VerificationToken" TO "authenticated";
GRANT ALL ON TABLE "public"."VerificationToken" TO "service_role";



GRANT ALL ON TABLE "public"."YearInMail" TO "anon";
GRANT ALL ON TABLE "public"."YearInMail" TO "authenticated";
GRANT ALL ON TABLE "public"."YearInMail" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
