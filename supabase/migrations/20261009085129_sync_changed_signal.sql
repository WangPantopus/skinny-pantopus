-- Backwards compatible: yes. Adds one trigger function and AFTER triggers that
-- send a Postgres NOTIFY on channel sync_changed when household, chat,
-- notification, profile and Support Train rows change. No table, column, row,
-- policy or existing trigger changes; nothing reads the notifications except
-- the API process (services/syncChangedService.js), which turns them into the
-- `sync:changed` socket event (Instant Screens contract §8). Writes from the
-- API, the worker, SQL functions and the Lambdas are all covered.
--
-- A payload carries only the table name and row keys (ids), never content:
--   {"t":"HomeTask","h":"<home id>"}
-- Keys: h = home id, u = user id, r = chat room id, s = Support Train id,
-- p = saved place id, st = address calendar scope type. Identical payloads in
-- one transaction reach listeners once, so a bulk statement sends one per key.
SET LOCAL lock_timeout='5s';

-- Arguments name the payload keys as key=column, for example 'h=home_id'.
-- An UPDATE sends the old and the new row's keys (one payload when unchanged).
CREATE FUNCTION public.notify_sync_changed() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE
  v_rows jsonb[] := ARRAY[]::jsonb[];
  v_row jsonb;
  v_payload jsonb;
  v_arg text;
BEGIN
  IF TG_OP<>'INSERT' THEN v_rows := v_rows || to_jsonb(OLD); END IF;
  IF TG_OP<>'DELETE' THEN v_rows := v_rows || to_jsonb(NEW); END IF;
  FOREACH v_row IN ARRAY v_rows LOOP
    v_payload := jsonb_build_object('t', TG_TABLE_NAME);
    FOREACH v_arg IN ARRAY TG_ARGV LOOP
      IF v_row ->> split_part(v_arg, '=', 2) IS NOT NULL THEN
        v_payload := v_payload || jsonb_build_object(split_part(v_arg, '=', 1), v_row ->> split_part(v_arg, '=', 2));
      END IF;
    END LOOP;
    PERFORM pg_notify('sync_changed', v_payload::text);
  END LOOP;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.notify_sync_changed() FROM PUBLIC,anon,authenticated;
COMMENT ON FUNCTION public.notify_sync_changed() IS
  'Instant Screens change signal: NOTIFY sync_changed with the table name and row ids only. Read by the API process.';

-- Household: tasks, membership, ownership and claims, invitations and requests,
-- the home record, household calendar rows, access codes, emergency info,
-- documents, issues and guest passes.
CREATE TRIGGER sync_changed AFTER INSERT OR UPDATE OR DELETE ON public."HomeTask"
  FOR EACH ROW EXECUTE FUNCTION public.notify_sync_changed('h=home_id');
CREATE TRIGGER sync_changed AFTER INSERT OR DELETE ON public."HomeOccupancy"
  FOR EACH ROW EXECUTE FUNCTION public.notify_sync_changed('h=home_id', 'u=user_id');
-- membership_version changes only on a material membership change (home_membership_version).
CREATE TRIGGER sync_changed_update AFTER UPDATE ON public."HomeOccupancy"
  FOR EACH ROW WHEN (OLD.membership_version IS DISTINCT FROM NEW.membership_version)
  EXECUTE FUNCTION public.notify_sync_changed('h=home_id', 'u=user_id');
CREATE TRIGGER sync_changed AFTER INSERT OR UPDATE OR DELETE ON public."HomeOwner"
  FOR EACH ROW EXECUTE FUNCTION public.notify_sync_changed('h=home_id', 'u=subject_id');
CREATE TRIGGER sync_changed AFTER INSERT OR UPDATE OR DELETE ON public."HomeOwnershipClaim"
  FOR EACH ROW EXECUTE FUNCTION public.notify_sync_changed('h=home_id', 'u=claimant_user_id');
CREATE TRIGGER sync_changed AFTER INSERT OR UPDATE OR DELETE ON public."HomeResidencyClaim"
  FOR EACH ROW EXECUTE FUNCTION public.notify_sync_changed('h=home_id', 'u=user_id');
CREATE TRIGGER sync_changed AFTER INSERT OR UPDATE OR DELETE ON public."HomeInvite"
  FOR EACH ROW EXECUTE FUNCTION public.notify_sync_changed('h=home_id', 'u=invitee_user_id');
CREATE TRIGGER sync_changed AFTER INSERT OR UPDATE OR DELETE ON public."HomeHouseholdAccessRequest"
  FOR EACH ROW EXECUTE FUNCTION public.notify_sync_changed('h=home_id', 'u=requester_user_id');
-- Bookkeeping columns alone don't signal.
CREATE TRIGGER sync_changed AFTER UPDATE ON public."Home"
  FOR EACH ROW WHEN ((to_jsonb(OLD) - ARRAY['updated_at','household_resolution_updated_at'])
    IS DISTINCT FROM (to_jsonb(NEW) - ARRAY['updated_at','household_resolution_updated_at']))
  EXECUTE FUNCTION public.notify_sync_changed('h=id');
CREATE TRIGGER sync_changed AFTER INSERT OR UPDATE OR DELETE ON public."AddressCalendarRule"
  FOR EACH ROW EXECUTE FUNCTION public.notify_sync_changed('st=scope_type', 'h=scope_key');
CREATE TRIGGER sync_changed AFTER INSERT OR UPDATE OR DELETE ON public."HomeAccessSecret"
  FOR EACH ROW EXECUTE FUNCTION public.notify_sync_changed('h=home_id');
CREATE TRIGGER sync_changed AFTER INSERT OR UPDATE OR DELETE ON public."HomeEmergency"
  FOR EACH ROW EXECUTE FUNCTION public.notify_sync_changed('h=home_id');
CREATE TRIGGER sync_changed AFTER INSERT OR UPDATE OR DELETE ON public."HomeDocument"
  FOR EACH ROW EXECUTE FUNCTION public.notify_sync_changed('h=home_id');
CREATE TRIGGER sync_changed AFTER INSERT OR UPDATE OR DELETE ON public."HomeIssue"
  FOR EACH ROW EXECUTE FUNCTION public.notify_sync_changed('h=home_id');
CREATE TRIGGER sync_changed AFTER INSERT OR DELETE ON public."HomeGuestPass"
  FOR EACH ROW EXECUTE FUNCTION public.notify_sync_changed('h=home_id');
-- A guest opening a pass counts a view; only the pass itself signals.
CREATE TRIGGER sync_changed_update AFTER UPDATE ON public."HomeGuestPass"
  FOR EACH ROW WHEN ((to_jsonb(OLD) - ARRAY['view_count','updated_at'])
    IS DISTINCT FROM (to_jsonb(NEW) - ARRAY['view_count','updated_at']))
  EXECUTE FUNCTION public.notify_sync_changed('h=home_id');

-- Places saved by one person.
CREATE TRIGGER sync_changed AFTER INSERT OR UPDATE OR DELETE ON public."SavedPlace"
  FOR EACH ROW EXECUTE FUNCTION public.notify_sync_changed('u=user_id', 'p=id');

-- Chats: membership (join, leave) carries the person; unread counts and read
-- marks carry only the room, so a message's per-member unread bumps collapse.
CREATE TRIGGER sync_changed AFTER INSERT OR DELETE ON public."ChatParticipant"
  FOR EACH ROW EXECUTE FUNCTION public.notify_sync_changed('r=room_id', 'u=user_id');
CREATE TRIGGER sync_changed_membership AFTER UPDATE ON public."ChatParticipant"
  FOR EACH ROW WHEN (OLD.is_active IS DISTINCT FROM NEW.is_active OR OLD.room_id IS DISTINCT FROM NEW.room_id
    OR OLD.user_id IS DISTINCT FROM NEW.user_id)
  EXECUTE FUNCTION public.notify_sync_changed('r=room_id', 'u=user_id');
CREATE TRIGGER sync_changed_read AFTER UPDATE ON public."ChatParticipant"
  FOR EACH ROW WHEN (OLD.unread_count IS DISTINCT FROM NEW.unread_count OR OLD.last_read_at IS DISTINCT FROM NEW.last_read_at
    OR OLD.notifications_enabled IS DISTINCT FROM NEW.notifications_enabled)
  EXECUTE FUNCTION public.notify_sync_changed('r=room_id');
CREATE TRIGGER sync_changed AFTER INSERT OR UPDATE OR DELETE ON public."ChatMessage"
  FOR EACH ROW EXECUTE FUNCTION public.notify_sync_changed('r=room_id');

-- Notifications (created, read, removed).
CREATE TRIGGER sync_changed AFTER INSERT OR UPDATE OR DELETE ON public."Notification"
  FOR EACH ROW EXECUTE FUNCTION public.notify_sync_changed('u=user_id');

-- Own profile and settings. Counters, streaks and session bookkeeping don't signal.
CREATE TRIGGER sync_changed AFTER UPDATE ON public."User"
  FOR EACH ROW WHEN ((to_jsonb(OLD) - ARRAY['updated_at','sessions_valid_after','streak_days','streak_last_date',
      'magic_task_post_count','stripe_customer_id','earn_suspended_until'])
    IS DISTINCT FROM (to_jsonb(NEW) - ARRAY['updated_at','sessions_valid_after','streak_days','streak_last_date',
      'magic_task_post_count','stripe_customer_id','earn_suspended_until']))
  EXECUTE FUNCTION public.notify_sync_changed('u=id');
CREATE TRIGGER sync_changed AFTER INSERT OR UPDATE ON public."UserNotificationPreferences"
  FOR EACH ROW EXECUTE FUNCTION public.notify_sync_changed('u=user_id');
CREATE TRIGGER sync_changed AFTER INSERT OR UPDATE ON public."UserPrivacySettings"
  FOR EACH ROW EXECUTE FUNCTION public.notify_sync_changed('u=user_id');
CREATE TRIGGER sync_changed AFTER INSERT OR UPDATE ON public."MailPreferences"
  FOR EACH ROW EXECUTE FUNCTION public.notify_sync_changed('u=user_id');

-- Support Trains: the train, its slots, sign-ups and organizers.
CREATE TRIGGER sync_changed AFTER UPDATE ON public."SupportTrain"
  FOR EACH ROW EXECUTE FUNCTION public.notify_sync_changed('s=id');
CREATE TRIGGER sync_changed AFTER INSERT OR UPDATE OR DELETE ON public."SupportTrainSlot"
  FOR EACH ROW EXECUTE FUNCTION public.notify_sync_changed('s=support_train_id');
CREATE TRIGGER sync_changed AFTER INSERT OR UPDATE OR DELETE ON public."SupportTrainReservation"
  FOR EACH ROW EXECUTE FUNCTION public.notify_sync_changed('s=support_train_id', 'u=user_id');
CREATE TRIGGER sync_changed AFTER INSERT OR UPDATE OR DELETE ON public."SupportTrainOrganizer"
  FOR EACH ROW EXECUTE FUNCTION public.notify_sync_changed('s=support_train_id', 'u=user_id');
