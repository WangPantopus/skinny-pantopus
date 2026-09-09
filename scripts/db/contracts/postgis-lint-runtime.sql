-- Exercise the six stock PostGIS routines with known static-check limitations.
-- This is local replay validation: all tables, locks and typmod changes roll back.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = public, extensions, pg_catalog;

CREATE TABLE public.lint_postgis_fixture (id integer PRIMARY KEY, geom public.geometry);
INSERT INTO public.lint_postgis_fixture VALUES
  (1, public.ST_SetSRID(public.ST_MakePoint(10, 20), 4326)),
  (2, public.ST_SetSRID(public.ST_MakePoint(30, 40), 4326));

DO $$
DECLARE extent public.box2d;
BEGIN
  extent := public.ST_FindExtent('lint_postgis_fixture', 'geom');
  IF extent::text IS DISTINCT FROM 'BOX(10 20,30 40)' THEN
    RAISE EXCEPTION 'Two-argument extent returned incorrect bounds';
  END IF;
  extent := public.ST_FindExtent('public', 'lint_postgis_fixture', 'geom');
  IF extent::text IS DISTINCT FROM 'BOX(10 20,30 40)' THEN
    RAISE EXCEPTION 'Three-argument extent returned incorrect bounds';
  END IF;
  IF public.Populate_Geometry_Columns('public.lint_postgis_fixture'::regclass, true) IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Geometry metadata was not populated';
  END IF;
  IF NOT EXISTS (SELECT FROM public.geometry_columns
      WHERE f_table_schema = 'public' AND f_table_name = 'lint_postgis_fixture'
        AND srid = 4326 AND type = 'POINT') THEN
    RAISE EXCEPTION 'Geometry metadata does not match the fixture';
  END IF;
  IF (public.PostGIS_Full_Version() LIKE 'POSTGIS=%') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'PostGIS version check failed without optional raster';
  END IF;

  PERFORM public.EnableLongTransactions();
  IF public.AddAuth('lint-contract-lock') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Transaction authorization was not added';
  END IF;
  IF public.LockRow('public', 'lint_postgis_fixture', '1', 'lint-contract-lock',
      (now() + interval '1 minute')::timestamp) IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Authorized row was not locked';
  END IF;
  IF public.LockRow('public', 'lint_postgis_fixture', '1', 'different-contract-lock',
      (now() + interval '1 minute')::timestamp) IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'Conflicting row lock was accepted';
  END IF;
END $$;
ROLLBACK;
SELECT 'PASS: stock PostGIS dynamic extents, geometry metadata, optional raster and transaction locks' AS result;
