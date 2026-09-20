-- HomeEmergency.type admits exactly the nine list-of-rows values and the six
-- native Add Emergency form categories; the web page's design category ids and
-- case variants stay refused by the check constraint.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, extensions, pg_catalog;

INSERT INTO auth.users (id,email) VALUES
 ('dbe00000-0000-4000-8000-000000000001','emergency-types@example.invalid');
INSERT INTO public."User" (id,email,username,name) VALUES
 ('dbe00000-0000-4000-8000-000000000001','emergency-types@example.invalid','emergency_types_01','Emergency types contract');
INSERT INTO public."Home" (id,owner_id,created_by_user_id,address,city,state,zipcode) VALUES
 ('dbe00000-0000-4000-8000-000000000100','dbe00000-0000-4000-8000-000000000001','dbe00000-0000-4000-8000-000000000001',
  'Emergency types contract','Test','WA','98607');

DO $types$
DECLARE
  v_home uuid := 'dbe00000-0000-4000-8000-000000000100';
  v_user uuid := 'dbe00000-0000-4000-8000-000000000001';
  v_admitted text[] := ARRAY['shutoff_water','shutoff_gas','shutoff_electric','breaker_map','extinguisher','first_aid',
    'evac_plan','emergency_contacts','other','allergy','medical_condition','medication','contact','pet_medical','power_of_attorney'];
  v_refused text[] := ARRAY['shutoff','evacuation','medical','ALLERGY','Contact',''];
  v text; v_def text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conname='HomeEmergency_type_chk' AND conrelid='public."HomeEmergency"'::regclass AND contype='c';
  IF v_def IS NULL THEN RAISE EXCEPTION 'HomeEmergency_type_chk is missing'; END IF;

  FOREACH v IN ARRAY v_admitted LOOP
    INSERT INTO public."HomeEmergency"(home_id,type,label,created_by) VALUES (v_home,v,'Contract '||v,v_user);
  END LOOP;
  IF (SELECT count(*) FROM public."HomeEmergency" WHERE home_id=v_home) <> array_length(v_admitted,1) THEN
   RAISE EXCEPTION 'An admitted HomeEmergency.type value was not stored'; END IF;

  FOREACH v IN ARRAY v_refused LOOP
    BEGIN
      INSERT INTO public."HomeEmergency"(home_id,type,label,created_by) VALUES (v_home,v,'Refused '||v,v_user);
      RAISE EXCEPTION 'HomeEmergency.type accepted "%"', v;
    EXCEPTION WHEN check_violation THEN NULL;
    END;
  END LOOP;
  IF (SELECT count(*) FROM public."HomeEmergency" WHERE home_id=v_home) <> array_length(v_admitted,1) THEN
   RAISE EXCEPTION 'A refused value left a HomeEmergency row behind'; END IF;
END $types$;
ROLLBACK;
