-- Temporary, synthetic-only benchmark. Never references application tables.
BEGIN;
CREATE SCHEMA bench_region_20261013;
CREATE TABLE bench_region_20261013.items (id integer PRIMARY KEY, payload jsonb NOT NULL);
INSERT INTO bench_region_20261013.items
SELECT n, jsonb_build_object('id',n,'ingredient_key','bench-'||n,'display_name','synthetic-'||n,
 'quantity',6,'unit','g','use_by_at','2027-01-01','date_source','user')
FROM generate_series(1,40) n;
CREATE TABLE bench_region_20261013.counter (id integer PRIMARY KEY, count bigint NOT NULL);
INSERT INTO bench_region_20261013.counter VALUES(1,0);
CREATE FUNCTION public.bench_region_20261013(operation text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE result jsonb;
BEGIN
 CASE operation
 WHEN 'ping' THEN RETURN jsonb_build_object('ok',true);
 WHEN 'write' THEN
  UPDATE bench_region_20261013.counter SET count=count+1 WHERE id=1;
  RETURN jsonb_build_object('ok',true);
 WHEN 'inventory' THEN
  SELECT jsonb_agg(payload ORDER BY id) INTO result FROM bench_region_20261013.items;
 WHEN 'candidates' THEN
  SELECT jsonb_agg(jsonb_build_object('id',id,'title','synthetic-recipe-'||id,
   'origin','MFDS','name_score',1,'matched_count',3,'ingredient_count',3) ORDER BY id)
  INTO result FROM bench_region_20261013.items WHERE id<=20;
 WHEN 'detail' THEN
  SELECT jsonb_build_object('title','synthetic-recipe','ingredients',jsonb_agg(payload ORDER BY id),
   'steps',to_jsonb(ARRAY['synthetic step 1','synthetic step 2','synthetic step 3']))
  INTO result FROM bench_region_20261013.items WHERE id<=30;
 ELSE RAISE EXCEPTION 'invalid benchmark operation';
 END CASE;
 RETURN result;
END $$;
REVOKE ALL ON SCHEMA bench_region_20261013 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.bench_region_20261013(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bench_region_20261013(text) TO anon,authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
