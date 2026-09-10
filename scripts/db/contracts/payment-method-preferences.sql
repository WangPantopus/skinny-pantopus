BEGIN;
-- Saved-card writes have one app-owned preference and permanent removal fences.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
INSERT INTO auth.users(id,email) VALUES
 ('eef10000-0000-4000-8000-000000000001','card-contract-1@example.invalid'),
 ('eef10000-0000-4000-8000-000000000002','card-contract-2@example.invalid'),
 ('eef10000-0000-4000-8000-000000000003','card-contract-3@example.invalid'),
 ('eef10000-0000-4000-8000-000000000004','card-contract-4@example.invalid');
INSERT INTO public."User"(id,email,username,name,stripe_customer_id) VALUES
 ('eef10000-0000-4000-8000-000000000001','card-contract-1@example.invalid','card_contract_1','Card contract','cus_contract1'),
 ('eef10000-0000-4000-8000-000000000002','card-contract-2@example.invalid','card_contract_2','Card contract','cus_contract2');
DO $$ DECLARE v_function regprocedure; BEGIN
 FOREACH v_function IN ARRAY ARRAY[
 'public.bind_payment_customer(uuid,text)'::regprocedure,
 'public.save_payment_method(uuid,text,text,jsonb)'::regprocedure,
 'public.set_default_payment_method(uuid,uuid)'::regprocedure,
 'public.begin_payment_method_removal(uuid,uuid)'::regprocedure,
 'public.complete_payment_method_removal(text)'::regprocedure] LOOP
 IF has_function_privilege('authenticated',v_function,'execute') OR has_function_privilege('anon',v_function,'execute')
 OR NOT has_function_privilege('service_role',v_function,'execute') THEN RAISE EXCEPTION 'Incorrect payment RPC grants'; END IF;
 END LOOP;
 IF has_table_privilege('authenticated','public."PaymentMethod"','insert,update,delete,truncate')
 OR has_table_privilege('anon','public."PaymentMethod"','select,insert,update,delete,truncate')
 OR has_table_privilege('authenticated','public."PaymentMethodRemoval"','select,insert,update,delete') THEN
 RAISE EXCEPTION 'Clients bypass payment method admission'; END IF;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"eef10000-0000-4000-8000-000000000003","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
INSERT INTO public."User"(id,email,username,name,stripe_customer_id) VALUES
 ('eef10000-0000-4000-8000-000000000003','card-contract-3@example.invalid','card_contract_3','New card profile',NULL);
UPDATE public."User" SET name='Updated card profile' WHERE id='eef10000-0000-4000-8000-000000000003';
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM public."User" WHERE id='eef10000-0000-4000-8000-000000000003' AND name='Updated card profile') THEN
 RAISE EXCEPTION 'Normal profile insertion/update was broken'; END IF;
 BEGIN
  UPDATE public."User" SET stripe_customer_id='cus_stolen' WHERE id='eef10000-0000-4000-8000-000000000003';
  RAISE EXCEPTION 'Client assigned its own provider customer';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"eef10000-0000-4000-8000-000000000004","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
  INSERT INTO public."User"(id,email,username,name,stripe_customer_id) VALUES
   ('eef10000-0000-4000-8000-000000000004','card-contract-4@example.invalid','card_contract_4','Invalid binding','cus_stolen');
  RAISE EXCEPTION 'Client inserted a forged provider binding';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"eef10000-0000-4000-8000-000000000001","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
  UPDATE public."User" SET stripe_customer_id='cus_stolen' WHERE id='eef10000-0000-4000-8000-000000000001';
  RAISE EXCEPTION 'Client changed its provider binding';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  UPDATE public."User" SET stripe_customer_id=NULL WHERE id='eef10000-0000-4000-8000-000000000001';
  RAISE EXCEPTION 'Client cleared its provider binding';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.complete_payment_method_removal('pm_contractA');
  RAISE EXCEPTION 'Client created removal proof';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  DELETE FROM public."PaymentMethod";
  RAISE EXCEPTION 'Client directly removed saved methods';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"role":"anon"}',true);
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN
  INSERT INTO public."User"(id,email,username,name,stripe_customer_id) VALUES
   ('eef10000-0000-4000-8000-000000000004','card-contract-4@example.invalid','card_contract_4','Anonymous binding','cus_stolen');
  RAISE EXCEPTION 'Anonymous client inserted provider binding';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE public."User" SET stripe_customer_id='cus_stolen' WHERE id='eef10000-0000-4000-8000-000000000001';
 IF FOUND THEN RAISE EXCEPTION 'Anonymous client updated provider binding'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE service_role;
DO $$ DECLARE
 u uuid:='eef10000-0000-4000-8000-000000000001'; foreign_user uuid:='eef10000-0000-4000-8000-000000000002';
 details jsonb:='{"payment_method_type":"card","card_brand":"visa","card_last4":"4242","card_exp_month":12,"card_exp_year":2030}';
 a jsonb; b jsonb; result jsonb; removal jsonb; n integer;
BEGIN
 UPDATE public."User" SET stripe_customer_id='cus_contract3' WHERE id='eef10000-0000-4000-8000-000000000003';
 IF NOT FOUND THEN RAISE EXCEPTION 'Service cannot persist customer binding'; END IF;
 result:=public.bind_payment_customer(u,'cus_unselected');
 IF result->>'customer_id' IS DISTINCT FROM 'cus_contract1' THEN RAISE EXCEPTION 'Customer binding replaced the durable winner'; END IF;
 IF public.bind_payment_customer('eef10000-0000-4000-8000-000000000099','cus_unknown')->>'error' IS DISTINCT FROM 'NOT_FOUND' THEN
 RAISE EXCEPTION 'Missing actor acquired a customer'; END IF;
 a:=public.save_payment_method(u,'cus_contract1','pm_contractA',details)->'payment_method';
 b:=public.save_payment_method(u,'cus_contract1','pm_contractB',details)->'payment_method';
 IF a->>'is_default' IS DISTINCT FROM 'true' OR b->>'is_default' IS DISTINCT FROM 'false' THEN
 RAISE EXCEPTION 'First-card preference incorrect'; END IF;
 result:=public.set_default_payment_method(u,(b->>'id')::uuid);
 result:=public.save_payment_method(u,'cus_contract1','pm_contractA',details);
 IF result->'payment_method'->>'id' IS DISTINCT FROM a->>'id'
 OR result->'payment_method'->>'is_default' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Replay replaced selected preference'; END IF;
 IF public.set_default_payment_method(foreign_user,(a->>'id')::uuid)->>'error' IS DISTINCT FROM 'NOT_FOUND'
 OR public.save_payment_method(foreign_user,'cus_contract1','pm_contractA',details)->>'error' IS DISTINCT FROM 'NOT_FOUND'
 OR public.save_payment_method(foreign_user,'cus_contract2','pm_contractA',details)->>'error' IS DISTINCT FROM 'NOT_FOUND' THEN
 RAISE EXCEPTION 'Foreign owner/customer binding bypassed'; END IF;

 -- Invalid details roll back the transaction rather than silently saving null.
 BEGIN
  PERFORM public.save_payment_method(u,'cus_contract1','pm_contractInvalid',details||'{"card_exp_month":"invalid"}');
  RAISE EXCEPTION 'Invalid details accepted';
 EXCEPTION WHEN invalid_text_representation THEN NULL; END;
 IF EXISTS(SELECT FROM public."PaymentMethod" WHERE stripe_payment_method_id='pm_contractInvalid') THEN
 RAISE EXCEPTION 'Failed save left a partial row'; END IF;
 BEGIN
  PERFORM public.set_default_payment_method(u,(a->>'id')::uuid);
  RAISE EXCEPTION 'Simulated lost DB transaction' USING ERRCODE='40001';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
 IF NOT EXISTS(SELECT FROM public."PaymentMethod" WHERE id=(b->>'id')::uuid AND is_default IS TRUE) THEN
 RAISE EXCEPTION 'Default rollback lost previous preference'; END IF;

 removal:=public.begin_payment_method_removal(u,(a->>'id')::uuid)->'removal';
 IF removal->>'completed_at' IS NOT NULL OR removal->>'method_id' IS DISTINCT FROM a->>'id' THEN
 RAISE EXCEPTION 'Removal admission did not preserve retry ownership'; END IF;
 IF public.save_payment_method(u,'cus_contract1','pm_contractA',details)->>'error' IS DISTINCT FROM 'REMOVED'
 OR public.set_default_payment_method(u,(a->>'id')::uuid)->>'error' IS DISTINCT FROM 'NOT_FOUND' THEN
 RAISE EXCEPTION 'Pending removal was revived'; END IF;
 IF public.begin_payment_method_removal(foreign_user,(a->>'id')::uuid)->>'error' IS DISTINCT FROM 'NOT_FOUND' THEN
 RAISE EXCEPTION 'Foreign account recovered removal proof'; END IF;
 PERFORM public.complete_payment_method_removal('pm_contractA');
 PERFORM public.complete_payment_method_removal('pm_contractA');
 IF public.begin_payment_method_removal(u,(a->>'id')::uuid)->'removal'->>'completed_at' IS NULL
 OR EXISTS(SELECT FROM public."PaymentMethod" WHERE id=(a->>'id')::uuid)
 OR NOT EXISTS(SELECT FROM public."PaymentMethod" WHERE id=(b->>'id')::uuid AND is_default IS TRUE) THEN
 RAISE EXCEPTION 'Removal lost receipt or changed a separately chosen default'; END IF;

 -- A verified detach may arrive before any local card or attachment event.
 PERFORM public.complete_payment_method_removal('pm_contractUnknown');
 IF public.save_payment_method(u,'cus_contract1','pm_contractUnknown',details)->>'error' IS DISTINCT FROM 'REMOVED' THEN
 RAISE EXCEPTION 'Unknown detached method was resurrected'; END IF;
 result:=public.save_payment_method(u,'cus_contract1','pm_contractC',details);
 PERFORM public.begin_payment_method_removal(u,(b->>'id')::uuid);
 PERFORM public.complete_payment_method_removal('pm_contractB');
 IF NOT EXISTS(SELECT FROM public."PaymentMethod" WHERE stripe_payment_method_id='pm_contractC' AND is_default IS TRUE) THEN
 RAISE EXCEPTION 'Fallback default missing'; END IF;
 SELECT count(*) INTO n FROM public."PaymentMethod" WHERE user_id=u;
 IF n<>1 THEN RAISE EXCEPTION 'Removal deleted an unrelated card'; END IF;
 PERFORM public.complete_payment_method_removal('pm_contractC');
 IF EXISTS(SELECT FROM public."PaymentMethod" WHERE user_id=u) THEN RAISE EXCEPTION 'Last card remained'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
