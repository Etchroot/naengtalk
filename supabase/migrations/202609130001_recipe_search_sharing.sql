create table recipe_catalog.shared_recipes (
  id uuid primary key default gen_random_uuid(),
  origin_recipe_id uuid not null unique,
  title text not null,
  content jsonb not null,
  ingredient_names text[] not null,
  created_at timestamptz not null default now()
);

create index shared_recipes_title_idx on recipe_catalog.shared_recipes(title);
create index shared_recipes_ingredient_names_idx
  on recipe_catalog.shared_recipes using gin(ingredient_names);

alter table recipe_catalog.shared_recipes enable row level security;
revoke all on table recipe_catalog.shared_recipes from public, anon, authenticated;

create function public.search_recipe_candidates(
  query_name text,
  ingredient_names text[],
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
    or coalesce(array_length(ingredient_names, 1), 0) > 20
    or exists (
      select 1 from unnest(coalesce(ingredient_names, '{}'::text[])) as item
      where length(item) > 100
    ) then
    raise exception 'invalid recipe search request';
  end if;

  if source_kind = 'catalog' then
    with requested as (
      select distinct lower(btrim(item)) as term
      from unnest(coalesce(ingredient_names, '{}'::text[])) as item
      where btrim(item) <> ''
    ), ranked as (
      select
        recipe.recipe_id as id,
        recipe.name as title,
        recipe.source as origin,
        case
          when normalized_query <> '' and lower(recipe.name) = normalized_query then 100
          when normalized_query <> '' and position(normalized_query in lower(recipe.name)) > 0 then 70
          else 0
        end as name_score,
        count(distinct requested.term) as matched_count,
        count(distinct ingredient.id) as ingredient_count
      from recipe_catalog.recipes as recipe
      left join recipe_catalog.ingredients as ingredient
        on ingredient.recipe_id = recipe.recipe_id
      left join requested on
        lower(ingredient.normalized_name) = requested.term
        or lower(coalesce(ingredient.parent_ingredient, '')) = requested.term
        or lower(ingredient.search_key) = requested.term
      group by recipe.recipe_id, recipe.name, recipe.source
    )
    select coalesce(jsonb_agg(to_jsonb(limited)), '[]'::jsonb) into result
    from (
      select id, title, origin, name_score, matched_count, ingredient_count
      from ranked
      where name_score > 0 or matched_count > 0
      order by name_score desc, matched_count desc, ingredient_count asc, id
      limit 20
    ) as limited;
  elsif source_kind = 'shared' then
    with requested as (
      select distinct lower(btrim(item)) as term
      from unnest(coalesce(ingredient_names, '{}'::text[])) as item
      where btrim(item) <> ''
    ), ranked as (
      select
        shared.id::text as id,
        shared.title,
        'SHARED_AI'::text as origin,
        case
          when normalized_query <> '' and lower(shared.title) = normalized_query then 100
          when normalized_query <> '' and position(normalized_query in lower(shared.title)) > 0 then 70
          else 0
        end as name_score,
        (select count(distinct requested.term)
         from unnest(shared.ingredient_names) as stored(name)
         join requested on lower(stored.name) = requested.term) as matched_count,
        cardinality(shared.ingredient_names) as ingredient_count
      from recipe_catalog.shared_recipes as shared
    )
    select coalesce(jsonb_agg(to_jsonb(limited)), '[]'::jsonb) into result
    from (
      select id, title, origin, name_score, matched_count, ingredient_count
      from ranked
      where name_score > 0 or matched_count > 0
      order by name_score desc, matched_count desc, ingredient_count asc, id
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

create function public.get_recipe_candidate_detail(target_origin text, target_id text)
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
      'cookingTime', recipe.cooking_time,
      'servings', recipe.servings,
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

create function public.share_completed_ai_recipe(target_recipe_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  private_recipe public.recipes;
  public_content jsonb;
  shared_id uuid;
  names text[];
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  select recipe.* into private_recipe
  from public.recipes as recipe
  where recipe.id = target_recipe_id
    and recipe.owner_id = auth.uid()
    and exists (
      select 1 from public.completed_recipes as completed
      where completed.recipe_id = recipe.id
        and completed.owner_id = auth.uid()
    );
  if not found then raise exception 'completed private recipe not found'; end if;
  if private_recipe.content ->> 'origin' <> 'AI_GENERATED' then
    raise exception 'only AI-generated recipes can be shared';
  end if;
  if length(private_recipe.content::text) > 20000
    or jsonb_typeof(private_recipe.content -> 'ingredients') <> 'array'
    or jsonb_typeof(private_recipe.content -> 'steps') <> 'array'
    or jsonb_array_length(private_recipe.content -> 'ingredients') not between 1 and 30
    or jsonb_array_length(private_recipe.content -> 'steps') not between 1 and 20
    or length(private_recipe.title) > 200 then
    raise exception 'invalid shared recipe content';
  end if;
  if exists (
    select 1 from jsonb_array_elements(private_recipe.content -> 'ingredients') as ingredient
    where jsonb_typeof(ingredient) <> 'object'
      or length(btrim(coalesce(ingredient ->> 'name', ''))) not between 1 and 100
  ) or exists (
    select 1 from jsonb_array_elements(private_recipe.content -> 'steps') as step
    where jsonb_typeof(step) <> 'object'
      or length(btrim(coalesce(step ->> 'text', ''))) not between 1 and 1000
  ) then raise exception 'invalid shared recipe lines'; end if;

  select array_agg(distinct lower(btrim(ingredient ->> 'name')))
    into names
  from jsonb_array_elements(private_recipe.content -> 'ingredients') as ingredient;

  public_content := jsonb_build_object(
    'title', private_recipe.title,
    'servings', private_recipe.content -> 'servings',
    'minutes', private_recipe.content -> 'minutes',
    'ingredients', (
      select jsonb_agg(jsonb_build_object(
        'name', ingredient ->> 'name',
        'quantity', ingredient -> 'quantity',
        'unit', ingredient -> 'unit'
      )) from jsonb_array_elements(private_recipe.content -> 'ingredients') as ingredient
    ),
    'steps', (
      select jsonb_agg(jsonb_build_object(
        'text', step ->> 'text',
        'minutes', step -> 'minutes'
      )) from jsonb_array_elements(private_recipe.content -> 'steps') as step
    )
  );

  insert into recipe_catalog.shared_recipes(origin_recipe_id, title, content, ingredient_names)
  values(private_recipe.id, private_recipe.title, public_content, names)
  on conflict (origin_recipe_id) do nothing
  returning id into shared_id;

  if shared_id is null then
    select id into shared_id from recipe_catalog.shared_recipes
    where origin_recipe_id = private_recipe.id;
  end if;
  return shared_id;
end
$$;

revoke all on function public.share_completed_ai_recipe(uuid) from public, anon;
grant execute on function public.share_completed_ai_recipe(uuid) to authenticated;

create function public.complete_recipe_cooking_shared(
  recipe_title text,
  recipe_content jsonb,
  usage_lines jsonb,
  request_key text,
  share_after_completion boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  result jsonb;
  shared_id uuid;
begin
  if coalesce(share_after_completion, false)
    and recipe_content ->> 'origin' <> 'AI_GENERATED' then
    raise exception 'only AI-generated recipes can be shared';
  end if;

  select public.complete_recipe_cooking(
    recipe_title, recipe_content, usage_lines, request_key
  ) into result;

  if coalesce(share_after_completion, false) and result ->> 'status' = 'completed' then
    select public.share_completed_ai_recipe((result ->> 'recipe_id')::uuid)
      into shared_id;
    result := result || jsonb_build_object('shared_recipe_id', shared_id);
  end if;
  return result;
end
$$;

revoke all on function public.complete_recipe_cooking_shared(text, jsonb, jsonb, text, boolean)
from public, anon;
grant execute on function public.complete_recipe_cooking_shared(text, jsonb, jsonb, text, boolean)
to authenticated;

notify pgrst, 'reload schema';
