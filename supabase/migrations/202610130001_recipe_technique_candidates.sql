create function public.search_recipe_technique_candidates(
  query_name text,
  required_ingredient_names text[],
  inventory_names text[],
  source_kind text
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
    or coalesce(array_length(required_ingredient_names, 1), 0) > 10
    or coalesce(array_length(inventory_names, 1), 0) > 20
    or exists (
      select 1
      from unnest(coalesce(required_ingredient_names, '{}'::text[])
        || coalesce(inventory_names, '{}'::text[])) as item
      where length(item) > 100
    ) then
    raise exception 'invalid recipe technique search request';
  end if;

  if source_kind = 'catalog' then
    with required as (
      select distinct lower(btrim(item)) as term
      from unnest(coalesce(required_ingredient_names, '{}'::text[])) as item
      where btrim(item) <> ''
    ), pantry as (
      select distinct lower(btrim(item)) as term
      from unnest(coalesce(inventory_names, '{}'::text[])) as item
      where btrim(item) <> ''
    ), ranked as (
      select recipe.recipe_id as id,
        recipe.name as title,
        recipe.source as origin,
        case when normalized_query <> '' and lower(recipe.name) = normalized_query then 100
          when normalized_query <> '' and position(normalized_query in lower(recipe.name)) > 0 then 70
          else 0 end as name_score,
        case when normalized_query <> '' and lower(coalesce(recipe.cooking_method, '')) = normalized_query then 100
          when normalized_query <> '' and position(normalized_query in lower(coalesce(recipe.cooking_method, ''))) > 0 then 70
          else 0 end as method_score,
        (select count(distinct required.term)
          from recipe_catalog.ingredients as ingredient
          join required on lower(ingredient.normalized_name) = required.term
            or lower(coalesce(ingredient.parent_ingredient, '')) = required.term
            or lower(ingredient.search_key) = required.term
          where ingredient.recipe_id = recipe.recipe_id) as required_matched_count,
        (select count(*) from required) as required_count,
        (select count(distinct pantry.term)
          from recipe_catalog.ingredients as ingredient
          join pantry on lower(ingredient.normalized_name) = pantry.term
            or lower(coalesce(ingredient.parent_ingredient, '')) = pantry.term
            or lower(ingredient.search_key) = pantry.term
          where ingredient.recipe_id = recipe.recipe_id) as inventory_matched_count,
        (select count(*) from recipe_catalog.ingredients as ingredient
          where ingredient.recipe_id = recipe.recipe_id) as ingredient_count,
        (select count(*) from recipe_catalog.steps as step
          where step.recipe_id = recipe.recipe_id and btrim(coalesce(step.description, '')) <> '') as step_count
      from recipe_catalog.recipes as recipe
    )
    select coalesce(jsonb_agg(to_jsonb(limited)), '[]'::jsonb) into result
    from (
      select id, title, origin, name_score, method_score,
        required_matched_count, required_count, inventory_matched_count,
        ingredient_count, step_count
      from ranked
      where name_score > 0 or method_score > 0
        or required_matched_count > 0 or inventory_matched_count > 0
      order by required_matched_count desc,
        greatest(name_score, method_score) desc,
        inventory_matched_count desc,
        step_count desc,
        id
      limit 20
    ) as limited;
  elsif source_kind = 'shared' then
    with required as (
      select distinct lower(btrim(item)) as term
      from unnest(coalesce(required_ingredient_names, '{}'::text[])) as item
      where btrim(item) <> ''
    ), pantry as (
      select distinct lower(btrim(item)) as term
      from unnest(coalesce(inventory_names, '{}'::text[])) as item
      where btrim(item) <> ''
    ), ranked as (
      select shared.id::text as id,
        shared.title,
        'SHARED_AI'::text as origin,
        case when normalized_query <> '' and lower(shared.title) = normalized_query then 100
          when normalized_query <> '' and position(normalized_query in lower(shared.title)) > 0 then 70
          else 0 end as name_score,
        case when normalized_query <> ''
            and lower(coalesce(shared.content ->> 'cookingMethod', shared.content -> 'recipe' ->> 'cookingMethod', '')) = normalized_query then 100
          when normalized_query <> '' and position(normalized_query in lower(coalesce(
            shared.content ->> 'cookingMethod', shared.content -> 'recipe' ->> 'cookingMethod', ''))) > 0 then 70
          else 0 end as method_score,
        (select count(distinct required.term)
          from unnest(shared.ingredient_names) as stored(name)
          join required on lower(stored.name) = required.term) as required_matched_count,
        (select count(*) from required) as required_count,
        (select count(distinct pantry.term)
          from unnest(shared.ingredient_names) as stored(name)
          join pantry on lower(stored.name) = pantry.term) as inventory_matched_count,
        cardinality(shared.ingredient_names) as ingredient_count,
        case when jsonb_typeof(coalesce(shared.content -> 'steps', shared.content -> 'recipe' -> 'steps')) = 'array'
          then jsonb_array_length(coalesce(shared.content -> 'steps', shared.content -> 'recipe' -> 'steps'))
          else 0 end as step_count
      from recipe_catalog.shared_recipes as shared
    )
    select coalesce(jsonb_agg(to_jsonb(limited)), '[]'::jsonb) into result
    from (
      select id, title, origin, name_score, method_score,
        required_matched_count, required_count, inventory_matched_count,
        ingredient_count, step_count
      from ranked
      where name_score > 0 or method_score > 0
        or required_matched_count > 0 or inventory_matched_count > 0
      order by required_matched_count desc,
        greatest(name_score, method_score) desc,
        inventory_matched_count desc,
        step_count desc,
        id
      limit 20
    ) as limited;
  else
    raise exception 'invalid recipe source';
  end if;

  return result;
end
$$;

revoke all on function public.search_recipe_technique_candidates(text, text[], text[], text)
from public, anon, authenticated;
grant execute on function public.search_recipe_technique_candidates(text, text[], text[], text)
to service_role;

create or replace function public.get_recipe_candidate_detail(target_origin text, target_id text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  result jsonb;
begin
  if coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  if target_origin in ('MFDS', 'MAFRA') then
    select jsonb_build_object(
      'id', recipe.recipe_id,
      'title', recipe.name,
      'origin', recipe.source,
      'summary', recipe.summary,
      'cookingMethod', recipe.cooking_method,
      'cookingTime', recipe.cooking_time,
      'servings', recipe.servings,
      'tip', recipe.tip,
      'ingredients', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'name', ingredient.normalized_name,
          'parent', ingredient.parent_ingredient,
          'amount', ingredient.amount,
          'group', ingredient.ingredient_group
        ) order by ingredient.ingredient_no), '[]'::jsonb)
        from recipe_catalog.ingredients as ingredient
        where ingredient.recipe_id = recipe.recipe_id
      ),
      'steps', (
        select coalesce(jsonb_agg(step.description order by step.step_no), '[]'::jsonb)
        from recipe_catalog.steps as step
        where step.recipe_id = recipe.recipe_id
      )
    ) into result
    from recipe_catalog.recipes as recipe
    where recipe.recipe_id = target_id and recipe.source = target_origin;
  elsif target_origin = 'SHARED_AI' then
    select jsonb_build_object(
      'id', shared.id,
      'title', shared.title,
      'origin', 'SHARED_AI',
      'content', shared.content
    ) into result
    from recipe_catalog.shared_recipes as shared
    where shared.id::text = target_id;
  else
    raise exception 'invalid recipe origin';
  end if;

  if result is null then raise exception 'recipe candidate not found'; end if;
  return result;
end
$$;

revoke all on function public.get_recipe_candidate_detail(text, text)
from public, anon, authenticated;
grant execute on function public.get_recipe_candidate_detail(text, text)
to service_role;
