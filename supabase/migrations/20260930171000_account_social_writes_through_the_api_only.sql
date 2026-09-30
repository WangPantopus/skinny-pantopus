-- Backwards compatible: yes. Drops row-level-security policies only; no table,
-- column, function or row changes. The backend writes every row of these
-- tables as service_role, which bypasses row-level security (checked: no route,
-- service, job or socket handler writes them with the anon client), and no app
-- reaches PostgREST directly (web, iOS and Android call the API; none ships a
-- Supabase client or the anon key), so nothing the product does uses them.
--
-- These policies let a signed-in person who has the anon key change account,
-- social and business-profile rows straight through PostgREST, around the API:
--   - "User": user_update_self allows every column of one's own row, including
--     role, verified and earn_suspended_until. Reproduced on a local stack: a
--     disposable account set its own role to 'admin' (204), and the API's admin
--     routes (requireAdmin reads User.role) then answered it 200.
--   - "UserProfessionalProfile": one's own verification_status and tier.
--   - "BusinessProfile" (anyone with profile.edit): verification_status,
--     verification_tier, verified_at/verified_by and the Founding badge.
--   - "BusinessPageBlock" (anyone with pages.edit): page content past the API's
--     validation.
--   - "Relationship": a requester can set their own request to accepted.
--   - "RelationshipPermission", "UserBlock", "UserProfileBlock": grants and
--     blocks written past the API's checks, side effects and audit entries.
-- Read (SELECT) policies stay, including bp_select and bpb_select, which already
-- cover what bp_write and bpb_write (ALL) let a team member read.
SET LOCAL lock_timeout='5s';

DROP POLICY user_insert_self ON public."User";
DROP POLICY user_update_self ON public."User";

DROP POLICY pro_profile_insert_own ON public."UserProfessionalProfile";
DROP POLICY pro_profile_update_own ON public."UserProfessionalProfile";
DROP POLICY pro_profile_delete_own ON public."UserProfessionalProfile";

DROP POLICY bp_write ON public."BusinessProfile";
DROP POLICY bpb_write ON public."BusinessPageBlock";

DROP POLICY relationship_insert_requester ON public."Relationship";
DROP POLICY relationship_update_participant ON public."Relationship";

DROP POLICY relperm_upsert_owner ON public."RelationshipPermission";
DROP POLICY relperm_update_owner ON public."RelationshipPermission";
DROP POLICY relperm_delete_owner ON public."RelationshipPermission";

DROP POLICY "Users can create their own blocks" ON public."UserBlock";
DROP POLICY "Users can delete their own blocks" ON public."UserBlock";

DROP POLICY userprofileblock_insert_own ON public."UserProfileBlock";
DROP POLICY userprofileblock_delete_own ON public."UserProfileBlock";
