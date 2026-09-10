-- Private first use stays separate from shared household authorization.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
INSERT INTO auth.users (id, email) VALUES
 ('ddd10000-0000-4000-8000-000000000001', 'private-pickup-one@example.invalid'),
 ('ddd10000-0000-4000-8000-000000000002', 'private-pickup-two@example.invalid');
INSERT INTO public."User" (id, email, username, name)
 SELECT id, email, 'private_pickup_' || right(id::text, 1), 'Private pickup fixture'
 FROM auth.users WHERE id IN ('ddd10000-0000-4000-8000-000000000001','ddd10000-0000-4000-8000-000000000002');
INSERT INTO public."Home" (id, created_by_user_id, owner_id, address, city, state, zipcode)
 VALUES ('ddd10000-0000-4000-8000-000000000010','ddd10000-0000-4000-8000-000000000001',null,
 '100 Synthetic Street','Synthetic City','WA','98607');
INSERT INTO public."HomeOccupancy" (home_id,user_id,role,role_base,is_active,verification_status,age_band)
 VALUES ('ddd10000-0000-4000-8000-000000000010','ddd10000-0000-4000-8000-000000000001',
 'member','member',true,'provisional_bootstrap','adult');

SET LOCAL ROLE service_role;
DO $$
DECLARE h constant uuid := 'ddd10000-0000-4000-8000-000000000010';
 u constant uuid := 'ddd10000-0000-4000-8000-000000000001';
 other_u constant uuid := 'ddd10000-0000-4000-8000-000000000002';
 result jsonb; before_rules jsonb; payload jsonb;
BEGIN
 payload := jsonb_build_array(jsonb_build_object('kind','garbage','title','Own pickup',
   'rrule','FREQ=WEEKLY;BYDAY=MO','dtstart','2026-09-10','created_by',u));
 IF public.home_is_active_member(h,u) THEN RAISE EXCEPTION 'Private creator became shared member'; END IF;
 result := public.get_home_pickup_calendar(h,u);
 IF result->>'allowed' <> 'true' OR result->'home'->>'id' <> h::text THEN
   RAISE EXCEPTION 'Exact creator cannot read private pickup context'; END IF;
 IF public.get_home_pickup_calendar(h,other_u)->>'allowed' <> 'false' THEN
   RAISE EXCEPTION 'Stranger received pickup context'; END IF;
 result := public.mutate_home_pickup_calendar(h,u,payload);
 IF result->>'allowed' <> 'true' OR result->>'count' <> '1' THEN RAISE EXCEPTION 'Own pickup was not saved'; END IF;
 IF NOT EXISTS (SELECT FROM public."AddressCalendarRule" WHERE scope_type='home' AND scope_key=h::text
   AND title='Own pickup' AND created_by=u) THEN RAISE EXCEPTION 'Wrong persisted pickup'; END IF;
 SELECT jsonb_agg(to_jsonb(r) ORDER BY id) INTO before_rules FROM public."AddressCalendarRule" r
   WHERE scope_type='home' AND scope_key=h::text;
 BEGIN
   PERFORM public.mutate_home_pickup_calendar(h,u,jsonb_build_array(jsonb_build_object('kind','garbage',
     'title','Foreign author','rrule','FREQ=WEEKLY;BYDAY=TU','dtstart','2026-09-10','created_by',other_u)));
   RAISE EXCEPTION 'Foreign author accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
 IF before_rules IS DISTINCT FROM (SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public."AddressCalendarRule" r
   WHERE scope_type='home' AND scope_key=h::text) THEN RAISE EXCEPTION 'Rejected write lost original schedule'; END IF;

 UPDATE public."HomeOccupancy" SET age_band='child' WHERE home_id=h AND user_id=u;
 IF public.get_home_pickup_calendar(h,u)->>'allowed' <> 'true'
   OR public.mutate_home_pickup_calendar(h,u,null)->>'allowed' <> 'false' THEN
   RAISE EXCEPTION 'Child pickup read/write ceiling wrong'; END IF;
 UPDATE public."HomeOccupancy" SET age_band=null WHERE home_id=h AND user_id=u;
 IF public.mutate_home_pickup_calendar(h,u,payload)->>'allowed' <> 'true' THEN
   RAISE EXCEPTION 'Historical unknown age was silently revoked'; END IF;

 UPDATE public."AddressCalendarRule" SET created_by=other_u WHERE scope_type='home' AND scope_key=h::text;
 result := public.get_home_pickup_calendar(h,u);
 IF result->>'allowed' <> 'false' OR result ? 'rules'
   OR public.mutate_home_pickup_calendar(h,u,null)->>'allowed' <> 'false' THEN
   RAISE EXCEPTION 'Private creator saw or removed another author''s rule'; END IF;
 UPDATE public."AddressCalendarRule" SET created_by=u WHERE scope_type='home' AND scope_key=h::text;

 INSERT INTO public."HomeOccupancy" (home_id,user_id,role,role_base,is_active,verification_status)
 VALUES (h,other_u,'member','member',false,'moved_out');
 IF public.get_home_pickup_calendar(h,u)->>'allowed' <> 'false' THEN
   RAISE EXCEPTION 'Past household membership was mistaken for a private Home'; END IF;
 DELETE FROM public."HomeOccupancy" WHERE home_id=h AND user_id=other_u;

 UPDATE public."HomeOccupancy" SET verification_status='pending_postcard' WHERE home_id=h AND user_id=u;
 IF public.get_home_pickup_calendar(h,u)->>'allowed' <> 'false' THEN
   RAISE EXCEPTION 'Unilateral pending claim inherited creator exception'; END IF;
 UPDATE public."HomeOccupancy" SET verification_status='pending_doc' WHERE home_id=h AND user_id=u;
 IF public.get_home_pickup_calendar(h,u)->>'allowed' <> 'true' THEN
   RAISE EXCEPTION 'Exact pending owner-creator lost private setup'; END IF;
 UPDATE public."Home" SET security_state='frozen' WHERE id=h;
 IF public.mutate_home_pickup_calendar(h,u,null)->>'allowed' <> 'false' THEN RAISE EXCEPTION 'Frozen private Home allowed changes'; END IF;
 UPDATE public."Home" SET security_state='normal' WHERE id=h;

 UPDATE public."HomeOccupancy" SET verification_status='verified' WHERE home_id=h AND user_id=u;
 -- No new member/calendar defaults are needed for the existing pickup utility.
 IF public.home_has_permission(h,'calendar.edit',u) THEN RAISE EXCEPTION 'Unexpected member default grant'; END IF;
 IF public.mutate_home_pickup_calendar(h,u,payload)->>'allowed' <> 'true' THEN
   RAISE EXCEPTION 'Existing verified member pickup workflow was lost'; END IF;
 INSERT INTO public."HomePermissionOverride" (home_id,user_id,permission,allowed,created_by)
 VALUES (h,u,'calendar.edit',false,u);
 IF public.mutate_home_pickup_calendar(h,u,null)->>'allowed' <> 'false' THEN
   RAISE EXCEPTION 'Explicit calendar deny was ignored'; END IF;
 DELETE FROM public."HomePermissionOverride" WHERE home_id=h AND user_id=u;
 -- Observe the table in a later statement; an EXISTS initplan in the same
 -- expression may run before the mutating function.
 result := public.mutate_home_pickup_calendar(h,u,null);
 IF result->>'allowed' <> 'true'
   OR EXISTS (SELECT FROM public."AddressCalendarRule" WHERE scope_type='home' AND scope_key=h::text) THEN
   RAISE EXCEPTION 'Authorized reset did not remove exact Home pickup'; END IF;
 IF (SELECT count(*) FROM public."HomeRolePermission") <> 24 THEN RAISE EXCEPTION 'Reference policy changed'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','ddd10000-0000-4000-8000-000000000001',true);
DO $$ BEGIN
 BEGIN
   PERFORM public.get_home_pickup_calendar('ddd10000-0000-4000-8000-000000000010','ddd10000-0000-4000-8000-000000000001');
   RAISE EXCEPTION 'Direct client called service-only pickup read';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   PERFORM public.mutate_home_pickup_calendar('ddd10000-0000-4000-8000-000000000010','ddd10000-0000-4000-8000-000000000001',null);
   RAISE EXCEPTION 'Direct client called service-only pickup mutation';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: exact private pickup scope, age/deny/revocation guards and rollback preservation' AS result;
