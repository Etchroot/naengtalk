-- Shared recipe snapshots have no foreign key to their original owner.
-- Remove them before auth.users cascades to public.recipes on account deletion.
create or replace function public.delete_shared_recipes_with_account()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, recipe_catalog
as $$
begin
  delete from recipe_catalog.shared_recipes as shared
  using public.recipes as original
  where shared.origin_recipe_id = original.id
    and original.owner_id = old.id;
  return old;
end;
$$;

revoke all on function public.delete_shared_recipes_with_account() from public, anon, authenticated;

create trigger delete_shared_recipes_with_account
before delete on auth.users
for each row execute function public.delete_shared_recipes_with_account();
