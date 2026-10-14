BEGIN;
DROP FUNCTION IF EXISTS public.bench_region_20261013(text);
DROP TABLE IF EXISTS bench_region_20261013.items;
DROP TABLE IF EXISTS bench_region_20261013.counter;
DROP SCHEMA IF EXISTS bench_region_20261013;
NOTIFY pgrst, 'reload schema';
COMMIT;
