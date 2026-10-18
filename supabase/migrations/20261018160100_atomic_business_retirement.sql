-- Backwards compatible: yes. Adds one service-only function; no table, column
-- or existing row changes. Deploy before the DELETE /businesses/:id caller.
-- Preserve the existing soft-deletion behavior, but commit all of it together.
-- An unavailable database must not report success after only some writes.
SET LOCAL lock_timeout = '5s';

CREATE FUNCTION public.retire_business_account(p_business_id uuid, p_actor_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp SET lock_timeout = '5s' AS $$
BEGIN
  PERFORM 1 FROM public."User"
    WHERE id = p_business_id AND account_type = 'business' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only the owner can delete a business' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public."BusinessTeam"
    WHERE business_user_id = p_business_id AND user_id = p_actor_id
      AND is_active AND role_base = 'owner' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only the owner can delete a business' USING ERRCODE = '42501';
  END IF;

  UPDATE public."BusinessProfile" SET is_published = false, updated_at = now()
    WHERE business_user_id = p_business_id;
  UPDATE public."BusinessSeat"
    SET is_active = false, deactivated_at = now(), deactivated_reason = 'Business deleted'
    WHERE business_user_id = p_business_id;
  DELETE FROM public."SeatBinding" binding USING public."BusinessSeat" seat
    WHERE binding.seat_id = seat.id AND seat.business_user_id = p_business_id;
  UPDATE public."BusinessTeam" SET is_active = false, left_at = now()
    WHERE business_user_id = p_business_id;
  UPDATE public."User" SET account_type = 'individual', updated_at = now()
    WHERE id = p_business_id;
END $$;

REVOKE ALL ON FUNCTION public.retire_business_account(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.retire_business_account(uuid, uuid) TO service_role;
