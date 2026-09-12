alter function public.import_recipe_catalog_batch(text, jsonb)
rename to import_recipe_catalog_batch_legacy;

alter function public.verify_recipe_catalog()
rename to verify_recipe_catalog_legacy;

revoke all on function public.import_recipe_catalog_batch_legacy(text, jsonb)
from public, anon, authenticated, service_role;

revoke all on function public.verify_recipe_catalog_legacy()
from public, anon, authenticated, service_role;

create function public.import_recipe_catalog_batch(
  target_table text,
  rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  request_role text;
begin
  request_role := coalesce(
    current_setting('request.jwt.claims', true)::jsonb ->> 'role',
    ''
  );

  if request_role <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  perform set_config('request.jwt.claim.role', request_role, true);

  return public.import_recipe_catalog_batch_legacy(target_table, rows);
end
$$;

revoke all on function public.import_recipe_catalog_batch(text, jsonb)
from public, anon, authenticated;

grant execute on function public.import_recipe_catalog_batch(text, jsonb)
to service_role;

create function public.verify_recipe_catalog()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  request_role text;
begin
  request_role := coalesce(
    current_setting('request.jwt.claims', true)::jsonb ->> 'role',
    ''
  );

  if request_role <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  perform set_config('request.jwt.claim.role', request_role, true);

  return public.verify_recipe_catalog_legacy();
end
$$;

revoke all on function public.verify_recipe_catalog()
from public, anon, authenticated;

grant execute on function public.verify_recipe_catalog()
to service_role;

notify pgrst, 'reload schema';
