-- Backwards compatible: yes. Adds one function and changes no table, column or
-- row. The deployed backend never calls it and keeps working; deploy this
-- migration before the backend that does.
--
-- Lockdown was three separate requests: turn it on (and make the home private),
-- revoke the guest passes, then write the audit row. A disable that landed in
-- between committed first, so the audit log ended with "Lockdown enabled" on a
-- home that was off; and a refused audit insert was never even noticed, while
-- the panel promises that Lockdown changes are recorded. Like guest-pass issue
-- and revoke, each Lockdown command is now one transaction under the Home's
-- share lock: commands on the same Home run one after another, and each audit
-- row commits with its change.
--  * Turning Lockdown on keeps it on when the pass revoke or the audit insert
--    fails (the safe state) and reports which, so the owner can retry; a retry
--    is idempotent.
--  * Turning it off changes nothing unless the change is recorded.
SET LOCAL lock_timeout='5s';

CREATE FUNCTION public.set_home_lockdown(p_home_id uuid, p_actor_id uuid, p_enable boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE v_home public."Home"%ROWTYPE; v_now timestamptz; v_revoked integer := 0;
  v_revoke_failed boolean := false; v_audit_failed boolean := false; v_step text;
BEGIN
  IF p_home_id IS NULL OR p_actor_id IS NULL OR p_enable IS NULL THEN
    RETURN '{"ok":false,"code":"LOCKDOWN_INVALID","status":400}'::jsonb; END IF;
  IF NOT public.lock_home_external_share(p_home_id) THEN
    RETURN '{"ok":false,"code":"HOME_NOT_FOUND","status":404}'::jsonb; END IF;
  v_now := clock_timestamp();
  IF p_enable THEN
    UPDATE public."Home" SET lockdown_enabled = true, lockdown_enabled_at = v_now, lockdown_enabled_by = p_actor_id,
      visibility = 'private', updated_at = v_now WHERE id = p_home_id RETURNING * INTO v_home;
    BEGIN
      UPDATE public."HomeGuestPass" SET revoked_at = v_now, updated_at = v_now
        WHERE home_id = p_home_id AND revoked_at IS NULL;
      GET DIAGNOSTICS v_revoked = ROW_COUNT;
    EXCEPTION WHEN OTHERS THEN v_revoke_failed := true; v_revoked := 0;
    END;
    BEGIN
      INSERT INTO public."HomeAuditLog" (home_id, actor_user_id, action, target_type, target_id, metadata)
        VALUES (p_home_id, p_actor_id, 'lockdown_enabled', 'Home', p_home_id,
          jsonb_build_object('guest_passes_revoked', v_revoked)
            || CASE WHEN v_revoke_failed THEN '{"guest_pass_revoke_failed":true}'::jsonb ELSE '{}'::jsonb END);
    EXCEPTION WHEN OTHERS THEN v_audit_failed := true;
    END;
    RETURN jsonb_build_object('ok', true, 'home', to_jsonb(v_home), 'guest_passes_revoked', v_revoked,
      'guest_pass_revoke_failed', v_revoke_failed, 'audit_recorded', NOT v_audit_failed);
  END IF;
  BEGIN
    v_step := 'home';
    UPDATE public."Home" SET lockdown_enabled = false, updated_at = v_now WHERE id = p_home_id RETURNING * INTO v_home;
    v_step := 'audit';
    INSERT INTO public."HomeAuditLog" (home_id, actor_user_id, action, target_type, target_id, metadata)
      VALUES (p_home_id, p_actor_id, 'lockdown_disabled', 'Home', p_home_id, '{}'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    SELECT * INTO v_home FROM public."Home" WHERE id = p_home_id;
    RETURN jsonb_build_object('ok', false, 'code', CASE v_step WHEN 'audit' THEN 'LOCKDOWN_AUDIT_FAILED' ELSE 'LOCKDOWN_UNAVAILABLE' END,
      'status', 503, 'home', to_jsonb(v_home));
  END;
  RETURN jsonb_build_object('ok', true, 'home', to_jsonb(v_home));
END $$;

REVOKE ALL ON FUNCTION public.set_home_lockdown(uuid,uuid,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_home_lockdown(uuid,uuid,boolean) TO service_role;
