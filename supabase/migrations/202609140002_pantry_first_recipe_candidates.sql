-- Keep RPC signature and permissions; change only the candidate window ordering.
create or replace function public.search_recipe_candidates(
  query_name text, ingredient_names text[], source_kind text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  normalized_query text := lower(btrim(coalesce(query_name, '')));
  result jsonb;
begin
  if coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if length(normalized_query) > 100
    or coalesce(array_length(ingredient_names, 1), 0) > 20
    or exists (
      select 1 from unnest(coalesce(ingredient_names, '{}'::text[])) as item
      where length(item) > 100
    ) then raise exception 'invalid recipe search request'; end if;

  if source_kind = 'catalog' then
    with requested as (
      select distinct lower(btrim(item)) as term
      from unnest(coalesce(ingredient_names, '{}'::text[])) as item
      where btrim(item) <> ''
    ), ranked as (
      select recipe.recipe_id as id, recipe.name as title, recipe.source as origin,
        case when normalized_query <> '' and lower(recipe.name) = normalized_query then 100
          when normalized_query <> '' and position(normalized_query in lower(recipe.name)) > 0 then 70
          else 0 end as name_score,
        count(distinct requested.term) as matched_count,
        count(distinct ingredient.id) as ingredient_count
      from recipe_catalog.recipes as recipe
      left join recipe_catalog.ingredients as ingredient on ingredient.recipe_id = recipe.recipe_id
      left join requested on lower(ingredient.normalized_name) = requested.term
        or lower(coalesce(ingredient.parent_ingredient, '')) = requested.term
        or lower(ingredient.search_key) = requested.term
      group by recipe.recipe_id, recipe.name, recipe.source
    )
    select coalesce(jsonb_agg(to_jsonb(limited)), '[]'::jsonb) into result
    from (
      select id, title, origin, name_score, matched_count, ingredient_count
      from ranked where name_score > 0 or matched_count > 0
      order by greatest(ingredient_count - matched_count, 0) asc,
        matched_count desc, name_score desc, id
      limit 20
    ) as limited;
  elsif source_kind = 'shared' then
    with requested as (
      select distinct lower(btrim(item)) as term
      from unnest(coalesce(ingredient_names, '{}'::text[])) as item
      where btrim(item) <> ''
    ), ranked as (
      select shared.id::text as id, shared.title, 'SHARED_AI'::text as origin,
        case when normalized_query <> '' and lower(shared.title) = normalized_query then 100
          when normalized_query <> '' and position(normalized_query in lower(shared.title)) > 0 then 70
          else 0 end as name_score,
        (select count(distinct requested.term) from unnest(shared.ingredient_names) as stored(name)
          join requested on lower(stored.name) = requested.term) as matched_count,
        cardinality(shared.ingredient_names) as ingredient_count
      from recipe_catalog.shared_recipes as shared
    )
    select coalesce(jsonb_agg(to_jsonb(limited)), '[]'::jsonb) into result
    from (
      select id, title, origin, name_score, matched_count, ingredient_count
      from ranked where name_score > 0 or matched_count > 0
      order by greatest(ingredient_count - matched_count, 0) asc,
        matched_count desc, name_score desc, id
      limit 20
    ) as limited;
  else
    raise exception 'invalid recipe source';
  end if;
  return result;
end
$$;

revoke all on function public.search_recipe_candidates(text, text[], text)
from public, anon, authenticated;
grant execute on function public.search_recipe_candidates(text, text[], text)
to service_role;
