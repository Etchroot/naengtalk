-- Data API auto-exposure is disabled for this project. The Edge Function's
-- service role needs explicit table privileges to read and cache sourced rules.
-- No client-side insert/update grants are added.
grant select, insert, update on table public.shelf_life_rules to service_role;
