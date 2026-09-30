-- Backwards compatible: yes. Makes HomeTaskMedia.uploaded_by nullable with ON DELETE SET NULL;
-- lets the task-attachment guards accept an owner cleared to NULL on update (inserts stay
-- strict); lets a task-attachment file be owned by the household; adds two User BEFORE
-- DELETE triggers and one service-only function. No rows change when applied. The deployed
-- backend never calls the function and never writes NULL to these columns. Deploy order does
-- not matter.
--
-- Account deletion and a member's Home data, three parts:
--
-- 1. Task attachments stay with the household (this was an account-deletion blocker).
--    A member who had ever attached a file to a Home task could not delete their account:
--    File.user_id is ON DELETE CASCADE and protect_home_task_media_file refuses deleting
--    home_task_media_v1 files, live or retired ("File tombstones must be retained"), so
--    account_deletion_dry_run returned 23514 and DELETE /api/users/account answered 409.
--    HomeTaskMedia.uploaded_by also cascaded, which silently removed the attachment from the
--    household's task and left its upload `ready`, a state the storage recovery job never
--    collects. Now, like Home documents since 20260930153000, the member's task-attachment
--    files are released to the household before the delete, and the task keeps them.
--
-- 2. Personal map pins go with the account. A pin marked visible_to 'personal' is shown
--    only to its creator; kept with no author it would be visible to nobody, so it is the
--    person's own data retained after their account is gone. Household, neighborhood and
--    public pins stay without an author. DELETE /api/users/account never nulls
--    HomeMapPin.created_by itself (its foreign key does, after this trigger), so the
--    trigger still sees the author, and account_deletion_dry_run replays it.
--
-- 3. purge_home_household_records(home, departing user), for coordinator decision 9: when
--    the person deleting their account is the last member of a Home that delete-my-Home
--    refuses, the Home shell stays but its household records go, so a later resident who
--    claims or joins it can never read them. homeAuthorityService.retireHomeForDeletedAccount
--    (Stream 3) decides and calls it through homeRecordService.purgeHouseholdRecords. It
--    refuses (HOME_PURGE_HOUSEHOLD_PRESENT) while anyone else has access or a verified
--    ownership, so it can never empty a live household. It removes the household's tasks
--    (attachments retired as the product's own delete does), events, bills, documents (files
--    tombstoned as the document delete path does), assets, devices, vendors, subscriptions,
--    maintenance, packages, emergency info, issues, checklist, systems and notes, resources,
--    media, pets, polls, fridge cards, access codes and Wi-Fi, guest passes and scoped
--    grants, pending invitations it sent, household map pins, household mail (exactly the
--    letters a new member could open under homeMailAccess), mail aliases and routing,
--    household chat rooms, activity log, permission overrides, private data, quorum actions,
--    business links, and the household text on the Home row (entry, parking, house rules,
--    tips, welcome message, description, move-in date, photos, Wi-Fi QR and rules files).
--    It keeps the Home row's property facts, other people's claims, requests, leases and
--    verifications, public data and caches, and financial, gig and community records. The
--    storage recovery jobs (every 5 minutes) remove the tombstoned bytes.
SET LOCAL lock_timeout='5s';

-- 1. Task attachments stay with the household.
ALTER TABLE public."HomeTaskMedia" ALTER COLUMN uploaded_by DROP NOT NULL;
ALTER TABLE public."HomeTaskMedia" DROP CONSTRAINT "HomeTaskMedia_uploaded_by_fkey";
ALTER TABLE public."HomeTaskMedia" ADD CONSTRAINT "HomeTaskMedia_uploaded_by_fkey"
  FOREIGN KEY (uploaded_by) REFERENCES public."User"(id) ON DELETE SET NULL;

-- The attachment's uploader may be cleared (account deletion), never changed; a new
-- attachment must still name its uploader.
CREATE OR REPLACE FUNCTION public.protect_home_task_media_record()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE i public."HomeTaskMediaIntent"%ROWTYPE;
BEGIN
  IF TG_OP='UPDATE' AND OLD.private_upload_id IS NOT NULL AND NEW.private_upload_id IS DISTINCT FROM OLD.private_upload_id THEN
    RAISE EXCEPTION 'Task media binding is immutable' USING ERRCODE='23514'; END IF;
  IF NEW.private_upload_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO i FROM public."HomeTaskMediaIntent" WHERE id=NEW.private_upload_id FOR SHARE;
  IF NOT FOUND OR i.state<>'ready' OR NEW.id<>i.id OR NEW.home_id<>i.original_home_id OR NEW.task_id<>i.original_task_id
    OR (NEW.uploaded_by IS DISTINCT FROM i.uploaded_by AND NOT (TG_OP='UPDATE' AND NEW.uploaded_by IS NULL))
    OR NEW.file_url<>'' OR NEW.file_key<>'' OR NEW.thumbnail_url IS NOT NULL
    OR NEW.file_name IS DISTINCT FROM i.file_name OR NEW.mime_type IS DISTINCT FROM i.mime_type
    OR NEW.file_size IS DISTINCT FROM i.file_size THEN
    RAISE EXCEPTION 'Invalid private task attachment binding' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $function$;

-- The attachment file's owner may be cleared (account deletion), never changed; a new
-- attachment file must still be owned by its uploader.
CREATE OR REPLACE FUNCTION public.protect_home_task_media_file()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE i public."HomeTaskMediaIntent"%ROWTYPE;
BEGIN
  IF TG_OP<>'INSERT' AND OLD.metadata->>'storage_contract'='home_task_media_v1' THEN
    IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Task upload File tombstones must be retained' USING ERRCODE='23514'; END IF;
    IF NEW.metadata->>'storage_contract' IS DISTINCT FROM 'home_task_media_v1' THEN
      RAISE EXCEPTION 'Task upload storage identity is immutable' USING ERRCODE='23514'; END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF NEW.metadata->>'storage_contract' IS DISTINCT FROM 'home_task_media_v1' THEN RETURN NEW; END IF;
  SELECT * INTO i FROM public."HomeTaskMediaIntent" WHERE id=NEW.id FOR SHARE;
  IF NOT FOUND OR (NEW.user_id IS DISTINCT FROM i.uploaded_by AND NOT (TG_OP='UPDATE' AND NEW.user_id IS NULL))
    OR NEW.home_id IS DISTINCT FROM i.home_id
    OR NEW.file_path IS DISTINCT FROM public.home_task_media_key(i) OR NEW.file_url<>''
    OR NEW.original_filename IS DISTINCT FROM i.file_name OR NEW.filename IS DISTINCT FROM i.file_name
    OR NEW.file_size IS DISTINCT FROM i.file_size OR NEW.mime_type IS DISTINCT FROM i.mime_type
    OR NEW.file_type IS DISTINCT FROM 'other' OR NEW.visibility IS DISTINCT FROM 'private'
    OR NEW.metadata IS DISTINCT FROM jsonb_build_object('storage_contract','home_task_media_v1','upload_id',i.id)
    OR NEW.is_deleted IS DISTINCT FROM (i.state='retired') OR NEW.post_id IS NOT NULL OR NEW.gig_id IS NOT NULL
    OR NEW.comment_id IS NOT NULL OR NEW.profile_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid private task File binding' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $function$;

-- Home document and task-attachment files may be owned by the household (no user) once
-- their uploader deleted their account; lease evidence and gig-completion files keep
-- their rule.
ALTER TABLE public."File" DROP CONSTRAINT file_owner_or_retired_private_evidence;
ALTER TABLE public."File" ADD CONSTRAINT file_owner_or_retired_private_evidence CHECK (
  user_id IS NOT NULL
  OR coalesce(is_deleted AND metadata->>'storage_contract' = ANY (ARRAY['home_lease_evidence_v1', 'gig_completion_v1']), false)
  OR coalesce(metadata->>'storage_contract' = ANY (ARRAY['home_document_v1', 'home_task_media_v1']), false));

-- A member's task-attachment files (live or retired) belong to the household: when the
-- member's account is deleted they lose the owner link instead of being cascaded into the
-- tombstone guard.
CREATE FUNCTION public.retire_home_task_media_owner()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public."File" SET user_id = NULL, updated_at = clock_timestamp()
   WHERE user_id = OLD.id AND metadata->>'storage_contract' = 'home_task_media_v1';
  RETURN OLD;
END $function$;

REVOKE ALL ON FUNCTION public.retire_home_task_media_owner() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER retire_home_task_media_owner BEFORE DELETE ON public."User"
  FOR EACH ROW EXECUTE FUNCTION public.retire_home_task_media_owner();

-- 2. Personal map pins go with the account.
CREATE FUNCTION public.delete_personal_home_map_pins()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  DELETE FROM public."HomeMapPin" WHERE created_by = OLD.id AND visible_to = 'personal';
  RETURN OLD;
END $function$;

REVOKE ALL ON FUNCTION public.delete_personal_home_map_pins() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER delete_personal_home_map_pins BEFORE DELETE ON public."User"
  FOR EACH ROW EXECUTE FUNCTION public.delete_personal_home_map_pins();

-- 3. A departing last member's household records, for a Home shell that stays.
CREATE FUNCTION public.purge_home_household_records(p_home_id uuid, p_departing_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
 SET lock_timeout TO '5s'
AS $function$
DECLARE v jsonb := '{}'::jsonb; n bigint; i public."HomeTaskMediaIntent"%ROWTYPE;
BEGIN
  IF p_home_id IS NULL OR p_departing_user_id IS NULL THEN
    RETURN '{"ok":false,"code":"HOME_PURGE_INVALID","status":400}'::jsonb; END IF;
  PERFORM 1 FROM public."Home" WHERE id = p_home_id FOR UPDATE;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"HOME_NOT_FOUND","status":404}'::jsonb; END IF;
  -- Only for the last member leaving: nobody else may still hold access or ownership.
  IF EXISTS (SELECT FROM public."HomeOccupancy" o WHERE o.home_id = p_home_id AND o.user_id <> p_departing_user_id
      AND coalesce((public.home_effective_access(p_home_id, o.user_id)->>'has_access')::boolean, false))
    OR EXISTS (SELECT FROM public."HomeOwner" w WHERE w.home_id = p_home_id AND w.owner_status = 'verified'
      AND NOT (w.subject_type = 'user' AND w.subject_id = p_departing_user_id)) THEN
    RETURN '{"ok":false,"code":"HOME_PURGE_HOUSEHOLD_PRESENT","status":409}'::jsonb;
  END IF;

  -- Task attachments: retired exactly as mutate_home_task_media('retire') does, so the
  -- task-media recovery job removes the bytes.
  n := 0;
  FOR i IN SELECT * FROM public."HomeTaskMediaIntent" WHERE original_home_id = p_home_id AND state <> 'retired'
    ORDER BY id FOR UPDATE LOOP
    UPDATE public."HomeTaskMediaIntent" SET state='retired', retired_at=clock_timestamp(), updated_at=clock_timestamp(),
      cleanup_pending=true, cleanup_claim=gen_random_uuid() WHERE id=i.id;
    DELETE FROM public."HomeTaskMedia" WHERE private_upload_id=i.id AND id=i.id;
    UPDATE public."File" SET is_deleted=true, deleted_at=clock_timestamp(), updated_at=clock_timestamp() WHERE id=i.file_id;
    UPDATE public."FileQuota" SET storage_used=greatest(storage_used-i.file_size,0), file_count=greatest(file_count-1,0),
      updated_at=clock_timestamp() WHERE user_id=i.uploaded_by;
    n := n + 1;
  END LOOP;
  v := v || jsonb_build_object('task_attachments_retired', n);

  -- Documents: every file tombstoned as delete_home_document_file does, so the document
  -- recovery job removes the bytes; then the records.
  UPDATE public."FileQuota" q SET storage_used=greatest(q.storage_used-s.bytes,0), file_count=greatest(q.file_count-s.files,0),
      updated_at=clock_timestamp()
    FROM (SELECT user_id, sum(file_size) bytes, count(*) files FROM public."File" WHERE home_id = p_home_id
      AND metadata->>'storage_contract' = 'home_document_v1' AND NOT is_deleted AND user_id IS NOT NULL GROUP BY user_id) s
    WHERE q.user_id = s.user_id;
  UPDATE public."File" f SET is_deleted=true, deleted_at=coalesce(f.deleted_at, clock_timestamp()), updated_at=clock_timestamp(),
      metadata = coalesce(f.metadata,'{}'::jsonb) || jsonb_build_object('deleted_document_visibility',
        (SELECT d.visibility FROM public."HomeDocument" d WHERE d.file_id = f.id), 'document_purged_for_departing_member', true,
        'storage_cleanup_pending', true)
    WHERE f.home_id = p_home_id AND f.metadata->>'storage_contract' = 'home_document_v1' AND NOT f.is_deleted;
  GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('document_files_tombstoned', n);

  -- Legacy media files attached to the Home (gallery, Wi-Fi QR, house rules): tombstoned.
  UPDATE public."File" f SET is_deleted=true, deleted_at=coalesce(f.deleted_at, clock_timestamp()), updated_at=clock_timestamp()
    WHERE NOT f.is_deleted AND (f.id IN (SELECT file_id FROM public."HomeMedia" WHERE home_id = p_home_id)
      OR f.id IN (SELECT unnest(ARRAY[h.wifi_qr_file_id, h.house_rules_file_id]) FROM public."Home" h WHERE h.id = p_home_id));
  GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('legacy_media_files_tombstoned', n);

  -- Household records.
  DELETE FROM public."HomeTaskMedia" WHERE home_id = p_home_id; GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('HomeTaskMedia', n);
  DELETE FROM public."HomeTaskAssignmentDelivery" WHERE home_id = p_home_id; GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('HomeTaskAssignmentDelivery', n);
  DELETE FROM public."HomeTaskCreateReceipt" WHERE home_id = p_home_id; GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('HomeTaskCreateReceipt', n);
  DELETE FROM public."HomeTaskRecurrenceCommand" WHERE home_id = p_home_id; GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('HomeTaskRecurrenceCommand', n);
  DELETE FROM public."HomeTaskRecurrence" WHERE home_id = p_home_id; GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('HomeTaskRecurrence', n);
  DELETE FROM public."HomeTask" WHERE home_id = p_home_id; GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('HomeTask', n);
  DELETE FROM public."HomeCalendarEvent" WHERE home_id = p_home_id; GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('HomeCalendarEvent', n);
  DELETE FROM public."HomeBill" WHERE home_id = p_home_id; GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('HomeBill', n);
  DELETE FROM public."HomeDocument" WHERE home_id = p_home_id; GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('HomeDocument', n);
  DELETE FROM public."HomeMaintenanceLog" WHERE home_id = p_home_id; GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('HomeMaintenanceLog', n);
  DELETE FROM public."HomeMaintenanceTemplate" WHERE home_id = p_home_id; GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('HomeMaintenanceTemplate', n);
  DELETE FROM public."HomeAsset" WHERE home_id = p_home_id; GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('HomeAsset', n);
  DELETE FROM public."HomeDevice" WHERE home_id = p_home_id; GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('HomeDevice', n);
  DELETE FROM public."HomeVendor" WHERE home_id = p_home_id; GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('HomeVendor', n);
  DELETE FROM public."HomeSubscription" WHERE home_id = p_home_id; GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('HomeSubscription', n);
  DELETE FROM public."HomePackage" WHERE home_id = p_home_id; GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('HomePackage', n);
  DELETE FROM public."HomeEmergency" WHERE home_id = p_home_id; GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('HomeEmergency', n);
  DELETE FROM public."HomeIssue" WHERE home_id = p_home_id; GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('HomeIssue', n);
  DELETE FROM public."HomeSeasonalChecklistItem" WHERE home_id = p_home_id; GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('HomeSeasonalChecklistItem', n);
  DELETE FROM public."HomeSystem" WHERE home_id = p_home_id; GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('HomeSystem', n);
  DELETE FROM public."HomeEstateFields" WHERE home_id = p_home_id; GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('HomeEstateFields', n);
  DELETE FROM public."HomeRvStatus" WHERE home_id = p_home_id; GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('HomeRvStatus', n);
  DELETE FROM public."HomeResource" WHERE home_id = p_home_id; GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('HomeResource', n);
  DELETE FROM public."HomeMedia" WHERE home_id = p_home_id; GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('HomeMedia', n);
  DELETE FROM public."HomePet" WHERE home_id = p_home_id; GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('HomePet', n);
  DELETE FROM public."HomePoll" WHERE home_id = p_home_id; GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('HomePoll', n);
  DELETE FROM public."FridgeCard" WHERE home_id = p_home_id; GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('FridgeCard', n);
  DELETE FROM public."HomeAccessSecret" WHERE home_id = p_home_id; GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('HomeAccessSecret', n);
  DELETE FROM public."HomeGuestPass" WHERE home_id = p_home_id; GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('HomeGuestPass', n);
  DELETE FROM public."HomeScopedGrant" WHERE home_id = p_home_id; GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('HomeScopedGrant', n);
  DELETE FROM public."HomeShareReadReceipt" WHERE home_id = p_home_id; GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('HomeShareReadReceipt', n);
  DELETE FROM public."HomeInvite" WHERE home_id = p_home_id AND status = 'pending'; GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('HomeInvite_pending', n);
  DELETE FROM public."HomeMapPin" WHERE home_id = p_home_id AND visible_to = 'household'; GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('HomeMapPin_household', n);
  -- The letters homeMailAccess lets any member of this Home open (no personal recipient,
  -- household visibility), and the departing member's own letters here. Letters for
  -- other people stay theirs.
  DELETE FROM public."Mail" m WHERE m.recipient_home_id = p_home_id
    AND (((m.delivery_target_type IS NULL OR (m.delivery_target_type = 'home' AND m.delivery_target_id = p_home_id))
        AND (m.recipient_type IS NULL OR (m.recipient_type = 'home' AND m.recipient_id = p_home_id))
        AND m.recipient_user_id IS NULL
        AND coalesce(m.delivery_visibility, 'home_members') = 'home_members'
        AND m.privacy IN ('shared_household', 'business_team', 'private_to_person'))
      OR m.recipient_user_id = p_departing_user_id OR m.attn_user_id = p_departing_user_id);
  GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('Mail_household', n);
  DELETE FROM public."MailAlias" WHERE home_id = p_home_id; GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('MailAlias', n);
  DELETE FROM public."MailRoutingQueue" WHERE home_id = p_home_id; GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('MailRoutingQueue', n);
  DELETE FROM public."MailPartySession" WHERE home_id = p_home_id; GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('MailPartySession', n);
  DELETE FROM public."ChatRoom" WHERE home_id = p_home_id AND type = 'home';
  GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('ChatRoom_household', n);
  DELETE FROM public."HomeAuditLog" WHERE home_id = p_home_id; GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('HomeAuditLog', n);
  DELETE FROM public."HomePermissionOverride" WHERE home_id = p_home_id; GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('HomePermissionOverride', n);
  DELETE FROM public."HomePrivateData" WHERE home_id = p_home_id; GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('HomePrivateData', n);
  DELETE FROM public."HomeQuorumAction" WHERE home_id = p_home_id; GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('HomeQuorumAction', n);
  DELETE FROM public."HomeBusinessLink" WHERE home_id = p_home_id; GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('HomeBusinessLink', n);
  -- The household's text and pictures on the Home row; property facts stay.
  UPDATE public."Home" SET entry_instructions=NULL, parking_instructions=NULL, house_rules=NULL, local_tips=NULL,
    guest_welcome_message=NULL, description=NULL, move_in_date=NULL, primary_photo_url=NULL, cover_photo_url=NULL,
    photo_gallery_ids='{}'::uuid[], wifi_qr_file_id=NULL, house_rules_file_id=NULL, updated_at=now()
    WHERE id = p_home_id;
  RETURN jsonb_build_object('ok', true, 'home_id', p_home_id, 'purged', v);
END $function$;

REVOKE ALL ON FUNCTION public.purge_home_household_records(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_home_household_records(uuid, uuid) TO service_role;
