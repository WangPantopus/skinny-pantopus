-- Backwards compatible: yes. Adds one function; no table, column or row
-- changes (the function always rolls back what it tries). The deployed backend
-- doesn't call it. The new backend calls it and, while it's missing, deletes
-- accounts as before.
--
-- DELETE /api/users/account clears a list of rows that point at the user, then
-- deletes the User row, which cascades to ~70 tables. Rows added since the
-- list was written make that delete fail after the earlier steps have already
-- erased data. Examples: a stop request made by the user, or a stop receipt on
-- one of their tasks (ON DELETE RESTRICT on the cascaded Gig). The route used
-- to sign the user out everywhere first, so the result was a signed-out user
-- whose account still existed, half-deleted.
--
-- This dry run does exactly what the route will do, in a subtransaction that
-- is always rolled back:
-- 1. null the attribution columns (p_nullify);
-- 2. delete the person's own rows (p_delete);
-- 3. delete the User row, running every cascade, constraint and guard trigger.
-- It returns {"ok": true}, or {"ok": false} with the SQLSTATE, table and
-- constraint of the first failure, so the route can refuse before anything
-- changes. Pairs whose table or column doesn't exist are skipped, as the route
-- tolerates them. No public function or trigger reaches outside the database
-- (no pg_net, dblink or pg_notify), so a rollback leaves nothing behind.
SET LOCAL lock_timeout='5s';

CREATE FUNCTION public.account_deletion_dry_run(p_user_id uuid, p_nullify text[] DEFAULT '{}'::text[], p_delete text[] DEFAULT '{}'::text[])
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE pair text; tbl text; col text; rel regclass; v_state text; v_msg text; v_table text; v_constraint text;
BEGIN
 BEGIN
  FOREACH pair IN ARRAY p_nullify||p_delete LOOP
   tbl:=split_part(pair,'.',1); col:=split_part(pair,'.',2); rel:=to_regclass(format('public.%I',tbl));
   CONTINUE WHEN rel IS NULL OR NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid=rel AND attname=col AND NOT attisdropped);
   IF pair=ANY(p_nullify) THEN
    EXECUTE format('UPDATE %s SET %I=NULL WHERE %I=$1',rel,col,col) USING p_user_id;
   ELSE
    EXECUTE format('DELETE FROM %s WHERE %I=$1',rel,col) USING p_user_id;
   END IF;
  END LOOP;
  DELETE FROM public."User" WHERE id=p_user_id;
  RAISE EXCEPTION 'account_deletion_dry_run_ok';
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS v_state=RETURNED_SQLSTATE, v_msg=MESSAGE_TEXT, v_table=TABLE_NAME, v_constraint=CONSTRAINT_NAME;
  IF v_msg='account_deletion_dry_run_ok' THEN RETURN jsonb_build_object('ok',true); END IF;
  RETURN jsonb_build_object('ok',false,'sqlstate',v_state,'table',nullif(v_table,''),'constraint',nullif(v_constraint,''));
 END;
END $$;

REVOKE ALL ON FUNCTION public.account_deletion_dry_run(uuid,text[],text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.account_deletion_dry_run(uuid,text[],text[]) TO service_role;
